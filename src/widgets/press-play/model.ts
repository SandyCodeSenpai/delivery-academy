/**
 * Timing model for "One press of Play". Every number here is ASSUMED for one example viewer.
 * It is a teaching model, not a measurement of Crunchyroll or any CDN.
 */

export type ToggleKey = "coldDns" | "newTls" | "slowLicense" | "miss" | "far";
export type Toggles = Record<ToggleKey, boolean>;
export type Plane = "control" | "data" | "player";

export const NO_TOGGLES: Toggles = { coldDns: false, newTls: false, slowLicense: false, miss: false, far: false };
export const ALL_TOGGLES: Toggles = { coldDns: true, newTls: true, slowLicense: true, miss: true, far: true };

/** Assumed inputs, in milliseconds unless the name says otherwise. */
export const A = {
  rttCloud: 60,          // viewer to the cloud region that runs the playback API and the license server
  rttEdgeNear: 20,       // viewer to a nearby CDN PoP
  rttEdgeFar: 150,       // viewer to a far PoP (for example another continent)
  dnsCold: 80,           // one uncached DNS lookup, per hostname
  apiChecks: 80,         // auth, entitlement, geo and licensing-window checks
  steering: 15,          // steering decision and URL signing, inside the cloud region
  edgeLookup: 5,         // edge cache lookup on a HIT
  licenseFast: 40,       // license server work, normal day
  licenseSlow: 600,      // license server work, overloaded (for example at a premiere)
  edgeToShield: 60,      // extra round trip, edge to shield (the shield sits near the origin)
  shieldToOrigin: 10,    // extra round trip, shield to origin
  originFirstByte: 80,   // object storage time to first byte
  manifestKB: 12,
  segmentKB: 700,        // first video segment at a low start rendition, plus the first audio segment
  lastMileMbps: 25,
  initWindowKB: 14.6,    // TCP initial window: 10 packets
  decode: 60,            // decrypt, decode and draw the first frame
};

export const ASSUMPTIONS: string[] = [
  "Round trip to the cloud region (playback API, license server): 60 ms.",
  "Round trip to the CDN edge: 20 ms nearby, 150 ms far away.",
  "Cold DNS: about 80 ms for each new hostname. There are 3: API, CDN and license server.",
  "TLS 1.3. A new handshake costs 1 round trip. A resumed session (0-RTT) costs none. TCP always costs 1 round trip.",
  "Playback API checks take 80 ms. Steering and URL signing take 15 ms.",
  "License server answers in 40 ms, or 600 ms when overloaded.",
  "Cache miss: edge to shield 60 ms, shield to origin 10 ms, storage first byte 80 ms.",
  "First segments: about 0.7 MB (a low start rendition plus audio) over a 25 Mbps last mile, with simple TCP slow start.",
  "Steps run one after another. Real players often fetch the license and first segment in parallel, so real totals can be lower.",
];

export interface ToggleMeta { key: ToggleKey; label: string; hint: string; pick: string }
export const TOGGLES: ToggleMeta[] = [
  { key: "coldDns", label: "Cold DNS lookup", pick: "Cold DNS lookup", hint: "No cached answer: about 80 ms for each of 3 hostnames" },
  { key: "newTls", label: "New TLS connection", pick: "New TLS connection, not resumed", hint: "Off means a resumed session. On adds 1 round trip per host" },
  { key: "slowLicense", label: "Slow license server", pick: "Slow license server", hint: "600 ms to answer instead of 40 ms (assumed)" },
  { key: "miss", label: "Cache miss on first segment", pick: "Cache miss on the first segment", hint: "Edge and shield both miss, so origin sends it" },
  { key: "far", label: "Viewer far from the PoP", pick: "Viewer far from the PoP", hint: "Edge round trip 150 ms instead of 20 ms" },
];

export interface Part { label: string; ms: number; note?: string }
export interface StepInfo {
  id: string; title: string; plane: Plane;
  short: (t: Toggles) => string;
  what: string; owner: string; wrong: string;
}
export interface StepCalc { ms: number; parts: Part[] }

