package service

import (
	"context"
	"errors"
	"testing"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

type fakeProvider struct {
	values []domain.FetchedIndicatorValue
	err    error
}

func (f fakeProvider) Fetch(context.Context) ([]domain.FetchedIndicatorValue, error) {
	return f.values, f.err
}

type fakeValueRepository struct{ called bool }

func (f *fakeValueRepository) UpsertFetched(_ context.Context, values []domain.FetchedIndicatorValue) (int, error) {
	f.called = true
	return len(values), nil
}

func TestImportDoesNotWriteWhenFetchFails(t *testing.T) {
	repository := &fakeValueRepository{}
	service := NewImportService(fakeProvider{err: errors.New("network failure")}, repository)
	if _, err := service.Import(context.Background()); err == nil {
		t.Fatal("expected error")
	}
	if repository.called {
		t.Fatal("repository must not be called")
	}
}

func TestImportWritesValidatedValues(t *testing.T) {
	repository := &fakeValueRepository{}
	service := NewImportService(fakeProvider{values: []domain.FetchedIndicatorValue{{Value: "12316.5"}}}, repository)
	changed, err := service.Import(context.Background())
	if err != nil || changed != 1 || !repository.called {
		t.Fatalf("changed=%d called=%v err=%v", changed, repository.called, err)
	}
}
