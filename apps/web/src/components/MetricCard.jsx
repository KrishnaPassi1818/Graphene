export default function MetricCard({ icon, label, value, foot, tone = "blue" }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span></div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>;
}
