package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
	"github.com/isapr/nms-dashboard/apps/bff/internal/nms"
	"github.com/isapr/nms-dashboard/apps/bff/internal/thingsboard"
)

var (
	nonSlugChars         = regexp.MustCompile(`[^a-z0-9]+`)
	interfaceMetricKeyRE = regexp.MustCompile(`^snmp\.if\.idx([^.]+)\.([a-zA-Z0-9_]+)$`)
	storageMetricKeyRE   = regexp.MustCompile(`^snmp\.(?:host\.)?storage\.idx([^.]+)\.([a-zA-Z0-9_]+)$`)
)

type apiServer struct {
	cfg    config.Config
	logger *slog.Logger
	tb     *thingsboard.Client
}

type integrationStatusResponse struct {
	Status      string                    `json:"status"`
	ThingsBoard thingsBoardStatusResponse `json:"thingsboard"`
}

type thingsBoardStatusResponse struct {
	Configured bool   `json:"configured"`
	Reachable  bool   `json:"reachable"`
	BaseURL    string `json:"baseUrl"`
}

type sitesResponse struct {
	Items   []nms.Site `json:"items"`
	Source  string     `json:"source,omitempty"`
	Message string     `json:"message,omitempty"`
}

type siteDevicesResponse struct {
	SiteKey string       `json:"siteKey"`
	Items   []nms.Device `json:"items"`
	Source  string       `json:"source,omitempty"`
	Message string       `json:"message,omitempty"`
}

type deviceDetailResponse struct {
	Item    *nms.DeviceDetail `json:"item"`
	Source  string            `json:"source,omitempty"`
	Message string            `json:"message,omitempty"`
}

type latestTelemetryResponse struct {
	DeviceID string               `json:"deviceId"`
	Items    []nms.TelemetryValue `json:"items"`
	Source   string               `json:"source,omitempty"`
	Message  string               `json:"message,omitempty"`
}

type telemetryHistoryResponse struct {
	DeviceID string                `json:"deviceId"`
	Series   []nms.TelemetrySeries `json:"series"`
	Source   string                `json:"source,omitempty"`
	Message  string                `json:"message,omitempty"`
}

type attributesResponse struct {
	EntityType string                          `json:"entityType"`
	EntityID   string                          `json:"entityId"`
	Scopes     map[string][]nms.AttributeValue `json:"scopes"`
	Source     string                          `json:"source,omitempty"`
	Message    string                          `json:"message,omitempty"`
}

type deviceSummaryResponse struct {
	Item    *nms.DeviceSummary `json:"item"`
	Source  string             `json:"source,omitempty"`
	Message string             `json:"message,omitempty"`
}

type alarmsResponse struct {
	nms.AlarmPage
	Source  string `json:"source,omitempty"`
	Message string `json:"message,omitempty"`
}

type alarmActionResponse struct {
	OK      bool      `json:"ok"`
	Action  string    `json:"action"`
	AlarmID string    `json:"alarmId"`
	Alarm   nms.Alarm `json:"alarm"`
	Source  string    `json:"source,omitempty"`
	Message string    `json:"message,omitempty"`
}

type deviceDashboardResponse struct {
	nms.DeviceDashboard
	Source  string `json:"source,omitempty"`
	Message string `json:"message,omitempty"`
}

type reportSummaryResponse struct {
	Range              nms.ReportRange       `json:"range"`
	Summary            nms.ReportSummaryKPI  `json:"summary"`
	TopSitesByAlarms   []nms.ReportSiteRow   `json:"topSitesByAlarms"`
	TopDevicesByIssues []nms.ReportDeviceRow `json:"topDevicesByIssues"`
	GeneratedAt        string                `json:"generatedAt"`
	Source             string                `json:"source,omitempty"`
	Message            string                `json:"message,omitempty"`
}

type reportSitesListResponse struct {
	Range   nms.ReportRange     `json:"range"`
	Items   []nms.ReportSiteRow `json:"items"`
	Source  string              `json:"source,omitempty"`
	Message string              `json:"message,omitempty"`
}

type reportDevicesListResponse struct {
	Range   nms.ReportRange       `json:"range"`
	Items   []nms.ReportDeviceRow `json:"items"`
	Source  string                `json:"source,omitempty"`
	Message string                `json:"message,omitempty"`
}

type metricCatalogEntry struct {
	Key        string
	Label      string
	ShortLabel string
	Unit       string
	Group      string
	Subgroup   string
	Order      int
	VisualType string
	Warn       float64
	Critical   float64
	HasWarn    bool
	HasCrit    bool
}

func newAPIServer(cfg config.Config, logger *slog.Logger) *apiServer {
	server := &apiServer{cfg: cfg, logger: logger}

	if cfg.HasThingsBoardSetup {
		client, err := thingsboard.NewClient(thingsboard.Config{
			BaseURL: cfg.ThingsBoardBaseURL,
			APIKey:  cfg.ThingsBoardAPIKey,
		})
		if err != nil {
			logger.Error("thingsboard client initialization failed", "error", err)
		} else {
			server.tb = client
		}
	}

	return server
}

func (s *apiServer) registerRoutes(r chi.Router) {
	r.Get("/health", s.healthHandler())
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", s.healthHandler())
		r.Get("/integrations/thingsboard/status", s.thingsBoardStatusHandler())
		r.Get("/alarms", s.alarmsHandler())
		r.Post("/alarms/{alarmId}/ack", s.alarmAckHandler())
		r.Post("/alarms/{alarmId}/clear", s.alarmClearHandler())
		r.Get("/sites", s.sitesHandler())
		r.Get("/sites/{siteKey}/devices", s.siteDevicesHandler())
		r.Get("/sites/{siteKey}/alarms", s.siteAlarmsHandler())
		r.Get("/sites/{siteKey}/topology", s.siteTopologyHandler())
		r.Get("/devices/{deviceId}", s.deviceDetailHandler())
		r.Get("/devices/{deviceId}/telemetry/latest", s.latestTelemetryHandler())
		r.Get("/devices/{deviceId}/telemetry/history", s.telemetryHistoryHandler())
		r.Get("/devices/{deviceId}/summary", s.deviceSummaryHandler())
		r.Get("/devices/{deviceId}/dashboard", s.deviceDashboardHandler())
		r.Get("/devices/{deviceId}/alarms", s.deviceAlarmsHandler())
		r.Get("/devices/{deviceId}/attributes", s.deviceAttributesHandler())
		r.Get("/assets/{assetId}/attributes", s.assetAttributesHandler())
		r.Get("/reports/summary", s.reportsSummaryHandler())
		r.Get("/reports/sites", s.reportsSitesHandler())
		r.Get("/reports/devices", s.reportsDevicesHandler())
	})
}

func (s *apiServer) healthHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		response := healthResponse{
			Service:   "nms-bff",
			Status:    "ok",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Version:   "phase-2",
			Phase:     "thingsboard-sites",
			Config: map[string]interface{}{
				"port":                     s.cfg.Port,
				"cacheTtlSeconds":          s.cfg.CacheTTLSeconds,
				"thingsBoardBaseUrlSet":    s.cfg.ThingsBoardBaseURL != "",
				"thingsBoardApiKeySet":     s.cfg.ThingsBoardAPIKey != "",
				"thingsBoardConfigured":    s.cfg.HasThingsBoardSetup,
				"thingsBoardClientEnabled": s.tb != nil,
				"thingsBoardSiteAssetType": s.cfg.ThingsBoardSiteType,
				"corsAllowedOrigins":       s.cfg.CORSAllowedOrigins,
			},
		}

		writeJSON(w, http.StatusOK, response)
	}
}

func (s *apiServer) thingsBoardStatusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response := integrationStatusResponse{
			Status: "degraded",
			ThingsBoard: thingsBoardStatusResponse{
				Configured: s.cfg.HasThingsBoardSetup,
				Reachable:  false,
				BaseURL:    s.cfg.ThingsBoardBaseURL,
			},
		}

		if s.tb != nil {
			if err := s.tb.CheckStatus(r.Context(), s.cfg.ThingsBoardSiteType); err == nil {
				response.Status = "ok"
				response.ThingsBoard.Reachable = true
			} else {
				s.logger.Warn("thingsboard status check failed", "error", err)
			}
		}

		writeJSON(w, http.StatusOK, response)
	}
}

func (s *apiServer) alarmsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard integration not configured",
			})
			return
		}

		page := parseIntQuery(r, "page", 0)
		pageSize := parseIntQuery(r, "pageSize", 20)

		alarmPage, err := s.tb.ListAlarms(r.Context(), thingsboard.AlarmQuery{
			SearchStatus: r.URL.Query().Get("searchStatus"),
			Status:       r.URL.Query().Get("status"),
			TextSearch:   r.URL.Query().Get("textSearch"),
			Page:         page,
			PageSize:     pageSize,
			SortProperty: "createdTime",
			SortOrder:    "DESC",
			StartTime:    parseInt64Query(r, "startTime", 0),
			EndTime:      parseInt64Query(r, "endTime", 0),
		})
		if err != nil {
			s.logger.Warn("load alarms failed", "error", err)
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard configured but alarms could not be loaded",
			})
			return
		}

		items := make([]nms.Alarm, 0, len(alarmPage.Items))
		for _, alarm := range alarmPage.Items {
			items = append(items, normalizeAlarm(alarm))
		}

		totalPages := 0
		if pageSize > 0 {
			totalPages = int(alarmPage.Total) / pageSize
			if int(alarmPage.Total)%pageSize > 0 {
				totalPages++
			}
		}

		writeJSON(w, http.StatusOK, alarmsResponse{
			AlarmPage: nms.AlarmPage{
				Items:         items,
				Page:          page,
				PageSize:      pageSize,
				TotalElements: alarmPage.Total,
				TotalPages:    totalPages,
				HasNext:       alarmPage.HasNext,
			},
			Source:  "thingsboard",
			Message: "Alarms loaded from ThingsBoard",
		})
	}
}

func normalizeAlarm(alarm thingsboard.AlarmInfo) nms.Alarm {
	var details any
	if alarm.Details != nil && string(alarm.Details) != "null" {
		details = alarm.Details
	}

	return nms.Alarm{
		AlarmID:               alarm.ID.ID,
		Name:                  alarm.OriginatorName,
		Type:                  alarm.Type,
		Severity:              alarm.Severity,
		Status:                alarm.Status,
		Acknowledged:          alarm.Acknowledged,
		Cleared:               alarm.Cleared,
		OriginatorID:          alarm.Originator.ID,
		OriginatorType:        alarm.Originator.EntityType,
		OriginatorName:        alarm.OriginatorName,
		OriginatorLabel:       alarm.OriginatorLabel,
		OriginatorDisplayName: alarm.OriginatorDisplayName,
		CreatedAt:             tsOrEmpty(alarm.CreatedTime),
		StartAt:               tsOrEmpty(alarm.StartTs),
		EndAt:                 tsOrEmpty(alarm.EndTs),
		AckAt:                 tsOrEmpty(alarm.AckTs),
		ClearAt:               tsOrEmpty(alarm.ClearTs),
		Details:               details,
	}
}

func (s *apiServer) alarmAckHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.handleAlarmAction(w, r, "ack")
	}
}

func (s *apiServer) alarmClearHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.handleAlarmAction(w, r, "clear")
	}
}

