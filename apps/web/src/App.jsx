import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  BarChart3, 
  ChevronLeft,
  ChevronRight,
  Clock3, 
  Command, 
  FileClock, 
  Navigation2,
  Route as RouteIcon,
  Settings2, 
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { api } from "./api/client.js";
import { usePlannerStore } from "./store/usePlannerStore.js";

const PlannerView = lazy(() => import("./views/PlannerView.jsx"));
const AlgorithmsView = lazy(() => import("./views/AlgorithmsView.jsx"));
const BenchmarksView = lazy(() => import("./views/BenchmarksView.jsx"));
const RunsView = lazy(() => import("./views/RunsView.jsx"));
const AccessView = lazy(() => import("./views/AccessView.jsx"));
const ShortestPathLabView = lazy(() => import("./views/ShortestPathLabView.jsx"));

const navigation = [
  { 
    label: "Routing Operations", 
    items: [
      { path: "/", label: "Route Planner", icon: RouteIcon },
      { path: "/shortest-paths", label: "Shortest Path & MST Suite", icon: Navigation2 },
      { path: "/runs", label: "Fleet History", icon: FileClock }
    ] 
  },
  { 
    label: "Intelligence Lab", 
    items: [
      { path: "/algorithms", label: "Algorithm Lab", icon: Activity },
      { path: "/benchmarks", label: "Benchmarks", icon: BarChart3 }
    ] 
  },
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

  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const plannerQuery = useQuery({ queryKey: ["planner"], queryFn: api.planner, retry: 1, refetchOnWindowFocus: false });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: api.health, retry: false, refetchInterval: 45_000 });

  useEffect(() => {
    if (plannerQuery.data) setPlanner(plannerQuery.data);
    else if (plannerQuery.isError) setFallbackMode();
  }, [plannerQuery.data, plannerQuery.isError, setPlanner, setFallbackMode]);
  
  useEffect(() => { setPage(page); }, [page, setPage]);

  // Touch and wheel swipe gesture listeners to collapse/expand sidebar
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      // Only respond if horizontal swipe is dominant (> 40px and more than vertical)
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          // Swipe left -> collapse
          setCollapsed(true);
        } else if (deltaX > 0) {
          // Swipe right -> expand
          setCollapsed(false);
        }
      }
      touchStartX.current = null;
      touchStartY.current = null;
    };

    // Horizontal wheel / trackpad scroll on sidebar or edge to collapse/expand
    const sidebarEl = sidebarRef.current;
    const handleWheel = (e) => {
      if (Math.abs(e.deltaX) > 30) {
        if (e.deltaX > 0) setCollapsed(true); // scrolling right -> collapse sidebar
        else if (e.deltaX < 0) setCollapsed(false); // scrolling left -> expand sidebar
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    if (sidebarEl) sidebarEl.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      if (sidebarEl) sidebarEl.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const dateLabel = new Intl.DateTimeFormat("en-US", { 
    weekday: "short", 
    month: "short", 
    day: "numeric" 
  }).format(new Date());

  const title = ({
    planner: "Route Planner",
    "shortest-paths": "Shortest Path & MST Suite",
    runs: "Fleet History",
    algorithms: "Algorithm Lab",
    benchmarks: "Benchmarks",
    settings: "Settings",
    login: "Authentication",
  })[page] ?? "Route Planner";

  function goTo(nextPath) { navigate(nextPath); }

  return (
    <div className={`curri-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Collapsible Left Sidebar */}
      <aside className={`curri-sidebar ${collapsed ? "is-collapsed" : ""}`} ref={sidebarRef}>
        {/* Brand Lockup */}
        <div className="curri-brand">
          <div className="curri-logo-mark" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
            <Navigation2 className="curri-logo-icon" size={17} />
          </div>
          {!collapsed && (
            <div className="curri-brand-text">
              <span className="curri-title">ROUTECRAFT</span>
              <span className="curri-subtitle">LOGISTICS</span>
            </div>
          )}
          <button 
            type="button" 
            className="curri-collapse-toggle" 
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar (or swipe right)" : "Collapse sidebar (or swipe left)"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="curri-nav" aria-label="Main Navigation">
          {navigation.map((group) => (
            <div className="curri-nav-group" key={group.label}>
              {!collapsed && <div className="curri-nav-header">{group.label}</div>}
              {group.items.map(({ path: target, label, icon: Icon }) => (
                <button
                  key={target}
                  className={`curri-nav-link ${path === target ? "curri-nav-active" : ""}`}
                  onClick={() => goTo(target)}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} strokeWidth={path === target ? 2.3 : 1.8} />
                  {!collapsed && <span>{label}</span>}
                </button>
              ))}
            </div>
          ))}

          <div className="curri-nav-group">
            {!collapsed && <div className="curri-nav-header">Settings</div>}
            <button
              className={`curri-nav-link ${page === "settings" || page === "login" ? "curri-nav-active" : ""}`}
              onClick={() => goTo("/settings")}
              title={collapsed ? "API & Settings" : undefined}
            >
              <Settings2 size={18} />
              {!collapsed && <span>Settings</span>}
            </button>
          </div>
        </nav>

        {/* Simple Footer */}
        <div className="curri-sidebar-footer">
          <div className="curri-user-bar" onClick={() => goTo("/settings")}>
            <div className="curri-user-avatar">RC</div>
            {!collapsed && (
              <div className="curri-user-info">
                <b>Dispatcher</b>
                <small>{planner.demoMode === false ? "Dedicated Fleet" : "Live Simulation"}</small>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="curri-main">
        {/* Top Header */}
        <header className="curri-topbar">
          <div className="topbar-left-wrap">
            <button 
              type="button" 
              className="curri-mobile-toggle"
              onClick={() => setCollapsed(!collapsed)}
              title="Toggle sidebar"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div className="curri-breadcrumbs">
              <span className="crumb-brand">DISPATCH</span>
              <span className="crumb-slash">/</span>
              <span className="crumb-title">{title}</span>
            </div>
          </div>

          <div className="topbar-right-wrap">
            <div className="curri-date-pill">
              <Clock3 size={14} />
              <span>{dateLabel}</span>
            </div>

            <button className="curri-header-avatar" onClick={() => goTo("/settings")} title="Settings">
              RC
            </button>
          </div>
        </header>

        {/* View Canvas */}
        <div className="curri-content">
          <Suspense fallback={
            <div className="curri-loading-state">
              <div className="curri-spin-loader" />
              <span>Loading View…</span>
            </div>
          }>
            {page === "planner" && <PlannerView />}
            {page === "shortest-paths" && <ShortestPathLabView />}
            {page === "algorithms" && <AlgorithmsView onNavigate={goTo} />}
            {page === "benchmarks" && <BenchmarksView />}
            {page === "runs" && <RunsView />}
            {(page === "settings" || page === "login") && <AccessView />}
          </Suspense>
        </div>

        {/* Clean Footer without Privacy Policy or Terms */}
        <footer className="curri-footer">
          <div className="curri-footer-left">
            <span className="footer-bold">ROUTECRAFT</span>
            <span className="footer-dot">•</span>
            <span>Intelligent Vehicle Route Optimization</span>
          </div>
          <div className="curri-footer-right">
            <span>Real-time DAA Solver</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
