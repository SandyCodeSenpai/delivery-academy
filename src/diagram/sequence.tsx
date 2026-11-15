/* Sequence diagram: actor headers with icons, lifelines, numbered message arrows, progressive reveal with `upTo`. */
import { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { SequenceSpec, Tone } from "@/content/types";
import { useReducedMotion } from "@/lib/hooks";
import { Icon, familyOf } from "./icons";
import { useBoxWidth } from "./flow";
import { arrowHead, rounded, type Pt } from "./layout";
import { wrap, widest, plain } from "./text";

const S = { lbl: 13, lblLH: 17, lblW: 500, note: 12, noteLH: 15, head: 13, headLH: 16, tile: 34, r: 9 };

interface Row {
  i: number; from: number; to: number; self: boolean; selfLeft: boolean; tone: Tone; dashed: boolean;
  top: number; bottom: number; ay: number; x1: number; x2: number;
  lbl: { x: number; y: number; w: number; h: number; lines: string[] };
  note?: { x: number; y: number; w: number; h: number; lines: string[] };
  line: string; head: string;
}

const memory = new Map<string, number>();

function layoutSeq(spec: SequenceSpec, W: number) {
  const n = Math.max(1, spec.actors.length);
  const laneW = Math.min(200, W / n);
  const offX = (W - laneW * n) / 2;
  const xs = spec.actors.map((_, i) => offX + laneW * (i + 0.5));
  const idx = new Map(spec.actors.map((a, i) => [a.id, i]));
  const heads = spec.actors.map((a) => wrap(plain(a.label), Math.max(56, laneW - 8), S.head, 600, 2));
  const headerH = S.tile + 8 + Math.max(1, ...heads.map((h) => h.length)) * S.headLH;
  let y = headerH + 22;
  const rows: Row[] = [];
  spec.messages.forEach((m, k) => {
    const from = idx.get(m.from), to = idx.get(m.to);
    if (from === undefined || to === undefined) return;
    const x1 = xs[from], x2 = xs[to], self = from === to;
    const top = y;
    let lblW: number, cx: number, selfLeft = false;
    if (self) {
      const right = W - x1 - 44;
      selfLeft = right < 110 && x1 - 44 > right;
      lblW = Math.min(240, selfLeft ? x1 - 44 : right);
      cx = NaN;
    } else {
      const span = Math.abs(x2 - x1);
      // a label may be wider than its arrow; its pill hides the lifelines it crosses
      lblW = Math.min(W - 12, Math.max(span - 30, 240));
      cx = (x1 + x2) / 2;
    }
    const lines = wrap(plain(m.label), lblW - 16, S.lbl, S.lblW, 3);
    const w = widest(lines, S.lbl, S.lblW) + 16, h = lines.length * S.lblLH + 6;
    let lx: number, ly: number, ay: number, bottom: number;
    const loopH = self ? 22 : 0;
    if (self) {
      lx = selfLeft ? x1 - 40 - w : x1 + 40;
      ay = top + Math.max(6, h / 2 - loopH / 2);
      ly = ay + loopH / 2 - h / 2;
      bottom = Math.max(ay + loopH, ly + h);
    } else {
      lx = Math.max(4, Math.min(W - 4 - w, cx - w / 2));
      ly = top;
      ay = top + h + 8;
      bottom = ay;
    }
    let note: Row["note"];
    if (m.note) {
      const nw = Math.min(280, W - 16);
      const nl = wrap(plain(m.note), nw - 20, S.note, 400, 3);
      const ww = widest(nl, S.note) + 20, hh = nl.length * S.noteLH + 10;
      const ncx = self ? (selfLeft ? x1 - 40 - ww / 2 : x1 + 40 + ww / 2) : cx;
      const nx = Math.max(4, Math.min(W - 4 - ww, ncx - ww / 2));
      note = { x: nx, y: bottom + 8, w: ww, h: hh, lines: nl };
      bottom = note.y + hh;
    }
    // arrow geometry
    let pts: Pt[];
    if (self) {
      const s = selfLeft ? -1 : 1;
      pts = [{ x: x1 + s * (S.r + 1), y: ay }, { x: x1 + s * 30, y: ay }, { x: x1 + s * 30, y: ay + loopH }, { x: x1 + s * 2, y: ay + loopH }];
    } else {
      const s = Math.sign(x2 - x1);
      pts = [{ x: x1 + s * (S.r + 1), y: ay }, { x: x2 - s * 1.5, y: ay }];
    }
    const tip = pts[pts.length - 1], prev = pts[pts.length - 2];
    const L = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1;
    const trimmed = [...pts.slice(0, -1), { x: tip.x - ((tip.x - prev.x) / L) * 7, y: tip.y - ((tip.y - prev.y) / L) * 7 }];
    rows.push({
      i: k, from, to, self, selfLeft, tone: m.tone ?? "neutral", dashed: !!m.dashed, top, bottom, ay, x1, x2,
      lbl: { x: lx, y: ly, w, h, lines }, note, line: rounded(trimmed, 10), head: arrowHead(prev, tip),
    });
    y = bottom + 20;
  });
  return { xs, heads, headerH, rows, h: y - 4, laneW };
}

export function SequenceDiagram({ spec }: { spec: SequenceSpec }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useBoxWidth(hostRef);
  const reduced = useReducedMotion();
  const L = useMemo(() => (W > 0 ? layoutSeq(spec, W) : null), [spec, W]);
  const sig = useMemo(() => spec.actors.map((a) => a.id).join("|") + "#" + spec.messages.map((m) => `${m.from}>${m.to}:${m.label}`).join("|"), [spec]);
  const total = spec.messages.length;
  const upTo = spec.upTo === undefined ? total - 1 : Math.max(-1, Math.min(total - 1, spec.upTo));
  const [firstSeen] = useState(() => memory.get(sig));
  useEffect(() => { memory.set(sig, upTo); }, [sig, upTo]);
  const progressive = spec.upTo !== undefined;

  const aria = useMemo(() => {
    const name = new Map(spec.actors.map((a) => [a.id, plain(a.label)]));
    return "Sequence: " + spec.messages.slice(0, upTo + 1).map((m, i) => `${i + 1}. ${name.get(m.from)} to ${name.get(m.to)}: ${plain(m.label)}`).join(". ");
  }, [spec, upTo]);

  return (
    <div ref={hostRef} className="dg-seq-host">
      {L && (
        <div className="dg-seq" style={{ height: L.h }} role="img" aria-label={aria}>
          <svg className="dg-seq-svg" width={W} height={L.h} aria-hidden="true">
            {L.xs.map((x, i) => <line key={i} className="dg-lifeline" x1={x} x2={x} y1={L.headerH + 8} y2={L.h - 4} />)}
            {L.rows.map((r) => {
              const shown = r.i <= upTo;
              if (!shown) {
                return (
                  <g key={r.i} className="dg-msg is-ghost">
                    <path d={r.line} className="dg-msg-line" />
                    <circle cx={r.x1} cy={r.ay} r={S.r} className="dg-msg-num" />
                  </g>
                );
              }
              const isNew = !reduced && (firstSeen === undefined ? true : r.i > firstSeen);
              const delay = isNew ? (firstSeen === undefined ? r.i * 0.14 : (r.i - (firstSeen + 1)) * 0.25) + 0.05 : 0;
              const current = progressive && r.i === upTo;
              return (
                <motion.g key={r.i} className={`dg-msg tone-${r.tone}${current ? " is-current" : ""}`}
                  initial={isNew ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay, ease: [0.2, 0.8, 0.2, 1] }}>
                  {current && <rect className="dg-msg-band" x={2} y={r.top - 8} width={W - 4} height={r.bottom - r.top + 16} rx={12} />}
                  <rect className="dg-msg-pill" x={r.lbl.x} y={r.lbl.y} width={r.lbl.w} height={r.lbl.h} rx={8} />
                  {r.lbl.lines.map((l, j) => (
                    <text key={j} className="dg-msg-label" x={r.lbl.x + r.lbl.w / 2} y={r.lbl.y + 3 + S.lblLH * (j + 0.5)} dy="0.35em" textAnchor="middle">{l}</text>
                  ))}
                  <motion.path d={r.line} className="dg-msg-line" strokeDasharray={r.dashed ? "5 5" : undefined}
                    initial={isNew && !r.dashed ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: delay + 0.05, ease: [0.4, 0, 0.2, 1] }} />
                  <motion.path d={r.head} className="dg-msg-head"
                    initial={isNew ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: delay + 0.45 }} />
                  <circle cx={r.x1} cy={r.ay} r={S.r} className="dg-msg-num" />
                  <text x={r.x1} y={r.ay} dy="0.35em" textAnchor="middle" className="dg-msg-numtext">{r.i + 1}</text>
                  {r.note && (
                    <g className="dg-msg-note">
                      <rect x={r.note.x} y={r.note.y} width={r.note.w} height={r.note.h} rx={8} />
                      {r.note.lines.map((l, j) => <text key={j} x={r.note!.x + r.note!.w / 2} y={r.note!.y + 5 + S.noteLH * (j + 0.5)} dy="0.35em" textAnchor="middle">{l}</text>)}
                    </g>
                  )}
                </motion.g>
              );
            })}
          </svg>
          {spec.actors.map((a, i) => (
            <div key={a.id} className={`dg-actor fam-${familyOf(a.kind)}`} style={{ left: L.xs[i] - L.laneW / 2, width: L.laneW }}>
              <div className="dg-node-icon"><Icon kind={a.kind} size={20} /></div>
              <div className="dg-actor-label">{L.heads[i].map((l, j) => <span key={j}>{l}</span>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
