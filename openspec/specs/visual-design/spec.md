# Visual Design Specification

## Purpose
This spec defines the shared visual design system for the nospeak web client, including glassmorphism treatment, color palette, typography, motion, and layout patterns used across authenticated and unauthenticated states.
## Requirements
### Requirement: Consistent glassmorphism visual language
The application interface SHALL use the glass & slate visual language described in this spec for primary containers, backgrounds, and interactive elements, **EXCEPT** where performance constraints on mobile/Android devices necessitate simpler rendering for scrolling content. When running inside the Android Capacitor app shell with edge-to-edge layout enabled, primary surfaces and full-screen glass overlays (such as the authenticated app window and root-level modals) SHALL respect OS-provided safe-area insets so that content does not clash with the system status bar or gesture regions.

#### Scenario: Simplified rendering on Android/Mobile for scrolling content
- **GIVEN** the application is running on an Android device or mobile viewport
- **WHEN** rendering scrolling lists (such as message bubbles in a chat)
- **THEN** the application MAY disable `backdrop-filter` (blur) effects on individual list items
- **AND** SHALL use increased opacity (e.g., 90% instead of 70%) to maintain legibility and contrast against the background
- **AND** static elements (headers, footers) MAY retain glassmorphism if performance permits.

#### Scenario: Root layout and modals respect safe-area insets on Android
- **GIVEN** the application is running inside the Android Capacitor app shell with edge-to-edge layout and a StatusBar overlay configuration
- **WHEN** the authenticated app window and full-screen glass modals are rendered (including Settings, Manage Contacts, Profile, Relay Status, User QR, and Sync Progress overlays)
- **THEN** their top and bottom padding or layout constraints SHALL include OS-provided safe-area insets (for example via `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`) instead of hard-coded Android-only padding constants
- **AND** the visual alignment of these surfaces with the ambient glassmorphism background SHALL remain consistent between Android, desktop, and mobile web usage.

#### Scenario: Desktop and web layouts remain visually consistent
- **GIVEN** the user is accessing nospeak via a standard desktop or mobile web browser
- **WHEN** the same root layout and modal components are rendered
- **THEN** the use of safe-area-aware CSS utilities SHALL not introduce visible extra gaps where OS safe-area insets are zero
- **AND** the floating glass container and modal overlays SHALL maintain their existing spacing, rounded corners, and shadows as defined by the glassmorphism visual language.

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

### Requirement: Mobile contacts header app name styling
The nospeak app name label in the mobile contacts sidebar header SHALL follow the existing visual design system for typography, spacing, and glassmorphism so that the label feels integrated with the rest of the interface.

#### Scenario: App name label matches visual language
- **GIVEN** the nospeak app name label is rendered next to the current user's avatar in the contacts header on a mobile-sized layout
- **WHEN** the header is displayed in light or dark theme
- **THEN** the label uses a small, bold type treatment consistent with other header labels
- **AND** the text color respects the active Catppuccin theme for readability
- **AND** the spacing between the avatar, label, and settings control aligns with the glassmorphism-based layout without causing overlap or truncation in typical mobile widths.

### Requirement: Relay Connections Modal Visual Design
The Relay Connections modal SHALL use the same glassmorphism-based visual treatment, layout structure, and motion patterns as the existing first-time sync progress modal so that relay management feels like a cohesive part of the primary app surfaces.

#### Scenario: Relay Connections modal matches SyncProgress glassmorphism treatment
- **GIVEN** the Relay Connections modal is displayed on desktop or mobile
- **WHEN** the modal surface is rendered
- **THEN** it SHALL use semi-transparent glass backgrounds with blur, soft rounded corners, subtle borders, and shadows consistent with the first-time sync progress modal
- **AND** it SHALL respect the active Catppuccin theme tokens for light and dark modes while preserving text and control legibility.

#### Scenario: Relay Connections modal aligns with primary modal layout and motion
- **GIVEN** the Relay Connections modal is opened or closed
- **WHEN** the modal appears over the authenticated app window
- **THEN** it SHALL be positioned and sized consistent with other primary modals defined in the visual design spec (centered on desktop, full-screen glass surface on mobile)
- **AND** it SHALL use the same modal open/close transitions (backdrop fade and content scale/fade) as the first-time sync progress modal.

