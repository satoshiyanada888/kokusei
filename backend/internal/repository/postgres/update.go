package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kokusei/dashboard/backend/internal/domain"
)

type UpdateHistoryRepository struct{ db *pgxpool.Pool }

func NewUpdateHistoryRepository(db *pgxpool.Pool) *UpdateHistoryRepository {
	return &UpdateHistoryRepository{db: db}
}

func (r *UpdateHistoryRepository) List(ctx context.Context) ([]domain.UpdateHistory, error) {
	rows, err := r.db.Query(ctx, `
SELECT u.id, i.slug, i.name, i.unit, u.previous_value::text, u.current_value::text,
       u.period, u.detected_at, i.source_name, i.source_url
FROM update_histories u JOIN indicators i ON i.id = u.indicator_id
ORDER BY u.detected_at DESC, u.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.UpdateHistory, 0)
	for rows.Next() {
		var u domain.UpdateHistory
		if err := rows.Scan(&u.ID, &u.IndicatorSlug, &u.IndicatorName, &u.Unit, &u.PreviousValue, &u.CurrentValue, &u.Period, &u.DetectedAt, &u.SourceName, &u.SourceURL); err != nil {
			return nil, err
		}
		items = append(items, u)
	}
	return items, rows.Err()
}
