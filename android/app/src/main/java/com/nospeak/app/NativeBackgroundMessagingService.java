package com.nospeak.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.service.notification.StatusBarNotification;
import android.util.Base64;
import android.util.Log;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.bouncycastle.asn1.sec.SECNamedCurves;
import org.bouncycastle.asn1.x9.X9ECParameters;
import org.bouncycastle.crypto.engines.ChaCha7539Engine;
import org.bouncycastle.crypto.params.KeyParameter;
import org.bouncycastle.crypto.params.ParametersWithIV;
import org.bouncycastle.math.ec.ECPoint;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;


public class NativeBackgroundMessagingService extends Service {


    private static final String LOG_TAG = "NativeBgMsgService";

    public static final String ACTION_START = "com.nospeak.app.NATIVE_BG_MSG_START";
    public static final String ACTION_UPDATE = "com.nospeak.app.NATIVE_BG_MSG_UPDATE";

    public static final String EXTRA_MODE = "mode"; // "nsec" or "amber"
    public static final String EXTRA_PUBKEY_HEX = "pubkeyHex";
    public static final String EXTRA_NSEC_HEX = "nsecHex";
    public static final String EXTRA_READ_RELAYS = "readRelays";
    public static final String EXTRA_SUMMARY = "summary";
    public static final String EXTRA_NOTIFICATIONS_ENABLED = "notificationsEnabled";

    public static final String ACTION_SET_ACTIVE_CONVERSATION = "com.nospeak.app.SET_ACTIVE_CONVERSATION";
    public static final String EXTRA_ACTIVE_CONVERSATION_PUBKEY = "activeConversationPubkey";

    public static final String EXTRA_ROUTE_KIND = "nospeak_route_kind";
    public static final String EXTRA_ROUTE_PARTNER_PUBKEY_HEX = "nospeak_partner_pubkey_hex";

    private static final String ROUTE_KIND_CHAT = "chat";

    private static final String CHANNEL_ID = "nospeak_background_service";
    private static final String CHANNEL_MESSAGES_ID = "nospeak_background_messages";
    private static final int NOTIFICATION_ID = 1001;

    private static final int PREVIEW_TRUNCATE_CHARS = 160;
    private static final String DEDUPE_PREFS_NAME = "nospeak_background_messaging_dedupe";
    private static final String DEDUPE_PREFS_KEY_IDS = "seenEventIdsJson";
    private static final int MAX_PERSISTED_EVENT_IDS = 500;

    private static final long MAX_NOTIFICATION_BACKLOG_SECONDS = 15L * 60L;

    private static final int ACTIVE_PING_SECONDS = 120;
    private static final int LOCKED_PING_SECONDS = 300;
    private static final long LOCK_GRACE_MS = 60_000L;

    private String currentSummary = "Connected to read relays";

    private OkHttpClient client;
    private final Set<WebSocket> sockets = new HashSet<>();

    private final Set<String> seenEventIds = new HashSet<>();
    private final ArrayDeque<String> seenEventIdQueue = new ArrayDeque<>();



    private final Map<String, Integer> conversationActivityCounts = new HashMap<>();
    private final Map<String, String> conversationLastPreview = new HashMap<>();
    private final Map<String, Long> conversationLastTimestampMs = new HashMap<>();

    private final Map<String, Bitmap> avatarBitmaps = new HashMap<>();
    private final Map<String, String> avatarBitmapKeys = new HashMap<>();
    private final Set<String> avatarFetchInFlight = new HashSet<>();

    private final Set<String> conversationShortcutsPublished = new HashSet<>();
    private final Map<String, String> conversationShortcutAvatarKeys = new HashMap<>();

    private String currentPubkeyHex;
    private String currentMode = "amber";
    private boolean notificationsEnabled = false;
    private long notificationCutoffSeconds = 0L;

    private byte[] localSecretKey;

    private int configuredRelaysCount = 0;
    private String[] configuredRelays = new String[0];

    private int currentPingSeconds = ACTIVE_PING_SECONDS;
    private boolean lockedProfileActive = false;

    private volatile String activeConversationPubkeyHex = null;

    private long screenOffAtMs = 0L;
    private boolean isCharging = false;

    private BroadcastReceiver deviceStateReceiver;
    private Runnable lockGraceRunnable;
 
    private final Map<String, WebSocket> activeSockets = new HashMap<>();
    private final Map<String, Integer> retryAttempts = new HashMap<>();
    private Handler handler;
    private boolean serviceRunning = false;

    private OkHttpClient buildOkHttpClient(int pingSeconds) {
        return new OkHttpClient.Builder()
                .pingInterval(pingSeconds, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
    }

    private boolean isDebugBuild() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private boolean isDeviceLockedNow() {
        KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (keyguardManager == null) {
            return screenOffAtMs > 0L;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return keyguardManager.isDeviceLocked();
        }

        return keyguardManager.isKeyguardLocked();
    }

    private void refreshChargingState() {
        Intent batteryStatus = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (batteryStatus == null) {
            return;
        }

        int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL;

        int plugged = batteryStatus.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
        if (plugged != 0) {
            charging = true;
        }

        isCharging = charging;
    }

    private void cancelLockGraceTimer() {
        if (handler == null || lockGraceRunnable == null) {
            return;
        }

        handler.removeCallbacks(lockGraceRunnable);
    }

    private void scheduleLockGraceTimer() {
        if (handler == null || lockGraceRunnable == null) {
            return;
        }

        cancelLockGraceTimer();
        handler.postDelayed(lockGraceRunnable, LOCK_GRACE_MS);
    }

    private boolean shouldUseLockedProfile() {
        if (isCharging) {
            return false;
        }

        if (!isDeviceLockedNow()) {
            return false;
        }

        if (screenOffAtMs <= 0L) {
            return false;
        }

        long lockedAgeMs = System.currentTimeMillis() - screenOffAtMs;
        return lockedAgeMs >= LOCK_GRACE_MS;
    }

    private void evaluateAndApplyEnergyProfile(String reason) {
        if (!serviceRunning) {
            return;
        }

        int desiredPingSeconds = shouldUseLockedProfile() ? LOCKED_PING_SECONDS : ACTIVE_PING_SECONDS;
        boolean desiredLockedProfileActive = desiredPingSeconds == LOCKED_PING_SECONDS;

        if (desiredPingSeconds == currentPingSeconds && desiredLockedProfileActive == lockedProfileActive) {
            return;
        }

        int previousPingSeconds = currentPingSeconds;
        boolean previousLockedProfileActive = lockedProfileActive;

        currentPingSeconds = desiredPingSeconds;
        lockedProfileActive = desiredLockedProfileActive;
        client = buildOkHttpClient(desiredPingSeconds);

        if (isDebugBuild()) {
            long screenOffAgeMs = screenOffAtMs > 0L ? (System.currentTimeMillis() - screenOffAtMs) : 0L;
            String from = previousLockedProfileActive ? "locked" : "active";
            String to = desiredLockedProfileActive ? "locked" : "active";
            Log.d(
                    LOG_TAG,
                    "Energy profile switch (reason=" + reason + ") "
                            + from + "→" + to
                            + " ping=" + previousPingSeconds + "→" + desiredPingSeconds
                            + " charging=" + isCharging
                            + " screenOffAgeMs=" + screenOffAgeMs
            );
        }

        updateServiceNotificationForHealth();

        if (previousLockedProfileActive && !lockedProfileActive) {
            refreshActiveConversationNotifications();
        }
    }
  
    @Override
    public void onCreate() {
        super.onCreate();

        currentPingSeconds = ACTIVE_PING_SECONDS;
        lockedProfileActive = false;
        client = buildOkHttpClient(currentPingSeconds);

        handler = new Handler(Looper.getMainLooper());
        serviceRunning = true;

        createNotificationChannel();
        loadPersistedSeenEventIds();

        refreshChargingState();

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean interactive = powerManager != null && powerManager.isInteractive();
        if (!interactive) {
            screenOffAtMs = System.currentTimeMillis();
        }

        lockGraceRunnable = new Runnable() {
            @Override
            public void run() {
                evaluateAndApplyEnergyProfile("lock_grace_elapsed");
            }
        };

        deviceStateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) {
                    return;
                }

                String action = intent.getAction();
                if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    screenOffAtMs = System.currentTimeMillis();
                    scheduleLockGraceTimer();
                    evaluateAndApplyEnergyProfile("screen_off");
                    return;
                }

