# NMS Dashboard

Custom NMS dashboard platform using ThingsBoard as backend source for telemetry, devices, relations, attributes, catalog data, and alarms.

Phase 1 builds skeleton only.

## MVP decisions

* stateless BFF
* no persistent database
* no Redis in Phase 1
* no authentication in Phase 1
* no custom RBAC in Phase 1
* no ThingsBoard integration in Phase 1
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

Phase 1 endpoints:

* `GET /health`
* `GET /api/v1/health`

### Frontend

Stack:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn-style UI primitives
* TanStack Query

Phase 1 frontend includes dashboard landing page and BFF health status panel.

## Environment variables

### `apps/bff`

```env
PORT=8080
THINGSBOARD_BASE_URL=
THINGSBOARD_API_KEY=
CACHE_TTL_SECONDS=30
```

### `apps/web`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Local development

### Run BFF

```bash
cd apps/bff
go run ./cmd/api
```

### Run frontend

```bash
cd apps/web
npm install
npm run dev
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
