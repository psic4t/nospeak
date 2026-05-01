package com.nospeak.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;

/**
 * Posts and dismisses the high-priority incoming-call notification.
 *
 * <p>The notification uses {@code setFullScreenIntent} to bypass the keyguard on
 * Android 14+ (when the {@code USE_FULL_SCREEN_INTENT} permission is granted).
 * On Android 12+ the heads-up surface (when the phone is unlocked) is rendered
 * via {@link NotificationCompat.CallStyle#forIncomingCall(Person, PendingIntent, PendingIntent)},
 * giving system-styled green Accept / red Decline buttons and the caller's avatar.
 *
 * <p>The Accept action launches {@link IncomingCallActivity} with
 * {@link IncomingCallActivity#ACTION_AUTO_ACCEPT}, which runs the same accept
 * flow as the user tapping Accept on the visible ringing screen (start FGS
 * with ACTION_ACCEPT_NATIVE + launch ActiveCallActivity). Routing through
 * the activity (rather than MainActivity) keeps a single accept code path
 * and avoids races with the JS layer over the
 * {@code nospeak_pending_incoming_call} SharedPreferences slot.
 *
 * <p>The Decline action broadcasts to {@link IncomingCallActionReceiver}.
 *
 * <p>On Android the JS-side {@code IncomingCallOverlay.svelte} no longer renders
 * (the native ringing activity is the authoritative incoming-call UI), so the
 * channel's default ringtone always plays — even when the app is foreground —
 * to ensure the user has an audible cue.
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
        @Nullable Bitmap avatar
    ) {
        createChannelIfNeeded(context);

        // Resolve cached avatar file path for the lockscreen ringing screen
        // (which reads from disk independently of the heads-up notification).
        String avatarPath = null;
        try {
            AndroidProfileCachePrefs.Identity identity =
                AndroidProfileCachePrefs.get(context, senderPubkeyHex);
            String pictureUrl = identity != null ? identity.pictureUrl : null;
            avatarPath = NativeBackgroundMessagingService.resolveCachedAvatarFilePath(
                context, pictureUrl);
        } catch (Throwable t) {
            // Best-effort — fall back to placeholder. Log for diagnostics.
            Log.d(TAG, "Avatar path resolution failed; using placeholder", t);
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

        // Accept tap → IncomingCallActivity with ACTION_AUTO_ACCEPT.
        // The activity runs the same flow as the user tapping Accept on
        // the visible ringing screen (PIN-locked-nsec detection, FGS
        // ACTION_ACCEPT_NATIVE, ActiveCallActivity launch). Single
        // accept code path means no SharedPrefs race with the JS layer.
        Intent acceptIntent = new Intent(context, IncomingCallActivity.class)
            .setAction(IncomingCallActivity.ACTION_AUTO_ACCEPT)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId)
            .putExtra(IncomingCallActivity.EXTRA_PEER_NAME, peerName)
            .putExtra(IncomingCallActivity.EXTRA_SENDER_NPUB, senderNpub)
            .putExtra(IncomingCallActivity.EXTRA_SENDER_PUBKEY_HEX, senderPubkeyHex);
        if (avatarPath != null) {
            acceptIntent.putExtra(IncomingCallActivity.EXTRA_AVATAR_PATH, avatarPath);
        }
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

        // Build the caller Person used by CallStyle. Avatar is the cached
        // circular bitmap (or generated identicon — both produced by the
        // caller in NativeBackgroundMessagingService, mirroring the DM path).
        Person.Builder callerBuilder = new Person.Builder()
            .setName(peerName != null && !peerName.isEmpty() ? peerName : "Unknown")
            .setKey(senderPubkeyHex != null ? senderPubkeyHex : "");
        if (avatar != null) {
            try {
                callerBuilder.setIcon(IconCompat.createWithBitmap(avatar));
            } catch (Throwable t) {
                Log.d(TAG, "Failed to attach caller avatar; continuing without", t);
            }
        }
        Person caller = callerBuilder.build();

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_nospeak)
            .setColor(ContextCompat.getColor(context, R.color.incoming_call_accept))
            .setColorized(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(60_000L)
            .setFullScreenIntent(ringingPi, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePi, acceptPi));

        // Always ring on Android. The JS-side IncomingCallOverlay no longer
        // renders on Android (the native ringing activity is authoritative),
        // so the channel's default ringtone must always play — even when the
        // app is foreground — or the user would have no audible cue.

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
