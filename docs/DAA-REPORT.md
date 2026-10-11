# DAA report and viva notes

## Problem model

Let the depot be vertex 0 and delivery stops be vertices 1…n. The complete metric graph has non-negative Haversine weights `d(i,j)`. A route begins and ends at 0; each customer appears once; the sum of demands on a route cannot exceed vehicle capacity. Optional time windows constrain service start. The primary objective is to minimize total route distance.

The single-vehicle problem contains TSP as a special case. CVRP is therefore NP-hard. Exact enumeration grows as `O(n!)`; Held–Karp uses subset dynamic programming in `O(n² 2ⁿ)` time and `O(n 2ⁿ)` space, which is still exponential.

## Algorithms implemented

| Family | Algorithms | Main idea |
|---|---|---|
| Shortest paths | Dijkstra, A*, Bellman–Ford, Floyd–Warshall | Greedy frontier, admissible heuristic, edge relaxation, and all-pairs DP |
| Exact TSP | Brute force, branch-and-bound, Held–Karp | Permutations, admissible lower bounds, and bitmask DP |
| Tour heuristics | Nearest neighbor, MST preorder 2-approx | Greedy extension and metric-MST doubling/shortcutting |
| Improvement | 2-opt, Or-opt, simulated annealing | Local edge exchange, segment relocation, temperature-controlled acceptance |
| CVRP | Sweep, K-means + capacity repair, Clarke–Wright savings | Geometric grouping and route merging under capacity |

See `docs/ALGORITHMS.md` for invariants, complexity, and solver limits.

## Experiment protocol

Use the seeded synthetic instance generator so coordinates, demands and random moves can be reproduced. For small n, compute exact Held–Karp cost as a baseline and report gap:

`gap % = 100 × (heuristic cost − optimal cost) / optimal cost`.

Record runtime and explicit operation count separately; elapsed time depends on hardware and runtime warm-up, while the counter is deterministic. A useful benchmark should record Node version, OS, stop count, seed, vehicle capacity, vehicle count, algorithm, runtime and objective cost.

## Viva answers

- **Why is TSP NP-hard?** A polynomial TSP optimizer would solve the NP-hard Hamiltonian-cycle decision problem; CVRP includes TSP when there is one vehicle with enough capacity.
- **Why does Dijkstra fail with negative edges?** Its greedy finalization assumes a settled distance cannot later improve. A negative edge can invalidate that assumption; Bellman–Ford handles negative weights and detects negative cycles.
- **How does Held–Karp help?** It stores the best route for each visited subset and final city, reusing overlapping subproblems instead of enumerating all permutations.
- **Why is MST preorder at most 2× optimal?** For a metric distance, doubling the optimal tour gives a connected Eulerian walk of cost 2OPT; an MST is no more expensive than that tour, and triangle-inequality shortcutting cannot increase cost.
- **How does simulated annealing escape a local optimum?** Early in the schedule it accepts some uphill moves with probability `exp(−Δ/T)`; as temperature falls it becomes increasingly greedy.
- **Why a binary heap?** It is simple, compact and predictable with `O(log V)` updates; Fibonacci heaps improve amortized bounds but have larger constants and implementation complexity.
