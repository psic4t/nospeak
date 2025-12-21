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

@CapacitorPlugin(name = "AndroidBackgroundMessaging")
public class AndroidBackgroundMessagingPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String mode = call.getString("mode", "amber");
        String pubkeyHex = call.getString("pubkeyHex");
        JSArray relaysArray = call.getArray("readRelays");
        String summary = call.getString("summary", "Connected to read relays");
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

        AndroidBackgroundMessagingPrefs.saveStartConfig(getContext(), mode, pubkeyHex, relays, summary, notificationsEnabled);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        intent.setAction(NativeBackgroundMessagingService.ACTION_START);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_MODE, mode);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_PUBKEY_HEX, pubkeyHex);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_SUMMARY, summary);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_READ_RELAYS, relays);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_NOTIFICATIONS_ENABLED, notificationsEnabled);

        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        String summary = call.getString("summary", null);
        if (summary == null) {
            call.reject("summary is required");
            return;
        }

        AndroidBackgroundMessagingPrefs.saveSummary(getContext(), summary);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        intent.setAction(NativeBackgroundMessagingService.ACTION_UPDATE);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_SUMMARY, summary);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
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

        AndroidProfileCachePrefs.upsert(getContext(), pubkeyHex, username, picture, updatedAt);
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
    public void stop(PluginCall call) {
        AndroidBackgroundMessagingPrefs.setEnabled(getContext(), false);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
