import { db, type Message } from './db';
import Dexie from 'dexie';

export class MessageRepository {
    public async getMessages(recipientNpub: string, limit: number = 50, beforeTimestamp?: number): Promise<Message[]> {
        let collection;
        
        if (recipientNpub === 'ALL') {
             collection = db.messages.orderBy('sentAt').reverse();
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

    public async saveMessage(msg: Message) {
        try {
            await db.messages.put(msg);
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
        } catch (e: any) {
            if (e.name === 'ConstraintError') {
                // Ignore duplicates - bulkPut will fail if any duplicates exist
                // Fall back to individual saves for mixed duplicate/new scenarios
                for (const msg of messages) {
                    try {
                        await db.messages.put(msg);
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
}

export const messageRepo = new MessageRepository();
