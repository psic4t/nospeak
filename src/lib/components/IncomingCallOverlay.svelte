<script lang="ts">
    import { voiceCallState } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_OFFER_TIMEOUT_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';

    let profileName = $state('');
    let profilePicture = $state('');
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        if ($voiceCallState.status === 'incoming-ringing' && $voiceCallState.peerNpub) {
            loadProfile($voiceCallState.peerNpub);
            // Don't send reject on timeout — let caller's own timeout fire.
            // Just dismiss the UI locally.
            dismissTimeout = setTimeout(() => {
                voiceCallService.hangup();
            }, CALL_OFFER_TIMEOUT_MS);

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
        } else {
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
            }
        }
    });

    async function loadProfile(npub: string) {
        const profile = await profileRepo.getProfileIgnoreTTL(npub);
        if (profile?.metadata) {
            profileName = resolveDisplayName(profile.metadata, npub);
            profilePicture = profile.metadata.picture || '';
        } else {
            profileName = npub.slice(0, 12) + '...';
        }
    }

    function accept() {
        voiceCallService.acceptCall();
    }

    function decline() {
        voiceCallService.declineCall();
    }

    onDestroy(() => {
        if (dismissTimeout) clearTimeout(dismissTimeout);
    });
</script>

{#if $voiceCallState.status === 'incoming-ringing'}
    <div class="fixed inset-0 z-[55] bg-black/90 flex flex-col items-center justify-center gap-8">
        <!-- Caller info -->
        <div class="flex flex-col items-center gap-4">
            {#if profilePicture}
                <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
            {:else}
                <div class="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-3xl text-white">
                    {profileName.charAt(0).toUpperCase()}
                </div>
            {/if}
            <span class="text-white text-xl font-medium">{profileName}</span>
            <span class="text-gray-400 text-sm">{$t('voiceCall.incomingCall')}</span>
        </div>

        <!-- Accept / Decline buttons -->
        <div class="flex gap-16">
            <button
                onclick={decline}
                class="flex flex-col items-center gap-2"
                aria-label={$t('voiceCall.decline')}
            >
                <div class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 rotate-[135deg]">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </div>
                <span class="text-white text-xs">{$t('voiceCall.decline')}</span>
            </button>

            <button
                onclick={accept}
                class="flex flex-col items-center gap-2"
                aria-label={$t('voiceCall.accept')}
            >
                <div class="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </div>
                <span class="text-white text-xs">{$t('voiceCall.accept')}</span>
            </button>
        </div>
    </div>
{/if}
