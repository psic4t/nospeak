# Android Lockscreen Ringing Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop auto-accepting incoming voice calls after a PIN unlock; instead, show a dedicated ringing-screen Activity over the keyguard with explicit Accept/Decline buttons (WhatsApp-style).

**Architecture:** Add a new native Android Activity (`IncomingCallActivity`) that becomes the target of the incoming-call notification's full-screen intent. Show it over the keyguard via `setShowWhenLocked(true)` + `setTurnScreenOn(true)`. Only call `requestDismissKeyguard()` after the user explicitly taps Accept. The existing JS auto-accept path (`incomingCallAcceptHandler.ts`) remains correct because tapping Accept on the ringing screen IS an explicit user choice. The notification's action buttons and content intent keep their current PendingIntent (the auto-accept path) so heads-up Accept on an unlocked phone still connects immediately — no regression. A new broadcast (`ACTION_CALL_CANCELLED`) lets the messaging service tell the activity to dismiss when the caller hangs up.

**Tech Stack:** Android Java (API 24+), Capacitor 8, Svelte 5, WebRTC (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-27-android-lockscreen-ringing-screen-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `android/app/src/main/java/com/nospeak/app/IncomingCallActivity.java` | NEW | Lockscreen ringing screen activity: shows over keyguard, owns Accept/Decline UX, owns 60s timeout, listens for cancel broadcasts |
| `android/app/src/main/res/layout/activity_incoming_call.xml` | NEW | Native layout: avatar, name, Accept/Decline buttons |
| `android/app/src/main/res/drawable/bg_incoming_call.xml` | NEW | Dark gradient/solid background for the ringing screen |
| `android/app/src/main/res/drawable/bg_call_button_accept.xml` | NEW | Green circular button background |
| `android/app/src/main/res/drawable/bg_call_button_decline.xml` | NEW | Red circular button background |
| `android/app/src/main/res/drawable/ic_call_avatar_placeholder.xml` | NEW | Default avatar placeholder (vector, person silhouette) |
| `android/app/src/main/res/values/styles.xml` | EDIT | Add `Theme.IncomingCall` |
| `android/app/src/main/res/values/colors.xml` | NEW (or edit if exists) | Call button colors |
| `android/app/src/main/AndroidManifest.xml` | EDIT | Register `IncomingCallActivity` with `showWhenLocked`, `turnScreenOn`, etc. |
| `android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java` | EDIT | Change full-screen intent to target `IncomingCallActivity`; pre-resolve avatar file path |
| `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` | EDIT | (a) On hangup-while-no-active-call, broadcast `ACTION_CALL_CANCELLED` and clean up; (b) expose static avatar PNG file path resolver |

**No JS / Svelte / Capacitor-plugin changes.**

---

## Decisions Resolved From Spec

1. **Avatar resolver placement:** add a `static String resolveCachedAvatarFilePath(Context, String pictureUrl)` method on `NativeBackgroundMessagingService` (lightweight: it just builds the path under `cacheDir/nospeak_avatar_cache/<computeAvatarKey(url)>.png` and returns it if the file exists). No identicon fallback in the activity — use a static placeholder drawable. Reasoning: avoids extracting a util class, avoids needing service state from the activity, and the existing message-notification path still uses identicons (no regression).
2. **Layout primitives:** plain `ImageView` + `androidx.core.graphics.drawable.RoundedBitmapDrawableFactory.create(...).setCircular(true)` for the circular avatar. `androidx.core` is already on the classpath; no new dependency.
3. **Cancel broadcast insertion site:** in `handleVoiceCallRumor()`, BEFORE the `if (!"offer".equals(action))` early return at line 2695, add a `hangup` branch that — when the action is `hangup` and the persisted SharedPrefs offer's callId matches the rumor's callId — clears the SharedPrefs, cancels the notification, and broadcasts `ACTION_CALL_CANCELLED`.
4. **Pre-API-27 fallback:** required (`minSdk = 24`). Use `WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | FLAG_TURN_SCREEN_ON` on API 24-26; modern API methods on API 27+.

---

## Conventions

- **Indentation:** 4 spaces (matches existing AGENTS.md rule).
- **Java imports:** existing files use a mix of explicit imports and FQNs for one-offs. Follow each file's style.
- **Logging:** use `android.util.Log` with a per-class `TAG` constant matching the pattern in sibling classes (e.g., `"IncomingCallActivity"`).
- **No-op / silent paths:** log at `Log.d`, never throw.
- **Commits:** Conventional Commits with `(android)` scope per AGENTS.md, e.g. `feat(android): add IncomingCallActivity scaffold`.

---

## Task 1: Add color resources for call buttons

**Files:**
- Modify or create: `android/app/src/main/res/values/colors.xml`

- [ ] **Step 1: Check whether colors.xml exists**

Run: `ls android/app/src/main/res/values/colors.xml 2>/dev/null && echo EXISTS || echo MISSING`

- [ ] **Step 2: If MISSING, create the file. If EXISTS, edit and add only the four new color entries (skip duplicates).**

If creating new, write the full file:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="incoming_call_bg">#FF101820</color>
    <color name="incoming_call_text">#FFFFFFFF</color>
    <color name="incoming_call_accept">#FF1FA855</color>
    <color name="incoming_call_decline">#FFD93636</color>
</resources>
```

If editing existing, add only the four `<color>` entries above (inside `<resources>`). Skip any name that already exists.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/values/colors.xml
git commit -m "feat(android): add color resources for incoming-call ringing screen"
```

---

## Task 2: Add background and button drawables

**Files:**
- Create: `android/app/src/main/res/drawable/bg_incoming_call.xml`
- Create: `android/app/src/main/res/drawable/bg_call_button_accept.xml`
- Create: `android/app/src/main/res/drawable/bg_call_button_decline.xml`
- Create: `android/app/src/main/res/drawable/ic_call_avatar_placeholder.xml`

- [ ] **Step 1: Write `bg_incoming_call.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/incoming_call_bg" />
</shape>
```

- [ ] **Step 2: Write `bg_call_button_accept.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="@color/incoming_call_accept" />
</shape>
```

- [ ] **Step 3: Write `bg_call_button_decline.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="@color/incoming_call_decline" />
</shape>
```

- [ ] **Step 4: Write `ic_call_avatar_placeholder.xml`**

A simple person silhouette on a circular gray background.

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="96dp"
    android:height="96dp"
    android:viewportWidth="96"
    android:viewportHeight="96">
    <path
        android:fillColor="#FF2A3441"
        android:pathData="M48,48m-48,0a48,48 0,1 1,96 0a48,48 0,1 1,-96 0" />
    <path
        android:fillColor="#FF8B97A8"
        android:pathData="M48,46m-14,0a14,14 0,1 1,28 0a14,14 0,1 1,-28 0" />
    <path
        android:fillColor="#FF8B97A8"
        android:pathData="M22,80c0,-14 12,-22 26,-22s26,8 26,22z" />
</vector>
```

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/res/drawable/bg_incoming_call.xml \
        android/app/src/main/res/drawable/bg_call_button_accept.xml \
        android/app/src/main/res/drawable/bg_call_button_decline.xml \
        android/app/src/main/res/drawable/ic_call_avatar_placeholder.xml
git commit -m "feat(android): add ringing-screen drawables"
```

---

## Task 3: Add `Theme.IncomingCall` to styles.xml

**Files:**
- Modify: `android/app/src/main/res/values/styles.xml`

- [ ] **Step 1: Append the new theme inside `<resources>` (after the existing `AppTheme.NoActionBarLaunch` style, before `</resources>`)**

```xml
    <style name="Theme.IncomingCall" parent="Theme.AppCompat.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowShowWallpaper">false</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@color/incoming_call_bg</item>
        <item name="android:windowBackground">@drawable/bg_incoming_call</item>
    </style>
```

- [ ] **Step 2: Verify the file parses by running a no-op gradle resource validation**

Run: `cd android && ./gradlew :app:processDebugResources --no-daemon -q 2>&1 | tail -20`

If you don't have an Android SDK / gradle wrapper available, skip this verification — it will be caught in Task 11's full build.

Expected: no errors mentioning `styles.xml`. Warnings are OK.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/values/styles.xml
git commit -m "feat(android): add Theme.IncomingCall for ringing screen"
```

---

## Task 4: Create the ringing-screen layout

**Files:**
- Create: `android/app/src/main/res/layout/activity_incoming_call.xml`

- [ ] **Step 1: Write the layout**

Vertical `LinearLayout` filling the screen. Caption at top, avatar centered, name below avatar, Accept/Decline buttons at bottom.

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/incoming_call_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center_horizontal"
    android:background="@drawable/bg_incoming_call"
    android:fitsSystemWindows="true"
    android:padding="24dp">

    <View
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1" />

    <TextView
        android:id="@+id/incoming_call_caption"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Incoming call"
        android:textColor="@color/incoming_call_text"
        android:textSize="16sp"
        android:alpha="0.85"
        android:layout_marginBottom="24dp" />

    <ImageView
        android:id="@+id/incoming_call_avatar"
        android:layout_width="120dp"
        android:layout_height="120dp"
        android:contentDescription="Caller avatar"
        android:src="@drawable/ic_call_avatar_placeholder"
        android:layout_marginBottom="20dp" />

    <TextView
        android:id="@+id/incoming_call_name"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center"
        android:textColor="@color/incoming_call_text"
        android:textSize="28sp"
        android:textStyle="bold"
        android:singleLine="true"
        android:ellipsize="end"
        android:text="" />

    <View
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="2" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center"
        android:layout_marginBottom="48dp">

        <FrameLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center">

            <ImageButton
                android:id="@+id/incoming_call_decline"
                android:layout_width="72dp"
                android:layout_height="72dp"
                android:layout_gravity="center"
                android:background="@drawable/bg_call_button_decline"
                android:src="@drawable/ic_call_end"
                android:scaleType="center"
                android:contentDescription="Decline call"
                android:tint="@color/incoming_call_text" />
        </FrameLayout>

        <FrameLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center">

            <ImageButton
                android:id="@+id/incoming_call_accept"
                android:layout_width="72dp"
                android:layout_height="72dp"
                android:layout_gravity="center"
                android:background="@drawable/bg_call_button_accept"
                android:src="@drawable/ic_stat_call"
                android:scaleType="center"
                android:contentDescription="Accept call"
                android:tint="@color/incoming_call_text" />
        </FrameLayout>
    </LinearLayout>
</LinearLayout>
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/res/layout/activity_incoming_call.xml
git commit -m "feat(android): add activity_incoming_call layout"
```

---

## Task 5: Implement `IncomingCallActivity` (scaffold + lifecycle + UI binding)

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/IncomingCallActivity.java`

This task creates the activity with all its responsibilities: show-over-keyguard window flags, UI binding, intent extra extraction, broadcast receiver registration, 60s self-timeout, Accept/Decline handlers. We do this all in one file in one task because splitting the activity across tasks creates fragile half-states.

- [ ] **Step 1: Write the full file**

```java
package com.nospeak.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.graphics.drawable.RoundedBitmapDrawable;
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory;

/**
 * Lockscreen ringing screen for incoming voice calls.
 *
 * Launched as the target of {@link IncomingCallNotification}'s full-screen intent.
 * Shows the call UI over the keyguard WITHOUT dismissing it. PIN entry is only
 * requested after the user explicitly taps Accept ({@link KeyguardManager#requestDismissKeyguard}).
 *
 * After successful keyguard dismissal, launches {@link MainActivity} with
 * {@code accept_pending_call=true} — the existing JS handler ({@code incomingCallAcceptHandler.ts})
 * then auto-accepts. The "auto" is correct here because the user explicitly tapped
 * Accept on this screen.
 *
 * Decline broadcasts to {@link IncomingCallActionReceiver} (same path as the
 * notification's existing Decline action) and finishes — phone stays locked.
 *
 * Auto-finishes on:
 *   - 60s self-timeout (matches CALL_OFFER_TIMEOUT_MS in JS)
 *   - {@link #ACTION_CALL_CANCELLED} broadcast (sent by NativeBackgroundMessagingService
 *     when the caller hangs up before the user answers)
 *   - Stale/missing pending offer in SharedPrefs at onCreate
 */
public class IncomingCallActivity extends Activity {

    private static final String TAG = "IncomingCallActivity";

    public static final String EXTRA_CALL_ID = "call_id";
    public static final String EXTRA_PEER_NAME = "peer_name";
    public static final String EXTRA_SENDER_NPUB = "sender_npub";
    public static final String EXTRA_SENDER_PUBKEY_HEX = "sender_pubkey_hex";
    public static final String EXTRA_AVATAR_PATH = "avatar_path";

    /** Sent by NativeBackgroundMessagingService when the caller hangs up while ringing. */
    public static final String ACTION_CALL_CANCELLED =
        "com.nospeak.app.action.INCOMING_CALL_CANCELLED";

    private static final long RINGING_TIMEOUT_MS = 60_000L;

    private String callId;
    private String peerName;
    private String senderNpub;
    private String senderPubkeyHex;
    private String avatarPath;

    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = new Runnable() {
        @Override
        public void run() {
            Log.d(TAG, "60s ringing timeout — finishing");
            finishAndRemoveTask();
        }
    };

    private BroadcastReceiver cancelReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        applyShowWhenLockedFlags();

        setContentView(R.layout.activity_incoming_call);

        readExtras(getIntent());
        if (!hasValidPendingOffer()) {
            Log.d(TAG, "No valid pending offer — finishing immediately");
            finishAndRemoveTask();
            return;
        }

        bindUi();
        registerCancelReceiver();
        timeoutHandler.postDelayed(timeoutRunnable, RINGING_TIMEOUT_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // singleInstance — a second call replacing the first arrives here.
        readExtras(intent);
        if (!hasValidPendingOffer()) {
            finishAndRemoveTask();
            return;
        }
        bindUi();
        // Reset the timeout for the new offer.
        timeoutHandler.removeCallbacks(timeoutRunnable);
        timeoutHandler.postDelayed(timeoutRunnable, RINGING_TIMEOUT_MS);
    }

    @Override
    protected void onDestroy() {
        timeoutHandler.removeCallbacks(timeoutRunnable);
        if (cancelReceiver != null) {
            try {
                unregisterReceiver(cancelReceiver);
            } catch (IllegalArgumentException ignored) {
                // Receiver was never registered (e.g., early-return finish).
            }
            cancelReceiver = null;
        }
        super.onDestroy();
    }

    // --- Setup helpers ---------------------------------------------------

    @SuppressWarnings("deprecation")
    private void applyShowWhenLockedFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private void readExtras(Intent intent) {
        if (intent == null) return;
        callId = intent.getStringExtra(EXTRA_CALL_ID);
        peerName = intent.getStringExtra(EXTRA_PEER_NAME);
        senderNpub = intent.getStringExtra(EXTRA_SENDER_NPUB);
        senderPubkeyHex = intent.getStringExtra(EXTRA_SENDER_PUBKEY_HEX);
        avatarPath = intent.getStringExtra(EXTRA_AVATAR_PATH);
    }

    private boolean hasValidPendingOffer() {
        if (callId == null || callId.isEmpty()) return false;
        SharedPreferences prefs = getSharedPreferences(
            "nospeak_pending_incoming_call", MODE_PRIVATE);
        String storedCallId = prefs.getString("callId", null);
        if (storedCallId == null || !storedCallId.equals(callId)) {
            return false;
        }
        long expiresAt = prefs.getLong("expiresAt", 0L);
        long nowSec = System.currentTimeMillis() / 1000L;
        if (expiresAt > 0 && expiresAt < nowSec) {
            return false;
        }
        return true;
    }

    private void bindUi() {
        TextView nameView = findViewById(R.id.incoming_call_name);
        if (nameView != null) {
            nameView.setText(peerName != null ? peerName : "");
        }

        ImageView avatarView = findViewById(R.id.incoming_call_avatar);
        if (avatarView != null && avatarPath != null && !avatarPath.isEmpty()) {
            Bitmap bmp = BitmapFactory.decodeFile(avatarPath);
            if (bmp != null) {
                RoundedBitmapDrawable d = RoundedBitmapDrawableFactory.create(getResources(), bmp);
                d.setCircular(true);
                avatarView.setImageDrawable(d);
            }
        }

        ImageButton accept = findViewById(R.id.incoming_call_accept);
        if (accept != null) {
            accept.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { onAcceptClicked(); }
            });
        }

        ImageButton decline = findViewById(R.id.incoming_call_decline);
        if (decline != null) {
            decline.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { onDeclineClicked(); }
            });
        }
    }

    private void registerCancelReceiver() {
        cancelReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String cancelledCallId = intent.getStringExtra(EXTRA_CALL_ID);
                if (cancelledCallId == null || cancelledCallId.equals(callId)) {
                    Log.d(TAG, "ACTION_CALL_CANCELLED received — finishing");
                    finishAndRemoveTask();
                }
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_CALL_CANCELLED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(cancelReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(cancelReceiver, filter);
        }
    }

    // --- Action handlers -------------------------------------------------

    private void onAcceptClicked() {
        Log.d(TAG, "Accept tapped for callId=" + callId);
        timeoutHandler.removeCallbacks(timeoutRunnable);

        final Runnable launchMain = new Runnable() {
            @Override
            public void run() {
                Intent i = new Intent(IncomingCallActivity.this, MainActivity.class)
                    .setAction(Intent.ACTION_VIEW)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra("accept_pending_call", true)
                    .putExtra("call_id", callId)
                    .putExtra("nospeak_route_kind", "voice-call-accept");
                startActivity(i);
                finishAndRemoveTask();
            }
        };

        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isKeyguardLocked()
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    Log.d(TAG, "Keyguard dismissed — launching MainActivity");
                    launchMain.run();
                }

                @Override
                public void onDismissCancelled() {
                    Log.d(TAG, "Keyguard dismiss cancelled by user — staying on ringing screen");
                    // Re-arm the timeout (we cleared it above).
                    timeoutHandler.postDelayed(timeoutRunnable, RINGING_TIMEOUT_MS);
                }

                @Override
                public void onDismissError() {
                    Log.w(TAG, "Keyguard dismiss error — falling through to launch MainActivity");
                    launchMain.run();
                }
            });
        } else {
            launchMain.run();
        }
    }

    private void onDeclineClicked() {
        Log.d(TAG, "Decline tapped for callId=" + callId);
        timeoutHandler.removeCallbacks(timeoutRunnable);

        Intent broadcast = new Intent(this, IncomingCallActionReceiver.class)
            .setAction(IncomingCallActionReceiver.ACTION_DECLINE)
            .putExtra(IncomingCallActionReceiver.EXTRA_CALL_ID, callId)
            .putExtra(IncomingCallActionReceiver.EXTRA_SENDER_NPUB, senderNpub)
            .putExtra(IncomingCallActionReceiver.EXTRA_SENDER_PUBKEY_HEX, senderPubkeyHex);
        sendBroadcast(broadcast);

        finishAndRemoveTask();
    }
}
```

- [ ] **Step 2: Verify the file compiles by running a Java syntax check**

If the Android Gradle Plugin is set up locally:

Run: `cd android && ./gradlew :app:compileDebugJavaWithJavac --no-daemon -q 2>&1 | tail -40`

Expected: BUILD SUCCESSFUL (the activity is referenced from no other Java code yet, but it must compile in isolation).

If gradle is not available locally, defer the check to Task 11.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/IncomingCallActivity.java
git commit -m "feat(android): add IncomingCallActivity ringing screen"
```

