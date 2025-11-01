package cmd

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
)

func Chat(debug bool) {
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

	partners := nostrClient.GetPartnerNpubs()
	if len(partners) == 0 {
		fmt.Println("No chat partners configured. Add partners to your config file.")
		return
	}

	displayNames, err := nostrClient.GetPartnerDisplayNames(ctx, debug)
	if err != nil && debug {
		log.Printf("Failed to resolve usernames: %v", err)
	}

	fmt.Println("Available partners:")
	for i, partner := range partners {
		displayName := displayNames[partner]
		fmt.Printf("%d: \x1b[36m%s\x1b[0m\n", i+1, displayName)
	}

	fmt.Print("Select partner (number): ")
	reader := bufio.NewReader(os.Stdin)
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)

	var selectedPartner string
	if input == "" {
		selectedPartner = partners[0]
	} else {
		selection := 0
		fmt.Sscanf(input, "%d", &selection)
		if selection < 1 || selection > len(partners) {
			fmt.Println("Invalid selection")
			return
		}
		selectedPartner = partners[selection-1]
	}

	selectedDisplayName := displayNames[selectedPartner]
	fmt.Printf("Chatting with \x1b[36m%s\x1b[0m\n", selectedDisplayName)

	messages := nostrClient.GetMessageHistoryEnhanced(selectedPartner, 5, 5)
	if len(messages) > 0 {
		fmt.Println("--- Recent Messages ---")
		for _, msg := range messages {
			timestamp := msg.SentAt.Format("15:04:05")
			if msg.Direction == "sent" {
				fmt.Printf("\x1b[33m[%s] You:\x1b[0m %s\n", timestamp, msg.Message)
			} else {
				username, _ := nostrClient.ResolveUsername(ctx, msg.RecipientNpub, debug)
				if username == "" {
					username = msg.RecipientNpub[:8] + "..."
				}
				fmt.Printf("\x1b[32m[%s] %s:\x1b[0m %s\n", timestamp, username, msg.Message)
			}
		}
		fmt.Println("------------------------")
	}

	fmt.Println("Type messages and press Enter. Type '/quit' to exit.")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	messageHandler := func(senderNpub, message string) {
		if senderNpub == selectedPartner {
			username, _ := nostrClient.ResolveUsername(ctx, senderNpub, debug)
			if username == "" {
				username = senderNpub
			}
			fmt.Printf("\n\x1b[32m[%s]:\x1b[0m %s\n", username, message)
		}
	}

	go func() {
		if err := nostrClient.ListenForMessages(ctx, messageHandler, debug); err != nil {
			log.Printf("Error listening for messages: %v", err)
		}
	}()

	fmt.Print("> ")
	go func() {
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			text := scanner.Text()
			if text == "/quit" {
				cancel()
				return
			}
			if text != "" {
				if err := nostrClient.SendChatMessage(ctx, selectedPartner, text, debug); err != nil {
					log.Printf("Failed to send message: %v", err)
				}
			}
			fmt.Print("> ")
		}
	}()

	select {
	case <-sigChan:
		fmt.Println("\nExiting...")
		cancel()
	case <-ctx.Done():
	}
}
