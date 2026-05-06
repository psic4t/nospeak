<script lang="ts">
    /**
     * Active group voice-call overlay (web/PWA).
     *
     * Mounts in the root layout alongside {@code ActiveCallOverlay}.
     * Becomes visible whenever {@code groupVoiceCallState} is in any
     * non-idle status; renders a header (group title + aggregate
     * status), a vertical list of participant rows with per-pair
     * status pills, and a bottom control row (mute, hangup). One
     * hidden {@code <audio autoplay>} element is bound per active peer
     * so the browser mixes audio across all peers without any
     * Web-Audio plumbing on our side.
     *
     * Voice-only in v1; group video calls are deferred. The "one call
     * total" invariant guarantees this overlay and the 1-on-1
     * {@code ActiveCallOverlay} are never visible simultaneously.
     */
    import {
        groupVoiceCallState,
        resetGroupCall
    } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_END_DISPLAY_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import {
        conversationRepo,
        generateGroupTitle
    } from '$lib/db/ConversationRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { nip19 } from 'nostr-tools';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';
    import {
        startOutgoingRingback,
        stopRingtone
    } from '$lib/core/voiceCall/ringtone';
    import type { ParticipantState } from '$lib/core/voiceCall/types';

    let groupTitle = $state('');
    let participantNames = $state<Record<string, string>>({});
    let participantPictures = $state<Record<string, string>>({});
    let endResetTimeout: ReturnType<typeof setTimeout> | null = null;
    let audioHostEl = $state<HTMLDivElement>();
    /** peerHex -> the bound <audio> element. Tracked so we can detach on cleanup. */
    let audioElements: Map<string, HTMLAudioElement> = new Map();

    const isVisible = $derived(
        $groupVoiceCallState.status === 'outgoing-ringing' ||
            $groupVoiceCallState.status === 'incoming-ringing' ||
            $groupVoiceCallState.status === 'connecting' ||
            $groupVoiceCallState.status === 'active' ||
            $groupVoiceCallState.status === 'ended'
    );

    const participantList = $derived.by<ParticipantState[]>(() => {
        const map = $groupVoiceCallState.participants;
        return Object.values(map);
    });

    const connectedCount = $derived(
        participantList.filter((p) => p.pcStatus === 'active').length
    );
    const totalOthers = $derived(participantList.length);

    function formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    const aggregateStatusText = $derived.by(() => {
        const s = $groupVoiceCallState;
        switch (s.status) {
            case 'outgoing-ringing':
            case 'incoming-ringing':
                return connectedCount === 0
                    ? $t('voiceCall.groupCallingNobody')
                    : $t('voiceCall.groupCallingSome', {
                          values: {
                              connected: String(connectedCount),
                              total: String(totalOthers)
                          }
                      });
            case 'connecting':
                return $t('voiceCall.connecting');
            case 'active':
                return formatDuration(s.duration);
            case 'ended':
                switch (s.endReason) {
                    case 'hangup':
                        return $t('voiceCall.endReasonHangup');
                    case 'rejected':
                        return $t('voiceCall.endReasonRejected');
                    case 'busy':
                        return $t('voiceCall.endReasonBusy');
                    case 'timeout':
                        return $t('voiceCall.endReasonTimeout');
                    case 'ice-failed':
                        return $t('voiceCall.endReasonIceFailed');
                    case 'error':
                        return $t('voiceCall.endReasonError');
                    case 'answered-elsewhere':
                        return $t('voiceCall.endReasonAnsweredElsewhere');
                    case 'rejected-elsewhere':
                        return $t('voiceCall.endReasonRejectedElsewhere');
                    default:
                        return $t('voiceCall.endReasonHangup');
                }
            default:
                return '';
        }
    });

    function participantStatusLabel(p: ParticipantState): string {
        switch (p.pcStatus) {
            case 'pending':
                return $t('voiceCall.groupCallParticipantPending');
            case 'ringing':
                return $t('voiceCall.groupCallParticipantRinging');
            case 'connecting':
                return $t('voiceCall.groupCallParticipantConnecting');
            case 'active':
                return $t('voiceCall.groupCallParticipantActive');
            case 'ended':
                return $t('voiceCall.groupCallParticipantEnded');
            default:
                return '';
        }
    }

    /** Color hint for the participant status pill. */
    function pillTone(p: ParticipantState): string {
        switch (p.pcStatus) {
            case 'active':
                return 'bg-[rgb(var(--color-green-rgb)/0.18)] text-[rgb(var(--color-green-rgb))]';
            case 'connecting':
            case 'ringing':
                return 'bg-[rgb(var(--color-yellow-rgb)/0.18)] text-[rgb(var(--color-yellow-rgb))]';
            case 'ended':
                return 'bg-[rgb(var(--color-red-rgb)/0.18)] text-[rgb(var(--color-red-rgb))]';
            default:
                return 'bg-[rgb(var(--color-overlay0-rgb)/0.20)] text-[rgb(var(--color-subtext0-rgb))]';
        }
    }

    /**
     * Load the anchor group conversation's display title plus per-peer
     * profile names so the participant rows render legible labels
     * instead of raw hex pubkeys.
     */
    $effect(() => {
        const conversationId = $groupVoiceCallState.conversationId;
        if (!conversationId) return;
        void loadGroup(conversationId);
    });

    async function loadGroup(conversationId: string): Promise<void> {
        const conv = await conversationRepo.getConversation(conversationId);
        const fallbackName = (npub: string) => npub.slice(0, 8) + '…';
        const names: Record<string, string> = {};
        const pics: Record<string, string> = {};
        if (conv) {
            const titleNames: string[] = [];
            for (const np of conv.participants) {
                let display = fallbackName(np);
                let pic = '';
                try {
                    const profile = await profileRepo.getProfileIgnoreTTL(np);
                    if (profile?.metadata) {
                        display = resolveDisplayName(profile.metadata, np);
                        pic = profile.metadata.picture || '';
                    }
                } catch (_) {
                    /* ignore */
                }
                titleNames.push(display);
                try {
                    const hex = (
                        nip19.decode(np).data as string
                    ).toLowerCase();
                    names[hex] = display;
                    pics[hex] = pic;
                } catch (_) {
                    /* ignore */
                }
            }
            groupTitle = conv.subject || generateGroupTitle(titleNames);
        } else {
            groupTitle = $t('voiceCall.groupCall');
        }
        participantNames = names;
        participantPictures = pics;
    }

    /** Outgoing ringback while we're calling and no peer is connected yet. */
    $effect(() => {
        if (
            $groupVoiceCallState.status === 'outgoing-ringing' &&
            connectedCount === 0
        ) {
            startOutgoingRingback();
        } else {
            stopRingtone();
        }
    });

    /**
     * Bind one hidden {@code <audio>} element per active peer's remote
     * stream so the browser mixes audio across all peers automatically.
     * Re-runs when the participants map changes (peers connect / drop)
     * so newly-arriving streams get attached and stale ones detached.
     */
    $effect(() => {
        if (!audioHostEl) return;
        const streams = voiceCallService.getGroupRemoteStreams
            ? voiceCallService.getGroupRemoteStreams()
            : new Map<string, MediaStream>();

        // Remove audio elements for peers that no longer have a stream.
        for (const [peerHex, el] of audioElements) {
            if (!streams.has(peerHex)) {
                try {
                    el.srcObject = null;
                } catch (_) {
                    /* ignore */
                }
                el.remove();
                audioElements.delete(peerHex);
            }
        }

        // Add or refresh audio elements for current streams.
        for (const [peerHex, stream] of streams) {
            let el = audioElements.get(peerHex);
            if (!el) {
                el = document.createElement('audio');
                el.autoplay = true;
                // Inline-styled to ensure it never affects layout.
                el.style.display = 'none';
                audioHostEl.appendChild(el);
                audioElements.set(peerHex, el);
            }
            if (el.srcObject !== stream) {
                el.srcObject = stream;
            }
        }
    });

    /** Auto-reset the group store after a brief Ended display window. */
    $effect(() => {
        if ($groupVoiceCallState.status === 'ended') {
            endResetTimeout = setTimeout(() => {
                resetGroupCall();
            }, CALL_END_DISPLAY_MS);
        }
    });

    function handleHangup() {
        voiceCallService.hangupGroupCall?.();
    }

    function handleToggleMute() {
        voiceCallService.toggleGroupMute?.();
    }

    onDestroy(() => {
        stopRingtone();
        if (endResetTimeout) clearTimeout(endResetTimeout);
        for (const [, el] of audioElements) {
            try {
                el.srcObject = null;
            } catch (_) {
                /* ignore */
            }
            el.remove();
        }
        audioElements.clear();
    });
