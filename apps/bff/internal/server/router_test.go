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

	cfg := config.Config{Port: "8080", CacheTTLSeconds: 30, CORSAllowedOrigins: []string{"http://localhost:3000"}}
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

func TestCORSPreflight(t *testing.T) {
	t.Parallel()

	cfg := config.Config{Port: "8080", CacheTTLSeconds: 30, CORSAllowedOrigins: []string{"http://localhost:3000"}}
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := NewRouter(cfg, logger)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/integrations/thingsboard/status", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", res.Code)
	}
	if got := res.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("unexpected allow origin header %q", got)
	}
	if got := res.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, PUT, DELETE, OPTIONS" {
		t.Fatalf("unexpected allow methods header %q", got)
	}
	if got := res.Header().Get("Access-Control-Allow-Headers"); got != "Content-Type, Authorization, X-Authorization" {
		t.Fatalf("unexpected allow headers header %q", got)
	}
}
