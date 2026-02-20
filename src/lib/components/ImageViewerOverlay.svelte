<script lang="ts">
    import { imageViewerState, closeImageViewer, toggleImageViewerFit } from '$lib/stores/imageViewer';
    import { nativeDialogService, isAndroidNative } from '$lib/core/NativeDialogs';
    import { createAndroidShareFileFromUrl, createAndroidDownloadFileFromUrl, cleanupAndroidDecryptedShareFiles } from '$lib/core/MediaShare';
    import Button from '$lib/components/ui/Button.svelte';

    const isAndroidNativeEnv = $derived(isAndroidNative());
    let { url: imageViewerUrl, originalUrl: imageViewerOriginalUrl, fitToScreen: imageViewerFitToScreen } = $derived($imageViewerState);

    const overlayIconButtonClass = "!text-[rgb(var(--color-base-rgb))] dark:!text-[rgb(var(--color-text-rgb)/0.92)] !bg-[rgb(var(--color-lavender-rgb)/0.24)] hover:!bg-[rgb(var(--color-lavender-rgb)/0.30)] active:!bg-[rgb(var(--color-lavender-rgb)/0.36)] pointer-events-auto";

    let scale = $state(1);
    let translateX = $state(0);
    let translateY = $state(0);
    let isPinching = false;
    let initialDistance = 0;
    let initialScale = 1;
    let panStartX = 0;
    let panStartY = 0;
    let initialTranslateX = 0;
    let initialTranslateY = 0;
    let lastTapTime = 0;
    let viewerContainer = $state<HTMLDivElement | null>(null);
    let containerWidth = 0;
    let containerHeight = 0;

    function resetTransform() {
        scale = 1;
        translateX = 0;
        translateY = 0;
    }

    function updateContainerSize() {
        if (!viewerContainer) {
            containerWidth = 0;
            containerHeight = 0;
            return;
        }

        const rect = viewerContainer.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
    }

    function clampTranslation(x: number, y: number): { x: number; y: number } {
        if (containerWidth <= 0 || containerHeight <= 0 || scale <= 1) {
            return { x, y };
        }

        const maxX = ((scale - 1) * containerWidth) / 2;
        const maxY = ((scale - 1) * containerHeight) / 2;

        const clampedX = Math.max(-maxX, Math.min(maxX, x));
        const clampedY = Math.max(-maxY, Math.min(maxY, y));

        return { x: clampedX, y: clampedY };
    }

    function handleTouchStart(event: TouchEvent) {
        if (!isAndroidNativeEnv) {
            return;
        }

        if (event.touches.length === 2) {
            event.preventDefault();
            isPinching = true;
            updateContainerSize();

            const [touchA, touchB] = [event.touches[0], event.touches[1]];
            const dx = touchA.clientX - touchB.clientX;
            const dy = touchA.clientY - touchB.clientY;
            initialDistance = Math.hypot(dx, dy) || 1;
            initialScale = scale;
        } else if (event.touches.length === 1 && scale > 1) {
            event.preventDefault();
            const touch = event.touches[0];
            panStartX = touch.clientX;
            panStartY = touch.clientY;
            initialTranslateX = translateX;
            initialTranslateY = translateY;
            updateContainerSize();
        }
    }

    function handleTouchMove(event: TouchEvent) {
        if (!isAndroidNativeEnv) {
            return;
        }

        if (isPinching && event.touches.length === 2) {
            event.preventDefault();

            const [touchA, touchB] = [event.touches[0], event.touches[1]];
            const dx = touchA.clientX - touchB.clientX;
            const dy = touchA.clientY - touchB.clientY;
            const distance = Math.hypot(dx, dy) || 1;

            const rawScale = (initialScale * distance) / initialDistance;
            const minScale = 1;
            const maxScale = 4;
            scale = Math.min(maxScale, Math.max(minScale, rawScale));

            const clamped = clampTranslation(translateX, translateY);
            translateX = clamped.x;
            translateY = clamped.y;
        } else if (!isPinching && scale > 1 && event.touches.length === 1) {
            event.preventDefault();

            const touch = event.touches[0];
            const deltaX = touch.clientX - panStartX;
            const deltaY = touch.clientY - panStartY;

            const nextX = initialTranslateX + deltaX;
            const nextY = initialTranslateY + deltaY;
            const clamped = clampTranslation(nextX, nextY);
            translateX = clamped.x;
            translateY = clamped.y;
        }
    }

    function handleTouchEnd(event: TouchEvent) {
        if (!isAndroidNativeEnv) {
            return;
        }

        if (event.touches.length === 0) {
            if (scale <= 1.01) {
                resetTransform();
            } else {
                const clamped = clampTranslation(translateX, translateY);
                translateX = clamped.x;
                translateY = clamped.y;
            }

            if (!isPinching && event.changedTouches.length === 1) {
                const now = event.timeStamp;
                if (now - lastTapTime < 250) {
                    if (scale > 1.01 || Math.abs(translateX) > 1 || Math.abs(translateY) > 1) {
                        resetTransform();
                    }
                    lastTapTime = 0;
                } else {
                    lastTapTime = now;
                }
            }

            isPinching = false;
        }
    }

    $effect(() => {
        if (!imageViewerUrl) {
            resetTransform();
        }
    });

    $effect(() => {
        if (imageViewerFitToScreen) {
            resetTransform();
        }
    });

    async function downloadActiveImage() {
        if (!imageViewerUrl || typeof window === 'undefined') {
            return;
        }
 
        const filenameFromOriginal = (() => {
            if (!imageViewerOriginalUrl) {
                return 'image';
            }
            try {
                const parsed = new URL(imageViewerOriginalUrl, window.location.origin);
                const segments = parsed.pathname.split('/');
                const lastSegment = segments[segments.length - 1];
                return lastSegment || 'image';
            } catch {
                return 'image';
            }
        })();
 
        // Android native: use Filesystem to write a decrypted file to Documents
        if (isAndroidNativeEnv && imageViewerUrl.startsWith('blob:')) {
            try {
                const uri = await createAndroidDownloadFileFromUrl(imageViewerUrl, filenameFromOriginal);
 
                // Inform the user that the image has been saved. Exact path handling
                // depends on Android version and Documents visibility.
                await nativeDialogService.alert({
                    title: 'Image saved',
                    message: 'Image has been saved to device storage.'
                });
 
                return;
            } catch (e) {
                console.error('Android download via Filesystem failed, falling back to browser download:', e);
            }
        }
 
        // Default: browser-style download using an anchor element
        try {
            const anchor = document.createElement('a');
 
            if (imageViewerUrl.startsWith('blob:')) {
                anchor.href = imageViewerUrl;
                anchor.download = filenameFromOriginal;
            } else {
                const response = await fetch(imageViewerUrl);
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                anchor.href = objectUrl;
 
                anchor.download = filenameFromOriginal;
 
                anchor.addEventListener('click', () => {
                    setTimeout(() => {
                        URL.revokeObjectURL(objectUrl);
                    }, 0);
                });
            }
 
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
        } catch (e) {
            console.error('Failed to download image from viewer:', e);
        }
    }


    async function shareActiveImage() {
        if (!imageViewerUrl || !isAndroidNativeEnv) {
            return;
        }

        try {
            // Best-effort cleanup of previous decrypted share files before creating a new one
            await cleanupAndroidDecryptedShareFiles();

            const filename = `image-${Date.now()}.jpg`;
            const uri = await createAndroidShareFileFromUrl(imageViewerUrl, filename);

            await nativeDialogService.share({
                files: [uri],
                text: 'Shared from nospeak'
            });
        } catch (e) {
            console.error('Failed to share image from viewer:', e);

            try {
                await nativeDialogService.alert({
                    title: 'Share failed',
                    message: 'Could not share this image. Please try again.'
                });
            } catch {
                // Ignore alert failures
            }
        }
    }
