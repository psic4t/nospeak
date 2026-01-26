# Design: NIP-07 Account Mismatch Detection

## Context

NIP-07 defines how web applications interact with Nostr signer browser extensions. These extensions (nos2x, Alby, etc.) allow users to have multiple Nostr accounts configured and switch between them. When a user switches accounts in their extension while nospeak is open (or between sessions), the app may perform operations with the wrong account.

**Constraints:**
- Must not interfere with non-NIP-07 login methods (local nsec, Amber)
- Must be non-bypassable - user cannot dismiss the warning without resolving the issue
- Must prevent all signing operations while mismatch is detected
- Must detect mismatches both on app load and during active sessions

## Goals / Non-Goals

**Goals:**
- Detect when NIP-07 signer's active account differs from nospeak's logged-in user
- Block all app interaction with a non-dismissible modal when mismatch detected
- Prevent any signing operations from executing while mismatch exists
- Inform user clearly how to resolve the issue (switch signer account + reload)

**Non-Goals:**
- Automatic logout or session switching
- Offering in-app account switching
- Supporting this for NIP-55 (Amber) - Android handles account switching differently

## Decisions

### Decision 1: Detection Timing

**Approach:** Check for account mismatch at multiple points:
1. **On NIP-07 session restore** - Before completing restore in `AuthService.restore()`
2. **On window focus/visibility** - When user returns to the tab
3. **Periodic fallback** - Every 30 seconds as a safety net

**Rationale:**
- Session restore catch: Prevents wrong-account data loading on app open
- Focus/visibility catch: Detects mid-session account switches
- Periodic catch: Safety net for edge cases (e.g., extension behavior varies)

**Trade-off:** More frequent checks = more extension interaction, but security is paramount.

### Decision 2: Modal Behavior

**Approach:** Non-dismissible modal with no action buttons.

The modal:
- Cannot be closed (no close button, no backdrop click, no escape key)
- Displays warning about account mismatch
- Shows expected vs actual pubkey (truncated for readability)
- Instructs user to: "Switch to the correct account in your signer extension and reload this page"

**Rationale:**
- No action buttons because there's nothing the app can safely do
- User must resolve at the extension level, then reload for clean state
- Non-dismissible because any app interaction while mismatched is dangerous

### Decision 3: Signing Operation Guard

**Approach:** Add mismatch check at the beginning of `signEvent()`, `encrypt()`, and `decrypt()` methods in `Nip07Signer`.

```typescript
private checkMismatch() {
    if (get(signerMismatch)?.detected) {
        throw new Error('Signer account mismatch - operation blocked');
    }
}
```

**Rationale:**
- Defense in depth: Even if modal is somehow bypassed, operations still fail
- Explicit error message helps with debugging
- Centralized check in signer class

### Decision 4: Cache Bypass for Verification

**Approach:** Add static method `Nip07Signer.getCurrentSignerPubkeyUncached()` that calls `window.nostr.getPublicKey()` directly, bypassing the class's static cache.

```typescript
public static async getCurrentSignerPubkeyUncached(): Promise<string> {
    if (!window.nostr) {
        throw new Error('Nostr extension not found');
    }
    return window.nostr.getPublicKey();
}
```

**Rationale:**
- The existing `getPublicKey()` caches the result for performance
- Verification needs the live/current value from the extension
- Static method allows calling without a signer instance

### Decision 5: Expected Pubkey Storage

**Approach:** Store the expected pubkey (hex format) in a new store alongside the mismatch state.

```typescript
// src/lib/stores/signerMismatch.ts
export const signerMismatch = writable<{
    detected: boolean;
    expectedPubkey: string | null;  // hex format
    actualPubkey: string | null;    // hex format
} | null>(null);
```

**Rationale:**
- Need both pubkeys for the modal display
- Hex format matches what `window.nostr.getPublicKey()` returns
- Single store keeps mismatch state together

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Extension doesn't respond to getPublicKey | Set timeout; treat timeout as "check inconclusive" not mismatch |
| User annoyance at frequent checks | Only NIP-07 users affected; checks are quick and non-intrusive |
| Race condition during initial load | Check happens before completing restore, blocking incorrect state |
| Modal can be bypassed via dev tools | Signing guard prevents actual damage even if modal removed |

## Verification Flow

```
┌──────────────────────────────────────────────────────────┐
│                    App Load / Restore                     │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Auth method =   │
                    │    'nip07'?     │
                    └─────────────────┘
                         │ Yes
                         ▼
              ┌─────────────────────────┐
              │ Get signer pubkey       │
              │ (bypass cache)          │
              └─────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────┐
              │ Matches stored npub?    │
              └─────────────────────────┘
                    │           │
               Yes  │           │ No
                    ▼           ▼
            ┌───────────┐  ┌─────────────────┐
            │ Continue  │  │ Set mismatch    │
            │ normally  │  │ store = true    │
            │ + start   │  │ Show blocking   │
            │ periodic  │  │ modal           │
            │ checks    │  └─────────────────┘
            └───────────┘
```

## Open Questions

1. ~~Should the modal have any action buttons?~~ **Resolved: No buttons, just instructions**
2. ~~How to handle detection timing?~~ **Resolved: On load + focus + periodic**
3. Should we log mismatch events for debugging? **Recommendation: Yes, console.warn with details**
