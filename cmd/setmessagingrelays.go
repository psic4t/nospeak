package cmd

import (
	"context"
	"log"
	"time"

	"github.com/data.haus/nospeak/client"
)

func SetMessagingRelays(debug bool, configPath string) {
	nostrClient, baseCtx, _, err := client.CreateClient(configPath, debug)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithCancel(baseCtx)
	defer cancel()

	if err := nostrClient.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}
	defer nostrClient.Disconnect()

	// Wait for at least one relay connection before proceeding
	if err := nostrClient.WaitForConnections(ctx, 1, 15*time.Second, debug); err != nil {
		log.Fatalf("Failed to establish relay connections: %v", err)
	}

	if err := nostrClient.SetMessagingRelays(ctx, debug); err != nil {
		log.Fatalf("Failed to set messaging relays: %v", err)
	}

	log.Println("Messaging relays successfully set from configuration")
}
