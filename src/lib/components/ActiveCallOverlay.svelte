<script lang="ts">
    import { voiceCallState, resetCall } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_END_DISPLAY_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';

    let profileName = $state('');
    let profilePicture = $state('');
    let audioEl = $state<HTMLAudioElement>();
    let endResetTimeout: ReturnType<typeof setTimeout> | null = null;

    const isVisible = $derived(
        $voiceCallState.status === 'outgoing-ringing' ||
        $voiceCallState.status === 'connecting' ||
        $voiceCallState.status === 'active' ||
        $voiceCallState.status === 'ended'
    );

    const statusText = $derived.by(() => {
        switch ($voiceCallState.status) {
            case 'outgoing-ringing': return $t('voiceCall.calling');
            case 'connecting': return $t('voiceCall.connecting');
            case 'active': return formatDuration($voiceCallState.duration);
            case 'ended': return endReasonText($voiceCallState.endReason);
            default: return '';
        }
    });

    function formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function endReasonText(reason: string | null): string {
        switch (reason) {
            case 'hangup': return $t('voiceCall.endReasonHangup');
            case 'rejected': return $t('voiceCall.endReasonRejected');
            case 'busy': return $t('voiceCall.endReasonBusy');
            case 'timeout': return $t('voiceCall.endReasonTimeout');
            case 'ice-failed': return $t('voiceCall.endReasonIceFailed');
            case 'error': return $t('voiceCall.endReasonError');
            default: return $t('voiceCall.endReasonHangup');
        }
    }

    $effect(() => {
        if ($voiceCallState.peerNpub) {
            loadProfile($voiceCallState.peerNpub);
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'active' && audioEl) {
            const stream = voiceCallService.getRemoteStream();
            if (stream) {
                audioEl.srcObject = stream;
            }
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'ended') {
            endResetTimeout = setTimeout(() => {
                resetCall();
            }, CALL_END_DISPLAY_MS);
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

    function handleHangup() {
        voiceCallService.hangup();
    }

    function handleToggleMute() {
        voiceCallService.toggleMute();
    }

    onDestroy(() => {
        if (endResetTimeout) clearTimeout(endResetTimeout);
    });
</script>

{#if isVisible}
    <div class="fixed inset-0 z-[55] bg-black/90 flex flex-col items-center justify-center gap-8">
        <!-- Hidden audio element for remote stream -->
        <audio bind:this={audioEl} autoplay></audio>

        <!-- Peer info -->
        <div class="flex flex-col items-center gap-4">
            {#if profilePicture}
                <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
            {:else}
                <div class="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-3xl text-white">
                    {profileName.charAt(0).toUpperCase()}
                </div>
            {/if}
            <span class="text-white text-xl font-medium">{profileName}</span>
            <span class="text-gray-400 text-lg">{statusText}</span>
        </div>

        <!-- Controls -->
        {#if $voiceCallState.status !== 'ended'}
            <div class="flex gap-12 items-center">
                <!-- Mute -->
                <button
                    onclick={handleToggleMute}
                    class="flex flex-col items-center gap-2"
                    aria-label={$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                >
                    <div class="w-14 h-14 rounded-full flex items-center justify-center {$voiceCallState.isMuted ? 'bg-white' : 'bg-gray-700'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={$voiceCallState.isMuted ? 'black' : 'white'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                            {#if $voiceCallState.isMuted}
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            {:else}
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            {/if}
                        </svg>
                    </div>
                    <span class="text-white text-xs">
                        {$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                    </span>
                </button>

                <!-- Hangup -->
                <button
                    onclick={handleHangup}
                    class="flex flex-col items-center gap-2"
                    aria-label={$t('voiceCall.hangup')}
                >
                    <div class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 rotate-[135deg]">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                </button>

                <!-- Speaker -->
                <button
                    onclick={() => { /* speaker toggle - platform-dependent, placeholder for v1 */ }}
                    class="flex flex-col items-center gap-2"
                    aria-label={$t('voiceCall.speaker')}
                >
                    <div class="w-14 h-14 rounded-full flex items-center justify-center {$voiceCallState.isSpeakerOn ? 'bg-white' : 'bg-gray-700'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={$voiceCallState.isSpeakerOn ? 'black' : 'white'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </div>
                    <span class="text-white text-xs">{$t('voiceCall.speaker')}</span>
                </button>
            </div>
        {/if}
    </div>
{/if}
