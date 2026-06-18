package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
)

func TestThingsBoardStatusConfiguredAndReachable(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tenant/assets" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("X-Authorization"); got != "ApiKey test-token" {
			t.Fatalf("unexpected auth header %s", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[],"hasNext":false}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "site",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
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
	if !strings.Contains(body, `"status":"ok"`) || !strings.Contains(body, `"configured":true`) || !strings.Contains(body, `"reachable":true`) {
		t.Fatalf("unexpected response body: %s", body)
	}
	if !strings.Contains(body, thingsBoard.URL) {
		t.Fatalf("expected baseUrl in response body: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestDeviceDashboardNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/dashboard", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"deviceId":"device-1"`) || !strings.Contains(body, `"status":"unknown"`) || !strings.Contains(body, `"metricCards":[]`) {
		t.Fatalf("unexpected dashboard placeholder response: %s", body)
	}
}

func TestDeviceDashboardLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	now := time.Now().UTC().UnixMilli()
	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/device/device-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-1"},"name":"linux-hq-server-2","type":"server","label":"Linux HQ Server 2","deviceProfileName":"Linux Server"}`))
		case "/api/plugins/telemetry/DEVICE/device-1/values/timeseries":
			_, _ = w.Write([]byte(`{"snmp.host.cpu.load_pct":[{"ts":` + strconv.FormatInt(now, 10) + `,"value":91}],"icmp.reachable":[{"ts":` + strconv.FormatInt(now, 10) + `,"value":true}],"custom_metric":[{"ts":` + strconv.FormatInt(now, 10) + `,"value":42}],"snmp.if.idx2.rx_bps":[{"ts":` + strconv.FormatInt(now, 10) + `,"value":123456}],"snmp.storage.idx36.used_pct":[{"ts":` + strconv.FormatInt(now, 10) + `,"value":55}]}`))
		case "/api/plugins/telemetry/DEVICE/device-1/values/attributes/SERVER_SCOPE":
			_, _ = w.Write([]byte(`[{"key":"nmsIdentity","value":{"displayName":"HQ Linux App Server"},"lastUpdateTs":` + strconv.FormatInt(now, 10) + `},{"key":"nmsMetrics","value":[{"key":"custom_metric","label":"Custom Metric","unit":"items","group":"custom","order":5,"warn":40,"critical":90}],"lastUpdateTs":` + strconv.FormatInt(now, 10) + `},{"key":"snmp.if.idx2.name","value":"eth0","lastUpdateTs":` + strconv.FormatInt(now, 10) + `},{"key":"snmp.storage.idx36.type","value":"Fixed Disk","lastUpdateTs":` + strconv.FormatInt(now, 10) + `},{"key":"snmp.storage.idx36.description","value":"/","lastUpdateTs":` + strconv.FormatInt(now, 10) + `},{"key":"route.ipv4.snapshot","value":"{\"supported\":true,\"source\":\"snmp_ip_cidr_route_table\",\"collected_at\":\"2026-06-16T10:50:36Z\",\"route_count\":2,\"default_route_count\":1,\"connected_route_count\":1,\"remote_route_count\":1,\"changed\":false,\"routes\":[{\"destination\":\"0.0.0.0/0\",\"next_hop\":\"172.16.20.1\",\"interface_id\":\"2\",\"interface_name\":\"eth0\",\"protocol\":\"local\",\"route_type\":\"remote\",\"is_default\":true}]}","lastUpdateTs":` + strconv.FormatInt(now, 10) + `}]`))
		case "/api/plugins/telemetry/DEVICE/device-1/values/attributes/CLIENT_SCOPE", "/api/plugins/telemetry/DEVICE/device-1/values/attributes/SHARED_SCOPE":
			_, _ = w.Write([]byte(`[]`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/dashboard", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{`"label":"HQ Linux App Server"`, `"key":"snmp.host.cpu.load_pct"`, `"label":"CPU Usage"`, `"status":"critical"`, `"label":"Custom Metric"`, `"group":"custom"`, `"label":"eth0 RX Throughput"`, `"subgroup":"eth0"`, `"label":"/ Storage Usage"`, `"subgroup":"/"`, `"type":"Fixed Disk"`, `"source":"snmp_ip_cidr_route_table"`, `"nextHop":"172.16.20.1"`, `"interfaceName":"eth0"`, `"rawTelemetryCount":5`, `"rawAttributeCount":6`, `"name":"eth0"`, `"index":"2"`} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected %s in dashboard response: %s", expected, body)
		}
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestThingsBoardStatusMissingConfig(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/thingsboard/status", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"status":"degraded"`) || !strings.Contains(body, `"configured":false`) || !strings.Contains(body, `"reachable":false`) || !strings.Contains(body, `"baseUrl":""`) {
		t.Fatalf("unexpected degraded response: %s", body)
	}
}

func TestSitesPlaceholderWhenThingsBoardNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `"source":"thingsboard"`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected placeholder response: %s", body)
	}
}

func TestSitesPlaceholderWhenThingsBoardUnauthorized(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"status":401,"message":"Authentication failed"}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "site",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `"ThingsBoard configured but unreachable or unauthorized"`) {
		t.Fatalf("unexpected unauthorized placeholder response: %s", body)
	}
}

func TestSitesLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-1"},"name":"HQ","type":"site"}],"hasNext":false}`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-1/values/attributes":
			_, _ = w.Write([]byte(`[]`))
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
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"siteKey":"hq"`) || !strings.Contains(body, `"source":"thingsboard"`) {
		t.Fatalf("unexpected sites response: %s", body)
	}
}

func TestThingsBoardStatusConfiguredButUnreachable(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  "http://127.0.0.1:1",
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "site",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/thingsboard/status", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	body := res.Body.String()
	if !strings.Contains(body, `"status":"degraded"`) || !strings.Contains(body, `"configured":true`) || !strings.Contains(body, `"reachable":false`) {
		t.Fatalf("unexpected unreachable response: %s", body)
	}
}

func TestSiteDevicesNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/headquarter/devices", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"siteKey":"headquarter"`) || !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected not configured response: %s", body)
	}
}

func TestSiteDevicesSiteNotFound(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-1"},"name":"HeadQuarter","type":"default"}],"hasNext":false}`))
		case "/api/plugins/telemetry/ASSET/asset-1/values/attributes":
			_, _ = w.Write([]byte(`[]`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/missing/devices", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", res.Code)
	}
	if !strings.Contains(res.Body.String(), `"error":"site not found"`) {
		t.Fatalf("unexpected not found response: %s", res.Body.String())
	}
}

func TestSiteDevicesLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-1"},"name":"HeadQuarter","type":"default"}],"hasNext":false}`))
		case "/api/plugins/telemetry/ASSET/asset-1/values/attributes":
			_, _ = w.Write([]byte(`[]`))
		case "/api/relations/info":
			_, _ = w.Write([]byte(`[{"type":"Contains","to":{"entityType":"DEVICE","id":"device-1"}},{"type":"Contains","to":{"entityType":"ASSET","id":"asset-2"}}]`))
		case "/api/device/device-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-1"},"name":"HQ-GATEWAY-1","type":"network-device","label":"HQ Gateway 1","deviceProfileName":"network-device"}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/headquarter/devices", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"siteKey":"headquarter"`) || !strings.Contains(body, `"deviceId":"device-1"`) || !strings.Contains(body, `"relationType":"Contains"`) {
		t.Fatalf("unexpected devices response: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestDeviceDetailNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"item":null`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected not configured response: %s", body)
	}
}

func TestDeviceDetailLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/device/device-1" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-1"},"name":"HQ-GATEWAY-1","type":"router","label":"HQ Gateway 1","deviceProfileName":"Network Device"}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"deviceId":"device-1"`) || !strings.Contains(body, `"profile":"Network Device"`) {
		t.Fatalf("unexpected device detail response: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestLatestTelemetryNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/telemetry/latest", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"deviceId":"device-1"`) || !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected telemetry not configured response: %s", body)
	}
}

func TestLatestTelemetryLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/plugins/telemetry/DEVICE/device-1/values/timeseries" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		_, _ = w.Write([]byte(`{"cpu_usage":[{"ts":1710000000000,"value":12.5}],"status":[{"ts":1710000000100,"value":"up"}]}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/telemetry/latest", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"key":"cpu_usage"`) || !strings.Contains(body, `"value":"12.5"`) || !strings.Contains(body, `"key":"status"`) {
		t.Fatalf("unexpected telemetry response: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestDeviceSummaryNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/summary", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"item":null`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected summary not configured response: %s", body)
	}
}

func TestDeviceSummaryLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/device/device-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-1"},"name":"HQ-GATEWAY-1","type":"router","label":"HQ Gateway 1","deviceProfileName":"Network Device"}`))
		case "/api/plugins/telemetry/DEVICE/device-1/values/timeseries":
			_, _ = w.Write([]byte(`{"cpu_usage":[{"ts":1710000000000,"value":12.5}],"status":[{"ts":1710000000100,"value":"up"}]}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/summary", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"deviceId":"device-1"`) || !strings.Contains(body, `"status":"active"`) || !strings.Contains(body, `"telemetryCount":2`) || !strings.Contains(body, `"lastTelemetryTs":1710000000100`) {
		t.Fatalf("unexpected device summary response: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestTelemetryHistoryLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/plugins/telemetry/DEVICE/device-1/values/timeseries" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		if got := r.URL.Query().Get("keys"); got != "cpu_usage" {
			t.Fatalf("unexpected keys query %q", got)
		}

		_, _ = w.Write([]byte(`{"cpu_usage":[{"ts":1710000000000,"value":12.5},{"ts":1710000060000,"value":"13.5"}]}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/telemetry/history?keys=cpu_usage&startTs=1710000000000&endTs=1710000060000&interval=60000", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"key":"cpu_usage"`) || !strings.Contains(body, `"numeric":true`) || !strings.Contains(body, `"rawValue":"13.5"`) {
		t.Fatalf("unexpected telemetry history response: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestTelemetryHistoryInfersNumericKeys(t *testing.T) {
	t.Parallel()

	requestCount := 0
	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/plugins/telemetry/DEVICE/device-1/values/timeseries" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		if requestCount == 1 {
			_, _ = w.Write([]byte(`{"cpu_usage":[{"ts":1710000000000,"value":"12.5"}],"status":[{"ts":1710000000000,"value":"up"}]}`))
			return
		}

		if got := r.URL.Query().Get("keys"); got != "cpu_usage" {
			t.Fatalf("unexpected inferred keys query %q", got)
		}

		_, _ = w.Write([]byte(`{"cpu_usage":[{"ts":1710000000000,"value":12.5}]}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/telemetry/history", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	if !strings.Contains(res.Body.String(), `"key":"cpu_usage"`) {
		t.Fatalf("unexpected inferred telemetry history response: %s", res.Body.String())
	}
}

func TestDeviceAttributesLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/plugins/telemetry/DEVICE/device-1/values/attributes/SERVER_SCOPE" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		_, _ = w.Write([]byte(`[{"key":"nmsIdentity","value":{"role":"gateway","vendor":"MikroTik"},"lastUpdateTs":1710000000000},{"key":"rack","value":"A1","lastUpdateTs":1710000000001}]`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices/device-1/attributes?scope=SERVER_SCOPE", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"entityType":"DEVICE"`) || !strings.Contains(body, `"nmsIdentity"`) || !strings.Contains(body, `"valueType":"json"`) || !strings.Contains(body, `"valueType":"string"`) {
		t.Fatalf("unexpected device attributes response: %s", body)
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestAssetAttributesLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/plugins/telemetry/ASSET/asset-1/values/attributes/SERVER_SCOPE" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		_, _ = w.Write([]byte(`[{"key":"nmsSite","value":{"region":"Jakarta"},"lastUpdateTs":1710000000000}]`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/assets/asset-1/attributes", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"entityType":"ASSET"`) || !strings.Contains(body, `"nmsSite"`) || !strings.Contains(body, `"SERVER_SCOPE"`) {
		t.Fatalf("unexpected asset attributes response: %s", body)
	}
}

func TestAlarmsNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alarms", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected alarms not configured response: %s", body)
	}
}

func TestAlarmsLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path != "/api/alarms" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("fetchOriginator"); got != "true" {
			t.Fatalf("expected fetchOriginator=true, got %s", got)
		}

		_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ALARM","id":"alarm-1"},"createdTime":1710000000000,"type":"Link Down","severity":"CRITICAL","status":"ACTIVE_UNACK","acknowledged":false,"cleared":false,"originator":{"entityType":"DEVICE","id":"device-1"},"originatorName":"hq-server-1","originatorLabel":"HQ Server 1","originatorDisplayName":"HQ Server 1","startTs":1710000000000,"endTs":1710000000000,"ackTs":0,"clearTs":0,"details":{}},{"id":{"entityType":"ALARM","id":"alarm-2"},"createdTime":1710000001000,"type":"High Latency","severity":"WARNING","status":"ACTIVE_ACK","acknowledged":true,"cleared":false,"originator":{"entityType":"DEVICE","id":"device-2"},"originatorName":"hq-router-1","originatorLabel":"HQ Router 1","originatorDisplayName":"HQ Router 1","startTs":1710000001000,"endTs":1710000001000,"ackTs":1710000005000,"clearTs":0,"details":{"threshold":200}}],"totalPages":1,"totalElements":2,"hasNext":false}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alarms", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{
		`"alarmId":"alarm-1"`, `"severity":"CRITICAL"`, `"status":"ACTIVE_UNACK"`,
		`"originatorName":"hq-server-1"`, `"acknowledged":false`,
		`"alarmId":"alarm-2"`, `"severity":"WARNING"`, `"status":"ACTIVE_ACK"`,
		`"acknowledged":true`, `"originatorName":"hq-router-1"`,
		`"totalElements":2`, `"hasNext":false`,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected %s in alarms response: %s", expected, body)
		}
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestAlarmAckLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/alarm/alarm-1/ack" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"id":{"entityType":"ALARM","id":"alarm-1"},"createdTime":1710000000000,"type":"Link Down","severity":"CRITICAL","status":"ACTIVE_ACK","acknowledged":true,"cleared":false,"originator":{"entityType":"DEVICE","id":"device-1"},"originatorName":"hq-server-1","originatorLabel":"HQ Server 1","originatorDisplayName":"HQ Server 1","startTs":1710000000000,"endTs":1710000000000,"ackTs":1710000005000,"clearTs":0,"details":{}}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alarms/alarm-1/ack", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{`"ok":true`, `"action":"ack"`, `"alarmId":"alarm-1"`, `"status":"ACTIVE_ACK"`, `"acknowledged":true`} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected %s in ack response: %s", expected, body)
		}
	}
}

func TestAlarmClearLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/alarm/alarm-1/clear" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"id":{"entityType":"ALARM","id":"alarm-1"},"createdTime":1710000000000,"type":"Link Down","severity":"CRITICAL","status":"CLEARED_ACK","acknowledged":true,"cleared":true,"originator":{"entityType":"DEVICE","id":"device-1"},"originatorName":"hq-server-1","originatorLabel":"HQ Server 1","originatorDisplayName":"HQ Server 1","startTs":1710000000000,"endTs":1710000000000,"ackTs":1710000005000,"clearTs":1710000010000,"details":{}}`))
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alarms/alarm-1/clear", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{`"ok":true`, `"action":"clear"`, `"alarmId":"alarm-1"`, `"status":"CLEARED_ACK"`, `"cleared":true`} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected %s in clear response: %s", expected, body)
		}
	}
}

func TestAlarmAckNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alarms/alarm-1/ack", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502, got %d", res.Code)
	}
}

func TestSiteAlarmsLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-1"},"name":"HeadQuarter","type":"default"}],"hasNext":false}`))
		case "/api/plugins/telemetry/ASSET/asset-1/values/attributes":
			_, _ = w.Write([]byte(`[]`))
		case "/api/relations/info":
			_, _ = w.Write([]byte(`[{"type":"Contains","to":{"entityType":"DEVICE","id":"device-1"}}]`))
		case "/api/device/device-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-1"},"name":"hq-server-1","type":"network-device","label":"HQ Server 1","deviceProfileName":"network-device"}`))
		case "/api/alarm/DEVICE/device-1":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ALARM","id":"alarm-1"},"createdTime":1710000000000,"type":"Link Down","severity":"CRITICAL","status":"ACTIVE_UNACK","acknowledged":false,"cleared":false,"originator":{"entityType":"DEVICE","id":"device-1"},"originatorName":"hq-server-1","originatorLabel":"HQ Server 1","originatorDisplayName":"HQ Server 1","startTs":1710000000000,"endTs":1710000000000,"ackTs":0,"clearTs":0,"details":{}}],"totalPages":1,"totalElements":1,"hasNext":false}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/headquarter/alarms", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{
		`"alarmId":"alarm-1"`, `"severity":"CRITICAL"`, `"originatorName":"hq-server-1"`,
		`"totalElements":1`, `alarms loaded from ThingsBoard`,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected %s in site alarms response: %s", expected, body)
		}
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestSiteTopologyLoadedFromThingsBoard(t *testing.T) {
	t.Parallel()

	snapshotJSON := `{"site_key":"br-b","asset_id":"asset-brb","generated_at":"2026-06-15T13:58:48.141281591Z","device_count":3,"edge_count":7,"fingerprint":"abb7f7ba953a5ef8171cca6e2c0c616f3687b5bfb2584b6cc791cdb6109062b4","nodes":[{"id":"device:linux-br-b-server","kind":"device","name":"linux-br-b-server","device_id":"linux-br-b-server"},{"id":"device:linux-br-b-server-2","kind":"device","name":"linux-br-b-server-2","device_id":"linux-br-b-server-2"},{"id":"device:mikrotik-br-b-router","kind":"device","name":"mikrotik-br-b-router","device_id":"mikrotik-br-b-router"},{"id":"external:10.10.10.1","kind":"external_gateway","name":"10.10.10.1"},{"id":"subnet:10.10.10.0/24","kind":"subnet","name":"10.10.10.0/24","subnet":"10.10.10.0/24"},{"id":"subnet:172.16.30.0/24","kind":"subnet","name":"172.16.30.0/24","subnet":"172.16.30.0/24"}],"edges":[{"from":"device:linux-br-b-server","to":"device:linux-br-b-server-2","reason":"next_hop_match","resolved":true},{"from":"device:linux-br-b-server","to":"subnet:172.16.30.0/24","reason":"connected_subnet","resolved":true},{"from":"device:linux-br-b-server-2","to":"device:linux-br-b-server","reason":"next_hop_match","resolved":true},{"from":"device:linux-br-b-server-2","to":"subnet:172.16.30.0/24","reason":"connected_subnet","resolved":true},{"from":"device:mikrotik-br-b-router","to":"external:10.10.10.1","reason":"default_route","resolved":false},{"from":"device:mikrotik-br-b-router","to":"subnet:10.10.10.0/24","reason":"connected_subnet","resolved":true},{"from":"device:mikrotik-br-b-router","to":"subnet:172.16.30.0/24","reason":"connected_subnet","resolved":true}]}`

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-brb"},"name":"Branch-B","type":"default"}],"hasNext":false}`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-brb/values/attributes":
			_, _ = w.Write([]byte(`[{"key":"siteKey","value":"br-b","lastUpdateTs":1710000000000}]`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-brb/values/attributes/SERVER_SCOPE":
			_, _ = w.Write([]byte(`[{"key":"topology.logical.ipv4.snapshot","value":` + snapshotJSON + `,"lastUpdateTs":1710000000000}]`))
		case r.URL.Path == "/api/relations/info":
			_, _ = w.Write([]byte(`[{"type":"Contains","to":{"entityType":"DEVICE","id":"device-brb-1"}},{"type":"Contains","to":{"entityType":"DEVICE","id":"device-brb-2"}},{"type":"Contains","to":{"entityType":"DEVICE","id":"device-brb-3"}}]`))
		case r.URL.Path == "/api/device/device-brb-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-brb-1"},"name":"linux-br-b-server","type":"network-device","deviceProfileName":"network-device"}`))
		case r.URL.Path == "/api/device/device-brb-2":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-brb-2"},"name":"linux-br-b-server-2","type":"network-device","deviceProfileName":"network-device"}`))
		case r.URL.Path == "/api/device/device-brb-3":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-brb-3"},"name":"mikrotik-br-b-router","type":"network-device","deviceProfileName":"network-device"}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/br-b/topology", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{
		`"supported":true`,
		`"deviceCount":3`,
		`"edgeCount":7`,
		`"subnetCount":2`,
		`"externalCount":1`,
		`"nodeCount":6`,
		`"kind":"device"`,
		`"kind":"subnet"`,
		`"kind":"external_gateway"`,
		`"label":"Device"`,
		`"label":"Subnet"`,
		`"label":"Gateway"`,
		`"reason":"next_hop_match"`,
		`"reason":"connected_subnet"`,
		`"reason":"default_route"`,
		`"resolved":true`,
		`"resolved":false`,
		`"generatedAt":"2026-06-15T13:58:48.141281591Z"`,
		`"fingerprint":"abb7f7ba953a5ef8171cca6e2c0c616f3687b5bfb2584b6cc791cdb6109062b4"`,
		`"displayType":"Router / Gateway"`,
		`"displayRole":"router"`,
		`"displayShape":"router"`,
		`"layer":"gateway"`,
		`"displayType":"Server"`,
		`"displayRole":"server"`,
		`"displayShape":"server"`,
		`"layer":"endpoint"`,
		`"displayType":"LAN Segment"`,
		`"displayRole":"subnet"`,
		`"displayShape":"segment"`,
		`"layer":"network"`,
		`"displayType":"External Gateway"`,
		`"displayRole":"external_gateway"`,
		`"displayShape":"external"`,
		`"layer":"external"`,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected %s in topology response: %s", expected, body)
		}
	}
	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}

func TestSiteTopologyNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/br-b/topology", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"supported":false`) || !strings.Contains(body, `"nodes":[]`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected topology not configured response: %s", body)
	}
}

func TestSiteTopologyMissingSnapshot(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-hq"},"name":"HeadQuarter","type":"default"}],"hasNext":false}`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-hq/values/attributes":
			_, _ = w.Write([]byte(`[{"key":"siteKey","value":"hq","lastUpdateTs":1710000000000}]`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-hq/values/attributes/SERVER_SCOPE":
			_, _ = w.Write([]byte(`[{"key":"someKey","value":"test","lastUpdateTs":1710000000000}]`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/hq/topology", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"supported":false`) || !strings.Contains(body, `"nodes":[]`) {
		t.Fatalf("expected missing snapshot response: %s", body)
	}
}

func TestSiteTopologySiteNotFound(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-hq"},"name":"HeadQuarter","type":"default"}],"hasNext":false}`))
		case r.URL.Path == "/api/plugins/telemetry/ASSET/asset-hq/values/attributes":
			_, _ = w.Write([]byte(`[{"key":"siteKey","value":"hq","lastUpdateTs":1710000000000}]`))
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/missing/topology", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", res.Code)
	}
	if !strings.Contains(res.Body.String(), `"error":"site not found"`) {
		t.Fatalf("expected not found error: %s", res.Body.String())
	}
}

func TestSiteAlarmsNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sites/headquarter/alarms", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("unexpected site alarms not configured response: %s", body)
	}
}

