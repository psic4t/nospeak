package com.nospeak.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CameraVideoCapturer;
import org.webrtc.DataChannel;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
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
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;
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
     * Outgoing-renegotiation timeout. If the matching kind-25051 answer
     * does not arrive within this window we roll back the local offer,
     * remove just-attached upgrade artifacts, and surface a non-fatal
     * error. Mirrors the JS {@code RENEGOTIATION_TIMEOUT_MS}.
     */
    private static final long RENEGOTIATION_TIMEOUT_MS = 30_000L;
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

        /**
         * Called when the local video track has been attached for a
         * video call (after {@link #attachLocalVideoTrack}). The
         * activity uses this to {@code addSink} the track to its local
         * {@code SurfaceViewRenderer}. Default no-op for voice calls
         * and older listener doubles.
         */
        default void onLocalVideoTrack(VideoTrack track) {}

        /**
         * Called when an inbound video track arrives via
         * {@link PCObserver#onAddTrack} on a video call. The activity
         * uses this to {@code addSink} the track to its full-screen
         * {@code SurfaceViewRenderer}. Default no-op.
         */
        default void onRemoteVideoTrack(VideoTrack track) {}

        /**
         * Called when the local camera-off state flips. Default no-op
         * for voice calls and older listener doubles.
         */
        default void onCameraStateChanged(boolean cameraOff) {}

        /**
         * Called when the active camera facing mode changes (front /
         * back swap). The activity uses this to mirror the local
         * self-view renderer for front cameras only.
         */
        default void onFacingModeChanged(boolean isFrontCamera) {}

        /**
         * Called when a camera flip ({@link CameraVideoCapturer#switchCamera})
         * starts and again when it finishes (success or error). The
         * activity uses this to disable + dim the flip button while the
         * swap is in flight, matching the web's
         * {@code isCameraFlipping} flag and preventing rapid double taps
         * from queuing a second switch on top of an unfinished one.
         * Default no-op.
         */
        default void onCameraFlippingChanged(boolean flipping) {}

        /**
         * Called when the in-flight NIP-AC kind-25055 renegotiation
         * state changes. UI uses this to disable/hide the "Add video"
         * button while a renegotiation is pending. Default no-op for
         * older listener doubles.
         */
        default void onRenegotiationStateChanged(RenegotiationState state) {}
    }

    /** Media kind of a call. Mirrors the JS-side {@code CallKind} union. */
    public enum CallKind {
        VOICE,
        VIDEO;

        public String wireName() {
            return this == VIDEO ? "video" : "voice";
        }

        public static CallKind fromWireName(String s) {
            if ("video".equals(s)) return VIDEO;
            return VOICE;
        }
    }

    /**
     * State of any in-flight NIP-AC kind-25055 (Call Renegotiate)
     * exchange. Mirrors the JS-side {@code RenegotiationState} union.
     * Resets to {@link #IDLE} on every successful or failed
     * renegotiation completion and on call termination.
     */
    public enum RenegotiationState {
        IDLE,
        OUTGOING,
        INCOMING,
        GLARE;

        public String wireName() {
            switch (this) {
                case OUTGOING: return "outgoing";
                case INCOMING: return "incoming";
                case GLARE:    return "glare";
                case IDLE:
                default:       return "idle";
            }
        }
    }

    /**
     * Bridge into {@link NativeBackgroundMessagingService} for NIP-AC
     * publishing. Decouples the manager from the service's class
     * surface and makes unit testing the manager possible without
     * spinning up the full messaging stack.
     */
    public interface MessagingBridge {
        /**
         * Publish a kind-25050 NIP-AC Call Offer. {@code callKind}
         * MUST be either {@code "voice"} or {@code "video"} and is
         * emitted as the {@code call-type} tag on the inner event so
         * the receiving peer can render the correct UI before the SDP
         * is parsed. Pre-existing 3-arg implementations that hard-coded
         * {@code "voice"} caused video calls placed from Android to be
         * downgraded to voice on Web peers.
         */
        void sendOffer(String recipientHex, String callId, String sdp, String callKind);
        void sendAnswer(String recipientHex, String callId, String sdp);
        void sendIce(String recipientHex, String callId,
                     String candidate, String sdpMid, Integer sdpMLineIndex);
        void sendHangup(String recipientHex, String callId, String reason);
        void sendReject(String recipientHex, String callId);
        /**
         * Publish a kind-25055 NIP-AC Call Renegotiate. Wire shape
         * mirrors the Call Offer except no {@code call-type} tag is
         * emitted (the original 25050 owns that) and there is no
         * self-wrap. Used for mid-call SDP changes such as voice→video
         * upgrade. Phase 3 of the {@code add-call-renegotiation}
         * change adds this method to the bridge; Phase 5 wires the
         * outgoing flow from {@link NativeVoiceCallManager}.
         */
        void sendRenegotiate(String recipientHex, String callId, String sdp);
        /**
         * Author a kind-1405 call-history rumor that should be sent to
         * BOTH peers (via NIP-59 self-wrap). Types in {@code ended,
         * no-answer, declined, busy, failed}. Best-effort; a failure
         * does not affect the call outcome. {@code callMediaType} is
         * either {@code "voice"} or {@code "video"} and becomes the
         * {@code call-media-type} tag on the rumor.
         */
        void sendCallHistoryRumor(
            String recipientHex,
            String type,
            int durationSec,
            String callId,
            String initiatorHex,
            String callMediaType
        );

        /**
         * Drain the {@link NativeBackgroundMessagingService}'s global
         * pre-session ICE buffer for the given sender pubkey. Returns
         * candidates that arrived before this manager existed for the
         * peer (typically: ICE trickled during the FSI ringer window
         * before the user accepted). The buffer's per-peer entries
         * are removed by the call. Returns an empty list when no
         * candidates were buffered or when the bridge cannot reach
         * the messaging service. Default no-op for older bridges and
         * test doubles. Part of NIP-AC §"ICE Candidate Buffering"
         * compliance.
         */
        default java.util.List<GlobalIceBuffer.IceCandidatePayload> drainPreSessionIce(
                String senderHex) {
            return java.util.Collections.emptyList();
        }
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

    /**
     * Shared OpenGL context for video encode/decode and renderer surfaces.
     * Created lazily inside {@link #ensureFactory(CallKind)} for video
     * calls; released in {@link #dispose()}. {@link ActiveCallActivity}
     * retrieves this via {@link #getRootEglBase()} so the renderers
     * share the same GL state as the encoder/decoder factories.
     */
    private EglBase rootEglBase;

    /** Local camera capture pipeline. Populated by {@link #attachLocalVideoTrack()}. */
    private VideoSource videoSource;
    private VideoTrack localVideoTrack;
    private CameraVideoCapturer videoCapturer;
    private SurfaceTextureHelper surfaceTextureHelper;
    /** First inbound video track, if any. Populated by {@link PCObserver#onAddTrack}. */
    private VideoTrack remoteVideoTrack;

    /** Call identity. Set in {@link #initiateCall} / {@link #acceptCall}. */
    private String callId;
    /** Hex pubkey of the remote peer. */
    private String peerHex;
    private CallStatus status = CallStatus.IDLE;
    private CallKind callKind = CallKind.VOICE;
    private boolean isInitiator;
    /** Whether the local video track is currently disabled. */
    private boolean isCameraOff = false;
    /** Whether the active camera is the front-facing one. */
    private boolean isFrontCamera = true;
    /**
     * True while a {@link CameraVideoCapturer#switchCamera} is in
     * flight. Set before the call, cleared in both the success and
     * error handlers, and pushed to listeners so the active-call UI
     * can dim/disable the flip button — matching the web's
     * {@code isCameraFlipping} flag and preventing rapid double taps
     * from queuing a second switch on top of an unfinished one.
     */
    private boolean isCameraFlipping = false;

    private boolean iceTrickleEnabled = false;
    private boolean sessionRemoteDescriptionSet = false;
    private final Deque<IceCandidate> sessionPendingIce = new ArrayDeque<>();

    /**
     * Current state of any in-flight NIP-AC kind-25055 renegotiation.
     * IDLE outside of a renegotiation; OUTGOING after we publish a
     * 25055 and before the matching 25051 arrives; INCOMING while we
     * apply a peer's 25055 and publish the answer; GLARE on the
     * winning side after detecting glare while we wait for our
     * outgoing answer.
     */
    private RenegotiationState renegotiationState = RenegotiationState.IDLE;

    /**
     * Pending {@code Runnable} that fires after
     * {@link #RENEGOTIATION_TIMEOUT_MS} if our outgoing renegotiation
     * never receives an answer. Triggers the rollback path. Cleared
     * by a successful renegotiation answer or by manual rollback.
     */
    private Runnable renegotiationTimeoutRunnable;

    /**
     * Video track attached to the peer connection as part of an
     * outgoing voice→video upgrade. Captured here so the rollback
     * path can stop and remove it cleanly when the renegotiation
     * fails (timeout, glare loss, error, peer decline).
     */
    private VideoTrack renegotiationPendingVideoTrack;

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

    /**
     * Delay before stopping the hosting FGS after a call ends.
     * Matches ActiveCallActivity's ENDED-display window (the activity
     * shows "Call ended" for 1500 ms before finishing) so the in-call
     * surface and the CallStyle ongoing-call notification disappear
     * together rather than the notification vanishing first.
     */
    private static final long FGS_STOP_DELAY_MS = 1500L;

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
        initiateCall(callId, peerHexLower, CallKind.VOICE);
    }

    /**
     * Begin an outgoing call with an explicit media kind. For
     * {@link CallKind#VIDEO} the manager additionally captures the
     * front camera, attaches a video track to the peer connection,
     * and sets {@code OfferToReceiveVideo=true} on the SDP
     * constraints.
     *
     * <p>Must be called on the main thread.
     */
    public void initiateCall(String callId, String peerHexLower, CallKind kind) {
        ensureMain();
        Log.d(TAG, "initiateCall callId=" + callId
            + " peerHex=" + (peerHexLower != null && peerHexLower.length() >= 8
                ? peerHexLower.substring(0, 8) + ".." : peerHexLower)
            + " kind=" + (kind != null ? kind : CallKind.VOICE));
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
        this.callKind = kind != null ? kind : CallKind.VOICE;
        this.isInitiator = true;
        transitionTo(CallStatus.OUTGOING_RINGING, null);

        try {
            ensureFactory(this.callKind);
            buildPeerConnection();
            // Defensive: drain any global pre-session ICE for this peer.
            // For outgoing calls the manager exists from the start so
            // this is normally a no-op, but a brief race where the
            // manager was momentarily null between calls could leave
            // stragglers. Idempotent.
            drainGlobalPreSessionIceForPeer();
            attachLocalAudioTrack();
            if (this.callKind == CallKind.VIDEO) {
                attachLocalVideoTrack();
            }

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
                                        bridge.sendOffer(
                                            peerHex,
                                            callId,
                                            desc.description,
                                            callKind != null ? callKind.wireName() : CallKind.VOICE.wireName());
                                    });
                                }
                            },
                            desc
                        );
                    });
                }
            }, sdpConstraintsFor(this.callKind));

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
        acceptIncomingCall(callId, peerHexLower, offerSdp, CallKind.VOICE);
    }

    /**
     * Accept the pending incoming call with an explicit kind. For
     * {@link CallKind#VIDEO} the manager attaches a local camera
     * track in addition to audio before sending the answer.
     */
    public void acceptIncomingCall(
            String callId,
            String peerHexLower,
            String offerSdp,
            CallKind kind) {
        ensureMain();
        Log.d(TAG, "acceptIncomingCall callId=" + callId
            + " peerHex=" + (peerHexLower != null && peerHexLower.length() >= 8
                ? peerHexLower.substring(0, 8) + ".." : peerHexLower)
            + " sdpLen=" + (offerSdp != null ? offerSdp.length() : 0)
            + " kind=" + (kind != null ? kind : CallKind.VOICE));
        // Eagerly run the post-ENDED reset so an Accept inside the 1.5s
        // ENDED display window isn't rejected for "not idle/ringing".
        runIdleResetIfPendingOrEnded();
        if (status != CallStatus.IDLE && status != CallStatus.INCOMING_RINGING) {
            Log.w(TAG, "acceptIncomingCall: not idle/ringing (status=" + status + ")");
            return;
        }
        this.callId = callId;
        this.peerHex = peerHexLower;
        this.callKind = kind != null ? kind : CallKind.VOICE;
        this.isInitiator = false;
        transitionTo(CallStatus.CONNECTING, null);

        try {
            ensureFactory(this.callKind);
            buildPeerConnection();
            // Drain any ICE candidates that arrived during the FSI ringer
            // window (before this manager existed for the peer) into the
            // per-session pending-ICE buffer. They will be flushed to the
            // peer connection when setRemoteDescription resolves below.
            // Part of NIP-AC §"ICE Candidate Buffering" compliance.
            drainGlobalPreSessionIceForPeer();

            SessionDescription remote = new SessionDescription(
                SessionDescription.Type.OFFER, offerSdp);
            peerConnection.setRemoteDescription(
                new SimpleSdpObserver("setRemote(offer)") {
                    @Override public void onSetSuccess() {
                        runOnMain(() -> {
                            sessionRemoteDescriptionSet = true;
                            drainSessionPendingIce();
                            attachLocalAudioTrack();
                            if (callKind == CallKind.VIDEO) {
                                attachLocalVideoTrack();
                            }
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

    /**
     * Drain the messaging service's global pre-session ICE buffer for
     * the current {@link #peerHex} into the per-session pending-ICE
     * deque. Candidates are added to {@code sessionPendingIce} in
     * arrival order so the existing {@link #drainSessionPendingIce}
     * flush (called after {@code setRemoteDescription} resolves)
     * applies them to the peer connection in order. Part of NIP-AC
     * §"ICE Candidate Buffering" compliance — see
     * {@link GlobalIceBuffer}.
     *
     * <p>No-op when {@link #peerHex} is null or the bridge returns
     * an empty list.
     */
    private void drainGlobalPreSessionIceForPeer() {
        if (peerHex == null || bridge == null) return;
        List<GlobalIceBuffer.IceCandidatePayload> drained =
            bridge.drainPreSessionIce(peerHex);
        if (drained == null || drained.isEmpty()) return;
        for (GlobalIceBuffer.IceCandidatePayload p : drained) {
            IceCandidate ice = new IceCandidate(
                p.sdpMid != null ? p.sdpMid : "",
                p.sdpMLineIndex != null ? p.sdpMLineIndex : 0,
                p.candidate
            );
            sessionPendingIce.addLast(ice);
        }
        Log.d(TAG, "drained " + drained.size()
            + " pre-session ICE candidate(s) for peerHex="
            + peerHex.substring(0, Math.min(8, peerHex.length())));
    }

    /** Mark the manager as ringing for an incoming call (no media setup yet). */
    public void notifyIncomingRinging(String callId, String peerHexLower) {
        notifyIncomingRinging(callId, peerHexLower, CallKind.VOICE);
    }

    /**
     * Mark the manager as ringing for an incoming call with an explicit
     * kind. The kind is preserved through accept so the manager
     * negotiates the correct media constraints when the user taps
     * accept.
     */
    public void notifyIncomingRinging(String callId, String peerHexLower, CallKind kind) {
        ensureMain();
        runIdleResetIfPendingOrEnded();
        if (status != CallStatus.IDLE) return;
        this.callId = callId;
        this.peerHex = peerHexLower;
        this.callKind = kind != null ? kind : CallKind.VOICE;
        this.isInitiator = false;
        transitionTo(CallStatus.INCOMING_RINGING, null);
    }

    /**
     * Inbound NIP-AC kind-25051 (Answer). Handles two distinct flows
     * sharing the kind:
     *
     * <ol>
     *   <li>Initial answer to our original kind-25050 offer. Status is
     *       {@link CallStatus#OUTGOING_RINGING} → transition to
     *       {@link CallStatus#CONNECTING}.</li>
     *   <li>Renegotiation answer to a kind-25055 we sent during an
     *       active call. {@link #renegotiationState} is
     *       {@link RenegotiationState#OUTGOING} → apply the SDP
     *       without touching the call status; flip {@link #callKind}
     *       to {@link CallKind#VIDEO} if the answer accepted the
     *       upgraded video m-line.</li>
     * </ol>
     *
     * <p>Other states drop silently. Wrong call-id drops silently.
     */
    public void handleRemoteAnswer(String incomingCallId, String sdp) {
        ensureMain();
        if (callMismatch(incomingCallId) || peerConnection == null) return;

        // Renegotiation answer path.
        if (renegotiationState == RenegotiationState.OUTGOING) {
            final String answerSdp = sdp != null ? sdp : "";
            SessionDescription remote = new SessionDescription(
                SessionDescription.Type.ANSWER, answerSdp);
            peerConnection.setRemoteDescription(
                new SimpleSdpObserver("setRemote(reneg-answer)") {
                    @Override public void onSetSuccess() {
                        runOnMain(() -> completeOutgoingRenegotiation(answerSdp));
                    }
                    @Override public void onSetFailure(String error) {
                        runOnMain(() -> rollbackOutgoingRenegotiation("error"));
                    }
                },
                remote
            );
            return;
        }

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

    /**
     * Inbound NIP-AC kind-25055 (Call Renegotiate). Mid-call SDP change
     * from the peer (e.g., voice→video upgrade).
     *
     * <p>Status guard: only applied in {@link CallStatus#CONNECTING} or
     * {@link CallStatus#ACTIVE}. Other statuses drop silently.
     *
     * <p>Glare: if the local peer connection's signaling state is
     * HAVE_LOCAL_OFFER, we have a pending outgoing renegotiation. The
     * NIP-AC spec resolves glare by lowercase-hex pubkey lex compare
     * — the higher pubkey wins. If we win, drop the peer's offer and
     * keep waiting for our answer. If we lose, roll back the local
     * offer, discard our outgoing-upgrade artifacts, and accept the
     * peer's offer as a normal incoming renegotiation.
     */
    public void handleRemoteRenegotiate(String incomingCallId, String sdp) {
        ensureMain();
        if (callMismatch(incomingCallId)) return;
        if (status != CallStatus.CONNECTING && status != CallStatus.ACTIVE) {
            Log.w(TAG, "handleRemoteRenegotiate: dropping; status=" + status);
            return;
        }
        if (peerConnection == null) {
            Log.w(TAG, "handleRemoteRenegotiate: no peer connection — dropping");
            return;
        }

        final String offerSdp = sdp != null ? sdp : "";

        // Glare detection.
        PeerConnection.SignalingState signalingState;
        try {
            signalingState = peerConnection.signalingState();
        } catch (Throwable t) {
            Log.w(TAG, "handleRemoteRenegotiate: signalingState() threw", t);
            return;
        }
        if (signalingState == PeerConnection.SignalingState.HAVE_LOCAL_OFFER) {
            // Determine our local pubkey hex. The native messaging
            // service knows the local user's pubkey; the manager itself
            // does not have a direct handle on it, but can fetch it via
            // NativeBackgroundMessagingService.getCurrentPubkeyHex if
            // available.
            String selfHex = resolveSelfHexLowercase();
            String theirHex = peerHex != null ? peerHex.toLowerCase() : "";
            if (selfHex != null && selfHex.compareTo(theirHex) > 0) {
                // We win. Drop their offer; keep waiting for theirs.
                Log.i(TAG, "[Glare] WIN — keeping outgoing offer; dropping peer 25055");
                setRenegotiationState(RenegotiationState.GLARE);
                return;
            }
            // We lose. Roll back local offer, discard upgrade artifacts,
            // then accept theirs.
            Log.i(TAG, "[Glare] LOSE — rolling back local offer; accepting peer 25055");
            try {
                // Stream-WebRTC supports rollback via SessionDescription.Type.ROLLBACK.
                peerConnection.setLocalDescription(
                    new SimpleSdpObserver("setLocal(rollback)") {},
                    new SessionDescription(SessionDescription.Type.ROLLBACK, "")
                );
            } catch (Throwable t) {
                Log.e(TAG, "[Glare] rollback failed; finishing call", t);
                handleFatal("error");
                return;
            }
            discardOutgoingRenegotiationArtifacts();
        }

        setRenegotiationState(RenegotiationState.INCOMING);

        SessionDescription remote = new SessionDescription(
            SessionDescription.Type.OFFER, offerSdp);
        final boolean offerHasVideo = sdpHasVideo(offerSdp);
        peerConnection.setRemoteDescription(
            new SimpleSdpObserver("setRemote(reneg-offer)") {
                @Override public void onSetSuccess() {
                    runOnMain(() -> {
                        // If the renegotiate adds a video m-line and we
                        // have no local video yet, opportunistically
                        // attach the camera. Failure is non-fatal: we
                        // still publish the answer; only our self-view
                        // is degraded.
                        if (offerHasVideo && localVideoTrack == null
                                && callKind != CallKind.VIDEO) {
                            try {
                                if (rootEglBase == null) {
                                    rootEglBase = EglBase.create();
                                }
                                attachLocalVideoTrack();
                            } catch (Throwable t) {
                                Log.w(TAG,
                                    "renegotiate: attachLocalVideoTrack failed",
                                    t);
                            }
                        }
                        createAndSendRenegotiationAnswer(offerHasVideo);
                    });
                }

                @Override public void onSetFailure(String error) {
                    runOnMain(() -> {
                        Log.e(TAG, "setRemote(reneg-offer) failed: " + error);
                        setRenegotiationState(RenegotiationState.IDLE);
                    });
                }
            },
            remote
        );
    }

    /**
     * User-facing entry point for the voice→video mid-call upgrade.
     * Acquires the camera, attaches a video track to the existing
     * peer connection, creates a new SDP offer, and publishes it as
     * kind 25055. Guarded — silently no-ops when the call is not
     * eligible.
     *
     * <p>The matching kind-25051 Call Answer is handled by
     * {@link #handleRemoteAnswer}'s renegotiation branch. Until that
     * answer arrives we keep the upgrade artifacts (video track,
     * sender, capturer) attached so the rollback path can clean them
     * up cleanly on timeout / error.
     */
    public void requestVideoUpgrade() {
        ensureMain();
        if (status != CallStatus.ACTIVE) {
            Log.w(TAG, "requestVideoUpgrade: not active (status=" + status + ")");
            return;
        }
        if (callKind != CallKind.VOICE) {
            Log.w(TAG, "requestVideoUpgrade: already video");
            return;
        }
        if (renegotiationState != RenegotiationState.IDLE) {
            Log.w(TAG, "requestVideoUpgrade: already renegotiating ("
                + renegotiationState + ")");
            return;
        }
        if (peerConnection == null || peerHex == null || callId == null) {
            Log.w(TAG, "requestVideoUpgrade: missing session state");
            return;
        }

        setRenegotiationState(RenegotiationState.OUTGOING);

        // Lazily widen the factory so the next createPeerConnection /
        // encoder use video paths. ensureFactory short-circuits when
        // factory is non-null, so for a call that started as voice
        // we cannot change the encoder factory — but the existing
        // factory was built with a software audio-only encoder. To
        // keep the implementation simple (and to match the JS path
        // which reuses the same RTCPeerConnection without any factory
        // swap), we proceed without rebuilding the factory: the video
        // track will use the default H.264/VP8 encoders that are
        // available in the WebRTC library even when the factory was
        // initialized voice-only.
        if (rootEglBase == null) {
            rootEglBase = EglBase.create();
        }

        try {
            attachLocalVideoTrack();
            renegotiationPendingVideoTrack = localVideoTrack;
        } catch (Throwable t) {
            Log.e(TAG, "requestVideoUpgrade: attachLocalVideoTrack failed", t);
            rollbackOutgoingRenegotiation("error");
            return;
        }

        try {
            peerConnection.createOffer(new SimpleSdpObserver("createOffer(reneg)") {
                @Override
                public void onCreateSuccess(final SessionDescription desc) {
                    runOnMain(() -> {
                        if (peerConnection == null) {
                            rollbackOutgoingRenegotiation("error");
                            return;
                        }
                        peerConnection.setLocalDescription(
                            new SimpleSdpObserver("setLocal(reneg-offer)") {
                                @Override public void onSetSuccess() {
                                    runOnMain(() -> {
                                        if (peerHex == null || callId == null) return;
                                        try {
                                            bridge.sendRenegotiate(
                                                peerHex, callId, desc.description);
                                        } catch (Throwable t) {
                                            Log.w(TAG,
                                                "bridge.sendRenegotiate failed",
                                                t);
                                        }
                                        scheduleRenegotiationTimeout();
                                    });
                                }

                                @Override public void onSetFailure(String error) {
                                    runOnMain(() -> {
                                        Log.e(TAG,
                                            "setLocal(reneg-offer) failed: "
                                                + error);
                                        rollbackOutgoingRenegotiation("error");
                                    });
                                }
                            },
                            desc
                        );
                    });
                }

                @Override public void onCreateFailure(String error) {
                    runOnMain(() -> {
                        Log.e(TAG, "createOffer(reneg) failed: " + error);
                        rollbackOutgoingRenegotiation("error");
                    });
                }
            }, sdpConstraintsFor(CallKind.VIDEO));
        } catch (Throwable t) {
            Log.e(TAG, "requestVideoUpgrade failed", t);
            rollbackOutgoingRenegotiation("error");
        }
    }

    /** Current renegotiation state. Used by ActiveCallActivity on bind. */
    public RenegotiationState getRenegotiationState() {
        return renegotiationState;
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
     * Package-private listener-emission helper for the renegotiation
     * state. See {@link #notifyMuteChanged} — same try/catch contract.
     * Extracted so unit tests can verify safe behavior without spinning
     * up a Looper or WebRTC stack.
     */
    static void notifyRenegotiationStateChanged(
            UiListener listener, RenegotiationState state, String label) {
        if (listener == null) return;
        try { listener.onRenegotiationStateChanged(state); } catch (Throwable t) {
            Log.w(TAG, (label != null ? label : "listener")
                + ".onRenegotiationStateChanged failed", t);
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
            // Replay flip-in-flight state too so a late bind (rotation,
            // return-from-background) doesn't leave the UI looking
            // tappable while a switchCamera is still running.
            listener.onCameraFlippingChanged(isCameraFlipping);
            // Replay renegotiation state so a UI binding mid-upgrade
            // shows the in-flight chrome immediately rather than
            // waiting for the next state transition.
            listener.onRenegotiationStateChanged(renegotiationState);
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
     * on the transition to {@link CallStatus#CONNECTING} (NOT on FGS
     * start — see {@code VoiceCallForegroundService.configureAudioMode}
     * for the rationale). A {@code setSpeakerOn} call made earlier
     * (e.g. while the call is in {@link CallStatus#OUTGOING_RINGING})
     * still updates {@link #isSpeakerOn} but the underlying
     * {@code setSpeakerphoneOn} won't take effect until the FGS
     * re-applies the routing on the mode transition.
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
     * True iff the manager is currently committed to a call — i.e. any
     * status other than {@link CallStatus#IDLE} and
     * {@link CallStatus#ENDED}. Used by {@link NativeBackgroundMessagingService}
     * to decide whether an inbound kind-25050 offer with a different
     * call-id should be auto-rejected with {@code "busy"} per NIP-AC
     * §"Busy Rejection".
     *
     * <p>{@link CallStatus#ENDED} is treated as not-busy because the
     * manager will reset to {@link CallStatus#IDLE} after
     * {@link #IDLE_RESET_DELAY_MS} and any incoming offer arriving in
     * that window should be allowed to ring normally rather than be
     * auto-rejected.
     */
    public boolean isBusy() {
        CallStatus s = this.status;
        return s != CallStatus.IDLE && s != CallStatus.ENDED;
    }

    /**
     * NIP-AC §"Multi-Device Support": end the current call with reason
     * {@code "answered-elsewhere"} when another device of the same user
     * has accepted the same incoming call. Idempotent and call-id
     * guarded — a stale event with a non-matching call-id is dropped.
     * No wire event is sent in response.
     */
    public void endForAnsweredElsewhere(String incomingCallId) {
        ensureMain();
        if (callMismatch(incomingCallId)) return;
        // Only meaningful while ringing; outside that window the call
        // is already past the multi-device-dismiss point.
        if (status != CallStatus.INCOMING_RINGING) return;
        finishCall("answered-elsewhere", /* sendHangup= */ false);
    }

    /**
     * NIP-AC §"Multi-Device Support": end the current call with reason
     * {@code "rejected-elsewhere"} when another device of the same user
     * has rejected the same incoming call. Idempotent and call-id
     * guarded. No wire event is sent in response.
     */
    public void endForRejectedElsewhere(String incomingCallId) {
        ensureMain();
        if (callMismatch(incomingCallId)) return;
        if (status != CallStatus.INCOMING_RINGING) return;
        finishCall("rejected-elsewhere", /* sendHangup= */ false);
    }

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
        clearRenegotiationTimeout();
        renegotiationPendingVideoTrack = null;
        renegotiationState = RenegotiationState.IDLE;
        // Stop and dispose the camera capturer first so frames stop
        // flowing into the (about-to-be-disposed) video source.
        try {
            if (videoCapturer != null) {
                videoCapturer.stopCapture();
                videoCapturer.dispose();
            }
        } catch (Throwable ignored) {}
        videoCapturer = null;
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
            if (localVideoTrack != null) localVideoTrack.dispose();
        } catch (Throwable ignored) {}
        localVideoTrack = null;
        try {
            if (videoSource != null) videoSource.dispose();
        } catch (Throwable ignored) {}
        videoSource = null;
        try {
            if (surfaceTextureHelper != null) surfaceTextureHelper.dispose();
        } catch (Throwable ignored) {}
        surfaceTextureHelper = null;
        remoteVideoTrack = null;
        try {
            if (factory != null) factory.dispose();
        } catch (Throwable ignored) {}
        factory = null;
        try {
            if (rootEglBase != null) rootEglBase.release();
        } catch (Throwable ignored) {}
        rootEglBase = null;
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

    /** Backward-compat alias for voice-only callers. */
    private MediaConstraints audioCallSdpConstraints() {
        return sdpConstraintsFor(CallKind.VOICE);
    }

    private MediaConstraints sdpConstraintsFor(CallKind kind) {
        MediaConstraints constraints = new MediaConstraints();
        constraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "OfferToReceiveAudio", "true"));
        constraints.mandatory.add(new MediaConstraints.KeyValuePair(
            "OfferToReceiveVideo", kind == CallKind.VIDEO ? "true" : "false"));
        return constraints;
    }

    /** Backward-compat alias for callers that don't yet know the kind. */
    private void ensureFactory() {
        ensureFactory(CallKind.VOICE);
    }

    private void ensureFactory(CallKind kind) {
        if (factory != null) {
            // If a previous voice call left the factory without a
            // video encoder/decoder, we'd normally need to dispose and
            // re-create it. In practice the manager is fully torn down
            // between calls (finishCall + idleReset, or dispose), so
            // the factory is always built fresh against the right kind.
            return;
        }
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
        // engages OS-level acoustic-echo-cancellation. The FGS sets
        // that mode on the transition to CONNECTING — i.e. by the
        // time the ADM begins exchanging real audio with the peer
        // post-answer, MODE_IN_COMMUNICATION is in effect. During
        // OUTGOING_RINGING the ADM's capture goes nowhere (no remote
        // peer yet) so running it briefly under MODE_NORMAL is
        // harmless and keeps STREAM_RING ringback un-ducked.
        JavaAudioDeviceModule adm = JavaAudioDeviceModule.builder(appContext)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule();

        PeerConnectionFactory.Builder builder = PeerConnectionFactory.builder()
            .setAudioDeviceModule(adm);

        if (kind == CallKind.VIDEO) {
            // EglBase is shared with ActiveCallActivity's renderers
            // via getRootEglBase(). Encoder/decoder factories must be
            // initialized with the same context so frames don't have
            // to be copied between GL contexts.
            if (rootEglBase == null) {
                rootEglBase = EglBase.create();
            }
            // H264 high profile is intentionally disabled. Some browsers
            // (notably older Chromium on Linux) and a number of Android
            // SoC decoders cannot decode H264 high profile, which results
            // in silent black-frame video when our encoder advertises
            // and selects it. Restricting to baseline keeps us aligned
            // with what every WebRTC stack must support and avoids the
            // need for any SDP munging on the wire.
            builder.setVideoEncoderFactory(new DefaultVideoEncoderFactory(
                rootEglBase.getEglBaseContext(),
                /* enableIntelVp8Encoder= */ true,
                /* enableH264HighProfile= */ false));
            builder.setVideoDecoderFactory(new DefaultVideoDecoderFactory(
                rootEglBase.getEglBaseContext()));
        }

        factory = builder.createPeerConnectionFactory();
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

    /**
     * Capture from the front-facing camera and attach the track to the
     * peer connection. Mirrors the JS-side video constraints
     * (640x480 @ 30fps). Idempotent.
     */
    private void attachLocalVideoTrack() {
        if (localVideoTrack != null) {
            Log.d(TAG, "attachLocalVideoTrack: already attached, skipping");
            return;
        }
        if (rootEglBase == null) {
            // Should have been created in ensureFactory(VIDEO); guard
            // against an unusual call order (e.g. direct unit tests).
            Log.w(TAG, "attachLocalVideoTrack: rootEglBase null at entry; lazy-creating");
            rootEglBase = EglBase.create();
        }

        CameraEnumerator enumerator = new Camera2Enumerator(appContext);
        String[] deviceNames = enumerator.getDeviceNames();
        Log.d(TAG, "attachLocalVideoTrack: camera devices="
            + (deviceNames != null ? deviceNames.length : 0));
        String cameraName = chooseCameraName(enumerator, /* front= */ isFrontCamera);
        if (cameraName == null) {
            Log.w(TAG, "attachLocalVideoTrack: no camera available");
            return;
        }
        Log.d(TAG, "attachLocalVideoTrack: using camera=" + cameraName
            + " front=" + isFrontCamera);
        CameraVideoCapturer capturer =
            (CameraVideoCapturer) enumerator.createCapturer(cameraName, null);
        if (capturer == null) {
            Log.w(TAG, "attachLocalVideoTrack: createCapturer returned null");
            return;
        }
        videoCapturer = capturer;

        surfaceTextureHelper = SurfaceTextureHelper.create(
            "VideoCaptureThread", rootEglBase.getEglBaseContext());
        videoSource = factory.createVideoSource(/* isScreencast= */ false);
        videoCapturer.initialize(
            surfaceTextureHelper, appContext, videoSource.getCapturerObserver());
        try {
            videoCapturer.startCapture(640, 480, 30);
            Log.d(TAG, "attachLocalVideoTrack: startCapture ok (640x480 @ 30fps)");
        } catch (Throwable t) {
            // On Android 14+ this is the most likely failure mode if
            // the FGS type bitmask doesn't include
            // FOREGROUND_SERVICE_TYPE_CAMERA — the system rejects the
            // capture request and the user sees no video.
            Log.e(TAG, "videoCapturer.startCapture failed", t);
        }

        localVideoTrack = factory.createVideoTrack("nospeak-video", videoSource);
        localVideoTrack.setEnabled(!isCameraOff);
        List<String> streamIds = new ArrayList<>(1);
        streamIds.add(localStreamId);
        peerConnection.addTrack(localVideoTrack, streamIds);
        Log.d(TAG, "attachLocalVideoTrack: addTrack ok"
            + " (uiListener=" + (uiListener != null) + ")");

        // Notify listeners so the activity can sink the local track
        // into its self-view renderer.
        deliverLocalVideoTrack(uiListener, localVideoTrack);
        deliverLocalVideoTrack(serviceListener, localVideoTrack);
        notifyFacingMode(uiListener);
        notifyFacingMode(serviceListener);
    }

    /**
     * Toggle the local video track's {@code enabled} flag. This is a
     * track-level mute (no SDP renegotiation, no capturer stop): the
     * peer simply receives black/empty frames while off.
     */
    public void setCameraOff(boolean off) {
        ensureMain();
        if (callKind != CallKind.VIDEO) return;
        if (isCameraOff == off) return;
        isCameraOff = off;
        if (localVideoTrack != null) {
            try { localVideoTrack.setEnabled(!off); } catch (Throwable t) {
                Log.w(TAG, "setEnabled on localVideoTrack failed", t);
            }
        }
        notifyCameraState(uiListener);
        notifyCameraState(serviceListener);
        try {
            AndroidVoiceCallPlugin.emitCameraStateChanged(callId, off);
        } catch (Throwable t) {
            Log.w(TAG, "emitCameraStateChanged failed", t);
        }
    }

    public boolean isCameraOff() { return isCameraOff; }
    public boolean isFrontCamera() { return isFrontCamera; }
    public boolean isCameraFlipping() { return isCameraFlipping; }

    /**
     * Switch between the front and back camera. Calls
     * {@link CameraVideoCapturer#switchCamera} which swaps which
     * physical device feeds the existing {@code VideoSource}/
     * {@code VideoTrack} — no SDP renegotiation, no track replacement.
     */
    public void flipCamera() {
        ensureMain();
        if (callKind != CallKind.VIDEO) return;
        if (videoCapturer == null) return;
        // Drop redundant taps so we don't stack a second switchCamera
        // on top of one that hasn't completed. The button is disabled
        // in the UI while flipping, but a service-side caller could
        // still hit this path.
        if (isCameraFlipping) {
            Log.d(TAG, "flipCamera: already flipping, ignoring");
            return;
        }
        isCameraFlipping = true;
        notifyCameraFlipping(uiListener);
        notifyCameraFlipping(serviceListener);
        try {
            videoCapturer.switchCamera(new CameraVideoCapturer.CameraSwitchHandler() {
                @Override
                public void onCameraSwitchDone(boolean isFront) {
                    runOnMain(() -> {
                        isFrontCamera = isFront;
                        isCameraFlipping = false;
                        notifyFacingMode(uiListener);
                        notifyFacingMode(serviceListener);
                        notifyCameraFlipping(uiListener);
                        notifyCameraFlipping(serviceListener);
                        try {
                            AndroidVoiceCallPlugin.emitFacingModeChanged(
                                callId, isFront ? "user" : "environment");
                        } catch (Throwable t) {
                            Log.w(TAG, "emitFacingModeChanged failed", t);
                        }
                    });
                }
                @Override
                public void onCameraSwitchError(String error) {
                    Log.w(TAG, "switchCamera failed: " + error);
                    runOnMain(() -> {
                        // Clear the flag on error too — otherwise the
                        // UI button would stay disabled forever after a
                        // single failed swap.
                        isCameraFlipping = false;
                        notifyCameraFlipping(uiListener);
                        notifyCameraFlipping(serviceListener);
                    });
                }
            });
        } catch (Throwable t) {
            Log.e(TAG, "flipCamera threw", t);
            // Synchronous throw before switchCamera even starts —
            // make sure we don't leave the flag latched.
            isCameraFlipping = false;
            notifyCameraFlipping(uiListener);
            notifyCameraFlipping(serviceListener);
        }
    }

    /** Pick the first front- or back-facing camera name from the enumerator. */
    private static String chooseCameraName(CameraEnumerator enumerator, boolean front) {
        String[] names = enumerator.getDeviceNames();
        if (names == null) return null;
        for (String name : names) {
            if (front && enumerator.isFrontFacing(name)) return name;
            if (!front && enumerator.isBackFacing(name)) return name;
        }
        // Fallback: any camera at all.
        if (names.length > 0) return names[0];
        return null;
    }

    private static void deliverLocalVideoTrack(UiListener listener, VideoTrack track) {
        if (listener == null || track == null) return;
        try { listener.onLocalVideoTrack(track); } catch (Throwable ignored) {}
    }

    private static void deliverRemoteVideoTrack(UiListener listener, VideoTrack track) {
        if (listener == null || track == null) return;
        try { listener.onRemoteVideoTrack(track); } catch (Throwable ignored) {}
    }

    private void notifyCameraState(UiListener listener) {
        if (listener == null) return;
        try { listener.onCameraStateChanged(isCameraOff); } catch (Throwable ignored) {}
    }

    private void notifyFacingMode(UiListener listener) {
        if (listener == null) return;
        try { listener.onFacingModeChanged(isFrontCamera); } catch (Throwable ignored) {}
    }

    private void notifyCameraFlipping(UiListener listener) {
        if (listener == null) return;
        try { listener.onCameraFlippingChanged(isCameraFlipping); } catch (Throwable ignored) {}
    }

    /**
     * Shared OpenGL context for use by {@link ActiveCallActivity}'s
     * SurfaceViewRenderers. The activity must NOT release this — the
     * manager owns its lifecycle and releases it in {@link #dispose()}.
     * Returns {@code null} for voice calls.
     */
    public EglBase getRootEglBase() { return rootEglBase; }

    /** Local video track for self-view rendering. {@code null} on voice calls. */
    public VideoTrack getLocalVideoTrack() { return localVideoTrack; }

    /** First inbound video track, if any. */
    public VideoTrack getRemoteVideoTrack() { return remoteVideoTrack; }

    /** Active call kind; {@code VOICE} when idle. */
    public CallKind getCallKind() { return callKind; }

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
        }, sdpConstraintsFor(callKind));
    }

    /**
     * Renegotiation answer path. Creates an SDP answer for an inbound
     * kind-25055, publishes it as kind-25051 (no special tags), and
     * — if the renegotiated SDP carries an accepted video m-line —
     * flips {@link #callKind} to {@link CallKind#VIDEO} so listeners
     * (FGS notification, ActiveCallActivity) can re-render against
     * the new media kind.
     */
    private void createAndSendRenegotiationAnswer(final boolean offerHasVideo) {
        if (peerConnection == null) {
            setRenegotiationState(RenegotiationState.IDLE);
            return;
        }
        peerConnection.createAnswer(
            new SimpleSdpObserver("createAnswer(reneg)") {
                @Override
                public void onCreateSuccess(final SessionDescription desc) {
                    runOnMain(() -> {
                        if (peerConnection == null) {
                            setRenegotiationState(RenegotiationState.IDLE);
                            return;
                        }
                        peerConnection.setLocalDescription(
                            new SimpleSdpObserver("setLocal(reneg-answer)") {
                                @Override public void onSetSuccess() {
                                    runOnMain(() -> {
                                        if (peerHex != null && callId != null) {
                                            try {
                                                bridge.sendAnswer(
                                                    peerHex, callId, desc.description);
                                            } catch (Throwable t) {
                                                Log.w(TAG,
                                                    "bridge.sendAnswer (reneg) failed",
                                                    t);
                                            }
                                        }
                                        // Flip callKind if the upgrade
                                        // succeeded on our side (our
                                        // answer carries an accepted
                                        // video m-line).
                                        boolean answerHasVideo = sdpHasVideo(desc.description);
                                        if (offerHasVideo && answerHasVideo
                                                && callKind == CallKind.VOICE) {
                                            promoteCallKindToVideo();
                                        }
                                        setRenegotiationState(RenegotiationState.IDLE);
                                    });
                                }
                                @Override public void onSetFailure(String error) {
                                    runOnMain(() -> {
                                        Log.e(TAG,
                                            "setLocal(reneg-answer) failed: " + error);
                                        setRenegotiationState(RenegotiationState.IDLE);
                                    });
                                }
                            },
                            desc
                        );
                    });
                }
                @Override public void onCreateFailure(String error) {
                    runOnMain(() -> {
                        Log.e(TAG, "createAnswer(reneg) failed: " + error);
                        setRenegotiationState(RenegotiationState.IDLE);
                    });
                }
            },
            sdpConstraintsFor(offerHasVideo ? CallKind.VIDEO : callKind)
        );
    }

    /**
     * Successful outgoing renegotiation: the peer's kind-25051 has
     * been applied. Clears the timeout, flips {@link #callKind} if
     * the answer accepted the upgraded video m-line, and resets the
     * renegotiation state.
     */
    private void completeOutgoingRenegotiation(String remoteAnswerSdp) {
        clearRenegotiationTimeout();
        renegotiationPendingVideoTrack = null;

        boolean peerAcceptedVideo = sdpHasVideo(remoteAnswerSdp)
            && !sdpDeclaresInactive(remoteAnswerSdp);
        if (peerAcceptedVideo && callKind == CallKind.VOICE) {
            promoteCallKindToVideo();
        } else if (!peerAcceptedVideo) {
            // Peer declined — discard our just-attached upgrade
            // artifacts so we're not capturing pointlessly.
            discardOutgoingRenegotiationArtifacts();
        }
        setRenegotiationState(RenegotiationState.IDLE);
    }

    /**
     * Roll back an in-flight outgoing renegotiation. Called on timeout,
     * glare-loss-from-the-loser-side, error, or peer-decline.
     * Restores the peer connection to its pre-renegotiation SDP state
     * (best effort) and removes the upgrade artifacts. The underlying
     * call continues unaffected.
     */
    private void rollbackOutgoingRenegotiation(String reason) {
        clearRenegotiationTimeout();
        if (peerConnection != null) {
            try {
                if (peerConnection.signalingState()
                        == PeerConnection.SignalingState.HAVE_LOCAL_OFFER) {
                    peerConnection.setLocalDescription(
                        new SimpleSdpObserver("setLocal(rollback)") {},
                        new SessionDescription(SessionDescription.Type.ROLLBACK, "")
                    );
                }
            } catch (Throwable t) {
                Log.w(TAG, "rollbackOutgoingRenegotiation: rollback threw", t);
            }
        }
        discardOutgoingRenegotiationArtifacts();
        Log.i(TAG, "outgoing renegotiation rolled back; reason=" + reason);
        setRenegotiationState(RenegotiationState.IDLE);
    }

    /**
     * Tear down the local video track and capturer attached during an
     * outgoing voice→video upgrade. No-op when no upgrade artifacts
     * are present (a successful upgrade null-ed the field already).
     */
    private void discardOutgoingRenegotiationArtifacts() {
        VideoTrack track = renegotiationPendingVideoTrack;
        renegotiationPendingVideoTrack = null;
        if (track == null) return;
        try { track.setEnabled(false); } catch (Throwable ignored) {}

        if (videoCapturer != null) {
            try { videoCapturer.stopCapture(); } catch (Throwable ignored) {}
            try { videoCapturer.dispose(); } catch (Throwable ignored) {}
            videoCapturer = null;
        }
        if (videoSource != null) {
            try { videoSource.dispose(); } catch (Throwable ignored) {}
            videoSource = null;
        }
        if (surfaceTextureHelper != null) {
            try { surfaceTextureHelper.dispose(); } catch (Throwable ignored) {}
            surfaceTextureHelper = null;
        }
        if (track == localVideoTrack) {
            localVideoTrack = null;
        }
    }

    /**
     * Promote the call from VOICE to VIDEO after a successful
     * voice→video upgrade. Updates the cached field, emits the
     * status event so the FGS notification re-renders, and notifies
     * UI listeners.
     */
    private void promoteCallKindToVideo() {
        if (callKind == CallKind.VIDEO) return;
        callKind = CallKind.VIDEO;
        // Notify the JS layer via a dedicated callKindChanged event so
        // subscribers (VoiceCallServiceNative.onCallKindChanged) can
        // mirror the new kind into the Svelte store. The status itself
        // doesn't change — we're still ACTIVE — so we don't re-emit
        // callStateChanged (which would shake other subscribers
        // expecting a status change).
        AndroidVoiceCallPlugin.emitCallKindChanged(
            callId, callKind.wireName());
        if (uiListener != null) {
            try { uiListener.onLocalVideoTrack(localVideoTrack); } catch (Throwable ignored) {}
        }
        // Notify the FGS so it can re-evaluate the proximity wake-lock
        // policy. Voice→video must release the proximity lock — the
        // user is now looking at the screen and we cannot turn it off
        // when they hold the device near their face. The FGS reads
        // the current callKind from the manager, so we don't pass it
        // through — the post-update read returns VIDEO.
        try {
            VoiceCallForegroundService fgs =
                VoiceCallForegroundService.getInstance();
            if (fgs != null) fgs.notifyCallKindChanged();
        } catch (Throwable t) {
            // Never let an FGS lifecycle race break the upgrade.
            Log.w(TAG, "FGS proximity lock notify failed", t);
        }
    }

    /**
     * Schedule the outgoing-renegotiation timeout. Idempotent.
     */
    private void scheduleRenegotiationTimeout() {
        clearRenegotiationTimeout();
        renegotiationTimeoutRunnable = () -> {
            renegotiationTimeoutRunnable = null;
            if (renegotiationState == RenegotiationState.OUTGOING) {
                Log.w(TAG, "renegotiation timeout — rolling back");
                rollbackOutgoingRenegotiation("timeout");
            }
        };
        mainHandler.postDelayed(renegotiationTimeoutRunnable, RENEGOTIATION_TIMEOUT_MS);
    }

    private void clearRenegotiationTimeout() {
        if (renegotiationTimeoutRunnable != null) {
            mainHandler.removeCallbacks(renegotiationTimeoutRunnable);
            renegotiationTimeoutRunnable = null;
        }
    }

    /**
     * Set {@link #renegotiationState} and notify listeners + the JS
     * layer. Idempotent transitions (same → same) are a no-op.
     */
    private void setRenegotiationState(RenegotiationState next) {
        if (renegotiationState == next) return;
        renegotiationState = next;
        AndroidVoiceCallPlugin.emitRenegotiationStateChanged(callId, next.wireName());
        notifyRenegotiationStateChanged(uiListener, next, "uiListener");
        notifyRenegotiationStateChanged(serviceListener, next, "serviceListener");
    }

    /**
     * Resolve the local user's lowercase hex pubkey for glare
     * comparison. The native messaging service knows it; we cache it
     * lazily here. Returns {@code null} if the messaging service
     * isn't available (in which case glare resolution falls through
     * to the loser path, which is the safer default — accepting the
     * peer's offer rather than dropping it).
     */
    private String resolveSelfHexLowercase() {
        try {
            String hex = NativeBackgroundMessagingService.getCurrentPubkeyHex();
            if (hex != null && !hex.isEmpty()) {
                return hex.toLowerCase();
            }
        } catch (Throwable t) {
            Log.w(TAG, "resolveSelfHexLowercase: lookup failed", t);
        }
        return null;
    }

    private static boolean sdpHasVideo(String sdp) {
        if (sdp == null) return false;
        // Match `\nm=video[ \t]` like the JS detector.
        return sdp.contains("\nm=video ") || sdp.contains("\nm=video\t");
    }

    private static boolean sdpDeclaresInactive(String sdp) {
        if (sdp == null) return false;
        return sdp.contains("\na=inactive");
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
        // Stop the camera capturer first so frames stop flowing before
        // the video source / track are disposed.
        try {
            if (videoCapturer != null) {
                videoCapturer.stopCapture();
                videoCapturer.dispose();
            }
        } catch (Throwable ignored) {}
        videoCapturer = null;
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
            if (localVideoTrack != null) localVideoTrack.dispose();
        } catch (Throwable ignored) {}
        localVideoTrack = null;
        try {
            if (videoSource != null) videoSource.dispose();
        } catch (Throwable ignored) {}
        videoSource = null;
        try {
            if (surfaceTextureHelper != null) surfaceTextureHelper.dispose();
        } catch (Throwable ignored) {}
        surfaceTextureHelper = null;
        remoteVideoTrack = null;
        // Do NOT release rootEglBase here — the manager keeps it for
        // the lifetime of the FGS so back-to-back video calls reuse
        // the same GL context. dispose() releases it.

        transitionTo(CallStatus.ENDED, reason);

        // Schedule the IDLE reset so subsequent calls aren't rejected
        // with "not idle". The delay matches ActiveCallActivity's
        // ENDED-display window so the user briefly sees the ended
        // status before the manager resets. Idempotent: if a new call
        // starts before this fires (unusual but possible), the reset
        // observes status != ENDED and skips.
        scheduleIdleReset();

        // Tell the hosting FGS to stop itself so the ongoing-call
        // CallStyle notification (and its system-managed chronometer)
        // is dismissed. Delayed by FGS_STOP_DELAY_MS so the user
        // briefly sees "Call ended" in both the activity and the
        // notification before they disappear together.
        //
        // All termination paths route through finishCall (in-app
        // hangup, remote hangup/reject, ICE failure, offer/ICE
        // timeout, programmatic JS hangup, multi-device self-events),
        // so this is the single point that guarantees the FGS stops.
        // The VoiceCallActionReceiver path also fires ACTION_STOP
        // directly (belt-and-braces); the second stopSelf() is a
        // no-op on an already-stopped service.
        //
        // Back-to-back call guard: if a new call begins inside the
        // window (status moves out of ENDED via a fresh
        // notifyIncomingRinging / initiateCall), skip the stop so
        // the new session's FGS isn't torn down.
        mainHandler.postDelayed(() -> {
            CallStatus s = status;
            if (s != CallStatus.ENDED && s != CallStatus.IDLE) {
                Log.d(TAG, "finishCall: skipping FGS stop —"
                    + " new call in progress (status=" + s + ")");
                return;
            }
            try {
                Intent stop = new Intent(appContext, VoiceCallForegroundService.class)
                    .setAction(VoiceCallForegroundService.ACTION_STOP);
                appContext.startService(stop);
            } catch (Throwable t) {
                Log.w(TAG, "finishCall: stopping FGS failed", t);
            }
        }, FGS_STOP_DELAY_MS);
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
            callKind = CallKind.VOICE;
            isCameraOff = false;
            isFrontCamera = true;
            isCameraFlipping = false;
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
        clearRenegotiationTimeout();
        renegotiationPendingVideoTrack = null;
        renegotiationState = RenegotiationState.IDLE;
    }

    private void authorHistoryEvent(CallStatus prevStatus, String reason) {
        if (peerHex == null || callId == null) return;
        CallHistoryDecision d = CallHistoryDecision.decide(
            prevStatus, reason, isInitiator, peerHex, durationSec);
        String mediaTypeWire = callKind != null ? callKind.wireName() : "voice";
        switch (d.kind) {
            case GIFT_WRAP:
                bridge.sendCallHistoryRumor(
                    peerHex, d.type, d.durationSec, callId, d.initiatorHex, mediaTypeWire);
                break;
            case LOCAL_ONLY:
                AndroidVoiceCallPlugin.emitCallHistoryWriteRequested(
                    callId, d.type, peerHex, d.initiatorHex, d.durationSec, mediaTypeWire);
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
                        // Default speakerphone on for video calls — users
                        // hold the device away from their face. Voice
                        // calls keep the existing default (off; user-
                        // controlled).
                        if (callKind == CallKind.VIDEO && !isSpeakerOn) {
                            try {
                                setSpeakerOn(true);
                            } catch (Throwable t) {
                                Log.w(TAG, "default-speaker-on failed", t);
                            }
                        }
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
            // For video we capture the first inbound track and notify
            // listeners so the active-call activity can attach it to
            // its full-screen SurfaceViewRenderer.
            final MediaStreamTrack track = receiver.track();
            if (track == null) return;
            Log.d(TAG, "onAddTrack: remote " + track.kind() + " track received");
            if ("video".equals(track.kind()) && track instanceof VideoTrack) {
                final VideoTrack videoTrack = (VideoTrack) track;
                runOnMain(() -> {
                    remoteVideoTrack = videoTrack;
                    deliverRemoteVideoTrack(uiListener, videoTrack);
                    deliverRemoteVideoTrack(serviceListener, videoTrack);
                });
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
