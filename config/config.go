package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/BurntSushi/toml"
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
		return nil, fmt.Errorf("config file not found at %s", configPath)
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
