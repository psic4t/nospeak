package com.nospeak.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidLocalSecretKey")
public class AndroidLocalSecretKeyPlugin extends Plugin {

    @PluginMethod
    public void setSecretKeyHex(PluginCall call) {
        String secretKeyHex = call.getString("secretKeyHex", null);
        if (secretKeyHex == null || secretKeyHex.trim().isEmpty()) {
            call.reject("secretKeyHex is required");
            return;
        }

        try {
            AndroidLocalSecretStore.setSecretKeyHex(getContext(), secretKeyHex);
            call.resolve();
        } catch (Exception e) {
            call.reject("failed_to_store_secret", e);
        }
    }

    @PluginMethod
    public void getSecretKeyHex(PluginCall call) {
        String secretKeyHex = AndroidLocalSecretStore.getSecretKeyHex(getContext());

        JSObject result = new JSObject();
        result.put("secretKeyHex", secretKeyHex);
        call.resolve(result);
    }

    @PluginMethod
    public void clearSecretKey(PluginCall call) {
        AndroidLocalSecretStore.clear(getContext());
        call.resolve();
    }
}
