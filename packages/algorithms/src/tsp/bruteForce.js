import { assertDistanceMatrix, createTourContext, createTourResult } from "./common.js";

// Exhaustive permutation search with a partial-cost prune. Exact but O(n!) and limited to 10 stops.
export function bruteForceTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  const maxN = options.maxN ?? 10;
  if (n > maxN) throw new RangeError(`Brute force is limited to ${maxN} stops (received ${n}).`);
  const { recorder } = createTourContext(options);
  const path = [0];
  const used = new Uint8Array(matrix.length);
  used[0] = 1;
  let bestCost = Infinity;
  let bestRoute = [];
  let operations = 0;
  let iterations = 0;

  function search(current, cost) {
    if (path.length === n + 1) {
      operations += 1;
      const total = cost + matrix[current][0];
      iterations += 1;
      if (total < bestCost) {
        bestCost = total;
        bestRoute = [...path, 0];
        recorder.add({ type: "accept", data: { route: bestRoute, cost: total }, cost: total, note: `New best complete tour found: ${total.toFixed(2)} km.` });
      }
      return;
    }
    for (let next = 1; next <= n; next += 1) {
      if (used[next]) continue;
      operations += 1;
      const partial = cost + matrix[current][next];
      if (partial >= bestCost) continue;
      used[next] = 1;
      path.push(next);
      search(next, partial);
      path.pop();
      used[next] = 0;
    }
  }

  search(0, 0);
  return createTourResult(bestRoute, matrix, operations, iterations, recorder);
}