---

## Task 6: Register `IncomingCallActivity` in AndroidManifest.xml

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml:135-136`

- [ ] **Step 1: Add the new activity registration just BEFORE `</application>` (after the `IncomingCallActionReceiver` block at line 132-135)**

The exact insertion: between `</receiver>` on line 135 and `</application>` on line 136. Before:

```xml
        <!-- Decline action from the incoming-call notification -->
        <receiver
            android:name=".IncomingCallActionReceiver"
            android:enabled="true"
            android:exported="false" />
    </application>
```

After:

```xml
        <!-- Decline action from the incoming-call notification -->
        <receiver
            android:name=".IncomingCallActionReceiver"
            android:enabled="true"
            android:exported="false" />

        <!-- Lockscreen ringing screen for incoming voice calls.
             Targeted by IncomingCallNotification's full-screen intent. -->
        <activity
            android:name=".IncomingCallActivity"
            android:exported="false"
            android:launchMode="singleInstance"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:theme="@style/Theme.IncomingCall"
            android:turnScreenOn="true"
            android:showWhenLocked="true"
            android:screenOrientation="portrait"
            android:configChanges="orientation|screenSize|keyboardHidden|keyboard|smallestScreenSize|screenLayout|uiMode|navigation|density" />
    </application>
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): register IncomingCallActivity in manifest"
```

---

## Task 7: Add static avatar-path resolver to `NativeBackgroundMessagingService`

The static helper builds `cacheDir/nospeak_avatar_cache/<computeAvatarKey(url)>.png` and returns the absolute path if the file exists. We mirror the logic of the existing private `computeAvatarKey` and `getAvatarCacheDir` methods, but keep them static and Context-based so `IncomingCallNotification` can call without a service instance.

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` — append new static methods after `computeAvatarKey` (around line 1623)

