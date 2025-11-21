package client

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/config"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

// DiscoveryRelays contains predefined relays for NIP-65 discovery
type DiscoveryRelays struct {
	Relays []string
}

// GetDiscoveryRelays returns the predefined discovery relays
func GetDiscoveryRelays() DiscoveryRelays {
	return DiscoveryRelays{
		Relays: []string{
			"wss://purplepag.es",
			"wss://nostr.data.haus",
			"wss://nos.lol",
			"wss://relay.damus.io",
		},
	}
}

type Client struct {
	config             *config.Config
	relays             []*nostr.Relay
	secretKey          string
	publicKey          string
	mu                 sync.RWMutex
	connectionManager  *ConnectionManager
	retryQueue         *RetryQueue
	refreshingRelays   map[string]bool
	refreshingRelaysMu sync.Mutex
}

func NewClient(cfg *config.Config) (*Client, error) {
	_, sk, err := nip19.Decode(cfg.Nsec)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nsec: %w", err)
	}

	_, pk, err := nip19.Decode(cfg.Npub)
	if err != nil {
		return nil, fmt.Errorf("failed to decode npub: %w", err)
	}

	secretKey := sk.(string)
	publicKey := pk.(string)

	// Initialize cache
	cacheType := cfg.Cache
	if cacheType == "" {
		cacheType = "sqlite" // default
	}
	if err := cache.InitializeCache(cacheType); err != nil {
		return nil, fmt.Errorf("failed to initialize cache: %w", err)
	}

	client := &Client{
		config:           cfg,
		relays:           make([]*nostr.Relay, 0),
		secretKey:        secretKey,
		publicKey:        publicKey,
		refreshingRelays: make(map[string]bool),
	}

	// Initialize connection manager and retry queue
	retryConfig := DefaultRetryConfig()
	client.connectionManager = NewConnectionManager(client, retryConfig, false) // debug will be set later
	client.retryQueue = NewRetryQueue(client, client.connectionManager, retryConfig, false)

	return client, nil
}

// CreateClient is a helper function that consolidates configuration loading and client creation
func CreateClient(configPath string, debug bool) (*Client, context.Context, *config.Config, error) {
	// Use default config path if none provided
	if configPath == "" {
		configPath = config.GetConfigPath()
	}

	// Load configuration
	cfg, err := config.LoadWithPath(configPath)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to load config: %w", err)
	}

	// Create client
	client, err := NewClient(cfg)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to create client: %w", err)
	}

	// Create context
	ctx := context.Background()

	return client, ctx, cfg, nil
}

func (c *Client) Connect(ctx context.Context, debug bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update debug mode for connection manager and retry queue
	c.connectionManager.debug = debug
	c.retryQueue.debug = debug

	// Use discovery relays (no more configured relays)
	discoveryRelays := GetDiscoveryRelays()
	relayURLs := discoveryRelays.Relays

	// Add relays to the connection manager
	for _, relayURL := range relayURLs {
		c.connectionManager.AddRelay(relayURL)
	}

	// Start the connection manager and retry queue
	c.connectionManager.Start()
	c.retryQueue.Start()

	// Update the relays slice with currently connected relays (may be empty initially)
	c.relays = c.connectionManager.GetConnectedRelays()

	if debug {
		log.Printf("Connection manager started with %d discovery relays", len(relayURLs))
		log.Printf("Initially connected to %d relays, background reconnection will continue", len(c.relays))
	}

	// Bootstrap user relays in background
	go c.bootstrapUserRelays(relayURLs, debug)

	return nil
}

