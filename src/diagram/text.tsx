/* Text helpers for the diagram engine: measuring, wrapping and a tiny inline-markdown renderer. */
import { Fragment, type ReactNode } from "react";

let ctx: CanvasRenderingContext2D | null | undefined;
let family = "";
const cache = new Map<string, number>();

function getCtx() {
  if (ctx === undefined) {
    try { ctx = document.createElement("canvas").getContext("2d"); } catch { ctx = null; }
  }
  if (!family && typeof document !== "undefined") {
    const css = getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim();
    family = css || getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  }
  return ctx;
}

/** Width in px of a single line of text. Slightly generous so rendering never overflows the measurement. */
export function measure(text: string, size: number, weight = 400, mono = false): number {
  const key = `${mono ? "m" : ""}${weight}|${size}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = getCtx();
  let w: number;
  if (!c) w = text.length * size * (mono ? 0.62 : 0.56);
  else {
    c.font = `${weight} ${size}px ${mono ? "ui-monospace, Menlo, monospace" : family}`;
    w = c.measureText(text).width * 1.04 + 1;
  }
  cache.set(key, w);
  return w;
}

/** Greedy word wrap into at most `maxLines` lines; the last line gets an ellipsis if text remains. */
export function wrap(text: string, maxW: number, size: number, weight = 400, maxLines = 2, breakWords = true): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = "";
  const fits = (s: string) => measure(s, size, weight) <= maxW;
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (fits(next)) { cur = next; continue; }
    if (cur) { lines.push(cur); cur = ""; }
    // a single word wider than the line: truncate it (names), or hard-break it (URLs, header names)
    if (!breakWords && !fits(w)) {
      while (w.length > 1 && !fits(`${w}…`)) w = w.slice(0, -1);
      w = `${w}…`;
    }
    while (!fits(w) && w.length > 1) {
      let k = w.length - 1;
      while (k > 1 && !fits(w.slice(0, k))) k--;
      // prefer to break after a natural separator (URLs, paths, header names)
      const cut = Math.max(w.lastIndexOf("/", k - 1), w.lastIndexOf("-", k - 1), w.lastIndexOf("_", k - 1), w.lastIndexOf(".", k - 1), w.lastIndexOf("?", k - 1), w.lastIndexOf("&", k - 1));
      if (cut >= Math.floor(k / 3)) k = cut + 1;
      lines.push(w.slice(0, k));
      w = w.slice(k);
    }
    cur = w;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  let last = out[maxLines - 1];
  while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1);
  out[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, "")}…`;
  return out;
}

export const widest = (lines: string[], size: number, weight = 400) => lines.reduce((m, l) => Math.max(m, measure(l, size, weight)), 0);

/** Strip lite-markdown markers for plain-text places (node labels, aria labels). */
export function plain(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

/** Inline lite markdown: **bold**, *italic*, `code`, [[term]] / [[shown|term]]. */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\]|\*[^*\s][^*]*\*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={i++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={i++} className="dg-ic">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[[")) {
      const inner = t.slice(2, -2), shown = inner.split("|")[0];
      out.push(<span key={i++} className="dg-term">{shown}</span>);
    } else out.push(<em key={i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}
