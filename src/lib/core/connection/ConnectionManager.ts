import { Relay } from 'nostr-tools';
import type { EventTemplate, NostrEvent } from 'nostr-tools';

export enum ConnectionType {
    Persistent,
    Temporary
}

export type RelayAuthStatus = 'not_required' | 'required' | 'authenticating' | 'authenticated' | 'failed';

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
    authStatus: RelayAuthStatus;
    lastAuthAt: number; // timestamp
    lastAuthError: string | null;
}

export interface RetryConfig {
    maxRetries: number;
    initialBackoff: number; // ms
    maxBackoff: number; // ms
    backoffMultiplier: number;
    healthCheckInterval: number; // ms
    connectionTimeout: number; // ms
    pingInterval: number; // ms - interval between keep-alive pings
    pingTimeout: number; // ms - timeout for ping response
}

export const DefaultRetryConfig: RetryConfig = {
    maxRetries: 5,
    initialBackoff: 1000,
    maxBackoff: 30000,
    backoffMultiplier: 2.0,
    healthCheckInterval: 30000,
    connectionTimeout: 3000,
    pingInterval: 120000, // 2 minutes (matches Android active profile)
    pingTimeout: 5000 // 5 seconds
};

export class ConnectionManager {
    private relays: Map<string, RelayHealth>;
    private config: RetryConfig;
    private defaultConfig!: RetryConfig;
    private debug: boolean;
    private isShutdown: boolean = false;
    private backgroundModeEnabled: boolean = false;

    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private uiUpdateTimer: ReturnType<typeof setInterval> | null = null;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private pendingPings: Map<string, { timeout: ReturnType<typeof setTimeout>; sub: any }> = new Map();
    private onRelayListUpdate: ((relays: RelayHealth[]) => void) | null = null;
    
    private subscriptions: Set<{
        filters: any[];
        onEvent: (event: any) => void;
        subMap: Map<string, any>;
        authRetryMap: Map<string, boolean>;
    }> = new Set();

    private authSigner: ((event: EventTemplate) => Promise<NostrEvent>) | null = null;

    private emitRelayUpdate() {
        if (this.onRelayListUpdate) {
            this.onRelayListUpdate(Array.from(this.relays.values()));
        }
    }

    constructor(config: RetryConfig = DefaultRetryConfig, debug: boolean = false) {
        this.relays = new Map();
        this.defaultConfig = { ...config };
        this.config = { ...config };
        this.debug = debug;
    }

    private isRelayWebSocketOpen(relay: Relay): boolean {
        const relayAny = relay as any;
        const ws = relayAny?.ws;
        if (!ws || typeof ws.readyState !== 'number') {
            return true;
        }

        const openState = relayAny?._WebSocket?.OPEN ?? 1;
        return ws.readyState === openState;
    }

    private preventSendsOnClosingWebSocket(relay: Relay) {
        if (this.isRelayWebSocketOpen(relay)) {
            return;
        }

        // On page reload/unload we can have `ws.readyState !== OPEN` while `connected` is
        // still true, causing noisy Chrome errors.
        try {
            (relay as any)._connected = false;
        } catch {
            // Ignore if relay implementation differs.
        }
    }

    private preventSendsOnIntentionalClose(relay: Relay) {
        // nostr-tools `Relay.close()` triggers `closeAllSubscriptions()` first.
        // Those subscription closes attempt to send `CLOSE` if `relay.connected` is true.
        // Additionally, nostr-tools schedules the websocket send in a microtask, so even if
        // the websocket starts as OPEN it can become CLOSING before the send happens.
        // For intentional shutdown, we prefer to skip CLOSE frames and just drop the socket.
        try {
            (relay as any)._connected = false;
        } catch {
            // Ignore if relay implementation differs.
        }

        try {
            (relay as any).connectionPromise = undefined;
        } catch {
            // Ignore if relay implementation differs.
        }
    }

    private safeCloseRelay(relay: Relay) {
        this.preventSendsOnIntentionalClose(relay);

        try {
            relay.close();
        } catch (e) {
            if (this.debug) {
                console.warn(`Relay close failed for ${relay.url}`, e);
            }
        }
    }

