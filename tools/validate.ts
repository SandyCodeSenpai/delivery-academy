// Validate all course content: bun tools/validate.ts
import { CHAPTERS } from "../src/content";
import { WIDGETS } from "../src/widgets/registry";
let errs = 0, warns = 0, steps = 0, inter = 0, lessons = 0;
const ids = new Set<string>();
const err = (m: string) => { errs++; console.log("ERR ", m); };
const warn = (m: string) => { warns++; if (process.env.V) console.log("warn", m); };
for (const c of CHAPTERS) {
  if (!c.lessons.length) err(`ch${c.n}: no lessons`);
  for (const l of c.lessons) {
    lessons++;
    if (ids.has(l.id)) err(`dup lesson id ${l.id}`); ids.add(l.id);
    // Teach-first rules (checkpoint lessons are exempt from the pacing rules)
    const scored = (s: any) => ["quiz", "multi", "number", "order", "match"].includes(s.kind) && !s.guess;
    const isCheckpoint = /checkpoint/i.test(l.title);
    if (l.steps[0]?.kind !== "read") err(`${l.id}: first step must be a read step (teach first)`);
    const guesses = l.steps.filter((s: any) => s.guess).length;
    if (guesses > 1) err(`${l.id}: ${guesses} guess steps (max 1)`);
    const firstRead = l.steps.findIndex((s) => s.kind === "read");
    l.steps.slice(0, firstRead).forEach((s, i) => { if (scored(s)) err(`${l.id} step ${i + 1}: scored question before any teaching`); });
    if (!isCheckpoint) {
      let run = 0;
      l.steps.forEach((s, i) => { run = scored(s) ? run + 1 : 0; if (run > 2) err(`${l.id} step ${i + 1}: more than 2 scored questions in a row`); });
      const sc = l.steps.filter(scored).length, rd = l.steps.filter((s) => s.kind === "read").length;
      if (sc > Math.ceil(rd / 2) + 1) err(`${l.id}: ${sc} scored questions for ${rd} read steps (max about 1 per 2)`);
    }
    l.steps.forEach((s: any, i) => { if (scored(s) && !s.teach) warn(`${l.id} step ${i + 1}: scored question without teach`); });
    l.steps.forEach((s, i) => {
      steps++; const at = `${l.id} step ${i + 1} (${s.kind})`;
      if (!["read", "summary"].includes(s.kind)) inter++;
      if (s.kind === "quiz" && (s.answer < 0 || s.answer >= s.options.length)) err(`${at}: answer out of range`);
      if (s.kind === "multi" && s.answers.some((a) => a < 0 || a >= s.options.length)) err(`${at}: answers out of range`);
      if (s.kind === "number" && !(s.tolerance > 0)) err(`${at}: tolerance`);
      if (s.kind === "order" && s.items.length < 3) err(`${at}: order <3`);
      if (s.kind === "match" && s.pairs.length < 3) err(`${at}: match <3`);
      if (s.kind === "widget" && !(s.widget in WIDGETS)) err(`${at}: unknown widget ${s.widget}`);
      const v = (s as any).visual;
      if (v?.kind === "flow") {
        const nodes = new Set(v.spec.nodes.map((n: any) => n.id));
        const edges = new Set(v.spec.edges.map((e: any) => `${e.from}>${e.to}`));
        v.spec.edges.forEach((e: any) => { if (!nodes.has(e.from) || !nodes.has(e.to)) err(`${at}: edge ${e.from}>${e.to} bad node`); });
        [...(v.spec.focus ?? []), ...(v.spec.flow ?? [])].forEach((k: string) => {
          if (!nodes.has(k) && !edges.has(k) && !edges.has(k.split(">").reverse().join(">"))) err(`${at}: focus/flow key ${k} missing`);
        });
        if (v.spec.nodes.length > 12) warn(`${at}: ${v.spec.nodes.length} nodes`);
      }
      if (s.kind === "read" && s.body.split(/\s+/).length > 100) warn(`${at}: ${s.body.split(/\s+/).length} words`);
    });
  }
}
console.log(`chapters ${CHAPTERS.length} lessons ${lessons} steps ${steps} interactive ${(100 * inter / steps).toFixed(1)}% errors ${errs} warnings ${warns}`);
process.exit(errs ? 1 : 0);
