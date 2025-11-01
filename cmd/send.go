package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
)

func Send(args []string, debug bool) {
	if len(args) < 2 {
		fmt.Println("Usage: nospeak send <recipient_npub> <message>")
		os.Exit(1)
	}

	recipientNpub := args[0]
	message := strings.Join(args[1:], " ")

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

	if err := nostrClient.SendChatMessage(ctx, recipientNpub, message, debug); err != nil {
		log.Fatalf("Failed to send message: %v", err)
	}

	fmt.Printf("Message sent to %s\n", recipientNpub)
}