                if (Intent.ACTION_USER_PRESENT.equals(action)) {
                    screenOffAtMs = 0L;
                    cancelLockGraceTimer();
                    evaluateAndApplyEnergyProfile("user_present");
                    return;
                }

                if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                    isCharging = true;
                    evaluateAndApplyEnergyProfile("power_connected");
                    return;
                }

                if (Intent.ACTION_POWER_DISCONNECTED.equals(action)) {
                    isCharging = false;
                    evaluateAndApplyEnergyProfile("power_disconnected");
                }
            }
        };

        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(Intent.ACTION_SCREEN_OFF);
        intentFilter.addAction(Intent.ACTION_USER_PRESENT);
        intentFilter.addAction(Intent.ACTION_POWER_CONNECTED);
        intentFilter.addAction(Intent.ACTION_POWER_DISCONNECTED);
        registerReceiver(deviceStateReceiver, intentFilter);

        if (screenOffAtMs > 0L) {
            scheduleLockGraceTimer();
        }
    }


    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Intent restoredIntent = AndroidBackgroundMessagingPrefs.buildStartServiceIntent(getApplicationContext());
            if (restoredIntent == null) {
                stopSelf();
                return START_NOT_STICKY;
            }
            intent = restoredIntent;
        }

        String action = intent.getAction();
        if (ACTION_UPDATE.equals(action)) {
            String summary = intent.getStringExtra(EXTRA_SUMMARY);
            if (summary != null) {
                currentSummary = summary;
                updateServiceNotificationForHealth();
            }
            return START_STICKY;
        }

        if (ACTION_START.equals(action) || action == null) {
            String summary = intent.getStringExtra(EXTRA_SUMMARY);
            if (summary != null) {
                currentSummary = summary;
            }

            currentMode = intent.getStringExtra(EXTRA_MODE);
            if (currentMode == null) {
                currentMode = "amber";
            }

            currentPubkeyHex = intent.getStringExtra(EXTRA_PUBKEY_HEX);
            notificationsEnabled = intent.getBooleanExtra(EXTRA_NOTIFICATIONS_ENABLED, false);
            String[] relays = intent.getStringArrayExtra(EXTRA_READ_RELAYS);
            configuredRelays = relays != null ? relays : new String[0];
            configuredRelaysCount = configuredRelays.length;

            long persistedBaselineSeconds = AndroidBackgroundMessagingPrefs.loadNotificationBaselineSeconds(getApplicationContext());
            long nowSeconds = System.currentTimeMillis() / 1000L;
            long maxBacklogCutoffSeconds = Math.max(0L, nowSeconds - MAX_NOTIFICATION_BACKLOG_SECONDS);
            notificationCutoffSeconds = Math.max(persistedBaselineSeconds, maxBacklogCutoffSeconds);

            Notification notification = buildNotification(currentSummary);
            startForeground(NOTIFICATION_ID, notification);

            if ("nsec".equalsIgnoreCase(currentMode)) {
                String secretKeyHex = AndroidLocalSecretStore.getSecretKeyHex(getApplicationContext());
                if (secretKeyHex == null) {
                    disableBackgroundMessagingDueToMissingSecret();
                    return START_NOT_STICKY;
                }

                try {
                    localSecretKey = hexToBytes(secretKeyHex);
                } catch (Exception e) {
                    disableBackgroundMessagingDueToMissingSecret();
                    return START_NOT_STICKY;
                }
            } else {
                localSecretKey = null;
            }

            if (currentPubkeyHex != null && configuredRelays.length > 0) {
                startRelayConnections(configuredRelays, currentPubkeyHex);
            } else {
                // No valid relays; still keep notification accurate.
                updateServiceNotificationForHealth();
            }

            evaluateAndApplyEnergyProfile("start");

            return START_STICKY;
        }

        if (ACTION_SET_ACTIVE_CONVERSATION.equals(action)) {
            String pubkey = intent.getStringExtra(EXTRA_ACTIVE_CONVERSATION_PUBKEY);
            activeConversationPubkeyHex = (pubkey != null && !pubkey.isEmpty()) ? pubkey : null;
            return START_STICKY;
        }

        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        serviceRunning = false;

        cancelLockGraceTimer();
        lockGraceRunnable = null;

        if (deviceStateReceiver != null) {
            try {
                unregisterReceiver(deviceStateReceiver);
            } catch (IllegalArgumentException ignored) {
                // ignore
            }
            deviceStateReceiver = null;
        }

        super.onDestroy();
  
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
        }
 
        synchronized (activeSockets) {
            for (WebSocket socket : activeSockets.values()) {
                socket.close(1000, "Service destroyed");
            }
            activeSockets.clear();
        }
        sockets.clear();
        seenEventIds.clear();
        seenEventIdQueue.clear();
        conversationActivityCounts.clear();
        conversationLastPreview.clear();
        conversationLastTimestampMs.clear();
        avatarBitmaps.clear();
        avatarBitmapKeys.clear();
        avatarFetchInFlight.clear();
        conversationShortcutsPublished.clear();
        conversationShortcutAvatarKeys.clear();
        retryAttempts.clear();
    }
 
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) {
                return;
            }

            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "nospeak background messaging",
                        NotificationManager.IMPORTANCE_MIN
                );
                channel.setDescription("Keeps nospeak connected to read relays in the background");
                // Do not show app icon badge for the persistent foreground-service notification.
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
            }

            if (manager.getNotificationChannel(CHANNEL_MESSAGES_ID) == null) {
                NotificationChannel messagesChannel = new NotificationChannel(
                        CHANNEL_MESSAGES_ID,
                        "nospeak background messages",
                        NotificationManager.IMPORTANCE_HIGH
                );
                messagesChannel.setDescription("Notifications for new encrypted messages received in background");
                // Allow app icon badges for actual message notifications.
                messagesChannel.setShowBadge(true);

                messagesChannel.enableVibration(true);
                messagesChannel.setVibrationPattern(new long[] { 0, 250, 250, 250 });
                messagesChannel.enableLights(true);
                messagesChannel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);

                Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                if (sound != null) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    messagesChannel.setSound(sound, attrs);
                }

                manager.createNotificationChannel(messagesChannel);
            }
        }
    }
 
 
     private void startRelayConnections(String[] relays, String pubkeyHex) {
        synchronized (activeSockets) {
            for (WebSocket socket : activeSockets.values()) {
                socket.close(1000, "Restarting connections");
            }
            activeSockets.clear();
        }
        sockets.clear();
        retryAttempts.clear();
 
        if (relays == null) {
            updateServiceNotificationForHealth();
            return;
        }
 
        for (String relayUrl : relays) {
            connectRelay(relayUrl, pubkeyHex);
        }
        updateServiceNotificationForHealth();
    }
 
    private void connectRelay(final String relayUrl, final String pubkeyHex) {
        if (!serviceRunning) {
            return;
        }
        if (relayUrl == null || relayUrl.isEmpty()) {
            return;
        }
 
        Request request = new Request.Builder()
                .url(relayUrl)
                .build();
 
        WebSocket socket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                synchronized (activeSockets) {
                    activeSockets.put(relayUrl, webSocket);
                }
                retryAttempts.put(relayUrl, 0);
 
                try {
                    JSONArray filters = new JSONArray();
                    JSONObject filter = new JSONObject();
                    filter.put("kinds", new JSONArray().put(1059));
 
                    JSONArray pTag = new JSONArray();
                    pTag.put(pubkeyHex);
                    filter.put("#p", pTag);
                    filters.put(filter);
 
                    JSONArray req = new JSONArray();
                    req.put("REQ");
                    req.put("nospeak-native-bg");
                    req.put(filter);
 
                    webSocket.send(req.toString());
                } catch (JSONException e) {
                    // Ignore malformed JSON construction
                }

                if (isDebugBuild()) {
                    Log.d(LOG_TAG, "Relay connected: " + relayUrl);
                }

                updateServiceNotificationForHealth();
            }
 
            @Override
            public void onMessage(WebSocket webSocket, String text) {
                handleNostrMessage(webSocket, text);
            }
 
            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                handleNostrMessage(webSocket, bytes.utf8());
            }
 
            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                onSocketClosedOrFailed(relayUrl, webSocket, "closed code=" + code + " reason=" + reason);
            }
 
            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                String detail = t != null ? ("failure " + t.getClass().getSimpleName() + ": " + t.getMessage()) : "failure";
                onSocketClosedOrFailed(relayUrl, webSocket, detail);
            }
        });
 
        sockets.add(socket);
    }
 
    private void onSocketClosedOrFailed(final String relayUrl, WebSocket socket) {
        onSocketClosedOrFailed(relayUrl, socket, null);
    }

    private void onSocketClosedOrFailed(final String relayUrl, WebSocket socket, @Nullable String detail) {
        synchronized (activeSockets) {
            WebSocket current = activeSockets.get(relayUrl);
            if (current == socket) {
                activeSockets.remove(relayUrl);
            }
        }

        if (isDebugBuild()) {
            String suffix = detail != null && !detail.trim().isEmpty() ? (" (" + detail + ")") : "";
            Log.d(LOG_TAG, "Relay disconnected: " + relayUrl + suffix);
        }
 
        if (!serviceRunning || handler == null) {
            updateServiceNotificationForHealth();
            return;
        }
 
        int attempt = retryAttempts.containsKey(relayUrl) ? retryAttempts.get(relayUrl) : 0;
        int delaySeconds = (int) Math.pow(2, attempt);
        if (delaySeconds > 300) {
            delaySeconds = 300;
        }
        retryAttempts.put(relayUrl, attempt + 1);
 
        updateServiceNotificationForHealth();
 
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!serviceRunning || currentPubkeyHex == null) {
                    return;
                }
                connectRelay(relayUrl, currentPubkeyHex);
            }
        }, delaySeconds * 1000L);
    }


    private void handleNostrMessage(WebSocket socket, String text) {
        try {
            JSONArray arr = new JSONArray(text);
            if (arr.length() < 2) return;

            String type = arr.optString(0, "");

            if ("EOSE".equals(type)) {
                return;
            }
 
            if (!"EVENT".equals(type) || arr.length() < 3) return;

            JSONObject event = arr.optJSONObject(2);
            if (event == null) return;

            int kind = event.optInt("kind", -1);
            if (kind != 1059) return;

            String id = event.optString("id", null);
            if (id == null) return;

            synchronized (seenEventIds) {
                if (seenEventIds.contains(id)) {
                    return;
                }
            }
 
            handleLiveGiftWrapEvent(event, id);


        } catch (JSONException e) {
            // Ignore malformed messages
        }
    }

    private void handleLiveGiftWrapEvent(JSONObject giftWrapEvent, String eventId) {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        if (currentPubkeyHex == null || currentPubkeyHex.isEmpty()) {
            return;
        }

        DecryptedRumor rumor = tryDecryptGiftWrapToRumor(giftWrapEvent, currentPubkeyHex);
        if (rumor == null) {
            if (isDebugBuild()) {
                Log.d(LOG_TAG, "Skip gift wrap " + eventId + ": decrypt_failed");
            }
            // Testing-stage behavior: suppress generic "new encrypted message" notifications.
            return;
        }
 
        long nowSeconds = System.currentTimeMillis() / 1000L;
        long rumorCreatedAtSeconds = rumor.createdAtSeconds > 0L ? rumor.createdAtSeconds : nowSeconds;
        if (rumorCreatedAtSeconds < notificationCutoffSeconds) {
            if (isDebugBuild()) {
                Log.d(
                        LOG_TAG,
                        "Skip gift wrap " + eventId + ": before_cutoff createdAt="
                                + rumorCreatedAtSeconds
                                + " cutoff="
                                + notificationCutoffSeconds
                );
            }
            return;
        }

        if (rumor.pubkeyHex == null || rumor.pubkeyHex.isEmpty()) {
            return;
        }

        // Suppress notifications for self-authored rumors (including self-sent copies).
        if (rumor.pubkeyHex.equalsIgnoreCase(currentPubkeyHex)) {
            return;
        }

        // Only notify for decrypted DMs (kinds 14 and 15). Reactions (kind 7) and other rumor kinds
        // are treated as background activity but do not produce OS notifications.
        if (rumor.kind != 14 && rumor.kind != 15) {
            return;
        }

        String partnerPubkeyHex = rumor.pubkeyHex;

        // Suppress notification only if user is actively viewing this specific conversation
        if (shouldSuppressNotificationForConversation(partnerPubkeyHex)) {
            return;
        }

        String preview = resolveRumorPreview(rumor);
        if (preview == null) {
            return;
        }

        if (!markEventIdSeen(eventId)) {
            return;
        }
 
        showConversationActivityNotification(partnerPubkeyHex, preview);

        if (rumorCreatedAtSeconds > notificationCutoffSeconds) {
            notificationCutoffSeconds = rumorCreatedAtSeconds;
            AndroidBackgroundMessagingPrefs.saveNotificationBaselineSeconds(getApplicationContext(), notificationCutoffSeconds);
        }
    }

    private static final int AVATAR_TARGET_PX = 192;

    private void showConversationActivityNotification(String partnerPubkeyHex, String latestPreview) {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        int notificationId = Math.abs(partnerPubkeyHex.hashCode());
        int requestCode = notificationId + 2000;

        String body = buildCombinedActivityBody(partnerPubkeyHex, latestPreview);
        PendingIntent pendingIntent = buildChatPendingIntent(partnerPubkeyHex, requestCode);

        AndroidProfileCachePrefs.Identity identity = AndroidProfileCachePrefs.get(getApplicationContext(), partnerPubkeyHex);
        String title = identity != null && identity.username != null && !identity.username.trim().isEmpty()
                ? identity.username.trim()
                : "New activity";
        String pictureUrl = identity != null ? identity.pictureUrl : null;

        Bitmap avatar = resolveCachedAvatarBitmap(partnerPubkeyHex, pictureUrl);
        long timestampMs = getConversationLastTimestampMs(partnerPubkeyHex);

        Person userPerson = new Person.Builder()
                .setName("You")
                .build();

        Person.Builder senderPersonBuilder = new Person.Builder()
                .setName(title)
                .setKey(partnerPubkeyHex);
        if (avatar != null) {
            senderPersonBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        }
        Person senderPerson = senderPersonBuilder.build();

        NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(userPerson)
                .setConversationTitle(title)
                .setGroupConversation(false);
        messagingStyle.addMessage(new NotificationCompat.MessagingStyle.Message(body, timestampMs, senderPerson));

        String conversationId = buildConversationId(partnerPubkeyHex);
        String avatarKey = pictureUrl != null ? computeAvatarKey(pictureUrl.trim()) : null;
        boolean shortcutAvailable = false;
        if (!lockedProfileActive) {
            shortcutAvailable = ensureConversationShortcut(partnerPubkeyHex, title, senderPerson, avatar, avatarKey);
        }

        if (!lockedProfileActive && avatar == null && pictureUrl != null && !pictureUrl.trim().isEmpty()) {
            fetchConversationAvatar(partnerPubkeyHex, pictureUrl.trim());
        }

        NotificationCompat.Builder builder = buildConversationNotificationBuilder(
                title,
                body,
                pendingIntent,
                senderPerson,
                messagingStyle,
                avatar,
                shortcutAvailable ? conversationId : null
        );

        // Refreshes should never re-alert (vibrate/sound).
        builder.setOnlyAlertOnce(true);
  
        manager.notify(notificationId, builder.build());
    }

    private static String buildConversationId(String partnerPubkeyHex) {
        return "chat_" + partnerPubkeyHex;
    }

    private Intent buildChatIntent(String partnerPubkeyHex) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        intent.setData(Uri.parse("nospeak://chat/" + partnerPubkeyHex));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(EXTRA_ROUTE_KIND, ROUTE_KIND_CHAT);
        intent.putExtra(EXTRA_ROUTE_PARTNER_PUBKEY_HEX, partnerPubkeyHex);
        return intent;
    }

    private PendingIntent buildChatPendingIntent(String partnerPubkeyHex, int requestCode) {
        return PendingIntent.getActivity(
                this,
                requestCode,
                buildChatIntent(partnerPubkeyHex),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private boolean ensureConversationShortcut(
            String partnerPubkeyHex,
            String title,
            Person senderPerson,
            Bitmap avatar,
            String avatarKey
    ) {
        boolean wasPublished;
        synchronized (conversationShortcutsPublished) {
            wasPublished = conversationShortcutsPublished.contains(partnerPubkeyHex);
        }

        boolean shouldPublish = !wasPublished;

        if (avatar != null && avatarKey != null && !avatarKey.isEmpty()) {
            synchronized (conversationShortcutAvatarKeys) {
                String existingKey = conversationShortcutAvatarKeys.get(partnerPubkeyHex);
                if (existingKey == null || !avatarKey.equals(existingKey)) {
                    conversationShortcutAvatarKeys.put(partnerPubkeyHex, avatarKey);
                    shouldPublish = true;
                }
            }
        }

        if (!shouldPublish) {
            return true;
        }

        String shortcutId = buildConversationId(partnerPubkeyHex);
        ShortcutInfoCompat.Builder shortcutBuilder = new ShortcutInfoCompat.Builder(this, shortcutId)
                .setShortLabel(title)
                .setIntent(buildChatIntent(partnerPubkeyHex))
                .setLongLived(true)
                .setPerson(senderPerson);

        if (avatar != null) {
            shortcutBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        }

        try {
            ShortcutManagerCompat.pushDynamicShortcut(this, shortcutBuilder.build());
        } catch (RuntimeException e) {
            Log.w(LOG_TAG, "Failed to publish conversation shortcut", e);
            return wasPublished;
        }

        synchronized (conversationShortcutsPublished) {
            conversationShortcutsPublished.add(partnerPubkeyHex);
        }

        return true;
    }

    private Notification buildRedactedPublicConversationNotification(
            String title,
            PendingIntent pendingIntent,
            Bitmap avatar,
            @Nullable String conversationId,
            Person senderPerson
    ) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle(title)
                .setContentText("New message")
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .addPerson(senderPerson);

        if (conversationId != null && !conversationId.isEmpty()) {
            try {
                builder.setShortcutId(conversationId);
            } catch (RuntimeException e) {
                Log.w(LOG_TAG, "Failed to bind public notification to shortcut", e);
            }
        }

        if (avatar != null) {
            builder.setLargeIcon(avatar);
        }

        return builder.build();
    }

    private NotificationCompat.Builder buildConversationNotificationBuilder(
            String title,
            String body,
            PendingIntent pendingIntent,
            Person senderPerson,
            NotificationCompat.MessagingStyle messagingStyle,
            Bitmap avatar,
            @Nullable String conversationId
    ) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .addPerson(senderPerson)
                .setStyle(messagingStyle);

        builder.setPublicVersion(buildRedactedPublicConversationNotification(title, pendingIntent, avatar, conversationId, senderPerson));

        if (conversationId != null && !conversationId.isEmpty()) {
            try {
                builder.setShortcutId(conversationId);
            } catch (RuntimeException e) {
                Log.w(LOG_TAG, "Failed to bind notification to shortcut", e);
            }
        }

        if (avatar != null) {
            builder.setLargeIcon(avatar);
        }

        return builder;
    }

    private String buildCombinedActivityBody(String partnerPubkeyHex, String latestPreview) {
        long now = System.currentTimeMillis();
        synchronized (conversationActivityCounts) {
            Integer current = conversationActivityCounts.get(partnerPubkeyHex);
            int nextCount = current != null ? current + 1 : 1;
            conversationActivityCounts.put(partnerPubkeyHex, nextCount);
            conversationLastPreview.put(partnerPubkeyHex, latestPreview);
            conversationLastTimestampMs.put(partnerPubkeyHex, now);
        }

        return latestPreview;
    }

    private String buildCurrentActivityBody(String partnerPubkeyHex) {
        String preview;

        synchronized (conversationActivityCounts) {
            preview = conversationLastPreview.get(partnerPubkeyHex);
        }

        if (preview == null || preview.trim().isEmpty()) {
            return "New message";
        }

        return preview;
    }

    private long getConversationLastTimestampMs(String partnerPubkeyHex) {
        synchronized (conversationActivityCounts) {
            Long timestamp = conversationLastTimestampMs.get(partnerPubkeyHex);
            if (timestamp != null) {
                return timestamp;
            }
        }

        return System.currentTimeMillis();
    }

    private void refreshActiveConversationNotifications() {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        String[] pubkeys;
        synchronized (conversationActivityCounts) {
            pubkeys = conversationActivityCounts.keySet().toArray(new String[0]);
        }

        for (String pubkeyHex : pubkeys) {
            if (pubkeyHex == null || pubkeyHex.trim().isEmpty()) {
                continue;
            }
            refreshConversationActivityNotification(pubkeyHex);
        }
    }

    private void refreshConversationActivityNotification(String partnerPubkeyHex) {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        int notificationId = Math.abs(partnerPubkeyHex.hashCode());
        int requestCode = notificationId + 2000;

        boolean isNotificationActive = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            isNotificationActive = false;
            StatusBarNotification[] active = manager.getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    if (sbn != null && sbn.getId() == notificationId) {
                        isNotificationActive = true;
                        break;
                    }
                }
            }
        }

        PendingIntent pendingIntent = buildChatPendingIntent(partnerPubkeyHex, requestCode);
        String body = buildCurrentActivityBody(partnerPubkeyHex);

        AndroidProfileCachePrefs.Identity identity = AndroidProfileCachePrefs.get(getApplicationContext(), partnerPubkeyHex);
        String title = identity != null && identity.username != null && !identity.username.trim().isEmpty()
                ? identity.username.trim()
                : "New activity";
        String pictureUrl = identity != null ? identity.pictureUrl : null;

        Bitmap avatar = resolveCachedAvatarBitmap(partnerPubkeyHex, pictureUrl);
        long timestampMs = getConversationLastTimestampMs(partnerPubkeyHex);

        Person userPerson = new Person.Builder()
                .setName("You")
                .build();

        Person.Builder senderPersonBuilder = new Person.Builder()
                .setName(title)
                .setKey(partnerPubkeyHex);
        if (avatar != null) {
            senderPersonBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        }
        Person senderPerson = senderPersonBuilder.build();

        NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(userPerson)
                .setConversationTitle(title)
                .setGroupConversation(false);
        messagingStyle.addMessage(new NotificationCompat.MessagingStyle.Message(body, timestampMs, senderPerson));

        String conversationId = buildConversationId(partnerPubkeyHex);
        String avatarKey = pictureUrl != null ? computeAvatarKey(pictureUrl.trim()) : null;
        boolean shortcutAvailable = false;
        if (!lockedProfileActive) {
            shortcutAvailable = ensureConversationShortcut(partnerPubkeyHex, title, senderPerson, avatar, avatarKey);
        }
 
        if (!lockedProfileActive && avatar == null && pictureUrl != null && !pictureUrl.trim().isEmpty()) {
            fetchConversationAvatar(partnerPubkeyHex, pictureUrl.trim());
        }

        if (!isNotificationActive) {
            return;
        }

        NotificationCompat.Builder builder = buildConversationNotificationBuilder(
                title,
                body,
                pendingIntent,
                senderPerson,
                messagingStyle,
                avatar,
                shortcutAvailable ? conversationId : null
        );

        // Refreshes should never re-alert (vibrate/sound).
        builder.setOnlyAlertOnce(true);
 
        manager.notify(notificationId, builder.build());
    }

    private Bitmap resolveCachedAvatarBitmap(String partnerPubkeyHex, String pictureUrl) {
        if (pictureUrl == null || pictureUrl.isEmpty()) {
            return null;
        }

        String key = computeAvatarKey(pictureUrl);
        if (key == null) {
            return null;
        }

        synchronized (avatarBitmaps) {
            Bitmap cached = avatarBitmaps.get(partnerPubkeyHex);
            String cachedKey = avatarBitmapKeys.get(partnerPubkeyHex);
            if (cached != null && key.equals(cachedKey)) {
                return cached;
            }
        }

        File file = new File(getAvatarCacheDir(), key + ".png");
        if (!file.exists()) {
            return null;
        }

        Bitmap decoded = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (decoded == null) {
            return null;
        }

        synchronized (avatarBitmaps) {
            avatarBitmaps.put(partnerPubkeyHex, decoded);
            avatarBitmapKeys.put(partnerPubkeyHex, key);
        }

        return decoded;
    }

    private void fetchConversationAvatar(final String partnerPubkeyHex, final String pictureUrl) {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        if (!serviceRunning) {
            return;
        }

        final String key = computeAvatarKey(pictureUrl);
        if (key == null) {
            return;
        }

        File targetFile = new File(getAvatarCacheDir(), key + ".png");
        if (targetFile.exists()) {
            if (handler != null) {
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        refreshConversationActivityNotification(partnerPubkeyHex);
                    }
                });
            }
            return;
        }

        synchronized (avatarFetchInFlight) {
            if (avatarFetchInFlight.contains(partnerPubkeyHex)) {
                return;
            }
            avatarFetchInFlight.add(partnerPubkeyHex);
        }

        Request request = new Request.Builder().url(pictureUrl).build();
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                synchronized (avatarFetchInFlight) {
                    avatarFetchInFlight.remove(partnerPubkeyHex);
                }
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                try {
                    if (!response.isSuccessful()) {
                        return;
                    }

                    ResponseBody body = response.body();
                    if (body == null) {
                        return;
                    }

                    byte[] bytes = body.bytes();
                    Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (decoded == null) {
                        return;
                    }

                    Bitmap normalized = normalizeAvatarBitmap(decoded, AVATAR_TARGET_PX);
                    if (normalized == null) {
                        return;
                    }

                    if (!writeAvatarBitmap(targetFile, normalized)) {
                        return;
                    }

                    synchronized (avatarBitmaps) {
                        avatarBitmaps.put(partnerPubkeyHex, normalized);
                        avatarBitmapKeys.put(partnerPubkeyHex, key);
                    }

                    if (handler != null) {
                        handler.post(new Runnable() {
                            @Override
                            public void run() {
                                refreshConversationActivityNotification(partnerPubkeyHex);
                            }
                        });
                    }
                } finally {
                    synchronized (avatarFetchInFlight) {
                        avatarFetchInFlight.remove(partnerPubkeyHex);
                    }
                    response.close();
                }
            }
        });
    }

    private File getAvatarCacheDir() {
        File dir = new File(getCacheDir(), "nospeak_avatar_cache");
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return dir;
    }

    private String computeAvatarKey(String url) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return null;
        }
    }

    private Bitmap normalizeAvatarBitmap(Bitmap bitmap, int targetPx) {
        if (bitmap == null) {
            return null;
        }

        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width <= 0 || height <= 0) {
            return null;
        }

        int size = Math.min(width, height);
        int left = Math.max(0, (width - size) / 2);
        int top = Math.max(0, (height - size) / 2);

        Bitmap square = Bitmap.createBitmap(bitmap, left, top, size, size);
        Bitmap scaled = Bitmap.createScaledBitmap(square, targetPx, targetPx, true);

        return makeCircularBitmap(scaled);
    }

    private Bitmap makeCircularBitmap(Bitmap bitmap) {
        if (bitmap == null) {
            return null;
        }

        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        if (size <= 0) {
            return null;
        }

        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        Paint paint = new Paint();
        paint.setAntiAlias(true);
        paint.setShader(new BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));

        float radius = size / 2f;
        canvas.drawCircle(radius, radius, radius, paint);

        return output;
    }

    private boolean writeAvatarBitmap(File file, Bitmap bitmap) {
        if (file == null || bitmap == null) {
            return false;
        }

        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            //noinspection ResultOfMethodCallIgnored
            parent.mkdirs();
        }

        FileOutputStream out = null;
        try {
            out = new FileOutputStream(file);
            return bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (IOException e) {
            return false;
        } finally {
            if (out != null) {
                try {
                    out.close();
                } catch (IOException ignored) {
                    // ignore
                }
            }
        }
    }

    private String resolveRumorPreview(DecryptedRumor rumor) { 
        if (rumor.kind == 14) {
            String content = rumor.content != null ? rumor.content.trim() : "";
            if (content.isEmpty()) {
                return "New message";
            }
            return truncatePreview(content);
        }

        if (rumor.kind == 15) {
            String fileType = getTagValue(rumor.tags, "file-type");
            return getMediaPreviewLabel(fileType);
        }

        if (rumor.kind == 7) {
            String content = rumor.content != null ? rumor.content.trim() : "";
            if (content.equals("+")) {
                content = "👍";
            } else if (content.equals("-")) {
                content = "👎";
            }
            if (content.isEmpty()) {
                content = "(reaction)";
            }
            return "Reaction: " + truncatePreview(content);
        }

        return null;
    }

    private String truncatePreview(String text) {
        if (text == null) {
            return "";
        }

        String trimmed = text.trim();
        if (trimmed.length() <= PREVIEW_TRUNCATE_CHARS) {
            return trimmed;
        }

        return trimmed.substring(0, PREVIEW_TRUNCATE_CHARS - 1) + "…";
    }

    private String getTagValue(JSONArray tags, String tagName) {
        if (tags == null) return null;
        try {
            for (int i = 0; i < tags.length(); i++) {
                JSONArray tag = tags.optJSONArray(i);
                if (tag != null && tag.length() >= 2 && tagName.equals(tag.optString(0))) {
                    return tag.optString(1);
                }
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        return null;
    }

    private String getMediaPreviewLabel(String fileType) {
        if (fileType == null || fileType.isEmpty()) {
            return "📎 File";
        }
        // Voice messages (webm/opus or m4a)
        if (fileType.equals("audio/webm") ||
            fileType.equals("audio/ogg") ||
            fileType.equals("audio/mp4") ||
            fileType.equals("audio/x-m4a") ||
            fileType.contains("opus")) {
            return "🎤 Voice Message";
        }
        // Images
        if (fileType.startsWith("image/")) {
            return "📷 Image";
        }
        // Videos
        if (fileType.startsWith("video/")) {
            return "🎬 Video";
        }
        // Other audio (music files)
        if (fileType.startsWith("audio/")) {
            return "🎵 Audio";
        }
        // Generic file
        return "📎 File";
    }

    private boolean shouldEmitMessageNotification() {
        if (!notificationsEnabled) {
            return false;
        }

        if (!"amber".equalsIgnoreCase(currentMode) && !"nsec".equalsIgnoreCase(currentMode)) {
            return false;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            int permission = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS);
            if (permission != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }

        return true;
    }

    private boolean shouldSuppressNotificationForConversation(String partnerPubkeyHex) {
        if (!MainActivity.isAppVisible()) {
            return false;
        }

        if (activeConversationPubkeyHex == null || activeConversationPubkeyHex.isEmpty()) {
            return false;
        }

        return activeConversationPubkeyHex.equalsIgnoreCase(partnerPubkeyHex);
    }

    private void loadPersistedSeenEventIds() {
        SharedPreferences prefs = getSharedPreferences(DEDUPE_PREFS_NAME, MODE_PRIVATE);
        String raw = prefs.getString(DEDUPE_PREFS_KEY_IDS, null);
        if (raw == null || raw.isEmpty()) {
            return;
        }

        try {
            JSONArray ids = new JSONArray(raw);
            synchronized (seenEventIds) {
                seenEventIds.clear();
                seenEventIdQueue.clear();

                for (int i = 0; i < ids.length(); i++) {
                    String id = ids.optString(i, null);
                    if (id == null || id.isEmpty()) {
                        continue;
                    }
                    if (seenEventIds.add(id)) {
                        seenEventIdQueue.addLast(id);
                    }
                }

                while (seenEventIdQueue.size() > MAX_PERSISTED_EVENT_IDS) {
                    String removed = seenEventIdQueue.removeFirst();
                    seenEventIds.remove(removed);
                }
            }
        } catch (JSONException ignored) {
            // ignore
        }
    }

    private boolean markEventIdSeen(String id) {
        boolean added;
        synchronized (seenEventIds) {
            if (seenEventIds.contains(id)) {
                return false;
            }

            added = seenEventIds.add(id);
            if (added) {
                seenEventIdQueue.addLast(id);
                while (seenEventIdQueue.size() > MAX_PERSISTED_EVENT_IDS) {
                    String removed = seenEventIdQueue.removeFirst();
                    seenEventIds.remove(removed);
                }
            }
        }

        if (added) {
            persistSeenEventIds();
        }

        return added;
    }

    private void persistSeenEventIds() {
        JSONArray ids = new JSONArray();
        synchronized (seenEventIds) {
            for (String id : seenEventIdQueue) {
                ids.put(id);
            }
        }

        SharedPreferences prefs = getSharedPreferences(DEDUPE_PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(DEDUPE_PREFS_KEY_IDS, ids.toString()).apply();
    }



    private DecryptedRumor tryDecryptGiftWrapToRumor(JSONObject giftWrapEvent, String currentUserPubkeyHex) {
        if (giftWrapEvent == null) {
            return null;
        }

        String outerSenderPubkeyHex = giftWrapEvent.optString("pubkey", null);
        String giftWrapCiphertext = giftWrapEvent.optString("content", null);

        if (outerSenderPubkeyHex == null || giftWrapCiphertext == null) {
            return null;
        }

        String decryptedGiftWrap = decryptNip44(giftWrapCiphertext, outerSenderPubkeyHex, currentUserPubkeyHex);
        if (decryptedGiftWrap == null) {
            return null;
        }

        try {
            JSONObject seal = new JSONObject(decryptedGiftWrap);
            int sealKind = seal.optInt("kind", -1);
            if (sealKind != 13) {
                return null;
            }

            String sealPubkeyHex = seal.optString("pubkey", null);
            String sealCiphertext = seal.optString("content", null);
            if (sealPubkeyHex == null || sealCiphertext == null) {
                return null;
            }

            String decryptedSeal = decryptNip44(sealCiphertext, sealPubkeyHex, currentUserPubkeyHex);
            if (decryptedSeal == null) {
                return null;
            }

            JSONObject rumor = new JSONObject(decryptedSeal);
            DecryptedRumor result = new DecryptedRumor();
            result.kind = rumor.optInt("kind", -1);
            result.pubkeyHex = rumor.optString("pubkey", null);
            result.content = rumor.optString("content", "");
            result.tags = rumor.optJSONArray("tags");
            result.createdAtSeconds = rumor.optLong("created_at", 0L);
            return result;
        } catch (JSONException e) {
            return null;
        }
    }

    private void disableBackgroundMessagingDueToMissingSecret() {
        Log.w(LOG_TAG, "Disabling background messaging: missing local secret key (re-login required)");

        AndroidBackgroundMessagingPrefs.setEnabled(getApplicationContext(), false);
        AndroidBackgroundMessagingPrefs.saveSummary(getApplicationContext(), "Disabled: re-login required");

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification("Disabled: re-login required"));
        }

        try {
            stopForeground(true);
        } catch (Exception ignored) {
            // ignore
        }
        stopSelf();
    }

    private String decryptNip44(String ciphertext, String senderPubkeyHex, String currentUserPubkeyHex) {
        if (ciphertext == null || senderPubkeyHex == null) {
            return null;
        }

        if ("amber".equalsIgnoreCase(currentMode)) {
            return amberNip44Decrypt(ciphertext, senderPubkeyHex, currentUserPubkeyHex);
        }

        if ("nsec".equalsIgnoreCase(currentMode)) {
            return localNip44Decrypt(ciphertext, senderPubkeyHex);
        }

        return null;
    }

    private String localNip44Decrypt(String payload, String senderPubkeyHex) {
        if (localSecretKey == null || localSecretKey.length != 32) {
            return null;
        }

        if (payload == null || senderPubkeyHex == null) {
            return null;
        }

        try {
            byte[] conversationKey = getConversationKey(localSecretKey, senderPubkeyHex);
            return nip44V2DecryptPayload(payload, conversationKey);
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] getConversationKey(byte[] privateKey, String peerPubkeyHex) throws Exception {
        if (privateKey == null || privateKey.length != 32) {
            throw new IllegalArgumentException("invalid private key");
        }

        byte[] peerPubkeyX = hexToBytes(peerPubkeyHex);
        if (peerPubkeyX.length != 32) {
            throw new IllegalArgumentException("invalid peer pubkey");
        }

        byte[] sharedX = secp256k1Ecdh(privateKey, peerPubkeyX);
        return hkdfExtract(sharedX, "nip44-v2".getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] secp256k1Ecdh(byte[] privateKey, byte[] peerPubkeyX) throws Exception {
        X9ECParameters params = SECNamedCurves.getByName("secp256k1");
        if (params == null) {
            throw new IllegalStateException("secp256k1 params not available");
        }

        byte[] compressed = new byte[33];
        compressed[0] = 0x02; // even Y (BIP340-style lift)
        System.arraycopy(peerPubkeyX, 0, compressed, 1, 32);

        ECPoint peerPoint = params.getCurve().decodePoint(compressed);
        BigInteger scalar = new BigInteger(1, privateKey);
        if (scalar.signum() == 0) {
            throw new IllegalArgumentException("invalid private key");
        }

        ECPoint sharedPoint = peerPoint.multiply(scalar).normalize();
        byte[] x = sharedPoint.getAffineXCoord().getEncoded();

        if (x.length == 32) {
            return x;
        }

        if (x.length > 32) {
            return Arrays.copyOfRange(x, x.length - 32, x.length);
        }

        byte[] out = new byte[32];
        System.arraycopy(x, 0, out, 32 - x.length, x.length);
        return out;
    }

    private static byte[] hkdfExtract(byte[] ikm, byte[] salt) throws Exception {
        return hmacSha256(salt, ikm);
    }

    private static byte[] hkdfExpand(byte[] prk, byte[] info, int length) throws Exception {
        if (length <= 0) {
            throw new IllegalArgumentException("invalid length");
        }

        byte[] result = new byte[length];
        int pos = 0;
        byte[] previous = new byte[0];
        int counter = 1;

        while (pos < length) {
            byte[] message = concat(previous, info, new byte[]{(byte) counter});
            previous = hmacSha256(prk, message);

            int toCopy = Math.min(previous.length, length - pos);
            System.arraycopy(previous, 0, result, pos, toCopy);
            pos += toCopy;
            counter++;
        }

        return result;
    }

    private static byte[] hmacSha256(byte[] key, byte[] message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(message);
    }

    private static String nip44V2DecryptPayload(String payload, byte[] conversationKey) throws Exception {
        if (payload == null || payload.isEmpty()) {
            return null;
        }

        byte[] data = Base64.decode(payload, Base64.DEFAULT);
        if (data.length < 99) {
            return null;
        }

        int version = data[0] & 0xFF;
        if (version != 2) {
            return null;
        }

        byte[] nonce = Arrays.copyOfRange(data, 1, 33);
        byte[] mac = Arrays.copyOfRange(data, data.length - 32, data.length);
        byte[] ciphertext = Arrays.copyOfRange(data, 33, data.length - 32);
        if (ciphertext.length == 0) {
            return null;
        }

        byte[] keys = hkdfExpand(conversationKey, nonce, 76);
        byte[] chachaKey = Arrays.copyOfRange(keys, 0, 32);
        byte[] chachaNonce = Arrays.copyOfRange(keys, 32, 44);
        byte[] hmacKey = Arrays.copyOfRange(keys, 44, 76);

        byte[] calculatedMac = hmacSha256(hmacKey, concat(nonce, ciphertext));
        if (!MessageDigest.isEqual(calculatedMac, mac)) {
            return null;
        }

        byte[] paddedPlaintext = chacha20Decrypt(chachaKey, chachaNonce, ciphertext);
        return unpadNip44(paddedPlaintext);
    }

    private static byte[] chacha20Decrypt(byte[] key, byte[] nonce, byte[] ciphertext) {
        ChaCha7539Engine engine = new ChaCha7539Engine();
        engine.init(false, new ParametersWithIV(new KeyParameter(key), nonce));

        byte[] out = new byte[ciphertext.length];
        engine.processBytes(ciphertext, 0, ciphertext.length, out, 0);
        return out;
    }

    private static String unpadNip44(byte[] padded) {
        if (padded == null || padded.length < 2) {
            return null;
        }

        int unpaddedLen = readUint16Be(padded, 0);
        if (unpaddedLen <= 0) {
            return null;
        }

        int expectedPaddedLen = calcPaddedLen(unpaddedLen);
        if (padded.length != 2 + expectedPaddedLen) {
            return null;
        }

        if (2 + unpaddedLen > padded.length) {
            return null;
        }

        byte[] unpadded = Arrays.copyOfRange(padded, 2, 2 + unpaddedLen);
        return new String(unpadded, StandardCharsets.UTF_8);
    }

    private static int calcPaddedLen(int unpaddedLen) {
        if (unpaddedLen <= 32) {
            return 32;
        }

        int value = unpaddedLen - 1;
        int nextPower = 1;
        while (nextPower <= value && nextPower > 0) {
            nextPower <<= 1;
        }

        int chunk = nextPower <= 256 ? 32 : nextPower / 8;
        return chunk * ((unpaddedLen - 1) / chunk + 1);
    }

    private static int readUint16Be(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xFF) << 8) | (bytes[offset + 1] & 0xFF);
    }

    private static byte[] hexToBytes(String hex) {
        if (hex == null) {
            return new byte[0];
        }

        String normalized = hex.trim();
        if ((normalized.length() % 2) != 0) {
            throw new IllegalArgumentException("invalid hex");
        }

        int len = normalized.length() / 2;
        byte[] out = new byte[len];
        for (int i = 0; i < len; i++) {
            int index = i * 2;
            out[i] = (byte) Integer.parseInt(normalized.substring(index, index + 2), 16);
        }
        return out;
    }

    private static byte[] concat(byte[]... chunks) {
        int length = 0;
        for (byte[] chunk : chunks) {
            if (chunk != null) {
                length += chunk.length;
            }
        }

        byte[] out = new byte[length];
        int pos = 0;
        for (byte[] chunk : chunks) {
            if (chunk == null || chunk.length == 0) {
                continue;
            }
            System.arraycopy(chunk, 0, out, pos, chunk.length);
            pos += chunk.length;
        }
        return out;
    }

    private String amberNip44Decrypt(String ciphertext, String senderPubkeyHex, String currentUserPubkeyHex) {
        try {
            ContentResolver resolver = getContentResolver();
            Uri uri = Uri.parse("content://com.greenart7c3.nostrsigner.NIP44_DECRYPT");
            String[] projection = new String[]{ciphertext, senderPubkeyHex, currentUserPubkeyHex};
            Cursor cursor = resolver.query(uri, projection, null, null, null);
            if (cursor == null) {
                return null;
            }
            try {
                int rejectedIndex = cursor.getColumnIndex("rejected");
                if (rejectedIndex >= 0) {
                    return null;
                }

                if (!cursor.moveToFirst()) {
                    return null;
                }

                int resultIndex = cursor.getColumnIndex("result");
                if (resultIndex < 0) {
                    return null;
                }

                String plaintext = cursor.getString(resultIndex);
                if (plaintext == null || plaintext.isEmpty()) {
                    return null;
                }

                return plaintext;
            } finally {
                cursor.close();
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static final class DecryptedRumor {
        int kind;
        String pubkeyHex;
        String content;
        JSONArray tags;
        long createdAtSeconds;
    }

    private void showGenericEncryptedMessageNotification() {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
 
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                1,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
 
        String title = "New encrypted message";
        String body = "You received a new message. Open nospeak to read it.";
 
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
 
        int id = (int) (System.currentTimeMillis() & 0x7FFFFFFF);
        manager.notify(id, builder.build());
    }


    private void updateServiceNotificationForHealth() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }
 
        int connectedCount;
        synchronized (activeSockets) {
            connectedCount = activeSockets.size();
        }
 
        String text;
        if (configuredRelaysCount == 0) {
            text = "No read relays configured";
        } else if (connectedCount > 0) {
            text = "Connected relays: " + connectedCount;
        } else {
            text = "Not connected to relays";
        }
 
        Notification notification = buildNotification(text);
        manager.notify(NOTIFICATION_ID, notification);
    }
 
    private Notification buildNotification(String summary) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("nospeak background messaging")
                .setContentText(summary)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_MIN);

        return builder.build();
    }
}
