import { connectionManager } from './connection/instance';
import { messageRepo } from '$lib/db/MessageRepository';
import { nip19, type NostrEvent, generateSecretKey, getPublicKey, finalizeEvent, nip44, getEventHash } from 'nostr-tools';
import { signer, currentUser } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { profileRepo } from '$lib/db/ProfileRepository';
import { discoverUserRelays } from './connection/Discovery';
import { publishWithDeadline } from './connection/publishWithDeadline';
import { notificationService } from './NotificationService';
import { initRelaySendStatus, registerRelaySuccess } from '$lib/stores/sending';
import { contactRepo } from '$lib/db/ContactRepository';
import { addUnreadMessage, addUnreadReaction, isActivelyViewingConversation } from '$lib/stores/unreadMessages';
import { profileResolver } from './ProfileResolver';
import { startSync, updateSyncProgress, endSync } from '$lib/stores/sync';
import { reactionRepo, type Reaction } from '$lib/db/ReactionRepository';
import { reactionsStore } from '$lib/stores/reactions';
import { encryptFileWithAesGcm, type EncryptedFileResult } from './FileEncryption';
import { uploadToBlossomServers } from './BlossomUpload';
import { getMediaPreviewLabel } from '$lib/utils/mediaPreview';
import { contactSyncService } from './ContactSyncService';
 
 export class MessagingService {
   private debug: boolean = true;
    private isFetchingHistory: boolean = false;
    private lastHistoryFetch: number = 0;
    private readonly HISTORY_FETCH_DEBOUNCE = 5000; // 5 seconds

    // First-time login history sync is intentionally capped.
    // Note: gift-wrap (NIP-59) `created_at` timestamps can be randomized by clients,
    // so the cutoff is approximate and should be treated as a best-effort window.
    private readonly FIRST_SYNC_BACKFILL_DAYS = 30;

    private liveSeenEventIds: Set<string> = new Set();
 
    private activeSubscriptionUnsub: (() => void) | null = null;
    private activeSubscriptionPubkey: string | null = null;

    // Timestamp (seconds) when the current session started. Used to suppress
    // notifications for messages sent before the app was opened.
    private sessionStartedAt: number = 0;

    // When true, autoAddContact skips publishing to Kind 30000 (used during bulk sync)
    private _deferContactPublish: boolean = false;
 
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
 
       if (this.liveSeenEventIds.has(event.id)) {
         if (this.debug) console.log('Event already processed in live subscription, skipping');
         return;
       }
       this.liveSeenEventIds.add(event.id);
       if (this.liveSeenEventIds.size > 5000) {
         this.liveSeenEventIds.clear();
         this.liveSeenEventIds.add(event.id);
       }
 
       if (await messageRepo.hasMessage(event.id)) {
         if (this.debug) console.log('Message already in cache, skipping');
         return;
       }
 
       await this.handleGiftWrap(event);
     });
 
      return unsub;
    }

 
   public async startSubscriptionsForCurrentUser(): Promise<void> {
     const s = get(signer);
     const user = get(currentUser);
 
     if (!s || !user) {
       if (this.debug) console.warn('Cannot start subscriptions: missing signer or user');
       return;
     }
 
     const pubkey = await s.getPublicKey();
 
     // If already subscribed for this pubkey, do nothing
     if (this.activeSubscriptionUnsub && this.activeSubscriptionPubkey === pubkey) {
       if (this.debug) console.log('Subscriptions already active for current user, skipping start');
       return;
     }
 
     // Stop previous subscription if pubkey changed
     if (this.activeSubscriptionUnsub) {
       try {
         this.activeSubscriptionUnsub();
       } catch (e) {
         console.error('Error while stopping previous subscription:', e);
       }
       this.activeSubscriptionUnsub = null;
       this.activeSubscriptionPubkey = null;
     }
 
     // Capture session start time to suppress notifications for old messages
     this.sessionStartedAt = Math.floor(Date.now() / 1000);

     const unsub = this.listenForMessages(pubkey);
     this.activeSubscriptionUnsub = unsub;
     this.activeSubscriptionPubkey = pubkey;
 
     if (this.debug) console.log('Started app-global message subscriptions for current user');
   }
 
   public stopSubscriptions(): void {
     if (this.activeSubscriptionUnsub) {
       try {
         this.activeSubscriptionUnsub();
       } catch (e) {
         console.error('Error while stopping subscriptions:', e);
       }
     }
 
     this.activeSubscriptionUnsub = null;
     this.activeSubscriptionPubkey = null;
 
     if (this.debug) console.log('Stopped app-global message subscriptions');
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

      // Support both legacy Kind 15 and current Kind 14 rumors, plus kind 7 reactions
      if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) {
        throw new Error(`Expected Rumor (Kind 14, 15, or 7), got ${rumor.kind}`);
      }

      // Validate p tag in rumor (must be for me), except for self-sent cases
      const myPubkey = await s.getPublicKey();
      const pTag = rumor.tags.find(t => t[0] === 'p');
      if (!pTag || pTag[1] !== myPubkey) {
        if (rumor.pubkey !== myPubkey) {
          throw new Error('Received rumor p tag does not match my public key');
        }
      }

      if (rumor.kind === 7) {
        await this.processReactionRumor(rumor, event.id);
        return;
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

      // Support both legacy Kind 15 and current Kind 14 rumors, plus kind 7 reactions
      if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) {
        throw new Error(`Expected Rumor (Kind 14, 15, or 7), got ${rumor.kind}`);
      }

      // Validate p tag in rumor (must be for me), except for self-sent cases
      const myPubkey = await s.getPublicKey();
      const pTag = rumor.tags.find(t => t[0] === 'p');
      if (!pTag || pTag[1] !== myPubkey) {
        if (rumor.pubkey !== myPubkey) {
          throw new Error('Received rumor p tag does not match my public key');
        }
      }

      if (rumor.kind === 7) {
        await this.processReactionRumor(rumor, event.id);
        return null;
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

      const rumorId = getEventHash(rumor);

      if (rumor.kind === 15) {
        const fileTypeTag = rumor.tags.find(t => t[0] === 'file-type');
        const sizeTag = rumor.tags.find(t => t[0] === 'size');
        const hashTag = rumor.tags.find(t => t[0] === 'x');
        const plainHashTag = rumor.tags.find(t => t[0] === 'ox');
        const encAlgTag = rumor.tags.find(t => t[0] === 'encryption-algorithm');
        const keyTag = rumor.tags.find(t => t[0] === 'decryption-key');
        const nonceTag = rumor.tags.find(t => t[0] === 'decryption-nonce');

        const fileType = fileTypeTag?.[1];
        const fileSize = sizeTag ? parseInt(sizeTag[1], 10) || undefined : undefined;

        return {
          recipientNpub: partnerNpub,
          message: rumor.content || '',
          sentAt: rumor.created_at * 1000,
          eventId: originalEventId,
          rumorId,
          direction,
          createdAt: Date.now(),
          rumorKind: rumor.kind,
          fileUrl: rumor.content || undefined,
          fileType,
          fileSize,
          fileHashEncrypted: hashTag?.[1],
          fileHashPlain: plainHashTag?.[1],
          fileEncryptionAlgorithm: encAlgTag?.[1],
          fileKey: keyTag?.[1],
          fileNonce: nonceTag?.[1]
        };
      }

      // Default text (Kind 14) path
      const parentTag = rumor.tags.find(t => t[0] === 'e');
      const parentRumorId = parentTag?.[1];
      const location = this.parseLocationFromRumor(rumor);

      return {
        recipientNpub: partnerNpub,
        message: rumor.content,
        sentAt: rumor.created_at * 1000,
        eventId: originalEventId,
        rumorId,
        direction,
        createdAt: Date.now(),
        rumorKind: rumor.kind,
        parentRumorId,
        location
      };
    } catch (e) {
      console.error('Failed to create message from rumor:', e);
      return null;
    }
  }

  private parseLocationFromRumor(rumor: NostrEvent): { latitude: number; longitude: number } | undefined {
    const locationTag = rumor.tags.find(t => t[0] === 'location' && !!t[1]);
    const raw = locationTag?.[1] || (rumor.content?.startsWith('geo:') ? rumor.content.slice('geo:'.length) : undefined);

    if (!raw) {
      return undefined;
    }

    const [latitudeText, longitudeText] = raw.split(',');
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return undefined;
    }

    return { latitude, longitude };
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
      const shouldPersistUnread = !isActivelyViewingConversation(message.recipientNpub);
      if (shouldPersistUnread) {
        addUnreadMessage(user.npub, message.recipientNpub, message.eventId);
      }

      // Don't show notifications for messages fetched during history sync
      // or for messages sent before the current session started
      if (!this.isFetchingHistory && rumor.created_at >= this.sessionStartedAt) {
        // Use friendly label for media attachments instead of raw URL
        const notificationBody = (message.fileUrl && message.fileType)
          ? getMediaPreviewLabel(message.fileType)
          : message.message;
        await notificationService.showNewMessageNotification(message.recipientNpub, notificationBody);
      }

      // Auto-add unknown contacts
      await this.autoAddContact(message.recipientNpub, true);
    }
  }

  private async processReactionRumor(rumor: NostrEvent, originalEventId: string): Promise<void> {
    const s = get(signer);
    const user = get(currentUser);
    if (!s || !user) return;

    try {
      const myPubkey = await s.getPublicKey();
      const pTag = rumor.tags.find(t => t[0] === 'p');
      if (!pTag || (pTag[1] !== myPubkey && rumor.pubkey !== myPubkey)) {
        return;
      }

      const eTag = rumor.tags.find(t => t[0] === 'e');
      if (!eTag || !eTag[1]) {
        return;
      }

      let content = (rumor.content || '').trim();
      if (!content) {
        return;
      }

      if (content === '+') {
        content = '👍';
      } else if (content === '-') {
        content = '👎';
      }

      const targetEventId = eTag[1];
      const authorNpub = nip19.npubEncode(rumor.pubkey);
      const reaction: Omit<Reaction, 'id'> = {
        targetEventId,
        reactionEventId: originalEventId,
        authorNpub,
        emoji: content,
        createdAt: rumor.created_at * 1000
      };

      await reactionRepo.upsertReaction(reaction);
      reactionsStore.applyReactionUpdate(reaction);

      const isFromOtherUser = rumor.pubkey !== myPubkey;
      if (isFromOtherUser) {
        const partnerPubkey = rumor.pubkey;
        const partnerNpub = nip19.npubEncode(partnerPubkey);

        const shouldPersistUnread = !isActivelyViewingConversation(partnerNpub);
        if (shouldPersistUnread) {
          addUnreadReaction(user.npub, partnerNpub, originalEventId);

          try {
            await contactRepo.markActivity(partnerNpub, rumor.created_at * 1000);
          } catch (activityError) {
            console.error('Failed to mark contact activity for reaction:', activityError);
          }
        }

        // Don't show notifications for reactions during history sync
        // or for reactions sent before the current session started
        if (!this.isFetchingHistory && rumor.created_at >= this.sessionStartedAt) {
          try {
            await notificationService.showReactionNotification(partnerNpub, content);
          } catch (notifyError) {
            console.error('Failed to show reaction notification:', notifyError);
          }
        }
      }
    } catch (e) {
      console.error('Failed to process reaction rumor:', e);
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
    if (!s) return { totalFetched: 0, processed: 0, messagesSaved: 0 };

    // Debounce: prevent multiple rapid calls
    const now = Date.now();
    if (this.isFetchingHistory || (now - this.lastHistoryFetch) < this.HISTORY_FETCH_DEBOUNCE) {
      if (this.debug) console.log('History fetch debounced, skipping');
      return { totalFetched: 0, processed: 0, messagesSaved: 0 };
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
      const relays = await this.getMessagingRelays(nip19.npubEncode(myPubkey));
      if (relays.length === 0) {
        console.warn('No user relays found, history fetching may be incomplete');
      }

      // Wait for at least one relay to be connected
      await this.waitForRelayConnection(relays);

      // 2. Fetch messages based on sync type
      // First-time sync: fetch ~last 30 days (approx; see FIRST_SYNC_BACKFILL_DAYS)
      // Returning user: 1 batch of 50 messages to fill gaps
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = await this.fetchMessages({
        until: nowSeconds,
        limit: 50,
        maxBatches: isFirstSync ? 10000 : 1,
        minUntil: isFirstSync ? nowSeconds - (this.FIRST_SYNC_BACKFILL_DAYS * 86400) : undefined,
        abortOnDuplicates: !isFirstSync, // Only abort on duplicates for returning users
        markUnread: !isFirstSync
      });

      if (this.debug) console.log(`History fetch completed. Total fetched: ${result.totalFetched}`);
      return result;
    } finally {
      this.isFetchingHistory = false;
      endSync();
    }
  }

  // Fetch older messages for infinite scroll
  public async fetchOlderMessages(
    until: number,
    options?: { limit?: number; targetChatNpub?: string; timeoutMs?: number }
  ) {
    const s = get(signer);
    if (!s) return { totalFetched: 0, processed: 0, messagesSaved: 0, messagesSavedForChat: 0 };

    if (this.isFetchingHistory) {
      if (this.debug) console.log('Already fetching history, skipping fetchOlderMessages');
      return { totalFetched: 0, processed: 0, messagesSaved: 0, messagesSavedForChat: 0 };
    }

    this.isFetchingHistory = true;

    try {
      const myPubkey = await s.getPublicKey();

      // Ensure relays are connected (fast check)
      const relays = await this.getMessagingRelays(nip19.npubEncode(myPubkey));
      await this.waitForRelayConnection(relays, 2000); // Shorter timeout for pagination

      if (connectionManager.getConnectedRelays().length === 0) {
        return {
          totalFetched: 0,
          processed: 0,
          messagesSaved: 0,
          messagesSavedForChat: 0,
          reason: 'no-connected-relays'
        };
      }

      const limit = options?.limit ?? 100;
      const timeoutMs = options?.timeoutMs ?? 5000;
      const targetChatNpub = options?.targetChatNpub;

      // Fetch a single batch of older messages
      const result = await this.fetchMessages({
        until,
        limit,
        maxBatches: 1,
        abortOnDuplicates: false,
        timeoutMs,
        targetChatNpub
      });

      if (this.debug) console.log(`Older messages fetch completed. Total fetched: ${result.totalFetched}`);
      return result;

    } finally {
      this.isFetchingHistory = false;
    }
  }

  private async fetchMessages(options: { until: number, limit: number, abortOnDuplicates: boolean, maxBatches?: number, markUnread?: boolean, minUntil?: number, timeoutMs?: number, targetChatNpub?: string }) {
    const s = get(signer);
    const user = get(currentUser);
    if (!s || !user) return { totalFetched: 0, processed: 0, messagesSaved: 0 };

    const myPubkey = await s.getPublicKey();
    let until = options.until;
    let hasMore = true;
    let totalFetched = 0;
    let messagesSaved = 0;
    let messagesSavedForChat = typeof options.targetChatNpub === 'string' ? 0 : undefined;
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

      const events = await connectionManager.fetchEvents(filters, options.timeoutMs ?? 30000);

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

            messagesSaved += messagesToSave.length;
            if (typeof messagesSavedForChat === 'number') {
              messagesSavedForChat += messagesToSave.filter(message => message.recipientNpub === options.targetChatNpub).length;
            }

            // Auto-add contacts from fetched messages (both sent and received)
            // For received: recipientNpub is the sender
            // For sent: recipientNpub is the recipient
            for (const message of messagesToSave) {
              await this.autoAddContact(message.recipientNpub, false);

              const shouldMarkUnread =
                !!options.markUnread &&
                message.direction === 'received' &&
                !isActivelyViewingConversation(message.recipientNpub);

              if (shouldMarkUnread) {
                addUnreadMessage(user.npub, message.recipientNpub, message.eventId);
              }
            }
          }
        }

        // Update until to the oldest event's created_at for next batch
        const oldestEvent = events.reduce((oldest, event) =>
          event.created_at < oldest.created_at ? event : oldest
        );
        until = oldestEvent.created_at - 1;

        if (typeof options.minUntil === 'number' && until < options.minUntil) {
          if (this.debug) console.log(`Cutoff reached (minUntil: ${options.minUntil}). Stopping history fetch.`);
          hasMore = false;
        }

        // Note: We intentionally do not stop on partial batches.
        // With multiple relays, deduplication, and timeouts, `events.length < limit` does not
        // reliably indicate end-of-history.
        // We stop only when relays return zero events, we hit a cutoff, or we hit a checkpoint.
      }
    }

    return {
      totalFetched,
      processed: totalFetched,
      messagesSaved,
      messagesSavedForChat
    };
  }

  public async sendMessage(recipientNpub: string, text: string, parentRumorId?: string, createdAtSeconds?: number) {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
 
    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);
 
    // 1. Get messaging relays for recipient and sender
    const recipientRelays = await this.getMessagingRelays(recipientNpub);
    const senderRelays = await this.getMessagingRelays(senderNpub);
 
    if (recipientRelays.length === 0) {
      throw new Error('Contact has no messaging relays configured');
    }
 
    const allRelays = [...new Set([...recipientRelays, ...senderRelays])];
 
    if (this.debug) console.log('Sending message to relays:', { recipientRelays, senderRelays });
 
    // Connect temporarily for message sending
    for (const url of allRelays) {
      connectionManager.addTemporaryRelay(url);
    }
 
    // Cleanup temporary relays after sending attempt
    setTimeout(() => {
      connectionManager.cleanupTemporaryConnections();
    }, 15000);
 
    // 2. Create Rumor (Kind 14)
    const tags: string[][] = [['p', recipientPubkey as string]];
    if (parentRumorId) {
      tags.push(['e', parentRumorId]);
    }

    const rumor: Partial<NostrEvent> = {
      kind: 14,
      pubkey: senderPubkey,
      created_at: createdAtSeconds ?? Math.floor(Date.now() / 1000),
      content: text,
      tags
    };

    if (this.debug && parentRumorId) {
      console.log('Sending caption rumor', {
        content: rumor.content,
        tags: rumor.tags,
        parentRumorId
      });
    }
 
    // Calculate stable rumor ID for reactions
    const rumorId = getEventHash(rumor as NostrEvent);

 
    // 3. Create Gift Wrap for Recipient
    const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s);

    if (this.debug && parentRumorId) {
      console.log('Caption giftWrap for recipient', {
        id: giftWrap.id,
        kind: giftWrap.kind,
        tags: giftWrap.tags
      });
    }
 
    // Initialize ephemeral relay send status for UI (do not persist)
    initRelaySendStatus(giftWrap.id, recipientNpub, recipientRelays.length);
 
    const publishResult = await publishWithDeadline({
      connectionManager,
      event: giftWrap,
      relayUrls: recipientRelays,
      deadlineMs: 5000,
      onRelaySuccess: (url) => registerRelaySuccess(giftWrap.id, url),
    });

    if (publishResult.successfulRelays.length === 0) {
      console.warn('DM send failed to reach any recipient relays', {
        recipientNpub,
        giftWrapId: giftWrap.id,
        failedRelays: publishResult.failedRelays,
        timedOutRelays: publishResult.timedOutRelays,
      });
      throw new Error('Failed to send message to any relay');
    }

    if (publishResult.failedRelays.length > 0 || publishResult.timedOutRelays.length > 0) {
      console.warn('DM send did not reach some recipient relays', {
        recipientNpub,
        giftWrapId: giftWrap.id,
        successfulRelays: publishResult.successfulRelays,
        failedRelays: publishResult.failedRelays,
        timedOutRelays: publishResult.timedOutRelays,
      });
    }

    const successfulRelaySet = new Set(publishResult.successfulRelays);

    // Enqueue any remaining relays for best-effort delivery
    for (const url of recipientRelays) {
      if (!successfulRelaySet.has(url)) {
        await retryQueue.enqueue(giftWrap, url);
      }
    }

    // 5. Create Gift Wrap for Self (History)
    // We encrypt the SAME rumor for OURSELVES.
    const selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s);

    // Publish self-wrap to my messaging relays (may be empty)
    for (const url of senderRelays) {
      await retryQueue.enqueue(selfGiftWrap, url);
    }

    // 6. Cache locally after delivery confirmation
    await messageRepo.saveMessage({
      recipientNpub,
      message: text,
      sentAt: (rumor.created_at || 0) * 1000,
      eventId: selfGiftWrap.id, // Save SELF-WRAP ID to match incoming
      rumorId, // Save stable rumor ID
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 14,
      parentRumorId: parentRumorId
    });
 
    // Auto-add unknown contacts when sending messages
    await this.autoAddContact(recipientNpub);

    return rumorId;
  }

  public async sendLocationMessage(recipientNpub: string, latitude: number, longitude: number, createdAtSeconds?: number): Promise<string> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

    const recipientRelays = await this.getMessagingRelays(recipientNpub);
    const senderRelays = await this.getMessagingRelays(senderNpub);

    if (recipientRelays.length === 0) {
      throw new Error('Contact has no messaging relays configured');
    }

    const allRelays = [...new Set([...recipientRelays, ...senderRelays])];

    if (this.debug) console.log('Sending location message to relays:', { recipientRelays, senderRelays });

    for (const url of allRelays) {
      connectionManager.addTemporaryRelay(url);
    }

    setTimeout(() => {
      connectionManager.cleanupTemporaryConnections();
    }, 15000);

    const locationValue = `${latitude},${longitude}`;

    const rumor: Partial<NostrEvent> = {
      kind: 14,
      pubkey: senderPubkey,
      created_at: createdAtSeconds ?? Math.floor(Date.now() / 1000),
      content: `geo:${locationValue}`,
      tags: [
        ['p', recipientPubkey as string],
        ['location', locationValue]
      ]
    };

    const rumorId = getEventHash(rumor as NostrEvent);

    const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s);

    initRelaySendStatus(giftWrap.id, recipientNpub, recipientRelays.length);

    const publishResult = await publishWithDeadline({
      connectionManager,
      event: giftWrap,
      relayUrls: recipientRelays,
      deadlineMs: 5000,
      onRelaySuccess: (url) => registerRelaySuccess(giftWrap.id, url),
    });

    if (publishResult.successfulRelays.length === 0) {
      throw new Error('Failed to send message to any relay');
    }

    const successfulRelaySet = new Set(publishResult.successfulRelays);

    for (const url of recipientRelays) {
      if (!successfulRelaySet.has(url)) {
        await retryQueue.enqueue(giftWrap, url);
      }
    }

    const selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s);

    for (const url of senderRelays) {
      await retryQueue.enqueue(selfGiftWrap, url);
    }

    await messageRepo.saveMessage({
      recipientNpub,
      message: rumor.content || '',
      sentAt: (rumor.created_at || 0) * 1000,
      eventId: selfGiftWrap.id,
      rumorId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 14,
      location: {
        latitude,
        longitude
      }
    });

    await this.autoAddContact(recipientNpub);

    return rumorId;
  }

  private mediaTypeToMime(type: 'image' | 'video' | 'audio'): string {
    if (type === 'image') {
      return 'image/jpeg';
    }
    if (type === 'video') {
      return 'video/mp4';
    }
    return 'audio/mpeg';
  }

  private async uploadEncryptedMedia(
    encrypted: EncryptedFileResult,
    mediaType: 'image' | 'video' | 'audio',
    mimeType: string,
    blossomServers: string[]
  ): Promise<string> {
    // Use application/octet-stream for encrypted blobs so Blossom servers
    // return a .bin URL, which is expected by other NIP-17 clients like Amethyst.
    // The original mimeType is preserved in the file-type tag of the message.
    const blob = new Blob([encrypted.ciphertext.buffer as ArrayBuffer], { type: 'application/octet-stream' });

    if (blossomServers.length === 0) {
      throw new Error('No Blossom servers configured');
    }

    const result = await uploadToBlossomServers({
      servers: blossomServers,
      body: blob,
      mimeType: 'application/octet-stream',
      sha256: encrypted.hashEncrypted
    });

    return result.url;
  }

  public async sendFileMessage(
    recipientNpub: string,
    file: File,
    mediaType: 'image' | 'video' | 'audio',
    createdAtSeconds?: number
  ): Promise<string> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
 
    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);
 
    // 1. Get messaging relays
    const recipientRelays = await this.getMessagingRelays(recipientNpub);
    const senderRelays = await this.getMessagingRelays(senderNpub);
 
    if (recipientRelays.length === 0) {
      throw new Error('Contact has no messaging relays configured');
    }
 
    const allRelays = [...new Set([...recipientRelays, ...senderRelays])];
 
    if (this.debug) console.log('Sending file message to relays:', { recipientRelays, senderRelays });
 
    for (const url of allRelays) {
      connectionManager.addTemporaryRelay(url);
    }

    // Cleanup temporary relays after sending attempt
    setTimeout(() => {
      connectionManager.cleanupTemporaryConnections();
    }, 15000);

    // 2. Encrypt file with AES-GCM
    const encrypted = await encryptFileWithAesGcm(file);

    // 3. Upload encrypted blob to selected media backend
    const mimeType = file.type || this.mediaTypeToMime(mediaType);

    const senderProfile = await profileRepo.getProfileIgnoreTTL(senderNpub);
    const blossomServers = (senderProfile as any)?.mediaServers ?? [];

    const fileUrl = await this.uploadEncryptedMedia(encrypted, mediaType, mimeType, blossomServers);

    // 4. Create Kind 15 rumor
    const now = createdAtSeconds ?? Math.floor(Date.now() / 1000);

    const rumor: Partial<NostrEvent> = {
      kind: 15,
      pubkey: senderPubkey,
      created_at: now,
      content: fileUrl,
      tags: [
        ['p', recipientPubkey as string],
        ['file-type', mimeType],
        ['encryption-algorithm', 'aes-gcm'],
        ['decryption-key', encrypted.key],
        ['decryption-nonce', encrypted.nonce],
        ['size', encrypted.size.toString()],
        ['x', encrypted.hashEncrypted]
      ]
    };

    if (encrypted.hashPlain) {
      rumor.tags!.push(['ox', encrypted.hashPlain]);
    }

    const rumorId = getEventHash(rumor as NostrEvent);

    // 5. Create Gift Wraps
    const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s);
 
    initRelaySendStatus(giftWrap.id, recipientNpub, recipientRelays.length);

    const publishResult = await publishWithDeadline({
      connectionManager,
      event: giftWrap,
      relayUrls: recipientRelays,
      deadlineMs: 5000,
      onRelaySuccess: (url) => registerRelaySuccess(giftWrap.id, url),
    });

    if (publishResult.successfulRelays.length === 0) {
      console.warn('DM file send failed to reach any recipient relays', {
        recipientNpub,
        giftWrapId: giftWrap.id,
        failedRelays: publishResult.failedRelays,
        timedOutRelays: publishResult.timedOutRelays,
      });
      throw new Error('Failed to send message to any relay');
    }

    if (publishResult.failedRelays.length > 0 || publishResult.timedOutRelays.length > 0) {
      console.warn('DM file send did not reach some recipient relays', {
        recipientNpub,
        giftWrapId: giftWrap.id,
        successfulRelays: publishResult.successfulRelays,
        failedRelays: publishResult.failedRelays,
        timedOutRelays: publishResult.timedOutRelays,
      });
    }

    const successfulRelaySet = new Set(publishResult.successfulRelays);

    // Enqueue any remaining relays for best-effort delivery
    for (const url of recipientRelays) {
      if (!successfulRelaySet.has(url)) {
        await retryQueue.enqueue(giftWrap, url);
      }
    }

    const selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s);
    for (const url of senderRelays) {
      await retryQueue.enqueue(selfGiftWrap, url);
    }

    // 6. Cache locally after delivery confirmation
    await messageRepo.saveMessage({
      recipientNpub,
      message: '',
      sentAt: now * 1000,
      eventId: selfGiftWrap.id,
      rumorId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: 15,
      fileUrl,
      fileType: mimeType,
      fileSize: encrypted.size,
      fileHashEncrypted: encrypted.hashEncrypted,
      fileHashPlain: encrypted.hashPlain,
      fileEncryptionAlgorithm: 'aes-gcm',
      fileKey: encrypted.key,
      fileNonce: encrypted.nonce
    });

    await this.autoAddContact(recipientNpub);

    return rumorId;
  }

  public async sendReaction(

    recipientNpub: string,
    targetMessage: { recipientNpub: string; eventId: string; rumorId?: string; direction: 'sent' | 'received' },
    emoji: '👍' | '👎' | '❤️' | '😂'
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    // Reaction requires a stable rumor ID (NIP-17)
    if (!targetMessage.rumorId) {
        console.warn('Cannot react to message without rumorId (likely old message)');
        return;
    }
    const targetId = targetMessage.rumorId;

    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);
 
    const recipientRelays = await this.getMessagingRelays(recipientNpub);
    const senderRelays = await this.getMessagingRelays(senderNpub);
 
    if (recipientRelays.length === 0) {
      throw new Error('Contact has no messaging relays configured');
    }
 
    const allRelays = [...new Set([...recipientRelays, ...senderRelays])];
 
    if (this.debug) console.log('Sending reaction to relays:', { recipientRelays, senderRelays });
 
    for (const url of allRelays) {
      connectionManager.addTemporaryRelay(url);
    }
 
    await new Promise((r) => setTimeout(r, 500));


    const myPubkey = senderPubkey;
    let targetAuthorPubkey: string;
    if (targetMessage.direction === 'received') {
      targetAuthorPubkey = recipientPubkey as string;
    } else {
      targetAuthorPubkey = myPubkey;
    }

    const rumor: Partial<NostrEvent> = {
      kind: 7,
      pubkey: senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: emoji,
      tags: [
        ['p', targetAuthorPubkey],
        ['e', targetId, '', targetAuthorPubkey]
      ]
    };

    const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s);
    const selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s);
 
    for (const url of recipientRelays) {
      await retryQueue.enqueue(giftWrap, url);
    }
    for (const url of senderRelays) {
      await retryQueue.enqueue(selfGiftWrap, url);
    }


    setTimeout(() => {
      connectionManager.cleanupTemporaryConnections();
    }, 15000);

    const authorNpub = senderNpub;
    const reaction: Omit<Reaction, 'id'> = {
      targetEventId: targetId,
      reactionEventId: selfGiftWrap.id,
      authorNpub,
      emoji,
      createdAt: Date.now()
    };

    await reactionRepo.upsertReaction(reaction);
    reactionsStore.applyReactionUpdate(reaction);
  }
 
   private async createGiftWrap(rumor: Partial<NostrEvent>, recipientPubkey: string, s: any): Promise<NostrEvent> {
    // 1. Encrypt Rumor -> Seal
    const rumorJson = JSON.stringify(rumor);
    const encryptedRumor = await s.encrypt(recipientPubkey, rumorJson);

    const seal: Partial<NostrEvent> = {
      kind: 13,
      pubkey: await s.getPublicKey(),
      created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800), // Randomize up to 2 days in past per NIP-17
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

  private async getMessagingRelays(npub: string): Promise<string[]> {
    let profile = await profileRepo.getProfile(npub);
    if (!profile) {
      await discoverUserRelays(npub);
      profile = await profileRepo.getProfile(npub);
    }
 
    if (!profile) {
      return [];
    }
 
    const urls = new Set<string>(profile.messagingRelays || []);
 
    return Array.from(urls);
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

  /**
   * Control whether autoAddContact defers publishing to Kind 30000.
   * Use during bulk sync operations to avoid multiple publishes.
   */
  public setDeferContactPublish(defer: boolean): void {
    this._deferContactPublish = defer;
  }

  private async autoAddContact(npub: string, isUnread: boolean = false) {
    try {
      // Check if contact already exists
      const existingContacts = await contactRepo.getContacts();
      const contactExists = existingContacts.some(contact => contact.npub === npub);

      if (!contactExists) {
        // Fetch profile and relay info first (like manual addition)
        await profileResolver.resolveProfile(npub, true);
        const now = Date.now();
        const lastReadAt = isUnread ? 0 : now;
        const lastActivityAt = now;
        await contactRepo.addContact(npub, lastReadAt, lastActivityAt);
        if (this.debug) console.log(`Auto-added new contact: ${npub}`);
        
        // Sync contacts to Kind 30000 event (unless deferred during bulk sync)
        if (!this._deferContactPublish) {
          await contactSyncService.publishContacts();
        }
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
