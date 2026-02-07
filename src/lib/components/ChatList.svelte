<script lang="ts">
  import { currentUser } from "$lib/stores/auth";
  import ConnectionStatus from "./ConnectionStatus.svelte";
  import { authService } from "$lib/core/AuthService";
  import { contactRepo } from "$lib/db/ContactRepository";
  import { messageRepo } from "$lib/db/MessageRepository";
  import { conversationRepo, generateGroupTitle, isGroupConversationId } from "$lib/db/ConversationRepository";
  import { liveQuery } from "dexie";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import type { ContactItem, Conversation } from "$lib/db/db";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Avatar from "./Avatar.svelte";
  import GroupAvatar from "./GroupAvatar.svelte";
  import { hapticSelection } from "$lib/utils/haptics";
  import { onMount } from "svelte";

  import * as modals from "$lib/stores/modals";
  import { t } from "$lib/i18n";
  import { get } from "svelte/store";
  import { isAndroidNative } from "$lib/core/NativeDialogs";
  import Button from "$lib/components/ui/Button.svelte";
  import Tab from "$lib/components/ui/Tab.svelte";
  import { getMediaPreviewLabel, getLocationPreviewLabel } from "$lib/utils/mediaPreview";
  import { overscroll } from "$lib/utils/overscroll";

  // Extended contact type that includes group chats
  interface ChatListItem {
    id: string; // npub for contacts, conversationId for groups
    isGroup: boolean;
    name: string;
    picture?: string;
    participants?: string[]; // Only for groups
    hasUnread: boolean;
    lastMessageTime: number;
    nip05?: string;
    nip05Status?: 'valid' | 'invalid' | 'unknown';
    lastMessageText?: string;
  }

  let chatItems = $state<ChatListItem[]>([]);
  let filter = $state<'all' | 'unread' | 'groups'>('all');

  let filteredChatItems = $derived(
    filter === 'all' ? chatItems :
    filter === 'unread' ? chatItems.filter(item => item.hasUnread) :
    chatItems.filter(item => item.isGroup)
  );

  const isAndroidApp = isAndroidNative();
  let myPicture = $state<string | undefined>(undefined);

  $effect(() => {
    if (!$currentUser) {
      myPicture = undefined;
      return;
    }

    const npub = $currentUser.npub;

    const sub = liveQuery(() =>
      profileRepo.getProfileIgnoreTTL(npub),
    ).subscribe((p) => {
      if (p && p.metadata) {
        myPicture = p.metadata.picture;
      } else {
        myPicture = undefined;
      }
    });

    return () => {
      sub.unsubscribe();
    };
  });

  function parseMarkdownPreview(text: string): string {
    // Escape HTML entities first for security
    text = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Strip citation markers for preview
    text = text.replace(/^&gt; /gm, "");
    // Strip list markers for preview (- item, * item, 1. item)
    text = text.replace(/^[-*] /gm, "");
    text = text.replace(/^\d+\. /gm, "");
    // Bold (**text**)
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Italic (*text*)
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return text;
  }

  async function refreshChatList(dbContacts: ContactItem[]): Promise<void> {
    console.log("ChatList: Processing contacts from DB:", dbContacts.length);

    // 1. Process regular 1-on-1 contacts
    const contactItems: ChatListItem[] = await Promise.all(
      dbContacts.map(async (c) => {
        const profile = await profileRepo.getProfileIgnoreTTL(c.npub);
        // Fetch recent messages for display and unread calculation
        const recentMsgs = await messageRepo.getMessages(c.npub, 10);
        const lastMsg = recentMsgs[recentMsgs.length - 1]; // Most recent for display
        const lastMsgTime = lastMsg ? lastMsg.sentAt : 0;
        // For unread indicator, only consider received messages (not sent from other clients)
        const lastReceivedMsg = recentMsgs
          .filter((m) => m.direction === "received")
          .pop();
        const lastReceivedTime = lastReceivedMsg ? lastReceivedMsg.sentAt : 0;
        const lastActivityTime = Math.max(
          lastReceivedTime,
          c.lastActivityAt || 0,
        );

        let lastMessageText = "";
        if (lastMsg) {
          if (lastMsg.fileUrl && lastMsg.fileType) {
            // Media attachment - show friendly label only (message field contains URL, not caption)
            lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
          } else if (lastMsg.location) {
            // Location message - show friendly label instead of raw geo: string
            lastMessageText = getLocationPreviewLabel();
          } else {
            // Regular text message
            lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
          }

          if (lastMessageText && lastMsg.direction === "sent") {
            lastMessageText = `${get(t)("contacts.youPrefix") || "You"}: ${lastMessageText}`;
          }
        }

        let name = c.npub.slice(0, 10) + "...";
        let picture = undefined;
        let nip05: string | undefined = undefined;
        let nip05Status: "valid" | "invalid" | "unknown" | undefined =
          undefined;

        if (profile && profile.metadata) {
          // Prioritize name fields
          name =
            profile.metadata.name ||
            profile.metadata.display_name ||
            profile.metadata.displayName ||
            name;
          picture = profile.metadata.picture;
          nip05 = profile.metadata.nip05 || undefined;
          nip05Status = profile.nip05Status;
        }
        return {
          id: c.npub,
          isGroup: false,
          name: name,
          picture: picture,
          hasUnread: lastActivityTime > (c.lastReadAt || 0),
          lastMessageTime: lastMsgTime,
          nip05,
          nip05Status,
          lastMessageText: lastMessageText || undefined,
        };
      }),
    );

    // 2. Process group conversations
    const groupConversations = await conversationRepo.getGroupConversations();
    console.log("ChatList: Processing group conversations:", groupConversations.length);

    const groupItems: ChatListItem[] = await Promise.all(
      groupConversations.map(async (conv) => {
        // Fetch recent messages for display and unread calculation
        const recentMsgs = await messageRepo.getMessagesByConversationId(conv.id, 10);
        const lastMsg = recentMsgs[recentMsgs.length - 1]; // Most recent for display
        const lastMsgTime = lastMsg ? lastMsg.sentAt : conv.lastActivityAt;
        // For unread indicator, only consider received messages (not sent from other clients)
        const lastReceivedMsg = recentMsgs
          .filter((m) => m.direction === "received")
          .pop();
        const lastReceivedTime = lastReceivedMsg ? lastReceivedMsg.sentAt : 0;

        let lastMessageText = "";
        if (lastMsg) {
          if (lastMsg.fileUrl && lastMsg.fileType) {
            lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
          } else if (lastMsg.location) {
            lastMessageText = getLocationPreviewLabel();
          } else {
            lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
          }

          // For group messages, show sender name if it's not from us
          if (lastMessageText && lastMsg.direction === "sent") {
            lastMessageText = `${get(t)("contacts.youPrefix") || "You"}: ${lastMessageText}`;
          } else if (lastMessageText && lastMsg.senderNpub) {
            // Get sender's name
            const senderProfile = await profileRepo.getProfileIgnoreTTL(lastMsg.senderNpub);
            const senderName = senderProfile?.metadata?.name || 
                               senderProfile?.metadata?.display_name ||
                               lastMsg.senderNpub.slice(0, 8) + '...';
            lastMessageText = `${senderName}: ${lastMessageText}`;
          }
        }

        // Generate group title from participants or use stored subject
        let groupName = conv.subject;
        if (!groupName) {
          // Generate from participant names
          const participantNames = await Promise.all(
            conv.participants
              .filter((p: string) => p !== $currentUser?.npub) // Exclude self
              .slice(0, 5) // Limit to avoid too many lookups
              .map(async (npub: string) => {
                const profile = await profileRepo.getProfileIgnoreTTL(npub);
                return profile?.metadata?.name || 
                       profile?.metadata?.display_name || 
                       npub.slice(0, 8) + '...';
              })
          );
          groupName = generateGroupTitle(participantNames);
        }

        const hasUnread = lastReceivedTime > (conv.lastReadAt || 0);

        return {
          id: conv.id,
          isGroup: true,
          name: groupName,
          participants: conv.participants,
          hasUnread,
          lastMessageTime: lastMsgTime,
          lastMessageText: lastMessageText || undefined,
        };
      }),
    );

    // 3. Combine and sort all chat items
    const allItems = [...contactItems, ...groupItems];
    
    // Filter out items with no messages
    const itemsWithMessages = allItems.filter(item => item.lastMessageTime > 0);

    // Sort by last message time (most recent first)
    const sortedItems = itemsWithMessages.sort(
      (a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0),
    );
    
    console.log(
      "ChatList: Updating with",
      sortedItems.length,
      "items (contacts:",
      contactItems.filter(c => c.lastMessageTime > 0).length,
      ", groups:",
      groupItems.length,
      ")",
    );
    
    chatItems = sortedItems;
  }

  // Sync contacts and group conversations from DB
  // Use onMount instead of $effect to avoid infinite loop when updating store
  onMount(() => {
    console.log("ChatList: Setting up liveQuery subscription");

    // Watch contacts table changes for reactivity
    const contactsSub = liveQuery(() => {
      console.log("ChatList: liveQuery triggered - contacts table changed");
      return contactRepo.getContacts();
    }).subscribe(async (dbContacts) => {
      await refreshChatList(dbContacts as ContactItem[]);
    });

    const handleNewMessage = async () => {
      try {
        const dbContacts = await contactRepo.getContacts();
        await refreshChatList(dbContacts as ContactItem[]);
      } catch (e) {
        console.error("ChatList: Failed to refresh after new message", e);
      }
    };

    const handleProfilesUpdated = async () => {
      try {
        const dbContacts = await contactRepo.getContacts();
        await refreshChatList(dbContacts as ContactItem[]);
      } catch (e) {
        console.error("ChatList: Failed to refresh after profiles updated", e);
      }
    };

    const handleConversationUpdated = async () => {
      try {
        const dbContacts = await contactRepo.getContacts();
        await refreshChatList(dbContacts as ContactItem[]);
      } catch (e) {
        console.error("ChatList: Failed to refresh after conversation updated", e);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "nospeak:new-message",
        handleNewMessage as EventListener,
      );
      window.addEventListener(
        "nospeak:profiles-updated",
        handleProfilesUpdated as EventListener,
      );
      window.addEventListener(
        "nospeak:conversation-updated",
        handleConversationUpdated as EventListener,
      );
    }

    return () => {
      console.log("ChatList: Cleaning up liveQuery subscription");
      contactsSub.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "nospeak:new-message",
          handleNewMessage as EventListener,
        );
        window.removeEventListener(
          "nospeak:profiles-updated",
          handleProfilesUpdated as EventListener,
        );
        window.removeEventListener(
          "nospeak:conversation-updated",
          handleConversationUpdated as EventListener,
        );
      }
    };
  });

  function selectChat(id: string) {
    hapticSelection();
    goto(`/chat/${id}`, { invalidateAll: true });
  }
