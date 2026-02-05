import type { Message } from '$lib/db/db';

export function buildChatHistorySearchResults(allMessages: Message[], query: string): Message[] {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
        return [];
    }

    const needle = trimmed.toLowerCase();

    return allMessages
        .filter((m) => (m.message || '').toLowerCase().includes(needle))
        .sort((a, b) => a.sentAt - b.sentAt);
}
