package provider

import (
	"context"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

// SeedProvider documents the MVP's replaceable import boundary. A future e-Stat
// provider can implement the same interface without changing repositories or HTTP handlers.
type SeedProvider struct{}

func (SeedProvider) Fetch(context.Context) ([]domain.Indicator, error) {
	return []domain.Indicator{}, nil
}
