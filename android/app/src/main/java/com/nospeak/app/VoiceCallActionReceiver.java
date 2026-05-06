package com.nospeak.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Broadcast receiver for the "Hang up" action on the active-call notification.
 * Forwards the request to the JS layer via {@link AndroidVoiceCallPlugin#emitHangupRequested}
 * so JS can run {@code voiceCallService.hangup()}, which calls into
 * {@link AndroidVoiceCallPlugin#hangup} → {@link NativeVoiceCallManager#hangup}
 * → {@code finishCall("hangup", sendHangup=true)}. That standard teardown
 * publishes the kind-25053 NIP-AC hangup to the peer AND schedules a
 * delayed {@code ACTION_STOP} that dismisses the FGS notification ~1500 ms
 * later.
 *
 * <p>We deliberately do NOT also fire {@code ACTION_STOP} from this
 * receiver: that would race the JS roundtrip and stop the FGS (and
 * dispose the call manager — flipping {@code disposed=true} so
 * {@code finishCall} early-returns) before {@code mgr.hangup()} could
 * publish the kind-25053 hangup, leaving the peer's connection up until
 * it errors with "connection lost".
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

        // The standard hangup chain (JS → mgr.hangup() → finishCall) is
        // the only place that publishes kind-25053 to the peer. Firing
        // ACTION_STOP here too would race that chain and dispose the
        // manager before the publish; see class javadoc.
        AndroidVoiceCallPlugin.emitHangupRequested(callId);
    }
}
