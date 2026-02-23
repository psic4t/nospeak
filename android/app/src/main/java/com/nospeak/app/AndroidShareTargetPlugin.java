package com.nospeak.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

@CapacitorPlugin(name = "AndroidShareTarget")
public class AndroidShareTargetPlugin extends Plugin {

    private static final String TAG = "AndroidShareTarget";
    private static final int MAX_SHARE_BYTES = 25 * 1024 * 1024; // 25 MiB safety limit
    private static final int JPEG_QUALITY = 85;

    @PluginMethod
    public void getInitialShare(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject payload = extractSharePayload(intent);
        if (payload == null) {
            call.resolve();
            return;
        }

        // Clear the intent so we do not process the same share twice
        getActivity().setIntent(new Intent(getContext(), getActivity().getClass()));
        call.resolve(payload);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject payload = extractSharePayload(intent);
        if (payload != null) {
            notifyListeners("shareReceived", payload, true);
        }
    }

    private JSObject extractSharePayload(Intent intent) {
        if (intent == null) {
            return null;
        }

        String action = intent.getAction();
        String type = intent.getType();
        if (!Intent.ACTION_SEND.equals(action) || type == null) {
            return null;
        }

        // Extract target conversation ID from Direct Share shortcut (if present)
        // The shortcut ID contains the conversation ID (full for groups, truncated for 1-on-1)
        String targetConversationId = null;
        String shortcutId = intent.getStringExtra(Intent.EXTRA_SHORTCUT_ID);
        if (shortcutId != null && shortcutId.startsWith("chat_")) {
            targetConversationId = shortcutId.substring(5); // Remove "chat_" prefix
        }

        if (type.startsWith("text/")) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text == null || text.length() == 0) {
                return null;
            }
            JSObject payload = new JSObject();
            payload.put("kind", "text");
            payload.put("text", text.toString());
            if (targetConversationId != null) {
                payload.put("targetConversationId", targetConversationId);
            }
            return payload;
        }

        if (type.startsWith("image/") || type.startsWith("video/") || type.startsWith("audio/")) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri == null) {
                return null;
            }

            // Claim read permission for the shared content URI.
            // On Android 11+ gallery apps grant temporary access via
            // FLAG_GRANT_READ_URI_PERMISSION; we must ensure the resolver
            // can actually open the stream before attempting to read.
            try {
                getContext().getContentResolver().takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            } catch (SecurityException e) {
                // Not all providers support persistable permissions.
                // The intent-level grant may still be sufficient, so we
                // fall through and let openInputStream() try.
                Log.d(TAG, "takePersistableUriPermission not supported for URI, relying on intent grant", e);
            }

            String mediaType;
            if (type.startsWith("image/")) {
                mediaType = "image";
            } else if (type.startsWith("video/")) {
                mediaType = "video";
            } else {
                mediaType = "audio";
            }

            try {
                MediaData data = readMediaFromUri(uri, type);
                if (data == null) {
                    return null;
                }

                JSObject payload = new JSObject();
                payload.put("kind", "media");
                payload.put("mediaType", mediaType);
                payload.put("mimeType", data.mimeType);
                payload.put("fileName", data.fileName);
                payload.put("base64", data.base64);
                if (targetConversationId != null) {
                    payload.put("targetConversationId", targetConversationId);
                }
                return payload;
            } catch (SecurityException e) {
                Log.e(TAG, "Permission denied reading shared media URI", e);
                return createErrorPayload("Cannot access shared file. Permission was denied.");
            } catch (IOException e) {
                Log.e(TAG, "IO error reading shared media URI", e);
                return createErrorPayload("Failed to read shared file.");
            }
        }

        // Unsupported type
        return null;
    }

    private static JSObject createErrorPayload(String message) {
        JSObject payload = new JSObject();
        payload.put("kind", "error");
        payload.put("message", message);
        return payload;
    }

    private MediaData readMediaFromUri(Uri uri, String mimeType) throws IOException, SecurityException {
        ContentResolver resolver = getContext().getContentResolver();
        String resolvedMime = resolver.getType(uri);
        if (resolvedMime == null || resolvedMime.contains("*")) {
            resolvedMime = mimeType;
        }
        if (resolvedMime == null || resolvedMime.contains("*")) {
            resolvedMime = "application/octet-stream";
        }

        String fileName = "shared";
        Cursor cursor = null;
        try {
            cursor = resolver.query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String name = cursor.getString(nameIndex);
                    if (name != null && !name.isEmpty()) {
                        fileName = name;
                    }
                }
            }
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        InputStream in = null;
        ByteArrayOutputStream out = null;
        try {
            in = resolver.openInputStream(uri);
            if (in == null) {
                return null;
            }
            out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            int total = 0;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > MAX_SHARE_BYTES) {
                    // Treat oversized content as unsupported for now
                    return null;
                }
                out.write(buffer, 0, read);
            }
            byte[] rawBytes = out.toByteArray();

            // Transcode HEIC/HEIF images to JPEG for WebView compatibility.
            // Android's BitmapFactory can decode HEIC (API 28+) but WebView
            // based on Chromium cannot render it, so we convert before passing
            // the base64 payload to the web layer.
            if (isHeicFormat(resolvedMime, fileName)) {
                Bitmap bitmap = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.length);
                if (bitmap != null) {
                    try {
                        ByteArrayOutputStream jpegOut = new ByteArrayOutputStream();
                        bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, jpegOut);
                        rawBytes = jpegOut.toByteArray();
                        resolvedMime = "image/jpeg";
                        fileName = fileName.replaceAll("(?i)\\.(heic|heif)$", ".jpg");
                        Log.d(TAG, "Transcoded HEIC/HEIF image to JPEG");
                    } finally {
                        bitmap.recycle();
                    }
                } else {
                    Log.w(TAG, "BitmapFactory could not decode HEIC/HEIF image, passing raw bytes");
                }
            }

            String base64 = Base64.encodeToString(rawBytes, Base64.NO_WRAP);
            MediaData data = new MediaData();
            data.fileName = fileName;
            data.mimeType = resolvedMime;
            data.base64 = base64;
            return data;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (IOException ignored) { }
            }
            if (out != null) {
                try {
                    out.close();
                } catch (IOException ignored) { }
            }
        }
    }

    /**
     * Check if the image is HEIC/HEIF format by MIME type or file extension.
     * Google Photos commonly shares images in this format which Android's
     * WebView cannot render.
     */
    private static boolean isHeicFormat(String mime, String fileName) {
        if (mime != null) {
            String lower = mime.toLowerCase();
            if (lower.startsWith("image/heic") || lower.startsWith("image/heif")) {
                return true;
            }
        }
        if (fileName != null) {
            String lower = fileName.toLowerCase();
            if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
                return true;
            }
        }
        return false;
    }

    private static class MediaData {
        String fileName;
        String mimeType;
        String base64;
    }
}
