/** One guided scenario: setup, predict, run, reveal, lesson, optional follow-up. */
import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@/ui";
import type { RunCtx, Scenario } from "./scenarios";
import type { TrafficStats } from "./model";

export type Phase = "ask" | "running" | "revealed" | "next-running" | "next-revealed";

interface Props {
  sc: Scenario;
  phase: Phase;
  choice: number | null;
  before: TrafficStats;
  ctx: RunCtx | null;
  nextCtx: RunCtx | null;
  reduced: boolean;
  compact: boolean;
  isLast: boolean;
  onChoose: (i: number) => void;
  onRun: () => void;
  onTryNext: () => void;
  onNext: () => void;
  onReplay?: () => void;
  /** Live narration to show while the run animates (lesson mode). */
  live?: ReactNode;
}

export function ScenarioCard(p: Props) {
  const { sc, phase, choice } = p;
  const revealed = phase !== "ask" && phase !== "running";
  const right = choice != null && sc.options[choice]?.correct;
  // Lesson mode keeps the card short after the reveal: the options collapse into one verdict line.
  const collapse = p.compact && revealed;
  const answer = sc.options.find((o) => o.correct)?.text ?? "";
  // Lab mode: bring a new result into view inside the side panel.
  const outRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (p.compact || (phase !== "revealed" && phase !== "next-revealed")) return;
    outRef.current?.scrollIntoView({ block: "nearest", behavior: p.reduced ? "auto" : "smooth" });
  }, [phase, p.compact, p.reduced]);
  const appear = { initial: { opacity: 0, y: p.reduced ? 0 : 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28 } };
  return (
    <div className={`pg-card${p.compact ? " compact" : ""}`}>
      {!p.compact && <div className="pg-card-kicker">Scenario {sc.id} of 6</div>}
      <h3 className="pg-card-title">{sc.title}</h3>
      {!collapse && <p className="pg-card-setup">{sc.setup}</p>}
      {!collapse && <p className="pg-card-q">{sc.question(p.before)}</p>}
      {!collapse && <div className="pg-opts" role="radiogroup" aria-label="Your prediction">
        {sc.options.map((o, i) => {
          const state = !revealed ? (choice === i ? "picked" : "") : o.correct ? "right" : choice === i ? "wrong" : "dim";
          return (
            <button key={i} type="button" role="radio" aria-checked={choice === i} className={`pg-opt ${state}`} disabled={phase !== "ask"} onClick={() => p.onChoose(i)}>
              <span className="pg-opt-key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
              <span>{o.text}</span>
              {revealed && o.correct && <span className="pg-opt-mark">Answer</span>}
            </button>
          );
        })}
      </div>}
      {phase === "ask" && (
        <div className="pg-card-actions">
          <Button variant="primary" onClick={p.onRun} disabled={choice == null}>{choice == null ? "Pick an answer first" : "Run it"}</Button>
        </div>
      )}
      {phase === "running" && (p.live ?? <div className="pg-card-wait">Watch the stage…</div>)}
      {revealed && p.ctx && (
        <motion.div {...appear} className="pg-reveal">
          <div className={`pg-verdict ${right ? "good" : "bad"}`}>{right ? "You called it." : "Not quite."}{collapse && <span className="pg-verdict-a"> {right ? "" : "Answer: "}{answer}.</span>}</div>
          {/* Lesson mode swaps the first outcome for the follow-up result to stay short. */}
          {!(collapse && phase === "next-revealed") && <p>{sc.outcome(p.ctx)}</p>}
          <aside className="pg-lesson"><div className="pg-lesson-label">Staff lens</div><p>{sc.lesson}</p></aside>
          {phase === "next-revealed" && p.nextCtx && sc.next && (
            <motion.div {...appear} className="pg-next-out"><div className="pg-lesson-label">{sc.next.label}</div><p>{sc.next.outcome(p.nextCtx)}</p></motion.div>
          )}
          <div className="pg-card-actions" ref={outRef}>
            {sc.next && phase === "revealed" && <Button onClick={p.onTryNext}>{sc.next.label}</Button>}
            {p.onReplay && sc.run === "request" && phase === "revealed" && <Button variant="ghost" onClick={p.onReplay}>Play again</Button>}
            {!p.isLast && <Button variant="primary" onClick={p.onNext}>Next scenario</Button>}
          </div>
        </motion.div>
      )}
      {phase === "next-running" && (p.live ?? <div className="pg-card-wait">Watch the stage…</div>)}
    </div>
  );
}
