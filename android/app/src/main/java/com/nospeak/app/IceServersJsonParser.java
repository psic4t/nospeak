package com.nospeak.app;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.webrtc.PeerConnection;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Parses the deterministic-JSON ICE servers list that
 * {@code VoiceCallServiceNative.getIceServersJson()} produces and the
 * {@link AndroidVoiceCallPlugin} forwards via the
 * {@link VoiceCallForegroundService#EXTRA_ICE_SERVERS_JSON} intent extra.
 *
 * <p>Wire format (matches the {@code RTCIceServer[]} shape):
 * <pre>{@code
 * [
 *   { "urls": "stun:server:3478" },
 *   { "urls": ["turn:host:3478?transport=udp",
 *              "turn:host:3478?transport=tcp"],
 *     "username": "u",
 *     "credential": "p" }
 * ]
 * }</pre>
 *
 * <p>An entry whose {@code urls} field is a JSON array fans out into
 * one {@link PeerConnection.IceServer} per URL, all carrying the same
 * {@code username} and {@code credential} from the source entry.
 *
 * <p>Malformed entries are skipped with a {@code Log.w} line; the
 * parser continues with the remaining valid entries. Null, empty, or
 * top-level-malformed input causes the helper to return the supplied
 * fallback list (typically the FGS's compile-time default).
 *
 * <p>Pure-Java (no Android framework dependencies beyond
 * {@code android.util.Log}, {@code org.json.*}, and the WebRTC
 * {@code IceServer.builder}) so the bulk of behavior is covered by
 * {@code IceServersJsonParserTest} on the JVM-only unit-test target.
 *
 * <p>Part of the {@code fix-android-ice-servers-from-runtime-config}
 * OpenSpec change.
 */
public final class IceServersJsonParser {

    private static final String TAG = "IceServersJsonParser";

    private IceServersJsonParser() {
        // Utility class; no instances.
    }

    /**
     * Source of the resolved iceServers list. Returned alongside the
     * parsed list so the FGS can emit a truthful log line
     * ({@code iceServers count=N (from extra|from prefs|fallback default)}).
     */
    public enum Source {
        FROM_EXTRA,
        FROM_PREFS,
        FALLBACK_DEFAULT
    }

    /** Result of {@link #parse(String, List)}. */
    public static final class Result {
        public final List<PeerConnection.IceServer> servers;
        public final boolean usedFallback;
        public Result(List<PeerConnection.IceServer> servers, boolean usedFallback) {
            this.servers = servers;
            this.usedFallback = usedFallback;
        }
    }

    /**
     * Parse {@code json} into a list of {@link PeerConnection.IceServer}.
     *
     * @param json     JSON array string (or null) as produced by
     *                 {@code serializeIceServers} on the JS side.
     * @param fallback list returned when {@code json} is null, empty,
     *                 or not parseable as a JSON array. Must not be
     *                 null; pass an empty list to disable the fallback.
     * @return         result with the parsed list (or fallback) and a
     *                 boolean indicating whether the fallback was used.
     *                 Never returns null.
     */
    public static Result parse(String json, List<PeerConnection.IceServer> fallback) {
        if (fallback == null) {
            fallback = Collections.emptyList();
        }
        if (json == null || json.isEmpty()) {
            return new Result(fallback, /* usedFallback= */ true);
        }
        JSONArray arr;
        try {
            arr = new JSONArray(json);
        } catch (JSONException e) {
            Log.w(TAG, "iceServersJson is not a JSON array; using fallback");
            return new Result(fallback, /* usedFallback= */ true);
        }

        List<PeerConnection.IceServer> out = new ArrayList<>(arr.length());
        for (int i = 0; i < arr.length(); i++) {
            JSONObject entry = arr.optJSONObject(i);
            if (entry == null) {
                Log.w(TAG, "iceServersJson[" + i + "] is not an object; skipping");
                continue;
            }
            String username = entry.optString("username", null);
            String credential = entry.optString("credential", null);
            // optString returns "null" string when the key holds a JSON null —
            // normalize to actual null so the IceServer builder doesn't carry
            // the literal "null" string into the credential.
            if ("null".equals(username)) username = null;
            if ("null".equals(credential)) credential = null;

            Object urlsRaw = entry.opt("urls");
            if (urlsRaw == null) {
                Log.w(TAG, "iceServersJson[" + i + "] missing 'urls'; skipping");
                continue;
            }

            if (urlsRaw instanceof String) {
                PeerConnection.IceServer built = buildServer(
                    (String) urlsRaw, username, credential);
                if (built != null) {
                    out.add(built);
                }
            } else if (urlsRaw instanceof JSONArray) {
                JSONArray urlArr = (JSONArray) urlsRaw;
                for (int j = 0; j < urlArr.length(); j++) {
                    // Use opt() rather than optString() because the
                    // latter coerces numbers (e.g. 42) to their string
                    // representation, which we want to treat as
                    // malformed, not as a valid URL.
                    Object urlEntry = urlArr.opt(j);
                    if (!(urlEntry instanceof String)) {
                        Log.w(TAG, "iceServersJson[" + i + "].urls[" + j
                            + "] not a string; skipping");
                        continue;
                    }
                    String url = (String) urlEntry;
                    if (url.isEmpty()) {
                        Log.w(TAG, "iceServersJson[" + i + "].urls[" + j
                            + "] empty string; skipping");
                        continue;
                    }
                    PeerConnection.IceServer built = buildServer(
                        url, username, credential);
                    if (built != null) {
                        out.add(built);
                    }
                }
            } else {
                Log.w(TAG, "iceServersJson[" + i
                    + "].urls is neither string nor array; skipping");
            }
        }

        // If the input parsed as a valid array but every entry was
        // skipped (or the array was empty), treat the result as "no
        // valid servers" and use the fallback. Building a peer
        // connection with an empty iceServers list works in libwebrtc
        // but defeats the purpose of having TURN configured.
        if (out.isEmpty()) {
            Log.w(TAG, "iceServersJson yielded no valid entries; using fallback");
            return new Result(fallback, /* usedFallback= */ true);
        }
        return new Result(out, /* usedFallback= */ false);
    }

    private static PeerConnection.IceServer buildServer(
            String url, String username, String credential) {
        if (url == null || url.isEmpty()) {
            return null;
        }
        PeerConnection.IceServer.Builder b = PeerConnection.IceServer.builder(url);
        if (username != null && !username.isEmpty()) {
            b.setUsername(username);
        }
        if (credential != null && !credential.isEmpty()) {
            b.setPassword(credential);
        }
        try {
            return b.createIceServer();
        } catch (Throwable t) {
            Log.w(TAG, "iceServer builder threw for url=" + url, t);
            return null;
        }
    }
}
