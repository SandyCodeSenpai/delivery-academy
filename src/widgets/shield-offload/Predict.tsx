import { useState, type ReactNode } from "react";
import { Button, Eyebrow, Icon } from "@/ui";

export interface PredictQuestion {
  id: string;
  prompt: ReactNode;
  options: string[];
  answer: number; // index into options
  explain: ReactNode;
  /** Sets the simulation to show the answer. */
  show?: () => void;
  showLabel?: string;
}

/** Predict-then-reveal cards, one at a time. */
export function Predict({ questions }: { questions: PredictQuestion[] }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const q = questions[idx];
  const choice = picked[q.id];
  const answered = choice !== undefined;
  const right = choice === q.answer;

  return (
    <section className="so-predict" aria-label="Predict before you play">
      <div className="so-predict-head">
        <Eyebrow dot="var(--p3)">Predict</Eyebrow>
        <span className="so-predict-count">{idx + 1} of {questions.length}</span>
      </div>
      <p className="so-predict-q">{q.prompt}</p>
      <div className="so-predict-opts" role="group" aria-label="Answer options">
        {q.options.map((o, i) => {
          const state = !answered ? "" : i === q.answer ? "is-right" : i === choice ? "is-wrong" : "is-dim";
          return (
            <Button key={o} size="s" className={`so-opt ${state}`} aria-pressed={choice === i}
              disabled={answered} onClick={() => setPicked((p) => ({ ...p, [q.id]: i }))}>{o}</Button>
          );
        })}
      </div>
      {answered && (
        <div className={`so-predict-reveal ${right ? "good" : "bad"}`} aria-live="polite">
          <Icon name={right ? "check" : "x"} size={16} stroke={2.25} className="so-reveal-icon" /><div><strong>{right ? "Correct." : "Not quite."}</strong> {q.explain}</div>
        </div>
      )}
      <div className="so-predict-nav">
        {answered && q.show && <Button size="s" variant="primary" onClick={q.show}>{q.showLabel ?? "Show me"}</Button>}
        <span className="so-grow" />
        <Button size="s" variant="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Back</Button>
        <Button size="s" variant="ghost" disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)}>Next question</Button>
      </div>
    </section>
  );
}