func (c *Client) bootstrapUserRelays(discoveryRelays []string, debug bool) {
	// Use a detached context for background operation
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if debug {
		log.Printf("Starting relay bootstrapping...")
	}

	// Wait for connections to discovery relays
	// We need at least 1 connection to query
	if err := c.WaitForConnections(ctx, 1, 10*time.Second, debug); err != nil {
		if debug {
			log.Printf("Bootstrapping skipped: failed to connect to discovery relays: %v", err)
		}
		return
	}

	// Encode public key to npub
	npub, err := nip19.EncodePublicKey(c.publicKey)
	if err != nil {
		if debug {
			log.Printf("Bootstrapping failed: invalid public key: %v", err)
		}
		return
	}

	// Fetch user relays
	// fetching relays uses QueryEvents which uses connected relays (currently discovery relays)
	readRelays, _, err := c.fetchUserRelaysFromNetwork(ctx, npub, debug)
	if err != nil {
		if debug {
			log.Printf("Bootstrapping failed to fetch user relays: %v. Keeping discovery relays.", err)
		}
		return
	}

	if len(readRelays) == 0 {
		if debug {
			log.Printf("Bootstrapping found no read relays. Keeping discovery relays.")
		}
		return
	}

	if debug {
		log.Printf("Bootstrapping found %d user read relays. Switching active set...", len(readRelays))
	}

	// Update connection manager
	// 1. Add new relays
	for _, url := range readRelays {
		c.connectionManager.AddRelay(url)
	}

	// 2. Identify relays to remove (discovery relays NOT in user list)
	userRelaysMap := make(map[string]bool)
	for _, url := range readRelays {
		userRelaysMap[url] = true
	}

	for _, url := range discoveryRelays {
		if !userRelaysMap[url] {
			c.connectionManager.RemoveRelay(url)
		}
	}

	// Update client relay list
	c.UpdateRelayList()

	if debug {
		log.Printf("Bootstrapping complete. Active relays updated.")
	}
}

// WaitForConnections waits for at least one relay connection before proceeding
// This is useful for CLI operations that need immediate connectivity
func (c *Client) WaitForConnections(ctx context.Context, minConnections int, timeout time.Duration, debug bool) error {
	if debug {
		log.Printf("Waiting for at least %d relay connections (timeout: %v)", minConnections, timeout)
	}

	deadline := time.After(timeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-deadline:
			connectedCount := len(c.connectionManager.GetConnectedRelays())
			return fmt.Errorf("timeout waiting for connections: got %d, need %d", connectedCount, minConnections)
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			connectedCount := len(c.connectionManager.GetConnectedRelays())
			if connectedCount >= minConnections {
				if debug {
					log.Printf("Successfully connected to %d relays", connectedCount)
				}
				// Update the client's relay slice with the connected relays
				c.UpdateRelayList()
				return nil
			}
			if debug {
				log.Printf("Waiting for connections: currently %d connected, need %d", connectedCount, minConnections)
			}
		}
	}
}

func (c *Client) authenticateRelay(ctx context.Context, relay *nostr.Relay, debug bool) error {
	// Only attempt authentication if we have a secret key
	if c.secretKey == "" {
		if debug {
			log.Printf("No secret key available for authentication")
		}
		return nil // Not an error, just no auth possible
	}

	if debug {
		log.Printf("Authentication available for relay: %s (will authenticate when required)", relay.URL)
	}

	// For now, we don't authenticate immediately.
	// Authentication will be attempted when needed (e.g., when publishing fails with auth error)
	return nil
}

func (c *Client) isAuthError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "auth") ||
		strings.Contains(errMsg, "authentication") ||
		strings.Contains(errMsg, "restricted") ||
		strings.Contains(errMsg, "unauthorized")
}

func (c *Client) attemptAuthentication(ctx context.Context, relay *nostr.Relay, debug bool) error {
	if c.secretKey == "" {
		return fmt.Errorf("no secret key available for authentication")
	}

	if debug {
		log.Printf("Attempting authentication for relay: %s", relay.URL)
	}

	err := relay.Auth(ctx, func(event *nostr.Event) error {
		event.PubKey = c.publicKey
		event.CreatedAt = nostr.Now()
		event.Kind = nostr.KindClientAuthentication
		event.Content = ""
		return event.Sign(c.secretKey)
	})

	if err != nil {
		if debug {
			log.Printf("Authentication failed for relay %s: %v", relay.URL, err)
		}
		return err
	}

	if debug {
		log.Printf("Successfully authenticated to relay: %s", relay.URL)
	}

	return nil
}

func (c *Client) Disconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Stop connection manager and retry queue
	if c.connectionManager != nil {
		c.connectionManager.Stop()
	}
	if c.retryQueue != nil {
		c.retryQueue.Stop()
	}

	// Close any remaining direct connections
	for _, relay := range c.relays {
		relay.Close()
	}
	c.relays = c.relays[:0]
}

