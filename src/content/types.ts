/**
 * Course content schema. Content files (src/content/chNN.ts) export one `Chapter` as default.
 * Text fields use "lite markdown": **bold**, *italic*, `code`, "- " bullet lines, blank line = new paragraph,
 * and [[glossary term]] (or [[shown text|glossary term]]) to link a glossary entry.
 */
import type { WidgetId } from "@/widgets/ids";

export type PartId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Chapter {
  n: number;            // 0..19, same numbering as the book
  title: string;        // e.g. "Inside a CDN: PoPs, Edge Servers and Caches"
  short: string;        // 1-3 word name for tight UI, e.g. "Inside a CDN"
  part: PartId;
  hook: string;         // one sentence teaser
  lessons: Lesson[];    // 4-8 lessons (chapter 0: 1-2)
  sources: string[];    // the book chapter's Sources list, one string per source (title + url as plain text)
}

export interface Lesson {
  id: string;           // "ch05-l3" (unique, stable)
  title: string;        // short, friendly: "Why one PoP is many caches"
  goal: string;         // one sentence: what the reader can do after this lesson
  minutes: number;      // estimated 5-12
  steps: Step[];        // 10-22 steps
}

export type CalloutType = "staff" | "mistake" | "industry" | "crunchyroll";
export interface Callout { type: CalloutType; text: string }

export type Step =
  | ReadStep
  | QuizStep
  | MultiStep
  | NumberStep
  | OrderStep
  | MatchStep
  | RevealStep
  | WidgetStep
  | SummaryStep;

/** One idea. body <= ~90 words. Optional visual shown above or beside the text. */
export interface ReadStep {
  kind: "read";
  title?: string;
  body: string;
  visual?: Visual;
  callout?: Callout;
}

/** Single-answer multiple choice. 2-4 options. */
export interface QuizStep {
  kind: "quiz";
  prompt: string;
  visual?: Visual;
  options: string[];
  answer: number;       // index into options
  explain: string;      // shown after answering, right or wrong
  hint?: string;        // shown after a first miss (optional)
}

/** Select all that apply. */
export interface MultiStep {
  kind: "multi";
  prompt: string;
  visual?: Visual;
  options: string[];
  answers: number[];
  explain: string;
  hint?: string;
}

/** Back-of-envelope numeric answer. */
export interface NumberStep {
  kind: "number";
  prompt: string;
  visual?: Visual;
  answer: number;
  tolerance: number;    // absolute tolerance, e.g. answer 400, tolerance 40
  unit?: string;        // shown next to the input, e.g. "Gbps"
  hint?: string;
  explain: string;      // show the working
}

/** Put items in the correct order. `items` is the CORRECT order; the UI shuffles it. 3-6 items. */
export interface OrderStep {
  kind: "order";
  prompt: string;
  items: string[];
  explain: string;
  hint?: string;
}

/** Match left to right. `pairs` are the correct pairs; the UI shuffles the right side. 3-5 pairs. */
export interface MatchStep {
  kind: "match";
  prompt: string;
  pairs: [string, string][];
  explain: string;
}

/** Think first, then tap to reveal. Good for design-review questions. */
export interface RevealStep {
  kind: "reveal";
  prompt: string;
  visual?: Visual;
  answer: string;
}

/** An interactive simulation. `task` tells the reader what to try. */
export interface WidgetStep {
  kind: "widget";
  widget: WidgetId;
  title?: string;
  task: string;          // e.g. "Turn request collapsing off and press Premiere. Watch the origin."
  props?: Record<string, unknown>;
}

export interface SummaryStep {
  kind: "summary";
  title?: string;
  points: string[];      // 3-6 bullets
}

/* ---------------- Visuals ---------------- */

export type Visual =
  | { kind: "flow"; spec: FlowSpec; caption?: string }
  | { kind: "sequence"; spec: SequenceSpec; caption?: string }
  | { kind: "table"; headers: string[]; rows: string[][]; caption?: string }
  | { kind: "code"; lang: string; code: string; caption?: string }
  | { kind: "stats"; items: { value: string; label: string; note?: string }[]; caption?: string }
  | { kind: "compare"; left: { title: string; points: string[] }; right: { title: string; points: string[] }; caption?: string };

export type NodeKind =
  | "viewer" | "device" | "player" | "dns" | "resolver" | "steering" | "api" | "service"
  | "cdn" | "pop" | "edge" | "shield" | "origin" | "storage" | "packager" | "encoder"
  | "drm" | "isp" | "ix" | "cloud" | "region" | "monitor" | "database" | "queue"
  | "router" | "loadbalancer" | "cache" | "firewall" | "studio" | "generic";

export type Tone = "neutral" | "good" | "bad" | "warn" | "accent";

/**
 * A node-and-arrow diagram on a small grid. col 0..5, row 0..7.
 * Build ideas up across consecutive steps by repeating the SAME spec with a different `focus`/`flow`,
 * instead of one big merged diagram.
 */
export interface FlowSpec {
  nodes: FlowNode[];
  edges: FlowEdge[];
  groups?: { id: string; label: string; nodes: string[]; tone?: Tone }[];
  /** ids of nodes and edge keys ("a>b") to highlight; everything else is dimmed. Omit = nothing dimmed. */
  focus?: string[];
  /** ordered edge keys ("a>b") along which an animated packet travels. */
  flow?: string[];
  direction?: "down" | "right"; // reading direction hint, default "right"
}
export interface FlowNode {
  id: string;
  label: string;        // <= 18 chars ideally
  sub?: string;         // small second line, <= 26 chars
  kind?: NodeKind;
  col: number;
  row: number;
  tone?: Tone;
  badge?: string;       // tiny pill, e.g. "HIT", "MISS", "404", "x32"
}
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;       // <= 16 chars
  dashed?: boolean;
  tone?: Tone;
  both?: boolean;       // arrowheads on both ends
}

/** A step-by-step message exchange. `upTo` shows messages[0..upTo] (inclusive); omit = all. */
export interface SequenceSpec {
  actors: { id: string; label: string; kind?: NodeKind }[];
  messages: { from: string; to: string; label: string; note?: string; tone?: Tone; dashed?: boolean }[];
  upTo?: number;
}

/* ---------------- Course meta ---------------- */
export interface PartMeta { id: PartId; name: string; blurb: string }
export interface GlossaryEntry { term: string; def: string }
