package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/client"
	"github.com/nbd-wtf/go-nostr/nip19"
)

// DebugRelay provides debugging tools for relay data
func DebugRelay(args []string, debug bool, configPath string) {
	if len(args) < 1 {
		fmt.Println("Usage: nospeak debug-relay <npub> [command]")
		fmt.Println("")
		fmt.Println("Commands:")
		fmt.Println("  inspect     - Show cached relay data for the user")
		fmt.Println("  validate    - Validate relay data and show issues")
		fmt.Println("  repair      - Attempt to repair corrupted relay data")
		fmt.Println("  refresh     - Force refresh relay data from network")
		fmt.Println("  trace       - Trace NIP-65 discovery with detailed logging")
		fmt.Println("")
		fmt.Println("If no command is provided, shows a summary of cached data.")
		os.Exit(1)
	}

	npub := args[0]
	command := "summary"
	if len(args) > 1 {
		command = args[1]
	}

	// Validate npub format
	if _, _, err := nip19.Decode(npub); err != nil {
		log.Fatalf("Invalid npub format: %v", err)
	}

	// Initialize client
	client, _, _, err := client.CreateClient(configPath, debug)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Disconnect()

	cacheInstance := cache.GetCache()

	switch command {
	case "inspect":
		inspectRelayData(npub, cacheInstance)
	case "validate":
		validateRelayData(npub, cacheInstance)
	case "repair":
		repairRelayData(npub, cacheInstance)
	case "refresh":
		refreshRelayData(npub, client, debug)
	case "trace":
		traceRelayDiscovery(npub, client, debug)
	case "summary":
		showRelaySummary(npub, cacheInstance)
	default:
		log.Fatalf("Unknown command: %s", command)
	}
}

func inspectRelayData(npub string, cacheInstance cache.Cache) {
	fmt.Printf("=== Relay Data Inspection for %s ===\n\n", npub[:16]+"...")

	profile, found := cacheInstance.GetProfile(npub)
	if !found {
		fmt.Printf("No cached profile found for %s\n", npub[:8]+"...")
		return
	}

	fmt.Printf("Profile found:\n")
	fmt.Printf("  Cached at: %s\n", profile.CachedAt.Format(time.RFC3339))
	fmt.Printf("  Expires at: %s\n", profile.ExpiresAt.Format(time.RFC3339))
	fmt.Printf("  Is expired: %v\n", time.Now().After(profile.ExpiresAt))
	fmt.Printf("\n")

	readRelays := profile.GetReadRelays()
	writeRelays := profile.GetWriteRelays()

	fmt.Printf("Read Relays (%d):\n", len(readRelays))
	if len(readRelays) == 0 {
		fmt.Printf("  (empty)\n")
	} else {
		for i, relay := range readRelays {
			fmt.Printf("  %d. %s\n", i+1, relay)
		}
	}
	fmt.Printf("\n")

	fmt.Printf("Write Relays (%d):\n", len(writeRelays))
	if len(writeRelays) == 0 {
		fmt.Printf("  (empty)\n")
	} else {
		for i, relay := range writeRelays {
			fmt.Printf("  %d. %s\n", i+1, relay)
		}
	}
	fmt.Printf("\n")

	fmt.Printf("Raw cache data:\n")
	fmt.Printf("  Read relays JSON: %s\n", profile.ReadRelays)
	fmt.Printf("  Write relays JSON: %s\n", profile.WriteRelays)
}

func validateRelayData(npub string, cacheInstance cache.Cache) {
	fmt.Printf("=== Relay Data Validation for %s ===\n\n", npub[:16]+"...")

	sqliteCache, ok := cacheInstance.(*cache.SQLiteCache)
	if !ok {
		fmt.Printf("Validation only available with SQLite cache\n")
		return
	}

	isValid, issues, err := sqliteCache.ValidateRelayData(npub)
	if err != nil {
		log.Fatalf("Validation failed: %v", err)
	}

	fmt.Printf("Validation Result: %v\n\n", isValid)
	if len(issues) == 0 {
		fmt.Printf("✅ No issues found\n")
	} else {
		fmt.Printf("❌ Issues found (%d):\n", len(issues))
		for i, issue := range issues {
			fmt.Printf("  %d. %s\n", i+1, issue)
		}
	}
}

func repairRelayData(npub string, cacheInstance cache.Cache) {
	fmt.Printf("=== Relay Data Repair for %s ===\n\n", npub[:16]+"...")

	sqliteCache, ok := cacheInstance.(*cache.SQLiteCache)
	if !ok {
		fmt.Printf("Repair only available with SQLite cache\n")
		return
	}

	// Validate first to show what we're fixing
	isValid, issues, err := sqliteCache.ValidateRelayData(npub)
	if err != nil {
		log.Fatalf("Validation failed: %v", err)
	}

	if isValid {
		fmt.Printf("✅ No repair needed - data is valid\n")
		return
	}

	fmt.Printf("Issues found that need repair:\n")
	for i, issue := range issues {
		fmt.Printf("  %d. %s\n", i+1, issue)
	}
	fmt.Printf("\n")

	fmt.Printf("Attempting repair...\n")
	err = sqliteCache.RepairRelayData(npub)
	if err != nil {
		log.Fatalf("Repair failed: %v", err)
	}

	fmt.Printf("✅ Repair completed\n")
	fmt.Printf("\nNote: Cached data was cleared to force fresh discovery from the network.\n")
	fmt.Printf("Use 'nospeak debug-relay %s refresh' to trigger rediscovery.\n", npub[:8]+"...")
}

