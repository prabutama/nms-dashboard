# NMS Dashboard

Custom NMS dashboard platform using ThingsBoard as backend source for telemetry, devices, relations, attributes, catalog data, and alarms.

Phase 3 combines ThingsBoard telemetry and attributes into normalized NMS dashboard view models and a clean multi-page operations UI.

Public multi-site demo target: three simulated sites, five simulated devices
per site, site coordinates from ThingsBoard asset attributes, and one logical
topology snapshot per site. The agent runs once in dummy mode; ThingsBoard
relations remain authoritative for site membership.

## MVP decisions

* stateless BFF
* no persistent database
* no Redis in MVP
* public read-only portfolio mode
* no frontend authentication or ThingsBoard user JWT flow
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
* `GET /api/v1/devices/{deviceId}`
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
THINGSBOARD_BASE_URL=http://host.docker.internal:8081
THINGSBOARD_API_KEY=
THINGSBOARD_SITE_ASSET_TYPE=site
CACHE_TTL_SECONDS=30
CORS_ALLOWED_ORIGINS=http://localhost:3000
PUBLIC_DEMO_MODE=true
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

With `PUBLIC_DEMO_MODE=true`, public site responses include only ThingsBoard
assets marked with `demo=true`. Site coordinates are read from asset
attributes `latitude`, `longitude`, and `region`.

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
* For production Cloudflare Tunnel, leave `NEXT_PUBLIC_API_BASE_URL` empty so requests stay same-origin.
* Do not set `NEXT_PUBLIC_API_BASE_URL` to Docker internal names such as `http://nms-bff:8080` for browser use.
* Docker Compose reads runtime values from `deploy/.env`.

## Server deployment with existing ThingsBoard stack

For servers that already run:

* `postgres`
* `tb-core`
* Cloudflare Tunnel

and expose ThingsBoard on:

* `https://nms.prabutama.my.id`

recommended split is:

* `nms.prabutama.my.id` -> ThingsBoard
* `dash.prabutama.my.id` -> NMS Dashboard

### Production-facing files

CI/CD deployment uses these files:

* `deploy/docker-compose.prod.yml` — production runtime services from Docker Hub images
* `deploy/deploy-prod.sh` — server-side deploy, health check, and rollback script
* `deploy/infisical-auth.env.example` — example server auth file for Infisical Universal Auth

### Production env guidance

`nms-bff` should talk to ThingsBoard over internal Docker networking, not through the public domain:

```env
THINGSBOARD_BASE_URL=http://tb-core:8080
```

`nms-web` should use same-origin API routing through Cloudflare Tunnel. Leave the public API base empty so browser requests use `/api/v1/...` on the current origin:

```env
NEXT_PUBLIC_API_BASE_URL=
```

### Recommended production routing

* `https://dash.prabutama.my.id/` -> `http://127.0.0.1:3001`
* `https://dash.prabutama.my.id/api/` -> `http://127.0.0.1:8080`
* ThingsBoard listens on `:8081`.
* BFF listens on `:8080`.

### Suggested rollout

1. Create DNS for `dash.prabutama.my.id`
2. Ensure TLS certificate covers `dash.prabutama.my.id`
3. Create `/opt/nms-dashboard` on the server
4. Create `/etc/nms-dashboard/infisical-auth.env` from `deploy/infisical-auth.env.example`
5. Ensure Docker, Docker Compose, and Infisical CLI are installed on the server
6. Ensure external Docker network from `NMS_DOCKER_NETWORK` exists
7. Configure Cloudflare Tunnel to route `/` to `127.0.0.1:3001` and `/api/` to `127.0.0.1:8080`
8. Let Drone copy `docker-compose.prod.yml` and `deploy-prod.sh`, then run production deploy
9. Validate public read-only dashboard, sites, devices, alarms, and reports
* `THINGSBOARD_API_KEY` stays runtime-only and is not baked into images.

### Infisical runtime secrets

Drone reads deploy/build values from Infisical `/ci`:

```env
DOCKERHUB_NAMESPACE=
DOCKERHUB_USERNAME=
DOCKERHUB_WRITE_TOKEN=
DEPLOY_HOST=
DEPLOY_PORT=22
DEPLOY_USER=
DEPLOY_SSH_PRIVATE_KEY=
DEPLOY_KNOWN_HOSTS=
```

Production runtime values live in Infisical `/runtime`:

```env
DOCKERHUB_USERNAME=
DOCKERHUB_READ_TOKEN=
DOCKERHUB_NAMESPACE=
NMS_DOCKER_NETWORK=
THINGSBOARD_BASE_URL=http://tb-core:8080
THINGSBOARD_API_KEY=
THINGSBOARD_SITE_ASSET_TYPE=site
CACHE_TTL_SECONDS=30
CORS_ALLOWED_ORIGINS=https://dash.prabutama.my.id
```

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
* Raw attribute endpoints are not exposed in public portfolio mode.
* `GET /api/v1/devices/{deviceId}` returns basic normalized device identity.
* `GET /api/v1/devices/{deviceId}/telemetry/latest` returns latest telemetry as key-value rows.
* `GET /api/v1/devices/{deviceId}/summary` combines identity and latest telemetry into a compact NMS summary.
* `GET /api/v1/devices/{deviceId}/dashboard` combines device detail, latest telemetry, device attributes, freshness, health, and metric catalog metadata into a stable NMS view model.
* Dashboard metric metadata comes from `nmsMetrics` attributes first, built-in BFF catalog second, and generated fallback labels last.
* Indexed interface telemetry such as `snmp.if.idx2.rx_bps` uses attributes such as `snmp.if.idx2.name = eth0` to display `eth0 RX Throughput`.
* Indexed storage telemetry such as `snmp.host.storage.idx36.used_pct` uses storage description attributes to display labels such as `/ Storage Usage`; storage type is shown in the storage table.
* Routing Client Attributes such as `route.ipv4.snapshot` and `route.ipv4.default.*` are normalized into a route summary and route table.
* Raw telemetry and raw attributes are hidden from public frontend views; BFF may still use ThingsBoard attributes internally for normalization.
* `GET /api/v1/alarms` returns tenant-wide alarms from ThingsBoard, normalized with severity, status, originator metadata, and pagination. Stable empty response when ThingsBoard is not configured or unreachable.
* Overview dashboard and /alarms page use tenant alarm data for active alarm counts, critical severity tracking, and recent alarm tables.
* Response never exposes ThingsBoard token.
