<script lang="ts">
    import { authService } from '$lib/core/AuthService';

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
        <div class="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20 dark:border-white/10">
            <div class="flex justify-between items-center mb-4">
                <h2 id="keypair-modal-title" class="text-lg font-bold dark:text-white">Generate new keypair</h2>
                <button
                    type="button"
                    class="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                    onclick={close}
                    aria-label="Close"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <p class="text-sm text-gray-600 dark:text-slate-300 mb-4">
                A new Nostr keypair is generated locally in your browser.
            </p>

            <div class="space-y-3 mb-4">
                <div>
                    <p class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                        npub (public key)
                    </p>
                    <div class="text-xs font-mono break-all p-2 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-slate-100 border border-gray-200/60 dark:border-slate-700/60">
                        {npub}
                    </div>
                </div>
                <div>
                    <p class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                        nsec (secret key)
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
                    class="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 dark:text-slate-300 dark:hover:text-slate-100 px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014 0M19 5a9 9 0 00-14 0" />
                    </svg>
                    <span>Generate another</span>
                </button>

                <button
                    type="button"
                    onclick={handleUseKeypair}
                    class="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-center"
                    disabled={!nsec}
                >
                    Use this keypair and login
                </button>
            </div>
        </div>
    </div>
{/if}
