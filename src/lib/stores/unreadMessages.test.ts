import { describe, it, expect, vi } from 'vitest';

import {
    addUnreadMessage,
    addUnreadReaction,
    clearChatUnread,
    clearAppBadge,
    getTotalUnreadCount,
    getUnreadSnapshot,
    syncAppBadge
} from '$lib/stores/unreadMessages';

function withMockedWindowLocalStorage<T>(fn: (storage: any, store: Record<string, string>) => T): T {
    const originalWindow = (globalThis as any).window;
    const originalLocalStorage = originalWindow?.localStorage;

    const store: Record<string, string> = {};

    const mockLocalStorage = {
        getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        })
    };

    (globalThis as any).window = originalWindow ?? {};
    (globalThis as any).window.localStorage = mockLocalStorage;

    try {
        return fn(mockLocalStorage, store);
    } finally {
        (globalThis as any).window.localStorage = originalLocalStorage;
        (globalThis as any).window = originalWindow;
    }
}

function withMockedNavigator<T>(mockNavigator: any, fn: () => T): T {
    const originalNavigator = (globalThis as any).navigator;

    Object.defineProperty(globalThis, 'navigator', {
        value: mockNavigator,
        configurable: true
    });

    try {
        return fn();
    } finally {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator,
            configurable: true
        });
    }
}

describe('unreadMessages storage', () => {
    it('treats invalid JSON as empty', () => {
        withMockedWindowLocalStorage((storage) => {
            storage.getItem.mockReturnValue('{not-json');

            expect(getTotalUnreadCount('userA')).toBe(0);
        });
    });

    it('adds and deduplicates unread messages', () => {
        withMockedWindowLocalStorage((storage) => {
            addUnreadMessage('userA', 'contactA', 'event1');
            addUnreadMessage('userA', 'contactA', 'event1');

            expect(storage.setItem).toHaveBeenCalledTimes(2);

            const lastWrite = storage.setItem.mock.calls.at(-1)?.[1] as string;
            const parsed = JSON.parse(lastWrite) as any;

            expect(parsed.byChat.contactA.messages).toEqual(['event1']);
            expect(getTotalUnreadCount('userA')).toBe(1);
        });
    });

    it('adds unread reactions and counts each event', () => {
        withMockedWindowLocalStorage((storage) => {
            addUnreadReaction('userA', 'contactA', 'reaction1');
            addUnreadReaction('userA', 'contactA', 'reaction2');

            const lastWrite = storage.setItem.mock.calls.at(-1)?.[1] as string;
            const parsed = JSON.parse(lastWrite) as any;

            expect(parsed.byChat.contactA.reactions).toEqual(['reaction1', 'reaction2']);
            expect(getTotalUnreadCount('userA')).toBe(2);
        });
    });

    it('clears unread state for a chat', () => {
        withMockedWindowLocalStorage((storage, store) => {
            store['nospeak:unread:userA'] = JSON.stringify({
                version: 1,
                byChat: {
                    contactA: {
                        messages: ['event1'],
                        reactions: ['reaction1']
                    }
                }
            });

            clearChatUnread('userA', 'contactA');

            const lastWrite = storage.setItem.mock.calls.at(-1)?.[1] as string;
            const parsed = JSON.parse(lastWrite) as any;

            expect(parsed.byChat).toEqual({});
        });
    });

    it('returns snapshot sets per chat', () => {
        withMockedWindowLocalStorage((storage, store) => {
            store['nospeak:unread:userA'] = JSON.stringify({
                version: 1,
                byChat: {
                    contactA: {
                        messages: ['event1'],
                        reactions: ['reaction1']
                    }
                }
            });

            const snapshot = getUnreadSnapshot('userA', 'contactA');
            expect(snapshot.messages.has('event1')).toBe(true);
            expect(snapshot.reactions.has('reaction1')).toBe(true);
        });
    });
});

describe('unreadMessages badge syncing', () => {
    it('sets badge count when supported', async () => {
        await withMockedWindowLocalStorage((storage, store) => {
            store['nospeak:unread:userA'] = JSON.stringify({
                version: 1,
                byChat: {
                    contactA: {
                        messages: ['event1'],
                        reactions: ['reaction1', 'reaction2']
                    }
                }
            });

            const mockNavigator = {
                setAppBadge: vi.fn().mockResolvedValue(undefined)
            };

            return withMockedNavigator(mockNavigator, async () => {
                await syncAppBadge('userA');
                expect(mockNavigator.setAppBadge).toHaveBeenCalledWith(3);
            });
        });
    });

    it('clears badge when total reaches zero', async () => {
        await withMockedWindowLocalStorage((storage, store) => {
            store['nospeak:unread:userA'] = JSON.stringify({
                version: 1,
                byChat: {}
            });

            const mockNavigator = {
                clearAppBadge: vi.fn().mockResolvedValue(undefined)
            };

            return withMockedNavigator(mockNavigator, async () => {
                await syncAppBadge('userA');
                expect(mockNavigator.clearAppBadge).toHaveBeenCalled();
            });
        });
    });

    it('swallows badging API errors', async () => {
        await withMockedWindowLocalStorage((storage, store) => {
            store['nospeak:unread:userA'] = JSON.stringify({
                version: 1,
                byChat: {
                    contactA: {
                        messages: ['event1'],
                        reactions: []
                    }
                }
            });

            const mockNavigator = {
                setAppBadge: vi.fn().mockRejectedValue(new Error('fail'))
            };

            return withMockedNavigator(mockNavigator, async () => {
                await expect(syncAppBadge('userA')).resolves.toBeUndefined();
            });
        });
    });

    it('clearAppBadge is best-effort', async () => {
        const mockNavigator = {
            clearAppBadge: vi.fn().mockRejectedValue(new Error('fail')),
            setAppBadge: vi.fn().mockResolvedValue(undefined)
        };

        await withMockedNavigator(mockNavigator, async () => {
            await expect(clearAppBadge()).resolves.toBeUndefined();
        });
    });
});
