<script lang="ts">
    import ChatView from '$lib/components/ChatView.svelte';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { signer } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    import type { Message } from '$lib/db/db';
    import { messagingService } from '$lib/core/Messaging';
    import { liveQuery } from 'dexie';
    import { page } from '$app/state';
    import { db } from '$lib/db/db';
    import Dexie from 'dexie';
    
    let messages = $state<Message[]>([]);
    let currentPartner = $derived(page.params.npub);
    let previousPartner = '';
    
    let myPubkey = '';

    // Effect to update subscription when partner changes or component mounts
    $effect(() => {
        const s = $signer;
        if (!s || !currentPartner) return;
        
        // Prevent redundant setup if partner hasn't changed (though $effect triggers on dep change)
        // But setup is async, we want to make sure we clean up previous sub.
        
        let subDb: { unsubscribe: () => void };

        const setup = async () => {
            if (!myPubkey) myPubkey = await s.getPublicKey();
            
            // Fetch message history to ensure we have the latest messages
            messagingService.fetchHistory().catch(console.error);
            
            // Subscribe to DB changes for SPECIFIC partner
            subDb = liveQuery(() => {
                if (currentPartner === 'ALL') {
                    return db.messages.orderBy('sentAt').reverse().limit(50).toArray();
                } else {
                    return db.messages
                        .where('[recipientNpub+sentAt]')
                        .between(
                            [currentPartner, Dexie.minKey],
                            [currentPartner, Dexie.maxKey],
                            true, // include lower
                            false // exclude upper
                        )
                        .reverse()
                        .limit(50)
                        .toArray();
                }
            }).subscribe(msgs => {
                messages = msgs.reverse(); // Reverse to chronological order
            });
        };

        setup();

        return () => {
            if (subDb) subDb.unsubscribe();
        };
    });
</script>

<ChatView {messages} partnerNpub={currentPartner} />
