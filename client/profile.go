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

func (c *Client) ResolveUsername(ctx context.Context, npub string, debug bool) (string, error) {
	// Try to get cached profile first
	cacheInstance := cache.GetCache()
	if cachedProfile, found := cacheInstance.GetProfile(npub); found {
		metadata := cachedProfile.ToProfileMetadata()
		username := metadata.Name
		if username == "" {
			username = metadata.DisplayName
		}
		if username != "" {
			if debug {
				log.Printf("Found cached username for %s: %s", npub[:8]+"...", username)
			}
			return username, nil
		}
	}

	// If no cached profile or no name, fetch from network
	profile, err := c.ResolveProfile(ctx, npub, debug)
	if err != nil {
		return npub, err
	}

	// Extract username from profile
	username := profile.Name
	if username == "" {
		username = profile.DisplayName
	}

	if username == "" {
		if debug {
			log.Printf("No name found in profile metadata for %s", npub)
		}
		return npub, nil
	}

	if debug {
		log.Printf("Resolved username for %s: %s", npub[:8]+"...", username)
	}

	return username, nil
}

func (c *Client) ResolveProfile(ctx context.Context, npub string, debug bool) (cache.ProfileMetadata, error) {
	cacheInstance := cache.GetCache()

	// Try to get cached profile first
	if profile, found := cacheInstance.GetProfile(npub); found {
		if debug {
			log.Printf("Found cached profile for %s", npub[:8]+"...")
		}
		metadata := profile.ToProfileMetadata()
		return metadata, nil
	}

	_, pubKey, err := nip19.Decode(npub)
	if err != nil {
		return cache.ProfileMetadata{}, fmt.Errorf("failed to decode npub: %w", err)
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
		return cache.ProfileMetadata{}, err
	}

	if len(events) == 0 {
		if debug {
			log.Printf("No profile metadata found for %s", npub)
		}
		return cache.ProfileMetadata{}, nil
	}

	event := events[0]
	var metadata cache.ProfileMetadata
	if err := json.Unmarshal([]byte(event.Content), &metadata); err != nil {
		if debug {
			log.Printf("Failed to parse profile metadata for %s: %v", npub, err)
		}
		return cache.ProfileMetadata{}, err
	}

	// Cache full profile
	cacheInstance.SetProfile(npub, metadata, 24*time.Hour)

	if debug {
		log.Printf("Resolved profile for %s: %s (cached for 24h)", npub, metadata.Name)
	}

	return metadata, nil
}

func (c *Client) ResolveUsernameWithFallback(ctx context.Context, npub string, debug bool) string {
	username, err := c.ResolveUsername(ctx, npub, debug)
	if err != nil || username == npub {
		return npub[:8] + "..."
	}
	return username
}
