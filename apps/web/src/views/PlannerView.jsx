import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Activity, 
  ArrowDownUp, 
  ArrowRight, 
  ArrowUpRight, 
  Check, 
  ChevronDown, 
  CircleHelp, 
  Clock3, 
  Database, 
  Download, 
  FileDown, 
  FileUp, 
  Gauge, 
  Layers2, 
  LoaderCircle, 
  MapPinned, 
  Minus, 
  Navigation2,
  Package, 
  Play,
  Plus, 
  Route as RouteIcon, 
  Search,
  Sparkles, 
  Truck, 
  X, 
  Zap 
} from "lucide-react";
import toast from "react-hot-toast";
import { usePlannerStore } from "../store/usePlannerStore.js";
import { api } from "../api/client.js";
import { solveOptimization, getDemoInstance, ALGORITHM_REGISTRY, ROUTE_ALGORITHM_IDS } from "@courier/algorithms";
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
  const fileRef = useRef(null);

  const stops = planner.stops ?? [];
  const depot = planner.depot;
  const fleet = planner.fleet ?? { vehicles: 3, capacity: 95, averageSpeedKmh: 28 };
  const totalDemand = stops.reduce((sum, stop) => sum + Number(stop.demand || 0), 0);
  const selectedMeta = ALGORITHM_REGISTRY.find((item) => item.id === algorithm);
  const algorithmOptions = ROUTE_ALGORITHM_IDS.map((id) => ALGORITHM_REGISTRY.find((item) => item.id === id)).filter(Boolean);
  const filteredStops = useMemo(() => stops.filter((stop) => `${stop.label} ${stop.id}`.toLowerCase().includes(query.toLowerCase())), [stops, query]);
  const routeCount = result?.routes?.length ?? 0;
  const resultDistance = result?.totalCost;

  async function handleOptimize() {
    if (!stops.length) return toast.error("Add at least one delivery stop first.");
    if (totalDemand > Number(fleet.capacity) * Number(fleet.vehicles)) return toast.error("Fleet capacity is lower than total stop demand.");
    
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
      setRunning(true, "Curri optimization engine running…");
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
      result: solved 
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

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    try {
      const imported = await api.importStops(csv);
      setStops([...stops, ...imported.stops]);
      toast.success(`${imported.imported} stops imported into manifest.`);
    } catch (error) {
      if (error.response) return toast.error(error.response.data?.error || "CSV import failed.");
      const parsed = parseLocalCsv(csv, depot);
      if (!parsed.length) return toast.error("Could not parse stops. Required columns: label, lat, lng, demand.");
      setStops([...stops, ...parsed]);
      setFallbackMode();
      toast.success(`${parsed.length} stops imported.`);
    }
    event.target.value = "";
  }

  function downloadTemplate() {
    const csv = "label,lat,lng,demand,serviceMinutes\nLudhiana Timber Yard,30.9020,75.8610,16,6\nMiller Ganj Hardware,30.8980,75.8520,24,8\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "curri-manifest-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="curri-planner-stack">
      {/* Top Banner / Hero Heading */}
      <section className="curri-hero-banner">
        <div className="curri-hero-content">
          <div className="curri-tagline">
            <span className="curri-tag-dot" />
            <span>DISPATCH INTELLIGENCE SYSTEM</span>
            <span className="curri-tag-badge">AI ROUTING ACTIVE</span>
          </div>
          <h1>Dynamic Fleet Route Planner</h1>
          <p>
            Intelligent multi-stop dispatching, dynamic vehicle payload distribution, and animated route visualization.
          </p>
        </div>

        <div className="curri-hero-actions">
          <button className="curri-btn curri-btn-secondary" onClick={downloadTemplate} title="Download sample CSV format">
            <FileDown size={15} />
            <span>CSV Template</span>
          </button>
          
          <div className="import-btn-wrap">
            <button className="curri-btn curri-btn-secondary" onClick={() => fileRef.current?.click()}>
              <FileUp size={15} />
              <span>Import Manifest</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport} />
          </div>

          <button 
            className="curri-btn curri-btn-secondary" 
            onClick={handleCompare} 
            disabled={running || !stops.length}
            title="Benchmark 4 algorithms on this instance"
          >
            <ArrowDownUp size={15} />
            <span>Compare Solvers</span>
          </button>

          <button 
            className="curri-btn curri-btn-primary curri-btn-glow" 
            onClick={handleOptimize} 
            disabled={running || !stops.length}
          >
            {running ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
            <span>{running ? "Optimizing Fleet…" : "Optimize Routes"}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {fallbackMode && (
        <div className="curri-offline-pill">
          <Zap size={15} />
          <span><b>Sandbox Mode:</b> Running browser-based fast combinatorial engine.</span>
        </div>
      )}

      {/* Modern Curri Metrics Overview Row */}
      <section className="curri-metrics-strip">
        <CurriMetricCard 
          icon={<MapPinned size={18} />} 
          label="MANIFEST STOPS" 
          value={String(stops.length).padStart(2, "0")} 
          detail={`${stops.filter((s) => s.timeWindow).length} scheduled windows`} 
          theme="blue" 
        />
        <CurriMetricCard 
          icon={<Truck size={18} />} 
          label="ACTIVE FLEET" 
          value={String(fleet.vehicles).padStart(2, "0")} 
          detail={`${fleet.capacity} kg payload limit`} 
          theme="green" 
        />
        <CurriMetricCard 
          icon={<Package size={18} />} 
          label="TOTAL PAYLOAD" 
          value={`${totalDemand.toFixed(0)} kg`} 
          detail={`${(totalDemand / Math.max(1, fleet.vehicles)).toFixed(0)} kg avg per vehicle`} 
          theme="amber" 
        />
        <CurriMetricCard 
          icon={<RouteIcon size={18} />} 
          label="PLANNED FLEET DISTANCE" 
          value={resultDistance == null ? "--" : formatDistance(resultDistance)} 
          detail={result ? `${routeCount} vehicles deployed` : "Run optimizer to plan"} 
          theme="emerald" 
          highlight={resultDistance != null} 
        />
      </section>

      {/* Main Workbench Layout: Left Control Panel + Right Interactive Map & Route Cards */}
      <section className="curri-workbench">
        {/* Left Control Center Panel */}
        <aside className="curri-panel">
          <div className="curri-panel-head">
            <div>
              <span className="panel-kicker">DISPATCH CONFIGURATION</span>
              <h2>Fleet & Algorithm</h2>
            </div>
            <div className="panel-badge-soft">
              <Zap size={13} />
              <span>DYNAMIC</span>
            </div>
          </div>

          {/* Algorithm Selector Box */}
          <div className="curri-select-box">
            <label className="curri-field-label">OPTIMIZATION ALGORITHM</label>
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
              <ChevronDown size={15} className="select-arrow" />
            </div>
            
            <div className="algorithm-meta-row">
              <span className="algo-badge">{selectedMeta?.paradigm ?? "Heuristic"}</span>
              <span className="algo-complexity">{selectedMeta?.complexity ?? "O(n²)"}</span>
            </div>
            <p className="algo-description-text">{selectedMeta?.description}</p>
          </div>

          <div className="curri-divider" />

          {/* Fleet Parameters */}
          <div className="curri-fleet-section">
            <div className="fleet-section-head">
              <span className="curri-field-label">FLEET VEHICLES & CAPACITIES</span>
              <Truck size={15} className="text-muted" />
            </div>

            {/* Vehicles Stepper */}
            <div className="curri-config-row">
              <div className="config-label-group">
                <div className="config-icon-box bg-blue-subtle">
                  <Truck size={15} />
                </div>
                <div>
                  <b>Dispatch Vehicles</b>
                  <small>Available vans in hub</small>
                </div>
              </div>
              <div className="curri-stepper">
                <button 
                  type="button" 
                  disabled={fleet.vehicles <= 1} 
                  onClick={() => handleFleetChange("vehicles", Math.max(1, Number(fleet.vehicles) - 1))}
                >
                  <Minus size={13} />
                </button>
                <span>{String(fleet.vehicles).padStart(2, "0")}</span>
                <button 
                  type="button" 
                  disabled={fleet.vehicles >= 12} 
                  onClick={() => handleFleetChange("vehicles", Math.min(12, Number(fleet.vehicles) + 1))}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Vehicle Payload Limit */}
            <div className="curri-config-row">
              <div className="config-label-group">
                <div className="config-icon-box bg-green-subtle">
                  <Package size={15} />
                </div>
                <div>
                  <b>Vehicle Max Payload</b>
                  <small>Per van capacity</small>
                </div>
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

            {/* Transit Speed Model */}
            <div className="curri-config-row">
              <div className="config-label-group">
                <div className="config-icon-box bg-amber-subtle">
                  <Gauge size={15} />
                </div>
                <div>
                  <b>Transit Velocity</b>
                  <small>Urban speed estimation</small>
                </div>
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

            {/* Payload Utilization Bar */}
            <div className={`curri-capacity-meter ${totalDemand > fleet.capacity * fleet.vehicles ? "meter-overload" : "meter-ok"}`}>
              <div className="meter-head">
                <span className="meter-status">
                  {totalDemand > fleet.capacity * fleet.vehicles ? "Fleet Overbooked" : "Fleet Capacity Verified"}
                </span>
                <b>{totalDemand.toFixed(0)} / {(fleet.capacity * fleet.vehicles).toFixed(0)} kg</b>
              </div>
              <div className="meter-bar-track">
                <div 
                  className="meter-bar-fill" 
                  style={{ width: `${Math.min(100, (totalDemand / (fleet.capacity * fleet.vehicles || 1)) * 100)}%` }} 
                />
              </div>
            </div>
          </div>

          <div className="curri-divider" />

          {/* Delivery Manifest List */}
          <div className="curri-manifest-section">
            <div className="manifest-section-head">
              <div>
                <span className="curri-field-label">DELIVERY MANIFEST</span>
                <span className="manifest-count-chip">{stops.length} STOPS</span>
              </div>
              <button 
                type="button" 
                className="curri-icon-btn" 
                title="Add new stop" 
                onClick={() => setShowAdd(true)}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="curri-search-input">
              <Search size={14} />
              <input 
                placeholder="Search stops or IDs…" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
              />
              <span className="match-count">{filteredStops.length}</span>
            </div>

            <div className="curri-stop-list">
              {filteredStops.length ? (
                filteredStops.map((stop) => {
                  const index = stops.findIndex((item) => item.id === stop.id);
                  const routeIndex = result?.routes?.findIndex((route) => route.includes(index + 1)) ?? -1;
                  const routeColor = routeIndex >= 0 ? ROUTE_COLORS[routeIndex % ROUTE_COLORS.length] : "#cbd5e1";

                  return (
                    <div className="curri-stop-item" key={stop.id}>
                      <span className="stop-badge" style={{ backgroundColor: routeColor }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="stop-info">
                        <b>{stop.label}</b>
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
                <div className="curri-empty-stops">No delivery stops found.</div>
              )}
            </div>

            <button type="button" className="curri-add-stop-block" onClick={() => setShowAdd(true)}>
              <Plus size={15} />
              <span>Add Delivery Stop</span>
            </button>
          </div>
        </aside>

        {/* Right Main Map Column + Route Cards Strip */}
        <div className="curri-map-column">
          {/* Map Container Card */}
          <div className="curri-map-card">
            <div className="curri-map-header">
              <div className="map-header-left">
                <div className="map-header-tag">
                  <span className="live-pulse-dot" />
                  <span>{result ? "OPTIMIZED NETWORK" : "LIVE NETWORK"}</span>
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
                <span>HAVERSINE MATRIX · ZERO KEY</span>
              </div>
            </div>
          </div>

          {/* Route Summary Cards Strip (Curri Style) */}
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
                  <Sparkles size={20} />
                </div>
                <div className="ready-text">
                  <b>Routes Ready for Dispatch</b>
                  <span>Configure fleet settings or pick an algorithm, then click "Optimize Routes" to simulate vehicles.</span>
                </div>
                <button type="button" className="ready-action-btn" onClick={handleOptimize}>
                  Run Fast Solver <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Decision Playback & Constraint Analytics */}
      <section className="curri-analysis-grid">
        <div className="curri-card trace-card">
          <div className="curri-card-head">
            <div>
              <span className="panel-kicker">DECISION PLAYBACK</span>
              <h2>Algorithm Execution Step-by-Step</h2>
            </div>
            <span className="curri-status-tag">
              <Activity size={13} />
              {result?.trace?.length ? `${result.trace.length} LOGGED STEPS` : "TRACE READY"}
            </span>
          </div>
          <TracePlayer trace={result?.trace ?? []} algorithm={selectedMeta?.name} />
        </div>

        <div className="curri-card validation-card">
          <div className="curri-card-head">
            <div>
              <span className="panel-kicker">VERIFICATION</span>
              <h2>Fleet Constraints & Telemetry</h2>
            </div>
            <div className="curri-round-icon">
              <Activity size={16} />
            </div>
          </div>

          {result ? (
            <div className="curri-validation-list">
              <ValidationRow 
                label="Stop Coverage Verification" 
                okay={result.validation?.coverageFeasible} 
                detail={`${stops.length} stops assigned across ${routeCount} vehicles`} 
              />
              <ValidationRow 
                label="Axle & Vehicle Payload Limit" 
                okay={result.validation?.capacityFeasible} 
                detail={`${Math.max(...(result.loads ?? [0]))} / ${fleet.capacity} kg max load`} 
              />
              <ValidationRow 
                label="Time Windows & Scheduling" 
                okay={result.validation?.timeWindowFeasible} 
                detail={`${stops.filter((s) => s.timeWindow).length} windows verified`} 
              />

              <div className="telemetry-stat-pills">
                <div className="telemetry-pill">
                  <Clock3 size={13} />
                  <span><b>{Number(result.stats.runtimeMs).toFixed(1)}</b> ms</span>
                </div>
                <div className="telemetry-pill">
                  <Activity size={13} />
                  <span><b>{Number(result.stats.operations).toLocaleString()}</b> ops</span>
                </div>
                <div className="telemetry-pill">
                  <ArrowDownUp size={13} />
                  <span><b>{result.stats.iterations}</b> moves</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="curri-teaser-box">
              <p>Explore combinatorial heuristics, dynamic programming, and local search algorithms tested under identical conditions.</p>
              <div className="curri-pill-tags">
                <span>Deterministic Seeded</span>
                <span>Sub-millisecond</span>
                <span>CVRP Solvers</span>
              </div>
              <button type="button" className="curri-link-btn" onClick={() => navigate("/algorithms")}>
                Browse algorithm library <ArrowUpRight size={14} />
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

function CurriMetricCard({ icon, label, value, detail, theme, highlight }) {
  return (
    <div className={`curri-metric-card theme-${theme} ${highlight ? "card-highlight" : ""}`}>
      <div className="metric-head">
        <span className="metric-icon">{icon}</span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-number">{value}</div>
      <div className="metric-detail">{detail}</div>
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
        </div>
        <span className="route-card-distance">{formatDistance(distance)}</span>
      </div>

      <div className="route-card-stats">
        <div className="route-stat-box">
          <span className="stat-name">PAYLOAD UTILIZATION</span>
          <span className="stat-val">{load} / {capacity} kg ({pct}%)</span>
        </div>
        <div className="route-stat-box">
          <span className="stat-name">EST. ARRIVAL</span>
          <span className="stat-val">{etaFormatted} hrs</span>
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
        <span>{route.length - 2} Delivery Stops</span>
        <span className="status-badge-ok">Dispatched</span>
      </div>
    </div>
  );
}

function ValidationRow({ label, okay, detail }) {
  return (
    <div className="curri-validation-row">
      <div className={`check-bubble ${okay ? "bubble-pass" : "bubble-fail"}`}>
        {okay ? <Check size={13} /> : <X size={13} />}
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
          <span className="panel-kicker">MULTI-SOLVER BENCHMARK</span>
          <h2>Algorithm Performance Comparison</h2>
        </div>
        <span className="curri-status-tag">
          <ArrowDownUp size={13} />
          {rows.length} SOLVERS EVALUATED
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
                {isBest && <span className="best-tag">OPTIMAL</span>}
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
                    <b>{gap == null ? "N/A" : `${gap.toFixed(1)}%`}</b>
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
            <span className="panel-kicker">MANIFEST EDITOR</span>
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
          <button type="button" className="curri-btn curri-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="curri-btn curri-btn-primary" disabled={saving}>
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
