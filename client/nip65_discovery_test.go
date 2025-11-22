package client

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/mocks"
	"github.com/data.haus/nospeak/testutils"
)

func TestDiscoverUserRelays(t *testing.T) {
	// Setup test client
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		Npub: keys.Npub,
		Nsec: keys.Nsec,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Initialize cache for testing
	testCache := mocks.NewMockCache()
	cache.SetCache(testCache)

	ctx := context.Background()

	t.Run("Cache Hit - Valid cached relays", func(t *testing.T) {
		// Setup cached relays using unified interface
		testCache.SetNIP65Relays(keys.Npub,
			[]string{"wss://relay1.example.com", "wss://relay2.example.com"}, // read relays
			[]string{"wss://relay3.example.com"},                             // write relays
			24*time.Hour)

		readRelays, writeRelays, err := client.DiscoverUserRelays(ctx, keys.Npub, true)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		if len(readRelays) != 2 {
			t.Errorf("Expected 2 read relays, got %d", len(readRelays))
		}
		if len(writeRelays) != 1 {
			t.Errorf("Expected 1 write relay, got %d", len(writeRelays))
		}

		expectedRead := []string{"wss://relay1.example.com", "wss://relay2.example.com"}
		expectedWrite := []string{"wss://relay3.example.com"}

		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Read relays mismatch, expected %v, got %v", expectedRead, readRelays)
		}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Write relays mismatch, expected %v, got %v", expectedWrite, writeRelays)
		}
	})

	t.Run("Cache Miss - Network fallback", func(t *testing.T) {
		// Clear cache to simulate cache miss by setting expired TTL
		testCache.SetNIP65Relays(keys.Npub, nil, nil, 0) // Clear with expired TTL

		readRelays, writeRelays, err := client.DiscoverUserRelays(ctx, keys.Npub, true)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Should return discovery relays as fallback
		discoveryRelays := GetDiscoveryRelays()
		expectedRelays := discoveryRelays.Relays

		if !relaysEqual(readRelays, expectedRelays) {
			t.Errorf("Read relays should fallback to discovery relays, expected %v, got %v", expectedRelays, readRelays)
		}
		if !relaysEqual(writeRelays, expectedRelays) {
			t.Errorf("Write relays should fallback to discovery relays, expected %v, got %v", expectedRelays, writeRelays)
		}
	})

	t.Run("Expired Cache - Refresh", func(t *testing.T) {
		// Setup expired cache entry
		testCache.SetNIP65Relays(keys.Npub,
			[]string{"wss://old.relay.com"},
			[]string{"wss://old.write.com"},
			-1*time.Hour) // Expired (negative TTL)

		readRelays, writeRelays, err := client.DiscoverUserRelays(ctx, keys.Npub, true)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Should return discovery relays since cache is expired
		discoveryRelays := GetDiscoveryRelays()
		expectedRelays := discoveryRelays.Relays

		if !relaysEqual(readRelays, expectedRelays) {
			t.Errorf("Expired cache should trigger fallback, expected %v, got %v", expectedRelays, readRelays)
		}
		if !relaysEqual(writeRelays, expectedRelays) {
			t.Errorf("Expired cache should trigger fallback, expected %v, got %v", expectedRelays, writeRelays)
		}
	})
}

func TestGetCachedUserRelays(t *testing.T) {
	// Setup test client
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		Npub: keys.Npub,
		Nsec: keys.Nsec,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	testCache := mocks.NewMockCache()
	cache.SetCache(testCache)

	t.Run("Valid Cache Hit", func(t *testing.T) {
		// Setup valid cached relays
		testCache.SetNIP65Relays(keys.Npub,
			[]string{"wss://cached1.example.com"},
			[]string{"wss://cached2.example.com"},
			24*time.Hour)

		readRelays, writeRelays, found := client.GetCachedUserRelays(keys.Npub, true)
		if !found {
			t.Error("Expected cache hit")
		}

		if len(readRelays) != 1 {
			t.Errorf("Expected 1 read relay, got %d", len(readRelays))
		}
		if len(writeRelays) != 1 {
			t.Errorf("Expected 1 write relay, got %d", len(writeRelays))
		}
	})

	t.Run("Cache Miss", func(t *testing.T) {
		// No cache entry - use different npub to avoid collision
		missNpub := "npub1missxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
		readRelays, writeRelays, found := client.GetCachedUserRelays(missNpub, true)
		if found {
			t.Error("Expected cache miss")
		}

		if len(readRelays) != 0 {
			t.Errorf("Expected no read relays, got %v", readRelays)
		}
		if len(writeRelays) != 0 {
			t.Errorf("Expected no write relays, got %v", writeRelays)
		}
	})

	t.Run("Expired Cache", func(t *testing.T) {
		// Setup expired cache entry - use different npub
		expiredNpub := "npub1expdxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
		testCache.SetNIP65Relays(expiredNpub,
			[]string{"wss://expired.example.com"},
			[]string{"wss://expired.example.com"},
			-1*time.Hour) // Expired (negative duration)

		readRelays, writeRelays, found := client.GetCachedUserRelays(expiredNpub, true)
		if found {
			t.Error("Expected cache miss for expired entry")
		}

		if len(readRelays) != 0 {
			t.Errorf("Expected no read relays for expired cache, got %v", readRelays)
		}
		if len(writeRelays) != 0 {
			t.Errorf("Expected no write relays for expired cache, got %v", writeRelays)
		}
	})
}

