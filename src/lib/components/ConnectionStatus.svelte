<script lang="ts">
    import { connectionStats, showRelayStatusModal } from '$lib/stores/connection';
    import { t } from '$lib/i18n';
    import { isAndroidNative } from '$lib/core/NativeDialogs';
    import Button from '$lib/components/ui/Button.svelte';

    const isAndroidApp = isAndroidNative();
</script>

<div class={`absolute bottom-0 left-0 right-0 z-20 p-2 border-t border-gray-200/50 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex ${
    isAndroidApp ? 'justify-end' : 'justify-center'
}`}>
    <Button 
        onclick={() => showRelayStatusModal.set(true)}
        size="sm"
        class={`gap-2 ${isAndroidApp ? 'mr-2' : ''}`}
    >
        <div
            class={`w-2 h-2 rounded-full ${
                $connectionStats.connected === 0 || $connectionStats.authFailedConnected > 0
                    ? 'bg-red-500'
                    : $connectionStats.authPendingConnected > 0
                      ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'
                      : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
            }`}
        ></div>
        <span class="typ-meta">
            {$t('connection.relaysLabel')} {$connectionStats.connected}/{$connectionStats.total}
        </span>
    </Button>
</div>
