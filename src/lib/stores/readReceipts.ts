import { writable } from 'svelte/store';

interface ReadReceiptState {
    [conversationId: string]: {
        targetRumorId: string;
        targetSentAt: number;  // sentAt of the message the ✓ targets
    };
}

export const readReceiptsStore = writable<ReadReceiptState>({});

export function updateReadReceipt(conversationId: string, targetRumorId: string, targetSentAt: number): void {
    readReceiptsStore.update(state => {
        const existing = state[conversationId];
        if (existing && existing.targetSentAt >= targetSentAt) return state;
        return { ...state, [conversationId]: { targetRumorId, targetSentAt } };
    });
}
