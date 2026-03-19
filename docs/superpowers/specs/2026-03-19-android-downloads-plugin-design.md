# Design: Android Downloads Plugin

**Date:** 2026-03-19
**Status:** Approved
**Scope:** General-purpose plugin to save in-memory content to Android's public Downloads folder

## Problem

The chat HTML export feature (`ChatExporter.ts`) uses web blob download which doesn't work in Android WebView. Users on Android native app cannot export their chats.

## Solution

Create a general-purpose Capacitor plugin that saves in-memory content (base64-encoded) to the Android public Downloads folder, visible in the system Downloads app.

## Design

### 1. Native Plugin: `AndroidDownloadsPlugin.java`

**Location:** `android/app/src/main/java/com/nospeak/app/AndroidDownloadsPlugin.java`

**API:**
```java
@PluginMethod
public void saveToDownloads(PluginCall call)
```

**Parameters:**
- `filename` (string, required) - Target filename, e.g., `nospeak-chat-2026-03-19.html`
- `data` (string, required) - Base64-encoded content
- `mimeType` (string, optional, default `text/html`)

**Returns:**
```json
{ "success": true } | { "success": false, "error": "error message" }
```

**Implementation Details:**

| Android Version | Approach | Permissions |
|-----------------|----------|-------------|
| Android 10+ (API 29+) | `MediaStore.Downloads` collection with `RELATIVE_PATH = Environment.DIRECTORY_DOWNLOADS` | None (scoped storage) |
| Android 9 and below | `Environment.getExternalStoragePublicDirectory(DIRECTORY_DOWNLOADS)` | `WRITE_EXTERNAL_STORAGE` (already in manifest) |

**No new permissions required.**

### 2. TypeScript Interface: `AndroidDownloads.ts`

**Location:** `src/lib/core/AndroidDownloads.ts`

**API:**
```typescript
interface AndroidDownloadsPlugin {
  saveToDownloads(options: {
    filename: string;
    data: string;  // base64
    mimeType?: string;
  }): Promise<{ success: boolean; error?: string }>;
}

export async function saveToDownloads(
  filename: string,
  data: string,  // base64
  mimeType?: string
): Promise<boolean>
```

**Pattern:** Follows existing `AndroidMediaCache.ts`:
- Lazy plugin registration via `registerPlugin`
- Returns `null` on non-Android platforms
- Helper function wraps plugin call with error handling

### 3. ChatExporter Integration

**Location:** `src/lib/core/ChatExporter.ts`

**Changes:**

1. Import `isAndroidNative` from `NativeDialogs` and `saveToDownloads` from `AndroidDownloads`
2. Import `showToast` from `$lib/stores/toast`
3. Add helper function to convert string to base64:
   ```typescript
   function stringToBase64(str: string): string {
     return btoa(unescape(encodeURIComponent(str)));
   }
   ```
4. Modify `exportChatToHtml()`:
   - **On Android:**
     - Convert HTML string to base64
     - Call `saveToDownloads(filename, base64Data, 'text/html')`
     - Show toast: success → "Saved to Downloads", failure → "Failed to save export"
   - **On web:** Keep existing blob download logic unchanged

### 4. Plugin Registration

**Location:** `android/app/src/main/java/com/nospeak/app/MainActivity.java`

Add to `onCreate()`:
```java
registerPlugin(AndroidDownloadsPlugin.class);
```

### 5. i18n Strings

**Location:** All locale files in `src/lib/i18n/locales/`

Add under `chats`:
```typescript
exportSavedToDownloads: 'Saved to Downloads',
exportFailed: 'Failed to save export',
```

## Files Changed

| File | Action |
|------|--------|
| `android/app/src/main/java/com/nospeak/app/AndroidDownloadsPlugin.java` | Create |
| `src/lib/core/AndroidDownloads.ts` | Create |
| `src/lib/core/AndroidDownloads.test.ts` | Create |
| `android/app/src/main/java/com/nospeak/app/MainActivity.java` | Modify (add plugin registration) |
| `src/lib/core/ChatExporter.ts` | Modify (use plugin on Android) |
| `src/lib/i18n/locales/*.ts` | Modify (add i18n strings) |

## Testing

1. Unit tests for `AndroidDownloads.ts` (mocked plugin)
2. Manual test on Android device:
   - Export a chat
   - Verify file appears in Downloads app
   - Verify file content is correct HTML
   - Verify toast shows on success/failure

## Future Use

This plugin is general-purpose and can be reused for:
- Saving decrypted media to Downloads
- Exporting other data formats (JSON, CSV, etc.)
- Any scenario requiring in-memory content saved to user-accessible storage
