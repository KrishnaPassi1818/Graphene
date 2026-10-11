# Deployment and operations

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

`apps/api` reads `.env`; Vite proxies `/api` to port 4000. The UI is at `http://localhost:5173`. Without `DATABASE_URL` or `REDIS_URL`, the app starts against deterministic in-memory demo storage.

## Docker Compose

```bash
cp .env.example .env
# Replace JWT_SECRET before sharing the environment.
docker compose up --build
```

Open `http://localhost:8080`. Nginx serves the built React app and forwards `/api` to the API container. PostgreSQL and Redis have health checks; the API applies the SQL schema and seeds demo data at boot. The checked-in `.env.example` intentionally selects a local development/demo profile with sample credentials; do not expose it publicly. For production, set `NODE_ENV=production` and meet the hard startup checks below. The local Compose PostgreSQL account/password are demo-only; use a restricted managed-DB role for real deployments.

## Production checklist

1. Use managed PostgreSQL and Redis or a hardened private network; back up Postgres and verify restore procedures.
2. Set `NODE_ENV=production`, `DEMO_MODE=false`, a unique 32+ character `JWT_SECRET`, `COOKIE_SECURE=true`, an exact HTTPS browser origin (`WEB_ORIGIN`, or `WEB_ORIGIN_DOCKER` for Compose's Nginx origin), and a durable `DATABASE_URL` with a restricted role (set `PG_SSL=true` when required by the provider). The API startup guard refuses known demo secrets, demo mode, insecure cookies/origins, missing PostgreSQL, and the sample database password.
3. Provision `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) before first startup if an admin account is required. Public signup is disabled by default in production; explicitly set `ALLOW_SIGNUP=true` only if open registration is intended.
4. Remove/change demo credentials and use a non-superuser database role.
5. Store `.env` values in the host's secret manager. Never commit `.env`; never put a private credential in a `VITE_*` variable.
6. Set HTTPS at the reverse proxy/load balancer, configure secure cookies, and limit API ingress to the web origin.
7. Build and smoke-test: `npm test && npm run lint && npm run build`.
8. Before handling real customer data, add alerting, structured log retention, rate-limit review, controlled database migrations, and a managed queue if workload requires it.

## Provider/API key slots

`.env.example` contains `MAP_TILE_URL`, `MAPTILER_API_KEY`, `OSRM_BASE_URL`, `OSRM_API_KEY`, and `GEOCODING_API_KEY`. They are intentionally unused by default. Integrate them server-side when real roads or geocoding are needed. The DAA solver itself remains independent of any external routing service.

## Health and diagnostics

- `/api/health` reports API, Postgres and Redis state (unconfigured services are marked `disabled`, not failures).
- `/api/docs` provides Swagger UI.
- API requests are logged as JSON by `pino-http`.
- Worker jobs have a timeout; exact solvers have conservative stop-count limits.
