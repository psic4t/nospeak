package tui

import (
	"fmt"

	"github.com/data.haus/nospeak/config"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type ContactManagementDialog struct {
	form     *tview.Form
	config   *config.Config
	app      *tview.Application
	onClose  func()
}

func NewContactManagementDialog(app *tview.Application, config *config.Config, onClose func()) *ContactManagementDialog {
	form := tview.NewForm()
	form.SetBorder(true).SetTitle("[violet]Contact Management[white]")

	// Set form colors with proper focus highlighting using theme colors
	form.SetFieldBackgroundColor(FieldBackgroundColor)
	form.SetFieldTextColor(tcell.ColorWhite)
	form.SetButtonBackgroundColor(ButtonBackgroundColor)
	form.SetButtonTextColor(tcell.ColorWhite)
	form.SetBackgroundColor(tcell.ColorDefault)
	form.SetTitleColor(tcell.ColorWhite)

	cmd := &ContactManagementDialog{
		form:    form,
		config:  config,
		app:     app,
		onClose: onClose,
	}

	// Create partner list directly in the form
	partnersList := NewPartnersList(config.Partners)
	partnersList.SetBorder(true).SetTitle("Partners")
	partnersList.SetSelectedFunc(func(row, column int) {
		if column == 0 {
			partnersList.ToggleCheckbox(row)
		}
	})

	// Set up keyboard input capture for enhanced navigation
	partnersList.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyRune:
			if event.Rune() == ' ' {
				// Get currently selected row
				row, _ := partnersList.Table.GetSelection()
				if row >= 0 && row < len(config.Partners) {
					partnersList.ToggleCheckbox(row)
				}
				return nil // Consume the event
			}
			// Let other rune events pass through
		case tcell.KeyEnter:
			// Enter also toggles checkboxes
			row, _ := partnersList.Table.GetSelection()
			if row >= 0 && row < len(config.Partners) {
				partnersList.ToggleCheckbox(row)
			}
			return nil // Consume the event
		case tcell.KeyTab, tcell.KeyBacktab:
			// Let Tab/Shift+Tab pass through for form navigation
			// Don't consume these - let the form handle them
			return event
		}
		// Let all other keys pass through for table navigation (arrows, etc.)
		return event
	})

	// Add partner list to form
	form.AddFormItem(partnersList)

	// Add management buttons
	form.AddButton("[blue]Add Partner[white]", func() {
		cmd.showAddPartnerModal(partnersList)
	})

	form.AddButton("[red]Delete Selected[white]", func() {
		cmd.deleteSelectedPartners(partnersList)
	})

	form.AddButton("[green]Close[white]", func() {
		if cmd.onClose != nil {
			cmd.onClose()
		}
	})

	return cmd
}

func (cmd *ContactManagementDialog) Show() {
	// Show the form directly
	cmd.app.SetRoot(cmd.form, true)

	// Set initial focus on the partners list (first form item)
	if cmd.form.GetFormItemCount() > 0 {
		cmd.form.SetFocus(0)
	}
}

func (cmd *ContactManagementDialog) showAddPartnerModal(partnersList *PartnersList) {
	addModal := NewAddPartnerModal(func(npub string) {
		cmd.addPartner(npub, partnersList)
	})

	addModal.SetCancelFunc(func() {
		cmd.app.SetRoot(cmd.form, true)
		// Restore focus to partners list
		cmd.form.SetFocus(0)
	})

	addModal.Show(cmd.app)
}

func (cmd *ContactManagementDialog) addPartner(npub string, partnersList *PartnersList) {
	// Check if partner already exists
	for _, existing := range cmd.config.Partners {
		if existing == npub {
			// Show error message
			errorModal := tview.NewModal().
				SetText("[red]Partner already exists[white]").
				AddButtons([]string{"[green]OK[white]"}).
				SetDoneFunc(func(buttonIndex int, buttonLabel string) {
					cmd.app.SetRoot(cmd.form, true)
					// Restore focus to partners list
					cmd.form.SetFocus(0)
				})
			errorModal.SetBackgroundColor(tcell.ColorDefault)
			cmd.app.SetRoot(errorModal, true)
			return
		}
	}

	// Add partner to config
	cmd.config.Partners = append(cmd.config.Partners, npub)

	// Refresh partner list
	cmd.refreshPartnerList(partnersList)

	// Show success message
	successModal := tview.NewModal().
		SetText("[green]Partner added successfully[white]").
		AddButtons([]string{"[green]OK[white]"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			cmd.app.SetRoot(cmd.form, true)
			// Restore focus to partners list
			cmd.form.SetFocus(0)
		})
	successModal.SetBackgroundColor(tcell.ColorDefault)
	cmd.app.SetRoot(successModal, true)
}

