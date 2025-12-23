package com.nospeak.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class AndroidUnifiedPushPrefsTest {

    @Test
    public void removeRegistrationsForPackageFromJsonRemovesAllMatchingEntries() throws Exception {
        JSONArray registrations = new JSONArray();

        registrations.put(new JSONObject()
                .put("token", "t1")
                .put("packageName", "org.example")
                .put("endpoint", "https://server/up_t1"));
        registrations.put(new JSONObject()
                .put("token", "t2")
                .put("packageName", "org.other")
                .put("endpoint", "https://server/up_t2"));
        registrations.put(new JSONObject()
                .put("token", "t3")
                .put("packageName", "org.example")
                .put("endpoint", "https://server/up_t3"));

        JSONArray filtered = AndroidUnifiedPushPrefs.removeRegistrationsForPackageFromJson(registrations, "org.example");

        assertEquals(1, filtered.length());
        assertEquals("t2", filtered.optJSONObject(0).optString("token"));
    }
}
