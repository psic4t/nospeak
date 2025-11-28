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
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window 
    ononline={() => isOnline.set(true)} 
    onoffline={() => isOnline.set(false)} 
/>

{#if isInitialized}
    <div class="h-screen bg-gray-100 dark:bg-gray-900 flex justify-center overflow-hidden">
        <div class="w-full max-w-full lg:max-w-7xl xl:max-w-6xl h-full">
            {@render children()}
        </div>
    </div>
{/if}
