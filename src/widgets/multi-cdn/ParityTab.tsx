import { useMemo, useState } from "react";
import { Button, Chip, Icon, Segmented, Stage, Toggle, WidgetFrame } from "@/ui";
import { CDNS, CDN_COLOR, type CdnId } from "./model";
import { Predict, type PredictQ } from "./Predict";

type ReqId = "valid" | "expired" | "range" | "manifest";
interface Req { id: ReqId; label: string; line: string; extra: string[] }
type Resp = Record<string, string>; // header name -> value. "status" is the status line.

// All hostnames, tokens and hashes are illustrative (9.10.2), not real.
const REQS: Req[] = [
  { id: "valid", label: "Valid token", line: "GET /ep1234/1080p/seg_00042.m4s?tok=VALID", extra: ["Origin: https://www.example.com"] },
  { id: "expired", label: "Expired token", line: "GET /ep1234/1080p/seg_00042.m4s?tok=EXPIRED", extra: ["Origin: https://www.example.com", "(token expired 2 hours ago)"] },
  { id: "range", label: "Range", line: "GET /ep1234/1080p/seg_00042.m4s?tok=VALID", extra: ["Range: bytes=0-1023"] },
  { id: "manifest", label: "Manifest", line: "GET /ep1234/1080p/video.m3u8?tok=VALID", extra: ["Accept-Encoding: gzip"] },
];

/** Headers that define behaviour. These must match on every CDN. Everything else is vendor detail. */
const BEHAVIOUR = ["status", "cache-control", "content-type", "content-range", "content-encoding", "access-control-allow-origin", "body sha256"];

const SEG_OK = { "cache-control": "public, max-age=31536000, immutable", "content-type": "video/mp4", "access-control-allow-origin": "*", "body sha256": "9f2c…41ab" };
const DENY = { "status": "403 Forbidden", "cache-control": "no-store", "content-type": "text/plain", "access-control-allow-origin": "*", "body sha256": "e3b0…b855" };
const VENDOR: Record<CdnId, (age: number) => Resp> = {
  A: (age) => ({ "server": "edge-a", "x-cache": "HIT", "age": String(age) }),
  B: (age) => ({ "server": "b-cache/7", "x-cache-status": "HIT", "age": String(age), "via": "1.1 b-edge" }),
  C: (age) => ({ "server": "c-proxy", "cache-status": "c-edge; hit", "age": String(age) }),
};

const perCdn = (f: (c: CdnId, i: number) => Resp): Record<CdnId, Resp> => ({ A: f("A", 0), B: f("B", 1), C: f("C", 2) });

const RESP: Record<ReqId, Record<CdnId, Resp>> = {
  valid: {
    A: { status: "200 OK", ...SEG_OK, ...VENDOR.A(812) },
    B: { status: "200 OK", ...SEG_OK, ...VENDOR.B(15) },
    C: { status: "200 OK", ...SEG_OK, ...VENDOR.C(3402) },
  },
  expired: {
    A: { ...DENY, "server": "edge-a" },
    B: { ...DENY, "server": "b-cache/7", "via": "1.1 b-edge" },
    C: { status: "200 OK", ...SEG_OK, ...VENDOR.C(3410) }, // the bug: token check missing after a hot-fix
  },
  range: perCdn((c, i) => ({ status: "206 Partial Content", ...SEG_OK, "content-range": "bytes 0-1023/2391044", "body sha256": "51d7…0c9e", ...VENDOR[c]([640, 22, 2950][i]) })),
  manifest: perCdn((c, i) => ({ status: "200 OK", "cache-control": "public, max-age=86400", "content-type": "application/vnd.apple.mpegurl", "content-encoding": "gzip", "access-control-allow-origin": "*", "body sha256": "77ae…3f10", ...VENDOR[c]([120, 4, 610][i]) })),
};

