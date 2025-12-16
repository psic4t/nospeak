## 1. Implementation
- [x] 1.1 Audit codebase for any remaining navigator.vibrate or softVibrate references
- [x] 1.2 Implement minimal Android haptics utility exposing light impact and selection feedback using @capacitor/haptics
- [x] 1.3 Update Android-specific call sites to use the new intent-based haptics API
- [x] 1.4 Ensure haptics are fully no-op and non-blocking outside the Android Capacitor shell

## 2. Validation
- [x] 2.1 Add or update unit tests for the haptics utility to cover impact and selection behavior and error swallowing
- [x] 2.2 Run `npm run check` and targeted `npx vitest` suites for haptics and Android integration
- [ ] 2.3 Manually verify haptic behavior on an Android device or emulator for primary taps and selection changes inside the Capacitor app shell
