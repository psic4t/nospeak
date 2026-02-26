<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    import { showCreateGroupModal } from '$lib/stores/modals';
    import { isAndroidNative } from '$lib/core/NativeDialogs';
    import { hapticSelection } from '$lib/utils/haptics';
    import { t } from '$lib/i18n';

    import Avatar from '$lib/components/Avatar.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import { createGroupCreationController, truncateName } from '$lib/core/GroupCreationController.svelte';

    const isAndroidApp = isAndroidNative();

    onMount(() => {
        if (isAndroidApp) {
            return;
        }

        // Web/desktop: keep existing modal behavior.
        showCreateGroupModal.set(true);
        goto('/chat');
    });

    const ctrl = createGroupCreationController();

    $effect(() => {
        if (!isAndroidApp) return;
        return ctrl.startSubscription();
    });

    async function handleCreateGroup(): Promise<void> {
        const conversationId = await ctrl.createGroup();
        if (conversationId) {
            goto(`/chat/${conversationId}`);
        }
    }

    function goBack(): void {
        hapticSelection();
        if (typeof window !== 'undefined' && window.history.length > 1) {
            window.history.back();
            return;
        }
        goto('/contacts', { replaceState: true });
    }
</script>

{#if isAndroidApp}
    <div class="h-full overflow-hidden bg-white/50 dark:bg-slate-900/50">
        <!-- One vertical scroll container for the entire page -->
        <div class="h-full overflow-y-auto native-scroll">
            <!-- Sticky header (inside the same scroller) -->
            <div class="sticky top-0 z-20 flex flex-col pt-safe bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-700/70 shadow-sm">
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
                    <h1 class="typ-title dark:text-white">{$t('modals.createGroup.title')}</h1>
                </div>

                <!-- Selected contacts chips (horizontal only) -->
                {#if ctrl.selectedCount > 0}
                    <div class="px-4 pb-2">
                        <div class="flex gap-3 overflow-x-auto py-1 scrollbar-hide">
                            {#each ctrl.selectedContacts as contact (contact.npub)}
                                <div class="flex flex-col items-center flex-shrink-0">
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
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                ctrl.removeContact(contact.npub);
                                            }}
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
                    </div>
                {/if}

                <!-- Search field -->
                <div class="px-4 pb-4">
                    <Input
                        bind:value={ctrl.searchQuery}
                        placeholder={$t('modals.createGroup.searchPlaceholder')}
                        class="w-full"
                    />
                </div>
            </div>

            <!-- Content (no nested vertical scroll) -->
            <div class="px-2 pb-safe-offset-28">
                {#if ctrl.contacts.length === 0}
                    <div class="typ-body text-gray-500 text-center py-8 mx-2 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        {$t('modals.createGroup.noContacts')}
                    </div>
                {:else if ctrl.filteredContacts().length === 0}
                    <div class="typ-body text-gray-500 text-center py-8">
                        {$t('modals.manageContacts.noResults')}
                    </div>
                {:else}
                    <div class="pt-2">
                        {#each ctrl.filteredContacts() as contact (contact.npub)}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="flex justify-between items-center p-3 my-1.5 rounded-full transition-all duration-200 ease-out cursor-pointer active:scale-[0.98] {ctrl.isSelected(contact.npub)
                                    ? 'bg-[rgb(var(--color-lavender-rgb)/0.20)] dark:bg-[rgb(var(--color-lavender-rgb)/0.24)]'
                                    : 'bg-transparent hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)]'}"
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

                                <div class="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors {ctrl.isSelected(contact.npub)
                                    ? 'bg-[rgb(var(--color-lavender-rgb))] border-[rgb(var(--color-lavender-rgb))]'
                                    : 'border-gray-300 dark:border-slate-600'}"
                                >
                                    {#if ctrl.isSelected(contact.npub)}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Sticky footer (still in the same scroller) -->
            <div class="sticky bottom-0 z-20 android-safe-area-bottom bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-gray-200/50 dark:border-slate-700/70 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
                <div class="px-4 py-3">
                    {#if !ctrl.canCreate && ctrl.selectedCount > 0}
                        <p class="typ-meta text-gray-500 dark:text-slate-400 text-center mb-2">
                            {$t('modals.createGroup.minContactsHint')}
                        </p>
                    {/if}
                    <div class="flex gap-3">
                        <Button
                            onclick={goBack}
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
                                <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {$t('modals.createGroup.creating')}
                            {:else}
                                {$t('modals.createGroup.createButton')}
                            {/if}
                        </Button>
                    </div>
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
