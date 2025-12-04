<script lang="ts">
    import { authService } from '$lib/core/AuthService';
    import { onMount } from 'svelte';
    import AmberLoginModal from '$lib/components/AmberLoginModal.svelte';

    let nsec = $state('');
    let error = $state('');
    let isLoading = $state(false);
    let hasExtension = $state(false);
    let amberUri = $state('');

    onMount(() => {
        // Check for extension
        const check = () => {
            if (window.nostr) {
                hasExtension = true;
            }
        };
        check();
        // Retry shortly after just in case injection is slow
        setTimeout(check, 500);
    });

    async function loginNsec() {
        try {
            isLoading = true;
            await authService.login(nsec);
        } catch (e) {
            error = (e as Error).message;
        } finally {
            isLoading = false;
        }
    }

    async function loginAmber() {
        try {
            isLoading = true;
            amberUri = await authService.loginWithAmber();
        } catch (e) {
            error = (e as Error).message;
            isLoading = false;
        }
    }

    async function loginExtension() {
        try {
            isLoading = true;
            await authService.loginWithExtension();
        } catch (e) {
            error = (e as Error).message;
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="flex flex-col items-center justify-center h-full p-4">
    <div class="p-8 bg-white dark:bg-gray-800 w-full max-w-md">
        <img src="/nospeak.svg" alt="nospeak logo" class="mx-auto mb-2 h-16 app-logo" />
        <h1 class="text-2xl font-bold mb-4 text-center dark:text-white">nospeak</h1>
        
        {#if error}
            <div class="text-red-500 mb-4 text-sm">{error}</div>
        {/if}

        <div>
            <button 
                onclick={loginAmber}
                disabled={isLoading}
                class="w-full bg-orange-500 text-white p-2 rounded hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
                Login with Amber
            </button>
        </div>

        {#if hasExtension}
            <div class="text-center my-4 text-gray-500 dark:text-gray-400">OR</div>

            <div>
                <button 
                    onclick={loginExtension}
                    disabled={isLoading}
                    class="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                    Login with Extension
                </button>
            </div>
        {/if}

        <div class="text-center my-4 text-gray-500 dark:text-gray-400">OR</div>

        <div class="mb-4">
            <label 
                for="nsec-input" 
                class="block text-sm font-medium mb-1 dark:text-gray-300"
            >
                Login with nsec
            </label>
            <input 
                id="nsec-input"
                type="password" 
                bind:value={nsec} 
                class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                placeholder="nsec1..." 
            />
            <button 
                onclick={loginNsec} 
                disabled={isLoading}
                class="w-full mt-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
                {isLoading ? 'Connecting...' : 'Login'}
            </button>
        </div>
    </div>
</div>

{#if amberUri}
    <AmberLoginModal 
        uri={amberUri} 
        onClose={() => { amberUri = ''; isLoading = false; }} 
    />
{/if}
