package com.nospeak.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class AndroidUnifiedPushPrefs {

    private static final String PREFS_NAME = "nospeak_unifiedpush";

    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SERVER_URL = "serverUrl";
    private static final String KEY_TOPICS_JSON = "topicsJson";
    private static final String KEY_SUMMARY = "summary";
    private static final String KEY_REGISTRATIONS_JSON = "registrationsJson";

    private AndroidUnifiedPushPrefs() {
    }

    public static final class Config {
        public final boolean enabled;
        public final String serverUrl;
        public final String[] topics;

        public Config(boolean enabled, String serverUrl, String[] topics) {
            this.enabled = enabled;
            this.serverUrl = serverUrl;
            this.topics = topics;
        }
    }

    public static final class Registration {
        public final String token;
        public final String packageName;
        public final String endpoint;
        public final String vapidKey;
        public final String message;
        public final String topic;

        public Registration(String token, String packageName, String endpoint, String vapidKey, String message, String topic) {
            this.token = token;
            this.packageName = packageName;
            this.endpoint = endpoint;
            this.vapidKey = vapidKey;
            this.message = message;
            this.topic = topic;
        }
    }

    private static final class PruneResult {
        public final JSONArray registrations;
        public final boolean changed;

        public PruneResult(JSONArray registrations, boolean changed) {
            this.registrations = registrations;
            this.changed = changed;
        }
    }

    private static android.content.SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void saveStartConfig(Context context, String serverUrl, String[] topics) {
        JSONArray topicsJson = new JSONArray();
        if (topics != null) {
            for (String topic : topics) {
                topicsJson.put(topic != null ? topic : "");
            }
        }

        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putBoolean(KEY_ENABLED, true);
        editor.putString(KEY_SERVER_URL, serverUrl);
        editor.putString(KEY_TOPICS_JSON, topicsJson.toString());
        editor.putString(KEY_SUMMARY, "UnifiedPush active");
        editor.apply();
    }

    public static void saveServerUrl(Context context, String serverUrl) {
        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_SERVER_URL, serverUrl);
        editor.apply();
    }

    public static void setTopics(Context context, String[] topics) {
        JSONArray topicsJson = new JSONArray();
        if (topics != null) {
            for (String topic : topics) {
                topicsJson.put(topic != null ? topic : "");
            }
        }

        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_TOPICS_JSON, topicsJson.toString());
        editor.apply();
    }

    public static void saveSummary(Context context, String summary) {
        if (summary == null) {
            return;
        }
        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_SUMMARY, summary);
        editor.apply();
    }

    public static void setEnabled(Context context, boolean enabled) {
        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putBoolean(KEY_ENABLED, enabled);
        editor.apply();
    }

    public static void saveRegistration(Context context, String token, String packageName, String endpoint, String vapidKey, String message, String topic) {
        JSONArray registrationsJson = getRegistrationsJson(context);

        JSONArray newRegistrations = new JSONArray();
        boolean found = false;
        for (int i = 0; i < registrationsJson.length(); i++) {
            JSONObject reg = registrationsJson.optJSONObject(i);
            if (reg != null && token.equals(reg.optString("token"))) {
                JSONObject newReg = new JSONObject();
                try {
                    newReg.put("token", token);
                    newReg.put("packageName", packageName);
                    newReg.put("endpoint", endpoint);
                    newReg.put("vapidKey", vapidKey != null ? vapidKey : "");
                    newReg.put("message", message != null ? message : "");
                    newReg.put("topic", topic != null ? topic : "");
                    newRegistrations.put(newReg);
                    found = true;
                } catch (JSONException ignored) {
                }
            } else if (reg != null) {
                newRegistrations.put(reg);
            }
        }

        if (!found) {
            JSONObject newReg = new JSONObject();
            try {
                newReg.put("token", token);
                newReg.put("packageName", packageName);
                newReg.put("endpoint", endpoint);
                newReg.put("vapidKey", vapidKey != null ? vapidKey : "");
                newReg.put("message", message != null ? message : "");
                newReg.put("topic", topic != null ? topic : "");
                newRegistrations.put(newReg);
            } catch (JSONException ignored) {
            }
        }

        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_REGISTRATIONS_JSON, newRegistrations.toString());
        editor.apply();
    }

    public static void removeRegistration(Context context, String token) {
        JSONArray registrationsJson = getRegistrationsJson(context);

        JSONArray newRegistrations = new JSONArray();
        for (int i = 0; i < registrationsJson.length(); i++) {
            JSONObject reg = registrationsJson.optJSONObject(i);
            if (reg != null && !token.equals(reg.optString("token"))) {
                newRegistrations.put(reg);
            }
        }

        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_REGISTRATIONS_JSON, newRegistrations.toString());
        editor.apply();
    }

    static JSONArray removeRegistrationsForPackageFromJson(JSONArray registrationsJson, String packageName) {
        JSONArray newRegistrations = new JSONArray();

        if (packageName == null || packageName.isEmpty()) {
            return registrationsJson != null ? registrationsJson : newRegistrations;
        }

        if (registrationsJson == null) {
            return newRegistrations;
        }

        for (int i = 0; i < registrationsJson.length(); i++) {
            JSONObject reg = registrationsJson.optJSONObject(i);
            if (reg == null) {
                continue;
            }

            String existingPackage = reg.optString("packageName", "");
            if (!packageName.equals(existingPackage)) {
                newRegistrations.put(reg);
            }
        }

        return newRegistrations;
    }

    public static void removeRegistrationsForPackage(Context context, String packageName) {
        JSONArray registrationsJson = getRegistrationsJson(context);
        JSONArray newRegistrations = removeRegistrationsForPackageFromJson(registrationsJson, packageName);

        android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putString(KEY_REGISTRATIONS_JSON, newRegistrations.toString());
        editor.apply();
    }

    public static void acknowledgeMessage(Context context, String token) {
        // MESSAGE_ACK indicates successful delivery; it should not unregister the app.
    }

    public static String getOrCreateTopicForToken(Context context, String token) {
        Registration existing = getRegistration(context, token);
        if (existing != null && existing.topic != null && !existing.topic.isEmpty()) {
            return existing.topic;
        }

        return "up_" + sha256Hex(token).substring(0, 24);
    }

    public static String getServerUrl(Context context) {
        return getPrefs(context).getString(KEY_SERVER_URL, null);
    }

    public static String[] getTopics(Context context) {
        JSONArray topicsJson = null;
        String topicsJsonRaw = getPrefs(context).getString(KEY_TOPICS_JSON, null);
        if (topicsJsonRaw != null && !topicsJsonRaw.isEmpty()) {
            try {
                topicsJson = new JSONArray(topicsJsonRaw);
            } catch (JSONException ignored) {
            }
        }

        if (topicsJson == null || topicsJson.length() == 0) {
            return new String[0];
        }

        String[] topics = new String[topicsJson.length()];
        for (int i = 0; i < topicsJson.length(); i++) {
            String topic = topicsJson.optString(i, "");
            topics[i] = topic != null ? topic : "";
        }

        return topics;
    }

    public static Config load(Context context) {
        android.content.SharedPreferences prefs = getPrefs(context);

        boolean enabled = prefs.getBoolean(KEY_ENABLED, false);
        String serverUrl = prefs.getString(KEY_SERVER_URL, null);
        String[] topics = getTopics(context);

        return new Config(enabled, serverUrl, topics);
    }

    public static Registration getRegistration(Context context, String token) {
        JSONArray registrationsJson = getRegistrationsJson(context);
        for (int i = 0; i < registrationsJson.length(); i++) {
            JSONObject reg = registrationsJson.optJSONObject(i);
            if (reg != null && token.equals(reg.optString("token"))) {
                String packageName = reg.optString("packageName");
                String endpoint = reg.optString("endpoint");
                String vapidKey = reg.optString("vapidKey");
                String message = reg.optString("message");
                String topic = reg.optString("topic");

                if (topic == null || topic.isEmpty()) {
                    topic = deriveTopicFromEndpoint(endpoint);
                    if (topic == null || topic.isEmpty()) {
                        topic = "up_" + sha256Hex(token).substring(0, 24);
                    }
                }

                return new Registration(token, packageName, endpoint, vapidKey, message, topic);
            }
        }
        return null;
    }

    public static JSONArray getRegistrationsJson(Context context) {
        JSONArray registrationsJson = null;
        String registrationsJsonRaw = getPrefs(context).getString(KEY_REGISTRATIONS_JSON, null);
        if (registrationsJsonRaw != null && !registrationsJsonRaw.isEmpty()) {
            try {
                registrationsJson = new JSONArray(registrationsJsonRaw);
            } catch (JSONException ignored) {
            }
        }

        if (registrationsJson == null) {
            registrationsJson = new JSONArray();
        }

        PruneResult result = pruneAndRepairRegistrations(context, registrationsJson);
        if (result.changed) {
            android.content.SharedPreferences.Editor editor = getPrefs(context).edit();
            editor.putString(KEY_REGISTRATIONS_JSON, result.registrations.toString());
            editor.apply();
        }

        return result.registrations;
    }

    public static JSONArray getRegistrationsAsJsonArray(Context context) {
        return getRegistrationsJson(context);
    }

    public static Intent buildStartServiceIntent(Context context) {
        Config config = load(context);
        if (!config.enabled) {
            return null;
        }

        if (config.serverUrl == null || config.serverUrl.isEmpty()) {
            return null;
        }

        Intent serviceIntent = new Intent(context, AndroidUnifiedPushService.class);
        serviceIntent.setAction(AndroidUnifiedPushService.ACTION_START);
        serviceIntent.putExtra(AndroidUnifiedPushService.EXTRA_SERVER_URL, config.serverUrl);
        serviceIntent.putExtra(AndroidUnifiedPushService.EXTRA_TOPICS, config.topics);
        return serviceIntent;
    }

    private static PruneResult pruneAndRepairRegistrations(Context context, JSONArray registrationsJson) {
        boolean changed = false;
        JSONArray cleaned = new JSONArray();

        String serverUrl = getServerUrl(context);
        String normalizedServerUrl = normalizeServerUrl(serverUrl);

        for (int i = 0; i < registrationsJson.length(); i++) {
            JSONObject reg = registrationsJson.optJSONObject(i);
            if (reg == null) {
                changed = true;
                continue;
            }

            String token = reg.optString("token", "");
            String packageName = reg.optString("packageName", "");
            String endpoint = reg.optString("endpoint", "");
            String vapidKey = reg.optString("vapidKey", "");
            String message = reg.optString("message", "");
            String topic = reg.optString("topic", "");

            if (token.isEmpty() || packageName.isEmpty()) {
                changed = true;
                continue;
            }

            // Drop old/broken endpoints like unifiedpush://...
            if (!isHttpEndpoint(endpoint)) {
                changed = true;
                continue;
            }

            boolean updated = false;

            if (topic.isEmpty()) {
                String derived = deriveTopicFromEndpoint(endpoint);
                if (derived != null && !derived.isEmpty()) {
                    topic = derived;
                    updated = true;
                } else if (normalizedServerUrl != null) {
                    topic = "up_" + sha256Hex(token).substring(0, 24);
                    endpoint = normalizedServerUrl + "/" + topic;
                    updated = true;
                } else {
                    // Cannot repair without a server URL.
                    changed = true;
                    continue;
                }
            }

            if (topic.contains(",") || topic.contains("/")) {
                changed = true;
                continue;
            }

            if (updated) {
                changed = true;
            }

            JSONObject out = new JSONObject();
            try {
                out.put("token", token);
                out.put("packageName", packageName);
                out.put("endpoint", endpoint);
                out.put("vapidKey", vapidKey);
                out.put("message", message);
                out.put("topic", topic);
                cleaned.put(out);
            } catch (JSONException e) {
                changed = true;
            }
        }

        return new PruneResult(cleaned, changed);
    }

    private static boolean isHttpEndpoint(String endpoint) {
        return endpoint != null && (endpoint.startsWith("http://") || endpoint.startsWith("https://"));
    }

    private static String deriveTopicFromEndpoint(String endpoint) {
        if (!isHttpEndpoint(endpoint)) {
            return null;
        }

        try {
            Uri uri = Uri.parse(endpoint);
            String lastSegment = uri.getLastPathSegment();
            if (lastSegment == null) {
                return null;
            }
            return lastSegment.trim();
        } catch (Exception e) {
            return null;
        }
    }

    private static String normalizeServerUrl(String serverUrl) {
        if (serverUrl == null) {
            return null;
        }

        String url = serverUrl.trim();
        if (url.isEmpty()) {
            return null;
        }

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }

        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }

        return url;
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // Should never happen on Android
            return Integer.toHexString(input.hashCode());
        }
    }
}
