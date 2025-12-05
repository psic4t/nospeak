import { db, type Message } from './db';
import Dexie from 'dexie';

export class MessageRepository {
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

        const items = await collection.limit(limit).toArray();
        return items.reverse(); // Return in chronological order
    }

    public async getConversationPage(recipientNpub: string, pageSize: number = 50, beforeTimestamp?: number): Promise<Message[]> {
        return this.getMessages(recipientNpub, pageSize, beforeTimestamp);
    }

    public async getMessageByEventId(eventId: string): Promise<Message | undefined> {
        const message = await db.messages.where('eventId').equals(eventId).first();
        return message || undefined;
    }

    private emitMessageSaved(msg: Message) {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('nospeak:new-message', {
                detail: {
                    recipientNpub: msg.recipientNpub,
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

        const filtered = items.filter((m) => m.recipientNpub === recipientNpub);

        if (filtered.length !== items.length) {
            console.warn('getAllMessagesFor: filtered out mismatched recipient messages', {
                requested: recipientNpub,
                total: items.length,
                kept: filtered.length,
            });
        }

        return filtered.sort((a, b) => a.sentAt - b.sentAt);
    }
}

export const messageRepo = new MessageRepository();
