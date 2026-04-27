package com.nospeak.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Broadcast receiver for the "Hang up" action on the active-call notification.
 * Forwards the request to the JS layer via {@link AndroidVoiceCallPlugin#emitHangupRequested}
 * so JS can run {@code voiceCallService.hangup()}, which in turn stops the FGS.
 */
public class VoiceCallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "VoiceCallActionRx";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!VoiceCallForegroundService.ACTION_HANGUP.equals(action)) return;

        String callId = intent.getStringExtra(VoiceCallForegroundService.EXTRA_CALL_ID);
        Log.d(TAG, "Hang up action received for callId=" + callId);

        // Notify JS so it can run voiceCallService.hangup() and trigger the standard
        // teardown (which calls AndroidVoiceCallPlugin.endCallSession to stop the FGS).
        AndroidVoiceCallPlugin.emitHangupRequested(callId);

        // Belt-and-braces: also explicitly stop the service. If JS is alive, the
        // endCallSession call from the hangup handler will be a no-op on this
        // already-stopped service. If JS is gone, this is the only thing that
        // releases the wake lock and audio mode.
        Intent stop = new Intent(context, VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_STOP);
        try {
            context.startService(stop);
        } catch (Exception e) {
            Log.w(TAG, "Failed to stop service from receiver", e);
        }
    }
}
