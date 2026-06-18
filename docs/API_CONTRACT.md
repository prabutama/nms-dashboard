# API Contract

## Phase 3 endpoints

Phase 3 keeps existing raw/debug endpoints and adds normalized dashboard view models for operational UI.

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
    "thingsBoardSiteAssetType": "site",
    "corsAllowedOrigins": ["http://localhost:3000"]
  }
}
```

### `GET /api/v1/sites`

Returns minimal site inventory payload.

If ThingsBoard is configured and reachable, BFF attempts to load site assets. If not, BFF still returns stable placeholder JSON instead of `404`.

Example response:

```json
{
  "items": [],
  "source": "thingsboard",
  "message": "No sites found or ThingsBoard integration not configured"
}
```

### `GET /api/v1/sites/{siteKey}/devices`

Returns normalized devices related to a site asset.

Example response:

```json
{
  "siteKey": "headquarter",
  "items": [
    {
      "deviceId": "device-id",
      "name": "HQ-GATEWAY-1",
      "type": "router",
      "label": "HQ Gateway 1",
      "relationType": "Contains"
    }
  ],
  "source": "thingsboard",
  "message": "Devices loaded from ThingsBoard"
}
```

### `GET /api/v1/assets/{assetId}/attributes`

Returns raw ThingsBoard attributes for a site asset.

Query params:

* `scope`: optional. Defaults to `SERVER_SCOPE` for assets.
* `keys`: optional comma-separated attribute keys.

Example response:

```json
{
  "entityType": "ASSET",
  "entityId": "asset-id",
  "scopes": {
    "SERVER_SCOPE": [
      {
        "key": "nmsSite",
        "value": { "region": "Jakarta" },
        "valueType": "json",
        "lastUpdateTs": 1710000000000
      }
    ]
  },
  "source": "thingsboard",
  "message": "Attributes loaded from ThingsBoard"
}
```

### `GET /api/v1/devices/{deviceId}/attributes`

Returns raw ThingsBoard attributes for a device.

By default it reads `SERVER_SCOPE`, `CLIENT_SCOPE`, and `SHARED_SCOPE`. Use `scope` to read only one scope.

Example response shape is same as asset attributes with `entityType: "DEVICE"`.

### `GET /api/v1/devices/{deviceId}`

Returns basic normalized device identity.

Example response:

```json
{
  "item": {
    "deviceId": "device-id",
    "name": "HQ-GATEWAY-1",
    "type": "router",
    "label": "HQ Gateway 1",
    "profile": "Network Device"
  },
  "source": "thingsboard",
  "message": "Device detail loaded from ThingsBoard"
}
```

If ThingsBoard is not configured or detail cannot be loaded, `item` is `null` with a message.

### `GET /api/v1/devices/{deviceId}/telemetry/latest`

Returns latest telemetry values for a device.

Example response:

```json
{
  "deviceId": "device-id",
  "items": [
    {
      "key": "cpu_usage",
      "value": "12.5",
      "timestamp": 1710000000000
    }
  ],
  "source": "thingsboard",
  "message": "Latest telemetry loaded from ThingsBoard"
}
```

If no latest telemetry exists, `items` is empty with a message.

### `GET /api/v1/devices/{deviceId}/summary`

Returns basic device identity plus derived latest telemetry summary.

Example response:

```json
{
  "item": {
    "deviceId": "device-id",
    "name": "HQ-GATEWAY-1",
    "type": "router",
    "label": "HQ Gateway 1",
    "profile": "Network Device",
    "status": "active",
    "telemetryCount": 2,
    "lastTelemetryTs": 1710000000100,
    "latestTelemetry": [
      {
        "key": "cpu_usage",
        "value": "12.5",
        "timestamp": 1710000000000
      }
    ]
  },
  "source": "thingsboard",
  "message": "Device summary loaded from ThingsBoard"
}
```

`status` is initially derived as `active` when latest telemetry exists, otherwise `unknown`.

### `GET /api/v1/devices/{deviceId}/dashboard`

Returns normalized NMS dashboard model for one device. BFF combines ThingsBoard device detail, latest telemetry, device attributes, freshness, health, and metric catalog metadata.

Example response:

```json
{
  "device": {
    "deviceId": "device-id",
    "name": "linux-hq-server-2",
    "label": "HQ Linux App Server",
    "type": "server",
    "profile": "Linux Server"
  },
  "health": {
    "status": "normal",
    "reachable": true,
    "freshness": "fresh",
    "lastTelemetryAt": "2026-06-15T19:05:03Z",
    "lastTelemetryAgeSeconds": 30
  },
  "metricCards": [
    {
      "key": "snmp.host.cpu.load_pct",
      "label": "CPU Usage",
      "value": 12.5,
      "numeric": true,
      "unit": "%",
      "group": "system",
      "subgroup": "",
      "status": "normal",
      "freshness": "fresh",
      "updatedAt": "2026-06-15T19:05:03Z",
      "order": 100,
      "displayOrder": 100,
      "visualType": "line"
    }
  ],
  "metricGroups": [
    {
      "group": "system",
      "title": "System",
      "items": []
    }
  ],
  "interfaces": [],
  "storage": [],
  "routing": {
    "supported": true,
    "source": "snmp_ip_cidr_route_table",
    "collectedAt": "2026-06-16T10:50:36.952442697Z",
    "defaultRoute": {
      "destination": "0.0.0.0/0",
      "nextHop": "172.16.20.1",
      "interfaceId": "2",
      "interfaceName": "eth0",
      "protocol": "local",
      "routeType": "remote"
    },
    "summary": {
      "routeCount": 2,
      "defaultRouteCount": 1,
      "connectedRouteCount": 1,
      "remoteRouteCount": 1,
      "changed": false
    },
    "routes": []
  },
  "debug": {
    "rawTelemetryCount": 1,
    "rawAttributeCount": 3
  },
  "source": "thingsboard",
  "message": "Device dashboard loaded from ThingsBoard"
}
```

Dashboard behavior:

* Endpoint is stateless. No PostgreSQL, Redis, auth, or custom RBAC.
* Frontend receives only normalized BFF data. ThingsBoard API key is never exposed.
* Missing attributes do not break response. Unknown metrics use generated label, empty unit, `group: "other"`, and `status: "unknown"`.
* `nmsIdentity.displayName`, `nmsIdentity.label`, or `nmsIdentity.name` can override display label.
* `nmsMetrics` can override metric label, unit, group, order, visualization, warning threshold, and critical threshold.
* `nmsInterfaces` and `nmsStorage` populate optional inventory sections when present.
* Indexed interface keys matching `snmp.if.idx{index}.{metric}` use `snmp.if.idx{index}.name`, `alias`, or `description` to produce labels such as `eth0 RX Throughput`.
* Indexed storage keys matching `snmp.host.storage.idx{index}.{metric}` use `snmp.host.storage.idx{index}.description` for labels such as `/ Storage Usage`; `type` is returned separately in storage table rows.
* Routing uses `route.ipv4.snapshot` first, then falls back to `route.ipv4.default.*` attributes.
* `subgroup` contains the interface/storage entity name when relevant.
* Raw telemetry keys are unchanged. Normalized labels are display metadata only.

If no devices are related to the site:

```json
{
  "siteKey": "headquarter",
  "items": [],
  "source": "thingsboard",
  "message": "No devices found for site"
}
```

### `GET /api/v1/alarms`

Returns tenant-wide alarms from ThingsBoard with normalized metadata and pagination.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `searchStatus` | string | - | Filter by `ANY`, `ACTIVE`, `CLEARED`, `ACK`, `UNACK` |
| `status` | string | - | Filter by `ACTIVE_UNACK`, `ACTIVE_ACK`, `CLEARED_UNACK`, `CLEARED_ACK` |
| `textSearch` | string | - | Case-insensitive substring filter on type, severity, or status |
| `page` | int | 0 | Page number starting from 0 |
| `pageSize` | int | 20 | Items per page |
| `startTime` | int64 | - | Start timestamp in milliseconds (filters by `createdTime`) |
| `endTime` | int64 | - | End timestamp in milliseconds (filters by `createdTime`) |

Always returns 200. Stable empty items if ThingsBoard not configured or unreachable.

Example response:

```json
{
  "items": [
    {
      "alarmId": "e3c7e6b0-480b-11f1-9d47-25e13b93d50b",
      "name": "hq-server-1",
      "type": "Link Down",
      "severity": "CRITICAL",
      "status": "ACTIVE_UNACK",
      "acknowledged": false,
      "cleared": false,
      "originatorId": "37cf76e0-687d-11f1-9881-537573625718",
      "originatorType": "DEVICE",
      "originatorName": "hq-server-1",
      "originatorLabel": "HQ Server 1",
      "originatorDisplayName": "HQ Server 1",
      "createdAt": "2026-06-16T08:20:10Z",
      "startAt": "2026-06-16T08:20:10Z",
      "details": {}
    }
  ],
  "page": 0,
  "pageSize": 20,
  "totalElements": 1,
  "totalPages": 1,
  "hasNext": false,
  "source": "thingsboard",
  "message": "Alarms loaded from ThingsBoard"
}
```

### `POST /api/v1/alarms/{alarmId}/ack`

Acknowledge one alarm through ThingsBoard. BFF proxies request to ThingsBoard `POST /api/alarm/{alarmId}/ack` using tenant API key auth.

Example response:

```json
{
  "ok": true,
  "action": "ack",
  "alarmId": "e3c7e6b0-480b-11f1-9d47-25e13b93d50b",
  "alarm": {
    "alarmId": "e3c7e6b0-480b-11f1-9d47-25e13b93d50b",
    "status": "ACTIVE_ACK",
    "acknowledged": true,
    "cleared": false
  },
  "source": "thingsboard",
  "message": "Alarm acknowledged"
}
```

### `POST /api/v1/alarms/{alarmId}/clear`

Clear one alarm through ThingsBoard. BFF proxies request to ThingsBoard `POST /api/alarm/{alarmId}/clear` using tenant API key auth.

Example response:

```json
{
  "ok": true,
  "action": "clear",
  "alarmId": "e3c7e6b0-480b-11f1-9d47-25e13b93d50b",
  "alarm": {
    "alarmId": "e3c7e6b0-480b-11f1-9d47-25e13b93d50b",
    "status": "CLEARED_ACK",
    "acknowledged": true,
    "cleared": true
  },
  "source": "thingsboard",
  "message": "Alarm cleared"
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
    "reachable": true,
    "baseUrl": "https://thingsboard.example.com"
  }
}
```

If config is missing:

```json
{
  "status": "degraded",
  "thingsboard": {
    "configured": false,
    "reachable": false,
    "baseUrl": ""
  }
}
```

## Environment variables

### BFF

* `PORT`: listen port. Default `8080`.
* `THINGSBOARD_BASE_URL`: ThingsBoard base URL for BFF-only REST requests.
* `THINGSBOARD_API_KEY`: ThingsBoard tenant API key for BFF-only REST requests. Sent to ThingsBoard as `X-Authorization: ApiKey <value>` and never exposed to frontend.
* `THINGSBOARD_SITE_ASSET_TYPE`: asset type used to discover sites. Default `site`.
* `CACHE_TTL_SECONDS`: placeholder cache TTL config. Default `30`.
* `CORS_ALLOWED_ORIGINS`: comma-separated local frontend origins. Default `http://localhost:3000`.

