<script lang="ts">
     import { relayHealths } from '$lib/stores/connection';
      import { ConnectionType, type RelayAuthStatus } from '$lib/core/connection/ConnectionManager';
      import { isAndroidNative } from "$lib/core/NativeDialogs";
      import { hapticSelection } from '$lib/utils/haptics';
      import { fade } from 'svelte/transition';
      import { glassModal } from '$lib/utils/transitions';
      import { t } from '$lib/i18n';
      import { get } from 'svelte/store';
      import Button from '$lib/components/ui/Button.svelte';
 
       let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();
      const isAndroidApp = isAndroidNative();

      const BOTTOM_SHEET_CLOSE_THRESHOLD = 100;
      const BOTTOM_SHEET_ACTIVATION_THRESHOLD = 6;
      let bottomSheetDragY = $state(0);
      let isBottomSheetDragging = $state(false);
      let bottomSheetDragStartY = 0;

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


      function handleBottomSheetPointerDown(e: PointerEvent) {
         if (!isAndroidApp) return;
         e.preventDefault();
         isBottomSheetDragging = false;
         bottomSheetDragStartY = e.clientY;
         bottomSheetDragY = 0;
         (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
     }

      function handleBottomSheetPointerMove(e: PointerEvent) {
         if (!isAndroidApp) return;
         const delta = e.clientY - bottomSheetDragStartY;
         if (!isBottomSheetDragging) {
             if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                 isBottomSheetDragging = true;
             } else {
                 return;
             }
         }
         bottomSheetDragY = delta > 0 ? delta : 0;
     }

      function handleBottomSheetPointerEnd(e: PointerEvent) {
         if (!isAndroidApp) return;
         try {
             (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
         } catch {
             // ignore if pointer capture was not set
         }
         if (!isBottomSheetDragging) {
             bottomSheetDragY = 0;
             return;
         }
         const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
         isBottomSheetDragging = false;
         bottomSheetDragY = 0;
         if (shouldClose) {
             hapticSelection();
             close();
         }
       }

       function handleBottomSheetTouchStart(e: TouchEvent) {
           if (!isAndroidApp) return;
           if (e.touches.length === 0) return;
           const touch = e.touches[0];
           isBottomSheetDragging = false;
           bottomSheetDragStartY = touch.clientY;
           bottomSheetDragY = 0;
       }

       function handleBottomSheetTouchMove(e: TouchEvent) {
           if (!isAndroidApp) return;
           if (e.touches.length === 0) return;
           const touch = e.touches[0];
           const delta = touch.clientY - bottomSheetDragStartY;
           if (!isBottomSheetDragging) {
               if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                   isBottomSheetDragging = true;
               } else {
                   return;
               }
           }
           bottomSheetDragY = delta > 0 ? delta : 0;
           e.preventDefault();
       }

       function handleBottomSheetTouchEnd(e: TouchEvent) {
           if (!isAndroidApp) return;
           if (!isBottomSheetDragging) {
               bottomSheetDragY = 0;
               return;
           }
           const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
            isBottomSheetDragging = false;
            bottomSheetDragY = 0;
            if (shouldClose) {
                hapticSelection();
                close();
            }
       }
</script>

{#if isOpen}
    <div 
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class={`fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm z-50 flex justify-center ${
            isAndroidApp ? "items-end" : "items-center p-4"
        }`}
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if(e.target === e.currentTarget) { hapticSelection(); close(); } }}
        onkeydown={(e) => { if(e.key === 'Escape') { hapticSelection(); close(); } }}
    >
        <div 
             in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }}
             out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
             class={`bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden relative outline-none transition-transform duration-150 ease-out ${
                 isAndroidApp
                     ? "w-full rounded-t-3xl rounded-b-none max-h-[90vh] p-6"
                     : "w-full max-w-lg max-h-[80vh] rounded-3xl p-8"
             }`}
             style:transform={isAndroidApp ? `translateY(${bottomSheetDragY}px)` : undefined}
        >
            {#if isAndroidApp}
              <div
                class="absolute top-0 left-1/2 -translate-x-1/2 h-12 w-32"
                onpointerdown={handleBottomSheetPointerDown}
                onpointermove={handleBottomSheetPointerMove}
                onpointerup={handleBottomSheetPointerEnd}
                onpointercancel={handleBottomSheetPointerEnd}
                ontouchstart={handleBottomSheetTouchStart}
                ontouchmove={handleBottomSheetTouchMove}
                ontouchend={handleBottomSheetTouchEnd}
                ontouchcancel={handleBottomSheetTouchEnd}
              >
                <div
                  class="mx-auto mt-2 w-10 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 touch-none"
                ></div>
              </div>
            {/if}

            {#if !isAndroidApp}
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
            
            <div class={`flex-1 overflow-y-auto mb-6 custom-scrollbar ${isAndroidApp ? 'px-0' : 'pr-1'}`}>
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
