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
    <div 
        class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if(e.target === e.currentTarget) close(); }}
        onkeydown={(e) => { if(e.key === 'Escape') close(); }}
    >
        <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 w-full h-full rounded-none md:w-[600px] md:h-auto md:max-h-[80vh] md:rounded-3xl flex flex-col shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden outline-none">
            <div class="flex justify-between items-center mb-6 px-1">
                <h2 class="text-xl font-bold dark:text-white">Relay Connections</h2>
                <button 
                    onclick={close} 
                    aria-label="Close modal"
                    class="hidden md:block text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto space-y-3 mb-6 custom-scrollbar pr-1">
                {#if $relayHealths.length === 0}
                    <div class="text-gray-500 text-center py-8 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        No relays configured
                    </div>
                {/if}
                {#each $relayHealths as health}
                    <div class="p-4 border border-gray-100 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-800/40 shadow-sm hover:shadow transition-all">
                        <div class="flex justify-between items-center mb-3">
                            <span class="font-medium dark:text-slate-200 truncate flex-1 mr-3 text-sm">{health.url}</span>
                            <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${health.isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                {health.isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-gray-500 dark:text-slate-400">
                            <div class="flex justify-between">
                                <span>Type:</span>
                                <span class="font-medium text-gray-700 dark:text-slate-300">{health.type === ConnectionType.Persistent ? 'Persistent' : 'Temporary'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Last Connected:</span>
                                <span class="font-medium text-gray-700 dark:text-slate-300">{formatTime(health.lastConnected)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Success:</span>
                                <span class="font-medium text-green-600 dark:text-green-400">{health.successCount}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Failures:</span>
                                <span class="font-medium text-red-600 dark:text-red-400">{health.failureCount}</span>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <button 
                onclick={close}
                class="w-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 font-medium transition-colors"
            >
                Close
            </button>
        </div>
    </div>
{/if}
