package com.nospeak.app;

import org.junit.Test;
import org.webrtc.PeerConnection;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

/**
 * Unit tests for {@link IceServersJsonParser#parse}. Part of the
 * {@code fix-android-ice-servers-from-runtime-config} OpenSpec change.
 *
 * <p>Covers the wire-format permutations
 * {@code VoiceCallServiceNative.getIceServersJson()} can produce plus
 * the malformed-input branches we have to defend against on the
 * Android side (cold-start corruption, schema drift between client and
 * server, etc.).
 *
 * <p>Pure JVM unit test — no Android framework, no Robolectric. The
 * {@code android.util.Log} calls in the parser are stubbed in the
 * unit-test runtime by the AGP-default mock implementation.
 */
public class IceServersJsonParserTest {

    private static List<PeerConnection.IceServer> emptyFallback() {
        return new ArrayList<>();
    }

    private static List<PeerConnection.IceServer> singleStunFallback() {
        List<PeerConnection.IceServer> list = new ArrayList<>(1);
        list.add(PeerConnection.IceServer
            .builder("stun:fallback.example:3478").createIceServer());
        return list;
    }

    @Test
    public void parsesSingleStringUrls() {
        String json = "[{\"urls\":\"stun:server.example:3478\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(1, r.servers.size());
        PeerConnection.IceServer s = r.servers.get(0);
        // urls is a List<String> on the IceServer side.
        assertEquals(1, s.urls.size());
        assertEquals("stun:server.example:3478", s.urls.get(0));
    }

    @Test
    public void parsesArrayUrlsAsMultipleServers() {
        // The fan-out semantics: a single entry with `urls` as an array
        // produces ONE PeerConnection.IceServer PER URL, all sharing
        // the source entry's credentials.
        String json = "[{\"urls\":["
            + "\"turn:host.example:3478?transport=udp\","
            + "\"turn:host.example:3478?transport=tcp\""
            + "],\"username\":\"u\",\"credential\":\"p\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(2, r.servers.size());
        PeerConnection.IceServer udp = r.servers.get(0);
        PeerConnection.IceServer tcp = r.servers.get(1);
        assertEquals(1, udp.urls.size());
        assertEquals("turn:host.example:3478?transport=udp", udp.urls.get(0));
        assertEquals("u", udp.username);
        assertEquals("p", udp.password);
        assertEquals(1, tcp.urls.size());
        assertEquals("turn:host.example:3478?transport=tcp", tcp.urls.get(0));
        assertEquals("u", tcp.username);
        assertEquals("p", tcp.password);
    }

    @Test
    public void handlesMissingCredentials() {
        String json = "[{\"urls\":\"stun:server.example:3478\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(1, r.servers.size());
        PeerConnection.IceServer s = r.servers.get(0);
        // STUN entries should have empty / null-ish credentials.
        // IceServer's default for these is empty string.
        assertTrue(s.username == null || s.username.isEmpty());
        assertTrue(s.password == null || s.password.isEmpty());
    }

    @Test
    public void handlesPresentCredentials() {
        String json = "[{\"urls\":\"turn:host:3478\","
            + "\"username\":\"alice\",\"credential\":\"secret\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(1, r.servers.size());
        assertEquals("alice", r.servers.get(0).username);
        assertEquals("secret", r.servers.get(0).password);
    }

    @Test
    public void emptyArrayUsesFallback() {
        List<PeerConnection.IceServer> fb = singleStunFallback();
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse("[]", fb);
        assertTrue(r.usedFallback);
        assertSame(fb, r.servers);
    }

    @Test
    public void malformedJsonUsesFallback() {
        List<PeerConnection.IceServer> fb = singleStunFallback();
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse("{not json", fb);
        assertTrue(r.usedFallback);
        assertSame(fb, r.servers);
    }

