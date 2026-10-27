import { Graph } from "../ds/Graph.js";
import { dijkstra } from "./dijkstra.js";
import { bellmanFord } from "./bellmanFord.js";
import { floydWarshall, reconstructFloydPath } from "./floydWarshall.js";
import { prims } from "./prims.js";
import { kruskal } from "./kruskal.js";
import { distanceMatrixFromPoints } from "../util/haversine.js";

/**
 * Evaluates Dijkstra, Prim's, Kruskal's, Bellman-Ford, and Floyd-Warshall on a given
 * scenario defined by stops/nodes and edges.
 *
 * Computes:
 * - Runtime (ms)
 * - Operations / comparison count
 * - Route cost / tree cost (km)
 * - Efficiency score (cost-to-op ratio & relative performance)
 * - Step-by-step trace for visualization
 * - Computed paths / MST edges
 *
 * @param {Object} scenario
 * @param {Array<{id: string|number, label: string, lat: number, lng: number}>} scenario.nodes
 * @param {Array<{from: number, to: number, weight?: number}>} [scenario.edges]
 * @param {number} [scenario.source=0]
 * @param {number} [scenario.target]
 * @returns {Object} Full comparison report and algorithm evaluation results
 */
export function evaluateShortestPathScenario({
  nodes = [],
  edges = null,
  source = 0,
  target = null,
  directed = false,
} = {}) {
  const n = nodes.length;
  if (n < 2) {
    throw new Error("Scenario requires at least 2 nodes");
  }

  const s = Math.max(0, Math.min(n - 1, Number.isInteger(source) ? source : 0));
  const t = Math.max(0, Math.min(n - 1, Number.isInteger(target) ? target : n - 1));

  // If edges are not explicitly provided, build a complete or sparse realistic metric graph
  const distMatrix = distanceMatrixFromPoints(nodes);
  let edgeList = [];

  if (Array.isArray(edges) && edges.length > 0) {
    edgeList = edges.map((e) => ({
      from: e.from,
      to: e.to,
      weight: Number.isFinite(e.weight) ? e.weight : distMatrix[e.from][e.to],
    }));
  } else {
    // Generate connected road network:
    // First, construct Minimum Spanning Tree backbone across all nodes to guarantee 100% connectivity.
    // Second, augment with k-nearest neighbors to provide realistic cyclic alternative arterial roads.
    const added = new Set();
    const addEdge = (u, v, w) => {
      const key = directed ? `${u}->${v}` : `${Math.min(u, v)}<->${Math.max(u, v)}`;
      if (!added.has(key)) {
        added.add(key);
        edgeList.push({ from: u, to: v, weight: Number(w.toFixed(2)) });
        if (!directed) {
          edgeList.push({ from: v, to: u, weight: Number(w.toFixed(2)) });
        }
      }
    };

    // Backbone MST on complete distance matrix
    const completeGraph = new Graph(n, { directed: false });
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        completeGraph.addEdge(i, j, distMatrix[i][j]);
        completeGraph.addEdge(j, i, distMatrix[i][j]);
      }
    }
    const backboneMst = prims(completeGraph, 0);
    for (const e of backboneMst.mstEdges) {
      addEdge(e.from, e.to, e.weight);
    }

    // Connect each node to k nearest neighbors
    const k = Math.min(n - 1, 4);
    for (let i = 0; i < n; i++) {
      const neighbors = [];
      for (let j = 0; j < n; j++) {
        if (i !== j) neighbors.push({ j, dist: distMatrix[i][j] });
      }
      neighbors.sort((a, b) => a.dist - b.dist);
      for (let m = 0; m < k; m++) {
        addEdge(i, neighbors[m].j, neighbors[m].dist);
      }
    }
  }

  // Construct Graph instance
  const graph = new Graph(n, { directed });
  for (const edge of edgeList) {
    graph.addEdge(edge.from, edge.to, edge.weight);
  }

  // Helper to accurately measure high-resolution time in browser or node
  const measure = (fn) => {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const res = fn();
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    return { res, timeMs: Math.max(0.01, Number((t1 - t0).toFixed(3))) };
  };

  // 1. Dijkstra
  const dijkstraRun = measure(() => dijkstra(graph, s, t, { trace: true }));
  const dijkstraResult = dijkstraRun.res;
  const dijkstraCost = dijkstraResult.distances[t];
  const dijkstraPath = dijkstraResult.path || [];

  // 2. Bellman-Ford
  const bfRun = measure(() => bellmanFord(n, edgeList, s, { trace: true }));
  const bfResult = bfRun.res;
  const bfCost = bfResult.distances[t];
  const bfPath = reconstructPathFromPrevious(bfResult.previous, s, t);

  // 3. Floyd-Warshall
  const matrix = Array.from({ length: n }, () => Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) matrix[i][i] = 0;
  for (const e of edgeList) {
    if (e.weight < matrix[e.from][e.to]) {
      matrix[e.from][e.to] = e.weight;
      if (!directed) matrix[e.to][e.from] = e.weight;
    }
  }
  const fwRun = measure(() => floydWarshall(matrix, { trace: true }));
  const fwResult = fwRun.res;
  const fwCost = fwResult.distances[s][t];
  const fwPath = reconstructFloydPath(fwResult.next, s, t);

  // 4. Prim's MST
  const primsRun = measure(() => prims(graph, s, { trace: true }));
  const primsResult = primsRun.res;

  // Derive shortest path over Prim's MST tree from s to t
  const primTreePath = findPathInTree(n, primsResult.mstEdges, s, t);

  // 5. Kruskal's MST
  const kruskalEdges = [];
  const seenUndirected = new Set();
  for (const e of edgeList) {
    const u = Math.min(e.from, e.to);
    const v = Math.max(e.from, e.to);
    const key = `${u}-${v}`;
    if (!seenUndirected.has(key)) {
      seenUndirected.add(key);
      kruskalEdges.push({ from: u, to: v, weight: e.weight });
    }
  }
  const kruskalRun = measure(() => kruskal(n, kruskalEdges, { trace: true }));
  const kruskalResult = kruskalRun.res;
  const kruskalTreePath = findPathInTree(n, kruskalResult.mstEdges, s, t);

  // Compile comparison entries
  const items = [
    {
      id: "dijkstra",
      name: "Dijkstra's Algorithm",
      type: "Single-Source Shortest Path (SSSP)",
      paradigm: "Greedy Priority Queue",
      timeComplexity: "O((V + E) log V)",
      spaceComplexity: "O(V)",
      runtimeMs: dijkstraRun.timeMs,
      operations: dijkstraResult.operations,
      costKm: Number.isFinite(dijkstraCost) ? Number(dijkstraCost.toFixed(2)) : null,
      path: dijkstraPath,
      edges: pathToEdges(dijkstraPath),
      trace: dijkstraResult.trace,
      guarantee: "Exact Shortest Path (non-negative)",
      isMst: false,
      pros: "Fastest single-pair/single-source exact shortest path on positive graphs.",
      cons: "Cannot handle negative edge weights; only explores outward from source.",
    },
    {
      id: "bellman-ford",
      name: "Bellman-Ford Algorithm",
      type: "Single-Source Shortest Path (SSSP)",
      paradigm: "Dynamic Edge Relaxation",
      timeComplexity: "O(V · E)",
      spaceComplexity: "O(V)",
      runtimeMs: bfRun.timeMs,
      operations: bfResult.operations,
      costKm: Number.isFinite(bfCost) ? Number(bfCost.toFixed(2)) : null,
      path: bfPath,
      edges: pathToEdges(bfPath),
      trace: bfResult.trace,
      guarantee: "Exact Shortest Path (supports negative weights & detects negative cycles)",
      isMst: false,
      pros: "Safely handles negative edge costs; detects unreachable/negative cycles.",
      cons: "Higher time complexity O(VE), significantly slower on dense graphs.",
    },
    {
      id: "floyd-warshall",
      name: "Floyd-Warshall Algorithm",
      type: "All-Pairs Shortest Path (APSP)",
      paradigm: "Dynamic Programming",
      timeComplexity: "O(V³)",
      spaceComplexity: "O(V²)",
      runtimeMs: fwRun.timeMs,
      operations: fwResult.operations,
      costKm: Number.isFinite(fwCost) ? Number(fwCost.toFixed(2)) : null,
      path: fwPath,
      edges: pathToEdges(fwPath),
      trace: fwResult.trace,
      guarantee: "All-Pairs Exact Shortest Paths",
      isMst: false,
      pros: "Finds shortest paths between all pairs of nodes simultaneously in one DP pass.",
      cons: "Cubic time O(V³) makes it infeasible for large networks (> 300 nodes).",
    },
    {
      id: "prims",
      name: "Prim's Algorithm",
      type: "Minimum Spanning Tree (MST)",
      paradigm: "Greedy Cut Vertex Growth",
      timeComplexity: "O((V + E) log V)",
      spaceComplexity: "O(V + E)",
      runtimeMs: primsRun.timeMs,
      operations: primsResult.operations,
      costKm: Number(primsResult.totalWeight.toFixed(2)),
      treeCostKm: Number(primsResult.totalWeight.toFixed(2)),
      pathCostKm: Number.isFinite(primTreePath.cost) ? Number(primTreePath.cost.toFixed(2)) : null,
      path: primTreePath.path,
      edges: primsResult.mstEdges,
      trace: primsResult.trace,
      guarantee: "Global Minimum Spanning Tree",
      isMst: true,
      pros: "Optimal global network wiring/infrastructure; tree route avoids redundant loops.",
      cons: "Minimizes global tree weight, not point-to-point shortest travel distance.",
    },
    {
      id: "kruskal",
      name: "Kruskal's Algorithm",
      type: "Minimum Spanning Tree (MST)",
      paradigm: "Greedy Edge Sorting + DSU",
      timeComplexity: "O(E log E)",
      spaceComplexity: "O(V + E)",
      runtimeMs: kruskalRun.timeMs,
      operations: kruskalResult.operations,
      costKm: Number(kruskalResult.totalWeight.toFixed(2)),
      treeCostKm: Number(kruskalResult.totalWeight.toFixed(2)),
      pathCostKm: Number.isFinite(kruskalTreePath.cost) ? Number(kruskalTreePath.cost.toFixed(2)) : null,
      path: kruskalTreePath.path,
      edges: kruskalResult.mstEdges,
      trace: kruskalResult.trace,
      guarantee: "Global Minimum Spanning Tree",
      isMst: true,
      pros: "Excellent for sparse networks; simple disjoint set cycle-avoidance logic.",
      cons: "Requires sorting all edges; not designed for single point-to-point shortest transit.",
    },
  ];

  // Calculate efficiency scores (0 - 100)
  // Factors: normalized speed (faster = higher), operation economy, cost optimality
  const minOps = Math.min(...items.map((i) => i.operations || 1));
  const minTime = Math.min(...items.map((i) => i.runtimeMs || 0.01));

  items.forEach((item) => {
    const timeScore = Math.max(10, 100 - ((item.runtimeMs - minTime) / (minTime * 5 + 0.1)) * 50);
    const opScore = Math.max(10, 100 - ((item.operations - minOps) / (minOps * 4 + 1)) * 50);
    item.efficiencyScore = Math.min(100, Math.max(15, Math.round(timeScore * 0.5 + opScore * 0.5)));
  });

  return {
    scenario: {
      nodeCount: n,
      edgeCount: edgeList.length,
      source: s,
      target: t,
      sourceLabel: nodes[s]?.label || `Node ${s}`,
      targetLabel: nodes[t]?.label || `Node ${t}`,
      nodes,
      edges: edgeList,
    },
    results: items,
    optimalShortestDistance: Number.isFinite(dijkstraCost) ? Number(dijkstraCost.toFixed(2)) : null,
    generatedAt: new Date().toISOString(),
  };
}

