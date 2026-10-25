import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  LockKeyhole,
  LogOut,
  MapPin,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserCheck,
  UserRound,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { api, authApi, tokenStorage } from "../api/client.js";
import { usePlannerStore } from "../store/usePlannerStore.js";

const DEMO_CREDENTIALS = {
  email: "dispatcher@routecraft.local",
  password: "RouteDemo!2026",
  name: "Sample dispatcher",
};

export default function AccessView() {
  const planner = usePlannerStore((state) => state.planner);
  const setAlgorithm = usePlannerStore((state) => state.setAlgorithm);

  // Active tab: default to "preferences" for dispatchers
  const [activeTab, setActiveTab] = useState("preferences");

  // Auth state
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoSigningIn, setDemoSigningIn] = useState(false);
  const [form, setForm] = useState(DEMO_CREDENTIALS);
  const [signedIn, setSignedIn] = useState(Boolean(tokenStorage.get()));
  const [currentUser, setCurrentUser] = useState(null);
  const canSignup = planner.allowSignup !== false;

  // Clipboard copy state for visual feedback
  const [copiedKey, setCopiedKey] = useState(null);

  // Preferences state
  const [preferences, setPreferences] = useState(() => ({
    units: localStorage.getItem("rc_pref_units") || "metric",
    defaultAlgo: localStorage.getItem("rc_pref_algo") || "savings",
    turnaround: localStorage.getItem("rc_pref_turnaround") || "15",
    solverTimeout: localStorage.getItem("rc_pref_timeout") || "10",
    mapStyle: localStorage.getItem("rc_pref_map_style") || "schematic",
    soundAlerts: localStorage.getItem("rc_pref_sound") !== "false",
    autoRefresh: localStorage.getItem("rc_pref_refresh") || "30s",
  }));

  // Custom Domain state
  const [customDomain, setCustomDomain] = useState(
    () => localStorage.getItem("tms_custom_domain") || "dispatch.courierops.net"
  );
  const [domainInput, setDomainInput] = useState(customDomain);

  // Live API Health Query
  const healthQuery = useQuery({
    queryKey: ["health-detailed"],
    queryFn: async () => {
      const start = performance.now();
      const data = await api.health();
      const latency = Math.round(performance.now() - start);
      return { ...data, latency };
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (tokenStorage.get() && !currentUser) {
      authApi.me().then(setCurrentUser).catch(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    if (planner.demoMode === false && !tokenStorage.get()) {
      authApi
        .restore()
        .then((user) => {
          setSignedIn(true);
          setCurrentUser(user);
        })
        .catch(() => {});
    }
  }, [planner.demoMode]);

  const copyToClipboard = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(`Copied: ${value}`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Clipboard permission unavailable.");
    }
  };

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      let user;
      if (mode === "signup") {
        user = await authApi.signup(form);
        toast.success("Workspace account created.");
      } else {
        user = await authApi.login(form);
        toast.success("Signed in successfully.");
      }
      setSignedIn(true);
      setCurrentUser(user);
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          "Could not connect to the API. Local simulation mode remains active."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickDemoLogin() {
    setDemoSigningIn(true);
    try {
      const user = await authApi.login({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
      });
      setSignedIn(true);
      setCurrentUser(user);
      toast.success("Signed in as demo dispatcher.");
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Local API unavailable. Demo active in memory."
      );
    } finally {
      setDemoSigningIn(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      tokenStorage.clear();
    }
    setSignedIn(false);
    setCurrentUser(null);
    toast.success("Dispatcher session ended.");
  }

  function handleSavePreferences(e) {
    e.preventDefault();
    localStorage.setItem("rc_pref_units", preferences.units);
    localStorage.setItem("rc_pref_algo", preferences.defaultAlgo);
    localStorage.setItem("rc_pref_turnaround", preferences.turnaround);
    localStorage.setItem("rc_pref_timeout", preferences.solverTimeout);
    localStorage.setItem("rc_pref_map_style", preferences.mapStyle);
    localStorage.setItem("rc_pref_sound", String(preferences.soundAlerts));
    localStorage.setItem("rc_pref_refresh", preferences.autoRefresh);

    if (setAlgorithm) {
      setAlgorithm(preferences.defaultAlgo);
    }

    toast.success("Preferences saved.");
  }

  function handleSaveDomain(e) {
    e.preventDefault();
    const clean = domainInput.trim().toLowerCase();
    if (!clean || !clean.includes(".")) {
      toast.error("Please enter a valid domain (e.g. dispatch.courierops.net)");
      return;
    }
    localStorage.setItem("tms_custom_domain", clean);
    setCustomDomain(clean);
    toast.success(`Custom domain linked: ${clean}`);
  }

  return (
    <div className="settings-container">
      {/* Page Title & Gateway Status */}
      <header className="settings-header">
        <div className="settings-title-group">
          <h1>Settings</h1>
          <p>Manage fleet heuristics, dispatcher credentials, connectors, and ingress routing.</p>
        </div>

        <div className="gateway-status-pill">
          <span className="gateway-dot" />
          <span className="gateway-text">
            {healthQuery.data?.status === "ready"
              ? `API Ready (${healthQuery.data.latency ?? 12}ms)`
              : "Simulation Active"}
          </span>
          <button
            type="button"
            className="gateway-refresh-btn"
            onClick={() => healthQuery.refetch()}
            title="Refresh API Health"
          >
            <RefreshCw size={13} className={healthQuery.isFetching ? "spin" : ""} />
          </button>
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <nav className="settings-subnav" aria-label="Settings Categories">
        <button
          type="button"
          className={`subnav-item ${activeTab === "preferences" ? "is-active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <Settings2 size={15} />
          <span>Fleet & Optimization</span>
        </button>
        <button
          type="button"
          className={`subnav-item ${activeTab === "auth" ? "is-active" : ""}`}
          onClick={() => setActiveTab("auth")}
        >
          <UserRound size={15} />
          <span>Dispatcher & Access</span>
          {signedIn && <span className="active-dot" />}
        </button>
        <button
          type="button"
          className={`subnav-item ${activeTab === "connectors" ? "is-active" : ""}`}
          onClick={() => setActiveTab("connectors")}
        >
          <Layers size={15} />
          <span>API & Connectors</span>
        </button>
        <button
          type="button"
          className={`subnav-item ${activeTab === "domain" ? "is-active" : ""}`}
          onClick={() => setActiveTab("domain")}
        >
          <Globe size={15} />
          <span>Custom Domain & SSL</span>
        </button>
        <button
          type="button"
          className={`subnav-item ${activeTab === "security" ? "is-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <ShieldCheck size={15} />
          <span>Security & OpenAPI</span>
        </button>
      </nav>

      {/* TAB CONTENT PANEL */}
      <div className="settings-panel">
        {/* TAB 1: FLEET & OPTIMIZATION PREFERENCES */}
        {activeTab === "preferences" && (
          <form className="settings-form-flow" onSubmit={handleSavePreferences}>
            <div className="panel-section-header">
              <div>
                <h2>Fleet & Optimization Heuristics</h2>
                <p>Configure solver parameters, payload units, and operational dispatch buffers.</p>
              </div>
              <span className="section-badge">Routing Engine</span>
            </div>

            <div className="settings-rows-group">
              {/* Measurement Units */}
              <div className="settings-row">
                <div className="row-label-col">
                  <span className="row-title">Measurement units</span>
                  <span className="row-desc">
                    Units used across vehicle manifests, distance calculations, and fuel consumption models.
                  </span>
                </div>
                <div className="row-control-col">
                  <div className="unit-toggle-group">
                    <button
                      type="button"
                      className={`unit-toggle-btn ${preferences.units === "metric" ? "is-active" : ""}`}
                      onClick={() => setPreferences({ ...preferences, units: "metric" })}
                    >
                      Metric (km, kg)
                    </button>
                    <button
                      type="button"
                      className={`unit-toggle-btn ${preferences.units === "imperial" ? "is-active" : ""}`}
                      onClick={() => setPreferences({ ...preferences, units: "imperial" })}
                    >
                      Imperial (mi, lbs)
                    </button>
                  </div>
                  <span className="control-preview-tag">
                    Preview: {preferences.units === "metric" ? "42.8 km · 58 km/h" : "26.6 mi · 36 mph"}
                  </span>
                </div>
              </div>

              {/* Default Routing Algorithm */}
              <div className="settings-row">
                <div className="row-label-col">
                  <span className="row-title">Default route optimization algorithm</span>
                  <span className="row-desc">
                    Initial heuristic selected when launching automated vehicle dispatch on the route planner.
                  </span>
                </div>
                <div className="row-control-col">
                  <select
                    className="settings-select"
                    value={preferences.defaultAlgo}
                    onChange={(e) => setPreferences({ ...preferences, defaultAlgo: e.target.value })}
                  >
                    <option value="savings">Clarke-Wright Savings (Recommended for CVRP)</option>
                    <option value="simulated-annealing">Simulated Annealing (Global metaheuristic)</option>
                    <option value="nearest-neighbor">Nearest Neighbor (Greedy baseline)</option>
                    <option value="genetic">Genetic Algorithm (Evolutionary population search)</option>
                    <option value="2-opt">2-Opt Local Search (Iterative improvement)</option>
                  </select>
                </div>
              </div>

              {/* Depot Staging Slack */}
              <div className="settings-row">
                <div className="row-label-col">
                  <span className="row-title">Depot staging & turnaround slack</span>
                  <span className="row-desc">
                    Loading and safety buffer allocated at the depot node before vehicle dispatch runs.
                  </span>
                </div>
                <div className="row-control-col">
                  <select
                    className="settings-select"
                    value={preferences.turnaround}
                    onChange={(e) => setPreferences({ ...preferences, turnaround: e.target.value })}
                  >
                    <option value="10">10 minutes (Rapid turnaround)</option>
                    <option value="15">15 minutes (Standard logistics buffer)</option>
                    <option value="30">30 minutes (Heavy freight staging)</option>
                    <option value="45">45 minutes (Hazmat & detailed manifest inspection)</option>
                  </select>
                </div>
              </div>

              {/* Solver Timeout */}
              <div className="settings-row">
                <div className="row-label-col">
                  <span className="row-title">Maximum solver execution timeout</span>
                  <span className="row-desc">
                    Time ceiling allowed for iterative metaheuristic improvements before returning current best route.
                  </span>
                </div>
                <div className="row-control-col">
                  <select
                    className="settings-select"
                    value={preferences.solverTimeout}
                    onChange={(e) => setPreferences({ ...preferences, solverTimeout: e.target.value })}
                  >
                    <option value="5">5 seconds (Interactive low latency)</option>
                    <option value="10">10 seconds (Balanced convergence)</option>
                    <option value="20">20 seconds (Deep combinatorial search)</option>
                  </select>
                </div>
              </div>

              {/* Map Rendering Style */}
              <div className="settings-row">
                <div className="row-label-col">
                  <span className="row-title">Dispatch map rendering style</span>
                  <span className="row-desc">
                    Visual topology scheme for delivery stop markers, depot hubs, and route polylines.
                  </span>
                </div>
                <div className="row-control-col">
                  <select
                    className="settings-select"
                    value={preferences.mapStyle}
                    onChange={(e) => setPreferences({ ...preferences, mapStyle: e.target.value })}
                  >
                    <option value="schematic">RouteCraft Parchment Schematic (Default)</option>
                    <option value="dark">Dark Slate Vector Navigation</option>
                    <option value="contrast">High-Contrast Operations Mode</option>
                  </select>
                </div>
              </div>

              {/* Event Chimes */}
              <div className="settings-row">
                <div className="row-label-col">
                  <span className="row-title">Acoustic dispatch notifications</span>
                  <span className="row-desc">
                    Play a sound chime when route optimization calculation completes or constraints are violated.
                  </span>
                </div>
                <div className="row-control-col">
                  <label className="flat-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.soundAlerts}
                      onChange={(e) => setPreferences({ ...preferences, soundAlerts: e.target.checked })}
                    />
                    <span className="flat-toggle-track" />
                  </label>
                </div>
              </div>
            </div>

            <div className="panel-actions-bar">
              <button type="submit" className="button button-primary">
                <Check size={14} />
                <span>Save Dispatch Preferences</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: DISPATCHER & ACCESS */}
        {activeTab === "auth" && (
          <div className="settings-form-flow">
            <div className="panel-section-header">
              <div>
                <h2>Dispatcher Authentication & Session</h2>
                <p>Identity controls, session token lifecycle, and role permissions.</p>
              </div>
              <span className={`status-pill ${signedIn ? "is-online" : "is-demo"}`}>
                <span className="status-dot" />
                {signedIn ? "Authenticated" : "Simulation Mode"}
              </span>
            </div>

            {signedIn ? (
              <div className="auth-profile-flow">
                <div className="profile-identity-strip">
                  <div className="profile-avatar">
                    {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "RC"}
                  </div>
                  <div className="profile-meta">
                    <div className="profile-title-line">
                      <h3>{currentUser?.name || "Sample dispatcher"}</h3>
                      <span className="role-chip">Fleet Dispatcher</span>
                    </div>
                    <p className="profile-email">{currentUser?.email || "dispatcher@routecraft.local"}</p>
                    <span className="profile-crypto-note">
                      JWT access token held in memory • Rotating refresh token protected by httpOnly cookie
                    </span>
                  </div>
                </div>

                <div className="metrics-specs-grid">
                  <div className="spec-card">
                    <span className="spec-label">Authorization Scope</span>
                    <strong className="spec-value">Admin & Fleet Write</strong>
                  </div>
                  <div className="spec-card">
                    <span className="spec-label">Session Token Lifespan</span>
                    <strong className="spec-value">15 Minutes (Rolling)</strong>
                  </div>
                  <div className="spec-card">
                    <span className="spec-label">Active Workstation</span>
                    <strong className="spec-value">{customDomain || "Local Dispatch Node"}</strong>
                  </div>
                  <div className="spec-card">
                    <span className="spec-label">Fleet Storage</span>
                    <strong className="spec-value">
                      {planner.demoMode === false ? "Dedicated PostgreSQL" : "Memory Simulation"}
                    </strong>
                  </div>
                </div>

                <div className="panel-actions-bar">
                  <button type="button" className="button button-quiet" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={async () => {
                      try {
                        await authApi.restore();
                        toast.success("Access token refreshed.");
                      } catch {
                        toast.error("Session refresh failed.");
                      }
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh Session Token</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-unauth-flow">
                {/* Clean Demo Account Callout */}
                {planner.demoMode !== false && (
                  <div className="demo-panel-callout">
                    <div className="demo-callout-header">
                      <div>
                        <b>Local Dispatcher Sandbox</b>
                        <p>Pre-configured credentials for testing route planning algorithms locally.</p>
                      </div>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={handleQuickDemoLogin}
                        disabled={demoSigningIn}
                      >
                        <Zap size={14} />
                        <span>{demoSigningIn ? "Signing In…" : "One-Click Sign In"}</span>
                      </button>
                    </div>

                    <div className="credentials-row">
                      <div className="credential-chip">
                        <span className="chip-key">Email:</span>
                        <code className="chip-val">{DEMO_CREDENTIALS.email}</code>
                        <button
                          type="button"
                          className="chip-copy-icon"
                          onClick={() => copyToClipboard(DEMO_CREDENTIALS.email, "email")}
                          title="Copy email"
                        >
                          {copiedKey === "email" ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>

                      <div className="credential-chip">
                        <span className="chip-key">Password:</span>
                        <code className="chip-val">{DEMO_CREDENTIALS.password}</code>
                        <button
                          type="button"
                          className="chip-copy-icon"
                          onClick={() => copyToClipboard(DEMO_CREDENTIALS.password, "password")}
                          title="Copy password"
                        >
                          {copiedKey === "password" ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="auth-mode-tabs">
                  <button
                    type="button"
                    className={`auth-tab-btn ${mode === "login" ? "is-active" : ""}`}
                    onClick={() => setMode("login")}
                  >
                    Sign In
                  </button>
                  {canSignup && (
                    <button
                      type="button"
                      className={`auth-tab-btn ${mode === "signup" ? "is-active" : ""}`}
                      onClick={() => setMode("signup")}
                    >
                      Create Account
                    </button>
                  )}
                </div>

                <form className="auth-field-stack" onSubmit={handleAuthSubmit}>
                  {mode === "signup" && (
                    <label className="field-group">
                      <span className="field-title">Dispatcher name</span>
                      <input
                        type="text"
                        className="clean-input"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        minLength={2}
                        placeholder="e.g. Maya Chen"
                      />
                    </label>
                  )}

                  <label className="field-group">
                    <span className="field-title">Email address</span>
                    <input
                      type="email"
                      className="clean-input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      placeholder="dispatcher@routecraft.local"
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-title">Password</span>
                    <div className="input-affix-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="clean-input affix-input"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        minLength={mode === "signup" ? 10 : 1}
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        className="affix-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </label>

                  <div className="auth-submit-line">
                    <button type="submit" className="button button-primary" disabled={busy}>
                      {busy ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Authenticating…</span>
                        </>
                      ) : (
                        <>
                          <span>{mode === "signup" ? "Create Workspace" : "Sign In to Dispatch"}</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: API & CONNECTORS */}
        {activeTab === "connectors" && (
          <div className="settings-form-flow">
            <div className="panel-section-header">
              <div>
                <h2>Cloud Connectors & Spatial API Slots</h2>
                <p>
                  RouteCraft operates standalone with built-in heuristics. Server environment variables
                  connect external street network routers and database engines.
                </p>
              </div>
              <span className="section-badge">Integration Slots</span>
            </div>

            <div className="connectors-table">
              <ConnectorRow
                name="Map Tiles Provider"
                description="Vector and raster tile sets for street geography"
                env="MAPTILER_API_KEY"
                status="Built-in Schematic Active"
                isBuiltin
                onCopy={() => copyToClipboard("MAPTILER_API_KEY", "maptiler")}
                isCopied={copiedKey === "maptiler"}
              />

              <ConnectorRow
                name="Road Routing Engine"
                description="Turn-by-turn road networks and traffic penalties"
                env="OSRM_API_KEY"
                status="Haversine Matrix (Internal)"
                isBuiltin
                onCopy={() => copyToClipboard("OSRM_API_KEY", "osrm")}
                isCopied={copiedKey === "osrm"}
              />

              <ConnectorRow
                name="Forward Geocoding"
                description="Address string to coordinate lookup service"
                env="GEOCODING_API_KEY"
                status="Direct Coordinates & CSV"
                isBuiltin
                onCopy={() => copyToClipboard("GEOCODING_API_KEY", "geocoding")}
                isCopied={copiedKey === "geocoding"}
              />

              <ConnectorRow
                name="PostgreSQL Database"
                description="Persistent run telemetry and historical route archive"
                env="DATABASE_URL"
                status={planner.demoMode === false ? "Configured Database" : "In-Memory Run Storage"}
                isBuiltin={planner.demoMode !== false}
                onCopy={() => copyToClipboard("DATABASE_URL", "db")}
                isCopied={copiedKey === "db"}
              />

              <ConnectorRow
                name="Redis Cache"
                description="Revocation list and rate limiting cache"
                env="REDIS_URL"
                status="In-Memory Cache Fallback"
                isBuiltin
                onCopy={() => copyToClipboard("REDIS_URL", "redis")}
                isCopied={copiedKey === "redis"}
              />
            </div>

            <div className="callout-note">
              <ShieldCheck size={16} />
              <p>
                Keep private keys in server <code>.env</code> files. Do not expose credentials with a{" "}
                <code>VITE_*</code> prefix in client browser bundles.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOM DOMAIN & SSL */}
        {activeTab === "domain" && (
          <div className="settings-form-flow">
            <div className="panel-section-header">
              <div>
                <h2>Custom Domain & SSL Provisioning</h2>
                <p>Link your organization's domain name to dispatch operations with automated TLS 1.3 certificates.</p>
              </div>
              <span className="status-pill is-online">
                <span className="status-dot" />
                Active SSL
              </span>
            </div>

            <form className="domain-entry-bar" onSubmit={handleSaveDomain}>
              <div className="domain-input-box">
                <span className="domain-scheme">https://</span>
                <input
                  type="text"
                  placeholder="dispatch.courierops.net"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="domain-raw-input"
                />
              </div>
              <button type="submit" className="button button-primary">
                <Check size={14} />
                <span>Link Domain</span>
              </button>
            </form>

            <div className="dns-records-wrapper">
              <div className="dns-table-head">
                <span className="dns-head-title">Configured DNS Records</span>
                <span className="dns-handshake-tag">
                  <CheckCircle2 size={13} />
                  TLS Handshake Valid
                </span>
              </div>

              <div className="dns-grid">
                <div className="dns-grid-row dns-grid-header">
                  <span>Type</span>
                  <span>Host / Name</span>
                  <span>Target / Value</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>

                <div className="dns-grid-row">
                  <span>
                    <code className="record-badge cname">CNAME</code>
                  </span>
                  <span>
                    <code className="record-val">{domainInput || "dispatch"}</code>
                  </span>
                  <span>
                    <code className="record-val">ingress.routecraft-cluster.internal</code>
                  </span>
                  <span className="status-active-tag">Active</span>
                  <span>
                    <button
                      type="button"
                      className="table-copy-btn"
                      onClick={() => copyToClipboard("ingress.routecraft-cluster.internal", "cname")}
                      title="Copy Target"
                    >
                      {copiedKey === "cname" ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                </div>

                <div className="dns-grid-row">
                  <span>
                    <code className="record-badge txt">TXT</code>
                  </span>
                  <span>
                    <code className="record-val">_routecraft-challenge</code>
                  </span>
                  <span>
                    <code className="record-val">rc-verify-prod-2026-cert-letsencrypt</code>
                  </span>
                  <span className="status-active-tag">Verified</span>
                  <span>
                    <button
                      type="button"
                      className="table-copy-btn"
                      onClick={() => copyToClipboard("rc-verify-prod-2026-cert-letsencrypt", "txt")}
                      title="Copy Value"
                    >
                      {copiedKey === "txt" ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                </div>

                <div className="dns-grid-row">
                  <span>
                    <code className="record-badge a">A</code>
                  </span>
                  <span>
                    <code className="record-val">@</code>
                  </span>
                  <span>
                    <code className="record-val">198.51.100.24 (Ingress IP)</code>
                  </span>
                  <span className="status-active-tag">Configured</span>
                  <span>
                    <button
                      type="button"
                      className="table-copy-btn"
                      onClick={() => copyToClipboard("198.51.100.24", "a-record")}
                      title="Copy IP"
                    >
                      {copiedKey === "a-record" ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY & OPENAPI REFERENCE */}
        {activeTab === "security" && (
          <div className="settings-form-flow">
            <div className="panel-section-header">
              <div>
                <h2>Security Architecture & OpenAPI Reference</h2>
                <p>Authentication guardrails, RBAC policies, and live API schemas.</p>
              </div>
              <a
                className="button button-secondary"
                href="/api/docs"
                target="_blank"
                rel="noreferrer"
              >
                <span>Swagger UI</span>
                <ExternalLink size={13} />
              </a>
            </div>

            <div className="security-specs-list">
              <SecuritySpecItem
                title="Short-lived access tokens"
                detail="Bearer JWT tokens expire in 15 minutes by default; refresh cookies are httpOnly and rotated on every exchange."
                tag="Enforced"
              />
              <SecuritySpecItem
                title="Role-based access enforcement"
                detail="Dispatcher and administrator permissions protect calculate and optimize endpoints; drivers operate in read-only manifest mode."
                tag="RBAC Active"
              />
              <SecuritySpecItem
                title="Rate-limiting & burst protection"
                detail="Token-bucket rate limiter throttles authentication to 5 attempts per minute and solver calculations to 120 per minute."
                tag="Protected"
              />
              <SecuritySpecItem
                title="Production deployment hardening"
                detail="Before production launch, set DEMO_MODE=false, COOKIE_SECURE=true, a cryptographically random JWT_SECRET, and exact WEB_ORIGIN."
                tag="Hardened"
              />
            </div>

            <div className="openapi-card">
              <div className="openapi-meta">
                <b>Interactive Developer Documentation</b>
                <p>
                  Explore real-time schema contracts for <code>/api/planner</code>, <code>/api/optimizations</code>,
                  and <code>/api/scenario/compare-shortest</code>.
                </p>
              </div>
              <div className="openapi-buttons">
                <a
                  className="button button-primary"
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Open API Documentation</span>
                  <ExternalLink size={14} />
                </a>
                <a
                  className="button button-secondary"
                  href="/api/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  download="routecraft-openapi.json"
                >
                  <span>Download OpenAPI JSON</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorRow({ name, description, env, status, isBuiltin, onCopy, isCopied }) {
  return (
    <div className="connector-table-row">
      <div className="connector-meta-col">
        <span className="connector-name">{name}</span>
        <span className="connector-desc">{description}</span>
      </div>
      <div className="connector-env-col">
        <code>{env}</code>
        <button type="button" className="inline-copy-btn" onClick={onCopy} title={`Copy ${env}`}>
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <div className="connector-status-col">
        <span className={`status-badge-clean ${isBuiltin ? "is-builtin" : "is-external"}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

function SecuritySpecItem({ title, detail, tag }) {
  return (
    <div className="security-spec-item">
      <div className="spec-item-content">
        <b>{title}</b>
        <p>{detail}</p>
      </div>
      <span className="spec-tag">{tag}</span>
    </div>
  );
}
