import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Lock } from "lucide-react";

export default function PrivacyPolicyView() {
  return (
    <div className="page-stack legal-page">
      <div className="legal-header">
        <Link to="/" className="button button-quiet button-small back-link">
          <ArrowLeft size={14} /> Back to Route Planner
        </Link>
        <div className="legal-title-wrap">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> COMPLIANCE & GOVERNANCE
          </div>
          <h1>Privacy Policy</h1>
          <p>Effective Date: October 11, 2026 | Transportation Management System (TMS) Data Protection Standard</p>
        </div>
      </div>

      <div className="surface-card legal-card">
        <section className="legal-section">
          <h2>1. Data Collection & Operational Scope</h2>
          <p>
            The TMS Dispatch Platform collects and processes operational telemetry required exclusively for fleet route planning, shipment dispatching, and logistics scheduling. This includes:
          </p>
          <ul>
            <li>Waypoint and delivery stop geographical coordinates (latitude and longitude).</li>
            <li>Shipment manifests: package weight in kilograms, volume metrics, and assigned delivery time windows.</li>
            <li>Vehicle specifications: gross vehicle weight rating, cargo capacity, and transit speed parameters.</li>
            <li>Operational run metrics: algorithm solve times, route sequence identifiers, and operator log records.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. Data Processing & Solver Privacy</h2>
          <p>
            All combinatorial optimization computations (including Vehicle Routing Problem heuristic passes, dynamic programming, and 2-opt trajectory improvements) are executed either within authorized secure worker runtimes or client memory. We do not sell, rent, or monetize proprietary route topologies or customer shipment volumes.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Network Storage & Data Retention</h2>
          <p>
            Telemetry and generated manifests are retained only for the duration defined by your organization's data retention schedule or compliance mandate. Database instances running in enterprise VPC environments isolate operational data with strict tenant separation and TLS 1.3 encryption in transit.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Security Controls</h2>
          <p>
            We implement administrative, technical, and physical safeguards designed to protect transportation telemetry against unauthorized access, destruction, or disclosure. Access to dispatch APIs requires valid bearer tokens and role-based permissions.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Inquiries & Data Protection Contact</h2>
          <p>
            For compliance questions or data deletion requests, contact the designated data protection officer at <span className="mono-text">dpo@tms-logistics.internal</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
