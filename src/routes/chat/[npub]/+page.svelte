<script lang="ts">
    import ChatView from '$lib/components/ChatView.svelte';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { currentUser, signer } from '$lib/stores/auth';
    import { clearActiveConversation, setActiveConversation } from '$lib/stores/unreadMessages';
    import { onMount, tick } from 'svelte';
    import type { Message } from '$lib/db/db';
    import { messagingService } from '$lib/core/Messaging';
     import { page } from '$app/state';
     import { contactRepo } from '$lib/db/ContactRepository';
     import { consumePendingAndroidMediaShare, consumePendingAndroidTextShare } from '$lib/stores/androidShare';
     import { isAndroidNative } from '$lib/core/NativeDialogs';
     
     const PAGE_SIZE = 50;


     let messages = $state<Message[]>([]);
      let currentPartner = $derived(page.params.npub);
      let isFetchingHistory = $state(false);

      $effect(() => {
          const partner = currentPartner;
          if (!partner || partner === 'ALL') {
              clearActiveConversation();
              return;
          }

          setActiveConversation(partner);
          return () => {
              clearActiveConversation();
          };
      });

     let initialSharedMedia = $state<{ file: File; mediaType: 'image' | 'video' | 'audio' } | null>(null);
     let initialSharedText = $state<string | null>(null);

    let oldestLoadedTimestamp = $state<number | null>(null);
    let cacheExhausted = $state(false);
    let networkHistoryStatus = $state<'idle' | 'loading' | 'no-more' | 'error'>('idle');
    let networkHistorySummary = $state<{ eventsFetched: number; messagesSaved: number; messagesForChat: number } | null>(null);
    let lastPartner: string | null = null;
    let initialLoadDone = false;

    const canRequestNetworkHistory = $derived(
        cacheExhausted && networkHistoryStatus !== 'no-more' && networkHistoryStatus !== 'loading'
    );

    async function handleLoadMore() {
        const partner = currentPartner;
        if (!partner || messages.length === 0 || isFetchingHistory || cacheExhausted) {
            return;
        }

        const oldest = messages[0];
        if (!oldest) return;

        isFetchingHistory = true;
        try {
            // Step 1: page older messages from local cache only
            const localOlder = await messageRepo.getConversationPage(partner, PAGE_SIZE, oldest.sentAt);

            if (localOlder.length > 0) {
                messages = [...localOlder, ...messages];
                oldestLoadedTimestamp = messages[0].sentAt;

                // If we received fewer than a full page, there may be no more cached history
                if (localOlder.length < PAGE_SIZE) {
                    cacheExhausted = true;
                }
            } else {
                // No more cached history for this conversation
                cacheExhausted = true;
            }
        } catch (e) {
            console.error('Failed to fetch older messages from cache:', e);
        } finally {
            isFetchingHistory = false;
        }
    }

    async function handleRequestNetworkHistory() {
        const partner = currentPartner;
        if (!partner || messages.length === 0 || !canRequestNetworkHistory) {
            return;
        }

        const oldest = messages[0];
        if (!oldest) return;

        isFetchingHistory = true;
        networkHistoryStatus = 'loading';

        try {
            const result = await messagingService.fetchOlderMessages(
                Math.floor(oldest.sentAt / 1000),
                { targetChatNpub: partner }
            );

            networkHistorySummary = {
                eventsFetched: result.totalFetched,
                messagesSaved: result.messagesSaved ?? 0,
                messagesForChat: result.messagesSavedForChat ?? 0,
            };

            if ('reason' in result && result.reason === 'no-connected-relays') {
                networkHistoryStatus = 'error';
                return;
            }

            if (result.totalFetched === 0) {
                // No more messages available from relays (global)
                networkHistoryStatus = 'no-more';
                return;
            }

            // We fetched something from relays; only re-enable cache paging if we actually got
            // new messages for this chat.
            networkHistoryStatus = 'idle';
            cacheExhausted = (result.messagesSavedForChat ?? 0) === 0;

        } catch (e) {
            console.error('Failed to fetch older messages from relays:', e);
            networkHistoryStatus = 'error';
        } finally {
            isFetchingHistory = false;
        }
    }

    async function refreshMessagesForCurrentPartner() {
        const s = $signer;
        const partner = currentPartner;
        if (!s || !partner) return;

        const isNewPartner = lastPartner !== partner;
        if (isNewPartner) {
            oldestLoadedTimestamp = null;
            cacheExhausted = false;
            networkHistoryStatus = 'idle';
            networkHistorySummary = null;
            lastPartner = partner;
        }

        const msgs = await messageRepo.getAllMessagesFor(partner);
        const filtered =
            partner === 'ALL'
                ? msgs
                : msgs.filter((m) => m.recipientNpub === partner);

        if (filtered.length === 0) {
            messages = [];
            oldestLoadedTimestamp = null;
            cacheExhausted = false;
        } else {
            if (oldestLoadedTimestamp === null || isNewPartner) {
                const startIndex = Math.max(0, filtered.length - PAGE_SIZE);
                messages = filtered.slice(startIndex);
                oldestLoadedTimestamp = messages[0].sentAt;
            } else {
                const startIndex = filtered.findIndex((m) => m.sentAt === oldestLoadedTimestamp);
                const fromIndex = startIndex >= 0 ? startIndex : Math.max(0, filtered.length - PAGE_SIZE);
                messages = filtered.slice(fromIndex);
                oldestLoadedTimestamp = messages[0].sentAt;
            }
        }

        // Ensure Svelte flushes async state updates promptly (notably on desktop Chrome)
        await tick();

        if (partner && partner !== 'ALL') {
            contactRepo.markAsRead(partner).catch(console.error);
        }
     }


    // Effect to update messages when partner or signer changes
     $effect(() => {
         const s = $signer;
         const partner = currentPartner;
         if (!s || !partner) return;

         // Only refresh if partner actually changed or this is the initial load
         if (initialLoadDone && partner === lastPartner) {
             return;
         }

         refreshMessagesForCurrentPartner();
         initialLoadDone = true;
     });

     // Consume any pending Android inbound share after contact selection
     $effect(() => {
         const partner = currentPartner;
         if (!partner || !isAndroidNative()) {
             return;
         }

         const media = consumePendingAndroidMediaShare();
         const text = consumePendingAndroidTextShare();

         initialSharedMedia = media ? { file: media.file, mediaType: media.mediaType } : null;
         initialSharedText = text ? text.text : null;
     });


    onMount(() => {
        const handleNewMessage = async (event: Event) => {
            const custom = event as CustomEvent<{ recipientNpub?: string; eventId?: string }>;
            const partner = currentPartner;
            if (!partner) return;

            const { recipientNpub, eventId } = custom.detail || {};

            // For ALL view, always do full refresh
            if (partner === 'ALL') {
                refreshMessagesForCurrentPartner();
                return;
            }

            // Only handle messages for current partner
            if (recipientNpub !== partner) {
                return;
            }

            // If no eventId, fall back to full refresh
            if (!eventId) {
                refreshMessagesForCurrentPartner();
                return;
            }

            // Check if message is already displayed
            if (messages.some(m => m.eventId === eventId)) {
                return;
            }

            // Fetch just the new message
            const newMessage = await messageRepo.getMessageByEventId(eventId);
            if (!newMessage || newMessage.recipientNpub !== partner) {
                return;
            }

            // If message is older than our loaded range, skip it (will be loaded on scroll up)
            if (oldestLoadedTimestamp !== null && newMessage.sentAt < oldestLoadedTimestamp) {
                // Re-enable cache paging since there are more messages
                cacheExhausted = false;
                return;
            }

            // Insert at correct position based on sentAt
            const insertIndex = messages.findIndex(m => m.sentAt > newMessage.sentAt);
            if (insertIndex === -1) {
                // New message is newest, append at end
                messages = [...messages, newMessage];
            } else {
                // Insert at correct position
                messages = [
                    ...messages.slice(0, insertIndex),
                    newMessage,
                    ...messages.slice(insertIndex)
                ];
            }

            // Keep lastReadAt in sync for received messages while viewing
            if (newMessage.direction === 'received') {
                contactRepo.markAsRead(partner).catch(console.error);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('nospeak:new-message', handleNewMessage);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('nospeak:new-message', handleNewMessage);
            }
        };
    });
</script>

{#key currentPartner}
    <ChatView
         {messages}
         partnerNpub={currentPartner}
         onLoadMore={handleLoadMore}
         {isFetchingHistory}
          {canRequestNetworkHistory}
          onRequestNetworkHistory={handleRequestNetworkHistory}
          networkHistoryStatus={networkHistoryStatus}
          networkHistorySummary={networkHistorySummary}
          {initialSharedMedia}
         {initialSharedText}
     />
{/key}


