# Architecture

## Phase 1 scope

Phase 1 builds project skeleton only.

Current MVP rules:

* BFF stays stateless.
* No persistent database.
* No Redis.
* No authentication.
* No custom RBAC.
* No ThingsBoard REST integration yet.
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

Responsibilities in Phase 1:

* boot HTTP server
* load environment config
* expose `/health`
* expose `/api/v1/health`
* provide structured logs

Deferred to later phases:

* ThingsBoard client
* normalization logic
* cache beyond in-memory placeholder config
* auth and authorization

### `apps/web`

Next.js frontend using TypeScript, Tailwind CSS, minimal shadcn-style UI primitives, and TanStack Query.

Responsibilities in Phase 1:

* render dashboard landing page
* define dashboard shell
* read `NEXT_PUBLIC_API_BASE_URL`
* optionally call BFF health endpoint

### `deploy`

Docker Compose for local multi-service startup.

Services:

* `nms-bff`
* `nms-web`

## Request flow

```txt
Browser -> Next.js frontend -> BFF -> ThingsBoard
```

In Phase 1, flow stops at BFF health endpoint. No ThingsBoard traffic yet.
