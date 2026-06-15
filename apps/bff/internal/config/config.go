package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                string
	ThingsBoardBaseURL  string
	ThingsBoardAPIKey   string
	ThingsBoardSiteType string
	CORSAllowedOrigins  []string
	CacheTTLSeconds     int
	HasThingsBoardSetup bool
}

func Load() Config {
	cacheTTLSeconds := 30
	if raw := os.Getenv("CACHE_TTL_SECONDS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			cacheTTLSeconds = parsed
		}
	}

	thingsBoardBaseURL := os.Getenv("THINGSBOARD_BASE_URL")
	thingsBoardAPIKey := os.Getenv("THINGSBOARD_API_KEY")

	return Config{
		Port:                getEnv("PORT", "8080"),
		ThingsBoardBaseURL:  thingsBoardBaseURL,
		ThingsBoardAPIKey:   thingsBoardAPIKey,
		ThingsBoardSiteType: getEnv("THINGSBOARD_SITE_ASSET_TYPE", "site"),
		CORSAllowedOrigins:  splitCSVEnv(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		CacheTTLSeconds:     cacheTTLSeconds,
		HasThingsBoardSetup: thingsBoardBaseURL != "" && thingsBoardAPIKey != "",
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
