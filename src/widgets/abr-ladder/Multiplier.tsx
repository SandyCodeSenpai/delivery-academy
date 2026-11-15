import { AnimatePresence, motion } from "framer-motion";
import { Segmented, Slider, Stat, StatGrid } from "@/ui";
import { fmtBytes, fmtNum, fmtPct } from "@/lib/format";
import { CATALOG_EPISODES, type MultInputs, type MultResult } from "./model";

export interface MultiplierProps {
  m: MultInputs; set: (patch: Partial<MultInputs>) => void;
  res: MultResult; legacy: MultResult; rungs: number;
  banner: { from: number; to: number } | null; reduced: boolean;
}

type Part = "video" | "audio" | "subs";
const PARTS: { k: Part; label: string }[] = [
  { k: "video", label: "Video rungs" }, { k: "audio", label: "Audio tracks" }, { k: "subs", label: "Subtitles" },
];

const share = (v: number) => (v > 0 && v < 0.001 ? "<0.1%" : fmtPct(v, v < 0.1 ? 1 : 0));

/** One stacked bar: copy 1 solid, copy 2 striped. Width is relative to the legacy (two-copy) total. */
function Bar({ title, values, copies, subCopies, ref100, fmt }: {
  title: string; values: Record<Part, number>; copies: number; subCopies: number; ref100: number; fmt: (v: number) => string;
}) {
  const segs: { k: Part; v: number; copy: 1 | 2 }[] = [];
  for (const p of PARTS) segs.push({ k: p.k, v: values[p.k], copy: 1 });
  for (const p of PARTS) segs.push({ k: p.k, v: p.k === "subs" ? (subCopies > 1 ? values.subs : 0) : copies > 1 ? values[p.k] : 0, copy: 2 });
  const total = segs.reduce((a, s) => a + s.v, 0);
  const one = values.video + values.audio + values.subs;
  const pct = (k: Part) => (one ? values[k] / one : 0);
  return (
    <div className="abr-mbar">
      <div className="abr-mbar-top">
        <span>{title}</span>
        <b>{fmt(total)}</b>
      </div>
      <div className="abr-mbar-track" role="img"
        aria-label={`${title}: ${fmt(total)}. Video ${fmtPct(pct("video"))}, audio ${fmtPct(pct("audio"), 1)}, subtitles ${fmtPct(pct("subs"), 1)} of one copy. ${copies} copies.`}>
        {segs.map((s, i) => (
          <span key={i} className={`abr-mseg p-${s.k} c${s.copy}`} style={{ width: `${(s.v / Math.max(1, ref100)) * 100}%` }} />
        ))}
      </div>
      <div className="abr-mbar-legend">
        {PARTS.map((p) => <span key={p.k}><i className={`p-${p.k}`} />{p.label} <b>{share(pct(p.k))}</b></span>)}
      </div>
    </div>
  );
}

