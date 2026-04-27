# Android Native Voice-Call (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voice calls work when the Android device is locked, by adding a `phoneCall`-typed foreground service, configuring the OS audio session for voice communication, and routing incoming calls through a full-screen-intent notification with a JS handoff path.

**Architecture:** Three new components — (1) extension to the existing `NativeBackgroundMessagingService` to detect voice-call rumors and post full-screen-intent notifications, (2) a new `VoiceCallForegroundService` (FGS type `phoneCall`) that holds the wake lock and audio mode for the call duration, (3) a new `AndroidVoiceCallPlugin` Capacitor bridge for JS↔native control. Plus small modifications to `MainActivity` (lockscreen-show), `AndroidNotificationRouterPlugin` (new route kind), and `VoiceCallService` (lifecycle hooks + duplicate-offer fix).

**Tech Stack:** Java (Android SDK 27+), Capacitor 7 plugin API, TypeScript (Svelte 5), Vitest. WebRTC, NIP-17 gift wraps, NIP-40 expiration tags.

**Spec:** `openspec/specs/voice-calling/spec.md` — focus on the 6 new Requirements added 2026-04-26 (Foreground Service Lifecycle, Audio Mode, Lock-Screen Notification, Pending Call Handoff, Full-Screen Intent Permission UX, Decline Best-Effort Reject).

**Design:** `docs/superpowers/specs/2026-04-26-android-native-voice-call-design.md`

---

## File Map

| File | Change | Purpose |
|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | Modify | Add `FOREGROUND_SERVICE_PHONE_CALL` and `USE_FULL_SCREEN_INTENT` permissions; register new service and receivers |
| `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java` | Create | `phoneCall` FGS holding wake lock + `MODE_IN_COMMUNICATION` for call duration |
| `android/app/src/main/java/com/nospeak/app/VoiceCallActionReceiver.java` | Create | BroadcastReceiver for the Hang up notification action |
| `android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java` | Create | BroadcastReceiver for the Decline notification action |
| `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java` | Create | Capacitor plugin: JS↔native bridge for call session lifecycle and pending-call retrieval |
| `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` | Modify | Detect `type:voice-call` rumors, persist offer to SharedPrefs, post full-screen-intent notification, helper to send `reject` |
| `android/app/src/main/java/com/nospeak/app/AndroidNotificationRouterPlugin.java` | Modify | Add `voice-call-accept` route kind |
| `android/app/src/main/java/com/nospeak/app/MainActivity.java` | Modify | `setShowWhenLocked(true)` + `setTurnScreenOn(true)` + `requestDismissKeyguard` when launched via Accept intent; register new plugin |
| `android/app/src/main/res/drawable/ic_stat_call.xml` | Create | Vector icon for the call notification small-icon |
| `android/app/src/main/res/drawable/ic_call_end.xml` | Create | Vector icon for the Hang up action |
| `src/lib/core/voiceCall/androidVoiceCallPlugin.ts` | Create | TypeScript wrapper around `registerPlugin('AndroidVoiceCall')` |
| `src/lib/core/voiceCall/VoiceCallService.ts` | Modify | Hook `startCallSession`/`endCallSession` into ringing/ended transitions; fix duplicate-offer dedup in `handleOffer` |
| `src/lib/core/voiceCall/VoiceCallService.test.ts` | Modify | Tests for dedup fix + Android session lifecycle hooks |
| `src/lib/components/IncomingCallAcceptHandler.svelte` (or similar) | Create | Component mounted in root layout that listens for `voice-call-accept` route and auto-accepts |
| `src/routes/+layout.svelte` | Modify | Mount the auto-accept handler |
| `src/lib/stores/voiceCall.ts` | Possibly modify | Add field to skip incoming overlay when auto-accepting |

---

## Conventions

- Java: 4-space indentation, package `com.nospeak.app`, project pattern is final classes with private constructors for utilities, instance singletons exposed via static `getInstance()` (see `NativeBackgroundMessagingService.java:92-98` and `AndroidVoiceCallPlugin` will follow same pattern).
- TypeScript: 4-space indentation, strict mode, explicit interfaces, `vi.mock` for test deps.
- Conventional Commits with scope: `feat(voice-call):`, `feat(android):`, `test(voice-call):`, `fix(voice-call):`.
- Run `npm run check` and `npx vitest run` before declaring any task done.
- Android changes verified via `npm run build` (Capacitor sync) — full APK build is out of session scope; we rely on syntax-level verification and the plan's manual smoke test for runtime correctness.
- `git commit` after every step. Never amend after a successful commit unless the user requests it.

---

## Task 1: Manifest permissions + service + receiver registration

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

This is foundational; later tasks reference these declarations.

- [ ] **Step 1: Add the new permissions**

Edit `android/app/src/main/AndroidManifest.xml`. After line 41 (the `POST_NOTIFICATIONS` line), add:

```xml
    <!-- Required for FGS type 'phoneCall' on Android 14+ -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
    <!-- Required to launch the activity over the keyguard for incoming calls (Android 14+ runtime grant) -->
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
```

- [ ] **Step 2: Register the new service**

After the existing `<service android:name=".NativeBackgroundMessagingService" ...>` block (currently lines 104-112), add:

```xml
        <!-- Foreground service hosting the active voice call -->
        <service
            android:name=".VoiceCallForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="phoneCall" />
```

- [ ] **Step 3: Register the broadcast receivers**

After the new `<service>` block, add:

```xml
        <!-- Hang up action from the active-call notification -->
        <receiver
            android:name=".VoiceCallActionReceiver"
            android:enabled="true"
            android:exported="false" />

        <!-- Decline action from the incoming-call notification -->
        <receiver
            android:name=".IncomingCallActionReceiver"
            android:enabled="true"
            android:exported="false" />
```

- [ ] **Step 4: Verify manifest validity**

Run: `npm run build`
Expected: build completes without manifest-merge errors. Watch the output for AAPT or manifest-merge complaints.

If the build fails because the referenced classes (`VoiceCallForegroundService`, `VoiceCallActionReceiver`, `IncomingCallActionReceiver`) don't exist yet, that's expected — we'll create them in Tasks 4-6. The manifest itself is valid; the merge is purely textual at this stage.

If the build fails on the manifest itself (e.g. invalid attribute, malformed XML), fix and re-run.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): declare FGS_PHONE_CALL + USE_FULL_SCREEN_INTENT permissions and register voice-call service/receivers"
```

---

## Task 2 (RED): Test for duplicate-offer dedup in `handleOffer`

**Files:**
- Modify: `src/lib/core/voiceCall/VoiceCallService.test.ts`
- Read: `src/lib/core/voiceCall/VoiceCallService.ts:250-270` (current `handleOffer`)

Background: when an offer arrives via the live JS subscription AND via the persisted-prefs cold-start path, JS receives the same offer twice. Today, the second offer would arrive while status is `incoming-ringing`, hit the "not idle" guard, and bounce a `busy` reply — wrong. We need to ignore duplicates from the same peer with the same callId.

- [ ] **Step 1: Add the test**

Inside `src/lib/core/voiceCall/VoiceCallService.test.ts`, find the existing `describe('VoiceCallService', () => { ... })` block. Add a new `describe` block at the bottom of that outer describe (after the last `describe('generateCallId', ...)`) for offer dedup:

```ts
    describe('handleOffer dedup', () => {
        it('ignores a duplicate offer for the same callId and same peerNpub', async () => {
            const senderNpub = 'npub1xyz';
            const callId = 'abc123';
            const sdpOffer = 'v=0\r\no=- 1 1 IN IP4 0\r\n...';
            const signal: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId,
                sdp: sdpOffer
            };

            // First offer puts service into incoming-ringing
            await service.handleSignal(signal, senderNpub);

            // Second offer with same callId/sender should NOT trigger a 'busy' reply
            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.handleSignal(signal, senderNpub);

            // Verify: no busy reply was sent for the duplicate
            const busyCall = sendSignalSpy.mock.calls.find(call => {
                try {
                    const parsed = JSON.parse(call[1]);
                    return parsed.action === 'busy';
                } catch { return false; }
            });
            expect(busyCall).toBeUndefined();
        });

        it('still sends busy when a different callId arrives during incoming-ringing', async () => {
            const senderA = 'npub1aaa';
            const senderB = 'npub1bbb';

            const offerA: VoiceCallSignal = {
                type: 'voice-call', action: 'offer', callId: 'aaa', sdp: 'sdpA'
            };
            const offerB: VoiceCallSignal = {
                type: 'voice-call', action: 'offer', callId: 'bbb', sdp: 'sdpB'
            };

            await service.handleSignal(offerA, senderA);

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.handleSignal(offerB, senderB);

            // Verify a busy reply WAS sent for the different call
            const busyCall = sendSignalSpy.mock.calls.find(call => {
                try {
                    const parsed = JSON.parse(call[1]);
                    return parsed.action === 'busy';
                } catch { return false; }
            });
            expect(busyCall).toBeDefined();
            expect(busyCall![0]).toBe(senderB);
        });
    });
