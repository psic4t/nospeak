package client

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/internal/logging"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

// ProfileResolver consolidates all profile resolution logic
type ProfileResolver struct {
	client       *Client
	cache        cache.Cache
	displayNames map[string]string
	logger       *logging.DebugLogger
	mu           sync.RWMutex
}

// NewProfileResolver creates a new ProfileResolver instance
func NewProfileResolver(client *Client) *ProfileResolver {
	return &ProfileResolver{
		client:       client,
		cache:        cache.GetCache(),
		displayNames: make(map[string]string),
		logger:       logging.NewDebugLogger(false), // Default debug disabled
	}
}

// SetDebugMode enables or disables debug logging for the profile resolver
func (pr *ProfileResolver) SetDebugMode(debug bool) {
	pr.logger = logging.NewDebugLogger(debug)
}

// GetDisplayName returns the display name for an npub, using cached data if available
// and falling back to truncated npub if no name is found
func (pr *ProfileResolver) GetDisplayName(npub string) string {
	pr.mu.RLock()
	if displayName, exists := pr.displayNames[npub]; exists {
		pr.mu.RUnlock()
		return displayName
	}
	pr.mu.RUnlock()

	// Try cache first
	if cachedProfile, found := pr.cache.GetProfile(npub); found {
		metadata := cachedProfile.ToProfileMetadata()
		displayName := pr.extractDisplayName(metadata)
		if displayName != "" {
			pr.setDisplayName(npub, displayName)
			return displayName
		}
	}

	// Fallback to truncated npub
	fallback := npub[:8] + "..."
	pr.setDisplayName(npub, fallback)
	return fallback
}

// GetFullProfile fetches the complete profile from network or cache
func (pr *ProfileResolver) GetFullProfile(ctx context.Context, npub string, debug bool) (cache.ProfileMetadata, error) {
	// Try cache first
	if cachedProfile, found := pr.cache.GetProfile(npub); found {
		pr.logger.Debug("Found cached profile for %s", npub[:8]+"...")
		metadata := cachedProfile.ToProfileMetadata()
		// Update display name cache
		displayName := pr.extractDisplayName(metadata)
		if displayName != "" {
			pr.setDisplayName(npub, displayName)
		}
		return metadata, nil
	}

	// Fetch from network
	metadata, err := pr.fetchProfileFromNetwork(ctx, npub, debug)
	if err != nil {
		return cache.ProfileMetadata{}, err
	}

	// Cache the profile
	pr.cache.SetProfileWithRelayList(npub, metadata, nil, nil, "", 24*time.Hour)

	// Update display name cache
	displayName := pr.extractDisplayName(metadata)
	if displayName != "" {
		pr.setDisplayName(npub, displayName)
	}

	return metadata, nil
}

// RefreshProfile refreshes a profile from the network and updates caches
func (pr *ProfileResolver) RefreshProfile(ctx context.Context, npub string, debug bool) error {
	metadata, err := pr.fetchProfileFromNetwork(ctx, npub, debug)
	if err != nil {
		return fmt.Errorf("failed to refresh profile for %s: %w", npub[:8]+"...", err)
	}

	// Update cache
	pr.cache.SetProfileWithRelayList(npub, metadata, nil, nil, "", 24*time.Hour)

	// Update display name cache
	displayName := pr.extractDisplayName(metadata)
	if displayName != "" {
		pr.setDisplayName(npub, displayName)
	} else {
		pr.setDisplayName(npub, npub[:8]+"...")
	}

	pr.logger.Debug("Refreshed profile for %s: %s", npub[:8]+"...", displayName)

	return nil
}

// InitializeDisplayNames populates the display names map from cached profiles
func (pr *ProfileResolver) InitializeDisplayNames(npubs []string) {
	pr.mu.Lock()
	defer pr.mu.Unlock()

	for _, npub := range npubs {
		if _, exists := pr.displayNames[npub]; !exists {
			if cachedProfile, found := pr.cache.GetProfile(npub); found {
				metadata := cachedProfile.ToProfileMetadata()
				displayName := pr.extractDisplayName(metadata)
				if displayName != "" {
					pr.displayNames[npub] = displayName
				} else {
					pr.displayNames[npub] = npub[:8] + "..."
				}
			} else {
				pr.displayNames[npub] = npub[:8] + "..."
			}
		}
	}
}

// AddNewPartner adds a new partner and initializes their display name
func (pr *ProfileResolver) AddNewPartner(npub string) {
	pr.mu.Lock()
	defer pr.mu.Unlock()

	if _, exists := pr.displayNames[npub]; !exists {
		// Try cache first
		if cachedProfile, found := pr.cache.GetProfile(npub); found {
			metadata := cachedProfile.ToProfileMetadata()
			displayName := pr.extractDisplayName(metadata)
			if displayName != "" {
				pr.displayNames[npub] = displayName
			} else {
				pr.displayNames[npub] = npub[:8] + "..."
			}
		} else {
			pr.displayNames[npub] = npub[:8] + "..."
		}
	}
}

// GetAllDisplayNames returns a copy of all display names
func (pr *ProfileResolver) GetAllDisplayNames() map[string]string {
	pr.mu.RLock()
	defer pr.mu.RUnlock()

	result := make(map[string]string)
	for k, v := range pr.displayNames {
		result[k] = v
	}
	return result
}

// ClearDisplayNames clears the display names cache
func (pr *ProfileResolver) ClearDisplayNames() {
	pr.mu.Lock()
	defer pr.mu.Unlock()

	pr.displayNames = make(map[string]string)
}

// Helper methods

func (pr *ProfileResolver) extractDisplayName(metadata cache.ProfileMetadata) string {
	if metadata.Name != "" {
		return metadata.Name
	}
	if metadata.DisplayName != "" {
		return metadata.DisplayName
	}
	return ""
}

func (pr *ProfileResolver) setDisplayName(npub, displayName string) {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	pr.displayNames[npub] = displayName
}

func (pr *ProfileResolver) fetchProfileFromNetwork(ctx context.Context, npub string, debug bool) (cache.ProfileMetadata, error) {
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

	events, err := pr.client.QueryEvents(ctx, filters, debug)
	if err != nil {
		pr.logger.Debug("Failed to query profile metadata for %s: %v", npub, err)
		return cache.ProfileMetadata{}, err
	}

	if len(events) == 0 {
		pr.logger.Debug("No profile metadata found for %s", npub)
		return cache.ProfileMetadata{}, nil
	}

	event := events[0]
	var metadata cache.ProfileMetadata
	if err := json.Unmarshal([]byte(event.Content), &metadata); err != nil {
		pr.logger.Debug("Failed to parse profile metadata for %s: %v", npub, err)
		return cache.ProfileMetadata{}, err
	}

	pr.logger.Debug("Resolved profile for %s: %s", npub[:8]+"...", metadata.Name)

	return metadata, nil
}
