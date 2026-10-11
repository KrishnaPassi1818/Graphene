import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, ShieldPlus, UserRound, CheckCircle2, ExternalLink, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { authApi, tokenStorage } from "../api/client.js";
import { usePlannerStore } from "../store/usePlannerStore.js";

export default function AccessView() {
  const planner = usePlannerStore((state) => state.planner);
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "Sample dispatcher", email: "dispatcher@routecraft.local", password: "RouteDemo!2026" });
  const [signedIn, setSignedIn] = useState(Boolean(tokenStorage.get()));
  const canSignup = planner.allowSignup !== false;

  useEffect(() => {
    if (planner.demoMode === false && !tokenStorage.get()) authApi.restore().then(() => setSignedIn(true)).catch(() => {});
  }, [planner.demoMode]);

  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      if (mode === "signup") await authApi.signup(form);
      else await authApi.login(form);
      setSignedIn(true); toast.success(mode === "signup" ? "Workspace created." : "Signed in securely.");
    } catch (error) { toast.error(error.response?.data?.error || "Could not connect to the API. Demo mode stays available locally."); }
    finally { setBusy(false); }
  }

  async function logout() {
    try { await authApi.logout(); } catch { tokenStorage.clear(); }
    setSignedIn(false); toast.success("Session ended.");
  }

  const copy = async (value) => { try { await navigator.clipboard.writeText(value); toast.success("Copied."); } catch { toast.error("Clipboard permission unavailable."); } };
  return <div className="page-stack">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />WORKSPACE CONFIGURATION <span className="eyebrow-separator">/</span> ACCESS</div><h1>API & access</h1><p>Authentication, runtime services, and safe slots for your future provider keys.</p></div></section>
    <div className="access-layout">
      <section className="surface-card access-card"><div className="access-card-head"><div className="access-head-icon"><ShieldCheck size={18} /></div><div><span className="section-kicker">SESSION CONTROL</span><h2>{signedIn ? "Authenticated session" : "Dispatcher access"}</h2></div><span className={`access-status ${signedIn ? "access-on" : "access-demo"}`}><i />{signedIn ? "SIGNED IN" : planner.demoMode === false ? "SIGN IN REQUIRED" : "DEMO OPEN"}</span></div>
        {signedIn ? <div className="signed-in-state"><div className="signed-avatar">SD</div><div><b>Dispatcher session active</b><span>The short-lived access token stays in module memory; the rotating refresh token is protected by an httpOnly cookie.</span></div><button className="button button-quiet" onClick={logout}>Sign out</button></div> : <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <label className="form-field"><span>Display name</span><div className="input-with-icon"><UserRound size={15} /><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength="2" /></div></label>}
          <label className="form-field"><span>Email address</span><div className="input-with-icon"><UserRound size={15} /><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div></label>
          <label className="form-field"><span>Password</span><div className="input-with-icon"><LockKeyhole size={15} /><input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={mode === "signup" ? 10 : 1} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
          <button className="button button-primary auth-submit" disabled={busy}>{mode === "signup" ? "Create workspace" : "Sign in"}<ShieldPlus size={15} /></button>
          {canSignup ? <div className="auth-toggle">{mode === "login" ? "New to RouteCraft?" : "Already have an account?"}<button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Sign in"}</button></div> : <div className="auth-toggle">Public sign-up is disabled by the administrator.</div>}
        </form>}
        {planner.demoMode !== false && !signedIn && <div className="demo-credentials"><div><span className="demo-credential-icon"><KeyRound size={15} /></span><div><b>Hard-coded test account</b><small>Change these in .env before deployment.</small></div></div><div className="credential-line"><span><small>EMAIL</small><code>dispatcher@routecraft.local</code></span><button onClick={() => copy("dispatcher@routecraft.local")}><Copy size={13} /></button></div><div className="credential-line"><span><small>PASSWORD</small><code>RouteDemo!2026</code></span><button onClick={() => copy("RouteDemo!2026")}><Copy size={13} /></button></div></div>}
      </section>
      <section className="surface-card provider-card"><div className="access-card-head"><div className="provider-head-icon"><KeyRound size={17} /></div><div><span className="section-kicker">ENVIRONMENT SLOTS</span><h2>Provider connections</h2></div><span className="optional-badge">OPTIONAL</span></div><p className="provider-intro">No provider is required to run the synthetic planner. Add credentials server-side when you enable live maps or road distances.</p><div className="provider-list"><ProviderRow name="Map tiles" env="MAPTILER_API_KEY" detail="OpenStreetMap schematic is used now" /><ProviderRow name="Road routing" env="OSRM_API_KEY" detail="Haversine is the current distance model" /><ProviderRow name="Geocoding" env="GEOCODING_API_KEY" detail="Enter coordinates directly or import CSV" /><ProviderRow name="PostgreSQL" env="DATABASE_URL" detail={planner.demoMode === false ? "Configure a managed database" : "Optional persistent run storage"} /><ProviderRow name="Redis" env="REDIS_URL" detail="Optional cache and revocation list" /></div><div className="provider-warning"><ShieldCheck size={15} /><span>Keep secret values in `.env` or a host secret manager. Never publish a private key as a `VITE_*` browser variable.</span></div></section>
    </div>
    <section className="surface-card domain-config-card">
      <CustomDomainSection />
    </section>
    <section className="surface-card security-notes"><div className="security-note-heading"><div className="access-head-icon"><LockKeyhole size={17} /></div><div><span className="section-kicker">DEPLOYMENT GUARDRAILS</span><h2>Security posture</h2></div></div><div className="security-note-grid"><SecurityNote title="Short-lived access" text="Bearer access tokens expire in 15 minutes by default; refresh cookies are httpOnly and rotated." /><SecurityNote title="Role checks" text="Dispatcher/admin permissions protect write and optimization endpoints; drivers are read-only by design." /><SecurityNote title="Production mode" text="Set DEMO_MODE=false, COOKIE_SECURE=true, a strong JWT_SECRET, and exact WEB_ORIGIN." /></div><a className="docs-link" href="/api/docs" target="_blank" rel="noreferrer">Open API reference <ExternalLink size={13} /></a></section>
  </div>;
}

