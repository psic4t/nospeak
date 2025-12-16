import { Capacitor } from '@capacitor/core';
import { Dialog } from '@capacitor/dialog';
import { Share } from '@capacitor/share';

export interface AlertOptions {
    title?: string;
    message: string;
}

export interface ConfirmOptions {
    title?: string;
    message: string;
    okButtonTitle?: string;
    cancelButtonTitle?: string;
}

export interface ShareOptions {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
    dialogTitle?: string;
}

export interface NativeDialogService {
    isAndroidNative(): boolean;
    alert(options: AlertOptions): Promise<void>;
    confirm(options: ConfirmOptions): Promise<boolean>;
    share(options: ShareOptions): Promise<void>;
}

export function isAndroidNative(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return Capacitor.getPlatform() === 'android';
    } catch {
        return false;
    }
}

export function isMobileWeb(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    // Heuristic: small viewport or mobile user agent, but not Android native shell
    const isSmallScreen = window.innerWidth <= 768;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isMobileUa = /Android|iPhone|iPad|iPod/i.test(ua);

    return !isAndroidNative() && (isSmallScreen || isMobileUa);
}

export const nativeDialogService: NativeDialogService = {
    isAndroidNative,
    async alert(options: AlertOptions): Promise<void> {
        if (isAndroidNative()) {
            try {
                await Dialog.alert({
                    title: options.title,
                    message: options.message
                });
                return;
            } catch {
                // Fallback to web alert below
            }
        }

        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(options.message);
        }
    },
    async confirm(options: ConfirmOptions): Promise<boolean> {
        if (isAndroidNative()) {
            try {
                const result = await Dialog.confirm({
                    title: options.title,
                    message: options.message,
                    okButtonTitle: options.okButtonTitle,
                    cancelButtonTitle: options.cancelButtonTitle
                });

                return result.value;
            } catch {
                // Fallback to web confirm below
            }
        }

        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            return window.confirm(options.message);
        }

        return false;
    },
    async share(options: ShareOptions): Promise<void> {
        if (isAndroidNative()) {
            // On Android native, prefer the Capacitor Share plugin and
            // allow errors to propagate so callers can surface feedback.
            await Share.share({
                title: options.title,
                text: options.text,
                url: options.url,
                files: options.files,
                dialogTitle: options.dialogTitle
            });
            return;
        }

        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: options.title,
                    text: options.text,
                    url: options.url
                });
            } catch {
                // Ignore share cancellation or errors on web
            }
        }
    }
};
