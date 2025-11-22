package client

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

// clientDebugLog logs debug messages if DEBUG environment variable is set
func clientDebugLog(format string, args ...interface{}) {
	if debug := os.Getenv("DEBUG"); debug != "" {
		log.Printf("[CLIENT-DEBUG] "+format, args...)
	}
}

func (c *Client) SendChatMessage(ctx context.Context, recipientNpub, message string, debug bool) (int, error) {
	if debug {
		log.Printf("SendChatMessage: recipient=%s, message=%q", recipientNpub[:8]+"...", message)
	}

	_, recipientPubKey, err := nip19.Decode(recipientNpub)
	if err != nil {
		return 0, fmt.Errorf("failed to decode recipient npub: %w", err)
	}

	recipientHex := recipientPubKey.(string)

	// Get recipient's read relays (NIP-65) - Try cache first
	recipientReadRelays, _, found := c.GetCachedUserRelays(recipientNpub, debug)
	if !found {
		if debug {
			log.Printf("Recipient relays not in cache, performing discovery...")
		}
		var err error
		recipientReadRelays, _, err = c.DiscoverUserRelays(ctx, recipientNpub, debug)
		if err != nil {
			if debug {
				log.Printf("Failed to discover recipient relays, using fallback: %v", err)
			}
			discovery := GetDiscoveryRelays()
			recipientReadRelays = discovery.Relays
		}
	} else if debug {
		log.Printf("Using cached recipient relays: %v", recipientReadRelays)
	}

	// Get sender's write relays (NIP-65) - Try cache first
	senderNpub, err := nip19.EncodePublicKey(c.publicKey)
	if err != nil {
		return 0, fmt.Errorf("failed to encode sender public key: %w", err)
	}

	_, senderWriteRelays, found := c.GetCachedUserRelays(senderNpub, debug)
	if !found {
		if debug {
			log.Printf("Sender relays not in cache, performing discovery...")
		}
		var err error
		_, senderWriteRelays, err = c.DiscoverUserRelays(ctx, senderNpub, debug)
		if err != nil {
			if debug {
				log.Printf("Failed to discover sender relays, using fallback: %v", err)
			}
			discovery := GetDiscoveryRelays()
			senderWriteRelays = discovery.Relays
		}
	} else if debug {
		log.Printf("Using cached sender relays: %v", senderWriteRelays)
	}

	// Remove duplicates while preserving order for each relay set
	senderWriteRelays = removeDuplicateRelays(senderWriteRelays)
	recipientReadRelays = removeDuplicateRelays(recipientReadRelays)

	if debug {
		log.Printf("Sender write relays (temporary for message): %v", senderWriteRelays)
		log.Printf("Recipient read relays (temporary for message): %v", recipientReadRelays)
	}

	// Add sender's write relays as temporary connections for message delivery
	for _, relayURL := range senderWriteRelays {
		c.connectionManager.AddTemporaryRelay(relayURL)
	}

	// Add recipient's read relays as temporary connections for message delivery
	for _, relayURL := range recipientReadRelays {
		c.connectionManager.AddTemporaryRelay(relayURL)
	}

	// Combine all target relays for publishing (sender write + recipient read)
	var targetRelays []string
	targetRelays = append(targetRelays, senderWriteRelays...)
	targetRelays = append(targetRelays, recipientReadRelays...)
	targetRelays = removeDuplicateRelays(targetRelays)

	if debug {
		log.Printf("Target relays for message delivery: %v (%d unique relays)", targetRelays, len(targetRelays))
		log.Printf("Sender write relays (temporary): %v", senderWriteRelays)
		log.Printf("Recipient read relays (temporary): %v", recipientReadRelays)
	}

	rumor := nostr.Event{
		PubKey:    c.publicKey,
		CreatedAt: nostr.Now(),
		Kind:      14,
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientHex, recipientReadRelays[0]},
		},
		Content: message,
	}

	if debug {
		fmt.Printf("=== DEBUG: Generated Rumor Event ===\n")
		fmt.Printf("ID: %s\n", rumor.ID)
		fmt.Printf("Kind: %d\n", rumor.Kind)
		fmt.Printf("CreatedAt: %d\n", rumor.CreatedAt)
		fmt.Printf("PubKey: %s\n", rumor.PubKey)
		fmt.Printf("Tags: %v\n", rumor.Tags)
		fmt.Printf("Content: %s\n", rumor.Content)
		fmt.Printf("Sig: %s\n", rumor.Sig)
		fmt.Printf("=====================================\n\n")
	}

	giftWrap, err := c.CreateGiftWrap(rumor, recipientNpub, debug)
	if err != nil {
		return 0, fmt.Errorf("failed to create gift wrap: %w", err)
	}

	if debug {
		fmt.Printf("=== DEBUG: Generated Gift Wrap Event ===\n")
		fmt.Printf("ID: %s\n", giftWrap.ID)
		fmt.Printf("Kind: %d\n", giftWrap.Kind)
		fmt.Printf("CreatedAt: %d\n", giftWrap.CreatedAt)
		fmt.Printf("PubKey: %s\n", giftWrap.PubKey)
		fmt.Printf("Tags: %v\n", giftWrap.Tags)
		fmt.Printf("Content: %s\n", giftWrap.Content)
		fmt.Printf("Sig: %s\n", giftWrap.Sig)
		fmt.Printf("=======================================\n\n")
	}

	successCount, err := c.PublishEvent(ctx, giftWrap, debug)
	if err != nil {
		// Cleanup temporary connections even on failure
		c.connectionManager.CleanupTemporaryConnections()
		return 0, fmt.Errorf("failed to publish gift wrap: %w", err)
	}

	// Create copy for self (history) synchronously so we can cache it
	// But send it in background to avoid blocking UI
	var selfGiftWrapID string
	if debug {
		log.Printf("Creating self-copy gift wrap for history...")
	}
	selfGiftWrap, err := c.CreateGiftWrap(rumor, senderNpub, debug)
	if err != nil {
		if debug {
			log.Printf("Failed to create self-copy gift wrap: %v", err)
		}
	} else {
		selfGiftWrapID = selfGiftWrap.ID

		// Publish to our write relays in background
		// We use a new background context so it completes even if the main context is cancelled
		go func() {
			bgCtx := context.Background()
			if debug {
				log.Printf("Publishing self-copy in background...")
			}
			// Publish to our write relays (which are currently connected as temporary or persistent)
			_, err := c.PublishEvent(bgCtx, selfGiftWrap, debug)
			if err != nil && debug {
				log.Printf("Failed to publish self-copy: %v", err)
			} else if debug {
				log.Printf("Successfully published self-copy for history")
			}

			// Cleanup temporary connections after background work is done
			c.connectionManager.CleanupTemporaryConnections()
			if debug {
				log.Printf("Cleaned up temporary connections after message delivery (background)")
			}
		}()
	}

	// Note: CleanupTemporaryConnections is now handled in the background goroutine above
	// If self-creation failed, we need to cleanup here
	if err != nil {
		c.connectionManager.CleanupTemporaryConnections()
		if debug {
			log.Printf("Cleaned up temporary connections (self-creation failed)")
		}
	}

	messageCache := cache.GetCache()
	// Use self-copy ID if available to match what will be fetched from relays later
	cacheID := giftWrap.ID
	if selfGiftWrapID != "" {
		cacheID = selfGiftWrapID
	}

	if err := messageCache.AddMessage(recipientNpub, message, cacheID, "sent"); err != nil {
		if debug {
			log.Printf("Failed to cache sent message: %v", err)
		}
	} else if debug {
		log.Printf("Message cached for %s with event ID: %s", recipientNpub[:8]+"...", giftWrap.ID)
	}
	return successCount, nil
}