func (s *apiServer) handleAlarmAction(w http.ResponseWriter, r *http.Request, action string) {
	alarmID := strings.TrimSpace(chi.URLParam(r, "alarmId"))
	if alarmID == "" {
		writeError(w, http.StatusBadRequest, "alarmId is required")
		return
	}
	if s.tb == nil {
		writeError(w, http.StatusBadGateway, "ThingsBoard integration not configured")
		return
	}

	var (
		alarm thingsboard.AlarmInfo
		err   error
	)
	switch action {
	case "ack":
		alarm, err = s.tb.AcknowledgeAlarm(r.Context(), alarmID)
	case "clear":
		alarm, err = s.tb.ClearAlarm(r.Context(), alarmID)
	default:
		writeError(w, http.StatusBadRequest, "unsupported alarm action")
		return
	}
	if err != nil {
		s.logger.Warn("alarm action failed", "action", action, "alarmId", alarmID, "error", err)
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	message := "Alarm acknowledged"
	if action == "clear" {
		message = "Alarm cleared"
	}
	writeJSON(w, http.StatusOK, alarmActionResponse{
		OK:      true,
		Action:  action,
		AlarmID: alarmID,
		Alarm:   normalizeAlarm(alarm),
		Source:  "thingsboard",
		Message: message,
	})
}

func tsOrEmpty(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return timestampRFC3339(ts)
}

func (s *apiServer) sitesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeJSON(w, http.StatusOK, sitesResponse{
				Items:   []nms.Site{},
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		sites, err := s.loadSites(r.Context())
		if err != nil {
			s.logger.Warn("load sites failed", "error", err)
			writeJSON(w, http.StatusOK, sitesResponse{
				Items:   []nms.Site{},
				Source:  "thingsboard",
				Message: "ThingsBoard configured but unreachable or unauthorized",
			})
			return
		}

		message := "Sites loaded from ThingsBoard"
		if len(sites) == 0 {
			message = "No sites found in ThingsBoard"
		}

		writeJSON(w, http.StatusOK, sitesResponse{
			Items:   sites,
			Source:  "thingsboard",
			Message: message,
		})
	}
}

func (s *apiServer) siteDevicesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		siteKey := chi.URLParam(r, "siteKey")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, siteDevicesResponse{
				SiteKey: siteKey,
				Items:   []nms.Device{},
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		sites, err := s.loadSites(r.Context())
		if err != nil {
			s.logger.Warn("load sites for devices failed", "siteKey", siteKey, "error", err)
			writeJSON(w, http.StatusOK, siteDevicesResponse{
				SiteKey: siteKey,
				Items:   []nms.Device{},
				Source:  "thingsboard",
				Message: "ThingsBoard configured but devices could not be loaded",
			})
			return
		}

		var selected *nms.Site
		for i := range sites {
			if sites[i].SiteKey == siteKey {
				selected = &sites[i]
				break
			}
		}

		if selected == nil {
			writeError(w, http.StatusNotFound, "site not found")
			return
		}

		devices, err := s.loadSiteDevices(r.Context(), *selected)
		if err != nil {
			s.logger.Warn("load site devices failed", "siteKey", siteKey, "error", err)
			writeJSON(w, http.StatusOK, siteDevicesResponse{
				SiteKey: siteKey,
				Items:   []nms.Device{},
				Source:  "thingsboard",
				Message: "ThingsBoard configured but devices could not be loaded",
			})
			return
		}

		message := "Devices loaded from ThingsBoard"
		if len(devices) == 0 {
			message = "No devices found for site"
		}

		writeJSON(w, http.StatusOK, siteDevicesResponse{
			SiteKey: selected.SiteKey,
			Items:   devices,
			Source:  "thingsboard",
			Message: message,
		})
	}
}

func (s *apiServer) siteAlarmsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		siteKey := chi.URLParam(r, "siteKey")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard integration not configured",
			})
			return
		}

		sites, err := s.loadSites(r.Context())
		if err != nil {
			s.logger.Warn("load sites for alarms failed", "siteKey", siteKey, "error", err)
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard configured but alarms could not be loaded",
			})
			return
		}

		var selected *nms.Site
		for i := range sites {
			if sites[i].SiteKey == siteKey {
				selected = &sites[i]
				break
			}
		}
		if selected == nil {
			writeError(w, http.StatusNotFound, "site not found")
			return
		}

		devices, err := s.loadSiteDevices(r.Context(), *selected)
		if err != nil {
			s.logger.Warn("load site devices for alarms failed", "siteKey", siteKey, "error", err)
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard configured but alarms could not be loaded",
			})
			return
		}

		seen := make(map[string]bool)
		items := make([]nms.Alarm, 0)

		for _, device := range devices {
			alarmPage, err := s.tb.ListEntityAlarms(r.Context(), "DEVICE", device.DeviceID, thingsboard.AlarmQuery{
				Page:         0,
				PageSize:     50,
				SearchStatus: r.URL.Query().Get("searchStatus"),
				SortProperty: "createdTime",
				SortOrder:    "DESC",
			})
			if err != nil {
				s.logger.Warn("load device alarms failed", "deviceId", device.DeviceID, "error", err)
				continue
			}

			for _, alarm := range alarmPage.Items {
				if !seen[alarm.ID.ID] {
					seen[alarm.ID.ID] = true
					items = append(items, normalizeAlarm(alarm))
				}
			}
		}

		sort.Slice(items, func(i, j int) bool {
			return items[i].CreatedAt > items[j].CreatedAt
		})

		count := int64(len(items))
		pageSize := 50
		totalPages := int(count) / pageSize
		if int(count)%pageSize > 0 {
			totalPages++
		}

		writeJSON(w, http.StatusOK, alarmsResponse{
			AlarmPage: nms.AlarmPage{
				Items:         items,
				TotalElements: count,
				TotalPages:    totalPages,
			},
			Source:  "thingsboard",
			Message: "Site alarms loaded from ThingsBoard",
		})
	}
}

func (s *apiServer) deviceAlarmsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard integration not configured",
			})
			return
		}

		alarmPage, err := s.tb.ListEntityAlarms(r.Context(), "DEVICE", deviceID, thingsboard.AlarmQuery{
			Page:         parseIntQuery(r, "page", 0),
			PageSize:     parseIntQuery(r, "pageSize", 20),
			SearchStatus: r.URL.Query().Get("searchStatus"),
			Status:       r.URL.Query().Get("status"),
			TextSearch:   r.URL.Query().Get("textSearch"),
			SortProperty: "createdTime",
			SortOrder:    "DESC",
			StartTime:    parseInt64Query(r, "startTime", 0),
			EndTime:      parseInt64Query(r, "endTime", 0),
		})
		if err != nil {
			s.logger.Warn("load device alarms failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, alarmsResponse{
				AlarmPage: nms.AlarmPage{Items: []nms.Alarm{}},
				Source:    "thingsboard",
				Message:   "ThingsBoard configured but alarms could not be loaded",
			})
			return
		}

		items := make([]nms.Alarm, 0, len(alarmPage.Items))
		for _, alarm := range alarmPage.Items {
			items = append(items, normalizeAlarm(alarm))
		}

		totalPages := 0
		pageSize := alarmPage.PageSize
		if pageSize > 0 {
			totalPages = int(alarmPage.Total) / pageSize
			if int(alarmPage.Total)%pageSize > 0 {
				totalPages++
			}
		}

		writeJSON(w, http.StatusOK, alarmsResponse{
			AlarmPage: nms.AlarmPage{
				Items:         items,
				Page:          alarmPage.Page,
				PageSize:      pageSize,
				TotalElements: alarmPage.Total,
				TotalPages:    totalPages,
				HasNext:       alarmPage.HasNext,
			},
			Source:  "thingsboard",
			Message: "Device alarms loaded from ThingsBoard",
		})
	}
}

func (s *apiServer) siteTopologyHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		siteKey := chi.URLParam(r, "siteKey")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, nms.SiteTopologyResponse{
				Site: nms.SiteTopologySiteInfo{SiteKey: siteKey},
				Topology: nms.SiteTopology{
					Nodes: []nms.SiteTopologyNode{},
					Edges: []nms.SiteTopologyEdge{},
				},
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		sites, err := s.loadSites(r.Context())
		if err != nil {
			s.logger.Warn("load sites for topology failed", "siteKey", siteKey, "error", err)
			writeJSON(w, http.StatusOK, nms.SiteTopologyResponse{
				Site: nms.SiteTopologySiteInfo{SiteKey: siteKey},
				Topology: nms.SiteTopology{
					Nodes: []nms.SiteTopologyNode{},
					Edges: []nms.SiteTopologyEdge{},
				},
				Source:  "thingsboard",
				Message: "ThingsBoard configured but sites could not be loaded",
			})
			return
		}

		var selected *nms.Site
		for i := range sites {
			if sites[i].SiteKey == siteKey {
				selected = &sites[i]
				break
			}
		}
		if selected == nil {
			writeError(w, http.StatusNotFound, "site not found")
			return
		}

		attrs, err := s.tb.GetEntityAttributes(r.Context(), "ASSET", selected.AssetID, "SERVER_SCOPE", nil)
		if err != nil {
			s.logger.Warn("load asset attributes for topology failed", "assetId", selected.AssetID, "error", err)
			writeJSON(w, http.StatusOK, nms.SiteTopologyResponse{
				Site: nms.SiteTopologySiteInfo{
					SiteKey: selected.SiteKey,
					AssetID: selected.AssetID,
					Name:    selected.Name,
					Type:    selected.Type,
				},
				Topology: nms.SiteTopology{
					Nodes: []nms.SiteTopologyNode{},
					Edges: []nms.SiteTopologyEdge{},
				},
				Source:  "thingsboard",
				Message: "Asset attributes could not be loaded",
			})
			return
		}

		attributeMap := attributesByKey(normalizeAttributes(attrs))
		topology := parseSiteTopologySnapshot(attributeMap)

		if topology.Supported {
			if info, err := s.loadSiteDeviceInfo(r.Context(), *selected); err == nil {
				for i := range topology.Nodes {
					if topology.Nodes[i].Kind == "device" {
						if meta, ok := info[topology.Nodes[i].Name]; ok {
							topology.Nodes[i].Profile = meta.Profile
							topology.Nodes[i].Type = meta.Type
						}
					}
				}
			} else {
				s.logger.Warn("load device info for topology enrichment failed", "siteKey", siteKey, "error", err)
			}
		}

		message := "Site topology loaded from ThingsBoard"
		if !topology.Supported {
			message = "Site topology not available (no topology.logical.ipv4.snapshot attribute)"
		}

		writeJSON(w, http.StatusOK, nms.SiteTopologyResponse{
			Site: nms.SiteTopologySiteInfo{
				SiteKey: selected.SiteKey,
				AssetID: selected.AssetID,
				Name:    selected.Name,
				Type:    selected.Type,
			},
			Topology: topology,
			Source:   "thingsboard",
			Message:  message,
		})
	}
}