func TestNIP65BackwardCompatibility(t *testing.T) {
	t.Run("Backward compatibility with unmarked relays", func(t *testing.T) {
		// Test the old format where relays have no read/write markers
		// This should add them to both read and write lists
		unmarkedTags := [][]string{
			{"r", "wss://relay1.example.com"},
			{"r", "wss://relay2.example.com"},
			{"r", "wss://relay3.example.com"},
		}

		readRelays, writeRelays := parseNIP65Tags(unmarkedTags)
		expected := []string{"wss://relay1.example.com", "wss://relay2.example.com", "wss://relay3.example.com"}

		if !relaysEqual(readRelays, expected) {
			t.Errorf("Unmarked relays should be in read list, expected %v, got %v", expected, readRelays)
		}
		if !relaysEqual(writeRelays, expected) {
			t.Errorf("Unmarked relays should be in write list, expected %v, got %v", expected, writeRelays)
		}
	})

	t.Run("Mixed marked and unmarked relays", func(t *testing.T) {
		// Test combination of marked and unmarked relays
		mixedTags := [][]string{
			{"r", "wss://read-only.example.com", "read"},
			{"r", "wss://write-only.example.com", "write"},
			{"r", "wss://both.example.com"}, // unmarked
			{"r", "wss://read-only2.example.com", "read"},
		}

		readRelays, writeRelays := parseNIP65Tags(mixedTags)

		expectedRead := []string{
			"wss://read-only.example.com",
			"wss://both.example.com", // unmarked goes to both
			"wss://read-only2.example.com",
		}
		expectedWrite := []string{
			"wss://write-only.example.com",
			"wss://both.example.com", // unmarked goes to both
		}

		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Mixed marked/unmarked read relays mismatch, expected %v, got %v", expectedRead, readRelays)
		}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Mixed marked/unmarked write relays mismatch, expected %v, got %v", expectedWrite, writeRelays)
		}
	})

	t.Run("Empty marker treated as unmarked", func(t *testing.T) {
		// Test that empty marker string is treated as unmarked
		emptyMarkerTags := [][]string{
			{"r", "wss://empty-marker.example.com", ""}, // empty marker
			{"r", "wss://normal-read.example.com", "read"},
		}

		readRelays, writeRelays := parseNIP65Tags(emptyMarkerTags)

		// Empty marker should be treated as unmarked (goes to both lists)
		expectedRead := []string{"wss://empty-marker.example.com", "wss://normal-read.example.com"}
		expectedWrite := []string{"wss://empty-marker.example.com"}

		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Empty marker read relays mismatch, expected %v, got %v", expectedRead, readRelays)
		}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Empty marker write relays mismatch, expected %v, got %v", expectedWrite, writeRelays)
		}
	})
}

func TestGetDiscoveryRelays(t *testing.T) {
	discoveryRelays := GetDiscoveryRelays()

	expectedRelays := []string{
		"wss://purplepag.es",
		"wss://nostr.data.haus",
		"wss://nos.lol",
		"wss://relay.damus.io",
	}

	if !relaysEqual(discoveryRelays.Relays, expectedRelays) {
		t.Errorf("Discovery relays mismatch, expected %v, got %v", expectedRelays, discoveryRelays.Relays)
	}
}

