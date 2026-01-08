<script lang="ts">
  import "../app.css";
  import { isOnline, showRelayStatusModal } from "$lib/stores/connection";
  import { authService } from "$lib/core/AuthService";
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
    import ProfileModal from "$lib/components/ProfileModal.svelte";
    import EmptyProfileModal from "$lib/components/EmptyProfileModal.svelte";
    import UserQrModal from "$lib/components/UserQrModal.svelte";
    import ScanContactQrModal from "$lib/components/ScanContactQrModal.svelte";
    import ScanContactQrResultModal from "$lib/components/ScanContactQrResultModal.svelte";
    import * as modals from "$lib/stores/modals";
    import SyncProgressModal from "$lib/components/SyncProgressModal.svelte";
 
 
   import { syncState } from "$lib/stores/sync";

   import { configureAndroidStatusBar } from "$lib/core/StatusBar";
   import { initLanguage } from "$lib/stores/language";
   import { isAndroidNative, nativeDialogService } from "$lib/core/NativeDialogs";
   import { initAndroidBackNavigation } from "$lib/core/AndroidBackHandler";
   import ImageViewerOverlay from "$lib/components/ImageViewerOverlay.svelte";
 

   const { showSettingsModal, showManageContactsModal, showEmptyProfileModal, showUserQrModal, showScanContactQrModal, profileModalState, scanContactQrResultState, closeProfileModal, closeScanContactQrResult } = modals;
 
   let { children } = $props();

  let isInitialized = $state(false);
  let showProfileRefreshBanner = $state(false);
  let profileRefreshMessage = $state("");
  let isAndroidApp = $state(isAndroidNative());

  const webManifestLinkTag = pwaInfo?.webManifest.linkTag ?? "";

  // Global click handler for link vibration
  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
        hapticSelection();
    }
  }

  // Close all modals when user logs out
  $effect(() => {
         if (!$currentUser) {
             showSettingsModal.set(false);
             showManageContactsModal.set(false);
             showRelayStatusModal.set(false);
             showScanContactQrModal.set(false);
              closeScanContactQrResult();
              closeProfileModal();

         }

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

  onMount(async () => {
    initLanguage();
 
    await initRuntimeConfig();
 
    configureAndroidStatusBar().catch((error) => {
      console.warn('Android status bar configuration failed', error);
    });

    if (isAndroidNative()) {
      isAndroidApp = true;
      initAndroidBackNavigation();
    }

    // Register PWA Service Worker
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

    const restored = await authService.restore();
     isInitialized = true;
 
      let routedFromNotification = false;
 
      const handleNotificationRoute = async (payload: AndroidNotificationRoutePayload): Promise<void> => {
          if (!payload || payload.kind !== 'chat') {
              return;
          }
 
          if (!$currentUser) {
              return;
          }
 
          try {
              const partnerNpub = nip19.npubEncode(payload.partnerPubkeyHex);
              await goto(`/chat/${encodeURIComponent(partnerNpub)}`);
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
 
      // If restored and on login page, go to chat
      if (restored && location.pathname === "/" && !routedFromNotification) {
        goto("/chat");
      }
 
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
 
         if (payload.kind === 'media') {
             const file = fileFromAndroidMediaPayload(payload);
             setPendingAndroidMediaShare({
                 file,
                 mediaType: payload.mediaType,
                 requiresContactSelection: true
             });
             setPendingAndroidTextShare(null);
         } else if (payload.kind === 'text') {
             if (!payload.text || payload.text.trim().length === 0) {
                 return;
             }
             setPendingAndroidTextShare({
                 text: payload.text,
                 requiresContactSelection: true
             });
             setPendingAndroidMediaShare(null);
         }
 
         if (location.pathname !== '/chat') {
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
 
     if (restored && location.pathname !== "/") {
      // Wait 5 seconds then refresh all contact profiles and relay information
      setTimeout(async () => {
        console.log("Starting delayed profile and relay refresh after 5 seconds");
        
        const { contactRepo } = await import("$lib/db/ContactRepository");
        const { discoverUserRelays } = await import(
          "$lib/core/connection/Discovery"
        );
        const { profileResolver } = await import("$lib/core/ProfileResolver");
        const { profileRepo } = await import("$lib/db/ProfileRepository");

        const contacts = await contactRepo.getContacts();
        console.log(
          `Refreshing profiles for ${contacts.length} contacts after delay`,
        );

        // Refresh current user profile/relays if TTL has expired
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

        // Refresh profiles for all contacts in parallel with some concurrency control
        const BATCH_SIZE = 5;
        for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
          const batch = contacts.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (contact) => {
              try {
                console.log(`Refreshing profile for ${contact.npub}`);
                await discoverUserRelays(contact.npub, false);
                await profileResolver.resolveProfile(contact.npub, true); // force refresh
              } catch (error) {
                console.error(
                  `Failed to refresh profile for ${contact.npub}:`,
                  error,
                );
              }
            }),
          );

          // Small delay between batches to avoid overwhelming relays
          if (i + BATCH_SIZE < contacts.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        
        console.log("Profile and relay refresh completed");
      }, 5000); // 5 second delay
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
        class="w-full max-w-full h-full relative z-10 shadow-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl isolate transform-gpu {isAndroidApp ? '' : 'lg:max-w-7xl xl:max-w-6xl lg:rounded-2xl lg:border lg:border-white/20 lg:dark:border-white/10'}"
        style="mask-image: linear-gradient(black, black); -webkit-mask-image: linear-gradient(black, black);"
      >
        {@render children()}

        {#if showProfileRefreshBanner}
          <div class="fixed bottom-3 right-3 z-50 px-3 py-2 text-xs rounded bg-gray-800 text-white shadow">
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

     <ScanContactQrModal
       isOpen={$showScanContactQrModal}
       close={() => showScanContactQrModal.set(false)}
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
 
     <UserQrModal 
         isOpen={$showUserQrModal} 
         close={() => showUserQrModal.set(false)} 
     />
 
     <ImageViewerOverlay />
   </div>
 {/if}

