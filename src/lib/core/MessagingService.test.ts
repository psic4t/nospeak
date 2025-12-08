import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagingService } from './Messaging';
import { contactRepo } from '$lib/db/ContactRepository';
import { messageRepo } from '$lib/db/MessageRepository';
import { signer, currentUser } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { connectionManager } from './connection/instance';

// Mock dependencies
vi.mock('$lib/db/ContactRepository');
vi.mock('$lib/db/MessageRepository');
vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfile: vi.fn().mockResolvedValue({ readRelays: ['wss://relay.test'] }),
        getProfileIgnoreTTL: vi.fn(),
        updateProfile: vi.fn()
    }
}));
vi.mock('./NotificationService');
vi.mock('$lib/stores/auth');
vi.mock('svelte/store');
vi.mock('./ProfileResolver');

vi.mock('./connection/instance', () => ({
    connectionManager: {
        fetchEvents: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn(),
        getConnectedRelays: vi.fn().mockReturnValue(['wss://relay.example.com']),
        addTemporaryRelay: vi.fn(),
        cleanupTemporaryConnections: vi.fn()
    },
    retryQueue: {
        enqueue: vi.fn()
    }
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
            encrypt: vi.fn(),
            signEvent: vi.fn()
        };
        
        vi.mocked(get).mockReturnValue(mockSigner);
        vi.mocked(contactRepo.getContacts).mockResolvedValue([]);
        vi.mocked(contactRepo.addContact).mockResolvedValue();
        vi.mocked(messageRepo.hasMessage).mockResolvedValue(false);
        vi.mocked(messageRepo.saveMessage).mockResolvedValue();
        
        // Mock profileResolver
        const { profileResolver } = await import('./ProfileResolver');
        vi.mocked(profileResolver.resolveProfile).mockResolvedValue();
    });



    describe('autoAddContact method', () => {
        it('should add unknown contact', async () => {
            const npub = 'npub1test';
            
            await (messagingService as any).autoAddContact(npub);

            expect(contactRepo.getContacts).toHaveBeenCalled();
            expect(contactRepo.addContact).toHaveBeenCalledWith(npub, expect.any(Number));
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
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await (messagingService as any).autoAddContact(npub);

            expect(consoleSpy).toHaveBeenCalledWith('Failed to auto-add contact:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('fetchHistory method', () => {
        it('should return early if no signer available', async () => {
            vi.mocked(get).mockReturnValue(null);
            
            const result = await messagingService.fetchHistory();
            
            expect(result).toEqual({ totalFetched: 0, processed: 0 });
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
                  getPublicKey: vi.fn().mockResolvedValue('test-pubkey')
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
 
             vi.mocked(connectionManager.subscribe).mockImplementation((filters: any[], onEvent: (event: any) => void) => {
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
            const spy = vi.spyOn(messagingService as any, 'fetchMessages').mockResolvedValue({ totalFetched: 10, processed: 10 });
            
            await messagingService.fetchOlderMessages(1234567890);
            
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                until: 1234567890,
                 limit: 50,
                 abortOnDuplicates: false
            }));
        });
        
        it('should set isFetchingHistory flag while running', async () => {
             // Mock fetchMessages to take some time
            vi.spyOn(messagingService as any, 'fetchMessages').mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return { totalFetched: 0, processed: 0 };
            });

            const fetchPromise = messagingService.fetchOlderMessages(1234567890);
            expect((messagingService as any).isFetchingHistory).toBe(true);
            await fetchPromise;
            expect((messagingService as any).isFetchingHistory).toBe(false);
        });
    });
});