<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';
    import { isAndroidCapacitorShell } from '$lib/utils/platform';
    import { isMobileWeb } from '$lib/core/NativeDialogs';

    import Button from '$lib/components/ui/Button.svelte';
    import Textarea from '$lib/components/ui/Textarea.svelte';

    type Mode = 'media' | 'location';

    export type LocationPoint = {
        latitude: number;
        longitude: number;
    };

    let {
        isOpen,
        mode = 'media',
        location = null,
        openMapText = '',
        file = null,
        mediaType = 'image',
        objectUrl = null,
        title,
        imageAlt = '',
        noPreviewText = '',
        captionLabel = '',
        captionPlaceholder = '',
        cancelText,
        confirmTextIdle = '',
        confirmTextBusy = '',
        captionEnabled = true,
        caption = $bindable(''),
        error = null,
        hint = null,
        isBusy = false,
        disableConfirm = false,
        onCancel,
        onConfirm = () => undefined
    } = $props<{
        isOpen: boolean;
        mode?: Mode;
        location?: LocationPoint | null;
        openMapText?: string;
        file?: File | null;
        mediaType?: 'image' | 'video' | 'audio';
        objectUrl?: string | null;
        title: string;
        imageAlt?: string;
        noPreviewText?: string;
        captionLabel?: string;
        captionPlaceholder?: string;
        cancelText: string;
        confirmTextIdle?: string;
        confirmTextBusy?: string;
        captionEnabled?: boolean;
        caption?: string;
        error?: string | null;
        hint?: string | null;
        isBusy?: boolean;
        disableConfirm?: boolean;
        onCancel: () => void;
        onConfirm?: () => void;
    }>();

    const isAndroidShell = isAndroidCapacitorShell();
    const useFullWidth = isAndroidShell || isMobileWeb();

    const isLocationMode = $derived(mode === 'location');

    function buildOsmEmbedUrl(point: LocationPoint): string {
        const padding = 0.01;
        const left = point.longitude - padding;
        const right = point.longitude + padding;
        const bottom = point.latitude - padding;
        const top = point.latitude + padding;

        return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${point.latitude},${point.longitude}`;
    }

    function buildOsmOpenUrl(point: LocationPoint): string {
        return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}&zoom=15`;
    }

    const mapUrl = $derived(location ? buildOsmEmbedUrl(location) : null);
    const openMapUrl = $derived(location ? buildOsmOpenUrl(location) : null);
    const showLocationConfirm = $derived(isLocationMode && !!confirmTextIdle);

    // Bottom sheet drag state (Android only)
    const BOTTOM_SHEET_ACTIVATION_THRESHOLD = 8;
    const BOTTOM_SHEET_CLOSE_THRESHOLD = 96;
    let isBottomSheetDragging = $state(false);
    let bottomSheetDragStartY = 0;
    let bottomSheetDragY = $state(0);

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

    function handleBottomSheetPointerDown(e: PointerEvent) {
        if (!isAndroidShell) return;
        e.preventDefault();
        isBottomSheetDragging = false;
        bottomSheetDragStartY = e.clientY;
        bottomSheetDragY = 0;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function handleBottomSheetPointerMove(e: PointerEvent) {
        if (!isAndroidShell) return;
        const delta = e.clientY - bottomSheetDragStartY;
        if (!isBottomSheetDragging) {
            if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                isBottomSheetDragging = true;
            } else {
                return;
            }
        }
        bottomSheetDragY = delta > 0 ? delta : 0;
    }

    function handleBottomSheetPointerEnd(e: PointerEvent) {
        if (!isAndroidShell) return;
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        if (!isBottomSheetDragging) {
            bottomSheetDragY = 0;
            return;
        }
        const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
        isBottomSheetDragging = false;
        bottomSheetDragY = 0;
        if (shouldClose) {
            hapticSelection();
            onCancel();
        }
    }

    function handleBottomSheetTouchStart(e: TouchEvent) {
        if (!isAndroidShell) return;
        if (e.touches.length === 0) return;
        const touch = e.touches[0];
        isBottomSheetDragging = false;
        bottomSheetDragStartY = touch.clientY;
        bottomSheetDragY = 0;
    }

    function handleBottomSheetTouchMove(e: TouchEvent) {
        if (!isAndroidShell) return;
        if (e.touches.length === 0) return;
        const touch = e.touches[0];
        const delta = touch.clientY - bottomSheetDragStartY;
        if (!isBottomSheetDragging) {
            if (delta > BOTTOM_SHEET_ACTIVATION_THRESHOLD) {
                isBottomSheetDragging = true;
            } else {
                return;
            }
        }
        bottomSheetDragY = delta > 0 ? delta : 0;
        e.preventDefault();
    }

    function handleBottomSheetTouchEnd() {
        if (!isAndroidShell) return;
        if (!isBottomSheetDragging) {
            bottomSheetDragY = 0;
            return;
        }
        const shouldClose = bottomSheetDragY > BOTTOM_SHEET_CLOSE_THRESHOLD;
        isBottomSheetDragging = false;
        bottomSheetDragY = 0;
        if (shouldClose) {
            hapticSelection();
            onCancel();
        }
    }
