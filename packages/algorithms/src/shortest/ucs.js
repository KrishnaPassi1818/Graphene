import { MinHeap } from "../ds/MinHeap.js";

// Uniform Cost Search (UCS): Shortest path on weighted graphs via priority queue (Dijkstra goal-directed variant). O((V + E) log V).
export function ucs(graph, source, target = null, { trace = false } = {}) {
  const n = graph.vertexCount;
  if (!Number.isInteger(source) || source < 0 || source >= n) throw new RangeError("Invalid source vertex");
  const distances = Array(n).fill(Infinity);
  const previous = Array(n).fill(null);
  const visited = new Uint8Array(n);
  const heap = new MinHeap((a, b) => a.cost - b.cost);
  const steps = [];
  let operations = 0;

  distances[source] = 0;
  heap.push({ vertex: source, cost: 0 });

  while (!heap.isEmpty) {
    const current = heap.pop();
    if (visited[current.vertex]) continue;
    visited[current.vertex] = 1;

    if (trace && steps.length < 5000) {
      steps.push({
        type: "visit",
        data: { vertex: current.vertex, cost: current.cost },
        cost: current.cost,
        note: `UCS expanded vertex ${current.vertex} with cumulative path cost ${current.cost.toFixed(2)}.`,
      });
    }

    if (target !== null && current.vertex === target) break;

    for (const edge of graph.neighbors(current.vertex)) {
      operations += 1;
      if (edge.weight < 0) throw new RangeError("UCS requires non-negative edge weights.");
      const candidateCost = current.cost + edge.weight;
      if (candidateCost < distances[edge.to]) {
        distances[edge.to] = candidateCost;
        previous[edge.to] = current.vertex;
        heap.push({ vertex: edge.to, cost: candidateCost });
        if (trace && steps.length < 5000) {
          steps.push({
            type: "relax",
            data: { from: current.vertex, to: edge.to, cost: candidateCost },
            cost: candidateCost,
            note: `UCS frontier reached vertex ${edge.to} with cost ${candidateCost.toFixed(2)}.`,
          });
        }
      }
    }
  }

  const path = target === null ? null : reconstructPath(previous, source, target, distances[target]);
  return { distances, previous, path, operations, trace: steps };
}

function reconstructPath(previous, source, target, distance) {
  if (!Number.isFinite(distance)) return [];
  const path = [];
  let current = target;
  while (current !== null) {
    path.push(current);
    if (current === source) break;
    current = previous[current];
  }
  return path.at(-1) === source ? path.reverse() : [];
}
