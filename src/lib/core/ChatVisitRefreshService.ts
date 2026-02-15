import { discoverUserRelays } from '$lib/core/connection/Discovery';

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 300;

class ChatVisitRefreshService {
    private inFlight: Set<string> = new Set();

    /**
     * Refresh a single contact's relay discovery and profile data,
     * then dispatch nospeak:profiles-updated so the UI picks up changes.
     * Skips if a refresh for this npub is already in progress.
     */
    async refreshContact(npub: string): Promise<void> {
        console.log(`[ChatVisitRefresh] refreshContact called: ${npub.slice(0, 12)}`);
        if (this.inFlight.has(npub)) {
            console.log(`[ChatVisitRefresh] Already in-flight for ${npub.slice(0, 12)}, skipping`);
            return;
        }

        this.inFlight.add(npub);
        try {
            console.log(`[ChatVisitRefresh] Starting discoverUserRelays for ${npub.slice(0, 12)}`);
            await discoverUserRelays(npub, false);
            console.log(`[ChatVisitRefresh] discoverUserRelays completed for ${npub.slice(0, 12)}, dispatching profiles-updated`);
            window.dispatchEvent(new CustomEvent('nospeak:profiles-updated'));
        } catch (error) {
            console.error(`[ChatVisitRefresh] Failed to refresh contact ${npub}:`, error);
        } finally {
            this.inFlight.delete(npub);
        }
    }

    /**
     * Refresh all participants in a group chat (excluding the current user).
     * Processes in batches with inter-batch delays and dispatches
     * nospeak:profiles-updated after each batch for gradual UI updates.
     */
    async refreshGroupParticipants(participants: string[], currentUserNpub: string): Promise<void> {
        const others = participants.filter(p => p !== currentUserNpub);
        if (others.length === 0) return;

        console.log(`[ChatVisitRefresh] refreshGroupParticipants: ${others.length} contacts`);

        for (let i = 0; i < others.length; i += BATCH_SIZE) {
            const batch = others.slice(i, i + BATCH_SIZE);
            let anyRefreshed = false;

            await Promise.all(
                batch.map(async (npub) => {
                    if (this.inFlight.has(npub)) {
                        console.log(`[ChatVisitRefresh] Already in-flight for ${npub.slice(0, 12)}, skipping in group batch`);
                        return;
                    }

                    this.inFlight.add(npub);
                    try {
                        await discoverUserRelays(npub, false);
                        anyRefreshed = true;
                    } catch (error) {
                        console.error(`[ChatVisitRefresh] Failed to refresh contact ${npub}:`, error);
                    } finally {
                        this.inFlight.delete(npub);
                    }
                })
            );

            if (anyRefreshed) {
                console.log(`[ChatVisitRefresh] Dispatching profiles-updated after group batch ${Math.floor(i / BATCH_SIZE) + 1}`);
                window.dispatchEvent(new CustomEvent('nospeak:profiles-updated'));
            }

            // Delay between batches (skip after last batch)
            if (i + BATCH_SIZE < others.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
    }
}

export const chatVisitRefreshService = new ChatVisitRefreshService();
