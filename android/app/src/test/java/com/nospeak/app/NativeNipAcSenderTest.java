package com.nospeak.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.lang.reflect.Method;
import java.security.MessageDigest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

/**
 * Wire-format parity test for the native NIP-AC senders. Phase 0
 * plumbing for the {@code add-native-voice-calls} OpenSpec change.
 *
 * <p>Reads the same fixture as the JavaScript-side parity test
 * ({@code src/lib/core/voiceCall/wireParity.test.ts}). For each case,
 * builds the canonical inner event via
 * {@link NativeBackgroundMessagingService#buildNipAcInnerForTest}
 * (a test-only static entrypoint that runs the same construction
 * logic as the production senders without requiring a service
 * instance, signing, or relay publishing). The resulting JSON is
 * then SHA-256-hashed via the NIP-01 canonical serialization
 * (matching what relays compute) and compared against the fixture's
 * {@code expectedId}.
 *
 * <p>If this test fails, the wire format has drifted between JS and
 * native — e.g. tag order, content escaping, or property order in
 * the inner JSON. Both sides MUST produce the same id for any
 * remote NIP-AC peer to interoperate with this client.
 */
public class NativeNipAcSenderTest {

    /**
     * Path to the fixture, relative to the gradle test working dir
     * ({@code android/app}). The unit-test runner has {@code app/} as
     * its CWD, so the project root is two levels up.
     */
    private static final String FIXTURE_PATH = "../../tests/fixtures/nip-ac-wire/inner-events.json";

    @Test
    public void allFixtureCasesProduceExpectedEventId() throws Exception {
        JSONObject fixture = readFixture();
        String sender = fixture.getString("sender");
        String recipient = fixture.getString("recipient");
        String callId = fixture.getString("callId");
        long createdAt = fixture.getLong("createdAt");

        JSONArray cases = fixture.getJSONArray("cases");
        assertNotNull(cases);
        assertEquals("fixture must declare at least one case", true, cases.length() > 0);

        // buildNipAcInnerForTest is package-private static; we invoke it
        // reflectively rather than promoting it to public. The signature is
        //   buildNipAcInnerForTest(senderHex, recipientHex, callId, kind,
        //                          content, altText, extraTags, createdAt)
        Method builder = NativeBackgroundMessagingService.class.getDeclaredMethod(
            "buildNipAcInnerForTest",
            String.class,
            String.class,
            String.class,
            int.class,
            String.class,
            String.class,
            JSONArray.class,
            long.class
        );
        builder.setAccessible(true);

        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            String name = c.optString("name", "case#" + i);
            int kind = c.getInt("kind");
            String content = c.getString("content");
            String altText = c.getString("altText");
            JSONArray extraTags = c.getJSONArray("extraTags");
            String expectedId = c.getString("expectedId");

            String innerJson = (String) builder.invoke(
                null, sender, recipient, callId, kind, content, altText, extraTags, createdAt);
            assertNotNull("inner JSON for " + name, innerJson);

            JSONObject inner = new JSONObject(innerJson);
            String actualId = inner.getString("id");

            assertEquals(
                "kind " + kind + " :: " + name + " event id mismatch",
                expectedId,
                actualId
            );

            // Belt-and-braces: also verify the id is the sha256 of the
            // canonical NIP-01 array as recomputed locally — catches the
            // case where buildNipAcInnerForTest mistakenly emits an id
            // value that doesn't match its own canonical bytes.
            String localId = canonicalEventId(
                sender, createdAt, kind, inner.getJSONArray("tags"), content);
            assertEquals(
                "kind " + kind + " :: " + name + " local recompute mismatch",
                expectedId,
                localId
            );
        }
    }

    private static JSONObject readFixture() throws Exception {
        File file = new File(FIXTURE_PATH);
        if (!file.exists()) {
            // Fall back: when run from the repo root.
            file = new File("tests/fixtures/nip-ac-wire/inner-events.json");
        }
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = r.readLine()) != null) {
                sb.append(line).append('\n');
            }
        }
        return new JSONObject(sb.toString());
    }

    /**
     * Recompute the NIP-01 event id locally without going through the
     * service's serializer. Matches the JS test's {@code computeEventId}
     * and the canonical form relays expect. Used as a cross-check.
     */
    private static String canonicalEventId(
            String pubkey,
            long createdAt,
            int kind,
            JSONArray tags,
            String content) throws Exception {
        // Use a JSONArray to JSON-stringify the canonical NIP-01 form:
        //   [0, pubkey, created_at, kind, tags, content]
        // org.json's toString uses the same JSON syntax as ECMAScript
        // JSON.stringify for these primitive types (no whitespace, no
        // trailing commas, no escaped slashes other than the ones it
        // emits — note that in this codepath there is no '/' to worry
        // about because all fixture content uses base ASCII).
        // For absolute safety we build the string manually rather than
        // trusting org.json's escaping rules.
        StringBuilder sb = new StringBuilder();
        sb.append('[');
        sb.append('0');
        sb.append(',');
        appendJsString(sb, pubkey);
        sb.append(',');
        sb.append(createdAt);
        sb.append(',');
        sb.append(kind);
        sb.append(',');
        appendTags(sb, tags);
        sb.append(',');
        appendJsString(sb, content);
        sb.append(']');

        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(sb.toString().getBytes("UTF-8"));
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b & 0xff));
        }
        return hex.toString();
    }

    private static void appendTags(StringBuilder sb, JSONArray tags) throws Exception {
        sb.append('[');
        for (int i = 0; i < tags.length(); i++) {
            if (i > 0) sb.append(',');
            JSONArray t = tags.getJSONArray(i);
            sb.append('[');
            for (int j = 0; j < t.length(); j++) {
                if (j > 0) sb.append(',');
                appendJsString(sb, t.getString(j));
            }
            sb.append(']');
        }
        sb.append(']');
    }

    private static void appendJsString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\b': sb.append("\\b"); break;
                case '\t': sb.append("\\t"); break;
                case '\n': sb.append("\\n"); break;
                case '\f': sb.append("\\f"); break;
                case '\r': sb.append("\\r"); break;
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }
}
