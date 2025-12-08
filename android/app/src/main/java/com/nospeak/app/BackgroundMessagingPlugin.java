package com.nospeak.app;

import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundMessaging")
public class BackgroundMessagingPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String summary = call.getString("summary", "Connected to read relays");

        Context context = getContext();
        Intent intent = new Intent(context, BackgroundMessagingService.class);
        intent.putExtra("summary", summary);

        ContextCompat.startForegroundService(context, intent);

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, BackgroundMessagingService.class);
        context.stopService(intent);
        call.resolve();
    }
}
