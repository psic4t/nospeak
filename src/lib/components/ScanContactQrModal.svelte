<script lang="ts">
    import { fade } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { isAndroidNative } from '$lib/core/NativeDialogs';
    import { decodeQrFromImageData, parseNpubFromQrPayload } from '$lib/utils/qr';
    import { openScanContactQrResult } from '$lib/stores/modals';
    import { t } from '$lib/i18n';

    type ScanStatus =
        | 'idle'
        | 'scanning'
        | 'found'
        | 'invalid'
        | 'camera-error'
        | 'add-error'
        | 'added';

    let { isOpen, close } = $props<{ isOpen: boolean; close: () => void }>();

    const isAndroidApp = isAndroidNative();

    let videoEl = $state<HTMLVideoElement | null>(null);
    let canvasEl = $state<HTMLCanvasElement | null>(null);
    let scanActive = $state(false);
    let status = $state<ScanStatus>('idle');
    let stream: MediaStream | null = null;


    async function startCamera(): Promise<void> {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            status = 'camera-error';
            return;
        }


        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment'
                }
            });

            stream = mediaStream;

            if (videoEl) {
                videoEl.srcObject = mediaStream;
                try {
                    await videoEl.play();
                } catch {
                    // Ignore play errors; scanning may still work
                }
            }

            scanActive = true;
            status = 'scanning';
            requestAnimationFrame(scanLoop);
        } catch (error) {
            console.error('ScanContactQrModal: failed to start camera', error);
            status = 'camera-error';
        }
    }


    function stopCamera(): void {
        scanActive = false;

        if (stream) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
            stream = null;
        }

        if (videoEl && videoEl.srcObject) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (videoEl as any).srcObject = null;
        }
    }

    async function scanLoop(): Promise<void> {

        if (!scanActive || !videoEl || !canvasEl) {
            return;
        }

        const width = videoEl.videoWidth;
        const height = videoEl.videoHeight;

        if (!width || !height) {
            if (scanActive) {
                requestAnimationFrame(scanLoop);
            }
            return;
        }

        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            if (scanActive) {
                requestAnimationFrame(scanLoop);
            }
            return;
        }

        canvasEl.width = width;
        canvasEl.height = height;

        ctx.drawImage(videoEl, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const raw = decodeQrFromImageData(imageData);
 
        if (raw) {
            const npub = parseNpubFromQrPayload(raw);
 
            if (npub) {
                scanActive = false;
                stopCamera();
                openScanContactQrResult(npub);
                close();
                return;
            }
 
            // QR present but not a valid contact npub
            status = 'invalid';
        }


        if (scanActive) {
            requestAnimationFrame(scanLoop);
        }
    }

    function handleOverlayClick(e: MouseEvent): void {

        if (e.target === e.currentTarget) {
            closeWithCleanup();
        }
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            closeWithCleanup();
        }
    }

    function closeWithCleanup(): void {
        stopCamera();
        status = 'idle';
        close();
    }

    $effect(() => {
        if (!isOpen) {
            stopCamera();
            status = 'idle';
            return;
        }
 
        if (!scanActive && status !== 'added' && status !== 'add-error') {
            startCamera();
        }

    });
</script>

{#if isOpen}
    <div
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class="fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }}
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-sm rounded-3xl flex flex-col shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden relative outline-none p-6"
        >
            <button
                onclick={closeWithCleanup}
                aria-label="Close modal"
                class="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            <div class="mb-4">
                <h2 class="typ-title dark:text-white">{$t('modals.scanContactQr.title')}</h2>
                <p class="mt-1 text-xs text-gray-600 dark:text-slate-300">
                    {$t('modals.scanContactQr.instructions')}
                </p>
            </div>

            <div class="relative rounded-2xl overflow-hidden bg-black/80 border border-gray-800/80 shadow-inner">
                <video
                    bind:this={videoEl}
                    autoplay
                    playsinline
                    muted
                    class="w-full aspect-[3/4] object-cover"
                ></video>

                <!-- Simple scan-line overlay -->
                <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-green-400/70 shadow-[0_0_12px_rgba(34,197,94,0.8)]"></div>

                <!-- Corner markers -->
                <div class="absolute inset-4 pointer-events-none">
                    <div class="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-green-400"></div>
                    <div class="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-green-400"></div>
                    <div class="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-green-400"></div>
                    <div class="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-green-400"></div>
                </div>

                <canvas bind:this={canvasEl} class="hidden"></canvas>
            </div>

            <div class="mt-4 text-xs text-center text-gray-600 dark:text-slate-300 min-h-[1.5rem]">
                {#if status === 'scanning' || status === 'idle'}
                    {$t('modals.scanContactQr.scanning')}
                {:else if status === 'camera-error'}
                    {$t('modals.scanContactQr.noCamera')}
                {:else if status === 'invalid'}
                    {$t('modals.scanContactQr.invalidQr')}
                {:else if status === 'add-error'}
                    {$t('modals.scanContactQr.addFailed')}
                {:else if status === 'added'}
                    {$t('modals.scanContactQr.added')}
                {/if}
            </div>
 
            <div class="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    onclick={closeWithCleanup}
                    class="px-3 py-1.5 text-xs rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-100 border border-gray-200/60 dark:border-slate-600 transition-colors"
                >
                    {$t('common.cancel')}
                </button>
            </div>

        </div>
    </div>
{/if}
