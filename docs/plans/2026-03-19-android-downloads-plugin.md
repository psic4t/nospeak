# Android Downloads Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a general-purpose Capacitor plugin to save in-memory content to Android's public Downloads folder, enabling chat HTML export on Android.

**Architecture:** Native Java plugin uses MediaStore.Downloads (Android 10+) or legacy Downloads directory (Android 9-). TypeScript wrapper follows existing AndroidMediaCache pattern. ChatExporter detects Android and uses the plugin instead of web blob download.

**Tech Stack:** Kotlin, TypeScript, Capacitor plugin API, MediaStore API, vitest

---

### Task 1: Create AndroidDownloadsPlugin.kt

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/AndroidDownloadsPlugin.kt`

Native plugin with `saveToDownloads(filename, data, mimeType)` method. Uses MediaStore.Downloads on API 29+, legacy Downloads directory on older Android. Returns `{ success: boolean, error?: string }`.

### Task 2: Register plugin in MainActivity

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/MainActivity.java`

Add `registerPlugin(AndroidDownloadsPlugin.class);` in `onCreate()`.

### Task 3: Create AndroidDownloads.ts

**Files:**
- Create: `src/lib/core/AndroidDownloads.ts`

TypeScript interface and helper function. Follows AndroidMediaCache.ts pattern: lazy plugin registration, null on non-Android, `saveToDownloads(filename, data, mimeType?)` wrapper.

### Task 4: Create AndroidDownloads.test.ts

**Files:**
- Create: `src/lib/core/AndroidDownloads.test.ts`

Unit tests with mocked plugin. Test success/failure cases, non-Android returns false.

### Task 5: Modify ChatExporter.ts

**Files:**
- Modify: `src/lib/core/ChatExporter.ts`

Import `isAndroidNative`, `saveToDownloads`, `showToast`. Add `stringToBase64()` helper. In `exportChatToHtml()`: on Android, convert HTML to base64, call plugin, show toast. Keep web blob download unchanged.

### Task 6: Add i18n strings

**Files:**
- Modify: `src/lib/i18n/locales/en.ts`
- Modify: `src/lib/i18n/locales/de.ts`
- Modify: `src/lib/i18n/locales/es.ts`
- Modify: `src/lib/i18n/locales/fr.ts`
- Modify: `src/lib/i18n/locales/ru.ts`
- Modify: `src/lib/i18n/locales/ja.ts`
- Modify: `src/lib/i18n/locales/zh.ts`
- Modify: `src/lib/i18n/locales/ar.ts`
- Modify: `src/lib/i18n/locales/pt.ts`
- Modify: `src/lib/i18n/locales/it.ts`
- Modify: `src/lib/i18n/locales/ko.ts`
- Modify: `src/lib/i18n/locales/tr.ts`
- Modify: `src/lib/i18n/locales/th.ts`
- Modify: `src/lib/i18n/locales/vi.ts`
- Modify: `src/lib/i18n/locales/hi.ts`
- Modify: `src/lib/i18n/locales/bn.ts`
- Modify: `src/lib/i18n/locales/ur.ts`
- Modify: `src/lib/i18n/locales/fa.ts`
- Modify: `src/lib/i18n/locales/he.ts`
- Modify: `src/lib/i18n/locales/nl.ts`
- Modify: `src/lib/i18n/locales/pl.ts`
- Modify: `src/lib/i18n/locales/id.ts`

Add under `chats`:
- `exportSavedToDownloads: 'Saved to Downloads'`
- `exportFailed: 'Failed to save export'`

### Task 7: Validate

Run `npm run check` and `npx vitest run`.
