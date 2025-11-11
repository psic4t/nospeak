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
			if profile.HasRelayList() {
				log.Printf("Profile has cached relay list with %d relays", len(profile.GetRelayList()))
			}
		}
		metadata := profile.ToProfileMetadata()
		return metadata, nil
	}

	_, pubKey, err := nip19.Decode(npub)
	if err != nil {
		return cache.ProfileMetadata{}, fmt.Errorf("failed to decode npub: %w", err)
	}

	hexPubKey := pubKey.(string)

	// Query for both profile metadata (kind 0) and relay list (kind 10050)
	filters := nostr.Filters{{
		Kinds:   []int{0, 10050}, // Query both kinds
		Authors: []string{hexPubKey},
		Limit:   10, // Higher limit to get both events
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

	// Process events - separate profile metadata from relay list
	var profileEvent *nostr.Event
	var relayListEvent *nostr.Event
	var relayList []string

	for _, event := range events {
		switch event.Kind {
		case 0:
			profileEvent = &event
		case 10050:
			relayListEvent = &event
			// Extract relays from the event tags
			for _, tag := range event.Tags {
				if len(tag) >= 2 && tag[0] == "relay" {
					relayList = append(relayList, tag[1])
				}
			}
		}
	}

	// We need at least a profile event
	if profileEvent == nil {
		if debug {
			log.Printf("No kind 0 profile metadata found for %s", npub)
		}
		return cache.ProfileMetadata{}, nil
	}

	var metadata cache.ProfileMetadata
	if err := json.Unmarshal([]byte(profileEvent.Content), &metadata); err != nil {
		if debug {
			log.Printf("Failed to parse profile metadata for %s: %v", npub, err)
		}
		return cache.ProfileMetadata{}, err
	}

	// Cache profile with relay list if available
	var relayListEventID string
	if relayListEvent != nil {
		relayListEventID = relayListEvent.ID
	}

	if len(relayList) > 0 && relayListEventID != "" {
		// Cache both profile and relay list together
		err = cacheInstance.SetProfileWithRelayList(npub, metadata, relayList, relayListEventID, 24*time.Hour)
		if debug {
			log.Printf("Resolved profile for %s: %s with %d relays (cached for 24h)", npub, metadata.Name, len(relayList))
		}
	} else {
		// Cache profile only (preserves existing relay list if present)
		// Use empty relay list and event ID to update profile metadata only
		err = cacheInstance.SetProfileWithRelayList(npub, metadata, nil, "", 24*time.Hour)
		if debug {
			log.Printf("Resolved profile for %s: %s (cached for 24h, no relay list found)", npub, metadata.Name)
		}
	}

	if err != nil {
		if debug {
			log.Printf("Failed to cache profile for %s: %v", npub, err)
		}
		// Continue even if caching fails
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
