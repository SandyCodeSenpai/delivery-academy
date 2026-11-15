import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { useProgress } from "@/state/progress";
import { WIDGET_LIST } from "@/widgets/registry";
import { useReducedMotion } from "@/lib/hooks";
import { chapterByN, partColor, plain } from "./course";
import { LabCard, PageHead, fadeUp } from "./common";
import { PlaygroundCard } from "./Home";

export default function LabsPage() {
  const p = useProgress();
  const reduce = useReducedMotion();
  const labs = WIDGET_LIST.filter((w) => w.id !== "playground");
  const chapters = [...new Set(labs.map((w) => w.chapter))].sort((a, b) => a - b);
  const doneCount = WIDGET_LIST.filter((w) => p.widgets?.[w.id]).length;
  return (
    <div className="page labs">
      <PageHead eyebrow={`${WIDGET_LIST.length} simulations · ${doneCount} done`} title="Labs" sub="Real simulations of the systems in the course. Change one thing, watch what happens, and build the intuition a staff engineer uses in design reviews." />
      <motion.div {...fadeUp(reduce)}><PlaygroundCard wide /></motion.div>
      {chapters.map((n) => {
        const ch = chapterByN(n);
        return (
          <section key={n} className="labs-group" style={{ "--pc": partColor(ch?.part ?? 0) } as CSSProperties} aria-labelledby={`lg-${n}`}>
            <div className="labs-group-head">
              <span className="pg-dot" />
              <h2 id={`lg-${n}`} className="labs-group-title">Chapter {n}{ch ? ` · ${plain(ch.short || ch.title)}` : ""}</h2>
              {ch && <a href={`#ch${n}`} className="labs-group-link">Open the chapter</a>}
            </div>
            <div className="lab-grid">{labs.filter((w) => w.chapter === n).map((w) => <LabCard key={w.id} w={w} done={!!p.widgets?.[w.id]} hideChapter />)}</div>
          </section>
        );
      })}
    </div>
  );
}
