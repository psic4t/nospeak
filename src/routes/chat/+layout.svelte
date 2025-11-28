<script lang="ts">
    import { messagingService } from '$lib/core/Messaging';
    import { signer } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import ContactList from '$lib/components/ContactList.svelte';
    import { messageRepo } from '$lib/db/MessageRepository';

    let { children } = $props();

    onMount(() => {
        const s = $signer;
        if (!s) {
            // Wait for restore to potentially happen if layout mounts before auth?
            // Actually authService.restore runs in root layout.
            // If we are here, we should be authenticated or redirect.
            // But if user manually navigates to /chat without auth?
            // The root layout redirect handles / -> /chat.
            // If user goes to /chat directly, restore happens, then this mounts.
            // But s might be null initially.
            
            // We need to wait for auth state to settle? 
            // Or rely on the fact that if we are here, auth is done?
            // Root layout: `if (restored && location.pathname === '/') goto('/chat')`
            // If start at /chat: restore happens, isInitialized=true, then children render.
            // So s should be set.
            
            // Double check:
            if (!s) {
                 goto('/');
                 return;
            }
        }

        let unsub: () => void;

        const setup = async () => {
            const pubkey = await s.getPublicKey();
            unsub = messagingService.listenForMessages(pubkey);
            
            // Auto-navigate to last message recipient if on chat root
            if (page.url.pathname === '/chat') {
                const lastRecipient = await messageRepo.getLastMessageRecipient();
                if (lastRecipient) {
                    goto(`/chat/${lastRecipient}`);
                }
            }
            
            // Backfill history
            setTimeout(() => {
                messagingService.fetchHistory().catch(console.error);
            }, 2000);
        };

        setup();

        return () => {
            if (unsub) unsub();
        };
    });
</script>

<div class="flex h-screen overflow-hidden">
    <div class="w-80 flex-shrink-0 hidden md:block border-r border-gray-200 dark:border-gray-700">
        <ContactList />
    </div>
    <div class="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        {@render children()}
    </div>
</div>
