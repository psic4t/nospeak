# Upload Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a phased circular progress overlay on the optimistic message bubble during Blossom file uploads (encrypting → uploading % → delivering).

**Architecture:** A reactive Svelte writable store maps optimistic event IDs to `{ phase, percent }`. The `sendFileMessage` pipeline in `Messaging.ts` accepts an `onProgress` callback threaded through `uploadEncryptedMedia` → `uploadToBlossomServers` → `putUpload` (XHR). `ChatView.svelte` passes a callback that writes to the store; an `UploadProgressOverlay` component reads from the store and renders a semi-transparent scrim with a determinate/indeterminate `CircularProgress` ring on the media bubble.

**Tech Stack:** Svelte 5, TypeScript, Tailwind CSS, existing `CircularProgress` component (extended), Svelte writable stores.

---

### Task 1: Create the upload progress store

**Files:**
- Create: `src/lib/stores/uploadProgress.ts`
- Test: `src/lib/stores/uploadProgress.test.ts`

**Step 1: Write the failing test**

Create `src/lib/stores/uploadProgress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
    uploadProgress,
    setUploadPhase,
    setUploadPercent,
    clearUploadProgress,
    type UploadPhase,
} from './uploadProgress';

describe('uploadProgress store', () => {
    it('starts empty', () => {
        expect(get(uploadProgress).size).toBe(0);
    });

    it('setUploadPhase creates an entry with phase and 0 percent', () => {
        setUploadPhase('opt:1', 'encrypting');
        const entry = get(uploadProgress).get('opt:1');
        expect(entry).toEqual({ phase: 'encrypting', percent: 0 });
        clearUploadProgress('opt:1');
    });

    it('setUploadPercent updates percent for existing entry', () => {
        setUploadPhase('opt:2', 'uploading');
        setUploadPercent('opt:2', 42);
        const entry = get(uploadProgress).get('opt:2');
        expect(entry).toEqual({ phase: 'uploading', percent: 42 });
        clearUploadProgress('opt:2');
    });

    it('setUploadPercent is a no-op for unknown id', () => {
        setUploadPercent('unknown', 50);
        expect(get(uploadProgress).has('unknown')).toBe(false);
    });

    it('clearUploadProgress removes the entry', () => {
        setUploadPhase('opt:3', 'delivering');
        clearUploadProgress('opt:3');
        expect(get(uploadProgress).has('opt:3')).toBe(false);
    });

    it('setUploadPhase updates phase for existing entry and resets percent', () => {
        setUploadPhase('opt:4', 'uploading');
        setUploadPercent('opt:4', 75);
        setUploadPhase('opt:4', 'delivering');
        const entry = get(uploadProgress).get('opt:4');
        expect(entry).toEqual({ phase: 'delivering', percent: 0 });
        clearUploadProgress('opt:4');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/uploadProgress.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the store**

Create `src/lib/stores/uploadProgress.ts`:

```typescript
import { writable } from 'svelte/store';

export type UploadPhase = 'encrypting' | 'uploading' | 'delivering';

export interface UploadProgress {
    phase: UploadPhase;
    percent: number;
}

export const uploadProgress = writable<Map<string, UploadProgress>>(new Map());

export function setUploadPhase(eventId: string, phase: UploadPhase): void {
    uploadProgress.update((map) => {
        const next = new Map(map);
        next.set(eventId, { phase, percent: 0 });
        return next;
    });
}

export function setUploadPercent(eventId: string, percent: number): void {
    uploadProgress.update((map) => {
        const existing = map.get(eventId);
        if (!existing) return map;
        const next = new Map(map);
        next.set(eventId, { ...existing, percent });
        return next;
    });
}

