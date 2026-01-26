## ADDED Requirements

### Requirement: Android Media Cache via MediaStore
When running inside the Android Capacitor app shell with the Media Cache setting enabled, the app SHALL cache decrypted media to the device gallery using the Android MediaStore API. Cached media SHALL be stored in app-branded folders (`Pictures/nospeak/`, `Movies/nospeak/`, `Music/nospeak/`) and SHALL be queryable by SHA-256 content hash for fast lookup on subsequent views.

#### Scenario: Decrypted image is cached to gallery after viewing
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Media Cache setting is enabled in Settings → Media Servers
- **AND** the user views an image from a Kind 15 encrypted file message that has been decrypted for display
- **WHEN** the decrypted image is rendered in the chat or image viewer
- **THEN** the Android shell SHALL save the decrypted image to MediaStore under `Pictures/nospeak/`
- **AND** the file SHALL be named using a prefix derived from the SHA-256 content hash to enable cache lookup
- **AND** the image SHALL appear in the device gallery app in a "nospeak" album.

#### Scenario: Decrypted video is cached to gallery after viewing
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Media Cache setting is enabled in Settings → Media Servers
- **AND** the user views a video from a Kind 15 encrypted file message that has been decrypted for playback
- **WHEN** the decrypted video is rendered in the chat or media viewer
- **THEN** the Android shell SHALL save the decrypted video to MediaStore under `Movies/nospeak/`
- **AND** the file SHALL be named using a prefix derived from the SHA-256 content hash
- **AND** the video SHALL appear in the device gallery app.

#### Scenario: Decrypted audio is cached to gallery after viewing
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Media Cache setting is enabled in Settings → Media Servers
- **AND** the user plays an audio file from a Kind 15 encrypted file message that has been decrypted
- **WHEN** the decrypted audio is played
- **THEN** the Android shell SHALL save the decrypted audio to MediaStore under `Music/nospeak/`
- **AND** the file SHALL be named using a prefix derived from the SHA-256 content hash.

#### Scenario: Cached media is loaded without network fetch
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Media Cache setting is enabled
- **AND** a media file with a given SHA-256 hash has previously been cached to MediaStore
- **WHEN** the user views the same media again (identified by matching SHA-256 hash in the message)
- **THEN** the Android shell SHALL query MediaStore for a file matching the hash prefix
- **AND** if found, SHALL load the media directly from the local file without fetching from Blossom servers
- **AND** SHALL skip the blurhash placeholder animation for cached media.

#### Scenario: Cache miss falls back to network fetch
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Media Cache setting is enabled
- **AND** no cached file matching the SHA-256 hash exists in MediaStore
- **WHEN** the user views the media
- **THEN** the Android shell SHALL fetch and decrypt the media from Blossom servers as normal
- **AND** SHALL display the blurhash placeholder during loading
- **AND** SHALL cache the decrypted media after successful load.

#### Scenario: Media Cache disabled does not cache or check cache
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Media Cache setting is disabled in Settings → Media Servers
- **WHEN** the user views any media
- **THEN** the Android shell SHALL NOT query MediaStore for cached media
- **AND** SHALL NOT save decrypted media to MediaStore
- **AND** SHALL fetch from Blossom servers with blurhash placeholder as normal.

#### Scenario: Disabling Media Cache leaves existing cached files
- **GIVEN** the user has previously enabled Media Cache and cached media exists in `Pictures/nospeak/` or other nospeak MediaStore folders
- **WHEN** the user disables the Media Cache toggle in Settings → Media Servers
- **THEN** existing cached files SHALL remain in the device gallery
- **AND** the user MAY delete them manually using their gallery app
- **AND** the app SHALL NOT automatically delete cached files.

### Requirement: Android Media Cache Permissions
When running inside the Android Capacitor app shell with the Media Cache setting enabled, the app SHALL request appropriate MediaStore permissions for reading cached media on Android 13+ devices.

#### Scenario: Media cache requests permissions on Android 13+
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on Android 13 or later
- **AND** the user enables the Media Cache toggle in Settings → Media Servers
- **WHEN** the app attempts to query or write to MediaStore for caching
- **THEN** the app SHALL request READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, and READ_MEDIA_AUDIO permissions as needed
- **AND** SHALL handle permission denial gracefully by falling back to network-only behavior without crashing.

#### Scenario: Media cache works with legacy permissions on Android 12 and below
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on Android 12 or earlier
- **AND** the Media Cache setting is enabled
- **WHEN** the app reads or writes media to MediaStore
- **THEN** the app SHALL use READ_EXTERNAL_STORAGE and WRITE_EXTERNAL_STORAGE permissions as currently configured
- **AND** caching behavior SHALL function as specified.
