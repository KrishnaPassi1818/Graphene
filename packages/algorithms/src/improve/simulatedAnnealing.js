import { assertDistanceMatrix, createTourContext, createTourResult, routeCost } from "../tsp/common.js";
import { nearestNeighborTsp } from "../tsp/nearestNeighbor.js";
import { seededRandom } from "../util/seededRandom.js";

// Seeded Metropolis search: uphill moves are accepted with probability exp(-delta / temperature).
export function simulatedAnnealingTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  const { recorder } = createTourContext(options);
  let current = (options.initialRoute ?? nearestNeighborTsp(matrix, { trace: false }).route).slice();
  let currentCost = routeCost(current, matrix);
  let best = current.slice();
  let bestCost = currentCost;
  const random = seededRandom(options.seed ?? 42);
  const iterations = Math.max(50, options.maxIterations ?? 1500);
  const startTemp = options.startTemperature ?? 1.2;
  const endTemp = options.endTemperature ?? 0.005;
  let operations = 0;
  let accepted = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (n < 2) break;
    const i = 1 + Math.floor(random() * (n - 1));
    const k = i + 1 + Math.floor(random() * (n - i));
    const candidate = current.slice();
    const reversed = candidate.slice(i, k + 1).reverse();
    candidate.splice(i, reversed.length, ...reversed);
    const candidateCost = routeCost(candidate, matrix);
    operations += n;
    const progress = iterations === 1 ? 1 : iteration / (iterations - 1);
    const temperature = startTemp * ((endTemp / startTemp) ** progress);
    const delta = candidateCost - currentCost;
    const accept = delta <= 0 || random() < Math.exp(-delta / Math.max(temperature, 1e-12));
    if (accept) {
      current = candidate;
      currentCost = candidateCost;
      accepted += 1;
      if (candidateCost < bestCost - 1e-10) {
        best = candidate.slice();
        bestCost = candidateCost;
      }
    }
    if (iteration % Math.max(1, Math.floor(iterations / 60)) === 0) {
      recorder.add({ type: accept ? "accept" : "reject", data: { iteration, temperature, accepted, candidateCost }, cost: currentCost, note: `${accept ? "Accepted" : "Rejected"} a neighbor at temperature ${temperature.toFixed(3)}.` });
    }
  }
  return createTourResult(best, matrix, operations, iterations, recorder);
}
