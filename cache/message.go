package cache

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type MessageCache struct {
	cacheDir string
	mu       sync.RWMutex
}

var (
	messageInstance *MessageCache
	messageOnce     sync.Once
)

func GetMessageCache() *MessageCache {
	messageOnce.Do(func() {
		cacheDir := getCacheDir()
		if err := os.MkdirAll(cacheDir, 0755); err != nil {
			panic(fmt.Sprintf("failed to create cache directory: %v", err))
		}
		messageInstance = &MessageCache{cacheDir: cacheDir}
	})
	return messageInstance
}

func (mc *MessageCache) getCachePath(recipientNpub string) string {
	return filepath.Join(mc.cacheDir, fmt.Sprintf("messages_%s.json", recipientNpub))
}

func (mc *MessageCache) AddMessage(recipientNpub, message, eventID, direction string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	entry := MessageEntry{
		RecipientNpub: recipientNpub,
		Message:       message,
		SentAt:        time.Now(),
		EventID:       eventID,
		Direction:     direction,
	}

	cachePath := mc.getCachePath(recipientNpub)

	var messages []MessageEntry
	if data, err := os.ReadFile(cachePath); err == nil {
		json.Unmarshal(data, &messages)
	}

	messages = append(messages, entry)

	mc.cleanupOldMessages(&messages)

	data, err := json.Marshal(messages)
	if err != nil {
		return
	}

	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		return
	}
}

func (mc *MessageCache) GetMessages(recipientNpub string, limit int) []MessageEntry {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	cachePath := mc.getCachePath(recipientNpub)
	data, err := os.ReadFile(cachePath)
	if err != nil {
		return nil
	}

	var messages []MessageEntry
	if err := json.Unmarshal(data, &messages); err != nil {
		return nil
	}

	sort.Slice(messages, func(i, j int) bool {
		return messages[i].SentAt.Before(messages[j].SentAt)
	})

	if limit > 0 && len(messages) > limit {
		return messages[len(messages)-limit:]
	}

	return messages
}

func (mc *MessageCache) cleanupOldMessages(messages *[]MessageEntry) {
	cutoff := time.Now().AddDate(0, 0, -30)
	var filtered []MessageEntry

	for _, msg := range *messages {
		if msg.SentAt.After(cutoff) {
			filtered = append(filtered, msg)
		}
	}

	*messages = filtered
}

func (mc *MessageCache) Clear() error {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	files, err := os.ReadDir(mc.cacheDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" &&
			(filepath.Base(file.Name())[:8] == "messages") {
			os.Remove(filepath.Join(mc.cacheDir, file.Name()))
		}
	}

	return nil
}
