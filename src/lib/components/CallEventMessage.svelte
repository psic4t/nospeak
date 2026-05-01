<script lang="ts">
    import type { Message } from '$lib/db/db';
    import { t } from '$lib/i18n';
    import { currentUser } from '$lib/stores/auth';

    interface Props {
        message: Message;
    }

    let { message }: Props = $props();

    function formatDuration(seconds: number | undefined): string {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * True iff the local user is the call's initiator (the side that called
     * `voiceCallService.initiateCall`). Determined by comparing the rumor's
     * `call-initiator` tag (persisted as `callInitiatorNpub`) against the
     * locally-authenticated user's npub.
     *
     * For asymmetric outcomes (`declined`, `busy`, `no-answer`) this drives
     * role-aware copy: the same Kind 16 rumor renders differently on the
     * caller's vs callee's device. Symmetric outcomes (`ended`, `failed`)
     * ignore this. Local-only outcomes (`missed`, `cancelled`) only ever
     * appear on the side that authored them, so role is implied.
     */
    const iAmInitiator = $derived(
        !!message.callInitiatorNpub &&
        !!$currentUser &&
        message.callInitiatorNpub === $currentUser.npub
    );

    /**
     * Map a callEventType (+ role) to its pill label.
     *
     * Legacy values (`'outgoing'`, `'incoming'`, plus the interim
     * `'declined-outgoing'`/`'declined-incoming'` from an earlier iteration
     * of this same change that never shipped) and any forward-compat value
     * we don't recognise fall through to the generic 'Voice call' label so
     * the row never renders blank.
     */
    const messageText = $derived.by(() => {
        switch (message.callEventType) {
            case 'missed':
                return $t('voiceCall.pill.missed');
            case 'cancelled':
                return $t('voiceCall.pill.cancelled');
            case 'ended': {
                const duration = formatDuration(message.callDuration);
                if (duration) {
                    const template = $t('voiceCall.pill.endedWithDuration');
                    return template.replace('{duration}', duration);
                }
                return $t('voiceCall.pill.ended');
            }
            case 'declined':
                return iAmInitiator
                    ? $t('voiceCall.pill.declinedByPeer')
                    : $t('voiceCall.pill.declinedByMe');
            case 'busy':
                return iAmInitiator
                    ? $t('voiceCall.pill.busyByPeer')
                    : $t('voiceCall.pill.busyMe');
            case 'no-answer':
                return iAmInitiator
                    ? $t('voiceCall.pill.noAnswerByPeer')
                    : $t('voiceCall.pill.noAnswerMe');
            case 'failed':
                return $t('voiceCall.pill.failed');
            default:
                // Legacy ('outgoing', 'incoming', 'declined-outgoing',
                // 'declined-incoming') and unknown forward-compat values.
                return $t('voiceCall.pill.generic');
        }
    });

    // Green for the only "successful conversation" outcome (`ended`); red
    // for every other terminal state (the call did not result in a
    // connected conversation). Applied to the directional arrow — the
    // pill no longer carries a phone icon, so the arrow color carries
    // the success/failure read.
    const isSuccessful = $derived(message.callEventType === 'ended');
    const iconColor = $derived(isSuccessful ? 'text-green-500' : 'text-red-500');

    /**
     * Direction of the call relative to the local user, used to render a
     * small arrow glyph at the start of the pill:
     *
     *   - 'outgoing' (arrow up-right) — the local user initiated the call.
     *   - 'incoming' (arrow down-left) — the peer initiated the call.
     *   - 'none' — legacy rows with no `call-initiator` tag (or no
     *     authenticated user); no arrow is rendered to avoid guessing.
     *
     * The arrow inherits the success/failure color (green for `ended`,
     * red otherwise), so a glance at the pill conveys both who started
     * the call and whether it connected.
     */
    const callDirection = $derived.by<'outgoing' | 'incoming' | 'none'>(() => {
        if (!message.callInitiatorNpub || !$currentUser) return 'none';
        return iAmInitiator ? 'outgoing' : 'incoming';
    });

    const directionLabel = $derived(
        callDirection === 'outgoing'
            ? $t('voiceCall.pill.directionOutgoing')
            : callDirection === 'incoming'
            ? $t('voiceCall.pill.directionIncoming')
            : ''
    );
</script>

<div class="flex justify-center my-2">
    <div class="flex flex-col items-center">
        <div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
            {#if callDirection !== 'none'}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-4 h-4 {iconColor}"
                    role="img"
                    aria-label={directionLabel}
                >
                    {#if callDirection === 'outgoing'}
                        <!-- arrow-up-right: line from bottom-left to top-right + arrowhead -->
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="8 7 17 7 17 16"></polyline>
                    {:else}
                        <!-- arrow-down-left: line from top-right to bottom-left + arrowhead -->
                        <line x1="17" y1="7" x2="7" y2="17"></line>
                        <polyline points="16 17 7 17 7 8"></polyline>
                    {/if}
                </svg>
            {/if}
            <span class="text-sm text-gray-700 dark:text-gray-300">
                {messageText}
            </span>
        </div>
        <span class="text-xs text-gray-400 mt-1">
            {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
    </div>
</div>
