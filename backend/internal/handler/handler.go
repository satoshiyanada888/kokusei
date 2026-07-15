package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/kokusei/dashboard/backend/internal/domain"
	"github.com/kokusei/dashboard/backend/internal/service"
)

type Handler struct {
	indicators *service.IndicatorService
	updates    *service.UpdateService
}

func New(indicators *service.IndicatorService, updates *service.UpdateService) *Handler {
	return &Handler{indicators: indicators, updates: updates}
}

func (h *Handler) Routes(allowedOrigin string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/indicators", h.listIndicators)
	mux.HandleFunc("GET /api/indicators/{slug}", h.getIndicator)
	mux.HandleFunc("GET /api/updates", h.listUpdates)
	return cors(allowedOrigin, mux)
}

func (h *Handler) listIndicators(w http.ResponseWriter, r *http.Request) {
	items, err := h.indicators.List(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (h *Handler) getIndicator(w http.ResponseWriter, r *http.Request) {
	item, err := h.indicators.Get(r.Context(), r.PathValue("slug"))
	if errors.Is(err, domain.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "indicator not found"})
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": item})
}

func (h *Handler) listUpdates(w http.ResponseWriter, r *http.Request) {
	items, err := h.updates.List(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("encode response", "error", err)
	}
}

func internalError(w http.ResponseWriter, err error) {
	slog.Error("request failed", "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin != "" && strings.EqualFold(r.Header.Get("Origin"), origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		next.ServeHTTP(w, r)
	})
}