### Requirement: Semantic Typography Scale for Primary Surfaces
The messaging UI SHALL use a small, semantic typography scale instead of ad-hoc font sizes for common text elements across primary surfaces. The scale SHALL define at least the following semantic styles: Title (primary headings such as modal and panel titles), Section (secondary headings such as section titles within a view), Body (standard paragraph content), and Meta (small, secondary information such as timestamps, chips, and helper labels). Implementations MAY express these styles using Tailwind utility composition or an equivalent mechanism, but the semantics and visual hierarchy SHALL remain consistent across chat, settings, and relay-management views.

#### Scenario: Chat timestamps and message metadata share Meta style
- **GIVEN** the user is viewing any chat conversation
- **AND** the interface renders per-message timestamps, date separators, or a short summary of relay delivery status (for example, "sent to X/Y relays")
- **WHEN** these message metadata elements are displayed under or between message bubbles
- **THEN** they SHALL use the shared Meta typography style (small size, reduced emphasis relative to Body text, and consistent letter-spacing)
- **AND** the chosen Meta style SHALL remain readable on both Catppuccin Latte and Frappe themes.

#### Scenario: Relay Connections modal labels and status chips use Section and Meta styles
- **GIVEN** the user opens the Relay Connections modal from the messaging UI
- **WHEN** the modal displays its primary title, per-relay URL row, and status indicators (for example, Connected / Disconnected chips and small numeric stats)
- **THEN** the modal title SHALL use the shared Title typography style
- **AND** field labels and small statistics (such as "Type", "Last Connected", counts, and status chips) SHALL use the shared Meta typography style
- **AND** any descriptive copy within the modal SHALL use the shared Body typography style when present.

#### Scenario: Modal titles and explanatory copy use Title, Section, and Body styles
- **GIVEN** the user sees blocking or prominent modals in the messaging experience (including first-time sync progress, empty profile setup, login with Amber, Manage Contacts, and Settings)
- **WHEN** each modal renders its main heading, internal section titles, and explanatory paragraphs
- **THEN** the main modal heading SHALL use the shared Title typography style
- **AND** any internal section headings (for example, category headers inside Settings) SHALL use the shared Section typography style
- **AND** explanatory paragraphs and helper text SHALL use the shared Body typography style, with only truly small, secondary labels (such as field labels or short hints) using the Meta style.

### Requirement: Card-Based Settings Category Visual Design
The Settings category navigation on mobile web (PWA) and inside the Android app shell SHALL use card-based visual treatments that align with the glass & slate visual design system while remaining performant on small screens. Each category card SHALL be a rounded-2xl glass surface with a subtle border, SHALL use monochrome SVG icons that follow the active theme via `currentColor`, and SHALL avoid a persistent colored active background state on the card list, relying instead on hover/press feedback and contextual headings to indicate selection.

#### Scenario: Settings category cards use glassmorphism surfaces and typography
- **GIVEN** the user is viewing the Settings categories list on a mobile web handset viewport or inside the Android Settings bottom sheet
- **WHEN** the category cards are rendered
- **THEN** each card SHALL use a semi-transparent glass background with rounded-2xl corners, a subtle translucent border, and a soft shadow consistent with other primary glass surfaces defined in `visual-design`
- **AND** the category title text SHALL use the shared Section or Body typography styles
- **AND** any optional subtitle text SHALL use the shared Meta typography style so that hierarchy remains consistent with the rest of the interface.

#### Scenario: Settings category cards use monochrome SVG icons
- **GIVEN** the Settings categories list is rendered on mobile web or Android
- **WHEN** an icon is displayed for a category (such as a gear for General or a user silhouette for Profile)
- **THEN** the icon SHALL be implemented as an inline or componentized SVG that uses `stroke="currentColor"` (and no hard-coded fill color)
- **AND** the icon SHALL appear inside a small circular or pill-shaped backdrop consistent with other icon treatments in the app
- **AND** the apparent icon color SHALL derive from the active theme via text color utilities (for example, Tailwind `text-*` classes) so that it remains legible in both light and dark modes.

#### Scenario: Settings category cards provide transient interaction feedback only
- **GIVEN** the user is interacting with the Settings category cards on mobile web or Android
- **WHEN** the user hovers (on desktop-class devices) or presses a card (on touch devices)
- **THEN** the card SHALL provide transient interaction feedback such as a slight increase in background opacity, a subtle shadow, or a small scale-down effect while the interaction is active
- **AND** after navigation into a category detail view, the originating card in the list SHALL NOT remain with a persistent colored active background; selection MAY instead be communicated via the detail view header or supporting copy.

