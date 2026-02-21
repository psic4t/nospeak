<script lang="ts">
    import { goto } from '$app/navigation';
    import { archiveRepo } from '$lib/db/ArchiveRepository';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { conversationRepo, generateGroupTitle, isGroupConversationId } from '$lib/db/ConversationRepository';
    import { contactRepo } from '$lib/db/ContactRepository';
    import { toggleArchive, archivedConversationIds } from '$lib/stores/archive';
    import { clearActiveConversation } from '$lib/stores/unreadMessages';
    import { currentUser } from '$lib/stores/auth';
    import { tapSoundClick } from '$lib/utils/tapSound';
    import { t } from '$lib/i18n';
    import { onMount, onDestroy } from 'svelte';
    import { getRelativeTime } from '$lib/utils/time';
    import { blur } from '$lib/utils/platform';
    import Avatar from '$lib/components/Avatar.svelte';
    import GroupAvatar from '$lib/components/GroupAvatar.svelte';
    import ChatContextMenu from '$lib/components/ChatContextMenu.svelte';

    interface ArchivedChat {
        id: string;
        isGroup: boolean;
        name: string;
        picture?: string;
        participants?: string[];
        hasUnread: boolean;
        lastMessageTime: number;
        lastMessageText?: string;
    }

    let archivedChats = $state<ArchivedChat[]>([]);
    let loading = $state(true);
    let currentTime = $state(Date.now());

    // Context menu state
    let contextMenu = $state<{
        isOpen: boolean;
        x: number;
        y: number;
        conversationId: string;
    }>({ isOpen: false, x: 0, y: 0, conversationId: '' });

    let longPressTimer: number | null = null;

    onMount(() => {
        clearActiveConversation();
        loadArchivedChats();
    });

    onDestroy(() => {
        clearActiveConversation();
    });

    async function loadArchivedChats() {
        loading = true;
        try {
            const archives = await archiveRepo.getArchives();
            const chatList: ArchivedChat[] = [];

            for (const archive of archives) {
                const conversationId = archive.conversationId;
                const isGroup = isGroupConversationId(conversationId);
                
                let name: string;
                let picture: string | undefined;
                let participants: string[] | undefined;
                let hasUnread = false;
                let lastMessageTime = 0;
                let lastMessageText: string | undefined;

                if (isGroup) {
                    const conv = await conversationRepo.getConversation(conversationId);
                    if (conv) {
                        participants = conv.participants;
                        if (conv.subject) {
                            name = conv.subject;
                        } else {
                            const participantNames = await Promise.all(
                                conv.participants
                                    .filter((p: string) => p !== $currentUser?.npub)
                                    .slice(0, 5)
                                    .map(async (npub: string) => {
                                        const profile = await profileRepo.getProfileIgnoreTTL(npub);
                                        return profile?.metadata?.name || 
                                               profile?.metadata?.display_name || 
                                               npub.slice(0, 8) + '...';
                                    })
                            );
                            name = generateGroupTitle(participantNames);
                        }

                        // Get messages for this group
                        const recentMsgs = await messageRepo.getMessagesByConversationId(conversationId, 10);
                        const lastMsg = recentMsgs[recentMsgs.length - 1];
                        if (lastMsg) {
                            lastMessageTime = lastMsg.sentAt;
                            lastMessageText = lastMsg.message || '';
                            const lastReceivedMsg = recentMsgs
                                .filter((m) => m.direction === "received")
                                .pop();
                            hasUnread = (lastReceivedMsg?.sentAt || 0) > (conv.lastReadAt || 0);
                        }
                    } else {
                        name = `Group (${conversationId.slice(0, 8)}...)`;
                    }
                } else {
                    // 1-on-1 chat
                    const profile = await profileRepo.getProfileIgnoreTTL(conversationId);
                    name = profile?.metadata?.display_name || 
                          profile?.metadata?.name || 
                          conversationId.slice(0, 10) + "...";
                    picture = profile?.metadata?.picture;

                    // Get messages
                    const recentMsgs = await messageRepo.getMessages(conversationId, 10);
                    const lastMsg = recentMsgs[recentMsgs.length - 1];
                    if (lastMsg) {
                        lastMessageTime = lastMsg.sentAt;
                        lastMessageText = lastMsg.message || '';
                        const lastReceivedMsg = recentMsgs
                            .filter((m) => m.direction === "received")
                            .pop();
                        const contact = await contactRepo.getContacts().then(
                            contacts => contacts.find(c => c.npub === conversationId)
                        );
                        hasUnread = (lastReceivedMsg?.sentAt || 0) > (contact?.lastReadAt || 0);
                    }
                }

                chatList.push({
                    id: conversationId,
                    isGroup,
                    name: name!,
                    picture,
                    participants,
                    hasUnread,
                    lastMessageTime,
                    lastMessageText
                });
            }

            // Sort by last message time
            chatList.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            
            archivedChats = chatList;
        } catch (e) {
            console.error('[ArchivePage] Failed to load archived chats:', e);
        } finally {
            loading = false;
        }
    }

    function selectChat(id: string) {
        tapSoundClick();
        goto(`/chat/${id}`, { invalidateAll: true });
    }

    // Context menu handlers
    function openContextMenuAt(x: number, y: number, conversationId: string) {
        contextMenu = { isOpen: true, x, y, conversationId };
    }

    function handleMouseDown(e: MouseEvent, conversationId: string) {
        if (window.innerWidth >= 768) return;
        longPressTimer = window.setTimeout(() => {
            openContextMenuAt(e.clientX, e.clientY, conversationId);
            longPressTimer = null;
        }, 500);
    }

    function handleMouseUp() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function handleContextMenu(e: MouseEvent, conversationId: string) {
        if (window.innerWidth >= 768) return;
        e.preventDefault();
        openContextMenuAt(e.clientX, e.clientY, conversationId);
    }

    function handleDotClick(e: MouseEvent, conversationId: string) {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.bottom + 4;
        contextMenu = { isOpen: true, x, y, conversationId };
    }

    function closeContextMenu() {
        contextMenu.isOpen = false;
    }

    async function handleUnarchive() {
        if (!contextMenu.conversationId) return;
        await toggleArchive(contextMenu.conversationId);
        contextMenu.isOpen = false;
        await loadArchivedChats();
    }
