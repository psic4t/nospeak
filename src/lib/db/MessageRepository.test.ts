import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageRepo } from './MessageRepository';

describe('MessageRepository pagination helpers', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('getConversationPage delegates to getMessages with provided cursor and page size', async () => {
        const spy = vi.spyOn(messageRepo, 'getMessages').mockResolvedValue([] as any);
        const cursor = 1700000000000;

        await messageRepo.getConversationPage('npub1test', 25, cursor);

        expect(spy).toHaveBeenCalledWith('npub1test', 25, cursor);
    });

    it('getConversationPage uses default page size when not provided', async () => {
        const spy = vi.spyOn(messageRepo, 'getMessages').mockResolvedValue([] as any);

        await messageRepo.getConversationPage('npub1default');

        expect(spy).toHaveBeenCalledWith('npub1default', 50, undefined);
    });
});
