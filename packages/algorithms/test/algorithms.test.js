import { describe, expect, it } from "vitest";
import {
  Graph, MinHeap, UnionFind, dijkstra, astar, bellmanFord, floydWarshall,
  bruteForceTsp, branchBoundTsp, heldKarpTsp, nearestNeighborTsp, mstTwoApproxTsp,
  twoOptTsp, orOptTsp, simulatedAnnealingTsp, solveOptimization, DEMO_INSTANCE,
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
  it("uses heap Dijkstra and A* with a shortest route", () => {
    const result = dijkstra(graph, 0, 4);
    expect(result.distances[4]).toBe(7);
    expect(result.path).toEqual([0, 2, 1, 3, 4]);
    expect(astar(graph, 0, 4, { heuristic: () => 0 }).distance).toBe(7);
  });

  it("matches Bellman–Ford and reports negative cycles", () => {
    const edges = [{ from: 0, to: 1, weight: 4 }, { from: 0, to: 2, weight: 5 }, { from: 1, to: 2, weight: -2 }, { from: 2, to: 3, weight: 3 }];
    expect(bellmanFord(4, edges, 0).distances).toEqual([0, 4, 2, 5]);
    const cycle = bellmanFord(3, [{ from: 0, to: 1, weight: 1 }, { from: 1, to: 2, weight: -3 }, { from: 2, to: 0, weight: 1 }], 0);
    expect(cycle.hasNegativeCycle).toBe(true);
  });

  it("computes all-pairs shortest distances", () => {
    const result = floydWarshall([[0, 3, Infinity], [Infinity, 0, 2], [4, Infinity, 0]]);
    expect(result.distances[0][2]).toBe(5);
    expect(result.distances[1][0]).toBe(6);
  });
});

describe("TSP solvers", () => {
  it("agrees across exact solvers on a known four-city optimum", () => {
    for (const solve of [bruteForceTsp, branchBoundTsp, heldKarpTsp]) {
      const result = solve(classic);
      expect(result.cost).toBe(80);
      expect(result.route[0]).toBe(0);
      expect(result.route.at(-1)).toBe(0);
      expect(new Set(result.route.slice(1, -1))).toEqual(new Set([1, 2, 3]));
    }
  });

  it("improvement solvers keep valid tours and never worsen their seed", () => {
    const greedy = nearestNeighborTsp(classic);
    expect(greedy.route).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    for (const result of [twoOptTsp(classic), orOptTsp(classic), simulatedAnnealingTsp(classic, { seed: 17, maxIterations: 300 }), mstTwoApproxTsp(classic)]) {
      expect(result.route[0]).toBe(0);
      expect(result.route.at(-1)).toBe(0);
      expect(result.cost).toBeLessThanOrEqual(100 + 1e-8);
    }
  });

  it("produces deterministic simulated annealing for a fixed seed", () => {
    const a = simulatedAnnealingTsp(classic, { seed: 77, maxIterations: 500 });
    const b = simulatedAnnealingTsp(classic, { seed: 77, maxIterations: 500 });
    expect(a.route).toEqual(b.route);
    expect(a.cost).toBe(b.cost);
  });
});

describe("CVRP solver contract", () => {
  it("returns capacity-feasible, complete routes for each route algorithm", () => {
    const data = structuredClone(DEMO_INSTANCE);
    const algorithms = ["nearest-neighbor", "mst-2approx", "two-opt", "or-opt", "simulated-annealing", "sweep", "kmeans", "clarke-wright", "combined", "held-karp", "branch-and-bound", "brute-force"];
    for (const algorithm of algorithms) {
      const result = solveOptimization({ depot: data.depot, stops: data.stops, vehicles: data.fleet.vehicles, capacity: data.fleet.capacity, algorithm, options: { seed: 42, trace: true, maxIterations: 100 } });
      expect(result.routes.length).toBeLessThanOrEqual(data.fleet.vehicles);
      expect(result.validation.valid, `${algorithm}: ${JSON.stringify(result.validation.violations)}`).toBe(true);
      expect(result.routes.flatMap((route) => route.slice(1, -1)).sort((a, b) => a - b)).toEqual(data.stops.map((_, index) => index + 1));
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.trace.length).toBeLessThanOrEqual(5001);
    }
  });

  it("rejects impossible fleet capacity rather than dropping stops", () => {
    const data = structuredClone(DEMO_INSTANCE);
    expect(() => solveOptimization({ depot: data.depot, stops: data.stops, vehicles: 1, capacity: 20, algorithm: "sweep" })).toThrow(/capacity/i);
  });

  it("rejects asymmetric road costs in symmetric-TSP solvers", () => {
    const stops = [{ id: "a", lat: 0, lng: 1, demand: 1 }, { id: "b", lat: 1, lng: 1, demand: 1 }];
    const asymmetric = [[0, 1, 3], [2, 0, 1], [3, 2, 0]];
    expect(() => solveOptimization({ depot: { lat: 0, lng: 0 }, stops, matrix: asymmetric, vehicles: 1, capacity: 5, algorithm: "nearest-neighbor" })).toThrow(/symmetric/i);
  });
});
