package com.nospeak.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor bridge between JS {@code VoiceCallService} and the native Android
 * voice-call infrastructure (FGS, pending-call SharedPrefs, full-screen-intent
 * permission settings).
 *
 * Plugin methods:
 * - {@code startCallSession({ callId, peerNpub, peerName?, role })}: start the
 *   voice-call FGS for the duration of the call.
 * - {@code endCallSession()}: stop the FGS.
 * - {@code getPendingIncomingCall()}: read the persisted incoming-call signal
 *   that the messaging service wrote when the offer arrived.
 * - {@code clearPendingIncomingCall()}: idempotent cleanup.
 * - {@code canUseFullScreenIntent()}: check FSI permission status (Android 14+).
 * - {@code requestFullScreenIntentPermission()}: open the system Settings page
 *   for the user to grant FSI permission.
 *
 * Events emitted to JS:
 * - {@code hangupRequested}: the user tapped Hang up in the active-call notification.
 * - {@code pendingCallAvailable}: the messaging service detected an incoming call
 *   while the app is in the foreground; lets JS reach for the offer immediately.
 */
@CapacitorPlugin(name = "AndroidVoiceCall")
public class AndroidVoiceCallPlugin extends Plugin {

    private static final String TAG = "AndroidVoiceCallPlugin";

    private static AndroidVoiceCallPlugin sInstance;

    public static AndroidVoiceCallPlugin getInstance() {
        return sInstance;
    }

    @Override
    public void load() {
        super.load();
        sInstance = this;
    }