func parseSiteTopologySnapshot(attributes map[string]nms.AttributeValue) nms.SiteTopology {
	attr, ok := attributes["topology.logical.ipv4.snapshot"]
	if !ok {
		return nms.SiteTopology{
			Nodes: []nms.SiteTopologyNode{},
			Edges: []nms.SiteTopologyEdge{},
		}
	}

	var snapshot map[string]any
	switch value := attr.Value.(type) {
	case string:
		if err := json.Unmarshal([]byte(value), &snapshot); err != nil {
			return nms.SiteTopology{
				Nodes: []nms.SiteTopologyNode{},
				Edges: []nms.SiteTopologyEdge{},
			}
		}
	case map[string]any:
		snapshot = value
	default:
		return nms.SiteTopology{
			Nodes: []nms.SiteTopologyNode{},
			Edges: []nms.SiteTopologyEdge{},
		}
	}

	rawNodes := asSlice(snapshot["nodes"])
	rawNodesData := make([]map[string]any, 0, len(rawNodes))
	for _, raw := range rawNodes {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if id := anyString(item["id"]); id != "" {
			rawNodesData = append(rawNodesData, item)
		}
	}

	rawEdges := asSlice(snapshot["edges"])
	edges := make([]nms.SiteTopologyEdge, 0, len(rawEdges))
	for _, raw := range rawEdges {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		edge := nms.SiteTopologyEdge{
			From:     anyString(item["from"]),
			To:       anyString(item["to"]),
			Reason:   anyString(item["reason"]),
			Resolved: anyBool(item["resolved"]),
			Label:    topologyEdgeLabel(anyString(item["reason"])),
		}
		if edge.From != "" && edge.To != "" {
			edges = append(edges, edge)
		}
	}

	deviceInfo := classifyDeviceRoles(rawNodesData, edges)

	nodes := make([]nms.SiteTopologyNode, 0, len(rawNodesData))
	deviceCount := 0
	subnetCount := 0
	externalCount := 0

	for _, item := range rawNodesData {
		kind := anyString(item["kind"])
		nodeID := anyString(item["id"])
		node := nms.SiteTopologyNode{
			ID:       nodeID,
			Kind:     kind,
			Name:     anyString(item["name"]),
			DeviceID: anyString(item["device_id"]),
			Subnet:   anyString(item["subnet"]),
			Label:    topologyNodeLabel(kind),
			Group:    topologyNodeGroup(kind),
			Status:   "unknown",
		}

		switch kind {
		case "device":
			deviceCount++
			if info, ok := deviceInfo[nodeID]; ok {
				node.DisplayType = info.displayType
				node.DisplayRole = info.displayRole
				node.DisplayShape = info.displayShape
				node.Layer = info.layer
			}
		case "subnet":
			subnetCount++
			node.DisplayType = "LAN Segment"
			node.DisplayRole = "subnet"
			node.DisplayShape = "segment"
			node.Layer = "network"
		case "external_gateway":
			externalCount++
			node.DisplayType = "External Gateway"
			node.DisplayRole = "external_gateway"
			node.DisplayShape = "external"
			node.Layer = "external"
		}

		nodes = append(nodes, node)
	}

	return nms.SiteTopology{
		Supported:   true,
		Source:      "topology.logical.ipv4.snapshot",
		GeneratedAt: anyString(snapshot["generated_at"]),
		Fingerprint: anyString(snapshot["fingerprint"]),
		Summary: nms.SiteTopologySummary{
			DeviceCount:   deviceCount,
			NodeCount:     len(nodes),
			EdgeCount:     len(edges),
			SubnetCount:   subnetCount,
			ExternalCount: externalCount,
		},
		Nodes: nodes,
		Edges: edges,
	}
}

type deviceRoleInfo struct {
	displayType  string
	displayRole  string
	displayShape string
	layer        string
}

func classifyDeviceRoles(rawNodes []map[string]any, edges []nms.SiteTopologyEdge) map[string]deviceRoleInfo {
	nodeNames := make(map[string]string)
	for _, item := range rawNodes {
		if kind := anyString(item["kind"]); kind == "device" {
			nodeNames[anyString(item["id"])] = anyString(item["name"])
		}
	}

	deviceIDs := make(map[string]bool)
	for id := range nodeNames {
		deviceIDs[id] = true
	}

	deviceSubnetCounts := make(map[string]int)
	deviceHasDefaultRoute := make(map[string]bool)
	deviceConnectsExternal := make(map[string]bool)

	for _, edge := range edges {
		if !deviceIDs[edge.From] {
			continue
		}
		switch edge.Reason {
		case "default_route":
			deviceHasDefaultRoute[edge.From] = true
		case "connected_subnet":
			deviceSubnetCounts[edge.From]++
		}
		if strings.Contains(edge.To, "external:") || strings.Contains(edge.To, "external_gateway") {
			deviceConnectsExternal[edge.From] = true
		}
	}

	info := make(map[string]deviceRoleInfo)

	routerWords := []string{"router", "gateway", "gw", "mikrotik", "vyos", "cisco", "edge", "firewall"}
	serverWords := []string{"server", "linux", "host", "vm", "ubuntu", "debian", "centos", "windows", "client"}

	for id, name := range nodeNames {
		lowerName := strings.ToLower(name)

		hasDefault := deviceHasDefaultRoute[id]
		connExternal := deviceConnectsExternal[id]
		multiSubnet := deviceSubnetCounts[id] >= 2

		isRouter := hasDefault || connExternal || multiSubnet
		if !isRouter {
			for _, word := range routerWords {
				if strings.Contains(lowerName, word) {
					isRouter = true
					break
				}
			}
		}

		isServer := false
		if !isRouter {
			for _, word := range serverWords {
				if strings.Contains(lowerName, word) {
					isServer = true
					break
				}
			}
		}

		if isRouter {
			info[id] = deviceRoleInfo{
				displayType:  "Router / Gateway",
				displayRole:  "router",
				displayShape: "router",
				layer:        "gateway",
			}
		} else if isServer {
			info[id] = deviceRoleInfo{
				displayType:  "Server",
				displayRole:  "server",
				displayShape: "server",
				layer:        "endpoint",
			}
		} else {
			info[id] = deviceRoleInfo{
				displayType:  "Device",
				displayRole:  "device",
				displayShape: "device",
				layer:        "endpoint",
			}
		}
	}

	return info
}

func topologyNodeLabel(kind string) string {
	switch kind {
	case "device":
		return "Device"
	case "subnet":
		return "Subnet"
	case "external_gateway":
		return "Gateway"
	default:
		return "Node"
	}
}

func topologyNodeGroup(kind string) string {
	switch kind {
	case "device":
		return "devices"
	case "subnet":
		return "subnets"
	case "external_gateway":
		return "external"
	default:
		return "other"
	}
}

func topologyEdgeLabel(reason string) string {
	switch reason {
	case "next_hop_match":
		return "Next Hop"
	case "connected_subnet":
		return "Connected Subnet"
	case "default_route":
		return "Default Route"
	default:
		return reason
	}
}

func (s *apiServer) deviceDetailHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, deviceDetailResponse{
				Item:    nil,
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		device, err := s.tb.GetDevice(r.Context(), deviceID)
		if err != nil {
			s.logger.Warn("load device detail failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, deviceDetailResponse{
				Item:    nil,
				Source:  "thingsboard",
				Message: "ThingsBoard configured but device detail could not be loaded",
			})
			return
		}

		writeJSON(w, http.StatusOK, deviceDetailResponse{
			Item: &nms.DeviceDetail{
				DeviceID: device.ID,
				Name:     device.Name,
				Type:     device.Type,
				Label:    device.Label,
				Profile:  device.Asset,
			},
			Source:  "thingsboard",
			Message: "Device detail loaded from ThingsBoard",
		})
	}
}

func (s *apiServer) latestTelemetryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, latestTelemetryResponse{
				DeviceID: deviceID,
				Items:    []nms.TelemetryValue{},
				Source:   "thingsboard",
				Message:  "ThingsBoard integration not configured",
			})
			return
		}

		telemetry, err := s.tb.GetLatestTelemetry(r.Context(), deviceID)
		if err != nil {
			s.logger.Warn("load latest telemetry failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, latestTelemetryResponse{
				DeviceID: deviceID,
				Items:    []nms.TelemetryValue{},
				Source:   "thingsboard",
				Message:  "ThingsBoard configured but latest telemetry could not be loaded",
			})
			return
		}

		message := "Latest telemetry loaded from ThingsBoard"
		if len(telemetry) == 0 {
			message = "No latest telemetry found for device"
		}

		items := normalizeTelemetry(telemetry)

		writeJSON(w, http.StatusOK, latestTelemetryResponse{
			DeviceID: deviceID,
			Items:    items,
			Source:   "thingsboard",
			Message:  message,
		})
	}
}

func (s *apiServer) telemetryHistoryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, telemetryHistoryResponse{
				DeviceID: deviceID,
				Series:   []nms.TelemetrySeries{},
				Source:   "thingsboard",
				Message:  "ThingsBoard integration not configured",
			})
			return
		}

		now := time.Now().UnixMilli()
		startTs := parseInt64Query(r, "startTs", now-60*60*1000)
		endTs := parseInt64Query(r, "endTs", now)
		interval := parseInt64Query(r, "interval", 60*1000)
		limit := parseIntQuery(r, "limit", 500)
		keys := splitQueryCSV(r.URL.Query().Get("keys"))

		if len(keys) == 0 {
			latest, err := s.tb.GetLatestTelemetry(r.Context(), deviceID)
			if err != nil {
				s.logger.Warn("infer telemetry history keys failed", "deviceId", deviceID, "error", err)
				writeJSON(w, http.StatusOK, telemetryHistoryResponse{
					DeviceID: deviceID,
					Series:   []nms.TelemetrySeries{},
					Source:   "thingsboard",
					Message:  "ThingsBoard configured but telemetry history could not be loaded",
				})
				return
			}

			for _, item := range latest {
				if _, err := strconv.ParseFloat(item.Value, 64); err == nil {
					keys = append(keys, item.Key)
				}
			}
		}

		if len(keys) == 0 {
			writeJSON(w, http.StatusOK, telemetryHistoryResponse{
				DeviceID: deviceID,
				Series:   []nms.TelemetrySeries{},
				Source:   "thingsboard",
				Message:  "No numeric telemetry keys available for charts",
			})
			return
		}

		series, err := s.tb.GetTelemetryHistory(r.Context(), deviceID, keys, startTs, endTs, interval, limit)
		if err != nil {
			s.logger.Warn("load telemetry history failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, telemetryHistoryResponse{
				DeviceID: deviceID,
				Series:   []nms.TelemetrySeries{},
				Source:   "thingsboard",
				Message:  "ThingsBoard configured but telemetry history could not be loaded",
			})
			return
		}

		writeJSON(w, http.StatusOK, telemetryHistoryResponse{
			DeviceID: deviceID,
			Series:   normalizeTelemetrySeries(series),
			Source:   "thingsboard",
			Message:  "Telemetry history loaded from ThingsBoard",
		})
	}
}

func (s *apiServer) deviceSummaryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, deviceSummaryResponse{
				Item:    nil,
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		device, err := s.tb.GetDevice(r.Context(), deviceID)
		if err != nil {
			s.logger.Warn("load device summary detail failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, deviceSummaryResponse{
				Item:    nil,
				Source:  "thingsboard",
				Message: "ThingsBoard configured but device summary could not be loaded",
			})
			return
		}

		telemetry, err := s.tb.GetLatestTelemetry(r.Context(), deviceID)
		if err != nil {
			s.logger.Warn("load device summary telemetry failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, deviceSummaryResponse{
				Item:    nil,
				Source:  "thingsboard",
				Message: "ThingsBoard configured but device summary could not be loaded",
			})
			return
		}

		latestTelemetry := normalizeTelemetry(telemetry)
		lastTelemetryTs := int64(0)
		for _, item := range latestTelemetry {
			if item.Timestamp > lastTelemetryTs {
				lastTelemetryTs = item.Timestamp
			}
		}

		status := "unknown"
		if len(latestTelemetry) > 0 {
			status = "active"
		}

		writeJSON(w, http.StatusOK, deviceSummaryResponse{
			Item: &nms.DeviceSummary{
				DeviceID:        device.ID,
				Name:            device.Name,
				Type:            device.Type,
				Label:           device.Label,
				Profile:         device.Asset,
				Status:          status,
				TelemetryCount:  len(latestTelemetry),
				LastTelemetryTs: lastTelemetryTs,
				LatestTelemetry: latestTelemetry,
			},
			Source:  "thingsboard",
			Message: "Device summary loaded from ThingsBoard",
		})
	}
}