// removeDuplicateRelays removes duplicate relay URLs while preserving order
func removeDuplicateRelays(relays []string) []string {
	seen := make(map[string]bool)
	var result []string

	for _, relay := range relays {
		if !seen[relay] {
			seen[relay] = true
			result = append(result, relay)
		}
	}
	return result
}

// SetupMessageRelays ensures proper relays are connected for message reception
func (c *Client) SetupMessageRelays(ctx context.Context, debug bool) error {
	// Get sender's npub for NIP-65 discovery
	senderNpub, err := nip19.EncodePublicKey(c.publicKey)
	if err != nil {
		return fmt.Errorf("failed to encode sender public key: %w", err)
	}

	// Check for cached sender read relays first (selective connection behavior)
	senderReadRelays, _, found := c.GetCachedUserRelays(senderNpub, debug)

	if !found || len(senderReadRelays) == 0 {
		// Only discover from network if no cached relays available
		_, senderReadRelays, err = c.DiscoverUserRelays(ctx, senderNpub, debug)
		if err != nil {
			if debug {
				log.Printf("Failed to discover sender read relays, using discovery relays as fallback: %v", err)
			}
			// Fallback to discovery relays only when no cached relays available
			discovery := GetDiscoveryRelays()
			senderReadRelays = discovery.Relays
		}
	}

	if debug {
		log.Printf("Setting up message reception on %d relays: %v", len(senderReadRelays), senderReadRelays)
		if found {
			log.Printf("Using cached sender read relays")
		} else {
			log.Printf("Using discovered/fallback sender read relays")
		}
	}

	// Add only sender's read relays as persistent connections for message reception
	c.AddMailboxRelays(senderReadRelays)

	return nil
}