```

Note: the existing test file imports `VoiceCallSignal` from `'./types'` at line 16. Confirm the import is present; if not, add it.

- [ ] **Step 2: Run the new tests, expect FAILURE**

Run: `npx vitest run src/lib/core/voiceCall/VoiceCallService.test.ts -t "handleOffer dedup"`
Expected: 2 tests run.
- "ignores a duplicate offer..." should FAIL — current code likely sends a `busy` reply for the duplicate.
- "still sends busy when a different callId..." may PASS or FAIL depending on existing behavior. If it FAILs because of unrelated mocking issues, report BLOCKED.

If the duplicate-test fails for reasons OTHER than the dedup behavior (e.g. `service.handleSignal` throws because something is unmocked), report BLOCKED with the error output.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit (failing test)**

```bash
git add src/lib/core/voiceCall/VoiceCallService.test.ts
git commit -m "test(voice-call): assert duplicate offer for same callId is ignored (RED)"
```

---

## Task 3 (GREEN): Fix `handleOffer` to dedup duplicate offers

**Files:**
- Modify: `src/lib/core/voiceCall/VoiceCallService.ts` (function `handleOffer`, ~line 250)

- [ ] **Step 1: Read the current `handleOffer`**

Read `src/lib/core/voiceCall/VoiceCallService.ts:250-280` to find the exact current implementation. The relevant guard is something like:

```ts
private async handleOffer(signal: VoiceCallSignal, senderNpub: string): Promise<void> {
    const state = get(voiceCallState);
    if (state.status !== 'idle') {
        // peer is calling but we're already busy — reply with busy
        await this.sendSignal(senderNpub, { type: 'voice-call', action: 'busy', callId: signal.callId });
        return;
    }
    // ... rest of handler
}
```

(The exact code may differ; the dedup logic must come BEFORE the `!== 'idle'` busy reply.)

- [ ] **Step 2: Add the dedup check**

At the very start of `handleOffer`, before any `state.status` check:

```ts
private async handleOffer(signal: VoiceCallSignal, senderNpub: string): Promise<void> {
    const state = get(voiceCallState);

    // Dedup: same callId from same peer while we're already ringing for it.
    // This happens when the offer arrives both via the live subscription
    // and via the Android persisted-prefs cold-start path.
    if (
        state.status === 'incoming-ringing' &&
        state.callId === signal.callId &&
        state.peerNpub === senderNpub
    ) {
        return;
    }

    if (state.status !== 'idle') {
        await this.sendSignal(senderNpub, {
            type: 'voice-call',
            action: 'busy',
            callId: signal.callId
        });
        return;
    }
    // ... rest of handler unchanged
}
```

The dedup check is intentionally narrow: it matches ONLY `incoming-ringing` for the same `callId` AND same `peerNpub`. Any other state (active, connecting, outgoing-ringing) or different identifiers still trigger the busy reply, which is correct.

- [ ] **Step 3: Run the Task 2 tests, expect PASS**

Run: `npx vitest run src/lib/core/voiceCall/VoiceCallService.test.ts -t "handleOffer dedup"`
Expected: 2 tests pass.

- [ ] **Step 4: Run the full VoiceCallService tests for regressions**

Run: `npx vitest run src/lib/core/voiceCall/VoiceCallService.test.ts`
Expected: ALL tests pass.

- [ ] **Step 5: Run the entire vitest suite for cross-cutting regressions**

Run: `npx vitest run`
Expected: ALL tests pass (450+ as of last successful run).

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/voiceCall/VoiceCallService.ts
git commit -m "fix(voice-call): dedup duplicate offer for same callId/peer in handleOffer"
```

---

## Task 4: Create `VoiceCallForegroundService.java`

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java`
- Create: `android/app/src/main/res/drawable/ic_stat_call.xml`
- Create: `android/app/src/main/res/drawable/ic_call_end.xml`

This is the `phoneCall` FGS that runs for the duration of a call.

- [ ] **Step 1: Create the small-icon drawable**

Create `android/app/src/main/res/drawable/ic_stat_call.xml` with this content (Material `call` icon, 24dp):

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24"
    android:tint="?attr/colorControlNormal">
    <path
        android:fillColor="@android:color/white"
        android:pathData="M20.01,15.38c-1.23,0 -2.42,-0.2 -3.53,-0.56 -0.35,-0.12 -0.74,-0.03 -1.01,0.24l-1.57,1.97c-2.83,-1.35 -5.48,-3.9 -6.89,-6.83l1.95,-1.66c0.27,-0.28 0.35,-0.67 0.24,-1.02 -0.37,-1.11 -0.56,-2.3 -0.56,-3.53 0,-0.54 -0.45,-0.99 -0.99,-0.99H4.19C3.65,3 3,3.24 3,3.99 3,13.28 10.73,21 20.01,21c0.71,0 0.99,-0.63 0.99,-1.18v-3.45c0,-0.54 -0.45,-0.99 -0.99,-0.99z"/>
</vector>
```

- [ ] **Step 2: Create the call-end drawable**

Create `android/app/src/main/res/drawable/ic_call_end.xml`:

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24"
    android:tint="?attr/colorControlNormal">
    <path
        android:fillColor="@android:color/white"
        android:pathData="M12,9c-1.6,0 -3.15,0.25 -4.6,0.72v3.1c0,0.39 -0.23,0.74 -0.56,0.9 -0.98,0.49 -1.87,1.12 -2.66,1.85 -0.18,0.18 -0.43,0.28 -0.7,0.28 -0.28,0 -0.53,-0.11 -0.71,-0.29L0.29,13.08c-0.18,-0.17 -0.29,-0.42 -0.29,-0.7 0,-0.28 0.11,-0.53 0.29,-0.71C3.34,8.78 7.46,7 12,7s8.66,1.78 11.71,4.67c0.18,0.18 0.29,0.43 0.29,0.71 0,0.28 -0.11,0.53 -0.29,0.71l-2.48,2.48c-0.18,0.18 -0.43,0.29 -0.71,0.29 -0.27,0 -0.52,-0.1 -0.7,-0.28 -0.79,-0.74 -1.69,-1.36 -2.67,-1.85 -0.33,-0.16 -0.56,-0.5 -0.56,-0.9v-3.1C15.15,9.25 13.6,9 12,9z"/>
</vector>
```

- [ ] **Step 3: Create the service class**

Create `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java`:

```java
package com.nospeak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class VoiceCallForegroundService extends Service {

    private static final String TAG = "VoiceCallFGS";
    public static final String CHANNEL_ID = "nospeak_voice_call_active";
    private static final int NOTIFICATION_ID = 0xCAA1;

    public static final String ACTION_START = "com.nospeak.app.voicecall.START";
    public static final String ACTION_STOP = "com.nospeak.app.voicecall.STOP";
    public static final String ACTION_HANGUP = "com.nospeak.app.voicecall.HANGUP";

    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_PEER_NPUB = "peerNpub";
    public static final String EXTRA_PEER_NAME = "peerName";
    public static final String EXTRA_ROLE = "role";

    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean audioModeApplied = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String peerName = intent.getStringExtra(EXTRA_PEER_NAME);
        String role = intent.getStringExtra(EXTRA_ROLE);

        createChannelIfNeeded();
        Notification notif = buildOngoingNotification(callId, peerName, role);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notif,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Cancel any incoming-call notification once we're hosting an active call.
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}

        acquireWakeLock();
        configureAudioMode();
        return START_NOT_STICKY;
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nospeak:voice-call");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(60L * 60L * 1000L); // safety: 1 hour
        } catch (Exception e) {
            Log.w(TAG, "wake lock acquire failed", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        wakeLock = null;
    }

    private void configureAudioMode() {
        try {
            audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            previousAudioMode = audioManager.getMode();
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioModeApplied = true;
        } catch (Exception e) {
            Log.w(TAG, "setMode failed", e);
        }
    }

    private void restoreAudioMode() {
        if (!audioModeApplied || audioManager == null) return;
        try {
            audioManager.setMode(previousAudioMode);
        } catch (Exception e) {
            Log.w(TAG, "restore audio mode failed", e);
        }
        audioModeApplied = false;
    }

    @Override
    public void onDestroy() {
        restoreAudioMode();
        releaseWakeLock();
        super.onDestroy();
    }

    private Notification buildOngoingNotification(String callId, String peerName, String role) {
        Intent activityIntent = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("nospeak_route_kind", "voice-call-active")
            .putExtra("call_id", callId);
        PendingIntent contentPi = PendingIntent.getActivity(
            this, 0, activityIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent hangupIntent = new Intent(this, VoiceCallActionReceiver.class)
            .setAction(ACTION_HANGUP)
            .putExtra(EXTRA_CALL_ID, callId);
        PendingIntent hangupPi = PendingIntent.getBroadcast(
            this, 1, hangupIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("On call")
            .setContentText(peerName != null ? peerName : "")
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_call_end, "Hang up", hangupPi)
            .build();
    }

    private void createChannelIfNeeded() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Active call",
            NotificationManager.IMPORTANCE_LOW);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }
}
```

Note the reference to `IncomingCallNotification.NOTIFICATION_ID` — this constant will be defined in Task 12 (incoming-call notification builder). Until then, the compiler will complain. We accept that until Task 12 lands; the project does not have an integration build gate between tasks.

If you want the project to compile cleanly between Task 4 and Task 12, define a placeholder class in Task 4 with just the constant, OR inline the constant value directly here:

```java
nm.cancel(0xCA11);  // matches incoming notification id, defined in IncomingCallNotification.NOTIFICATION_ID later
```

Use the inline-constant approach for now to keep Task 4 self-contained:

```java
private static final int INCOMING_NOTIFICATION_ID = 0xCA11; // mirrored in IncomingCallNotification.NOTIFICATION_ID