func (s *apiServer) deviceDashboardHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")

		if s.tb == nil {
			writeJSON(w, http.StatusOK, deviceDashboardResponse{
				DeviceDashboard: emptyDeviceDashboard(deviceID),
				Source:          "thingsboard",
				Message:         "ThingsBoard integration not configured",
			})
			return
		}

		device, err := s.tb.GetDevice(r.Context(), deviceID)
		if err != nil {
			s.logger.Warn("load dashboard device detail failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, deviceDashboardResponse{
				DeviceDashboard: emptyDeviceDashboard(deviceID),
				Source:          "thingsboard",
				Message:         "ThingsBoard configured but device dashboard could not be loaded",
			})
			return
		}

		telemetry, err := s.tb.GetLatestTelemetry(r.Context(), deviceID)
		if err != nil {
			s.logger.Warn("load dashboard telemetry failed", "deviceId", deviceID, "error", err)
			writeJSON(w, http.StatusOK, deviceDashboardResponse{
				DeviceDashboard: dashboardFromPartialDevice(device),
				Source:          "thingsboard",
				Message:         "ThingsBoard configured but device dashboard telemetry could not be loaded",
			})
			return
		}

		attributes := make([]nms.AttributeValue, 0)
		for _, scope := range []string{"SERVER_SCOPE", "CLIENT_SCOPE", "SHARED_SCOPE"} {
			scopeAttributes, err := s.tb.GetEntityAttributes(r.Context(), "DEVICE", deviceID, scope, nil)
			if err != nil {
				s.logger.Warn("load dashboard attributes failed", "deviceId", deviceID, "scope", scope, "error", err)
				continue
			}
			attributes = append(attributes, normalizeAttributes(scopeAttributes)...)
		}

		latestTelemetry := normalizeTelemetry(telemetry)
		dashboard := buildDeviceDashboard(device, latestTelemetry, attributes)
		message := "Device dashboard loaded from ThingsBoard"
		if len(latestTelemetry) == 0 {
			message = "Device dashboard loaded, but no latest telemetry was found"
		}

		writeJSON(w, http.StatusOK, deviceDashboardResponse{
			DeviceDashboard: dashboard,
			Source:          "thingsboard",
			Message:         message,
		})
	}
}

func (s *apiServer) deviceAttributesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		deviceID := chi.URLParam(r, "deviceId")
		scopes := requestedScopes(r, []string{"SERVER_SCOPE", "CLIENT_SCOPE", "SHARED_SCOPE"})
		s.writeAttributes(w, r, "DEVICE", deviceID, scopes)
	}
}

func (s *apiServer) assetAttributesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		assetID := chi.URLParam(r, "assetId")
		scopes := requestedScopes(r, []string{"SERVER_SCOPE"})
		s.writeAttributes(w, r, "ASSET", assetID, scopes)
	}
}

func (s *apiServer) writeAttributes(w http.ResponseWriter, r *http.Request, entityType string, entityID string, scopes []string) {
	if s.tb == nil {
		writeJSON(w, http.StatusOK, attributesResponse{
			EntityType: entityType,
			EntityID:   entityID,
			Scopes:     map[string][]nms.AttributeValue{},
			Source:     "thingsboard",
			Message:    "ThingsBoard integration not configured",
		})
		return
	}

	keys := splitQueryCSV(r.URL.Query().Get("keys"))
	attributesByScope := make(map[string][]nms.AttributeValue, len(scopes))
	for _, scope := range scopes {
		attributes, err := s.tb.GetEntityAttributes(r.Context(), entityType, entityID, scope, keys)
		if err != nil {
			s.logger.Warn("load entity attributes failed", "entityType", entityType, "entityId", entityID, "scope", scope, "error", err)
			writeJSON(w, http.StatusOK, attributesResponse{
				EntityType: entityType,
				EntityID:   entityID,
				Scopes:     map[string][]nms.AttributeValue{},
				Source:     "thingsboard",
				Message:    "ThingsBoard configured but attributes could not be loaded",
			})
			return
		}

		attributesByScope[scope] = normalizeAttributes(attributes)
	}

	writeJSON(w, http.StatusOK, attributesResponse{
		EntityType: entityType,
		EntityID:   entityID,
		Scopes:     attributesByScope,
		Source:     "thingsboard",
		Message:    "Attributes loaded from ThingsBoard",
	})
}

type deviceIssueInfo struct {
	deviceID   string
	name       string
	deviceType string
	siteKey    string
	score      int
	alarmCount int
	health     string
	reachable  bool
	freshness  string
	avgLatency float64
	packetLoss float64
	cpuAvg     float64
	memAvg     float64
	updatedAt  string
}

func (s *apiServer) reportsSummaryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeJSON(w, http.StatusOK, reportSummaryResponse{
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		ctx := r.Context()
		rangeLabel, startMs, endMs := parseReportRange(r)

		sites, err := s.loadSites(ctx)
		if err != nil {
			s.logger.Warn("reports: load sites failed", "error", err)
			writeJSON(w, http.StatusOK, reportSummaryResponse{
				Source:  "thingsboard",
				Message: "ThingsBoard configured but sites could not be loaded",
			})
			return
		}

		alarmQuery := thingsboard.AlarmQuery{
			Page:         0,
			PageSize:     100,
			StartTime:    startMs,
			EndTime:      endMs,
			SortProperty: "createdTime",
			SortOrder:    "DESC",
		}
		alarmPage, alarmErr := s.tb.ListAlarms(ctx, alarmQuery)

		activeAlarmCount := 0
		criticalAlarmCount := 0
		alarmsByDevice := make(map[string][]thingsboard.AlarmInfo)

		if alarmErr == nil {
			for _, alarm := range alarmPage.Items {
				if alarm.Status == "ACTIVE_UNACK" || alarm.Status == "ACTIVE_ACK" {
					activeAlarmCount++
					if alarm.Severity == "CRITICAL" || alarm.Severity == "MAJOR" {
						criticalAlarmCount++
					}
				}
				if alarm.Originator.EntityType == "DEVICE" {
					alarmsByDevice[alarm.Originator.ID] = append(alarmsByDevice[alarm.Originator.ID], alarm)
				}
			}
		}

		totalDeviceCount := 0
		onlineCount := 0
		staleCount := 0
		siteRows := make([]nms.ReportSiteRow, 0, len(sites))
		deviceIssues := make([]deviceIssueInfo, 0)

		for _, site := range sites {
			devices, err := s.loadSiteDevices(ctx, site)
			if err != nil {
				s.logger.Warn("reports: load site devices failed", "siteKey", site.SiteKey, "error", err)
				continue
			}

			siteDeviceCount := len(devices)
			totalDeviceCount += siteDeviceCount
			siteOnlineCount := 0
			siteStaleCount := 0
			siteAlarmCount := 0
			siteCriticalCount := 0

			for _, device := range devices {
				deviceAlarms := alarmsByDevice[device.DeviceID]
				alarmCount := len(deviceAlarms)
				siteAlarmCount += alarmCount

				for _, a := range deviceAlarms {
					if a.Severity == "CRITICAL" || a.Severity == "MAJOR" {
						siteCriticalCount++
					}
				}

				telemetry, err := s.tb.GetLatestTelemetry(ctx, device.DeviceID)
				if err != nil {
					continue
				}

				lastTs := int64(0)
				hasTelemetry := len(telemetry) > 0
				for _, item := range telemetry {
					if item.Timestamp > lastTs {
						lastTs = item.Timestamp
					}
				}

				telemetryMap := make(map[string]string)
				for _, item := range telemetry {
					telemetryMap[item.Key] = item.Value
				}

				reachable := hasTelemetry
				if v, ok := telemetryMap["icmp.reachable"]; ok {
					val2, _ := parseTelemetryValue(v)
				reachable = truthy(val2)
				}
				freshness := "unknown"
				if lastTs > 0 {
					freshness = freshnessForTimestamp(lastTs)
				}
				if reachable && freshness == "fresh" {
					siteOnlineCount++
					onlineCount++
				}
				if freshness == "stale" {
					siteStaleCount++
					staleCount++
				}

				issueScore := alarmCount * 10
				avgLatency := parseFloat64(telemetryMap["icmp.latency_ms"])
				packetLoss := parseFloat64(telemetryMap["icmp.packet_loss_pct"])
				cpuAvg := parseFloat64(telemetryMap["snmp.host.cpu.load_pct"])
				memAvg := parseFloat64(telemetryMap["snmp.host.memory.used_pct"])

				if avgLatency > 100 {
					issueScore += 5
				}
				if avgLatency > 250 {
					issueScore += 10
				}
				if packetLoss > 2 {
					issueScore += 5
				}
				if packetLoss > 5 {
					issueScore += 10
				}
				if cpuAvg > 75 {
					issueScore += 5
				}
				if cpuAvg > 90 {
					issueScore += 10
				}
				if memAvg > 80 {
					issueScore += 5
				}
				if memAvg > 90 {
					issueScore += 10
				}

				health := "unknown"
				if !reachable && hasTelemetry {
					health = "critical"
				} else if hasTelemetry {
					health = "normal"
				}
				if freshness == "stale" && health != "critical" {
					health = "warning"
				}

				if issueScore > 0 || alarmCount > 0 {
					updatedAt := ""
					if lastTs > 0 {
						updatedAt = timestampRFC3339(lastTs)
					}
					deviceIssues = append(deviceIssues, deviceIssueInfo{
						deviceID:   device.DeviceID,
						name:       device.Name,
						deviceType: device.Type,
						siteKey:    site.SiteKey,
						score:      issueScore,
						alarmCount: alarmCount,
						health:     health,
						reachable:  reachable,
						freshness:  freshness,
						avgLatency: avgLatency,
						packetLoss: packetLoss,
						cpuAvg:     cpuAvg,
						memAvg:     memAvg,
						updatedAt:  updatedAt,
					})
				}
			}

			siteHealth := "normal"
			if siteCriticalCount > 0 {
				siteHealth = "critical"
			} else if siteAlarmCount > 0 {
				siteHealth = "warning"
			}

			siteRows = append(siteRows, nms.ReportSiteRow{
				SiteKey:            site.SiteKey,
				SiteName:           site.Name,
				DeviceCount:        siteDeviceCount,
				OnlineDeviceCount:  siteOnlineCount,
				StaleDeviceCount:   siteStaleCount,
				ActiveAlarmCount:   siteAlarmCount,
				CriticalAlarmCount: siteCriticalCount,
				Health:             siteHealth,
				LastUpdatedAt:      time.Now().UTC().Format(time.RFC3339),
			})
		}

		sort.Slice(siteRows, func(i, j int) bool {
			return siteRows[i].ActiveAlarmCount > siteRows[j].ActiveAlarmCount
		})

		sort.Slice(deviceIssues, func(i, j int) bool {
			return deviceIssues[i].score > deviceIssues[j].score
		})
		if len(deviceIssues) > 10 {
			deviceIssues = deviceIssues[:10]
		}

		topDevices := make([]nms.ReportDeviceRow, len(deviceIssues))
		for i, di := range deviceIssues {
			topDevices[i] = nms.ReportDeviceRow{
				DeviceID:      di.deviceID,
				SiteKey:       di.siteKey,
				Name:          di.name,
				Type:          di.deviceType,
				Health:        di.health,
				Reachable:     di.reachable,
				Freshness:     di.freshness,
				AlarmCount:    di.alarmCount,
				AvgLatencyMs:  di.avgLatency,
				PacketLossPct: di.packetLoss,
				CPUAvgPct:     di.cpuAvg,
				MemoryAvgPct:  di.memAvg,
				UpdatedAt:     di.updatedAt,
			}
		}

		now := time.Now().UTC()
		endAt := now
		startAt := endAt.Add(-reportRangeDuration(rangeLabel))

		writeJSON(w, http.StatusOK, reportSummaryResponse{
			Range: nms.ReportRange{
				Label:   rangeLabel,
				StartAt: startAt.Format(time.RFC3339),
				EndAt:   endAt.Format(time.RFC3339),
			},
			Summary: nms.ReportSummaryKPI{
				SiteCount:          len(sites),
				DeviceCount:        totalDeviceCount,
				OnlineDeviceCount:  onlineCount,
				StaleDeviceCount:   staleCount,
				ActiveAlarmCount:   activeAlarmCount,
				CriticalAlarmCount: criticalAlarmCount,
			},
			TopSitesByAlarms:   siteRows,
			TopDevicesByIssues: topDevices,
			GeneratedAt:        now.Format(time.RFC3339),
			Source:             "thingsboard",
			Message:            "Report summary generated",
		})
	}
}

