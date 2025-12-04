<script lang="ts">
  import "../app.css";
  import { isOnline } from "$lib/stores/connection";
  import { authService } from "$lib/core/AuthService";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { softVibrate } from "$lib/utils/haptics";
  import { currentUser } from "$lib/stores/auth";

  let { children } = $props();
  let isInitialized = $state(false);
  let showProfileRefreshBanner = $state(false);
  let profileRefreshMessage = $state("");

  // Global click handler for link vibration
  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
        softVibrate();
    }
  }

  onMount(async () => {
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

    // If restored and on login page, go to chat
    if (restored && location.pathname === "/") {
      goto("/chat");
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
  <title>nospeak</title>
</svelte:head>

<svelte:window
  ononline={() => isOnline.set(true)}
  onoffline={() => isOnline.set(false)}
  onclick={handleGlobalClick}
/>

{#if isInitialized}
  <div
    class="h-dvh bg-gray-100 dark:bg-gray-900 flex justify-center overflow-hidden"
  >
    <div class="w-full max-w-full lg:max-w-7xl xl:max-w-6xl h-full relative">
      {@render children()}

      {#if showProfileRefreshBanner}
        <div class="fixed bottom-3 right-3 z-50 px-3 py-2 text-xs rounded bg-gray-800 text-white shadow">
          {profileRefreshMessage}
        </div>
      {/if}
    </div>
  </div>
{/if}
