package notification

import (
	"log"
	"os/exec"
	"runtime"
	"strings"

	"github.com/data.haus/nospeak/config"
)

func SendNotification(username, message, notifyCommand string, debug bool) {
	if notifyCommand == "" {
		if debug {
			log.Printf("Notification skipped: no command configured")
		}
		return
	}

	// Replace %s with username in the command
	command := strings.ReplaceAll(notifyCommand, "%s", username)

	if debug {
		log.Printf("Executing notification command: %s", command)
	}

	// Use shell to handle complex commands with quotes properly
	var cmd *exec.Cmd
	if strings.Contains(command, " ") || strings.Contains(command, "\"") || strings.Contains(command, "'") {
		// For complex commands, use shell
		cmd = exec.Command("sh", "-c", command)
	} else {
		// For simple commands, execute directly
		cmd = exec.Command(command)
	}

	if err := cmd.Run(); err != nil {
		if debug {
			log.Printf("Notification command failed: %v", err)
		}
		return
	}

	if debug {
		log.Printf("Notification sent successfully")
	}
}

func GetDefaultNotifyCommand() string {
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

func SetDefaultNotifyCommand(cfg *config.Config) {
	if cfg.NotifyCommand == "" {
		defaultCmd := GetDefaultNotifyCommand()
		if defaultCmd != "" && commandExists(defaultCmd) {
			cfg.NotifyCommand = defaultCmd
		}
	}
}

func commandExists(command string) bool {
	// Extract the first word (command name) from the command string
	// Handle both simple commands and complex ones with quotes
	var cmdName string
	if strings.Contains(command, " ") {
		// For complex commands, get the first word before any space
		parts := strings.Fields(command)
		if len(parts) == 0 {
			return false
		}
		cmdName = parts[0]
	} else {
		cmdName = command
	}

	_, err := exec.LookPath(cmdName)
	return err == nil
}
