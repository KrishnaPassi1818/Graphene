export const ALGORITHM_REGISTRY = Object.freeze([
  { id: "dijkstra", name: "Dijkstra's Algorithm", category: "Shortest path", paradigm: "Greedy", complexity: "O((V + E) log V)", space: "O(V)", exact: true, description: "Settles the closest frontier vertex using a binary min-heap. Requires non-negative weights." },
  { id: "prims", name: "Prim's Algorithm", category: "Minimum Spanning Tree", paradigm: "Greedy", complexity: "O((V + E) log V)", space: "O(V)", exact: true, description: "Grows a minimum spanning tree from a seed vertex by iteratively picking the lowest-weight cut edge." },
  { id: "kruskal", name: "Kruskal's Algorithm", category: "Minimum Spanning Tree", paradigm: "Greedy / Disjoint Set", complexity: "O(E log E)", space: "O(V + E)", exact: true, description: "Builds a global minimum spanning forest by sorting all edges and avoiding cycles with Disjoint-Set Union." },
  { id: "bellman-ford", name: "Bellman-Ford Algorithm", category: "Shortest path", paradigm: "Dynamic relaxation", complexity: "O(VE)", space: "O(V)", exact: true, description: "Relaxes every edge iteratively; supports negative weights and detects negative-weight cycles." },
  { id: "floyd-warshall", name: "Floyd-Warshall Algorithm", category: "Shortest path", paradigm: "Dynamic programming", complexity: "O(V³)", space: "O(V²)", exact: true, description: "Builds all-pairs shortest distances by considering each vertex as an intermediate." },
  { id: "ucs", name: "Uniform Cost Search (UCS)", category: "Shortest path", paradigm: "Graph search", complexity: "O(b^(1 + C*/ε)) / O((V + E) log V)", space: "O(V)", exact: true, description: "Explores paths in order of increasing cumulative cost using a priority queue." },
  { id: "bfs", name: "Breadth-First Search (BFS)", category: "Shortest path", paradigm: "Level-order traversal", complexity: "O(V + E)", space: "O(V)", exact: true, description: "Explores neighbors layer-by-layer using a FIFO queue; optimal for unweighted graphs." },
  { id: "yen-k-shortest", name: "Yen’s K-Shortest Paths", category: "Shortest path", paradigm: "Deviation / Shortest path", complexity: "O(K · V · (E + V log V))", space: "O(K · V)", exact: true, description: "Finds the top K loopless shortest paths between source and target by systematically deviating from spur nodes." },
  { id: "nearest-neighbor", name: "Nearest Neighbour", category: "TSP / Routing", paradigm: "Greedy", complexity: "O(n²)", space: "O(n)", exact: false, description: "Repeatedly visits the nearest unserved stop to build tours quickly." },
  { id: "mst-2approx", name: "MST (2-Approximation)", category: "TSP / Routing", paradigm: "Approximation", complexity: "O(n²)", space: "O(n)", exact: false, approximation: "2-approx for metric TSP", description: "Builds a Minimum Spanning Tree via Prim's algorithm followed by preorder traversal shortcutting." },
  { id: "kmeans", name: "Capacity Constrained K-Means", category: "Clustering & CVRP", paradigm: "Clustering", complexity: "O(n log n + t k n)", space: "O(n + k)", exact: false, description: "Groups nearby stops into capacity-feasible vehicle clusters using deterministic centroids." },
  { id: "branch-and-bound", name: "Branch and Bound", category: "TSP", paradigm: "Backtracking / Pruning", complexity: "O(n² n!) worst case", space: "O(n)", exact: true, maxN: 15, description: "DFS with a relaxed outgoing-edge lower bound that prunes subtrees that cannot beat the incumbent." },
  { id: "brute-force", name: "Brute Force", category: "TSP", paradigm: "Exhaustive enumeration", complexity: "O(n!)", space: "O(n)", exact: true, maxN: 10, description: "Enumerates all possible depot-rooted tours to find the provably global optimum for small stop sets." },
  { id: "sweep", name: "Sweep Clustering", category: "Clustering & CVRP", paradigm: "Greedy / Geometric", complexity: "O(n log n) + route TSP", space: "O(n)", exact: false, description: "Sorts stops by polar angle around the depot and partitions clusters at vehicle capacity limits." },
]);

export const ROUTE_ALGORITHM_IDS = Object.freeze([
  "nearest-neighbor",
  "mst-2approx",
  "kmeans",
  "branch-and-bound",
  "brute-force",
  "sweep",
]);

export function getAlgorithmMetadata(id) {
  return ALGORITHM_REGISTRY.find((entry) => entry.id === id) ?? null;
}
