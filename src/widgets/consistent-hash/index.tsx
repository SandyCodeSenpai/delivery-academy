/**
 * Spreading a cache across servers (book Chapter 5.4).
 *
 * A PoP has many cache servers. Which server stores which segment?
 * Three modes: random spray, hash mod N, and consistent hashing on a ring.
 *
 * Props (on top of WidgetProps):
 *   mode?: "random" | "mod" | "ring"
 *     The mode shown first. Default "random" (the problem), then the reader moves to "mod" and "ring".
 *     The mode switch stays visible, so the reader can always compare.
 *
 * Completion rule:
 *   onComplete() fires once, after the reader has removed at least one server in Mod N mode
 *   AND at least one server in Ring mode (Remove server button, the Servers slider moved down,
 *   or tapping a server column / ring node).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { WidgetProps } from "../types";
import { Button, Icon, Segmented, Slider, Stage, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { fmtNum, fmtPct } from "@/lib/format";
import { rng, useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import {
  MAX_SERVERS, MIN_SERVERS, capacityFor, copiesOf, countMoved, imbalanceOf, loadOf, makeObjects, makeRing,
  ownersMod, ownersRing, sampleCdf, sprayRequest, warmSpray, zipfCdf, type Mode,
} from "./model";
import ModView from "./ModView";
import RingView from "./RingView";
import LoadBars from "./LoadBars";
import SprayView, { type Flash, type Flight } from "./SprayView";
import Predict, { type PredictQ } from "./Predict";
import "./ch.css";

type Kind = "remove" | "add" | "vnodes";
interface Change {
  seq: number; mode: Mode; kind: Kind;
  prevServers: number[]; prevVn: number;
  moved: number; total: number; fromN: number; toN: number;
  imbBefore: number; imbAfter: number; at: number;
}

const MODES: { value: Mode; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "mod", label: "Mod N" },
  { value: "ring", label: "Ring" },
];
const isMode = (v: unknown): v is Mode => v === "random" || v === "mod" || v === "ring";
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 0 -> 1 over `ms` each time `seq` changes. Always 1 with reduced motion. */
function useTween(seq: number | null, ms: number, reduced: boolean): number {
  const [t, setT] = useState(1);
  useEffect(() => {
    if (seq === null || reduced) { setT(1); return; }
    let id = 0;
    const start = performance.now();
    const f = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setT(p);
      if (p < 1) id = requestAnimationFrame(f);
    };
    setT(0);
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [seq, ms, reduced]);
  return t;
}

const imbTone = (r: number): "good" | "warn" | "bad" => (r <= 1.3 ? "good" : r <= 1.8 ? "warn" : "bad");

