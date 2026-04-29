package com.nospeak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

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

    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_PEER_NPUB = "peerNpub";
    public static final String EXTRA_PEER_NAME = "peerName";
    public static final String EXTRA_ROLE = "role";

    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean audioModeApplied = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
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
        if (!ACTION_START.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String peerName = intent.getStringExtra(EXTRA_PEER_NAME);
        String role = intent.getStringExtra(EXTRA_ROLE);

        createChannelIfNeeded();
        Notification notif = buildOngoingNotification(callId, peerName, role);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notif,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Cancel any incoming-call notification once we're hosting an active call.
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}

        acquireWakeLock();
        configureAudioMode();
        return START_NOT_STICKY;
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
        restoreAudioMode();
        releaseWakeLock();
        super.onDestroy();
    }

    private Notification buildOngoingNotification(String callId, String peerName, String role) {
        Intent activityIntent = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("nospeak_route_kind", "voice-call-active")
            .putExtra("call_id", callId);
        PendingIntent contentPi = PendingIntent.getActivity(
            this, 0, activityIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent hangupIntent = new Intent(this, VoiceCallActionReceiver.class)
            .setAction(ACTION_HANGUP)
            .putExtra(EXTRA_CALL_ID, callId);
        PendingIntent hangupPi = PendingIntent.getBroadcast(
            this, 1, hangupIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("On call")
            .setContentText(peerName != null ? peerName : "")
            .setSmallIcon(R.drawable.ic_stat_nospeak)
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_call_end, "Hang up", hangupPi)
            .build();
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
