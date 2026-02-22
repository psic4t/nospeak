<script lang="ts">
  import "../app.css";
  import { isOnline, showRelayStatusModal } from "$lib/stores/connection";
  import { authService, checkAndAutoSetRelays } from "$lib/core/AuthService";
  import { initRuntimeConfig } from "$lib/core/runtimeConfig";
  import { onMount } from "svelte";
  import { pwaInfo } from 'virtual:pwa-info';
  import { goto } from "$app/navigation";
   import { page } from "$app/state";
   import { hapticSelection } from "$lib/utils/haptics";
    import { currentUser } from "$lib/stores/auth";
     import { clearAppBadge, initAppVisibilityAndFocusTracking, syncAppBadge } from "$lib/stores/unreadMessages";
 
    import { nip19 } from 'nostr-tools';
    import { AndroidNotificationRouter, type AndroidNotificationRoutePayload } from '$lib/core/AndroidNotificationRouter';
    import { AndroidShareTarget, type AndroidSharePayload, fileFromAndroidMediaPayload } from '$lib/core/AndroidShareTarget';
   import { setPendingAndroidMediaShare, setPendingAndroidTextShare } from '$lib/stores/androidShare';
 
    import RelayStatusModal from "$lib/components/RelayStatusModal.svelte";
    import SettingsModal from "$lib/components/SettingsModal.svelte";
    import ManageContactsModal from "$lib/components/ManageContactsModal.svelte";
    import CreateGroupChatModal from "$lib/components/CreateGroupChatModal.svelte";
    import ProfileModal from "$lib/components/ProfileModal.svelte";
    import EmptyProfileModal from "$lib/components/EmptyProfileModal.svelte";
    import ScanContactQrModal from "$lib/components/ScanContactQrModal.svelte";
    import ScanContactQrResultModal from "$lib/components/ScanContactQrResultModal.svelte";
    import * as modals from "$lib/stores/modals";
    import SyncProgressModal from "$lib/components/SyncProgressModal.svelte";
    import SignerMismatchModal from "$lib/components/SignerMismatchModal.svelte";
 
 
   import { syncState } from "$lib/stores/sync";
   import { signerMismatch } from "$lib/stores/signerMismatch";

   import { configureAndroidStatusBar } from "$lib/core/StatusBar";
   import { initLanguage, language } from "$lib/stores/language";
   import { isRtlLanguage } from "$lib/i18n";
   import { isAndroidNative, nativeDialogService } from "$lib/core/NativeDialogs";
   import { initAndroidBackNavigation } from "$lib/core/AndroidBackHandler";
     import ImageViewerOverlay from "$lib/components/ImageViewerOverlay.svelte";
     import Toast from "$lib/components/Toast.svelte";
     import PinLockScreen from "$lib/components/PinLockScreen.svelte";
     import PinSetupModal from "$lib/components/PinSetupModal.svelte";
     import { isPinLocked, initPinState, lockApp, clearPinData } from "$lib/stores/pin";
     import { pinSetupModalState, closePinSetupModal } from "$lib/stores/modals";
 

   const { showSettingsModal, showManageContactsModal, showCreateGroupModal, showEmptyProfileModal, showUserQrModal, showScanContactQrModal, profileModalState, scanContactQrResultState, closeProfileModal, closeScanContactQrResult } = modals;
 
   let { children } = $props();

  let isInitialized = $state(false);
  let showProfileRefreshBanner = $state(false);
  let profileRefreshMessage = $state("");
  let isAndroidApp = $state(isAndroidNative());
  let hadUser = false;

  const webManifestLinkTag = pwaInfo?.webManifest.linkTag ?? "";

  // Global click handler for link vibration
  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
        hapticSelection();
    }
  }

  // Close all modals and clear PIN state when user logs out
  $effect(() => {
          if (!$currentUser) {
              showSettingsModal.set(false);
              showManageContactsModal.set(false);
              showRelayStatusModal.set(false);
              showUserQrModal.set(false);
              showScanContactQrModal.set(false);
               closeScanContactQrResult();
               closeProfileModal();

               // Only clear PIN data on actual logout (user was logged in, now isn't)
               if (hadUser) {
                   clearPinData();
               }
         } else {
              hadUser = true;
         }

   });

  // Redirect authenticated users away from login page (safety net for back navigation)
  // Skip during active sync flow — login methods handle their own navigation
  $effect(() => {
      if ($currentUser && page.url.pathname === '/' && !$syncState.flowActive) {
          goto('/chat', { replaceState: true });
      }
  });

  // Set document direction and lang attribute based on active language
  $effect(() => {
      const lang = $language;
      document.documentElement.lang = lang;
      document.documentElement.dir = isRtlLanguage(lang) ? 'rtl' : 'ltr';
  });

  // Keep PWA app badge in sync with unread counts
  $effect(() => {
      const user = $currentUser;
      if (user?.npub) {
          void syncAppBadge(user.npub);
          return;
      }

      void clearAppBadge();
  });


  onMount(() => {
      return initAppVisibilityAndFocusTracking();
  });

  // Check for missing messaging relays when app becomes visible
  onMount(() => {
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && $currentUser) {
              void checkAndAutoSetRelays();
          }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  });

  // Lock app when it goes to background (PIN protection)
  onMount(() => {
      const handlePinLock = () => {
          if (document.visibilityState === 'hidden' && $currentUser) {
              lockApp();
          }
      };

      document.addEventListener('visibilitychange', handlePinLock);
      return () => {
          document.removeEventListener('visibilitychange', handlePinLock);
      };
  });

  // Lock app when window loses focus (catches virtual desktop switches on Linux)
  onMount(() => {
      const handleWindowBlur = () => {
          if ($currentUser) {
              lockApp();
          }
      };

      window.addEventListener('blur', handleWindowBlur);
      return () => {
          window.removeEventListener('blur', handleWindowBlur);
      };
  });

  onMount(async () => {
    initLanguage();
    initRuntimeConfig();
 
    configureAndroidStatusBar().catch((error) => {
      console.warn('Android status bar configuration failed', error);
    });

    if (isAndroidNative()) {
      isAndroidApp = true;
      initAndroidBackNavigation();
    }

    // Register PWA Service Worker (web only — not needed in Capacitor native shell)
    if (!isAndroidNative()) {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({
        immediate: true,
        onRegistered(r) {
          console.log('SW Registered');
        },
        onRegisterError(error) {
          console.error('SW registration error', error);
        }
      });
    }

    const restored = await authService.restore();

      // Initialize PIN lock state after auth restore
      if (restored) {
        initPinState();
      }

      let routedFromNotification = false;

      const handleNotificationRoute = async (payload: AndroidNotificationRoutePayload): Promise<void> => {
          if (!payload || payload.kind !== 'chat') {
              return;
          }

          if (!$currentUser) {
              return;
          }

          try {
              const conversationId = payload.conversationId;
              // Group conversation IDs are 16-char hex hashes, 1-on-1 are 64-char pubkey hex
              const isGroup = conversationId.length === 16;
              
              if (isGroup) {
                  // Group chat - use the hash directly
                  await goto(`/chat/${encodeURIComponent(conversationId)}`);
              } else if (conversationId.startsWith('npub1')) {
                  // Already an npub (from launcher shortcut taps)
                  await goto(`/chat/${encodeURIComponent(conversationId)}`);
              } else {
                  // Hex pubkey (from notification taps)
                  const partnerNpub = nip19.npubEncode(conversationId);
                  await goto(`/chat/${encodeURIComponent(partnerNpub)}`);
              }
              routedFromNotification = true;
          } catch (e) {
              console.error('Failed to route Android notification tap:', e);
          }
      };

      if (isAndroidNative() && AndroidNotificationRouter) {
          try {
              const initialRoute = await AndroidNotificationRouter.getInitialRoute();
              if (initialRoute) {
                  await handleNotificationRoute(initialRoute);
              }
          } catch (e) {
              console.error('Failed to process initial Android notification route:', e);
          }

          void AndroidNotificationRouter.addListener('routeReceived', (payload) => {
              void handleNotificationRoute(payload);
          });
      }

      // If restored and on login page, go to chat (replace to keep login out of history)
      if (restored && location.pathname === "/" && !routedFromNotification) {
        await goto("/chat", { replaceState: true });
      }

      // Only set initialized after auth restore AND any navigation is complete
      isInitialized = true;
 
     // Handle Android inbound shares after auth restore
     if (isAndroidNative() && AndroidShareTarget) {
       const handleSharePayload = async (payload: AndroidSharePayload): Promise<void> => {
         if (!payload) {
             return;
         }
 
         if (!$currentUser) {
             try {
                 await nativeDialogService.alert({
                     title: 'Share not available',
                     message: 'Please log in to share.'
                 });
             } catch {
                 // ignore
             }
             return;
         }
 
          // Handle error payloads from native layer (e.g. permission denied)
          if (payload.kind === 'error') {
              try {
                  await nativeDialogService.alert({
                      title: 'Share failed',
                      message: payload.message
                  });
              } catch {
                  // ignore
              }
              return;
          }

          // Check if this is a Direct Share with a target conversation
           let targetConversationId = payload.targetConversationId;
          
          // If targetConversationId is a truncated npub (starts with npub1 but < 63 chars),
          // find the full npub from contacts
          if (targetConversationId && targetConversationId.startsWith('npub1') && targetConversationId.length < 63) {
              const { contactRepo } = await import('$lib/db/ContactRepository');
              const contacts = await contactRepo.getContacts();
              const match = contacts.find(c => c.npub.startsWith(targetConversationId as string));
              if (match) {
                  targetConversationId = match.npub;
              }
          }
          
          const hasDirectTarget = !!targetConversationId;

          if (payload.kind === 'media') {
              const file = fileFromAndroidMediaPayload(payload);
              setPendingAndroidMediaShare({
                  file,
                  mediaType: payload.mediaType,
                  requiresContactSelection: !hasDirectTarget,
                  targetConversationId
              });
              setPendingAndroidTextShare(null);
          } else if (payload.kind === 'text') {
              if (!payload.text || payload.text.trim().length === 0) {
                  return;
              }
              setPendingAndroidTextShare({
                  text: payload.text,
                  requiresContactSelection: !hasDirectTarget,
                  targetConversationId
              });
              setPendingAndroidMediaShare(null);
          }
 
          // Navigate to target conversation directly if Direct Share, otherwise to contact list
          if (hasDirectTarget && targetConversationId) {
              await goto(`/chat/${encodeURIComponent(targetConversationId)}`);
          } else if (location.pathname !== '/chat') {
              await goto('/chat');
          }
       };
 
       try {
         const initial = await AndroidShareTarget.getInitialShare();
         if (initial) {
             await handleSharePayload(initial);
         }
       } catch (e) {
         console.error('Failed to process initial Android share:', e);
       }
 
       void AndroidShareTarget.addListener('shareReceived', (payload) => {
         void handleSharePayload(payload);
       });
     }

     // Publish Android sharing shortcuts for recent contacts (1-on-1 + groups)
     if (isAndroidNative() && restored && $currentUser) {
       void (async () => {
         try {
           const { publishSharingShortcuts } = await import('$lib/core/AndroidSharingShortcuts');
           const { conversationRepo } = await import('$lib/db/ConversationRepository');
           const { contactRepo } = await import('$lib/db/ContactRepository');
           const { profileRepo } = await import('$lib/db/ProfileRepository');
           const { messageRepo } = await import('$lib/db/MessageRepository');

           // 1. Get 1-on-1 contacts and their actual last message time
           const dbContacts = await contactRepo.getContacts();
           const contactItemsWithMsgTime = await Promise.all(
             dbContacts.map(async (c) => {
               // Get last message to determine actual last activity (like ChatList does)
                const recentMsgs = await messageRepo.getMessages(c.npub, 1);
               const lastMsg = recentMsgs[recentMsgs.length - 1];
               const lastMsgTime = lastMsg ? lastMsg.sentAt : 0;
               return {
                 id: c.npub,
                 isGroup: false as const,
                 lastMessageTime: lastMsgTime,
                 subject: undefined as string | undefined
               };
             })
           );
           // Filter out contacts with no messages
           const contactItems = contactItemsWithMsgTime.filter(c => c.lastMessageTime > 0);

           // 2. Get group conversations and their last message time
           const groupConversations = await conversationRepo.getGroupConversations();
           const groupItems = await Promise.all(
             groupConversations.map(async (g) => {
               const lastMsg = await messageRepo.getLastMessageForConversation(g.id);
               const lastMsgTime = lastMsg ? lastMsg.sentAt : g.lastActivityAt;
               return {
                 id: g.id,
                 isGroup: true as const,
                 lastMessageTime: lastMsgTime,
                 subject: g.subject
               };
             })
           );

           // 3. Combine, sort by lastMessageTime descending, take top 4
           const allChats = [...contactItems, ...groupItems]
             .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
             .slice(0, 4);

           // 4. Map to shortcut format with profile lookup for 1-on-1
           const shortcutContacts = await Promise.all(
             allChats.map(async (chat) => {
               let displayName: string;
               let avatarUrl: string | undefined;

               if (chat.isGroup) {
                 displayName = chat.subject || 'Group Chat';
                 avatarUrl = 'group_default'; // Signal Android to use default group icon
               } else {
                 const profile = await profileRepo.getProfileIgnoreTTL(chat.id);
                 const metadata = profile?.metadata;
                 displayName = metadata?.display_name || metadata?.name || chat.id.slice(0, 12) + '...';
                 avatarUrl = metadata?.picture;
               }

               return {
                 conversationId: chat.id,
                 displayName,
                 avatarUrl
               };
             })
           );

           await publishSharingShortcuts(shortcutContacts);
         } catch (e) {
           console.error('Failed to publish sharing shortcuts:', e);
         }
       })();
     }
 
     // Load favorites and archives stores on startup (from local DB)
     if (restored && $currentUser) {
       import("$lib/stores/favorites").then(({ loadFavorites }) => {
         loadFavorites().catch(e => console.error('Failed to load favorites:', e));
       });
       import("$lib/stores/archive").then(({ loadArchives }) => {
         loadArchives().catch(e => console.error('Failed to load archives:', e));
       });
     }

     if (restored && location.pathname !== "/") {
      // Refresh current user's relay discovery after a short delay
      setTimeout(async () => {
        const { discoverUserRelays } = await import(
          "$lib/core/connection/Discovery"
        );
        const { profileRepo } = await import("$lib/db/ProfileRepository");

        const user = $currentUser;
        if (user?.npub) {
          const freshProfile = await profileRepo.getProfile(user.npub);
          if (!freshProfile) {
            showProfileRefreshBanner = true;
            profileRefreshMessage = "Refreshing profile…";

            try {
              await discoverUserRelays(user.npub, true);
              profileRefreshMessage = "Profile refresh completed";
            } catch (error) {
              console.error("Failed to refresh current user profile:", error);
              profileRefreshMessage = "Profile refresh failed";
            } finally {
              setTimeout(() => {
                showProfileRefreshBanner = false;
              }, 3000);
            }
           }
        }
      }, 2000);
    }
  });