/** A short, stable fingerprint of the behaviour headers, like the book's `| sort | md5` check. Illustrative. */
function digest(r: Resp): string {
  const s = BEHAVIOUR.map((h) => `${h}:${r[h] ?? ""}`).join("\n");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const PREDICT: PredictQ[] = [{
  id: "dash",
  prompt: <>Suppose one CDN stops checking URL tokens after a hot-fix. Will your QoE dashboards show it?</>,
  options: ["Yes, its error rate goes up", "No, viewers still get video, so QoE looks perfect", "Only for web players"],
  answer: 1,
  explain: <>A missing token check fails <i>open</i>: every request succeeds. Start time and rebuffering look great. Only a conformance test that expects a 403 catches it. Now run the golden requests and find the CDN.</>,
}];

const FEEDBACK: Record<CdnId | "none", string> = {
  A: "CDN A answers like B on every request. Its server, x-cache and age values differ from the others, but those are vendor fields: they change nothing for the player.",
  B: "CDN B has its own server, via and age values, but its behaviour headers match the majority on every request. Vendor fields are expected to differ.",
  C: "",
  none: "Look again at a request where the right answer is a refusal. Compare the status lines, not the server names.",
};

export default function ParityTab({ wide }: { wide: boolean }) {
  const [req, setReq] = useState<ReqId>("valid");
  const [vendor, setVendor] = useState(true);
  const [seen, setSeen] = useState<Set<ReqId>>(new Set(["valid"]));
  const [guess, setGuess] = useState<CdnId | "none" | null>(null);
  const solved = guess === "C";
  const resp = RESP[req];

  const headers = useMemo(() => {
    const all = new Set<string>();
    CDNS.forEach((c) => Object.keys(resp[c]).forEach((h) => all.add(h)));
    const beh = BEHAVIOUR.filter((h) => all.has(h));
    const ven = [...all].filter((h) => !BEHAVIOUR.includes(h)).sort();
    return { beh, ven };
  }, [resp]);

  const majority = (h: string) => {
    const vals = CDNS.map((c) => resp[c][h] ?? "");
    return vals.find((v) => vals.filter((x) => x === v).length >= 2) ?? null;
  };
  const pick = (r: ReqId) => { setReq(r); setSeen((s) => new Set(s).add(r)); };
  const digests = CDNS.map((c) => digest(resp[c]));
  const majDigest = digests.find((d) => digests.filter((x) => x === d).length >= 2);

  const rows = [...headers.beh.map((h) => ({ h, kind: "beh" as const })), ...(vendor ? headers.ven.map((h) => ({ h, kind: "ven" as const })) : [])];
  const cellCls = (h: string, kind: "beh" | "ven", c: CdnId) => {
    const v = resp[c][h] ?? "";
    const m = majority(h);
    if (m === null) return kind === "ven" ? "is-vendor" : "";
    if (v === m) return "";
    return kind === "beh" ? "is-diff" : "is-vendor";
  };
  const val = (c: CdnId, h: string) => resp[c][h] ?? "(missing)";

  const stage = (
    <Stage className="mcdn-stage">
      <div className="mcdn-reqline">
        <code>{REQS.find((r) => r.id === req)!.line}</code>
        {REQS.find((r) => r.id === req)!.extra.map((e) => <code key={e} className="mcdn-muted">{e}</code>)}
        <span className="mcdn-muted">sent to cdn-a, cdn-b and cdn-c.example.com</span>
      </div>
      {wide ? (
        <div className="mcdn-ptable" role="table" aria-label="Response headers from three CDNs">
          <div className="mcdn-prow mcdn-phead" role="row">
            <span role="columnheader">Header</span>
            {CDNS.map((c) => <span key={c} role="columnheader"><i className="mcdn-sw" style={{ background: CDN_COLOR[c] }} />CDN {c}</span>)}
          </div>
          {rows.map(({ h, kind }) => (
            <div key={h} className={`mcdn-prow k-${kind}`} role="row">
              <span role="rowheader" className="mcdn-hname">{h}</span>
              {CDNS.map((c) => <span key={c} role="cell" className={`mcdn-pval ${cellCls(h, kind, c)}`}>{val(c, h)}</span>)}
            </div>
          ))}
          <div className="mcdn-prow mcdn-pdigest" role="row">
            <span role="rowheader" className="mcdn-hname">behaviour digest</span>
            {CDNS.map((c, i) => <span key={c} role="cell" className={`mcdn-pval ${digests[i] !== majDigest ? "is-diff" : "is-same"}`}>{digests[i]}</span>)}
          </div>
        </div>
      ) : (
        <div className="mcdn-plist" role="list" aria-label="Response headers from three CDNs">
          {rows.map(({ h, kind }) => (
            <div key={h} className={`mcdn-pblock k-${kind}`} role="listitem">
              <div className="mcdn-hname">{h}</div>
              {CDNS.map((c) => (
                <div key={c} className={`mcdn-pline ${cellCls(h, kind, c)}`}><i className="mcdn-sw" style={{ background: CDN_COLOR[c] }} /><b>{c}</b><span>{val(c, h)}</span></div>
              ))}
            </div>
          ))}
          <div className="mcdn-pblock mcdn-pdigest" role="listitem">
            <div className="mcdn-hname">behaviour digest</div>
            {CDNS.map((c, i) => (
              <div key={c} className={`mcdn-pline ${digests[i] !== majDigest ? "is-diff" : "is-same"}`}><i className="mcdn-sw" style={{ background: CDN_COLOR[c] }} /><b>{c}</b><span>{digests[i]}</span></div>
            ))}
          </div>
        </div>
      )}
      <p className="mcdn-note"><span className="mcdn-key-diff" aria-hidden="true" /> behaviour differs from the other two · <span className="mcdn-key-vendor" aria-hidden="true" /> vendor field differs (expected). Digest = hash of the behaviour headers only.</p>
    </Stage>
  );

  const controls = (
    <>
      <Segmented label="Golden request" value={req} onChange={pick} options={REQS.map((r) => ({ value: r.id, label: r.label }))} />
      <Toggle label="Show vendor headers" hint="server, age, x-cache, via" checked={vendor} onChange={setVendor} />
      <div className="mcdn-ctl-note">Requests run: {seen.size} of {REQS.length}</div>
    </>
  );

  const footer = (
    <div className="mcdn-foot">
      <section className="mcdn-spot" aria-label="Spot the misconfigured CDN">
        <div className="mcdn-predict-head"><span className="mcdn-eyebrow"><Icon name="search" size={15} />Spot it</span></div>
        <p className="mcdn-predict-q">Which CDN should not get more traffic until its config is fixed?</p>
        <div className="mcdn-spot-opts">
          {CDNS.map((c) => (
            <Button key={c} size="s" variant={guess === c ? (solved ? "good" : "danger") : "secondary"} aria-pressed={guess === c}
              onClick={() => { if (!solved) setGuess(c); }}>
              <i className="mcdn-sw" style={{ background: CDN_COLOR[c] }} />CDN {c}
            </Button>
          ))}
          <Button size="s" variant={guess === "none" ? "danger" : "secondary"} aria-pressed={guess === "none"} onClick={() => { if (!solved) setGuess("none"); }}>They all match</Button>
        </div>
        {guess && !solved && <div className="mcdn-predict-why bad" role="status"><strong>Not that one.</strong> {FEEDBACK[guess]}</div>}
        {solved && (
          <div className="mcdn-predict-why good" role="status">
            <strong>Found it.</strong> CDN C returns <code>200 OK</code> and the full segment for an <b>expired token</b>, where A and B return <code>403</code>. Its token check is missing, likely from a hot-fix during an incident that was never applied to the others. Viewers notice nothing, so QoE stays green, but anyone with an old URL can download from C. And C is the cheapest CDN, so a cost-heavy policy would send <i>more</i> traffic there.
            <div className="mcdn-fix"><Chip tone="accent">Fix</Chip> Generate every vendor's config from one intent model, and run these golden requests on every change and on a schedule in production (9.10.2).</div>
          </div>
        )}
        {!guess && seen.size < 2 && <p className="mcdn-ctl-note">Hint: run more than one golden request.</p>}
      </section>
    </div>
  );

  return (
    <div className="mcdn-tab">
      <Predict questions={PREDICT} />
      <WidgetFrame stage={stage} controls={controls} footer={footer} />
    </div>
  );
}
