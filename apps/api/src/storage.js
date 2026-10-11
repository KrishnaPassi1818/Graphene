import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { DEMO_INSTANCE, getDemoInstance } from "@courier/algorithms";
import { getPool } from "./db/index.js";

const DEMO_USER_ID = "demo-user";
const memory = {
  users: new Map(),
  planners: new Map(),
  runs: [],
  refreshTokens: new Map(),
  benchmarks: [],
};
let initialized = false;
let demoUserId = DEMO_USER_ID;

export async function initializeStorage() {
  if (initialized) return;
  const pool = getPool();
  const demoMode = process.env.DEMO_MODE !== "false";
  if (pool && demoMode) {
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || "RouteDemo!2026", 12);
    await pool.query(
      `INSERT INTO users(id, name, email, password_hash, role) VALUES($1,$2,$3,$4,'dispatcher')
       ON CONFLICT (email) DO NOTHING`,
      [DEMO_USER_ID, "RouteCraft Demo Dispatcher", process.env.DEMO_EMAIL || "dispatcher@routecraft.local", passwordHash],
    );
    const demoUser = await pool.query("SELECT id FROM users WHERE email=$1", [process.env.DEMO_EMAIL || "dispatcher@routecraft.local"]);
    demoUserId = demoUser.rows[0]?.id ?? DEMO_USER_ID;
    await seedPlannerForDatabase(demoUserId);
  } else if (demoMode) {
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || "RouteDemo!2026", 12);
    const user = { id: DEMO_USER_ID, name: "RouteCraft Demo Dispatcher", email: process.env.DEMO_EMAIL || "dispatcher@routecraft.local", passwordHash, role: "dispatcher", createdAt: new Date().toISOString() };
    memory.users.set(user.id, user);
    memory.planners.set(user.id, buildDemoPlanner());
    demoUserId = user.id;
  }
  await seedBootstrapAdmin();
  if (process.env.NODE_ENV === "production") await assertProductionAdminExists();
  initialized = true;
}

async function assertProductionAdminExists() {
  const pool = getPool();
  const result = pool
    ? await pool.query("SELECT 1 FROM users WHERE role='admin' LIMIT 1")
    : { rows: [...memory.users.values()].filter((user) => user.role === "admin").slice(0, 1) };
  if (!result.rows.length) throw new Error("No administrator exists. Set ADMIN_EMAIL and ADMIN_PASSWORD for the initial production startup.");
}

async function seedBootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 12) throw new Error("Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters, or leave both unset.");
  if (process.env.DEMO_MODE !== "false" && email === (process.env.DEMO_EMAIL || "dispatcher@routecraft.local").toLowerCase()) throw new Error("ADMIN_EMAIL must differ from DEMO_EMAIL while demo mode is enabled.");
  const pool = getPool();
  if (pool) {
    const existing = await pool.query("SELECT id,role FROM users WHERE lower(email)=lower($1)", [email]);
    if (existing.rows[0]) {
      if (existing.rows[0].role !== "admin") throw new Error("ADMIN_EMAIL already belongs to a non-admin user; promote it through a controlled database migration.");
      return;
    }
    const id = `admin-${randomUUID()}`;
    const hash = await bcrypt.hash(password, 12);
    await pool.query("INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'admin')", [id, "RouteCraft Administrator", email, hash]);
    await createEmptyPlanner(id);
    return;
  }
  const existing = [...memory.users.values()].find((user) => user.email.toLowerCase() === email);
  if (existing) {
    if (existing.role !== "admin") throw new Error("ADMIN_EMAIL already belongs to a non-admin user.");
    return;
  }
  const id = `admin-${randomUUID()}`;
  const hash = await bcrypt.hash(password, 12);
  memory.users.set(id, { id, name: "RouteCraft Administrator", email, passwordHash: hash, role: "admin", createdAt: new Date().toISOString() });
  memory.planners.set(id, createEmptyPlannerValue());
}

function buildDemoPlanner() {
  const instance = getDemoInstance();
  return {
    depot: instance.depot,
    stops: instance.stops,
    fleet: { vehicles: instance.fleet.vehicles, capacity: instance.fleet.capacity, averageSpeedKmh: instance.fleet.averageSpeedKmh },
  };
}

