package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kokusei/dashboard/backend/internal/domain"
	"github.com/kokusei/dashboard/backend/internal/service"
)

type emptyIndicators struct{}

func (emptyIndicators) List(context.Context) ([]domain.Indicator, error) {
	return []domain.Indicator{}, nil
}
func (emptyIndicators) GetBySlug(context.Context, string) (domain.Indicator, error) {
	return domain.Indicator{}, domain.ErrNotFound
}

type emptyUpdates struct{}

func (emptyUpdates) List(context.Context) ([]domain.UpdateHistory, error) {
	return []domain.UpdateHistory{}, nil
}

func testHandler() http.Handler {
	return New(service.NewIndicatorService(emptyIndicators{}), service.NewUpdateService(emptyUpdates{})).Routes("")
}

func TestHealth(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	testHandler().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestIndicatorNotFound(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/api/indicators/not-found", nil)
	w := httptest.NewRecorder()
	testHandler().ServeHTTP(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d", w.Code)
	}
}
