package snapshot

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

const (
	SchemaVersion  = 1
	MaxDatasetSize = 16 << 20
)

var (
	commitPattern  = regexp.MustCompile(`^[0-9a-f]{40}$`)
	numericPattern = regexp.MustCompile(`^-?[0-9]+(?:[.][0-9]+)?$`)
	periodPattern  = regexp.MustCompile(`^([0-9]{4})年(?:([0-9]{1,2})月)?$`)
)

type Dataset struct {
	SchemaVersion   int                    `json:"schemaVersion"`
	GeneratedAt     time.Time              `json:"generatedAt"`
	SourceCommitSHA string                 `json:"sourceCommitSha"`
	Indicators      []domain.Indicator     `json:"indicators"`
	Updates         []domain.UpdateHistory `json:"updates"`
	Notes           []string               `json:"notes"`
}

type Manifest struct {
	SchemaVersion int       `json:"schemaVersion"`
	Snapshot      string    `json:"snapshot"`
	CommitSHA     string    `json:"commitSha"`
	GeneratedAt   time.Time `json:"generatedAt"`
	SHA256        string    `json:"sha256"`
}

type indicatorDefinition struct {
	Name        string
	Description string
	Unit        string
	Category    string
}

var definitions = map[string]indicatorDefinition{
	"population": {
		Name: "総人口", Description: "日本に居住する人口の規模を示す指標です。人口推計の考え方を理解するため、出典の定義も確認してください。",
		Unit: "万人", Category: "人口",
	},
	"births": {
		Name: "出生数", Description: "一定期間に出生した子どもの数を示します。人口動態統計の確定値・概数などの区分に注意が必要です。",
		Unit: "万人", Category: "少子化",
	},
	"unemployment-rate": {
		Name: "完全失業率", Description: "労働力人口に占める完全失業者の割合です。季節調整の有無など定義を確認してください。",
		Unit: "%", Category: "雇用",
	},
}

func Build(ctx context.Context, commitSHA string, generatedAt time.Time, providers ...domain.IndicatorDataProvider) (Dataset, error) {
	commitSHA = strings.ToLower(commitSHA)
	if !commitPattern.MatchString(commitSHA) {
		return Dataset{}, errors.New("source commit SHA must be 40 lowercase hexadecimal characters")
	}
	if generatedAt.IsZero() {
		return Dataset{}, errors.New("generatedAt is required")
	}
	if len(providers) != len(definitions) {
		return Dataset{}, fmt.Errorf("exactly %d indicator providers are required", len(definitions))
	}

	bySlug := make(map[string][]domain.FetchedIndicatorValue, len(providers))
	for _, dataProvider := range providers {
		values, err := dataProvider.Fetch(ctx)
		if err != nil {
			return Dataset{}, fmt.Errorf("fetch snapshot source: %w", err)
		}
		for _, value := range values {
			if _, ok := definitions[value.IndicatorSlug]; !ok {
				return Dataset{}, fmt.Errorf("unsupported indicator slug %q", value.IndicatorSlug)
			}
			value.FetchedAt = generatedAt.UTC()
			bySlug[value.IndicatorSlug] = append(bySlug[value.IndicatorSlug], value)
		}
	}

	slugs := []string{"population", "births", "unemployment-rate"}
	indicators := make([]domain.Indicator, 0, len(slugs))
	for _, slug := range slugs {
		values := bySlug[slug]
		if len(values) == 0 {
			return Dataset{}, fmt.Errorf("indicator %q has no values", slug)
		}
		indicator, err := buildIndicator(slug, values)
		if err != nil {
			return Dataset{}, err
		}
		indicators = append(indicators, indicator)
	}

	dataset := Dataset{
		SchemaVersion:   SchemaVersion,
		GeneratedAt:     generatedAt.UTC(),
		SourceCommitSHA: commitSHA,
		Indicators:      indicators,
		Updates:         []domain.UpdateHistory{},
		Notes:           []string{"Official normalized source values; revision history is empty until snapshot-to-snapshot revisions are recorded."},
	}
	if err := Validate(dataset); err != nil {
		return Dataset{}, err
	}
	return dataset, nil
}

