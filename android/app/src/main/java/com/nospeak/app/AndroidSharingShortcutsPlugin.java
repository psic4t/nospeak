package com.nospeak.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;
import android.net.Uri;

import androidx.appcompat.content.res.AppCompatResources;
import android.os.Build;
import android.util.Log;

import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Capacitor plugin for publishing Android Sharing Shortcuts.
 * Allows contacts to appear directly in the Android share sheet.
 */
@CapacitorPlugin(name = "AndroidSharingShortcuts")
public class AndroidSharingShortcutsPlugin extends Plugin {

    private static final String LOG_TAG = "SharingShortcuts";
    private static final String SHARE_TARGET_CATEGORY = "com.nospeak.app.category.SHARE_TARGET";
    private static final int AVATAR_SIZE_PX = 192; // Match NativeBackgroundMessagingService for full-size icons
    private static final int MAX_SHORTCUTS = 4;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Publish sharing shortcuts for the given contacts.
     * Contacts will appear in the Android share sheet for direct sharing.
     * 
     * Expected input:
     * {
     *   "contacts": [
     *     { "conversationId": "npub1...", "displayName": "Alice", "avatarUrl": "https://..." },
     *     ...
     *   ]
     * }
     */
    @PluginMethod
    public void publishShortcuts(PluginCall call) {
        // API 29+ required for sharing shortcuts
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.resolve();
            return;
        }

        JSArray contactsArray = call.getArray("contacts");
        if (contactsArray == null || contactsArray.length() == 0) {
            call.resolve();
            return;
        }

