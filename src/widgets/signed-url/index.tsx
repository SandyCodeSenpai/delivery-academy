/**
 * Signed URL tamper lab (chapter 8; part color var(--p3)).
 *
 * Props
 * - onComplete?: () => void
 *     Called once, after the reader has tried 3 DIFFERENT tamper actions. A tamper counts when the
 *     reader has answered its predict question and the edge pipeline has finished deciding.
 *     Manual chip edits, "Send to edge" and "New URL" do not count.
 * - start?: "valid" | "expired" | "token-in-key"   (default "valid")
 *     valid         Fresh URL for a viewer in JP, clock at +02:00. The edge shows 200 HIT.
 *     expired       Same URL, clock at +15:00 (after exp at +10:00). The edge shows 410 Gone.
 *     token-in-key  "Include token in cache key" starts on: the edge shows 200 MISS and the
 *                   1,000-viewer meter collapses to a 0% hit ratio.
 * - compact?: boolean (standard WidgetProps)
 *     Layout follows the container width. In compact mode the cookie-vs-URL panel starts collapsed.
 *
 * The signature is real: first 128 bits of HMAC-SHA256(demo secret, "path|exp|geo"), via WebCrypto.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WidgetProps } from "../types";
import { Button, Card, Chip, Eyebrow, Icon, Log, Segmented, Slider, Stage, Stat, StatGrid, Toggle, springs, type LogEntry } from "@/ui";
import { fmtNum, fmtPct } from "@/lib/format";
import { useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import * as E from "./engine";
import { ANSWERS, TAMPERS, TAMPER_BY_ID, answerOf, type Answer, type Scenario, type TamperId } from "./tampers";
import "./signed-url.css";

type Start = "valid" | "expired" | "token-in-key";
interface Run { v: E.Verdict; shown: number; done: boolean; stamp: string; animate: boolean }
type Flow =
  | { phase: "pick" }
  | { phase: "predict"; id: TamperId }
  | { phase: "running"; id: TamperId; answer: Answer }
  | { phase: "reveal"; id: TamperId; answer: Answer; v: E.Verdict };

const STEP_MS = 520;
const GOAL = 3;
const stampOf = (s: Scenario, tik: boolean) => JSON.stringify([s.parts, s.nowRel, s.viewer, tik]);
const CODE_TEXT: Record<E.Verdict["code"], string> = { 200: "200 OK", 403: "403 Forbidden", 410: "410 Gone" };
const fadeOnly = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };

export default function SignedUrlLab(props: WidgetProps) {
  const { onComplete, compact } = props;
  const start: Start = props.start === "expired" || props.start === "token-in-key" ? props.start : "valid";
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWidth(rootRef) >= 900;

  const [sc, setSc] = useState<Scenario | null>(null);
  const [tokenInKey, setTokenInKey] = useState(start === "token-in-key");
  const [run, setRun] = useState<Run | null>(null);
  const [flow, setFlow] = useState<Flow>({ phase: "pick" });
  const [tried, setTried] = useState<TamperId[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [apiNote, setApiNote] = useState<{ text: string; tone: "neutral" | "warn" } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cacheCount, setCacheCount] = useState(1);

  const baseline = useRef<E.UrlParts | null>(null);
  // Other viewers already pulled this segment, so the shared (token-free) key starts warm.
  const cache = useRef(new Set<string>([E.HOST + E.BASE_PATH]));
  const timers = useRef<number[]>([]);
  const runId = useRef(0);
  const logId = useRef(0);
  const completed = useRef(false);

  const clearTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };

  async function send(s: Scenario, tik: boolean, tamper?: TamperId, instant = false) {
    clearTimers();
    const id = ++runId.current;
    let expected: string;
    try { expected = await E.hmacHex(E.SECRET, E.signedString(s.parts)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); return; }
    if (id !== runId.current) return;
    const v = E.evaluate(s.parts, { nowRel: s.nowRel, viewer: s.viewer, tokenInKey: tik, cache: cache.current }, expected);
    const stamp = stampOf(s, tik);
    const n = (v.failAt ?? E.STEP_TITLES.length - 1) + 1;
    const finish = () => {
      if (v.code === 200) { cache.current.add(v.cacheKey); setCacheCount(cache.current.size); }
      setRun({ v, shown: E.STEP_TITLES.length, done: true, stamp, animate: !instant });
      setLog((l) => [...l.slice(-7), {
        id: ++logId.current,
        tag: v.code === 200 ? `200 ${v.hit ? "HIT" : "MISS"}` : String(v.code),
        text: v.reason, tone: v.code === 200 ? "good" : "bad",
      }]);
      if (tamper) {
        setTried((t) => (t.includes(tamper) ? t : [...t, tamper]));
        setFlow((f) => (f.phase === "running" && f.id === tamper ? { phase: "reveal", id: f.id, answer: f.answer, v } : f));
      }
    };
    if (instant || reduced) { finish(); return; }
    setRun({ v, shown: 0, done: false, stamp, animate: true });
    for (let i = 1; i <= n; i++) timers.current.push(window.setTimeout(() => setRun((r) => (r ? { ...r, shown: i } : r)), i * STEP_MS));
    timers.current.push(window.setTimeout(finish, n * STEP_MS + 240));
  }

  // Meaningful default: a freshly issued URL that the edge has already checked once.
  useEffect(() => {
    let alive = true;
    E.issue(0, "JP").then((parts) => {
      if (!alive) return;
      baseline.current = parts;
      const s: Scenario = { parts, issued: parts, nowRel: start === "expired" ? 900 : 120, viewer: "JP" };
      setSc(s);
      void send(s, start === "token-in-key", undefined, true);
    }).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; clearTimers(); runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tried.length >= GOAL && !completed.current) { completed.current = true; onComplete?.(); }
  }, [tried, onComplete]);

  const cls = `su${compact ? " su-compact" : ""}${wide ? " su-is-wide" : ""}`;
  if (err) return <div className={cls} ref={rootRef}><Card className="su-msg">This lab needs WebCrypto to compute real signatures. {err}</Card></div>;
  if (!sc) return <div className={cls} ref={rootRef}><Card className="su-msg">Signing a URL</Card></div>;

  const busy = !!run && !run.done;
  const stale = !!run && run.done && run.stamp !== stampOf(sc, tokenInKey);
  const edit = (k: keyof E.UrlParts, val: string) => { setApiNote(null); setSc({ ...sc, parts: { ...sc.parts, [k]: val } }); };

  async function reissue() {
    if (!sc) return;
    if (!E.licensed(sc.viewer, sc.nowRel)) {
      setApiNote({ tone: "warn", text: `Playback API refused: ep1234 is not licensed in ${sc.viewer} at ${E.rel(sc.nowRel)} (${E.rightsLabel(sc.viewer)}). No URL was issued, so the edge never sees a request.` });
      return;
    }
    const parts = await E.issue(sc.nowRel, sc.viewer);
    setSc({ ...sc, parts, issued: parts });
    setApiNote({ tone: "neutral", text: `New URL signed at ${E.rel(sc.nowRel)} for ${sc.viewer}. It expires at ${E.rel(sc.nowRel + E.TTL)}.` });
  }

  function choose(id: TamperId, answer: Answer) {
    const base = baseline.current;
    if (!base) return;
    const s = TAMPER_BY_ID[id].apply({ parts: base, issued: base, nowRel: 120, viewer: "JP" });
    setApiNote(null);
    setSc(s);
    setFlow({ phase: "running", id, answer });
    void send(s, tokenInKey, id);
  }

  const urlCard = (
    <Card className="su-area-url">
      <div className="su-head">
        <Eyebrow dot="var(--p3)">Signed URL tamper lab</Eyebrow>
        <p className="su-lede">The playback API signed this segment URL. Can you change it and still get the bytes?</p>
      </div>
      <UrlChips parts={sc.parts} issued={sc.issued} onEdit={edit} disabled={busy} />
      <dl className="su-secret">
        <div><dt>edge secret (demo)</dt><dd><code>{E.SECRET}</code></dd></div>
        <div><dt>signed string</dt><dd><code>{E.signedString(sc.parts)}</code></dd></div>
      </dl>
      <div className="su-actions">
        <Button variant="primary" onClick={() => void send(sc, tokenInKey)} disabled={busy}>Send to edge</Button>
        <Button variant="secondary" onClick={() => void reissue()} disabled={busy}>New URL from playback API</Button>
      </div>
      {apiNote && <p className={`su-note ${apiNote.tone}`} role="status">{apiNote.text}</p>}
    </Card>
  );
  const tamperCard = (
    <Card className="su-area-tamper">
      <TamperPanel flow={flow} tried={tried} busy={busy} reduced={reduced}
        onPick={(id) => setFlow({ phase: "predict", id })}
        onCancel={() => setFlow({ phase: "pick" })}
        onAnswer={choose} />
    </Card>
  );
  const pipeCard = (
    <div className="su-area-pipe">
      <Stage className="su-stage">
        <div className="su-stage-head">
          <Eyebrow>Edge validation</Eyebrow>
          <span className="su-small su-muted">viewer {sc.viewer} · now {E.rel(sc.nowRel)}</span>
        </div>
        <Pipeline run={run} stale={stale} reduced={reduced} />
      </Stage>
    </div>
  );
  const ctrlCard = (
    <Card className="su-area-ctrl">
      <Segmented label="Viewer country (from geo-IP)" value={sc.viewer} options={E.COUNTRIES.map((c) => ({ value: c, label: c }))}
        onChange={(c) => { setApiNote(null); setSc({ ...sc, viewer: c }); }} disabled={busy} />
      <div className="su-rights">
        <span className="su-label">ep1234 licensing windows (demo)</span>
        <div className="su-rights-row">
          {E.COUNTRIES.map((c) => (
            <Chip key={c} tone={E.licensed(c, sc.nowRel) ? "good" : "bad"}>{c} {E.rightsLabel(c)}</Chip>
          ))}
        </div>
      </div>
      <Slider label="Clock (now)" value={sc.nowRel} min={0} max={E.CLOCK_MAX} step={10} disabled={busy}
        format={(v) => `${E.rel(v)} · ${E.T0 + v}`}
        hint={/^\d+$/.test(sc.parts.exp) ? `This URL expires at ${E.rel(Number(sc.parts.exp) - E.T0)}.` : "exp is not a number."}
        onChange={(v) => setSc({ ...sc, nowRel: v })} />
      <Log title="Edge log" entries={log} max={4} />
    </Card>
  );
  const cacheCard = (
    <Card className="su-area-cache">
      <Toggle label="Include token in cache key" hint={tokenInKey ? "Every viewer's URL becomes a different object." : "Token checked, then stripped from the key."}
        checked={tokenInKey} disabled={busy} onChange={setTokenInKey} />
      <HitMeter tokenInKey={tokenInKey} reduced={reduced} />
      <p className="su-small su-muted su-tight">Your edge cache holds {fmtNum(cacheCount)} {cacheCount === 1 ? "copy" : "copies"} of seg_00042 so far.</p>
    </Card>
  );
  const compareCard = (
    <Card className="su-area-compare">
      <Compare startOpen={!compact} />
    </Card>
  );

  // Wide (lab page): two independent columns so neither leaves a gap. Narrow: one ordered grid.
  return (
    <div className={cls} ref={rootRef}>
      {wide ? (
        <div className="su-wide">
          {urlCard}
          <div className="su-cols">
            <div className="su-col">{pipeCard}{cacheCard}</div>
            <div className="su-col su-col-side">{tamperCard}{ctrlCard}{compareCard}</div>
          </div>
        </div>
      ) : (
        <div className="su-layout">{urlCard}{tamperCard}{pipeCard}{ctrlCard}{cacheCard}{compareCard}</div>
      )}
    </div>
  );
}

/* ---------- URL chips ---------- */

