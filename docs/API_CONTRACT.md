# API Contract

## Phase 1 endpoints

Phase 1 exposes health endpoints only.

### `GET /health`

Returns process health for basic uptime checks.

Example response:

```json
{
  "service": "nms-bff",
  "status": "ok",
  "timestamp": "2026-06-16T12:00:00Z",
  "version": "phase-1",
  "phase": "skeleton",
  "config": {
    "port": "8080",
    "cacheTtlSeconds": 30,
    "thingsBoardBaseUrlSet": false,
    "thingsBoardApiKeySet": false,
    "thingsBoardConfigured": false,
    "thingsBoardClientEnabled": false
  }
}
```

### `GET /api/v1/health`

Returns same payload as `/health` under versioned API namespace.

## Environment variables

### BFF

* `PORT`: listen port. Default `8080`.
* `THINGSBOARD_BASE_URL`: reserved for later phases.
* `THINGSBOARD_API_KEY`: reserved for later phases. Never exposed to frontend.
* `CACHE_TTL_SECONDS`: placeholder cache TTL config. Default `30`.

### Frontend

* `NEXT_PUBLIC_API_BASE_URL`: BFF base URL. Default `http://localhost:8080`.

## Non-goals in Phase 1

* no ThingsBoard REST proxy endpoints
* no device APIs
* no site APIs
* no alarms APIs
* no auth endpoints
