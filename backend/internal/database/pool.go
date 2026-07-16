package database

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool parses DATABASE_URL and optionally overrides its password from a
// separate secret environment variable.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	if password := os.Getenv("DATABASE_PASSWORD"); password != "" {
		config.ConnConfig.Password = password
	}
	if config.ConnConfig.ConnectTimeout == 0 {
		config.ConnConfig.ConnectTimeout = 10 * time.Second
	}
	if _, configured := config.ConnConfig.RuntimeParams["statement_timeout"]; !configured {
		config.ConnConfig.RuntimeParams["statement_timeout"] = "10s"
	}
	if raw := os.Getenv("DATABASE_POOL_MAX_CONNS"); raw != "" {
		maximum, err := strconv.ParseInt(raw, 10, 32)
		if err != nil || maximum < 1 || maximum > 50 {
			return nil, fmt.Errorf("DATABASE_POOL_MAX_CONNS must be between 1 and 50")
		}
		config.MaxConns = int32(maximum)
	}
	return pgxpool.NewWithConfig(ctx, config)
}