func (s *apiServer) reportsSitesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeJSON(w, http.StatusOK, reportSitesListResponse{
				Items:   []nms.ReportSiteRow{},
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		ctx := r.Context()
		rangeLabel, startMs, endMs := parseReportRange(r)

		sites, err := s.loadSites(ctx)
		if err != nil {
			s.logger.Warn("reports: load sites failed", "error", err)
			writeJSON(w, http.StatusOK, reportSitesListResponse{
				Items:   []nms.ReportSiteRow{},
				Source:  "thingsboard",
				Message: "ThingsBoard configured but sites could not be loaded",
			})
			return
		}

		alarmQuery := thingsboard.AlarmQuery{
			Page:         0,
			PageSize:     100,
			StartTime:    startMs,
			EndTime:      endMs,
			SortProperty: "createdTime",
			SortOrder:    "DESC",
		}
		alarmPage, alarmErr := s.tb.ListAlarms(ctx, alarmQuery)

		alarmsByDevice := make(map[string][]thingsboard.AlarmInfo)
		if alarmErr == nil {
			for _, alarm := range alarmPage.Items {
				if alarm.Originator.EntityType == "DEVICE" {
					alarmsByDevice[alarm.Originator.ID] = append(alarmsByDevice[alarm.Originator.ID], alarm)
				}
			}
		}

		items := make([]nms.ReportSiteRow, 0, len(sites))
		for _, site := range sites {
			devices, err := s.loadSiteDevices(ctx, site)
			if err != nil {
				continue
			}

			siteDeviceCount := len(devices)
			siteOnlineCount := 0
			siteStaleCount := 0
			siteAlarmCount := 0
			siteCriticalCount := 0

			for _, device := range devices {
				deviceAlarms := alarmsByDevice[device.DeviceID]
				alarmCount := len(deviceAlarms)
				siteAlarmCount += alarmCount

				for _, a := range deviceAlarms {
					if a.Severity == "CRITICAL" || a.Severity == "MAJOR" {
						siteCriticalCount++
					}
				}

				telemetry, err := s.tb.GetLatestTelemetry(ctx, device.DeviceID)
				if err != nil {
					continue
				}

				lastTs := int64(0)
				for _, t := range telemetry {
					if t.Timestamp > lastTs {
						lastTs = t.Timestamp
					}
				}
				freshness := "unknown"
				if lastTs > 0 {
					freshness = freshnessForTimestamp(lastTs)
				}
				if len(telemetry) > 0 && freshness == "fresh" {
					siteOnlineCount++
				}
				if freshness == "stale" {
					siteStaleCount++
				}
			}

			siteHealth := "normal"
			if siteCriticalCount > 0 {
				siteHealth = "critical"
			} else if siteAlarmCount > 0 {
				siteHealth = "warning"
			}

			items = append(items, nms.ReportSiteRow{
				SiteKey:            site.SiteKey,
				SiteName:           site.Name,
				DeviceCount:        siteDeviceCount,
				OnlineDeviceCount:  siteOnlineCount,
				StaleDeviceCount:   siteStaleCount,
				ActiveAlarmCount:   siteAlarmCount,
				CriticalAlarmCount: siteCriticalCount,
				Health:             siteHealth,
				LastUpdatedAt:      time.Now().UTC().Format(time.RFC3339),
			})
		}

		now := time.Now().UTC()
		endAt := now
		startAt := endAt.Add(-reportRangeDuration(rangeLabel))

		writeJSON(w, http.StatusOK, reportSitesListResponse{
			Range: nms.ReportRange{
				Label:   rangeLabel,
				StartAt: startAt.Format(time.RFC3339),
				EndAt:   endAt.Format(time.RFC3339),
			},
			Items:   items,
			Source:  "thingsboard",
			Message: "Site report generated",
		})
	}
}

func (s *apiServer) reportsDevicesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeJSON(w, http.StatusOK, reportDevicesListResponse{
				Items:   []nms.ReportDeviceRow{},
				Source:  "thingsboard",
				Message: "ThingsBoard integration not configured",
			})
			return
		}

		ctx := r.Context()
		rangeLabel, startMs, endMs := parseReportRange(r)
		siteFilter := strings.TrimSpace(r.URL.Query().Get("siteKey"))

		sites, err := s.loadSites(ctx)
		if err != nil {
			s.logger.Warn("reports: load sites for devices failed", "error", err)
			writeJSON(w, http.StatusOK, reportDevicesListResponse{
				Items:   []nms.ReportDeviceRow{},
				Source:  "thingsboard",
				Message: "ThingsBoard configured but sites could not be loaded",
			})
			return
		}

		alarmQuery := thingsboard.AlarmQuery{
			Page:         0,
			PageSize:     200,
			StartTime:    startMs,
			EndTime:      endMs,
			SortProperty: "createdTime",
			SortOrder:    "DESC",
		}
		alarmPage, alarmErr := s.tb.ListAlarms(ctx, alarmQuery)
		alarmsByDevice := make(map[string][]thingsboard.AlarmInfo)
		if alarmErr == nil {
			for _, alarm := range alarmPage.Items {
				if alarm.Originator.EntityType == "DEVICE" {
					alarmsByDevice[alarm.Originator.ID] = append(alarmsByDevice[alarm.Originator.ID], alarm)
				}
			}
		}

		items := make([]nms.ReportDeviceRow, 0)
		for _, site := range sites {
			if siteFilter != "" && site.SiteKey != siteFilter {
				continue
			}

			devices, err := s.loadSiteDevices(ctx, site)
			if err != nil {
				continue
			}

			for _, device := range devices {
				deviceAlarms := alarmsByDevice[device.DeviceID]
				alarmCount := len(deviceAlarms)

				telemetry, err := s.tb.GetLatestTelemetry(ctx, device.DeviceID)
				if err != nil {
					continue
				}

				lastTs := int64(0)
				hasTelemetry := len(telemetry) > 0
				telemetryMap := make(map[string]string)
				for _, item := range telemetry {
					telemetryMap[item.Key] = item.Value
					if item.Timestamp > lastTs {
						lastTs = item.Timestamp
					}
				}

				reachable := hasTelemetry
				if v, ok := telemetryMap["icmp.reachable"]; ok {
					val2, _ := parseTelemetryValue(v)
				reachable = truthy(val2)
				}
				freshness := "unknown"
				if lastTs > 0 {
					freshness = freshnessForTimestamp(lastTs)
				}

				health := "unknown"
				if !reachable && hasTelemetry {
					health = "critical"
				} else if hasTelemetry {
					health = "normal"
				}
				if freshness == "stale" && health != "critical" {
					health = "warning"
				}

				updatedAt := ""
				if lastTs > 0 {
					updatedAt = timestampRFC3339(lastTs)
				}

				items = append(items, nms.ReportDeviceRow{
					DeviceID:      device.DeviceID,
					SiteKey:       site.SiteKey,
					Name:          device.Name,
					Type:          device.Type,
					Health:        health,
					Reachable:     reachable,
					Freshness:     freshness,
					AlarmCount:    alarmCount,
					AvgLatencyMs:  parseFloat64(telemetryMap["icmp.latency_ms"]),
					PacketLossPct: parseFloat64(telemetryMap["icmp.packet_loss_pct"]),
					CPUAvgPct:     parseFloat64(telemetryMap["snmp.host.cpu.load_pct"]),
					MemoryAvgPct:  parseFloat64(telemetryMap["snmp.host.memory.used_pct"]),
					UpdatedAt:     updatedAt,
				})
			}
		}

		sort.Slice(items, func(i, j int) bool {
			if items[i].AlarmCount != items[j].AlarmCount {
				return items[i].AlarmCount > items[j].AlarmCount
			}
			return items[i].Name < items[j].Name
		})

		now := time.Now().UTC()
		endAt := now
		startAt := endAt.Add(-reportRangeDuration(rangeLabel))

		writeJSON(w, http.StatusOK, reportDevicesListResponse{
			Range: nms.ReportRange{
				Label:   rangeLabel,
				StartAt: startAt.Format(time.RFC3339),
				EndAt:   endAt.Format(time.RFC3339),
			},
			Items:   items,
			Source:  "thingsboard",
			Message: "Device report generated",
		})
	}
}

func parseReportRange(r *http.Request) (string, int64, int64) {
	label := r.URL.Query().Get("range")
	if label == "" {
		label = "24h"
	}
	now := time.Now().UnixMilli()
	return label, now - int64(reportRangeDuration(label).Milliseconds()) + 1, now
}

