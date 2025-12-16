package com.nospeak.app;
 
import android.os.Bundle;
 
import androidx.core.view.WindowCompat;
 
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static boolean appVisible = false;

    public static boolean isAppVisible() {
        return appVisible;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom plugins before bridge initialization
        registerPlugin(AndroidBackgroundMessagingPlugin.class);
        registerPlugin(AndroidNip55SignerPlugin.class);

        super.onCreate(savedInstanceState);
 
        // Enable edge-to-edge layout and delegate safe areas to the web UI
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }

    @Override
    public void onStart() {
        super.onStart();
        appVisible = true;
    }

    @Override
    public void onStop() {
        appVisible = false;
        super.onStop();
    }
}


