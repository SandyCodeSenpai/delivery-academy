import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Eyebrow, Icon, IconButton } from "@/ui";
import { ALGOS, algoLabel, type AlgoKey, type Params, type TraceKey } from "./model";
import { QUESTIONS, isRight, verdict } from "./questions";

type Phase = "ask" | "notquite" | "right" | "shown";

export function Predict(p: {
  params: Params; reduce: boolean; qIndex: number; onQuestion: (i: number) => void;
  onWatch: (trace: TraceKey, pair: [AlgoKey, AlgoKey]) => void;
}) {
  const q = QUESTIONS[p.qIndex];
  const [picked, setPicked] = useState<AlgoKey[]>([]);
  const [phase, setPhase] = useState<Phase>("ask");
  const [triedOnce, setTriedOnce] = useState(false);
  const v = useMemo(() => verdict(q, p.params), [q, p.params]);
  const done = phase === "right" || phase === "shown";

  const go = (i: number) => { setPicked([]); setPhase("ask"); setTriedOnce(false); p.onQuestion((i + QUESTIONS.length) % QUESTIONS.length); };
  const toggle = (k: AlgoKey) => {
    if (done) return;
    if (phase === "notquite") setPhase("ask");
    setPicked((cur) => (q.multi ? (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]) : [k]));
  };
  const check = () => {
    if (isRight(q, picked, v)) setPhase("right");
    else setPhase(triedOnce ? "shown" : "notquite");
    setTriedOnce(true);
  };
  const fade = p.reduce ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22 } };

  return (
    <section className="abrp-predict" aria-label="Predict, then check">
      <div className="abrp-predict-head">
        <Eyebrow dot="var(--p4)">Predict · {p.qIndex + 1} of {QUESTIONS.length}</Eyebrow>
        <div className="abrp-predict-nav">
          <IconButton label="Previous question" onClick={() => go(p.qIndex - 1)}><Icon name="chevron-left" size={18} /></IconButton>
          <IconButton label="Next question" onClick={() => go(p.qIndex + 1)}><Icon name="chevron-right" size={18} /></IconButton>
        </div>
      </div>
      <p className="abrp-predict-q">{q.prompt}</p>
      <div className="abrp-opts" role={q.multi ? "group" : "radiogroup"} aria-label="Algorithms">
        {ALGOS.map((a) => {
          const on = picked.includes(a.key);
          const state = done ? (v.correct.includes(a.key) ? "ok" : on ? "miss" : "") : "";
          return (
            <button key={a.key} type="button" role={q.multi ? "checkbox" : "radio"} aria-checked={on} disabled={done}
              className={`abrp-opt${on ? " on" : ""} ${state}`} onClick={() => toggle(a.key)}>
              {q.multi && <span className="abrp-box" aria-hidden="true">{on && <Icon name="check" size={14} stroke={2.4} />}</span>}
              {a.label}
            </button>
          );
        })}
        {!done && (
          <Button variant="primary" size="s" onClick={check} disabled={!q.multi && picked.length === 0}>
            {q.multi && picked.length === 0 ? "None of them" : "Check"}
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "notquite" && (
          <motion.div key="nq" className="abrp-feedback warn" {...fade}>
            <strong>Not quite.</strong> {q.hint} Change your pick and check again.
          </motion.div>
        )}
        {done && (
          <motion.div key="res" className="abrp-feedback" {...fade}>
            <div className={`abrp-verdict ${phase === "right" ? "good" : "neutral"}`}>
              <Icon name={phase === "right" ? "check" : "info"} size={18} stroke={2.2} />
              {phase === "right" ? "Right." : `The answer: ${v.correct.length ? v.correct.map(algoLabel).join(", ") : "none of them"}.`}
              <span className="abrp-muted"> Simulated with your current settings.</span>
            </div>
            <table className="abrp-mini">
              <thead><tr><th scope="col">Algorithm</th><th scope="col">{q.metric}</th>{v.rows.some((r) => r.note) && <th scope="col" className="abrp-hide-narrow">At the tunnel</th>}</tr></thead>
              <tbody>
                {v.rows.map((r) => (
                  <tr key={r.algo} className={r.hit ? "hit" : ""}>
                    <th scope="row">{algoLabel(r.algo)}</th>
                    <td className="mono">{r.value}</td>
                    {r.note && <td className="abrp-hide-narrow abrp-muted">{r.note}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="abrp-why">{v.why}</p>
            <div className="abrp-row">
              <Button variant="tinted" size="s" onClick={() => p.onWatch(q.trace, v.watch)}>
                <Icon name="play" size={14} /> Watch {algoLabel(v.watch[0])} vs {algoLabel(v.watch[1])}
              </Button>
              <Button variant="ghost" size="s" onClick={() => go(p.qIndex + 1)}>Next question <Icon name="chevron-right" size={16} /></Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
