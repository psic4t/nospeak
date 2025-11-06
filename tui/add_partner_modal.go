package tui

import (
	"strings"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type AddPartnerModal struct {
	form       *tview.Form
	onAdd      func(string)
	cancelFunc func()
}

func NewAddPartnerModal(onAdd func(string)) *AddPartnerModal {
	form := tview.NewForm()
	form.SetBorder(true).SetTitle("[violet]Add New Partner[white]")

	// Set form colors with proper focus highlighting using theme colors
	form.SetFieldBackgroundColor(FieldBackgroundColor)
	form.SetFieldTextColor(tcell.ColorWhite)
	form.SetButtonBackgroundColor(ButtonBackgroundColor)
	form.SetButtonTextColor(tcell.ColorWhite)
	form.SetBackgroundColor(tcell.ColorDefault)
	form.SetTitleColor(tcell.ColorWhite)

	apm := &AddPartnerModal{
		form:  form,
		onAdd: onAdd,
	}

	form.AddInputField("[green]Partner Npub:[white]", "", 63, nil, nil)

	form.AddButton("[green]Add[white]", func() {
		npub := form.GetFormItem(0).(*tview.InputField).GetText()
		if apm.validateNpub(npub) {
			onAdd(npub)
			if apm.cancelFunc != nil {
				apm.cancelFunc()
			}
		} else {
			// Show error by changing title temporarily
			form.SetTitle("[red]Invalid npub format. Must be 63 characters starting with 'npub1'[white]")
			// Reset title after a moment (in real implementation, you'd use a timer)
		}
	})

	form.AddButton("[red]Cancel[white]", func() {
		if apm.cancelFunc != nil {
			apm.cancelFunc()
		}
	})

	return apm
}

func (apm *AddPartnerModal) validateNpub(npub string) bool {
	npub = strings.TrimSpace(npub)

	// Check basic format
	if !strings.HasPrefix(npub, "npub1") {
		return false
	}

	// Check exact length (npub1 + 62 characters = 63 total)
	if len(npub) != 63 {
		return false
	}

	// Basic character validation (bech32 characters - no '1' or 'b' or 'i' or 'o')
	validChars := "023456789acdefghjklmnpqrstuvwxyz"
	for _, char := range npub[5:] {  // Skip "npub1"
		if !strings.ContainsRune(validChars, char) {
			return false
		}
	}

	return true
}

func (apm *AddPartnerModal) SetCancelFunc(cancelFunc func()) {
	apm.cancelFunc = cancelFunc
}

func (apm *AddPartnerModal) Show(app *tview.Application) {
	apm.form.SetTitle("[violet]Add New Partner[white]")
	app.SetRoot(apm.form, true)
}