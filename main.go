package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/data.haus/nospeak/cmd"
	"github.com/data.haus/nospeak/config"
)

func main() {
	debug := flag.Bool("debug", false, "Enable debug mode to print generated events")
	flag.Parse()

	if len(flag.Args()) < 1 {
		printUsage()
		os.Exit(1)
	}

	command := flag.Args()[0]
	args := flag.Args()[1:]

	switch command {
	case "send":
		cmd.Send(args, *debug)
	case "receive":
		cmd.Receive(*debug)
	case "chat":
		cmd.Chat(*debug)
	case "set-name":
		cmd.SetName(args, *debug)
	case "init":
		initConfig()
	case "help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Nostr CLI Chat Application")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  nospeak init                    - Initialize configuration file")
	fmt.Println("  nospeak send <npub> <message>   - Send a message")
	fmt.Println("  nospeak receive                 - Listen for messages")
	fmt.Println("  nospeak chat                    - Interactive chat mode")
	fmt.Println("  nospeak set-name <name>         - Set your profile name")
	fmt.Println("  nospeak help                    - Show this help")
	fmt.Println("")
	fmt.Println("Global flags:")
	fmt.Println("  --debug                         - Enable debug mode to print generated events")
	fmt.Println("")
	fmt.Println("Configuration file location: ~/.config/nospeak/config.toml")
	fmt.Println("Example configuration is available at: config/example.toml")
}

func initConfig() {
	configPath := config.GetConfigPath()

	if _, err := os.Stat(configPath); err == nil {
		fmt.Printf("Configuration file already exists at %s\n", configPath)
		return
	}

	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Fatalf("Failed to create config directory: %v", err)
	}

	examplePath := "config/example.toml"
	if _, err := os.Stat(examplePath); err != nil {
		log.Fatalf("Example config file not found at %s", examplePath)
	}

	exampleContent, err := os.ReadFile(examplePath)
	if err != nil {
		log.Fatalf("Failed to read example config: %v", err)
	}

	if err := os.WriteFile(configPath, exampleContent, 0644); err != nil {
		log.Fatalf("Failed to write config file: %v", err)
	}

	fmt.Printf("Configuration file created at %s\n", configPath)
	fmt.Println("Please edit the file with your Nostr keys and preferred relays.")
}