    private safeCloseSubscription(sub: any) {
        if (!sub || typeof sub.close !== 'function') {
            return;
        }

        const relay = sub.relay as Relay | undefined;
        if (relay) {
            this.preventSendsOnClosingWebSocket(relay);
        }

        try {
            sub.close();
        } catch {
            // Ignore errors on close
        }
    }

    public setAuthSigner(authSigner: ((event: EventTemplate) => Promise<NostrEvent>) | null) {
        this.authSigner = authSigner;
    }

    private updateRelayAuthStatus(url: string, authStatus: RelayAuthStatus, lastAuthError: string | null = null) {
        const health = this.relays.get(url);
        if (!health) return;

        health.authStatus = authStatus;

        if (authStatus === 'failed') {
            health.lastAuthAt = Date.now();
            health.lastAuthError = lastAuthError || 'Unknown error';
        } else if (authStatus === 'authenticated') {
            health.lastAuthAt = Date.now();
            health.lastAuthError = null;
        } else {
            // Keep lastAuthAt, but clear error when leaving failed state.
            health.lastAuthError = null;
        }

        this.emitRelayUpdate();
    }

    public markRelayAuthRequired(url: string) {
        const health = this.relays.get(url);
        if (!health) return;

        if (health.authStatus === 'not_required' || health.authStatus === 'authenticated') {
            this.updateRelayAuthStatus(url, 'required');
        }
    }

    public async authenticateRelay(url: string): Promise<boolean> {
        console.log(`[ConnectionManager] authenticateRelay(${url}): Starting...`);
        const health = this.relays.get(url);
        if (!health?.relay || !health.isConnected) {
            console.log(`[ConnectionManager] authenticateRelay(${url}): Relay not connected, aborting`);
            return false;
        }

        const relayAny = health.relay as any;
        if (!relayAny.auth) {
            console.log(`[ConnectionManager] authenticateRelay(${url}): Relay has no auth function`);
            return false;
        }

        if (!relayAny.onauth) {
            console.log(`[ConnectionManager] authenticateRelay(${url}): Missing signer (no onauth handler)`);
            this.updateRelayAuthStatus(url, 'failed', 'Missing signer');
            return false;
        }

        try {
            await relayAny.auth(relayAny.onauth);
            console.log(`[ConnectionManager] authenticateRelay(${url}): AUTH successful`);
            return true;
        } catch (e) {
            const message = (e as Error)?.message || String(e);
            console.log(`[ConnectionManager] authenticateRelay(${url}): AUTH failed: ${message}`);
            if (message.includes('Missing signer')) {
                this.updateRelayAuthStatus(url, 'failed', 'Missing signer');
            } else {
                this.updateRelayAuthStatus(url, 'failed', message);
            }
            return false;
        }
    }

    private attachAuthHandlers(url: string, relay: Relay) {
        const relayAny = relay as any;

        // Provide signing callback used by nostr-tools when an AUTH challenge arrives.
        relayAny.onauth = async (eventTemplate: EventTemplate) => {
            if (!this.authSigner) {
                this.updateRelayAuthStatus(url, 'failed', 'Missing signer');
                throw new Error('Missing signer');
            }

            try {
                return await this.authSigner(eventTemplate);
            } catch (e) {
                const message = (e as Error)?.message || String(e);
                if (message.includes('Missing signer')) {
                    this.updateRelayAuthStatus(url, 'failed', 'Missing signer');
                }
                throw e;
            }
        };

        // Wrap relay.auth so we can track auth progress, including auto-auth triggered by nostr-tools.
        if (typeof relayAny.auth === 'function') {
            const originalAuth = relayAny.auth.bind(relayAny);
            relayAny.auth = async (signAuthEvent: (evt: EventTemplate) => Promise<NostrEvent>) => {
                console.log(`[ConnectionManager] ${url}: AUTH challenge received, authenticating...`);
                this.markRelayAuthRequired(url);
                this.updateRelayAuthStatus(url, 'authenticating');

                try {
                    const result = await originalAuth(signAuthEvent);
                    console.log(`[ConnectionManager] ${url}: AUTH completed successfully`);
                    this.updateRelayAuthStatus(url, 'authenticated');
                    return result;
                } catch (e) {
                    const message = (e as Error)?.message || String(e);
                    console.log(`[ConnectionManager] ${url}: AUTH failed: ${message}`);
                    if (message.includes('Missing signer')) {
                        this.updateRelayAuthStatus(url, 'failed', 'Missing signer');
                    } else {
                        this.updateRelayAuthStatus(url, 'failed', message);
                    }
                    throw e;
                }
            };
        }
    }

