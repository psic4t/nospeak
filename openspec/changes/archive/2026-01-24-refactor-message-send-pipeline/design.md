## Context

`MessagingService` in `src/lib/core/Messaging.ts` contains 8 send functions that share a common NIP-17/NIP-59 delivery pipeline but duplicate it entirely. The 1-on-1 vs. group distinction only affects recipient enumeration and post-send hooks; message type (text/file/location/reaction) only affects the rumor body. The pipeline itself (auth → relays → temp connections → gift-wrap → publish → retry → self-wrap → DB save) is identical across all 8.

## Goals / Non-Goals

- **Goals:**
  - Single pipeline implementation for all send paths
  - Consistent publish strategy across all message types and recipient modes
  - Easy extensibility for future message types (e.g. polls, zaps) without duplicating the pipeline
  - Preserve all existing external behavior and NIP compliance

- **Non-Goals:**
  - Changing the NIP-59 gift-wrap format or relay selection logic
  - Modifying the retry queue semantics
  - Refactoring the receive/decrypt pipeline (separate concern)
  - Adding new message types (this is purely structural)

## Decisions

### Decision 1: Single `sendEnvelope()` private method

The shared pipeline will be extracted into a single private method:

```typescript
private async sendEnvelope(params: SendEnvelopeParams): Promise<string>
```

Where `SendEnvelopeParams` captures:
- `recipients: string[]` — npub list (length 1 = DM, length > 1 = group)
- `rumor: UnsignedEvent` — the pre-built rumor event (kind 14, 15, or 7)
- `conversationId?: string` — for group DB persistence
- `messageDbFields?: Partial<Message>` — extra fields for DB save (file metadata, etc.)

**Alternatives considered:**
- *Class inheritance* (BaseMessageSender → TextSender, FileSender): Rejected — overkill for what's fundamentally a single function with parameterized inputs.
- *Strategy pattern with message type objects*: Rejected — adds abstraction without clear benefit; the rumor construction is already trivial.

### Decision 2: Thin rumor-builder wrappers

Each public send method becomes a ~20 line wrapper that:
1. Builds the rumor event with appropriate kind and tags
2. Prepares any `messageDbFields` (e.g. file metadata)
3. Calls `sendEnvelope()`

Example: `sendFileMessage` will encrypt+upload the file, build a Kind 15 rumor with file tags, then call `sendEnvelope()`.

### Decision 3: Normalize group publish strategy

Currently `sendGroupFileMessage` uses retry-queue-only (no `publishWithDeadline`), while `sendGroupMessage` uses `publishWithDeadline` per participant. This appears to be an oversight.

**Decision:** All sends (including group file) will use `publishWithDeadline` with the same 5s deadline. Failed relays are enqueued to the retry queue uniformly.

**Rationale:** File messages are equally important to deliver reliably. The file upload (the slow part) is already complete by the time we publish the rumor event.

### Decision 4: Recipient mode is implicit from array length

Rather than separate `sendMessage` + `sendGroupMessage` functions, the pipeline checks `recipients.length`:
- `=== 1`: DM mode — calls `autoAddContact()` post-send, no `conversationId` needed
- `> 1`: Group mode — calls `conversationRepo.markActivity()` post-send, requires `conversationId`

The existing public API (`sendMessage`, `sendGroupMessage`, etc.) remains unchanged — the delegation to `sendEnvelope()` is an internal detail.

## Risks / Trade-offs

- **Risk:** Regression in any of the 8 send paths.
  - *Mitigation:* Existing test suite covers `sendMessage`, `sendFileMessage`, and group variants. Add explicit tests for `sendEnvelope()` covering DM and group modes before removing the old code.

- **Risk:** The `sendGroupFileMessage` behavior change (adding `publishWithDeadline`) could cause different failure modes for users on slow connections.
  - *Mitigation:* The 5s deadline is generous; failures still go to retry queue (same as before, just with an initial attempt).

- **Trade-off:** Single pipeline means a bug in `sendEnvelope()` affects all message types.
  - *Acceptable:* This is also the benefit — fixes propagate everywhere too.

## Migration Plan

1. Implement `SendEnvelopeParams` interface and `sendEnvelope()` method
2. Refactor one function at a time (text DM → text group → file DM → file group → location → reaction)
3. Run tests after each refactored function
4. Remove dead code (old function bodies) only after all 8 are migrated
5. No external API changes, no migration needed for consumers

## Open Questions

- None — this is a pure internal refactor with no behavioral changes (except the `sendGroupFileMessage` publish normalization, which is a bug fix).
