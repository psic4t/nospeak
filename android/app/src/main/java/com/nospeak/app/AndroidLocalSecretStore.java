package com.nospeak.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

public final class AndroidLocalSecretStore {

    private static final String PREFS_NAME = "nospeak_local_secret";
    private static final String KEY_SECRET_KEY_HEX = "secret_key_hex";

    private AndroidLocalSecretStore() {
    }

    private static SharedPreferences getPrefs(Context context) throws Exception {
        MasterKey masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();

        return EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    public static void setSecretKeyHex(Context context, String secretKeyHex) throws Exception {
        if (context == null) {
            throw new IllegalArgumentException("context is required");
        }
        if (secretKeyHex == null || secretKeyHex.trim().isEmpty()) {
            throw new IllegalArgumentException("secretKeyHex is required");
        }

        String trimmed = secretKeyHex.trim();
        SharedPreferences prefs = getPrefs(context);
        prefs.edit().putString(KEY_SECRET_KEY_HEX, trimmed).apply();
    }

    public static String getSecretKeyHex(Context context) {
        if (context == null) {
            return null;
        }

        try {
            SharedPreferences prefs = getPrefs(context);
            String value = prefs.getString(KEY_SECRET_KEY_HEX, null);
            if (value == null || value.trim().isEmpty()) {
                return null;
            }
            return value.trim();
        } catch (Exception e) {
            return null;
        }
    }

    public static void clear(Context context) {
        if (context == null) {
            return;
        }

        try {
            SharedPreferences prefs = getPrefs(context);
            prefs.edit().remove(KEY_SECRET_KEY_HEX).apply();
        } catch (Exception ignored) {
            // ignore
        }
    }
}
