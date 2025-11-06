package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type PartnersList struct {
	*tview.Table
	partners []string
	checked  map[int]bool
}

func NewPartnersList(partners []string) *PartnersList {
	table := tview.NewTable()
	pl := &PartnersList{
		Table:    table,
		partners: partners,
		checked:  make(map[int]bool),
	}

	pl.SetBorders(false)
	pl.SetSeparator('|')
	pl.refresh()

	return pl
}

func (pl *PartnersList) refresh() {
	pl.Clear()

	for i, partner := range pl.partners {
		checkbox := "[ ]"
		if pl.checked[i] {
			checkbox = "[✓]"
		}

		pl.SetCell(i, 0, tview.NewTableCell(checkbox))
		pl.SetCell(i, 1, tview.NewTableCell(partner))
	}
}

func (pl *PartnersList) ToggleCheckbox(row int) {
	if pl.checked[row] {
		delete(pl.checked, row)
	} else {
		pl.checked[row] = true
	}
	pl.refresh()
}

func (pl *PartnersList) GetCheckedPartners() []string {
	var checked []string
	for i := range pl.partners {
		if pl.checked[i] {
			checked = append(checked, pl.partners[i])
		}
	}
	return checked
}

// tview.FormItem interface implementation
func (pl *PartnersList) GetLabel() string {
	return "Partners"
}

func (pl *PartnersList) SetLabel(label string) tview.FormItem {
	// PartnersList doesn't use labels, but implement for interface compliance
	return pl
}

func (pl *PartnersList) GetFinishedFunc() func(key tcell.Key) {
	return nil // No finish function for partner list
}

func (pl *PartnersList) SetFinishedFunc(handler func(key tcell.Key)) tview.FormItem {
	// No finish function needed for partner list
	return pl
}

func (pl *PartnersList) SetAttributes(attributes tcell.AttrMask) tview.FormItem {
	// Table doesn't have SetAttributes, but implement for interface compliance
	return pl
}

func (pl *PartnersList) GetAttributes() tcell.AttrMask {
	return 0 // Return default attributes
}

func (pl *PartnersList) SetFormAttributes(index int, labelTextColor, fieldTextColor, fieldBgColor, buttonTextColor tcell.Color) tview.FormItem {
	// Set form colors for different states
	return pl
}

func (pl *PartnersList) GetFieldHeight() int {
	// Return a reasonable height for the partner list (minimum 3 rows + partners)
	height := len(pl.partners)
	if height < 3 {
		height = 3
	}
	return height
}

func (pl *PartnersList) SetFieldHeight(height int) tview.FormItem {
	// PartnersList doesn't use fixed height, but implement for interface compliance
	return pl
}

func (pl *PartnersList) GetDisabled() bool {
	// This should track actual disabled state, not focus
	return false
}

func (pl *PartnersList) SetDisabled(disabled bool) tview.FormItem {
	if disabled {
		pl.Table.Blur()
	}
	return pl
}

func (pl *PartnersList) GetFieldWidth() int {
	return 63 // Standard field width
}

func (pl *PartnersList) SetFieldWidth(width int) tview.FormItem {
	// PartnersList doesn't use fixed width, but implement for interface compliance
	return pl
}

func (pl *PartnersList) SetOffset(offset int) tview.FormItem {
	// PartnersList doesn't use offset, but implement for interface compliance
	return pl
}

func (pl *PartnersList) GetOffset() int {
	return 0
}

func (pl *PartnersList) SetEnteredText(text string) tview.FormItem {
	// PartnersList doesn't use text input, but implement for interface compliance
	return pl
}

func (pl *PartnersList) GetEnteredText() string {
	return ""
}

// GetFocusable returns the actual focusable component
func (pl *PartnersList) GetFocusable() tview.Primitive {
	return pl.Table
}

// InputHandler provides keyboard navigation for the partners list
func (pl *PartnersList) InputHandler() func(event *tcell.EventKey, setFocus func(p tview.Primitive)) {
	return func(event *tcell.EventKey, setFocus func(p tview.Primitive)) {
		// Handle Tab navigation for form cycling
		if event.Key() == tcell.KeyTab {
			// Let the form handle Tab navigation
			return
		}
		if event.Key() == tcell.KeyBacktab {
			// Let the form handle Shift+Tab navigation
			return
		}

		// Use the table's input handler for other keys
		handler := pl.Table.InputHandler()
		if handler != nil {
			handler(event, setFocus)
		}
	}
}

// SetInputCapture allows capturing keyboard events for custom handling
func (pl *PartnersList) SetInputCapture(capture func(event *tcell.EventKey) *tcell.EventKey) *PartnersList {
	pl.Table.SetInputCapture(capture)
	return pl
}

// Focus delegates focus to the table
func (pl *PartnersList) Focus(delegate func(p tview.Primitive)) {
	delegate(pl.Table)
}

// Blur removes focus from the table
func (pl *PartnersList) Blur() {
	pl.Table.Blur()
}

// HasFocus returns true if the table has focus
func (pl *PartnersList) HasFocus() bool {
	return pl.Table.HasFocus()
}