export function clearUploadProgress(eventId: string): void {
    uploadProgress.update((map) => {
        if (!map.has(eventId)) return map;
        const next = new Map(map);
        next.delete(eventId);
        return next;
    });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/uploadProgress.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/stores/uploadProgress.ts src/lib/stores/uploadProgress.test.ts
git commit -m "feat(upload): add uploadProgress store for phased file upload tracking"
```

---

### Task 2: Extend CircularProgress with determinate mode

**Files:**
- Modify: `src/lib/components/ui/CircularProgress.svelte`

**Step 1: Modify CircularProgress to support both modes**

The component currently only has indeterminate mode. Add a `value` prop: when set (0-100), render a static arc proportional to value with percentage text in center. When unset, keep current indeterminate animation.

Update `src/lib/components/ui/CircularProgress.svelte`:

```svelte
<script lang="ts">
    interface Props {
        size?: number;
        strokeWidth?: number;
        value?: number;
        class?: string;
    }

    let {
        size = 48,
        strokeWidth = 4,
        value = undefined,
        class: className = ""
    }: Props = $props();

    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    let dashOffset = $derived(
        value !== undefined ? circumference - (value / 100) * circumference : 0
    );
</script>

<div
    class={`circular-progress ${value === undefined ? 'indeterminate' : ''} ${className}`}
    style="width: {size}px; height: {size}px;"
    role="progressbar"
    aria-label={value !== undefined ? `${value}% complete` : 'Loading'}
    aria-valuenow={value}
    aria-valuemin={value !== undefined ? 0 : undefined}
    aria-valuemax={value !== undefined ? 100 : undefined}
>
    <svg viewBox="0 0 48 48">
        {#if value !== undefined}
            <!-- Background track -->
            <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                class="track"
            />
            <!-- Foreground arc -->
            <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                class="arc"
                stroke-dasharray={circumference}
                stroke-dashoffset={dashOffset}
            />
            <!-- Percentage text -->
            <text x="24" y="24" text-anchor="middle" dominant-baseline="central" class="percent-text">
                {value}%
            </text>
        {:else}
            <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
            />
        {/if}
    </svg>
</div>

<style>
    .circular-progress {
        display: inline-block;
        color: var(--color-lavender, #7287fd);
    }

    .circular-progress.indeterminate {
        animation: rotate 2s linear infinite;
    }

    svg {
        display: block;
        width: 100%;
        height: 100%;
    }

    /* Indeterminate mode */
    .indeterminate circle {
        stroke: currentColor;
        stroke-linecap: round;
        animation: dash 1.4s ease-in-out infinite;
    }

    /* Determinate mode */
    .track {
        stroke: currentColor;
        opacity: 0.2;
    }

    .arc {
        stroke: currentColor;
        stroke-linecap: round;
        transform: rotate(-90deg);
        transform-origin: center;
        transition: stroke-dashoffset 0.3s ease;
    }

    .percent-text {
        fill: currentColor;
        font-size: 12px;
        font-weight: 600;
    }

    @keyframes rotate {
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes dash {
        0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
        }
        50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
        }
        100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
        }
    }
</style>
```

**Step 2: Verify existing usage is unaffected**

Run: `npm run check`
Expected: No type errors. The existing `<CircularProgress size={24} strokeWidth={3} />` call in ChatView.svelte passes no `value`, so it stays indeterminate.

**Step 3: Commit**

```bash
git add src/lib/components/ui/CircularProgress.svelte
git commit -m "feat(ui): add determinate mode to CircularProgress component"
```

---

### Task 3: Create UploadProgressOverlay component

**Files:**
- Create: `src/lib/components/UploadProgressOverlay.svelte`

**Step 1: Create the overlay component**

```svelte
<script lang="ts">
    import { uploadProgress } from '$lib/stores/uploadProgress';
    import CircularProgress from '$lib/components/ui/CircularProgress.svelte';

    interface Props {
        eventId: string;
    }

    let { eventId }: Props = $props();

    let progress = $derived($uploadProgress.get(eventId));
    let label = $derived.by(() => {
        if (!progress) return '';
        switch (progress.phase) {
            case 'encrypting': return 'Encrypting...';
            case 'uploading': return `Uploading ${progress.percent}%`;
            case 'delivering': return 'Delivering...';
        }
    });
    let progressValue = $derived(
        progress?.phase === 'uploading' ? progress.percent : undefined
    );
</script>

{#if progress}
    <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 rounded-lg">
        <CircularProgress
            size={48}
            strokeWidth={4}
            value={progressValue}
            class="text-white"
        />
        <span class="mt-2 text-xs font-medium text-white/90 drop-shadow">
            {label}
        </span>
    </div>
{/if}
```

**Step 2: Run check**

Run: `npm run check`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/components/UploadProgressOverlay.svelte
git commit -m "feat(upload): add UploadProgressOverlay component"
```

---

### Task 4: Thread onProgress through Messaging.ts

**Files:**
- Modify: `src/lib/core/Messaging.ts:1274-1294` (`uploadEncryptedMedia`)
- Modify: `src/lib/core/Messaging.ts:1296-1379` (`sendFileMessage`)
- Modify: `src/lib/core/Messaging.ts:1381-1475` (`sendGroupFileMessage`)

**Step 1: Define the callback type and add it to uploadEncryptedMedia**

At `src/lib/core/Messaging.ts`, the `uploadEncryptedMedia` method (line 1274) needs an `onProgress` parameter passed through to `uploadToBlossomServers`.

Change `uploadEncryptedMedia` signature and body:

```typescript
  private async uploadEncryptedMedia(
    encrypted: EncryptedFileResult,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    mimeType: string,
    blossomServers: string[],
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const blob = new Blob([encrypted.ciphertext.buffer as ArrayBuffer], { type: 'application/octet-stream' });

    if (blossomServers.length === 0) {
      throw new Error('No Blossom servers configured');
    }

    const result = await uploadToBlossomServers({
      servers: blossomServers,
      body: blob,
      mimeType: 'application/octet-stream',
      sha256: encrypted.hashEncrypted,
      onProgress
    });

    return result.url;
  }
```

**Step 2: Add onProgress to sendFileMessage**

Change `sendFileMessage` signature (line 1296) to add `onProgress` callback. The callback uses `(phase: 'encrypting' | 'uploading' | 'delivering', percent: number) => void`.

```typescript
  public async sendFileMessage(
    recipientNpub: string | null,
    file: File,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    createdAtSeconds?: number,
    conversationId?: string,
    mediaMeta?: { width?: number; height?: number; blurhash?: string },
    caption?: string,
    onProgress?: (phase: 'encrypting' | 'uploading' | 'delivering', percent: number) => void
  ): Promise<string> {
    if (conversationId) {
      return this.sendGroupFileMessage(conversationId, file, mediaType, createdAtSeconds, mediaMeta, caption, onProgress);
    }
```

In the 1-on-1 path, add phase callbacks around the three operations:

Before `encryptFileWithAesGcm` (after line 1319):
```typescript
    onProgress?.('encrypting', 0);
    const encrypted = await encryptFileWithAesGcm(file);
```

Before `uploadEncryptedMedia` (after getting blossomServers, line 1325):
```typescript
    onProgress?.('uploading', 0);
    const fileUrl = await this.uploadEncryptedMedia(encrypted, mediaType, mimeType, blossomServers, (percent) => onProgress?.('uploading', percent));
```

Before `sendEnvelope` (after building the rumor, line 1359):
```typescript
    onProgress?.('delivering', 0);
    const { rumorId } = await this.sendEnvelope({
```

**Step 3: Add onProgress to sendGroupFileMessage**

Same pattern as step 2, applied to `sendGroupFileMessage` (line 1381):

```typescript
  private async sendGroupFileMessage(
    conversationId: string,
    file: File,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    createdAtSeconds?: number,
    mediaMeta?: { width?: number; height?: number; blurhash?: string },
    caption?: string,
    onProgress?: (phase: 'encrypting' | 'uploading' | 'delivering', percent: number) => void
  ): Promise<string> {
```

Add the same three phase callbacks around `encryptFileWithAesGcm`, `uploadEncryptedMedia`, and `sendEnvelope` in the group path.

**Step 4: Run checks**

Run: `npm run check`
Expected: No type errors (the new parameter is optional, all existing callers are unaffected).

**Step 5: Commit**

```bash
git add src/lib/core/Messaging.ts
git commit -m "feat(upload): thread onProgress callback through sendFileMessage pipeline"
```

---

### Task 5: Wire ChatView to the progress store and overlay

**Files:**
- Modify: `src/lib/components/ChatView.svelte`

**Step 1: Import the store and overlay**

Add imports near the top of `ChatView.svelte` (in the `<script>` block):

```typescript
import { setUploadPhase, setUploadPercent, clearUploadProgress } from '$lib/stores/uploadProgress';
import UploadProgressOverlay from '$lib/components/UploadProgressOverlay.svelte';
```

**Step 2: Pass onProgress to sendFileMessage in confirmSendMedia**

In `confirmSendMedia()`, modify the `messagingService.sendFileMessage(...)` call (around line 1468) to pass an `onProgress` callback that updates the store:

```typescript
        await messagingService.sendFileMessage(
          isGroup ? null : partnerNpub!,
          file,
          mediaType,
          createdAtSeconds,
          isGroup ? groupConversation!.id : undefined,
          mediaMeta,
          caption.length > 0 ? caption : undefined,
          (phase, percent) => {
            if (isDestroyed) return;
            if (phase === 'uploading') {
              setUploadPercent(optimisticEventId, percent);
            } else {
              setUploadPhase(optimisticEventId, phase);
            }
          }
        );
```

Also, set the initial phase right after creating the optimistic message (after line 1447 `optimisticMessages = [...]`):

```typescript
    setUploadPhase(optimisticEventId, 'encrypting');
```

**Step 3: Clear progress on success and error**

In the success path (around line 1482, before `removeOptimisticMessage`):
```typescript
        clearUploadProgress(optimisticEventId);
```

In the error catch block (around line 1494, before `removeOptimisticMessage`):
```typescript
        clearUploadProgress(optimisticEventId);
```

**Step 4: Add the overlay in the message rendering template**

Wrap the `<MessageContent>` and overlay in a relative container. Around line 2163, change:

```svelte
             <MessageContent
                content={msg.message}
                ...
              />
```

To:

```svelte
            <div class="relative">
              <MessageContent
                content={msg.message}
                highlight={isSearchActive ? searchQuery : undefined}
                isOwn={msg.direction === "sent"}
                onImageClick={openImageViewer}
                fileUrl={msg.fileUrl}
                fileType={msg.fileType}
                fileEncryptionAlgorithm={msg.fileEncryptionAlgorithm}
                fileKey={msg.fileKey}
                fileNonce={msg.fileNonce}
                authorNpub={msg.direction === "sent" ? $currentUser?.npub : partnerNpub}
                location={msg.location}
                forceEagerLoad={i >= displayMessages.length - 3}
                fileWidth={msg.fileWidth}
                fileHeight={msg.fileHeight}
                fileBlurhash={msg.fileBlurhash}
              />
              {#if msg.eventId?.startsWith('optimistic:') && msg.rumorKind === 15}
                <UploadProgressOverlay eventId={msg.eventId} />
              {/if}
            </div>
```

**Step 5: Run checks and tests**

Run: `npm run check && npx vitest run`
Expected: No type errors, all tests pass.

**Step 6: Commit**

```bash
git add src/lib/components/ChatView.svelte
git commit -m "feat(upload): wire upload progress overlay to optimistic file messages"
```

---

### Task 6: Final validation

**Step 1: Run full quality gates**

```bash
npm run check
npx vitest run
npm run build
```

Expected: All pass with no errors.

**Step 2: Manual smoke test checklist**

- [ ] Send an image in a 1-on-1 chat → see circular progress on the message bubble
- [ ] Send a video in a group chat → same overlay with encrypting → uploading % → delivering phases
- [ ] Send a small file (<50KB) → overlay may flash briefly or not appear (fast upload)
- [ ] Simulate error (disable network) → overlay disappears, preview modal re-opens with error
- [ ] Existing `CircularProgress` in "fetching history" spinner → still works (indeterminate, no regression)
- [ ] Verify the "Sending..." / "Sent to N relays" text still shows below the bubble

**Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix(upload): address smoke test findings"
```
