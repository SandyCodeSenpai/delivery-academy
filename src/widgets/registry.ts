import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { WidgetId } from "./ids";
import type { WidgetProps } from "./types";

export interface WidgetMeta { id: WidgetId; title: string; summary: string; chapter: number; Component: LazyExoticComponent<ComponentType<WidgetProps>> }

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  "playground": { id: "playground", title: "Delivery Playground", summary: "Run Crunchyroll-style delivery end to end: press play, warm or cold caches, break a CDN or an origin region, and follow every hop.", chapter: 18, Component: lazy(() => import("./playground")) },
  "press-play": { id: "press-play", title: "One press of Play", summary: "Step through everything that happens in the second or two after a viewer presses play: control plane first, then bytes.", chapter: 1, Component: lazy(() => import("./press-play")) },
  "tcp-throughput": { id: "tcp-throughput", title: "Latency, loss and throughput", summary: "Move RTT, packet loss and bandwidth and see what a 4-second segment really costs to download.", chapter: 2, Component: lazy(() => import("./tcp-throughput")) },
  "dns-resolve": { id: "dns-resolve", title: "How DNS picks a building", summary: "Walk a lookup from resolver to CDN, then change resolver location, ECS and TTL to see which PoP you get.", chapter: 3, Component: lazy(() => import("./dns-resolve")) },
  "cache-headers": { id: "cache-headers", title: "Cache-Control lab", summary: "Edit response headers and replay a timeline of requests: HIT, MISS, STALE, REVALIDATE.", chapter: 4, Component: lazy(() => import("./cache-headers")) },
  "consistent-hash": { id: "consistent-hash", title: "Spreading a cache across servers", summary: "Add and remove cache servers and watch which objects move, with and without consistent hashing.", chapter: 5, Component: lazy(() => import("./consistent-hash")) },
  "request-collapse": { id: "request-collapse", title: "Request collapsing", summary: "Fire thousands of simultaneous requests at one cold segment, with collapsing on and off.", chapter: 5, Component: lazy(() => import("./request-collapse")) },
  "eviction": { id: "eviction", title: "What to keep: eviction", summary: "Race LRU, LFU and S3-FIFO on a stream of hot episodes and one-hit wonders.", chapter: 5, Component: lazy(() => import("./eviction")) },
  "shield-offload": { id: "shield-offload", title: "Shield and origin offload", summary: "Set edge and shield hit ratios and watch origin load, egress and cost respond.", chapter: 6, Component: lazy(() => import("./shield-offload")) },
  "abr-ladder": { id: "abr-ladder", title: "Ladder and manifest explorer", summary: "Build a bitrate ladder, open the HLS playlists, and see storage multiply with audio and subtitles.", chapter: 7, Component: lazy(() => import("./abr-ladder")) },
  "signed-url": { id: "signed-url", title: "Signed URL tamper lab", summary: "Change the path, expiry, country or signature of a segment URL and see what the edge decides.", chapter: 8, Component: lazy(() => import("./signed-url")) },
  "multi-cdn": { id: "multi-cdn", title: "Multi-CDN steering", summary: "Steer traffic across CDNs by performance, cost and health, then cause an outage and compare failover methods.", chapter: 9, Component: lazy(() => import("./multi-cdn")) },
  "abr-player": { id: "abr-player", title: "Inside the player", summary: "Drive the network and watch the buffer, the chosen bitrate and rebuffering under different ABR algorithms.", chapter: 10, Component: lazy(() => import("./abr-player")) },
  "slo-burn": { id: "slo-burn", title: "Error budgets and burn rates", summary: "Inject incidents of different sizes and see which burn-rate alerts fire and when.", chapter: 11, Component: lazy(() => import("./slo-burn")) },
  "failover": { id: "failover", title: "Health checks and failover", summary: "Tune health-check thresholds and hysteresis, then flap an origin and watch traffic move.", chapter: 12, Component: lazy(() => import("./failover")) },
  "premiere": { id: "premiere", title: "Simulcast premiere", summary: "Launch a premiere: ramp two million viewers, pre-warm caches, add jitter, and protect the origin.", chapter: 13, Component: lazy(() => import("./premiere")) },
  "cost": { id: "cost", title: "Delivery bill calculator", summary: "Set traffic, region mix, hit ratio, codec mix and contract prices, and see the monthly bill.", chapter: 16, Component: lazy(() => import("./cost")) },
};

export const WIDGET_LIST: WidgetMeta[] = Object.values(WIDGETS);
