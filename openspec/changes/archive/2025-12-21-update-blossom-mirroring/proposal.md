# Change: Update Blossom mirroring to use BUD-04 `/mirror`

## Why
nospeak currently performs best-effort “mirroring” to additional configured Blossom servers by re-uploading the full blob to each server. BUD-04 defines a dedicated `/mirror` endpoint that allows servers to fetch blobs from an origin URL instead, reducing client bandwidth and aligning with Blossom’s intended replication flow.

## What Changes
- After the first successful Blossom upload (`PUT /upload`) the client SHALL treat the returned blob `url` as the origin.
- For each remaining configured Blossom server, the client SHOULD attempt to mirror the blob using BUD-04 `PUT /mirror` with the origin `url` and the same Blossom upload authorization event (kind `24242`).
- Mirroring SHALL remain best-effort and non-blocking: failures MUST NOT prevent the message send that depends on the primary upload.
- If a target Blossom server clearly does not support BUD-04 mirroring (HTTP `404`, `405`, or `501`), the client MAY fall back to re-uploading the blob to that server using `PUT /upload` (best-effort).

## Impact
- Affected specs:
  - `messaging` (clarify replication behavior as BUD-04 mirroring)
- Affected code (anticipated):
  - `src/lib/core/BlossomUpload.ts` (implement `PUT /mirror` + fallback)
  - `src/lib/core/Messaging.ts` (indirectly; continues to call upload helper)
  - New test coverage in `src/lib/core` for mirroring behavior
