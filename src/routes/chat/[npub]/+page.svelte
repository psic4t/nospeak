<script lang="ts">
    import ChatView from '$lib/components/ChatView.svelte';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { currentUser, signer } from '$lib/stores/auth';
    import { clearActiveConversation, setActiveConversation } from '$lib/stores/unreadMessages';
    import { onMount, tick } from 'svelte';
    import type { Message, Conversation } from '$lib/db/db';
    import { messagingService } from '$lib/core/Messaging';
     import { page } from '$app/state';
     import { contactRepo } from '$lib/db/ContactRepository';
     import { conversationRepo, isGroupConversationId } from '$lib/db/ConversationRepository';
     import { consumePendingAndroidMediaShare, consumePendingAndroidTextShare } from '$lib/stores/androidShare';
     import { isAndroidNative } from '$lib/core/NativeDialogs';
     import { chatVisitRefreshService } from '$lib/core/ChatVisitRefreshService';
     
     const PAGE_SIZE = 50;


     let messages = $state<Message[]>([]);
      // The URL param is called 'npub' but can also be a group conversationId
      let conversationId = $derived(page.params.npub);
      // Optional highlight param from favorites navigation
      let highlightEventId = $derived(page.url?.searchParams?.get('highlight') ?? undefined);
      // Detect if this is a group conversation
      let isGroup = $derived(conversationId ? isGroupConversationId(conversationId) : false);
      // For backward compatibility, keep currentPartner for 1-on-1 chats
      let currentPartner = $derived(isGroup ? undefined : conversationId);
      // Group conversation metadata
      let groupConversation = $state<Conversation | null>(null);
      let isFetchingHistory = $state(false);
      
      // Load group conversation metadata when entering a group chat
      $effect(() => {
          const convId = conversationId;
          if (!convId || !isGroup) {
              groupConversation = null;
              return;
          }
          
          conversationRepo.getConversation(convId).then((conv) => {
              groupConversation = conv || null;
          });
      });

      $effect(() => {
          const convId = conversationId;
          if (!convId || convId === 'ALL') {
              clearActiveConversation();
              return;
          }

          setActiveConversation(convId);
          return () => {
              clearActiveConversation();
          };
      });

      // Refresh contact profile/relay data on chat visit
      $effect(() => {
          const convId = conversationId;
          const user = $currentUser;
          console.log(`[ChatVisitRefresh] $effect fired: convId=${convId}, user=${user?.npub?.slice(0, 12)}, isGroup=${isGroup}`);
          if (!convId || convId === 'ALL' || !user?.npub) return;

          if (isGroup) {
              // For groups, wait for groupConversation to be loaded
              const group = groupConversation;
              if (group?.participants) {
                  console.log(`[ChatVisitRefresh] Refreshing ${group.participants.length} group participants`);
                  void chatVisitRefreshService.refreshGroupParticipants(group.participants, user.npub);
              }
          } else {
              console.log(`[ChatVisitRefresh] Refreshing 1:1 contact: ${convId.slice(0, 12)}`);
              void chatVisitRefreshService.refreshContact(convId);
          }
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
        cacheExhausted && networkHistoryStatus !== 'no-more' && networkHistoryStatus !== 'loading' && !isGroup
    );

    async function handleLoadMore() {
        const convId = conversationId;
        if (!convId || messages.length === 0 || isFetchingHistory || cacheExhausted) {
            return;
        }

        const oldest = messages[0];
        if (!oldest) return;

        isFetchingHistory = true;
        try {
            // Step 1: page older messages from local cache only
            // Use conversationId-based query for both 1-on-1 and groups
            const localOlder = isGroup 
                ? await messageRepo.getMessagesByConversationId(convId, PAGE_SIZE, oldest.sentAt)
                : await messageRepo.getConversationPage(convId, PAGE_SIZE, oldest.sentAt);

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
        // Network history fetch is not available for group chats (yet)
        if (isGroup) return;
        
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

    async function refreshMessagesForCurrentConversation() {
        const s = $signer;
        const convId = conversationId;
        if (!s || !convId) return;

        const isNewConversation = lastPartner !== convId;
        if (isNewConversation) {
            oldestLoadedTimestamp = null;
            cacheExhausted = false;
            networkHistoryStatus = 'idle';
            networkHistorySummary = null;
            lastPartner = convId;
        }

        // For group chats, use conversationId-based query
        // For 1-on-1, use the original recipientNpub-based query for backward compatibility
        let msgs: Message[];
        if (isGroup) {
            msgs = await messageRepo.getAllMessagesByConversationId(convId);
        } else {
            msgs = await messageRepo.getAllMessagesFor(convId);
            // Filter to ensure we only get messages for this conversation
            msgs = convId === 'ALL' ? msgs : msgs.filter((m) => m.recipientNpub === convId);
        }

        if (msgs.length === 0) {
            messages = [];
            oldestLoadedTimestamp = null;
            cacheExhausted = false;
        } else {
            if (oldestLoadedTimestamp === null || isNewConversation) {
                // When navigating to a specific message (e.g. from favorites),
                // load from that message's position instead of the tail
                const hEventId = highlightEventId;
                const highlightIndex = hEventId
                    ? msgs.findIndex((m) => m.eventId === hEventId)
                    : -1;

                let startIndex: number;
                if (highlightIndex >= 0) {
                    // Load a window around the highlighted message
                    const halfPage = Math.floor(PAGE_SIZE / 2);
                    startIndex = Math.max(0, highlightIndex - halfPage);
                } else {
                    startIndex = Math.max(0, msgs.length - PAGE_SIZE);
                }
                messages = msgs.slice(startIndex);
                oldestLoadedTimestamp = messages[0].sentAt;
            } else {
                const startIndex = msgs.findIndex((m) => m.sentAt === oldestLoadedTimestamp);
                const fromIndex = startIndex >= 0 ? startIndex : Math.max(0, msgs.length - PAGE_SIZE);
                messages = msgs.slice(fromIndex);
                oldestLoadedTimestamp = messages[0].sentAt;
            }
        }

        // Ensure Svelte flushes async state updates promptly (notably on desktop Chrome)
        await tick();

        // Mark as read
        if (convId && convId !== 'ALL') {
            if (isGroup) {
                // Mark group conversation as read
                conversationRepo.markAsRead(convId).catch(console.error);
            } else {
                contactRepo.markAsRead(convId).catch(console.error);
            }
        }
     }


    // Effect to update messages when conversation or signer changes
     $effect(() => {
         const s = $signer;
         const convId = conversationId;
         if (!s || !convId) return;

         // Only refresh if conversation actually changed or this is the initial load
         if (initialLoadDone && convId === lastPartner) {
             return;
         }

         refreshMessagesForCurrentConversation();
         initialLoadDone = true;
     });

    // Consume any pending Android inbound share after contact selection
    $effect(() => {
        const convId = conversationId;
        if (!convId || !isAndroidNative()) {
            return;
        }

        const media = consumePendingAndroidMediaShare();
        const text = consumePendingAndroidTextShare();

        initialSharedMedia = media ? { file: media.file, mediaType: media.mediaType } : null;
        initialSharedText = text ? text.text : null;
    });


    onMount(() => {
        const handleNewMessage = async (event: Event) => {
            const custom = event as CustomEvent<{ recipientNpub?: string; conversationId?: string; eventId?: string }>;
            const convId = conversationId;
            if (!convId) return;

            const { recipientNpub, conversationId: msgConvId, eventId } = custom.detail || {};

            // For ALL view, always do full refresh
            if (convId === 'ALL') {
                refreshMessagesForCurrentConversation();
                return;
            }

            // For group chats, check conversationId; for 1-on-1, check recipientNpub
            const matchesConversation = isGroup 
                ? msgConvId === convId 
                : recipientNpub === convId;
            
            if (!matchesConversation) {
                return;
            }

            // If no eventId, fall back to full refresh
            if (!eventId) {
                refreshMessagesForCurrentConversation();
                return;
            }

            // Check if message is already displayed
            if (messages.some(m => m.eventId === eventId)) {
                return;
            }

            // Fetch just the new message
            const newMessage = await messageRepo.getMessageByEventId(eventId);
            if (!newMessage) {
                return;
            }
            
            // Verify message belongs to this conversation
            const messageBelongsHere = isGroup 
                ? newMessage.conversationId === convId
                : newMessage.recipientNpub === convId;
            if (!messageBelongsHere) {
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
                if (isGroup) {
                    conversationRepo.markAsRead(convId).catch(console.error);
                } else {
                    contactRepo.markAsRead(convId).catch(console.error);
                }
            }
        };

        // Listen for conversation updates (e.g., subject changes from incoming messages)
        const handleConversationUpdated = async (event: Event) => {
            const custom = event as CustomEvent<{ conversationId?: string; subject?: string }>;
            const convId = conversationId;
            const { conversationId: updatedId } = custom.detail || {};
            
            // Refresh groupConversation if this is the active group chat
            if (convId && updatedId === convId && isGroup) {
                const updated = await conversationRepo.getConversation(convId);
                if (updated) {
                    groupConversation = updated;
                }
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('nospeak:new-message', handleNewMessage);
            window.addEventListener('nospeak:conversation-updated', handleConversationUpdated);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('nospeak:new-message', handleNewMessage);
                window.removeEventListener('nospeak:conversation-updated', handleConversationUpdated);
            }
        };
    });
</script>

{#key conversationId}
    <ChatView
         {messages}
         partnerNpub={currentPartner}
         {isGroup}
         {groupConversation}
         onLoadMore={handleLoadMore}
         {isFetchingHistory}
          {canRequestNetworkHistory}
          onRequestNetworkHistory={handleRequestNetworkHistory}
          networkHistoryStatus={networkHistoryStatus}
          networkHistorySummary={networkHistorySummary}
           {initialSharedMedia}
         {initialSharedText}
         {highlightEventId}
     />
{/key}


