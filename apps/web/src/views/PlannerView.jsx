import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowDownUp, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Clock3, Database, Download, FileDown, FileUp, Gauge, Layers2, LoaderCircle, MapPinned, Minus, Package, Plus, Route, Sparkles, Truck, X } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
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
    setRunning(true, "Preparing distance matrix");
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
      setRunning(true, "Running solver in an isolated worker");
      const started = await api.optimize(payload);
      runId = started.jobId;
      let job = started.status === "completed" ? await api.job(started.jobId) : null;
      for (let attempt = 0; !job || job.status === "running"; attempt += 1) {
        if (attempt > 100) throw new Error("The route job took too long to finish.");
        await wait(350);
        job = await api.job(started.jobId);
        setRunning(true, job.status === "running" ? "Comparing route moves" : "Finalizing metrics");
      }
      if (job.status !== "completed") throw new Error(job.error?.message || "The route job failed.");
      solved = job.result;
    } catch (error) {
      try {
        setFallbackMode();
        solved = solveOptimization(payload);
        toast("API not reachable — solved locally in demo mode.", { icon: "⚡" });
      } catch (localError) {
        setRunning(false);
        return toast.error(localError.message || error.message || "Optimization failed.");
      }
    }
    setResult(solved);
    setRunning(false);
    addHistory({ id: runId ?? `local-${Date.now()}`, algorithm, totalDistance: solved.totalCost, runtimeMs: solved.stats.runtimeMs, opCount: solved.stats.operations, createdAt: new Date().toISOString(), result: solved });
    if (!solved.validation?.valid) toast.error("Solution returned with a constraint warning. Review the route checks below.");
    else toast.success(`Optimized ${stops.length} stops across ${solved.routes.length} routes.`);
  }

  async function handleCompare() {
    if (!stops.length) return toast.error("Add delivery stops before comparing methods.");
    const algorithms = ["nearest-neighbor", "two-opt", "combined", "held-karp"];
    const payload = { depot, stops, vehicles: Number(fleet.vehicles), capacity: Number(fleet.capacity), algorithm, algorithms, options: { seed: 42, trace: false, maxIterations: 900, averageSpeedKmh: Number(fleet.averageSpeedKmh) || 28, startTimeMinutes: 480 } };
    setRunning(true, "Comparing algorithms in parallel workers");
    try {
      const rows = await api.compare(payload);
      setComparison(rows);
      toast.success("Four solvers evaluated on the same instance.");
    } catch (error) {
      if (error.response) { setRunning(false); return toast.error(error.response.data?.error || "Comparison failed."); }
      setFallbackMode();
      try {
        const rows = algorithms.map((id) => {
          try { return { algorithm: id, result: solveOptimization({ ...payload, algorithm: id }) }; }
          catch (solveError) { return { algorithm: id, error: solveError.message }; }
        });
        setComparison(rows);
        toast("Comparison computed locally in demo mode.", { icon: "⚡" });
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
    toast.success("Stop removed from this plan.");
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    try {
      const imported = await api.importStops(csv);
      setStops([...stops, ...imported.stops]);
      toast.success(`${imported.imported} stops imported.`);
    } catch (error) {
      if (error.response) return toast.error(error.response.data?.error || "CSV import failed.");
      const parsed = parseLocalCsv(csv, depot);
      if (!parsed.length) return toast.error("Could not read stops. Use label, lat, lng, demand columns.");
      setStops([...stops, ...parsed]);
      setFallbackMode();
      toast.success(`${parsed.length} stops added in local demo mode.`);
    }
    event.target.value = "";
  }

  function downloadTemplate() {
    const csv = "label,lat,lng,demand,serviceMinutes\nDemo stop,30.9020,75.8610,16,6\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "routecraft-stops-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="page-stack">
      <section className="page-heading planner-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" />DISPATCH WORKSPACE <span className="eyebrow-separator">/</span> ROUTE PLANNER</div>
          <h1>Dispatch planner</h1>
          <p>Shape a smarter last mile. Build routes, respect capacity, and see the trade-offs.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-quiet" onClick={downloadTemplate}><FileDown size={15} />CSV template</button>
          <div className="import-wrap">
            <button className="button button-secondary" onClick={() => fileRef.current?.click()}><FileUp size={15} />Import CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport} />
          </div>
          <button className="button button-secondary" onClick={handleCompare} disabled={running || !stops.length} title="Compare nearest neighbor, 2-opt, the recommended hybrid, and Held–Karp."><ArrowDownUp size={15} />Compare</button>
          <button className="button button-primary" onClick={handleOptimize} disabled={running || !stops.length} title={running ? progressText : selectedMeta?.description}>
            {running ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
            {running ? "Optimizing…" : "Optimize routes"}<ArrowRight size={15} className="button-arrow" />
          </button>
        </div>
      </section>

      {fallbackMode && <div className="fallback-banner"><Activity size={15} /><span>Offline demo mode</span><i>API is not connected. Changes and optimization run in this browser only.</i></div>}

      <section className="metric-grid">
        <MetricCard icon={<MapPinned size={17} />} label="DELIVERY STOPS" value={String(stops.length).padStart(2, "0")} foot={`${stops.filter((stop) => stop.timeWindow).length} with time windows`} tone="blue" />
        <MetricCard icon={<Truck size={17} />} label="ACTIVE VEHICLES" value={String(fleet.vehicles).padStart(2, "0")} foot={`${fleet.capacity} kg capacity each`} tone="green" />
        <MetricCard icon={<Package size={17} />} label="TOTAL LOAD" value={`${totalDemand.toFixed(0)} kg`} foot={`${(totalDemand / Math.max(1, fleet.vehicles)).toFixed(0)} kg avg. per route`} tone="amber" />
        <MetricCard icon={<Route size={17} />} label="PLANNED DISTANCE" value={resultDistance == null ? "—" : formatDistance(resultDistance)} foot={result ? `${routeCount} optimized routes` : "Run the optimizer to calculate"} tone="violet" highlight={resultDistance != null} />
      </section>

      <section className="planner-workbench">
        <aside className="planner-panel surface-card">
          <div className="panel-heading">
            <div><span className="section-kicker">CONTROL CENTER</span><h2>Plan settings</h2></div>
            <button className="icon-button subtle-icon" title="Capacity is a hard route constraint; stops are never silently dropped."><CircleHelp size={16} /></button>
          </div>
          <div className="algorithm-select-block">
            <label className="field-label" htmlFor="algorithm-select">ROUTING ALGORITHM</label>
            <div className="select-shell">
              <select id="algorithm-select" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
                {algorithmOptions.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
              </select><ChevronDown size={15} />
            </div>
            <div className="algorithm-description"><span className="algorithm-tag">{selectedMeta?.paradigm ?? "Heuristic"}</span><span>{selectedMeta?.complexity ?? "—"}</span></div>
            <p className="algorithm-blurb">{selectedMeta?.description}</p>
          </div>

          <div className="panel-divider" />
          <div className="fleet-settings-head"><div><span className="field-label">FLEET CONFIGURATION</span><span className="micro-copy">All vans share the same capacity</span></div><Truck size={17} className="muted-icon" /></div>
          <div className="fleet-config-row">
            <div className="fleet-config-title"><span className="fleet-setting-icon blue-soft"><Truck size={15} /></span><div><b>Vehicles</b><small>Dispatch fleet</small></div></div>
            <div className="stepper-control"><button aria-label="Remove vehicle" disabled={fleet.vehicles <= 1} onClick={() => handleFleetChange("vehicles", Math.max(1, Number(fleet.vehicles) - 1))}><Minus size={13} /></button><span>{String(fleet.vehicles).padStart(2, "0")}</span><button aria-label="Add vehicle" disabled={fleet.vehicles >= 12} onClick={() => handleFleetChange("vehicles", Math.min(12, Number(fleet.vehicles) + 1))}><Plus size={13} /></button></div>
          </div>
          <div className="fleet-config-row">
            <div className="fleet-config-title"><span className="fleet-setting-icon green-soft"><Package size={15} /></span><div><b>Load capacity</b><small>Per vehicle · kg</small></div></div>
            <div className="capacity-edit"><input aria-label="Vehicle capacity in kilograms" type="number" min="10" max="1000" step="5" value={fleet.capacity} onChange={(event) => handleFleetChange("capacity", Math.max(10, Number(event.target.value) || 10))} /><span>kg</span></div>
          </div>
          <div className="fleet-config-row speed-row">
            <div className="fleet-config-title"><span className="fleet-setting-icon amber-soft"><Gauge size={15} /></span><div><b>Avg. speed</b><small>Travel time model</small></div></div>
            <div className="capacity-edit"><input aria-label="Average speed in kilometres per hour" type="number" min="10" max="100" value={fleet.averageSpeedKmh ?? 28} onChange={(event) => handleFleetChange("averageSpeedKmh", Number(event.target.value) || 28)} /><span>km/h</span></div>
          </div>
          <div className={`capacity-check ${totalDemand > fleet.capacity * fleet.vehicles ? "capacity-warning" : ""}`}><span className="capacity-check-icon">{totalDemand > fleet.capacity * fleet.vehicles ? <X size={13} /> : <Check size={13} />}</span><span>{totalDemand > fleet.capacity * fleet.vehicles ? "Fleet capacity is overbooked" : "Total load fits fleet capacity"}</span><b>{totalDemand.toFixed(0)} / {(fleet.capacity * fleet.vehicles).toFixed(0)} kg</b></div>

          <div className="panel-divider stops-divider" />
          <div className="stop-list-heading"><div><span className="field-label">DELIVERY MANIFEST</span><span className="stop-list-count">{stops.length} stops</span></div><button className="icon-button add-stop-icon" aria-label="Add stop" onClick={() => setShowAdd(true)}><Plus size={16} /></button></div>
          <div className="stop-search"><Activity size={14} /><input placeholder="Find a stop…" value={query} onChange={(event) => setQuery(event.target.value)} /><span>{String(filteredStops.length).padStart(2, "0")}</span></div>
          <div className="stop-list">
            {filteredStops.length ? filteredStops.map((stop) => {
              const index = stops.findIndex((item) => item.id === stop.id);
              const routeIndex = result?.routes?.findIndex((route) => route.includes(index + 1)) ?? -1;
              return <div className="stop-list-item" key={stop.id}>
                <span className="stop-number" style={{ "--stop-color": routeIndex >= 0 ? ROUTE_COLORS[routeIndex % ROUTE_COLORS.length] : "#dbe4e8" }}>{String(index + 1).padStart(2, "0")}</span>
                <div className="stop-list-copy"><b>{stop.label}</b><small>{stop.id} <span>·</span> {stop.timeWindow ? `${asClock(stop.timeWindow.start)}–${asClock(stop.timeWindow.end)}` : "No time window"}</small></div>
                <span className="stop-demand">{stop.demand}<small>kg</small></span>
                <button className="stop-remove" aria-label={`Remove ${stop.label}`} onClick={() => handleDeleteStop(stop.id)}><X size={13} /></button>
              </div>;
            }) : <div className="empty-stops">No stops match that search.</div>}
          </div>
          <button className="add-stop-inline" onClick={() => setShowAdd(true)}><Plus size={14} />Add delivery stop</button>
        </aside>

        <div className="map-column">
          <div className="map-card surface-card">
            <div className="map-card-header">
              <div><div className="map-title-line"><h2>Route overview</h2><span className="live-tag"><span />{result ? "OPTIMIZED" : "LIVE PLAN"}</span></div><p>{planner.depot?.label || "Depot"} <span>·</span> {planner.depot?.address || "Ludhiana demo area"}</p></div>
              <div className="map-header-actions">
                <button className="button button-small button-light" onClick={() => setSelectedRoute(null)}><Layers2Icon />{selectedRoute == null ? "All routes" : `Route ${String(selectedRoute + 1).padStart(2, "0")}`}<ChevronDown size={13} /></button>
                {result && <button className="icon-button subtle-icon" title="Clear route overlay" onClick={() => setResult(null)}><X size={15} /></button>}
              </div>
            </div>
            <div className="map-view"><RouteMap depot={depot} stops={stops} result={result} selectedRoute={selectedRoute} onSelectRoute={(index) => setSelectedRoute(index === selectedRoute ? null : index)} /></div>
            <div className="map-footer"><div className="map-legend"><span><i className="legend-depot" />Depot</span><span><i className="legend-stop" />Delivery stop</span>{result && result.routes.map((_, index) => <button className={`route-legend ${selectedRoute === index ? "route-legend-active" : ""}`} onClick={() => setSelectedRoute(selectedRoute === index ? null : index)} key={index}><i style={{ background: ROUTE_COLORS[index % ROUTE_COLORS.length] }} />Route {String(index + 1).padStart(2, "0")}</button>)}</div><div className="map-data-note"><MapPinned size={13} />HAVERSINE · OFFLINE MAP</div></div>
          </div>
          <div className="results-strip">
            {result ? result.routes.map((route, index) => <RouteSummary key={index} route={route} index={index} distance={result.perRouteCost[index]} load={result.loads[index]} capacity={fleet.capacity} stops={stops} active={selectedRoute === index} onClick={() => setSelectedRoute(selectedRoute === index ? null : index)} />) : <div className="ready-state-card"><div className="ready-icon"><Sparkles size={17} /></div><div><b>Ready when you are</b><span>Choose a solver and optimize your delivery manifest.</span></div><span className="ready-stamp">{algorithmOptions.length} ALGORITHMS</span></div>}
          </div>
        </div>
      </section>

      <section className="analysis-grid">
        <div className="surface-card trace-card">
          <div className="analysis-card-heading"><div><span className="section-kicker">DECISION PLAYBACK</span><h2>Inside the algorithm</h2></div><span className="trace-tag"><Activity size={13} />{result?.trace?.length ? `${result.trace.length} STEPS` : "TRACE READY"}</span></div>
          <TracePlayer trace={result?.trace ?? []} algorithm={selectedMeta?.name} />
        </div>
        <div className="surface-card insight-card">
          <div className="analysis-card-heading"><div><span className="section-kicker">RUN INSIGHT</span><h2>{result ? "Constraint check" : "A small DAA lab"}</h2></div><div className="insight-icon"><Activity size={16} /></div></div>
          {result ? <div className="constraint-list">
            <ConstraintRow label="Every stop assigned once" okay={result.validation?.coverageFeasible} detail={`${stops.length} stops · ${routeCount} routes`} />
            <ConstraintRow label="Vehicle capacity" okay={result.validation?.capacityFeasible} detail={`${Math.max(...(result.loads ?? [0]))} / ${fleet.capacity} kg max load`} />
            <ConstraintRow label="Time windows" okay={result.validation?.timeWindowFeasible} detail={`${stops.filter((stop) => stop.timeWindow).length} windows checked`} />
            <div className="run-stat-line"><span><Clock3 size={13} />{Number(result.stats.runtimeMs).toFixed(1)} ms</span><span><Activity size={13} />{Number(result.stats.operations).toLocaleString()} ops</span><span><ArrowDownUp size={13} />{result.stats.iterations} moves</span></div>
          </div> : <div className="daa-teaser"><p>Exact solvers, greedy heuristics, and local search — measured on the same synthetic delivery instance.</p><div className="daa-teaser-tags"><span>NP-hard routing</span><span>Seeded runs</span><span>Pure JS core</span></div><button onClick={() => navigate("/algorithms")}>Explore the algorithm catalog <ArrowUpRight size={14} /></button></div>}
        </div>
      </section>

      {comparison && <ComparisonPanel rows={comparison} />}

      {showAdd && <StopModal depot={depot} onClose={() => setShowAdd(false)} onSave={async (stop) => {
        let saved = stop;
        try { saved = await api.createStop(stop); }
        catch (error) { if (error.response) throw new Error(error.response.data?.error || "Could not create stop."); setFallbackMode(); saved = { ...stop, id: `ST-${Math.random().toString(36).slice(2, 8).toUpperCase()}` }; }
        addStop(saved);
        toast.success("Delivery stop added.");
      }} />}
    </div>
  );
}

function Layers2Icon() { return <Layers2 size={14} />; }
function MetricCard({ icon, label, value, foot, tone, highlight }) { return <div className={`metric-card metric-${tone} ${highlight ? "metric-highlight" : ""}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span>{highlight && <span className="metric-up"><ArrowUpRight size={14} /></span>}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>; }
function RouteSummary({ route, index, distance, load, capacity, stops, active, onClick }) {
  const names = route.slice(1, -1).map((stopIndex) => stops[stopIndex - 1]?.label).filter(Boolean);
  const containerTypes = ["40ft High Cube", "20ft Standard Dry", "Reefer 40ft ISO", "24ft Box Freight", "Flatbed Curtainsider"];
  const containerType = containerTypes[index % containerTypes.length];
  const pct = Math.min(100, Math.round((load / capacity) * 100));
  const loadStatus = pct >= 90 ? "Full Load" : pct >= 50 ? "Balanced Load" : "Light Load";
  const estMinutes = Math.round((distance / 28) * 60) + (route.length - 2) * 6;
  const startHour = 8 + index;
  const etaFormatted = `${String(Math.floor(startHour + estMinutes / 60) % 24).padStart(2, "0")}:${String(estMinutes % 60).padStart(2, "0")}`;

  return (
    <button className={`route-summary tms-route-card surface-card ${active ? "route-summary-active" : ""}`} onClick={onClick}>
      <div className="route-summary-top">
        <span className="route-color-dot" style={{ background: ROUTE_COLORS[index % ROUTE_COLORS.length] }} />
        <span className="route-summary-name">ROUTE {String(index + 1).padStart(2, "0")}</span>
        <span className="container-type-badge">{containerType}</span>
        <span className="route-summary-distance">{formatDistance(distance)}</span>
      </div>
      <div className="route-summary-middle">
        <div className="route-tms-stat">
          <span className="stat-label">LOAD STATUS</span>
          <span className={`status-tag ${pct >= 90 ? "status-tag-amber" : "status-tag-teal"}`}>{loadStatus} ({pct}%)</span>
        </div>
        <div className="route-tms-stat">
          <span className="stat-label">EST. ARRIVAL (ETA)</span>
          <span className="eta-tag">{etaFormatted} hrs</span>
        </div>
        <div className="route-tms-stat">
          <span className="stat-label">CARGO WEIGHT</span>
          <span className="weight-tag">{load} / {capacity} kg</span>
        </div>
      </div>
      <div className="route-summary-stops">
        <span className="stops-path-label">Waypoints:</span> {names.slice(0, 3).join(" → ")}{names.length > 3 ? ` +${names.length - 3} more` : ""}
      </div>
      <div className="route-load-bar">
        <span style={{ width: `${pct}%`, background: ROUTE_COLORS[index % ROUTE_COLORS.length] }} />
      </div>
      <div className="route-summary-bottom">
        <span>{route.length - 2} delivery stops</span>
        <span>Axle check passed</span>
      </div>
    </button>
  );
}
function ConstraintRow({ label, okay, detail }) { return <div className="constraint-row"><span className={`constraint-check ${okay ? "is-good" : "is-bad"}`}>{okay ? <Check size={12} /> : <X size={12} />}</span><div><b>{label}</b><small>{detail}</small></div><span className={`constraint-state ${okay ? "state-good" : "state-bad"}`}>{okay ? "PASS" : "CHECK"}</span></div>; }
function ComparisonPanel({ rows }) {
  const valid = rows.filter((row) => row.result);
  const best = valid.length ? Math.min(...valid.map((row) => row.result.totalCost)) : null;
  return <section className="surface-card compare-panel"><div className="analysis-card-heading"><div><span className="section-kicker">SAME INSTANCE · SAME CONSTRAINTS</span><h2>Algorithm comparison</h2></div><span className="trace-tag"><ArrowDownUp size={13} />{rows.length} SOLVERS</span></div><div className="compare-grid">{rows.map((row, index) => {
    const solved = row.result;
    const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
    const gap = solved && best > 0 ? Math.max(0, ((solved.totalCost - best) / best) * 100) : null;
    return <article className="compare-result-card" key={row.algorithm} style={{ "--compare-color": color }}><div className="compare-result-top"><span className="route-color-dot" /><b>{ALGORITHM_REGISTRY.find((item) => item.id === row.algorithm)?.name ?? row.name ?? row.algorithm}</b>{solved?.totalCost === best && <span className="best-badge">BEST COST</span>}</div>{solved ? <><div className="compare-result-cost">{solved.totalCost.toFixed(2)} <small>km</small></div><div className="compare-result-meta"><span>{Number(solved.stats.runtimeMs).toFixed(2)} ms</span><span>{Number(solved.stats.operations).toLocaleString()} ops</span><span>{solved.routes.length} routes</span></div><div className="compare-result-gap"><span>Gap vs best in this batch</span><b>{gap == null ? "N/A" : `${gap.toFixed(1)}%`}</b></div></> : <div className="compare-error">{row.error || "Solver failed for this instance."}</div>}</article>;
  })}</div></section>;
}

function StopModal({ depot, onClose, onSave }) {
  const [form, setForm] = useState({ label: "", address: "Synthetic demo location", lat: (depot.lat + 0.003).toFixed(5), lng: (depot.lng + 0.002).toFixed(5), demand: 15, serviceMinutes: 6 });
  const [saving, setSaving] = useState(false);
  const handleChange = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (!form.label.trim()) return toast.error("Stop name is required.");
    const stop = { ...form, lat: Number(form.lat), lng: Number(form.lng), demand: Number(form.demand), serviceMinutes: Number(form.serviceMinutes) };
    if (![stop.lat, stop.lng, stop.demand, stop.serviceMinutes].every(Number.isFinite) || stop.lat < -90 || stop.lat > 90 || stop.lng < -180 || stop.lng > 180 || stop.demand <= 0) return toast.error("Check coordinates and package weight.");
    setSaving(true);
    try { await onSave(stop); onClose(); }
    catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal-card" onSubmit={submit}><div className="modal-head"><div><span className="section-kicker">MANIFEST EDITOR</span><h2>Add delivery stop</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={17} /></button></div><p className="modal-copy">Coordinates and demand are synthetic until you add your own data.</p><label className="form-field"><span>Stop label</span><input name="label" placeholder="e.g. Market street pickup" value={form.label} onChange={handleChange} autoFocus /></label><label className="form-field"><span>Address note</span><input name="address" value={form.address} onChange={handleChange} /></label><div className="form-grid"><label className="form-field"><span>Latitude</span><input name="lat" type="number" step="0.00001" value={form.lat} onChange={handleChange} /></label><label className="form-field"><span>Longitude</span><input name="lng" type="number" step="0.00001" value={form.lng} onChange={handleChange} /></label><label className="form-field"><span>Package demand · kg</span><input name="demand" type="number" min="0.1" step="0.5" value={form.demand} onChange={handleChange} /></label><label className="form-field"><span>Service time · min</span><input name="serviceMinutes" type="number" min="0" step="1" value={form.serviceMinutes} onChange={handleChange} /></label></div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Add stop</button></div></form></div>;
}

function parseLocalCsv(csv, depot) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines.shift().split(",").map((item) => item.trim().toLowerCase());
  return lines.map((line, rowIndex) => {
    const columns = line.split(",");
    const entry = Object.fromEntries(headers.map((header, index) => [header, columns[index]?.trim() ?? ""]));
    return { id: `CSV-${Date.now()}-${rowIndex}`, label: entry.label || `Imported stop ${rowIndex + 1}`, address: entry.address || "CSV import", lat: Number(entry.lat), lng: Number(entry.lng), demand: Number(entry.demand), serviceMinutes: Number(entry.serviceminutes || 5), timeWindow: null };
  }).filter((stop) => [stop.lat, stop.lng, stop.demand].every(Number.isFinite) && Math.abs(stop.lat) <= 90 && Math.abs(stop.lng) <= 180 && stop.demand > 0);
}
