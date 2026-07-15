package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("indicator not found")

type Value struct {
	Value       string    `json:"value"`
	Period      string    `json:"period"`
	PublishedAt string    `json:"publishedAt"`
	FetchedAt   time.Time `json:"fetchedAt"`
}

type Indicator struct {
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Unit        string  `json:"unit"`
	Category    string  `json:"category"`
	SourceName  string  `json:"sourceName"`
	SourceURL   string  `json:"sourceUrl"`
	Latest      Value   `json:"latest"`
	Previous    *Value  `json:"previous,omitempty"`
	Change      *string `json:"change,omitempty"`
	Series      []Value `json:"series,omitempty"`
	Development bool    `json:"developmentData"`
}

type UpdateHistory struct {
	ID            int64     `json:"id"`
	IndicatorSlug string    `json:"indicatorSlug"`
	IndicatorName string    `json:"indicatorName"`
	Unit          string    `json:"unit"`
	PreviousValue *string   `json:"previousValue"`
	CurrentValue  string    `json:"currentValue"`
	Period        string    `json:"period"`
	DetectedAt    time.Time `json:"detectedAt"`
	SourceName    string    `json:"sourceName"`
	SourceURL     string    `json:"sourceUrl"`
}

type IndicatorRepository interface {
	List(context.Context) ([]Indicator, error)
	GetBySlug(context.Context, string) (Indicator, error)
}

type UpdateHistoryRepository interface {
	List(context.Context) ([]UpdateHistory, error)
}

type IndicatorDataProvider interface {
	Fetch(context.Context) ([]Indicator, error)
}
