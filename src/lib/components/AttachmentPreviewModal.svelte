<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';
    import { isAndroidCapacitorShell, blur } from '$lib/utils/platform';
    import { isMobileWeb } from '$lib/core/NativeDialogs';
    import BottomSheetHandle from '$lib/components/ui/BottomSheetHandle.svelte';
    import { bottomSheet } from '$lib/actions/bottomSheet';

    import Button from '$lib/components/ui/Button.svelte';
    import LocationMap from '$lib/components/LocationMap.svelte';
    import Textarea from '$lib/components/ui/Textarea.svelte';
    import { MAP_HEIGHT_PREVIEW, buildOsmOpenUrl } from '$lib/core/MapUtils';
    import { getFileIconInfo, getFileExtension, formatFileSize } from '$lib/utils/fileIcons';

    import type { LocationPoint } from '$lib/core/MapUtils';

    type Mode = 'media' | 'location';

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
        mediaType?: 'image' | 'video' | 'audio' | 'file';
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

    const openMapUrl = $derived(location ? buildOsmOpenUrl(location) : null);
    const showLocationConfirm = $derived(isLocationMode && !!confirmTextIdle);

    let overlayElement: HTMLDivElement | undefined = $state();

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
                {#if isLocationMode && location}
                    <div class="w-full">
                        <LocationMap
                            latitude={location.latitude}
                            longitude={location.longitude}
                            height={MAP_HEIGHT_PREVIEW}
                        />
                    </div>
                {:else if mediaType === 'image' && objectUrl}
                    <img src={objectUrl} alt={imageAlt} class="max-h-64 w-full object-contain" />
                {:else if mediaType === 'video' && objectUrl}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video src={objectUrl} controls class="max-h-64 w-full object-contain"></video>
                {:else if mediaType === 'audio' && objectUrl}
                    <audio src={objectUrl} controls class="w-full"></audio>
                {:else if mediaType === 'file' && file}
                    {@const iconInfo = getFileIconInfo(file.type)}
                    {@const extension = getFileExtension(file.type) || '.file'}
                    {@const size = formatFileSize(file.size)}
                    <div class="flex flex-col items-center gap-3 py-6">
                        <div class="w-16 h-16 rounded-xl {iconInfo.color} flex items-center justify-center">
                            {@html iconInfo.svg}
                        </div>
                        <div class="text-center">
                            <div class="typ-section text-gray-800 dark:text-gray-200 uppercase">{extension}</div>
                            <div class="typ-meta text-gray-500 dark:text-gray-400">{size}</div>
                        </div>
                    </div>
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
