import { ALGORITHM_REGISTRY, ROUTE_ALGORITHM_IDS } from "../registry.js";
import { createTraceRecorder } from "../util/opCounter.js";
import { distanceMatrixFromPoints } from "../util/haversine.js";
import { bruteForceTsp } from "../tsp/bruteForce.js";
import { branchBoundTsp } from "../tsp/branchBound.js";
import { heldKarpTsp } from "../tsp/heldKarp.js";
import { nearestNeighborTsp } from "../tsp/nearestNeighbor.js";
import { mstTwoApproxTsp } from "../tsp/mst2approx.js";
import { twoOptTsp } from "../improve/twoOpt.js";
import { orOptTsp } from "../improve/orOpt.js";
import { simulatedAnnealingTsp } from "../improve/simulatedAnnealing.js";
import { sweepClusters, kmeansClusters } from "./clustering.js";
import { clarkeWrightClusters } from "./clarkeWright.js";
import { orderForTimeWindows } from "./timeWindows.js";
import { validateSolution } from "./validate.js";

const clock = () => globalThis.performance?.now?.() ?? Date.now();

export function solveOptimization({ depot, stops, matrix, demands, capacity, vehicles, algorithm = "combined", options = {} }) {
  if (!ROUTE_ALGORITHM_IDS.includes(algorithm)) throw new RangeError(`Unknown route algorithm: ${algorithm}`);
  const points = [depot, ...stops];
  const distanceMatrix = matrix ?? distanceMatrixFromPoints(points);
  const loads = demands ?? [0, ...stops.map((stop) => stop.demand)];
  validateInput(distanceMatrix, loads, capacity, vehicles, stops.length);
  const started = clock();
  const trace = createTraceRecorder(Boolean(options.trace), options.traceLimit ?? 5000);
  const traceProxy = { add: (step) => trace.add(step) };

  let clusters;
  let operations = 0;
  if (algorithm === "clarke-wright" || algorithm === "combined") {
    const built = clarkeWrightClusters({ matrix: distanceMatrix, demands: loads, vehicles, capacity, trace: traceProxy });
    clusters = built.clusters;
    operations += built.operations;
  } else if (algorithm === "sweep") {
    clusters = sweepClusters({ stops, depot, vehicles, capacity, demands: loads, trace: traceProxy });
  } else if (algorithm === "kmeans") {
    clusters = kmeansClusters({ stops, depot, vehicles, capacity, demands: loads, seed: options.seed ?? 42, trace: traceProxy });
  } else {
    // Exact solvers optimize each capacity-feasible route, not the combinatorial CVRP partition itself.
    clusters = sweepClusters({ stops, depot, vehicles, capacity, demands: loads, trace: traceProxy });
  }

  if (clusters.length > vehicles) throw new RangeError(`At least ${clusters.length} vehicles are required for the current capacity.`);
  const routes = [];
  let iterations = 0;
  for (let routeIndex = 0; routeIndex < clusters.length; routeIndex += 1) {
    const cluster = clusters[routeIndex];
    const subIndices = [0, ...cluster];
    const subMatrix = subIndices.map((i) => subIndices.map((j) => distanceMatrix[i][j]));
    let routeResult = solveCluster(subMatrix, cluster, algorithm, { ...options, seed: (options.seed ?? 42) + routeIndex });
    operations += routeResult.operations ?? 0;
    iterations += routeResult.iterations ?? 0;
    let globalRoute = routeResult.route.map((localIndex) => localIndex === 0 ? 0 : cluster[localIndex - 1]);

    if (stops.some((stop) => stop.timeWindow)) {
      const scheduled = orderForTimeWindows(cluster, distanceMatrix, stops, options);
      const timeWindowRoute = [0, ...scheduled.order, 0];
      const originalCheck = validateSolution([globalRoute], { matrix: distanceMatrix, demands: loads, capacity, vehicles: 1, stops, options });
      const timeWindowCheck = validateSolution([timeWindowRoute], { matrix: distanceMatrix, demands: loads, capacity, vehicles: 1, stops, options });
      if (!originalCheck.timeWindowFeasible && timeWindowCheck.timeWindowFeasible) {
        globalRoute = timeWindowRoute;
        trace.add({ type: "accept", data: { routeIndex, route: globalRoute }, note: "Reordered this cluster with earliest-deadline scheduling to satisfy time windows." });
      }
    }
    routes.push(globalRoute);
    for (const step of routeResult.trace ?? []) trace.add({ ...step, data: { ...(step.data ?? {}), routeIndex } });
  }

  const validation = validateSolution(routes, { matrix: distanceMatrix, demands: loads, capacity, vehicles, stops, options });
  const totalCost = validation.perRouteCost.reduce((sum, value) => sum + value, 0);
  const runtimeMs = Math.max(0, clock() - started);
  const metadata = ALGORITHM_REGISTRY.find((item) => item.id === algorithm);
  return {
    algorithm,
    routes,
    totalCost,
    perRouteCost: validation.perRouteCost,
    loads: validation.loads,
    capacity,
    vehicles,
    routeSchedules: validation.routeSchedules,
    validation: {
      valid: validation.valid,
      capacityFeasible: validation.capacityFeasible,
      coverageFeasible: validation.coverageFeasible,
      fleetFeasible: validation.fleetFeasible,
      timeWindowFeasible: validation.timeWindowFeasible,
      violations: validation.violations,
    },
    stats: { runtimeMs, operations, iterations, stops: stops.length, routes: routes.length },
    explanation: metadata?.description ?? "",
    trace: trace.value,
  };
}

