package service

import (
	"context"
	"errors"
	"testing"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

type fakeIndicators struct{ items []domain.Indicator }

func (f fakeIndicators) List(context.Context) ([]domain.Indicator, error) { return f.items, nil }
func (f fakeIndicators) GetBySlug(_ context.Context, slug string) (domain.Indicator, error) {
	for _, item := range f.items {
		if item.Slug == slug {
			return item, nil
		}
	}
	return domain.Indicator{}, domain.ErrNotFound
}

func TestListEmpty(t *testing.T) {
	items, err := NewIndicatorService(fakeIndicators{}).List(context.Background())
	if err != nil || len(items) != 0 {
		t.Fatalf("got %v, %v", items, err)
	}
}

func TestGetInvalidAndMissingSlug(t *testing.T) {
	svc := NewIndicatorService(fakeIndicators{})
	for _, slug := range []string{"../secret", "missing"} {
		_, err := svc.Get(context.Background(), slug)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("slug %q: got %v", slug, err)
		}
	}
}

func TestGetIndicator(t *testing.T) {
	svc := NewIndicatorService(fakeIndicators{items: []domain.Indicator{{Slug: "population", Name: "総人口"}}})
	item, err := svc.Get(context.Background(), "population")
	if err != nil || item.Name != "総人口" {
		t.Fatalf("got %#v, %v", item, err)
	}
}
