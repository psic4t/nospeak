package com.nospeak.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ensure content is laid out below the system status bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}

