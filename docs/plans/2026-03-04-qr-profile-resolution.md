# QR Profile Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix profile resolution to always query discovery relays, add nprofile QR support, and improve the result modal display.

**Architecture:** Two bugs/improvements: (1) ProfileResolver filters out disconnected discovery relays so profiles are only fetched from the user's own messaging relays — fix by passing all discovery relays unconditionally. (2) QR parser only accepts npub1 — extend to decode nprofile1 and pass relay hints through to the resolver. Also use the existing Avatar component and show username in the result modal.

**Tech Stack:** Svelte 5, TypeScript, nostr-tools nip19, vitest

---

### Task 1: Fix ProfileResolver discovery relay filtering

**Files:**
- Modify: `src/lib/core/ProfileResolver.ts:152-156` (resolveProfile)
- Modify: `src/lib/core/ProfileResolver.ts:221-224` (resolveProfilesBatch)

Remove `.filter(isConnected)` on discovery relays in both methods. Pass all discovery relays as `extraRelays` unconditionally.

### Task 2: Add optional relay hints to resolveProfile

**Files:**
- Modify: `src/lib/core/ProfileResolver.ts:11` (resolveProfile signature)

Add `relayHints?: string[]` param, merge with discovery relays in extraRelays.

### Task 3: Extend QR parser for nprofile

**Files:**
- Modify: `src/lib/utils/qr.ts`
- Modify: `src/lib/utils/qr.test.ts`

New `QrContactResult` interface and `parseNostrContactFromQrPayload` function. Handles npub1 and nprofile1.

### Task 4: Extend modal state with relay hints

**Files:**
- Modify: `src/lib/stores/modals.ts`

Add `relays` to `scanContactQrResultState` and `openScanContactQrResult`.

### Task 5: Update ScanContactQrModal to use new parser

**Files:**
- Modify: `src/lib/components/ScanContactQrModal.svelte`

Use `parseNostrContactFromQrPayload` and pass relays through.

### Task 6: Improve ScanContactQrResultModal

**Files:**
- Modify: `src/lib/components/ScanContactQrResultModal.svelte`

Use Avatar component, show username, accept relay hints, pass to profileResolver.

### Task 7: Wire relays prop in layout

**Files:**
- Modify: `src/routes/+layout.svelte`

Pass `relays` from store to ScanContactQrResultModal.

### Task 8: Validate

Run `npm run check` and `npx vitest run`.
