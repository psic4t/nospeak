package com.nospeak.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;

public final class AndroidBackgroundMessagingPrefs {

    private static final String PREFS_NAME = "nospeak_background_messaging";

    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_MODE = "mode";
    private static final String KEY_PUBKEY_HEX = "pubkeyHex";
    private static final String KEY_READ_RELAYS_JSON = "readRelaysJson";
    private static final String KEY_SUMMARY = "summary";

    private AndroidBackgroundMessagingPrefs() {
    }

    public static final class Config {

        public final boolean enabled;
        public final String mode;
        public final String pubkeyHex;
        public final String[] readRelays;
        public final String summary;

        public Config(
                boolean enabled,
                String mode,
                String pubkeyHex,
                String[] readRelays,
                String summary
        ) {
            this.enabled = enabled;
            this.mode = mode;
            this.pubkeyHex = pubkeyHex;
            this.readRelays = readRelays;
            this.summary = summary;
        }
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String defaultSummary(String[] readRelays) {
        if (readRelays == null || readRelays.length == 0) {
            return "No read relays configured";
        }
        return "Connected to read relays";
    }

    public static void saveStartConfig(
            Context context,
            String mode,
            String pubkeyHex,
            String[] readRelays,
            String summary
    ) {
        JSONArray relaysJson = new JSONArray();
        if (readRelays != null) {
            for (String relay : readRelays) {
                relaysJson.put(relay != null ? relay : "");
            }
        }

        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putBoolean(KEY_ENABLED, true);
        editor.putString(KEY_MODE, mode != null ? mode : "amber");
        editor.putString(KEY_PUBKEY_HEX, pubkeyHex);
        editor.putString(KEY_READ_RELAYS_JSON, relaysJson.toString());
        editor.putString(KEY_SUMMARY, summary != null ? summary : defaultSummary(readRelays));
        editor.apply();
    }

    public static void saveSummary(Context context, String summary) {
        if (summary == null) {
            return;
        }
        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_SUMMARY, summary);
        editor.apply();
    }

    public static void setEnabled(Context context, boolean enabled) {
        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putBoolean(KEY_ENABLED, enabled);
        editor.apply();
    }

    public static Config load(Context context) {
        SharedPreferences prefs = getPrefs(context);

        boolean enabled = prefs.getBoolean(KEY_ENABLED, false);
        String mode = prefs.getString(KEY_MODE, "amber");
        String pubkeyHex = prefs.getString(KEY_PUBKEY_HEX, null);
        String summary = prefs.getString(KEY_SUMMARY, null);

        String[] readRelays = new String[0];
        String relaysJsonRaw = prefs.getString(KEY_READ_RELAYS_JSON, null);
        if (relaysJsonRaw != null && !relaysJsonRaw.isEmpty()) {
            try {
                JSONArray relaysJson = new JSONArray(relaysJsonRaw);
                int length = relaysJson.length();
                readRelays = new String[length];
                for (int i = 0; i < length; i++) {
                    String relay = relaysJson.optString(i, "");
                    readRelays[i] = relay != null ? relay : "";
                }
            } catch (JSONException ignored) {
                readRelays = new String[0];
            }
        }

        if (summary == null || summary.isEmpty()) {
            summary = defaultSummary(readRelays);
        }

        return new Config(enabled, mode, pubkeyHex, readRelays, summary);
    }

    public static Intent buildStartServiceIntent(Context context) {
        Config config = load(context);
        if (!config.enabled) {
            return null;
        }

        // Only require a pubkey when there are relays to connect to.
        if ((config.readRelays != null && config.readRelays.length > 0) && (config.pubkeyHex == null || config.pubkeyHex.isEmpty())) {
            return null;
        }

        Intent serviceIntent = new Intent(context, NativeBackgroundMessagingService.class);
        serviceIntent.setAction(NativeBackgroundMessagingService.ACTION_START);
        serviceIntent.putExtra(NativeBackgroundMessagingService.EXTRA_MODE, config.mode);
        if (config.pubkeyHex != null) {
            serviceIntent.putExtra(NativeBackgroundMessagingService.EXTRA_PUBKEY_HEX, config.pubkeyHex);
        }
        serviceIntent.putExtra(NativeBackgroundMessagingService.EXTRA_READ_RELAYS, config.readRelays != null ? config.readRelays : new String[0]);
        serviceIntent.putExtra(NativeBackgroundMessagingService.EXTRA_SUMMARY, config.summary);
        return serviceIntent;
    }
}
