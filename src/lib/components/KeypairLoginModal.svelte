<script lang="ts">
    import { authService } from '$lib/core/AuthService';
    import { t } from '$lib/i18n';

    let { isOpen = false, close = () => {}, onUseKeypair } = $props<{
        isOpen: boolean;
        close: () => void;
        onUseKeypair: (nsec: string) => void;
    }>();

    let npub = $state('');
    let nsec = $state('');

    function generateNewKeypair() {
        const pair = authService.generateKeypair();
        npub = pair.npub;
        nsec = pair.nsec;
    }

    $effect(() => {
        if (isOpen && !nsec) {
            generateNewKeypair();
        }
        if (!isOpen) {
            npub = '';
            nsec = '';
        }
    });

    function handleOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            close();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            close();
        }
    }

    function handleUseKeypair() {
        if (!nsec) {
            return;
        }
        onUseKeypair(nsec);
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keypair-modal-title"
        tabindex="-1"
    >
        <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20 dark:border-white/10 relative outline-none">
            <button
                type="button"
                onclick={close}
                aria-label="Close modal"
                class="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            <div class="mb-4">
                <h2 id="keypair-modal-title" class="typ-title dark:text-white">{$t('auth.keypair.title')}</h2>
            </div>

            <p class="typ-body text-gray-800 dark:text-slate-100 mb-4">
                {$t('auth.keypair.description')}
            </p>

            <div class="space-y-3 mb-4">
                <div>
                    <p class="block typ-meta text-gray-700 dark:text-slate-200 mb-1">
                        {$t('auth.keypair.npubLabel')}
                    </p>
                    <div class="text-xs font-mono break-all p-2 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border border-gray-200/60 dark:border-slate-700/60">
                        {npub}
                    </div>
                </div>
                <div>
                    <p class="block typ-meta text-gray-700 dark:text-slate-200 mb-1">
                        {$t('auth.keypair.nsecLabel')}
                    </p>
                    <div class="text-xs font-mono break-all p-2 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border border-gray-200/60 dark:border-slate-700/60">
                        {nsec}
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-between gap-3">
                <button
                    type="button"
                    onclick={generateNewKeypair}
                    class="inline-flex items-center justify-center typ-body text-gray-700 hover:text-gray-900 dark:text-slate-100 dark:hover:text-white w-10 h-10 rounded-full bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60"
                    aria-label={$t('auth.keypair.generateAnother')}
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014 0M19 5a9 9 0 00-14 0" />
                    </svg>
                </button>


                <button
                    type="button"
                    onclick={handleUseKeypair}
                     class="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white typ-body font-medium px-4 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-center"

                    disabled={!nsec}
                >
                    {$t('auth.keypair.useAndLogin')}
                </button>
            </div>
        </div>
    </div>
{/if}
