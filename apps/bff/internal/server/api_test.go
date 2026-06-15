package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
)

func TestThingsBoardStatusConfiguredAndReachable(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/auth/user" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("X-Authorization"); got != "Bearer test-token" {
			t.Fatalf("unexpected auth header %s", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":{"id":"user-1"}}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "site",
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/thingsboard/status", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	body := res.Body.String()
	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	if !strings.Contains(body, `"configured":true`) || !strings.Contains(body, `"reachable":true`) {
		t.Fatalf("unexpected response body: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestSitesAndSiteDevices(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-1"},"name":"HQ","type":"site"}],"hasNext":false}`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-1/values/attributes":
			_, _ = w.Write([]byte(`[]`))
		case r.URL.Path == "/api/relations/info":
			_, _ = w.Write([]byte(`[{"type":"Contains","to":{"entityType":"DEVICE","id":"device-1"}},{"type":"Contains","to":{"entityType":"ASSET","id":"asset-2"}}]`))
		case r.URL.Path == "/api/device/device-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-1"},"name":"HQ-GATEWAY-1","type":"router","label":"HQ Gateway 1"}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "site",
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	sitesReq := httptest.NewRequest(http.MethodGet, "/api/v1/sites", nil)
	sitesRes := httptest.NewRecorder()
	router.ServeHTTP(sitesRes, sitesReq)

	if sitesRes.Code != http.StatusOK {
		t.Fatalf("expected sites status 200, got %d", sitesRes.Code)
	}
	if !strings.Contains(sitesRes.Body.String(), `"siteKey":"hq"`) {
		t.Fatalf("unexpected sites response: %s", sitesRes.Body.String())
	}

	devicesReq := httptest.NewRequest(http.MethodGet, "/api/v1/sites/hq/devices", nil)
	devicesRes := httptest.NewRecorder()
	router.ServeHTTP(devicesRes, devicesReq)

	if devicesRes.Code != http.StatusOK {
		t.Fatalf("expected devices status 200, got %d", devicesRes.Code)
	}
	body := devicesRes.Body.String()
	if !strings.Contains(body, `"deviceId":"device-1"`) || !strings.Contains(body, `"relationType":"Contains"`) {
		t.Fatalf("unexpected devices response: %s", body)
	}
}
