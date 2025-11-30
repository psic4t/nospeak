<script lang="ts">
    import { relayHealths } from '$lib/stores/connection';
    import { ConnectionType } from '$lib/core/connection/ConnectionManager';

    let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();

    function formatTime(timestamp: number) {
        if (timestamp === 0) return 'Never';
        return new Date(timestamp).toLocaleTimeString();
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 w-full h-full rounded-none md:w-[600px] md:h-auto md:max-h-[80vh] md:rounded-lg flex flex-col shadow-xl">
            <div class="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
                <h2 class="text-xl font-bold dark:text-white">Relay Connections</h2>
                <button onclick={close} class="hidden md:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    ✕
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto space-y-2 mb-4">
                {#if $relayHealths.length === 0}
                    <div class="text-gray-500 text-center py-4">No relays configured</div>
                {/if}
                {#each $relayHealths as health}
                    <div class="p-3 border rounded dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-medium dark:text-gray-200 truncate flex-1 mr-2">{health.url}</span>
                            <span class={`text-xs px-2 py-0.5 rounded-full ${health.isConnected ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                {health.isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                            <div>Type: {health.type === ConnectionType.Persistent ? 'Persistent' : 'Temporary'}</div>
                            <div>Last Connected: {formatTime(health.lastConnected)}</div>
                            <div>Success: {health.successCount}</div>
                            <div>Failures: {health.failureCount}</div>
                        </div>
                    </div>
                {/each}
            </div>

            <button 
                onclick={close}
                class="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
                Close
            </button>
        </div>
    </div>
{/if}
