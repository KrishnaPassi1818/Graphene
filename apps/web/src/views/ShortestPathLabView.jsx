import { useMemo, useState } from "react";
import { 
  Activity, 
  ArrowRight, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Compass, 
  Cpu, 
  Download, 
  FileDown, 
  FileText, 
  GitFork, 
  Layers, 
  Lightbulb, 
  LoaderCircle, 
  Milestone, 
  Play, 
  RotateCcw, 
  Route, 
  ShieldCheck, 
  Sparkles, 
  Timer, 
  Zap 
} from "lucide-react";
import toast from "react-hot-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend, 
  Cell 
} from "recharts";
import { usePlannerStore } from "../store/usePlannerStore.js";
import { api } from "../api/client.js";
import { evaluateShortestPathScenario, DEMO_INSTANCE } from "@courier/algorithms";
import RouteMap from "../components/RouteMap.jsx";
import TracePlayer from "../components/TracePlayer.jsx";

const ALGO_COLORS = {
  "dijkstra": "#2b72e5",
  "bellman-ford": "#ed6c69",
  "floyd-warshall": "#8c62d8",
  "prims": "#0eaa87",
  "kruskal": "#e39a22",
};

export default function ShortestPathLabView() {
  const planner = usePlannerStore((state) => state.planner);
  const depot = planner.depot || DEMO_INSTANCE.depot;
  const stops = (planner.stops && planner.stops.length > 0) ? planner.stops : DEMO_INSTANCE.stops;

  const allNodes = useMemo(() => [depot, ...stops], [depot, stops]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState(Math.max(1, allNodes.length - 1));
  const [selectedAlgoId, setSelectedAlgoId] = useState("dijkstra");
  const [evaluating, setEvaluating] = useState(false);
  const [report, setReport] = useState(() => {
    // Generate initial evaluation report synchronously
    try {
      return evaluateShortestPathScenario({
        nodes: allNodes,
        source: 0,
        target: Math.max(1, allNodes.length - 1),
      });
    } catch {
      return null;
    }
  });

  const selectedAlgo = useMemo(() => {
    if (!report?.results) return null;
    return report.results.find((r) => r.id === selectedAlgoId) || report.results[0];
  }, [report, selectedAlgoId]);

  // Execute algorithm scenario comparison
  async function runScenarioComparison() {
    if (allNodes.length < 2) {
      toast.error("At least 2 locations are required.");
      return;
    }
    setEvaluating(true);
    try {
      let data;
      try {
        data = await api.compareShortestPaths({
          nodes: allNodes,
          source: sourceIndex,
          target: targetIndex,
        });
      } catch {
        // Fallback to local evaluation
        data = evaluateShortestPathScenario({
          nodes: allNodes,
          source: sourceIndex,
          target: targetIndex,
        });
      }
      setReport(data);
      toast.success("Scenario benchmark evaluated across all 5 algorithms!");
    } catch (err) {
      toast.error(err.message || "Failed to evaluate shortest path scenario");
    } finally {
      setEvaluating(false);
    }
  }

  // Export report as comprehensive JSON or Markdown text
  function downloadReport(format = "txt") {
    if (!report) return;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shortest-path-comparison-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Markdown / text format
    const lines = [
      `======================================================================`,
      `ROUTECRAFT DISPATCH LAB: SHORTEST PATH & SPANNING TREE ALGORITHM REPORT`,
      `======================================================================`,
      `Generated: ${report.generatedAt}`,
      `Total Graph Nodes: ${report.scenario.nodeCount} stops`,
      `Total Evaluated Edges: ${report.scenario.edgeCount} metric road segments`,
      `Source: [${report.scenario.source}] ${report.scenario.sourceLabel}`,
      `Target: [${report.scenario.target}] ${report.scenario.targetLabel}`,
      `Theoretical Optimum SSSP Distance: ${report.optimalShortestDistance} km`,
      ``,
      `----------------------------------------------------------------------`,
      `1. ALGORITHM BENCHMARK SUMMARY TABLE`,
      `----------------------------------------------------------------------`,
      `Algorithm               | Paradigm            | Runtime (ms) | Ops Count | Route/Tree Cost (km) | Efficiency`,
      `------------------------+---------------------+--------------+-----------+----------------------+-----------`,
    ];

    report.results.forEach((r) => {
      const name = r.name.padEnd(23, " ");
      const par = r.paradigm.padEnd(19, " ");
      const time = `${r.runtimeMs} ms`.padEnd(12, " ");
      const ops = `${r.operations}`.padEnd(9, " ");
      const cost = `${r.costKm} km`.padEnd(20, " ");
      const eff = `${r.efficiencyScore}%`.padEnd(9, " ");
      lines.push(`${name} | ${par} | ${time} | ${ops} | ${cost} | ${eff}`);
    });

    lines.push(
      ``,
      `----------------------------------------------------------------------`,
      `2. DETAILED COMPARISON & ARCHITECTURAL TRADEOFF ANALYSIS`,
      `----------------------------------------------------------------------`
    );

    report.results.forEach((r, idx) => {
      lines.push(
        `${idx + 1}. ${r.name} (${r.type})`,
        `   * Paradigm: ${r.paradigm}`,
        `   * Time Complexity: ${r.timeComplexity}`,
        `   * Space Complexity: ${r.spaceComplexity}`,
        `   * Measured Runtime: ${r.runtimeMs} ms`,
        `   * Operation Count: ${r.operations}`,
        `   * Solution Cost: ${r.costKm} km ${r.isMst ? "(Global MST weight)" : "(Path length)"}`,
        `   * Path Found: ${r.path?.length ? r.path.join(" -> ") : "N/A (MST Subtree)"}`,
        `   * Key Strength: ${r.pros}`,
        `   * Constraint / Limitation: ${r.cons}`,
        ``
      );
    });

    lines.push(
      `----------------------------------------------------------------------`,
      `3. DAA SCENARIO VERDICT`,
      `----------------------------------------------------------------------`,
      `* Dijkstra's Algorithm remains the most time-efficient method for single-pair shortest path`,
      `  queries when road weights are non-negative, taking full advantage of the greedy priority queue.`,
      `* Bellman-Ford provides robust edge relaxation capable of handling edge penalties or negative weights,`,
      `  trading quadratic O(V*E) runtime for verification reliability.`,
      `* Floyd-Warshall precomputes all-pairs shortest paths via dynamic programming O(V^3), making it optimal`,
      `  for dispatch tables where matrix lookups are frequent.`,
      `* Prim's and Kruskal's Algorithms compute the Minimum Spanning Tree, establishing optimal backbone`,
      `  network connectivity rather than minimizing individual origin-destination transit.`,
      `======================================================================`
    );

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shortest-path-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comprehensive DAA report downloaded.");
  }

  // Prepares bar chart data
  const chartData = useMemo(() => {
    if (!report?.results) return [];
    return report.results.map((r) => ({
      name: r.name.replace(" Algorithm", "").replace("'s", ""),
      runtimeMs: r.runtimeMs,
      operations: r.operations,
      costKm: r.costKm,
      efficiencyScore: r.efficiencyScore,
      id: r.id,
    }));
  }, [report]);

  return (
    <div className="curri-planner-stack shortest-lab-view">
      {/* Top Banner */}
      <section className="curri-hero-banner">
        <div className="curri-hero-content">
          <div className="curri-tagline">
            <span className="curri-tag-dot" />
            <span>ALGORITHM ARCHITECTURE LAB</span>
            <span className="curri-tag-badge">DAA BENCHMARK & COMPARISON</span>
          </div>
          <h1>Shortest Path & Spanning Tree Suite</h1>
          <p>
            Evaluate and compare <strong>Dijkstra</strong>, <strong>Prim’s</strong>, <strong>Kruskal’s</strong>,{" "}
            <strong>Bellman-Ford</strong>, and <strong>Floyd-Warshall</strong> simultaneously on live delivery networks.
            Inspect execution traces, runtime efficiency, cost trade-offs, and generate exportable DAA reports.
          </p>
        </div>

        <div className="curri-hero-actions">
          <button 
            type="button" 
            className="curri-btn curri-btn-secondary"
            onClick={() => downloadReport("txt")}
            disabled={!report}
            title="Download full analysis report"
          >
            <FileDown size={15} />
            <span>Export DAA Report</span>
          </button>
          <button 
            type="button" 
            className="curri-btn curri-btn-secondary"
            onClick={() => downloadReport("json")}
            disabled={!report}
            title="Export raw benchmark metrics"
          >
            <Download size={15} />
            <span>Export JSON</span>
          </button>
          <button 
            type="button" 
            className="curri-btn curri-btn-primary curri-btn-glow"
            onClick={runScenarioComparison}
            disabled={evaluating}
          >
            {evaluating ? <LoaderCircle size={16} className="spin" /> : <Play size={16} fill="currentColor" />}
            <span>{evaluating ? "Evaluating Algorithms…" : "Run Comparison"}</span>
          </button>
        </div>
      </section>

      {/* Scenario Controls Card */}
      <section className="surface-card lab-config-card">
        <div className="lab-config-header">
          <div className="config-title-wrap">
            <Compass size={18} className="accent-blue" />
            <div>
              <h3>Scenario Graph Configuration</h3>
              <p>Configure origin, destination, and network parameters</p>
            </div>
          </div>
          <div className="config-summary-pill">
            <span>{allNodes.length} Vertices</span>
            <span className="pill-dot">•</span>
            <span>{report?.scenario?.edgeCount || 0} Graph Edges</span>
          </div>
        </div>

        <div className="lab-config-grid">
          <div className="config-field">
            <label>Origin (Source Vertex)</label>
            <select 
              value={sourceIndex} 
              onChange={(e) => setSourceIndex(Number(e.target.value))}
              className="curri-select"
            >
              {allNodes.map((n, idx) => (
                <option key={`src-${idx}`} value={idx}>
                  [{idx}] {n.label || `Node ${idx}`} {idx === 0 ? "(Depot)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="config-field">
            <label>Destination (Target Vertex)</label>
            <select 
              value={targetIndex} 
              onChange={(e) => setTargetIndex(Number(e.target.value))}
              className="curri-select"
            >
              {allNodes.map((n, idx) => (
                <option key={`tgt-${idx}`} value={idx}>
                  [{idx}] {n.label || `Node ${idx}`}
                </option>
              ))}
            </select>
          </div>

          <div className="config-field">
            <label>Active Visualization Focus</label>
            <div className="algo-selector-pills">
              {report?.results?.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  className={`algo-pill-btn ${selectedAlgoId === res.id ? "is-active" : ""}`}
                  style={{
                    borderColor: selectedAlgoId === res.id ? ALGO_COLORS[res.id] : undefined,
                    backgroundColor: selectedAlgoId === res.id ? `${ALGO_COLORS[res.id]}18` : undefined,
                    color: selectedAlgoId === res.id ? ALGO_COLORS[res.id] : undefined,
                  }}
                  onClick={() => setSelectedAlgoId(res.id)}
                >
                  <span className="pill-indicator" style={{ background: ALGO_COLORS[res.id] }} />
                  {res.name.replace(" Algorithm", "")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Interactive Map & Trace on Left / Metric Cards on Right */}
      <div className="curri-layout-split">
        {/* Left Column: Interactive Visualizer & Step-by-Step Trace */}
        <div className="curri-column-main">
          <div className="surface-card map-panel-card">
            <div className="panel-bar">
              <div className="panel-bar-left">
                <Milestone size={16} />
                <span className="panel-title">
                  Visualizer: <strong>{selectedAlgo?.name}</strong>
                </span>
                <span className="badge-pill" style={{ color: ALGO_COLORS[selectedAlgo?.id] }}>
                  {selectedAlgo?.isMst ? "Minimum Spanning Tree" : "Point-to-Point Path"}
                </span>
              </div>
              <div className="panel-bar-right">
                <span className="cost-stat">
                  Cost: <strong>{selectedAlgo?.costKm} km</strong>
                </span>
              </div>
            </div>

            <div className="map-embed-container" style={{ height: "460px", position: "relative" }}>
              <RouteMap
                depot={depot}
                stops={stops}
                highlightEdges={selectedAlgo?.isMst ? selectedAlgo?.edges : []}
                highlightPath={!selectedAlgo?.isMst ? selectedAlgo?.path : selectedAlgo?.path}
                highlightColor={ALGO_COLORS[selectedAlgo?.id] || "#2b72e5"}
              />
            </div>

            {/* Trace Step Player */}
            <div className="trace-section-footer">
              <TracePlayer
                trace={selectedAlgo?.trace || []}
                algorithm={selectedAlgo?.name}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Key Details & Algorithm Inspector */}
        <div className="curri-column-side">
          <div className="surface-card algo-inspector-card">
            <div className="inspector-head" style={{ borderLeftColor: ALGO_COLORS[selectedAlgo?.id] }}>
              <span className="sub-tag">{selectedAlgo?.type}</span>
              <h3>{selectedAlgo?.name}</h3>
              <p className="paradigm-line">Paradigm: <strong>{selectedAlgo?.paradigm}</strong></p>
            </div>

            <div className="inspector-kpis">
              <div className="kpi-mini-box">
                <Clock size={15} />
                <label>Time Complexity</label>
                <span>{selectedAlgo?.timeComplexity}</span>
              </div>
              <div className="kpi-mini-box">
                <Cpu size={15} />
                <label>Space Complexity</label>
                <span>{selectedAlgo?.spaceComplexity}</span>
              </div>
              <div className="kpi-mini-box">
                <Timer size={15} />
                <label>Runtime</label>
                <strong>{selectedAlgo?.runtimeMs} ms</strong>
              </div>
              <div className="kpi-mini-box">
                <Activity size={15} />
                <label>Operations</label>
                <strong>{selectedAlgo?.operations} ops</strong>
              </div>
              <div className="kpi-mini-box">
                <Route size={15} />
                <label>{selectedAlgo?.isMst ? "Total MST Cost" : "Shortest Distance"}</label>
                <strong className="text-primary">{selectedAlgo?.costKm} km</strong>
              </div>
              <div className="kpi-mini-box">
                <Zap size={15} />
                <label>Efficiency Index</label>
                <strong style={{ color: ALGO_COLORS[selectedAlgo?.id] }}>
                  {selectedAlgo?.efficiencyScore}/100
                </strong>
              </div>
            </div>

            <div className="inspector-route-box">
              <label>Computed Sequence</label>
              {selectedAlgo?.path?.length > 0 ? (
                <div className="route-tags-wrap">
                  {selectedAlgo.path.map((nodeIdx, i) => (
                    <span key={`p-${i}`} className="node-seq-tag">
                      <span className="node-idx">{nodeIdx}</span>
                      <span className="node-lbl">{allNodes[nodeIdx]?.label || `Node ${nodeIdx}`}</span>
                      {i < selectedAlgo.path.length - 1 && <ArrowRight size={12} className="seq-arrow" />}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted">Global spanning tree with {selectedAlgo?.edges?.length || 0} non-cyclic edges</p>
              )}
            </div>

            <div className="inspector-analysis-notes">
              <div className="note-item">
                <span className="note-badge pro">STRENGTH</span>
                <p>{selectedAlgo?.pros}</p>
              </div>
              <div className="note-item">
                <span className="note-badge con">LIMITATION</span>
                <p>{selectedAlgo?.cons}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Charts: Runtime, Cost, and Operations side by side */}
      <section className="surface-card comparison-charts-card">
        <div className="chart-card-head">
          <div>
            <span className="section-kicker">EMPIRICAL BENCHMARK CHARTS</span>
            <h2>Algorithm Metrics Comparison on Current Scenario</h2>
            <p>Runtime speed, operation overhead, and solution cost compared across all 5 algorithms</p>
          </div>
        </div>

        <div className="charts-dual-grid">
          {/* Chart 1: Runtime & Operations */}
          <div className="chart-item-box">
            <h4>Computational Effort (Operations Count)</h4>
            <div style={{ height: "240px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf1" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <RechartsTooltip />
                  <Bar dataKey="operations" name="Operations" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={`cell-ops-${entry.id}`} fill={ALGO_COLORS[entry.id] || "#2b72e5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Cost & Efficiency Score */}
          <div className="chart-item-box">
            <h4>Algorithm Efficiency Score (0-100%)</h4>
            <div style={{ height: "240px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf1" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <RechartsTooltip />
                  <Bar dataKey="efficiencyScore" name="Efficiency Score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={`cell-eff-${entry.id}`} fill={ALGO_COLORS[entry.id] || "#2b72e5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Full Comparison Report Table */}
      <section className="surface-card comparison-table-card">
        <div className="table-heading">
          <div>
            <span className="section-kicker">SCENARIO REPORT</span>
            <h2>Comprehensive 5-Algorithm Comparison Matrix</h2>
            <p>Direct comparison of time consumption, cost consumption, asymptotic bound, and efficiency score</p>
          </div>
          <button 
            type="button" 
            className="curri-btn curri-btn-secondary"
            onClick={() => downloadReport("txt")}
          >
            <FileText size={14} />
            <span>Download Report</span>
          </button>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Paradigm</th>
                <th>Time Complexity</th>
                <th>Space Complexity</th>
                <th>Runtime</th>
                <th>Operations</th>
                <th>Cost / Distance</th>
                <th>Efficiency</th>
                <th>Optimality Guarantee</th>
              </tr>
            </thead>
            <tbody>
              {report?.results?.map((item) => (
                <tr 
                  key={item.id} 
                  className={selectedAlgoId === item.id ? "row-highlighted" : ""}
                  onClick={() => setSelectedAlgoId(item.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div className="algo-cell-name">
                      <span className="table-algo-dot" style={{ background: ALGO_COLORS[item.id] }} />
                      <div>
                        <strong>{item.name}</strong>
                        <small className="cell-sub">{item.type}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="paradigm-tag">{item.paradigm}</span></td>
                  <td><code>{item.timeComplexity}</code></td>
                  <td><code>{item.spaceComplexity}</code></td>
                  <td><strong>{item.runtimeMs} ms</strong></td>
                  <td>{item.operations.toLocaleString()}</td>
                  <td>
                    <strong>{item.costKm} km</strong>
                    {item.isMst && <small className="mst-badge-inline">Tree Total</small>}
                  </td>
                  <td>
                    <div className="eff-pill-bar">
                      <span className="eff-num">{item.efficiencyScore}%</span>
                      <div className="eff-track">
                        <div 
                          className="eff-fill" 
                          style={{ 
                            width: `${item.efficiencyScore}%`, 
                            background: ALGO_COLORS[item.id] 
                          }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="guarantee-cell">
                      <CheckCircle2 size={13} className="text-success" />
                      {item.guarantee}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* DAA Insights & Conclusion Card */}
      <section className="exact-note">
        <div className="note-icon">
          <Lightbulb size={20} />
        </div>
        <div>
          <b>DAA Complexity & Routing Analysis Insight</b>
          <p>
            While <strong>Dijkstra</strong>, <strong>Bellman-Ford</strong>, and <strong>Floyd-Warshall</strong> solve the 
            Shortest Path Problem (minimizing point-to-point displacement), <strong>Prim’s</strong> and <strong>Kruskal’s</strong> solve 
            the Minimum Spanning Tree problem (minimizing aggregate edge weight to link all nodes). In logistical dispatch, MST algorithms 
            generate the network infrastructure backbone (and form the basis of the 2-approximation metric TSP), while Dijkstra’s algorithm 
            delivers the fastest single-destination trajectory.
          </p>
        </div>
      </section>
    </div>
  );
}
