## Context

The `ProfileResolver` fetches user profiles (kind 0, 10050, 10002, 10063 events) via `connectionManager.subscribe()`. Currently, this method only queries relays that are already connected (typically the user's messaging relays after login). Discovery relays are only connected during the initial login sync flow and are cleaned up afterward.

When a user searches for a contact via NIP-05 (e.g., `alice@example.com`), the system:
1. Fetches `https://example.com/.well-known/nostr.json` to get the pubkey
2. Calls `ProfileResolver.resolveProfile()` to fetch the kind 0 event
3. Returns name/picture from the profile

Step 2 often fails because the contact's profile may not exist on the user's messaging relays.

## Goals / Non-Goals

**Goals:**
- Profile resolution SHALL query both messaging relays AND discovery relays
- Discovery relay connections SHALL be temporary and cleaned up after the subscription ends
- Discovery relays SHALL be connected proactively on search input to minimize latency

**Non-Goals:**
- Not changing the NIP-50 search relay (`relay.nostr.band`) behavior
- Not persisting discovery relay connections beyond the profile fetch

## Decisions

### Decision 1: Extend `subscribe()` with `extraRelays` option

Rather than creating a separate method or modifying `ProfileResolver` to manage relay connections directly, we extend `connectionManager.subscribe()` to accept an optional `extraRelays` parameter.

**Why:** This approach is reusable by any caller that needs to temporarily expand the relay set, follows the existing patterns in the codebase, and keeps relay management centralized in `ConnectionManager`.

**Alternatives considered:**
- **Option A (chosen):** Extend `subscribe()` with `extraRelays` option
- **Option B:** Have `ProfileResolver` call `addTemporaryRelay()` directly - rejected because it duplicates relay management logic and cleanup is error-prone

### Decision 2: Cleanup adds temporary relays only

When the subscription cleanup function is called, it SHALL only remove relays that were newly added by this subscription (not already in `this.relays`). This prevents accidentally removing a relay that another subscription or the user's persistent config depends on.

### Decision 3: Proactive discovery relay connection on first keystroke

To avoid latency when the user finishes typing a NIP-05 address, discovery relays SHALL be connected as soon as the user starts typing in the search field. By the time the debounce fires and the NIP-05 lookup completes, the relays should already be connected.

**Why:** `addTemporaryRelay()` triggers async connection but doesn't wait. If we only connected when `ProfileResolver.resolveProfile()` is called, the profile fetch might start before relays are connected, missing events.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Extra relay connections consume resources | Relays are cleaned up when subscription ends; search field not always active |
| Discovery relays may be slow/unavailable | Existing timeout in `ProfileResolver` (3 seconds) handles this |
| Race condition if cleanup called before relays connect | `removeRelay()` handles non-existent relays gracefully |

## Open Questions

None - design is straightforward extension of existing patterns.
