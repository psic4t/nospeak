package com.nospeak.app;

import org.junit.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.ArrayList;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

/**
 * Pure-Java tests for the deterministic-pair offerer rule used to
 * assign edges in a group voice call's full mesh.
 *
 * <p>Per the {@code add-group-voice-calling} spec: <em>"For every
 * unordered pair {A, B} of roster members, exactly one side SHALL be
 * the designated SDP offerer for that pair: the participant whose
 * lowercase-hex pubkey is lexicographically lower SHALL be the
 * offerer for that edge."</em>
 *
 * <p>This file exercises the rule directly (the reusable predicate
 * lives inline rather than in a separate utility class — both the JS
 * implementation in {@code VoiceCallService.ts} and the Java
 * receive/initiate paths in
 * {@link NativeBackgroundMessagingService} compute the same lex
 * compare locally) so any future refactoring of the rule in
 * {@code NativeVoiceCallManager} can be validated against this matrix
 * before touching production code.
 */
public class GroupCallEdgeOwnershipTest {

    /**
     * Returns true iff {@code self} is the designated offerer for the
     * pair {@code {self, other}} per the spec rule.
     */
    private static boolean isOfferer(String self, String other) {
        return self.toLowerCase().compareTo(other.toLowerCase()) < 0;
    }

    private static final String LO =
        "0000000000000000000000000000000000000000000000000000000000000001";
    private static final String P_SELF =
        "1111111111111111111111111111111111111111111111111111111111111111";
    private static final String P_A =
        "3333333333333333333333333333333333333333333333333333333333333333";
    private static final String P_B =
        "4444444444444444444444444444444444444444444444444444444444444444";
    private static final String P_C =
        "5555555555555555555555555555555555555555555555555555555555555555";

    @Test
    public void selfLexLowerIsOfferer() {
        assertTrue(isOfferer(P_SELF, P_A));
        assertTrue(isOfferer(P_SELF, P_B));
        assertTrue(isOfferer(P_SELF, P_C));
    }

    @Test
    public void selfLexHigherIsNotOfferer() {
        // LO < P_SELF lex; from self's perspective, self is NOT the
        // offerer for the {self, LO} edge.
        assertEquals(false, isOfferer(P_SELF, LO));
    }

    @Test
    public void exactlyOneOffererPerEdgeOverPermutations() {
        // For every pair in a 4-roster, exactly one side is the
        // offerer. This is the core safety property: no offer-glare,
        // no orphan edges.
        String[] roster = {P_SELF, P_A, P_B, P_C};
        for (int i = 0; i < roster.length; i++) {
            for (int j = i + 1; j < roster.length; j++) {
                boolean iIsOfferer = isOfferer(roster[i], roster[j]);
                boolean jIsOfferer = isOfferer(roster[j], roster[i]);
                assertNotEquals(
                    "exactly one side of {" + roster[i] + "," + roster[j]
                        + "} must be the offerer",
                    iIsOfferer,
                    jIsOfferer);
            }
        }
    }

    @Test
    public void caseInsensitivityDoesNotChangeAssignment() {
        // The rule says "lowercase-hex compare". Mixing case at the
        // call site MUST NOT flip the result.
        String upper = P_A.toUpperCase();
        assertEquals(isOfferer(P_SELF, P_A), isOfferer(P_SELF, upper));
        assertEquals(isOfferer(P_A, P_SELF), isOfferer(upper, P_SELF));
    }

    @Test
    public void edgeAssignmentIsTotalAcrossRoster() {
        // From self's perspective in a 4-roster, the union of "edges
        // I offer" and "edges I receive" SHALL equal "edges in the
        // mesh that include me" (i.e. roster.size - 1).
        List<String> roster = new ArrayList<>();
        roster.add(P_SELF);
        roster.add(P_A);
        roster.add(P_B);
        roster.add(P_C);

        Set<String> iOffer = new HashSet<>();
        Set<String> iReceive = new HashSet<>();
        for (String peer : roster) {
            if (peer.equals(P_SELF)) continue;
            if (isOfferer(P_SELF, peer)) {
                iOffer.add(peer);
            } else {
                iReceive.add(peer);
            }
        }
        assertEquals(roster.size() - 1, iOffer.size() + iReceive.size());
        // Disjoint.
        Set<String> intersect = new HashSet<>(iOffer);
        intersect.retainAll(iReceive);
        assertTrue(intersect.isEmpty());
    }
}
