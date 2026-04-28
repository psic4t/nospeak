package com.nospeak.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;


public final class AndroidProfileCachePrefs {

    private static final String PREFS_NAME = "nospeak_profile_cache";
    private static final String KEY_INDEX_JSON = "indexJson";

    private static final int MAX_ENTRIES = 100;

    private AndroidProfileCachePrefs() {
    }

    public static final class Identity {

        public final String username;
        public final String pictureUrl;
        /**
         * NIP-17 messaging relays (kind 10050) for this pubkey, populated by JS via
         * {@code AndroidBackgroundMessaging.cacheProfile}. Used by
         * {@code NativeBackgroundMessagingService.sendVoiceCallReject} to publish
         * to the recipient's preferred DM relays. Never null; may be empty when
         * the cache record is legacy or the user has no kind 10050 published.
         */
        public final List<String> messagingRelays;

        public Identity(String username, String pictureUrl) {
            this(username, pictureUrl, null);
        }

        public Identity(String username, String pictureUrl, List<String> messagingRelays) {
            this.username = username;
            this.pictureUrl = pictureUrl;
            this.messagingRelays = messagingRelays != null
                ? Collections.unmodifiableList(new ArrayList<>(messagingRelays))
                : Collections.<String>emptyList();
        }
    }

    public static void upsert(Context context, String pubkeyHex, String username, String pictureUrl, long updatedAt) {
        upsert(context, pubkeyHex, username, pictureUrl, null, updatedAt);
    }

    public static void upsert(
        Context context,
        String pubkeyHex,
        String username,
        String pictureUrl,
        List<String> messagingRelays,
        long updatedAt
    ) {
        if (context == null) {
            return;
        }

        if (pubkeyHex == null || pubkeyHex.isEmpty()) {
            return;
        }

        if (username == null || username.trim().isEmpty()) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        JSONObject record;
        try {
            record = new JSONObject();
            record.put("username", username.trim());
            if (pictureUrl != null && !pictureUrl.trim().isEmpty()) {
                record.put("pictureUrl", pictureUrl.trim());
            }
            if (messagingRelays != null && !messagingRelays.isEmpty()) {
                JSONArray arr = new JSONArray();
                for (String url : messagingRelays) {
                    if (url == null) continue;
                    String trimmed = url.trim();
                    if (trimmed.isEmpty()) continue;
                    arr.put(trimmed);
                }
                if (arr.length() > 0) {
                    record.put("messagingRelays", arr);
                }
            }
            record.put("updatedAt", updatedAt);
        } catch (Exception e) {
            return;
        }

        editor.putString(profileKey(pubkeyHex), record.toString());

        JSONArray index = readIndex(prefs);
        JSONArray updatedIndex = AndroidProfileCacheIndex.upsert(index, pubkeyHex, updatedAt);
        AndroidProfileCacheIndex.PruneResult pruned = AndroidProfileCacheIndex.prune(updatedIndex, MAX_ENTRIES);

        for (String removedPubkeyHex : pruned.removedPubkeys) {
            editor.remove(profileKey(removedPubkeyHex));
        }

        editor.putString(KEY_INDEX_JSON, pruned.index.toString());
        editor.apply();
    }

    public static Identity get(Context context, String pubkeyHex) {
        if (context == null) {
            return null;
        }

        if (pubkeyHex == null || pubkeyHex.isEmpty()) {
            return null;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(profileKey(pubkeyHex), null);
        if (raw == null || raw.isEmpty()) {
            return null;
        }

        try {
            JSONObject record = new JSONObject(raw);
            String username = record.optString("username", "").trim();
            if (username.isEmpty()) {
                return null;
            }

            String pictureUrl = record.optString("pictureUrl", null);
            if (pictureUrl != null) {
                pictureUrl = pictureUrl.trim();
                if (pictureUrl.isEmpty()) {
                    pictureUrl = null;
                }
            }

            // messagingRelays is optional and absent on legacy records.
            List<String> messagingRelays = null;
            JSONArray relaysArr = record.optJSONArray("messagingRelays");
            if (relaysArr != null && relaysArr.length() > 0) {
                messagingRelays = new ArrayList<>(relaysArr.length());
                for (int i = 0; i < relaysArr.length(); i++) {
                    String url = relaysArr.optString(i, null);
                    if (url == null) continue;
                    String trimmed = url.trim();
                    if (!trimmed.isEmpty()) {
                        messagingRelays.add(trimmed);
                    }
                }
            }

            return new Identity(username, pictureUrl, messagingRelays);
        } catch (JSONException e) {
            return null;
        }
    }

    private static JSONArray readIndex(SharedPreferences prefs) {
        String raw = prefs.getString(KEY_INDEX_JSON, null);
        if (raw == null || raw.isEmpty()) {
            return new JSONArray();
        }

        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static String profileKey(String pubkeyHex) {
        return "profile_" + pubkeyHex;
    }
}
