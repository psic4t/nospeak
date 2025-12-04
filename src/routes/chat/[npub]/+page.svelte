<script lang="ts">
    import ChatView from '$lib/components/ChatView.svelte';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { signer } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    import type { Message } from '$lib/db/db';
    import { messagingService } from '$lib/core/Messaging';
    import { page } from '$app/state';
    import { contactRepo } from '$lib/db/ContactRepository';
    
    let messages = $state<Message[]>([]);
    let currentPartner = $derived(page.params.npub);
    let isFetchingHistory = $state(false);

    async function handleLoadMore() {
        if (currentPartner && messages.length > 0) {
            const oldest = messages[0];
            if (oldest) {
                isFetchingHistory = true;
                try {
                    await messagingService.fetchOlderMessages(Math.floor(oldest.sentAt / 1000));
                    // The liveQuery will automatically pick up newly saved messages
                    // since we query ALL messages for this partner (no limit)
                } catch (e) {
                    console.error('Failed to fetch older messages:', e);
                } finally {
                    isFetchingHistory = false;
                }
            }
        }
    }

    async function refreshMessagesForCurrentPartner() {
        const s = $signer;
        const partner = currentPartner;
        if (!s || !partner) return;

        const msgs = await messageRepo.getAllMessagesFor(partner);
        const filtered =
            partner === 'ALL'
                ? msgs
                : msgs.filter((m) => m.recipientNpub === partner);

        messages = filtered;

        if (partner && partner !== 'ALL') {
            contactRepo.markAsRead(partner).catch(console.error);
        }
    }

    // Effect to update messages when partner or signer changes
    $effect(() => {
        const s = $signer;
        const partner = currentPartner;
        if (!s || !partner) return;
        refreshMessagesForCurrentPartner();
    });

    onMount(() => {
        const handleNewMessage = (event: Event) => {
            const custom = event as CustomEvent<{ recipientNpub?: string }>;
            const partner = currentPartner;
            if (!partner) return;

            // For ALL, always refresh; otherwise only refresh when this conversation is affected
            if (partner === 'ALL' || !custom.detail || custom.detail.recipientNpub === partner) {
                refreshMessagesForCurrentPartner();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('nospeak:new-message', handleNewMessage);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('nospeak:new-message', handleNewMessage);
            }
        };
    });
</script>

<ChatView {messages} partnerNpub={currentPartner} onLoadMore={handleLoadMore} {isFetchingHistory} />
