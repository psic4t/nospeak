import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Capacitor plugin shim for `android.permission.CAMERA`. Mirrors
 * {@link AndroidMicrophone}'s permission methods but exposes no
 * recording surface — the actual camera capture happens inside
 * `NativeVoiceCallManager` via stream-webrtc-android's
 * `Camera2Enumerator` + `CameraVideoCapturer`. This plugin only
 * handles the runtime permission grant flow on Android.
 *
 * On non-Android platforms this evaluates to `null`. The web/PWA
 * build relies on `getUserMedia` to prompt for camera access.
 */
export interface AndroidCameraPlugin {
    /** Returns the current grant state without prompting. */
    checkPermission(): Promise<{ granted: boolean }>;

    /**
     * If the permission is already granted, resolves immediately. If
     * not, prompts the user with the system dialog and resolves with
     * the result.
     */
    requestPermission(): Promise<{ granted: boolean }>;
}

export const AndroidCamera = Capacitor.getPlatform() === 'android'
    ? registerPlugin<AndroidCameraPlugin>('AndroidCamera')
    : null;