</script>

{#if isVisible}
    <div class="fixed inset-0 z-[55] bg-black/90 md:bg-black/40 md:backdrop-blur-sm flex items-center justify-center md:p-4">
        <!-- Hidden audio host: per-peer <audio> elements are appended
             here imperatively so the Svelte template stays simple even
             as peers come and go. -->
        <div bind:this={audioHostEl}></div>

        <div
            class="w-full h-full flex flex-col gap-6 px-4 py-8
                   md:w-full md:max-w-md md:h-auto md:gap-5 md:p-8
                   md:bg-[rgb(var(--color-mantle-rgb)/0.95)] md:dark:bg-slate-900/80 md:backdrop-blur-xl
                   md:rounded-3xl md:shadow-2xl md:border md:border-[rgb(var(--color-overlay0-rgb)/0.30)] md:dark:border-white/10"
        >
            <!-- Header: group icon + title + aggregate status. -->
            <div class="flex flex-col items-center gap-3">
                <div class="w-20 h-20 rounded-full bg-gray-700 md:bg-[rgb(var(--color-surface0-rgb))] md:dark:bg-[rgb(var(--color-surface1-rgb))] flex items-center justify-center text-white md:text-[rgb(var(--color-text-rgb))]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-9 h-9">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <span class="text-white md:text-[rgb(var(--color-text-rgb))] text-lg font-medium text-center px-4">
                    {groupTitle || $t('voiceCall.groupCall')}
                </span>
                <span class="text-gray-400 md:text-[rgb(var(--color-subtext0-rgb))] text-sm">
                    {aggregateStatusText}
                </span>
            </div>

            <!-- Participant rows. -->
            <div class="flex-1 md:flex-none overflow-y-auto flex flex-col gap-2 px-1">
                {#each participantList as p (p.pubkeyHex)}
                    {@const name = participantNames[p.pubkeyHex] ?? (p.pubkeyHex.slice(0, 8) + '…')}
                    {@const pic = participantPictures[p.pubkeyHex] ?? ''}
                    <div class="flex items-center gap-3 px-3 py-2 rounded-2xl bg-white/5 dark:bg-slate-800/40 md:bg-[rgb(var(--color-surface0-rgb)/0.40)]">
                        {#if pic}
                            <img src={pic} alt="" class="w-10 h-10 rounded-full object-cover" />
                        {:else}
                            <div class="w-10 h-10 rounded-full bg-gray-700 md:bg-[rgb(var(--color-surface1-rgb))] flex items-center justify-center text-sm text-white md:text-[rgb(var(--color-text-rgb))]">
                                {(name || '?').charAt(0).toUpperCase()}
                            </div>
                        {/if}
                        <span class="flex-1 truncate text-white md:text-[rgb(var(--color-text-rgb))] text-sm">{name}</span>
                        <span class="text-xs px-2 py-1 rounded-full {pillTone(p)}">
                            {participantStatusLabel(p)}
                        </span>
                    </div>
                {/each}
            </div>

            <!-- Controls: mute + hangup (leave). -->
            <div class="flex items-center justify-center gap-10 pt-2">
                <button
                    onclick={handleToggleMute}
                    class="flex flex-col items-center gap-1"
                    aria-label={$groupVoiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                >
                    <div class="w-14 h-14 rounded-full bg-white/10 dark:bg-slate-700/60 md:bg-[rgb(var(--color-surface0-rgb))] flex items-center justify-center text-white md:text-[rgb(var(--color-text-rgb))]">
                        {#if $groupVoiceCallState.isMuted}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                            </svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                            </svg>
                        {/if}
                    </div>
                    <span class="text-white md:text-[rgb(var(--color-text-rgb))] text-xs">
                        {$groupVoiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                    </span>
                </button>

                <button
                    onclick={handleHangup}
                    class="flex flex-col items-center gap-1"
                    aria-label={$t('voiceCall.leave')}
                >
                    <div class="w-14 h-14 rounded-full bg-[rgb(var(--color-red-rgb))] flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 rotate-[135deg]">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <span class="text-white md:text-[rgb(var(--color-text-rgb))] text-xs">
                        {$t('voiceCall.leave')}
                    </span>
                </button>
            </div>
        </div>
    </div>
{/if}
