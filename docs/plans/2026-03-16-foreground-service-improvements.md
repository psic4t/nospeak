# Foreground Service Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve nospeak's background messaging service resilience by adding network change reconnect and `onTaskRemoved` handling, based on patterns from Conversations XMPP client.

**Architecture:** Register a `ConnectivityManager.NetworkCallback` to detect network availability changes and immediately reconnect WebSockets (resetting retry backoff). Add `onTaskRemoved` override to keep the service alive when the user swipes the app from recents. Both are minimal, additive changes to `NativeBackgroundMessagingService.java`.

**Tech Stack:** Android SDK (Java), OkHttp WebSocket

---

### Task 1: Add network change reconnect

**Problem:** When the device switches between WiFi and mobile (or regains connectivity after a tunnel/airplane mode), nospeak relies on OkHttp's failure detection + exponential backoff. This can delay reconnection by up to 5 minutes.

**Solution:** Register a `ConnectivityManager.NetworkCallback` in `onCreate`. When network becomes available, reset all retry counters and immediately reconnect any disconnected relays.

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

**Step 1: Add imports**

Add these imports to the import block (near existing `android.net.Uri`):

```java
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
```

**Step 2: Add `networkCallback` field**

After the existing `private BroadcastReceiver deviceStateReceiver;` field (line 174), add:

```java
    private ConnectivityManager.NetworkCallback networkCallback;
```

**Step 3: Register the NetworkCallback in `onCreate`**

After the `registerReceiver(deviceStateReceiver, intentFilter);` block (after line 374), add:

```java
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    if (!serviceRunning || currentPubkeyHex == null) {
                        return;
                    }
                    if (handler == null) {
                        return;
                    }
                    handler.post(() -> reconnectDisconnectedRelays("network_available"));
                }
            };

            NetworkRequest networkRequest = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            cm.registerNetworkCallback(networkRequest, networkCallback);
        }
```

**Step 4: Add `reconnectDisconnectedRelays` method**

Add this method after the existing `evaluateAndApplyEnergyProfile` method (after line 302):

```java
    private void reconnectDisconnectedRelays(String reason) {
        if (!serviceRunning || currentPubkeyHex == null || configuredRelays == null) {
            return;
        }

        // Remove any pending retry callbacks — we're reconnecting now
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
            // Re-post the lock grace timer if it was active
            if (screenOffAtMs > 0L && lockGraceRunnable != null) {
                long elapsed = System.currentTimeMillis() - screenOffAtMs;
                long remaining = LOCK_GRACE_MS - elapsed;
                if (remaining > 0) {
                    handler.postDelayed(lockGraceRunnable, remaining);
                }
            }
        }

        synchronized (activeSockets) {
            for (String relayUrl : configuredRelays) {
                if (relayUrl == null || relayUrl.isEmpty()) {
                    continue;
                }
                if (!activeSockets.containsKey(relayUrl)) {
                    retryAttempts.put(relayUrl, 0);
                    connectRelay(relayUrl, currentPubkeyHex);
                }
            }
        }

        if (isDebugBuild()) {
            Log.d(LOG_TAG, "Reconnecting disconnected relays (reason=" + reason + ")");
        }
    }
```

**Step 5: Unregister the NetworkCallback in `onDestroy`**

In `onDestroy`, after the `deviceStateReceiver` unregistration block (after line 520), add:

```java
        if (networkCallback != null) {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                try {
                    cm.unregisterNetworkCallback(networkCallback);
                } catch (IllegalArgumentException ignored) {
                    // ignore
                }
            }
            networkCallback = null;
        }
```

**Step 6: Build and verify**

Run: `cd android && ./gradlew assembleDebug 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

**Step 7: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java
git commit -m "feat(android): reconnect WebSockets immediately on network change

Register a ConnectivityManager.NetworkCallback to detect when network
becomes available. On network change, reset retry backoff and immediately
reconnect any disconnected relays instead of waiting up to 5 minutes for
the exponential backoff timer."
```

---

### Task 2: Add `onTaskRemoved` handler

**Problem:** When the user swipes the app from recents, some OEMs (Samsung, Xiaomi) may kill the service without restarting it, even with `START_STICKY`. Conversations handles this by explicitly keeping the service alive if foreground mode is active.

**Solution:** Override `onTaskRemoved` — if the service is running, ignore the task removal. Otherwise, call `stopSelf()`.

**Files:**
- Modify: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`

**Step 1: Add `onTaskRemoved` override**

Add this method after the existing `onTimeout` method (after line 503):

```java
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        if (serviceRunning) {
            Log.d(LOG_TAG, "onTaskRemoved: ignoring, service is active");
        } else {
            Log.d(LOG_TAG, "onTaskRemoved: service not running, stopping");
            stopSelf();
        }
    }
```

**Step 2: Build and verify**

Run: `cd android && ./gradlew assembleDebug 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

**Step 3: Commit**

```bash
git add android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java
git commit -m "fix(android): handle onTaskRemoved to survive app swipe on aggressive OEMs

Some OEMs (Samsung, Xiaomi) may kill the foreground service when the user
swipes the app from recents. Explicitly ignore the task removal when the
service is active, matching Conversations XMPP client pattern."
```

---

### Task 3: Final verification

**Step 1: Run full build**

Run: `npm run check && npx vitest run`
Expected: 0 errors/warnings, all tests pass (except pre-existing crypto-roundtrip failures)

**Step 2: Run Android build**

Run: `cd android && ./gradlew assembleDebug 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL
