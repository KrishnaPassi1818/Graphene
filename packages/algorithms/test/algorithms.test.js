import { describe, expect, it } from "vitest";
import {
  Graph, MinHeap, UnionFind, dijkstra, ucs, bfs, bellmanFord, floydWarshall, yenKShortestPaths,
  prims, kruskal, evaluateShortestPathScenario,
  bruteForceTsp, branchBoundTsp, nearestNeighborTsp, mstTwoApproxTsp,
  solveOptimization, DEMO_INSTANCE,
} from "../src/index.js";

const classic = [
  [0, 10, 15, 20],
  [10, 0, 35, 25],
  [15, 35, 0, 30],
  [20, 25, 30, 0],
];

describe("manual data structures", () => {
  it("keeps binary min-heap order", () => {
    const heap = new MinHeap((a, b) => a - b);
    [7, 2, 9, 1, 4].forEach((item) => heap.push(item));
    expect(Array.from({ length: 5 }, () => heap.pop())).toEqual([1, 2, 4, 7, 9]);
    expect(heap.pop()).toBeUndefined();
  });

  it("unites sets and compresses their representatives", () => {
    const sets = new UnionFind(5);
    expect(sets.union(0, 1)).toBe(true);
    expect(sets.union(1, 2)).toBe(true);
    expect(sets.union(0, 2)).toBe(false);
    expect(sets.find(0)).toBe(sets.find(2));
    expect(sets.components).toBe(3);
  });
});

describe("shortest paths", () => {
  const graph = new Graph(5).addEdge(0, 1, 4).addEdge(0, 2, 1).addEdge(2, 1, 2).addEdge(1, 3, 1).addEdge(2, 3, 5).addEdge(3, 4, 3);

  it("uses heap Dijkstra with a shortest route", () => {
    const result = dijkstra(graph, 0, 4);
    expect(result.distances[4]).toBe(7);
    expect(result.path).toEqual([0, 2, 1, 3, 4]);
  });

  it("uses Uniform Cost Search (UCS) with exact cost priority", () => {
    const result = ucs(graph, 0, 4);
    expect(result.distances[4]).toBe(7);
    expect(result.path).toEqual([0, 2, 1, 3, 4]);
  });

  it("uses Breadth-First Search (BFS) for hop/level-order traversal", () => {
    // Unweighted hop distance: 0 -> 1 -> 3 -> 4 (3 hops) or 0 -> 2 -> 3 -> 4 (3 hops)
    const unweighted = new Graph(5).addEdge(0, 1, 1).addEdge(0, 2, 1).addEdge(2, 1, 1).addEdge(1, 3, 1).addEdge(2, 3, 1).addEdge(3, 4, 1);
    const result = bfs(unweighted, 0, 4);
    expect(result.distances[4]).toBe(3);
    expect(result.path.length).toBe(4);
  });

  it("matches Bellman–Ford and reports negative cycles", () => {
    const edges = [{ from: 0, to: 1, weight: 4 }, { from: 0, to: 2, weight: 5 }, { from: 1, to: 2, weight: -2 }, { from: 2, to: 3, weight: 3 }];
    expect(bellmanFord(4, edges, 0).distances).toEqual([0, 4, 2, 5]);
    const cycle = bellmanFord(3, [{ from: 0, to: 1, weight: 1 }, { from: 1, to: 2, weight: -3 }, { from: 2, to: 0, weight: 1 }], 0);
    expect(cycle.hasNegativeCycle).toBe(true);
  });

  it("computes all-pairs shortest distances via Floyd-Warshall", () => {
    const result = floydWarshall([[0, 3, Infinity], [Infinity, 0, 2], [4, Infinity, 0]]);
    expect(result.distances[0][2]).toBe(5);
    expect(result.distances[1][0]).toBe(6);
  });

  it("computes Yen’s K-Shortest Paths", () => {
    // 0 -> 1 -> 3 -> 4 (cost: 4 + 1 + 3 = 8)
    // 0 -> 2 -> 1 -> 3 -> 4 (cost: 1 + 2 + 1 + 3 = 7, 1st shortest)
    // 0 -> 2 -> 3 -> 4 (cost: 1 + 5 + 3 = 9)
    const result = yenKShortestPaths(graph, 0, 4, 3);
    expect(result.paths.length).toBe(3);
    expect(result.paths[0].distance).toBe(7);
    expect(result.paths[0].path).toEqual([0, 2, 1, 3, 4]);
    expect(result.paths[1].distance).toBe(8);
    expect(result.paths[1].path).toEqual([0, 1, 3, 4]);
    expect(result.paths[2].distance).toBe(9);
    expect(result.paths[2].path).toEqual([0, 2, 3, 4]);
  });

  it("computes Minimum Spanning Tree via Prim's algorithm", () => {
    // MST for graph with vertices 0..4
    const primResult = prims(graph, 0, { trace: true });
    expect(primResult.mstEdges.length).toBe(4);
    // Weights: (0,2)=1, (2,1)=2, (1,3)=1, (3,4)=3 => Total = 7
    expect(primResult.totalWeight).toBe(7);
    expect(primResult.trace.length).toBeGreaterThan(0);
  });

  it("computes Minimum Spanning Tree via Kruskal's algorithm", () => {
    const edges = [
      { from: 0, to: 1, weight: 4 },
      { from: 0, to: 2, weight: 1 },
      { from: 2, to: 1, weight: 2 },
      { from: 1, to: 3, weight: 1 },
      { from: 2, to: 3, weight: 5 },
      { from: 3, to: 4, weight: 3 },
    ];
    const kruskalResult = kruskal(5, edges, { trace: true });
    expect(kruskalResult.mstEdges.length).toBe(4);
    expect(kruskalResult.totalWeight).toBe(7);
    expect(kruskalResult.trace.length).toBeGreaterThan(0);
  });
});

