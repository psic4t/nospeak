import { Relay } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

export interface UserSearchResult {
    npub: string;
    name: string;
    picture?: string;
    nip05?: string;
    about?: string;
}

const SEARCH_RELAY_URL = 'wss://relay.nostr.band';

export async function searchProfiles(query: string, limit: number = 20): Promise<UserSearchResult[]> {
    if (!query.trim()) {
        return [];
    }

    if (typeof window === 'undefined') {
        return [];
    }

    let relay: Relay | null = null;
    let resolved = false;

    const results: UserSearchResult[] = [];
    const seenPubkeys = new Set<string>();

    try {
        relay = await Relay.connect(SEARCH_RELAY_URL);

        const filters = [{
            kinds: [0],
            search: query,
            limit
        }];

        return await new Promise<UserSearchResult[]>((resolve) => {
            const timeout = setTimeout(() => {
                if (resolved) {
                    return;
                }
                resolved = true;
                try {
                    sub.close();
                } catch {
                    // ignore
                }
                resolve(results);
            }, 3500);

            const sub = relay!.subscribe(filters, {
                onevent(event) {
                    if (event.kind !== 0) {
                        return;
                    }

                    if (seenPubkeys.has(event.pubkey)) {
                        return;
                    }

                    seenPubkeys.add(event.pubkey);

                    let metadata: any = {};
                    try {
                        metadata = JSON.parse(event.content || '{}');
                    } catch {
                        metadata = {};
                    }

                    const npub = nip19.npubEncode(event.pubkey);
                    const shortened = npub.length > 20 ? `${npub.slice(0, 12)}...${npub.slice(-6)}` : npub;
                    const name = metadata.name || metadata.display_name || metadata.displayName || shortened;

                    results.push({
                        npub,
                        name,
                        picture: metadata.picture,
                        nip05: metadata.nip05,
                        about: metadata.about
                    });
                },
                oneose() {
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    clearTimeout(timeout);
                    try {
                        sub.close();
                    } catch {
                        // ignore
                    }
                    resolve(results);
                }
            });
        });
    } catch {
        return [];
    } finally {
        try {
            if (relay) {
                relay.close();
            }
        } catch {
            // ignore
        }
    }
}
