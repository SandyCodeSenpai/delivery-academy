import { useEffect, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { useWidth } from "@/lib/hooks";
import { STEPS, fmtTime, type StepCalc } from "./model";

function useTween(value: number, reduced: boolean) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) { setV(value); from.current = value; return; }
    const c = animate(from.current, value, { duration: 0.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => { from.current = x; setV(x); } });
    return () => c.stop();
  }, [value, reduced]);
  return v;
}

export function Timeline(props: { calcs: StepCalc[]; pos: number; axisMax: number; best: number | null; reduced: boolean }) {
  const { calcs, pos, axisMax, best, reduced } = props;
  const trackRef = useRef<HTMLDivElement>(null);
  const tw = useWidth(trackRef);
  const done = calcs.slice(0, pos).reduce((s, c) => s + c.ms, 0);
  const total = calcs.reduce((s, c) => s + c.ms, 0);
  const shown = useTween(done, reduced);
  const finished = pos >= calcs.length;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += 500) ticks.push(t);
  const pct = (ms: number) => (ms / axisMax) * 100;
  const tr = reduced ? { duration: 0 } : { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const };

  let acc = 0;
  return (
    <div className="pp-tl">
      <div className="pp-tl-head">
        <div>
          <div className="pp-tl-label">Time to first frame</div>
          <div className="pp-tl-value" aria-live="polite">
            {fmtTime(shown)}
            <span className="pp-tl-sub">{finished ? "total" : pos === 0 ? "not started" : `so far, step ${pos} of ${calcs.length}`}</span>
          </div>
        </div>
        {best !== null && total !== best && (
          <div className="pp-tl-delta">
            <span>best case {fmtTime(best)}</span>
            <strong>+{fmtTime(total - best)}</strong>
          </div>
        )}
      </div>

      <div className="pp-tl-track" ref={trackRef} role="img"
        aria-label={`Timeline: ${calcs.map((c, i) => `step ${i + 1} ${fmtTime(c.ms)}`).join(", ")}. Total ${fmtTime(total)}.`}>
        {calcs.map((c, i) => {
          const left = pct(acc); acc += c.ms;
          const width = pct(c.ms);
          const px = (width / 100) * tw;
          const state = i < pos ? "on" : "ghost";
          return (
            <motion.div key={STEPS[i].id} className={`pp-tl-seg pp-tl-${STEPS[i].plane} pp-tl-${state} ${i === pos - 1 ? "pp-tl-cur" : ""}`}
              initial={false} animate={{ left: `${left}%`, width: `${width}%` }} transition={tr}
              title={`${STEPS[i].title}: ${fmtTime(c.ms)}`}>
              {px >= 20 && <span>{i + 1}</span>}
            </motion.div>
          );
        })}
        {best !== null && total !== best && <div className="pp-tl-best" style={{ left: `${pct(best)}%` }} aria-hidden="true" />}
      </div>
      <div className="pp-tl-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${pct(t)}%` }}>{t === 0 ? "0" : `${t / 1000} s`}</span>
        ))}
      </div>
    </div>
  );
}
