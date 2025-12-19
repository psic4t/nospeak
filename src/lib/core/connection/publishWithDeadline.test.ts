import { describe, expect, it, vi } from 'vitest';

import { publishWithDeadline, type RelayPublisher } from './publishWithDeadline';

function makePublisher(publishImpl: () => Promise<unknown>): RelayPublisher {
    return {
        publish: publishImpl,
    };
}

describe('publishWithDeadline', () => {
    it('reports success when relay publishes', async () => {
        const publisher = makePublisher(async () => 'ok');
        const connectionManager = {
            getRelayHealth: vi.fn().mockReturnValue({ relay: publisher, isConnected: true }),
        };

        const onRelaySuccess = vi.fn();

        const result = await publishWithDeadline({
            connectionManager,
            event: { id: 'event', kind: 1 } as any,
            relayUrls: ['wss://relay.example.com'],
            deadlineMs: 200,
            onRelaySuccess,
        });

        expect(result.successfulRelays).toEqual(['wss://relay.example.com']);
        expect(result.failedRelays).toEqual([]);
        expect(result.timedOutRelays).toEqual([]);
        expect(onRelaySuccess).toHaveBeenCalledWith('wss://relay.example.com');
    });

    it('reports timeout when relay never connects', async () => {
        const connectionManager = {
            getRelayHealth: vi.fn().mockReturnValue({ relay: null, isConnected: false }),
        };

        const result = await publishWithDeadline({
            connectionManager,
            event: { id: 'event', kind: 1 } as any,
            relayUrls: ['wss://relay.example.com'],
            deadlineMs: 50,
            pollIntervalMs: 10,
        });

        expect(result.successfulRelays).toEqual([]);
        expect(result.failedRelays).toEqual([]);
        expect(result.timedOutRelays).toEqual(['wss://relay.example.com']);
    });

    it('reports failure when publish rejects before deadline', async () => {
        const publisher = makePublisher(async () => {
            throw new Error('nope');
        });
        const connectionManager = {
            getRelayHealth: vi.fn().mockReturnValue({ relay: publisher, isConnected: true }),
        };

        const result = await publishWithDeadline({
            connectionManager,
            event: { id: 'event', kind: 1 } as any,
            relayUrls: ['wss://relay.example.com'],
            deadlineMs: 200,
        });

        expect(result.successfulRelays).toEqual([]);
        expect(result.failedRelays).toEqual(['wss://relay.example.com']);
        expect(result.timedOutRelays).toEqual([]);
    });
});
