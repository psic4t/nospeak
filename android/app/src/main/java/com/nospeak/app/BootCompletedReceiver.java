package com.nospeak.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

public class BootCompletedReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }

        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        Intent serviceIntent = AndroidBackgroundMessagingPrefs.buildStartServiceIntent(context);
        if (serviceIntent == null) {
            return;
        }

        ContextCompat.startForegroundService(context, serviceIntent);
    }
}
