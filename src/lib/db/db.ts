import Dexie, { type Table } from 'dexie';
import type { NostrEvent } from 'nostr-tools';

export interface Message {
    id?: number; // Auto-increment
    recipientNpub: string;
    message: string;
    sentAt: number; // timestamp
    eventId: string;
    rumorId?: string; // Stable ID of the inner rumor
    direction: 'sent' | 'received';
    createdAt: number;
}

export interface Profile {
    npub: string;
    metadata: any; // NIP-01 metadata
    readRelays: string[];
    writeRelays: string[];
    cachedAt: number;
    expiresAt: number;
    nip05Status?: 'valid' | 'invalid' | 'unknown';
    nip05LastChecked?: number;
    nip05Pubkey?: string;
    nip05Error?: string;
}

export interface RetryItem {
    id?: number;
    event: NostrEvent;
    targetRelay: string;
    attempt: number;
    maxAttempts: number;
    nextAttempt: number;
    createdAt: number;
}

export interface ContactItem {
    npub: string;
    createdAt: number;
    lastReadAt?: number;
}

export interface Reaction {
    id?: number;
    targetEventId: string;
    reactionEventId: string;
    authorNpub: string;
    emoji: string;
    createdAt: number;
}
 
export class NospeakDB extends Dexie {
    messages!: Table<Message, number>;
    profiles!: Table<Profile, string>; // npub as primary key
    contacts!: Table<ContactItem, string>; // npub as primary key
    retryQueue!: Table<RetryItem, number>;
    reactions!: Table<Reaction, number>;
 
    constructor() {
        super('NospeakDB');
        this.version(1).stores({
            messages: '++id, [recipientNpub+sentAt], eventId, sentAt',
            profiles: 'npub',
            retryQueue: '++id, nextAttempt'
        });
        this.version(2).stores({
            contacts: 'npub'
        });
        // Version 3: Cleanup duplicates (schema same as v1/v2 effectively regarding indices)
        this.version(3).stores({
            messages: '++id, [recipientNpub+sentAt], eventId, sentAt'
        }).upgrade(async trans => {
            const messages = await trans.table('messages').toArray();
            const seen = new Set<string>();
            const toDelete: number[] = [];
            
            for (const msg of messages) {
                if (seen.has(msg.eventId)) {
                    toDelete.push(msg.id!);
                } else {
                    seen.add(msg.eventId);
                }
            }
            
            if (toDelete.length > 0) {
                await trans.table('messages').bulkDelete(toDelete);
            }
        });
        
        // Version 4: Apply unique constraint
        this.version(4).stores({
            messages: '++id, [recipientNpub+sentAt], &eventId, sentAt'
        });
        
        // Version 5: Add lastReadAt to contacts
        this.version(5).stores({
            contacts: 'npub'
        });

        // Version 6: Add reactions table
        this.version(6).stores({
            reactions: '++id, targetEventId, reactionEventId, [targetEventId+authorNpub+emoji]'
        });

        // Version 7: Add rumorId to messages
        this.version(7).stores({
            messages: '++id, [recipientNpub+sentAt], &eventId, sentAt, rumorId'
        });
    }

    public async clearAll(): Promise<void> {
        await db.delete();
        await db.open();
        console.log('IndexedDB cleared');
    }
}

export const db = new NospeakDB();