func (cmd *ContactManagementDialog) deleteSelectedPartners(partnersList *PartnersList) {
	checkedPartners := partnersList.GetCheckedPartners()
	if len(checkedPartners) == 0 {
		infoModal := tview.NewModal().
			SetText("[yellow]No partners selected for deletion[white]").
			AddButtons([]string{"[green]OK[white]"}).
			SetDoneFunc(func(buttonIndex int, buttonLabel string) {
				cmd.app.SetRoot(cmd.form, true)
			})
		infoModal.SetBackgroundColor(tcell.ColorDefault)
		cmd.app.SetRoot(infoModal, true)
		return
	}

	// Remove checked partners from config
	var newPartners []string
	for _, partner := range cmd.config.Partners {
		shouldDelete := false
		for _, checked := range checkedPartners {
			if partner == checked {
				shouldDelete = true
				break
			}
		}
		if !shouldDelete {
			newPartners = append(newPartners, partner)
		}
	}

	// Update config
	cmd.config.Partners = newPartners

	// Refresh partner list
	cmd.refreshPartnerList(partnersList)

	// Show success message
	successModal := tview.NewModal().
		SetText(fmt.Sprintf("[green]Deleted %d partner(s)[white]", len(checkedPartners))).
		AddButtons([]string{"[green]OK[white]"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			cmd.app.SetRoot(cmd.form, true)
			// Restore focus to partners list
			cmd.form.SetFocus(0)
		})
	successModal.SetBackgroundColor(tcell.ColorDefault)
	cmd.app.SetRoot(successModal, true)
}

func (cmd *ContactManagementDialog) refreshPartnerList(partnersList *PartnersList) {
	// Create new partner list with updated config
	newPartnersList := NewPartnersList(cmd.config.Partners)
	newPartnersList.SetBorder(true).SetTitle("Partners")
	newPartnersList.SetSelectedFunc(func(row, column int) {
		if column == 0 {
			newPartnersList.ToggleCheckbox(row)
		}
	})

	// Set up keyboard input capture for enhanced navigation
	newPartnersList.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyRune:
			if event.Rune() == ' ' {
				// Get currently selected row
				row, _ := newPartnersList.Table.GetSelection()
				if row >= 0 && row < len(cmd.config.Partners) {
					newPartnersList.ToggleCheckbox(row)
				}
				return nil // Consume the event
			}
			// Let other rune events pass through
		case tcell.KeyEnter:
			// Enter also toggles checkboxes
			row, _ := newPartnersList.Table.GetSelection()
			if row >= 0 && row < len(cmd.config.Partners) {
				newPartnersList.ToggleCheckbox(row)
			}
			return nil // Consume the event
		case tcell.KeyTab, tcell.KeyBacktab:
			// Let Tab/Shift+Tab pass through for form navigation
			// Don't consume these - let the form handle them
			return event
		}
		// Let all other keys pass through for table navigation (arrows, etc.)
		return event
	})

	// Replace the partner list form item
	for i := 0; i < cmd.form.GetFormItemCount(); i++ {
		if item := cmd.form.GetFormItem(i); item != nil {
			if formItem, ok := item.(tview.FormItem); ok {
				if formItem.GetLabel() == "Partners" {
					cmd.form.RemoveFormItem(i)
					cmd.form.AddFormItem(newPartnersList)
					break
				}
			}
		}
	}
}

// tview.Primitive implementation for compatibility
func (cmd *ContactManagementDialog) Draw(screen tcell.Screen) {
	cmd.form.Draw(screen)
}

func (cmd *ContactManagementDialog) GetRect() (int, int, int, int) {
	return cmd.form.GetRect()
}

func (cmd *ContactManagementDialog) SetRect(x, y, width, height int) {
	cmd.form.SetRect(x, y, width, height)
}

func (cmd *ContactManagementDialog) InputHandler() func(event *tcell.EventKey, setFocus func(p tview.Primitive)) {
	return cmd.form.InputHandler()
}

func (cmd *ContactManagementDialog) Focus(delegate func(p tview.Primitive)) {
	cmd.form.Focus(delegate)
}

func (cmd *ContactManagementDialog) Blur() {
	cmd.form.Blur()
}

func (cmd *ContactManagementDialog) GetFocusable() tview.Primitive {
	return cmd.form
}

func (cmd *ContactManagementDialog) HasFocus() bool {
	return cmd.form.HasFocus()
}

func (cmd *ContactManagementDialog) MouseHandler() func(action tview.MouseAction, event *tcell.EventMouse, setFocus func(p tview.Primitive)) (consumed bool, capture tview.Primitive) {
	return cmd.form.MouseHandler()
}