func (c *Client) ListenForMessages(ctx context.Context, messageHandler func(senderNpub, message string), debug bool) error {
	// First, ensure proper relays are connected for message reception
	if err := c.SetupMessageRelays(ctx, debug); err != nil {
		if debug {
			log.Printf("Failed to setup message relays: %v", err)
		}
		// Continue anyway, as Subscribe() will handle the connection fallback
	}

	filters := nostr.Filters{{
		Kinds: []int{nostr.KindGiftWrap},
		Tags: nostr.TagMap{
			"p": {c.publicKey},
		},
	}}

	if debug {
		log.Printf("Listening for gift-wrapped messages for pubkey: %s", c.publicKey)
	}

	return c.Subscribe(ctx, filters, func(event nostr.Event) {
		if debug {
			log.Printf("Received gift-wrapped event (kind: %d, id: %s, from: %s)", event.Kind, event.ID, event.PubKey)
		}

		// Check if message is already in cache
		messageCache := cache.GetCache()
		if messageCache.HasMessage(event.ID) {
			if debug {
				log.Printf("Message %s already in cache, skipping", event.ID)
			}
			return
		}

		rumor, err := c.UnwrapGiftWrap(event, debug)
		if err != nil {
			if debug {
				log.Printf("Failed to unwrap gift wrap: %v", err)
			}
			return
		}

		if rumor.Kind != 14 {
			if debug {
				log.Printf("Ignoring rumor with kind %d (expected kind 14)", rumor.Kind)
			}
			return
		}

		senderNpub, err := nip19.EncodePublicKey(rumor.PubKey)
		if err != nil {
			if debug {
				log.Printf("Failed to encode sender public key: %v", err)
			}
			return
		}

		var direction string
		var partnerNpub string

		if rumor.PubKey == c.publicKey {
			direction = "sent"
			// Extract actual recipient from p tag
			var targetHex string
			for _, tag := range rumor.Tags {
				if len(tag) >= 2 && tag[0] == "p" {
					targetHex = tag[1]
					break
				}
			}
			if targetHex != "" {
				partnerNpub, _ = nip19.EncodePublicKey(targetHex)
			} else {
				// Fallback if no p tag found (should not happen for Kind 14)
				partnerNpub = senderNpub
			}
		} else {
			direction = "received"
			partnerNpub = senderNpub
		}

		if debug {
			log.Printf("Successfully decrypted message from %s: %q (direction: %s)", senderNpub, rumor.Content, direction)
		}

		if err := messageCache.AddMessageWithTimestamp(partnerNpub, rumor.Content, event.ID, direction, time.Unix(int64(rumor.CreatedAt), 0)); err != nil {
			if debug {
				log.Printf("Failed to cache %s message: %v", direction, err)
			}
		} else if debug {
			log.Printf("Cached %s message with %s: %q", direction, partnerNpub[:8]+"...", rumor.Content)
		}

		// Only notify for received messages
		if direction == "received" {
			if debug {
				log.Printf("Calling messageHandler for %s: %q", senderNpub, rumor.Content)
			}
			messageHandler(senderNpub, rumor.Content)
		} else if debug {
			log.Printf("Skipping messageHandler for sent message")
		}
	})
}

