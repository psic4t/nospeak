## ADDED Requirements
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
