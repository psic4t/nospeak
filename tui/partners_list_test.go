package tui

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPartnersListCreation(t *testing.T) {
	partners := []string{
		"npub1test123...",
		"npub1test456...",
	}

	list := NewPartnersList(partners)
	assert.NotNil(t, list)
	assert.Equal(t, 2, list.GetRowCount())
}