<script lang="ts">
    import { goto } from '$app/navigation';
    import { favoriteRepo } from '$lib/db/FavoriteRepository';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { conversationRepo, isGroupConversationId } from '$lib/db/ConversationRepository';
    import { toggleFavorite } from '$lib/stores/favorites';
    import { clearActiveConversation } from '$lib/stores/unreadMessages';
    import { currentUser } from '$lib/stores/auth';
    import { openImageViewer } from '$lib/stores/imageViewer';
    import { getRelativeTime } from '$lib/utils/time';
    import { blur, isAndroidCapacitorShell } from '$lib/utils/platform';
    import { isMobileWeb } from '$lib/core/NativeDialogs';
    import { tapSoundClick } from '$lib/utils/tapSound';
    import { t } from '$lib/i18n';
    import { onMount, onDestroy } from 'svelte';
    import type { Message, FavoriteItem } from '$lib/db/db';
    import Avatar from '$lib/components/Avatar.svelte';
    import MessageContent from '$lib/components/MessageContent.svelte';
    import ContextMenu from '$lib/components/ContextMenu.svelte';

    interface FavoriteGroup {
        conversationId: string;
        conversationName: string;
        conversationPicture: string | undefined;
        isGroup: boolean;
        items: Array<{
            favorite: FavoriteItem;
            message: Message | null;
            senderPicture?: string;
            senderName?: string;
        }>;
    }

    let groups = $state<FavoriteGroup[]>([]);
    let loading = $state(true);
    let currentTime = $state(Date.now());
    let myPicture = $state<string | undefined>(undefined);

    const isAndroidShell = isAndroidCapacitorShell();
    const useFullWidthBubbles = isAndroidShell || isMobileWeb();

    // Context menu state
    let contextMenu = $state<{
        isOpen: boolean;
        x: number;
        y: number;
        eventId: string;
        conversationId: string;
        message: Message | null;
    }>({ isOpen: false, x: 0, y: 0, eventId: '', conversationId: '', message: null });

    let longPressTimer: number | null = null;

    onMount(() => {
        clearActiveConversation();
        loadFavorites();
        // Load own profile picture
        if ($currentUser) {
            profileRepo.getProfileIgnoreTTL($currentUser.npub).then((p) => {
                if (p?.metadata?.picture) {
                    myPicture = p.metadata.picture;
                }
            });
        }
    });

    onDestroy(() => {
        clearActiveConversation();
    });

    async function loadFavorites() {
        loading = true;
        try {
            const favorites = await favoriteRepo.getFavorites();

            // Group by conversationId
            const groupMap = new Map<string, Array<{ favorite: FavoriteItem; message: Message | null; senderPicture?: string; senderName?: string }>>();

            for (const fav of favorites) {
                const message = await messageRepo.getMessageByEventId(fav.eventId) ?? null;
                const convId = fav.conversationId;

                if (!groupMap.has(convId)) {
                    groupMap.set(convId, []);
                }
                groupMap.get(convId)!.push({ favorite: fav, message });
            }

            // Resolve conversation names and profile pictures
            const result: FavoriteGroup[] = [];
            for (const [convId, items] of groupMap) {
                const isGroup = isGroupConversationId(convId);
                let conversationName = convId.slice(0, 12) + '...';
                let conversationPicture: string | undefined;

                if (isGroup) {
                    const conv = await conversationRepo.getConversation(convId);
                    if (conv?.subject) {
                        conversationName = conv.subject;
                    } else if (conv) {
                        conversationName = `Group (${conv.participants.length})`;
                    }

                    // Resolve sender profiles for group messages
                    const resolvedNpubs = new Set<string>();
                    for (const item of items) {
                        if (item.message?.direction === 'received' && item.message.senderNpub) {
                            const sNpub = item.message.senderNpub;
                            if (!resolvedNpubs.has(sNpub)) {
                                resolvedNpubs.add(sNpub);
                                const senderProfile = await profileRepo.getProfileIgnoreTTL(sNpub);
                                const pic = senderProfile?.metadata?.picture;
                                const name = senderProfile?.metadata?.display_name || senderProfile?.metadata?.name || sNpub.slice(0, 12) + '...';
                                // Apply to all items from this sender
                                for (const it of items) {
                                    if (it.message?.senderNpub === sNpub) {
                                        it.senderPicture = pic;
                                        it.senderName = name;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    const profile = await profileRepo.getProfileIgnoreTTL(convId);
                    if (profile?.metadata) {
                        conversationName = profile.metadata.display_name || profile.metadata.name || convId.slice(0, 12) + '...';
                        conversationPicture = profile.metadata.picture;
                    }
                }

                // Sort items by message sentAt (newest first)
                items.sort((a, b) => {
                    const aTime = a.message?.sentAt ?? a.favorite.createdAt;
                    const bTime = b.message?.sentAt ?? b.favorite.createdAt;
                    return bTime - aTime;
                });

                result.push({ conversationId: convId, conversationName, conversationPicture, isGroup, items });
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

    // Context menu handlers (replicated from ChatView)
    function openContextMenuAt(x: number, y: number, eventId: string, conversationId: string, message: Message | null) {
        contextMenu = { isOpen: true, x, y, eventId, conversationId, message };
    }

    function handleMouseDown(e: MouseEvent, eventId: string, conversationId: string, message: Message | null) {
        if (window.innerWidth >= 768) return;
        longPressTimer = window.setTimeout(() => {
            openContextMenuAt(e.clientX, e.clientY, eventId, conversationId, message);
            longPressTimer = null;
        }, 500);
    }

    function handleMouseUp() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function handleContextMenu(e: MouseEvent, eventId: string, conversationId: string, message: Message | null) {
        if (window.innerWidth >= 768) return;
        e.preventDefault();
        openContextMenuAt(e.clientX, e.clientY, eventId, conversationId, message);
    }

    function handleDotClick(e: MouseEvent, eventId: string, conversationId: string, message: Message | null) {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.bottom + 4;
        contextMenu = { isOpen: true, x, y, eventId, conversationId, message };
    }

    function closeContextMenu() {
        contextMenu.isOpen = false;
    }

    async function handleUnfavoriteFromMenu() {
        if (!contextMenu.eventId) return;
        await toggleFavorite(contextMenu.eventId, contextMenu.conversationId);
        contextMenu.isOpen = false;
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
                    <div class="flex items-center gap-2 mb-3 px-1">
                        <h2 class="text-sm font-semibold text-gray-600 dark:text-slate-400 truncate">
                            {group.conversationName}
                        </h2>
                        <div class="flex-1 h-px bg-gray-200/50 dark:bg-slate-700/50"></div>
                    </div>

                    <!-- Favorite messages as chat bubbles -->
                    <div class="space-y-3">
                        {#each group.items as { favorite, message, senderPicture, senderName }}
                            {#if message}
                                {@const isSent = message.direction === 'sent'}
                                {@const avatarPic = isSent ? myPicture : (group.isGroup ? senderPicture : group.conversationPicture)}
                                {@const avatarNpub = isSent ? ($currentUser?.npub ?? '') : (group.isGroup && message.senderNpub ? message.senderNpub : group.conversationId)}
                                {@const hasYouTubeLink = /https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(message.message)}
                                {@const hasLocation = !!message.location}
                                {@const bubbleWidthClass = (hasYouTubeLink || hasLocation)
                                    ? 'w-full max-w-full md:w-[560px] md:max-w-full'
                                    : (useFullWidthBubbles ? 'max-w-full' : 'max-w-[70%]')}

                                <div class={`flex ${isSent ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                                    <!-- Avatar (received only) -->
                                    {#if !isSent}
                                        <Avatar
                                            npub={avatarNpub}
                                            src={avatarPic}
                                            size="md"
                                            class="!w-10 !h-10 flex-shrink-0 mb-1"
                                        />
                                    {/if}

                                    <!-- Bubble -->
                                     <div class="{bubbleWidthClass} min-w-0 flex flex-col">
                                         <div class="relative">
                                             <!-- Star badge -->
                                             <div class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm z-10">
                                                 <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                     <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                                 </svg>
                                             </div>
                                         <!-- svelte-ignore a11y_no_static_element_interactions -->
                                         <div
                                             class={`min-w-0 overflow-hidden p-3 shadow-sm transition-all duration-150 ease-out relative ${isAndroidShell ? 'select-none' : ''} ${
                                                 isSent
                                                     ? 'bg-blue-50/10 dark:bg-blue-900/40 text-gray-900 dark:text-slate-100 border border-blue-500/10 dark:border-blue-400/10 rounded-2xl rounded-br-none'
                                                     : 'bg-white/95 dark:bg-slate-800/95 md:bg-white/80 md:dark:bg-slate-800/80 md:backdrop-blur-sm dark:text-white border border-gray-100 dark:border-slate-700/50 rounded-2xl rounded-bl-none'
                                             }`}
                                             oncontextmenu={(e) => handleContextMenu(e, favorite.eventId, favorite.conversationId, message)}
                                             onmousedown={(e) => handleMouseDown(e, favorite.eventId, favorite.conversationId, message)}
                                             onmouseup={handleMouseUp}
                                             onmouseleave={handleMouseUp}
                                         >

                                             <!-- Sender name (group received messages) -->
                                            {#if group.isGroup && !isSent && senderName}
                                                <div class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                                    {senderName}
                                                </div>
                                            {/if}

                                            <!-- Message content -->
                                            <MessageContent
                                                content={message.message}
                                                isOwn={isSent}
                                                onImageClick={openImageViewer}
                                                fileUrl={message.fileUrl}
                                                fileType={message.fileType}
                                                fileEncryptionAlgorithm={message.fileEncryptionAlgorithm}
                                                fileKey={message.fileKey}
                                                fileNonce={message.fileNonce}
                                                authorNpub={isSent ? $currentUser?.npub : (group.isGroup && message.senderNpub ? message.senderNpub : group.conversationId)}
                                                location={message.location}
                                                fileWidth={message.fileWidth}
                                                fileHeight={message.fileHeight}
                                                fileBlurhash={message.fileBlurhash}
                                            />

                                            <!-- Timestamp + dot menu -->
                                            <div class={`typ-meta mt-1 flex items-center justify-end gap-2 ${isSent ? 'text-blue-100' : 'text-gray-400'}`}>
                                                <span class="cursor-help" title={new Date(message.sentAt).toLocaleString()}>
                                                    {getRelativeTime(message.sentAt, currentTime)}
                                                </span>
                                                <button
                                                    type="button"
                                                    class="hidden md:inline-flex py-1 pr-0 pl-px rounded-l hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
                                                    onclick={(e) => handleDotClick(e, favorite.eventId, favorite.conversationId, message)}
                                                    aria-label="Message options"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                        <circle cx="12" cy="5" r="2"/>
                                                        <circle cx="12" cy="12" r="2"/>
                                                        <circle cx="12" cy="19" r="2"/>
                                                    </svg>
                                                </button>
                                             </div>
                                         </div>
                                         </div>
                                     </div>

                                     <!-- Avatar (sent only) -->
                                    {#if isSent && $currentUser}
                                        <Avatar
                                            npub={$currentUser.npub}
                                            src={myPicture}
                                            size="md"
                                            class="!w-10 !h-10 flex-shrink-0 mb-1"
                                        />
                                    {/if}
                                </div>
                            {:else}
                                <!-- Fallback for missing message -->
                                <div class="p-3 rounded-xl bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-sm">
                                    Message unavailable
                                </div>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<ContextMenu
    isOpen={contextMenu.isOpen}
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={closeContextMenu}
    onFavorite={handleUnfavoriteFromMenu}
    isFavorited={true}
    message={contextMenu.message}
/>
