<script lang="ts">
    import { t } from '$lib/i18n';
    import { fade } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { hapticSelection } from '$lib/utils/haptics';
    import Button from '$lib/components/ui/Button.svelte';
    import PinPad from './PinPad.svelte';
    import { verifyPin } from '$lib/stores/pin';

    type PinSetupMode = 'set' | 'verify' | 'change';
    type Step = 'verify-old' | 'enter' | 'confirm';

    let {
        isOpen = false,
        close = () => {},
        mode = 'set' as PinSetupMode,
        onSuccess = (_pin: string) => {}
    } = $props<{
        isOpen: boolean;
        close: () => void;
        mode?: PinSetupMode;
        onSuccess: (pin: string) => void;
    }>();

    let currentStep = $state<Step>('enter');
    let pinValue = $state('');
    let firstPin = $state('');
    let error = $state(false);
    let errorMessage = $state('');
    let isProcessing = $state(false);

    // Reset state when modal opens/closes
    $effect(() => {
        if (isOpen) {
            pinValue = '';
            firstPin = '';
            error = false;
            errorMessage = '';
            isProcessing = false;

            if (mode === 'verify') {
                currentStep = 'verify-old';
            } else if (mode === 'change') {
                currentStep = 'verify-old';
            } else {
                currentStep = 'enter';
            }
        }
    });

    function getTitle(): string {
        if (currentStep === 'verify-old') {
            return $t('settings.pin.enterCurrentPin');
        }
        if (currentStep === 'enter') {
            return $t('settings.pin.enterNewPin');
        }
        return $t('settings.pin.confirmPin');
    }

    function getSubtitle(): string {
        if (currentStep === 'verify-old') {
            return $t('settings.pin.enterCurrentPinDescription');
        }
        if (currentStep === 'enter') {
            return $t('settings.pin.enterNewPinDescription');
        }
        return $t('settings.pin.confirmPinDescription');
    }

    async function handleComplete(pin: string) {
        if (isProcessing) return;
        isProcessing = true;

        try {
            if (currentStep === 'verify-old') {
                const valid = await verifyPin(pin);
                if (!valid) {
                    error = true;
                    errorMessage = $t('settings.pin.wrongPin');
                    setTimeout(() => {
                        error = false;
                        errorMessage = '';
                        pinValue = '';
                    }, 600);
                    return;
                }

                if (mode === 'verify') {
                    onSuccess(pin);
                    return;
                }

                // mode === 'change', proceed to enter new PIN
                currentStep = 'enter';
                pinValue = '';
                return;
            }

            if (currentStep === 'enter') {
                firstPin = pin;
                currentStep = 'confirm';
                pinValue = '';
                return;
            }

            if (currentStep === 'confirm') {
                if (pin !== firstPin) {
                    error = true;
                    errorMessage = $t('settings.pin.pinMismatch');
                    setTimeout(() => {
                        error = false;
                        errorMessage = '';
                        pinValue = '';
                        firstPin = '';
                        currentStep = 'enter';
                    }, 600);
                    return;
                }

                onSuccess(pin);
            }
        } finally {
            isProcessing = false;
        }
    }

    function handleOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            hapticSelection();
            close();
        }
    }
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onclick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-setup-title"
        tabindex="-1"
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
    >
        <div
            class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/20 dark:border-white/10 relative outline-none"
            in:glassModal={{ duration: 200 }}
            out:glassModal
        >
            <Button
                onclick={() => { hapticSelection(); close(); }}
                aria-label="Close"
                size="icon"
                class="absolute top-4 right-4 z-10"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </Button>

            <div class="text-center mb-8 mt-2">
                <h2 id="pin-setup-title" class="typ-title dark:text-white mb-1">
                    {getTitle()}
                </h2>
                <p class="typ-meta text-gray-500 dark:text-slate-400">
                    {getSubtitle()}
                </p>
            </div>

            <PinPad
                bind:value={pinValue}
                {error}
                onComplete={handleComplete}
                disabled={isProcessing}
            />

            {#if errorMessage}
                <p class="text-center text-sm text-red-500 dark:text-red-400 mt-4">
                    {errorMessage}
                </p>
            {/if}
        </div>
    </div>
{/if}
