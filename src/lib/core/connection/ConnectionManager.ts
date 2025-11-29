import { Relay } from 'nostr-tools';

export enum ConnectionType {
    Persistent,
    Temporary
}

export interface RelayHealth {
    url: string;
    relay: Relay | null;
    isConnected: boolean;
    lastConnected: number; // timestamp
    lastAttempt: number; // timestamp
    successCount: number;
    failureCount: number;
    consecutiveFails: number;
    type: ConnectionType;
}

export interface RetryConfig {
    maxRetries: number;
    initialBackoff: number; // ms
    maxBackoff: number; // ms
    backoffMultiplier: number;
    healthCheckInterval: number; // ms
    connectionTimeout: number; // ms
}

export const DefaultRetryConfig: RetryConfig = {
    maxRetries: 5,
    initialBackoff: 1000,
    maxBackoff: 30000,
    backoffMultiplier: 2.0,
    healthCheckInterval: 30000,
    connectionTimeout: 3000
};

export class ConnectionManager {
    private relays: Map<string, RelayHealth>;
    private config: RetryConfig;
    private debug: boolean;
    private isShutdown: boolean = false;
    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private uiUpdateTimer: ReturnType<typeof setInterval> | null = null;
    private onRelayListUpdate: ((relays: RelayHealth[]) => void) | null = null;
    
    private subscriptions: Set<{ filters: any[], onEvent: (event: any) => void, subMap: Map<string, any> }> = new Set();

    constructor(config: RetryConfig = DefaultRetryConfig, debug: boolean = false) {
        this.relays = new Map();
        this.config = config;
        this.debug = debug;
    }

    public start() {
        if (this.healthCheckTimer) return;
        if (this.debug) console.log('Starting ConnectionManager loops');
        
        // Health check loop
        this.healthCheckTimer = setInterval(() => {
            this.checkAllRelayHealth();
        }, this.config.healthCheckInterval);

        // UI update loop
        this.uiUpdateTimer = setInterval(() => {
            if (this.onRelayListUpdate) {
                this.onRelayListUpdate(Array.from(this.relays.values()));
            }
        }, 500);
    }

    public stop() {
        this.isShutdown = true;
        if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
        if (this.uiUpdateTimer) clearInterval(this.uiUpdateTimer);
        
        for (const health of this.relays.values()) {
            if (health.relay) {
                health.relay.close();
            }
        }
        
        if (this.debug) console.log('Connection manager stopped');
    }

    public addPersistentRelay(url: string) {
        if (!this.relays.has(url)) {
            const health: RelayHealth = {
                url,
                relay: null,
                isConnected: false,
                lastConnected: 0,
                lastAttempt: 0,
                successCount: 0,
                failureCount: 0,
                consecutiveFails: 0,
                type: ConnectionType.Persistent
            };
            this.relays.set(url, health);
            
            if (this.debug) console.log(`Added persistent relay ${url}`);
            
            // Trigger initial connection
            this.handleReconnection(url);
        } else {
            // Upgrade to persistent if it was temporary
            const health = this.relays.get(url)!;
            if (health.type === ConnectionType.Temporary) {
                health.type = ConnectionType.Persistent;
                if (this.debug) console.log(`Upgraded relay ${url} to persistent`);
            }
        }
    }

    public addTemporaryRelay(url: string) {
        if (!this.relays.has(url)) {
            const health: RelayHealth = {
                url,
                relay: null,
                isConnected: false,
                lastConnected: 0,
                lastAttempt: 0,
                successCount: 0,
                failureCount: 0,
                consecutiveFails: 0,
                type: ConnectionType.Temporary
            };
            this.relays.set(url, health);
            
            if (this.debug) console.log(`Added temporary relay ${url}`);
            
            // Trigger initial connection
            this.handleReconnection(url);
        }
    }

    public removeRelay(url: string) {
        const health = this.relays.get(url);
        if (health) {
            if (health.relay) {
                health.relay.close();
            }
            this.clearSubscriptionsForRelay(url);
            this.relays.delete(url);
            if (this.debug) console.log(`Removed relay ${url}`);
        }
    }

