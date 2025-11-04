package tui

import (
	"fmt"
	"time"
	"github.com/data.haus/nospeak/cache"
	"github.com/nbd-wtf/go-nostr"
)

type MessageFormatter struct{}

func NewMessageFormatter() *MessageFormatter {
	return &MessageFormatter{}
}

func (mf *MessageFormatter) FormatMessage(event *nostr.Event, sender string, isOutgoing bool, isEncrypted bool) string {
	timestamp := time.Unix(int64(event.CreatedAt), 0).Format("15:04:05")

	var prefix string
	if isOutgoing {
		prefix = "[blue]"
	} else {
		prefix = "[green]"
	}

	encryptionIndicator := ""
	if isEncrypted {
		encryptionIndicator = " 🔒"
	}

	return fmt.Sprintf("%s%s [%s]%s: %s", prefix, sender, timestamp, encryptionIndicator, event.Content)
}

func (mf *MessageFormatter) FormatMessageEntry(entry cache.MessageEntry, sender string, isOutgoing bool) string {
	timestamp := entry.SentAt.Format("15:04:05")

	if isOutgoing {
		return fmt.Sprintf("[blue]%s[white] [orange]You:[white] %s", timestamp, entry.Message)
	} else {
		return fmt.Sprintf("[blue]%s[white] [green]%s:[white] %s", timestamp, sender, entry.Message)
	}
}

func (mf *MessageFormatter) FormatIncomingMessage(timestamp, username, message string) string {
	return fmt.Sprintf("[blue]%s[white] [green]%s:[white] %s", timestamp, username, message)
}