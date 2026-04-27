# Android Lockscreen Ringing Screen — Design

**Date:** 2026-04-27
**Status:** Approved (pending implementation plan)
**Scope:** Android voice-call incoming-call UX on a locked phone
**Touches:** Android native (Java + XML); no JS/Svelte changes

---

## Problem

When a voice call arrives while the Android phone is locked:

1. `IncomingCallNotification` posts a high-priority notification with `setFullScreenIntent(acceptPi, true)` (`android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java:75`).
2. The full-screen intent's PendingIntent is the **Accept** action — it launches `MainActivity` with `accept_pending_call=true`.
3. `MainActivity.handleIncomingCallIntent()` calls `setShowWhenLocked(true)`, `setTurnScreenOn(true)`, `requestDismissKeyguard(...)` (`MainActivity.java:149-156`).
4. The user is dropped into the PIN screen. After PIN entry, JS routes the `voice-call-accept` kind to `incomingCallAcceptHandler.ts:63`, which immediately calls `voiceCallService.acceptCall()` — connecting the WebRTC audio.

**The user never explicitly accepted the call.** PIN entry was treated as implicit consent. This violates user expectations and diverges from how WhatsApp / Signal / Telegram behave.

WhatsApp's full-screen intent points to a dedicated **ringing screen Activity** that displays Accept/Decline over the keyguard *without* dismissing it. PIN entry only happens after an explicit Accept tap.

## Goals

- Locked phone: show a ringing screen with Accept/Decline over the keyguard (no PIN required to interact).
- Tapping Accept on the ringing screen prompts for PIN, then connects the call.
- Tapping Decline dismisses the ringing screen and leaves the phone locked.
- Remote hangup / 60s timeout dismisses the ringing screen automatically.
- Unlocked phone (heads-up notification): keep the current auto-accept-on-Accept-tap UX (the user already saw and acted).
- No regression to the foreground-app in-call UX (Svelte `IncomingCallOverlay`).

## Non-Goals

- iOS-style "slide to answer" gestures.
- Changes to outgoing-call UX.
- Fixing the Phase A native-Reject stub in `NativeBackgroundMessagingService.sendVoiceCallReject` (existing TODO, separate work).
- Changes to the active-call notification or `VoiceCallForegroundService`.
- Changes to call-history persistence.

## Architecture

Introduce a new native Android Activity, `IncomingCallActivity`, which becomes the target of the notification's full-screen intent. The existing JS accept path is preserved unchanged — `IncomingCallActivity` launches `MainActivity` with the same `accept_pending_call=true` extra after the user explicitly taps Accept and the keyguard is dismissed.

```
Call arrives (phone locked)
    │
    ▼
NativeBackgroundMessagingService.handleVoiceCallRumor()         (UNCHANGED)
    │   persists offer to SharedPrefs
    │   posts notification
    ▼
IncomingCallNotification.post()                                 (CHANGED)
    │   FullScreenIntent → IncomingCallActivity (new)
    │   Action buttons + content intent → unchanged (auto-accept path)
    ▼
IncomingCallActivity                                            (NEW)
    ├─ setShowWhenLocked(true) + setTurnScreenOn(true)
    ├─ Renders native layout: avatar, name, Accept, Decline
    ├─ Accept tap → requestDismissKeyguard()
    │     ├─ onDismissSucceeded → MainActivity(accept_pending_call=true)
    │     ├─ onDismissCancelled → stay on ringing screen
    │     └─ onDismissError    → fall through to MainActivity launch
    ├─ Decline tap → broadcast to IncomingCallActionReceiver, finish()
    ├─ 60s self-timeout (Handler) → finish()
    └─ ACTION_CALL_CANCELLED broadcast → finish()
    │
    ▼ (Accept path)
MainActivity.handleIncomingCallIntent()                         (UNCHANGED)
    │
    ▼
incomingCallAcceptHandler.handleVoiceCallAcceptRoute()          (UNCHANGED)
    │
    ▼
voiceCallService.acceptCall() → WebRTC connects
```

**Key insight:** Only the notification's `setFullScreenIntent` PendingIntent changes. The Accept *action button* and the *content intent* keep pointing at `acceptPi` (the auto-accept path). This preserves correct UX in the unlocked / heads-up case where the user has already proven intent by tapping Accept on a visible heads-up notification.

## Components

### 1. `IncomingCallActivity.java` (NEW, ~180 lines)

Path: `android/app/src/main/java/com/nospeak/app/IncomingCallActivity.java`

Responsibilities:
- Show over the keyguard without dismissing it.
- Display caller info (avatar, name) and Accept/Decline buttons via a native layout.
- Coordinate the Accept → dismiss-keyguard → launch-MainActivity flow.
- Auto-finish on remote hangup, 60s timeout, or external cancellation broadcast.

Key APIs:
- API 27+: `setShowWhenLocked(true)`, `setTurnScreenOn(true)`.
- Pre-API-27 fallback: `WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | FLAG_TURN_SCREEN_ON` (the app's `minSdk` is high enough that the fallback may be dead code; verify in plan).
- API 26+: `KeyguardManager.requestDismissKeyguard(activity, KeyguardDismissCallback)` for Accept-after-PIN.

Public extras:
- `EXTRA_CALL_ID` (String)
- `EXTRA_PEER_NAME` (String)
- `EXTRA_SENDER_NPUB` (String)
- `EXTRA_SENDER_PUBKEY_HEX` (String)
- `EXTRA_AVATAR_PATH` (String, nullable) — file path to PNG in cache dir

Public broadcast action:
- `ACTION_CALL_CANCELLED` = `"com.nospeak.app.action.INCOMING_CALL_CANCELLED"`
  - Optional `EXTRA_CALL_ID` so the activity ignores broadcasts for unrelated callIds.

KeyguardDismissCallback handling:
- `onDismissSucceeded` → launch MainActivity with `accept_pending_call=true`, `finishAndRemoveTask()`.
- `onDismissCancelled` → no-op; user is back on the ringing screen and can retry or decline.
- `onDismissError` → fall through and launch MainActivity anyway (rare; matches MainActivity's existing post-PIN flow).

Lifecycle:
- `onCreate`: install window flags BEFORE `setContentView`; bind UI; register `cancelReceiver`; arm 60s `Handler.postDelayed(this::finishAndRemoveTask, 60_000)`.
- `onDestroy`: unregister `cancelReceiver`; remove timeout callback.
- `android:configChanges="orientation|screenSize|keyboardHidden"` to avoid recreate on rotation.
- Locked to portrait orientation via theme/manifest.

### 2. `res/layout/activity_incoming_call.xml` (NEW, ~80 lines)

Vertical `LinearLayout` over a dark background (matches platform call-style UIs):

- Top spacer
- Caption `TextView`: "Incoming call"
- Circular `ImageView`, 96dp, with the loaded avatar bitmap (or platform default placeholder).
- Peer name `TextView`, large.
- Spacer
- Horizontal `LinearLayout` with two circular `ImageButton`s:
  - Decline (left, red, `R.drawable.ic_call_end`).
  - Accept (right, green, `R.drawable.ic_stat_call`).
- Bottom margin

Circular avatar uses an existing `ShapeableImageView` if MaterialComponents is in classpath, otherwise falls back to a basic `ImageView` with a circular `ShapeDrawable` mask. Plan should pick one based on what's already on the classpath.

### 3. `res/values/styles.xml` (EDIT, +~12 lines)

Add `Theme.IncomingCall`:
- Parent: `Theme.AppCompat.NoActionBar` (or whatever the existing app theme parent is).
- Status bar transparent.
- Navigation bar transparent.
- Window background: dark color (`#101820` or similar).
- `android:windowFullscreen` true.
- `android:windowShowWallpaper` false.

### 4. `AndroidManifest.xml` (EDIT, +~12 lines)

Register the new activity inside `<application>`:

```xml
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
    android:configChanges="orientation|screenSize|keyboardHidden" />
```

No new permissions required. `USE_FULL_SCREEN_INTENT` is already declared (line 45).

### 5. `IncomingCallNotification.java` (EDIT, ~+25 / −2 lines)

- Build a separate `ringingPi` `PendingIntent` targeting `IncomingCallActivity`.
- Replace `setFullScreenIntent(acceptPi, true)` with `setFullScreenIntent(ringingPi, true)`.
- Keep `setContentIntent(acceptPi)`, the Accept action button (`acceptPi`), and the Decline action button (`declinePi`) UNCHANGED.
- Before posting, attempt to write a cached avatar PNG to `cacheDir/incoming_call_avatar_<callId>.png`. If successful, include `EXTRA_AVATAR_PATH` in the ringing intent. If not, omit the extra.

New helper (in this file or a new util class — plan decides):

```java
static String writeAvatarToCacheFile(Context ctx, String callId,
                                     String senderPubkeyHex, String pictureUrl)
```

Resolves the bitmap via `NativeBackgroundMessagingService.resolveCachedAvatarBitmap(...)` (need to expose a static accessor or move the resolver into a util) with `generateIdenticonForPubkey(...)` fallback. Writes PNG to cache dir. Returns absolute path or null.

**Plan must decide:** add a static accessor to `NativeBackgroundMessagingService`, or extract the avatar resolution into a small util class. The latter is cleaner; the former is faster.

### 6. `NativeBackgroundMessagingService.java` (EDIT, ~+15 lines)

When a call ends (remote `hangup`, remote `reject`, accepted-elsewhere) referencing a callId we have a pending offer for:
- Existing: `IncomingCallNotification.cancel(context)`.
- NEW: also `sendBroadcast(new Intent(IncomingCallActivity.ACTION_CALL_CANCELLED).putExtra(EXTRA_CALL_ID, callId).setPackage(getPackageName()))`.

Plan must locate the exact site(s) — likely inside `handleVoiceCallRumor()` around lines 2730+ where hangup/reject branches dispatch.

The 60s timeout is owned by the activity (its own `Handler.postDelayed`), so we don't need to broadcast on timeout.

### 7. JS / Svelte (UNCHANGED)

No changes:
- `incomingCallAcceptHandler.ts` keeps auto-accepting on `voice-call-accept` route. The "auto" is now correct because the user explicitly tapped Accept on the ringing screen and unlocked via PIN — two deliberate gestures.
- `IncomingCallOverlay.svelte` keeps handling foreground-app calls.

## Data Flow Scenarios

### Locked screen, user accepts

1. NativeBackgroundMessagingService receives offer rumor → SharedPrefs + notification.
2. Android fires the notification's full-screen intent → `IncomingCallActivity` launches over keyguard.
3. User taps Accept.
4. Activity calls `requestDismissKeyguard(...)` → user enters PIN.
5. `onDismissSucceeded` → `startActivity(MainActivity, accept_pending_call=true, call_id, voice-call-accept)` → `finishAndRemoveTask()`.
6. `MainActivity.handleIncomingCallIntent()` runs (existing).
7. JS layout layer routes `voice-call-accept` → `incomingCallAcceptHandler.handleVoiceCallAcceptRoute()` → `voiceCallService.acceptCall()`.
8. WebRTC negotiates; audio engages.

### Locked screen, user declines

1. Steps 1–2 as above.
2. User taps Decline.
3. Activity sends broadcast to `IncomingCallActionReceiver` (same path as the notification's existing Decline action) with `ACTION_DECLINE` + callId/sender.
4. Activity calls `finishAndRemoveTask()`. Phone remains locked.
5. `IncomingCallActionReceiver` clears SharedPrefs, cancels notification, calls Phase A reject stub.

### Locked screen, caller hangs up before user answers

1. Ringing screen is showing.
2. NativeBackgroundMessagingService receives `hangup` rumor for the same callId.
3. Service cancels notification (existing) and broadcasts `ACTION_CALL_CANCELLED` (NEW).
4. Activity's receiver fires → `finishAndRemoveTask()`.

### Locked screen, 60s elapses with no action

1. Activity's own `Handler.postDelayed` fires → `finishAndRemoveTask()`.
2. Notification's `setTimeoutAfter(60_000)` already cancels the heads-up.

### Locked screen, user taps Accept then cancels PIN

1. Steps 1–4 of accept scenario.
2. `onDismissCancelled` fires → no-op.
3. User is back on the ringing screen; can retry or tap Decline.

### Unlocked screen, heads-up appears

1. Notification posts. Android does NOT fire the full-screen intent because the screen is unlocked and another foreground process exists, OR because the FSI fallback to heads-up applies.
2. User taps Accept action button → `acceptPi` → MainActivity → existing auto-accept (no regression).

### App in foreground, call arrives

1. Notification posts with `setSilent(true)` (existing logic in `IncomingCallNotification.post`, line 80–84).
2. FSI does not fire (foreground activity exists).
3. Svelte `IncomingCallOverlay` shows in-app via the live Nostr subscription path (no change).

## Error Handling

| Scenario | Behavior |
|---|---|
| `requestDismissKeyguard` cancelled (user backs out of PIN) | Stay on ringing screen, allow retry. |
| `requestDismissKeyguard` errors | Fall through to launch MainActivity (rare; device-admin-policy edge cases). |
| `USE_FULL_SCREEN_INTENT` permission denied (Android 14+) | OS already degrades FSI to heads-up. Existing `FullScreenIntentPermissionModal.svelte` flow handles requesting. No new code path needed. |
| Avatar file write fails | Activity uses default placeholder drawable. |
| Activity launched with stale callId (offer expired/cleared) | On `onCreate`, check `nospeak_pending_incoming_call` SharedPrefs. If missing or `expiresAt < now`, finish immediately with no UI. |
| Configuration change (rotation) | Locked to portrait + `configChanges` filter prevents recreate. |
| Multiple calls back-to-back | `singleInstance` launchMode + `EXTRA_CALL_ID` matching. New offer simply replaces the previous SharedPrefs entry; activity's `onNewIntent` updates `callId` and re-arms timeout. |
| FSI fires but app activity already foreground | OS-handled (FSI is suppressed). Foreground Svelte overlay path takes over. |

## Testing

Automated tests are minimal — the activity is mostly framework wiring. Plan should consider:

- One JVM-level unit test for the `writeAvatarToCacheFile` helper (using `Robolectric` if already in classpath, else skip and rely on manual).
- Existing JS tests are unaffected.

Manual matrix (must execute on real device for keyguard behavior; emulator is acceptable for most):

| # | Scenario | Expected |
|---|---|---|
| 1 | Locked, call arrives, tap Accept, enter PIN | Call connects after PIN |
| 2 | Locked, call arrives, tap Decline | Stays locked, caller gets reject (or 60s timeout) |
| 3 | Locked, call arrives, ignore for 60s | Activity dismisses; notification dismisses |
| 4 | Locked, caller hangs up while ringing | Activity dismisses immediately |
| 5 | Locked, tap Accept, cancel PIN entry | Back on ringing screen, can retry |
| 6 | Unlocked, heads-up, tap Accept | Connects immediately (no regression) |
| 7 | App foreground, call arrives | Svelte overlay shows (no regression) |
| 8 | Screen off + locked, call arrives | Screen turns on, ringing screen appears |
| 9 | `USE_FULL_SCREEN_INTENT` denied | Falls back to heads-up only; tap Accept works |
| 10 | Avatar present in cache | Shown on ringing screen |
| 11 | Avatar absent | Identicon (or placeholder) shown |
| 12 | Two calls in quick succession | Second call replaces first; activity shows latest |

## YAGNI / Out of Scope

- Slide-to-answer gesture.
- "Reply with message" quick-reply chips.
- Avatar in the active-call notification (already exists).
- iOS parity.
- Implementing the Phase A native Reject (separate TODO).

## Migration

Pure additive change. No data migration. No JS contract change. Existing in-flight notifications on upgrade simply use the new path on next call.

## File Summary

| File | Status | LOC |
|---|---|---|
| `android/app/src/main/java/com/nospeak/app/IncomingCallActivity.java` | NEW | ~180 |
| `android/app/src/main/res/layout/activity_incoming_call.xml` | NEW | ~80 |
| `android/app/src/main/res/values/styles.xml` | EDIT | +~12 |
| `android/app/src/main/AndroidManifest.xml` | EDIT | +~12 |
| `android/app/src/main/java/com/nospeak/app/IncomingCallNotification.java` | EDIT | ~+25 / −2 |
| `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` | EDIT | ~+15 |
| Optional: avatar util extraction | NEW (maybe) | ~50 |

Total: ~340 lines new + ~50 lines edited. No JS/Svelte changes. No new dependencies. No new permissions.

## Open Decisions for the Implementation Plan

1. Where to place `writeAvatarToCacheFile` — extend `NativeBackgroundMessagingService` with a static accessor or extract avatar resolution into a util class. Recommend the latter; plan to confirm by inspecting current internal coupling.
2. Whether `ShapeableImageView` (MaterialComponents) is on the classpath; pick layout primitives accordingly.
3. Exact insertion sites in `NativeBackgroundMessagingService.handleVoiceCallRumor()` for the cancel broadcast (need to enumerate hangup/reject/busy branches).
4. Whether the pre-API-27 `FLAG_SHOW_WHEN_LOCKED` fallback is reachable given the project's `minSdk`.
