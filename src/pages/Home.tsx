import { useRef, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Button, Icon, Ring, Segmented } from "@/ui";
import { progress, useProgress, streakOf, lessonsDoneToday } from "@/state/progress";
import { WIDGETS, WIDGET_LIST } from "@/widgets/registry";
import { go } from "@/lib/router";
import { useReducedMotion } from "@/lib/hooks";
import { ALL_LESSONS, COURSE, continueTarget, lessonHref, partColor, plain, plural } from "./course";
import { ChainArt, CountUp, LabCard, fadeUp } from "./common";
import Path from "./Path";

export default function Home() {
  const p = useProgress();
  const reduce = useReducedMotion();
  return (
    <div className="page home">
      <motion.section className="home-hero" {...fadeUp(reduce)}>
        <ContinueCard />
        <TodayCard />
      </motion.section>

      <motion.section className="home-labs" aria-labelledby="labs-h" {...fadeUp(reduce, 0.05)}>
        <PlaygroundCard />
        <LabStrip done={p.widgets ?? {}} />
      </motion.section>

      <section className="home-path" aria-labelledby="path-h">
        <div className="sec-head">
          <h2 id="path-h" className="sec-title">Your path</h2>
          <p className="sec-sub">{plural(COURSE.length, "chapter")} in six parts. Go in order, or open any lesson.</p>
        </div>
        <Path />
      </section>
    </div>
  );
}

function ContinueCard() {
  const p = useProgress();
  const t = continueTarget(p);
  const total = ALL_LESSONS.length;
  const done = ALL_LESSONS.filter((f) => p.done?.[f.lesson.id]).length;

  if (!t) {
    const finished = total > 0;
    return (
      <div className="cont-card">
        <div className="cont-body">
          <div className="pg-eyebrow">{finished ? "Course complete" : "Getting ready"}</div>
          <h2 className="cont-title">{finished ? "You finished every lesson." : "Lessons are on their way."}</h2>
          <p className="cont-meta">{finished ? "Replay a lesson, or test your ideas in the Delivery Playground." : "The chapters are being written. You can already explore the labs and the glossary."}</p>
          <div className="cont-actions">
            <Button variant="primary" size="l" onClick={() => go("lab-playground")}>Open the Playground</Button>
            <Button variant="ghost" size="l" onClick={() => go("course")}>See the course</Button>
          </div>
        </div>
      </div>
    );
  }

  const { f, step, resumed } = t;
  const color = partColor(f.ch.part);
  const steps = f.lesson.steps.length;
  const frac = resumed && steps ? Math.min(1, (step ?? 0) / steps) : 0;
  const minsLeft = Math.max(1, Math.round(f.lesson.minutes * (1 - frac)));
  const label = resumed ? "Continue" : done === 0 ? "Start" : "Up next";
  const href = lessonHref(f.ch.n, f.idx);
  return (
    <div className="cont-card" style={{ "--pc": color } as CSSProperties}>
      <div className="cont-ring" aria-hidden="true">
        <Ring value={frac} size={88} stroke={6} color={color}>
          <span className="cont-ring-n">{f.ch.n}<small>.{f.idx}</small></span>
        </Ring>
      </div>
      <div className="cont-body">
        <div className="pg-eyebrow"><span className="pg-dot" style={{ background: color }} />{label} · Chapter {f.ch.n}, lesson {f.idx}</div>
        <h2 className="cont-title">{plain(f.lesson.title)}</h2>
        <p className="cont-meta">
          {resumed && steps ? `Step ${Math.min(steps, (step ?? 0) + 1)} of ${steps} · about ${minsLeft} min left` : plain(f.lesson.goal) || `${f.lesson.minutes} min · ${plain(f.ch.short)}`}
        </p>
        <div className="cont-actions">
          <Button variant="primary" size="l" onClick={() => go(href.slice(1))}>{resumed ? "Continue" : "Start lesson"}<Icon name="arrow-right" size={18} stroke={2.2} /></Button>
          <a className="cont-chlink" href={`#ch${f.ch.n}`}>{plain(f.ch.short)}<Icon name="chevron-right" size={16} stroke={2} /></a>
        </div>
      </div>
      {total > 0 && <div className="cont-foot"><span className="tnum">{done} of {total}</span> lessons done in the course</div>}
    </div>
  );
}

