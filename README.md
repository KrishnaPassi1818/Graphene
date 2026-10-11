# RouteCraft — Courier Delivery Route Optimizer

A deployable DAA project for planning last-mile courier routes. RouteCraft compares exact, greedy, approximation, local-search, and CVRP algorithms using a deterministic demo dataset, operation counters, traces, and reproducible benchmarks.

> **Project status:** The phase-based MVP is built and tested, with deployment files supplied. Docker/Postgres/Redis were not smoke-tested in this sandbox; see [`docs/PHASES.md`](docs/PHASES.md) for precise scope and [`plan.md`](plan.md) for the complete source plan.

## Quick start

Requirements: Node.js 20.19+ (Vite 8), npm 10+. Docker is optional for the local demo.

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:4000>; `GET /api/health` checks service status. In demo mode the sample instance loads automatically. Demo sign-in credentials (when the login page is used):

- Email: `dispatcher@routecraft.local`
- Password: `RouteDemo!2026`

These are development-only seed values. Do not use them in a public deployment.

## Full local stack

```bash
cp .env.example .env
docker compose up --build
```

Open <http://localhost:8080>. Compose starts PostgreSQL, Redis, the API and an Nginx-served frontend. Database schema and deterministic demo data are initialized by the API on startup.

## Main capabilities

- Depot and stop editing, CSV import, fleet capacity controls, and Haversine distance calculations.
- Dijkstra, A*, Bellman–Ford, Floyd–Warshall; brute force, branch-and-bound, Held–Karp, nearest neighbor, MST 2-approximation; 2-opt, Or-opt, simulated annealing; Sweep, K-means, and Clarke–Wright savings.
- Capacity validation, optional time-window checks, route-level metrics, per-algorithm traces and operation counts.
- Background optimization in a worker thread, result caching, comparison runs, benchmark samples, run history and CSV export.
- Optional JWT login, refresh-cookie rotation, role middleware, Postgres persistence and Redis cache.

## Repository map

```text
apps/api/                  Express API, storage, auth, cache, workers
apps/web/                  React/Vite dashboard and SVG route renderer
packages/algorithms/        Pure algorithm implementations and tests
packages/contracts/         Shared Zod request/response schemas
migrations/                  Postgres schema (also applied by the API at startup)
docs/                       Architecture, algorithms, DAA notes, deployment guide
```

## Useful commands

```bash
npm run dev       # API + web dev servers
npm test          # unit and API integration tests
npm run lint      # JavaScript syntax check
npm run build     # production web build
npm audit        # dependency vulnerability audit
```

## Configuration and API keys

Start from `.env.example`. The local demo needs no API key: coordinates are fictional, distances use Haversine, and the map is drawn as an offline SVG schematic. Slots are provided for map tiles, OSRM routing, geocoding, Postgres, Redis, and JWT secrets. Never commit real credentials or expose private keys via `VITE_*` variables.

For public deployment, set `NODE_ENV=production`, `DEMO_MODE=false`, a unique 32+ character `JWT_SECRET`, `COOKIE_SECURE=true`, an exact HTTPS `WEB_ORIGIN`, a restricted durable `DATABASE_URL`, and `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the first administrator. Production startup rejects the sample JWT/database secrets, demo mode, insecure cookies/origins, missing PostgreSQL, or an installation without an admin. Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation

- [Tech stack and architecture](docs/ARCHITECTURE.md)
- [Algorithms, complexity, and correctness notes](docs/ALGORITHMS.md)
- [DAA report / viva notes](docs/DAA-REPORT.md)
- [Deployment checklist](docs/DEPLOYMENT.md)
- [Original plan](plan.md)
