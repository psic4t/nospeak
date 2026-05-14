# Android Chat Shared Element Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a subtle, fast shared element transition when tapping a chat in the Android Capacitor app, animating avatar and name from chat list to chat header.

**Architecture:** Web-based solution using CSS View Transitions API with platform detection to enable only on supported Android devices. Shared elements (avatar and name) are marked with unique `view-transition-name` values, and navigation is wrapped in `document.startViewTransition()`.

**Tech Stack:** TypeScript, Svelte 5, SvelteKit, CSS View Transitions API

---

## File Structure

| File | Purpose | Action |
|------|---------|--------|
| `src/lib/utils/platform.ts` | Platform detection utilities | Modify - add `supportsViewTransitions()` |
| `src/lib/utils/viewTransition.ts` | Navigation wrapper with transition support | Create new |
| `src/lib/components/ChatList.svelte` | Chat list with selectable items | Modify - add transition names, update navigation |
| `src/lib/components/ChatView.svelte` | Individual chat view with header | Modify - add transition names, update back navigation |
| `src/app.css` | Global styles | Modify - add View Transition CSS customization |

---

## Task 1: Add supportsViewTransitions() to Platform Utils

**Files:**
- Modify: `src/lib/utils/platform.ts:30`

**Context:** This file contains platform detection utilities. Add a new function to detect View Transitions API support on Android Capacitor.

- [ ] **Step 1: Add supportsViewTransitions() function**

Add the following function at the end of `src/lib/utils/platform.ts` (after line 30):

```typescript
/**
 * Checks if the current platform supports CSS View Transitions API.
 * Only returns true on Android Capacitor with WebView 114+ (Android 14+ or updated WebView).
 */
export function supportsViewTransitions(): boolean {
    return isAndroidCapacitorShell() && 
           typeof document !== 'undefined' && 
           'startViewTransition' in document;
}
```

- [ ] **Step 2: Verify file structure**

The file should now contain:
1. `isAndroidCapacitorShell()` function (lines 1-17)
2. `blur()` function (lines 19-30)
3. `supportsViewTransitions()` function (lines 32-40)

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/platform.ts
git commit -m "feat(android): add supportsViewTransitions() platform detection"
```

---

## Task 2: Create View Transition Navigation Utility

**Files:**
- Create: `src/lib/utils/viewTransition.ts`

**Context:** This new utility wraps SvelteKit's `goto()` with View Transitions API support.

- [ ] **Step 1: Create the viewTransition.ts file**

Create `src/lib/utils/viewTransition.ts` with the following content:

```typescript
import { goto } from '$app/navigation';
import { supportsViewTransitions } from './platform';

/**
 * Navigate to a URL with View Transition animation on supported platforms.
 * Falls back to standard navigation on unsupported platforms.
 * 
 * @param url - The URL to navigate to
 * @param options - Optional SvelteKit navigation options
 */
export async function navigateWithTransition(
    url: string, 
    options?: Parameters<typeof goto>[1]
): Promise<void> {
    if (!supportsViewTransitions()) {
        // Fallback: standard navigation for unsupported platforms
        await goto(url, options);
        return;
    }

    // Trigger view transition
    const transition = (document as Document & { startViewTransition: (callback: () => Promise<void>) => { finished: Promise<void> } })
        .startViewTransition(async () => {
            await goto(url, options);
        });

    await transition.finished;
}
```

- [ ] **Step 2: Verify file was created**

Check that the file exists at `src/lib/utils/viewTransition.ts` and TypeScript compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/viewTransition.ts
git commit -m "feat(android): add navigateWithTransition() utility for View Transitions API"
```

---

## Task 3: Update ChatList.svelte - Add View Transition Integration

**Files:**
- Modify: `src/lib/components/ChatList.svelte`

**Context:** ChatList.svelte displays chat items with avatars and names. We need to:
1. Import the new navigation utility
2. Update `selectChat()` to use `navigateWithTransition()`
3. Add `view-transition-name` styles to avatar and name elements

- [ ] **Step 1: Add import for navigateWithTransition**

Find the imports section (around line 1-35) and add the import. Look for the existing `goto` import at line 11 and add after it:

```typescript
import { navigateWithTransition } from "$lib/utils/viewTransition";
```

