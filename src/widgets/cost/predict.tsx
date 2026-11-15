import { useState } from "react";
import { Button, Chip } from "@/ui";
import { fmtMoney } from "@/lib/format";
import { compute, BOOK_STATE, CHALLENGE_STATE, type State } from "./model";

interface Option { id: string; label: string }
interface Question {
  id: string; setup: "book" | "challenge"; prompt: string; options: Option[];
  /** Answer computed from the model, never hard-coded. */
  solve: () => { correct: string; explain: string };
}

const SETUP: Record<Question["setup"], { state: State; label: string }> = {
  book: { state: BOOK_STATE, label: "Book setup: list, 2026, S3 to CloudFront" },
  challenge: { state: CHALLENGE_STATE, label: "Challenge setup: survey rate, S3 to another CDN, JIT" },
};

function hitVsAv1(s: State) {
  const base = compute(s).total;
  const hit = base - compute({ ...s, hit: Math.min(0.995, s.hit + 0.03) }).total;
  const av1 = base - compute({ ...s, av1: 30 }).total;
  const near = Math.abs(hit - av1) <= 0.1 * Math.max(hit, av1);
  const correct = near ? "same" : hit > av1 ? "hit" : "av1";
  return { hit, av1, correct };
}

const QUESTIONS: Question[] = [
  {
    id: "q1", setup: "book",
    prompt: "Which saves more each month: +3 points of edge hit ratio (95% to 98%), or moving 30% of viewing from H.264 to AV1?",
    options: [{ id: "hit", label: "+3 points of hit ratio" }, { id: "av1", label: "30% of viewing on AV1" }, { id: "same", label: "About the same" }],
    solve: () => {
      const r = hitVsAv1(BOOK_STATE);
      return { correct: r.correct, explain: `The model says: hit ratio saves ${fmtMoney(r.hit)}, AV1 saves ${fmtMoney(r.av1)}. Fills from S3 to CloudFront are free, so a better hit ratio only trims shield request fees. AV1 removes bytes from the biggest line, CDN delivery.` };
    },
  },
  {
    id: "q2", setup: "challenge",
    prompt: "Same question, new setup: another CDN pulls from S3 (paid egress), packaging is managed JIT, and the hit ratio is 90%. +3 points of hit ratio, or 30% of viewing on AV1?",
    options: [{ id: "hit", label: "+3 points of hit ratio" }, { id: "av1", label: "30% of viewing on AV1" }, { id: "same", label: "About the same" }],
    solve: () => {
      const r = hitVsAv1(CHALLENGE_STATE);
      return { correct: r.correct, explain: `The model says: hit ratio saves ${fmtMoney(r.hit)}, AV1 saves ${fmtMoney(r.av1)}. At a survey rate, delivery bytes are cheap, but every origin fill pays S3 egress plus the JIT fee. The best lever depends on the shape of the bill.` };
    },
  },
  {
    id: "q3", setup: "challenge",
    prompt: "Managed JIT stores one copy instead of HLS plus DASH. In this setup, how does the JIT fee compare with the storage it saves?",
    options: [{ id: "less", label: "The fee is smaller" }, { id: "same", label: "About the same" }, { id: "more", label: "The fee is over 20 times larger" }],
    solve: () => {
      const jit = compute(CHALLENGE_STATE);
      const two = compute({ ...CHALLENGE_STATE, packaging: "hlsdash" });
      const saved = two.storage - jit.storage;
      const ratio = jit.packaging / Math.max(1, saved);
      const correct = ratio > 20 ? "more" : ratio > 0.7 ? "same" : "less";
      return { correct, explain: `The model says: JIT fee ${fmtMoney(jit.packaging)} a month, storage saved ${fmtMoney(saved)}. That is about ${Math.round(ratio)} times. Storage is a small line; per-GB fees on fills are not.` };
    },
  },
  {
    id: "q4", setup: "book",
    prompt: "North America is 45% of delivered bytes. At list prices, what share of the CDN byte cost is it?",
    options: [{ id: "30", label: "About 30%" }, { id: "45", label: "About 45%" }, { id: "60", label: "About 60%" }],
    solve: () => {
      const b = compute(BOOK_STATE);
      const na = b.regions.find((r) => r.id === "na")!;
      const share = na.cost / b.regions.reduce((a, r) => a + r.cost, 0);
      const pick = [30, 45, 60].reduce((best, v) => (Math.abs(v - share * 100) < Math.abs(best - share * 100) ? v : best), 30);
      return { correct: String(pick), explain: `The model says ${Math.round(share * 100)}%. North America pays $0.020 per GB at the top tier; Latin America pays 2x, APAC and India 3x to 4x (list, 2026).` };
    },
  },
];

export function Predict({ onLoad }: { onLoad: (s: State) => void }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const q = QUESTIONS[i];
  const res = shown ? q.solve() : null;
  const go = (n: number) => { setI(n); setPick(null); setShown(false); };
  return (
    <section className="cb-card" aria-labelledby="cb-predict-h">
      <div className="cb-card-head">
        <h3 id="cb-predict-h" className="cb-h">Predict, then check</h3>
        <div className="cb-dots" aria-label={`Question ${i + 1} of ${QUESTIONS.length}`}>
          {QUESTIONS.map((x, k) => <button key={x.id} type="button" className={k === i ? "on" : ""} aria-label={`Question ${k + 1}`} onClick={() => go(k)} />)}
        </div>
      </div>
      <Chip>{SETUP[q.setup].label}</Chip>
      <p className="cb-q">{q.prompt}</p>
      <div className="cb-opts" role="radiogroup" aria-label="Your prediction">
        {q.options.map((o) => {
          const state = res ? (o.id === res.correct ? "right" : o.id === pick ? "wrong" : "") : o.id === pick ? "picked" : "";
          return <button key={o.id} type="button" role="radio" aria-checked={pick === o.id} disabled={shown}
            className={`cb-opt ${state}`} onClick={() => setPick(o.id)}>{o.label}</button>;
        })}
      </div>
      {res && (
        <div className={`cb-verdict ${pick === res.correct ? "good" : "bad"}`} role="status">
          <strong>{pick === res.correct ? "Correct" : "Not quite"}</strong>
          <p>{res.explain}</p>
        </div>
      )}
      <div className="cb-row-end">
        {!shown && <Button variant="primary" size="s" disabled={!pick} onClick={() => setShown(true)}>Check</Button>}
        {shown && <Button size="s" onClick={() => onLoad(SETUP[q.setup].state)}>Load this setup</Button>}
        {shown && i < QUESTIONS.length - 1 && <Button variant="primary" size="s" onClick={() => go(i + 1)}>Next question</Button>}
      </div>
    </section>
  );
}
