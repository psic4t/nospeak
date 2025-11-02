package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/BurntSushi/toml"
	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

type Config struct {
	Relays       []string `toml:"relays"`
	Npub         string   `toml:"npub"`
	Nsec         string   `toml:"nsec"`
	Partners     []string `toml:"partners"`
	Debug        bool     `toml:"debug"`
	Cache        string   `toml:"cache"`
	ShowContacts bool     `toml:"show_contacts"`
}

func Load() (*Config, error) {
	configPath := GetConfigPath()

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Auto-copy template config when missing
		if err := copyTemplateConfig(); err != nil {
			return nil, fmt.Errorf("failed to create config template: %w", err)
		}

		// Return special error to indicate template was copied
		return nil, fmt.Errorf("config template created at %s - please edit with your Nostr keys and relays", configPath)
	}

	var config Config
	_, err := toml.DecodeFile(configPath, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to decode config file: %w", err)
	}

	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return &config, nil
}

func LoadWithoutValidation() (*Config, error) {
	configPath := GetConfigPath()

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file not found at %s", configPath)
	}

	var config Config
	_, err := toml.DecodeFile(configPath, &config)
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
	if _, err := toml.DecodeFile(configPath, &config); err != nil {
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
	file, err := os.OpenFile(configPath, os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to open config file for writing: %w", err)
	}
	defer file.Close()

	encoder := toml.NewEncoder(file)
	if err := encoder.Encode(&config); err != nil {
		return fmt.Errorf("failed to encode config to file: %w", err)
	}

	return nil
}

func copyTemplateConfig() error {
	configPath := GetConfigPath()

	// Create config directory if it doesn't exist
	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Path to example template
	examplePath := "config/example.toml"
	if _, err := os.Stat(examplePath); err != nil {
		return fmt.Errorf("example config file not found at %s", examplePath)
	}

	// Read template
	exampleContent, err := os.ReadFile(examplePath)
	if err != nil {
		return fmt.Errorf("failed to read example config: %w", err)
	}

	// Write to user config location
	if err := os.WriteFile(configPath, exampleContent, 0o644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}