func (c *Client) PublishEvent(ctx context.Context, event nostr.Event, debug bool) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if debug {
		fmt.Printf("=== DEBUG: Publishing Event to All Relays ===\n")
		fmt.Printf("Event ID: %s\n", event.ID)
		fmt.Printf("Event Kind: %d\n", event.Kind)
		fmt.Printf("Event Content Length: %d\n", len(event.Content))
		fmt.Printf("========================================\n\n")
	}

	// Use the retry queue to publish to all managed relays
	results := c.retryQueue.PublishToAllRelays(ctx, event)

	var successCount int
	var failureCount int
	var lastErr error

	for _, result := range results {
		if result.Success {
			successCount++
			if debug {
				fmt.Printf("SUCCESS: Published to %s (attempt %d)\n", result.RelayURL, result.Attempt)
			}
		} else {
			failureCount++
			lastErr = result.Error
			if debug {
				fmt.Printf("PENDING: Failed to publish to %s (attempt %d) - queued for retry: %v\n",
					result.RelayURL, result.Attempt, result.Error)
			}
		}
	}

	if debug {
		fmt.Printf("\n=== Publish Summary ===\n")
		fmt.Printf("Successful: %d\n", successCount)
		fmt.Printf("Pending retry: %d\n", failureCount)
		fmt.Printf("======================\n\n")
	}

	// Don't return error if at least one publish succeeded or is queued for retry
	if successCount > 0 || failureCount > 0 {
		return nil
	}

	return lastErr
}

func (c *Client) Subscribe(ctx context.Context, filters nostr.Filters, handler func(nostr.Event)) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Get only currently connected relays for subscriptions
	connectedRelays := c.connectionManager.GetConnectedRelays()

	// Debug logging for subscription targets
	if debug := os.Getenv("DEBUG"); debug != "" {
		relayURLs := make([]string, len(connectedRelays))
		for i, relay := range connectedRelays {
			relayURLs[i] = relay.URL
		}
		log.Printf("[SUBSCRIPTION-DEBUG] Subscribing to %d connected relays: %v", len(connectedRelays), relayURLs)
	}

	// Handle case where no relays are connected yet - this is normal during startup
	if len(connectedRelays) == 0 {
		if debug := os.Getenv("DEBUG"); debug != "" {
			log.Printf("[SUBSCRIPTION-DEBUG] No connected relays available, starting background relay wait")
		}
		// Start a background goroutine that will establish subscriptions when relays connect
		go func() {
			ticker := time.NewTicker(1 * time.Second)
			defer ticker.Stop()

			if debug := os.Getenv("DEBUG"); debug != "" {
				log.Printf("[SUBSCRIPTION-DEBUG] Background relay monitor started")
			}

			for {
				select {
				case <-ctx.Done():
					if debug := os.Getenv("DEBUG"); debug != "" {
						log.Printf("[SUBSCRIPTION-DEBUG] Background relay monitor stopped")
					}
					return
				case <-ticker.C:
					currentRelays := c.connectionManager.GetConnectedRelays()
					if len(currentRelays) > 0 {
						if debug := os.Getenv("DEBUG"); debug != "" {
							relayURLs := make([]string, len(currentRelays))
							for i, relay := range currentRelays {
								relayURLs[i] = relay.URL
							}
							log.Printf("[SUBSCRIPTION-DEBUG] Background relay monitor found %d relays: %v", len(currentRelays), relayURLs)
						}
						// Try to establish subscriptions now that we have connected relays
						c.establishSubscriptions(ctx, currentRelays, filters, handler)
						return
					}
				}
			}
		}()
		return nil // Don't fail, subscription will be established when relays connect
	}

	return c.establishSubscriptions(ctx, connectedRelays, filters, handler)
}

