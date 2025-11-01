package cmd

import (
	"context"
	"log"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
)

func SetMessagingRelays(debug bool) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	nostrClient, err := client.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := nostrClient.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}
	defer nostrClient.Disconnect()

	if err := nostrClient.SetMessagingRelays(ctx, debug); err != nil {
		log.Fatalf("Failed to set messaging relays: %v", err)
	}

	log.Println("Messaging relays successfully set from configuration")
}
