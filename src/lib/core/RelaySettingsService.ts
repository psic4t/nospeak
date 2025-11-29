import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { connectionManager } from './connection/instance';
import { DEFAULT_DISCOVERY_RELAYS } from './connection/Discovery';
import { Relay } from 'nostr-tools';
import { ConnectionType } from './connection/ConnectionManager';

const STORAGE_KEY = 'nospeak:relay_settings';

export interface RelaySettings {
    readRelays: string[];
    writeRelays: string[];
}

export class RelaySettingsService {
    private settings: RelaySettings = {
        readRelays: [],
        writeRelays: []
    };

    constructor() {
        this.loadSettings();
    }

    private loadSettings(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.settings = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load relay settings:', e);
        }
    }

    private saveSettings(): void {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            }
        } catch (e) {
            console.error('Failed to save relay settings:', e);
        }
    }

    public getSettings(): RelaySettings {
        return { ...this.settings };
    }

    public async updateSettings(readRelays: string[], writeRelays: string[]): Promise<void> {
        this.settings.readRelays = [...new Set(readRelays.filter(r => r.trim()))];
        this.settings.writeRelays = [...new Set(writeRelays.filter(r => r.trim()))];
        this.saveSettings();

        // Publish NIP-65 event
        await this.publishRelayList();
    }

    private async publishRelayList(): Promise<void> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);
        
        if (!currentSigner || !currentUserData) {
            throw new Error('User not authenticated');
        }

        // Build NIP-65 tags
        const tags: string[][] = [];
        
        // Add read relays
        for (const relay of this.settings.readRelays) {
            if (!this.settings.writeRelays.includes(relay)) {
                tags.push(['r', relay, 'read']);
            }
        }
        
        // Add write relays
        for (const relay of this.settings.writeRelays) {
            if (!this.settings.readRelays.includes(relay)) {
                tags.push(['r', relay, 'write']);
            }
        }
        
        // Add relays that are both read and write (no marker)
        const bothRelays = this.settings.readRelays.filter(r => this.settings.writeRelays.includes(r));
        for (const relay of bothRelays) {
            tags.push(['r', relay]);
        }

        const event = {
            kind: 10002,
            tags,
            content: '',
            created_at: Math.floor(Date.now() / 1000)
        };

        try {
            const signedEvent = await currentSigner.signEvent(event);
            
            // Publish to all relays: discovery + blaster
            const allRelays = [
                ...DEFAULT_DISCOVERY_RELAYS,
                'wss://sendit.nosflare.com'
            ];

            for (const relayUrl of allRelays) {
                try {
                    // Connect temporarily if not already connected
                    let relay = connectionManager.getRelayHealth(relayUrl)?.relay;
                    if (!relay) {
                        relay = await Relay.connect(relayUrl);
                    }
                    
                    await new Promise<void>((resolve, reject) => {
                        const pub = relay.publish(signedEvent);
                        pub.on('ok', () => {
                            console.log(`Published relay list to ${relayUrl}`);
                            resolve();
                        });
                        pub.on('failed', (reason: any) => {
                            console.error(`Failed to publish to ${relayUrl}:`, reason);
                            reject(new Error(reason));
                        });
                        
                        // Timeout after 5 seconds
                        setTimeout(() => {
                            reject(new Error('Publish timeout'));
                        }, 5000);
                    });
                } catch (e) {
                    console.error(`Failed to publish relay list to ${relayUrl}:`, e);
                    // Continue with other relays even if one fails
                }
            }
        } catch (e) {
            console.error('Failed to sign or publish relay list event:', e);
            throw e;
        }
    }

    public async applyRelaySettings(): Promise<void> {
        // Get current relay healths from the store
        const { relayHealths } = await import('$lib/stores/connection');
        const currentHealths = get(relayHealths);
        
        // Remove existing persistent relays that were from settings
        // (This is a simple approach - in a more sophisticated system we'd track which relays came from where)
        for (const health of currentHealths) {
            if (health.type === ConnectionType.Persistent && 
                !DEFAULT_DISCOVERY_RELAYS.includes(health.url)) {
                connectionManager.removeRelay(health.url);
            }
        }

        // Add new relays from settings
        for (const relay of this.settings.readRelays) {
            connectionManager.addPersistentRelay(relay);
        }
        for (const relay of this.settings.writeRelays) {
            if (!this.settings.readRelays.includes(relay)) {
                connectionManager.addPersistentRelay(relay);
            }
        }
    }
}

export const relaySettingsService = new RelaySettingsService();