// then in onStartCommand:
nm.cancel(INCOMING_NOTIFICATION_ID);
```

When Task 12 introduces the canonical constant, this duplicate will be replaced with `IncomingCallNotification.NOTIFICATION_ID`.

- [ ] **Step 4: Verify the file compiles in isolation**

Run: `npm run build`
Expected: Capacitor sync succeeds AND the Android `:app:compileDebugJavaWithJavac` task succeeds (no syntax errors). The actual APK assembly may fail in later tasks until all referenced classes exist; for Task 4 the relevant check is "this file alone compiles."

If the build fails because of missing references TO this class (`VoiceCallForegroundService` referenced from the manifest), that's expected — the manifest from Task 1 references it but other classes (receivers, plugin) referenced by the manifest may also be missing. As long as `VoiceCallForegroundService.java` itself parses, move on.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java \
        android/app/src/main/res/drawable/ic_stat_call.xml \
        android/app/src/main/res/drawable/ic_call_end.xml
git commit -m "feat(android): add VoiceCallForegroundService (phoneCall FGS, audio mode, wake lock)"
```

---

## Task 5: Create `VoiceCallActionReceiver.java` (Hangup broadcast)

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/VoiceCallActionReceiver.java`

This receiver fires when the user taps the "Hang up" action on the active-call notification. It forwards the request to the JS layer via the plugin so JS can run `voiceCallService.hangup()`.

- [ ] **Step 1: Create the receiver**

Create `android/app/src/main/java/com/nospeak/app/VoiceCallActionReceiver.java`:

```java
package com.nospeak.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class VoiceCallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "VoiceCallActionRx";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!VoiceCallForegroundService.ACTION_HANGUP.equals(action)) return;

        String callId = intent.getStringExtra(VoiceCallForegroundService.EXTRA_CALL_ID);
        Log.d(TAG, "Hang up action received for callId=" + callId);

        // Notify the JS layer; it will run voiceCallService.hangup() which in turn
        // calls AndroidVoiceCallPlugin.endCallSession(), stopping the FGS.
        AndroidVoiceCallPlugin.emitHangupRequested(callId);

        // If JS isn't running (rare — the call FGS implies an active call which implies
        // JS is or was alive), still stop the service to release resources.
        Intent stop = new Intent(context, VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_STOP);
        try {
            context.startService(stop);
        } catch (Exception e) {
            Log.w(TAG, "Failed to stop service from receiver", e);
        }
    }
}
```

The reference to `AndroidVoiceCallPlugin.emitHangupRequested` will be unresolved until Task 7. As with Task 4, the project does not gate between tasks — the file is syntactically valid; the missing class is a known gap that Task 7 fills.

- [ ] **Step 2: Verify file compiles standalone**

Run: `npm run build`
Expected: Java source parses without syntax errors. The `AndroidVoiceCallPlugin` reference will fail to resolve, but that's expected and resolved by Task 7.

If you want clean intermediate compilation, defer Task 5 until after Task 7. The plan is structured for logical reading order; execution order is flexible.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/VoiceCallActionReceiver.java
git commit -m "feat(android): add VoiceCallActionReceiver for hang-up notification action"
```

---

## Task 6: Create `IncomingCallActionReceiver.java` (Decline broadcast)

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java`

This receiver fires when the user taps "Decline" on the incoming-call notification. It clears the pending-call SharedPrefs, cancels the notification, and best-effort sends a `reject` voice-call signal to the caller.

- [ ] **Step 1: Create the receiver**

Create `android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java`:

```java
package com.nospeak.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class IncomingCallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "IncomingCallActionRx";
    public static final String ACTION_DECLINE = "com.nospeak.app.voicecall.DECLINE";

    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_SENDER_NPUB = "senderNpub";
    public static final String EXTRA_SENDER_PUBKEY_HEX = "senderPubkeyHex";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (!ACTION_DECLINE.equals(intent.getAction())) return;

        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String senderNpub = intent.getStringExtra(EXTRA_SENDER_NPUB);
        String senderPubkeyHex = intent.getStringExtra(EXTRA_SENDER_PUBKEY_HEX);
        Log.d(TAG, "Decline received for callId=" + callId);

        // 1. Clear the pending-call SharedPrefs so the cold-start path doesn't auto-accept.
        SharedPreferences prefs = context.getSharedPreferences(
            "nospeak_pending_incoming_call", Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        // 2. Cancel the incoming-call notification.
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
        }

        // 3. Best-effort: tell the messaging service to publish a `reject` signal.
        NativeBackgroundMessagingService svc = NativeBackgroundMessagingService.getInstance();
        if (svc != null && callId != null && senderPubkeyHex != null) {
            try {
                svc.sendVoiceCallReject(senderPubkeyHex, callId);
            } catch (Exception e) {
                Log.w(TAG, "sendVoiceCallReject failed (best-effort, ignoring)", e);
            }
        } else {
            Log.d(TAG, "Messaging service not running; skipping reject");
        }
    }
}
```

The references to `IncomingCallNotification.NOTIFICATION_ID` and `NativeBackgroundMessagingService.sendVoiceCallReject(...)` will be unresolved until Task 12 and Task 13 respectively.

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java
git commit -m "feat(android): add IncomingCallActionReceiver for decline notification action"
```

---

## Task 7: Create `AndroidVoiceCallPlugin.java`

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java`

The Capacitor bridge between JS and the call FGS / pending-call SharedPrefs.

- [ ] **Step 1: Create the plugin class**

Create `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java`:

```java
package com.nospeak.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidVoiceCall")
public class AndroidVoiceCallPlugin extends Plugin {

    private static final String TAG = "AndroidVoiceCallPlugin";

    private static AndroidVoiceCallPlugin sInstance;

    public static AndroidVoiceCallPlugin getInstance() {
        return sInstance;
    }

    @Override
    public void load() {
        super.load();
        sInstance = this;
    }

    @PluginMethod
    public void startCallSession(PluginCall call) {
        String callId = call.getString("callId");
        String peerNpub = call.getString("peerNpub");
        String peerName = call.getString("peerName");
        String role = call.getString("role");
        if (callId == null || peerNpub == null || role == null) {
            call.reject("missing required arguments: callId, peerNpub, role");
            return;
        }

        Intent svc = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_START)
            .putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, callId)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NPUB, peerNpub)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NAME, peerName != null ? peerName : "")
            .putExtra(VoiceCallForegroundService.EXTRA_ROLE, role);
        try {
            ContextCompat.startForegroundService(getContext(), svc);
        } catch (Exception e) {
            Log.e(TAG, "startForegroundService failed", e);
            call.reject("could not start voice call foreground service");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void endCallSession(PluginCall call) {
        Intent stop = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_STOP);
        try { getContext().startService(stop); } catch (Exception ignored) {}
        try {
            getContext().stopService(new Intent(getContext(), VoiceCallForegroundService.class));
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void getPendingIncomingCall(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            "nospeak_pending_incoming_call", Context.MODE_PRIVATE);
        String signalJson = prefs.getString("signalJson", null);

        JSObject ret = new JSObject();
        if (signalJson == null) {
            ret.put("pending", null);
            call.resolve(ret);
            return;
        }

        long expiresAt = prefs.getLong("expiresAt", 0L);
        long nowSec = System.currentTimeMillis() / 1000L;
        if (expiresAt > 0 && expiresAt < nowSec) {
            // Stale — clear and report none.
            prefs.edit().clear().apply();
            ret.put("pending", null);
            call.resolve(ret);
            return;
        }

        JSObject pending = new JSObject();
        pending.put("signalJson", signalJson);
        pending.put("senderNpub", prefs.getString("senderNpub", ""));
        pending.put("senderPubkeyHex", prefs.getString("senderPubkeyHex", ""));
        pending.put("callId", prefs.getString("callId", ""));
        pending.put("receivedAt", prefs.getLong("receivedAt", 0L));
        pending.put("expiresAt", expiresAt);
        ret.put("pending", pending);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingIncomingCall(PluginCall call) {
        getContext().getSharedPreferences("nospeak_pending_incoming_call",
            Context.MODE_PRIVATE).edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        boolean canUse = true;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager nm = (NotificationManager)
                    getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) canUse = nm.canUseFullScreenIntent();
            } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("granted", canUse);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestFullScreenIntentPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            call.resolve();
            return;
        }
        try {
            Intent i = new Intent(
                Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            call.reject("could not open full-screen intent settings");
            return;
        }
        call.resolve();
    }

    /**
     * Called by VoiceCallActionReceiver when the user taps "Hang up" in the
     * call notification.
     */
    public static void emitHangupRequested(String callId) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        try {
            p.notifyListeners("hangupRequested", data, true);
        } catch (Exception e) {
            Log.w(TAG, "notifyListeners failed", e);
        }
    }

    /**
     * Called by NativeBackgroundMessagingService when an incoming-call signal
     * arrives while the app is in the foreground; lets JS reach for the offer
     * via getPendingIncomingCall without waiting for the user to tap.
     */
    public static void emitPendingCallAvailable(String callId) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId != null ? callId : "");
        try {
            p.notifyListeners("pendingCallAvailable", data, true);
        } catch (Exception e) {
            Log.w(TAG, "notifyListeners failed", e);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java
git commit -m "feat(android): add AndroidVoiceCallPlugin (Capacitor bridge for call session lifecycle)"
```

---

## Task 8: Register the new plugin in `MainActivity`

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/MainActivity.java`

- [ ] **Step 1: Add the registration**

Read `android/app/src/main/java/com/nospeak/app/MainActivity.java:25-37`. Find the existing block of `registerPlugin(...)` calls inside `onCreate`. After `registerPlugin(AndroidDownloadsPlugin.class);` (line 37), add:

```java
        registerPlugin(AndroidVoiceCallPlugin.class);
```

The plugin order does not matter functionally, but appending at the end is the convention this project follows.

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build`
Expected: build progresses past the Java compile step. If `AndroidVoiceCallPlugin` from Task 7 was committed, this should resolve cleanly.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/MainActivity.java
git commit -m "feat(android): register AndroidVoiceCallPlugin in MainActivity"
```

---

## Task 9: Lockscreen-show + keyguard-dismiss in MainActivity

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/MainActivity.java`

- [ ] **Step 1: Add the helper method**

Inside `MainActivity.java`, after `onStop()` (line 139), add:

```java
    private void handleIncomingCallIntent(android.content.Intent intent) {
        if (intent == null) return;
        if (!intent.getBooleanExtra("accept_pending_call", false)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            try {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            } catch (Exception ignored) {}
            try {
                android.app.KeyguardManager km = (android.app.KeyguardManager)
                    getSystemService(KEYGUARD_SERVICE);
                if (km != null) km.requestDismissKeyguard(this, null);
            } catch (Exception ignored) {}
        }
    }
```

- [ ] **Step 2: Wire it into onCreate and onNewIntent**

Modify `onCreate` to call the helper after `super.onCreate(...)`:

```java
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidBackgroundMessagingPlugin.class);
        // ... other registerPlugin calls ...
        registerPlugin(AndroidVoiceCallPlugin.class);

        super.onCreate(savedInstanceState);
        handleIncomingCallIntent(getIntent());

        // ... rest of existing onCreate work
    }