describe("TSP solvers", () => {
  it("agrees across exact solvers on a known four-city optimum", () => {
    for (const solve of [bruteForceTsp, branchBoundTsp]) {
      const result = solve(classic);
      expect(result.cost).toBe(80);
      expect(result.route[0]).toBe(0);
      expect(result.route.at(-1)).toBe(0);
      expect(new Set(result.route.slice(1, -1))).toEqual(new Set([1, 2, 3]));
    }
  });

  it("nearest neighbour and MST 2-approx solvers produce valid tours", () => {
    const greedy = nearestNeighborTsp(classic);
    expect(greedy.route).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    const mst = mstTwoApproxTsp(classic);
    expect(mst.route[0]).toBe(0);
    expect(mst.route.at(-1)).toBe(0);
    expect(mst.cost).toBeLessThanOrEqual(100 + 1e-8);
  });
});

describe("CVRP solver contract", () => {
  it("returns capacity-feasible, complete routes for each allowed route algorithm", () => {
    const data = structuredClone(DEMO_INSTANCE);
    const algorithms = [
      "nearest-neighbor",
      "mst-2approx",
      "kmeans",
      "branch-and-bound",
      "brute-force",
      "sweep",
    ];
    for (const algorithm of algorithms) {
      const result = solveOptimization({ depot: data.depot, stops: data.stops, vehicles: data.fleet.vehicles, capacity: data.fleet.capacity, algorithm, options: { seed: 42, trace: true } });
      expect(result.routes.length).toBeLessThanOrEqual(data.fleet.vehicles);
      expect(result.validation.valid, `${algorithm}: ${JSON.stringify(result.validation.violations)}`).toBe(true);
      expect(result.routes.flatMap((route) => route.slice(1, -1)).sort((a, b) => a - b)).toEqual(data.stops.map((_, index) => index + 1));
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.trace.length).toBeLessThanOrEqual(5001);
    }
  });

  it("rejects impossible fleet capacity rather than dropping stops", () => {
    const data = structuredClone(DEMO_INSTANCE);
    expect(() => solveOptimization({ depot: data.depot, stops: data.stops, vehicles: 1, capacity: 5, algorithm: "nearest-neighbor" })).toThrow(/insufficient/i);
  });
});

describe("Shortest Path & MST Scenario Evaluator", () => {
  it("evaluates Dijkstra, Prim's, Kruskal's, Bellman-Ford, and Floyd-Warshall together on a scenario", () => {
    const nodes = [
      { id: "depot", label: "Depot", lat: 30.9004, lng: 75.8573 },
      { id: "S-1", label: "Stop 1", lat: 30.9100, lng: 75.8600 },
      { id: "S-2", label: "Stop 2", lat: 30.8950, lng: 75.8700 },
      { id: "S-3", label: "Stop 3", lat: 30.9200, lng: 75.8450 },
    ];
    const report = evaluateShortestPathScenario({ nodes, source: 0, target: 3 });
    expect(report.results.length).toBe(5);
    const algos = report.results.map((r) => r.id);
    expect(algos).toContain("dijkstra");
    expect(algos).toContain("prims");
    expect(algos).toContain("kruskal");
    expect(algos).toContain("bellman-ford");
    expect(algos).toContain("floyd-warshall");

    // All should produce cost or distance metrics and trace steps
    report.results.forEach((res) => {
      expect(res.operations).toBeGreaterThan(0);
      expect(res.runtimeMs).toBeGreaterThan(0);
      expect(res.costKm).toBeGreaterThan(0);
      expect(res.trace.length).toBeGreaterThan(0);
    });
  });
});
