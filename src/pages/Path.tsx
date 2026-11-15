import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Icon, Ring, Sheet, springs } from "@/ui";
import { progress as store, useProgress, type ProgressState } from "@/state/progress";
import type { Chapter } from "@/content/types";
import { go } from "@/lib/router";
import { useReducedMotion } from "@/lib/hooks";
import { COURSE, PART_LIST, chapterDone, continueTarget, isDone, labsFor, lessonHref, partColor, plain, type FlatLesson } from "./course";

const WAVE = [0, 36, 56, 36, 0, -36, -56, -36];
type NodeState = "done" | "current" | "open" | "locked";

interface Row { key: string; kind: "chapter" | "lesson" | "lab" | "soon"; ch: Chapter; off: number; idx?: number; state?: NodeState; labId?: string; title: string; minutes?: number; labDone?: boolean }

function buildUnits(p: ProgressState) {
  const cur = continueTarget(p);
  const curKey = cur ? `${cur.f.ch.n}-${cur.f.idx}` : "";
  let passedCurrent = !cur;
  return PART_LIST.map((part) => {
    const chs = COURSE.filter((c) => c.part === part.id);
    const rows: Row[] = [];
    let w = 0;
    for (const ch of chs) {
      rows.push({ key: `c${ch.n}`, kind: "chapter", ch, off: 0, title: plain(ch.short || ch.title) });
      if (ch.lessons.length === 0) rows.push({ key: `s${ch.n}`, kind: "soon", ch, off: WAVE[w++ % WAVE.length], title: "Coming soon" });
      ch.lessons.forEach((l, i) => {
        const k = `${ch.n}-${i + 1}`;
        let state: NodeState;
        if (isDone(p, l)) state = "done";
        else if (k === curKey) { state = "current"; passedCurrent = true; }
        else state = passedCurrent ? "locked" : "open";
        rows.push({ key: `l${k}`, kind: "lesson", ch, off: WAVE[w++ % WAVE.length], idx: i + 1, state, title: plain(l.title), minutes: l.minutes });
      });
      for (const lab of labsFor(ch.n)) rows.push({ key: `w${lab.id}`, kind: "lab", ch, off: WAVE[w++ % WAVE.length], labId: lab.id, title: lab.title, labDone: !!p.widgets?.[lab.id] });
    }
    const lessons = chs.reduce((a, c) => a + c.lessons.length, 0);
    const done = chs.reduce((a, c) => a + chapterDone(p, c), 0);
    return { part, chs, rows, lessons, done };
  }).filter((u) => u.chs.length > 0);
}

