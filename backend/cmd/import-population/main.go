package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kokusei/dashboard/backend/internal/provider"
	"github.com/kokusei/dashboard/backend/internal/repository/postgres"
	"github.com/kokusei/dashboard/backend/internal/service"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	client := &http.Client{Timeout: 30 * time.Second}
	statInfID := os.Getenv("ESTAT_POPULATION_STAT_INF_ID")
	publishedAt := os.Getenv("ESTAT_POPULATION_PUBLISHED_AT")
	importer := service.NewImportService(provider.NewEStatPopulationProvider(client, statInfID, publishedAt), postgres.NewIndicatorValueRepository(db))
	changed, err := importer.Import(ctx)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("population import completed: %d value(s) changed", changed)
}
