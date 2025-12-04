import { connectionManager } from './connection/instance';
import { messageRepo } from '$lib/db/MessageRepository';
import { nip19, type NostrEvent, generateSecretKey, getPublicKey, finalizeEvent, nip44 } from 'nostr-tools';
import { signer, currentUser } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { profileRepo } from '$lib/db/ProfileRepository';
import { discoverUserRelays } from './connection/Discovery';
import { notificationService } from './NotificationService';
import { contactRepo } from '$lib/db/ContactRepository';
import { profileResolver } from './ProfileResolver';
import { startSync, updateSyncProgress, endSync } from '$lib/stores/sync';

export class MessagingService {
  private debug: boolean = true;
  private isFetchingHistory: boolean = false;
  private lastHistoryFetch: number = 0;
  private readonly HISTORY_FETCH_DEBOUNCE = 5000; // 5 seconds

  // Listen for incoming messages
  public listenForMessages(publicKey: string): () => void {
    // Subscribe to all gift-wraps for this user.
    // We intentionally omit `since` because gift-wrap events
    // use randomized created_at timestamps (NIP-59 style),
    // which can place new messages in the past. We rely on
    // messageRepo.hasMessage() for deduplication.
    const filters = [{
      kinds: [1059], // Kind 1059 Gift Wrap
      '#p': [publicKey]
    }];

    if (this.debug) console.log('Listening for messages...', filters);

    const unsub = connectionManager.subscribe(filters, async (event) => {
      if (this.debug) console.log('Received gift wrap event:', event);

      // Deduplicate? (ConnectionManager might not dedupe if multiple relays send same event)
      if (await messageRepo.hasMessage(event.id)) {
        if (this.debug) console.log('Message already in cache, skipping');
        return;
      }

      await this.handleGiftWrap(event);
    });

    return unsub;
  }

  private async handleGiftWrap(event: NostrEvent) {
    const s = get(signer);
    if (!s) return;

    try {
      // Step 1: Decrypt Gift Wrap
      const decryptedGiftWrap = await s.decrypt(event.pubkey, event.content);
      const seal = JSON.parse(decryptedGiftWrap) as NostrEvent;

      if (seal.kind !== 13) throw new Error(`Expected Seal (Kind 13), got ${seal.kind}`);

      // Step 2: Decrypt Seal
      const decryptedSeal = await s.decrypt(seal.pubkey, seal.content);
      const rumor = JSON.parse(decryptedSeal) as NostrEvent;

      // Support both legacy Kind 15 and current Kind 14 rumors
      if (rumor.kind !== 14 && rumor.kind !== 15) throw new Error(`Expected Rumor (Kind 14 or 15), got ${rumor.kind}`);

      // Validate p tag in rumor (must be for me)
      const myPubkey = await s.getPublicKey();
      const pTag = rumor.tags.find(t => t[0] === 'p');
      if (!pTag || pTag[1] !== myPubkey) {
        // If it's a self-wrap (from me to me), p tag might be recipient's key?
        // NIP-59 says: "The inner event (kind 14) MUST contain a p tag with the recipient's public key."
        // For received messages (from others), p=ME.
        // For self-wrapped messages (from me to me), p=RECIPIENT.
        if (rumor.pubkey !== myPubkey) {
          throw new Error('Received rumor p tag does not match my public key');
        }
      }

      this.processRumor(rumor, event.id);

    } catch (e) {
      console.error('Failed to unwrap/decrypt message:', e);
    }
  }

  private async processGiftWrapToMessage(event: NostrEvent): Promise<any | null> {
    const s = get(signer);
    const user = get(currentUser);
    if (!s || !user) return null;

    try {
      // Step 1: Decrypt Gift Wrap
      const decryptedGiftWrap = await s.decrypt(event.pubkey, event.content);
      const seal = JSON.parse(decryptedGiftWrap) as NostrEvent;

      if (seal.kind !== 13) throw new Error(`Expected Seal (Kind 13), got ${seal.kind}`);

      // Step 2: Decrypt Seal
      const decryptedSeal = await s.decrypt(seal.pubkey, seal.content);
      const rumor = JSON.parse(decryptedSeal) as NostrEvent;

      // Support both legacy Kind 15 and current Kind 14 rumors
      if (rumor.kind !== 14 && rumor.kind !== 15) throw new Error(`Expected Rumor (Kind 14 or 15), got ${rumor.kind}`);

      // Validate p tag in rumor (must be for me)
      const myPubkey = await s.getPublicKey();
      const pTag = rumor.tags.find(t => t[0] === 'p');
      if (!pTag || pTag[1] !== myPubkey) {
        if (rumor.pubkey !== myPubkey) {
          throw new Error('Received rumor p tag does not match my public key');
        }
      }

      return await this.createMessageFromRumor(rumor, event.id);

    } catch (e) {
      console.error('Failed to process gift wrap:', e);
      return null;
    }
  }

