import type { Message } from '$lib/db/db';

type MessageGroup = {
    sortKey: number;
    items: Message[];
};

function isCaptionMessageCandidate(message: Message): boolean {
    return message.rumorKind === 14 && typeof message.parentRumorId === 'string' && message.parentRumorId.length > 0;
}

function findCaptionParent(allMessages: Message[], caption: Message): Message | null {
    const parentRumorId = caption.parentRumorId;
    if (!parentRumorId) {
        return null;
    }

    const parent = allMessages.find(
        (m) => m.rumorKind === 15 && m.rumorId === parentRumorId && m.direction === caption.direction,
    );

    return parent ?? null;
}

export function buildChatHistorySearchResults(allMessages: Message[], query: string): Message[] {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
        return [];
    }

    const needle = trimmed.toLowerCase();

    const matches = allMessages.filter((m) => (m.message || '').toLowerCase().includes(needle));

    const groups: MessageGroup[] = [];

    for (const match of matches) {
        if (isCaptionMessageCandidate(match)) {
            const parent = findCaptionParent(allMessages, match);
            if (parent) {
                groups.push({
                    sortKey: parent.sentAt,
                    items: [parent, match],
                });
            } else {
                groups.push({
                    sortKey: match.sentAt,
                    items: [match],
                });
            }
            continue;
        }

        groups.push({
            sortKey: match.sentAt,
            items: [match],
        });
    }

    groups.sort((a, b) => a.sortKey - b.sortKey);

    const seen = new Set<string>();
    const result: Message[] = [];

    for (const group of groups) {
        for (const message of group.items) {
            const eventId = message.eventId;
            if (!eventId || seen.has(eventId)) {
                continue;
            }
            seen.add(eventId);
            result.push(message);
        }
    }

    return result;
}
