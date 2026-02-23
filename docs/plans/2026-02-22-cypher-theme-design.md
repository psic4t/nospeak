# Cypher Theme Design

## Overview
Create a new "Cypher" theme with a pure black background and cyan neon accents. This theme operates independently of the system day/night cycle and provides a cyberpunk aesthetic.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#000000` | All backgrounds, pure black |
| Surface | `#000000` | Cards, panels, elevated surfaces |
| Text | `#ffffff` | Primary text |
| Subtext | `#b3b3b3` | Secondary text |
| Primary Accent | `#00ffff` | Cyan neon - borders, icons, interactive elements |
| Secondary Accent | `#00cccc` | Dimmer cyan - secondary accents |
| Border | `#00ffff` | All borders with neon glow effect |
| Overlay | `rgba(255,255,255,0.1)` | Subtle overlays |

## Design Decisions

### Pure Black Surfaces
All surface colors are `#000000` - no gradients, no elevation tints. The UI relies entirely on neon accents for visual hierarchy.

### Neon Accents
Cyan (#00ffff) is used for:
- Button borders and fills
- Focus states
- Icon highlights
- Dividers and borders
- Input field underlines
- Toggle switches
- Interactive element glow effects

### Glow Effects
Neon elements should have a subtle glow using `box-shadow`:
- Active buttons: `0 0 10px rgba(0, 255, 255, 0.5)`
- Focused inputs: `0 0 5px rgba(0, 255, 255, 0.3)`
- Borders: `0 0 2px rgba(0, 255, 255, 0.8)`

## Implementation Approach

Extend the existing mode system to include "cypher" as a fourth mode option alongside "system", "light", and "dark".

### Key Changes

1. **theme.ts**: Add 'cypher' to ThemeMode type and create cypher color palette
2. **applyTheme()**: Handle cypher mode specially - apply pure black colors and set dark class
3. **Settings UI**: Add "Cypher" option to theme dropdown
4. **CSS**: Add cypher-specific styles for neon glow effects

### Mode Behavior

- Cypher mode always forces dark appearance
- Ignores system preferences
- Stored as `nospeak-theme-mode: cypher`

## Files Modified

- `src/lib/stores/theme.ts` - Core theme logic and color definitions
- `src/lib/stores/theme.svelte.ts` - Svelte 5 store integration
- `src/app.css` - Global CSS with cypher-specific styles
- `src/lib/components/SettingsModal.svelte` - Theme selector UI

## Future Considerations

- This approach treats Cypher as a "mode" which is semantically imperfect but pragmatic
- Future themes would extend this pattern
- Glow effects should be CSS custom properties for easy theming