- [ ] **Step 1: Find the exact location to insert. Read the file around line 1623 to find the end of the existing `computeAvatarKey` method.**

Run: read `NativeBackgroundMessagingService.java` lines 1610-1690 and identify the `}` that ends `computeAvatarKey`.

- [ ] **Step 2: Insert two new static methods directly after `computeAvatarKey`'s closing brace**

```java
    /**
     * Static accessor for the cached avatar PNG file path, usable without a
     * running service instance. Returns the absolute path if the file exists,
     * otherwise null.
     *
     * Used by {@link IncomingCallNotification} to pass an avatar to the
     * lockscreen ringing screen ({@link IncomingCallActivity}) via Intent extra
     * (cache-file path is safer than embedding a Bitmap in extras).
     */
    public static String resolveCachedAvatarFilePath(Context ctx, String pictureUrl) {
        if (ctx == null || pictureUrl == null || pictureUrl.isEmpty()) {
            return null;
        }
        String key = computeAvatarKeyStatic(pictureUrl);
        if (key == null) {
            return null;
        }
        File dir = new File(ctx.getCacheDir(), "nospeak_avatar_cache");
        File file = new File(dir, key + ".png");
        if (!file.exists()) {
            return null;
        }
        return file.getAbsolutePath();
    }

    /**
     * Static mirror of {@link #computeAvatarKey(String)} for use without a
     * service instance. MUST stay byte-identical in output to the instance
     * version so the same cached file resolves under either call site.
     */
    private static String computeAvatarKeyStatic(String url) {
        if (url == null) return null;
        String trimmed = url.trim();
        if (trimmed.isEmpty()) return null;
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(trimmed.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            return null;
        }
    }
```

