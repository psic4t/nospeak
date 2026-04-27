import { Capacitor, registerPlugin } from '@capacitor/core';

export type AndroidNotificationRouteKind = 'chat' | 'voice-call-accept' | 'voice-call-active';

export interface AndroidNotificationChatRoutePayload {
    kind: 'chat';
    conversationId: string;
}

export interface AndroidNotificationVoiceCallAcceptPayload {
    kind: 'voice-call-accept';
    callId: string;
}

export interface AndroidNotificationVoiceCallActivePayload {
    kind: 'voice-call-active';
    callId: string;
}

export type AndroidNotificationRoutePayload =
    | AndroidNotificationChatRoutePayload
    | AndroidNotificationVoiceCallAcceptPayload
    | AndroidNotificationVoiceCallActivePayload;

export interface AndroidNotificationRouterPlugin {
    getInitialRoute(): Promise<AndroidNotificationRoutePayload | null>;
    addListener(
        eventName: 'routeReceived',
        listener: (payload: AndroidNotificationRoutePayload) => void
    ): Promise<{ remove: () => void }>;
}

export const AndroidNotificationRouter = Capacitor.getPlatform() === 'android'
    ? registerPlugin<AndroidNotificationRouterPlugin>('AndroidNotificationRouter')
    : (null as unknown as AndroidNotificationRouterPlugin);
