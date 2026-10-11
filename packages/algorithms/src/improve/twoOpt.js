import { assertDistanceMatrix, createTourContext, createTourResult, routeCost } from "../tsp/common.js";
import { nearestNeighborTsp } from "../tsp/nearestNeighbor.js";

// 2-opt removes two edges and reverses the intervening segment whenever the symmetric-tour delta is negative.
export function twoOptTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  const initial = options.initialRoute ?? nearestNeighborTsp(matrix, { trace: false }).route;
  const route = initial.slice();
  const { recorder } = createTourContext(options);
  let operations = 0;
  let iterations = 0;
  const maxPasses = options.maxPasses ?? Math.max(10, n * 3);
  let improved = true;
  let pass = 0;

  while (improved && pass < maxPasses) {
    improved = false;
    pass += 1;
    for (let i = 1; i < route.length - 2; i += 1) {
      for (let k = i + 1; k < route.length - 1; k += 1) {
        operations += 1;
        const before = matrix[route[i - 1]][route[i]] + matrix[route[k]][route[k + 1]];
        const after = matrix[route[i - 1]][route[k]] + matrix[route[i]][route[k + 1]];
        const delta = after - before;
        if (delta < -1e-10) {
          const segment = route.slice(i, k + 1).reverse();
          route.splice(i, segment.length, ...segment);
          iterations += 1;
          improved = true;
          recorder.add({ type: "swap", data: { i, k, delta: Number(delta.toFixed(5)), route: route.slice() }, cost: routeCost(route, matrix), note: `2-opt reconnects two edges, reducing the tour by ${Math.abs(delta).toFixed(2)} km.` });
        }
      }
    }
  }
  return createTourResult(route, matrix, operations, iterations, recorder);
}
