package tui

import (
	"fmt"
	"github.com/data.haus/nospeak/cache"
	"github.com/nbd-wtf/go-nostr"
	"time"
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

// formatDateBar creates a styled single-line date separator
func formatDateBar(date time.Time) string {
	dateStr := date.Format("January 2, 2006")
	return fmt.Sprintf("[yellow]------ %s ------[white]", dateStr)
}

// shouldInsertDateBar determines if a date bar should be inserted between two messages
func shouldInsertDateBar(prevTime, currentTime time.Time) bool {
	if prevTime.IsZero() {
		return true // First message always gets a date bar
	}

	// Compare year, month, and day
	return prevTime.Year() != currentTime.Year() ||
		prevTime.Month() != currentTime.Month() ||
		prevTime.Day() != currentTime.Day()
}