export default function ConsistentHash(props: WidgetProps) {
  const { onComplete } = props;
  const compact = props.compact !== false;
  const reduced = useReducedMotion();

  const [mode, setMode] = useState<Mode>(isMode(props.mode) ? props.mode : "random");
  const [servers, setServers] = useState<number[]>(() => range(1, 10));
  const [m, setM] = useState(120);
  const [vnOn, setVnOn] = useState(false);
  const [vnCount, setVnCount] = useState(16);
  const vn = vnOn ? vnCount : 1;
  const [change, setChange] = useState<Change | null>(null);
  const [results, setResults] = useState<{ mod?: Change; ring?: Change }>({});
  const [removed, setRemoved] = useState({ mod: false, ring: false });
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [reveals, setReveals] = useState<Record<string, Change>>({});
  const seq = useRef(0);
  const done = useRef(false);

  const wref = useRef<HTMLDivElement>(null);
  const width = useWidth(wref);
  const N = servers.length;

  const objs = useMemo(() => makeObjects(m), [m]);
  const ownersFor = (md: Mode, svs: number[], v: number) =>
    md === "mod" ? ownersMod(objs, svs) : ownersRing(objs, makeRing(svs, v)).owner;

  /* ---------- changes ---------- */
  function commit(next: number[], nextVn: number, kind: Kind) {
    const now = performance.now();
    const burst = !!change && change.mode === mode && change.kind === kind && now - change.at < 700;
    const baseS = burst && change ? change.prevServers : servers;
    const baseV = burst && change ? change.prevVn : vn;
    let moved = 0, imbBefore = 1, imbAfter = 1;
    if (mode !== "random") {
      const a = ownersFor(mode, baseS, baseV), b = ownersFor(mode, next, nextVn);
      moved = countMoved(a, b);
      imbBefore = imbalanceOf(loadOf(a, baseS)).ratio;
      imbAfter = imbalanceOf(loadOf(b, next)).ratio;
    }
    const c: Change = {
      seq: ++seq.current, mode, kind, prevServers: baseS, prevVn: baseV, moved, total: objs.length,
      fromN: baseS.length, toN: next.length, imbBefore, imbAfter, at: now,
    };
    setServers(next);
    setChange(c);
    if (mode === "random") return;
    const md = mode;
    if (kind === "remove") {
      setResults((r) => ({ ...r, [md]: c }));
      setRemoved((r) => ({ ...r, [md]: true }));
      setReveals((r) => ({ ...r, [md]: c }));
    }
    if (md === "ring" && kind === "vnodes" && baseV === 1 && nextVn > 1) setReveals((r) => ({ ...r, vnodes: c }));
  }

  const lowestFree = (svs: number[]) => range(1, MAX_SERVERS).find((id) => !svs.includes(id)) ?? MAX_SERVERS;
  const removeServer = (id?: number) => {
    if (N <= MIN_SERVERS) return;
    const target = id ?? servers[servers.length - 1];
    commit(servers.filter((s) => s !== target), vn, "remove");
  };
  const addServer = () => {
    if (N >= MAX_SERVERS) return;
    commit([...servers, lowestFree(servers)].sort((a, b) => a - b), vn, "add");
  };
  const setCount = (n: number) => {
    if (n === N) return;
    let next = [...servers];
    while (next.length > n) next = next.slice(0, -1);
    while (next.length < n) next = [...next, lowestFree(next)].sort((a, b) => a - b);
    commit(next, vn, n < N ? "remove" : "add");
  };
  const setObjects = (v: number) => { setM(v); setChange(null); };
  const setVnodes = (on: boolean, count: number) => {
    if (mode === "ring") commit(servers, on ? count : 1, "vnodes");
    setVnOn(on);
    setVnCount(count);
  };

  useEffect(() => {
    if (!done.current && removed.mod && removed.ring) { done.current = true; onComplete?.(); }
  }, [removed, onComplete]);

  const shown = change && change.mode === mode ? change : null;
  const t = useTween(shown ? shown.seq : null, 1150, reduced);

  /* ---------- random spray (live) ---------- */
  const cap = capacityFor(m);
  const cdf = useMemo(() => zipfCdf(m), [m]);
  const spray = useMemo(() => warmSpray(servers, objs, cap, cdf), [servers, objs, cap, cdf]);
  const [, setFrame] = useState(0);
  const flights = useRef<Flight[]>([]);
  const flashes = useRef(new Map<number, Flash>());
  const clock = useRef(0);
  const acc = useRef(0);
  const liveRng = useRef(rng(99));
  const fid = useRef(0);
  useRaf((dt) => {
    clock.current += dt;
    acc.current += dt;
    if (acc.current >= 0.22) {
      acc.current -= 0.22;
      const r = liveRng.current;
      flights.current.push({ id: fid.current++, o: sampleCdf(cdf, r()), s: servers[Math.floor(r() * servers.length)], p: 0 });
    }
    const keep: Flight[] = [];
    for (const f of flights.current) {
      f.p += dt / 0.62;
      if (f.p < 1) { keep.push(f); continue; }
      const hit = sprayRequest(spray, f.s, f.o, cap);
      if (hit !== null) flashes.current.set(f.s, { hit, until: clock.current + 0.45 });
    }
    flights.current = keep;
    setFrame((x) => (x + 1) % 1_000_000);
  }, mode === "random" && !reduced && width > 0);

  /* ---------- derived numbers ---------- */
  const curOwners = useMemo(() => (mode === "random" ? [] : ownersFor(mode, servers, vn)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, servers, vn, objs]);
  const load = useMemo(() => loadOf(curOwners, servers), [curOwners, servers]);
  const copies = mode === "random" ? copiesOf(spray, m) : [];
  const distinct = copies.filter((c) => c > 0).length;
  const effServers = distinct / cap;
  const imb = imbalanceOf(mode === "random" ? spray.reqs : load);

  /* ---------- stats ---------- */
  let movedStat: ReactNode;
  if (mode === "random") {
    movedStat = <Stat label="Keys moved, last change" value="0" sub="No owners, so nothing moves. Nothing is shared either." />;
  } else if (shown && shown.kind === "vnodes") {
    movedStat = <Stat label="Keys moved, last change" value="–"
      sub={`Changing points per server re-shuffled ${fmtPct(shown.moved / shown.total)} of keys, like a planned re-shard. Remove a server to measure.`} />;
  } else if (shown) {
    const p = shown.moved / shown.total;
    movedStat = <Stat label="Keys moved, last change" value={fmtNum(shown.moved)} unit={`of ${shown.total} · ${fmtPct(p)}`}
      tone={p > 0.3 ? "bad" : "good"} sub="Each moved key is a cache miss on its new server." />;
  } else {
    movedStat = <Stat label="Keys moved, last change" value="–" sub="Remove a server to measure." />;
  }
  const imbStat = (
    <Stat label="Load imbalance (max ÷ avg)" value={`${imb.ratio.toFixed(2)}×`} tone={imbTone(imb.ratio)}
      sub={mode === "random" ? "Requests per server. Random spray is even." : `Busiest S${imb.maxId}: ${imb.max} keys, average ${fmtNum(imb.avg, 1)}`} />
  );
  const effStat = mode === "random" ? (
    <Stat label="Effective cache" value={fmtNum(effServers, 1)} unit={`of ${N} servers`} tone={effServers / N < 0.5 ? "bad" : "warn"}
      sub={`Hit ratio ${fmtPct(spray.hitRatio)}. With an owner per key: ${fmtPct(spray.ownedHitRatio)}.`} />
  ) : (
    <Stat label="Effective cache" value={fmtNum(N)} unit={`of ${N} servers`} tone="good" sub="Each segment is stored once." />
  );

  /* ---------- predictions ---------- */
  const qN = (id: string) => reveals[id]?.fromN ?? N;
  const Q: Record<string, PredictQ> = {
    random: { id: "random", q: `Random spray, ${N} servers. How many copies of the most popular segment does the PoP store?`, opts: ["1", `about ${Math.ceil(N / 2)}`, `${N}`], correct: 2, doNext: "Now look at the first bar of the chart." },
    mod: { id: "mod", q: `Remove 1 of ${qN("mod")} servers. With hash mod N, what share of keys move to a new server?`, opts: [`about 1/${qN("mod")}`, "about half", "almost all"], correct: 2, doNext: "Now press Remove server." },
    ring: { id: "ring", q: `Same change on a ring: remove 1 of ${qN("ring")} servers. What share of keys move?`, opts: [`about 1/${qN("ring")}`, "about half", "almost all"], correct: 0, doNext: "Now press Remove server." },
    vnodes: { id: "vnodes", q: "Turn on virtual nodes. What happens to load imbalance (busiest server ÷ average)?", opts: ["It gets worse", "No change", "It moves toward 1.0"], correct: 2, doNext: "Now switch on Virtual nodes." },
  };
  const resultText = (id: string): ReactNode => {
    if (id === "random") return `Every server sees the hot segment, so every server stores it: ${copies[0] ?? N} copies. The whole PoP holds only ${fmtNum(effServers, 1)} servers' worth of different segments.`;
    const c = reveals[id];
    if (!c) return null;
    const p = fmtPct(c.moved / c.total);
    if (id === "mod") return `Mod N moved ${c.moved} of ${c.total} keys (${p}). A key stays only when hash mod ${c.fromN} equals hash mod ${c.toN}, about 1 key in ${c.fromN}.`;
    if (id === "ring") return `The ring moved ${c.moved} of ${c.total} keys (${p}). Only the removed server's keys moved, each to the next server clockwise. Theory says about 1/${c.fromN} = ${fmtPct(1 / c.fromN)} on average.${c.prevVn === 1 ? " With one point per server the share depends on how big the removed server's arc was. Virtual nodes make it steady." : ""}`;
    return `Imbalance went from ${c.imbBefore.toFixed(2)}× to ${c.imbAfter.toFixed(2)}×. Each server now owns many small arcs, so luck evens out. Real systems use 100 or more points per server.`;
  };
  const questions = mode === "random" ? ["random"] : mode === "mod" ? ["mod"] : reveals.ring ? ["ring", "vnodes"] : ["ring"];
  const predictCards = questions.map((id) => (
    <Predict key={id} q={Q[id]} pick={picks[id]} revealed={id === "random" ? picks.random !== undefined : !!reveals[id]}
      result={resultText(id)} onPick={(i) => setPicks((p) => ({ ...p, [id]: i }))} />
  ));

  /* ---------- views ---------- */
  const desc: Record<Mode, ReactNode> = {
    random: <>Each request goes to a <b>random server</b>. Each server caches what it sees, so every server holds the same hot segments.</>,
    mod: <>Owner = <code>hash(key) mod {shown && shown.fromN !== shown.toN ? <>{shown.fromN} → {shown.toN}</> : N}</code>. Change N and almost every key gets a new owner.</>,
    ring: <>Servers and keys are hashed onto one <b>ring</b>. A key belongs to the <b>next server clockwise</b>.</>,
  };
  const legend: Record<Mode, ReactNode> = {
    random: <><i className="ch-sw top" />six most popular segments <i className="ch-sw rest" />the rest <i className="ch-sw slot" />empty slot</>,
    mod: <><i className="ch-sw key" />key <i className="ch-sw moved" />moved key = cache miss</>,
    ring: <><i className="ch-sw ring-moved" />moved key = cache miss. Tap a server to remove it.</>,
  };

  const ringCenter: { big: string; small: string; tone?: "bad" | "good" | "warn" } = shown && mode === "ring"
    ? shown.kind === "vnodes"
      ? { big: `${shown.imbAfter.toFixed(2)}×`, small: `load imbalance, was ${shown.imbBefore.toFixed(2)}×`, tone: imbTone(shown.imbAfter) }
      : { big: fmtPct(shown.moved / shown.total), small: `${shown.moved} of ${shown.total} keys moved`, tone: shown.moved / shown.total > 0.3 ? "bad" : "good" }
    : { big: `${m}`, small: `keys on ${N} servers` };

  let view: ReactNode = null;
  if (width > 0) {
    if (mode === "random") {
      view = <SprayView width={width} servers={servers} m={m} cap={cap} spray={spray} copies={copies}
        flights={flights.current} flashes={flashes.current} clock={clock.current} />;
    } else if (mode === "mod") {
      view = <ModView width={width} objs={objs} servers={servers} prev={shown ? shown.prevServers : null} t={t} compact={compact} onRemove={removeServer} />;
    } else {
      view = (
        <div className="ch-ring-wrap">
          <RingView width={width} objs={objs} servers={servers} vn={vn} prev={shown ? { servers: shown.prevServers, vn: shown.prevVn } : null}
            t={t} compact={compact} showMoved={shown?.kind !== "vnodes"} onRemove={removeServer} center={ringCenter} />
          <LoadBars width={Math.min(width, 520)} servers={servers} load={load} />
        </div>
      );
    }
  }

  const stepPill = (md: "mod" | "ring", label: string) => {
    const r = results[md];
    return (
      <span className={`ch-step ${removed[md] ? "done" : ""}`}>
        <span className="ch-step-dot" aria-hidden="true">{removed[md] && <Icon name="check" size={12} stroke={2.5} />}</span>
        {label}
        {r && <span className="ch-step-res">{fmtPct(r.moved / r.total)} moved</span>}
        <span className="ch-sr">{removed[md] ? " (done)" : ""}</span>
      </span>
    );
  };

  const stage = (
    <div className="ch-stagecol">
      <Segmented label="How requests pick a server" value={mode} options={MODES} onChange={setMode} />
      <p className="ch-desc">{desc[mode]}</p>
      <Stage className="ch-stage"><div ref={wref} className="ch-measure">{view}</div></Stage>
      <div className="ch-legend">{legend[mode]}</div>
      <StatGrid>{movedStat}{imbStat}{effStat}</StatGrid>
    </div>
  );

  const removeHot = mode !== "random" && !removed[mode];
  const controls = (
    <div className="ch-controls">
      <div className="ch-ctl-grid">
      <Slider label="Servers" value={N} min={MIN_SERVERS} max={MAX_SERVERS} onChange={setCount} />
      <Slider label="Objects (segments)" value={m} min={20} max={200} step={10} onChange={setObjects} />
      <div className="ch-btns">
        <Button variant={removeHot ? "primary" : "secondary"} size="s" onClick={() => removeServer()} disabled={N <= MIN_SERVERS}>Remove server</Button>
        <Button size="s" onClick={addServer} disabled={N >= MAX_SERVERS}>Add server</Button>
      </div>
      <Toggle label="Virtual nodes" checked={vnOn} disabled={mode !== "ring"}
        hint={mode === "ring" ? "Many points per server on the ring" : "Ring mode only"} onChange={(on) => setVnodes(on, vnCount)} />
      {vnOn && (
        <Slider label="Points per server" value={vnCount} min={2} max={32} disabled={mode !== "ring"}
          onChange={(v) => setVnodes(true, v)} />
      )}
      </div>
      {predictCards}
    </div>
  );

  return (
    <div className={`ch-root ${compact ? "compact" : "full"}`}>
      <div className="ch-task">
        <span className="ch-task-lead">Try this</span>
        {stepPill("mod", "Remove a server in Mod N")}
        {stepPill("ring", "Remove a server on the Ring")}
      </div>
      <WidgetFrame stage={stage} controls={controls}
        footer={
          <p className="ch-foot">
            In production: Fastly calls this <b>clustering</b>. The random server a request lands on (the delivery node) hashes the cache key
            and forwards to the key's owner (the fetch node). Google's <b>Maglev</b> load balancer uses its own consistent hashing so most
            connections keep their backend when backends change; Akamai used consistent hashing inside its clusters from the start.
            Hashes here are real: 32-bit FNV-1a with the MurmurHash3 finalizer.
          </p>
        } />
    </div>
  );
}
