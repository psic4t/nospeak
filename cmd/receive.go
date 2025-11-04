package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/notification"
)

func Receive(debug bool, configPath string) {
	nostrClient, baseCtx, cfg, err := client.CreateClient(configPath, debug)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithCancel(baseCtx)
	defer cancel()

	if err := nostrClient.Connect(ctx, debug); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}
	defer nostrClient.Disconnect()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	messageHandler := func(senderNpub, message string) {
		if debug {
			log.Printf("Receive messageHandler called for %s: %q", senderNpub, message)
		}

		if !nostrClient.IsPartner(senderNpub) {
			if err := nostrClient.AddPartner(senderNpub); err != nil {
				log.Printf("Failed to add new partner %s: %v", senderNpub, err)
			} else {
				log.Printf("Auto-added new partner: %s", senderNpub[:8]+"...")
			}
		}

		fmt.Printf("\n[%s]: %s\n", senderNpub, message)

		// Send notification with resolved username
		if debug {
			log.Printf("Receive mode: sending notification for message from %s", senderNpub)
		}
		username, _ := nostrClient.ResolveUsername(ctx, senderNpub, debug)
		if username == "" {
			username = senderNpub
		}
		if debug {
			log.Printf("Sending notification to %s with command: %s", username, cfg.NotifyCommand)
		}
		go notification.SendNotification(username, message, cfg.NotifyCommand, debug)
	}

	go func() {
		if err := nostrClient.ListenForMessages(ctx, messageHandler, debug); err != nil {
			log.Printf("Error listening for messages: %v", err)
		}
	}()

	fmt.Println("Listening for messages... Press Ctrl+C to stop")
	fmt.Print("> ")

	select {
	case <-sigChan:
		fmt.Println("\nStopping...")
		cancel()
	case <-ctx.Done():
	}
}
