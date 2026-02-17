import { db, type ContactItem } from './db';

export class ContactRepository {
    public async addContact(npub: string, lastReadAt?: number, lastActivityAt?: number) {
        await db.contacts.put({
            npub,
            createdAt: Date.now(),
            lastReadAt,
            lastActivityAt
        });
    }

    public async markAsRead(npub: string) {
        await db.contacts.update(npub, {
            lastReadAt: Date.now()
        });
    }

    public async markActivity(npub: string, timestamp?: number) {
        const ts = timestamp ?? Date.now();
        const existing = await db.contacts.get(npub);
        if (existing && (existing.lastActivityAt || 0) >= ts) return;
        await db.contacts.update(npub, {
            lastActivityAt: ts
        });
    }

    public async removeContact(npub: string) {
        await db.contacts.delete(npub);
    }

    public async getContacts(): Promise<ContactItem[]> {
        return await db.contacts.toArray();
    }
}

export const contactRepo = new ContactRepository();
