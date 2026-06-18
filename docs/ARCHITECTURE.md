# Architecture

## Phase 3 Direction

Phase 3 turns raw ThingsBoard telemetry and attributes into stable NMS dashboard view models.

Current rules:

* BFF stays stateless.
* No PostgreSQL.
* No Redis.
* Authentication is rolling out through ThingsBoard user JWT.
* Access control follows ThingsBoard authorities.
* ThingsBoard remains source of truth.
* Frontend calls only BFF.
* Raw telemetry and attributes remain available for advanced/debug views.

## Structure

```txt
nms-dashboard/
├─ apps/
│  ├─ bff/
│  └─ web/
├─ deploy/
├─ docs/
└─ README.md
```

## Request Flow

```txt
Browser -> Next.js frontend -> BFF -> ThingsBoard
```

Frontend never sends ThingsBoard credentials and never calls ThingsBoard directly.

## BFF

`apps/bff` is a Go HTTP API service using `chi`.

Responsibilities:

* load environment config
* expose health endpoints
* connect to ThingsBoard using tenant API key auth
* isolate raw ThingsBoard DTOs inside `internal/thingsboard`
* normalize sites, devices, telemetry, attributes, freshness, health, and metric metadata
* expose dashboard view model at `GET /api/v1/devices/{deviceId}/dashboard`

The dashboard endpoint combines:

* device detail
* latest telemetry
* device attributes
* built-in metric catalog
* attribute catalog overrides
* freshness and basic health status

Site/asset attributes are still exposed for debug and future enrichment. Phase 3A does not scan all sites for every dashboard request.

## Frontend

`apps/web` is a Next.js frontend using TypeScript, Tailwind CSS, TanStack Query, and Recharts.

Responsibilities:

* render clean white professional NMS dashboard shell with Poppins
* load sites and devices through BFF
* use `GET /api/v1/devices/{deviceId}/dashboard` as primary selected-device view
* render health cards, grouped metric cards, charts, interface sections, and storage sections
* keep raw telemetry and raw attributes in collapsible advanced/debug panel

Routes:

* `/`: overview dashboard with site/device/health summary.
* `/sites`: site inventory.
* `/sites/{siteKey}`: selected site summary and device list.
* `/devices`: device inventory.
* `/devices/{deviceId}`: focused device dashboard.
* `/interfaces`, `/storage`, `/debug`: dedicated section scaffolds.
* `/alarms`: alarm list with severity, status, originator, and timeline.

UI rules:

* Main pages show normalized operational information first.
* Raw JSON appears only inside advanced/debug sections.
* Cards use white backgrounds, thin borders, subtle shadows, compact spacing, and calm status badges.
* Charts use simple blue/gray styling.
* Pages must not become one long debug surface.

## Metric Catalog

Dashboard metric metadata precedence:

1. `nmsMetrics` device attribute.
2. Built-in BFF catalog.
3. Interface/storage pattern fallback.
4. Generated fallback metadata.

This keeps dashboard stable when attributes are incomplete while allowing ThingsBoard to improve labels, units, groups, order, and thresholds.

Indexed interface metrics use `snmp.if.idx{index}.name`, `alias`, or `description` to display operator-friendly labels while preserving raw keys internally. Indexed storage metrics use `snmp.host.storage.idx{index}.description` for names and keep `type` as table metadata. Routing uses `route.ipv4.snapshot` and `route.ipv4.default.*` Client Attributes.

## Logical Topology

Site topology is inferred from the `topology.logical.ipv4.snapshot` asset SERVER_SCOPE attribute, containing network nodes (devices, subnets, external gateways) and edges with relationship reasons.

### BFF Classification

The BFF classifies device nodes into roles using:

1. **Name keywords** — `router`, `gateway`, `gw`, `mikrotik`, `vyos`, `cisco` → Router/Gateway
2. **Edge analysis** — devices with `default_route`, connections to external gateways, or connections to ≥2 subnets are classified as Router/Gateway
3. **Fallback** — remaining devices become Server/Endpoint

Each node carries enriched display metadata:

| Field | Purpose |
|---|---|
| `displayType` | Human-readable type label |
| `displayRole` | Normalized role identifier |
| `displayShape` | Visual shape hint for the frontend |
| `layer` | Layout layer: external → gateway → network → endpoint |

### Endpoint

`GET /api/v1/sites/{siteKey}/topology` parses the snapshot and returns normalized nodes/edges.

### Frontend Topology View

`/sites/{siteKey}/topology` renders a dedicated topology page with:

* **Vertical layered layout** — External → Gateway → Network → Endpoint (top to bottom)
* **Distinct node shapes** — hexagon for routers, rack rectangle for servers, horizontal bar for subnets, cloud path for external gateways
* **Interactive zoom/pan** — mouse wheel zoom, click-drag pan, zoom in/out/fit buttons, lock toggle
* **Minimap** — small overview with viewport indicator
* **Legend overlay** — shows node types and edge legend
* **Raw edges table** — collapsible detail table

The site detail page (`/sites/{siteKey}`) shows a summary card with a link to the full topology page.