    private clearSubscriptionsForRelay(url: string) {
        for (const sub of this.subscriptions) {
            if (sub.subMap.has(url)) {
                // Close the subscription if object exists
                // nostr-tools v2 sub is just an object with close(), right?
                // Or maybe just removing it is enough if relay is closed.
                // But let's be safe.
                try {
                    const s = sub.subMap.get(url);
                    if (s && typeof s.close === 'function') {
                        s.close();
                    }
                } catch (e) {
                    // Ignore errors on close
                }
                sub.subMap.delete(url);
            }
        }
    }

    public cleanupTemporaryConnections() {
        const toRemove: string[] = [];
        for (const [url, health] of this.relays.entries()) {
            if (health.type === ConnectionType.Temporary) {
                toRemove.push(url);
            }
        }

        for (const url of toRemove) {
            this.removeRelay(url);
        }
        
        if (this.debug && toRemove.length > 0) {
            console.log(`Cleaned up ${toRemove.length} temporary connections`);
        }
    }

    public clearAllRelays() {
        const allUrls = Array.from(this.relays.keys());
        for (const url of allUrls) {
            this.removeRelay(url);
        }
        if (this.debug) {
            console.log(`Cleared all ${allUrls.length} relays`);
        }
    }

    public getConnectedRelays(): Relay[] {
        const connected: Relay[] = [];
        for (const health of this.relays.values()) {
            if (health.isConnected && health.relay) {
                connected.push(health.relay);
            }
        }
        return connected;
    }

    public getRelayHealth(url: string): RelayHealth | undefined {
        return this.relays.get(url);
    }

    public getAllRelayHealth(): RelayHealth[] {
        return Array.from(this.relays.values());
    }

    public setUpdateCallback(callback: (relays: RelayHealth[]) => void) {
        this.onRelayListUpdate = callback;
    }

    private markRelayFailure(url: string) {
        const health = this.relays.get(url);
        if (!health) return;

        health.failureCount++;
        health.consecutiveFails++;
        health.lastAttempt = Date.now();

        if (health.consecutiveFails >= 3) {
            this.handleReconnection(url);
        }

        if (this.debug) {
            console.log(`Marked failure for relay ${url} (consecutive: ${health.consecutiveFails})`);
        }
    }

    private markRelaySuccess(url: string) {
        const health = this.relays.get(url);
        if (!health) return;

        health.successCount++;
        health.consecutiveFails = 0;
        health.lastConnected = Date.now();
        health.isConnected = true;

        if (this.debug) {
            console.log(`Marked success for relay ${url}`);
        }

        // Apply active subscriptions to new connection
        if (health.relay) {
            this.applySubscriptionsToRelay(health.relay);
        }
    }

    private applySubscriptionsToRelay(relay: Relay) {
        for (const sub of this.subscriptions) {
            // Avoid duplicate subscriptions on the same relay?
            // nostr-tools relay.subscribe returns a Sub object.
            // We should track them per relay if we want to close them specifically.
            // But for now, just subscribing is better than not.
            // Ideally we track the Sub object in `subMap` keyed by relay URL?
            // Let's assume `subMap` stores map of relayUrl -> Sub
            
            if (sub.subMap.has(relay.url)) continue; // Already subscribed on this relay

            try {
                const s = relay.subscribe(sub.filters, {
                    onevent: sub.onEvent
                });
                sub.subMap.set(relay.url, s);
                if (this.debug) console.log(`Applied subscription to ${relay.url}`);
            } catch (e) {
                console.error(`Failed to subscribe on ${relay.url}`, e);
            }
        }
    }

    // ... (rest of methods)
    private calculateBackoff(consecutiveFails: number): number {
        if (consecutiveFails <= 1) {
            return this.config.initialBackoff;
        }

        const exponential = 1 << (consecutiveFails - 2);
        let delay = this.config.initialBackoff * exponential * this.config.backoffMultiplier;
        
        if (delay > this.config.maxBackoff) {
            delay = this.config.maxBackoff;
        }

        return delay;
    }

