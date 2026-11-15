/** Route #chN-L: loads the chapter content and runs the lesson player. Chapter 99 is the player test bench. */
import { useEffect, useState } from "react";
import type { Chapter } from "@/content/types";
import LessonPlayer from "@/player/LessonPlayer";
import "@/player/player.css";

type Loaded = { chapter: Chapter; all: Chapter[] } | "missing" | null;

export default function LessonPage({ chapter, lesson }: { chapter: number; lesson: number }) {
  const [data, setData] = useState<Loaded>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    const load = chapter === 99
      ? import("@/player/fixture").then((m) => ({ chapter: m.default, all: [m.default] }))
      : import("@/content").then((m) => {
          const ch = m.CHAPTERS.find((c) => c.n === chapter);
          return ch ? { chapter: ch, all: m.CHAPTERS } : null;
        });
    load.then((d) => { if (alive) setData(d ?? "missing"); }).catch(() => { if (alive) setData("missing"); });
    return () => { alive = false; };
  }, [chapter]);

  const ch = data && data !== "missing" ? data.chapter : null;
  const ls = ch?.lessons[lesson - 1];

  useEffect(() => {
    if (ch && ls) document.title = `${ls.title} · Delivery Academy`;
  }, [ch, ls]);

  if (data === null) return <div className="lp-page-msg" aria-busy="true"><div className="lp-page-spinner" aria-label="Loading lesson" /></div>;

  if (!ch || !ls || !ls.steps.length) {
    const back = ch ? `ch${ch.n}` : "home";
    return (
      <div className="lp-page-msg">
        <div className="lp-page-card">
          <div className="lp-eyebrow">{ch ? `Chapter ${ch.n}` : "Not found"}</div>
          <h1>This lesson is not ready yet</h1>
          <p>{ch ? `"${ch.short}" does not have a lesson ${lesson} yet. The content is still being written.` : `There is no chapter ${chapter}.`}</p>
          <a className="lp-page-back" href={`#${back}`}>{ch ? `Back to ${ch.short}` : "Back to home"}</a>
        </div>
      </div>
    );
  }

  // Next lesson: the next one in this chapter, else the first lesson of the next chapter that has lessons.
  let nextHref: string | undefined;
  if (lesson < ch.lessons.length) nextHref = `ch${ch.n}-${lesson + 1}`;
  else if (data && data !== "missing") {
    const after = data.all.filter((c) => c.n > ch.n && c.lessons.length).sort((a, b) => a.n - b.n)[0];
    if (after) nextHref = `ch${after.n}-1`;
  }

  return <LessonPlayer key={ls.id} chapter={ch} lesson={ls} lessonNumber={lesson} nextHref={nextHref} backHref={ch.n === 99 ? "home" : `ch${ch.n}`} />;
}
