package client

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

// ConnectionType defines whether a relay connection is persistent or temporary
type ConnectionType int

const (
	PersistentConnection ConnectionType = iota
	TemporaryConnection
)

// RelayHealth tracks the health and connection status of a relay
type RelayHealth struct {
	URL              string
	Relay            *nostr.Relay
	IsConnected      bool
	LastConnected    time.Time
	LastAttempt      time.Time
	SuccessCount     int
	FailureCount     int
	ConsecutiveFails int
	Type             ConnectionType
	Mu               sync.RWMutex
}

// RetryConfig holds configuration for retry behavior
type RetryConfig struct {
	MaxRetries          int
	InitialBackoff      time.Duration
	MaxBackoff          time.Duration
	BackoffMultiplier   float64
	HealthCheckInterval time.Duration
	ConnectionTimeout   time.Duration
}

// DefaultRetryConfig returns sensible default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:          5,
		InitialBackoff:      1 * time.Second,
		MaxBackoff:          30 * time.Second,
		BackoffMultiplier:   2.0,
		HealthCheckInterval: 30 * time.Second,
		ConnectionTimeout:   10 * time.Second,
	}
}

// ConnectionManager manages relay connections with persistent retry logic
type ConnectionManager struct {
	client        *Client
	relays        map[string]*RelayHealth
	config        RetryConfig
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
	reconnectChan chan string
	shutdownChan  chan struct{}
	debug         bool
}

// NewConnectionManager creates a new connection manager
func NewConnectionManager(client *Client, config RetryConfig, debug bool) *ConnectionManager {
	ctx, cancel := context.WithCancel(context.Background())

	return &ConnectionManager{
		client:        client,
		relays:        make(map[string]*RelayHealth),
		config:        config,
		ctx:           ctx,
		cancel:        cancel,
		reconnectChan: make(chan string, 100),
		shutdownChan:  make(chan struct{}),
		debug:         debug,
	}
}

// Start initializes the connection manager and background processes
func (cm *ConnectionManager) Start() {
	go cm.healthCheckLoop()
	go cm.reconnectLoop()
	go cm.uiUpdateLoop()

	if cm.debug {
		log.Printf("Connection manager started with health check interval: %v", cm.config.HealthCheckInterval)
	}
}

// Stop gracefully shuts down the connection manager
func (cm *ConnectionManager) Stop() {
	cm.cancel()
	close(cm.shutdownChan)

	cm.mu.Lock()
	defer cm.mu.Unlock()

	for _, health := range cm.relays {
		if health.Relay != nil {
			health.Relay.Close()
		}
	}

	if cm.debug {
		log.Printf("Connection manager stopped")
	}
}

// AddRelay adds a relay to be managed with persistent connection attempts (deprecated: use AddPersistentRelay)
func (cm *ConnectionManager) AddRelay(relayURL string) {
	cm.AddPersistentRelay(relayURL)
}

// AddPersistentRelay adds a relay to be managed with persistent connection attempts
func (cm *ConnectionManager) AddPersistentRelay(relayURL string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, exists := cm.relays[relayURL]; !exists {
		health := &RelayHealth{
			URL:         relayURL,
			IsConnected: false,
			LastAttempt: time.Time{},
			Type:        PersistentConnection,
		}
		cm.relays[relayURL] = health

		// Trigger initial connection attempt
		select {
		case cm.reconnectChan <- relayURL:
			if cm.debug {
				log.Printf("Queued initial persistent connection request for: %s", relayURL)
			}
		default:
			if cm.debug {
				log.Printf("Reconnection channel full for: %s", relayURL)
			}
		}

		if cm.debug {
			log.Printf("Added persistent relay %s to connection manager", relayURL)
		}
	}
}

