package snapshot

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
	snapshotmodel "github.com/kokusei/dashboard/backend/internal/snapshot"
)

type memorySource struct {
	mu      sync.Mutex
	content map[string][]byte
	reads   map[string]int
	err     error
}

func (s *memorySource) Read(_ context.Context, name string, _ int64) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reads[name]++
	if s.err != nil {
		return nil, s.err
	}
	content, ok := s.content[name]
	if !ok {
		return nil, errors.New("missing blob")
	}
	return append([]byte(nil), content...), nil
}

func TestRepositoryLoadsManifestCachesDatasetAndKeepsStaleGoodData(t *testing.T) {
	source, firstPath := validSource(t, "a")
	repository := New(source, "current.json")
	items, err := repository.List(context.Background())
	if err != nil || len(items) != 3 || items[0].Series != nil {
		t.Fatalf("list=%#v err=%v", items, err)
	}
	detail, err := repository.GetBySlug(context.Background(), "population")
	if err != nil || len(detail.Series) != 1 || detail.Latest.Value != "12316.536000" {
		t.Fatalf("detail=%#v err=%v", detail, err)
	}
	if source.reads[firstPath] != 1 {
		t.Fatalf("dataset reads=%d", source.reads[firstPath])
	}
	source.err = errors.New("temporary Blob failure")
	stale, err := repository.GetBySlug(context.Background(), "births")
	if err != nil || stale.Slug != "births" {
		t.Fatalf("stale=%#v err=%v", stale, err)
	}
}

func TestRepositoryReturnsEmptyUpdateArrayInsteadOfNull(t *testing.T) {
	source, _ := validSource(t, "a")
	updates, err := New(source, "current.json").ListUpdates(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if updates == nil || len(updates) != 0 {
		t.Fatalf("updates=%#v", updates)
	}
	encoded, err := json.Marshal(updates)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != "[]" {
		t.Fatalf("encoded updates=%s", encoded)
	}
}

func TestRepositoryRefreshAndIntegrityFailures(t *testing.T) {
	source, _ := validSource(t, "a")
	repository := New(source, "current.json")
	if _, err := repository.List(context.Background()); err != nil {
		t.Fatal(err)
	}
	secondDataset := validDataset("b")
	secondContent, _ := snapshotmodel.Marshal(secondDataset)
	secondContent = append(secondContent, '\n')
	secondPath := "snapshots/" + strings.Repeat("b", 40) + "/dataset.json"
	source.content[secondPath] = secondContent
	source.content["current.json"] = manifestJSON(t, secondDataset, secondPath, snapshotmodel.Digest(secondContent))
	item, err := repository.GetBySlug(context.Background(), "population")
	if err != nil || item.Latest.Value != "12316.536000" || source.reads[secondPath] != 1 {
		t.Fatalf("refresh item=%#v err=%v reads=%d", item, err, source.reads[secondPath])
	}

	badSource, path := validSource(t, "c")
	badSource.content["current.json"] = manifestJSON(t, validDataset("c"), path, strings.Repeat("0", 64))
	if _, err := New(badSource, "current.json").List(context.Background()); err == nil {
		t.Fatal("SHA mismatch was accepted")
	}
}

func TestRepositoryRejectsInvalidManifestSchemaPathAndDataset(t *testing.T) {
	cases := []struct {
		name     string
		manifest snapshotmodel.Manifest
	}{
		{name: "schema", manifest: snapshotmodel.Manifest{SchemaVersion: 2}},
		{name: "path traversal", manifest: snapshotmodel.Manifest{
			SchemaVersion: 1, Snapshot: "../dataset.json", CommitSHA: strings.Repeat("d", 40),
			GeneratedAt: time.Now().UTC(), SHA256: strings.Repeat("0", 64),
		}},
		{name: "absolute URL", manifest: snapshotmodel.Manifest{
			SchemaVersion: 1, Snapshot: "https://example.com/dataset.json", CommitSHA: strings.Repeat("d", 40),
			GeneratedAt: time.Now().UTC(), SHA256: strings.Repeat("0", 64),
		}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			content, _ := json.Marshal(test.manifest)
			source := &memorySource{content: map[string][]byte{"current.json": content}, reads: map[string]int{}}
			if _, err := New(source, "current.json").List(context.Background()); err == nil {
				t.Fatal("invalid manifest was accepted")
			}
		})
	}

	source, path := validSource(t, "e")
	source.content[path] = []byte(`{"schemaVersion":1}`)
	dataset := validDataset("e")
	source.content["current.json"] = manifestJSON(t, dataset, path, snapshotmodel.Digest(source.content[path]))
	if _, err := New(source, "current.json").List(context.Background()); err == nil {
		t.Fatal("incomplete dataset was accepted")
	}
}

func TestFileRepositoryUsesTheSameDatasetSchemaWithoutAzure(t *testing.T) {
	dataset := validDataset("f")
	content, err := snapshotmodel.Marshal(dataset)
	if err != nil {
		t.Fatal(err)
	}
	path := t.TempDir() + "/dataset.json"
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	repository := NewFile(path)
	item, err := repository.GetBySlug(context.Background(), "unemployment-rate")
	if err != nil || item.Latest.Value != "2.5" || item.Unit != "%" {
		t.Fatalf("file item=%#v err=%v", item, err)
	}
}

func validSource(t *testing.T, shaCharacter string) (*memorySource, string) {
	t.Helper()
	dataset := validDataset(shaCharacter)
	content, err := snapshotmodel.Marshal(dataset)
	if err != nil {
		t.Fatal(err)
	}
	content = append(content, '\n')
	path := "snapshots/" + dataset.SourceCommitSHA + "/dataset.json"
	return &memorySource{
		content: map[string][]byte{path: content, "current.json": manifestJSON(t, dataset, path, snapshotmodel.Digest(content))},
		reads:   map[string]int{},
	}, path
}

func manifestJSON(t *testing.T, dataset snapshotmodel.Dataset, path, digest string) []byte {
	t.Helper()
	content, err := json.Marshal(snapshotmodel.Manifest{
		SchemaVersion: 1, Snapshot: path, CommitSHA: dataset.SourceCommitSHA,
		GeneratedAt: dataset.GeneratedAt, SHA256: digest,
	})
	if err != nil {
		t.Fatal(err)
	}
	return content
}

func validDataset(shaCharacter string) snapshotmodel.Dataset {
	at := time.Date(2026, 7, 31, 1, 2, 3, 0, time.UTC)
	value := func(number, period string) domain.Value {
		return domain.Value{
			Value: number, Period: period, PublishedAt: "2026-07-30", FetchedAt: at,
			SourceURL: "https://example.go.jp/data", Origin: "official", EstimateKind: "final",
		}
	}
	indicator := func(slug, name, unit, category, number, period string) domain.Indicator {
		v := value(number, period)
		return domain.Indicator{
			Slug: slug, Name: name, Description: name, Unit: unit, Category: category,
			SourceName: "公式", SourceURL: v.SourceURL, Latest: v, Series: []domain.Value{v},
		}
	}
	return snapshotmodel.Dataset{
		SchemaVersion: 1, GeneratedAt: at, SourceCommitSHA: strings.Repeat(shaCharacter, 40),
		Indicators: []domain.Indicator{
			indicator("population", "総人口", "万人", "人口", "12316.536000", "2025年12月"),
			indicator("births", "出生数", "万人", "少子化", "68.6173", "2024年"),
			indicator("unemployment-rate", "完全失業率", "%", "雇用", "2.5", "2025年"),
		},
		Updates: []domain.UpdateHistory{}, Notes: []string{"test"},
	}
}
