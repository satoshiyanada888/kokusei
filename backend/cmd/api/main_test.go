package main

import (
	"context"
	"path/filepath"
	"testing"
)

func TestRepositoriesRejectsUnknownDataStore(t *testing.T) {
	t.Setenv("DATA_STORE", "unknown")
	if _, _, _, err := repositories(context.Background()); err == nil {
		t.Fatal("unknown DATA_STORE was accepted")
	}
}

func TestRepositoriesSupportsFileModeWithoutDatabaseURL(t *testing.T) {
	t.Setenv("DATA_STORE", "file")
	t.Setenv("DATA_FILE_PATH", filepath.Join("..", "..", "testdata", "dataset.json"))
	t.Setenv("DATABASE_URL", "")
	indicators, updates, closeDataStore, err := repositories(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer closeDataStore()
	items, err := indicators.List(context.Background())
	if err != nil || len(items) != 3 {
		t.Fatalf("items=%#v err=%v", items, err)
	}
	history, err := updates.List(context.Background())
	if err != nil || len(history) != 0 {
		t.Fatalf("history=%#v err=%v", history, err)
	}
}