function UrlChips({ parts, issued, onEdit, disabled }: { parts: E.UrlParts; issued: E.UrlParts; onEdit: (k: keyof E.UrlParts, v: string) => void; disabled: boolean }) {
  const fields: { k: keyof E.UrlParts; pre: string; cap: string; signed?: boolean }[] = [
    { k: "host", pre: "https://", cap: "host" },
    { k: "path", pre: "", cap: "path", signed: true },
    { k: "exp", pre: "?exp=", cap: "expiry", signed: true },
    { k: "geo", pre: "&geo=", cap: "territory", signed: true },
    { k: "sig", pre: "&sig=", cap: "signature" },
  ];
  return (
    <div className="su-url" role="group" aria-label="Segment URL. Each part is editable.">
      {fields.map((f) => {
        const v = parts[f.k];
        const edited = v !== issued[f.k];
        return (
          <label key={f.k} className={`su-part su-part-${f.k}`}>
            <span className="su-part-cap">
              {f.signed && <Icon name="lock" size={12} stroke={2} />}
              {f.cap}{f.signed ? ", signed" : ""}
              {edited && <span className="su-edited">edited</span>}
            </span>
            <span className={`su-field${edited ? " edited" : ""}`}>
              {f.pre && <span className="su-pre">{f.pre}</span>}
              <input value={v} spellCheck={false} autoComplete="off" autoCapitalize="off" disabled={disabled}
                aria-label={`${f.cap}${f.signed ? " (signed)" : ""}`}
                style={{ width: `${Math.max(2, v.length) + 0.4}ch` }}
                onChange={(e) => onEdit(f.k, e.target.value)} />
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ---------- Pipeline ---------- */

type UiStatus = "idle" | "active" | E.StepStatus;

function Pipeline({ run, stale, reduced }: { run: Run | null; stale: boolean; reduced: boolean }) {
  const status = (i: number): UiStatus => {
    if (!run) return "idle";
    if (i < run.shown) return run.v.steps[i].status;
    if (!run.done && i === run.shown) return "active";
    return "idle";
  };
  const reveal = !run?.animate ? { initial: false as const } : reduced ? fadeOnly : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, transition: springs.smooth };
  return (
    <div className={`su-pipe${stale ? " is-stale" : ""}`}>
      <ol className="su-steps">
        {E.STEP_TITLES.map((title, i) => {
          const st = status(i);
          const r = run?.v.steps[i];
          return (
            <li key={i} className={`su-step ${st}`} aria-current={st === "active" ? "step" : undefined}>
              <span className="su-dot">
                {st === "pass" ? <Icon name="check" size={16} stroke={2.4} label="passed" />
                  : st === "fail" ? <Icon name="x" size={16} stroke={2.4} label="failed" />
                  : i + 1}
              </span>
              <div className="su-step-body">
                <div className="su-step-title">{title}{st === "skip" && <span className="su-skip">not reached</span>}</div>
                {run && r && (st === "pass" || st === "fail") && (
                  <motion.div className="su-step-detail" {...reveal}>
                    <div>{r.detail}</div>
                    {i === 2 && <SigDiff expected={run.v.expected} got={run.v.got} />}
                    {i === 4 && <CacheKey k={run.v.cacheKey} />}
                    {i === 5 && <span><Chip tone={run.v.hit ? "good" : "warn"}>{run.v.hit ? "HIT" : "MISS"}</Chip></span>}
                  </motion.div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <AnimatePresence mode="wait" initial={false}>
        {run?.done ? (
          <motion.div key={`${run.stamp}-${run.v.code}`} className={`su-outcome ${run.v.code === 200 ? "ok" : "no"}`} role="status"
            {...(reduced ? fadeOnly : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: springs.smooth })}>
            <div className="su-code">{CODE_TEXT[run.v.code]}{run.v.code === 200 && <Chip tone={run.v.hit ? "good" : "warn"}>{run.v.hit ? "HIT" : "MISS"}</Chip>}</div>
            <div className="su-reason">{run.v.reason}</div>
          </motion.div>
        ) : (
          <motion.div key="wait" className="su-outcome pending" {...fadeOnly}>
            <div className="su-reason">{run ? "The edge is checking the request." : "Press Send to edge."}</div>
          </motion.div>
        )}
      </AnimatePresence>
      {stale && <p className="su-stale" role="status">The URL or settings changed after this result. Press <b>Send to edge</b> to check again.</p>}
    </div>
  );
}

function SigDiff({ expected, got }: { expected: string; got: string }) {
  const row = (label: string, s: string, other: string) => (
    <div className="su-kv">
      <span className="su-label">{label}</span>
      <code>{s.length === 0 ? "(empty)" : s.split("").map((c, i) => (c !== other[i] ? <mark key={i}>{c}</mark> : <span key={i}>{c}</span>))}</code>
    </div>
  );
  return <div className="su-sigdiff">{row("edge", expected, got)}{row("URL", got, expected)}</div>;
}

function CacheKey({ k }: { k: string }) {
  const q = k.indexOf("?");
  return (
    <div className="su-kv">
      <span className="su-label">key</span>
      <code>{q < 0 ? k : <>{k.slice(0, q)}<mark className="warn">{k.slice(q)}</mark></>}</code>
    </div>
  );
}

/* ---------- Tamper panel ---------- */

function TamperPanel({ flow, tried, busy, reduced, onPick, onCancel, onAnswer }: {
  flow: Flow; tried: TamperId[]; busy: boolean; reduced: boolean;
  onPick: (id: TamperId) => void; onCancel: () => void; onAnswer: (id: TamperId, a: Answer) => void;
}) {
  const anim = reduced ? fadeOnly : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: springs.smooth }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };
  const done = tried.length >= GOAL;
  let body: ReactNode;
  if (flow.phase === "pick") {
    body = (
      <motion.div key="pick" {...anim}>
        <p className="su-small su-muted su-tight">Each one starts from a fresh, valid URL. Predict first, then watch the edge.</p>
        <div className="su-tampers">
          {TAMPERS.map((t) => {
            const isTried = tried.includes(t.id);
            return (
              <button key={t.id} type="button" className={`su-tamper${isTried ? " tried" : ""}`} disabled={busy} onClick={() => onPick(t.id)}>
                <span className="su-tamper-label">{t.label}{isTried && <Icon name="check" size={14} stroke={2.4} label="tried" className="su-tried" />}</span>
                <span className="su-tamper-sub">{t.sub}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    );
  } else {
    const t = TAMPER_BY_ID[flow.id];
    const picked = flow.phase === "predict" ? null : flow.answer;
    const actual = flow.phase === "reveal" ? answerOf(flow.v) : null;
    const correct = actual !== null && picked === actual;
    body = (
      <motion.div key={`q-${flow.id}`} {...anim}>
        <div className="su-q-top"><span className="su-q-tag">Predict</span><span className="su-q-name">{t.label}</span></div>
        <p className="su-q">{t.question}</p>
        <div className="su-answers" role="group" aria-label="Your prediction">
          {ANSWERS.map((a) => {
            const cls = actual ? (a.id === actual ? " right" : a.id === picked ? " wrong" : " dim") : a.id === picked ? " chosen" : "";
            const shake = !reduced && actual && a.id === picked && !correct;
            return (
              <motion.button key={a.id} type="button" className={`su-answer${cls}`} disabled={flow.phase !== "predict"}
                aria-pressed={a.id === picked} onClick={() => onAnswer(flow.id, a.id)}
                animate={shake ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
                {a.label}
                {actual && a.id === actual && <Icon name="check" size={16} stroke={2.4} className="su-answer-icon" />}
              </motion.button>
            );
          })}
        </div>
        {flow.phase === "predict" && <Button variant="plain" size="s" onClick={onCancel}>Back to the list</Button>}
        {flow.phase === "running" && <p className="su-small su-muted su-tight" role="status">Sent. Watch the edge validation steps.</p>}
        {flow.phase === "reveal" && (
          <motion.div className={`su-reveal ${correct ? "ok" : "no"}`} {...(reduced ? fadeOnly : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: springs.smooth })} role="status">
            <div className="su-reveal-head">{correct ? "Correct" : "Not quite"}</div>
            <p>The edge returned {CODE_TEXT[flow.v.code]}{flow.v.failAt !== null ? ` at step ${flow.v.failAt + 1} (${E.STEP_TITLES[flow.v.failAt]})` : ""}. {t.explain}</p>
            <Button variant="secondary" size="s" onClick={onCancel}>{done ? "Try another tamper" : `Next tamper (${tried.length} of ${GOAL} done)`}</Button>
          </motion.div>
        )}
      </motion.div>
    );
  }
  return (
    <div className="su-tamper-panel">
      <div className="su-panel-head">
        <Eyebrow>Try to break it</Eyebrow>
        <span className="su-progress" role="img" aria-label={`${Math.min(tried.length, GOAL)} of ${GOAL} tamper actions tried`}>
          {Array.from({ length: GOAL }, (_, i) => <i key={i} className={i < tried.length ? "on" : ""} />)}
          <span>{done ? `${tried.length} tried` : `${tried.length} of ${GOAL}`}</span>
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>{body}</AnimatePresence>
    </div>
  );
}

/* ---------- Hit-ratio meter ---------- */

const N = 1000, COLS = 50, CELL = 6;
function HitMeter({ tokenInKey, reduced }: { tokenInKey: boolean; reduced: boolean }) {
  const [filled, setFilled] = useState(N);
  const [playing, setPlaying] = useState(false);
  const [nonce, setNonce] = useState(0);
  const f = useRef(N);
  const prev = useRef(`${tokenInKey}-${nonce}`);
  useEffect(() => {
    // The first render shows the settled state; a toggle change or Replay re-runs the 1,000 requests.
    const k = `${tokenInKey}-${nonce}`;
    if (k === prev.current) return;
    prev.current = k;
    f.current = reduced ? N : 0; setFilled(f.current); setPlaying(!reduced);
  }, [tokenInKey, reduced, nonce]);
  useRaf((dt) => {
    f.current = Math.min(N, f.current + dt * 900);
    setFilled(f.current);
    if (f.current >= N) setPlaying(false);
  }, playing);
  const count = Math.floor(filled);
  const misses = tokenInKey ? count : Math.min(count, 1);
  const hits = count - misses;
  return (
    <div className="su-meter">
      <div className="su-meter-head">
        <span className="su-label">1,000 viewers request seg_00042, each with their own token</span>
        <Button variant="tinted" size="s" onClick={() => setNonce((n) => n + 1)} disabled={playing}><Icon name="reset" size={14} />Replay</Button>
      </div>
      <svg viewBox={`0 0 ${COLS * CELL} ${(N / COLS) * CELL}`} className="su-dots" role="img"
        aria-label={`${fmtNum(hits)} hits and ${fmtNum(misses)} misses out of ${fmtNum(count)} requests`}>
        {Array.from({ length: N }, (_, i) => {
          const cls = i >= count ? "e" : tokenInKey || i === 0 ? "m" : "h";
          return <rect key={i} x={(i % COLS) * CELL + 1} y={Math.floor(i / COLS) * CELL + 1} width={CELL - 2} height={CELL - 2} rx={2} className={`su-d-${cls}`} />;
        })}
      </svg>
      <div className="su-legend"><span><i className="h" />hit, served by the edge</span><span><i className="m" />miss, fetched from the shield</span></div>
      <StatGrid>
        <Stat label="Hit ratio" value={count ? fmtPct(hits / count, 1) : "–"} tone={tokenInKey ? "bad" : "good"} />
        <Stat label="Fetches to shield" value={fmtNum(misses)} sub={`of ${fmtNum(count)} requests`} tone={tokenInKey ? "bad" : "neutral"} />
      </StatGrid>
      <p className="su-small su-muted su-tight">
        {tokenInKey
          ? "Every URL is unique, so every request misses. At an assumed 2M-viewer premiere (about 8 Tbps), almost all of that traffic flows back toward shield and origin."
          : "One miss fills the cache, and the other 999 viewers share that one copy. Rule: validate the token at the edge, then strip it from the cache key."}
      </p>
    </div>
  );
}

/* ---------- Cookie vs URL ---------- */

function Compare({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const cols: { title: string; pros: string[]; cons: string[] }[] = [
    {
      title: "Token in the URL",
      pros: ["Works with every player and every CDN.", "Easy to scope to one title's path prefix."],
      cons: ["Leaks in logs, referrers and copied links.", "Must be stripped from the cache key.", "SDKs that add query parameters after signing break it."],
    },
    {
      title: "Token in a cookie",
      pros: ["Clean URLs. One cookie covers every segment.", "CloudFront does not cache by signed-cookie values."],
      cons: ["Manifest and segments must share a domain.", "Browsers block third-party cookies.", "Native TV and console players vary."],
    },
  ];
  return (
    <div className="su-compare">
      <button type="button" className="su-disclose" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Eyebrow>Where should the token live?</Eyebrow>
        <Icon name="chevron-down" size={18} className={`su-chev${open ? " open" : ""}`} />
      </button>
      {open && (
        <>
          <div className="su-compare-grid">
            {cols.map((c) => (
              <div key={c.title} className="su-compare-col">
                <div className="su-compare-title">{c.title}</div>
                <ul>
                  {c.pros.map((p) => <li key={p} className="pro"><Icon name="check" size={14} stroke={2.2} label="Pro" />{p}</li>)}
                  {c.cons.map((p) => <li key={p} className="con"><Icon name="x" size={14} stroke={2.2} label="Con" />{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="su-small su-muted su-tight">
            Common in practice: a short-lived URL token on the first manifest, then a session token as a cookie or written into
            every segment URL (Akamai and Google Media CDN call this dual-token). Either way, the edge checks it and keeps it out of the cache key.
          </p>
        </>
      )}
    </div>
  );
}