// AddTemporaryRelay adds a relay for temporary connection without persistent management
func (cm *ConnectionManager) AddTemporaryRelay(relayURL string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, exists := cm.relays[relayURL]; !exists {
		health := &RelayHealth{
			URL:         relayURL,
			IsConnected: false,
			LastAttempt: time.Time{},
			Type:        TemporaryConnection,
		}
		cm.relays[relayURL] = health

		// Trigger initial connection attempt
		select {
		case cm.reconnectChan <- relayURL:
			if cm.debug {
				log.Printf("Queued initial temporary connection request for: %s", relayURL)
			}
		default:
			if cm.debug {
				log.Printf("Reconnection channel full for: %s", relayURL)
			}
		}

		if cm.debug {
			log.Printf("Added temporary relay %s to connection manager", relayURL)
		}
	}
}

// RemoveRelay removes a relay from management, closing any active connection
func (cm *ConnectionManager) RemoveRelay(relayURL string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if health, exists := cm.relays[relayURL]; exists {
		health.Mu.Lock()
		// Close connection if active
		if health.Relay != nil {
			health.Relay.Close()
			health.Relay = nil
		}
		health.IsConnected = false
		health.Mu.Unlock()

		delete(cm.relays, relayURL)

		if cm.debug {
			log.Printf("Removed relay %s from connection manager", relayURL)
		}
	}
}

// CleanupTemporaryConnections removes all temporary connections
func (cm *ConnectionManager) CleanupTemporaryConnections() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	var toRemove []string
	for relayURL, health := range cm.relays {
		health.Mu.RLock()
		if health.Type == TemporaryConnection {
			toRemove = append(toRemove, relayURL)
		}
		health.Mu.RUnlock()
	}

	for _, relayURL := range toRemove {
		if health, exists := cm.relays[relayURL]; exists {
			health.Mu.Lock()
			// Close connection if active
			if health.Relay != nil {
				health.Relay.Close()
				health.Relay = nil
			}
			health.IsConnected = false
			health.Mu.Unlock()

			delete(cm.relays, relayURL)

			if cm.debug {
				log.Printf("Cleaned up temporary relay %s", relayURL)
			}
		}
	}

	if cm.debug && len(toRemove) > 0 {
		log.Printf("Cleaned up %d temporary connections", len(toRemove))
	}
}

// GetConnectedRelays returns all currently connected relays
func (cm *ConnectionManager) GetConnectedRelays() []*nostr.Relay {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var connected []*nostr.Relay
	for _, health := range cm.relays {
		health.Mu.RLock()
		if health.IsConnected && health.Relay != nil {
			connected = append(connected, health.Relay)
		}
		health.Mu.RUnlock()
	}

	return connected
}

// GetAllRelays returns all managed relays (connected and disconnected)
func (cm *ConnectionManager) GetAllRelays() []*nostr.Relay {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var all []*nostr.Relay
	for _, health := range cm.relays {
		health.Mu.RLock()
		if health.Relay != nil {
			all = append(all, health.Relay)
		}
		health.Mu.RUnlock()
	}

	return all
}

// GetAllManagedRelayURLs returns the URLs of all managed relays, regardless of connection status
func (cm *ConnectionManager) GetAllManagedRelayURLs() []string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var urls []string
	for url := range cm.relays {
		urls = append(urls, url)
	}

	return urls
}

// GetRelayHealth returns health information for a specific relay
func (cm *ConnectionManager) GetRelayHealth(relayURL string) *RelayHealth {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	if health, exists := cm.relays[relayURL]; exists {
		return health
	}

	return nil
}

// MarkRelayFailure marks a relay as having failed, updating health metrics
func (cm *ConnectionManager) MarkRelayFailure(relayURL string) {
	cm.mu.RLock()
	health, exists := cm.relays[relayURL]
	cm.mu.RUnlock()

	if !exists {
		return
	}

	health.Mu.Lock()
	defer health.Mu.Unlock()

	health.FailureCount++
	health.ConsecutiveFails++
	health.LastAttempt = time.Now()

	// If this relay has too many consecutive failures, trigger a reconnection attempt
	if health.ConsecutiveFails >= 3 {
		select {
		case cm.reconnectChan <- relayURL:
		default:
			// Channel full, will retry later
		}
	}

	if cm.debug {
		log.Printf("Marked failure for relay %s (consecutive failures: %d)", relayURL, health.ConsecutiveFails)
	}
}

