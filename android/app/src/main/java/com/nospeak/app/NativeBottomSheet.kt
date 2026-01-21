package com.nospeak.app

import android.app.Dialog
import android.content.DialogInterface
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

/**
 * Native Android BottomSheetDialogFragment that hosts the Capacitor WebView.
 * The WebView is transferred from the main Capacitor bridge into this sheet
 * when shown, and returned when dismissed.
 */
class NativeBottomSheet : BottomSheetDialogFragment() {

    private var webView: WebView? = null
    private var originalParent: ViewGroup? = null
    private var originalLayoutParams: ViewGroup.LayoutParams? = null
    private var onDismissCallback: (() -> Unit)? = null
    private var container: FrameLayout? = null

    companion object {
        const val TAG = "NativeBottomSheet"

        fun newInstance(): NativeBottomSheet {
            return NativeBottomSheet()
        }
    }

    /**
     * Configure the WebView to be hosted in this sheet.
     * Must be called before showing the fragment.
     */
    fun setWebView(webView: WebView, onDismiss: () -> Unit) {
        this.webView = webView
        this.onDismissCallback = onDismiss
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog

        dialog.setOnShowListener { dialogInterface ->
            val bottomSheetDialog = dialogInterface as BottomSheetDialog
            val bottomSheet = bottomSheetDialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet
            )

            bottomSheet?.let { sheet ->
                val behavior = BottomSheetBehavior.from(sheet)

                // Configure behavior per design.md:
                // - STATE_EXPANDED on show (no half-expanded intermediate state)
                // - skipCollapsed = true (dismiss directly, no collapsed state)
                // - isDraggable = true
                behavior.state = BottomSheetBehavior.STATE_EXPANDED
                behavior.skipCollapsed = true
                behavior.isDraggable = true
                behavior.isFitToContents = true

                // Make sheet background transparent so WebView's own background shows
                sheet.setBackgroundColor(Color.TRANSPARENT)

                // Set peek height to match 90% viewport (will expand fully anyway)
                val displayMetrics = resources.displayMetrics
                val screenHeight = displayMetrics.heightPixels
                behavior.peekHeight = (screenHeight * 0.9).toInt()
            }
        }

        return dialog
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Create a simple FrameLayout container for the WebView
        val frameLayout = FrameLayout(requireContext()).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            // Transparent background - WebView provides its own glassmorphism styling
            setBackgroundColor(Color.TRANSPARENT)
        }
        this.container = frameLayout
        return frameLayout
    }

    override fun onStart() {
        super.onStart()

        // Transfer WebView into our container
        webView?.let { wv ->
            // Store original parent for restoration on dismiss
            val parent = wv.parent as? ViewGroup
            if (parent != null) {
                originalParent = parent
                originalLayoutParams = wv.layoutParams

                // Remove from original parent
                parent.removeView(wv)
            }

            // Add to our container
            container?.addView(wv, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
        }
    }

    override fun onDismiss(dialog: DialogInterface) {
        // Return WebView to original parent before dismissing
        webView?.let { wv ->
            container?.removeView(wv)

            originalParent?.let { parent ->
                val params = originalLayoutParams ?: ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                parent.addView(wv, params)
            }
        }

        super.onDismiss(dialog)

        // Notify plugin that sheet was dismissed (user dragged to close or back button)
        onDismissCallback?.invoke()
    }

    override fun onDestroyView() {
        container = null
        super.onDestroyView()
    }
}
