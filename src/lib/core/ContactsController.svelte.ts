import { liveQuery } from 'dexie';
import { nip19 } from 'nostr-tools';
import { get } from 'svelte/store';

import type { ContactItem } from '$lib/db/db';
import { contactRepo } from '$lib/db/ContactRepository';
import { profileRepo } from '$lib/db/ProfileRepository';
import { messageRepo } from '$lib/db/MessageRepository';
import { addContactByNpub } from '$lib/core/ContactService';
import { searchProfiles, type UserSearchResult } from '$lib/core/SearchProfiles';
import { verifyNip05ForNpub, resolveNip05ToNpub, type Nip05Status } from '$lib/core/Nip05Verifier';
import { getDisplayedNip05 } from '$lib/core/Nip05Display';
import { profileResolver } from '$lib/core/ProfileResolver';
import { contactSyncService } from '$lib/core/ContactSyncService';
import { connectionManager } from '$lib/core/connection/instance';
import { getDiscoveryRelays } from '$lib/core/runtimeConfig';
import { archiveRepo } from '$lib/db/ArchiveRepository';
import { archivedConversationIds } from '$lib/stores/archive';
import { archiveSyncService } from '$lib/core/ArchiveSyncService';
import { showToast } from '$lib/stores/toast';
import { resolveDisplayName } from '$lib/core/nameUtils';
import { t } from '$lib/i18n';

export { getDisplayedNip05 };

export interface DisplayContact {
    npub: string;
    name: string;
    username?: string;
    picture?: string;
    shortNpub: string;
}

export type SearchResultWithStatus = UserSearchResult & {
    nip05Status?: Nip05Status;
    alreadyAdded?: boolean;
};

export function shortenNpub(npub: string): string {
    if (npub.length <= 20) return npub;
    return `${npub.slice(0, 12)}...${npub.slice(-6)}`;
}

export function isValidNip05Format(query: string): boolean {
    const trimmed = query.trim();
    const atIndex = trimmed.indexOf('@');

    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
        return false;
    }

    const domain = trimmed.slice(atIndex + 1);
    const lastDotIndex = domain.lastIndexOf('.');

    if (lastDotIndex === -1) {
        return false;
    }

    const tld = domain.slice(lastDotIndex + 1);
    if (tld.length < 2) {
        return false;
    }

    return true;
}

function sortSearchResults(list: SearchResultWithStatus[]): SearchResultWithStatus[] {
    const rank: Record<Nip05Status, number> = {
        valid: 0,
        unknown: 1,
        invalid: 2
    };

    return [...list].sort((a, b) => {
        const sa: Nip05Status = a.nip05Status ?? 'unknown';
        const sb: Nip05Status = b.nip05Status ?? 'unknown';
        const ra = rank[sa];
        const rb = rank[sb];

        if (ra !== rb) {
            return ra - rb;
        }

        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA !== nameB) {
            return nameA.localeCompare(nameB);
        }

        const nipA = (a.nip05 || '').toLowerCase();
        const nipB = (b.nip05 || '').toLowerCase();
        if (nipA !== nipB) {
            return nipA.localeCompare(nipB);
        }

        return a.npub.localeCompare(b.npub);
    });
}