const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function TodayCard() {
  const p = useProgress();
  const s = streakOf(p.days ?? []);
  const today = lessonsDoneToday(p);
  const goal = p.dailyGoal || 1;
  const met = today >= goal;
  const now = new Date();
  return (
    <div className="today-card">
      <div className="today-row">
        <div>
          <div className="today-big"><CountUp value={s.count} /><span className="today-unit">day streak</span></div>
          <div className="today-label">{s.count === 0 ? "Finish a lesson to start a streak." : s.todayDone ? "Today is done." : "Finish a lesson today to keep it."}</div>
        </div>
      </div>
      <ol className="week" aria-label="This week">
        {s.week.map((on, i) => {
          const d = new Date(now); d.setDate(now.getDate() - (6 - i));
          const isToday = i === 6;
          return (
            <li key={i} className={`wday${on ? " on" : ""}${isToday ? " today" : ""}`} aria-label={`${isToday ? "Today" : DAY_FULL[d.getDay()]}: ${on ? "lesson done" : "no lesson"}`}>
              <span className="wdot">{on && <Icon name="check" size={12} stroke={3} />}</span>
              <span className="wlet" aria-hidden="true">{DAY[d.getDay()]}</span>
            </li>
          );
        })}
      </ol>
      <div className="today-sep" />
      <div className="today-goal">
        <Ring value={Math.min(1, today / goal)} size={44} stroke={5} color={met ? "var(--good)" : "var(--accent)"} label={`${today} of ${goal} lessons today`}>
          {met ? <Icon name="check" size={18} stroke={2.6} style={{ color: "var(--good)" }} /> : <span className="today-goal-n tnum">{today}</span>}
        </Ring>
        <div className="today-goal-text">
          <div className="today-goal-title">{met ? "Daily goal done" : `${today} of ${plural(goal, "lesson")} today`}</div>
          <div className="today-xp"><Icon name="bolt" size={14} stroke={2} /><CountUp value={p.xp || 0} /> XP total</div>
        </div>
      </div>
      <Segmented label="Daily goal (lessons)" value={goal} onChange={(v) => progress.setDailyGoal(v)} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
    </div>
  );
}

export function PlaygroundCard({ wide }: { wide?: boolean }) {
  const w = WIDGETS.playground;
  const p = useProgress();
  return (
    <a href="#lab-playground" className={`play-card${wide ? " wide" : ""}`}>
      <div className="play-text">
        <div className="pg-eyebrow"><Icon name="sparkle" size={15} stroke={2} />Featured lab{p.widgets?.playground ? " · Done" : ""}</div>
        <h3 className="play-title">{w?.title ?? "Delivery Playground"}</h3>
        <p className="play-sum">{w?.summary}</p>
        <span className="play-go">Open the Playground<Icon name="arrow-right" size={17} stroke={2.2} /></span>
      </div>
      <div className="play-art"><ChainArt /></div>
    </a>
  );
}

function LabStrip({ done }: { done: Record<string, true> }) {
  const ref = useRef<HTMLDivElement>(null);
  const labs = WIDGET_LIST.filter((w) => w.id !== "playground");
  const scroll = (dir: number) => { const el = ref.current; if (el) el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.8), behavior: "smooth" }); };
  return (
    <div className="strip">
      <div className="strip-head">
        <h2 id="labs-h" className="sec-title sm">Labs</h2>
        <span className="strip-count">{labs.length + 1} simulations to play with</span>
        <div className="strip-nav">
          <button type="button" className="ui-iconbtn" aria-label="Scroll labs left" onClick={() => scroll(-1)}><Icon name="chevron-left" size={18} stroke={2} /></button>
          <button type="button" className="ui-iconbtn" aria-label="Scroll labs right" onClick={() => scroll(1)}><Icon name="chevron-right" size={18} stroke={2} /></button>
          <a href="#labs" className="strip-all">All labs</a>
        </div>
      </div>
      <div className="strip-track" ref={ref}>
        {labs.map((w) => <LabCard key={w.id} w={w} done={!!done[w.id]} compact />)}
      </div>
    </div>
  );
}

