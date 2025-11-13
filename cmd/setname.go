package cmd

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/data.haus/nospeak/client"
)

func SetName(args []string, debug bool, configPath string) {
	if len(args) < 1 {
		fmt.Println("Usage: nospeak set-name <name>")
		os.Exit(1)
	}

	name := args[0]

	nostrClient, ctx, _, err := client.CreateClient(configPath, debug)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	if err := nostrClient.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}
	defer nostrClient.Disconnect()

	// Wait for at least one relay connection before proceeding
	if err := nostrClient.WaitForConnections(ctx, 1, 15*time.Second, debug); err != nil {
		log.Fatalf("Failed to establish relay connections: %v", err)
	}

	if err := nostrClient.SetProfileName(ctx, name, debug); err != nil {
		log.Fatalf("Failed to set profile name: %v", err)
	}

	fmt.Printf("Profile name set to: %s\n", name)
}
