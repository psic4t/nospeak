## 1. Implementation
- [x] 1.1 Review existing haptics usage in the web client and Android shell to confirm all current entry points (e.g., `softVibrate` callers).
- [x] 1.2 Update the web haptics utility to delegate to `@capacitor/haptics` when running inside the Android Capacitor app shell, with a safe no-op or browser-native fallback elsewhere.
- [x] 1.3 Wire Android builds to ensure the Capacitor Haptics plugin is registered and available for use by the web client.
- [x] 1.4 Add or update unit/integration coverage to confirm that haptics calls are non-blocking and do not throw when Capacitor Haptics is unavailable (for example, in SSR or standard browser environments).
- [ ] 1.5 Manually verify haptic feedback on a physical Android device for key interactions (such as contact selection and chat actions) and confirm web behavior is unchanged aside from the absence of haptics where unsupported.
