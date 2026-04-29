# Tasks

## 1. Constant module
- [x] 1.1 Add `CALL_HISTORY_KIND = 1405` to
      `src/lib/core/voiceCall/constants.ts` (extended the existing
      voice-call constants module rather than creating a new
      `kinds.ts` file). JSDoc explains why we left Kind 16 and the
      reasoning behind 1405.

## 2. TypeScript receive path
- [x] 2.1 Update `Messaging.ts` (handleGiftWrap kind allow-list)
      to use `CALL_HISTORY_KIND` and reject Kind 16 (hard switch).
- [x] 2.2 Update the native-queue (processGiftWrap) path the same way.
- [x] 2.3 Update the call-event branch to
      `rumor.kind === CALL_HISTORY_KIND`.
- [x] 2.4 Update inline comments referencing "Kind 16" to "Kind 1405".

## 3. TypeScript author path
- [x] 3.1 `Messaging.createCallEventMessage`: set
      `kind: CALL_HISTORY_KIND`. JSDoc updated.
- [x] 3.2 `Messaging.createLocalCallEventMessage`: use
      `CALL_HISTORY_KIND` for both the rumor kind and the saved
      `rumorKind` field. JSDoc updated.

## 4. Renderer
- [x] 4.1 `src/lib/components/ChatView.svelte` — change
      `msg.rumorKind === 16` to `msg.rumorKind === CALL_HISTORY_KIND`,
      with an import of the constant.

## 5. DB schema and migration
- [x] 5.1 In `src/lib/db/db.ts`, added Dexie version 14 (no
      store/index change). The upgrade body delegates to the exported
      `migrateCallHistoryKindToV14` helper, which iterates the
      `messages` table and rewrites `rumorKind: 16` → `rumorKind: 1405`
      for rows where `callEventType` is set.
- [x] 5.2 Update the `Message.callEventType` doc-comment block from
      "Kind 16 Events" to "Kind 1405 Events" and added a migration
      pointer.
- [x] 5.3 Wrapped the upgrade body in try/catch with logging so any
      migration failure does not brick app boot.

## 6. Android / Java
- [x] 6.1 In `NativeBackgroundMessagingService.java`, defined
      `private static final int CALL_HISTORY_KIND = 1405;` and replaced
      `rumor.put("kind", 16)` with `rumor.put("kind", CALL_HISTORY_KIND)`.
- [x] 6.2 Updated JSDoc for `sendVoiceCallDeclinedEvent` and the inline
      "Build the unsigned Kind 16 rumor" comment to say "Kind 1405".
- [x] 6.3 Updated the comment in `IncomingCallActionReceiver.java:74`
      from "kind-16" to "kind-1405".

## 7. Tests
- [x] 7.1 Updated the spec-link comment in `VoiceCallService.test.ts`
      from "Kind 16 Events" to "Kind 1405 Events". No fixture-level
      kind literal change was needed because fixtures route through
      `Messaging.create*CallEventMessage`.
- [x] 7.2 Added three tests in `MessagingService.test.ts`
      (`describe('call-history kind switch (16 → 1405)')`):
      (a) `processGiftWrapToMessage` accepts a Kind 1405 call-history
      rumor and returns a populated message;
      (b) `processGiftWrapToMessage` rejects a Kind 16 rumor (returns
      null via the outer catch);
      (c) `handleGiftWrap` rejects a Kind 16 rumor without invoking
      `processRumor`.
- [x] 7.3 Added `src/lib/db/db.migration.test.ts` with 6 tests
      exercising `migrateCallHistoryKindToV14` against an in-memory
      mock of the Dexie transaction shape: rewrites rumorKind 16 →
      1405, leaves Kind-14 chat rows alone, leaves orphan kind-16 rows
      (no `callEventType`) alone, is idempotent on existing 1405 rows,
      handles a mixed batch correctly, and survives a thrown table
      operation by logging instead of rejecting.

## 8. Spec sync (this change's delta + main spec)
- [x] 8.1 Wrote the spec delta under
      `openspec/changes/move-call-history-to-kind-1405/specs/voice-calling/spec.md`
      using `## MODIFIED Requirements`. Replaced the entire "Call
      History via Kind 16 Events" requirement (header + all scenarios)
      with the Kind-1405 version, plus added two new scenarios
      covering the hard-switch reject path and the DB migration.
- [x] 8.2 Added a HISTORICAL DOCUMENT banner at the top of
      `docs/superpowers/plans/2026-03-28-voice-calling.md` noting the
      kind-16 → kind-1405 move so readers don't follow the stale code
      sample.

## 9. Verification
- [x] 9.1 `npm run check` — 0 errors, 0 warnings.
- [x] 9.2 `npx vitest run` — 53 files / 492 tests pass (includes the
      9 new tests across receive-path and migration suites).
- [x] 9.3 `openspec validate move-call-history-to-kind-1405 --strict` —
      clean.
- [x] 9.4 `./gradlew :app:compileDebugJavaWithJavac` — BUILD SUCCESSFUL.
