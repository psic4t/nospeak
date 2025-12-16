package com.nospeak.app;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidNip55Signer")
public class AndroidNip55SignerPlugin extends Plugin {

    private static final String PREFS_NAME = "nospeak_nip55";
    private static final String PREF_SIGNER_PACKAGE = "signer_package";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        boolean available = isExternalSignerInstalled(context);
        boolean hasKnownPackage = getStoredSignerPackage(context) != null;

        JSObject result = new JSObject();
        result.put("available", available);
        result.put("hasKnownPackage", hasKnownPackage);
        call.resolve(result);
    }

    @PluginMethod
    public void getPublicKey(PluginCall call) {
        if (!isExternalSignerInstalled(getContext())) {
            call.reject("no_signer_available");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");

        // Request the specific permissions nospeak requires so that the signer
        // can offer a "remember my choice" option for them in a single flow.
        // We currently sign:
        // - kind 0  (metadata)
        // - kind 13 (gift wrap seals)
        // - kind 10050 (NIP-17 messaging relays)
        // - kind 27235 (NIP-98 upload auth)
        // and use nip44 encrypt/decrypt for messaging.
        // The structure follows NIP-55's suggested "permissions" extra.
        String permissionsJson = "[" +
                "{\"type\":\"sign_event\",\"kinds\":[0,13,10050,27235]}," +
                "{\"type\":\"nip44_encrypt\"}," +
                "{\"type\":\"nip44_decrypt\"}" +
                "]";
        intent.putExtra("permissions", permissionsJson);
 
        startActivityForResult(call, intent, "onGetPublicKeyResult");

    }

    @ActivityCallback
    private void onGetPublicKeyResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("user_cancelled");
            return;
        }

        Intent data = result.getData();
        String pubkey = data.getStringExtra("result");
        String packageName = data.getStringExtra("package");

        if (pubkey == null || pubkey.isEmpty() || packageName == null || packageName.isEmpty()) {
            call.reject("invalid_result");
            return;
        }

        storeSignerPackage(getContext(), packageName);

        JSObject res = new JSObject();
        res.put("pubkeyHex", pubkey);
        res.put("packageName", packageName);
        call.resolve(res);
    }

    @PluginMethod
    public void signEvent(PluginCall call) {
        String eventJson = call.getString("eventJson", null);
        String currentUser = call.getString("currentUserPubkeyHex", null);

        if (eventJson == null || currentUser == null) {
            call.reject("missing_arguments");
            return;
        }

        String packageName = getStoredSignerPackage(getContext());
        if (packageName == null) {
            call.reject("no_signer_package");
            return;
        }

        // Try ContentResolver first
        JSObject fromResolver = querySignEvent(getContext(), packageName, eventJson, currentUser);
        if (fromResolver != null) {
            // If the signer indicates this operation is rejected, surface that as
            // an error and do not fall back to an interactive Intent.
            if (fromResolver.has("rejected")) {
                call.reject("rejected");
            } else {
                call.resolve(fromResolver);
            }
            return;
        }

        // Fallback to Intent
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + eventJson));
        intent.setPackage(packageName);
        intent.putExtra("type", "sign_event");
        intent.putExtra("current_user", currentUser);

        startActivityForResult(call, intent, "onSignEventResult");
    }

    @ActivityCallback
    private void onSignEventResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("user_cancelled");
            return;
        }

        Intent data = result.getData();
        String signedEventJson = data.getStringExtra("event");
        if (signedEventJson == null || signedEventJson.isEmpty()) {
            call.reject("invalid_result");
            return;
        }

        JSObject res = new JSObject();
        res.put("signedEventJson", signedEventJson);
        call.resolve(res);
    }

    @PluginMethod
    public void nip44Encrypt(PluginCall call) {
        String plaintext = call.getString("plaintext", null);
        String recipient = call.getString("recipientPubkeyHex", null);
        String currentUser = call.getString("currentUserPubkeyHex", null);

        if (plaintext == null || recipient == null || currentUser == null) {
            call.reject("missing_arguments");
            return;
        }

        String packageName = getStoredSignerPackage(getContext());
        if (packageName == null) {
            call.reject("no_signer_package");
            return;
        }

        JSObject fromResolver = queryEncrypt(getContext(), packageName, plaintext, recipient, currentUser);
        if (fromResolver != null) {
            if (fromResolver.has("rejected")) {
                call.reject("rejected");
            } else {
                call.resolve(fromResolver);
            }
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + plaintext));
        intent.setPackage(packageName);
        intent.putExtra("type", "nip44_encrypt");
        intent.putExtra("current_user", currentUser);
        intent.putExtra("pubkey", recipient);

        startActivityForResult(call, intent, "onNip44EncryptResult");
    }

    @ActivityCallback
    private void onNip44EncryptResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("user_cancelled");
            return;
        }

        Intent data = result.getData();
        String ciphertext = data.getStringExtra("result");
        if (ciphertext == null || ciphertext.isEmpty()) {
            call.reject("invalid_result");
            return;
        }

        JSObject res = new JSObject();
        res.put("ciphertext", ciphertext);
        call.resolve(res);
    }

    @PluginMethod
    public void nip44Decrypt(PluginCall call) {
        String ciphertext = call.getString("ciphertext", null);
        String sender = call.getString("senderPubkeyHex", null);
        String currentUser = call.getString("currentUserPubkeyHex", null);

        if (ciphertext == null || sender == null || currentUser == null) {
            call.reject("missing_arguments");
            return;
        }

        String packageName = getStoredSignerPackage(getContext());
        if (packageName == null) {
            call.reject("no_signer_package");
            return;
        }

        JSObject fromResolver = queryDecrypt(getContext(), packageName, ciphertext, sender, currentUser);
        if (fromResolver != null) {
            if (fromResolver.has("rejected")) {
                call.reject("rejected");
            } else {
                call.resolve(fromResolver);
            }
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + ciphertext));
        intent.setPackage(packageName);
        intent.putExtra("type", "nip44_decrypt");
        intent.putExtra("current_user", currentUser);
        intent.putExtra("pubkey", sender);

        startActivityForResult(call, intent, "onNip44DecryptResult");
    }

    @ActivityCallback
    private void onNip44DecryptResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("user_cancelled");
            return;
        }

        Intent data = result.getData();
        String plaintext = data.getStringExtra("result");
        if (plaintext == null || plaintext.isEmpty()) {
            call.reject("invalid_result");
            return;
        }

        JSObject res = new JSObject();
        res.put("plaintext", plaintext);
        call.resolve(res);
    }

    private static boolean isExternalSignerInstalled(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        PackageManager pm = context.getPackageManager();
        return pm.queryIntentActivities(intent, 0).size() > 0;
    }

    private static String getStoredSignerPackage(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(PREF_SIGNER_PACKAGE, null);
    }

    private static void storeSignerPackage(Context context, String packageName) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(PREF_SIGNER_PACKAGE, packageName)
                .apply();
    }

    private JSObject querySignEvent(Context context, String packageName, String eventJson, String currentUser) {
        try {
            ContentResolver resolver = context.getContentResolver();
            // Use Amber's concrete NIP-55 URI for sign_event
            Uri uri = Uri.parse("content://com.greenart7c3.nostrsigner.SIGN_EVENT");
            String[] projection = new String[]{eventJson, "", currentUser};
            Cursor cursor = resolver.query(uri, projection, null, null, null);
            if (cursor == null) {
                return null;
            }
            try {
                int rejectedIndex = cursor.getColumnIndex("rejected");
                if (rejectedIndex >= 0) {
                    JSObject res = new JSObject();
                    res.put("rejected", true);
                    return res;
                }
                if (cursor.moveToFirst()) {
                    int eventIndex = cursor.getColumnIndex("event");
                    if (eventIndex < 0) {
                        return null;
                    }
                    String signedEventJson = cursor.getString(eventIndex);
                    if (signedEventJson == null) {
                        return null;
                    }
                    JSObject res = new JSObject();
                    res.put("signedEventJson", signedEventJson);
                    return res;
                }
                return null;
            } finally {
                cursor.close();
            }
        } catch (Exception e) {
            return null;
        }
    }
 
    private JSObject queryEncrypt(Context context, String packageName, String plaintext, String recipient, String currentUser) {
        try {
            ContentResolver resolver = context.getContentResolver();
            // Use Amber's concrete NIP-55 URI for nip44_encrypt
            Uri uri = Uri.parse("content://com.greenart7c3.nostrsigner.NIP44_ENCRYPT");
            String[] projection = new String[]{plaintext, recipient, currentUser};
            Cursor cursor = resolver.query(uri, projection, null, null, null);
            if (cursor == null) {
                return null;
            }
            try {
                int rejectedIndex = cursor.getColumnIndex("rejected");
                if (rejectedIndex >= 0) {
                    JSObject res = new JSObject();
                    res.put("rejected", true);
                    return res;
                }
                if (cursor.moveToFirst()) {
                    int resultIndex = cursor.getColumnIndex("result");
                    if (resultIndex < 0) {
                        return null;
                    }
                    String ciphertext = cursor.getString(resultIndex);
                    if (ciphertext == null) {
                        return null;
                    }
                    JSObject res = new JSObject();
                    res.put("ciphertext", ciphertext);
                    return res;
                }
                return null;
            } finally {
                cursor.close();
            }
        } catch (Exception e) {
            return null;
        }
    }
 
    private JSObject queryDecrypt(Context context, String packageName, String ciphertext, String sender, String currentUser) {
        try {
            ContentResolver resolver = context.getContentResolver();
            // Use Amber's concrete NIP-55 URI for nip44_decrypt
            Uri uri = Uri.parse("content://com.greenart7c3.nostrsigner.NIP44_DECRYPT");
            String[] projection = new String[]{ciphertext, sender, currentUser};
            Cursor cursor = resolver.query(uri, projection, null, null, null);
            if (cursor == null) {
                return null;
            }
            try {
                int rejectedIndex = cursor.getColumnIndex("rejected");
                if (rejectedIndex >= 0) {
                    JSObject res = new JSObject();
                    res.put("rejected", true);
                    return res;
                }
                if (cursor.moveToFirst()) {
                    int resultIndex = cursor.getColumnIndex("result");
                    if (resultIndex < 0) {
                        return null;
                    }
                    String plaintext = cursor.getString(resultIndex);
                    if (plaintext == null) {
                        return null;
                    }
                    JSObject res = new JSObject();
                    res.put("plaintext", plaintext);
                    return res;
                }
                return null;
            } finally {
                cursor.close();
            }
        } catch (Exception e) {
            return null;
        }
    }

}
