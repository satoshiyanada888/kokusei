package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kokusei/dashboard/backend/internal/database"
	"github.com/kokusei/dashboard/backend/internal/domain"
	"github.com/kokusei/dashboard/backend/internal/handler"
	"github.com/kokusei/dashboard/backend/internal/repository/postgres"
	snapshotrepository "github.com/kokusei/dashboard/backend/internal/repository/snapshot"
	"github.com/kokusei/dashboard/backend/internal/service"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	indicatorRepository, updateRepository, closeDataStore, err := repositories(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer closeDataStore()
	indicators := service.NewIndicatorService(indicatorRepository)
	updates := service.NewUpdateService(updateRepository)
	server := &http.Server{
		Addr: ":" + env("PORT", "8080"), Handler: handler.New(indicators, updates).Routes(os.Getenv("ALLOWED_ORIGIN")),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Printf("API listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func repositories(ctx context.Context) (domain.IndicatorRepository, domain.UpdateHistoryRepository, func(), error) {
	switch env("DATA_STORE", "postgres") {
	case "postgres":
		databaseURL := os.Getenv("DATABASE_URL")
		if databaseURL == "" {
			return nil, nil, func() {}, errors.New("DATABASE_URL is required for DATA_STORE=postgres")
		}
		db, err := database.NewPool(ctx, databaseURL)
		if err != nil {
			return nil, nil, func() {}, err
		}
		if err := pingDatabase(ctx, db); err != nil {
			db.Close()
			return nil, nil, func() {}, err
		}
		return postgres.NewIndicatorRepository(db), postgres.NewUpdateHistoryRepository(db), db.Close, nil
	case "file":
		path := os.Getenv("DATA_FILE_PATH")
		if path == "" {
			return nil, nil, func() {}, errors.New("DATA_FILE_PATH is required for DATA_STORE=file")
		}
		repository := snapshotrepository.NewFile(path)
		return repository, snapshotrepository.NewUpdateRepository(repository), func() {}, nil
	case "blob":
		account := os.Getenv("AZURE_STORAGE_ACCOUNT_NAME")
		container := os.Getenv("AZURE_STORAGE_CONTAINER_NAME")
		source, err := snapshotrepository.NewBlobSource(account, container)
		if err != nil {
			return nil, nil, func() {}, err
		}
		repository := snapshotrepository.New(source, env("AZURE_STORAGE_CURRENT_BLOB", "current.json"))
		return repository, snapshotrepository.NewUpdateRepository(repository), func() {}, nil
	default:
		return nil, nil, func() {}, errors.New("DATA_STORE must be postgres, blob, or file")
	}
}

type databasePinger interface {
	Ping(context.Context) error
}

func pingDatabase(ctx context.Context, db databasePinger) error {
	var err error
	for attempt := 1; attempt <= 6; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err = db.Ping(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		if attempt < 6 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(2 * time.Second):
			}
		}
	}
	return err
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func required(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s is required", key)
	}
	return value
}
