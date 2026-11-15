import { Suspense, useCallback, type CSSProperties } from "react";
import { Chip, Icon } from "@/ui";
import { progress, useProgress } from "@/state/progress";
import { WIDGETS, WIDGET_LIST } from "@/widgets/registry";
import type { WidgetId } from "@/widgets/ids";
import { chapterByN, partColor, plain } from "./course";
import { BackLink, Boundary, LabCard } from "./common";

export default function LabPage({ id }: { id: string }) {
  const p = useProgress();
  const meta = WIDGETS[id as WidgetId];
  const onComplete = useCallback(() => progress.markWidget(id), [id]);
  if (!meta) {
    return (
      <div className="page narrow">
        <BackLink href="#labs">Labs</BackLink>
        <div className="ui-empty"><strong>Lab not found</strong>There is no lab called "{id}".</div>
      </div>
    );
  }
  const ch = chapterByN(meta.chapter);
  const color = partColor(ch?.part ?? 0);
  const done = !!p.widgets?.[id];
  const C = meta.Component;
  const i = WIDGET_LIST.findIndex((w) => w.id === id);
  const next = WIDGET_LIST[(i + 1) % WIDGET_LIST.length];

  return (
    <div className="page lab" style={{ "--pc": color } as CSSProperties}>
      <BackLink href="#labs">Labs</BackLink>
      <header className="lab-head">
        <div className="pg-eyebrow">
          <span className="pg-dot" style={{ background: color }} />
          <span>Lab · </span>
          {ch ? <a href={`#ch${ch.n}`} className="lab-chlink">Chapter {ch.n}: {plain(ch.short || ch.title)}</a> : <span>Chapter {meta.chapter}</span>}
        </div>
        <div className="lab-title-row">
          <h1 className="pg-title">{meta.title}</h1>
          {done && <Chip tone="good"><Icon name="check" size={13} stroke={2.6} />Done</Chip>}
        </div>
        <p className="pg-sub">{meta.summary}</p>
      </header>

      <div className="lab-stage">
        <Boundary resetKey={id} fallback={() => <div className="ui-empty"><strong>This lab could not start</strong>It may still be in progress. Please try again in a moment.</div>}>
          <Suspense fallback={<div className="lab-skel" aria-busy="true" aria-label="Loading lab"><span /><span /><span /></div>}>
            <C compact={false} onComplete={onComplete} />
          </Suspense>
        </Boundary>
      </div>

      <div className="lab-after">
        {ch && (
          <a href={`#ch${ch.n}`} className="lab-learn">
            <span className="lab-learn-ico"><Icon name="book" size={20} /></span>
            <span><span className="lab-learn-k">Learn the ideas</span><span className="lab-learn-t">Chapter {ch.n}: {plain(ch.title)}</span></span>
            <Icon name="chevron-right" size={18} stroke={2} />
          </a>
        )}
        {next && next.id !== id && <div className="lab-next"><div className="lab-next-k">Next lab</div><LabCard w={next} done={!!p.widgets?.[next.id]} /></div>}
      </div>
    </div>
  );
}
