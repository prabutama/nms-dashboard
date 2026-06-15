# Architecture

## Phase 2 scope

Phase 2 adds first read-only ThingsBoard REST integration.

Current MVP rules:

* BFF stays stateless.
* No persistent database.
* No Redis.
* No authentication.
* No custom RBAC.
* No persistent BFF database.
* Frontend never calls ThingsBoard directly.

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

## Components

### `apps/bff`

Go HTTP API service using `chi`.

Responsibilities in Phase 2:

* boot HTTP server
* load environment config
* expose `/health`
* expose `/api/v1/health`
* expose ThingsBoard integration status
* expose normalized site list endpoint
* expose normalized site device list endpoint
* provide structured logs

Added in Phase 2:

* ThingsBoard client
* ThingsBoard-specific DTO isolation inside client package
* simple normalization for sites and site devices

Deferred to later phases:

* cache beyond in-memory placeholder config
* auth and authorization

### `apps/web`

Next.js frontend using TypeScript, Tailwind CSS, minimal shadcn-style UI primitives, and TanStack Query.

Responsibilities in Phase 2:

* render dashboard landing page
* define dashboard shell
* read `NEXT_PUBLIC_API_BASE_URL`
* call BFF health endpoint
* call BFF site list endpoint

### `deploy`

Docker Compose for local multi-service startup.

Services:

* `nms-bff`
* `nms-web`

## Request flow

```txt
Browser -> Next.js frontend -> BFF -> ThingsBoard
```

In Phase 2, BFF performs read-only ThingsBoard REST requests for site and device inventory.
