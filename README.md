# NMS Dashboard

Custom NMS dashboard platform using ThingsBoard as backend source for telemetry, devices, relations, attributes, catalog data, and alarms.

Phase 2 adds first read-only ThingsBoard integration through BFF.

## MVP decisions

* stateless BFF
* no persistent database
* no Redis in MVP
* no authentication yet
* no custom RBAC yet
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

Phase 2 endpoints:

* `GET /health`
* `GET /api/v1/health`
* `GET /api/v1/integrations/thingsboard/status`
* `GET /api/v1/sites`
* `GET /api/v1/sites/{siteKey}/devices`

### Frontend

Stack:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn-style UI primitives
* TanStack Query

Phase 2 frontend includes dashboard landing page, BFF health status panel, and site list loaded from BFF.

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
docker compose -f deploy/docker-compose.yml up --build
```

Frontend: `http://localhost:3000`

BFF: `http://localhost:8080`

## Phase 2 behavior

* BFF sends `THINGSBOARD_API_KEY` to ThingsBoard only.
* frontend reads sites only from BFF.
* site list derives `siteKey` from asset attribute `siteKey` when present, else slug from asset name.
