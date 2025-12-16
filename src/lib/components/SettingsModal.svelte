<script lang="ts">
  import { notificationService } from "$lib/core/NotificationService";
  import { relaySettingsService } from "$lib/core/RelaySettingsService";
  import { profileService } from "$lib/core/ProfileService";
  import { authService } from "$lib/core/AuthService";
  import { currentUser } from "$lib/stores/auth";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import { getDisplayedNip05 } from "$lib/core/Nip05Display";
  import { getCurrentThemeMode, setThemeMode } from "$lib/stores/theme.svelte";
  import type { ThemeMode } from "$lib/stores/theme";
  import MediaUploadButton from "./MediaUploadButton.svelte";
  import { isAndroidNative, nativeDialogService } from "$lib/core/NativeDialogs";
  import { applyAndroidBackgroundMessaging } from "$lib/core/BackgroundMessaging";
  import { fade } from "svelte/transition";
  import { glassModal } from "$lib/utils/transitions";
  import { t } from "$lib/i18n";
  import { language, setLanguage } from "$lib/stores/language";
  import type { Language } from "$lib/i18n";
 
  const packageVersion = __APP_VERSION__;

  let { isOpen = false, close = () => {} } = $props<{
    isOpen: boolean;
    close: () => void;
  }>();

  const isAndroidApp = isAndroidNative();

  let notificationsEnabled = $state(false);
  let urlPreviewsEnabled = $state(true);
  let backgroundMessagingEnabled = $state(false);
  let isSupported = $state(false);
  let isLoaded = $state(false);

  type Category = "General" | "Profile" | "Messaging Relays" | "About" | "Security";
  type AuthMethod = "local" | "nip07" | "amber" | "nip46" | "unknown";

  let activeCategory = $state<Category>("General");

  let themeMode = $state<ThemeMode>("system");
  let languageValue = $state<Language>("en");

  let securityAuthMethod = $state<AuthMethod>("unknown");
  let storedNsec = $state("");
  let showNsec = $state(false);

  // Profile settings
  let profileName = $state("");
  let profileAbout = $state("");
  let profilePicture = $state("");
  let profileBanner = $state("");
  let profileNip05 = $state("");
  let profileWebsite = $state("");
  let profileDisplayName = $state("");
  let profileLud16 = $state("");
  let isSavingProfile = $state(false);
  let profileNip05Status = $state<"valid" | "invalid" | "unknown" | null>(null);

  // Relay settings (messaging relays)
  type RelayConfig = {
    url: string;
  };
  let relays = $state<RelayConfig[]>([]);
  let newRelayUrl = $state("");
  let isSavingRelays = $state(false);
  let relaySaveStatus = $state<string | null>(null);

  function handlePictureUpload(file: File, type: "image" | "video" | "audio", url?: string) {
    if (url) {
      profilePicture = url;
      saveProfile();
    }
  }

  function handleBannerUpload(file: File, type: "image" | "video" | "audio", url?: string) {
    if (url) {
      profileBanner = url;
      saveProfile();
    }
  }

  async function loadProfile() {
    if ($currentUser?.npub) {
      const profile = await profileRepo.getProfileIgnoreTTL($currentUser.npub);
      if (profile?.metadata) {
        profileName = profile.metadata.name || "";
        profileAbout = profile.metadata.about || "";
        profilePicture = profile.metadata.picture || "";
        profileBanner = profile.metadata.banner || "";
        profileNip05 = profile.metadata.nip05 || "";
        profileWebsite = profile.metadata.website || "";
        profileDisplayName = profile.metadata.display_name || "";
        profileLud16 = profile.metadata.lud16 || "";
        profileNip05Status = profile.nip05Status ?? null;
      }
    }
  }

  async function saveProfile() {
    if (isSavingProfile) return;
    isSavingProfile = true;

    try {
      await profileService.updateProfile({
        name: profileName,
        about: profileAbout,
        picture: profilePicture,
        banner: profileBanner,
        nip05: profileNip05,
        website: profileWebsite,
        display_name: profileDisplayName,
        lud16: profileLud16
      });
      await loadProfile();
      // Optional: Show success feedback
    } catch (e) {
      console.error("Failed to save profile:", e);
      // Optional: Show error feedback
    } finally {
      isSavingProfile = false;
    }
  }

  async function loadRelaySettings() {
    let messagingRelays: string[] = [];
 
    if ($currentUser?.npub) {
      const profile = await profileRepo.getProfileIgnoreTTL($currentUser.npub);
      if (profile) {
        messagingRelays = profile.messagingRelays || [];
      }
    }
 
    relays = messagingRelays
      .map((url) => ({
        url
      }))
      .sort((a, b) => a.url.localeCompare(b.url));
  }
 
  async function saveRelaySettings() {
    const messagingRelays = relays.map((r) => r.url);

    isSavingRelays = true;
    relaySaveStatus = null;

    try {
      const result = await relaySettingsService.updateSettings(messagingRelays);

      if (result.succeeded === 0) {
        relaySaveStatus = $t('settings.messagingRelays.saveStatusNone') as string;
      } else if (result.failed === 0) {
        const template = $t('settings.messagingRelays.saveStatusSuccess') as string;
        relaySaveStatus = template.replace('{count}', String(result.succeeded));
      } else {
        let template = $t('settings.messagingRelays.saveStatusPartial') as string;
        template = template.replace('{succeeded}', String(result.succeeded));
        template = template.replace('{attempted}', String(result.attempted));
        relaySaveStatus = template;
      }
    } catch (e) {
      console.error('Failed to save relay settings:', e);
      relaySaveStatus = $t('settings.messagingRelays.saveStatusError') as string;
    } finally {
      isSavingRelays = false;
    }
  }


  async function addRelay() {
    if (!newRelayUrl) return;
    let url = newRelayUrl.trim();

    // Basic URL validation/normalization
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      url = "wss://" + url;
    }

    if (!relays.find((r) => r.url === url)) {
      relays = [...relays, { url }];
      await saveRelaySettings();
    }
    newRelayUrl = "";
  }

  async function removeRelay(url: string) {
    relays = relays.filter((r) => r.url !== url);
    await saveRelaySettings();
  }



  let showMobileContent = $state(false);

  $effect(() => {
    if (!isOpen) {
      activeCategory = "General";
      showMobileContent = false;
    }
  });

  // Load settings from localStorage
  $effect(() => {
    if (isOpen) {
      showMobileContent = false;
      // Always refresh profile and relay settings when the modal opens
      loadRelaySettings();
      loadProfile();

      try {
        const method = localStorage.getItem("nospeak:auth_method") as
          | "local"
          | "nip07"
          | "amber"
          | "nip46"
          | null;
        if (method === "local" || method === "nip07" || method === "amber" || method === "nip46") {
          securityAuthMethod = method;
        } else {
          securityAuthMethod = "unknown";
        }

        if (method === "local") {
          const nsec = localStorage.getItem("nospeak:nsec");
          storedNsec = nsec || "";
        } else {
          storedNsec = "";
        }

        showNsec = false;
      } catch (e) {
        console.warn("Failed to read auth method for Security settings:", e);
        securityAuthMethod = "unknown";
        storedNsec = "";
        showNsec = false;
      }

      // Sync language selector with current language store
      languageValue = $language;
    }

    if (isOpen && !isLoaded) {
      isSupported = notificationService.isSupported();
      const saved = localStorage.getItem("nospeak-settings");
      if (saved) {
        const settings = JSON.parse(saved) as {
          notificationsEnabled?: boolean;
          urlPreviewsEnabled?: boolean;
          backgroundMessagingEnabled?: boolean;
        };
        notificationsEnabled = settings.notificationsEnabled || false;
        urlPreviewsEnabled =
          typeof settings.urlPreviewsEnabled === "boolean"
            ? settings.urlPreviewsEnabled
            : true;
        backgroundMessagingEnabled = settings.backgroundMessagingEnabled === true;
      } else {
        notificationsEnabled = false;
        urlPreviewsEnabled = true;
        backgroundMessagingEnabled = false;
      }

      themeMode = getCurrentThemeMode();
      isLoaded = true;
    }
  });

  // Save notification settings
  $effect(() => {
    if (isLoaded && isOpen) {
      const saved = localStorage.getItem("nospeak-settings");
      const existingSettings = saved ? JSON.parse(saved) : {};
      const settings = {
        ...existingSettings,
        notificationsEnabled,
        urlPreviewsEnabled,
        backgroundMessagingEnabled
      };
      localStorage.setItem("nospeak-settings", JSON.stringify(settings));
    }
  });

  async function toggleNotifications() {
    if (!notificationsEnabled) {
      // Request permission
      const granted = await notificationService.requestPermission();
      if (granted) {
        notificationsEnabled = true;
      }
    } else {
      notificationsEnabled = false;
    }
  }

  async function toggleBackgroundMessaging() {
    if (!isAndroidApp) {
      return;
    }

    backgroundMessagingEnabled = !backgroundMessagingEnabled;

    try {
      await applyAndroidBackgroundMessaging(backgroundMessagingEnabled);
    } catch (e) {
      console.error("Failed to sync Android background messaging from toggle:", e);
    }
  }

  function handleThemeModeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as ThemeMode;
    themeMode = value;
    setThemeMode(value);
  }

  function handleLanguageChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as Language;
    languageValue = value;
    setLanguage(value);
  }

  const BOTTOM_SHEET_CLOSE_THRESHOLD = 100;
  const BOTTOM_SHEET_ACTIVATION_THRESHOLD = 6;
  let bottomSheetDragY = $state(0);
  let isBottomSheetDragging = $state(false);
  let bottomSheetDragStartY = 0;
 
   function getCategoryCardClasses(category: Category): string {

    const base =
      "w-full text-left my-1.5 rounded-2xl px-4 py-3 flex items-center justify-between transition-all duration-150 ease-out bg-white/10 dark:bg-slate-800/40 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-slate-800/70 hover:shadow-lg active:scale-[0.98]";

    if (isAndroidApp) {
      return base + " text-gray-900 dark:text-slate-100";
    }

    if (activeCategory === category) {
      return (
        base +
        " text-gray-900 dark:text-white md:bg-blue-50/10 md:dark:bg-blue-900/40 md:font-medium"
      );
    }

    return (
      base +
      " text-gray-700 dark:text-slate-200 md:text-gray-600 md:dark:text-slate-400 md:hover:bg-gray-100/80 md:dark:hover:bg-slate-800/90 md:hover:text-gray-900 md:dark:hover:text-slate-200"
    );
  }

  function handleBottomSheetPointerDown(e: PointerEvent) {
    if (!isAndroidApp) return;
    e.preventDefault();
    isBottomSheetDragging = false;
    bottomSheetDragStartY = e.clientY;
    bottomSheetDragY = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleBottomSheetPointerMove(e: PointerEvent) {
    if (!isAndroidApp) return;
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
    if (!isAndroidApp) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture was not set
    }
    if (!isBottomSheetDragging) {
      bottomSheetDragY = 0;
      return;
    }
    const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
    isBottomSheetDragging = false;
    bottomSheetDragY = 0;
    if (shouldClose) {
      close();
    }
  }

  function handleBottomSheetTouchStart(e: TouchEvent) {
    if (!isAndroidApp) return;
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    isBottomSheetDragging = false;
    bottomSheetDragStartY = touch.clientY;
    bottomSheetDragY = 0;
  }

  function handleBottomSheetTouchMove(e: TouchEvent) {
    if (!isAndroidApp) return;
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

  function handleBottomSheetTouchEnd(e: TouchEvent) {
    if (!isAndroidApp) return;
    if (!isBottomSheetDragging) {
      bottomSheetDragY = 0;
      return;
    }
    const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
    isBottomSheetDragging = false;
    bottomSheetDragY = 0;
    if (shouldClose) {
      close();
    }
  }


  function handleOverlayClick(e: MouseEvent) {

    if (e.target === e.currentTarget) {
      close();
    }
  }


  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }
