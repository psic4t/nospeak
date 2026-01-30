import { liveQuery } from 'dexie';
import { get } from 'svelte/store';
import { nip19 } from 'nostr-tools';

import type { ContactItem, Conversation } from '$lib/db/db';
import { contactRepo } from '$lib/db/ContactRepository';
import { profileRepo } from '$lib/db/ProfileRepository';
import { conversationRepo, deriveConversationId, generateGroupTitle } from '$lib/db/ConversationRepository';
import { signer } from '$lib/stores/auth';
import { hapticSelection } from '$lib/utils/haptics';

export interface DisplayContact {
    npub: string;
    name: string;
    picture?: string;
    shortNpub: string;
}

export function shortenNpub(npub: string): string {
    if (npub.length <= 20) return npub;
    return `${npub.slice(0, 12)}...${npub.slice(-6)}`;
}

export function truncateName(name: string, maxLength: number = 8): string {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength - 1) + '\u2026';
}

export function createGroupCreationController() {
    let contacts = $state<ContactItem[]>([]);
    let displayContacts = $state<DisplayContact[]>([]);
    let selectedNpubs = $state<Set<string>>(new Set());
    let searchQuery = $state('');
    let isCreating = $state(false);

    const filteredContacts = $derived(() => {
        if (!searchQuery.trim()) {
            return displayContacts;
        }
        const query = searchQuery.toLowerCase();
        return displayContacts.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.npub.toLowerCase().includes(query)
        );
    });

    const selectedCount = $derived(selectedNpubs.size);
    const canCreate = $derived(selectedCount >= 2);
    const selectedContacts = $derived(
        displayContacts.filter(c => selectedNpubs.has(c.npub))
    );

    async function refreshDisplayContacts(items: ContactItem[]): Promise<void> {
        const data = await Promise.all(items.map(async (c) => {
            const profile = await profileRepo.getProfileIgnoreTTL(c.npub);
            const shortNpub = shortenNpub(c.npub);

            let name = shortNpub;
            let picture: string | undefined = undefined;

            if (profile && profile.metadata) {
                name = profile.metadata.name || profile.metadata.display_name || profile.metadata.displayName || shortNpub;
                picture = profile.metadata.picture;
            }

            return {
                npub: c.npub,
                name,
                picture,
                shortNpub
            };
        }));

        displayContacts = data.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
    }

    function toggleContact(npub: string): void {
        hapticSelection();
        const next = new Set(selectedNpubs);
        if (next.has(npub)) {
            next.delete(npub);
        } else {
            next.add(npub);
        }
        selectedNpubs = next;
    }

    function removeContact(npub: string): void {
        hapticSelection();
        const next = new Set(selectedNpubs);
        next.delete(npub);
        selectedNpubs = next;
    }

    function isSelected(npub: string): boolean {
        return selectedNpubs.has(npub);
    }

    function reset(): void {
        selectedNpubs = new Set();
        searchQuery = '';
        isCreating = false;
    }

    /**
     * Subscribe to the contacts live query.
     * Returns an unsubscribe function suitable for use in $effect cleanup.
     */
    function startSubscription(): () => void {
        const sub = liveQuery(() => contactRepo.getContacts()).subscribe(async (c) => {
            contacts = c;
            await refreshDisplayContacts(c);
        });
        return () => sub.unsubscribe();
    }

    /**
     * Creates the group conversation and returns the conversationId on success,
     * or null on failure. Navigation is left to the caller.
     */
    async function createGroup(): Promise<string | null> {
        if (!canCreate || isCreating) return null;

        isCreating = true;
        hapticSelection();

        try {
            const s = get(signer);
            if (!s) throw new Error('Not authenticated');

            const myPubkey = await s.getPublicKey();

            const participantPubkeys = Array.from(selectedNpubs).map((npub) => {
                const { data } = nip19.decode(npub);
                return data as string;
            });

            const conversationId = deriveConversationId(participantPubkeys, myPubkey);

            const names = displayContacts
                .filter((c) => selectedNpubs.has(c.npub))
                .map((c) => c.name);
            const subject = generateGroupTitle(names);

            const myNpub = nip19.npubEncode(myPubkey);
            const allParticipantNpubs = [...Array.from(selectedNpubs), myNpub];

            const conversation: Conversation = {
                id: conversationId,
                isGroup: true,
                participants: allParticipantNpubs,
                subject,
                lastActivityAt: Date.now(),
                lastReadAt: Date.now(), // Mark as read so it doesn't show unread indicator on creation
                createdAt: Date.now()
            };

            await conversationRepo.upsertConversation(conversation);
            return conversationId;
        } catch (e) {
            console.error('Failed to create group chat:', e);
            isCreating = false;
            return null;
        }
    }

    return {
        get contacts() { return contacts; },
        get displayContacts() { return displayContacts; },
        get selectedNpubs() { return selectedNpubs; },
        get searchQuery() { return searchQuery; },
        set searchQuery(v: string) { searchQuery = v; },
        get isCreating() { return isCreating; },
        get filteredContacts() { return filteredContacts; },
        get selectedCount() { return selectedCount; },
        get canCreate() { return canCreate; },
        get selectedContacts() { return selectedContacts; },
        toggleContact,
        removeContact,
        isSelected,
        reset,
        startSubscription,
        createGroup
    };
}
