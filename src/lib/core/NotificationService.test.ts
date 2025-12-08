import { describe, it, expect, vi, beforeEach } from 'vitest';

const isAndroidNativeMock = vi.fn();
const scheduleMock = vi.fn().mockResolvedValue(undefined);
const createChannelMock = vi.fn().mockResolvedValue(undefined);
const checkPermissionsMock = vi.fn().mockResolvedValue({ display: 'granted' });
const requestPermissionsMock = vi.fn().mockResolvedValue({ display: 'granted' });
const addListenerMock = vi.fn().mockResolvedValue({ remove: vi.fn() });
const getProfileIgnoreTTLMock = vi.fn();

vi.mock('./NativeDialogs', () => ({
    isAndroidNative: isAndroidNativeMock
}));

vi.mock('@capacitor/local-notifications', () => ({
    LocalNotifications: {
        schedule: scheduleMock,
        createChannel: createChannelMock,
        checkPermissions: checkPermissionsMock,
        requestPermissions: requestPermissionsMock,
        addListener: addListenerMock
    }
}));

vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfileIgnoreTTL: getProfileIgnoreTTLMock
    }
}));

describe('NotificationService (Android local notifications)', () => {
    beforeEach(() => {
        vi.resetModules();
        scheduleMock.mockClear();
        createChannelMock.mockClear();
        checkPermissionsMock.mockClear();
        requestPermissionsMock.mockClear();
        addListenerMock.mockClear();
        getProfileIgnoreTTLMock.mockClear();
        isAndroidNativeMock.mockReset();

        if (typeof window !== 'undefined') {
            (window as any).localStorage = {
                store: {} as Record<string, string>,
                getItem(key: string) {
                    return (this.store as Record<string, string>)[key] ?? null;
                },
                setItem(key: string, value: string) {
                    (this.store as Record<string, string>)[key] = value;
                },
                removeItem(key: string) {
                    delete (this.store as Record<string, string>)[key];
                }
            };
        }
    });

    it('schedules an Android local notification when enabled and permission granted', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Alice' } });

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true
});


describe('NotificationService (web notifications)', () => {
    class FakeNotification {
        static permission = 'granted';
        static calls: Array<{ title: string; options: any }> = [];

        public onclick: (() => void) | null = null;

        constructor(title: string, options?: any) {
            FakeNotification.calls.push({ title, options: options ?? {} });
        }

        close() {
            // no-op for tests
        }
    }

    beforeEach(() => {
        vi.resetModules();
        getProfileIgnoreTTLMock.mockClear();
        isAndroidNativeMock.mockReset();
        FakeNotification.calls = [];

        if (typeof window !== 'undefined') {
            (window as any).localStorage = {
                store: {} as Record<string, string>,
                getItem(key: string) {
                    return (this.store as Record<string, string>)[key] ?? null;
                },
                setItem(key: string, value: string) {
                    (this.store as Record<string, string>)[key] = value;
                },
                removeItem(key: string) {
                    delete (this.store as Record<string, string>)[key];
                }
            };

            // Default to root route
            window.history.pushState({}, '', '/');
        }

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true
            });

            (document as any).hasFocus = vi.fn().mockReturnValue(true);
        }

        (globalThis as any).Notification = FakeNotification as any;
    });

    it('shows a browser notification when the tab is not active/visible', async () => {
        isAndroidNativeMock.mockReturnValue(false);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Alice' } });

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true
            });
            (document as any).hasFocus = vi.fn().mockReturnValue(false);
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1alice', 'Hello from Alice');

        expect(FakeNotification.calls.length).toBe(1);
        expect(FakeNotification.calls[0].title).toContain('Alice');
    });

    it('shows a browser notification when a different conversation is active in the foreground', async () => {
        isAndroidNativeMock.mockReturnValue(false);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Bob' } });

        if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/chat/npub1alice');
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true
            });
            (document as any).hasFocus = vi.fn().mockReturnValue(true);
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1bob', 'Hi from Bob');

        expect(FakeNotification.calls.length).toBe(1);
        expect(FakeNotification.calls[0].title).toContain('Bob');
    });

    it('suppresses a browser notification when the same conversation is active in the foreground', async () => {
        isAndroidNativeMock.mockReturnValue(false);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Carol' } });

        if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/chat/npub1carol');
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true
            });
            (document as any).hasFocus = vi.fn().mockReturnValue(true);
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1carol', 'Hi from Carol');

        expect(FakeNotification.calls.length).toBe(0);
    });
});

        }

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1alice', 'Hello from Alice');

        expect(createChannelMock).toHaveBeenCalledTimes(1);
        expect(scheduleMock).toHaveBeenCalledTimes(1);
        const args = scheduleMock.mock.calls[0][0];
        expect(args.notifications[0].title).toContain('Alice');
        expect(args.notifications[0].channelId).toBe('messages');
    });

    it('does not schedule when notifications are disabled in settings', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Bob' } });

        // Explicitly store disabled state
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: false }));
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1bob', 'Hi');

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('does not schedule when Android permission is denied', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Carol' } });
 
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }
 
        checkPermissionsMock.mockResolvedValueOnce({ display: 'denied' });
 
        const { notificationService } = await import('./NotificationService');
 
        await notificationService.showNewMessageNotification('npub1carol', 'Hi');
 
        expect(scheduleMock).not.toHaveBeenCalled();
    });
 
    it('suppresses Android notification when same conversation is active and visible', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Dave' } });
 
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }
 
        if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/chat/npub1dave');
        }
 
        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true
            });
            (document as any).hasFocus = vi.fn().mockReturnValue(true);
        }
 
        const { notificationService } = await import('./NotificationService');
 
        await notificationService.showNewMessageNotification('npub1dave', 'Hi from Dave');
 
        expect(scheduleMock).not.toHaveBeenCalled();
    });
});