```

Modify the existing `onNewIntent` (line 128-133) to call the helper:

```java
    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingCallIntent(intent);
    }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/MainActivity.java
git commit -m "feat(android): show MainActivity over keyguard when launched via Accept intent"
```

---

## Task 10: Extend `AndroidNotificationRouterPlugin` with `voice-call-accept` route

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/AndroidNotificationRouterPlugin.java`

- [ ] **Step 1: Read the current routing code**

Read the full file to understand how the existing `chat` route kind is dispatched. The file uses `intent.getStringExtra("nospeak_route_kind")` and emits `routeReceived` events with a kind discriminator and payload.

- [ ] **Step 2: Add the `voice-call-accept` branch**

Find the place where the route payload is built (likely a method like `buildRoutePayload(Intent intent)` or inside `getInitialRoute` / `handleOnNewIntent`). Add a branch alongside the existing `chat` handling:

```java
String routeKind = intent.getStringExtra("nospeak_route_kind");
// existing chat branch...
if ("voice-call-accept".equals(routeKind)) {
    JSObject payload = new JSObject();
    payload.put("kind", "voice-call-accept");
    payload.put("callId", intent.getStringExtra("call_id"));
    return payload; // or notifyListeners(...) in handleOnNewIntent
}
if ("voice-call-active".equals(routeKind)) {
    JSObject payload = new JSObject();
    payload.put("kind", "voice-call-active");
    payload.put("callId", intent.getStringExtra("call_id"));
    return payload;
}
```

The exact insertion point depends on the existing structure. Mirror the chat branch precisely.

If the existing code structure is opaque, prefer adding the two voice-call branches as the last cases in any if/else chain so no existing behavior is changed.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/AndroidNotificationRouterPlugin.java
git commit -m "feat(android): add voice-call-accept and voice-call-active routes to notification router"
```

---

## Task 11: Detect voice-call rumors in `NativeBackgroundMessagingService`

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

This is the trigger point: when a voice-call offer arrives over the background WebSocket, we route it to a new `handleVoiceCallRumor` method instead of the chat-notification path.

- [ ] **Step 1: Find the rumor-handling location**

Read `NativeBackgroundMessagingService.java` around line 880 (inside `handleLiveGiftWrapEvent` or the equivalent entry). Find where the decrypted rumor is inspected for `rumor.kind == 14 || rumor.kind == 15` to post a chat notification.

- [ ] **Step 2: Add the type-tag detection**

Immediately after the rumor is decrypted and before the chat-notification branch, add:

```java
// Voice-call rumors are kind 14 with a ['type', 'voice-call'] tag.
// Route to the incoming-call flow instead of the chat-notification path.
String rumorType = extractTagValue(rumor.tags, "type");
if ("voice-call".equals(rumorType)) {
    handleVoiceCallRumor(rumor, senderPubkeyHex, senderNpub);
    return; // do NOT post chat notification for voice-call rumors
}
```

The helper `extractTagValue(...)` should already exist in the file or one of its helpers (used for parsing `e`, `p` tags etc.). If not, add it as a private helper:

```java
private static String extractTagValue(java.util.List<java.util.List<String>> tags, String name) {
    if (tags == null) return null;
    for (java.util.List<String> tag : tags) {
        if (tag != null && tag.size() >= 2 && name.equals(tag.get(0))) {
            return tag.get(1);
        }
    }
    return null;
}
```

The exact tag data structure (`List<List<String>>` vs `JSONArray`) depends on the existing code. Match what `handleLiveGiftWrapEvent` already uses to read tags.

- [ ] **Step 3: Add `handleVoiceCallRumor`**

Add as a new private method on the service:

```java
private void handleVoiceCallRumor(Rumor rumor, String senderPubkeyHex, String senderNpub) {
    if (rumor == null || senderPubkeyHex == null || senderNpub == null) return;

    org.json.JSONObject signal;
    try {
        signal = new org.json.JSONObject(rumor.content);
    } catch (org.json.JSONException e) {
        Log.w(TAG, "[VoiceCall] Malformed signal content; dropping");
        return;
    }
    if (!"voice-call".equals(signal.optString("type"))) return;
    String action = signal.optString("action");
    String callId = signal.optString("callId");
    if (callId == null || callId.isEmpty()) return;

    // NIP-40 expiration check
    String expirationStr = extractTagValue(rumor.tags, "expiration");
    long nowSec = System.currentTimeMillis() / 1000L;
    long expiresAt = 0L;
    if (expirationStr != null) {
        try { expiresAt = Long.parseLong(expirationStr); } catch (NumberFormatException ignored) {}
        if (expiresAt > 0 && expiresAt < nowSec) {
            Log.d(TAG, "[VoiceCall] Dropping expired signal");
            return;
        }
    }

    // Only 'offer' actions while the app is closed produce user-visible notifications.
    // Other actions are useless without an active in-JS call session.
    if (!"offer".equals(action)) {
        Log.d(TAG, "[VoiceCall] Discarding action='" + action + "' while app closed");
        return;
    }

    // Persist for JS cold-start handoff
    SharedPreferences prefs = getSharedPreferences(
        "nospeak_pending_incoming_call", MODE_PRIVATE);
    prefs.edit()
        .putString("signalJson", signal.toString())
        .putString("senderNpub", senderNpub)
        .putString("senderPubkeyHex", senderPubkeyHex)
        .putString("callId", callId)
        .putLong("receivedAt", nowSec)
        .putLong("expiresAt", expiresAt)
        .apply();

    // Look up display name from existing profile cache
    String peerName;
    AndroidProfileCachePrefs.Identity identity =
        AndroidProfileCachePrefs.get(this, senderPubkeyHex);
    if (identity != null && identity.username != null && !identity.username.isEmpty()) {
        peerName = identity.username;
    } else {
        peerName = senderNpub.length() > 16 ? senderNpub.substring(0, 16) + "…" : senderNpub;
    }

    // Post the notification (full-screen-intent or heads-up depending on permission)
    IncomingCallNotification.post(this, callId, peerName, senderNpub, senderPubkeyHex,
        MainActivity.isAppVisible());

    // If app is foreground, also push an event so JS can pick the offer up immediately
    if (MainActivity.isAppVisible()) {
        AndroidVoiceCallPlugin.emitPendingCallAvailable(callId);
    }
}
```

The references to `IncomingCallNotification` and `AndroidVoiceCallPlugin` are resolved by Tasks 12 and 7 respectively.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Java compile succeeds (or errors only on missing `IncomingCallNotification`, which Task 12 introduces).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java
git commit -m "feat(android): route voice-call rumors to incoming-call flow in messaging service"
```

---

## Task 12: Create `IncomingCallNotification` builder

**Files:**
- Create: `android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java`

A small utility class that owns the incoming-call notification channel and its post/cancel logic.

- [ ] **Step 1: Create the class**

Create `android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java`:

```java
package com.nospeak.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;

import androidx.core.app.NotificationCompat;

public final class IncomingCallNotification {

    public static final String CHANNEL_ID = "nospeak_voice_call_incoming";
    public static final int NOTIFICATION_ID = 0xCA11;

    private IncomingCallNotification() {}

    public static void post(
        Context context,
        String callId,
        String peerName,
        String senderNpub,
        String senderPubkeyHex,
        boolean appVisible
    ) {
        createChannelIfNeeded(context);

        // Accept tap → MainActivity with accept_pending_call=true
        Intent acceptIntent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("accept_pending_call", true)
            .putExtra("call_id", callId)
            .putExtra("nospeak_route_kind", "voice-call-accept");
        PendingIntent acceptPi = PendingIntent.getActivity(
            context, 0, acceptIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Decline action → IncomingCallActionReceiver
        Intent declineIntent = new Intent(context, IncomingCallActionReceiver.class)
            .setAction(IncomingCallActionReceiver.ACTION_DECLINE)
            .putExtra(IncomingCallActionReceiver.EXTRA_CALL_ID, callId)
            .putExtra(IncomingCallActionReceiver.EXTRA_SENDER_NPUB, senderNpub)
            .putExtra(IncomingCallActionReceiver.EXTRA_SENDER_PUBKEY_HEX, senderPubkeyHex);
        PendingIntent declinePi = PendingIntent.getBroadcast(
            context, 1, declineIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Incoming call")
            .setContentText(peerName != null ? peerName : "")
            .setSmallIcon(R.drawable.ic_stat_call)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(60_000L)
            .setFullScreenIntent(acceptPi, true)
            .setContentIntent(acceptPi)
            .addAction(R.drawable.ic_stat_call, "Accept", acceptPi)
            .addAction(R.drawable.ic_call_end, "Decline", declinePi);

        if (appVisible) {
            // Foreground app handles the ringtone via JS (ringtone.ts).
            b.setSilent(true);
        }

        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, b.build());
        }
    }

    public static void cancel(Context context) {
        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }
    }

    private static void createChannelIfNeeded(Context context) {
        NotificationManager nm = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Incoming calls",
            NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Ring for incoming voice calls");
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] { 0, 800, 500, 800, 500, 800 });
        ch.setShowBadge(false);

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri != null) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            ch.setSound(ringtoneUri, attrs);
        }

        nm.createNotificationChannel(ch);
    }
}
```