The imports section should now include both:
- `import { goto } from "$app/navigation";` (line 11)
- `import { navigateWithTransition } from "$lib/utils/viewTransition";` (new line after 11)

- [ ] **Step 2: Update selectChat() function**

Find the `selectChat()` function at line 529 and modify it:

**Current code (lines 529-532):**
```typescript
function selectChat(id: string) {
    hapticSelection();
    goto(`/chat/${id}`, { invalidateAll: true });
}
```

**New code:**
```typescript
function selectChat(id: string) {
    hapticSelection();
    navigateWithTransition(`/chat/${id}`, { invalidateAll: true });
}
```

- [ ] **Step 3: Add view-transition-name to chat item avatars**

Find the chat item avatar section (around lines 726-740). There are two cases: group and individual.

**For GroupAvatar (lines 728-732), change from:**
```svelte
<GroupAvatar
  participants={item.participants || []}
  size="md"
  class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
/>
```

**To:**
```svelte
<GroupAvatar
  participants={item.participants || []}
  size="md"
  class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
  style="view-transition-name: chat-avatar-{item.id}"
/>
```

**For Avatar (lines 734-739), change from:**
```svelte
<Avatar
  npub={item.id}
  src={item.picture}
  size="md"
  class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
/>
```

**To:**
```svelte
<Avatar
  npub={item.id}
  src={item.picture}
  size="md"
  class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
  style="view-transition-name: chat-avatar-{item.id}"
/>
```

- [ ] **Step 4: Add view-transition-name to chat item names**

Find the name span (around lines 748-751), change from:
```svelte
<span
  class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]"
  >{item.name}</span
>
```

**To:**
```svelte
<span
  class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]"
  style="view-transition-name: chat-name-{item.id}"
  >{item.name}</span
>
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ChatList.svelte
git commit -m "feat(android): integrate View Transitions in ChatList"
```

---

## Task 4: Update ChatView.svelte - Add View Transition Integration

**Files:**
- Modify: `src/lib/components/ChatView.svelte`

**Context:** ChatView.svelte displays the chat header with avatar and name. We need to:
1. Import the navigation utility
2. Update the back button to use `navigateWithTransition()`
3. Add `view-transition-name` styles to header avatar and name

- [ ] **Step 1: Add import for navigateWithTransition**

Find the imports section (around lines 1-65). Look for the existing platform imports around line 30. Add the new import after the existing platform import line:

```typescript
import { isAndroidCapacitorShell, blur } from '$lib/utils/platform';
import { navigateWithTransition } from '$lib/utils/viewTransition';
```

- [ ] **Step 2: Update back button navigation**

Find the back button handler (around lines 2098-2109), change from:
```svelte
<button 
    onclick={() => {
        tapSoundClick();
        goto('/chat');
    }}
    class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150 ease-out flex-shrink-0"
    aria-label="Back to contacts"
>
```

**To:**
```svelte
<button 
    onclick={() => {
        tapSoundClick();
        navigateWithTransition('/chat');
    }}
    class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150 ease-out flex-shrink-0"
    aria-label="Back to contacts"
>
```

- [ ] **Step 3: Add view-transition-name to group chat header avatar**

Find the GroupAvatar in the header (around lines 2113-2117), change from:
```svelte
<GroupAvatar 
    participants={groupConversation.participants.filter((p: string) => p !== $currentUser?.npub)} 
    size="sm" 
    class="!w-8 !h-8 md:!w-9 md:!h-9 transition-all duration-150 ease-out"
/>
```

**To:**
```svelte
<GroupAvatar 
    participants={groupConversation.participants.filter((p: string) => p !== $currentUser?.npub)} 
    size="sm" 
    class="!w-8 !h-8 md:!w-9 md:!h-9 transition-all duration-150 ease-out"
    style="view-transition-name: chat-avatar-{groupConversation.id}"
/>
```

- [ ] **Step 4: Add view-transition-name to group chat header name**

Find the group name span (around lines 2121-2122), change from:
```svelte
<span class="font-bold dark:text-white text-start truncate">
    {groupTitle || $t('chat.group.defaultTitle')}
</span>
```

