import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownToLine, BarChart3, Clock3, Database, LoaderCircle, Play, Sparkles, TrendingUp, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client.js";

const colors = { "nearest-neighbor": "#2b72e5", "two-opt": "#0eaa87", combined: "#e39a22", "held-karp": "#8c62d8", "branch-and-bound": "#ed6c69" };
const names = { "nearest-neighbor": "Nearest neighbor", "two-opt": "2-opt", combined: "Savings + 2-opt + SA", "held-karp": "Held–Karp", "branch-and-bound": "Branch & bound" };
const demoRows = [
  { nStops: 8, "nearest-neighbor": 0.2, "two-opt": 0.4, combined: 0.9, "held-karp": 1.1 },
  { nStops: 12, "nearest-neighbor": 0.3, "two-opt": 0.8, combined: 1.8, "held-karp": 3.4 },
  { nStops: 16, "nearest-neighbor": 0.5, "two-opt": 1.6, combined: 3.0, "held-karp": 31.8 },
  { nStops: 20, "nearest-neighbor": 0.8, "two-opt": 2.8, combined: 5.4, "held-karp": null },
  { nStops: 32, "nearest-neighbor": 1.6, "two-opt": 8.4, combined: 13.8, "held-karp": null },
  { nStops: 50, "nearest-neighbor": 3.8, "two-opt": 24.6, combined: 38.2, "held-karp": null },
  { nStops: 80, "nearest-neighbor": 9.5, "two-opt": 88.0, combined: 104.0, "held-karp": null },
];
const demoBenchmarkRows = demoRows.flatMap((row) => Object.keys(names)
  .filter((algorithm) => row[algorithm] != null)
  .map((algorithm) => ({ nStops: row.nStops, algorithm, runtimeMs: row[algorithm], cost: null, gapPct: null, operations: null, seed: 42 })));