- [ ] **Step 3: Verify `computeAvatarKeyStatic` matches the existing instance `computeAvatarKey`**

Run: read `NativeBackgroundMessagingService.java` around line 1623 to inspect the existing `computeAvatarKey` method's hashing logic.

If the existing method uses a different algorithm (e.g., MD5 or some non-SHA-256 scheme, or different encoding), update `computeAvatarKeyStatic` to match exactly. The two MUST produce identical output for the same input — otherwise the static path resolver will look for files that don't exist.

If the existing method uses SHA-256 + lowercase hex of UTF-8 bytes, the code above is already correct.

If they differ, modify `computeAvatarKeyStatic` to mirror the existing implementation. Do NOT modify the existing instance method.

- [ ] **Step 4: Verify imports**

`File` is already imported (used elsewhere in the file). Confirm via:

Run: `grep -n "^import java.io.File" android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

Expected: at least one match. If absent, add `import java.io.File;` to the import block. (`Context` is also already imported.)

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java
git commit -m "feat(android): add static avatar-path resolver for ringing screen"
```

---

## Task 8: Wire the full-screen intent in `IncomingCallNotification` to `IncomingCallActivity`

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java`

This is the actual fix. The notification's full-screen intent currently points to `acceptPi` (auto-accept). We change it to point to a new `ringingPi` that targets `IncomingCallActivity`. Action buttons + content intent stay on `acceptPi` so heads-up Accept on an unlocked phone still connects immediately.

- [ ] **Step 1: Update the `post(...)` method signature to accept an optional avatar URL hint**

Currently:
```java
public static void post(
    Context context,
    String callId,
    String peerName,
    String senderNpub,
    String senderPubkeyHex,
    boolean appVisible
)
```

We need the sender's profile picture URL to resolve the cached avatar. The simplest approach is to look it up inside `post(...)` itself using the same pattern `NativeBackgroundMessagingService.handleVoiceCallRumor` uses (lines 2722-2729):

```java
AndroidProfileCachePrefs.Identity identity =
    AndroidProfileCachePrefs.get(context, senderPubkeyHex);