function solveCluster(matrix, cluster, algorithm, options) {
  const traceOptions = { ...options, trace: Boolean(options.trace), traceLimit: options.traceLimit ?? 5000 };
  switch (algorithm) {
    case "brute-force": return bruteForceTsp(matrix, traceOptions);
    case "branch-and-bound": return branchBoundTsp(matrix, traceOptions);
    case "held-karp": return heldKarpTsp(matrix, traceOptions);
    case "nearest-neighbor": return nearestNeighborTsp(matrix, traceOptions);
    case "mst-2approx": return mstTwoApproxTsp(matrix, traceOptions);
    case "two-opt": return twoOptTsp(matrix, traceOptions);
    case "or-opt": return orOptTsp(matrix, traceOptions);
    case "simulated-annealing": return simulatedAnnealingTsp(matrix, traceOptions);
    case "sweep":
    case "kmeans": return twoOptTsp(matrix, { ...traceOptions, initialRoute: nearestNeighborTsp(matrix, { trace: false }).route });
    case "clarke-wright": return { route: [0, ...cluster, 0].map((globalIndex) => globalIndex === 0 ? 0 : cluster.indexOf(globalIndex) + 1), cost: 0, operations: 0, iterations: 0, trace: [] };
    case "combined": {
      const seed = nearestNeighborTsp(matrix, { trace: false });
      const improved = twoOptTsp(matrix, { ...traceOptions, initialRoute: seed.route });
      const polished = simulatedAnnealingTsp(matrix, { ...traceOptions, initialRoute: improved.route, maxIterations: Math.min(options.maxIterations ?? 1500, 900) });
      return {
        route: polished.cost < improved.cost ? polished.route : improved.route,
        cost: Math.min(polished.cost, improved.cost),
        operations: seed.operations + improved.operations + polished.operations,
        iterations: improved.iterations + polished.iterations,
        trace: [...improved.trace, ...polished.trace],
      };
    }
    default: throw new RangeError(`Algorithm ${algorithm} is not implemented.`);
  }
}

function validateInput(matrix, demands, capacity, vehicles, stopCount) {
  if (!Number.isInteger(vehicles) || vehicles < 1) throw new RangeError("vehicles must be a positive integer");
  if (!Number.isFinite(capacity) || capacity <= 0) throw new RangeError("capacity must be positive");
  if (!Number.isInteger(stopCount) || stopCount < 1) throw new RangeError("At least one delivery stop is required");
  if (matrix.length !== stopCount + 1 || matrix.some((row) => row.length !== matrix.length)) throw new TypeError("Distance matrix must be (stops + depot) square");
  if (demands.length !== matrix.length || demands[0] !== 0) throw new TypeError("demands must include 0 at the depot index");
  for (let i = 0; i < matrix.length; i += 1) {
    for (let j = 0; j < matrix.length; j += 1) {
      if (!Number.isFinite(matrix[i][j]) || matrix[i][j] < 0) throw new TypeError("Route distances must be finite and non-negative");
      if (i === j && Math.abs(matrix[i][j]) > 1e-10) throw new TypeError("Distance matrix diagonal must be zero");
      if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-8) throw new TypeError("TSP route optimization requires a symmetric distance matrix");
    }
  }
  if (demands.slice(1).some((demand) => !Number.isFinite(demand) || demand <= 0)) throw new TypeError("Each stop demand must be finite and positive");
  const totalDemand = demands.slice(1).reduce((sum, demand) => sum + demand, 0);
  if (totalDemand > vehicles * capacity + 1e-8) throw new RangeError(`Fleet capacity is insufficient (${totalDemand.toFixed(1)} demand > ${(vehicles * capacity).toFixed(1)} available).`);
  if (demands.slice(1).some((demand) => demand > capacity)) throw new RangeError("At least one stop exceeds vehicle capacity.");
}