func (c *Client) GetRecipientRelays(ctx context.Context, recipientNpub string, debug bool) ([]string, error) {
	cacheInstance := cache.GetCache()

	// Check cache first for relay list
	if profile, found := cacheInstance.GetProfile(recipientNpub); found && profile.HasRelayList() {
		relays := profile.GetRelayList()
		if len(relays) > 0 {
			if debug {
				log.Printf("Using cached relay list for %s: %v (%d relays)", recipientNpub[:8]+"...", relays, len(relays))
			}
			return relays, nil
		}
	}

	// Cache miss - fetch from network
	_, recipientPubKey, err := nip19.Decode(recipientNpub)
	if err != nil {
		return nil, fmt.Errorf("failed to decode recipient npub: %w", err)
	}

	recipientHex := recipientPubKey.(string)

	if debug {
		log.Printf("No cached relay list for %s, querying network", recipientNpub[:8]+"...")
	}

	// Query for recipient's kind 10002 event (NIP-65 relay list)
	filters := nostr.Filters{{
		Kinds:   []int{10002},
		Authors: []string{recipientHex},
		Limit:   1,
	}}

	events, err := c.QueryEvents(ctx, filters, debug)
	if err != nil {
		if debug {
			log.Printf("Failed to query for recipient's NIP-65 relay list: %v", err)
		}
	}

	if debug {
		log.Printf("QueryEvents returned %d events for %s", len(events), recipientNpub[:8]+"...")
	}

	var readRelays []string
	var writeRelays []string
	var relayListEventID string

	for _, event := range events {
		if debug {
			log.Printf("Processing Event 10002: ID=%s, Tags=%d", event.ID, len(event.Tags))
		}
		relayListEventID = event.ID
		for _, tag := range event.Tags {
			if debug {
				log.Printf("Processing tag: %v", tag)
			}
			if len(tag) >= 2 && tag[0] == "r" {
				relayURL := tag[1]
				var marker string
				if len(tag) >= 3 {
					marker = tag[2]
				}

				if debug {
					log.Printf("Found relay tag: %s (marker: %s)", relayURL, marker)
				}

				switch marker {
				case "read":
					readRelays = append(readRelays, relayURL)
				case "write":
					writeRelays = append(writeRelays, relayURL)
				default:
					readRelays = append(readRelays, relayURL)
					writeRelays = append(writeRelays, relayURL)
				}
			}
		}
	}

	// Deduplicate
	readRelays = removeDuplicates(readRelays)
	writeRelays = removeDuplicates(writeRelays)

	if debug {
		log.Printf("Extracted %d read relays and %d write relays from Event 10002", len(readRelays), len(writeRelays))
	}

	// Update cache with relay list if we found one
	if (len(readRelays) > 0 || len(writeRelays) > 0) && relayListEventID != "" {
		if debug {
			log.Printf("Updating cache with relays for %s", recipientNpub[:8]+"...")
		}
		// Get current profile to preserve metadata, then update with new relay list
		if cachedProfile, found := cacheInstance.GetProfile(recipientNpub); found {
			if debug {
				log.Printf("Found existing cached profile for %s, updating with relay list", recipientNpub[:8]+"...")
			}
			profileMetadata := cachedProfile.ToProfileMetadata()
			err = cacheInstance.SetProfileWithRelayList(recipientNpub, profileMetadata, readRelays, writeRelays, 24*time.Hour)
			if err != nil && debug {
				log.Printf("Failed to cache relay list for %s: %v", recipientNpub[:8]+"...", err)
			} else if debug {
				log.Printf("Successfully cached relay list for %s", recipientNpub[:8]+"...")
			}
		} else {
			if debug {
				log.Printf("No existing cached profile for %s, creating new with relay list", recipientNpub[:8]+"...")
			}
			// No cached profile, create minimal one with just relay list
			minimalProfile := cache.ProfileMetadata{}
			err = cacheInstance.SetProfileWithRelayList(recipientNpub, minimalProfile, readRelays, writeRelays, 24*time.Hour)
			if err != nil && debug {
				log.Printf("Failed to cache profile with relay list for %s: %v", recipientNpub[:8]+"...", err)
			} else if debug {
				log.Printf("Successfully created new profile with relay list for %s", recipientNpub[:8]+"...")
			}
		}
	} else {
		if debug {
			log.Printf("No relays found for %s (relayListEventID=%s)", recipientNpub[:8]+"...", relayListEventID)
		}
	}

	// Fallback to default relays if none found
	var relays []string
	if len(readRelays) == 0 {
		relays = []string{"wss://nostr.data.haus"}
		if debug {
			log.Printf("No DM relays found for recipient, using fallback: %v", relays)
		}
	} else {
		relays = readRelays
		if debug {
			log.Printf("Found DM relays for recipient: %v (cached for 24h)", relays)
		}
	}

	return relays, nil
}

