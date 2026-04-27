package com.nospeak.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Broadcast receiver for the "Decline" action on the incoming-call notification.
 *
 * On receive:
 * 1. Clears the {@code nospeak_pending_incoming_call} SharedPreferences so a later
 *    cold-start does not auto-accept the declined call.
 * 2. Cancels the incoming-call notification.
 * 3. Best-effort sends a {@code reject} voice-call signal back to the caller through
 *    the messaging service's already-connected WebSocket relays.
 */
public class IncomingCallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "IncomingCallActionRx";

    public static final String ACTION_DECLINE = "com.nospeak.app.voicecall.DECLINE";

    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_SENDER_NPUB = "senderNpub";
    public static final String EXTRA_SENDER_PUBKEY_HEX = "senderPubkeyHex";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (!ACTION_DECLINE.equals(intent.getAction())) return;

        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String senderNpub = intent.getStringExtra(EXTRA_SENDER_NPUB);
        String senderPubkeyHex = intent.getStringExtra(EXTRA_SENDER_PUBKEY_HEX);
        Log.d(TAG, "Decline received for callId=" + callId);

        // 1. Clear pending-call SharedPrefs.
        SharedPreferences prefs = context.getSharedPreferences(
            "nospeak_pending_incoming_call", Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        // 2. Cancel the incoming-call notification.
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
        }

        // 3. Best-effort reject signal via the messaging service.
        NativeBackgroundMessagingService svc = NativeBackgroundMessagingService.getInstance();
        if (svc != null && callId != null && senderPubkeyHex != null) {
            try {
                svc.sendVoiceCallReject(senderPubkeyHex, callId);
            } catch (Exception e) {
                Log.w(TAG, "sendVoiceCallReject failed (best-effort, ignoring)", e);
            }
        } else {
            Log.d(TAG, "Messaging service not running or missing args; skipping reject");
        }
    }
}