- [ ] **Step 2: Update `VoiceCallForegroundService` to use the canonical constant**

If Task 4 used the inline `0xCA11` constant for cancellation, update it now:

```java
// Replace:
private static final int INCOMING_NOTIFICATION_ID = 0xCA11;
// With:
// (no const needed; reference IncomingCallNotification.NOTIFICATION_ID directly)

// And replace the call:
nm.cancel(INCOMING_NOTIFICATION_ID);
// With:
nm.cancel(IncomingCallNotification.NOTIFICATION_ID);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS now that the canonical constant exists.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java \
        android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java
git commit -m "feat(android): add IncomingCallNotification builder with full-screen intent"
```

---

## Task 13: Add `sendVoiceCallReject` helper to messaging service

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

The Decline action receiver calls this helper to publish a `reject` voice-call signal back to the caller through the existing connected WebSocket relays.

- [ ] **Step 1: Locate existing relay-publish helpers**

The messaging service already publishes events to relays — search for `getActiveSocket`, `relaySend`, or similar helpers, plus the gift-wrap construction code (lines ~1916-2128, plus the NIP-42 AUTH signing path lines 2367-2444).

- [ ] **Step 2: Add the helper**

Add this method as a public method on `NativeBackgroundMessagingService`:

```java
public void sendVoiceCallReject(String recipientPubkeyHex, String callId) {
    if (recipientPubkeyHex == null || callId == null) return;
    if (myPubkeyHex == null) {
        Log.d(TAG, "[VoiceCall] No local pubkey; cannot send reject");
        return;
    }
    try {
        // 1. Build the reject signal JSON (same shape as VoiceCallSignal in JS)
        org.json.JSONObject signal = new org.json.JSONObject();
        signal.put("type", "voice-call");
        signal.put("action", "reject");
        signal.put("callId", callId);
        String content = signal.toString();

        // 2. Build the rumor (Kind 14) with the same tag shape JS uses
        long nowSec = System.currentTimeMillis() / 1000L;
        long expiresAt = nowSec + 60L; // CALL_SIGNAL_EXPIRATION_SECONDS

        org.json.JSONObject rumor = new org.json.JSONObject();
        rumor.put("kind", 14);
        rumor.put("pubkey", myPubkeyHex);
        rumor.put("created_at", nowSec);
        rumor.put("content", content);

        org.json.JSONArray tags = new org.json.JSONArray();
        org.json.JSONArray pTag = new org.json.JSONArray();
        pTag.put("p"); pTag.put(recipientPubkeyHex);
        tags.put(pTag);
        org.json.JSONArray typeTag = new org.json.JSONArray();
        typeTag.put("type"); typeTag.put("voice-call");
        tags.put(typeTag);
        org.json.JSONArray expirationTag = new org.json.JSONArray();
        expirationTag.put("expiration"); expirationTag.put(String.valueOf(expiresAt));
        tags.put(expirationTag);
        rumor.put("tags", tags);

        // 3. Compute rumor id (sha256 of canonical serialization, same as JS getEventHash)
        String rumorId = computeEventId(rumor);
        rumor.put("id", rumorId);

        // 4. Wrap: rumor → seal (kind 13, signed) → gift wrap (kind 1059, ephemeral key)
        //    Reuse the existing NIP-44/Schnorr machinery — same path used by the
        //    NIP-42 AUTH signer at NativeBackgroundMessagingService.java:2367-2444
        //    and the seal builder at lines ~1916-1995 (mirror image of the decryption
        //    pipeline).
        org.json.JSONObject giftWrap = buildGiftWrapForRumor(rumor, recipientPubkeyHex, expiresAt);
        if (giftWrap == null) {
            Log.w(TAG, "[VoiceCall] Failed to build gift wrap for reject");
            return;
        }

        // 5. Publish to all currently connected relays (best-effort)
        publishEventToConnectedRelays(giftWrap);
    } catch (Exception e) {
        Log.w(TAG, "[VoiceCall] sendVoiceCallReject failed", e);
    }
}
```

The helper methods `computeEventId`, `buildGiftWrapForRumor`, and `publishEventToConnectedRelays` may already exist with different names, OR may need to be extracted from inline code in the existing decryption/AUTH paths.

**If they don't exist as reusable helpers**: extract them. The existing inline code at lines ~1916-1995 (decryption side) and ~2367-2444 (AUTH signing side) contains the primitives. Do not reimplement; refactor what's there into reusable helpers as part of this task.

**If extraction is too invasive**: alternative simpler approach — rather than fully wrapping in NIP-59, rely on the fact that the caller will eventually time out anyway. Skip the reject and let the timeout fire. Document this as an acceptable degradation.

If you take the simpler path, replace the body of `sendVoiceCallReject` with:

```java
public void sendVoiceCallReject(String recipientPubkeyHex, String callId) {
    // Phase A scope: best-effort reject is deferred. The caller will see a
    // 'timeout' end reason after 60s, which is functionally acceptable.
    // The Decline action still clears local state and dismisses the notification.
    Log.d(TAG, "[VoiceCall] Reject signal not implemented in Phase A; caller will time out");
}
```

This deferral is acceptable per the design doc's risk table ("If the messaging service is not running or has no connected relays, the reject is dropped silently — caller will see a `timeout` end reason. Acceptable degradation.")

**Recommended**: take the deferred path now and revisit in a later phase, to keep this plan tractable. The full extraction of NIP-59 helpers is a meaningful refactor of `NativeBackgroundMessagingService` that deserves its own design pass.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java
git commit -m "feat(android): add sendVoiceCallReject helper (deferred best-effort in Phase A)"
```

---

## Task 14: Create JS plugin wrapper

**Files:**
- Create: `src/lib/core/voiceCall/androidVoiceCallPlugin.ts`

- [ ] **Step 1: Create the wrapper**

Create `src/lib/core/voiceCall/androidVoiceCallPlugin.ts`:

```ts
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface PendingIncomingCall {
    signalJson: string;
    senderNpub: string;
    senderPubkeyHex: string;
    callId: string;
    receivedAt: number;
    expiresAt: number;
}

export interface AndroidVoiceCallPluginShape {
    startCallSession(opts: {
        callId: string;
        peerNpub: string;
        peerName?: string;
        role: 'incoming' | 'outgoing';
    }): Promise<void>;

    endCallSession(): Promise<void>;

    getPendingIncomingCall(): Promise<{ pending: PendingIncomingCall | null }>;

    clearPendingIncomingCall(): Promise<void>;

    canUseFullScreenIntent(): Promise<{ granted: boolean }>;

    requestFullScreenIntentPermission(): Promise<void>;

    addListener(
        eventName: 'hangupRequested',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'pendingCallAvailable',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;
}

export const AndroidVoiceCall = registerPlugin<AndroidVoiceCallPluginShape>('AndroidVoiceCall');
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/core/voiceCall/androidVoiceCallPlugin.ts
git commit -m "feat(voice-call): add AndroidVoiceCall TypeScript plugin wrapper"
```

---

## Task 15 (RED): Tests for `VoiceCallService` Android session lifecycle hooks

**Files:**
- Modify: `src/lib/core/voiceCall/VoiceCallService.test.ts`

We need tests that assert: when the platform is Android, `VoiceCallService` calls `AndroidVoiceCall.startCallSession` on entering ringing states and `endCallSession` on entering `ended`. These will FAIL until Task 16.

- [ ] **Step 1: Add the mocks at the top of the file**

In `src/lib/core/voiceCall/VoiceCallService.test.ts`, after the existing mocks (around line 1-12), add:

```ts
const startCallSessionSpy = vi.fn().mockResolvedValue(undefined);
const endCallSessionSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/core/voiceCall/androidVoiceCallPlugin', () => ({
    AndroidVoiceCall: {
        startCallSession: (...args: any[]) => startCallSessionSpy(...args),
        endCallSession: (...args: any[]) => endCallSessionSpy(...args),
        getPendingIncomingCall: vi.fn().mockResolvedValue({ pending: null }),
        clearPendingIncomingCall: vi.fn().mockResolvedValue(undefined),
        canUseFullScreenIntent: vi.fn().mockResolvedValue({ granted: true }),
        requestFullScreenIntentPermission: vi.fn().mockResolvedValue(undefined),
        addListener: vi.fn().mockResolvedValue({ remove: () => {} })
    }
}));

