package tui

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/data.haus/nospeak/client"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// RelayConnectionsModal displays real-time relay connection information
type RelayConnectionsModal struct {
	app          *tview.Application
	client       *client.Client
	flex         *tview.Flex
	table        *tview.Table
	statsView    *tview.TextView
	onClose      func()
	ctx          context.Context
	cancel       context.CancelFunc
	updateTicker *time.Ticker
	mu           sync.RWMutex
}

// NewRelayConnectionsModal creates a new relay connections modal
func NewRelayConnectionsModal(app *tview.Application, client *client.Client, onClose func()) *RelayConnectionsModal {
	ctx, cancel := context.WithCancel(context.Background())

	rcm := &RelayConnectionsModal{
		app:     app,
		client:  client,
		onClose: onClose,
		ctx:     ctx,
		cancel:  cancel,
	}

	rcm.createUI()
	return rcm
}

// createUI creates the modal interface
func (rcm *RelayConnectionsModal) createUI() {
	// Main flex container
	rcm.flex = tview.NewFlex().SetDirection(tview.FlexRow)
	rcm.flex.SetBorder(true).SetTitle("[violet]Relay Connections[white]")
	rcm.flex.SetBackgroundColor(tcell.ColorDefault)

	// Create table for relay information
	rcm.table = tview.NewTable()
	rcm.table.SetBorders(false)
	rcm.table.SetFixed(1, 0) // Fix header row
	rcm.table.SetBackgroundColor(tcell.ColorDefault)

	// Set table headers with spacing
	rcm.table.SetCell(0, 0, tview.NewTableCell("[violet]Relay URL[white]").SetSelectable(false))
	rcm.table.SetCell(0, 1, tview.NewTableCell("  [violet]Status[white]").SetSelectable(false))
	rcm.table.SetCell(0, 2, tview.NewTableCell("    [violet]Success[white]").SetSelectable(false))
	rcm.table.SetCell(0, 3, tview.NewTableCell("    [violet]Failures[white]").SetSelectable(false))
	rcm.table.SetCell(0, 4, tview.NewTableCell("    [violet]Last Connected[white]").SetSelectable(false))

	// Configure table column widths using MaxWidth on header cells
	rcm.table.GetCell(0, 0).SetMaxWidth(45) // Relay URL
	rcm.table.GetCell(0, 1).SetMaxWidth(18) // Status
	rcm.table.GetCell(0, 2).SetMaxWidth(12) // Success count
	rcm.table.GetCell(0, 3).SetMaxWidth(12) // Failure count
	rcm.table.GetCell(0, 4).SetMaxWidth(25) // Last connected

	// Create statistics view
	rcm.statsView = tview.NewTextView()
	rcm.statsView.SetDynamicColors(true)
	rcm.statsView.SetBackgroundColor(tcell.ColorDefault)
	rcm.statsView.SetBorder(true)
	rcm.statsView.SetTitle("[violet]Connection Statistics[white]")

	// Add components to flex
	rcm.flex.AddItem(rcm.table, 0, 1, true)
	rcm.flex.AddItem(rcm.statsView, 6, 0, false) // 6 rows for stats

	// Set up input capture for keyboard shortcuts
	rcm.flex.SetInputCapture(rcm.handleInput)

	// Initialize data
	rcm.updateData()
}

// handleInput processes keyboard input
func (rcm *RelayConnectionsModal) handleInput(event *tcell.EventKey) *tcell.EventKey {
	switch event.Key() {
	case tcell.KeyEscape, tcell.KeyCtrlC, tcell.KeyCtrlQ:
		rcm.Close()
		return nil
	case tcell.KeyF5:
		rcm.updateData()
		return nil
	}
	return event
}

// Show displays the modal and starts real-time updates
func (rcm *RelayConnectionsModal) Show() {
	// Set as root
	rcm.app.SetRoot(rcm.flex, true)

	// Start real-time updates
	rcm.startUpdates()
}

// Close stops updates and calls the close callback
func (rcm *RelayConnectionsModal) Close() {
	rcm.stopUpdates()
	if rcm.onClose != nil {
		rcm.onClose()
	}
}

// startUpdates begins the background update goroutine
func (rcm *RelayConnectionsModal) startUpdates() {
	rcm.updateTicker = time.NewTicker(2 * time.Second) // Update every 2 seconds

	go func() {
		for {
			select {
			case <-rcm.ctx.Done():
				return
			case <-rcm.updateTicker.C:
				rcm.app.QueueUpdate(rcm.updateData)
			}
		}
	}()
}

