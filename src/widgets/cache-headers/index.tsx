/**
 * Cache-Control lab (widget id "cache-headers", Chapter 4).
 *
 * The reader edits the response headers the origin sends (max-age, s-maxage, stale-while-revalidate,
 * stale-if-error, no-store, private, no-cache, ETag, immutable, Vary, object type), then replays a
 * 0-60 s timeline of viewer requests through one CDN edge and sees HIT / MISS / STALE / REVALIDATE (304) /
 * STALE-IF-ERROR / ERROR per request, plus the origin load. Semantics: RFC 9111 + RFC 5861, see ./sim.ts.
 *
 * Props
 * - onComplete?: () => void
 *     Called once, when a Replay has finished for at least 2 different presets. A replay counts for the
 *     preset that was last loaded, even if the reader then tweaked headers or requests.
 * - preset?: string
 *     Preset to load first: "vod-segment" | "live-playlist" | "no-store" | "vary-ua"
 *     (the full label or short name also works, case-insensitive). Default: "live-playlist".
 * - compact?: boolean (from WidgetProps)
 *     true in lessons (~640px). false on the lab page, which adds the "browser cache vs CDN cache" view
 *     and shows every header control at once instead of in tabs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Segmented, Slider, Stage, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { fmtBytes, fmtPct } from "@/lib/format";
import { useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import type { WidgetProps } from "../types";
import {
  CLIENTS, N, OUTCOME_COLOR, OUTCOME_HELP, OUTCOME_LABEL, PRESETS, cdnPolicy, fmtDur, presetById, presetReqs, presetScenario,
  predictAnswer, simulate, type Headers, type ObjType, type Outcome, type Preset, type Req, type VaryMode,
} from "./sim";
import { Flow, SPEED, endOf, revealOf } from "./Flow";
import { Timeline } from "./Timeline";
import { Compare, HeaderBlock, PlainReading, ResultsList } from "./panels";
import "./cache-headers.css";

const AGE_OPTS = [0, 1, 2, 4, 6, 10, 30, 60, 300, 3600, 86400, 31536000];
const SMAX_OPTS: (number | null)[] = [null, ...AGE_OPTS];
const SWR_OPTS = [0, 1, 2, 4, 6, 10, 30, 60];
const SIE_OPTS = [0, 10, 30, 60, 300, 3600, 86400];
const MAX_REQS = 20;

const idx = <T,>(opts: T[], v: T) => Math.max(0, opts.indexOf(v));
type Phase = "idle" | "playing" | "done";

export default function CacheHeadersLab(props: WidgetProps) {
  const { onComplete, compact = true } = props;
  const initial = presetById(typeof props.preset === "string" ? props.preset : undefined) ?? PRESETS[1];
  const reduced = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootW = useWidth(rootRef);
  const stageW = useWidth(stageRef);

  const [presetId, setPresetId] = useState(initial.id);
  const [h, setH] = useState<Headers>(initial.headers);
  const [reqs, setReqs] = useState<Req[]>(() => presetReqs(initial));
  const [originDown, setOriginDown] = useState(initial.originDown);
  const [downFrom, setDownFrom] = useState(initial.downFrom);
  const [phase, setPhase] = useState<Phase>("idle");
  const [el, setEl] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [fb, setFb] = useState<{ answer: string; pick: string | null } | null>(null);
  const [tab, setTab] = useState<"fresh" | "store" | "key">("fresh");
  const replayed = useRef(new Set<string>());
  const fired = useRef(false);

  const preset = PRESETS.find((p) => p.id === presetId) as Preset;
  const results = useMemo(() => simulate({ headers: h, reqs, originDown, downFrom }), [h, reqs, originDown, downFrom]);
  const pol = useMemo(() => cdnPolicy(h), [h]);
  const end = useMemo(() => endOf(results), [results]);

  const edited = useMemo(() => {
    const a = JSON.stringify({ h, r: reqs.map((r) => [r.t, r.client]), originDown, downFrom });
    const p = presetScenario(preset);
    return a !== JSON.stringify({ h: p.headers, r: p.reqs.map((r) => [r.t, r.client]), originDown: p.originDown, downFrom: p.downFrom });
  }, [h, reqs, originDown, downFrom, preset]);

  /* ---- playback ---- */
  // Wall-clock based so slow frames do not stretch the replay.
  const t0 = useRef(0);
  useRaf(() => setEl((performance.now() - t0.current) / 1000), phase === "playing");

  const finish = useCallback(() => {
    setPhase("done");
    const p = PRESETS.find((x) => x.id === presetId) as Preset;
    setFb((f) => f ?? { answer: predictAnswer(p, simulate(presetScenario(p))), pick });
    replayed.current.add(presetId);
    if (!fired.current && replayed.current.size >= 2) { fired.current = true; onComplete?.(); }
  }, [presetId, pick, onComplete]);

  useEffect(() => { if (phase === "playing" && el >= end) finish(); }, [phase, el, end, finish]);

  const replay = () => {
    if (reduced) { setEl(end); finish(); return; }
    t0.current = performance.now(); setEl(0); setPhase("playing");
  };

  const clock = phase === "playing" ? Math.min(N, el * SPEED) : phase === "done" ? N : 0;
  const revealed = useMemo(() => {
    if (phase === "done") return new Set(results.map((r) => r.req.id));
    if (phase === "idle") return new Set<number>();
    return new Set(results.filter((r) => revealOf(r) <= el).map((r) => r.req.id));
  }, [phase, el, results]);
  const shown = results.filter((r) => revealed.has(r.req.id));

  /* ---- edits ---- */
  const stopIfPlaying = () => { if (phase === "playing") { setPhase("idle"); setEl(0); } };
  const editH = (patch: Partial<Headers>) => { stopIfPlaying(); setH((x) => ({ ...x, ...patch })); };

  const load = (p: Preset) => {
    setPresetId(p.id); setH(p.headers); setReqs(presetReqs(p)); setOriginDown(p.originDown); setDownFrom(p.downFrom);
    setPhase("idle"); setEl(0); setPick(null); setFb(null);
  };

  const addAt = (t: number) => {
    stopIfPlaying();
    setReqs((rs) => {
      if (rs.length >= MAX_REQS || rs.some((r) => r.t === t)) return rs;
      const id = Math.max(0, ...rs.map((r) => r.id)) + 1;
      return [...rs, { id, t, client: (id - 1) % CLIENTS.length }];
    });
  };
  const addAuto = () => {
    // Put the new request in the middle of the widest gap.
    const ts = [...reqs.map((r) => r.t)].sort((a, b) => a - b);
    const pts = [-1, ...ts, N + 1];
    let best = 0, at = 0;
    for (let i = 0; i < pts.length - 1; i++) { const g = pts[i + 1] - pts[i]; if (g > best) { best = g; at = Math.round((pts[i] + pts[i + 1]) / 2); } }
    if (best >= 2) addAt(Math.min(N, Math.max(0, at)));
  };
  const remove = (id: number) => { stopIfPlaying(); setReqs((rs) => rs.filter((r) => r.id !== id)); };

  /* ---- derived numbers ---- */
  const originReqs = shown.reduce((a, r) => a + r.originReqs, 0);
  const originFailed = shown.reduce((a, r) => a + r.originFailed, 0);
  const originBytes = shown.reduce((a, r) => a + r.originBytes, 0);
  const fromCache = shown.filter((r) => r.fromCache).length;
  const errors = shown.filter((r) => r.outcome === "ERROR").length;

  const cdnState = useMemo(() => {
    // Rebuild the CDN store at the playhead from the results (who stored or refreshed what, and when).
    const store = new Map<string, number>();
    if (phase === "idle") return { copies: 0, state: { text: "empty", tone: "" as const } };
    let lastKey: string | null = null;
    for (const r of results) {
      if (r.req.t > clock || !revealed.has(r.req.id)) continue;
      lastKey = r.key;
      const refreshed = (r.outcome === "MISS" && pol.stores) || r.outcome === "REVALIDATE" || (r.outcome === "STALE" && r.bg !== "fail");
      if (refreshed) store.set(r.key, r.req.t);
    }
    if (!pol.stores) return { copies: 0, state: { text: "pass-through", tone: "" as const } };
    const ts = lastKey !== null ? store.get(lastKey) : undefined;
    if (ts === undefined) return { copies: store.size, state: { text: "empty", tone: "" as const } };
    const age = Math.max(0, Math.floor(clock - ts));
    const fresh = age < pol.ttl;
    return { copies: store.size, state: { text: `${fresh ? "fresh" : "stale"} · age ${fmtDur(age)}`, tone: fresh ? ("good" as const) : ("warn" as const) } };
  }, [results, clock, phase, revealed, pol]);

  const wide = rootW >= 760;
  const showAll = !compact && wide;
  const playing = phase === "playing";

  /* ---- controls ---- */
  const fresh = (
    <div className="ch-group">
      <Slider label="max-age" value={idx(AGE_OPTS, h.maxAge)} min={0} max={AGE_OPTS.length - 1}
        format={(i) => fmtDur(AGE_OPTS[i])} onChange={(i) => editH({ maxAge: AGE_OPTS[i] })} hint="Every cache. Browsers use this." />
      <Slider label="s-maxage" value={idx(SMAX_OPTS, h.sMaxage)} min={0} max={SMAX_OPTS.length - 1}
        format={(i) => (SMAX_OPTS[i] === null ? "off" : fmtDur(SMAX_OPTS[i] as number))} onChange={(i) => editH({ sMaxage: SMAX_OPTS[i] })} hint="Shared caches only. Overrides max-age at the CDN." />
      <Slider label="stale-while-revalidate" value={idx(SWR_OPTS, h.swr)} min={0} max={SWR_OPTS.length - 1}
        format={(i) => (SWR_OPTS[i] ? fmtDur(SWR_OPTS[i]) : "off")} onChange={(i) => editH({ swr: SWR_OPTS[i] })} />
      <Slider label="stale-if-error" value={idx(SIE_OPTS, h.sie)} min={0} max={SIE_OPTS.length - 1}
        format={(i) => (SIE_OPTS[i] ? fmtDur(SIE_OPTS[i]) : "off")} onChange={(i) => editH({ sie: SIE_OPTS[i] })} />
    </div>
  );
  const store = (
    <div className="ch-group">
      <Toggle label="no-store" hint="Nobody may store it" checked={h.noStore} onChange={(v) => editH({ noStore: v })} />
      <Toggle label="private" hint="Browser only, never the CDN" checked={h.priv} onChange={(v) => editH({ priv: v })} />
      <Toggle label="no-cache" hint="Store, but revalidate every time" checked={h.noCache} onChange={(v) => editH({ noCache: v })} />
      <Toggle label="ETag" hint="A validator, so 304s are possible" checked={h.etag} onChange={(v) => editH({ etag: v })} />
      <Toggle label="immutable" hint="Browsers skip reload checks" checked={h.immutable} onChange={(v) => editH({ immutable: v })} />
    </div>
  );
  const key = (
    <div className="ch-group">
      <Segmented<VaryMode> label="Vary" value={h.vary} onChange={(v) => editH({ vary: v })}
        options={[{ value: "none", label: "none" }, { value: "ae", label: "Accept-Encoding" }, { value: "ua", label: "User-Agent" }]} />
      <Segmented<ObjType> label="Object" value={h.obj} onChange={(v) => editH({ obj: v })}
        options={[{ value: "segment", label: "VOD segment" }, { value: "manifest", label: "VOD manifest" }, { value: "live", label: "Live playlist" }]} />
    </div>
  );

  const controls = (
    <div className="ch-ctrl">
      <HeaderBlock h={h} />
      <PlainReading h={h} />
      {showAll ? (
        <>
          <div className="ch-group-title">Freshness</div>{fresh}
          <div className="ch-group-title">Storage</div>{store}
          <div className="ch-group-title">Cache key</div>{key}
        </>
      ) : (
        <>
          <Segmented<"fresh" | "store" | "key"> value={tab} onChange={setTab}
            options={[{ value: "fresh", label: "Freshness" }, { value: "store", label: "Storage" }, { value: "key", label: "Cache key" }]} />
          {tab === "fresh" ? fresh : tab === "store" ? store : key}
        </>
      )}
    </div>
  );

  const stage = (
    <div className="ch-group">
      <Stage>
        <div className="ch-stage-inner" ref={stageRef}>
          {stageW > 0 && (
            <>
              <Flow width={stageW} results={results} el={playing ? el : null} clock={clock} pol={pol} originDown={originDown} downFrom={downFrom}
                originCount={originReqs} originFailed={originFailed} copies={cdnState.copies} state={cdnState.state} />
              <Timeline width={stageW} results={results} revealed={revealed} phase={phase} clock={clock} originDown={originDown} downFrom={downFrom}
                onAdd={addAt} onRemove={remove} disabled={playing} el={playing ? el : null} />
            </>
          )}
          <div className="ch-tl-help">Tap the track to add a request. Tap a request to remove it. Viewers rotate through the five devices.</div>
        </div>
      </Stage>
      <div className="ch-toolbar">
        <Button variant="primary" onClick={replay} disabled={playing || reqs.length === 0}>{playing ? "Replaying" : phase === "done" ? "Replay again" : "Replay"}</Button>
        <Button size="s" onClick={addAuto} disabled={playing || reqs.length >= MAX_REQS}>Add request</Button>
        <Button size="s" variant="ghost" onClick={() => { stopIfPlaying(); setReqs(presetReqs(preset)); }} disabled={playing}>Reset requests</Button>
      </div>
      <div className="ch-toolbar">
        <Toggle label="Origin down" hint={originDown ? `from t=${downFrom} s to the end` : "origin answers every request"} checked={originDown}
          onChange={(v) => { stopIfPlaying(); setOriginDown(v); }} />
        {originDown && (
          <div className="grow">
            <Slider label="Down from" value={downFrom} min={0} max={N - 1} format={(v) => `t=${v} s`} onChange={(v) => { stopIfPlaying(); setDownFrom(v); }} />
          </div>
        )}
      </div>
      <div className="ch-legend" aria-label="Outcome legend">
        {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
          <span key={o} title={OUTCOME_HELP[o]}><i style={{ background: OUTCOME_COLOR[o] }} />{OUTCOME_LABEL[o]}{wide ? `: ${OUTCOME_HELP[o]}` : ""}</span>
        ))}
      </div>
      <StatGrid>
        <Stat label="Origin requests" value={originReqs} tone={originReqs > Math.max(1, shown.length / 2) ? "warn" : "neutral"}
          sub={originFailed ? `${originFailed} failed` : shown.length ? `for ${shown.length} viewer requests` : "none yet"} />
        <Stat label="Origin bytes" value={fmtBytes(originBytes)} sub={h.obj === "segment" ? "2.5 MB per body" : `${fmtBytes(h.obj === "live" ? 2000 : 20000)} per body`} />
        <Stat label="Body from cache" value={shown.length ? fmtPct(fromCache / shown.length) : "–"} tone={shown.length && fromCache / shown.length > 0.8 ? "good" : "neutral"} />
        <Stat label="Viewer errors" value={errors} tone={errors ? "bad" : "neutral"} />
      </StatGrid>
      <ResultsList results={results} revealed={revealed} live={phase !== "idle"} follow={playing} tall={wide} />
    </div>
  );

  const pr = preset.predict;
  const optLabel = (o: string) => (pr.kind === "outcome" ? OUTCOME_LABEL[o as Outcome] ?? o : o);

  return (
    <div ref={rootRef} className={`ch ch-root-c ${reduced ? "reduced" : ""}`}>
      <div className="ch-presets">
        <div className="ch-presets-top">
          <span className="ch-eyebrow">Cache-Control lab</span>
          {edited && <span className="ch-edited">{preset.short}, edited</span>}
        </div>
        <Segmented<string> value={presetId} onChange={(id) => load(PRESETS.find((p) => p.id === id) as Preset)}
          options={PRESETS.map((p) => ({ value: p.id, label: p.short }))} />
        <div className="ch-title">{preset.label}</div>
      </div>

      <div className="ch-predict" role="group" aria-label="Predict before you replay">
        <div className="ch-eyebrow">Predict</div>
        <div className="ch-predict-q">{pr.q}</div>
        <div className="ch-predict-opts">
          {pr.options.map((o) => {
            const cls = fb ? (o === fb.answer ? "is-right" : o === fb.pick ? "is-wrong" : "") : "";
            return (
              <button key={o} type="button" className={`ch-opt ${cls}`} aria-pressed={(fb ? fb.pick : pick) === o} disabled={!!fb}
                onClick={() => setPick(o)}>{optLabel(o)}</button>
            );
          })}
        </div>
        {!fb && <div className="ch-predict-hint">{pick ? "Locked in. Now press Replay." : "Pick an answer, then press Replay."}</div>}
        {fb && (
          <div className="ch-predict-fb">
            {fb.pick === null ? <b>Answer: {optLabel(fb.answer)}. </b> : fb.pick === fb.answer ? <b className="good">Right. </b> : <b className="bad">Not quite: it is {optLabel(fb.answer)}. </b>}
            {pr.explain} <span style={{ color: "var(--muted)" }}>{preset.lesson}</span>
          </div>
        )}
      </div>

      <WidgetFrame stage={stage} controls={controls} footer={!compact ? <Compare h={h} /> : undefined} />
    </div>
  );
}
