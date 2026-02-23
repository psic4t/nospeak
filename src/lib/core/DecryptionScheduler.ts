/**
 * DecryptionScheduler — concurrency-limited media decryption with LRU cache.
 *
 * Prevents scroll-stuttering and ANR on Android by:
 * 1. Limiting concurrent decrypt operations (default 2)
 * 2. Caching decrypted blob URLs in an LRU map (revokes on eviction)
 * 3. Supporting cancellation via AbortSignal for items scrolled out of view
 * 4. Offloading fetch + decrypt + Blob creation to a Web Worker (zero large
 *    buffer transfers on the main thread)
 */

export interface DecryptRequest {
    /** Unique cache key — typically the encrypted file URL */
    key: string;
    /** The async function that fetches + decrypts + returns a blob URL */
    decrypt: (signal: AbortSignal) => Promise<string>;
    /** Signal to cancel this request when the consumer no longer needs it */
    signal?: AbortSignal;
}

export interface WorkerDecryptParams {
    url: string;
    key: string;
    nonce: string;
    mimeType: string;
}

export interface WorkerDecryptResult {
    blobUrl: string;
}

interface WorkerResponseHandler {
    resolve: (result: WorkerDecryptResult) => void;
    reject: (err: Error) => void;
}

interface QueueEntry {
    request: DecryptRequest;
    resolve: (url: string) => void;
    reject: (err: Error) => void;
}

export class DecryptionScheduler {
    private static instance: DecryptionScheduler;

    private readonly maxConcurrency: number;
    private readonly maxCacheSize: number;

    /** LRU cache: key → blob URL.  Insertion order = LRU order (oldest first). */
    private cache = new Map<string, string>();

    /** Pending queue of requests waiting to run. */
    private queue: QueueEntry[] = [];

    /** Number of currently running decrypt operations. */
    private running = 0;

    /** In-flight promises keyed by request key — prevents duplicate work. */
    private inflight = new Map<string, Promise<string>>();

    /** Shared Web Worker for off-thread decryption. Lazily created. */
    private worker: Worker | null = null;

    /** Whether worker creation was attempted and failed (skip retries). */
    private workerFailed = false;

    /** Pending worker responses keyed by request ID. */
    private workerCallbacks = new Map<string, WorkerResponseHandler>();

    /** Monotonically increasing ID for worker requests. */
    private nextWorkerId = 0;

    constructor(maxConcurrency = 2, maxCacheSize = 50) {
        this.maxConcurrency = maxConcurrency;
        this.maxCacheSize = maxCacheSize;
    }

    static getInstance(): DecryptionScheduler {
        if (!DecryptionScheduler.instance) {
            DecryptionScheduler.instance = new DecryptionScheduler();
        }
        return DecryptionScheduler.instance;
    }

    /**
     * Reset the singleton (for testing only).
     */
    static resetInstance(): void {
        if (DecryptionScheduler.instance) {
            DecryptionScheduler.instance.destroy();
        }
        DecryptionScheduler.instance = undefined as unknown as DecryptionScheduler;
    }

    /**
     * Enqueue a decryption request.
     *
     * Returns the cached blob URL immediately if available, otherwise queues the
     * work and resolves when decryption completes (or rejects on error/cancel).
     */
    enqueue(request: DecryptRequest): Promise<string> {
        // Cache hit — promote to most-recent and return immediately
        const cached = this.cache.get(request.key);
        if (cached !== undefined) {
            // LRU promotion: delete and re-insert so it moves to the end
            this.cache.delete(request.key);
            this.cache.set(request.key, cached);
            return Promise.resolve(cached);
        }

        // If already in-flight, return the existing promise (dedup)
        const existing = this.inflight.get(request.key);
        if (existing) {
            return existing;
        }

        // Already cancelled before enqueue — reject immediately
        if (request.signal?.aborted) {
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }

        const promise = new Promise<string>((resolve, reject) => {
            this.queue.push({ request, resolve, reject });
        });

        this.inflight.set(request.key, promise);

        // Clean up inflight entry when the promise settles
        promise.then(
            () => this.inflight.delete(request.key),
            () => this.inflight.delete(request.key)
        );

        this.processQueue();
        return promise;
    }

    /**
     * Decrypt a file entirely inside a Web Worker.
     *
     * The worker performs: fetch → arrayBuffer → crypto.subtle.decrypt → Blob
     * → URL.createObjectURL. Only the tiny blob-URL string is posted back.
     *
     * Falls back to the provided `fallback` function if the worker cannot be
     * created (e.g. unsupported environment).
     */
    decryptInWorker(
        params: WorkerDecryptParams,
        signal: AbortSignal,
        fallback: (signal: AbortSignal) => Promise<WorkerDecryptResult>,
    ): Promise<WorkerDecryptResult> {
        if (signal.aborted) {
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }

        const worker = this.getOrCreateWorker();
        if (!worker) {
            // Worker unavailable — fall back to main-thread decryption
            return fallback(signal);
        }

        const id = String(this.nextWorkerId++);

        return new Promise<WorkerDecryptResult>((resolve, reject) => {
            this.workerCallbacks.set(id, { resolve, reject });

            // If signal aborts, tell the worker to cancel and reject
            const onAbort = () => {
                worker.postMessage({ id, type: 'abort' });
                this.workerCallbacks.delete(id);
                reject(new DOMException('Aborted', 'AbortError'));
            };

            if (signal.aborted) {
                this.workerCallbacks.delete(id);
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }

            signal.addEventListener('abort', onAbort, { once: true });

            // Store cleanup so we can remove the listener when the worker responds
            const originalResolve = resolve;
            const originalReject = reject;

            this.workerCallbacks.set(id, {
                resolve: (result: WorkerDecryptResult) => {
                    signal.removeEventListener('abort', onAbort);
                    originalResolve(result);
                },
                reject: (err: Error) => {
                    signal.removeEventListener('abort', onAbort);
                    originalReject(err);
                },
            });

            worker.postMessage({
                id,
                url: params.url,
                key: params.key,
                nonce: params.nonce,
                mimeType: params.mimeType,
            });
        });
    }

