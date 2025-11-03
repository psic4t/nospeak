package config

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
	"github.com/pelletier/go-toml/v2"
)

type Config struct {
	Relays        []string `toml:"relays" comment:"List of relays to connect to"`
	Npub          string   `toml:"npub" comment:"Your Nostr public key"`
	Nsec          string   `toml:"nsec" comment:"Your Nostr private key (keep secure)"`
	Partners      []string `toml:"partners" comment:"Chat partners (their npub keys)"`
	Debug         bool     `toml:"debug" comment:"Enable debug mode to print generated events"`
	Cache         string   `toml:"cache" comment:"Cache type: 'sqlite' or 'memory'"`
	ShowContacts  bool     `toml:"show_contacts" comment:"Show contacts pane on startup"`
	NotifyCommand string   `toml:"notify_command" comment:"External notification command for new messages"`
}

func Load() (*Config, error) {
	configPath := GetConfigPath()

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Auto-copy template config when missing with generated keys
		nsec, npub, err := copyTemplateConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to create config template: %w", err)
		}

		// Return special error to indicate template was copied with generated keys
		return nil, fmt.Errorf("\n\nconfig created at %s with new Nostr identity:\n\n  nsec: %s\n  npub: %s\n\nYou can use these keys or replace them with your own existing keys.\nKeep your private key (nsec) secure and never share it!", configPath, nsec, npub)
	}

	var config Config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}
	err = toml.Unmarshal(data, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to decode config file: %w", err)
	}

	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	// Set default notification command if not configured
	if config.NotifyCommand == "" {
		defaultCmd := getDefaultNotifyCommand()
		if defaultCmd != "" && commandExists(defaultCmd) {
			config.NotifyCommand = defaultCmd
		}
	}

	return &config, nil
}

func LoadWithoutValidation() (*Config, error) {
	configPath := GetConfigPath()

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file not found at %s", configPath)
	}

	var config Config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}
	err = toml.Unmarshal(data, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to decode config file: %w", err)
	}

	return &config, nil
}

func HasValidKeys(config *Config) bool {
	if config.Nsec == "" || config.Npub == "" {
		return false
	}

	// Validate nsec format
	_, _, err := nip19.Decode(config.Nsec)
	if err != nil {
		return false
	}

	// Validate npub format
	_, _, err = nip19.Decode(config.Npub)
	if err != nil {
		return false
	}

	return true
}

func validateConfig(config *Config) error {
	if len(config.Relays) == 0 {
		return fmt.Errorf("at least one relay must be configured")
	}

	if config.Nsec == "" {
		return fmt.Errorf("nsec (private key) is required")
	}

	if config.Npub == "" {
		return fmt.Errorf("npub (public key) is required")
	}

	if _, _, err := nip19.Decode(config.Nsec); err != nil {
		return fmt.Errorf("invalid nsec format: %w", err)
	}

	if _, _, err := nip19.Decode(config.Npub); err != nil {
		return fmt.Errorf("invalid npub format: %w", err)
	}

	for i, partner := range config.Partners {
		if _, _, err := nip19.Decode(partner); err != nil {
			return fmt.Errorf("invalid partner npub at index %d: %w", i, err)
		}
	}

	return nil
}

func GetConfigPath() string {
	xdgConfigHome := os.Getenv("XDG_CONFIG_HOME")
	if xdgConfigHome == "" {
		home, _ := os.UserHomeDir()
		xdgConfigHome = filepath.Join(home, ".config")
	}
	return filepath.Join(xdgConfigHome, "nospeak", "config.toml")
}

func GenerateKeyPair() (string, string, error) {
	privateKey := nostr.GeneratePrivateKey()

	// Get public key from private key
	publicKey, err := nostr.GetPublicKey(privateKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Encode keys to nsec/npub format
	nsec, err := nip19.EncodePrivateKey(privateKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to encode private key: %w", err)
	}

	npub, err := nip19.EncodePublicKey(publicKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to encode public key: %w", err)
	}

	return nsec, npub, nil
}

func UpdateConfigWithKeys(nsec, npub string) error {
	configPath := GetConfigPath()

	// Load existing config without validation
	var config Config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}
	err = toml.Unmarshal(data, &config)
	if err != nil {
		return fmt.Errorf("failed to decode config file: %w", err)
	}

	// Check if valid keys already exist
	if HasValidKeys(&config) {
		return fmt.Errorf("config file already contains valid Nostr keys")
	}

	// Update config with new keys
	config.Nsec = nsec
	config.Npub = npub

	// Write back to file
	file, err := os.OpenFile(configPath, os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return fmt.Errorf("failed to open config file for writing: %w", err)
	}
	defer file.Close()

	configData, err := toml.Marshal(&config)
	if err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}
	if _, err := file.Write(configData); err != nil {
		return fmt.Errorf("failed to write config to file: %w", err)
	}

	return nil
}

func copyTemplateConfig() (string, string, error) {
	configPath := GetConfigPath()

	// Create config directory if it doesn't exist
	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return "", "", fmt.Errorf("failed to create config directory: %w", err)
	}

	// Path to example template
	examplePath := "config/example.toml"
	if _, err := os.Stat(examplePath); err != nil {
		return "", "", fmt.Errorf("example config file not found at %s", examplePath)
	}

	// Read template
	exampleContent, err := os.ReadFile(examplePath)
	if err != nil {
		return "", "", fmt.Errorf("failed to read example config: %w", err)
	}

	// Generate new key pair
	nsec, npub, err := GenerateKeyPair()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate key pair: %w", err)
	}

	// Replace placeholder keys with generated keys
	content := string(exampleContent)
	content = strings.ReplaceAll(content, `npub = "npub1..."`, fmt.Sprintf(`npub = "%s"`, npub))
	content = strings.ReplaceAll(content, `nsec = "nsec1..."`, fmt.Sprintf(`nsec = "%s"`, nsec))

	// Write modified content to user config location
	if err := os.WriteFile(configPath, []byte(content), 0o644); err != nil {
		return "", "", fmt.Errorf("failed to write config file: %w", err)
	}

	return nsec, npub, nil
}

func (c *Config) Save() error {
	configPath := GetConfigPath()

	// Create config directory if it doesn't exist
	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Use encoder for better control over formatting
	var buf bytes.Buffer
	encoder := toml.NewEncoder(&buf)

	// Set formatting options to match example.toml style
	encoder.SetArraysMultiline(true) // Format arrays with multiple lines like in example
	encoder.SetIndentTables(true)    // Indent table contents

	if err := encoder.Encode(c); err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(configPath, buf.Bytes(), 0o644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

func getDefaultNotifyCommand() string {
	switch runtime.GOOS {
	case "linux":
		return "notify-send \"New message from %s\""
	case "darwin":
		return "osascript -e 'display notification \"New message from %s\"'"
	case "windows":
		return "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('New message from %s', 'Nospeak')\""
	default:
		return ""
	}
}

func commandExists(command string) bool {
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return false
	}

	_, err := exec.LookPath(parts[0])
	return err == nil
}
