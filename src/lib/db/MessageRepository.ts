import { db, type Message } from './db';
import Dexie from 'dexie';

export class MessageRepository {
    /**
     * Check if a message belongs to a group conversation.
     * A message is a group message if it has a conversationId that differs from recipientNpub.
     */
    private isGroupMessage(msg: Message): boolean {
        // Group messages have a conversationId that is a hash (not an npub)
        // For 1-on-1 messages, conversationId either doesn't exist or equals recipientNpub
        return !!msg.conversationId && msg.conversationId !== msg.recipientNpub;
    }

    public async getMessages(recipientNpub: string, limit: number = 50, beforeTimestamp?: number): Promise<Message[]> {
        let collection;
        
        if (recipientNpub === 'ALL') {
             if (beforeTimestamp) {
                 collection = db.messages
                    .where('sentAt')
                    .below(beforeTimestamp)
                    .reverse();
             } else {
                 collection = db.messages.orderBy('sentAt').reverse();
             }
        } else {
             collection = db.messages
                .where('[recipientNpub+sentAt]')
                .between(
                    [recipientNpub, Dexie.minKey],
                    [recipientNpub, beforeTimestamp || Dexie.maxKey],
                    true, // include lower
                    false // exclude upper
                )
                .reverse();
        }

        // Fetch more than needed to account for filtering out group messages
        const items = await collection.limit(limit * 2).toArray();
        
        // Filter out group messages (they have a conversationId that differs from recipientNpub)
        // This ensures group messages don't appear in 1-on-1 chat views
        const filtered = recipientNpub === 'ALL' 
            ? items 
            : items.filter(m => !this.isGroupMessage(m));
        
        return filtered.slice(0, limit).reverse(); // Return in chronological order
    }

    public async getConversationPage(recipientNpub: string, pageSize: number = 50, beforeTimestamp?: number): Promise<Message[]> {
        return this.getMessages(recipientNpub, pageSize, beforeTimestamp);
    }

    public async getMessageByEventId(eventId: string): Promise<Message | undefined> {
        const message = await db.messages.where('eventId').equals(eventId).first();
        return message || undefined;
    }

    public async getMessageByRumorId(rumorId: string): Promise<Message | undefined> {
        const message = await db.messages.where('rumorId').equals(rumorId).first();
        return message || undefined;
    }

    private emitMessageSaved(msg: Message) {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('nospeak:new-message', {
                detail: {
                    recipientNpub: msg.recipientNpub,
                    conversationId: msg.conversationId,
                    direction: msg.direction,
                    eventId: msg.eventId,
                }
            }));
        }
    }

    public async saveMessage(msg: Message) {
        try {
            await db.messages.put(msg);
            this.emitMessageSaved(msg);
        } catch (e: any) {
            if (e.name === 'ConstraintError') {
                // Ignore duplicate
                return;
            }
            throw e;
        }
    }

    public async saveMessages(messages: Message[]) {
        try {
            await db.messages.bulkPut(messages);
            for (const msg of messages) {
                this.emitMessageSaved(msg);
            }
        } catch (e: any) {
            if (e.name === 'ConstraintError') {
                // Ignore duplicates - bulkPut will fail if any duplicates exist
                // Fall back to individual saves for mixed duplicate/new scenarios
                for (const msg of messages) {
                    try {
                        await db.messages.put(msg);
                        this.emitMessageSaved(msg);
                    } catch (individualError: any) {
                        if (individualError.name !== 'ConstraintError') {
                            throw individualError;
                        }
                    }
                }
            } else {
                throw e;
            }
        }
    }
    
    public async hasMessage(eventId: string): Promise<boolean> {
        const count = await db.messages.where('eventId').equals(eventId).count();
        return count > 0;
    }

    public async hasMessages(eventIds: string[]): Promise<Set<string>> {
        const messages = await db.messages.where('eventId').anyOf(eventIds).toArray();
        return new Set(messages.map(msg => msg.eventId));
    }

    public async getLastMessageRecipient(): Promise<string | null> {
        const lastMessage = await db.messages.orderBy('sentAt').reverse().first();
        return lastMessage?.recipientNpub || null;
    }

    public async countMessages(recipientNpub: string): Promise<number> {
        if (recipientNpub === 'ALL') {
            return await db.messages.count();
        }
        return await db.messages.where('[recipientNpub+sentAt]').between(
            [recipientNpub, Dexie.minKey],
            [recipientNpub, Dexie.maxKey]
        ).count();
    }

    public async getAllMessagesFor(recipientNpub: string): Promise<Message[]> {
        if (recipientNpub === 'ALL') {
            const items = await db.messages.orderBy('sentAt').toArray();
            return items.sort((a, b) => a.sentAt - b.sentAt);
        }

        const items = await db.messages
            .where('[recipientNpub+sentAt]')
            .between(
                [recipientNpub, Dexie.minKey],
                [recipientNpub, Dexie.maxKey],
                true,
                true
            )
            .toArray();

        // Filter to only include messages for this 1-on-1 conversation:
        // 1. recipientNpub must match (sanity check for index range)
        // 2. Must NOT be a group message (conversationId differs from recipientNpub)
        const filtered = items.filter((m) => 
            m.recipientNpub === recipientNpub && !this.isGroupMessage(m)
        );

        return filtered.sort((a, b) => a.sentAt - b.sentAt);
    }

    /**
     * Get messages for a conversation by conversationId.
     * Works for both 1-on-1 (npub) and group (hash) conversations.
     */
    public async getMessagesByConversationId(conversationId: string, limit: number = 50, beforeTimestamp?: number): Promise<Message[]> {
        let collection;
        
        collection = db.messages
            .where('[conversationId+sentAt]')
            .between(
                [conversationId, Dexie.minKey],
                [conversationId, beforeTimestamp || Dexie.maxKey],
                true, // include lower
                false // exclude upper
            )
            .reverse();

        const items = await collection.limit(limit).toArray();
        return items.reverse(); // Return in chronological order
    }

    /**
     * Get all messages for a conversation by conversationId.
     */
    public async getAllMessagesByConversationId(conversationId: string): Promise<Message[]> {
        const items = await db.messages
            .where('[conversationId+sentAt]')
            .between(
                [conversationId, Dexie.minKey],
                [conversationId, Dexie.maxKey],
                true,
                true
            )
            .toArray();

        return items.sort((a, b) => a.sentAt - b.sentAt);
    }

    /**
     * Get the most recent message for a conversation.
     */
    public async getLastMessageForConversation(conversationId: string): Promise<Message | undefined> {
        const items = await db.messages
            .where('[conversationId+sentAt]')
            .between(
                [conversationId, Dexie.minKey],
                [conversationId, Dexie.maxKey],
                true,
                true
            )
            .reverse()
            .limit(1)
            .toArray();

        return items[0];
    }
}

export const messageRepo = new MessageRepository();
