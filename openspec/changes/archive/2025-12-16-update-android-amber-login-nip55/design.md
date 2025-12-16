## Context
nospeak already ships an Android Capacitor app shell that integrates multiple native plugins (local notifications, background messaging, dialogs, haptics, camera, etc.) while delegating the messaging UX to the bundled Svelte web client. Amber is an external Nostr signer that also runs on Android, and today the nospeak Android shell talks to Amber via NIP-46 / Nostr Connect (bunker relays and BunkerSigner) for login and signing.

Because Amber and the nospeak Android shell run on the same device, using NIP-46 is unnecessarily slow and fragile: it depends on third-party relays, adds extra round trips and error modes, and duplicates capabilities that NIP-55 already standardizes for Android signers via Intents and ContentResolver.

## Goals / Non-Goals
- Goals:
  - Replace all Amber-on-Android authentication and signing flows that currently use NIP-46 with NIP-55-based interactions.
  - Treat Amber as an external signer reachable via Android APIs, not via relay-based connect sessions, while preserving the existing `Signer` interface inside the web client.
  - Prefer ContentResolver-based NIP-55 calls for high-volume or background operations when the user has granted "remember my choice", falling back to interactive Intents only when required.
  - Make the unauthenticated login screen behavior explicit: on Android, the "Login with Amber" button SHALL open Amber via NIP-55; NIP-46 is no longer used.
- Non-Goals:
  - Do not introduce a new web-based Amber login surface outside the Android app shell.
  - Do not change the semantics of local `nsec` login, NIP-07 extension login, or the local keypair generator beyond updating their relationship to the Amber option.
  - Do not change the core messaging protocol (gift wraps, relay selection, NIP-98 upload auth) beyond swapping the underlying signer implementation for Amber sessions.

## Decisions
- Use a single `amber` auth method to represent NIP-55-backed Amber sessions, replacing the existing `nip46` method for new logins and treating any persisted `nip46` sessions as invalid at restore time.
- Introduce a dedicated Capacitor plugin (e.g. `AndroidNip55Signer`) that owns all details of NIP-55 communication (Intents and ContentResolver), exposing a minimal RPC surface to the Svelte client (`getPublicKey`, `signEvent`, `nip44Encrypt`, `nip44Decrypt`, plus availability checks).
- Implement a `Nip55Signer` in the web client that conforms to the existing `Signer` interface and delegates to the Android plugin, so the rest of the messaging and NIP-98 code can remain agnostic to how signatures and ciphertexts are produced.
- Always use an Intent-based `get_public_key` call for initial Amber login so the user explicitly approves permissions, then prefer ContentResolver endpoints for subsequent `sign_event` / `nip44_encrypt` / `nip44_decrypt` operations when the signer indicates that automatic handling ("remember my choice") is available.
- When ContentResolver returns `null` (no automatic answer) or a `rejected` column, surface a clear error to the web layer and avoid repeatedly spamming the user with Intents when the signer has been configured to reject a given operation type.

## Risks / Trade-offs
- Relying on NIP-55 assumes that Amber (or any supported signer) correctly implements both Intent and ContentResolver endpoints as described; divergences may require signer-specific fallbacks or workarounds.
- Clearing legacy `nip46` sessions is a breaking change for existing Amber users: they will need to log in again after updating. This is mitigated by the new, faster NIP-55 flow and should be called out in release notes.
- Using ContentResolver reduces UI friction but makes the behavior more opaque to users (fewer explicit prompts). This risk is mitigated by relying on the signer’s own "remember my choice" UX and treating `rejected` results as a hard stop instead of falling back to Intents unprompted.

## Migration Plan
1. Land this spec change and communicate that NIP-55 is the only supported Amber integration path for the Android app shell going forward.
2. Implement the Android NIP-55 plugin and `Nip55Signer`, and wire them into `AuthService` with the new `amber` auth method, leaving the NIP-46 code path in place but unused for new logins.
3. Update `AuthService.restore` to:
   - Restore `amber` sessions via `Nip55Signer`.
   - Detect `nip46` sessions, clear their storage keys, and return `false` so the app shows the login screen.
4. Remove NIP-46-specific code and dependencies once the new NIP-55 path is stable and verified, ensuring that no remaining logic depends on bunker relays or Nostr Connect for Amber.
5. Perform end-to-end Android testing with Amber installed, including login, NIP-98 uploads, history sync, background messaging, and error/rejection paths, then ship the update and document the behavior change for Amber users.

## Open Questions
- Do we need to support any signer-specific quirks (for example, Amber-only ContentResolver URIs or permission types) beyond the base NIP-55 spec, or can we rely solely on the standard method names and columns?
- Should the web client attempt a one-time Intent fallback when ContentResolver returns `null` (no automatic answer) for a given operation, or should that behavior be controlled entirely by the plugin based on recent signer responses?
