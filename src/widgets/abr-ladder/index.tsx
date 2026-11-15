/**
 * Ladder and manifest explorer (chapter 7).
 *
 * Props
 * - onComplete?: () => void
 *     Called ONCE, the first time the reader moves the packaging to "One CMAF copy" with "cbcs only"
 *     encryption and the per-episode storage drops (copies go from 2 to 1). The default state is the
 *     legacy setup (separate HLS + DASH copies, cenc + cbcs), so this always takes a real reader action.
 *     Switching to CMAF while keeping cenc + cbcs does NOT complete it: storage stays the same.
 *     Single-section fallbacks (the CMAF switch is not on screen there):
 *       section="ladder"   -> after the reader changes the preset or edits, adds or removes a rung;
 *       section="manifest" -> after the reader opens a media playlist.
 * - section?: "ladder" | "manifest" | "multiplier"
 *     Show only that part, with no tab bar (for a lesson step that teaches one idea). The reader can
 *     still click rungs in the manifest's rung rail. Omit it to get all three parts: tabs when the
 *     widget is narrower than 960px (lesson / phone), side by side when wider (lab page).
 * - compact?: boolean (standard WidgetProps; layout follows the measured width instead).
 */
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/ui";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { fmtBytes, fmtNum, fmtPct } from "@/lib/format";
import type { WidgetProps } from "../types";
import { Ladder } from "./Ladder";
import { Manifest } from "./Manifest";
import { Multiplier } from "./Multiplier";
import { Predict, type PredictQ } from "./Predict";
import {
  AV1_DEFAULT_SAVING, RESOLUTIONS, multiply, newId, presetCodec, presetRungs,
  type ManifestCtx, type MultInputs, type PresetId, type Rung, type Target,
} from "./model";
import "./abr.css";

type Section = "ladder" | "manifest" | "multiplier";
const SECTIONS: { value: Section; label: string; title: string }[] = [
  { value: "ladder", label: "1 Ladder", title: "Build the ladder" },
  { value: "manifest", label: "2 Manifests", title: "Read the manifests" },
  { value: "multiplier", label: "3 Multiplier", title: "Storage and objects" },
];
const DEFAULT_MULT: MultInputs = { minutes: 24, segSec: 4, audio: 4, subs: 10, packaging: "separate", enc: "both" };

