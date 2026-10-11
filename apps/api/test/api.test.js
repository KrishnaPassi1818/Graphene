import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initializeStorage } from "../src/storage.js";

process.env.DEMO_MODE = "true";
process.env.NODE_ENV = "test";

const app = createApp();

beforeAll(async () => { await initializeStorage(); });

describe("RouteCraft API", () => {
  it("reports health without requiring credentials", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.service).toBe("routecraft-api");
  });

  it("exposes the deterministic demo planner and algorithm catalog", async () => {
    const planner = await request(app).get("/api/planner").expect(200);
    expect(planner.body.stops).toHaveLength(14);
    expect(planner.body.fleet.vehicles).toBe(3);
    const algorithms = await request(app).get("/api/algorithms").expect(200);
    expect(algorithms.body.algorithms.some((algorithm) => algorithm.id === "held-karp")).toBe(true);
  });

  it("validates stop creation at the boundary", async () => {
    const invalid = await request(app).post("/api/stops").send({ label: "No coords", demand: -1 }).expect(400);
    expect(invalid.body.error).toBe("Request validation failed.");
    const valid = await request(app).post("/api/stops").send({ label: "API test stop", lat: 30.901, lng: 75.856, demand: 4, serviceMinutes: 5 }).expect(201);
    expect(valid.body.stop.label).toBe("API test stop");
    await request(app).delete(`/api/stops/${valid.body.stop.id}`).expect(200);
  });

  it("blocks public signup when running in production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await request(app).post("/api/auth/signup").send({ name: "New User", email: "new@example.test", password: "ValidPass!2026" }).expect(403);
      expect(response.body.error).toMatch(/disabled/i);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("issues, rotates and revokes refresh sessions", async () => {
    const agent = request.agent(app);
    const weak = await agent.post("/api/auth/signup").send({ name: "Test User", email: "weak@example.test", password: "weak" }).expect(400);
    expect(weak.body.error).toBe("Request validation failed.");
    const login = await agent.post("/api/auth/login").send({ email: "dispatcher@routecraft.local", password: "RouteDemo!2026" }).expect(200);
    expect(login.body.accessToken).toBeTruthy();
    await agent.get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`).expect(200);
    const refresh = await agent.post("/api/auth/refresh").expect(200);
    expect(refresh.body.accessToken).toBeTruthy();
    await agent.post("/api/auth/logout").set("Authorization", `Bearer ${refresh.body.accessToken}`).expect(200);
    await request(app).get("/api/planner").set("Authorization", `Bearer ${refresh.body.accessToken}`).expect(401);
  });

  it("blocks optimization requests that reference another workspace's stops", async () => {
    const snapshot = (await request(app).get("/api/planner").expect(200)).body;
    const payload = { depot: snapshot.depot, stops: [{ ...snapshot.stops[0], id: "foreign-stop-id" }], vehicles: 1, capacity: 95, algorithm: "nearest-neighbor", options: { trace: false } };
    await request(app).post("/api/optimizations").send(payload).expect(403);
  });

  it("compares multiple algorithms against an owned planner", async () => {
    const snapshot = (await request(app).get("/api/planner").expect(200)).body;
    const response = await request(app).post("/api/compare").send({
      depot: snapshot.depot,
      stops: snapshot.stops.slice(0, 4),
      vehicles: 2,
      capacity: 95,
      algorithm: "combined",
      algorithms: ["nearest-neighbor", "two-opt"],
      options: { trace: false, maxIterations: 100 },
    }).expect(200);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results.every((result) => result.result?.validation.valid)).toBe(true);
  });

  it("runs an optimization asynchronously and returns a validated trace", async () => {
    const plannerResponse = await request(app).get("/api/planner").expect(200);
    const snapshot = plannerResponse.body;
    const payload = { depot: snapshot.depot, stops: snapshot.stops.slice(0, 5), vehicles: 2, capacity: 95, algorithm: "combined", options: { seed: 9, trace: true, maxIterations: 120 } };
    const started = await request(app).post("/api/optimizations").send(payload).expect(202);
    let job;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      job = await request(app).get(`/api/optimizations/${started.body.jobId}`).expect(200).then((response) => response.body);
      if (job.status !== "running") break;
    }
    expect(job.status).toBe("completed");
    expect(job.result.validation.valid).toBe(true);
    expect(job.result.trace.length).toBeGreaterThan(0);
  });
});