func reportRangeDuration(label string) time.Duration {
	switch label {
	case "7d":
		return 7 * 24 * time.Hour
	case "30d":
		return 30 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

func parseFloat64(value string) float64 {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func (s *apiServer) loadSites(ctx context.Context) ([]nms.Site, error) {
	assets, err := s.tb.ListAssetsByType(ctx, s.cfg.ThingsBoardSiteType)
	if err != nil {
		return nil, err
	}

	sites := make([]nms.Site, 0, len(assets))
	for _, asset := range assets {
		attributes, err := s.tb.GetAssetAttributes(ctx, asset.ID, []string{"siteKey"})
		if err != nil {
			return nil, fmt.Errorf("load attributes for asset %s: %w", asset.ID, err)
		}

		siteKey := attributes["siteKey"]
		if siteKey == "" {
			siteKey = slugify(asset.Name)
		}

		sites = append(sites, nms.Site{
			SiteKey: siteKey,
			AssetID: asset.ID,
			Name:    asset.Name,
			Type:    asset.Type,
		})
	}

	sort.Slice(sites, func(i, j int) bool {
		return sites[i].Name < sites[j].Name
	})

	return sites, nil
}

func slugify(value string) string {
	slug := strings.ToLower(strings.TrimSpace(value))
	slug = nonSlugChars.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return "site"
	}

	return slug
}

func (s *apiServer) loadSiteDevices(ctx context.Context, site nms.Site) ([]nms.Device, error) {
	relations, err := s.tb.GetAssetRelations(ctx, site.AssetID)
	if err != nil {
		return nil, err
	}

	devices := make([]nms.Device, 0)
	for _, relation := range relations {
		if relation.ToType != "DEVICE" {
			continue
		}

		device, err := s.tb.GetDevice(ctx, relation.ToID)
		if err != nil {
			return nil, fmt.Errorf("load device %s: %w", relation.ToID, err)
		}

		if device.Type == "gateway" {
			continue
		}

		devices = append(devices, nms.Device{
			DeviceID:     device.ID,
			Name:         device.Name,
			Type:         device.Type,
			Label:        device.Label,
			RelationType: relation.RelationType,
		})
	}

	sort.Slice(devices, func(i, j int) bool {
		return devices[i].Name < devices[j].Name
	})

	return devices, nil
}

type deviceLookupInfo struct {
	Profile string
	Type    string
}

func (s *apiServer) loadSiteDeviceInfo(ctx context.Context, site nms.Site) (map[string]deviceLookupInfo, error) {
	relations, err := s.tb.GetAssetRelations(ctx, site.AssetID)
	if err != nil {
		return nil, err
	}

	info := make(map[string]deviceLookupInfo)
	for _, relation := range relations {
		if relation.ToType != "DEVICE" {
			continue
		}

		device, err := s.tb.GetDevice(ctx, relation.ToID)
		if err != nil {
			return nil, fmt.Errorf("load device %s: %w", relation.ToID, err)
		}
		info[device.Name] = deviceLookupInfo{
			Profile: strings.TrimSpace(device.Asset),
			Type:    device.Type,
		}
	}

	return info, nil
}

func normalizeTelemetry(telemetry []thingsboard.TelemetryValue) []nms.TelemetryValue {
	items := make([]nms.TelemetryValue, 0, len(telemetry))
	for _, item := range telemetry {
		items = append(items, nms.TelemetryValue{
			Key:       item.Key,
			Value:     item.Value,
			Timestamp: item.Timestamp,
		})
	}

	return items
}

func normalizeTelemetrySeries(series []thingsboard.TelemetrySeries) []nms.TelemetrySeries {
	items := make([]nms.TelemetrySeries, 0, len(series))
	for _, seriesItem := range series {
		points := make([]nms.TelemetryPoint, 0, len(seriesItem.Points))
		for _, point := range seriesItem.Points {
			points = append(points, nms.TelemetryPoint{
				Timestamp: point.Timestamp,
				Value:     point.Value,
				RawValue:  point.RawValue,
				Numeric:   point.Numeric,
			})
		}

		items = append(items, nms.TelemetrySeries{
			Key:     seriesItem.Key,
			Points:  points,
			Numeric: seriesItem.Numeric,
		})
	}

	return items
}

func normalizeAttributes(attributes []thingsboard.Attribute) []nms.AttributeValue {
	items := make([]nms.AttributeValue, 0, len(attributes))
	for _, item := range attributes {
		items = append(items, nms.AttributeValue{
			Key:          item.Key,
			Value:        item.Value,
			ValueType:    item.ValueType,
			LastUpdateTs: item.LastUpdateTs,
		})
	}

	return items
}

func emptyDeviceDashboard(deviceID string) nms.DeviceDashboard {
	return nms.DeviceDashboard{
		Device:       nms.DashboardDevice{DeviceID: deviceID},
		Health:       nms.DashboardHealth{Status: "unknown", Freshness: "unknown"},
		MetricCards:  []nms.DashboardMetricCard{},
		MetricGroups: []nms.DashboardMetricGroup{},
		Interfaces:   []nms.DashboardInterface{},
		Storage:      []nms.DashboardStorage{},
		Routing:      nms.DashboardRouting{Routes: []nms.DashboardRoute{}},
		Debug:        nms.DashboardDebug{},
	}
}

func dashboardFromPartialDevice(device thingsboard.Device) nms.DeviceDashboard {
	dashboard := emptyDeviceDashboard(device.ID)
	dashboard.Device = nms.DashboardDevice{
		DeviceID: device.ID,
		Name:     device.Name,
		Label:    firstNonEmpty(device.Label, device.Name),
		Type:     device.Type,
		Profile:  device.Asset,
	}
	return dashboard
}

func buildDeviceDashboard(device thingsboard.Device, telemetry []nms.TelemetryValue, attributes []nms.AttributeValue) nms.DeviceDashboard {
	attributeMap := attributesByKey(attributes)
	catalog := dashboardCatalog(attributeMap)
	cards := buildMetricCards(telemetry, catalog, attributeMap)
	groups := groupMetricCards(cards)
	lastTelemetryTs := latestTelemetryTimestamp(telemetry)

	return nms.DeviceDashboard{
		Device: nms.DashboardDevice{
			DeviceID: device.ID,
			Name:     device.Name,
			Label:    dashboardDeviceLabel(device, attributeMap),
			Type:     device.Type,
			Profile:  device.Asset,
		},
		Health:       dashboardHealth(cards, telemetry, lastTelemetryTs),
		MetricCards:  cards,
		MetricGroups: groups,
		Interfaces:   dashboardInterfaces(attributeMap, cards),
		Storage:      dashboardStorage(attributeMap, cards),
		Routing:      dashboardRouting(attributeMap),
		Debug: nms.DashboardDebug{
			RawTelemetryCount: len(telemetry),
			RawAttributeCount: len(attributes),
		},
	}
}

func dashboardDeviceLabel(device thingsboard.Device, attributes map[string]nms.AttributeValue) string {
	if identity, ok := attributes["nmsIdentity"]; ok {
		if value, ok := identity.Value.(map[string]any); ok {
			for _, key := range []string{"displayName", "label", "name"} {
				if label, ok := value[key].(string); ok && strings.TrimSpace(label) != "" {
					return label
				}
			}
		}
	}

	return firstNonEmpty(device.Label, device.Name)
}

func buildMetricCards(telemetry []nms.TelemetryValue, catalog map[string]metricCatalogEntry, attributes map[string]nms.AttributeValue) []nms.DashboardMetricCard {
	cards := make([]nms.DashboardMetricCard, 0, len(telemetry))
	for _, item := range telemetry {
		entry := catalogEntryForKey(item.Key, catalog, attributes)
		value, numeric := parseTelemetryValue(item.Value)
		status := "unknown"
		if item.Key == "icmp.reachable" {
			if truthy(value) {
				status = "normal"
			} else {
				status = "critical"
			}
		} else if numeric {
			status = metricStatus(value.(float64), entry)
			if status == "unknown" && isObservationalNumericMetric(item.Key) {
				status = "normal"
			}
		}

		cards = append(cards, nms.DashboardMetricCard{
			Key:          item.Key,
			Label:        entry.Label,
			Value:        value,
			Numeric:      numeric,
			Unit:         entry.Unit,
			Group:        entry.Group,
			Subgroup:     entry.Subgroup,
			Status:       status,
			Freshness:    freshnessForTimestamp(item.Timestamp),
			UpdatedAt:    timestampRFC3339(item.Timestamp),
			Order:        entry.Order,
			DisplayOrder: entry.Order,
			VisualType:   entry.VisualType,
			Warn:         entry.Warn,
			Critical:     entry.Critical,
		})
	}

	sort.Slice(cards, func(i, j int) bool {
		if cards[i].Order == cards[j].Order {
			return cards[i].Key < cards[j].Key
		}
		return cards[i].Order < cards[j].Order
	})

	return cards
}

func groupMetricCards(cards []nms.DashboardMetricCard) []nms.DashboardMetricGroup {
	itemsByGroup := make(map[string][]nms.DashboardMetricCard)
	for _, card := range cards {
		itemsByGroup[card.Group] = append(itemsByGroup[card.Group], card)
	}

	groups := make([]nms.DashboardMetricGroup, 0, len(itemsByGroup))
	for group, items := range itemsByGroup {
		groups = append(groups, nms.DashboardMetricGroup{
			Group: group,
			Title: groupTitle(group),
			Items: items,
		})
	}

	sort.Slice(groups, func(i, j int) bool {
		return groupOrder(groups[i].Group) < groupOrder(groups[j].Group)
	})

	return groups
}

func dashboardHealth(cards []nms.DashboardMetricCard, telemetry []nms.TelemetryValue, lastTelemetryTs int64) nms.DashboardHealth {
	freshness := freshnessForTimestamp(lastTelemetryTs)
	reachable := len(telemetry) > 0
	for _, card := range cards {
		if card.Key == "icmp.reachable" {
			reachable = truthy(card.Value)
			break
		}
	}

	status := "unknown"
	if !reachable && len(telemetry) > 0 {
		status = "critical"
	} else if len(telemetry) > 0 {
		status = "normal"
	}
	if freshness == "stale" && status != "critical" {
		status = "warning"
	}
	for _, card := range cards {
		if card.Status == "critical" {
			status = "critical"
			break
		}
		if card.Status == "warning" && status != "critical" {
			status = "warning"
		}
	}

	health := nms.DashboardHealth{
		Status:    status,
		Reachable: reachable,
		Freshness: freshness,
	}
	if lastTelemetryTs > 0 {
		health.LastTelemetryAt = timestampRFC3339(lastTelemetryTs)
		health.LastTelemetryAgeSeconds = int64(time.Since(time.UnixMilli(lastTelemetryTs)).Seconds())
		if health.LastTelemetryAgeSeconds < 0 {
			health.LastTelemetryAgeSeconds = 0
		}
	}

	return health
}

func dashboardCatalog(attributes map[string]nms.AttributeValue) map[string]metricCatalogEntry {
	catalog := defaultMetricCatalog()
	attribute, ok := attributes["nmsMetrics"]
	if !ok {
		return catalog
	}

	for _, metric := range asSlice(attribute.Value) {
		metricMap, ok := metric.(map[string]any)
		if !ok {
			continue
		}
		key := stringFromMap(metricMap, "key")
		if key == "" {
			continue
		}

		entry := catalogEntryForKey(key, catalog, attributes)
		entry.Key = key
		entry.Label = firstNonEmpty(stringFromMap(metricMap, "label"), entry.Label)
		entry.Unit = firstNonEmpty(stringFromMap(metricMap, "unit"), entry.Unit)
		entry.Group = firstNonEmpty(stringFromMap(metricMap, "group"), entry.Group)
		entry.Subgroup = firstNonEmpty(stringFromMap(metricMap, "subgroup"), entry.Subgroup)
		entry.VisualType = firstNonEmpty(stringFromMap(metricMap, "chart"), stringFromMap(metricMap, "visualType"), entry.VisualType)
		if order, ok := floatFromMap(metricMap, "order"); ok {
			entry.Order = int(order)
		}
		if warn, ok := floatFromMap(metricMap, "warn"); ok {
			entry.Warn = warn
			entry.HasWarn = true
		}
		if critical, ok := floatFromMap(metricMap, "critical"); ok {
			entry.Critical = critical
			entry.HasCrit = true
		}
		catalog[key] = entry
	}

	return catalog
}

func defaultMetricCatalog() map[string]metricCatalogEntry {
	entries := []metricCatalogEntry{
		{Key: "icmp.reachable", Label: "Reachability", Group: "availability", Order: 10, VisualType: "badge"},
		{Key: "icmp.latency_ms", Label: "Latency", Unit: "ms", Group: "availability", Order: 20, VisualType: "line", Warn: 100, Critical: 250, HasWarn: true, HasCrit: true},
		{Key: "icmp.packet_loss_pct", Label: "Packet Loss", Unit: "%", Group: "availability", Order: 30, VisualType: "line", Warn: 2, Critical: 5, HasWarn: true, HasCrit: true},
		{Key: "icmp.jitter_ms", Label: "Jitter", Unit: "ms", Group: "availability", Order: 40, VisualType: "line", Warn: 30, Critical: 80, HasWarn: true, HasCrit: true},
		{Key: "snmp.host.cpu.load_pct", Label: "CPU Usage", Unit: "%", Group: "system", Order: 100, VisualType: "line", Warn: 75, Critical: 90, HasWarn: true, HasCrit: true},
		{Key: "snmp.host.memory.used_pct", Label: "Memory Used", Unit: "%", Group: "system", Order: 110, VisualType: "line", Warn: 80, Critical: 90, HasWarn: true, HasCrit: true},
		{Key: "snmp.host.swap.used_pct", Label: "Swap Used", Unit: "%", Group: "system", Order: 120, VisualType: "line", Warn: 50, Critical: 80, HasWarn: true, HasCrit: true},
	}

	catalog := make(map[string]metricCatalogEntry, len(entries))
	for _, entry := range entries {
		catalog[entry.Key] = entry
	}
	return catalog
}

func catalogEntryForKey(key string, catalog map[string]metricCatalogEntry, attributes map[string]nms.AttributeValue) metricCatalogEntry {
	if entry, ok := catalog[key]; ok {
		return entry
	}
	if entry, ok := interfaceMetricEntry(key, attributes); ok {
		return entry
	}
	if entry, ok := storageMetricEntry(key, attributes); ok {
		return entry
	}

	lowerKey := strings.ToLower(key)
	switch {
	case strings.Contains(lowerKey, "rx") && strings.Contains(lowerKey, "bps"):
		return metricCatalogEntry{Key: key, Label: humanizeKey(key), Unit: "bps", Group: "interfaces", Order: 200, VisualType: "line"}
	case strings.Contains(lowerKey, "tx") && strings.Contains(lowerKey, "bps"):
		return metricCatalogEntry{Key: key, Label: humanizeKey(key), Unit: "bps", Group: "interfaces", Order: 210, VisualType: "line"}
	case strings.Contains(lowerKey, "storage") && (strings.Contains(lowerKey, "used_pct") || strings.Contains(lowerKey, "used.percent") || strings.Contains(lowerKey, "used_pct")):
		return metricCatalogEntry{Key: key, Label: humanizeKey(key), Unit: "%", Group: "storage", Order: 300, VisualType: "line", Warn: 80, Critical: 90, HasWarn: true, HasCrit: true}
	case strings.Contains(lowerKey, "disk") && strings.Contains(lowerKey, "used") && strings.Contains(lowerKey, "pct"):
		return metricCatalogEntry{Key: key, Label: humanizeKey(key), Unit: "%", Group: "storage", Order: 310, VisualType: "line", Warn: 80, Critical: 90, HasWarn: true, HasCrit: true}
	default:
		return metricCatalogEntry{Key: key, Label: humanizeKey(key), Group: "other", Order: 900, VisualType: "value"}
	}
}

func interfaceMetricEntry(key string, attributes map[string]nms.AttributeValue) (metricCatalogEntry, bool) {
	matches := interfaceMetricKeyRE.FindStringSubmatch(key)
	if len(matches) != 3 {
		return metricCatalogEntry{}, false
	}

	index := matches[1]
	metric := matches[2]
	baseKey := "snmp.if.idx" + index
	name := firstNonEmpty(attributeString(attributes, baseKey+".name"), attributeString(attributes, baseKey+".alias"), attributeString(attributes, baseKey+".description"), "Interface idx"+index)
	shortLabel, unit, orderOffset := interfaceMetricLabel(metric)
	if shortLabel == "" {
		shortLabel = humanizeKey(metric)
	}

	return metricCatalogEntry{
		Key:        key,
		Label:      name + " " + shortLabel,
		ShortLabel: shortLabel,
		Unit:       unit,
		Group:      "interfaces",
		Subgroup:   name,
		Order:      300 + orderOffset,
		VisualType: interfaceMetricVisual(metric),
	}, true
}

func storageMetricEntry(key string, attributes map[string]nms.AttributeValue) (metricCatalogEntry, bool) {
	matches := storageMetricKeyRE.FindStringSubmatch(key)
	if len(matches) != 3 {
		return metricCatalogEntry{}, false
	}

	index := matches[1]
	metric := matches[2]
	baseKey := storageAttributeBaseKey(key, index)
	name := storageDisplayName(
		attributeString(attributes, baseKey+".type"),
		attributeString(attributes, baseKey+".description"),
		index,
	)
	shortLabel, unit, orderOffset := storageMetricLabel(metric)
	if shortLabel == "" {
		shortLabel = humanizeKey(metric)
	}

	return metricCatalogEntry{
		Key:        key,
		Label:      name + " " + shortLabel,
		ShortLabel: shortLabel,
		Unit:       unit,
		Group:      "storage",
		Subgroup:   name,
		Order:      400 + orderOffset,
		VisualType: "line",
		Warn:       80,
		Critical:   90,
		HasWarn:    metric == "used_pct",
		HasCrit:    metric == "used_pct",
	}, true
}

func storageAttributeBaseKey(metricKey string, index string) string {
	if strings.HasPrefix(metricKey, "snmp.host.storage.idx") {
		return "snmp.host.storage.idx" + index
	}
	return "snmp.storage.idx" + index
}

func storageDisplayName(storageType string, description string, index string) string {
	description = strings.TrimSpace(description)
	switch {
	case description != "":
		return description
	default:
		return "Storage idx" + index
	}
}

func interfaceMetricLabel(metric string) (string, string, int) {
	switch metric {
	case "rx_bps":
		return "RX Throughput", "bps", 10
	case "tx_bps":
		return "TX Throughput", "bps", 20
	case "oper_status":
		return "Operational Status", "", 30
	case "admin_status":
		return "Admin Status", "", 40
	case "speed_bps":
		return "Link Speed", "bps", 50
	case "in_errors":
		return "RX Errors", "", 60
	case "out_errors":
		return "TX Errors", "", 70
	default:
		return "", "", 90
	}
}

func storageMetricLabel(metric string) (string, string, int) {
	switch metric {
	case "used_pct":
		return "Storage Usage", "%", 10
	case "used_bytes":
		return "Used Storage", "B", 20
	case "total_bytes":
		return "Total Storage", "B", 30
	case "free_bytes":
		return "Free Storage", "B", 40
	default:
		return "", "", 90
	}
}

func interfaceMetricVisual(metric string) string {
	switch metric {
	case "rx_bps", "tx_bps", "speed_bps", "in_errors", "out_errors":
		return "line"
	default:
		return "value"
	}
}

func dashboardInterfaces(attributes map[string]nms.AttributeValue, cards []nms.DashboardMetricCard) []nms.DashboardInterface {
	interfacesByName := make(map[string]nms.DashboardInterface)
	for _, card := range cards {
		if card.Group != "interfaces" || card.Subgroup == "" {
			continue
		}
		entry := interfacesByName[card.Subgroup]
		entry.Name = card.Subgroup
		entry.Label = card.Subgroup
		if matches := interfaceMetricKeyRE.FindStringSubmatch(card.Key); len(matches) == 3 {
			entry.Index = matches[1]
			switch matches[2] {
			case "rx_bps":
				entry.RxKey = card.Key
				entry.RxBps = numericCardValue(card)
			case "tx_bps":
				entry.TxKey = card.Key
				entry.TxBps = numericCardValue(card)
			case "oper_status":
				entry.StatusKey = card.Key
				entry.Status = interfaceStatus(card.Value)
			case "admin_status":
				entry.AdminStatus = interfaceStatus(card.Value)
			case "speed_bps":
				entry.LinkSpeed = numericCardValue(card)
			}
		}
		entry.Metrics = append(entry.Metrics, groupedMetricCard(card))
		interfacesByName[card.Subgroup] = entry
	}

	attribute, ok := attributes["nmsInterfaces"]
	if ok {
		for _, item := range asSlice(attribute.Value) {
			itemMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			name := stringFromMap(itemMap, "name")
			label := firstNonEmpty(stringFromMap(itemMap, "label"), name)
			entry := interfacesByName[firstNonEmpty(name, label)]
			entry.Index = firstNonEmpty(stringFromMap(itemMap, "index"), entry.Index)
			entry.Name = firstNonEmpty(name, entry.Name, label)
			entry.Label = firstNonEmpty(label, entry.Label, entry.Name)
			entry.RxKey = firstNonEmpty(stringFromMap(itemMap, "rxKey"), entry.RxKey)
			entry.TxKey = firstNonEmpty(stringFromMap(itemMap, "txKey"), entry.TxKey)
			entry.StatusKey = firstNonEmpty(stringFromMap(itemMap, "statusKey"), entry.StatusKey)
			interfacesByName[firstNonEmpty(entry.Name, entry.Label)] = entry
		}
	}

	interfaces := make([]nms.DashboardInterface, 0, len(interfacesByName))
	for _, item := range interfacesByName {
		sort.Slice(item.Metrics, func(i, j int) bool { return item.Metrics[i].DisplayOrder < item.Metrics[j].DisplayOrder })
		interfaces = append(interfaces, item)
	}
	sort.Slice(interfaces, func(i, j int) bool { return interfaces[i].Name < interfaces[j].Name })
	return interfaces
}

func dashboardStorage(attributes map[string]nms.AttributeValue, cards []nms.DashboardMetricCard) []nms.DashboardStorage {
	storageByName := make(map[string]nms.DashboardStorage)
	for _, card := range cards {
		if card.Group != "storage" || card.Subgroup == "" {
			continue
		}
		entry := storageByName[card.Subgroup]
		entry.Name = card.Subgroup
		entry.Label = card.Subgroup
		if matches := storageMetricKeyRE.FindStringSubmatch(card.Key); len(matches) == 3 {
			idx := matches[1]
			entry.Index = idx
			entry.Type = firstNonEmpty(
				attributeString(attributes, "snmp.host.storage.idx"+idx+".type"),
				attributeString(attributes, "snmp.storage.idx"+idx+".type"),
			)
			switch matches[2] {
			case "used_pct":
				entry.UsedPctKey = card.Key
				entry.UsedPct = numericCardValue(card)
				entry.Status = card.Status
				entry.UpdatedAt = card.UpdatedAt
			case "used_bytes":
				entry.UsedKey = card.Key
			case "total_bytes":
				entry.TotalKey = card.Key
			}
		}
		entry.Metrics = append(entry.Metrics, groupedMetricCard(card))
		storageByName[card.Subgroup] = entry
	}

	attribute, ok := attributes["nmsStorage"]
	if ok {
		for _, item := range asSlice(attribute.Value) {
			itemMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			name := stringFromMap(itemMap, "name")
			label := firstNonEmpty(stringFromMap(itemMap, "label"), name)
			entry := storageByName[firstNonEmpty(name, label)]
			entry.Index = firstNonEmpty(stringFromMap(itemMap, "index"), entry.Index)
			entry.Name = firstNonEmpty(name, entry.Name, label)
			entry.Label = firstNonEmpty(label, entry.Label, entry.Name)
			entry.Type = firstNonEmpty(stringFromMap(itemMap, "type"), entry.Type)
			entry.UsedPctKey = firstNonEmpty(stringFromMap(itemMap, "usedPctKey"), entry.UsedPctKey)
			entry.UsedKey = firstNonEmpty(stringFromMap(itemMap, "usedKey"), entry.UsedKey)
			entry.TotalKey = firstNonEmpty(stringFromMap(itemMap, "totalKey"), entry.TotalKey)
			storageByName[firstNonEmpty(entry.Name, entry.Label)] = entry
		}
	}

	storage := make([]nms.DashboardStorage, 0, len(storageByName))
	for _, item := range storageByName {
		sort.Slice(item.Metrics, func(i, j int) bool { return item.Metrics[i].DisplayOrder < item.Metrics[j].DisplayOrder })
		storage = append(storage, item)
	}
	sort.Slice(storage, func(i, j int) bool { return storage[i].Name < storage[j].Name })
	return storage
}

func dashboardRouting(attributes map[string]nms.AttributeValue) nms.DashboardRouting {
	routing := parseRouteSnapshot(attributes)
	if routing.Supported || len(routing.Routes) > 0 || routing.DefaultRoute != nil {
		return routing
	}

	defaultRoute := nms.DashboardRoute{
		Destination:   attributeString(attributes, "route.ipv4.default.destination"),
		NextHop:       attributeString(attributes, "route.ipv4.default.next_hop"),
		InterfaceID:   attributeString(attributes, "route.ipv4.default.interface_id"),
		InterfaceName: attributeString(attributes, "route.ipv4.default.interface_name"),
		Protocol:      attributeString(attributes, "route.ipv4.default.protocol"),
		RouteType:     attributeString(attributes, "route.ipv4.default.route_type"),
		IsDefault:     true,
	}
	routing = nms.DashboardRouting{
		Supported: attrBool(attributes, "route.ipv4.supported"),
		Source:    attributeString(attributes, "route.ipv4.source"),
		Routes:    []nms.DashboardRoute{},
	}
	if routeHasData(defaultRoute) {
		routing.DefaultRoute = &defaultRoute
		routing.Routes = []nms.DashboardRoute{defaultRoute}
		routing.Summary.RouteCount = 1
		routing.Summary.DefaultRouteCount = 1
	}
	return routing
}

func parseRouteSnapshot(attributes map[string]nms.AttributeValue) nms.DashboardRouting {
	attribute, ok := attributes["route.ipv4.snapshot"]
	if !ok {
		return nms.DashboardRouting{Routes: []nms.DashboardRoute{}}
	}

	var snapshot map[string]any
	switch value := attribute.Value.(type) {
	case string:
		if err := json.Unmarshal([]byte(value), &snapshot); err != nil {
			return nms.DashboardRouting{Routes: []nms.DashboardRoute{}}
		}
	case map[string]any:
		snapshot = value
	default:
		return nms.DashboardRouting{Routes: []nms.DashboardRoute{}}
	}

	routes := make([]nms.DashboardRoute, 0)
	for _, item := range asSlice(snapshot["routes"]) {
		itemMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		route := nms.DashboardRoute{
			Destination:   anyString(itemMap["destination"]),
			NextHop:       anyString(itemMap["next_hop"]),
			InterfaceID:   anyString(itemMap["interface_id"]),
			InterfaceName: anyString(itemMap["interface_name"]),
			Protocol:      anyString(itemMap["protocol"]),
			RouteType:     anyString(itemMap["route_type"]),
			IsDefault:     anyBool(itemMap["is_default"]),
		}
		if routeHasData(route) {
			routes = append(routes, route)
		}
	}

	routing := nms.DashboardRouting{
		Supported:   anyBool(snapshot["supported"]),
		Source:      anyString(snapshot["source"]),
		CollectedAt: anyString(snapshot["collected_at"]),
		Summary: nms.DashboardRouteSummary{
			RouteCount:          anyInt(snapshot["route_count"]),
			DefaultRouteCount:   anyInt(snapshot["default_route_count"]),
			ConnectedRouteCount: anyInt(snapshot["connected_route_count"]),
			RemoteRouteCount:    anyInt(snapshot["remote_route_count"]),
			Changed:             anyBool(snapshot["changed"]),
		},
		Routes: routes,
	}
	for i := range routes {
		if routes[i].IsDefault {
			routing.DefaultRoute = &routes[i]
			break
		}
	}
	return routing
}

func routeHasData(route nms.DashboardRoute) bool {
	return route.Destination != "" || route.NextHop != "" || route.InterfaceID != "" || route.InterfaceName != "" || route.Protocol != "" || route.RouteType != ""
}

func groupedMetricCard(card nms.DashboardMetricCard) nms.DashboardMetricCard {
	if shortLabel, ok := shortGroupedLabel(card.Key); ok {
		card.Label = shortLabel
	}
	return card
}

func shortGroupedLabel(key string) (string, bool) {
	if matches := interfaceMetricKeyRE.FindStringSubmatch(key); len(matches) == 3 {
		label, _, _ := interfaceMetricLabel(matches[2])
		return label, label != ""
	}
	if matches := storageMetricKeyRE.FindStringSubmatch(key); len(matches) == 3 {
		label, _, _ := storageMetricLabel(matches[2])
		return label, label != ""
	}
	return "", false
}

func numericCardValue(card nms.DashboardMetricCard) float64 {
	switch value := card.Value.(type) {
	case float64:
		return value
	case int:
		return float64(value)
	case string:
		parsed, _ := strconv.ParseFloat(value, 64)
		return parsed
	default:
		return 0
	}
}

func interfaceStatus(value any) string {
	switch typed := value.(type) {
	case float64:
		if typed == 1 {
			return "up"
		}
		if typed == 2 {
			return "down"
		}
	case string:
		switch strings.ToLower(strings.TrimSpace(typed)) {
		case "1", "up", "true":
			return "up"
		case "2", "down", "false":
			return "down"
		}
	}
	return "unknown"
}

func attributesByKey(attributes []nms.AttributeValue) map[string]nms.AttributeValue {
	items := make(map[string]nms.AttributeValue, len(attributes))
	for _, attribute := range attributes {
		items[attribute.Key] = attribute
	}
	return items
}

func attributeString(attributes map[string]nms.AttributeValue, key string) string {
	attribute, ok := attributes[key]
	if !ok {
		return ""
	}
	switch value := attribute.Value.(type) {
	case string:
		return strings.TrimSpace(value)
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(value)
	default:
		return ""
	}
}

func attrBool(attributes map[string]nms.AttributeValue, key string) bool {
	attribute, ok := attributes[key]
	if !ok {
		return false
	}
	return anyBool(attribute.Value)
}

func anyString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(typed)
	default:
		return ""
	}
}

