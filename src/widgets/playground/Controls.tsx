/** Controls: full lab panel, the small free-play panel for lesson mode, and the stat tiles. */
import { Button, Segmented, Slider, Stat, StatGrid, Toggle } from "@/ui";
import { fmtBps, fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import {
  CONTENT, MAX_LOG, REGIONS, REGION_SHORT, toneHit, toneLow, viewersFromLog,
  type Content, type Faults, type PgState, type Region, type SteerMode, type TrafficStats,
} from "./model";

export type Patch = (p: Partial<Omit<PgState, "faults">> & { faults?: Partial<Faults> }) => void;

const REGION_OPTS = REGIONS.map((r) => ({ value: r, label: REGION_SHORT[r] }));
const CONTENT_OPTS = (Object.keys(CONTENT) as Content[]).map((k) => ({ value: k, label: CONTENT[k].short }));
const STEER_OPTS: { value: SteerMode; label: string }[] = [
  { value: "performance", label: "Performance" }, { value: "cost", label: "Cost" }, { value: "manual", label: "Manual" },
];
export const FAULTS: { key: keyof Faults; label: string; hint: string }[] = [
  { key: "cdnAOutage", label: "CDN A outage", hint: "Every CDN A edge returns errors" },
  { key: "shieldADown", label: "CDN A shield down", hint: "A's edges go straight to origin" },
  { key: "awsDown", label: "AWS origin region down", hint: "S3 us-west-2 unreachable" },
  { key: "replLag", label: "Replication lag", hint: "New episode not in GCS yet" },
  { key: "slowOrigin", label: "Slow origin", hint: "S3 takes 1.2 s to first byte" },
];

export const fmtViewers = (v: number) => (v >= 1e6 ? `${fmtNum(v / 1e6, 1)}M` : v >= 1e3 ? `${fmtNum(v / 1e3, v < 1e4 ? 1 : 0)}k` : fmtNum(v));

interface CtlProps {
  s: PgState; patch: Patch; busy: boolean;
  onPlay: () => void; onPurge: () => void; onRunTraffic: () => void;
  view: "request" | "traffic";
}

export function FullControls({ s, patch, busy, onPlay, onPurge, onRunTraffic, view }: CtlProps) {
  return (
    <div className="pg-ctl-grid">
      <section className="pg-group" aria-label="One request">
        <h4>1 · Play one request</h4>
        <Segmented label="Viewer in" value={s.region} options={REGION_OPTS} onChange={(v: Region) => patch({ region: v })} disabled={busy} />
        <Segmented label="Content" value={s.content} options={CONTENT_OPTS} onChange={(v: Content) => patch({ content: v })} disabled={busy} />
        <Button variant="primary" onClick={onPlay} disabled={busy}>{busy ? "Playing" : "Play request"}</Button>
      </section>
      <section className="pg-group" aria-label="Cache state">
        <h4>2 · Cache state</h4>
        <Toggle label="Edge caches warm" checked={s.edgeWarm} onChange={(v) => patch({ edgeWarm: v, filled: v ? s.filled : s.filled.filter((k) => !k.startsWith("edge")) })} disabled={busy} hint="Filled by earlier viewers" />
        <Toggle label="Shield caches warm" checked={s.shieldWarm} onChange={(v) => patch({ shieldWarm: v, filled: v ? s.filled : s.filled.filter((k) => !k.startsWith("shield")) })} disabled={busy} hint="Shields can be pre-warmed before a premiere" />
        <Button onClick={onPurge} disabled={busy}>Purge all caches</Button>
      </section>
      <section className="pg-group" aria-label="Failures">
        <h4>3 · Break something</h4>
        {FAULTS.map((f) => (
          <Toggle key={f.key} label={f.label} hint={f.hint} checked={s.faults[f.key]} disabled={busy} onChange={(v) => patch({ faults: { [f.key]: v } })} />
        ))}
      </section>
      <section className="pg-group" aria-label="Steering and traffic">
        <h4>4 · Steering and traffic</h4>
        <Segmented label="Steer by" value={s.steer} options={STEER_OPTS} onChange={(v: SteerMode) => patch({ steer: v })} disabled={busy} />
        {s.steer === "manual" && (
          <Slider label="Share to CDN A" value={Math.round(s.splitA * 100)} min={0} max={100} step={5} format={(v) => `${v}% A · ${100 - v}% B`}
            onChange={(v) => patch({ splitA: v / 100 })} hint={s.splitA < 0.1 || s.splitA > 0.9 ? "Below 10% on one CDN: its caches go cold" : "Keep at least 10% on each CDN"} />
        )}
        <Slider label="Viewers" value={s.viewersLog} min={0} max={MAX_LOG} step={0.01} format={(v) => fmtViewers(viewersFromLog(v))}
          onChange={(v) => patch({ viewersLog: v })} hint={`${fmtBps(viewersFromLog(s.viewersLog) * 4e6)} at 4 Mbps each (log scale)`} />
        <Segmented label="Segment length" value={s.segSec} options={[{ value: 4, label: "4 s" }, { value: 6, label: "6 s" }]} onChange={(v: 4 | 6) => patch({ segSec: v })} />
        {view !== "traffic" && <Button onClick={onRunTraffic} disabled={busy}>Run traffic</Button>}
      </section>
    </div>
  );
}

/** Lesson mode free play: the essentials only. */
export function CompactControls({ s, patch, busy, onPlay, onPurge }: CtlProps) {
  return (
    <div className="pg-compact-ctl">
      <div className="pg-row2">
        <Segmented label="Viewer in" value={s.region} options={REGION_OPTS} onChange={(v: Region) => patch({ region: v })} disabled={busy} />
        <Segmented label="Content" value={s.content} options={CONTENT_OPTS} onChange={(v: Content) => patch({ content: v })} disabled={busy} />
      </div>
      <div className="pg-chiprow" role="group" aria-label="Break something">
        {FAULTS.map((f) => (
          <button key={f.key} type="button" className={`pg-fchip${s.faults[f.key] ? " on" : ""}`} aria-pressed={s.faults[f.key]} disabled={busy}
            title={f.hint} onClick={() => patch({ faults: { [f.key]: !s.faults[f.key] } })}>{f.label}</button>
        ))}
      </div>
      <div className="pg-btnrow">
        <Button variant="primary" onClick={onPlay} disabled={busy}>{busy ? "Playing" : "Play request"}</Button>
        <Button onClick={onPurge} disabled={busy}>Purge caches</Button>
      </div>
    </div>
  );
}

export function TrafficStatsGrid({ st }: { st: TrafficStats }) {
  const p95 = Number.isFinite(st.p95Ms) ? st.p95Ms : null;
  return (
    <StatGrid>
      <Stat label="Edge hit ratio" value={fmtPct(st.edgeHit, 1)} tone={toneHit(st.edgeHit, 0.95, 0.85)} sub="requests served at the edge" />
      <Stat label="Shield hit ratio" value={st.shieldHit == null ? "n/a" : fmtPct(st.shieldHit, 1)} tone={st.shieldHit == null ? "neutral" : toneHit(st.shieldHit, 0.8, 0.5)} sub="of edge misses" />
      <Stat label="Origin requests" value={fmtNum(st.originRps)} unit="/s" tone={toneLow(st.originRps, 2000, 5500)} sub={st.phase === "cold" ? "first minute, cold" : "steady state"} />
      <Stat label="Origin egress" value={fmtBps(st.originBps)} tone={toneLow(st.originBps, 100e9, 400e9)} sub={`of ${fmtBps(st.edgeBps)} delivered`} />
      <Stat label="p95 time to first byte" value={p95 == null ? "n/a" : `${fmtNum(p95)}`} unit={p95 == null ? undefined : "ms"} tone={p95 == null ? "bad" : toneLow(p95, 200, 600)} sub="per segment" />
      <Stat label="Error rate" value={fmtPct(st.errorRate, st.errorRate > 0 && st.errorRate < 0.01 ? 2 : 1)} tone={toneLow(st.errorRate, 0.001, 0.01)}
        sub={st.firstTryFail > 0 ? `${fmtPct(st.firstTryFail, 0)} of first tries failed` : "after player retries"} />
      <Stat label="Cost per hour" value={fmtMoney(st.costHour)} tone={st.costPerGbEff <= 0.0045 ? "good" : st.costPerGbEff <= 0.0058 ? "warn" : "bad"} sub={`$${st.costPerGbEff.toFixed(4)} per GB, all in`} />
    </StatGrid>
  );
}
