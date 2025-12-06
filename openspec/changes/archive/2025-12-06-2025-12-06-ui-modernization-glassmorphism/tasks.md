# Tasks: UI Modernization

## 1. Visual Style & Depth
- [x] Create glassmorphism utility classes/styles in `app.css`
- [x] Update `+layout.svelte` with background blobs and main glass container
- [x] Apply `backdrop-blur-xl` and semi-transparent backgrounds to Headers and Sidebar
- [x] Update Message Bubbles to use gradients (Sent) and glass (Received)

## 2. Component Shapes & Typography
- [x] Standardize `rounded-3xl` for modals/containers
- [x] Standardize `rounded-2xl` for list items/bubbles
- [x] Update Inputs to be "Pill" shaped
- [x] Switch Dark Mode palette to `slate` (Tailwind colors)

## 3. Motion & Interaction
- [x] Add `fly` entrance animation for chat messages
- [x] Add `fade` page transition for chat switching
- [x] Add hover effects (color shift) for Contact List items
- [x] Add active state (scale down) for buttons

## 4. Architecture & UX
- [x] Refactor Modals to Root Layout (`+layout.svelte`)
- [x] Create `src/lib/stores/modals.ts` for global visibility state
- [x] Implement Skeleton Loaders for Profile Modal
- [x] Implement Skeleton Loaders for Contact List
- [x] Auto-close modals on logout

## 5. Login Flow
- [x] Restyle `+page.svelte` (Login) to match glass aesthetic
- [x] Restyle `AmberLoginModal.svelte`
- [x] Conditionally render main App Window only after login