function pathToEdges(path) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const edges = [];
  for (let i = 0; i < path.length - 1; i++) {
    edges.push({ from: path[i], to: path[i + 1] });
  }
  return edges;
}

function reconstructPathFromPrevious(previous, source, target) {
  const path = [];
  let current = target;
  let guard = 0;
  while (current !== null && guard <= previous.length) {
    path.push(current);
    if (current === source) break;
    current = previous[current];
    guard += 1;
  }
  return path.at(-1) === source ? path.reverse() : [];
}

function findPathInTree(n, mstEdges, source, target) {
  if (source === target) return { path: [source], cost: 0 };
  const adj = Array.from({ length: n }, () => []);
  for (const edge of mstEdges) {
    adj[edge.from].push({ to: edge.to, weight: edge.weight });
    adj[edge.to].push({ to: edge.from, weight: edge.weight });
  }

  const queue = [{ node: source, path: [source], cost: 0 }];
  const visited = new Uint8Array(n);
  visited[source] = 1;

  while (queue.length > 0) {
    const { node, path, cost } = queue.shift();
    if (node === target) return { path, cost };

    for (const neighbor of adj[node]) {
      if (!visited[neighbor.to]) {
        visited[neighbor.to] = 1;
        queue.push({
          node: neighbor.to,
          path: [...path, neighbor.to],
          cost: cost + neighbor.weight,
        });
      }
    }
  }

  return { path: [], cost: Infinity };
}
