# NMS Dashboard

Custom NMS dashboard platform using ThingsBoard as backend source for telemetry, devices, relations, attributes, catalog data, and alarms.

Phase 3 combines ThingsBoard telemetry and attributes into normalized NMS dashboard view models and a clean multi-page operations UI.

## MVP decisions

* stateless BFF
* no persistent database
* no Redis in MVP
* authentication via ThingsBoard user JWT is in rollout
* authority-based access follows ThingsBoard roles (`TENANT_ADMIN`, `CUSTOMER_USER`)
* frontend never calls ThingsBoard directly

## Project structure

```txt
apps/
  bff/   Go BFF API service
  web/   Next.js frontend
deploy/  Docker Compose files
docs/    Architecture and API docs
```

## Services

### BFF

Stack:

* Go
* `chi`
* environment-based config
* `log/slog` structured logging

Dashboard endpoints:

* `GET /health`
* `GET /api/v1/health`
* `GET /api/v1/integrations/thingsboard/status`
* `GET /api/v1/sites`
* `GET /api/v1/sites/{siteKey}/devices`
* `GET /api/v1/assets/{assetId}/attributes`
* `GET /api/v1/devices/{deviceId}`
* `GET /api/v1/devices/{deviceId}/attributes`
* `GET /api/v1/devices/{deviceId}/telemetry/latest`
* `GET /api/v1/devices/{deviceId}/telemetry/history`
* `GET /api/v1/devices/{deviceId}/summary`
* `GET /api/v1/devices/{deviceId}/dashboard`
* `GET /api/v1/alarms`
* `GET /api/v1/sites/{siteKey}/topology` — logical topology from `topology.logical.ipv4.snapshot` with enriched node classification

### Frontend

Stack:

* Next.js
* TypeScript
* Tailwind CSS
* Poppins font
* shadcn-style UI primitives
* TanStack Query
* Recharts

Frontend stays pointed at local BFF only. It does not call ThingsBoard directly.

Frontend routes:

* `/`: overview dashboard
* `/sites`: monitored site inventory
* `/sites/{siteKey}`: site detail, device list, and link to topology
* `/sites/{siteKey}/topology`: interactive logical topology with zoom/pan, minimap, and legend
* `/devices`: device inventory
* `/devices/{deviceId}`: focused device dashboard
* `/interfaces`, `/storage`, `/debug`: section scaffolds for later endpoints
* `/alarms`: alarm list with severity, status, originator, and timeline

UI theme:

* white base
* professional blue primary color
* soft slate/gray backgrounds
* subtle status badges
* soft borders and shadows
* no neon, glow, cyberpunk, or debug-first layout

## Environment variables

### `apps/bff`

```env
PORT=8080
THINGSBOARD_BASE_URL=
THINGSBOARD_API_KEY=
THINGSBOARD_SITE_ASSET_TYPE=site
CACHE_TTL_SECONDS=30
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### `apps/web`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Local development

### Run BFF

```bash
cd apps/bff
go run .
```

Copy env example first:

```bash
cp .env.example .env
```

`apps/bff` loads `.env` in local development as convenience only. Existing real environment variables still override file values.

### Run frontend

```bash
cd apps/web
npm install
npm run dev
```

Copy env example first:

```bash
cp .env.example .env.local
```

## Validation

### BFF

```bash
cd apps/bff
gofmt -w .
go test ./...
go build ./...
go run .
```

### Frontend

```bash
cd apps/web
npm run lint
npm run build
```

### Docker Compose

```bash
docker compose -f deploy/docker-compose.yml config
```

## Docker Compose

```bash
cd deploy
cp .env.example .env
```

Fill `.env` with your real ThingsBoard values, then run:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Frontend: `http://localhost:3000`

BFF: `http://localhost:8080`

## Container notes

* `NEXT_PUBLIC_API_BASE_URL` must be browser-visible. For local Docker Compose keep `http://localhost:8080`.
* Do not set `NEXT_PUBLIC_API_BASE_URL` to Docker internal names such as `http://nms-bff:8080` for browser use.
* Docker Compose reads runtime values from `deploy/.env`.

