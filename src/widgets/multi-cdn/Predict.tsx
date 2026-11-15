import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Icon } from "@/ui";
import { useReducedMotion } from "@/lib/hooks";

export interface PredictQ { id: string; prompt: ReactNode; options: string[]; answer: number; explain: ReactNode }

/** A short run of "predict, then see" questions. The reader picks once per question; the answer and a reason appear. */
export function Predict({ questions, label = "Predict" }: { questions: PredictQ[]; label?: string }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const reduce = useReducedMotion();
  const q = questions[idx];
  const choice = picked[q.id];
  const done = choice !== undefined;
  const right = done && choice === q.answer;

  return (
    <section className="mcdn-predict" aria-label={`${label}: question ${idx + 1} of ${questions.length}`}>
      <div className="mcdn-predict-head">
        <span className="mcdn-eyebrow"><Icon name="target" size={15} />{label}</span>
        {questions.length > 1 && <span className="mcdn-predict-count">{idx + 1} of {questions.length}</span>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={q.id} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.22 }}>
          <p className="mcdn-predict-q">{q.prompt}</p>
          <div className="mcdn-predict-opts" role="group" aria-label="Answer options">
            {q.options.map((o, i) => {
              const state = !done ? "" : i === q.answer ? " is-right" : i === choice ? " is-wrong" : " is-dim";
              return (
                <button key={i} type="button" className={`mcdn-opt${state}`} disabled={done} aria-pressed={choice === i}
                  onClick={() => setPicked((p) => ({ ...p, [q.id]: i }))}>
                  <span className="mcdn-opt-key" aria-hidden="true">
                    {done && i === q.answer ? <Icon name="check" size={14} stroke={2.5} /> : done && i === choice ? <Icon name="x" size={14} stroke={2.5} /> : String.fromCharCode(65 + i)}
                  </span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
          {done && (
            <motion.div className={`mcdn-predict-why ${right ? "good" : "bad"}`} role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.1 : 0.24 }}>
              <strong>{right ? "Right." : "Not quite."}</strong> {q.explain}
              {idx < questions.length - 1 && (
                <div className="mcdn-predict-next"><Button size="s" variant="tinted" onClick={() => setIdx(idx + 1)}>Next question <Icon name="arrow-right" size={14} /></Button></div>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
