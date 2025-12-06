# Visual Design Specification

## Purpose
This spec defines the shared visual design system for the nospeak web client, including glassmorphism treatment, color palette, typography, motion, and layout patterns used across authenticated and unauthenticated states.
## Requirements
### Requirement: Consistent glassmorphism visual language
The application interface SHALL use the glass & slate visual language described in this spec for primary containers, backgrounds, and interactive elements so that users experience a cohesive, modern UI across screens and themes.

#### Scenario: Apply glassmorphism to primary surfaces
- **WHEN** rendering primary app surfaces such as chat windows, navigation bars, and modals
- **THEN** those surfaces SHALL use semi-transparent backgrounds with blur, soft rounded corners, and subtle borders/shadows consistent with the values defined in this spec
- **AND** the implementation SHOULD respect both light and dark theme tokens while preserving legibility.

### Requirement: URL Preview Card Visual Design
The URL preview card for non-media links in chat messages SHALL follow the existing messaging visual design system, using Catppuccin theme tokens for colors, typography, and spacing. The card SHALL present link metadata in a compact, readable layout that works across desktop and mobile breakpoints.

#### Scenario: Preview card layout and theming
- **WHEN** a URL preview card is rendered under a message bubble
- **THEN** the card SHALL use a background and border treatment that clearly associates it with the message while remaining visually distinct from the message text
- **AND** the card SHALL display the link title as primary text, the effective domain as secondary text, and MAY show a short description when available
- **AND** all text and icon colors SHALL respect the active Catppuccin theme (Latte or Frappe) for readability and contrast.

#### Scenario: Responsive behavior on mobile and desktop
- **GIVEN** the user views a conversation on a mobile device or a desktop device
- **WHEN** a URL preview card is rendered
- **THEN** the card layout SHALL adapt so that content remains legible without horizontal scrolling
- **AND** any thumbnail or favicon image SHALL scale or reposition to avoid overwhelming the text content on small screens.

#### Scenario: Hover, focus, and active states
- **WHEN** the user hovers over, focuses, or activates the URL preview card
- **THEN** the card SHALL provide clear visual feedback (such as subtle background or border changes) consistent with other interactive elements in the messaging UI
- **AND** focus indicators SHALL be visible and accessible for keyboard and assistive technology users.

## 1. Design Philosophy

The application follows a "Glass & Slate" aesthetic, prioritizing depth, motion, and airiness over flat utility. The interface simulates a floating glass layer over a dynamic background, creating a sense of context and modernity.

## 2. Visual Language

### Glassmorphism
*   **Surface:** Primary containers and overlays use semi-transparent backgrounds with background blur.
    *   Light Mode: `bg-white/70` with `backdrop-blur-xl`.
    *   Dark Mode: `bg-slate-900/70` with `backdrop-blur-xl`.
*   **Borders:** Subtle, translucent borders define edges without harsh contrast.
    *   `border-white/20` (Light) or `border-white/10` (Dark).
*   **Shadows:** Deep, diffuse shadows (`shadow-2xl`) lift floating elements (modals, main window) off the background.
*   **Background:** Ambient, blurred gradient blobs (Blue/Purple) provide depth behind the glass layers.

### Color Palette
*   **Theme:** Catppuccin (Mocha/Latte).
*   **Dark Mode Base (Mocha):** Overrides `slate` palette.
    *   Background: `#11111b` (Crust)
    *   Surface: `#1e1e2e` (Base)
    *   Sidebar: `#181825` (Mantle)
    *   Text: `#cdd6f4` (Text)
*   **Light Mode Base (Latte):** Overrides `gray` palette.
    *   Background: `#eff1f5` (Base)
    *   Surface: `#ffffff` (Base/White)
*   **Accents:**
    *   Primary: **Lavender** (`#7287fd` -> `#5b6ee1`) overriding `blue` palette.
    *   Success: `Green-500`
    *   Error: `Red-500`

### Shapes & Geometry
*   **Windows & Modals:** Large `rounded-3xl` corners.
*   **List Items & Bubbles:** Soft `rounded-2xl` corners.
*   **Inputs & Buttons:** Full "Pill" shapes (`rounded-full` or `rounded-xl`).
*   **Avatars:** Circular (`rounded-full`) with a subtle ring (`ring-white/50` or `ring-white/10`) to separate from glass backgrounds.

### Typography
*   **Font:** System sans-serif, `antialiased` for crisp rendering.
*   **Weights:**
    *   Headers: `font-bold`
    *   Body: `font-normal` or `font-medium`
    *   Labels: `font-medium`

## 3. Layout Architecture

### Authenticated State
*   **App Window:** A single, central glass container holding the Sidebar (Contacts) and Main Content (Chat).
*   **Responsiveness:**
    *   Desktop: Floating centered window with rounded corners and padding.
    *   Mobile: Full-screen glass interface.
*   **Modals:** Rendered at the root level (`+layout.svelte`) to overlay the entire application window and background.

### Unauthenticated State
*   **Login Modal:** A focused, free-floating glass card centered on the background.
*   **App Window:** Hidden until successful authentication.

## 4. Motion & Interaction

### Transitions
*   **Page Navigation:** Subtle `fade` (150ms) transition when switching contexts (e.g., chat threads).
*   **Modals:** Fade-in backdrop with scaled content entry.
*   **Messages:** `fly` (y: 20px) entrance animation with `cubicOut` easing.

### Micro-interactions
*   **Hover:** Elements (contacts, buttons) brighten and/or shift background color.
*   **Active:** Interactive elements scale down (`scale-95`) on press for tactile feedback.
*   **Haptics:** Soft vibration on mobile interactions where supported.

## 5. Loading States
*   **Skeleton Loaders:** Pulsing shapes (gray/slate blocks) replace spinners for content loading (Profile, Contacts).
*   **Spinners:** Minimal use, primarily for action states (e.g., "Sending", "Saving").
