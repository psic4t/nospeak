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
 * On receive (UI thread):
 * 1. Clears the {@code nospeak_pending_incoming_call} SharedPreferences so a later
 *    cold-start does not auto-accept the declined call.
 * 2. Cancels the incoming-call notification.
 * 3. Off the UI thread (via {@link #goAsync()}): sends a NIP-17 gift-wrapped
 *    {@code reject} voice-call signal to the caller through the messaging service's
 *    already-connected WebSocket relays.
 *
 * Step 3 is async because it can take up to a few seconds (Amber NIP-55
 * ContentResolver round-trip + relay publish) and must never block the main thread.
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

        final String callId = intent.getStringExtra(EXTRA_CALL_ID);
        final String senderPubkeyHex = intent.getStringExtra(EXTRA_SENDER_PUBKEY_HEX);
        Log.d(TAG, "Decline received for callId=" + callId);

        // Synchronous, fast: clear local state and dismiss the UI cue.
        SharedPreferences prefs = context.getSharedPreferences(
            "nospeak_pending_incoming_call", Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
        }

        // Asynchronous: send the reject signal off the main thread. goAsync()
        // keeps the receiver alive for up to ~10s while the background work runs.
        final NativeBackgroundMessagingService svc =
            NativeBackgroundMessagingService.getInstance();
        if (svc == null || callId == null || senderPubkeyHex == null) {
            Log.d(TAG, "Messaging service not running or missing args; skipping reject");
            return;
        }

        final PendingResult pendingResult = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    svc.sendVoiceCallReject(senderPubkeyHex, callId);
                } catch (Exception e) {
                    Log.w(TAG, "sendVoiceCallReject failed (best-effort, ignoring)", e);
                } finally {
                    pendingResult.finish();
                }
            }
        }, "nospeak-reject-send").start();
    }
}
