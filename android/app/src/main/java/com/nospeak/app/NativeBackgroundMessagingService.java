package com.nospeak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
 
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
 
import org.json.JSONArray;

import org.json.JSONException;
import org.json.JSONObject;
 
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
 
import okhttp3.OkHttpClient;

import okhttp3.Request;
import okhttp3.Response;
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

    private static final String CHANNEL_ID = "nospeak_background_service";
    private static final String CHANNEL_MESSAGES_ID = "nospeak_background_messages";
    private static final int NOTIFICATION_ID = 1001;

    private String currentSummary = "Connected to read relays";

    private OkHttpClient client;
    private final Set<WebSocket> sockets = new HashSet<>();
    private final Set<String> seenEventIds = new HashSet<>();
    private final Set<WebSocket> historyCompleted = new HashSet<>();
    private String currentPubkeyHex;
    private String currentMode = "amber";

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
        historyCompleted.clear();
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

            NotificationChannel messagesChannel = new NotificationChannel(
                    CHANNEL_MESSAGES_ID,
                    "nospeak background messages",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            messagesChannel.setDescription("Notifications for new encrypted messages received in background");
            // Allow app icon badges for actual message notifications.
            messagesChannel.setShowBadge(true);

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
        seenEventIds.clear();
        historyCompleted.clear();
 
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
                seenEventIds.add(id);
            }

            boolean isHistoryCompleteForSocket;
            synchronized (historyCompleted) {
                isHistoryCompleteForSocket = historyCompleted.contains(socket);
            }

            // Before EOSE, treat events as history and do not notify.
            if (!isHistoryCompleteForSocket) {
                return;
            }

            // For now we do not decrypt; show a generic notification
            showGenericEncryptedMessageNotification();

        } catch (JSONException e) {
            // Ignore malformed messages
        }
    }


    private void showGenericEncryptedMessageNotification() {
        // Only surface background notifications when the app UI is not visible
        if (MainActivity.isAppVisible()) {
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
