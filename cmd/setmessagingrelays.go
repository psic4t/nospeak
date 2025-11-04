package cmd

import (
	"context"
	"log"

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

	if err := nostrClient.SetMessagingRelays(ctx, debug); err != nil {
		log.Fatalf("Failed to set messaging relays: %v", err)
	}

	log.Println("Messaging relays successfully set from configuration")
}
