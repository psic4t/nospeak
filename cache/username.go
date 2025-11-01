package cache

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type UsernameCache struct {
	cacheDir string
	mu       sync.RWMutex
}

var (
	instance *UsernameCache
	once     sync.Once
)

func GetUsernameCache() *UsernameCache {
	once.Do(func() {
		cacheDir := getCacheDir()
		if err := os.MkdirAll(cacheDir, 0755); err != nil {
			panic(fmt.Sprintf("failed to create cache directory: %v", err))
		}
		instance = &UsernameCache{cacheDir: cacheDir}
	})
	return instance
}

func getCacheDir() string {
	xdgCacheHome := os.Getenv("XDG_CACHE_HOME")
	if xdgCacheHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			panic(fmt.Sprintf("failed to get user home directory: %v", err))
		}
		xdgCacheHome = filepath.Join(home, ".cache")
	}
	return filepath.Join(xdgCacheHome, "nospeak")
}

func (uc *UsernameCache) getCachePath(npub string) string {
	return filepath.Join(uc.cacheDir, fmt.Sprintf("username_%s.json", npub))
}

func (uc *UsernameCache) Get(npub string) (string, bool) {
	uc.mu.RLock()
	defer uc.mu.RUnlock()

	cachePath := uc.getCachePath(npub)
	data, err := os.ReadFile(cachePath)
	if err != nil {
		return "", false
	}

	var entry UsernameEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return "", false
	}

	if time.Now().After(entry.ExpiresAt) {
		os.Remove(cachePath)
		return "", false
	}

	return entry.Username, true
}

func (uc *UsernameCache) Set(npub, username string, ttl time.Duration) {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	entry := UsernameEntry{
		Username:  username,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(ttl),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return
	}

	cachePath := uc.getCachePath(npub)
	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		return
	}
}

func (uc *UsernameCache) Clear() error {
	uc.mu.Lock()
	defer uc.mu.Unlock()

	files, err := os.ReadDir(uc.cacheDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" {
			os.Remove(filepath.Join(uc.cacheDir, file.Name()))
		}
	}

	return nil
}