</script>

{#if isOpen}
  <div
    in:fade={{ duration: 130 }}
    out:fade={{ duration: 110 }}
    class={`fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm flex justify-center z-50 ${
      isAndroidApp ? "items-end" : "items-center"
    }`}
    class:android-safe-area-top={isAndroidApp}
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  >
    <div
      in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }}
      out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
      class={`bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border border-white/20 dark:border-white/10 flex overflow-hidden relative outline-none transition-transform duration-150 ease-out ${
        isAndroidApp
          ? "w-full max-w-xl mx-2 rounded-t-3xl rounded-b-none max-h-[90vh]"
          : "w-full h-full rounded-none md:max-w-4xl md:mx-4 md:h-[600px] md:rounded-3xl"
      }`}
      style:transform={isAndroidApp ? `translateY(${bottomSheetDragY}px)` : undefined}
    >
      {#if isAndroidApp}
        <div
          class="absolute inset-x-0 top-0 h-12"
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
            class="mx-auto mt-2 w-10 h-1.5 rounded-full bg-white/40 dark:bg-slate-700/80 touch-none"
          ></div>
        </div>
      {/if}


      <button
         onclick={close}
         aria-label="Close modal"
         class="hidden md:block absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm"
       >

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <!-- Sidebar -->
      <div
        class={`w-full md:w-64 bg-transparent md:bg-white/50 dark:bg-slate-900/50 border-r border-gray-200/50 dark:border-slate-800/50 p-4 flex-col ${
          showMobileContent ? "hidden md:flex" : "flex"
        }`}
      >
        <div class="flex items-center gap-2 mb-6 px-2">
          <button
            class="md:hidden text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            onclick={close}
            aria-label="Close settings"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
          </button>
          <h2 id="settings-title" class="typ-title dark:text-white">
            {$t("settings.title")}
          </h2>
        </div>

        <nav class="space-y-2 px-1.5">
          <button
            class={getCategoryCardClasses("General")}
            onclick={() => {
              activeCategory = "General";
              showMobileContent = true;
            }}
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-white/20 dark:bg-slate-900/40 flex items-center justify-center text-gray-700 dark:text-slate-100">
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                  ></path>
                </svg>
              </div>
              <span class="typ-section text-gray-900 dark:text-slate-100">
                {$t("settings.categories.general")}
              </span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 dark:text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </button>

          <button
            class={getCategoryCardClasses("Profile")}
            onclick={() => {
              activeCategory = "Profile";
              showMobileContent = true;
            }}
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-white/20 dark:bg-slate-900/40 flex items-center justify-center text-gray-700 dark:text-slate-100">
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <span class="typ-section text-gray-900 dark:text-slate-100">
                {$t("settings.categories.profile")}
              </span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 dark:text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </button>

          <button
            class={getCategoryCardClasses("Messaging Relays")}
            onclick={() => {
              activeCategory = "Messaging Relays";
              showMobileContent = true;
            }}
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-white/20 dark:bg-slate-900/40 flex items-center justify-center text-gray-700 dark:text-slate-100">
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="6" cy="12" r="2"></circle>
                  <circle cx="12" cy="6" r="2"></circle>
                  <circle cx="18" cy="12" r="2"></circle>
                  <path d="M8 12h4M14 12h4M12 8v2"></path>
                </svg>
              </div>
              <span class="typ-section text-gray-900 dark:text-slate-100">
                {$t("settings.categories.messagingRelays")}
              </span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 dark:text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </button>

          <button
            class={getCategoryCardClasses("Security")}
            onclick={() => {
              activeCategory = "Security";
              showMobileContent = true;
            }}
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-white/20 dark:bg-slate-900/40 flex items-center justify-center text-gray-700 dark:text-slate-100">
                <svg
                  class="w-5 h-5"
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
              </div>
              <span class="typ-section text-gray-900 dark:text-slate-100">
                {$t("settings.categories.security")}
              </span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 dark:text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </button>

          <button
            class={getCategoryCardClasses("About")}
            onclick={() => {
              activeCategory = "About";
              showMobileContent = true;
            }}
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-white/20 dark:bg-slate-900/40 flex items-center justify-center text-gray-700 dark:text-slate-100">
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <span class="typ-section text-gray-900 dark:text-slate-100">
                {$t("settings.categories.about")}
              </span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 dark:text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </button>
        </nav>
      </div>

      <!-- Content -->
      <div
        class={`flex-1 flex-col min-w-0 ${showMobileContent ? "flex" : "hidden md:flex"}`}
      >
        <div
          class="p-6 flex justify-between items-center border-b border-gray-200/50 dark:border-slate-800/50"
        >
          <div class="flex items-center gap-2">
            <button
              class="md:hidden text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              onclick={() => (showMobileContent = false)}
              aria-label="Back to categories"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
            </button>
            <h3 class="typ-section dark:text-white">
              {#if activeCategory === "General"}
                {$t('settings.categories.general')}
              {:else if activeCategory === "Profile"}
                {$t('settings.categories.profile')}
              {:else if activeCategory === "Messaging Relays"}
                {$t('settings.categories.messagingRelays')}
              {:else if activeCategory === "Security"}
                {$t('settings.categories.security')}
              {:else if activeCategory === "About"}
                {$t('settings.categories.about')}
              {/if}
            </h3>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          {#if activeCategory === "General"}
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <label for="theme-mode" class="font-medium dark:text-white">
                    {$t("settings.general.appearanceLabel")}
                  </label>
                  <p class="typ-body text-gray-500 dark:text-slate-400">
                    {$t("settings.general.appearanceDescription")}
                  </p>
                </div>
                <select
                  id="theme-mode"
                  bind:value={themeMode}
                  onchange={handleThemeModeChange}
                  class="ml-4 px-3 py-2 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <label for="language-select" class="font-medium dark:text-white">
                    {$t("settings.general.languageLabel")}
                  </label>
                  <p class="typ-body text-gray-500 dark:text-slate-400">
                    {$t("settings.general.languageDescription")}
                  </p>
                </div>
                <select
                  id="language-select"
                  bind:value={languageValue}
                  onchange={handleLanguageChange}
                  class="ml-4 px-3 py-2 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <label
                    for="notifications-toggle"
                    class="font-medium dark:text-white"
                  >
                    {$t("settings.notifications.label")}
                  </label>
                  <p class="text-sm text-gray-500 dark:text-slate-400">
                    {#if isSupported}
                      {$t("settings.notifications.supportedDescription")}
                    {:else}
                      {$t("settings.notifications.unsupportedDescription")}
                    {/if}
                  </p>
                </div>
                {#if isSupported}
                  <button
                    id="notifications-toggle"
                    onclick={toggleNotifications}
                    class={`ml-4 flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationsEnabled
                        ? "bg-blue-500"
                        : "bg-gray-200 dark:bg-slate-600"
                    }`}
                    aria-label={
                      notificationsEnabled ? "Disable notifications" : "Enable notifications"
                    }
                  >
                    <span
                      class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationsEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    ></span>
                  </button>
                {:else}
                  <span class="typ-meta text-gray-400 dark:text-slate-500">
                    Not supported
                  </span>
                {/if}
              </div>

              {#if isAndroidApp}
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <label
                      for="background-messaging-toggle"
                      class="typ-section dark:text-white"
                    >
                      Background Messaging
                    </label>
                    <p class="text-sm text-gray-500 dark:text-slate-400">
                      Keep nospeak connected to your read relays and receive new message
                      notifications while the app is in the background. Android will show a
                      persistent notification when this is enabled. When using Amber, nospeak
                      cannot decrypt your messages in native code, so background notifications
                      only indicate that encrypted messages have arrived.
                    </p>
                  </div>
                  <button
                    id="background-messaging-toggle"
                    onclick={toggleBackgroundMessaging}
                    class={`ml-4 flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      backgroundMessagingEnabled
                        ? "bg-blue-500"
                        : "bg-gray-200 dark:bg-slate-600"
                    }`}
                    aria-label={
                      backgroundMessagingEnabled
                        ? "Disable Android background messaging"
                        : "Enable Android background messaging"
                    }
                  >
                    <span
                      class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        backgroundMessagingEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    ></span>
                  </button>
                </div>
              {/if}

              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <label
                    for="url-previews-toggle"
                    class="font-medium dark:text-white"
                  >
                    {$t("settings.urlPreviews.label")}
                  </label>
                  <p class="text-sm text-gray-500 dark:text-slate-400">
                    {$t("settings.urlPreviews.description")}
                  </p>
                </div>
                <button
                  id="url-previews-toggle"
                  onclick={() => (urlPreviewsEnabled = !urlPreviewsEnabled)}
                  class={`ml-4 flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    urlPreviewsEnabled ? "bg-blue-500" : "bg-gray-200 dark:bg-slate-600"
                  }`}
                  aria-label={
                    urlPreviewsEnabled ? "Disable URL previews" : "Enable URL previews"
                  }
                >
                  <span
                    class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      urlPreviewsEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  ></span>
                </button>
              </div>
            </div>
          {:else if activeCategory === "Profile"}
            <div class="space-y-6">
              <div class="grid grid-cols-1 gap-6">
                <div>
                  <label
                    for="profile-name"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.nameLabel')}
                  </label>
                  <input
                    id="profile-name"
                    bind:value={profileName}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={$t('settings.profile.namePlaceholder')}
                  />
                </div>

                <div>
                  <label
                    for="profile-display-name"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.displayNameLabel')}
                  </label>
                  <input
                    id="profile-display-name"
                    bind:value={profileDisplayName}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={$t('settings.profile.displayNamePlaceholder')}
                  />
                </div>

                <div>
                  <label
                    for="profile-about"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.aboutLabel')}
                  </label>
                  <textarea
                    id="profile-about"
                    bind:value={profileAbout}
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={$t('settings.profile.aboutPlaceholder')}
                  ></textarea>
                </div>

                <div>
                  <label
                    for="profile-picture"
                    class="block text sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.pictureUrlLabel')}
                  </label>
                  <div class="flex gap-2">
                    <MediaUploadButton
                      onFileSelect={handlePictureUpload}
                      allowedTypes={["image"]}
                    />

                    <input
                      id="profile-picture"
                      bind:value={profilePicture}
                      type="url"
                      class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={$t('settings.profile.pictureUrlPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="profile-banner"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.bannerUrlLabel')}
                  </label>
                  <div class="flex gap-2">
                    <MediaUploadButton
                      onFileSelect={handleBannerUpload}
                      allowedTypes={["image"]}
                    />

                    <input
                      id="profile-banner"
                      bind:value={profileBanner}
                      type="url"
                      class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={$t('settings.profile.bannerUrlPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="profile-nip05"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.nip05Label')}
                  </label>
                  <input
                    id="profile-nip05"
                    bind:value={profileNip05}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={$t('settings.profile.nip05Placeholder')}
                    oninput={() => (profileNip05Status = "unknown")}
                  />
                  {#if profileNip05}
                    {#if profileNip05Status === "valid"}
                      <div class="mt-1 text-xs text-green-600 flex items-center gap-1">
                        <svg
                          class="shrink-0"
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
                        <span
                          >Verified for this key ({getDisplayedNip05(profileNip05)})</span
                        >
                      </div>
                    {:else if profileNip05Status === "invalid"}
                      <div class="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                        <svg
                          class="shrink-0"
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
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <circle cx="12" cy="16" r="1"></circle>
                        </svg>
                        <span>NIP-05 not verified for this key</span>
                      </div>
                    {:else}
                      <div class="mt-1 text-xs text-gray-500">
                        Verification status unknown for {getDisplayedNip05(profileNip05)}
                      </div>
                    {/if}
                  {/if}
                </div>

                <div>
                  <label
                    for="profile-website"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.websiteLabel')}
                  </label>
                  <input
                    id="profile-website"
                    bind:value={profileWebsite}
                    type="url"
                    class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={$t('settings.profile.websitePlaceholder')}
                  />
                </div>

                <div>
                  <label
                    for="profile-lud16"
                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {$t('settings.profile.lightningLabel')}
                  </label>
                  <input
                    id="profile-lud16"
                    bind:value={profileLud16}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={$t('settings.profile.lightningPlaceholder')}
                  />
                </div>

                <div class="pt-4 flex justify-end">
                  <button
                    onclick={saveProfile}
                    disabled={isSavingProfile}
                    class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {#if isSavingProfile}
                      <svg
                        class="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {$t('settings.profile.savingButton')}
                    {:else}
                      {$t('settings.profile.saveButton')}
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {:else if activeCategory === "Messaging Relays"}
            <div class="space-y-6">
              <p class="text-sm text-gray-500 dark:text-slate-400">
                {$t('settings.messagingRelays.description')}
              </p>
 
              {#if relays.length > 3}
                <p class="text-sm text-red-600 dark:text-red-400">
                  {$t('settings.messagingRelays.tooManyWarning')}
                </p>
              {/if}
 
              <div class="flex gap-2">
                <input
                  bind:value={newRelayUrl}
                  placeholder={$t('settings.messagingRelays.inputPlaceholder')}
                  class="flex-1 px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onkeydown={(e) => e.key === "Enter" && addRelay()}
                />
                <button
                  onclick={addRelay}
                  class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSavingRelays}
                >
                  +
                </button>
              </div>

              {#if isSavingRelays || relaySaveStatus}
                <p class="text-xs text-gray-600 dark:text-slate-400">
                  {#if isSavingRelays}
                    {$t('settings.messagingRelays.savingStatus')}
                    {#if relaySaveStatus}
                       b7 {relaySaveStatus}
                    {/if}
                  {:else}
                    {relaySaveStatus}
                  {/if}
                </p>
              {/if}
 
              <div
                class="border border-gray-200/60 dark:border-slate-700/70 rounded-2xl bg-white/80 dark:bg-slate-900/60 overflow-hidden shadow-sm divide-y divide-gray-200/60 dark:divide-slate-700/70"
              >
                {#each relays as relay}
                  <div class="px-4 py-3 flex items-center justify-between">
                    <div class="flex-1 min-w-0 pr-4">
                      <p
                        class="text-sm font-medium dark:text-white truncate"
                        title={relay.url}
                      >
                        {relay.url}
                      </p>
                    </div>
                    <div class="flex items-center gap-4">
                      <button
                        onclick={() => removeRelay(relay.url)}
                        class="text-red-500 hover:text-red-700 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove relay"
                        disabled={isSavingRelays}
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                {:else}
                  <div
                    class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400"
                  >
                    {$t('settings.messagingRelays.emptyState')}
                  </div>
                {/each}
              </div>
            </div>

          {:else if activeCategory === "About"}
            <div class="space-y-6">
              <div class="flex items-center gap-6">
                <img
                  src="/nospeak.svg"
                  alt="Nospeak Logo"
                  class="w-32 h-32 rounded-lg app-logo"
                />
                <div>
                  <h3 class="text-2xl font-medium dark:text-white">Nospeak</h3>
                  <p class="text-gray-600 dark:text-slate-400">Version {packageVersion}</p>
                </div>
              </div>

              <div class="space-y-4 pt-4 border-t dark:border-slate-700">
                <div>
                  <h4
                    class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                  >
                    License
                  </h4>
                  <p class="typ-body text-gray-600 dark:text-slate-400">GPL</p>
                  <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    CC by-nc-nd psic4t
                  </p>
                </div>
              </div>
            </div>
          {:else if activeCategory === "Security"}
            <div class="space-y-6">
              <div class="space-y-2 max-w-xl">
                <p class="typ-section dark:text-white">{$t('settings.security.loginMethodTitle')}</p>
                <div>
                  {#if securityAuthMethod === "nip07"}
                    <span
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                    >
                      NIP-07 Extension
                    </span>
                  {:else if securityAuthMethod === "amber"}
                    <span
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      Amber / NIP-55
                    </span>
                  {:else if securityAuthMethod === "nip46"}
                    <span
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      NIP-46 / Amber (legacy)
                    </span>
                  {:else if securityAuthMethod === "local"}
                    <span
                      class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white dark:bg-blue-500/40 dark:text-blue-100"
                    >
                      Nsec
                    </span>
                  {:else}
                    <span class="text-sm text-gray-500 dark:text-slate-400">
                      {$t('settings.security.loginMethodUnknown')}
                    </span>
                  {/if}
                </div>
              </div>

              <div class="space-y-2 max-w-xl">
                <label class="font-medium dark:text-white" for="security-npub">
                  {$t('settings.security.npubLabel')}
                </label>
                <input
                  id="security-npub"
                  type="text"
                  readonly
                  value={$currentUser?.npub || ""}
                  class="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm font-mono overflow-x-auto focus:outline-none"
                />
              </div>

              {#if securityAuthMethod === "local"}
                <div class="space-y-2 max-w-xl">
                  <label class="font-medium dark:text-white" for="security-nsec">
                    {$t('settings.security.nsecLabel')}
                  </label>
                  <div class="relative">
                    <input
                      id="security-nsec"
                      type={showNsec ? "text" : "password"}
                      readonly
                      value={storedNsec}
                      class="w-full px-3 py-2 pr-10 border rounded-md bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onclick={() => (showNsec = !showNsec)}
                      aria-label={showNsec ? $t('settings.security.hideNsecAria') : $t('settings.security.showNsecAria')}
                    >
                      {#if showNsec}
                        <svg
                          class="w-5 h-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-3.5-10-7 0-1 .5-2 1.4-3.1M6.2 6.2C7.8 5.4 9.8 5 12 5c5 0 9 3.5 10 7-.3 1-.8 2-1.6 2.9M9.88 9.88A3 3 0 0114.12 14.12M4 4l16 16"
                          />
                        </svg>
                      {:else}
                        <svg
                          class="w-5 h-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      {/if}
                    </button>
                  </div>
                </div>
              {/if}

              <div class="pt-6 border-t dark:border-slate-700">
                <h4 class="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  {$t('settings.security.dangerZoneTitle')}
                </h4>
                <div
                  class="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-100 dark:border-red-800"
                >
                  <p class="text-sm text-red-700 dark:text-red-300 mb-3">
                    {$t('settings.security.dangerZoneDescription')}
                  </p>
                  <button
                    onclick={() => authService.logout()}
                    class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    {$t('settings.security.logoutButton')}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
