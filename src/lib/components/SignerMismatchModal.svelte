<script lang="ts">
    import { t } from '$lib/i18n';
    import { nip19 } from 'nostr-tools';

    let { expectedPubkey, actualPubkey } = $props<{
        expectedPubkey: string;
        actualPubkey: string;
    }>();

    function truncateNpub(pubkeyHex: string): string {
        try {
            const npub = nip19.npubEncode(pubkeyHex);
            return npub.slice(0, 12) + '...' + npub.slice(-8);
        } catch {
            return pubkeyHex.slice(0, 12) + '...' + pubkeyHex.slice(-8);
        }
    }

    const expectedDisplay = $derived(truncateNpub(expectedPubkey));
    const actualDisplay = $derived(truncateNpub(actualPubkey));
</script>

<!-- Non-dismissible modal - no close button, no backdrop click, no escape key -->
<div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="signer-mismatch-title"
    aria-describedby="signer-mismatch-description"
>
    <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-200 dark:border-red-900/50">
        <!-- Warning Icon -->
        <div class="flex justify-center mb-4">
            <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
        </div>

        <!-- Title -->
        <h2 id="signer-mismatch-title" class="text-xl font-semibold text-center text-gray-900 dark:text-white mb-2">
            {$t('signerMismatch.title')}
        </h2>

        <!-- Description -->
        <p id="signer-mismatch-description" class="text-center text-gray-600 dark:text-gray-300 mb-6">
            {$t('signerMismatch.description')}
        </p>

        <!-- Account comparison -->
        <div class="space-y-3 mb-6">
            <div class="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p class="text-xs text-green-700 dark:text-green-400 font-medium mb-1">
                    {$t('signerMismatch.expectedAccount')}
                </p>
                <p class="font-mono text-sm text-green-800 dark:text-green-300 break-all">
                    {expectedDisplay}
                </p>
            </div>

            <div class="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p class="text-xs text-red-700 dark:text-red-400 font-medium mb-1">
                    {$t('signerMismatch.actualAccount')}
                </p>
                <p class="font-mono text-sm text-red-800 dark:text-red-300 break-all">
                    {actualDisplay}
                </p>
            </div>
        </div>

        <!-- Instructions -->
        <div class="p-4 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            <p class="text-sm text-gray-700 dark:text-gray-300 text-center">
                {$t('signerMismatch.instructions')}
            </p>
        </div>
    </div>
</div>