</script>

<svelte:head>
  {@html webManifestLinkTag}
  <title>nospeak</title>
</svelte:head>

<svelte:window
  ononline={() => isOnline.set(true)}
  onoffline={() => isOnline.set(false)}
  onclick={handleGlobalClick}
/>

{#if isInitialized}
  <div
    class="h-dvh app-shell flex justify-center overflow-hidden relative {isAndroidApp ? '' : 'lg:p-4'}"
  >

    {#if page.url.pathname === '/'}
      {@render children()}
    {:else}
      <div 
        class="w-full max-w-full h-full relative z-10 shadow-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 isolate transform-gpu {isAndroidApp ? '' : 'backdrop-blur-xl lg:max-w-7xl xl:max-w-6xl lg:rounded-2xl lg:border lg:border-white/20 lg:dark:border-white/10'}"
        style="mask-image: linear-gradient(black, black); -webkit-mask-image: linear-gradient(black, black);"
      >
        {@render children()}

        {#if showProfileRefreshBanner}
          <div class="fixed bottom-3 end-3 z-50 px-3 py-2 text-xs rounded bg-gray-800 text-white shadow">
            {profileRefreshMessage}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Modals Layer (Outside Glass Container) -->
     <RelayStatusModal 
       isOpen={$showRelayStatusModal} 
       close={() => showRelayStatusModal.set(false)} 
     />


     <SettingsModal 
       isOpen={$showSettingsModal} 
       close={() => showSettingsModal.set(false)} 
     />


     <ManageContactsModal 
      isOpen={$showManageContactsModal} 
      close={() => showManageContactsModal.set(false)} 
    />

     <CreateGroupChatModal
      isOpen={$showCreateGroupModal}
      close={() => showCreateGroupModal.set(false)}
    />

      <ScanContactQrModal
        isOpen={$showScanContactQrModal || $showUserQrModal}
        defaultTab={$showUserQrModal ? 'myQr' : 'scan'}
        close={() => { showScanContactQrModal.set(false); showUserQrModal.set(false); }}
      />

    {#if $scanContactQrResultState.isOpen && $scanContactQrResultState.npub}
      <ScanContactQrResultModal
        isOpen={$scanContactQrResultState.isOpen}
        npub={$scanContactQrResultState.npub}
        close={closeScanContactQrResult}
      />
    {/if}
 
      {#if $profileModalState.isOpen && $profileModalState.npub}


      <ProfileModal
        isOpen={$profileModalState.isOpen}
        close={closeProfileModal}
        npub={$profileModalState.npub}
      />
    {/if}

    {#if $syncState.flowActive}
         <SyncProgressModal progress={$syncState.progress} />
     {/if}
 
     {#if $showEmptyProfileModal}
          <EmptyProfileModal isOpen={$showEmptyProfileModal} />
      {/if}

      <!-- Signer mismatch modal - highest z-index, non-dismissible -->
      {#if $signerMismatch?.detected && $signerMismatch.expectedPubkey && $signerMismatch.actualPubkey}
          <SignerMismatchModal
              expectedPubkey={$signerMismatch.expectedPubkey}
              actualPubkey={$signerMismatch.actualPubkey}
          />
      {/if}
 
      <ImageViewerOverlay />
      <Toast />

      <!-- PIN Setup Modal - above all other modals -->
      <PinSetupModal
        isOpen={$pinSetupModalState.isOpen}
        close={closePinSetupModal}
        mode={$pinSetupModalState.mode}
        onSuccess={(pin) => {
          if ($pinSetupModalState.onSuccess) {
            $pinSetupModalState.onSuccess(pin);
          }
          closePinSetupModal();
        }}
      />

      <!-- PIN Lock Screen - highest z-index, covers entire app -->
      <PinLockScreen isLocked={$isPinLocked} />
    </div>
  {/if}
