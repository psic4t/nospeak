package com.nospeak.app;

import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Unit tests for the listener-emission contract on
 * {@link NativeVoiceCallManager}. Covers the package-private
 * {@code notifyMuteChanged} / {@code notifySpeakerChanged} helpers
 * and the {@link NativeVoiceCallManager.UiListener#onSpeakerChanged}
 * default-method back-compat path.
 *
 * <p>Why this surface: the {@link NativeVoiceCallManager#setMuted}
 * and {@link NativeVoiceCallManager#setSpeakerOn} entry points
 * require {@link android.os.Looper#getMainLooper()} (via
 * {@code ensureMain}) and a real WebRTC stack to fully exercise.
 * The interesting wiring — "the right listener gets called with the
 * right value, a null listener is safe" — is identical between the
 * mute and speaker paths and lives in the static helpers extracted
 * from those methods. Those helpers are pure Java and unit-testable
 * directly without Robolectric or instrumentation.
 *
 * <p>The catch / Log.w error path is deliberately not exercised
 * here: {@code android.util.Log} would throw
 * "Method w not mocked" without project-wide
 * {@code testOptions { unitTests.returnDefaultValues = true }} and
 * the catch behavior is structurally identical to the
 * {@code onMuteChanged} catch that has shipped since Phase 2 — so
 * this test set focuses on the new wiring (speaker mirror + default
 * method) instead of re-verifying existing safety.
 */
public class NativeVoiceCallManagerListenerTest {

    /** Records every callback for later assertion. */
    private static final class RecordingListener
            implements NativeVoiceCallManager.UiListener {
        final List<NativeVoiceCallManager.CallStatus> statuses = new ArrayList<>();
        final List<Integer> ticks = new ArrayList<>();
        final List<Boolean> mutes = new ArrayList<>();
        final List<Boolean> speakers = new ArrayList<>();
        final List<NativeVoiceCallManager.RenegotiationState> renegotiations =
            new ArrayList<>();

        @Override public void onStatusChanged(
                NativeVoiceCallManager.CallStatus status, String reason) {
            statuses.add(status);
        }
        @Override public void onDurationTick(int seconds) { ticks.add(seconds); }
        @Override public void onMuteChanged(boolean muted) { mutes.add(muted); }
        @Override public void onSpeakerChanged(boolean speakerOn) {
            speakers.add(speakerOn);
        }
        @Override public void onRenegotiationStateChanged(
                NativeVoiceCallManager.RenegotiationState state) {
            renegotiations.add(state);
        }
    }

    /**
     * A listener that intentionally omits {@code onSpeakerChanged} to
     * verify the {@link NativeVoiceCallManager.UiListener} default
     * method does not require existing implementations to override.
     */
    private static final class LegacyListener
            implements NativeVoiceCallManager.UiListener {
        boolean muteFired = false;

        @Override public void onStatusChanged(
                NativeVoiceCallManager.CallStatus status, String reason) {}
        @Override public void onDurationTick(int seconds) {}
        @Override public void onMuteChanged(boolean muted) { muteFired = true; }
        // onSpeakerChanged deliberately not overridden.
    }

    @Test
    public void notifyMuteChanged_dispatchesTrueToNonNullListener() {
        RecordingListener listener = new RecordingListener();
        NativeVoiceCallManager.notifyMuteChanged(listener, true, "test");
        assertEquals(1, listener.mutes.size());
        assertTrue(listener.mutes.get(0));
    }

    @Test
    public void notifyMuteChanged_dispatchesFalseToNonNullListener() {
        RecordingListener listener = new RecordingListener();
        NativeVoiceCallManager.notifyMuteChanged(listener, false, "test");
        assertEquals(1, listener.mutes.size());
        assertFalse(listener.mutes.get(0));
    }

    @Test
    public void notifyMuteChanged_isNoOpWhenListenerNull() {
        // Must not throw. Production callers (setMuted) pass uiListener
        // and serviceListener which can both be null at any point in a
        // call's lifecycle.
        NativeVoiceCallManager.notifyMuteChanged(null, true, "test");
        NativeVoiceCallManager.notifyMuteChanged(null, false, "test");
    }

    @Test
    public void notifySpeakerChanged_dispatchesTrueToNonNullListener() {
        RecordingListener listener = new RecordingListener();
        NativeVoiceCallManager.notifySpeakerChanged(listener, true, "test");
        assertEquals(1, listener.speakers.size());
        assertTrue(listener.speakers.get(0));
    }

    @Test
    public void notifySpeakerChanged_dispatchesFalseToNonNullListener() {
        RecordingListener listener = new RecordingListener();
        NativeVoiceCallManager.notifySpeakerChanged(listener, false, "test");
        assertEquals(1, listener.speakers.size());
        assertFalse(listener.speakers.get(0));
    }

    @Test
    public void notifySpeakerChanged_isNoOpWhenListenerNull() {
        NativeVoiceCallManager.notifySpeakerChanged(null, true, "test");
        NativeVoiceCallManager.notifySpeakerChanged(null, false, "test");
    }

    @Test
    public void notifySpeakerChanged_separateCallsAccumulate() {
        // Mirrors how setSpeakerOn re-emits to the listener even when
        // the value matches the prior state — keeps ActiveCallActivity
        // visually in sync if its cached state ever drifts.
        RecordingListener listener = new RecordingListener();
        NativeVoiceCallManager.notifySpeakerChanged(listener, true, "test");
        NativeVoiceCallManager.notifySpeakerChanged(listener, true, "test");
        NativeVoiceCallManager.notifySpeakerChanged(listener, false, "test");
        assertEquals(3, listener.speakers.size());
        assertTrue(listener.speakers.get(0));
        assertTrue(listener.speakers.get(1));
        assertFalse(listener.speakers.get(2));
    }

    @Test
    public void uiListener_onSpeakerChangedDefaultIsNoOp() {
        // Back-compat: a UiListener that only overrides the methods
        // that existed before this change must still compile and run
        // without overriding onSpeakerChanged. The default method is
        // a no-op; calling it through the helper must not throw.
        LegacyListener legacy = new LegacyListener();
        NativeVoiceCallManager.notifySpeakerChanged(legacy, true, "test");
        NativeVoiceCallManager.notifySpeakerChanged(legacy, false, "test");
        // And the existing onMuteChanged path still works on the
        // legacy listener — guards against accidentally regressing
        // the interface during the speaker addition.
        NativeVoiceCallManager.notifyMuteChanged(legacy, true, "test");
        assertTrue(legacy.muteFired);
    }

    @Test
    public void notifyRenegotiationStateChanged_dispatchesToNonNullListener() {
        RecordingListener listener = new RecordingListener();
        NativeVoiceCallManager.notifyRenegotiationStateChanged(
            listener, NativeVoiceCallManager.RenegotiationState.OUTGOING, "test");
        NativeVoiceCallManager.notifyRenegotiationStateChanged(
            listener, NativeVoiceCallManager.RenegotiationState.IDLE, "test");
        assertEquals(2, listener.renegotiations.size());
        assertEquals(
            NativeVoiceCallManager.RenegotiationState.OUTGOING,
            listener.renegotiations.get(0));
        assertEquals(
            NativeVoiceCallManager.RenegotiationState.IDLE,
            listener.renegotiations.get(1));
    }

    @Test
    public void notifyRenegotiationStateChanged_isNoOpWhenListenerNull() {
        NativeVoiceCallManager.notifyRenegotiationStateChanged(
            null, NativeVoiceCallManager.RenegotiationState.OUTGOING, "test");
    }

    @Test
    public void uiListener_onRenegotiationStateChangedDefaultIsNoOp() {
        // Same back-compat contract as onSpeakerChanged: a listener
        // that pre-dates the renegotiation listener method must still
        // compile and run without overriding it.
        LegacyListener legacy = new LegacyListener();
        NativeVoiceCallManager.notifyRenegotiationStateChanged(
            legacy, NativeVoiceCallManager.RenegotiationState.OUTGOING, "test");
        NativeVoiceCallManager.notifyRenegotiationStateChanged(
            legacy, NativeVoiceCallManager.RenegotiationState.IDLE, "test");
    }
}
