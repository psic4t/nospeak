<script lang="ts">
    import { connectionManager } from '$lib/core/connection/instance';
    import { relayHealths } from '$lib/stores/connection';
    
    let newRelay = $state('');

    function add() {
        if (newRelay) {
            connectionManager.addPersistentRelay(newRelay);
            newRelay = '';
        }
    }
</script>

<div class="p-6 h-full bg-gray-100 dark:bg-gray-900 overflow-y-auto">
    <h1 class="text-2xl font-bold mb-4 dark:text-white">Settings</h1>
    
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h2 class="text-xl font-semibold mb-2 dark:text-white">Relays</h2>
        
        <div class="flex gap-2 mb-4">
            <input 
                bind:value={newRelay} 
                class="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="wss://..."
            />
            <button onclick={add} class="bg-blue-500 text-white px-4 py-2 rounded">Add</button>
        </div>

        <div class="space-y-2">
            {#each $relayHealths as health}
                <div class="flex justify-between items-center p-2 border rounded dark:border-gray-700">
                    <span class="dark:text-gray-200">{health.url}</span>
                    <div class="flex items-center gap-2">
                        <span class={`text-sm ${health.isConnected ? 'text-green-500' : 'text-red-500'}`}>
                            {health.isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                        <button 
                            onclick={() => connectionManager.removeRelay(health.url)}
                            class="text-red-500 hover:underline text-sm"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
