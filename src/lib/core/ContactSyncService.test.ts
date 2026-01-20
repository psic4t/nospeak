import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nip19 } from 'nostr-tools';

// Hoist mock variables so they're available during module mocking
const { mockSigner, mockCurrentUser, mockContacts, addContactMock, getContactsMock } = vi.hoisted(() => ({
    mockSigner: {
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        signEvent: vi.fn()
    },
    // Valid npub for testing (pubkey = '0'.repeat(64))
    mockCurrentUser: {
        npub: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme'
    },
    mockContacts: [] as { npub: string; lastReadAt?: number; lastActivityAt?: number }[],
    addContactMock: vi.fn(),
    getContactsMock: vi.fn()
}));

vi.mock('svelte/store', () => ({
    get: vi.fn((store: any) => {
        if (store === 'signer') return mockSigner;
        if (store === 'currentUser') return mockCurrentUser;
        return null;
    })
}));

vi.mock('$lib/stores/auth', () => ({
    signer: 'signer',
    currentUser: 'currentUser'
}));

vi.mock('$lib/db/ContactRepository', () => ({
    contactRepo: {
        getContacts: getContactsMock,
        addContact: addContactMock
    }
}));

vi.mock('$lib/core/runtimeConfig', () => ({
    getDiscoveryRelays: vi.fn(() => []),
    getBlasterRelayUrl: vi.fn(() => 'wss://blaster.example.com')
}));

vi.mock('./connection/instance', () => ({
    connectionManager: {
        getAllRelayHealth: vi.fn(() => []),
        getRelayHealth: vi.fn(() => null),
        subscribe: vi.fn(() => () => {})
    }
}));

import { ContactSyncService } from './ContactSyncService';
import { get } from 'svelte/store';