func anyBool(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case float64:
		return typed != 0
	case string:
		parsed, ok := parseBoolString(typed)
		return ok && parsed
	default:
		return false
	}
}

func anyInt(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(typed)
		return parsed
	default:
		return 0
	}
}

func latestTelemetryTimestamp(telemetry []nms.TelemetryValue) int64 {
	var latest int64
	for _, item := range telemetry {
		if item.Timestamp > latest {
			latest = item.Timestamp
		}
	}
	return latest
}

func freshnessForTimestamp(timestamp int64) string {
	if timestamp <= 0 {
		return "unknown"
	}
	if time.Since(time.UnixMilli(timestamp)) > 5*time.Minute {
		return "stale"
	}
	return "fresh"
}

func timestampRFC3339(timestamp int64) string {
	if timestamp <= 0 {
		return ""
	}
	return time.UnixMilli(timestamp).UTC().Format(time.RFC3339)
}

func parseTelemetryValue(value string) (any, bool) {
	parsed, err := strconv.ParseFloat(value, 64)
	if err == nil && !math.IsNaN(parsed) && !math.IsInf(parsed, 0) {
		return parsed, true
	}
	if boolValue, ok := parseBoolString(value); ok {
		return boolValue, false
	}
	return value, false
}

func metricStatus(value float64, entry metricCatalogEntry) string {
	if entry.HasCrit && value >= entry.Critical {
		return "critical"
	}
	if entry.HasWarn && value >= entry.Warn {
		return "warning"
	}
	if entry.HasWarn || entry.HasCrit {
		return "normal"
	}
	return "unknown"
}

