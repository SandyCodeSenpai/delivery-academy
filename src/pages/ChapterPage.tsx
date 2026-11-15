import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Button, Icon, ProgressBar } from "@/ui";
import { useProgress } from "@/state/progress";
import { go } from "@/lib/router";
import { useReducedMotion } from "@/lib/hooks";
import { COURSE, chapterByN, chapterDone, continueTarget, fmtMinutes, isDone, labsFor, lessonHref, minutesOf, partColor, partMeta, plain, plural } from "./course";
import { BackLink, LabCard, Linkify, fadeUp } from "./common";

export default function ChapterPage({ n }: { n: number }) {
  const p = useProgress();
  const reduce = useReducedMotion();
  const ch = chapterByN(n);
  if (!ch) {
    return (
      <div className="page narrow">
        <BackLink href="#course">Course</BackLink>
        <div className="ui-empty"><strong>Chapter {n} does not exist</strong>The course has chapters 0 to {COURSE.length - 1}.</div>
      </div>
    );
  }
  const color = partColor(ch.part);
  const part = partMeta(ch.part);
  const labs = labsFor(n);
  const done = chapterDone(p, ch);
  const total = ch.lessons.length;
  const cont = continueTarget(p);
  // The one Start button on the page: resume target if it is in this chapter, else the first undone lesson here.
  const nextIdx = cont && cont.f.ch.n === n ? cont.f.idx : ch.lessons.findIndex((l) => !isDone(p, l)) + 1;
  const prev = chapterByN(n - 1), next = chapterByN(n + 1);

  return (
    <div className="page chapter" style={{ "--pc": color } as CSSProperties}>
      <BackLink href="#course">Course</BackLink>
      <motion.header className="ch-head" {...fadeUp(reduce)}>
        <div className="pg-eyebrow"><span className="pg-dot" style={{ background: color }} />{ch.part === 0 ? "Start here" : `Part ${ch.part} · ${part?.name ?? ""}`}</div>
        <div className="ch-num" aria-hidden="true">{String(ch.n).padStart(2, "0")}</div>
        <h1 className="pg-title">{plain(ch.title)}</h1>
        {ch.hook && <p className="ch-hook">{plain(ch.hook)}</p>}
        <div className="ch-meta">
          <span>{total ? plural(total, "lesson") : "Lessons coming soon"}</span>
          {total > 0 && <><span className="dotsep" aria-hidden="true" /><span>{fmtMinutes(minutesOf(ch))}</span></>}
          {labs.length > 0 && <><span className="dotsep" aria-hidden="true" /><span>{plural(labs.length, "lab")}</span></>}
        </div>
        {total > 0 && (
          <div className="ch-progress">
            <ProgressBar value={done / total} color={color} label={`${done} of ${total} lessons done`} />
            <span className="tnum">{done} of {total} done</span>
          </div>
        )}
        {total > 0 && nextIdx > 0 && (
          <div className="ch-cta">
            <Button variant="primary" size="l" onClick={() => go(lessonHref(n, nextIdx).slice(1))}>
              {done === 0 ? "Start the chapter" : "Continue"}<Icon name="arrow-right" size={18} stroke={2.2} />
            </Button>
          </div>
        )}
      </motion.header>

      <section className="ch-sec" aria-labelledby="lessons-h">
        <h2 id="lessons-h" className="sec-title sm">Lessons</h2>
        {total === 0 ? (
          <div className="soon-card">
            <span className="soon-ico"><Icon name="clock" size={22} /></span>
            <div><strong>Coming soon</strong><p>The lessons for this chapter are being written.{labs.length ? " You can already try its labs below." : ""}</p></div>
          </div>
        ) : (
          <ol className="lesson-list">
            {ch.lessons.map((l, i) => {
              const d = isDone(p, l);
              const isNext = i + 1 === nextIdx;
              return (
                <li key={l.id}>
                  <a href={lessonHref(n, i + 1)} className={`lrow${isNext ? " next" : ""}${d ? " done" : ""}`}>
                    <span className="lstat" aria-hidden="true">{d ? <Icon name="check" size={16} stroke={3} /> : <span className="tnum">{i + 1}</span>}</span>
                    <span className="lbody">
                      <span className="ltitle">{plain(l.title)}</span>
                      {l.goal && <span className="lgoal">{plain(l.goal)}</span>}
                    </span>
                    <span className="lside">
                      {isNext ? <span className="lstart">{d ? "Replay" : "Start"}<Icon name="chevron-right" size={16} stroke={2.2} /></span> : <span className="lmin tnum">{l.minutes} min</span>}
                    </span>
                    <span className="sr-only">{d ? "Done." : isNext ? "Next lesson." : ""}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {labs.length > 0 && (
        <section className="ch-sec" aria-labelledby="labs-h2">
          <h2 id="labs-h2" className="sec-title sm">Labs in this chapter</h2>
          <div className="lab-grid">{labs.map((w) => <LabCard key={w.id} w={w} done={!!p.widgets?.[w.id]} hideChapter />)}</div>
        </section>
      )}

      {ch.sources.length > 0 && (
        <section className="ch-sec">
          <details className="sources">
            <summary><span>Sources</span><span className="sources-n tnum">{ch.sources.length}</span><Icon name="chevron-down" size={18} stroke={2} className="sources-chev" /></summary>
            <ol>{ch.sources.map((s, i) => <li key={i}><Linkify text={s} /></li>)}</ol>
          </details>
        </section>
      )}

      <nav className="ch-nav" aria-label="Chapters">
        {prev ? <a href={`#ch${prev.n}`} className="ch-nav-a"><span className="ch-nav-k"><Icon name="chevron-left" size={15} stroke={2.2} />Previous</span><span className="ch-nav-t">{plain(prev.short || prev.title)}</span></a> : <span />}
        {next ? <a href={`#ch${next.n}`} className="ch-nav-a r"><span className="ch-nav-k">Next<Icon name="chevron-right" size={15} stroke={2.2} /></span><span className="ch-nav-t">{plain(next.short || next.title)}</span></a> : <span />}
      </nav>
    </div>
  );
}
