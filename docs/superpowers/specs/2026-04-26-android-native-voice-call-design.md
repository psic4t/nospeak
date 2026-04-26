# Design: Android Native Voice-Call (Phase A — Lock-Screen Calling + Audio Mode)

**Status:** Draft
**Date:** 2026-04-26
**Branch:** voice-calling
**Related:**
- `docs/superpowers/specs/2026-04-25-ephemeral-voice-signaling-design.md` (NIP-40 ephemeral signaling — prerequisite)
- `docs/superpowers/plans/2026-03-28-voice-calling.md` (original voice-calling plan)
- `openspec/specs/voice-calling/spec.md` (current capability spec)

## Problem

Voice calling currently runs entirely inside the WebView using vanilla browser-WebRTC. Three concrete consequences on Android:

1. **Calls do not work when the app is closed or the device is locked.** The
   in-app `IncomingCallOverlay` only renders if the WebView is running. If
   the user receives a call while the app is in the background or the
   device is locked, nothing happens — the call rings out and the user
   sees a missed-call event, but they had no way to answer it.
2. **Audio quality is degraded on Android speakerphone.** Without putting
   the OS audio session in `MODE_IN_COMMUNICATION`, the OS does not engage
   its hardware-tuned voice AEC. WebRTC's internal AEC alone cannot
   adequately handle the loudspeaker → mic feedback loop on most Android
   devices.
3. **Mid-call audio may be killed when the screen goes off or the app is
   backgrounded.** No foreground service holds the call; no wake lock
   prevents CPU suspension. Long calls, screen-off scenarios, and
   user-initiated app switches all risk dropping the call.

## Goal

Phase A delivers a focused fix for the three problems above:

1. Detect incoming calls in the existing background messaging service and
   wake the device with a full-screen-intent notification, so calls ring
   through even when the app is closed and the screen is locked.
2. Put the OS audio session in `MODE_IN_COMMUNICATION` for the duration
   of every call, so OS-level voice AEC engages.
3. Run a `phoneCall`-typed foreground service for the duration of the
   call, holding a partial wake lock so the call survives screen-off,
   app-background, and Doze.
4. When the user accepts an incoming call from the lockscreen, launch
   the activity over the keyguard and resume the call without requiring
   manual unlock.

## Non-goals (deferred to later phases)

- Earpiece-vs-speakerphone toggle. The placeholder in
  `ActiveCallOverlay.svelte:168-181` stays a placeholder.
- Proximity-sensor screen blanking when phone is held to ear.
- Bluetooth SCO support for headsets.
- Audio focus request / abandon (not pausing music apps when a call
  starts).
- Quality telemetry via `getStats`.
- iOS or desktop changes. This work is Android-specific.
- Output device selection on desktop via `setSinkId`.
- Migrating `navigator.vibrate` → `@capacitor/haptics`.

## Approach

Three separate, single-purpose components rather than one mega-service:

1. **Existing `NativeBackgroundMessagingService` gets a small extension.**
   When it decrypts a rumor whose tags include `['type', 'voice-call']`
   and the action is `offer` and the NIP-40 expiration is in the future,
   it persists the parsed signal to SharedPreferences and posts a
   high-priority full-screen-intent notification. Other voice-call
   actions (`answer`, `ice-candidate`, `hangup`, `reject`, `busy`)
   arriving while the app is closed are silently discarded — the call
   setup never reached the user, so mid-call signals are useless.

2. **A new `VoiceCallForegroundService`** lives only during a call.
   `START_NOT_STICKY`, FGS type `phoneCall`. On start it acquires a
   `PARTIAL_WAKE_LOCK`, calls `AudioManager.setMode(MODE_IN_COMMUNICATION)`,
   and posts an ongoing notification with a Hangup action. On stop it
   restores the previous audio mode and releases the wake lock.

3. **A new `AndroidVoiceCallPlugin`** is a thin Capacitor bridge. JS
   calls `startCallSession(...)` and `endCallSession()` to drive the
   FGS lifecycle. JS calls `getPendingIncomingCall()` on app launch to
   read a persisted incoming-call signal. Native emits
   `hangupRequested` when the user taps Hangup in the call notification.

Plus tiny `MainActivity` modifications: `setShowWhenLocked(true)` and
`setTurnScreenOn(true)` when launched via the Accept intent, and a
`KeyguardManager.requestDismissKeyguard()` call.

