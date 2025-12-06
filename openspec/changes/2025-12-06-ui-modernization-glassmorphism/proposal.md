# Proposal: Modern UI Overhaul (Glassmorphism & Slate Theme)

## Background
The previous UI was functional but lacked modern visual depth and polish. Users requested a modernization effort focusing on "depth," "motion," and "airiness" to move away from the flat utility look.

## Goal
Implement a comprehensive UI modernization using a Glassmorphism design language, refining typography, introducing motion/transitions, and switching the dark mode palette to a richer "Slate" tone.

## Scope
- **Visual Style:** Glassmorphism (backdrop-blur, semi-transparent surfaces) for all major containers and modals.
- **Color Palette:** Switch Dark Mode from neutral gray/black to Slate (bluish-gray). Use gradients for sent messages.
- **Typography & Shapes:** rounded-3xl corners, antialiased text, pill-shaped inputs and buttons.
- **Motion:** Entrance animations for messages, page fade transitions, hover scaling (tactile feedback).
- **UX:** Skeleton loaders for profiles and contacts.
- **Architecture:** Global modal management at the root level to fix z-index/clipping issues.
- **Login Flow:** Complete restyle of the login page to match the new aesthetic.

## Affected Components
- `src/routes/+layout.svelte` (Root container, background blobs, modal layer)
- `src/routes/+page.svelte` (Login page)
- `src/lib/components/ChatView.svelte` (Message bubbles, input pill, animations)
- `src/lib/components/ContactList.svelte` (Sidebar, list items, skeletons)
- `src/lib/components/*Modal.svelte` (Settings, Profile, Manage Contacts, Relay Status)
- `src/app.css` (Global styles, scrollbars)
