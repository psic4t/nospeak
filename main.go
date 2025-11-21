package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/data.haus/nospeak/cmd"
	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/tui"
)

const Version = "0.9.8"

// DiscoveryRelays contains predefined relays for NIP-65 discovery
type DiscoveryRelays struct {
	Relays []string
}

// GetDiscoveryRelays returns the predefined discovery relays
func GetDiscoveryRelays() DiscoveryRelays {
	return DiscoveryRelays{
		Relays: []string{
			"wss://purplepag.es",
			"wss://nostr.data.haus",
			"wss://nos.lol",
			"wss://relay.damus.io",
		},
	}
}

func main() {
	// Check for help flags before flag.Parse() to override default behavior
	if len(os.Args) > 1 && (os.Args[1] == "--help" || os.Args[1] == "-h") {
		printUsage()
		os.Exit(0)
	}

	debug := flag.Bool("debug", false, "Enable debug mode to print generated events")
	version := flag.Bool("v", false, "Show version information")
	configPath := flag.String("c", "", "Path to config file (default: ~/.config/nospeak/config.toml)")
	flag.Parse()

	// Handle version flag
	if *version {
		fmt.Printf("nospeak version %s\n", Version)
		os.Exit(0)
	}

	// If no arguments provided, start TUI mode by default
	if len(flag.Args()) == 0 {
		startTUI(*debug, *configPath)
		return
	}

	if len(flag.Args()) < 1 {
		printUsage()
		os.Exit(1)
	}

	command := flag.Args()[0]
	args := flag.Args()[1:]

	switch command {
	case "send":
		cmd.Send(args, *debug, *configPath)
	case "receive":
		cmd.Receive(*debug, *configPath)
	case "set-name":
		cmd.SetName(args, *debug, *configPath)
	case "set-messaging-relays":
		cmd.SetMessagingRelays(*debug, *configPath)
	case "debug-relay":
		cmd.DebugRelay(args, *debug, *configPath)
	case "new-identity":
		generateNewIdentity(*configPath)
	case "help", "--help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func startTUI(debug bool, configPath string) {
	app, err := tui.NewApp(configPath)
	if err != nil {
		log.Fatalf("Failed to create TUI app: %v", err)
	}

	if err := app.Start(debug); err != nil {
		log.Fatalf("Failed to start TUI: %v", err)
	}
}

func printUsage() {
	fmt.Println("Nostr Chat Application")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  nospeak                           - Start TUI mode (default)")
	fmt.Println("  nospeak new-identity              - Generate a new Nostr key pair and add to config")
	fmt.Println("  nospeak send <npub> <message>     - Send a message")
	fmt.Println("  nospeak receive                   - Listen for messages")
	fmt.Println("  nospeak set-name <name>           - Set your profile name")
	fmt.Println("  nospeak set-messaging-relays      - Set your messaging relays from config")
	fmt.Println("  nospeak debug-relay <npub> [cmd]  - Debug relay data issues")
	fmt.Println("  nospeak help                      - Show this help")
	fmt.Println("")
	fmt.Println("Debug Relay Commands:")
	fmt.Println("  inspect     - Show cached relay data")
	fmt.Println("  validate    - Validate relay data and show issues")
	fmt.Println("  repair      - Attempt to repair corrupted relay data")
	fmt.Println("  refresh     - Force refresh relay data from network")
	fmt.Println("  trace       - Trace NIP-65 discovery with detailed logging")
	fmt.Println("")
	fmt.Println("Global flags:")
	fmt.Println("  -v                               - Show version information")
	fmt.Println("  --debug                          - Enable debug mode to print generated events")
	fmt.Println("  -c <path>                        - Path to config file (default: ~/.config/nospeak/config.toml)")

	fmt.Println("")
	fmt.Println("TUI Keyboard Shortcuts:")
	fmt.Println("  Ctrl+C/Ctrl+Q                    - Quit application")
	fmt.Println("  Tab                              - Switch between contact list and input")
	fmt.Println("  Enter                            - Send message (when in input field)")
	fmt.Println("  PgUp/PgDn                        - Scroll message pane up/down")
	fmt.Println("  Ctrl+k/j                         - Switch between contacts (k=up, j=down)")
	fmt.Println("  Ctrl+p                           - Show profile information for current contact")

	fmt.Println("  F1                               - Show settings")
	fmt.Println("  F2                               - Show relay connections")
	fmt.Println("  F3                               - Toggle contacts pane")
	fmt.Println("  ↑/↓                              - Navigate contact list")
	fmt.Println("")
	fmt.Println("Configuration file location: ~/.config/nospeak/config.toml")
	fmt.Println("A configuration template will be created automatically on first run.")
}

func generateNewIdentity(configPath string) {
	if configPath == "" {
		configPath = config.GetConfigPath()
	}

	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		fmt.Printf("Configuration file not found at %s\n", configPath)
		fmt.Println("A configuration template will be created automatically on first run.")
		fmt.Println("Please run nospeak first to create the configuration file.")
		os.Exit(1)
	}

	// Load existing config without validation to check if keys already exist
	existingConfig, err := config.LoadWithoutValidationWithPath(configPath)
	if err != nil {
		fmt.Printf("Failed to load config file: %v\n", err)
		os.Exit(1)
	}

	// Check if valid keys already exist
	if config.HasValidKeys(existingConfig) {
		fmt.Printf("Warning: Configuration file already contains valid Nostr keys:\n")
		fmt.Printf("  nsec: %s...\n", existingConfig.Nsec[:8])
		fmt.Printf("  npub: %s...\n", existingConfig.Npub[:8])
		fmt.Println("Cannot generate new identity. Remove existing keys first if you want to create a new identity.")
		os.Exit(1)
	}

	// Generate new key pair
	nsec, npub, err := config.GenerateKeyPair()
	if err != nil {
		fmt.Printf("Failed to generate new key pair: %v\n", err)
		os.Exit(1)
	}

	// Update config with new keys
	if err := config.UpdateConfigWithKeysAtPath(nsec, npub, configPath); err != nil {
		fmt.Printf("Failed to update config with new keys: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("New Nostr identity generated successfully:")
	fmt.Printf("  nsec: %s\n", nsec)
	fmt.Printf("  npub: %s\n", npub)
	fmt.Printf("Keys saved to configuration file at %s\n", configPath)
	fmt.Println("Keep your private key (nsec) secure and never share it!")
}