export default function AbrLadder(props: WidgetProps) {
  const { onComplete } = props;
  const only = (["ladder", "manifest", "multiplier"] as const).find((s) => s === props.section);
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const layout: "single" | "tabs" | "grid" = only ? "single" : width >= 960 ? "grid" : "tabs";

  /* ---------- ladder state ---------- */
  const [preset, setPresetRaw] = useState<PresetId>("h264");
  const [av1Saving, setAv1SavingRaw] = useState(AV1_DEFAULT_SAVING);
  const [initial] = useState<Rung[]>(() => presetRungs("h264", AV1_DEFAULT_SAVING));
  const [rungs, setRungs] = useState<Rung[]>(initial);
  const [edited, setEdited] = useState(false);
  // Meaningful default: the top rung is selected, so its manifest line is lit from the start.
  const [selRef, setSelRef] = useState<string | null>(initial[0].id);
  const codec = presetCodec(preset);

  // If the selected rung disappears, fall back to the top rung.
  useEffect(() => {
    if (!selRef || (!selRef.includes(":") && !rungs.some((r) => r.id === selRef))) setSelRef(rungs[0]?.id ?? null);
  }, [selRef, rungs]);

  const loadPreset = (p: PresetId, saving = av1Saving) => {
    const next = presetRungs(p, saving);
    const idx = Math.max(0, rungs.findIndex((r) => r.id === selRef));
    setRungs(next);
    if (!selRef || !selRef.includes(":")) setSelRef(next[Math.min(idx, next.length - 1)].id);
    setPresetRaw(p); setEdited(false);
  };
  const setAv1Saving = (v: number) => { setAv1SavingRaw(v); if (preset === "av1") loadPreset("av1", v); };

  const updateRung = (id: string, patch: Partial<Rung>) => { setRungs((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); setEdited(true); };
  const removeRung = (id: string) => {
    if (rungs.length <= 1) return;
    const i = rungs.findIndex((r) => r.id === id);
    const next = rungs.filter((r) => r.id !== id);
    setRungs(next);
    if (selRef === id) setSelRef(next[Math.min(i, next.length - 1)].id);
    setEdited(true);
  };
  const addRung = () => {
    if (rungs.length >= 10) return;
    // Fill the widest bitrate gap (ratio above 1.4x) or, if none, add a rung above the top.
    const sorted = [...rungs].sort((a, b) => b.kbps - a.kbps);
    let at = -1, gap = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const g = sorted[i].kbps - sorted[i + 1].kbps;
      if (sorted[i].kbps / sorted[i + 1].kbps > 1.4 && g > gap) { gap = g; at = i; }
    }
    let r: Rung;
    if (at < 0) {
      const top = sorted[0];
      const ri = RESOLUTIONS.findIndex(([, h]) => h === top.h);
      const [w, h] = RESOLUTIONS[Math.min(RESOLUTIONS.length - 1, ri + 1)];
      r = { id: newId(), w, h, kbps: Math.min(16000, Math.round((top.kbps * 1.5) / 50) * 50) };
    } else {
      const hi = sorted[at], lo = sorted[at + 1];
      r = { id: newId(), w: lo.w, h: lo.h, kbps: Math.round(Math.sqrt(hi.kbps * lo.kbps) / 50) * 50 };
    }
    setRungs([...rungs, r].sort((a, b) => b.kbps - a.kbps));
    setSelRef(r.id);
    setEdited(true);
  };
  const ladderKbps = rungs.reduce((a, r) => a + r.kbps, 0);

  /* ---------- manifest state ---------- */
  const [proto, setProto] = useState<"hls" | "dash">("hls");
  const [open, setOpen] = useState<Target | null>(null);

  /* ---------- multiplier state ---------- */
  const [mult, setMult] = useState<MultInputs>(DEFAULT_MULT);
  const setM = (patch: Partial<MultInputs>) => setMult((m) => ({ ...m, ...patch }));
  const res = useMemo(() => multiply(ladderKbps, rungs.length, mult), [ladderKbps, rungs.length, mult]);
  const legacy = useMemo(() => multiply(ladderKbps, rungs.length, { ...mult, packaging: "separate", enc: "both" }), [ladderKbps, rungs.length, mult]);

  // Selecting a rung keeps an open video media playlist in sync.
  const select = (ref: string) => {
    setSelRef(ref);
    if (open?.type === "video" && !ref.includes(":")) setOpen({ type: "video", rungId: ref });
  };
  // Close a media playlist whose track no longer exists.
  useEffect(() => {
    if (!open) return;
    if (open.type === "video" && !rungs.some((r) => r.id === open.rungId)) setOpen(null);
  }, [open, rungs]);
  useEffect(() => { if (open && open.type !== "video") setOpen(null); }, [mult.audio, mult.subs]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- completion: CMAF + cbcs drops storage ---------- */
  const [banner, setBanner] = useState<{ from: number; to: number } | null>(null);
  const prev = useRef({ copies: res.copies, storage: res.storage });
  const done = useRef(false);
  const fire = useCallback(() => { if (!done.current) { done.current = true; onComplete?.(); } }, [onComplete]);
  useEffect(() => { if (only === "ladder" && (edited || preset !== "h264")) fire(); }, [only, edited, preset, fire]);
  useEffect(() => { if (only === "manifest" && open) fire(); }, [only, open, fire]);
  useEffect(() => {
    const p = prev.current;
    if (p.copies === 2 && res.copies === 1 && mult.packaging === "cmaf" && res.storage < p.storage) {
      setBanner({ from: p.storage, to: res.storage });
      fire();
    } else if (res.copies === 2) setBanner(null);
    prev.current = { copies: res.copies, storage: res.storage };
  }, [res.copies, res.storage, mult.packaging, fire]);

  /* ---------- tabs ---------- */
  const [tab, setTab] = useState<Section>("ladder");

  /* ---------- predict questions ---------- */
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [qIdx, setQIdx] = useState<Record<Section, number>>({ ladder: 0, manifest: 0, multiplier: 0 });
  const setPick = (id: string, v: number) => setPicks((p) => ({ ...p, [id]: v }));
  const goTab = (s: Section) => { if (layout === "tabs") setTab(s); };

  const at = (patch: Partial<MultInputs>) => multiply(ladderKbps, rungs.length, { ...mult, ...patch });
  const dubFrom = at({ audio: 4 }), dubTo = at({ audio: 10 });
  const cmafBoth = at({ packaging: "cmaf", enc: "both" }), sep = at({ packaging: "separate", enc: "both" }), cmafCbcs = at({ packaging: "cmaf", enc: "cbcs" });

  const questions: Record<Section, PredictQ[]> = {
    ladder: [
      {
        id: "top2", prompt: "On the book's H.264 ladder, the top two rungs (6 and 8 Mbps) hold what share of the episode's video bytes?",
        options: ["About 25%", "About 60%", "About 90%"], answer: 1,
        explain: "14 of 23.2 Mbps, so about 60%. Every rung is stored for the whole episode, so the top rungs dominate storage even if few viewers pick them.",
        tryLabel: "Show me", onTry: () => { loadPreset("h264"); goTab("ladder"); },
      },
      {
        id: "anime", prompt: "Switch from the fixed H.264 ladder to a per-title anime ladder. How much smaller is the episode?",
        options: ["About 10% smaller", "About half", "About 90% smaller"], answer: 1,
        explain: "11.3 vs 23.2 Mbps in this assumed ladder: about half. Flat colors and clean lines need far fewer bits for the same quality, and that saving repeats on every copy and every byte delivered.",
        tryLabel: "Load per-title", onTry: () => loadPreset("anime"),
      },
    ],
    manifest: [
      {
        id: "segs", prompt: "A 24-minute episode is cut into 4-second segments. How many #EXTINF lines does one media playlist have?",
        options: ["24", "360", "1,440"], answer: 1,
        explain: "1,440 s / 4 s = 360 segments, one #EXTINF line each. And every rung, dub and subtitle language has its own list of 360.",
        tryLabel: "Open the playlist", onTry: () => {
          setM({ minutes: 24, segSec: 4 }); setProto("hls");
          const id = rungs.find((r) => r.id === selRef)?.id ?? rungs[0].id;
          setSelRef(id); setOpen({ type: "video", rungId: id });
        },
      },
      {
        id: "dubs", prompt: "You add 3 more dubs. How many new #EXT-X-STREAM-INF (variant) lines does the master playlist get?",
        options: ["3", `${3 * rungs.length} (one per rung per dub)`, "None"], answer: 2,
        explain: "None. Audio is demuxed: each dub is one #EXT-X-MEDIA line in the \"aud\" group, and every variant points to that group. With muxed audio you would need a full video ladder per dub.",
        tryLabel: "Add 3 dubs", onTry: () => {
          const a = Math.min(10, mult.audio + 3); setM({ audio: a }); setProto("hls"); setOpen(null);
          const lang = ["ja", "en", "es", "pt", "fr", "de", "it", "hi", "ar", "ru"][a - 1];
          setSelRef(`a:${lang}`);
        },
      },
    ],
    multiplier: [
      {
        id: "dub10", prompt: "Go from 4 audio tracks to 10. What happens to storage per episode?",
        options: ["Grows about 3%", "Grows about 25%", "Grows about 2.5x"], answer: 0,
        explain: `Storage grows ${fmtPct(dubTo.storage / dubFrom.storage - 1, 1)} (${fmtBytes(dubFrom.storage)} to ${fmtBytes(dubTo.storage)}). But objects grow ${fmtPct(dubTo.objectsTotal / dubFrom.objectsTotal - 1)}: ${fmtNum(dubFrom.objectsTotal)} to ${fmtNum(dubTo.objectsTotal)}. Tiny bytes, many files.`,
        tryLabel: "Set 10 audio tracks", onTry: () => setM({ audio: 10 }),
      },
      {
        id: "cmaf", prompt: "Switch to one CMAF copy, but keep both cenc and cbcs encryption. What happens to storage?",
        options: ["It halves", "It stays about the same", "It drops about 10%"], answer: 1,
        explain: `About the same: ${fmtBytes(sep.storage)} to ${fmtBytes(cmafBoth.storage)}. The container is shared now, but cenc and cbcs encrypt the bytes differently, so video and audio still exist twice. Only the clear subtitle files are shared.`,
        tryLabel: "Switch to CMAF", onTry: () => setM({ packaging: "cmaf" }),
      },
      {
        id: "cbcs", prompt: "Now keep CMAF and move every device to cbcs only. What happens to storage and cache sharing?",
        options: ["Storage halves, sharing doubles", "Storage halves, sharing is the same", "Nothing changes"], answer: 0,
        explain: `One copy: ${fmtBytes(sep.storage)} to ${fmtBytes(cmafCbcs.storage)} per episode, and HLS and DASH viewers now request the same URLs, so each segment is twice as popular in cache.`,
        tryLabel: "Use cbcs only", onTry: () => setM({ packaging: "cmaf", enc: "cbcs" }),
      },
    ],
  };

  /* ---------- render ---------- */
  const ctx: ManifestCtx = { rungs, codec, audio: mult.audio, subs: mult.subs, segSec: mult.segSec, minutes: mult.minutes, packaging: mult.packaging, enc: mult.enc };
  const predict = (s: Section) => (
    <Predict qs={questions[s]} idx={qIdx[s]} setIdx={(i) => setQIdx((q) => ({ ...q, [s]: i }))} picks={picks} setPick={setPick} reduced={reduced} />
  );
  const body = (s: Section, showRail: boolean) => {
    if (s === "ladder") return (
      <Ladder preset={preset} setPreset={(p) => loadPreset(p)} av1Saving={av1Saving} setAv1Saving={setAv1Saving}
        rungs={rungs} codec={codec} edited={edited} reset={() => loadPreset(preset)}
        selected={selRef} select={select} updateRung={updateRung} removeRung={removeRung} addRung={addRung}
        minutes={mult.minutes} reduced={reduced} />
    );
    if (s === "manifest") return (
      <Manifest ctx={ctx} proto={proto} setProto={setProto} open={open} setOpen={setOpen}
        selectedRef={selRef} select={select} showRail={showRail} reduced={reduced} />
    );
    return <Multiplier m={mult} set={setM} res={res} legacy={legacy} rungs={rungs.length} banner={banner} reduced={reduced} />;
  };
  const panel = (s: Section, showRail: boolean, heading: boolean) => (
    <section className={`abr-panel abr-panel-${s}`} aria-label={SECTIONS.find((x) => x.value === s)?.title}>
      {heading && <h3 className="abr-h"><span>{SECTIONS.findIndex((x) => x.value === s) + 1}</span>{SECTIONS.find((x) => x.value === s)?.title}</h3>}
      {predict(s)}
      {body(s, showRail)}
    </section>
  );

  const t = reduced ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const };
  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className={`abr ${layout}`}>
        {layout === "single" && only && panel(only, true, false)}
        {layout === "tabs" && (
          <>
            <div className="abr-tabs"><Segmented value={tab} onChange={setTab} options={SECTIONS.map(({ value, label }) => ({ value, label }))} /></div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={t}>
                {panel(tab, true, false)}
              </motion.div>
            </AnimatePresence>
          </>
        )}
        {layout === "grid" && (
          <>
            <div className="abr-grid2">
              {panel("ladder", false, true)}
              {panel("manifest", false, true)}
            </div>
            {panel("multiplier", false, true)}
          </>
        )}
      </div>
    </MotionConfig>
  );
}
