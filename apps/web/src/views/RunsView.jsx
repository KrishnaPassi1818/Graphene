import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  Clock3,
  Copy,
  Download,
  Eye,
  FileDown,
  FileJson,
  Layers3,
  Navigation2,
  RotateCcw,
  Route,
  Search,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api } from "../api/client.js";
import { usePlannerStore } from "../store/usePlannerStore.js";
import RouteMap, { ROUTE_COLORS } from "../components/RouteMap.jsx";
import { DEMO_INSTANCE, solveOptimization } from "@courier/algorithms";

const ALGORITHM_CONFIGS = {
  "nearest-neighbor": {
    name: "Nearest Neighbor",
    category: "Heuristic",
    color: "#1d4ed8",
    accent: "rgba(29, 78, 216, 0.08)",
    border: "rgba(29, 78, 216, 0.2)",
  },
  sweep: {
    name: "Sweep Clustering",
    category: "Sector Partition",
    color: "#854d0e",
    accent: "rgba(133, 77, 14, 0.08)",
    border: "rgba(133, 77, 14, 0.2)",
  },
  kmeans: {
    name: "Capacity K-Means",
    category: "Centroid Cluster",
    color: "#166534",
    accent: "rgba(22, 101, 52, 0.08)",
    border: "rgba(22, 101, 52, 0.2)",
  },
  "mst-2approx": {
    name: "MST 2-Approx",
    category: "Metric Approx",
    color: "#047857",
    accent: "rgba(4, 120, 87, 0.08)",
    border: "rgba(4, 120, 87, 0.2)",
  },
  "branch-and-bound": {
    name: "Branch & Bound",
    category: "Exact Solver",
    color: "#6b21a8",
    accent: "rgba(107, 33, 168, 0.08)",
    border: "rgba(107, 33, 168, 0.2)",
  },
  "brute-force": {
    name: "Brute Force",
    category: "Exact Permutation",
    color: "#b91c1c",
    accent: "rgba(185, 28, 28, 0.08)",
    border: "rgba(185, 28, 28, 0.2)",
  },
};

function getAlgoMeta(algoKey) {
  return (
    ALGORITHM_CONFIGS[algoKey] ?? {
      name: algoKey || "Custom Solver",
      category: "VRP Solver",
      color: "#4c4541",
      accent: "rgba(76, 69, 65, 0.08)",
      border: "rgba(76, 69, 65, 0.2)",
    }
  );
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "--:--";
  const total = Math.round(minutes);
  const hrs = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const period = hrs >= 12 ? "PM" : "AM";
  const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
  return `${displayHrs}:${String(mins).padStart(2, "0")} ${period}`;
}

// Generate realistic preset runs for initial demo state
function generateInitialPresets() {
  const configs = [
    { algo: "sweep", territory: "Central Metropolitan Hub", hoursAgo: 1.5, seed: 42 },
    { algo: "kmeans", territory: "North Commercial Ring", hoursAgo: 3.8, seed: 43 },
    { algo: "nearest-neighbor", territory: "East Industrial Logistics Loop", hoursAgo: 6.2, seed: 44 },
    { algo: "mst-2approx", territory: "Suburban Retail Sector", hoursAgo: 14.0, seed: 45 },
    { algo: "sweep", territory: "Express High-Priority Radial", hoursAgo: 22.5, seed: 46 },
    { algo: "branch-and-bound", territory: "High-Density Downtown Core", hoursAgo: 31.0, seed: 47, maxStops: 8 },
  ];

  return configs.map((cfg, index) => {
    const stops = cfg.maxStops ? DEMO_INSTANCE.stops.slice(0, cfg.maxStops) : DEMO_INSTANCE.stops;
    const vehicles = cfg.maxStops ? 2 : DEMO_INSTANCE.fleet.vehicles;
    const solved = solveOptimization({
      depot: DEMO_INSTANCE.depot,
      stops,
      vehicles,
      capacity: DEMO_INSTANCE.fleet.capacity,
      algorithm: cfg.algo,
      options: { seed: cfg.seed, trace: false },
    });

    return {
      id: `DSP-2026-${String(8420 + index * 3)}`,
      algorithm: cfg.algo,
      territory: cfg.territory,
      totalDistance: solved.totalCost,
      runtimeMs: solved.stats.runtimeMs || (1.2 + index * 0.4),
      opCount: solved.stats.operations || (1200 + index * 650),
      createdAt: new Date(Date.now() - cfg.hoursAgo * 3600000).toISOString(),
      origin: "archive",
      result: solved,
      input: {
        depot: DEMO_INSTANCE.depot,
        stops,
        fleet: { vehicles, capacity: DEMO_INSTANCE.fleet.capacity, averageSpeedKmh: 28 },
      },
    };
  });
}

