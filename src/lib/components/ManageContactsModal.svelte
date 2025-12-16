<script lang="ts">
    import { contactRepo } from '$lib/db/ContactRepository';
    import { liveQuery } from 'dexie';
    import type { ContactItem } from '$lib/db/db';
     import { addContactByNpub } from '$lib/core/ContactService';

    import { profileRepo } from '$lib/db/ProfileRepository';
    import Avatar from './Avatar.svelte';
    import { searchProfiles, type UserSearchResult } from '$lib/core/SearchProfiles';
    import { verifyNip05ForNpub, type Nip05Status } from '$lib/core/Nip05Verifier';
     import { getDisplayedNip05 } from '$lib/core/Nip05Display';
     import { isAndroidNative } from "$lib/core/NativeDialogs";
     import { fade } from 'svelte/transition';
     import { glassModal } from '$lib/utils/transitions';
     import { t } from '$lib/i18n';
     import { get } from 'svelte/store';
 
     let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();
     const isAndroidApp = isAndroidNative();

     
     let newNpub = $state('');
     let contacts = $state<ContactItem[]>([]);
     let isAdding = $state(false);
     let displayContacts = $state<{
         npub: string;
         name: string;
         picture?: string;
         shortNpub: string;
     }[]>([]);
     type SearchResultWithStatus = UserSearchResult & { nip05Status?: Nip05Status };
     let searchResults = $state<SearchResultWithStatus[]>([]);
     let isSearching = $state(false);
     let searchError = $state<string | null>(null);
     let searchToken = 0;
     let nip05VerifyToken = 0;
     let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
 
      const BOTTOM_SHEET_CLOSE_THRESHOLD = 100;
      const BOTTOM_SHEET_ACTIVATION_THRESHOLD = 6;
      let bottomSheetDragY = $state(0);

     let isBottomSheetDragging = $state(false);
     let bottomSheetDragStartY = 0;

       function resetState() {

          if (searchDebounceId) {
              clearTimeout(searchDebounceId);
              searchDebounceId = null;
          }
 
          newNpub = '';
          isAdding = false;
          isSearching = false;
          searchResults = [];
          searchError = null;
          searchToken = 0;
          nip05VerifyToken = 0;
      }
 
 	     const isNpubMode = $derived(newNpub.trim().startsWith('npub'));


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
 	         const sub = liveQuery(() => contactRepo.getContacts()).subscribe(async (c) => {
 	             contacts = c;
 	             await refreshDisplayContacts(c);
 	         });
 	         return () => sub.unsubscribe();
 	     });
 	 
      $effect(() => {
          if (!isOpen) {
              resetState();
          }
      });
 
 	     $effect(() => {

          if (!isOpen) {
              return;
          }
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
 
      function remove(npub: string) {
         contactRepo.removeContact(npub);
     }

      function handleBottomSheetPointerDown(e: PointerEvent) {
         if (!isAndroidApp) return;
         e.preventDefault();
         isBottomSheetDragging = false;
         bottomSheetDragStartY = e.clientY;
         bottomSheetDragY = 0;
         (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
     }

      function handleBottomSheetPointerMove(e: PointerEvent) {
         if (!isAndroidApp) return;
         const delta = e.clientY - bottomSheetDragStartY;
         if (!isBottomSheetDragging) {
             if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                 isBottomSheetDragging = true;
             } else {
                 return;
             }
         }
         bottomSheetDragY = delta > 0 ? delta : 0;
     }

      function handleBottomSheetPointerEnd(e: PointerEvent) {
         if (!isAndroidApp) return;
         try {
             (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
         } catch {
             // ignore if pointer capture was not set
         }
         if (!isBottomSheetDragging) {
             bottomSheetDragY = 0;
             return;
         }
         const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
         isBottomSheetDragging = false;
         bottomSheetDragY = 0;
         if (shouldClose) {
             close();
         }
       }

       function handleBottomSheetTouchStart(e: TouchEvent) {
           if (!isAndroidApp) return;
           if (e.touches.length === 0) return;
           const touch = e.touches[0];
           isBottomSheetDragging = false;
           bottomSheetDragStartY = touch.clientY;
           bottomSheetDragY = 0;
       }

       function handleBottomSheetTouchMove(e: TouchEvent) {
           if (!isAndroidApp) return;
           if (e.touches.length === 0) return;
           const touch = e.touches[0];
           const delta = touch.clientY - bottomSheetDragStartY;
           if (!isBottomSheetDragging) {
               if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                   isBottomSheetDragging = true;
               } else {
                   return;
               }
           }
           bottomSheetDragY = delta > 0 ? delta : 0;
           e.preventDefault();
       }

       function handleBottomSheetTouchEnd(e: TouchEvent) {
           if (!isAndroidApp) return;
           if (!isBottomSheetDragging) {
               bottomSheetDragY = 0;
               return;
           }
           const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
           isBottomSheetDragging = false;
           bottomSheetDragY = 0;
           if (shouldClose) {
               close();
           }
       }
   </script>


 
 {#if isOpen}

    <div 
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class={`fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm flex justify-center z-50 ${
            isAndroidApp ? "items-end" : "items-center"
        }`}
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if(e.target === e.currentTarget) close(); }}
        onkeydown={(e) => { if(e.key === 'Escape') close(); }}
    >
        <div 
             in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }} 
             out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
             class={`bg-white dark:bg-slate-900/80 md:bg-white/95 backdrop-blur-xl p-6 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden outline-none relative transition-transform duration-150 ease-out ${
                 isAndroidApp
                     ? "w-full max-w-xl mx-2 rounded-t-3xl rounded-b-none max-h-[90vh]"
                     : "w-full h-full rounded-none md:w-[480px] md:h-auto md:max-h-[80vh] md:rounded-3xl"
             }`}
             style:transform={isAndroidApp ? `translateY(${bottomSheetDragY}px)` : undefined}
         >
             {#if isAndroidApp}
                 <div
                     class="absolute top-0 left-1/2 -translate-x-1/2 h-12 w-32"
                     onpointerdown={handleBottomSheetPointerDown}
                     onpointermove={handleBottomSheetPointerMove}
                     onpointerup={handleBottomSheetPointerEnd}
                     onpointercancel={handleBottomSheetPointerEnd}
                     ontouchstart={handleBottomSheetTouchStart}
                     ontouchmove={handleBottomSheetTouchMove}
                     ontouchend={handleBottomSheetTouchEnd}
                     ontouchcancel={handleBottomSheetTouchEnd}
                 >
                     <div
                         class="mx-auto mt-2 w-10 h-1.5 rounded-full bg-white/40 dark:bg-slate-700/80 touch-none"
                     ></div>
                 </div>
             {/if}

             <button onclick={close} aria-label="Close modal" class="hidden md:block absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm">

                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div class="flex items-center justify-between mb-4 px-1">
                <div class="flex items-center gap-2">
                    <h2 class="typ-title dark:text-white">{$t('modals.manageContacts.title')}</h2>
                </div>
            </div>
            
            <div class="mb-6">
                <div class="flex gap-2 relative">
                    <input 
                        bind:value={newNpub}
                        placeholder={$t('modals.manageContacts.searchPlaceholder')} 
                        class="flex-1 px-4 h-11 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                    <button 
                        onclick={add}
                        disabled={isAdding}
                        class="bg-blue-500 text-white w-11 h-11 rounded-xl hover:bg-blue-600 disabled:opacity-50 font-medium shadow-sm hover:shadow transition-all flex items-center justify-center flex-shrink-0"
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
                    </button>

                    {#if !isNpubMode && newNpub.trim().length >= 3 && (isSearching || searchResults.length > 0 || searchError)}
                        <div class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto z-10 custom-scrollbar">
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
                                        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-left transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0"
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
                                             <span class="typ-meta text-gray-500 dark:text-slate-400 truncate">

                                                {shortenNpub(result.npub)}
                                                {#if result.nip05}
                                                    {' · '}
                                                    {#if result.nip05Status === 'valid'}
                                                        <span class="inline-flex items-center gap-1">
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
                                                        <span class="inline-flex items-center gap-1" title="NIP-05 not verified for this key">
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
                                                        <span>{getDisplayedNip05(result.nip05)}</span>
                                                    {/if}
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

            <div class="flex-1 overflow-y-auto space-y-2 mb-6 min-h-[200px] custom-scrollbar pr-1">
                {#if contacts.length === 0}
                    <div class="typ-body text-gray-500 text-center py-8 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        {$t('modals.manageContacts.noContacts')}
                    </div>
                {/if}
                {#each displayContacts as contact}
                    <div class="flex justify-between items-center p-3 border border-gray-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800/40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                        <div class="flex items-center gap-3 min-w-0">
                            <Avatar 
                                npub={contact.npub}
                                src={contact.picture}
                                size="sm"
                                class="!w-10 !h-10 flex-shrink-0"
                            />
                            <div class="flex flex-col min-w-0">
                                <span class="font-medium dark:text-gray-200 truncate">{contact.name}</span>
                                 <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">{contact.shortNpub}</span>

                            </div>
                        </div>
                        <button 
                            onclick={() => remove(contact.npub)}
                            class="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                            aria-label={$t('modals.manageContacts.removeContactAria')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </div>
                {/each}
            </div>


        </div>
    </div>
{/if}
