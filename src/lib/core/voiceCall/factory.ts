/**
 * Factory for the singleton {@code voiceCallService} backend.
 *
 * <ul>
 *   <li>Web/PWA: returns {@link VoiceCallService} (the JavaScript
 *       {@code RTCPeerConnection} implementation).</li>
 *   <li>Android: returns {@code VoiceCallServiceNative} (a thin proxy
 *       around the {@code AndroidVoiceCall} Capacitor plugin; the
 *       actual peer connection lives in {@code NativeVoiceCallManager}
 *       on the Java side).</li>
 * </ul>
 *
 * <p>Importers (UI components, Messaging.ts) SHALL go through the
 * {@code voiceCallService} singleton from {@code VoiceCallService.ts}
 * and depend only on the {@link VoiceCallBackend} interface, NOT on
 * the concrete class. That keeps the platform swap transparent.
 */

import { Capacitor } from '@capacitor/core';
import { VoiceCallService } from './VoiceCallService';
import { VoiceCallServiceNative } from './VoiceCallServiceNative';
import type { VoiceCallBackend } from './types';

/**
 * Returns a fresh {@link VoiceCallBackend} instance suitable for the
 * current platform.
 */
export function createVoiceCallBackend(): VoiceCallBackend {
    if (Capacitor.getPlatform() === 'android') {
        try {
            return new VoiceCallServiceNative();
        } catch (err) {
            // If construction fails for any reason (plugin not
            // registered, listener subscription error), fall through
            // to the web implementation rather than booting with no
            // call backend at all. The Svelte UI keeps working; the
            // user just gets the JS-WebRTC path instead of native.
            console.error(
                '[voiceCall/factory] native backend construction failed; falling back to web',
                err
            );
        }
    }
    return new VoiceCallService();
}