async function seedPlannerForDatabase(ownerId) {
  const pool = getPool();
  const currentDepot = await pool.query("SELECT id FROM depots WHERE owner_id=$1 ORDER BY created_at LIMIT 1", [ownerId]);
  let depotId = currentDepot.rows[0]?.id;
  if (!depotId) {
    const depot = DEMO_INSTANCE.depot;
    depotId = depot.id;
    await pool.query(
      "INSERT INTO depots(id,owner_id,name,address,lat,lng) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",
      [depot.id, ownerId, depot.label, depot.address, depot.lat, depot.lng],
    );
  }
  const stopCount = await pool.query("SELECT COUNT(*)::int AS count FROM stops WHERE owner_id=$1", [ownerId]);
  if (!stopCount.rows[0].count) {
    for (const stop of DEMO_INSTANCE.stops) {
      await pool.query(
        `INSERT INTO stops(id,owner_id,label,address,lat,lng,demand,time_window,service_minutes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
        [stop.id, ownerId, stop.label, stop.address, stop.lat, stop.lng, stop.demand, stop.timeWindow ?? null, stop.serviceMinutes],
      );
    }
  }
  const vehicleCount = await pool.query("SELECT COUNT(*)::int AS count FROM vehicles WHERE owner_id=$1", [ownerId]);
  if (!vehicleCount.rows[0].count) {
    for (let i = 0; i < DEMO_INSTANCE.fleet.vehicles; i += 1) {
      await pool.query(
        "INSERT INTO vehicles(id,owner_id,depot_id,name,capacity) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
        [`vehicle-demo-${i + 1}`, ownerId, depotId, `Van ${String(i + 1).padStart(2, "0")}`, DEMO_INSTANCE.fleet.capacity],
      );
    }
  }
}

export function getDemoUserId() { return demoUserId; }

export async function getUserByEmail(email) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query("SELECT id,name,email,password_hash AS \"passwordHash\",role,created_at AS \"createdAt\" FROM users WHERE lower(email)=lower($1)", [email]);
    return result.rows[0] ?? null;
  }
  return [...memory.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getUserById(id) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query("SELECT id,name,email,password_hash AS \"passwordHash\",role,created_at AS \"createdAt\" FROM users WHERE id=$1", [id]);
    return result.rows[0] ?? null;
  }
  return memory.users.get(id) ?? null;
}

export async function createUser({ name, email, passwordHash }) {
  const pool = getPool();
  const id = randomUUID();
  if (pool) {
    const result = await pool.query(
      "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'dispatcher') RETURNING id,name,email,role,created_at AS \"createdAt\"",
      [id, name, email, passwordHash],
    );
    await createEmptyPlanner(result.rows[0].id);
    return result.rows[0];
  }
  const user = { id, name, email, passwordHash, role: "dispatcher", createdAt: new Date().toISOString() };
  memory.users.set(id, user);
  memory.planners.set(id, createEmptyPlannerValue());
  return user;
}

async function createEmptyPlanner(ownerId) {
  const pool = getPool();
  const depotId = `depot-${ownerId}`;
  await pool.query("INSERT INTO depots(id,owner_id,name,address,lat,lng) VALUES($1,$2,$3,$4,$5,$6)", [depotId, ownerId, "Primary depot", "Set your address", DEMO_INSTANCE.depot.lat, DEMO_INSTANCE.depot.lng]);
  for (let i = 0; i < 3; i += 1) {
    await pool.query("INSERT INTO vehicles(id,owner_id,depot_id,name,capacity) VALUES($1,$2,$3,$4,$5)", [`vehicle-${ownerId}-${i + 1}`, ownerId, depotId, `Vehicle ${i + 1}`, 95]);
  }
}

function createEmptyPlannerValue() {
  return { depot: { id: `depot-${randomUUID()}`, label: "Primary depot", address: "Set your address", lat: DEMO_INSTANCE.depot.lat, lng: DEMO_INSTANCE.depot.lng }, stops: [], fleet: { vehicles: 3, capacity: 95, averageSpeedKmh: 28 } };
}

function publicStop(row) {
  return { id: row.id, label: row.label, address: row.address ?? "", lat: Number(row.lat), lng: Number(row.lng), demand: Number(row.demand), serviceMinutes: Number(row.service_minutes ?? row.serviceMinutes ?? 5), timeWindow: row.time_window ?? row.timeWindow ?? null };
}

export async function getPlanner(ownerId) {
  const pool = getPool();
  if (pool) {
    const [depots, vehicles, stops] = await Promise.all([
      pool.query("SELECT id,name AS label,address,lat,lng FROM depots WHERE owner_id=$1 ORDER BY created_at LIMIT 1", [ownerId]),
      pool.query("SELECT id,name,capacity FROM vehicles WHERE owner_id=$1 ORDER BY created_at", [ownerId]),
      pool.query("SELECT id,label,address,lat,lng,demand,service_minutes,time_window FROM stops WHERE owner_id=$1 ORDER BY created_at", [ownerId]),
    ]);
    const depot = depots.rows[0] ?? { id: `depot-${ownerId}`, label: "Primary depot", address: "Set your address", lat: DEMO_INSTANCE.depot.lat, lng: DEMO_INSTANCE.depot.lng };
    const vehicleRows = vehicles.rows;
    return {
      depot: { ...depot, lat: Number(depot.lat), lng: Number(depot.lng) },
      stops: stops.rows.map(publicStop),
      fleet: { vehicles: Math.max(1, vehicleRows.length || 3), capacity: vehicleRows.length ? Math.min(...vehicleRows.map((v) => Number(v.capacity))) : 95, averageSpeedKmh: 28, vehicleNames: vehicleRows.map((v) => v.name) },
    };
  }
  return structuredClone(memory.planners.get(ownerId) ?? createEmptyPlannerValue());
}

export async function addStop(ownerId, stop) {
  const pool = getPool();
  const value = { ...stop, id: stop.id || `ST-${randomUUID().slice(0, 8).toUpperCase()}`, address: stop.address ?? "", serviceMinutes: stop.serviceMinutes ?? 5, timeWindow: stop.timeWindow ?? null };
  if (pool) {
    await pool.query(
      `INSERT INTO stops(id,owner_id,label,address,lat,lng,demand,time_window,service_minutes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [value.id, ownerId, value.label, value.address, value.lat, value.lng, value.demand, value.timeWindow, value.serviceMinutes],
    );
  } else {
    const planner = memory.planners.get(ownerId) ?? createEmptyPlannerValue();
    planner.stops.push(value);
    memory.planners.set(ownerId, planner);
  }
  return value;
}

export async function updateStop(ownerId, id, patch) {
  const pool = getPool();
  if (pool) {
    const current = await pool.query("SELECT id,label,address,lat,lng,demand,service_minutes,time_window FROM stops WHERE id=$1 AND owner_id=$2", [id, ownerId]);
    if (!current.rows[0]) return null;
    const existing = publicStop(current.rows[0]);
    const value = { ...existing, ...patch };
    const result = await pool.query(
      `UPDATE stops SET label=$3,address=$4,lat=$5,lng=$6,demand=$7,service_minutes=$8,time_window=$9
       WHERE id=$1 AND owner_id=$2 RETURNING id,label,address,lat,lng,demand,service_minutes,time_window`,
      [id, ownerId, value.label, value.address, value.lat, value.lng, value.demand, value.serviceMinutes, value.timeWindow],
    );
    return publicStop(result.rows[0]);
  }
  const planner = memory.planners.get(ownerId);
  if (!planner) return null;
  const index = planner.stops.findIndex((stop) => stop.id === id);
  if (index < 0) return null;
  planner.stops[index] = { ...planner.stops[index], ...patch, id };
  return planner.stops[index];
}

export async function removeStop(ownerId, id) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query("DELETE FROM stops WHERE id=$1 AND owner_id=$2 RETURNING id", [id, ownerId]);
    return result.rowCount > 0;
  }
  const planner = memory.planners.get(ownerId);
  if (!planner) return false;
  const before = planner.stops.length;
  planner.stops = planner.stops.filter((stop) => stop.id !== id);
  return planner.stops.length < before;
}

