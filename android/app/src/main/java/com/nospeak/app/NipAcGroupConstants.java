package com.nospeak.app;

/**
 * NIP-AC group-call tag names and limits, mirroring
 * {@code src/lib/core/voiceCall/constants.ts}. Group calls reuse inner
 * kinds 25050-25054 unchanged; group semantics are conveyed via these
 * additional tags on the inner event. Receivers branch strictly on the
 * presence of {@link #GROUP_CALL_ID_TAG}: present → group-call
 * dispatch, absent → existing 1-on-1 dispatch.
 *
 * <p>See {@code openspec/changes/add-group-voice-calling/specs/voice-calling/spec.md}
 * for the authoritative wire-format requirements.
 *
 * <p>Existing 1-on-1 NIP-AC kinds (21059, 25050-25055) and base tag
 * names (`p`, `call-id`, `alt`, `call-type`) are still inline literals
 * in {@link NativeVoiceCallManager} and
 * {@link NativeBackgroundMessagingService}; this class adds only the
 * group-specific constants without disturbing the existing wire code.
 */
public final class NipAcGroupConstants {
    private NipAcGroupConstants() {
        // no instances
    }

    /** Tag carrying the 32-byte hex group-call id. */
    public static final String GROUP_CALL_ID_TAG = "group-call-id";

    /**
     * Tag carrying the 16-character hex anchor conversation id (the
     * id of the local group {@code Conversation} this call is anchored
     * to).
     */
    public static final String CONVERSATION_ID_TAG = "conversation-id";

    /** Tag carrying the initiator's hex pubkey. Authoritative across the call. */
    public static final String INITIATOR_TAG = "initiator";

    /**
     * Tag listing the full roster (hex pubkeys) on a group kind-25050
     * offer. Includes the initiator. Sort order is canonical
     * (lexicographic on lowercase hex).
     */
    public static final String PARTICIPANTS_TAG = "participants";

    /**
     * Tag whose value is {@link #ROLE_INVITE} on an invite-only group
     * kind-25050 offer (empty {@code content}; the recipient is the
     * designated SDP offerer for that pair).
     */
    public static final String ROLE_TAG = "role";

    /** Value of {@link #ROLE_TAG} on an invite-only group kind-25050 offer. */
    public static final String ROLE_INVITE = "invite";

    /**
     * Hard cap on the number of participants in a group voice call,
     * including the initiator. Each device holds {@code N - 1}
     * simultaneous native {@code PeerConnection}s in a full-mesh
     * topology.
     */
    public static final int GROUP_CALL_MAX_PARTICIPANTS = 4;
}
