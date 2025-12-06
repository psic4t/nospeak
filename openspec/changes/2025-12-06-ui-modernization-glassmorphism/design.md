# Design: Glassmorphism & Modern UI

## 1. Visual Language: "Glass & Slate"

### Glassmorphism
- **Containers:** All major surfaces (App Window, Modals, Headers, Sidebar) use `bg-white/70` (light) or `bg-slate-900/70` (dark) with `backdrop-blur-xl`.
- **Borders:** Subtle `border-white/20` or `border-white/10` to define edges without harsh lines.
- **Shadows:** Deep, diffuse shadows (`shadow-2xl`) for floating elements like modals and the main app window.
- **Background:** Ambient gradient blobs (Blue/Purple) placed behind the glass layers to create depth.

### Color Palette (Dark Mode Shift)
- **Previous:** `bg-gray-900` (Neutral Black/Gray)
- **New:** `bg-slate-950` / `bg-slate-900` (Cool, bluish-gray)
- **Rationale:** Slate offers a richer, more premium feel that pairs better with the glass effect and blue accent colors.

### Component Shapes
- **Corner Radius:** Standardized on `rounded-3xl` for large containers/modals and `rounded-2xl` for list items/bubbles.
- **Inputs:** Floating "Pill" shape inputs instead of full-width bars.
- **Buttons:** Pill-shaped (`rounded-xl` or `rounded-full`) with gradients.

## 2. Motion & Interaction

### Transitions
- **Page Navigation:** Subtle `fade` (150ms) when switching chats.
- **Messages:** `fly` (y: 20px) entrance animation for new messages.
- **Modals:** Fade-in backdrop with centered modal scaling.

### Micro-interactions
- **Hover:** List items brighten and scale slightly (`scale-[1.02]` removed later for cleaner feel, kept color shift).
- **Active:** Buttons and items scale down (`scale-95`) on click for tactile feedback.

## 3. Architecture Changes

### Global Modal System
- **Problem:** Modals rendered inside the `ChatView` or `ContactList` were clipped by the parent container's `overflow: hidden` or `border-radius`, or had incorrect z-indexing relative to the glass container.
- **Solution:** Moved all modals (`Settings`, `Profile`, `ManageContacts`, `RelayStatus`) to `src/routes/+layout.svelte` (Root).
- **State:** Controlled via global stores in `src/lib/stores/modals.ts`.

### Conditional Layout
- **Login State:** App window (glass container) is **hidden**. Login modal floats freely on the background.
- **Authenticated State:** App window wraps the entire `ContactList` + `ChatView` structure.

## 4. Loading States
- **Skeleton Loaders:** Replaced "Loading..." text with pulsing skeleton blocks for:
    - Profile Modal (Banner, Avatar, Text lines)
    - Contact List (Initial empty state)