### Frontend

* `NEXT_PUBLIC_API_BASE_URL`: BFF base URL. Default `http://localhost:8080`.

### `GET /api/v1/sites/{siteKey}/topology`

Returns logical IPv4 topology for a site, inferred from the asset's `topology.logical.ipv4.snapshot` SERVER_SCOPE attribute.

Example response:

```json
{
  "site": {
    "siteKey": "br-b",
    "assetId": "asset-brb",
    "name": "Branch-B",
    "type": "default"
  },
  "topology": {
    "supported": true,
    "source": "topology.logical.ipv4.snapshot",
    "generatedAt": "2026-06-15T13:58:48.141281591Z",
    "fingerprint": "abb7f7ba953a5ef8171cca6e2c0c616f3687b5bfb2584b6cc791cdb6109062b4",
    "summary": {
      "deviceCount": 3,
      "nodeCount": 6,
      "edgeCount": 7,
      "subnetCount": 2,
      "externalCount": 1
    },
    "nodes": [
      {
        "id": "device:mikrotik-br-b-router",
        "kind": "device",
        "name": "mikrotik-br-b-router",
        "displayType": "Router / Gateway",
        "displayRole": "router",
        "displayShape": "router",
        "layer": "gateway"
      }
    ],
    "edges": [
      {
        "from": "device:mikrotik-br-b-router",
        "to": "subnet:172.16.30.0/24",
        "reason": "connected_subnet",
        "resolved": true
      }
    ]
  }
}
```

