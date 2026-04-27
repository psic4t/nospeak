<script lang="ts">
    import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';

    interface Props {
        open: boolean;
        onClose: (action: 'opened-settings' | 'skipped') => void;
    }
    let { open, onClose }: Props = $props();

    async function openSettings() {
        try {
            await AndroidVoiceCall.requestFullScreenIntentPermission();
        } catch (err) {
            console.warn('[VoiceCall] requestFullScreenIntentPermission failed', err);
        }
        onClose('opened-settings');
    }

    function skip() {
        onClose('skipped');
    }
</script>

{#if open}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
    >
        <div class="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-white/20 dark:border-white/10">
            <h2 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Allow lockscreen calls
            </h2>
            <p class="mb-5 text-sm text-gray-700 dark:text-slate-300">
                To make incoming calls ring through when your screen is locked,
                nospeak needs permission to display full-screen notifications.
                You can skip this — calls will still work, but incoming calls
                won't ring through if your phone is locked.
            </p>
            <div class="flex gap-2 justify-end">
                <button
                    type="button"
                    onclick={skip}
                    class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                    Skip
                </button>
                <button
                    type="button"
                    onclick={openSettings}
                    class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                    Open settings
                </button>
            </div>
        </div>
    </div>
{/if}