// stopUpdates stops the background update goroutine
func (rcm *RelayConnectionsModal) stopUpdates() {
	if rcm.cancel != nil {
		rcm.cancel()
	}
	if rcm.updateTicker != nil {
		rcm.updateTicker.Stop()
	}
}

// updateData refreshes the relay connection data
func (rcm *RelayConnectionsModal) updateData() {
	// Get connection statistics
	stats := rcm.client.GetConnectionStats()

	// Update statistics view
	rcm.updateStats(stats)

	// Update relay table
	rcm.updateRelayTable(stats)
}

// updateStats updates the statistics view
func (rcm *RelayConnectionsModal) updateStats(stats map[string]interface{}) {
	var statsBuilder strings.Builder

	// Basic connection stats
	connectedRelays := stats["connected_relays"].(int)
	totalManagedRelays := stats["total_managed_relays"].(int)

	statsBuilder.WriteString(fmt.Sprintf("[violet]Connection Overview:[white]\n"))
	statsBuilder.WriteString(fmt.Sprintf("Connected Relays: [green]%d/%d[white]\n", connectedRelays, totalManagedRelays))

	// Retry queue stats
	if retryQueueSize, ok := stats["retry_queue_size"].(int); ok {
		statsBuilder.WriteString(fmt.Sprintf("Retry Queue: [yellow]%d[white] messages\n", retryQueueSize))
	}

	// Add timestamp
	statsBuilder.WriteString(fmt.Sprintf("\n[violet]Last Updated:[white] %s", time.Now().Format("15:04:05")))

	rcm.statsView.SetText(statsBuilder.String())
}

// updateRelayTable updates the relay information table
func (rcm *RelayConnectionsModal) updateRelayTable(stats map[string]interface{}) {
	relayHealth, ok := stats["relay_health"].(map[string]interface{})
	if !ok {
		return
	}

	// Clear existing rows (except header)
	rowCount := rcm.table.GetRowCount()
	for i := rowCount - 1; i > 0; i-- {
		rcm.table.RemoveRow(i)
	}

	// Add relay information
	rowIndex := 1
	for relayURL, healthData := range relayHealth {
		health, ok := healthData.(map[string]interface{})
		if !ok {
			continue
		}

		// Extract health information
		isConnected := health["connected"].(bool)
		successCount := health["success_count"].(int)
		failureCount := health["failure_count"].(int)
		consecutiveFails := health["consecutive_fails"].(int)
		lastConnected := health["last_connected"].(time.Time)

		// Determine status and color
		var statusText string
		var statusColor string
		switch {
		case isConnected:
			statusText = "Connected"
			statusColor = "[green]"
		case consecutiveFails > 3:
			statusText = "Failing"
			statusColor = "[red]"
		case consecutiveFails > 0:
			statusText = "Reconnecting"
			statusColor = "[yellow]"
		default:
			statusText = "Disconnected"
			statusColor = "[red]"
		}

		// Format last connected time
		var lastConnectedText string
		if !lastConnected.IsZero() {
			if time.Since(lastConnected) < 24*time.Hour {
				lastConnectedText = lastConnected.Format("15:04:05")
			} else {
				lastConnectedText = lastConnected.Format("Jan 02")
			}
		} else {
			lastConnectedText = "Never"
		}

		// Add table row with spacing
		rcm.table.SetCell(rowIndex, 0, tview.NewTableCell(relayURL).SetSelectable(false))
		rcm.table.SetCell(rowIndex, 1, tview.NewTableCell("  "+statusColor+statusText+"[white]").SetSelectable(false))
		rcm.table.SetCell(rowIndex, 2, tview.NewTableCell(fmt.Sprintf("    %d", successCount)).SetSelectable(false))
		rcm.table.SetCell(rowIndex, 3, tview.NewTableCell(fmt.Sprintf("    %d", failureCount)).SetSelectable(false))
		rcm.table.SetCell(rowIndex, 4, tview.NewTableCell("    "+lastConnectedText).SetSelectable(false))

		rowIndex++
	}

	// If no relays, show message
	if rowIndex == 1 {
		noRelaysCell := tview.NewTableCell("[yellow]No relays configured[white]")
		noRelaysCell.SetSelectable(false)
		rcm.table.SetCell(1, 0, noRelaysCell)
	}
}
