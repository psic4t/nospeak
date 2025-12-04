import { db, type RetryItem } from '$lib/db/db';
import type { ConnectionManager } from './ConnectionManager';
import type { NostrEvent } from 'nostr-tools';
import { registerRelaySuccess } from '$lib/stores/sending';

export class RetryQueue {
    private connectionManager: ConnectionManager;
    private checkInterval: number = 1000;
    private timer: ReturnType<typeof setInterval> | null = null;
    private isProcessing: boolean = false;
    private debug: boolean = false;

    constructor(connectionManager: ConnectionManager, debug: boolean = false) {
        this.connectionManager = connectionManager;
        this.debug = debug;
    }

    public start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.processQueue(), this.checkInterval);
        if (this.debug) console.log('RetryQueue started');
    }

    public stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.debug) console.log('RetryQueue stopped');
    }

    public async enqueue(event: NostrEvent, relay: string) {
        const item: RetryItem = {
            event,
            targetRelay: relay,
            attempt: 0,
            maxAttempts: 5,
            nextAttempt: Date.now() + 1000,
            createdAt: Date.now()
        };
        await db.retryQueue.add(item);
        if (this.debug) console.log(`Enqueued retry for ${relay}, attempt 0`);
    }

    private async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const now = Date.now();
            const pending = await db.retryQueue.where('nextAttempt').belowOrEqual(now).toArray();

            for (const item of pending) {
                await this.processItem(item);
            }
        } catch (e) {
            console.error('Error processing retry queue:', e);
        } finally {
            this.isProcessing = false;
        }
    }

    private async processItem(item: RetryItem) {
        if (this.debug) console.log(`Processing retry for ${item.targetRelay}, attempt ${item.attempt + 1}`);

        const health = this.connectionManager.getRelayHealth(item.targetRelay);
        
        // If relay is no longer managed, drop the retry
        if (!health) {
             if (this.debug) console.log(`Relay ${item.targetRelay} no longer managed, removing retry`);
             if (item.id) await db.retryQueue.delete(item.id);
             return;
        }

        try {
            if (health.relay && health.isConnected) {
                 await health.relay.publish(item.event);
                 // Success
                  if (this.debug) console.log(`Retry successful for ${item.targetRelay}`);
                  if (item.id) await db.retryQueue.delete(item.id);

                  // Notify UI about per-relay publish success for this event
                  registerRelaySuccess(item.event.id, item.targetRelay);
             } else {
                throw new Error('Relay not connected');
            }
        } catch (e) {
            // Failed
            item.attempt++;
            if (item.attempt >= item.maxAttempts) {
                if (this.debug) console.log(`Max retries reached for ${item.targetRelay}, dropping`);
                if (item.id) await db.retryQueue.delete(item.id);
            } else {
                // Backoff
                const backoff = this.calculateBackoff(item.attempt);
                item.nextAttempt = Date.now() + backoff;
                if (item.id) await db.retryQueue.update(item.id, {
                    attempt: item.attempt,
                    nextAttempt: item.nextAttempt
                });
                if (this.debug) console.log(`Retry failed for ${item.targetRelay}, next attempt in ${backoff}ms`);
            }
        }
    }

    private calculateBackoff(attempt: number): number {
        const initial = 1000;
        const multiplier = 2;
        const max = 30000;
        
        // attempt starts at 1 (first failure)
        let delay = initial * Math.pow(multiplier, attempt - 1);
        
        if (delay > max) delay = max;
        return delay;
    }
}
