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
    rumorKind?: number; // 14 for text, 15 for file messages
    parentRumorId?: string; // direct parent from NIP-17 e tag when applicable
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
    fileHashEncrypted?: string;
    fileHashPlain?: string;
    fileEncryptionAlgorithm?: string; // e.g. "aes-gcm" for nospeak-sent files
    fileKey?: string;
    fileNonce?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    // Group chat support (NIP-17)
    conversationId?: string; // npub for 1-on-1, hash for groups
    participants?: string[]; // null/undefined for 1-on-1, array of npubs for groups
    senderNpub?: string; // sender's npub for group messages (to show attribution)
}

export interface Conversation {
    id: string; // npub for 1-on-1, hash for groups
    isGroup: boolean;
    participants: string[]; // npubs of all participants
    subject?: string; // group chat title
    // When subject was last updated from a NIP-17 rumor.
    // Used to prevent older subject-bearing messages from overwriting newer ones
    // during out-of-order sync.
    subjectUpdatedAt?: number; // ms since epoch (rumor.created_at * 1000)
    subjectUpdatedRumorId?: string; // tie-breaker for same-second updates
    lastActivityAt: number;
    lastReadAt?: number;
    createdAt: number;
}

export interface Profile {
    npub: string;
    metadata: any; // NIP-01 metadata
    messagingRelays: string[];
    mediaServers: string[];
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
    lastActivityAt?: number;
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
    conversations!: Table<Conversation, string>; // conversationId as primary key
 
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

        // Version 8: Add lastActivityAt to contacts (no index change)
        this.version(8).stores({
            contacts: 'npub'
        });

        // Version 9: Add mediaServers to profiles
        this.version(9).stores({
            profiles: 'npub'
        }).upgrade(async trans => {
            const profiles = await trans.table('profiles').toArray();
            const updates = profiles
                .filter((p: any) => !Array.isArray((p as any).mediaServers))
                .map((p: any) => ({ ...p, mediaServers: [] }));

            if (updates.length > 0) {
                await trans.table('profiles').bulkPut(updates);
            }
        });

        // Version 10: Add group chat support - conversationId field to messages and conversations table
        this.version(10).stores({
            messages: '++id, [recipientNpub+sentAt], &eventId, sentAt, rumorId, [conversationId+sentAt]',
            conversations: 'id, lastActivityAt'
        }).upgrade(async trans => {
            // Populate conversationId from recipientNpub for existing 1-on-1 messages
            const messages = await trans.table('messages').toArray();
            const updates = messages
                .filter((m: any) => !m.conversationId)
                .map((m: any) => ({ ...m, conversationId: m.recipientNpub }));

            if (updates.length > 0) {
                await trans.table('messages').bulkPut(updates);
            }
        });
    }

    public async clearAll(): Promise<void> {
        await db.delete();
        await db.open();
        console.log('IndexedDB cleared');
    }
}

export const db = new NospeakDB();