export function Multiplier({ m, set, res, legacy, rungs, banner, reduced }: MultiplierProps) {
  const t = reduced ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const };
  const dubSubObjects = res.copies * res.objects.audio + res.subCopies * res.objects.subs;
  const dubSubBytes = res.copies * res.bytes.audio + res.subCopies * res.bytes.subs;
  const legacyObjects = legacy.objectsTotal - legacy.objects.manifests;

  const fragTitle = res.why === "one" ? "One copy: every viewer shares every URL" : res.why === "encryption" ? "Still two copies: the encryption differs" : "Two copies: HLS and DASH viewers never share";
  const fragBody = res.why === "one"
    ? "An iPhone (HLS) and an Android TV (DASH) at the same second of the same rung now fetch the same URL. Each segment is twice as popular, so it stays in cache longer: double the hit potential, and the long tail benefits most."
    : res.why === "encryption"
      ? "Both protocols now use CMAF files, but cenc (AES-CTR) and cbcs (AES-CBC pattern) produce different encrypted bytes. CMAF gives you one copy only when encryption also converges on cbcs."
      : "An iPhone (HLS) and an Android TV (DASH) at the same second of the same rung fetch different URLs. Each segment's popularity is split in two, so long-tail episodes fall out of cache sooner.";

  return (
    <div className="abr-mult"><div className="abr-mult-grid"><div className="abr-mult-left">
      <StatGrid>
        <Stat label="Storage per episode" value={fmtBytes(res.storage)} tone={res.copies === 1 ? "good" : "neutral"} sub={`${res.copies} cop${res.copies === 1 ? "y" : "ies"} of video and audio`} />
        <Stat label={`Catalog, ${fmtNum(CATALOG_EPISODES)} eps`} value={fmtBytes(res.catalog)} sub="packaged, one cloud" />
        <Stat label="Objects per episode" value={fmtNum(res.objectsTotal)} sub={`${fmtNum(res.objectsTotal * CATALOG_EPISODES / 1e6, 0)}M in the catalog`} />
        <Stat label="Cache sharing" value={res.copies === 1 ? "2x" : "1x"} tone={res.copies === 1 ? "good" : "warn"} sub={res.copies === 1 ? "one URL per moment" : "split across 2 copies"} />
      </StatGrid>

      <AnimatePresence initial={false}>
        {banner && (
          <motion.div key={`${banner.from}-${banner.to}`} className="abr-banner" role="status"
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={t}>
            <b>Storage halved.</b> {fmtBytes(banner.from)} to {fmtBytes(banner.to)} per episode, {fmtBytes(banner.from * CATALOG_EPISODES)} to {fmtBytes(banner.to * CATALOG_EPISODES)} for the catalog. One CMAF copy with cbcs.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="abr-mbars">
        <Bar title="Bytes" values={res.bytes} copies={res.copies} subCopies={res.subCopies} ref100={legacy.storage} fmt={(v) => fmtBytes(v)} />
        <Bar title="Media objects" values={{ video: res.objects.video, audio: res.objects.audio, subs: res.objects.subs }} copies={res.copies} subCopies={res.subCopies}
          ref100={legacyObjects} fmt={(v) => fmtNum(v)} />
        <p className="abr-muted abr-small">Solid = first copy. Striped = second copy. Full width = two separate copies. Plus {fmtNum(res.objects.manifests)} small playlist files.</p>
      </div>

      <div className={`abr-frag ${res.why === "one" ? "good" : "warn"}`}>
        <div className="abr-frag-title">{fragTitle}</div>
        <p>{fragBody}</p>
        <p>
          Dubs and subtitles: <b>{fmtPct(dubSubBytes / res.storage, 1)}</b> of the bytes but <b>{fmtPct(dubSubObjects / res.objectsTotal, 0)}</b> of the objects.
          They do not split video popularity, because audio and text are separate files: every dub plays the same {rungs} video rungs.
        </p>
      </div>
    </div>
      <div className="abr-mult-ctl" role="group" aria-label="Episode and packaging settings">
        <Slider label="Episode length" value={m.minutes} min={5} max={60} format={(v) => `${v} min`} onChange={(v) => set({ minutes: v })} />
        <Segmented label="Segment length" value={m.segSec} onChange={(v) => set({ segSec: v })}
          options={[2, 4, 6].map((s) => ({ value: s, label: `${s} s` }))} />
        <Slider label="Audio tracks" value={m.audio} min={1} max={10} format={(v) => `${v}`} onChange={(v) => set({ audio: v })} hint="Japanese original plus dubs, 128 kbps AAC each." />
        <Slider label="Subtitle languages" value={m.subs} min={0} max={14} format={(v) => `${v}`} onChange={(v) => set({ subs: v })} hint="Segmented WebVTT, ~58 KB per 24 min (assumed)." />
        <div className="abr-ctl-key">
          <Segmented label="Packaging" value={m.packaging} onChange={(v) => set({ packaging: v })}
            options={[{ value: "separate", label: "HLS + DASH copies" }, { value: "cmaf", label: "One CMAF copy" }]} />
          <Segmented label="Encryption" value={m.enc} onChange={(v) => set({ enc: v })}
            options={[{ value: "both", label: "cenc + cbcs" }, { value: "cbcs", label: "cbcs only" }]} />
        </div>
      </div>
    </div></div>
  );

}