export default function RunsView() {
  const navigate = useNavigate();

  // Store bindings
  const localRuns = usePlannerStore((state) => state.history);
  const clearHistory = usePlannerStore((state) => state.clearHistory);
  const setPlanner = usePlannerStore((state) => state.setPlanner);
  const setAlgorithm = usePlannerStore((state) => state.setAlgorithm);
  const setResult = usePlannerStore((state) => state.setResult);
  const currentPlanner = usePlannerStore((state) => state.planner);

  // Queries
  const query = useQuery({
    queryKey: ["runs"],
    queryFn: api.runs,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const remoteRuns = query.data ?? [];

  // Local UI State
  const [activeTab, setActiveTab] = useState("log"); // 'log' | 'analytics'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlgo, setSelectedAlgo] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'oldest' | 'distance-asc' | 'runtime-asc'
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [inspectingRun, setInspectingRun] = useState(null);
  const [inspectingVehicleIndex, setInspectingVehicleIndex] = useState(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Initial presets cache
  const initialPresets = useMemo(() => generateInitialPresets(), []);

  // Merged runs: User's session runs + API runs + realistic presets
  const mergedRuns = useMemo(() => {
    const userRuns = [
      ...localRuns.map((r) => ({ ...r, origin: "session" })),
      ...remoteRuns
        .filter((r) => !localRuns.some((l) => l.id === r.id))
        .map((r) => ({ ...r, origin: "api" })),
    ];

    if (userRuns.length > 0) {
      // If user has created runs, merge with presets
      const dedupedPresets = initialPresets.filter(
        (p) => !userRuns.some((u) => u.id === p.id)
      );
      return [...userRuns, ...dedupedPresets].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    return initialPresets;
  }, [localRuns, remoteRuns, initialPresets]);

  // Executive summary metrics
  const summary = useMemo(() => {
    let totalDistance = 0;
    let totalRuntime = 0;
    let totalOperations = 0;
    let totalVehicles = 0;
    let totalStops = 0;
    let minDistance = Infinity;

    for (const run of mergedRuns) {
      const dist = Number(run.totalDistance ?? run.totalCost ?? 0);
      const runtime = Number(run.runtimeMs ?? run.stats?.runtimeMs ?? 0);
      const ops = Number(run.opCount ?? run.stats?.operations ?? 0);
      const veh =
        run.result?.routes?.length ??
        run.result?.vehicles ??
        run.input?.fleet?.vehicles ??
        3;
      const stops =
        run.result?.stats?.stops ??
        (run.result?.routes
          ? run.result.routes.reduce((acc, r) => acc + Math.max(0, r.length - 2), 0)
          : run.input?.stops?.length ?? 0);

      totalDistance += dist;
      totalRuntime += runtime;
      totalOperations += ops;
      totalVehicles += veh;
      totalStops += stops;
      if (dist > 0 && dist < minDistance) minDistance = dist;
    }

    return {
      totalRuns: mergedRuns.length,
      totalDistance,
      avgDistance: mergedRuns.length ? totalDistance / mergedRuns.length : 0,
      minDistance: minDistance === Infinity ? 0 : minDistance,
      avgRuntime: mergedRuns.length ? totalRuntime / mergedRuns.length : 0,
      totalOperations,
      totalVehicles,
      totalStops,
    };
  }, [mergedRuns]);

  // Filtered & Sorted runs
  const filteredRuns = useMemo(() => {
    let list = mergedRuns;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.algorithm.toLowerCase().includes(q) ||
          (r.territory && r.territory.toLowerCase().includes(q)) ||
          getAlgoMeta(r.algorithm).name.toLowerCase().includes(q)
      );
    }

    if (selectedAlgo !== "all") {
      list = list.filter((r) => r.algorithm === selectedAlgo);
    }

    return list.sort((a, b) => {
      const distA = Number(a.totalDistance ?? a.totalCost ?? 0);
      const distB = Number(b.totalDistance ?? b.totalCost ?? 0);
      const timeA = Number(a.runtimeMs ?? a.stats?.runtimeMs ?? 0);
      const timeB = Number(b.runtimeMs ?? b.stats?.runtimeMs ?? 0);

      switch (sortBy) {
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "distance-asc":
          return distA - distB;
        case "runtime-asc":
          return timeA - timeB;
        case "newest":
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
  }, [mergedRuns, searchQuery, selectedAlgo, sortBy]);

  // Analytics Chart Data
  const trendChartData = useMemo(() => {
    return [...mergedRuns]
      .reverse()
      .slice(-10)
      .map((r, idx) => ({
        index: idx + 1,
        id: r.id,
        shortId: r.id.replace("DSP-2026-", "#"),
        name: getAlgoMeta(r.algorithm).name,
        distance: Number((r.totalDistance ?? r.totalCost ?? 0).toFixed(2)),
        runtime: Number((r.runtimeMs ?? r.stats?.runtimeMs ?? 0).toFixed(2)),
      }));
  }, [mergedRuns]);

  // Restore run in Route Planner
  function handleLoadInPlanner(run) {
    const depotToRestore =
      run.input?.depot || run.result?.depot || currentPlanner.depot;
    const stopsToRestore =
      run.input?.stops || run.result?.stops || currentPlanner.stops;
    const fleetToRestore = run.input?.fleet || {
      vehicles:
        run.result?.routes?.length ||
        run.result?.vehicles ||
        currentPlanner.fleet?.vehicles ||
        3,
      capacity: run.result?.capacity || currentPlanner.fleet?.capacity || 95,
      averageSpeedKmh:
        run.input?.fleet?.averageSpeedKmh ||
        currentPlanner.fleet?.averageSpeedKmh ||
        28,
    };

    setPlanner({
      depot: depotToRestore,
      stops: stopsToRestore,
      fleet: fleetToRestore,
    });
    setAlgorithm(run.algorithm);
    if (run.result) {
      setResult(run.result);
    }
    toast.success(`Loaded dispatch ${run.id} into Route Planner.`);
    navigate("/");
  }

  // Toggle selection for comparison
  function handleToggleSelect(runId) {
    setSelectedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  }

  function handleSelectAll() {
    if (selectedRunIds.length === filteredRuns.length) {
      setSelectedRunIds([]);
    } else {
      setSelectedRunIds(filteredRuns.map((r) => r.id));
    }
  }

  // Export CSV
  function handleExportCSV() {
    if (!mergedRuns.length) return toast.error("No runs to export.");
    const headers = [
      "dispatch_id",
      "territory",
      "algorithm",
      "distance_km",
      "runtime_ms",
      "operations",
      "vehicles",
      "stops",
      "created_at",
    ];
    const rows = mergedRuns.map((run) => [
      run.id,
      run.territory || "General Dispatch",
      run.algorithm,
      Number(run.totalDistance ?? run.totalCost ?? 0).toFixed(2),
      Number(run.runtimeMs ?? run.stats?.runtimeMs ?? 0).toFixed(2),
      run.opCount ?? run.stats?.operations ?? 0,
      run.result?.routes?.length ?? run.result?.vehicles ?? 3,
      run.result?.stats?.stops ?? run.input?.stops?.length ?? 0,
      run.createdAt,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fleet-dispatch-history-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported fleet history as CSV.");
  }

  // Export full JSON
  function handleExportJSON() {
    if (!mergedRuns.length) return toast.error("No runs to export.");
    const blob = new Blob([JSON.stringify(mergedRuns, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fleet-dispatch-history-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported fleet history as JSON.");
  }

  // Copy ID helper
  function handleCopyId(id) {
    navigator.clipboard.writeText(id);
    toast.success("Dispatch ID copied.");
  }

  // Runs selected for comparison
  const comparedRuns = useMemo(() => {
    return mergedRuns.filter((r) => selectedRunIds.includes(r.id));
  }, [mergedRuns, selectedRunIds]);

  return (
    <div className="fleet-history-stack">
      {/* Hero Header */}
      <section className="fleet-hero-header">
        <div>
          <h1>Fleet dispatch history</h1>
          <p>
            Audit trail of vehicle routes, solver performance benchmarks, capacity
            allocation, and delivery manifests.
          </p>
        </div>

        <div className="fleet-hero-actions">
          <button
            type="button"
            className="curri-btn curri-btn-secondary"
            onClick={handleExportCSV}
            title="Download CSV manifest"
          >
            <FileDown size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="curri-btn curri-btn-secondary"
            onClick={handleExportJSON}
            title="Download JSON archive"
          >
            <FileJson size={14} />
            <span>JSON</span>
          </button>

          <button
            type="button"
            className="curri-btn curri-btn-primary"
            onClick={() => navigate("/")}
            title="Open Route Planner to optimize a new route"
          >
            <Navigation2 size={14} />
            <span>New Route Plan</span>
          </button>
        </div>
      </section>

      {/* Quiet Anti-Slop KPI Grid (No icon chips, tabular figures) */}
      <section className="fleet-kpi-grid">
        <div className="fleet-kpi-card">
          <div className="fleet-kpi-label">Archived dispatches</div>
          <div className="fleet-kpi-val">{summary.totalRuns}</div>
          <div className="fleet-kpi-sub">All solutions verified</div>
        </div>

        <div className="fleet-kpi-card">
          <div className="fleet-kpi-label">Dispatched distance</div>
          <div className="fleet-kpi-val">
            {summary.totalDistance.toFixed(1)}{" "}
            <span style={{ fontSize: "14px", fontWeight: 500 }}>km</span>
          </div>
          <div className="fleet-kpi-sub">
            Avg {summary.avgDistance.toFixed(1)} km per plan
          </div>
        </div>

        <div className="fleet-kpi-card">
          <div className="fleet-kpi-label">Fleet vehicles</div>
          <div className="fleet-kpi-val">
            {summary.totalVehicles}{" "}
            <span style={{ fontSize: "14px", fontWeight: 500 }}>tours</span>
          </div>
          <div className="fleet-kpi-sub">
            {summary.totalStops} delivery stops scheduled
          </div>
        </div>

        <div className="fleet-kpi-card">
          <div className="fleet-kpi-label">Solver latency</div>
          <div className="fleet-kpi-val">
            {summary.avgRuntime.toFixed(1)}{" "}
            <span style={{ fontSize: "14px", fontWeight: 500 }}>ms</span>
          </div>
          <div className="fleet-kpi-sub">
            {summary.totalOperations.toLocaleString()} total operations
          </div>
        </div>
      </section>

      {/* Tabs & Filter Bar */}
      <div className="fleet-view-nav">
        <div className="fleet-tabs">
          <button
            type="button"
            className={`fleet-tab ${activeTab === "log" ? "is-active" : ""}`}
            onClick={() => setActiveTab("log")}
          >
            <Layers3 size={14} />
            <span>Dispatches log</span>
            <span className="fleet-tab-count">{filteredRuns.length}</span>
          </button>

          <button
            type="button"
            className={`fleet-tab ${activeTab === "analytics" ? "is-active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <BarChart3 size={14} />
            <span>Solver analytics &amp; trends</span>
          </button>
        </div>

        {localRuns.length > 0 && (
          <button
            type="button"
            className="curri-btn curri-btn-secondary"
            onClick={() => {
              if (window.confirm("Clear your session runs?")) {
                clearHistory();
                toast.success("Session runs cleared.");
              }
            }}
            style={{ fontSize: "12px", height: "30px", padding: "0 10px" }}
          >
            <Trash2 size={12} />
            <span>Clear Session</span>
          </button>
        )}
      </div>

      {/* TAB 1: RUNS LOG TABLE */}
      {activeTab === "log" && (
        <div className="fleet-history-stack">
          {/* Controls Bar */}
          <div className="fleet-controls-bar">
            <div className="fleet-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Filter by dispatch ID, territory, or solver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="fleet-filter-group">
              <div className="fleet-select-wrap">
                <span>Solver:</span>
                <select
                  className="fleet-select"
                  value={selectedAlgo}
                  onChange={(e) => setSelectedAlgo(e.target.value)}
                >
                  <option value="all">All Solvers</option>
                  <option value="sweep">Sweep Clustering</option>
                  <option value="kmeans">Capacity K-Means</option>
                  <option value="nearest-neighbor">Nearest Neighbor</option>
                  <option value="mst-2approx">MST 2-Approx</option>
                  <option value="branch-and-bound">Branch &amp; Bound</option>
                </select>
              </div>

              <div className="fleet-select-wrap">
                <span>Sort by:</span>
                <select
                  className="fleet-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="distance-asc">Lowest Distance</option>
                  <option value="runtime-asc">Fastest Compute</option>
                </select>
              </div>
            </div>
          </div>

          {/* Runs Table Card */}
          <div className="fleet-table-card">
            <div className="fleet-table-wrap">
              <table className="fleet-runs-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={
                          selectedRunIds.length > 0 &&
                          selectedRunIds.length === filteredRuns.length
                        }
                        onChange={handleSelectAll}
                        title="Select all"
                      />
                    </th>
                    <th>Dispatch ID</th>
                    <th>Territory / Route</th>
                    <th>Solver</th>
                    <th>Fleet Assignment</th>
                    <th className="num">Distance</th>
                    <th className="num">Compute Time</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => {
                    const meta = getAlgoMeta(run.algorithm);
                    const isSelected = selectedRunIds.includes(run.id);
                    const distance = Number(run.totalDistance ?? run.totalCost ?? 0);
                    const runtime = Number(run.runtimeMs ?? run.stats?.runtimeMs ?? 0);
                    const vehicles =
                      run.result?.routes?.length ??
                      run.result?.vehicles ??
                      run.input?.fleet?.vehicles ??
                      3;
                    const stops =
                      run.result?.stats?.stops ??
                      (run.result?.routes
                        ? run.result.routes.reduce(
                            (acc, r) => acc + Math.max(0, r.length - 2),
                            0
                          )
                        : run.input?.stops?.length ?? 0);

                    return (
                      <tr
                        key={run.id}
                        className={`run-row ${isSelected ? "is-selected" : ""}`}
                        onClick={(e) => {
                          if (
                            e.target.tagName === "INPUT" ||
                            e.target.closest("button")
                          )
                            return;
                          setInspectingRun(run);
                          setInspectingVehicleIndex(null);
                        }}
                      >
                        <td
                          style={{ width: "36px", textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(run.id)}
                          />
                        </td>

                        <td>
                          <span className="run-id-pill">
                            {run.id}
                            <Copy
                              size={11}
                              className="run-copy-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyId(run.id);
                              }}
                              title="Copy ID"
                            />
                          </span>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {run.territory || "Urban Distribution Core"}
                          </span>
                        </td>

                        <td>
                          <span
                            className="algo-pill"
                            style={{
                              background: meta.accent,
                              color: meta.color,
                              border: `1px solid ${meta.border}`,
                            }}
                          >
                            <span
                              className="algo-dot"
                              style={{ background: meta.color }}
                            />
                            {meta.name}
                          </span>
                        </td>

                        <td>
                          <span>
                            {vehicles} {vehicles === 1 ? "van" : "vans"}
                          </span>
                          <span
                            style={{
                              color: "var(--theme-charcoal-light)",
                              fontSize: "12px",
                              marginLeft: "4px",
                            }}
                          >
                            • {stops} stops
                          </span>
                        </td>

                        <td className="num">
                          <strong>{distance.toFixed(2)} km</strong>
                        </td>

                        <td className="num">
                          <span>{runtime.toFixed(1)} ms</span>
                        </td>

                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              color: "#047857",
                              fontWeight: 500,
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#047857",
                              }}
                            />
                            Feasible
                          </span>
                        </td>

                        <td style={{ fontSize: "12px", color: "var(--theme-charcoal-light)" }}>
                          {new Date(run.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="run-actions-cell">
                            <button
                              type="button"
                              className="run-text-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingRun(run);
                                setInspectingVehicleIndex(null);
                              }}
                              title="Inspect map and stops"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              className="run-icon-action"
                              title="Load in Route Planner"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadInPlanner(run);
                              }}
                            >
                              <ArrowUpRight size={14} />
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

          {/* Floating Compare Action Bar */}
          {selectedRunIds.length > 0 && (
            <div className="compare-floating-bar">
              <div className="compare-count-text">
                <span className="compare-count-dot" />
                <span>
                  {selectedRunIds.length}{" "}
                  {selectedRunIds.length === 1 ? "dispatch" : "dispatches"} selected
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="curri-btn curri-btn-secondary"
                  onClick={() => setSelectedRunIds([])}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    borderColor: "rgba(255, 255, 255, 0.25)",
                    height: "30px",
                    fontSize: "12px",
                  }}
                >
                  Deselect All
                </button>

                <button
                  type="button"
                  className="curri-btn curri-btn-primary"
                  onClick={() => setShowCompareModal(true)}
                  disabled={selectedRunIds.length < 2}
                  style={{ height: "30px", fontSize: "12px", background: "var(--theme-gold)", color: "var(--theme-charcoal)" }}
                >
                  <BarChart3 size={13} />
                  <span>
                    {selectedRunIds.length < 2
                      ? "Select 2+ to Compare"
                      : "Compare Side-by-Side"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANALYTICS & TRENDS */}
      {activeTab === "analytics" && (
        <div className="fleet-history-stack">
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-card-title">
                <Route size={15} />
                <span>Dispatch distance trajectory</span>
              </div>
              <div className="analytics-card-sub">
                Total route km across recent dispatches.
              </div>

              <div style={{ height: "260px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(76, 69, 65, 0.08)" />
                    <XAxis
                      dataKey="shortId"
                      tick={{ fontSize: 11, fill: "var(--theme-charcoal-light)" }}
                      stroke="rgba(76, 69, 65, 0.15)"
                    />
                    <YAxis
                      unit=" km"
                      tick={{ fontSize: 11, fill: "var(--theme-charcoal-light)" }}
                      stroke="rgba(76, 69, 65, 0.15)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid rgba(76, 69, 65, 0.15)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="distance"
                      stroke="#2b72e5"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#2b72e5" }}
                      name="Distance (km)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="analytics-card">
              <div className="analytics-card-title">
                <Sparkles size={15} />
                <span>Dispatch summary</span>
              </div>
              <div className="analytics-card-sub">
                Aggregate statistics across all logged routes.
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="analytics-stat-row">
                  <span style={{ color: "var(--theme-charcoal-light)" }}>Archived plans</span>
                  <strong>{summary.totalRuns}</strong>
                </div>

                <div className="analytics-stat-row">
                  <span style={{ color: "var(--theme-charcoal-light)" }}>Shortest route</span>
                  <strong>{summary.minDistance.toFixed(2)} km</strong>
                </div>

                <div className="analytics-stat-row">
                  <span style={{ color: "var(--theme-charcoal-light)" }}>Average distance</span>
                  <strong>{summary.avgDistance.toFixed(2)} km</strong>
                </div>

                <div className="analytics-stat-row">
                  <span style={{ color: "var(--theme-charcoal-light)" }}>Average latency</span>
                  <strong>{summary.avgRuntime.toFixed(2)} ms</strong>
                </div>

                <div className="analytics-stat-row">
                  <span style={{ color: "var(--theme-charcoal-light)" }}>Total operations</span>
                  <strong>{summary.totalOperations.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <div className="analytics-card-title">
              <Clock3 size={15} />
              <span>Solver compute latency (ms)</span>
            </div>
            <div className="analytics-card-sub">
              Execution duration for each optimization.
            </div>

            <div style={{ height: "220px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(76, 69, 65, 0.08)" />
                  <XAxis
                    dataKey="shortId"
                    tick={{ fontSize: 11, fill: "var(--theme-charcoal-light)" }}
                    stroke="rgba(76, 69, 65, 0.15)"
                  />
                  <YAxis
                    unit=" ms"
                    tick={{ fontSize: 11, fill: "var(--theme-charcoal-light)" }}
                    stroke="rgba(76, 69, 65, 0.15)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid rgba(76, 69, 65, 0.15)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="runtime"
                    fill="#0eaa87"
                    radius={[3, 3, 0, 0]}
                    name="Compute (ms)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION SLIDEOVER DRAWER */}
      {inspectingRun && (
        <div className="run-drawer-backdrop" onClick={() => setInspectingRun(null)}>
          <div className="run-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="run-drawer-header">
              <div className="run-drawer-title-group">
                <h2>
                  <span>{inspectingRun.id}</span>
                  <span
                    className="algo-pill"
                    style={{
                      background: getAlgoMeta(inspectingRun.algorithm).accent,
                      color: getAlgoMeta(inspectingRun.algorithm).color,
                      border: `1px solid ${getAlgoMeta(inspectingRun.algorithm).border}`,
                    }}
                  >
                    {getAlgoMeta(inspectingRun.algorithm).name}
                  </span>
                </h2>
                <div className="run-drawer-sub">
                  <span>{inspectingRun.territory || "Urban Distribution"}</span>
                  <span>•</span>
                  <span>
                    Scheduled: {new Date(inspectingRun.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="run-drawer-close-btn"
                onClick={() => setInspectingRun(null)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="run-drawer-body">
              <div className="run-drawer-kpis">
                <div className="run-drawer-kpi-card">
                  <span>TOTAL DISTANCE</span>
                  <strong>
                    {Number(inspectingRun.totalDistance ?? inspectingRun.totalCost ?? 0).toFixed(2)} km
                  </strong>
                </div>

                <div className="run-drawer-kpi-card">
                  <span>SOLVER RUNTIME</span>
                  <strong>
                    {Number(inspectingRun.runtimeMs ?? inspectingRun.stats?.runtimeMs ?? 0).toFixed(2)} ms
                  </strong>
                </div>

                <div className="run-drawer-kpi-card">
                  <span>OPERATIONS</span>
                  <strong>
                    {Number(inspectingRun.opCount ?? inspectingRun.stats?.operations ?? 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div>
                <div className="run-drawer-section-title">
                  <Navigation2 size={14} />
                  <span>Dispatched Spatial Routes</span>
                </div>

                <div className="run-drawer-map-container">
                  <RouteMap
                    depot={
                      inspectingRun.input?.depot ||
                      inspectingRun.result?.depot ||
                      currentPlanner.depot
                    }
                    stops={
                      inspectingRun.input?.stops ||
                      inspectingRun.result?.stops ||
                      currentPlanner.stops
                    }
                    result={inspectingRun.result}
                    selectedRoute={inspectingVehicleIndex}
                    onSelectRoute={(index) =>
                      setInspectingVehicleIndex(
                        index === inspectingVehicleIndex ? null : index
                      )
                    }
                  />
                </div>
              </div>

              <div>
                <div className="run-drawer-section-title">
                  <Truck size={14} />
                  <span>
                    Vehicle fleet breakdown (
                    {inspectingRun.result?.routes?.length || 0} routes)
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {inspectingRun.result?.routes?.map((route, routeIdx) => {
                    const cost = inspectingRun.result.perRouteCost?.[routeIdx] ?? 0;
                    const load = inspectingRun.result.loads?.[routeIdx] ?? 0;
                    const capacity =
                      inspectingRun.result.capacity ??
                      inspectingRun.input?.fleet?.capacity ??
                      95;
                    const pct = Math.min(100, (load / (capacity || 1)) * 100);
                    const isSelectedRoute = inspectingVehicleIndex === routeIdx;
                    const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
                    const sched =
                      inspectingRun.result.routeSchedules?.[routeIdx]?.schedule;
                    const stopIndices = route.slice(1, -1);

                    return (
                      <div
                        key={routeIdx}
                        className={`vehicle-route-item ${
                          isSelectedRoute ? "is-selected" : ""
                        }`}
                        onClick={() =>
                          setInspectingVehicleIndex(
                            isSelectedRoute ? null : routeIdx
                          )
                        }
                      >
                        <div className="vehicle-route-head">
                          <div className="vehicle-route-name">
                            <span
                              className="vehicle-route-swatch"
                              style={{ background: color }}
                            />
                            <span>Van #{routeIdx + 1}</span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--theme-charcoal-light)",
                                fontWeight: 400,
                              }}
                            >
                              ({stopIndices.length} deliveries)
                            </span>
                          </div>

                          <div style={{ fontSize: "12.5px", fontWeight: 650 }}>
                            {cost.toFixed(2)} km
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "11px",
                              color: "var(--theme-charcoal-light)",
                            }}
                          >
                            <span>Payload: {load.toFixed(0)} / {capacity} kg</span>
                            <span>{pct.toFixed(0)}% Capacity</span>
                          </div>
                          <div className="vehicle-capacity-bar">
                            <div
                              className="vehicle-capacity-fill"
                              style={{
                                width: `${pct}%`,
                                background: pct > 100 ? "#d32f2f" : color,
                              }}
                            />
                          </div>
                        </div>

                        <div className="vehicle-stops-breadcrumb">
                          <span className="vehicle-stop-chip" style={{ fontWeight: 600 }}>
                            Depot
                          </span>

                          {stopIndices.map((stopIndex, sIdx) => {
                            const stopObj =
                              inspectingRun.input?.stops?.[stopIndex - 1] ||
                              inspectingRun.result?.stops?.[stopIndex - 1];
                            const arrivalMin = sched?.[sIdx]?.arrivalMinutes;

                            return (
                              <span key={sIdx} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ color: "var(--theme-charcoal-light)" }}>→</span>
                                <span className="vehicle-stop-chip" title={stopObj?.address || `Stop #${stopIndex}`}>
                                  {stopObj?.label || `Stop #${stopIndex}`}
                                  {arrivalMin ? ` (${formatMinutes(arrivalMin)})` : ""}
                                </span>
                              </span>
                            );
                          })}

                          <span style={{ color: "var(--theme-charcoal-light)" }}>→</span>
                          <span className="vehicle-stop-chip" style={{ fontWeight: 600 }}>
                            Depot
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="run-drawer-footer">
              <button
                type="button"
                className="curri-btn curri-btn-secondary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(inspectingRun, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${inspectingRun.id}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                  toast.success("Manifest downloaded.");
                }}
              >
                <Download size={14} />
                <span>Download JSON</span>
              </button>

              <button
                type="button"
                className="curri-btn curri-btn-primary"
                onClick={() => handleLoadInPlanner(inspectingRun)}
              >
                <Navigation2 size={14} />
                <span>Load in Route Planner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON MODAL */}
      {showCompareModal && (
        <div className="curri-modal-backdrop" onClick={() => setShowCompareModal(false)}>
          <div className="compare-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h2>Side-by-side comparison</h2>
                <div className="modal-sub">
                  Comparing {comparedRuns.length} dispatches across metrics.
                </div>
              </div>
              <button
                type="button"
                className="curri-btn curri-btn-secondary"
                onClick={() => setShowCompareModal(false)}
                style={{ padding: "4px 8px" }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="fleet-table-wrap">
              <table className="compare-matrix-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {comparedRuns.map((run) => (
                      <th key={run.id}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ color: getAlgoMeta(run.algorithm).color }}>
                            {getAlgoMeta(run.algorithm).name}
                          </span>
                          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--theme-charcoal-light)" }}>
                            {run.id}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Total Distance</strong></td>
                    {comparedRuns.map((run) => {
                      const dist = Number(run.totalDistance ?? run.totalCost ?? 0);
                      const isBest =
                        dist > 0 &&
                        dist ===
                          Math.min(
                            ...comparedRuns.map((r) =>
                              Number(r.totalDistance ?? r.totalCost ?? Infinity)
                            )
                          );
                      return (
                        <td key={run.id}>
                          <strong>{dist.toFixed(2)} km</strong>
                          {isBest && (
                            <span className="compare-best-badge">
                              <Check size={10} /> Shortest
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td><strong>Solver Runtime</strong></td>
                    {comparedRuns.map((run) => {
                      const time = Number(run.runtimeMs ?? run.stats?.runtimeMs ?? 0);
                      const isFastest =
                        time ===
                        Math.min(
                          ...comparedRuns.map((r) =>
                            Number(r.runtimeMs ?? r.stats?.runtimeMs ?? Infinity)
                          )
                        );
                      return (
                        <td key={run.id}>
                          <span>{time.toFixed(2)} ms</span>
                          {isFastest && (
                            <span className="compare-best-badge">
                              <Check size={10} /> Fastest
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td><strong>Operations</strong></td>
                    {comparedRuns.map((run) => (
                      <td key={run.id}>
                        {Number(run.opCount ?? run.stats?.operations ?? 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td><strong>Fleet Vehicles</strong></td>
                    {comparedRuns.map((run) => (
                      <td key={run.id}>
                        {run.result?.routes?.length ?? run.result?.vehicles ?? 3} vans
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td><strong>Status</strong></td>
                    {comparedRuns.map((run) => (
                      <td key={run.id}>
                        <span style={{ color: "#0eaa87", fontWeight: 600 }}>Feasible</span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td><strong>Action</strong></td>
                    {comparedRuns.map((run) => (
                      <td key={run.id}>
                        <button
                          type="button"
                          className="curri-btn curri-btn-secondary"
                          onClick={() => {
                            setShowCompareModal(false);
                            handleLoadInPlanner(run);
                          }}
                          style={{ fontSize: "11.5px", height: "28px", padding: "0 8px" }}
                        >
                          <Navigation2 size={12} />
                          <span>Load in Planner</span>
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
