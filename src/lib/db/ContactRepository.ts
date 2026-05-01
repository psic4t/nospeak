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

        // Also invalidate any cached messaging-relay list for this contact.
        // Without this, a stale list in db.profiles[npub].messagingRelays
        // (e.g. one written by an older buggy resolver run) would survive
        // contact deletion and continue to misroute DMs the next time the
        // contact is re-added. We keep the rest of the profile row so
        // metadata (name/picture) doesn't vanish if the user re-adds them.
        try {
            const existing = await db.profiles.get(npub);
            if (existing) {
                await db.profiles.update(npub, { messagingRelays: [] });
            }
        } catch (err) {
            console.warn('[ContactRepository] Failed to clear cached messagingRelays for', npub, err);
        }
    }

    public async getContacts(): Promise<ContactItem[]> {
        return await db.contacts.toArray();
    }
}

export const contactRepo = new ContactRepository();