</script>

{#if isOpen}
    <div
        class={`fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 md:pb-4 ${useFullWidth ? '' : 'px-4'}`}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div
            class={`relative w-full bg-white/95 dark:bg-slate-900/95 border border-gray-200/80 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl p-4 space-y-3 ${
                isAndroidShell ? 'rounded-t-3xl' : 'max-w-md rounded-t-2xl md:rounded-2xl'
            }`}
            style:transform={isAndroidShell ? `translateY(${bottomSheetDragY}px)` : undefined}
        >
            {#if isAndroidShell}
                <div
                    class="absolute top-0 left-1/2 -translate-x-1/2 h-10 w-24"
                    onpointerdown={handleBottomSheetPointerDown}
                    onpointermove={handleBottomSheetPointerMove}
                    onpointerup={handleBottomSheetPointerEnd}
                    onpointercancel={handleBottomSheetPointerEnd}
                    ontouchstart={handleBottomSheetTouchStart}
                    ontouchmove={handleBottomSheetTouchMove}
                    ontouchend={handleBottomSheetTouchEnd}
                    ontouchcancel={handleBottomSheetTouchEnd}
                >
                    <div class="mx-auto mt-2 w-10 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 touch-none"></div>
                </div>
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
                <h2 class="typ-title dark:text-white">{title}</h2>
            </div>

            {#if hint}
                <div class="px-3 py-2 rounded-xl bg-blue-50/10 dark:bg-blue-950/30 border border-blue-500/10 dark:border-blue-900/60">
                    <div class="typ-meta text-xs text-gray-900 dark:text-blue-200 whitespace-pre-wrap">
                        {hint}
                    </div>
                </div>
            {/if}

            <div class="rounded-xl overflow-hidden bg-gray-100/80 dark:bg-slate-800/80 flex items-center justify-center min-h-[160px]">
                {#if isLocationMode && location && mapUrl}
                    <iframe
                        src={mapUrl}
                        width="100%"
                        height="300"
                        frameborder="0"
                        class="w-full"
                        title={title}
                    ></iframe>
                {:else if mediaType === 'image' && objectUrl}
                    <img src={objectUrl} alt={imageAlt} class="max-h-64 w-full object-contain" />
                {:else if mediaType === 'video' && objectUrl}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video src={objectUrl} controls class="max-h-64 w-full object-contain"></video>
                {:else if mediaType === 'audio' && objectUrl}
                    <audio src={objectUrl} controls class="w-full"></audio>
                {:else}
                    <div class="typ-body text-gray-500 dark:text-slate-400">{noPreviewText}</div>
                {/if}
            </div>

            {#if captionEnabled && !isLocationMode}
                <div>
                    <label class="typ-meta block mb-1 text-gray-600 dark:text-slate-300">
                        {captionLabel}
                        <Textarea
                            rows={2}
                            bind:value={caption}
                            placeholder={captionPlaceholder}
                            disabled={isBusy}
                            class="mt-1"
                        />
                    </label>
                </div>
            {/if}

            {#if error}
                <div class="typ-body text-sm text-red-600 dark:text-red-300 pt-1">{error}</div>
            {/if}

            <div class="flex justify-end gap-2 pt-1">
                <Button onclick={onCancel} disabled={isBusy}>
                    {cancelText}
                </Button>

                {#if isLocationMode && !showLocationConfirm}
                    <Button
                        variant="primary"
                        onclick={() => {
                            if (!openMapUrl) {
                                return;
                            }
                            window.open(openMapUrl, '_blank', 'noopener,noreferrer');
                        }}
                        disabled={!openMapUrl}
                    >
                        {openMapText}
                    </Button>
                {:else}
                    <Button
                        variant="primary"
                        onclick={onConfirm}
                        disabled={isBusy || disableConfirm}
                    >
                        {#if isBusy}
                            <svg
                                class="animate-spin h-4 w-4 text-white mr-2"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            <span>{confirmTextBusy}</span>
                        {:else}
                            {confirmTextIdle}
                        {/if}
                    </Button>
                {/if}
            </div>
        </div>
    </div>
{/if}
