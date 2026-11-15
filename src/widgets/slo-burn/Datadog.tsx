import { useState, type ReactNode } from "react";
import { Segmented } from "@/ui";
import { DD_TICKET, RULES, dur, pct, sloLabel, type Rule, type RuleResult, type Sim } from "./model";

type Pick = "fast" | "slow" | "ticket";
const HOURS_30D = 720;

const winLabel = (m: number) => (m % 60 === 0 && m <= 2880 ? `${m / 60}h` : m % 1440 === 0 ? `${m / 1440}d` : `${m}m`);

/** The book's Terraform monitor (Section 11.10.2), with values that follow the widget's inputs. */
export default function Datadog({ sim, follow }: { sim: Sim; follow: Pick | null }) {
  const [picked, setPicked] = useState<Pick | null>(null);
  const which: Pick = picked ?? follow ?? "fast";
  const rule: Rule = which === "ticket" ? DD_TICKET : RULES.find((r) => r.id === which)!;
  const res: RuleResult = which === "ticket" ? sim.dd : sim.rules[which];
  const b = 1 - sim.slo;
  const target = sloLabel(sim.slo).replace("%", "");
  const long = rule.long!, short = rule.short!, burn = rule.burn!;
  const spendShare = (burn * long) / 60 / HOURS_30D;
  const name = which === "fast" ? "session_start_fast_burn" : which === "slow" ? "session_start_slow_burn" : "session_start_ticket";
  const title = which === "fast" ? "Session start SLO fast burn" : which === "slow" ? "Session start SLO slow burn" : "Session start SLO slow leak";
  const msg = which === "ticket" ? "Session start budget leaking slowly. Open a ticket for the next business day." : `Session start budget burning ${which === "fast" ? "fast" : "steadily"}. Check per-CDN breakdown and runbook RB-DELIVERY-01.`;
  const sev = rule.kind === "page" ? "page" : "ticket";
  const det = res.first != null ? res.first + 1 - sim.inc.start : null;

  const V = ({ children }: { children: ReactNode }) => <span className="slo-v">{children}</span>;
  const C = ({ children }: { children: ReactNode }) => <span className="slo-c">{children}</span>;

  return (
    <div className="slo-dd">
      <div className="slo-dd-head">
        <div>
          <div className="slo-h">Datadog, as code</div>
          <div className="slo-small">The book's burn-rate monitor in Terraform. Highlighted values follow your inputs.</div>
        </div>
        <Segmented<Pick> value={which} onChange={setPicked}
          options={[{ value: "fast", label: "Fast page" }, { value: "slow", label: "Slow page" }, { value: "ticket", label: "Ticket" }]} />
      </div>
      <pre className="slo-code" tabIndex={0} aria-label="Datadog Terraform for the SLO and its burn-rate monitor">
        <code>
{`resource "datadog_service_level_objective" "session_start" {
  name = "Playback availability by session"
  type = "metric"
  query {
    numerator   = "sum:delivery.session.start.good{*}.as_count()"
    denominator = "sum:delivery.session.start.total{*}.as_count()"
  }
  thresholds {
    timeframe = "30d"
    target    = `}<V>{target}</V>{`
  }
}

`}<C>{`# ${burn}x at `}<V>{sloLabel(sim.slo)}</V>{` = `}<V>{pct(burn * b)}</V>{` of sessions failing.
# Fires once ${pct(spendShare)} of the budget is gone in ${winLabel(long)}.
`}{which === "ticket" && `# Workbook ticket is 1x over 3d. Datadog's UI takes long windows up
# to 48h, so this uses 48h and a 4h short window (1/12).
`}{`# This incident: `}<V>{det != null ? `fires after ${dur(det)}` : "does not fire"}</V>{`
`}</C>{`resource "datadog_monitor" "${name}" {
  name    = "${title}"
  type    = "slo alert"
  query   = "burn_rate(\\"\${datadog_service_level_objective.session_start.id}\\").over(\\"30d\\").long_window(\\"`}<V>{winLabel(long)}</V>{`\\").short_window(\\"`}<V>{winLabel(short)}</V>{`\\") > `}<V>{String(burn)}</V>{`"
  message = "${msg}"
  tags    = ["team:media-delivery", "severity:`}<V>{sev}</V>{`"]
}`}
        </code>
      </pre>
    </div>
  );
}
