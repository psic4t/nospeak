package com.nospeak.app;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Unit tests for {@link SchnorrCrypto}. Uses canonical BIP-340 test
 * vectors from the BIP-340 specification's reference test cases.
 *
 * <p>If any of these tests fail it almost certainly means the curve
 * arithmetic or tagged-hash construction is wrong and the corresponding
 * {@code schnorrSign} path will also be broken — in which case
 * existing call signaling and gift wrapping will fail in production,
 * not just this verifier.
 */
public class SchnorrCryptoTest {

    /** Convert a hex string to bytes; helper for fixtures. */
    private static byte[] hex(String s) {
        int len = s.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            out[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                    | Character.digit(s.charAt(i + 1), 16));
        }
        return out;
    }

    /** BIP-340 test vector 0: smallest-secret-key, all-zero message. */
    @Test
    public void verifyKnownGoodVector0() {
        byte[] msg = hex("0000000000000000000000000000000000000000000000000000000000000000");
        String pubkey = "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9";
        String sig =
                "e907831f80848d1069a5371b402410364bdf1c5f8307b0084c55f1ce2dca8215"
              + "25f66a4a85ea8b71e482a74f382d2ce5ebeee8fdb2172f477df4900d310536c0";
        assertTrue("BIP-340 vector 0 must verify", SchnorrCrypto.verify(msg, sig, pubkey));
    }

    /** BIP-340 test vector 1: real message digest. */
    @Test
    public void verifyKnownGoodVector1() {
        byte[] msg = hex("243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89");
        String pubkey = "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659";
        String sig =
                "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de3341"
              + "8906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a";
        assertTrue("BIP-340 vector 1 must verify", SchnorrCrypto.verify(msg, sig, pubkey));
    }

    /** Tampering with the message must invalidate the signature. */
    @Test
    public void tamperedMessageRejected() {
        byte[] msgGood = hex("243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89");
        // Flip the last byte of the message digest.
        byte[] msgBad = msgGood.clone();
        msgBad[31] = (byte) (msgBad[31] ^ 0x01);
        String pubkey = "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659";
        String sig =
                "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de3341"
              + "8906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a";
        assertFalse("tampered message must NOT verify",
                SchnorrCrypto.verify(msgBad, sig, pubkey));
    }

    /** Bit-flipped signature must not verify. */
    @Test
    public void tamperedSignatureRejected() {
        byte[] msg = hex("243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89");
        String pubkey = "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659";
        // Flip last hex digit of signature.
        String sigBad =
                "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de3341"
              + "8906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0b";
        assertFalse("tampered signature must NOT verify",
                SchnorrCrypto.verify(msg, sigBad, pubkey));
    }

    /** Wrong-but-valid pubkey must not verify. */
    @Test
    public void wrongPubkeyRejected() {
        byte[] msg = hex("243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89");
        // Use vector 0's pubkey — the correct one is vector 1's.
        String wrongPubkey = "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9";
        String sig =
                "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de3341"
              + "8906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a";
        assertFalse("signature for vector 1 must NOT verify under vector 0's pubkey",
                SchnorrCrypto.verify(msg, sig, wrongPubkey));
    }

    /** Malformed inputs return false rather than throwing. */
    @Test
    public void malformedInputsReturnFalse() {
        byte[] goodMsg = hex("243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89");
        String goodPubkey = "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659";
        String goodSig =
                "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de3341"
              + "8906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a";

        assertFalse("null message", SchnorrCrypto.verify(null, goodSig, goodPubkey));
        assertFalse("empty message",
                SchnorrCrypto.verify(new byte[0], goodSig, goodPubkey));
        assertFalse("null sig", SchnorrCrypto.verify(goodMsg, null, goodPubkey));
        assertFalse("short sig", SchnorrCrypto.verify(goodMsg, "deadbeef", goodPubkey));
        assertFalse("non-hex sig",
                SchnorrCrypto.verify(goodMsg, "z".repeat(128), goodPubkey));
        assertFalse("null pubkey", SchnorrCrypto.verify(goodMsg, goodSig, null));
        assertFalse("short pubkey",
                SchnorrCrypto.verify(goodMsg, goodSig, "deadbeef"));
        assertFalse("non-hex pubkey",
                SchnorrCrypto.verify(goodMsg, goodSig, "z".repeat(64)));
    }
}