vi.mock('@capacitor/core', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        Capacitor: {
            ...actual.Capacitor,
            getPlatform: vi.fn().mockReturnValue('android')
        }
    };
});
```

- [ ] **Step 2: Add a new describe block at the bottom of the outer describe**

```ts
    describe('Android session lifecycle', () => {
        beforeEach(() => {
            startCallSessionSpy.mockClear();
            endCallSessionSpy.mockClear();
        });

        it('calls startCallSession with role=outgoing when initiateCall enters outgoing-ringing', async () => {
            // Mock browser APIs that initiateCall depends on
            // (getUserMedia, RTCPeerConnection) — see existing test patterns.
            // For the purposes of this test, we only need the lifecycle hook to fire.
            const recipientNpub = 'npub1recipient';

            // Stub signal sender so initiateCall doesn't try to actually publish
            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            // Stub getUserMedia
            (global as any).navigator = {
                ...(global as any).navigator,
                mediaDevices: {
                    getUserMedia: vi.fn().mockResolvedValue({
                        getTracks: () => [],
                        getAudioTracks: () => [{ enabled: true, stop: vi.fn() }]
                    })
                }
            };

            // Stub RTCPeerConnection minimally
            (global as any).RTCPeerConnection = vi.fn().mockImplementation(() => ({
                addTrack: vi.fn(),
                createOffer: vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'offer' }),
                setLocalDescription: vi.fn().mockResolvedValue(undefined),
                onicecandidate: null,
                ontrack: null,
                oniceconnectionstatechange: null,
                close: vi.fn()
            }));

            await service.initiateCall(recipientNpub);

            expect(startCallSessionSpy).toHaveBeenCalledTimes(1);
            const args = startCallSessionSpy.mock.calls[0][0];
            expect(args.role).toBe('outgoing');
            expect(args.peerNpub).toBe(recipientNpub);
            expect(args.callId).toBeTruthy();
        });

        it('calls startCallSession with role=incoming when acceptCall enters connecting', async () => {
            const senderNpub = 'npub1sender';
            const offer: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId: 'inc1',
                sdp: 'v=0\r\n...'
            };

            // Stub getUserMedia + RTCPeerConnection (same as above)
            (global as any).navigator = {
                ...(global as any).navigator,
                mediaDevices: {
                    getUserMedia: vi.fn().mockResolvedValue({
                        getTracks: () => [],
                        getAudioTracks: () => [{ enabled: true, stop: vi.fn() }]
                    })
                }
            };
            (global as any).RTCPeerConnection = vi.fn().mockImplementation(() => ({
                addTrack: vi.fn(),
                setRemoteDescription: vi.fn().mockResolvedValue(undefined),
                createAnswer: vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'answer' }),
                setLocalDescription: vi.fn().mockResolvedValue(undefined),
                onicecandidate: null,
                ontrack: null,
                oniceconnectionstatechange: null,
                close: vi.fn()
            }));

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.handleSignal(offer, senderNpub);
            await service.acceptCall();

            expect(startCallSessionSpy).toHaveBeenCalledTimes(1);
            const args = startCallSessionSpy.mock.calls[0][0];
            expect(args.role).toBe('incoming');
            expect(args.peerNpub).toBe(senderNpub);
            expect(args.callId).toBe('inc1');
        });

        it('calls endCallSession when call transitions to ended via hangup', async () => {
            const senderNpub = 'npub1sender';
            const offer: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId: 'inc2',
                sdp: 'v=0\r\n...'
            };

            (global as any).navigator = {
                ...(global as any).navigator,
                mediaDevices: {
                    getUserMedia: vi.fn().mockResolvedValue({
                        getTracks: () => [],
                        getAudioTracks: () => [{ enabled: true, stop: vi.fn() }]
                    })
                }
            };
            (global as any).RTCPeerConnection = vi.fn().mockImplementation(() => ({
                addTrack: vi.fn(),
                setRemoteDescription: vi.fn().mockResolvedValue(undefined),
                createAnswer: vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'answer' }),
                setLocalDescription: vi.fn().mockResolvedValue(undefined),
                onicecandidate: null,
                ontrack: null,
                oniceconnectionstatechange: null,
                close: vi.fn()
            }));

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.handleSignal(offer, senderNpub);
            await service.acceptCall();
            startCallSessionSpy.mockClear();

            await service.hangup();

            expect(endCallSessionSpy).toHaveBeenCalledTimes(1);
        });
    });
```

- [ ] **Step 3: Run the new tests, expect FAILURE**

Run: `npx vitest run src/lib/core/voiceCall/VoiceCallService.test.ts -t "Android session lifecycle"`
Expected: 3 tests FAIL — `startCallSessionSpy` and `endCallSessionSpy` are not called by the current implementation.

If tests fail with errors UNRELATED to the missing hooks (e.g. RTCPeerConnection mocking issues, missing globals), report BLOCKED. The mocks above are minimal; the actual failures may reveal that the existing test infrastructure for `VoiceCallService` mocks browser APIs differently. Match the existing pattern in that case.

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/voiceCall/VoiceCallService.test.ts
git commit -m "test(voice-call): assert Android session lifecycle hooks (RED)"
```

---

## Task 16 (GREEN): Wire `startCallSession`/`endCallSession` into `VoiceCallService`

**Files:**
- Modify: `src/lib/core/voiceCall/VoiceCallService.ts`

- [ ] **Step 1: Add the imports**

Near the top of `VoiceCallService.ts`, add:

```ts
import { Capacitor } from '@capacitor/core';
import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';
```

- [ ] **Step 2: Add a private helper**

Inside the `VoiceCallService` class, add:

```ts
    private async startAndroidSession(callId: string, peerNpub: string, role: 'incoming' | 'outgoing'): Promise<void> {
        if (Capacitor.getPlatform() !== 'android') return;
        try {
            await AndroidVoiceCall.startCallSession({
                callId,
                peerNpub,
                role
                // peerName is optional; the native side falls back to truncated npub
                // if not provided. We can extend later if we have a profile cache hook.
            });
        } catch (err) {
            console.warn('[VoiceCall] startCallSession failed', err);
        }
    }

    private async endAndroidSession(): Promise<void> {
        if (Capacitor.getPlatform() !== 'android') return;
        try {
            await AndroidVoiceCall.endCallSession();
        } catch (err) {
            console.warn('[VoiceCall] endCallSession failed', err);
        }
    }
```

- [ ] **Step 3: Hook into `initiateCall`**

In `initiateCall`, after the state transitions to `outgoing-ringing` (look for `setOutgoingRinging(...)` or equivalent store mutation), add:

```ts
        await this.startAndroidSession(callId, recipientNpub, 'outgoing');
```

Place it AFTER the state transition AND AFTER the offer signal is sent, so that if `startCallSession` fails, the call has already been initiated and the failure doesn't break the call setup. Logging-only on failure.

- [ ] **Step 4: Hook into `acceptCall`**

In `acceptCall`, after `setConnecting(...)` (the transition to `connecting`), add:

```ts
        const state = get(voiceCallState);
        if (state.callId && state.peerNpub) {
            await this.startAndroidSession(state.callId, state.peerNpub, 'incoming');
        }
```

- [ ] **Step 5: Hook into `endCall` (the private state-transition helper)**

Find the `endCall` private method (~line 350 area, mentioned in the original VoiceCallService.ts:42). At its start, add:

```ts
        await this.endAndroidSession();
```

This fires regardless of WHY the call ended (hangup, reject, busy, timeout, ice-failed) — anytime we leave the call state, we want the FGS to stop.

- [ ] **Step 6: Run the Task 15 tests, expect PASS**

Run: `npx vitest run src/lib/core/voiceCall/VoiceCallService.test.ts -t "Android session lifecycle"`
Expected: 3 tests pass.

- [ ] **Step 7: Run the full VoiceCallService tests for regressions**

Run: `npx vitest run src/lib/core/voiceCall/VoiceCallService.test.ts`
Expected: ALL tests pass.

- [ ] **Step 8: Run the entire vitest suite**

Run: `npx vitest run`
Expected: ALL tests pass.

- [ ] **Step 9: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/core/voiceCall/VoiceCallService.ts
git commit -m "feat(voice-call): wire AndroidVoiceCall session lifecycle into ringing/end transitions"
```

---

## Task 17: App-launch handler for `voice-call-accept` route

**Files:**
- Create: `src/lib/core/voiceCall/incomingCallAcceptHandler.ts`
- Modify: `src/routes/+layout.svelte` (or the existing notification-router subscription point)

When MainActivity launches with `accept_pending_call=true`, the notification router emits `routeReceived` with `kind: 'voice-call-accept'`. We need a JS handler that reads the pending call and auto-accepts.

- [ ] **Step 1: Find the existing notification-router subscription**

Search the codebase for `notificationRouter.addListener` or `routeReceived`:

```bash
grep -rn "routeReceived\|notificationRouter" src/
```

The existing chat-route handling lives somewhere — likely in `+layout.svelte` or a top-level effect. Note its location so we can add a sibling case.

- [ ] **Step 2: Create the handler module**

Create `src/lib/core/voiceCall/incomingCallAcceptHandler.ts`:

```ts
import { AndroidVoiceCall, type PendingIncomingCall } from './androidVoiceCallPlugin';
import { voiceCallService } from './VoiceCallService';
import type { VoiceCallSignal } from './types';