    @PluginMethod
    public void startCallSession(PluginCall call) {
        String callId = call.getString("callId");
        String peerNpub = call.getString("peerNpub");
        String peerName = call.getString("peerName");
        String role = call.getString("role");
        if (callId == null || peerNpub == null || role == null) {
            call.reject("missing required arguments: callId, peerNpub, role");
            return;
        }

        Intent svc = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_START)
            .putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, callId)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NPUB, peerNpub)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NAME, peerName != null ? peerName : "")
            .putExtra(VoiceCallForegroundService.EXTRA_ROLE, role);
        try {
            ContextCompat.startForegroundService(getContext(), svc);
        } catch (Exception e) {
            Log.e(TAG, "startForegroundService failed", e);
            call.reject("could not start voice call foreground service");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void endCallSession(PluginCall call) {
        Intent stop = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_STOP);
        try { getContext().startService(stop); } catch (Exception ignored) {}
        try {
            getContext().stopService(new Intent(getContext(), VoiceCallForegroundService.class));
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void getPendingIncomingCall(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            "nospeak_pending_incoming_call", Context.MODE_PRIVATE);

        // NIP-AC handoff schema. Old-shape entries from pre-NIP-AC builds
        // are missing the new keys (sdp, callType, alt, innerEventId,
        // createdAt) — treat them as missing and clear the slot.
        String sdp = prefs.getString("sdp", null);
        String callType = prefs.getString("callType", null);
        String alt = prefs.getString("alt", null);
        String innerEventId = prefs.getString("innerEventId", null);
        long createdAt = prefs.getLong("createdAt", 0L);

        JSObject ret = new JSObject();
        if (sdp == null || callType == null || alt == null
            || innerEventId == null || createdAt == 0L) {
            // Either nothing pending, or a legacy-shape entry from a prior
            // build. Clear to avoid spurious re-reads.
            if (prefs.getAll() != null && !prefs.getAll().isEmpty()) {
                Log.d(TAG, "getPendingIncomingCall: clearing legacy/empty slot");
                prefs.edit().clear().apply();
            }
            ret.put("pending", null);
            call.resolve(ret);
            return;
        }

        // NIP-AC: 60s staleness check on inner event's createdAt.
        long nowSec = System.currentTimeMillis() / 1000L;
        if (nowSec - createdAt > 60L) {
            Log.d(TAG, "getPendingIncomingCall: stale (createdAt=" + createdAt + ")");
            prefs.edit().clear().apply();
            ret.put("pending", null);
            call.resolve(ret);
            return;
        }

        JSObject pending = new JSObject();
        pending.put("callId", prefs.getString("callId", ""));
        pending.put("sdp", sdp);
        pending.put("peerHex", prefs.getString("peerHex", ""));
        pending.put("callType", callType);
        pending.put("alt", alt);
        pending.put("innerEventId", innerEventId);
        pending.put("createdAt", createdAt);
        ret.put("pending", pending);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingIncomingCall(PluginCall call) {
        getContext().getSharedPreferences("nospeak_pending_incoming_call",
            Context.MODE_PRIVATE).edit().clear().apply();
        call.resolve();
    }

    /**
     * NIP-AC multi-device: another device of the same user accepted or
     * rejected the call. Cancel the FSI notification, finish the
     * IncomingCallActivity if it's showing, and stop the ringer FGS.
     * Idempotent and safe to call when none of those are active.
     */
    @PluginMethod
    public void dismissIncomingCall(PluginCall call) {
        String callId = call.getString("callId");
        Context ctx = getContext();

        // Cancel the FSI notification regardless of callId match — the
        // user-visible state is "ringing for some incoming call", and a
        // dismiss for any callId means we should stop ringing.
        try {
            IncomingCallNotification.cancel(ctx);
        } catch (Exception e) {
            Log.w(TAG, "dismissIncomingCall: cancel notification failed", e);
        }

        // Tell the ringing activity to finish (broadcast is no-op if
        // activity isn't running). Reuses the same broadcast as a remote
        // hangup-while-ringing.
        try {
            Intent broadcast = new Intent(IncomingCallActivity.ACTION_CALL_CANCELLED)
                .setPackage(ctx.getPackageName());
            if (callId != null) {
                broadcast.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
            }
            ctx.sendBroadcast(broadcast);
        } catch (Exception e) {
            Log.w(TAG, "dismissIncomingCall: broadcast cancel failed", e);
        }

        // Clear the pending-call SharedPrefs so a later cold-start tap
        // doesn't try to accept a dead call.
        try {
            ctx.getSharedPreferences("nospeak_pending_incoming_call",
                Context.MODE_PRIVATE).edit().clear().apply();
        } catch (Exception e) {
            Log.w(TAG, "dismissIncomingCall: clear prefs failed", e);
        }

        call.resolve();
    }

    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        boolean canUse = true;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager nm = (NotificationManager)
                    getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) canUse = nm.canUseFullScreenIntent();
            } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("granted", canUse);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestFullScreenIntentPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            call.resolve();
            return;
        }
        try {
            Intent i = new Intent(
                Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            call.reject("could not open full-screen intent settings");
            return;
        }
        call.resolve();
    }

    // ===================================================================
    //  Native voice-call plugin methods. The Android build always
    //  uses the native voice-call stack (NativeVoiceCallManager hosted
    //  by VoiceCallForegroundService); the previous enableNativeCalls
    //  flag has been removed and these methods are unconditionally
    //  available on Android.
    // ===================================================================

    /**
     * Begin a native outgoing call. Starts {@link VoiceCallForegroundService}
     * with {@link VoiceCallForegroundService#ACTION_INITIATE_NATIVE} and
     * passes the recipient hex pubkey + callId; the FGS lazily builds
     * the {@link NativeVoiceCallManager} and handles the rest.
     *
     * <p>Args: {@code { callId, peerHex, peerName? }}.
     */
    @PluginMethod
    public void initiateCall(PluginCall call) {
        String callId = call.getString("callId");
        String peerHex = call.getString("peerHex");
        String peerName = call.getString("peerName");
        String callKind = call.getString("callKind");
        if (callKind == null || callKind.isEmpty()) callKind = "voice";
        if (callId == null || peerHex == null) {
            call.reject("missing required arguments: callId, peerHex");
            return;
        }
        Intent svc = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_INITIATE_NATIVE)
            .putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, callId)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_HEX, peerHex)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NAME,
                peerName != null ? peerName : "")
            .putExtra(VoiceCallForegroundService.EXTRA_CALL_KIND, callKind);
        try {
            ContextCompat.startForegroundService(getContext(), svc);
        } catch (Exception e) {
            Log.e(TAG, "initiateCall: startForegroundService failed", e);
            call.reject("could not start native voice call");
            return;
        }
        call.resolve();
    }

    /**
     * Accept the pending incoming call. Reads the persisted offer SDP
     * from {@code nospeak_pending_incoming_call} SharedPreferences
     * (the same slot {@link NativeBackgroundMessagingService} writes
     * when it decrypts an offer wrap).
     */
    @PluginMethod
    public void acceptCall(PluginCall call) {
        String callId = call.getString("callId");
        Intent svc = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_ACCEPT_NATIVE);
        if (callId != null) {
            svc.putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, callId);
        }
        try {
            ContextCompat.startForegroundService(getContext(), svc);
        } catch (Exception e) {
            Log.e(TAG, "acceptCall: startForegroundService failed", e);
            call.reject("could not start native voice call accept");
            return;
        }
        call.resolve();
    }

    /**
     * Decline the in-progress incoming call. Routes to the manager so
     * the kind-25054 reject is sent and the local state transitions to
     * ended. The lockscreen Decline button has its own path
     * ({@link IncomingCallActionReceiver}); this method is the
     * in-app overlay equivalent for the foreground-app scenario.
     */
    @PluginMethod
    public void declineCall(PluginCall call) {
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.decline();
        });
        call.resolve();
    }

    /**
     * Hang up the active or in-progress native call from the JS layer.
     */
    @PluginMethod
    public void hangup(PluginCall call) {
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.hangup();
        });
        call.resolve();
    }

    /**
     * Toggle local microphone mute. Args: {@code { muted: boolean }}.
     * Idempotent; setting to the current value is a no-op.
     */
    @PluginMethod
    public void toggleMute(PluginCall call) {
        Boolean muted = call.getBoolean("muted");
        if (muted == null) {
            call.reject("missing required argument: muted");
            return;
        }
        final boolean fMuted = muted;
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.setMuted(fMuted);
        });
        call.resolve();
    }

    /**
     * Called by the JavaScript unlock screen after the user has
     * successfully entered their PIN to unlock a previously-locked
     * nsec while a call accept was pending. Emits the
     * {@link VoiceCallIntentContract#ACTION_UNLOCK_COMPLETE} local
     * broadcast that the active foreground service listens for, so
     * the call accept can resume natively (signing the kind-25051
     * Answer with the just-unlocked secret).
     *
     * <p>Args: {@code { callId: string }}. Best-effort; if no FGS is
     * running for this call, the broadcast is a no-op.
     *
     * <p>Phase 2 of {@code add-native-voice-calls}.
     */
    @PluginMethod
    public void notifyUnlockComplete(PluginCall call) {
        String callId = call.getString("callId");
        if (callId == null) {
            call.reject("missing required argument: callId");
            return;
        }
        try {
            Intent broadcast = new Intent(VoiceCallIntentContract.ACTION_UNLOCK_COMPLETE)
                .putExtra(VoiceCallIntentContract.EXTRA_CALL_ID, callId)
                .setPackage(getContext().getPackageName());
            androidx.localbroadcastmanager.content.LocalBroadcastManager
                .getInstance(getContext())
                .sendBroadcast(broadcast);
        } catch (Throwable t) {
            Log.w(TAG, "notifyUnlockComplete: broadcast failed", t);
        }
        call.resolve();
    }

    /**
     * Toggle speakerphone routing through the system AudioManager.
     * Args: {@code { on: boolean }}.
     */
    @PluginMethod
    public void toggleSpeaker(PluginCall call) {
        Boolean on = call.getBoolean("on");
        if (on == null) {
            call.reject("missing required argument: on");
            return;
        }
        final boolean fOn = on;
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.setSpeakerOn(fOn);
        });
        call.resolve();
    }

    /**
     * Toggle the local camera on / off (track-level mute, no SDP
     * renegotiation). Args: {@code { off: boolean }}. No-op when no
     * native call is active or the active call is voice-only.
     */
    @PluginMethod
    public void toggleCamera(PluginCall call) {
        Boolean off = call.getBoolean("off");
        if (off == null) {
            call.reject("missing required argument: off");
            return;
        }
        final boolean fOff = off;
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.setCameraOff(fOff);
        });
        call.resolve();
    }

    /**
     * Switch between the front and back camera. No args. No-op when
     * no native call is active or the active call is voice-only.
     */
    @PluginMethod
    public void flipCamera(PluginCall call) {
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.flipCamera();
        });
        call.resolve();
    }

    /**
     * NIP-AC kind-25055 voice→video upgrade. No args. Idempotent and
     * guarded — silently no-ops when the call is not eligible
     * (status != active, callKind already video, or another
     * renegotiation already in flight).
     */
    @PluginMethod
    public void requestVideoUpgrade(PluginCall call) {
        runOnMain(() -> {
            NativeVoiceCallManager mgr = VoiceCallForegroundService.getNativeManager();
            if (mgr != null) mgr.requestVideoUpgrade();
        });
        call.resolve();
    }

    private static void runOnMain(Runnable r) {
        new Handler(Looper.getMainLooper()).post(r);
    }

    // ===================================================================
    //  Native voice-call event emitters. Invoked by
    //  NativeVoiceCallManager (or its bridge) from the main thread.
    //  Each safely returns when no plugin instance is registered (the
    //  WebView is dead) so background callers never crash.
    // ===================================================================

    /**
     * Emit a {@code callStateChanged} event when the native call
     * manager transitions between states.
     */
    public static void emitCallStateChanged(String callId, String status, String reason) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("status", status != null ? status : "idle");
        if (reason != null) data.put("reason", reason);
        try {
            p.notifyListeners("callStateChanged", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitCallStateChanged failed", e);
        }
    }

    /**
     * Emit a {@code durationTick} event once per second while the
     * call status is ACTIVE.
     */
    public static void emitDurationTick(String callId, int seconds) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("seconds", seconds);
        try {
            p.notifyListeners("durationTick", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitDurationTick failed", e);
        }
    }

    /**
     * Emit a {@code callError} event when the native call manager
     * encounters an unrecoverable error.
     */
    public static void emitCallError(String callId, String code, String message) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("code", code != null ? code : "unknown");
        data.put("message", message != null ? message : "");
        try {
            p.notifyListeners("callError", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitCallError failed", e);
        }
    }

    /**
     * Emit a {@code muteStateChanged} event after a mute toggle.
     */
    public static void emitMuteStateChanged(String callId, boolean muted) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("muted", muted);
        try {
            p.notifyListeners("muteStateChanged", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitMuteStateChanged failed", e);
        }
    }

    /**
     * Emit a {@code cameraStateChanged} event after the local video
     * track's {@code enabled} flag is flipped (camera-off / on).
     * Voice calls never emit this event.
     */
    public static void emitCameraStateChanged(String callId, boolean cameraOff) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("cameraOff", cameraOff);
        try {
            p.notifyListeners("cameraStateChanged", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitCameraStateChanged failed", e);
        }
    }

    /**
     * Emit a {@code facingModeChanged} event after a successful camera
     * flip ({@link CameraVideoCapturer#switchCamera}). The {@code
     * facing} string matches the JS {@code MediaStreamConstraints}
     * value: {@code "user"} for the front camera and {@code
     * "environment"} for the back camera.
     */
    public static void emitFacingModeChanged(String callId, String facing) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("facing", facing != null ? facing : "user");
        try {
            p.notifyListeners("facingModeChanged", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitFacingModeChanged failed", e);
        }
    }

    /**
     * Emit a {@code renegotiationStateChanged} event when the in-flight
     * NIP-AC kind-25055 renegotiation transitions between IDLE,
     * OUTGOING, INCOMING, or GLARE. The JS layer mirrors the value
     * into the {@code voiceCallState.renegotiationState} store so
     * UI subscribers (e.g., the "Add video" button visibility
     * predicate on the active-call surface) re-render against it.
     */
    public static void emitRenegotiationStateChanged(String callId, String state) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("state", state != null ? state : "idle");
        try {
            p.notifyListeners("renegotiationStateChanged", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitRenegotiationStateChanged failed", e);
        }
    }

    /**
     * Emit a {@code callKindChanged} event when the active call's
     * media kind changes mid-call (e.g., voice→video upgrade via a
     * successful kind-25055 renegotiation). The JS layer mirrors the
     * value into the {@code voiceCallState.callKind} store so the
     * active-call UI re-renders against the new kind without
     * re-emitting {@code callStateChanged} (which would shake other
     * subscribers expecting a status change).
     */
    public static void emitCallKindChanged(String callId, String kind) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("kind", kind != null ? kind : "voice");
        try {
            p.notifyListeners("callKindChanged", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitCallKindChanged failed", e);
        }
    }

    /**
     * Emit a {@code callHistoryWriteRequested} event when the native
     * call manager needs the JS layer to author a LOCAL-ONLY chat-
     * history rumor (types: {@code missed} or {@code cancelled}). The
     * JS handler is expected to call {@code messageRepo.saveMessage}
     * via the existing {@code Messaging.createLocalCallEventMessage}
     * pipeline.
     *
     * <p>{@code peerHex} is the remote peer's pubkey hex (the JS layer
     * converts to npub for {@code messageRepo}). {@code initiatorHex}
     * is the original WebRTC initiator's pubkey hex; pass {@code null}
     * if the local user is the initiator. {@code durationSec} is
     * passed as -1 when not applicable.
     */
    public static void emitCallHistoryWriteRequested(
            String callId,
            String type,
            String peerHex,
            String initiatorHex,
            int durationSec) {
        emitCallHistoryWriteRequested(
            callId, type, peerHex, initiatorHex, durationSec, /* callMediaType= */ "voice");
    }

    /**
     * Same as {@link #emitCallHistoryWriteRequested(String, String, String, String, int)}
     * with an explicit media kind ({@code "voice"} / {@code "video"}).
     * The kind becomes the {@code call-media-type} tag on the
     * authored kind-1405 rumor.
     */
    public static void emitCallHistoryWriteRequested(
            String callId,
            String type,
            String peerHex,
            String initiatorHex,
            int durationSec,
            String callMediaType) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("type", type != null ? type : "");
        data.put("peerHex", peerHex != null ? peerHex : "");
        if (initiatorHex != null) data.put("initiatorHex", initiatorHex);
        if (durationSec >= 0) data.put("durationSec", durationSec);
        data.put("callMediaType",
            callMediaType != null && !callMediaType.isEmpty() ? callMediaType : "voice");
        try {
            p.notifyListeners("callHistoryWriteRequested", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitCallHistoryWriteRequested failed", e);
        }
    }

    /**
     * Emit a {@code callHistoryRumorRequested} event when the native
     * call manager wants the JS layer to author a GIFT-WRAPPED chat-
     * history rumor (types: {@code ended}, {@code no-answer},
     * {@code failed}, {@code busy}). The JS handler is expected to
     * call {@code Messaging.createCallEventMessage}, which gift-wraps
     * the kind-1405 rumor to both the peer and the local user.
     *
     * <p>This is a Phase 1 stopgap; Phase 4 reimplements these types
     * natively by extending {@code sendVoiceCallDeclinedEvent} into
     * a parameterized helper.
     */
    public static void emitCallHistoryRumorRequested(
            String callId,
            String type,
            String peerHex,
            String initiatorHex,
            int durationSec) {
        emitCallHistoryRumorRequested(
            callId, type, peerHex, initiatorHex, durationSec, /* callMediaType= */ "voice");
    }

    /**
     * Same as
     * {@link #emitCallHistoryRumorRequested(String, String, String, String, int)}
     * with an explicit media kind.
     */
    public static void emitCallHistoryRumorRequested(
            String callId,
            String type,
            String peerHex,
            String initiatorHex,
            int durationSec,
            String callMediaType) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        data.put("type", type != null ? type : "");
        data.put("peerHex", peerHex != null ? peerHex : "");
        if (initiatorHex != null) data.put("initiatorHex", initiatorHex);
        if (durationSec >= 0) data.put("durationSec", durationSec);
        data.put("callMediaType",
            callMediaType != null && !callMediaType.isEmpty() ? callMediaType : "voice");
        try {
            p.notifyListeners("callHistoryRumorRequested", data, true);
        } catch (Exception e) {
            Log.w(TAG, "emitCallHistoryRumorRequested failed", e);
        }
    }

    /**
     * Called by {@link VoiceCallActionReceiver} when the user taps "Hang up"
     * in the active-call notification.
     */
    public static void emitHangupRequested(String callId) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        try {
            p.notifyListeners("hangupRequested", data, true);
        } catch (Exception e) {
            Log.w(TAG, "notifyListeners failed", e);
        }
    }

    /**
     * Called by {@link NativeBackgroundMessagingService} when an incoming-call
     * signal arrives while the app is in the foreground; lets JS reach for the
     * offer via {@code getPendingIncomingCall} without waiting for the user
     * to tap the notification.
     */
    public static void emitPendingCallAvailable(String callId) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        try {
            p.notifyListeners("pendingCallAvailable", data, true);
        } catch (Exception e) {
            Log.w(TAG, "notifyListeners failed", e);
        }
    }
}
