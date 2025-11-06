package tui

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAddPartnerModalValidNpub(t *testing.T) {
	modal := NewAddPartnerModal(func(npub string) {
		assert.Equal(t, "npub1test...", npub)
	})

	assert.NotNil(t, modal)
}

func TestNpubValidation(t *testing.T) {
	tests := []struct {
		name     string
		npub     string
		expected bool
	}{
		{"Valid npub", "npub1acdefghjklmnpqrstuvwxyzacdefghjklmnpqrstuvwxyzacdefghjklmn", true},
		{"Too short", "npub1short", false},
		{"Wrong prefix", "nsec1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3zqvcxv", false},
		{"Empty string", "", false},
		{"Correct length but wrong format", "notanpub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3zqvcxv", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modal := NewAddPartnerModal(func(npub string) {})
			result := modal.validateNpub(tt.npub)
			assert.Equal(t, tt.expected, result)
		})
	}
}