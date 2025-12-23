package com.nospeak.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

public class AndroidUnifiedPushDistributorReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        String action = intent.getAction();

        switch (action) {
            case "org.unifiedpush.android.distributor.REGISTER":
                handleRegister(context, intent);
                break;
            case "org.unifiedpush.android.distributor.UNREGISTER":
                handleUnregister(context, intent);
                break;
            case "org.unifiedpush.android.distributor.MESSAGE_ACK":
                handleMessageAck(context, intent);
                break;
        }
    }

    private String getTokenFromIntent(Intent intent) {
        String token = intent.getStringExtra("token");
        if (token == null || token.isEmpty()) {
            token = intent.getStringExtra("instance");
        }
        if (token == null || token.isEmpty()) {
            token = intent.getStringExtra("registrationToken");
        }
        return token;
    }

    private String getPackageNameFromIntent(Context context, Intent intent) {
        String sendingPackage = getSendingPackageCompat();
        if (sendingPackage != null && !sendingPackage.isEmpty()) {
            return sendingPackage;
        }

        String packageName = intent.getStringExtra("application");
        if (packageName == null || packageName.isEmpty()) {
            packageName = intent.getStringExtra("packageName");
        }

        if (packageName == null || packageName.isEmpty()) {
            String token = getTokenFromIntent(intent);
            if (token != null && !token.isEmpty()) {
                AndroidUnifiedPushPrefs.Registration reg = AndroidUnifiedPushPrefs.getRegistration(context, token);
                if (reg != null) {
                    packageName = reg.packageName;
                }
            }
        }

        return packageName;
    }

    private String getSendingPackageCompat() {
        try {
            java.lang.reflect.Method method = BroadcastReceiver.class.getMethod("getSendingPackage");
            Object result = method.invoke(this);
            if (result instanceof String) {
                String value = (String) result;
                return value != null && !value.isEmpty() ? value : null;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void handleRegister(Context context, Intent intent) {
        String token = getTokenFromIntent(intent);
        String packageName = getPackageNameFromIntent(context, intent);
        String vapidKey = intent.getStringExtra("connectorLink");
        String message = intent.getStringExtra("feature");

        if (token == null || token.isEmpty() || packageName == null || packageName.isEmpty()) {
            return;
        }

        String serverUrl = AndroidUnifiedPushPrefs.getServerUrl(context);
        if (serverUrl == null || serverUrl.isEmpty()) {
            return;
        }

        AndroidUnifiedPushPrefs.removeRegistrationsForPackage(context, packageName);

        String topic = AndroidUnifiedPushPrefs.getOrCreateTopicForToken(context, token);
        String endpoint = normalizeServerUrl(serverUrl) + "/" + topic;

        AndroidUnifiedPushPrefs.saveRegistration(context, token, packageName, endpoint, vapidKey, message, topic);

        Intent responseIntent = new Intent("org.unifiedpush.android.connector.NEW_ENDPOINT");
        responseIntent.putExtra("token", token);
        responseIntent.putExtra("endpoint", endpoint);
        responseIntent.putExtra("connectorLink", vapidKey != null ? vapidKey : "");
        responseIntent.setPackage(packageName);

        try {
            context.sendBroadcast(responseIntent);
        } catch (RuntimeException e) {
            // Never crash distributor due to third-party receiver issues
        }

        notifyServiceRegistrationsChanged(context);
    }

    private void handleUnregister(Context context, Intent intent) {
        String token = getTokenFromIntent(intent);
        String packageName = getPackageNameFromIntent(context, intent);

        if (token != null && !token.isEmpty()) {
            AndroidUnifiedPushPrefs.removeRegistration(context, token);

            if (packageName != null && !packageName.isEmpty()) {
                Intent responseIntent = new Intent("org.unifiedpush.android.connector.UNREGISTERED");
                responseIntent.putExtra("token", token);
                responseIntent.setPackage(packageName);

                try {
                    context.sendBroadcast(responseIntent);
                } catch (RuntimeException e) {
                    // Never crash distributor due to third-party receiver issues
                }
            }
        } else if (packageName != null && !packageName.isEmpty()) {
            // Some clients don't provide token when switching distributors.
            AndroidUnifiedPushPrefs.removeRegistrationsForPackage(context, packageName);
        } else {
            return;
        }

        notifyServiceRegistrationsChanged(context);
    }

    private void handleMessageAck(Context context, Intent intent) {
        String token = intent.getStringExtra("token");
        
        if (token == null || token.isEmpty()) {
            return;
        }

        AndroidUnifiedPushPrefs.acknowledgeMessage(context, token);
    }

    private static String normalizeServerUrl(String serverUrl) {
        String url = serverUrl.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }

        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }

        return url;
    }

    private static void notifyServiceRegistrationsChanged(Context context) {
        AndroidUnifiedPushPrefs.Config config = AndroidUnifiedPushPrefs.load(context);
        if (!config.enabled) {
            return;
        }

        Intent intent = new Intent(context, AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_REFRESH_REGISTRATIONS);
        ContextCompat.startForegroundService(context, intent);
    }
}
