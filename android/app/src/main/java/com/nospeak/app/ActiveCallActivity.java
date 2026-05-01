package com.nospeak.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.TextView;

/**
 * Active-call screen for the native voice-call stack. Phase 2 of
 * the {@code add-native-voice-calls} OpenSpec change.
 *
 * <p>Visual surface for an in-progress voice call hosted by
 * {@link NativeVoiceCallManager} inside {@link VoiceCallForegroundService}.
 * Bound to the FGS via its {@link VoiceCallForegroundService.LocalBinder};
 * registers itself as a {@link NativeVoiceCallManager.UiListener} for
 * state, duration, and mute updates.
 *
 * <p>Lifecycle:
 * <ul>
 *   <li>{@code onStart}: bind to the FGS, register listener.</li>
 *   <li>{@code onStop}: unbind, deregister listener (so the manager
 *       doesn't hold a stale reference if the activity is destroyed
 *       before the call ends).</li>
 *   <li>{@code onStatusChanged(ENDED)}: finish the activity.</li>
 * </ul>
 *
 * <p>Lockscreen support: like {@link IncomingCallActivity}, this
 * activity sets {@code FLAG_SHOW_WHEN_LOCKED} and
 * {@code FLAG_TURN_SCREEN_ON} so a call accepted from the lockscreen
 * can render its in-progress UI without requiring an explicit unlock.
 */
public class ActiveCallActivity extends Activity {

    private static final String TAG = "ActiveCallActivity";

    public static final String EXTRA_CALL_ID = "call_id";
    public static final String EXTRA_PEER_NAME = "peer_name";

    private TextView statusView;
    private TextView nameView;
    private TextView durationView;
    private ImageButton muteButton;
    private ImageButton hangupButton;
    private ImageButton speakerButton;

    private boolean speakerOn = false;
    private boolean muted = false;

    private VoiceCallForegroundService boundService;
    private boolean bound = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final NativeVoiceCallManager.UiListener uiListener =
        new NativeVoiceCallManager.UiListener() {
            @Override
            public void onStatusChanged(NativeVoiceCallManager.CallStatus status, String reason) {
                mainHandler.post(() -> applyStatus(status, reason));
            }

            @Override
            public void onDurationTick(int seconds) {
                mainHandler.post(() -> updateDuration(seconds));
            }

            @Override
            public void onMuteChanged(boolean newMuted) {
                mainHandler.post(() -> applyMute(newMuted));
            }
        };

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            VoiceCallForegroundService.LocalBinder binder =
                (VoiceCallForegroundService.LocalBinder) service;
            boundService = binder.getService();
            bound = true;
            NativeVoiceCallManager mgr = boundService != null
                ? VoiceCallForegroundService.getNativeManager()
                : null;
            Log.d(TAG, "onServiceConnected: mgr=" + (mgr != null)
                + " status=" + (mgr != null ? mgr.getStatus() : "<null>"));
            if (mgr == null) {
                Log.w(TAG, "onServiceConnected: no native manager — finishing");
                finishAndRemoveTask();
                return;
            }
            // Defensive: if the manager has already ENDED before our bind
            // (e.g. mic capture threw, peer rejected immediately, ICE
            // failed during accept setup), don't paint the ended-state
            // text + 1.5s flicker. Just close. The user never saw the
            // active surface, so showing "Call ended" briefly here is
            // pure noise.
            NativeVoiceCallManager.CallStatus s = mgr.getStatus();
            if (s == NativeVoiceCallManager.CallStatus.ENDED
                || s == NativeVoiceCallManager.CallStatus.IDLE) {
                Log.w(TAG, "onServiceConnected: manager already in " + s
                    + " — finishing without showing UI");
                finishAndRemoveTask();
                return;
            }
            mgr.setUiListener(uiListener);
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            // Service died unexpectedly. Without a manager there's
            // nothing to render; close the activity so the user
            // doesn't sit on a dead screen.
            bound = false;
            boundService = null;
            mainHandler.post(() -> finishAndRemoveTask());
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();
        Log.d(TAG, "onCreate intent=" + (intent != null ? intent.getAction() : "<null>")
            + " callId=" + (intent != null ? intent.getStringExtra(EXTRA_CALL_ID) : "<null>"));
        applyShowWhenLockedFlags();
        setContentView(R.layout.activity_active_call);

