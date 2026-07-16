package database

import (
	"context"
	"testing"
	"time"
)

func TestNewPoolInjectsSeparatePassword(t *testing.T) {
	t.Setenv("DATABASE_PASSWORD", "not-logged-secret")
	pool, err := NewPool(context.Background(), "postgres://app@localhost:5432/kokusei?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if got := pool.Config().ConnConfig.Password; got != "not-logged-secret" {
		t.Fatal("DATABASE_PASSWORD was not applied")
	}
}

func TestNewPoolAcceptsNeonConnectionOptions(t *testing.T) {
	t.Setenv("DATABASE_POOL_MAX_CONNS", "5")
	pool, err := NewPool(context.Background(), "postgresql://app:secret@ep-example-pooler.ap-southeast-1.aws.neon.tech/kokusei?sslmode=require&channel_binding=require")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if pool.Config().MaxConns != 5 || pool.Config().ConnConfig.TLSConfig == nil {
		t.Fatal("Neon TLS/pool configuration was not applied")
	}
	if pool.Config().ConnConfig.ConnectTimeout != 10*time.Second || pool.Config().ConnConfig.RuntimeParams["statement_timeout"] != "10s" {
		t.Fatal("database timeout defaults were not applied")
	}
}

func TestNewPoolPreservesExplicitTimeouts(t *testing.T) {
	pool, err := NewPool(context.Background(), "postgresql://app:secret@localhost/kokusei?connect_timeout=3&statement_timeout=4s")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if pool.Config().ConnConfig.ConnectTimeout != 3*time.Second || pool.Config().ConnConfig.RuntimeParams["statement_timeout"] != "4s" {
		t.Fatal("explicit database timeouts were overwritten")
	}
}

func TestNewPoolRejectsInvalidMaximum(t *testing.T) {
	t.Setenv("DATABASE_POOL_MAX_CONNS", "0")
	if _, err := NewPool(context.Background(), "postgres://localhost/kokusei"); err == nil {
		t.Fatal("expected invalid maximum error")
	}
}
