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
import { updateReadReceipt } from '$lib/stores/readReceipts';
import { encryptFileWithAesGcm, type EncryptedFileResult } from './FileEncryption';
import { uploadToBlossomServers } from './BlossomUpload';
import { getMediaPreviewLabel, getLocationPreviewLabel, getCallEventPreviewLabel } from '$lib/utils/mediaPreview';
import { contactSyncService } from './ContactSyncService';
import { conversationRepo, deriveConversationId, isGroupConversationId, generateGroupTitle } from '$lib/db/ConversationRepository';
import type { Conversation } from '$lib/db/db';
import {
    CALL_HISTORY_KIND,
    NIP_AC_GIFT_WRAP_KIND,
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT,
    NIP_AC_KIND_RENEGOTIATE,
    NIP_AC_STALENESS_SECONDS,
    NIP_AC_PROCESSED_ID_CAPACITY
} from '$lib/core/voiceCall/constants';
import type { NipAcGroupSendContext } from '$lib/core/voiceCall/types';
import {
    createNipAcGiftWrap,
    unwrapNipAcGiftWrap,
    buildGroupExtraTags
} from '$lib/core/voiceCall/nipAcGiftWrap';
import { followGate } from '$lib/core/voiceCall/followGate';
import { isAndroidNative } from '$lib/core/NativeDialogs';

const READ_RECEIPT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;
const READ_RECEIPT_EXPIRATION_MS = READ_RECEIPT_EXPIRATION_SECONDS * 1000;

/**
 * Persisted call-event types authored on terminal call transitions. Mirrors
 * the union in `Message.callEventType` (sans the legacy fall-through values
 * 'outgoing'/'incoming' which are not authored by current code) and the
 * VoiceCallService's `AuthoredCallEventType`.
 *
 * Defined here rather than imported from VoiceCallService to avoid a
 * circular module load — Messaging lazy-imports VoiceCallService at runtime
 * for the signal-sender wiring.
 */
