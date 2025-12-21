## RENAMED Requirements
- FROM: `### Requirement: Android Media Upload via Remote NIP-98 Authenticated Endpoint`
- TO: `### Requirement: Android Media Upload via Blossom Servers`

## MODIFIED Requirements
### Requirement: Android Media Upload via Blossom Servers
When running inside the Android Capacitor app shell, the messaging experience SHALL upload selected media attachments using Blossom servers.

- If the user has one or more configured Blossom servers, the Android client SHALL upload to Blossom using `PUT /upload` and Blossom authorization (kind `24242`) as defined by the `messaging` Media Upload Support requirement.
- If the user has zero configured Blossom servers and initiates an upload, the Android client SHALL automatically configure the default Blossom server list `https://blossom.primal.net` and `https://24242.io`, SHALL display an in-app informational modal indicating these servers were set, and SHALL then upload using Blossom as normal.

#### Scenario: Android app uploads media via Blossom servers
- **GIVEN** the user has at least one configured Blossom server URL
- **WHEN** the user selects an image, video, or audio file and the upload is initiated
- **THEN** the Android client SHALL send a `PUT /upload` request to the first configured Blossom server with a valid Blossom authorization event (kind `24242`)
- **AND** upon successful upload, the returned blob URL SHALL be used by the messaging UI according to the `messaging` specification.

#### Scenario: Android app auto-configures Blossom servers when missing
- **GIVEN** the user has zero configured Blossom servers
- **WHEN** the user initiates a media upload
- **THEN** the client SHALL automatically set the Blossom servers to `https://blossom.primal.net` and `https://24242.io`
- **AND** the client SHALL display an informational modal indicating these servers were set automatically
- **AND** the upload SHALL proceed using Blossom servers.

#### Scenario: Android upload failure does not break messaging
- **WHEN** a Blossom server is unreachable or rejects the upload request
- **THEN** the Android client SHALL display a non-blocking error message indicating that the media upload failed
- **AND** the rest of the messaging UI (including text sending, history scrolling, and media rendering for previously uploaded content) SHALL continue to function normally.
