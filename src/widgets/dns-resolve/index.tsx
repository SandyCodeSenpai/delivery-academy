/**
 * Widget "dns-resolve": How DNS picks a building (chapter 3).
 *
 * Three parts:
 *   walk      Step-through cold DNS lookup for static.crunchyroll.com: stub, recursive resolver, root,
 *             .com, Crunchyroll's authoritative (CNAME to CloudFront), .net, CloudFront's GSLB, then the
 *             A record for a Sao Paulo PoP. Shows each reply, cumulative ms and the resolver cache (TTLs),
 *             then a predict-first "ask again later" cache exercise.
 *   location  Abstract world map. Pick the viewer city, ISP vs far public resolver, and ECS on or off;
 *             see which PoP the GSLB picks and the RTT. Default = the classic mistake (Sao Paulo viewer,
 *             public resolver in Miami, no ECS), hidden behind a prediction.
 *   ttl       TTL slider (20 s to 1 h) and "PoP outage at t = 0". A stacked timeline shows the share of
 *             clients still sent to the dead PoP, split by resolvers that honor TTL, enforce a floor, or
 *             ignore TTL (all assumed and labeled).
 *
 * Props
 *   onComplete?: () => void
 *       Called at most once. Completion rule:
 *       - no `section` (all three parts): the reader has seen the ECS effect AND finished one TTL outage run.
 *         "Seen the ECS effect" = with the "Public, far" resolver, the reader has seen the revealed PoP choice
 *         for the same city with ECS off and with ECS on (either order).
 *         "Finished one outage run" = the outage timeline played to its end (instant with reduced motion).
 *       - section "walk": the reader reached the last step of the lookup.
 *       - section "location": the ECS effect has been seen.
 *       - section "ttl": one outage run has finished.
 *   section?: "walk" | "location" | "ttl"
 *       Show only that part, with no tabs. Omit it to get all three: a segmented control in compact mode,
 *       all three stacked in full mode.
 *   compact?: boolean (from WidgetProps)
 *       true in a lesson (about 640px): tabs. false on the lab page: all parts at once, wider layouts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Chip, Eyebrow, Icon, Segmented } from "@/ui";
import type { WidgetProps } from "../types";
import { Walkthrough } from "./Walkthrough";
import { LocationLab } from "./LocationLab";
import { TtlLab } from "./TtlLab";
import "./dns.css";

export type DnsSection = "walk" | "location" | "ttl";
type Props = WidgetProps & { section?: DnsSection };

const SECTIONS: { id: DnsSection; tab: string; title: string; lede: string }[] = [
  { id: "walk", tab: "1 · Lookup", title: "Follow one lookup", lede: "Step through a cold DNS lookup, from the device to the CDN's choice of building." },
  { id: "location", tab: "2 · Location", title: "Where you are vs where your resolver is", lede: "The CDN's DNS sees your resolver, not you. Move the viewer and the resolver, and switch ECS." },
  { id: "ttl", tab: "3 · TTL", title: "TTL and failover", lede: "Kill a PoP and watch how long DNS keeps sending clients to it." },
];
const isSection = (v: unknown): v is DnsSection => v === "walk" || v === "location" || v === "ttl";

export default function DnsResolve(props: Props) {
  const only = isSection(props.section) ? props.section : undefined;
  const full = props.compact === false;
  const [tab, setTab] = useState<DnsSection>(only ?? "walk");
  const [walkDone, setWalkDone] = useState(false);
  const [ecsSeen, setEcsSeen] = useState(false);
  const [outageRun, setOutageRun] = useState(false);
  const fired = useRef(false);
  const onComplete = props.onComplete;

  const ok = only === "walk" ? walkDone : only === "location" ? ecsSeen : only === "ttl" ? outageRun : ecsSeen && outageRun;
  useEffect(() => { if (ok && !fired.current) { fired.current = true; onComplete?.(); } }, [ok, onComplete]);

  const onWalk = useCallback(() => setWalkDone(true), []);
  const onEcs = useCallback(() => setEcsSeen(true), []);
  const onRun = useCallback(() => setOutageRun(true), []);

  const render = (id: DnsSection) =>
    id === "walk" ? <Walkthrough full={full} onFinished={onWalk} />
      : id === "location" ? <LocationLab full={full} onEcsSeen={onEcs} />
        : <TtlLab full={full} onRun={onRun} />;

  const goals = !only && (
    <div className="dr-goals" aria-live="polite">
      <span className="dr-muted">Your goal:</span>
      <Chip tone={ecsSeen ? "good" : "neutral"}>{ecsSeen && <Icon name="check" size={13} />}See what ECS changes</Chip>
      <Chip tone={outageRun ? "good" : "neutral"}>{outageRun && <Icon name="check" size={13} />}Run one PoP outage</Chip>
    </div>
  );

  if (only) {
    return <div className={`dr-root${full ? " is-full" : ""}`}>{render(only)}</div>;
  }

  if (full) {
    return (
      <div className="dr-root is-full">
        {goals}
        {SECTIONS.map((s, i) => (
          <section key={s.id} className="dr-block" aria-labelledby={`dr-h-${s.id}`}>
            <div className="dr-head">
              <Eyebrow dot="var(--p2)">Part {i + 1} of 3</Eyebrow>
              <h3 id={`dr-h-${s.id}`}>{s.title}</h3>
              <p>{s.lede}</p>
            </div>
            {render(s.id)}
          </section>
        ))}
      </div>
    );
  }

  const cur = SECTIONS.find((s) => s.id === tab)!;
  return (
    <div className="dr-root">
      <div className="dr-tabs" role="navigation" aria-label="Widget parts">
        <Segmented value={tab} options={SECTIONS.map((s) => ({ value: s.id, label: s.tab }))} onChange={setTab} />
      </div>
      <p className="dr-lede">{cur.lede}</p>
      {SECTIONS.map((s) => (
        <div key={s.id} hidden={s.id !== tab}>{render(s.id)}</div>
      ))}
      {goals}
    </div>
  );
}