func isObservationalNumericMetric(key string) bool {
	if interfaceMetricKeyRE.MatchString(key) {
		return strings.HasSuffix(key, ".rx_bps") || strings.HasSuffix(key, ".tx_bps") || strings.HasSuffix(key, ".speed_bps")
	}
	if storageMetricKeyRE.MatchString(key) {
		return strings.HasSuffix(key, ".used_bytes") || strings.HasSuffix(key, ".total_bytes") || strings.HasSuffix(key, ".free_bytes")
	}
	return false
}

func truthy(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case float64:
		return typed != 0
	case string:
		parsed, ok := parseBoolString(typed)
		return ok && parsed
	default:
		return false
	}
}

func parseBoolString(value string) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1", "yes", "up", "reachable":
		return true, true
	case "false", "0", "no", "down", "unreachable":
		return false, true
	default:
		return false, false
	}
}

func asSlice(value any) []any {
	switch typed := value.(type) {
	case []any:
		return typed
	case []map[string]any:
		items := make([]any, 0, len(typed))
		for _, item := range typed {
			items = append(items, item)
		}
		return items
	default:
		return nil
	}
}

func stringFromMap(values map[string]any, key string) string {
	value, ok := values[key]
	if !ok {
		return ""
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	return ""
}

func floatFromMap(values map[string]any, key string) (float64, bool) {
	value, ok := values[key]
	if !ok {
		return 0, false
	}
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	case string:
		parsed, err := strconv.ParseFloat(typed, 64)
		return parsed, err == nil
	default:
		return 0, false
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func humanizeKey(key string) string {
	cleaned := strings.NewReplacer(".", " ", "_", " ", "-", " ").Replace(key)
	parts := strings.Fields(cleaned)
	for i, part := range parts {
		if len(part) <= 3 {
			parts[i] = strings.ToUpper(part)
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func groupTitle(group string) string {
	switch group {
	case "availability":
		return "Availability"
	case "system":
		return "System"
	case "interfaces":
		return "Interfaces"
	case "storage":
		return "Storage"
	default:
		return "Other"
	}
}

func groupOrder(group string) int {
	switch group {
	case "availability":
		return 10
	case "system":
		return 20
	case "interfaces":
		return 30
	case "storage":
		return 40
	default:
		return 90
	}
}

func requestedScopes(r *http.Request, fallback []string) []string {
	requested := strings.TrimSpace(r.URL.Query().Get("scope"))
	if requested == "" {
		return fallback
	}

	return []string{requested}
}

func parseInt64Query(r *http.Request, key string, fallback int64) int64 {
	value := r.URL.Query().Get(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}

	return parsed
}

func parseIntQuery(r *http.Request, key string, fallback int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func splitQueryCSV(value string) []string {
	if value == "" {
		return nil
	}

	items := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			items = append(items, trimmed)
		}
	}

	return items
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, map[string]string{"error": message})
}
