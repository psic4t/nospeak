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
            
            // Fetch message history immediately to fill cache gaps
            messagingService.fetchHistory().catch(console.error);
        };

        setup();

        return () => {
            if (unsub) unsub();
        };
    });
    let isChatOpen = $derived(page.url.pathname !== '/chat');
</script>

<div class="flex h-full overflow-hidden bg-white dark:bg-gray-900">
    <div class={`${isChatOpen ? 'hidden md:block' : 'block'} w-full md:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700`}>
        <ContactList />
    </div>
    <div class={`${!isChatOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
        {@render children()}
    </div>
</div>
