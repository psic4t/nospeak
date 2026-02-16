<script lang="ts">
     import { relayHealths } from '$lib/stores/connection';
      import { ConnectionType, type RelayAuthStatus } from '$lib/core/connection/ConnectionManager';
      import { isAndroidNative, isMobileWeb } from "$lib/core/NativeDialogs";
      import { blur } from "$lib/utils/platform";
      import { hapticSelection } from '$lib/utils/haptics';
      import { fade } from 'svelte/transition';
      import { glassModal } from '$lib/utils/transitions';
      import { t } from '$lib/i18n';
      import { get } from 'svelte/store';
      import Button from '$lib/components/ui/Button.svelte';
      import BottomSheetHandle from '$lib/components/ui/BottomSheetHandle.svelte';
      import { bottomSheet } from '$lib/actions/bottomSheet';
 
       let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();
      const isAndroidApp = isAndroidNative();
      const isMobile = isAndroidApp || isMobileWeb();

      let overlayElement: HTMLDivElement | undefined = $state();

      function formatTime(timestamp: number) {
          if (timestamp === 0) return get(t)('modals.relayStatus.never') as string;
          return new Date(timestamp).toLocaleTimeString();
      }

      function formatAuthStatus(status: RelayAuthStatus) {
          if (status === 'not_required') return get(t)('modals.relayStatus.authNotRequired') as string;
          if (status === 'required') return get(t)('modals.relayStatus.authRequired') as string;
          if (status === 'authenticating') return get(t)('modals.relayStatus.authAuthenticating') as string;
          if (status === 'authenticated') return get(t)('modals.relayStatus.authAuthenticated') as string;
          return get(t)('modals.relayStatus.authFailed') as string;
      }




</script>

{#if isOpen}
    <div
        bind:this={overlayElement}
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class={`fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 ${blur('sm')} z-50 flex justify-center ${
            isMobile ? "items-end" : "items-center p-4"
        }`}
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if(e.target === e.currentTarget) { hapticSelection(); close(); } }}
        onkeydown={(e) => { if(e.key === 'Escape') { hapticSelection(); close(); } }}
    >
        <div
             use:bottomSheet={{ enabled: isMobile, onClose: () => { hapticSelection(); close(); }, overlay: overlayElement }}
             in:glassModal={{ duration: 200, scaleFrom: 0.92 }}
             out:glassModal={{ duration: 150, scaleFrom: 0.92 }}
             class={`bg-white/95 dark:bg-slate-900/80 ${blur('xl')} shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden relative outline-none ${
                 isMobile
                     ? "w-full rounded-t-3xl rounded-b-none max-h-[90vh] p-6"
                     : "w-full max-w-lg max-h-[80vh] rounded-3xl p-8"
             }`}
             class:android-safe-area-bottom={isAndroidApp}
        >
            {#if isMobile}
              <BottomSheetHandle />
            {/if}

            {#if !isMobile}
                <Button
                    onclick={close}
                    aria-label="Close modal"
                    size="icon"
                    class="absolute top-4 right-4 z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </Button>
            {/if}
            
            <div class={isAndroidApp ? "flex flex-col mb-6 mt-8 w-full max-w-2xl mx-auto" : "flex justify-between items-center mb-6 px-1"}>
                <h2 class="typ-title dark:text-white">{$t('modals.relayStatus.title')}</h2>
            </div>
            
            <div class={`flex-1 overflow-y-auto mb-6 custom-scrollbar native-scroll ${isAndroidApp ? 'px-0' : 'pr-1'}`}>
                <div class={`space-y-3 ${isAndroidApp ? 'max-w-2xl mx-auto w-full' : ''}`}>
                {#if $relayHealths.length === 0}
                    <div class="text-gray-500 text-center py-8 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                        {$t('modals.relayStatus.noRelays')}
                    </div>
                {/if}
                {#each $relayHealths as health}
                    <div class="p-4 border border-gray-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800/40 shadow-sm hover:shadow transition-all">
                        <div class="flex justify-between items-center mb-3">
                            <span class="typ-body font-medium dark:text-slate-200 truncate flex-1 mr-3">{health.url}</span>
                            <span class={`typ-meta px-2.5 py-1 rounded-full ${health.isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                {health.isConnected ? $t('modals.relayStatus.connected') : $t('modals.relayStatus.disconnected')}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-gray-500 dark:text-slate-400">
                            <div class="flex justify-between typ-meta">
                                <span>{$t('modals.relayStatus.typeLabel')}</span>
                                <span class="typ-meta text-gray-700 dark:text-slate-300">{health.type === ConnectionType.Persistent ? $t('modals.relayStatus.typePersistent') : $t('modals.relayStatus.typeTemporary')}</span>
                            </div>
                            <div class="flex justify-between typ-meta">
                                <span>{$t('modals.relayStatus.lastConnectedLabel')}</span>
                                <span class="typ-meta text-gray-700 dark:text-slate-300">{formatTime(health.lastConnected)}</span>
                            </div>
                            <div class="flex justify-between typ-meta">
                                <span>{$t('modals.relayStatus.successLabel')}</span>
                                <span class="typ-meta text-green-600 dark:text-green-400">{health.successCount}</span>
                            </div>
                            <div class="flex justify-between typ-meta">
                                <span>{$t('modals.relayStatus.failureLabel')}</span>
                                <span class="typ-meta text-red-600 dark:text-red-400">{health.failureCount}</span>
                            </div>
                            <div class="flex justify-between typ-meta">
                                <span>{$t('modals.relayStatus.authLabel')}</span>
                                <span class="typ-meta text-gray-700 dark:text-slate-300">{formatAuthStatus(health.authStatus)}</span>
                            </div>
                            {#if health.lastAuthError}
                                <div class="col-span-2 flex justify-between typ-meta">
                                    <span>{$t('modals.relayStatus.authErrorLabel')}</span>
                                    <span class="typ-meta text-red-600 dark:text-red-400 truncate ml-4">{health.lastAuthError}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
                </div>
            </div>
        </div>
    </div>
{/if}
