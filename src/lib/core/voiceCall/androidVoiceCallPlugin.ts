import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface PendingIncomingCall {
    signalJson: string;
    senderNpub: string;
    senderPubkeyHex: string;
    callId: string;
    receivedAt: number;
    expiresAt: number;
}

export interface AndroidVoiceCallPluginShape {
    startCallSession(opts: {
        callId: string;
        peerNpub: string;
        peerName?: string;
        role: 'incoming' | 'outgoing';
    }): Promise<void>;

    endCallSession(): Promise<void>;

    getPendingIncomingCall(): Promise<{ pending: PendingIncomingCall | null }>;

    clearPendingIncomingCall(): Promise<void>;

    canUseFullScreenIntent(): Promise<{ granted: boolean }>;

    requestFullScreenIntentPermission(): Promise<void>;

    addListener(
        eventName: 'hangupRequested',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'pendingCallAvailable',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;
}

export const AndroidVoiceCall = registerPlugin<AndroidVoiceCallPluginShape>('AndroidVoiceCall');
