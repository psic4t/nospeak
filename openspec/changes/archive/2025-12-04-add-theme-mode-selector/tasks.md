## 1. Implementation
- [x] 1.1 Introduce a ThemeMode concept (System/Light/Dark) in the theme store, including storage keys and helpers to resolve the effective Catppuccin theme.
- [x] 1.2 Update theme application logic to map Light to Catppuccin Latte and Dark to Catppuccin Frappe, and to toggle the global `dark` class based on the effective theme.
- [x] 1.3 Configure Tailwind to use class-based dark mode and, if needed, expose Catppuccin role colors (app background, panels, text, accents) via CSS variables or Tailwind theme extensions.
- [x] 1.4 Implement a dropdown in Settings → General with options System/Light/Dark, wired to the theme store so that changes persist per device and immediately update the UI.
- [x] 1.5 Ensure System mode follows the OS `prefers-color-scheme` setting, including reacting to OS theme changes while the app is open.
- [x] 1.6 Verify that all primary layouts and modals respect the selected theme mode and remain legible in both Latte and Frappe.

## 2. Validation
- [x] 2.1 Run `npm run check` to verify types and Svelte components.
- [x] 2.2 Run `npx vitest run` to ensure tests pass.
- [x] 2.3 Manually test theme mode selection on at least one desktop and one mobile-size viewport, verifying persistence and System behavior when the OS theme changes.
