import { profileRepo } from '$lib/db/ProfileRepository';

export interface NotificationSettings {
    notificationsEnabled: boolean;
}

export class NotificationService {
    private settings: NotificationSettings = {
        notificationsEnabled: false
    };

    constructor() {
        this.loadSettings();
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

    public async showNewMessageNotification(senderNpub: string, message: string) {
        if (!this.settings.notificationsEnabled) {
            return;
        }

        // Check if we have permission
        if (Notification.permission !== 'granted') {
            return;
        }

        try {
            // Get sender profile info
            const profile = await profileRepo.getProfileIgnoreTTL(senderNpub);
            let senderName = senderNpub.slice(0, 10) + '...';
            let senderPicture = undefined;

            if (profile && profile.metadata) {
                senderName = profile.metadata.name || profile.metadata.display_name || profile.metadata.displayName || senderName;
                senderPicture = profile.metadata.picture;
            }

            // Create notification
            let swRegistration: ServiceWorkerRegistration | undefined;

            if ('serviceWorker' in navigator) {
                try {
                    // Wait for service worker to be ready with a timeout
                    // This prevents hanging if no SW is registered (e.g. dev mode or desktop without PWA)
                    swRegistration = await Promise.race([
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
                    icon: senderPicture || '/favicons/favicon-192x192.png',
                    badge: '/favicons/favicon-192x192.png',
                    tag: `message-${senderNpub}`, // Group notifications by sender
                    requireInteraction: false,
                    silent: false,
                    data: {
                        url: `/chat/${senderNpub}`
                    }
                });
            } else {
                // Fallback for non-SW environments
                const notification = new Notification(`New message from ${senderName}`, {
                    body: message,
                    icon: senderPicture || '/favicons/favicon-192x192.png',
                    badge: '/favicons/favicon-192x192.png',
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
        if (typeof window !== 'undefined' && 'Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    public isSupported(): boolean {
        return typeof window !== 'undefined' && 'Notification' in window;
    }

    public isEnabled(): boolean {
        return this.settings.notificationsEnabled && 
               typeof window !== 'undefined' && 
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