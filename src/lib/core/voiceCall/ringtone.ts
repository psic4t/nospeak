import { Capacitor } from '@capacitor/core';

let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

/**
 * Play a repeating ring pattern for incoming calls.
 * Two-tone burst every 3 seconds.
 *
 * No-op on Android: the incoming-call notification channel sound +
 * the lockscreen IncomingCallActivity provide the ringer there. The
 * Svelte IncomingCallOverlay is also gated off on Android, so this
 * code path should not normally be reached on the Android build, but
 * the guard makes that explicit.
 */
export function startIncomingRingtone(): void {
    if (Capacitor.getPlatform() === 'android') return;
    stopRingtone();
    playRingBurst();
    ringtoneInterval = setInterval(playRingBurst, 3000);
}

/**
 * Play a repeating ringback tone for outgoing calls.
 * Single tone burst every 4 seconds (like a phone ringing on the other end).
 *
 * No-op on Android: the native {@code VoiceCallForegroundService}
 * plays a {@code ToneGenerator} ringback that is fully decoupled
 * from WebView lifecycle.
 */
export function startOutgoingRingback(): void {
    if (Capacitor.getPlatform() === 'android') return;
    stopRingtone();
    playRingbackBurst();
    ringtoneInterval = setInterval(playRingbackBurst, 4000);
}

export function stopRingtone(): void {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
    stopOscillator();
}

function playRingBurst(): void {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    stopOscillator();
    gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);

    oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.connect(gainNode);

    // Two-tone ring: 440Hz for 400ms, pause 200ms, 480Hz for 400ms
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(440, now);
    oscillator.frequency.setValueAtTime(480, now + 0.6);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.setValueAtTime(0, now + 0.4);
    gainNode.gain.setValueAtTime(0.3, now + 0.6);
    gainNode.gain.setValueAtTime(0, now + 1.0);

    oscillator.start(now);
    oscillator.stop(now + 1.0);
    oscillator.onended = () => { oscillator = null; };
}

function playRingbackBurst(): void {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    stopOscillator();
    gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.connect(gainNode);

    // Single 2-second tone at lower volume
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.setValueAtTime(0, now + 2.0);

    oscillator.start(now);
    oscillator.stop(now + 2.0);
    oscillator.onended = () => { oscillator = null; };
}

function stopOscillator(): void {
    if (oscillator) {
        try { oscillator.stop(); } catch { /* already stopped */ }
        oscillator = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
}
