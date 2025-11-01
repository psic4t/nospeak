package client

import (
	"fmt"
	"log"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
	"github.com/nbd-wtf/go-nostr/nip44"
	"github.com/nbd-wtf/go-nostr/nip59"
)

func (c *Client) EncryptMessage(message string, recipientNpub string) (string, error) {
	_, recipientPubKey, err := nip19.Decode(recipientNpub)
	if err != nil {
		return "", fmt.Errorf("failed to decode recipient npub: %w", err)
	}

	recipientHex := recipientPubKey.(string)

	conversationKey, err := nip44.GenerateConversationKey(recipientHex, c.secretKey)
	if err != nil {
		return "", fmt.Errorf("failed to generate conversation key: %w", err)
	}

	encrypted, err := nip44.Encrypt(message, conversationKey)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt message: %w", err)
	}

	return encrypted, nil
}

func (c *Client) DecryptMessage(encryptedMessage string, senderNpub string) (string, error) {
	_, senderPubKey, err := nip19.Decode(senderNpub)
	if err != nil {
		return "", fmt.Errorf("failed to decode sender npub: %w", err)
	}

	senderHex := senderPubKey.(string)

	conversationKey, err := nip44.GenerateConversationKey(senderHex, c.secretKey)
	if err != nil {
		return "", fmt.Errorf("failed to generate conversation key: %w", err)
	}

	decrypted, err := nip44.Decrypt(encryptedMessage, conversationKey)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt message: %w", err)
	}

	return decrypted, nil
}

func (c *Client) CreateGiftWrap(rumor nostr.Event, recipientNpub string) (nostr.Event, error) {
	_, recipientPubKey, err := nip19.Decode(recipientNpub)
	if err != nil {
		return nostr.Event{}, fmt.Errorf("failed to decode recipient npub: %w", err)
	}

	recipientHex := recipientPubKey.(string)

	log.Printf("Creating gift wrap for recipient %s", recipientHex)

	// For the seal layer (rumor -> seal), use sender's private key + recipient's public key
	encryptFunc := func(plaintext string) (string, error) {
		conversationKey, err := nip44.GenerateConversationKey(recipientHex, c.secretKey)
		if err != nil {
			return "", err
		}
		encrypted, err := nip44.Encrypt(plaintext, conversationKey)
		if err != nil {
			return "", err
		}
		log.Printf("Encrypted rumor for seal layer (length: %d)", len(encrypted))
		return encrypted, nil
	}

	signFunc := func(event *nostr.Event) error {
		err := event.Sign(c.secretKey)
		if err != nil {
			return err
		}
		log.Printf("Signed seal event (kind: %d, id: %s)", event.Kind, event.ID)
		return nil
	}

	// The go-nostr library automatically randomizes timestamps for metadata protection
	giftWrap, err := nip59.GiftWrap(rumor, recipientHex, encryptFunc, signFunc, nil)
	if err != nil {
		return nostr.Event{}, fmt.Errorf("failed to create gift wrap: %w", err)
	}

	log.Printf("Created gift wrap (kind: %d, id: %s, recipient: %s)", giftWrap.Kind, giftWrap.ID, recipientHex)

	return giftWrap, nil
}

func (c *Client) UnwrapGiftWrap(giftWrap nostr.Event) (nostr.Event, error) {
	log.Printf("Unwrapping gift wrap (kind: %d, id: %s)", giftWrap.Kind, giftWrap.ID)

	decryptFunc := func(otherPubKey, ciphertext string) (string, error) {
		conversationKey, err := nip44.GenerateConversationKey(otherPubKey, c.secretKey)
		if err != nil {
			return "", err
		}
		decrypted, err := nip44.Decrypt(ciphertext, conversationKey)
		if err != nil {
			return "", err
		}
		log.Printf("Decrypted layer with pubkey %s (length: %d)", otherPubKey, len(decrypted))
		return decrypted, nil
	}

	rumor, err := nip59.GiftUnwrap(giftWrap, decryptFunc)
	if err != nil {
		return nostr.Event{}, fmt.Errorf("failed to unwrap gift: %w", err)
	}

	log.Printf("Successfully unwrapped rumor (kind: %d, id: %s)", rumor.Kind, rumor.ID)

	return rumor, nil
}
