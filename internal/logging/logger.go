package logging

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
)

type DebugLogger struct {
	enabled bool
	logger  *log.Logger
	file    *os.File
	mu      sync.RWMutex
}

const (
	maxLogSize    = 1 << 20 // 1MB
	maxBackupFiles = 3
)

var globalLogger *DebugLogger

func NewDebugLogger(enabled bool) *DebugLogger {
	return &DebugLogger{
		enabled: enabled,
	}
}

func (d *DebugLogger) init() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if !d.enabled {
		return nil
	}

	if d.logger != nil {
		return nil // Already initialized
	}

	logPath := getDebugLogPath()

	// Ensure log directory exists
	logDir := filepath.Dir(logPath)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	// Check if log rotation is needed
	if err := d.rotateLogIfNeeded(logPath); err != nil {
		return fmt.Errorf("failed to rotate log: %w", err)
	}

	// Open log file in append mode
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	d.file = file
	d.logger = log.New(file, "[DEBUG] ", log.LstdFlags)

	return nil
}

func (d *DebugLogger) Debug(format string, args ...interface{}) {
	if !d.enabled {
		return
	}

	// Initialize logger if not already done
	if d.logger == nil {
		if err := d.init(); err != nil {
			// Fallback to stderr if file logging fails
			log.Printf("Failed to initialize debug logger: %v", err)
			return
		}
	}

	d.logger.Printf(format, args...)
}

func (d *DebugLogger) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.file != nil {
		return d.file.Close()
	}
	return nil
}

func (d *DebugLogger) rotateLogIfNeeded(logPath string) error {
	info, err := os.Stat(logPath)
	if os.IsNotExist(err) {
		return nil // Log file doesn't exist yet
	}
	if err != nil {
		return err
	}

	if info.Size() < maxLogSize {
		return nil // No rotation needed
	}

	// Rotate existing logs
	for i := maxBackupFiles; i > 0; i-- {
		oldPath := fmt.Sprintf("%s.%d", logPath, i)
		newPath := fmt.Sprintf("%s.%d", logPath, i+1)

		if i == maxBackupFiles {
			// Remove the oldest backup
			os.Remove(newPath)
		}

		if _, err := os.Stat(oldPath); err == nil {
			os.Rename(oldPath, newPath)
		}
	}

	// Move current log to .1
	backupPath := fmt.Sprintf("%s.1", logPath)
	return os.Rename(logPath, backupPath)
}

func getDebugLogPath() string {
	xdgCacheHome := os.Getenv("XDG_CACHE_HOME")
	if xdgCacheHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			panic(fmt.Sprintf("failed to get user home directory: %v", err))
		}
		xdgCacheHome = filepath.Join(home, ".cache")
	}
	return filepath.Join(xdgCacheHome, "nospeak", "debug.log")
}

// Global logger instance for convenience
func InitGlobalDebugLogger(enabled bool) error {
	globalLogger = NewDebugLogger(enabled)
	return globalLogger.init()
}

func GlobalDebugLogger() *DebugLogger {
	return globalLogger
}

func Debug(format string, args ...interface{}) {
	if globalLogger != nil {
		globalLogger.Debug(format, args...)
	}
}

func CloseGlobalLogger() error {
	if globalLogger != nil {
		return globalLogger.Close()
	}
	return nil
}