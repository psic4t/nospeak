package com.nospeak.app;

import android.content.Context;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.DataChannel;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.MediaStreamTrack;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.RtpTransceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.audio.JavaAudioDeviceModule;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native voice-call manager. Phase 1 of the
 * {@code add-native-voice-calls} OpenSpec change.
 *
 * <p>Owns the {@code org.webrtc.PeerConnection}, microphone audio
 * source/track, ICE candidate buffer, call duration timer, offer/ICE
 * timeouts, and call state machine for a single voice call. Lifecycle
 * is bound to {@link VoiceCallForegroundService}: the FGS instantiates
 * one manager per call and disposes it when the call ends.
 *
 * <p>This class does NOT touch the JS layer directly. State events
 * (state changes, duration ticks, errors, mute updates, history-write
 * requests) are dispatched through static
 * {@link AndroidVoiceCallPlugin} entrypoints; the plugin in turn
 * notifies its JS listeners. See
 * {@link AndroidVoiceCallPlugin#emitCallStateChanged} et al.
 *
 * <p>Threading: {@code PeerConnection} callbacks arrive on the
 * WebRTC signaling thread. The manager re-posts all state mutations
 * to the main looper to keep the state machine single-threaded.
 *
 * <p>Bridging the gap to the existing {@link NativeBackgroundMessagingService}
 * for NIP-AC publishing: the FGS supplies a {@link MessagingBridge}
 * implementation when constructing the manager. The bridge wraps the
 * {@code sendVoiceCall*} helpers added in Phase 0. The manager never
 * imports the messaging service directly to keep the dependency
 * direction narrow and to make unit testing possible later.
 */
public class NativeVoiceCallManager {

    private static final String TAG = "NativeVoiceCallMgr";

    /** ICE / SDP timeouts. Match {@code constants.ts}. */
    private static final long CALL_OFFER_TIMEOUT_MS = 60_000L;
    private static final long ICE_CONNECTION_TIMEOUT_MS = 30_000L;
    /**
     * Delay between transitioning to ENDED and resetting the manager
     * back to IDLE so subsequent calls can begin. Matches the JS
     * {@code CALL_END_DISPLAY_MS} window so ActiveCallActivity has
     * time to render the ended-reason text before the manager resets.
     * Without this reset, every call after the first one is rejected
     * with "not idle" / "not idle/ringing" because finishCall leaves
     * the manager pinned in ENDED forever.
     */
    private static final long IDLE_RESET_DELAY_MS = 1_500L;

    /**
     * Optional UI listener interface. Implemented by
     * {@link ActiveCallActivity} so the Activity can render the
     * current state without polling. The manager re-posts events
     * on the main thread before invoking listeners, so listener
     * methods can directly touch UI.
     *
     * <p>Multiple listeners are NOT supported in Phase 2 — there is
     * exactly one ActiveCallActivity at any time, and the FGS
     * notification handles its own state independently.
     */
    public interface UiListener {
        /** Called whenever the call status changes. */
        void onStatusChanged(CallStatus status, String reason);
        /** Called once per second while the call is active. */
        void onDurationTick(int seconds);
        /** Called when the mute state flips. */
        void onMuteChanged(boolean muted);
        /**
         * Called when the speakerphone routing flips. Default no-op so
         * older listener implementations (and the few internal test
         * doubles) still compile while only ActiveCallActivity needs to
         * observe the new state. Mirrors {@link #onMuteChanged}.
         */
        default void onSpeakerChanged(boolean speakerOn) {}
    }

    /**
     * Bridge into {@link NativeBackgroundMessagingService} for NIP-AC
     * publishing. Decouples the manager from the service's class
     * surface and makes unit testing the manager possible without
     * spinning up the full messaging stack.
     */
    public interface MessagingBridge {
        void sendOffer(String recipientHex, String callId, String sdp);
        void sendAnswer(String recipientHex, String callId, String sdp);
        void sendIce(String recipientHex, String callId,
                     String candidate, String sdpMid, Integer sdpMLineIndex);
        void sendHangup(String recipientHex, String callId, String reason);
        void sendReject(String recipientHex, String callId);
        /**
         * Author a kind-1405 call-history rumor that should be sent to
         * BOTH peers (via NIP-59 self-wrap). Types in {@code ended,
         * no-answer, declined, busy, failed}. Best-effort; a failure
         * does not affect the call outcome.
         */
        void sendCallHistoryRumor(
            String recipientHex,
            String type,
            int durationSec,
            String callId,
            String initiatorHex
        );
    }

    /** Possible peer-connection states recognised by the JS layer. */
    public enum CallStatus {
        IDLE,
        OUTGOING_RINGING,
        INCOMING_RINGING,
        CONNECTING,
        ACTIVE,
        ENDED;

        /** Lower-kebab string form, matching VoiceCallStatus on the JS side. */
        public String wireName() {
            switch (this) {
                case OUTGOING_RINGING: return "outgoing-ringing";
                case INCOMING_RINGING: return "incoming-ringing";
                case CONNECTING:       return "connecting";
                case ACTIVE:           return "active";
                case ENDED:            return "ended";
                case IDLE:
                default:               return "idle";
            }
        }
    }

    private final Context appContext;
    private final MessagingBridge bridge;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    /** Provided by the FGS; iceServers map the JS runtime config. */
    private final List<PeerConnection.IceServer> iceServers;

    private PeerConnectionFactory factory;
    private PeerConnection peerConnection;
    private AudioSource audioSource;
    private AudioTrack localAudioTrack;
    private final String localStreamId = "nospeak-stream-" + UUID.randomUUID();

    /** Call identity. Set in {@link #initiateCall} / {@link #acceptCall}. */
    private String callId;
    /** Hex pubkey of the remote peer. */
    private String peerHex;
    private CallStatus status = CallStatus.IDLE;
    private boolean isInitiator;

    private boolean iceTrickleEnabled = false;
    private boolean sessionRemoteDescriptionSet = false;
    private final Deque<IceCandidate> sessionPendingIce = new ArrayDeque<>();

    /**
     * Optional UI listener. Set by ActiveCallActivity in onStart and
     * cleared in onStop. Cleared explicitly in dispose() too so the
     * Activity doesn't hold a reference to a defunct manager.
     */
    private UiListener uiListener;
    /**
     * Internal status observer used by {@link VoiceCallForegroundService}
     * to drive side-effects that should run regardless of whether
     * ActiveCallActivity is bound (e.g. native ringback playback in
     * Phase 3 of {@code add-native-voice-calls}). Distinct from the
     * UI listener so the two callers don't fight over the slot.
     */
    private UiListener serviceListener;
    private boolean isMuted = false;
    /**
     * Last-applied speakerphone routing. Mirrors {@link #isMuted} so
     * {@link ActiveCallActivity} can recover the correct visual state
     * after rotation, return-from-background, or relaunch from the
     * FGS notification — without polling AudioManager (which can
     * report stale values when the audio mode briefly drifts on some
     * OEMs).
     */
    private boolean isSpeakerOn = false;

    private long callStartedAtMs = 0L;
    private int durationSec = 0;

    private Runnable offerTimeoutRunnable;
    private Runnable iceTimeoutRunnable;
    private Runnable durationTickRunnable;
    /**
     * Delayed runnable that resets the manager from ENDED back to IDLE
     * so subsequent calls can begin. Scheduled by finishCall; cleared
     * when the manager is disposed or a new call starts.
     */
    private Runnable idleResetRunnable;

    private final AtomicBoolean disposed = new AtomicBoolean(false);

    public NativeVoiceCallManager(
            Context appContext,
            MessagingBridge bridge,
            List<PeerConnection.IceServer> iceServers) {
        this.appContext = appContext.getApplicationContext();
        this.bridge = bridge;
        this.iceServers = iceServers != null
            ? iceServers
            : Collections.emptyList();
    }

    // ===================================================================
    //  Public API — invoked by the FGS / plugin layer
    // ===================================================================

    /**
     * Begin an outgoing call. Builds the peer connection, captures
     * audio, creates an SDP offer, sets it as the local description,
     * and publishes the offer via the NIP-AC bridge.
     *
     * <p>Must be called on the main thread.
     */
    public void initiateCall(String callId, String peerHexLower) {
        ensureMain();
        Log.d(TAG, "initiateCall callId=" + callId
            + " peerHex=" + (peerHexLower != null && peerHexLower.length() >= 8
                ? peerHexLower.substring(0, 8) + ".." : peerHexLower));
        // Eagerly run the post-ENDED reset so a back-to-back call
        // (started inside the 1.5s ENDED display window) isn't rejected
        // for "not idle". Idempotent and a no-op if status is already
        // IDLE.
        runIdleResetIfPendingOrEnded();
        if (status != CallStatus.IDLE) {
            Log.w(TAG, "initiateCall: not idle (status=" + status + ")");
            return;
        }
        this.callId = callId;
        this.peerHex = peerHexLower;
        this.isInitiator = true;
        transitionTo(CallStatus.OUTGOING_RINGING, null);

        try {
            ensureFactory();
            buildPeerConnection();
            attachLocalAudioTrack();

            peerConnection.createOffer(new SimpleSdpObserver("createOffer") {
                @Override
                public void onCreateSuccess(final SessionDescription desc) {
                    runOnMain(() -> {
                        if (peerConnection == null) return;
                        peerConnection.setLocalDescription(
                            new SimpleSdpObserver("setLocal(offer)") {
                                @Override public void onSetSuccess() {
                                    runOnMain(() -> {
                                        if (status != CallStatus.OUTGOING_RINGING) return;
                                        bridge.sendOffer(peerHex, callId, desc.description);
                                    });
                                }
                            },
                            desc
                        );
                    });
                }
            }, audioCallSdpConstraints());

            scheduleOfferTimeout();
        } catch (Throwable t) {
            Log.e(TAG, "initiateCall failed", t);
            emitError("initiate-failed", t.getMessage());
            handleFatal("error");
        }
    }

    /**
     * Accept the pending incoming call. The remote SDP offer is
     * supplied by the FGS (read from
     * {@code nospeak_pending_incoming_call} SharedPreferences). Builds
     * the peer connection, sets the offer as remote description,
     * captures audio, creates and publishes an SDP answer.
     *
     * <p>Must be called on the main thread.
     */
    public void acceptIncomingCall(String callId, String peerHexLower, String offerSdp) {
        ensureMain();
        Log.d(TAG, "acceptIncomingCall callId=" + callId
            + " peerHex=" + (peerHexLower != null && peerHexLower.length() >= 8
                ? peerHexLower.substring(0, 8) + ".." : peerHexLower)
            + " sdpLen=" + (offerSdp != null ? offerSdp.length() : 0));
        // Eagerly run the post-ENDED reset so an Accept inside the 1.5s
        // ENDED display window isn't rejected for "not idle/ringing".
        runIdleResetIfPendingOrEnded();
        if (status != CallStatus.IDLE && status != CallStatus.INCOMING_RINGING) {
            Log.w(TAG, "acceptIncomingCall: not idle/ringing (status=" + status + ")");
            return;
        }
        this.callId = callId;
        this.peerHex = peerHexLower;
        this.isInitiator = false;
        transitionTo(CallStatus.CONNECTING, null);

        try {
            ensureFactory();
            buildPeerConnection();

            SessionDescription remote = new SessionDescription(
                SessionDescription.Type.OFFER, offerSdp);
            peerConnection.setRemoteDescription(
                new SimpleSdpObserver("setRemote(offer)") {
                    @Override public void onSetSuccess() {
                        runOnMain(() -> {
                            sessionRemoteDescriptionSet = true;
                            drainSessionPendingIce();
                            attachLocalAudioTrack();
                            createAndSendAnswer();
                        });
                    }
                },
                remote
            );

            scheduleIceTimeout();
        } catch (Throwable t) {
            Log.e(TAG, "acceptIncomingCall failed", t);
            emitError("accept-failed", t.getMessage());
            handleFatal("error");
        }
    }

    /** Mark the manager as ringing for an incoming call (no media setup yet). */
    public void notifyIncomingRinging(String callId, String peerHexLower) {
        ensureMain();
        runIdleResetIfPendingOrEnded();
        if (status != CallStatus.IDLE) return;
        this.callId = callId;
        this.peerHex = peerHexLower;
        this.isInitiator = false;
        transitionTo(CallStatus.INCOMING_RINGING, null);
    }

    /** Inbound NIP-AC kind-25051 (Answer) for our outgoing call. */
    public void handleRemoteAnswer(String incomingCallId, String sdp) {
        ensureMain();
        if (callMismatch(incomingCallId) || peerConnection == null) return;
        if (status != CallStatus.OUTGOING_RINGING && status != CallStatus.CONNECTING) {
            Log.w(TAG, "handleRemoteAnswer: unexpected status=" + status);
            return;
        }
        if (status == CallStatus.OUTGOING_RINGING) {
            transitionTo(CallStatus.CONNECTING, null);
        }
        SessionDescription remote = new SessionDescription(
            SessionDescription.Type.ANSWER, sdp);
        peerConnection.setRemoteDescription(
            new SimpleSdpObserver("setRemote(answer)") {
                @Override public void onSetSuccess() {
                    runOnMain(() -> {
                        sessionRemoteDescriptionSet = true;
                        drainSessionPendingIce();
                    });
                }
            },
            remote
        );
        scheduleIceTimeout();
    }

    /** Inbound NIP-AC kind-25052 (ICE candidate). */
    public void handleRemoteIceCandidate(
            String incomingCallId,
            String candidate,
            String sdpMid,
            Integer sdpMLineIndex) {
        ensureMain();
        if (callMismatch(incomingCallId)) return;
        IceCandidate ice = new IceCandidate(
            sdpMid != null ? sdpMid : "",
            sdpMLineIndex != null ? sdpMLineIndex : 0,
            candidate
        );
        if (peerConnection == null || !sessionRemoteDescriptionSet) {
            // Buffer until setRemoteDescription resolves so addIceCandidate
            // is never called before the remote SDP is in place.
            sessionPendingIce.addLast(ice);
            return;
        }
        peerConnection.addIceCandidate(ice);
    }

    /** Inbound NIP-AC kind-25053 (Hangup). */
    public void handleRemoteHangup(String incomingCallId, String reason) {
        ensureMain();
        if (callMismatch(incomingCallId)) return;
        finishCall(reason != null ? reason : "hangup", /* sendHangup= */ false);
    }

    /** Inbound NIP-AC kind-25054 (Reject). */
    public void handleRemoteReject(String incomingCallId, String reason) {
        ensureMain();
        if (callMismatch(incomingCallId)) return;
        // Match the JS reject path: 'busy' becomes its own end reason; any
        // other reason is treated as a generic 'rejected'.
        String endReason = "busy".equalsIgnoreCase(reason) ? "busy" : "rejected";
        finishCall(endReason, /* sendHangup= */ false);
    }

    /** User-initiated hangup from the active-call UI. */
    public void hangup() {
        ensureMain();
        finishCall("hangup", /* sendHangup= */ true);
    }

    /** User-initiated decline from the incoming-ringing UI. */
    public void decline() {
        ensureMain();
        if (status != CallStatus.INCOMING_RINGING) {
            Log.w(TAG, "decline: not in incoming-ringing (status=" + status + ")");
            return;
        }
        if (peerHex != null && callId != null) {
            try { bridge.sendReject(peerHex, callId); } catch (Throwable t) {
                Log.w(TAG, "decline: sendReject failed", t);
            }
        }
        finishCall("rejected", /* sendHangup= */ false);
    }

    /** Toggle local microphone mute. Idempotent. */
    public void setMuted(boolean muted) {
        ensureMain();
        isMuted = muted;
        if (localAudioTrack != null) {
            try { localAudioTrack.setEnabled(!muted); } catch (Throwable t) {
                Log.w(TAG, "setMuted: setEnabled failed", t);
            }
        }
        AndroidVoiceCallPlugin.emitMuteStateChanged(callId, muted);
        notifyMuteChanged(uiListener, muted, "uiListener");
        notifyMuteChanged(serviceListener, muted, "serviceListener");
    }

    /** Current mute state. Used by ActiveCallActivity on bind. */
    public boolean isMuted() {
        return isMuted;
    }

    /**
     * Package-private listener-emission helper. Extracted so the
     * try/catch contract (a throwing listener does NOT propagate) can
     * be unit-tested without spinning up a real {@link Looper} or
     * WebRTC stack. Production callers in {@link #setMuted} go through
     * this method too — the test path and prod path are the same.
     */
    static void notifyMuteChanged(UiListener listener, boolean muted, String label) {
        if (listener == null) return;
        try { listener.onMuteChanged(muted); } catch (Throwable t) {
            Log.w(TAG, (label != null ? label : "listener") + ".onMuteChanged failed", t);
        }
    }

    /** See {@link #notifyMuteChanged}. */
    static void notifySpeakerChanged(UiListener listener, boolean speakerOn, String label) {
        if (listener == null) return;
        try { listener.onSpeakerChanged(speakerOn); } catch (Throwable t) {
            Log.w(TAG, (label != null ? label : "listener") + ".onSpeakerChanged failed", t);
        }
    }



    /**
     * Subscribe a UI listener. Replaces any previous listener (only one
     * ActiveCallActivity is supported at a time). Must be called from
     * the main thread.
     */
    public void setUiListener(UiListener listener) {
        ensureMain();
        this.uiListener = listener;
        pushInitialState(listener);
    }

    /**
     * Subscribe the service-internal status observer. Used by the FGS
     * to drive native ringback playback (Phase 3) without competing
     * with ActiveCallActivity for the {@link #uiListener} slot.
     */
    public void setServiceListener(UiListener listener) {
        ensureMain();
        this.serviceListener = listener;
        pushInitialState(listener);
    }

    private void pushInitialState(UiListener listener) {
        if (listener == null) return;
        // Don't replay ENDED on initial subscribe \u2014 the listener is
        // attaching AFTER the call finished, which usually means the
        // activity bound late (manager raced to ENDED before bind). The
        // activity's onServiceConnected does its own getStatus()==ENDED
        // check and finishes immediately without showing ENDED text.
        // Pushing ENDED here would trigger ActiveCallActivity's 1.5s
        // postDelayed(finishAndRemoveTask) and produce the visible
        // "flicker" symptom users reported.
        if (status == CallStatus.ENDED) {
            Log.d(TAG, "pushInitialState: skipping ENDED replay; listener will finish");
            return;
        }
        Log.d(TAG, "pushInitialState: status=" + status);
        try {
            listener.onStatusChanged(status, null);
            if (status == CallStatus.ACTIVE && durationSec > 0) {
                listener.onDurationTick(durationSec);
            }
            listener.onMuteChanged(isMuted);
            listener.onSpeakerChanged(isSpeakerOn);
        } catch (Throwable t) {
            Log.w(TAG, "initial listener push failed", t);
        }
    }

    /**
     * Toggle speakerphone routing through the system AudioManager and
     * notify any registered UI/service listener. Idempotent in the
     * sense that re-setting the same state still re-emits to the
     * listener — this matches {@link #setMuted}'s contract and keeps
     * ActiveCallActivity's visual in sync if it ever drifts.
     *
     * <p>The actual audio-route change requires
     * {@link AudioManager#MODE_IN_COMMUNICATION}, which the FGS sets
     * on start ({@code VoiceCallForegroundService.configureAudioMode}).
     */
    public void setSpeakerOn(boolean on) {
        ensureMain();
        isSpeakerOn = on;
        try {
            AudioManager am = (AudioManager) appContext.getSystemService(
                Context.AUDIO_SERVICE);
            if (am != null) am.setSpeakerphoneOn(on);
        } catch (Throwable t) {
            Log.w(TAG, "setSpeakerOn failed", t);
        }
        notifySpeakerChanged(uiListener, on, "uiListener");
        notifySpeakerChanged(serviceListener, on, "serviceListener");
    }

    /** Current speakerphone state. Used by ActiveCallActivity on bind. */
    public boolean isSpeakerOn() {
        return isSpeakerOn;
    }

    /**
     * Current state-machine status. Inspected by
     * {@link VoiceCallForegroundService} after invoking
     * {@link #initiateCall} / {@link #acceptIncomingCall} to decide
     * whether to launch {@link ActiveCallActivity} \u2014 if the call
     * already finished (e.g. mic capture threw and we ran handleFatal),
     * we must NOT launch the active-call surface, otherwise
     * ActiveCallActivity's {@code pushInitialState} would observe
     * ENDED and run the 1.5s postDelayed(finishAndRemoveTask) "flicker"
     * path. Also inspected by ActiveCallActivity in onServiceConnected
     * to short-circuit a late bind.
     */
    public CallStatus getStatus() { return status; }

    /** Hex pubkey of the remote peer (or null if no call is active). */
    public String getPeerHex() { return peerHex; }

    /** Identifier of the current call, or null. */
    public String getCallId() { return callId; }

    /**
     * Tear down all WebRTC resources and reset state. Called by the FGS
     * in {@code onDestroy}, and internally from {@link #finishCall}.
     * Idempotent.
     */
    public void dispose() {
        ensureMain();
        if (disposed.getAndSet(true)) return;
        uiListener = null;
        serviceListener = null;
        cancelTimeouts();
        cancelDurationTimer();
        cancelIdleReset();
        try {
            if (peerConnection != null) {
                peerConnection.close();
                peerConnection.dispose();
            }
        } catch (Throwable ignored) {}
        peerConnection = null;
        try {
            if (localAudioTrack != null) localAudioTrack.dispose();
        } catch (Throwable ignored) {}
        localAudioTrack = null;
        try {
            if (audioSource != null) audioSource.dispose();
        } catch (Throwable ignored) {}
        audioSource = null;
        try {
            if (factory != null) factory.dispose();
        } catch (Throwable ignored) {}
        factory = null;
    }

    // ===================================================================
    //  Internals
    // ===================================================================

    private void ensureMain() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            throw new IllegalStateException("must be called on main thread");
        }
    }

    private void runOnMain(Runnable r) {
        if (Looper.myLooper() == Looper.getMainLooper()) r.run();
        else mainHandler.post(r);
    }

    private boolean callMismatch(String incomingCallId) {
        if (callId == null || incomingCallId == null) return true;
        if (!callId.equals(incomingCallId)) {
            Log.d(TAG, "callMismatch: incoming=" + incomingCallId + " active=" + callId);
            return true;
        }
        return false;
    }

    private MediaConstraints audioCallSdpConstraints() {
        MediaConstraints constraints = new MediaConstraints();
        constraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "OfferToReceiveAudio", "true"));
        constraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "OfferToReceiveVideo", "false"));
        return constraints;
    }

    private void ensureFactory() {
        if (factory != null) return;
        PeerConnectionFactory.InitializationOptions initOptions =
            PeerConnectionFactory.InitializationOptions.builder(appContext)
                .setEnableInternalTracer(false)
                .createInitializationOptions();
        PeerConnectionFactory.initialize(initOptions);

        // The default JavaAudioDeviceModule routes microphone capture
        // through AudioRecord and remote playback through AudioTrack
        // (the Android platform class, not the org.webrtc one). It
        // honours the system AudioManager mode set by
        // VoiceCallForegroundService (MODE_IN_COMMUNICATION), which
        // engages OS-level acoustic-echo-cancellation.
        JavaAudioDeviceModule adm = JavaAudioDeviceModule.builder(appContext)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule();

        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(adm)
            .createPeerConnectionFactory();
        // The factory takes ownership of the ADM; we don't keep a
        // separate reference. dispose() on the factory cleans it up.
    }

    private void buildPeerConnection() {
        PeerConnection.RTCConfiguration config =
            new PeerConnection.RTCConfiguration(iceServers);
        // Use Unified Plan (the default) and enable continual gathering
        // so additional candidates trickle as the network changes.
        config.continualGatheringPolicy =
            PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY;
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        // Bundle and rtcp-mux match the WebRTC spec defaults the
        // browser uses, ensuring SDP byte parity is unaffected.
        config.bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE;
        config.rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE;

        peerConnection = factory.createPeerConnection(config, new PCObserver());
        if (peerConnection == null) {
            throw new IllegalStateException("createPeerConnection returned null");
        }
        iceTrickleEnabled = true;
        sessionRemoteDescriptionSet = false;
        sessionPendingIce.clear();
    }

    private void attachLocalAudioTrack() {
        if (localAudioTrack != null) return;
        MediaConstraints micConstraints = new MediaConstraints();
        // Match VoiceCallService.AUDIO_CONSTRAINTS:
        //   { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        micConstraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "googEchoCancellation", "true"));
        micConstraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "googNoiseSuppression", "true"));
        micConstraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "googAutoGainControl", "true"));
        audioSource = factory.createAudioSource(micConstraints);
        localAudioTrack = factory.createAudioTrack("nospeak-audio", audioSource);
        localAudioTrack.setEnabled(true);
        List<String> streamIds = new ArrayList<>(1);
        streamIds.add(localStreamId);
        peerConnection.addTrack(localAudioTrack, streamIds);
    }

    private void createAndSendAnswer() {
        if (peerConnection == null) return;
        peerConnection.createAnswer(new SimpleSdpObserver("createAnswer") {
            @Override
            public void onCreateSuccess(final SessionDescription desc) {
                runOnMain(() -> {
                    if (peerConnection == null) return;
                    peerConnection.setLocalDescription(
                        new SimpleSdpObserver("setLocal(answer)") {
                            @Override public void onSetSuccess() {
                                runOnMain(() -> {
                                    if (peerHex == null || callId == null) return;
                                    bridge.sendAnswer(peerHex, callId, desc.description);
                                });
                            }
                        },
                        desc
                    );
                });
            }
        }, audioCallSdpConstraints());
    }

    private void drainSessionPendingIce() {
        if (peerConnection == null) return;
        while (!sessionPendingIce.isEmpty()) {
            IceCandidate ice = sessionPendingIce.pollFirst();
            if (ice != null) {
                try { peerConnection.addIceCandidate(ice); } catch (Throwable t) {
                    Log.w(TAG, "drain addIceCandidate failed", t);
                }
            }
        }
    }

    /** State-machine transition helper. Always emits the corresponding plugin event. */
    private void transitionTo(CallStatus next, String reason) {
        if (status == next) return;
        Log.d(TAG, "transitionTo: " + status + " -> " + next + " reason=" + reason
            + " callId=" + callId);
        status = next;
        AndroidVoiceCallPlugin.emitCallStateChanged(callId, next.wireName(), reason);
        if (uiListener != null) {
            try { uiListener.onStatusChanged(next, reason); } catch (Throwable t) {
                Log.w(TAG, "uiListener.onStatusChanged failed", t);
            }
        }
        if (serviceListener != null) {
            try { serviceListener.onStatusChanged(next, reason); } catch (Throwable t) {
                Log.w(TAG, "serviceListener.onStatusChanged failed", t);
            }
        }
        if (next == CallStatus.ACTIVE) {
            startDurationTimer();
        }
    }

    private void emitError(String code, String message) {
        AndroidVoiceCallPlugin.emitCallError(callId, code, message);
    }

    /**
     * Single source of truth for ending a call. Sends the appropriate
     * NIP-AC signal (if {@code sendHangup} is true and a peer connection
     * was established) and authors the appropriate chat-history rumor.
     * Always tears down WebRTC resources and transitions to
     * {@link CallStatus#ENDED}.
     */
    private void finishCall(String reason, boolean sendHangup) {
        if (status == CallStatus.ENDED || disposed.get()) return;

        CallStatus prevStatus = status;
        // Send hangup if the user initiated the end and a session existed.
        if (sendHangup && peerHex != null && callId != null
            && (prevStatus == CallStatus.OUTGOING_RINGING
                || prevStatus == CallStatus.CONNECTING
                || prevStatus == CallStatus.ACTIVE)) {
            try { bridge.sendHangup(peerHex, callId, null); }
            catch (Throwable t) { Log.w(TAG, "sendHangup failed", t); }
        }

        // History rumor authoring. Mirrors VoiceCallService:
        //   active   → 'ended' with duration (BOTH peers — sendCallHistoryRumor)
        //   outgoing-ringing + caller hangup → 'cancelled' (LOCAL ONLY)
        //   incoming-ringing + remote hangup → 'missed' (LOCAL ONLY)
        //   timeout → 'no-answer' (caller; sendCallHistoryRumor)
        //   ice-failed → 'failed' (caller; sendCallHistoryRumor)
        //   busy → 'busy' (caller; sendCallHistoryRumor)
        // Local-only (cancelled / missed) are emitted via the
        // callHistoryWriteRequested plugin event so the JS layer can
        // write to messageRepo.
        try {
            authorHistoryEvent(prevStatus, reason);
        } catch (Throwable t) {
            Log.w(TAG, "authorHistoryEvent failed", t);
        }

        cancelTimeouts();
        cancelDurationTimer();
        // Tear down WebRTC, but keep callId for the final state event.
        try {
            if (peerConnection != null) {
                peerConnection.close();
                peerConnection.dispose();
            }
        } catch (Throwable ignored) {}
        peerConnection = null;
        try {
            if (localAudioTrack != null) localAudioTrack.dispose();
        } catch (Throwable ignored) {}
        localAudioTrack = null;
        try {
            if (audioSource != null) audioSource.dispose();
        } catch (Throwable ignored) {}
        audioSource = null;

        transitionTo(CallStatus.ENDED, reason);

        // Schedule the IDLE reset so subsequent calls aren't rejected
        // with "not idle". The delay matches ActiveCallActivity's
        // ENDED-display window so the user briefly sees the ended
        // status before the manager resets. Idempotent: if a new call
        // starts before this fires (unusual but possible), the reset
        // observes status != ENDED and skips.
        scheduleIdleReset();
    }

    /**
     * Schedule the post-ENDED reset to IDLE so the next call can
     * begin. The reset clears callId, peerHex, the initiator flag,
     * mute state, duration, and the ICE buffer. {@link #status}
     * silently flips to IDLE (no plugin event \u2014 the JS layer
     * already received ENDED and runs its own resetCall on the
     * Svelte store).
     */
    private void scheduleIdleReset() {
        cancelIdleReset();
        idleResetRunnable = () -> {
            idleResetRunnable = null;
            if (status != CallStatus.ENDED || disposed.get()) return;
            Log.d(TAG, "idleReset: " + status + " -> IDLE (clearing call identity)");
            status = CallStatus.IDLE;
            callId = null;
            peerHex = null;
            isInitiator = false;
            isMuted = false;
            durationSec = 0;
            callStartedAtMs = 0L;
            iceTrickleEnabled = false;
            sessionRemoteDescriptionSet = false;
            sessionPendingIce.clear();
        };
        mainHandler.postDelayed(idleResetRunnable, IDLE_RESET_DELAY_MS);
    }

    private void cancelIdleReset() {
        if (idleResetRunnable != null) {
            mainHandler.removeCallbacks(idleResetRunnable);
            idleResetRunnable = null;
        }
    }

    /**
     * Run the post-ENDED IDLE reset eagerly so a new call started
     * inside the 1.5s ENDED display window isn't rejected. Cancels
     * any pending delayed reset, runs it synchronously, then returns.
     * No-op when status is anything other than ENDED.
     */
    private void runIdleResetIfPendingOrEnded() {
        if (status != CallStatus.ENDED) return;
        Log.d(TAG, "runIdleResetIfPendingOrEnded: forcing reset before new call");
        cancelIdleReset();
        status = CallStatus.IDLE;
        callId = null;
        peerHex = null;
        isInitiator = false;
        isMuted = false;
        durationSec = 0;
        callStartedAtMs = 0L;
        iceTrickleEnabled = false;
        sessionRemoteDescriptionSet = false;
        sessionPendingIce.clear();
    }

    private void authorHistoryEvent(CallStatus prevStatus, String reason) {
        if (peerHex == null || callId == null) return;
        CallHistoryDecision d = CallHistoryDecision.decide(
            prevStatus, reason, isInitiator, peerHex, durationSec);
        switch (d.kind) {
            case GIFT_WRAP:
                bridge.sendCallHistoryRumor(
                    peerHex, d.type, d.durationSec, callId, d.initiatorHex);
                break;
            case LOCAL_ONLY:
                AndroidVoiceCallPlugin.emitCallHistoryWriteRequested(
                    callId, d.type, peerHex, d.initiatorHex, d.durationSec);
                break;
            case NONE:
            default:
                // 'rejected' / 'answered-elsewhere' / 'rejected-elsewhere' /
                // 'error' have nothing to author — see CallHistoryDecision
                // for the full mapping.
                break;
        }
    }

    // --- timeouts ---

    private void scheduleOfferTimeout() {
        cancelOfferTimeout();
        offerTimeoutRunnable = () -> {
            if (status == CallStatus.OUTGOING_RINGING) {
                Log.d(TAG, "offer timeout for callId=" + callId);
                finishCall("timeout", /* sendHangup= */ false);
            }
        };
        mainHandler.postDelayed(offerTimeoutRunnable, CALL_OFFER_TIMEOUT_MS);
    }

    private void scheduleIceTimeout() {
        cancelIceTimeout();
        iceTimeoutRunnable = () -> {
            if (status == CallStatus.CONNECTING) {
                Log.d(TAG, "ICE timeout for callId=" + callId);
                finishCall("ice-failed", /* sendHangup= */ false);
            }
        };
        mainHandler.postDelayed(iceTimeoutRunnable, ICE_CONNECTION_TIMEOUT_MS);
    }

    private void cancelOfferTimeout() {
        if (offerTimeoutRunnable != null) {
            mainHandler.removeCallbacks(offerTimeoutRunnable);
            offerTimeoutRunnable = null;
        }
    }

    private void cancelIceTimeout() {
        if (iceTimeoutRunnable != null) {
            mainHandler.removeCallbacks(iceTimeoutRunnable);
            iceTimeoutRunnable = null;
        }
    }

    private void cancelTimeouts() {
        cancelOfferTimeout();
        cancelIceTimeout();
    }

    // --- duration timer ---

    private void startDurationTimer() {
        if (durationTickRunnable != null) return;
        callStartedAtMs = System.currentTimeMillis();
        durationSec = 0;
        durationTickRunnable = new Runnable() {
            @Override public void run() {
                if (status != CallStatus.ACTIVE) return;
                durationSec = (int) ((System.currentTimeMillis() - callStartedAtMs) / 1000L);
                AndroidVoiceCallPlugin.emitDurationTick(callId, durationSec);
                if (uiListener != null) {
                    try { uiListener.onDurationTick(durationSec); } catch (Throwable t) {
                        Log.w(TAG, "uiListener.onDurationTick failed", t);
                    }
                }
                if (serviceListener != null) {
                    try { serviceListener.onDurationTick(durationSec); } catch (Throwable t) {
                        Log.w(TAG, "serviceListener.onDurationTick failed", t);
                    }
                }
                mainHandler.postDelayed(this, 1000L);
            }
        };
        mainHandler.postDelayed(durationTickRunnable, 1000L);
    }

    private void cancelDurationTimer() {
        if (durationTickRunnable != null) {
            mainHandler.removeCallbacks(durationTickRunnable);
            durationTickRunnable = null;
        }
    }

    private void handleFatal(String reason) {
        finishCall(reason, /* sendHangup= */ false);
    }

    // ===================================================================
    //  PeerConnection.Observer — runs on the WebRTC signaling thread.
    //  All state mutations are re-posted to the main thread.
    // ===================================================================

    private final class PCObserver implements PeerConnection.Observer {

        @Override
        public void onSignalingChange(PeerConnection.SignalingState newState) {
            // No-op; Unified Plan does not require manual handling.
        }

        @Override
        public void onIceConnectionChange(PeerConnection.IceConnectionState newState) {
            runOnMain(() -> {
                Log.d(TAG, "onIceConnectionChange: " + newState);
                if (newState == PeerConnection.IceConnectionState.CONNECTED
                    || newState == PeerConnection.IceConnectionState.COMPLETED) {
                    iceTrickleEnabled = false;
                    cancelIceTimeout();
                    if (status != CallStatus.ACTIVE) {
                        transitionTo(CallStatus.ACTIVE, null);
                    }
                } else if (newState == PeerConnection.IceConnectionState.FAILED
                        || newState == PeerConnection.IceConnectionState.DISCONNECTED) {
                    if (status == CallStatus.ACTIVE
                        || status == CallStatus.CONNECTING) {
                        finishCall("ice-failed", /* sendHangup= */ false);
                    }
                }
            });
        }

        @Override
        public void onIceConnectionReceivingChange(boolean receiving) { /* no-op */ }

        @Override
        public void onIceGatheringChange(PeerConnection.IceGatheringState newState) { /* no-op */ }

        @Override
        public void onIceCandidate(final IceCandidate candidate) {
            runOnMain(() -> {
                if (!iceTrickleEnabled) return;
                if (peerHex == null || callId == null || candidate == null) return;
                // Fire-and-forget: the bridge implementation is itself
                // best-effort and runs the relay publish off the main
                // thread. We don't await any future here.
                try {
                    bridge.sendIce(
                        peerHex,
                        callId,
                        candidate.sdp,
                        candidate.sdpMid,
                        candidate.sdpMLineIndex
                    );
                } catch (Throwable t) {
                    Log.w(TAG, "sendIce failed", t);
                }
            });
        }

        @Override
        public void onIceCandidatesRemoved(IceCandidate[] candidates) { /* no-op */ }

        @Override
        public void onAddStream(MediaStream stream) { /* no-op (Unified Plan uses onTrack) */ }

        @Override
        public void onRemoveStream(MediaStream stream) { /* no-op */ }

        @Override
        public void onAddTrack(RtpReceiver receiver, MediaStream[] streams) {
            // Remote audio plays automatically via the AudioDeviceModule.
            // Nothing to do here — kept for completeness.
            MediaStreamTrack track = receiver.track();
            if (track != null) {
                Log.d(TAG, "onAddTrack: remote " + track.kind() + " track received");
            }
        }

        @Override
        public void onTrack(RtpTransceiver transceiver) { /* no-op */ }

        @Override
        public void onDataChannel(DataChannel dc) { /* no-op */ }

        @Override
        public void onRenegotiationNeeded() { /* no-op */ }
    }

    /** Convenience SDP observer that logs and ignores success/failure. */
    private static class SimpleSdpObserver implements SdpObserver {
        private final String label;
        SimpleSdpObserver(String label) { this.label = label; }
        @Override public void onCreateSuccess(SessionDescription desc) { /* override */ }
        @Override public void onSetSuccess() { /* override */ }
        @Override public void onCreateFailure(String error) {
            Log.w(TAG, label + " createFailure: " + error);
        }
        @Override public void onSetFailure(String error) {
            Log.w(TAG, label + " setFailure: " + error);
        }
    }
}
