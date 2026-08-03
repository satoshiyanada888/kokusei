package handler

import (
	"context"
	"encoding/json"
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

type contractIndicators struct{ items []domain.Indicator }

func (r contractIndicators) List(context.Context) ([]domain.Indicator, error) { return r.items, nil }
func (r contractIndicators) GetBySlug(_ context.Context, slug string) (domain.Indicator, error) {
	for _, item := range r.items {
		if item.Slug == slug {
			return item, nil
		}
	}
	return domain.Indicator{}, domain.ErrNotFound
}

func TestOfficialIndicatorAPIContractKeepsNumericStringsAndMetadata(t *testing.T) {
	for _, slug := range []string{"population", "births", "unemployment-rate"} {
		value := domain.Value{
			Value: "12316.536000", Period: "2025年12月", PublishedAt: "2026-01-01",
			SourceURL: "https://example.go.jp/data", Origin: "official", EstimateKind: "final",
		}
		item := domain.Indicator{
			Slug: slug, Name: slug, Unit: "万人", SourceName: "公式", SourceURL: value.SourceURL,
			Latest: value, Series: []domain.Value{value},
		}
		handler := New(
			service.NewIndicatorService(contractIndicators{items: []domain.Indicator{item}}),
			service.NewUpdateService(emptyUpdates{}),
		).Routes("")
		request := httptest.NewRequest(http.MethodGet, "/api/indicators/"+slug, nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s status=%d", slug, response.Code)
		}
		var payload struct {
			Data domain.Indicator `json:"data"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Data.Latest.Value != "12316.536000" || len(payload.Data.Series) != 1 ||
			payload.Data.SourceName == "" || payload.Data.Unit == "" {
			t.Fatalf("%s payload=%#v", slug, payload.Data)
		}
	}
}
