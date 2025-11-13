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

func (c *Client) SendChatMessage(ctx context.Context, recipientNpub, message string, debug bool) error {
	if debug {
		log.Printf("SendChatMessage: recipient=%s, message=%q", recipientNpub[:8]+"...", message)
	}

	_, recipientPubKey, err := nip19.Decode(recipientNpub)
	if err != nil {
		return fmt.Errorf("failed to decode recipient npub: %w", err)
	}

	recipientHex := recipientPubKey.(string)

	// Discover recipient's preferred DM relays
	recipientRelays, err := c.GetRecipientRelays(ctx, recipientNpub, debug)
	if err != nil {
		if debug {
			log.Printf("Failed to discover recipient relays, using fallback: %v", err)
		}
		recipientRelays = []string{"wss://nostr.data.haus"}
	}

	// Add recipient's mailbox relays to connection manager for persistent connection
	c.AddMailboxRelays(recipientRelays)

	rumor := nostr.Event{
		PubKey:    c.publicKey,
		CreatedAt: nostr.Now(),
		Kind:      14,
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientHex, recipientRelays[0]},
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
		return fmt.Errorf("failed to create gift wrap: %w", err)
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

	if err := c.PublishEvent(ctx, giftWrap, debug); err != nil {
		return fmt.Errorf("failed to publish gift wrap: %w", err)
	}

	messageCache := cache.GetCache()
	if err := messageCache.AddMessage(recipientNpub, message, giftWrap.ID, "sent"); err != nil {
		if debug {
			log.Printf("Failed to cache sent message: %v", err)
		}
	} else if debug {
		log.Printf("Message cached for %s with event ID: %s", recipientNpub[:8]+"...", giftWrap.ID)
	}
	return nil
}

func (c *Client) ListenForMessages(ctx context.Context, messageHandler func(senderNpub, message string), debug bool) error {
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

		if debug {
			log.Printf("Successfully decrypted message from %s: %q", senderNpub, rumor.Content)
		}

		if err := messageCache.AddMessageWithTimestamp(senderNpub, rumor.Content, event.ID, "received", time.Unix(int64(rumor.CreatedAt), 0)); err != nil {
			if debug {
				log.Printf("Failed to cache received message: %v", err)
			}
		} else if debug {
			log.Printf("Cached received message from %s: %q", senderNpub[:8]+"...", rumor.Content)
		}

		if debug {
			log.Printf("Calling messageHandler for %s: %q", senderNpub, rumor.Content)
		}
		messageHandler(senderNpub, rumor.Content)
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

	var relays []string
	var relayListEventID string

	for _, event := range events {
		relayListEventID = event.ID
		for _, tag := range event.Tags {
			if len(tag) >= 2 && tag[0] == "r" {
				relays = append(relays, tag[1])
			}
		}
	}

	// Update cache with relay list if we found one
	if len(relays) > 0 && relayListEventID != "" {
		// Get current profile to preserve metadata, then update with new relay list
		if cachedProfile, found := cacheInstance.GetProfile(recipientNpub); found {
			profileMetadata := cachedProfile.ToProfileMetadata()
			err = cacheInstance.SetProfileWithRelayList(recipientNpub, profileMetadata, relays, relayListEventID, 24*time.Hour)
			if err != nil && debug {
				log.Printf("Failed to cache relay list for %s: %v", recipientNpub[:8]+"...", err)
			}
		} else {
			// No cached profile, create minimal one with just relay list
			minimalProfile := cache.ProfileMetadata{}
			err = cacheInstance.SetProfileWithRelayList(recipientNpub, minimalProfile, relays, relayListEventID, 24*time.Hour)
			if err != nil && debug {
				log.Printf("Failed to cache profile with relay list for %s: %v", recipientNpub[:8]+"...", err)
			}
		}
	}

	// Fallback to default relays if none found
	if len(relays) == 0 {
		relays = []string{"wss://nostr.data.haus"}
		if debug {
			log.Printf("No DM relays found for recipient, using fallback: %v", relays)
		}
	} else {
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

	if err := c.PublishEvent(ctx, event, debug); err != nil {
		return fmt.Errorf("failed to publish profile metadata: %w", err)
	}

	if debug {
		log.Printf("Profile name updated to: %s", name)
	}
	return nil
}

func (c *Client) SetMessagingRelays(ctx context.Context, debug bool) error {
	// Create kind 10002 event with all relays from config (NIP-65)
	tags := make(nostr.Tags, 0, len(c.config.Relays))
	for _, relay := range c.config.Relays {
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

	if err := c.PublishEvent(ctx, event, debug); err != nil {
		return fmt.Errorf("failed to publish messaging relays event: %w", err)
	}

	if debug {
		log.Printf("Messaging relays updated: %v", c.config.Relays)
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
