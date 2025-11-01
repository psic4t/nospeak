package cmd

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
)

func SetName(args []string, debug bool) {
	if len(args) < 1 {
		fmt.Println("Usage: nospeak set-name <name>")
		os.Exit(1)
	}

	name := args[0]

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	nostrClient, err := client.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	ctx := context.Background()
	if err := nostrClient.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}
	defer nostrClient.Disconnect()

	if err := nostrClient.SetProfileName(ctx, name, debug); err != nil {
		log.Fatalf("Failed to set profile name: %v", err)
	}

	fmt.Printf("Profile name set to: %s\n", name)
}
