package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
)

func TestHealthEndpoints(t *testing.T) {
	t.Parallel()

	cfg := config.Config{Port: "8080", CacheTTLSeconds: 30}
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := NewRouter(cfg, logger)

	for _, path := range []string{"/health", "/api/v1/health"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		res := httptest.NewRecorder()

		router.ServeHTTP(res, req)

		if res.Code != http.StatusOK {
			t.Fatalf("expected 200 for %s, got %d", path, res.Code)
		}
	}
}
