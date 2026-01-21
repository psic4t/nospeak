package com.nospeak.app

import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin for showing native Android bottom sheets with the WebView content.
 * This provides smooth 60fps drag gestures handled entirely by native code.
 */
@CapacitorPlugin(name = "AndroidBottomSheet")
class AndroidBottomSheetPlugin : Plugin() {

    private var currentSheet: NativeBottomSheet? = null

    @PluginMethod
    fun show(call: PluginCall) {
        val activity = activity ?: run {
            call.reject("Activity not available")
            return
        }

        // Get the WebView from the Capacitor bridge
        val webView: WebView? = bridge?.webView

        if (webView == null) {
            call.reject("WebView not available")
            return
        }

        activity.runOnUiThread {
            try {
                // Dismiss any existing sheet first
                currentSheet?.dismiss()

                // Create new bottom sheet fragment
                val sheet = NativeBottomSheet.newInstance()

                // Configure with WebView and dismiss callback
                sheet.setWebView(webView) {
                    // Called when sheet is dismissed by user (drag or back button)
                    notifyListeners("dismissed", JSObject())
                    currentSheet = null
                }

                // Show the sheet
                val fragmentManager = (activity as? AppCompatActivity)?.supportFragmentManager
                if (fragmentManager != null) {
                    sheet.show(fragmentManager, NativeBottomSheet.TAG)
                    currentSheet = sheet
                    call.resolve()
                } else {
                    call.reject("FragmentManager not available")
                }
            } catch (e: Exception) {
                call.reject("Failed to show bottom sheet: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun hide(call: PluginCall) {
        val activity = activity ?: run {
            call.reject("Activity not available")
            return
        }

        activity.runOnUiThread {
            try {
                currentSheet?.dismiss()
                currentSheet = null
                call.resolve()
            } catch (e: Exception) {
                call.reject("Failed to hide bottom sheet: ${e.message}")
            }
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        currentSheet?.dismiss()
        currentSheet = null
    }
}
