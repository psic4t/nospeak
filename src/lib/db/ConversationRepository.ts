import { db, type Conversation } from './db';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { nip19 } from 'nostr-tools';

/**
 * Derives a deterministic conversation ID from participant pubkeys.
 * For 1-on-1 chats, returns the partner's npub.
 * For group chats, returns a 16-character hash of sorted participant pubkeys.
 * 
 * @param participantPubkeys Array of hex pubkeys (including self)
 * @param selfPubkey The current user's hex pubkey
 * @returns conversationId string
 */
export function deriveConversationId(participantPubkeys: string[], selfPubkey: string): string {
    // Filter out self if present and check count
    const others = participantPubkeys.filter(p => p !== selfPubkey);
    
    if (others.length === 1) {
        // 1-on-1 chat: use partner's npub as conversation ID
        return nip19.npubEncode(others[0]);
    }
    
    // Group chat: hash all participants (including self)
    const allPubkeys = [...new Set([...participantPubkeys, selfPubkey])];
    const sorted = allPubkeys.sort();
    const concatenated = sorted.join('');
    // noble hashes v1 accepts string or Uint8Array
    const hashBytes = sha256(concatenated);
    const hashHex = bytesToHex(hashBytes);
    return hashHex.slice(0, 16);
}

/**
 * Checks if a conversation ID represents a group chat.
 * Group IDs are 16-character hex hashes; 1-on-1 IDs start with 'npub1'.
 */
export function isGroupConversationId(conversationId: string): boolean {
    return !conversationId.startsWith('npub1');
}

/**
 * Generates an auto-title from participant names.
 * Format: "Alice, Bob, Carol" or "Alice, Bob, +3 more" if too long.
 * 
 * @param names Array of display names
 * @param maxLength Maximum title length (default 50)
 * @returns Generated title string
 */
export function generateGroupTitle(names: string[], maxLength: number = 50): string {
    if (names.length === 0) return 'Group Chat';
    if (names.length === 1) return names[0];
    
    // Try to fit all names
    let title = names.join(', ');
    if (title.length <= maxLength) {
        return title;
    }
    
    // Progressively add names until we exceed the limit
    let includedNames: string[] = [];
    for (let i = 0; i < names.length; i++) {
        const remaining = names.length - i - 1;
        const suffix = remaining > 0 ? `, +${remaining} more` : '';
        const testTitle = [...includedNames, names[i]].join(', ') + suffix;
        
        if (testTitle.length > maxLength && includedNames.length > 0) {
            // Use the previous state
            const prevRemaining = names.length - includedNames.length;
            return includedNames.join(', ') + `, +${prevRemaining} more`;
        }
        
        includedNames.push(names[i]);
    }
    
    return includedNames.join(', ');
}

export function shouldReplaceConversationSubject(
    existingUpdatedAt: number | undefined,
    existingRumorId: string | undefined,
    incomingUpdatedAt: number,
    incomingRumorId: string
): boolean {
    if (existingUpdatedAt === undefined) {
        return true;
    }

    if (incomingUpdatedAt > existingUpdatedAt) {
        return true;
    }

    if (incomingUpdatedAt < existingUpdatedAt) {
        return false;
    }

    // Same timestamp; use deterministic tie-breaker.
    if (!existingRumorId) {
        return true;
    }

    return incomingRumorId > existingRumorId;
}

export class ConversationRepository {
    /**
     * Emit an event when a conversation is updated
     */
    private emitConversationUpdated(id: string, subject?: string): void {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('nospeak:conversation-updated', {
                detail: { conversationId: id, subject }
            }));
        }
    }

    /**
     * Get a conversation by ID
     */
    public async getConversation(id: string): Promise<Conversation | undefined> {
        return await db.conversations.get(id);
    }

    /**
     * Get all conversations, ordered by last activity
     */
    public async getConversations(): Promise<Conversation[]> {
        return await db.conversations.orderBy('lastActivityAt').reverse().toArray();
    }

    /**
     * Get only group conversations
     */
    public async getGroupConversations(): Promise<Conversation[]> {
        return await db.conversations
            .filter(conv => conv.isGroup)
            .toArray();
    }

    /**
     * Create or update a conversation
     */
    public async upsertConversation(conversation: Conversation): Promise<void> {
        const existing = await this.getConversation(conversation.id);
        await db.conversations.put(conversation);
        // Emit update if subject changed
        if (conversation.subject !== existing?.subject) {
            this.emitConversationUpdated(conversation.id, conversation.subject);
        }
    }

    /**
     * Update the subject/title of a group conversation
     */
    public async updateSubject(id: string, subject: string): Promise<void> {
        await db.conversations.update(id, { subject });
        this.emitConversationUpdated(id, subject);
    }

    /**
     * Update subject/title using an incoming rumor timestamp and rumor id.
     * Ensures the newest subject wins even if messages arrive out of order.
     */
    public async updateSubjectFromRumor(
        id: string,
        subject: string,
        rumorCreatedAtMs: number,
        rumorId: string
    ): Promise<void> {
        const existing = await this.getConversation(id);
        const shouldReplace = shouldReplaceConversationSubject(
            existing?.subjectUpdatedAt,
            existing?.subjectUpdatedRumorId,
            rumorCreatedAtMs,
            rumorId
        );

        if (!shouldReplace) {
            return;
        }

        await db.conversations.update(id, {
            subject,
            subjectUpdatedAt: rumorCreatedAtMs,
            subjectUpdatedRumorId: rumorId
        });
        this.emitConversationUpdated(id, subject);
    }

    /**
     * Update last activity timestamp
     */
    public async markActivity(id: string, timestamp?: number): Promise<void> {
        await db.conversations.update(id, {
            lastActivityAt: timestamp ?? Date.now()
        });
    }

    /**
     * Mark conversation as read
     */
    public async markAsRead(id: string): Promise<void> {
        await db.conversations.update(id, {
            lastReadAt: Date.now()
        });
        this.emitConversationUpdated(id);
    }

    /**
     * Delete a conversation
     */
    public async deleteConversation(id: string): Promise<void> {
        await db.conversations.delete(id);
    }

    /**
     * Check if a conversation exists
     */
    public async hasConversation(id: string): Promise<boolean> {
        const count = await db.conversations.where('id').equals(id).count();
        return count > 0;
    }

    /**
     * Get the most recent conversations, limited to a specific count.
     * Useful for Android sharing shortcuts.
     * 
     * @param limit Maximum number of conversations to return (default 4)
     * @returns Array of conversations ordered by most recent activity
     */
    public async getRecentConversations(limit: number = 4): Promise<Conversation[]> {
        return await db.conversations
            .orderBy('lastActivityAt')
            .reverse()
            .limit(limit)
            .toArray();
    }
}

export const conversationRepo = new ConversationRepository();