  private async createMessageFromRumor(rumor: NostrEvent, originalEventId: string): Promise<any | null> {
    const s = get(signer);
    if (!s) return null;

    try {
      // Determine direction and partner
      let direction: 'sent' | 'received';
      let partnerNpub: string;

      // My pubkey (hex)
      const myPubkey = await s.getPublicKey();

      if (rumor.pubkey === myPubkey) {
        direction = 'sent';
        // Find actual recipient from 'p' tag
        const pTag = rumor.tags.find(t => t[0] === 'p');
        const targetHex = pTag ? pTag[1] : myPubkey; // Fallback to self
        partnerNpub = nip19.npubEncode(targetHex);
      } else {
        direction = 'received';
        partnerNpub = nip19.npubEncode(rumor.pubkey);
      }

      return {
        recipientNpub: partnerNpub,
        message: rumor.content,
        sentAt: rumor.created_at * 1000,
        eventId: originalEventId,
        direction,
        createdAt: Date.now()
      };
    } catch (e) {
      console.error('Failed to create message from rumor:', e);
      return null;
    }
  }

  private async processRumor(rumor: NostrEvent, originalEventId: string) {
    const s = get(signer);
    const user = get(currentUser);
    if (!s || !user) return;

    // Use the same async message creation method as history fetching
    const message = await this.createMessageFromRumor(rumor, originalEventId);
    if (!message) return;

    if (this.debug) console.log(`Processed ${message.direction} message with ${message.recipientNpub}: ${message.message}`);

    await messageRepo.saveMessage(message);

    // Show notification for received messages (but not for history messages)
    if (message.direction === 'received') {
      // Don't show notifications for messages fetched during history sync
      if (!this.isFetchingHistory) {
        await notificationService.showNewMessageNotification(message.recipientNpub, message.message);
      }

      // Auto-add unknown contacts
      await this.autoAddContact(message.recipientNpub, true);
    }
  }

  // Check if this is a first-time sync (empty message cache)
  private async isFirstTimeSync(): Promise<boolean> {
    const count = await messageRepo.countMessages('ALL');
    return count === 0;
  }

  // Explicitly fetch history to fill gaps
  public async fetchHistory() {
    const s = get(signer);
    if (!s) return { totalFetched: 0, processed: 0 };

    // Debounce: prevent multiple rapid calls
    const now = Date.now();
    if (this.isFetchingHistory || (now - this.lastHistoryFetch) < this.HISTORY_FETCH_DEBOUNCE) {
      if (this.debug) console.log('History fetch debounced, skipping');
      return { totalFetched: 0, processed: 0 };
    }

    this.isFetchingHistory = true;
    this.lastHistoryFetch = now;

    try {
      const myPubkey = await s.getPublicKey();

      // Check if this is first-time sync (empty cache)
      const isFirstSync = await this.isFirstTimeSync();
      
      // Start sync state for UI
      startSync(isFirstSync);

      // 1. Wait for relays to be connected before fetching
      const relays = await this.getReadRelays(nip19.npubEncode(myPubkey));
      if (relays.length === 0) {
        console.warn('No user relays found, history fetching may be incomplete');
      }

      // Wait for at least one relay to be connected
      await this.waitForRelayConnection(relays);

      // 2. Fetch messages based on sync type
      // First-time sync: unlimited batches, fetch everything
      // Returning user: 1 batch of 100 messages to fill gaps
      const result = await this.fetchMessages({
        until: Math.floor(Date.now() / 1000),
        limit: 100,
        maxBatches: isFirstSync ? 10000 : 1, // Effectively unlimited for first sync
        abortOnDuplicates: !isFirstSync // Only abort on duplicates for returning users
      });

      if (this.debug) console.log(`History fetch completed. Total fetched: ${result.totalFetched}`);
      return result;
    } finally {
      this.isFetchingHistory = false;
      endSync();
    }
  }