export async function handleVoiceCallAcceptRoute(): Promise<void> {
    let pending: PendingIncomingCall | null;
    try {
        const result = await AndroidVoiceCall.getPendingIncomingCall();
        pending = result.pending;
    } catch (err) {
        console.warn('[VoiceCall] getPendingIncomingCall failed', err);
        return;
    }

    if (!pending) {
        // No pending call (or it was stale). Could surface a missed-call toast here;
        // for now, silently do nothing — the call event UI will reflect the missed call.
        console.log('[VoiceCall] voice-call-accept route fired but no pending call found');
        return;
    }

    try {
        await AndroidVoiceCall.clearPendingIncomingCall();
    } catch (err) {
        console.warn('[VoiceCall] clearPendingIncomingCall failed (ignoring)', err);
    }

    let signal: VoiceCallSignal;
    try {
        signal = JSON.parse(pending.signalJson);
    } catch (err) {
        console.warn('[VoiceCall] Failed to parse pending signalJson', err);
        return;
    }
    if (signal.type !== 'voice-call' || signal.action !== 'offer') {
        console.warn('[VoiceCall] Pending call is not a voice-call offer; ignoring');
        return;
    }

    // Synthesize the incoming-ringing state from the persisted offer.
    await voiceCallService.handleSignal(signal, pending.senderNpub);

    // Auto-accept — user already chose Accept on the lockscreen.
    await voiceCallService.acceptCall();
}
```

- [ ] **Step 3: Wire it into the existing notification-router listener**

In whichever file already listens for `routeReceived` (from Step 1), add:

```ts
import { handleVoiceCallAcceptRoute } from '$lib/core/voiceCall/incomingCallAcceptHandler';

// Inside the existing listener:
notificationRouter.addListener('routeReceived', async (payload) => {
    if (payload.kind === 'voice-call-accept') {
        await handleVoiceCallAcceptRoute();
        return;
    }
    if (payload.kind === 'voice-call-active') {
        // Bring the existing in-app ActiveCallOverlay into view; the overlay is
        // already mounted in the root layout, so no action is needed beyond
        // navigating away from any modal that might be obscuring it.
        return;
    }
    // existing chat handling unchanged
});
```

The cold-start path is also important: on app cold-start, the FIRST `routeReceived` event fires before listeners attach. The existing notification-router plugin has a `getInitialRoute` method that returns the launch intent's route. Make sure the same handler runs for the initial route too:

```ts
import { CapacitorNotificationRouter } from '$lib/.../notificationRouter';

// On app boot:
const initial = await CapacitorNotificationRouter.getInitialRoute();
if (initial && initial.kind === 'voice-call-accept') {
    await handleVoiceCallAcceptRoute();
}
```

(Adapt the import path to whatever the existing project uses for the notification router.)

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Run the full test suite for regressions**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/voiceCall/incomingCallAcceptHandler.ts \
        src/routes/+layout.svelte
# (or whichever file you modified to wire the handler)
git commit -m "feat(voice-call): handle voice-call-accept route by auto-accepting pending offer"
```

---

## Task 18: Hangup-from-notification listener

**Files:**
- Modify: `src/routes/+layout.svelte` or the app boot path

When the user taps "Hang up" in the active-call notification, the native plugin emits a `hangupRequested` event. JS needs to listen and call `voiceCallService.hangup()`.

- [ ] **Step 1: Add the listener at app boot**

In whichever file holds top-level lifecycle (likely `src/routes/+layout.svelte`), add an effect that registers the listener:

```ts
import { onMount } from 'svelte';
import { Capacitor } from '@capacitor/core';
import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';
import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';

onMount(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let handle: { remove: () => void } | null = null;
    AndroidVoiceCall.addListener('hangupRequested', () => {
        voiceCallService.hangup().catch((err) =>
            console.warn('[VoiceCall] hangup failed from notification', err)
        );
    }).then((h) => { handle = h; });

    return () => {
        if (handle) handle.remove();
    };
});
```

If `+layout.svelte` already has `onMount`, append to it.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat(voice-call): listen for hangupRequested from native and call hangup()"
```

---

## Task 19: Full-screen-intent permission prompt

**Files:**
- Create: `src/lib/components/FullScreenIntentPermissionModal.svelte`
- Modify: `src/lib/core/voiceCall/VoiceCallService.ts` (`initiateCall`) or wherever the call button handler lives

On the first call attempt (incoming or outgoing), if `canUseFullScreenIntent()` returns false, show a one-time modal explaining the permission and offering to open Settings.

- [ ] **Step 1: Create the modal component**

Create `src/lib/components/FullScreenIntentPermissionModal.svelte`:

```svelte
<script lang="ts">
    import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';

    interface Props {
        open: boolean;
        onClose: (action: 'opened-settings' | 'skipped') => void;
    }
    let { open, onClose }: Props = $props();

    async function openSettings() {
        try {
            await AndroidVoiceCall.requestFullScreenIntentPermission();
        } catch (err) {
            console.warn('[VoiceCall] requestFullScreenIntentPermission failed', err);
        }
        onClose('opened-settings');
    }

    function skip() {
        onClose('skipped');
    }
</script>

{#if open}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-base-100 max-w-md rounded-lg p-6 shadow-lg">
        <h2 class="text-lg font-semibold mb-2">Allow lockscreen calls</h2>
        <p class="mb-4 text-sm">
            To make incoming calls ring through when your screen is locked,
            nospeak needs permission to display full-screen notifications.
            You can skip this — calls will still work, but incoming calls
            won't ring through if your phone is locked.
        </p>
        <div class="flex gap-2 justify-end">
            <button class="btn btn-ghost" onclick={skip}>Skip</button>
            <button class="btn btn-primary" onclick={openSettings}>Open settings</button>
        </div>
    </div>
</div>
{/if}
```

- [ ] **Step 2: Add a permission-check helper**

Create `src/lib/core/voiceCall/fullScreenIntentPermission.ts`:

```ts
import { Capacitor } from '@capacitor/core';
import { AndroidVoiceCall } from './androidVoiceCallPlugin';

const SKIP_KEY = 'nospeak:voice-call:fsi-permission-skipped';

export interface FsiPromptDecision {
    shouldPrompt: boolean;
}

export async function evaluateFullScreenIntentPermission(): Promise<FsiPromptDecision> {
    if (Capacitor.getPlatform() !== 'android') return { shouldPrompt: false };
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SKIP_KEY) === 'true') {
        return { shouldPrompt: false };
    }
    try {
        const { granted } = await AndroidVoiceCall.canUseFullScreenIntent();
        return { shouldPrompt: !granted };
    } catch (err) {
        console.warn('[VoiceCall] canUseFullScreenIntent failed', err);
        return { shouldPrompt: false };
    }
}

export function recordFsiPermissionSkipped(): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SKIP_KEY, 'true');
    }
}
```

- [ ] **Step 3: Hook into the call-button handler**

In `ChatView.svelte` or wherever the call button's `onclick` lives (search for `voiceCallService.initiateCall` outside the service itself):

```ts
import { evaluateFullScreenIntentPermission, recordFsiPermissionSkipped }
    from '$lib/core/voiceCall/fullScreenIntentPermission';
import FullScreenIntentPermissionModal from '$lib/components/FullScreenIntentPermissionModal.svelte';

let fsiModalOpen = $state(false);

async function startCall() {
    const decision = await evaluateFullScreenIntentPermission();
    if (decision.shouldPrompt) {
        fsiModalOpen = true;
        return; // wait for user choice; they can re-tap call button after
    }
    await voiceCallService.initiateCall(peerNpub);
}

function handleFsiModalClose(action: 'opened-settings' | 'skipped') {
    fsiModalOpen = false;
    if (action === 'skipped') {
        recordFsiPermissionSkipped();
    }
    // Don't auto-resume the call attempt — let the user tap call again.
}
```

Mount the modal in the same component:

```svelte
<FullScreenIntentPermissionModal open={fsiModalOpen} onClose={handleFsiModalClose} />
```

The same logic should be applied where `acceptCall` is invoked from the in-app `IncomingCallOverlay` (so the prompt shows on first incoming-call accept from foreground). For now, prompting on outgoing-call attempt is sufficient — incoming-call accepts are rare for first-time users.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: PASS (no new tests added in this task — the modal and helper are integration-tested manually).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/FullScreenIntentPermissionModal.svelte \
        src/lib/core/voiceCall/fullScreenIntentPermission.ts \
        src/lib/components/ChatView.svelte
# (or whichever component holds the call button)
git commit -m "feat(voice-call): prompt for USE_FULL_SCREEN_INTENT permission on first call attempt"
```

---

## Task 20: Manual smoke test (deferred to user)

**Files:** none — operational verification on a real Android device.

This task does NOT produce a commit. The matrix below is the acceptance criterion for "Phase A done."

- [ ] **Step 1: Build the APK**