// MarkRelaySuccess marks a relay as having succeeded, updating health metrics
func (cm *ConnectionManager) MarkRelaySuccess(relayURL string) {
	cm.mu.RLock()
	health, exists := cm.relays[relayURL]
	cm.mu.RUnlock()

	if !exists {
		return
	}

	health.Mu.Lock()
	defer health.Mu.Unlock()

	health.SuccessCount++
	health.ConsecutiveFails = 0
	health.LastConnected = time.Now()
	health.IsConnected = true

	if cm.debug {
		log.Printf("Marked success for relay %s (total successes: %d)", relayURL, health.SuccessCount)
	}
}

// connectRelay attempts to connect to a single relay
func (cm *ConnectionManager) connectRelay(relayURL string) error {
	if cm.debug {
		log.Printf("Attempting to connect to relay: %s", relayURL)
	}

	cm.mu.RLock()
	health, exists := cm.relays[relayURL]
	cm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("relay %s not managed", relayURL)
	}

	health.Mu.Lock()
	health.LastAttempt = time.Now()
	health.Mu.Unlock()

	// Create notice handler for authentication
	noticeHandler := func(notice string) {
		if cm.debug {
			log.Printf("NOTICE from %s: %s", relayURL, notice)
		}
	}

	// Connect with timeout
	ctx, cancel := context.WithTimeout(cm.ctx, cm.config.ConnectionTimeout)
	defer cancel()

	relay, err := nostr.RelayConnect(ctx, relayURL, nostr.WithNoticeHandler(noticeHandler))
	if err != nil {
		health.Mu.Lock()
		wasConnected := health.IsConnected
		health.IsConnected = false
		if health.Relay != nil {
			health.Relay.Close()
			health.Relay = nil
		}
		health.Mu.Unlock()

		if cm.debug {
			if wasConnected {
				log.Printf("Lost connection to relay: %s", relayURL)
			} else {
				log.Printf("Failed to connect to relay %s: %v", relayURL, err)
			}
		}

		return fmt.Errorf("failed to connect to relay %s: %w", relayURL, err)
	}

	// Attempt authentication if we have a secret key
	if err := cm.client.authenticateRelay(cm.ctx, relay, cm.debug); err != nil && cm.debug {
		log.Printf("Authentication setup failed for relay %s: %v", relayURL, err)
	}

	health.Mu.Lock()
	wasConnected := health.IsConnected
	health.Relay = relay
	health.IsConnected = true
	health.LastConnected = time.Now()
	health.ConsecutiveFails = 0
	health.Mu.Unlock()

	if cm.debug {
		if !wasConnected {
			log.Printf("Successfully connected to relay: %s", relayURL)
		} else {
			log.Printf("Successfully reconnected to relay: %s", relayURL)
		}
	}

	return nil
}

// healthCheckLoop periodically checks the health of all managed relays
func (cm *ConnectionManager) healthCheckLoop() {
	ticker := time.NewTicker(cm.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-cm.ctx.Done():
			return
		case <-ticker.C:
			cm.checkAllRelayHealth()
		case <-cm.shutdownChan:
			return
		}
	}
}

// checkAllRelayHealth checks the health of all managed relays
func (cm *ConnectionManager) checkAllRelayHealth() {
	cm.mu.RLock()
	relayURLs := make([]string, 0, len(cm.relays))
	for url := range cm.relays {
		relayURLs = append(relayURLs, url)
	}
	cm.mu.RUnlock()

	for _, relayURL := range relayURLs {
		cm.checkRelayHealth(relayURL)
	}
}

