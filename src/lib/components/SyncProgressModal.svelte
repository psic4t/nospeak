<script lang="ts">
    import { syncState } from '$lib/stores/sync';

    let { progress = 0 } = $props<{ progress: number }>();
</script>
 
<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 mx-4 max-w-sm w-full shadow-xl">
        <div class="flex flex-col items-center gap-4 w-full">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div class="text-center">
                <div class="text-lg font-medium dark:text-white">Syncing messages...</div>
                <div class="text-gray-500 dark:text-gray-400 mt-1">({progress} fetched)</div>
            </div>
            <div class="mt-4 w-full">
                <ul class="text-sm text-left space-y-1">
                    {#each $syncState.steps as step}
                        <li class="flex items-center gap-2">
                            <span
                                class={`w-2 h-2 rounded-full ${
                                    step.status === 'completed'
                                        ? 'bg-green-500'
                                        : step.status === 'active'
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                            ></span>
                            <span class={`flex-1 ${step.status === 'active' ? 'font-semibold' : ''}`}>
                                {step.label}
                            </span>
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
</div>