func (c *Client) SetProfileName(ctx context.Context, name string, debug bool) error {
	event := nostr.Event{
		PubKey:    c.publicKey,
		CreatedAt: nostr.Now(),
		Kind:      0,
		Content:   fmt.Sprintf(`{"name":"%s"}`, name),
	}

	if err := event.Sign(c.secretKey); err != nil {
		return fmt.Errorf("failed to sign event: %w", err)
	}

	if debug {
		fmt.Printf("=== DEBUG: Profile Metadata Event ===\n")
		fmt.Printf("ID: %s\n", event.ID)
		fmt.Printf("Kind: %d\n", event.Kind)
		fmt.Printf("CreatedAt: %d\n", event.CreatedAt)
		fmt.Printf("PubKey: %s\n", event.PubKey)
		fmt.Printf("Content: %s\n", event.Content)
		fmt.Printf("Sig: %s\n", event.Sig)
		fmt.Printf("===================================\n\n")
	}

	if _, err := c.PublishEvent(ctx, event, debug); err != nil {
		return fmt.Errorf("failed to publish profile metadata: %w", err)
	}

	if debug {
		log.Printf("Profile name updated to: %s", name)
	}
	return nil
}

func (c *Client) SetMessagingRelays(ctx context.Context, debug bool) error {
	// Create kind 10002 event with discovery relays (NIP-65)
	discoveryRelays := GetDiscoveryRelays()
	tags := make(nostr.Tags, 0, len(discoveryRelays.Relays))
	for _, relay := range discoveryRelays.Relays {
		tags = append(tags, nostr.Tag{"r", relay})
	}

	event := nostr.Event{
		PubKey:    c.publicKey,
		CreatedAt: nostr.Now(),
		Kind:      10002,
		Tags:      tags,
		Content:   "",
	}

	if err := event.Sign(c.secretKey); err != nil {
		return fmt.Errorf("failed to sign messaging relays event: %w", err)
	}

	if debug {
		fmt.Printf("=== DEBUG: Messaging Relays Event (Kind 10002 - NIP-65) ===\n")
		fmt.Printf("ID: %s\n", event.ID)
		fmt.Printf("Kind: %d\n", event.Kind)
		fmt.Printf("CreatedAt: %d\n", event.CreatedAt)
		fmt.Printf("PubKey: %s\n", event.PubKey)
		fmt.Printf("Tags: %v\n", event.Tags)
		fmt.Printf("Content: %s\n", event.Content)
		fmt.Printf("Sig: %s\n", event.Sig)
		fmt.Printf("================================================\n\n")
	}

	if _, err := c.PublishEvent(ctx, event, debug); err != nil {
		return fmt.Errorf("failed to publish messaging relays event: %w", err)
	}

	if debug {
		discoveryRelays := GetDiscoveryRelays()
		log.Printf("Messaging relays updated: %v", discoveryRelays.Relays)
	}
	return nil
}

func (c *Client) GetPartnerNpubs() []string {
	return c.config.Partners
}

