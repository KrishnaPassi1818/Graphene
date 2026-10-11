import { MinHeap } from "../ds/MinHeap.js";
import { haversineKm } from "../util/haversine.js";

// A* ranks by g+h. Optimality follows when h is admissible (never overestimates the remaining distance).
export function astar(graph, source, target, { heuristic, points, trace = false } = {}) {
  if (!Number.isInteger(source) || !Number.isInteger(target)) throw new TypeError("source and target must be integer vertices");
  const h = heuristic ?? (points ? (vertex, goal) => haversineKm(points[vertex], points[goal]) : () => 0);
  const n = graph.vertexCount;
  const distances = Array(n).fill(Infinity);
  const previous = Array(n).fill(null);
  const closed = new Uint8Array(n);
  const frontier = new MinHeap((a, b) => a.priority - b.priority);
  const steps = [];
  let operations = 0;
  distances[source] = 0;
  frontier.push({ vertex: source, priority: h(source, target) });

  while (!frontier.isEmpty) {
    const current = frontier.pop();
    if (closed[current.vertex]) continue;
    closed[current.vertex] = 1;
    if (trace && steps.length < 5000) steps.push({ type: "visit", data: { vertex: current.vertex, g: distances[current.vertex], f: current.priority }, cost: distances[current.vertex], note: `Expanded ${current.vertex} using g + h priority.` });
    if (current.vertex === target) break;
    for (const edge of graph.neighbors(current.vertex)) {
      operations += 1;
      if (edge.weight < 0) throw new RangeError("A* requires non-negative edge weights.");
      const candidate = distances[current.vertex] + edge.weight;
      if (candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        previous[edge.to] = current.vertex;
        closed[edge.to] = 0;
        frontier.push({ vertex: edge.to, priority: candidate + h(edge.to, target) });
        if (trace && steps.length < 5000) steps.push({ type: "relax", data: { from: current.vertex, to: edge.to, g: candidate }, cost: candidate, note: `Updated ${edge.to}; estimated full path is ${ (candidate + h(edge.to, target)).toFixed(2) }.` });
      }
    }
  }

  const path = reconstructPath(previous, source, target, distances[target]);
  return { distance: distances[target], distances, previous, path, operations, trace: steps };
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
