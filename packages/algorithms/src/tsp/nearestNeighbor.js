import { assertDistanceMatrix, createTourContext, createTourResult } from "./common.js";

// Greedy construction: append the nearest unvisited customer. Straightforward O(n^2) time.
export function nearestNeighborTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  const { recorder } = createTourContext(options);
  const remaining = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const route = [0];
  let current = 0;
  let operations = 0;
  while (remaining.size) {
    let next = -1;
    let best = Infinity;
    for (const candidate of remaining) {
      operations += 1;
      if (matrix[current][candidate] < best) { best = matrix[current][candidate]; next = candidate; }
    }
    route.push(next);
    remaining.delete(next);
    recorder.add({ type: "visit", data: { from: current, to: next, edgeCost: best }, cost: best, note: `Visit the closest unserved stop (${next}).` });
    current = next;
  }
  route.push(0);
  return createTourResult(route, matrix, operations, n, recorder);
}
