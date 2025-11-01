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

	if err := nostrClient.Connect(ctx); err != nil {
		log.Fatalf("Failed to connect to relays: %v", err)
	}
	defer nostrClient.Disconnect()

	partners := nostrClient.GetPartnerNpubs()
	if len(partners) == 0 {
		fmt.Println("No chat partners configured. Add partners to your config file.")
		return
	}

	fmt.Println("Available partners:")
	for i, partner := range partners {
		fmt.Printf("%d: %s\n", i+1, partner)
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

	fmt.Printf("Chatting with %s\n", selectedPartner)
	fmt.Println("Type messages and press Enter. Type '/quit' to exit.")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	messageHandler := func(senderNpub, message string) {
		if senderNpub == selectedPartner {
			fmt.Printf("\n[%s]: %s\n> ", senderNpub, message)
		}
	}

	go func() {
		if err := nostrClient.ListenForMessages(ctx, messageHandler); err != nil {
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