**To:**
```svelte
<span 
    class="font-bold dark:text-white text-start truncate"
    style="view-transition-name: chat-name-{groupConversation.id}"
>
    {groupTitle || $t('chat.group.defaultTitle')}
</span>
```

- [ ] **Step 5: Add view-transition-name to 1-on-1 chat header avatar**

Find the Avatar for 1-on-1 chats (around lines 2159-2164), change from:
```svelte
<Avatar 
    npub={partnerNpub} 
    src={partnerPicture} 
    size="sm" 
    class="!w-8 !h-8 md:!w-9 md:!h-9 transition-all duration-150 ease-out"
/>
```

**To:**
```svelte
<Avatar 
    npub={partnerNpub} 
    src={partnerPicture} 
    size="sm" 
    class="!w-8 !h-8 md:!w-9 md:!h-9 transition-all duration-150 ease-out"
    style="view-transition-name: chat-avatar-{partnerNpub}"
/>
```

- [ ] **Step 6: Add view-transition-name to 1-on-1 chat header name**

Find the partner name button (around lines 2166-2171), change from:
```svelte
<button
    onclick={() => partnerNpub && openProfile(partnerNpub)}
     class="font-bold hover:underline dark:text-white text-start truncate min-w-0"
>
    {partnerName || partnerNpub.slice(0, 10) + "..."}
</button>
```

**To:**
```svelte
<button
    onclick={() => partnerNpub && openProfile(partnerNpub)}
     class="font-bold hover:underline dark:text-white text-start truncate min-w-0"
    style="view-transition-name: chat-name-{partnerNpub}"
>
    {partnerName || partnerNpub.slice(0, 10) + "..."}
</button>
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ChatView.svelte
git commit -m "feat(android): integrate View Transitions in ChatView header"
```

---

## Task 5: Add View Transition CSS Customization

**Files:**
- Modify: `src/app.css`

**Context:** Add CSS to customize the View Transition timing and easing for a subtle, fast effect.

- [ ] **Step 1: Add View Transition CSS at the end of app.css**

Add the following CSS at the end of `src/app.css` (after line 206):

```css
/* View Transitions API - Android Chat Navigation */
::view-transition-old(root),
::view-transition-new(root) {
    animation-duration: 280ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-group(chat-avatar-),
::view-transition-group(chat-name-) {
    animation-duration: 280ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app.css
git commit -m "feat(android): add View Transition CSS customization for chat navigation"
```

---

## Task 6: Run Type Checking and Tests

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript type checking**

```bash
npm run check
```

Expected: No TypeScript errors related to the new code.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Build the project**

```bash
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Final commit if everything passes**

```bash
git status  # verify all changes are committed
git log --oneline -5  # show recent commits
```

---

## Testing Checklist

After implementation, verify:

1. **Platform detection works:**
   - On Android with View Transitions support, transitions should animate
   - On older Android or non-Android platforms, navigation should be instant

2. **Shared elements animate:**
   - Avatar morphs from list position to header position
   - Name slides up and maintains scale
   - Both elements transition smoothly

3. **Bidirectional navigation:**
   - Tapping a chat animates into the chat view
   - Tapping back animates back to the chat list

4. **Both chat types work:**
   - 1-on-1 chats (using npub as ID)
   - Group chats (using conversationId as ID)

5. **Timing feels right:**
   - 280ms duration feels subtle and fast (WhatsApp-like)
   - Material Design easing provides smooth acceleration/deceleration

---

## Implementation Notes

**View Transition Name Format:**
- Avatar: `chat-avatar-{id}` where id is npub (1-on-1) or conversationId (group)
- Name: `chat-name-{id}` where id is npub (1-on-1) or conversationId (group)

**Why only Android:**
The feature is gated by `supportsViewTransitions()` which returns true only when:
1. Running in Android Capacitor shell
2. WebView supports `document.startViewTransition` (API available in Chrome 114+)

**Fallback behavior:**
On unsupported platforms, `navigateWithTransition()` immediately calls `goto()` without any animation, providing identical behavior to before.

**CSS Selector Wildcards:**
The CSS uses attribute prefix selectors (`chat-avatar-` and `chat-name-`) to match all elements with those prefixes, avoiding the need to list every possible ID.
