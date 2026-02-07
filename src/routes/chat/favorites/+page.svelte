<script lang="ts">
    import { goto } from '$app/navigation';
    import { favoriteRepo } from '$lib/db/FavoriteRepository';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { conversationRepo, isGroupConversationId } from '$lib/db/ConversationRepository';
    import { toggleFavorite } from '$lib/stores/favorites';
    import { clearActiveConversation } from '$lib/stores/unreadMessages';
    import { getRelativeTime } from '$lib/utils/time';
    import { getMediaPreviewLabel, getLocationPreviewLabel } from '$lib/utils/mediaPreview';
    import { blur } from '$lib/utils/platform';
    import { tapSoundClick } from '$lib/utils/tapSound';
    import { t } from '$lib/i18n';
    import { onMount, onDestroy } from 'svelte';
    import type { Message, FavoriteItem } from '$lib/db/db';

    interface FavoriteGroup {
        conversationId: string;
        conversationName: string;
        isGroup: boolean;
        items: Array<{
            favorite: FavoriteItem;
            message: Message | null;
        }>;
    }

    let groups = $state<FavoriteGroup[]>([]);
    let loading = $state(true);
    let currentTime = $state(Date.now());

    onMount(() => {
        clearActiveConversation();
        loadFavorites();
    });

    onDestroy(() => {
        clearActiveConversation();
    });

    async function loadFavorites() {
        loading = true;
        try {
            const favorites = await favoriteRepo.getFavorites();

            // Group by conversationId
            const groupMap = new Map<string, Array<{ favorite: FavoriteItem; message: Message | null }>>();

            for (const fav of favorites) {
                const message = await messageRepo.getMessageByEventId(fav.eventId) ?? null;
                const convId = fav.conversationId;

                if (!groupMap.has(convId)) {
                    groupMap.set(convId, []);
                }
                groupMap.get(convId)!.push({ favorite: fav, message });
            }

            // Resolve conversation names
            const result: FavoriteGroup[] = [];
            for (const [convId, items] of groupMap) {
                const isGroup = isGroupConversationId(convId);
                let conversationName = convId.slice(0, 12) + '...';

                if (isGroup) {
                    const conv = await conversationRepo.getConversation(convId);
                    if (conv?.subject) {
                        conversationName = conv.subject;
                    } else if (conv) {
                        conversationName = `Group (${conv.participants.length})`;
                    }
                } else {
                    const profile = await profileRepo.getProfileIgnoreTTL(convId);
                    if (profile?.metadata) {
                        conversationName = profile.metadata.display_name || profile.metadata.name || convId.slice(0, 12) + '...';
                    }
                }

                // Sort items by message sentAt (newest first)
                items.sort((a, b) => {
                    const aTime = a.message?.sentAt ?? a.favorite.createdAt;
                    const bTime = b.message?.sentAt ?? b.favorite.createdAt;
                    return bTime - aTime;
                });

                result.push({ conversationId: convId, conversationName, isGroup, items });
            }

            // Sort groups by most recent favorite
            result.sort((a, b) => {
                const aTime = a.items[0]?.message?.sentAt ?? a.items[0]?.favorite.createdAt ?? 0;
                const bTime = b.items[0]?.message?.sentAt ?? b.items[0]?.favorite.createdAt ?? 0;
                return bTime - aTime;
            });

            groups = result;
        } catch (e) {
            console.error('[FavoritesPage] Failed to load favorites:', e);
        } finally {
            loading = false;
        }
    }

    function navigateToMessage(conversationId: string, eventId: string) {
        goto(`/chat/${conversationId}?highlight=${eventId}`);
    }

    function getMessagePreview(message: Message | null): string {
        if (!message) return 'Message unavailable';
        if (message.location) return getLocationPreviewLabel();
        if (message.fileType) return getMediaPreviewLabel(message.fileType);
        if (message.message) {
            const text = message.message.length > 120
                ? message.message.slice(0, 120) + '...'
                : message.message;
            return text;
        }
        return 'Message';
    }

    async function handleUnfavorite(eventId: string, conversationId: string) {
        await toggleFavorite(eventId, conversationId);
        // Reload the list
        await loadFavorites();
    }
</script>

<svelte:head>
    <title>nospeak: Favorites</title>
</svelte:head>

<div class="relative flex flex-col h-full overflow-hidden bg-white/30 dark:bg-slate-900/30 {blur('sm')}">
    <!-- Header (matches ChatView header style) -->
    <div
        class="absolute top-0 left-0 right-0 z-20 p-2 pt-safe min-h-16 border-b border-gray-200/50 dark:border-slate-700/70 flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm transition-all duration-150 ease-out"
    >
        <div class="flex items-center gap-3 flex-1 min-w-0">
            <button
                onclick={() => {
                    tapSoundClick();
                    goto('/chat');
                }}
                class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150 ease-out flex-shrink-0"
                aria-label="Back to contacts"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>
            <div class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 md:w-5 md:h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
            </div>
            <span class="font-bold dark:text-white text-left truncate min-w-0">
                {$t('chats.favorites')}
            </span>
        </div>
    </div>

    <!-- Content (padded for header, matches ChatView content area) -->
    <div class="flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-[calc(5rem+env(safe-area-inset-top))] space-y-6 custom-scrollbar">
        {#if loading}
            <div class="flex justify-center mt-10">
                <div class="text-sm text-gray-500 dark:text-slate-400">Loading...</div>
            </div>
        {:else if groups.length === 0}
            <div class="flex justify-center mt-10">
                <div class="max-w-sm px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/70 shadow-md {blur('xl')} text-center space-y-1">
                    <div class="typ-meta font-semibold uppercase text-gray-500 dark:text-slate-400">
                        {$t('chats.emptyFavorites')}
                    </div>
                </div>
            </div>
        {:else}
            {#each groups as group}
                <div>
                    <!-- Conversation header -->
                    <div class="flex items-center gap-2 mb-2 px-1">
                        <h2 class="text-sm font-semibold text-gray-600 dark:text-slate-400 truncate">
                            {group.conversationName}
                        </h2>
                        <div class="flex-1 h-px bg-gray-200/50 dark:bg-slate-700/50"></div>
                    </div>

                    <!-- Favorite messages -->
                    <div class="space-y-2">
                        {#each group.items as { favorite, message }}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 shadow-sm cursor-pointer hover:shadow-md hover:bg-white dark:hover:bg-slate-800 transition-all duration-150 ease-out group"
                                onclick={() => navigateToMessage(group.conversationId, favorite.eventId)}
                            >
                                <div class="flex items-start gap-3">
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm text-gray-900 dark:text-slate-100 line-clamp-3">
                                            {getMessagePreview(message)}
                                        </div>
                                        <div class="flex items-center gap-2 mt-1.5">
                                            <span class="text-xs text-gray-500 dark:text-slate-400">
                                                {#if message}
                                                    {message.direction === 'sent' ? 'You' : group.conversationName} &middot; {getRelativeTime(message.sentAt, currentTime)}
                                                {:else}
                                                    {getRelativeTime(favorite.createdAt, currentTime)}
                                                {/if}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        class="p-1.5 rounded-full text-yellow-500 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/30 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        onclick={(e) => { e.stopPropagation(); handleUnfavorite(favorite.eventId, favorite.conversationId); }}
                                        aria-label="Unfavorite"
                                    >
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>
