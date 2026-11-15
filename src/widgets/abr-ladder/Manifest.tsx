import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Segmented } from "@/ui";
import { fmtNum } from "@/lib/format";
import {
  AUDIO_LANGS, LINE_HELP, SUB_LANGS, dashMpd, hlsMaster, hlsMedia, hlsUsesTs, prefix, rungPath, shortRes,
  type Line, type ManifestCtx, type Target,
} from "./model";

export interface ManifestProps {
  ctx: ManifestCtx;
  proto: "hls" | "dash"; setProto: (p: "hls" | "dash") => void;
  open: Target | null; setOpen: (t: Target | null) => void;
  selectedRef: string | null; select: (ref: string) => void;
  showRail: boolean; reduced: boolean;
}

const targetRef = (t: Target) => (t.type === "video" ? t.rungId : `${t.type === "audio" ? "a" : "s"}:${t.lang}`);

export function Manifest(p: ManifestProps) {
  const { ctx } = p;
  const [wrap, setWrap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const view = p.proto === "dash" ? "dash" : p.open ? "media" : "master";
  const media = useMemo(() => (p.open && p.proto === "hls" ? hlsMedia(ctx, p.open, { expanded }) : null), [ctx, p.open, p.proto, expanded]);
  const lines: Line[] = useMemo(() => (view === "dash" ? dashMpd(ctx) : media ? media.lines : hlsMaster(ctx)), [view, ctx, media]);
  const viewKey = `${view}:${p.open ? targetRef(p.open) : ""}`;

  useEffect(() => setActive(null), [viewKey]);

  // Keep the highlighted line in view, scrolling only inside the code box (never the page).
  useEffect(() => {
    const box = boxRef.current; if (!box) return;
    const el = box.querySelector<HTMLElement>(".abr-line.hl");
    if (!el) { box.scrollTo({ top: 0, left: 0 }); return; }
    const top = el.offsetTop - box.clientHeight / 3;
    box.scrollTo({ top: Math.max(0, top), left: 0, behavior: p.reduced ? "auto" : "smooth" });
  }, [p.selectedRef, viewKey, p.reduced, wrap]);

  const isHl = (l: Line) => {
    if (!p.selectedRef || !l.ref || view === "media") return false;
    if (l.ref !== p.selectedRef) return false;
    return l.kind === "stream-inf" || l.kind === "uri" || l.kind === "rep" || l.kind === "media-audio" || l.kind === "media-sub" || l.kind === "aset-audio" || l.kind === "aset-text";
  };

  const onLine = (l: Line, i: number) => {
    setActive(i);
    if (l.ref) p.select(l.ref);
    if (l.kind === "uri" && l.open) p.setOpen(l.open);
  };

  // What the explainer talks about: the clicked line, else the first highlighted line.
  const focusIdx = active ?? lines.findIndex(isHl);
  const focus = focusIdx >= 0 ? lines[focusIdx] : null;
  const openFor = (l: Line | null): Target | null => {
    if (!l || view !== "master") return null;
    if (l.open) return l.open;
    if (l.kind === "stream-inf" && l.ref) return { type: "video", rungId: l.ref };
    return null;
  };
  const focusOpen = openFor(focus);
  const segs = Math.ceil((ctx.minutes * 60) / ctx.segSec - 1e-9);

  const openLabel = (t: Target) => {
    if (t.type === "video") { const r = ctx.rungs.find((x) => x.id === t.rungId); return r ? `${shortRes(r)} playlist` : "playlist"; }
    const list = t.type === "audio" ? AUDIO_LANGS : SUB_LANGS;
    return `${list.find((x) => x.code === t.lang)?.name ?? t.lang} ${t.type === "audio" ? "audio" : "subtitle"} playlist`;
  };

  const dashExpand = (() => {
    if (view !== "dash" || !focus || focus.kind !== "rep" || !focus.ref) return null;
    const r = ctx.rungs.find((x) => x.id === focus.ref);
    if (!r) return null;
    const base = `${prefix(ctx, "dash")}v/${rungPath(ctx.rungs, r)}/`;
    return `${base}init.mp4, ${base}seg_00001.m4s ... seg_${String(segs).padStart(5, "0")}.m4s (${fmtNum(segs)} files)`;
  })();

  const crumbs = view === "master" ? "master.m3u8" : view === "dash" ? "manifest.mpd" : media?.path ?? "";

  return (
    <div className="abr-manifest">
      <div className="abr-mf-toolbar">
        <Segmented value={p.proto} onChange={(v) => { p.setProto(v); }} options={[{ value: "hls", label: "HLS playlists" }, { value: "dash", label: "DASH MPD" }]} />
        <button type="button" className="abr-mini" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>Wrap lines</button>
      </div>

      {p.showRail && (
        <div className="abr-rail" role="group" aria-label="Pick a rung to find its line">
          {ctx.rungs.map((r) => (
            <button key={r.id} type="button" className={`abr-rail-chip ${p.selectedRef === r.id ? "on" : ""}`} aria-pressed={p.selectedRef === r.id}
              onClick={() => p.select(r.id)}>
              <b>{shortRes(r)}</b> {fmtNum(r.kbps / 1000, 1)}M
            </button>
          ))}
        </div>
      )}

      <div className="abr-crumbs">
        {view === "media" ? (
          <>
            <button type="button" className="abr-mini" onClick={() => p.setOpen(null)}>Back to master</button>
            <code className="abr-path" title={crumbs}>{crumbs}</code>
          </>
        ) : <code className="abr-path">{crumbs}</code>}
        <span className="abr-muted abr-small abr-crumbs-meta">{lines.length > 0 && view === "media" && media ? `${fmtNum(media.segs)} segments` : `${lines.length} lines`}</span>
      </div>

      <div ref={boxRef} className={`abr-code ${wrap ? "wrap" : ""}`} role="list" aria-label={`${crumbs} text`} tabIndex={-1}>
        {lines.map((l, i) => {
          const hl = isHl(l);
          const clickable = l.kind !== "close";
          const cls = `abr-line k-${l.kind} ${hl ? "hl" : ""} ${active === i ? "active" : ""} ${l.kind === "uri" ? "link" : ""}`;
          return (
            <div key={i} role="listitem" className="abr-line-row">
              {clickable ? (
                <button type="button" className={cls} onClick={() => (l.kind === "gap" ? setExpanded(true) : onLine(l, i))}
                  aria-label={l.kind === "uri" ? `Open ${l.text}` : undefined}>
                  <span className="abr-ln" aria-hidden="true">{i + 1}</span><span className="abr-lt">{l.text}</span>
                </button>
              ) : (
                <div className={cls}><span className="abr-ln" aria-hidden="true">{i + 1}</span><span className="abr-lt">{l.text}</span></div>
              )}
            </div>
          );
        })}
      </div>

      <div className="abr-explain" aria-live="polite">
        {focus ? (
          <>
            <p><code className="abr-tagname">{tagName(focus)}</code> {LINE_HELP[focus.kind] ?? ""}</p>
            {dashExpand && <p className="abr-small"><span className="abr-muted">The template expands to </span><code className="abr-inline">{dashExpand}</code></p>}
            {focusOpen && <Button size="s" variant="primary" onClick={() => p.setOpen(focusOpen)}>Open {openLabel(focusOpen)}</Button>}
            {view === "media" && expanded && <Button size="s" variant="ghost" onClick={() => setExpanded(false)}>Collapse segments</Button>}
          </>
        ) : (
          <p className="abr-muted">
            {view === "media"
              ? <>This rendition has <b>{fmtNum(segs)}</b> segments of {ctx.segSec} s{hlsUsesTs(ctx) && p.open?.type === "video" ? " in MPEG-TS (the separate HLS copy)" : ""}. Every rung, dub and subtitle language has a list like this. Click any line to see what it does.</>
              : view === "dash" ? <>One XML file replaces every HLS playlist. Click a line to see what it does, or pick a rung to find its Representation.</>
              : <>Click any line to see what it does. Click a URI to open that rendition's media playlist.</>}
          </p>
        )}
        {view === "media" && !expanded && !focus && (
          <Button size="s" variant="ghost" onClick={() => setExpanded(true)}>Show all {fmtNum(segs)} segments</Button>
        )}
      </div>
    </div>
  );
}

function tagName(l: Line): string {
  const t = l.text.trim();
  if (t.startsWith("#")) { const m = t.match(/^#([A-Z0-9-]+)/); return m ? `#${m[1]}` : "#"; }
  if (t.startsWith("<")) { const m = t.match(/^<\/?([A-Za-z]+)/); return m ? `<${m[1]}>` : t; }
  return l.kind === "uri" ? "URI" : "segment";
}
