/**
 * Learner progress, saved in this browser only (localStorage, every access wrapped in try/catch).
 * API is a contract for pages and the lesson player.
 */
import { useSyncExternalStore } from "react";

export interface LessonResult { xp: number; accuracy: number; at: string /* ISO date */ }
export interface Resume { chapter: number; lesson: number; step: number }
export interface ProgressState {
  done: Record<string, LessonResult>;   // lessonId -> result
  xp: number;
  days: string[];                       // ISO dates (YYYY-MM-DD) with at least one finished lesson
  dailyGoal: number;                    // lessons per day: 1, 2 or 3
  resume: Resume | null;
  widgets: Record<string, true>;        // widget ids the reader completed
  missed: Record<string, number[]>;     // lessonId -> step indexes answered wrong (for review)
}

const KEY = "delivery-academy:v1";
const empty: ProgressState = { done: {}, xp: 0, days: [], dailyGoal: 1, resume: null, widgets: {}, missed: {} };
let state: ProgressState = load();
const subs = new Set<() => void>();
// Pick up changes saved by another tab so a later save here does not overwrite them.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); subs.forEach((f) => f()); } });
}

function load(): ProgressState {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty }; } catch { return { ...empty }; }
}
function save(next: ProgressState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: keep in memory */ }
  subs.forEach((f) => f());
}
const today = () => new Date().toISOString().slice(0, 10);

export const progress = {
  get: () => state,
  subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); },
  completeLesson(id: string, xp: number, accuracy: number) {
    const d = today();
    const prev = state.done[id];
    save({
      ...state,
      done: { ...state.done, [id]: { xp: Math.max(xp, prev?.xp ?? 0), accuracy: Math.max(accuracy, prev?.accuracy ?? 0), at: d } },
      xp: state.xp + (prev ? Math.round(xp / 4) : xp), // replays earn a little
      days: state.days.includes(d) ? state.days : [...state.days, d].slice(-400),
    });
  },
  setResume(r: Resume | null) { save({ ...state, resume: r }); },
  setDailyGoal(n: number) { save({ ...state, dailyGoal: Math.max(1, Math.min(3, n)) }); },
  markWidget(id: string) { if (!state.widgets[id]) save({ ...state, widgets: { ...state.widgets, [id]: true } }); },
  setMissed(lessonId: string, steps: number[]) { save({ ...state, missed: { ...state.missed, [lessonId]: steps } }); },
  reset() { save({ ...empty }); },
};

/** Current streak in days (counts back from today, or from yesterday if today not yet done). */
export function streakOf(days: string[]): { count: number; todayDone: boolean; week: boolean[] } {
  const set = new Set(days);
  const d = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const todayDone = set.has(iso(d));
  const cur = new Date(d);
  if (!todayDone) cur.setDate(cur.getDate() - 1);
  let count = 0;
  while (set.has(iso(cur))) { count++; cur.setDate(cur.getDate() - 1); }
  const week: boolean[] = [];
  for (let i = 6; i >= 0; i--) { const x = new Date(d); x.setDate(x.getDate() - i); week.push(set.has(iso(x))); }
  return { count, todayDone, week };
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(progress.subscribe, progress.get, progress.get);
}
export function lessonsDoneToday(s: ProgressState): number {
  const d = today();
  return Object.values(s.done).filter((r) => r.at === d).length;
}
