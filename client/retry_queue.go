package client

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

// RetryablePublish represents a publish operation that can be retried
type RetryablePublish struct {
	Event       nostr.Event
	TargetRelay string
	Attempt     int
	MaxAttempts int
	NextAttempt time.Time
	CreatedAt   time.Time
}

// PublishResult tracks the result of publishing to a specific relay
type PublishResult struct {
	RelayURL string
	Success  bool
	Error    error
	Attempt  int
}

// RetryQueue manages retry operations for failed publishes
type RetryQueue struct {
	client       *Client
	connManager  *ConnectionManager
	queue        chan *RetryablePublish
	results      chan PublishResult
	config       RetryConfig
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
	shutdownChan chan struct{}
	debug        bool
}

// NewRetryQueue creates a new retry queue
func NewRetryQueue(client *Client, connManager *ConnectionManager, config RetryConfig, debug bool) *RetryQueue {
	ctx, cancel := context.WithCancel(context.Background())

	return &RetryQueue{
		client:       client,
		connManager:  connManager,
		queue:        make(chan *RetryablePublish, 1000),
		results:      make(chan PublishResult, 1000),
		config:       config,
		ctx:          ctx,
		cancel:       cancel,
		shutdownChan: make(chan struct{}),
		debug:        debug,
	}
}

// Start begins processing the retry queue
func (rq *RetryQueue) Start() {
	go rq.processQueue()
	go rq.processResults()

	if rq.debug {
		log.Printf("Retry queue started with max retries: %d", rq.config.MaxRetries)
	}
}

// Stop gracefully shuts down the retry queue
func (rq *RetryQueue) Stop() {
	rq.cancel()
	close(rq.shutdownChan)

	if rq.debug {
		log.Printf("Retry queue stopped")
	}
}

// EnqueueRetry adds a publish operation to the retry queue
func (rq *RetryQueue) EnqueueRetry(event nostr.Event, relayURL string, attempt int) {
	if attempt >= rq.config.MaxRetries {
		if rq.debug {
			log.Printf("Max retries exceeded for event %s to relay %s", event.ID, relayURL)
		}
		return
	}

	nextAttempt := time.Now().Add(rq.calculateBackoff(attempt))

	retry := &RetryablePublish{
		Event:       event,
		TargetRelay: relayURL,
		Attempt:     attempt + 1,
		MaxAttempts: rq.config.MaxRetries,
		NextAttempt: nextAttempt,
		CreatedAt:   time.Now(),
	}

	select {
	case rq.queue <- retry:
		if rq.debug {
			log.Printf("Enqueued retry for event %s to relay %s (attempt %d/%d)",
				event.ID, relayURL, retry.Attempt, retry.MaxAttempts)
		}
	default:
		if rq.debug {
			log.Printf("Retry queue full, dropping retry for event %s to relay %s", event.ID, relayURL)
		}
	}
}

// PublishWithRetry publishes an event with automatic retry logic
func (rq *RetryQueue) PublishWithRetry(ctx context.Context, event nostr.Event, relayURL string) error {
	// Try immediate publish first
	if err := rq.publishToRelay(ctx, event, relayURL); err == nil {
		rq.connManager.MarkRelaySuccess(relayURL)
		rq.results <- PublishResult{
			RelayURL: relayURL,
			Success:  true,
			Attempt:  1,
		}
		return nil
	} else {
		rq.connManager.MarkRelayFailure(relayURL)
		rq.results <- PublishResult{
			RelayURL: relayURL,
			Success:  false,
			Error:    err,
			Attempt:  1,
		}

		// Enqueue for retry
		rq.EnqueueRetry(event, relayURL, 1)
		return err
	}
}

// PublishToAllRelays publishes to all managed relays with retry logic
func (rq *RetryQueue) PublishToAllRelays(ctx context.Context, event nostr.Event) []PublishResult {
	var results []PublishResult
	var wg sync.WaitGroup
	resultsChan := make(chan PublishResult, 100)

	// Get all managed relays (both connected and disconnected)
	allRelayURLs := rq.connManager.GetAllManagedRelayURLs()

	// Publish to all relays concurrently
	for _, relayURL := range allRelayURLs {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			if err := rq.publishToRelay(ctx, event, url); err == nil {
				rq.connManager.MarkRelaySuccess(url)
				resultsChan <- PublishResult{
					RelayURL: url,
					Success:  true,
					Attempt:  1,
				}
			} else {
				rq.connManager.MarkRelayFailure(url)
				resultsChan <- PublishResult{
					RelayURL: url,
					Success:  false,
					Error:    err,
					Attempt:  1,
				}

				// Enqueue for retry
				rq.EnqueueRetry(event, url, 1)
			}
		}(relayURL)
	}

	// Wait for all publishes to complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	for result := range resultsChan {
		results = append(results, result)
	}

	return results
}

