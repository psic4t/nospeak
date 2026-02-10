package com.nospeak.app;
 
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

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
        registerPlugin(AndroidSharingShortcutsPlugin.class);
        registerPlugin(AndroidLocationPlugin.class);
        registerPlugin(AndroidTapSoundPlugin.class);
        registerPlugin(AndroidMicrophonePlugin.class);
        registerPlugin(AndroidMediaCachePlugin.class);
  
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge layout and delegate safe areas to the web UI
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // On pre-Android 15, Capacitor's SystemBars plugin doesn't inject
        // --safe-area-inset-* CSS variables, and the WebView's env(safe-area-inset-*)
        // returns 0 due to a Chromium bug. Manually inject them here.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            View decorView = getWindow().getDecorView();
            ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
                WebView wv = getBridge().getWebView();
                if (wv != null) {
                    Insets safeArea = insets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                    );
                    float density = getResources().getDisplayMetrics().density;
                    int top = (int) (safeArea.top / density);
                    int right = (int) (safeArea.right / density);
                    int bottom = (int) (safeArea.bottom / density);
                    int left = (int) (safeArea.left / density);

                    // When keyboard is visible, zero out bottom safe area and
                    // apply IME bottom margin to the WebView's parent instead
                    boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
                    View parent = (View) wv.getParent();
                    ViewGroup.MarginLayoutParams mlp =
                        (ViewGroup.MarginLayoutParams) parent.getLayoutParams();
                    if (keyboardVisible) {
                        bottom = 0;
                        Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());
                        mlp.bottomMargin = imeInsets.bottom;
                    } else {
                        mlp.bottomMargin = 0;
                    }
                    parent.setLayoutParams(mlp);

                    String script = String.format(java.util.Locale.US,
                        "try{document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');"
                        + "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');"
                        + "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');"
                        + "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');"
                        + "}catch(e){}",
                        top, right, bottom, left
                    );
                    wv.evaluateJavascript(script, null);
                }
                return insets;
            });
        }

        // Configure WebView for native Android overscroll effect
        WebView webView = getBridge().getWebView();
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
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