</script>

{#if imageViewerUrl}
    <div
        class="fixed inset-0 z-[100] bg-black/80 flex flex-col"
        role="dialog"
        aria-modal="true"
    >
        <div class={`absolute top-0 left-0 right-0 z-10 flex items-center justify-end gap-2 p-3 text-white pointer-events-none ${isAndroidNativeEnv ? 'pt-12' : ''}`}>
            {#if !isAndroidNativeEnv}
                <Button
                    size="icon"
                    class={overlayIconButtonClass}
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
                </Button>
            {/if}

            <Button
                size="icon"
                class={overlayIconButtonClass}
                onclick={downloadActiveImage}
                aria-label="Download image"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </Button>

            {#if isAndroidNativeEnv}
                <Button
                    size="icon"
                    class={overlayIconButtonClass}
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
                </Button>
            {/if}

            <Button
                size="icon"
                class={overlayIconButtonClass}
                onclick={closeImageViewer}
                aria-label="Close image viewer"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </Button>
        </div>

        <div
            class={isAndroidNativeEnv ? 'flex-1 flex items-center justify-center overflow-hidden' : `flex-1 overflow-auto ${imageViewerFitToScreen ? 'flex items-center justify-center' : ''}`}
            role="application"
            bind:this={viewerContainer}
            ontouchstart={handleTouchStart}
            ontouchmove={handleTouchMove}
            ontouchend={handleTouchEnd}
            ontouchcancel={handleTouchEnd}
            style={isAndroidNativeEnv ? 'touch-action: none;' : ''}
        >
            <img
                src={imageViewerUrl}
                alt=""
                class={imageViewerFitToScreen ? 'max-w-full max-h-full object-contain' : 'max-w-none max-h-none m-auto block'}
                style={`transform: translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}); transform-origin: center center;`}
            />
        </div>
    </div>
{/if}