## Server deployment with existing ThingsBoard stack

For servers that already run:

* `postgres`
* `tb-core`
* `nginx`

and expose ThingsBoard on:

* `https://nms.prabutama.my.id`

recommended split is:

* `nms.prabutama.my.id` -> ThingsBoard
* `dash.prabutama.my.id` -> NMS Dashboard

### Production-facing files

Use these templates:

* `deploy/docker-compose.server-example.yml`
* `deploy/server.env.example`
* `deploy/nginx/dashboard.conf.example`

### Production env guidance

`nms-bff` should talk to ThingsBoard over internal Docker networking, not through the public domain:

```env
THINGSBOARD_BASE_URL=http://tb-core:8080
```

`nms-web` should use same-origin API routing through nginx:

```env
NEXT_PUBLIC_API_BASE_URL=/api
```

### Recommended production routing

* `https://dash.prabutama.my.id/` -> `nms-web:3000`
* `https://dash.prabutama.my.id/api/` -> `nms-bff:8080`

### Suggested rollout

1. Create DNS for `dash.prabutama.my.id`
2. Ensure TLS certificate covers `dash.prabutama.my.id`
3. Copy `deploy/server.env.example` to your server-side env file and fill secrets
4. Add `deploy/nginx/dashboard.conf.example` as a real nginx vhost
5. Deploy `nms-bff` and `nms-web` with `deploy/docker-compose.server-example.yml`
6. Validate dashboard login, sites, devices, alarms, and customer scoping
* `THINGSBOARD_API_KEY` stays runtime-only and is not baked into images.

### Example `deploy/.env`

```env
PORT=8080
THINGSBOARD_BASE_URL=https://your-thingsboard-domain
THINGSBOARD_API_KEY=your-thingsboard-token
THINGSBOARD_SITE_ASSET_TYPE=site
CACHE_TTL_SECONDS=30
CORS_ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Phase 3 behavior

* BFF sends `THINGSBOARD_API_KEY` to ThingsBoard only as `X-Authorization: ApiKey <value>`.
* Frontend calls only local BFF.
* BFF validates whether ThingsBoard config exists.
* BFF performs lightweight ThingsBoard reachability check through `/api/v1/integrations/thingsboard/status`.
* `GET /api/v1/sites` never returns `404`. It returns real sites when available, otherwise stable placeholder JSON.
* `GET /api/v1/sites/{siteKey}/devices` resolves site relations and returns related ThingsBoard devices.
* Attribute endpoints return raw ThingsBoard attributes for site assets and devices.
* `GET /api/v1/devices/{deviceId}` returns basic normalized device identity.
* `GET /api/v1/devices/{deviceId}/telemetry/latest` returns latest telemetry as key-value rows.
* `GET /api/v1/devices/{deviceId}/summary` combines identity and latest telemetry into a compact NMS summary.
* `GET /api/v1/devices/{deviceId}/dashboard` combines device detail, latest telemetry, device attributes, freshness, health, and metric catalog metadata into a stable NMS view model.
* Dashboard metric metadata comes from `nmsMetrics` attributes first, built-in BFF catalog second, and generated fallback labels last.
* Indexed interface telemetry such as `snmp.if.idx2.rx_bps` uses attributes such as `snmp.if.idx2.name = eth0` to display `eth0 RX Throughput`.
* Indexed storage telemetry such as `snmp.host.storage.idx36.used_pct` uses storage description attributes to display labels such as `/ Storage Usage`; storage type is shown in the storage table.
* Routing Client Attributes such as `route.ipv4.snapshot` and `route.ipv4.default.*` are normalized into a route summary and route table.
* Raw telemetry and raw attributes remain available, but frontend shows them only under advanced/debug panels.
* `GET /api/v1/alarms` returns tenant-wide alarms from ThingsBoard, normalized with severity, status, originator metadata, and pagination. Stable empty response when ThingsBoard is not configured or unreachable.
* Overview dashboard and /alarms page use tenant alarm data for active alarm counts, critical severity tracking, and recent alarm tables.
* Response never exposes ThingsBoard token.