    @Test
    public void nonArrayTopLevelUsesFallback() {
        List<PeerConnection.IceServer> fb = singleStunFallback();
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse("{\"urls\":\"stun:x:3478\"}", fb);
        assertTrue(r.usedFallback);
        assertSame(fb, r.servers);
    }

    @Test
    public void nullInputUsesFallback() {
        List<PeerConnection.IceServer> fb = singleStunFallback();
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(null, fb);
        assertTrue(r.usedFallback);
        assertSame(fb, r.servers);
    }

    @Test
    public void emptyStringInputUsesFallback() {
        List<PeerConnection.IceServer> fb = singleStunFallback();
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse("", fb);
        assertTrue(r.usedFallback);
        assertSame(fb, r.servers);
    }

    @Test
    public void skipsMalformedEntriesKeepsValidOnes() {
        // Entry 0: not an object — skipped.
        // Entry 1: missing urls — skipped.
        // Entry 2: valid STUN.
        String json = "[42,"
            + "{\"username\":\"u\"},"
            + "{\"urls\":\"stun:ok.example:3478\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(1, r.servers.size());
        assertEquals("stun:ok.example:3478", r.servers.get(0).urls.get(0));
    }

    @Test
    public void skipsNonStringUrlInArray() {
        // The first url is a number (invalid); the second is a string.
        String json = "[{\"urls\":[42,\"turn:ok.example:3478\"]}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(1, r.servers.size());
        assertEquals("turn:ok.example:3478", r.servers.get(0).urls.get(0));
    }

    @Test
    public void allInvalidEntriesUsesFallback() {
        // Every entry is malformed -> overall result should be fallback.
        List<PeerConnection.IceServer> fb = singleStunFallback();
        String json = "[{\"username\":\"u\"},{\"username\":\"v\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, fb);
        assertTrue(r.usedFallback);
        assertSame(fb, r.servers);
    }

    @Test
    public void nullFallbackIsCoercedToEmpty() {
        // Defensive: a null fallback must not NPE; we treat it as
        // empty list (which then becomes the "used fallback" result).
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(null, null);
        assertNotNull(r.servers);
        assertTrue(r.usedFallback);
        assertTrue(r.servers.isEmpty());
    }

    @Test
    public void defaultsTsShapeParsesAsExpected() {
        // Mirror the exact shape we ship in
        // android/app/src/main/res/raw/default_ice_servers.json after
        // add-plain-turn-to-default-ice-servers landed. The TURN entry
        // uses the 2-element `urls` array (UDP + TCP transport
        // variants), which fans out into TWO PeerConnection.IceServer
        // instances sharing the credentials — so the total count is
        // 2 STUN + 2 TURN = 4 entries.
        String json = "[{\"urls\":\"stun:turn.data.haus:3478\"},"
            + "{\"urls\":\"stun:stun.cloudflare.com:3478\"},"
            + "{\"urls\":["
            + "\"turn:turn.data.haus:3478?transport=udp\","
            + "\"turn:turn.data.haus:3478?transport=tcp\""
            + "],\"username\":\"free\",\"credential\":\"free\"}]";
        IceServersJsonParser.Result r =
            IceServersJsonParser.parse(json, emptyFallback());
        assertFalse(r.usedFallback);
        assertEquals(4, r.servers.size());
        assertEquals("stun:turn.data.haus:3478", r.servers.get(0).urls.get(0));
        assertEquals("stun:stun.cloudflare.com:3478", r.servers.get(1).urls.get(0));
        assertEquals(
            "turn:turn.data.haus:3478?transport=udp",
            r.servers.get(2).urls.get(0));
        assertEquals("free", r.servers.get(2).username);
        assertEquals("free", r.servers.get(2).password);
        assertEquals(
            "turn:turn.data.haus:3478?transport=tcp",
            r.servers.get(3).urls.get(0));
        assertEquals("free", r.servers.get(3).username);
        assertEquals("free", r.servers.get(3).password);
    }
}
