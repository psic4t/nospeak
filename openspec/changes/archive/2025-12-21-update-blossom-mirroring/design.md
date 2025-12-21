# Design: Blossom Mirroring via BUD-04

## Context
nospeak supports multiple Blossom media servers and currently performs best-effort replication by re-uploading the encrypted blob (`PUT /upload`) to each configured server.

BUD-04 introduces a `PUT /mirror` endpoint that allows a destination server to fetch a blob from a source URL, while verifying the blob hash against the `x` tag in the (reused) upload authorization event.

## Goals
- Prefer BUD-04 mirroring (`PUT /mirror`) for replication to secondary Blossom servers.
- Preserve existing user-visible behavior:
  - The user gets a single primary URL returned from the first successful upload.
  - Replication remains best-effort and does not block sending the file message.
- Only fall back to re-upload when a server clearly does not support `/mirror`.

## Non-Goals
- Capability discovery or caching (for example, remembering that a server does not support `/mirror`).
- UI changes or settings changes.
- Server-side changes.

## Proposed Client Flow
1. Compute the blob sha256 (or use caller-provided sha256 for encrypted blobs).
2. Upload to Blossom servers in BUD-03 order:
   - Try `PUT /upload` sequentially until one succeeds.
   - Record the primary server and the returned blob descriptor, including its `url`.
3. Start concurrent, best-effort mirroring to remaining servers:
   - For each non-primary server, attempt `PUT /mirror` with body `{ "url": <primaryUrl> }`.
   - Attach the same Blossom upload authorization event (`t=upload`, `x=<sha256>`).
4. Fallback behavior (per-target):
   - If the `/mirror` request returns HTTP `404`, `405`, or `501`, treat the endpoint as unsupported and fall back to re-upload using `PUT /upload` (best-effort).
   - For all other failures (network errors, auth failures, 4xx/5xx not in the list), do not fall back; log and continue.

## Concurrency
Mirroring remains concurrent to minimize total replication time. One failing server MUST NOT prevent attempts to mirror to other servers.

## Error Handling
The upload/mirror helper should preserve HTTP status codes so the caller can distinguish “unsupported endpoint” from other failure classes.

## Security Notes
- Mirroring reuses the standard Blossom upload authorization event, which binds the request to a specific blob sha256 via the `x` tag.
- The destination server is responsible for downloading and verifying the blob per BUD-04.

## Compatibility
This design improves compatibility with Blossom servers that implement BUD-04 while remaining compatible with servers that only support `PUT /upload` via the explicit fallback for `404/405/501`.
