package com.nospeak.app;

import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * Native outgoing-call ringback tone player. Phase 3 of the
 * {@code add-native-voice-calls} OpenSpec change.
 *
 * <p>Replaces the Web-Audio ringback in {@code src/lib/core/voiceCall/ringtone.ts}
 * for Android with native voice calls enabled. Plays a single 440 Hz
 * (matching the JS profile) tone for ~2 seconds every 4 seconds while
 * the call is in {@code OUTGOING_RINGING}, decoupled from the WebView
 * lifecycle. Stops cleanly on transition out of that state.
 *
 * <p>Implementation: uses {@link ToneGenerator} with the standard
 * {@code TONE_SUP_RINGTONE} supervisory tone, played for 2000ms at a
 * time, scheduled on a 4000ms cadence via a main-thread Handler.
 *
 * <p><b>Stream choice.</b> The tone is routed through
 * {@link AudioManager#STREAM_RING} (with {@link AudioManager#STREAM_VOICE_CALL}
 * as a constructed fallback for exotic ROMs that reject {@code STREAM_RING}).
 * {@code STREAM_RING} is what native dialers use for outgoing
 * ringback — it honours the user's ringer volume and matches the
 * "phone is ringing the other end" UX. Naively using
 * {@code STREAM_VOICE_CALL} collides with the concurrent WebRTC
 * {@code JavaAudioDeviceModule}: as soon as {@code attachLocalAudioTrack}
 * runs the ADM brings up its {@code AudioRecord}/{@code AudioTrack}
 * on the voice-call audio session, after which the system mixer
 * silences any {@code ToneGenerator} sharing that stream.
 *
 * <p><b>Audio-mode coordination.</b> {@code STREAM_RING} alone is
 * not enough — under {@link AudioManager#MODE_IN_COMMUNICATION} the
 * OS heavily ducks {@code STREAM_RING} (the user is "in a call",
 * the ringer should not blast). To prevent that ducking,
 * {@link VoiceCallForegroundService} deliberately stays in
 * {@link AudioManager#MODE_NORMAL} for the duration of
 * {@code OUTGOING_RINGING} and only switches to
 * {@code MODE_IN_COMMUNICATION} on the transition to
 * {@code CONNECTING}. With both pieces in place the cadence remains
 * at full volume for the entire ringing window.
 *
 * <p><b>Per-burst recreation.</b> Each burst constructs a fresh
 * {@link ToneGenerator}, plays one tone, and releases it on the next
 * burst. {@code ToneGenerator.startTone} re-issued on the same instance
 * is unreliable on some OEM platforms; recreating is cheap (sub-ms)
 * at a 4-second cadence and eliminates that class of bugs.
 *
 * <p>Lifecycle:
 * <ul>
 *   <li>{@link #start()} — begin the ring cadence. Idempotent.</li>
 *   <li>{@link #stop()} — cancel the cadence and release the
 *       {@link ToneGenerator}. Idempotent and safe to call from any
 *       state.</li>
 * </ul>
 *
 * <p>Threading: must be constructed and used from the main thread.
 */
public final class VoiceCallRingback {

    private static final String TAG = "VoiceCallRingback";

    /** Length of each tone burst in milliseconds. Matches ringtone.ts (2s). */
    private static final int TONE_DURATION_MS = 2000;
    /** Cadence in milliseconds. Matches ringtone.ts (every 4s). */
    private static final long CADENCE_MS = 4_000L;
    /** Volume 0-100. ToneGenerator's relative scale; conservative default. */
    private static final int VOLUME = 80;

    /**
     * Stream types tried in order when constructing the per-burst
     * {@link ToneGenerator}. {@code STREAM_RING} is the dialer-style
     * choice (uses ringer volume and is not pre-empted by the
     * concurrent WebRTC ADM voice-call session). {@code STREAM_VOICE_CALL}
     * is the legacy fallback for the rare ROM that refuses
     * {@code STREAM_RING}.
     */
    private static final int[] STREAM_PREFERENCES = {
        AudioManager.STREAM_RING,
        AudioManager.STREAM_VOICE_CALL,
    };

    private final Handler handler = new Handler(Looper.getMainLooper());

    /**
     * The {@link ToneGenerator} for the currently-playing burst. Null
     * outside a burst window. Held here only so {@link #stop()} can
     * cut a mid-burst tone short. Each burst constructs its own
     * instance; see class JavaDoc "Per-burst recreation".
     */
    private ToneGenerator currentBurstToneGenerator;
    private boolean running = false;

    private final Runnable burstRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            playBurst();
            handler.postDelayed(this, CADENCE_MS);
        }
    };

    /**
     * Start the ringback cadence. Plays the first burst immediately
     * and then on a 4-second cadence until {@link #stop()}.
     */
    public void start() {
        if (running) return;
        running = true;
        // Kick off the first burst immediately (matches the JS path,
        // which calls playRingbackBurst() before the interval).
        burstRunnable.run();
    }

    /**
     * Stop the ringback cadence. Cancels the next scheduled burst,
     * stops the currently-playing tone if any, and releases the
     * {@link ToneGenerator}. Idempotent.
     */
    public void stop() {
        running = false;
        handler.removeCallbacks(burstRunnable);
        releaseCurrentBurstToneGenerator();
    }

    private void playBurst() {
        // Release the prior burst's ToneGenerator before constructing a
        // new one. Defensive: in normal operation the prior burst's
        // tone has finished by the time we re-enter (TONE_DURATION_MS
        // = 2000 ≤ CADENCE_MS = 4000), but releasing first guarantees
        // we don't accumulate native handles if a burst overrun ever
        // occurs.
        releaseCurrentBurstToneGenerator();

        ToneGenerator tg = constructToneGenerator();
        if (tg == null) {
            // Construction failed on every preferred stream; ringback
            // is silently disabled for this call. Logged inside
            // constructToneGenerator(); cadence keeps ticking so the
            // next burst gets another chance (the failure is usually
            // a transient resource exhaustion).
            return;
        }
        currentBurstToneGenerator = tg;
        try {
            // TONE_SUP_RINGTONE is the standard supervisory ringback
            // tone — the same one carriers play to indicate the
            // remote phone is ringing. Recognisable to users.
            tg.startTone(ToneGenerator.TONE_SUP_RINGTONE, TONE_DURATION_MS);
        } catch (Throwable t) {
            Log.w(TAG, "startTone failed", t);
            releaseCurrentBurstToneGenerator();
        }
    }

    private ToneGenerator constructToneGenerator() {
        for (int streamType : STREAM_PREFERENCES) {
            try {
                return new ToneGenerator(streamType, VOLUME);
            } catch (RuntimeException e) {
                Log.w(TAG, "ToneGenerator(" + streamType + ") init failed; trying next", e);
            }
        }
        Log.w(TAG, "ToneGenerator init failed on all preferred streams; ringback disabled");
        return null;
    }

    private void releaseCurrentBurstToneGenerator() {
        ToneGenerator tg = currentBurstToneGenerator;
        currentBurstToneGenerator = null;
        if (tg == null) return;
        try { tg.stopTone(); } catch (Throwable ignored) {}
        try { tg.release(); } catch (Throwable ignored) {}
    }
}