func buildIndicator(slug string, values []domain.FetchedIndicatorValue) (domain.Indicator, error) {
	definition := definitions[slug]
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value.IndicatorSlug != slug || value.Value == "" || !numericPattern.MatchString(value.Value) ||
			value.Period == "" || value.PublishedAt.IsZero() || value.FetchedAt.IsZero() ||
			value.SourceName == "" || value.SourceURL == "" || value.EstimateKind == "" {
			return domain.Indicator{}, fmt.Errorf("indicator %q contains incomplete normalized data", slug)
		}
		if _, exists := seen[value.Period]; exists {
			return domain.Indicator{}, fmt.Errorf("indicator %q contains duplicate period %q", slug, value.Period)
		}
		seen[value.Period] = struct{}{}
	}
	sort.Slice(values, func(i, j int) bool {
		leftYear, leftMonth := periodKey(values[i].Period)
		rightYear, rightMonth := periodKey(values[j].Period)
		if leftYear != rightYear {
			return leftYear < rightYear
		}
		if leftMonth != rightMonth {
			return leftMonth < rightMonth
		}
		return values[i].Period < values[j].Period
	})

	series := make([]domain.Value, 0, len(values))
	for _, value := range values {
		series = append(series, domain.Value{
			Value: value.Value, Period: value.Period, PublishedAt: value.PublishedAt.Format("2006-01-02"),
			FetchedAt: value.FetchedAt.UTC(), SourceURL: value.SourceURL, Origin: "official", EstimateKind: value.EstimateKind,
		})
	}
	latest := series[len(series)-1]
	indicator := domain.Indicator{
		Slug: slug, Name: definition.Name, Description: definition.Description, Unit: definition.Unit,
		Category: definition.Category, SourceName: values[len(values)-1].SourceName,
		SourceURL: latest.SourceURL, Latest: latest, Series: series, Development: false,
	}
	if len(series) > 1 {
		previous := series[len(series)-2]
		indicator.Previous = &previous
		change, err := subtractDecimal(latest.Value, previous.Value)
		if err != nil {
			return domain.Indicator{}, fmt.Errorf("indicator %q change: %w", slug, err)
		}
		indicator.Change = &change
	}
	return indicator, nil
}

func periodKey(period string) (int, int) {
	match := periodPattern.FindStringSubmatch(period)
	if match == nil {
		return 0, 0
	}
	var year, month int
	_, _ = fmt.Sscanf(match[1], "%d", &year)
	if match[2] != "" {
		_, _ = fmt.Sscanf(match[2], "%d", &month)
	}
	return year, month
}

func subtractDecimal(left, right string) (string, error) {
	leftRat, ok := new(big.Rat).SetString(left)
	if !ok {
		return "", errors.New("invalid left decimal")
	}
	rightRat, ok := new(big.Rat).SetString(right)
	if !ok {
		return "", errors.New("invalid right decimal")
	}
	scale := decimalScale(left)
	if rightScale := decimalScale(right); rightScale > scale {
		scale = rightScale
	}
	result := new(big.Rat).Sub(leftRat, rightRat).FloatString(scale)
	result = strings.TrimRight(strings.TrimRight(result, "0"), ".")
	if result == "-0" || result == "" {
		return "0", nil
	}
	return result, nil
}

func decimalScale(value string) int {
	index := strings.IndexByte(value, '.')
	if index < 0 {
		return 0
	}
	return len(value) - index - 1
}

func Validate(dataset Dataset) error {
	if dataset.SchemaVersion != SchemaVersion {
		return fmt.Errorf("unsupported snapshot schema version %d", dataset.SchemaVersion)
	}
	if dataset.GeneratedAt.IsZero() || !commitPattern.MatchString(dataset.SourceCommitSHA) {
		return errors.New("snapshot metadata is invalid")
	}
	if len(dataset.Indicators) != len(definitions) {
		return errors.New("snapshot must contain exactly the required official indicators")
	}
	seen := make(map[string]struct{}, len(dataset.Indicators))
	for _, indicator := range dataset.Indicators {
		definition, ok := definitions[indicator.Slug]
		if !ok {
			return fmt.Errorf("unsupported snapshot indicator %q", indicator.Slug)
		}
		if _, duplicate := seen[indicator.Slug]; duplicate {
			return fmt.Errorf("duplicate snapshot indicator %q", indicator.Slug)
		}
		seen[indicator.Slug] = struct{}{}
		if indicator.Unit != definition.Unit || indicator.SourceName == "" || indicator.SourceURL == "" ||
			indicator.Latest.Value == "" || !numericPattern.MatchString(indicator.Latest.Value) || len(indicator.Series) == 0 {
			return fmt.Errorf("snapshot indicator %q is incomplete", indicator.Slug)
		}
		for _, value := range indicator.Series {
			if value.Value == "" || !numericPattern.MatchString(value.Value) || value.Period == "" ||
				value.PublishedAt == "" || value.FetchedAt.IsZero() || value.SourceURL == "" || value.Origin != "official" {
				return fmt.Errorf("snapshot indicator %q contains an invalid series value", indicator.Slug)
			}
		}
	}
	updateIDs := make(map[int64]struct{}, len(dataset.Updates))
	for _, update := range dataset.Updates {
		if update.ID <= 0 {
			return fmt.Errorf("snapshot update history for %q has invalid ID", update.IndicatorSlug)
		}
		if _, duplicate := updateIDs[update.ID]; duplicate {
			return fmt.Errorf("snapshot update history has duplicate ID %d", update.ID)
		}
		updateIDs[update.ID] = struct{}{}
		if _, ok := definitions[update.IndicatorSlug]; !ok || update.IndicatorName == "" ||
			update.Unit == "" || update.CurrentValue == "" || !numericPattern.MatchString(update.CurrentValue) ||
			update.Period == "" || update.DetectedAt.IsZero() || update.SourceName == "" ||
			update.SourceURL == "" || update.Development {
			return fmt.Errorf("snapshot update history for %q is invalid", update.IndicatorSlug)
		}
		if update.PreviousValue != nil && !numericPattern.MatchString(*update.PreviousValue) {
			return fmt.Errorf("snapshot update history for %q has invalid previous value", update.IndicatorSlug)
		}
	}
	return nil
}

