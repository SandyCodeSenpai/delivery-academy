import { memo, useEffect, useRef, useState } from "react";
import { useRaf, rng } from "@/lib/hooks";
import { clamp } from "@/lib/format";
import { fmtMbps, type CC } from "./model";

interface Pkt { id: number; prog: number; lane: number; dropAt: number | null; fallT: number; rot: number }

export interface PipeProps {
  width: number;
  rtt: number;
  bw: number;
  /** loss-based throughput, Mbps */
  throughput: number;
  loss: number;
  cc: CC;
  reduced: boolean;
}

const CY = 82;

/** Animated pipe: length = RTT, thickness = bandwidth. Packets fly edge -> viewer; lost ones fall out. */
function PipeImpl({ width, rtt, bw, throughput, loss, cc, reduced }: PipeProps) {
  const W = Math.max(300, Math.round(width));
  const narrow = W < 440;
  const H = narrow ? 164 : 146;
  const nodeW = narrow ? 62 : 76;
  const nodeH = 60;
  const x0 = 4 + nodeW + 6;
  const maxLen = W - 4 - nodeW - 6 - x0;
  const minLen = maxLen * 0.16;
  const len = minLen + (maxLen - minLen) * clamp((rtt - 5) / 295, 0, 1);
  const th = 8 + (34 * Math.log(clamp(bw, 1, 100))) / Math.log(100);
  const vx = x0 + len + 6;
  const ph = clamp(th - 5, 4, 9);
  const pw = 11;

  const shownRate = cc === "bbr" ? bw : throughput;
  const baseRate = 2.5 + 6 * Math.log10(1 + Math.min(shownRate, bw));
  const travel = 0.45 + 1.9 * clamp((rtt - 5) / 295, 0, 1);
  const pDrop = loss <= 0 ? 0 : Math.min(0.22, 0.03 + Math.sqrt(loss) * 1.2);

  // ---- animation state (refs; a frame counter triggers the re-render) ----
  const pkts = useRef<Pkt[]>([]);
  const acc = useRef(0);
  const rf = useRef(1);
  const nextId = useRef(1);
  const rand = useRef(rng(7));
  const [, setFrame] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => { if (cc === "bbr") rf.current = 1; }, [cc]);

  useRaf((dt) => {
    const r = rand.current;
    if (cc === "cubic") rf.current = Math.min(1, rf.current + dt * 0.4);
    acc.current += dt * baseRate * rf.current;
    while (acc.current >= 1 && pkts.current.length < 70) {
      acc.current -= 1;
      const drops = r() < pDrop;
      pkts.current.push({ id: nextId.current++, prog: 0, lane: r() * 2 - 1, dropAt: drops ? 0.25 + r() * 0.55 : null, fallT: -1, rot: (r() - 0.5) * 80 });
    }
    if (acc.current > 1) acc.current = 0;
    const next: Pkt[] = [];
    for (const p of pkts.current) {
      if (p.fallT >= 0) {
        p.fallT += dt;
        if (p.fallT < 0.9) next.push(p);
        continue;
      }
      p.prog += dt / travel;
      if (p.dropAt !== null && p.prog >= p.dropAt) {
        p.prog = p.dropAt;
        p.fallT = 0;
        if (cc === "cubic") rf.current = Math.max(0.3, rf.current * 0.5);
        next.push(p);
        continue;
      }
      if (p.prog < 1) next.push(p);
    }
    pkts.current = next;
    setFrame((f) => (f + 1) % 1e6);
  }, !reduced && visible);

  // ---- static layout for reduced motion ----
  let list: Pkt[] = pkts.current;
  if (reduced) {
    const n = clamp(Math.round(baseRate * travel), 3, 16);
    list = Array.from({ length: n }, (_, i) => ({ id: i, prog: (i + 0.5) / n, lane: ((i * 37) % 7) / 3.5 - 1, dropAt: null, fallT: -1, rot: 0 }));
    if (loss > 0) list.push({ id: 999, prog: 0.6, lane: 0, dropAt: 0.6, fallT: 0.35, rot: 28 });
  }

  const laneSpan = Math.max(0, th / 2 - ph / 2 - 2);
  const labelTop = `RTT ${Math.round(rtt)} ms`;
  const gets = cc === "bbr" && throughput < bw * 0.98
    ? `BBR: likely ${fmtMbps(throughput)} to ${fmtMbps(bw)}`
    : `TCP gets ${fmtMbps(throughput)}`;
  const labelBottom = narrow ? `Link ${fmtMbps(bw)}` : `Link ${fmtMbps(bw)}  ·  ${gets}`;
  const mid = x0 + len / 2;
  const half = (s: string) => s.length * 3.6 + 6;
  const topX = clamp(mid, half(labelTop), W - half(labelTop));
  const botX = clamp(mid, half(labelBottom), W - half(labelBottom));
  const ariaLabel = `Pipe from CDN edge to viewer. Round trip ${Math.round(rtt)} milliseconds, link ${fmtMbps(bw)}, achieved throughput ${fmtMbps(throughput)}, packet loss ${(loss * 100).toFixed(2)} percent.`;

  return (
    <div ref={boxRef} className="tcpw-pipe">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {/* RTT bracket */}
        <g className="tcpw-anim-geo">
          <line x1={x0} x2={x0 + len} y1={CY - 30} y2={CY - 30} className="tcpw-bracket" />
          <line x1={x0} x2={x0} y1={CY - 34} y2={CY - 26} className="tcpw-bracket" />
          <line x1={x0 + len} x2={x0 + len} y1={CY - 34} y2={CY - 26} className="tcpw-bracket" />
        </g>
        <text x={topX} y={CY - 38} textAnchor="middle" className="tcpw-svg-label">{labelTop}</text>

        {/* distance ruler: where the viewer would sit at 100 / 200 / 300 ms */}
        <line x1={vx + nodeW} x2={x0 + maxLen + 6 + nodeW} y1={CY} y2={CY} className="tcpw-ruler" />
        {[50, 100, 200, 300].map((t) => {
          const tx = x0 + minLen + (maxLen - minLen) * ((t - 5) / 295) + 6 + nodeW / 2;
          if (tx < vx + nodeW + 22 || (narrow && t === 50)) return null;
          return (
            <g key={t}>
              <line x1={tx} x2={tx} y1={CY - 4} y2={CY + 4} className="tcpw-ruler-tick" />
              <text x={tx} y={CY + 20} textAnchor="middle" className="tcpw-svg-sub">{t} ms</text>
            </g>
          );
        })}

        {/* pipe */}
        <rect x={x0} y={CY - th / 2} width={len} height={th} rx={th / 2} className="tcpw-pipe-body" />

        {/* packets */}
        {list.map((p) => {
          const px = x0 + 4 + p.prog * Math.max(0, len - pw - 8);
          let py = CY - ph / 2 + p.lane * laneSpan;
          let op = 1, rot = 0;
          if (p.fallT >= 0) {
            py += 22 * p.fallT + 34 * p.fallT * p.fallT;
            op = Math.max(0, 1 - p.fallT / 0.9);
            rot = p.rot * Math.min(1, p.fallT * 2);
          }
          const lost = p.fallT >= 0;
          return (
            <rect key={p.id} x={px} y={py} width={pw} height={ph} rx={2}
              className={lost ? "tcpw-pkt lost" : "tcpw-pkt"} opacity={op}
              transform={rot ? `rotate(${rot} ${px + pw / 2} ${py + ph / 2})` : undefined} />
          );
        })}

        {/* nodes */}
        <g>
          <rect x={4} y={CY - nodeH / 2} width={nodeW} height={nodeH} rx={12} className="tcpw-node" />
          <g transform={`translate(${4 + nodeW / 2 - 9} ${CY - nodeH / 2 + 10})`} className="tcpw-icon">
            <rect x={0} y={0} width={18} height={5} rx={1.5} /><rect x={0} y={7} width={18} height={5} rx={1.5} /><rect x={0} y={14} width={18} height={5} rx={1.5} />
          </g>
          <text x={4 + nodeW / 2} y={CY + nodeH / 2 - 10} textAnchor="middle" className="tcpw-svg-node">CDN edge</text>
        </g>
        <g>
          <rect x={vx} y={CY - nodeH / 2} width={nodeW} height={nodeH} rx={12} className="tcpw-node" />
          <g transform={`translate(${vx + nodeW / 2 - 12} ${CY - nodeH / 2 + 9})`} className="tcpw-icon">
            <rect x={0} y={0} width={24} height={15} rx={2.5} /><rect x={9} y={17} width={6} height={3} rx={1} />
          </g>
          <text x={vx + nodeW / 2} y={CY + nodeH / 2 - 10} textAnchor="middle" className="tcpw-svg-node">Viewer</text>
        </g>

        <text x={botX} y={CY + 46} textAnchor="middle" className="tcpw-svg-label">{labelBottom}</text>
        {narrow && <text x={botX} y={CY + 64} textAnchor="middle" className="tcpw-svg-sub">{gets}</text>}
      </svg>
    </div>
  );
}

export const Pipe = memo(PipeImpl);