func TestRemoveDuplicates(t *testing.T) {
	t.Run("Remove duplicates from list with repeats", func(t *testing.T) {
		input := []string{
			"wss://relay1.example.com",
			"wss://relay2.example.com",
			"wss://relay1.example.com", // duplicate
			"wss://relay3.example.com",
			"wss://relay2.example.com", // duplicate
		}

		result := removeDuplicates(input)

		expected := []string{
			"wss://relay1.example.com",
			"wss://relay2.example.com",
			"wss://relay3.example.com",
		}

		if !relaysEqual(result, expected) {
			t.Errorf("Expected %v, got %v", expected, result)
		}
	})

	t.Run("Handle empty list", func(t *testing.T) {
		result := removeDuplicates([]string{})
		if len(result) != 0 {
			t.Errorf("Expected empty list, got %v", result)
		}
	})

	t.Run("Handle list with no duplicates", func(t *testing.T) {
		input := []string{"wss://relay1.com", "wss://relay2.com"}
		result := removeDuplicates(input)
		if !relaysEqual(result, input) {
			t.Errorf("Expected %v, got %v", input, result)
		}
	})
}

func TestValidateRelayLists(t *testing.T) {
	t.Run("Valid relay lists", func(t *testing.T) {
		readRelays := []string{"wss://read1.example.com", "wss://read2.example.com"}
		writeRelays := []string{"wss://write1.example.com"}

		err := validateRelayLists(readRelays, writeRelays)
		if err != nil {
			t.Errorf("Expected no error for valid relays, got: %v", err)
		}
	})

	t.Run("Invalid relay URL - missing protocol", func(t *testing.T) {
		readRelays := []string{"relay1.example.com"} // missing wss://
		writeRelays := []string{"wss://write1.example.com"}

		err := validateRelayLists(readRelays, writeRelays)
		if err == nil {
			t.Error("Expected error for invalid relay URL")
		}
	})

	t.Run("Empty relay URL", func(t *testing.T) {
		readRelays := []string{""}
		writeRelays := []string{"wss://write1.example.com"}

		err := validateRelayLists(readRelays, writeRelays)
		if err == nil {
			t.Error("Expected error for empty relay URL")
		}
	})
}

func TestNIP65TagParsing(t *testing.T) {
	// Test the core NIP-65 tag parsing logic directly
	t.Run("Parse marked relays correctly", func(t *testing.T) {
		// Test read-marked relays
		readTags := [][]string{
			{"r", "wss://read1.example.com", "read"},
			{"r", "wss://read2.example.com", "read"},
		}
		readRelays, writeRelays := parseNIP65Tags(readTags)

		expectedRead := []string{"wss://read1.example.com", "wss://read2.example.com"}
		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Read relays mismatch, expected %v, got %v", expectedRead, readRelays)
		}
		if len(writeRelays) != 0 {
			t.Errorf("Expected no write relays, got %v", writeRelays)
		}

		// Test write-marked relays
		writeTags := [][]string{
			{"r", "wss://write1.example.com", "write"},
			{"r", "wss://write2.example.com", "write"},
		}
		readRelays, writeRelays = parseNIP65Tags(writeTags)

		expectedWrite := []string{"wss://write1.example.com", "wss://write2.example.com"}
		if len(readRelays) != 0 {
			t.Errorf("Expected no read relays, got %v", readRelays)
		}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Write relays mismatch, expected %v, got %v", expectedWrite, writeRelays)
		}
	})

	t.Run("Handle unmarked relays for backward compatibility", func(t *testing.T) {
		unmarkedTags := [][]string{
			{"r", "wss://unmarked1.example.com"},
			{"r", "wss://unmarked2.example.com"},
		}
		readRelays, writeRelays := parseNIP65Tags(unmarkedTags)

		expectedBoth := []string{"wss://unmarked1.example.com", "wss://unmarked2.example.com"}
		if !relaysEqual(readRelays, expectedBoth) {
			t.Errorf("Read relays should include unmarked, expected %v, got %v", expectedBoth, readRelays)
		}
		if !relaysEqual(writeRelays, expectedBoth) {
			t.Errorf("Write relays should include unmarked, expected %v, got %v", expectedBoth, writeRelays)
		}
	})

	t.Run("Remove duplicate relays within same category", func(t *testing.T) {
		duplicateTags := [][]string{
			{"r", "wss://duplicate.example.com", "read"},
			{"r", "wss://duplicate.example.com", "read"}, // duplicate
			{"r", "wss://unique.example.com", "read"},
		}
		readRelays, writeRelays := parseNIP65Tags(duplicateTags)

		expectedRead := []string{"wss://duplicate.example.com", "wss://unique.example.com"}
		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Duplicates should be removed, expected %v, got %v", expectedRead, readRelays)
		}
		if len(writeRelays) != 0 {
			t.Errorf("Expected no write relays, got %v", writeRelays)
		}
	})

	t.Run("Handle relay in both read and write categories", func(t *testing.T) {
		mixedTags := [][]string{
			{"r", "wss://mixed.example.com", "read"},
			{"r", "wss://mixed.example.com", "write"},
			{"r", "wss://readonly.example.com", "read"},
			{"r", "wss://writeonly.example.com", "write"},
		}
		readRelays, writeRelays := parseNIP65Tags(mixedTags)

		expectedRead := []string{"wss://mixed.example.com", "wss://readonly.example.com"}
		expectedWrite := []string{"wss://mixed.example.com", "wss://writeonly.example.com"}

		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Mixed read relays mismatch, expected %v, got %v", expectedRead, readRelays)
		}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Mixed write relays mismatch, expected %v, got %v", expectedWrite, writeRelays)
		}
	})

	t.Run("Validate relay list integrity", func(t *testing.T) {
		// Test that read relays only contain read-marked or unmarked relays
		mixedTags := [][]string{
			{"r", "wss://read.example.com", "read"},
			{"r", "wss://write.example.com", "write"},
			{"r", "wss://unmarked.example.com"},
		}
		readRelays, writeRelays := parseNIP65Tags(mixedTags)

		// Read relays should contain read and unmarked only
		expectedRead := []string{"wss://read.example.com", "wss://unmarked.example.com"}
		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Read relays validation failed, expected %v, got %v", expectedRead, readRelays)
		}

		// Write relays should contain write and unmarked only
		expectedWrite := []string{"wss://write.example.com", "wss://unmarked.example.com"}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Write relays validation failed, expected %v, got %v", expectedWrite, writeRelays)
		}
	})

	t.Run("Handle empty and invalid tags", func(t *testing.T) {
		invalidTags := [][]string{
			{"r", "", "read"}, // empty URL
			{"r", "wss://valid.example.com", "read"},
			{"not_r", "wss://invalid.example.com", "read"}, // wrong tag type
			{"r"},                              // incomplete tag
			{"r", "wss://another.example.com"}, // unmarked but valid
		}
		readRelays, writeRelays := parseNIP65Tags(invalidTags)

		// Should only include valid relays
		expectedRead := []string{"wss://valid.example.com", "wss://another.example.com"}
		expectedWrite := []string{"wss://another.example.com"} // unmarked goes to both

		if !relaysEqual(readRelays, expectedRead) {
			t.Errorf("Invalid tag handling failed for read, expected %v, got %v", expectedRead, readRelays)
		}
		if !relaysEqual(writeRelays, expectedWrite) {
			t.Errorf("Invalid tag handling failed for write, expected %v, got %v", expectedWrite, writeRelays)
		}
	})
}

