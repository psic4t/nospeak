package com.nospeak.app;

/**
 * Pure-Java decision policy for the in-call proximity wake lock.
 *
 * <p>Android exposes {@code PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK}
 * for in-call proximity behavior: while held, the system turns the
 * screen off when the proximity sensor reports {@code near} (the user
 * has the phone to their ear) and turns it back on when {@code far}.
 * This both saves battery and prevents accidental cheek-presses on
 * the in-call controls.
 *
 * <p>The lock is appropriate for <em>voice</em> calls only — video
 * calls require the screen to remain on so the user can see the
 * remote video. We must therefore re-evaluate the desired state
 * whenever {@link NativeVoiceCallManager.CallStatus} or
 * {@link NativeVoiceCallManager.CallKind} changes (the latter being
 * possible mid-call via the kind-25055 voice→video upgrade).
 *
 * <p>This class encapsulates the decision so it can be unit-tested
 * without instantiating {@link VoiceCallForegroundService} or any
 * Android framework machinery — same precedent as
 * {@link NativeBusyRejectDecision} and {@link NativeSelfDismissDecision}.
 *
 * <p><strong>Lifecycle table:</strong>
 * <table>
 *   <tr><th>status</th><th>kind</th><th>shouldHold</th></tr>
 *   <tr><td>IDLE/ENDED</td><td>any</td><td>false</td></tr>
 *   <tr><td>ringing/connecting/active</td><td>VOICE</td><td>true</td></tr>
 *   <tr><td>ringing/connecting/active</td><td>VIDEO</td><td>false</td></tr>
 * </table>
 *
 * <p>Implementation note: incoming-ringing also returns {@code true}
 * for voice calls. The lockscreen ringer (IncomingCallActivity)
 * doesn't currently rely on proximity behavior, but holding the lock
 * is harmless — the activity's own {@code FLAG_KEEP_SCREEN_ON} +
 * {@code TURN_SCREEN_ON} take priority over a proximity-off request.
 * The simpler "voice-call ⇒ hold" rule keeps the policy a pure
 * function of (status, kind) without requiring callers to plumb
 * extra "is the lockscreen ringer up" context.
 */
public final class ProximityLockPolicy {

    private ProximityLockPolicy() {}

    /**
     * Decide whether the proximity wake lock should be held given the
     * current call state.
     *
     * @param status current {@link NativeVoiceCallManager.CallStatus},
     *               or {@code null} if no manager exists yet (treated
     *               as IDLE).
     * @param kind   current {@link NativeVoiceCallManager.CallKind},
     *               or {@code null} if unknown (defaults to VOICE).
     * @return {@code true} iff the FGS should currently hold the
     *         proximity wake lock.
     */
    public static boolean shouldHold(
            NativeVoiceCallManager.CallStatus status,
            NativeVoiceCallManager.CallKind kind) {
        if (status == null) return false;
        switch (status) {
            case IDLE:
            case ENDED:
                return false;
            case INCOMING_RINGING:
            case OUTGOING_RINGING:
            case CONNECTING:
            case ACTIVE:
                // Proximity-screen-off is voice-only. Video calls
                // require the screen to remain on for the user to see
                // the remote video.
                NativeVoiceCallManager.CallKind k =
                    kind != null ? kind : NativeVoiceCallManager.CallKind.VOICE;
                return k == NativeVoiceCallManager.CallKind.VOICE;
            default:
                return false;
        }
    }
}