// establishSubscriptions creates subscriptions on the provided relays
func (c *Client) establishSubscriptions(ctx context.Context, relays []*nostr.Relay, filters nostr.Filters, handler func(nostr.Event)) error {
	var wg sync.WaitGroup
	errChan := make(chan error, len(relays))

	// Channel to collect events from all relays
	eventsChan := make(chan nostr.Event, 100)

	// Map to track processed events by ID
	processedEvents := make(map[string]bool)
	var processedMu sync.RWMutex

	for _, relay := range relays {
		wg.Add(1)
		go func(r *nostr.Relay) {
			defer wg.Done()

			sub, err := r.Subscribe(ctx, filters)
			if err != nil {
				errChan <- fmt.Errorf("failed to subscribe to relay %s: %w", r.URL, err)
				return
			}

			for event := range sub.Events {
				eventsChan <- *event
			}
		}(relay)
	}

	// Single goroutine to handle deduplication and call handler
	go func() {
		for event := range eventsChan {
			processedMu.RLock()
			if processed := processedEvents[event.ID]; processed {
				processedMu.RUnlock()
				continue
			}
			processedMu.RUnlock()

			processedMu.Lock()
			processedEvents[event.ID] = true
			processedMu.Unlock()

			handler(event)
		}
	}()

	go func() {
		wg.Wait()
		close(eventsChan)
		close(errChan)
	}()

	// Only return error if ALL subscriptions fail
	var errors []error
	for i := 0; i < len(relays); i++ {
		select {
		case err := <-errChan:
			if err != nil {
				errors = append(errors, err)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	// If we have some successful subscriptions, don't return an error
	if len(errors) < len(relays) {
		return nil
	}

	// If all subscriptions failed, return the first error
	if len(errors) > 0 {
		return errors[0]
	}

	return nil
}

func (c *Client) GetSecretKey() string {
	return c.secretKey
}

func (c *Client) GetPublicKey() string {
	return c.publicKey
}

func (c *Client) GetRelayCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.relays)
}

// UpdateRelayList updates the client's relay list from the connection manager
func (c *Client) UpdateRelayList() {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update the relays slice with currently connected relays from connection manager
	if c.connectionManager != nil {
		c.relays = c.connectionManager.GetConnectedRelays()
	}
}

// GetTotalManagedRelays returns the total number of relays being managed (connected + disconnected)
func (c *Client) GetTotalManagedRelays() int {
	if c.connectionManager != nil {
		return len(c.connectionManager.GetAllManagedRelayURLs())
	}
	return 0
}

func (c *Client) QueryEvents(ctx context.Context, filters nostr.Filters, debug bool) ([]nostr.Event, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Get only currently connected relays for querying
	connectedRelays := c.connectionManager.GetConnectedRelays()

	var wg sync.WaitGroup
	eventsChan := make(chan []nostr.Event, len(connectedRelays))
	errChan := make(chan error, len(connectedRelays))

	for _, relay := range connectedRelays {
		wg.Add(1)
		go func(r *nostr.Relay) {
			defer wg.Done()

			sub, err := r.Subscribe(ctx, filters)
			if err != nil {
				errChan <- fmt.Errorf("failed to subscribe to relay %s: %w", r.URL, err)
				return
			}

			var events []nostr.Event
			timeout := time.After(5 * time.Second)

			for {
				select {
				case event, ok := <-sub.Events:
					if !ok {
						goto done
					}
					events = append(events, *event)
				case <-timeout:
					goto done
				case <-ctx.Done():
					goto done
				}
			}

		done:
			eventsChan <- events
		}(relay)
	}

	go func() {
		wg.Wait()
		close(eventsChan)
		close(errChan)
	}()

	var allEvents []nostr.Event
	var errors []error

	// Collect results
	for i := 0; i < len(connectedRelays); i++ {
		select {
		case events := <-eventsChan:
			allEvents = append(allEvents, events...)
		case err := <-errChan:
			errors = append(errors, err)
		case <-ctx.Done():
			return allEvents, ctx.Err()
		}
	}

	// Return events even if some relays failed
	if len(errors) > 0 && debug {
		log.Printf("Some relays failed during query: %v", errors)
	}

	return allEvents, nil
}

func (c *Client) GetPartnerDisplayNames(ctx context.Context, debug bool) (map[string]string, error) {
	displayNames := make(map[string]string)

	for _, npub := range c.config.Partners {
		displayName := c.ResolveUsernameWithFallback(ctx, npub, debug)
		displayNames[npub] = displayName
	}

	return displayNames, nil
}

// ConnectToContactRelays ensures we are connected to relays for all partners
func (c *Client) ConnectToContactRelays(ctx context.Context, debug bool) error {
	// Check if we need discovery relays (if any partner is missing from cache)
	needDiscovery := false
	for _, partner := range c.config.Partners {
		_, _, found := c.GetCachedUserRelays(partner, debug)
		if !found {
			needDiscovery = true
			break
		}
	}

	// If we need discovery, ensure discovery relays are connected
	if needDiscovery {
		if debug {
			log.Printf("Missing cached relays for some partners, enabling discovery relays")
		}
		discovery := GetDiscoveryRelays()
		c.AddMailboxRelays(discovery.Relays)
		// Wait for connections to ensure query capability
		_ = c.WaitForConnections(ctx, 1, 5*time.Second, debug)
	}

	// Iterate partners and connect to their relays
	relaysAdded := false
	for _, partner := range c.config.Partners {
		// 1. Try cache
		readRelays, _, found := c.GetCachedUserRelays(partner, debug)

		if !found {
			// 2. No cache - discover from network
			var err error
			// DiscoverUserRelays uses connected relays (now including discovery relays)
			readRelays, _, err = c.DiscoverUserRelays(ctx, partner, debug)
			if err != nil {
				if debug {
					log.Printf("Failed to discover relays for %s: %v", partner, err)
				}
				continue
			}
		}

		// Connect to the contact's relays
		if len(readRelays) > 0 {
			c.AddMailboxRelays(readRelays)
			relaysAdded = true
		}
	}

	if relaysAdded {
		// Give connection manager a moment to establish connections to the newly added relays
		// This significantly improves success rate for subsequent operations
		_ = c.WaitForConnections(ctx, 1, 2*time.Second, debug)
	}

	return nil
}

func (c *Client) GetPartnerProfiles(ctx context.Context, debug bool) (map[string]cache.ProfileMetadata, error) {
	profiles := make(map[string]cache.ProfileMetadata)

	for _, npub := range c.config.Partners {
		profile, err := c.ResolveProfile(ctx, npub, debug)
		if err != nil {
			if debug {
				log.Printf("Failed to resolve profile for %s: %v", npub, err)
			}
			// Create empty profile for fallback
			profiles[npub] = cache.ProfileMetadata{}
		} else {
			profiles[npub] = profile
		}
	}

	return profiles, nil
}

// AddMailboxRelays adds mailbox relays to the connection manager
func (c *Client) AddMailboxRelays(relayURLs []string) {
	if debug := os.Getenv("DEBUG"); debug != "" {
		log.Printf("[MAILBOX-RELAY-DEBUG] Adding %d mailbox relays: %v", len(relayURLs), relayURLs)
	}
	for _, relayURL := range relayURLs {
		// Add all discovered relays (no more config filtering)
		c.connectionManager.AddRelay(relayURL)
	}
}

// GetConnectionStats returns statistics about relay connections
func (c *Client) GetConnectionStats() map[string]interface{} {
	stats := make(map[string]interface{})

	// Get connection manager stats
	connectedRelays := c.connectionManager.GetConnectedRelays()
	allRelays := c.connectionManager.GetAllRelays()

	stats["connected_relays"] = len(connectedRelays)
	stats["total_managed_relays"] = len(allRelays)

	// Get retry queue stats
	retryStats := c.retryQueue.GetStats()
	for k, v := range retryStats {
		stats["retry_queue_"+k] = v
	}

	// Per-relay health information
	relayHealth := make(map[string]interface{})
	for _, relay := range allRelays {
		health := c.connectionManager.GetRelayHealth(relay.URL)
		if health != nil {
			health.Mu.RLock()
			relayHealth[relay.URL] = map[string]interface{}{
				"connected":         health.IsConnected,
				"success_count":     health.SuccessCount,
				"failure_count":     health.FailureCount,
				"consecutive_fails": health.ConsecutiveFails,
				"last_connected":    health.LastConnected,
				"last_attempt":      health.LastAttempt,
			}
			health.Mu.RUnlock()
		}
	}
	stats["relay_health"] = relayHealth

	return stats
}