export function createContactsController() {
    let newNpub = $state('');
    let contacts = $state<ContactItem[]>([]);
    let isAdding = $state(false);
    let displayContacts = $state<DisplayContact[]>([]);

    let searchResults = $state<SearchResultWithStatus[]>([]);
    let isSearching = $state(false);
    let searchError = $state<string | null>(null);
    let searchToken = 0;
    let nip05VerifyToken = 0;
    let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
    let isResolvingNip05 = $state(false);
    let nip05LookupError = $state<string | null>(null);
    let nip05Result = $state<SearchResultWithStatus | null>(null);
    let nip05LookupToken = 0;
    let showSearchField = $state(false);
    let contactSearchQuery = $state('');
    let discoveryRelaysConnected = false;
    let addedDiscoveryRelays: string[] = [];

    const isNpubMode = $derived(newNpub.trim().startsWith('npub') || isValidNip05Format(newNpub.trim()));

    const filteredContacts = $derived(() => {
        if (!contactSearchQuery.trim()) return displayContacts;
        const query = contactSearchQuery.toLowerCase();
        return displayContacts.filter((c) =>
            c.name.toLowerCase().includes(query)
            || c.username?.toLowerCase().includes(query)
            || c.npub.toLowerCase().includes(query)
        );
    });

    function cleanupDiscoveryRelays(): void {
        for (const url of addedDiscoveryRelays) {
            connectionManager.removeRelay(url);
        }
        addedDiscoveryRelays = [];
        discoveryRelaysConnected = false;
    }

    function resetState(): void {
        if (searchDebounceId) {
            clearTimeout(searchDebounceId);
            searchDebounceId = null;
        }

        newNpub = '';
        contactSearchQuery = '';
        showSearchField = false;
        isAdding = false;
        isSearching = false;
        searchResults = [];
        searchError = null;
        searchToken = 0;
        nip05VerifyToken = 0;
        nip05LookupToken = 0;
        isResolvingNip05 = false;
        nip05LookupError = null;
        nip05Result = null;
        cleanupDiscoveryRelays();
    }

    async function refreshDisplayContacts(items: ContactItem[]): Promise<void> {
        const data = await Promise.all(items.map(async (c) => {
            const profile = await profileRepo.getProfileIgnoreTTL(c.npub);
            const shortNpub = shortenNpub(c.npub);

            let name = shortNpub;
            let username: string | undefined = undefined;
            let picture: string | undefined = undefined;

            if (profile && profile.metadata) {
                name = resolveDisplayName(profile.metadata, c.npub);
                picture = profile.metadata.picture;
                const rawName = profile.metadata.name?.trim();
                const rawDisplay = profile.metadata.display_name?.trim();
                if (rawDisplay && rawName && rawDisplay !== rawName) {
                    username = rawName;
                }
            }

            return {
                npub: c.npub,
                name,
                username,
                picture,
                shortNpub
            };
        }));

        displayContacts = data.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
    }

    async function startNip05Verification(initialResults: SearchResultWithStatus[]): Promise<void> {
        const currentToken = ++nip05VerifyToken;
        const candidates = initialResults.filter(r => r.nip05).slice(0, 5);

        for (const candidate of candidates) {
            try {
                const result = await verifyNip05ForNpub(candidate.nip05 as string, candidate.npub);

                if (currentToken !== nip05VerifyToken) {
                    return;
                }

                searchResults = sortSearchResults(
                    searchResults.map(r =>
                        r.npub === candidate.npub
                            ? { ...r, nip05Status: result.status }
                            : r
                    )
                );
            } catch (e) {
                console.error('NIP-05 verification failed for search result', e);
            }
        }
    }

    /**
     * Connect discovery relays if not already connected.
     * Call when the user starts typing in the search field.
     */
    function ensureDiscoveryRelays(): void {
        if (!discoveryRelaysConnected) {
            discoveryRelaysConnected = true;
            addedDiscoveryRelays = connectionManager.connectDiscoveryRelays(getDiscoveryRelays());
        }
    }

    /**
     * Run the profile search debounce logic.
     * Should be called from an $effect that depends on newNpub.
     */
    function handleSearchEffect(): void {
        const query = newNpub.trim();

        if (searchDebounceId) {
            clearTimeout(searchDebounceId);
            searchDebounceId = null;
        }

        if (!query || isNpubMode) {
            isSearching = false;
            searchResults = [];
            searchError = null;
            isResolvingNip05 = false;
            nip05LookupError = null;
            nip05Result = null;
            return;
        }

        if (query.length < 3) {
            isSearching = false;
            searchResults = [];
            searchError = null;
            isResolvingNip05 = false;
            nip05LookupError = null;
            nip05Result = null;
            return;
        }

        searchDebounceId = setTimeout(async () => {
            const currentToken = ++searchToken;
            isSearching = true;
            searchError = null;

            try {
                const results = await searchProfiles(query, 20);

                if (currentToken !== searchToken) {
                    return;
                }

                const extended: SearchResultWithStatus[] = results.map((r) => ({ ...r }));
                searchResults = sortSearchResults(extended);
                startNip05Verification(extended);
            } catch (e) {
                if (currentToken !== searchToken) {
                    return;
                }
                console.error('Contact search failed:', e);
                searchError = 'Search failed';
                searchResults = [];
            } finally {
                if (currentToken === searchToken) {
                    isSearching = false;
                }
            }
        }, 300);
    }

    /**
     * Run the NIP-05 lookup logic.
     * Should be called from an $effect that depends on newNpub.
     */
    function handleNip05LookupEffect(): void {
        const query = newNpub.trim();

        if (!isValidNip05Format(query)) {
            isResolvingNip05 = false;
            nip05LookupError = null;
            nip05Result = null;
            return;
        }

        (async () => {
            const currentToken = ++nip05LookupToken;

            isResolvingNip05 = true;
            nip05LookupError = null;
            nip05Result = null;

            try {
                const hexPubkey = await resolveNip05ToNpub(query);
                const npub = nip19.npubEncode(hexPubkey);

                const existingContact = contacts.find(c => c.npub === npub);

                await profileResolver.resolveProfile(npub, true);
                const profile = await profileRepo.getProfileIgnoreTTL(npub);

                const name = resolveDisplayName(profile?.metadata, npub);

                const result: SearchResultWithStatus = {
                    npub,
                    name,
                    picture: profile?.metadata?.picture,
                    nip05: query,
                    alreadyAdded: !!existingContact
                };

                if (currentToken === nip05LookupToken) {
                    nip05Result = result;
                }
            } catch (e: any) {
                if (currentToken === nip05LookupToken) {
                    nip05LookupError = e.message || 'lookup-error';
                }
            } finally {
                if (currentToken === nip05LookupToken) {
                    isResolvingNip05 = false;
                }
            }
        })();
    }

    async function add(): Promise<void> {
        const candidate = newNpub.trim();

        if (candidate.startsWith('npub')) {
            isAdding = true;
            try {
                await addContactByNpub(candidate);
                newNpub = '';
                searchResults = [];
                searchError = null;
            } catch (e) {
                console.error('Failed to add contact:', e);
            } finally {
                isAdding = false;
            }
        }
    }

    function selectSearchResult(result: UserSearchResult): void {
        newNpub = result.npub;
        searchResults = [];
        searchError = null;
        isSearching = false;
    }

    function selectNip05Result(): void {
        if (nip05Result) {
            newNpub = nip05Result.npub;
            nip05Result = null;
        }
    }

    async function remove(npub: string): Promise<void> {
        // Auto-archive the 1-on-1 chat if messages exist
        try {
            const messages = await messageRepo.getMessages(npub, 1);
            if (messages.length > 0) {
                const alreadyArchived = await archiveRepo.isArchived(npub);
                if (!alreadyArchived) {
                    await archiveRepo.addArchive(npub);
                    archivedConversationIds.update(set => {
                        const next = new Set(set);
                        next.add(npub);
                        return next;
                    });
                    archiveSyncService.publishArchives().catch((e) => {
                        console.warn('[ContactsController] Background archive sync failed:', e);
                    });
                    const message = get(t)('chats.chatArchived') as string;
                    showToast(message, 'info');
                }
            }
        } catch (e) {
            console.warn('[ContactsController] Failed to auto-archive chat:', e);
        }

        await contactRepo.removeContact(npub);
        contactSyncService.publishContacts().catch((e) => {
            console.warn('[ContactsController] Background contact sync failed:', e);
        });
    }

    function toggleSearchField(): void {
        showSearchField = !showSearchField;
        if (!showSearchField) {
            newNpub = '';
            searchResults = [];
            searchError = null;
        }
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

    return {
        get newNpub() { return newNpub; },
        set newNpub(v: string) { newNpub = v; },
        get contacts() { return contacts; },
        get isAdding() { return isAdding; },
        get displayContacts() { return displayContacts; },
        get searchResults() { return searchResults; },
        get isSearching() { return isSearching; },
        get searchError() { return searchError; },
        get isResolvingNip05() { return isResolvingNip05; },
        get nip05LookupError() { return nip05LookupError; },
        get nip05Result() { return nip05Result; },
        get showSearchField() { return showSearchField; },
        get contactSearchQuery() { return contactSearchQuery; },
        set contactSearchQuery(v: string) { contactSearchQuery = v; },
        get isNpubMode() { return isNpubMode; },
        get filteredContacts() { return filteredContacts; },

        resetState,
        cleanupDiscoveryRelays,
        ensureDiscoveryRelays,
        handleSearchEffect,
        handleNip05LookupEffect,
        add,
        selectSearchResult,
        selectNip05Result,
        remove,
        toggleSearchField,
        startSubscription
    };
}
