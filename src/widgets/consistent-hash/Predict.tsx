import type { ReactNode } from "react";

export interface PredictQ {
  id: string;
  q: string;
  opts: string[];
  correct: number;
  /** what to do after picking, before the reveal */
  doNext: string;
}

/** Predict, then check: pick an answer, do the action, the simulation reveals the truth. */
export default function Predict({ q, pick, revealed, result, onPick }: { q: PredictQ; pick?: number; revealed: boolean; result?: ReactNode; onPick: (i: number) => void }) {
  const locked = pick !== undefined;
  const right = pick === q.correct;
  return (
    <div className="ch-predict" role="group" aria-label="Predict">
      <div className="ch-eyebrow">Predict</div>
      <p className="ch-predict-q">{q.q}</p>
      <div className="ch-opts">
        {q.opts.map((o, i) => {
          const cls = revealed && locked
            ? i === q.correct ? "good" : i === pick ? "bad" : ""
            : i === pick ? "picked" : "";
          return (
            <button key={o} type="button" className={`ch-opt ${cls}`} aria-pressed={i === pick} disabled={locked}
              onClick={() => onPick(i)}>{o}</button>
          );
        })}
      </div>
      {locked && !revealed && <p className="ch-predict-next">{q.doNext}</p>}
      {revealed && (
        <div className={`ch-predict-result ${locked ? (right ? "good" : "bad") : ""}`} aria-live="polite">
          {locked && <strong>{right ? "Correct. " : "Not quite. "}</strong>}
          {result}
        </div>
      )}
    </div>
  );
}
