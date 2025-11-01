package client

import (
	"fmt"

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

	encryptFunc := func(plaintext string) (string, error) {
		conversationKey, err := nip44.GenerateConversationKey(recipientHex, c.secretKey)
		if err != nil {
			return "", err
		}
		return nip44.Encrypt(plaintext, conversationKey)
	}

	signFunc := func(event *nostr.Event) error {
		return event.Sign(c.secretKey)
	}

	giftWrap, err := nip59.GiftWrap(rumor, recipientHex, encryptFunc, signFunc, nil)
	if err != nil {
		return nostr.Event{}, fmt.Errorf("failed to create gift wrap: %w", err)
	}

	return giftWrap, nil
}

func (c *Client) UnwrapGiftWrap(giftWrap nostr.Event) (nostr.Event, error) {
	decryptFunc := func(otherPubKey, ciphertext string) (string, error) {
		conversationKey, err := nip44.GenerateConversationKey(otherPubKey, c.secretKey)
		if err != nil {
			return "", err
		}
		return nip44.Decrypt(ciphertext, conversationKey)
	}

	rumor, err := nip59.GiftUnwrap(giftWrap, decryptFunc)
	if err != nil {
		return nostr.Event{}, fmt.Errorf("failed to unwrap gift: %w", err)
	}

	return rumor, nil
}
