<script lang="ts">
    import { imageViewerState, closeImageViewer, toggleImageViewerFit } from '$lib/stores/imageViewer';
    import { nativeDialogService, isAndroidNative } from '$lib/core/NativeDialogs';

    const isAndroidNativeEnv = $derived(isAndroidNative());
    let { url: imageViewerUrl, fitToScreen: imageViewerFitToScreen } = $derived($imageViewerState);

    async function downloadActiveImage() {
        if (!imageViewerUrl || typeof window === 'undefined') {
            return;
        }

        try {
            const response = await fetch(imageViewerUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            const anchor = document.createElement('a');
            anchor.href = objectUrl;

            try {
                const parsed = new URL(imageViewerUrl);
                const segments = parsed.pathname.split('/');
                const lastSegment = segments[segments.length - 1] || 'image';
                anchor.download = lastSegment;
            } catch {
                anchor.download = 'image';
            }

            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(objectUrl);
        } catch (e) {
            console.error('Failed to download image from viewer:', e);
        }
    }

    async function shareActiveImage() {
        if (!imageViewerUrl || !isAndroidNativeEnv) {
            return;
        }

        try {
            await nativeDialogService.share({
                url: imageViewerUrl,
                text: 'Shared from nospeak'
            });
        } catch (e) {
            console.error('Failed to share image from viewer:', e);
        }
    }
</script>

{#if imageViewerUrl}
    <div
        class="fixed inset-0 z-[100] bg-black/80 flex flex-col"
        role="dialog"
        aria-modal="true"
    >
        <div class={`flex items-center justify-end gap-2 p-3 text-white ${isAndroidNativeEnv ? 'pt-12' : ''}`}>
            <button
                type="button"
                class="h-9 w-9 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                onclick={toggleImageViewerFit}
                aria-label={imageViewerFitToScreen ? 'View image at full size' : 'Fit image to screen'}
            >
                {#if imageViewerFitToScreen}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                        <polyline points="4 9 4 4 9 4"></polyline>
                        <line x1="9" y1="9" x2="4" y2="4"></line>
                        <polyline points="20 9 20 4 15 4"></polyline>
                        <line x1="15" y1="9" x2="20" y2="4"></line>
                        <polyline points="20 15 20 20 15 20"></polyline>
                        <line x1="15" y1="15" x2="20" y2="20"></line>
                        <polyline points="4 15 4 20 9 20"></polyline>
                        <line x1="9" y1="15" x2="4" y2="20"></line>
                    </svg>
                {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                        <polyline points="4 9 9 9 9 4"></polyline>
                        <line x1="4" y1="4" x2="9" y2="9"></line>
                        <polyline points="20 9 15 9 15 4"></polyline>
                        <line x1="20" y1="4" x2="15" y2="9"></line>
                        <polyline points="20 15 15 15 15 20"></polyline>
                        <line x1="20" y1="20" x2="15" y2="15"></line>
                        <polyline points="4 15 9 15 9 20"></polyline>
                        <line x1="4" y1="20" x2="9" y2="15"></line>
                    </svg>
                {/if}
            </button>

            <button
                type="button"
                class="h-9 w-9 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                onclick={downloadActiveImage}
                aria-label="Download image"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>

            {#if isAndroidNativeEnv}
                <button
                    type="button"
                    class="h-9 w-9 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                    onclick={shareActiveImage}
                    aria-label="Share image"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.5" y1="11" x2="15.5" y2="7"></line>
                        <line x1="8.5" y1="13" x2="15.5" y2="17"></line>
                    </svg>
                </button>
            {/if}

            <button
                type="button"
                class="h-9 w-9 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
                onclick={closeImageViewer}
                aria-label="Close image viewer"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>

        <div class="flex-1 flex items-center justify-center overflow-auto">
            <img
                src={imageViewerUrl}
                alt=""
                class={imageViewerFitToScreen ? 'max-w-full max-h-full object-contain' : 'max-w-none max-h-none'}
            />
        </div>
    </div>
{/if}
