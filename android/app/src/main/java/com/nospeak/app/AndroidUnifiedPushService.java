package com.nospeak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AndroidUnifiedPushService extends Service {

    private static final String LOG_TAG = "UnifiedPushService";

    public static final String ACTION_START = "com.nospeak.app.UNIFIEDPUSH_START";
    public static final String ACTION_UPDATE = "com.nospeak.app.UNIFIEDPUSH_UPDATE";
    public static final String ACTION_UPDATE_TOPICS = "com.nospeak.app.UNIFIEDPUSH_UPDATE_TOPICS";
    public static final String ACTION_REFRESH_REGISTRATIONS = "com.nospeak.app.UNIFIEDPUSH_REFRESH_REGISTRATIONS";
    public static final String ACTION_TEST_PUSH = "com.nospeak.app.UNIFIEDPUSH_TEST_PUSH";
    public static final String ACTION_STOP = "com.nospeak.app.UNIFIEDPUSH_STOP";

    public static final String EXTRA_SERVER_URL = "serverUrl";
    public static final String EXTRA_TOPICS = "topics";
    public static final String EXTRA_SUMMARY = "summary";

    private static final String CHANNEL_ID = "nospeak_unifiedpush_service";
    private static final String CHANNEL_MESSAGES_ID = "nospeak_unifiedpush_messages";
    private static final int NOTIFICATION_ID = 2001;
    private static final int ERROR_NOTIFICATION_ID = 2002;
    private static final int TEST_PUSH_NOTIFICATION_ID = 2003;
    private static final String TEST_TOPIC = "nospeak-test";
    private static final long TEST_PUSH_TIMEOUT_MS = 15000L;

    private static final int MAX_TOPICS = 20;
    private static final int MAX_RECONNECT_DELAY_SECONDS = 300;

    private OkHttpClient client;
    private WebSocket webSocket;
    private Handler handler;
    private boolean serviceRunning = false;
    private boolean foregroundStarted = false;
    private String currentServerUrl;
    private Set<String> currentTopics = new HashSet<>();
    private String currentSummary = "UnifiedPush active";
    private int retryAttempts = 0;
    private int consecutiveFailures = 0;
    private boolean hasEverConnected = false;
    private boolean errorNotificationShown = false;

    private boolean testInProgress = false;
    private boolean testSendPending = false;
    private boolean testTopicAdded = false;
    private String testServerUrl = null;
    private Set<String> testOriginalTopics = null;
    private Runnable testTimeoutRunnable = null;

    private final Map<String, AndroidUnifiedPushPrefs.Registration> registrationsByTopic = new HashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        client = new OkHttpClient.Builder()
                .pingInterval(240, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
        handler = new Handler(Looper.getMainLooper());
        serviceRunning = true;
        createNotificationChannel();
        foregroundStarted = false;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Intent restoredIntent = AndroidUnifiedPushPrefs.buildStartServiceIntent(getApplicationContext());
            if (restoredIntent == null) {
                stopSelf();
                return START_NOT_STICKY;
            }
            intent = restoredIntent;
        }

        String action = intent.getAction();
        if (action == null) {
            action = ACTION_START;
        }

        // IMPORTANT:
        // This service is started via ContextCompat.startForegroundService(...) from several plugin methods
        // (e.g. topic updates). Android requires startForeground() to be called quickly after that, even
        // if the start action isn't ACTION_START.
        if (!ACTION_STOP.equals(action)) {
            ensureForegroundStarted();
        }

        switch (action) {
            case ACTION_START:
                handleStart(intent);
                break;
            case ACTION_UPDATE:
                handleUpdate(intent);
                break;
            case ACTION_UPDATE_TOPICS:
                handleUpdateTopics(intent);
                break;
            case ACTION_REFRESH_REGISTRATIONS:
                handleRefreshRegistrations();
                break;
            case ACTION_TEST_PUSH:
                handleTestPush(intent);
                break;
            case ACTION_STOP:
                stopSelf();
                return START_NOT_STICKY;
        }

        return START_STICKY;
    }

    private void handleStart(Intent intent) {
        currentServerUrl = intent.getStringExtra(EXTRA_SERVER_URL);
        String[] topicsArray = intent.getStringArrayExtra(EXTRA_TOPICS);

        if (currentServerUrl == null || currentServerUrl.isEmpty()) {
            currentServerUrl = AndroidUnifiedPushPrefs.getServerUrl(getApplicationContext());
        }

        if (topicsArray != null) {
            currentTopics.clear();
            for (String topic : topicsArray) {
                if (topic != null && !topic.isEmpty()) {
                    currentTopics.add(topic);
                }
            }
        } else {
            String[] savedTopics = AndroidUnifiedPushPrefs.getTopics(getApplicationContext());
            currentTopics.clear();
            for (String topic : savedTopics) {
                if (topic != null && !topic.isEmpty()) {
                    currentTopics.add(topic);
                }
            }
        }

        AndroidUnifiedPushPrefs.saveStartConfig(getApplicationContext(), currentServerUrl, currentTopics.toArray(new String[0]));
        loadRegistrations();

        Notification notification = buildNotification(currentSummary);
        startForeground(NOTIFICATION_ID, notification);
        foregroundStarted = true;

        retryAttempts = 0;
        consecutiveFailures = 0;
        hasEverConnected = false;
        errorNotificationShown = false;
        clearErrorNotification();

        disconnectWebSocket();
        connectWebSocket();
    }

    private void handleUpdate(Intent intent) {
        String summary = intent.getStringExtra(EXTRA_SUMMARY);
        if (summary != null) {
            currentSummary = summary;
            AndroidUnifiedPushPrefs.saveSummary(getApplicationContext(), summary);
            updateServiceNotification();
        }
    }

    private void handleUpdateTopics(Intent intent) {
        String[] topicsArray = intent.getStringArrayExtra(EXTRA_TOPICS);
        if (topicsArray != null) {
            currentTopics.clear();
            for (String topic : topicsArray) {
                if (topic != null && !topic.isEmpty()) {
                    currentTopics.add(topic);
                }
            }
            AndroidUnifiedPushPrefs.setTopics(getApplicationContext(), currentTopics.toArray(new String[0]));
            reconnectWebSocket();
        }
    }

    private void handleRefreshRegistrations() {
        loadRegistrations();
        reconnectWebSocket();
    }

    private void handleTestPush(Intent intent) {
        String serverUrl = intent.getStringExtra(EXTRA_SERVER_URL);
        if (serverUrl != null && !serverUrl.isEmpty()) {
            startTestPushFlow(serverUrl);
        }
    }

    private void startTestPushFlow(String serverUrl) {
        if (handler == null) {
            return;
        }

        if (testInProgress) {
            // Avoid overlapping tests
            return;
        }

        testInProgress = true;
        testServerUrl = serverUrl;
        testOriginalTopics = new HashSet<>(currentTopics);
        testTopicAdded = !currentTopics.contains(TEST_TOPIC);

        if (testTopicAdded) {
            currentTopics.add(TEST_TOPIC);
            testSendPending = true;
            reconnectWebSocket();
        } else {
            // Already subscribed, send immediately
            testSendPending = false;
            sendTestPush(serverUrl);
        }

        testTimeoutRunnable = new Runnable() {
            @Override
            public void run() {
                if (testInProgress) {
                    Log.w(LOG_TAG, "Test push timed out");
                    finishTestPushFlow(false);
                }
            }
        };
        handler.postDelayed(testTimeoutRunnable, TEST_PUSH_TIMEOUT_MS);
    }

    private void finishTestPushFlow(boolean received) {
        if (handler != null && testTimeoutRunnable != null) {
            handler.removeCallbacks(testTimeoutRunnable);
        }
        testTimeoutRunnable = null;

        if (testTopicAdded && testOriginalTopics != null) {
            currentTopics.clear();
            currentTopics.addAll(testOriginalTopics);
            reconnectWebSocket();
        }

        testInProgress = false;
        testSendPending = false;
        testTopicAdded = false;
        testServerUrl = null;
        testOriginalTopics = null;

        if (received) {
            Log.d(LOG_TAG, "Test push received");
        }
    }

    private void loadRegistrations() {
        registrationsByTopic.clear();
        JSONArray regsJson = AndroidUnifiedPushPrefs.getRegistrationsAsJsonArray(getApplicationContext());
        if (regsJson == null) {
            return;
        }

        try {
            for (int i = 0; i < regsJson.length(); i++) {
                JSONObject regObj = regsJson.getJSONObject(i);
                String token = regObj.optString("token");
                AndroidUnifiedPushPrefs.Registration reg = AndroidUnifiedPushPrefs.getRegistration(getApplicationContext(), token);
                if (reg != null && reg.topic != null && !reg.topic.isEmpty()) {
                    registrationsByTopic.put(reg.topic, reg);
                }
            }
        } catch (JSONException e) {
            Log.w(LOG_TAG, "Failed to load registrations", e);
        }
    }

    private void connectWebSocket() {
        if (!serviceRunning) {
            return;
        }

        disconnectWebSocket();

        String wsUrl = buildWebSocketUrl(currentServerUrl, getSubscribedTopics());
        if (wsUrl == null) {
            return;
        }

        Log.d(LOG_TAG, "Connecting to WebSocket: " + wsUrl);
        Request request = new Request.Builder()
                .url(wsUrl)
                .build();

        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                retryAttempts = 0;
                consecutiveFailures = 0;
                hasEverConnected = true;
                errorNotificationShown = false;
                clearErrorNotification();
                Log.d(LOG_TAG, "UnifiedPush WebSocket connected to " + currentServerUrl);
                updateServiceNotification();

                if (testInProgress && testSendPending && testServerUrl != null) {
                    testSendPending = false;
                    sendTestPush(testServerUrl);
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                handleNtfyMessage(text);
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                Log.d(LOG_TAG, "WebSocket closing: " + code + " " + reason);
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                Log.d(LOG_TAG, "WebSocket closed: " + code + " " + reason);
                AndroidUnifiedPushService.this.webSocket = null;
                updateServiceNotification();

                if (!hasEverConnected) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= 3) {
                        showErrorNotification();
                    }
                }

                scheduleReconnect();
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                Log.e(LOG_TAG, "WebSocket failure", t);
                AndroidUnifiedPushService.this.webSocket = null;
                updateServiceNotification();

                if (!hasEverConnected) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= 3) {
                        showErrorNotification();
                    }
                }

                scheduleReconnect();
            }
        });
    }

    private void disconnectWebSocket() {
        if (webSocket != null) {
            webSocket.close(1000, "Service stopping");
            webSocket = null;
        }
    }

    private void reconnectWebSocket() {
        disconnectWebSocket();
        connectWebSocket();
    }

    private void scheduleReconnect() {
        if (!serviceRunning || handler == null) {
            return;
        }

        int delaySeconds = (int) Math.pow(2, retryAttempts);
        if (delaySeconds > MAX_RECONNECT_DELAY_SECONDS) {
            delaySeconds = MAX_RECONNECT_DELAY_SECONDS;
        }
        retryAttempts++;

        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (serviceRunning) {
                    connectWebSocket();
                }
            }
        }, delaySeconds * 1000L);
    }

    private Set<String> getSubscribedTopics() {
        Set<String> topics = new HashSet<>();
        topics.addAll(currentTopics);
        topics.addAll(registrationsByTopic.keySet());

        // Test push temporarily adds TEST_TOPIC to currentTopics,
        // so we don't need special-case handling here.

        return topics;
    }

    private String buildWebSocketUrl(String serverUrl, Set<String> topics) {
        if (serverUrl == null || serverUrl.isEmpty()) {
            return null;
        }

        String url = serverUrl.trim();
        if (url.startsWith("http://")) {
            url = "ws://" + url.substring(7);
        } else if (url.startsWith("https://")) {
            url = "wss://" + url.substring(8);
        } else if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
            url = "wss://" + url;
        }

        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }

        if (topics == null || topics.isEmpty()) {
            return null;
        }

        StringBuilder builder = new StringBuilder();
        for (String topic : topics) {
            if (topic == null || topic.isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(",");
            }
            builder.append(topic);
        }

        if (builder.length() == 0) {
            return null;
        }

        return url + "/" + builder.toString() + "/ws";
    }

    private void handleNtfyMessage(String text) {
        try {
            JSONObject msg = new JSONObject(text);
            String event = msg.optString("event", "");
            
            if ("message".equals(event)) {
                handleMessage(msg);
            }
        } catch (JSONException e) {
            Log.w(LOG_TAG, "Failed to parse ntfy message", e);
        }
    }

    private void handleMessage(JSONObject msg) {
        String topic = msg.optString("topic", "");
        String message = msg.optString("message", "");
        String title = msg.optString("title", "");
        String id = msg.optString("id", "");
        int priority = msg.optInt("priority", 3);
        JSONArray tags = msg.optJSONArray("tags");

        if (currentTopics.contains(topic)) {
            showNotification(id, topic, title, message, priority, tags);

            if (testInProgress && TEST_TOPIC.equals(topic)) {
                if (handler != null) {
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            finishTestPushFlow(true);
                        }
                    });
                } else {
                    finishTestPushFlow(true);
                }
            }
        } else {
            AndroidUnifiedPushPrefs.Registration reg = registrationsByTopic.get(topic);
            if (reg != null) {
                forwardToUnifiedPushApp(reg.packageName, id, reg.token, title, message, priority, tags);
            }
        }
    }

    private void showNotification(String id, String topic, String title, String message, int priority, JSONArray tags) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        if (!canShowNotifications()) {
            return;
        }

        String notificationTitle = title.isEmpty() ? "nospeak: " + topic : title;
        String notificationMessage = message.isEmpty() ? topic : message;

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle(notificationTitle)
                .setContentText(notificationMessage)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(mapNtfyPriority(priority));

        if (tags != null && tags.length() > 0) {
            String[] tagArray = new String[tags.length()];
            for (int i = 0; i < tags.length(); i++) {
                try {
                    tagArray[i] = tags.getString(i);
                } catch (JSONException e) {
                    tagArray[i] = "";
                }
            }
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(notificationMessage));
        }

        int notificationId = (Math.abs(topic.hashCode()) + id.hashCode()) % 10000;
        manager.notify(notificationId, builder.build());
    }

    private void forwardToUnifiedPushApp(String packageName, String id, String token, String title, String message, int priority, JSONArray tags) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("id", id);
            payload.put("topic", token);
            payload.put("message", message);
            payload.put("title", title);
            payload.put("priority", priority);
            if (tags != null) {
                payload.put("tags", tags);
            }

            Intent pushIntent = new Intent("org.unifiedpush.android.connector.MESSAGE");
            pushIntent.putExtra("message", payload.toString());
            pushIntent.putExtra("token", token);
            pushIntent.setPackage(packageName);
            sendBroadcast(pushIntent);
        } catch (JSONException e) {
            Log.w(LOG_TAG, "Failed to forward message to UnifiedPush app", e);
        }
    }

    private void sendTestPush(String serverUrl) {
        String url = serverUrl.trim();
        if (url.startsWith("ws://") || url.startsWith("wss://")) {
            url = url.replaceFirst("^ws://", "http://").replaceFirst("^wss://", "https://");
        } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }

        String publishUrl = url + "/" + TEST_TOPIC;

        String message = "Test push from nospeak UnifiedPush distributor";
        RequestBody body = RequestBody.create(MediaType.parse("text/plain; charset=utf-8"), message);

        Request request = new Request.Builder()
                .url(publishUrl)
                .post(body)
                .header("Title", "Test Push")
                .header("Priority", "3")
                .header("Tags", "test,nospeak")
                .header("X-UnifiedPush", "1")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(LOG_TAG, "Test push failed", e);
                showErrorNotification();
            }

            @Override
            public void onResponse(Call call, Response response) {
                if (!response.isSuccessful()) {
                    Log.e(LOG_TAG, "Test push failed: " + response.code());
                    showErrorNotification();
                } else {
                    Log.d(LOG_TAG, "Test push sent successfully");
                }
                response.close();
            }
        });
    }

    private int mapNtfyPriority(int ntfyPriority) {
        switch (ntfyPriority) {
            case 5:
                return NotificationCompat.PRIORITY_MAX;
            case 4:
                return NotificationCompat.PRIORITY_HIGH;
            case 2:
                return NotificationCompat.PRIORITY_LOW;
            case 1:
                return NotificationCompat.PRIORITY_MIN;
            default:
                return NotificationCompat.PRIORITY_DEFAULT;
        }
    }

    private boolean canShowNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            int permission = checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS);
            return permission == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void showErrorNotification() {
        if (!canShowNotifications() || errorNotificationShown) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
                .setContentTitle("UnifiedPush: Server Unavailable")
                .setContentText("Could not connect to push server. Check your settings.")
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

        manager.notify(ERROR_NOTIFICATION_ID, builder.build());
        errorNotificationShown = true;
    }

    private void clearErrorNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(ERROR_NOTIFICATION_ID);
        }
    }

    private void ensureForegroundStarted() {
        if (foregroundStarted) {
            return;
        }

        try {
            Notification notification = buildNotification(currentSummary);
            startForeground(NOTIFICATION_ID, notification);
            foregroundStarted = true;
        } catch (RuntimeException e) {
            Log.e(LOG_TAG, "Failed to start foreground", e);
        }
    }

    private void updateServiceNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        String status = webSocket != null ? "Connected to " + currentServerUrl : "Connecting...";
        String summary = currentSummary + " (" + currentTopics.size() + " topics)";

        Notification notification = buildNotification(summary + " - " + status);
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
                .setContentTitle("nospeak UnifiedPush")
                .setContentText(summary)
                .setSmallIcon(R.drawable.ic_stat_nospeak)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_MIN);

        return builder.build();
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
                        "nospeak UnifiedPush Service",
                        NotificationManager.IMPORTANCE_MIN
                );
                channel.setDescription("Keeps nospeak connected to UnifiedPush push server");
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
            }

            if (manager.getNotificationChannel(CHANNEL_MESSAGES_ID) == null) {
                NotificationChannel messagesChannel = new NotificationChannel(
                        CHANNEL_MESSAGES_ID,
                        "nospeak UnifiedPush Messages",
                        NotificationManager.IMPORTANCE_HIGH
                );
                messagesChannel.setDescription("Push notifications from UnifiedPush");
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

    @Override
    public void onDestroy() {
        serviceRunning = false;
        foregroundStarted = false;
        disconnectWebSocket();
        clearErrorNotification();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