Plus tiny JS layer modifications: `VoiceCallService` calls
`startCallSession` when entering ringing states and `endCallSession`
when entering `ended`. The app-launch handler reads the pending call
and feeds the offer into `VoiceCallService.handleSignal()`.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ EXISTING: NativeBackgroundMessagingService                         │
│   Watches kind 1059 gift wraps over WebSocket.                     │
│                                                                    │
│   NEW behavior: after decrypting the rumor, before posting a chat  │
│   notification, check rumor.tags for ['type', 'voice-call'].       │
│                                                                    │
│   If voice-call AND signal.action === 'offer' AND not expired:     │
│     1. Write to SharedPrefs `nospeak_pending_incoming_call`        │
│        { signalJson, senderNpub, senderPubkeyHex, receivedAt,      │
│          callId, expiresAt }                                       │
│     2. Build full-screen-intent notification on channel            │
│        `nospeak_voice_call_incoming` with Accept + Decline.        │
│     3. If MainActivity.isAppVisible(): post setSilent(true).       │
│        Else: channel default sound (system ringtone) plays.        │
│     4. Return — do NOT post chat notification for this rumor.      │
│                                                                    │
│   Other voice-call actions while app is closed: discard, return.   │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Notification tap (Accept)
┌────────────────────────────────────────────────────────────────────┐
│ MainActivity (modified)                                            │
│                                                                    │
│   In onCreate / onNewIntent: if intent has accept_pending_call=true│
│     - setShowWhenLocked(true)                                      │
│     - setTurnScreenOn(true)                                        │
│     - KeyguardManager.requestDismissKeyguard(this, null)           │
│   Then dispatch 'voice-call-accept' route via                      │
│   AndroidNotificationRouterPlugin.notifyListeners('routeReceived').│
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ JS bootstraps, listens for route
┌────────────────────────────────────────────────────────────────────┐
│ JS: app-launch incoming-call handler                               │
│                                                                    │
│   On 'routeReceived' with kind === 'voice-call-accept':            │
│     1. const pending = await plugin.getPendingIncomingCall()       │
│     2. if !pending: show toast 'missed call', return.              │
│     3. await plugin.clearPendingIncomingCall()                     │
│     4. voiceCallService.handleSignal(pending.signal,               │
│                                       pending.senderNpub)          │
│        — this enters incoming-ringing.                             │
│     5. voiceCallService.acceptCall()                               │
│        — auto-accept since user already chose on lockscreen.       │
│     6. voiceCallService internally calls                           │
│        plugin.startCallSession({callId, peerNpub, role:'incoming'})│
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ startCallSession
┌────────────────────────────────────────────────────────────────────┐
│ NEW: VoiceCallForegroundService                                    │
│                                                                    │
│   FGS type: phoneCall                                              │
│   Permission: FOREGROUND_SERVICE_PHONE_CALL                        │
│   Restart policy: START_NOT_STICKY                                 │
│                                                                    │
│   onStartCommand:                                                  │
│     - startForeground(NOTIF_ID, buildOngoingNotification(),        │
│         FOREGROUND_SERVICE_TYPE_PHONE_CALL)                        │
│     - acquireWakeLock(PowerManager.PARTIAL_WAKE_LOCK,              │
│                       'nospeak:voice-call')                        │
│     - previousMode = audioManager.getMode()                        │
│     - audioManager.setMode(MODE_IN_COMMUNICATION)                  │
│                                                                    │
│   Hangup notification action → BroadcastReceiver →                 │
│     plugin.notifyListeners('hangupRequested') → JS hangup().       │
│                                                                    │
│   onDestroy:                                                       │
│     - audioManager.setMode(previousMode)                           │
│     - wakeLock.release()                                           │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ endCallSession
                            (restore audio mode, stop service)
```

## Components

### 1. NativeBackgroundMessagingService extension

Modify the existing rumor-handling flow at `NativeBackgroundMessagingService.java:880` (in `handleLiveGiftWrapEvent`).

After NIP-44 decryption produces the rumor, but before the existing
kind 14/15 chat-notification path:

```java
// Voice-call detection — route to incoming-call flow instead of chat notification.
String rumorType = extractTagValue(rumor.tags, "type");
if ("voice-call".equals(rumorType)) {
    handleVoiceCallRumor(rumor, senderPubkeyHex, senderNpub);
    return;
}

