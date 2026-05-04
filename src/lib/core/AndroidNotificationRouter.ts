import { Capacitor, registerPlugin } from '@capacitor/core';

export type AndroidNotificationRouteKind =
    | 'chat'
    | 'voice-call-unlock';

export interface AndroidNotificationChatRoutePayload {
    kind: 'chat';
    conversationId: string;
}

/**
 * Phase 2 of {@code add-native-voice-calls}: emitted when the user taps
 * Accept on the lockscreen incoming-call activity but the local nsec is
 * PIN-locked. The JS handler is expected to surface the existing
 * unlock screen; on successful PIN entry the JS layer calls
 * {@code AndroidVoiceCall.notifyUnlockComplete({ callId })} which in
 * turn fires the {@code nospeak.ACTION_UNLOCK_COMPLETE} broadcast that
 * resumes the native accept.
 */
export interface AndroidNotificationVoiceCallUnlockPayload {
    kind: 'voice-call-unlock';
    callId: string;
}

export type AndroidNotificationRoutePayload =
    | AndroidNotificationChatRoutePayload
    | AndroidNotificationVoiceCallUnlockPayload;

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
