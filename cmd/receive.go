package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
)

func Receive(debug bool) {
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

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	messageHandler := func(senderNpub, message string) {
		fmt.Printf("\n[%s]: %s\n", senderNpub, message)
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
