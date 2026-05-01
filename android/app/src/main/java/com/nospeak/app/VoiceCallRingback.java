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
 * time, scheduled on a 4000ms cadence via a main-thread Handler. The
 * {@code STREAM_VOICE_CALL} stream routes the tone through the same
 * audio path the eventual peer audio will use, which is desirable
 * once the call connects (no jarring stream switch).
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
    private static final int VOLUME = 50;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private ToneGenerator toneGenerator;
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
        try {
            // STREAM_VOICE_CALL ensures the tone is routed through the
            // call audio path (earpiece by default, speakerphone if
            // enabled) — exactly where the live audio will arrive
            // moments later.
            toneGenerator = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, VOLUME);
        } catch (RuntimeException e) {
            Log.w(TAG, "ToneGenerator init failed; ringback disabled", e);
            toneGenerator = null;
            return;
        }
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
        ToneGenerator tg = toneGenerator;
        toneGenerator = null;
        if (tg != null) {
            try { tg.stopTone(); } catch (Throwable ignored) {}
            try { tg.release(); } catch (Throwable ignored) {}
        }
    }

    private void playBurst() {
        ToneGenerator tg = toneGenerator;
        if (tg == null) return;
        try {
            // TONE_SUP_RINGTONE is the standard supervisory ringback
            // tone — the same one carriers play to indicate the
            // remote phone is ringing. Recognisable to users.
            tg.startTone(ToneGenerator.TONE_SUP_RINGTONE, TONE_DURATION_MS);
        } catch (Throwable t) {
            Log.w(TAG, "startTone failed", t);
        }
    }
}
