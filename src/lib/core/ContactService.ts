import { profileResolver } from '$lib/core/ProfileResolver';
import { contactRepo } from '$lib/db/ContactRepository';
import { contactSyncService } from '$lib/core/ContactSyncService';

export async function addContactByNpub(npub: string): Promise<void> {
    const trimmed = npub.trim();

    if (!trimmed.startsWith('npub')) {
        throw new Error('Invalid npub');
    }

    // Add contact to local DB immediately (fast)
    const now = Date.now();
    await contactRepo.addContact(trimmed, now, now);
    
    // Fire-and-forget: resolve profile and sync in background
    profileResolver.resolveProfile(trimmed, true).catch((e) => {
        console.warn('[ContactService] Background profile resolution failed:', e);
    });
    
    contactSyncService.publishContacts().catch((e) => {
        console.warn('[ContactService] Background contact sync failed:', e);
    });
}
