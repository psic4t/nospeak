package mocks

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/nbd-wtf/go-nostr"
)

// MockRelay simulates a Nostr relay for testing
type MockRelay struct {
	URL           string
	connected     bool
	events        []nostr.Event
	subscriptions map[string]*MockSubscription
	mu            sync.RWMutex
}

// MockSubscription simulates a relay subscription
type MockSubscription struct {
	ID     string
	Events chan *nostr.Event
	closed bool
	mu     sync.RWMutex
}

// NewMockRelay creates a new mock relay
func NewMockRelay(url string) *MockRelay {
	return &MockRelay{
		URL:           url,
		connected:     false,
		events:        make([]nostr.Event, 0),
		subscriptions: make(map[string]*MockSubscription),
	}
}

// Connect simulates connecting to the relay
func (r *MockRelay) Connect(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.connected = true
	return nil
}

// Close simulates closing the relay connection
func (r *MockRelay) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.connected = false

	// Close all subscriptions
	for _, sub := range r.subscriptions {
		sub.Close()
	}
	r.subscriptions = make(map[string]*MockSubscription)

	return nil
}

// Publish simulates publishing an event to the relay
func (r *MockRelay) Publish(ctx context.Context, event nostr.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.connected {
		return fmt.Errorf("not connected to relay %s", r.URL)
	}

	// Store the event
	r.events = append(r.events, event)

	// Send to matching subscriptions
	for _, sub := range r.subscriptions {
		if r.eventMatchesFilters(event, sub) {
			select {
			case sub.Events <- &event:
			case <-ctx.Done():
				return ctx.Err()
			default:
				// Channel full, skip
			}
		}
	}

	return nil
}

// Subscribe simulates creating a subscription
func (r *MockRelay) Subscribe(ctx context.Context, filters nostr.Filters) (*MockSubscription, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.connected {
		return nil, fmt.Errorf("not connected to relay %s", r.URL)
	}

	subID := fmt.Sprintf("sub_%d", time.Now().UnixNano())
	sub := &MockSubscription{
		ID:     subID,
		Events: make(chan *nostr.Event, 100),
	}

	r.subscriptions[subID] = sub

	// Send existing events that match filters
	for _, event := range r.events {
		if r.eventMatchesFilters(event, sub) {
			select {
			case sub.Events <- &event:
			default:
				// Channel full, skip
			}
		}
	}

	// Start a goroutine to handle context cancellation
	go func() {
		<-ctx.Done()
		sub.Close()
	}()

	return sub, nil
}

// Auth simulates authentication to the relay
func (r *MockRelay) Auth(ctx context.Context, authFunc func(*nostr.Event) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.connected {
		return fmt.Errorf("not connected to relay %s", r.URL)
	}

	// Create auth event
	event := &nostr.Event{
		Kind:      nostr.KindClientAuthentication,
		CreatedAt: nostr.Now(),
		Content:   "",
	}

	// Call the auth function to sign the event
	if err := authFunc(event); err != nil {
		return fmt.Errorf("auth function failed: %w", err)
	}

	// For mock purposes, always succeed
	return nil
}

// IsConnected returns whether the relay is connected
func (r *MockRelay) IsConnected() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.connected
}

// GetEvents returns all events stored in the relay
func (r *MockRelay) GetEvents() []nostr.Event {
	r.mu.RLock()
	defer r.mu.RUnlock()

	events := make([]nostr.Event, len(r.events))
	copy(events, r.events)
	return events
}

// ClearEvents clears all stored events
func (r *MockRelay) ClearEvents() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = make([]nostr.Event, 0)
}

// Close closes the subscription
func (s *MockSubscription) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.closed {
		s.closed = true
		close(s.Events)
	}
}

// IsClosed returns whether the subscription is closed
func (s *MockSubscription) IsClosed() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.closed
}

// Helper function to check if event matches subscription filters
func (r *MockRelay) eventMatchesFilters(_ nostr.Event, _ *MockSubscription) bool {
	// For mock purposes, implement simple matching
	// In a real implementation, this would use actual filters
	return true
}

// MockRelayPool manages multiple mock relays
type MockRelayPool struct {
	relays map[string]*MockRelay
	mu     sync.RWMutex
}

// NewMockRelayPool creates a new mock relay pool
func NewMockRelayPool() *MockRelayPool {
	return &MockRelayPool{
		relays: make(map[string]*MockRelay),
	}
}

// AddRelay adds a mock relay to the pool
func (p *MockRelayPool) AddRelay(url string) *MockRelay {
	p.mu.Lock()
	defer p.mu.Unlock()

	relay := NewMockRelay(url)
	p.relays[url] = relay
	return relay
}

// GetRelay returns a mock relay by URL
func (p *MockRelayPool) GetRelay(url string) *MockRelay {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return p.relays[url]
}

// ConnectAll connects all relays in the pool
func (p *MockRelayPool) ConnectAll(ctx context.Context) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	for _, relay := range p.relays {
		if err := relay.Connect(ctx); err != nil {
			return err
		}
	}
	return nil
}

// CloseAll closes all relays in the pool
func (p *MockRelayPool) CloseAll() error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	for _, relay := range p.relays {
		relay.Close()
	}
	return nil
}

// BroadcastEvent broadcasts an event to all connected relays
func (p *MockRelayPool) BroadcastEvent(ctx context.Context, event nostr.Event) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	for _, relay := range p.relays {
		if relay.IsConnected() {
			if err := relay.Publish(ctx, event); err != nil {
				return err
			}
		}
	}
	return nil
}
