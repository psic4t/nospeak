package com.nospeak.app;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
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
    public void stop(PluginCall call) { 
        AndroidBackgroundMessagingPrefs.setEnabled(getContext(), false);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
