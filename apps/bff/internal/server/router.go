package server

import (
	"log/slog"
	"net/http"

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
	router.Use(corsMiddleware(cfg.CORSAllowedOrigins))

	newAPIServer(cfg, logger).registerRoutes(router)

	return router
}
