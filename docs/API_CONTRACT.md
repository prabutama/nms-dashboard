# API Contract

## Phase 2 endpoints

Phase 2 keeps health endpoints and adds first normalized ThingsBoard-backed reads.

### `GET /health`

Returns process health for basic uptime checks.

Example response:

```json
{
  "service": "nms-bff",
  "status": "ok",
  "timestamp": "2026-06-16T12:00:00Z",
  "version": "phase-2",
  "phase": "thingsboard-sites",
  "config": {
    "port": "8080",
    "cacheTtlSeconds": 30,
    "thingsBoardBaseUrlSet": false,
    "thingsBoardApiKeySet": false,
    "thingsBoardConfigured": false,
    "thingsBoardClientEnabled": false,
    "thingsBoardSiteAssetType": "site"
  }
}
```

### `GET /api/v1/health`

Returns same payload as `/health` under versioned API namespace.

### `GET /api/v1/integrations/thingsboard/status`

Returns ThingsBoard integration status.

Example response:

```json
{
  "status": "ok",
  "thingsboard": {
    "configured": true,
    "reachable": true
  }
}
```

### `GET /api/v1/sites`

Returns normalized site assets.

Example response:

```json
{
  "items": [
    {
      "siteKey": "hq",
      "assetId": "asset-id",
      "name": "HQ",
      "type": "site"
    }
  ]
}
```

### `GET /api/v1/sites/{siteKey}/devices`

Returns normalized device list for one site.

Example response:

```json
{
  "siteKey": "hq",
  "items": [
    {
      "deviceId": "device-id",
      "name": "HQ-GATEWAY-1",
      "type": "router",
      "label": "HQ Gateway 1",
      "relationType": "Contains"
    }
  ]
}
```

## Environment variables

### BFF

* `PORT`: listen port. Default `8080`.
* `THINGSBOARD_BASE_URL`: ThingsBoard base URL for BFF-only REST requests.
* `THINGSBOARD_API_KEY`: ThingsBoard API token for BFF-only REST requests. Never exposed to frontend.
* `THINGSBOARD_SITE_ASSET_TYPE`: asset type used to discover sites. Default `site`.
* `CACHE_TTL_SECONDS`: placeholder cache TTL config. Default `30`.

### Frontend

* `NEXT_PUBLIC_API_BASE_URL`: BFF base URL. Default `http://localhost:8080`.

## Non-goals in Phase 2

* no persistent database
* no Redis
* no auth endpoints
* no custom RBAC
* no historical telemetry
* no charts
* no device summary metrics
