package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kokusei/dashboard/backend/internal/domain"
)

type IndicatorRepository struct{ db *pgxpool.Pool }

func NewIndicatorRepository(db *pgxpool.Pool) *IndicatorRepository {
	return &IndicatorRepository{db: db}
}

const indicatorSelect = `
SELECT i.slug, i.name, i.description, i.unit, i.category, i.source_name, i.source_url,
       latest.value::text, latest.period, latest.published_at::text, latest.fetched_at,
       latest.source_url, latest.data_origin, latest.estimate_kind,
       previous.value::text, previous.period, previous.published_at::text, previous.fetched_at,
       previous.source_url, previous.data_origin, previous.estimate_kind,
       (latest.value - previous.value)::text
FROM indicators i
JOIN LATERAL (
  SELECT value, period, published_at, fetched_at, source_url, data_origin, estimate_kind FROM indicator_values
  WHERE indicator_id = i.id
    AND data_origin = CASE WHEN EXISTS (SELECT 1 FROM indicator_values x WHERE x.indicator_id=i.id AND x.data_origin='official') THEN 'official' ELSE 'development' END
  ORDER BY
    CASE WHEN period ~ '^[0-9]{4}年[0-9]{1,2}月$'
      THEN substring(period from '^([0-9]{4})')::int * 100 + substring(period from '年([0-9]{1,2})月$')::int
    END DESC NULLS LAST,
    published_at DESC, id DESC LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
  SELECT value, period, published_at, fetched_at, source_url, data_origin, estimate_kind FROM indicator_values
  WHERE indicator_id = i.id
    AND data_origin = CASE WHEN EXISTS (SELECT 1 FROM indicator_values x WHERE x.indicator_id=i.id AND x.data_origin='official') THEN 'official' ELSE 'development' END
  ORDER BY
    CASE WHEN period ~ '^[0-9]{4}年[0-9]{1,2}月$'
      THEN substring(period from '^([0-9]{4})')::int * 100 + substring(period from '年([0-9]{1,2})月$')::int
    END DESC NULLS LAST,
    published_at DESC, id DESC OFFSET 1 LIMIT 1
) previous ON true`

type scanner interface{ Scan(...any) error }

func scanIndicator(row scanner) (domain.Indicator, error) {
	var i domain.Indicator
	var previousValue, previousPeriod, previousPublished, previousSource, previousOrigin, previousKind *string
	var previousFetched *time.Time
	err := row.Scan(&i.Slug, &i.Name, &i.Description, &i.Unit, &i.Category, &i.SourceName, &i.SourceURL,
		&i.Latest.Value, &i.Latest.Period, &i.Latest.PublishedAt, &i.Latest.FetchedAt,
		&i.Latest.SourceURL, &i.Latest.Origin, &i.Latest.EstimateKind,
		&previousValue, &previousPeriod, &previousPublished, &previousFetched,
		&previousSource, &previousOrigin, &previousKind, &i.Change)
	if err != nil {
		return i, err
	}
	if previousValue != nil {
		i.Previous = &domain.Value{Value: *previousValue, Period: *previousPeriod, PublishedAt: *previousPublished, FetchedAt: *previousFetched, SourceURL: *previousSource, Origin: *previousOrigin, EstimateKind: *previousKind}
	}
	i.SourceURL = i.Latest.SourceURL
	i.Development = i.Latest.Origin != "official"
	return i, nil
}

func (r *IndicatorRepository) List(ctx context.Context) ([]domain.Indicator, error) {
	rows, err := r.db.Query(ctx, indicatorSelect+` ORDER BY i.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.Indicator, 0)
	for rows.Next() {
		i, err := scanIndicator(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (r *IndicatorRepository) GetBySlug(ctx context.Context, slug string) (domain.Indicator, error) {
	i, err := scanIndicator(r.db.QueryRow(ctx, indicatorSelect+` WHERE i.slug = $1`, slug))
	if errors.Is(err, pgx.ErrNoRows) {
		return i, domain.ErrNotFound
	}
	if err != nil {
		return i, err
	}
	rows, err := r.db.Query(ctx, `SELECT value::text, period, published_at::text, fetched_at, v.source_url, data_origin, estimate_kind
FROM indicator_values v JOIN indicators i ON i.id=v.indicator_id
WHERE i.slug=$1 AND data_origin = CASE WHEN EXISTS (SELECT 1 FROM indicator_values x WHERE x.indicator_id=i.id AND x.data_origin='official') THEN 'official' ELSE 'development' END
ORDER BY
  CASE WHEN period ~ '^[0-9]{4}年[0-9]{1,2}月$'
    THEN substring(period from '^([0-9]{4})')::int * 100 + substring(period from '年([0-9]{1,2})月$')::int
  END ASC NULLS FIRST,
  published_at, v.id`, slug)
	if err != nil {
		return i, err
	}
	defer rows.Close()
	i.Series = make([]domain.Value, 0)
	for rows.Next() {
		var v domain.Value
		if err := rows.Scan(&v.Value, &v.Period, &v.PublishedAt, &v.FetchedAt, &v.SourceURL, &v.Origin, &v.EstimateKind); err != nil {
			return i, err
		}
		i.Series = append(i.Series, v)
	}
	return i, rows.Err()
}
