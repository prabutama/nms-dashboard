You are working on the `nms-dashboard` project.

Read and follow `AGENTS.md` before making changes.

Implement the next UI/UX and metric-label normalization phase.

Current project state:

* BFF runs locally from `apps/bff`.
* Frontend runs locally from `apps/web`.
* ThingsBoard runs on a public server.
* BFF connects to ThingsBoard using tenant API key auth.
* BFF already exposes working endpoints:

  * `GET /health`
  * `GET /api/v1/health`
  * `GET /api/v1/integrations/thingsboard/status`
  * `GET /api/v1/sites`
  * `GET /api/v1/sites/{siteKey}/devices`
  * `GET /api/v1/sites/{siteKey}/alarms`
  * `GET /api/v1/sites/{siteKey}/topology`
  * `GET /api/v1/devices/{deviceId}`
  * `GET /api/v1/devices/{deviceId}/telemetry/latest`
  * `GET /api/v1/devices/{deviceId}/telemetry/history`
  * `GET /api/v1/devices/{deviceId}/summary`
  * `GET /api/v1/devices/{deviceId}/dashboard`
  * `GET /api/v1/devices/{deviceId}/alarms`
  * `GET /api/v1/devices/{deviceId}/attributes`
  * `GET /api/v1/assets/{assetId}/attributes`
  * `GET /api/v1/alarms`
  * `GET /api/v1/reports/summary`
  * `GET /api/v1/reports/sites`
  * `GET /api/v1/reports/devices`
* Frontend already displays sites, devices, detail, latest telemetry, history charts, summary, freshness badges, raw attributes, topology, alarms, and reports with CSV export.

Main goal:
Improve the dashboard so it looks like a clean professional system GUI, and improve metric display names by combining telemetry keys with ThingsBoard attributes.

## Part 1 — Frontend design direction

Refactor the frontend UI to match a clean light system GUI style.

Design requirements:

* Use Poppins as the main font.
* Use light theme as the primary design.
* Base colors:

  * white
  * light gray
  * slate/dark text
  * blue as the primary accent
* Do not use neon colors.
* Do not use glowing effects.
* Do not use dark cyberpunk styling.
* Reduce border radius significantly.
* Prefer square or slightly rounded system panels.
* Use thin borders, clear grid lines, and compact spacing.
* Make the UI feel like a professional monitoring system GUI, not a soft SaaS landing dashboard.
* Keep status colors subtle:

  * green for healthy/online
  * amber for warning
  * red for critical/offline
  * gray for unknown/stale

Layout requirements:

* Do not put everything into one long page.
* Use a structured multi-page or multi-section dashboard.
* Recommended navigation:

  * Overview
  * Sites
  * Devices
  * Alarms
  * Reports
  * Settings
* Device detail should have tabs or sections:

  * Overview
  * Metrics
  * Interfaces
  * Storage
  * Alarms
  * Attributes
  * Advanced / Debug

UI structure:

1. Top bar:

   * app title
   * current time or refresh info
   * time range selector
   * refresh button
   * user/admin indicator placeholder

2. Left sidebar:

   * NMS Dashboard logo/title
   * navigation menu
   * selected item uses solid blue background
   * minimal icons if already available

3. Overview page:

   * KPI cards:

     * total sites
     * total devices
     * online devices
     * active alarms
     * average uptime if available
   * health distribution
   * active alarms table
   * recent devices table
   * top sites by alarms if data exists

4. Sites page:

   * site table/list
   * device count
   * alarm count
   * status
   * last update
   * search/filter UI placeholder

5. Site detail page:

   * site identity
   * site health
   * device count
   * device list
   * recent alarms
   * attributes tab/panel

6. Device detail page:

   * device identity header
   * health summary cards
   * metric cards
   * history charts
   * interface table
   * storage table
   * raw telemetry and raw attributes moved to Advanced / Debug collapsible panel

Frontend constraints:

* Frontend must never call ThingsBoard directly.
* Frontend must call only the BFF.
* Keep existing data functionality working.
* Do not remove raw telemetry or attributes, but move them to Advanced / Debug.
* Do not add authentication.
* Do not add PostgreSQL.
* Do not add Redis.
* Do not add new chart library beyond existing Recharts.

## Part 2 — Metric display name normalization

Current problem:
Some metrics are displayed using raw indexed telemetry names, for example:

`Snmp IF Idx2 RX BPS`

This is not readable for users.

The device attributes already contain index-to-name metadata, for example:

`snmp.if.idx2.name = eth0`

The dashboard should use this attribute to display a better label.

Expected behavior:

* Keep raw metric keys unchanged internally.
* Improve display labels in BFF response and frontend rendering.
* Do not rename telemetry keys in ThingsBoard.
* Only change normalized display metadata.

Example transformation:

Raw telemetry key:

`snmp.if.idx2.rx_bps`

Device attribute:

`snmp.if.idx2.name = eth0`

Display label should become:

`eth0 RX Throughput`

Other examples:

