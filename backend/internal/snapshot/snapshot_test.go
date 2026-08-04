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

func TestMergeRevisionHistoryRecordsOnlySamePeriodChanges(t *testing.T) {
	previousAt := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	currentAt := previousAt.Add(24 * time.Hour)
	previous, err := Build(context.Background(), strings.Repeat("a", 40), previousAt, testProviders(previousAt)...)
	if err != nil {
		t.Fatal(err)
	}

	providers := testProviders(currentAt)
	births := providers[1].(fakeProvider).values[0]
	births.Value = "68.7000"
	providers[1] = fakeProvider{values: []domain.FetchedIndicatorValue{births}}
	population := providers[0].(fakeProvider).values[0]
	newPopulation := population
	newPopulation.Period = "2026年1月"
	newPopulation.Value = "12310.000000"
	providers[0] = fakeProvider{values: []domain.FetchedIndicatorValue{population, newPopulation}}

	current, err := Build(context.Background(), strings.Repeat("b", 40), currentAt, providers...)
	if err != nil {
		t.Fatal(err)
	}
	merged, err := MergeRevisionHistory(current, &previous)
	if err != nil {
		t.Fatal(err)
	}
	if len(merged.Updates) != 1 {
		t.Fatalf("updates=%#v", merged.Updates)
	}
	update := merged.Updates[0]
	if update.ID != 1 || update.IndicatorSlug != "births" || update.Period != "2024年" ||
		update.PreviousValue == nil || *update.PreviousValue != "68.6173" || update.CurrentValue != "68.7000" {
		t.Fatalf("update=%#v", update)
	}
}

func TestMergeRevisionHistoryTreatsEquivalentDecimalsAsEqualAndPreservesHistory(t *testing.T) {
	at := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	previous, err := Build(context.Background(), strings.Repeat("a", 40), at, testProviders(at)...)
	if err != nil {
		t.Fatal(err)
	}
	oldValue := "2.4"
	previous.Updates = []domain.UpdateHistory{{
		ID: 7, IndicatorSlug: "unemployment-rate", IndicatorName: "完全失業率", Unit: "%",
		PreviousValue: &oldValue, CurrentValue: "2.5", Period: "2025年", DetectedAt: at,
		SourceName: "総務省統計局", SourceURL: "https://example.go.jp/data",
	}}

	providers := testProviders(at.Add(time.Hour))
	population := providers[0].(fakeProvider).values[0]
	population.Value = "12316.536"
	providers[0] = fakeProvider{values: []domain.FetchedIndicatorValue{population}}
	current, err := Build(context.Background(), strings.Repeat("b", 40), at.Add(time.Hour), providers...)
	if err != nil {
		t.Fatal(err)
	}
	merged, err := MergeRevisionHistory(current, &previous)
	if err != nil {
		t.Fatal(err)
	}
	if len(merged.Updates) != 1 || merged.Updates[0].ID != 7 {
		t.Fatalf("updates=%#v", merged.Updates)
	}
}

func TestMergeRevisionHistoryFailsWhenPreviouslyPublishedPeriodDisappears(t *testing.T) {
	at := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	previousProviders := testProviders(at)
	population := previousProviders[0].(fakeProvider).values[0]
	olderPopulation := population
	olderPopulation.Period = "2025年11月"
	previousProviders[0] = fakeProvider{values: []domain.FetchedIndicatorValue{olderPopulation, population}}
	previous, err := Build(context.Background(), strings.Repeat("a", 40), at, previousProviders...)
	if err != nil {
		t.Fatal(err)
	}
	current, err := Build(context.Background(), strings.Repeat("b", 40), at.Add(time.Hour), testProviders(at.Add(time.Hour))...)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := MergeRevisionHistory(current, &previous); err == nil || !strings.Contains(err.Error(), "missing previously published period") {
		t.Fatalf("err=%v", err)
	}
}

func TestMergeRevisionHistoryWithoutPreviousSnapshotIsAnInitialPublish(t *testing.T) {
	at := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	current, err := Build(context.Background(), strings.Repeat("a", 40), at, testProviders(at)...)
	if err != nil {
		t.Fatal(err)
	}
	merged, err := MergeRevisionHistory(current, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(merged.Updates) != 0 {
		t.Fatalf("updates=%#v", merged.Updates)
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
