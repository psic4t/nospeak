import { profileRepo } from '$lib/db/ProfileRepository';
import { isAndroidNative } from './NativeDialogs';
// @ts-ignore Capacitor local notifications plugin provided at runtime
import { LocalNotifications } from '@capacitor/local-notifications';

const DEFAULT_NOTIFICATION_ICON = '/nospeak.svg';
const ANDROID_MESSAGE_CHANNEL_ID = 'messages';

export interface NotificationSettings {
    notificationsEnabled: boolean;
}

export class NotificationService {
    private settings: NotificationSettings = {
        notificationsEnabled: false
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

    public async showNewMessageNotification(senderNpub: string, message: string) {
        // Reload settings so changes in Settings modal take effect
        this.loadSettings();

        if (!this.settings.notificationsEnabled) {
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
                senderName = profile.metadata.name || profile.metadata.display_name || profile.metadata.displayName || senderName;
                senderPicture = profile.metadata.picture;
            }
        } catch (e) {
            console.error('Failed to load sender profile for notification:', e);
        }

        if (this.isAndroidNativeEnv) {
            await this.showAndroidNotification(senderNpub, senderName, message);
            return;
        }

        await this.showWebNotification(senderNpub, senderName, senderPicture, message);
    }

    private async showAndroidNotification(senderNpub: string, senderName: string, message: string) {
        try {
            await this.ensureAndroidChannel();

            const permissions = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' as const }));
            if (permissions.display !== 'granted') {
                return;
            }

            const id = Math.floor(Date.now() % 2147483647);

            await LocalNotifications.schedule({
                notifications: [
                    {
                        id,
                        title: `New message from ${senderName}`,
                        body: message,
                        channelId: ANDROID_MESSAGE_CHANNEL_ID,
                        smallIcon: 'ic_stat_nospeak',
                         extra: {
                            url: `/chat/${senderNpub}`
                        }
                    }
                ]
            });
        } catch (e) {
            console.error('Failed to show Android local notification:', e);
        }
    }

    private async showWebNotification(senderNpub: string, senderName: string, senderPicture: string | undefined, message: string) {
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
                    icon: senderPicture || DEFAULT_NOTIFICATION_ICON,
                    badge: DEFAULT_NOTIFICATION_ICON,
                    tag: `message-${senderNpub}`, // Group notifications by sender
                    requireInteraction: false,
                    silent: false,
                    data: {
                        url: `/chat/${senderNpub}`
                    }
                });
            } else if (typeof Notification !== 'undefined') {
                // Fallback for non-SW environments
                const notification = new Notification(`New message from ${senderName}`, {
                    body: message,
                    icon: senderPicture || DEFAULT_NOTIFICATION_ICON,
                    badge: DEFAULT_NOTIFICATION_ICON,
                    tag: `message-${senderNpub}`, // Group notifications by sender
                    requireInteraction: false,
                    silent: false
                });

                // Click handler to focus the chat window
                notification.onclick = () => {
                    if (typeof window !== 'undefined') {
                        window.focus();
                        // Navigate to the sender's chat
                        window.location.href = `/chat/${senderNpub}`;
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
    showNewMessageNotification: (senderNpub: string, message: string) => {
        if (!notificationServiceInstance) {
            notificationServiceInstance = new NotificationService();
        }
        return notificationServiceInstance.showNewMessageNotification(senderNpub, message);
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