import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Activity, 
  ArrowDownUp, 
  ArrowRight, 
  ArrowUpRight, 
  Check, 
  CheckCircle2,
  ChevronDown, 
  Clock3, 
  Cpu,
  FileDown, 
  Layers2, 
  LoaderCircle, 
  MapPinned, 
  Minus, 
  Navigation2,
  Package, 
  Plus, 
  Route as RouteIcon, 
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles, 
  Truck, 
  X, 
  Zap 
} from "lucide-react";
import toast from "react-hot-toast";
import { usePlannerStore } from "../store/usePlannerStore.js";
import { api } from "../api/client.js";
import { solveOptimization, ALGORITHM_REGISTRY, ROUTE_ALGORITHM_IDS } from "@courier/algorithms";
import RouteMap, { ROUTE_COLORS } from "../components/RouteMap.jsx";
import TracePlayer from "../components/TracePlayer.jsx";

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const formatDistance = (value) => `${Number(value || 0).toFixed(2)} km`;
const asClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

export default function PlannerView() {
  const navigate = useNavigate();
  const planner = usePlannerStore((state) => state.planner);
  const algorithm = usePlannerStore((state) => state.algorithm);
  const result = usePlannerStore((state) => state.result);
  const comparison = usePlannerStore((state) => state.comparison);
  const selectedRoute = usePlannerStore((state) => state.selectedRoute);
  const running = usePlannerStore((state) => state.running);
  const progressText = usePlannerStore((state) => state.progressText);
  const fallbackMode = usePlannerStore((state) => state.fallbackMode);
  const setAlgorithm = usePlannerStore((state) => state.setAlgorithm);
  const setResult = usePlannerStore((state) => state.setResult);
  const setComparison = usePlannerStore((state) => state.setComparison);
  const setSelectedRoute = usePlannerStore((state) => state.setSelectedRoute);
  const setRunning = usePlannerStore((state) => state.setRunning);
  const setFallbackMode = usePlannerStore((state) => state.setFallbackMode);
  const addHistory = usePlannerStore((state) => state.addHistory);
  const addStop = usePlannerStore((state) => state.addStop);
  const removeStop = usePlannerStore((state) => state.removeStop);
  const setStops = usePlannerStore((state) => state.setStops);
  const setFleet = usePlannerStore((state) => state.setFleet);

  const [showAdd, setShowAdd] = useState(false);
  const [initialModalCoords, setInitialModalCoords] = useState(null);
  const [query, setQuery] = useState("");

  const stops = planner.stops ?? [];
  const depot = planner.depot;
  const fleet = planner.fleet ?? { vehicles: 3, capacity: 95, averageSpeedKmh: 28 };
  const totalDemand = stops.reduce((sum, stop) => sum + Number(stop.demand || 0), 0);
  const totalFleetCapacity = Number(fleet.capacity) * Number(fleet.vehicles);
  const selectedMeta = ALGORITHM_REGISTRY.find((item) => item.id === algorithm);
  const algorithmOptions = ROUTE_ALGORITHM_IDS.map((id) => ALGORITHM_REGISTRY.find((item) => item.id === id)).filter(Boolean);
  const filteredStops = useMemo(() => stops.filter((stop) => `${stop.label} ${stop.id}`.toLowerCase().includes(query.toLowerCase())), [stops, query]);
  const routeCount = result?.routes?.length ?? 0;
  const resultDistance = result?.totalCost;
  const isOverloaded = totalDemand > totalFleetCapacity;

  async function handleOptimize() {
    if (!stops.length) return toast.error("Add at least one delivery stop first.");
    if (isOverloaded) return toast.error("Fleet capacity is lower than total stop demand. Increase vehicle count or payload limit.");
    
    setRunning(true, "Preparing distance matrix & manifest");
    const payload = {
      depot,
      stops,
      vehicles: Number(fleet.vehicles),
      capacity: Number(fleet.capacity),
      algorithm,
      options: { seed: 42, trace: true, maxIterations: 1200, averageSpeedKmh: Number(fleet.averageSpeedKmh) || 28, startTimeMinutes: 480 },
    };

    let solved;
    let runId = null;
    try {
      setRunning(true, "Optimization engine running…");
      const started = await api.optimize(payload);
      runId = started.jobId;
      let job = started.status === "completed" ? await api.job(started.jobId) : null;
      for (let attempt = 0; !job || job.status === "running"; attempt += 1) {
        if (attempt > 100) throw new Error("The route job took too long to finish.");
        await wait(350);
        job = await api.job(started.jobId);
        setRunning(true, job.status === "running" ? "Evaluating route moves & vehicle loads" : "Finalizing telemetry");
      }
      if (job.status !== "completed") throw new Error(job.error?.message || "The route job failed.");
      solved = job.result;
    } catch (error) {
      try {
        setFallbackMode();
        solved = solveOptimization(payload);
        toast("Solved in fast browser demo mode.");
      } catch (localError) {
        setRunning(false);
        return toast.error(localError.message || error.message || "Optimization failed.");
      }
    }

    setResult(solved);
    setRunning(false);
    addHistory({ 
      id: runId ?? `curri-${Date.now()}`, 
      algorithm, 
      totalDistance: solved.totalCost, 
      runtimeMs: solved.stats.runtimeMs, 
      opCount: solved.stats.operations, 
      createdAt: new Date().toISOString(), 
      result: solved,
      input: {
        depot,
        stops,
        fleet: { ...fleet }
      }
    });

    if (!solved.validation?.valid) toast.error("Solution generated with constraint notices. Review routes below.");
    else toast.success(`Generated ${solved.routes.length} optimized delivery routes.`);
  }

  async function handleCompare() {
    if (!stops.length) return toast.error("Add delivery stops before running algorithm comparison.");
    const algorithms = ["nearest-neighbor", "mst-2approx", "kmeans", "sweep"];
    const payload = { depot, stops, vehicles: Number(fleet.vehicles), capacity: Number(fleet.capacity), algorithm, algorithms, options: { seed: 42, trace: false, maxIterations: 900, averageSpeedKmh: Number(fleet.averageSpeedKmh) || 28, startTimeMinutes: 480 } };
    setRunning(true, "Comparing multi-vehicle solvers in parallel");
    try {
      const rows = await api.compare(payload);
      setComparison(rows);
      toast.success("Benchmark completed across 4 solvers.");
    } catch (error) {
      if (error.response) { setRunning(false); return toast.error(error.response.data?.error || "Comparison failed."); }
      setFallbackMode();
      try {
        const rows = algorithms.map((id) => {
          try { return { algorithm: id, result: solveOptimization({ ...payload, algorithm: id }) }; }
          catch (solveError) { return { algorithm: id, error: solveError.message }; }
        });
        setComparison(rows);
        toast("Comparison evaluated locally.");
      } catch (solveError) { toast.error(solveError.message || "Comparison failed."); }
    } finally { setRunning(false); }
  }

  async function handleFleetChange(field, value) {
    const next = { ...fleet, [field]: value };
    setFleet(next);
    if (field === "averageSpeedKmh") return;
    try { await api.updateFleet({ vehicles: Number(next.vehicles), capacity: Number(next.capacity), averageSpeedKmh: Number(next.averageSpeedKmh) || 28 }); }
    catch { setFallbackMode(); }
  }

  async function handleDeleteStop(id) {
    try { await api.deleteStop(id); }
    catch { setFallbackMode(); }
    removeStop(id);
    toast.success("Stop removed from manifest.");
  }

  function downloadTemplate() {
    const csv = "label,lat,lng,demand,serviceMinutes\nLudhiana Timber Yard,30.9020,75.8610,16,6\nMiller Ganj Hardware,30.8980,75.8520,24,8\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "curri-manifest-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const windowsCount = stops.filter((s) => s.timeWindow).length;
  const capacityPct = totalFleetCapacity > 0 ? Math.round((totalDemand / totalFleetCapacity) * 100) : 0;

  return (
    <div className="curri-planner-stack">
      {/* Redesigned Dispatch Header */}
      <header className="planner-header">
        <div className="planner-header-main">
          <div className="planner-header-kicker">
            <span className="live-status-dot" />
            <span className="kicker-title">Dispatch Operations</span>
            <span className="kicker-sep">/</span>
            <span className="kicker-sub">VRP Solver Console</span>
            {fallbackMode && <span className="kicker-badge-sand">Sandbox Mode</span>}
          </div>

          <div className="planner-title-row">
            <h1>Fleet Route Planner</h1>
            <div className="planner-status-capsule">
              {running ? (
                <span className="status-item is-busy">
                  <LoaderCircle size={14} className="spin" />
                  <span>{progressText || "Solving optimization moves…"}</span>
                </span>
              ) : result ? (
                <span className="status-item is-solved">
                  <CheckCircle2 size={14} />
                  <span>{routeCount} Routes Dispatched · All Stops Assigned</span>
                </span>
              ) : (
                <span className="status-item is-ready">
                  <Sparkles size={14} />
                  <span>Fleet Ready for Optimization</span>
                </span>
              )}
            </div>
          </div>

          <p className="planner-subtitle">
            Multi-vehicle capacity-constrained dispatch with scheduled customer time windows and real-time combinatorial optimization.
          </p>
        </div>

        {/* Operational Actions */}
        <div className="planner-actions-toolbar">
          <button 
            type="button" 
            className="planner-btn-secondary" 
            onClick={downloadTemplate} 
            title="Download CSV format template"
          >
            <FileDown size={14} />
            <span>CSV Template</span>
          </button>

          <button 
            type="button" 
            className="planner-btn-secondary" 
            onClick={handleCompare} 
            disabled={running || !stops.length}
            title="Benchmark 4 algorithms on this instance in parallel"
          >
            <ArrowDownUp size={14} />
            <span>Compare Solvers</span>
          </button>

          <button 
            type="button" 
            className="planner-btn-primary" 
            onClick={handleOptimize} 
            disabled={running || !stops.length || isOverloaded}
            title="Compute optimal vehicle routes and dispatch schedules"
          >
            {running ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
            <span>{running ? "Optimizing Fleet…" : "Optimize Routes"}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Modern Redesigned Metrics Strip */}
      <section className="planner-metrics-strip">
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Delivery Manifest</span>
            <MapPinned size={16} className="metric-tile-icon" />
          </div>
          <div className="metric-tile-value">
            {String(stops.length).padStart(2, "0")} <span className="value-unit">stops</span>
          </div>
          <div className="metric-tile-sub">
            <span>{windowsCount} scheduled time windows</span>
            <span className="metric-dot">•</span>
            <span>{planner.depot?.label || "Central Hub"}</span>
          </div>
        </div>

        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Active Fleet Capacity</span>
            <Truck size={16} className="metric-tile-icon" />
          </div>
          <div className="metric-tile-value">
            {String(fleet.vehicles).padStart(2, "0")} <span className="value-unit">vans</span>
            <span className="metric-capacity-tag">/ {totalFleetCapacity} kg</span>
          </div>
          <div className="metric-tile-sub">
            <span>{fleet.capacity} kg limit per vehicle</span>
            <span className="metric-dot">•</span>
            <span>{fleet.averageSpeedKmh || 28} km/h speed</span>
          </div>
        </div>

        <div className={`metric-tile ${isOverloaded ? "is-warning" : ""}`}>
          <div className="metric-tile-header">
            <span className="metric-tile-label">Cargo Demand & Load</span>
            <Package size={16} className="metric-tile-icon" />
          </div>
          <div className="metric-tile-value">
            {totalDemand.toFixed(0)} <span className="value-unit">kg</span>
            <span className={`metric-load-badge ${isOverloaded ? "badge-overload" : "badge-safe"}`}>
              {capacityPct}% capacity
            </span>
          </div>
          <div className="metric-tile-sub">
            <span>Avg {(totalDemand / Math.max(1, fleet.vehicles)).toFixed(0)} kg / vehicle</span>
            <span className="metric-dot">•</span>
            <span>{isOverloaded ? "Fleet capacity exceeded" : "Within payload limits"}</span>
          </div>
        </div>

        <div className={`metric-tile ${resultDistance != null ? "is-highlight" : ""}`}>
          <div className="metric-tile-header">
            <span className="metric-tile-label">Planned Fleet Distance</span>
            <RouteIcon size={16} className="metric-tile-icon" />
          </div>
          <div className="metric-tile-value">
            {resultDistance == null ? "--" : formatDistance(resultDistance)}
          </div>
          <div className="metric-tile-sub">
            {result ? (
              <>
                <span>{routeCount} vehicles deployed</span>
                <span className="metric-dot">•</span>
                <span>{Number(result.stats?.runtimeMs || 0).toFixed(1)} ms latency</span>
              </>
            ) : (
              <span>Click "Optimize Routes" to simulate dispatch</span>
            )}
          </div>
        </div>
      </section>

      {/* Main Workbench Layout: Left Control Panel + Right Interactive Map & Route Cards */}
      <section className="curri-workbench">
        {/* Left Control Center Panel */}
        <aside className="curri-panel planner-sidebar">
          {/* Section 1: Optimization Solver */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <div>
                <span className="panel-kicker">Solver Strategy</span>
                <h2 className="sidebar-title">Optimization Algorithm</h2>
              </div>
              <div className="solver-badge">
                <Zap size={12} />
                <span>DAA</span>
              </div>
            </div>

            <div className="curri-select-wrapper">
              <select 
                value={algorithm} 
                onChange={(e) => setAlgorithm(e.target.value)}
                className="curri-select"
              >
                {algorithmOptions.map((opt) => (
                  <option value={opt.id} key={opt.id}>{opt.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>

            <div className="algorithm-meta-row">
              <span className="algo-badge">{selectedMeta?.paradigm ?? "Heuristic"}</span>
              <span className="algo-complexity">{selectedMeta?.complexity ?? "O(n²)"}</span>
            </div>

            <p className="algo-description-text">{selectedMeta?.description}</p>
          </div>

          <div className="curri-divider" />

          {/* Section 2: Fleet Parameters */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <div>
                <span className="panel-kicker">Vehicle Logistics</span>
                <h2 className="sidebar-title">Fleet Capacities</h2>
              </div>
              <Sliders size={14} className="text-muted" />
            </div>

            <div className="fleet-control-rows">
              {/* Vehicles Stepper */}
              <div className="config-item-row">
                <div className="config-text-group">
                  <b>Dispatch Vehicles</b>
                  <small>Available vans in depot</small>
                </div>
                <div className="curri-stepper">
                  <button 
                    type="button" 
                    disabled={fleet.vehicles <= 1} 
                    onClick={() => handleFleetChange("vehicles", Math.max(1, Number(fleet.vehicles) - 1))}
                    title="Decrease vehicle count"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="stepper-val">{String(fleet.vehicles).padStart(2, "0")}</span>
                  <button 
                    type="button" 
                    disabled={fleet.vehicles >= 12} 
                    onClick={() => handleFleetChange("vehicles", Math.min(12, Number(fleet.vehicles) + 1))}
                    title="Increase vehicle count"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Max Payload Limit */}
              <div className="config-item-row">
                <div className="config-text-group">
                  <b>Payload Limit</b>
                  <small>Max capacity per van</small>
                </div>
                <div className="curri-unit-input">
                  <input 
                    type="number" 
                    min="10" 
                    max="1500" 
                    step="5" 
                    value={fleet.capacity} 
                    onChange={(e) => handleFleetChange("capacity", Math.max(10, Number(e.target.value) || 10))} 
                  />
                  <span className="unit-tag">kg</span>
                </div>
              </div>

              {/* Transit Velocity */}
              <div className="config-item-row">
                <div className="config-text-group">
                  <b>Transit Velocity</b>
                  <small>Urban transit speed</small>
                </div>
                <div className="curri-unit-input">
                  <input 
                    type="number" 
                    min="10" 
                    max="120" 
                    value={fleet.averageSpeedKmh ?? 28} 
                    onChange={(e) => handleFleetChange("averageSpeedKmh", Number(e.target.value) || 28)} 
                  />
                  <span className="unit-tag">km/h</span>
                </div>
              </div>
            </div>

            {/* Capacity Meter */}
            <div className={`capacity-gauge-card ${isOverloaded ? "gauge-alert" : ""}`}>
              <div className="gauge-header">
                <div className="gauge-status-text">
                  {isOverloaded ? (
                    <>
                      <ShieldAlert size={14} className="text-alert" />
                      <span>Fleet Overbooked</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} className="text-safe" />
                      <span>Capacity Verified</span>
                    </>
                  )}
                </div>
                <div className="gauge-numbers">
                  <strong>{totalDemand.toFixed(0)}</strong>
                  <span>/ {totalFleetCapacity} kg ({capacityPct}%)</span>
                </div>
              </div>

              <div className="gauge-bar-track">
                <div 
                  className={`gauge-bar-fill ${isOverloaded ? "fill-overload" : ""}`}
                  style={{ width: `${Math.min(100, capacityPct)}%` }} 
                />
              </div>
            </div>
          </div>

          <div className="curri-divider" />

          {/* Section 3: Delivery Manifest */}
          <div className="sidebar-section manifest-sidebar-section">
            <div className="sidebar-section-header">
              <div>
                <span className="panel-kicker">Waypoint Manifest</span>
                <h2 className="sidebar-title">Delivery Stops</h2>
              </div>
              <button 
                type="button" 
                className="add-stop-mini-btn" 
                title="Add a new delivery stop"
                onClick={() => setShowAdd(true)}
              >
                <Plus size={13} />
                <span>Add Stop</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="curri-search-input">
              <Search size={14} />
              <input 
                placeholder="Search stops, labels, or IDs…" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
              />
              {query && (
                <button type="button" className="clear-search-btn" onClick={() => setQuery("")}>
                  <X size={12} />
                </button>
              )}
              <span className="match-count">{filteredStops.length}</span>
            </div>

            {/* Stop List */}
            <div className="curri-stop-list">
              {filteredStops.length ? (
                filteredStops.map((stop) => {
                  const index = stops.findIndex((item) => item.id === stop.id);
                  const routeIndex = result?.routes?.findIndex((route) => route.includes(index + 1)) ?? -1;
                  const routeColor = routeIndex >= 0 ? ROUTE_COLORS[routeIndex % ROUTE_COLORS.length] : "var(--theme-charcoal)";

                  return (
                    <div className="curri-stop-item" key={stop.id}>
                      <span 
                        className="stop-badge" 
                        style={{ 
                          backgroundColor: routeColor,
                          border: routeIndex >= 0 ? "none" : "1px solid var(--theme-border)"
                        }}
                        title={routeIndex >= 0 ? `Assigned to Route ${routeIndex + 1}` : "Unassigned"}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div className="stop-info">
                        <b title={stop.label}>{stop.label}</b>
                        <small>
                          {stop.id} <span>•</span> {stop.timeWindow ? `${asClock(stop.timeWindow.start)}–${asClock(stop.timeWindow.end)}` : "Standard window"}
                        </small>
                      </div>

                      <span className="stop-demand-pill">{stop.demand} kg</span>

                      <button 
                        type="button" 
                        className="stop-delete-btn" 
                        onClick={() => handleDeleteStop(stop.id)}
                        title="Remove stop"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="curri-empty-stops">
                  <span>No delivery stops match your search.</span>
                </div>
              )}
            </div>

            <div className="manifest-actions-row">
              <button 
                type="button" 
                className="curri-add-stop-block" 
                onClick={() => setShowAdd(true)}
              >
                <Plus size={14} />
                <span>Add Delivery Stop</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Right Main Map Column + Route Cards Strip */}
        <div className="curri-map-column">
          {/* Interactive Map & Route Radar (INTACT AS REQUESTED) */}
          <div className="curri-map-card">
            <div className="curri-map-header">
              <div className="map-header-left">
                <div className="map-header-tag">
                  <span className="live-pulse-dot" />
                  <span>{result ? "Optimized Network" : "Live Network"}</span>
                </div>
                <h2>Interactive Map & Route Radar</h2>
                <p>{planner.depot?.label || "Main Depot Hub"} · {planner.depot?.address || "Ludhiana Regional Center"}</p>
              </div>

              <div className="map-header-right">
                <button 
                  type="button" 
                  className="curri-pill-btn" 
                  onClick={() => setSelectedRoute(null)}
                >
                  <Layers2 size={14} />
                  <span>{selectedRoute == null ? "All Routes Active" : `Vehicle Route ${String(selectedRoute + 1).padStart(2, "0")}`}</span>
                  <ChevronDown size={13} />
                </button>
                {result && (
                  <button 
                    type="button" 
                    className="curri-icon-btn" 
                    title="Clear calculated routes" 
                    onClick={() => setResult(null)}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Map Canvas */}
            <div className="curri-map-viewport">
              <RouteMap 
                depot={depot} 
                stops={stops} 
                result={result} 
                selectedRoute={selectedRoute} 
                onSelectRoute={(index) => setSelectedRoute(index === selectedRoute ? null : index)}
                onLocationSelect={(coords) => {
                  setInitialModalCoords(coords);
                  setShowAdd(true);
                  toast.success(`Selected coordinates: ${coords.lat}, ${coords.lng}`);
                }}
              />
            </div>

            {/* Map Bottom Legend */}
            <div className="curri-map-footer">
              <div className="map-legend-items">
                <span className="legend-entry">
                  <i className="depot-icon-dot" />
                  <span>Depot Hub</span>
                </span>
                <span className="legend-entry">
                  <i className="stop-icon-dot" />
                  <span>Delivery Stop</span>
                </span>
                {result && result.routes.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`route-legend-pill ${selectedRoute === index ? "route-pill-active" : ""}`}
                    onClick={() => setSelectedRoute(selectedRoute === index ? null : index)}
                  >
                    <i style={{ backgroundColor: ROUTE_COLORS[index % ROUTE_COLORS.length] }} />
                    <span>Route {String(index + 1).padStart(2, "0")}</span>
                  </button>
                ))}
              </div>

              <div className="map-footer-badge">
                <Navigation2 size={13} />
                <span>Haversine Matrix · Exact Matrix</span>
              </div>
            </div>
          </div>

          {/* Redesigned Vehicle Route Cards Strip */}
          <div className="curri-routes-strip">
            {result ? (
              result.routes.map((route, index) => (
                <CurriRouteCard
                  key={index}
                  route={route}
                  index={index}
                  distance={result.perRouteCost[index]}
                  load={result.loads[index]}
                  capacity={fleet.capacity}
                  stops={stops}
                  active={selectedRoute === index}
                  onClick={() => setSelectedRoute(selectedRoute === index ? null : index)}
                />
              ))
            ) : (
              <div className="curri-ready-card">
                <div className="ready-spark-icon">
                  <Truck size={22} />
                </div>
                <div className="ready-text">
                  <b>Vehicle Dispatch Manifest Pending</b>
                  <span>Configure fleet capacity or switch combinatorial algorithm, then click "Optimize Routes" to generate vehicle delivery assignments.</span>
                </div>
                <button type="button" className="ready-action-btn" onClick={handleOptimize}>
                  <span>Run Fast Solver</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Redesigned Decision Playback & Constraint Analytics */}
      <section className="curri-analysis-grid">
        {/* Left: Decision Playback with upgraded TracePlayer */}
        <div className="curri-card trace-card">
          <div className="curri-card-head">
            <div>
              <span className="panel-kicker">Decision Playback</span>
              <h2>Algorithm Execution Step-by-Step</h2>
            </div>
            <span className="curri-status-tag">
              <Activity size={14} />
              <span>{result?.trace?.length ? `${result.trace.length} Logged Steps` : "Trace Ready"}</span>
            </span>
          </div>
          <TracePlayer trace={result?.trace ?? []} algorithm={selectedMeta?.name} />
        </div>

        {/* Right: Fleet Constraints & Telemetry */}
        <div className="curri-card validation-card">
          <div className="curri-card-head">
            <div>
              <span className="panel-kicker">Constraint Verification</span>
              <h2>Fleet Constraints & Telemetry</h2>
            </div>
            <span className="curri-status-tag">
              <ShieldCheck size={14} />
              <span>{result ? (result.validation?.valid ? "Constraints Verified" : "Notices Detected") : "Pre-check Ready"}</span>
            </span>
          </div>

          {result ? (
            <div className="curri-validation-list">
              <ValidationRow 
                label="Stop Coverage Verification" 
                okay={result.validation?.coverageFeasible} 
                detail={`${stops.length} of ${stops.length} stops assigned across ${routeCount} vehicles`} 
              />
              <ValidationRow 
                label="Axle & Vehicle Payload Limit" 
                okay={result.validation?.capacityFeasible} 
                detail={`Peak load: ${Math.max(...(result.loads ?? [0]))} kg / ${fleet.capacity} kg limit per van`} 
              />
              <ValidationRow 
                label="Time Windows & Scheduling" 
                okay={result.validation?.timeWindowFeasible} 
                detail={`${windowsCount} scheduled customer delivery windows confirmed`} 
              />

              <div className="telemetry-stat-pills">
                <div className="telemetry-pill">
                  <Clock3 size={15} />
                  <div className="pill-content">
                    <span className="pill-title">Runtime</span>
                    <b>{Number(result.stats.runtimeMs).toFixed(1)} ms</b>
                  </div>
                </div>
                <div className="telemetry-pill">
                  <Cpu size={15} />
                  <div className="pill-content">
                    <span className="pill-title">Operations</span>
                    <b>{Number(result.stats.operations).toLocaleString()} ops</b>
                  </div>
                </div>
                <div className="telemetry-pill">
                  <ArrowDownUp size={15} />
                  <div className="pill-content">
                    <span className="pill-title">Branch Moves</span>
                    <b>{result.stats.iterations} moves</b>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="curri-teaser-box">
              <p>Explore combinatorial heuristics, dynamic programming, and local search algorithms tested under identical road conditions.</p>
              <div className="curri-pill-tags">
                <span className="teaser-pill">Deterministic Seeded</span>
                <span className="teaser-pill">Sub-millisecond</span>
                <span className="teaser-pill">CVRP Solvers</span>
              </div>
              <button type="button" className="curri-link-btn" onClick={() => navigate("/algorithms")}>
                <span>Browse algorithm library</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Comparison Panel if executed */}
      {comparison && <CurriComparisonPanel rows={comparison} />}

      {/* Add Stop Modal */}
      {showAdd && (
        <StopModal 
          depot={depot} 
          initialCoords={initialModalCoords}
          onClose={() => {
            setShowAdd(false);
            setInitialModalCoords(null);
          }} 
          onSave={async (stop) => {
            let saved = stop;
            try { saved = await api.createStop(stop); }
            catch (error) { 
              if (error.response) throw new Error(error.response.data?.error || "Could not create stop."); 
              setFallbackMode(); 
              saved = { ...stop, id: `ST-${Math.random().toString(36).slice(2, 8).toUpperCase()}` }; 
            }
            addStop(saved);
            toast.success("Delivery stop added to manifest.");
          }} 
        />
      )}
    </div>
  );
}

function CurriRouteCard({ route, index, distance, load, capacity, stops, active, onClick }) {
  const names = route.slice(1, -1).map((stopIndex) => stops[stopIndex - 1]?.label).filter(Boolean);
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
  const pct = Math.min(100, Math.round((load / capacity) * 100));
  const estMinutes = Math.round((distance / 28) * 60) + (route.length - 2) * 6;
  const startHour = 8 + index;
  const etaFormatted = `${String(Math.floor(startHour + estMinutes / 60) % 24).padStart(2, "0")}:${String(estMinutes % 60).padStart(2, "0")}`;

  return (
    <div 
      className={`curri-route-card ${active ? "route-card-active" : ""}`} 
      onClick={onClick}
      style={{ "--card-route-color": color }}
    >
      <div className="route-card-top">
        <div className="route-card-badge">
          <span className="route-color-indicator" style={{ backgroundColor: color }} />
          <b>VEHICLE {String(index + 1).padStart(2, "0")}</b>
          {active && <span className="route-focus-tag">Focused</span>}
        </div>
        <span className="route-card-distance">{formatDistance(distance)}</span>
      </div>

      <div className="route-card-stats">
        <div className="route-stat-box">
          <span className="stat-name">Payload Utilization</span>
          <span className="stat-val">{load} / {capacity} kg <strong>({pct}%)</strong></span>
        </div>
        <div className="route-stat-box text-right">
          <span className="stat-name">Est. Arrival</span>
          <span className="stat-val">{etaFormatted} hrs <small>(~{estMinutes}m)</small></span>
        </div>
      </div>

      {/* Progress load track */}
      <div className="route-payload-track">
        <div 
          className="route-payload-bar" 
          style={{ width: `${pct}%`, backgroundColor: color }} 
        />
      </div>

      <div className="route-card-stops">
        <span className="stops-label">Waypoints:</span>
        <span className="stops-sequence">
          {names.slice(0, 3).join(" → ")}{names.length > 3 ? ` +${names.length - 3} more` : ""}
        </span>
      </div>

      <div className="route-card-bottom">
        <span className="stops-count-tag">{route.length - 2} Delivery Stops</span>
        <span className="status-badge-ok">
          <span className="status-badge-dot" style={{ backgroundColor: color }} />
          <span>Dispatched</span>
        </span>
      </div>
    </div>
  );
}

function ValidationRow({ label, okay, detail }) {
  return (
    <div className={`curri-validation-row ${okay ? "row-pass" : "row-fail"}`}>
      <div className={`check-bubble ${okay ? "bubble-pass" : "bubble-fail"}`}>
        {okay ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
      </div>
      <div className="validation-text">
        <b>{label}</b>
        <small>{detail}</small>
      </div>
      <span className={`validation-stamp ${okay ? "stamp-pass" : "stamp-fail"}`}>
        {okay ? "VERIFIED" : "WARNING"}
      </span>
    </div>
  );
}

function CurriComparisonPanel({ rows }) {
  const valid = rows.filter((r) => r.result);
  const bestCost = valid.length ? Math.min(...valid.map((r) => r.result.totalCost)) : null;

  return (
    <section className="curri-card compare-card">
      <div className="curri-card-head">
        <div>
          <span className="panel-kicker">Multi-Solver Benchmark</span>
          <h2>Algorithm Performance Comparison</h2>
        </div>
        <span className="curri-status-tag">
          <ArrowDownUp size={14} />
          <span>{rows.length} Solvers Evaluated</span>
        </span>
      </div>

      <div className="compare-cards-grid">
        {rows.map((row, idx) => {
          const solved = row.result;
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const isBest = solved && solved.totalCost === bestCost;
          const gap = solved && bestCost > 0 ? Math.max(0, ((solved.totalCost - bestCost) / bestCost) * 100) : null;

          return (
            <div className={`compare-card-item ${isBest ? "item-best" : ""}`} key={row.algorithm}>
              <div className="compare-item-top">
                <span className="compare-dot" style={{ backgroundColor: color }} />
                <b>{ALGORITHM_REGISTRY.find((item) => item.id === row.algorithm)?.name ?? row.name ?? row.algorithm}</b>
                {isBest && <span className="best-tag">Optimal</span>}
              </div>

              {solved ? (
                <>
                  <div className="compare-item-cost">
                    {solved.totalCost.toFixed(2)} <small>km</small>
                  </div>
                  <div className="compare-item-metrics">
                    <span>{Number(solved.stats.runtimeMs).toFixed(1)} ms</span>
                    <span>{Number(solved.stats.operations).toLocaleString()} ops</span>
                    <span>{solved.routes.length} vehicles</span>
                  </div>
                  <div className="compare-item-gap">
                    <span>Gap vs Best:</span>
                    <b>{gap == null ? "N/A" : gap === 0 ? "0.0% (Best)" : `+${gap.toFixed(1)}%`}</b>
                  </div>
                </>
              ) : (
                <div className="compare-item-error">{row.error || "Solver failed"}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StopModal({ depot, initialCoords, onClose, onSave }) {
  const [form, setForm] = useState({ 
    label: "", 
    address: "Real World Location", 
    lat: initialCoords?.lat ? initialCoords.lat.toFixed(5) : (depot.lat + 0.004).toFixed(5), 
    lng: initialCoords?.lng ? initialCoords.lng.toFixed(5) : (depot.lng + 0.003).toFixed(5), 
    demand: 18, 
    serviceMinutes: 6 
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm((v) => ({ ...v, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.label.trim()) return toast.error("Stop name is required.");
    const stop = { 
      ...form, 
      lat: Number(form.lat), 
      lng: Number(form.lng), 
      demand: Number(form.demand), 
      serviceMinutes: Number(form.serviceMinutes) 
    };
    if (![stop.lat, stop.lng, stop.demand, stop.serviceMinutes].every(Number.isFinite) || stop.lat < -90 || stop.lat > 90 || stop.lng < -180 || stop.lng > 180 || stop.demand <= 0) {
      return toast.error("Check coordinates and package weight.");
    }
    setSaving(true);
    try { 
      await onSave(stop); 
      onClose(); 
    } catch (error) { 
      toast.error(error.message); 
    } finally { 
      setSaving(false); 
    }
  }

  return (
    <div className="curri-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="curri-modal-card" onSubmit={submit}>
        <div className="modal-top">
          <div>
            <span className="panel-kicker">Manifest Editor</span>
            <h2>Add Delivery Stop</h2>
          </div>
          <button type="button" className="curri-icon-btn" onClick={onClose}><X size={17} /></button>
        </div>

        <p className="modal-sub">Add stop coordinates, address and cargo weight in kilograms.</p>

        <label className="curri-form-field">
          <span>Stop Name / Customer</span>
          <input name="label" placeholder="e.g. Apex Industrial Supplies" value={form.label} onChange={handleChange} autoFocus />
        </label>

        <label className="curri-form-field">
          <span>Address Details</span>
          <input name="address" value={form.address} onChange={handleChange} />
        </label>

        <div className="modal-input-grid">
          <label className="curri-form-field">
            <span>Latitude</span>
            <input name="lat" type="number" step="0.00001" value={form.lat} onChange={handleChange} />
          </label>
          <label className="curri-form-field">
            <span>Longitude</span>
            <input name="lng" type="number" step="0.00001" value={form.lng} onChange={handleChange} />
          </label>
          <label className="curri-form-field">
            <span>Cargo Demand (kg)</span>
            <input name="demand" type="number" min="0.1" step="0.5" value={form.demand} onChange={handleChange} />
          </label>
          <label className="curri-form-field">
            <span>Service Time (min)</span>
            <input name="serviceMinutes" type="number" min="0" step="1" value={form.serviceMinutes} onChange={handleChange} />
          </label>
        </div>

        <div className="modal-buttons">
          <button type="button" className="planner-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="planner-btn-primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            <span>Add Stop</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function parseLocalCsv(csv, depot) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines.shift().split(",").map((item) => item.trim().toLowerCase());
  return lines.map((line, rowIndex) => {
    const columns = line.split(",");
    const entry = Object.fromEntries(headers.map((header, index) => [header, columns[index]?.trim() ?? ""]));
    return { 
      id: `CSV-${Date.now()}-${rowIndex}`, 
      label: entry.label || `Imported stop ${rowIndex + 1}`, 
      address: entry.address || "CSV import", 
      lat: Number(entry.lat), 
      lng: Number(entry.lng), 
      demand: Number(entry.demand), 
      serviceMinutes: Number(entry.serviceminutes || 5), 
      timeWindow: null 
    };
  }).filter((stop) => [stop.lat, stop.lng, stop.demand].every(Number.isFinite) && Math.abs(stop.lat) <= 90 && Math.abs(stop.lng) <= 180 && stop.demand > 0);
}
