package com.nospeak.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import org.webrtc.PeerConnection;

import java.util.ArrayList;
import java.util.List;

/**
 * Foreground service hosting the active voice call.
 *
 * Lifecycle: started by {@link AndroidVoiceCallPlugin#startCallSession} when a call
 * enters ringing, stopped by {@link AndroidVoiceCallPlugin#endCallSession} when it
 * ends. While running, the service holds a partial wake lock and puts the system
 * audio session in {@link AudioManager#MODE_IN_COMMUNICATION} to engage OS-level
 * voice acoustic-echo-cancellation.
 *
 * Restart policy: {@code START_NOT_STICKY}. A system-killed call is unrecoverable —
 * the JS state machine and the WebRTC peer connection are gone with the process.
 */
public class VoiceCallForegroundService extends Service {

    private static final String TAG = "VoiceCallFGS";
    public static final String CHANNEL_ID = "nospeak_voice_call_active";
    private static final int NOTIFICATION_ID = 0xCAA1;

    public static final String ACTION_START = "com.nospeak.app.voicecall.START";
    public static final String ACTION_STOP = "com.nospeak.app.voicecall.STOP";
    public static final String ACTION_HANGUP = "com.nospeak.app.voicecall.HANGUP";

    /**
     * Native-call actions for {@link NativeVoiceCallManager}. The
     * legacy {@link #ACTION_START} action is retained for backwards
     * compatibility with the old JS-driven path on the web build, but
     * on Android the FGS is always driven through these native
     * actions.
     */
    public static final String ACTION_INITIATE_NATIVE = "com.nospeak.app.voicecall.INITIATE_NATIVE";
    public static final String ACTION_ACCEPT_NATIVE = "com.nospeak.app.voicecall.ACCEPT_NATIVE";
    public static final String ACTION_HANGUP_NATIVE = "com.nospeak.app.voicecall.HANGUP_NATIVE";
    /**
     * Bring the FGS up in a holding state while the JS unlock screen
     * collects the user's PIN. The FGS arms the 30s unlock timeout and
     * waits for ACTION_UNLOCK_COMPLETE; on receipt it transitions to
     * ACTION_ACCEPT_NATIVE. Started by IncomingCallActivity right
     * before launching MainActivity with EXTRA_UNLOCK_FOR_CALL.
     */
    public static final String ACTION_AWAIT_UNLOCK = "com.nospeak.app.voicecall.AWAIT_UNLOCK";

    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_PEER_NPUB = "peerNpub";
    public static final String EXTRA_PEER_NAME = "peerName";
    public static final String EXTRA_ROLE = "role";
    public static final String EXTRA_PEER_HEX = "peerHex";
    /**
     * Optional. Either {@code "voice"} or {@code "video"}; defaults to
     * {@code "voice"} when absent. Drives the native call manager's
     * {@link NativeVoiceCallManager.CallKind} parameter on initiate
     * and accept.
     */
    public static final String EXTRA_CALL_KIND = "callKind";

    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean audioModeApplied = false;

    /**
     * Phase 1 native voice-call manager. Lazily created on first
     * native action ({@link #ACTION_INITIATE_NATIVE} or
     * {@link #ACTION_ACCEPT_NATIVE}). Null when the FGS is hosting
     * only the legacy JS-driven session.
     */
    private NativeVoiceCallManager nativeManager;
    /**
     * Phase 3 outgoing-call ringback tone. Started when the manager
     * transitions to OUTGOING_RINGING; stopped on the first transition
     * out of that state.
     */
    private final VoiceCallRingback ringback = new VoiceCallRingback();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    /**
     * Process-wide static reference so {@link AndroidVoiceCallPlugin}
     * (and ActiveCallActivity in Phase 2) can reach the running
     * manager without binder boilerplate. Cleared in {@link #onDestroy}.
     */
    private static volatile VoiceCallForegroundService sInstance;

    /** @return the running FGS instance, or {@code null}. */
    public static VoiceCallForegroundService getInstance() {
        return sInstance;
    }

    /**
     * Convenience: returns the {@link NativeVoiceCallManager} when the
     * FGS is running and a native session has been started; otherwise
     * {@code null}. Safe to call from any thread.
     */
    public static NativeVoiceCallManager getNativeManager() {
        VoiceCallForegroundService svc = sInstance;
        return svc == null ? null : svc.nativeManager;
    }

    /** Local binder for ActiveCallActivity (Phase 2) to bind into. */
    public class LocalBinder extends Binder {
        public VoiceCallForegroundService getService() {
            return VoiceCallForegroundService.this;
        }
    }
    private final IBinder binder = new LocalBinder();

    @Override
    public IBinder onBind(Intent intent) {
        // Bound by ActiveCallActivity (Phase 2). Other callers get null.
        return binder;
    }

