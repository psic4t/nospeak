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
    <div class="p-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl border border-white/20 dark:border-white/10">
        <img src="/nospeak.svg" alt="nospeak logo" class="mx-auto mb-4 h-20 app-logo drop-shadow-sm" />
        <h1 class="text-3xl font-bold mb-8 text-center dark:text-white tracking-tight">nospeak</h1>
        
        {#if error}
            <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-4 rounded-xl mb-6 text-sm border border-red-100 dark:border-red-800">
                {error}
            </div>
        {/if}

        <div class="space-y-4">
            <button 
                onclick={loginAmber}
                disabled={isLoading}
                class="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white font-medium p-3 rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Login with Amber
            </button>

            {#if hasExtension}
                <button 
                    onclick={loginExtension}
                    disabled={isLoading}
                    class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium p-3 rounded-xl hover:shadow-lg hover:shadow-purple-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Login with Extension
                </button>
            {/if}
        </div>

        <div class="relative my-8">
            <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-200/50 dark:border-gray-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
                <span class="px-4 bg-transparent text-gray-500 dark:text-gray-400 bg-white/0 backdrop-blur-sm rounded-full">OR</span>
            </div>
        </div>

        <div class="mb-2">
            <label 
                for="nsec-input" 
                class="block text-sm font-medium mb-2 dark:text-gray-300 ml-1"
            >
                Login with nsec
            </label>
            <input 
                id="nsec-input"
                type="password" 
                bind:value={nsec} 
                class="w-full px-4 py-3 border border-gray-200/50 dark:border-white/10 rounded-xl bg-white/50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400" 
                placeholder="nsec1..." 
            />
            <button 
                onclick={loginNsec} 
                disabled={isLoading}
                class="w-full mt-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium p-3 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
