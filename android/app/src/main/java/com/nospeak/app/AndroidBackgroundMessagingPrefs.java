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
    private static final String KEY_NOTIFICATIONS_ENABLED = "notificationsEnabled";
    private static final String KEY_NOTIFICATION_BASELINE_SECONDS = "notificationBaselineSeconds";
    private static final String KEY_FOLLOW_GATE_HEX_JSON = "followGateHexJson";

    private AndroidBackgroundMessagingPrefs() {
    }

    public static final class Config {

        public final boolean enabled;
        public final String mode;
        public final String pubkeyHex;
        public final String[] readRelays;
        public final boolean notificationsEnabled;

        public Config(
                boolean enabled,
                String mode,
                String pubkeyHex,
                String[] readRelays,
                boolean notificationsEnabled
        ) {
            this.enabled = enabled;
            this.mode = mode;
            this.pubkeyHex = pubkeyHex;
            this.readRelays = readRelays;
            this.notificationsEnabled = notificationsEnabled;
        }
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void saveStartConfig(
            Context context,
            String mode,
            String pubkeyHex,
            String[] readRelays,
            boolean notificationsEnabled
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
        editor.putBoolean(KEY_NOTIFICATIONS_ENABLED, notificationsEnabled);
        editor.apply();
    }

    public static void setEnabled(Context context, boolean enabled) {
        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putBoolean(KEY_ENABLED, enabled);
        editor.apply();
    }

    public static void saveNotificationBaselineSeconds(Context context, long baselineSeconds) {
        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putLong(KEY_NOTIFICATION_BASELINE_SECONDS, baselineSeconds);
        editor.apply();
    }

    public static long loadNotificationBaselineSeconds(Context context) {
        return getPrefs(context).getLong(KEY_NOTIFICATION_BASELINE_SECONDS, 0L);
    }

    /**
     * Persist the user's NIP-02 contact list (followed pubkeys, lowercase
     * hex) for the NIP-AC follow-gate consulted by the native background
     * service before posting an incoming-call FSI notification.
     *
     * Stored as a JSON array string. An empty array is distinct from
     * "never written" — the latter is treated as "contact list not loaded
     * yet" and per Q1 causes the gate to drop the offer.
     */
    public static void saveFollowGateHex(Context context, String[] hexPubkeys) {
        JSONArray arr = new JSONArray();
        if (hexPubkeys != null) {
            for (String hex : hexPubkeys) {
                if (hex != null && !hex.isEmpty()) {
                    arr.put(hex.toLowerCase());
                }
            }
        }
        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_FOLLOW_GATE_HEX_JSON, arr.toString());
        editor.apply();
    }

    /**
     * Read the persisted follow-gate set, or {@code null} if it has never
     * been written. The native NIP-AC offer handler treats null as
     * "contact list not loaded; drop the offer" per the cold-start rule.
     */
    public static java.util.Set<String> loadFollowGateHex(Context context) {
        String raw = getPrefs(context).getString(KEY_FOLLOW_GATE_HEX_JSON, null);
        if (raw == null) return null;
        try {
            JSONArray arr = new JSONArray(raw);
            java.util.HashSet<String> set = new java.util.HashSet<>();
            for (int i = 0; i < arr.length(); i++) {
                String hex = arr.optString(i, null);
                if (hex != null && !hex.isEmpty()) {
                    set.add(hex.toLowerCase());
                }
            }
            return set;
        } catch (JSONException e) {
            return null;
        }
    }

    public static Config load(Context context) {
        SharedPreferences prefs = getPrefs(context);

        boolean enabled = prefs.getBoolean(KEY_ENABLED, false);
        String mode = prefs.getString(KEY_MODE, "amber");
        String pubkeyHex = prefs.getString(KEY_PUBKEY_HEX, null);
        boolean notificationsEnabled = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, false);

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

        return new Config(enabled, mode, pubkeyHex, readRelays, notificationsEnabled);
    }

    public static Intent buildStartServiceIntent(Context context) {
        Config config = load(context);
        if (!config.enabled) {
            return null;
        }

        if (!config.notificationsEnabled) {
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
        serviceIntent.putExtra(NativeBackgroundMessagingService.EXTRA_NOTIFICATIONS_ENABLED, config.notificationsEnabled);
        return serviceIntent;
    }
}