### Requirement: Android Settings Bottom Sheet Visual Treatment
The Android Settings bottom sheet SHALL follow the same glassmorphism visual language as other primary overlays while clearly reading as a sheet anchored to the bottom of the viewport. It SHALL use rounded top corners, a safe-area-aware layout, and an optional drag handle, and it SHALL visually integrate with the authenticated app background and gradients without introducing harsh edges.

#### Scenario: Android Settings bottom sheet matches primary glass surfaces
- **GIVEN** the user opens Settings inside the Android Capacitor app shell
- **WHEN** the Settings bottom sheet is rendered above the chat UI
- **THEN** the sheet surface SHALL use semi-transparent glass backgrounds with blur, soft rounded top corners, subtle borders, and shadows consistent with other primary modal surfaces defined in `visual-design`
- **AND** the sheet SHALL respect OS-provided safe-area insets at the bottom and sides so that interactive elements are not obscured by gesture navigation regions
- **AND** the visual transition from the main app window to the sheet (such as slide-up and backdrop fade) SHALL feel consistent with other modal transitions described in the motion and interaction guidelines.

### Requirement: Android Bottom Sheet Drag Handle and Drag Motion
Android bottom sheet modals, including Settings and Manage Contacts, SHALL provide a clear visual affordance for drag-to-dismiss and a motion treatment consistent with the existing glassmorphism and modal transition guidelines. The drag handle or header region used to initiate the swipe-to-close gesture SHALL be visually integrated with the sheet surface, and the sheet SHALL move as a cohesive glass surface during drag and dismissal.

#### Scenario: Bottom sheet shows drag affordance in Android app shell
- **GIVEN** the user opens a bottom sheet modal (such as Settings or Manage Contacts) inside the Android Capacitor app shell
- **WHEN** the bottom sheet is fully visible
- **THEN** the sheet SHALL include a visible drag affordance near its top edge (for example, a small rounded bar or a header region that visually suggests it can be grabbed)
- **AND** this affordance SHALL follow the existing glassmorphism visual language (subtle opacity, rounded shape, and appropriate contrast in both light and dark themes).

#### Scenario: Bottom sheet drag motion matches glassmorphism transitions
- **GIVEN** the user is dragging a bottom sheet modal downward from the drag handle or header area on Android
- **WHEN** the drag is in progress
- **THEN** the entire sheet surface (including its glass background, border, and contents) SHALL translate downward as a single unit without distortion
- **AND** any backdrop or shadow changes during the drag SHALL remain subtle and consistent with the existing modal open/close transitions described in `visual-design`.

#### Scenario: Bottom sheet snap-back and dismiss animations feel cohesive
- **GIVEN** the user releases a dragged bottom sheet after initiating a swipe-to-close gesture on Android
- **WHEN** the drag distance is below the threshold and the sheet snaps back, or above the threshold and the sheet dismisses
- **THEN** the snap-back and dismiss animations SHALL use easing and timing that feel consistent with other modal transitions in the app
- **AND** the sheet SHALL not appear to jitter, stutter, or leave visual artifacts during or after these animations
- **AND** the drag handle or header region SHALL remain visually aligned with the sheet surface throughout the animations.

### Requirement: Crystalline Interactive Components
The application SHALL use a unified "Crystalline" design system for all interactive elements (Buttons, Inputs, Toggles) to ensure visual consistency and adherence to the glassmorphism aesthetic. These components SHALL share common physics (press-to-recede), shape (pill-based), and color logic (theme-aware transparency).

#### Scenario: Button System Visuals and Physics
- **GIVEN** a button is rendered in the UI
- **WHEN** in its default state
- **THEN** it SHALL be pill-shaped (`rounded-full`) with a standard height of 44px (touch-friendly)
- **AND** it SHALL use one of the defined variants:
    - **Glass:** Semi-transparent background (`bg-white/60` or `bg-slate-800/40`), subtle border, and shadow.
    - **Primary:** Tinted background (Green), brighter on hover, with a crystalline border.
    - **Danger:** Tinted background (Red), darker text, indicating destructive action.
    - **Ghost:** Transparent background, visible on hover.
