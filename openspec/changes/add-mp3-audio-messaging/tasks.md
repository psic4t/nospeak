## 1. Implementation
- [x] 1.1 Update messaging specs to cover MP3 media upload and inline audio playback.
- [x] 1.2 Extend the upload API to accept validated MP3 files as an `audio` media type with a reasonable size limit and correct file extension.
- [x] 1.3 Ensure the user_media serving route returns the proper `audio/mpeg` content type for `.mp3` files.
- [x] 1.4 Expose a "Music" (MP3) option in the chat media upload UI that uploads audio via the canonical endpoint and inserts the resulting URL into the message input.
- [x] 1.5 Render message content URLs ending in `.mp3` as a compact audio player with a simple waveform visualization and basic playback controls.
- [x] 1.6 Add or update unit tests for media URL classification, upload validation, and audio rendering behavior.
- [x] 1.7 Run `npm run check` and `npx vitest run` and address any test or type failures.
