import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function setLocalStorage() {
    if (typeof window === 'undefined') {
        return;
    }

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

describe('NotificationService (Android native)', () => {
    beforeEach(() => {
        vi.resetModules();

        scheduleMock.mockClear();
        createChannelMock.mockClear();
        checkPermissionsMock.mockClear();
        requestPermissionsMock.mockClear();
        addListenerMock.mockClear();
        getProfileIgnoreTTLMock.mockClear();
        isAndroidNativeMock.mockReset();

        setLocalStorage();

        if (typeof window !== 'undefined') {
            (window as any).Capacitor = undefined;
        }

        vi.unstubAllGlobals();
    });

    it('does not schedule JS-driven Android notifications', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Alice' } });

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true
            });
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1alice', 'Hello from Alice');

        expect(scheduleMock).not.toHaveBeenCalled();
        expect(createChannelMock).not.toHaveBeenCalled();
        expect(checkPermissionsMock).not.toHaveBeenCalled();
    });

    it('does not schedule JS-driven Android reaction notifications', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Bob' } });

        if (typeof document !== 'undefined') {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true
            });
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showReactionNotification('npub1bob', '❤️');

        expect(scheduleMock).not.toHaveBeenCalled();
        expect(createChannelMock).not.toHaveBeenCalled();
        expect(checkPermissionsMock).not.toHaveBeenCalled();
    });

    it('still respects the notificationsEnabled toggle', async () => {
        isAndroidNativeMock.mockReturnValue(true);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Carol' } });

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: false }));
        }

        const { notificationService } = await import('./NotificationService');

        await notificationService.showNewMessageNotification('npub1carol', 'Hi');

        expect(scheduleMock).not.toHaveBeenCalled();
    });
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

        setLocalStorage();

        if (typeof window !== 'undefined') {
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

    it('uses robohash as icon when profile picture is missing', async () => {
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
        expect(FakeNotification.calls[0].options.icon).toBe('https://robohash.org/npub1alice.png?set=set1&bgset=bg2');
        expect(FakeNotification.calls[0].options.badge).toBe('/nospeak.svg');
    });

    it('uses profile picture as icon when available', async () => {
        isAndroidNativeMock.mockReturnValue(false);
        getProfileIgnoreTTLMock.mockResolvedValue({
            metadata: {
                name: 'Bob',
                picture: 'https://example.com/bob.png'
            }
        });

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

        await notificationService.showNewMessageNotification('npub1bob', 'Hi from Bob');

        expect(FakeNotification.calls.length).toBe(1);
        expect(FakeNotification.calls[0].options.icon).toBe('https://example.com/bob.png');
        expect(FakeNotification.calls[0].options.badge).toBe('/nospeak.svg');
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

    it('shows a browser reaction notification when tab is inactive', async () => {
        isAndroidNativeMock.mockReturnValue(false);
        getProfileIgnoreTTLMock.mockResolvedValue({ metadata: { name: 'Eve' } });

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

        await notificationService.showReactionNotification('npub1eve', '❤️');

        expect(FakeNotification.calls.length).toBe(1);
        expect(FakeNotification.calls[0].title).toContain('Eve');
        expect(FakeNotification.calls[0].options.icon).toBe('https://robohash.org/npub1eve.png?set=set1&bgset=bg2');
    });
});