export const STEPS: StepInfo[] = [
  {
    id: "api", title: "Playback API", plane: "control",
    short: () => "The app asks the playback API: may this person watch this episode, here, now? It checks login (auth), the plan (entitlement), the country (geo) and the licensing window.",
    what: "The player sends one small, personal request to a service in a cloud region. The service checks the login token, whether the plan includes this title, which country the viewer is in, and whether the license for that country is open today. The answer cannot be cached, because it is different for every viewer.",
    owner: "Playback team (likely), using geo and entitlement rules from Content Protection.",
    wrong: "At a big premiere, about 10,000 people press play every second. Each start makes about 4 control-plane calls, so this service sees about 40,000 requests per second (assumed model). If it fails, nobody can start, but people already watching keep watching.",
  },
  {
    id: "steer", title: "Steering decision", plane: "control",
    short: () => "The API asks a steering service which CDN should serve this session. It signs the URLs and replies with a manifest URL on that CDN.",
    what: "Steering picks a CDN for this session by performance, availability and cost. The URL carries a signed token, so the CDN can check the request without calling home. The reply goes back to the player.",
    owner: "Media Delivery (steering and URL signing), called by the playback API.",
    wrong: "If health data is stale, steering keeps sending new viewers to a CDN that is failing. The decision is fast. A wrong decision costs much more than a slow one.",
  },
  {
    id: "manifest", title: "Manifest fetch", plane: "data",
    short: () => "The player fetches the manifest from the CDN edge: a small text file that lists renditions, audio, subtitles and segment URLs. The CDN is a new hostname, so DNS, TCP and TLS come first.",
    what: "This is the first request to the CDN. The player resolves the CDN hostname, opens a TCP connection, does TLS, and downloads a file of about 12 KB. A static manifest is the same for everyone, so the edge serves it from cache.",
    owner: "Content Pipeline writes it. Media Delivery serves it.",
    wrong: "If the manifest is personalized (per-user URLs, ads, a baked-in CDN choice), it stops being cacheable and moves to the control plane. Every start then hits your service instead of the CDN.",
  },
  {
    id: "drm", title: "DRM license", plane: "control",
    short: (t) => `Segments are encrypted. The player sends a device challenge to the license server and gets content keys back.${t.slowLicense ? " Today the server is overloaded and slow." : ""}`,
    what: "The license server checks the device and the rights, then returns keys the player can use to decrypt. The CDN never sees these keys: to the CDN, encrypted segments are just files.",
    owner: "Content Protection.",
    wrong: "The license call is on the startup path for every play. Its load follows the rate of new starts, like the playback API. A slow license server delays every first frame, even when the CDN is perfect.",
  },
  {
    id: "segments", title: "First segments", plane: "data",
    short: (t) => t.miss
      ? "The player asks the edge for the first video and audio segments. Edge MISS, then shield MISS: the origin's object storage sends the bytes, and both caches keep a copy."
      : "The player asks the edge for the first video and audio segments. Edge HIT: the bytes are already in the PoP's cache.",
    what: "This reuses the CDN connection from the manifest, so there is no new handshake. The download is about 0.7 MB. TCP starts with a small window and doubles it every round trip (slow start), so download time depends on distance, not only on bandwidth.",
    owner: "Media Delivery owns the bytes path from the origin bucket to the player's socket.",
    wrong: "A miss costs this one viewer a little time. The bigger risk is many misses at once, at a premiere, which is why shields collapse identical requests (Chapters 5, 6 and 13).",
  },
  {
    id: "frame", title: "First frame", plane: "player",
    short: () => "The player decrypts, decodes and draws the first frame. This moment ends the startup time, also called time to first frame.",
    what: "The decoder needs the license keys and enough of the first segment. Then the picture appears and the player keeps fetching the next segments ahead of playback.",
    owner: "Playback team (players on every device). Startup time is reported to analytics as a QoE metric.",
    wrong: "Startup time is the first thing a viewer feels. Watch it by CDN, region, ISP and device, so you can tell which plane and which hop got slower.",
  },
];

