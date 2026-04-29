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

    // Green phone for the only "successful conversation" outcome; red
    // strikethrough for every other terminal state (the call did not result
    // in a connected conversation).
    const isSuccessful = $derived(message.callEventType === 'ended');
    const iconColor = $derived(isSuccessful ? 'text-green-500' : 'text-red-500');
</script>

<div class="flex justify-center my-2">
    <div class="flex flex-col items-center">
        <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4 {iconColor}"
            >
                {#if !isSuccessful}
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                    <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                {:else}
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                {/if}
            </svg>
            <span class="text-sm text-gray-700 dark:text-gray-300">
                {messageText}
            </span>
        </div>
        <span class="text-xs text-gray-400 mt-1">
            {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
    </div>
</div>
