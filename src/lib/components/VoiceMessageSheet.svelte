<script lang="ts">
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';

    import { Capacitor } from '@capacitor/core';
    import type { PluginListenerHandle } from '@capacitor/core';

    import Button from '$lib/components/ui/Button.svelte';
    import WaveformBars from '$lib/components/WaveformBars.svelte';
    import { nativeDialogService } from '$lib/core/NativeDialogs';
    import { clamp01, downsamplePeaks } from '$lib/core/Waveform';
    import {
        formatDurationMs,
        getSupportedOpusMimeType,
        isVoiceDurationExceeded,
        VOICE_MESSAGE_MAX_DURATION_MS
    } from '$lib/core/VoiceRecorder';
    import { AndroidMicrophone } from '$lib/core/AndroidMicrophone';

    import { t } from '$lib/i18n';

    const translate = (key: string, vars?: Record<string, unknown>) =>
        (get(t) as (k: string, v?: Record<string, unknown>) => string)(key, vars);

    type RecordingState = 'idle' | 'recording' | 'paused' | 'ready' | 'error';

    let {
        isOpen,
        onCancel,
        onClose,
        onSend,
        maxDurationMs = VOICE_MESSAGE_MAX_DURATION_MS
    } = $props<{
        isOpen: boolean;
        onCancel: () => void;
        onClose: () => void;
        onSend: (file: File) => void;
        maxDurationMs?: number;
    }>();

    const effectiveMaxDurationMs = $derived(
        isFinite(maxDurationMs) && maxDurationMs > 0 ? maxDurationMs : VOICE_MESSAGE_MAX_DURATION_MS
    );

    // Determine if we should use native Android recording
    const useNativeRecording = Capacitor.getPlatform() === 'android' && AndroidMicrophone !== null;

    let recordingState = $state<RecordingState>('idle');
    let error: string | null = $state(null);

    // WebView recording state (used when useNativeRecording is false)
    let stream: MediaStream | null = $state(null);
    let mediaRecorder: MediaRecorder | null = $state(null);
    let mimeType: string | null = $state(null);
    let chunks: BlobPart[] = [];
    let ignoreNextDataAvailable = false;
    let audioContext: AudioContext | null = $state(null);
    let analyser: AnalyserNode | null = $state(null);

    // Native recording state (used when useNativeRecording is true)
    let nativeFilePath: string | null = $state(null);
    let peakListener: PluginListenerHandle | null = $state(null);
    let errorListener: PluginListenerHandle | null = $state(null);

    // Shared state
    const WAVEFORM_BAR_COUNT = 40;
    let rawPeaks = $state<number[]>([]);

    let previewDuration = $state(0);
    let previewCurrentTime = $state(0);

    let startedAtMs: number | null = $state(null);
    let pausedAtMs: number | null = $state(null);
    let pausedTotalMs = $state(0);
    let elapsedMs = $state(0);
    let ticker: number | null = $state(null);

    let recordedBlob: Blob | null = $state(null);
    let recordedUrl: string | null = $state(null);

    let previewAudio = $state<HTMLAudioElement | null>(null);
    let isPreviewPlaying = $state(false);
    let previewRafId: number | null = $state(null);
    let isStopping = $state(false);

    // ─────────────────────────────────────────────────────────────────────────────
    // Cleanup helpers
    // ─────────────────────────────────────────────────────────────────────────────

    function stopTracks(): void {
        for (const track of stream?.getTracks() ?? []) {
            try {
                track.stop();
            } catch {
                // ignore
            }
        }
        stream = null;
    }

    function cleanupPreview(): void {
        stopPreviewSync();

        try {
            previewAudio?.pause();
        } catch {
            // ignore
        }

        if (recordedUrl && recordedUrl.startsWith('blob:')) {
            URL.revokeObjectURL(recordedUrl);
        }
        recordedUrl = null;
        recordedBlob = null;
        previewDuration = 0;
        previewCurrentTime = 0;
        isPreviewPlaying = false;
    }

    async function cleanupNativeListeners(): Promise<void> {
        if (peakListener) {
            try {
                await peakListener.remove();
            } catch {
                // ignore
            }
            peakListener = null;
        }
        if (errorListener) {
            try {
                await errorListener.remove();
            } catch {
                // ignore
            }
            errorListener = null;
        }
    }

    async function cleanup(): Promise<void> {
        if (ticker) {
            clearInterval(ticker);
            ticker = null;
        }

        cleanupPreview();

        // Cleanup native recording
        await cleanupNativeListeners();
        nativeFilePath = null;

        // Cleanup WebView recording
        if (audioContext) {
            try {
                await audioContext.close();
            } catch {
                // ignore
            }
            audioContext = null;
        }

        analyser = null;

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try {
                mediaRecorder.stop();
            } catch {
                // ignore
            }
        }
        mediaRecorder = null;

        stopTracks();

        chunks = [];
        ignoreNextDataAvailable = false;
        mimeType = null;
        startedAtMs = null;
        pausedAtMs = null;
        pausedTotalMs = 0;
        elapsedMs = 0;
        isStopping = false;
        recordingState = 'idle';
        error = null;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // WebView recording helpers
    // ─────────────────────────────────────────────────────────────────────────────

    function samplePeakFromAnalyser(): number | null {
        if (!analyser) {
            return null;
        }

        const bufferLength = analyser.fftSize;
        const data = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(data);

        let max = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = Math.abs((data[i] - 128) / 128);
            if (v > max) {
                max = v;
            }
        }

        // Use the same scaling as playback visualization (Waveform.ts)
        return clamp01(0.08 + max * 1.15);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ─────────────────────────────────────────────────────────────────────────────

    function computeElapsedMs(nowMs: number): number {
        if (startedAtMs === null) {
            return 0;
        }

        if (recordingState === 'paused' && pausedAtMs !== null) {
            return pausedAtMs - startedAtMs - pausedTotalMs;
        }

        return nowMs - startedAtMs - pausedTotalMs;
    }

    function stopTicker(): void {
        if (!ticker) {
            return;
        }
        try {
            clearInterval(ticker);
        } catch {
            // ignore
        }
        ticker = null;
    }

    function startTicker(): void {
        stopTicker();

        ticker = window.setInterval(() => {
            // Ensure the recording timer does not run past "Done".
            if (recordingState !== 'recording' && recordingState !== 'paused') {
                stopTicker();
                return;
            }

            const nextElapsed = computeElapsedMs(Date.now());
            elapsedMs = nextElapsed;

            if (recordingState === 'recording') {
                // For WebView recording, sample peaks from analyser
                if (!useNativeRecording) {
                    const peak = samplePeakFromAnalyser();
                    if (peak !== null) {
                        const nextPeaks = [...rawPeaks, peak];
                        rawPeaks = nextPeaks.length > 4096 ? nextPeaks.slice(nextPeaks.length - 4096) : nextPeaks;
                    }
                }

                if (isVoiceDurationExceeded(nextElapsed, effectiveMaxDurationMs)) {
                    void stopRecording();
                }
            }
        }, 125);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Start recording
    // ─────────────────────────────────────────────────────────────────────────────

    async function startRecording(): Promise<void> {
        if (!isOpen) {
            return;
        }

        console.info('[voice] startRecording: begin', {
            platform: Capacitor.getPlatform(),
            useNativeRecording
        });

        if (useNativeRecording) {
            await startNativeRecording();
        } else {
            await startWebRecording();
        }
    }

    async function startNativeRecording(): Promise<void> {
        if (!AndroidMicrophone) {
            error = 'Native recording not available.';
            recordingState = 'error';
            return;
        }

        // Request permission
        console.info('[voice] requesting Android RECORD_AUDIO permission');
        const { granted } = await AndroidMicrophone.requestPermission();
        console.info('[voice] Android RECORD_AUDIO permission result', { granted });

        if (!granted) {
            await nativeDialogService.alert({
                title: translate('chat.voiceMessage.permissionDeniedTitle'),
                message: translate('chat.voiceMessage.permissionDeniedMessage')
            });
            onCancel();
            return;
        }

        try {
            // Set up listeners for peak events
            peakListener = await AndroidMicrophone.addListener('waveformPeak', ({ peak }) => {
                const nextPeaks = [...rawPeaks, peak];
                rawPeaks = nextPeaks.length > 4096 ? nextPeaks.slice(nextPeaks.length - 4096) : nextPeaks;
            });

            errorListener = await AndroidMicrophone.addListener('recordingError', ({ error: errMsg }) => {
                console.error('[voice] native recording error:', errMsg);
                error = errMsg || 'Recording failed.';
                recordingState = 'error';
            });

            // Start native recording
            console.info('[voice] starting native recording');
            const result = await AndroidMicrophone.startRecording();

            if (!result.success) {
                throw new Error(result.error || 'Failed to start recording');
            }

            mimeType = 'audio/mp4';
            rawPeaks = [];

            startedAtMs = Date.now();
            pausedAtMs = null;
            pausedTotalMs = 0;
            elapsedMs = 0;

            recordingState = 'recording';
            startTicker();

            console.info('[voice] native recording started');

        } catch (e) {
            console.error('[voice] startNativeRecording: failed', e);
            await cleanupNativeListeners();

            const err = e as any;
            const message =
                (typeof err?.message === 'string' && err.message) ||
                'Failed to start recording.';

            await nativeDialogService.alert({
                title: 'Microphone',
                message
            });
            onCancel();
        }
    }

    async function startWebRecording(): Promise<void> {
        const supportedMime = getSupportedOpusMimeType();
        console.info('[voice] detected supported mime', { supportedMime });

        if (!supportedMime) {
            error = 'Voice recording unsupported on this device.';
            recordingState = 'error';
            console.warn('[voice] startRecording: no supported mime');
            return;
        }

        // Request permission on Android (for WebChromeClient)
        if (Capacitor.getPlatform() === 'android' && AndroidMicrophone) {
            console.info('[voice] requesting Android RECORD_AUDIO permission');
            const { granted } = await AndroidMicrophone.requestPermission();
            console.info('[voice] Android RECORD_AUDIO permission result', { granted });
            if (!granted) {
                await nativeDialogService.alert({
                    title: translate('chat.voiceMessage.permissionDeniedTitle'),
                    message: translate('chat.voiceMessage.permissionDeniedMessage')
                });
                onCancel();
                return;
            }
        }

        try {
            mimeType = supportedMime;

            console.info('[voice] calling getUserMedia');
            const captured = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.info('[voice] getUserMedia: success', {
                tracks: captured.getTracks().map((track) => ({
                    kind: track.kind,
                    label: track.label,
                    enabled: track.enabled,
                    muted: (track as any).muted,
                    readyState: track.readyState
                }))
            });

            stream = captured;

            console.info('[voice] creating MediaRecorder', { mimeType: supportedMime });
            const recorder = new MediaRecorder(captured, { mimeType: supportedMime });

            recorder.onstart = () => {
                console.info('[voice] MediaRecorder: start', { state: recorder.state });
            };

            recorder.onstop = () => {
                console.info('[voice] MediaRecorder: stop', { state: recorder.state, chunks: chunks.length });
            };

            chunks = [];
            ignoreNextDataAvailable = false;
            recorder.ondataavailable = (e) => {
                if (ignoreNextDataAvailable) {
                    ignoreNextDataAvailable = false;
                    return;
                }

                console.info('[voice] MediaRecorder: dataavailable', { size: e.data?.size });

                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onerror = (event) => {
                console.error('[voice] MediaRecorder: error', event);
                error = 'Voice recording failed.';
                recordingState = 'error';
            };

            mediaRecorder = recorder;

            console.info('[voice] creating AudioContext + analyser');
            audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(captured);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            rawPeaks = [];

            startedAtMs = Date.now();
            pausedAtMs = null;
            pausedTotalMs = 0;
            elapsedMs = 0;

            console.info('[voice] MediaRecorder.start');
            recorder.start(250);
            recordingState = 'recording';

            startTicker();
            console.info('[voice] web recording started');

        } catch (e) {
            console.error('[voice] startWebRecording: failed', e);

            const err = e as any;
            const message =
                (typeof err?.message === 'string' && err.message) ||
                (typeof err?.name === 'string' && err.name) ||
                'Microphone permission denied.';

            await nativeDialogService.alert({
                title: 'Microphone',
                message
            });
            onCancel();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Pause / Resume
    // ─────────────────────────────────────────────────────────────────────────────

    async function pauseRecording(): Promise<void> {
        if (recordingState !== 'recording') {
            return;
        }

        pausedAtMs = Date.now();

        if (useNativeRecording && AndroidMicrophone) {
            try {
                await AndroidMicrophone.pauseRecording();
                recordingState = 'paused';
                console.info('[voice] native recording paused');
            } catch (e) {
                console.error('[voice] pauseRecording failed', e);
            }
        } else if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
                mediaRecorder.pause();
                recordingState = 'paused';
                void refreshPausedPreview();
            } catch {
                // ignore
            }
        }
    }

    async function resumeRecording(): Promise<void> {
        if (recordingState !== 'paused') {
            return;
        }

        cleanupPreview();

        if (pausedAtMs !== null) {
            pausedTotalMs += Date.now() - pausedAtMs;
        }
        pausedAtMs = null;

        if (useNativeRecording && AndroidMicrophone) {
            try {
                await AndroidMicrophone.resumeRecording();
                recordingState = 'recording';
                console.info('[voice] native recording resumed');
            } catch (e) {
                console.error('[voice] resumeRecording failed', e);
            }
        } else if (mediaRecorder && mediaRecorder.state === 'paused') {
            try {
                mediaRecorder.resume();
                recordingState = 'recording';
            } catch {
                // ignore
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Stop recording
    // ─────────────────────────────────────────────────────────────────────────────

    async function stopRecording(): Promise<void> {
        if (isStopping) {
            return;
        }

        isStopping = true;
        stopTicker();

        const finalElapsed = computeElapsedMs(Date.now());
        elapsedMs = Math.min(finalElapsed, effectiveMaxDurationMs);
        previewDuration = elapsedMs / 1000;
        previewCurrentTime = 0;

        if (useNativeRecording && AndroidMicrophone) {
            await stopNativeRecording();
        } else {
            await stopWebRecording();
        }

        isStopping = false;
    }

    async function stopNativeRecording(): Promise<void> {
        if (!AndroidMicrophone) {
            return;
        }

        try {
            console.info('[voice] stopping native recording');
            const result = await AndroidMicrophone.stopRecording();
            console.info('[voice] native recording stopped', result);

            nativeFilePath = result.filePath;

            // Read file using Capacitor Filesystem (fetch doesn't work for file:// in WebView)
            console.info('[voice] reading file via Filesystem');
            const fs = (window as any).Capacitor?.Plugins?.Filesystem;
            if (!fs) {
                throw new Error('Filesystem plugin not available');
            }

            const fileResult = await fs.readFile({ path: result.filePath });

            // fileResult.data is base64 encoded - convert to Blob
            const base64Data = fileResult.data as string;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            recordedBlob = new Blob([bytes], { type: 'audio/mp4' });
            recordedUrl = URL.createObjectURL(recordedBlob);
            recordingState = 'ready';

            console.info('[voice] file read successfully, blob size:', recordedBlob.size);

            await cleanupNativeListeners();

        } catch (e) {
            console.error('[voice] stopNativeRecording failed', e);
            error = 'Failed to stop recording.';
            recordingState = 'error';
        }
    }

    async function stopWebRecording(): Promise<void> {
        if (!mediaRecorder) {
            return;
        }

        if (mediaRecorder.state === 'inactive') {
            return;
        }

        const blob = await new Promise<Blob>((resolve) => {
            const recorder = mediaRecorder!;

            const onStop = () => {
                recorder.removeEventListener('stop', onStop);
                resolve(new Blob(chunks, { type: mimeType ?? 'audio/webm' }));
            };

            recorder.addEventListener('stop', onStop);

            try {
                recorder.stop();
            } catch {
                recorder.removeEventListener('stop', onStop);
                resolve(new Blob(chunks, { type: mimeType ?? 'audio/webm' }));
            }
        });

        recordedBlob = blob;
        if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
        }
        recordedUrl = URL.createObjectURL(blob);
        recordingState = 'ready';

        stopTracks();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Preview helpers (WebView recording only)
    // ─────────────────────────────────────────────────────────────────────────────

    async function refreshPausedPreview(): Promise<void> {
        if (!mediaRecorder || !mimeType || chunks.length === 0) {
            return;
        }

        cleanupPreview();

        const recorder = mediaRecorder;
        ignoreNextDataAvailable = true;

        await new Promise<void>((resolve) => {
            let resolved = false;

            const finish = (extraData?: Blob) => {
                if (resolved) return;
                resolved = true;

                if (extraData && extraData.size > 0) {
                    chunks.push(extraData);
                }

                if (ignoreNextDataAvailable) {
                    ignoreNextDataAvailable = false;
                }

                const blob = new Blob(chunks, { type: mimeType ?? 'audio/webm' });
                recordedUrl = URL.createObjectURL(blob);
                resolve();
            };

            const timeoutId = window.setTimeout(() => finish(), 300);

            const handleData = (e: BlobEvent) => {
                recorder.removeEventListener('dataavailable', handleData);
                clearTimeout(timeoutId);
                finish(e.data);
            };

            recorder.addEventListener('dataavailable', handleData);

            try {
                recorder.requestData();
            } catch {
                recorder.removeEventListener('dataavailable', handleData);
                clearTimeout(timeoutId);
                finish();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Send
    // ─────────────────────────────────────────────────────────────────────────────

    async function handleSend(): Promise<void> {
        if (recordingState === 'recording' || recordingState === 'paused') {
            await stopRecording();
        }

        if (recordingState !== 'ready' || !recordedBlob) {
            return;
        }

        const file = new File([recordedBlob], `voice-${Date.now()}.bin`, {
            type: mimeType ?? recordedBlob.type ?? 'audio/mp4'
        });

        onSend(file);

        // Delete native recording file after sending
        if (useNativeRecording && AndroidMicrophone && nativeFilePath) {
            try {
                await AndroidMicrophone.deleteRecordingFile({ filePath: nativeFilePath });
                console.info('[voice] deleted native recording file');
            } catch (e) {
                console.warn('[voice] failed to delete native recording file', e);
            }
        }

        onClose();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Preview controls
    // ─────────────────────────────────────────────────────────────────────────────

    function stopPreviewSync(): void {
        if (previewRafId === null) {
            return;
        }
        try {
            window.cancelAnimationFrame(previewRafId);
        } catch {
            // ignore
        }
        previewRafId = null;
    }

    function startPreviewSync(): void {
        stopPreviewSync();

        const tick = () => {
            if (!previewAudio) {
                previewRafId = null;
                return;
            }

            previewCurrentTime = previewAudio.currentTime || 0;

            if (!previewAudio.paused && !previewAudio.ended) {
                previewRafId = window.requestAnimationFrame(tick);
            } else {
                previewRafId = null;
            }
        };

        previewRafId = window.requestAnimationFrame(tick);
    }

    function togglePreview(): void {
        if (!previewAudio) {
            return;
        }

        if (previewAudio.paused) {
            previewAudio.play().catch(() => undefined);
        } else {
            previewAudio.pause();
        }
    }

    function handlePreviewPlay(): void {
        isPreviewPlaying = true;
        startPreviewSync();
    }

    function handlePreviewPause(): void {
        isPreviewPlaying = false;
        stopPreviewSync();
    }

    function handlePreviewLoadedMetadata(): void {
        if (!previewAudio) {
            return;
        }
        const audioDuration = previewAudio.duration;
        // WebM blobs without proper headers return Infinity or NaN
        if (isFinite(audioDuration) && audioDuration > 0) {
            previewDuration = audioDuration;
        } else {
            // Fall back to recorded elapsed time
            previewDuration = elapsedMs / 1000;
        }
    }

    function handlePreviewTimeUpdate(): void {
        if (!previewAudio) {
            return;
        }
        previewCurrentTime = previewAudio.currentTime || 0;
    }

    function handlePreviewEnded(): void {
        isPreviewPlaying = false;
        stopPreviewSync();
        previewCurrentTime = previewDuration;
    }

    function handlePreviewSeek(nextProgress: number): void {
        if (!previewAudio || previewDuration <= 0) {
            return;
        }

        const clamped = clamp01(nextProgress);
        previewAudio.currentTime = clamped * previewDuration;
        previewCurrentTime = previewAudio.currentTime || 0;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UI event handlers
    // ─────────────────────────────────────────────────────────────────────────────

    function handleOverlayClick(e: MouseEvent): void {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            onCancel();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────────

    $effect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!isOpen) {
            void cleanup();
            return;
        }

        if (recordingState === 'idle') {
            void startRecording();
        }
    });

    onDestroy(() => {
        void cleanup();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Derived state
    // ─────────────────────────────────────────────────────────────────────────────

    const timerLabel = $derived(formatDurationMs(elapsedMs));
    // Native recording: show "Done" button instead of "Pause"
    const canPause = $derived(recordingState === 'recording' && !useNativeRecording);
    const canDone = $derived(recordingState === 'recording' && useNativeRecording);
    // Native recording: no resume (Done = finalize)
    const canResume = $derived(recordingState === 'paused' && !useNativeRecording);
    // Native recording: preview only in 'ready' state (after Done)
    const canPreview = $derived(
        (useNativeRecording
            ? recordingState === 'ready'
            : (recordingState === 'paused' || recordingState === 'ready')
        ) && !!recordedUrl
    );

    const waveformPeaks = $derived(downsamplePeaks(rawPeaks, WAVEFORM_BAR_COUNT));
    const previewProgress = $derived(previewDuration > 0 ? clamp01(previewCurrentTime / previewDuration) : 0);
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 px-0 md:px-4"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div
            class="relative w-full bg-white/95 dark:bg-slate-900/95 border border-gray-200/80 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl p-4 space-y-4 rounded-t-3xl md:max-w-md md:rounded-2xl"
        >
            <div class="flex items-center justify-between">
                <h2 class="typ-title dark:text-white">Voice message</h2>

                <div class="typ-meta text-xs tabular-nums text-gray-600 dark:text-slate-300">
                    {timerLabel} / {formatDurationMs(effectiveMaxDurationMs)}
                </div>
            </div>

            {#if error}
                <div class="typ-body text-sm text-red-600 dark:text-red-300">{error}</div>
            {/if}

            <div class="rounded-xl bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 px-4 py-4">
                <WaveformBars
                    peaks={waveformPeaks}
                    barCount={WAVEFORM_BAR_COUNT}
                    heightPx={40}
                    progress={canPreview ? previewProgress : 0}
                    seekable={canPreview}
                    onSeek={handlePreviewSeek}
                    playedClass="bg-blue-500/90 dark:bg-blue-400/90"
                    unplayedClass="bg-blue-300/60 dark:bg-blue-200/50"
                />

                {#if canPreview}
                    <div class="mt-3 flex items-center justify-center gap-3">
                        <Button
                            size="icon"
                            variant="filled-tonal"
                            onclick={togglePreview}
                            aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                        >
                            {#if isPreviewPlaying}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="6" y="4" width="4" height="16" />
                                    <rect x="14" y="4" width="4" height="16" />
                                </svg>
                            {:else}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="8 5 19 12 8 19 8 5" />
                                </svg>
                            {/if}
                        </Button>
                        <span class="typ-meta text-xs tabular-nums text-gray-600 dark:text-slate-300">
                            {formatDurationMs(previewCurrentTime * 1000)} / {formatDurationMs(previewDuration * 1000)}
                        </span>
                    </div>
                {/if}
            </div>

            <!-- Audio element always rendered to avoid bind:this race condition -->
            <!-- svelte-ignore a11y_media_has_caption -->
            <audio
                bind:this={previewAudio}
                src={recordedUrl ?? ''}
                class="sr-only"
                onloadedmetadata={handlePreviewLoadedMetadata}
                ontimeupdate={handlePreviewTimeUpdate}
                onplay={handlePreviewPlay}
                onpause={handlePreviewPause}
                onended={handlePreviewEnded}
            ></audio>

            <div class="flex items-center justify-between gap-2">
                <Button onclick={onCancel} disabled={isStopping}>
                    Cancel
                </Button>

                <div class="flex items-center gap-2">
                    {#if canPause}
                        <Button onclick={() => void pauseRecording()} disabled={isStopping}>
                            Pause
                        </Button>
                    {:else if canDone}
                        <Button onclick={() => void stopRecording()} disabled={isStopping}>
                            Done
                        </Button>
                    {:else if canResume}
                        <Button onclick={() => void resumeRecording()} disabled={isStopping}>
                            Resume
                        </Button>
                    {/if}

                    <Button
                        variant="primary"
                        onclick={() => void handleSend()}
                        disabled={isStopping || recordingState === 'error'}
                    >
                        Send
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/if}