</script>

<svelte:head>
    <title>nospeak: {$t('chats.archived')}</title>
</svelte:head>

<div class="relative flex flex-col h-full overflow-hidden bg-white/30 dark:bg-slate-900/30 {blur('sm')}">
    <!-- Header -->
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
                aria-label="Back to chats"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>
            <div class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[rgb(var(--color-lavender-rgb))] flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 md:w-5 md:h-5 text-white dark:text-[rgb(var(--color-crust-rgb))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path d="m21.8 14.9-6-10.4a2.1 2.1 0 0 0-3.6 0l-6 10.4a2.1 2.1 0 0 0 1.8 3.1h12a2.1 2.1 0 0 0 1.8-3.1Z"/>
                    <path d="M12 14v8"/>
                    <path d="m9 17 3-3 3 3"/>
                </svg>
            </div>
            <span class="font-bold dark:text-white text-start truncate min-w-0">
                {$t('chats.archived')}
            </span>
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-[calc(5rem+env(safe-area-inset-top))] custom-scrollbar">
        {#if loading}
            <div class="flex justify-center mt-10">
                <div class="text-sm text-gray-500 dark:text-slate-400">Loading...</div>
            </div>
        {:else if archivedChats.length === 0}
            <div class="flex justify-center mt-10">
                <div class="max-w-sm px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/70 shadow-md {blur('xl')} text-center space-y-1">
                    <div class="typ-meta font-semibold uppercase text-gray-500 dark:text-slate-400">
                        {$t('chats.emptyArchive')}
                    </div>
                </div>
            </div>
        {:else}
            <div class="space-y-1">
                {#each archivedChats as chat}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onclick={() => selectChat(chat.id)}
                        oncontextmenu={(e) => handleContextMenu(e, chat.id)}
                        onmousedown={(e) => handleMouseDown(e, chat.id)}
                        onmouseup={handleMouseUp}
                        onmouseleave={handleMouseUp}
                        class="p-3 mx-2 my-1.5 rounded-full cursor-pointer flex items-center gap-3 transition-all duration-200 ease-out group active:scale-[0.98] bg-transparent text-gray-700 dark:text-gray-400 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] hover:text-gray-900 dark:hover:text-white"
                    >
                        <div class="relative shrink-0">
                            {#if chat.isGroup}
                                <GroupAvatar
                                    participants={chat.participants || []}
                                    size="md"
                                    class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
                                />
                            {:else}
                                <Avatar
                                    npub={chat.id}
                                    src={chat.picture}
                                    size="md"
                                    class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
                                />
                            {/if}
                            {#if chat.hasUnread}
                                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[rgb(var(--color-base-rgb))]"></div>
                            {/if}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1 min-w-0">
                                <span class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]">
                                    {chat.name}
                                </span>
                                {#if chat.isGroup}
                                    <svg class="shrink-0 text-gray-600 dark:text-slate-300" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                {/if}
                                {#if chat.lastMessageTime > 0}
                                    <span class="ms-auto text-xs text-gray-500 dark:text-slate-400 shrink-0" title={new Date(chat.lastMessageTime).toLocaleString()}>
                                        {getRelativeTime(chat.lastMessageTime, currentTime)}
                                    </span>
                                {/if}
                                <button
                                    type="button"
                                    class="hidden md:inline-flex py-1 pe-0 ps-px rounded-s hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors opacity-0 group-hover:opacity-100"
                                    onclick={(e) => handleDotClick(e, chat.id)}
                                    aria-label="Chat options"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="12" cy="5" r="2"/>
                                        <circle cx="12" cy="12" r="2"/>
                                        <circle cx="12" cy="19" r="2"/>
                                    </svg>
                                </button>
                            </div>
                            {#if chat.lastMessageText}
                                <div class="typ-body text-gray-800 dark:text-slate-300 truncate">
                                    {chat.lastMessageText}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<ChatContextMenu
    isOpen={contextMenu.isOpen}
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={closeContextMenu}
    onArchive={handleUnarchive}
    isArchived={true}
/>
