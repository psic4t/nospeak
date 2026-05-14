# Android Chat Shared Element Transition Design

**Date:** 2026-05-14  
**Feature:** WhatsApp-like scroll-in effect for chat navigation on Android  
**Approach:** CSS View Transitions API

---

## Overview

Implement a subtle, fast shared element transition when tapping a chat in the Android Capacitor app. The avatar and name smoothly animate from the chat list item position to the chat header position, similar to WhatsApp's navigation experience.

---

## Goals

1. Create a polished, native-feeling transition for Android users
2. Animate avatar and name as shared elements between list and header
3. Maintain subtlety and speed (280ms duration)
4. Gracefully degrade on unsupported platforms
5. Work bidirectionally (entering and exiting chat)

---

## Architecture

### Platform Detection

Extend `src/lib/utils/platform.ts` with a new function to detect View Transitions API support:

```typescript
export function supportsViewTransitions(): boolean {
    return isAndroidCapacitorShell() && 
           typeof document !== 'undefined' && 
           'startViewTransition' in document;
}
```

**Requirements:**
- Must be Android Capacitor shell (`Capacitor.getPlatform() === 'android'`)
- WebView must support View Transitions API (Android 14+ or updated WebView)

### Shared Elements

Two elements are marked as shared between chat list and chat view:

1. **Avatar Image** - `view-transition-name: chat-avatar-{id}`
2. **Display Name** - `view-transition-name: chat-name-{id}`

The `{id}` is the conversation identifier (npub for 1-on-1, conversationId for groups), ensuring unique transition names per chat.

### Navigation Integration

Create a new utility `src/lib/utils/viewTransition.ts`:

```typescript
import { goto } from '$app/navigation';
import { supportsViewTransitions } from './platform';

export async function navigateWithTransition(
    url: string, 
    options?: Parameters<typeof goto>[1]
): Promise<void> {
    if (!supportsViewTransitions()) {
        await goto(url, options);
        return;
    }

    const transition = document.startViewTransition(async () => {
        await goto(url, options);
    });

    await transition.finished;
}
```

### Component Changes

#### ChatList.svelte

1. Import `navigateWithTransition` from the new utility
2. Update `selectChat()` function to use `navigateWithTransition()` instead of `goto()`
3. Add `style="view-transition-name: chat-avatar-{item.id}"` to avatar elements
4. Add `style="view-transition-name: chat-name-{item.id}"` to name span elements

#### ChatView.svelte

1. Import `navigateWithTransition` from the new utility
2. Update back button handler to use `navigateWithTransition('/chat')`
3. Add `style="view-transition-name: chat-avatar-{partnerNpub}"` to header avatar
4. Add `style="view-transition-name: chat-name-{partnerNpub}"` to header name

### Visual Design

**Timing:**
- Duration: 280ms
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Material Design standard)

**CSS Customization:**

```css
::view-transition-old(root),
::view-transition-new(root) {
    animation-duration: 280ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-group(chat-avatar-*),
::view-transition-group(chat-name-*) {
    animation-duration: 280ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Behavior:**
- Avatar morphs from list circle (40px) to header circle (40px)
- Name slides up and maintains scale
- Chat content fades in behind shared elements
- Transition plays in reverse when navigating back

---

## Fallback Behavior

On platforms that don't support View Transitions API:
- `supportsViewTransitions()` returns false
- Navigation falls back to instant `goto()` behavior
- No visual change from current implementation

---

## Testing Strategy

1. **Unit tests** for `supportsViewTransitions()` function
2. **Manual testing** on Android 14+ device
3. **Manual testing** on older Android to verify fallback
4. **Visual regression** - capture transition frames for comparison

---

## Files Modified

1. `src/lib/utils/platform.ts` - Add `supportsViewTransitions()` function
2. `src/lib/utils/viewTransition.ts` - New navigation utility
3. `src/lib/components/ChatList.svelte` - Add transition names and use new navigation
4. `src/lib/components/ChatView.svelte` - Add transition names and use new navigation for back button
5. `src/app.css` or component styles - Add View Transition CSS customization

---

## Open Questions

None. Design approved by user.

---

## Future Considerations

- Consider extending to other platforms once View Transitions API gains wider support
- Could animate additional elements (last message preview fading into chat content area)
- Potential to add spring physics for more organic feel
