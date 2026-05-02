<script lang="ts">
    import { voiceCallState, resetCall } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_END_DISPLAY_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';
    import { startOutgoingRingback, stopRingtone } from '$lib/core/voiceCall/ringtone';

    let profileName = $state('');
    let profilePicture = $state('');
    let audioEl = $state<HTMLAudioElement>();
    let remoteVideoEl = $state<HTMLVideoElement>();
    let localVideoEl = $state<HTMLVideoElement>();
    let endResetTimeout: ReturnType<typeof setTimeout> | null = null;

    const isVisible = $derived(
        $voiceCallState.status === 'outgoing-ringing' ||
        $voiceCallState.status === 'connecting' ||
        $voiceCallState.status === 'active' ||
        $voiceCallState.status === 'ended'
    );

    const isVideoCall = $derived($voiceCallState.callKind === 'video');

    const statusText = $derived.by(() => {
        switch ($voiceCallState.status) {
            case 'outgoing-ringing':
                return isVideoCall ? $t('voiceCall.callingVideo') : $t('voiceCall.calling');
            case 'connecting': return $t('voiceCall.connecting');
            case 'active': return formatDuration($voiceCallState.duration);
            case 'ended': return endReasonText($voiceCallState.endReason);
            default: return '';
        }
    });

    function formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function endReasonText(reason: string | null): string {
        switch (reason) {
            case 'hangup': return $t('voiceCall.endReasonHangup');
            case 'rejected': return $t('voiceCall.endReasonRejected');
            case 'busy': return $t('voiceCall.endReasonBusy');
            case 'timeout': return $t('voiceCall.endReasonTimeout');
            case 'ice-failed': return $t('voiceCall.endReasonIceFailed');
            case 'error': return $t('voiceCall.endReasonError');
            default: return $t('voiceCall.endReasonHangup');
        }
    }

    $effect(() => {
        if ($voiceCallState.peerNpub) {
            loadProfile($voiceCallState.peerNpub);
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'outgoing-ringing') {
            startOutgoingRingback();
        } else {
            stopRingtone();
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'active' && audioEl) {
            const stream = voiceCallService.getRemoteStream();
            if (stream) {
                audioEl.srcObject = stream;
            }
        }
    });

    // Video rendering: bind the remote MediaStream into the full-screen
    // <video> element. The same stream carries audio, so when the video
    // <video> is shown we don't also need the hidden <audio>.
    $effect(() => {
        if (
            isVideoCall &&
            $voiceCallState.status === 'active' &&
            remoteVideoEl
        ) {
            const stream = voiceCallService.getRemoteStream();
            if (stream) {
                remoteVideoEl.srcObject = stream;
            }
        }
    });

    // Local self-view: bind the local stream as soon as we're outgoing
    // or in any later state. We mute the element so we don't echo our
    // own audio back to ourselves.
    $effect(() => {
        if (
            isVideoCall &&
            ($voiceCallState.status === 'outgoing-ringing' ||
                $voiceCallState.status === 'connecting' ||
                $voiceCallState.status === 'active') &&
            localVideoEl
        ) {
            const stream = voiceCallService.getLocalStream();
            if (stream) {
                localVideoEl.srcObject = stream;
            }
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'ended') {
            endResetTimeout = setTimeout(() => {
                resetCall();
            }, CALL_END_DISPLAY_MS);
        }
    });

    async function loadProfile(npub: string) {
        const profile = await profileRepo.getProfileIgnoreTTL(npub);
        if (profile?.metadata) {
            profileName = resolveDisplayName(profile.metadata, npub);
            profilePicture = profile.metadata.picture || '';
        } else {
            profileName = npub.slice(0, 12) + '...';
        }
    }

    function handleHangup() {
        voiceCallService.hangup();
    }

    function handleToggleMute() {
        voiceCallService.toggleMute();
    }

    async function handleToggleCamera() {
        await voiceCallService.toggleCamera();
    }

    async function handleFlipCamera() {
        await voiceCallService.flipCamera();
    }

    onDestroy(() => {
        stopRingtone();
        if (endResetTimeout) clearTimeout(endResetTimeout);
    });
