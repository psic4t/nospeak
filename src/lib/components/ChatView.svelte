<script lang="ts">
  import type { Message } from "$lib/db/db";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import { messagingService } from "$lib/core/Messaging";
  import Avatar from "./Avatar.svelte";
  import MessageContent from "./MessageContent.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import MediaUploadButton from "./MediaUploadButton.svelte";
  import { currentUser } from "$lib/stores/auth";
  import { emojis } from "$lib/utils/emojis";
  import { goto } from '$app/navigation';
  import { softVibrate } from '$lib/utils/haptics';
  import { lastRelaySendStatus, clearRelayStatus } from '$lib/stores/sending';
  import { openProfileModal } from '$lib/stores/modals';
  import { openImageViewer } from '$lib/stores/imageViewer';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { nativeDialogService, isAndroidNative } from '$lib/core/NativeDialogs';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';

  let {
    messages = [],
    partnerNpub,
    onLoadMore,
    isFetchingHistory = false,
    canRequestNetworkHistory = false,
    onRequestNetworkHistory,
    networkHistoryStatus = 'idle'
  } = $props<{
    messages: Message[];
    partnerNpub?: string;
    onLoadMore?: () => void;
    isFetchingHistory?: boolean;
    canRequestNetworkHistory?: boolean;
    onRequestNetworkHistory?: () => void;
    networkHistoryStatus?: 'idle' | 'loading' | 'no-more' | 'error';
  }>();

  let inputText = $state("");
  let partnerName = $state("");
  let partnerPicture = $state<string | undefined>(undefined);
  let myPicture = $state<string | undefined>(undefined);
  let isSending = $state(false);
  let chatContainer: HTMLElement;
  let inputElement: HTMLTextAreaElement;
  let currentTime = $state(Date.now());
  let relayStatusTimeout: number | null = null;
   
  let previousScrollHeight = 0;
  let isLoadingMore = false;


  // Context menu state
  let contextMenu = $state({
    isOpen: false,
    x: 0,
    y: 0,
    message: null as Message | null,
  });
  let longPressTimer: number | null = null;

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

  function getLastSentIndex(): number {
    let index = -1;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].direction === "sent") {
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
    messages.length;

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
      if (!chatContainer) return;
      if (chatContainer.scrollTop < 50 && onLoadMore && !isLoadingMore && messages.length > 0) {
          isLoadingMore = true;
          previousScrollHeight = chatContainer.scrollHeight;
          onLoadMore();
      }
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

  // Global listener so page keys work while typing
  $effect(() => {
      if (typeof window === 'undefined') return;

      const onKeydown = (e: KeyboardEvent) => {
          if (!partnerNpub || !chatContainer) return;

          const activeEl = typeof document !== 'undefined'
              ? (document.activeElement as HTMLElement | null)
              : null;

          const isInputFocused = activeEl === inputElement;
          const isInsideChat = !!activeEl && chatContainer.contains(activeEl);

          if (!isInputFocused && !isInsideChat) {
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


  async function send() {
    if (!partnerNpub || !inputText.trim()) return;

    const text = inputText;
    inputText = ""; // Clear immediately for UX
    if (inputElement) {
      inputElement.style.height = "auto";
    }
    isSending = true;

    try {
      await messagingService.sendMessage(partnerNpub, text);
      // The message will appear via reactive prop update from parent
      scrollToBottom();
    } catch (e) {
      console.error("Failed to send message:", e);
      await nativeDialogService.alert({
        title: 'Send failed',
        message: 'Failed to send message: ' + (e as Error).message
      });
      inputText = text; // Restore text on failure
    } finally {
      isSending = false;
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

    if (!contextMenu.message.rumorId) {
      await nativeDialogService.alert({
        title: 'Cannot React',
        message: 'This message is too old to support reactions.'
      });
      return;
    }

    try {
      await messagingService.sendReaction(partnerNpub, {
        recipientNpub: contextMenu.message.recipientNpub,
        eventId: contextMenu.message.eventId,
        rumorId: contextMenu.message.rumorId,
        direction: contextMenu.message.direction
      }, emoji);
    } catch (e) {
      console.error('Failed to send reaction:', e);
      await nativeDialogService.alert({
        title: 'Reaction failed',
        message: 'Failed to send reaction: ' + (e as Error).message
      });
    }
  }

  function handleFileSelect(file: File, type: 'image' | 'video' | 'audio', url?: string) {
    if (url) {
      // Insert the full file URL into the message input (no markdown)
      inputText = (inputText ? inputText + '\n' : '') + url;
      
      // Focus input and set cursor to end
      setTimeout(() => {
        if (inputElement) {
          inputElement.focus();
          inputElement.setSelectionRange(inputText.length, inputText.length);
          // Auto-resize if needed
          inputElement.style.height = "auto";
          inputElement.style.height = Math.min(inputElement.scrollHeight, 150) + "px";
        }
      }, 0);
    }
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

<div class="relative flex flex-col h-full overflow-hidden bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
  {#if partnerNpub}
    <div
      class="absolute top-0 left-0 right-0 z-20 p-2 h-16 border-b border-gray-200/50 dark:border-slate-700/70 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm transition-all duration-150 ease-out"
    >
      <div class="flex items-center gap-3">
        <button 
            onclick={() => {
                softVibrate();
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
      <img
         src="/nospeak.svg"
         alt="nospeak"
         class="absolute right-4 z-50 pointer-events-none rounded-lg p-3 app-logo"
         style="width: 38px; height: 38px; padding: 0rem;"
       />
    </div>
  {/if}

  <div
    bind:this={chatContainer}
    class="flex-1 overflow-y-auto px-4 pb-28 pt-20 space-y-4 custom-scrollbar"
    onscroll={handleScroll}
  >
    {#if canRequestNetworkHistory && messages.length > 0}
        <div class="flex justify-center p-2">
          <button
           class="typ-meta px-4 py-1.5 rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-slate-700/60 text-gray-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700/90 transition-all shadow-sm"
           type="button"
           onclick={() => onRequestNetworkHistory && onRequestNetworkHistory()}
         >
           {$t('chat.history.fetchOlder')}
         </button>
       </div>

    {:else if networkHistoryStatus === 'no-more' && messages.length > 0}
        <div class="flex justify-center p-2">
          <div class="px-3 py-1 rounded-full typ-meta bg-white/70 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70 text-gray-500 dark:text-slate-300 shadow-sm backdrop-blur-sm">
           {$t('chat.history.none')}
         </div>

       </div>

    {:else if networkHistoryStatus === 'error' && messages.length > 0}
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
 
    {#if messages.length === 0 && !isFetchingHistory}
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


    {#each messages as msg, i (msg.id || i)}
      {#if i === 0 || !isSameDay(msg.sentAt, messages[i - 1].sentAt)}
        <div class="flex justify-center my-2">
          <div class="px-3 py-1 rounded-full typ-meta bg-white/70 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70 text-gray-600 dark:text-slate-200 shadow-sm backdrop-blur-sm">
            {formatDateLabel(msg.sentAt)}
          </div>
        </div>
      {/if}
      <div
        class={`flex ${msg.direction === "sent" ? "justify-end" : "justify-start"} items-end gap-2`}
        in:fly={{ y: 20, duration: 300, easing: cubicOut }}
      >
        {#if msg.direction === "received" && partnerNpub}
          <button
            class="mb-1 hover:opacity-80 transition-opacity duration-150 ease-out cursor-pointer"
            onclick={() => partnerNpub && openProfile(partnerNpub)}
          >
            <Avatar
              npub={partnerNpub}
              src={partnerPicture}
              size="md"
              class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
            />
          </button>
        {/if}

        <div
          role="button"
          tabindex="0"
          class={`max-w-[70%] p-3 shadow-sm cursor-pointer transition-all duration-150 ease-out relative
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
           <MessageContent
             content={msg.message}
             isOwn={msg.direction === "sent"}
             onImageClick={openImageViewer}
           />

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
          {#if msg.direction === "sent" && i === getLastSentIndex() && $lastRelaySendStatus && $lastRelaySendStatus.recipientNpub === partnerNpub}
            <div class="typ-meta mt-0.5 text-right text-blue-100">
              sent to {$lastRelaySendStatus.successfulRelays}/{$lastRelaySendStatus.desiredRelays} relays
            </div>
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
              class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
            />
          </button>
        {/if}
      </div>
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
        <MediaUploadButton onFileSelect={handleFileSelect} inline={true} allowedTypes={["image", "video", "audio"]} />
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
          <button
            type="submit"
            class="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-50"
            style="background-color: var(--color-green);"
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
          </button>
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
/>
