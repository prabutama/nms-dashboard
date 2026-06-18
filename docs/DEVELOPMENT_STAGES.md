# Development Stages

## Phase 1: Skeleton

Status: complete after validation.

Delivered:

* Go BFF skeleton
* Next.js frontend skeleton
* Dockerfiles
* Docker Compose
* initial documentation

Implemented in Phase 1:

* `apps/bff` with health routes and env config
* `apps/web` with dashboard landing page and BFF health widget
* `deploy/docker-compose.yml`

Not included in Phase 1:

* ThingsBoard integration
* persistent storage
* Redis
* authentication
* custom RBAC
* charts and topology data

## Phase 2: Initial ThingsBoard status and sites

Status: complete after validation.

Delivered:

* ThingsBoard REST client in BFF
* integration status endpoint
* minimal site inventory endpoint
* site device relation endpoint
* raw asset and device attributes endpoints
* basic device detail endpoint
* latest telemetry endpoint and frontend key-value view
* historical numeric telemetry endpoint and frontend charts
* device summary endpoint and frontend summary panel
* local development CORS support
* environment examples and updated docs

Implemented in current Phase 2:

* `GET /api/v1/integrations/thingsboard/status`
* `GET /api/v1/sites`
* `GET /api/v1/sites/{siteKey}/devices`
* `GET /api/v1/assets/{assetId}/attributes`
* `GET /api/v1/devices/{deviceId}/attributes`
* `GET /api/v1/devices/{deviceId}`
* `GET /api/v1/devices/{deviceId}/telemetry/latest`
* `GET /api/v1/devices/{deviceId}/telemetry/history`
* `GET /api/v1/devices/{deviceId}/summary`
* BFF config support for `THINGSBOARD_SITE_ASSET_TYPE`
* BFF config support for `CORS_ALLOWED_ORIGINS`
* local `.env` loading for development convenience
* lightweight ThingsBoard reachability check

Not included in current Phase 2:

* advanced chart configuration
* authentication
* persistent storage

## Phase 3A and 3B: Dashboard View Model and UX

Status: complete after validation.

Delivered:

* normalized device dashboard endpoint
* built-in BFF metric catalog for common NMS telemetry keys
* attribute-driven metric metadata overrides through `nmsMetrics`
* freshness, reachability, and health status in dashboard response
* interface and storage catalog sections from attributes when present
* frontend layout refactor into sidebar plus operational main panel
* raw telemetry and attributes moved into advanced/debug UI
* light professional multi-page NMS theme using Poppins, white cards, blue accents, and subtle status badges
* indexed interface/storage metric label normalization from ThingsBoard attributes
* routing panel from `route.ipv4.snapshot` and `route.ipv4.default.*` Client Attributes

Implemented in Phase 3A:

* `GET /api/v1/devices/{deviceId}/dashboard`
* dashboard metric cards and metric groups
* default metadata for ICMP, host CPU, host memory, host swap, interface bps, and storage usage metrics

Implemented in Phase 3B:

* frontend uses dashboard endpoint for device detail main view
* `/` overview page
* `/sites` site inventory page
* `/sites/{siteKey}` site detail page
* `/devices` device inventory page
* `/devices/{deviceId}` device detail dashboard page
* `/interfaces`, `/storage`, `/alarms`, and `/debug` section scaffolds
* main device view shows health cards, grouped metrics, charts, interface/storage tables, and collapsible debug panels

Not included in Phase 3A/3B:

* authentication
* PostgreSQL
* Redis
* custom RBAC
* persistent dashboard preferences
* alarm normalization (added in Phase 4)

## Phase 4: Alarm Fetch

Status: complete.

### BFF

* `GET /api/v1/alarms` — tenant-wide alarm list with pagination and normalized metadata
* query params: `searchStatus`, `status`, `textSearch`, `page`, `pageSize`, `startTime`, `endTime`
* ThingsBoard alarm endpoint: `GET /api/alarms` with `fetchOriginator=true`
* stable empty response when ThingsBoard not configured or unreachable

### Frontend

* `/alarms` — full alarm list page with severity badges, status labels, originator columns, and summary cards
* overview dashboard — active alarm count stat card, critical/major tracking, recent alarms table
* `fetchAlarms` in `apps/web/lib/api.ts`
* `Alarm`, `AlarmListResponse` types in `apps/web/lib/types.ts`

### Validation

* `gofmt`, `go test ./...`, `go build ./...` pass
* `npm run build`, `npm run lint` pass

## Phase 5: Alarm Fetch (per-site)

Status: complete (alarm endpoints implemented).

## Phase 6: Logical Topology

Status: complete.

### BFF

* `GET /api/v1/sites/{siteKey}/topology` — parses `topology.logical.ipv4.snapshot` from asset SERVER_SCOPE attributes
* supports string or nested-object attribute values
* classifies device nodes into Router/Gateway or Server/Endpoint based on name keywords and edge analysis
* enriches nodes with `displayType`, `displayRole`, `displayShape`, `layer` metadata
* returns normalized nodes/edges with summary counts

### Frontend

* `/sites/{siteKey}/topology` — dedicated topology page with:
  * vertical layered layout: External → Gateway → Network → Endpoint
  * distinct node shapes: hexagon (router), rack rectangle (server), horizontal bar (subnet), cloud (external)
  * interactive zoom/pan with mouse wheel and drag
  * zoom in/out/fit/lock controls
  * minimap with viewport indicator
  * legend overlay for node types and edge styles
  * collapsible raw edges table
* the site detail page now includes a summary card and link to the full topology page

### Visualization Rules

* `connected_subnet` edges: solid dark blue/gray line
* `default_route` edges: dashed amber line
* `next_hop_match` edges: subtle dashed slate line
* Topology is inferred from IPv4 route and subnet data — not LLDP/CDP physical cabling

### Validation

* `gofmt`, `go test ./...`, `go build ./...` pass
* `npm run build`, `npm run lint` pass

### Phase 7

* per-device alarm endpoint: `GET /api/v1/devices/{deviceId}/alarms`
* cache improvements
* authentication
* user preferences

### Phase 8: Reporting

Status: complete after validation.

Delivered:

* `GET /api/v1/reports/summary` — aggregated KPI, top sites by alarms, top devices by issues
* `GET /api/v1/reports/sites` — per-site device/alarm counts and health
* `GET /api/v1/reports/devices` — per-device health, alarms, and key metrics
* Reports page with range selector (24h / 7d / 30d)
* KPI summary strip with site/device/online/stale/alarm counts
* Sites report table with CSV export
* Devices report table with CSV export

Backend:

* Aggregates data from ThingsBoard assets, devices, telemetry, and alarms
* Supports configurable time range
* Issue scoring based on alarm count + threshold violations
* Telemetry-based health, freshness, and metric extraction

Frontend:

* `/reports` page with period selector
* Summary KPI strip (6 compact stat cards)
* Sites table: name, devices, online, stale, alarms, critical, health
* Devices table: name, type, health, reachable, alarms, latency, loss, CPU, memory
* CSV export for both tables with UTF-8 BOM encoding
