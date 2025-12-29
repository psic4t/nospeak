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
        registerPlugin(AndroidLocalSecretKeyPlugin.class);
        registerPlugin(AndroidNotificationRouterPlugin.class);
        registerPlugin(AndroidNip55SignerPlugin.class);
        registerPlugin(AndroidShareTargetPlugin.class);
        registerPlugin(AndroidLocationPlugin.class);
        registerPlugin(AndroidTapSoundPlugin.class);
  
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
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        // Keep the latest Intent available for plugins that read
        // getActivity().getIntent(), such as the AndroidShareTarget plugin.
        setIntent(intent);
    }

    @Override
    public void onStop() {
        appVisible = false;
        super.onStop();
    }
}


