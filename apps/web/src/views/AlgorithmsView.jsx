import { ArrowRight, ArrowUpRight, Check, Clock3, Compass, GitBranch, Gauge, Layers3, Lightbulb, Route, Sparkles } from "lucide-react";
import { ALGORITHM_REGISTRY, ROUTE_ALGORITHM_IDS } from "@courier/algorithms";
import { usePlannerStore } from "../store/usePlannerStore.js";

const groups = [
  { title: "Shortest paths", icon: Compass, color: "blue", items: ["dijkstra", "bellman-ford", "floyd-warshall", "ucs", "bfs", "yen-k-shortest"] },
  { title: "Minimum Spanning Tree (MST)", icon: GitBranch, color: "green", items: ["prims", "kruskal"] },
  { title: "Exact TSP", icon: GitBranch, color: "violet", items: ["brute-force", "branch-and-bound"] },
  { title: "Routing & Approximation", icon: Route, color: "green", items: ["nearest-neighbor", "mst-2approx"] },
  { title: "Clustering & CVRP", icon: Layers3, color: "amber", items: ["sweep", "kmeans"] },
];

export default function AlgorithmsView({ onNavigate }) {
  const setAlgorithm = usePlannerStore((state) => state.setAlgorithm);
  return <div className="page-stack">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />DAA CONCEPTS <span className="eyebrow-separator">/</span> ALGORITHM CATALOG</div><h1>Algorithm lab</h1><p>Compare the ideas behind the route engine: exactness, complexity, and when each approach fits.</p></div><div className="heading-actions"><span className="catalog-count"><span>{ALGORITHM_REGISTRY.length}</span> IMPLEMENTED ALGORITHMS</span></div></section>
    <div className="algorithm-hero"><div className="algorithm-hero-copy"><span className="hero-overline"><Sparkles size={14} />FROM-SCRATCH SOLVERS</span><h2>One delivery problem.<br /><em>Many ways to solve it.</em></h2><p>Every solver runs against the same distance matrix. The core is pure JavaScript, deterministic by seed, and instrumented with operation counters.</p><div className="algorithm-hero-stats"><span><b>4</b><small>PARADIGMS</small></span><span><b>O(n!)</b><small>EXACT SEARCH</small></span><span><b>2-opt</b><small>LOCAL SEARCH</small></span></div></div><div className="hero-diagram"><div className="diagram-orbit orbit-one" /><div className="diagram-orbit orbit-two" /><div className="diagram-route-line" /><span className="diagram-depot"><span /></span><span className="diagram-node node-a">01</span><span className="diagram-node node-b">02</span><span className="diagram-node node-c">03</span><span className="diagram-node node-d">04</span><div className="diagram-callout"><div className="mini-spark"><Sparkles size={13} /></div><span><b>NP-hard, not hopeless</b><small>Choose the right trade-off</small></span></div><div className="diagram-coordinate">30.9004° N<br />75.8573° E</div></div></div>
    <section className="algorithm-groups">
      {groups.map((group) => { const Icon = group.icon; return <div className="algorithm-group" key={group.title}><div className="algorithm-group-head"><span className={`group-icon group-${group.color}`}><Icon size={17} /></span><div><h2>{group.title}</h2><p>{group.items.length} methods · independently tested</p></div><ArrowUpRight size={15} className="muted-icon" /></div><div className="algorithm-card-grid">{group.items.map((id) => { const algorithm = ALGORITHM_REGISTRY.find((item) => item.id === id); if (!algorithm) return null; const isRoute = ROUTE_ALGORITHM_IDS.includes(id); return <article className="algorithm-card" key={id}><div className="algorithm-card-top"><span className={`algorithm-category category-${group.color}`}>{algorithm.paradigm}</span>{algorithm.exact ? <span className="exact-badge"><Check size={11} />EXACT</span> : <span className="approx-badge">HEURISTIC</span>}</div><h3>{algorithm.name}</h3><p>{algorithm.description}</p><div className="algorithm-card-meta"><span><Clock3 size={13} />{algorithm.complexity}</span><span className="space-meta"><Gauge size={13} />{algorithm.space}</span></div>{isRoute && <button className="algorithm-try" onClick={() => { setAlgorithm(id); onNavigate("/"); }}>Try in planner <ArrowRight size={14} /></button>}</article>; })}</div></div>; })}
    </section>
    <div className="exact-note"><div className="note-icon"><Lightbulb size={17} /></div><div><b>Exact route ordering does not make a complete CVRP partition exact.</b><p>When multiple vehicles are selected, Branch & Bound and the other exact solvers optimize the stop order inside each capacity-feasible cluster. The vehicle assignment remains a heuristic. This distinction is important for an accurate DAA analysis.</p></div></div>
  </div>;
}