        // Process on background thread to avoid blocking
        executor.execute(() -> {
            try {
                List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
                Set<String> newShortcutIds = new HashSet<>();
                int count = Math.min(contactsArray.length(), MAX_SHORTCUTS);

                for (int i = 0; i < count; i++) {
                    try {
                        JSONObject contact = contactsArray.getJSONObject(i);
                        ShortcutInfoCompat shortcut = buildShortcut(contact, i);
                        if (shortcut != null) {
                            shortcuts.add(shortcut);
                            newShortcutIds.add(shortcut.getId());
                        }
                    } catch (JSONException e) {
                        Log.w(LOG_TAG, "Failed to parse contact at index " + i, e);
                    }
                }

                if (!shortcuts.isEmpty()) {
                    // Remove stale cached/long-lived shortcuts that are no longer in the top contacts.
                    // removeAllDynamicShortcuts only removes shortcuts from the dynamic set;
                    // long-lived shortcuts remain cached by Android and still appear in the share sheet.
                    // We must explicitly remove them with removeLongLivedShortcuts.
                    try {
                        List<ShortcutInfoCompat> existing = ShortcutManagerCompat.getShortcuts(
                                getContext(),
                                ShortcutManagerCompat.FLAG_MATCH_DYNAMIC
                                        | ShortcutManagerCompat.FLAG_MATCH_CACHED);
                        List<String> staleIds = new ArrayList<>();
                        for (ShortcutInfoCompat s : existing) {
                            if (!newShortcutIds.contains(s.getId())) {
                                staleIds.add(s.getId());
                            }
                        }
                        if (!staleIds.isEmpty()) {
                            ShortcutManagerCompat.removeLongLivedShortcuts(getContext(), staleIds);
                            Log.d(LOG_TAG, "Removed " + staleIds.size() + " stale cached shortcuts");
                        }
                    } catch (Exception e) {
                        Log.w(LOG_TAG, "Failed to clean up stale shortcuts", e);
                    }

                    // Clear all existing dynamic shortcuts and set the new ones
                    ShortcutManagerCompat.removeAllDynamicShortcuts(getContext());
                    ShortcutManagerCompat.setDynamicShortcuts(getContext(), shortcuts);
                    Log.d(LOG_TAG, "Published " + shortcuts.size() + " sharing shortcuts");
                }

                // Resolve on main thread
                getActivity().runOnUiThread(call::resolve);

            } catch (Exception e) {
                Log.e(LOG_TAG, "Failed to publish shortcuts", e);
                getActivity().runOnUiThread(call::resolve);
            }
        });
    }

    private ShortcutInfoCompat buildShortcut(JSONObject contact, int rank) {
        String conversationId = contact.optString("conversationId", null);
        String displayName = contact.optString("displayName", null);
        String avatarUrl = contact.optString("avatarUrl", null);

        if (conversationId == null || conversationId.isEmpty()) {
            return null;
        }

        if (displayName == null || displayName.isEmpty()) {
            // Use truncated conversation ID as fallback
            displayName = conversationId.length() > 12 
                ? conversationId.substring(0, 12) + "..." 
                : conversationId;
        }

        // Use truncated ID to stay within Android's ~65 char limit
        // Groups: full 16-char ID, 1-on-1: first 50 chars of npub
        String shortcutId;
        if (conversationId.length() > 50) {
            shortcutId = "chat_" + conversationId.substring(0, 50);
        } else {
            shortcutId = "chat_" + conversationId;
        }

        // Build Person for the shortcut
        Person.Builder personBuilder = new Person.Builder()
                .setName(displayName)
                .setKey(conversationId);

        // Try to load avatar
        Bitmap avatar = null;
        if ("group_default".equals(avatarUrl)) {
            // Load vector drawable and convert to bitmap
            Drawable drawable = AppCompatResources.getDrawable(getContext(), R.drawable.ic_group_avatar);
            if (drawable != null) {
                avatar = Bitmap.createBitmap(AVATAR_SIZE_PX, AVATAR_SIZE_PX, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(avatar);
                drawable.setBounds(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
                drawable.draw(canvas);
            }
        } else if (avatarUrl != null && !avatarUrl.isEmpty()) {
            // First try cached avatar from profile prefs
            avatar = loadCachedAvatar(conversationId);
            
            // If no cached avatar, try to load from URL (blocking, but we're on background thread)
            if (avatar == null) {
                avatar = loadAvatarFromUrl(avatarUrl);
            }
        }

        if (avatar != null) {
            Bitmap circularAvatar = makeCircular(avatar);
            IconCompat icon = IconCompat.createWithBitmap(circularAvatar);
            personBuilder.setIcon(icon);
        }

        Person person = personBuilder.build();

        // Build the intent that will be fired when user selects this shortcut from share sheet
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction(Intent.ACTION_SEND);
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        intent.setData(Uri.parse("nospeak://chat/" + conversationId));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("nospeak_route_kind", "chat");
        intent.putExtra("nospeak_conversation_id", conversationId);

        // Build the shortcut
        Set<String> categories = new HashSet<>(Collections.singletonList(SHARE_TARGET_CATEGORY));

        return new ShortcutInfoCompat.Builder(getContext(), shortcutId)
                .setShortLabel(displayName)
                .setLongLabel(displayName)
                .setIntent(intent)
                .setLongLived(true)
                .setRank(rank)
                .setPerson(person)
                .setCategories(categories)
                .setIcon(avatar != null ? IconCompat.createWithAdaptiveBitmap(avatar) : null)
                .build();
    }

    /**
     * Try to load avatar from the profile cache (SharedPreferences).
     * This is fast and doesn't require network.
     */
    private Bitmap loadCachedAvatar(String conversationId) {
        // The conversation ID for 1-on-1 chats is the npub, we need the hex pubkey
        // For simplicity, we'll skip the cache lookup here since we get avatarUrl from web layer
        return null;
    }

    /**
     * Load avatar from URL. This is a blocking operation.
     */
    private Bitmap loadAvatarFromUrl(String urlString) {
        if (urlString == null || urlString.isEmpty()) {
            return null;
        }

        HttpURLConnection connection = null;
        InputStream inputStream = null;

        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setDoInput(true);
            connection.connect();

            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return null;
            }

            inputStream = connection.getInputStream();
            Bitmap bitmap = BitmapFactory.decodeStream(inputStream);

            if (bitmap != null) {
                // Scale to appropriate size
                return Bitmap.createScaledBitmap(bitmap, AVATAR_SIZE_PX, AVATAR_SIZE_PX, true);
            }

            return null;

        } catch (IOException e) {
            Log.w(LOG_TAG, "Failed to load avatar from " + urlString, e);
            return null;
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (IOException ignored) {}
            }
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * Make a bitmap circular (for contact avatars).
     */
    private Bitmap makeCircular(Bitmap source) {
        int size = Math.min(source.getWidth(), source.getHeight());
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);

        Canvas canvas = new Canvas(output);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));

        float radius = size / 2f;
        canvas.drawCircle(radius, radius, radius, paint);

        return output;
    }
}
