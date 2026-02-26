<script lang="ts">
    import Avatar from './Avatar.svelte';
    import { hapticSelection } from '$lib/utils/haptics';
    import { fade } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { t } from '$lib/i18n';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import ContactContextMenu from './ContactContextMenu.svelte';
    import ConfirmDialog from './ConfirmDialog.svelte';
    import { goto } from '$app/navigation';
    import { showScanContactQrModal, showCreateGroupModal, openProfileModal } from '$lib/stores/modals';
    import {
        createContactsController,
        shortenNpub,
        isValidNip05Format,
        getDisplayedNip05,
        type DisplayContact
    } from '$lib/core/ContactsController.svelte';

    let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();

    const ctrl = createContactsController();

    // Context menu state
    let contextMenuOpen = $state(false);
    let contextMenuX = $state(0);
    let contextMenuY = $state(0);
    let selectedContact = $state<DisplayContact | null>(null);

    // Confirm dialog state
    let confirmDeleteOpen = $state(false);

    // Long-press timer
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressStartX = 0;
    let longPressStartY = 0;

    // Track when context menu closes to prevent click-through
    let contextMenuClosedAt = 0;

    $effect(() => {
        if (!isOpen) {
            ctrl.resetState();
            return;
        }
        syncContactsFromRelay();
        return ctrl.startSubscription();
    });

    async function syncContactsFromRelay() {
        try {
            const { contactSyncService } = await import('$lib/core/ContactSyncService');
            await contactSyncService.fetchAndSyncContacts();
        } catch (e) {
            console.error('Failed to sync contacts from relay:', e);
        }
    }

    // Connect discovery relays on first keystroke
    $effect(() => {
        if (!isOpen) return;
        if (ctrl.newNpub.trim().length > 0) {
            ctrl.ensureDiscoveryRelays();
        }
    });

    // Search effect
    $effect(() => {
        if (!isOpen) return;
        // Access newNpub to create dependency
        ctrl.newNpub;
        ctrl.handleSearchEffect();
    });

    // NIP-05 lookup effect
    $effect(() => {
        if (!isOpen) return;
        ctrl.newNpub;
        ctrl.handleNip05LookupEffect();
    });

    function openChat(npub: string) {
        if (Date.now() - contextMenuClosedAt < 150) return;

        hapticSelection();
        close();
        goto(`/chat/${npub}`);
    }

    function handleLongPressStart(e: MouseEvent | TouchEvent, contact: DisplayContact) {
        if (window.innerWidth >= 768) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        longPressStartX = clientX;
        longPressStartY = clientY;

        longPressTimer = setTimeout(() => {
            hapticSelection();
            selectedContact = contact;
            contextMenuX = clientX;
            contextMenuY = clientY;
            contextMenuOpen = true;
            longPressTimer = null;
        }, 500);
    }

    function handleLongPressEnd() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function handleTouchMove(e: TouchEvent) {
        if (!longPressTimer) return;

        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - longPressStartX);
        const dy = Math.abs(touch.clientY - longPressStartY);

        if (dx > 10 || dy > 10) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function handleDotMenuClick(e: MouseEvent, contact: DisplayContact) {
        e.stopPropagation();
        hapticSelection();
        selectedContact = contact;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        contextMenuX = rect.left;
        contextMenuY = rect.bottom + 4;
        contextMenuOpen = true;
    }

    function handleViewProfile() {
        if (selectedContact) {
            contextMenuOpen = false;
            close();
            openProfileModal(selectedContact.npub);
        }
    }

    function handleDeleteOption() {
        contextMenuOpen = false;
        confirmDeleteOpen = true;
    }

    function confirmDelete() {
        if (selectedContact) {
            ctrl.remove(selectedContact.npub);
        }
        confirmDeleteOpen = false;
        selectedContact = null;
    }

    function cancelDelete() {
        confirmDeleteOpen = false;
        selectedContact = null;
    }
</script>

