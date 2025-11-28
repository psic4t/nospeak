import Dexie, { type Table } from 'dexie';
import type { Event, NostrEvent } from 'nostr-tools';

export interface Message {
    id?: number; // Auto-increment
    recipientNpub: string;
    message: string;
    sentAt: number; // timestamp
    eventId: string;
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
}

export class NospeakDB extends Dexie {
    messages!: Table<Message, number>;
    profiles!: Table<Profile, string>; // npub as primary key
    contacts!: Table<ContactItem, string>; // npub as primary key
    retryQueue!: Table<RetryItem, number>;

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
    }

    public async clearAll(): Promise<void> {
        await db.delete();
        await db.open();
        console.log('IndexedDB cleared');
    }
}

export const db = new NospeakDB();
