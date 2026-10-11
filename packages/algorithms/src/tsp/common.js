import { createTraceRecorder } from "../util/opCounter.js";

export function assertDistanceMatrix(matrix) {
  const n = matrix.length;
  if (n < 2 || matrix.some((row) => row.length !== n)) throw new TypeError("TSP expects a square matrix with a depot and at least one stop");
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (!Number.isFinite(matrix[i][j]) || matrix[i][j] < 0) throw new TypeError("TSP distances must be finite and non-negative");
      if (i === j && matrix[i][j] !== 0) throw new TypeError("Distance matrix diagonal must be zero");
    }
  }
}

export function routeCost(route, matrix) {
  let cost = 0;
  for (let i = 1; i < route.length; i += 1) cost += matrix[route[i - 1]][route[i]];
  return cost;
}

export function createTourContext(options = {}) {
  return { recorder: createTraceRecorder(Boolean(options.trace), options.traceLimit ?? 5000) };
}

export function createTourResult(route, matrix, operations, iterations, recorder) {
  return { route, cost: routeCost(route, matrix), operations, iterations, trace: recorder?.value ?? [] };
}
