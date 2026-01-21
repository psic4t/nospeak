<script lang="ts">
    import { isAndroidNative, isMobileWeb } from '$lib/core/NativeDialogs';
    import { blur } from '$lib/utils/platform';
    import { hapticSelection } from '$lib/utils/haptics';
    import { fade } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { t } from '$lib/i18n';
    import Button from '$lib/components/ui/Button.svelte';

    const MAX_NAME_LENGTH = 100;
    // Disallow newlines and some control characters
    const INVALID_CHARS_REGEX = /[\n\r\t\x00-\x1F]/;

    let { isOpen, close, currentName, onSave } = $props<{
        isOpen: boolean;
        close: () => void;
        currentName: string;
        onSave: (newName: string) => void;
    }>();

    const isAndroidApp = isAndroidNative();
    const isMobile = isAndroidApp || isMobileWeb();

    // Bottom sheet drag handling
    const BOTTOM_SHEET_CLOSE_THRESHOLD = 100;
    const BOTTOM_SHEET_ACTIVATION_THRESHOLD = 6;
    const BOTTOM_SHEET_VELOCITY_THRESHOLD = 0.5;
    let bottomSheetDragY = $state(0);
    let isBottomSheetDragging = $state(false);
    let bottomSheetDragStartY = 0;
    let modalElement: HTMLDivElement | undefined = $state();
    let lastPointerY = 0;
    let lastPointerTime = 0;
    let pointerVelocity = 0;

    // Form state
    let inputValue = $state('');
    let inputElement: HTMLInputElement | undefined = $state();
    let validationError = $state<string | null>(null);

    // Reset form when modal opens
    $effect(() => {
        if (isOpen) {
            inputValue = currentName || '';
            validationError = null;
            // Focus input after modal animation
            setTimeout(() => {
                inputElement?.focus();
                inputElement?.select();
            }, 200);
        }
    });

    // Validate input
    function validate(value: string): string | null {
        const trimmed = value.trim();
        if (trimmed.length > MAX_NAME_LENGTH) {
            return $t('chat.group.nameValidationTooLong') as string;
        }
        if (INVALID_CHARS_REGEX.test(trimmed)) {
            return $t('chat.group.nameValidationInvalidChars') as string;
        }
        return null;
    }

    function handleInput(e: Event) {
        const target = e.target as HTMLInputElement;
        inputValue = target.value;
        validationError = validate(inputValue);
    }

    function handleSave() {
        const trimmed = inputValue.trim();
        const error = validate(trimmed);
        if (error) {
            validationError = error;
            return;
        }
        hapticSelection();
        onSave(trimmed);
        close();
    }

    function handleCancel() {
        hapticSelection();
        close();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !validationError) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    }

    function handleBottomSheetPointerDown(e: PointerEvent): void {
        if (!isMobile) return;
        e.preventDefault();
        isBottomSheetDragging = false;
        bottomSheetDragStartY = e.clientY;
        bottomSheetDragY = 0;

        lastPointerY = e.clientY;
        lastPointerTime = e.timeStamp;
        pointerVelocity = 0;

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function handleBottomSheetPointerMove(e: PointerEvent): void {
        if (!isMobile) return;

        const delta = e.clientY - bottomSheetDragStartY;

        if (!isBottomSheetDragging) {
            if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                isBottomSheetDragging = true;
            } else {
                return;
            }
        }

        const timeDelta = e.timeStamp - lastPointerTime;
        if (timeDelta > 0) {
            pointerVelocity = (e.clientY - lastPointerY) / timeDelta;
        }
        lastPointerY = e.clientY;
        lastPointerTime = e.timeStamp;

        const dragY = delta > 0 ? delta : 0;

        if (modalElement) {
            modalElement.style.transform = `translateY(${dragY}px)`;
        }

        bottomSheetDragY = dragY;
    }

    function handleBottomSheetPointerEnd(e: PointerEvent): void {
        if (!isMobile) return;

        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // ignore if pointer capture was not set
        }

        if (!isBottomSheetDragging) {
            bottomSheetDragY = 0;
            return;
        }

        const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD
            || pointerVelocity > BOTTOM_SHEET_VELOCITY_THRESHOLD;

        isBottomSheetDragging = false;

        if (shouldClose) {
            if (modalElement) {
                modalElement.style.transform = 'translateY(100%)';
            }
            setTimeout(() => {
                bottomSheetDragY = 0;
                if (modalElement) {
                    modalElement.style.transform = '';
                }
                hapticSelection();
                close();
            }, 150);
        } else {
            bottomSheetDragY = 0;
            if (modalElement) {
                modalElement.style.transform = 'translateY(0)';
            }
        }
    }
