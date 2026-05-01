package com.nospeak.app;

import android.util.Log;

import org.bouncycastle.asn1.sec.SECNamedCurves;
import org.bouncycastle.asn1.x9.X9ECParameters;
import org.bouncycastle.math.ec.ECPoint;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * BIP-340 Schnorr signature verification helpers for x-only secp256k1
 * public keys. Phase 0 plumbing for the {@code add-native-voice-calls}
 * OpenSpec change: lets the native NIP-AC dispatch path verify inner
 * event signatures before handing off to handlers, matching the
 * existing JavaScript {@code verifyEvent} behaviour from nostr-tools.
 *
 * <p>Algorithm (BIP-340):
 * <pre>
 *   verify(msg, pubkey_x, sig):
 *     P = lift_x(pubkey_x)                                  // even-y
 *     r = sig[0..32]
 *     s = sig[32..64]
 *     if r >= p (field prime): fail
 *     if s >= n (curve order): fail
 *     e = int(tagged_hash("BIP0340/challenge", r||pubkey_x||msg)) mod n
 *     R = s*G - e*P
 *     if R is infinity: fail
 *     if R.y is odd: fail
 *     if R.x != r: fail
 *     pass
 * </pre>
 *
 * <p>Implementation notes
 * <ul>
 *   <li>Uses BouncyCastle's secp256k1 curve parameters; consistent with
 *       {@link NativeBackgroundMessagingService#schnorrSign}.</li>
 *   <li>Verifies x-only (32-byte) public keys per BIP-340. Nostr always
 *       uses x-only.</li>
 *   <li>Returns {@code false} for any malformed input rather than
 *       throwing — callers are expected to log and silently drop bad
 *       events.</li>
 * </ul>
 */
public final class SchnorrCrypto {

    private static final String TAG = "SchnorrCrypto";

    /**
     * Pre-computed BIP-340 tagged-hash prefix for the
     * {@code "BIP0340/challenge"} domain separator: {@code sha256(tag) || sha256(tag)}.
     * Computed once at class load.
     */
    private static final byte[] BIP340_CHALLENGE_TAG_PREFIX = doubledTagHash("BIP0340/challenge");

    /** secp256k1 field prime p = 2^256 - 2^32 - 977 (= 2^256 - 2^32 - 2^9 - 2^8 - 2^7 - 2^6 - 2^4 - 1). */
    private static final BigInteger FIELD_PRIME = new BigInteger(
            "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F", 16);

    /**
     * Verify a BIP-340 Schnorr signature.
     *
     * @param messageBytes  the 32-byte message digest that was signed (e.g. the
     *                      Nostr event id bytes).
     * @param signatureHex  the 128-character hex encoding of the 64-byte signature.
     * @param pubkeyHex     the 64-character hex encoding of the 32-byte x-only public key.
     * @return              {@code true} iff the signature verifies against the
     *                      message and pubkey.
     */
    public static boolean verify(byte[] messageBytes, String signatureHex, String pubkeyHex) {
        if (messageBytes == null || messageBytes.length == 0) {
            return false;
        }
        byte[] sig = hexToBytes(signatureHex);
        if (sig == null || sig.length != 64) {
            return false;
        }
        byte[] pkX = hexToBytes(pubkeyHex);
        if (pkX == null || pkX.length != 32) {
            return false;
        }

        try {
            X9ECParameters params = SECNamedCurves.getByName("secp256k1");
            if (params == null) return false;
            BigInteger n = params.getN();
            ECPoint G = params.getG();

            byte[] rBytes = new byte[32];
            byte[] sBytes = new byte[32];
            System.arraycopy(sig, 0, rBytes, 0, 32);
            System.arraycopy(sig, 32, sBytes, 0, 32);

            BigInteger r = new BigInteger(1, rBytes);
            BigInteger s = new BigInteger(1, sBytes);

            // Range checks per BIP-340.
            if (r.compareTo(FIELD_PRIME) >= 0) return false;
            if (s.compareTo(n) >= 0) return false;

            // Lift x to a point with even y. BouncyCastle's
            // ECCurve.decodePoint accepts a 33-byte compressed encoding
            // (0x02 || x for even y). BIP-340's lift_x always picks the
            // even-y representative.
            byte[] compressed = new byte[33];
            compressed[0] = 0x02;
            System.arraycopy(pkX, 0, compressed, 1, 32);

            ECPoint P;
            try {
                P = params.getCurve().decodePoint(compressed).normalize();
            } catch (Exception decode) {
                // x not on curve, or decoding rejected — invalid pubkey.
                return false;
            }
            if (P.isInfinity()) return false;

            // e = int(tagged_hash("BIP0340/challenge", r.x || P.x || m)) mod n
            byte[] eHash = taggedHash(BIP340_CHALLENGE_TAG_PREFIX, rBytes, pkX, messageBytes);
            if (eHash == null) return false;
            BigInteger e = new BigInteger(1, eHash).mod(n);

            // R = s*G - e*P = s*G + (n - e)*P
            ECPoint sG = G.multiply(s);
            ECPoint negEP = P.multiply(n.subtract(e));
            ECPoint R = sG.add(negEP).normalize();
            if (R.isInfinity()) return false;
            // Reject if R.y is odd (BIP-340 requires even y).
            if (R.getAffineYCoord().testBitZero()) return false;

            // Check R.x == r.
            byte[] rxBytes = R.getAffineXCoord().getEncoded();
            if (rxBytes.length != 32) {
                byte[] tmp = new byte[32];
                int srcStart = Math.max(0, rxBytes.length - 32);
                int dstStart = Math.max(0, 32 - rxBytes.length);
                int len = Math.min(32, rxBytes.length);
                System.arraycopy(rxBytes, srcStart, tmp, dstStart, len);
                rxBytes = tmp;
            }
            return constantTimeEquals(rxBytes, rBytes);
        } catch (Exception ex) {
            Log.w(TAG, "verify exception", ex);
            return false;
        }
    }

    // --- helpers ------------------------------------------------------

    private static byte[] doubledTagHash(String tag) {
        byte[] h = sha256(tag.getBytes(StandardCharsets.UTF_8));
        if (h == null) return new byte[0];
        byte[] out = new byte[h.length * 2];
        System.arraycopy(h, 0, out, 0, h.length);
        System.arraycopy(h, 0, out, h.length, h.length);
        return out;
    }

    private static byte[] taggedHash(byte[] doubledPrefix, byte[]... data) {
        int total = doubledPrefix.length;
        for (byte[] chunk : data) total += chunk == null ? 0 : chunk.length;
        byte[] payload = new byte[total];
        int pos = 0;
        System.arraycopy(doubledPrefix, 0, payload, pos, doubledPrefix.length);
        pos += doubledPrefix.length;
        for (byte[] chunk : data) {
            if (chunk == null || chunk.length == 0) continue;
            System.arraycopy(chunk, 0, payload, pos, chunk.length);
            pos += chunk.length;
        }
        return sha256(payload);
    }

    private static byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (NoSuchAlgorithmException e) {
            return null;
        }
    }

    private static byte[] hexToBytes(String hex) {
        if (hex == null) return null;
        int len = hex.length();
        if ((len & 1) != 0) return null;
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            int hi = Character.digit(hex.charAt(i), 16);
            int lo = Character.digit(hex.charAt(i + 1), 16);
            if (hi < 0 || lo < 0) return null;
            out[i / 2] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    private static boolean constantTimeEquals(byte[] a, byte[] b) {
        if (a.length != b.length) return false;
        int diff = 0;
        for (int i = 0; i < a.length; i++) {
            diff |= (a[i] ^ b[i]);
        }
        return diff == 0;
    }

    private SchnorrCrypto() {
        // utility class — no instances
    }
}
