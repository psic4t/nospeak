## Context

File message captions are currently implemented using a two-message approach:
1. A kind 15 file message is sent with the encrypted file URL and metadata
2. A separate kind 14 text message is sent with an `['e', parentRumorId]` tag linking to the file

This requires complex grouping logic (`captionGrouping.ts`) to identify caption messages and link them to their parent files for rendering. Other clients like Amethyst use the simpler NIP-31 `alt` tag approach, embedding the caption directly in the kind 15 message.

## Goals / Non-Goals

**Goals:**
- Simplify caption handling to a single message with `['alt', caption]` tag
- Remove caption grouping logic and associated tests
- Maintain the same visual rendering of captions below media files
- Improve interoperability with other Nostr clients

**Non-Goals:**
- Backward compatibility with old two-message captions (clean break)
- Migrating existing caption messages to the new format
- Supporting both approaches simultaneously

## Decisions

### 1. Use `alt` tag for captions (NIP-31)

The `alt` tag is defined in NIP-31 as "a short human-readable plaintext summary" for custom event kinds. This is exactly what captions are - a human-readable description of the file content.

**Structure:**
```json
{
  "kind": 15,
  "content": "https://example.com/encrypted_file.jpg",
  "tags": [
    ["p", "<recipient>"],
    ["file-type", "image/jpeg"],
    ["alt", "Photo of sunset at the beach"],
    // ... other file tags
  ]
}
```

**Alternatives considered:**
- Keep two-message approach: Rejected because it's unnecessarily complex and not how other clients do it
- Use `content` field for caption: Rejected because `content` is already used for the file URL

### 2. Store caption in `message` field

When receiving kind 15 messages, extract the `alt` tag value and store it in the existing `message` field of the Message interface. This avoids schema changes and leverages existing search functionality.

**Alternatives considered:**
- Add new `fileCaption` field: Rejected because it adds unnecessary schema complexity and search would need to check both fields

### 3. Clean break for backward compatibility

Old caption messages (kind 14 with `parentRumorId` pointing to a kind 15 message) will appear as regular text messages. No migration or dual-support.

**Alternatives considered:**
- Support both old and new approaches: Rejected to keep code simple; user preference was for clean break

## Risks / Trade-offs

- **Orphaned caption messages**: Old caption messages will appear as standalone text messages → Acceptable given clean break decision
- **Interoperability**: Some clients might not read `alt` tags → They'll just not show captions, which is acceptable degradation

## Open Questions

None - all decisions made.
