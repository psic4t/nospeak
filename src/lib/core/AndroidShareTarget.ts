import { Capacitor, registerPlugin } from '@capacitor/core';

export type AndroidShareKind = 'media' | 'text';
export type AndroidShareMediaType = 'image' | 'video' | 'audio';

export interface AndroidShareMediaPayload {
    kind: 'media';
    mediaType: AndroidShareMediaType;
    mimeType: string;
    fileName: string;
    base64: string;
    /** Target conversation ID from Direct Share (if user selected a contact from share sheet) */
    targetConversationId?: string;
}

export interface AndroidShareTextPayload {
    kind: 'text';
    text: string;
    /** Target conversation ID from Direct Share (if user selected a contact from share sheet) */
    targetConversationId?: string;
}

export interface AndroidShareErrorPayload {
    kind: 'error';
    message: string;
}

export type AndroidSharePayload = AndroidShareMediaPayload | AndroidShareTextPayload | AndroidShareErrorPayload;

export interface AndroidShareTargetPlugin {
    getInitialShare(): Promise<AndroidSharePayload | null>;
    addListener(
        eventName: 'shareReceived',
        listener: (payload: AndroidSharePayload) => void
    ): Promise<{ remove: () => void }>;
}

export const AndroidShareTarget = Capacitor.getPlatform() === 'android'
    ? registerPlugin<AndroidShareTargetPlugin>('AndroidShareTarget')
    : (null as unknown as AndroidShareTargetPlugin);

export function fileFromAndroidMediaPayload(payload: AndroidShareMediaPayload): File {
    const binary = atob(payload.base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: payload.mimeType });
    return new File([blob], payload.fileName, { type: payload.mimeType });
}
