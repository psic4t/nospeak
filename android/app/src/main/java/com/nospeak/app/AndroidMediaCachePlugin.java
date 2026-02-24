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

import org.json.JSONArray;
import org.json.JSONException;

import com.getcapacitor.FileUtils;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

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

    /** Dedicated thread pool for heavy I/O work (fetch + decrypt + MediaStore write). */
    private final ExecutorService backgroundExecutor = Executors.newFixedThreadPool(2);

    /** Shared OkHttp client for fetching ciphertext from blossom servers. */
    private final OkHttpClient httpClient = new OkHttpClient();

    @PluginMethod
    public void loadFromCache(PluginCall call) {
        String sha256 = call.getString("sha256");
        String mimeType = call.getString("mimeType");

        // Validate inputs on the main thread (fast)
        if (sha256 == null || sha256.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("found", false);
            call.resolve(result);
            return;
        }

        try {
            Uri cachedUri = findCachedUri(sha256, mimeType);
            if (cachedUri == null) {
                JSObject result = new JSObject();
                result.put("found", false);
                call.resolve(result);
                return;
            }

            // Convert content:// URI to Capacitor-accessible URL
            String webUrl = FileUtils.getPortablePath(getContext(), getBridge().getLocalUrl(), cachedUri);

            JSObject result = new JSObject();
            result.put("found", true);
            result.put("url", webUrl);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error loading from cache", e);
            JSObject result = new JSObject();
            result.put("found", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void fetchDecryptAndSave(PluginCall call) {
        JSONArray urlsArrayTemp;
        try {
            urlsArrayTemp = call.getArray("urls");
        } catch (Exception e) {
            urlsArrayTemp = null;
        }
        final JSONArray urlsArray = urlsArrayTemp;
        String key = call.getString("key");
        String nonce = call.getString("nonce");
        String sha256 = call.getString("sha256");
        String mimeType = call.getString("mimeType");
        String filename = call.getString("filename");

        // Validate required params on plugin thread
        if (urlsArray == null || urlsArray.length() == 0) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing urls");
            call.resolve(result);
            return;
        }
        if (key == null || key.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing key");
            call.resolve(result);
            return;
        }
        if (nonce == null || nonce.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing nonce");
            call.resolve(result);
            return;
        }
        if (sha256 == null || sha256.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing sha256");
            call.resolve(result);
            return;
        }
        if (mimeType == null || mimeType.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing mimeType");
            call.resolve(result);
            return;
        }

        // Check permissions
        if (!hasMediaWritePermission()) {
            savedCall = call;
            requestMediaPermissions(call);
            return;
        }

        // Check if already cached
        try {
            if (isAlreadyCached(sha256, mimeType)) {
                Log.d(TAG, "fetchDecryptAndSave: already cached, skipping");
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Error checking existing cache", e);
        }

        // Dispatch heavy work to background thread
        backgroundExecutor.execute(() -> {
            try {
                // Decode key and nonce
                byte[] keyBytes = decodeKeyOrNonce(key);
                byte[] nonceBytes = decodeKeyOrNonce(nonce);

                // Validate key size (AES-128 = 16 bytes, AES-256 = 32 bytes)
                if (keyBytes.length != 16 && keyBytes.length != 32) {
                    Log.e(TAG, "fetchDecryptAndSave: invalid key size: " + keyBytes.length);
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("error", "Invalid AES key size: " + keyBytes.length + " bytes");
                    call.resolve(result);
                    return;
                }

                // Fetch ciphertext — try each candidate URL until one succeeds
                byte[] ciphertext = null;
                String lastFetchError = null;
                for (int i = 0; i < urlsArray.length(); i++) {
                    String candidateUrl;
                    try {
                        candidateUrl = urlsArray.getString(i);
                    } catch (JSONException e) {
                        continue;
                    }
                    try {
                        Request request = new Request.Builder().url(candidateUrl).build();
                        Response response = httpClient.newCall(request).execute();
                        ResponseBody body = response.body();
                        if (response.isSuccessful() && body != null) {
                            ciphertext = body.bytes();
                            break;
                        } else {
                            lastFetchError = "HTTP " + response.code() + " from " + candidateUrl;
                            Log.w(TAG, "fetchDecryptAndSave: " + lastFetchError);
                            if (body != null) body.close();
                        }
                    } catch (Exception e) {
                        lastFetchError = e.getMessage() + " from " + candidateUrl;
                        Log.w(TAG, "fetchDecryptAndSave: fetch failed for " + candidateUrl, e);
                    }
                }

                if (ciphertext == null) {
                    Log.e(TAG, "fetchDecryptAndSave: all URLs failed");
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("error", lastFetchError != null ? lastFetchError : "All URLs failed");
                    call.resolve(result);
                    return;
                }

                // Decrypt AES-GCM
                GCMParameterSpec gcmSpec = new GCMParameterSpec(128, nonceBytes);
                SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);
                byte[] plaintext = cipher.doFinal(ciphertext);

                // Resolve wildcard MIME types (e.g. "image/*") to specific types
                String resolvedMimeType = resolveWildcardMimeType(mimeType, plaintext);

                // Write to MediaStore
                boolean saved = saveBytesToMediaStore(sha256, resolvedMimeType, plaintext, filename);
                JSObject result = new JSObject();
                result.put("success", saved);
                if (!saved) {
                    result.put("error", "Failed to write to MediaStore");
                }
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "fetchDecryptAndSave failed", e);
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("error", e.getMessage());
                call.resolve(result);
            }
        });
    }

    /**
     * Write raw bytes to MediaStore using 64KB write chunks.
     */
    private boolean saveBytesToMediaStore(String sha256, String mimeType, byte[] data, String filename) {
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
            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os != null) {
                    int offset = 0;
                    int chunkSize = 65536; // 64KB
                    while (offset < data.length) {
                        int len = Math.min(chunkSize, data.length - offset);
                        os.write(data, offset, len);
                        offset += len;
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            }

            Log.d(TAG, "saveBytesToMediaStore: saved to " + uri);
            return true;

        } catch (Exception e) {
            Log.e(TAG, "Error writing bytes to MediaStore", e);
            resolver.delete(uri, null, null);
            return false;
        }
    }

    @Override
    public void handleOnDestroy() {
        backgroundExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                                 + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    private static byte[] base64UrlToBytes(String input) {
        String b64 = input.replace('-', '+').replace('_', '/');
        int pad = b64.length() % 4;
        if (pad != 0) {
            b64 += "====".substring(pad);
        }
        return Base64.decode(b64, Base64.DEFAULT);
    }

    private static byte[] decodeKeyOrNonce(String input) {
        if (input.matches("^[0-9a-fA-F]+$") && input.length() % 2 == 0) {
            return hexToBytes(input);
        }
        return base64UrlToBytes(input);
    }

    /**
     * Find a cached file by SHA256 prefix and return its content URI.
     * Returns null if not found.
     */
    private Uri findCachedUri(String sha256, String mimeType) {
        ContentResolver resolver = getContext().getContentResolver();
        String hashPrefix = sha256.substring(0, Math.min(12, sha256.length()));
        
        Uri collection = getMediaCollectionUri(mimeType);
        if (collection == null) {
            return null;
        }

        String[] projection = { MediaStore.MediaColumns._ID };
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        String[] selectionArgs = { hashPrefix + "_%" };

        try (Cursor cursor = resolver.query(collection, projection, selection, selectionArgs, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID));
                return Uri.withAppendedPath(collection, String.valueOf(id));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying MediaStore for cached file", e);
        }

        return null;
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
            fetchDecryptAndSave(originalCall);
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

    /**
     * Resolve wildcard MIME types (e.g. "image/*") to a specific type by inspecting
     * the file's magic bytes. Returns the original mimeType if it's already specific.
     */
    private static String resolveWildcardMimeType(String mimeType, byte[] data) {
        if (mimeType == null || !mimeType.contains("*")) {
            return mimeType;
        }

        // Try to detect from magic bytes
        if (data != null && data.length >= 4) {
            // JPEG: FF D8 FF
            if (data[0] == (byte)0xFF && data[1] == (byte)0xD8 && data[2] == (byte)0xFF) {
                return "image/jpeg";
            }
            // PNG: 89 50 4E 47
            if (data[0] == (byte)0x89 && data[1] == (byte)0x50 && data[2] == (byte)0x4E && data[3] == (byte)0x47) {
                return "image/png";
            }
            // GIF: 47 49 46 38
            if (data[0] == (byte)0x47 && data[1] == (byte)0x49 && data[2] == (byte)0x46 && data[3] == (byte)0x38) {
                return "image/gif";
            }
            // WebP: 52 49 46 46 ... 57 45 42 50
            if (data.length >= 12 && data[0] == (byte)0x52 && data[1] == (byte)0x49 && data[2] == (byte)0x46 && data[3] == (byte)0x46
                && data[8] == (byte)0x57 && data[9] == (byte)0x45 && data[10] == (byte)0x42 && data[11] == (byte)0x50) {
                return "image/webp";
            }
            // MP4/MOV: ... 66 74 79 70 (ftyp at offset 4)
            if (data.length >= 8 && data[4] == (byte)0x66 && data[5] == (byte)0x74 && data[6] == (byte)0x79 && data[7] == (byte)0x70) {
                return "video/mp4";
            }
            // WebM/MKV: 1A 45 DF A3
            if (data[0] == (byte)0x1A && data[1] == (byte)0x45 && data[2] == (byte)0xDF && data[3] == (byte)0xA3) {
                return "video/webm";
            }
            // MP3: FF FB, FF F3, FF F2, or ID3
            if ((data[0] == (byte)0xFF && (data[1] == (byte)0xFB || data[1] == (byte)0xF3 || data[1] == (byte)0xF2))
                || (data[0] == (byte)0x49 && data[1] == (byte)0x44 && data[2] == (byte)0x33)) {
                return "audio/mpeg";
            }
            // OGG: 4F 67 67 53
            if (data[0] == (byte)0x4F && data[1] == (byte)0x67 && data[2] == (byte)0x67 && data[3] == (byte)0x53) {
                return "audio/ogg";
            }
            // WAV: 52 49 46 46 ... 57 41 56 45
            if (data.length >= 12 && data[0] == (byte)0x52 && data[1] == (byte)0x49 && data[2] == (byte)0x46 && data[3] == (byte)0x46
                && data[8] == (byte)0x57 && data[9] == (byte)0x41 && data[10] == (byte)0x56 && data[11] == (byte)0x45) {
                return "audio/wav";
            }
        }

        // Fallback: use the category from the wildcard (e.g., "image/*" -> "image/jpeg")
        if (mimeType.startsWith("image/")) return "image/jpeg";
        if (mimeType.startsWith("video/")) return "video/mp4";
        if (mimeType.startsWith("audio/")) return "audio/mpeg";

        return "application/octet-stream";
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
