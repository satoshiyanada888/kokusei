package snapshot

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

type fakeProvider struct {
	values []domain.FetchedIndicatorValue
}

func (p fakeProvider) Fetch(context.Context) ([]domain.FetchedIndicatorValue, error) {
	return append([]domain.FetchedIndicatorValue(nil), p.values...), nil
}

func TestBuildPreservesOfficialNumericStringsAndIsDeterministic(t *testing.T) {
	generatedAt := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	providers := testProviders(generatedAt)
	first, err := Build(context.Background(), strings.Repeat("a", 40), generatedAt, providers...)
	if err != nil {
		t.Fatal(err)
	}
	second, err := Build(context.Background(), strings.Repeat("a", 40), generatedAt, testProviders(generatedAt)...)
	if err != nil {
		t.Fatal(err)
	}
	firstJSON, _ := Marshal(first)
	secondJSON, _ := Marshal(second)
	if string(firstJSON) != string(secondJSON) {
		t.Fatal("same normalized input did not produce deterministic JSON")
	}
	if len(first.Indicators) != 3 || first.Indicators[0].Latest.Value != "12316.536000" {
		t.Fatalf("snapshot values=%#v", first.Indicators)
	}
	if strings.Contains(string(firstJSON), "test-secret") {
		t.Fatal("snapshot contains secret input")
	}
	var decoded map[string]any
	if err := json.Unmarshal(firstJSON, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["sourceCommitSha"] != strings.Repeat("a", 40) {
		t.Fatalf("sourceCommitSha=%v", decoded["sourceCommitSha"])
	}
}

func TestBuildRejectsMissingAndDuplicateData(t *testing.T) {
	generatedAt := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	providers := testProviders(generatedAt)
	providers[0] = fakeProvider{}
	if _, err := Build(context.Background(), strings.Repeat("b", 40), generatedAt, providers...); err == nil {
		t.Fatal("missing indicator data was accepted")
	}

	providers = testProviders(generatedAt)
	duplicate := providers[0].(fakeProvider).values[0]
	providers[0] = fakeProvider{values: []domain.FetchedIndicatorValue{duplicate, duplicate}}
	if _, err := Build(context.Background(), strings.Repeat("b", 40), generatedAt, providers...); err == nil {
		t.Fatal("duplicate period was accepted")
	}
}

func testProviders(at time.Time) []domain.IndicatorDataProvider {
	value := func(slug, number, period, source string) domain.FetchedIndicatorValue {
		return domain.FetchedIndicatorValue{
			IndicatorSlug: slug, Value: number, Period: period,
			PublishedAt: at.Add(-24 * time.Hour), FetchedAt: at, SourceName: source,
			SourceURL: "https://example.go.jp/data", ExternalID: slug + ":" + period, EstimateKind: "final",
		}
	}
	return []domain.IndicatorDataProvider{
		fakeProvider{values: []domain.FetchedIndicatorValue{value("population", "12316.536000", "2025年12月", "総務省統計局")}},
		fakeProvider{values: []domain.FetchedIndicatorValue{value("births", "68.6173", "2024年", "厚生労働省")}},
		fakeProvider{values: []domain.FetchedIndicatorValue{value("unemployment-rate", "2.5", "2025年", "総務省統計局")}},
	}
}
