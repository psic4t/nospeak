package tui

import (
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

var (
	MessageSentColor        = tcell.ColorYellow
	MessageReceivedColor    = tcell.ColorGreen
	StatusConnectedColor    = tcell.ColorGreen
	StatusDisconnectedColor = tcell.ColorRed
	StatusConnectingColor   = tcell.ColorYellow
)

func GetTheme() tview.Theme {
	return tview.Theme{
		PrimitiveBackgroundColor:    tcell.ColorDefault,
		ContrastBackgroundColor:     tcell.ColorBlue,
		MoreContrastBackgroundColor: tcell.ColorGreen,
		BorderColor:                 tcell.ColorWhite,
		TitleColor:                  tcell.ColorWhite,
		GraphicsColor:               tcell.ColorWhite,
		PrimaryTextColor:            tcell.ColorDefault,
		SecondaryTextColor:          tcell.ColorGray,
		TertiaryTextColor:           tcell.ColorWhite,
		InverseTextColor:            tcell.ColorWhite,
		ContrastSecondaryTextColor:  tcell.ColorDarkGray,
	}
}
