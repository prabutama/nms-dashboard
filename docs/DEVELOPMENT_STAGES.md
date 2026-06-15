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

## Phase 2: First ThingsBoard integration

Status: complete after validation.

Delivered:

* ThingsBoard REST client in BFF
* integration status endpoint
* normalized site list endpoint
* normalized site device list endpoint
* frontend site list placeholder
* environment examples and updated docs

Implemented in Phase 2:

* `GET /api/v1/integrations/thingsboard/status`
* `GET /api/v1/sites`
* `GET /api/v1/sites/{siteKey}/devices`
* BFF config support for `THINGSBOARD_SITE_ASSET_TYPE`
* initial asset and relation normalization

Not included in Phase 2:

* telemetry history
* alarm normalization
* charts
* authentication
* persistent storage

## Planned later phases

### Phase 3

* device summary endpoints
* richer dashboard detail screens

### Phase 4

* telemetry and alarms normalization
* richer frontend screens

### Phase 5+

* cache improvements
* authentication
* user preferences