Node classification rules:

| Condition | displayType | displayRole | displayShape | layer |
|---|---|---|---|---|
| Device name contains router/gateway/gw/mikrotik/vytos/cisco/edge/firewall, OR has default_route edge, OR connects to external, OR connects to >=2 subnets | `Router / Gateway` | `router` | `router` | `gateway` |
| Device without router classification | `Server` | `server` | `server` | `endpoint` |
| Kind is `subnet` | `LAN Segment` | `subnet` | `segment` | `network` |
| Kind is `external_gateway` | `External Gateway` | `external_gateway` | `external` | `external` |

Edge visual types:

| reason | visual style |
|---|---|
| `connected_subnet` | solid line |
| `default_route` | dashed amber line |
| `next_hop_match` | subtle dashed line |

Returns `supported: false` and empty nodes/edges when the `topology.logical.ipv4.snapshot` attribute is not present on the site asset or cannot be parsed.

### `GET /api/v1/reports/summary`

Returns aggregated report summary: KPI counts, top sites by alarms, top devices by issues.

Query params:

* `range`: optional. Defaults to `24h`. Valid values: `24h`, `7d`, `30d`.

Example response:

```json
{
  "range": {
    "label": "24h",
    "startAt": "2026-06-16T00:00:00Z",
    "endAt": "2026-06-17T00:00:00Z"
  },
  "summary": {
    "siteCount": 4,
    "deviceCount": 18,
    "onlineDeviceCount": 15,
    "staleDeviceCount": 2,
    "activeAlarmCount": 6,
    "criticalAlarmCount": 2
  },
  "topSitesByAlarms": [
    {
      "siteKey": "branch-b",
      "siteName": "Branch-B",
      "deviceCount": 4,
      "onlineDeviceCount": 3,
      "staleDeviceCount": 1,
      "activeAlarmCount": 3,
      "criticalAlarmCount": 1,
      "health": "warning",
      "lastUpdatedAt": "2026-06-17T10:30:00Z"
    }
  ],
  "topDevicesByIssues": [
    {
      "deviceId": "device-id",
      "siteKey": "branch-b",
      "name": "mikrotik-br-b-router",
      "type": "router",
      "health": "warning",
      "reachable": true,
      "freshness": "fresh",
      "alarmCount": 2,
      "avgLatencyMs": 12.4,
      "packetLossPct": 0,
      "cpuAvgPct": 48.1,
      "memoryAvgPct": 72.3,
      "updatedAt": "2026-06-17T10:30:00Z"
    }
  ],
  "generatedAt": "2026-06-17T10:30:00Z",
  "source": "thingsboard",
  "message": "Report summary generated"
}
```

