import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager, DefaultRetryConfig } from './ConnectionManager';

vi.mock('nostr-tools', () => {
    return {
        Relay: {
            connect: vi.fn()
        }
    };
});

describe('ConnectionManager', () => {
    let cm: ConnectionManager;

    beforeEach(() => {
        vi.useFakeTimers();
        cm = new ConnectionManager(DefaultRetryConfig, false);
    });

    afterEach(() => {
        cm.stop();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('should add a persistent relay', () => {
        const url = 'wss://relay.example.com';
        cm.addPersistentRelay(url);
        const health = cm.getRelayHealth(url);
        expect(health).toBeDefined();
        expect(health?.url).toBe(url);
    });

    it('should track consecutive failures', () => {
        const cmAny = cm as any;
        const url = 'wss://fail.com';
        cm.addPersistentRelay(url);
        
        cmAny.markRelayFailure(url);
        expect(cm.getRelayHealth(url)?.consecutiveFails).toBe(1);
        
        cmAny.markRelayFailure(url);
        expect(cm.getRelayHealth(url)?.consecutiveFails).toBe(2);
    });

    it('applies more conservative backoff in background mode', () => {
        const cmAny = cm as any;
        const normalBackoff = cmAny.calculateBackoff(3);
        cmAny.setBackgroundModeEnabled(true);
        const backgroundBackoff = cmAny.calculateBackoff(3);
        expect(backgroundBackoff).toBeGreaterThanOrEqual(normalBackoff);
        
        cmAny.setBackgroundModeEnabled(false);
        const restoredBackoff = cmAny.calculateBackoff(3);
        expect(restoredBackoff).toBe(normalBackoff);
    });
});
