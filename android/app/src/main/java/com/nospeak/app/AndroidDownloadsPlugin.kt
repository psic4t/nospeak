package com.nospeak.app

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "AndroidDownloads")
class AndroidDownloadsPlugin : Plugin() {

    companion object {
        private const val TAG = "AndroidDownloadsPlugin"
    }

    @PluginMethod
    fun saveToDownloads(call: PluginCall) {
        val filename = call.getString("filename")
        val data = call.getString("data")
        val mimeType = call.getString("mimeType") ?: "text/html"

        if (filename.isNullOrBlank()) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "Missing filename")
            call.resolve(result)
            return
        }

        if (data.isNullOrBlank()) {
            val result = JSObject()
            result.put("success", false)
            result.put("error", "Missing data")
            call.resolve(result)
            return
        }

        try {
            val bytes = Base64.decode(data, Base64.NO_WRAP)

            val success = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveViaMediaStore(filename, mimeType, bytes)
            } else {
                saveViaLegacyDownloads(filename, mimeType, bytes)
            }

            val result = JSObject()
            result.put("success", success)
            if (!success) {
                result.put("error", "Failed to write file")
            }
            call.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to save to Downloads", e)
            val result = JSObject()
            result.put("success", false)
            result.put("error", e.message ?: "Unknown error")
            call.resolve(result)
        }
    }

    private fun saveViaMediaStore(filename: String, mimeType: String, data: ByteArray): Boolean {
        val resolver = context.contentResolver

        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)

        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, mimeType)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }

        val uri: Uri? = resolver.insert(collection, values)

        if (uri == null) {
            Log.e(TAG, "Failed to create MediaStore entry")
            return false
        }

        try {
            resolver.openOutputStream(uri)?.use { outputStream ->
                outputStream.write(data)
            }

            val updateValues = ContentValues().apply {
                put(MediaStore.Downloads.IS_PENDING, 0)
            }
            resolver.update(uri, updateValues, null, null)

            Log.d(TAG, "Saved to Downloads via MediaStore: $uri")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error writing to MediaStore", e)
            resolver.delete(uri, null, null)
            return false
        }
    }

    private fun saveViaLegacyDownloads(filename: String, mimeType: String, data: ByteArray): Boolean {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)

        if (downloadsDir == null) {
            Log.e(TAG, "Downloads directory not available")
            return false
        }

        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }

        val file = File(downloadsDir, filename)

        try {
            FileOutputStream(file).use { outputStream ->
                outputStream.write(data)
            }
            Log.d(TAG, "Saved to Downloads via legacy path: ${file.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error writing to legacy Downloads", e)
            return false
        }
    }
}
