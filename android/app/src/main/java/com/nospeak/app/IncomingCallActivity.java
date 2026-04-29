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

        final Runnable launchMain = new Runnable() {
            @Override
            public void run() {
                Intent i = new Intent(IncomingCallActivity.this, MainActivity.class)
                    .setAction(Intent.ACTION_VIEW)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra("accept_pending_call", true)
                    .putExtra("call_id", acceptedCallId)
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
                    Log.w(TAG, "Keyguard dismiss error — falling through to launch MainActivity");
                    launchMain.run();
                }
            });
        } else {
            launchMain.run();
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