{#if isOpen}
    <div 
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class="fixed inset-0 flex justify-center z-50 items-center bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if(e.target === e.currentTarget) { hapticSelection(); close(); } }}
        onkeydown={(e) => { if(e.key === 'Escape') { hapticSelection(); close(); } }}
    >
        <!-- Web only: Android uses /contacts route instead of this modal -->
        <div 
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }} 
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class="p-6 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden outline-none relative transition-transform duration-150 ease-out w-full h-full rounded-none md:w-[480px] md:h-auto md:max-h-[80vh] md:rounded-3xl bg-white dark:bg-slate-900/80 md:bg-white/95 backdrop-blur-xl"
        >
            <!-- Close button -->
            <Button size="icon" onclick={() => { hapticSelection(); close(); }} aria-label="Close modal" class="hidden md:flex absolute top-4 end-4 z-10 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </Button>

            <div class="flex items-center mb-4 px-1">
                <h2 class="typ-title dark:text-white">{$t('modals.manageContacts.title')}</h2>
                <span class="typ-meta text-gray-400 dark:text-slate-500 ms-3 self-center">{ctrl.contacts.length}</span>
            </div>

            <div class="mb-4">
                <Input
                    bind:value={ctrl.contactSearchQuery}
                    placeholder={$t('modals.createGroup.searchPlaceholder')}
                    class="w-full"
                />
            </div>
            
            <div class="flex-1 overflow-y-auto mb-6 min-h-[200px] custom-scrollbar native-scroll pr-1">
                <!-- New contact row -->
                <div class="flex items-center justify-between p-3 my-1.5 rounded-full w-full hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] transition-all duration-200 ease-out">
                    <button
                        type="button"
                        class="flex items-center gap-3 text-start bg-transparent text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 ease-out active:scale-[0.98]"
                        onclick={() => {
                            hapticSelection();
                            ctrl.toggleSearchField();
                        }}
                    >
                        <div class="w-12 h-12 rounded-full bg-[rgb(var(--color-lavender-rgb))] flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <span class="font-bold text-gray-800 dark:text-slate-100 text-[15px]">
                            {$t('modals.manageContacts.newContact')}
                        </span>
                    </button>
                    <button
                        type="button"
                        class="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors duration-150"
                        onclick={() => {
                            hapticSelection();
                            close();
                            showScanContactQrModal.set(true);
                        }}
                        aria-label={$t('modals.manageContacts.scanQrAria')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="6" height="6"></rect>
                            <rect x="15" y="3" width="6" height="6"></rect>
                            <rect x="3" y="15" width="6" height="6"></rect>
                            <path d="M15 15h2v2h-2z"></path>
                            <path d="M19 15h2v2h-2z"></path>
                            <path d="M15 19h2v2h-2z"></path>
                        </svg>
                    </button>
                </div>

                {#if ctrl.showSearchField}
                    <div class="px-3 pb-3 relative">
                        <div class="flex gap-2 relative">
                            <Input 
                                id="contact-search-input"
                                bind:value={ctrl.newNpub}
                                placeholder={$t('modals.manageContacts.searchPlaceholder')} 
                                class="flex-1"
                            />
                            <Button 
                                onclick={() => ctrl.add()}
                                disabled={ctrl.isAdding}
                                variant="primary"
                                size="icon"
                                class="flex-shrink-0"
                                aria-label={ctrl.isNpubMode ? $t('modals.manageContacts.addContactAria') : $t('modals.manageContacts.searchContactsAria')}
                            >
                                {#if ctrl.isNpubMode}
                                    {#if ctrl.isAdding}
                                        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    {:else}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    {/if}
                                {:else}
                                    {#if ctrl.isSearching}
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
                            {#if isValidNip05Format(ctrl.newNpub.trim()) && (ctrl.isResolvingNip05 || ctrl.nip05LookupError || ctrl.nip05Result)}
                                <div class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl z-10">
                                    {#if ctrl.isResolvingNip05}
                                        <div class="px-4 py-3 typ-body text-gray-500 dark:text-slate-400 flex items-center gap-2">
                                            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>{$t('modals.manageContacts.resolvingNip05')}</span>
                                        </div>
                                    {:else if ctrl.nip05LookupError}
                                        <div class="px-4 py-3 typ-body text-red-500">
                                            {#if ctrl.nip05LookupError === 'invalid-format'}
                                                {$t('modals.manageContacts.nip05InvalidFormat')}
                                            {:else if ctrl.nip05LookupError === 'not-found'}
                                                {$t('modals.manageContacts.nip05NotFound')}
                                            {:else}
                                                {$t('modals.manageContacts.nip05LookupFailed')}
                                            {/if}
                                        </div>
                                    {:else if ctrl.nip05Result}
                                        <button
                                            type="button"
                                            disabled={ctrl.nip05Result.alreadyAdded}
                                            onclick={() => { hapticSelection(); ctrl.selectNip05Result(); }}
                                            class="w-full flex items-center gap-3 px-4 py-3 text-start transition-colors {ctrl.nip05Result.alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)]'}"
                                        >
                                            <Avatar
                                                npub={ctrl.nip05Result.npub}
                                                src={ctrl.nip05Result.picture}
                                                size="sm"
                                                class="!w-8 !h-8 flex-shrink-0"
                                            />
                                            <div class="flex flex-col min-w-0">
                                                <div class="flex items-center gap-1 min-w-0">
                                                    <span class="font-medium dark:text-gray-100 truncate">
                                                        {ctrl.nip05Result.name}
                                                    </span>
                                                    {#if ctrl.nip05Result.alreadyAdded}
                                                        <span class="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                                                            {$t('modals.manageContacts.alreadyAdded')}
                                                        </span>
                                                    {/if}
                                                    {#if ctrl.nip05Result.nip05}
                                                        <span class="inline-flex items-center gap-1 typ-meta text-gray-500 dark:text-slate-400 truncate">
                                                            <svg class="text-green-500 shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                                <path d="m9 12 2 2 4-4"></path>
                                                            </svg>
                                                            <span>{getDisplayedNip05(ctrl.nip05Result.nip05)}</span>
                                                        </span>
                                                    {/if}
                                                </div>
                                                <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">
                                                    {shortenNpub(ctrl.nip05Result.npub)}
                                                </span>
                                            </div>
                                        </button>
                                    {/if}
                                </div>
                            {/if}

                            <!-- Search results -->
                            {#if !ctrl.isNpubMode && ctrl.newNpub.trim().length >= 3 && (ctrl.isSearching || ctrl.searchResults.length > 0 || ctrl.searchError)}
                                <div class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto z-10 custom-scrollbar native-scroll">
                                    {#if ctrl.isSearching}
                                        <div class="px-4 py-3 typ-body text-gray-500 dark:text-slate-400">
                                            {$t('modals.manageContacts.searching')}
                                        </div>
                                    {:else if ctrl.searchError}
                                        <div class="px-4 py-3 typ-body text-red-500">
                                            {ctrl.searchError}
                                        </div>
                                    {:else if ctrl.searchResults.length === 0}
                                        <div class="px-4 py-3 typ-body text-gray-500 dark:text-slate-400">
                                            {$t('modals.manageContacts.noResults')}
                                        </div>
                                    {:else}
                                        {#each ctrl.searchResults as result (result.npub)}
                                            <button
                                                type="button"
                                                class="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] text-start transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0"
                                                onclick={() => ctrl.selectSearchResult(result)}
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
                                                                    <svg class="text-green-500 shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                                        <path d="m9 12 2 2 4-4"></path>
                                                                    </svg>
                                                                    <span>{getDisplayedNip05(result.nip05)}</span>
                                                                </span>
                                                            {:else if result.nip05Status === 'invalid'}
                                                                <span class="inline-flex items-center gap-1 typ-meta text-gray-500 dark:text-slate-400 truncate" title="NIP-05 not verified for this key">
                                                                    <svg class="text-yellow-500 shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                {/if}

                <!-- Create group row -->
                <button
                    type="button"
                    class="flex items-center gap-3 p-3 my-1.5 rounded-full w-full text-start bg-transparent text-gray-700 dark:text-gray-400 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] hover:text-gray-900 dark:hover:text-white transition-all duration-200 ease-out active:scale-[0.98]"
                    onclick={() => {
                        hapticSelection();
                        close();
                        showCreateGroupModal.set(true);
                    }}
                >
                    <div class="w-12 h-12 rounded-full bg-[rgb(var(--color-lavender-rgb))] flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <span class="font-bold text-gray-800 dark:text-slate-100 text-[15px]">
                        {$t('modals.manageContacts.createGroup')}
                    </span>
                </button>

                <div class="mx-4 my-1 border-b border-gray-200/60 dark:border-slate-700/60"></div>

                {#if ctrl.contacts.length === 0}
                    <div class="typ-body text-gray-500 text-center py-8 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        {$t('modals.manageContacts.noContacts')}
                    </div>
                {:else if ctrl.filteredContacts().length === 0}
                    <div class="typ-body text-gray-500 text-center py-8">
                        {$t('modals.manageContacts.noResults')}
                    </div>
                {/if}
                {#each ctrl.filteredContacts() as contact (contact.npub)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                        class="flex justify-between items-center p-3 my-1.5 rounded-full bg-transparent text-gray-700 dark:text-gray-400 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] hover:text-gray-900 dark:hover:text-white transition-all duration-200 ease-out group cursor-pointer active:scale-[0.98]"
                        onclick={() => openChat(contact.npub)}
                        onmousedown={(e) => handleLongPressStart(e, contact)}
                        onmouseup={handleLongPressEnd}
                        ontouchstart={(e) => handleLongPressStart(e, contact)}
                        ontouchend={handleLongPressEnd}
                        ontouchcancel={handleLongPressEnd}
                        ontouchmove={handleTouchMove}
                    >
                        <div class="flex items-center gap-3 min-w-0">
                            <Avatar 
                                npub={contact.npub}
                                src={contact.picture}
                                size="md"
                                class="!w-12 !h-12 flex-shrink-0"
                            />
                            <div class="flex flex-col min-w-0">
                                <span class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px] flex items-baseline gap-1.5">
                                    <span class="truncate">{contact.name}</span>
                                    {#if contact.username}
                                        <span class="text-xs font-normal text-gray-500 dark:text-slate-400 shrink-0">@{contact.username}</span>
                                    {/if}
                                </span>
                                <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">{contact.shortNpub}</span>
                            </div>
                        </div>
                        <!-- 3-dot menu button (desktop only, visible on hover) -->
                        <button
                            type="button"
                            class="hidden md:flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200/50 dark:hover:bg-slate-700/50"
                            onclick={(e) => handleDotMenuClick(e, contact)}
                            aria-label={$t('modals.manageContacts.contextMenu.openMenu')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="5" r="1"/>
                                <circle cx="12" cy="12" r="1"/>
                                <circle cx="12" cy="19" r="1"/>
                            </svg>
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <ContactContextMenu
        x={contextMenuX}
        y={contextMenuY}
        isOpen={contextMenuOpen}
        onClose={() => { contextMenuOpen = false; contextMenuClosedAt = Date.now(); }}
        onViewProfile={handleViewProfile}
        onDelete={handleDeleteOption}
    />

    <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title={$t('modals.manageContacts.confirmDelete.title')}
        message={$t('modals.manageContacts.confirmDelete.message', { values: { name: selectedContact?.name ?? '' } })}
        confirmText={$t('modals.manageContacts.confirmDelete.confirm')}
        cancelText={$t('common.cancel')}
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
    />
{/if}