export default function BenchmarksView() {
  const [running, setRunning] = useState(false);
  const [liveRows, setLiveRows] = useState(null);
  const query = useQuery({ queryKey: ["benchmarks"], queryFn: api.benchmarks, retry: false });
  const rows = liveRows ?? query.data ?? [];
  const chartData = useMemo(() => {
    if (!rows.length) return demoRows;
    const totals = new Map();
    for (const row of rows) {
      if (row.runtimeMs == null) continue;
      const key = `${Number(row.nStops)}:${row.algorithm}`;
      const current = totals.get(key) ?? { nStops: Number(row.nStops), algorithm: row.algorithm, sum: 0, count: 0 };
      current.sum += Number(row.runtimeMs);
      current.count += 1;
      totals.set(key, current);
    }
    const points = new Map();
    for (const item of totals.values()) {
      if (!points.has(item.nStops)) points.set(item.nStops, { nStops: item.nStops });
      points.get(item.nStops)[item.algorithm] = item.sum / item.count;
    }
    return [...points.values()].sort((a, b) => a.nStops - b.nStops);
  }, [rows]);
  const latest = rows.length > 0;

  async function runBenchmark() {
    setRunning(true);
    try {
      const response = await api.runBenchmarks({ algorithms: ["nearest-neighbor", "two-opt", "combined", "held-karp"], sizes: [8, 12, 16, 20, 32], seeds: 1 });
      setLiveRows(response.results);
      toast.success("Benchmark batch completed.");
    } catch (error) {
      if (error.response) toast.error(error.response.data?.error || "Benchmark could not run.");
      else { setLiveRows(demoBenchmarkRows); toast("Showing the bundled, illustrative benchmark fixture.", { icon: "📊" }); }
    } finally { setRunning(false); }
  }

  function exportCsv() {
    const content = ["n_stops,algorithm,runtime_ms,cost,gap_pct", ...rows.map((row) => [row.nStops, row.algorithm, row.runtimeMs ?? "", row.cost ?? "", row.gapPct ?? ""].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "routecraft-benchmark.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="page-stack">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />EMPIRICAL ANALYSIS <span className="eyebrow-separator">/</span> COMPLEXITY BENCHMARK</div><h1>Benchmark studio</h1><p>Watch runtime scale with n. Re-run with a fixed seed, then export the data for your DAA report.</p></div><div className="heading-actions"><button className="button button-quiet" onClick={exportCsv} disabled={!rows.length}><ArrowDownToLine size={15} />Export CSV</button><button className="button button-primary" onClick={runBenchmark} disabled={running}>{running ? <LoaderCircle size={15} className="spin" /> : <Play size={15} fill="currentColor" />}{running ? "Running batch…" : "Run benchmark"}</button></div></section>
    <div className="benchmark-banner"><div className="benchmark-banner-icon"><TrendingUp size={20} /></div><div><b>Complexity is a shape, not just a number.</b><p>Same deterministic delivery instances · seed 42 · runtime shown in milliseconds · exact solvers stop at their configured limits.</p></div><span className={`benchmark-source ${latest ? "source-live" : ""}`}><span />{latest ? "LIVE / STORED RUNS" : "ILLUSTRATIVE FIXTURE"}</span></div>
    <div className="benchmark-kpis"><div className="benchmark-kpi surface-card"><span className="benchmark-kpi-icon blue-soft"><Database size={16} /></span><div><small>INSTANCE SIZES</small><b>{chartData.length}</b><i>stop counts sampled</i></div></div><div className="benchmark-kpi surface-card"><span className="benchmark-kpi-icon green-soft"><Zap size={16} /></span><div><small>FASTEST APPROACH</small><b>Greedy</b><i>quadratic route scan</i></div></div><div className="benchmark-kpi surface-card"><span className="benchmark-kpi-icon violet-soft"><Clock3 size={16} /></span><div><small>EXACT LIMIT</small><b>≤ 18 stops</b><i>Held–Karp configured cap</i></div></div><div className="benchmark-kpi surface-card"><span className="benchmark-kpi-icon amber-soft"><Activity size={16} /></span><div><small>REPRODUCIBILITY</small><b>Seed 42</b><i>deterministic instances</i></div></div></div>
    <div className="chart-grid">
      <section className="surface-card benchmark-chart-card"><div className="chart-card-head"><div><span className="section-kicker">RUNTIME GROWTH</span><h2>Runtime by stop count</h2><p>Logarithmic y-axis · lower is faster</p></div><span className="chart-unit">MILLISECONDS</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 16, right: 14, bottom: 8, left: 2 }}><CartesianGrid stroke="#e7edf1" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="nStops" axisLine={false} tickLine={false} tick={{ fill: "#82919d", fontSize: 11 }} label={{ value: "Number of stops (n)", position: "insideBottom", offset: -3, fill: "#8a98a3", fontSize: 11 }} /><YAxis scale="log" domain={[0.1, "auto"]} axisLine={false} tickLine={false} tick={{ fill: "#82919d", fontSize: 11 }} tickFormatter={(value) => `${value}`} /><Tooltip content={<ChartTooltip />} /><Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11, color: "#556571", paddingBottom: 12 }} />{Object.keys(names).map((key) => <Line key={key} type="monotone" dataKey={key} name={names[key]} stroke={colors[key]} strokeWidth={2.6} dot={{ r: 3.4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} connectNulls={false} />)}</LineChart></ResponsiveContainer></div><div className="chart-footnote"><span><i className="note-dash" />Measured runtime · varies with hardware</span><span><i className="note-hollow" />Missing point = exact solver limit or not run</span></div></section>
      <section className="surface-card benchmark-notes"><div className="chart-card-head"><div><span className="section-kicker">COMPLEXITY LENS</span><h2>Why the curves diverge</h2></div><div className="complexity-icon"><BarChart3 size={17} /></div></div><div className="complexity-list"><ComplexityRow symbol="O(n²)" label="Nearest neighbor" text="Predictable and fast; route quality is only locally informed." color="blue" /><ComplexityRow symbol="O(n²)" label="2-opt" text="More pair checks, often a worthwhile reduction in travel distance." color="green" /><ComplexityRow symbol="O(n² 2ⁿ)" label="Held–Karp" text="Exact TSP baseline; exponential subset states set a practical ceiling." color="violet" /><ComplexityRow symbol="O(n!)" label="Brute force" text="Useful for teaching and tiny instances, not a dispatch workhorse." color="amber" /></div><div className="benchmark-callout"><Sparkles size={15} /><p><b>Compare quality too.</b> Runtime alone does not tell you whether an extra second saved meaningful distance. Pair this chart with the optimality gap from a small exact baseline.</p></div></section>
    </div>
    <section className="surface-card benchmark-table-card"><div className="table-heading"><div><span className="section-kicker">RAW EXPERIMENTS</span><h2>Measurement table</h2><p>Use these observations with machine, Node version, seed, and constraints in your report.</p></div><span className="table-row-count">{rows.length || chartData.length} OBSERVATIONS</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Stops (n)</th><th>Algorithm</th><th>Runtime</th><th>Route cost</th><th>Optimality gap</th><th>Operations</th></tr></thead><tbody>{rows.length ? rows.slice(0, 12).map((row, index) => <tr key={`${row.nStops}-${row.algorithm}-${row.seed ?? index}`}><td><b>{row.nStops}</b></td><td><span className="table-algo-dot" style={{ background: colors[row.algorithm] || "#80919b" }} />{names[row.algorithm] || row.algorithm}</td><td>{row.runtimeMs == null ? "—" : `${Number(row.runtimeMs).toFixed(2)} ms`}</td><td>{row.cost == null ? "—" : `${Number(row.cost).toFixed(2)} km`}</td><td>{row.gapPct == null ? "—" : `${Number(row.gapPct).toFixed(1)}%`}</td><td>{row.operations == null ? "—" : Number(row.operations).toLocaleString()}</td></tr>) : <tr><td colSpan="6" className="table-empty">Bundled runtime figures are illustrative. Run a benchmark to capture measurements on this environment.</td></tr>}</tbody></table></div></section>
  </div>;
}

function ComplexityRow({ symbol, label, text, color }) { return <div className="complexity-row"><span className={`complexity-symbol complexity-${color}`}>{symbol}</span><div><b>{label}</b><p>{text}</p></div></div>; }
function ChartTooltip({ active, payload, label }) { if (!active || !payload?.length) return null; return <div className="chart-tooltip"><b>{label} stops</b>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} />{item.name}<strong>{Number(item.value).toFixed(2)} ms</strong></div>)}</div>; }
