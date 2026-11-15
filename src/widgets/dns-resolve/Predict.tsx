import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Button, Icon } from "@/ui";
import { useReducedMotion } from "@/lib/hooks";

/** Predict-first card. The parent hides its reveal until `onReveal` fires (answer or skip). */
export function Predict(p: { q: ReactNode; options: string[]; answer: number; explain: ReactNode; onReveal: () => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const reduced = useReducedMotion();
  const done = pick !== null || skipped;
  const right = pick === p.answer;
  return (
    <div className={`dr-predict${done ? " is-done" : ""}`} role="group" aria-label="Predict first">
      <div className="dr-kicker"><Icon name="target" size={15} /> Predict first</div>
      <div className="dr-predict-q">{p.q}</div>
      <div className="dr-opts">
        {p.options.map((o, i) => {
          const state = !done ? "" : i === p.answer ? " is-right" : i === pick ? " is-wrong" : " is-faded";
          return (
            <button key={i} type="button" className={`dr-opt${state}`} disabled={done} aria-pressed={pick === i}
              onClick={() => { setPick(i); p.onReveal(); }}>
              <span className="dr-opt-key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
              <span>{o}</span>
              {done && i === p.answer && <Icon name="check" size={16} className="dr-opt-icon" label="correct answer" />}
              {done && i === pick && i !== p.answer && <Icon name="x" size={16} className="dr-opt-icon" label="your answer" />}
            </button>
          );
        })}
      </div>
      {!done && (
        <div className="dr-predict-skip">
          <Button variant="plain" size="s" onClick={() => { setSkipped(true); p.onReveal(); }}>Skip and show me</Button>
        </div>
      )}
      {done && (
        <motion.div className={`dr-predict-fb ${right ? "tone-good" : skipped ? "tone-neutral" : "tone-bad"}`}
          initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} aria-live="polite">
          <strong>{right ? "Right. " : skipped ? "Answer: " : "Not quite. "}</strong>{p.explain}
        </motion.div>
      )}
    </div>
  );
}