func TestAlarmsConfiguredButUnreachable(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  "http://127.0.0.1:1",
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alarms", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"items":[]`) || !strings.Contains(body, `could not be loaded`) {
		t.Fatalf("expected empty alarms with error message: %s", body)
	}
}

func TestReportSummaryNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/summary", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("expected not configured message: %s", body)
	}
}

func TestReportSitesNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/sites", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("expected not configured message: %s", body)
	}
}

func TestReportDevicesNotConfigured(t *testing.T) {
	t.Parallel()

	router := NewRouter(config.Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"http://localhost:3000"},
		CacheTTLSeconds:    30,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/devices", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	if !strings.Contains(body, `"ThingsBoard integration not configured"`) {
		t.Fatalf("expected not configured message: %s", body)
	}
}

func TestReportSummaryAndSitesAndDevices(t *testing.T) {
	t.Parallel()

	thingsBoard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/tenant/assets":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ASSET","id":"asset-hq"},"name":"HeadQuarter","type":"default"},{"id":{"entityType":"ASSET","id":"asset-bb"},"name":"Branch-B","type":"default"}],"hasNext":false}`))
		case "/api/plugins/telemetry/ASSET/asset-hq/values/attributes":
			_, _ = w.Write([]byte(`[]`))
		case "/api/plugins/telemetry/ASSET/asset-bb/values/attributes":
			_, _ = w.Write([]byte(`[]`))
		case "/api/relations/info":
			if r.URL.Query().Get("fromId") == "asset-hq" {
				_, _ = w.Write([]byte(`[{"type":"Contains","to":{"entityType":"DEVICE","id":"device-hq-1"}},{"type":"Contains","to":{"entityType":"DEVICE","id":"device-hq-2"}}]`))
			} else {
				_, _ = w.Write([]byte(`[{"type":"Contains","to":{"entityType":"DEVICE","id":"device-bb-1"}}]`))
			}
		case "/api/device/device-hq-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-hq-1"},"name":"hq-router","type":"network-device","label":"HQ Router","deviceProfileName":"network-device"}`))
		case "/api/device/device-hq-2":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-hq-2"},"name":"hq-server","type":"network-device","label":"HQ Server","deviceProfileName":"network-device"}`))
		case "/api/device/device-bb-1":
			_, _ = w.Write([]byte(`{"id":{"entityType":"DEVICE","id":"device-bb-1"},"name":"bb-router","type":"network-device","label":"BB Router","deviceProfileName":"network-device"}`))
		case "/api/plugins/telemetry/DEVICE/device-hq-1/values/timeseries":
			_, _ = w.Write([]byte(`{"icmp.latency_ms":[{"ts":1710000000000,"value":"12.5"}],"icmp.packet_loss_pct":[{"ts":1710000000000,"value":"0"}],"snmp.host.cpu.load_pct":[{"ts":1710000000000,"value":"45.2"}],"snmp.host.memory.used_pct":[{"ts":1710000000000,"value":"62.1"}]}`))
		case "/api/plugins/telemetry/DEVICE/device-hq-2/values/timeseries":
			_, _ = w.Write([]byte(`{"snmp.host.cpu.load_pct":[{"ts":1710000000000,"value":"82.5"}],"snmp.host.memory.used_pct":[{"ts":1710000000000,"value":"91.3"}]}`))
		case "/api/plugins/telemetry/DEVICE/device-bb-1/values/timeseries":
			_, _ = w.Write([]byte(`{"icmp.latency_ms":[{"ts":1710000000000,"value":"200.0"}],"icmp.packet_loss_pct":[{"ts":1710000000000,"value":"3.5"}]}`))
		case "/api/alarms":
			_, _ = w.Write([]byte(`{"data":[{"id":{"entityType":"ALARM","id":"alarm-1"},"createdTime":1710000000000,"type":"Link Down","severity":"CRITICAL","status":"ACTIVE_UNACK","acknowledged":false,"cleared":false,"originator":{"entityType":"DEVICE","id":"device-hq-2"},"originatorName":"hq-server","originatorLabel":"HQ Server","originatorDisplayName":"HQ Server","startTs":1710000000000,"endTs":1710000000000,"ackTs":0,"clearTs":0,"details":{}},{"id":{"entityType":"ALARM","id":"alarm-2"},"createdTime":1710000000001,"type":"High Latency","severity":"MAJOR","status":"ACTIVE_ACK","acknowledged":true,"cleared":false,"originator":{"entityType":"DEVICE","id":"device-bb-1"},"originatorName":"bb-router","originatorLabel":"BB Router","originatorDisplayName":"BB Router","startTs":1710000000001,"endTs":1710000000001,"ackTs":1710000000001,"clearTs":0,"details":{}}],"totalPages":1,"totalElements":2,"hasNext":false}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer thingsBoard.Close()

	router := NewRouter(config.Config{
		Port:                "8080",
		ThingsBoardBaseURL:  thingsBoard.URL,
		ThingsBoardAPIKey:   "test-token",
		ThingsBoardSiteType: "default",
		CORSAllowedOrigins:  []string{"http://localhost:3000"},
		CacheTTLSeconds:     30,
		HasThingsBoardSetup: true,
	}, slog.New(slog.NewJSONHandler(io.Discard, nil)))

	// Test summary endpoint
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/summary", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("summary: expected status 200, got %d", res.Code)
	}
	body := res.Body.String()
	for _, expected := range []string{
		`"siteCount":2`, `"deviceCount":3`,
		`"activeAlarmCount":2`, `"criticalAlarmCount":2`,
		`"Report summary generated"`,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("summary: expected %s in response: %s", expected, body)
		}
	}

	// Test sites endpoint
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/reports/sites", nil)
	res2 := httptest.NewRecorder()
	router.ServeHTTP(res2, req2)

	if res2.Code != http.StatusOK {
		t.Fatalf("sites: expected status 200, got %d", res2.Code)
	}
	body2 := res2.Body.String()
	for _, expected := range []string{
		`"siteName":"HeadQuarter"`, `"siteName":"Branch-B"`,
		`"deviceCount":2`, `"deviceCount":1`,
		`"Site report generated"`,
	} {
		if !strings.Contains(body2, expected) {
			t.Fatalf("sites: expected %s in response: %s", expected, body2)
		}
	}

	// Test devices endpoint
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/reports/devices", nil)
	res3 := httptest.NewRecorder()
	router.ServeHTTP(res3, req3)

	if res3.Code != http.StatusOK {
		t.Fatalf("devices: expected status 200, got %d", res3.Code)
	}
	body3 := res3.Body.String()
	for _, expected := range []string{
		`"name":"hq-router"`, `"name":"hq-server"`, `"name":"bb-router"`,
		`"Device report generated"`,
	} {
		if !strings.Contains(body3, expected) {
			t.Fatalf("devices: expected %s in response: %s", expected, body3)
		}
	}

	if strings.Contains(body, "test-token") {
		t.Fatalf("token leaked in response body: %s", body)
	}
}
