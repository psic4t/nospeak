<script lang="ts">
    import { showEmptyProfileModal } from '$lib/stores/modals';
    import { relaySettingsService } from '$lib/core/RelaySettingsService';
    import { getDefaultMessagingRelays } from '$lib/core/runtimeConfig';
     import { profileService } from '$lib/core/ProfileService';
     import { connectionManager } from '$lib/core/connection/instance';
     import { fade } from 'svelte/transition';
     import { glassModal } from '$lib/utils/transitions';
     import { t } from '$lib/i18n';
     import { get } from 'svelte/store';
     import Button from '$lib/components/ui/Button.svelte';
     import { profileRepo } from '$lib/db/ProfileRepository';
     import { currentUser } from '$lib/stores/auth';
 
     let { isOpen = false } = $props<{ isOpen: boolean }>();


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
            errorMessage = get(t)('modals.emptyProfile.usernameRequired') as string;
            return;
        }

        isSaving = true;
        errorMessage = '';

        try {
            // Only set default relays if user doesn't already have relays configured
            // (they may have been set via manual relay input during sync)
            const currentUserData = get(currentUser);
            const existingProfile = currentUserData
                ? await profileRepo.getProfileIgnoreTTL(currentUserData.npub)
                : null;
            const hasExistingRelays = (existingProfile?.messagingRelays?.length ?? 0) > 0;

            if (!hasExistingRelays) {
                await relaySettingsService.updateSettings(
                    getDefaultMessagingRelays()
                );
            }

            const name = username.trim();
            await profileService.updateProfile({
                name,
                display_name: name
            });


            close();
        } catch (e) {
            console.error('Failed to apply initial profile setup:', e);
            errorMessage = get(t)('modals.emptyProfile.saveError') as string;
        } finally {
            isSaving = false;
        }
    }

</script>

{#if isOpen}
     <div
         in:fade={{ duration: 130 }}
         out:fade={{ duration: 110 }}
         class="fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
             class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/20 dark:border-white/10">

            <div class="flex flex-col gap-4 w-full">
                <div>
                    <h2 id="empty-profile-modal-title" class="typ-title dark:text-white mb-1">
                        {$t('modals.emptyProfile.title')}
                    </h2>
                         <p class="typ-body mb-1">
                            {$t('modals.emptyProfile.introLine1')}
                        </p>
 
                        <p class="typ-body text-xs mb-3">
                            {$t('modals.emptyProfile.introLine2')}
                        </p>
 
                        <div class="mt-2">
                            <p class="block text-xs font-medium mb-1">
                                {$t('modals.emptyProfile.usernameLabel')}
                            </p>
                            <input
                                type="text"
                                bind:value={username}
                                class="w-full px-3 py-2 border rounded-md bg-white/90 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={$t('modals.emptyProfile.usernamePlaceholder')}
                            />
                            {#if errorMessage}
                                <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row justify-end gap-3 mt-4">
                    <Button
                        variant="ghost"
                        onclick={close}
                        disabled={isSaving}
                    >
                        {$t('modals.emptyProfile.doLater')}
                    </Button>
                    <Button
                        variant="primary"
                        onclick={handleContinue}
                        disabled={isSaving || !username.trim()}
                    >
                        {isSaving ? $t('modals.emptyProfile.saving') : $t('modals.emptyProfile.continue')}
                    </Button>
                </div>
            </div>
        </div>
{/if}
