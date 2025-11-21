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

	// Query for both profile metadata (kind 0) and relay list (kind 10002)
	filters := nostr.Filters{{
		Kinds:   []int{0, 10002}, // Query both kinds
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
	var readRelays []string
	var writeRelays []string

	for _, event := range events {
		switch event.Kind {
		case 0:
			profileEvent = &event
		case 10002:
			relayListEvent = &event
			if debug {
				log.Printf("Processing NIP-65 relay list event for %s: %s", npub[:8]+"...", event.ID)
				log.Printf("Raw event tags: %v", event.Tags)
			}
			// Extract relays from the event tags
			for i, tag := range event.Tags {
				if len(tag) >= 2 && tag[0] == "r" {
					relayURL := tag[1]
					var marker string
					if len(tag) >= 3 {
						marker = tag[2]
					}

					if debug {
						log.Printf("Found relay tag %d: URL=%s, marker=%s", i, relayURL, marker)
					}

					switch marker {
					case "read":
						readRelays = append(readRelays, relayURL)
						if debug {
							log.Printf("Added %s to read relays", relayURL)
						}
					case "write":
						writeRelays = append(writeRelays, relayURL)
						if debug {
							log.Printf("Added %s to write relays", relayURL)
						}
					default:
						// Unmarked or unknown marker -> both
						readRelays = append(readRelays, relayURL)
						writeRelays = append(writeRelays, relayURL)
						if debug {
							log.Printf("Added %s to both read and write relays (marker: %s)", relayURL, marker)
						}
					}
				}
			}
			if debug {
				log.Printf("Initial relay counts - Read: %d, Write: %d", len(readRelays), len(writeRelays))
			}
		}
	}

	// Deduplicate relay lists
	if debug {
		log.Printf("Before deduplication - Read: %v", readRelays)
		log.Printf("Before deduplication - Write: %v", writeRelays)
	}
	readRelays = removeDuplicates(readRelays)
	writeRelays = removeDuplicates(writeRelays)
	if debug {
		log.Printf("After deduplication - Read: %d relays: %v", len(readRelays), readRelays)
		log.Printf("After deduplication - Write: %d relays: %v", len(writeRelays), writeRelays)
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

	if debug {
		log.Printf("Profile resolution complete - has relay list: %v, readRelays: %d, writeRelays: %d",
			relayListEvent != nil, len(readRelays), len(writeRelays))
	}

	if (len(readRelays) > 0 || len(writeRelays) > 0) && relayListEventID != "" {
		// Cache both profile and relay list together
		if debug {
			log.Printf("Caching profile with relay data for %s", npub[:8]+"...")
			log.Printf("Read relays to cache: %v", readRelays)
			log.Printf("Write relays to cache: %v", writeRelays)
		}
		err = cacheInstance.SetProfileWithRelayList(npub, metadata, readRelays, writeRelays, 24*time.Hour)
		if debug {
			log.Printf("Resolved profile for %s: %s with %d read / %d write relays (cached for 24h)",
				npub, metadata.Name, len(readRelays), len(writeRelays))
		}
	} else {
		// Cache profile only (preserves existing relay list if present)
		// Use empty relay list and event ID to update profile metadata only
		if debug {
			log.Printf("Caching profile metadata only for %s (no relay data)", npub[:8]+"...")
		}
		err = cacheInstance.SetProfileWithRelayList(npub, metadata, nil, nil, 24*time.Hour)
		if debug {
			log.Printf("Resolved profile for %s: %s (cached for 24h, no relay list found)", npub, metadata.Name)
		}
	}

	if err != nil {
		if debug {
			log.Printf("Failed to cache profile for %s: %v", npub, err)
		}
		// Continue even if caching fails
	} else {
		if debug {
			log.Printf("Successfully cached profile for %s", npub[:8]+"...")
		}
	}

	return metadata, nil
}

// DiscoverUserRelays fetches and caches NIP-65 relay information for a user
func (c *Client) DiscoverUserRelays(ctx context.Context, npub string, debug bool) (readRelays, writeRelays []string, err error) {
	cacheInstance := cache.GetCache()

	// Check cache first for startup optimization
	if cachedProfile, found := cacheInstance.GetProfile(npub); found {
		if debug {
			log.Printf("Using cached relays for %s: %d read, %d write",
				npub[:8]+"...", len(cachedProfile.GetReadRelays()), len(cachedProfile.GetWriteRelays()))
		}

		// Check if expired and trigger background refresh if needed
		if time.Now().After(cachedProfile.ExpiresAt) {
			c.triggerBackgroundRelayRefresh(npub, debug)
		}

		return cachedProfile.GetReadRelays(), cachedProfile.GetWriteRelays(), nil
	}

	return c.fetchUserRelaysFromNetwork(ctx, npub, debug)
}

func (c *Client) triggerBackgroundRelayRefresh(npub string, debug bool) {
	c.refreshingRelaysMu.Lock()
	if c.refreshingRelays[npub] {
		c.refreshingRelaysMu.Unlock()
		return
	}
	c.refreshingRelays[npub] = true
	c.refreshingRelaysMu.Unlock()

	go func() {
		defer func() {
			c.refreshingRelaysMu.Lock()
			delete(c.refreshingRelays, npub)
			c.refreshingRelaysMu.Unlock()
		}()

		// Create a background context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if debug {
			log.Printf("Triggering background relay refresh for %s", npub[:8]+"...")
		}
		_, _, err := c.fetchUserRelaysFromNetwork(ctx, npub, debug)
		if err != nil && debug {
			log.Printf("Background relay refresh failed for %s: %v", npub[:8]+"...", err)
		}
	}()
}

func (c *Client) fetchUserRelaysFromNetwork(ctx context.Context, npub string, debug bool) (readRelays, writeRelays []string, err error) {
	cacheInstance := cache.GetCache()

	_, pubKey, err := nip19.Decode(npub)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decode npub: %w", err)
	}

	hexPubKey := pubKey.(string)

	// Query specifically for NIP-65 relay list (kind 10002)
	if debug {
		log.Printf("Querying NIP-65 relay list for %s (hex key: %s)", npub[:8]+"...", hexPubKey[:16]+"...")
	}
	filters := nostr.Filters{{
		Kinds:   []int{10002},
		Authors: []string{hexPubKey},
		Limit:   1, // Only need the most recent
	}}

	events, err := c.QueryEvents(ctx, filters, debug)
	if err != nil {
		if debug {
			log.Printf("Failed to query NIP-65 relay list for %s: %v", npub, err)
		}
		return nil, nil, err
	}

	if debug {
		log.Printf("Received %d NIP-65 events for %s", len(events), npub[:8]+"...")
	}

	if len(events) == 0 {
		if debug {
			log.Printf("No NIP-65 relay list found for %s, using discovery relays as fallback", npub)
		}
		// Return discovery relays as fallback
		discovery := GetDiscoveryRelays()
		if debug {
			log.Printf("Using discovery relays as fallback: %v", discovery.Relays)
		}
		return discovery.Relays, discovery.Relays, nil
	}

	// Parse NIP-65 event for read/write relays
	event := events[0]
	var readRelayList, writeRelayList []string

	if debug {
		log.Printf("Parsing NIP-65 event %s for %s", event.ID, npub[:8]+"...")
		log.Printf("Event tags: %v", event.Tags)
	}

	for i, tag := range event.Tags {
		if len(tag) >= 2 && tag[0] == "r" {
			relayURL := tag[1]
			if relayURL == "" {
				continue
			}

			var marker string
			if len(tag) >= 3 {
				marker = tag[2]
			}

			if debug {
				log.Printf("Processing tag %d: URL=%s, marker=%s", i, relayURL, marker)
			}

			switch marker {
			case "read":
				readRelayList = append(readRelayList, relayURL)
				if debug {
					log.Printf("Added %s to read relay list", relayURL)
				}
			case "write":
				writeRelayList = append(writeRelayList, relayURL)
				if debug {
					log.Printf("Added %s to write relay list", relayURL)
				}
			default:
				// Unmarked or unknown marker -> both
				readRelayList = append(readRelayList, relayURL)
				writeRelayList = append(writeRelayList, relayURL)
				if debug {
					log.Printf("Added %s to both read and write relay lists (marker: %s)", relayURL, marker)
				}
			}
		}
	}

	// Deduplicate the relay lists
	if debug {
		log.Printf("Before deduplication - Read: %v", readRelayList)
		log.Printf("Before deduplication - Write: %v", writeRelayList)
	}
	readRelayList = removeDuplicates(readRelayList)
	writeRelayList = removeDuplicates(writeRelayList)
	if debug {
		log.Printf("After deduplication - Read: %d relays: %v", len(readRelayList), readRelayList)
		log.Printf("After deduplication - Write: %d relays: %v", len(writeRelayList), writeRelayList)
	}

	// Cache the discovered relays
	err = cacheInstance.SetNIP65Relays(npub, readRelayList, writeRelayList, 24*time.Hour)
	if err != nil && debug {
		log.Printf("Failed to cache user relays for %s: %v", npub, err)
	}

	if debug {
		log.Printf("Discovered relays for %s: %d read, %d write (cached for 24h)",
			npub[:8]+"...", len(readRelayList), len(writeRelayList))
	}

	return readRelayList, writeRelayList, nil
}

// GetCachedUserRelays returns cached relays for a user without network discovery
func (c *Client) GetCachedUserRelays(npub string, debug bool) (readRelays, writeRelays []string, found bool) {
	cacheInstance := cache.GetCache()

	if cachedProfile, found := cacheInstance.GetProfile(npub); found {
		if debug {
			log.Printf("Retrieved cached relays for %s: %d read, %d write",
				npub[:8]+"...", len(cachedProfile.GetReadRelays()), len(cachedProfile.GetWriteRelays()))
		}
		return cachedProfile.GetReadRelays(), cachedProfile.GetWriteRelays(), true
	}

	if debug {
		log.Printf("No valid cached relays found for %s", npub[:8]+"...")
	}
	return nil, nil, false
}

func (c *Client) ResolveUsernameWithFallback(ctx context.Context, npub string, debug bool) string {
	username, err := c.ResolveUsername(ctx, npub, debug)
	if err != nil || username == npub {
		return npub[:8] + "..."
	}
	return username
}

func removeDuplicates(elements []string) []string {
	encountered := map[string]bool{}
	result := []string{}

	for _, v := range elements {
		if encountered[v] == false {
			encountered[v] = true
			result = append(result, v)
		}
	}
	return result
}
