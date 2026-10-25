import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Sparkles, Activity } from "lucide-react";

export default function TracePlayer({ trace = [], algorithm }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(650);
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
      <div className="trace-empty">
        <div className="trace-empty-icon">
          <Sparkles size={18} />
        </div>
        <div className="trace-empty-content">
          <b>Algorithm Trace Ready</b>
          <span>Run route optimization to inspect the solver's decisions and branch moves step by step.</span>
        </div>
      </div>
    );
  }

  const progressPct = steps.length > 1 ? Math.round((index / (steps.length - 1)) * 100) : 100;
  const stepTypeName = step?.type?.replaceAll("-", " ") || "decision";

  return (
    <div className="trace-player">
      {/* Trace Subheader */}
      <div className="trace-player-head">
        <div className="trace-title-group">
          <span className="trace-pulse-dot" />
          <div className="trace-title-text">
            <b>{algorithm || "Solver Execution"}</b>
            <span>{steps.length} sequential decisions recorded</span>
          </div>
        </div>
        <div className="trace-counter-badge">
          <span>Step</span>
          <strong>{String(index + 1).padStart(2, "0")}</strong>
          <span className="counter-sep">/</span>
          <span>{String(steps.length).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Step Narrative Card */}
      <div className="trace-message-card">
        <div className="trace-message-header">
          <span className={`trace-type-badge type-${step?.type || "default"}`}>
            {stepTypeName.toUpperCase()}
          </span>
          {step?.cost != null && (
            <span className="trace-cost-chip">
              Cost: +{Number(step.cost).toFixed(2)} km
            </span>
          )}
        </div>
        <p className="trace-note-text">
          {step?.note || "The optimization solver evaluated candidate edges and updated vehicle assignments."}
        </p>
      </div>

      {/* Scrubber Timeline */}
      <div className="trace-scrubber-wrapper">
        <div className="trace-track-container">
          <input
            className="trace-scrubber"
            type="range"
            min="0"
            max={Math.max(1, steps.length - 1)}
            value={index}
            onChange={(event) => {
              setPlaying(false);
              setIndex(Number(event.target.value));
            }}
            aria-label="Trace step"
            style={{ "--trace-fill-pct": `${progressPct}%` }}
          />
        </div>
        <div className="trace-progress-label">
          <span>Progress {progressPct}%</span>
          <span>{index + 1} of {steps.length} moves</span>
        </div>
      </div>

      {/* Control Buttons Strip */}
      <div className="trace-controls-bar">
        <div className="trace-nav-buttons">
          <button
            type="button"
            className="trace-btn-icon"
            title="Reset to first step"
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
          >
            <SkipBack size={15} />
          </button>
          
          <button
            type="button"
            className={`trace-btn-play ${playing ? "is-playing" : ""}`}
            title={playing ? "Pause playback" : "Play step-by-step trace"}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>

          <button
            type="button"
            className="trace-btn-icon"
            title="Next step"
            onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}
            disabled={index >= steps.length - 1}
          >
            <SkipForward size={15} />
          </button>
        </div>

        {/* Speed Selector Pills */}
        <div className="trace-speed-pills">
          <span className="speed-label">SPEED</span>
          <button
            type="button"
            className={`speed-pill ${speed === 1100 ? "speed-pill-active" : ""}`}
            onClick={() => setSpeed(1100)}
          >
            0.5×
          </button>
          <button
            type="button"
            className={`speed-pill ${speed === 650 ? "speed-pill-active" : ""}`}
            onClick={() => setSpeed(650)}
          >
            1×
          </button>
          <button
            type="button"
            className={`speed-pill ${speed === 320 ? "speed-pill-active" : ""}`}
            onClick={() => setSpeed(320)}
          >
            2×
          </button>
        </div>
      </div>
    </div>
  );
}