// MergeRevisionHistory carries forward verified history from the previous
// snapshot and records only same-period value revisions. A newly published
// period is not a revision. Missing prior periods fail closed so a partial
// provider response cannot silently erase published official data.
func MergeRevisionHistory(current Dataset, previous *Dataset) (Dataset, error) {
	if err := Validate(current); err != nil {
		return Dataset{}, fmt.Errorf("validate current snapshot: %w", err)
	}
	if previous == nil {
		return current, nil
	}
	if err := Validate(*previous); err != nil {
		return Dataset{}, fmt.Errorf("validate previous snapshot: %w", err)
	}

	currentBySlug := make(map[string]domain.Indicator, len(current.Indicators))
	for _, indicator := range current.Indicators {
		currentBySlug[indicator.Slug] = indicator
	}
	updates := append([]domain.UpdateHistory{}, previous.Updates...)
	var maxID int64
	for _, update := range updates {
		if update.ID > maxID {
			maxID = update.ID
		}
	}

	for _, previousIndicator := range previous.Indicators {
		currentIndicator, ok := currentBySlug[previousIndicator.Slug]
		if !ok {
			return Dataset{}, fmt.Errorf("current snapshot is missing indicator %q", previousIndicator.Slug)
		}
		currentValues := make(map[string]domain.Value, len(currentIndicator.Series))
		for _, value := range currentIndicator.Series {
			currentValues[value.Period] = value
		}
		for _, previousValue := range previousIndicator.Series {
			currentValue, exists := currentValues[previousValue.Period]
			if !exists {
				return Dataset{}, fmt.Errorf("current snapshot indicator %q is missing previously published period %q", previousIndicator.Slug, previousValue.Period)
			}
			equal, err := decimalsEqual(previousValue.Value, currentValue.Value)
			if err != nil {
				return Dataset{}, fmt.Errorf("compare indicator %q period %q: %w", previousIndicator.Slug, previousValue.Period, err)
			}
			if equal {
				continue
			}
			maxID++
			oldValue := previousValue.Value
			updates = append(updates, domain.UpdateHistory{
				ID: maxID, IndicatorSlug: currentIndicator.Slug, IndicatorName: currentIndicator.Name,
				Unit: currentIndicator.Unit, PreviousValue: &oldValue, CurrentValue: currentValue.Value,
				Period: currentValue.Period, DetectedAt: current.GeneratedAt,
				SourceName: currentIndicator.SourceName, SourceURL: currentValue.SourceURL, Development: false,
			})
		}
	}

	sort.SliceStable(updates, func(i, j int) bool {
		if !updates[i].DetectedAt.Equal(updates[j].DetectedAt) {
			return updates[i].DetectedAt.After(updates[j].DetectedAt)
		}
		return updates[i].ID > updates[j].ID
	})
	current.Updates = updates
	current.Notes = []string{"Official normalized source values; revision history is derived from verified snapshot-to-snapshot comparisons."}
	if err := Validate(current); err != nil {
		return Dataset{}, fmt.Errorf("validate merged snapshot: %w", err)
	}
	return current, nil
}

func decimalsEqual(left, right string) (bool, error) {
	leftRat, ok := new(big.Rat).SetString(left)
	if !ok {
		return false, errors.New("invalid left decimal")
	}
	rightRat, ok := new(big.Rat).SetString(right)
	if !ok {
		return false, errors.New("invalid right decimal")
	}
	return leftRat.Cmp(rightRat) == 0, nil
}

func Marshal(dataset Dataset) ([]byte, error) {
	if err := Validate(dataset); err != nil {
		return nil, err
	}
	return json.MarshalIndent(dataset, "", "  ")
}

func Digest(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}
