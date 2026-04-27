package com.nospeak.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Posts and dismisses the high-priority incoming-call notification.
 *
 * The notification uses {@code setFullScreenIntent} to bypass the keyguard on
 * Android 14+ (when the {@code USE_FULL_SCREEN_INTENT} permission is granted).
 * The Accept button launches MainActivity with {@code accept_pending_call=true};
 * the Decline button broadcasts to {@link IncomingCallActionReceiver}.
 *
 * If the app is currently in the foreground, the notification is posted with
 * {@code setSilent(true)} so the JS in-app ringtone path remains the
 * authoritative audible signal.
 */
public final class IncomingCallNotification {

    private static final String TAG = "IncomingCallNotif";

    public static final String CHANNEL_ID = "nospeak_voice_call_incoming";
    public static final int NOTIFICATION_ID = 0xCA11;

    private IncomingCallNotification() {}

    public static void post(
        Context context,
        String callId,
        String peerName,
        String senderNpub,
        String senderPubkeyHex,
        boolean appVisible
    ) {
        createChannelIfNeeded(context);

        // Resolve cached avatar (best-effort) for the lockscreen ringing screen.
        String avatarPath = null;
        try {
            AndroidProfileCachePrefs.Identity identity =
                AndroidProfileCachePrefs.get(context, senderPubkeyHex);
            String pictureUrl = identity != null ? identity.pictureUrl : null;
            avatarPath = NativeBackgroundMessagingService.resolveCachedAvatarFilePath(
                context, pictureUrl);
        } catch (Throwable t) {
            // Best-effort — fall back to placeholder. Log for diagnostics.
            Log.d(TAG, "Avatar resolution failed; using placeholder", t);
        }

        // Full-screen intent → IncomingCallActivity (the lockscreen ringing screen).
        // This is what gets triggered when the screen is locked. The activity shows
        // Accept/Decline over the keyguard WITHOUT dismissing it.
        Intent ringingIntent = new Intent(context, IncomingCallActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
            .putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId)
            .putExtra(IncomingCallActivity.EXTRA_PEER_NAME, peerName)
            .putExtra(IncomingCallActivity.EXTRA_SENDER_NPUB, senderNpub)
            .putExtra(IncomingCallActivity.EXTRA_SENDER_PUBKEY_HEX, senderPubkeyHex);
        if (avatarPath != null) {
            ringingIntent.putExtra(IncomingCallActivity.EXTRA_AVATAR_PATH, avatarPath);
        }
        PendingIntent ringingPi = PendingIntent.getActivity(
            context, 2, ringingIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Accept tap → MainActivity with accept_pending_call=true and the
        // voice-call-accept route extras.
        Intent acceptIntent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("accept_pending_call", true)
            .putExtra("call_id", callId)
            .putExtra("nospeak_route_kind", "voice-call-accept");
        PendingIntent acceptPi = PendingIntent.getActivity(
            context, 0, acceptIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Decline action → IncomingCallActionReceiver
        Intent declineIntent = new Intent(context, IncomingCallActionReceiver.class)
            .setAction(IncomingCallActionReceiver.ACTION_DECLINE)
            .putExtra(IncomingCallActionReceiver.EXTRA_CALL_ID, callId)
            .putExtra(IncomingCallActionReceiver.EXTRA_SENDER_NPUB, senderNpub)
            .putExtra(IncomingCallActionReceiver.EXTRA_SENDER_PUBKEY_HEX, senderPubkeyHex);
        PendingIntent declinePi = PendingIntent.getBroadcast(
            context, 1, declineIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Incoming call")
            .setContentText(peerName != null ? peerName : "")
            .setSmallIcon(R.drawable.ic_stat_call)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(60_000L)
            .setFullScreenIntent(ringingPi, true)
            .setContentIntent(acceptPi)
            .addAction(R.drawable.ic_stat_call, "Accept", acceptPi)
            .addAction(R.drawable.ic_call_end, "Decline", declinePi);

        if (appVisible) {
            // Foreground app: JS handles the ringtone via ringtone.ts.
            // Suppress the channel default sound to avoid double-ringing.
            b.setSilent(true);
        }

        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, b.build());
        }
    }

    public static void cancel(Context context) {
        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }
    }

    private static void createChannelIfNeeded(Context context) {
        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Incoming calls",
            NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Ring for incoming voice calls");
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] { 0, 800, 500, 800, 500, 800 });
        ch.setShowBadge(false);

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri != null) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            ch.setSound(ringtoneUri, attrs);
        }

        nm.createNotificationChannel(ch);
    }
}
