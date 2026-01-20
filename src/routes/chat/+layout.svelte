<script lang="ts">
    import { signer } from '$lib/stores/auth';
     import { onMount } from 'svelte';

    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import ChatList from '$lib/components/ChatList.svelte';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { fade } from 'svelte/transition';
    import { syncState } from '$lib/stores/sync';

    let { children } = $props();
    
    // Use regular object (not $state) to avoid triggering effect re-runs
    let previousSyncState = { isSyncing: false, isFirstSync: false };

    onMount(() => {
         const s = $signer;
         if (!s) {
             // Double check:
             if (!s) {
                  goto('/');
                  return;
             }
         }
 
         let setupStarted = false;
 
         const setup = async () => {
             setupStarted = true;
 
             // Auto-navigate to last message recipient if on chat root AND on desktop
             const isDesktop = window.innerWidth >= 768;
             if (page.url.pathname === '/chat' && isDesktop) {
                 const lastRecipient = await messageRepo.getLastMessageRecipient();
                 if (lastRecipient) {
                     goto(`/chat/${lastRecipient}`);
                 }
             }
         };
 
         const stopSyncSubscription = syncState.subscribe(state => {
             if (!setupStarted && !state.flowActive) {
                 setup();
             }
         });
 
         return () => {
             stopSyncSubscription();
         };
     });

    
    // Watch for sync completion to auto-navigate on desktop
    $effect(() => {
        // Read current sync state (this creates the dependency)
        const currentIsSyncing = $syncState.isSyncing;
        const currentIsFirstSync = $syncState.isFirstSync;
        
        // Check if first sync just ended (read previous state without tracking)
        const wasFirstSync = previousSyncState.isSyncing && previousSyncState.isFirstSync;
        const syncJustEnded = wasFirstSync && !currentIsSyncing;
        
        if (syncJustEnded) {
            // First sync just completed - auto-navigate to newest contact on desktop
            const isDesktop = window.innerWidth >= 768;
            if (isDesktop && page.url.pathname === '/chat') {
                messageRepo.getLastMessageRecipient().then(lastRecipient => {
                    if (lastRecipient) {
                        goto(`/chat/${lastRecipient}`);
                    }
                });
            }
        }
        
        // Update previous state (not reactive, won't trigger re-run)
        previousSyncState = { isSyncing: currentIsSyncing, isFirstSync: currentIsFirstSync };
    });
    
    let isChatOpen = $derived(page.url.pathname !== '/chat');
</script>

<div class="flex h-full overflow-hidden bg-transparent">
    <div class={`${isChatOpen ? 'hidden md:block' : 'block'} w-full md:w-80 flex-shrink-0 border-r border-gray-200/50 dark:border-gray-800/50`}>
        <ChatList />
    </div>
    {#key page.url.pathname}
        <div 
            in:fade={{ duration: 150 }}
            class={`${!isChatOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 h-full overflow-hidden`}
        >
            {@render children()}
        </div>
    {/key}
</div>
