import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { connectionManager } from './connection/instance';
import { DEFAULT_DISCOVERY_RELAYS } from './connection/Discovery';
import { Relay } from 'nostr-tools';
import { ConnectionType } from './connection/ConnectionManager';
import { profileRepo } from '$lib/db/ProfileRepository';

export interface RelayPublishResult {
    attempted: number;
    succeeded: number;
    failed: number;
}

export class RelaySettingsService {
    public async updateSettings(messagingRelays: string[]): Promise<RelayPublishResult> {
        // 1. Update Profile Repo Cache
        const currentUserData = get(currentUser);
        if (currentUserData) {
            const profile = await profileRepo.getProfileIgnoreTTL(currentUserData.npub);
            await profileRepo.cacheProfile(
                currentUserData.npub,
                profile?.metadata, // keep existing metadata
                {
                    messagingRelays
                },
                undefined
            );
        }
 
        // 2. Publish NIP-17 messaging relay list event
        const publishResult = await this.publishRelayList(messagingRelays);
 
        // 3. Apply settings to current connections
        await this.applyRelaySettings(messagingRelays);

        return publishResult;
    }
 
    private async publishRelayList(messagingRelays: string[]): Promise<RelayPublishResult> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);
        
        if (!currentSigner || !currentUserData) {
            throw new Error('User not authenticated');
        }
 
        // Build NIP-17 messaging relay tags
        const tags: string[][] = [];
        const seen = new Set<string>();

        for (const relay of messagingRelays) {
            if (!relay || seen.has(relay)) continue;
            seen.add(relay);
            tags.push(['relay', relay]);
        }
 
        const event = {
            kind: 10050,
            tags,
            content: '',
            created_at: Math.floor(Date.now() / 1000)
        };
 
        try {
            const signedEvent = await currentSigner.signEvent(event);
            
            // Publish to all relays: discovery + blaster + connected + configured
            const allRelays = new Set<string>([
                ...DEFAULT_DISCOVERY_RELAYS,
                'wss://sendit.nosflare.com',
                ...connectionManager.getAllRelayHealth().map((h) => h.url),
                ...messagingRelays
            ]);

            let attempted = 0;
            let succeeded = 0;
 
            for (const relayUrl of allRelays) {
                attempted++;
                try {
                    // Connect temporarily if not already connected
                    let relay = connectionManager.getRelayHealth(relayUrl)?.relay;
                    if (!relay) {
                        try {
                            relay = await Relay.connect(relayUrl);
                        } catch (e) {
                            console.warn(`Could not connect to ${relayUrl} to publish messaging relays`);
                            continue;
                        }
                    }
                    
                    const relayAny = relay as any;
                    if (!relayAny.onauth) {
                        relayAny.onauth = async (eventTemplate: any) => {
                            return await currentSigner.signEvent(eventTemplate);
                        };
                    }

                    // nostr-tools v2 publish returns a Promise that resolves when OK is received
                    try {
                        await relay.publish(signedEvent);
                    } catch (e) {
                        const message = (e as Error)?.message || String(e);
                        if (message.startsWith('auth-required')) {
                            connectionManager.markRelayAuthRequired?.(relayUrl);
                            if (connectionManager.getRelayHealth(relayUrl)) {
                                await connectionManager.authenticateRelay(relayUrl);
                            } else if (relayAny.auth && relayAny.onauth) {
                                await relayAny.auth(relayAny.onauth);
                            }
                            await relay.publish(signedEvent);
                        } else {
                            throw e;
                        }
                    }

                    console.log(`Published messaging relay list to ${relayUrl}`);
                    succeeded++;
                    
                } catch (e) {
                    console.error(`Failed to publish messaging relay list to ${relayUrl}:`, e);
                    // Continue with other relays even if one fails
                }
            }
            return {
                attempted,
                succeeded,
                failed: attempted - succeeded
            };
        } catch (e) {
            console.error('Failed to sign or publish messaging relay list event:', e);
            throw e;
        }
    }
 
    public async applyRelaySettings(messagingRelays: string[]): Promise<void> {
        // Get current relay healths from the store
        const { relayHealths } = await import('$lib/stores/connection');
        const currentHealths = get(relayHealths);
        
        // Remove existing persistent relays that are not in the messaging list
        const persistentRelaysToKeep = new Set(messagingRelays);
        
        for (const health of currentHealths) {
            if (health.type === ConnectionType.Persistent && 
                !persistentRelaysToKeep.has(health.url)) {
                connectionManager.removeRelay(health.url);
            }
        }

        // Add new relays from settings
        for (const relay of messagingRelays) {
            connectionManager.addPersistentRelay(relay);
        }
    }
}

export const relaySettingsService = new RelaySettingsService();
