import { AnimatePresence, motion } from "framer-motion";
import { useId } from "react";
import { Button, Chip, Segmented, Slider } from "@/ui";
import { fmtBytes, fmtNum } from "@/lib/format";
import {
  PRESET_INFO, RESOLUTIONS, codecString, resStr, shortRes,
  type Codec, type PresetId, type Rung,
} from "./model";

export interface LadderProps {
  preset: PresetId; setPreset: (p: PresetId) => void;
  av1Saving: number; setAv1Saving: (v: number) => void;
  rungs: Rung[]; codec: Codec; edited: boolean; reset: () => void;
  selected: string | null; select: (id: string) => void;
  updateRung: (id: string, patch: Partial<Rung>) => void;
  removeRung: (id: string) => void; addRung: () => void;
  minutes: number; reduced: boolean;
}

const MAX_RUNGS = 10;

export function Ladder(p: LadderProps) {
  const total = p.rungs.reduce((a, r) => a + r.kbps, 0);
  const scale = Math.max(8000, ...p.rungs.map((r) => r.kbps));
  const info = PRESET_INFO[p.preset];
  const bytes = (total * 1000 * p.minutes * 60) / 8;
  const t = p.reduced ? { duration: 0 } : { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const };
  const selId = useId();

  return (
    <div className="abr-ladder">
      <Segmented label="Ladder preset" value={p.preset} onChange={p.setPreset}
        options={(Object.keys(PRESET_INFO) as PresetId[]).map((k) => ({ value: k, label: PRESET_INFO[k].label }))} />
      <p className="abr-note">
        <Chip tone={info.source === "book" ? "accent" : "warn"}>{info.source === "book" ? "From the book" : "Assumed"}</Chip>{" "}
        {p.preset === "anime" && <b>Per-title (anime is easy to compress). </b>}{info.note}
      </p>
      {p.preset === "av1" && (
        <Slider label="AV1 saving vs H.264, per rung" value={Math.round(p.av1Saving * 100)} min={20} max={65} step={1}
          format={(v) => `${v}%`} onChange={(v) => p.setAv1Saving(v / 100)} hint="Assumed. Drag to see how sensitive storage is to codec efficiency." />
      )}

      <div className="abr-ladder-head">
        <span>Rung</span><span>Bitrate</span>
      </div>
      <ul className="abr-rungs" aria-label="Bitrate ladder, highest rung first">
        <AnimatePresence initial={false}>
          {p.rungs.map((r) => {
            const on = r.id === p.selected;
            const share = total ? r.kbps / total : 0;
            return (
              <motion.li key={r.id} layout={!p.reduced} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={t} className={`abr-rung ${on ? "on" : ""}`}>
                <button type="button" className="abr-rung-btn" aria-pressed={on} aria-expanded={on}
                  aria-label={`${shortRes(r)} ${resStr(r)}, ${fmtNum(r.kbps)} kbps. Select to edit and find it in the manifest.`}
                  onClick={() => p.select(r.id)}>
                  <span className="abr-rung-fill" style={{ width: `${(r.kbps / scale) * 100}%` }} aria-hidden="true" />
                  <span className="abr-rung-res"><b>{shortRes(r)}</b><small>{resStr(r)}</small></span>
                  <span className="abr-rung-kbps"><b>{fmtNum(r.kbps)}</b><small>kbps · {Math.round(share * 100)}%</small></span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div className="abr-rung-edit" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={t}>
                      <div className="abr-rung-edit-in">
                        <div className="abr-field">
                          <div className="abr-field-top"><label htmlFor={`${selId}-${r.id}`}>Resolution</label><code className="abr-codec">{codecString(p.codec, r.w, r.h)}</code></div>
                          <select id={`${selId}-${r.id}`} value={`${r.w}x${r.h}`}
                            onChange={(e) => { const [w, h] = e.target.value.split("x").map(Number); p.updateRung(r.id, { w, h }); }}>
                            {RESOLUTIONS.map(([w, h]) => <option key={`${w}x${h}`} value={`${w}x${h}`}>{h >= 2160 ? "4K" : `${h}p`} · {w}x{h}</option>)}
                          </select>
                        </div>
                        <Slider label="Bitrate" value={r.kbps} min={100} max={16000} step={50} format={(v) => `${fmtNum(v)} kbps`}
                          onChange={(v) => p.updateRung(r.id, { kbps: v })} />
                        <Button size="s" variant="ghost" className="abr-remove" disabled={p.rungs.length <= 1}
                          onClick={() => p.removeRung(r.id)}>Remove rung</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div className="abr-ladder-actions">
        <Button size="s" onClick={p.addRung} disabled={p.rungs.length >= MAX_RUNGS}>Add rung</Button>
        {p.edited && <Button size="s" variant="ghost" onClick={p.reset}>Reset to preset</Button>}
        <span className="abr-muted">{p.rungs.length} rungs</span>
      </div>

      <div className="abr-stack">
        <div className="abr-stack-top">
          <span>Where the bytes go</span>
          <span><b>{fmtNum(total / 1000, 1)} Mbps</b> total · <b>{fmtBytes(bytes)}</b> per {p.minutes}-min episode, one copy</span>
        </div>
        <div className="abr-stack-bar" role="img" aria-label={`Ladder total ${fmtNum(total)} kbps. Each rung is stored for the whole episode.`}>
          {p.rungs.map((r, i) => (
            <span key={r.id} className={`abr-stack-seg ${r.id === p.selected ? "on" : ""}`}
              style={{ width: `${(r.kbps / Math.max(1, total)) * 100}%`, ["--k" as string]: `${90 - (i / Math.max(1, p.rungs.length - 1)) * 62}%` }}
              title={`${shortRes(r)} ${fmtNum(r.kbps)} kbps`} />
          ))}
        </div>
        <p className="abr-muted abr-small">Every rung is stored for the whole episode, whether anyone watches it or not. The top rungs hold most of the bytes.</p>
      </div>
    </div>
  );
}
