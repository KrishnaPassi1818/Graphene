import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsConditionsView() {
  return (
    <div className="page-stack legal-page">
      <div className="legal-header">
        <Link to="/" className="button button-quiet button-small back-link">
          <ArrowLeft size={14} /> Back to Route Planner
        </Link>
        <div className="legal-title-wrap">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> SERVICE LEVEL AGREEMENT & TERMS
          </div>
          <h1>Terms and Conditions</h1>
          <p>Effective Date: October 11, 2026 | Enterprise TMS Service Agreement</p>
        </div>
      </div>

      <div className="surface-card legal-card">
        <section className="legal-section">
          <h2>1. Authorization & Permitted Use</h2>
          <p>
            By accessing or integrating with this Transportation Management System (TMS) platform and associated API endpoints, you agree to comply with operational routing standards and applicable transport authority regulations. This system is licensed for commercial fleet management, dispatch operations, and logistics planning.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Solver Accuracy & Operational Responsibility</h2>
          <p>
            Routing algorithms provide mathematically optimized recommendations based on inputs provided (coordinates, weight limits, speed assumptions, and service windows). Operators and dispatch supervisors remain responsible for final driver instruction, vehicle roadworthiness, axle weight compliance, and adherence to regional road restrictions.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. API Access & Fair Usage</h2>
          <p>
            API access keys and session tokens issued to authenticated personnel must remain confidential. Automated queries must conform to provisioned rate limits. Excessive batch solver calls outside configured enterprise allowances may be throttled to preserve cluster stability.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Service Level & Availability</h2>
          <p>
            System availability, database synchronization intervals, and solver job execution time commitments are governed by the enterprise master service agreement. Offline demo mode is provided for offline testing and does not constitute a guaranteed dispatch production link.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Governing Law</h2>
          <p>
            These terms are governed in accordance with applicable commercial logistics laws and corporate enterprise jurisdiction designated in your organizational deployment agreement.
          </p>
        </section>
      </div>
    </div>
  );
}
