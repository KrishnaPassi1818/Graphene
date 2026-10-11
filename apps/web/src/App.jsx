import { lazy, Suspense, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, BarChart3, ChevronDown, Clock3, Command, FileClock, LifeBuoy, MapPinned, Settings2, ShieldCheck } from "lucide-react";
import { api } from "./api/client.js";
import { usePlannerStore } from "./store/usePlannerStore.js";
const PlannerView = lazy(() => import("./views/PlannerView.jsx"));
const AlgorithmsView = lazy(() => import("./views/AlgorithmsView.jsx"));
const BenchmarksView = lazy(() => import("./views/BenchmarksView.jsx"));
const RunsView = lazy(() => import("./views/RunsView.jsx"));
const AccessView = lazy(() => import("./views/AccessView.jsx"));
const PrivacyPolicyView = lazy(() => import("./views/PrivacyPolicyView.jsx"));
const TermsConditionsView = lazy(() => import("./views/TermsConditionsView.jsx"));

const navigation = [
  { label: "Dispatch", items: [{ path: "/", label: "Route planner", icon: MapPinned, badge: "LIVE" }, { path: "/runs", label: "Run history", icon: FileClock }] },
  { label: "Learn & analyze", items: [{ path: "/algorithms", label: "Algorithms", icon: Activity }, { path: "/benchmarks", label: "Benchmarks", icon: BarChart3 }] },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const page = path === "/" ? "planner" : path.replace("/", "");
  const setPage = usePlannerStore((state) => state.setPage);
  const setPlanner = usePlannerStore((state) => state.setPlanner);
  const setFallbackMode = usePlannerStore((state) => state.setFallbackMode);
  const planner = usePlannerStore((state) => state.planner);
  const fallbackMode = usePlannerStore((state) => state.fallbackMode);

  const plannerQuery = useQuery({ queryKey: ["planner"], queryFn: api.planner, retry: 1, refetchOnWindowFocus: false });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: api.health, retry: false, refetchInterval: 45_000 });

  useEffect(() => {
    if (plannerQuery.data) setPlanner(plannerQuery.data);
    else if (plannerQuery.isError) setFallbackMode();
  }, [plannerQuery.data, plannerQuery.isError, setPlanner, setFallbackMode]);
  useEffect(() => { setPage(page); }, [page, setPage]);

  const routeStatus = healthQuery.data?.status === "ready" ? "API CONNECTED" : fallbackMode ? "LOCAL DEMO" : "CONNECTING";
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).format(new Date()).toUpperCase(), []);
  const title = ({
    planner: "TMS Route Planner",
    runs: "Run history",
    algorithms: "Algorithm lab",
    benchmarks: "Benchmark studio",
    settings: "API & custom domain",
    login: "Access & security",
    privacy: "Privacy policy",
    terms: "Terms and conditions",
  })[page] ?? "TMS Route Planner";

  function goTo(nextPath) { navigate(nextPath); }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /><span /></div><div className="brand-name">TMS DISPATCH<span>OPERATIONS DESK</span></div><button className="workspace-switch" aria-label="Workspace menu"><ChevronDown size={13} /></button></div>
        <button className="workspace-card"><span className="workspace-badge">PN</span><span className="workspace-copy"><b>Punjab North Hub</b><small>Fleet depot & routing</small></span><ChevronDown size={14} /></button>

        <nav className="side-navigation" aria-label="Main navigation">
          {navigation.map((group) => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.items.map(({ path: target, label, icon: Icon, badge }) => <button key={target} className={`nav-item ${path === target ? "nav-item-active" : ""}`} onClick={() => goTo(target)}><Icon size={17} strokeWidth={path === target ? 2.3 : 1.8} /><span>{label}</span>{badge && <i>{badge}</i>}</button>)}</div>)}
          <div className="nav-group"><div className="nav-group-label">Workspace</div><button className={`nav-item ${page === "settings" || page === "login" ? "nav-item-active" : ""}`} onClick={() => goTo("/settings")}><Settings2 size={17} /><span>API & domain</span></button></div>
          <div className="nav-group"><div className="nav-group-label">Legal</div><button className={`nav-item ${page === "privacy" ? "nav-item-active" : ""}`} onClick={() => goTo("/privacy")}><ShieldCheck size={17} /><span>Privacy policy</span></button><button className={`nav-item ${page === "terms" ? "nav-item-active" : ""}`} onClick={() => goTo("/terms")}><FileClock size={17} /><span>Terms & conditions</span></button></div>
        </nav>

        <div className="sidebar-bottom">
          <div className="engine-card"><div className="engine-status"><span className={routeStatus === "API CONNECTED" ? "status-green" : "status-amber"} /><span>{routeStatus}</span><button title="Refresh health" onClick={() => healthQuery.refetch()}><ArrowUpRight size={13} /></button></div><b>Route engine</b><small>{healthQuery.data?.database?.status === "ready" ? "Postgres + cache available" : "Haversine · zero-key mode"}</small></div>
          <button className="help-link" onClick={() => window.open("/api/docs", "_blank", "noopener,noreferrer")}><LifeBuoy size={15} />API documentation<ArrowUpRight size={13} /></button>
          <div className="sidebar-user"><span className="user-avatar">SD</span><span className="sidebar-user-copy"><b>Operations dispatcher</b><small>{planner.demoMode === false ? "Authenticated workspace" : "Demo workspace"}</small></span><button title="Open access settings" onClick={() => goTo("/settings")}><ChevronDown size={14} /></button></div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left"><div className="mobile-brand"><div className="brand-mark"><span /><span /><span /><span /></div><b>TMS ROUTE PLANNER</b></div><div className="breadcrumb"><span>TMS OPERATIONS</span><i>/</i><b>{title.toUpperCase()}</b></div></div>
          <div className="topbar-right"><div className="date-chip"><Clock3 size={14} />{dateLabel}</div><div className={`connection-pill ${routeStatus === "API CONNECTED" ? "connection-good" : ""}`}><span />{routeStatus}</div><button className="command-button" title="Search stops and pages"><Command size={14} /><span>Search</span><kbd>⌘ K</kbd></button><button className="topbar-avatar" onClick={() => goTo("/settings")} title="Access and user settings">SD</button></div>
        </header>

        <div className="content-shell">
          <Suspense fallback={<div className="view-loading"><span className="spin-dot" />Loading workspace view…</div>}>
            {page === "planner" && <PlannerView />}
            {page === "algorithms" && <AlgorithmsView onNavigate={goTo} />}
            {page === "benchmarks" && <BenchmarksView />}
            {page === "runs" && <RunsView />}
            {(page === "settings" || page === "login") && <AccessView />}
            {page === "privacy" && <PrivacyPolicyView />}
            {page === "terms" && <TermsConditionsView />}
          </Suspense>
        </div>
        <footer className="app-footer">
          <div className="footer-left">
            <span>TRANSPORTATION MANAGEMENT SYSTEM</span>
            <i>·</i>
            <span>DISPATCH & ROUTE OPTIMIZATION</span>
          </div>
          <div className="footer-right">
            <button type="button" onClick={() => goTo("/privacy")} className="footer-link">Privacy policy</button>
            <i>·</i>
            <button type="button" onClick={() => goTo("/terms")} className="footer-link">Terms and conditions</button>
            <i>·</i>
            <span><ShieldCheck size={12} /> Verified operational telemetry</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
