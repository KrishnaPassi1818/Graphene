import { assertDistanceMatrix, createTourContext, createTourResult } from "./common.js";

// Bitmask DP: dp[mask,last] stores the cheapest depot-rooted path for that subset and endpoint.
// Recurrence: dp[S,j] = min(i in S\{j}) dp[S\{j},i] + d(i,j). O(n^2 2^n) time/space.
export function heldKarpTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length - 1;
  const maxN = options.maxN ?? 18;
  if (n > maxN) throw new RangeError(`Held–Karp is limited to ${maxN} stops (received ${n}).`);
  const { recorder } = createTourContext(options);
  const stateCount = 1 << n;
  const width = n;
  const dp = new Float64Array(stateCount * width);
  dp.fill(Infinity);
  const parent = new Int16Array(stateCount * width);
  parent.fill(-1);
  const at = (mask, last) => mask * width + last;
  let operations = 0;

  for (let j = 0; j < n; j += 1) {
    const mask = 1 << j;
    dp[at(mask, j)] = matrix[0][j + 1];
    parent[at(mask, j)] = -1;
  }

  for (let mask = 1; mask < stateCount; mask += 1) {
    for (let last = 0; last < n; last += 1) {
      if (!(mask & (1 << last))) continue;
      const previousMask = mask ^ (1 << last);
      if (previousMask === 0) continue;
      let best = Infinity;
      let bestPrevious = -1;
      for (let previous = 0; previous < n; previous += 1) {
        if (!(previousMask & (1 << previous))) continue;
        operations += 1;
        const candidate = dp[at(previousMask, previous)] + matrix[previous + 1][last + 1];
        if (candidate < best) { best = candidate; bestPrevious = previous; }
      }
      dp[at(mask, last)] = best;
      parent[at(mask, last)] = bestPrevious;
      recorder.add({ type: "dp-cell", data: { mask, last: last + 1, value: best }, cost: best, note: `Best path through subset ${mask.toString(2)} ending at stop ${last + 1}.` });
    }
  }

  const fullMask = stateCount - 1;
  let bestCost = Infinity;
  let last = -1;
  for (let j = 0; j < n; j += 1) {
    const candidate = dp[at(fullMask, j)] + matrix[j + 1][0];
    operations += 1;
    if (candidate < bestCost) { bestCost = candidate; last = j; }
  }

  const reversed = [];
  let mask = fullMask;
  while (last >= 0) {
    reversed.push(last + 1);
    const previous = parent[at(mask, last)];
    mask ^= 1 << last;
    last = previous;
  }
  const route = [0, ...reversed.reverse(), 0];
  return createTourResult(route, matrix, operations, operations, recorder);
}
