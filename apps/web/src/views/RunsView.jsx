import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpRight, Clock3, Download, FileClock, Layers3, Route, Search } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { usePlannerStore } from "../store/usePlannerStore.js";

const names = { "nearest-neighbor": "Nearest neighbor", "mst-2approx": "MST 2-approx", "two-opt": "2-opt local search", "or-opt": "Or-opt relocation", "simulated-annealing": "Simulated annealing", sweep: "Sweep clustering", kmeans: "Capacity K-means", "clarke-wright": "Clarke–Wright savings", combined: "Savings + 2-opt + SA", "held-karp": "Held–Karp DP", "branch-and-bound": "Branch & bound", "brute-force": "Brute force" };
const palette = ["#2b72e5", "#0eaa87", "#e39a22", "#8c62d8"];

export default function RunsView() {
  const navigate = useNavigate();
  const localRuns = usePlannerStore((state) => state.history);
  const query = useQuery({ queryKey: ["runs"], queryFn: api.runs, retry: false });
  const remote = query.data ?? [];
  const merged = [...localRuns, ...remote.filter((run) => !localRuns.some((local) => local.id === run.id))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const summary = merged.reduce((best, run) => ({ runs: best.runs + 1, distance: best.distance + Number(run.totalDistance ?? run.totalCost ?? 0), runtime: best.runtime + Number(run.runtimeMs ?? 0) }), { runs: 0, distance: 0, runtime: 0 });

  function exportHistory() {
    const csv = ["run_id,algorithm,total_distance_km,runtime_ms,operations,created_at", ...merged.map((run) => [run.id, run.algorithm, run.totalDistance ?? run.totalCost ?? "", run.runtimeMs ?? "", run.opCount ?? run.stats?.operations ?? "", run.createdAt].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = "routecraft-run-history.csv"; link.click(); URL.revokeObjectURL(url); toast.success("Run history exported.");
  }

  return <div className="page-stack">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />DISPATCH ARCHIVE <span className="eyebrow-separator">/</span> OPTIMIZATION RUNS</div><h1>Run history</h1><p>A reproducible trail of the route decisions your team has explored.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={exportHistory}><ArrowDownToLine size={15} />Export history</button></div></section>
    <section className="run-overview-grid"><div className="run-overview-card surface-card"><span className="run-overview-icon blue-soft"><FileClock size={16} /></span><small>OPTIMIZATION RUNS</small><b>{String(summary.runs).padStart(2, "0")}</b><span>{remote.length ? "Persisted in API" : "This browser + current session"}</span></div><div className="run-overview-card surface-card"><span className="run-overview-icon green-soft"><Route size={16} /></span><small>ROUTE DISTANCE SUM</small><b>{summary.distance.toFixed(2)}<i> km</i></b><span>Across listed solutions</span></div><div className="run-overview-card surface-card"><span className="run-overview-icon amber-soft"><Clock3 size={16} /></span><small>COMPUTE TIME SUM</small><b>{summary.runtime.toFixed(1)}<i> ms</i></b><span>Solver runtime, not API wait</span></div></section>
    <section className="surface-card runs-table-card"><div className="table-heading"><div><span className="section-kicker">OPTIMIZATION LOG</span><h2>Recent runs</h2><p>Completed route plans are saved to PostgreSQL when configured.</p></div><div className="table-search"><Search size={14} /><span>All algorithms</span></div></div>{merged.length ? <div className="data-table-wrap"><table className="data-table runs-table"><thead><tr><th>Algorithm</th><th>Run ID</th><th>Distance</th><th>Runtime</th><th>Operations</th><th>Status</th><th>Started</th></tr></thead><tbody>{merged.map((run, index) => <tr key={`${run.id}-${index}`}><td><span className="run-algorithm"><i style={{ background: palette[index % palette.length] }} />{names[run.algorithm] || run.algorithm}</span></td><td className="run-id">{String(run.id).slice(0, 12)}…</td><td><b>{Number(run.totalDistance ?? run.totalCost ?? 0).toFixed(2)} km</b></td><td>{Number(run.runtimeMs ?? run.stats?.runtimeMs ?? 0).toFixed(2)} ms</td><td>{Number(run.opCount ?? run.stats?.operations ?? 0).toLocaleString()}</td><td><span className="run-status"><i />Complete</span></td><td>{new Date(run.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td></tr>)}</tbody></table></div> : <div className="empty-runs"><div className="empty-runs-icon"><Layers3 size={20} /></div><b>No optimization runs yet</b><p>Run a plan from the Route planner. Each result will appear here with its distance, runtime, and operation count.</p><button className="button button-primary" onClick={() => navigate("/")}><ArrowUpRight size={14} />Back to planner</button></div>}</section>
    <div className="archive-note"><Download size={15} /><span>History export includes the current view. To save benchmark experiments, export them from Benchmark studio.</span></div>
  </div>;
}