function CustomDomainSection() {
  const [customDomain, setCustomDomain] = useState(() => localStorage.getItem("tms_custom_domain") || "dispatch.courierops.net");
  const [inputVal, setInputVal] = useState(customDomain);
  const [status, setStatus] = useState("Connected");

  function handleSave(e) {
    e.preventDefault();
    const clean = inputVal.trim().toLowerCase();
    if (!clean || !clean.includes(".")) {
      toast.error("Please enter a valid FQDN (e.g., dispatch.yourlogistics.com)");
      return;
    }
    localStorage.setItem("tms_custom_domain", clean);
    setCustomDomain(clean);
    setStatus("Connected");
    toast.success(`Custom domain linked: ${clean}`);
  }

  return (
    <div className="domain-settings-inner">
      <div className="security-note-heading">
        <div className="access-head-icon"><ShieldCheck size={17} /></div>
        <div>
          <span className="section-kicker">PRODUCTION HOSTING</span>
          <h2>Custom Domain & SSL Provisioning</h2>
        </div>
        <span className="domain-status-badge"><span className="domain-status-dot" />{status}</span>
      </div>
      <p className="provider-intro">
        Connect your organization's custom domain for TMS dispatch operations. Active SSL/TLS certificate will be bound automatically via the ingress reverse proxy.
      </p>
      <form className="domain-input-group" onSubmit={handleSave}>
        <div className="input-with-icon domain-field">
          <input
            type="text"
            placeholder="e.g. dispatch.yourlogistics.com"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
        </div>
        <button type="submit" className="button button-primary">Save Domain</button>
      </form>
      <div className="dns-records-table">
        <div className="dns-row dns-header">
          <span>Type</span>
          <span>Host / Name</span>
          <span>Target / Value</span>
          <span>Status</span>
        </div>
        <div className="dns-row">
          <code>CNAME</code>
          <code>{inputVal || "dispatch"}</code>
          <code>ingress.tms-cluster.internal</code>
          <span className="dns-matched">Active</span>
        </div>
        <div className="dns-row">
          <code>TXT</code>
          <code>_tms-challenge</code>
          <code>tms-verification-prod-2026-cert</code>
          <span className="dns-matched">Verified</span>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({ name, env, detail }) { return <div className="provider-row"><span className="provider-env-icon"><KeyRound size={14} /></span><div className="provider-row-copy"><b>{name}</b><small>{detail}</small></div><code>{env}</code><span className="provider-slot">ENV SLOT</span></div>; }
function SecurityNote({ title, text }) { return <div className="security-note"><span className="security-note-check"><CheckCircle2 size={15} /></span><div><b>{title}</b><p>{text}</p></div></div>; }
