import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/ui";

export interface PredictQ {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
  tryLabel: string;
  onTry: () => void;
}

/** "Predict, then try it" card. The reader picks an answer, sees the reasoning, then applies the change. */
export function Predict({ qs, idx, setIdx, picks, setPick, reduced }: {
  qs: PredictQ[]; idx: number; setIdx: (i: number) => void;
  picks: Record<string, number>; setPick: (id: string, v: number) => void; reduced: boolean;
}) {
  const q = qs[Math.min(idx, qs.length - 1)];
  if (!q) return null;
  const pick = picks[q.id];
  const answered = pick !== undefined;
  const right = pick === q.answer;
  const t = reduced ? { duration: 0 } : { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const };
  return (
    <section className="abr-predict" aria-label="Predict">
      <div className="abr-predict-top">
        <span className="abr-predict-tag">Predict</span>
        <span className="abr-predict-count">{Math.min(idx, qs.length - 1) + 1} / {qs.length}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={t}>
          <p className="abr-predict-q">{q.prompt}</p>
          <div className="abr-predict-opts" role="group" aria-label="Your prediction">
            {q.options.map((o, i) => {
              const cls = !answered ? "" : i === q.answer ? "is-right" : i === pick ? "is-wrong" : "is-dim";
              return (
                <button key={i} type="button" className={`abr-opt ${cls}`} aria-pressed={pick === i} disabled={answered}
                  onClick={() => setPick(q.id, i)}>{o}</button>
              );
            })}
          </div>
          <AnimatePresence initial={false}>
            {answered && (
              <motion.div className="abr-predict-reveal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={t}>
                <p className={`abr-predict-verdict ${right ? "good" : "bad"}`}><b>{right ? "Right." : "Not quite."}</b> <span>{q.explain}</span></p>
                <div className="abr-predict-actions">
                  <Button size="s" variant="primary" onClick={q.onTry}>{q.tryLabel}</Button>
                  {idx < qs.length - 1 && <Button size="s" variant="ghost" onClick={() => setIdx(idx + 1)}>Next question</Button>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