String pictureUrl = identity != null ? identity.pictureUrl : null;
String avatarPath = NativeBackgroundMessagingService.resolveCachedAvatarFilePath(context, pictureUrl);
```

This avoids changing the `post(...)` signature, which has a single caller (`NativeBackgroundMessagingService.handleVoiceCallRumor:2732`) but cleaner not to ripple the change.

- [ ] **Step 2: Add the imports needed**

Open `IncomingCallNotification.java`. After the existing imports, ensure these are present (add any that are missing):

```java
import com.nospeak.app.AndroidProfileCachePrefs;
```

Note: `AndroidProfileCachePrefs` is in the same package (`com.nospeak.app`) so the import is technically optional but recommended for clarity. If using same-package access, no import needed.

- [ ] **Step 3: Modify the `post(...)` method**

Locate (lines 33-91). After `createChannelIfNeeded(context);` on line 41 and BEFORE the `acceptIntent` construction at line 43, insert:

```java
        // Resolve cached avatar (best-effort) for the lockscreen ringing screen.
        String avatarPath = null;
        try {
            AndroidProfileCachePrefs.Identity identity =
                AndroidProfileCachePrefs.get(context, senderPubkeyHex);
            String pictureUrl = identity != null ? identity.pictureUrl : null;
            avatarPath = NativeBackgroundMessagingService.resolveCachedAvatarFilePath(
                context, pictureUrl);
        } catch (Throwable t) {
            // Best-effort — fall back to placeholder.
        }

        // Full-screen intent → IncomingCallActivity (the lockscreen ringing screen).
        // This is what gets triggered when the screen is locked. The activity shows
        // Accept/Decline over the keyguard WITHOUT dismissing it.
        Intent ringingIntent = new Intent(context, IncomingCallActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
            .putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId)
            .putExtra(IncomingCallActivity.EXTRA_PEER_NAME, peerName)
            .putExtra(IncomingCallActivity.EXTRA_SENDER_NPUB, senderNpub)
            .putExtra(IncomingCallActivity.EXTRA_SENDER_PUBKEY_HEX, senderPubkeyHex);
        if (avatarPath != null) {
            ringingIntent.putExtra(IncomingCallActivity.EXTRA_AVATAR_PATH, avatarPath);
        }
        PendingIntent ringingPi = PendingIntent.getActivity(
            context, 2, ringingIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
```

- [ ] **Step 4: Change the `setFullScreenIntent` line to use `ringingPi` instead of `acceptPi`**

Locate line 75:
```java
            .setFullScreenIntent(acceptPi, true)
```

Change to:
```java
            .setFullScreenIntent(ringingPi, true)
```

Leave lines 76-78 (`setContentIntent(acceptPi)`, the Accept action button using `acceptPi`, the Decline action button using `declinePi`) UNCHANGED.

- [ ] **Step 5: Verify by reading the modified `post(...)` method end-to-end**

Run: read `IncomingCallNotification.java` lines 33-100. Confirm:
- `acceptPi` is still constructed (still used for content intent and Accept action)
- `declinePi` is still constructed (still used for Decline action)
- `ringingPi` is constructed with `IncomingCallActivity` as target
- `setFullScreenIntent(ringingPi, true)` is the only place `ringingPi` is used
- `setContentIntent(acceptPi)` — UNCHANGED
- `addAction(R.drawable.ic_stat_call, "Accept", acceptPi)` — UNCHANGED
- `addAction(R.drawable.ic_call_end, "Decline", declinePi)` — UNCHANGED

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java
git commit -m "fix(android): route full-screen intent to ringing screen, not auto-accept

Previously, the incoming-call notification's full-screen intent pointed
straight at the Accept PendingIntent. On a locked phone, this dumped the
user into the PIN screen and auto-accepted the call after PIN entry — the
user never got to choose.

The full-screen intent now targets the new IncomingCallActivity, which
shows Accept/Decline over the keyguard without dismissing it. PIN entry
only happens after an explicit Accept tap (matches WhatsApp / Signal).

The notification's Accept action button and content intent still point at
the auto-accept PendingIntent, preserving correct UX in the heads-up case
on an unlocked phone."
```

---

## Task 9: Broadcast `ACTION_CALL_CANCELLED` from `NativeBackgroundMessagingService` on remote hangup

The current `handleVoiceCallRumor` discards non-`offer` actions at line 2696. When the caller hangs up before the user answers, the `hangup` rumor is silently dropped — the ringing screen will only finish via its 60s timeout. We add a hangup branch that runs BEFORE the early return.

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java:2693-2698`

- [ ] **Step 1: Read the relevant block to locate the exact insertion point**

Run: read `NativeBackgroundMessagingService.java` lines 2680-2700.

Confirm the structure: `if (!"offer".equals(action))` early return is preceded by the NIP-40 expiration check.

- [ ] **Step 2: Insert the hangup-while-no-active-call branch BEFORE the early return**

Find this block (around lines 2693-2698):

```java
        // Only 'offer' actions while the app is closed produce notifications.
        if (!"offer".equals(action)) {
            Log.d(LOG_TAG, "[VoiceCall] Discarding action='" + action + "' while app closed");
            return;
        }
```

Replace with:

```java
        // Hangup-while-ringing: if the caller cancels before the user answers,
        // dismiss the ringing screen and the incoming-call notification.
        if ("hangup".equals(action) || "reject".equals(action) || "busy".equals(action)) {
            handleRemoteCallCancellation(callId);
            return;
        }

        // Only 'offer' actions while the app is closed produce notifications.
        if (!"offer".equals(action)) {
            Log.d(LOG_TAG, "[VoiceCall] Discarding action='" + action + "' while app closed");
            return;
        }
```

- [ ] **Step 3: Add the `handleRemoteCallCancellation` helper method**

Insert directly after `handleVoiceCallRumor()`'s closing brace (around line 2740, before `sendVoiceCallReject` on line 2755):

```java
    /**
     * Cleans up after a remote hangup/reject/busy received while the local user
     * has a pending incoming-call ringing (i.e., the offer is in SharedPrefs and
     * the IncomingCallActivity / notification may be showing).
     *
     * Only acts if the rumor's callId matches the persisted pending offer's
     * callId — this avoids stale broadcasts from unrelated calls.
     */
    private void handleRemoteCallCancellation(String callId) {
        if (callId == null || callId.isEmpty()) return;

        SharedPreferences prefs = getSharedPreferences(
            "nospeak_pending_incoming_call", MODE_PRIVATE);
        String pendingCallId = prefs.getString("callId", null);
        if (pendingCallId == null || !pendingCallId.equals(callId)) {
            Log.d(LOG_TAG, "[VoiceCall] Remote cancel for non-pending callId; ignoring. "
                + "incoming=" + callId + " pending=" + pendingCallId);
            return;
        }

        Log.d(LOG_TAG, "[VoiceCall] Remote cancel for pending callId=" + callId
            + " — clearing prefs, dismissing notification, broadcasting cancel");

        // Clear the pending-offer SharedPrefs so a later cold-start tap doesn't
        // try to accept a dead call.
        prefs.edit().clear().apply();

        // Dismiss the incoming-call notification.
        IncomingCallNotification.cancel(this);

        // Tell the ringing activity to finish (no-op if not running).
        Intent broadcast = new Intent(IncomingCallActivity.ACTION_CALL_CANCELLED)
            .setPackage(getPackageName())
            .putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
        sendBroadcast(broadcast);
    }
```

- [ ] **Step 4: Verify imports**

`SharedPreferences` and `Intent` are already imported in this file. Confirm:

Run: `grep -nE "^import android.content.SharedPreferences|^import android.content.Intent" android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

Expected: matches for both. If either is missing, add it.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java
git commit -m "feat(android): broadcast call-cancellation on remote hangup while ringing

When the caller hangs up before the local user answers, the messaging
service now broadcasts ACTION_CALL_CANCELLED. The new IncomingCallActivity
(ringing screen) listens for this and finishes itself — previously the
ringing screen would only dismiss via its 60s timeout."
```

---

## Task 10: Run the existing JS test suite to confirm no JS regression

The plan touches no JS, but we run the tests as a defence in depth.

- [ ] **Step 1: Run the type checker**

Run: `npm run check`

Expected: 0 errors. (Same baseline as before this plan started.)

- [ ] **Step 2: Run the JS unit tests**

Run: `npx vitest run`

Expected: same pass/fail baseline as before. No new failures.

- [ ] **Step 3: If any new failures appear, STOP**

Investigate before continuing. The JS layer should be untouched; new failures indicate either an accidental edit or a build cache issue. Do not commit any "fixes" — investigate root cause first.

- [ ] **Step 4: No commit needed (no files changed in this task)**

---

## Task 11: Build the Android APK and verify compilation

This is the first end-to-end build of the new code together.

- [ ] **Step 1: Build the debug APK**

Run: `npm run build && npx cap sync android`

Then:

Run: `cd android && ./gradlew :app:assembleDebug --no-daemon 2>&1 | tail -60`

Expected: `BUILD SUCCESSFUL`. Lint warnings are OK. Errors are not.

- [ ] **Step 2: If the build fails, fix in place**

Common fixes:
- Missing import in IncomingCallActivity.java → add it
- `RoundedBitmapDrawableFactory` not resolved → confirm `androidx.core:core` is on the classpath (it is per build.gradle line 4)
- Theme parent not found → confirm `Theme.AppCompat.NoActionBar` exists (it does, AppCompat is on the classpath)
- Unused import warnings → not errors, ignore

If a fix requires editing a file, do it minimally and re-run the build. Each fix should be its own commit:

```bash
git add <files>
git commit -m "fix(android): <specific fix description>"
```

- [ ] **Step 3: Once `BUILD SUCCESSFUL`, no commit needed (no source changes if build passed first try)**

---

## Task 12: Manual end-to-end smoke test on device

Required scenarios (matrix from the spec). Execute each and check the result. Use two devices if you have them, or a Nostr peer, to originate calls.

Setup:
- Install the new debug APK on a physical Android device or emulator with API ≥ 24.
- Sign in. Have a peer ready who can place voice calls to you.
- Grant the `USE_FULL_SCREEN_INTENT` permission when prompted (Settings → Apps → nospeak → Permissions on Android 14+ if not auto-granted).

- [ ] **Step 1: Test #1 — Locked, accept, PIN, connects**

Lock the phone with PIN. Have peer call. Expected: ringing screen appears over keyguard with Accept/Decline buttons (NOT the PIN screen). Tap Accept. Expected: PIN prompt. Enter PIN. Expected: MainActivity opens, audio engages.

- [ ] **Step 2: Test #2 — Locked, decline, stays locked**

Lock with PIN. Peer calls. Tap Decline on ringing screen. Expected: ringing screen dismisses, phone stays locked (no PIN prompt). Peer eventually sees timeout (60s, Phase A).

- [ ] **Step 3: Test #3 — Locked, ignore for 60s**

Lock with PIN. Peer calls. Do nothing. Expected: after ~60s, ringing screen dismisses; notification dismisses.

- [ ] **Step 4: Test #4 — Locked, peer hangs up while ringing**

Lock with PIN. Peer calls and immediately hangs up after a couple seconds. Expected: ringing screen dismisses within ~1 second of the hangup.

- [ ] **Step 5: Test #5 — Locked, accept, cancel PIN entry**

Lock with PIN. Peer calls. Tap Accept. PIN prompt appears. Press Back / Cancel. Expected: back on the ringing screen, can retry Accept or tap Decline.

- [ ] **Step 6: Test #6 — Unlocked, heads-up Accept**

Unlock the phone, leave it on the home screen. Peer calls. Expected: heads-up notification appears (NOT a full-screen activity). Tap the Accept action button. Expected: app opens and call connects (current behavior, no regression).

- [ ] **Step 7: Test #7 — App foreground, call arrives**

Open the app. Have peer call. Expected: in-app `IncomingCallOverlay` appears with the existing JS Svelte UI (no regression).

- [ ] **Step 8: Test #8 — Screen off + locked**

Press power button to turn off screen. Peer calls. Expected: screen turns on AND the ringing screen appears (not the lockscreen with notification underneath).

- [ ] **Step 9: Test #9 — Avatar present**

Ensure the peer's profile picture is cached locally (you've messaged them before and the avatar showed up in a chat notification). Lock phone. Peer calls. Expected: ringing screen shows the avatar.

- [ ] **Step 10: Test #10 — Avatar absent**

Either clear the avatar cache (uninstall + reinstall) or call from a peer whose avatar isn't cached. Lock phone. Peer calls. Expected: ringing screen shows the placeholder vector.

- [ ] **Step 11: Document any failures**

For each scenario that fails, capture:
- Which test number
- Observed behavior (vs. expected)
- Logcat output (`adb logcat | grep -iE "IncomingCall|VoiceCall|nospeak"`)

If any test fails, STOP and root-cause before declaring complete.

- [ ] **Step 12: No commit needed for testing tasks (unless a fix is required, in which case commit per the standard pattern)**

---

## Task 13: Final verification

- [ ] **Step 1: Run the full check suite one last time**

Run: `npm run check && npx vitest run`

Expected: both pass.

- [ ] **Step 2: Confirm no untracked files remain**

Run: `git status`

Expected: clean working tree, branch ahead by the commits from this plan.

- [ ] **Step 3: Confirm the commit log tells a coherent story**

Run: `git log --oneline -20`

Expected: a sequence of conventional commits implementing the feature in order, no fixup-style commits, no commits unrelated to this plan.

- [ ] **Step 4: No final commit; the work is complete.**

---

## Self-Review

**Spec coverage:**
- Architecture (new Activity over keyguard, FSI redirect) → Tasks 5, 6, 8.
- Component 1 (`IncomingCallActivity.java`) → Task 5.
- Component 2 (layout) → Task 4.
- Component 3 (theme/styles edit) → Task 3.
- Component 4 (manifest registration) → Task 6.
- Component 5 (`IncomingCallNotification.java` edit) → Task 8.
- Component 6 (`NativeBackgroundMessagingService.java` edits — broadcast on hangup, avatar resolver) → Tasks 7 + 9.
- Component 7 (JS unchanged) → no task; Task 10 verifies no regression.
- Avatar passing via cache file → Task 7 (resolver) + Task 8 (consumer) + Task 5 (renderer).
- 60s self-timeout in activity → Task 5.
- `ACTION_CALL_CANCELLED` broadcast → Task 9 (sender) + Task 5 (receiver).
- KeyguardDismissCallback handling for all three callbacks → Task 5.
- Pre-API-27 fallback → Task 5.
- Stale callId guard at onCreate → Task 5.
- Manual test matrix (12 scenarios) → Task 12.
- Build verification → Task 11.

All spec sections have corresponding tasks. **Coverage: complete.**

**Placeholder scan:** searched for "TBD", "TODO", "implement later", "appropriate error handling", "similar to". The two "TODO" matches (Task 7 step 3 mentions matching the existing implementation, Task 9 mentions the existing Phase A reject TODO in the codebase) refer to existing-code conditions, not unresolved plan content. **No placeholders.**

**Type / API consistency:**
- `EXTRA_CALL_ID` constant: defined on `IncomingCallActivity` (Task 5), referenced in `IncomingCallNotification` (Task 8) and `NativeBackgroundMessagingService` (Task 9). All three use the same name. ✓
- `ACTION_CALL_CANCELLED`: defined on `IncomingCallActivity` (Task 5), referenced in `NativeBackgroundMessagingService.handleRemoteCallCancellation` (Task 9). Same name. ✓
- `resolveCachedAvatarFilePath(Context, String)`: defined in Task 7, called from Task 8. Same signature. ✓
- `IncomingCallActionReceiver.ACTION_DECLINE`, `EXTRA_CALL_ID`, `EXTRA_SENDER_NPUB`, `EXTRA_SENDER_PUBKEY_HEX`: existing constants referenced in Task 5's `onDeclineClicked()`. Confirmed against current source. ✓
- `MainActivity` accept-pending-call extras (`accept_pending_call`, `call_id`, `nospeak_route_kind`=`voice-call-accept`): Task 5 uses these, matching existing `IncomingCallNotification.java:49-51` and `MainActivity.handleIncomingCallIntent` (line 146 reads `accept_pending_call`). ✓
- `nospeak_pending_incoming_call` SharedPrefs name: used in Task 5's `hasValidPendingOffer()` and Task 9's `handleRemoteCallCancellation()`. Matches the existing producer at `NativeBackgroundMessagingService.java:2710`. ✓
- `R.layout.activity_incoming_call`, `R.id.incoming_call_*` IDs: defined in Task 4's layout, referenced in Task 5's `bindUi()`. Names match. ✓

No type mismatches or naming drift.

**Scope:** the plan implements exactly what the spec describes — no extra features, no incidental refactoring of unrelated code. The Phase A native-Reject limitation is preserved as-is (out of scope per spec).
