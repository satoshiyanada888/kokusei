package service

import (
	"context"
	"regexp"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

var validSlug = regexp.MustCompile(`^[a-z0-9-]+$`)

type IndicatorService struct{ repository domain.IndicatorRepository }

func NewIndicatorService(repository domain.IndicatorRepository) *IndicatorService {
	return &IndicatorService{repository: repository}
}

func (s *IndicatorService) List(ctx context.Context) ([]domain.Indicator, error) {
	return s.repository.List(ctx)
}

func (s *IndicatorService) Get(ctx context.Context, slug string) (domain.Indicator, error) {
	if !validSlug.MatchString(slug) {
		return domain.Indicator{}, domain.ErrNotFound
	}
	return s.repository.GetBySlug(ctx, slug)
}

type UpdateService struct {
	repository domain.UpdateHistoryRepository
}

func NewUpdateService(repository domain.UpdateHistoryRepository) *UpdateService {
	return &UpdateService{repository: repository}
}

func (s *UpdateService) List(ctx context.Context) ([]domain.UpdateHistory, error) {
	return s.repository.List(ctx)
}
