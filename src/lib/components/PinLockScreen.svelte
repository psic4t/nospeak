<script lang="ts">
    import { t } from '$lib/i18n';
    import { fade } from 'svelte/transition';
    import PinPad from './PinPad.svelte';
    import { unlockWithPin } from '$lib/stores/pin';

    let {
        isLocked = false
    } = $props<{
        isLocked: boolean;
    }>();

    let pinValue = $state('');
    let error = $state(false);
    let errorMessage = $state('');
    let isProcessing = $state(false);

    // Reset when shown
    $effect(() => {
        if (isLocked) {
            pinValue = '';
            error = false;
            errorMessage = '';
            isProcessing = false;
        }
    });

    async function handleComplete(pin: string) {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const valid = await unlockWithPin(pin);
            if (!valid) {
                error = true;
                errorMessage = $t('settings.pin.wrongPin');
                setTimeout(() => {
                    error = false;
                    errorMessage = '';
                    pinValue = '';
                    isProcessing = false;
                }, 600);
                return;
            }
            // Unlock happened via store update in unlockWithPin
        } finally {
            isProcessing = false;
        }
    }
</script>

{#if isLocked}
    <div
        class="fixed inset-0 z-[99999] flex flex-col items-center justify-center
            bg-white dark:bg-slate-950"
        role="dialog"
        aria-modal="true"
        aria-label="PIN Lock Screen"
        in:fade={{ duration: 150 }}
    >
        <!-- App identity -->
        <div class="mb-12 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[rgb(var(--color-lavender-rgb)/0.15)] flex items-center justify-center">
                <svg class="w-8 h-8 text-[rgb(var(--color-lavender-rgb))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
            </div>
            <h1 class="typ-title dark:text-white">nospeak</h1>
            <p class="typ-meta text-gray-500 dark:text-slate-400 mt-1">
                {$t('settings.pin.enterPinToUnlock')}
            </p>
        </div>

        <!-- PIN pad -->
        <div class="w-full max-w-sm px-6">
            <PinPad
                bind:value={pinValue}
                {error}
                onComplete={handleComplete}
                disabled={isProcessing}
            />
        </div>

        {#if errorMessage}
            <p class="text-center text-sm text-red-500 dark:text-red-400 mt-6">
                {errorMessage}
            </p>
        {/if}
    </div>
{/if}
