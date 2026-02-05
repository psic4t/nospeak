import { db, type Reaction } from './db';

export type { Reaction };

export class ReactionRepository {
    public async upsertReaction(reaction: Omit<Reaction, 'id'>): Promise<void> {
        const existing = await db.reactions
            .where('[targetEventId+authorNpub+emoji]')
            .equals([reaction.targetEventId, reaction.authorNpub, reaction.emoji])
            .first();

        if (existing && existing.id !== undefined) {
            await db.reactions.update(existing.id, {
                reactionEventId: reaction.reactionEventId,
                createdAt: reaction.createdAt
            });
            return;
        }

        await db.reactions.add(reaction);
    }

    public async getReactionsForTarget(targetEventId: string): Promise<Reaction[]> {
        return db.reactions
            .where('targetEventId')
            .equals(targetEventId)
            .toArray();
    }

    public async hasReaction(reactionEventId: string): Promise<boolean> {
        const count = await db.reactions.where('reactionEventId').equals(reactionEventId).count();
        return count > 0;
    }

    public async hasReactionByContent(targetEventId: string, authorNpub: string, emoji: string): Promise<boolean> {
        const count = await db.reactions
            .where('[targetEventId+authorNpub+emoji]')
            .equals([targetEventId, authorNpub, emoji])
            .count();
        return count > 0;
    }
}

export const reactionRepo = new ReactionRepository();
