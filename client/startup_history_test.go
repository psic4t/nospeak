package client

import (
	"context"
	"testing"

	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/testutils"
)

func TestFetchSentMessages(t *testing.T) {
	// Generate test keys
	keys1 := testutils.GenerateTestKeys(t)

	// Create test config
	cfg := &config.Config{
		Npub:          keys1.Npub,
		Nsec:          keys1.Nsec,
		Partners:      []string{},
		Debug:         true,
		Cache:         "sqlite",
		ShowContacts:  true,
		NotifyCommand: "",
	}

	// Create client
	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Test FetchSentMessages
	// Since we don't have relays connected in this test environment,
	// it should try to query and likely fail or return empty results,
	// but it shouldn't panic.

	ctx := context.Background()
	err = client.FetchSentMessages(ctx, 10, true)

	// It might return an error if no relays are connected (which is true)
	// QueryEvents might fail.
	// That's fine, we just want to exercise the code path.

	if err != nil {
		t.Logf("FetchSentMessages returned error (expected without relays): %v", err)
	} else {
		t.Log("FetchSentMessages completed successfully")
	}
}
