<script lang="ts">
    import { showEmptyProfileModal } from '$lib/stores/modals';
    import { relaySettingsService } from '$lib/core/RelaySettingsService';
     import { profileService } from '$lib/core/ProfileService';
     import { connectionManager } from '$lib/core/connection/instance';
     import { fade } from 'svelte/transition';
     import { glassModal } from '$lib/utils/transitions';
 
     let { isOpen = false } = $props<{ isOpen: boolean }>();


    const DEFAULT_EMPTY_PROFILE_RELAYS = [
        'wss://nostr.data.haus',
        'wss://nos.lol',
        'wss://relay.damus.io'
    ];

    let username = $state('');
    let isSaving = $state(false);
    let errorMessage = $state('');

    function close() {
        showEmptyProfileModal.set(false);
    }

    function handleOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            close();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            close();
        }
    }

    async function handleContinue() {
        if (!username.trim()) {
            errorMessage = 'Please enter a username to continue.';
            return;
        }

        isSaving = true;
        errorMessage = '';

        try {
            await relaySettingsService.updateSettings(
                DEFAULT_EMPTY_PROFILE_RELAYS,
                DEFAULT_EMPTY_PROFILE_RELAYS
            );

            // Ensure default relays are connected in this session
            for (const url of DEFAULT_EMPTY_PROFILE_RELAYS) {
                connectionManager.addPersistentRelay(url);
            }

            const name = username.trim();
            await profileService.updateProfile({
                name,
                display_name: name
            });


            close();
        } catch (e) {
            console.error('Failed to apply initial profile setup:', e);
            errorMessage = 'Could not save your initial setup. Please try again.';
        } finally {
            isSaving = false;
        }
    }

</script>

{#if isOpen}
     <div
         in:fade={{ duration: 130 }}
         out:fade={{ duration: 110 }}
         class="fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-colors duration-150 ease-out"
         onclick={handleOverlayClick}
         onkeydown={handleKeydown}
         role="dialog"
         aria-modal="true"
         aria-labelledby="empty-profile-modal-title"
         tabindex="-1"
     >
         <div 
             in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }} 
             out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
             class="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/20 dark:border-white/10 transform-gpu will-change-transform will-change-filter transition-all duration-150 ease-out">

            <div class="flex flex-col gap-4 w-full">
                <div class="flex items-start gap-3">
                    <div class="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M4.93 19.07A10 10 0 1119.07 4.93 10 10 0 014.93 19.07z" />
                        </svg>
                    </div>
                    <div>
                        <h2 id="empty-profile-modal-title" class="text-lg font-bold dark:text-white mb-1">
                            Finish setting up your profile
                        </h2>
                        <p class="text-sm text-gray-600 dark:text-slate-300 mb-1">
                            This key doesn&apos;t have any messaging relays or a username configured yet.
                        </p>
                        <p class="text-xs text-gray-500 dark:text-slate-400 mb-3">
                            We&apos;ll configure some default messaging relays so nospeak can send and receive messages. You can change these later in Settings under Mailbox Relays.
                        </p>

                        <div class="mt-2">
                            <p class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                                Username
                            </p>
                            <input
                                type="text"
                                bind:value={username}
                                class="w-full px-3 py-2 border rounded-md bg-white/90 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Your name"
                            />
                            {#if errorMessage}
                                <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row justify-end gap-3 mt-4">
                    <button
                        type="button"
                        class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100/80 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:text-slate-100 border border-gray-200/60 dark:border-slate-700/60"
                        onclick={close}
                        disabled={isSaving}
                    >
                        I&apos;ll do this later
                    </button>
                    <button
                        type="button"
                        class="px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={handleContinue}
                        disabled={isSaving || !username.trim()}
                    >
                        {isSaving ? 'Saving...' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
