package com.nospeak.app;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Capacitor plugin that exposes the {@code android.permission.CAMERA}
 * runtime permission to the JS layer for video calling. Mirrors
 * {@link AndroidMicrophonePlugin}'s permission API. There is no
 * recording surface here — actual camera capture happens inside the
 * native voice-call WebRTC stack
 * ({@link NativeVoiceCallManager#attachLocalVideoTrack}); this plugin
 * only handles the permission grant flow before the manager starts
 * capturing.
 *
 * <p>Used by {@code VoiceCallServiceNative} when the user initiates
 * or accepts a call whose kind is {@code 'video'}. If the permission
 * is denied, the JS layer aborts the call (no silent downgrade to a
 * voice call — the caller's UI promised video).
 */
@CapacitorPlugin(
    name = "AndroidCamera",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = AndroidCameraPlugin.CAMERA)
    }
)
public class AndroidCameraPlugin extends Plugin {

    static final String CAMERA = "camera";

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = getPermissionState(CAMERA) == PermissionState.GRANTED;
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState(CAMERA) == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestAllPermissions(call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        boolean granted = getPermissionState(CAMERA) == PermissionState.GRANTED;
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
