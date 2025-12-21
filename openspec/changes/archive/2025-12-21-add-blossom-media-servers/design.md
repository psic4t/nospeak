## Context
nospeak currently uploads media to the canonical nospeak endpoint (`https://nospeak.chat/api/upload`) using NIP-98 authorization. Users want to instead upload to Blossom servers (Nostr media servers) and manage their server list via Nostr.

Blossom server selection and upload semantics are defined by:
- BUD-03: User Server List (`kind:10063` with ordered `server` tags)
- BUD-01/BUD-02: Authorization events (kind `24242`) and `PUT /upload` behavior

## Goals / Non-Goals
- Goals:
  - Allow users to configure and publish a Blossom server list.
  - Allow users to select upload backend for **all uploads** (profile picture/banner + chat attachments).
  - Implement Blossom uploads with correct auth and mirroring behavior.
  - Preserve existing behavior when Blossom is not enabled or not configured.
- Non-Goals:
  - Implementing server-side Blossom endpoints.
  - Changing message rendering rules beyond using a different uploaded URL.
  - Adding paid Blossom flows (BUD-07) unless required by basic upload errors.

## Decisions
- Decision: Store Blossom server list in the local Profile cache.
  - We will extend the IndexedDB `Profile` record to include `mediaServers: string[]`.
  - `ProfileResolver` will request `kind:10063` events alongside existing profile/relay kinds and cache the ordered server list.

- Decision: Publish `kind:10063` using the same relay fanout strategy as Messaging Relay settings.
  - Use discovery relays, a “blaster” relay, currently connected relays, and configured relays (matching the behavior in `RelaySettingsService`).

- Decision: Upload backend selection is per-device setting.
  - Store a per-device flag in `localStorage` (similar to existing Settings toggles).
  - The “Use Blossom servers” toggle is disabled when the cached/configured server list is empty.

- Decision: Blossom uploads use BUD-02 `PUT /upload` with Blossom auth events.
  - Requests send the raw binary body (not multipart form uploads).
  - Authorization uses kind `24242` with tags:
    - `t=upload`
    - `x=<sha256 hex of request body>`
    - `expiration=<unix seconds>`
  - The signed event JSON is base64 encoded and sent as `Authorization: Nostr <token>`.

- Decision: Mirroring behavior.
  - When Blossom mode is enabled and servers exist, the client uploads to the first server and uses that returned descriptor `url` as the canonical URL inserted into messages/profile metadata.
  - The client then performs best-effort uploads (or mirror uploads where applicable) to remaining servers.
  - Mirroring failures are non-blocking; the primary upload’s success is sufficient for user-visible completion.

## Risks / Trade-offs
- Blossom server implementations may vary (e.g., require auth for HEAD /upload checks, custom limits).
  - Mitigation: keep initial implementation minimal: try `PUT /upload`, surface `X-Reason` when present, and fall back to next server on failure.
- Additional DB migration risk by extending Profile schema.
  - Mitigation: use a Dexie version bump and preserve existing fields.

## Migration Plan
- Existing users default to “Local uploads”.
- Users with no media servers configured will see Blossom toggle disabled.
- Enabling Blossom mode is opt-in and does not require data migration beyond storing the toggle state.

## Open Questions
- None (behavior has been confirmed: applies to all uploads, mirror to all servers, disable toggle when no servers, publish `kind:10063` to same relay set as relay settings).
