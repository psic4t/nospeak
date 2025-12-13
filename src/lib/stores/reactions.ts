import { writable, type Readable } from 'svelte/store';
import { get } from 'svelte/store';
import { reactionRepo, type Reaction } from '$lib/db/ReactionRepository';
import { currentUser } from '$lib/stores/auth';

export interface ReactionSummary {
    emoji: string;
    count: number;
    byCurrentUser: boolean;
}

interface InternalState {
    [targetEventId: string]: ReactionSummary[];
}

const { subscribe, update } = writable<InternalState>({});

function buildSummaries(reactions: Reaction[], currentUserNpub: string | null): ReactionSummary[] {
    const grouped = new Map<string, { count: number; byCurrentUser: boolean }>();

    for (const reaction of reactions) {
        const key = reaction.emoji;
        const existing = grouped.get(key) || { count: 0, byCurrentUser: false };
        existing.count += 1;
        if (currentUserNpub && reaction.authorNpub === currentUserNpub) {
            existing.byCurrentUser = true;
        }
        grouped.set(key, existing);
    }

    return Array.from(grouped.entries()).map(([emoji, value]) => ({
        emoji,
        count: value.count,
        byCurrentUser: value.byCurrentUser
    }));
}

function createReactionsStore() {
    async function refreshSummariesForTarget(targetEventId: string): Promise<void> {
        const reactions = await reactionRepo.getReactionsForTarget(targetEventId);
        let currentUserNpub: string | null = null;
        const value = get(currentUser);
        if (value && value.npub) {
            currentUserNpub = value.npub;
        }

        const summaries = buildSummaries(reactions, currentUserNpub);

        update(state => ({
            ...state,
            [targetEventId]: summaries
        }));
    }

    function applyReactionUpdate(reaction: Reaction): void {
        let currentUserNpub: string | null = null;
        const value = get(currentUser);
        if (value && value.npub) {
            currentUserNpub = value.npub;
        }

        update(state => {
            const existing = state[reaction.targetEventId] || [];
            const map = new Map<string, { count: number; byCurrentUser: boolean }>();

            for (const summary of existing) {
                map.set(summary.emoji, {
                    count: summary.count,
                    byCurrentUser: summary.byCurrentUser
                });
            }

            const current = map.get(reaction.emoji) || { count: 0, byCurrentUser: false };
            current.count += 1;
            if (currentUserNpub && reaction.authorNpub === currentUserNpub) {
                current.byCurrentUser = true;
            }
            map.set(reaction.emoji, current);

            const summaries: ReactionSummary[] = Array.from(map.entries()).map(([emoji, value]) => ({
                emoji,
                count: value.count,
                byCurrentUser: value.byCurrentUser
            }));

            return {
                ...state,
                [reaction.targetEventId]: summaries
            };
        });
    }

    function subscribeToMessageReactions(targetEventId: string, cb: (summaries: ReactionSummary[]) => void): () => void {
        return subscribe((state) => {
            cb(state[targetEventId] || []);
        });
    }

    return {
        subscribe: subscribe as Readable<InternalState>['subscribe'],
        refreshSummariesForTarget,
        applyReactionUpdate,
        subscribeToMessageReactions
    };
}

export const reactionsStore = createReactionsStore();
