/**
 * Multi-CDN steering (chapter 9). Part color: var(--p4).
 *
 * Props
 * - onComplete?: () => void
 *     Called once, the first time the reader presses "CDN A fails in LatAm at t=0" on the Outage tab.
 * - tab?: "policy" | "outage" | "parity"
 *     Which tab opens first. Default "policy". The tab bar stays visible, so the reader can still switch.
 *     If the prop changes while mounted, the widget follows it.
 * - compact?: boolean (from WidgetProps). Not needed: the layout adapts to the measured width (wide grid >= 560px).
 *
 * Tabs
 * - Policy: regions x CDNs with assumed RUM numbers and prices; weights for performance, cost and availability;
 *   optional minimum commits. Output: per-region share bars, blended $/GB and QoE, and a cost-vs-QoE trade-off curve.
 * - Outage: CDN A fails in LatAm. Percent of LatAm sessions failing over 10 minutes for DNS, playback API,
 *   player failover, Content Steering and the combination the book recommends.
 * - Parity: the same golden requests against three CDNs, with header diffs. CDN C is missing its token check.
 */
import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/ui";
import { useWidth } from "@/lib/hooks";
import type { WidgetProps } from "../types";
import PolicyTab from "./PolicyTab";
import OutageTab from "./OutageTab";
import ParityTab from "./ParityTab";
import "./multi-cdn.css";

export type MultiCdnTab = "policy" | "outage" | "parity";
const TABS: { value: MultiCdnTab; label: string }[] = [
  { value: "policy", label: "Policy" },
  { value: "outage", label: "Outage" },
  { value: "parity", label: "Parity" },
];
const isTab = (v: unknown): v is MultiCdnTab => v === "policy" || v === "outage" || v === "parity";

export default function MultiCdn(props: WidgetProps) {
  const { onComplete } = props;
  const initial = isTab(props.tab) ? props.tab : "policy";
  const [tab, setTab] = useState<MultiCdnTab>(initial);
  useEffect(() => { if (isTab(props.tab)) setTab(props.tab); }, [props.tab]);

  const done = useRef(false);
  const onTrigger = () => { if (!done.current) { done.current = true; onComplete?.(); } };

  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const stageW = w >= 760 ? w - 292 : w; // WidgetFrame puts a 280px control column beside the stage at >= 760px
  const wide = stageW >= 560;

  return (
    <div ref={ref} className="mcdn" data-width={w}>
      <div className="mcdn-tabs">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>
      {/* All tabs stay mounted so slider positions and the outage replay survive tab switches. */}
      <div className="mcdn-panel" hidden={tab !== "policy"} role="tabpanel" aria-label="Policy"><PolicyTab wide={wide} /></div>
      <div className="mcdn-panel" hidden={tab !== "outage"} role="tabpanel" aria-label="Outage"><OutageTab onTrigger={onTrigger} /></div>
      <div className="mcdn-panel" hidden={tab !== "parity"} role="tabpanel" aria-label="Parity"><ParityTab wide={wide} /></div>
    </div>
  );
}
