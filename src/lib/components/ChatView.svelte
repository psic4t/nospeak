<script lang="ts">
  import type { Message, Conversation } from "$lib/db/db";
  import { messageRepo } from "$lib/db/MessageRepository";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import { messagingService } from "$lib/core/Messaging";
  import { ensureDefaultBlossomServersForCurrentUser } from "$lib/core/DefaultBlossomServers";
  import { getImageMetadata, getVideoMetadata } from "$lib/utils/mediaMetadata";
  import { runtimeConfig } from "$lib/core/runtimeConfig";
  import Avatar from "./Avatar.svelte";
  import GroupAvatar from "./GroupAvatar.svelte";
  import GroupMembersModal from "./GroupMembersModal.svelte";
  import EditGroupNameModal from "./EditGroupNameModal.svelte";
  import { conversationRepo } from "$lib/db/ConversationRepository";
  import MessageContent from "./MessageContent.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import MediaUploadButton from "./MediaUploadButton.svelte";
  import AttachmentPreviewModal from "./AttachmentPreviewModal.svelte";
  import VoiceMessageSheet from "./VoiceMessageSheet.svelte";
  import { currentUser } from "$lib/stores/auth";
  import { clearChatUnread, getUnreadSnapshot, isActivelyViewingConversation } from "$lib/stores/unreadMessages";
  import { emojis } from "$lib/utils/emojis";
  import { goto } from '$app/navigation';
  import { hapticLightImpact, hapticSelection } from '$lib/utils/haptics';
  import { tapSoundClick } from '$lib/utils/tapSound';
  import { copyTextToClipboard } from '$lib/utils/clipboard';
  import { isAndroidCapacitorShell, blur } from '$lib/utils/platform';
  import { overscroll } from '$lib/utils/overscroll';
  import { lastRelaySendStatus, clearRelayStatus } from '$lib/stores/sending';
  import { openProfileModal } from '$lib/stores/modals';
  import { openImageViewer } from '$lib/stores/imageViewer';
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { nativeDialogService, isAndroidNative, isMobileWeb } from '$lib/core/NativeDialogs';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import { buildChatHistorySearchResults } from '$lib/core/chatHistorySearch';
  import { getRelativeTime as getRelativeTimeUtil } from '$lib/utils/time';
  import { getCurrentPosition } from '$lib/core/LocationService';
  import { isVoiceRecordingSupported } from '$lib/core/VoiceRecorder';
  import { generateGroupTitle } from '$lib/db/ConversationRepository';
  import Button from '$lib/components/ui/Button.svelte';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import CircularProgress from '$lib/components/ui/CircularProgress.svelte';

   let {
     messages = [],
     partnerNpub,
     isGroup = false,
     groupConversation = null,
     onLoadMore,
     isFetchingHistory = false,
      canRequestNetworkHistory = false,
      onRequestNetworkHistory,
      networkHistoryStatus = 'idle',
      networkHistorySummary = null,
      initialSharedMedia = null,
      initialSharedText = null
   } = $props<{
     messages: Message[];
     partnerNpub?: string;
     isGroup?: boolean;
     groupConversation?: Conversation | null;
     onLoadMore?: () => void;
     isFetchingHistory?: boolean;
     canRequestNetworkHistory?: boolean;
     onRequestNetworkHistory?: () => void;
      networkHistoryStatus?: 'idle' | 'loading' | 'no-more' | 'error';
      networkHistorySummary?: { eventsFetched: number; messagesSaved: number; messagesForChat: number } | null;
      initialSharedMedia?: { file: File; mediaType: 'image' | 'video' | 'audio' } | null;
      initialSharedText?: string | null;
   }>();
   
   // Group chat display state
   let groupTitle = $state<string>('');
   let showMembersModal = $state(false);
   let showEditNameModal = $state(false);
   let pendingGroupSubject = $state<string | null>(null);
   let showNameSavedToast = $state(false);
   let nameSavedToastTimeout: ReturnType<typeof setTimeout> | null = null;
   // Cache participant profiles: { name, picture }
   let participantProfiles = $state<Map<string, { name: string; picture?: string }>>(new Map());
   
   // Load group title and participant profiles
   $effect(() => {
       if (!isGroup || !groupConversation) {
           groupTitle = '';
           return;
       }
       
       // Use subject if available, otherwise generate from participant names
       if (groupConversation.subject) {
           groupTitle = groupConversation.subject;
       } else {
           // Generate title from participant names
           void (async () => {
               const names = await Promise.all(
                   groupConversation.participants
                       .filter((p: string) => p !== $currentUser?.npub)
                       .slice(0, 5)
                       .map(async (npub: string) => {
                           const profile = await profileRepo.getProfileIgnoreTTL(npub);
                           const name = profile?.metadata?.name || 
                                        profile?.metadata?.display_name || 
                                        npub.slice(0, 8) + '...';
                           const picture = profile?.metadata?.picture;
                           participantProfiles.set(npub, { name, picture });
                           return name;
                       })
               );
               groupTitle = generateGroupTitle(names);
               participantProfiles = new Map(participantProfiles);
           })();
       }
   });
   
   // Helper to get participant name from cache or npub
   function getParticipantName(npub: string): string {
       return participantProfiles.get(npub)?.name || npub.slice(0, 8) + '...';
   }
   
   // Helper to get participant picture from cache
   function getParticipantPicture(npub: string): string | undefined {
       return participantProfiles.get(npub)?.picture;
   }
   
   // Load participant profile on demand (for message sender attribution)
   async function loadParticipantProfile(npub: string): Promise<{ name: string; picture?: string }> {
       if (participantProfiles.has(npub)) {
           return participantProfiles.get(npub)!;
       }
       const profile = await profileRepo.getProfileIgnoreTTL(npub);
       const name = profile?.metadata?.name || 
                    profile?.metadata?.display_name || 
                    npub.slice(0, 8) + '...';
       const picture = profile?.metadata?.picture;
       const profileData = { name, picture };
       participantProfiles.set(npub, profileData);
       participantProfiles = new Map(participantProfiles);
       return profileData;
   }
   
   // Load profiles for all message senders in view
   $effect(() => {
       if (!isGroup || !messages.length) return;
       
       // Collect unique sender npubs that we don't have profiles for
       const unknownSenders = new Set<string>();
       for (const msg of messages) {
           if (msg.senderNpub && !participantProfiles.has(msg.senderNpub)) {
               unknownSenders.add(msg.senderNpub);
           }
       }
       
        // Load profiles for unknown senders
        if (unknownSenders.size > 0) {
            void (async () => {
                for (const npub of unknownSenders) {
                    await loadParticipantProfile(npub);
                }
            })();
        }
    });

    // Handle saving group name
    async function handleSaveGroupName(newName: string): Promise<void> {
        if (!groupConversation) return;
        
        // Clear any existing toast timeout
        if (nameSavedToastTimeout) {
            clearTimeout(nameSavedToastTimeout);
            nameSavedToastTimeout = null;
        }
        
        if (newName === '') {
            // Clear subject - revert to auto-generated name
            await conversationRepo.updateSubject(groupConversation.id, '');
            pendingGroupSubject = ''; // Empty string signals to clear subject in next message
            // Regenerate title from participant names
            const names = await Promise.all(
                groupConversation.participants
                    .filter((p: string) => p !== $currentUser?.npub)
                    .slice(0, 5)
                    .map(async (npub: string) => {
                        const profile = await profileRepo.getProfileIgnoreTTL(npub);
                        return profile?.metadata?.name || 
                               profile?.metadata?.display_name || 
                               npub.slice(0, 8) + '...';
                    })
            );
            groupTitle = generateGroupTitle(names);
        } else {
            // Set new subject
            await conversationRepo.updateSubject(groupConversation.id, newName);
            pendingGroupSubject = newName;
            groupTitle = newName;
        }
        
        // Show toast
        showNameSavedToast = true;
        nameSavedToastTimeout = setTimeout(() => {
            showNameSavedToast = false;
            nameSavedToastTimeout = null;
        }, 4000);
    }
 
    let inputText = $state("");

  // Chat history search
  let isSearchOpen = $state(false);
  let searchQuery = $state("");
  let searchInputElement = $state<HTMLInputElement | null>(null);
  let searchResults = $state<Message[]>([]);
  let isSearchingHistory = $state(false);
  let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
  let searchToken = 0;
  let isSearchActive = $derived(searchQuery.trim().length >= 3);

  function cancelPendingSearch() {
    searchToken += 1;
    isSearchingHistory = false;

    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
      searchDebounceId = null;
    }
  }

  function closeSearch() {
    cancelPendingSearch();
    isSearchOpen = false;
    searchQuery = "";
    searchResults = [];
  }

  function openSearch() {
    isSearchOpen = true;
    setTimeout(() => {
      searchInputElement?.focus();
    }, 0);
  }

  function toggleSearch() {
    if (isSearchOpen) {
      closeSearch();
      return;
    }

    openSearch();
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
      return;
    }

    e.preventDefault();
    hapticSelection();
    closeSearch();
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightPlainTextToHtml(text: string, query: string): string {
    const needle = query.trim();
    if (!needle) {
      return escapeHtml(text);
    }

    const regex = new RegExp(escapeRegExp(needle), 'gi');
    const markClass = 'bg-yellow-200/70 dark:bg-yellow-400/20 rounded px-0.5';

    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      result += escapeHtml(text.slice(lastIndex, start));
      result += `<mark class="${markClass}">${escapeHtml(text.slice(start, end))}</mark>`;

      lastIndex = end;
    }

    result += escapeHtml(text.slice(lastIndex));
    return result;
  }

  // Reset search when switching conversations
  $effect(() => {
    partnerNpub;
    closeSearch();
  });

  // Debounced IndexedDB filtering
  $effect(() => {
    const partner = partnerNpub;
    const query = searchQuery.trim();
    messages.length;

    if (typeof window === 'undefined') {
      return;
    }

    if (!partner || partner === 'ALL' || query.length < 3) {
      cancelPendingSearch();
      searchResults = [];
      return;
    }

    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
      searchDebounceId = null;
    }

    const currentToken = ++searchToken;
    isSearchingHistory = true;

    searchDebounceId = setTimeout(() => {
      void (async () => {
        try {
          const allMessages = await messageRepo.getAllMessagesFor(partner);

          if (currentToken !== searchToken) {
            return;
          }

          searchResults = buildChatHistorySearchResults(allMessages, query);
        } catch (e) {
          console.error('Chat history search failed:', e);
          if (currentToken === searchToken) {
            searchResults = [];
          }
        } finally {
          if (currentToken === searchToken) {
            isSearchingHistory = false;
          }
        }
      })();
    }, 250);
  });

  let partnerName = $state("");
  let partnerPicture = $state<string | undefined>(undefined);
  let myPicture = $state<string | undefined>(undefined);
  let isSending = $state(false);
  let optimisticMessages = $state<Message[]>([]);
  let displayMessages = $derived(
    isSearchActive ? searchResults : [...messages, ...optimisticMessages],
  );
  let isDestroyed = false;

  function revokeOptimisticResources(msg: Message) {
    if (typeof window === 'undefined') {
      return;
    }

    if (msg.fileUrl && msg.fileUrl.startsWith('blob:')) {
      URL.revokeObjectURL(msg.fileUrl);
    }
  }

  function makeOptimisticEventId(): string {
    return `optimistic:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }

  function isPersistedMatch(optimistic: Message, persisted: Message): boolean {
    if (persisted.direction !== 'sent') return false;
    if ((persisted.rumorKind || 14) !== (optimistic.rumorKind || 14)) return false;
    if (persisted.sentAt !== optimistic.sentAt) return false;

    // For group messages, match on conversationId instead of recipientNpub
    if (optimistic.conversationId && persisted.conversationId) {
      if (persisted.conversationId !== optimistic.conversationId) return false;
    } else {
      // For 1-on-1 messages, match on recipientNpub
      if (persisted.recipientNpub !== optimistic.recipientNpub) return false;
    }

    if ((optimistic.rumorKind || 14) === 14) {
      return persisted.message === optimistic.message;
    }

    // Kind 15: attachment placeholder
    return (persisted.fileType || '') === (optimistic.fileType || '');
  }

  $effect(() => {
    const persistedMessages: Message[] = messages;
    if (optimisticMessages.length === 0) {
      return;
    }

    const remaining: Message[] = [];
    for (const optimistic of optimisticMessages) {
      const hasPersisted = persistedMessages.some((m: Message) => isPersistedMatch(optimistic, m));
      if (hasPersisted) {
        revokeOptimisticResources(optimistic);
      } else {
        remaining.push(optimistic);
      }
    }

    if (remaining.length !== optimisticMessages.length) {
      optimisticMessages = remaining;
    }
  });

   onDestroy(() => {
     isDestroyed = true;
     cancelPendingSearch();
     for (const optimistic of optimisticMessages) {
       revokeOptimisticResources(optimistic);
     }
   });

  let chatRoot: HTMLElement;
  let chatContainer: HTMLElement;
  let inputElement: HTMLTextAreaElement;
  let currentTime = $state(Date.now());
   let relayStatusTimeout: number | null = null;
   
    let previousScrollHeight = 0;
    let isLoadingMore = false;

    let unreadSnapshotMessageIds = $state<string[]>([]);
    let activeHighlightMessageIds = $state<string[]>([]);
    let unreadSnapshotMessageSet = $derived(new Set(unreadSnapshotMessageIds));
    let activeHighlightMessageSet = $derived(new Set(activeHighlightMessageIds));


    function clearEphemeralHighlights() {
      activeHighlightMessageIds = [];
    }

    function clearUnreadMarkersForChat() {
      if (!$currentUser) return;
      
      // Use conversationId for groups, partnerNpub for 1-on-1
      const chatKey = isGroup ? groupConversation?.id : partnerNpub;
      if (!chatKey) return;

      clearChatUnread($currentUser.npub, chatKey);
      unreadSnapshotMessageIds = [];
      clearEphemeralHighlights();
    }

    $effect(() => {
      const user = $currentUser;
      // Use conversationId for groups, partnerNpub for 1-on-1
      const chatKey = isGroup ? groupConversation?.id : partnerNpub;
      if (!user || !chatKey) {
        unreadSnapshotMessageIds = [];
        clearEphemeralHighlights();
        return;
      }

      const snapshot = getUnreadSnapshot(user.npub, chatKey);
      unreadSnapshotMessageIds = Array.from(snapshot.messages);
      clearEphemeralHighlights();

      clearChatUnread(user.npub, chatKey);
    });

    onMount(() => {
      const handleBlur = () => {
        clearEphemeralHighlights();
      };

      const handleFocus = () => {
        // Clear unread state when window regains focus while viewing a chat
        // This handles the case where messages arrive while the window is in background
        if (!$currentUser) return;
        const chatKey = isGroup ? groupConversation?.id : partnerNpub;
        if (chatKey) {
          clearChatUnread($currentUser.npub, chatKey);
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Clear unread state when app becomes visible while viewing a chat
          // This handles the case where messages arrive while the window is minimized
          if (!$currentUser) return;
          const chatKey = isGroup ? groupConversation?.id : partnerNpub;
          if (chatKey) {
            clearChatUnread($currentUser.npub, chatKey);
          }
        } else {
          clearEphemeralHighlights();
        }
      };

      const handleNewMessage = (event: Event) => {
        const partner = partnerNpub;
        if (!partner) {
          return;
        }

        const custom = event as CustomEvent<{ recipientNpub?: string; direction?: string; eventId?: string }>;
        const { recipientNpub, direction, eventId } = custom.detail || {};

        if (direction !== 'received' || !eventId || recipientNpub !== partner) {
          return;
        }

        if (!isActivelyViewingConversation(partner)) {
          return;
        }

        if (!activeHighlightMessageIds.includes(eventId)) {
          activeHighlightMessageIds = [...activeHighlightMessageIds, eventId];
        }
      };

      const handleProfilesUpdated = () => {
        fetchPartnerProfile();
      };

      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('nospeak:new-message', handleNewMessage);
      window.addEventListener('nospeak:profiles-updated', handleProfilesUpdated);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('nospeak:new-message', handleNewMessage);
        window.removeEventListener('nospeak:profiles-updated', handleProfilesUpdated);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    });
    
    // Single-file media preview state
  let showMediaPreview = $state(false);
  let pendingMediaFile = $state<File | null>(null);
  let pendingMediaType = $state<'image' | 'video' | 'audio' | 'file' | null>(null);
  let pendingMediaObjectUrl = $state<string | null>(null);
  let pendingMediaCaption = $state("");
  let pendingMediaError = $state<string | null>(null);
  let pendingMediaServersHint = $state<string | null>(null);
  let isEnsuringMediaServers = $state(false);

  let showLocationPreview = $state(false);
  let pendingLocation = $state<{ latitude: number; longitude: number } | null>(null);

  let showVoiceSheet = $state(false);


  // Context menu state
  let contextMenu = $state({
    isOpen: false,
    x: 0,
    y: 0,
    message: null as Message | null,
  });
  let longPressTimer: number | null = null;
  const isAndroidShell = isAndroidCapacitorShell();
  const useFullWidthBubbles = isAndroidShell || isMobileWeb();
  const useSmallAvatars = useFullWidthBubbles;
 
  // Emoji picker state
  let showEmojiPicker = $state(false);
  let emojiSearch = $state("");
  let emojiSelectedIndex = $state(0);
  let filteredEmojis = $derived(
    emojiSearch
      ? emojis
          .filter((e) =>
            e.name.toLowerCase().includes(emojiSearch.toLowerCase()),
          )
          .slice(0, 5)
      : [],
  );


  function handleInput(e: Event) {
    const input = e.target as HTMLTextAreaElement;

    // Auto-resize
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";

    const cursorPosition = input.selectionStart || 0;
    const textBeforeCursor = inputText.slice(0, cursorPosition);

    // Find the last word segment before cursor
    const match = textBeforeCursor.match(/:(\w*)$/);

    if (match) {
      showEmojiPicker = true;
      emojiSearch = match[1];
      emojiSelectedIndex = 0;
    } else {
      showEmojiPicker = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showEmojiPicker && filteredEmojis.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        emojiSelectedIndex =
          (emojiSelectedIndex - 1 + filteredEmojis.length) %
          filteredEmojis.length;
        return;
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        emojiSelectedIndex = (emojiSelectedIndex + 1) % filteredEmojis.length;
        return;
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectEmoji(filteredEmojis[emojiSelectedIndex]);
        return;
      } else if (e.key === "Escape") {
        showEmojiPicker = false;
        return;
      }
    }

    // Send on Ctrl+Enter or Cmd+Enter (desktop)
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  function selectEmoji(emoji: { name: string; char: string }) {
    if (!inputElement) return;

    const cursorPosition = inputElement.selectionStart || 0;
    const textBeforeCursor = inputText.slice(0, cursorPosition);
    const textAfterCursor = inputText.slice(cursorPosition);

    // Replace the :search part with the emoji
    const match = textBeforeCursor.match(/:(\w*)$/);
    if (match) {
      const prefix = textBeforeCursor.slice(0, match.index);
      inputText = prefix + emoji.char + " " + textAfterCursor;

      // Restore focus and cursor position
      setTimeout(() => {
        const newCursorPos = prefix.length + emoji.char.length + 1;
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
        inputElement.focus();
      }, 0);
    }

    showEmojiPicker = false;
  }

  function openProfile(npub: string) {
    openProfileModal(npub);
  }

  // Resolve profile info
  function fetchPartnerProfile() {
    if (partnerNpub) {
      profileRepo.getProfileIgnoreTTL(partnerNpub).then((p) => {
        if (p && p.metadata) {
          partnerName =
            p.metadata.name ||
            p.metadata.display_name ||
            p.metadata.displayName;
          partnerPicture = p.metadata.picture;
        }
      });
    }
  }

  $effect(() => {
    partnerNpub;
    fetchPartnerProfile();
  });

  // Fetch current user's profile picture
  $effect(() => {
    if ($currentUser) {
      profileRepo.getProfileIgnoreTTL($currentUser.npub).then((p) => {
        if (p && p.metadata) {
          myPicture = p.metadata.picture;
        }
      });
    }
  });

  function getLastSentIndex(list: Message[]): number {
    let index = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].direction === "sent") {
        index = i;
      }
    }
    return index;
  }

  // Auto-clear relay status after a short time
  $effect(() => {
    const status = $lastRelaySendStatus;
    if (!status) {
      return;
    }

    if (relayStatusTimeout) {
      clearTimeout(relayStatusTimeout);
      relayStatusTimeout = null;
    }

    relayStatusTimeout = window.setTimeout(() => {
      clearRelayStatus();
      relayStatusTimeout = null;
    }, 8000);

    return () => {
      if (relayStatusTimeout) {
        clearTimeout(relayStatusTimeout);
        relayStatusTimeout = null;
      }
    };
  });

  // Clear relay status when switching conversations
  $effect(() => {
    partnerNpub;
    groupConversation?.id;
    clearRelayStatus();
  });

   // Auto-scroll to bottom on new messages or conversation change
   $effect(() => {
     // Dependencies to trigger scroll
     partnerNpub;
     displayMessages.length;
     isSearchActive;

     if (isSearchActive) {
       return;
     }

     if (!isLoadingMore) {
         scrollToBottom();
    } else if (chatContainer) {
        // Restore scroll position when loading more
        // Use timeout to ensure DOM has updated height
        setTimeout(() => {
            const heightDiff = chatContainer.scrollHeight - previousScrollHeight;
            if (heightDiff > 0) {
                chatContainer.scrollTop = heightDiff;
            }
            isLoadingMore = false;
        }, 0);
    }
  });

   function handleScroll() {
       if (isSearchActive) return;
       if (!chatContainer) return;
      if (chatContainer.scrollTop < 50 && onLoadMore && !isLoadingMore && displayMessages.length > 0) {
          isLoadingMore = true;
          previousScrollHeight = chatContainer.scrollHeight;
          onLoadMore();
      }
  }

  function isPageKey(key: string): boolean {
    return key === 'PageDown' || key === 'PageUp' || key === 'End' || key === 'Home';
  }

  function activateMessageWindow(e: PointerEvent) {
    if (!chatContainer) return;

    // Android WebView shows a default (often orange) focus outline when a non-input
    // container is focused. Desktop needs this for PageUp/PageDown scrolling.
    if (isAndroidShell) return;

    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    if (target.closest('a, button, input, textarea, select, [role="button"], [role="menuitem"], [contenteditable="true"]')) {
      return;
    }

    chatContainer.focus({ preventScroll: true });
  }

  function handlePageKeyScroll(e: KeyboardEvent) {
      if (typeof window === 'undefined') return;
      if (!chatContainer) return;

      // Desktop-only: wide screens, exclude Android native shell
      if (window.innerWidth <= 768 || isAndroidNative()) {
          return;
      }

      const pageAmount = chatContainer.clientHeight * 0.9;

      switch (e.key) {
          case 'PageDown':
              e.preventDefault();
              chatContainer.scrollBy({ top: pageAmount, behavior: 'smooth' });
              break;
          case 'PageUp':
              e.preventDefault();
              chatContainer.scrollBy({ top: -pageAmount, behavior: 'smooth' });
              break;
          case 'End':
              e.preventDefault();
              chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
              break;
          case 'Home':
              e.preventDefault();
              chatContainer.scrollTo({ top: 0, behavior: 'smooth' });
              break;
      }
  }

  // Global listener so page keys scroll the message list while chat is active
  // (but never while the message input textarea is focused).
  $effect(() => {
      if (typeof window === 'undefined') return;

      const onKeydown = (e: KeyboardEvent) => {
          if (!partnerNpub || !chatContainer) return;
          if (!isPageKey(e.key)) return;

          if (showMediaPreview) {
              return;
          }

          if (typeof document !== 'undefined') {
              const modal = document.querySelector('[aria-modal="true"]');
              if (modal) {
                  return;
              }
          }

          const activeEl = typeof document !== 'undefined'
              ? (document.activeElement as HTMLElement | null)
              : null;

          if (activeEl === inputElement) {
              return;
          }

          const isChatActive = !activeEl ||
              (typeof document !== 'undefined' && activeEl === document.body) ||
              (!!chatRoot && chatRoot.contains(activeEl));

          if (!isChatActive) {
              return;
          }

          handlePageKeyScroll(e);
      };

      window.addEventListener('keydown', onKeydown);
      return () => {
          window.removeEventListener('keydown', onKeydown);
      };
  });

   // Auto-focus input (desktop only)
   $effect(() => {
     partnerNpub; // Trigger on chat switch
     if (!isSending && inputElement && window.innerWidth >= 768) {
       inputElement.focus();
     }
   });

   // Apply any initial shared media or text once the chat is ready
   $effect(() => {
     if (!partnerNpub && !isGroup) {
       return;
     }

     if (initialSharedMedia) {
       openMediaPreview(initialSharedMedia.file, initialSharedMedia.mediaType);
       initialSharedMedia = null;
     }

     if (initialSharedText && initialSharedText.trim().length > 0) {
       inputText = initialSharedText;
       initialSharedText = null;

       if (inputElement) {
         setTimeout(() => {
           inputElement.style.height = "auto";
           inputElement.style.height = Math.min(inputElement.scrollHeight, 150) + "px";
         }, 0);
       }
     }
   });
 
   // Update current time every minute to refresh relative times

  $effect(() => {
    const interval = setInterval(() => {
      currentTime = Date.now();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  });

  function scrollToBottom() {
    if (chatContainer) {
      // Wait for Svelte to finish DOM updates, then wait for browser layout
      tick().then(() => {
        requestAnimationFrame(() => {
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
            // Scroll again after delay to catch late layout calculations
            // from async components (LocationMap, AudioWaveformPlayer)
            setTimeout(() => {
              if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
              }
            }, 300);
          }
        });
      });
    }
  }

  function getRelativeTime(timestamp: number): string {
    return getRelativeTimeUtil(timestamp, currentTime);
  }

  function isSameDay(a: number, b: number): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  function formatDateLabel(timestamp: number): string {
    const now = new Date(currentTime);
    const target = new Date(timestamp);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfTarget) / (1000 * 60 * 60 * 24));

    const translateDate = get(t) as (key: string) => string;

    if (diffDays === 0) {
      return translateDate('chat.dateLabel.today');
    }

    if (diffDays === 1) {
      return translateDate('chat.dateLabel.yesterday');
    }

    return target.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const translate = (key: string, vars?: Record<string, unknown>) =>
    (get(t) as (k: string, v?: Record<string, unknown>) => string)(key, vars);

  function removeOptimisticMessage(eventId: string) {
    const target = optimisticMessages.find((m) => m.eventId === eventId);
    if (target) {
      revokeOptimisticResources(target);
    }
    optimisticMessages = optimisticMessages.filter((m) => m.eventId !== eventId);
  }

  async function send() {
    if (!inputText.trim()) return;
    // For 1-on-1 chats, need partnerNpub; for groups, need groupConversation
    if (!isGroup && !partnerNpub) return;
    if (isGroup && !groupConversation) return;

    const text = inputText;
    inputText = ""; // Clear immediately for UX
    if (inputElement) {
      inputElement.style.height = "auto";
    }

    // Capture timestamp once to ensure optimistic and persisted messages match
    const createdAtSeconds = Math.floor(Date.now() / 1000);
    const sentAtMs = createdAtSeconds * 1000;

    const optimisticEventId = makeOptimisticEventId();
    const optimistic: Message = {
      recipientNpub: isGroup ? groupConversation!.participants[0] : partnerNpub!,
      message: text,
      sentAt: sentAtMs,
      eventId: optimisticEventId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 14,
      // Group-specific fields
      ...(isGroup && groupConversation ? {
        conversationId: groupConversation.id,
        senderNpub: $currentUser?.npub,
        participants: groupConversation.participants,
      } : {}),
    };

    optimisticMessages = [...optimisticMessages, optimistic];
    scrollToBottom();

    // Capture pending subject before sending (will be cleared on success)
    const subjectToSend = isGroup ? pendingGroupSubject ?? undefined : undefined;
    
    void messagingService
      .sendMessage(
        isGroup ? null : partnerNpub!,
        text,
        undefined,
        createdAtSeconds,
        isGroup ? groupConversation!.id : undefined,
        subjectToSend
      )
      .then(() => {
        if (isDestroyed) return;
        // Clear pending subject after successful send
        if (isGroup && pendingGroupSubject !== null) {
          pendingGroupSubject = null;
        }
        clearUnreadMarkersForChat();
        scrollToBottom();
        hapticLightImpact();
      })
      .catch(async (e) => {
        if (isDestroyed) return;
        console.error("Failed to send message:", e);
        clearRelayStatus();
        removeOptimisticMessage(optimisticEventId);
        await nativeDialogService.alert({
          title: translate('chat.sendFailedTitle'),
          message: translate('chat.sendFailedMessagePrefix') + (e as Error).message,
        });
        inputText = text; // Restore text on failure
      });
   }

   async function handleLocationSelect(latitude: number, longitude: number) {
     // For 1-on-1 chats, need partnerNpub; for groups, need groupConversation
     if (!isGroup && !partnerNpub) return;
     if (isGroup && !groupConversation) return;

     // Capture timestamp once to ensure optimistic and persisted messages match
     const createdAtSeconds = Math.floor(Date.now() / 1000);
     const sentAtMs = createdAtSeconds * 1000;

     const optimisticEventId = makeOptimisticEventId();
     const optimistic: Message = {
       recipientNpub: isGroup ? groupConversation!.participants[0] : partnerNpub!,
       message: `geo:${latitude},${longitude}`,
       sentAt: sentAtMs,
       eventId: optimisticEventId,
       direction: 'sent',
       createdAt: Date.now(),
       rumorKind: 14,
       location: {
         latitude,
         longitude
       },
       // Group-specific fields
       ...(isGroup && groupConversation ? {
         conversationId: groupConversation.id,
         senderNpub: $currentUser?.npub,
         participants: groupConversation.participants,
       } : {}),
     };

     optimisticMessages = [...optimisticMessages, optimistic];
     scrollToBottom();

     void messagingService
       .sendLocationMessage(
         isGroup ? null : partnerNpub!,
         latitude,
         longitude,
         createdAtSeconds,
         isGroup ? groupConversation!.id : undefined
       )
       .then(() => {
         if (isDestroyed) return;
         clearUnreadMarkersForChat();
         scrollToBottom();
         hapticLightImpact();
       })
       .catch(async (e: unknown) => {
         if (isDestroyed) return;
         console.error('Failed to send location message:', e);
         clearRelayStatus();
         removeOptimisticMessage(optimisticEventId);
         await nativeDialogService.alert({
           title: translate('chat.sendFailedTitle'),
           message: translate('chat.sendFailedMessagePrefix') + (e as Error).message,
         });
       });
   }

   function resetMediaPreview() {
    showMediaPreview = false;
    pendingMediaCaption = "";
    pendingMediaError = null;
    pendingMediaServersHint = null;
    isEnsuringMediaServers = false;

    if (pendingMediaObjectUrl) {
      URL.revokeObjectURL(pendingMediaObjectUrl);
      pendingMediaObjectUrl = null;
    }

    pendingMediaFile = null;
    pendingMediaType = null;
  }


  function openMediaPreview(file: File, type: 'image' | 'video' | 'audio' | 'file') {
    if (pendingMediaObjectUrl) {
      URL.revokeObjectURL(pendingMediaObjectUrl);
      pendingMediaObjectUrl = null;
    }

    pendingMediaFile = file;
    pendingMediaType = type;
    pendingMediaCaption = "";
    pendingMediaError = null;
    pendingMediaServersHint = null;
    pendingMediaObjectUrl = URL.createObjectURL(file);
    showMediaPreview = true;

    if (!partnerNpub) {
      isEnsuringMediaServers = false;
      return;
    }

    isEnsuringMediaServers = true;
    void (async () => {
      try {
        const ensured = await ensureDefaultBlossomServersForCurrentUser();
        if (ensured.didSetDefaults) {
          pendingMediaServersHint = translate('modals.mediaServersAutoConfigured.message', {
            values: {
              server1: $runtimeConfig.defaultBlossomServers[0] ?? '',
              server2: $runtimeConfig.defaultBlossomServers[1] ?? $runtimeConfig.defaultBlossomServers[0] ?? ''
            }
          });
        }
      } catch {
        // Best-effort; send will still fail if servers missing.
      } finally {
        isEnsuringMediaServers = false;
      }
    })();
  }

  function mediaTypeToMime(type: 'image' | 'video' | 'audio' | 'file'): string {
    if (type === 'image') {
      return 'image/jpeg';
    }
    if (type === 'video') {
      return 'video/mp4';
    }
    if (type === 'audio') {
      return 'audio/mpeg';
    }
    return 'application/octet-stream';
  }

  async function confirmSendMedia() {
    if (!pendingMediaFile || !pendingMediaType) {
      return;
    }
    // For 1-on-1 chats, need partnerNpub; for groups, need groupConversation
    if (!isGroup && !partnerNpub) return;
    if (isGroup && !groupConversation) return;

    const file = pendingMediaFile;
    const mediaType = pendingMediaType;
    const caption = pendingMediaCaption.trim();

    // Capture timestamp once to ensure optimistic and persisted messages match
    const createdAtSeconds = Math.floor(Date.now() / 1000);
    const sentAtMs = createdAtSeconds * 1000;

    const optimisticEventId = makeOptimisticEventId();
    const optimisticUrl = URL.createObjectURL(file);
    const optimistic: Message = {
      recipientNpub: isGroup ? groupConversation!.participants[0] : partnerNpub!,
      message: caption,
      sentAt: sentAtMs,
      eventId: optimisticEventId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 15,
      fileUrl: optimisticUrl,
      fileType: file.type || mediaTypeToMime(mediaType),
      // Group-specific fields
      ...(isGroup && groupConversation ? {
        conversationId: groupConversation.id,
        senderNpub: $currentUser?.npub,
        participants: groupConversation.participants,
      } : {}),
    };

    optimisticMessages = [...optimisticMessages, optimistic];

    // Dismiss the preview immediately after initiating send.
    resetMediaPreview();
    scrollToBottom();

    void (async () => {
      try {
        // Extract dimensions and blurhash for images/videos (best-effort)
        let mediaMeta: { width?: number; height?: number; blurhash?: string } | undefined;
        if (mediaType === 'image' || mediaType === 'video') {
          try {
            const meta = mediaType === 'image'
              ? await getImageMetadata(file)
              : await getVideoMetadata(file);
            mediaMeta = meta;
          } catch {
            // Proceed without metadata on failure
          }
        }

        await messagingService.sendFileMessage(
          isGroup ? null : partnerNpub!,
          file,
          mediaType,
          createdAtSeconds,
          isGroup ? groupConversation!.id : undefined,
          mediaMeta,
          caption.length > 0 ? caption : undefined
        );

        if (isDestroyed) return;

        // The persisted attachment message will arrive via the parent refresh.
        // Remove the optimistic placeholder to avoid duplicates.
        setTimeout(() => {
          if (!isDestroyed) {
            removeOptimisticMessage(optimisticEventId);
          }
        }, 0);

        clearUnreadMarkersForChat();
        scrollToBottom();
        hapticLightImpact();
      } catch (e) {
        if (isDestroyed) return;
        console.error('Failed to send file message:', e);
        clearRelayStatus();
        removeOptimisticMessage(optimisticEventId);

        await nativeDialogService.alert({
          title: translate('chat.sendFailedTitle'),
          message: translate('chat.sendFailedMessagePrefix') + (e as Error).message,
        });

        // Restore preview state for retry
        pendingMediaFile = file;
        pendingMediaType = mediaType;
        pendingMediaCaption = caption;
        pendingMediaError = translate('chat.sendFailedMessagePrefix') + (e as Error).message;
        pendingMediaObjectUrl = URL.createObjectURL(file);
        showMediaPreview = true;
        pendingMediaServersHint = null;
        isEnsuringMediaServers = false;
      }
    })();
  }


  function openContextMenu(e: MouseEvent, message: Message) {
    e.preventDefault();
    contextMenu = {
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      message,
    };
  }

  function closeContextMenu() {
    contextMenu.isOpen = false;
  }

  function citeMessage() {
    if (!contextMenu.message) return;
    const citedContent = contextMenu.message.message
      .split("\n")
      .map((line) => "> " + line)
      .join("\n");

    inputText = (inputText ? inputText + "\n\n" : "") + citedContent + "\n";

    // Focus input and set cursor to end
    setTimeout(() => {
      if (inputElement) {
        inputElement.focus();
        inputElement.setSelectionRange(inputText.length, inputText.length);
        // Auto-resize if needed
        inputElement.style.height = "auto";
        inputElement.style.height =
          Math.min(inputElement.scrollHeight, 150) + "px";
      }
    }, 0);
  }

  async function copyMessage() {
    if (!contextMenu.message) return;

    const location = contextMenu.message.location;
    const content = location ? `${location.latitude},${location.longitude}` : contextMenu.message.message;
    await copyTextToClipboard(content);
  }

  function handleMouseDown(e: MouseEvent, message: Message) {
    if (window.innerWidth >= 768) return;
    // Start long press timer for touch devices
    longPressTimer = window.setTimeout(() => {
      openContextMenu(e, message);
      longPressTimer = null; // Clear timer after opening menu
    }, 500);
  }

  function handleMouseUp() {
    // Clear long press timer only if menu hasn't opened
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleContextMenu(e: MouseEvent, message: Message) {
    if (window.innerWidth >= 768) return;
    openContextMenu(e, message);
  }

  function handleDotClick(e: MouseEvent, message: Message) {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + 4;
    contextMenu = {
      isOpen: true,
      x,
      y,
      message,
    };
  }

  async function reactToMessage(emoji: '👍' | '❤️' | '😂' | '🙏') {
    if (!contextMenu.message) return;
    // For 1-on-1 chats, need partnerNpub; for groups, need groupConversation
    if (!isGroup && !partnerNpub) return;
    if (isGroup && !groupConversation) return;

    hapticSelection();

    if (!contextMenu.message.rumorId) {
      await nativeDialogService.alert({
        title: translate('chat.reactions.cannotReactTitle'),
        message: translate('chat.reactions.cannotReactMessage')
      });
      return;
    }

    try {
      if (isGroup && groupConversation) {
        // Group chat: send reaction to all participants
        await messagingService.sendGroupReaction(
          groupConversation.id,
          {
            eventId: contextMenu.message.eventId,
            rumorId: contextMenu.message.rumorId,
            direction: contextMenu.message.direction,
            senderNpub: contextMenu.message.senderNpub
          },
          emoji
        );
      } else {
        // 1-on-1 chat: send reaction to single recipient
        await messagingService.sendReaction(
          partnerNpub!,
          {
            recipientNpub: contextMenu.message.recipientNpub,
            eventId: contextMenu.message.eventId,
            rumorId: contextMenu.message.rumorId,
            direction: contextMenu.message.direction
          },
          emoji
        );
      }
    } catch (e) {
      console.error('Failed to send reaction:', e);
      await nativeDialogService.alert({
        title: translate('chat.reactions.failedTitle'),
        message:
          translate('chat.reactions.failedMessagePrefix') + (e as Error).message
      });
    }
  }

  async function handleFileSelect(file: File, type: 'image' | 'video' | 'audio' | 'file') {
    // For 1-on-1 chats, need partnerNpub; for groups, need groupConversation
    if (!isGroup && !partnerNpub) return;
    if (isGroup && !groupConversation) return;

    openMediaPreview(file, type);
  }

  function resetLocationPreview() {
    showLocationPreview = false;
    pendingLocation = null;
  }

  function confirmSendLocation() {
    if (!pendingLocation) {
      return;
    }

    const { latitude, longitude } = pendingLocation;
    resetLocationPreview();
    void handleLocationSelect(latitude, longitude);
  }

  async function handleShareLocation() {
    try {
      const { latitude, longitude } = await getCurrentPosition();
      pendingLocation = { latitude, longitude };
      showLocationPreview = true;
    } catch (e) {
      await nativeDialogService.alert({
        title: translate('chat.location.errorTitle'),
        message: translate('chat.location.errorMessage')
      });
    }
  }

  const showVoiceButton = $derived(
    typeof window !== 'undefined' &&
      inputText.trim().length === 0 &&
      isVoiceRecordingSupported()
  );

  async function sendVoiceMessage(file: File): Promise<void> {
    // For 1-on-1 chats, need partnerNpub; for groups, need groupConversation
    if (!isGroup && !partnerNpub) return;
    if (isGroup && !groupConversation) return;

    // Best-effort: ensure default Blossom servers exist.
    try {
      await ensureDefaultBlossomServersForCurrentUser();
    } catch {
      // ignore
    }

    const createdAtSeconds = Math.floor(Date.now() / 1000);
    const sentAtMs = createdAtSeconds * 1000;

    const optimisticEventId = makeOptimisticEventId();
    const optimisticUrl = URL.createObjectURL(file);

    const optimistic: Message = {
      recipientNpub: isGroup ? groupConversation!.participants[0] : partnerNpub!,
      message: '',
      sentAt: sentAtMs,
      eventId: optimisticEventId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 15,
      fileUrl: optimisticUrl,
      fileType: file.type || 'audio/webm',
      // Group-specific fields
      ...(isGroup && groupConversation ? {
        conversationId: groupConversation.id,
        senderNpub: $currentUser?.npub,
        participants: groupConversation.participants,
      } : {}),
    };

    optimisticMessages = [...optimisticMessages, optimistic];
    scrollToBottom();

    void (async () => {
      try {
        await messagingService.sendFileMessage(
          isGroup ? null : partnerNpub!,
          file,
          'audio',
          createdAtSeconds,
          isGroup ? groupConversation!.id : undefined
        );

        if (isDestroyed) return;

        setTimeout(() => {
          if (!isDestroyed) {
            removeOptimisticMessage(optimisticEventId);
          }
        }, 0);

        clearUnreadMarkersForChat();
        scrollToBottom();
        hapticLightImpact();
      } catch (e) {
        if (isDestroyed) return;

        console.error('Failed to send voice message:', e);
        clearRelayStatus();
        removeOptimisticMessage(optimisticEventId);

        await nativeDialogService.alert({
          title: translate('chat.sendFailedTitle'),
          message: translate('chat.sendFailedMessagePrefix') + (e as Error).message,
        });
      }
    })();
  }

  function openVoiceSheet(): void {
    if (!showVoiceButton) {
      return;
    }
    showVoiceSheet = true;
  }

  function closeVoiceSheet(): void {
    showVoiceSheet = false;
  }
</script>

<svelte:head>
  {#if partnerNpub}
    <title
      >nospeak: chat with {partnerName ||
        partnerNpub.slice(0, 10) + "..."}</title
    >
  {/if}
</svelte:head>

<div bind:this={chatRoot} class="relative flex flex-col h-full overflow-hidden bg-white/30 dark:bg-slate-900/30 {blur('sm')}">
  {#if showMediaPreview && pendingMediaFile && pendingMediaType}
    <AttachmentPreviewModal
      isOpen={showMediaPreview}
      file={pendingMediaFile}
      mediaType={pendingMediaType}
      objectUrl={pendingMediaObjectUrl}
      title={$t('modals.attachmentPreview.title') as string}
      imageAlt={$t('modals.attachmentPreview.imageAlt') as string}
      noPreviewText={$t('modals.attachmentPreview.noPreview') as string}
      captionLabel={$t('modals.attachmentPreview.captionLabel') as string}
      captionPlaceholder={$t('chat.inputPlaceholder') as string}
      cancelText={$t('modals.attachmentPreview.cancelButton') as string}
      confirmTextIdle={$t('modals.attachmentPreview.sendButtonIdle') as string}
      confirmTextBusy={$t('modals.attachmentPreview.sendButtonSending') as string}
      bind:caption={pendingMediaCaption}
      error={pendingMediaError}
      hint={pendingMediaServersHint}
      isBusy={isSending}
      disableConfirm={isSending || isEnsuringMediaServers}
      onCancel={resetMediaPreview}
      onConfirm={() => void confirmSendMedia()}
    />
  {/if}

  {#if showLocationPreview && pendingLocation}
    <AttachmentPreviewModal
      isOpen={showLocationPreview}
      mode="location"
      location={pendingLocation}
      title={$t('modals.locationPreview.title') as string}
      cancelText={$t('modals.attachmentPreview.cancelButton') as string}
      confirmTextIdle={$t('modals.attachmentPreview.sendButtonIdle') as string}
      confirmTextBusy={$t('modals.attachmentPreview.sendButtonSending') as string}
      isBusy={isSending}
      disableConfirm={isSending}
      onCancel={resetLocationPreview}
      onConfirm={confirmSendLocation}
    />
  {/if}

  {#if showVoiceSheet}
    <VoiceMessageSheet
      isOpen={showVoiceSheet}
      onCancel={closeVoiceSheet}
      onClose={closeVoiceSheet}
      onSend={(file) => void sendVoiceMessage(file)}
    />
  {/if}


  {#if partnerNpub || isGroup}
    <div
      class="absolute top-0 left-0 right-0 z-20 p-2 pt-safe min-h-16 border-b border-gray-200/50 dark:border-slate-700/70 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm transition-all duration-150 ease-out"
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
        {#if isGroup && groupConversation}
          <!-- Group chat avatar and title -->
          <div class="flex items-center gap-2">
              <GroupAvatar 
                  participants={groupConversation.participants.filter((p: string) => p !== $currentUser?.npub)} 
                  size="sm" 
                  class="!w-8 !h-8 md:!w-9 md:!h-9 transition-all duration-150 ease-out"
              />
          </div>
          <div class="flex flex-col group flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                  <span class="font-bold dark:text-white text-left truncate">
                      {groupTitle || $t('chat.group.defaultTitle')}
                  </span>
                  <button
                      type="button"
                      class="p-1 rounded-full text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      onclick={() => { hapticSelection(); showEditNameModal = true; }}
                      aria-label={$t('chat.group.editName')}
                  >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                      </svg>
                  </button>
                  {#if showNameSavedToast}
                      <span 
                          class="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full whitespace-nowrap animate-fade-in"
                          in:fly={{ x: -10, duration: 200 }}
                          out:fly={{ x: 10, duration: 150 }}
                      >
                          {$t('chat.group.nameSavedToast')}
                      </span>
                  {/if}
              </div>
              <button
                  type="button"
                  class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:underline cursor-pointer transition-colors text-left"
                  onclick={() => { hapticSelection(); showMembersModal = true; }}
                  aria-label={$t('chat.group.viewMembers')}
              >
                  {$t('chat.group.members', { values: { count: groupConversation.participants.length } })}
              </button>
          </div>
        {:else if partnerNpub}
          <button
              class="hover:opacity-80 transition-opacity duration-150 ease-out cursor-pointer"
              onclick={() => partnerNpub && openProfile(partnerNpub)}
              aria-label="Open contact profile"
          >
              <Avatar 
                  npub={partnerNpub} 
                  src={partnerPicture} 
                  size="sm" 
                  class="!w-8 !h-8 md:!w-9 md:!h-9 transition-all duration-150 ease-out"
              />
          </button>
          <button
              onclick={() => partnerNpub && openProfile(partnerNpub)}
              class="font-bold hover:underline dark:text-white text-left truncate min-w-0"
          >
              {partnerName || partnerNpub.slice(0, 10) + "..."}
          </button>
        {/if}
      </div>

      {#if (partnerNpub && partnerNpub !== 'ALL') || isGroup}
        <!-- Mobile overlay search input (covers username area) -->
        <div
          class={`md:hidden absolute bottom-2 h-11 left-24 right-16 z-30 transition-[opacity,transform] duration-200 ease-out ${
            isSearchOpen
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 translate-x-2 pointer-events-none'
          }`}
        >
          <input
            bind:value={searchQuery}
            bind:this={searchInputElement}
            placeholder={$t('chat.searchPlaceholder')}
            class="w-full h-full px-4 border border-gray-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
            aria-label={$t('chat.searchAriaLabel')}
            onkeydown={handleSearchKeydown}
          />
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Desktop/tablet inline slide-out -->
          <div
            class={`hidden md:block transition-[max-width,opacity] duration-200 ease-out ${
              isSearchOpen
                ? 'max-w-56 opacity-100 overflow-visible'
                : 'max-w-0 opacity-0 overflow-hidden pointer-events-none'
            }`}
          >
            <input
              bind:value={searchQuery}
              bind:this={searchInputElement}
              placeholder={$t('chat.searchPlaceholder')}
              class="w-full px-4 h-11 border border-gray-200 dark:border-slate-700 rounded-full bg-white/90 dark:bg-slate-800/90 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
              aria-label={$t('chat.searchAriaLabel')}
              onkeydown={handleSearchKeydown}
            />
          </div>

          <Button
            size="icon"
            onclick={toggleSearch}
            class="h-11 w-11 relative z-40"
            aria-label="Search chat"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </Button>
        </div>
      {/if}

     </div>
  {/if}

  <div
    bind:this={chatContainer}
    tabindex="-1"
    style="overflow-anchor: none;"
    class="flex-1 overflow-x-hidden overflow-y-auto px-4 pb-safe-offset-28 pt-[calc(5rem+env(safe-area-inset-top))] space-y-4 custom-scrollbar native-scroll focus:outline-none focus:ring-0"
    onscroll={handleScroll}
    onpointerdown={activateMessageWindow}
    use:overscroll
  >
    {#if isSearchActive}
      {#if isSearchingHistory}
        <div class="flex justify-center p-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      {:else if displayMessages.length === 0}
        <div class="flex justify-center mt-10">
          <div class="px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/70 shadow-md {blur('xl')} typ-body text-gray-600 dark:text-slate-200">
            {$t('chat.searchNoMatches')}
          </div>
        </div>
      {/if}
    {:else}
       {#if canRequestNetworkHistory && displayMessages.length > 0}
           <div class="flex flex-col items-center p-2 gap-2">
             <button
              class="typ-meta px-4 py-1.5 rounded-full bg-white/70 dark:bg-slate-800/80 {blur('sm')} border border-gray-200/60 dark:border-slate-700/60 text-gray-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700/90 transition-all shadow-sm"
              type="button"
              onclick={() => onRequestNetworkHistory && onRequestNetworkHistory()}
            >
              {$t('chat.history.fetchOlder')}
            </button>

            {#if networkHistorySummary}
              <div class="px-3 py-1 rounded-full typ-meta bg-white/60 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60 text-gray-600 dark:text-slate-200 shadow-sm {blur('sm')}">
                {get(t)('chat.history.summary', { values: { events: networkHistorySummary.eventsFetched, saved: networkHistorySummary.messagesSaved, chat: networkHistorySummary.messagesForChat } })}
              </div>
            {/if}
          </div>

      {:else if networkHistoryStatus === 'no-more' && displayMessages.length > 0}
          <div class="flex justify-center p-2">
            <div class="px-3 py-1 rounded-full typ-meta bg-white/70 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70 text-gray-500 dark:text-slate-300 shadow-sm {blur('sm')}">
             {$t('chat.history.none')}
           </div>

         </div>

      {:else if networkHistoryStatus === 'error' && displayMessages.length > 0}
          <div class="flex justify-center p-2">
           <div class="px-3 py-1 rounded-full typ-meta bg-red-50/80 dark:bg-red-900/40 border border-red-200/80 dark:border-red-500/70 text-red-600 dark:text-red-200 shadow-sm {blur('sm')}">
             {$t('chat.history.error')}
           </div>
         </div>

      {/if}
   
      {#if isFetchingHistory}
        <div class="flex justify-center p-2">
          <CircularProgress size={24} strokeWidth={3} />
        </div>
      {/if}
   
      {#if displayMessages.length === 0 && !isFetchingHistory}
        <div class="flex justify-center mt-10">
          <div class="max-w-sm px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/70 shadow-md {blur('xl')} text-center space-y-1">
            <div class="typ-meta font-semibold uppercase text-gray-500 dark:text-slate-400">
              {$t('chat.empty.noMessagesTitle')}
            </div>
            <div class="typ-body text-gray-600 dark:text-slate-200">
              {#if partnerNpub}
                {get(t)('chat.empty.forContact', { values: { name: partnerName || partnerNpub.slice(0, 10) + '...' } })}
              {:else}
                {$t('chat.empty.generic')}
              {/if}
            </div>
          </div>
        </div>
      {/if}
    {/if}


    {#each displayMessages as msg, i (msg.eventId || msg.id || i)}
      {#if i === 0 || !isSameDay(msg.sentAt, displayMessages[i - 1].sentAt)}
        <div class="flex justify-center my-2">
          <div class="px-3 py-1 rounded-full typ-meta bg-white/70 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70 text-gray-600 dark:text-slate-200 shadow-sm {blur('sm')}">
            {formatDateLabel(msg.sentAt)}
          </div>
        </div>
      {/if}

       {@const hasUnreadMarker = msg.direction === "received" && (
         unreadSnapshotMessageSet.has(msg.eventId) ||
         activeHighlightMessageSet.has(msg.eventId)
       )}

        {@const hasYouTubeLink = /https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(msg.message)}
        {@const hasLocation = !!msg.location}
        {@const bubbleWidthClass = (hasYouTubeLink || hasLocation)
          ? 'w-full max-w-full md:w-[560px] md:max-w-full'
          : (useFullWidthBubbles ? 'max-w-full' : 'max-w-[70%]')}
 
      <div
        class={`flex ${msg.direction === "sent" ? "justify-end" : "justify-start"} items-end gap-2`}
        in:fly={isAndroidShell ? { duration: 0 } : { y: 20, duration: 300, easing: cubicOut }}
      >
        {#if msg.direction === "received"}
          {#if isGroup && msg.senderNpub}
            <!-- Group message: show sender's avatar -->
            <button
              class="mb-1 hover:opacity-80 transition-opacity duration-150 ease-out cursor-pointer"
              onclick={() => msg.senderNpub && openProfile(msg.senderNpub)}
            >
              <Avatar
                npub={msg.senderNpub}
                src={getParticipantPicture(msg.senderNpub)}
                size="md"
                class={`${useSmallAvatars ? '!w-10 !h-10' : '!w-14 !h-14'} md:!w-10 md:!h-10 transition-all duration-150 ease-out`}
              />
            </button>
          {:else if partnerNpub}
            <!-- 1-on-1 chat: show partner's avatar -->
            <button
              class="mb-1 hover:opacity-80 transition-opacity duration-150 ease-out cursor-pointer"
              onclick={() => partnerNpub && openProfile(partnerNpub)}
            >
              <Avatar
                npub={partnerNpub}
                src={partnerPicture}
                size="md"
                class={`${useSmallAvatars ? '!w-10 !h-10' : '!w-14 !h-14'} md:!w-10 md:!h-10 transition-all duration-150 ease-out`}
              />
            </button>
          {/if}
        {/if}

        <div class={`${bubbleWidthClass} min-w-0 flex flex-col`}>
        <div
          role="button"
          tabindex="0"
          class={`min-w-0 overflow-hidden p-3 shadow-sm cursor-pointer transition-all duration-150 ease-out relative ${isAndroidShell ? 'select-none' : ''}
                          ${
                            msg.direction === "sent"
                              ? "bg-blue-50/10 dark:bg-blue-900/40 text-gray-900 dark:text-slate-100 border border-blue-500/10 dark:border-blue-400/10 rounded-2xl rounded-br-none hover:shadow-md"
                              : "bg-white/95 dark:bg-slate-800/95 md:bg-white/80 md:dark:bg-slate-800/80 md:backdrop-blur-sm dark:text-white border border-gray-100 dark:border-slate-700/50 rounded-2xl rounded-bl-none hover:bg-white dark:hover:bg-slate-800"
                           }`}
            oncontextmenu={(e) => handleContextMenu(e, msg)}
           onmousedown={(e) => handleMouseDown(e, msg)}

          onmouseup={handleMouseUp}
          onmouseleave={handleMouseUp}
           >
            {#if hasUnreadMarker}
              <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-emerald-400/70"></div>
            {/if}
            
            <!-- Sender name for group messages -->
            {#if isGroup && msg.direction === "received" && msg.senderNpub}
              <button
                class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 hover:underline cursor-pointer"
                onclick={() => msg.senderNpub && openProfile(msg.senderNpub)}
              >
                {getParticipantName(msg.senderNpub)}
              </button>
            {/if}
            
             <MessageContent
                content={msg.message}
                highlight={isSearchActive ? searchQuery : undefined}
               isOwn={msg.direction === "sent"}
               onImageClick={openImageViewer}
               fileUrl={msg.fileUrl}
               fileType={msg.fileType}
               fileEncryptionAlgorithm={msg.fileEncryptionAlgorithm}
               fileKey={msg.fileKey}
               fileNonce={msg.fileNonce}
                authorNpub={msg.direction === "sent" ? $currentUser?.npub : partnerNpub}
                location={msg.location}
                forceEagerLoad={i >= displayMessages.length - 3}
                fileWidth={msg.fileWidth}
                fileHeight={msg.fileHeight}
                fileBlurhash={msg.fileBlurhash}
              />

            {#if msg.rumorKind === 15 && msg.message && msg.message !== msg.fileUrl}
              <div class="mt-2 text-sm text-gray-900 dark:text-slate-100">
                {@html highlightPlainTextToHtml(msg.message, isSearchActive ? searchQuery : '')}
              </div>
            {/if}

           <div class={`typ-meta mt-1 flex items-center justify-end gap-2 ${msg.direction === "sent" ? "text-blue-100" : "text-gray-400"}`}>
             <span class="cursor-help" title={new Date(msg.sentAt).toLocaleString()}>
               {getRelativeTime(msg.sentAt)}
             </span>
              <button
                type="button"
                class="hidden md:inline-flex py-1 pr-0 pl-px rounded-l hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
                onclick={(e) => handleDotClick(e, msg)}
                aria-label="Message options"
              >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                 <circle cx="12" cy="5" r="2"/>
                 <circle cx="12" cy="12" r="2"/>
                 <circle cx="12" cy="19" r="2"/>
               </svg>
             </button>
           </div>
          {#if msg.direction === "sent" && i === getLastSentIndex(displayMessages) && (partnerNpub || isGroup)}
            {#if $lastRelaySendStatus && ($lastRelaySendStatus.recipientNpub === partnerNpub || $lastRelaySendStatus.conversationId === groupConversation?.id)}
              <div class="typ-meta mt-0.5 text-right text-blue-100">
                {#if $lastRelaySendStatus.successfulRelays === 0}
                  {$t('chat.relayStatus.sending')}
                {:else}
                  {get(t)('chat.relayStatus.sentToRelays', { values: { successful: $lastRelaySendStatus.successfulRelays, desired: $lastRelaySendStatus.desiredRelays } })}
                {/if}
              </div>
            {:else if msg.eventId && msg.eventId.startsWith('optimistic:')}
              <div class="typ-meta mt-0.5 text-right text-blue-100">
                {$t('chat.relayStatus.sending')}
              </div>
            {/if}
          {/if}
        </div>
        <MessageReactions
          targetEventId={msg.rumorId || ''}
          isOwn={msg.direction === "sent"}
        />
        </div>

        {#if msg.direction === "sent" && $currentUser}
          <button
            class="mb-1 hover:opacity-80 transition-opacity duration-150 ease-out cursor-pointer"
            onclick={() => $currentUser && openProfile($currentUser.npub)}
          >
            <Avatar
              npub={$currentUser.npub}
              src={myPicture}
              size="md"
              class={`${useSmallAvatars ? '!w-10 !h-10' : '!w-14 !h-14'} md:!w-10 md:!h-10 transition-all duration-150 ease-out`}
            />
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <div
    class="absolute bottom-0 left-0 right-0 z-20 p-4 p-4-safe-bottom border-t border-gray-200/50 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg transition-all duration-150 ease-out"
  >
    <form
      onsubmit={(e) => {
        e.preventDefault();
        send();
      }}
      class="flex gap-3 items-end relative"
    >
      {#if showEmojiPicker && filteredEmojis.length > 0}
        <div
          class="absolute bottom-full mb-2 left-12 bg-white/80 dark:bg-slate-900/80 {blur('xl')} border border-gray-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden w-64 z-50"
        >
          {#each filteredEmojis as emoji, i}
            <button
              type="button"
              class={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors duration-150 ease-out ${i === emojiSelectedIndex ? "bg-blue-50/50 dark:bg-slate-700/80" : ""}`}
              onclick={() => selectEmoji(emoji)}
            >
              <span class="text-xl">{emoji.char}</span>
              <span class="text-sm text-gray-600 dark:text-slate-300"
                >:{emoji.name}:</span
              >
            </button>
          {/each}
        </div>
      {/if}

      <div
        class="flex-1 flex items-center bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-3xl px-4 py-1.5 gap-2 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/50 transition-all"
      >
        <MediaUploadButton
          onFileSelect={handleFileSelect}
          showLocationOption={true}
          onShareLocation={() => void handleShareLocation()}
          variant="chat"
          allowedTypes={["image", "video", "audio", "file"]}
        />
        <textarea
          bind:this={inputElement}
          bind:value={inputText}
          oninput={handleInput}
          onkeydown={handleKeydown}
          disabled={isSending}
          rows="1"
          class="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm md:text-base dark:text-white disabled:opacity-50 resize-none overflow-hidden placeholder:text-gray-400 dark:placeholder:text-slate-500 py-1"
          placeholder={$t('chat.inputPlaceholder')}
        ></textarea>
      </div>

      {#if showVoiceButton}
        <Button
          type="button"
          variant="primary"
          size="icon"
          class="flex-shrink-0"
          onclick={openVoiceSheet}
          aria-label={$t('chat.voiceMessage.recordAria')}
        >
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </Button>
      {/if}

      {#if inputText.trim().length > 0}
        <Button
          type="submit"
          variant="primary"
          size="icon"
          class="flex-shrink-0"
          disabled={isSending}
          aria-label="Send message"
        >
          <svg
            viewBox="0 0 24 24"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="9 6 15 12 9 18"></polyline>
          </svg>
        </Button>
      {/if}
    </form>
  </div>
</div>

{#if isGroup && groupConversation}
  <GroupMembersModal
    isOpen={showMembersModal}
    close={() => showMembersModal = false}
    participants={groupConversation.participants}
    onMemberClick={(npub) => { showMembersModal = false; openProfile(npub); }}
  />
  <EditGroupNameModal
    isOpen={showEditNameModal}
    close={() => showEditNameModal = false}
    currentName={groupConversation.subject || ''}
    onSave={handleSaveGroupName}
  />
{/if}

<ContextMenu
  isOpen={contextMenu.isOpen}
  x={contextMenu.x}
  y={contextMenu.y}
  onClose={closeContextMenu}
  onCite={citeMessage}
  onReact={reactToMessage}
  onCopy={copyMessage}
  message={contextMenu.message}
/>
