# Tech stack and architecture

## Technology choices

| Layer | Technology | Purpose |
|---|---|---|
| Web build | Vite 8 | Fast development server and production bundler (Node 20.19+ required) |
| UI | React 18, React Router 7 | Planner, algorithms, benchmark and history views |
| UI state | Zustand + TanStack Query | Local planner state and server-data lifecycle |
| HTTP | Axios | Same-origin API calls, bearer token and refresh handling |
| Charts/icons | Recharts + Lucide React | Benchmark and comparison visuals; consistent UI iconography |
| Styling | Responsive custom CSS | Design tokens, grid layout and compact operational dashboard |
| Route map | Inline SVG | Offline schematic visualization from coordinates; works in restricted previews |
| API | Node 20 + Express 4 | REST API, validation, security middleware and static health endpoints |
| Contracts | Zod | Shared input constraints at the API boundary |
| Algorithms | Plain JavaScript ES modules | Pure, deterministic solvers with no database/network imports |
| Persistence | PostgreSQL (`pg`) | Optional durable users, fleet, stops, optimization runs and refresh tokens |
| Cache | Redis (`ioredis`) | Optional result cache and JWT revocation support |
| Auth | JWT + bcryptjs + httpOnly refresh cookie | Short-lived access tokens and password hashing |
| Compute | Node `worker_threads` | Keep expensive optimization away from the HTTP event loop |
| Logging/security | pino-http, Helmet, CORS, express-rate-limit | Structured request logs, headers, origin policy and abuse limits |
| Tests | Vitest + Supertest | Algorithm unit tests and API integration tests |
| Packaging | Docker Compose + Nginx | Repeatable four-service deployment and same-origin `/api` proxy |

## Request flow

1. The planner sends stops, depot, capacity, fleet size, selected algorithm, and optional trace request to `POST /api/optimizations`.
2. Zod validates the request. The service hashes normalized input and checks in-memory/Redis cache.
3. A worker thread builds a Haversine matrix and calls the pure `@courier/algorithms` package.
4. The algorithm returns depot-rooted routes, distance/load/time-window checks, operation counts, runtime and optional `TraceStep[]`.
5. The API persists the run when PostgreSQL is configured, then returns the completed job to the UI through `/api/optimizations/:id` polling.
6. The React client renders the result as SVG route lines, stop sequence, capacity meters and an explainer/trace panel.

## Boundaries

- `packages/algorithms` does not import Express, `pg`, Redis, or browser UI modules.
- `packages/contracts` owns shared Zod schemas and API names.
- API persistence/cache adapters are optional. In-memory demo mode uses the exact same API shape.
- API secrets stay on the server. `MAPTILER_API_KEY`, `OSRM_API_KEY`, and `GEOCODING_API_KEY` are placeholders only; the default Haversine mode does not need them.
- Access tokens stay in browser module memory; the refresh token is an httpOnly cookie. RBAC and the `driver` role field are present, but vehicle-to-driver assignment and the driver route screen are not part of this MVP.

## API overview

- `GET /api/health`, `/api/algorithms`, `/api/planner`, `/api/runs`
- `POST /api/auth/signup|login|refresh|logout`
- `POST /api/optimizations`, `GET /api/optimizations/:id`
- `POST /api/compare`, `POST /api/benchmarks/run`, `GET /api/benchmarks`
- `GET|POST /api/stops`, `PATCH|DELETE /api/stops/:id`, `POST /api/stops/import`
- `GET|PUT /api/fleet`

The interactive OpenAPI JSON is served at `/api/openapi.json`; Swagger UI is at `/api/docs`.