- **AND** on interaction (press/active), the button SHALL visually recede (scale down and/or darken) rather than light up, simulating a tactile press on a glass surface.

#### Scenario: Input Field Visuals
- **GIVEN** a text input or textarea is rendered
- **WHEN** displayed in a modal or form
- **THEN** it SHALL use a pill shape (`rounded-full`) for single-line inputs and `rounded-2xl` for textareas
- **AND** it SHALL use a solid but theme-blended background (`bg-gray-50` / `bg-slate-800`) with a subtle border to ensure legibility while matching the glass container
- **AND** the focus state SHALL use a subtle ring (`ring-blue-500/50`) without a harsh outline.

#### Scenario: Toggle Switch Visuals
- **GIVEN** a toggle switch is rendered (e.g., in Settings)
- **WHEN** in the active (checked) state
- **THEN** the track SHALL use a glowing green glass texture (`bg-green-200/50`)
- **AND** the knob SHALL be a high-contrast dark green circle (`bg-green-900`) in light mode (or light green in dark mode) to align with the Primary Button text color
- **AND** the transition between states SHALL be smooth and animated.

### Requirement: Inline Location Message Map Styling
Location messages in the conversation view SHALL render an inline OpenStreetMap iframe inside the message bubble, with a small, bold "Location" label above the map. The UI SHALL NOT display raw latitude/longitude coordinates by default.

#### Scenario: Inline map displays in message bubble
- **GIVEN** a conversation contains a location message with stored coordinates
- **WHEN** the conversation view renders the message bubble
- **THEN** the bubble SHALL show a small bold "Location" label
- **AND** the bubble SHALL render an OpenStreetMap iframe directly below the label
- **AND** the map SHALL be visually contained (rounded corners) and sized appropriately for chat

#### Scenario: Coordinates are not shown by default
- **GIVEN** a conversation contains a location message
- **WHEN** the bubble is rendered
- **THEN** raw latitude/longitude text SHALL NOT be displayed to the user

### Requirement: Location Preview Modal Map Styling
The interactive OpenStreetMap iframe displayed in the location preview modal (AttachmentPreviewModal with `mode="location"`) SHALL render with appropriate sizing, support pan and zoom gestures, and maintain legibility in both light and dark visual themes. The iframe SHALL use the standard OpenStreetMap export embed endpoint with appropriate bounding box and marker parameters.

#### Scenario: Map iframe renders with correct aspect ratio and size
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` at coordinates `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the modal renders the location content area
- **THEN** the OpenStreetMap iframe SHALL have a height of approximately 300px
- **AND** the iframe SHALL occupy the full width of the modal content area
- **AND** the map SHALL render without cropping or distortion

#### Scenario: Map iframe supports pan and zoom interactions
- **GIVEN** a user is viewing the interactive OSM map in the modal
- **WHEN** the user performs pan or zoom gestures within the iframe
- **THEN** the map SHALL respond smoothly to these interactions
- **AND** the user SHALL be able to navigate the map freely
- **AND** the iframe SHALL not exit or reload when interacting with the map

#### Scenario: Map marker displays at correct coordinates
- **GIVEN** the modal is displaying a location at `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the OpenStreetMap iframe loads
- **THEN** a marker or pin SHALL be visible at the correct coordinates
- **AND** the map SHALL be centered on the location with an appropriate zoom level (approximately zoom=15)

#### Scenario: Map iframe adapts to dark theme
- **GIVEN** the active visual theme is dark mode
- **WHEN** the location modal is opened
- **THEN** the OpenStreetMap iframe and surrounding modal content SHALL use dark theme colors
- **AND** the modal title, buttons, and backdrop SHALL follow dark theme styling
- **AND** in light mode, the modal components SHALL adapt to light theme colors

#### Scenario: Modal provides clear confirmation controls
- **GIVEN** the location preview modal is open
- **WHEN** the modal renders below the map iframe
- **THEN** Cancel and Send controls SHALL be visible and clearly labeled
- **AND** tapping Send SHALL send the location message
- **AND** tapping Cancel SHALL dismiss the preview without sending

#### Scenario: Modal dismisses cleanly with close control
- **GIVEN** the location modal is open
- **WHEN** the user taps the Close button or the modal backdrop
- **THEN** the modal SHALL close immediately
- **AND** the AttachmentPreviewModal SHALL clean up any state
- **AND** the underlying conversation view SHALL remain visible and functional

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
