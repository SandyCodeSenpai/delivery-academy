/**
 * Shield and origin offload (book Chapter 6, prices from Chapter 16).
 *
 * Props (on top of WidgetProps):
 * - onComplete?: () => void
 *     Called once, the first time the reader gets the origin under 100 Gbps
 *     while peak egress is exactly 8 Tbps (Offload tab). From the default state
 *     (shield off, 95% edge, 400 Gbps at origin) turning the shield on does it.
 * - tab?: "offload" | "multi-origin"
 *     Which tab opens first. Default "offload". The reader can still switch tabs.
 * - compact?: boolean (standard) lesson mode vs full lab page; layout adapts by width.
 *
 * Tabs:
 * - Offload: Sankey-style flow Viewers -> edge PoPs -> shield -> origin, with stat tiles
 *   and a "Keep the origin under 100 Gbps" target.
 * - Multi-origin: S3 primary + GCS replica, replication lag, primary outage, a new episode,
 *   and origin groups vs DNS failover.
 */
import { useEffect, useState } from "react";
import { Segmented } from "@/ui";
import type { WidgetProps } from "../types";
import { OffloadTab } from "./OffloadTab";
import { MultiOriginTab } from "./MultiOriginTab";
import "./shield-offload.css";

type Tab = "offload" | "multi-origin";

export default function ShieldOffload(props: WidgetProps) {
  const initial: Tab = props.tab === "multi-origin" ? "multi-origin" : "offload";
  const [tab, setTab] = useState<Tab>(initial);
  useEffect(() => setTab(initial), [initial]);

  return (
    <div className="so-root">
      <div className="so-tabs">
        <Segmented<Tab> value={tab} onChange={setTab}
          options={[{ value: "offload", label: "Offload" }, { value: "multi-origin", label: "Multi-origin" }]} />
      </div>
      <div hidden={tab !== "offload"}><OffloadTab onComplete={props.onComplete} /></div>
      <div hidden={tab !== "multi-origin"}><MultiOriginTab /></div>
    </div>
  );
}