* `snmp.if.idx2.tx_bps` → `eth0 TX Throughput`
* `snmp.if.idx2.oper_status` → `eth0 Operational Status`
* `snmp.if.idx2.admin_status` → `eth0 Admin Status`
* `snmp.if.idx2.speed_bps` → `eth0 Link Speed`
* `snmp.if.idx2.in_errors` → `eth0 RX Errors`
* `snmp.if.idx2.out_errors` → `eth0 TX Errors`

If the interface name attribute is missing:

* fallback to `Interface idx2 RX Throughput`
* never show ugly labels such as `Snmp IF Idx2 RX BPS` in the main dashboard

## BFF metric metadata resolver

Add or improve a BFF metric metadata resolver.

The resolver should:

1. Accept:

   * raw telemetry key
   * latest telemetry value
   * device attributes
   * optional static metric catalog

2. Return normalized metadata:

   * raw key
   * display label
   * value
   * unit
   * group
   * subgroup/entity name if relevant
   * status
   * freshness
   * updatedAt
   * display order

3. Support interface indexed metrics.

Pattern:

* `snmp.if.idx{index}.{metric}`

Attribute lookup:

* `snmp.if.idx{index}.name`
* optional future fallback:

  * `snmp.if.idx{index}.alias`
  * `snmp.if.idx{index}.description`

Examples:

* key: `snmp.if.idx2.rx_bps`
* attr: `snmp.if.idx2.name = eth0`
* group: `interfaces`
* subgroup: `eth0`
* label: `eth0 RX Throughput`
* unit: `bps`

4. Support storage indexed metrics if present.

Pattern:

* `snmp.storage.idx{index}.{metric}`

Attribute lookup:

* `snmp.storage.idx{index}.description`
* optional fallback:

  * `snmp.storage.idx{index}.name`

Examples:

* `snmp.storage.idx36.used_pct`
* `snmp.storage.idx36.description = /`
* display label: `/ Storage Usage`
* group: `storage`
* unit: `%`

5. Support common non-indexed metrics.

Examples:

* `icmp.reachable` → `Reachability`
* `icmp.latency_ms` → `Latency`
* `icmp.packet_loss_pct` → `Packet Loss`
* `icmp.jitter_ms` → `Jitter`
* `snmp.host.cpu.load_pct` → `CPU Usage`
* `snmp.host.memory.used_pct` → `Memory Usage`
* `snmp.host.swap.used_pct` → `Swap Usage`

6. Support fallback formatting.

If the key is unknown:

* generate a readable label from the key
* remove technical prefix if possible
* replace dots/underscores with spaces
* title case words
* keep group `other`

But indexed interface/storage metrics must prefer attribute-based names when attributes exist.

## Endpoint impact

Apply this normalization to:

* `GET /api/v1/devices/{deviceId}/dashboard`
* `GET /api/v1/devices/{deviceId}/summary` if applicable
* frontend metric cards
* frontend chart titles
* interface/storage sections if applicable

Do not break existing endpoints.

If `/api/v1/devices/{deviceId}/dashboard` does not exist yet, add it as the preferred frontend endpoint for device detail.

Expected metric object example:

```json
{
  "key": "snmp.if.idx2.rx_bps",
  "label": "eth0 RX Throughput",
  "value": 123456,
  "unit": "bps",
  "group": "interfaces",
  "subgroup": "eth0",
  "status": "normal",
  "freshness": "fresh",
  "updatedAt": "2026-06-15T19:05:03Z",
  "displayOrder": 310
}
```

Expected interface group example:

```json
{
  "name": "eth0",
  "index": "2",
  "metrics": [
    {
      "key": "snmp.if.idx2.rx_bps",
      "label": "RX Throughput",
      "value": 123456,
      "unit": "bps"
    },
    {
      "key": "snmp.if.idx2.tx_bps",
      "label": "TX Throughput",
      "value": 654321,
      "unit": "bps"
    }
  ]
}
```

Important:

* In grouped interface tables, labels may be shorter such as `RX Throughput` because the row already shows `eth0`.
* In standalone metric cards or charts, use full label such as `eth0 RX Throughput`.

## Frontend rendering rules

Frontend should prefer BFF-provided labels.

Rules:

* Use `label` from BFF if available.
* Use `unit` from BFF if available.
* Use `group` to place metrics into sections.
* Use `subgroup` for interface/storage grouping.
* Do not re-generate ugly labels in frontend unless BFF label is missing.
* Chart titles must use human-readable labels.
* Tables must display interface/storage names from attributes where available.

## Documentation

Update:

* `README.md`
* `docs/API_CONTRACT.md`
* `docs/DEVELOPMENT_STAGES.md`
* `docs/METRIC_CATALOG.md`
* `docs/ARCHITECTURE.md`

Document:

* light system GUI design direction
* metric display names are resolved from telemetry + attributes
* indexed interface metrics use `snmp.if.idx{index}.name`
* indexed storage metrics use storage description/name attributes
* raw telemetry keys remain unchanged
* normalized labels are for dashboard display only

## Validation

From `apps/bff`:

* run `gofmt`
* run `go test ./...`
* run `go build ./...`

From `apps/web`:

* run `npm run build`
* run `npm run lint`

From project root:

* run:

  * `docker compose -f deploy/docker-compose.yml config`

Only mark the task complete if validation succeeds.