// processQueue processes retry attempts
func (rq *RetryQueue) processQueue() {
	for {
		select {
		case <-rq.ctx.Done():
			return
		case <-rq.shutdownChan:
			return
		case retry := <-rq.queue:
			rq.processRetry(retry)
		}
	}
}

// processRetry processes a single retry attempt
func (rq *RetryQueue) processRetry(retry *RetryablePublish) {
	// Wait until it's time to retry
	now := time.Now()
	if retry.NextAttempt.After(now) {
		select {
		case <-time.After(retry.NextAttempt.Sub(now)):
		case <-rq.ctx.Done():
			return
		case <-rq.shutdownChan:
			return
		}
	}

	// Attempt to publish
	if err := rq.publishToRelay(rq.ctx, retry.Event, retry.TargetRelay); err == nil {
		rq.connManager.MarkRelaySuccess(retry.TargetRelay)
		rq.results <- PublishResult{
			RelayURL: retry.TargetRelay,
			Success:  true,
			Attempt:  retry.Attempt,
		}

		if rq.debug {
			log.Printf("Retry successful for event %s to relay %s (attempt %d)",
				retry.Event.ID, retry.TargetRelay, retry.Attempt)
		}
	} else {
		rq.connManager.MarkRelayFailure(retry.TargetRelay)
		rq.results <- PublishResult{
			RelayURL: retry.TargetRelay,
			Success:  false,
			Error:    err,
			Attempt:  retry.Attempt,
		}

		if rq.debug {
			log.Printf("Retry failed for event %s to relay %s (attempt %d): %v",
				retry.Event.ID, retry.TargetRelay, retry.Attempt, err)
		}

		// Enqueue another retry if we haven't reached max attempts
		if retry.Attempt < retry.MaxAttempts {
			rq.EnqueueRetry(retry.Event, retry.TargetRelay, retry.Attempt)
		}
	}
}

// processResults processes publish results
func (rq *RetryQueue) processResults() {
	for {
		select {
		case <-rq.ctx.Done():
			return
		case <-rq.shutdownChan:
			return
		case result := <-rq.results:
			rq.handleResult(result)
		}
	}
}

// handleResult handles a publish result
func (rq *RetryQueue) handleResult(result PublishResult) {
	if rq.debug {
		if result.Success {
			log.Printf("Publish successful to relay %s (attempt %d)", result.RelayURL, result.Attempt)
		} else {
			log.Printf("Publish failed to relay %s (attempt %d): %v", result.RelayURL, result.Attempt, result.Error)
		}
	}
}

// publishToRelay publishes an event to a specific relay with authentication handling
func (rq *RetryQueue) publishToRelay(ctx context.Context, event nostr.Event, relayURL string) error {
	health := rq.connManager.GetRelayHealth(relayURL)
	if health == nil {
		return fmt.Errorf("relay %s not managed by connection manager", relayURL)
	}

	health.Mu.RLock()
	relay := health.Relay
	health.Mu.RUnlock()

	if relay == nil {
		return fmt.Errorf("relay %s not connected", relayURL)
	}

	if err := relay.Publish(ctx, event); err != nil {
		// Check if this is an authentication error and try to authenticate
		if rq.client.isAuthError(err) && rq.client.secretKey != "" {
			if rq.debug {
				log.Printf("Publish failed with possible auth error for relay %s, attempting authentication", relayURL)
			}

			if authErr := rq.client.attemptAuthentication(ctx, relay, rq.debug); authErr == nil {
				// Retry publishing after successful authentication
				if retryErr := relay.Publish(ctx, event); retryErr != nil {
					return retryErr
				}
				return nil
			}
		}

		return err
	}

	return nil
}

// calculateBackoff calculates exponential backoff delay for retries
func (rq *RetryQueue) calculateBackoff(attempt int) time.Duration {
	if attempt <= 0 {
		return rq.config.InitialBackoff
	}

	delay := time.Duration(float64(rq.config.InitialBackoff) *
		float64(uint(1)<<(attempt-1)) * rq.config.BackoffMultiplier)

	if delay > rq.config.MaxBackoff {
		delay = rq.config.MaxBackoff
	}

	return delay
}

// GetStats returns retry queue statistics
func (rq *RetryQueue) GetStats() map[string]interface{} {
	rq.mu.RLock()
	defer rq.mu.RUnlock()

	return map[string]interface{}{
		"queue_length":    len(rq.queue),
		"max_retries":     rq.config.MaxRetries,
		"backoff_initial": rq.config.InitialBackoff.String(),
		"backoff_max":     rq.config.MaxBackoff.String(),
	}
}
