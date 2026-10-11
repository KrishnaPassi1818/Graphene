CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'dispatcher' CHECK (role IN ('admin', 'dispatcher', 'driver')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  depot_id TEXT REFERENCES depots(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  capacity DOUBLE PRECISION NOT NULL CHECK (capacity > 0),
  driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  demand DOUBLE PRECISION NOT NULL CHECK (demand > 0),
  time_window JSONB,
  service_minutes DOUBLE PRECISION NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS optimization_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  algorithm TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_hash TEXT NOT NULL,
  total_distance DOUBLE PRECISION NOT NULL,
  runtime_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  op_count BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES optimization_runs(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  distance DOUBLE PRECISION NOT NULL,
  load DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS route_stops (
  id BIGSERIAL PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  arrival_time DOUBLE PRECISION,
  UNIQUE (route_id, seq)
);

CREATE TABLE IF NOT EXISTS benchmark_results (
  id BIGSERIAL PRIMARY KEY,
  run_batch TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  n_stops INTEGER NOT NULL,
  seed INTEGER NOT NULL DEFAULT 42,
  runtime_ms DOUBLE PRECISION NOT NULL,
  cost DOUBLE PRECISION NOT NULL,
  optimal_cost DOUBLE PRECISION,
  gap_pct DOUBLE PRECISION,
  operations BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_stops_owner ON stops(owner_id);
CREATE INDEX IF NOT EXISTS idx_runs_owner_created ON optimization_runs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_input_hash ON optimization_runs(input_hash);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON route_stops(route_id, seq);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_tokens(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_benchmarks_batch ON benchmark_results(run_batch, n_stops);
