<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
    import { isOnline } from '$lib/stores/connection';
    import { authService } from '$lib/core/AuthService';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

	let { children } = $props();
    let isInitialized = $state(false);

    onMount(async () => {
        const restored = await authService.restore();
        isInitialized = true;
        
        // If restored and on login page, go to chat
        if (restored && location.pathname === '/') {
            goto('/chat');
        }
        
        // Also fetch history on page load if authenticated and not on login page
        if (restored && location.pathname !== '/') {
            const { messagingService } = await import('$lib/core/Messaging');
            messagingService.fetchHistory().catch(console.error);
            
            // Refresh all contact profiles and relay information on page reload
            const { contactRepo } = await import('$lib/db/ContactRepository');
            const { discoverUserRelays } = await import('$lib/core/connection/Discovery');
            const { profileResolver } = await import('$lib/core/ProfileResolver');
            
            const contacts = await contactRepo.getContacts();
            console.log(`Refreshing profiles for ${contacts.length} contacts on page load`);
            
            // Refresh profiles for all contacts in parallel with some concurrency control
            const BATCH_SIZE = 5;
            for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
                const batch = contacts.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (contact) => {
                    try {
                        console.log(`Refreshing profile for ${contact.npub}`);
                        await discoverUserRelays(contact.npub);
                        await profileResolver.resolveProfile(contact.npub, true); // force refresh
                    } catch (error) {
                        console.error(`Failed to refresh profile for ${contact.npub}:`, error);
                    }
                }));
                
                // Small delay between batches to avoid overwhelming relays
                if (i + BATCH_SIZE < contacts.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
    <title>nospeak</title>
</svelte:head>

<svelte:window 
    ononline={() => isOnline.set(true)} 
    onoffline={() => isOnline.set(false)} 
/>

{#if isInitialized}
    <div class="h-screen bg-gray-100 dark:bg-gray-900 flex justify-center overflow-hidden">
        <div class="w-full max-w-full lg:max-w-7xl xl:max-w-6xl h-full relative">
            <div class="absolute top-3 right-4 font-bold z-50 pointer-events-none" style="color: #e1aa5d;">nospeak</div>
            {@render children()}
        </div>
    </div>
{/if}
