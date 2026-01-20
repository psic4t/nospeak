<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import { contactRepo } from '$lib/db/ContactRepository';
    import { liveQuery } from 'dexie';
    import type { ContactItem } from '$lib/db/db';
    import { addContactByNpub } from '$lib/core/ContactService';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import Avatar from '$lib/components/Avatar.svelte';
    import { searchProfiles, type UserSearchResult } from '$lib/core/SearchProfiles';
    import { verifyNip05ForNpub, resolveNip05ToNpub, type Nip05Status } from '$lib/core/Nip05Verifier';
    import { getDisplayedNip05 } from '$lib/core/Nip05Display';
    import { hapticSelection } from '$lib/utils/haptics';
    import { profileResolver } from '$lib/core/ProfileResolver';
    import { isAndroidNative } from "$lib/core/NativeDialogs";
    import { t } from '$lib/i18n';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import { nip19 } from 'nostr-tools';
    import { contactSyncService } from '$lib/core/ContactSyncService';
    import { showScanContactQrModal, showManageContactsModal } from '$lib/stores/modals';
    import { overscroll, type OverscrollState } from '$lib/utils/overscroll';
    import { connectionManager } from '$lib/core/connection/instance';
    import { getDiscoveryRelays } from '$lib/core/runtimeConfig';

    const isAndroidApp = isAndroidNative();
    
    // Pull-to-refresh state
    let pullState = $state<OverscrollState>('idle');
    
    async function handleRefresh(): Promise<void> {
        await contactSyncService.fetchAndMergeContacts();
    }
    
    function handlePullStateChange(state: OverscrollState): void {
        pullState = state;
    }

    // Redirect desktop to /chat and open modal
    onMount(() => {
        if (!isAndroidApp) {
            showManageContactsModal.set(true);
            goto('/chat');
        }
    });

    let newNpub = $state('');
    let contacts = $state<ContactItem[]>([]);
    let isAdding = $state(false);
    let displayContacts = $state<{
        npub: string;
        name: string;
        picture?: string;
        shortNpub: string;
    }[]>([]);

    type SearchResultWithStatus = UserSearchResult & { nip05Status?: Nip05Status; alreadyAdded?: boolean };
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
    let discoveryRelaysConnected = false;
    let addedDiscoveryRelays: string[] = [];

    function cleanupDiscoveryRelays() {
        for (const url of addedDiscoveryRelays) {
            connectionManager.removeRelay(url);
        }
        addedDiscoveryRelays = [];
        discoveryRelaysConnected = false;
    }

    // Cleanup discovery relays when navigating away
    onDestroy(() => {
        cleanupDiscoveryRelays();
    });

    const isNpubMode = $derived(newNpub.trim().startsWith('npub') || isValidNip05Format(newNpub.trim()));

    function isValidNip05Format(query: string): boolean {
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

    function shortenNpub(npub: string): string {
        if (npub.length <= 20) {
            return npub;
        }
        return `${npub.slice(0, 12)}...${npub.slice(-6)}`;
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

        displayContacts = data;
    }

    $effect(() => {
        if (!isAndroidApp) return;
        
        const sub = liveQuery(() => contactRepo.getContacts()).subscribe(async (c) => {
            contacts = c;
            await refreshDisplayContacts(c);
        });
        return () => sub.unsubscribe();
    });

    // Connect discovery relays on first keystroke
    $effect(() => {
        if (!isAndroidApp) return;
        
        const query = newNpub.trim();
        if (query.length > 0 && !discoveryRelaysConnected) {
            discoveryRelaysConnected = true;
            addedDiscoveryRelays = connectionManager.connectDiscoveryRelays(getDiscoveryRelays());
        }
    });

    $effect(() => {
        if (!isAndroidApp) return;
        
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
    });

    $effect(() => {
        if (!isAndroidApp) return;
        
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

                const name = profile?.metadata?.name ||
                            profile?.metadata?.display_name ||
                            profile?.metadata?.displayName ||
                            shortenNpub(npub);

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
    });

    async function add() {
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

    function selectSearchResult(result: UserSearchResult) {
        newNpub = result.npub;
        searchResults = [];
        searchError = null;
        isSearching = false;
    }

    async function remove(npub: string) {
        await contactRepo.removeContact(npub);
        contactSyncService.publishContacts().catch((e) => {
            console.warn('[contacts] Background contact sync failed:', e);
        });
    }

    function openChat(npub: string) {
        hapticSelection();
        goto(`/chat/${npub}`);
    }

    function goBack() {
        hapticSelection();
        goto('/chat');
    }

    function openScanQr() {
        hapticSelection();
        showScanContactQrModal.set(true);
    }
</script>

{#if isAndroidApp}
<div
    class="relative flex flex-col h-full bg-white/50 dark:bg-slate-900/50 overflow-hidden"
>
    <!-- Header -->
    <div
        class="absolute top-0 left-0 right-0 z-20 flex flex-col pt-safe bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-700/70 shadow-sm"
    >
        <div class="p-4 flex items-center gap-2">
            <button 
                onclick={goBack}
                aria-label="Go back"
                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150 ease-out"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>
            <h1 class="typ-title dark:text-white">{$t('modals.manageContacts.title')}</h1>
            <Button 
                onclick={openScanQr}
                variant="filled-tonal" 
                size="sm"
                class="ml-auto"
                aria-label={$t('modals.manageContacts.scanQrAria')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                    <path d="M23 19a2 2 0 0 1-2 2h-2v-2h2v-2h2v4z"/>
                    <path d="M23 9V5a2 2 0 0 0-2-2h-4v2h4v4h2z"/>
                    <path d="M3 9V5a2 2 0 0 1 2-2h4v2H5v4H3z"/>
                    <path d="M3 15v4a2 2 0 0 0 2 2h4v-2H5v-4H3z"/>
                    <path d="M9 9h6v6H9z"/>
                </svg>
                {$t('modals.manageContacts.scanQr')}
            </Button>
        </div>

        <!-- Search section -->
        <div class="px-4 pb-4">
            <div class="flex gap-2 relative">
                <Input 
                    id="contact-search-input"
                    bind:value={newNpub}
                    placeholder={$t('modals.manageContacts.searchPlaceholder')} 
                    class="flex-1"
                />
                <Button 
                    onclick={add}
                    disabled={isAdding}
                    variant="primary"
                    size="icon"
                    class="flex-shrink-0"
                    aria-label={isNpubMode ? $t('modals.manageContacts.addContactAria') : $t('modals.manageContacts.searchContactsAria')}
                >
                    {#if isNpubMode}
                        {#if isAdding}
                            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        {/if}
                    {:else}
                        {#if isSearching}
                            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        {/if}
                    {/if}
                </Button>

                <!-- NIP-05 lookup results -->
                {#if isValidNip05Format(newNpub.trim()) && (isResolvingNip05 || nip05LookupError || nip05Result)}
                    <div class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl z-10">
                        {#if isResolvingNip05}
                            <div class="px-4 py-3 typ-body text-gray-500 dark:text-slate-400 flex items-center gap-2">
                                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>{$t('modals.manageContacts.resolvingNip05')}</span>
                            </div>
                        {:else if nip05LookupError}
                            <div class="px-4 py-3 typ-body text-red-500">
                                {#if nip05LookupError === 'invalid-format'}
                                    {$t('modals.manageContacts.nip05InvalidFormat')}
                                {:else if nip05LookupError === 'not-found'}
                                    {$t('modals.manageContacts.nip05NotFound')}
                                {:else}
                                    {$t('modals.manageContacts.nip05LookupFailed')}
                                {/if}
                            </div>
                        {:else if nip05Result}
                            <button
                                type="button"
                                disabled={nip05Result.alreadyAdded}
                                onclick={() => { hapticSelection(); newNpub = nip05Result!.npub; nip05Result = null; }}
                                class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors {nip05Result.alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)]'}"
                            >
                                <Avatar
                                    npub={nip05Result.npub}
                                    src={nip05Result.picture}
                                    size="sm"
                                    class="!w-8 !h-8 flex-shrink-0"
                                />
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-1 min-w-0">
                                        <span class="font-medium dark:text-gray-100 truncate">
                                            {nip05Result.name}
                                        </span>
                                        {#if nip05Result.alreadyAdded}
                                            <span class="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                                                {$t('modals.manageContacts.alreadyAdded')}
                                            </span>
                                        {/if}
                                        {#if nip05Result.nip05}
                                            <span class="inline-flex items-center gap-1 typ-meta text-gray-500 dark:text-slate-400 truncate">
                                                <svg
                                                    class="text-green-500 shrink-0"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round">
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                    <path d="m9 12 2 2 4-4"></path>
                                                </svg>
                                                <span>{getDisplayedNip05(nip05Result.nip05)}</span>
                                            </span>
                                        {/if}
                                    </div>
                                    <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">
                                        {shortenNpub(nip05Result.npub)}
                                    </span>
                                </div>
                            </button>
                        {/if}
                    </div>
                {/if}

                <!-- Search results -->
                {#if !isNpubMode && newNpub.trim().length >= 3 && (isSearching || searchResults.length > 0 || searchError)}
                    <div class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto z-10 custom-scrollbar native-scroll">
                        {#if isSearching}
                            <div class="px-4 py-3 typ-body text-gray-500 dark:text-slate-400">
                                {$t('modals.manageContacts.searching')}
                            </div>
                        {:else if searchError}
                            <div class="px-4 py-3 typ-body text-red-500">
                                {searchError}
                            </div>
                        {:else if searchResults.length === 0}
                            <div class="px-4 py-3 typ-body text-gray-500 dark:text-slate-400">
                                {$t('modals.manageContacts.noResults')}
                            </div>
                        {:else}
                            {#each searchResults as result (result.npub)}
                                <button
                                    type="button"
                                    class="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] text-left transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0"
                                    onclick={() => selectSearchResult(result)}
                                >
                                    <Avatar
                                        npub={result.npub}
                                        src={result.picture}
                                        size="sm"
                                        class="!w-8 !h-8 flex-shrink-0"
                                    />
                                    <div class="flex flex-col min-w-0">
                                        <div class="flex items-center gap-1 min-w-0">
                                            <span class="font-medium dark:text-gray-100 truncate">
                                                {result.name}
                                            </span>
                                            {#if result.nip05}
                                                {#if result.nip05Status === 'valid'}
                                                    <span class="inline-flex items-center gap-1 typ-meta text-gray-500 dark:text-slate-400 truncate">
                                                        <svg
                                                            class="text-green-500 shrink-0"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            stroke-width="2"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round">
                                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                            <path d="m9 12 2 2 4-4"></path>
                                                        </svg>
                                                        <span>{getDisplayedNip05(result.nip05)}</span>
                                                    </span>
                                                {:else if result.nip05Status === 'invalid'}
                                                    <span class="inline-flex items-center gap-1 typ-meta text-gray-500 dark:text-slate-400 truncate" title="NIP-05 not verified for this key">
                                                        <svg
                                                            class="text-yellow-500 shrink-0"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            stroke-width="2"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <line x1="12" y1="8" x2="12" y2="12"></line>
                                                            <circle cx="12" cy="16" r="1"></circle>
                                                        </svg>
                                                        <span>{getDisplayedNip05(result.nip05)}</span>
                                                    </span>
                                                {:else}
                                                    <span class="typ-meta text-gray-500 dark:text-slate-400 truncate">
                                                        {getDisplayedNip05(result.nip05)}
                                                    </span>
                                                {/if}
                                            {/if}
                                        </div>
                                        <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">
                                            {shortenNpub(result.npub)}
                                        </span>
                                    </div>
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- Contact list -->
    <div 
        class="flex-1 overflow-y-auto custom-scrollbar native-scroll pt-[180px] pb-safe px-2" 
        use:overscroll={{ onRefresh: handleRefresh, onStateChange: handlePullStateChange }}
    >
        <!-- Pull-to-refresh indicator -->
        {#if pullState !== 'idle'}
            <div class="flex items-center justify-center py-3 -mt-2 mb-2">
                {#if pullState === 'refreshing'}
                    <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span class="typ-body">{$t('modals.manageContacts.syncing')}</span>
                    </div>
                {:else if pullState === 'ready'}
                    <div class="flex items-center gap-2 text-[rgb(var(--color-lavender-rgb))]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span class="typ-body font-medium">{$t('modals.manageContacts.releaseToRefresh')}</span>
                    </div>
                {:else}
                    <div class="flex items-center gap-2 text-gray-400 dark:text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="7 13 12 18 17 13"></polyline>
                            <polyline points="7 6 12 11 17 6"></polyline>
                        </svg>
                        <span class="typ-body">{$t('modals.manageContacts.pullToRefresh')}</span>
                    </div>
                {/if}
            </div>
        {/if}
        
        {#if contacts.length === 0}
            <div class="typ-body text-gray-500 text-center py-8 mx-2 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                {$t('modals.manageContacts.noContacts')}
            </div>
        {/if}
        {#each displayContacts as contact}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
                class="flex justify-between items-center p-3 my-1.5 rounded-full bg-transparent text-gray-700 dark:text-gray-400 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] hover:text-gray-900 dark:hover:text-white transition-all duration-200 ease-out group cursor-pointer active:scale-[0.98]"
                onclick={() => openChat(contact.npub)}
            >
                <div class="flex items-center gap-3 min-w-0">
                    <Avatar 
                        npub={contact.npub}
                        src={contact.picture}
                        size="md"
                        class="!w-12 !h-12 flex-shrink-0"
                    />
                    <div class="flex flex-col min-w-0">
                        <span class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]">{contact.name}</span>
                        <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">{contact.shortNpub}</span>
                    </div>
                </div>
                <Button 
                    onclick={(e: MouseEvent) => { e.stopPropagation(); remove(contact.npub); }}
                    variant="danger"
                    size="icon"
                    class="!w-9 !h-9"
                    aria-label={$t('modals.manageContacts.removeContactAria')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </Button>
            </div>
        {/each}
    </div>
</div>
{/if}
