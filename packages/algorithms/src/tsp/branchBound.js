import { assertDistanceMatrix, createTourContext, createTourResult } from "./common.js";

// Exact depth-first TSP search prunes with a relaxed outgoing-edge lower bound; exponential worst case.
export function branchBoundTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  const maxN = options.maxN ?? 15;
  if (n > maxN) throw new RangeError(`Branch-and-bound is limited to ${maxN} stops (received ${n}).`);
  const { recorder } = createTourContext(options);
  const used = new Uint8Array(n + 1);
  const path = [0];
  used[0] = 1;
  let bestCost = Infinity;
  let bestRoute = [];
  let operations = 0;
  let iterations = 0;

  function lowerBound(current, cost) {
    const remaining = [];
    for (let i = 1; i <= n; i += 1) if (!used[i]) remaining.push(i);
    if (!remaining.length) return cost + matrix[current][0];
    let bound = cost;
    let cheapestCurrent = Infinity;
    for (const node of remaining) cheapestCurrent = Math.min(cheapestCurrent, matrix[current][node]);
    bound += cheapestCurrent;
    for (const node of remaining) {
      let cheapestExit = matrix[node][0];
      for (const other of remaining) if (other !== node) cheapestExit = Math.min(cheapestExit, matrix[node][other]);
      bound += cheapestExit;
    }
    return bound;
  }

  function search(current, cost) {
    operations += 1;
    if (path.length === n + 1) {
      const total = cost + matrix[current][0];
      iterations += 1;
      if (total < bestCost) {
        bestCost = total;
        bestRoute = [...path, 0];
        recorder.add({ type: "accept", data: { route: bestRoute, cost: total }, cost: total, note: `Improved the best known tour to ${total.toFixed(2)} km.` });
      }
      return;
    }
    if (lowerBound(current, cost) >= bestCost) return;
    const candidates = [];
    for (let next = 1; next <= n; next += 1) if (!used[next]) candidates.push(next);
    candidates.sort((a, b) => matrix[current][a] - matrix[current][b]);
    for (const next of candidates) {
      used[next] = 1;
      path.push(next);
      search(next, cost + matrix[current][next]);
      path.pop();
      used[next] = 0;
    }
  }

  search(0, 0);
  return createTourResult(bestRoute, matrix, operations, iterations, recorder);
}
