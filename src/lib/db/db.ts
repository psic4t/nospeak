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
    fileWidth?: number;
    fileHeight?: number;
    fileBlurhash?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    // Group chat support (NIP-17)
    conversationId?: string; // npub for 1-on-1, hash for groups
    participants?: string[]; // null/undefined for 1-on-1, array of npubs for groups
    senderNpub?: string; // sender's npub for group messages (to show attribution)
    // Call event fields.
    //
    // The seven authored types — missed, ended, no-answer, declined, busy,
    // failed, cancelled — cover every terminal call outcome. A single
    // 'declined' covers both directions; the renderer picks role-aware copy
    // by comparing callInitiatorNpub to the local user. See
    // openspec/specs/voice-calling/spec.md → "Call History via Kind 1405
    // Events".
    //
    // Wire kind: rows authored by the current client carry rumorKind=1405
    // (CALL_HISTORY_KIND). Rows from earlier client versions may have
    // rumorKind=16 on disk; the Dexie v14 upgrade migrates those to 1405.
    // See openspec/changes/move-call-history-to-kind-1405.
    //
    // Legacy values 'outgoing' and 'incoming' may exist in DBs from older
    // schemas; the renderer falls them through to the generic "Voice call"
    // label. New code SHALL NOT author them.
    callEventType?:
        | 'missed'
        | 'ended'
        | 'no-answer'
        | 'declined'
        | 'busy'
        | 'failed'
        | 'cancelled'
        // Legacy / forward-compat fall-through values. Do not author.
        | 'outgoing'
        | 'incoming';
    callDuration?: number; // in seconds
    callInitiatorNpub?: string;
    callId?: string; // WebRTC call identifier; carried in the ['call-id', ...] tag
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
    /**
     * NIP-17 messaging relays (kind 10050). Source of truth for where this
     * user receives sealed direct messages. MUST NOT be populated from
     * NIP-65 (kind 10002) — those are public-note read/write relays and
     * have unrelated semantics. See `nip65Relays` for that data.
     */
    messagingRelays: string[];
    /**
     * NIP-65 relay list (kind 10002), combined read+write set. Stored
     * separately from `messagingRelays` so that public-note relay metadata
     * never leaks into DM routing. May be unused by current consumers; kept
     * for forward compatibility (e.g. note relay routing).
     */
    nip65Relays?: string[];
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

export interface FavoriteItem {
    eventId: string;
    conversationId: string;
    createdAt: number;
}

export interface ArchiveItem {
    conversationId: string;
    archivedAt: number;
}
 
export class NospeakDB extends Dexie {
    messages!: Table<Message, number>;
    profiles!: Table<Profile, string>; // npub as primary key
    contacts!: Table<ContactItem, string>; // npub as primary key
    retryQueue!: Table<RetryItem, number>;
    reactions!: Table<Reaction, number>;
    conversations!: Table<Conversation, string>; // conversationId as primary key
    favorites!: Table<FavoriteItem, string>; // eventId as primary key
    archives!: Table<ArchiveItem, string>; // conversationId as primary key
 
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

        // Version 11: Add favorites table for message favorites
        this.version(11).stores({
            favorites: 'eventId, conversationId, createdAt'
        });

        // Version 12: Add archives table for chat archiving
        this.version(12).stores({
            archives: 'conversationId, archivedAt'
        });

        // Version 13: Add emoji index to reactions for read receipt queries
        this.version(13).stores({
            reactions: '++id, targetEventId, reactionEventId, [targetEventId+authorNpub+emoji], emoji'
        });

        // Version 14: Migrate call-history rumor kind from 16 (NIP-18 generic
        // repost — incorrect public semantics) to 1405 (unassigned regular-
        // range kind, adjacent to NIP-17's 14/15). No store/index change.
        // See openspec/changes/move-call-history-to-kind-1405.
        this.version(14).stores({
            messages: '++id, [recipientNpub+sentAt], &eventId, sentAt, rumorId, [conversationId+sentAt]'
        }).upgrade(trans => migrateCallHistoryKindToV14(trans));
    }

    public async clearAll(): Promise<void> {
        await db.delete();
        await db.open();
        console.log('IndexedDB cleared');
    }
}

export const db = new NospeakDB();

/**
 * Dexie v14 upgrade body, extracted so it can be unit-tested without
 * running a real IndexedDB upgrade. Rewrites every {@link Message} row
 * whose `rumorKind === 16` AND whose `callEventType` is set so that
 * `rumorKind` becomes `1405`. All other rows are left untouched.
 *
 * Call-history rumors used to be authored as Kind 16 (NIP-18 Generic
 * Repost) — incorrect public semantics. They are now authored as Kind
 * 1405 (unassigned regular-range kind, adjacent to NIP-17's kinds 14/15).
 * See openspec/changes/move-call-history-to-kind-1405.
 *
 * The argument shape mirrors Dexie's `Transaction` interface only as far
 * as we need it: a `table(name)` function returning a Dexie-style
 * collection that supports `.filter(...).modify(...)`. Any failure is
 * caught and logged so a migration error does not brick app boot.
 */
export async function migrateCallHistoryKindToV14(trans: {
    table: (name: string) => {
        filter: (predicate: (row: any) => boolean) => {
            modify: (mutator: (row: any) => void) => Promise<unknown>;
        };
    };
}): Promise<void> {
    try {
        let migrated = 0;
        // Defensive guard: only rewrite rows that are actually
        // call-history events (rumorKind === 16 AND callEventType is
        // set). Any other kind-16 row would be malformed; leave it alone
        // to avoid corruption.
        await trans.table('messages')
            .filter((m: any) => m.rumorKind === 16 && !!m.callEventType)
            .modify((m: any) => {
                m.rumorKind = 1405;
                migrated++;
            });
        console.log('[Dexie v14] migrated call-history rumorKind 16 → 1405 rows:', migrated);
    } catch (err) {
        // Don't brick app boot on migration failure. Worst case those
        // users keep their kind-16 rows and the renderer won't show them
        // as call pills until the migration is re-attempted on a future
        // boot.
        console.error('[Dexie v14] call-history kind migration failed', err);
    }
}
