package com.nospeak.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "AndroidBackgroundMessaging")
public class AndroidBackgroundMessagingPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String mode = call.getString("mode", "amber");
        String pubkeyHex = call.getString("pubkeyHex");
        JSArray relaysArray = call.getArray("readRelays");
        Boolean notificationsEnabledValue = call.getBoolean("notificationsEnabled", false);
        boolean notificationsEnabled = notificationsEnabledValue != null && notificationsEnabledValue;

        if (pubkeyHex == null || pubkeyHex.isEmpty()) {
            call.reject("pubkeyHex is required");
            return;
        }

        String[] relays = new String[0];
        if (relaysArray != null) {
            try {
                int length = relaysArray.length();
                relays = new String[length];
                for (int i = 0; i < length; i++) {
                    String relay = relaysArray.getString(i);
                    relays[i] = relay != null ? relay : "";
                }
            } catch (JSONException e) {
                call.reject("Invalid readRelays array", e);
                return;
            }
        }

        long nowSeconds = System.currentTimeMillis() / 1000L;
        long baselineSeconds = Math.max(0L, nowSeconds - 60L);
        AndroidBackgroundMessagingPrefs.saveNotificationBaselineSeconds(getContext(), baselineSeconds);

        AndroidBackgroundMessagingPrefs.saveStartConfig(getContext(), mode, pubkeyHex, relays, notificationsEnabled);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        intent.setAction(NativeBackgroundMessagingService.ACTION_START);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_MODE, mode);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_PUBKEY_HEX, pubkeyHex);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_READ_RELAYS, relays);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_NOTIFICATIONS_ENABLED, notificationsEnabled);

        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            call.reject("Failed to start foreground service: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        intent.setAction(NativeBackgroundMessagingService.ACTION_UPDATE);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            call.reject("Failed to update foreground service: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void drainQueuedEvents(PluginCall call) {
        String eventsJson;
        NativeBackgroundMessagingService service = NativeBackgroundMessagingService.getInstance();
        if (service != null) {
            eventsJson = service.drainQueuedEvents();
        } else {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences(
                "nospeak_background_event_queue", Context.MODE_PRIVATE);
            eventsJson = prefs.getString("queuedEventsJson", "[]");
            prefs.edit().putString("queuedEventsJson", "[]").apply();
        }

        JSObject result = new JSObject();
        result.put("events", eventsJson);
        call.resolve(result);
    }

    @PluginMethod
    public void cacheProfile(PluginCall call) {
        String pubkeyHex = call.getString("pubkeyHex");
        String username = call.getString("username");
        String picture = call.getString("picture", null);
        Double updatedAtValue = call.getDouble("updatedAt", null);
        long updatedAt = updatedAtValue != null ? updatedAtValue.longValue() : System.currentTimeMillis();

        if (pubkeyHex == null || pubkeyHex.isEmpty()) {
            call.reject("pubkeyHex is required");
            return;
        }

        if (username == null || username.trim().isEmpty()) {
            call.reject("username is required");
            return;
        }

        // Optional NIP-17 messaging relays (kind 10050). Used by the native side
        // to publish gift wraps (e.g., the voice-call reject signal) to the
        // recipient's preferred DM relays rather than just our own.
        List<String> messagingRelays = null;
        JSArray relaysArr = call.getArray("messagingRelays");
        if (relaysArr != null && relaysArr.length() > 0) {
            messagingRelays = new ArrayList<>(relaysArr.length());
            for (int i = 0; i < relaysArr.length(); i++) {
                try {
                    String url = relaysArr.getString(i);
                    if (url != null && !url.trim().isEmpty()) {
                        messagingRelays.add(url.trim());
                    }
                } catch (JSONException ignored) {
                    // Skip malformed entry
                }
            }
        }

        AndroidProfileCachePrefs.upsert(
            getContext(), pubkeyHex, username, picture, messagingRelays, updatedAt);

        // Trigger avatar pre-fetch if picture URL is provided and service is running.
        // This ensures avatars are cached before notifications arrive, avoiding the
        // identicon fallback on first message.
        if (picture != null && !picture.trim().isEmpty()) {
            NativeBackgroundMessagingService service = NativeBackgroundMessagingService.getInstance();
            if (service != null) {
                service.prefetchAvatar(pubkeyHex, picture);
            }
        }

        call.resolve();
    }

    @PluginMethod
    public void getBatteryOptimizationStatus(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            result.put("isIgnoringBatteryOptimizations", true);
            call.resolve(result);
            return;
        }

        PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
        result.put("isIgnoringBatteryOptimizations", ignoring);
        call.resolve(result);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            result.put("started", false);
            result.put("reason", "unsupported");
            call.resolve(result);
            return;
        }

        PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
        if (ignoring) {
            result.put("started", false);
            result.put("reason", "already_ignoring");
            call.resolve(result);
            return;
        }

        if (getActivity() == null) {
            result.put("started", false);
            result.put("reason", "no_activity");
            call.resolve(result);
            return;
        }

        String packageName = getContext().getPackageName();
        Intent intent = new Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:" + packageName)
        );

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            result.put("started", false);
            result.put("reason", "unavailable");
            call.resolve(result);
            return;
        }

        try {
            getActivity().runOnUiThread(() -> getActivity().startActivity(intent));
            result.put("started", true);
            call.resolve(result);
        } catch (Exception e) {
            result.put("started", false);
            result.put("reason", "failed");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void openAppBatterySettings(PluginCall call) {
        JSObject result = new JSObject();

        if (getActivity() == null) {
            result.put("started", false);
            result.put("reason", "no_activity");
            call.resolve(result);
            return;
        }

        String packageName = getContext().getPackageName();
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", packageName, null)
        );

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            result.put("started", false);
            result.put("reason", "unavailable");
            call.resolve(result);
            return;
        }

        try {
            getActivity().runOnUiThread(() -> getActivity().startActivity(intent));
            result.put("started", true);
            call.resolve(result);
        } catch (Exception e) {
            result.put("started", false);
            result.put("reason", "failed");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void setActiveConversation(PluginCall call) {
        String pubkeyHex = call.getString("pubkeyHex", null);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        intent.setAction(NativeBackgroundMessagingService.ACTION_SET_ACTIVE_CONVERSATION);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_ACTIVE_CONVERSATION_PUBKEY, pubkeyHex);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            call.reject("Failed to set active conversation: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        AndroidBackgroundMessagingPrefs.setEnabled(getContext(), false);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    /**
     * NIP-AC follow-gate: persist the user's NIP-02 contact-list hex
     * pubkeys for the native background service to consult before posting
     * the lockscreen FSI ringer for an incoming call. Called from JS
     * whenever the contact list refreshes.
     *
     * Argument shape: {@code { hexPubkeys: string[] }}. An empty array is
     * a valid value (means "no followers"); the absence of any prior call
     * to this method is the "not loaded yet" state that drops offers per
     * the cold-start rule.
     */
    @PluginMethod
    public void setFollowGate(PluginCall call) {
        com.getcapacitor.JSArray jsArr = call.getArray("hexPubkeys");
        String[] hex;
        if (jsArr == null) {
            hex = new String[0];
        } else {
            int len = jsArr.length();
            hex = new String[len];
            for (int i = 0; i < len; i++) {
                try {
                    hex[i] = jsArr.getString(i);
                } catch (Exception e) {
                    hex[i] = "";
                }
            }
        }
        AndroidBackgroundMessagingPrefs.saveFollowGateHex(getContext(), hex);
        call.resolve();
    }
}
