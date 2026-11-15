import type { Visual, FlowSpec } from "@/content/types";
// Owned by the diagram-engine agent: sample visuals covering every feature, shown at #diagrams.

const deliveryPath: FlowSpec = {
  nodes: [
    { id: "steer", label: "Steering service", sub: "picks the CDN", kind: "steering", col: 0, row: 0 },
    { id: "viewer", label: "Viewer", sub: "Crunchyroll app", kind: "viewer", col: 0, row: 1 },
    { id: "isp", label: "ISP network", sub: "last mile", kind: "isp", col: 1, row: 1 },
    { id: "pop", label: "Edge PoP", sub: "Tokyo, 95% of bytes", kind: "pop", col: 2, row: 1, badge: "HIT" },
    { id: "shield", label: "Origin shield", sub: "mid-tier cache", kind: "shield", col: 3, row: 1 },
    { id: "s3", label: "Origin (S3)", sub: "us-east-1", kind: "storage", col: 4, row: 0 },
    { id: "gcs", label: "GCS replica", sub: "backup origin", kind: "storage", col: 4, row: 2 },
  ],
  edges: [
    { from: "viewer", to: "steer", label: "which CDN?", dashed: true },
    { from: "viewer", to: "isp" },
    { from: "isp", to: "pop", label: "GET segment" },
    { from: "pop", to: "shield", label: "on a miss" },
    { from: "shield", to: "s3", label: "fetch" },
    { from: "shield", to: "gcs", label: "failover", dashed: true, tone: "warn" },
  ],
  groups: [
    { id: "cdn", label: "CDN", nodes: ["pop", "shield"] },
    { id: "origins", label: "Origins", nodes: ["s3", "gcs"] },
  ],
};

const collapse: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "v1", label: "Viewer", sub: "Osaka", kind: "device", col: 0, row: 0 },
    { id: "v2", label: "Viewer", sub: "Nagoya", kind: "device", col: 1, row: 0 },
    { id: "v3", label: "Viewer", sub: "Sapporo", kind: "device", col: 2, row: 0, badge: "x32" },
    { id: "edge", label: "Edge server", sub: "collapses requests", kind: "edge", col: 1, row: 1, badge: "MISS" },
    { id: "shield", label: "Shield", sub: "one fetch in flight", kind: "shield", col: 1, row: 2, tone: "good" },
    { id: "origin", label: "Origin", sub: "sees 1 request", kind: "origin", col: 1, row: 3 },
    { id: "mon", label: "Origin monitor", sub: "RPS + 5xx", kind: "monitor", col: 2, row: 3, badge: "OK" },
  ],
  edges: [
    { from: "v1", to: "edge" }, { from: "v2", to: "edge", label: "same segment" }, { from: "v3", to: "edge" },
    { from: "edge", to: "shield", label: "1 request" },
    { from: "shield", to: "origin", label: "1 request", tone: "good" },
    { from: "origin", to: "mon", dashed: true },
  ],
  groups: [{ id: "pop", label: "Tokyo PoP", nodes: ["edge"], tone: "accent" }],
  focus: ["edge", "shield", "origin", "edge>shield", "shield>origin"],
};

const dense: FlowSpec = {
  nodes: [
    { id: "studio", label: "Studio master", sub: "ProRes mezzanine", kind: "studio", col: 0, row: 0 },
    { id: "enc", label: "Encoder", sub: "ABR ladder, 7 rungs", kind: "encoder", col: 1, row: 0 },
    { id: "pkg", label: "Packager", sub: "HLS + DASH, CMAF", kind: "packager", col: 2, row: 0 },
    { id: "origin", label: "Origin", sub: "S3 bucket", kind: "storage", col: 3, row: 0 },
    { id: "drm", label: "DRM keys", sub: "Widevine, FairPlay", kind: "drm", col: 1, row: 1 },
    { id: "shield", label: "Shield", kind: "shield", col: 3, row: 2 },
    { id: "cdnA", label: "CDN A", sub: "60% of traffic", kind: "cdn", col: 4, row: 1 },
    { id: "cdnB", label: "CDN B", sub: "30% of traffic", kind: "cdn", col: 4, row: 2 },
    { id: "cdnC", label: "CDN C", sub: "10%, standby", kind: "cdn", col: 4, row: 3, tone: "warn", badge: "SLOW" },
    { id: "viewers", label: "Viewers", sub: "2M at premiere", kind: "viewer", col: 5, row: 2 },
    { id: "steer", label: "Steering", sub: "per-session choice", kind: "steering", col: 2, row: 3 },
  ],
  edges: [
    { from: "studio", to: "enc" }, { from: "enc", to: "pkg" }, { from: "pkg", to: "origin" },
    { from: "drm", to: "pkg", label: "content keys", dashed: true },
    { from: "origin", to: "shield" },
    { from: "shield", to: "cdnA" }, { from: "shield", to: "cdnB" }, { from: "shield", to: "cdnC" },
    { from: "cdnA", to: "viewers" }, { from: "cdnB", to: "viewers" }, { from: "cdnC", to: "viewers", tone: "warn" },
    { from: "steer", to: "cdnC", label: "drain", dashed: true, tone: "bad" },
    { from: "viewers", to: "steer", label: "QoE beacons", dashed: true },
  ],
  focus: ["shield", "cdnA", "cdnB", "cdnC", "viewers", "steer", "steer>cdnC", "viewers>steer"],
};

