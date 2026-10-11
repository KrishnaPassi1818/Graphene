import { MinHeap } from "../ds/MinHeap.js";

// Greedy label-setting: a min-heap always finalizes the cheapest unsettled vertex. Requires non-negative edges.
export function dijkstra(graph, source, target = null, { trace = false } = {}) {
  const n = graph.vertexCount;
  if (!Number.isInteger(source) || source < 0 || source >= n) throw new RangeError("Invalid source vertex");
  const distances = Array(n).fill(Infinity);
  const previous = Array(n).fill(null);
  const settled = new Uint8Array(n);
  const heap = new MinHeap((a, b) => a.priority - b.priority);
  const steps = [];
  let operations = 0;
  distances[source] = 0;
  heap.push({ vertex: source, priority: 0 });

  while (!heap.isEmpty) {
    const current = heap.pop();
    if (settled[current.vertex] || current.priority > distances[current.vertex]) continue;
    settled[current.vertex] = 1;
    if (trace && steps.length < 5000) steps.push({ type: "visit", data: { vertex: current.vertex, distance: distances[current.vertex] }, cost: distances[current.vertex], note: `Settled vertex ${current.vertex} at its shortest known distance.` });
    if (target !== null && current.vertex === target) break;
    for (const edge of graph.neighbors(current.vertex)) {
      operations += 1;
      if (edge.weight < 0) throw new RangeError("Dijkstra requires non-negative edge weights; use Bellman–Ford instead.");
      const candidate = distances[current.vertex] + edge.weight;
      if (candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        previous[edge.to] = current.vertex;
        heap.push({ vertex: edge.to, priority: candidate });
        if (trace && steps.length < 5000) steps.push({ type: "relax", data: { from: current.vertex, to: edge.to, distance: candidate }, cost: candidate, note: `Relaxed edge ${current.vertex} → ${edge.to}.` });
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
