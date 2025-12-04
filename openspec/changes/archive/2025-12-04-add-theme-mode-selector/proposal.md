# Change: Add Theme Mode Selector in Settings

## Why
Users currently cannot explicitly choose between light and dark themes and must rely on system settings. This makes it harder to get a consistent appearance across devices or override the OS preference for accessibility or personal taste.

## What Changes
- Add a theme mode selector to the Settings → General section with three options: System, Light, and Dark.
- Define System as the default mode when no preference is stored.
- Map Light to Catppuccin Latte and Dark to Catppuccin Frappe so the UI has consistent, opinionated palettes for each mode.
- Persist the selected theme mode per device, so the app restores the users choice on reload.
- Ensure Tailwind `dark:` styles and Catppuccin CSS variables respond to the selected mode (System/Light/Dark), not only OS preference.

## Impact
- Affected specs: `settings`
- Affected code:
  - `src/lib/stores/theme.ts` and `src/lib/stores/theme.svelte.ts` (theme mode state, persistence, and application)
  - `tailwind.config.js` (dark-mode configuration and optional Catppuccin role colors)
  - `src/lib/components/SettingsModal.svelte` (new dropdown in General section)
  - `src/routes/+layout.svelte` and other components that rely on background/text colors (to confirm they respect theme mode correctly)