    /**
     * Listens for the {@link VoiceCallIntentContract#ACTION_UNLOCK_COMPLETE}
     * broadcast emitted by the JS unlock screen (via the
     * {@code AndroidVoiceCall.notifyUnlockComplete} plugin method) when
     * the user has unlocked a previously-locked nsec. Resumes a pending
     * call accept by reloading the secret and starting the FGS in
     * ACCEPT_NATIVE mode.
     */
    private final BroadcastReceiver unlockReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null) return;
            String callId = intent.getStringExtra(VoiceCallIntentContract.EXTRA_CALL_ID);
            Log.d(TAG, "ACTION_UNLOCK_COMPLETE received callId=" + callId);
            mainHandler.post(() -> resumePendingAcceptAfterUnlock(callId));
        }
    };
    private boolean unlockReceiverRegistered = false;

    /**
     * Pending unlock-for-call timeout. If 30s pass after persisting the
     * unlock-pending payload without an ACTION_UNLOCK_COMPLETE, the
     * native call manager sends a kind-25054 reject + records a
     * missed-call rumor and aborts.
     */
    private Runnable unlockTimeoutRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        // Register the unlock-complete listener for the lifetime of
        // the FGS. LocalBroadcastManager is used so the broadcast
        // never leaves the process.
        try {
            LocalBroadcastManager.getInstance(this).registerReceiver(
                unlockReceiver,
                new IntentFilter(VoiceCallIntentContract.ACTION_UNLOCK_COMPLETE));
            unlockReceiverRegistered = true;
        } catch (Throwable t) {
            Log.w(TAG, "register unlock receiver failed", t);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // Native-call actions: start the manager and route the action.
        if (ACTION_INITIATE_NATIVE.equals(action)
            || ACTION_ACCEPT_NATIVE.equals(action)
            || ACTION_HANGUP_NATIVE.equals(action)) {
            return handleNativeAction(intent, action);
        }

        // Holding state: wait for the JS unlock screen to broadcast
        // ACTION_UNLOCK_COMPLETE. Promote to foreground (so we don't get
        // killed by the OS while the user types their PIN) and arm the
        // 30s timeout.
        if (ACTION_AWAIT_UNLOCK.equals(action)) {
            String callId = intent.getStringExtra(EXTRA_CALL_ID);
            String peerName = intent.getStringExtra(EXTRA_PEER_NAME);
            // The unlock-pending notification can be visible for many
            // seconds while the user types their PIN. Pre-read peerHex
            // from the persisted offer slot so the CallStyle Person
            // gets a real avatar + cached username, not the "U" /
            // "Unknown" fallback.
            String unlockPeerHex = null;
            try {
                SharedPreferences unlockPrefs = getSharedPreferences(
                    "nospeak_pending_incoming_call", MODE_PRIVATE);
                unlockPeerHex = unlockPrefs.getString("peerHex", null);
            } catch (Throwable ignored) {}
            promoteToForeground(callId, peerName, unlockPeerHex, "incoming",
                /* isVideoCall= */ false);
            scheduleUnlockTimeoutIfNeeded();
            return START_NOT_STICKY;
        }

        if (!ACTION_START.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String peerName = intent.getStringExtra(EXTRA_PEER_NAME);
        String role = intent.getStringExtra(EXTRA_ROLE);

        // Legacy ACTION_START (web FGS routing) — peerHex isn't on this
        // intent; rely on the manager fallback inside buildOngoingNotification.
        promoteToForeground(callId, peerName, role);
        return START_NOT_STICKY;
    }

    /**
     * Runs the foreground promotion (notification, FGS type, audio
     * mode, wake lock) shared by both the legacy JS-driven path
     * ({@link #ACTION_START}) and the native path
     * ({@link #ACTION_INITIATE_NATIVE} / {@link #ACTION_ACCEPT_NATIVE}).
     * Idempotent — safe to invoke multiple times during a single call.
     *
     * @return {@code true} if the FGS is now in the foreground state and
     *         it is safe to proceed with call setup; {@code false} if
     *         {@code startForeground} threw (typically Android's
     *         per-FGS-type permission policy on Android 14+). On
     *         {@code false} the caller MUST short-circuit any
     *         further work — the service has already invoked
     *         {@code stopSelf()} and is on its way to {@code onDestroy}.
     */
    private boolean promoteToForeground(String callId, String peerName, String role) {
        return promoteToForeground(callId, peerName, /* peerHex= */ null, role,
            /* isVideoCall= */ false);
    }

    /**
     * Same as the 3-arg overload but with explicit {@code peerHex} and
     * {@code isVideoCall} parameters.
     *
     * <p>{@code peerHex} is forwarded to {@link #buildOngoingNotification}
     * so the cached profile (username + avatar) can be resolved at
     * notification-build time. The native call manager hasn't yet been
     * fed the peerHex at this point — it lives only on the intent extra
     * (initiate path) or in the {@code nospeak_pending_incoming_call}
     * SharedPreferences slot (accept path) — so callers that have it
     * should pass it through. Callers that don't (legacy JS-driven
     * {@code ACTION_START} on web) pass {@code null}; the builder falls
     * back to {@code nativeManager.getPeerHex()} which works for code
     * paths where the manager is set up before promotion.
     *
     * <p>When {@code isVideoCall} is {@code true}, the FGS type bitmask
     * is widened to include {@code FOREGROUND_SERVICE_TYPE_CAMERA} and
     * {@code FOREGROUND_SERVICE_TYPE_MICROPHONE} on Android 14+; without
     * those bits the system silently refuses to deliver camera frames
     * through the FGS-hosted {@code Camera2Enumerator} pipeline.
     */
    private boolean promoteToForeground(
            String callId,
            String peerName,
            String peerHex,
            String role,
            boolean isVideoCall) {
        createChannelIfNeeded();
        Notification notif = buildOngoingNotification(callId, peerName, peerHex, role);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                int fgsType = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL;
                if (isVideoCall) {
                    fgsType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                             | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                }
                startForeground(NOTIFICATION_ID, notif, fgsType);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
            stopSelf();
            return false;
        }

        // Cancel any incoming-call notification once we're hosting an active call.
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}

        if (wakeLock == null) acquireWakeLock();
        if (!audioModeApplied) configureAudioMode();
        return true;
    }

    /**
     * Handle a native-call action (initiate / accept / hangup). Lazily
     * creates the {@link NativeVoiceCallManager} on first call and
     * routes the action into it. The manager runs entirely on the
     * main thread per its contract.
     */
    private int handleNativeAction(Intent intent, String action) {
        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String peerHex = intent.getStringExtra(EXTRA_PEER_HEX);
        String peerName = intent.getStringExtra(EXTRA_PEER_NAME);
        String role = ACTION_INITIATE_NATIVE.equals(action) ? "outgoing" : "incoming";
        Log.d(TAG, "handleNativeAction action=" + action + " callId=" + callId);

        // Determine the call kind BEFORE promoting to foreground so we can
        // pick the right FGS type bitmask. On Android 14+ a video call
        // needs FOREGROUND_SERVICE_TYPE_CAMERA + _MICROPHONE in the
        // bitmask; without those bits the camera capture in
        // NativeVoiceCallManager.attachLocalVideoTrack silently produces
        // no frames.
        //   * INITIATE — the kind is on the intent extra (set by
        //     AndroidVoiceCallPlugin.initiateCall from the JS opts).
        //   * ACCEPT  — the kind lives in the persisted offer's
        //     `nospeak_pending_incoming_call` SharedPreferences slot
        //     (written by NativeBackgroundMessagingService when the
        //     kind-25050 offer arrived).
        boolean isVideoCall = false;
        // peerHex used for the ongoing-call notification's CallStyle
        // Person (avatar + cached username lookup). For INITIATE this
        // is on the intent extra (already in `peerHex` local). For
        // ACCEPT it lives in the persisted offer slot — pre-read it
        // here, BEFORE promoteToForeground, because the slot read
        // inside the mainHandler.post block below runs after the
        // notification has already been built.
        String peerHexForNotif = peerHex;
        if (ACTION_INITIATE_NATIVE.equals(action)) {
            isVideoCall = "video".equals(intent.getStringExtra(EXTRA_CALL_KIND));
        } else if (ACTION_ACCEPT_NATIVE.equals(action)) {
            try {
                SharedPreferences offerPrefs = getSharedPreferences(
                    "nospeak_pending_incoming_call", MODE_PRIVATE);
                isVideoCall = "video".equals(offerPrefs.getString("callType", "voice"));
                if (peerHexForNotif == null || peerHexForNotif.isEmpty()) {
                    peerHexForNotif = offerPrefs.getString("peerHex", null);
                }
            } catch (Throwable ignored) {
                // Default to voice on any read error — no harm; worst
                // case is the kind-mismatch fallback into ACCEPT_NATIVE
                // body which already validates the slot.
            }
        }

        // Always promote — the native call manager needs the FGS up
        // before any media work begins. If startForeground throws (most
        // commonly Android's per-FGS-type permission policy on Android
        // 14+ — phoneCall requires MANAGE_OWN_CALLS or ROLE_DIALER),
        // surface a clean callError to the JS layer instead of silently
        // proceeding with a doomed call setup.
        if (!promoteToForeground(callId, peerName, peerHexForNotif, role, isVideoCall)) {
            AndroidVoiceCallPlugin.emitCallError(callId, "fgs-failed",
                "Foreground service could not start (Android 14+ requires "
                + "MANAGE_OWN_CALLS for phoneCall foreground services)");
            AndroidVoiceCallPlugin.emitCallStateChanged(callId, "ended", "fgs-failed");
            try {
                getSharedPreferences("nospeak_pending_incoming_call", MODE_PRIVATE)
                    .edit().clear().apply();
            } catch (Throwable ignored) {}
            try { IncomingCallNotification.cancel(this); } catch (Throwable ignored) {}
            return START_NOT_STICKY;
        }

        // RECORD_AUDIO is required by stream-webrtc-android's AudioRecord
        // capture. Without it, the peer connection will silently capture
        // silence — the callee hears nothing. Fail loudly here so the
        // user gets a clear callError event instead of a one-way call.
        // The JS-foreground initiate / accept paths request this
        // permission via AndroidMicrophone before invoking the FGS, so
        // this check only fires on cold-start lockscreen-accept paths
        // when the user has never granted RECORD_AUDIO at runtime.
        if ((ACTION_INITIATE_NATIVE.equals(action) || ACTION_ACCEPT_NATIVE.equals(action))
                && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "RECORD_AUDIO not granted; aborting " + action + " callId=" + callId);
            AndroidVoiceCallPlugin.emitCallError(callId, "permission-denied",
                "Microphone permission required");
            AndroidVoiceCallPlugin.emitCallStateChanged(callId, "ended", "permission-denied");
            // Clear the pending offer so a stale slot doesn't keep
            // blocking subsequent accepts.
            try {
                getSharedPreferences("nospeak_pending_incoming_call", MODE_PRIVATE)
                    .edit().clear().apply();
            } catch (Throwable ignored) {}
            try { IncomingCallNotification.cancel(this); } catch (Throwable ignored) {}
            stopSelf();
            return START_NOT_STICKY;
        }

        // Build the manager on first use.
        if (nativeManager == null) {
            mainHandler.post(this::ensureNativeManager);
        }

        if (ACTION_INITIATE_NATIVE.equals(action)) {
            final String fCallId = callId;
            final String fPeerHex = peerHex;
            final String fPeerName = peerName;
            final NativeVoiceCallManager.CallKind fKind =
                NativeVoiceCallManager.CallKind.fromWireName(
                    intent.getStringExtra(EXTRA_CALL_KIND));
            mainHandler.post(() -> {
                if (nativeManager == null) ensureNativeManager();
                if (nativeManager == null || fCallId == null || fPeerHex == null) {
                    Log.w(TAG, "INITIATE_NATIVE: missing manager/callId/peerHex");
                    return;
                }
                Log.d(TAG, "INITIATE_NATIVE: dispatching to manager callId=" + fCallId
                    + " kind=" + fKind);
                try {
                    nativeManager.initiateCall(fCallId, fPeerHex.toLowerCase(), fKind);
                } catch (Throwable t) {
                    Log.e(TAG, "INITIATE_NATIVE: initiateCall threw", t);
                }
                // Surface the active-call UI for outgoing calls only when
                // the manager actually entered OUTGOING_RINGING. If
                // initiateCall went straight to ENDED (e.g. mic capture
                // threw inside attachLocalAudioTrack), launching the
                // activity would just paint the brief 1.5s "Call ended"
                // flicker that users reported.
                NativeVoiceCallManager.CallStatus s = nativeManager.getStatus();
                Log.d(TAG, "INITIATE_NATIVE: post-initiate status=" + s);
                if (s != NativeVoiceCallManager.CallStatus.OUTGOING_RINGING) {
                    Log.w(TAG, "INITIATE_NATIVE: not launching ActiveCallActivity"
                        + " (status=" + s + ")");
                    return;
                }
                String avatarPath = resolvePeerAvatarPath(fPeerHex);
                Intent active = new Intent(VoiceCallForegroundService.this, ActiveCallActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra(ActiveCallActivity.EXTRA_CALL_ID, fCallId)
                    .putExtra(ActiveCallActivity.EXTRA_PEER_NAME,
                        fPeerName != null ? fPeerName : "")
                    .putExtra(ActiveCallActivity.EXTRA_PEER_HEX,
                        fPeerHex != null ? fPeerHex : "")
                    .putExtra(ActiveCallActivity.EXTRA_CALL_KIND, fKind.wireName());
                if (avatarPath != null) {
                    active.putExtra(ActiveCallActivity.EXTRA_AVATAR_PATH, avatarPath);
                }
                try {
                    startActivity(active);
                    Log.d(TAG, "INITIATE_NATIVE: ActiveCallActivity launch dispatched");
                } catch (Exception e) {
                    Log.w(TAG, "INITIATE_NATIVE: startActivity failed", e);
                }
            });
        } else if (ACTION_ACCEPT_NATIVE.equals(action)) {
            final String fCallId = callId;
            final String fPeerName = peerName;
            mainHandler.post(() -> {
                if (nativeManager == null) ensureNativeManager();
                if (nativeManager == null) {
                    Log.w(TAG, "ACCEPT_NATIVE: manager null after ensure; aborting");
                    return;
                }
                // Read the persisted offer SDP from SharedPreferences —
                // the same slot IncomingCallNotification posts to. The
                // FGS now owns the slot lifecycle (clears after read);
                // the previous JS clearPendingIncomingCall code path
                // is unreachable since heads-up Accept routes through
                // IncomingCallActivity, never MainActivity.
                SharedPreferences prefs = getSharedPreferences(
                    "nospeak_pending_incoming_call", MODE_PRIVATE);
                String pendingCallId = prefs.getString("callId", null);
                String sdp = prefs.getString("sdp", null);
                String peerHexRead = prefs.getString("peerHex", null);
                String callTypeRead = prefs.getString("callType", "voice");
                if (pendingCallId == null || sdp == null || peerHexRead == null
                    || (fCallId != null && !fCallId.equals(pendingCallId))) {
                    Log.w(TAG, "ACCEPT_NATIVE: pending offer missing or callId mismatch"
                        + " (intent=" + fCallId + " prefs=" + pendingCallId + ")");
                    return;
                }
                NativeVoiceCallManager.CallKind acceptKind =
                    NativeVoiceCallManager.CallKind.fromWireName(callTypeRead);
                Log.d(TAG, "ACCEPT_NATIVE: dispatching to manager callId=" + pendingCallId
                    + " kind=" + acceptKind);
                try {
                    nativeManager.acceptIncomingCall(
                        pendingCallId, peerHexRead.toLowerCase(), sdp, acceptKind);
                } catch (Throwable t) {
                    Log.e(TAG, "ACCEPT_NATIVE: acceptIncomingCall threw", t);
                }
                // Clear the pending offer slot now that the manager has
                // consumed it — prevents a stale offer from being
                // reused by a later spurious Accept tap.
                try {
                    prefs.edit().clear().apply();
                } catch (Throwable ignored) {}
                // Launch the active-call surface from the FGS, not from
                // IncomingCallActivity. This eliminates the lockscreen
                // race where IncomingCallActivity.finishAndRemoveTask()
                // ran during keyguard dismissal, causing MainActivity's
                // background task to be promoted instead of
                // ActiveCallActivity. With the FGS owning the launch,
                // the activity start is decoupled from the keyguard
                // transition timing.
                NativeVoiceCallManager.CallStatus s = nativeManager.getStatus();
                Log.d(TAG, "ACCEPT_NATIVE: post-accept status=" + s);
                if (s != NativeVoiceCallManager.CallStatus.CONNECTING
                    && s != NativeVoiceCallManager.CallStatus.ACTIVE) {
                    Log.w(TAG, "ACCEPT_NATIVE: not launching ActiveCallActivity"
                        + " (status=" + s + ")");
                    return;
                }
                String acceptAvatarPath = resolvePeerAvatarPath(peerHexRead);
                Intent active = new Intent(VoiceCallForegroundService.this, ActiveCallActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra(ActiveCallActivity.EXTRA_CALL_ID, pendingCallId)
                    .putExtra(ActiveCallActivity.EXTRA_PEER_NAME,
                        fPeerName != null ? fPeerName : "")
                    .putExtra(ActiveCallActivity.EXTRA_PEER_HEX,
                        peerHexRead != null ? peerHexRead : "")
                    .putExtra(ActiveCallActivity.EXTRA_CALL_KIND, acceptKind.wireName());
                if (acceptAvatarPath != null) {
                    active.putExtra(ActiveCallActivity.EXTRA_AVATAR_PATH, acceptAvatarPath);
                }
                try {
                    startActivity(active);
                    Log.d(TAG, "ACCEPT_NATIVE: ActiveCallActivity launch dispatched");
                } catch (Exception e) {
                    Log.w(TAG, "ACCEPT_NATIVE: startActivity failed", e);
                }
            });
        } else if (ACTION_HANGUP_NATIVE.equals(action)) {
            mainHandler.post(() -> {
                if (nativeManager != null) nativeManager.hangup();
            });
        }
        return START_NOT_STICKY;
    }

    /**
     * Functional surface of the underlying NIP-AC senders, so the
     * {@link NativeVoiceCallManager.MessagingBridge} construction can
     * be unit-tested without spinning up the full {@link
     * NativeBackgroundMessagingService}. Production code wraps the
     * live service instance; tests pass a recording fake.
     *
     * <p>Each method's signature mirrors the corresponding sender on
     * {@link NativeBackgroundMessagingService}.
     */
    interface NipAcSender {
        void sendVoiceCallOffer(String recipientHex, String callId, String sdp, String callKind);
        void sendVoiceCallAnswer(String recipientHex, String callId, String sdp);
        void sendVoiceCallIce(String recipientHex, String callId,
                              String candidate, String sdpMid, Integer sdpMLineIndex);
        void sendVoiceCallHangup(String recipientHex, String callId, String reason);
        void sendVoiceCallReject(String recipientHex, String callId);
        /**
         * NIP-AC kind 25055 Call Renegotiate. Mid-call SDP change. No
         * {@code call-type} tag, no self-wrap; the receiving peer
         * responds with an ordinary kind-25051 answer.
         */
        void sendVoiceCallRenegotiate(String recipientHex, String callId, String sdp);
        void sendVoiceCallHistoryRumor(
            String recipientHex,
            String type,
            int durationSec,
            String callId,
            String initiatorHex,
            String callMediaType);
    }

    /**
     * Build a {@link NativeVoiceCallManager.MessagingBridge} that
     * forwards every call to the given {@code sender}. Package-private
     * so tests can substitute a recording fake; production code calls
     * this with a sender backed by {@link #runOnMessagingExecutor}.
     *
     * <p>Crucially, this factory is the contract that {@link
     * NativeVoiceCallManager.MessagingBridge#sendOffer} carries the
     * caller's media kind through to the underlying sender. A
     * regression here previously caused Android-initiated video calls
     * to be downgraded to voice on receiving Web peers (the inner
     * event was emitted with {@code call-type=voice} regardless of the
     * actual media kind).
     */
    static NativeVoiceCallManager.MessagingBridge buildBridge(NipAcSender sender) {
        return new NativeVoiceCallManager.MessagingBridge() {
            @Override
            public void sendOffer(
                    String recipientHex,
                    String callId,
                    String sdp,
                    String callKind) {
                sender.sendVoiceCallOffer(recipientHex, callId, sdp, callKind);
            }

            @Override
            public void sendAnswer(String recipientHex, String callId, String sdp) {
                sender.sendVoiceCallAnswer(recipientHex, callId, sdp);
            }

            @Override
            public void sendIce(String recipientHex, String callId,
                                String candidate, String sdpMid, Integer sdpMLineIndex) {
                sender.sendVoiceCallIce(recipientHex, callId, candidate, sdpMid, sdpMLineIndex);
            }

            @Override
            public void sendHangup(String recipientHex, String callId, String reason) {
                sender.sendVoiceCallHangup(recipientHex, callId, reason);
            }

            @Override
            public void sendReject(String recipientHex, String callId) {
                sender.sendVoiceCallReject(recipientHex, callId);
            }

            @Override
            public void sendRenegotiate(String recipientHex, String callId, String sdp) {
                sender.sendVoiceCallRenegotiate(recipientHex, callId, sdp);
            }

            @Override
            public java.util.List<GlobalIceBuffer.IceCandidatePayload> drainPreSessionIce(
                    String senderHex) {
                NativeBackgroundMessagingService svc =
                    NativeBackgroundMessagingService.getInstance();
                if (svc == null) return java.util.Collections.emptyList();
                return svc.getGlobalIceBuffer()
                    .drain(senderHex, System.currentTimeMillis());
            }

            @Override
            public void sendCallHistoryRumor(
                    String recipientHex,
                    String type,
                    int durationSec,
                    String callId,
                    String initiatorHex,
                    String callMediaType) {
                // Phase 4 of add-native-voice-calls: all gift-wrapped
                // history rumor types (declined / ended / no-answer /
                // failed / busy) are authored fully natively via the
                // parameterized helper. The JS callHistoryRumorRequested
                // bridge is no longer fired from the native path; the
                // event remains in the plugin shape for forwards
                // compatibility but is dormant on Android.
                sender.sendVoiceCallHistoryRumor(
                    recipientHex, type, durationSec, callId, initiatorHex, callMediaType);
            }
        };
    }

    /**
     * Lazily build the native call manager. Called on the main thread.
     * The bridge implementation delegates NIP-AC publishing to
     * {@link NativeBackgroundMessagingService}'s static instance,
     * running each call on the messaging service's relay-IO thread
     * (the background executor used by {@code publishEventToRelayUrls}).
     */
    private void ensureNativeManager() {
        if (nativeManager != null) return;
        // ICE servers come from the runtime config injected by the JS
        // layer when starting native calls. Phase 1 reads a default
        // STUN server so peer connections still complete on most
        // networks; Phase 2/3 may pass the configured list through
        // the start intent for parity with the JS getIceServers().
        List<PeerConnection.IceServer> iceServers = new ArrayList<>();
        iceServers.add(PeerConnection.IceServer
            .builder("stun:turn.data.haus:3478").createIceServer());

        // Production sender: dispatches each call onto the messaging
        // service's background executor. The two-step indirection
        // (NipAcSender -> runOnMessagingExecutor -> live service) lets
        // unit tests substitute the sender without instantiating the
        // Service subclass.
        NipAcSender sender = new NipAcSender() {
            @Override
            public void sendVoiceCallOffer(
                    String recipientHex, String callId, String sdp, String callKind) {
                runOnMessagingExecutor(svc ->
                    svc.sendVoiceCallOffer(recipientHex, callId, sdp, callKind));
            }
            @Override
            public void sendVoiceCallAnswer(
                    String recipientHex, String callId, String sdp) {
                runOnMessagingExecutor(svc ->
                    svc.sendVoiceCallAnswer(recipientHex, callId, sdp));
            }
            @Override
            public void sendVoiceCallIce(
                    String recipientHex, String callId,
                    String candidate, String sdpMid, Integer sdpMLineIndex) {
                runOnMessagingExecutor(svc ->
                    svc.sendVoiceCallIce(recipientHex, callId, candidate, sdpMid, sdpMLineIndex));
            }
            @Override
            public void sendVoiceCallHangup(
                    String recipientHex, String callId, String reason) {
                runOnMessagingExecutor(svc ->
                    svc.sendVoiceCallHangup(recipientHex, callId, reason));
            }
            @Override
            public void sendVoiceCallReject(String recipientHex, String callId) {
                runOnMessagingExecutor(svc ->
                    svc.sendVoiceCallReject(recipientHex, callId));
            }
            @Override
            public void sendVoiceCallRenegotiate(
                    String recipientHex, String callId, String sdp) {
                runOnMessagingExecutor(svc ->
                    svc.sendVoiceCallRenegotiate(recipientHex, callId, sdp));
            }
            @Override
            public void sendVoiceCallHistoryRumor(
                    String recipientHex,
                    String type,
                    int durationSec,
                    String callId,
                    String initiatorHex,
                    String callMediaType) {
                runOnMessagingExecutor(svc -> svc.sendVoiceCallHistoryRumor(
                    recipientHex, type, durationSec, callId, initiatorHex, callMediaType));
            }
        };

        NativeVoiceCallManager.MessagingBridge bridge = buildBridge(sender);

        nativeManager = new NativeVoiceCallManager(
            getApplicationContext(), bridge, iceServers);

        // Wire the FGS-internal ringback player. Distinct from the
        // ActiveCallActivity's UiListener so the two callbacks don't
        // compete for the single uiListener slot. Plays only while
        // the manager is in OUTGOING_RINGING — the first transition
        // out of that state stops it.
        nativeManager.setServiceListener(new NativeVoiceCallManager.UiListener() {
            @Override
            public void onStatusChanged(NativeVoiceCallManager.CallStatus status, String reason) {
                if (status == NativeVoiceCallManager.CallStatus.OUTGOING_RINGING) {
                    ringback.start();
                } else {
                    // Any non-outgoing-ringing state — connecting,
                    // active, ended, or even a stray idle — stops
                    // the tone. Idempotent.
                    ringback.stop();
                }
            }

            @Override
            public void onDurationTick(int seconds) { /* no-op */ }

            @Override
            public void onMuteChanged(boolean muted) { /* no-op */ }
        });
    }

    /**
     * Hand work off to the messaging service. NIP-AC publishing must
     * NOT run on the main thread (Amber's NIP-55 ContentResolver query
     * is synchronous and the WebSocket sends should not block UI). The
     * messaging service exposes a static instance accessor; if it
     * returns null the work is dropped (logged) since publishing
     * without an authenticated user is a no-op.
     */
    private interface MessagingTask {
        void run(NativeBackgroundMessagingService svc);
    }
    private void runOnMessagingExecutor(MessagingTask task) {
        NativeBackgroundMessagingService svc =
            NativeBackgroundMessagingService.getInstance();
        if (svc == null) {
            Log.w(TAG, "messaging service not running; dropping NIP-AC publish");
            return;
        }
        // The messaging service's existing publish path is thread-safe
        // (uses synchronized blocks around the relay socket map). We
        // dispatch via a new background thread per call to keep the
        // main thread free; volumes are low (~5 events per call).
        new Thread(() -> {
            try { task.run(svc); }
            catch (Throwable t) { Log.w(TAG, "messaging task failed", t); }
        }, "nospeak-voicecall-publish").start();
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nospeak:voice-call");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(60L * 60L * 1000L); // safety timeout: 1 hour
        } catch (Exception e) {
            Log.w(TAG, "wake lock acquire failed", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        wakeLock = null;
    }

    private void configureAudioMode() {
        try {
            audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            previousAudioMode = audioManager.getMode();
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioModeApplied = true;
        } catch (Exception e) {
            Log.w(TAG, "setMode failed", e);
        }
    }

    private void restoreAudioMode() {
        if (!audioModeApplied || audioManager == null) return;
        try {
            audioManager.setMode(previousAudioMode);
        } catch (Exception e) {
            Log.w(TAG, "restore audio mode failed", e);
        }
        audioModeApplied = false;
    }

    @Override
    public void onDestroy() {
        // Stop the ringback tone first — it has its own ToneGenerator
        // resource that should be released before the system audio mode
        // is restored, otherwise the tone briefly bleeds into the
        // restored ringer/music stream.
        try { ringback.stop(); } catch (Throwable ignored) {}
        // Tear down the native call manager FIRST so its dispose() runs
        // while the audio mode and wake lock are still in their call-
        // optimized state. The manager itself does not touch wake lock
        // or audio mode.
        if (nativeManager != null) {
            try { nativeManager.dispose(); } catch (Throwable t) {
                Log.w(TAG, "nativeManager.dispose failed", t);
            }
            nativeManager = null;
        }
        cancelUnlockTimeout();
        if (unlockReceiverRegistered) {
            try {
                LocalBroadcastManager.getInstance(this).unregisterReceiver(unlockReceiver);
            } catch (Throwable ignored) {}
            unlockReceiverRegistered = false;
        }
        restoreAudioMode();
        releaseWakeLock();
        if (sInstance == this) sInstance = null;
        super.onDestroy();
    }

    /**
     * Resume a call accept that was paused for PIN unlock. Called when
     * either ACTION_UNLOCK_COMPLETE fires or the pending-unlock
     * SharedPreferences slot is detected on FGS start.
     */
    private void resumePendingAcceptAfterUnlock(String callId) {
        cancelUnlockTimeout();
        SharedPreferences prefs = getSharedPreferences(
            VoiceCallIntentContract.PREFS_FILE, MODE_PRIVATE);
        String pending = prefs.getString(
            VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK, null);
        if (pending == null) {
            Log.d(TAG, "resumePendingAcceptAfterUnlock: no pending unlock; ignoring");
            return;
        }
        // Tolerate slot/callId mismatch by preferring the broadcast's
        // callId. The two should always match (we only ever persist one
        // pending unlock at a time), but the broadcast is authoritative.
        final String acceptedCallId = callId != null ? callId : pending;
        prefs.edit().remove(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK)
            .remove(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK + ":ts")
            .apply();

        NativeBackgroundMessagingService nbms =
            NativeBackgroundMessagingService.getInstance();
        if (nbms != null && !nbms.reloadLocalSecretFromStore()) {
            Log.w(TAG, "resumePendingAcceptAfterUnlock: secret reload failed");
            // Without a key we still can't sign Answer; bail rather than
            // silently failing. The user will see a missed-call entry
            // via the offer's normal expiry flow.
            return;
        }
        // Fire the same accept path as if the user had tapped Accept on
        // an unlocked device. The FGS reads the offer SDP from the
        // pending-incoming-call SharedPrefs slot.
        Intent svc = new Intent(this, VoiceCallForegroundService.class)
            .setAction(ACTION_ACCEPT_NATIVE)
            .putExtra(EXTRA_CALL_ID, acceptedCallId);
        try {
            androidx.core.content.ContextCompat.startForegroundService(this, svc);
        } catch (Exception e) {
            Log.w(TAG, "resumePendingAcceptAfterUnlock: startForegroundService failed", e);
            return;
        }
        // Bring up the native active-call surface. The peerHex lives in
        // the offer SharedPrefs slot (written by NBMS when the offer
        // wrap was decrypted); look it up so the in-call screen can
        // resolve a real picture or fall back to an identicon. Best
        // effort — if the slot was already cleared (rare race) the
        // activity falls through to the layout's placeholder.
        SharedPreferences offerPrefs = getSharedPreferences(
            "nospeak_pending_incoming_call", MODE_PRIVATE);
        String resumePeerHex = offerPrefs.getString("peerHex", null);
        String resumeCallType = offerPrefs.getString("callType", "voice");
        String resumeAvatarPath = resolvePeerAvatarPath(resumePeerHex);
        Intent active = new Intent(this, ActiveCallActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(ActiveCallActivity.EXTRA_CALL_ID, acceptedCallId)
            .putExtra(ActiveCallActivity.EXTRA_PEER_HEX,
                resumePeerHex != null ? resumePeerHex : "")
            .putExtra(ActiveCallActivity.EXTRA_CALL_KIND,
                NativeVoiceCallManager.CallKind.fromWireName(resumeCallType).wireName());
        if (resumeAvatarPath != null) {
            active.putExtra(ActiveCallActivity.EXTRA_AVATAR_PATH, resumeAvatarPath);
        }
        try { startActivity(active); } catch (Exception ignored) {}
    }

    /**
     * Schedule the 30s unlock-timeout: if the user dismisses MainActivity
     * without entering their PIN we send a reject + record a missed
     * call so the caller doesn't sit waiting indefinitely.
     */
    public void scheduleUnlockTimeoutIfNeeded() {
        SharedPreferences prefs = getSharedPreferences(
            VoiceCallIntentContract.PREFS_FILE, MODE_PRIVATE);
        if (prefs.getString(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK, null) == null) {
            return;
        }
        cancelUnlockTimeout();
        unlockTimeoutRunnable = () -> {
            SharedPreferences p = getSharedPreferences(
                VoiceCallIntentContract.PREFS_FILE, MODE_PRIVATE);
            String pending = p.getString(
                VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK, null);
            if (pending == null) return; // already resumed or aborted
            // Pull the offer-receipt context from the pending-incoming-call slot.
            SharedPreferences offerPrefs = getSharedPreferences(
                "nospeak_pending_incoming_call", MODE_PRIVATE);
            String peerHex = offerPrefs.getString("peerHex", null);
            String offerCallId = offerPrefs.getString("callId", null);
            if (peerHex != null && offerCallId != null && offerCallId.equals(pending)) {
                NativeBackgroundMessagingService nbms =
                    NativeBackgroundMessagingService.getInstance();
                if (nbms != null) {
                    final NativeBackgroundMessagingService fNbms = nbms;
                    final String fPeerHex = peerHex.toLowerCase();
                    final String fCallId = pending;
                    new Thread(() -> {
                        try {
                            fNbms.sendVoiceCallReject(fPeerHex, fCallId);
                        } catch (Throwable t) {
                            Log.w(TAG, "unlock timeout: sendVoiceCallReject failed", t);
                        }
                    }, "nospeak-unlock-timeout-reject").start();
                }
            }
            // Clear pending unlock slot and ringer state.
            p.edit().remove(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK)
                .remove(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK + ":ts")
                .apply();
            try { offerPrefs.edit().clear().apply(); } catch (Throwable ignored) {}
            try { IncomingCallNotification.cancel(VoiceCallForegroundService.this); }
            catch (Throwable ignored) {}
            // Stop ourselves — the call is dead.
            stopSelf();
        };
        mainHandler.postDelayed(unlockTimeoutRunnable,
            VoiceCallIntentContract.UNLOCK_TIMEOUT_MS);
    }

    private void cancelUnlockTimeout() {
        if (unlockTimeoutRunnable != null) {
            mainHandler.removeCallbacks(unlockTimeoutRunnable);
            unlockTimeoutRunnable = null;
        }
    }

    /**
     * Look up a cached profile-picture file path for the given peer hex.
     * Returns the absolute path or {@code null} if the peer's profile
     * isn't cached or has no picture URL. Identicon fallback is handled
     * in {@link CallAvatarLoader} on the activity side — we only carry
     * the real-picture path through the launch intent here.
     */
    private String resolvePeerAvatarPath(String peerHex) {
        if (peerHex == null || peerHex.isEmpty()) return null;
        try {
            AndroidProfileCachePrefs.Identity ident =
                AndroidProfileCachePrefs.get(this, peerHex);
            if (ident == null) return null;
            return NativeBackgroundMessagingService.resolveCachedAvatarFilePath(
                this, ident.pictureUrl);
        } catch (Throwable t) {
            Log.d(TAG, "resolvePeerAvatarPath failed", t);
            return null;
        }
    }

    private Notification buildOngoingNotification(
            String callId, String peerName, String peerHex, String role) {
        // Tap target: bring the existing ActiveCallActivity instance back
        // to the front. The activity is declared singleTask with an empty
        // taskAffinity (see AndroidManifest.xml around the
        // .ActiveCallActivity entry), so combining FLAG_ACTIVITY_NEW_TASK
        // (required because we dispatch from a Service context) with
        // FLAG_ACTIVITY_SINGLE_TOP delivers the intent to the existing
        // instance via onNewIntent rather than recreating it. This is the
        // reliable "return to ongoing call" affordance — the activity is
        // declared excludeFromRecents="true", so the system Recents
        // surface cannot be used as a fallback.
        Intent activityIntent = new Intent(this, ActiveCallActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(ActiveCallActivity.EXTRA_CALL_ID, callId);
        PendingIntent contentPi = PendingIntent.getActivity(
            this, 0, activityIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent hangupIntent = new Intent(this, VoiceCallActionReceiver.class)
            .setAction(ACTION_HANGUP)
            .putExtra(EXTRA_CALL_ID, callId);
        PendingIntent hangupPi = PendingIntent.getBroadcast(
            this, 1, hangupIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Vary the title by the active call's media kind so the
        // ongoing notification distinguishes voice from video calls.
        // Reads from the live manager (the FGS owns it for the call's
        // lifetime). Falls back to "On call" when no manager is
        // available (rare race during teardown).
        //
        // peerHex resolution: prefer the explicit parameter (threaded
        // from the intent extra on INITIATE / from the SharedPrefs slot
        // on ACCEPT) because at notification-build time the manager
        // hasn't yet been told peerHex — initiateCall / acceptIncomingCall
        // are dispatched on the next mainHandler tick AFTER promotion.
        // Fall back to nativeManager.getPeerHex() for code paths that
        // didn't thread the value through (legacy ACTION_START path).
        boolean isVideo = false;
        String peerHexResolved = (peerHex != null && !peerHex.isEmpty())
            ? peerHex.toLowerCase()
            : null;
        try {
            NativeVoiceCallManager mgr = nativeManager;
            if (mgr != null) {
                if (mgr.getCallKind() == NativeVoiceCallManager.CallKind.VIDEO) {
                    isVideo = true;
                }
                if (peerHexResolved == null) {
                    String fromMgr = mgr.getPeerHex();
                    if (fromMgr != null && !fromMgr.isEmpty()) {
                        peerHexResolved = fromMgr;
                    }
                }
            }
        } catch (Throwable ignored) {}
        String title = isVideo ? "Video call" : "Voice call";

        // Resolve a richer display name + avatar from the cached profile
        // when available. Falls back to the peerName passed in (which is
        // what the legacy notification displayed) and ultimately to an
        // empty string. Avatar resolution mirrors the IncomingCallNotification
        // path: cached PNG → identicon → null.
        String displayName = peerName != null ? peerName : "";
        android.graphics.Bitmap avatar = null;
        try {
            if (peerHexResolved != null) {
                AndroidProfileCachePrefs.Identity ident =
                    AndroidProfileCachePrefs.get(this, peerHexResolved);
                if (ident != null) {
                    if (ident.username != null && !ident.username.isEmpty()) {
                        displayName = ident.username;
                    }
                    String avatarPath = NativeBackgroundMessagingService
                        .resolveCachedAvatarFilePath(this, ident.pictureUrl);
                    avatar = CallAvatarLoader.loadCircularBitmap(
                        this, avatarPath, peerHexResolved, 192);
                } else {
                    // No cached profile record — fall back to identicon
                    // alone via the loader helper.
                    avatar = CallAvatarLoader.loadCircularBitmap(
                        this, null, peerHexResolved, 192);
                }
            }
        } catch (Throwable t) {
            Log.d(TAG, "buildOngoingNotification: avatar/profile resolution failed", t);
        }

        // Build a Person for CallStyle. Same shape as
        // IncomingCallNotification.post: name + (optional) circular
        // avatar attached as an IconCompat. The Person key is the
        // peer's pubkey hex, opaque to the system but useful for
        // dedup / grouping if Android ever introspects it.
        Person.Builder callerBuilder = new Person.Builder()
            .setName(displayName != null && !displayName.isEmpty() ? displayName : "Unknown")
            .setKey(peerHexResolved != null ? peerHexResolved : "");
        if (avatar != null) {
            try {
                callerBuilder.setIcon(IconCompat.createWithBitmap(avatar));
            } catch (Throwable t) {
                Log.d(TAG, "buildOngoingNotification: setIcon threw", t);
            }
        }
        Person caller = callerBuilder.build();

        // CallStyle.forOngoingCall is the system-recognised "phone call
        // in progress" surface. On Android 12+ it: (a) floats the
        // notification above all non-call entries in the shade
        // regardless of channel importance, (b) renders expanded by
        // default rather than collapsed under the app's notification
        // group, (c) shows a persistent status-bar call chip whose tap
        // routes to setContentIntent (i.e. ActiveCallActivity here).
        // Solves the "second notification gets collapsed under
        // background-messaging" problem.
        //
        // PRIORITY_HIGH is a pre-O hint; on API 26+ channel importance
        // rules and this is ignored. setColorized + setColor paint a
        // brand-coloured panel when the system honours colorization
        // (FGS notifications are eligible). The colour resource is
        // theme-aware via values-night/colors.xml.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(displayName)
            .setSmallIcon(R.drawable.ic_stat_nospeak)
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setColorized(true)
            .setColor(ContextCompat.getColor(this, R.color.ongoing_call_panel))
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(caller, hangupPi));

        if (avatar != null) {
            // Pre-12 fallback: legacy renderer reads setLargeIcon as
            // the primary avatar surface. Harmless on S+ where
            // CallStyle prefers the Person icon.
            builder.setLargeIcon(avatar);
        }

        // Defensive pre-Android-12 hangup fallback. The androidx
        // CallStyle shim is documented to auto-attach a hangup action
        // on pre-S, but some OEM ROMs strip it. Guarding by SDK_INT
        // keeps S+ devices from rendering two Hang-up buttons.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            builder.addAction(R.drawable.ic_call_end, "Hang up", hangupPi);
        }

        return builder.build();
    }

    private void createChannelIfNeeded() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Active call",
            NotificationManager.IMPORTANCE_LOW);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }
}