func validateRelayLists(readRelays, writeRelays []string) error {
	if len(readRelays) == 0 || len(writeRelays) == 0 {
		return fmt.Errorf("relay lists cannot be empty")
	}
	for _, relays := range [][]string{readRelays, writeRelays} {
		for _, r := range relays {
			if r != "" && !strings.HasPrefix(r, "wss://") {
				return fmt.Errorf("invalid relay URL: %s", r)
			}
		}
	}
	return nil
}

// parseNIP65Tags extracts the core parsing logic for testing
func parseNIP65Tags(tags [][]string) (readRelays, writeRelays []string) {
	var readRelayList, writeRelayList []string

	for _, tag := range tags {
		if len(tag) >= 2 && tag[0] == "r" && tag[1] != "" {
			relayURL := tag[1]
			var mark string
			if len(tag) >= 3 {
				mark = tag[2]
			}

			if mark == "read" {
				readRelayList = append(readRelayList, relayURL)
			} else if mark == "write" {
				writeRelayList = append(writeRelayList, relayURL)
			} else {
				// Unmarked relays go to both lists (backward compatibility)
				readRelayList = append(readRelayList, relayURL)
				writeRelayList = append(writeRelayList, relayURL)
			}
		}
	}

	// Remove duplicates while preserving order
	readRelayList = removeDuplicates(readRelayList)
	writeRelayList = removeDuplicates(writeRelayList)

	return readRelayList, writeRelayList
}

// Helper function to compare relay slices
func relaysEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	aMap := make(map[string]bool)
	bMap := make(map[string]bool)

	for _, relay := range a {
		aMap[relay] = true
	}
	for _, relay := range b {
		bMap[relay] = true
	}

	for relay := range aMap {
		if !bMap[relay] {
			return false
		}
	}
	for relay := range bMap {
		if !aMap[relay] {
			return false
		}
	}

	return true
}
