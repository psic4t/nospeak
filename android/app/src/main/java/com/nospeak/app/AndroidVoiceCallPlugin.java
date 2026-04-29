package com.nospeak.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
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
