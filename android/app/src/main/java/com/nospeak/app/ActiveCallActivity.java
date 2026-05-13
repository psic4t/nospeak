package com.nospeak.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.animation.ValueAnimator;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.PorterDuff;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.view.accessibility.AccessibilityManager;
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
    /**
     * "Add video" button on the voice control row. Visible only when
     * the call is voice + active + renegotiationState=idle. Tap fires
     * {@link NativeVoiceCallManager#requestVideoUpgrade()} (NIP-AC
     * kind 25055 voice→video upgrade).
     */
    private ImageButton addVideoButton;
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
    /**
     * Local self-view PiP. Uses {@link TextureViewRenderer} rather
     * than {@link SurfaceViewRenderer} so that
     * {@link View#setClipToOutline} + a rounded
     * {@link ViewOutlineProvider} actually round the rendered
     * pixels — SurfaceView pixels are composited on a separate
     * hardware overlay plane that ignores outline clipping. See
     * {@link TextureViewRenderer} for the renderer implementation
     * and {@link #initRenderersIfNeeded} for the corner-radius
     * setup.
     */
    private TextureViewRenderer localVideoRenderer;
    private View rootLayout;
    private View videoHeader;
    private View videoControls;
    private View overlayLayout;
    private View videoAvatarOverlay;
    private ImageView videoAvatarView;
    private TextView videoNameCentered;
    /**
     * Corner-position fallback bottom margin for the local self-view
     * PiP (matches the fallback in activity_active_call.xml). Used
     * before the inset listener has run and before the chrome
     * visibility is known. Real placement is computed by
     * {@link #applyLocalPipBottomMargin(boolean)}.
     */
    private static final int LOCAL_PIP_DEFAULT_BOTTOM_MARGIN_DP = 32;
    /**
     * Used when the video-controls bar hasn't been measured yet (first
     * inset pass before layout completes). Roughly the height of the
     * controls row including its scrim padding. Only consulted when
     * chrome is visible (slid-up position).
     */
    private static final int LOCAL_PIP_CONTROLS_FALLBACK_DP = 114;
    /**
     * Gap between the PiP and either the navigation bar (corner mode)
     * or the controls scrim (slid-up mode).
     */
    private static final int LOCAL_PIP_INSET_GAP_DP = 16;
    /**
     * Slide-animation handle for {@link #applyLocalPipBottomMargin}.
     * Cancelled on every new transition so back-to-back chrome
     * show/hide events don't queue up half-finished tweens.
     */
    private ValueAnimator localPipMarginAnimator;
    /**
     * Last-known navigation-bar / display-cutout bottom inset, cached
     * by the inset listener. The PiP placement helper consults this
     * outside the inset callback (e.g. from {@link #showChrome()} /
     * {@link #hideChrome()}) without needing the original
     * {@code WindowInsetsCompat} object.
     */
    private int cachedNavBarInsetPx = 0;

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

    // -------- Chrome auto-hide (video calls only) --------
    /**
     * After this many ms of touch inactivity on a video call in ACTIVE
     * state, the top header and bottom controls fade out (WhatsApp
     * convention). Any touch reveals them again and resets the timer.
     */
    private static final long CHROME_AUTO_HIDE_MS = 3000L;
    /** Fade-in / fade-out duration for chrome and system bars. */
    private static final long CHROME_FADE_MS = 200L;
    /** True when chrome (header + controls) is currently shown. */
    private boolean chromeVisible = true;
    /**
     * True once the remote SurfaceViewRenderer has rendered its first
     * frame. We never auto-hide chrome before then — hiding controls
     * over a black-screen pre-roll is worse UX than leaving them up.
     */
    private boolean firstRemoteFrameRendered = false;
    /**
     * True when TalkBack / touch-exploration is active. While set, we
     * keep chrome visible permanently so the controls remain
     * reachable for accessibility services.
     */
    private boolean isAccessibilityTouchExplorationOn = false;
    /**
     * Most recent status from {@link NativeVoiceCallManager}. Auto-hide
     * is only scheduled while this is {@code ACTIVE}; pre-active and
     * ENDED states force chrome visible.
     */
    private NativeVoiceCallManager.CallStatus latestStatus =
        NativeVoiceCallManager.CallStatus.IDLE;
    /**
     * Latest in-flight renegotiation state. Drives "Add video" button
     * visibility / enabled state.
     */
    private NativeVoiceCallManager.RenegotiationState latestRenegotiationState =
        NativeVoiceCallManager.RenegotiationState.IDLE;
    private final Runnable hideChromeRunnable = this::hideChrome;
    private AccessibilityManager.TouchExplorationStateChangeListener a11yListener;

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

            @Override
            public void onCameraFlippingChanged(boolean flipping) {
                mainHandler.post(() -> applyCameraFlipping(flipping));
            }

            @Override
            public void onRenegotiationStateChanged(
                    NativeVoiceCallManager.RenegotiationState state) {
                mainHandler.post(() -> applyRenegotiationState(state));
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
        addVideoButton = findViewById(R.id.active_call_add_video);
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
        videoAvatarOverlay = findViewById(R.id.active_call_video_avatar_overlay);
        videoAvatarView = findViewById(R.id.active_call_video_avatar);
        videoNameCentered = findViewById(R.id.active_call_video_name_centered);

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
        // Reset chrome auto-hide state for the replacement call: a
        // brand-new call has a fresh remote stream, so we must wait
        // for the new first frame before auto-hiding again. Force
        // chrome visible in case the previous call had hidden it.
        firstRemoteFrameRendered = false;
        forceShowChrome();
        // Reset the video avatar overlay so the new peer's identity
        // is shown while waiting for remote video.
        if (videoAvatarOverlay != null) {
            videoAvatarOverlay.setAlpha(1f);
            videoAvatarOverlay.setVisibility(
                isVideoCall ? View.VISIBLE : View.GONE);
        }
        // Re-apply PiP placement defensively: forceShowChrome only
        // calls showChrome (which moves the PiP) when chrome was
        // hidden. If the previous call left chrome visible, we still
        // want to ensure the PiP sits at the slid-up position.
        applyLocalPipBottomMargin(false);
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
        // Drop any pending chrome-hide so it can't fire on a destroyed
        // window after the activity has finished.
        mainHandler.removeCallbacks(hideChromeRunnable);
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
    protected void onResume() {
        super.onResume();
        // Track TalkBack / touch-exploration state. While enabled the
        // chrome stays visible permanently — auto-hide would render
        // controls unreachable for accessibility services.
        AccessibilityManager am = (AccessibilityManager)
            getSystemService(ACCESSIBILITY_SERVICE);
        if (am != null) {
            isAccessibilityTouchExplorationOn = am.isTouchExplorationEnabled();
            a11yListener = enabled -> mainHandler.post(() -> {
                isAccessibilityTouchExplorationOn = enabled;
                if (enabled) {
                    forceShowChrome();
                } else {
                    scheduleHideIfEligible();
                }
            });
            try {
                am.addTouchExplorationStateChangeListener(a11yListener);
            } catch (Throwable ignored) {}
            if (isAccessibilityTouchExplorationOn) {
                forceShowChrome();
            }
        }
    }

    @Override
    protected void onPause() {
        if (a11yListener != null) {
            AccessibilityManager am = (AccessibilityManager)
                getSystemService(ACCESSIBILITY_SERVICE);
            if (am != null) {
                try {
                    am.removeTouchExplorationStateChangeListener(a11yListener);
                } catch (Throwable ignored) {}
            }
            a11yListener = null;
        }
        super.onPause();
    }

    /**
     * Activity-level interaction hook. Android dispatches this for
     * every touch / key event the activity receives, before child
     * views handle it. Using this (rather than an OnTouchListener on
     * the root) means button taps both perform their action AND
     * reset the chrome-hide timer, without us having to special-case
     * dispatch.
     */
    @Override
    public void onUserInteraction() {
        super.onUserInteraction();
        if (!isVideoCall) return;
        if (chromeVisible) {
            // Keep-alive: any touch resets the 3 s hide timer.
            scheduleHideIfEligible();
        } else {
            // Tap-to-reveal.
            showChrome();
        }
    }

    @Override
    protected void onDestroy() {
        // Cancel any in-flight PiP slide so its update listener can't
        // fire on a released renderer.
        if (localPipMarginAnimator != null) {
            try { localPipMarginAnimator.cancel(); } catch (Throwable ignored) {}
            localPipMarginAnimator = null;
        }
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
            if (videoNameCentered != null) videoNameCentered.setText(peerName);
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
        if (videoHeader != null) {
            videoHeader.setVisibility(videoVis);
            // Reset alpha defensively: any previous video session may
            // have left it at 0 mid-fade if the activity was reused.
            videoHeader.setAlpha(1f);
        }
        if (videoControls != null) {
            videoControls.setVisibility(videoVis);
            videoControls.setAlpha(1f);
        }
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
        // Show the centered video-avatar overlay when this is a video
        // call and we haven't seen the first remote frame yet. Once
        // remote video is flowing, the overlay is faded out in
        // onFirstFrameRendered().
        if (videoAvatarOverlay != null) {
            videoAvatarOverlay.setVisibility(
                isVideoCall && !firstRemoteFrameRendered ? View.VISIBLE : View.GONE);
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
        // Voice path: ensure chrome auto-hide is fully disengaged.
        // The video header/controls are already GONE for voice (set
        // above), but force-clear any timer so a previous video-call
        // session's pending hide can't fire on this voice surface.
        if (!isVideoCall) {
            mainHandler.removeCallbacks(hideChromeRunnable);
            chromeVisible = true;
        }
        // The "Add video" button only exists on voice. Refresh after
        // a kind change (notably a successful voice→video upgrade
        // re-enters this method to hide it).
        refreshAddVideoButton();
        // Initial PiP placement when entering video mode. Snap (no
        // animation) so the first frame doesn't slide in from a
        // half-applied XML margin.
        applyLocalPipBottomMargin(false);
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
                // The outer sheet container is full-width; the inner
                // button row provides its own horizontal padding in
                // XML. We only need to add the nav-bar inset at the
                // bottom so buttons clear the gesture bar.
                videoControls.setPadding(
                    0, 0, 0, bars.bottom);
            }
            if (overlayLayout != null) {
                int basePadX = dpToPx(24);
                int basePadY = dpToPx(24);
                overlayLayout.setPadding(
                    basePadX, basePadY + bars.top, basePadX, basePadY + bars.bottom);
            }
            // Cache the bottom inset so chrome show/hide transitions
            // can recompute the PiP target without a fresh inset event.
            cachedNavBarInsetPx = bars.bottom;
            // Recompute the PiP placement on every inset change. Skip
            // the slide animation here — insets fire during layout,
            // so animating would feel laggy. Chrome show/hide call
            // sites pass animate=true.
            applyLocalPipBottomMargin(false);
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
     * Compute and apply the bottom-margin for the local self-view PiP.
     *
     * <p>Two states:
     * <ul>
     *   <li><b>Chrome hidden (the common case while in a call):</b>
     *       PiP sits in the bottom-right corner — {@code navBar +
     *       16dp gap} from the bottom edge.</li>
     *   <li><b>Chrome visible (briefly, after a tap or before first
     *       remote frame):</b> PiP slides up so the controls scrim
     *       doesn't overlap it — {@code navBar + controlsHeight +
     *       16dp gap}.</li>
     * </ul>
     *
     * <p>When {@code animate} is {@code true} the change is tweened
     * over {@link #CHROME_FADE_MS} so the PiP visually moves with the
     * scrim fade. When {@code false} (e.g. inset listener, initial
     * placement) the margin snaps to the target.
     *
     * <p>Idempotent: re-running with the same target margin is a
     * no-op. Voice calls are no-ops (the PiP is gone in voice mode).
     */
    private void applyLocalPipBottomMargin(boolean animate) {
        if (!isVideoCall) return;
        if (localVideoRenderer == null) return;
        ViewGroup.LayoutParams lp = localVideoRenderer.getLayoutParams();
        if (!(lp instanceof android.widget.FrameLayout.LayoutParams)) return;
        final android.widget.FrameLayout.LayoutParams flp =
            (android.widget.FrameLayout.LayoutParams) lp;

        int navInset = cachedNavBarInsetPx;
        int gap = dpToPx(LOCAL_PIP_INSET_GAP_DP);
        int designFallback = dpToPx(LOCAL_PIP_DEFAULT_BOTTOM_MARGIN_DP);
        int targetBottom;
        if (chromeVisible) {
            int controlsHeightPx = (videoControls != null
                    && videoControls.getHeight() > 0)
                ? videoControls.getHeight()
                : dpToPx(LOCAL_PIP_CONTROLS_FALLBACK_DP);
            targetBottom = navInset + controlsHeightPx + gap;
        } else {
            targetBottom = navInset + gap;
        }
        if (targetBottom < designFallback) {
            // Pre-measure / no-inset edge case (e.g. emulator without
            // gesture pill). Keep the design default so the PiP
            // doesn't slam against the very bottom edge.
            targetBottom = designFallback;
        }

        // Defensive: ensure no leftover topMargin keeps the PiP
        // pinned high (older layouts used top|end gravity).
        boolean topMarginNeedsReset = flp.topMargin != 0;
        if (flp.bottomMargin == targetBottom && !topMarginNeedsReset) {
            return; // already there
        }

        // Cancel any in-flight transition so back-to-back chrome
        // show/hide events don't queue up.
        if (localPipMarginAnimator != null && localPipMarginAnimator.isRunning()) {
            localPipMarginAnimator.cancel();
        }

        if (!animate) {
            flp.bottomMargin = targetBottom;
            if (topMarginNeedsReset) flp.topMargin = 0;
            localVideoRenderer.setLayoutParams(flp);
            return;
        }

        // Always reset stale top margin synchronously — animating only
        // the bottom is enough for the visual slide.
        if (topMarginNeedsReset) flp.topMargin = 0;
        final int startBottom = flp.bottomMargin;
        ValueAnimator anim = ValueAnimator.ofInt(startBottom, targetBottom);
        anim.setDuration(CHROME_FADE_MS);
        anim.setInterpolator(new DecelerateInterpolator());
        anim.addUpdateListener(animation -> {
            // Re-fetch layout params on each frame: the view may have
            // been re-parented or had its params replaced concurrently.
            ViewGroup.LayoutParams cur = localVideoRenderer.getLayoutParams();
            if (cur instanceof android.widget.FrameLayout.LayoutParams) {
                android.widget.FrameLayout.LayoutParams curFlp =
                    (android.widget.FrameLayout.LayoutParams) cur;
                curFlp.bottomMargin = (int) animation.getAnimatedValue();
                localVideoRenderer.setLayoutParams(curFlp);
            }
        });
        localPipMarginAnimator = anim;
        anim.start();
    }

    /**
     * Resolve and apply the peer avatar. Cached profile picture wins;
     * identicon (derived from {@link #peerHex}) is used as a fallback so
     * picture-less peers don't get a generic placeholder. Mirrors the
     * behavior of the heads-up CallStyle notification's caller icon.
     */
    private void bindAvatar() {
        if (avatarView == null && videoAvatarView == null) return;
        Drawable d = CallAvatarLoader.loadCircular(
            this, avatarPath, peerHex, /*targetPx*/ 192);
        if (d != null) {
            if (avatarView != null) avatarView.setImageDrawable(d);
            if (videoAvatarView != null) videoAvatarView.setImageDrawable(d);
        }
        // else: leave the layout's @drawable/ic_call_avatar_placeholder
        // in place. Only happens when peerHex is absent and no cached
        // file path was passed (e.g. legacy launch path without extras).
    }

    private void fadeOutVideoAvatarOverlay() {
        if (videoAvatarOverlay == null) return;
        if (videoAvatarOverlay.getVisibility() != View.VISIBLE) return;
        videoAvatarOverlay.animate()
            .alpha(0f)
            .setDuration(CHROME_FADE_MS)
            .withEndAction(() -> {
                if (videoAvatarOverlay != null) {
                    videoAvatarOverlay.setVisibility(View.GONE);
                    videoAvatarOverlay.setAlpha(1f);
                }
            })
            .start();
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
        View.OnClickListener addVideoClick = new View.OnClickListener() {
            @Override public void onClick(View v) {
                NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
                if (mgr != null) mgr.requestVideoUpgrade();
            }
        };
        // Voice-mode buttons (centered overlay).
        if (muteButton != null) muteButton.setOnClickListener(muteClick);
        if (hangupButton != null) hangupButton.setOnClickListener(hangupClick);
        if (speakerButton != null) speakerButton.setOnClickListener(speakerClick);
        if (cameraOffButton != null) cameraOffButton.setOnClickListener(cameraOffClick);
        if (cameraFlipButton != null) cameraFlipButton.setOnClickListener(cameraFlipClick);
        if (addVideoButton != null) addVideoButton.setOnClickListener(addVideoClick);
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
                        // Gate chrome auto-hide on first remote frame so
                        // we never hide controls over a black pre-roll.
                        mainHandler.post(() -> {
                            firstRemoteFrameRendered = true;
                            fadeOutVideoAvatarOverlay();
                            scheduleHideIfEligible();
                        });
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
                // renderer — declared after it in the layout, so
                // it naturally sits on top. The
                // setZOrderMediaOverlay call is a no-op on
                // TextureViewRenderer (kept for API parity).
                localVideoRenderer.setZOrderMediaOverlay(true);
                // Mirror initially since we default to the front
                // camera. Mirroring is applied in GL space by the
                // underlying EglRenderer so the View's outline /
                // bounds stay in canonical orientation (the rounded
                // clip below sees the unmirrored rect).
                localVideoRenderer.setMirror(true);
                // 16dp corner radius matches the PWA self-view —
                // see ActiveCallOverlay.svelte. TextureView pixels
                // participate in the normal View hierarchy, so
                // setClipToOutline now actually rounds the
                // rendered frames (this was impossible with
                // SurfaceView, see commit c826e77 for context).
                final float radiusPx = TypedValue.applyDimension(
                    TypedValue.COMPLEX_UNIT_DIP,
                    16f,
                    getResources().getDisplayMetrics());
                localVideoRenderer.setOutlineProvider(new ViewOutlineProvider() {
                    @Override
                    public void getOutline(View view, Outline outline) {
                        outline.setRoundRect(
                            0, 0, view.getWidth(), view.getHeight(), radiusPx);
                    }
                });
                localVideoRenderer.setClipToOutline(true);
                Log.d(TAG, "localVideoRenderer: init done (rounded "
                    + radiusPx + "px)");
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
        // A local video track arriving while the activity thinks it's
        // on a voice call means a NIP-AC kind-25055 voice→video
        // upgrade just succeeded. Promote the activity's kind state,
        // re-apply visibility (which initializes renderers and shows
        // the video chrome), and continue with the addSink below.
        if (!isVideoCall) {
            Log.i(TAG, "local video track arrived during voice call — "
                + "promoting activity to video (mid-call upgrade)");
            isVideoCall = true;
            applyKindVisibility();
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
        // Same mid-call upgrade promotion as attachLocalVideoSink — a
        // peer-initiated voice→video upgrade delivers the remote
        // video track first.
        if (!isVideoCall) {
            Log.i(TAG, "remote video track arrived during voice call — "
                + "promoting activity to video (mid-call upgrade)");
            isVideoCall = true;
            applyKindVisibility();
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
        // Inverted-active visual: back camera = active (bright bg
        // + dark icon), front camera = inactive (translucent bg +
        // white icon). Same convention as mute / speaker / camera-
        // off toggles.
        applyToggleVisual(
            cameraFlipButton,
            !isFront,
            R.drawable.ic_camera_flip,
            R.drawable.ic_camera_flip);
        applyToggleVisual(
            cameraFlipButtonVideo,
            !isFront,
            R.drawable.ic_camera_flip,
            R.drawable.ic_camera_flip);

        if (localVideoRenderer == null) return;
        // Brief fade across the camera swap so the user gets a clear
        // visual cue that the cameras switched. Without this, the
        // only feedback is the mirroring flip — which on a static
        // scene can be near-invisible. Total ~240ms (120ms fade out
        // + 120ms fade in), tied to the actual switchCamera-completed
        // event so the new mirror state is applied during the
        // imperceptible-frame window.
        localVideoRenderer.animate()
            .alpha(0f)
            .setDuration(120)
            .withEndAction(() -> {
                if (localVideoRenderer == null) return;
                localVideoRenderer.setMirror(isFront);
                localVideoRenderer.animate()
                    .alpha(1f)
                    .setDuration(120)
                    .start();
            })
            .start();
    }

    /**
     * Dim and disable the flip-camera buttons while a
     * {@code switchCamera} is in flight. Mirrors the web's
     * {@code disabled={isCameraFlipping}} + {@code disabled:opacity-50}
     * treatment on the same control. Affects both the voice-mode
     * button (hidden on video calls but kept in sync defensively) and
     * the bottom-scrim video-mode button that's actually visible.
     */
    private void applyCameraFlipping(boolean flipping) {
        float alpha = flipping ? 0.5f : 1.0f;
        if (cameraFlipButton != null) {
            cameraFlipButton.setEnabled(!flipping);
            cameraFlipButton.setAlpha(alpha);
        }
        if (cameraFlipButtonVideo != null) {
            cameraFlipButtonVideo.setEnabled(!flipping);
            cameraFlipButtonVideo.setAlpha(alpha);
        }
    }

    /**
     * Update {@link #latestRenegotiationState} and refresh the "Add
     * video" button visibility / enabled state. Idempotent.
     */
    private void applyRenegotiationState(
            NativeVoiceCallManager.RenegotiationState state) {
        if (state == null) {
            latestRenegotiationState =
                NativeVoiceCallManager.RenegotiationState.IDLE;
        } else {
            latestRenegotiationState = state;
        }
        refreshAddVideoButton();
    }

    /**
     * Show the "Add video" button only when the call is voice +
     * active + renegotiationState=idle. While a renegotiation is in
     * flight we keep the button visible but dim and disabled, matching
     * the web's "Adding video…" affordance — this avoids a layout
     * jump when the user taps and gives them visual confirmation that
     * the tap registered.
     */
    private void refreshAddVideoButton() {
        if (addVideoButton == null) return;
        boolean isActiveVoice =
            !isVideoCall
                && latestStatus == NativeVoiceCallManager.CallStatus.ACTIVE;
        boolean idle =
            latestRenegotiationState
                == NativeVoiceCallManager.RenegotiationState.IDLE;
        if (!isActiveVoice) {
            addVideoButton.setVisibility(View.GONE);
            return;
        }
        if (idle) {
            addVideoButton.setVisibility(View.VISIBLE);
            addVideoButton.setEnabled(true);
            addVideoButton.setAlpha(1.0f);
        } else {
            // Mid-upgrade: keep visible to avoid jump but make the
            // disabled state obvious.
            addVideoButton.setVisibility(View.VISIBLE);
            addVideoButton.setEnabled(false);
            addVideoButton.setAlpha(0.5f);
        }
    }

    private void applyStatus(NativeVoiceCallManager.CallStatus status, String reason) {
        if (status == null) return;
        Log.d(TAG, "applyStatus: " + status + " reason=" + reason);
        latestStatus = status;
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
        // Chrome visibility coupling: ACTIVE → may schedule auto-hide;
        // any other state → force chrome visible so end-reason text
        // and pre-connect status are always readable.
        if (status == NativeVoiceCallManager.CallStatus.ACTIVE) {
            scheduleHideIfEligible();
        } else {
            forceShowChrome();
        }
        if (status == NativeVoiceCallManager.CallStatus.ENDED) {
            // Defer finishing slightly so the user briefly sees the
            // ended state, matching the JS overlay's CALL_END_DISPLAY_MS.
            mainHandler.postDelayed(this::finishAndRemoveTask, 1500L);
        }
        // The "Add video" button visibility depends on status; refresh
        // whenever status changes.
        refreshAddVideoButton();
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

    // -------- Chrome auto-hide implementation --------

    /**
     * Schedule the auto-hide runnable iff we're in a state where
     * hiding the chrome makes sense. No-ops on voice calls, before
     * the first remote frame, while the call isn't ACTIVE, and while
     * accessibility touch-exploration is on. Always cancels any
     * previously-pending hide first so taps reliably extend the timer.
     */
    private void scheduleHideIfEligible() {
        mainHandler.removeCallbacks(hideChromeRunnable);
        if (!isVideoCall) return;
        if (isAccessibilityTouchExplorationOn) return;
        if (latestStatus != NativeVoiceCallManager.CallStatus.ACTIVE) return;
        if (!firstRemoteFrameRendered) return;
        mainHandler.postDelayed(hideChromeRunnable, CHROME_AUTO_HIDE_MS);
    }

    /**
     * Cancel any pending auto-hide and ensure chrome is visible. Used
     * when transitioning out of ACTIVE (e.g. CONNECTING / ENDED) and
     * when accessibility services come on.
     */
    private void forceShowChrome() {
        mainHandler.removeCallbacks(hideChromeRunnable);
        if (!chromeVisible) {
            showChrome();
        }
    }

    /**
     * Fade the top header + bottom controls back in (200 ms) and
     * un-hide the system status / navigation bars. Resets the auto-
     * hide timer if the call is currently eligible.
     *
     * <p>Voice calls are a no-op: the centered voice overlay is the
     * entire UI on voice calls and is not subject to auto-hide.
     */
    private void showChrome() {
        if (!isVideoCall) {
            chromeVisible = true;
            return;
        }
        chromeVisible = true;
        if (videoHeader != null) {
            videoHeader.setVisibility(View.VISIBLE);
            videoHeader.animate()
                .alpha(1f)
                .setDuration(CHROME_FADE_MS)
                .start();
        }
        if (videoControls != null) {
            videoControls.setVisibility(View.VISIBLE);
            videoControls.animate()
                .alpha(1f)
                .setDuration(CHROME_FADE_MS)
                .start();
        }
        // Slide the local PiP up so the controls scrim doesn't cover
        // it. Tweens over the same CHROME_FADE_MS as the scrim alpha.
        applyLocalPipBottomMargin(true);
        showSystemBars();
        scheduleHideIfEligible();
    }

    /**
     * Fade the top header + bottom controls out (200 ms) and hide the
     * system status / navigation bars. Re-evaluates eligibility at
     * fire time so a status change between scheduling and firing is
     * handled correctly (the runnable bails out and re-shows).
     */
    private void hideChrome() {
        if (!isVideoCall
                || latestStatus != NativeVoiceCallManager.CallStatus.ACTIVE
                || isAccessibilityTouchExplorationOn
                || !firstRemoteFrameRendered) {
            // State changed since we scheduled — abort the hide and
            // make sure chrome is visible.
            forceShowChrome();
            return;
        }
        chromeVisible = false;
        if (videoHeader != null) {
            videoHeader.animate()
                .alpha(0f)
                .setDuration(CHROME_FADE_MS)
                .withEndAction(() -> {
                    if (!chromeVisible && videoHeader != null) {
                        videoHeader.setVisibility(View.INVISIBLE);
                    }
                })
                .start();
        }
        if (videoControls != null) {
            videoControls.animate()
                .alpha(0f)
                .setDuration(CHROME_FADE_MS)
                .withEndAction(() -> {
                    if (!chromeVisible && videoControls != null) {
                        videoControls.setVisibility(View.INVISIBLE);
                    }
                })
                .start();
        }
        // Slide the local PiP back down to the corner now that the
        // scrim is going away. Same duration as the scrim fade so the
        // two motions land together.
        applyLocalPipBottomMargin(true);
        hideSystemBars();
    }

    /**
     * Hide the system status + navigation bars while keeping them
     * available via swipe-from-edge ({@code BEHAVIOR_SHOW_TRANSIENT_
     * BARS_BY_SWIPE}). Mirrors WhatsApp's full-immersive video-call
     * surface.
     */
    private void hideSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView());
        if (c == null) return;
        c.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    private void showSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView());
        if (c == null) return;
        c.show(WindowInsetsCompat.Type.systemBars());
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
