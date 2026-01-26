package com.nospeak.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;

@CapacitorPlugin(
    name = "AndroidMediaCache",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_IMAGES },
            alias = "readMediaImages"
        ),
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_VIDEO },
            alias = "readMediaVideo"
        ),
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_AUDIO },
            alias = "readMediaAudio"
        ),
        @Permission(
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE },
            alias = "readExternalStorage"
        ),
        @Permission(
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE },
            alias = "writeExternalStorage"
        )
    }
)
public class AndroidMediaCachePlugin extends Plugin {

    private static final String TAG = "AndroidMediaCachePlugin";
    private static final String NOSPEAK_IMAGES_FOLDER = "nospeak images";
    private static final String NOSPEAK_VIDEOS_FOLDER = "nospeak videos";
    private static final String NOSPEAK_AUDIO_FOLDER = "nospeak audio";

    @PluginMethod
    public void saveToCache(PluginCall call) {
        String sha256 = call.getString("sha256");
        String mimeType = call.getString("mimeType");
        String base64Data = call.getString("base64Data");
        String filename = call.getString("filename");

        if (sha256 == null || sha256.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("contentUri", null);
            call.resolve(result);
            return;
        }

        if (base64Data == null || base64Data.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("contentUri", null);
            call.resolve(result);
            return;
        }

        // Check if already cached (by filename pattern)
        try {
            if (isAlreadyCached(sha256, mimeType)) {
                Log.d(TAG, "File already cached, skipping save");
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Error checking existing cache", e);
        }

        // Request permissions if needed
        if (!hasMediaWritePermission()) {
            savedCall = call;
            requestMediaPermissions(call);
            return;
        }

        // Save to MediaStore
        try {
            boolean saved = saveToMediaStore(sha256, mimeType, base64Data, filename);
            JSObject result = new JSObject();
            result.put("success", saved);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error saving to cache", e);
            JSObject result = new JSObject();
            result.put("success", false);
            call.resolve(result);
        }
    }

    private PluginCall savedCall = null;

    private void requestMediaPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ needs granular permissions
            requestPermissionForAlias("readMediaImages", call, "mediaPermissionsCallback");
        } else {
            // Android 12 and below use READ/WRITE_EXTERNAL_STORAGE
            requestPermissionForAlias("writeExternalStorage", call, "mediaPermissionsCallback");
        }
    }

    @PermissionCallback
    private void mediaPermissionsCallback(PluginCall call) {
        if (savedCall != null) {
            // Retry the save operation
            PluginCall originalCall = savedCall;
            savedCall = null;
            saveToCache(originalCall);
        }
    }

    private boolean hasMediaWritePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ can write to MediaStore without permissions for app's own files
            return true;
        } else {
            return getPermissionState("writeExternalStorage") == PermissionState.GRANTED;
        }
    }

    private boolean isAlreadyCached(String sha256, String mimeType) {
        ContentResolver resolver = getContext().getContentResolver();
        String hashPrefix = sha256.substring(0, Math.min(12, sha256.length()));
        
        Uri collection = getMediaCollectionUri(mimeType);
        if (collection == null) {
            return false;
        }

        String[] projection = { MediaStore.MediaColumns._ID };
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        String[] selectionArgs = { hashPrefix + "_%" };

        try (Cursor cursor = resolver.query(collection, projection, selection, selectionArgs, null)) {
            return cursor != null && cursor.moveToFirst();
        } catch (Exception e) {
            Log.e(TAG, "Error querying MediaStore", e);
            return false;
        }
    }

    private boolean saveToMediaStore(String sha256, String mimeType, String base64Data, String filename) {
        ContentResolver resolver = getContext().getContentResolver();
        
        Uri collection = getMediaCollectionUri(mimeType);
        if (collection == null) {
            Log.w(TAG, "Unsupported MIME type for caching: " + mimeType);
            return false;
        }

        String hashPrefix = sha256.substring(0, Math.min(12, sha256.length()));
        String extension = getExtensionForMimeType(mimeType);
        String displayName = hashPrefix + "_" + (filename != null ? filename : "media" + extension);
        String relativePath = getRelativePath(mimeType);

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        }

        Uri uri = resolver.insert(collection, values);
        if (uri == null) {
            Log.e(TAG, "Failed to create MediaStore entry");
            return false;
        }

        try {
            byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
            
            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os != null) {
                    os.write(data);
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            }

            Log.d(TAG, "Saved to MediaStore: " + uri);
            return true;

        } catch (Exception e) {
            Log.e(TAG, "Error writing to MediaStore", e);
            // Clean up on failure
            resolver.delete(uri, null, null);
            return false;
        }
    }

    private Uri getMediaCollectionUri(String mimeType) {
        if (mimeType == null) {
            return null;
        }

        if (mimeType.startsWith("image/")) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            } else {
                return MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            }
        } else if (mimeType.startsWith("video/")) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            } else {
                return MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
            }
        } else if (mimeType.startsWith("audio/")) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            } else {
                return MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            }
        }

        return null;
    }

    private String getRelativePath(String mimeType) {
        if (mimeType == null) {
            return Environment.DIRECTORY_DOWNLOADS + "/" + NOSPEAK_IMAGES_FOLDER;
        }

        if (mimeType.startsWith("image/")) {
            return Environment.DIRECTORY_PICTURES + "/" + NOSPEAK_IMAGES_FOLDER;
        } else if (mimeType.startsWith("video/")) {
            return Environment.DIRECTORY_MOVIES + "/" + NOSPEAK_VIDEOS_FOLDER;
        } else if (mimeType.startsWith("audio/")) {
            return Environment.DIRECTORY_MUSIC + "/" + NOSPEAK_AUDIO_FOLDER;
        }

        return Environment.DIRECTORY_DOWNLOADS + "/" + NOSPEAK_IMAGES_FOLDER;
    }

    private String getExtensionForMimeType(String mimeType) {
        if (mimeType == null) {
            return "";
        }

        switch (mimeType) {
            case "image/jpeg":
                return ".jpg";
            case "image/png":
                return ".png";
            case "image/gif":
                return ".gif";
            case "image/webp":
                return ".webp";
            case "video/mp4":
                return ".mp4";
            case "video/webm":
                return ".webm";
            case "video/quicktime":
                return ".mov";
            case "audio/mpeg":
            case "audio/mp3":
                return ".mp3";
            case "audio/aac":
            case "audio/mp4":
                return ".m4a";
            case "audio/ogg":
                return ".ogg";
            case "audio/wav":
                return ".wav";
            default:
                // Try to extract from mime type
                if (mimeType.contains("/")) {
                    String subtype = mimeType.substring(mimeType.indexOf('/') + 1);
                    if (!subtype.isEmpty() && !subtype.contains("+")) {
                        return "." + subtype;
                    }
                }
                return "";
        }
    }
}
