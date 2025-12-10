# Change: Add MP3 media upload and waveform playback

## Why
Users want to share music and other audio clips in chat, and to play them back inline without leaving the conversation. The existing media pipeline only supports images and videos and does not provide an audio-specific experience.

## What Changes
- Extend the messaging media upload capability to support MP3 audio files via the existing canonical upload endpoint and NIP-98 authorization.
- Update messaging requirements so that the media upload affordance offers a "Music" option, scoped to MP3 files, alongside Image and Video.
- Define how MP3 media URLs are rendered in chat as a compact audio player that visualizes a simple waveform and exposes play/pause controls.

## Impact
- Affected specs: `messaging` (Media Upload Support and media display behavior).
- Affected code: media upload API route (`/api/upload`), user media serving route (`/user_media/[filename]`), chat message input media picker, and message rendering for media URLs.
- No new external services are required; audio processing is limited to lightweight client-side waveform visualization.
