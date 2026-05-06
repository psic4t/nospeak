<script lang="ts">
    import { voiceCallState, groupVoiceCallState } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_OFFER_TIMEOUT_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { conversationRepo, generateGroupTitle } from '$lib/db/ConversationRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { nip19 } from 'nostr-tools';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';
    import { startIncomingRingtone, stopRingtone } from '$lib/core/voiceCall/ringtone';

    let profileName = $state('');
    let profilePicture = $state('');
    let groupTitle = $state('');
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

    /** Visible whenever EITHER store is ringing (group calls share the same overlay surface). */
    const isGroupIncoming = $derived(
        $groupVoiceCallState.status === 'incoming-ringing'
    );
    const isOneToOneIncoming = $derived(
        $voiceCallState.status === 'incoming-ringing'
    );
    const isVisible = $derived(isGroupIncoming || isOneToOneIncoming);

    $effect(() => {
        if (isGroupIncoming && $groupVoiceCallState.conversationId) {
            loadGroup($groupVoiceCallState.conversationId);
            startIncomingRingtone();
            // Group calls don't auto-hangup the local user — the per-pair
            // 60s offer timeouts inside the service will mark each
            // participant `'ended'` independently and the
            // last-one-standing finalizer ends the call locally.
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
        } else if (isOneToOneIncoming && $voiceCallState.peerNpub) {
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

    /**
     * Load the group conversation's display title for the incoming
     * group-call header. Falls back to a comma-joined participant
     * label when no subject is set, mirroring the chat-list rule.
     */
    async function loadGroup(conversationId: string) {
        const conv = await conversationRepo.getConversation(conversationId);
        if (!conv) {
            groupTitle = $t('voiceCall.incomingGroupCall');
            return;
        }
        if (conv.subject) {
            groupTitle = conv.subject;
            return;
        }
        const names: string[] = [];
        for (const np of conv.participants) {
            try {
                const profile = await profileRepo.getProfileIgnoreTTL(np);
                if (profile?.metadata) {
                    names.push(resolveDisplayName(profile.metadata, np));
                } else {
                    names.push(np.slice(0, 8) + '…');
                }
            } catch (_) {
                names.push(np.slice(0, 8) + '…');
            }
        }
        groupTitle = generateGroupTitle(names);
    }

    function accept() {
        if (isGroupIncoming) {
            void voiceCallService.acceptGroupCall?.();
        } else {
            voiceCallService.acceptCall();
        }
    }

    function decline() {
        if (isGroupIncoming) {
            voiceCallService.declineGroupCall?.();
        } else {
            voiceCallService.declineCall();
        }
    }

    onDestroy(() => {
        stopRingtone();
        if (dismissTimeout) clearTimeout(dismissTimeout);
    });

    // Display variables, derived per branch.
    const headerName = $derived(isGroupIncoming ? groupTitle : profileName);
    const subtitle = $derived(
        isGroupIncoming
            ? $t('voiceCall.incomingGroupCall')
            : $voiceCallState.callKind === 'video'
                ? $t('voiceCall.incomingVideoCall')
                : $t('voiceCall.incomingCall')
    );
</script>

{#if isVisible}
    <div class="fixed inset-0 z-[55] bg-black/90 md:bg-black/40 md:backdrop-blur-sm flex items-center justify-center md:p-4">
        <div
            class="w-full h-full flex flex-col items-center justify-center gap-8
                   md:w-full md:max-w-md md:h-auto md:gap-6 md:p-8
                   md:bg-[rgb(var(--color-mantle-rgb)/0.95)] md:dark:bg-slate-900/80 md:backdrop-blur-xl
                   md:rounded-3xl md:shadow-2xl md:border md:border-[rgb(var(--color-overlay0-rgb)/0.30)] md:dark:border-white/10"
        >
            <!-- Caller / group info -->
            <div class="flex flex-col items-center gap-4">
                {#if isGroupIncoming}
                    <div class="w-24 h-24 rounded-full bg-gray-700 md:bg-[rgb(var(--color-surface0-rgb))] md:dark:bg-[rgb(var(--color-surface1-rgb))] flex items-center justify-center text-white md:text-[rgb(var(--color-text-rgb))]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                {:else if profilePicture}
                    <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
                {:else}
                    <div class="w-24 h-24 rounded-full bg-gray-700 md:bg-[rgb(var(--color-surface0-rgb))] md:dark:bg-[rgb(var(--color-surface1-rgb))] flex items-center justify-center text-3xl text-white md:text-[rgb(var(--color-text-rgb))]">
                        {(profileName || '?').charAt(0).toUpperCase()}
                    </div>
                {/if}
                <span class="text-white md:text-[rgb(var(--color-text-rgb))] text-xl font-medium">{headerName}</span>
                <span class="text-gray-400 md:text-[rgb(var(--color-subtext0-rgb))] text-sm">
                    {subtitle}
                </span>
            </div>

            <!-- Accept / Decline buttons -->
            <div class="flex gap-16 md:gap-12">
                <button
                    onclick={decline}
                    class="flex flex-col items-center gap-2"
                    aria-label={$t('voiceCall.decline')}
                >
                    <div class="w-16 h-16 rounded-full bg-[rgb(var(--color-red-rgb))] flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 rotate-[135deg]">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <span class="text-white md:text-[rgb(var(--color-text-rgb))] text-xs">{$t('voiceCall.decline')}</span>
                </button>

                <button
                    onclick={accept}
                    class="flex flex-col items-center gap-2"
                    aria-label={$t('voiceCall.accept')}
                >
                    <div class="w-16 h-16 rounded-full bg-[rgb(var(--color-green-rgb))] flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <span class="text-white md:text-[rgb(var(--color-text-rgb))] text-xs">{$t('voiceCall.accept')}</span>
                </button>
            </div>
        </div>
    </div>
{/if}
