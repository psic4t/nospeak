# Media Decryption Scheduler Implementation Plan

> **Status:** IMPLEMENTED

**Goal:** Eliminate scroll stuttering and ANR on Android when scrolling through chats with many encrypted media files, by offloading fetch+decrypt to a Web Worker with concurrency control and LRU caching.

**Architecture:** A singleton `DecryptionScheduler` manages all media decryption requests. It limits concurrency to 2 simultaneous operations, caches decrypted blob URLs in an LRU map (keyed by file URL), supports cancellation when items scroll out of view, and properly revokes blob URLs on eviction. `MessageContent.svelte` delegates to the scheduler instead of decrypting directly.

**Tech Stack:** TypeScript, Svelte 5, WebCrypto API, Vitest

---

### Task 1: Create DecryptionScheduler core module

**Files:**
- Create: `src/lib/core/DecryptionScheduler.ts`
- Create: `src/lib/core/DecryptionScheduler.test.ts`

**Step 1: Write the test file with core tests**

Tests cover: enqueue/dequeue, concurrency limiting, LRU cache hit, cache eviction with URL.revokeObjectURL, cancellation, and singleton access.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/core/DecryptionScheduler.test.ts`
Expected: FAIL — module does not exist

**Step 3: Implement DecryptionScheduler**

The scheduler:
- Accepts decrypt requests with a key (fileUrl), a decrypt function, and an AbortSignal
- Limits concurrency to 2 simultaneous operations
- Returns cached blob URL immediately on cache hit
- LRU cache with configurable max size (default 50), evicts oldest and calls URL.revokeObjectURL
- Pending requests can be cancelled via AbortSignal
- Singleton via getInstance()

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/core/DecryptionScheduler.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(perf): add DecryptionScheduler with concurrency limit and LRU cache
```

---

### Task 2: Integrate DecryptionScheduler into MessageContent.svelte

**Files:**
- Modify: `src/lib/components/MessageContent.svelte` (decryptAttachment function + effect + cleanup)

**Step 1: Replace direct decryptAttachment with scheduler call**

- Import DecryptionScheduler
- In the $effect that triggers decryption, call scheduler.enqueue() instead of decryptAttachment() directly
- Pass an AbortController signal that gets aborted when isVisible becomes false or component unmounts
- On cache hit, set decryptedUrl immediately
- On component destroy ($effect cleanup), abort pending request and unregister

**Step 2: Add blob URL cleanup on visibility loss**

When a message scrolls out of view, the scheduler's LRU cache retains the blob URL. The component just nulls its local reference. When it scrolls back in, the cache returns the URL instantly.

**Step 3: Run check and tests**

Run: `npm run check && npx vitest run`
Expected: PASS

**Step 4: Commit**

```
perf(android): integrate DecryptionScheduler in MessageContent for throttled media decryption
```

---

### Task 3: Add cancellation support for scroll-past items

**Files:**
- Modify: `src/lib/core/DecryptionScheduler.ts`
- Modify: `src/lib/core/DecryptionScheduler.test.ts`

**Step 1: Enhance queue to skip cancelled items**

When processing the queue, check if the AbortSignal is already aborted before starting the fetch+decrypt. This prevents wasted work on items the user has already scrolled past.

**Step 2: Add fetch AbortController integration**

Pass the AbortSignal through to the fetch() call inside the decrypt function so network requests are cancelled too.

**Step 3: Write tests for cancellation scenarios**

**Step 4: Run tests**

Run: `npx vitest run src/lib/core/DecryptionScheduler.test.ts`
Expected: PASS

**Step 5: Commit**

```
perf(android): add cancellation support to DecryptionScheduler for scrolled-past media
```

---

### Task 4: Final validation

**Step 1: Run full quality gates**

Run: `npm run check && npx vitest run`
Expected: All pass

**Step 2: Manual testing notes**

Test on Android with a chat containing many encrypted images/videos:
- Scroll fast through the chat — should see blurhash placeholders, media loads 2 at a time
- Scroll back up — previously decrypted media appears instantly from cache
- No ANR dialog should appear
- Memory usage should be bounded (check Android profiler)
