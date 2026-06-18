package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
)

func NewSkeletonRouter(cfg config.Config, logger *slog.Logger) http.Handler {
	router := chi.NewRouter()
	router.Use(chimiddleware.RequestID)
	router.Use(chimiddleware.RealIP)
	router.Use(chimiddleware.Recoverer)
	router.Use(requestLogger(logger))
	router.Use(corsMiddleware(cfg.CORSAllowedOrigins))

	router.Get("/health", simpleHealthHandler(cfg))
	router.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", simpleHealthHandler(cfg))
	})

	return router
}

func simpleHealthHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		response := healthResponse{
			Service:   "nms-bff",
			Status:    "ok",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Version:   "skeleton",
			Phase:     "phase-1",
			Config: map[string]interface{}{
				"port":                     cfg.Port,
				"cacheTtlSeconds":          cfg.CacheTTLSeconds,
				"thingsBoardBaseUrlSet":    cfg.ThingsBoardBaseURL != "",
				"thingsBoardApiKeySet":     cfg.ThingsBoardAPIKey != "",
				"thingsBoardSiteAssetType": cfg.ThingsBoardSiteType,
				"corsAllowedOrigins":       cfg.CORSAllowedOrigins,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}
}

func corsMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if origin != "" && slices.Contains(allowedOrigins, origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Authorization")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
