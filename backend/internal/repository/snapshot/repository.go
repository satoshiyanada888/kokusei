package snapshot

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
	snapshotmodel "github.com/kokusei/dashboard/backend/internal/snapshot"
)

type ErrorKind string

const (
	ErrorUnavailable ErrorKind = "unavailable"
	ErrorIntegrity   ErrorKind = "integrity"
	ErrorInvalid     ErrorKind = "invalid"
)

type LoadError struct {
	Kind ErrorKind
	Err  error
}

func (e *LoadError) Error() string { return fmt.Sprintf("snapshot %s: %v", e.Kind, e.Err) }
func (e *LoadError) Unwrap() error { return e.Err }

type Source interface {
	Read(context.Context, string, int64) ([]byte, error)
}

type Repository struct {
	source       Source
	currentBlob  string
	timeout      time.Duration
	maxBytes     int64
	direct       bool
	mu           sync.Mutex
	cachedCommit string
	cached       *snapshotmodel.Dataset
}

func New(source Source, currentBlob string) *Repository {
	return &Repository{
		source: source, currentBlob: currentBlob, timeout: 10 * time.Second,
		maxBytes: snapshotmodel.MaxDatasetSize,
	}
}

func NewFile(path string) *Repository {
	return &Repository{
		source: FileSource{Root: filepath.Dir(path)}, currentBlob: filepath.Base(path),
		timeout: 10 * time.Second, maxBytes: snapshotmodel.MaxDatasetSize, direct: true,
	}
}

func (r *Repository) List(ctx context.Context) ([]domain.Indicator, error) {
	dataset, err := r.load(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]domain.Indicator, len(dataset.Indicators))
	for index, indicator := range dataset.Indicators {
		items[index] = indicator
		items[index].Series = nil
	}
	return items, nil
}

func (r *Repository) GetBySlug(ctx context.Context, slug string) (domain.Indicator, error) {
	dataset, err := r.load(ctx)
	if err != nil {
		return domain.Indicator{}, err
	}
	for _, indicator := range dataset.Indicators {
		if indicator.Slug == slug {
			return indicator, nil
		}
	}
	return domain.Indicator{}, domain.ErrNotFound
}

func (r *Repository) ListUpdates(ctx context.Context) ([]domain.UpdateHistory, error) {
	dataset, err := r.load(ctx)
	if err != nil {
		return nil, err
	}
	return append([]domain.UpdateHistory(nil), dataset.Updates...), nil
}

type UpdateRepository struct{ snapshot *Repository }

func NewUpdateRepository(repository *Repository) *UpdateRepository {
	return &UpdateRepository{snapshot: repository}
}

func (r *UpdateRepository) List(ctx context.Context) ([]domain.UpdateHistory, error) {
	return r.snapshot.ListUpdates(ctx)
}

func (r *Repository) load(ctx context.Context) (*snapshotmodel.Dataset, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	loadCtx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()
	dataset, commit, err := r.loadFresh(loadCtx)
	if err != nil {
		var loadError *LoadError
		if r.cached != nil && errors.As(err, &loadError) && loadError.Kind == ErrorUnavailable {
			return r.cached, nil
		}
		return nil, err
	}
	if r.cached != nil && r.cachedCommit == commit {
		return r.cached, nil
	}
	r.cachedCommit = commit
	r.cached = dataset
	return dataset, nil
}

func (r *Repository) loadFresh(ctx context.Context) (*snapshotmodel.Dataset, string, error) {
	if r.direct {
		if r.cached != nil {
			return r.cached, r.cachedCommit, nil
		}
		content, err := r.source.Read(ctx, r.currentBlob, r.maxBytes)
		if err != nil {
			return nil, "", unavailable(err)
		}
		dataset, err := decodeDataset(content)
		if err != nil {
			return nil, "", err
		}
		return dataset, dataset.SourceCommitSHA, nil
	}

	manifestContent, err := r.source.Read(ctx, r.currentBlob, 64<<10)
	if err != nil {
		return nil, "", unavailable(err)
	}
	var manifest snapshotmodel.Manifest
	if err := json.Unmarshal(manifestContent, &manifest); err != nil {
		return nil, "", invalid(fmt.Errorf("decode current manifest: %w", err))
	}
	if err := validateManifest(manifest); err != nil {
		return nil, "", invalid(err)
	}
	if r.cached != nil && r.cachedCommit == manifest.CommitSHA {
		return r.cached, manifest.CommitSHA, nil
	}
	content, err := r.source.Read(ctx, manifest.Snapshot, r.maxBytes)
	if err != nil {
		return nil, "", unavailable(err)
	}
	sum := sha256.Sum256(content)
	if hex.EncodeToString(sum[:]) != manifest.SHA256 {
		return nil, "", integrity(errors.New("dataset SHA-256 does not match current manifest"))
	}
	dataset, err := decodeDataset(content)
	if err != nil {
		return nil, "", err
	}
	if dataset.SourceCommitSHA != manifest.CommitSHA || dataset.GeneratedAt.UTC() != manifest.GeneratedAt.UTC() {
		return nil, "", integrity(errors.New("dataset metadata does not match current manifest"))
	}
	return dataset, manifest.CommitSHA, nil
}

func decodeDataset(content []byte) (*snapshotmodel.Dataset, error) {
	var dataset snapshotmodel.Dataset
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&dataset); err != nil {
		return nil, invalid(fmt.Errorf("decode dataset: %w", err))
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return nil, invalid(errors.New("dataset contains trailing JSON content"))
	}
	if err := snapshotmodel.Validate(dataset); err != nil {
		return nil, invalid(err)
	}
	return &dataset, nil
}

var (
	shaPattern  = regexp.MustCompile(`^[0-9a-f]{40}$`)
	hashPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	pathPattern = regexp.MustCompile(`^snapshots/([0-9a-f]{40})/dataset[.]json$`)
)

func validateManifest(manifest snapshotmodel.Manifest) error {
	if manifest.SchemaVersion != snapshotmodel.SchemaVersion || manifest.GeneratedAt.IsZero() ||
		!shaPattern.MatchString(manifest.CommitSHA) || !hashPattern.MatchString(manifest.SHA256) {
		return errors.New("current manifest metadata is invalid")
	}
	match := pathPattern.FindStringSubmatch(manifest.Snapshot)
	if match == nil || match[1] != manifest.CommitSHA || strings.Contains(manifest.Snapshot, "..") ||
		strings.Contains(manifest.Snapshot, "://") || strings.HasPrefix(manifest.Snapshot, "/") {
		return errors.New("current manifest snapshot path is invalid")
	}
	return nil
}

func unavailable(err error) error { return &LoadError{Kind: ErrorUnavailable, Err: err} }
func invalid(err error) error     { return &LoadError{Kind: ErrorInvalid, Err: err} }
func integrity(err error) error   { return &LoadError{Kind: ErrorIntegrity, Err: err} }

type FileSource struct{ Root string }

func (s FileSource) Read(_ context.Context, name string, limit int64) ([]byte, error) {
	if filepath.Base(name) != name {
		return nil, errors.New("file snapshot name must not contain a directory")
	}
	file, err := os.Open(filepath.Join(s.Root, name))
	if err != nil {
		return nil, err
	}
	defer file.Close()
	reader := io.LimitReader(file, limit+1)
	content, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > limit {
		return nil, errors.New("snapshot exceeds size limit")
	}
	return content, nil
}