// checkRelayHealth checks the health of a single relay
func (cm *ConnectionManager) checkRelayHealth(relayURL string) {
	health := cm.GetRelayHealth(relayURL)
	if health == nil {
		return
	}

	health.Mu.RLock()
	isConnected := health.IsConnected
	lastConnected := health.LastConnected
	consecutiveFails := health.ConsecutiveFails
	health.Mu.RUnlock()

	// If relay is not connected or hasn't been connected recently, try to reconnect
	if !isConnected || time.Since(lastConnected) > cm.config.HealthCheckInterval*2 {
		// Don't overwhelm relays that are failing repeatedly
		if consecutiveFails < 5 || consecutiveFails%5 == 0 {
			select {
			case cm.reconnectChan <- relayURL:
			default:
				// Channel full, will retry later
			}
		}
	}
}

// reconnectLoop processes reconnection requests
func (cm *ConnectionManager) reconnectLoop() {
	if cm.debug {
		log.Printf("Reconnection loop started")
	}
	for {
		select {
		case <-cm.ctx.Done():
			if cm.debug {
				log.Printf("Reconnection loop stopping: context cancelled")
			}
			return
		case relayURL := <-cm.reconnectChan:
			if cm.debug {
				log.Printf("Received reconnection request for: %s", relayURL)
			}
			// Handle connection in a separate goroutine to avoid blocking the loop
			go cm.handleReconnection(relayURL)
		case <-cm.shutdownChan:
			if cm.debug {
				log.Printf("Reconnection loop stopping: shutdown signal")
			}
			return
		}
	}
}

// handleReconnection handles reconnection for a single relay with exponential backoff
func (cm *ConnectionManager) handleReconnection(relayURL string) {
	health := cm.GetRelayHealth(relayURL)
	if health == nil {
		if cm.debug {
			log.Printf("Relay health not found for: %s", relayURL)
		}
		return
	}

	health.Mu.RLock()
	consecutiveFails := health.ConsecutiveFails
	lastAttempt := health.LastAttempt
	connectionType := health.Type
	health.Mu.RUnlock()

	// Only handle reconnections for persistent connections
	if connectionType == TemporaryConnection {
		if cm.debug {
			log.Printf("Skipping reconnection for temporary relay: %s", relayURL)
		}
		return
	}

	// Calculate backoff delay based on consecutive failures
	backoffDelay := cm.calculateBackoff(consecutiveFails)

	// Wait if we tried too recently
	if time.Since(lastAttempt) < backoffDelay {
		time.Sleep(backoffDelay - time.Since(lastAttempt))
	}

	if err := cm.connectRelay(relayURL); err != nil {
		if cm.debug {
			log.Printf("Reconnection failed for %s: %v", relayURL, err)
		}
		cm.MarkRelayFailure(relayURL)
	} else {
		cm.MarkRelaySuccess(relayURL)
	}
}

// uiUpdateLoop periodically updates the client's relay list for UI sync
func (cm *ConnectionManager) uiUpdateLoop() {
	ticker := time.NewTicker(500 * time.Millisecond) // Update every 500ms for more responsive UI
	defer ticker.Stop()

	for {
		select {
		case <-cm.ctx.Done():
			return
		case <-cm.shutdownChan:
			return
		case <-ticker.C:
			// Safely update client's relay list
			cm.client.UpdateRelayList()
		}
	}
}

// calculateBackoff calculates exponential backoff delay
func (cm *ConnectionManager) calculateBackoff(consecutiveFails int) time.Duration {
	if consecutiveFails <= 1 {
		return cm.config.InitialBackoff
	}

	exponential := uint(1) << (consecutiveFails - 2)
	delay := time.Duration(float64(cm.config.InitialBackoff) *
		float64(exponential) * cm.config.BackoffMultiplier)

	if delay > cm.config.MaxBackoff {
		delay = cm.config.MaxBackoff
	}

	return delay
}
