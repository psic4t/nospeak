## Context
nospeak currently supports media uploads via a SvelteKit `/api/upload` route that writes files into a `user_media` directory and returns a public URL rendered in messages. Uploads are anonymous and depend on the app sharing an origin with the SvelteKit server, which breaks when the Android Capacitor shell loads the UI from local assets. There is also no explicit authentication or binding between media uploads and a Nostr identity.

## Goals / Non-Goals
- Goals:
  - Require every media upload to carry a per-request proof of control over a Nostr key using NIP-98.
  - Use a single canonical HTTPS upload endpoint `https://nospeak.chat/api/upload` for both web and Android.
  - Keep the existing media storage model (UUID filenames under `user_media`) and display semantics intact.
  - Enable the Android app shell to upload media to the hosted nospeak server regardless of its WebView origin.
- Non-Goals:
  - Introduce a traditional user database or long-lived server-side sessions.
  - Change how messages reference media URLs or how media is rendered in chat bubbles.
  - Implement additional rate limiting or quota enforcement beyond what already exists (these can be added later if needed).

## Decisions
- Use NIP-98 per-request HTTP authentication for media uploads, with events of `kind=27235` carrying `u` and `method` tags and an empty content field.
- Fix the canonical upload URL in specs and implementation to `https://nospeak.chat/api/upload`, and require NIP-98 `u` tags to match this exact URL.
- Accept uploads only when the server can verify the NIP-98 event signature, the method tag is `POST`, and `created_at` is within a short bounded window (for example ±5 minutes).
- Add wildcard CORS headers to `/api/upload` so the Android Capacitor WebView can POST to `https://nospeak.chat/api/upload` even when its origin is not `https://nospeak.chat`.
- Require that all supported clients (web and Android) attach NIP-98 Authorization headers for uploads once this change is applied; anonymous uploads are out of scope for the secured endpoint.

## Alternatives Considered
- **Anonymous uploads with only MIME/size validation**: simple but does not bind uploads to any Nostr identity and leaves the endpoint more susceptible to abuse; also does not address Android cross-origin constraints explicitly.
- **Server-issued short-lived upload tickets**: a ticket-based flow (client signs once to obtain a ticket, then reuses it for several uploads) would reduce repeated signing cost, but adds protocol complexity and state to the client. For now, per-request signing is sufficient and simpler to implement.
- **Auth tokens stored server-side**: would require introducing a user/session concept and storage, which conflicts with the desire to stay close to Nostr's serverless identity model.

## Risks / Trade-offs
- Requiring NIP-98 for uploads will break any existing upload flows that do not send a valid Authorization header; rollout must be coordinated so that updated clients are deployed before or alongside the secured endpoint.
- NIP-07/browser extensions and Amber/NIP-46 sessions may prompt users when signing NIP-98 events for uploads, which could add friction for frequent media senders; this can be mitigated with client-side UX patterns and signer permissions.
- Using wildcard CORS (`Access-Control-Allow-Origin: *`) for `/api/upload` simplifies Android integration but increases the importance of strict NIP-98 validation and server-side limits to protect against abuse.

## Migration Plan
- Implement NIP-98 verification and CORS support on `/api/upload` behind feature flags or environment controls if needed.
- Update the web client to always upload via `https://nospeak.chat/api/upload` with NIP-98 Authorization headers, and verify that desktop web flows continue to work.
- Update and test the Android app shell to use the same canonical endpoint and header semantics for uploads.
- Once updated clients are deployed and validated, treat unauthenticated uploads as unsupported and rely on NIP-98 enforcement in production.

## Open Questions
- Do we want different upload size limits for authenticated vs unauthenticated environments, or keep a single global limit defined by the server implementation?
- Should the server log the `pubkey` associated with each successful upload for operational observability or abuse response, even if it does not maintain a user database?
- Is additional server-side rate limiting (per IP or per pubkey) required at launch, or can it be added reactively if abuse is observed?
