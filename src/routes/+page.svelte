<script lang="ts">
    import { authService } from '$lib/core/AuthService';
    import { onMount } from 'svelte';
    import KeypairLoginModal from '$lib/components/KeypairLoginModal.svelte';
    import { t } from '$lib/i18n';
    import { isAndroidCapacitorShell } from '$lib/utils/platform';

    let nsec = $state('');
    let error = $state('');
    let isLoading = $state(false);
    let hasExtension = $state(false);
    let showKeypairModal = $state(false);
    let isAndroidShell = $state(isAndroidCapacitorShell());

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

        // Detect Android Capacitor shell for Amber login availability
        isAndroidShell = isAndroidCapacitorShell();
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
            await authService.loginWithAmber();
        } catch (e) {
            error = (e as Error).message;
        } finally {
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

    async function loginWithGeneratedKeypair(generatedNsec: string): Promise<void> {
        try {
            isLoading = true;
            await authService.login(generatedNsec);
        } catch (e) {
            error = (e as Error).message;
            isLoading = false;
        }
    }
</script>

<div class="flex flex-col items-center justify-center h-full p-4">
    <div class="p-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl border border-white/20 dark:border-white/10">
        <img src="/nospeak.svg" alt="nospeak logo" class="mx-auto mb-4 h-20 app-logo drop-shadow-sm" />
        <h1 class="typ-title mb-8 text-center dark:text-white">nospeak</h1>
        
        {#if error}
            <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-4 rounded-xl mb-6 text-sm border border-red-100 dark:border-red-800">
                {error}
            </div>
        {/if}

        <div class="space-y-4">
            {#if isAndroidShell}
                <button 
                    onclick={loginAmber}
                    disabled={isLoading}
                    class="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white font-medium p-3 rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {$t('auth.loginWithAmber')}
                </button>
            {/if}

            {#if hasExtension}
                <button 
                    onclick={loginExtension}
                    disabled={isLoading}
                    class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium p-3 rounded-xl hover:shadow-lg hover:shadow-purple-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {$t('auth.loginWithExtension')}
                </button>
            {/if}
        </div>

        <div class="relative my-8">
            <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-200/50 dark:border-gray-700"></div>
            </div>
            <div class="relative flex justify-center">
                <span class="typ-meta px-4 bg-transparent text-gray-500 dark:text-gray-400 bg-white/0 backdrop-blur-sm rounded-full">{$t('auth.orSeparator')}</span>
            </div>
        </div>

        <div class="mb-2">
            <label 
                for="nsec-input" 
                class="block typ-body mb-2 dark:text-gray-300 ms-1"
            >
                {$t('auth.loginWithNsecLabel')}
            </label>
            <input 
                id="nsec-input"
                type="password" 
                bind:value={nsec} 
                class="w-full px-4 py-3 border border-gray-200/50 dark:border-white/10 rounded-xl bg-white/50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400" 
                placeholder={$t('auth.nsecPlaceholder')}
            />
            <button 
                onclick={loginNsec} 
                disabled={isLoading}
                class="w-full mt-4 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-700 text-white font-medium p-3 rounded-xl hover:shadow-lg hover:shadow-cyan-400/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? $t('auth.connecting') : $t('auth.loginButton')}
            </button>
            <button 
                type="button"
                onclick={() => (showKeypairModal = true)}
                class="w-full mt-2 typ-body text-gray-800 hover:text-gray-900 dark:text-slate-100 dark:hover:text-slate-50 text-center underline decoration-dotted"
            >
                {$t('auth.generateKeypairLink')}
            </button>
        </div>
    </div>

    {#if !isAndroidShell}
        <a
            href="https://github.com/psic4t/nospeak/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-4 inline-flex items-center gap-2 typ-meta text-gray-700 hover:text-gray-900 dark:text-slate-200 dark:hover:text-slate-50 underline decoration-dotted"
        >
            <svg
                class="w-4 h-4"
                viewBox="0 0 57.001 57.001"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M35.361,5.677l2.497-4.162c0.284-0.474,0.131-1.088-0.343-1.372c-0.475-0.285-1.088-0.132-1.372,0.343l-2.635,4.392
                    c-1.569-0.558-3.249-0.878-5.007-0.878s-3.438,0.32-5.007,0.878l-2.635-4.392c-0.284-0.475-0.898-0.627-1.372-0.343
                    s-0.627,0.898-0.343,1.372l2.497,4.162c-4.827,2.495-8.14,7.525-8.14,13.324c0,0.553,0.448,1,1,1h28c0.552,0,1-0.447,1-1
                    C43.5,13.203,40.188,8.173,35.361,5.677z M15.539,18.001c0.512-6.703,6.13-12,12.962-12s12.45,5.297,12.962,12H15.539z" />
                <path d="M35.478,11.364H34.16c-0.364,0-0.659,0.295-0.659,0.659v1.318c0,0.364,0.295,0.659,0.659,0.659h1.319
                    c0.364,0,0.659-0.295,0.659-0.659v-1.318C36.138,11.659,35.842,11.364,35.478,11.364z" />
                <path d="M22.841,11.364h-1.319c-0.364,0-0.659,0.295-0.659,0.659v1.318c0,0.364,0.295,0.659,0.659,0.659h1.319
                    c0.364,0,0.659-0.295,0.659-0.659v-1.318C23.5,11.659,23.205,11.364,22.841,11.364z" />
                <path d="M42.5,21.001h-28c-0.552,0-1,0.447-1,1v20.171c0,2.663,2.169,4.829,4.834,4.829H19.5v6.006c0,2.202,1.794,3.994,4,3.994
                    s4-1.792,4-3.994v-6.006h2v6.006c0,2.202,1.794,3.994,4,3.994s4-1.792,4-3.994v-6.006h1.166c2.666,0,4.834-2.166,4.834-4.829
                    V22.001C43.5,21.448,43.053,21.001,42.5,21.001z M41.5,42.172c0,1.56-1.271,2.829-2.834,2.829H36.5c-0.552,0-1,0.447-1,1v7.006
                    c0,1.1-0.897,1.994-2,1.994s-2-0.895-2-1.994v-7.006c0-0.553-0.448-1-1-1h-4c-0.552,0-1,0.447-1,1v7.006
                    c0,1.1-0.897,1.994-2,1.994s-2-0.895-2-1.994v-7.006c0-0.553-0.448-1-1-1h-2.165c-1.563,0-2.835-1.27-2.835-2.829V23.001h26
                    V42.172z" />
                <path d="M48,21.001c-1.93,0-3.5,1.572-3.5,3.504v13.992c0,1.932,1.57,3.504,3.5,3.504s3.5-1.572,3.5-3.504V24.505
                    C51.5,22.573,49.93,21.001,48,21.001z M49.5,38.497c0,0.829-0.673,1.504-1.5,1.504s-1.5-0.675-1.5-1.504V24.505
                    c0-0.829,0.673-1.504,1.5-1.504s1.5,0.675,1.5,1.504V38.497z" />
                <path d="M9,21.001c-1.93,0-3.5,1.572-3.5,3.504v13.992c0,1.932,1.57,3.504,3.5,3.504s3.5-1.572,3.5-3.504V24.505
                    C12.5,22.573,10.93,21.001,9,21.001z M10.5,38.497c0,0.829-0.673,1.504-1.5,1.504s-1.5-0.675-1.5-1.504V24.505
                    c0-0.829,0.673-1.504,1.5-1.504s1.5,0.675,1.5,1.504V38.497z" />
            </svg>
            {$t('auth.downloadAndroidApp')}
        </a>
    {/if}
</div>

{#if showKeypairModal}
    <KeypairLoginModal
        isOpen={showKeypairModal}
        close={() => (showKeypairModal = false)}
        onUseKeypair={async (generatedNsec) => {
            showKeypairModal = false;
            await loginWithGeneratedKeypair(generatedNsec);
        }}
    />
{/if}
