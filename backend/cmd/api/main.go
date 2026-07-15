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
	"github.com/kokusei/dashboard/backend/internal/handler"
	"github.com/kokusei/dashboard/backend/internal/repository/postgres"
	"github.com/kokusei/dashboard/backend/internal/service"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := pgxpool.New(ctx, required("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		log.Fatal(err)
	}

	indicators := service.NewIndicatorService(postgres.NewIndicatorRepository(db))
	updates := service.NewUpdateService(postgres.NewUpdateHistoryRepository(db))
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