        statusView = findViewById(R.id.active_call_status);
        nameView = findViewById(R.id.active_call_name);
        durationView = findViewById(R.id.active_call_duration);
        muteButton = findViewById(R.id.active_call_mute);
        hangupButton = findViewById(R.id.active_call_hangup);
        speakerButton = findViewById(R.id.active_call_speaker);

        readExtras(intent);
        wireButtons();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readExtras(intent);
    }

    @Override
    protected void onStart() {
        super.onStart();
        Log.d(TAG, "onStart bound=" + bound);
        Intent svc = new Intent(this, VoiceCallForegroundService.class);
        try {
            bindService(svc, serviceConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            Log.w(TAG, "bindService failed — finishing", e);
            finishAndRemoveTask();
        }
    }

    @Override
    protected void onStop() {
        if (bound) {
            try {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr != null) mgr.setUiListener(null);
            } catch (Throwable ignored) {}
            try { unbindService(serviceConnection); } catch (Exception ignored) {}
            bound = false;
            boundService = null;
        }
        super.onStop();
    }

    // --- helpers -------------------------------------------------------

    @SuppressWarnings("deprecation")
    private void applyShowWhenLockedFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private void readExtras(Intent intent) {
        if (intent == null) return;
        String peerName = intent.getStringExtra(EXTRA_PEER_NAME);
        if (peerName != null && nameView != null) {
            nameView.setText(peerName);
        }
    }

    private void wireButtons() {
        if (muteButton != null) {
            muteButton.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                    if (mgr == null) return;
                    boolean next = !muted;
                    mgr.setMuted(next);
                }
            });
        }
        if (hangupButton != null) {
            hangupButton.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                    if (mgr != null) mgr.hangup();
                }
            });
        }
        if (speakerButton != null) {
            speakerButton.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                    if (mgr == null) return;
                    speakerOn = !speakerOn;
                    mgr.setSpeakerOn(speakerOn);
                    applySpeakerVisual();
                }
            });
        }
    }

    private void applyStatus(NativeVoiceCallManager.CallStatus status, String reason) {
        if (status == null) return;
        Log.d(TAG, "applyStatus: " + status + " reason=" + reason);
        switch (status) {
            case OUTGOING_RINGING:
                if (statusView != null) statusView.setText("Calling…");
                break;
            case INCOMING_RINGING:
                if (statusView != null) statusView.setText("Incoming call");
                break;
            case CONNECTING:
                if (statusView != null) statusView.setText("Connecting…");
                break;
            case ACTIVE:
                if (statusView != null) statusView.setText("Active");
                break;
            case ENDED:
                if (statusView != null) statusView.setText(endReasonText(reason));
                // Defer finishing slightly so the user briefly sees the
                // ended state, matching the JS overlay's CALL_END_DISPLAY_MS.
                mainHandler.postDelayed(this::finishAndRemoveTask, 1500L);
                break;
            case IDLE:
            default:
                break;
        }
    }

    private void updateDuration(int seconds) {
        if (durationView == null) return;
        int m = seconds / 60;
        int s = seconds % 60;
        durationView.setText(String.format("%d:%02d", m, s));
    }

    private void applyMute(boolean newMuted) {
        muted = newMuted;
        if (muteButton == null) return;
        // Visual feedback: tint changes via alpha. The full ic_mic
        // glyph stays — Phase 2 keeps the button visually identical to
        // its base state but lowers opacity when active to indicate
        // muting. A future polish pass can swap to a mic-off vector.
        muteButton.setAlpha(newMuted ? 1.0f : 0.7f);
    }

    private void applySpeakerVisual() {
        if (speakerButton == null) return;
        speakerButton.setAlpha(speakerOn ? 1.0f : 0.7f);
    }

    private String endReasonText(String reason) {
        if (reason == null) return "Call ended";
        switch (reason) {
            case "hangup":     return "Call ended";
            case "rejected":   return "Call declined";
            case "busy":       return "Busy";
            case "timeout":    return "No answer";
            case "ice-failed": return "Connection lost";
            case "error":      return "Call error";
            case "answered-elsewhere": return "Answered elsewhere";
            case "rejected-elsewhere": return "Declined elsewhere";
            default:           return "Call ended";
        }
    }
}
