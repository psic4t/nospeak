<script lang="ts">
  import type { Message } from "$lib/db/db";
  import { messageRepo } from "$lib/db/MessageRepository";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import { messagingService } from "$lib/core/Messaging";
  import Avatar from "./Avatar.svelte";
  import MessageContent from "./MessageContent.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import MediaUploadButton from "./MediaUploadButton.svelte";
  import { currentUser } from "$lib/stores/auth";
  import { clearChatUnread, getUnreadSnapshot, isActivelyViewingConversation } from "$lib/stores/unreadMessages";
  import { emojis } from "$lib/utils/emojis";
  import { goto } from '$app/navigation';
  import { hapticLightImpact, hapticSelection } from '$lib/utils/haptics';
  import { tapSoundClick } from '$lib/utils/tapSound';
  import { copyTextToClipboard } from '$lib/utils/clipboard';
  import { isAndroidCapacitorShell } from '$lib/utils/platform';
  import { lastRelaySendStatus, clearRelayStatus } from '$lib/stores/sending';
  import { openProfileModal } from '$lib/stores/modals';
  import { openImageViewer } from '$lib/stores/imageViewer';
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { nativeDialogService, isAndroidNative, isMobileWeb } from '$lib/core/NativeDialogs';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';
  import { isCaptionMessage, getCaptionForParent } from '$lib/core/captionGrouping';
  import { buildChatHistorySearchResults } from '$lib/core/chatHistorySearch';
  import Button from '$lib/components/ui/Button.svelte';
  import Textarea from '$lib/components/ui/Textarea.svelte';

   let {
     messages = [],
     partnerNpub,
     onLoadMore,
     isFetchingHistory = false,
     canRequestNetworkHistory = false,
     onRequestNetworkHistory,
     networkHistoryStatus = 'idle',
     initialSharedMedia = null,
     initialSharedText = null
   } = $props<{
     messages: Message[];
     partnerNpub?: string;
     onLoadMore?: () => void;
     isFetchingHistory?: boolean;
     canRequestNetworkHistory?: boolean;
     onRequestNetworkHistory?: () => void;
     networkHistoryStatus?: 'idle' | 'loading' | 'no-more' | 'error';
     initialSharedMedia?: { file: File; mediaType: 'image' | 'video' | 'audio' } | null;
     initialSharedText?: string | null;
   }>();
 
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
    if (persisted.recipientNpub !== optimistic.recipientNpub) return false;
    if ((persisted.rumorKind || 14) !== (optimistic.rumorKind || 14)) return false;
    if (persisted.sentAt !== optimistic.sentAt) return false;

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
      if (!$currentUser || !partnerNpub) {
        return;
      }

      clearChatUnread($currentUser.npub, partnerNpub);
      unreadSnapshotMessageIds = [];
      clearEphemeralHighlights();
    }

    $effect(() => {
      const user = $currentUser;
      const partner = partnerNpub;
      if (!user || !partner) {
        unreadSnapshotMessageIds = [];
        clearEphemeralHighlights();
        return;
      }

      const snapshot = getUnreadSnapshot(user.npub, partner);
      unreadSnapshotMessageIds = Array.from(snapshot.messages);
      clearEphemeralHighlights();

      clearChatUnread(user.npub, partner);
    });

    onMount(() => {
      const handleBlur = () => {
        clearEphemeralHighlights();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
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

      window.addEventListener('blur', handleBlur);
      window.addEventListener('nospeak:new-message', handleNewMessage);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('nospeak:new-message', handleNewMessage);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    });
    
    // Single-file media preview state
  let showMediaPreview = $state(false);
  let pendingMediaFile = $state<File | null>(null);
  let pendingMediaType = $state<'image' | 'video' | 'audio' | null>(null);
  let pendingMediaObjectUrl = $state<string | null>(null);
  let pendingMediaCaption = $state("");
  let pendingMediaError = $state<string | null>(null);

  // Bottom sheet drag state (Android only)
  const BOTTOM_SHEET_ACTIVATION_THRESHOLD = 8;
  const BOTTOM_SHEET_CLOSE_THRESHOLD = 96;
  let isBottomSheetDragging = $state(false);
  let bottomSheetDragStartY = 0;
  let bottomSheetDragY = $state(0);

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

    if (e.key === "Enter" && !e.shiftKey) {
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
  $effect(() => {
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

  function handleMediaLoad() {
    if (!chatContainer) return;
    // If we are reasonably close to the bottom, keep scrolling down as media loads
    // This fixes the issue where loading images push the content up
    const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;

    if (distanceFromBottom < 1000) {
      scrollToBottom();
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
     if (!partnerNpub) {
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
      // Use timeout to ensure DOM has updated height
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 0);
    }
  }

  function getRelativeTime(timestamp: number): string {
    const now = currentTime;
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const translate = get(t) as (key: string, vars?: Record<string, unknown>) => string;

    if (seconds < 60) return translate('chat.relative.justNow');

    if (minutes < 60) {
      const key = minutes === 1 ? 'chat.relative.minutes' : 'chat.relative.minutesPlural';
      return translate(key, { values: { count: minutes } });
    }

    if (hours < 24) {
      const key = hours === 1 ? 'chat.relative.hours' : 'chat.relative.hoursPlural';
      return translate(key, { values: { count: hours } });
    }

    if (days < 7) {
      const key = days === 1 ? 'chat.relative.days' : 'chat.relative.daysPlural';
      return translate(key, { values: { count: days } });
    }

    if (weeks < 4) {
      const key = weeks === 1 ? 'chat.relative.weeks' : 'chat.relative.weeksPlural';
      return translate(key, { values: { count: weeks } });
    }

    if (months < 12) {
      const key = months === 1 ? 'chat.relative.months' : 'chat.relative.monthsPlural';
      return translate(key, { values: { count: months } });
    }

    const key = years === 1 ? 'chat.relative.years' : 'chat.relative.yearsPlural';
    return translate(key, { values: { count: years } });
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

  function makeOptimisticSentAtMs(): number {
    return Math.floor(Date.now() / 1000) * 1000;
  }

  async function send() {
    if (!partnerNpub || !inputText.trim()) return;

    const text = inputText;
    inputText = ""; // Clear immediately for UX
    if (inputElement) {
      inputElement.style.height = "auto";
    }

    const optimisticEventId = makeOptimisticEventId();
    const optimistic: Message = {
      recipientNpub: partnerNpub,
      message: text,
      sentAt: makeOptimisticSentAtMs(),
      eventId: optimisticEventId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 14,
    };

    optimisticMessages = [...optimisticMessages, optimistic];
    scrollToBottom();

    void messagingService
      .sendMessage(partnerNpub, text)
      .then(() => {
        if (isDestroyed) return;
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

  function resetMediaPreview() {
    showMediaPreview = false;
    pendingMediaCaption = "";
    pendingMediaError = null;

    if (pendingMediaObjectUrl) {
      URL.revokeObjectURL(pendingMediaObjectUrl);
      pendingMediaObjectUrl = null;
    }

    pendingMediaFile = null;
    pendingMediaType = null;
    isBottomSheetDragging = false;
    bottomSheetDragY = 0;
  }

  function openMediaPreview(file: File, type: 'image' | 'video' | 'audio') {
    if (pendingMediaObjectUrl) {
      URL.revokeObjectURL(pendingMediaObjectUrl);
      pendingMediaObjectUrl = null;
    }

    pendingMediaFile = file;
    pendingMediaType = type;
    pendingMediaCaption = "";
    pendingMediaError = null;
    pendingMediaObjectUrl = URL.createObjectURL(file);
    showMediaPreview = true;
    isBottomSheetDragging = false;
    bottomSheetDragY = 0;
  }

  function mediaTypeToMime(type: 'image' | 'video' | 'audio'): string {
    if (type === 'image') {
      return 'image/jpeg';
    }
    if (type === 'video') {
      return 'video/mp4';
    }
    return 'audio/mpeg';
  }

  async function confirmSendMedia() {
    if (!partnerNpub || !pendingMediaFile || !pendingMediaType) {
      return;
    }

    const file = pendingMediaFile;
    const mediaType = pendingMediaType;
    const caption = pendingMediaCaption.trim();

    const optimisticEventId = makeOptimisticEventId();
    const optimisticUrl = URL.createObjectURL(file);
    const optimistic: Message = {
      recipientNpub: partnerNpub,
      message: '',
      sentAt: makeOptimisticSentAtMs(),
      eventId: optimisticEventId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 15,
      fileUrl: optimisticUrl,
      fileType: file.type || mediaTypeToMime(mediaType),
    };

    optimisticMessages = [...optimisticMessages, optimistic];

    // Dismiss the preview immediately after initiating send.
    resetMediaPreview();
    scrollToBottom();

    void (async () => {
      try {
        const parentRumorId = await messagingService.sendFileMessage(partnerNpub, file, mediaType);

        if (caption.length > 0) {
          await messagingService.sendMessage(partnerNpub, caption, parentRumorId);
        }

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
        isBottomSheetDragging = false;
        bottomSheetDragY = 0;
      }
    })();
  }


  function handleBottomSheetPointerDown(e: PointerEvent) {
    if (!isAndroidShell) return;
    e.preventDefault();
    isBottomSheetDragging = false;
    bottomSheetDragStartY = e.clientY;
    bottomSheetDragY = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleBottomSheetPointerMove(e: PointerEvent) {
    if (!isAndroidShell) return;
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
    if (!isAndroidShell) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!isBottomSheetDragging) {
      bottomSheetDragY = 0;
      return;
    }
    const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
    isBottomSheetDragging = false;
    bottomSheetDragY = 0;
    if (shouldClose) {
      hapticSelection();
      resetMediaPreview();
    }
  }

  function handleBottomSheetTouchStart(e: TouchEvent) {
    if (!isAndroidShell) return;
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    isBottomSheetDragging = false;
    bottomSheetDragStartY = touch.clientY;
    bottomSheetDragY = 0;
  }

  function handleBottomSheetTouchMove(e: TouchEvent) {
    if (!isAndroidShell) return;
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

  function handleBottomSheetTouchEnd() {
    if (!isAndroidShell) return;
    if (!isBottomSheetDragging) {
      bottomSheetDragY = 0;
      return;
    }
    const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
    isBottomSheetDragging = false;
    bottomSheetDragY = 0;
    if (shouldClose) {
      hapticSelection();
      resetMediaPreview();
    }
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
    await copyTextToClipboard(contextMenu.message.message);
  }

  function handleMouseDown(e: MouseEvent, message: Message) {
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
    openContextMenu(e, message);
  }

  async function reactToMessage(emoji: '👍' | '👎' | '❤️' | '😂') {
    if (!contextMenu.message || !partnerNpub) return;

    hapticSelection();

    if (!contextMenu.message.rumorId) {
      await nativeDialogService.alert({
        title: translate('chat.reactions.cannotReactTitle'),
        message: translate('chat.reactions.cannotReactMessage')
      });
      return;
    }

    try {
      await messagingService.sendReaction(
        partnerNpub,
        {
          recipientNpub: contextMenu.message.recipientNpub,
          eventId: contextMenu.message.eventId,
          rumorId: contextMenu.message.rumorId,
          direction: contextMenu.message.direction
        },
        emoji
      );
    } catch (e) {
      console.error('Failed to send reaction:', e);
      await nativeDialogService.alert({
        title: translate('chat.reactions.failedTitle'),
        message:
          translate('chat.reactions.failedMessagePrefix') + (e as Error).message
      });
    }
  }

  async function handleFileSelect(file: File, type: 'image' | 'video' | 'audio', _url?: string) {
    if (!partnerNpub) return;

    openMediaPreview(file, type);
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

<div bind:this={chatRoot} class="relative flex flex-col h-full overflow-hidden bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
  {#if showMediaPreview && pendingMediaFile && pendingMediaType}
    <div
      class={`fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/40 md:pb-4 ${isAndroidShell ? '' : 'px-4'}`}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => { if (e.target === e.currentTarget) { hapticSelection(); resetMediaPreview(); } }}
      onkeydown={(e) => { if (e.key === 'Escape') { hapticSelection(); resetMediaPreview(); } }}
    >
      <div
        class={`relative w-full bg-white/95 dark:bg-slate-900/95 border border-gray-200/80 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl p-4 space-y-3 ${
          isAndroidShell ? 'rounded-t-3xl' : 'max-w-md rounded-t-2xl md:rounded-2xl'
        }`}
        style:transform={isAndroidShell ? `translateY(${bottomSheetDragY}px)` : undefined}
      >
        {#if isAndroidShell}
          <div
            class="absolute top-0 left-1/2 -translate-x-1/2 h-10 w-24"
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
              class="mx-auto mt-2 w-10 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 touch-none"
            ></div>
          </div>
        {/if}

        <Button
          onclick={resetMediaPreview}
          aria-label="Close modal"
          size="icon"
          class="hidden md:flex absolute top-3 right-3 z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </Button>

        <div class="flex items-center justify-between mb-2 px-0.5 mt-2 md:mt-0">
          <h2 class="typ-title dark:text-white">
            {$t('modals.attachmentPreview.title')}
          </h2>
        </div>

        <div class="rounded-xl overflow-hidden bg-gray-100/80 dark:bg-slate-800/80 flex items-center justify-center min-h-[160px]">
          {#if pendingMediaType === 'image' && pendingMediaObjectUrl}
            <img src={pendingMediaObjectUrl} alt={$t('modals.attachmentPreview.imageAlt')} class="max-h-64 w-full object-contain" />
          {:else if pendingMediaType === 'video' && pendingMediaObjectUrl}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={pendingMediaObjectUrl} controls class="max-h-64 w-full object-contain"></video>
          {:else if pendingMediaType === 'audio' && pendingMediaObjectUrl}
            <audio src={pendingMediaObjectUrl} controls class="w-full"></audio>
          {:else}
            <div class="typ-body text-gray-500 dark:text-slate-400">
              {$t('modals.attachmentPreview.noPreview')}
            </div>
          {/if}
        </div>

        <div>
          <label class="typ-meta block mb-1 text-gray-600 dark:text-slate-300">
            {$t('modals.attachmentPreview.captionLabel')}
            <Textarea
              rows={2}
              bind:value={pendingMediaCaption}
              placeholder={$t('chat.inputPlaceholder')}
              disabled={isSending}
              class="mt-1"
            />
          </label>
        </div>

        {#if pendingMediaError}
          <div class="typ-body text-sm text-red-600 dark:text-red-300 pt-1">
            {pendingMediaError}
          </div>
        {/if}

        <div class="flex justify-end gap-2 pt-1">
          <Button
            onclick={resetMediaPreview}
            disabled={isSending}
          >
            {$t('modals.attachmentPreview.cancelButton')}
          </Button>
          <Button
            variant="primary"
            onclick={confirmSendMedia}
            disabled={isSending || !pendingMediaFile || !pendingMediaType}
          >
            {#if isSending}
              <svg
                class="animate-spin h-4 w-4 text-white mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>{$t('modals.attachmentPreview.sendButtonSending')}</span>
            {:else}
              {$t('modals.attachmentPreview.sendButtonIdle')}
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {/if}

  {#if partnerNpub}
    <div
      class="absolute top-0 left-0 right-0 z-20 p-2 h-16 border-b border-gray-200/50 dark:border-slate-700/70 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm transition-all duration-150 ease-out relative"
    >
      <div class="flex items-center gap-3">
        <button 
            onclick={() => {
                tapSoundClick();
                goto('/chat');
            }}
            class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150 ease-out"
            aria-label="Back to contacts"
        >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
        </button>
        {#if partnerNpub}
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
        {/if}
        <button
            onclick={() => partnerNpub && openProfile(partnerNpub)}
            class="font-bold hover:underline dark:text-white text-left"
        >
            {partnerName || partnerNpub.slice(0, 10) + "..."}
        </button>
      </div>

      {#if partnerNpub !== 'ALL'}
        <!-- Mobile overlay search input (covers username area) -->
        <div
          class={`md:hidden absolute top-2 bottom-2 left-24 right-16 z-30 transition-[opacity,transform] duration-200 ease-out ${
            isSearchOpen
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 translate-x-2 pointer-events-none'
          }`}
        >
          <input
            bind:value={searchQuery}
            bind:this={searchInputElement}
            placeholder="Search"
            class="w-full h-full px-4 border border-gray-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
            aria-label="Search chat"
            onkeydown={handleSearchKeydown}
          />
        </div>

        <div class="flex items-center gap-2">
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
              placeholder="Search"
              class="w-full px-4 h-11 border border-gray-200 dark:border-slate-700 rounded-full bg-white/90 dark:bg-slate-800/90 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
              aria-label="Search chat"
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
    class="flex-1 overflow-y-auto px-4 pb-28 pt-20 space-y-4 custom-scrollbar focus:outline-none focus:ring-0"
    onscroll={handleScroll}
    onpointerdown={activateMessageWindow}
  >
    {#if isSearchActive}
      {#if isSearchingHistory}
        <div class="flex justify-center p-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      {:else if displayMessages.length === 0}
        <div class="flex justify-center mt-10">
          <div class="px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/70 shadow-md backdrop-blur-xl typ-body text-gray-600 dark:text-slate-200">
            No matches
          </div>
        </div>
      {/if}
    {:else}
      {#if canRequestNetworkHistory && displayMessages.length > 0}
          <div class="flex justify-center p-2">
            <button
             class="typ-meta px-4 py-1.5 rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-slate-700/60 text-gray-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700/90 transition-all shadow-sm"
             type="button"
             onclick={() => onRequestNetworkHistory && onRequestNetworkHistory()}
           >
             {$t('chat.history.fetchOlder')}
           </button>
         </div>

      {:else if networkHistoryStatus === 'no-more' && displayMessages.length > 0}
          <div class="flex justify-center p-2">
            <div class="px-3 py-1 rounded-full typ-meta bg-white/70 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70 text-gray-500 dark:text-slate-300 shadow-sm backdrop-blur-sm">
             {$t('chat.history.none')}
           </div>

         </div>

      {:else if networkHistoryStatus === 'error' && displayMessages.length > 0}
          <div class="flex justify-center p-2">
           <div class="px-3 py-1 rounded-full typ-meta bg-red-50/80 dark:bg-red-900/40 border border-red-200/80 dark:border-red-500/70 text-red-600 dark:text-red-200 shadow-sm backdrop-blur-sm">
             {$t('chat.history.error')}
           </div>
         </div>

      {/if}
   
      {#if isFetchingHistory}
        <div class="flex justify-center p-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      {/if}
   
      {#if displayMessages.length === 0 && !isFetchingHistory}
        <div class="flex justify-center mt-10">
          <div class="max-w-sm px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/70 shadow-md backdrop-blur-xl text-center space-y-1">
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
          <div class="px-3 py-1 rounded-full typ-meta bg-white/70 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70 text-gray-600 dark:text-slate-200 shadow-sm backdrop-blur-sm">
            {formatDateLabel(msg.sentAt)}
          </div>
        </div>
      {/if}

       {@const caption = isCaptionMessage(displayMessages, i)}
       {@const captionForThis = getCaptionForParent(displayMessages, i)}
       {@const hasUnreadMarker = msg.direction === "received" && (
         unreadSnapshotMessageSet.has(msg.eventId) ||
         (captionForThis && unreadSnapshotMessageSet.has(captionForThis.eventId)) ||
         activeHighlightMessageSet.has(msg.eventId)
       )}
 
       {#if !caption}
      <div
        class={`flex ${msg.direction === "sent" ? "justify-end" : "justify-start"} items-end gap-2`}
        in:fly={{ y: 20, duration: 300, easing: cubicOut }}
      >
        {#if msg.direction === "received" && partnerNpub && !caption}
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

        <div
          role="button"
          tabindex="0"
          class={`${useFullWidthBubbles ? 'max-w-full' : 'max-w-[70%]'} p-3 shadow-sm cursor-pointer transition-all duration-150 ease-out relative ${isAndroidShell ? 'select-none' : ''}
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
               onMediaLoad={handleMediaLoad}
             />

            {#if captionForThis}
              <div class="mt-2 text-sm text-gray-900 dark:text-slate-100">
                {@html highlightPlainTextToHtml(captionForThis.message, isSearchActive ? searchQuery : '')}
              </div>
            {/if}

           <MessageReactions
             targetEventId={msg.rumorId || ''}
             isOwn={msg.direction === "sent"}
           />

          <div
            class={`typ-meta mt-1 text-right ${msg.direction === "sent" ? "text-blue-100" : "text-gray-400"} cursor-help`}
            title={new Date(msg.sentAt).toLocaleString()}
          >
            {getRelativeTime(msg.sentAt)}
          </div>
          {#if msg.direction === "sent" && i === getLastSentIndex(displayMessages) && partnerNpub}
            {#if $lastRelaySendStatus && $lastRelaySendStatus.recipientNpub === partnerNpub}
              <div class="typ-meta mt-0.5 text-right text-blue-100">
                {#if $lastRelaySendStatus.successfulRelays === 0}
                  sending...
                {:else}
                  sent to {$lastRelaySendStatus.successfulRelays}/{$lastRelaySendStatus.desiredRelays} relays
                {/if}
              </div>
            {:else if msg.eventId && msg.eventId.startsWith('optimistic:')}
              <div class="typ-meta mt-0.5 text-right text-blue-100">
                sending...
              </div>
            {/if}
          {/if}
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
      {/if}
    {/each}
  </div>

  <div
    class="absolute bottom-0 left-0 right-0 z-20 p-4 border-t border-gray-200/50 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg transition-all duration-150 ease-out"
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
          class="absolute bottom-full mb-2 left-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden w-64 z-50"
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
        <MediaUploadButton onFileSelect={handleFileSelect} inline={true} allowedTypes={["image", "video", "audio"]} dmEncrypted={true} />
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

        {#if inputText.trim().length > 0}
          <Button
            type="submit"
            variant="primary"
            size="icon"
            class="hidden md:inline-flex flex-shrink-0"
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
      </div>
    </form>
  </div>
</div>

<ContextMenu
  isOpen={contextMenu.isOpen}
  x={contextMenu.x}
  y={contextMenu.y}
  onClose={closeContextMenu}
  onCite={citeMessage}
  onReact={reactToMessage}
  onCopy={copyMessage}
/>