    private async handleReconnection(url: string) {
        const health = this.relays.get(url);
        if (!health) return;

        if (health.type === ConnectionType.Temporary) {
            // Check if we should even try to connect a temp relay again?
            // Original code says: "Only handle reconnections for persistent connections"
            // BUT, `AddTemporaryRelay` calls `handleReconnection` initially.
            // So we allow it if not connected, but maybe not loop?
            // The Go code skips reconnection loop for Temporary, but AddTemporaryRelay sends to reconnectChan.
            // Here we are calling handleReconnection directly.
            // Let's implement logic: if it's already attempting or failed too much, maybe stop?
            // For now, allow initial attempt.
        }

        const backoffDelay = this.calculateBackoff(health.consecutiveFails);
        const timeSinceLastAttempt = Date.now() - health.lastAttempt;

        if (timeSinceLastAttempt < backoffDelay) {
            const waitTime = backoffDelay - timeSinceLastAttempt;
            if (this.debug) console.log(`Waiting ${waitTime}ms before reconnecting to ${url}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Double check existence after wait
        if (!this.relays.has(url)) return;

        try {
            await this.connectRelay(url);
        } catch (e) {
            if (this.debug) console.log(`Reconnection failed for ${url}: ${e}`);
            this.markRelayFailure(url);
        }
    }

    private async connectRelay(url: string): Promise<void> {
        if (this.debug) console.log(`Attempting to connect to ${url}`);
        
        const health = this.relays.get(url);
        if (!health) throw new Error(`Relay ${url} not managed`);

        health.lastAttempt = Date.now();

        try {
            // nostr-tools Relay.connect is strictly what we use.
            // But Relay constructor is synchronous, connect() returns promise.
            const relay = await Relay.connect(url);
            
            // Handle disconnects
            relay.onclose = () => {
                if (this.debug) console.log(`Relay ${url} disconnected`);
                health.isConnected = false;
                health.relay = null; 
                this.clearSubscriptionsForRelay(url);
                
                // Trigger health check or reconnect?
                if (health.type === ConnectionType.Persistent) {
                   this.markRelayFailure(url);
                }
            };

            // Go code does authenticateRelay here. We'll skip for now (Task 4 scope)
            
            health.relay = relay;
            health.isConnected = true; // Relay.connect throws if fails
            this.markRelaySuccess(url);
            
        } catch (e) {
            health.isConnected = false;
            if (health.relay) {
                health.relay.close();
                health.relay = null;
            }
            throw e;
        }
    }

    private checkAllRelayHealth() {
        for (const [url, health] of this.relays.entries()) {
            if (!health.isConnected || (Date.now() - health.lastConnected) > this.config.healthCheckInterval * 2) {
                if (health.consecutiveFails < 5 || health.consecutiveFails % 5 === 0) {
                    this.handleReconnection(url);
                }
            }
        }
    }

    public async fetchEvents(filters: any[], timeoutMs: number = 3000): Promise<any[]> {
        const events: any[] = [];
        const connectedRelays = this.getConnectedRelays();
        
        if (connectedRelays.length === 0) return [];

        return new Promise((resolve) => {
            let completedRelays = 0;
            const subs: { sub: any, relay: string }[] = [];
            const ids = new Set<string>();

            const checkCompletion = () => {
                completedRelays++;
                if (completedRelays >= connectedRelays.length) {
                    cleanup();
                    resolve(events);
                }
            };

            const cleanup = () => {
                for (const { sub } of subs) {
                    sub.close();
                }
                clearTimeout(timer);
            };

            const timer = setTimeout(() => {
                cleanup();
                resolve(events);
            }, timeoutMs);

            for (const relay of connectedRelays) {
                try {
                    const sub = relay.subscribe(filters, {
                        onevent(event) {
                            if (!ids.has(event.id)) {
                                ids.add(event.id);
                                events.push(event);
                            }
                        },
                        oneose() {
                            checkCompletion();
                        }
                    });
                    subs.push({ sub, relay: relay.url });
                } catch (e) {
                    console.error(`Fetch failed on ${relay.url}`, e);
                    checkCompletion();
                }
            }
        });
    }

    public subscribe(filters: any[], onEvent: (event: any) => void): () => void {
        const subEntry = {
            filters,
            onEvent,
            subMap: new Map<string, any>()
        };
        this.subscriptions.add(subEntry);

        // Subscribe on currently connected relays
        for (const health of this.relays.values()) {
            if (health.relay && health.isConnected) {
                this.applySubscriptionsToRelay(health.relay);
            }
        }
        
        return () => {
            this.subscriptions.delete(subEntry);
            for (const s of subEntry.subMap.values()) {
                s.close();
            }
            subEntry.subMap.clear();
        };
    }
}
