package com.nospeak.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "AndroidUnifiedPush")
public class AndroidUnifiedPushPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String serverUrl = call.getString("serverUrl");
        JSArray topicsArray = call.getArray("topics");

        if (serverUrl == null || serverUrl.isEmpty()) {
            call.reject("serverUrl is required");
            return;
        }

        String[] topics = new String[0];
        if (topicsArray != null) {
            try {
                int length = topicsArray.length();
                topics = new String[length];
                for (int i = 0; i < length; i++) {
                    String topic = topicsArray.getString(i);
                    topics[i] = topic != null ? topic : "";
                }
            } catch (JSONException e) {
                call.reject("Invalid topics array", e);
                return;
            }
        }

        AndroidUnifiedPushPrefs.saveStartConfig(getContext(), serverUrl, topics);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_START);
        intent.putExtra(AndroidUnifiedPushService.EXTRA_SERVER_URL, serverUrl);
        intent.putExtra(AndroidUnifiedPushService.EXTRA_TOPICS, topics);

        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        AndroidUnifiedPushPrefs.setEnabled(getContext(), false);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void addTopic(PluginCall call) {
        String topic = call.getString("topic");
        if (topic == null || topic.isEmpty()) {
            call.reject("topic is required");
            return;
        }

        String[] currentTopics = AndroidUnifiedPushPrefs.getTopics(getContext());
        String[] newTopics = new String[currentTopics.length + 1];
        System.arraycopy(currentTopics, 0, newTopics, 0, currentTopics.length);
        newTopics[currentTopics.length] = topic;

        AndroidUnifiedPushPrefs.setTopics(getContext(), newTopics);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_UPDATE_TOPICS);
        intent.putExtra(AndroidUnifiedPushService.EXTRA_TOPICS, newTopics);
        ContextCompat.startForegroundService(getContext(), intent);

        call.resolve();
    }

    @PluginMethod
    public void removeTopic(PluginCall call) {
        String topic = call.getString("topic");
        if (topic == null || topic.isEmpty()) {
            call.reject("topic is required");
            return;
        }

        String[] currentTopics = AndroidUnifiedPushPrefs.getTopics(getContext());
        String[] newTopics = new String[currentTopics.length - 1];
        int newIndex = 0;
        for (String currentTopic : currentTopics) {
            if (!currentTopic.equals(topic)) {
                newTopics[newIndex++] = currentTopic;
            }
        }

        AndroidUnifiedPushPrefs.setTopics(getContext(), newTopics);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_UPDATE_TOPICS);
        intent.putExtra(AndroidUnifiedPushService.EXTRA_TOPICS, newTopics);
        ContextCompat.startForegroundService(getContext(), intent);

        call.resolve();
    }

    @PluginMethod
    public void getRegistrations(PluginCall call) {
        JSONArray registrationsJson = AndroidUnifiedPushPrefs.getRegistrationsAsJsonArray(getContext());
        JSArray jsArray = new JSArray();
        for (int i = 0; i < registrationsJson.length(); i++) {
            try {
                JSONObject reg = registrationsJson.getJSONObject(i);
                JSObject jsReg = new JSObject();
                jsReg.put("token", reg.optString("token", ""));

                String packageName = reg.optString("packageName", "");
                jsReg.put("packageName", packageName);

                jsReg.put("endpoint", reg.optString("endpoint", ""));
                jsReg.put("vapidKey", reg.optString("vapidKey", ""));
                jsReg.put("message", reg.optString("message", ""));
                jsReg.put("topic", reg.optString("topic", ""));

                Boolean installed = getPackageInstalledState(packageName);
                if (installed != null) {
                    jsReg.put("installed", installed);
                    jsReg.put("removable", !installed);
                } else {
                    jsReg.put("removable", false);
                }

                jsArray.put(jsReg);
            } catch (JSONException e) {
            }
        }
        JSObject result = new JSObject();
        result.put("registrations", jsArray);
        call.resolve(result);
    }

    @PluginMethod
    public void removeRegistration(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            call.reject("token is required");
            return;
        }

        AndroidUnifiedPushPrefs.removeRegistration(getContext(), token);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_REFRESH_REGISTRATIONS);
        ContextCompat.startForegroundService(getContext(), intent);

        call.resolve();
    }

    @PluginMethod
    public void updateNotificationSummary(PluginCall call) {
        String summary = call.getString("summary", null);
        if (summary == null) {
            call.reject("summary is required");
            return;
        }

        AndroidUnifiedPushPrefs.saveSummary(getContext(), summary);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_UPDATE);
        intent.putExtra(AndroidUnifiedPushService.EXTRA_SUMMARY, summary);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void testPush(PluginCall call) {
        String serverUrl = call.getString("serverUrl");
        if (serverUrl == null || serverUrl.isEmpty()) {
            call.reject("serverUrl is required");
            return;
        }

        AndroidUnifiedPushPrefs.saveServerUrl(getContext(), serverUrl);

        Intent intent = new Intent(getContext(), AndroidUnifiedPushService.class);
        intent.setAction(AndroidUnifiedPushService.ACTION_TEST_PUSH);
        intent.putExtra(AndroidUnifiedPushService.EXTRA_SERVER_URL, serverUrl);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void getConfig(PluginCall call) {
        AndroidUnifiedPushPrefs.Config config = AndroidUnifiedPushPrefs.load(getContext());
        JSObject result = new JSObject();
        result.put("enabled", config.enabled);
        result.put("serverUrl", config.serverUrl);
        
        JSArray topicsJson = new JSArray();
        if (config.topics != null) {
            for (String topic : config.topics) {
                topicsJson.put(topic);
            }
        }
        result.put("topics", topicsJson);
        
        call.resolve(result);
    }

    private Boolean getPackageInstalledState(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return Boolean.FALSE;
        }

        PackageManager pm = getContext().getPackageManager();
        try {
            pm.getPackageInfo(packageName, 0);
            return Boolean.TRUE;
        } catch (PackageManager.NameNotFoundException e) {
            // Could be uninstalled or not visible due to Android package visibility rules.
            // Treat as unknown to avoid false "Uninstalled" labels.
            return null;
        } catch (SecurityException e) {
            // Not allowed to query package state -> unknown
            return null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
