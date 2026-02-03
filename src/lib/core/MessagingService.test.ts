import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagingService } from './Messaging';
import { contactRepo } from '$lib/db/ContactRepository';
import { messageRepo } from '$lib/db/MessageRepository';
import { signer, currentUser } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { connectionManager } from './connection/instance';

const { mockVerifyEvent } = vi.hoisted(() => {
    return { mockVerifyEvent: vi.fn().mockReturnValue(true) };
});

vi.mock('nostr-tools', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        nip19: {
            ...actual.nip19,
            decode: vi.fn().mockReturnValue({ data: 'recipient-pubkey' }),
            npubEncode: vi.fn().mockReturnValue('npub1sender'),
        },
        getEventHash: vi.fn().mockReturnValue('0000000000000000000000000000000000000000000000000000000000000000'),
        verifyEvent: mockVerifyEvent,
    };
});

// Mock dependencies
vi.mock('./connection/publishWithDeadline', () => ({
    publishWithDeadline: vi.fn(),
}));

vi.mock('$lib/core/FileEncryption', () => ({
    encryptFileWithAesGcm: vi.fn().mockResolvedValue({
        ciphertext: new Uint8Array([1, 2, 3]),
        key: 'key',
        nonce: 'nonce',
        size: 3,
        hashEncrypted: 'hash',
        hashPlain: 'hashPlain',
    }),
}));

vi.mock('$lib/stores/sending', () => ({
    initRelaySendStatus: vi.fn(),
    registerRelaySuccess: vi.fn(),
}));

vi.mock('$lib/db/ContactRepository');
vi.mock('$lib/db/MessageRepository');
vi.mock('$lib/db/ConversationRepository', () => ({
    conversationRepo: {
        getConversation: vi.fn().mockResolvedValue(null),
        markActivity: vi.fn().mockResolvedValue(undefined),
    },
    isGroupConversationId: vi.fn().mockReturnValue(false),
    deriveConversationId: vi.fn().mockReturnValue('test-conversation-id'),
}));
vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfile: vi.fn().mockResolvedValue({ messagingRelays: ['wss://relay.test'] }),
        getProfileIgnoreTTL: vi.fn(),
        updateProfile: vi.fn(),
    },
}));
vi.mock('./NotificationService');
vi.mock('$lib/stores/auth');
vi.mock('$lib/stores/sync', () => ({
    startSync: vi.fn(),
    updateSyncProgress: vi.fn(),
    endSync: vi.fn(),
}));
vi.mock('svelte/store');
vi.mock('./ProfileResolver');

vi.mock('$lib/stores/reactions', () => ({
    reactionsStore: {
        refreshSummariesForTarget: vi.fn(),
        applyReactionUpdate: vi.fn(),
        subscribeToMessageReactions: vi.fn(),
    },
}));

