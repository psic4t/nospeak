<script lang="ts">
     import { syncState } from '$lib/stores/sync';
     import { isAndroidNative } from "$lib/core/NativeDialogs";
 
     let { progress = 0 } = $props<{ progress: number }>();
     const isAndroidApp = isAndroidNative();

</script>
 
<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 {isAndroidApp ? 'pt-10' : ''}">
    <div class="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/20 dark:border-white/10 outline-none">
        <div class="flex flex-col items-center gap-6 w-full">
            <div class="relative">
                <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500"></div>
            </div>
            
            <div class="text-center">
                <div class="text-xl font-bold dark:text-white mb-2">Syncing messages...</div>
                <div class="text-gray-500 dark:text-slate-400 text-sm font-medium">({progress} fetched)</div>
            </div>

            <div class="w-full bg-gray-100 dark:bg-slate-800/50 rounded-2xl p-4">
                <ul class="text-sm space-y-3">
                    {#each $syncState.steps as step}
                        <li class="flex items-center gap-3">
                            <div class={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors duration-300 ${
                                step.status === 'completed'
                                    ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                    : step.status === 'active'
                                        ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] animate-pulse'
                                        : 'bg-gray-300 dark:bg-slate-700'
                            }`}></div>
                            <span class={`flex-1 transition-colors duration-300 ${
                                step.status === 'active' 
                                    ? 'font-bold text-gray-900 dark:text-white' 
                                    : step.status === 'completed'
                                        ? 'text-gray-700 dark:text-slate-300'
                                        : 'text-gray-400 dark:text-slate-600'
                            }`}>
                                {step.label}
                            </span>
                            {#if step.status === 'completed'}
                                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
</div>

