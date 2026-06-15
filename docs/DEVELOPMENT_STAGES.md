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

## Planned later phases

### Phase 2

* ThingsBoard REST client setup
* normalized BFF service boundaries

### Phase 3

* site and device list APIs
* dashboard summary endpoints

### Phase 4

* telemetry and alarms normalization
* richer frontend screens

### Phase 5+

* cache improvements
* authentication
* user preferences