func refreshRelayData(npub string, client *client.Client, debug bool) {
	fmt.Printf("=== Force Refresh Relay Data for %s ===\n\n", npub[:16]+"...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Connect to relays for discovery
	if err := client.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}

	fmt.Printf("Discovering fresh relay data from network...\n")
	readRelays, writeRelays, err := client.DiscoverUserRelays(ctx, npub, true) // Force debug
	if err != nil {
		log.Fatalf("Failed to discover relays: %v", err)
	}

	fmt.Printf("\nDiscovery Results:\n")
	fmt.Printf("  Read relays (%d): %v\n", len(readRelays), readRelays)
	fmt.Printf("  Write relays (%d): %v\n", len(writeRelays), writeRelays)
}

func traceRelayDiscovery(npub string, client *client.Client, debug bool) {
	fmt.Printf("=== NIP-65 Discovery Trace for %s ===\n\n", npub[:16]+"...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Connect to relays for discovery
	if err := client.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}

	// Enable debug mode for detailed tracing
	fmt.Printf("Tracing NIP-65 discovery with debug logging enabled...\n\n")

	fmt.Printf("Step 1: Checking cached data...\n")
	cacheInstance := cache.GetCache()
	if profile, found := cacheInstance.GetProfile(npub); found {
		fmt.Printf("✅ Found cached profile\n")
		fmt.Printf("  Cached at: %s\n", profile.CachedAt.Format(time.RFC3339))
		fmt.Printf("  Expires at: %s\n", profile.ExpiresAt.Format(time.RFC3339))
		fmt.Printf("  Read relays: %v\n", profile.GetReadRelays())
		fmt.Printf("  Write relays: %v\n", profile.GetWriteRelays())
		fmt.Printf("  Is expired: %v\n", time.Now().After(profile.ExpiresAt))
	} else {
		fmt.Printf("❌ No cached profile found\n")
	}

	fmt.Printf("\nStep 2: Performing network discovery...\n")
	readRelays, writeRelays, err := client.DiscoverUserRelays(ctx, npub, true)
	if err != nil {
		log.Fatalf("Network discovery failed: %v", err)
	}

	fmt.Printf("\nStep 3: Discovery completed\n")
	fmt.Printf("  Final read relays: %v\n", readRelays)
	fmt.Printf("  Final write relays: %v\n", writeRelays)
}

func showRelaySummary(npub string, cacheInstance cache.Cache) {
	fmt.Printf("=== Relay Summary for %s ===\n\n", npub[:16]+"...")

	profile, found := cacheInstance.GetProfile(npub)
	if !found {
		fmt.Printf("❌ No cached data found\n")
		fmt.Printf("Use 'nospeak debug-relay %s refresh' to fetch data\n", npub[:8]+"...")
		return
	}

	readRelays := profile.GetReadRelays()
	writeRelays := profile.GetWriteRelays()
	isExpired := time.Now().After(profile.ExpiresAt)

	fmt.Printf("Status: ")
	if isExpired {
		fmt.Printf("❌ EXPIRED (cache age: %s)\n", time.Since(profile.CachedAt).Round(time.Minute))
	} else {
		fmt.Printf("✅ Fresh (cache age: %s)\n", time.Since(profile.CachedAt).Round(time.Minute))
	}

	fmt.Printf("Read Relays: %d\n", len(readRelays))
	fmt.Printf("Write Relays: %d\n", len(writeRelays))

	// Show potential issues
	var issues []string
	if len(readRelays) == 0 && len(writeRelays) == 0 {
		issues = append(issues, "No relay data cached")
	}
	if len(readRelays) > 0 && len(writeRelays) == 0 {
		issues = append(issues, "No write relays")
	}
	if isExpired {
		issues = append(issues, "Data is expired")
	}

	if len(issues) > 0 {
		fmt.Printf("\n⚠️  Potential Issues:\n")
		for _, issue := range issues {
			fmt.Printf("  • %s\n", issue)
		}
		fmt.Printf("\nSuggested actions:\n")
		fmt.Printf("  • Run 'nospeak debug-relay %s refresh' to update data\n", npub[:8]+"...")
		fmt.Printf("  • Run 'nospeak debug-relay %s validate' to check for corruption\n", npub[:8]+"...")
	} else {
		fmt.Printf("\n✅ Relay data appears healthy\n")
	}
}

// Helper function to pretty print JSON for debugging
func prettyJSON(data interface{}) string {
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	return string(jsonBytes)
}