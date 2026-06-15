# NMS Dashboard Platform Agent Instructions

This project builds a custom NMS dashboard platform using ThingsBoard as the telemetry, device, relation, attribute, catalog, and alarm backend.

## Current MVP Decision

The MVP uses a stateless BFF.

There is no persistent BFF database for now.

ThingsBoard remains the source of truth for:

* devices
* assets/sites
* relations
* telemetry
* attributes
* catalog data
* alarms

The BFF does not store raw telemetry and does not maintain its own persistent application database in the MVP.

## Architecture

* `apps/bff`: Go BFF API service.
* `apps/web`: Next.js custom dashboard frontend.
* `deploy`: Docker Compose deployment files.
* `docs`: architecture, API contract, and development notes.

## Main Responsibilities

### BFF

The BFF reads ThingsBoard REST API and normalizes ThingsBoard data into NMS-friendly API responses.

The BFF is responsible for:

* reading ThingsBoard REST API
* hiding ThingsBoard credentials from the frontend
* normalizing telemetry, attributes, relations, catalogs, and alarms
* exposing simplified NMS API endpoints
* optional in-memory caching for MVP
* providing consistent response shapes for the frontend

The BFF must not:

* collect SNMP/ICMP data
* store raw telemetry permanently
* implement persistent database storage in MVP
* implement custom RBAC in MVP
* expose ThingsBoard API keys to the frontend

### Frontend

The frontend is responsible for:

* rendering the custom NMS dashboard UI
* calling only the BFF API
* displaying site overview
* displaying device list
* displaying device detail
* displaying charts, tables, and topology views
* polling/refetching data from the BFF

The frontend must never call ThingsBoard directly.

### ThingsBoard

ThingsBoard remains the backend for:

* telemetry storage
* latest telemetry
* historical timeseries
* device registry
* asset/site relations
* attributes/catalog
* alarms

## MVP Scope

Phase 1 focuses only on project skeleton:

* Go BFF skeleton
* Next.js frontend skeleton
* Docker Compose
* documentation

No ThingsBoard integration yet in Phase 1.

## Future Scope

Future phases may add:

* ThingsBoard REST client
* normalized site/device APIs
* device summary API
* interface normalization
* storage normalization
* route normalization
* alarm normalization
* Redis cache
* authentication
* persistent database
* custom RBAC
* audit logs
* dashboard preferences

## Suggested Project Structure

```txt
nms-dashboard-platform/
├─ apps/
│  ├─ bff/
│  └─ web/
├─ deploy/
├─ docs/
└─ README.md
```

## Environment Variables

BFF environment variables:

* `PORT`
* `THINGSBOARD_BASE_URL`
* `THINGSBOARD_API_KEY`
* `CACHE_TTL_SECONDS`

No `DATABASE_URL` is required for MVP.

Frontend environment variables:

* `NEXT_PUBLIC_API_BASE_URL`

## Validation

After each change, run relevant validation.

For BFF:

```bash
gofmt
go test ./...
go build ./...
```

For frontend:

```bash
npm run build
npm run lint
```

For Docker:

```bash
docker compose -f deploy/docker-compose.yml config
```

## Documentation Rules

Every implementation phase must update:

* `docs/ARCHITECTURE.md`
* `docs/API_CONTRACT.md`
* `docs/DEVELOPMENT_STAGES.md`
* `README.md`

Do not mark a phase as complete unless validation succeeds.
