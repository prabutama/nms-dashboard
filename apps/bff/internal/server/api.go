package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
	"github.com/isapr/nms-dashboard/apps/bff/internal/nms"
	"github.com/isapr/nms-dashboard/apps/bff/internal/thingsboard"
)

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

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
	Configured bool `json:"configured"`
	Reachable  bool `json:"reachable"`
}

type sitesResponse struct {
	Items []nms.Site `json:"items"`
}

type siteDevicesResponse struct {
	SiteKey string       `json:"siteKey"`
	Items   []nms.Device `json:"items"`
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
		r.Get("/sites", s.sitesHandler())
		r.Get("/sites/{siteKey}/devices", s.siteDevicesHandler())
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
			},
		}

		writeJSON(w, http.StatusOK, response)
	}
}

func (s *apiServer) thingsBoardStatusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response := integrationStatusResponse{
			Status: "ok",
			ThingsBoard: thingsBoardStatusResponse{
				Configured: s.cfg.HasThingsBoardSetup,
				Reachable:  false,
			},
		}

		if s.tb != nil {
			if err := s.tb.CheckStatus(r.Context()); err == nil {
				response.ThingsBoard.Reachable = true
			} else {
				s.logger.Warn("thingsboard status check failed", "error", err)
			}
		}

		writeJSON(w, http.StatusOK, response)
	}
}

func (s *apiServer) sitesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeError(w, http.StatusServiceUnavailable, "thingsboard integration is not configured")
			return
		}

		sites, err := s.loadSites(r.Context())
		if err != nil {
			s.logger.Error("load sites failed", "error", err)
			writeError(w, http.StatusBadGateway, "failed to load sites from ThingsBoard")
			return
		}

		writeJSON(w, http.StatusOK, sitesResponse{Items: sites})
	}
}

func (s *apiServer) siteDevicesHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeError(w, http.StatusServiceUnavailable, "thingsboard integration is not configured")
			return
		}

		siteKey := chi.URLParam(r, "siteKey")
		sites, err := s.loadSites(r.Context())
		if err != nil {
			s.logger.Error("load sites for device listing failed", "error", err)
			writeError(w, http.StatusBadGateway, "failed to load sites from ThingsBoard")
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
			s.logger.Error("load site devices failed", "siteKey", siteKey, "error", err)
			writeError(w, http.StatusBadGateway, "failed to load site devices from ThingsBoard")
			return
		}

		writeJSON(w, http.StatusOK, siteDevicesResponse{SiteKey: selected.SiteKey, Items: devices})
	}
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

func slugify(value string) string {
	slug := strings.ToLower(strings.TrimSpace(value))
	slug = nonSlugChars.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return "site"
	}

	return slug
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, map[string]string{"error": message})
}

func hasErrorContaining(err error, match string) bool {
	if err == nil {
		return false
	}

	return strings.Contains(err.Error(), match) || errors.Is(err, context.DeadlineExceeded)
}
