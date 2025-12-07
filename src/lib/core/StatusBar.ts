import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

export async function configureAndroidStatusBar(): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
            await StatusBar.setOverlaysWebView({ overlay: false });
        }
    } catch (error) {
        console.warn('Failed to configure Android status bar', error);
    }
}
