## Context

The current media upload system supports images, videos, and audio files through a dropdown menu in the chat interface. Files are encrypted client-side with AES-256-GCM before uploading to Blossom servers, then sent as NIP-17 kind 15 file messages with decryption metadata in tags.

Users need to share arbitrary file types (PDFs, documents, archives) with the same encryption guarantees. The existing infrastructure (encryption, Blossom upload, message format) can be reused with minimal changes.

## Goals / Non-Goals

**Goals:**
- Allow uploading any file type up to 10 MB
- Display generic files in chat with recognizable icons based on file extension
- Auto-detect media files selected through the generic picker and route to existing previews
- Provide one-click download that decrypts on-the-fly

**Non-Goals:**
- In-chat file preview (PDF viewer, text preview, etc.)
- File name preservation in the message (URLs don't contain filenames)
- Streaming large file downloads (entire file decrypts in memory)
- Thumbnail generation for non-media files

## Decisions

### 1. File Type Detection Strategy

Detect actual media type when user selects a file via the "File" option by checking both MIME type and file extension. If detected as image/video/audio, automatically route to the existing media preview flow.

**Rationale:** Users may not realize they should use specific media options. Auto-detection provides seamless UX while leveraging existing, optimized media handling with blurhash previews and proper rendering.

**Alternatives considered:**
- MIME-only detection: Rejected because some files have generic MIME types (e.g., `application/octet-stream`) but recognizable extensions
- Always use generic flow: Rejected because it would lose media-specific features (previews, dimensions, blurhash)

### 2. File Size Limit: 10 MB

Enforce a 10 MB limit for generic files, validated client-side before upload.

**Rationale:** Balances utility (most common documents are under 10 MB) with practical constraints (memory usage during encryption/decryption, Blossom server limits, mobile bandwidth).

**Alternatives considered:**
- No limit: Rejected due to memory issues with in-memory encryption
- Smaller limit (5 MB): Rejected as too restrictive for common use cases (PDFs, presentations)
- Larger limit (50+ MB): Rejected due to decryption performance on mobile

### 3. Extension-Specific Icons via Utility Function

Create a utility function `getFileIconInfo(mimeType)` that returns SVG markup, color class, and label for common file types. Icons are inline SVGs (no external assets).

**Rationale:** Keeps icons self-contained, supports theming via CSS classes, and allows easy extension for new file types.

**File types to support:**
| Pattern | Label | Icon Style |
|---------|-------|------------|
| `application/pdf` | PDF | Document red |
| `application/zip`, `x-rar`, `x-7z` | ZIP/RAR/7Z | Archive yellow |
| `msword`, `wordprocessingml` | DOC | Document blue |
| `ms-excel`, `spreadsheetml` | XLS | Grid green |
| `ms-powerpoint`, `presentationml` | PPT | Slides orange |
| `text/plain` | TXT | Plain document |
| `text/html`, `javascript`, `json` | Code | Brackets purple |
| Default | FILE | Generic gray |

### 4. Download Trigger Mechanism

Use a hidden `<a>` element with `download` attribute, populated with blob URL from decrypted content.

**Rationale:** Standard browser API, works across platforms, doesn't require server-side download headers.

**Alternatives considered:**
- `window.open()`: Rejected because it opens a new tab instead of downloading
- FileSaver.js library: Rejected as unnecessary dependency for simple use case

### 5. Display Information

Show file extension (derived from MIME type) and human-readable size. No filename shown because:
- Filename is not stored in message tags
- URL hash doesn't contain filename
- Consistent with existing media display (no filename shown for images/videos)

**Alternatives considered:**
- Add `filename` tag to message: Rejected per user requirement (can't store filename)
- Extract from URL: Not possible (Blossom URLs use content hash)

## Risks / Trade-offs

- **Memory usage during decryption** → Mitigated by 10 MB limit; future: streaming decryption
- **MIME type misdetection** → Mitigated by extension fallback; worst case: shows generic icon
- **Large file downloads on slow connections** → User must wait for full decrypt; no progress indicator initially
- **Unknown file extensions show generic icon** → Acceptable; covers vast majority of common files

## Migration Plan

No migration needed. New feature is additive:
1. Deploy updated components
2. Existing messages unaffected
3. New file messages use same kind 15 format with different `file-type` values

## Open Questions

None - all design decisions made based on user requirements.
