package postgres

import (
	"context"
	"fmt"
	"net/url"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kokusei/dashboard/backend/internal/domain"
)

type IndicatorValueRepository struct{ db *pgxpool.Pool }

func NewIndicatorValueRepository(db *pgxpool.Pool) *IndicatorValueRepository {
	return &IndicatorValueRepository{db: db}
}

func (r *IndicatorValueRepository) UpsertFetched(ctx context.Context, values []domain.FetchedIndicatorValue) (int, error) {
	if len(values) == 0 {
		return 0, nil
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	slug := values[0].IndicatorSlug
	if slug == "" {
		return 0, fmt.Errorf("indicator slug is required")
	}
	for _, value := range values {
		sourceURL, err := url.Parse(value.SourceURL)
		if value.IndicatorSlug != slug || value.SourceName == "" || value.ExternalID == "" || value.Period == "" || value.EstimateKind == "" || err != nil || sourceURL.Scheme != "https" || sourceURL.Host == "" {
			return 0, fmt.Errorf("invalid fetched indicator metadata")
		}
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, slug); err != nil {
		return 0, fmt.Errorf("lock indicator import: %w", err)
	}
	changed := 0
	for _, value := range values {
		var indicatorID int64
		if err := tx.QueryRow(ctx, `SELECT id FROM indicators WHERE slug=$1`, value.IndicatorSlug).Scan(&indicatorID); err != nil {
			return 0, fmt.Errorf("find indicator: %w", err)
		}

		var existingID int64
		var existingValue string
		err := tx.QueryRow(ctx, `SELECT id, value::text FROM indicator_values WHERE indicator_id=$1 AND period=$2 FOR UPDATE`, indicatorID, value.Period).Scan(&existingID, &existingValue)
		if err == nil {
			var equal bool
			if err := tx.QueryRow(ctx, `SELECT $1::numeric = $2::numeric`, existingValue, value.Value).Scan(&equal); err != nil {
				return 0, err
			}
			if equal {
				continue
			}
			if _, err := tx.Exec(ctx, `UPDATE indicator_values SET value=$1::numeric, published_at=$2, fetched_at=$3, data_origin='official', source_url=$4, external_id=$5, estimate_kind=$6 WHERE id=$7`, value.Value, value.PublishedAt, value.FetchedAt, value.SourceURL, value.ExternalID, value.EstimateKind, existingID); err != nil {
				return 0, err
			}
			if err := insertHistory(ctx, tx, indicatorID, existingValue, value); err != nil {
				return 0, err
			}
			changed++
			continue
		}
		if err != pgx.ErrNoRows {
			return 0, err
		}

		if _, err := tx.Exec(ctx, `INSERT INTO indicator_values (indicator_id,value,period,published_at,fetched_at,data_origin,source_url,external_id,estimate_kind) VALUES ($1,$2::numeric,$3,$4,$5,'official',$6,$7,$8)`, indicatorID, value.Value, value.Period, value.PublishedAt, value.FetchedAt, value.SourceURL, value.ExternalID, value.EstimateKind); err != nil {
			return 0, err
		}
		changed++
	}
	if _, err := tx.Exec(ctx, `UPDATE indicators SET source_name=$1, source_url=$2, updated_at=NOW() WHERE slug=$3`, values[len(values)-1].SourceName, values[len(values)-1].SourceURL, slug); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return changed, nil
}

func insertHistory(ctx context.Context, tx pgx.Tx, indicatorID int64, previous string, value domain.FetchedIndicatorValue) error {
	_, err := tx.Exec(ctx, `INSERT INTO update_histories (indicator_id,previous_value,current_value,period,detected_at,data_origin,source_url) VALUES ($1,$2::numeric,$3::numeric,$4,$5,'official',$6)`, indicatorID, previous, value.Value, value.Period, value.FetchedAt, value.SourceURL)
	return err
}
