<script lang="ts">
    import { voiceCallState } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_OFFER_TIMEOUT_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';
    import { startIncomingRingtone, stopRingtone } from '$lib/core/voiceCall/ringtone';

    let profileName = $state('');
    let profilePicture = $state('');
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        if ($voiceCallState.status === 'incoming-ringing' && $voiceCallState.peerNpub) {
            loadProfile($voiceCallState.peerNpub);
            startIncomingRingtone();

            dismissTimeout = setTimeout(() => {
                voiceCallService.hangup();
            }, CALL_OFFER_TIMEOUT_MS);

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
        } else {
            stopRingtone();
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
        stopRingtone();
        if (dismissTimeout) clearTimeout(dismissTimeout);
    });
</script>

{#if $voiceCallState.status === 'incoming-ringing'}
    <div class="fixed inset-0 z-[55] bg-black/90 md:bg-black/40 md:backdrop-blur-sm flex items-center justify-center md:p-4">
        <div
            class="w-full h-full flex flex-col items-center justify-center gap-8
                   md:w-full md:max-w-md md:h-auto md:gap-6 md:p-8
                   md:bg-white/95 md:dark:bg-slate-900/80 md:backdrop-blur-xl
                   md:rounded-3xl md:shadow-2xl md:border md:border-white/20 md:dark:border-white/10"
        >
            <!-- Caller info -->
            <div class="flex flex-col items-center gap-4">
                {#if profilePicture}
                    <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
                {:else}
                    <div class="w-24 h-24 rounded-full bg-gray-700 md:bg-slate-300 md:dark:bg-gray-700 flex items-center justify-center text-3xl text-white md:text-slate-700 md:dark:text-white">
                        {profileName.charAt(0).toUpperCase()}
                    </div>
                {/if}
                <span class="text-white md:text-slate-900 md:dark:text-white text-xl font-medium">{profileName}</span>
                <span class="text-gray-400 md:text-slate-600 md:dark:text-gray-400 text-sm">
                    {$voiceCallState.callKind === 'video'
                        ? $t('voiceCall.incomingVideoCall')
                        : $t('voiceCall.incomingCall')}
                </span>
            </div>

            <!-- Accept / Decline buttons -->
            <div class="flex gap-16 md:gap-12">
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
                    <span class="text-white md:text-slate-700 md:dark:text-white text-xs">{$t('voiceCall.decline')}</span>
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
                    <span class="text-white md:text-slate-700 md:dark:text-white text-xs">{$t('voiceCall.accept')}</span>
                </button>
            </div>
        </div>
    </div>
{/if}
