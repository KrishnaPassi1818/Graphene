export const ALGORITHM_REGISTRY = Object.freeze([
  { id: "dijkstra", name: "Dijkstra", category: "Shortest path", paradigm: "Greedy", complexity: "O((V + E) log V)", space: "O(V)", exact: true, description: "Settles the closest frontier vertex using a binary min-heap. Requires non-negative weights." },
  { id: "astar", name: "A* search", category: "Shortest path", paradigm: "Informed search", complexity: "O(E) typical; exponential worst case", space: "O(V)", exact: true, description: "Prioritizes g + h; an admissible geographic heuristic preserves shortest-path optimality." },
  { id: "bellman-ford", name: "Bellman–Ford", category: "Shortest path", paradigm: "Dynamic relaxation", complexity: "O(VE)", space: "O(V)", exact: true, description: "Relaxes every edge and detects negative-weight cycles." },
  { id: "floyd-warshall", name: "Floyd–Warshall", category: "All-pairs paths", paradigm: "Dynamic programming", complexity: "O(V³)", space: "O(V²)", exact: true, description: "Builds all-pairs shortest distances by considering each vertex as an intermediate." },
  { id: "brute-force", name: "Brute force", category: "TSP", paradigm: "Enumeration", complexity: "O(n!)", space: "O(n)", exact: true, maxN: 10, description: "Enumerates depot-rooted tours; a transparent exact baseline for very small stop sets." },
  { id: "branch-and-bound", name: "Branch & bound", category: "TSP", paradigm: "Backtracking / pruning", complexity: "O(n² n!) worst case", space: "O(n)", exact: true, maxN: 15, description: "DFS with a relaxed outgoing-edge lower bound prunes branches that cannot beat the incumbent." },
  { id: "held-karp", name: "Held–Karp DP", category: "TSP", paradigm: "Dynamic programming", complexity: "O(n² 2ⁿ)", space: "O(n 2ⁿ)", exact: true, maxN: 18, description: "Bitmask DP reuses optimal subpaths; exact for the ordering of each capacity-feasible route." },
  { id: "nearest-neighbor", name: "Nearest neighbor", category: "TSP / CVRP", paradigm: "Greedy", complexity: "O(n²)", space: "O(n)", exact: false, description: "Repeatedly visits the nearest unserved stop; clusters are capacity-split before routing." },
  { id: "mst-2approx", name: "MST 2-approx", category: "Metric TSP", paradigm: "Approximation", complexity: "O(n²)", space: "O(n)", exact: false, approximation: "2-approx for metric TSP", description: "Prim MST + preorder shortcut; the metric triangle inequality bounds the tour by 2×OPT." },
  { id: "two-opt", name: "2-opt local search", category: "Improvement", paradigm: "Local search", complexity: "O(n²) per pass", space: "O(n)", exact: false, description: "Removes crossing/expensive edge pairs and reconnects the tour when cost improves." },
  { id: "or-opt", name: "Or-opt relocation", category: "Improvement", paradigm: "Local search", complexity: "O(n³) per pass", space: "O(n)", exact: false, description: "Relocates short consecutive customer segments to lower-cost insertion points." },
  { id: "simulated-annealing", name: "Simulated annealing", category: "Metaheuristic", paradigm: "Metaheuristic", complexity: "O(iterations × n)", space: "O(n)", exact: false, description: "Seeded 2-opt neighborhood search that probabilistically accepts uphill moves early on." },
  { id: "sweep", name: "Sweep clustering", category: "CVRP", paradigm: "Greedy / geometry", complexity: "O(n log n) + route TSP", space: "O(n)", exact: false, description: "Sorts stops by polar angle around the depot and splits clusters at vehicle capacity." },
  { id: "kmeans", name: "Capacity-constrained K-means", category: "CVRP", paradigm: "Clustering", complexity: "O(n log n + t k n)", space: "O(n + k)", exact: false, description: "Groups nearby stops with deterministic centroids and respects capacity during assignment." },
  { id: "clarke-wright", name: "Clarke–Wright savings", category: "CVRP", paradigm: "Greedy", complexity: "O(n² log n)", space: "O(n²)", exact: false, description: "Merges endpoint-compatible routes in descending savings order while preserving capacity." },
  { id: "combined", name: "Savings + 2-opt + SA", category: "Recommended", paradigm: "Hybrid heuristic", complexity: "O(n² log n + iterations × n)", space: "O(n²)", exact: false, description: "Recommended dispatch pipeline: capacity-aware savings merges, 2-opt, then seeded annealing." },
]);

export const ROUTE_ALGORITHM_IDS = Object.freeze([
  "nearest-neighbor", "mst-2approx", "two-opt", "or-opt", "simulated-annealing",
  "sweep", "kmeans", "clarke-wright", "combined", "held-karp", "branch-and-bound", "brute-force",
]);

export function getAlgorithmMetadata(id) {
  return ALGORITHM_REGISTRY.find((entry) => entry.id === id) ?? null;
}
