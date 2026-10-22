export const openApiDocument = {
  openapi: "3.0.3",
  info: { title: "RouteCraft API", version: "1.0.0", description: "Courier route planning, algorithm comparison, and benchmark API." },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      GeoPoint: { type: "object", required: ["lat", "lng"], properties: { lat: { type: "number", minimum: -90, maximum: 90 }, lng: { type: "number", minimum: -180, maximum: 180 }, label: { type: "string" } } },
      Stop: { allOf: [{ $ref: "#/components/schemas/GeoPoint" }], required: ["id", "label", "demand"], properties: { id: { type: "string" }, label: { type: "string" }, demand: { type: "number", exclusiveMinimum: 0 }, serviceMinutes: { type: "number" }, timeWindow: { type: "object", properties: { start: { type: "number" }, end: { type: "number" } } } } },
      OptimizationRequest: { type: "object", required: ["depot", "stops", "vehicles", "capacity", "algorithm"], properties: { depot: { $ref: "#/components/schemas/GeoPoint" }, stops: { type: "array", items: { $ref: "#/components/schemas/Stop" } }, vehicles: { type: "integer", minimum: 1 }, capacity: { type: "number", exclusiveMinimum: 0 }, algorithm: { type: "string", enum: ["nearest-neighbor", "mst-2approx", "kmeans", "branch-and-bound", "brute-force", "sweep"] }, options: { type: "object" } } },
    },
  },
  paths: {
    "/health": { get: { summary: "Service health", responses: { 200: { description: "API and optional service status" } } } },
    "/planner": { get: { summary: "Load depot, stops and fleet", security: [{ bearerAuth: [] }], responses: { 200: { description: "Planner snapshot" } } } },
    "/algorithms": { get: { summary: "Algorithm catalog", responses: { 200: { description: "Solver metadata" } } } },
    "/optimizations": { post: { summary: "Run route optimization asynchronously", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OptimizationRequest" } } } }, responses: { 202: { description: "Job accepted" }, 400: { description: "Validation error" } } } },
    "/optimizations/{id}": { get: { summary: "Read job status/result", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: [{ bearerAuth: [] }], responses: { 200: { description: "Optimization job" } } } },
    "/compare": { post: { summary: "Compare multiple algorithms on one instance", security: [{ bearerAuth: [] }], responses: { 200: { description: "Ordered result list" } } } },
    "/benchmarks/run": { post: { summary: "Run deterministic scaling benchmark", security: [{ bearerAuth: [] }], responses: { 200: { description: "Benchmark rows" } } } },
    "/stops": { get: { summary: "List stops", security: [{ bearerAuth: [] }], responses: { 200: { description: "Stop list" } } }, post: { summary: "Create stop", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created stop" } } } },
    "/fleet": { get: { summary: "Read fleet", security: [{ bearerAuth: [] }], responses: { 200: { description: "Fleet settings" } } }, put: { summary: "Update fleet size/capacity", security: [{ bearerAuth: [] }], responses: { 200: { description: "Updated fleet" } } } },
  },
};
