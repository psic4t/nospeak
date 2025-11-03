package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

var (
	MessageSentColor        = tcell.ColorOrange
	MessageReceivedColor    = tcell.ColorGreen
	StatusConnectedColor    = tcell.ColorGreen
	StatusDisconnectedColor = tcell.ColorRed
	StatusConnectingColor   = tcell.ColorYellow
	TimeColor               = tcell.ColorBlue
)

// Form focus colors
var (
	FieldFocusColor       = tcell.ColorBlue
	FieldBackgroundColor  = tcell.ColorBlack
	ButtonFocusColor      = tcell.ColorBlue
	ButtonBackgroundColor = tcell.ColorBlack
)

func GetTheme() tview.Theme {
	return tview.Theme{
		PrimitiveBackgroundColor:    tcell.ColorDefault,
		ContrastBackgroundColor:     tcell.ColorDefault,
		MoreContrastBackgroundColor: tcell.ColorGreen,
		BorderColor:                 tcell.ColorWhite,
		TitleColor:                  tcell.ColorWhite,
		GraphicsColor:               tcell.ColorWhite,
		PrimaryTextColor:            tcell.ColorWhite,
		SecondaryTextColor:          tcell.ColorGray,
		TertiaryTextColor:           tcell.ColorWhite,
		InverseTextColor:            tcell.ColorWhite,
		ContrastSecondaryTextColor:  tcell.ColorDarkGray,
	}
}
