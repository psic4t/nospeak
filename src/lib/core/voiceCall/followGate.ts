import { Capacitor, registerPlugin } from '@capacitor/core';
import { nip19 } from 'nostr-tools';
import { contactRepo } from '$lib/db/ContactRepository';

interface BackgroundMessagingPluginShape {
    setFollowGate(opts: { hexPubkeys: string[] }): Promise<void>;
}

const BackgroundMessagingForFollowGate =
    registerPlugin<BackgroundMessagingPluginShape>('AndroidBackgroundMessaging');

/**
 * NIP-AC follow-gate cache.
 *
 * Maintains a process-lifetime Set of followed pubkeys (hex). The cache
 * is populated on first call to `isFollowed` and refreshed via
 * `refreshContactCache`. Until the cache has been loaded at least once,
 * `isFollowed` returns `false` for ANY pubkey — this implements the
 * cold-start "drop offer if contacts not yet loaded" rule.
 *
 * The gate is hardcoded (no settings toggle in this version) and applies
 * only to Call Offer (kind 25050). Other NIP-AC signaling kinds (Answer,
 * ICE, Hangup, Reject) bypass it because they belong to in-progress
 * calls — see §"Spam Prevention via Follow-Gating" in
 * `openspec/specs/voice-calling/spec.md`.
 */
class FollowGate {
    private followedHex: Set<string> = new Set();
    private loaded = false;
    private inflightLoad: Promise<void> | null = null;

    /** True once the contact list has been read from the DB at least once. */
    public isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Synchronously check whether `senderHex` is in the cached set of
     * followed pubkeys. Returns `false` if the cache has never loaded.
     * Callers SHOULD `await ensureLoaded()` before this, or accept
     * cold-start drops.
     */
    public isFollowed(senderHex: string): boolean {
        if (!this.loaded) return false;
        return this.followedHex.has(senderHex);
    }

    /**
     * Trigger an initial load if not yet loaded. Subsequent calls are
     * no-ops (or share the inflight promise). After this resolves,
     * `isLoaded()` returns true.
     */
    public async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        if (!this.inflightLoad) {
            this.inflightLoad = this.load();
        }
        await this.inflightLoad;
    }

    /**
     * Force-refresh the cache from the DB (e.g. after a contact-list
     * NIP-02 update). Marks the cache as loaded on success.
     */
    public async refreshContactCache(): Promise<void> {
        await this.load();
    }

    private async load(): Promise<void> {
        try {
            const contacts = await contactRepo.getContacts();
            const next = new Set<string>();
            for (const c of contacts) {
                try {
                    const decoded = nip19.decode(c.npub);
                    if (decoded.type === 'npub') {
                        next.add(decoded.data as string);
                    }
                } catch {
                    // ignore malformed entries
                }
            }
            this.followedHex = next;
            this.loaded = true;
            // Mirror the set into native SharedPreferences so the Android
            // background service's NIP-AC offer handler can apply the same
            // gate before posting a lockscreen FSI ringer.
            await this.persistToNative();
        } catch (err) {
            console.warn('[NIP-AC][FollowGate] load failed', err);
            // Leave loaded=false so subsequent offers continue to drop until
            // the next ensureLoaded() call retries.
        } finally {
            this.inflightLoad = null;
        }
    }

    private async persistToNative(): Promise<void> {
        if (Capacitor.getPlatform() !== 'android') return;
        try {
            await BackgroundMessagingForFollowGate.setFollowGate({
                hexPubkeys: Array.from(this.followedHex)
            });
        } catch (err) {
            // Non-fatal: native fallback to "drop until cache loads".
            console.warn('[NIP-AC][FollowGate] persistToNative failed', err);
        }
    }

    /** Test-only reset; not part of the public API. */
    public _resetForTests(): void {
        this.followedHex.clear();
        this.loaded = false;
        this.inflightLoad = null;
    }
}

export const followGate = new FollowGate();