</script>

<div
  role="presentation"
  oncontextmenu={(e) => {
    if (!isAndroidApp) return;
    e.preventDefault();
    e.stopPropagation();
  }}
  onselectstart={(e) => {
    if (!isAndroidApp) return;
    e.preventDefault();
  }}
  class:select-none={isAndroidApp}
  class:androidNoCallout={isAndroidApp}
  class="relative flex flex-col h-full bg-white/50 dark:bg-slate-900/50 {isAndroidApp ? '' : 'backdrop-blur-sm'} border-r border-gray-200/50 dark:border-slate-700/70 overflow-hidden"
>
  <div
    class="absolute top-0 left-0 right-0 z-20 flex flex-col pt-safe bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-700/70 shadow-sm transition-all duration-200"
  >
    <div class="p-2 h-16 flex items-center justify-between relative">
      {#if $currentUser}
        <div class="flex items-center gap-2">
          <button
            onclick={() => {
              hapticSelection();
              modals.openProfileModal($currentUser.npub);
            }}
            class="flex items-center"
            aria-label="Open profile"
          >
            <Avatar
              npub={$currentUser.npub}
              src={myPicture}
              size="md"
              class="!w-11 !h-11 transition-all duration-150 ease-out"
            />
          </button>

          <Button
            onclick={() => {
              modals.showUserQrModal.set(true);
            }}
            size="icon"
            aria-label="Show nostr QR code"
          >
            <svg
              class="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="6" height="6"></rect>
              <rect x="15" y="3" width="6" height="6"></rect>
              <rect x="3" y="15" width="6" height="6"></rect>
              <path d="M15 15h2v2h-2z"></path>
              <path d="M19 15h2v2h-2z"></path>
              <path d="M15 19h2v2h-2z"></path>
            </svg>
          </Button>
        </div>
      {/if}

      <span
        class="absolute left-1/2 -translate-x-1/2 typ-section text-gray-900 dark:text-white tracking-tight pointer-events-none"
      >
        nospeak
      </span>
      <Button
        onclick={() => {
          modals.showSettingsModal.set(true);
        }}
        size="icon"
        aria-label="Open settings"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          ></path>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          ></path>
        </svg>
      </Button>
    </div>
    <Tab
      bind:value={filter}
      tabs={[
        { value: 'all', label: $t('chats.filterAll') },
        { value: 'unread', label: $t('chats.filterUnread') },
        { value: 'groups', label: $t('chats.filterGroups') }
      ]}
      ariaLabel="Filter chats"
      class="px-2"
    />
  </div>

  <div class="flex-1 overflow-y-auto custom-scrollbar native-scroll pt-[calc(120px+env(safe-area-inset-top))] pb-safe-offset-16" use:overscroll>
    {#if chatItems.length === 0}
      <div class="space-y-3 p-3 animate-pulse">
        {#each Array(5) as _}
          <div
            class="flex items-center gap-3 p-3 rounded-full bg-[rgb(var(--color-lavender-rgb)/0.10)] dark:bg-[rgb(var(--color-lavender-rgb)/0.14)]"
          >
            <div
              class="w-12 h-12 rounded-full bg-gray-200/50 dark:bg-slate-700/50"
            ></div>
            <div class="flex-1 space-y-2">
              <div
                class="h-4 bg-gray-200/50 dark:bg-slate-700/50 rounded w-2/3"
              ></div>
              <div
                class="h-3 bg-gray-200/50 dark:bg-slate-700/50 rounded w-1/3"
              ></div>
            </div>
          </div>
        {/each}
        <div class="text-center text-sm text-gray-700 dark:text-slate-400 mt-4">
          {$t("chats.emptyHint")}
        </div>
      </div>
    {:else if filteredChatItems.length === 0}
      <div class="text-center text-sm text-gray-500 dark:text-slate-400 mt-8 px-4">
        {#if filter === 'unread'}
          {$t("chats.emptyUnread")}
        {:else if filter === 'groups'}
          {$t("chats.emptyGroups")}
        {/if}
      </div>
    {/if}
    {#each filteredChatItems as item}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        onclick={() => selectChat(item.id)}
        oncontextmenu={(e) => {
          if (!isAndroidApp) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        onselectstart={(e) => {
          if (!isAndroidApp) return;
          e.preventDefault();
        }}
        class:select-none={isAndroidApp}
        class={`p-3 mx-2 my-1.5 rounded-full cursor-pointer flex items-center gap-3 transition-all duration-200 ease-out group active:scale-[0.98] ${
          page.url.pathname.includes(item.id)
            ? "bg-[rgb(var(--color-lavender-rgb)/0.20)] dark:bg-[rgb(var(--color-lavender-rgb)/0.24)] text-gray-900 dark:text-[rgb(var(--color-text-rgb)/0.92)] shadow-sm hover:shadow hover:bg-[rgb(var(--color-lavender-rgb)/0.26)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.30)] active:bg-[rgb(var(--color-lavender-rgb)/0.32)] dark:active:bg-[rgb(var(--color-lavender-rgb)/0.36)]"
            : "bg-transparent text-gray-700 dark:text-gray-400 hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        {#if item.isGroup}
          <GroupAvatar
            participants={item.participants || []}
            size="md"
            class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
          />
        {:else}
          <Avatar
            npub={item.id}
            src={item.picture}
            size="md"
            class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
          />
        {/if}

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 min-w-0">
            <span
              class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]"
              >{item.name}</span
            >
            {#if item.isGroup}
              <!-- Group icon indicator -->
              <svg
                class="shrink-0 text-gray-600 dark:text-slate-300"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            {:else if item.nip05Status === "valid"}
              <svg
                class="shrink-0 text-green-500"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
            {/if}
          </div>
          {#if item.lastMessageText}
            <div
              class="typ-body text-gray-800 dark:text-slate-300 truncate"
            >
              {@html parseMarkdownPreview(item.lastMessageText)}
            </div>
          {/if}
        </div>
        {#if item.hasUnread}
          <div class="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
        {/if}
      </div>
    {/each}
  </div>

  <ConnectionStatus />

  <!-- FAB button to open contacts -->
  <button
    onclick={() => {
      hapticSelection();
      if (isAndroidApp) {
        goto('/contacts');
      } else {
        modals.showManageContactsModal.set(true);
      }
    }}
    class="absolute right-4 w-14 h-14 rounded-full bg-[rgb(var(--color-lavender-rgb))] text-white dark:text-[rgb(var(--color-crust-rgb))] shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition-transform mb-safe {isAndroidApp ? 'bottom-24' : 'bottom-16'}"
    aria-label={$t("chats.addContact")}
  >
    <svg
      class="w-7 h-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </button>
</div>

<style>
  .androidNoCallout :global(*) {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
</style>
