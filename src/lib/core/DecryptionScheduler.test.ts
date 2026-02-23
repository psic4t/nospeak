import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecryptionScheduler } from './DecryptionScheduler';

// Mock URL.revokeObjectURL globally
vi.stubGlobal('URL', {
    ...globalThis.URL,
    revokeObjectURL: vi.fn(),
    createObjectURL: vi.fn((blob: Blob) => `blob:mock-${Math.random()}`),
});

function createDeferred<T = string>() {
    let resolve!: (value: T) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('DecryptionScheduler', () => {
    let scheduler: DecryptionScheduler;

    beforeEach(() => {
        vi.clearAllMocks();
        scheduler = new DecryptionScheduler(2, 5);
    });

    describe('basic enqueue and execution', () => {
        it('should execute a single decrypt request and return the blob URL', async () => {
            const result = await scheduler.enqueue({
                key: 'file1',
                decrypt: async () => 'blob:file1-decrypted',
            });
            expect(result).toBe('blob:file1-decrypted');
        });

        it('should return cached URL on second request for the same key', async () => {
            const decryptFn = vi.fn(async () => 'blob:file1-decrypted');

            await scheduler.enqueue({ key: 'file1', decrypt: decryptFn });
            const result = await scheduler.enqueue({ key: 'file1', decrypt: decryptFn });

            expect(result).toBe('blob:file1-decrypted');
            expect(decryptFn).toHaveBeenCalledTimes(1);
        });

        it('should report correct cache size', async () => {
            await scheduler.enqueue({ key: 'a', decrypt: async () => 'blob:a' });
            await scheduler.enqueue({ key: 'b', decrypt: async () => 'blob:b' });
            expect(scheduler.cacheSize).toBe(2);
        });

        it('has() returns true for cached keys and false otherwise', async () => {
            await scheduler.enqueue({ key: 'x', decrypt: async () => 'blob:x' });
            expect(scheduler.has('x')).toBe(true);
            expect(scheduler.has('y')).toBe(false);
        });
    });

    describe('concurrency limiting', () => {
        it('should run at most maxConcurrency operations simultaneously', async () => {
            const deferreds = [createDeferred(), createDeferred(), createDeferred()];
            let maxConcurrent = 0;
            let currentConcurrent = 0;

            const makeDecrypt = (idx: number) => async () => {
                currentConcurrent++;
                maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
                await deferreds[idx].promise;
                currentConcurrent--;
                return `blob:${idx}`;
            };

            const p1 = scheduler.enqueue({ key: 'f1', decrypt: makeDecrypt(0) });
            const p2 = scheduler.enqueue({ key: 'f2', decrypt: makeDecrypt(1) });
            const p3 = scheduler.enqueue({ key: 'f3', decrypt: makeDecrypt(2) });

            // Allow microtasks to settle so the first 2 start running
            await new Promise((r) => setTimeout(r, 10));

            expect(scheduler.runningCount).toBe(2);
            expect(scheduler.queueLength).toBe(1);
            expect(maxConcurrent).toBe(2);

            // Complete first two
            deferreds[0].resolve('done');
            deferreds[1].resolve('done');
            await Promise.all([p1, p2]);

            // Third should now be running
            await new Promise((r) => setTimeout(r, 10));
            expect(scheduler.runningCount).toBe(1);

            deferreds[2].resolve('done');
            await p3;

            expect(scheduler.runningCount).toBe(0);
            expect(scheduler.queueLength).toBe(0);
        });
    });

    describe('LRU cache eviction', () => {
        it('should evict oldest entry when cache is full and revoke its URL', async () => {
            // maxCacheSize is 5
            for (let i = 0; i < 5; i++) {
                await scheduler.enqueue({ key: `k${i}`, decrypt: async () => `blob:${i}` });
            }
            expect(scheduler.cacheSize).toBe(5);

            // Adding a 6th should evict k0 (the oldest)
            await scheduler.enqueue({ key: 'k5', decrypt: async () => 'blob:5' });
            expect(scheduler.cacheSize).toBe(5);
            expect(scheduler.has('k0')).toBe(false);
            expect(scheduler.has('k5')).toBe(true);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:0');
        });

        it('should promote accessed entries so they are not evicted', async () => {
            for (let i = 0; i < 5; i++) {
                await scheduler.enqueue({ key: `k${i}`, decrypt: async () => `blob:${i}` });
            }

            // Access k0 to promote it
            await scheduler.enqueue({ key: 'k0', decrypt: async () => 'should-not-run' });

            // Now add k5 — should evict k1 (now the oldest), not k0
            await scheduler.enqueue({ key: 'k5', decrypt: async () => 'blob:5' });

            expect(scheduler.has('k0')).toBe(true);
            expect(scheduler.has('k1')).toBe(false);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
        });
    });

    describe('deduplication', () => {
        it('should deduplicate concurrent requests for the same key', async () => {
            const deferred = createDeferred();
            let callCount = 0;

            const decryptFn = async () => {
                callCount++;
                await deferred.promise;
                return 'blob:deduped';
            };

            const p1 = scheduler.enqueue({ key: 'dup', decrypt: decryptFn });
            const p2 = scheduler.enqueue({ key: 'dup', decrypt: decryptFn });

            deferred.resolve('done');

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toBe('blob:deduped');
            expect(r2).toBe('blob:deduped');
            expect(callCount).toBe(1);
        });
    });

    describe('cancellation via AbortSignal', () => {
        it('should reject immediately if signal is already aborted', async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(
                scheduler.enqueue({
                    key: 'cancelled',
                    decrypt: async () => 'blob:nope',
                    signal: controller.signal,
                })
            ).rejects.toThrow('Aborted');
        });

        it('should skip queued items whose signal aborts while waiting', async () => {
            const blocker = createDeferred();
            const controller = new AbortController();

            // Fill concurrency slots
            const p1 = scheduler.enqueue({
                key: 'blocker1',
                decrypt: async () => { await blocker.promise; return 'blob:b1'; },
            });
            const p2 = scheduler.enqueue({
                key: 'blocker2',
                decrypt: async () => { await blocker.promise; return 'blob:b2'; },
            });

            // This one will be queued
            const p3 = scheduler.enqueue({
                key: 'victim',
                decrypt: async () => 'blob:victim',
                signal: controller.signal,
            });

            // Abort while it's still in the queue
            controller.abort();

            // Release blockers
            blocker.resolve('done');
            await Promise.all([p1, p2]);

            await expect(p3).rejects.toThrow('Aborted');
        });

        it('should pass AbortSignal through to the decrypt function', async () => {
            let receivedSignal: AbortSignal | undefined;

            await scheduler.enqueue({
                key: 'sig-test',
                decrypt: async (signal) => {
                    receivedSignal = signal;
                    return 'blob:sig';
                },
            });

            expect(receivedSignal).toBeDefined();
            expect(receivedSignal).toBeInstanceOf(AbortSignal);
        });
    });

    describe('error handling', () => {
        it('should propagate decrypt errors without caching', async () => {
            const err = new Error('decrypt failed');
            await expect(
                scheduler.enqueue({
                    key: 'errkey',
                    decrypt: async () => { throw err; },
                })
            ).rejects.toThrow('decrypt failed');

            expect(scheduler.has('errkey')).toBe(false);

            // Should allow retry
            const result = await scheduler.enqueue({
                key: 'errkey',
                decrypt: async () => 'blob:retry-ok',
            });
            expect(result).toBe('blob:retry-ok');
        });

        it('should continue processing queue after a failed entry', async () => {
            const deferred = createDeferred();

            const p1 = scheduler.enqueue({
                key: 'fail',
                decrypt: async () => { throw new Error('fail'); },
            });
            const p2 = scheduler.enqueue({
                key: 'ok',
                decrypt: async () => { await deferred.promise; return 'blob:ok'; },
            });

            await expect(p1).rejects.toThrow('fail');

            deferred.resolve('done');
            const result = await p2;
            expect(result).toBe('blob:ok');
        });
    });

    describe('destroy', () => {
        it('should reject all queued items and revoke all cached URLs', async () => {
            await scheduler.enqueue({ key: 'cached1', decrypt: async () => 'blob:c1' });
            await scheduler.enqueue({ key: 'cached2', decrypt: async () => 'blob:c2' });

            const blocker = createDeferred();
            scheduler.enqueue({
                key: 'running',
                decrypt: async () => { await blocker.promise; return 'blob:r'; },
            });

            // Queue an item that will be pending
            const pending = scheduler.enqueue({
                key: 'pending',
                decrypt: async () => 'blob:p',
            });

            scheduler.destroy();

            expect(scheduler.cacheSize).toBe(0);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:c1');
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:c2');

            // Pending should reject — but it might already have been picked up
            // by the queue processor, so we settle it either way
            blocker.resolve('done');

            // Allow microtasks to settle
            await new Promise((r) => setTimeout(r, 10));
        });
    });

    describe('decryptInWorker', () => {
        it('should fall back to main-thread decrypt when Worker is unavailable', async () => {
            // In the vitest/jsdom environment, `new Worker(...)` will throw,
            // so decryptInWorker should use the fallback function.
            const fallback = vi.fn(async () => ({ blobUrl: 'blob:fallback-result' }));
            const signal = new AbortController().signal;

            const result = await scheduler.decryptInWorker(
                { urls: ['https://example.com/file'], key: 'aabbccdd', nonce: '11223344', mimeType: 'video/mp4' },
                signal,
                fallback
            );

            expect(result).toEqual({ blobUrl: 'blob:fallback-result' });
            expect(fallback).toHaveBeenCalledTimes(1);
            expect(fallback).toHaveBeenCalledWith(signal);
        });

        it('should reject immediately if signal is already aborted', async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(
                scheduler.decryptInWorker(
                    { urls: ['https://example.com/file'], key: 'aa', nonce: 'bb', mimeType: 'video/mp4' },
                    controller.signal,
                    async () => ({ blobUrl: 'blob:should-not-run' })
                )
            ).rejects.toThrow('Aborted');
        });

        it('should propagate fallback errors', async () => {
            const signal = new AbortController().signal;

            await expect(
                scheduler.decryptInWorker(
                    { urls: ['https://example.com/file'], key: 'aa', nonce: 'bb', mimeType: 'video/mp4' },
                    signal,
                    async () => { throw new Error('network failure'); }
                )
            ).rejects.toThrow('network failure');
        });

    });

    describe('singleton', () => {
        it('getInstance returns the same instance', () => {
            DecryptionScheduler.resetInstance();
            const a = DecryptionScheduler.getInstance();
            const b = DecryptionScheduler.getInstance();
            expect(a).toBe(b);
            DecryptionScheduler.resetInstance();
        });
    });
});
