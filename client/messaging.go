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

	rumor := nostr.Event{
		PubKey:    c.publicKey,
		CreatedAt: nostr.Now(),
		Kind:      14,
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientHex, "wss://nostr.data.haus"},
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

	giftWrap, err := c.CreateGiftWrap(rumor, recipientNpub)
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

	log.Printf("Message sent to %s", recipientNpub)
	return nil
}

func (c *Client) ListenForMessages(ctx context.Context, messageHandler func(senderNpub, message string)) error {
	filters := nostr.Filters{{
		Kinds: []int{nostr.KindGiftWrap},
		Tags: nostr.TagMap{
			"p": {c.publicKey},
		},
	}}

	return c.Subscribe(ctx, filters, func(event nostr.Event) {
		rumor, err := c.UnwrapGiftWrap(event)
		if err != nil {
			log.Printf("Failed to unwrap gift wrap: %v", err)
			return
		}

		if rumor.Kind != 14 {
			return
		}

		senderNpub, err := nip19.EncodePublicKey(rumor.PubKey)
		if err != nil {
			log.Printf("Failed to encode sender public key: %v", err)
			return
		}

		messageHandler(senderNpub, rumor.Content)
	})
}

func (c *Client) GetPartnerNpubs() []string {
	return c.config.Partners
}
