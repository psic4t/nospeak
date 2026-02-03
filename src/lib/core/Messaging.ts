import { connectionManager } from './connection/instance';
import { messageRepo } from '$lib/db/MessageRepository';
import { nip19, type NostrEvent, generateSecretKey, getPublicKey, finalizeEvent, nip44, getEventHash, verifyEvent } from 'nostr-tools';
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
import { getMediaPreviewLabel, getLocationPreviewLabel } from '$lib/utils/mediaPreview';
import { contactSyncService } from './ContactSyncService';
import { conversationRepo, deriveConversationId, isGroupConversationId, generateGroupTitle } from '$lib/db/ConversationRepository';
import type { Conversation } from '$lib/db/db';
 
 export class MessagingService {
   private debug: boolean = true;
    private isFetchingHistory: boolean = false;
    private lastHistoryFetch: number = 0;
    private readonly HISTORY_FETCH_DEBOUNCE = 5000; // 5 seconds

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

      // NIP-17: Verify seal signature to prevent impersonation attacks
      if (!verifyEvent(seal)) {
        throw new Error('Invalid seal signature - possible forgery attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal signature verified successfully');

      // Step 2: Decrypt Seal
      const decryptedSeal = await s.decrypt(seal.pubkey, seal.content);
      const rumor = JSON.parse(decryptedSeal) as NostrEvent;

      // Support both legacy Kind 15 and current Kind 14 rumors, plus kind 7 reactions
      if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) {
        throw new Error(`Expected Rumor (Kind 14, 15, or 7), got ${rumor.kind}`);
      }

      // NIP-17: Verify seal pubkey matches rumor pubkey to prevent sender impersonation
      if (seal.pubkey !== rumor.pubkey) {
        throw new Error('Seal pubkey does not match rumor pubkey - possible impersonation attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal/rumor pubkey match verified:', seal.pubkey.substring(0, 8) + '...');

      // Validate p tags in rumor - for group messages, my pubkey must be in at least one p-tag
      // For self-sent messages, sender pubkey equals my pubkey
      const myPubkey = await s.getPublicKey();
      const pTags = rumor.tags.filter(t => t[0] === 'p');
      const myPubkeyInPTags = pTags.some(t => t[1] === myPubkey);

      if (!myPubkeyInPTags && rumor.pubkey !== myPubkey) {
        throw new Error('Received rumor does not include my public key in p-tags');
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

      // NIP-17: Verify seal signature to prevent impersonation attacks
      if (!verifyEvent(seal)) {
        throw new Error('Invalid seal signature - possible forgery attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal signature verified successfully (processGiftWrap)');

      // Step 2: Decrypt Seal
      const decryptedSeal = await s.decrypt(seal.pubkey, seal.content);
      const rumor = JSON.parse(decryptedSeal) as NostrEvent;

      // Support both legacy Kind 15 and current Kind 14 rumors, plus kind 7 reactions
      if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) {
        throw new Error(`Expected Rumor (Kind 14, 15, or 7), got ${rumor.kind}`);
      }

      // NIP-17: Verify seal pubkey matches rumor pubkey to prevent sender impersonation
      if (seal.pubkey !== rumor.pubkey) {
        throw new Error('Seal pubkey does not match rumor pubkey - possible impersonation attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal/rumor pubkey match verified (processGiftWrap):', seal.pubkey.substring(0, 8) + '...');

      // Validate p tags in rumor - for group messages, my pubkey must be in at least one p-tag
      // For self-sent messages, sender pubkey equals my pubkey
      const myPubkey = await s.getPublicKey();
      const pTags = rumor.tags.filter(t => t[0] === 'p');
      const myPubkeyInPTags = pTags.some(t => t[1] === myPubkey);

      if (!myPubkeyInPTags && rumor.pubkey !== myPubkey) {
        throw new Error('Received rumor does not include my public key in p-tags');
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
      // My pubkey (hex)
      const myPubkey = await s.getPublicKey();
      
      // Extract all p-tags to determine if this is a group message
      const pTags = rumor.tags.filter(t => t[0] === 'p');
      const pTagPubkeys = pTags.map(t => t[1]);
      const isGroup = pTagPubkeys.length > 1;
      
      // Determine direction
      const direction: 'sent' | 'received' = rumor.pubkey === myPubkey ? 'sent' : 'received';
      
      // For group messages: all p-tag pubkeys + sender = participants
      // For 1-on-1: use traditional partnerNpub logic
      let partnerNpub: string;
      let conversationId: string;
      let participants: string[] | undefined;
      let senderNpub: string | undefined;
      
      if (isGroup) {
        // Group message: derive conversation ID from all participants (including sender)
        const allParticipantPubkeys = [...new Set([...pTagPubkeys, rumor.pubkey])];
        conversationId = deriveConversationId(allParticipantPubkeys, myPubkey);
        participants = allParticipantPubkeys.map(p => nip19.npubEncode(p));
        senderNpub = nip19.npubEncode(rumor.pubkey);
        
        // For backward compatibility, set partnerNpub to first non-self participant
        const otherPubkeys = pTagPubkeys.filter(p => p !== myPubkey);
        partnerNpub = nip19.npubEncode(otherPubkeys[0] || myPubkey);
        
        // Create/update conversation entry for group
        await this.ensureGroupConversation(conversationId, participants, rumor);
      } else {
        // 1-on-1 message
        if (direction === 'sent') {
          const targetHex = pTagPubkeys[0] || myPubkey;
          partnerNpub = nip19.npubEncode(targetHex);
        } else {
          partnerNpub = nip19.npubEncode(rumor.pubkey);
        }
        conversationId = partnerNpub;
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
        const dimTag = rumor.tags.find(t => t[0] === 'dim');
        const blurhashTag = rumor.tags.find(t => t[0] === 'blurhash');

        const fileType = fileTypeTag?.[1];
        const fileSize = sizeTag ? parseInt(sizeTag[1], 10) || undefined : undefined;

        let fileWidth: number | undefined;
        let fileHeight: number | undefined;
        if (dimTag?.[1]) {
          const parts = dimTag[1].split('x');
          if (parts.length === 2) {
            const w = parseInt(parts[0], 10);
            const h = parseInt(parts[1], 10);
            if (w > 0 && h > 0) {
              fileWidth = w;
              fileHeight = h;
            }
          }
        }

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
          fileNonce: nonceTag?.[1],
          fileWidth,
          fileHeight,
          fileBlurhash: blurhashTag?.[1],
          conversationId,
          participants,
          senderNpub
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
        location,
        conversationId,
        participants,
        senderNpub
      };
    } catch (e) {
      console.error('Failed to create message from rumor:', e);
      return null;
    }
  }
  
  /**
   * Ensures a group conversation exists in the database, creating or updating as needed.
   */
  private async ensureGroupConversation(
    conversationId: string,
    participantNpubs: string[],
    rumor: NostrEvent
  ): Promise<void> {
    try {
      const existing = await conversationRepo.getConversation(conversationId);
      const subjectTag = rumor.tags.find(t => t[0] === 'subject');
      const subject = subjectTag?.[1];
      const hasSubjectTag = !!subjectTag;
      const rumorCreatedAtMs = (rumor.created_at || 0) * 1000;
      const rumorId = getEventHash(rumor);
      const now = Date.now();
      
      if (existing) {
        // Update last activity and subject if newer
        await conversationRepo.markActivity(conversationId, now);
        if (hasSubjectTag && subject && subject !== existing.subject) {
          await conversationRepo.updateSubjectFromRumor(conversationId, subject, rumorCreatedAtMs, rumorId);
        }
      } else {
        // Create new conversation
        const conversation: Conversation = {
          id: conversationId,
          isGroup: true,
          participants: participantNpubs,
          subject,
          subjectUpdatedAt: hasSubjectTag && subject ? rumorCreatedAtMs : undefined,
          subjectUpdatedRumorId: hasSubjectTag && subject ? rumorId : undefined,
          lastActivityAt: now,
          lastReadAt: now, // Mark as read so it doesn't show unread indicator on discovery
          createdAt: now
        };
        await conversationRepo.upsertConversation(conversation);
      }
    } catch (e) {
      console.error('Failed to ensure group conversation:', e);
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
        // Use friendly label for media attachments or location messages
        const notificationBody = (message.fileUrl && message.fileType)
          ? getMediaPreviewLabel(message.fileType)
          : message.location
            ? getLocationPreviewLabel()
            : message.message;
        // For group messages, use senderNpub (actual sender); for 1-on-1, recipientNpub is the sender
        const notificationSender = message.senderNpub || message.recipientNpub;
        // Pass conversationId so notification click navigates to correct chat (group or 1-on-1)
        await notificationService.showNewMessageNotification(notificationSender, notificationBody, message.conversationId);
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
        const reactionAuthorNpub = nip19.npubEncode(rumor.pubkey);

        // Look up the target message to determine the conversation context
        // targetEventId is the rumorId of the message being reacted to
        const targetMessage = await messageRepo.getMessageByRumorId(targetEventId);
        
        // For group messages, use conversationId; for 1-on-1, use recipientNpub (the reaction author)
        // If we can't find the target message, fall back to reaction author (1-on-1 behavior)
        const isGroupReaction = targetMessage?.conversationId && 
          targetMessage.conversationId !== targetMessage.recipientNpub;
        const conversationKey = isGroupReaction 
          ? targetMessage!.conversationId! 
          : reactionAuthorNpub;

        const shouldPersistUnread = !isActivelyViewingConversation(conversationKey);
        if (shouldPersistUnread) {
          addUnreadReaction(user.npub, conversationKey, originalEventId);

          try {
            if (isGroupReaction) {
              // For group reactions, mark conversation activity
              await conversationRepo.markActivity(targetMessage!.conversationId!);
              // Dispatch event to trigger ChatList refresh
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('nospeak:conversation-updated', {
                  detail: { conversationId: targetMessage!.conversationId }
                }));
              }
            } else {
              // For 1-on-1, mark contact activity
              await contactRepo.markActivity(reactionAuthorNpub, rumor.created_at * 1000);
            }
          } catch (activityError) {
            console.error('Failed to mark activity for reaction:', activityError);
          }
        }

        // Don't show notifications for reactions during history sync
        // or for reactions sent before the current session started
        if (!this.isFetchingHistory && rumor.created_at >= this.sessionStartedAt) {
          try {
            await notificationService.showReactionNotification(reactionAuthorNpub, content);
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
  // When skipSyncStateManagement is true, caller is responsible for managing sync state
  // (used by AuthService which manages its own login sync flow)
  public async fetchHistory(options?: { skipSyncStateManagement?: boolean }) {
    const skipSyncState = options?.skipSyncStateManagement ?? false;
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

      // Start sync state for UI (unless caller manages it)
      if (!skipSyncState) {
        startSync(isFirstSync);
      }

      // 1. Wait for relays to be connected before fetching
      const relays = await this.getMessagingRelays(nip19.npubEncode(myPubkey));
      if (relays.length === 0) {
        console.warn('No user relays found, history fetching may be incomplete');
      }

      // Wait for at least one relay to be connected
      await this.waitForRelayConnection(relays);

      // 2. Fetch messages based on sync type
      // First-time sync: fetch all history until relays return 0 events
      // Returning user: 1 batch of 50 messages to fill gaps
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = await this.fetchMessages({
        until: nowSeconds,
        limit: 50,
        maxBatches: isFirstSync ? 10000 : 1,
        abortOnDuplicates: !isFirstSync, // Only abort on duplicates for returning users
        markUnread: !isFirstSync
      });

      if (this.debug) console.log(`History fetch completed. Total fetched: ${result.totalFetched}`);
      return result;
    } finally {
      this.isFetchingHistory = false;
      if (!skipSyncState) {
        endSync();
      }
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

  // ─── Unified Send Pipeline ─────────────────────────────────────────────

  /**
   * Unified NIP-59 gift-wrap delivery pipeline.
   * Handles: auth, relay discovery, temp connections, per-recipient gift-wrap,
   * publishWithDeadline, retry queue, self-wrap, DB save, and post-send hooks.
   *
   * @param recipients - npub list (length 1 = DM, length > 1 = group)
   * @param rumor - pre-built unsigned rumor event (kind 14, 15, or 7)
   * @param conversationId - for group DB persistence (required when recipients > 1)
   * @param conversation - the Conversation object (for group metadata)
   * @param messageDbFields - extra fields merged into the DB save call
   * @param skipDbSave - if true, skip messageRepo.saveMessage (used by reactions)
   */
  private async sendEnvelope(params: {
    recipients: string[];
    rumor: Partial<NostrEvent>;
    conversationId?: string;
    conversation?: Conversation;
    messageDbFields?: Record<string, unknown>;
    skipDbSave?: boolean;
  }): Promise<{ rumorId: string; selfGiftWrapId: string }> {
    const { recipients, rumor, conversationId, conversation, messageDbFields, skipDbSave } = params;

    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);

    const isGroup = recipients.length > 1;

    // Relay discovery (must happen before rumorId computation for NIP-17 relay hints)
    const senderRelays = await this.getMessagingRelays(senderNpub);

    let recipientRelaysMap: Map<string, string[]>;

    if (isGroup) {
      // Group: discover relays per participant (excluding sender)
      recipientRelaysMap = new Map();
      for (const npub of recipients) {
        if (npub !== senderNpub) {
          const relays = await this.getMessagingRelays(npub);
          if (relays.length > 0) {
            recipientRelaysMap.set(npub, relays);
          }
        }
      }
    } else {
      // DM: single recipient
      const recipientNpub = recipients[0];
      const relays = await this.getMessagingRelays(recipientNpub);
      if (relays.length === 0) {
        throw new Error('Contact has no messaging relays configured');
      }
      recipientRelaysMap = new Map([[recipientNpub, relays]]);
    }

    // NIP-17: Add relay hints to p-tags
    // Convert npub -> pubkey map for relay hints lookup
    const pubkeyToRelayHint = new Map<string, string>();
    for (const [npub, relays] of recipientRelaysMap) {
      const { data: pubkey } = nip19.decode(npub);
      if (relays.length > 0) {
        pubkeyToRelayHint.set(pubkey as string, relays[0]);
      }
    }

    // Update rumor p-tags with relay hints
    let hintsAdded = 0;
    if (rumor.tags) {
      rumor.tags = rumor.tags.map(tag => {
        if (tag[0] === 'p' && tag.length === 2) {
          const relayHint = pubkeyToRelayHint.get(tag[1]);
          if (relayHint) {
            hintsAdded++;
            return ['p', tag[1], relayHint];
          }
        }
        return tag;
      });
    }
    if (this.debug && hintsAdded > 0) {
      console.log(`[NIP-17] Added relay hints to ${hintsAdded} p-tag(s):`,
        rumor.tags?.filter(t => t[0] === 'p' && t.length === 3).map(t => `${t[1].substring(0,8)}...@${t[2]}`));
    }

    // Compute stable rumor ID (after relay hints are added to tags)
    // CRITICAL: Must assign id to rumor before serialization - 0xchat/nostr-dart requires it
    const rumorId = getEventHash(rumor as NostrEvent);
    rumor.id = rumorId;

    // Temporary relay connections
    const allRelays = new Set<string>(senderRelays);
    for (const relays of recipientRelaysMap.values()) {
      relays.forEach(r => allRelays.add(r));
    }

    if (this.debug) {
      console.log(`Sending ${isGroup ? 'group' : 'DM'} message to ${recipientRelaysMap.size} recipient(s)`);
      console.log('[NIP-17] Sender relays:', senderRelays);
      for (const [npub, relays] of recipientRelaysMap) {
        console.log(`[NIP-17] Recipient ${npub.substring(0, 15)}... relays:`, relays);
      }
    }

    for (const url of allRelays) {
      connectionManager.addTemporaryRelay(url);
    }

    setTimeout(() => {
      connectionManager.cleanupTemporaryConnections();
    }, 15000);

    // Create self-wrap first (used for relay status tracking ID and DB eventId)
    const selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s);

    // Calculate total desired relays for status tracking
    let totalDesiredRelays = senderRelays.length;
    for (const relays of recipientRelaysMap.values()) {
      totalDesiredRelays += relays.length;
    }

    // Initialize relay send status for UI
    if (isGroup) {
      initRelaySendStatus(selfGiftWrap.id, totalDesiredRelays, undefined, conversationId);
    } else {
      const recipientNpub = recipients[0];
      initRelaySendStatus(selfGiftWrap.id, totalDesiredRelays, recipientNpub);
    }

    let totalSuccessfulRelays = 0;

    // Send gift-wrap to each recipient using publishWithDeadline
    for (const [npub, relays] of recipientRelaysMap) {
      const { data: recipientPubkey } = nip19.decode(npub);
      const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s);

      const publishResult = await publishWithDeadline({
        connectionManager,
        event: giftWrap,
        relayUrls: relays,
        deadlineMs: 5000,
        onRelaySuccess: (url) => registerRelaySuccess(selfGiftWrap.id, url),
      });

      if (this.debug) {
        console.log(`[NIP-17] Publish to ${npub.substring(0, 15)}...:`, {
          success: publishResult.successfulRelays,
          failed: publishResult.failedRelays,
          timedOut: publishResult.timedOutRelays
        });
      }

      totalSuccessfulRelays += publishResult.successfulRelays.length;

      // Enqueue failed/timed-out relays for best-effort retry
      const successfulRelaySet = new Set(publishResult.successfulRelays);
      for (const url of relays) {
        if (!successfulRelaySet.has(url)) {
          await retryQueue.enqueue(giftWrap, url);
        }
      }
    }

    // Send self-wrap to sender's relays
    const selfPublishResult = await publishWithDeadline({
      connectionManager,
      event: selfGiftWrap,
      relayUrls: senderRelays,
      deadlineMs: 5000,
      onRelaySuccess: (url) => registerRelaySuccess(selfGiftWrap.id, url),
    });

    totalSuccessfulRelays += selfPublishResult.successfulRelays.length;

    const selfSuccessfulRelaySet = new Set(selfPublishResult.successfulRelays);
    for (const url of senderRelays) {
      if (!selfSuccessfulRelaySet.has(url)) {
        await retryQueue.enqueue(selfGiftWrap, url);
      }
    }

    // Check if at least one relay succeeded
    if (totalSuccessfulRelays === 0) {
      console.warn('Send failed to reach any relays', {
        conversationId,
        selfGiftWrapId: selfGiftWrap.id,
        recipientCount: recipientRelaysMap.size,
      });
      throw new Error('Failed to send message to any relay');
    }

    // DB save
    if (!skipDbSave) {
      const recipientNpub = isGroup
        ? (conversation?.participants.find(p => p !== senderNpub) || senderNpub)
        : recipients[0];

      const baseMessage: Record<string, unknown> = {
        recipientNpub,
        message: rumor.content || '',
        sentAt: (rumor.created_at || 0) * 1000,
        eventId: selfGiftWrap.id,
        rumorId,
        direction: 'sent',
        createdAt: Date.now(),
        rumorKind: rumor.kind,
      };

      // Add group fields
      if (isGroup && conversation) {
        baseMessage.conversationId = conversationId;
        baseMessage.participants = conversation.participants;
        baseMessage.senderNpub = senderNpub;
      }

      await messageRepo.saveMessage({ ...baseMessage, ...messageDbFields } as any);
    }

    // Post-send hooks
    if (isGroup && conversationId) {
      await conversationRepo.markActivity(conversationId);
    } else if (!isGroup) {
      await this.autoAddContact(recipients[0]);
    }

    return { rumorId, selfGiftWrapId: selfGiftWrap.id };
  }

  // ─── Public Send Methods (thin rumor-builder wrappers) ─────────────────

  public async sendMessage(
    recipientNpub: string | null,
    text: string,
    parentRumorId?: string,
    createdAtSeconds?: number,
    conversationId?: string,
    subject?: string
  ): Promise<string> {
    if (conversationId) {
      return this.sendGroupMessage(conversationId, text, subject);
    }

    if (!recipientNpub) {
      throw new Error('recipientNpub required for 1-on-1 messages');
    }

    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

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

    const { rumorId } = await this.sendEnvelope({
      recipients: [recipientNpub],
      rumor,
      messageDbFields: { message: text, parentRumorId },
    });

    return rumorId;
  }

  public async sendGroupMessage(
    conversationId: string,
    text: string,
    subject?: string
  ): Promise<string> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const conversation = await conversationRepo.getConversation(conversationId);
    if (!conversation || !conversation.isGroup) {
      throw new Error('Group conversation not found');
    }

    const senderPubkey = await s.getPublicKey();

    // Build p-tags for all participants (excluding self per NIP-17)
    const participantPubkeys = conversation.participants.map(npub => {
      const { data } = nip19.decode(npub);
      return data as string;
    });
    if (!participantPubkeys.includes(senderPubkey)) {
      participantPubkeys.push(senderPubkey);
    }

    const pTags: string[][] = participantPubkeys
      .filter(p => p !== senderPubkey)
      .map(p => ['p', p]);

    const tags: string[][] = [...pTags];
    if (subject) {
      tags.push(['subject', subject]);
    }

    const rumor: Partial<NostrEvent> = {
      kind: 14,
      pubkey: senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: text,
      tags
    };

    const { rumorId } = await this.sendEnvelope({
      recipients: conversation.participants,
      rumor,
      conversationId,
      conversation,
      messageDbFields: { message: text },
    });

    return rumorId;
  }

  public async sendLocationMessage(
    recipientNpub: string | null,
    latitude: number,
    longitude: number,
    createdAtSeconds?: number,
    conversationId?: string
  ): Promise<string> {
    if (conversationId) {
      return this.sendGroupLocationMessage(conversationId, latitude, longitude, createdAtSeconds);
    }

    if (!recipientNpub) {
      throw new Error('recipientNpub required for 1-on-1 messages');
    }

    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

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

    const { rumorId } = await this.sendEnvelope({
      recipients: [recipientNpub],
      rumor,
      messageDbFields: { location: { latitude, longitude } },
    });

    return rumorId;
  }

  private async sendGroupLocationMessage(
    conversationId: string,
    latitude: number,
    longitude: number,
    createdAtSeconds?: number
  ): Promise<string> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const conversation = await conversationRepo.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Group conversation not found');
    }

    const senderPubkey = await s.getPublicKey();

    const participantPubkeys = conversation.participants.map(npub => {
      const { data } = nip19.decode(npub);
      return data as string;
    });
    if (!participantPubkeys.includes(senderPubkey)) {
      participantPubkeys.push(senderPubkey);
    }

    const pTags: string[][] = participantPubkeys
      .filter(p => p !== senderPubkey)
      .map(p => ['p', p]);

    const locationValue = `${latitude},${longitude}`;

    const rumor: Partial<NostrEvent> = {
      kind: 14,
      pubkey: senderPubkey,
      created_at: createdAtSeconds ?? Math.floor(Date.now() / 1000),
      content: `geo:${locationValue}`,
      tags: [...pTags, ['location', locationValue]]
    };

    const { rumorId } = await this.sendEnvelope({
      recipients: conversation.participants,
      rumor,
      conversationId,
      conversation,
      messageDbFields: { location: { latitude, longitude } },
    });

    return rumorId;
  }

  private mediaTypeToMime(type: 'image' | 'video' | 'audio' | 'file'): string {
    if (type === 'image') {
      return 'image/jpeg';
    }
    if (type === 'video') {
      return 'video/mp4';
    }
    if (type === 'audio') {
      return 'audio/mpeg';
    }
    return 'application/octet-stream';
  }

  private async uploadEncryptedMedia(
    encrypted: EncryptedFileResult,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    mimeType: string,
    blossomServers: string[]
  ): Promise<string> {
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
    recipientNpub: string | null,
    file: File,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    createdAtSeconds?: number,
    conversationId?: string,
    mediaMeta?: { width?: number; height?: number; blurhash?: string }
  ): Promise<string> {
    if (conversationId) {
      return this.sendGroupFileMessage(conversationId, file, mediaType, createdAtSeconds, mediaMeta);
    }

    if (!recipientNpub) {
      throw new Error('recipientNpub required for 1-on-1 messages');
    }

    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

    // Encrypt file with AES-GCM
    const encrypted = await encryptFileWithAesGcm(file);
    const mimeType = file.type || this.mediaTypeToMime(mediaType);

    const senderProfile = await profileRepo.getProfileIgnoreTTL(senderNpub);
    const blossomServers = (senderProfile as any)?.mediaServers ?? [];
    const fileUrl = await this.uploadEncryptedMedia(encrypted, mediaType, mimeType, blossomServers);

    const now = createdAtSeconds ?? Math.floor(Date.now() / 1000);

    const tags: string[][] = [
      ['p', recipientPubkey as string],
      ['file-type', mimeType],
      ['encryption-algorithm', 'aes-gcm'],
      ['decryption-key', encrypted.key],
      ['decryption-nonce', encrypted.nonce],
      ['size', encrypted.size.toString()],
      ['x', encrypted.hashEncrypted]
    ];
    if (encrypted.hashPlain) {
      tags.push(['ox', encrypted.hashPlain]);
    }
    if (mediaMeta?.width && mediaMeta?.height) {
      tags.push(['dim', `${mediaMeta.width}x${mediaMeta.height}`]);
    }
    if (mediaMeta?.blurhash) {
      tags.push(['blurhash', mediaMeta.blurhash]);
    }

    const rumor: Partial<NostrEvent> = {
      kind: 15,
      pubkey: senderPubkey,
      created_at: now,
      content: fileUrl,
      tags
    };

    const { rumorId } = await this.sendEnvelope({
      recipients: [recipientNpub],
      rumor,
      messageDbFields: {
        message: '',
        fileUrl,
        fileType: mimeType,
        fileSize: encrypted.size,
        fileHashEncrypted: encrypted.hashEncrypted,
        fileHashPlain: encrypted.hashPlain,
        fileEncryptionAlgorithm: 'aes-gcm',
        fileKey: encrypted.key,
        fileNonce: encrypted.nonce,
        fileWidth: mediaMeta?.width,
        fileHeight: mediaMeta?.height,
        fileBlurhash: mediaMeta?.blurhash,
      },
    });

    return rumorId;
  }

  private async sendGroupFileMessage(
    conversationId: string,
    file: File,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    createdAtSeconds?: number,
    mediaMeta?: { width?: number; height?: number; blurhash?: string }
  ): Promise<string> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const conversation = await conversationRepo.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Group conversation not found');
    }

    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);

    // Encrypt file with AES-GCM
    const encrypted = await encryptFileWithAesGcm(file);
    const mimeType = file.type || this.mediaTypeToMime(mediaType);

    const senderProfile = await profileRepo.getProfileIgnoreTTL(senderNpub);
    const blossomServers = (senderProfile as any)?.mediaServers ?? [];
    const fileUrl = await this.uploadEncryptedMedia(encrypted, mediaType, mimeType, blossomServers);

    // Build p-tags for all participants (excluding self per NIP-17)
    const participantPubkeys = conversation.participants.map(npub => {
      const { data } = nip19.decode(npub);
      return data as string;
    });
    if (!participantPubkeys.includes(senderPubkey)) {
      participantPubkeys.push(senderPubkey);
    }

    const pTags: string[][] = participantPubkeys
      .filter(p => p !== senderPubkey)
      .map(p => ['p', p]);

    const now = createdAtSeconds ?? Math.floor(Date.now() / 1000);

    const tags: string[][] = [
      ...pTags,
      ['file-type', mimeType],
      ['encryption-algorithm', 'aes-gcm'],
      ['decryption-key', encrypted.key],
      ['decryption-nonce', encrypted.nonce],
      ['size', encrypted.size.toString()],
      ['x', encrypted.hashEncrypted]
    ];
    if (encrypted.hashPlain) {
      tags.push(['ox', encrypted.hashPlain]);
    }
    if (mediaMeta?.width && mediaMeta?.height) {
      tags.push(['dim', `${mediaMeta.width}x${mediaMeta.height}`]);
    }
    if (mediaMeta?.blurhash) {
      tags.push(['blurhash', mediaMeta.blurhash]);
    }

    const rumor: Partial<NostrEvent> = {
      kind: 15,
      pubkey: senderPubkey,
      created_at: now,
      content: fileUrl,
      tags
    };

    const { rumorId } = await this.sendEnvelope({
      recipients: conversation.participants,
      rumor,
      conversationId,
      conversation,
      messageDbFields: {
        message: '',
        fileUrl,
        fileType: mimeType,
        fileSize: encrypted.size,
        fileHashEncrypted: encrypted.hashEncrypted,
        fileHashPlain: encrypted.hashPlain,
        fileEncryptionAlgorithm: 'aes-gcm',
        fileKey: encrypted.key,
        fileNonce: encrypted.nonce,
        fileWidth: mediaMeta?.width,
        fileHeight: mediaMeta?.height,
        fileBlurhash: mediaMeta?.blurhash,
      },
    });

    return rumorId;
  }

  public async sendReaction(
    recipientNpub: string,
    targetMessage: { recipientNpub: string; eventId: string; rumorId?: string; direction: 'sent' | 'received' },
    emoji: '👍' | '👎' | '❤️' | '😂'
  ): Promise<void> {
    if (!targetMessage.rumorId) {
      console.warn('Cannot react to message without rumorId (likely old message)');
      return;
    }
    const targetId = targetMessage.rumorId;

    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

    let targetAuthorPubkey: string;
    if (targetMessage.direction === 'received') {
      targetAuthorPubkey = recipientPubkey as string;
    } else {
      targetAuthorPubkey = senderPubkey;
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

    const { selfGiftWrapId } = await this.sendEnvelope({
      recipients: [recipientNpub],
      rumor,
      skipDbSave: true,
    });

    const reaction: Omit<Reaction, 'id'> = {
      targetEventId: targetId,
      reactionEventId: selfGiftWrapId,
      authorNpub: senderNpub,
      emoji,
      createdAt: Date.now()
    };

    await reactionRepo.upsertReaction(reaction);
    reactionsStore.applyReactionUpdate(reaction);
  }

  public async sendGroupReaction(
    conversationId: string,
    targetMessage: { eventId: string; rumorId?: string; direction: 'sent' | 'received'; senderNpub?: string },
    emoji: '👍' | '👎' | '❤️' | '😂'
  ): Promise<void> {
    if (!targetMessage.rumorId) {
      console.warn('Cannot react to message without rumorId (likely old message)');
      return;
    }
    const targetId = targetMessage.rumorId;

    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const conversation = await conversationRepo.getConversation(conversationId);
    if (!conversation || !conversation.isGroup) {
      throw new Error('Group conversation not found');
    }

    const senderPubkey = await s.getPublicKey();
    const senderNpub = nip19.npubEncode(senderPubkey);

    let targetAuthorPubkey: string;
    if (targetMessage.direction === 'received' && targetMessage.senderNpub) {
      const { data } = nip19.decode(targetMessage.senderNpub);
      targetAuthorPubkey = data as string;
    } else {
      targetAuthorPubkey = senderPubkey;
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

    const { selfGiftWrapId } = await this.sendEnvelope({
      recipients: conversation.participants,
      rumor,
      conversationId,
      conversation,
      skipDbSave: true,
    });

    const reaction: Omit<Reaction, 'id'> = {
      targetEventId: targetId,
      reactionEventId: selfGiftWrapId,
      authorNpub: senderNpub,
      emoji,
      createdAt: Date.now()
    };

    await reactionRepo.upsertReaction(reaction);
    reactionsStore.applyReactionUpdate(reaction);
  }
 
   private async createGiftWrap(rumor: Partial<NostrEvent>, recipientPubkey: string, s: any): Promise<NostrEvent> {
    // 1. Encrypt Rumor -> Seal
    const rumorJson = JSON.stringify(rumor);
    if (this.debug) {
      console.log('[NIP-17] Rumor structure:', rumor);
    }
    const encryptedRumor = await s.encrypt(recipientPubkey, rumorJson);
    if (this.debug) {
      console.log('[NIP-17] Seal content (encrypted rumor) format:', {
        contentStart: encryptedRumor.substring(0, 30) + '...',
        hasV2Prefix: encryptedRumor.startsWith('v2:'),
        firstChar: encryptedRumor[0],
        usesUrlSafeBase64: encryptedRumor.includes('_') || encryptedRumor.includes('-')
      });
    }

    const sealPubkey = await s.getPublicKey();
    const seal: Partial<NostrEvent> = {
      kind: 13,
      pubkey: sealPubkey,
      created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800), // Randomize up to 2 days in past per NIP-17
      content: encryptedRumor,
      tags: []
    };

    if (this.debug) {
      console.log('[NIP-17] createGiftWrap pubkey check:', {
        rumorPubkey: rumor.pubkey?.substring(0, 8) + '...',
        sealPubkey: sealPubkey.substring(0, 8) + '...',
        match: rumor.pubkey === sealPubkey
      });
    }

    const signedSeal = await s.signEvent(seal);
    const sealJson = JSON.stringify(signedSeal);

    // 2. Encrypt Seal -> Gift Wrap (using Ephemeral Key)
    const ephemeralPrivKey = generateSecretKey();
    const ephemeralPubkey = getPublicKey(ephemeralPrivKey);

    const conversationKey = nip44.v2.utils.getConversationKey(ephemeralPrivKey, recipientPubkey);
    const encryptedSeal = nip44.v2.encrypt(sealJson, conversationKey);

    if (this.debug) {
      console.log('[NIP-17] Gift wrap content format:', {
        contentStart: encryptedSeal.substring(0, 30) + '...',
        contentLength: encryptedSeal.length,
        hasV2Prefix: encryptedSeal.startsWith('v2:'),
        firstChar: encryptedSeal[0],
        usesUrlSafeBase64: encryptedSeal.includes('_') || encryptedSeal.includes('-')
      });
    }

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
