import { useId } from "react";
import { DURATION, LADDER, type Sample } from "./model";

/** Blur in px at a 320px-wide screen, per ladder rung (365 kbps ... 7.8 Mbps). */
const BLUR = [3.4, 2.6, 2.0, 1.35, 0.85, 0.5, 0.2, 0];

export type ScreenPhase = "idle" | "starting" | "playing" | "stalled" | "done";

export function Screen(p: {
  label: string; color: string; sample: Sample | null; phase: ScreenPhase; width: number;
  reduce: boolean; onPlay?: () => void; startingFor?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const s = p.sample;
  const rung = s?.play ?? null;
  const blur = rung == null ? 0 : BLUR[rung] * Math.max(0.5, p.width / 320);
  const media = s?.media ?? 0;
  // the scene moves with media time, so it freezes on a stall
  const pan = p.reduce ? 0 : media;
  const trainX = ((pan * 9) % 230) - 50;
  const cloudX = ((pan * 1.6) % 200) - 30;
  const played = Math.min(1, media / DURATION);
  const buffered = Math.min(1, (media + (s?.buf ?? 0)) / DURATION);

  return (
    <div className={`abrp-screen phase-${p.phase}`} style={{ "--series": p.color } as React.CSSProperties}>
      <svg viewBox="0 0 160 90" className="abrp-scene" preserveAspectRatio="xMidYMid slice"
        style={{ filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}
        role="img" aria-label={rung == null ? "Video not started" : `Video frame at ${LADDER[rung].res}, ${LADDER[rung].kbps} kbps`}>
        <defs>
          <linearGradient id={`sky${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent-soft)" }} />
            <stop offset="1" style={{ stopColor: "var(--c-cr-soft)" }} />
          </linearGradient>
        </defs>
        <rect width="160" height="90" style={{ fill: `url(#sky${gid})` }} />
        <circle cx="118" cy="30" r="11" className="abrp-sun" />
        <g transform={`translate(${-cloudX} 0)`} className="abrp-cloud">
          <ellipse cx="40" cy="18" rx="14" ry="3.6" /><ellipse cx="48" cy="15.5" rx="8" ry="3.4" />
          <ellipse cx="200" cy="24" rx="12" ry="3" /><ellipse cx="120" cy="12" rx="9" ry="2.4" />
        </g>
        <path className="abrp-far" d="M0 58 L18 40 L30 50 L48 30 L66 52 L84 38 L102 54 L124 34 L146 50 L160 42 L160 90 L0 90Z" />
        <path className="abrp-near" d="M0 66 Q22 56 44 64 T90 62 T134 60 T160 62 L160 90 L0 90Z" />
        <rect className="abrp-rail" x="0" y="70" width="160" height="0.9" />
        <g transform={`translate(${trainX} 0)`} className="abrp-train">
          <rect x="0" y="62" width="44" height="8" rx="2" />
          <rect x="46" y="62" width="30" height="8" rx="2" />
          {[3, 10, 17, 24, 31, 49, 56, 63].map((x) => <rect key={x} x={x} y="64" width="5" height="2.6" rx=".6" className="abrp-win" />)}
        </g>
        <rect className="abrp-ground" x="0" y="71" width="160" height="19" />
        <text x="80" y="80.5" textAnchor="middle" className="abrp-sub">Ep. 12 · The last train home</text>
      </svg>

      {/* HUD */}
      <div className="abrp-hud-top">
        <span className="abrp-hud-chip"><i style={{ background: p.color }} />{p.label}</span>
        {rung != null && <span className="abrp-hud-chip mono">{LADDER[rung].res} · {(LADDER[rung].kbps / 1000).toFixed(1)} Mbps</span>}
      </div>
      <div className="abrp-hud-bottom" aria-hidden="true">
        <div className="abrp-scrub"><span className="buf" style={{ width: `${buffered * 100}%` }} /><span className="played" style={{ width: `${played * 100}%` }} /></div>
      </div>

      {p.phase === "idle" && (
        <button type="button" className="abrp-poster" onClick={p.onPlay} aria-label="Play the simulation">
          <span className="abrp-bigplay"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg></span>
        </button>
      )}
      {(p.phase === "starting" || p.phase === "stalled") && (
        <div className="abrp-scrim" role="status">
          <span className={`abrp-spinner${p.reduce ? " still" : ""}`} aria-hidden="true" />
          <span className="abrp-scrim-text">{p.phase === "starting" ? `Starting ${(p.startingFor ?? 0).toFixed(1)} s` : "Rebuffering"}</span>
        </div>
      )}
    </div>
  );
}
