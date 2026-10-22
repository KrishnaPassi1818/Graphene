import { MinHeap } from "../ds/MinHeap.js";

// Yen's algorithm finds the top K loopless shortest paths using any shortest-path solver (e.g. Dijkstra).
// Complexity: O(K * V * (E + V log V)).
export function yenKShortestPaths(graph, source, target, K = 3, { trace = false } = {}) {
  const n = graph.vertexCount;
  if (!Number.isInteger(source) || source < 0 || source >= n) throw new RangeError("Invalid source vertex");
  if (!Number.isInteger(target) || target < 0 || target >= n) throw new RangeError("Invalid target vertex");
  if (K < 1) throw new RangeError("K must be at least 1");

  const steps = [];
  let operations = 0;

  // Helper Dijkstra on filtered edges/vertices
  function dijkstraFiltered(src, dst, removedEdges, removedVertices) {
    const dist = Array(n).fill(Infinity);
    const prev = Array(n).fill(null);
    const settled = new Uint8Array(n);
    const heap = new MinHeap((a, b) => a.priority - b.priority);

    dist[src] = 0;
    heap.push({ vertex: src, priority: 0 });

    while (!heap.isEmpty) {
      const cur = heap.pop();
      if (settled[cur.vertex] || cur.priority > dist[cur.vertex]) continue;
      settled[cur.vertex] = 1;
      if (cur.vertex === dst) break;

      for (const edge of graph.neighbors(cur.vertex)) {
        operations += 1;
        if (removedVertices.has(edge.to)) continue;
        const edgeKey = `${cur.vertex}->${edge.to}`;
        if (removedEdges.has(edgeKey)) continue;

        const candidate = dist[cur.vertex] + edge.weight;
        if (candidate < dist[edge.to]) {
          dist[edge.to] = candidate;
          prev[edge.to] = cur.vertex;
          heap.push({ vertex: edge.to, priority: candidate });
        }
      }
    }

    if (!Number.isFinite(dist[dst])) return null;
    const path = [];
    let curr = dst;
    while (curr !== null) {
      path.push(curr);
      if (curr === src) break;
      curr = prev[curr];
    }
    return { path: path.reverse(), distance: dist[dst] };
  }

  function pathCost(p) {
    let cost = 0;
    for (let i = 0; i < p.length - 1; i += 1) {
      const u = p[i];
      const v = p[i + 1];
      const edge = graph.neighbors(u).find((e) => e.to === v);
      cost += edge ? edge.weight : 0;
    }
    return cost;
  }

  const initial = dijkstraFiltered(source, target, new Set(), new Set());
  if (!initial) {
    return { paths: [], operations, trace: steps };
  }

  const A = [initial]; // Array of { path, distance }
  const B = []; // Potential kth shortest paths

  if (trace) {
    steps.push({
      type: "found-path",
      data: { k: 1, path: initial.path, distance: initial.distance },
      cost: initial.distance,
      note: `Yen's 1st shortest path: [${initial.path.join(" → ")}] (cost: ${initial.distance.toFixed(2)})`,
    });
  }

  for (let k = 1; k < K; k += 1) {
    const prevPath = A[k - 1].path;

    for (let i = 0; i <= prevPath.length - 2; i += 1) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);

      const removedEdges = new Set();
      for (const p of A) {
        if (p.path.length > i && rootPath.every((node, idx) => node === p.path[idx])) {
          removedEdges.add(`${p.path[i]}->${p.path[i + 1]}`);
        }
      }

      const removedVertices = new Set(rootPath.slice(0, -1));

      const spurResult = dijkstraFiltered(spurNode, target, removedEdges, removedVertices);

      if (spurResult) {
        const totalPath = [...rootPath.slice(0, -1), ...spurResult.path];
        const dist = pathCost(totalPath);
        const pathStr = totalPath.join(",");
        if (!B.some((candidate) => candidate.path.join(",") === pathStr) && !A.some((p) => p.path.join(",") === pathStr)) {
          B.push({ path: totalPath, distance: dist });
        }
      }
    }

    if (B.length === 0) break;

    B.sort((a, b) => a.distance - b.distance);
    const nextBest = B.shift();
    A.push(nextBest);

    if (trace && steps.length < 5000) {
      steps.push({
        type: "found-path",
        data: { k: A.length, path: nextBest.path, distance: nextBest.distance },
        cost: nextBest.distance,
        note: `Yen's ${A.length}-th shortest path: [${nextBest.path.join(" → ")}] (cost: ${nextBest.distance.toFixed(2)})`,
      });
    }
  }

  return { paths: A, operations, trace: steps };
}