</script>

{#if isVisible}
    {#if isVideoCall}
        <!--
            Video-call layout. Mobile-first:
              * Mobile (default): full-bleed black, video fills viewport,
                status header + controls overlay the video with gradient
                scrims (top + bottom).
              * Desktop (md: and up): voice-modal-style scrim around a
                centered card. Card holds a 16:9 remote-video frame with
                the self-view PiP'd inside it; status header sits above
                the video and controls sit below in plain card chrome
                (no scrim).
            The mobile and desktop variants of the header and control row
            are duplicated rather than class-toggled so each is small and
            self-contained. The <video> elements are NOT duplicated — they
            keep the same identity across breakpoints so srcObject
            bindings survive a window resize mid-call.
        -->
        <div class="fixed inset-0 z-[55] bg-black md:bg-black/40 md:backdrop-blur-sm flex md:items-center md:justify-center md:p-4">
            <!-- Hidden audio element. Pre-active fallback / Safari quirks. -->
            <audio bind:this={audioEl} autoplay></audio>

            <!-- Modal card. Full-bleed on mobile; bounded card on md+.
                 Desktop card is phone-shaped (narrow + tall): max-w-sm
                 (384 px) keeps the 9:16 video frame from running off
                 the screen on smaller laptops, and max-h-[90vh] clamps
                 the card on short windows so the controls stay
                 reachable. -->
            <div
                class="relative w-full h-full
                       md:w-full md:max-w-sm md:h-auto md:max-h-[90vh]
                       md:bg-slate-900/95 md:backdrop-blur-xl
                       md:rounded-3xl md:shadow-2xl md:border md:border-white/10
                       md:overflow-hidden flex flex-col"
            >
                <!-- Desktop-only header above the video. -->
                <div class="hidden md:flex flex-col items-center px-6 pt-5 pb-3 text-white">
                    <span class="text-lg font-medium">{profileName}</span>
                    <span class="text-sm text-gray-300">{statusText}</span>
                </div>

                <!-- Remote video frame.
                     Mobile: fills the screen.
                     Desktop: fixed 9:16 (phone-shaped) aspect inside
                     the card. min-h-0 lets the aspect-locked container
                     shrink below its natural size when the card's
                     max-h-[90vh] clamp kicks in on short windows,
                     rather than overflow the card. -->
                <div class="relative flex-1 md:flex-none md:aspect-[9/16] md:min-h-0 bg-black overflow-hidden">
                    <video
                        bind:this={remoteVideoEl}
                        autoplay
                        playsinline
                        class="absolute inset-0 w-full h-full object-cover bg-black"
                    ></video>

                    <!-- Self-view PiP.
                         Mobile: top-right of viewport, portrait sized
                         to suit the full-bleed video.
                         Desktop: bottom-right corner of the video
                         rectangle, portrait (3:4) so it matches the
                         orientation of the parent 9:16 frame. -->
                    <video
                        bind:this={localVideoEl}
                        autoplay
                        playsinline
                        muted
                        class="absolute top-4 right-4 md:top-auto md:right-3 md:bottom-3
                               w-28 h-40 md:w-24 md:h-32
                               object-cover rounded-2xl border-2 border-white/30 shadow-xl bg-black z-10"
                        class:scale-x-[-1]={$voiceCallState.facingMode === 'user'}
                    ></video>

                    <!-- Mobile-only top scrim header. -->
                    <div class="absolute top-0 left-0 right-0 p-4 pt-[calc(1rem+env(safe-area-inset-top))] z-10 bg-gradient-to-b from-black/60 to-transparent md:hidden">
                        <div class="flex flex-col items-center text-white">
                            <span class="text-lg font-medium">{profileName}</span>
                            <span class="text-sm text-gray-300">{statusText}</span>
                        </div>
                    </div>

                    <!-- Mobile-only bottom-overlay controls. -->
                    {#if $voiceCallState.status !== 'ended'}
                        <div class="absolute bottom-0 left-0 right-0 z-10 px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-12 bg-gradient-to-t from-black/70 to-transparent md:hidden">
                            <div class="flex justify-around items-center">
                                <!-- Mute -->
                                <button
                                    onclick={handleToggleMute}
                                    class="flex flex-col items-center gap-2"
                                    aria-label={$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                                >
                                    <div class="w-12 h-12 rounded-full flex items-center justify-center {$voiceCallState.isMuted ? 'bg-white' : 'bg-white/20 backdrop-blur'}">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 {$voiceCallState.isMuted ? 'text-black' : 'text-white'}">
                                            {#if $voiceCallState.isMuted}
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"></path>
                                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                                <line x1="8" y1="23" x2="16" y2="23"></line>
                                            {:else}
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                                <line x1="8" y1="23" x2="16" y2="23"></line>
                                            {/if}
                                        </svg>
                                    </div>
                                </button>

                                <!-- Camera off / on -->
                                <button
                                    onclick={handleToggleCamera}
                                    class="flex flex-col items-center gap-2"
                                    aria-label={$voiceCallState.isCameraOff ? $t('voiceCall.cameraOn') : $t('voiceCall.cameraOff')}
                                >
                                    <div class="w-12 h-12 rounded-full flex items-center justify-center {$voiceCallState.isCameraOff ? 'bg-white' : 'bg-white/20 backdrop-blur'}">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 {$voiceCallState.isCameraOff ? 'text-black' : 'text-white'}">
                                            {#if $voiceCallState.isCameraOff}
                                                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                            {:else}
                                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                            {/if}
                                        </svg>
                                    </div>
                                </button>

                                <!-- Hangup -->
                                <button
                                    onclick={handleHangup}
                                    class="flex flex-col items-center gap-2"
                                    aria-label={$t('voiceCall.hangup')}
                                >
                                    <div class="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 rotate-[135deg]">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                        </svg>
                                    </div>
                                </button>

                                <!-- Flip camera -->
                                <button
                                    onclick={handleFlipCamera}
                                    disabled={$voiceCallState.isCameraFlipping}
                                    class="flex flex-col items-center gap-2 disabled:opacity-50"
                                    aria-label={$t('voiceCall.flipCamera')}
                                >
                                    <div class="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 backdrop-blur">
                                        <!--
                                            Twin-arrow refresh-loop glyph (Lucide-family).
                                            Geometry mirrored on Android in
                                            android/app/src/main/res/drawable/ic_camera_flip.xml
                                            so the button reads the same on Web/PWA and Android.
                                            Stroke-based to match the rest of the icon set in
                                            this control bar (mute, camera-off, hangup).
                                        -->
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-white">
                                            <path d="M23 4v6h-6"></path>
                                            <path d="M1 20v-6h6"></path>
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                                            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                                        </svg>
                                    </div>
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Desktop-only controls bar below the video. -->
                {#if $voiceCallState.status !== 'ended'}
                    <div class="hidden md:flex justify-center items-center gap-8 px-6 py-5">
                        <!-- Mute -->
                        <button
                            onclick={handleToggleMute}
                            class="flex flex-col items-center gap-2"
                            aria-label={$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                        >
                            <div class="w-12 h-12 rounded-full flex items-center justify-center {$voiceCallState.isMuted ? 'bg-white' : 'bg-white/20 backdrop-blur'}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 {$voiceCallState.isMuted ? 'text-black' : 'text-white'}">
                                    {#if $voiceCallState.isMuted}
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                        <line x1="8" y1="23" x2="16" y2="23"></line>
                                    {:else}
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                        <line x1="8" y1="23" x2="16" y2="23"></line>
                                    {/if}
                                </svg>
                            </div>
                        </button>

                        <!-- Camera off / on -->
                        <button
                            onclick={handleToggleCamera}
                            class="flex flex-col items-center gap-2"
                            aria-label={$voiceCallState.isCameraOff ? $t('voiceCall.cameraOn') : $t('voiceCall.cameraOff')}
                        >
                            <div class="w-12 h-12 rounded-full flex items-center justify-center {$voiceCallState.isCameraOff ? 'bg-white' : 'bg-white/20 backdrop-blur'}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 {$voiceCallState.isCameraOff ? 'text-black' : 'text-white'}">
                                    {#if $voiceCallState.isCameraOff}
                                        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    {:else}
                                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                    {/if}
                                </svg>
                            </div>
                        </button>

                        <!-- Hangup -->
                        <button
                            onclick={handleHangup}
                            class="flex flex-col items-center gap-2"
                            aria-label={$t('voiceCall.hangup')}
                        >
                            <div class="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 rotate-[135deg]">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </div>
                        </button>

                        <!--
                            No flip-camera button on desktop: laptops/desktops
                            virtually never expose a second physical camera the
                            user would meaningfully swap to, and showing a
                            disabled-looking control just clutters the bar.
                            The mobile-overlay branch above keeps the button
                            for phone-form-factor PWAs, where front/back
                            switching is the normal expectation.
                        -->
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <!-- Voice call layout (unchanged from pre-video baseline) -->
        <div class="fixed inset-0 z-[55] bg-black/90 md:bg-black/40 md:backdrop-blur-sm flex items-center justify-center md:p-4">
            <!-- Hidden audio element for remote stream -->
            <audio bind:this={audioEl} autoplay></audio>

            <div
                class="w-full h-full flex flex-col items-center justify-center gap-8
                       md:w-full md:max-w-md md:h-auto md:gap-6 md:p-8
                       md:bg-white/95 md:dark:bg-slate-900/80 md:backdrop-blur-xl
                       md:rounded-3xl md:shadow-2xl md:border md:border-white/20 md:dark:border-white/10"
            >
                <!-- Peer info -->
                <div class="flex flex-col items-center gap-4">
                    {#if profilePicture}
                        <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
                    {:else}
                        <div class="w-24 h-24 rounded-full bg-gray-700 md:bg-slate-300 md:dark:bg-gray-700 flex items-center justify-center text-3xl text-white md:text-slate-700 md:dark:text-white">
                            {profileName.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <span class="text-white md:text-slate-900 md:dark:text-white text-xl font-medium">{profileName}</span>
                    <span class="text-gray-400 md:text-slate-600 md:dark:text-gray-400 text-lg">{statusText}</span>
                </div>

                <!-- Controls -->
                {#if $voiceCallState.status !== 'ended'}
                    <div class="flex gap-12 md:gap-8 items-center">
                        <!-- Mute -->
                        <button
                            onclick={handleToggleMute}
                            class="flex flex-col items-center gap-2"
                            aria-label={$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                        >
                            <div class="w-14 h-14 rounded-full flex items-center justify-center {$voiceCallState.isMuted ? 'bg-white' : 'bg-gray-700 md:bg-slate-200 md:dark:bg-gray-700'}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 {$voiceCallState.isMuted ? 'text-black' : 'text-white md:text-slate-700 md:dark:text-white'}">
                                    {#if $voiceCallState.isMuted}
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                        <line x1="8" y1="23" x2="16" y2="23"></line>
                                    {:else}
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                        <line x1="8" y1="23" x2="16" y2="23"></line>
                                    {/if}
                                </svg>
                            </div>
                            <span class="text-white md:text-slate-700 md:dark:text-white text-xs">
                                {$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                            </span>
                        </button>

                        <!-- Hangup -->
                        <button
                            onclick={handleHangup}
                            class="flex flex-col items-center gap-2"
                            aria-label={$t('voiceCall.hangup')}
                        >
                            <div class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 rotate-[135deg]">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </div>
                        </button>

                        <!-- Speaker -->
                        <button
                            onclick={() => { /* speaker toggle - platform-dependent, placeholder for v1 */ }}
                            class="flex flex-col items-center gap-2"
                            aria-label={$t('voiceCall.speaker')}
                        >
                            <div class="w-14 h-14 rounded-full flex items-center justify-center {$voiceCallState.isSpeakerOn ? 'bg-white' : 'bg-gray-700 md:bg-slate-200 md:dark:bg-gray-700'}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 {$voiceCallState.isSpeakerOn ? 'text-black' : 'text-white md:text-slate-700 md:dark:text-white'}">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                </svg>
                            </div>
                            <span class="text-white md:text-slate-700 md:dark:text-white text-xs">{$t('voiceCall.speaker')}</span>
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{/if}
