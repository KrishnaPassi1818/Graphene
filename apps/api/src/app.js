import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import { ALGORITHM_REGISTRY, DEMO_INSTANCE, generateInstance, solveOptimization } from "@courier/algorithms";
import { BenchmarkRequestSchema, CompareRequestSchema, OptimizationRequestSchema, StopSchema } from "@courier/contracts";
import { authenticate, authorize } from "./middleware/auth.js";
import { authRouter } from "./modules/auth.js";
import { openApiDocument } from "./openapi.js";
import { cacheHealth } from "./cache/index.js";
import { databaseHealth } from "./db/index.js";
import { addStop, getDemoUserId, getPlanner, getRunById, listBenchmarks, listRuns, removeStop, saveBenchmarkRows, updateFleet, updateStop } from "./storage.js";
import { getOptimizationJob, runSolverInWorker, startOptimization } from "./services/optimization.js";

const canDispatch = authorize("admin", "dispatcher");
const createStopSchema = StopSchema.omit({ id: true });
const patchStopSchema = createStopSchema.partial();
const fleetSchema = z.object({ vehicles: z.number().int().min(1).max(30), capacity: z.number().finite().positive().max(100000), averageSpeedKmh: z.number().finite().positive().max(150).optional().default(28) });

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? 1 : 0)));
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    } },
  }));
  app.use(cors({
    origin(origin, callback) {
      const allowed = (process.env.WEB_ORIGIN || "http://localhost:5173").split(",").map((item) => item.trim());
      if (!origin || allowed.includes(origin) || process.env.NODE_ENV !== "production") return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ quietReqLogger: true, autoLogging: process.env.NODE_ENV !== "test", redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"] }));

  const authLimiter = rateLimit({ windowMs: 60 * 1000, limit: process.env.NODE_ENV === "test" ? 50 : 5, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many authentication attempts. Try again in a minute." } });
  app.use("/api/auth", authLimiter, authRouter);

  app.get("/api/health", asyncHandler(async (_req, res) => {
    const [database, redis] = await Promise.all([databaseHealth(), Promise.resolve(cacheHealth())]);
    res.json({ status: "ready", service: "routecraft-api", version: "1.0.0", database, redis, timestamp: new Date().toISOString() });
  }));
  app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: "RouteCraft API docs" }));
  app.get("/api/algorithms", (_req, res) => res.json({ algorithms: ALGORITHM_REGISTRY }));
  app.get("/api/demo/instance", (_req, res) => res.json(structuredClone(DEMO_INSTANCE)));

  app.get("/api/planner", authenticate, asyncHandler(async (req, res) => {
    const planner = await getPlanner(req.user.id);
    res.json({ ...planner, demoMode: process.env.DEMO_MODE !== "false", allowSignup: process.env.NODE_ENV !== "production" || process.env.ALLOW_SIGNUP === "true", algorithms: ALGORITHM_REGISTRY });
  }));

  app.get("/api/stops", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const planner = await getPlanner(req.user.id);
    res.json({ stops: planner.stops });
  }));
  app.post("/api/stops", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const stop = createStopSchema.parse(req.body);
    const created = await addStop(req.user.id, stop);
    res.status(201).json({ stop: created });
  }));
  app.patch("/api/stops/:id", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const patch = patchStopSchema.parse(req.body);
    const updated = await updateStop(req.user.id, req.params.id, patch);
    if (!updated) return res.status(404).json({ error: "Stop not found." });
    return res.json({ stop: updated });
  }));
  app.delete("/api/stops/:id", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const removed = await removeStop(req.user.id, req.params.id);
    if (!removed) return res.status(404).json({ error: "Stop not found." });
    return res.json({ ok: true });
  }));
  app.post("/api/stops/import", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const csv = z.string().min(1).max(500000).parse(req.body?.csv);
    const rows = parseCsv(csv);
    const header = rows.shift()?.map((value) => value.trim().toLowerCase()) ?? [];
    const required = ["label", "lat", "lng", "demand"];
    if (required.some((key) => !header.includes(key))) return res.status(400).json({ error: "CSV needs label, lat, lng and demand columns." });
    if (rows.length > 250) return res.status(400).json({ error: "Import is limited to 250 stops per batch." });
    const candidates = rows.filter((row) => row.some(Boolean)).map((row) => {
      const value = Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]));
      return createStopSchema.parse({
        label: value.label,
        address: value.address || "CSV import",
        lat: Number(value.lat),
        lng: Number(value.lng),
        demand: Number(value.demand),
        serviceMinutes: value.serviceminutes ? Number(value.serviceminutes) : 5,
      });
    });
    const created = [];
    for (const candidate of candidates) created.push(await addStop(req.user.id, candidate));
    return res.status(201).json({ imported: created.length, stops: created });
  }));

  app.get("/api/fleet", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const { fleet } = await getPlanner(req.user.id);
    res.json({ fleet });
  }));
  app.put("/api/fleet", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const fleet = fleetSchema.parse(req.body);
    res.json({ fleet: await updateFleet(req.user.id, fleet) });
  }));

  app.post("/api/optimizations", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const input = OptimizationRequestSchema.parse(req.body);
    if (!await validatePlannerOwnership(req.user.id, input, res)) return;
    const job = await startOptimization(input, req.user.id);
    res.status(202).json(job);
  }));
  app.get("/api/optimizations/:id", authenticate, asyncHandler(async (req, res) => {
    const job = await getOptimizationJob(req.user.id, req.params.id);
    if (!job) return res.status(404).json({ error: "Optimization not found." });
    const { ownerId, ...safeJob } = job;
    return res.json(safeJob);
  }));
  app.get("/api/optimizations/:id/trace", authenticate, asyncHandler(async (req, res) => {
    const job = await getOptimizationJob(req.user.id, req.params.id);
    if (!job) return res.status(404).json({ error: "Optimization not found." });
    return res.json({ trace: job.result?.trace ?? [], status: job.status });
  }));

  app.post("/api/compare", authenticate, canDispatch, asyncHandler(async (req, res) => {
    const input = CompareRequestSchema.parse(req.body);
    if (!await validatePlannerOwnership(req.user.id, input, res)) return;
    const results = await Promise.all(input.algorithms.map(async (algorithm) => {
      try {
        const result = await runSolverInWorker({ ...input, algorithm }, Number(process.env.COMPARE_TIMEOUT_MS || 30000));
        return { algorithm, name: ALGORITHM_REGISTRY.find((entry) => entry.id === algorithm)?.name ?? algorithm, result };
      } catch (error) { return { algorithm, error: error.message }; }
    }));
    return res.json({ results });
  }));

  app.get("/api/runs", authenticate, asyncHandler(async (req, res) => {
    const runs = await listRuns(req.user.id, Math.min(100, Number(req.query.limit) || 50));
    res.json({ runs: runs.map((run) => ({ id: run.id, algorithm: run.algorithm, totalDistance: run.totalDistance ?? run.total_distance, runtimeMs: run.runtimeMs ?? run.runtime_ms, opCount: run.opCount ?? run.op_count, createdAt: run.createdAt ?? run.created_at })) });
  }));
  app.get("/api/runs/:id", authenticate, asyncHandler(async (req, res) => {
    const run = await getRunById(req.user.id, req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found." });
    return res.json({ run });
  }));

  app.get("/api/benchmarks", authenticate, asyncHandler(async (_req, res) => {
    res.json({ results: await listBenchmarks() });
  }));
  app.post("/api/benchmarks/run", authenticate, demoOrAdmin, asyncHandler(async (req, res) => {
    const input = BenchmarkRequestSchema.parse(req.body ?? {});
    const algorithms = input.algorithms ?? ["nearest-neighbor", "two-opt", "combined", "held-karp"];
    const sizes = input.sizes ?? [6, 10, 14, 20, 32];
    const batchId = `bench-${Date.now().toString(36)}`;
    const results = [];
    for (const nStops of sizes) {
      for (let seed = 1; seed <= input.seeds; seed += 1) {
        const instance = generateInstance({ n: nStops, seed });
        const totalDemand = instance.demands.slice(1).reduce((sum, value) => sum + value, 0);
        const payload = { depot: instance.depot, stops: instance.stops, matrix: instance.matrix, demands: instance.demands, vehicles: 1, capacity: totalDemand + 1, options: { seed, trace: false, maxIterations: 800 } };
        let optimalCost = null;
        for (const algorithm of algorithms) {
          try {
            const result = await runSolverInWorker({ ...payload, algorithm }, Number(process.env.BENCHMARK_TIMEOUT_MS || 15000));
            if (["held-karp", "brute-force", "branch-and-bound"].includes(algorithm)) optimalCost = optimalCost == null ? result.totalCost : Math.min(optimalCost, result.totalCost);
            results.push({ batchId, algorithm, nStops, seed, runtimeMs: result.stats.runtimeMs, cost: result.totalCost, optimalCost: null, gapPct: null, operations: result.stats.operations });
          } catch (error) {
            results.push({ batchId, algorithm, nStops, seed, runtimeMs: null, cost: null, error: error.message, operations: 0 });
          }
        }
        const exact = results.filter((row) => row.nStops === nStops && row.seed === seed && row.cost != null && ["held-karp", "brute-force", "branch-and-bound"].includes(row.algorithm));
        if (exact.length) optimalCost = Math.min(...exact.map((row) => row.cost));
        for (const row of results.filter((item) => item.nStops === nStops && item.seed === seed && item.cost != null)) {
          row.optimalCost = optimalCost;
          row.gapPct = optimalCost > 0 ? Math.max(0, ((row.cost - optimalCost) / optimalCost) * 100) : 0;
        }
      }
    }
    const persisted = results.filter((row) => row.cost != null);
    await saveBenchmarkRows(persisted);
    return res.json({ batchId, results });
  }));

  app.use((_req, res) => res.status(404).json({ error: "Route not found." }));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Request validation failed.", details: error.issues.map(({ path, message, code }) => ({ path: path.join("."), message, code })) });
    if (error.code === "23505") return res.status(409).json({ error: "A record with that value already exists." });
    if (error.message === "Origin is not allowed by CORS.") return res.status(403).json({ error: error.message });
    if (process.env.NODE_ENV !== "production") console.error(error);
    return res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error." : error.message });
  });
  return app;
}

async function validatePlannerOwnership(ownerId, input, res) {
  const planner = await getPlanner(ownerId);
  const ownedStops = new Set(planner.stops.map((stop) => stop.id));
  const unknown = input.stops.filter((stop) => !ownedStops.has(stop.id));
  if (unknown.length) { res.status(403).json({ error: "One or more stops do not belong to this workspace." }); return false; }
  if (input.depot.id && planner.depot.id && input.depot.id !== planner.depot.id) { res.status(403).json({ error: "Depot does not belong to this workspace." }); return false; }
  if (new Set(input.stops.map((stop) => stop.id)).size !== input.stops.length) { res.status(400).json({ error: "Stop IDs must be unique within an optimization request." }); return false; }
  return true;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function demoOrAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  if (process.env.DEMO_MODE !== "false" && req.user?.id === getDemoUserId()) return next();
  return res.status(403).json({ error: "Admin role required." });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
