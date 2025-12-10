# Visual Design Specification Delta

## MODIFIED Requirements

### Requirement: Consistent glassmorphism visual language
The application interface SHALL use the glass & slate visual language described in this spec for primary containers, backgrounds, and interactive elements, **EXCEPT** where performance constraints on mobile/Android devices necessitate simpler rendering for scrolling content.

#### Scenario: Simplified rendering on Android/Mobile for scrolling content
- **GIVEN** the application is running on an Android device or mobile viewport
- **WHEN** rendering scrolling lists (such as message bubbles in a chat)
- **THEN** the application MAY disable `backdrop-filter` (blur) effects on individual list items
- **AND** SHALL use increased opacity (e.g., 90% instead of 70%) to maintain legibility and contrast against the background
- **AND** static elements (headers, footers) MAY retain glassmorphism if performance permits.
