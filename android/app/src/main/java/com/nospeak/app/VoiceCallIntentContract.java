package com.nospeak.app;

/**
 * Shared intent / broadcast / SharedPreferences string constants for the
 * native voice-call stack.
 *
 * <p>Phase 0 plumbing for the {@code add-native-voice-calls} OpenSpec
 * change. Defining these in one place keeps the contract documented and
 * lets the JS bridge (via the AndroidVoiceCall plugin) and the Java
 * services (FGS, IncomingCallActivity, NativeVoiceCallManager) agree on
 * names without typos.
 *
 * <p>None of these constants are exposed to JavaScript directly; the
 * plugin layer wraps them with method names like
 * {@code notifyUnlockComplete}.
 */
public final class VoiceCallIntentContract {

    /**
     * Local broadcast emitted by the JavaScript unlock flow (via the
     * plugin) once the user has successfully entered their PIN to
     * unlock a previously-locked nsec while a call accept is pending.
     * Carries {@link #EXTRA_CALL_ID} matching the persisted pending
     * accept. {@link NativeVoiceCallManager} listens for this broadcast
     * and resumes the accept flow when it arrives.
     */
    public static final String ACTION_UNLOCK_COMPLETE = "nospeak.ACTION_UNLOCK_COMPLETE";

    /**
     * Intent extra carrying a callId passed from the native call manager
     * to MainActivity to request that the JavaScript unlock screen be
     * shown for an in-progress call accept. The unlock screen reads
     * this extra and, on success, broadcasts {@link #ACTION_UNLOCK_COMPLETE}
     * with the same callId.
     */
    public static final String EXTRA_UNLOCK_FOR_CALL = "EXTRA_UNLOCK_FOR_CALL";

    /**
     * Intent extra carrying a callId. Used by ACTION_INITIATE,
     * ACTION_ACCEPT, ACTION_HANGUP intents on the foreground service,
     * and by ACTION_UNLOCK_COMPLETE broadcasts.
     */
    public static final String EXTRA_CALL_ID = "call_id";

    /**
     * VoiceCallForegroundService intent action: start a native outgoing
     * call. The intent SHALL also carry {@link #EXTRA_CALL_ID} and a
     * recipient pubkey hex extra.
     */
    public static final String ACTION_INITIATE = "nospeak.voicecall.ACTION_INITIATE";

    /**
     * VoiceCallForegroundService intent action: accept the currently
     * pending incoming call. Reads the offer SDP from the
     * {@code nospeak_pending_incoming_call} SharedPreferences slot.
     */
    public static final String ACTION_ACCEPT = "nospeak.voicecall.ACTION_ACCEPT";

    /**
     * VoiceCallForegroundService intent action: hang up the active call.
     */
    public static final String ACTION_HANGUP = "nospeak.voicecall.ACTION_HANGUP";

    /**
     * SharedPreferences key (within {@code nospeak_voice_call_prefs}) for
     * the pending unlock-for-call payload: callId + offer reference.
     * Cleared on successful resume or on 30s timeout.
     */
    public static final String PREF_PENDING_CALL_UNLOCK = "nospeak_pending_call_unlock";

    /**
     * SharedPreferences key for the queue of pending callHistoryWriteRequested
     * events that fired while the WebView was not bound. Replayed when
     * VoiceCallServiceNative initializes.
     */
    public static final String PREF_PENDING_CALL_HISTORY_WRITES = "nospeak_pending_call_history_writes";

    /**
     * Top-level SharedPreferences file used by the native voice-call
     * stack for transient state (pending unlock, pending history writes).
     * The pending-incoming-call slot lives in its own legacy file
     * ({@code nospeak_pending_incoming_call}) for back-compat.
     */
    public static final String PREFS_FILE = "nospeak_voice_call_prefs";

    /**
     * 30-second deadline for the user to unlock a PIN-locked nsec while
     * a call accept is pending. After this window the native call
     * manager sends a reject + missed-call history event and aborts.
     */
    public static final long UNLOCK_TIMEOUT_MS = 30_000L;

    private VoiceCallIntentContract() {
        // utility class — no instances
    }
}
