// Breadth-First Search (BFS): Computes shortest paths in terms of edge count (unweighted graph). O(V + E).
export function bfs(graph, source, target = null, { trace = false } = {}) {
  const n = graph.vertexCount;
  if (!Number.isInteger(source) || source < 0 || source >= n) throw new RangeError("Invalid source vertex");
  const distances = Array(n).fill(Infinity);
  const previous = Array(n).fill(null);
  const visited = new Uint8Array(n);
  const queue = [source];
  const steps = [];
  let operations = 0;

  distances[source] = 0;
  visited[source] = 1;
  if (trace) steps.push({ type: "visit", data: { vertex: source, distance: 0 }, cost: 0, note: `Discovered root vertex ${source} at level 0.` });

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    operations += 1;
    if (target !== null && current === target) break;

    for (const edge of graph.neighbors(current)) {
      operations += 1;
      if (!visited[edge.to]) {
        visited[edge.to] = 1;
        distances[edge.to] = distances[current] + (Number.isFinite(edge.weight) ? edge.weight : 1);
        previous[edge.to] = current;
        queue.push(edge.to);
        if (trace && steps.length < 5000) {
          steps.push({
            type: "relax",
            data: { from: current, to: edge.to, distance: distances[edge.to] },
            cost: distances[edge.to],
            note: `BFS discovered edge ${current} → ${edge.to}.`,
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
