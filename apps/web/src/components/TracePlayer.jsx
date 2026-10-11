import { useEffect, useMemo, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Sparkles } from "lucide-react";

export default function TracePlayer({ trace = [], algorithm }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(650);
  const steps = useMemo(() => trace.slice(0, 5000), [trace]);
  const step = steps[index];

  useEffect(() => { setIndex(0); setPlaying(false); }, [trace]);
  useEffect(() => {
    if (!playing || steps.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((current) => {
      if (current >= steps.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), speed);
    return () => window.clearInterval(timer);
  }, [playing, steps.length, speed]);

  if (!steps.length) return <div className="trace-empty"><div className="trace-empty-icon"><Sparkles size={17} /></div><div><b>Algorithm trace</b><span>Run an optimization to see the solver's decisions step by step.</span></div></div>;

  return (
    <div className="trace-player">
      <div className="trace-player-head">
        <div className="trace-title"><span className="trace-pulse" /><div><b>Algorithm trace</b><span>{algorithm || "Solver"} · {steps.length} recorded decisions</span></div></div>
        <div className="trace-counter">{String(index + 1).padStart(2, "0")} <i>/</i> {String(steps.length).padStart(2, "0")}</div>
      </div>
      <div className="trace-message"><span className="trace-step-type">{step?.type?.replaceAll("-", " ") || "step"}</span><p>{step?.note || "The solver updated its current state."}</p></div>
      <div className="trace-controls">
        <button className="trace-icon-btn" aria-label="Go to first step" onClick={() => { setPlaying(false); setIndex(0); }}><SkipBack size={15} /></button>
        <button className="trace-play-btn" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button>
        <button className="trace-icon-btn" aria-label="Next step" onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}><SkipForward size={15} /></button>
        <input className="trace-scrubber" type="range" min="0" max={steps.length - 1} value={index} onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }} aria-label="Trace step" />
        <label className="trace-speed">SPEED <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1100}>0.5×</option><option value={650}>1×</option><option value={320}>2×</option></select></label>
      </div>
    </div>
  );
}
