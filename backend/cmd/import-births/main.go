package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/kokusei/dashboard/backend/internal/database"
	"github.com/kokusei/dashboard/backend/internal/provider"
	"github.com/kokusei/dashboard/backend/internal/repository/postgres"
	"github.com/kokusei/dashboard/backend/internal/service"
)

func main() {
	ctx := context.Background()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	db, err := database.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		log.Fatal(err)
	}
	client := &http.Client{Timeout: 45 * time.Second}
	importer := service.NewImportService(
		provider.NewEStatBirthsProvider(client, os.Getenv("ESTAT_APP_ID")),
		postgres.NewIndicatorValueRepository(db),
	)
	changed, err := importer.Import(ctx)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("official births import completed: changed=%d importer_version=%s", changed, importerVersion())
}

func importerVersion() string {
	if version := os.Getenv("IMPORTER_VERSION"); version != "" {
		return version
	}
	return "local"
}
