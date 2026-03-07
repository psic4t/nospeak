<script lang="ts">
    import { onMount } from 'svelte';
    import { hapticSelection } from '$lib/utils/haptics';
    import { isAndroidCapacitorShell, blur } from '$lib/utils/platform';
    import { isMobileWeb } from '$lib/core/NativeDialogs';
    import BottomSheetHandle from '$lib/components/ui/BottomSheetHandle.svelte';
    import { bottomSheet } from '$lib/actions/bottomSheet';
    import Button from '$lib/components/ui/Button.svelte';
    import { t } from '$lib/i18n';

    const MAX_OUTPUT_SIZE = 2048;
    const JPEG_QUALITY = 0.85;

    let {
        isOpen,
        file,
        onConfirm,
        onCancel
    } = $props<{
        isOpen: boolean;
        file: File | null;
        onConfirm: (croppedFile: File) => void;
        onCancel: () => void;
    }>();

    const isAndroidShell = isAndroidCapacitorShell();
    const useFullWidth = isAndroidShell || isMobileWeb();

    let containerElement = $state<HTMLDivElement | undefined>();
    let overlayElement = $state<HTMLDivElement | undefined>();
    let objectUrl = $state<string | null>(null);
    let cropperReady = $state(false);
    let isExporting = $state(false);

    // Store references to cropper elements for export
    let selectionElement = $state<Element | null>(null);

    $effect(() => {
        if (isOpen && file) {
            objectUrl = URL.createObjectURL(file);
            cropperReady = false;
            // Wait for DOM, then init cropper
            requestAnimationFrame(() => {
                void initCropper();
            });
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                objectUrl = null;
            }
            cropperReady = false;
            selectionElement = null;
            if (containerElement) {
                containerElement.innerHTML = '';
            }
        };
    });

    async function initCropper() {
        if (!containerElement || !objectUrl) return;

        try {
            // Dynamic import to avoid SSR issues and for code splitting
            await import('cropperjs');

            // Clear container
            containerElement.innerHTML = '';

            // Build cropper DOM with web components
            const canvas = document.createElement('cropper-canvas') as any;
            canvas.setAttribute('background', '');
            canvas.style.width = '100%';
            canvas.style.height = '300px';

            const image = document.createElement('cropper-image') as any;
            image.setAttribute('src', objectUrl);
            image.setAttribute('alt', 'Crop');
            image.setAttribute('scalable', '');
            image.setAttribute('translatable', '');
            // Slottable tells the image to fit inside the canvas
            image.setAttribute('slottable', '');

            const shade = document.createElement('cropper-shade') as any;
            shade.setAttribute('hidden', '');

            const handle = document.createElement('cropper-handle') as any;
            handle.setAttribute('action', 'move');
            handle.setAttribute('plain', '');

            const selection = document.createElement('cropper-selection') as any;
            selection.setAttribute('initial-coverage', '0.8');
            selection.setAttribute('movable', '');
            selection.setAttribute('resizable', '');
            selection.setAttribute('aspect-ratio', '1');

            const grid = document.createElement('cropper-grid') as any;
            grid.setAttribute('role', 'grid');
            grid.setAttribute('covered', '');

            const crosshair = document.createElement('cropper-crosshair') as any;
            crosshair.setAttribute('centered', '');

            const moveHandle = document.createElement('cropper-handle') as any;
            moveHandle.setAttribute('action', 'move');
            moveHandle.setAttribute('theme-color', 'rgba(255, 255, 255, 0.35)');

            // Resize handles
            const resizeActions = ['n-resize', 'e-resize', 's-resize', 'w-resize', 'ne-resize', 'nw-resize', 'se-resize', 'sw-resize'];
            for (const action of resizeActions) {
                const h = document.createElement('cropper-handle') as any;
                h.setAttribute('action', action);
                selection.appendChild(h);
            }

            selection.prepend(moveHandle, crosshair, grid);

            canvas.append(image, shade, handle, selection);
            containerElement.appendChild(canvas);

            selectionElement = selection;
            cropperReady = true;
        } catch (err) {
            console.error('Failed to initialize cropper:', err);
        }
    }

    async function handleConfirm() {
        if (!selectionElement || isExporting) return;

        isExporting = true;
        hapticSelection();

        try {
            const sel = selectionElement as any;
            const canvas: HTMLCanvasElement = await sel.$toCanvas({
                width: MAX_OUTPUT_SIZE,
                height: MAX_OUTPUT_SIZE
            });

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
            });

            if (!blob) {
                throw new Error('Failed to export cropped image');
            }

            const croppedFile = new File(
                [blob],
                `profile-${Date.now()}.jpg`,
                { type: 'image/jpeg' }
            );

            onConfirm(croppedFile);
        } catch (err) {
            console.error('Failed to export cropped image:', err);
        } finally {
            isExporting = false;
        }
    }

    function handleOverlayClick(e: MouseEvent): void {
        if (e.target === e.currentTarget) {
            hapticSelection();
            onCancel();
        }
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            hapticSelection();
            onCancel();
        }
    }
</script>

{#if isOpen}
    <div
        bind:this={overlayElement}
        class={`fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 md:pb-4 ${useFullWidth ? '' : 'px-4'}`}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div
            use:bottomSheet={{ enabled: useFullWidth, onClose: () => { hapticSelection(); onCancel(); }, overlay: overlayElement }}
            class={`relative w-full bg-white/95 dark:bg-slate-900/95 border border-gray-200/80 dark:border-slate-700/80 shadow-2xl ${blur('xl')} p-4 space-y-3 ${
                isAndroidShell ? 'rounded-t-3xl' : 'max-w-md rounded-t-2xl md:rounded-2xl'
            }`}
        >
            {#if useFullWidth}
                <BottomSheetHandle />
            {/if}

            <Button
                onclick={() => {
                    hapticSelection();
                    onCancel();
                }}
                aria-label="Close modal"
                size="icon"
                class="hidden md:flex absolute top-3 right-3 z-10"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </Button>

            <div class="flex items-center justify-between mb-2 px-0.5 mt-2 md:mt-0">
                <h2 class="typ-title dark:text-white">{$t('settings.profile.cropTitle')}</h2>
            </div>

            <div
                bind:this={containerElement}
                class="rounded-xl overflow-hidden bg-gray-100/80 dark:bg-slate-800/80 min-h-[300px] flex items-center justify-center"
            >
                {#if !cropperReady}
                    <svg
                        class="animate-spin h-6 w-6 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                {/if}
            </div>

            <div class="flex justify-end gap-2 pt-1">
                <Button onclick={() => { hapticSelection(); onCancel(); }} disabled={isExporting}>
                    {$t('common.cancel')}
                </Button>

                <Button
                    variant="primary"
                    onclick={handleConfirm}
                    disabled={!cropperReady || isExporting}
                >
                    {#if isExporting}
                        <svg
                            class="animate-spin h-4 w-4 text-white me-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    {/if}
                    {$t('settings.profile.cropConfirm')}
                </Button>
            </div>
        </div>
    </div>
{/if}
