package client

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/config"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

type Client struct {
	config    *config.Config
	relays    []*nostr.Relay
	secretKey string
	publicKey string
	mu        sync.RWMutex
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

	return &Client{
		config:    cfg,
		relays:    make([]*nostr.Relay, 0),
		secretKey: secretKey,
		publicKey: publicKey,
	}, nil
}

func (c *Client) Connect(ctx context.Context, debug bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, relayURL := range c.config.Relays {
		relay, err := nostr.RelayConnect(ctx, relayURL)
		if err != nil {
			if debug {
				log.Printf("Failed to connect to relay %s: %v", relayURL, err)
			}
			continue
		}
		c.relays = append(c.relays, relay)
		if debug {
			log.Printf("Connected to relay: %s", relayURL)
		}
	}

	if len(c.relays) == 0 {
		return fmt.Errorf("failed to connect to any relays")
	}

	return nil
}

func (c *Client) Disconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, relay := range c.relays {
		relay.Close()
	}
	c.relays = c.relays[:0]
}

func (c *Client) PublishEvent(ctx context.Context, event nostr.Event, debug bool) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var lastErr error
	for _, relay := range c.relays {
		if debug {
			fmt.Printf("=== DEBUG: Publishing to Relay ===\n")
			fmt.Printf("Relay URL: %s\n", relay.URL)
			fmt.Printf("Event ID: %s\n", event.ID)
			fmt.Printf("Event Kind: %d\n", event.Kind)
			fmt.Printf("Event Content Length: %d\n", len(event.Content))
			fmt.Printf("================================\n")
		}

		if err := relay.Publish(ctx, event); err != nil {
			if debug {
				log.Printf("Failed to publish to relay %s: %v", relay.URL, err)
				fmt.Printf("ERROR: Failed to publish to %s: %v\n", relay.URL, err)
			}
			lastErr = err
		} else {
			if debug {
				log.Printf("Published to relay: %s", relay.URL)
				fmt.Printf("SUCCESS: Published to %s\n", relay.URL)
			}
		}
		if debug {
			fmt.Printf("\n")
		}
	}

	return lastErr
}

func (c *Client) Subscribe(ctx context.Context, filters nostr.Filters, handler func(nostr.Event)) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var wg sync.WaitGroup
	errChan := make(chan error, len(c.relays))

	// Channel to collect events from all relays
	eventsChan := make(chan nostr.Event, 100)

	// Map to track processed events by ID
	processedEvents := make(map[string]bool)
	var processedMu sync.RWMutex

	for _, relay := range c.relays {
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

	return <-errChan
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

func (c *Client) QueryEvents(ctx context.Context, filters nostr.Filters, debug bool) ([]nostr.Event, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var wg sync.WaitGroup
	eventsChan := make(chan []nostr.Event, len(c.relays))
	errChan := make(chan error, len(c.relays))

	for _, relay := range c.relays {
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
	for i := 0; i < len(c.relays); i++ {
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
