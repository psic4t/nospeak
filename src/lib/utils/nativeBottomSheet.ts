import { AndroidBottomSheet } from '$lib/core/AndroidBottomSheet';
import type { PluginListenerHandle } from '@capacitor/core';

import { isAndroidCapacitorShell } from './platform';

let dismissListener: PluginListenerHandle | null = null;
let currentDismissCallback: (() => void) | null = null;

/**
 * Show the native Android bottom sheet.
 * The WebView content will be transferred into the native sheet container.
 * 
 * @param id - Identifier for the sheet (for future multi-sheet support)
 * @param onDismiss - Callback when user dismisses the sheet via drag or back button
 * @returns true if native sheet was shown, false if not on Android
 */
export async function showNativeBottomSheet(
    id: string,
    onDismiss: () => void
): Promise<boolean> {
    if (!isAndroidCapacitorShell()) {
        return false;
    }

    const plugin = AndroidBottomSheet as unknown as {
        show?: (options?: { id?: string }) => Promise<void>;
        addListener?: (
            eventName: string,
            callback: () => void
        ) => Promise<PluginListenerHandle>;
    } | null;

    if (!plugin || typeof plugin.show !== 'function') {
        return false;
    }

    try {
        // Store the dismiss callback
        currentDismissCallback = onDismiss;

        // Set up dismiss listener if not already set
        if (!dismissListener && typeof plugin.addListener === 'function') {
            dismissListener = await plugin.addListener('dismissed', () => {
                if (currentDismissCallback) {
                    currentDismissCallback();
                    currentDismissCallback = null;
                }
            });
        }

        await plugin.show({ id });
        return true;
    } catch {
        // Swallow errors - fall back to JS implementation
        return false;
    }
}

/**
 * Programmatically hide the native Android bottom sheet.
 * This is called when the modal is closed via JS (e.g., close button).
 */
export async function hideNativeBottomSheet(): Promise<void> {
    if (!isAndroidCapacitorShell()) {
        return;
    }

    const plugin = AndroidBottomSheet as unknown as {
        hide?: () => Promise<void>;
    } | null;

    if (!plugin || typeof plugin.hide !== 'function') {
        return;
    }

    try {
        // Clear callback since this is a programmatic close
        currentDismissCallback = null;
        await plugin.hide();
    } catch {
        // Swallow errors
    }
}

/**
 * Check if native bottom sheet is available on this platform.
 */
export function isNativeBottomSheetAvailable(): boolean {
    if (!isAndroidCapacitorShell()) {
        return false;
    }

    const plugin = AndroidBottomSheet as unknown as {
        show?: unknown;
    } | null;

    return plugin !== null && typeof plugin.show === 'function';
}

/**
 * Clean up listeners. Call this when unmounting if needed.
 */
export async function cleanupNativeBottomSheet(): Promise<void> {
    if (dismissListener) {
        await dismissListener.remove();
        dismissListener = null;
    }
    currentDismissCallback = null;
}
