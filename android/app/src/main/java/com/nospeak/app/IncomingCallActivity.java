package com.nospeak.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.drawable.Drawable;
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

/**
 * Lockscreen ringing screen for incoming voice calls.
 *
 * Launched as the target of {@link IncomingCallNotification}'s full-screen intent.
 * Shows the call UI over the keyguard WITHOUT dismissing it. PIN entry is only
 * requested after the user explicitly taps Accept ({@link KeyguardManager#requestDismissKeyguard}).
 *
 * After successful keyguard dismissal, starts the
 * {@link VoiceCallForegroundService} with {@code ACTION_ACCEPT_NATIVE};
 * the FGS reads the persisted offer from SharedPreferences, drives
 * {@link NativeVoiceCallManager}, and surfaces
 * {@link ActiveCallActivity}. For PIN-locked nsec users the activity
 * routes through {@link MainActivity} with
 * {@link VoiceCallIntentContract#EXTRA_UNLOCK_FOR_CALL} so the JS
 * unlock screen can collect the PIN before the FGS resumes the accept.
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

    /**
     * Intent action set by the heads-up CallStyle Accept button on the
     * incoming-call notification. Auto-runs the same flow as the user
     * tapping Accept on the visible ringing screen, but skips the
     * ringing UI bind (the user already chose Accept). Routes to
     * {@link VoiceCallForegroundService#ACTION_ACCEPT_NATIVE} +
     * {@link ActiveCallActivity} like a normal Accept tap. Without
     * this, heads-up Accept used to launch MainActivity, which then
     * raced the FGS over the {@code nospeak_pending_incoming_call}
     * SharedPreferences slot.
     */
    public static final String ACTION_AUTO_ACCEPT =
        "com.nospeak.app.voicecall.AUTO_ACCEPT";

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

    /**
     * True between the Accept tap and the keyguard-dismiss callback firing.
     * Reset to false only in {@link KeyguardManager.KeyguardDismissCallback#onDismissCancelled};
     * the success and error paths both call {@code finishAndRemoveTask()} so the residual
     * {@code true} value is unobservable. If a future change adds a non-finishing branch,
     * remember to reset this field there too.
     */
    private boolean acceptInProgress = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        applyShowWhenLockedFlags();

        Intent intent = getIntent();
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "onCreate action=" + action);

        setContentView(R.layout.activity_incoming_call);

        readExtras(intent);
        Log.d(TAG, "onCreate callId=" + callId + " action=" + action);
        if (!hasValidPendingOffer()) {
            Log.d(TAG, "No valid pending offer — finishing immediately");
            finishAndRemoveTask();
            return;
        }

        // Auto-accept path: the user tapped Accept on the heads-up
        // CallStyle notification. Run the same flow as
        // onAcceptClicked() without first painting the ringing UI.
        // The activity will be finishAndRemoveTask'd by the launch
        // runnable inside onAcceptClicked, so we don't bother binding
        // the ringing UI or arming the ringing timeout.
        if (ACTION_AUTO_ACCEPT.equals(action)) {
            Log.d(TAG, "ACTION_AUTO_ACCEPT — invoking accept flow directly");
            onAcceptClicked();
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
        if (avatarView != null) {
            // Cached real picture first; identicon fallback when the
            // peer has no profile picture (or when it isn't cached on
            // this device yet). Matches the heads-up CallStyle
            // notification's behavior for picture-less peers.
            Drawable avatarDrawable = CallAvatarLoader.loadCircular(
                this, avatarPath, senderPubkeyHex, /*targetPx*/ 192);
            if (avatarDrawable != null) {
                avatarView.setImageDrawable(avatarDrawable);
            }
            // else: leave the layout's @drawable/ic_call_avatar_placeholder
            // in place — only happens when peerHex is null/invalid.
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
        if (acceptInProgress) {
            Log.d(TAG, "Accept already in progress — ignoring duplicate tap");
            return;
        }
        acceptInProgress = true;
        setButtonsEnabled(false);

        // Snapshot callId so a replacement offer arriving via onNewIntent during
        // the keyguard dismiss in-flight can't mutate what we accept.
        final String acceptedCallId = callId;
        Log.d(TAG, "Accept tapped for callId=" + acceptedCallId);
        timeoutHandler.removeCallbacks(timeoutRunnable);

        // Accept goes directly to the native FGS (which builds the peer
        // connection and sends the kind-25051 Answer) and the native
        // ActiveCallActivity. MainActivity is NOT on the critical path
        // for accept — the WebView only comes up later if the user
        // navigates to chat or settings. The previous
        // enableNativeCalls flag has been removed; native is the only
        // Android voice-call path.
        final Runnable launch = new Runnable() {
            @Override
            public void run() {
                // Detect a missing in-memory signing secret. We need a
                // fully-loaded signing context to author the kind-25051
                // Answer. NBMS should be alive (it just decrypted the
                // offer that triggered this Activity), but the local
                // secret may not have been paged into memory yet on a
                // cold-start nsec configuration. reloadLocalSecretFromStore
                // is a cheap, encryption-only recovery; it succeeds for
                // any user whose secret is in the EncryptedSharedPreferences
                // store (i.e. unless they're entirely PIN-gated).
                NativeBackgroundMessagingService nbms =
                    NativeBackgroundMessagingService.getInstance();
                boolean needsUnlock;
                if (nbms == null) {
                    // Should not happen — NBMS posted the FSI that
                    // launched us — but guard for it anyway.
                    needsUnlock = true;
                } else if ("nsec".equalsIgnoreCase(nbms.getCurrentMode())) {
                    if (nbms.hasLocalSecretLoaded()) {
                        needsUnlock = false;
                    } else {
                        needsUnlock = !nbms.reloadLocalSecretFromStore();
                    }
                } else {
                    // Amber mode signs through ContentResolver; no
                    // in-memory secret to load.
                    needsUnlock = false;
                }
                if (needsUnlock) {
                    persistPendingUnlockIntent(acceptedCallId);
                    // Start the FGS in await-unlock mode so it's alive
                    // (and registered for ACTION_UNLOCK_COMPLETE) by the
                    // time the user enters their PIN. Also arms the 30s
                    // unlock timeout.
                    Intent awaitSvc = new Intent(IncomingCallActivity.this, VoiceCallForegroundService.class)
                        .setAction(VoiceCallForegroundService.ACTION_AWAIT_UNLOCK)
                        .putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, acceptedCallId)
                        .putExtra(VoiceCallForegroundService.EXTRA_PEER_NAME,
                            peerName != null ? peerName : "");
                    try {
                        androidx.core.content.ContextCompat.startForegroundService(
                            IncomingCallActivity.this, awaitSvc);
                    } catch (Exception e) {
                        Log.w(TAG, "AWAIT_UNLOCK startForegroundService failed", e);
                    }
                    Intent unlockIntent = new Intent(IncomingCallActivity.this, MainActivity.class)
                        .setAction(Intent.ACTION_VIEW)
                        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        .putExtra(VoiceCallIntentContract.EXTRA_UNLOCK_FOR_CALL, acceptedCallId)
                        .putExtra("nospeak_route_kind", "voice-call-unlock");
                    startActivity(unlockIntent);
                    finishAndRemoveTask();
                    return;
                }
                // Start FGS with ACCEPT — the FGS reads the offer from
                // SharedPreferences, drives NativeVoiceCallManager, AND
                // owns the ActiveCallActivity launch. Putting the launch
                // in the FGS (rather than here) avoids the lockscreen
                // race where IncomingCallActivity.finishAndRemoveTask()
                // during keyguard dismissal caused MainActivity's task
                // to be promoted instead of ActiveCallActivity, leaving
                // the user on the chat screen with no in-call surface.
                Intent svc = new Intent(IncomingCallActivity.this, VoiceCallForegroundService.class)
                    .setAction(VoiceCallForegroundService.ACTION_ACCEPT_NATIVE)
                    .putExtra(VoiceCallForegroundService.EXTRA_CALL_ID, acceptedCallId)
                    .putExtra(VoiceCallForegroundService.EXTRA_PEER_NAME,
                        peerName != null ? peerName : "");
                try {
                    androidx.core.content.ContextCompat.startForegroundService(
                        IncomingCallActivity.this, svc);
                    Log.d(TAG, "ACCEPT_NATIVE FGS dispatched callId=" + acceptedCallId);
                } catch (Exception e) {
                    Log.w(TAG, "ACCEPT_NATIVE startForegroundService failed", e);
                }
                finishAndRemoveTask();
            }
        };

        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isKeyguardLocked()
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    Log.d(TAG, "Keyguard dismissed — launching native FGS");
                    launch.run();
                }

                @Override
                public void onDismissCancelled() {
                    Log.d(TAG, "Keyguard dismiss cancelled by user — staying on ringing screen");
                    acceptInProgress = false;
                    setButtonsEnabled(true);
                    // Re-validate the pending offer before re-arming: it may have
                    // expired while the user was at the PIN prompt.
                    if (!hasValidPendingOffer()) {
                        Log.d(TAG, "Pending offer expired during PIN cancel — finishing");
                        finishAndRemoveTask();
                        return;
                    }
                    // Re-arm the timeout (we cleared it above).
                    timeoutHandler.postDelayed(timeoutRunnable, RINGING_TIMEOUT_MS);
                }

                @Override
                public void onDismissError() {
                    Log.w(TAG, "Keyguard dismiss error — falling through to launch");
                    launch.run();
                }
            });
        } else {
            launch.run();
        }
    }

    /**
     * Persist the pending accept payload (callId + a timestamp) for the
     * native call manager to resume after the user enters their PIN.
     * The actual offer SDP is already in {@code nospeak_pending_incoming_call}
     * (written by NativeBackgroundMessagingService); we only stash the
     * callId here so the unlock-complete handler knows which call to
     * resume.
     */
    private void persistPendingUnlockIntent(String acceptedCallId) {
        try {
            SharedPreferences prefs = getSharedPreferences(
                VoiceCallIntentContract.PREFS_FILE, MODE_PRIVATE);
            prefs.edit()
                .putString(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK, acceptedCallId)
                .putLong(VoiceCallIntentContract.PREF_PENDING_CALL_UNLOCK + ":ts",
                    System.currentTimeMillis())
                .apply();
        } catch (Exception e) {
            Log.w(TAG, "persistPendingUnlockIntent failed", e);
        }
    }

    private void setButtonsEnabled(boolean enabled) {
        ImageButton accept = findViewById(R.id.incoming_call_accept);
        if (accept != null) accept.setEnabled(enabled);
        ImageButton decline = findViewById(R.id.incoming_call_decline);
        if (decline != null) decline.setEnabled(enabled);
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

        // If the device is locked, route the user back to the launcher BEFORE
        // finishing this activity. This activity runs in its own task
        // (singleInstance + empty taskAffinity); without an explicit redirect,
        // Android promotes the next-most-recent task — typically MainActivity's
        // background task, which is kept alive by NativeBackgroundMessagingService —
        // and surfaces it over the keyguard. Launching the home intent makes the
        // launcher the new foreground task; because the launcher cannot show over
        // the lockscreen, the keyguard remains visible after we finish.
        try {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                Intent home = new Intent(Intent.ACTION_MAIN);
                home.addCategory(Intent.CATEGORY_HOME);
                home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(home);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to route to home before decline finish", e);
        }

        finishAndRemoveTask();
    }
}