// existing kind 14/15 path follows...
```

`handleVoiceCallRumor`:

```java
private void handleVoiceCallRumor(Rumor rumor, String senderPubkeyHex, String senderNpub) {
    // 1. Parse content as VoiceCallSignal
    JSONObject signal;
    try {
        signal = new JSONObject(rumor.content);
    } catch (JSONException e) {
        Log.w(TAG, "[VoiceCall] Malformed signal content, dropping");
        return;
    }
    if (!"voice-call".equals(signal.optString("type"))) return;
    String action = signal.optString("action");
    String callId = signal.optString("callId");
    if (callId.isEmpty()) return;

    // 2. NIP-40 expiration check (defense in depth — receiving service may have
    //    seen the rumor before the JS expiration check would have applied)
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

    // 3. Only 'offer' actions while app is closed result in user-visible notifications.
    //    Other actions (answer/ice-candidate/hangup/reject/busy) without an active call
    //    on the device are useless — discard.
    if (!"offer".equals(action)) {
        Log.d(TAG, "[VoiceCall] Non-offer action '" + action + "' while app closed; discarding");
        return;
    }

    // 4. Persist the offer to SharedPrefs for the JS layer to read on launch.
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

    // 5. Look up peer display name from existing profile cache for the notification.
    String peerName = AndroidProfileCachePrefs.getDisplayName(this, senderPubkeyHex);
    if (peerName == null || peerName.isEmpty()) {
        peerName = senderNpub.substring(0, Math.min(senderNpub.length(), 16)) + "…";
    }

    // 6. Post the full-screen-intent notification.
    postIncomingCallNotification(callId, peerName, senderNpub);
}
```

`postIncomingCallNotification` builds a notification on a new channel
`nospeak_voice_call_incoming` (created at first use). Channel attributes:

- `IMPORTANCE_HIGH` (so heads-up displays even if full-screen-intent is denied).
- `setSound(RingtoneManager.getDefaultUri(TYPE_RINGTONE), AudioAttributes.USAGE_NOTIFICATION_RINGTONE)`.
- `setShouldVibrate(true)`.
- `setLockscreenVisibility(VISIBILITY_PUBLIC)`.

The notification:

- Category `CATEGORY_CALL`.
- `setFullScreenIntent(...)` → `MainActivity` PendingIntent with extras
  `accept_pending_call=true`, `call_id=<callId>`, action
  `Intent.ACTION_VIEW`, flags `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP`.
- Action button "Accept" → same PendingIntent as the full-screen-intent.
  - Action button "Decline" → broadcast intent to a new
  `IncomingCallActionReceiver`, which:
  - Removes the pending-call SharedPrefs.
  - Cancels the notification.
  - Best-effort `reject` signal: the receiver delegates to a small
    helper on `NativeBackgroundMessagingService` that constructs a
    voice-call `reject` rumor, gift-wraps it via the same NIP-44/Schnorr
    pipeline already used for NIP-42 AUTH responses
    (`NativeBackgroundMessagingService.java:2298-2326, 2367-2444,
    2607-2643`), and publishes it on the still-connected WebSocket
    relays. If the messaging service is not running or has no connected
    relays, the reject is dropped silently — caller will see a
    `timeout` end reason. Acceptable degradation.
- `setSilent(true)` if `MainActivity.isAppVisible()`. Otherwise channel
  default sound applies.
- `setOngoing(true)` so the user cannot dismiss it without choosing.
- `setTimeoutAfter(60_000)` so a missed-but-not-declined ring auto-clears
  after the 60-second offer timeout.

### 2. VoiceCallForegroundService (new)

Path: `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java`.

```java
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
    public static final String EXTRA_ROLE = "role"; // "incoming" or "outgoing"

    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean audioModeApplied = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

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
            startForeground(NOTIFICATION_ID, notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
        } catch (Exception e) {
            Log.e(TAG, "[VoiceCallFGS] startForeground failed", e);
            stopSelf();
            return START_NOT_STICKY;
        }

        acquireWakeLock();
        configureAudioMode();
        return START_NOT_STICKY;
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nospeak:voice-call");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(60 * 60 * 1000L); // safety timeout: 1 hour
        } catch (Exception e) {
            Log.w(TAG, "[VoiceCallFGS] wake lock acquire failed", e);
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
            Log.w(TAG, "[VoiceCallFGS] setMode failed", e);
        }
    }

    private void restoreAudioMode() {
        if (!audioModeApplied || audioManager == null) return;
        try {
            audioManager.setMode(previousAudioMode);
        } catch (Exception e) {
            Log.w(TAG, "[VoiceCallFGS] restore audio mode failed", e);
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
        // Tap → opens MainActivity to the call.
        Intent activityIntent = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("nospeak_route_kind", "voice-call-active")
            .putExtra("call_id", callId);
        PendingIntent contentPi = PendingIntent.getActivity(
            this, 0, activityIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Hangup action → broadcast → plugin notifyListeners('hangupRequested')
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
        NotificationManager nm = getSystemService(NotificationManager.class);
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

`START_NOT_STICKY` is intentional. If the system kills this service,
the JS state machine and the WebRTC peer connection are also gone —
auto-restarting an empty FGS would just hold a wake lock for nothing.

**Why a partial wake lock with a 1-hour safety timeout?** Belt and braces.
The FGS contract should keep the process alive on its own; the wake lock
specifically prevents CPU suspension when the screen turns off mid-call.
The safety timeout protects against bugs that forget to release.

### 3. AndroidVoiceCallPlugin (new)

Capacitor plugin at `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java`.

```java
@CapacitorPlugin(name = "AndroidVoiceCall")
public class AndroidVoiceCallPlugin extends Plugin {

    private static AndroidVoiceCallPlugin sInstance;

    public static AndroidVoiceCallPlugin getInstance() { return sInstance; }

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
            call.reject("missing required arguments");
            return;
        }

        Intent svc = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_START)
            .putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, callId)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NPUB, peerNpub)
            .putExtra(VoiceCallForegroundService.EXTRA_PEER_NAME, peerName)
            .putExtra(VoiceCallForegroundService.EXTRA_ROLE, role);
        ContextCompat.startForegroundService(getContext(), svc);
        call.resolve();
    }

    @PluginMethod
    public void endCallSession(PluginCall call) {
        Intent svc = new Intent(getContext(), VoiceCallForegroundService.class)
            .setAction(VoiceCallForegroundService.ACTION_STOP);
        try { getContext().startService(svc); } catch (Exception ignored) {}
        // Always also explicitly stopService for paranoia.
        getContext().stopService(new Intent(getContext(), VoiceCallForegroundService.class));
        call.resolve();
    }

    @PluginMethod
    public void getPendingIncomingCall(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            "nospeak_pending_incoming_call", Context.MODE_PRIVATE);
        String signalJson = prefs.getString("signalJson", null);
        if (signalJson == null) {
            JSObject ret = new JSObject();
            ret.put("pending", null);
            call.resolve(ret);
            return;
        }
        long expiresAt = prefs.getLong("expiresAt", 0L);
        long nowSec = System.currentTimeMillis() / 1000L;
        if (expiresAt > 0 && expiresAt < nowSec) {
            // Stale — clear and report none.
            prefs.edit().clear().apply();
            JSObject ret = new JSObject();
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
        JSObject ret = new JSObject();
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
            NotificationManager nm = (NotificationManager)
                getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            try { canUse = nm.canUseFullScreenIntent(); } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("granted", canUse);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestFullScreenIntentPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:" + getContext().getPackageName()));
                i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) {
                call.reject("could not open full-screen intent settings");
                return;
            }
        }
        call.resolve();
    }

    /** Called by VoiceCallActionReceiver when the user taps Hang up in the notification. */
    public static void emitHangupRequested(String callId) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId);
        p.notifyListeners("hangupRequested", data, true);
    }

    /** Called when an incoming call is detected while the app is foreground.
     *  Lets JS reach for the offer immediately rather than waiting for the user
     *  to tap the notification. */
    public static void emitPendingCallAvailable(String callId) {
        AndroidVoiceCallPlugin p = sInstance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("callId", callId);
        p.notifyListeners("pendingCallAvailable", data, true);
    }
}
```

Plus a small `VoiceCallActionReceiver`:

```java
public class VoiceCallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (VoiceCallForegroundService.ACTION_HANGUP.equals(intent.getAction())) {
            String callId = intent.getStringExtra(VoiceCallForegroundService.EXTRA_CALL_ID);
            AndroidVoiceCallPlugin.emitHangupRequested(callId);
        }
    }
}
```

Plus a small `IncomingCallActionReceiver` (already mentioned above) for
the Decline action; same pattern.

### 4. MainActivity modifications

Add to `MainActivity.java`:

```java
@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    handleIncomingCallIntent(getIntent());
    // ... existing onCreate work
}

@Override
protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handleIncomingCallIntent(intent);
}

private void handleIncomingCallIntent(Intent intent) {
    if (intent == null) return;
    if (!intent.getBooleanExtra("accept_pending_call", false)) return;
    if (Build.VERSION.SDK_INT >= 27) {
        try {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } catch (Exception ignored) {}
        try {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } catch (Exception ignored) {}
    }
    // The existing AndroidNotificationRouterPlugin will emit a 'routeReceived'
    // event with kind 'voice-call-accept' (we'll add this routing case) and the
    // JS layer will handle the rest.
}
```

The existing `AndroidNotificationRouterPlugin` already inspects intent
extras (`nospeak_route_kind`) and dispatches the route to JS. We just
need to add a new route kind `voice-call-accept` to its switch (set
when the notification's pending-intent is built).

### 5. AndroidNotificationRouterPlugin extension

Where the existing plugin parses intent extras and emits `routeReceived`,
add a branch for the voice-call route:

```java
String routeKind = intent.getStringExtra("nospeak_route_kind");
// existing 'chat' branch...
if ("voice-call-accept".equals(routeKind)) {
    JSObject payload = new JSObject();
    payload.put("kind", "voice-call-accept");
    payload.put("callId", intent.getStringExtra("call_id"));
    notifyListeners("routeReceived", payload, true);
    return;
}
```

The incoming-call notification's content/full-screen PendingIntent must
set `nospeak_route_kind=voice-call-accept` when constructing the
activity intent.

### 6. JS layer changes

#### 6.1 VoiceCallService hooks (Capacitor-platform-aware)

`src/lib/core/voiceCall/VoiceCallService.ts` — when entering ringing
states, call into the Android plugin if running on Android. When
ending, call `endCallSession`.

```ts
import { Capacitor } from '@capacitor/core';
import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';

// inside initiateCall, after status -> outgoing-ringing:
if (Capacitor.getPlatform() === 'android') {
    await AndroidVoiceCall.startCallSession({
        callId,
        peerNpub: recipientNpub,
        peerName: peerDisplayName,
        role: 'outgoing'
    });
}

// inside acceptCall / handleOffer (incoming-ringing path), call startCallSession
// with role 'incoming'.

// inside endCall (the private state-transition helper):
if (Capacitor.getPlatform() === 'android') {
    await AndroidVoiceCall.endCallSession();
}
```

Define a thin wrapper at `src/lib/core/voiceCall/androidVoiceCallPlugin.ts`:

```ts
import { registerPlugin } from '@capacitor/core';

interface PendingIncomingCall {
    signalJson: string;
    senderNpub: string;
    senderPubkeyHex: string;
    callId: string;
    receivedAt: number;
    expiresAt: number;
}

interface AndroidVoiceCallPluginShape {
    startCallSession(opts: { callId: string; peerNpub: string; peerName?: string; role: 'incoming' | 'outgoing' }): Promise<void>;
    endCallSession(): Promise<void>;
    getPendingIncomingCall(): Promise<{ pending: PendingIncomingCall | null }>;
    clearPendingIncomingCall(): Promise<void>;
    canUseFullScreenIntent(): Promise<{ granted: boolean }>;
    requestFullScreenIntentPermission(): Promise<void>;
    addListener(eventName: 'hangupRequested', cb: (data: { callId: string }) => void): Promise<{ remove: () => void }>;
    addListener(eventName: 'pendingCallAvailable', cb: (data: { callId: string }) => void): Promise<{ remove: () => void }>;
}

export const AndroidVoiceCall = registerPlugin<AndroidVoiceCallPluginShape>('AndroidVoiceCall');
```

#### 6.2 App-launch handler

The existing notification-router subscriber (in `+layout.svelte` or
similar) gets a new branch:

```ts
import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';
import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';

notificationRouter.addListener('routeReceived', async (payload) => {
    if (payload.kind === 'voice-call-accept') {
        const { pending } = await AndroidVoiceCall.getPendingIncomingCall();
        if (!pending) {
            // toast: missed call
            return;
        }
        await AndroidVoiceCall.clearPendingIncomingCall();
        let signal: VoiceCallSignal;
        try { signal = JSON.parse(pending.signalJson); } catch { return; }
        // Synthesize the incoming-ringing state from the persisted offer.
        await voiceCallService.handleSignal(signal, pending.senderNpub);
        // User already chose Accept on the lockscreen — auto-accept now.
        await voiceCallService.acceptCall();
    } else if (payload.kind === 'chat') {
        // existing chat-route handling
    }
});
```

#### 6.3 Hangup listener

At app start (e.g. in `App.svelte` or a top-level effect):

```ts
if (Capacitor.getPlatform() === 'android') {
    AndroidVoiceCall.addListener('hangupRequested', () => {
        voiceCallService.hangup();
    });
}
```

#### 6.4 Permission prompt on first call attempt

`initiateCall` and the path that invokes `acceptCall` (when the user
explicitly accepts from the in-app UI, not the lockscreen) check
`canUseFullScreenIntent()`. If `false`, before proceeding, show a
modal:

> "To make incoming calls ring through when your screen is locked,
> nospeak needs permission to display full-screen notifications. You'll
> be taken to system settings to grant this. You can skip this and the
> call will still work, but incoming calls won't ring through if your
> phone is locked."

The modal has "Open settings" (calls
`requestFullScreenIntentPermission()`) and "Skip" (proceeds without).
This prompt is shown at most once per app install — track via
localStorage.

### 7. AndroidManifest.xml changes

Add:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
```

Register the new service:

```xml
<service
    android:name=".VoiceCallForegroundService"
    android:exported="false"
    android:foregroundServiceType="phoneCall" />
```

Register the receivers:

```xml
<receiver
    android:name=".VoiceCallActionReceiver"
    android:exported="false" />
<receiver
    android:name=".IncomingCallActionReceiver"
    android:exported="false" />
```

The existing `WAKE_LOCK` and `MODIFY_AUDIO_SETTINGS` permissions stay.

### 8. Battery optimization whitelist

No new prompt. The existing
`AndroidBackgroundMessagingPlugin.requestIgnoreBatteryOptimizations`
flow targets the OS-level
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` setting which is app-wide; once
granted, both messaging and call services benefit.

The user-facing copy on the existing prompt MAY be updated to mention
calls (e.g. "Granting this lets nospeak deliver messages and incoming
calls reliably") but this is a copy-only tweak, not architecture.

## Data flow walkthroughs

### Walkthrough 1: incoming call, app closed, screen locked

1. Caller's WebRTC peer-connection produces an SDP offer.
2. Caller's JS sends a NIP-17 gift-wrapped Kind 14 rumor with
   `['type', 'voice-call']` and `['expiration', now+60]` tags.
3. Receiver's `NativeBackgroundMessagingService` receives the Kind 1059
   gift wrap over its WebSocket subscription.
4. Service decrypts the gift wrap → seal → rumor.
5. Service detects the `type:voice-call` tag, routes to
   `handleVoiceCallRumor`.
6. NIP-40 expiration check passes (offer is fresh).
7. Action is `offer` → service writes pending call to SharedPrefs and
   posts the full-screen-intent notification on
   `nospeak_voice_call_incoming` channel with system ringtone.
8. Android, finding the screen locked and full-screen-intent
   permission granted, launches `MainActivity` over the keyguard with
   extras `accept_pending_call=true, call_id=<x>`. Ringtone plays.
   Phone vibrates.
9. User taps Accept (the full-screen UI). Notification dismissed.
10. `MainActivity.onCreate` calls `setShowWhenLocked(true)`,
    `setTurnScreenOn(true)`, and `requestDismissKeyguard`. The
    activity is now visible without manual unlock.
11. WebView starts. JS bootstraps. Stores hydrate.
12. Notification-router emits `routeReceived` with kind
    `voice-call-accept`.
13. JS listener calls `getPendingIncomingCall()` →
    `{pending: {signalJson, senderNpub, ...}}`.
14. JS calls `clearPendingIncomingCall()` (idempotent cleanup).
15. JS parses the signal, calls `voiceCallService.handleSignal(signal,
    senderNpub)`. State machine enters `incoming-ringing`. The in-app
    `IncomingCallOverlay` would normally mount here, but the launch
    handler also passes a flag to skip the ringing UI (the user already
    chose Accept on the lockscreen).
16. JS immediately calls `voiceCallService.acceptCall()` without
    waiting for user input. State enters `connecting`. The user sees
    the `ActiveCallOverlay` directly, never the `IncomingCallOverlay`.
17. `acceptCall()` calls `getUserMedia`, `setRemoteDescription(offer)`,
    `createAnswer`, sends the answer.
18. `acceptCall()` also calls
    `AndroidVoiceCall.startCallSession({callId, peerNpub, role:
    'incoming'})`.
19. Native `VoiceCallForegroundService` starts. Acquires partial wake
    lock. Sets `MODE_IN_COMMUNICATION`. Posts ongoing call notification.
20. ICE completes. State enters `active`.
21. Conversation continues. Screen turns off via OS timeout. CPU stays
    awake (wake lock). Audio session remains in voice-comm mode.
22. User taps Hang up in the notification (or in the in-app overlay).
23. JS calls `voiceCallService.hangup()`. State enters `ended`.
24. `endCall` calls `AndroidVoiceCall.endCallSession()`. Native FGS
    stops, restores audio mode, releases wake lock.

### Walkthrough 2: outgoing call, screen locked mid-call

1. User in app, taps call button. JS `initiateCall`.
2. Status enters `outgoing-ringing`. JS calls
   `startCallSession({role: 'outgoing'})`.
3. Native FGS starts. Wake lock + voice-comm mode.
4. Peer answers; ICE completes; status becomes `active`.
5. User locks the phone (presses power button). Screen off.
6. Wake lock keeps CPU running. FGS keeps process running. Audio mode
   keeps voice AEC engaged.
7. User unlocks. In-app `ActiveCallOverlay` is visible (it was mounted
   in the root layout and never unmounted).
8. User taps Hang up. `endCallSession()` → FGS stops.

### Walkthrough 3: incoming call, app foreground

1. JS is running. WebRTC stack is registered. The signal sender hook
   in `Messaging.ts` is wired.
2. Native messaging service still running in the background and
   independently receives the offer over its WebSocket.
3. Service detects voice-call → persists to prefs, posts notification.
4. Because `MainActivity.isAppVisible()`, the notification is posted
   with `setSilent(true)` — no native ringtone.
5. JS, also subscribed to relays via the live (in-app) flow, also
   receives the offer. JS handles it via the existing
   `voiceCallService.handleSignal` path. State enters
   `incoming-ringing`. JS ringtone (`ringtone.ts`) plays.
6. User accepts via in-app `IncomingCallOverlay`. Standard accept
   flow.
7. Notification still showing — when JS calls `acceptCall()`, the
   resulting `startCallSession` invocation in
   `VoiceCallForegroundService` cancels the incoming-call notification
   (the FGS knows the notification ID for the incoming channel and
   dismisses it via `NotificationManager.cancel(...)` before posting
   its own ongoing notification). This is a small additional step in
   the FGS `onStartCommand`: before `startForeground`, call
   `nm.cancel(INCOMING_NOTIFICATION_ID)`.

The dual-arrival (native sees it AND JS sees it) is normal because
both paths subscribe to the same relays. The JS path does its work as
before; the native path posts a silent notification that gets
dismissed.

### Walkthrough 4: full-screen-intent permission denied

1. User is in the app. Taps call button (or accepts an in-app
   incoming call).
2. JS calls `canUseFullScreenIntent()` → `{granted: false}`.
3. JS shows the explanation modal. User taps "Open settings".
4. JS calls `requestFullScreenIntentPermission()` → opens system
   settings page.
5. User toggles permission, returns to app.
6. JS does NOT re-check on return; the next call will benefit.
7. If the user taps "Skip", proceeds without. Future incoming calls
   while the device is locked will arrive as heads-up notifications
   only — user must swipe to unlock to accept.

## Error handling

| Error | Handling |
|---|---|
| `USE_FULL_SCREEN_INTENT` denied | Notification still posts as IMPORTANCE_HIGH heads-up; user must swipe to unlock to accept. JS prompts user once with explanation modal. |
| `setMode(MODE_IN_COMMUNICATION)` fails | Logged; call continues without OS-level voice AEC. WebRTC's internal AEC still runs. |
| Wake lock unavailable | Should never happen (`WAKE_LOCK` is normal-level permission). If it does, logged; call continues. |
| `startForeground` rejected (e.g. background launch restriction on Android 15) | FGS aborts, plugin call resolves successfully but service is dead. JS's call setup will likely fail when audio mode change doesn't happen. Acceptable degradation. |
| Pending-call SharedPrefs missing on tap (e.g. cleared by another path) | JS shows toast "Missed call". |
| Pending-call SharedPrefs expired (>60s old) | Plugin returns `pending: null`. Same as missing. |
| Decline action posts `reject` signal but service is offline | Reject is dropped silently. Caller will see `timeout` end reason. Acceptable. |
| Hangup notification action fires but plugin sInstance is null (process restarted) | Receiver still kills the FGS via direct `stopService`. JS state may desync but existing `cleanup()` paths handle it. |
| App killed mid-call (low memory) | FGS dies (`START_NOT_STICKY`). Wake lock released by system. Audio mode reverts to OS default. User sees call drop. Caller eventually sees ICE failure. Acceptable for Phase A. |

## Testing strategy

### Unit tests (vitest, JS side only)

The JS-layer additions are testable. The Android-side additions are
integration-tested manually.

1. `androidVoiceCallPlugin.ts` is a plain `registerPlugin` wrapper;
   no logic to unit test.

2. `VoiceCallService` test extensions (in
   `src/lib/core/voiceCall/VoiceCallService.test.ts`):
   - `initiateCall` calls `AndroidVoiceCall.startCallSession` with
     correct args when platform is Android. Mock
     `Capacitor.getPlatform` and the plugin.
   - `initiateCall` does NOT call `startCallSession` on web.
   - `acceptCall` calls `startCallSession` with role `incoming`.
   - `endCall` (state transition) calls `endCallSession` on Android.

3. App-launch handler test (new file):
   - When `routeReceived` arrives with kind `voice-call-accept` and
     `getPendingIncomingCall` returns a pending offer, the handler
     calls `clearPendingIncomingCall`, parses the signal, and calls
     `handleSignal` then `acceptCall`.
   - When `getPendingIncomingCall` returns `null`, the handler shows
     the toast (mock the toast utility) and does NOT call
     `handleSignal`.
   - When `signalJson` fails to parse, the handler shows the toast
     and does NOT call `handleSignal`.

4. Permission-prompt logic test (new file):
   - First call attempt with `canUseFullScreenIntent` returning
     `false` shows the modal.
   - Modal "Skip" sets a localStorage flag that prevents re-prompting.
   - Modal "Open settings" calls
     `requestFullScreenIntentPermission`.

### Manual smoke tests

These require a real Android device.

1. **Incoming call, app closed, device unlocked** → notification heads-up
   with system ringtone; tap Accept → call connects.
2. **Incoming call, app closed, device locked, FSI permission granted**
   → activity launches over keyguard, ringtone plays, tap Accept →
   keyguard dismisses, call connects, audio works.
3. **Incoming call, app closed, device locked, FSI permission DENIED**
   → heads-up notification only; user swipes to unlock; tap Accept →
   call connects.
4. **Incoming call, app foreground** → in-app overlay rings (JS
   ringtone), notification is posted silently, tap Accept in the
   overlay → call connects.
5. **Outgoing call, screen locks mid-ring** → call survives, peer
   answers, audio works, hangup notification visible on lockscreen.
6. **Active call, app backgrounded** → audio continues, hangup
   notification persists, returning to app shows the
   `ActiveCallOverlay`.
7. **Active call, screen-off for 60s** → audio continues without
   gaps; CPU stays awake; battery drain is reasonable.
8. **Active call, hangup from notification** → call ends, audio mode
   restored.
9. **Active call, hangup from in-app UI** → call ends, FGS stops,
   ongoing notification dismissed.
10. **Permission revocation mid-app-life** (advanced): grant FSI,
    make a call, revoke FSI in settings, make another call → app
    should detect and re-prompt.
11. **Decline from lockscreen** → reject signal sent, caller sees
    `rejected` reason, no leftover ringing.
12. **Stale pending offer**: kill app, simulate >60s elapsed, manually
    invoke notification tap (or wait for `setTimeoutAfter`) → toast
    "Missed call", no orphaned state.
13. **Two incoming calls within 60s**: first call's pending prefs
    overwritten by second; first notification dismissed; second
    notification active. User accepts second; first call shows up as
    missed-call event in chat history.

### OpenSpec capability spec

Extend `openspec/specs/voice-calling/spec.md` with new requirements
under a new section "Android Lock-Screen and Foreground Service":

- Requirement: Voice-Call Foreground Service Lifecycle
- Requirement: Audio Mode Configuration
- Requirement: Lock-Screen Incoming Call Notification
- Requirement: Pending Incoming Call Handoff
- Requirement: Full-Screen Intent Permission

Each with at least one `#### Scenario:` per the OpenSpec format.

## Risks and trade-offs

- **NIP-40 advisory check duplicated.** The native side re-validates
  `expiration` even though JS will too. The cost is ~5 lines of Java
  and a small reduction in surprise: the native ringtone won't fire
  for an already-expired offer. Worth it.

- **JS may receive the offer twice** (once via its live subscription,
  once via the persisted prefs on launch). `voiceCallService.handleSignal`
  is responsible for dedup. Inspecting the current implementation at
  `src/lib/core/voiceCall/VoiceCallService.ts:112-130, 250-270`,
  `handleOffer` checks `state.status !== 'idle'` and replies `busy`
  rather than entering a second incoming state — but in this case the
  second offer is from the SAME peer with the SAME callId, so a `busy`
  reply would be wrong. We need a small adjustment: if the incoming
  offer matches the current `state.callId` AND `state.peerNpub`, treat
  it as a duplicate and ignore. This is a one-line fix in `handleOffer`
  and is covered by a new unit test in the implementation plan (test:
  "duplicate offer for the active call is ignored, not bounced as
  busy").

- **Auto-accept after lockscreen Accept tap** could surprise a user
  who taps Accept by accident. There is no "undo." This matches
  every other phone app's behavior, so we accept the risk.

- **`START_NOT_STICKY` means a system-killed FGS does not recover.**
  The user sees the call drop. This matches what Android phone apps
  do; recovery would require persisting all WebRTC state which is
  out of scope.

- **Full-screen-intent permission** on Android 14+ requires explicit
  user grant via Settings. Many users will skip this, so the
  lockscreen ringing is a "best when granted" feature, not a
  guaranteed one. This is the same compromise every Android calling
  app makes since 14.

- **Audio mode restoration race**: if multiple subsystems (ringtone,
  FGS, voice-message recorder) are active at once and modify the
  audio mode, restoration order matters. Ringtone is a separate Web
  Audio path that does not touch `AudioManager.setMode`. Voice
  recorder uses `AudioRecord` (different subsystem). So in practice
  only the FGS will call `setMode` in the call path. Confirmed safe.

- **Notification dismissal coordination**: when the in-app UI ends a
  call, the ongoing call notification needs to be dismissed by the
  FGS stopping. When the FGS receives `ACTION_STOP`, `stopForeground`
  + `stopSelf` should clear it. Verify in walkthrough.

- **Service binding to the messaging service**. The voice-call FGS
  does NOT depend on the messaging service. They are independent.
  The messaging service is the trigger; the call FGS is the host
  during the call. If the messaging service is disabled, incoming
  calls don't ring through (already a known limitation), but
  outgoing calls and in-app accepts still work.

## Out of scope (deferred to later phases)

- Speaker / earpiece toggle.
- Proximity sensor → screen blank.
- Bluetooth SCO support.
- Audio focus request / abandon.
- Quality telemetry via `getStats`.
- iOS support.
- `setSinkId` desktop output device picker.
- Migrating `navigator.vibrate` to `@capacitor/haptics`.
- Latent mute bug fix (when `localStream` is null).

## OpenSpec capability

The `voice-calling` capability spec at
`openspec/specs/voice-calling/spec.md` will be extended with
Android-specific requirements (no separate change proposal; user
direction is to keep using the design + spec backfill workflow).

## Migration / rollout

- All changes are Android-specific. iOS, desktop, and web remain
  identical to today.
- Existing users on Android upgrade in-place. The first time they
  initiate or accept a call, they're prompted for the
  `USE_FULL_SCREEN_INTENT` permission.
- No persistent state migration needed: the new
  `nospeak_pending_incoming_call` SharedPrefs file is created on
  first use and is empty until then.
- The existing `nospeak_background_service` notification channel and
  the existing `nospeak_background_messages` channel are unaffected.
- Two new notification channels are created on first use:
  `nospeak_voice_call_incoming` and `nospeak_voice_call_active`.