</script>

{#if isOpen}
    <div
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class={`fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 ${blur('sm')} z-50 flex justify-center ${
            isMobile ? 'items-end' : 'items-center p-4'
        }`}
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if (e.target === e.currentTarget) { hapticSelection(); close(); } }}
        onkeydown={(e) => { if (e.key === 'Escape') { hapticSelection(); close(); } }}
    >
        <div
            bind:this={modalElement}
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }}
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class={`bg-white/95 dark:bg-slate-900/80 ${blur('xl')} shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden relative outline-none ${
                isBottomSheetDragging ? '' : 'transition-transform duration-150 ease-out'
            } ${
                isMobile
                    ? 'w-full rounded-t-3xl rounded-b-none max-h-[90vh] p-6'
                    : 'w-full max-w-md max-h-[80vh] rounded-3xl p-8'
            }`}
            class:android-safe-area-bottom={isAndroidApp}
            style:will-change={isBottomSheetDragging ? 'transform' : undefined}
        >
            {#if isMobile}
                <div class="absolute top-0 left-0 right-0 h-16 z-20 pointer-events-none">
                    <div
                        class="mx-auto w-32 h-full pointer-events-auto touch-none"
                        onpointerdown={handleBottomSheetPointerDown}
                        onpointermove={handleBottomSheetPointerMove}
                        onpointerup={handleBottomSheetPointerEnd}
                        onpointercancel={handleBottomSheetPointerEnd}
                    >
                        <div
                            class="mx-auto mt-2 w-10 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600"
                        ></div>
                    </div>
                </div>
            {/if}

            {#if !isMobile}
                <Button
                    onclick={close}
                    aria-label="Close modal"
                    size="icon"
                    class="absolute top-4 right-4 z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </Button>
            {/if}

            <div class={isMobile ? 'flex flex-col mb-4 mt-8 w-full max-w-2xl mx-auto' : 'flex justify-between items-center mb-6 px-1'}>
                <h2 class="typ-title dark:text-white">{$t('chat.group.editNameTitle')}</h2>
            </div>

            <div class={`flex-1 ${isMobile ? 'px-0' : ''}`}>
                <div class={`${isMobile ? 'max-w-2xl mx-auto w-full' : ''}`}>
                    <input
                        bind:this={inputElement}
                        type="text"
                        value={inputValue}
                        oninput={handleInput}
                        onkeydown={handleKeydown}
                        placeholder={$t('chat.group.editNamePlaceholder') as string}
                        maxlength={MAX_NAME_LENGTH + 10}
                        class="w-full px-4 py-3 border rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 {validationError ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-slate-700'}"
                        aria-label={$t('chat.group.editNamePlaceholder') as string}
                        aria-invalid={!!validationError}
                    />
                    
                    <div class="flex justify-between items-center mt-2 px-1">
                        {#if validationError}
                            <span class="text-sm text-red-500 dark:text-red-400">{validationError}</span>
                        {:else}
                            <span class="text-sm text-gray-400 dark:text-slate-500">
                                {$t('chat.group.editNameHint')}
                            </span>
                        {/if}
                        <span class="text-sm text-gray-400 dark:text-slate-500">
                            {inputValue.trim().length}/{MAX_NAME_LENGTH}
                        </span>
                    </div>
                </div>
            </div>

            <div class={`flex gap-3 mt-6 ${isMobile ? 'max-w-2xl mx-auto w-full' : ''}`}>
                <Button
                    onclick={handleCancel}
                    variant="filled-tonal"
                    class="flex-1"
                >
                    {$t('chat.group.editNameCancel')}
                </Button>
                <Button
                    onclick={handleSave}
                    variant="primary"
                    disabled={!!validationError}
                    class="flex-1"
                >
                    {$t('chat.group.editNameSave')}
                </Button>
            </div>
        </div>
    </div>
{/if}
