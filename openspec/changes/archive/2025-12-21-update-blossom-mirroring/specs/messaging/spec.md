## MODIFIED Requirements

### Requirement: Media Upload Support
The system SHALL allow users to upload images, videos, and MP3 audio files as encrypted attachments in NIP-17 conversations.

Uploads SHALL be performed using Blossom servers:
- If the user has one or more configured Blossom servers, the client SHALL upload the encrypted blob to Blossom servers using BUD-03 server ordering and Blossom authorization events (kind `24242`) as defined by BUD-01/BUD-02.
- If the user has zero configured Blossom servers and attempts an upload, the client SHALL automatically configure the default Blossom server list `https://blossom.primal.net` and `https://24242.io`, SHALL display an in-app informational modal indicating these servers were set, and SHALL then upload using Blossom as normal.

When Blossom uploads are used:
- The client MUST attempt to upload the blob to at least the first configured Blossom server.
- After the first successful upload, the client SHOULD attempt to mirror the blob to the remaining configured servers using BUD-04 `PUT /mirror` with the origin blob `url` in the request body.
- Mirroring SHOULD be best-effort and MUST NOT block the message send that depends on the primary upload.
- If a target Blossom server responds to `PUT /mirror` with HTTP `404`, `405`, or `501`, the client MAY fall back to re-uploading the blob to that server using `PUT /upload` on a best-effort basis.

#### Scenario: Client mirrors to a secondary Blossom server using BUD-04
- **GIVEN** the user has at least two configured Blossom server URLs
- **WHEN** the client uploads an encrypted blob to the first server using `PUT /upload` and receives a blob descriptor with a `url`
- **THEN** the client SHOULD send `PUT /mirror` to the second server with JSON body `{ "url": <primary url> }`
- **AND** the request SHOULD include a valid Blossom authorization event (kind `24242` with `t=upload` and an `x` tag matching the blob’s SHA-256)
- **AND** any failure to mirror MUST NOT prevent sending the file message using the primary server `url`.

#### Scenario: Mirror endpoint unsupported triggers fallback upload
- **GIVEN** the user has at least two configured Blossom server URLs
- **AND** the secondary server responds to `PUT /mirror` with HTTP `404`, `405`, or `501`
- **WHEN** the client attempts best-effort mirroring
- **THEN** the client MAY fall back to uploading the blob to the secondary server using `PUT /upload`.

#### Scenario: Mirror endpoint auth failure does not trigger fallback upload
- **GIVEN** the user has at least two configured Blossom server URLs
- **AND** the secondary server responds to `PUT /mirror` with HTTP `401` or `403`
- **WHEN** the client attempts best-effort mirroring
- **THEN** the client MUST NOT fall back to re-uploading the blob to that server.
