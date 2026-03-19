package com.nospeak.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "AndroidDownloads")
public class AndroidDownloadsPlugin extends Plugin {

    private static final String TAG = "AndroidDownloadsPlugin";

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "text/html");

        if (filename == null || filename.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing filename");
            call.resolve(result);
            return;
        }

        if (data == null || data.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Missing data");
            call.resolve(result);
            return;
        }

        try {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);

            boolean success;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                success = saveViaMediaStore(filename, mimeType, bytes);
            } else {
                success = saveViaLegacyDownloads(filename, mimeType, bytes);
            }

            JSObject result = new JSObject();
            result.put("success", success);
            if (!success) {
                result.put("error", "Failed to write file");
            }
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Failed to save to Downloads", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", e.getMessage() != null ? e.getMessage() : "Unknown error");
            call.resolve(result);
        }
    }

    private boolean saveViaMediaStore(String filename, String mimeType, byte[] data) {
        android.content.ContentResolver resolver = getContext().getContentResolver();

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri uri = resolver.insert(collection, values);

        if (uri == null) {
            Log.e(TAG, "Failed to create MediaStore entry");
            return false;
        }

        try {
            java.io.OutputStream outputStream = resolver.openOutputStream(uri);
            if (outputStream == null) {
                Log.e(TAG, "Failed to open output stream for MediaStore entry");
                resolver.delete(uri, null, null);
                return false;
            }
            try {
                outputStream.write(data);
            } finally {
                outputStream.close();
            }

            ContentValues updateValues = new ContentValues();
            updateValues.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, updateValues, null, null);

            Log.d(TAG, "Saved to Downloads via MediaStore: " + uri);
            return true;

        } catch (Exception e) {
            Log.e(TAG, "Error writing to MediaStore", e);
            resolver.delete(uri, null, null);
            return false;
        }
    }

    private boolean saveViaLegacyDownloads(String filename, String mimeType, byte[] data) {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);

        if (downloadsDir == null) {
            Log.e(TAG, "Downloads directory not available");
            return false;
        }

        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs();
        }

        File file = new File(downloadsDir, filename);

        try {
            FileOutputStream outputStream = new FileOutputStream(file);
            try {
                outputStream.write(data);
            } finally {
                outputStream.close();
            }
            Log.d(TAG, "Saved to Downloads via legacy path: " + file.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error writing to legacy Downloads", e);
            return false;
        }
    }
}
