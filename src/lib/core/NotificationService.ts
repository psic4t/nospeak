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
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('nospeak-settings');
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
            const notification = new Notification(`New message from ${senderName}`, {
                body: message,
                icon: senderPicture || '/favicon.svg',
                badge: '/favicon.svg',
                tag: `message-${senderNpub}`, // Group notifications by sender
                requireInteraction: false,
                silent: false
            });

            // Click handler to focus the chat window
            notification.onclick = () => {
                window.focus();
                // Navigate to the sender's chat
                window.location.href = `/chat/${senderNpub}`;
                notification.close();
            };

            // Auto-close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);

        } catch (e) {
            console.error('Failed to show notification:', e);
        }
    }

    public async requestPermission(): Promise<boolean> {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    public isSupported(): boolean {
        return 'Notification' in window;
    }

    public isEnabled(): boolean {
        return this.settings.notificationsEnabled && Notification.permission === 'granted';
    }
}

export const notificationService = new NotificationService();