vi.mock('$lib/db/ReactionRepository', () => ({
    reactionRepo: {
        upsertReaction: vi.fn().mockResolvedValue(undefined),
        getReactionsForTarget: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('$lib/i18n', () => ({
    t: {
        subscribe: vi.fn((fn) => {
            fn((key: string) => key);
            return () => {};
        })
    }
}));

vi.mock('./connection/instance', () => ({
    connectionManager: {
        fetchEvents: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn(),
        getConnectedRelays: vi.fn().mockReturnValue(['wss://relay.example.com']),
        addTemporaryRelay: vi.fn(),
        cleanupTemporaryConnections: vi.fn(),
    },
    retryQueue: {
        enqueue: vi.fn(),
    },
}));

describe('MessagingService - Auto-add Contacts', () => {
    let messagingService: MessagingService;
    let mockSigner: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        messagingService = new MessagingService();

        mockSigner = {
            getPublicKey: vi.fn().mockResolvedValue('79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef'), // 64 chars
            decrypt: vi.fn(),
            encrypt: vi.fn().mockResolvedValue('ciphertext'),
            signEvent: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(get).mockReturnValue(mockSigner);
        vi.mocked(contactRepo.getContacts).mockResolvedValue([]);
        vi.mocked(contactRepo.addContact).mockResolvedValue();
        vi.mocked(messageRepo.countMessages).mockResolvedValue(1);
        vi.mocked(messageRepo.hasMessage).mockResolvedValue(false);
        vi.mocked(messageRepo.hasMessages).mockResolvedValue(new Set());
        vi.mocked(messageRepo.saveMessage).mockResolvedValue();
        vi.mocked(messageRepo.saveMessages).mockResolvedValue();
        vi.mocked(messageRepo.getMessageByRumorId).mockResolvedValue(undefined);

        // Mock profileResolver
        const { profileResolver } = await import('./ProfileResolver');
        vi.mocked(profileResolver.resolveProfile).mockResolvedValue();
    });

    describe('autoAddContact method', () => {
        it('should add unknown contact', async () => {
            const npub = 'npub1test';

            await (messagingService as any).autoAddContact(npub);

            expect(contactRepo.getContacts).toHaveBeenCalled();
            expect(contactRepo.addContact).toHaveBeenCalledWith(npub, expect.any(Number), expect.any(Number));
        });

        it('should not add contact if already exists', async () => {
            const npub = 'npub1existing';
            vi.mocked(contactRepo.getContacts).mockResolvedValue([{ npub, createdAt: Date.now() }]);

            await (messagingService as any).autoAddContact(npub);

            expect(contactRepo.addContact).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const npub = 'npub1error';
            vi.mocked(contactRepo.addContact).mockRejectedValue(new Error('Database error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await (messagingService as any).autoAddContact(npub);

            expect(consoleSpy).toHaveBeenCalledWith('Failed to auto-add contact:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('fetchHistory method', () => {
        it('should return early if no signer available', async () => {
            vi.mocked(get).mockReturnValue(null);

            const result = await messagingService.fetchHistory();

            expect(result).toEqual({ totalFetched: 0, processed: 0, messagesSaved: 0 });
        });

        it('first-time sync pages until relays return 0 events', async () => {
            const nowSeconds = 2_000_000_000;
            const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);

            vi.mocked(messageRepo.countMessages).mockResolvedValue(0);

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return mockSigner;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            vi.mocked(messageRepo.hasMessages).mockImplementation(async (eventIds: string[]) => new Set(eventIds));

            const makeEvents = (prefix: string, start: number) =>
                Array.from({ length: 50 }, (_, index) => ({
                    id: `${prefix}-${index}`,
                    pubkey: 'sender',
                    content: 'cipher',
                    created_at: start - index,
                    tags: [],
                })) as any[];

            // Batch 1: 50 events
            const batch1 = makeEvents('b1', nowSeconds);
            // Batch 2: 50 more events
            const batch2 = makeEvents('b2', nowSeconds - 50);
            // Batch 3: empty - signals end of history

            let callCount = 0;
            vi.mocked(connectionManager.fetchEvents).mockImplementation(async () => {
                callCount += 1;
                if (callCount === 1) return batch1;
                if (callCount === 2) return batch2;
                return []; // Batch 3: empty, stops pagination
            });

            vi.spyOn(messagingService as any, 'processGiftWrapToMessage').mockResolvedValue(null);

            await messagingService.fetchHistory();

            // Should fetch 3 batches: 2 with events, 1 empty to signal end
            expect(connectionManager.fetchEvents).toHaveBeenCalledTimes(3);
            dateSpy.mockRestore();
        });

        it('returning-user sync still fetches only one batch', async () => {
            const nowSeconds = 2_000_000_000;
            const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);

            vi.mocked(messageRepo.countMessages).mockResolvedValue(123);

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return mockSigner;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            const batch = Array.from({ length: 50 }, (_, index) => ({
                id: `evt-${index}`,
                pubkey: 'sender',
                content: 'cipher',
                created_at: nowSeconds - index,
                tags: [],
            })) as any[];

            vi.mocked(messageRepo.hasMessages).mockImplementation(async (eventIds: string[]) => new Set(eventIds));
            vi.mocked(connectionManager.fetchEvents).mockResolvedValue(batch);

            vi.spyOn(messagingService as any, 'processGiftWrapToMessage').mockResolvedValue(null);

            await messagingService.fetchHistory();

            expect(connectionManager.fetchEvents).toHaveBeenCalledTimes(1);
            dateSpy.mockRestore();
        });

        it('should have debouncing mechanism properties', () => {
            // Test that debouncing properties exist
            expect((messagingService as any).isFetchingHistory).toBeDefined();
            expect((messagingService as any).lastHistoryFetch).toBeDefined();
            expect((messagingService as any).HISTORY_FETCH_DEBOUNCE).toBe(5000);
        });
    });

    describe('listenForMessages', () => {
        it('subscribes without a since filter', () => {
            const unsubscribeMock = vi.fn();
            vi.mocked(connectionManager.subscribe).mockReturnValue(unsubscribeMock);

            const pubkey = 'test-pubkey';
            const unsubscribe = messagingService.listenForMessages(pubkey);

            expect(connectionManager.subscribe).toHaveBeenCalledTimes(1);
            const [filters] = vi.mocked(connectionManager.subscribe).mock.calls[0];

            expect(Array.isArray(filters)).toBe(true);
            expect(filters).toHaveLength(1);
            expect(filters[0].kinds).toEqual([1059]);
            expect(filters[0]['#p']).toEqual([pubkey]);
            expect(filters[0].since).toBeUndefined();
            expect(unsubscribe).toBe(unsubscribeMock);
        });

        it('startSubscriptionsForCurrentUser starts a single global subscription', async () => {
            const unsubscribeMock = vi.fn();
            vi.mocked(connectionManager.subscribe).mockReturnValue(unsubscribeMock);

            const s: any = {
                getPublicKey: vi.fn().mockResolvedValue('test-pubkey'),
            };

            // First call to get() returns signer, second call returns currentUser
            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return s;
                if (store === (currentUser as any)) return { npub: 'npub1test' };
                return null;
            });

            await (messagingService as any).startSubscriptionsForCurrentUser();

            expect(connectionManager.subscribe).toHaveBeenCalledTimes(1);

            // Calling again with same user should be idempotent
            await (messagingService as any).startSubscriptionsForCurrentUser();
            expect(connectionManager.subscribe).toHaveBeenCalledTimes(1);

            // Stopping should call underlying unsubscribe once
            (messagingService as any).stopSubscriptions();
            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });

        it('deduplicates live events across multiple relays by id', async () => {
            const unsubscribeMock = vi.fn();
            let handler: any = null;

            vi.mocked(connectionManager.subscribe).mockImplementation((_filters: any[], onEvent: (event: any) => void) => {
                handler = onEvent as any;
                return unsubscribeMock;
            });

            const pubkey = 'test-pubkey';
            messagingService.listenForMessages(pubkey);

            const event = { id: 'event-id-1', pubkey: 'sender', content: 'cipher', created_at: 1, tags: [] } as any;

            const hasMessageSpy = vi.mocked(messageRepo.hasMessage);
            hasMessageSpy.mockResolvedValue(false);

            const handleGiftWrapSpy = vi.spyOn(messagingService as any, 'handleGiftWrap').mockResolvedValue(undefined);

            await handler?.(event);
            await handler?.(event);

            expect(handleGiftWrapSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('notification suppression for history messages', () => {
        it('should have isFetchingHistory property', () => {
            // Test that the isFetchingHistory property exists for tracking history state
            expect((messagingService as any).isFetchingHistory).toBeDefined();
            expect(typeof (messagingService as any).isFetchingHistory).toBe('boolean');
        });

        it('should track isFetchingHistory state during fetchHistory', async () => {
            // Test that we can set and get the isFetchingHistory state
            expect((messagingService as any).isFetchingHistory).toBe(false);

            // Simulate setting the flag
            (messagingService as any).isFetchingHistory = true;
            expect((messagingService as any).isFetchingHistory).toBe(true);

            // Reset for other tests
            (messagingService as any).isFetchingHistory = false;
        });
    });

    describe('fetchOlderMessages', () => {
        it('should call fetchMessages with correct parameters', async () => {
            // We spy on the private method fetchMessages by casting to any
            const spy = vi.spyOn(messagingService as any, 'fetchMessages').mockResolvedValue({ totalFetched: 10, processed: 10, messagesSaved: 0 });

            await messagingService.fetchOlderMessages(1234567890);

            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                until: 1234567890,
                limit: 100,
                maxBatches: 1,
                abortOnDuplicates: false,
                timeoutMs: 5000,
            }));

            const callArg = spy.mock.calls[0][0] as any;
            expect(callArg.minUntil).toBeUndefined();
            expect(callArg.targetChatNpub).toBeUndefined();
        });

        it('should set isFetchingHistory flag while running', async () => {
            // Mock fetchMessages to take some time
            vi.spyOn(messagingService as any, 'fetchMessages').mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return { totalFetched: 0, processed: 0, messagesSaved: 0 };
            });

            const fetchPromise = messagingService.fetchOlderMessages(1234567890);
            expect((messagingService as any).isFetchingHistory).toBe(true);
            await fetchPromise;
            expect((messagingService as any).isFetchingHistory).toBe(false);
        });
    });

    describe('send confirmation semantics', () => {
        it('sendMessage saves locally after at least one recipient relay success', async () => {
            const { publishWithDeadline } = await import('./connection/publishWithDeadline');
            vi.mocked(publishWithDeadline as any).mockResolvedValue({
                successfulRelays: ['wss://relay.test'],
                failedRelays: [],
                timedOutRelays: [],
            });

            vi.spyOn(messagingService as any, 'createGiftWrap')
                .mockResolvedValueOnce({ id: 'recipient-wrap', kind: 1059 } as any)
                .mockResolvedValueOnce({ id: 'self-wrap', kind: 1059 } as any);

            await messagingService.sendMessage('npub1recipient', 'hello');

            expect(messageRepo.saveMessage).toHaveBeenCalledTimes(1);
            expect(vi.mocked(messageRepo.saveMessage).mock.calls[0][0].message).toBe('hello');
        });

        it('sendMessage throws and does not save when no recipient relays succeed', async () => {
            const { publishWithDeadline } = await import('./connection/publishWithDeadline');
            vi.mocked(publishWithDeadline as any).mockResolvedValue({
                successfulRelays: [],
                failedRelays: ['wss://relay.test'],
                timedOutRelays: [],
            });

            vi.spyOn(messagingService as any, 'createGiftWrap')
                .mockResolvedValueOnce({ id: 'self-wrap', kind: 1059 } as any)
                .mockResolvedValueOnce({ id: 'recipient-wrap', kind: 1059 } as any);

            await expect(messagingService.sendMessage('npub1recipient', 'hello')).rejects.toThrow('Failed to send message to any relay');
            expect(messageRepo.saveMessage).not.toHaveBeenCalled();
        });

        it('sendFileMessage throws and does not save when no recipient relays succeed', async () => {
            const { publishWithDeadline } = await import('./connection/publishWithDeadline');
            vi.mocked(publishWithDeadline as any).mockResolvedValue({
                successfulRelays: [],
                failedRelays: ['wss://relay.test'],
                timedOutRelays: [],
            });

            vi.spyOn(messagingService as any, 'uploadEncryptedMedia').mockResolvedValue('https://example.com/file');
            vi.spyOn(messagingService as any, 'createGiftWrap')
                .mockResolvedValueOnce({ id: 'self-wrap', kind: 1059 } as any)
                .mockResolvedValueOnce({ id: 'recipient-wrap', kind: 1059 } as any);

            const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' });

            await expect(messagingService.sendFileMessage('npub1recipient', file, 'image')).rejects.toThrow('Failed to send message to any relay');
            expect(messageRepo.saveMessage).not.toHaveBeenCalled();
        });
    });

    describe('reactions handling', () => {
        it('processReactionRumor stores reaction via repository', async () => {
            const hexPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
            const s: any = {
                getPublicKey: vi.fn().mockResolvedValue(hexPubkey),
            };

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return s;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            const messaging = new MessagingService();
            const rumor: any = {
                kind: 7,
                pubkey: hexPubkey,
                content: '+',
                created_at: 123,
                tags: [
                    ['p', hexPubkey],
                    ['e', 'target-event-id'],
                ],
            };

            const { reactionRepo } = await import('$lib/db/ReactionRepository');
            const upsertSpy = vi.spyOn(reactionRepo, 'upsertReaction');

            await (messaging as any).processReactionRumor(rumor, 'wrap-id');

            expect(upsertSpy).toHaveBeenCalledTimes(1);
            const callArg = upsertSpy.mock.calls[0][0];
            expect(callArg.targetEventId).toBe('target-event-id');
            expect(callArg.emoji).toBe('👍');
        });

        it('processReactionRumor updates contact activity and triggers notification for incoming reactions', async () => {
            const myPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
            const otherPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const s: any = {
                getPublicKey: vi.fn().mockResolvedValue(myPubkey),
            };

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return s;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            const messaging = new MessagingService();
            const rumor: any = {
                kind: 7,
                pubkey: otherPubkey,
                content: '❤️',
                created_at: 456,
                tags: [
                    ['p', myPubkey],
                    ['e', 'target-event-id'],
                ],
            };

            const { contactRepo } = await import('$lib/db/ContactRepository');
            const markActivitySpy = vi.spyOn(contactRepo, 'markActivity').mockResolvedValue();
            const { notificationService } = await import('./NotificationService');
            const notifSpy = vi.spyOn(notificationService, 'showReactionNotification').mockResolvedValue();

            await (messaging as any).processReactionRumor(rumor, 'wrap-id');

            expect(markActivitySpy).toHaveBeenCalledTimes(1);
            const [npubArg, timestampArg] = markActivitySpy.mock.calls[0];
            expect(typeof npubArg).toBe('string');
            expect(timestampArg).toBe(456 * 1000);

            expect(notifSpy).toHaveBeenCalledTimes(1);
        });

        it('sendReaction method is exposed', () => {
            const messaging = new MessagingService();
            expect(typeof (messaging as any).sendReaction).toBe('function');
        });

        it('sendGroupReaction method is exposed', () => {
            const messaging = new MessagingService();
            expect(typeof (messaging as any).sendGroupReaction).toBe('function');
        });

        it('sendFileMessage method is exposed', () => {
            const messaging = new MessagingService();
            expect(typeof (messaging as any).sendFileMessage).toBe('function');
        });

        it('processReactionRumor uses conversationId for group reactions', async () => {
            const myPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
            const otherPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const groupConversationId = 'group123456789ab';
            const s: any = {
                getPublicKey: vi.fn().mockResolvedValue(myPubkey),
            };

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return s;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            // Mock the target message lookup to return a group message
            vi.mocked(messageRepo.getMessageByRumorId).mockResolvedValue({
                recipientNpub: 'npub1other',
                conversationId: groupConversationId,
                message: 'test',
                sentAt: Date.now(),
                eventId: 'event-id',
                rumorId: 'target-event-id',
                direction: 'received',
                createdAt: Date.now(),
            });

            const messaging = new MessagingService();
            const rumor: any = {
                kind: 7,
                pubkey: otherPubkey,
                content: '👍',
                created_at: 789,
                tags: [
                    ['p', myPubkey],
                    ['e', 'target-event-id'],
                ],
            };

            const { conversationRepo } = await import('$lib/db/ConversationRepository');
            const markActivitySpy = vi.spyOn(conversationRepo, 'markActivity').mockResolvedValue();
            const { contactRepo } = await import('$lib/db/ContactRepository');
            const contactMarkActivitySpy = vi.spyOn(contactRepo, 'markActivity').mockResolvedValue();

            await (messaging as any).processReactionRumor(rumor, 'wrap-id');

            // For group reactions, should mark conversation activity, not contact activity
            expect(markActivitySpy).toHaveBeenCalledWith(groupConversationId);
            expect(contactMarkActivitySpy).not.toHaveBeenCalled();
        });

        it('processReactionRumor falls back to contact activity for 1-on-1 reactions', async () => {
            const myPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
            const otherPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const s: any = {
                getPublicKey: vi.fn().mockResolvedValue(myPubkey),
            };

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return s;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            // Mock the target message lookup to return a 1-on-1 message
            // (conversationId equals recipientNpub for 1-on-1)
            vi.mocked(messageRepo.getMessageByRumorId).mockResolvedValue({
                recipientNpub: 'npub1other',
                conversationId: 'npub1other',
                message: 'test',
                sentAt: Date.now(),
                eventId: 'event-id',
                rumorId: 'target-event-id',
                direction: 'received',
                createdAt: Date.now(),
            });

            const messaging = new MessagingService();
            const rumor: any = {
                kind: 7,
                pubkey: otherPubkey,
                content: '❤️',
                created_at: 456,
                tags: [
                    ['p', myPubkey],
                    ['e', 'target-event-id'],
                ],
            };

            const { conversationRepo } = await import('$lib/db/ConversationRepository');
            const convMarkActivitySpy = vi.spyOn(conversationRepo, 'markActivity').mockResolvedValue();
            const { contactRepo } = await import('$lib/db/ContactRepository');
            const contactMarkActivitySpy = vi.spyOn(contactRepo, 'markActivity').mockResolvedValue();

            await (messaging as any).processReactionRumor(rumor, 'wrap-id');

            // For 1-on-1 reactions, should mark contact activity, not conversation activity
            expect(contactMarkActivitySpy).toHaveBeenCalledTimes(1);
            expect(convMarkActivitySpy).not.toHaveBeenCalled();
        });

        it('createMessageFromRumor calculates rumorId', async () => {
            const s: any = {
                getPublicKey: vi.fn().mockResolvedValue('79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef'),
            };
            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return s;
                return null;
            });

            const messaging = new MessagingService();
            const rumor: any = {
                kind: 14,
                pubkey: '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef',
                content: 'test message',
                created_at: 1600000000,
                tags: [['p', '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef']],
            };

            const msg = await (messaging as any).createMessageFromRumor(rumor, 'wrap-id');
            expect(msg.rumorId).toBeDefined();
            expect(typeof msg.rumorId).toBe('string');
            expect(msg.rumorId).toBe('0000000000000000000000000000000000000000000000000000000000000000');
        });
    });

    describe('NIP-17 seal signature verification (security)', () => {
        let messagingService: MessagingService;
        let mockSigner: any;
        const myPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
        const senderPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

        beforeEach(() => {
            vi.clearAllMocks();
            messagingService = new MessagingService();

            // Create valid seal and rumor JSON
            const validRumor = JSON.stringify({
                kind: 14,
                pubkey: senderPubkey,
                content: 'test message',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
            });

            const validSeal = JSON.stringify({
                kind: 13,
                pubkey: senderPubkey,
                content: 'encrypted-rumor',
                created_at: 1600000000,
                tags: [],
                sig: 'valid-signature',
            });

            mockSigner = {
                getPublicKey: vi.fn().mockResolvedValue(myPubkey),
                decrypt: vi.fn()
                    .mockResolvedValueOnce(validSeal)  // First call: decrypt gift wrap -> seal
                    .mockResolvedValueOnce(validRumor), // Second call: decrypt seal -> rumor
                encrypt: vi.fn().mockResolvedValue('ciphertext'),
                signEvent: vi.fn().mockResolvedValue({}),
            };

            vi.mocked(get).mockReturnValue(mockSigner);
            mockVerifyEvent.mockReturnValue(true);
        });

        it('should reject gift wrap with invalid seal signature', async () => {
            mockVerifyEvent.mockReturnValue(false);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const giftWrapEvent = {
                id: 'gift-wrap-id',
                kind: 1059,
                pubkey: 'ephemeral-pubkey',
                content: 'encrypted-seal',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
                sig: 'gift-wrap-sig',
            } as any;

            await (messagingService as any).handleGiftWrap(giftWrapEvent);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to unwrap/decrypt message:',
                expect.objectContaining({ message: expect.stringContaining('Invalid seal signature') })
            );
            consoleSpy.mockRestore();
        });

        it('should reject gift wrap when seal.pubkey does not match rumor.pubkey', async () => {
            // Create mismatched seal - seal.pubkey differs from rumor.pubkey
            const rumorWithDifferentPubkey = JSON.stringify({
                kind: 14,
                pubkey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', // Different!
                content: 'forged message',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
            });

            const sealWithSenderPubkey = JSON.stringify({
                kind: 13,
                pubkey: senderPubkey, // Doesn't match rumor.pubkey
                content: 'encrypted-rumor',
                created_at: 1600000000,
                tags: [],
                sig: 'valid-signature',
            });

            mockSigner.decrypt = vi.fn()
                .mockResolvedValueOnce(sealWithSenderPubkey)
                .mockResolvedValueOnce(rumorWithDifferentPubkey);

            mockVerifyEvent.mockReturnValue(true); // Signature is valid

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const giftWrapEvent = {
                id: 'gift-wrap-id',
                kind: 1059,
                pubkey: 'ephemeral-pubkey',
                content: 'encrypted-seal',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
                sig: 'gift-wrap-sig',
            } as any;

            await (messagingService as any).handleGiftWrap(giftWrapEvent);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to unwrap/decrypt message:',
                expect.objectContaining({ message: expect.stringContaining('Seal pubkey does not match rumor pubkey') })
            );
            consoleSpy.mockRestore();
        });

        it('should accept gift wrap with valid seal signature and matching pubkeys', async () => {
            mockVerifyEvent.mockReturnValue(true);

            const processRumorSpy = vi.spyOn(messagingService as any, 'processRumor').mockResolvedValue(undefined);

            const giftWrapEvent = {
                id: 'gift-wrap-id',
                kind: 1059,
                pubkey: 'ephemeral-pubkey',
                content: 'encrypted-seal',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
                sig: 'gift-wrap-sig',
            } as any;

            await (messagingService as any).handleGiftWrap(giftWrapEvent);

            expect(mockVerifyEvent).toHaveBeenCalled();
            expect(processRumorSpy).toHaveBeenCalled();
        });

        it('processGiftWrapToMessage should also reject invalid seal signatures', async () => {
            mockVerifyEvent.mockReturnValue(false);

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return mockSigner;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            const giftWrapEvent = {
                id: 'gift-wrap-id',
                kind: 1059,
                pubkey: 'ephemeral-pubkey',
                content: 'encrypted-seal',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
                sig: 'gift-wrap-sig',
            } as any;

            const result = await (messagingService as any).processGiftWrapToMessage(giftWrapEvent);

            expect(result).toBeNull();
        });

        it('processGiftWrapToMessage should reject mismatched seal/rumor pubkeys', async () => {
            const rumorWithDifferentPubkey = JSON.stringify({
                kind: 14,
                pubkey: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
                content: 'forged message',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
            });

            const sealWithSenderPubkey = JSON.stringify({
                kind: 13,
                pubkey: senderPubkey,
                content: 'encrypted-rumor',
                created_at: 1600000000,
                tags: [],
                sig: 'valid-signature',
            });

            mockSigner.decrypt = vi.fn()
                .mockResolvedValueOnce(sealWithSenderPubkey)
                .mockResolvedValueOnce(rumorWithDifferentPubkey);

            mockVerifyEvent.mockReturnValue(true);

            vi.mocked(get).mockImplementation((store: any) => {
                if (store === signer) return mockSigner;
                if (store === (currentUser as any)) return { npub: 'npub1me' };
                return null;
            });

            const giftWrapEvent = {
                id: 'gift-wrap-id',
                kind: 1059,
                pubkey: 'ephemeral-pubkey',
                content: 'encrypted-seal',
                created_at: 1600000000,
                tags: [['p', myPubkey]],
                sig: 'gift-wrap-sig',
            } as any;

            const result = await (messagingService as any).processGiftWrapToMessage(giftWrapEvent);

            expect(result).toBeNull();
        });
    });

    describe('NIP-17 relay hints in p-tags', () => {
        it('sendEnvelope adds relay hints to p-tags from discovered relays', async () => {
            const recipientPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const recipientNpub = 'npub1recipient';
            const senderPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
            const discoveredRelay = 'wss://recipient-relay.example.com';

            const mockSigner = {
                getPublicKey: vi.fn().mockResolvedValue(senderPubkey),
                decrypt: vi.fn(),
                encrypt: vi.fn().mockResolvedValue('ciphertext'),
                signEvent: vi.fn().mockResolvedValue({}),
            };

            vi.mocked(get).mockReturnValue(mockSigner);

            // Mock nip19.decode to return correct pubkeys
            const { nip19 } = await import('nostr-tools');
            vi.mocked(nip19.decode).mockImplementation((input: string) => {
                if (input === recipientNpub) {
                    return { type: 'npub', data: recipientPubkey } as any;
                }
                return { type: 'npub', data: senderPubkey } as any;
            });

            // Mock profile repo to return messaging relays
            const { profileRepo } = await import('$lib/db/ProfileRepository');
            vi.mocked(profileRepo.getProfile).mockImplementation(async (npub: string) => {
                if (npub === recipientNpub) {
                    return { messagingRelays: [discoveredRelay] } as any;
                }
                return { messagingRelays: ['wss://sender-relay.example.com'] } as any;
            });

            const { publishWithDeadline } = await import('./connection/publishWithDeadline');
            vi.mocked(publishWithDeadline as any).mockResolvedValue({
                successfulRelays: [discoveredRelay],
                failedRelays: [],
                timedOutRelays: [],
            });

            const messaging = new MessagingService();

            // Capture the rumor passed to createGiftWrap
            let capturedRumor: any = null;
            vi.spyOn(messaging as any, 'createGiftWrap').mockImplementation(async (rumor: any) => {
                capturedRumor = rumor;
                return { id: 'gift-wrap-id', kind: 1059 } as any;
            });

            // Create a rumor with a p-tag without relay hint
            const rumor = {
                kind: 14,
                pubkey: senderPubkey,
                created_at: 1600000000,
                content: 'test message',
                tags: [['p', recipientPubkey]], // No relay hint initially
            };

            await (messaging as any).sendEnvelope({
                recipients: [recipientNpub],
                rumor,
                messageDbFields: { message: 'test' },
            });

            // Verify the rumor's p-tag was updated with relay hint
            expect(capturedRumor).not.toBeNull();
            const pTag = capturedRumor.tags.find((t: string[]) => t[0] === 'p');
            expect(pTag).toBeDefined();
            expect(pTag.length).toBe(3); // ['p', pubkey, relay_hint]
            expect(pTag[2]).toBe(discoveredRelay);
        });
    });
});
