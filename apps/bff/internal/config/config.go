package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	ThingsBoardBaseURL  string
	ThingsBoardAPIKey   string
	ThingsBoardSiteType string
	HasThingsBoardSetup bool
	Port                string
	CORSAllowedOrigins  []string
	CacheTTLSeconds     int
	PublicDemoMode      bool
	DataSource          string
	DatabaseURL         string
	IngestAPIKey        string
}

func Load() Config {
	cacheTTLSeconds := 30
	if raw := os.Getenv("CACHE_TTL_SECONDS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			cacheTTLSeconds = parsed
		}
	}

	return Config{
		ThingsBoardBaseURL:  os.Getenv("THINGSBOARD_BASE_URL"),
		ThingsBoardAPIKey:   os.Getenv("THINGSBOARD_API_KEY"),
		ThingsBoardSiteType: getEnv("THINGSBOARD_SITE_ASSET_TYPE", "site"),
		HasThingsBoardSetup: os.Getenv("THINGSBOARD_BASE_URL") != "" && os.Getenv("THINGSBOARD_API_KEY") != "",
		Port:                getEnv("PORT", "8080"),
		CORSAllowedOrigins:  splitCSVEnv(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		CacheTTLSeconds:     cacheTTLSeconds,
		PublicDemoMode:      strings.EqualFold(getEnv("PUBLIC_DEMO_MODE", "false"), "true"),
		DataSource:          strings.ToLower(getEnv("NMS_DATA_SOURCE", "postgres")),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		IngestAPIKey:        os.Getenv("NMS_INGEST_API_KEY"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func splitCSVEnv(value string) []string {
	parts := make([]string, 0)
	for _, part := range strings.Split(value, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}

	if len(parts) == 0 {
		return []string{"http://localhost:3000"}
	}

	return parts
}
