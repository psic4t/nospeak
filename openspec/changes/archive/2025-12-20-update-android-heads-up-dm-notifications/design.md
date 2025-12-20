## Context
nospeak uses a native Android foreground service (`NativeBackgroundMessagingService`) to maintain relay connections and emit OS notifications while the WebView UI is suspended. The current message notification channel uses default importance, and the service may emit generic notifications when decryption fails and reaction-based notifications when reaction rumors are decrypted.

## Goals / Non-Goals
- Goals:
  - Make new decrypted DM notifications emitted by the Android background service Heads-Up eligible by default.
  - Keep behavior scoped to Amber-mode background messaging.
  - Reduce noise by suppressing reaction and generic fallback notifications from the background service.
- Non-Goals:
  - Changing web/foreground JS-driven notification behavior.
  - Adding new in-app settings toggles for prominence.
  - Redesigning notification grouping, actions, or inline reply.

## Decisions
- Decision: Use a HIGH-importance Android notification channel with sound + vibration by default.
  - Rationale: On Android 8+ channel importance and sound/vibration are the primary determinants of Heads-Up display.
- Decision: Allow lockscreen content previews by default.
  - Rationale: Product wants to “allow Android to show it”; Android privacy settings remain authoritative.
- Decision (testing-stage): Delete + recreate the message notification channel at background-service startup.
  - Rationale: Android does not allow upgrading importance of an already-created channel; recreating ensures testers immediately receive Heads-Up defaults.
  - Follow-up: For production, migrate to a new channel ID (e.g. `..._v2`) instead of deleting channels to preserve user customization.

## Risks / Trade-offs
- Channel recreation resets any user-configured preferences for that channel (sound, vibration, Heads-Up, lockscreen visibility).
- Heads-Up display remains subject to OS state (Do Not Disturb, OEM notification policies, battery optimizations).

## Migration Plan
- Testing: implement delete + recreate.
- Later (production hardening): introduce channel-ID migration instead of deletion and document/handle user opt-outs.

## Open Questions
- Confirm that DM attachments (NIP-17 Kind 15 file messages) should use the same Heads-Up behavior as text DMs (Kind 14). (Proposal assumes yes.)
