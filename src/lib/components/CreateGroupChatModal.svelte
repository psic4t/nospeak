<script lang="ts">
    import Avatar from './Avatar.svelte';
    import { hapticSelection } from '$lib/utils/haptics';
    import { fade, scale } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { t } from '$lib/i18n';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import { goto } from '$app/navigation';
    import { cubicOut } from 'svelte/easing';
    import { createGroupCreationController, truncateName } from '$lib/core/GroupCreationController.svelte';

    let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();

    const ctrl = createGroupCreationController();

    $effect(() => {
        if (!isOpen) {
            ctrl.reset();
            return;
        }
        return ctrl.startSubscription();
    });

    async function handleCreateGroup() {
        const conversationId = await ctrl.createGroup();
        if (conversationId) {
            close();
            goto(`/chat/${conversationId}`);
        }
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
        <div 
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }} 
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class="px-6 pb-6 pt-safe md:pt-6 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden outline-none relative transition-transform duration-150 ease-out w-full h-full rounded-none md:w-[480px] md:h-auto md:max-h-[80vh] md:rounded-3xl bg-white dark:bg-slate-900/80 md:bg-white/95 backdrop-blur-xl"
        >
            <!-- Close button -->
            <Button size="icon" onclick={() => { hapticSelection(); close(); }} aria-label="Close modal" class="hidden md:flex absolute top-4 right-4 z-10 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </Button>

            <!-- Header -->
            <div class="flex items-center gap-2 mb-4 px-1">
                <!-- Back button (mobile only) -->
                <button 
                    onclick={() => { hapticSelection(); close(); }}
                    aria-label="Go back"
                    class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150 ease-out"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                </button>
                <h2 class="typ-title dark:text-white">{$t('modals.createGroup.title')}</h2>
            </div>
            
            <!-- Selected contacts chips -->
            {#if ctrl.selectedCount > 0}
                <div class="flex gap-3 overflow-x-auto pt-2 pb-3 mb-2 -mx-1 px-1 scrollbar-hide">
                    {#each ctrl.selectedContacts as contact (contact.npub)}
                        <div 
                            class="flex flex-col items-center flex-shrink-0"
                            in:scale={{ duration: 150, start: 0.8, easing: cubicOut }}
                            out:scale={{ duration: 100, start: 0.8 }}
                        >
                            <div class="relative">
                                <Avatar 
                                    npub={contact.npub}
                                    src={contact.picture}
                                    size="sm"
                                    class="!w-12 !h-12"
                                />
                                <button 
                                    type="button"
                                    class="absolute -top-1 -right-1 w-5 h-5 bg-gray-500 dark:bg-slate-600 hover:bg-gray-600 dark:hover:bg-slate-500 rounded-full flex items-center justify-center shadow-sm transition-colors"
                                    onclick={(e) => { e.stopPropagation(); ctrl.removeContact(contact.npub); }}
                                    aria-label="Remove {contact.name}"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <span class="text-xs mt-1.5 text-gray-700 dark:text-slate-300 max-w-[64px] text-center truncate">
                                {truncateName(contact.name)}
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
            
            <!-- Search field -->
            <div class="mb-4">
                <Input 
                    bind:value={ctrl.searchQuery}
                    placeholder={$t('modals.createGroup.searchPlaceholder')} 
                    class="w-full"
                />
            </div>

            <!-- Contact list -->
            <div class="flex-1 overflow-y-auto mb-4 min-h-[200px] custom-scrollbar native-scroll pr-1">
                {#if ctrl.displayContacts.length === 0}
                    <div class="typ-body text-gray-500 text-center py-8 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        {$t('modals.createGroup.noContacts')}
                    </div>
                {:else if ctrl.filteredContacts().length === 0}
                    <div class="typ-body text-gray-500 text-center py-8">
                        {$t('modals.manageContacts.noResults')}
                    </div>
                {:else}
                    {#each ctrl.filteredContacts() as contact (contact.npub)}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div 
                            class="flex justify-between items-center p-3 my-1.5 rounded-full transition-all duration-200 ease-out cursor-pointer active:scale-[0.98] {ctrl.isSelected(contact.npub) ? 'bg-[rgb(var(--color-lavender-rgb)/0.20)] dark:bg-[rgb(var(--color-lavender-rgb)/0.24)]' : 'bg-transparent hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)]'}"
                            onclick={() => ctrl.toggleContact(contact.npub)}
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
                            
                            <!-- Checkbox/selection indicator -->
                            <div class="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors {ctrl.isSelected(contact.npub) ? 'bg-[rgb(var(--color-lavender-rgb))] border-[rgb(var(--color-lavender-rgb))]' : 'border-gray-300 dark:border-slate-600'}">
                                {#if ctrl.isSelected(contact.npub)}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Footer with cancel and create buttons -->
            <div class="flex flex-col gap-2">
                {#if !ctrl.canCreate && ctrl.selectedCount > 0}
                    <p class="typ-meta text-gray-500 dark:text-slate-400 text-center">
                        {$t('modals.createGroup.minContactsHint')}
                    </p>
                {/if}
                <div class="flex gap-3">
                    <Button 
                        onclick={() => { hapticSelection(); close(); }}
                        variant="filled-tonal"
                        class="flex-1"
                    >
                        {$t('common.cancel')}
                    </Button>
                    <Button 
                        onclick={handleCreateGroup}
                        disabled={!ctrl.canCreate || ctrl.isCreating}
                        variant="primary"
                        class="flex-1"
                    >
                        {#if ctrl.isCreating}
                            <svg class="animate-spin h-5 w-5 me-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {$t('modals.createGroup.creating')}
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            {$t('modals.createGroup.createButton')}
                        {/if}
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
</style>
