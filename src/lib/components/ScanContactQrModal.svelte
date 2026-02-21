<script lang="ts">
    import QRCode from 'qrcode';
    import { fade } from 'svelte/transition';

    import Avatar from '$lib/components/Avatar.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Tab from '$lib/components/ui/Tab.svelte';
    import { isAndroidNative } from '$lib/core/NativeDialogs';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { currentUser } from '$lib/stores/auth';
    import { openScanContactQrResult } from '$lib/stores/modals';
    import { glassModal } from '$lib/utils/transitions';
    import { decodeQrFromImageData, parseNpubFromQrPayload } from '$lib/utils/qr';
    import { hapticSelection } from '$lib/utils/haptics';
    import { t } from '$lib/i18n';

    type ScanStatus =
        | 'idle'
        | 'scanning'
        | 'found'
        | 'invalid'
        | 'camera-error'
        | 'add-error'
        | 'added';

    type QrTab = 'myQr' | 'scan';

    let {
        isOpen,
        close,
        defaultTab = 'scan'
    } = $props<{ isOpen: boolean; close: () => void; defaultTab?: QrTab }>();

    const isAndroidApp = isAndroidNative();

    let activeTab = $state<QrTab>('scan');
    let prevIsOpen = $state(false);

    // "My QR" state
    let qrCanvas = $state<HTMLCanvasElement | null>(null);
    let qrValue = $state<string>('');
    let displayName = $state<string>('');
    let picture = $state<string | undefined>(undefined);
    let loading = $state(false);

    // "Scan QR" state
    let videoEl = $state<HTMLVideoElement | null>(null);
    let scanCanvasEl = $state<HTMLCanvasElement | null>(null);
    let scanActive = $state(false);
    let status = $state<ScanStatus>('idle');
    let stream: MediaStream | null = null;

    async function loadProfileAndQr(): Promise<void> {
        const user = $currentUser;
        if (!user?.npub || !qrCanvas) {
            return;
        }

        loading = true;

        try {
            const profile = await profileRepo.getProfileIgnoreTTL(user.npub);

            if (profile?.metadata) {
                displayName =
                    profile.metadata.name ||
                    profile.metadata.display_name ||
                    (profile.metadata as any).displayName ||
                    user.npub.slice(0, 10) + '...';
                picture = profile.metadata.picture;
            } else {
                displayName = user.npub.slice(0, 10) + '...';
                picture = undefined;
            }

            qrValue = `nostr:${user.npub}`;

            await QRCode.toCanvas(qrCanvas, qrValue, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (e) {
            console.error('ScanContactQrModal: failed to prepare user QR', e);
        } finally {
            loading = false;
        }
    }

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
        if (!scanActive || !videoEl || !scanCanvasEl) {
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

        const ctx = scanCanvasEl.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            if (scanActive) {
                requestAnimationFrame(scanLoop);
            }
            return;
        }

        scanCanvasEl.width = width;
        scanCanvasEl.height = height;

        ctx.drawImage(videoEl, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const raw = decodeQrFromImageData(imageData);

        if (raw) {
            const npub = parseNpubFromQrPayload(raw);

            if (npub) {
                scanActive = false;
                stopCamera();
                openScanContactQrResult(npub);
                closeWithCleanup();
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
            hapticSelection();
            closeWithCleanup();
        }
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            hapticSelection();
            closeWithCleanup();
        }
    }

    function closeWithCleanup(): void {
        stopCamera();
        status = 'idle';
        qrValue = '';
        loading = false;
        close();
    }

    // Initialize tab on open
    $effect(() => {
        if (isOpen && !prevIsOpen) {
            activeTab = defaultTab;
        }

        prevIsOpen = isOpen;
    });

    // Start/stop camera and load QR based on tab
    $effect(() => {
        if (!isOpen) {
            stopCamera();
            status = 'idle';
            qrValue = '';
            displayName = '';
            picture = undefined;
            loading = false;
            return;
        }

        if (activeTab === 'scan') {
            if (!scanActive && status !== 'added' && status !== 'add-error') {
                startCamera();
            }
            return;
        }

        // activeTab === 'myQr'
        stopCamera();
        status = 'idle';
        void loadProfileAndQr();
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
            <Button
                onclick={closeWithCleanup}
                aria-label="Close modal"
                size="icon"
                class="absolute top-4 end-4 z-10"
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
            </Button>

            <div class="mb-3">
                <h2 class="typ-title dark:text-white">{$t('modals.qr.title')}</h2>
            </div>

            <Tab
                bind:value={activeTab}
                ariaLabel={$t('modals.qr.title')}
                tabs={[
                    { value: 'myQr', label: $t('modals.qr.tabs.myQr') },
                    { value: 'scan', label: $t('modals.qr.tabs.scanQr') }
                ]}
            />

            <div class="grid mt-5">
                <div
                    class="col-start-1 row-start-1"
                    class:invisible={activeTab !== 'myQr'}
                    aria-hidden={activeTab !== 'myQr'}
                >
                    <div class="flex items-center gap-3 mb-6">
                        <Avatar
                            npub={$currentUser?.npub || ''}
                            src={picture}
                            size="md"
                            class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
                        />
                        <div class="flex flex-col flex-1 min-w-0">
                            <div class="text-base font-semibold text-gray-900 dark:text-white">
                                {displayName || $currentUser?.npub?.slice(0, 10) + '...'}
                            </div>
                            {#if $currentUser?.npub}
                                <div class="text-[11px] text-gray-500 dark:text-slate-400 font-mono break-all select-all">
                                    nostr:{$currentUser.npub}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="flex justify-center mb-2">
                        <div class="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-inner border border-gray-200/70 dark:border-slate-700/70">
                            <canvas bind:this={qrCanvas}></canvas>
                        </div>
                    </div>

                    <p class="mt-4 text-xs text-center text-gray-500 dark:text-slate-400">
                        {$t('modals.userQr.hint')}
                    </p>

                    {#if loading}
                        <div class="mt-2 text-xs text-center text-gray-500 dark:text-slate-400">
                            {$t('modals.userQr.preparing')}
                        </div>
                    {/if}
                </div>

                <div
                    class="col-start-1 row-start-1"
                    class:invisible={activeTab !== 'scan'}
                    aria-hidden={activeTab !== 'scan'}
                >
                    <p class="mb-3 text-xs text-gray-600 dark:text-slate-300">
                        {$t('modals.scanContactQr.instructions')}
                    </p>

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

                        <canvas bind:this={scanCanvasEl} class="hidden"></canvas>
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
                </div>
            </div>
        </div>
    </div>
{/if}