  // Fetch older messages for infinite scroll
  public async fetchOlderMessages(until: number, limit: number = 50) {
    const s = get(signer);
    if (!s) return { totalFetched: 0, processed: 0 };

    if (this.isFetchingHistory) {
      if (this.debug) console.log('Already fetching history, skipping fetchOlderMessages');
      return { totalFetched: 0, processed: 0 };
    }

    this.isFetchingHistory = true;

    try {
      const myPubkey = await s.getPublicKey();

      // Ensure relays are connected (fast check)
      const relays = await this.getReadRelays(nip19.npubEncode(myPubkey));
      await this.waitForRelayConnection(relays, 2000); // Shorter timeout for pagination

      // Fetch a single batch of older messages
      const result = await this.fetchMessages({
        until,
        limit,
        maxBatches: 1,
        abortOnDuplicates: false
      });

      if (this.debug) console.log(`Older messages fetch completed. Total fetched: ${result.totalFetched}`);
      return result;

    } finally {
      this.isFetchingHistory = false;
    }
  }

  private async fetchMessages(options: { until: number, limit: number, abortOnDuplicates: boolean, maxBatches?: number }) {
    const s = get(signer);
    if (!s) return { totalFetched: 0, processed: 0 };

    const myPubkey = await s.getPublicKey();
    let until = options.until;
    let hasMore = true;
    let totalFetched = 0;
    let batchCount = 0;
    const maxBatches = options.maxBatches ?? 1; // Default to 1 batch

    while (hasMore && batchCount < maxBatches) {
      batchCount++;
      const filters = [{
        kinds: [1059],
        '#p': [myPubkey],
        limit: options.limit,
        until
      }];

      if (this.debug) console.log(`Fetching batch ${batchCount}... (until: ${until}, total: ${totalFetched})`);

      const events = await connectionManager.fetchEvents(filters, 10000);

      if (events.length === 0) {
        hasMore = false;
      } else {
        totalFetched += events.length;
        
        // Update sync progress for UI
        updateSyncProgress(totalFetched);

        // PIPELINE: Process this batch immediately
        const existingEventIds = await messageRepo.hasMessages(events.map(e => e.id));

        // CHECKPOINTING: 
        // If abortOnDuplicates is TRUE (returning user sync), stop if ALL events are known.
        const allDuplicates = events.length > 0 && existingEventIds.size === events.length;
        if (options.abortOnDuplicates && allDuplicates) {
          if (this.debug) console.log('Checkpoint reached: All events in batch are duplicates. Stopping fetch.');
          hasMore = false;
          break;
        }

        const newEvents = events.filter(event => !existingEventIds.has(event.id));
        if (newEvents.length > 0) {
          if (this.debug) console.log(`Processing ${newEvents.length} new events in this batch...`);

          const batchResults = await Promise.allSettled(
            newEvents.map(event => this.processGiftWrapToMessage(event))
          );

          const messagesToSave: any[] = [];
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              messagesToSave.push(result.value);
            }
          }

          if (messagesToSave.length > 0) {
            await messageRepo.saveMessages(messagesToSave);
            if (this.debug) console.log(`Saved ${messagesToSave.length} messages from batch`);
            
            // Auto-add contacts from historical messages (both sent and received)
            // For received: recipientNpub is the sender
            // For sent: recipientNpub is the recipient
            for (const message of messagesToSave) {
              await this.autoAddContact(message.recipientNpub, false); // Don't mark as unread for history
            }
          }
        }

        // Update until to the oldest event's created_at for next batch
        const oldestEvent = events.reduce((oldest, event) =>
          event.created_at < oldest.created_at ? event : oldest
        );
        until = oldestEvent.created_at - 1;

        // If we got less than batch size, we might be at the end
        if (events.length < options.limit) {
          hasMore = false;
        }
      }
    }

    return { totalFetched, processed: totalFetched };
  }

  public async sendMessage(recipientNpub: string, text: string) {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

    // 1. Get Relays
    const recipientRelays = await this.getReadRelays(recipientNpub);
    const senderRelays = await this.getWriteRelays(senderNpub);

    const targetRelays = [...new Set([...recipientRelays, ...senderRelays])];
    if (targetRelays.length === 0) {
      targetRelays.push('wss://nostr.data.haus'); // Fallback
    }

    if (this.debug) console.log('Sending message to relays:', targetRelays);

    // Connect temporarily for message sending
    for (const url of targetRelays) {
      connectionManager.addTemporaryRelay(url);
    }

    // Wait a bit for connections
    await new Promise(r => setTimeout(r, 500));

    // 2. Create Rumor (Kind 14)
    const rumor: Partial<NostrEvent> = {
      kind: 14,
      pubkey: senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: text,
      tags: [['p', recipientPubkey as string]]
    };

    // 3. Create Gift Wrap for Recipient
    const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s);

    // 4. Publish to Recipient's Read Relays + My Write Relays
    // Actually, logic is: Send to Recipient Read + My Write.
    // We already combined them in targetRelays.
    // RetryQueue handles publishing.
    for (const url of targetRelays) {
      await retryQueue.enqueue(giftWrap, url);
    }

    // 5. Create Gift Wrap for Self (History)
    // We encrypt the SAME rumor for OURSELVES.
    const selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s);

    // Publish self-wrap to my write relays
    for (const url of senderRelays) {
      await retryQueue.enqueue(selfGiftWrap, url);
    }

    // 6. Cleanup temporary relays after sending
    setTimeout(() => {
      connectionManager.cleanupTemporaryConnections();
    }, 2000);

    // 6. Cache locally immediately
    await messageRepo.saveMessage({
      recipientNpub,
      message: text,
      sentAt: (rumor.created_at || 0) * 1000,
      eventId: selfGiftWrap.id, // Save SELF-WRAP ID to match incoming
      direction: 'sent',
      createdAt: Date.now()
    });

    // Auto-add unknown contacts when sending messages
    await this.autoAddContact(recipientNpub);
  }

  private async createGiftWrap(rumor: Partial<NostrEvent>, recipientPubkey: string, s: any): Promise<NostrEvent> {
    // 1. Encrypt Rumor -> Seal
    const rumorJson = JSON.stringify(rumor);
    const encryptedRumor = await s.encrypt(recipientPubkey, rumorJson);

    const seal: Partial<NostrEvent> = {
      kind: 13,
      pubkey: await s.getPublicKey(),
      created_at: Math.floor(Date.now() / 1000),
      content: encryptedRumor,
      tags: []
    };

    const signedSeal = await s.signEvent(seal);
    const sealJson = JSON.stringify(signedSeal);

    // 2. Encrypt Seal -> Gift Wrap (using Ephemeral Key)
    const ephemeralPrivKey = generateSecretKey();
    const ephemeralPubkey = getPublicKey(ephemeralPrivKey);

    const conversationKey = nip44.v2.utils.getConversationKey(ephemeralPrivKey, recipientPubkey);
    const encryptedSeal = nip44.v2.encrypt(sealJson, conversationKey);

    const giftWrap: Partial<NostrEvent> = {
      kind: 1059,
      pubkey: ephemeralPubkey,
      created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800), // Randomize up to 2 days in past
      content: encryptedSeal,
      tags: [['p', recipientPubkey]]
    };

    return finalizeEvent(giftWrap as any, ephemeralPrivKey);
  }

  private async getReadRelays(npub: string): Promise<string[]> {
    let profile = await profileRepo.getProfile(npub);
    if (!profile) {
      // Try to resolve
      await discoverUserRelays(npub, false);
      profile = await profileRepo.getProfile(npub);
    }
    return profile?.readRelays || [];
  }

  private async getWriteRelays(npub: string): Promise<string[]> {
    let profile = await profileRepo.getProfile(npub);
    if (!profile) {
      await discoverUserRelays(npub);
      profile = await profileRepo.getProfile(npub);
    }
    return profile?.writeRelays || [];
  }

  private async waitForRelayConnection(relayUrls: string[], timeoutMs: number = 10000): Promise<void> {
    if (relayUrls.length === 0) return;

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const connectedRelays = connectionManager.getConnectedRelays();
      if (connectedRelays.length > 0) {
        if (this.debug) console.log(`Found ${connectedRelays.length} connected relays, proceeding with history fetch`);
        return;
      }

      if (this.debug) console.log('Waiting for relays to connect before fetching history...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.warn('Timeout waiting for relay connections, proceeding with history fetch anyway');
  }

  private async autoAddContact(npub: string, isUnread: boolean = false) {
    try {
      // Check if contact already exists
      const existingContacts = await contactRepo.getContacts();
      const contactExists = existingContacts.some(contact => contact.npub === npub);

      if (!contactExists) {
        // Fetch profile and relay info first (like manual addition)
        await profileResolver.resolveProfile(npub, true);
        const lastReadAt = isUnread ? 0 : Date.now();
        await contactRepo.addContact(npub, lastReadAt);
        if (this.debug) console.log(`Auto-added new contact: ${npub}`);
      }
    } catch (error) {
      console.error('Failed to auto-add contact:', error);
    }
  }
}

export const messagingService = new MessagingService();

// Need to import retryQueue to use it, but circular dependency if in instance.ts?
// Actually MessagingService imports connectionManager from instance.ts.
// instance.ts imports RetryQueue class but exports the instance.
// We can import the instance here.
import { retryQueue } from './connection/instance';
