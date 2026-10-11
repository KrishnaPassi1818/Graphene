import { assertDistanceMatrix, createTourContext, createTourResult, routeCost } from "../tsp/common.js";
import { nearestNeighborTsp } from "../tsp/nearestNeighbor.js";

// Or-opt relocates short consecutive customer segments (length 1–3) to another tour position.
export function orOptTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  let route = (options.initialRoute ?? nearestNeighborTsp(matrix, { trace: false }).route).slice();
  const { recorder } = createTourContext(options);
  let operations = 0;
  let iterations = 0;
  const maxPasses = options.maxPasses ?? Math.max(5, n * 2);
  let improved = true;
  let pass = 0;

  while (improved && pass < maxPasses) {
    improved = false;
    pass += 1;
    outer: for (let length = 1; length <= Math.min(3, n); length += 1) {
      for (let start = 1; start + length <= route.length - 1; start += 1) {
        const segment = route.slice(start, start + length);
        const base = [...route.slice(0, start), ...route.slice(start + length)];
        const before = routeCost(route, matrix);
        for (let insertAt = 1; insertAt < base.length; insertAt += 1) {
          if (insertAt === start) continue;
          operations += 1;
          const candidate = [...base.slice(0, insertAt), ...segment, ...base.slice(insertAt)];
          const cost = routeCost(candidate, matrix);
          if (cost < before - 1e-10) {
            route = candidate;
            iterations += 1;
            improved = true;
            recorder.add({ type: "swap", data: { length, start, insertAt, route: route.slice() }, cost, note: `Move a ${length}-stop segment to a cheaper insertion point.` });
            break outer;
          }
        }
      }
    }
  }
  return createTourResult(route, matrix, operations, iterations, recorder);
}