### `GET /api/v1/reports/sites`

Returns per-site report rows with device/alarm counts and health.

Query params:

* `range`: optional. Defaults to `24h`. Valid: `24h`, `7d`, `30d`.

Example response:

```json
{
  "range": { "label": "24h", "startAt": "...", "endAt": "..." },
  "items": [
    {
      "siteKey": "headquarter",
      "siteName": "HeadQuarter",
      "deviceCount": 5,
      "onlineDeviceCount": 4,
      "staleDeviceCount": 1,
      "activeAlarmCount": 2,
      "criticalAlarmCount": 1,
      "health": "warning",
      "lastUpdatedAt": "2026-06-17T10:30:00Z"
    }
  ],
  "source": "thingsboard",
  "message": "Site report generated"
}
```

### `GET /api/v1/reports/devices`

Returns per-device report rows with health, alarm count, and key metrics.

Query params:

* `range`: optional. Defaults to `24h`. Valid: `24h`, `7d`, `30d`.
* `siteKey`: optional. Filter devices by site key.

Example response:

```json
{
  "range": { "label": "24h", "startAt": "...", "endAt": "..." },
  "items": [
    {
      "deviceId": "device-id",
      "siteKey": "headquarter",
      "name": "hq-server",
      "type": "server",
      "health": "critical",
      "reachable": true,
      "freshness": "fresh",
      "alarmCount": 1,
      "avgLatencyMs": 0,
      "packetLossPct": 0,
      "cpuAvgPct": 82.5,
      "memoryAvgPct": 91.3,
      "updatedAt": "2026-06-17T10:30:00Z"
    }
  ],
  "source": "thingsboard",
  "message": "Device report generated"
}
```

## Frontend Route Usage

The frontend is split into route-based operational pages instead of one long debug page:

* `/` uses site and sampled device dashboard data for overview.
* `/sites` uses `/api/v1/sites` and `/api/v1/sites/{siteKey}/devices`.
* `/sites/{siteKey}` uses site devices and asset attributes.
* `/sites/{siteKey}/topology` uses `/api/v1/sites/{siteKey}/topology` for the interactive logical topology view with zoom/pan, minimap, and legend.
* `/alarms` uses `/api/v1/alarms` for active/filtered alarm views with severity/status columns.
* `/devices` uses site/device inventory through BFF.
* `/devices/{deviceId}` uses `/api/v1/devices/{deviceId}/dashboard`, history telemetry, raw latest telemetry, and raw device attributes.
* `/reports` uses `/api/v1/reports/summary`, `/api/v1/reports/sites`, and `/api/v1/reports/devices` for periodic performance, health, and alarm summary with CSV export.

Raw telemetry and raw attributes remain visible only in collapsible advanced/debug panels.

## Non-goals in current Phase 3

* no persistent database
* no Redis
* no auth endpoints
* no custom RBAC
* no persistent dashboard preferences
* no ThingsBoard calls from frontend
* no scheduled reports
* no PDF export
