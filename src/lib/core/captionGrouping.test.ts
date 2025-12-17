import { describe, it, expect } from 'vitest';
import type { Message } from '$lib/db/db';
import { isCaptionMessage, getCaptionForParent } from './captionGrouping';

function baseMessage(overrides: Partial<Message>): Message {
  return {
    recipientNpub: 'npub1test',
    message: '',
    sentAt: Date.now(),
    eventId: overrides.eventId ?? 'event-' + Math.random().toString(36).slice(2),
    direction: overrides.direction ?? 'sent',
    createdAt: Date.now(),
    ...overrides
  };
}

describe('captionGrouping helpers', () => {
  it('identifies a caption message for a preceding Kind 15 file', () => {
    const fileRumorId = 'file-rumor-id';

    const messages: Message[] = [
      baseMessage({
        message: '',
        rumorKind: 15,
        rumorId: fileRumorId
      }),
      baseMessage({
        message: 'caption text',
        rumorKind: 14,
        parentRumorId: fileRumorId
      })
    ];

    expect(isCaptionMessage(messages, 0)).toBe(false);
    expect(isCaptionMessage(messages, 1)).toBe(true);

    const caption = getCaptionForParent(messages, 0);
    expect(caption).not.toBeNull();
    expect(caption?.message).toBe('caption text');
  });

  it('does not treat non-adjacent replies as captions', () => {
    const fileRumorId = 'file-rumor-id-2';

    const messages: Message[] = [
      baseMessage({ rumorKind: 15, rumorId: fileRumorId }),
      baseMessage({ rumorKind: 14, message: 'unrelated text' }),
      baseMessage({ rumorKind: 14, parentRumorId: fileRumorId, message: 'late caption' })
    ];

    expect(isCaptionMessage(messages, 1)).toBe(false);
    expect(isCaptionMessage(messages, 2)).toBe(false);
    expect(getCaptionForParent(messages, 0)).toBeNull();
  });

  it('requires same direction for caption and parent', () => {
    const fileRumorId = 'file-rumor-id-3';

    const messages: Message[] = [
      baseMessage({ rumorKind: 15, rumorId: fileRumorId, direction: 'sent' }),
      baseMessage({ rumorKind: 14, parentRumorId: fileRumorId, direction: 'received', message: 'wrong side' })
    ];

    expect(isCaptionMessage(messages, 1)).toBe(false);
    expect(getCaptionForParent(messages, 0)).toBeNull();
  });
});
