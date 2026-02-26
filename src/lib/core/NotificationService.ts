import { LocalNotifications } from '@capacitor/local-notifications';

import { profileRepo } from '$lib/db/ProfileRepository';

import { getIdenticonDataUri } from './identicon';
import { resolveDisplayName } from './nameUtils';
import { isAndroidNative } from './NativeDialogs';

const DEFAULT_NOTIFICATION_ICON = '/nospeak.svg';
const ANDROID_MESSAGE_CHANNEL_ID = 'messages';

const ANDROID_NOTIFICATION_ICON_TIMEOUT_MS = 1000;
const DATA_URI_PREFIX = 'data:';

interface FilesystemWriteFileResult {
    uri?: string;
    path?: string;
}

interface FilesystemLike {
    writeFile(options: { path: string; data: string; directory?: string; recursive?: boolean }): Promise<FilesystemWriteFileResult>;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function getNotificationAvatarUrl(npub: string, picture: string | undefined): string {
    return isNonEmptyString(picture) ? picture : getIdenticonDataUri(npub);
}

function getFilesystemPlugin(): FilesystemLike | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const filesystem = (window as any).Capacitor?.Plugins?.Filesystem;

    if (!filesystem || typeof filesystem.writeFile !== 'function') {
        return undefined;
    }

    return filesystem as FilesystemLike;
}

function bytesToBase64(bytes: Uint8Array): string {
    const nodeBuffer = (globalThis as any).Buffer;

    if (nodeBuffer) {
        return nodeBuffer.from(bytes).toString('base64');
    }

    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
    }

    return btoa(binary);
}

async function blobToBase64(blob: Blob): Promise<string> {
    if (typeof FileReader === 'undefined') {
        const buffer = await blob.arrayBuffer();
        return bytesToBase64(new Uint8Array(buffer));
    }

    return await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
            const result = reader.result;

            if (typeof result !== 'string') {
                reject(new Error('Failed to convert blob to base64'));
                return;
            }

            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };

        reader.onerror = () => {
            reject(reader.error ?? new Error('FileReader error'));
        };

        reader.readAsDataURL(blob);
    });
}

export interface NotificationSettings {
    notificationsEnabled: boolean;
    backgroundMessagingEnabled?: boolean;
}

export class NotificationService {
    private settings: NotificationSettings = {
        notificationsEnabled: true
    };
    private readonly isAndroidNativeEnv: boolean;
    private androidChannelInitialized: boolean = false;

    constructor() {
        this.isAndroidNativeEnv = isAndroidNative();
        this.loadSettings();

        if (this.isAndroidNativeEnv) {
            this.initializeAndroidListeners();
        }
    }

