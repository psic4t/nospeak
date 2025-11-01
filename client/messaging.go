package client

import (
	"context"
	"fmt"
	"log"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

func (c *Client) SendChatMessage(ctx context.Context, recipientNpub, message string, debug bool) error {
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

	if debug {
		log.Printf("Message sent to %s", recipientNpub)
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
		messageHandler(senderNpub, rumor.Content)
	})
}

func (c *Client) GetRecipientRelays(ctx context.Context, recipientNpub string, debug bool) ([]string, error) {
	_, recipientPubKey, err := nip19.Decode(recipientNpub)
	if err != nil {
		return nil, fmt.Errorf("failed to decode recipient npub: %w", err)
	}

	recipientHex := recipientPubKey.(string)

	// Query for recipient's kind 10050 event (DM relays)
	filters := nostr.Filters{{
		Kinds:   []int{10050},
		Authors: []string{recipientHex},
		Limit:   1,
	}}

	events, err := c.QueryEvents(ctx, filters, debug)
	if err != nil {
		if debug {
			log.Printf("Failed to query for recipient's DM relays: %v", err)
		}
	}

	var relays []string
	for _, event := range events {
		for _, tag := range event.Tags {
			if len(tag) >= 2 && tag[0] == "relay" {
				relays = append(relays, tag[1])
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
			log.Printf("Found DM relays for recipient: %v", relays)
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
	// Create kind 10050 event with all relays from config
	tags := make(nostr.Tags, 0, len(c.config.Relays))
	for _, relay := range c.config.Relays {
		tags = append(tags, nostr.Tag{"relay", relay})
	}

	event := nostr.Event{
		PubKey:    c.publicKey,
		CreatedAt: nostr.Now(),
		Kind:      10050,
		Tags:      tags,
		Content:   "",
	}

	if err := event.Sign(c.secretKey); err != nil {
		return fmt.Errorf("failed to sign messaging relays event: %w", err)
	}

	if debug {
		fmt.Printf("=== DEBUG: Messaging Relays Event (Kind 10050) ===\n")
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
