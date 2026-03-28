<script lang="ts">
    import type { Message } from '$lib/db/db';

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

    function getMessageText(): string {
        switch (message.callEventType) {
            case 'missed':
                return 'Missed voice call';
            case 'ended': {
                const duration = formatDuration(message.callDuration);
                return duration ? `Voice call ended \u2022 ${duration}` : 'Voice call ended';
            }
            case 'outgoing':
                return 'Outgoing voice call';
            case 'incoming':
                return 'Incoming voice call';
            default:
                return 'Voice call';
        }
    }

    const isMissed = $derived(message.callEventType === 'missed');
    const iconColor = $derived(isMissed ? 'text-red-500' : 'text-green-500');
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
                {#if isMissed}
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
                {getMessageText()}
            </span>
        </div>
        <span class="text-xs text-gray-400 mt-1">
            {new Date(message.sentAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
    </div>
</div>
