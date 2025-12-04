<script lang="ts">
  import { notificationService } from "$lib/core/NotificationService";
  import { relaySettingsService } from "$lib/core/RelaySettingsService";
  import { profileService } from "$lib/core/ProfileService";
  import { authService } from "$lib/core/AuthService";
  import { currentUser } from "$lib/stores/auth";
  import { profileRepo } from "$lib/db/ProfileRepository";
  import { getCurrentThemeMode, setThemeMode } from "$lib/stores/theme.svelte";
  import type { ThemeMode } from "$lib/stores/theme";
  import MediaUploadButton from './MediaUploadButton.svelte';
  const packageVersion = "0.6.1";

  let { isOpen = false, close = () => {} } = $props<{
    isOpen: boolean;
    close: () => void;
  }>();

  let notificationsEnabled = $state(false);
  let isSupported = $state(false);
  let isLoaded = $state(false);

  type Category = "General" | "Profile" | "Mailbox Relays" | "About";
  let activeCategory = $state<Category>("General");

  let themeMode = $state<ThemeMode>("system");

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

  // Relay settings
  type RelayConfig = {
    url: string;
    read: boolean;
    write: boolean;
  };
  let relays = $state<RelayConfig[]>([]);
  let newRelayUrl = $state("");

  function handlePictureUpload(file: File, type: 'image' | 'video', url?: string) {
    if (url) {
      profilePicture = url;
      saveProfile();
    }
  }

  function handleBannerUpload(file: File, type: 'image' | 'video', url?: string) {
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
        lud16: profileLud16,
      });
      // Optional: Show success feedback
    } catch (e) {
      console.error("Failed to save profile:", e);
      // Optional: Show error feedback
    } finally {
      isSavingProfile = false;
    }
  }

  async function loadRelaySettings() {
    let readRelays: string[] = [];
    let writeRelays: string[] = [];

    if ($currentUser?.npub) {
      const profile = await profileRepo.getProfileIgnoreTTL($currentUser.npub);
      if (profile) {
        readRelays = profile.readRelays || [];
        writeRelays = profile.writeRelays || [];
      }
    }

    const allUrls = new Set([...readRelays, ...writeRelays]);

    relays = Array.from(allUrls)
      .map((url) => ({
        url,
        read: readRelays.includes(url),
        write: writeRelays.includes(url),
      }))
      .sort((a, b) => a.url.localeCompare(b.url));
  }

  async function saveRelaySettings() {
    const readRelays = relays.filter((r) => r.read).map((r) => r.url);
    const writeRelays = relays.filter((r) => r.write).map((r) => r.url);
    await relaySettingsService.updateSettings(readRelays, writeRelays);
  }

  function addRelay() {
    if (!newRelayUrl) return;
    let url = newRelayUrl.trim();

    // Basic URL validation/normalization
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      url = "wss://" + url;
    }

    if (!relays.find((r) => r.url === url)) {
      relays = [...relays, { url, read: true, write: true }];
      saveRelaySettings();
    }
    newRelayUrl = "";
  }

  function removeRelay(url: string) {
    relays = relays.filter((r) => r.url !== url);
    saveRelaySettings();
  }

  function toggleRelayPermission(url: string, type: "read" | "write") {
    const index = relays.findIndex((r) => r.url === url);
    if (index !== -1) {
      const relay = relays[index];
      const updated = { ...relay, [type]: !relay[type] };

      const newRelays = [...relays];
      newRelays[index] = updated;
      relays = newRelays;
      saveRelaySettings();
    }
  }

  let showMobileContent = $state(false);

  // Load settings from localStorage
  $effect(() => {
    if (isOpen) {
      showMobileContent = false;
    }
    if (isOpen && !isLoaded) {
      isSupported = notificationService.isSupported();
      const saved = localStorage.getItem("nospeak-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        notificationsEnabled = settings.notificationsEnabled || false;
      }

      themeMode = getCurrentThemeMode();

      loadRelaySettings();
      loadProfile();
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

  function handleThemeModeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as ThemeMode;
    themeMode = value;
    setThemeMode(value);
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
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  >
    <div
      class="bg-white dark:bg-gray-800 w-full h-full rounded-none md:max-w-4xl md:mx-4 md:h-[600px] md:rounded-lg shadow-xl flex overflow-hidden"
    >
      <!-- Sidebar -->
      <div
        class={`w-full md:w-64 bg-gray-50 dark:bg-gray-900 border-r dark:border-gray-700 p-4 flex-col ${showMobileContent ? 'hidden md:flex' : 'flex'}`}
      >
        <div class="flex items-center gap-2 mb-6 px-2">
            <button
                class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onclick={close}
                aria-label="Close settings"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>
            <h2
            id="settings-title"
            class="text-xl font-bold dark:text-white"
            >
            Settings
            </h2>
        </div>

        <nav class="space-y-1">
          <button
            class={`w-full text-left px-3 py-2 rounded-md transition-colors ${activeCategory === "General" ? "bg-gray-200 dark:bg-gray-700 font-medium dark:text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            onclick={() => { activeCategory = "General"; showMobileContent = true; }}
          >
            General
          </button>
          <button
            class={`w-full text-left px-3 py-2 rounded-md transition-colors ${activeCategory === "Profile" ? "bg-gray-200 dark:bg-gray-700 font-medium dark:text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            onclick={() => { activeCategory = "Profile"; showMobileContent = true; }}
          >
            Profile
          </button>
          <button
            class={`w-full text-left px-3 py-2 rounded-md transition-colors ${activeCategory === "Mailbox Relays" ? "bg-gray-200 dark:bg-gray-700 font-medium dark:text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            onclick={() => { activeCategory = "Mailbox Relays"; showMobileContent = true; }}
          >
            Mailbox Relays
          </button>
          <button
            class={`w-full text-left px-3 py-2 rounded-md transition-colors ${activeCategory === "About" ? "bg-gray-200 dark:bg-gray-700 font-medium dark:text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            onclick={() => { activeCategory = "About"; showMobileContent = true; }}
          >
            About
          </button>
        </nav>
      </div>

      <!-- Content -->
      <div class={`flex-1 flex-col min-w-0 ${showMobileContent ? 'flex' : 'hidden md:flex'}`}>
        <div
          class="p-6 flex justify-between items-center border-b dark:border-gray-700"
        >
          <div class="flex items-center gap-2">
            <button
                class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onclick={() => showMobileContent = false}
                aria-label="Back to categories"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>
            <h3 class="text-lg font-semibold dark:text-white">
              {activeCategory}
            </h3>
          </div>
          <button
            onclick={close}
            class="hidden md:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close settings"
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
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          {#if activeCategory === "General"}
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <label
                    for="theme-mode"
                    class="font-medium dark:text-white"
                    >Appearance</label
                  >
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Choose whether to follow System, Light, or Dark mode.
                  </p>
                </div>
                <select
                  id="theme-mode"
                  bind:value={themeMode}
                  onchange={handleThemeModeChange}
                  class="ml-4 px-3 py-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <label
                    for="notifications-toggle"
                    class="font-medium dark:text-white"
                    >Browser Notifications</label
                  >
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {isSupported
                      ? "Get notified when you receive new messages"
                      : "Browser notifications not supported in this browser"}
                  </p>
                </div>
                {#if isSupported}
                  <button
                    id="notifications-toggle"
                    onclick={toggleNotifications}
                    class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationsEnabled
                        ? "bg-blue-500"
                        : "bg-gray-200 dark:bg-gray-600"
                    }`}
                    aria-label={notificationsEnabled
                      ? "Disable notifications"
                      : "Enable notifications"}
                  >
                    <span
                      class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationsEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    ></span>
                  </button>
                {:else}
                  <span class="text-sm text-gray-400 dark:text-gray-500"
                    >Not supported</span
                  >
                {/if}
              </div>

              <div class="pt-6 border-t dark:border-gray-700">
                <h4
                  class="text-sm font-medium text-red-600 dark:text-red-400 mb-2"
                >
                  Danger Zone
                </h4>
                <div
                  class="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-100 dark:border-red-800"
                >
                  <p class="text-sm text-red-700 dark:text-red-300 mb-3">
                    Logging out will remove all cached data from this device.
                  </p>
                  <button
                    onclick={() => authService.logout()}
                    class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          {:else if activeCategory === "Profile"}
            <div class="space-y-6">
              <div class="grid grid-cols-1 gap-6">
                <div>
                  <label
                    for="profile-name"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Name</label
                  >
                  <input
                    id="profile-name"
                    bind:value={profileName}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label
                    for="profile-display-name"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Display Name</label
                  >
                  <input
                    id="profile-display-name"
                    bind:value={profileDisplayName}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Display name"
                  />
                </div>

                <div>
                  <label
                    for="profile-about"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >About</label
                  >
                  <textarea
                    id="profile-about"
                    bind:value={profileAbout}
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tell us about yourself"
                  ></textarea>
                </div>

                <div>
                  <label
                    for="profile-picture"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Picture URL</label
                  >
                  <div class="flex gap-2">
                    <MediaUploadButton onFileSelect={handlePictureUpload} />
                    <input
                      id="profile-picture"
                      bind:value={profilePicture}
                      type="url"
                      class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="profile-banner"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Banner URL</label
                  >
                  <div class="flex gap-2">
                    <MediaUploadButton onFileSelect={handleBannerUpload} />
                    <input
                      id="profile-banner"
                      bind:value={profileBanner}
                      type="url"
                      class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/banner.jpg"
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="profile-nip05"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >NIP-05 (Username)</label
                  >
                  <input
                    id="profile-nip05"
                    bind:value={profileNip05}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="name@domain.com"
                  />
                </div>

                <div>
                  <label
                    for="profile-website"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Website</label
                  >
                  <input
                    id="profile-website"
                    bind:value={profileWebsite}
                    type="url"
                    class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label
                    for="profile-lud16"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Lightning Address (LUD-16)</label
                  >
                  <input
                    id="profile-lud16"
                    bind:value={profileLud16}
                    type="text"
                    class="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@provider.com"
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
                      Saving...
                    {:else}
                      Save Changes
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {:else if activeCategory === "Mailbox Relays"}
            <div class="space-y-6">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Configure your NIP-65 Mailbox Relays. These relays inform others
                where to send you messages (Read) and where to find your
                messages (Write).
              </p>

              <div class="flex gap-2">
                <input
                  bind:value={newRelayUrl}
                  placeholder="wss://relay.example.com"
                  class="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onkeydown={(e) => e.key === "Enter" && addRelay()}
                />
                <button
                  onclick={addRelay}
                  class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  Add
                </button>
              </div>

              <div
                class="space-y-2 border rounded-md dark:border-gray-700 divide-y dark:divide-gray-700"
              >
                {#each relays as relay}
                  <div
                    class="p-3 flex items-center justify-between bg-white dark:bg-gray-800"
                  >
                    <div class="flex-1 min-w-0 pr-4">
                      <p
                        class="text-sm font-medium dark:text-white truncate"
                        title={relay.url}
                      >
                        {relay.url}
                      </p>
                    </div>
                    <div class="flex items-center gap-4">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={relay.read}
                          onchange={() =>
                            toggleRelayPermission(relay.url, "read")}
                          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span class="text-sm text-gray-600 dark:text-gray-400"
                          >Read</span
                        >
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={relay.write}
                          onchange={() =>
                            toggleRelayPermission(relay.url, "write")}
                          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span class="text-sm text-gray-600 dark:text-gray-400"
                          >Write</span
                        >
                      </label>
                      <button
                        onclick={() => removeRelay(relay.url)}
                        class="text-red-500 hover:text-red-700 p-1"
                        title="Remove relay"
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
                  <div class="p-4 text-center text-gray-500 dark:text-gray-400">
                    No relays configured
                  </div>
                {/each}
              </div>
            </div>
          {:else if activeCategory === "About"}
            <div class="space-y-6">
              <div class="flex items-center gap-6">
                <img
                  src="/nospeak.png"
                  alt="Nospeak Logo"
                  class="w-32 h-32 rounded-lg"
                />
                <div>
                  <h3 class="text-2xl font-medium dark:text-white">Nospeak</h3>
                  <p class="text-gray-600 dark:text-gray-400">
                    Version {packageVersion}
                  </p>
                </div>
              </div>

              <div class="space-y-4 pt-4 border-t dark:border-gray-700">
                <div>
                  <h4
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    License
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    GPL
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    CC by-nc-nd psic4t
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

