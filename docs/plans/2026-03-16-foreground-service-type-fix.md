# Foreground Service Type Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix crash caused by Android 15+ `dataSync` 6-hour foreground service time limit by switching to `specialUse|systemExempted` (matching Conversations XMPP client) and adding defense-in-depth error handling.

**Architecture:** Change the foreground service type from `dataSync` to `specialUse|systemExempted` in the manifest and `startForeground()` call. Add try/catch guards around all `startForeground()` / `startForegroundService()` call sites. Add `onTimeout()` override as a safety net.

**Tech Stack:** Android SDK (Java), Capacitor

**Reference:** Conversations XMPP client uses the same pattern — see `codeberg.org/iNPUTmice/Conversations` `AndroidManifest.xml`

---

### Task 1: Update AndroidManifest.xml permissions and service type

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml:28-29` (permissions) and `:99-104` (service declaration)

**Step 1: Replace the permission declarations**

In `AndroidManifest.xml`, replace:

```xml
<!-- Required for dataSync foreground service on Android 14+ / targetSdk 35 -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
```

with:

```xml
<!-- Required for specialUse + systemExempted foreground service on Android 14+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED" />
```

**Step 2: Replace the service declaration**

Replace:

```xml
<!-- Native foreground service for Android background messaging -->
<service
    android:name=".NativeBackgroundMessagingService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="dataSync" />
```

with:

```xml
<!-- Native foreground service for Android background messaging -->
<service
    android:name=".NativeBackgroundMessagingService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="specialUse|systemExempted">
    <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="nostr-dm" />
</service>
```

**Step 3: Verify the manifest is valid XML**

Run: `cd android && ./gradlew processDebugManifest 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

---

### Task 2: Update startForeground() in NativeBackgroundMessagingService

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

**Step 1: Add the ServiceInfo import**

After the existing import block (around line 31, near `android.service.notification.StatusBarNotification`), add:

```java
import android.content.pm.ServiceInfo;
```

**Step 2: Add ForegroundServiceStartNotAllowedException import**

In the same import block, add:

```java
import android.app.ForegroundServiceStartNotAllowedException;
```

**Step 3: Wrap the startForeground() call with try/catch and explicit service type**

At line 424-425, replace:

```java
            Notification notification = buildNotification(currentSummary);
            startForeground(NOTIFICATION_ID, notification);
```

with:

```java
            Notification notification = buildNotification(currentSummary);
            try {
                startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } catch (Exception e) {
                Log.e(LOG_TAG, "startForeground failed, stopping service", e);
                stopSelf();
                return START_NOT_STICKY;
            }
```

Note: We catch generic `Exception` rather than just `ForegroundServiceStartNotAllowedException` because the latter was added in API 31 and there may be other OEM-specific exceptions. The `ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE` constant explicitly passes the service type at runtime (required on Android 14+). We do NOT pass `systemExempted` here — the system applies it automatically when the app is on the doze allowlist.

---

### Task 3: Add onTimeout() override

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

**Step 1: Add onTimeout override**

Add this method directly after the `onBind()` method (after line 479):

```java
    @Override
    public void onTimeout(int startId, int fgsType) {
        Log.w(LOG_TAG, "onTimeout called by system, fgsType=" + fgsType + "; stopping service");
        stopSelf();
    }
```

This is a safety net. With `specialUse|systemExempted` there should be no timeout, but if the system ever calls it (e.g. user revokes battery optimization and some future Android version enforces a limit on `specialUse`), the service stops gracefully instead of being force-killed.

---

### Task 4: Guard BootCompletedReceiver

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/BootCompletedReceiver.java:22-28`

**Step 1: Wrap startForegroundService in try/catch**

Replace lines 22-28:

```java
        Intent serviceIntent = AndroidBackgroundMessagingPrefs.buildStartServiceIntent(context);
        if (serviceIntent == null) {
            return;
        }

        ContextCompat.startForegroundService(context, serviceIntent);
```

with:

```java
        Intent serviceIntent = AndroidBackgroundMessagingPrefs.buildStartServiceIntent(context);
        if (serviceIntent == null) {
            return;
        }

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            // System may block foreground service start on boot for certain service types.
            // Fail silently; service will start when user opens the app.
        }
```

---

### Task 5: Guard AndroidBackgroundMessagingPlugin startForegroundService calls

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/AndroidBackgroundMessagingPlugin.java:67,84,230`

**Step 1: Guard the start() call at line 67**

Replace:

```java
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }
```

(end of `start()` method, around line 67-68) with:

```java
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            call.reject("Failed to start foreground service: " + e.getMessage());
            return;
        }
        call.resolve();
    }
```

**Step 2: Guard the update() call at line 84**

Replace:

```java
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }
```

(end of `update()` method, around line 84-85) with:

```java
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            call.reject("Failed to update foreground service: " + e.getMessage());
            return;
        }
        call.resolve();
    }
```

**Step 3: Guard the setActiveConversation() call at line 230**

Replace:

```java
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }
```

(end of `setActiveConversation()` method, around line 230-231) with:

```java
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception e) {
            call.reject("Failed to set active conversation: " + e.getMessage());
            return;
        }
        call.resolve();
    }
```

---

### Task 6: Build and verify

**Step 1: Run full build**

Run: `npm run build && cd android && ./gradlew assembleDebug 2>&1 | tail -20`
Expected: BUILD SUCCESSFUL

**Step 2: Run checks**

Run: `npm run check`
Expected: No errors (TypeScript side is unaffected but verify nothing broke)

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml \
        android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java \
        android/app/src/main/java/com/nospeak/app/BootCompletedReceiver.java \
        android/app/src/main/java/com/nospeak/app/AndroidBackgroundMessagingPlugin.java
git commit -m "fix(android): switch foreground service type from dataSync to specialUse|systemExempted

dataSync has a 6-hour cumulative time limit on Android 15+ which causes
ForegroundServiceStartNotAllowedException crashes when the system restarts
the START_STICKY service after quota exhaustion.

Switch to specialUse|systemExempted (matching Conversations XMPP client)
which has no time limit. Add defense-in-depth: try/catch around all
startForeground/startForegroundService calls, and onTimeout() override."
```