    private loadSettings() {
        try {
            // Check if we're in browser environment
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = window.localStorage.getItem('nospeak-settings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    this.settings = { ...this.settings, ...settings };
                }
            }
        } catch (e) {
            console.error('Failed to load notification settings:', e);
        }
    }

    private async ensureAndroidChannel() {
        if (!this.isAndroidNativeEnv || this.androidChannelInitialized) {
            return;
        }

        try {
            await LocalNotifications.createChannel({
                id: ANDROID_MESSAGE_CHANNEL_ID,
                name: 'Messages',
                description: 'nospeak message notifications',
                importance: 4
            });
            this.androidChannelInitialized = true;
        } catch (e) {
            console.warn('Failed to create Android notification channel:', e);
        }
    }

    private initializeAndroidListeners() {
        try {
            LocalNotifications.addListener('localNotificationActionPerformed', (event: any) => {
                try {
                    const extra: any = event.notification?.extra;
                    const url = extra && typeof extra.url === 'string' ? extra.url : undefined;

                    if (typeof window !== 'undefined' && url) {
                        window.location.href = url;
                    }
                } catch (e) {
                    console.error('Failed to handle Android notification tap:', e);
                }
            });
        } catch (e) {
            console.warn('Failed to register Android local notification listener:', e);
        }
    }

    public async showNewMessageNotification(senderNpub: string, message: string, conversationId?: string) {
        // Reload settings so changes in Settings modal take effect
        this.loadSettings();

        if (!this.settings.notificationsEnabled) {
            return;
        }

        if (this.isAndroidNativeEnv) {
            return;
        }

        // Use conversationId for navigation URL (falls back to senderNpub for 1-on-1 chats)
        const chatId = conversationId || senderNpub;

        if (typeof document !== 'undefined') {
            const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
            const isVisible = document.visibilityState === 'visible';
 
            let isSameConversation = false;
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.startsWith('/chat/')) {
                    const currentConvId = decodeURIComponent(path.slice('/chat/'.length).replace(/\/$/, ''));
                    isSameConversation = currentConvId === chatId;
                }
            }
 
            const shouldSuppress = isVisible && hasFocus && isSameConversation;
 
            if (shouldSuppress) {
                return;
            }
        }


        let senderName = senderNpub.slice(0, 10) + '...';
        let senderPicture: string | undefined;

        try {
            const profile = await profileRepo.getProfileIgnoreTTL(senderNpub);

            if (profile && profile.metadata) {
                senderName = resolveDisplayName(profile.metadata, senderNpub);
                senderPicture = profile.metadata.picture;
            }
        } catch (e) {
            console.error('Failed to load sender profile for notification:', e);
        }

        if (this.isAndroidNativeEnv) {
            await this.showAndroidNotification(chatId, senderName, senderPicture, message);
            return;
        }

        await this.showWebNotification(chatId, senderName, senderPicture, message);
    }

    private async resolveAndroidNotificationLargeIcon(senderNpub: string, senderPicture: string | undefined): Promise<string | undefined> {
        const filesystem = getFilesystemPlugin();

        if (!filesystem) {
            return undefined;
        }

        try {
            const avatarUrl = getNotificationAvatarUrl(senderNpub, senderPicture);

            // Data URIs (identicons) cannot be fetched; the native Android service
            // handles identicon generation independently via IdenticonGenerator.java.
            if (avatarUrl.startsWith(DATA_URI_PREFIX)) {
                return undefined;
            }

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
            const timeoutId = controller ? setTimeout(() => controller.abort(), ANDROID_NOTIFICATION_ICON_TIMEOUT_MS) : undefined;

            let response: Response;

            try {
                response = await fetch(avatarUrl, controller ? { signal: controller.signal } : undefined);
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }

            if (!response.ok) {
                return undefined;
            }

            const blob = await response.blob();
            const base64 = await blobToBase64(blob);

            const seed = senderNpub.slice(-10);
            const path = `nospeak-notification-icons/${seed}.png`;

            const result = await filesystem.writeFile({
                path,
                data: base64,
                directory: 'CACHE',
                recursive: true
            });

            return result.uri ?? result.path;
        } catch {
            return undefined;
        }
    }

    private async showAndroidNotification(chatId: string, senderName: string, senderPicture: string | undefined, message: string) {
        try {
            await this.ensureAndroidChannel();

            const permissions = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' as const }));
            if (permissions.display !== 'granted') {
                return;
            }

            const id = Math.floor(Date.now() % 2147483647);
            const largeIcon = await this.resolveAndroidNotificationLargeIcon(chatId, senderPicture);

            const notification: any = {
                id,
                title: `New message from ${senderName}`,
                body: message,
                channelId: ANDROID_MESSAGE_CHANNEL_ID,
                smallIcon: 'ic_stat_nospeak',
                extra: {
                    url: `/chat/${chatId}`
                }
            };

            if (isNonEmptyString(largeIcon)) {
                notification.largeIcon = largeIcon;
            }

            await LocalNotifications.schedule({
                notifications: [notification]
            });
        } catch (e) {
            console.error('Failed to show Android local notification:', e);
        }
    }

    private async showWebNotification(chatId: string, senderName: string, senderPicture: string | undefined, message: string) {
        // Check if we have permission
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return;
        }

        try {
            // Create notification
            let swRegistration: ServiceWorkerRegistration | undefined;

            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                try {
                    // Wait for service worker to be ready with a timeout
                    // This prevents hanging if no SW is registered (e.g. dev mode or desktop without PWA)
                    swRegistration = await Promise.race<ServiceWorkerRegistration | undefined>([
                        navigator.serviceWorker.ready,
                        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1000))
                    ]);
                } catch (e) {
                    console.warn('Service Worker check failed:', e);
                }
            }

            if (swRegistration) {
                await swRegistration.showNotification(`New message from ${senderName}`, {
                    body: message,
                    icon: getNotificationAvatarUrl(chatId, senderPicture),
                    badge: DEFAULT_NOTIFICATION_ICON,
                    tag: `message-${chatId}`, // Group notifications by conversation
                    requireInteraction: false,
                    silent: false,
                    data: {
                        url: `/chat/${chatId}`
                    }
                });
            } else if (typeof Notification !== 'undefined') {
                // Fallback for non-SW environments
                const notification = new Notification(`New message from ${senderName}`, {
                    body: message,
                    icon: getNotificationAvatarUrl(chatId, senderPicture),
                    badge: DEFAULT_NOTIFICATION_ICON,
                    tag: `message-${chatId}`, // Group notifications by conversation
                    requireInteraction: false,
                    silent: false
                });

                // Click handler to focus the chat window
                notification.onclick = () => {
                    if (typeof window !== 'undefined') {
                        window.focus();
                        // Navigate to the conversation
                        window.location.href = `/chat/${chatId}`;
                    }
                    notification.close();
                };

                // Auto-close after 5 seconds
                setTimeout(() => {
                    notification.close();
                }, 5000);
            }
        } catch (e) {
            console.error('Failed to show notification:', e);
        }
    }

    public async requestPermission(): Promise<boolean> {
        if (this.isAndroidNativeEnv) {
            try {
                const result = await LocalNotifications.requestPermissions();
                return result.display === 'granted';
            } catch (e) {
                console.error('Failed to request Android notification permission:', e);
                return false;
            }
        }

        if (typeof window !== 'undefined' && 'Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    public async showReactionNotification(senderNpub: string, emoji: string) {
        this.loadSettings();

        if (!this.settings.notificationsEnabled) {
            return;
        }

        if (this.isAndroidNativeEnv) {
            return;
        }

        if (typeof document !== 'undefined') {
            const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
            const isVisible = document.visibilityState === 'visible';

            let isSameConversation = false;
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.startsWith('/chat/')) {
                    const currentNpub = decodeURIComponent(path.slice('/chat/'.length).replace(/\/$/, ''));
                    isSameConversation = currentNpub === senderNpub;
                }
            }

            const shouldSuppress = isVisible && hasFocus && isSameConversation;

            if (shouldSuppress) {
                return;
            }
        }

        let senderName = senderNpub.slice(0, 10) + '...';
        let senderPicture: string | undefined;

        try {
            const profile = await profileRepo.getProfileIgnoreTTL(senderNpub);

            if (profile && profile.metadata) {
                senderName = resolveDisplayName(profile.metadata, senderNpub);
                senderPicture = profile.metadata.picture;
            }
        } catch (e) {
            console.error('Failed to load sender profile for reaction notification:', e);
        }

        const message = `reacted ${emoji} to your message`;

        if (this.isAndroidNativeEnv) {
            await this.showAndroidReactionNotification(senderNpub, senderName, senderPicture, message);
            return;
        }

        await this.showWebReactionNotification(senderNpub, senderName, senderPicture, message);
    }

    private async showAndroidReactionNotification(senderNpub: string, senderName: string, senderPicture: string | undefined, message: string) {
        try {
            await this.ensureAndroidChannel();

            const permissions = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' as const }));
            if (permissions.display !== 'granted') {
                return;
            }

            const id = Math.floor(Date.now() % 2147483647);
            const largeIcon = await this.resolveAndroidNotificationLargeIcon(senderNpub, senderPicture);

            const notification: any = {
                id,
                title: `New reaction from ${senderName}`,
                body: message,
                channelId: ANDROID_MESSAGE_CHANNEL_ID,
                smallIcon: 'ic_stat_nospeak',
                extra: {
                    url: `/chat/${senderNpub}`
                }
            };

            if (isNonEmptyString(largeIcon)) {
                notification.largeIcon = largeIcon;
            }

            await LocalNotifications.schedule({
                notifications: [notification]
            });
        } catch (e) {
            console.error('Failed to show Android reaction notification:', e);
        }
    }

    private async showWebReactionNotification(senderNpub: string, senderName: string, senderPicture: string | undefined, message: string) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return;
        }

        try {
            let swRegistration: ServiceWorkerRegistration | undefined;

            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                try {
                    swRegistration = await Promise.race<ServiceWorkerRegistration | undefined>([
                        navigator.serviceWorker.ready,
                        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1000))
                    ]);
                } catch (e) {
                    console.warn('Service Worker check failed:', e);
                }
            }

            const title = `New reaction from ${senderName}`;

            if (swRegistration) {
                await swRegistration.showNotification(title, {
                    body: message,
                    icon: getNotificationAvatarUrl(senderNpub, senderPicture),
                    badge: DEFAULT_NOTIFICATION_ICON,
                    tag: `message-${senderNpub}`,
                    requireInteraction: false,
                    silent: false,
                    data: {
                        url: `/chat/${senderNpub}`
                    }
                });
            } else if (typeof Notification !== 'undefined') {
                const notification = new Notification(title, {
                    body: message,
                    icon: getNotificationAvatarUrl(senderNpub, senderPicture),
                    badge: DEFAULT_NOTIFICATION_ICON,
                    tag: `message-${senderNpub}`,
                    requireInteraction: false,
                    silent: false
                });

                notification.onclick = () => {
                    if (typeof window !== 'undefined') {
                        window.focus();
                        window.location.href = `/chat/${senderNpub}`;
                    }
                    notification.close();
                };

                setTimeout(() => {
                    notification.close();
                }, 5000);
            }
        } catch (e) {
            console.error('Failed to show reaction notification:', e);
        }
    }

    public isSupported(): boolean {
        if (this.isAndroidNativeEnv) {
            return true;
        }

        return typeof window !== 'undefined' && 'Notification' in window;
    }

    public isEnabled(): boolean {
        this.loadSettings();

        if (!this.settings.notificationsEnabled) {
            return false;
        }

        if (this.isAndroidNativeEnv) {
            // Permission is checked asynchronously when showing notifications
            return true;
        }

        return typeof window !== 'undefined' && 
               'Notification' in window && 
               Notification.permission === 'granted';
    }
}

let notificationServiceInstance: NotificationService | null = null;

 export const notificationService = {
     showNewMessageNotification: (senderNpub: string, message: string, conversationId?: string) => {
         if (!notificationServiceInstance) {
             notificationServiceInstance = new NotificationService();
         }
         return notificationServiceInstance.showNewMessageNotification(senderNpub, message, conversationId);
     },
     showReactionNotification: (senderNpub: string, emoji: string) => {
         if (!notificationServiceInstance) {
             notificationServiceInstance = new NotificationService();
         }
         return notificationServiceInstance.showReactionNotification(senderNpub, emoji);
     },

    requestPermission: () => {
        if (!notificationServiceInstance) {
            notificationServiceInstance = new NotificationService();
        }
        return notificationServiceInstance.requestPermission();
    },
    isSupported: () => {
        if (!notificationServiceInstance) {
            notificationServiceInstance = new NotificationService();
        }
        return notificationServiceInstance.isSupported();
    },
    isEnabled: () => {
        if (!notificationServiceInstance) {
            notificationServiceInstance = new NotificationService();
        }
        return notificationServiceInstance.isEnabled();
    }
};