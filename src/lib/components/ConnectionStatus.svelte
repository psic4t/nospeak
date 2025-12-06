<script lang="ts">
    import { connectionStats, showRelayStatusModal } from '$lib/stores/connection';
</script>

<div class="p-2 border-t border-gray-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md">
    <button 
        onclick={() => showRelayStatusModal.set(true)}
        class="w-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 flex items-center justify-center gap-2 p-2.5 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all font-medium"
    >
        <div class={`w-2 h-2 rounded-full ${$connectionStats.connected > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
        Relays: {$connectionStats.connected}/{$connectionStats.total}
    </button>
</div>
