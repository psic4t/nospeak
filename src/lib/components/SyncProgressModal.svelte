<script lang="ts">
    import { syncState, setBackgroundMode, completeLoginSyncFlow } from '$lib/stores/sync';
    import { isAndroidNative } from "$lib/core/NativeDialogs";
    import { t } from '$lib/i18n';
    import CircularProgress from '$lib/components/ui/CircularProgress.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { authService } from '$lib/core/AuthService';

    let { progress = 0 } = $props<{ progress: number }>();
    const isAndroidApp = isAndroidNative();
    let manualRelayUrl = $state('');
    let isConnecting = $state(false);
    let connectError = $state('');

    function handleRetry() {
        authService.retrySyncFlow();
    }

    function handleSkip() {
        authService.skipSyncAndContinue();
    }

    function handleContinueInBackground() {
        setBackgroundMode();
        completeLoginSyncFlow();
    }

    async function handleManualRelay() {
        if (!manualRelayUrl.trim()) return;

        let url = manualRelayUrl.trim();
        // Normalize: auto-prepend wss:// if no scheme
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
            url = 'wss://' + url;
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            connectError = $t('sync.manualRelay.invalidUrl') as string;
            return;
        }

        isConnecting = true;
        connectError = '';

        try {
            await authService.retrySyncWithManualRelay(url);
            manualRelayUrl = '';
        } catch (e) {
            connectError = e instanceof Error ? e.message : String(e);
        } finally {
            isConnecting = false;
        }
    }

    // Map step IDs to translation keys for error display
    const stepIdToLabelKey: Record<string, string> = {
        'connect-discovery-relays': 'sync.steps.connectDiscoveryRelays',
        'fetch-messaging-relays': 'sync.steps.fetchMessagingRelays',
        'connect-read-relays': 'sync.steps.connectReadRelays',
        'fetch-history': 'sync.steps.fetchHistory',
        'fetch-user-profile': 'sync.steps.fetchUserProfile'
    };
</script>
 
<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" class:android-safe-area-top={isAndroidApp}>
    <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/20 dark:border-white/10 outline-none">
        {#if $syncState.hasError}
            <!-- Error State -->
            <div class="flex flex-col items-center gap-6 w-full">
                <!-- Error Icon -->
                <div class="w-16 h-16 rounded-full bg-[rgb(var(--color-red-rgb)/0.15)] flex items-center justify-center">
                    <svg class="w-8 h-8 text-[rgb(var(--color-red-rgb))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                
                <div class="text-center">
                    <div class="typ-title dark:text-white mb-2">{$t('sync.errorTitle')}</div>
                    <div class="typ-body text-gray-600 dark:text-slate-400">{$syncState.errorMessage || $t('sync.timeoutError')}</div>
                </div>

                <!-- Relay Errors List -->
                {#if $syncState.relayErrors.length > 0}
                    <div class="w-full bg-gray-100 dark:bg-slate-800/50 rounded-2xl p-4 max-h-40 overflow-y-auto">
                        <div class="typ-label text-gray-500 dark:text-slate-400 mb-2">{$t('sync.relayErrorsTitle')}</div>
                        <ul class="typ-meta space-y-2">
                            {#each $syncState.relayErrors as error}
                                <li class="text-gray-600 dark:text-slate-300">
                                    <span class="font-mono text-xs break-all">{error.url}</span>
                                    <div class="text-gray-500 dark:text-slate-400 text-xs">
                                        {$t(stepIdToLabelKey[error.step] || error.step)} - {error.error}
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                <!-- Manual Relay Input -->
                <div class="w-full space-y-2">
                    <div class="typ-label text-gray-500 dark:text-slate-400">
                        {$t('sync.manualRelay.label')}
                    </div>
                    <div class="flex gap-2">
                        <input
                            type="text"
                            bind:value={manualRelayUrl}
                            placeholder={$t('sync.manualRelay.placeholder')}
                            class="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            onkeydown={(e) => { if (e.key === 'Enter') handleManualRelay(); }}
                            disabled={isConnecting}
                        />
                        <Button
                            variant="filled-tonal"
                            onclick={handleManualRelay}
                            disabled={isConnecting || !manualRelayUrl.trim()}
                        >
                            {#if isConnecting}
                                {$t('sync.manualRelay.connecting')}
                            {:else}
                                {$t('sync.manualRelay.connectButton')}
                            {/if}
                        </Button>
                    </div>
                    {#if connectError}
                        <div class="typ-meta text-red-500 dark:text-red-400">{connectError}</div>
                    {/if}
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 w-full">
                    <Button variant="filled-tonal" class="flex-1" onclick={handleRetry}>
                        {$t('sync.retryButton')}
                    </Button>
                    <Button variant="ghost" class="flex-1" onclick={handleSkip}>
                        {$t('sync.skipButton')}
                    </Button>
                </div>
            </div>
        {:else}
            <!-- Normal Progress State -->
            <div class="flex flex-col items-center gap-6 w-full">
                <div class="relative">
                    <CircularProgress size={64} />
                </div>
                
                <div class="text-center">
                    <div class="typ-title dark:text-white mb-2">{$t('sync.title')}</div>
                    <div class="typ-meta text-gray-500 dark:text-slate-400">({$t('sync.fetched', { values: { count: progress } })})</div>
                </div>

                <div class="w-full bg-gray-100 dark:bg-slate-800/50 rounded-2xl p-4">
                    <ul class="typ-body space-y-3">
                        {#each $syncState.steps as step}
                            <li class="flex items-center gap-3">
                                <span class={`flex-1 transition-colors duration-300 ${
                                    step.status === 'active' 
                                        ? 'font-bold text-gray-900 dark:text-white' 
                                        : step.status === 'completed'
                                            ? 'text-gray-700 dark:text-slate-300'
                                            : 'text-gray-400 dark:text-slate-600'
                                }`}>
                                    {$t(step.labelKey)}
                                </span>

                                {#if step.status === 'completed'}
                                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                {/if}
                            </li>
                        {/each}
                    </ul>
                </div>

                <!-- Continue in Background Button (visible after 2 minutes) -->
                {#if $syncState.canDismiss}
                    <Button variant="ghost" class="w-full" onclick={handleContinueInBackground}>
                        {$t('sync.continueInBackground')}
                    </Button>
                {/if}
            </div>
        {/if}
    </div>
</div>