func (c *Client) GetSortedPartnerNpubs() []string {
	clientDebugLog("GetSortedPartnerNpubs called")
	clientDebugLog("Original partners from config: %v", c.config.Partners)

	messageCache := cache.GetCache()
	sortedPartners := messageCache.GetSortedPartners(c.config.Partners)

	clientDebugLog("Sorted partners returned: %v", sortedPartners)
	return sortedPartners
}

func (c *Client) GetMessageHistory(recipientNpub string, limit int) []cache.MessageEntry {
	messageCache := cache.GetCache()
	return messageCache.GetMessages(recipientNpub, limit)
}

func (c *Client) GetMessageHistoryEnhanced(recipientNpub string, sentLimit, receivedLimit int) []cache.MessageEntry {
	messageCache := cache.GetCache()
	return messageCache.GetRecentMessages(recipientNpub, sentLimit, receivedLimit)
}

func (c *Client) IsPartner(npub string) bool {
	for _, partner := range c.config.Partners {
		if partner == npub {
			return true
		}
	}
	return false
}

func (c *Client) AddPartner(npub string) error {
	if c.IsPartner(npub) {
		return nil
	}

	c.config.Partners = append(c.config.Partners, npub)

	return c.config.Save()
}

// FetchSentMessages fetches self-sent messages (Kind 1059) from relays
func (c *Client) FetchSentMessages(ctx context.Context, limit int, debug bool) error {
	// We can only query for messages sent TO us (p=me) because NIP-59 uses ephemeral keys for authors.
	// But since we are now sending copies to ourselves, we can find sent messages by querying p=me
	// and filtering for those where the inner rumor's pubkey is our own.

	filters := nostr.Filters{{
		Kinds: []int{nostr.KindGiftWrap},
		Tags: nostr.TagMap{
			"p": {c.publicKey},
		},
		Limit: limit,
	}}

	if debug {
		log.Printf("Fetching history (Kind 1059) for %s", c.publicKey)
	}

	events, err := c.QueryEvents(ctx, filters, debug)
	if err != nil {
		return fmt.Errorf("failed to query events: %w", err)
	}

	messageCache := cache.GetCache()
	count := 0

	for _, event := range events {
		// Check if message is already in cache
		if messageCache.HasMessage(event.ID) {
			continue
		}

		rumor, err := c.UnwrapGiftWrap(event, debug)
		if err != nil {
			continue
		}

		if rumor.Kind != 14 {
			continue
		}

		// Check if the sender is ME
		if rumor.PubKey == c.publicKey {
			// This is a sent message (Send to Self)

			// Find the actual recipient from the 'p' tag in the rumor
			var targetHex string
			for _, tag := range rumor.Tags {
				if len(tag) >= 2 && tag[0] == "p" {
					targetHex = tag[1]
					break
				}
			}

			if targetHex == "" {
				continue
			}

			partnerNpub, err := nip19.EncodePublicKey(targetHex)
			if err != nil {
				continue
			}

			if debug {
				log.Printf("Found sent message to %s: %q", partnerNpub, rumor.Content)
			}

			if err := messageCache.AddMessageWithTimestamp(partnerNpub, rumor.Content, event.ID, "sent", time.Unix(int64(rumor.CreatedAt), 0)); err != nil {
				if debug {
					log.Printf("Failed to cache sent message: %v", err)
				}
			} else {
				count++
			}
		} else {
			// This is a received message (from someone else)
			// We can also cache it here since we fetched it!

			senderNpub, err := nip19.EncodePublicKey(rumor.PubKey)
			if err != nil {
				continue
			}

			if debug {
				log.Printf("Found received message from %s: %q", senderNpub, rumor.Content)
			}

			if err := messageCache.AddMessageWithTimestamp(senderNpub, rumor.Content, event.ID, "received", time.Unix(int64(rumor.CreatedAt), 0)); err != nil {
				if debug {
					log.Printf("Failed to cache received message: %v", err)
				}
			} else {
				count++
			}
		}
	}

	if debug {
		log.Printf("Fetched and cached %d new messages", count)
	}

	return nil
}