    /**
     * Cancel all pending (not yet running) requests and revoke all cached URLs.
     */
    destroy(): void {
        // Reject all queued items
        for (const entry of this.queue) {
            entry.reject(new DOMException('Scheduler destroyed', 'AbortError'));
        }
        this.queue = [];
        this.inflight.clear();

        // Terminate the Web Worker
        this.terminateWorker();

        // Revoke all cached blob URLs
        for (const url of this.cache.values()) {
            tryRevokeObjectURL(url);
        }
        this.cache.clear();
    }

    /** Visible for testing. */
    get cacheSize(): number {
        return this.cache.size;
    }

    /** Visible for testing. */
    get queueLength(): number {
        return this.queue.length;
    }

    /** Visible for testing. */
    get runningCount(): number {
        return this.running;
    }

    /** Check if a key has a cached blob URL. */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    // ── worker lifecycle ───────────────────────────────────────────────

    private getOrCreateWorker(): Worker | null {
        if (this.worker) return this.worker;
        if (this.workerFailed) return null;

        try {
            this.worker = new Worker(
                new URL('./decryptionWorker.ts', import.meta.url),
                { type: 'module' }
            );

            this.worker.onmessage = (e: MessageEvent) => {
                const data = e.data as {
                    id: string;
                    blobUrl?: string;
                    error?: string;
                };
                const { id } = data;
                const handler = this.workerCallbacks.get(id);
                if (!handler) return;

                this.workerCallbacks.delete(id);

                if (data.error) {
                    handler.reject(
                        data.error === 'AbortError'
                            ? new DOMException('Aborted', 'AbortError')
                            : new Error(data.error)
                    );
                } else if (data.blobUrl) {
                    handler.resolve({ blobUrl: data.blobUrl });
                }
            };

            this.worker.onerror = () => {
                // Worker failed to load — mark as failed so we fall back
                this.workerFailed = true;
                this.worker = null;
                // Reject all pending callbacks
                for (const [, handler] of this.workerCallbacks) {
                    handler.reject(new Error('Decryption worker failed'));
                }
                this.workerCallbacks.clear();
            };

            return this.worker;
        } catch {
            this.workerFailed = true;
            return null;
        }
    }

    private terminateWorker(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        // Reject all pending worker callbacks
        for (const [, handler] of this.workerCallbacks) {
            handler.reject(new DOMException('Scheduler destroyed', 'AbortError'));
        }
        this.workerCallbacks.clear();
    }

    // ── internal ────────────────────────────────────────────────────────

    private processQueue(): void {
        while (this.running < this.maxConcurrency && this.queue.length > 0) {
            const entry = this.queue.shift()!;

            // Skip entries whose signal was aborted while waiting in the queue
            if (entry.request.signal?.aborted) {
                entry.reject(new DOMException('Aborted', 'AbortError'));
                continue;
            }

            this.running++;
            this.runEntry(entry);
        }
    }

    private async runEntry(entry: QueueEntry): Promise<void> {
        const { request, resolve, reject } = entry;

        try {
            // Double-check cache — another in-flight request for the same key
            // may have completed while this entry was queued
            const cached = this.cache.get(request.key);
            if (cached !== undefined) {
                this.cache.delete(request.key);
                this.cache.set(request.key, cached);
                resolve(cached);
                return;
            }

            const internalAbort = new AbortController();

            // If the caller's signal aborts, propagate to the internal controller
            const onAbort = () => internalAbort.abort();
            request.signal?.addEventListener('abort', onAbort, { once: true });

            try {
                const blobUrl = await request.decrypt(internalAbort.signal);

                // If aborted during decrypt, don't cache the result
                if (request.signal?.aborted) {
                    tryRevokeObjectURL(blobUrl);
                    reject(new DOMException('Aborted', 'AbortError'));
                    return;
                }

                this.addToCache(request.key, blobUrl);
                resolve(blobUrl);
            } finally {
                request.signal?.removeEventListener('abort', onAbort);
            }
        } catch (err) {
            reject(err as Error);
        } finally {
            this.running--;
            this.processQueue();
        }
    }

    private addToCache(key: string, url: string): void {
        // If already present (race), revoke the old one
        if (this.cache.has(key)) {
            const old = this.cache.get(key)!;
            this.cache.delete(key);
            tryRevokeObjectURL(old);
        }

        // Evict LRU entries if at capacity
        while (this.cache.size >= this.maxCacheSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) {
                const oldUrl = this.cache.get(oldest)!;
                this.cache.delete(oldest);
                tryRevokeObjectURL(oldUrl);
            }
        }

        this.cache.set(key, url);
    }
}

function tryRevokeObjectURL(url: string): void {
    try {
        URL.revokeObjectURL(url);
    } catch {
        // Ignore — URL may not be a blob URL (e.g. Capacitor URL from cache)
    }
}
