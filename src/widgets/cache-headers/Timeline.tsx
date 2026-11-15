import type { KeyboardEvent, MouseEvent } from "react";
import { revealOf } from "./Flow";
import { CLIENTS, N, OUTCOME_COLOR, OUTCOME_LABEL, OUTCOME_SHORT, type Result } from "./sim";

const L = 14, R = 14, TICK_Y = 14, AXIS_Y = 36, CHIP_Y = 58, ROW_H = 26, CHIP_H = 20, CHAR_W = 7.3;

interface Placed { r: Result; x: number; cx: number; w: number; row: number; text: string }

function layout(results: Result[], W: number, label: (r: Result) => string): Placed[] {
  const sx = (t: number) => L + (t / N) * (W - L - R);
  const rowsEnd: number[] = [];
  return results.map((r) => {
    const text = label(r);
    const w = Math.ceil(text.length * CHAR_W + 14);
    const x = sx(r.req.t);
    const cx = Math.min(Math.max(x - w / 2, 0), W - w);
    let row = rowsEnd.findIndex((end) => cx >= end + 4);
    if (row < 0) { row = rowsEnd.length; rowsEnd.push(0); }
    rowsEnd[row] = cx + w;
    return { r, x, cx, w, row, text };
  });
}

function fadeIn(el: number | null, r: Result) {
  if (el === null) return {};
  const k = Math.min(1, Math.max(0, (el - revealOf(r)) / 0.3));
  if (k >= 1) return {};
  const e = 1 - Math.pow(1 - k, 3);
  return { opacity: e, transform: `translate(0 ${(-4 * (1 - e)).toFixed(2)})` };
}

export function Timeline(p: {
  width: number; results: Result[]; revealed: Set<number>; phase: "idle" | "playing" | "done"; clock: number;
  originDown: boolean; downFrom: number; onAdd: (t: number) => void; onRemove: (id: number) => void; disabled: boolean;
  /** Real seconds since Replay while playing, else null. Chips fade in from the replay clock (no CSS animation on SVG:
   *  Chrome can leave a stale raster behind after an opacity animation on an SVG group). */
  el: number | null;
}) {
  const W = Math.max(280, p.width);
  const narrow = W < 560;
  const sx = (t: number) => L + (t / N) * (W - L - R);
  const shown = p.phase !== "idle";
  const placed = layout(p.results, W, (r) => (shown ? `${r.n} ${narrow ? OUTCOME_SHORT[r.outcome] : OUTCOME_LABEL[r.outcome]}` : `#${r.n}`));
  const rows = Math.max(1, ...placed.map((q) => q.row + 1));
  const H = CHIP_Y + rows * ROW_H + (p.originDown ? 24 : 6);
  const ticks = narrow ? [0, 15, 30, 45, 60] : [0, 10, 20, 30, 40, 50, 60];

  const add = (e: MouseEvent<SVGRectElement>) => {
    if (p.disabled) return;
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const t = Math.round(((x - L) / (W - L - R)) * N);
    if (t >= 0 && t <= N) p.onAdd(t);
  };
  const key = (id: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (!p.disabled) p.onRemove(id); }
  };

  return (
    <svg className="ch-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group"
      aria-label={`Request timeline, 0 to ${N} seconds, ${p.results.length} requests. Tap the track to add a request; select a request to remove it.`}>
      {p.originDown && (
        <g>
          <rect className="ch-downband" x={sx(p.downFrom)} y={AXIS_Y - 12} width={Math.max(0, sx(N) - sx(p.downFrom) + R)} height={H - AXIS_Y + 12} rx={8} />
          <text className="ch-downlabel" x={Math.min(sx(p.downFrom) + 6, W - 84)} y={H - 7}>origin down</text>
        </g>
      )}
      {ticks.filter((t) => p.phase !== "playing" || Math.abs(sx(t) - sx(p.clock)) > 26).map((t) => (
        <text key={t} className="ch-tick" x={sx(t)} y={TICK_Y} textAnchor={t === 0 ? "start" : t === N ? "end" : "middle"}>{t === N ? `${t} s` : t}</text>
      ))}
      <line className="ch-axis" x1={sx(0)} x2={sx(N)} y1={AXIS_Y} y2={AXIS_Y} />
      <rect className="ch-axis-hit" x={0} y={AXIS_Y - 16} width={W} height={32} onClick={add} aria-hidden="true" />

      {/* Three layers so a chip always covers the leader lines of its neighbours. */}
      {placed.map((q) => {
        const drawChip = !shown || p.revealed.has(q.r.req.id);
        return drawChip ? <line key={q.r.req.id} className="ch-leader" x1={q.x} x2={q.x} y1={AXIS_Y + 8} y2={CHIP_Y + q.row * ROW_H} {...fadeIn(p.el, q.r)} /> : null;
      })}
      {placed.map((q) => {
        const isShown = p.revealed.has(q.r.req.id);
        if (shown && !isShown) return null;
        const color = isShown ? OUTCOME_COLOR[q.r.outcome] : "var(--muted)";
        const cy = CHIP_Y + q.row * ROW_H;
        return (
          <g key={q.r.req.id} className="ch-chip" {...fadeIn(p.el, q.r)}>
            <rect x={q.cx} y={cy} width={q.w} height={CHIP_H} rx={CHIP_H / 2}
              style={{ fill: shown ? `color-mix(in srgb, ${color} 15%, var(--surface))` : "var(--surface)", stroke: shown ? `color-mix(in srgb, ${color} 45%, transparent)` : "var(--line)" }} />
            <text x={q.cx + 7} y={cy + 14.5}>
              {shown ? (<><tspan className="num">{q.r.n} </tspan><tspan style={{ fill: color }}>{q.text.slice(String(q.r.n).length + 1)}</tspan></>) : <tspan style={{ fill: "var(--ink-2)" }}>{q.text}</tspan>}
            </text>
          </g>
        );
      })}
      {placed.map((q) => {
        const isShown = p.revealed.has(q.r.req.id);
        const color = OUTCOME_COLOR[q.r.outcome];
        return (
          <g key={q.r.req.id} className="ch-dot" role="button" tabIndex={p.disabled ? -1 : 0} onKeyDown={key(q.r.req.id)}
            aria-label={`Request ${q.r.n} at ${q.r.req.t} seconds from ${CLIENTS[q.r.req.client].name}${isShown ? `: ${OUTCOME_LABEL[q.r.outcome]}` : ""}. Press to remove.`}
            onClick={(e) => { e.stopPropagation(); if (!p.disabled) p.onRemove(q.r.req.id); }}>
            <circle cx={q.x} cy={AXIS_Y} r={13} style={{ fill: "transparent" }} />
            <circle className="ring" cx={q.x} cy={AXIS_Y} r={10} style={{ fill: "none" }} />
            <circle className="d" cx={q.x} cy={AXIS_Y} r={6.5} style={{ fill: isShown ? color : "var(--surface-3)", stroke: isShown ? "var(--surface)" : "var(--muted)" }} />
          </g>
        );
      })}

      {p.phase === "playing" && (
        <g aria-hidden="true">
          <line className="ch-playhead" x1={sx(p.clock)} x2={sx(p.clock)} y1={AXIS_Y - 14} y2={H - 4} />
          <text className="ch-playhead-time" x={Math.min(Math.max(sx(p.clock), 22), W - 22)} y={TICK_Y} textAnchor="middle"
            style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>{Math.floor(p.clock)} s</text>
        </g>
      )}
    </svg>
  );
}
