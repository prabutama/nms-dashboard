package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
)

type healthResponse struct {
	Service   string                 `json:"service"`
	Status    string                 `json:"status"`
	Timestamp string                 `json:"timestamp"`
	Version   string                 `json:"version"`
	Phase     string                 `json:"phase"`
	Config    map[string]interface{} `json:"config"`
}

func NewRouter(cfg config.Config, logger *slog.Logger) http.Handler {
	router := chi.NewRouter()
	router.Use(chimiddleware.RequestID)
	router.Use(chimiddleware.RealIP)
	router.Use(chimiddleware.Recoverer)
	router.Use(requestLogger(logger))

	router.Get("/health", healthHandler(cfg))
	router.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", healthHandler(cfg))
	})

	return router
}

func healthHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		response := healthResponse{
			Service:   "nms-bff",
			Status:    "ok",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Version:   "phase-1",
			Phase:     "skeleton",
			Config: map[string]interface{}{
				"port":                     cfg.Port,
				"cacheTtlSeconds":          cfg.CacheTTLSeconds,
				"thingsBoardBaseUrlSet":    cfg.ThingsBoardBaseURL != "",
				"thingsBoardApiKeySet":     cfg.ThingsBoardAPIKey != "",
				"thingsBoardConfigured":    cfg.HasThingsBoardSetup,
				"thingsBoardClientEnabled": false,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			logger.Info("request completed", "method", r.Method, "path", r.URL.Path, "duration", time.Since(start).String())
		})
	}
}
