package com.nospeak.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

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
    /**
     * Optional path to a cached profile-picture PNG for the peer. When
     * set, {@link CallAvatarLoader} renders it as a circular drawable in
     * {@link #avatarView}. When null/missing, the loader falls back to a
     * deterministic identicon derived from {@link #EXTRA_PEER_HEX}.
     */
    public static final String EXTRA_AVATAR_PATH = "avatar_path";
    /**
     * Peer pubkey hex. Used as the identicon-fallback seed when no
     * cached profile picture is available. Always populated by the FGS
     * launch sites; only absent on direct/legacy launches.
     */
    public static final String EXTRA_PEER_HEX = "peer_hex";

    private TextView statusView;
    private TextView nameView;
    private TextView durationView;
    private ImageView avatarView;
    private ImageButton muteButton;
    private ImageButton hangupButton;
    private ImageButton speakerButton;

    private String avatarPath;
    private String peerHex;

    /**
     * Last-known mute and speaker states. The manager
     * ({@link NativeVoiceCallManager}) is the source of truth; these
     * fields cache the most recent listener callback so click handlers
     * can compute "the opposite of the current state" without polling
     * the manager from the UI thread.
     */
    private boolean muted = false;
    private boolean speakerOn = false;

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

            @Override
            public void onSpeakerChanged(boolean newSpeakerOn) {
                mainHandler.post(() -> applySpeaker(newSpeakerOn));
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
        avatarView = findViewById(R.id.active_call_avatar);
        muteButton = findViewById(R.id.active_call_mute);
        hangupButton = findViewById(R.id.active_call_hangup);
        speakerButton = findViewById(R.id.active_call_speaker);

        readExtras(intent);
        bindAvatar();
        wireButtons();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readExtras(intent);
        // A second call replacing the first lands here. Re-bind the
        // avatar so the new peer's picture (or identicon) shows.
        bindAvatar();
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
        avatarPath = intent.getStringExtra(EXTRA_AVATAR_PATH);
        peerHex = intent.getStringExtra(EXTRA_PEER_HEX);
    }

    /**
     * Resolve and apply the peer avatar. Cached profile picture wins;
     * identicon (derived from {@link #peerHex}) is used as a fallback so
     * picture-less peers don't get a generic placeholder. Mirrors the
     * behavior of the heads-up CallStyle notification's caller icon.
     */
    private void bindAvatar() {
        if (avatarView == null) return;
        Drawable d = CallAvatarLoader.loadCircular(
            this, avatarPath, peerHex, /*targetPx*/ 192);
        if (d != null) {
            avatarView.setImageDrawable(d);
        }
        // else: leave the layout's @drawable/ic_call_avatar_placeholder
        // in place. Only happens when peerHex is absent and no cached
        // file path was passed (e.g. legacy launch path without extras).
    }

    private void wireButtons() {
        if (muteButton != null) {
            muteButton.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                    if (mgr == null) return;
                    // Ask the manager for the current state instead of
                    // reading the local cache so back-to-back taps
                    // before the listener fires can't double-toggle.
                    mgr.setMuted(!mgr.isMuted());
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
                    // The visual update happens via the manager's
                    // onSpeakerChanged callback, mirroring the mute
                    // path. Keeps the activity's view state strictly
                    // a function of the manager's authoritative state.
                    mgr.setSpeakerOn(!mgr.isSpeakerOn());
                }
            });
        }
        // Initial paint with the off-state visual so the buttons render
        // correctly before the manager's pushInitialState callback
        // arrives (which happens after onServiceConnected / setUiListener).
        applyMute(false);
        applySpeaker(false);
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
        // Swap the glyph too: mic when unmuted, mic-with-strikethrough
        // when muted, so the engaged state is unambiguous beyond just
        // the background-inversion.
        applyToggleVisual(
            muteButton,
            newMuted,
            R.drawable.ic_mic,
            R.drawable.ic_mic_off);
    }

    private void applySpeaker(boolean newSpeakerOn) {
        speakerOn = newSpeakerOn;
        // Speaker uses the same glyph in both states; the background
        // inversion alone communicates the toggle.
        applyToggleVisual(
            speakerButton,
            newSpeakerOn,
            R.drawable.ic_speaker,
            R.drawable.ic_speaker);
    }

    /**
     * Apply the inverted-active visual to a binary call-control button.
     * On state: opaque white background + dark icon (and optionally a
     * different glyph, e.g. mic_off). Off state: the existing
     * translucent-white circle + white icon. This replaces the prior
     * alpha-only feedback (which was inverted and too subtle to read),
     * matching the Google Phone / Signal convention for binary call
     * controls.
     */
    private void applyToggleVisual(
            ImageButton button,
            boolean active,
            int offGlyphRes,
            int onGlyphRes) {
        if (button == null) return;
        button.setAlpha(1.0f);
        button.setImageResource(active ? onGlyphRes : offGlyphRes);
        if (active) {
            button.setBackgroundResource(
                R.drawable.bg_active_call_button_secondary_active);
            // Dark glyph against the bright background. Hard-coded
            // near-black instead of pulling a theme color so the
            // contrast is identical regardless of the device's day /
            // night setting (the call surface is always dark).
            button.setColorFilter(Color.parseColor("#1F1F1F"),
                PorterDuff.Mode.SRC_IN);
        } else {
            button.setBackgroundResource(R.drawable.bg_active_call_button_secondary);
            button.setColorFilter(
                ContextCompat.getColor(this, R.color.incoming_call_text),
                PorterDuff.Mode.SRC_IN);
        }
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
