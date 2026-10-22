// All-pairs shortest paths by dynamic programming through intermediate vertices. O(V^3) time, O(V^2) space.
export function floydWarshall(inputMatrix, { trace = false } = {}) {
  const n = inputMatrix.length;
  if (inputMatrix.some((row) => row.length !== n)) throw new TypeError("Distance matrix must be square");
  const distances = inputMatrix.map((row) => row.slice());
  const next = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j || !Number.isFinite(distances[i][j]) ? null : j)));
  const steps = [];
  let operations = 0;
  for (let k = 0; k < n; k += 1) {
    if (trace && steps.length < 5000) {
      steps.push({ type: "pivot", data: { k }, cost: 0, note: `Considering intermediate vertex ${k} for all pairs (i, j).` });
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        operations += 1;
        const through = distances[i][k] + distances[k][j];
        if (through < distances[i][j]) {
          distances[i][j] = through;
          next[i][j] = next[i][k];
          if (trace && steps.length < 5000) steps.push({ type: "dp-cell", data: { i, j, k, value: through }, cost: through, note: `Using ${k} as an intermediate improves ${i} → ${j} to ${through.toFixed ? through.toFixed(2) : through}.` });
        }
      }
    }
  }
  const hasNegativeCycle = distances.some((row, i) => row[i] < 0);
  return { distances, next, hasNegativeCycle, operations, trace: steps };
}

export function reconstructFloydPath(next, from, to) {
  if (next[from]?.[to] == null) return [];
  const path = [from];
  let current = from;
  let guard = 0;
  while (current !== to && guard <= next.length) {
    current = next[current][to];
    if (current == null) return [];
    path.push(current);
    guard += 1;
  }
  return current === to ? path : [];
}
