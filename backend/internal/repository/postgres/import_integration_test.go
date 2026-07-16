//go:build integration

package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kokusei/dashboard/backend/internal/domain"
)

func TestUpsertFetchedIntegration(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("kokusei_test_%d", time.Now().UnixNano())
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	if _, err := admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`)
	config.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `
CREATE TABLE indicators (id BIGSERIAL PRIMARY KEY, slug TEXT UNIQUE, source_name TEXT, source_url TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE indicator_values (id BIGSERIAL PRIMARY KEY, indicator_id BIGINT REFERENCES indicators(id), value NUMERIC(24,6), period TEXT, published_at DATE, fetched_at TIMESTAMPTZ, data_origin TEXT, source_url TEXT, external_id TEXT, estimate_kind TEXT, UNIQUE(indicator_id,period));
CREATE TABLE update_histories (id BIGSERIAL PRIMARY KEY, indicator_id BIGINT REFERENCES indicators(id), previous_value NUMERIC(24,6), current_value NUMERIC(24,6), period TEXT, detected_at TIMESTAMPTZ, data_origin TEXT, source_url TEXT);
INSERT INTO indicators(slug,source_url) VALUES('population','https://www.stat.go.jp/data/jinsui/');`)
	if err != nil {
		t.Fatal(err)
	}
	repository := NewIndicatorValueRepository(db)
	base := domain.FetchedIndicatorValue{IndicatorSlug: "population", Value: "12316.5", Period: "2025年12月", PublishedAt: time.Date(2026, 1, 20, 0, 0, 0, 0, time.UTC), FetchedAt: time.Now().UTC(), SourceName: "総務省統計局", SourceURL: "https://www.e-stat.go.jp/test", ExternalID: "table:2025-12", EstimateKind: "final"}
	rollbackFirst := base
	rollbackFirst.Period = "2025年9月"
	rollbackFirst.ExternalID = "table:2025-09"
	rollbackSecond := base
	rollbackSecond.Value = "999999999999999999999999999999"
	rollbackSecond.Period = "2025年10月"
	rollbackSecond.ExternalID = "table:2025-10"
	if _, err := repository.UpsertFetched(ctx, []domain.FetchedIndicatorValue{rollbackFirst, rollbackSecond}); err == nil {
		t.Fatal("expected numeric overflow to roll back the import")
	}
	var rolledBackValues int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM indicator_values`).Scan(&rolledBackValues); err != nil {
		t.Fatal(err)
	}
	if rolledBackValues != 0 {
		t.Fatalf("failed import left %d value rows", rolledBackValues)
	}
	previousPeriod := base
	previousPeriod.Value = "12320.0"
	previousPeriod.Period = "2025年11月"
	previousPeriod.PublishedAt = time.Date(2025, 12, 20, 0, 0, 0, 0, time.UTC)
	previousPeriod.ExternalID = "table:2025-11"
	changed, err := repository.UpsertFetched(ctx, []domain.FetchedIndicatorValue{previousPeriod, base})
	if err != nil || changed != 2 {
		t.Fatalf("first: changed=%d err=%v", changed, err)
	}
	var initialHistories int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM update_histories`).Scan(&initialHistories); err != nil {
		t.Fatal(err)
	}
	if initialHistories != 0 {
		t.Fatalf("initial import created %d histories", initialHistories)
	}
	changed, err = repository.UpsertFetched(ctx, []domain.FetchedIndicatorValue{base})
	if err != nil || changed != 0 {
		t.Fatalf("repeat: changed=%d err=%v", changed, err)
	}
	base.Value = "12316.4"
	changed, err = repository.UpsertFetched(ctx, []domain.FetchedIndicatorValue{base})
	if err != nil || changed != 1 {
		t.Fatalf("revision: changed=%d err=%v", changed, err)
	}
	var values, histories int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM indicator_values`).Scan(&values); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM update_histories`).Scan(&histories); err != nil {
		t.Fatal(err)
	}
	if values != 2 || histories != 1 {
		t.Fatalf("values=%d histories=%d", values, histories)
	}
}
