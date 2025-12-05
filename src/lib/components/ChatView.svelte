<script lang="ts">
  import type { Message } from "$lib/db/db";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import ProfileModal from "./ProfileModal.svelte";
  import { messagingService } from "$lib/core/Messaging";
  import Avatar from "./Avatar.svelte";
  import MessageContent from "./MessageContent.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import MediaUploadButton from "./MediaUploadButton.svelte";
  import { currentUser } from "$lib/stores/auth";
  import { emojis } from "$lib/utils/emojis";
  import { goto } from '$app/navigation';
  import { softVibrate } from '$lib/utils/haptics';
  import { lastRelaySendStatus, clearRelayStatus } from '$lib/stores/sending';

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
  let isProfileOpen = $state(false);
  let profileModalNpub = $state<string | undefined>(undefined);
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
    messageContent: "",
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
    profileModalNpub = npub;
    isProfileOpen = true;
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

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
    return `${years} year${years !== 1 ? "s" : ""} ago`;
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
      alert("Failed to send message: " + (e as Error).message);
      inputText = text; // Restore text on failure
    } finally {
      isSending = false;
    }
  }

  function openContextMenu(e: MouseEvent, messageContent: string) {
    e.preventDefault();
    contextMenu = {
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      messageContent,
    };
  }

  function closeContextMenu() {
    contextMenu.isOpen = false;
  }

  function citeMessage() {
    const citedContent = contextMenu.messageContent
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

  function handleMouseDown(e: MouseEvent, messageContent: string) {
    // Start long press timer for touch devices
    longPressTimer = window.setTimeout(() => {
      openContextMenu(e, messageContent);
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

  function handleContextMenu(e: MouseEvent, messageContent: string) {
    openContextMenu(e, messageContent);
  }

  function handleFileSelect(file: File, type: 'image' | 'video', url?: string) {
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

<div class="flex flex-col h-full overflow-hidden">
  {#if partnerNpub}
    <div
      class="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 flex-shrink-0"
    >
      <div class="flex items-center gap-3">
        <button 
            onclick={() => {
                softVibrate();
                goto('/chat');
            }}
            class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Back to contacts"
        >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
        </button>
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

  <div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4" onscroll={handleScroll}>
    {#if canRequestNetworkHistory && messages.length > 0}
      <div class="flex justify-center p-2">
        <button
          class="text-xs px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          type="button"
          onclick={() => onRequestNetworkHistory && onRequestNetworkHistory()}
        >
          Fetch older messages from relays
        </button>
      </div>
    {:else if networkHistoryStatus === 'no-more' && messages.length > 0}
      <div class="flex justify-center p-2 text-xs text-gray-400">
        No more messages available from relays
      </div>
    {:else if networkHistoryStatus === 'error' && messages.length > 0}
      <div class="flex justify-center p-2 text-xs text-red-500">
        Failed to fetch older messages. Try again later.
      </div>
    {/if}

    {#if isFetchingHistory}
      <div class="flex justify-center p-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    {/if}

    {#if messages.length === 0 && !isFetchingHistory}
      <div class="text-center text-gray-400 mt-10">No messages yet</div>
    {/if}

    {#each messages as msg, i}

      <div
        class={`flex ${msg.direction === "sent" ? "justify-end" : "justify-start"} items-end gap-2`}
      >
        {#if msg.direction === "received" && partnerNpub}
          <button
            class="mb-1 hover:opacity-80 transition-opacity cursor-pointer"
            onclick={() => partnerNpub && openProfile(partnerNpub)}
          >
            <Avatar 
                npub={partnerNpub} 
                src={partnerPicture} 
                size="md" 
                class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-200"
            />
          </button>
        {/if}

        <div
          role="button"
          tabindex="0"
          class={`max-w-[70%] p-3 rounded-lg shadow-sm cursor-pointer transition-colors
                         ${
                           msg.direction === "sent"
                             ? "bg-blue-500 text-white rounded-br-none hover:bg-blue-600"
                             : "bg-white dark:bg-gray-700 dark:text-white border dark:border-gray-600 rounded-bl-none hover:bg-gray-50 dark:hover:bg-gray-600"
                         }`}
          oncontextmenu={(e) => handleContextMenu(e, msg.message)}
          onmousedown={(e) => handleMouseDown(e, msg.message)}
          onmouseup={handleMouseUp}
          onmouseleave={handleMouseUp}
        >
          <MessageContent content={msg.message} />
          <div
            class={`text-[10px] mt-1 text-right ${msg.direction === "sent" ? "text-blue-100" : "text-gray-400"} cursor-help`}
            title={new Date(msg.sentAt).toLocaleString()}
          >
            {getRelativeTime(msg.sentAt)}
          </div>
          {#if msg.direction === "sent" && i === getLastSentIndex() && $lastRelaySendStatus && $lastRelaySendStatus.recipientNpub === partnerNpub}
            <div class="text-[10px] mt-0.5 text-right text-blue-100">
              sent to {$lastRelaySendStatus.successfulRelays}/{$lastRelaySendStatus.desiredRelays} relays
            </div>
          {/if}
        </div>

        {#if msg.direction === "sent" && $currentUser}
          <button
            class="mb-1 hover:opacity-80 transition-opacity cursor-pointer"
            onclick={() => $currentUser && openProfile($currentUser.npub)}
          >
            <Avatar 
                npub={$currentUser.npub} 
                src={myPicture} 
                size="md" 
                class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-200"
            />
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <div
    class="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0"
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
          class="absolute bottom-full mb-2 left-12 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded-lg overflow-hidden w-64 z-50"
        >
          {#each filteredEmojis as emoji, i}
            <button
              type="button"
              class={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${i === emojiSelectedIndex ? "bg-blue-50 dark:bg-gray-700" : ""}`}
              onclick={() => selectEmoji(emoji)}
            >
              <span class="text-xl">{emoji.char}</span>
              <span class="text-sm text-gray-600 dark:text-gray-300"
                >:{emoji.name}:</span
              >
            </button>
          {/each}
        </div>
      {/if}

      <div
        class="flex-1 flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-0.5 gap-2"
      >
        <MediaUploadButton onFileSelect={handleFileSelect} inline={true} />
        <textarea
          bind:this={inputElement}
          bind:value={inputText}
          oninput={handleInput}
          onkeydown={handleKeydown}
          disabled={isSending}
          rows="1"
          class="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm md:text-base dark:text-white disabled:opacity-50 resize-none overflow-hidden placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder="Type a message..."
        ></textarea>

        {#if inputText.trim().length > 0}
          <button
            type="submit"
            class="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
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

{#if partnerNpub || profileModalNpub}
  <ProfileModal
    isOpen={isProfileOpen}
    close={() => (isProfileOpen = false)}
    npub={profileModalNpub || partnerNpub || ""}
  />
{/if}

<ContextMenu
  isOpen={contextMenu.isOpen}
  x={contextMenu.x}
  y={contextMenu.y}
  onClose={closeContextMenu}
  onCite={citeMessage}
/>
