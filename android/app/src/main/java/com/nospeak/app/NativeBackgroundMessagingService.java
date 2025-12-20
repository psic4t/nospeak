package com.nospeak.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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


    public static final String ACTION_START = "com.nospeak.app.NATIVE_BG_MSG_START";
    public static final String ACTION_UPDATE = "com.nospeak.app.NATIVE_BG_MSG_UPDATE";

    public static final String EXTRA_MODE = "mode"; // "nsec" or "amber"
    public static final String EXTRA_PUBKEY_HEX = "pubkeyHex";
    public static final String EXTRA_NSEC_HEX = "nsecHex";
    public static final String EXTRA_READ_RELAYS = "readRelays";
    public static final String EXTRA_SUMMARY = "summary";
    public static final String EXTRA_NOTIFICATIONS_ENABLED = "notificationsEnabled";

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

    private static final long EOSE_FALLBACK_DELAY_MS = 8000L;

    private String currentSummary = "Connected to read relays";

    private OkHttpClient client;
    private final Set<WebSocket> sockets = new HashSet<>();

    private final Set<String> seenEventIds = new HashSet<>();
    private final ArrayDeque<String> seenEventIdQueue = new ArrayDeque<>();

    private final Set<WebSocket> historyCompleted = new HashSet<>();
    private final Map<WebSocket, Runnable> eoseFallbackCallbacks = new HashMap<>();

    private final Map<String, Integer> conversationActivityCounts = new HashMap<>();
    private final Map<String, String> conversationLastPreview = new HashMap<>();
    private final Map<String, Long> conversationLastTimestampMs = new HashMap<>();

    private final Map<String, Bitmap> avatarBitmaps = new HashMap<>();
    private final Map<String, String> avatarBitmapKeys = new HashMap<>();
    private final Set<String> avatarFetchInFlight = new HashSet<>();

    private String currentPubkeyHex;
    private String currentMode = "amber";
    private boolean notificationsEnabled = false;

    private int configuredRelaysCount = 0;

    private final Map<String, WebSocket> activeSockets = new HashMap<>();
    private final Map<String, Integer> retryAttempts = new HashMap<>();
    private Handler handler;
    private boolean serviceRunning = false;
 
    @Override
    public void onCreate() {
        super.onCreate();
        client = new OkHttpClient.Builder()
                .pingInterval(30, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
        handler = new Handler(Looper.getMainLooper());
        serviceRunning = true;
        createNotificationChannel();
        loadPersistedSeenEventIds();
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
            configuredRelaysCount = relays != null ? relays.length : 0;

            Notification notification = buildNotification(currentSummary);
            startForeground(NOTIFICATION_ID, notification);
 
            if (currentPubkeyHex != null && relays != null && relays.length > 0) {
                startRelayConnections(relays, currentPubkeyHex);
            } else {
                // No valid relays; still keep notification accurate.
                updateServiceNotificationForHealth();
            }


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
        historyCompleted.clear();
        eoseFallbackCallbacks.clear();
        conversationActivityCounts.clear();
        conversationLastPreview.clear();
        conversationLastTimestampMs.clear();
        avatarBitmaps.clear();
        avatarBitmapKeys.clear();
        avatarFetchInFlight.clear();
        retryAttempts.clear();
    }
 
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) {
                return;
            }

            // Clean up any legacy foreground-service channel that may still be marked as badgeable
            // from earlier builds.
            manager.deleteNotificationChannel("nospeak_background_messaging");

            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "nospeak background messaging",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Keeps nospeak connected to read relays in the background");
            // Do not show app icon badge for the persistent foreground-service notification.
            channel.setShowBadge(false);

            // Testing-stage behavior: recreate the messages channel so default importance/sound/vibration
            // changes take effect immediately.
            manager.deleteNotificationChannel(CHANNEL_MESSAGES_ID);

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
            messagesChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (sound != null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                messagesChannel.setSound(sound, attrs);
            }

            manager.createNotificationChannel(channel);
            manager.createNotificationChannel(messagesChannel);
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
        historyCompleted.clear();

        if (handler != null) {
            synchronized (eoseFallbackCallbacks) {
                for (Runnable runnable : eoseFallbackCallbacks.values()) {
                    handler.removeCallbacks(runnable);
                }
                eoseFallbackCallbacks.clear();
            }
        } else {
            eoseFallbackCallbacks.clear();
        }

        conversationActivityCounts.clear();
        conversationLastPreview.clear();
 
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

                scheduleEoseFallback(webSocket);
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
                onSocketClosedOrFailed(relayUrl, webSocket);
            }
 
            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                onSocketClosedOrFailed(relayUrl, webSocket);
            }
        });
 
        sockets.add(socket);
        synchronized (activeSockets) {
            activeSockets.put(relayUrl, socket);
        }
    }
 
    private void onSocketClosedOrFailed(final String relayUrl, WebSocket socket) {
        synchronized (activeSockets) {
            WebSocket current = activeSockets.get(relayUrl);
            if (current == socket) {
                activeSockets.remove(relayUrl);
            }
        }

        cancelEoseFallback(socket);

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
                synchronized (historyCompleted) {
                    historyCompleted.add(socket);
                }
                cancelEoseFallback(socket);
                return;
            }

            if (!"EVENT".equals(type) || arr.length() < 3) return;

            JSONObject event = arr.optJSONObject(2);
            if (event == null) return;

            int kind = event.optInt("kind", -1);
            if (kind != 1059) return;

            String id = event.optString("id", null);
            if (id == null) return;

            if (!markEventIdSeen(id)) {
                return;
            }

            boolean isHistoryCompleteForSocket;
            synchronized (historyCompleted) {
                isHistoryCompleteForSocket = historyCompleted.contains(socket);
            }

            // Before EOSE (or fallback timeout), treat events as history and do not notify.
            if (!isHistoryCompleteForSocket) {
                return;
            }

            handleLiveGiftWrapEvent(event);

        } catch (JSONException e) {
            // Ignore malformed messages
        }
    }

    private void handleLiveGiftWrapEvent(JSONObject giftWrapEvent) {
        if (!shouldEmitMessageNotification()) {
            return;
        }

        if (currentPubkeyHex == null || currentPubkeyHex.isEmpty()) {
            return;
        }

        DecryptedRumor rumor = tryDecryptGiftWrapToRumor(giftWrapEvent, currentPubkeyHex);
        if (rumor == null) {
            // Testing-stage behavior: suppress generic "new encrypted message" notifications.
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
        String preview = resolveRumorPreview(rumor);
        if (preview == null) {
            return;
        }

        showConversationActivityNotification(partnerPubkeyHex, preview);
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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setStyle(messagingStyle);

        if (avatar != null) {
            builder.setLargeIcon(avatar);
        }

        manager.notify(notificationId, builder.build());

        if (avatar == null && pictureUrl != null && !pictureUrl.trim().isEmpty()) {
            fetchConversationAvatar(partnerPubkeyHex, pictureUrl.trim());
        }
    }

    private PendingIntent buildChatPendingIntent(String partnerPubkeyHex, int requestCode) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(EXTRA_ROUTE_KIND, ROUTE_KIND_CHAT);
        intent.putExtra(EXTRA_ROUTE_PARTNER_PUBKEY_HEX, partnerPubkeyHex);

        return PendingIntent.getActivity(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setStyle(messagingStyle);

        if (avatar != null) {
            builder.setLargeIcon(avatar);
        }

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
            return "Message: Sent you an attachment";
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

    private boolean shouldEmitMessageNotification() {
        if (MainActivity.isAppVisible()) {
            return false;
        }

        if (!notificationsEnabled) {
            return false;
        }

        // Amber-only for now.
        if (!"amber".equalsIgnoreCase(currentMode)) {
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

    private void scheduleEoseFallback(final WebSocket socket) {
        if (handler == null) {
            return;
        }

        cancelEoseFallback(socket);

        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                synchronized (historyCompleted) {
                    historyCompleted.add(socket);
                }
                synchronized (eoseFallbackCallbacks) {
                    eoseFallbackCallbacks.remove(socket);
                }
            }
        };

        synchronized (eoseFallbackCallbacks) {
            eoseFallbackCallbacks.put(socket, runnable);
        }

        handler.postDelayed(runnable, EOSE_FALLBACK_DELAY_MS);
    }

    private void cancelEoseFallback(WebSocket socket) {
        if (handler == null) {
            return;
        }

        Runnable runnable;
        synchronized (eoseFallbackCallbacks) {
            runnable = eoseFallbackCallbacks.remove(socket);
        }

        if (runnable != null) {
            handler.removeCallbacks(runnable);
        }
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

        String decryptedGiftWrap = amberNip44Decrypt(giftWrapCiphertext, outerSenderPubkeyHex, currentUserPubkeyHex);
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

            String decryptedSeal = amberNip44Decrypt(sealCiphertext, sealPubkeyHex, currentUserPubkeyHex);
            if (decryptedSeal == null) {
                return null;
            }

            JSONObject rumor = new JSONObject(decryptedSeal);
            DecryptedRumor result = new DecryptedRumor();
            result.kind = rumor.optInt("kind", -1);
            result.pubkeyHex = rumor.optString("pubkey", null);
            result.content = rumor.optString("content", "");
            result.tags = rumor.optJSONArray("tags");
            return result;
        } catch (JSONException e) {
            return null;
        }
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
