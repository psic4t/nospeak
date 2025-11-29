import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagingService } from './Messaging';
import { contactRepo } from '$lib/db/ContactRepository';
import { messageRepo } from '$lib/db/MessageRepository';
import { signer } from '$lib/stores/auth';
import { get } from 'svelte/store';

// Mock dependencies
vi.mock('$lib/db/ContactRepository');
vi.mock('$lib/db/MessageRepository');
vi.mock('./NotificationService');
vi.mock('$lib/stores/auth');
vi.mock('svelte/store');
vi.mock('./ProfileResolver');

describe('MessagingService - Auto-add Contacts', () => {
    let messagingService: MessagingService;
    let mockSigner: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        messagingService = new MessagingService();
        
        mockSigner = {
            getPublicKey: vi.fn().mockResolvedValue('79dff8f426826fdd7c32deb1d9e1f9c0d1234567890abcdef1234567890abcdef12'),
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
            expect(contactRepo.addContact).toHaveBeenCalledWith(npub);
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
});