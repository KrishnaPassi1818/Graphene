import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight, Activity, ArrowRight } from "lucide-react";

export default function TracePlayer({ trace = [], algorithm }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const steps = useMemo(() => trace.slice(0, 5000), [trace]);
  const step = steps[index];

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [trace]);

  useEffect(() => {
    if (!playing || steps.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [playing, steps.length, speed]);

  if (!steps.length) {
    return (
      <div className="trace-minimal-empty">
        <Activity size={16} className="trace-empty-glyph" />
        <p>No decision trace yet. Run route optimization to playback solver decisions.</p>
      </div>
    );
  }

  const progressPct = steps.length > 1 ? Math.round((index / (steps.length - 1)) * 100) : 100;
  const stepTypeName = step?.type?.replaceAll("-", " ") || "decision";

  return (
    <div className="trace-minimal-container">
      {/* Step Info Row */}
      <div className="trace-minimal-step-row">
        <div className="trace-minimal-type-group">
          <span className={`trace-minimal-pill type-${step?.type || "default"}`}>
            {stepTypeName}
          </span>
          {step?.cost != null && (
            <span className="trace-minimal-cost">
              +{Number(step.cost).toFixed(2)} km
            </span>
          )}
        </div>
        <div className="trace-minimal-counter">
          <span>{index + 1}</span>
          <span className="trace-sep">/</span>
          <span>{steps.length}</span>
        </div>
      </div>

      {/* Decision Note */}
      <div className="trace-minimal-card">
        <p className="trace-minimal-note">
          {step?.note || "The optimization solver evaluated candidate edges and updated vehicle assignments."}
        </p>
      </div>

      {/* Single Sleek Scrubber Bar */}
      <div className="trace-minimal-scrubber-box">
        <input
          className="trace-minimal-slider"
          type="range"
          min="0"
          max={Math.max(1, steps.length - 1)}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          aria-label="Decision step scrubber"
          style={{ "--trace-fill-pct": `${progressPct}%` }}
        />
      </div>

      {/* Clean Minimal Controls */}
      <div className="trace-minimal-controls">
        <div className="trace-minimal-btns">
          <button
            type="button"
            className="trace-minimal-btn"
            title="Reset to beginning"
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
          >
            <RotateCcw size={13} />
          </button>

          <button
            type="button"
            className="trace-minimal-btn"
            title="Previous step"
            onClick={() => setIndex((v) => Math.max(0, v - 1))}
            disabled={index <= 0}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            className={`trace-minimal-play-btn ${playing ? "is-active" : ""}`}
            title={playing ? "Pause" : "Play step-by-step"}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>

          <button
            type="button"
            className="trace-minimal-btn"
            title="Next step"
            onClick={() => setIndex((v) => Math.min(steps.length - 1, v + 1))}
            disabled={index >= steps.length - 1}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Minimal Speed Selector */}
        <div className="trace-minimal-speed">
          {[
            { label: "1×", val: 600 },
            { label: "2×", val: 300 },
          ].map(({ label, val }) => (
            <button
              key={label}
              type="button"
              className={`trace-speed-btn ${speed === val ? "active" : ""}`}
              onClick={() => setSpeed(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
