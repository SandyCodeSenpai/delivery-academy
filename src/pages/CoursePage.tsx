import type { CSSProperties } from "react";
import { Icon, Ring } from "@/ui";
import { useProgress } from "@/state/progress";
import { ALL_LESSONS, COURSE, PART_LIST, chapterDone, fmtMinutes, labsFor, minutesOf, partColor, plain, plural } from "./course";
import { PageHead } from "./common";

export default function CoursePage() {
  const p = useProgress();
  const total = ALL_LESSONS.length;
  const done = ALL_LESSONS.filter((f) => p.done?.[f.lesson.id]).length;
  const mins = COURSE.reduce((a, c) => a + minutesOf(c), 0);
  return (
    <div className="page course">
      <PageHead eyebrow="CDN and media delivery" title="The course"
        sub={`${plural(COURSE.length, "chapter")} in six parts${total ? `, ${plural(total, "lesson")}, about ${fmtMinutes(mins)}` : ""}. From one press of Play to designing delivery for two million viewers.`}>
        {total > 0 && <div className="course-prog"><span className="tnum">{done} of {total}</span> lessons done</div>}
      </PageHead>
      {PART_LIST.map((part) => {
        const chs = COURSE.filter((c) => c.part === part.id);
        if (!chs.length) return null;
        return (
          <section key={part.id} className="course-part" style={{ "--pc": partColor(part.id) } as CSSProperties} aria-labelledby={`cp-${part.id}`}>
            <div className="course-part-head">
              <div className="pg-eyebrow"><span className="pg-dot" />{part.id === 0 ? "Start here" : `Part ${part.id}`}</div>
              <h2 id={`cp-${part.id}`} className="sec-title">{part.id === 0 ? "How this course works" : part.name}</h2>
              <p className="sec-sub">{part.blurb}</p>
            </div>
            <div className="ch-grid">
              {chs.map((c) => {
                const d = chapterDone(p, c), n = c.lessons.length, labs = labsFor(c.n).length;
                return (
                  <a key={c.n} href={`#ch${c.n}`} className="ch-card">
                    <div className="ch-card-top">
                      <span className="ch-card-n">{String(c.n).padStart(2, "0")}</span>
                      {n > 0 ? <Ring value={d / n} size={30} stroke={3.5} color="var(--pc)" label={`${d} of ${n} lessons done`}>{d === n ? <Icon name="check" size={13} stroke={3} style={{ color: "var(--pc)" }} /> : null}</Ring> : <span className="ch-card-soon">Soon</span>}
                    </div>
                    <h3 className="ch-card-title">{plain(c.title)}</h3>
                    {c.hook && <p className="ch-card-hook">{plain(c.hook)}</p>}
                    <div className="ch-card-meta">
                      {n ? <span>{plural(n, "lesson")} · {fmtMinutes(minutesOf(c))}</span> : <span>Lessons coming soon</span>}
                      {labs > 0 && <span className="ch-card-lab"><Icon name="flask" size={14} stroke={2} />{labs}</span>}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