export default function Path() {
  const p = useProgress();
  const units = useMemo(() => buildUnits(p), [p]);
  const cur = continueTarget(p);
  const [soft, setSoft] = useState<{ target: FlatLesson | null; row: Row } | null>(null);
  const curRef = useRef<HTMLElement | null>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  // "Jump to current" pill: path on screen, current node off screen.
  useEffect(() => {
    const pathEl = pathRef.current, curEl = curRef.current;
    if (!pathEl || !curEl || typeof IntersectionObserver === "undefined") return;
    let pathIn = false, curIn = false;
    const upd = () => setShowJump(pathIn && !curIn);
    const io1 = new IntersectionObserver(([e]) => { pathIn = e.isIntersecting; upd(); }, { rootMargin: "-40% 0px -40% 0px" });
    const io2 = new IntersectionObserver(([e]) => { curIn = e.isIntersecting; upd(); });
    io1.observe(pathEl); io2.observe(curEl);
    return () => { io1.disconnect(); io2.disconnect(); };
  }, [units]);

  const jump = () => curRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });

  return (
    <div className="path-layout">
      <div className="path" ref={pathRef}>
        {units.map((u) => (
          <section key={u.part.id} className="unit" id={`unit-${u.part.id}`} style={{ "--pc": partColor(u.part.id) } as CSSProperties} aria-labelledby={`unit-h-${u.part.id}`}>
            <div className="unit-banner">
              <div className="unit-banner-text">
                <div className="unit-eyebrow"><span className="pg-dot" />{u.part.id === 0 ? "Start here" : `Part ${u.part.id}`}</div>
                <h3 id={`unit-h-${u.part.id}`} className="unit-name">{u.part.id === 0 ? "How this course works" : u.part.name}</h3>
                <p className="unit-blurb">{u.part.blurb}</p>
              </div>
              <div className="unit-prog">
                <Ring value={u.lessons ? u.done / u.lessons : 0} size={36} stroke={4} color="var(--pc)" />
                <span className="unit-count tnum">{u.lessons ? `${u.done} of ${u.lessons}` : "Soon"}</span>
              </div>
            </div>
            <div className="unit-rows">
              {u.rows.map((r) => (
                <PathRow key={r.key} r={r} curRef={r.state === "current" ? curRef : undefined}
                  onLocked={() => setSoft({ target: cur?.f ?? null, row: r })} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="path-rail" aria-label="Parts">
        <div className="rail-card">
          <div className="rail-title">Parts</div>
          {units.map((u) => (
            <a key={u.part.id} href={`#unit-${u.part.id}`} className="rail-item" style={{ "--pc": partColor(u.part.id) } as CSSProperties}
              onClick={(e) => { e.preventDefault(); document.getElementById(`unit-${u.part.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <Ring value={u.lessons ? u.done / u.lessons : 0} size={22} stroke={3} color="var(--pc)" />
              <span className="rail-name">{u.part.id === 0 ? "Start here" : u.part.name}</span>
              <span className="rail-n tnum">{u.lessons ? `${u.done}/${u.lessons}` : ""}</span>
            </a>
          ))}
        </div>
      </aside>

      <AnimatePresence>
        {showJump && (
          <motion.button type="button" className="jump-pill" onClick={jump}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={springs.snappy}>
            <Icon name="target" size={16} stroke={2} />Jump to your lesson
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={!!soft} onClose={() => setSoft(null)} label="Start this lesson" width={440}>
        {soft && (
          <div className="soft">
            <div className="soft-ico"><Icon name="lock" size={22} /></div>
            <h3 className="soft-title">{soft.row.title}</h3>
            <p className="soft-text">
              This lesson builds on earlier ones.
              {soft.target ? <> We suggest <strong>{plain(soft.target.lesson.title)}</strong> first. You can still start this one now.</> : " You can start it now."}
            </p>
            <div className="soft-actions">
              {soft.target && <Button variant="primary" size="l" block onClick={() => { const t = soft.target!; setSoft(null); go(lessonHref(t.ch.n, t.idx).slice(1)); }}>Go to the suggested lesson</Button>}
              <Button variant="secondary" size="l" block onClick={() => { const r = soft.row; setSoft(null); go(lessonHref(r.ch.n, r.idx!).slice(1)); }}>Start anyway</Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function PathRow({ r, onLocked, curRef }: { r: Row; onLocked: () => void; curRef?: React.MutableRefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const side = r.off < 0 ? "l" : "r";
  const style = { "--off": `${r.off}px` } as CSSProperties;

  if (r.kind === "chapter") {
    const done = chapterDoneCount(r.ch);
    return (
      <div className="prow prow-ch">
        <a href={`#ch${r.ch.n}`} className="pch">
          <span className="pch-n">Chapter {r.ch.n}</span>
          <span className="pch-t">{r.title}</span>
          {r.ch.lessons.length > 0 && <span className="pch-c tnum">{done}/{r.ch.lessons.length}</span>}
        </a>
      </div>
    );
  }

  if (r.kind === "soon") {
    return (
      <div className={`prow side-${side}`} style={style}>
        <span className="pnode soon" aria-hidden="true"><Icon name="clock" size={22} /></span>
        <div className="plabel"><span className="plabel-t muted">Coming soon</span><span className="plabel-m">Lessons for this chapter are being written</span></div>
      </div>
    );
  }

  if (r.kind === "lab") {
    return (
      <div className={`prow side-${side}`} style={style}>
        <a href={`#lab-${r.labId}`} className={`pnode lab${r.labDone ? " done" : ""}`} aria-label={`Lab: ${r.title}${r.labDone ? ", done" : ""}`}>
          <Icon name="flask" size={24} stroke={1.9} />
        </a>
        <div className="plabel" aria-hidden="true"><span className="plabel-k">Lab</span><span className="plabel-t">{r.title}</span></div>
      </div>
    );
  }

  const st = r.state!;
  const href = lessonHref(r.ch.n, r.idx!);
  const aria = `Lesson ${r.idx}: ${r.title}, ${r.minutes} minutes, ${st === "done" ? "done" : st === "current" ? "next" : st === "locked" ? "not yet unlocked, you can still open it" : "not started"}`;
  const inner = st === "done" ? <Icon name="check" size={26} stroke={3} /> : st === "current" ? <Icon name="play" size={24} /> : st === "locked" ? <Icon name="lock" size={20} stroke={2} /> : <span className="pnode-n">{r.idx}</span>;
  return (
    <div className={`prow side-${side}${st === "current" ? " is-current" : ""}`} style={style}>
      {st === "current" && (
        <motion.div className="pbubble" aria-hidden="true" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={reduce ? { duration: 0.15 } : springs.bouncy}>
          Start
        </motion.div>
      )}
      {st === "locked"
        ? <button type="button" className={`pnode ${st}`} aria-label={aria} onClick={onLocked}>{inner}</button>
        : <a href={href} ref={curRef as React.Ref<HTMLAnchorElement>} className={`pnode ${st}`} aria-label={aria}>{inner}</a>}
      <div className="plabel" aria-hidden="true">
        <span className={`plabel-t${st === "locked" ? " muted" : ""}`}>{r.title}</span>
        <span className="plabel-m">{r.minutes} min{st === "done" ? " · Done" : ""}</span>
      </div>
    </div>
  );
}

function chapterDoneCount(c: Chapter) {
  // Read straight from the store; rows re-render when progress changes because the parent subscribes.
  return c.lessons.filter((l) => !!progressDone()[l.id]).length;
}const progressDone = () => store.get().done ?? {};
