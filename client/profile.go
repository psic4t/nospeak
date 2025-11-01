package client

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

type ProfileMetadata struct {
	Name string `json:"name"`
}

func (c *Client) ResolveUsername(ctx context.Context, npub string, debug bool) (string, error) {
	cache := cache.GetCache()

	if username, found := cache.GetUsername(npub); found {
		if debug {
			log.Printf("Found cached username for %s: %s", npub[:8]+"...", username)
		}
		return username, nil
	}

	_, pubKey, err := nip19.Decode(npub)
	if err != nil {
		return npub, fmt.Errorf("failed to decode npub: %w", err)
	}

	hexPubKey := pubKey.(string)

	filters := nostr.Filters{{
		Kinds:   []int{0},
		Authors: []string{hexPubKey},
		Limit:   1,
	}}

	events, err := c.QueryEvents(ctx, filters, debug)
	if err != nil {
		if debug {
			log.Printf("Failed to query profile metadata for %s: %v", npub, err)
		}
		return npub, err
	}

	if len(events) == 0 {
		if debug {
			log.Printf("No profile metadata found for %s", npub)
		}
		return npub, nil
	}

	event := events[0]
	var metadata ProfileMetadata
	if err := json.Unmarshal([]byte(event.Content), &metadata); err != nil {
		if debug {
			log.Printf("Failed to parse profile metadata for %s: %v", npub, err)
		}
		return npub, err
	}

	username := metadata.Name
	if username == "" {
		if debug {
			log.Printf("No name found in profile metadata for %s", npub)
		}
		return npub, nil
	}

	cache.SetUsername(npub, username, 24*time.Hour)

	if debug {
		log.Printf("Resolved username for %s: %s (cached for 24h)", npub, username)
	}

	return username, nil
}

func (c *Client) ResolveUsernameWithFallback(ctx context.Context, npub string, debug bool) string {
	username, err := c.ResolveUsername(ctx, npub, debug)
	if err != nil || username == npub {
		return npub[:8] + "..."
	}
	return username
}
