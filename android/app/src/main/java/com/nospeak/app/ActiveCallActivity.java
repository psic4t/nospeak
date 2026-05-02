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
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.webrtc.EglBase;
import org.webrtc.RendererCommon;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoTrack;

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
    /**
     * Either {@code "voice"} or {@code "video"}; defaults to
     * {@code "voice"} when absent. Drives the visibility of the video
     * renderers and camera controls in the active-call layout.
     */
    public static final String EXTRA_CALL_KIND = "call_kind";

    private TextView statusView;
    private TextView nameView;
    private TextView durationView;
    private ImageView avatarView;
    private ImageButton muteButton;
    private ImageButton hangupButton;
    private ImageButton speakerButton;
    private ImageButton cameraOffButton;
    private ImageButton cameraFlipButton;
    /** Video-chrome buttons (live in active_call_video_controls). */
    private ImageButton muteButtonVideo;
    private ImageButton hangupButtonVideo;
    private ImageButton speakerButtonVideo;
    private ImageButton cameraOffButtonVideo;
    private ImageButton cameraFlipButtonVideo;
    /** Video-chrome text views (live in active_call_video_header). */
    private TextView statusViewVideo;
    private TextView nameViewVideo;
    private TextView durationViewVideo;
    private SurfaceViewRenderer remoteVideoRenderer;
    private SurfaceViewRenderer localVideoRenderer;
    private View rootLayout;
    private View videoHeader;
    private View videoControls;
    private View overlayLayout;
    /**
     * Default top margin for the local self-view PiP (matches the
     * fallback in activity_active_call.xml). The actual margin is
     * recomputed when system-bar / display-cutout insets arrive so the
     * PiP clears the status bar and any camera cutout.
     */
    private static final int LOCAL_PIP_DEFAULT_TOP_MARGIN_DP = 48;
    private static final int LOCAL_PIP_INSET_GAP_DP = 16;

    private String avatarPath;
    private String peerHex;
    private boolean isVideoCall = false;
    /** Set after we successfully {@code init}'d the local + remote renderers. */
    private boolean renderersInitialized = false;

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

            @Override
            public void onLocalVideoTrack(VideoTrack track) {
                mainHandler.post(() -> attachLocalVideoSink(track));
            }

            @Override
            public void onRemoteVideoTrack(VideoTrack track) {
                mainHandler.post(() -> attachRemoteVideoSink(track));
            }

            @Override
            public void onCameraStateChanged(boolean cameraOff) {
                mainHandler.post(() -> applyCameraOff(cameraOff));
            }

            @Override
            public void onFacingModeChanged(boolean isFront) {
                mainHandler.post(() -> applyFacing(isFront));
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
            // Initialize the SurfaceViewRenderers against the manager's
            // EglBase before registering the listener — the listener may
            // synchronously fire onLocalVideoTrack via pushInitialState
            // and we want the renderers ready to addSink. Safe no-op for
            // voice calls (rootEglBase is null).
            if (isVideoCall) {
                initRenderersIfNeeded(mgr);
                // Attach any tracks that already exist (e.g. activity
                // bound after attachLocalVideoTrack ran).
                attachLocalVideoSink(mgr.getLocalVideoTrack());
                attachRemoteVideoSink(mgr.getRemoteVideoTrack());
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
        applyEdgeToEdge();
        setContentView(R.layout.activity_active_call);

        statusView = findViewById(R.id.active_call_status);
        nameView = findViewById(R.id.active_call_name);
        durationView = findViewById(R.id.active_call_duration);
        avatarView = findViewById(R.id.active_call_avatar);
        muteButton = findViewById(R.id.active_call_mute);
        hangupButton = findViewById(R.id.active_call_hangup);
        speakerButton = findViewById(R.id.active_call_speaker);
        cameraOffButton = findViewById(R.id.active_call_camera_off);
        cameraFlipButton = findViewById(R.id.active_call_camera_flip);
        muteButtonVideo = findViewById(R.id.active_call_mute_video);
        hangupButtonVideo = findViewById(R.id.active_call_hangup_video);
        speakerButtonVideo = findViewById(R.id.active_call_speaker_video);
        cameraOffButtonVideo = findViewById(R.id.active_call_camera_off_video);
        cameraFlipButtonVideo = findViewById(R.id.active_call_camera_flip_video);
        statusViewVideo = findViewById(R.id.active_call_video_status);
        nameViewVideo = findViewById(R.id.active_call_video_name);
        durationViewVideo = findViewById(R.id.active_call_video_duration);
        remoteVideoRenderer = findViewById(R.id.active_call_remote_video);
        localVideoRenderer = findViewById(R.id.active_call_local_video);
        rootLayout = findViewById(R.id.active_call_root);
        videoHeader = findViewById(R.id.active_call_video_header);
        videoControls = findViewById(R.id.active_call_video_controls);
        overlayLayout = findViewById(R.id.active_call_overlay);

        installWindowInsetsListener();
        readExtras(intent);
        applyKindVisibility();
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

    @Override
    protected void onDestroy() {
        // Release the renderers but DO NOT release the EglBase — the
        // manager owns its lifecycle (released in NativeVoiceCallManager
        // .dispose()). Releasing here would crash the manager's
        // encoder/decoder if a new call started immediately after.
        try {
            if (localVideoRenderer != null) localVideoRenderer.release();
        } catch (Throwable ignored) {}
        try {
            if (remoteVideoRenderer != null) remoteVideoRenderer.release();
        } catch (Throwable ignored) {}
        renderersInitialized = false;
        super.onDestroy();
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
        if (peerName != null) {
            if (nameView != null) nameView.setText(peerName);
            // Mirror the peer name into the video-mode header so the
            // active video chrome shows the same identity as the
            // voice-mode centered layout.
            if (nameViewVideo != null) nameViewVideo.setText(peerName);
        }
        avatarPath = intent.getStringExtra(EXTRA_AVATAR_PATH);
        peerHex = intent.getStringExtra(EXTRA_PEER_HEX);
        String kindStr = intent.getStringExtra(EXTRA_CALL_KIND);
        isVideoCall = "video".equals(kindStr);
    }

    /**
     * Toggle visibility of mode-specific views based on
     * {@link #isVideoCall}, and crucially clear the FrameLayout root's
     * opaque background drawable on video so the underlay
     * SurfaceView (the remote renderer) shows through. Without this
     * the system's hole-punch composition keeps the camera frames
     * hidden behind the activity's solid colour fill — the user sees
     * nothing even though frames are arriving.
     *
     * <p>On video calls the remote renderer is full-screen (edge-to-
     * edge, behind the transparent system bars) and the call chrome
     * lives in two scrim-backed containers — {@code video_header} at
     * the top (status / name / duration) and {@code video_controls}
     * at the bottom (5-button row). The centered voice-style overlay
     * is hidden so it doesn't occlude the camera frame. On voice
     * calls the existing centered layout (avatar + name + status +
     * duration + controls) is shown and the video chrome is hidden.
     */
    private void applyKindVisibility() {
        int videoVis = isVideoCall ? View.VISIBLE : View.GONE;
        int voiceVis = isVideoCall ? View.GONE : View.VISIBLE;
        if (remoteVideoRenderer != null) remoteVideoRenderer.setVisibility(videoVis);
        if (localVideoRenderer != null) localVideoRenderer.setVisibility(videoVis);
        if (videoHeader != null) videoHeader.setVisibility(videoVis);
        if (videoControls != null) videoControls.setVisibility(videoVis);
        // The centered overlay is the entire voice-call surface
        // (avatar + name + status + duration + control row). On video
        // calls hide it wholesale so the camera frame is unobstructed.
        if (overlayLayout != null) overlayLayout.setVisibility(voiceVis);
        // Voice-mode camera buttons live inside active_call_overlay
        // and are gone for voice calls. They remain gone in video
        // mode too — the visible video controls live in
        // active_call_video_controls. Belt-and-braces:
        if (cameraOffButton != null) cameraOffButton.setVisibility(View.GONE);
        if (cameraFlipButton != null) cameraFlipButton.setVisibility(View.GONE);
        // Avatar lives inside the voice overlay; explicit null guard
        // is no longer strictly necessary (overlay visibility already
        // controls it) but kept for clarity.
        if (avatarView != null) {
            avatarView.setVisibility(isVideoCall ? View.GONE : View.VISIBLE);
        }
        // Clear / restore the activity background. SurfaceView lives in
        // the underlay window; an opaque foreground (root) background
        // keeps the underlay from being composited into the user-visible
        // result. We restore the bg_incoming_call drawable for voice
        // calls so the existing visual is preserved.
        if (rootLayout != null) {
            if (isVideoCall) {
                rootLayout.setBackground(null);
            } else {
                rootLayout.setBackgroundResource(R.drawable.bg_incoming_call);
            }
        }
    }

    /**
     * Switch the activity to edge-to-edge layout so the remote video
     * renderer (which is {@code match_parent}) extends behind the
     * status and navigation bars. Bars themselves remain visible —
     * we don't enter immersive mode for calls — but their colors are
     * forced to transparent so the camera frame shows through.
     *
     * <p>System-bar icon contrast is set to light-on-dark since the
     * call surface is always rendered against a dark scrim or dark
     * camera frame. The status-bar / cutout / nav-bar insets are
     * applied to the video header, video controls, voice overlay
     * and local self-view PiP via {@link #installWindowInsetsListener()}.
     */
    private void applyEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        // Hint the system that we draw our own protection (scrims) so
        // gesture-nav contrast scrim isn't doubled on top of ours.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            // White icons against the dark call surface.
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }

    /**
     * Apply system-bar / display-cutout insets to the call chrome so
     * nothing sits under the status bar, camera notch, or gesture
     * pill once edge-to-edge is active.
     *
     * <ul>
     *   <li>{@code video_header} gets {@code paddingTop = inset.top}
     *       (preserving its built-in padding for breathing room) so
     *       the status / name text sit below the status bar.</li>
     *   <li>{@code video_controls} gets {@code paddingBottom =
     *       inset.bottom} so the button row is not occluded by the
     *       gesture pill.</li>
     *   <li>The centered voice {@code overlay} gets matching
     *       top + bottom padding so the avatar / name / duration /
     *       controls don't sit under bars on voice calls (which
     *       previously relied on {@code fitsSystemWindows="true"}
     *       on the root, now disabled).</li>
     *   <li>The local self-view PiP's top margin is set to
     *       {@code inset.top + 16dp} so it clears the status bar
     *       and any camera cutout.</li>
     * </ul>
     */
    private void installWindowInsetsListener() {
        if (rootLayout == null) return;
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout());
            // Re-apply each container's built-in design padding plus
            // the system inset, so we never collapse the visual
            // breathing room defined in the layout XML.
            if (videoHeader != null) {
                int basePadTop = dpToPx(16);
                int basePadBottom = dpToPx(32);
                int basePadX = dpToPx(24);
                videoHeader.setPadding(
                    basePadX, basePadTop + bars.top, basePadX, basePadBottom);
            }
            if (videoControls != null) {
                int basePadTop = dpToPx(48);
                int basePadBottom = dpToPx(24);
                int basePadX = dpToPx(16);
                videoControls.setPadding(
                    basePadX, basePadTop, basePadX, basePadBottom + bars.bottom);
            }
            if (overlayLayout != null) {
                int basePadX = dpToPx(24);
                int basePadY = dpToPx(24);
                overlayLayout.setPadding(
                    basePadX, basePadY + bars.top, basePadX, basePadY + bars.bottom);
            }
            if (localVideoRenderer != null) {
                ViewGroup.LayoutParams lp = localVideoRenderer.getLayoutParams();
                if (lp instanceof android.widget.FrameLayout.LayoutParams) {
                    android.widget.FrameLayout.LayoutParams flp =
                        (android.widget.FrameLayout.LayoutParams) lp;
                    int desiredTop = bars.top + dpToPx(LOCAL_PIP_INSET_GAP_DP);
                    if (desiredTop < dpToPx(LOCAL_PIP_DEFAULT_TOP_MARGIN_DP)) {
                        // On older devices / emulators with no status
                        // bar inset, keep the design default rather
                        // than slamming the PiP to the very top.
                        desiredTop = dpToPx(LOCAL_PIP_DEFAULT_TOP_MARGIN_DP);
                    }
                    if (flp.topMargin != desiredTop) {
                        flp.topMargin = desiredTop;
                        localVideoRenderer.setLayoutParams(flp);
                    }
                }
            }
            // Don't consume — let children that may want insets get them.
            return insets;
        });
        ViewCompat.requestApplyInsets(rootLayout);
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
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
        View.OnClickListener muteClick = new View.OnClickListener() {
            @Override public void onClick(View v) {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr == null) return;
                // Ask the manager for the current state instead of
                // reading the local cache so back-to-back taps
                // before the listener fires can't double-toggle.
                mgr.setMuted(!mgr.isMuted());
            }
        };
        View.OnClickListener hangupClick = new View.OnClickListener() {
            @Override public void onClick(View v) {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr != null) mgr.hangup();
            }
        };
        View.OnClickListener speakerClick = new View.OnClickListener() {
            @Override public void onClick(View v) {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr == null) return;
                // The visual update happens via the manager's
                // onSpeakerChanged callback, mirroring the mute
                // path. Keeps the activity's view state strictly
                // a function of the manager's authoritative state.
                mgr.setSpeakerOn(!mgr.isSpeakerOn());
            }
        };
        View.OnClickListener cameraOffClick = new View.OnClickListener() {
            @Override public void onClick(View v) {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr == null) return;
                mgr.setCameraOff(!mgr.isCameraOff());
            }
        };
        View.OnClickListener cameraFlipClick = new View.OnClickListener() {
            @Override public void onClick(View v) {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr != null) mgr.flipCamera();
            }
        };
        // Voice-mode buttons (centered overlay).
        if (muteButton != null) muteButton.setOnClickListener(muteClick);
        if (hangupButton != null) hangupButton.setOnClickListener(hangupClick);
        if (speakerButton != null) speakerButton.setOnClickListener(speakerClick);
        if (cameraOffButton != null) cameraOffButton.setOnClickListener(cameraOffClick);
        if (cameraFlipButton != null) cameraFlipButton.setOnClickListener(cameraFlipClick);
        // Video-mode buttons (bottom scrim row). These mirror the
        // voice-mode buttons exactly — same actions, same listeners
        // — but live in the scrim-backed video controls container so
        // the voice overlay can be hidden on video calls without
        // taking the buttons with it.
        if (muteButtonVideo != null) muteButtonVideo.setOnClickListener(muteClick);
        if (hangupButtonVideo != null) hangupButtonVideo.setOnClickListener(hangupClick);
        if (speakerButtonVideo != null) speakerButtonVideo.setOnClickListener(speakerClick);
        if (cameraOffButtonVideo != null) cameraOffButtonVideo.setOnClickListener(cameraOffClick);
        if (cameraFlipButtonVideo != null) cameraFlipButtonVideo.setOnClickListener(cameraFlipClick);
        // Initial paint with the off-state visual so the buttons render
        // correctly before the manager's pushInitialState callback
        // arrives (which happens after onServiceConnected / setUiListener).
        applyMute(false);
        applySpeaker(false);
        applyCameraOff(false);
    }

    private void initRenderersIfNeeded(NativeVoiceCallManager mgr) {
        if (renderersInitialized) return;
        EglBase eglBase = mgr.getRootEglBase();
        if (eglBase == null) {
            Log.w(TAG, "initRenderersIfNeeded: rootEglBase is null"
                + " (kind=" + mgr.getCallKind() + ")");
            return;
        }
        try {
            // RendererEvents callback fires when the first frame is
            // actually drawn into the SurfaceView. Useful diagnostic
            // for "no video at all" symptoms — a missing log here
            // means frames never made it through the encode/decode
            // pipeline, even though the track was attached.
            RendererCommon.RendererEvents remoteEvents =
                new RendererCommon.RendererEvents() {
                    @Override
                    public void onFirstFrameRendered() {
                        Log.d(TAG, "remoteVideoRenderer: first frame rendered");
                    }
                    @Override
                    public void onFrameResolutionChanged(int videoWidth, int videoHeight, int rotation) {
                        Log.d(TAG, "remoteVideoRenderer: resolution=" + videoWidth + "x"
                            + videoHeight + " rot=" + rotation);
                    }
                };
            RendererCommon.RendererEvents localEvents =
                new RendererCommon.RendererEvents() {
                    @Override
                    public void onFirstFrameRendered() {
                        Log.d(TAG, "localVideoRenderer: first frame rendered");
                    }
                    @Override
                    public void onFrameResolutionChanged(int videoWidth, int videoHeight, int rotation) {
                        Log.d(TAG, "localVideoRenderer: resolution=" + videoWidth + "x"
                            + videoHeight + " rot=" + rotation);
                    }
                };
            if (remoteVideoRenderer != null) {
                remoteVideoRenderer.init(eglBase.getEglBaseContext(), remoteEvents);
                remoteVideoRenderer.setScalingType(
                    RendererCommon.ScalingType.SCALE_ASPECT_FILL);
                remoteVideoRenderer.setEnableHardwareScaler(true);
                Log.d(TAG, "remoteVideoRenderer: init done");
            }
            if (localVideoRenderer != null) {
                localVideoRenderer.init(eglBase.getEglBaseContext(), localEvents);
                localVideoRenderer.setScalingType(
                    RendererCommon.ScalingType.SCALE_ASPECT_FILL);
                localVideoRenderer.setEnableHardwareScaler(true);
                // Local self-view is overlaid on top of the remote
                // renderer — ensure it actually sits on top.
                localVideoRenderer.setZOrderMediaOverlay(true);
                // Mirror initially since we default to the front camera.
                localVideoRenderer.setMirror(true);
                Log.d(TAG, "localVideoRenderer: init done");
            }
            renderersInitialized = true;
        } catch (Throwable t) {
            Log.w(TAG, "renderer init failed", t);
        }
    }

    private void attachLocalVideoSink(VideoTrack track) {
        if (track == null || localVideoRenderer == null) {
            Log.d(TAG, "attachLocalVideoSink: skip"
                + " (track=" + (track != null) + " renderer=" + (localVideoRenderer != null) + ")");
            return;
        }
        if (!renderersInitialized) {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) initRenderersIfNeeded(mgr);
        }
        try {
            track.addSink(localVideoRenderer);
            Log.d(TAG, "attachLocalVideoSink: addSink ok");
        } catch (Throwable t) {
            Log.w(TAG, "addSink local failed", t);
        }
    }

    private void attachRemoteVideoSink(VideoTrack track) {
        if (track == null || remoteVideoRenderer == null) {
            Log.d(TAG, "attachRemoteVideoSink: skip"
                + " (track=" + (track != null) + " renderer=" + (remoteVideoRenderer != null) + ")");
            return;
        }
        if (!renderersInitialized) {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) initRenderersIfNeeded(mgr);
        }
        try {
            track.addSink(remoteVideoRenderer);
            Log.d(TAG, "attachRemoteVideoSink: addSink ok");
        } catch (Throwable t) {
            Log.w(TAG, "addSink remote failed", t);
        }
    }

    private void applyCameraOff(boolean cameraOff) {
        // Same inverted-active visual as mute / speaker. We swap the
        // glyph too: video icon when on, video-off icon when off.
        applyToggleVisual(
            cameraOffButton,
            cameraOff,
            R.drawable.ic_video,
            R.drawable.ic_video_off);
        applyToggleVisual(
            cameraOffButtonVideo,
            cameraOff,
            R.drawable.ic_video,
            R.drawable.ic_video_off);
        if (localVideoRenderer != null) {
            // Hide the local self-view when the camera is off so the
            // user sees that they're not transmitting frames.
            localVideoRenderer.setVisibility(
                isVideoCall && !cameraOff ? View.VISIBLE : View.GONE);
        }
    }

    private void applyFacing(boolean isFront) {
        if (localVideoRenderer != null) {
            localVideoRenderer.setMirror(isFront);
        }
    }

    private void applyStatus(NativeVoiceCallManager.CallStatus status, String reason) {
        if (status == null) return;
        Log.d(TAG, "applyStatus: " + status + " reason=" + reason);
        String text;
        switch (status) {
            case OUTGOING_RINGING: text = "Calling…"; break;
            case INCOMING_RINGING: text = "Incoming call"; break;
            case CONNECTING: text = "Connecting…"; break;
            case ACTIVE: text = "Active"; break;
            case ENDED: text = endReasonText(reason); break;
            case IDLE:
            default: text = null; break;
        }
        if (text != null) {
            if (statusView != null) statusView.setText(text);
            if (statusViewVideo != null) statusViewVideo.setText(text);
        }
        if (status == NativeVoiceCallManager.CallStatus.ENDED) {
            // Defer finishing slightly so the user briefly sees the
            // ended state, matching the JS overlay's CALL_END_DISPLAY_MS.
            mainHandler.postDelayed(this::finishAndRemoveTask, 1500L);
        }
    }

    private void updateDuration(int seconds) {
        int m = seconds / 60;
        int s = seconds % 60;
        String txt = String.format("%d:%02d", m, s);
        if (durationView != null) durationView.setText(txt);
        if (durationViewVideo != null) durationViewVideo.setText(txt);
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
        applyToggleVisual(
            muteButtonVideo,
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
        applyToggleVisual(
            speakerButtonVideo,
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
