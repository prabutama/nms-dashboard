package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                string
	ThingsBoardBaseURL  string
	ThingsBoardAPIKey   string
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
