import { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Cpu,
  ExternalLink,
  Filter,
  Gauge,
  GitBranch,
  Layers3,
  LayoutGrid,
  Lightbulb,
  Navigation2,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table,
  Workflow,
  X,
  Zap,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { ALGORITHM_REGISTRY, ROUTE_ALGORITHM_IDS } from "@courier/algorithms";
import { usePlannerStore } from "../store/usePlannerStore.js";

const ALGORITHM_SPECIFICATIONS = [
  // --- SHORTEST PATHS ---
  {
    id: "dijkstra",
    name: "Dijkstra's Algorithm",
    category: "shortest-paths",
    categoryLabel: "Shortest paths",
    paradigm: "Greedy / Min-Heap Priority",
    complexity: "O((V + E) log V)",
    space: "O(V)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Provably optimal (non-negative)",
    threshold: "100,000+ vertices",
    bestUse: "Point-to-point road routing with non-negative edge costs (travel times & distances).",
    keyInvariant: "Once a vertex u is settled from the binary min-heap, dist[u] is guaranteed to be its exact shortest path from the source.",
    routecraftRole: "Used as the primary distance matrix generator between dispatch hubs and delivery stops across urban road graphs.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Settles the closest frontier vertex using a binary min-heap. Requires non-negative weights.",
  },
  {
    id: "bellman-ford",
    name: "Bellman-Ford Algorithm",
    category: "shortest-paths",
    categoryLabel: "Shortest paths",
    paradigm: "Dynamic Edge Relaxation",
    complexity: "O(V · E)",
    space: "O(V)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Provably optimal (detects negative cycles)",
    threshold: "1,000 vertices",
    bestUse: "Graphs with toll discounts, energy regeneration, or negative-weight credits.",
    keyInvariant: "After i iterations of edge relaxations, all shortest paths using at most i edges are correctly discovered. A subsequent (V)th pass detects negative-weight cycles.",
    routecraftRole: "Validates graph topology consistency and verifies battery regenerative braking segments on elevation-weighted networks.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Relaxes every edge iteratively; supports negative weights and detects negative-weight cycles.",
  },
  {
    id: "floyd-warshall",
    name: "Floyd-Warshall Algorithm",
    category: "shortest-paths",
    categoryLabel: "Shortest paths",
    paradigm: "Dynamic Programming (All-Pairs)",
    complexity: "O(V³)",
    space: "O(V²)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Global all-pairs optimal matrix",
    threshold: "400 vertices",
    bestUse: "Precomputing the complete stop-to-stop distance matrix for combinatorial TSP and CVRP solvers.",
    keyInvariant: "dist[i][j] at step k represents the shortest path from vertex i to j using intermediate vertices strictly from the subset {1, ..., k}.",
    routecraftRole: "Populates the full cost matrix D[i,j] needed by Branch & Bound and Nearest Neighbor before fleet tour optimization.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Builds all-pairs shortest distances by considering each vertex as an intermediate.",
  },
  {
    id: "ucs",
    name: "Uniform Cost Search (UCS)",
    category: "shortest-paths",
    categoryLabel: "Shortest paths",
    paradigm: "Graph Search / Branch & Bound",
    complexity: "O(b^(1 + C*/ε))",
    space: "O(V)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Provably optimal for variable costs",
    threshold: "50,000 vertices",
    bestUse: "Goal-directed shortest path exploration where graph vertices are expanded lazily or dynamically.",
    keyInvariant: "Expands the lowest cumulative path cost node first, terminating immediately when the destination target is popped from the frontier.",
    routecraftRole: "Provides single-target navigation queries without requiring full graph distance tree exploration.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Explores paths in order of increasing cumulative cost using a priority queue.",
  },
  {
    id: "bfs",
    name: "Breadth-First Search (BFS)",
    category: "shortest-paths",
    categoryLabel: "Shortest paths",
    paradigm: "Level-Order Queue Traversal",
    complexity: "O(V + E)",
    space: "O(V)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Fewest hops optimal",
    threshold: "250,000+ vertices",
    bestUse: "Unweighted road networks, hop-limited routing, and reachability tests.",
    keyInvariant: "Visits all vertices at hop distance d before any vertex at distance d + 1 via a first-in first-out (FIFO) queue.",
    routecraftRole: "Fast connectivity verification and topological island detection across customer service zones.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Explores neighbors layer-by-layer using a FIFO queue; optimal for unweighted graphs.",
  },
  {
    id: "yen-k-shortest",
    name: "Yen’s K-Shortest Paths",
    category: "shortest-paths",
    categoryLabel: "Shortest paths",
    paradigm: "Spur Node Deviation",
    complexity: "O(K · V · (E + V log V))",
    space: "O(K · V)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Provably ranks top K loopless paths",
    threshold: "500 vertices (K ≤ 10)",
    bestUse: "Alternative route generation for traffic detours and driver preference selection.",
    keyInvariant: "Systematically masks edges along previously chosen shortest paths from spur nodes to discover rank-ordered loopless alternatives.",
    routecraftRole: "Supplies secondary detour recommendations when primary arterial corridors experience heavy congestion.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Finds the top K loopless shortest paths between source and target by systematically deviating from spur nodes.",
  },

  // --- MINIMUM SPANNING TREE ---
  {
    id: "prims",
    name: "Prim's Algorithm",
    category: "mst",
    categoryLabel: "Minimum Spanning Tree",
    paradigm: "Greedy Cut Property",
    complexity: "O((V + E) log V)",
    space: "O(V)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Global Minimum Weight Spanning Tree",
    threshold: "100,000+ vertices",
    bestUse: "Dense graph backbone networks and metric TSP 2-approximation seeds.",
    keyInvariant: "Maintains a growing tree; greedily selects the minimum weight edge spanning the cut between tree and non-tree vertices.",
    routecraftRole: "Forms the foundational minimum tree backbone used by the metric TSP 2-approximation solver.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Grows a minimum spanning tree from a seed vertex by iteratively picking the lowest-weight cut edge.",
  },
  {
    id: "kruskal",
    name: "Kruskal's Algorithm",
    category: "mst",
    categoryLabel: "Minimum Spanning Tree",
    paradigm: "Greedy Edge Sorting / DSU",
    complexity: "O(E log E)",
    space: "O(V + E)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Global Minimum Weight Spanning Forest",
    threshold: "150,000+ edges",
    bestUse: "Sparse transportation grids and rapid regional infrastructure backbone planning.",
    keyInvariant: "Sorts all candidate edges globally; adds edge to forest if and only if it connects two previously disjoint components via Disjoint-Set Union.",
    routecraftRole: "Computes minimum connectivity infrastructure across disconnected metropolitan parcel zones.",
    actionType: "graph-lab",
    actionLabel: "Simulate in Graph Lab",
    labPath: "/shortest-paths",
    description: "Builds a global minimum spanning forest by sorting all edges and avoiding cycles with Disjoint-Set Union.",
  },

  // --- EXACT COMBINATORIAL TSP ---
  {
    id: "branch-and-bound",
    name: "Branch and Bound",
    category: "exact-tsp",
    categoryLabel: "Exact TSP",
    paradigm: "State-Space Search / Pruning",
    complexity: "O(n² · n!) worst case",
    space: "O(n)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Provably global optimum (0.0% gap)",
    threshold: "n ≤ 15 stops",
    bestUse: "High-value deliveries, medical dispatches, and validating heuristic quality.",
    keyInvariant: "A search subtree is pruned immediately whenever its 1-tree MST lower bound exceeds the incumbent best tour length.",
    routecraftRole: "Gold-standard exact TSP engine for tight stop clusters, guaranteeing provably minimal fuel consumption.",
    actionType: "planner",
    actionLabel: "Use in Route Planner",
    plannerId: "branch-and-bound",
    description: "DFS with a relaxed outgoing-edge lower bound that prunes subtrees that cannot beat the incumbent.",
  },
  {
    id: "brute-force",
    name: "Brute Force Enumeration",
    category: "exact-tsp",
    categoryLabel: "Exact TSP",
    paradigm: "Exhaustive Permutation",
    complexity: "O(n!)",
    space: "O(n)",
    exact: true,
    guaranteeType: "exact",
    guarantee: "Exhaustively verified optimum",
    threshold: "n ≤ 10 stops",
    bestUse: "Micro-clusters and theoretical ground-truth verification.",
    keyInvariant: "Evaluates all (n - 1)! / 2 distinct symmetric Hamiltonian cycles with zero lower-bound relaxation error.",
    routecraftRole: "Provides mathematical benchmark verification for small stop batches and academic validation.",
    actionType: "planner",
    actionLabel: "Use in Route Planner",
    plannerId: "brute-force",
    description: "Enumerates all possible depot-rooted tours to find the provably global optimum for small stop sets.",
  },

  // --- ROUTING HEURISTICS & APPROXIMATIONS ---
  {
    id: "nearest-neighbor",
    name: "Nearest Neighbour",
    category: "routing-approx",
    categoryLabel: "Routing & Approximation",
    paradigm: "Greedy Construction",
    complexity: "O(n²)",
    space: "O(n)",
    exact: false,
    guaranteeType: "heuristic",
    guarantee: "Heuristic (12% – 18% typical gap)",
    threshold: "100,000+ stops",
    bestUse: "Real-time dispatch, instant route proposals, and rapid interactive re-sequencing.",
    keyInvariant: "From current stop, jumps to unvisited stop with minimum direct Euclidean or road distance.",
    routecraftRole: "Default high-speed solver for large real-time fleet schedules and dynamic on-demand stop insertions.",
    actionType: "planner",
    actionLabel: "Use in Route Planner",
    plannerId: "nearest-neighbor",
    description: "Repeatedly visits the nearest unserved stop to build tours quickly.",
  },
  {
    id: "mst-2approx",
    name: "MST (2-Approximation)",
    category: "routing-approx",
    categoryLabel: "Routing & Approximation",
    paradigm: "Metric Tree Shortcut",
    complexity: "O(n²)",
    space: "O(n)",
    exact: false,
    guaranteeType: "bounded",
    guarantee: "Provably ≤ 2.0× Metric Optimum",
    threshold: "10,000+ stops",
    bestUse: "Guaranteed quality metric routing when triangle inequality holds strictly.",
    keyInvariant: "Eulerian tour of MST has cost 2 · MST ≤ 2 · OPT_TSP; triangle inequality ensures preorder shortcutting never increases tour cost.",
    routecraftRole: "Delivers mathematically bounded route tours when customer contracts demand guaranteed bound limits.",
    actionType: "planner",
    actionLabel: "Use in Route Planner",
    plannerId: "mst-2approx",
    description: "Builds a Minimum Spanning Tree via Prim's algorithm followed by preorder traversal shortcutting.",
  },

  // --- CVRP & CLUSTERING ---
  {
    id: "sweep",
    name: "Sweep Algorithm",
    category: "clustering-cvrp",
    categoryLabel: "Clustering & CVRP",
    paradigm: "Geometric Polar Partitioning",
    complexity: "O(n log n) + Route TSP",
    space: "O(n)",
    exact: false,
    guaranteeType: "heuristic",
    guarantee: "Sector Contiguity Heuristic",
    threshold: "25,000+ stops",
    bestUse: "Radial multi-vehicle fleet distribution from a centralized dispatch hub.",
    keyInvariant: "Angular sweep ray partitions stops into contiguous non-overlapping wedges until vehicle capacity is reached.",
    routecraftRole: "Rapidly divides delivery territory into balanced vehicle sectors before single-vehicle TSP ordering.",
    actionType: "planner",
    actionLabel: "Use in Route Planner",
    plannerId: "sweep",
    description: "Sorts stops by polar angle around the depot and partitions clusters at vehicle capacity limits.",
  },
  {
    id: "kmeans",
    name: "Capacity-Constrained K-Means",
    category: "clustering-cvrp",
    categoryLabel: "Clustering & CVRP",
    paradigm: "Centroid Clustering / Packing",
    complexity: "O(n log n + t · k · n)",
    space: "O(n + k)",
    exact: false,
    guaranteeType: "heuristic",
    guarantee: "Compact Cluster Heuristic",
    threshold: "15,000+ stops",
    bestUse: "Dense urban territories where vehicles service geographically tight neighborhood zones.",
    keyInvariant: "Minimizes within-cluster sum of squared Euclidean distances subject to knapsack vehicle capacity limits.",
    routecraftRole: "Partitions high-density metropolitan zones into compact, fuel-efficient delivery clusters.",
    actionType: "planner",
    actionLabel: "Use in Route Planner",
    plannerId: "kmeans",
    description: "Groups nearby stops into capacity-feasible vehicle clusters using deterministic centroids.",
  },
];

const CATEGORY_GROUPS = [
  {
    id: "shortest-paths",
    title: "Shortest Path Solvers",
    icon: Compass,
    accentClass: "accent-blue",
    description: "Single-source and all-pairs shortest paths on weighted road networks",
  },
  {
    id: "mst",
    title: "Minimum Spanning Tree",
    icon: GitBranch,
    accentClass: "accent-green",
    description: "Acyclic backbone tree optimizations via greedy cut and cycle properties",
  },
  {
    id: "exact-tsp",
    title: "Exact Combinatorial TSP",
    icon: Cpu,
    accentClass: "accent-violet",
    description: "Provably global optimum permutation solvers for small delivery batches",
  },
  {
    id: "routing-approx",
    title: "Routing Heuristics & Approx",
    icon: Route,
    accentClass: "accent-teal",
    description: "Polynomial-time heuristics and provably bounded 2-approximation metric tours",
  },
  {
    id: "clustering-cvrp",
    title: "Fleet Clustering & CVRP",
    icon: Layers3,
    accentClass: "accent-amber",
    description: "Geometric and centroid sector partitioning for multi-vehicle fleet capacity",
  },
];

export default function AlgorithmsView({ onNavigate }) {
  const setAlgorithm = usePlannerStore((state) => state.setAlgorithm);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [guaranteeFilter, setGuaranteeFilter] = useState("all"); // 'all' | 'exact' | 'bounded' | 'heuristic'
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'matrix'
  const [selectedAlgo, setSelectedAlgo] = useState(null);

  const searchInputRef = useRef(null);

  // Global keyboard shortcuts: "/" to search, "Escape" to dismiss, arrow keys to navigate drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If typing in an input/textarea and not Escape, don't hijack
      const targetTag = e.target.tagName?.toLowerCase();
      const isInput = targetTag === "input" || targetTag === "textarea";

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (selectedAlgo) {
          setSelectedAlgo(null);
        } else if (searchQuery) {
          setSearchQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAlgo, searchQuery]);

  // Compute metrics dynamically from ground truth
  const stats = useMemo(() => {
    const total = ALGORITHM_SPECIFICATIONS.length;
    const exact = ALGORITHM_SPECIFICATIONS.filter((a) => a.guaranteeType === "exact").length;
    const bounded = ALGORITHM_SPECIFICATIONS.filter((a) => a.guaranteeType === "bounded").length;
    const heuristic = ALGORITHM_SPECIFICATIONS.filter((a) => a.guaranteeType === "heuristic").length;
    return { total, exact, bounded, heuristic };
  }, []);

  // Filtered algorithms list
  const filteredAlgorithms = useMemo(() => {
    return ALGORITHM_SPECIFICATIONS.filter((algo) => {
      // Category filter
      if (activeCategory !== "all" && algo.category !== activeCategory) return false;

      // Guarantee filter
      if (guaranteeFilter !== "all" && algo.guaranteeType !== guaranteeFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          algo.name.toLowerCase().includes(q) ||
          algo.description.toLowerCase().includes(q) ||
          algo.paradigm.toLowerCase().includes(q) ||
          algo.complexity.toLowerCase().includes(q) ||
          algo.categoryLabel.toLowerCase().includes(q) ||
          algo.keyInvariant.toLowerCase().includes(q) ||
          algo.bestUse.toLowerCase().includes(q) ||
          algo.routecraftRole.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [searchQuery, activeCategory, guaranteeFilter]);

  // Group filtered algorithms by category
  const groupedAlgorithms = useMemo(() => {
    return CATEGORY_GROUPS.map((group) => {
      const items = filteredAlgorithms.filter((a) => a.category === group.id);
      return {
        ...group,
        items,
      };
    }).filter((g) => g.items.length > 0);
  }, [filteredAlgorithms]);

  // Drawer previous/next navigation within current filtered list
  const currentAlgoIndex = useMemo(() => {
    if (!selectedAlgo) return -1;
    return filteredAlgorithms.findIndex((a) => a.id === selectedAlgo.id);
  }, [selectedAlgo, filteredAlgorithms]);

  const handlePrevAlgo = () => {
    if (currentAlgoIndex > 0) {
      setSelectedAlgo(filteredAlgorithms[currentAlgoIndex - 1]);
    } else if (filteredAlgorithms.length > 0) {
      setSelectedAlgo(filteredAlgorithms[filteredAlgorithms.length - 1]);
    }
  };

  const handleNextAlgo = () => {
    if (currentAlgoIndex >= 0 && currentAlgoIndex < filteredAlgorithms.length - 1) {
      setSelectedAlgo(filteredAlgorithms[currentAlgoIndex + 1]);
    } else if (filteredAlgorithms.length > 0) {
      setSelectedAlgo(filteredAlgorithms[0]);
    }
  };

  // Drawer arrow key listeners
  useEffect(() => {
    if (!selectedAlgo) return;
    const handleArrowNav = (e) => {
      if (e.target.tagName?.toLowerCase() === "input") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevAlgo();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextAlgo();
      }
    };
    window.addEventListener("keydown", handleArrowNav);
    return () => window.removeEventListener("keydown", handleArrowNav);
  }, [selectedAlgo, currentAlgoIndex, filteredAlgorithms]);

  const handleLaunch = (algo) => {
    if (algo.actionType === "planner" && algo.plannerId) {
      setAlgorithm(algo.plannerId);
      if (onNavigate) onNavigate("/");
    } else if (algo.actionType === "graph-lab" && algo.labPath) {
      if (onNavigate) onNavigate(algo.labPath);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setActiveCategory("all");
    setGuaranteeFilter("all");
  };

  const isFiltering = searchQuery.trim() !== "" || activeCategory !== "all" || guaranteeFilter !== "all";

  return (
    <div className="page-stack algo-lab-page">
      {/* Editorial Header Section */}
      <header className="algo-hero-block">
        <div className="algo-hero-content">
          <div className="algo-eyebrow">
            <span className="algo-eyebrow-pip" />
            <span>DAA THEORETICAL FOUNDATIONS</span>
            <span className="algo-eyebrow-sep">/</span>
            <span>ALGORITHM LABORATORY</span>
          </div>
          <h1 className="algo-hero-title">Algorithm lab</h1>
          <p className="algo-hero-desc">
            Provable complexity bounds, mathematical invariants, and runtime operational contracts for Routecraft&apos;s 14 from-scratch solvers.
          </p>
        </div>

        {/* Dynamic Architectural Ledger Metrics */}
        <div className="algo-ledger-strip">
          <div className="algo-ledger-metric">
            <div className="algo-ledger-meta">Total Solvers</div>
            <div className="algo-ledger-num">{stats.total}</div>
            <div className="algo-ledger-caption">6 Shortest · 2 MST · 4 TSP · 2 CVRP</div>
          </div>
          <div className="algo-ledger-metric">
            <div className="algo-ledger-meta">Provably Exact</div>
            <div className="algo-ledger-num">{stats.exact}</div>
            <div className="algo-ledger-caption">0.0% gap up to defined scale bounds</div>
          </div>
          <div className="algo-ledger-metric">
            <div className="algo-ledger-meta">Metric Approximation</div>
            <div className="algo-ledger-num">{stats.bounded} Solver</div>
            <div className="algo-ledger-caption">≤ 2.0× Metric TSP factor guarantee</div>
          </div>
          <div className="algo-ledger-metric">
            <div className="algo-ledger-meta">Fast Heuristics</div>
            <div className="algo-ledger-num">{stats.heuristic} Solvers</div>
            <div className="algo-ledger-caption">Polynomial real-time dispatch & clusters</div>
          </div>
        </div>
      </header>

      {/* Precision Workstation Control Bar */}
      <section className="algo-control-deck" aria-label="Catalog Filters">
        <div className="algo-control-deck-row">
          {/* Search Box */}
          <div className="algo-search-box">
            <Search size={14} className="algo-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search solvers, paradigms, Big-O, invariants, roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search algorithms"
            />
            {searchQuery ? (
              <button
                type="button"
                className="algo-search-clear-btn"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="algo-search-kbd" title="Press / to search">/</kbd>
            )}
          </div>

          {/* Guarantee Class Filter */}
          <div className="algo-guarantee-segmented" role="group" aria-label="Guarantee Class Filter">
            <button
              type="button"
              className={`algo-seg-btn ${guaranteeFilter === "all" ? "is-selected" : ""}`}
              onClick={() => setGuaranteeFilter("all")}
            >
              All Guarantees <span className="algo-seg-count">{stats.total}</span>
            </button>
            <button
              type="button"
              className={`algo-seg-btn ${guaranteeFilter === "exact" ? "is-selected" : ""}`}
              onClick={() => setGuaranteeFilter("exact")}
              title="Show only provably optimal solvers"
            >
              <Check size={11} strokeWidth={2.5} />
              Exact Optimum <span className="algo-seg-count">{stats.exact}</span>
            </button>
            <button
              type="button"
              className={`algo-seg-btn ${guaranteeFilter === "bounded" ? "is-selected" : ""}`}
              onClick={() => setGuaranteeFilter("bounded")}
              title="Show bounded approximation solvers"
            >
              <Sparkles size={11} />
              Bounded ≤2.0× <span className="algo-seg-count">{stats.bounded}</span>
            </button>
            <button
              type="button"
              className={`algo-seg-btn ${guaranteeFilter === "heuristic" ? "is-selected" : ""}`}
              onClick={() => setGuaranteeFilter("heuristic")}
              title="Show fast polynomial heuristics"
            >
              <Gauge size={11} />
              Heuristics <span className="algo-seg-count">{stats.heuristic}</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="algo-view-toggle" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`algo-view-toggle-btn ${viewMode === "grid" ? "is-active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`algo-view-toggle-btn ${viewMode === "matrix" ? "is-active" : ""}`}
              onClick={() => setViewMode("matrix")}
              title="Comparative Table View"
            >
              <Table size={13} />
              <span>Matrix</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills Row */}
        <div className="algo-category-tabs" role="tablist" aria-label="Categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            className={`algo-cat-tab ${activeCategory === "all" ? "is-active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All Categories
            <span className="algo-cat-pill-count">{ALGORITHM_SPECIFICATIONS.length}</span>
          </button>
          {CATEGORY_GROUPS.map((group) => {
            const count = ALGORITHM_SPECIFICATIONS.filter((a) => a.category === group.id).length;
            const Icon = group.icon;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === group.id}
                className={`algo-cat-tab ${activeCategory === group.id ? "is-active" : ""}`}
                onClick={() => setActiveCategory(group.id)}
              >
                <Icon size={12} className="algo-tab-icon" />
                <span>{group.title}</span>
                <span className="algo-cat-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Active Query Status Indicator */}
        {isFiltering && (
          <div className="algo-filter-status-bar">
            <span>
              Showing <b>{filteredAlgorithms.length}</b> of {ALGORITHM_SPECIFICATIONS.length} algorithms
              {searchQuery && <> matching &ldquo;{searchQuery}&rdquo;</>}
              {activeCategory !== "all" && <> in <i>{CATEGORY_GROUPS.find(g => g.id === activeCategory)?.title}</i></>}
              {guaranteeFilter !== "all" && <> ({guaranteeFilter})</>}
            </span>
            <button
              type="button"
              className="algo-clear-filters-link"
              onClick={handleResetFilters}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {filteredAlgorithms.length === 0 ? (
        /* Empty State */
        <div className="algo-empty-board">
          <div className="algo-empty-icon-wrap">
            <Filter size={22} />
          </div>
          <h3>No matching algorithms found</h3>
          <p>
            No algorithms match the current filter combination. Try clearing your search term or selecting &ldquo;All Categories&rdquo;.
          </p>
          <button
            type="button"
            className="algo-reset-action-btn"
            onClick={handleResetFilters}
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="algo-grid-sections">
          {groupedAlgorithms.map((group) => {
            const Icon = group.icon;
            return (
              <section className="algo-group-section" key={group.id}>
                {/* Section Header */}
                <div className="algo-group-header">
                  <div className={`algo-group-badge ${group.accentClass}`}>
                    <Icon size={15} />
                  </div>
                  <div className="algo-group-heading-text">
                    <h2>{group.title}</h2>
                    <p>{group.description}</p>
                  </div>
                  <span className="algo-group-tally">{group.items.length} solvers</span>
                </div>

                {/* Cards Grid */}
                <div className="algo-spec-grid">
                  {group.items.map((algo) => {
                    const isSelected = selectedAlgo?.id === algo.id;
                    return (
                      <article
                        className={`algo-card ${isSelected ? "is-selected" : ""}`}
                        key={algo.id}
                        onClick={() => setSelectedAlgo(algo)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Inspect ${algo.name} specifications`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedAlgo(algo);
                          }
                        }}
                      >
                        {/* Card Top Meta */}
                        <div className="algo-card-top-meta">
                          <span className="algo-paradigm-tag">{algo.paradigm}</span>
                          {algo.guaranteeType === "exact" ? (
                            <span className="algo-tag-exact" title={algo.guarantee}>
                              <Check size={10} strokeWidth={3} />
                              EXACT OPTIMUM
                            </span>
                          ) : algo.guaranteeType === "bounded" ? (
                            <span className="algo-tag-bounded" title={algo.guarantee}>
                              <Sparkles size={10} />
                              BOUNDED 2.0×
                            </span>
                          ) : (
                            <span className="algo-tag-heuristic" title={algo.guarantee}>
                              <Gauge size={10} />
                              HEURISTIC
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <h3 className="algo-card-name">{algo.name}</h3>
                        <p className="algo-card-summary">{algo.description}</p>

                        {/* Mathematical Invariant Box */}
                        <div className="algo-invariant-panel">
                          <div className="algo-invariant-eyebrow">KEY INVARIANT</div>
                          <div className="algo-invariant-statement">&ldquo;{algo.keyInvariant}&rdquo;</div>
                        </div>

                        {/* Asymptotic Complexity Row */}
                        <div className="algo-spec-row">
                          <div className="algo-spec-chip" title="Worst-case Time Complexity">
                            <Clock3 size={11} className="algo-spec-icon" />
                            <code className="algo-mono">{algo.complexity}</code>
                          </div>
                          <div className="algo-spec-chip" title="Auxiliary Space Complexity">
                            <Gauge size={11} className="algo-spec-icon" />
                            <code className="algo-mono">{algo.space}</code>
                          </div>
                          <div className="algo-spec-chip scale" title="Practical Scale Limit">
                            <Cpu size={11} className="algo-spec-icon" />
                            <span>{algo.threshold}</span>
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="algo-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="algo-inspect-action"
                            onClick={() => setSelectedAlgo(algo)}
                            title="Inspect full mathematical specification"
                          >
                            <BookOpen size={12} />
                            <span>Inspect Specs</span>
                          </button>

                          <button
                            type="button"
                            className="algo-launch-action"
                            onClick={() => handleLaunch(algo)}
                            title={algo.actionLabel}
                          >
                            <span>{algo.actionType === "planner" ? "Route Planner" : "Graph Lab"}</span>
                            {algo.actionType === "planner" ? <ArrowUpRight size={12} /> : <ArrowRight size={12} />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* COMPARATIVE MATRIX / TABLE VIEW */
        <div className="algo-matrix-board">
          <div className="algo-table-scroll">
            <table className="algo-data-table">
              <thead>
                <tr>
                  <th scope="col">Solver &amp; Paradigm</th>
                  <th scope="col">Category</th>
                  <th scope="col">Worst-Case Time</th>
                  <th scope="col">Space</th>
                  <th scope="col">Optimality Guarantee</th>
                  <th scope="col">Operational Scale</th>
                  <th scope="col" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlgorithms.map((algo) => {
                  const isSelected = selectedAlgo?.id === algo.id;
                  return (
                    <tr
                      key={algo.id}
                      className={`algo-table-row ${isSelected ? "is-row-active" : ""}`}
                      onClick={() => setSelectedAlgo(algo)}
                    >
                      <td>
                        <div className="table-solver-title">{algo.name}</div>
                        <div className="table-solver-paradigm">{algo.paradigm}</div>
                      </td>
                      <td>
                        <span className="table-cat-badge">{algo.categoryLabel}</span>
                      </td>
                      <td>
                        <code className="table-mono-badge">{algo.complexity}</code>
                      </td>
                      <td>
                        <code className="table-mono-badge">{algo.space}</code>
                      </td>
                      <td>
                        {algo.guaranteeType === "exact" ? (
                          <span className="algo-tag-exact">
                            <Check size={10} strokeWidth={3} />
                            {algo.guarantee}
                          </span>
                        ) : algo.guaranteeType === "bounded" ? (
                          <span className="algo-tag-bounded">
                            <Sparkles size={10} />
                            {algo.guarantee}
                          </span>
                        ) : (
                          <span className="algo-tag-heuristic">
                            <Gauge size={10} />
                            {algo.guarantee}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="table-scale-note">{algo.threshold}</span>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="table-btn-inspect"
                            onClick={() => setSelectedAlgo(algo)}
                            title="Inspect full specification"
                          >
                            <BookOpen size={12} />
                            <span>Specs</span>
                          </button>
                          <button
                            type="button"
                            className="table-btn-launch"
                            onClick={() => handleLaunch(algo)}
                            title={algo.actionLabel}
                          >
                            <span>{algo.actionType === "planner" ? "Planner" : "Graph Lab"}</span>
                            {algo.actionType === "planner" ? <ArrowUpRight size={11} /> : <ArrowRight size={11} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DAA Algorithmic Pipeline Architecture Callout */}
      <section className="algo-pipeline-card" aria-label="Algorithmic Separation Architecture">
        <div className="algo-pipeline-badge">
          <Workflow size={16} />
        </div>
        <div className="algo-pipeline-content">
          <div className="algo-pipeline-header">
            <h3>Cluster-First, Route-Second Separation Principle</h3>
            <span className="algo-pipeline-tag">DAA System Architecture</span>
          </div>
          <p>
            When multi-vehicle routing is active, combinatorial TSP solvers (Branch &amp; Bound, Brute Force, MST 2-Approx) optimize the stop sequence strictly <em>inside</em> each capacity-bounded cluster. The global fleet territory partitioning step is handled first via geometric sweep or capacity-constrained K-Means.
          </p>
          <div className="algo-pipeline-stages">
            <div className="algo-stage-step">
              <span className="stage-num">Stage 1</span>
              <span className="stage-name">Metric Distance Matrix</span>
              <span className="stage-tech">Dijkstra / Floyd-Warshall</span>
            </div>
            <div className="stage-arrow">→</div>
            <div className="algo-stage-step">
              <span className="stage-num">Stage 2</span>
              <span className="stage-name">Fleet Clustering</span>
              <span className="stage-tech">Sweep / K-Means CVRP</span>
            </div>
            <div className="stage-arrow">→</div>
            <div className="algo-stage-step">
              <span className="stage-num">Stage 3</span>
              <span className="stage-name">Intra-Cluster TSP</span>
              <span className="stage-tech">Branch &amp; Bound / 2-Approx</span>
            </div>
            <div className="stage-arrow">→</div>
            <div className="algo-stage-step">
              <span className="stage-num">Stage 4</span>
              <span className="stage-name">Detours &amp; SSSP</span>
              <span className="stage-tech">Yen&apos;s K-Shortest / UCS</span>
            </div>
          </div>
        </div>
      </section>

      {/* Slide-over Specification Dossier Drawer */}
      {selectedAlgo && (
        <div
          className="algo-drawer-scrim"
          onClick={() => setSelectedAlgo(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-algo-title"
        >
          <aside className="algo-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="algo-drawer-head">
              <div className="algo-drawer-title-group">
                <div className="algo-drawer-eyebrow">{selectedAlgo.categoryLabel}</div>
                <h2 id="drawer-algo-title" className="algo-drawer-title">{selectedAlgo.name}</h2>
                <div className="algo-drawer-pill-row">
                  <span className="drawer-paradigm-pill">{selectedAlgo.paradigm}</span>
                  {selectedAlgo.guaranteeType === "exact" ? (
                    <span className="algo-tag-exact">
                      <Check size={10} strokeWidth={3} />
                      EXACT OPTIMUM
                    </span>
                  ) : selectedAlgo.guaranteeType === "bounded" ? (
                    <span className="algo-tag-bounded">
                      <Sparkles size={10} />
                      BOUNDED 2.0×
                    </span>
                  ) : (
                    <span className="algo-tag-heuristic">
                      <Gauge size={10} />
                      HEURISTIC
                    </span>
                  )}
                </div>
              </div>

              <div className="algo-drawer-head-actions">
                {/* Sibling Algorithm Navigators */}
                <div className="algo-drawer-nav-btns" role="group" aria-label="Browse algorithms">
                  <button
                    type="button"
                    className="algo-drawer-nav-arrow"
                    onClick={handlePrevAlgo}
                    title="Previous algorithm (←)"
                    aria-label="Previous algorithm"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="algo-drawer-index">
                    {currentAlgoIndex + 1}/{filteredAlgorithms.length}
                  </span>
                  <button
                    type="button"
                    className="algo-drawer-nav-arrow"
                    onClick={handleNextAlgo}
                    title="Next algorithm (→)"
                    aria-label="Next algorithm"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  className="algo-drawer-dismiss-icon"
                  onClick={() => setSelectedAlgo(null)}
                  title="Close dossier (Esc)"
                  aria-label="Close dossier"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Launch Header Action */}
            <div className="algo-drawer-quick-cta">
              <button
                type="button"
                className="algo-drawer-hero-launch"
                onClick={() => handleLaunch(selectedAlgo)}
              >
                <span>{selectedAlgo.actionLabel}</span>
                {selectedAlgo.actionType === "planner" ? <ArrowUpRight size={13} /> : <ArrowRight size={13} />}
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="algo-drawer-content">
              {/* Section 1: Algorithmic Mechanism */}
              <div className="algo-dossier-section">
                <h4>THEORETICAL OVERVIEW</h4>
                <p className="dossier-body-text">{selectedAlgo.description}</p>
              </div>

              {/* Section 2: Mathematical Invariant */}
              <div className="algo-dossier-section">
                <h4>MATHEMATICAL INVARIANT &amp; PROOF LOGIC</h4>
                <div className="dossier-invariant-callout">
                  <div className="dossier-invariant-quote">&ldquo;{selectedAlgo.keyInvariant}&rdquo;</div>
                </div>
              </div>

              {/* Section 3: Complexity & Scale Profile */}
              <div className="algo-dossier-section">
                <h4>ASYMPTOTIC COMPLEXITY &amp; LIMITS</h4>
                <div className="dossier-metrics-matrix">
                  <div className="dossier-metric-cell">
                    <span className="dossier-m-label">Worst-Case Time</span>
                    <span className="dossier-m-val mono">{selectedAlgo.complexity}</span>
                  </div>
                  <div className="dossier-metric-cell">
                    <span className="dossier-m-label">Auxiliary Space</span>
                    <span className="dossier-m-val mono">{selectedAlgo.space}</span>
                  </div>
                  <div className="dossier-metric-cell">
                    <span className="dossier-m-label">Optimality Guarantee</span>
                    <span className="dossier-m-val">{selectedAlgo.guarantee}</span>
                  </div>
                  <div className="dossier-metric-cell">
                    <span className="dossier-m-label">Operational Scale</span>
                    <span className="dossier-m-val">{selectedAlgo.threshold}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Operational Recommendation */}
              <div className="algo-dossier-section">
                <h4>WHEN TO USE THIS SOLVER</h4>
                <p className="dossier-body-text">{selectedAlgo.bestUse}</p>
              </div>

              {/* Section 5: Routecraft Engine Integration */}
              <div className="algo-dossier-section">
                <h4>ROUTECRAFT DISPATCH ROLE</h4>
                <p className="dossier-body-text">{selectedAlgo.routecraftRole}</p>
              </div>
            </div>

            {/* Drawer Footer Controls */}
            <div className="algo-drawer-foot">
              <div className="algo-drawer-keyboard-hint">
                <kbd>Esc</kbd> close · <kbd>←</kbd> <kbd>→</kbd> cycle
              </div>

              <div className="algo-drawer-foot-btns">
                <button
                  type="button"
                  className="algo-drawer-foot-close"
                  onClick={() => setSelectedAlgo(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="algo-drawer-foot-launch"
                  onClick={() => handleLaunch(selectedAlgo)}
                >
                  <span>{selectedAlgo.actionLabel}</span>
                  {selectedAlgo.actionType === "planner" ? <ArrowUpRight size={13} /> : <ArrowRight size={13} />}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