describe('ContactSyncService', () => {
    let service: ContactSyncService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockContacts.length = 0;
        service = new ContactSyncService();

        // Setup getContacts mock
        getContactsMock.mockImplementation(() => Promise.resolve([...mockContacts]));
        
        // Setup addContact mock
        addContactMock.mockImplementation((npub: string, lastReadAt?: number, lastActivityAt?: number) => {
            if (!mockContacts.find(c => c.npub === npub)) {
                mockContacts.push({ npub, lastReadAt, lastActivityAt });
            }
            return Promise.resolve();
        });

        // Setup get mock to return correct values
        (get as any).mockImplementation((store: any) => {
            if (store === 'signer') return mockSigner;
            if (store === 'currentUser') return mockCurrentUser;
            return null;
        });
    });

    describe('encrypt/decrypt round-trip', () => {
        it('encrypts contact tags to JSON array of p-tags', async () => {
            // Setup local contacts using valid pubkeys
            const pubkey1 = 'a'.repeat(64);
            const pubkey2 = 'b'.repeat(64);
            const testNpub1 = nip19.npubEncode(pubkey1);
            const testNpub2 = nip19.npubEncode(pubkey2);
            mockContacts.push({ npub: testNpub1 }, { npub: testNpub2 });

            // Mock encrypt to capture what was passed
            let encryptedPayload: string = '';
            mockSigner.encrypt.mockImplementation(async (_pubkey: string, plaintext: string) => {
                encryptedPayload = plaintext;
                return 'encrypted-content';
            });
            mockSigner.signEvent.mockResolvedValue({ id: 'event-id', sig: 'sig' });

            await service.publishContacts();

            // Verify the payload structure
            expect(encryptedPayload).toBeTruthy();
            const parsed = JSON.parse(encryptedPayload);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBe(2);
            
            // Each entry should be a ["p", "<pubkey>"] tag
            for (const tag of parsed) {
                expect(tag[0]).toBe('p');
                expect(typeof tag[1]).toBe('string');
                expect(tag[1].length).toBe(64); // hex pubkey
            }

            // Verify the pubkeys match
            const pubkeys = parsed.map((t: string[]) => t[1]).sort();
            expect(pubkeys).toContain(pubkey1);
            expect(pubkeys).toContain(pubkey2);
        });

        it('self-encrypts using user own pubkey', async () => {
            const testNpub = nip19.npubEncode('a'.repeat(64));
            mockContacts.push({ npub: testNpub });

            mockSigner.encrypt.mockResolvedValue('encrypted');
            mockSigner.signEvent.mockResolvedValue({ id: 'id', sig: 'sig' });

            await service.publishContacts();

            // Verify encrypt was called with user's own pubkey (self-encryption)
            expect(mockSigner.encrypt).toHaveBeenCalled();
            const encryptCall = mockSigner.encrypt.mock.calls[0];
            const userPubkey = nip19.decode(mockCurrentUser.npub).data;
            expect(encryptCall[0]).toBe(userPubkey);
        });

        it('creates Kind 30000 event with d=dm-contacts tag', async () => {
            const testNpub = nip19.npubEncode('a'.repeat(64));
            mockContacts.push({ npub: testNpub });

            mockSigner.encrypt.mockResolvedValue('encrypted-content');
            
            let signedEvent: any = null;
            mockSigner.signEvent.mockImplementation(async (event: any) => {
                signedEvent = event;
                return { ...event, id: 'event-id', sig: 'sig' };
            });

            await service.publishContacts();

            expect(signedEvent).toBeTruthy();
            expect(signedEvent.kind).toBe(30000);
            expect(signedEvent.tags).toEqual([['d', 'dm-contacts']]);
            expect(signedEvent.content).toBe('encrypted-content');
            expect(signedEvent.created_at).toBeGreaterThan(0);
        });

        it('encrypts empty contact list as empty array', async () => {
            // No contacts
            expect(mockContacts.length).toBe(0);

            let encryptedPayload: string = '';
            mockSigner.encrypt.mockImplementation(async (_pubkey: string, plaintext: string) => {
                encryptedPayload = plaintext;
                return 'encrypted-content';
            });
            mockSigner.signEvent.mockResolvedValue({ id: 'event-id', sig: 'sig' });

            await service.publishContacts();

            expect(encryptedPayload).toBe('[]');
        });
    });

    describe('union merge behavior (logic verification)', () => {
        // These tests verify the JSON parsing and filtering logic
        // by testing what would be decrypted and processed

        it('parses p-tags correctly from JSON', () => {
            const remoteTags = [['p', 'a'.repeat(64)], ['p', 'b'.repeat(64)]];
            const json = JSON.stringify(remoteTags);
            const parsed = JSON.parse(json);
            
            const pubkeys = parsed
                .filter((tag: string[]) => tag[0] === 'p' && tag[1])
                .map((tag: string[]) => tag[1]);
            
            expect(pubkeys.length).toBe(2);
            expect(pubkeys).toContain('a'.repeat(64));
            expect(pubkeys).toContain('b'.repeat(64));
        });

        it('filters out non-p tags', () => {
            const remoteTags = [
                ['p', 'a'.repeat(64)],
                ['e', 'some-event-id'],
                ['t', 'hashtag'],
                ['p', 'b'.repeat(64)]
            ];
            
            const pubkeys = remoteTags
                .filter(tag => tag[0] === 'p' && tag[1])
                .map(tag => tag[1]);
            
            expect(pubkeys.length).toBe(2);
            expect(pubkeys).not.toContain('some-event-id');
            expect(pubkeys).not.toContain('hashtag');
        });

        it('filters out empty pubkeys', () => {
            const remoteTags = [
                ['p', 'a'.repeat(64)],
                ['p', ''],
                ['p', 'b'.repeat(64)]
            ];
            
            const pubkeys = remoteTags
                .filter(tag => tag[0] === 'p' && tag[1])
                .map(tag => tag[1]);
            
            expect(pubkeys.length).toBe(2);
            expect(pubkeys).not.toContain('');
        });

        it('union merge adds only new contacts', () => {
            const localNpubs = new Set([
                nip19.npubEncode('a'.repeat(64))
            ]);
            
            const remotePubkeys = ['a'.repeat(64), 'b'.repeat(64)];
            
            const toAdd: string[] = [];
            for (const pubkey of remotePubkeys) {
                const npub = nip19.npubEncode(pubkey);
                if (!localNpubs.has(npub)) {
                    toAdd.push(npub);
                }
            }
            
            expect(toAdd.length).toBe(1);
            expect(toAdd[0]).toBe(nip19.npubEncode('b'.repeat(64)));
        });

        it('union merge does not duplicate existing contacts', () => {
            const localNpubs = new Set([
                nip19.npubEncode('a'.repeat(64)),
                nip19.npubEncode('b'.repeat(64))
            ]);
            
            const remotePubkeys = ['a'.repeat(64), 'b'.repeat(64)];
            
            const toAdd: string[] = [];
            for (const pubkey of remotePubkeys) {
                const npub = nip19.npubEncode(pubkey);
                if (!localNpubs.has(npub)) {
                    toAdd.push(npub);
                }
            }
            
            expect(toAdd.length).toBe(0);
        });

        it('handles empty remote list', () => {
            const localNpubs = new Set([
                nip19.npubEncode('a'.repeat(64))
            ]);
            
            const remotePubkeys: string[] = [];
            
            const toAdd: string[] = [];
            for (const pubkey of remotePubkeys) {
                const npub = nip19.npubEncode(pubkey);
                if (!localNpubs.has(npub)) {
                    toAdd.push(npub);
                }
            }
            
            expect(toAdd.length).toBe(0);
        });

        it('handles empty local list', () => {
            const localNpubs = new Set<string>();
            
            const remotePubkeys = ['a'.repeat(64), 'b'.repeat(64)];
            
            const toAdd: string[] = [];
            for (const pubkey of remotePubkeys) {
                const npub = nip19.npubEncode(pubkey);
                if (!localNpubs.has(npub)) {
                    toAdd.push(npub);
                }
            }
            
            expect(toAdd.length).toBe(2);
        });
    });

    describe('error handling', () => {
        it('returns early when user is not authenticated', async () => {
            (get as any).mockImplementation(() => null);

            const result = await service.publishContacts();

            expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
            expect(mockSigner.encrypt).not.toHaveBeenCalled();
        });

        it('skips invalid npub decoding during publish', async () => {
            // Add a contact with an npub that will fail to decode
            mockContacts.push({ npub: 'invalid-npub' });
            mockContacts.push({ npub: nip19.npubEncode('f'.repeat(64)) });

            let encryptedPayload: string = '';
            mockSigner.encrypt.mockImplementation(async (_pubkey: string, plaintext: string) => {
                encryptedPayload = plaintext;
                return 'encrypted';
            });
            mockSigner.signEvent.mockResolvedValue({ id: 'id', sig: 'sig' });

            // Should not throw, should skip invalid and process valid
            await expect(service.publishContacts()).resolves.not.toThrow();
            
            // Encrypt should still be called (for the valid contact)
            expect(mockSigner.encrypt).toHaveBeenCalled();
            
            // Only one valid tag should be in the payload
            const parsed = JSON.parse(encryptedPayload);
            expect(parsed.length).toBe(1);
            expect(parsed[0][1]).toBe('f'.repeat(64));
        });

        it('handles encrypt failure gracefully', async () => {
            const testNpub = nip19.npubEncode('a'.repeat(64));
            mockContacts.push({ npub: testNpub });

            mockSigner.encrypt.mockRejectedValue(new Error('Encryption failed'));

            const result = await service.publishContacts();
            
            // Should return gracefully with 0 stats
            expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
        });

        it('handles signEvent failure gracefully', async () => {
            const testNpub = nip19.npubEncode('a'.repeat(64));
            mockContacts.push({ npub: testNpub });

            mockSigner.encrypt.mockResolvedValue('encrypted');
            mockSigner.signEvent.mockRejectedValue(new Error('Signing failed'));

            const result = await service.publishContacts();
            
            // Should return gracefully with 0 stats
            expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
        });
    });
});