/** Time to send `kb` kilobytes with simple TCP slow start: the window doubles every round trip until the link is full. */
export function downloadMs(kb: number, rtt: number, mbps: number, initKB = A.initWindowKB): number {
  const perMs = mbps / 8; // KB per ms
  const linkPerRtt = perMs * rtt;
  let sent = 0, win = initKB, t = 0;
  while (sent < kb) {
    const rest = kb - sent;
    if (win >= linkPerRtt || rest <= win) return t + rest / perMs;
    t += rtt; sent += win; win *= 2;
  }
  return t;
}

const r = (v: number) => Math.round(v);

export function computeSteps(t: Toggles): StepCalc[] {
  const edge = t.far ? A.rttEdgeFar : A.rttEdgeNear;
  const cloud = A.rttCloud;
  const dns = t.coldDns ? A.dnsCold : 0;
  const tls = (rtt: number) => (t.newTls ? rtt : 0);
  const dnsLabel = t.coldDns ? "DNS lookup (cold)" : "DNS lookup (cached)";
  const tlsLabel = t.newTls ? "TLS handshake (new)" : "TLS (resumed, 0-RTT)";
  const mk = (parts: Part[]): StepCalc => ({ parts: parts.map((p) => ({ ...p, ms: r(p.ms) })), ms: parts.reduce((s, p) => s + r(p.ms), 0) });

  const miss = t.miss
    ? [
        { label: "Edge to shield (MISS)", ms: A.edgeToShield },
        { label: "Shield to origin (MISS)", ms: A.shieldToOrigin },
        { label: "Origin storage first byte", ms: A.originFirstByte },
      ]
    : [];

  return [
    mk([
      { label: dnsLabel, ms: dns },
      { label: "TCP handshake", ms: cloud },
      { label: tlsLabel, ms: tls(cloud) },
      { label: "Request travels (half a round trip)", ms: cloud / 2 },
      { label: "Auth, entitlement, geo, window", ms: A.apiChecks },
    ]),
    mk([
      { label: "Steering and URL signing", ms: A.steering },
      { label: "Reply travels (half a round trip)", ms: cloud / 2 },
    ]),
    mk([
      { label: dnsLabel, ms: dns },
      { label: "TCP handshake", ms: edge },
      { label: tlsLabel, ms: tls(edge) },
      { label: "Request and reply", ms: edge },
      { label: "Edge cache lookup (HIT)", ms: A.edgeLookup },
      { label: "Download 12 KB", ms: downloadMs(A.manifestKB, edge, A.lastMileMbps) },
    ]),
    mk([
      { label: dnsLabel, ms: dns },
      { label: "TCP handshake", ms: cloud },
      { label: tlsLabel, ms: tls(cloud) },
      { label: "Request and reply", ms: cloud },
      { label: t.slowLicense ? "License server (slow)" : "License server", ms: t.slowLicense ? A.licenseSlow : A.licenseFast },
    ]),
    mk([
      { label: "Request and reply (reused connection)", ms: edge },
      { label: t.miss ? "Edge cache lookup (MISS)" : "Edge cache lookup (HIT)", ms: A.edgeLookup },
      ...miss,
      { label: "Download 0.7 MB (slow start)", ms: downloadMs(A.segmentKB, edge, A.lastMileMbps) },
    ]),
    mk([{ label: "Decrypt, decode, draw", ms: A.decode }]),
  ];
}

export const totalMs = (t: Toggles) => computeSteps(t).reduce((s, c) => s + c.ms, 0);

/** Cost of each toggle on its own, against the best case. Sorted, biggest first. */
export function soloCosts(): { key: ToggleKey; ms: number }[] {
  const base = totalMs(NO_TOGGLES);
  return TOGGLES.map((m) => ({ key: m.key, ms: totalMs({ ...NO_TOGGLES, [m.key]: true }) - base })).sort((a, b) => b.ms - a.ms);
}

/** Plain-English time. Small parts exact; larger values rounded to 10 ms so we do not pretend to be precise. */
export function fmtTime(ms: number): string {
  if (ms < 100) return `${Math.round(ms)} ms`;
  const v = Math.round(ms / 10) * 10;
  if (v >= 1000) return `${(v / 1000).toFixed(2).replace(/0$/, "")} s`;
  return `${v} ms`;
}
