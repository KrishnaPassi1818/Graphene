# Algorithm catalog and implementation notes

The algorithm package is pure ESM JavaScript. All route solvers take a distance matrix and plain arrays, use a deterministic seed when randomness is needed, and return a common solution shape. The web/API layer is intentionally outside this package.

## Shared route contract

```js
{
  routes: [[0, 3, 1, 0], [0, 2, 4, 0]],
  totalCost: 42.5,             // kilometres
  perRouteCost: [21.3, 21.2],
  loads: [38, 44],
  stats: { runtimeMs, operations, iterations },
  trace: [{ type, data, cost, note }]
}
```

Index 0 is always the depot. Every stop index 1…n must appear exactly once. `validateSolution` checks coverage, depot closure, capacity and any supplied time windows.

## Data structures and graph routines

- `MinHeap`: array-backed binary min-heap (`O(log n)` push/pop), used by Dijkstra and A*.
- `UnionFind`: path compression + union by rank (`O(α(n))` amortized), used in savings/MST support.
- `Graph`: adjacency list with explicit directed/undirected edges.
- Dijkstra: `O((V+E) log V)` with binary heap; requires non-negative weights.
- A*: same heap structure; optimal with an admissible heuristic.
- Bellman–Ford: `O(VE)`, supports negative edges and detects negative cycles.
- Floyd–Warshall: `O(V³)` time and `O(V²)` space.

## TSP and route improvement

- Brute force: fix depot, enumerate permutations; exact, `O(n!)`, capped at 10 stops.
- Branch-and-bound: DFS with an admissible optimistic outgoing-edge bound; exact, `O(n² n!)` worst case here because each search node computes an `O(n²)` bound; capped at 15 stops.
- Held–Karp: `DP[mask,last] = min(DP[mask\{last},prev] + d(prev,last))`; exact `O(n² 2ⁿ)` time and `O(n 2ⁿ)` space, capped at 18.
- Nearest neighbor: repeatedly select the nearest unvisited stop; `O(n²)`.
- MST 2-approx: Prim then DFS preorder and metric shortcutting; `O(n²)` for the matrix representation, requires a symmetric metric.
- 2-opt: replace crossing edges when the two-edge delta is negative; each pass is `O(n²)`.
- Or-opt: relocate short (1–3 stop) segments when distance decreases.
- Simulated annealing: seeded 2-opt neighborhood, accepting uphill moves by `exp(−Δ/T)`; runtime is `O(iterations × n)` in this implementation.

## CVRP and time windows

- Sweep: sort polar angles from the depot, then split on capacity.
- K-means: deterministic seeded centroids and capacity-constrained assignment; `O(n log n + tkn)` for t centroid passes, with a greedy packing step that may report infeasible when the selected fleet cannot pack the loads.
- Clarke–Wright: sort `s(i,j)=d(0,i)+d(0,j)−d(i,j)` and merge endpoint-compatible routes only when capacity remains feasible.
- Route evaluation: computes load, distance, estimated arrival/service schedule, and time-window violations. Travel time uses a configurable average speed in the service layer.

## Numerical and operational notes

- Distances are great-circle kilometres; a road-network adapter can supply a replacement matrix without changing solvers.
- Route matrices must be square, finite, non-negative, symmetric and zero on the diagonal; asymmetric road-network costs require a directed-routing adapter rather than these symmetric TSP heuristics. Bellman–Ford operates directly on edge lists when negative edges are required.
- Exact solvers have explicit n limits; do not raise these limits casually. A worker timeout is a safety boundary, not an algorithmic speedup.
- Trace collection is optional and capped (default 5,000 steps) to keep API payloads safe.
