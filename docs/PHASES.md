# Build phases and delivery status

This implementation follows the attached `plan.md` and keeps the DAA algorithm core independent from HTTP and persistence. The build focuses on a runnable, testable MVP across every major phase; the notes below distinguish the completed paths from planned integrations that need real infrastructure or additional UI.

| Phase | Scope delivered | Status |
|---|---|---|
| 0 — Foundation | npm workspaces, shared Zod contracts, env template, OpenAPI, conventions | Built |
| 1 — Algorithm core | Manual heap/DSU/graph, four shortest-path algorithms, exact/heuristic TSP, CVRP heuristics, route/time-window validation and fixed-seed data | Built; covered by unit tests |
| 2 — API and data | Express API, signup/login/refresh/logout, dispatcher/admin checks, stop/fleet endpoints, worker-thread optimization, cache, run/benchmark storage, optional Postgres/Redis | Built; in-memory demo is the zero-service path |
| 3 — Planner UI | React dashboard, stop add/remove/CSV import, fleet controls, offline SVG map, route results, algorithm comparison and run history | Built |
| 4 — Learning and analysis | Generic trace player, complexity/explainer catalog, comparison metrics, reproducible benchmark runner and CSV export | Built in compact form; per-family graph/DP animation renderers are a follow-up |
| 5 — Release hardening | Dockerfiles/Compose, SQL schema/migration, health checks, docs, tests, deployment checklist | Source delivered; Compose/Postgres/Redis were not executable in this sandbox because Docker is not installed |

## Scope notes and deliberate boundaries

- The sample data is deterministic and fictional, centered near Ludhiana only to make the map familiar; it is not a real customer/address dataset.
- The route map is an inline SVG schematic rather than Leaflet tiles. This makes the demo independent of network access and map keys; a provider slot is ready for a later road-map adapter.
- Haversine distances are the default. OSRM/geocoding/API-key slots are placeholders and are not called by the core.
- Optimization CPU work uses Node `worker_threads`; BullMQ is not required by the demo and is not wired in this MVP.
- PostgreSQL and Redis adapters, schema and Compose topology are included, but cloud connection/TLS behavior must be verified against the target provider.
- Driver identity/route assignment UI, full depot/vehicle CRUD screens, and family-specific trace renderers remain sensible next increments. The current planner covers stop editing, fleet sizing/capacity, optimization, comparison, and benchmarks.
- `DEMO_MODE=true` permits the deterministic no-login local flow. Set it to `false` before exposing any instance publicly; provide `ADMIN_EMAIL`/`ADMIN_PASSWORD` to seed an initial admin in configured storage.

## Latest sandbox verification (2026-10-11)

- `npm test`: **19/19 passed** (8 API, 11 algorithm).
- `npm run lint`: syntax check passed for **53 JavaScript files**.
- `npm run build`: Vite production build passed; route/benchmark pages are split into lazy chunks.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- Manual dev-stack checks: Vite, API health, login, planner, Swagger UI and API comparison returned HTTP 200; both comparison results validated.
- Production startup configuration checks pass for valid HTTPS/DB/secret inputs and fail closed with missing/demo values.
- Docker, `psql`, and `redis-server` are not installed in the sandbox. The Compose/PostgreSQL/Redis paths and target-provider TLS settings remain unverified.

## Verification commands

```bash
npm test
npm run lint
npm run build
npm audit --audit-level=high
```