export const DEMOS: Visual[] = [
  {
    kind: "flow",
    spec: deliveryPath,
    caption: "The full delivery path. Most requests stop at the **edge PoP**; only misses travel on to the shield and the origin.",
  },
  {
    kind: "flow",
    spec: {
      ...deliveryPath,
      focus: ["viewer", "isp", "pop", "shield", "s3"],
      flow: ["viewer>isp", "isp>pop", "pop>shield", "shield>s3"],
    },
    caption: "Same diagram, next step: `focus` dims everything else and the packet follows a cache miss to the origin.",
  },
  {
    kind: "sequence",
    spec: {
      actors: [
        { id: "player", label: "Player", kind: "player" },
        { id: "edge", label: "Edge PoP", kind: "pop" },
        { id: "shield", label: "Origin shield", kind: "shield" },
        { id: "origin", label: "Origin (S3)", kind: "storage" },
      ],
      messages: [
        { from: "player", to: "edge", label: "GET /ep1/1080p/seg_42.m4s" },
        { from: "edge", to: "shield", label: "MISS: forward the request", tone: "warn" },
        { from: "shield", to: "origin", label: "MISS: fetch from origin", tone: "warn" },
        { from: "origin", to: "shield", label: "200 OK, 2.1 MB", dashed: true, tone: "good" },
        { from: "shield", to: "shield", label: "Store for 24 hours", note: "Cache-Control: max-age=86400" },
        { from: "shield", to: "edge", label: "200 OK", dashed: true, tone: "good" },
        { from: "edge", to: "player", label: "200 OK, next viewer gets a HIT", dashed: true, tone: "good" },
      ],
      upTo: 4,
    },
    caption: "A cache miss, revealed step by step with `upTo`. Faint rows are the messages still to come.",
  },
  {
    kind: "sequence",
    spec: {
      actors: [
        { id: "player", label: "Player", kind: "player" },
        { id: "cdn", label: "CDN", kind: "cdn" },
        { id: "api", label: "Playback API", kind: "api" },
        { id: "lic", label: "License server", kind: "drm" },
      ],
      messages: [
        { from: "player", to: "cdn", label: "GET master.m3u8" },
        { from: "cdn", to: "player", label: "Playlist with key ID", dashed: true },
        { from: "player", to: "lic", label: "License request (challenge + token)", tone: "accent" },
        { from: "lic", to: "api", label: "Is this user entitled?" },
        { from: "api", to: "lic", label: "Yes, premium tier", dashed: true, tone: "good" },
        { from: "lic", to: "player", label: "License with content key", dashed: true, tone: "accent", note: "Key never leaves the secure decoder" },
        { from: "player", to: "player", label: "Decrypt and play" },
      ],
    },
    caption: "Getting a DRM license. The content key travels inside the license, not with the video.",
  },
  {
    kind: "flow",
    spec: dense,
    caption: "A dense multi-CDN picture with 11 nodes: one origin, a shield, three CDNs and a steering loop.",
  },
  {
    kind: "flow",
    spec: collapse,
    caption: "Request collapsing in a `down` diagram: 32 viewers miss at once, and the origin still sees one request.",
  },
  {
    kind: "table",
    headers: ["Tier", "Where it runs", "Hit ratio (bytes)", "Typical latency"],
    rows: [
      ["Edge PoP", "Inside or next to the ISP", "90–95%", "5–20 ms"],
      ["Origin shield", "One per region", "60–80% of edge misses", "20–60 ms"],
      ["Origin", "S3 in us-east-1", "n/a", "80–200 ms"],
      ["Backup origin", "GCS multi-region (*assumed*)", "n/a", "100–250 ms"],
    ],
    caption: "Each cache tier hides most of the traffic from the tier behind it.",
  },
  {
    kind: "code",
    lang: "m3u8",
    code: `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://key-42",KEYFORMAT="com.apple.streamingkeydelivery"
#EXTINF:6.000,
seg_00000.m4s
#EXTINF:6.000,
seg_00001.m4s
# a comment line
#EXT-X-ENDLIST`,
    caption: "A media playlist: 6-second segments and a FairPlay key reference.",
  },
  {
    kind: "stats",
    items: [
      { value: "8 Tbps", label: "Peak egress", note: "Design for about 12 Tbps" },
      { value: "95%+", label: "Cache hit ratio", note: "By bytes, at the edge" },
      { value: "2M", label: "Concurrent viewers", note: "Big simulcast premiere" },
      { value: "540 PB", label: "Delivered a month", note: "Assumed, at ~4 Mbps" },
    ],
    caption: "The running example in four numbers (assumed unless cited).",
  },
  {
    kind: "compare",
    left: { title: "Single CDN", points: ["One contract and one set of logs", "Simple to operate and to debug", "An outage or a bad PoP hits **every** viewer"] },
    right: { title: "Multi-CDN with steering", points: ["Move traffic away from a slow CDN in minutes", "Better prices through competition", "Needs a steering service and shared QoE data"] },
    caption: "The trade-off at the center of chapter 12.",
  },
];
