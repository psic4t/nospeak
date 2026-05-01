import { Capacitor } from '@capacitor/core';
import { get } from 'svelte/store';
import { signer } from '$lib/stores/auth';
import {
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_REJECT
} from './constants';

/**
 * localStorage key for the one-time NIP-AC permission pre-warm.
 *
 * `_v1` lets us bump the suffix in the future if we add new kinds (e.g.
 * kind 25055 Renegotiate when video lands) and need to re-warm existing
 * Amber sessions.
 */
const AMBER_NIP_AC_WARMED_KEY = 'nospeak:amber_nip_ac_warmed_v1';
const AUTH_METHOD_KEY = 'nospeak:auth_method';

/**
 * Pre-warm Amber's per-app+kind permission grants for the NIP-AC kinds
 * that natural usage doesn't seed.
 *
 * Background: Amber v6.x grants signing permission per-app+kind via the
 * interactive Intent path. The `permissions` extra at `get_public_key`
 * time is non-binding on at least v6.0.3 — kinds only enter the grant
 * set after the user has been prompted at least once via interactive
 * Intent and tapped "Allow + remember." Subsequent calls then succeed
 * silently via the ContentResolver path.
 *
 * The natural call flow seeds kinds 25051 (Answer), 25052 (ICE), and
 * 25053 (Hangup) the first time the user accepts an incoming call,
 * because each of those signs is dispatched through the JS-side
 * `Nip55Signer` which has an interactive-Intent fallback for null
 * cursor (no prior grant). But:
 *
 *  - kind **25050 (Offer)** is signed only when the user *initiates* a
 *    call. A user who only ever receives calls never has it granted.
 *  - kind **25054 (Reject)** is signed by the native Java decline path
 *    (`IncomingCallActionReceiver` → `sendVoiceCallReject`), which
 *    runs in a BroadcastReceiver context with no Activity to host an
 *    interactive prompt. Without a prior grant, the Java path silently
 *    fails with `rejected` from the ContentResolver, and the caller
 *    never receives a kind-25054 wrap.
 *
 * This function fires dummy `signEvent` calls for kinds 25050 and
 * 25054 through the JS signer, so Amber's interactive-Intent fallback
 * fires, the user is prompted once per kind, and the grants are seeded.
 * The signed events are discarded — they are NEVER published.
 *
 * **Idempotency**: a localStorage flag (`AMBER_NIP_AC_WARMED_KEY`)
 * gates re-runs. Set after the first invocation regardless of
 * individual sign outcomes — if the user explicitly rejects a kind in
 * Amber, we don't re-prompt them on every launch. They can log out
 * and back in (which clears the flag) to retry.
 *
 * **No-op when not applicable**: returns immediately on non-Android
 * platforms and on auth methods other than Amber. nsec users have no
 * permission model; NIP-07 / NIP-46 users use different signer
 * pipelines that don't have this gap.
 *
 * **Best-effort**: per-kind errors are logged and swallowed. The
 * function never throws — call it fire-and-forget.
 */
export async function warmAmberNipAcPermissions(): Promise<void> {
    // Platform / auth-method gate.
    try {
        if (Capacitor.getPlatform() !== 'android') return;
    } catch {
        // Capacitor.getPlatform() shouldn't throw, but be defensive on
        // odd hosts (SSR, tests) where Capacitor isn't fully initialized.
        return;
    }

    let authMethod: string | null;
    try {
        authMethod = localStorage.getItem(AUTH_METHOD_KEY);
    } catch {
        return;
    }
    if (authMethod !== 'amber') return;

    // Idempotency gate.
    let alreadyWarmed: string | null;
    try {
        alreadyWarmed = localStorage.getItem(AMBER_NIP_AC_WARMED_KEY);
    } catch {
        return;
    }
    if (alreadyWarmed === '1') return;

    const s = get(signer);
    if (!s) {
        // Signer not yet attached. Caller is responsible for invoking
        // this only after the signer is set on the store.
        return;
    }

    let pubkeyHex: string;
    try {
        pubkeyHex = await s.getPublicKey();
    } catch (err) {
        console.warn('[NIP-AC][warmup] getPublicKey failed; skipping', err);
        return;
    }

    const dummyCallId = '00000000-0000-0000-0000-000000000000';
    const nowSec = Math.floor(Date.now() / 1000);

    /**
     * Build a minimal valid event for the given kind. Content empty,
     * tags carry only what NIP-AC requires plus a clear `alt` so the
     * Amber UI shows the user what they're approving. The event is
     * never published — just signed and discarded.
     */
    const buildDummy = (kind: number, altText: string) => ({
        kind,
        pubkey: pubkeyHex,
        created_at: nowSec,
        content: '',
        tags: [
            ['p', pubkeyHex],
            ['call-id', dummyCallId],
            ...(kind === NIP_AC_KIND_OFFER ? [['call-type', 'voice']] : []),
            ['alt', altText]
        ]
    });

    const targets = [
        {
            kind: NIP_AC_KIND_OFFER,
            alt: 'nospeak permission warmup: Call Offer (kind 25050)'
        },
        {
            kind: NIP_AC_KIND_REJECT,
            alt: 'nospeak permission warmup: Call Reject (kind 25054)'
        }
    ];

    for (const target of targets) {
        try {
            await s.signEvent(buildDummy(target.kind, target.alt));
            console.log(
                `[NIP-AC][warmup] signed dummy kind ${target.kind}; grant likely seeded`
            );
        } catch (err) {
            // Per scope decision: log warning, continue to next kind,
            // never surface to user. If the user rejected the prompt
            // in Amber (or Amber timed out, etc.), we still set the
            // flag below so we don't re-prompt at every launch.
            console.warn(
                `[NIP-AC][warmup] sign failed for kind ${target.kind}; continuing`,
                err
            );
        }
    }

    try {
        localStorage.setItem(AMBER_NIP_AC_WARMED_KEY, '1');
    } catch (err) {
        console.warn('[NIP-AC][warmup] failed to set warmed flag', err);
    }
}

/**
 * Clear the pre-warm flag so the next Amber session restarts with a
 * fresh warmup attempt. Called on logout.
 */
export function clearAmberPermissionsWarmupFlag(): void {
    try {
        localStorage.removeItem(AMBER_NIP_AC_WARMED_KEY);
    } catch {
        // ignore
    }
}
