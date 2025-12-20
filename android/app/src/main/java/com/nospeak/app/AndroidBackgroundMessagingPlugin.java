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
        String nsecHex = call.getString("nsecHex", null);
        JSArray relaysArray = call.getArray("readRelays");
        String summary = call.getString("summary", "Connected to read relays");

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

        AndroidBackgroundMessagingPrefs.saveStartConfig(getContext(), mode, pubkeyHex, relays, summary);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        intent.setAction(NativeBackgroundMessagingService.ACTION_START);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_MODE, mode);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_PUBKEY_HEX, pubkeyHex);
        if (nsecHex != null) {
            intent.putExtra(NativeBackgroundMessagingService.EXTRA_NSEC_HEX, nsecHex);
        }
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_SUMMARY, summary);
        intent.putExtra(NativeBackgroundMessagingService.EXTRA_READ_RELAYS, relays);

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
    public void stop(PluginCall call) {
        AndroidBackgroundMessagingPrefs.setEnabled(getContext(), false);

        Intent intent = new Intent(getContext(), NativeBackgroundMessagingService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
