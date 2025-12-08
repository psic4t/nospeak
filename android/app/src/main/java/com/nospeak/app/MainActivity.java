package com.nospeak.app;
 
import android.os.Bundle;
 
import androidx.core.view.WindowCompat;
 
import com.getcapacitor.BridgeActivity;
import com.nospeak.app.BackgroundMessagingPlugin;
 
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins before Bridge initialization
        registerPlugin(BackgroundMessagingPlugin.class);
 
        super.onCreate(savedInstanceState);
 
        // Ensure content is laid out below the system status bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}