export type AuthoredCallEventType =
    | 'missed'
    | 'ended'
    | 'no-answer'
    | 'declined'
    | 'busy'
    | 'failed'
    | 'cancelled';

 export class MessagingService {
    private debug: boolean = false;
    private isFetchingHistory: boolean = false;
    private lastHistoryFetch: number = 0;
    private readonly HISTORY_FETCH_DEBOUNCE = 5000; // 5 seconds

    private liveSeenEventIds: Set<string> = new Set();

    /** Validate that a parsed object has the minimum shape of a NostrEvent */
    private isValidEventShape(obj: unknown): obj is NostrEvent {
        return (
            obj !== null &&
            typeof obj === 'object' &&
            typeof (obj as any).kind === 'number' &&
            typeof (obj as any).pubkey === 'string'
        );
    }
 
    private activeSubscriptionUnsub: (() => void) | null = null;
    private activeSubscriptionPubkey: string | null = null;

    // Timestamp (seconds) when the current session started. Used to suppress
    // notifications for messages sent before the app was opened.
    private sessionStartedAt: number = 0;

    // When true, autoAddContact skips publishing to Kind 30000 (used during bulk sync)
    private _deferContactPublish: boolean = false;

    // Short-lived relay cache for voice call signals (avoids repeated DB lookups per ICE candidate)
    private voiceCallRelayCache = new Map<string, { relays: string[], cachedAt: number }>();
    private readonly VOICE_RELAY_CACHE_TTL = 60_000; // 60 seconds

    /**
     * NIP-AC dedup ring: inner-event IDs of kind-21059 wraps already
     * dispatched. Bounded by NIP_AC_PROCESSED_ID_CAPACITY; oldest entries
     * evicted FIFO. Defends against the same signaling event being
     * delivered by multiple relays.
     */
    private nipAcProcessedIds: string[] = [];
    private nipAcProcessedIdSet: Set<string> = new Set();
 
    // Listen for incoming messages
    public listenForMessages(publicKey: string): () => void {
 
     // Subscribe to all gift-wraps for this user.
     // We intentionally omit `since` because gift-wrap events
     // use randomized created_at timestamps (NIP-59 style),
     // which can place new messages in the past. We rely on
     // messageRepo.hasMessage() for deduplication.
     // Subscribe to BOTH NIP-17 chat gift wraps (kind 1059) and NIP-AC
     // ephemeral signaling wraps (kind 21059). The dispatch branches on
     // event.kind in handleGiftWrap.
     const filters = [{
       kinds: [1059, NIP_AC_GIFT_WRAP_KIND],
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
 
      // Register voice call callbacks (lazy import to avoid circular dependency).
     // After the NIP-AC migration, VoiceCallService receives typed senders
     // (one per inner-event kind) instead of a single JSON-serialising
     // sendSignal callback.
      import('$lib/core/voiceCall/VoiceCallService').then(({ voiceCallService }) => {
         voiceCallService.registerNipAcSenders({
             sendOffer: (npub, callId, sdp, opts) =>
                 this.sendCallOffer(npub, callId, sdp, opts),
             sendAnswer: (npub, callId, sdp) =>
                 this.sendCallAnswer(npub, callId, sdp),
             sendIceCandidate: (npub, callId, candidate, sdpMid, sdpMLineIndex) =>
                 this.sendIceCandidate(npub, callId, candidate, sdpMid, sdpMLineIndex),
             sendHangup: (npub, callId, reason) =>
                 this.sendCallHangup(npub, callId, reason),
             sendReject: (npub, callId, reason) =>
                 this.sendCallReject(npub, callId, reason),
             sendRenegotiate: (npub, callId, sdp) =>
                 this.sendCallRenegotiate(npub, callId, sdp)
         });
         voiceCallService.registerCallEventCreator(
             (recipientNpub, type, duration, callId, initiatorPubkeyHex, callMediaType) =>
                 this.createCallEventMessage(
                     recipientNpub, type, duration, callId, initiatorPubkeyHex, callMediaType)
         );
         voiceCallService.registerLocalCallEventCreator(
             (recipientNpub, type, callId, initiatorPubkeyHex, callMediaType) =>
                 this.createLocalCallEventMessage(
                     recipientNpub, type, callId, initiatorPubkeyHex, callMediaType)
         );
         if (voiceCallService.registerGroupCallEventCreator) {
             voiceCallService.registerGroupCallEventCreator(
                 (conversationId, participantNpubs, type, groupCallId,
                     initiatorNpub, duration, callMediaType) =>
                     this.createGroupCallEventMessage(
                         conversationId, participantNpubs, type, groupCallId,
                         initiatorNpub, duration, callMediaType)
             );
         }
         if (voiceCallService.registerLocalGroupCallEventCreator) {
             voiceCallService.registerLocalGroupCallEventCreator(
                 (conversationId, participantNpubs, type, groupCallId,
                     initiatorNpub, callMediaType) =>
                     this.createLocalGroupCallEventMessage(
                         conversationId, participantNpubs, type, groupCallId,
                         initiatorNpub, callMediaType)
             );
         }
     });

     return unsub;
    }

    /**
     * Process a raw gift-wrap event that was queued by the native background service.
     * Runs the same dedup + decrypt + store pipeline as the live subscription handler.
     */
    public async processGiftWrapFromNativeQueue(event: NostrEvent): Promise<void> {
        if (this.liveSeenEventIds.has(event.id)) {
            return;
        }
        this.liveSeenEventIds.add(event.id);

        if (await messageRepo.hasMessage(event.id)) {
            return;
        }

        await this.handleGiftWrap(event);
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

     reactionRepo.deleteExpiredReadReceipts(READ_RECEIPT_EXPIRATION_MS)
       .then(removed => {
         if (removed > 0) console.log(`[ReadReceipt] startup sweep removed ${removed} expired ✓ receipt(s)`);
       })
       .catch(err => console.error('[ReadReceipt] startup sweep failed:', err));

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

    // Branch on outer wrap kind:
    //   1059 → NIP-17/NIP-59 chat & call-history pipeline (3-layer with seal)
    //   21059 → NIP-AC ephemeral signaling pipeline (single-layer, signed inner)
    if (event.kind === NIP_AC_GIFT_WRAP_KIND) {
      console.log(
        '[NIP-AC][Recv] kind 21059 wrap received id=' +
          (event.id?.substring(0, 8) ?? '?')
      );
      await this.handleNipAcWrap(event, s);
      return;
    }

    console.log('[VoiceCall][Recv] gift wrap received id=' + (event.id?.substring(0, 8) ?? '?'));
    try {
      // Step 1: Decrypt Gift Wrap
      if (!event.content || typeof event.content !== 'string') {
        console.warn('[NIP-17] Gift wrap event has no content to decrypt, id:', event.id?.substring(0, 8));
        return;
      }
      const decryptedGiftWrap = await s.decrypt(event.pubkey, event.content);
      const sealCandidate = JSON.parse(decryptedGiftWrap);
      if (!this.isValidEventShape(sealCandidate)) {
        throw new Error('Decrypted gift wrap is not a valid Nostr event');
      }
      const seal = sealCandidate as NostrEvent;

      if (seal.kind !== 13) throw new Error(`Expected Seal (Kind 13), got ${seal.kind}`);

      // NIP-17: Verify seal signature to prevent impersonation attacks
      if (!verifyEvent(seal)) {
        throw new Error('Invalid seal signature - possible forgery attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal signature verified successfully');

      // NIP-44 ciphertext must be at least 132 base64 characters
      if (!seal.content || seal.content.length < 132) {
        console.warn(`[NIP-17] Skipping seal with invalid content (length: ${seal.content?.length}, pubkey: ${seal.pubkey})`);
        return;
      }

      // Step 2: Decrypt Seal
      const decryptedSeal = await s.decrypt(seal.pubkey, seal.content);
      const rumorCandidate = JSON.parse(decryptedSeal);
      if (!this.isValidEventShape(rumorCandidate) || !Array.isArray(rumorCandidate.tags)) {
        throw new Error('Decrypted rumor is not a valid Nostr event');
      }
      const rumor = rumorCandidate as NostrEvent;

      // Support Kind 14 (text), 15 (files), 7 (reactions), and CALL_HISTORY_KIND (call events).
      // Kind 16 (NIP-18 Generic Repost) is explicitly rejected — see
      // openspec/changes/move-call-history-to-kind-1405 for the rationale.
      if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7 && rumor.kind !== CALL_HISTORY_KIND) {
        throw new Error(`Expected Rumor (Kind 14, 15, 7, or ${CALL_HISTORY_KIND}), got ${rumor.kind}`);
      }

      // NIP-17: Verify seal pubkey matches rumor pubkey to prevent sender impersonation
      if (seal.pubkey !== rumor.pubkey) {
        throw new Error('Seal pubkey does not match rumor pubkey - possible impersonation attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal/rumor pubkey match verified:', seal.pubkey.substring(0, 8) + '...');

      // Validate p tags in rumor - for group messages, my pubkey must be in at least one p-tag
      // For self-sent messages, sender pubkey equals my pubkey
      const myPubkey = await s.getPublicKey();
      const pTags = rumor.tags.filter(t => Array.isArray(t) && t.length >= 2 && t[0] === 'p');
      const myPubkeyInPTags = pTags.some(t => t[1] === myPubkey);

      if (!myPubkeyInPTags && rumor.pubkey !== myPubkey) {
        throw new Error('Received rumor does not include my public key in p-tags');
      }

      // NIP-40: drop rumors whose expiration has passed. Generic — applies to any
      // rumor kind (voice-call signals, read receipts, etc.). Tolerates missing
      // or non-numeric expiration tag.
      const expirationTag = rumor.tags?.find((t: string[]) => t[0] === 'expiration');
      if (expirationTag) {
        const expiresAt = parseInt(expirationTag[1], 10);
        if (!Number.isNaN(expiresAt) && expiresAt < Math.floor(Date.now() / 1000)) {
          if (this.debug) {
            console.log('[NIP-40] Dropping expired rumor', { kind: rumor.kind, expiresAt });
          }
          return;
        }
      }

      if (rumor.kind === 7) {
        await this.processReactionRumor(rumor, event.id);
        return;
      }

      // Legacy nospeak voice-call rumors (kind 14 with ['type','voice-call'])
      // are dropped silently after the NIP-AC migration. Older clients on the
      // pre-migration build will never reach a current client this way.
      const legacyVoiceCallTag = rumor.tags?.find(
        (t: string[]) => t[0] === 'type' && t[1] === 'voice-call'
      );
      if (legacyVoiceCallTag) {
        if (this.debug) {
          console.log(
            '[NIP-AC] dropping legacy voice-call rumor (pre-NIP-AC build)',
            { id: event.id?.substring(0, 8) }
          );
        }
        return;
      }

      this.processRumor(rumor, event.id);


    } catch (e) {
      console.error('Failed to unwrap/decrypt message:', e);
    }
  }

  /**
   * Handle a NIP-AC kind-21059 ephemeral gift wrap. Decrypts, verifies the
   * inner event signature, applies staleness + dedup + self-event-filter
   * + follow-gate, and dispatches surviving inner events to
   * VoiceCallService.
   */
  private async handleNipAcWrap(event: NostrEvent, s: any): Promise<void> {
    try {
      const decryptFn = (senderPubkey: string, content: string) =>
        s.decrypt(senderPubkey, content) as Promise<string>;
      const inner = await unwrapNipAcGiftWrap(event, decryptFn);
      if (!inner) {
        // unwrap already logged the cause (decrypt failure / bad shape /
        // invalid signature). Drop.
        return;
      }

      // Staleness: drop inner events whose created_at is more than
      // NIP_AC_STALENESS_SECONDS in the past. NIP-AC compensates for the
      // absence of a NIP-40 expiration tag with this check.
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec - inner.created_at > NIP_AC_STALENESS_SECONDS) {
        if (this.debug) {
          console.log('[NIP-AC] drop stale inner event', {
            kind: inner.kind,
            ageSec: nowSec - inner.created_at
          });
        }
        return;
      }

      // Dedup by inner event ID.
      if (this.nipAcProcessedIdSet.has(inner.id)) {
        if (this.debug) {
          console.log('[NIP-AC] drop duplicate inner event', {
            id: inner.id.substring(0, 8)
          });
        }
        return;
      }
      this.nipAcProcessedIdSet.add(inner.id);
      this.nipAcProcessedIds.push(inner.id);
      if (this.nipAcProcessedIds.length > NIP_AC_PROCESSED_ID_CAPACITY) {
        const evicted = this.nipAcProcessedIds.shift();
        if (evicted) this.nipAcProcessedIdSet.delete(evicted);
      }

      // Validate kind range. NIP-AC defines 25050-25055 inclusive. Drop
      // unknown kinds. The renegotiation kind 25055 was added by the
      // `add-call-renegotiation` change to support mid-call SDP changes
      // (e.g., voice→video upgrade).
      const kind = inner.kind;
      if (
        kind !== NIP_AC_KIND_OFFER &&
        kind !== NIP_AC_KIND_ANSWER &&
        kind !== NIP_AC_KIND_ICE &&
        kind !== NIP_AC_KIND_HANGUP &&
        kind !== NIP_AC_KIND_REJECT &&
        kind !== NIP_AC_KIND_RENEGOTIATE
      ) {
        if (this.debug) {
          console.log('[NIP-AC] drop unsupported inner kind', { kind });
        }
        return;
      }

      const myPubkey = await s.getPublicKey();
      const isSelf = inner.pubkey === myPubkey;

      // Self-event filter (NIP-AC §"Self-Event Filtering"):
      //   - Self ICE / Hangup / Renegotiate → always ignore
      //   - Self Answer / Reject → ignored unless local status is
      //     'incoming-ringing' AND call-id matches; in that case
      //     transition to answered-elsewhere / rejected-elsewhere.
      if (isSelf) {
        if (
          kind === NIP_AC_KIND_ICE ||
          kind === NIP_AC_KIND_HANGUP ||
          kind === NIP_AC_KIND_RENEGOTIATE
        ) {
          return;
        }
        if (kind === NIP_AC_KIND_ANSWER || kind === NIP_AC_KIND_REJECT) {
          try {
            const { voiceCallService } = await import(
              '$lib/core/voiceCall/VoiceCallService'
            );
            if (kind === NIP_AC_KIND_ANSWER) {
              await voiceCallService.handleSelfAnswer(inner);
            } else {
              await voiceCallService.handleSelfReject(inner);
            }
          } catch (err) {
            console.error('[NIP-AC] self-event handler failed', err);
          }
          return;
        }
        // Self Offer is a degenerate case (calling yourself). Drop.
        return;
      }

      // Follow-gate: only Call Offer (kind 25050) is gated. In-progress
      // signaling kinds (Answer/ICE/Hangup/Reject) bypass the gate.
      if (kind === NIP_AC_KIND_OFFER) {
        // Trigger initial load if cache is cold; result is awaited so
        // first-call-after-startup races toward "loaded" rather than
        // dropping forever. If the load is in flight when this runs,
        // the same promise is reused.
        await followGate.ensureLoaded();
        if (!followGate.isLoaded()) {
          if (this.debug) {
            console.log('[NIP-AC] drop offer; contact list not loaded');
          }
          return;
        }
        if (!followGate.isFollowed(inner.pubkey)) {
          if (this.debug) {
            console.log('[NIP-AC] drop offer from non-followed pubkey', {
              sender: inner.pubkey.substring(0, 8)
            });
          }
          return;
        }
      }

      // On Android, the native NativeBackgroundMessagingService is the
      // authoritative dispatcher for ALL NIP-AC inner kinds (offer /
      // answer / ICE / hangup / reject / renegotiate). Skip the JS
      // dispatch here so we don't double-handle (which would inject
      // duplicate ICE candidates into the peer connection and corrupt
      // the state machine), and so the JS state machine doesn't enter
      // incoming-ringing with no overlay to clear it.
      if (
        isAndroidNative() &&
        (kind === NIP_AC_KIND_OFFER ||
          kind === NIP_AC_KIND_ANSWER ||
          kind === NIP_AC_KIND_ICE ||
          kind === NIP_AC_KIND_HANGUP ||
          kind === NIP_AC_KIND_REJECT ||
          kind === NIP_AC_KIND_RENEGOTIATE)
      ) {
        if (this.debug) {
          console.log(
            '[NIP-AC] skip JS dispatch on Android (native authoritative)',
            { kind }
          );
        }
        return;
      }

      try {
        const { voiceCallService } = await import(
          '$lib/core/voiceCall/VoiceCallService'
        );
        await voiceCallService.handleNipAcEvent(inner);
      } catch (err) {
        console.error('[NIP-AC] dispatch failed', err);
      }
    } catch (err) {
      console.error('[NIP-AC] handleNipAcWrap failed', err);
    }
  }

  private async processGiftWrapToMessage(event: NostrEvent): Promise<any | null> {
    const s = get(signer);
    const user = get(currentUser);
    if (!s || !user) return null;

    try {
      // Step 1: Decrypt Gift Wrap
      if (!event.content || typeof event.content !== 'string') {
        console.warn('[NIP-17] Gift wrap event has no content to decrypt, id:', event.id?.substring(0, 8));
        return null;
      }
      const decryptedGiftWrap = await s.decrypt(event.pubkey, event.content);
      const sealCandidate = JSON.parse(decryptedGiftWrap);
      if (!this.isValidEventShape(sealCandidate)) {
        throw new Error('Decrypted gift wrap is not a valid Nostr event');
      }
      const seal = sealCandidate as NostrEvent;

      if (seal.kind !== 13) throw new Error(`Expected Seal (Kind 13), got ${seal.kind}`);

      // NIP-17: Verify seal signature to prevent impersonation attacks
      if (!verifyEvent(seal)) {
        throw new Error('Invalid seal signature - possible forgery attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal signature verified successfully (processGiftWrap)');

      // NIP-44 ciphertext must be at least 132 base64 characters
      if (!seal.content || seal.content.length < 132) {
        console.warn(`[NIP-17] Skipping seal with invalid content (length: ${seal.content?.length}, pubkey: ${seal.pubkey})`);
        return null;
      }

      // Step 2: Decrypt Seal
      const decryptedSeal = await s.decrypt(seal.pubkey, seal.content);
      const rumorCandidate = JSON.parse(decryptedSeal);
      if (!this.isValidEventShape(rumorCandidate) || !Array.isArray(rumorCandidate.tags)) {
        throw new Error('Decrypted rumor is not a valid Nostr event');
      }
      const rumor = rumorCandidate as NostrEvent;

      // Support Kind 14 (text), 15 (files), 7 (reactions), and CALL_HISTORY_KIND (call events).
      // Kind 16 (NIP-18 Generic Repost) is explicitly rejected — see
      // openspec/changes/move-call-history-to-kind-1405 for the rationale.
      if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7 && rumor.kind !== CALL_HISTORY_KIND) {
        throw new Error(`Expected Rumor (Kind 14, 15, 7, or ${CALL_HISTORY_KIND}), got ${rumor.kind}`);
      }

      // NIP-17: Verify seal pubkey matches rumor pubkey to prevent sender impersonation
      if (seal.pubkey !== rumor.pubkey) {
        throw new Error('Seal pubkey does not match rumor pubkey - possible impersonation attempt');
      }
      if (this.debug) console.log('[NIP-17] Seal/rumor pubkey match verified (processGiftWrap):', seal.pubkey.substring(0, 8) + '...');

      // Validate p tags in rumor - for group messages, my pubkey must be in at least one p-tag
      // For self-sent messages, sender pubkey equals my pubkey
      const myPubkey = await s.getPublicKey();
      const pTags = rumor.tags.filter(t => Array.isArray(t) && t.length >= 2 && t[0] === 'p');
      const myPubkeyInPTags = pTags.some(t => t[1] === myPubkey);

      if (!myPubkeyInPTags && rumor.pubkey !== myPubkey) {
        throw new Error('Received rumor does not include my public key in p-tags');
      }

      // NIP-40: drop rumors whose expiration has passed. See handleGiftWrap.
      const expirationTag = rumor.tags?.find((t: string[]) => t[0] === 'expiration');
      if (expirationTag) {
        const expiresAt = parseInt(expirationTag[1], 10);
        if (!Number.isNaN(expiresAt) && expiresAt < Math.floor(Date.now() / 1000)) {
          if (this.debug) {
            console.log('[NIP-40] Dropping expired rumor (native queue)', { kind: rumor.kind, expiresAt });
          }
          return null;
        }
      }

      if (rumor.kind === 7) {
        await this.processReactionRumor(rumor, event.id);
        return null;
      }

      // Skip voice-call signaling rumors — they are ephemeral signals, not chat
      // messages, and must never be persisted to the message DB. Mirror the live-
      // subscription handling in handleGiftWrap. We do NOT dispatch to
      // voiceCallService from this path: the history-fetch / native-queue contexts
      // are not appropriate places to wake up a call. Live signals are handled by
      // handleGiftWrap; this filter prevents stale signals from old calls being
      // resurrected as chat-history entries.
      const voiceCallTag = rumor.tags?.find((t: string[]) => t[0] === 'type' && t[1] === 'voice-call');
      if (voiceCallTag) {
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
      
      // Extract all p-tags and compute unique participant set (p-tags + sender).
      // NIP-17: "The set of pubkey + p tags defines a chat room."
      // Some clients (e.g. Amethyst) redundantly include the sender in p-tags,
      // so we must deduplicate before deciding if this is a group chat.
      const pTags = rumor.tags.filter(t => Array.isArray(t) && t.length >= 2 && t[0] === 'p');
      const pTagPubkeys = pTags.map(t => t[1]);
      const allParticipantPubkeys = [...new Set([...pTagPubkeys, rumor.pubkey])];
      const otherParticipants = allParticipantPubkeys.filter(p => p !== myPubkey);
      const isGroup = otherParticipants.length > 1;
      
      // Determine direction
      const direction: 'sent' | 'received' = rumor.pubkey === myPubkey ? 'sent' : 'received';
      
      // For group messages: all unique pubkeys = participants
      // For 1-on-1: use traditional partnerNpub logic
      let partnerNpub: string;
      let conversationId: string;
      let participants: string[] | undefined;
      let senderNpub: string | undefined;
      
      if (isGroup) {
        // Group message: derive conversation ID from all participants (including sender)
        conversationId = deriveConversationId(allParticipantPubkeys, myPubkey);
        participants = allParticipantPubkeys.map(p => nip19.npubEncode(p));
        senderNpub = nip19.npubEncode(rumor.pubkey);
        
        // For backward compatibility, set partnerNpub to first non-self participant
        partnerNpub = nip19.npubEncode(otherParticipants[0] || myPubkey);
        
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
        const fileTypeTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'file-type');
        const sizeTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'size');
        const hashTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'x');
        const plainHashTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'ox');
        const encAlgTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'encryption-algorithm');
        const keyTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'decryption-key');
        const nonceTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'decryption-nonce');
        const dimTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'dim');
        const blurhashTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'blurhash');
        const altTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'alt');

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
          message: altTag?.[1] || '',
          sentAt: typeof rumor.created_at === 'number' ? rumor.created_at * 1000 : Date.now(),
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

      // Kind 1405: call event messages (formerly Kind 16; see
      // openspec/changes/move-call-history-to-kind-1405).
      if (rumor.kind === CALL_HISTORY_KIND) {
        const callEventTypeTag = rumor.tags?.find((t: string[]) => t[0] === 'call-event-type');
        const callDurationTag = rumor.tags?.find((t: string[]) => t[0] === 'call-duration');
        const callInitiatorTag = rumor.tags?.find((t: string[]) => t[0] === 'call-initiator');
        const callIdTag = rumor.tags?.find((t: string[]) => t[0] === 'call-id');
        // call-media-type is optional; rumors written by older clients
        // (predating add-video-calling) omit it. Default to 'voice'.
        const callMediaTypeTag = rumor.tags?.find((t: string[]) => t[0] === 'call-media-type');
        const callMediaType: 'voice' | 'video' =
          callMediaTypeTag?.[1] === 'video' ? 'video' : 'voice';

        return {
          recipientNpub: partnerNpub,
          message: '',
          sentAt: typeof rumor.created_at === 'number' ? rumor.created_at * 1000 : Date.now(),
          eventId: originalEventId,
          rumorId,
          direction,
          createdAt: Date.now(),
          rumorKind: rumor.kind,
          callEventType: callEventTypeTag?.[1],
          callDuration: callDurationTag ? parseInt(callDurationTag[1]) : undefined,
          callInitiatorNpub: callInitiatorTag ? nip19.npubEncode(callInitiatorTag[1]) : undefined,
          callId: callIdTag?.[1],
          callMediaType,
          conversationId,
          participants,
          senderNpub
        };
      }

      // Default text (Kind 14) path
      const parentTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'e');
      const parentRumorId = parentTag?.[1];
      const location = this.parseLocationFromRumor(rumor);

      return {
        recipientNpub: partnerNpub,
        message: rumor.content ?? '',
        sentAt: typeof rumor.created_at === 'number' ? rumor.created_at * 1000 : Date.now(),
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
      const subjectTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'subject');
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
    const locationTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'location' && !!t[1]);
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
      // Use conversationId for unread tracking (works for both 1-on-1 and groups)
      const unreadKey = message.conversationId || message.recipientNpub;
      const shouldPersistUnread = !isActivelyViewingConversation(unreadKey);
      if (shouldPersistUnread) {
        addUnreadMessage(user.npub, unreadKey, message.eventId);
      }

      // Don't show notifications for messages fetched during history sync
      // or for messages sent before the current session started
      if (!this.isFetchingHistory && rumor.created_at >= this.sessionStartedAt) {
        // Use friendly label for media attachments, location messages, or
        // call events (kind 1405). Without the call-event branch, missed
        // / declined call notifications would show an empty body because
        // the message has no text content.
        const notificationBody = (message.rumorKind === CALL_HISTORY_KIND)
          ? getCallEventPreviewLabel(
              message.callEventType,
              message.callDuration,
              message.callInitiatorNpub,
              user.npub,
              message.callMediaType,
            )
          : (message.fileUrl && message.fileType)
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

      // Mark contact activity for received 1-on-1 messages so ChatList
      // can use lastActivityAt for unread indicators without scanning messages
      const isGroupMsg = message.conversationId && isGroupConversationId(message.conversationId);
      if (!isGroupMsg) {
        await contactRepo.markActivity(message.recipientNpub, rumor.created_at * 1000);
      }
    }
  }

  private async processReactionRumor(rumor: NostrEvent, originalEventId: string): Promise<void> {
    const s = get(signer);
    const user = get(currentUser);
    if (!s || !user) return;

    try {
      const myPubkey = await s.getPublicKey();
      const pTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'p');
      if (!pTag || (pTag[1] !== myPubkey && rumor.pubkey !== myPubkey)) {
        return;
      }

      const eTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'e');
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

      // Skip if this logical reaction already exists (same person + same emoji + same target)
      // This prevents duplicates from different relays which may have different gift wrap event IDs
      if (await reactionRepo.hasReactionByContent(targetEventId, authorNpub, content)) {
        return;
      }

      if (content === '✓') {
        const expTag = rumor.tags.find(t => Array.isArray(t) && t.length >= 2 && t[0] === 'expiration');
        if (expTag && Number(expTag[1]) * 1000 < Date.now()) {
          const removed = await reactionRepo.deleteReaction(targetEventId, authorNpub, '✓');
          console.log('[ReadReceipt] received expired ✓, evicted', { targetEventId, authorNpub, removed });
          return;
        }
      }

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

        // Update read receipt store if this is a ✓ reaction on a sent message
        if (content === '✓') {
          console.log('[ReadReceipt] received ✓ reaction', { targetEventId, from: reactionAuthorNpub, targetFound: !!targetMessage, direction: targetMessage?.direction });
          if (targetMessage && targetMessage.direction === 'sent') {
            updateReadReceipt(reactionAuthorNpub, targetEventId, targetMessage.sentAt);
            console.log('[ReadReceipt] store updated', { conversationId: reactionAuthorNpub, sentAt: targetMessage.sentAt });
          }
        }

        // For group messages, use conversationId; for 1-on-1, use recipientNpub (the reaction author)
        // If we can't find the target message, fall back to reaction author (1-on-1 behavior)
        const isGroupReaction = targetMessage?.conversationId &&
          targetMessage.conversationId !== targetMessage.recipientNpub;
        const conversationKey = isGroupReaction 
          ? targetMessage!.conversationId! 
          : reactionAuthorNpub;

        // Read receipt reactions (✓) should not trigger unread markers or notifications
        if (content !== '✓') {
          // Don't mark reactions as unread during history fetch - only live reactions
          if (!this.isFetchingHistory) {
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

              // Mark contact activity for received 1-on-1 messages
              if (message.direction === 'received') {
                const isGroupMsg = message.conversationId && isGroupConversationId(message.conversationId);
                if (!isGroupMsg) {
                  await contactRepo.markActivity(message.recipientNpub, message.sentAt);
                }
              }

              // Use conversationId for unread tracking (works for both 1-on-1 and groups)
              const historyUnreadKey = message.conversationId || message.recipientNpub;
              const shouldMarkUnread =
                !!options.markUnread &&
                message.direction === 'received' &&
                !isActivelyViewingConversation(historyUnreadKey);

              if (shouldMarkUnread) {
                addUnreadMessage(user.npub, historyUnreadKey, message.eventId);
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
    skipSelfWrap?: boolean;
    expirationSeconds?: number;
  }): Promise<{ rumorId: string; selfGiftWrapId: string }> {
    const { recipients, rumor, conversationId, conversation, messageDbFields, skipDbSave, skipSelfWrap, expirationSeconds } = params;

    const expiresAt = typeof expirationSeconds === 'number'
      ? Math.floor(Date.now() / 1000) + expirationSeconds
      : undefined;
    if (expiresAt !== undefined) {
      rumor.tags = [...(rumor.tags ?? []), ['expiration', String(expiresAt)]];
    }

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

    // Create self-wrap (used for relay status tracking ID and DB eventId)
    // Skip for ephemeral signals (voice call, read receipts) that don't need self-delivery
    let selfGiftWrap: NostrEvent | null = null;
    if (!skipSelfWrap) {
      selfGiftWrap = await this.createGiftWrap(rumor, senderPubkey, s, expiresAt);

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
    }

    let totalSuccessfulRelays = 0;

    // Send gift-wrap to each recipient using publishWithDeadline
    for (const [npub, relays] of recipientRelaysMap) {
      const { data: recipientPubkey } = nip19.decode(npub);
      const giftWrap = await this.createGiftWrap(rumor, recipientPubkey as string, s, expiresAt);

      const publishResult = await publishWithDeadline({
        connectionManager,
        event: giftWrap,
        relayUrls: relays,
        deadlineMs: 5000,
        onRelaySuccess: selfGiftWrap ? (url) => registerRelaySuccess(selfGiftWrap!.id, url) : undefined,
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

    // Send self-wrap to sender's relays (skip for ephemeral signals like voice-call / read receipts)
    if (!skipSelfWrap && selfGiftWrap) {
      const selfPublishResult = await publishWithDeadline({
        connectionManager,
        event: selfGiftWrap,
        relayUrls: senderRelays,
        deadlineMs: 5000,
        onRelaySuccess: (url) => registerRelaySuccess(selfGiftWrap!.id, url),
      });

      totalSuccessfulRelays += selfPublishResult.successfulRelays.length;

      const selfSuccessfulRelaySet = new Set(selfPublishResult.successfulRelays);
      for (const url of senderRelays) {
        if (!selfSuccessfulRelaySet.has(url)) {
          await retryQueue.enqueue(selfGiftWrap, url);
        }
      }
    }

    // Check if at least one relay succeeded
    if (totalSuccessfulRelays === 0) {
      console.warn('Send failed to reach any relays', {
        conversationId,
        selfGiftWrapId: selfGiftWrap?.id,
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
        eventId: selfGiftWrap?.id || rumorId,
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

    return { rumorId, selfGiftWrapId: selfGiftWrap?.id || rumorId };
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
    blossomServers: string[],
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const blob = new Blob([encrypted.ciphertext.buffer as ArrayBuffer], { type: 'application/octet-stream' });

    if (blossomServers.length === 0) {
      throw new Error('No Blossom servers configured');
    }

    const result = await uploadToBlossomServers({
      servers: blossomServers,
      body: blob,
      mimeType: 'application/octet-stream',
      sha256: encrypted.hashEncrypted,
      onProgress
    });

    return result.url;
  }

  public async sendFileMessage(
    recipientNpub: string | null,
    file: File,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    createdAtSeconds?: number,
    conversationId?: string,
    mediaMeta?: { width?: number; height?: number; blurhash?: string },
    caption?: string,
    onProgress?: (phase: 'encrypting' | 'uploading' | 'delivering', percent: number) => void
  ): Promise<string> {
    if (conversationId) {
      return this.sendGroupFileMessage(conversationId, file, mediaType, createdAtSeconds, mediaMeta, caption, onProgress);
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
    onProgress?.('encrypting', 0);
    const encrypted = await encryptFileWithAesGcm(file);
    const mimeType = (file.type && !file.type.includes('*')) ? file.type : this.mediaTypeToMime(mediaType);

    const senderProfile = await profileRepo.getProfileIgnoreTTL(senderNpub);
    const blossomServers = (senderProfile as any)?.mediaServers ?? [];
    onProgress?.('uploading', 0);
    const fileUrl = await this.uploadEncryptedMedia(encrypted, mediaType, mimeType, blossomServers, (percent) => onProgress?.('uploading', percent));

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
    if (caption) {
      tags.push(['alt', caption]);
    }

    const rumor: Partial<NostrEvent> = {
      kind: 15,
      pubkey: senderPubkey,
      created_at: now,
      content: fileUrl,
      tags
    };

    onProgress?.('delivering', 0);
    const { rumorId } = await this.sendEnvelope({
      recipients: [recipientNpub],
      rumor,
      messageDbFields: {
        message: caption || '',
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
    mediaMeta?: { width?: number; height?: number; blurhash?: string },
    caption?: string,
    onProgress?: (phase: 'encrypting' | 'uploading' | 'delivering', percent: number) => void
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
    onProgress?.('encrypting', 0);
    const encrypted = await encryptFileWithAesGcm(file);
    const mimeType = (file.type && !file.type.includes('*')) ? file.type : this.mediaTypeToMime(mediaType);

    const senderProfile = await profileRepo.getProfileIgnoreTTL(senderNpub);
    const blossomServers = (senderProfile as any)?.mediaServers ?? [];
    onProgress?.('uploading', 0);
    const fileUrl = await this.uploadEncryptedMedia(encrypted, mediaType, mimeType, blossomServers, (percent) => onProgress?.('uploading', percent));

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
    if (caption) {
      tags.push(['alt', caption]);
    }

    const rumor: Partial<NostrEvent> = {
      kind: 15,
      pubkey: senderPubkey,
      created_at: now,
      content: fileUrl,
      tags
    };

    onProgress?.('delivering', 0);
    const { rumorId } = await this.sendEnvelope({
      recipients: conversation.participants,
      rumor,
      conversationId,
      conversation,
      messageDbFields: {
        message: caption || '',
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
    emoji: '👍' | '❤️' | '😂' | '🙏' | '✓'
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
    emoji: '👍' | '❤️' | '😂' | '🙏' | '✓'
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

  public async sendReadReceipt(
    recipientNpub: string,
    lastReadMessage: { rumorId: string; sentAt: number }
  ): Promise<void> {
    console.log('[ReadReceipt] sendReadReceipt called', { recipientNpub, rumorId: lastReadMessage.rumorId });
    const settings = localStorage.getItem('nospeak-settings');
    const parsed = settings ? JSON.parse(settings) : {};
    if (!parsed.readReceiptsEnabled) {
      console.log('[ReadReceipt] setting disabled, skipping');
      return;
    }

    const storageKey = `nospeak:last-sent-receipt:${recipientNpub}`;
    const lastSent = localStorage.getItem(storageKey);
    if (lastSent === lastReadMessage.rumorId) {
      console.log('[ReadReceipt] duplicate, skipping');
      return;
    }

    console.log('[ReadReceipt] sending ✓ reaction');
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const { data: recipientPubkey } = nip19.decode(recipientNpub);

    const rumor: Partial<NostrEvent> = {
      kind: 7,
      pubkey: senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: '✓',
      tags: [
        ['p', recipientPubkey as string],
        ['e', lastReadMessage.rumorId, '', recipientPubkey as string]
      ]
    };

    await this.sendEnvelope({
      recipients: [recipientNpub],
      rumor,
      skipDbSave: true,
      skipSelfWrap: true,
      expirationSeconds: READ_RECEIPT_EXPIRATION_SECONDS,
    });

    console.log('[ReadReceipt] sent successfully');
    localStorage.setItem(storageKey, lastReadMessage.rumorId);
  }

  /**
   * Create a call event message as a Kind 1405 rumor that is gift-wrapped
   * to the peer (and self-wrapped to the sender via standard NIP-59).
   * Used for call-event types that should appear in BOTH peers' chat
   * history: `ended`, `no-answer`, `declined`, `busy`, `failed`. The peer
   * receives the rumor through the normal NIP-17 path and SHALL NOT
   * author a duplicate locally.
   *
   * For asymmetric outcomes that only make sense on one side
   * (`missed`, `cancelled`), use `createLocalCallEventMessage` instead.
   *
   * `callId` is the WebRTC call identifier; when supplied it's carried in a
   * ['call-id', ...] tag. Purely advisory metadata — clients that don't
   * understand the tag SHALL ignore it.
   *
   * `initiatorNpub` SHALL be the WebRTC call initiator's npub (the side
   * that originally invoked initiateCall). When omitted, defaults to the
   * local user — correct for caller-authored types (`ended` while the
   * local user is the call initiator, `cancelled`, `no-answer`, `busy`,
   * `failed`). Callee-authored types (`declined`) MUST pass the caller's
   * npub explicitly so the renderer can pick role-aware copy via the
   * persisted `call-initiator` tag.
   */
  public async createCallEventMessage(
    recipientNpub: string,
    callEventType: AuthoredCallEventType,
    duration?: number,
    callId?: string,
    initiatorNpub?: string,
    callMediaType?: import('$lib/core/voiceCall/types').CallKind
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const pubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;
    const initiatorPubkey = initiatorNpub
        ? (nip19.decode(initiatorNpub).data as string)
        : pubkey;
    const resolvedInitiatorNpub = initiatorNpub ?? nip19.npubEncode(initiatorPubkey);
    const resolvedKind = callMediaType ?? 'voice';

    const tags = this.buildCallEventTags(
      recipientPubkey, callEventType, initiatorPubkey, duration, callId, resolvedKind);

    const rumor: Partial<NostrEvent> = {
        kind: CALL_HISTORY_KIND,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags,
        pubkey
    };

    await this.sendEnvelope({
        recipients: [recipientNpub],
        rumor,
        messageDbFields: {
            callEventType,
            callDuration: duration,
            callInitiatorNpub: resolvedInitiatorNpub,
            callId,
            callMediaType: resolvedKind
        }
    });
  }

  /**
   * Create a call event message as a LOCAL-ONLY Kind 1405 rumor: built
   * with the same tag structure as the gift-wrapped variant but persisted
   * only to the local message database — no relay publish, no gift-wrap,
   * no self-wrap. Used for `missed` and `cancelled`, where each side
   * observes a different reality (the caller observes "I cancelled"; the
   * callee observes "I missed"), and gift-wrapping either rumor to both
   * peers would produce duplicate pills with conflicting wording.
   *
   * The DB row carries `direction: 'sent'` because the local user is the
   * author; `eventId` is set to the rumor id (no gift-wrap exists to take
   * an id from), which keeps the unique-eventId constraint happy as long
   * as no two local-only rumors collide in the same call.
   */
  public async createLocalCallEventMessage(
    recipientNpub: string,
    callEventType: AuthoredCallEventType,
    callId?: string,
    initiatorNpub?: string,
    callMediaType?: import('$lib/core/voiceCall/types').CallKind
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const pubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;
    const initiatorPubkey = initiatorNpub
        ? (nip19.decode(initiatorNpub).data as string)
        : pubkey;
    const resolvedInitiatorNpub = initiatorNpub ?? nip19.npubEncode(initiatorPubkey);
    const resolvedKind = callMediaType ?? 'voice';

    const tags = this.buildCallEventTags(
      recipientPubkey, callEventType, initiatorPubkey, undefined, callId, resolvedKind);
    const createdAtSec = Math.floor(Date.now() / 1000);

    const rumor: Partial<NostrEvent> = {
        kind: CALL_HISTORY_KIND,
        created_at: createdAtSec,
        content: '',
        tags,
        pubkey
    };

    const rumorId = getEventHash(rumor as NostrEvent);

    await messageRepo.saveMessage({
        recipientNpub,
        message: '',
        sentAt: createdAtSec * 1000,
        eventId: rumorId,
        rumorId,
        direction: 'sent',
        createdAt: Date.now(),
        rumorKind: CALL_HISTORY_KIND,
        callEventType,
        callInitiatorNpub: resolvedInitiatorNpub,
        callId,
        callMediaType: resolvedKind
    } as any);
  }

  private buildCallEventTags(
    recipientPubkey: string,
    callEventType: AuthoredCallEventType,
    initiatorPubkey: string,
    duration: number | undefined,
    callId: string | undefined,
    callMediaType: 'voice' | 'video' = 'voice'
  ): string[][] {
    const tags: string[][] = [
        ['p', recipientPubkey],
        ['type', 'call-event'],
        ['call-event-type', callEventType],
        ['call-initiator', initiatorPubkey],
        ['call-media-type', callMediaType]
    ];
    if (duration !== undefined) {
        tags.push(['call-duration', String(duration)]);
    }
    if (callId !== undefined) {
        tags.push(['call-id', callId]);
    }
    return tags;
  }

  /**
   * Build the tag set for a GROUP call-history Kind 1405 rumor. One
   * `['p', <hex>]` tag per other roster member, plus the standard
   * call-event tags, plus the group-call correlation tags
   * ({@code group-call-id}, {@code conversation-id}). Tag order is
   * stable so multi-device authoring produces identical rumor ids on
   * each device for the same call (which the existing message
   * dedup-by-id logic relies on for clean rendering).
   */
  private buildGroupCallEventTags(
    participantPubkeys: string[],
    callEventType: AuthoredCallEventType,
    initiatorPubkey: string,
    groupCallId: string,
    conversationId: string,
    duration: number | undefined,
    callMediaType: 'voice' | 'video' = 'voice'
  ): string[][] {
    const tags: string[][] = [];
    for (const peerHex of participantPubkeys) {
      tags.push(['p', peerHex]);
    }
    tags.push(
      ['type', 'call-event'],
      ['call-event-type', callEventType],
      ['call-initiator', initiatorPubkey],
      ['call-media-type', callMediaType],
      ['group-call-id', groupCallId],
      ['conversation-id', conversationId]
    );
    if (duration !== undefined) {
      tags.push(['call-duration', String(duration)]);
    }
    return tags;
  }

  /**
   * Group-call counterpart of {@link createCallEventMessage}. Authors
   * one Kind 1405 rumor with one `['p', <hex>]` tag per other roster
   * member plus a `['group-call-id', <hex32>]` correlation tag and a
   * `['conversation-id', <hex16>]` anchor tag. The rumor flows through
   * the existing 3-layer NIP-17 group pipeline ({@code sendEnvelope}
   * already fans out to N recipients with one self-wrap), distinct
   * from the NIP-AC kind-21059 signaling pipeline.
   *
   * <p>Used for the symmetric outcomes that should appear in EVERY
   * participant's chat history: {@code ended}, {@code no-answer},
   * {@code declined}, {@code busy}, {@code failed}. For asymmetric
   * outcomes ({@code missed}, {@code cancelled}), use
   * {@link createLocalGroupCallEventMessage} instead.
   *
   * @param conversationId 16-character hex id of the local group
   *     conversation this call is anchored to.
   * @param participantNpubs Other roster members (excluding self).
   * @param initiatorNpub The initiator's npub. May be the local user
   *     (initiator-authored {@code ended} / {@code cancelled} on the
   *     happy path) or another participant (when the local user is
   *     authoring a self-perspective outcome on someone else's call).
   */
  public async createGroupCallEventMessage(
    conversationId: string,
    participantNpubs: string[],
    callEventType: AuthoredCallEventType,
    groupCallId: string,
    initiatorNpub: string,
    duration?: number,
    callMediaType?: import('$lib/core/voiceCall/types').CallKind
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const pubkey = await s.getPublicKey();
    const initiatorPubkey = nip19.decode(initiatorNpub).data as string;
    const participantPubkeys = participantNpubs.map(
      (npub) => nip19.decode(npub).data as string
    );
    const resolvedKind = callMediaType ?? 'voice';

    const tags = this.buildGroupCallEventTags(
      participantPubkeys,
      callEventType,
      initiatorPubkey,
      groupCallId,
      conversationId,
      duration,
      resolvedKind
    );

    const rumor: Partial<NostrEvent> = {
      kind: CALL_HISTORY_KIND,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags,
      pubkey
    };

    await this.sendEnvelope({
      recipients: participantNpubs,
      rumor,
      messageDbFields: {
        callEventType,
        callDuration: duration,
        callInitiatorNpub: initiatorNpub,
        callId: groupCallId,
        callMediaType: resolvedKind
      }
    });
  }

  /**
   * Group-call counterpart of {@link createLocalCallEventMessage}.
   * Persists a Kind 1405 rumor LOCAL-ONLY with the same tag structure
   * as {@link createGroupCallEventMessage} — no relay publish, no
   * gift-wrap, no self-wrap. Used for {@code missed} (no answer
   * locally) and {@code cancelled} (initiator hung up before any peer
   * connected).
   *
   * <p>The DB row carries {@code direction: 'sent'} and an explicit
   * {@code conversationId} so the entry lands in the correct group
   * chat without going through the gift-wrap pipeline's automatic
   * conversation-id derivation.
   */
  public async createLocalGroupCallEventMessage(
    conversationId: string,
    participantNpubs: string[],
    callEventType: AuthoredCallEventType,
    groupCallId: string,
    initiatorNpub: string,
    callMediaType?: import('$lib/core/voiceCall/types').CallKind
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const pubkey = await s.getPublicKey();
    const initiatorPubkey = nip19.decode(initiatorNpub).data as string;
    const participantPubkeys = participantNpubs.map(
      (npub) => nip19.decode(npub).data as string
    );
    const resolvedKind = callMediaType ?? 'voice';

    const tags = this.buildGroupCallEventTags(
      participantPubkeys,
      callEventType,
      initiatorPubkey,
      groupCallId,
      conversationId,
      undefined,
      resolvedKind
    );
    const createdAtSec = Math.floor(Date.now() / 1000);

    const rumor: Partial<NostrEvent> = {
      kind: CALL_HISTORY_KIND,
      created_at: createdAtSec,
      content: '',
      tags,
      pubkey
    };

    const rumorId = getEventHash(rumor as NostrEvent);

    await messageRepo.saveMessage({
      // For group local-only entries, pick the first peer as the row's
      // recipientNpub so the legacy schema column is populated, but the
      // chat targeting is driven by `conversationId`.
      recipientNpub: participantNpubs[0] ?? '',
      message: '',
      sentAt: createdAtSec * 1000,
      eventId: rumorId,
      rumorId,
      direction: 'sent',
      createdAt: Date.now(),
      rumorKind: CALL_HISTORY_KIND,
      conversationId,
      callEventType,
      callInitiatorNpub: initiatorNpub,
      callId: groupCallId,
      callMediaType: resolvedKind
    } as any);
  }

  /**
   * Send a voice call signal (offer, answer, ICE, hangup, etc.)
   * as a gift-wrapped Kind 14 event that is NOT saved to the message DB.
   */
  private async getVoiceCallRelays(npub: string): Promise<string[]> {
    const now = Date.now();
    const cached = this.voiceCallRelayCache.get(npub);
    if (cached && (now - cached.cachedAt) < this.VOICE_RELAY_CACHE_TTL) {
      return cached.relays;
    }
    const relays = await this.getMessagingRelays(npub);
    this.voiceCallRelayCache.set(npub, { relays, cachedAt: now });
    return relays;
  }

  public clearVoiceCallRelayCache(): void {
    this.voiceCallRelayCache.clear();
  }

  /**
   * Build a signed NIP-AC inner event with required tags. The caller is
   * responsible for filling `kind` and `content`. The user's signer is
   * used to sign the event with its real key (NIP-AC inner events are
   * signed, unlike NIP-17 rumors).
   */
  private async buildSignedNipAcInner(opts: {
    s: any;
    senderPubkey: string;
    recipientPubkey: string;
    kind: number;
    content: string;
    callId: string;
    altText: string;
    extraTags?: string[][];
  }): Promise<NostrEvent> {
    const tags: string[][] = [
      ['p', opts.recipientPubkey],
      ['call-id', opts.callId],
      ['alt', opts.altText]
    ];
    if (opts.extraTags) tags.push(...opts.extraTags);

    const partial: Partial<NostrEvent> = {
      kind: opts.kind,
      pubkey: opts.senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: opts.content,
      tags
    };
    partial.id = getEventHash(partial as NostrEvent);
    // signer.signEvent attaches `sig` and returns the fully-signed event.
    return await opts.s.signEvent(partial);
  }

  /**
   * Publish a signed NIP-AC inner event as a kind 21059 ephemeral gift
   * wrap. If `selfWrap` is true, also publish a second wrap addressed to
   * the sender's own pubkey (for multi-device "answered/rejected
   * elsewhere"). NIP-AC requires self-wrap ONLY on Answer (25051) and
   * Reject (25054). The recipient relay list is cached for 60 seconds
   * via `getVoiceCallRelays`. Publishes only to already-connected relays
   * to avoid subscription replays.
   */
  private async publishNipAcSignal(opts: {
    signedInner: NostrEvent;
    recipientNpub: string;
    recipientPubkey: string;
    senderPubkey: string;
    selfWrap: boolean;
  }): Promise<void> {
    const recipientRelays = await this.getVoiceCallRelays(opts.recipientNpub);
    if (recipientRelays.length === 0) {
      throw new Error('Contact has no messaging relays configured');
    }

    const connectedRecipientRelays = recipientRelays.filter((url) => {
      const health = connectionManager.getRelayHealth(url);
      return health?.isConnected && health.relay;
    });
    if (connectedRecipientRelays.length === 0) {
      console.warn(
        '[NIP-AC] No connected relays for recipient, signal may not be delivered'
      );
    }
    const publishRelays =
      connectedRecipientRelays.length > 0
        ? connectedRecipientRelays
        : recipientRelays;

    const recipientWrap = createNipAcGiftWrap(
      opts.signedInner,
      opts.recipientPubkey
    );
    await publishWithDeadline({
      connectionManager,
      event: recipientWrap,
      relayUrls: publishRelays,
      deadlineMs: 5000
    });

    if (opts.selfWrap) {
      // Multi-device: publish a second wrap to the sender's own pubkey
      // so other logged-in devices of the same user can transition to
      // answered-elsewhere / rejected-elsewhere. Use the sender's own
      // messaging relays (resolved via the same cache, keyed by their
      // own npub) so the wrap reaches the user's own subscriptions.
      const selfNpub = nip19.npubEncode(opts.senderPubkey);
      const selfRelays = await this.getVoiceCallRelays(selfNpub);
      const connectedSelfRelays = selfRelays.filter((url) => {
        const health = connectionManager.getRelayHealth(url);
        return health?.isConnected && health.relay;
      });
      const selfPublishRelays =
        connectedSelfRelays.length > 0 ? connectedSelfRelays : selfRelays;
      if (selfPublishRelays.length === 0) {
        console.warn(
          '[NIP-AC] No relays for self-wrap; multi-device signaling skipped'
        );
        return;
      }
      const selfWrap = createNipAcGiftWrap(
        opts.signedInner,
        opts.senderPubkey
      );
      await publishWithDeadline({
        connectionManager,
        event: selfWrap,
        relayUrls: selfPublishRelays,
        deadlineMs: 5000
      });
    }
  }

  /**
   * NIP-AC kind 25050 Call Offer. SDP is the raw `content`. No self-wrap.
   *
   * <p>For 1-on-1 calls, pass only {@code opts.callType}. For group
   * calls, pass {@code opts.group}; the helper emits the four/five
   * group tags ({@code group-call-id}, {@code conversation-id},
   * {@code initiator}, {@code participants}, and — on invite-only
   * offers — {@code role=invite}) on the inner event in the order
   * fixed by the wire-parity fixture. Invite-only group offers SHALL
   * have empty {@code sdp} content; the recipient is the designated
   * SDP offerer for that pair under the deterministic-pair rule.
   */
  public async sendCallOffer(
    recipientNpub: string,
    callId: string,
    sdp: string,
    opts?: {
      callType?: import('$lib/core/voiceCall/types').CallKind;
      group?: NipAcGroupSendContext;
    }
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const callType = opts?.callType ?? 'voice';
    const isGroup = !!opts?.group;
    const altText = isGroup
      ? callType === 'video'
        ? 'WebRTC group video call offer'
        : 'WebRTC group voice call offer'
      : callType === 'video'
        ? 'WebRTC video call offer'
        : 'WebRTC call offer';

    // Tag order (must match wire-parity fixture):
    //   [p, call-id, alt, call-type, group-call-id, conversation-id,
    //    initiator, participants, role?]
    const extraTags: string[][] = [['call-type', callType]];
    extraTags.push(
      ...buildGroupExtraTags(opts?.group, {
        includeParticipants: true,
        includeRoleInvite: true
      })
    );

    const inner = await this.buildSignedNipAcInner({
      s,
      senderPubkey,
      recipientPubkey,
      kind: NIP_AC_KIND_OFFER,
      content: sdp,
      callId,
      altText,
      extraTags
    });
    await this.publishNipAcSignal({
      signedInner: inner,
      recipientNpub,
      recipientPubkey,
      senderPubkey,
      selfWrap: false
    });
  }

  /**
   * NIP-AC kind 25051 Call Answer. SDP is the raw `content`. SELF-WRAPPED
   * for multi-device "answered elsewhere" support.
   *
   * <p>For group calls, pass {@code opts.group}; the helper emits the
   * three non-participants group tags ({@code group-call-id},
   * {@code conversation-id}, {@code initiator}). Roster/participants
   * are NOT repeated on kind 25051 — the receiver caches the roster
   * from the first kind-25050 with the matching {@code group-call-id}.
   */
  public async sendCallAnswer(
    recipientNpub: string,
    callId: string,
    sdp: string,
    opts?: { group?: NipAcGroupSendContext }
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const isGroup = !!opts?.group;
    const altText = isGroup ? 'WebRTC group call answer' : 'WebRTC call answer';

    const inner = await this.buildSignedNipAcInner({
      s,
      senderPubkey,
      recipientPubkey,
      kind: NIP_AC_KIND_ANSWER,
      content: sdp,
      callId,
      altText,
      extraTags: buildGroupExtraTags(opts?.group)
    });
    await this.publishNipAcSignal({
      signedInner: inner,
      recipientNpub,
      recipientPubkey,
      senderPubkey,
      selfWrap: true
    });
  }

  /**
   * NIP-AC kind 25052 ICE Candidate. `content` is a strict JSON object
   * `{candidate, sdpMid, sdpMLineIndex}`. No self-wrap. The publish
   * promise is intentionally NOT awaited at the VoiceCallService
   * onicecandidate callsite (fire-and-forget), but this method awaits
   * the wrap publish itself to surface failures via the caller's catch.
   */
  public async sendIceCandidate(
    recipientNpub: string,
    callId: string,
    candidate: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null,
    opts?: { group?: NipAcGroupSendContext }
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const isGroup = !!opts?.group;
    const altText = isGroup ? 'WebRTC group ICE candidate' : 'WebRTC ICE candidate';

    const payload = {
      candidate,
      sdpMid,
      sdpMLineIndex
    };
    const inner = await this.buildSignedNipAcInner({
      s,
      senderPubkey,
      recipientPubkey,
      kind: NIP_AC_KIND_ICE,
      content: JSON.stringify(payload),
      callId,
      altText,
      extraTags: buildGroupExtraTags(opts?.group)
    });
    await this.publishNipAcSignal({
      signedInner: inner,
      recipientNpub,
      recipientPubkey,
      senderPubkey,
      selfWrap: false
    });
  }

  /** NIP-AC kind 25053 Call Hangup. No self-wrap. */
  public async sendCallHangup(
    recipientNpub: string,
    callId: string,
    reason?: string,
    opts?: { group?: NipAcGroupSendContext }
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const isGroup = !!opts?.group;
    const altText = isGroup ? 'WebRTC group call hangup' : 'WebRTC call hangup';

    const inner = await this.buildSignedNipAcInner({
      s,
      senderPubkey,
      recipientPubkey,
      kind: NIP_AC_KIND_HANGUP,
      content: reason ?? '',
      callId,
      altText,
      extraTags: buildGroupExtraTags(opts?.group)
    });
    await this.publishNipAcSignal({
      signedInner: inner,
      recipientNpub,
      recipientPubkey,
      senderPubkey,
      selfWrap: false
    });
  }

  /**
   * NIP-AC kind 25054 Call Reject. SELF-WRAPPED for multi-device
   * "rejected elsewhere" support. Pass `'busy'` as `reason` for the
   * auto-reject from a non-idle state.
   */
  public async sendCallReject(
    recipientNpub: string,
    callId: string,
    reason?: string,
    opts?: { group?: NipAcGroupSendContext }
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const isGroup = !!opts?.group;
    const altText = isGroup ? 'WebRTC group call rejection' : 'WebRTC call rejection';

    const inner = await this.buildSignedNipAcInner({
      s,
      senderPubkey,
      recipientPubkey,
      kind: NIP_AC_KIND_REJECT,
      content: reason ?? '',
      callId,
      altText,
      extraTags: buildGroupExtraTags(opts?.group)
    });
    await this.publishNipAcSignal({
      signedInner: inner,
      recipientNpub,
      recipientPubkey,
      senderPubkey,
      selfWrap: true
    });
  }

  /**
   * NIP-AC kind 25055 Call Renegotiate. Wire shape mirrors
   * {@link sendCallOffer} EXCEPT no `call-type` tag is emitted (the
   * original kind-25050 offer owns the call type) and there is NO
   * self-wrap. The peer responds with an ordinary kind-25051 Call
   * Answer carrying the same `call-id`.
   *
   * Used by the voice→video mid-call upgrade flow and by any future
   * mid-call SDP changes (codec swap, m-line add/remove). Callers MUST
   * pass the call's existing `call-id`; renegotiations never mint a
   * new call-id.
   */
  public async sendCallRenegotiate(
    recipientNpub: string,
    callId: string,
    sdp: string
  ): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');
    const senderPubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const inner = await this.buildSignedNipAcInner({
      s,
      senderPubkey,
      recipientPubkey,
      kind: NIP_AC_KIND_RENEGOTIATE,
      content: sdp,
      callId,
      altText: 'WebRTC call renegotiation'
      // Deliberately no `extraTags`: per the NIP-AC spec the
      // renegotiation event MUST NOT carry a `call-type` tag.
    });
    await this.publishNipAcSignal({
      signedInner: inner,
      recipientNpub,
      recipientPubkey,
      senderPubkey,
      selfWrap: false
    });
  }

   private async createGiftWrap(rumor: Partial<NostrEvent>, recipientPubkey: string, s: any, expiresAt?: number): Promise<NostrEvent> {
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
    const sealTags: string[][] = [];
    if (expiresAt !== undefined) {
      // NIP-17: include expiration on the seal as well, in case the seal leaks.
      sealTags.push(['expiration', String(expiresAt)]);
    }
    const seal: Partial<NostrEvent> = {
      kind: 13,
      pubkey: sealPubkey,
      created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800), // Randomize up to 2 days in past per NIP-17
      content: encryptedRumor,
      tags: sealTags
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

    const giftWrapTags: string[][] = [['p', recipientPubkey]];
    if (expiresAt !== undefined) {
      giftWrapTags.push(['expiration', String(expiresAt)]);
    }
    const giftWrap: Partial<NostrEvent> = {
      kind: 1059,
      pubkey: ephemeralPubkey,
      created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800), // Randomize up to 2 days in past
      content: encryptedSeal,
      tags: giftWrapTags
    };

    return finalizeEvent(giftWrap as any, ephemeralPrivKey);
  }

  private async getMessagingRelays(npub: string): Promise<string[]> {
    let profile = await profileRepo.getProfile(npub);

    if (!profile) {
      // First try resolving from currently connected relays only (fast, works offline)
      await profileResolver.resolveProfile(npub, true);
      profile = await profileRepo.getProfile(npub);
    }

    if (!profile || !profile.messagingRelays?.length) {
      // Fall back to full discovery (connects to discovery relays, slower)
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
