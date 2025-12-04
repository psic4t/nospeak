<script lang="ts">
    import { contactRepo } from '$lib/db/ContactRepository';
    import { liveQuery } from 'dexie';
    import type { ContactItem } from '$lib/db/db';
    import { profileResolver } from '$lib/core/ProfileResolver';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import Avatar from './Avatar.svelte';
    import { searchProfiles, type UserSearchResult } from '$lib/core/SearchProfiles';
 
     let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();
     
     let newNpub = $state('');
     let contacts = $state<ContactItem[]>([]);
     let isAdding = $state(false);
     let displayContacts = $state<{
         npub: string;
         name: string;
         picture?: string;
         shortNpub: string;
     }[]>([]);
     let searchResults = $state<UserSearchResult[]>([]);
     let isSearching = $state(false);
     let searchError = $state<string | null>(null);
     let searchToken = 0;
     let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
 
     const isNpubMode = $derived(newNpub.trim().startsWith('npub'));

    function shortenNpub(npub: string): string {
        if (npub.length <= 20) {
            return npub;
        }
        return `${npub.slice(0, 12)}...${npub.slice(-6)}`;
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
         const sub = liveQuery(() => contactRepo.getContacts()).subscribe(async (c) => {
             contacts = c;
             await refreshDisplayContacts(c);
         });
         return () => sub.unsubscribe();
     });
 
     $effect(() => {
         const query = newNpub.trim();
 
         if (searchDebounceId) {
             clearTimeout(searchDebounceId);
             searchDebounceId = null;
         }
 
         if (!query || isNpubMode || query.length < 3) {
             isSearching = false;
             searchResults = [];
             searchError = null;
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
 
                 searchResults = results;
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
 
     async function add() {
         if (newNpub.startsWith('npub')) {
             isAdding = true;
             try {
                 await profileResolver.resolveProfile(newNpub, true);
                 await contactRepo.addContact(newNpub);
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
 
     function remove(npub: string) {
        contactRepo.removeContact(npub);
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 w-full h-full rounded-none md:w-96 md:h-auto md:maxh-[80vh] md:rounded-lg flex flex-col shadow-xl">
            <h2 class="text-xl font-bold mb-4 dark:text-white">Manage Contacts</h2>
            
            <div class="mb-4">
                <div class="flex gap-2 relative">
                    <input 
                        bind:value={newNpub}
                        placeholder="npub or search term" 
                        class="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <button 
                        onclick={add}
                        disabled={isAdding}
                        class="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {#if isNpubMode}
                            {isAdding ? 'Adding...' : 'Add'}
                        {:else}
                            {isSearching ? 'Searching...' : 'Search'}
                        {/if}
                    </button>

                    {#if !isNpubMode && newNpub.trim().length >= 3 && (isSearching || searchResults.length > 0 || searchError)}
                        <div class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-64 overflow-y-auto z-10">
                            {#if isSearching}
                                <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    Searching...
                                </div>
                            {:else if searchError}
                                <div class="px-3 py-2 text-sm text-red-500">
                                    {searchError}
                                </div>
                            {:else if searchResults.length === 0}
                                <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    No results
                                </div>
                            {:else}
                                {#each searchResults as result (result.npub)}
                                    <button
                                        type="button"
                                        class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                                        onclick={() => selectSearchResult(result)}
                                    >
                                        <Avatar
                                            npub={result.npub}
                                            src={result.picture}
                                            size="sm"
                                            class="!w-8 !h-8 flex-shrink-0"
                                        />
                                        <div class="flex flex-col min-w-0">
                                            <span class="font-medium dark:text-gray-100 truncate">
                                                {result.name}
                                            </span>
                                            <span class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {shortenNpub(result.npub)}
                                                {#if result.nip05}
                                                    {' · '}{result.nip05}
                                                {/if}
                                            </span>
                                        </div>
                                    </button>
                                {/each}
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2 mb-4 min-h-[200px]">
                {#if contacts.length === 0}
                    <div class="text-gray-500 text-center py-4">No contacts added</div>
                {/if}
                {#each displayContacts as contact}
                    <div class="flex justify-between items-center p-2 border rounded dark:border-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50">
                        <div class="flex items-center gap-3 min-w-0">
                            <Avatar 
                                npub={contact.npub}
                                src={contact.picture}
                                size="sm"
                                class="!w-10 !h-10 flex-shrink-0"
                            />
                            <div class="flex flex-col min-w-0">
                                <span class="font-medium dark:text-gray-200 truncate">{contact.name}</span>
                                <span class="text-xs text-gray-500 dark:text-gray-400 truncate">{contact.shortNpub}</span>
                            </div>
                        </div>
                        <button 
                            onclick={() => remove(contact.npub)}
                            class="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>

            <button 
                onclick={close}
                class="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
                Close
            </button>
        </div>
    </div>
{/if}