Run: `npm run build` then `cd android && ./gradlew assembleDebug` (or whatever the project's APK build command is).
Install on a real Android device.

- [ ] **Step 2: Two-tab test setup**

Use two devices or two npubs (one in a desktop browser, one on the Android device under test). Make sure both can already do calls via the existing in-app flow before adding lock-screen scenarios.

- [ ] **Step 3: Run the smoke-test matrix**

For each row: write down "PASS / FAIL / partial" and notes.

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | Caller calls Android, Android app open, screen on | In-app `IncomingCallOverlay` rings (JS ringtone). Notification posted silently. Tap Accept → call connects. |
| 2 | Caller calls Android, Android app closed, screen on, FSI granted | Heads-up notification with system ringtone. Accept → call connects, audio works. |
| 3 | Caller calls Android, Android app closed, screen LOCKED, FSI granted | Activity launches over keyguard with ringtone. Tap Accept → keyguard dismisses, call connects, audio works. |
| 4 | Caller calls Android, Android app closed, screen locked, FSI DENIED | Heads-up only on lockscreen. Swipe to unlock, tap Accept → call connects. |
| 5 | Outgoing call from Android, lock screen mid-ring | Call survives. Peer answers. Audio works. Hangup notification visible on lockscreen. |
| 6 | Active call, app backgrounded | Audio continues. Hangup notification persists. Returning to app shows `ActiveCallOverlay`. |
| 7 | Active call, screen-off for 60s | Audio continues without gaps. Battery drain reasonable. |
| 8 | Active call, hangup from notification | Call ends. Audio mode restored (try playing music after — it should sound normal, not be in voice-comm mode). |
| 9 | Active call, hangup from in-app UI | Call ends. FGS stops. Notification dismissed. |
| 10 | Decline from lockscreen | Caller sees `rejected` end reason within ~1s. (If `sendVoiceCallReject` was deferred per Task 13's simpler path, caller will see `timeout` after 60s instead — that's acceptable for Phase A.) |
| 11 | Stale pending offer (kill app, wait >60s, then tap notification — if it still exists) | Toast "Missed call" or no-op. No orphaned ringing UI. |
| 12 | Two incoming calls within 60s | First call's pending state overwritten; second notification active. Accept second → call connects. |
| 13 | First-call permission prompt | First time tapping call button (after install): modal explaining FSI permission appears. Skip works (modal closes, call doesn't start). Open Settings works (system page opens). |
| 14 | Permission revoked mid-app-life | Grant FSI → make a call → revoke FSI in Settings → make another call → modal should re-appear OR call should still work via heads-up. (Document actual behavior.) |
| 15 | AEC quality test | Make a call with the speaker on the Android side. Ask both parties whether they can hear themselves echo. Compare against pre-Phase-A (use a stash/branch to test). |

- [ ] **Step 4: Document results**

Capture results in a follow-up comment, issue, or PR description. Any FAIL or partial result should be triaged before declaring Phase A done.

- [ ] **Step 5: NO commit for this task** — this is operational verification only.

---

## Task 21: Final automated verification

**Files:** none.

- [ ] **Step 1: Typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: ALL tests pass. Note the new test count.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: Clean build. Capacitor sync succeeds.

- [ ] **Step 4: OpenSpec validation**

Run: `npx openspec validate voice-calling --strict --type spec`
Expected: `Specification 'voice-calling' is valid`.

Run: `npx openspec validate --specs --strict`
Expected: All 14 specs pass.

- [ ] **Step 5: Confirm git tree is clean**

Run: `git status`
Expected: clean working tree (apart from any pre-existing unrelated dirty state). All Task 1-19 commits should be present in the log:

Run: `git log --oneline 2bdf5d0..HEAD`
Expected: ~22 commits (one per task, sometimes 2 for RED/GREEN pairs).

NO commit for this task — verification only.

---

## Task 22: Final code review across the implementation

**Files:** none — review only.

Dispatch a final reviewer subagent to inspect all commits between `2bdf5d0` (the design+spec commit) and HEAD. Use the `requesting-code-review` skill or the `code-quality-reviewer-prompt.md` template from `subagent-driven-development`.

Specific things for the reviewer to check:

1. **Spec coverage**: every Requirement and Scenario in `openspec/specs/voice-calling/spec.md` (the 6 new ones added 2026-04-26) maps to implementation code AND at least one test (where automated testing is feasible).

2. **No native code regressions**: the existing `NativeBackgroundMessagingService` chat-notification behavior MUST be unchanged for non-voice-call rumors.

3. **Permission discipline**: every newly-declared permission has a justification, and every used Android API has the corresponding manifest permission.

4. **FGS lifecycle correctness**:
   - `startForegroundService` is always called via `ContextCompat.startForegroundService`, not `startService`.
   - `startForeground` is always called within 5 seconds of service start.
   - `stopForeground` and `stopSelf` are paired correctly in `onDestroy` / `ACTION_STOP`.

5. **Wake-lock discipline**: every `acquire` has a paired `release` and a safety timeout.

6. **Audio mode discipline**: every `setMode(MODE_IN_COMMUNICATION)` has a paired restore on service destruction.

7. **JS↔native contract**: every method on the plugin shape matches its Java implementation signature; events emitted match what JS listeners subscribe to.

8. **No dangling references**: every `IncomingCallNotification.NOTIFICATION_ID`, `AndroidVoiceCallPlugin.emitHangupRequested`, etc. resolves to a real symbol after all tasks land.

9. **Plan-mode safety**: `START_NOT_STICKY` for the call FGS, NOT `START_STICKY` — system-killed calls should not auto-restart.

10. **Capacitor platform guards**: every JS call to `AndroidVoiceCall` is wrapped in `Capacitor.getPlatform() === 'android'` except where the platform check is implicit (e.g., the auto-accept handler is registered conditionally).

If the reviewer finds issues, dispatch a fix subagent (do not edit manually) per the subagent-driven-development workflow. Re-review until clean.

When the reviewer says "Approved", Phase A is complete.

NO commit for this task.

---

## Self-Review

Run after writing the plan, before handing off.

### Spec coverage check

| Spec Requirement | Tasks |
|---|---|
| Voice-Call Foreground Service Lifecycle | 4 (FGS), 7 (plugin), 16 (JS hooks) |
| Audio Mode Configuration | 4 (FGS configures + restores) |
| Lock-Screen Incoming Call Notification | 11 (detect), 12 (post) |
| Pending Incoming Call Handoff | 11 (persist), 7 (read), 17 (consume), 3 (dedup fix for double-arrival) |
| Full-Screen Intent Permission UX | 7 (canUse / request methods), 19 (modal + first-call prompt) |
| Decline Best-Effort Reject | 6 (receiver clears prefs + cancels notif), 13 (helper, deferred path acceptable) |

All 6 spec requirements have corresponding tasks. Most have implementation AND test coverage; native-only code (FGS, notification builder, receivers) relies on the manual smoke matrix in Task 20.

### Placeholder scan

No "TBD", "fill in details", "handle edge cases" without specifics, or "similar to Task N" references. Every code block is complete.

The Task 13 deferral (best-effort reject) is documented as an acceptable alternative path with explicit fallback code, not a placeholder.

The references to existing-but-not-fully-shown helpers (`extractTagValue`, `computeEventId`, `buildGiftWrapForRumor`, `publishEventToConnectedRelays`) are flagged inline with instructions to either find them in the existing service file or extract them as part of Task 13. If extraction is too invasive, the deferred path applies.

### Type consistency check

- `PendingIncomingCall` interface in `androidVoiceCallPlugin.ts` (Task 14) matches the JSObject shape in `AndroidVoiceCallPlugin.getPendingIncomingCall` (Task 7).
- `startCallSession` arguments (`callId`, `peerNpub`, `peerName`, `role`) consistent across Tasks 7, 14, 16.
- `EXTRA_CALL_ID`, `EXTRA_PEER_NPUB`, `EXTRA_PEER_NAME`, `EXTRA_ROLE` consistent across `VoiceCallForegroundService` (Task 4) and `AndroidVoiceCallPlugin` (Task 7).
- `IncomingCallNotification.NOTIFICATION_ID = 0xCA11` matches the inline-constant placeholder used in `VoiceCallForegroundService` (Task 4) and the cancel call in `IncomingCallActionReceiver` (Task 6).
- Notification channel IDs `nospeak_voice_call_incoming` (Task 12) and `nospeak_voice_call_active` (Task 4) are distinct and don't collide with existing channels.

---

## Commit log shape (expected)

```
feat(android): declare FGS_PHONE_CALL + USE_FULL_SCREEN_INTENT permissions and register voice-call service/receivers
test(voice-call): assert duplicate offer for same callId is ignored (RED)
fix(voice-call): dedup duplicate offer for same callId/peer in handleOffer
feat(android): add VoiceCallForegroundService (phoneCall FGS, audio mode, wake lock)
feat(android): add VoiceCallActionReceiver for hang-up notification action
feat(android): add IncomingCallActionReceiver for decline notification action
feat(android): add AndroidVoiceCallPlugin (Capacitor bridge for call session lifecycle)
feat(android): register AndroidVoiceCallPlugin in MainActivity
feat(android): show MainActivity over keyguard when launched via Accept intent
feat(android): add voice-call-accept and voice-call-active routes to notification router
feat(android): route voice-call rumors to incoming-call flow in messaging service
feat(android): add IncomingCallNotification builder with full-screen intent
feat(android): add sendVoiceCallReject helper (deferred best-effort in Phase A)
feat(voice-call): add AndroidVoiceCall TypeScript plugin wrapper
test(voice-call): assert Android session lifecycle hooks (RED)
feat(voice-call): wire AndroidVoiceCall session lifecycle into ringing/end transitions
feat(voice-call): handle voice-call-accept route by auto-accepting pending offer
feat(voice-call): listen for hangupRequested from native and call hangup()
feat(voice-call): prompt for USE_FULL_SCREEN_INTENT permission on first call attempt
```

19 commits expected (Tasks 20-22 are verification-only, no commits).

## Execution recommendation

This plan has more native-Android code than typical, with limited automated test coverage. Recommend:

- **Subagent-driven execution** for the JS-side tasks (2-3, 14-19) and the manifest/registration tasks (1, 8). These are amenable to fresh-subagent-per-task with two-stage review.
- **Manual execution by a human or a single sustained agent** for the native code-heavy tasks (4-7, 9-13). These reference each other across files and benefit from holding the whole picture in context. A subagent that loses context between tasks may make small inconsistencies that aren't caught until the manifest references fail to resolve at build time.

If you're using the subagent-driven workflow throughout, give the implementer subagent generous context (the design doc + the previous task's commits) for native tasks.