    public start() {
        if (this.healthCheckTimer) return;
        if (this.debug) console.log('Starting ConnectionManager loops');
        
        // Health check loop
        this.healthCheckTimer = setInterval(() => {
            this.checkAllRelayHealth();
        }, this.config.healthCheckInterval);

        // UI update loop (periodic safety net)
        this.uiUpdateTimer = setInterval(() => {
            this.emitRelayUpdate();
        }, 500);

        // Visibility change listener for PWA/background tab recovery
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }

        // Start ping keep-alive loop to prevent NAT timeout
        this.startPingLoop();

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);
            window.addEventListener('offline', this.handleOffline);
        }
    }

    public stop() {
        this.isShutdown = true;
        if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
        if (this.uiUpdateTimer) clearInterval(this.uiUpdateTimer);

        // Stop ping loop and clear pending pings
        this.stopPingLoop();

        // Remove visibility listener
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);
        }

        for (const health of this.relays.values()) {
            if (health.relay) {
                this.safeCloseRelay(health.relay);
            }
        }
        
        if (this.debug) console.log('Connection manager stopped');
    }

    private handleOnline = () => {
        if (this.debug) console.log('Network online, checking relays...');
        for (const [url, health] of this.relays.entries()) {
            if (!health.isConnected && health.type === ConnectionType.Persistent) {
                this.handleReconnection(url);
            }
        }
    };

    private handleOffline = () => {
        if (this.debug) console.log('Network offline');
    };

    private handleVisibilityChange = () => {
        if (typeof document === 'undefined') return;

        if (document.visibilityState === 'visible') {
            if (this.debug) console.log('Tab became visible, verifying relay connections...');
            this.verifyAllConnections();
        }
    };

    private verifyAllConnections() {
        for (const [url, health] of this.relays.entries()) {
            if (health.isConnected && health.relay) {
                if (!this.isRelayWebSocketOpen(health.relay)) {
                    if (this.debug) console.log(`Relay ${url} socket dead on visibility check, triggering reconnect`);
                    health.isConnected = false;
                    health.relay = null;
                    this.clearSubscriptionsForRelay(url);
                    this.emitRelayUpdate();

                    if (health.type === ConnectionType.Persistent) {
                        this.handleReconnection(url);
                    }
                } else {
                    // Socket is open but may need re-authentication after background.
                    // Proactively re-authenticate relays that require auth to avoid
                    // missing messages while waiting for reactive auth-required close.
                    this.reauthenticateIfNeeded(url, health.relay);
                }
            }
        }
    }

    /**
     * Proactively re-authenticate a relay if it previously required auth.
     * This avoids the gap where messages are missed between subscription open
     * and the relay's auth-required close response.
     */
    private reauthenticateIfNeeded(url: string, relay: Relay) {
        const health = this.relays.get(url);
        if (!health) return;

        // Only re-auth if we know this relay requires authentication
        if (health.authStatus !== 'required' && health.authStatus !== 'authenticated') {
            return;
        }

        // If already authenticated and subscriptions exist, we're good
        if (health.authStatus === 'authenticated') {
            // Check if subscriptions are active for this relay
            let hasActiveSubscription = false;
            for (const sub of this.subscriptions) {
                if (sub.subMap.has(url)) {
                    hasActiveSubscription = true;
                    break;
                }
            }
            if (hasActiveSubscription) return;
        }

        if (this.debug) console.log(`Proactively re-authenticating ${url} after visibility change`);

        void (async () => {
            const authenticated = await this.authenticateRelay(url);
            // Re-fetch health after async operation - relay state may have changed
            const currentHealth = this.relays.get(url);
            if (authenticated && currentHealth?.relay && currentHealth.isConnected) {
                this.applySubscriptionsToRelay(currentHealth.relay);
            }
        })();
    }

    private startPingLoop() {
        if (this.pingTimer) return;

        this.pingTimer = setInterval(() => {
            this.pingAllRelays();
        }, this.config.pingInterval);
    }

    private stopPingLoop() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }

        for (const [, pending] of this.pendingPings) {
            clearTimeout(pending.timeout);
            this.safeCloseSubscription(pending.sub);
        }
        this.pendingPings.clear();
    }

    private pingAllRelays() {
        for (const [url, health] of this.relays.entries()) {
            if (health.isConnected && health.relay && health.type === ConnectionType.Persistent) {
                this.pingRelay(url, health.relay);
            }
        }
    }

    private pingRelay(url: string, relay: Relay) {
        if (this.pendingPings.has(url)) return;

        try {
            const sub = relay.subscribe(
                [{ kinds: [99999], limit: 1 }],
                {
                    onevent: () => {},
                    oneose: () => {
                        this.clearPendingPing(url);
                        if (this.debug) console.log(`Ping success for ${url}`);
                    },
                    onclose: () => {
                        this.clearPendingPing(url);
                    }
                }
            );

            const timeout = setTimeout(() => {
                if (this.debug) console.log(`Ping timeout for ${url}, marking as disconnected`);
                this.clearPendingPing(url);
                this.handlePingFailure(url);
            }, this.config.pingTimeout);

            this.pendingPings.set(url, { timeout, sub });

        } catch (e) {
            if (this.debug) console.log(`Ping failed for ${url}:`, e);
            this.handlePingFailure(url);
        }
    }

    private clearPendingPing(url: string) {
        const pending = this.pendingPings.get(url);
        if (pending) {
            clearTimeout(pending.timeout);
            this.safeCloseSubscription(pending.sub);
            this.pendingPings.delete(url);
        }
    }

    private handlePingFailure(url: string) {
        const health = this.relays.get(url);
        if (!health) return;

        health.isConnected = false;
        if (health.relay) {
            this.safeCloseRelay(health.relay);
            health.relay = null;
        }
        this.clearSubscriptionsForRelay(url);
        this.emitRelayUpdate();

        if (health.type === ConnectionType.Persistent) {
            this.markRelayFailure(url);
        }
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
                type: ConnectionType.Persistent,
                authStatus: 'not_required',
                lastAuthAt: 0,
                lastAuthError: null
            };
            this.relays.set(url, health);
            
            if (this.debug) console.log(`Added persistent relay ${url}`);
            
            this.emitRelayUpdate();

            // Trigger initial connection
            this.handleReconnection(url);
        } else {
            // Upgrade to persistent if it was temporary
            const health = this.relays.get(url)!;
            if (health.type === ConnectionType.Temporary) {
                health.type = ConnectionType.Persistent;
                if (this.debug) console.log(`Upgraded relay ${url} to persistent`);
                this.emitRelayUpdate();
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
                type: ConnectionType.Temporary,
                authStatus: 'not_required',
                lastAuthAt: 0,
                lastAuthError: null
            };
            this.relays.set(url, health);
            
            if (this.debug) console.log(`Added temporary relay ${url}`);
            
            this.emitRelayUpdate();

            // Trigger initial connection
            this.handleReconnection(url);
        }
    }

    public removeRelay(url: string) {
        const health = this.relays.get(url);
        if (health) {
            if (health.relay) {
                this.safeCloseRelay(health.relay);
            }
            this.clearSubscriptionsForRelay(url);
            this.relays.delete(url);
            if (this.debug) console.log(`Removed relay ${url}`);
            this.emitRelayUpdate();
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
                        this.safeCloseSubscription(s);
                    }
                } catch (e) {
                    // Ignore errors on close
                }
                sub.subMap.delete(url);
            }
            // Clear auth retry state so this relay can attempt auth again on reconnect.
            // Without this, a relay that failed auth once would never retry.
            sub.authRetryMap.delete(url);
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

        this.emitRelayUpdate();
    }

    public clearAllRelays() {
        const allUrls = Array.from(this.relays.keys());
        for (const url of allUrls) {
            this.removeRelay(url);
        }
        if (this.debug) {
            console.log(`Cleared all ${allUrls.length} relays`);
        }

        this.emitRelayUpdate();
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
        this.emitRelayUpdate();
    }
 
    public setBackgroundModeEnabled(enabled: boolean) {
        this.backgroundModeEnabled = enabled;
 
        if (!enabled) {
            this.config = { ...this.defaultConfig };
            if (this.debug) {
                console.log('Background mode disabled, restored default retry config');
            }
            return;
        }
 
        // In background mode, use more conservative backoff settings to reduce energy usage.
        this.config = {
            ...this.config,
            initialBackoff: Math.max(this.config.initialBackoff, 2000),
            maxBackoff: Math.max(this.config.maxBackoff, 60000)
        };
 
        if (this.debug) {
            console.log('Background mode enabled, applying conservative retry config', this.config);
        }
    }


    private markRelayFailure(url: string) {
        const health = this.relays.get(url);
        if (!health) return;

        health.failureCount++;
        health.consecutiveFails++;
        health.lastAttempt = Date.now();

        // Always try to reconnect persistent relays (handleReconnection manages backoff)
        if (health.type === ConnectionType.Persistent) {
            this.handleReconnection(url);
        } else if (health.consecutiveFails >= 3) {
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
                    onevent: sub.onEvent,
                    onclose: (reason: string) => {
                        sub.subMap.delete(relay.url);

                        if (typeof reason !== 'string' || !reason.startsWith('auth-required')) {
                            return;
                        }

                        this.markRelayAuthRequired(relay.url);

                        if (sub.authRetryMap.get(relay.url)) {
                            return;
                        }
                        sub.authRetryMap.set(relay.url, true);

                        void (async () => {
                            const authenticated = await this.authenticateRelay(relay.url);
                            if (!authenticated) {
                                return;
                            }

                            // Re-open this subscription once after successful auth.
                            this.applySubscriptionsToRelay(relay);
                        })();
                    },
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

                // Preserve auth requirement state across reconnects.
                if (health.authStatus === 'authenticated' || health.authStatus === 'authenticating') {
                    health.authStatus = 'required';
                }
                this.emitRelayUpdate();

                // Trigger health check or reconnect?
                if (health.type === ConnectionType.Persistent) {
                   this.markRelayFailure(url);
                }
            };

            this.attachAuthHandlers(url, relay);

            health.relay = relay;
            health.isConnected = true; // Relay.connect throws if fails
            this.markRelaySuccess(url);
            
        } catch (e) {
            health.isConnected = false;
            if (health.relay) {
                this.safeCloseRelay(health.relay);
                health.relay = null;
            }
            throw e;
        }
    }

    private checkAllRelayHealth() {
        for (const [url, health] of this.relays.entries()) {
            // Verify actual WebSocket state, not just cached boolean
            if (health.isConnected && health.relay) {
                if (!this.isRelayWebSocketOpen(health.relay)) {
                    if (this.debug) console.log(`Health check: ${url} socket not open, clearing state`);
                    health.isConnected = false;
                    health.relay = null;
                    this.clearSubscriptionsForRelay(url);
                    this.emitRelayUpdate();
                }
            }

            if (!health.isConnected) {
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
                    this.safeCloseSubscription(sub);
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

    public subscribe(
        filters: any[],
        onEvent: (event: any) => void,
        options?: { extraRelays?: string[] }
    ): () => void {
        const subEntry = {
            filters,
            onEvent,
            subMap: new Map<string, any>(),
            authRetryMap: new Map<string, boolean>()
        };
        this.subscriptions.add(subEntry);

        // Track which extra relays we add (for cleanup)
        const addedTemporaryRelays: string[] = [];

        if (options?.extraRelays) {
            for (const url of options.extraRelays) {
                // Only add if not already tracked
                if (!this.relays.has(url)) {
                    this.addTemporaryRelay(url);
                    addedTemporaryRelays.push(url);
                }
            }
        }

        // Subscribe on currently connected relays
        for (const health of this.relays.values()) {
            if (health.relay && health.isConnected) {
                this.applySubscriptionsToRelay(health.relay);
            }
        }
        
        return () => {
            this.subscriptions.delete(subEntry);
            for (const s of subEntry.subMap.values()) {
                this.safeCloseSubscription(s);
            }
            subEntry.subMap.clear();

            // Cleanup temporary relays that we added
            for (const url of addedTemporaryRelays) {
                this.removeRelay(url);
            }
        };
    }

    public connectDiscoveryRelays(relayUrls: string[]): string[] {
        const added: string[] = [];
        for (const url of relayUrls) {
            if (!this.relays.has(url)) {
                this.addTemporaryRelay(url);
                added.push(url);
            }
        }
        return added;
    }
}