export async function updateFleet(ownerId, { vehicles, capacity, averageSpeedKmh = 28 }) {
  const pool = getPool();
  if (pool) {
    const depotResult = await pool.query("SELECT id FROM depots WHERE owner_id=$1 ORDER BY created_at LIMIT 1", [ownerId]);
    const depotId = depotResult.rows[0]?.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM vehicles WHERE owner_id=$1", [ownerId]);
      for (let i = 0; i < vehicles; i += 1) {
        await client.query("INSERT INTO vehicles(id,owner_id,depot_id,name,capacity) VALUES($1,$2,$3,$4,$5)", [`vehicle-${ownerId}-${i + 1}`, ownerId, depotId, `Van ${String(i + 1).padStart(2, "0")}`, capacity]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    return { vehicles, capacity, averageSpeedKmh };
  }
  const planner = memory.planners.get(ownerId) ?? createEmptyPlannerValue();
  planner.fleet = { ...planner.fleet, vehicles, capacity, averageSpeedKmh };
  memory.planners.set(ownerId, planner);
  return planner.fleet;
}

export async function saveRun(ownerId, { id, algorithm, inputHash, input, result }) {
  const run = { id, ownerId, algorithm, inputHash, params: input, totalDistance: result.totalCost, runtimeMs: result.stats.runtimeMs, opCount: result.stats.operations, result, createdAt: new Date().toISOString() };
  const pool = getPool();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO optimization_runs(id,owner_id,algorithm,params,input_hash,total_distance,runtime_ms,op_count,status,result)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9)`,
        [id, ownerId, algorithm, JSON.stringify(input), inputHash, result.totalCost, result.stats.runtimeMs, result.stats.operations, JSON.stringify(result)],
      );
      const vehicleIds = (await client.query("SELECT id FROM vehicles WHERE owner_id=$1 ORDER BY created_at", [ownerId])).rows.map((row) => row.id);
      for (let routeIndex = 0; routeIndex < result.routes.length; routeIndex += 1) {
        const routeId = randomUUID();
        await client.query("INSERT INTO routes(id,run_id,vehicle_id,distance,load) VALUES($1,$2,$3,$4,$5)", [routeId, id, vehicleIds[routeIndex] ?? null, result.perRouteCost[routeIndex], result.loads[routeIndex]]);
        const stopIndices = result.routes[routeIndex].slice(1, -1);
        for (let seq = 0; seq < stopIndices.length; seq += 1) {
          const stop = input.stops[stopIndices[seq] - 1];
          const schedule = result.routeSchedules[routeIndex]?.schedule?.[seq];
          const stopId = stop?.id;
          if (stopId) await client.query("INSERT INTO route_stops(route_id,stop_id,seq,arrival_time) VALUES($1,$2,$3,$4)", [routeId, stopId, seq + 1, schedule?.arrivalMinutes ?? null]);
        }
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } else {
    memory.runs.unshift(run);
    memory.runs = memory.runs.slice(0, 200);
  }
  return run;
}

export async function listRuns(ownerId, limit = 50) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query(
      "SELECT id,algorithm,total_distance AS \"totalDistance\",runtime_ms AS \"runtimeMs\",op_count AS \"opCount\",created_at AS \"createdAt\",result FROM optimization_runs WHERE owner_id=$1 ORDER BY created_at DESC LIMIT $2",
      [ownerId, limit],
    );
    return result.rows.map((row) => ({ ...row, result: row.result }));
  }
  return memory.runs.filter((run) => run.ownerId === ownerId).slice(0, limit);
}

export async function getRunById(ownerId, id) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query(
      "SELECT id,algorithm,total_distance AS \"totalDistance\",runtime_ms AS \"runtimeMs\",op_count AS \"opCount\",created_at AS \"createdAt\",result FROM optimization_runs WHERE owner_id=$1 AND id=$2",
      [ownerId, id],
    );
    return result.rows[0] ?? null;
  }
  return memory.runs.find((run) => run.ownerId === ownerId && run.id === id) ?? null;
}

export async function saveRefreshToken({ id, userId, tokenHash, expiresAt }) {
  const pool = getPool();
  if (pool) await pool.query("INSERT INTO refresh_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)", [id, userId, tokenHash, expiresAt]);
  else memory.refreshTokens.set(tokenHash, { id, userId, tokenHash, expiresAt, revoked: false });
}

export async function getRefreshToken(tokenHash) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query("SELECT id,user_id AS \"userId\",token_hash AS \"tokenHash\",expires_at AS \"expiresAt\",revoked FROM refresh_tokens WHERE token_hash=$1", [tokenHash]);
    return result.rows[0] ?? null;
  }
  return memory.refreshTokens.get(tokenHash) ?? null;
}

export async function revokeRefreshToken(tokenHash) {
  const pool = getPool();
  if (pool) await pool.query("UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1", [tokenHash]);
  else {
    const token = memory.refreshTokens.get(tokenHash);
    if (token) token.revoked = true;
  }
}

export async function saveBenchmarkRows(rows) {
  const pool = getPool();
  if (pool) {
    for (const row of rows) {
      await pool.query(
        "INSERT INTO benchmark_results(run_batch,algorithm,n_stops,seed,runtime_ms,cost,optimal_cost,gap_pct,operations) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [row.batchId, row.algorithm, row.nStops, row.seed, row.runtimeMs, row.cost, row.optimalCost ?? null, row.gapPct ?? null, row.operations ?? 0],
      );
    }
  } else memory.benchmarks.unshift(...rows);
}

export async function listBenchmarks(limit = 1000) {
  const pool = getPool();
  if (pool) {
    const result = await pool.query("SELECT run_batch AS \"batchId\",algorithm,n_stops AS \"nStops\",seed,runtime_ms AS \"runtimeMs\",cost,optimal_cost AS \"optimalCost\",gap_pct AS \"gapPct\",operations,created_at AS \"createdAt\" FROM benchmark_results ORDER BY created_at DESC LIMIT $1", [limit]);
    return result.rows;
  }
  return memory.benchmarks.slice(0, limit);
}
