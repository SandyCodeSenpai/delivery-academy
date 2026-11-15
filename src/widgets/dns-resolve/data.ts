/* Data and models for the "How DNS picks a building" widget.
   Every latency, share and TTL here is an ASSUMED teaching value unless a comment says
   it comes from the book (chapter 3). */

/* ------------------------------------------------------------------ walkthrough */

export type NodeId = "player" | "resolver" | "root" | "tldcom" | "cfdns" | "tldnet" | "gslb" | "pop";
export const SERVERS: NodeId[] = ["root", "tldcom", "cfdns", "tldnet", "gslb"];

export const HOST = "static.crunchyroll.com";
/** AWS's own documentation example distribution name. The real one is not shown. */
export const CDN_NAME = "d111111abcdef8.cloudfront.net";

export const NODE_LABEL: Record<NodeId, { title: string; sub: string }> = {
  player: { title: "Player", sub: "stub resolver" },
  resolver: { title: "Resolver", sub: "ISP, Sao Paulo" },
  root: { title: "Root", sub: "root servers" },
  tldcom: { title: ".com", sub: "TLD servers" },
  cfdns: { title: "crunchyroll.com", sub: "Cloudflare DNS" },
  tldnet: { title: ".net", sub: "TLD servers" },
  gslb: { title: "cloudfront.net", sub: "CloudFront GSLB" },
  pop: { title: "Edge PoP", sub: "Sao Paulo" },
};

export interface CacheEntry { id: string; name: string; type: string; value: string; ttl: number; note: string; server: NodeId }
export const CACHE: CacheEntry[] = [
  { id: "com", name: "com.", type: "NS", value: "a.gtld-servers.net. (+12)", ttl: 172800, note: "root zone value", server: "root" },
  { id: "cr", name: "crunchyroll.com.", type: "NS", value: "*.ns.cloudflare.com.", ttl: 172800, note: ".com delegation", server: "tldcom" },
  { id: "cname", name: `${HOST}.`, type: "CNAME", value: `${CDN_NAME}.`, ttl: 300, note: "assumed", server: "cfdns" },
  { id: "net", name: "cloudfront.net.", type: "NS", value: "AWS name servers", ttl: 172800, note: ".net delegation", server: "tldnet" },
  { id: "a", name: `${CDN_NAME}.`, type: "A", value: "198.51.100.11 (+3)", ttl: 60, note: "seen in a public dig", server: "gslb" },
];

export interface WalkStep {
  from: NodeId; to: NodeId; title: string; body: string;
  ask?: string; reply?: string; replyNote?: string; addMs: number; caches?: string;
  /** "round" = query out and answer back; "one" = one-way message */
  kind: "self" | "one" | "round";
}

/* Latencies (assumed): stub to ISP resolver 4 ms one way. Server round trips from a
   Sao Paulo resolver: root 12, .com 18, Cloudflare 10, .net 20, CloudFront 14. */
export const SERVER_MS: Partial<Record<NodeId, number>> = { root: 12, tldcom: 18, cfdns: 10, tldnet: 20, gslb: 14 };
export const STUB_MS = 4;

export const STEPS: WalkStep[] = [
  {
    from: "player", to: "player", kind: "self", addMs: 0,
    title: "The app needs an address",
    body: `The player wants a file from ${HOST}. It asks the stub resolver, the small DNS client inside the device. The stub's cache is empty, so it must ask someone else.`,
    ask: `${HOST}  A?  AAAA?`, reply: "stub cache: empty",
  },
  {
    from: "player", to: "resolver", kind: "one", addMs: STUB_MS,
    title: "Ask the recursive resolver",
    body: "The stub sends the question to one recursive resolver: here, the ISP's resolver in Sao Paulo. The resolver does the real work for many users. Its cache is cold too, so it starts at the top of the tree.",
    ask: `${HOST}  A?`, reply: "resolver cache: empty",
  },
  {
    from: "resolver", to: "root", kind: "round", addMs: SERVER_MS.root!, caches: "com",
    title: "Root: who runs .com?",
    body: "The root servers do not know the answer. They only know who runs each top-level domain (TLD). They send a referral: go and ask the .com servers.",
    ask: `${HOST}  A?`, reply: "com.  172800  NS  a.gtld-servers.net.  (+12 more)",
    replyNote: "TTL 172,800 s = 2 days",
  },
  {
    from: "resolver", to: "tldcom", kind: "round", addMs: SERVER_MS.tldcom!, caches: "cr",
    title: ".com: who runs crunchyroll.com?",
    body: "The .com servers hold the delegation for crunchyroll.com. A public snapshot (November 2026) showed it points to Cloudflare name servers.",
    ask: `${HOST}  A?`, reply: "crunchyroll.com.  172800  NS  *.ns.cloudflare.com.",
    replyNote: "Another 2-day referral",
  },
  {
    from: "resolver", to: "cfdns", kind: "round", addMs: SERVER_MS.cfdns!, caches: "cname",
    title: "Crunchyroll's zone hands off to the CDN",
    body: "This is the authoritative server for crunchyroll.com. It does not pick a building. It answers with a CNAME, an alias: \"this name is really a CloudFront name\". From here on, CloudFront decides.",
    ask: `${HOST}  A?`, reply: `${HOST}.  300  CNAME  ${CDN_NAME}.`,
    replyNote: "TTL 300 s is assumed",
  },
  {
    from: "resolver", to: "tldnet", kind: "round", addMs: SERVER_MS.tldnet!, caches: "net",
    title: "A new zone: cloudfront.net",
    body: "cloudfront.net lives under .net, a different branch of the tree, so the resolver asks a .net server who runs it. (The root's referral to .net is almost always cached already.) Every CNAME into another zone can cost extra lookups like this one.",
    ask: `${CDN_NAME}  A?`, reply: "cloudfront.net.  172800  NS  (AWS name servers)",
  },
  {
    from: "resolver", to: "gslb", kind: "round", addMs: SERVER_MS.gslb!, caches: "a",
    title: "CloudFront's DNS picks a building",
    body: "CloudFront's authoritative DNS is a GSLB (global server load balancer): it computes each answer. It sees the resolver's IP address, which is in Sao Paulo, and the health of its PoPs. It returns the Sao Paulo PoP, with a short TTL so it can change its mind soon.",
    ask: `${CDN_NAME}  A?`,
    reply: `${CDN_NAME}.  60  A  198.51.100.11  (+3 more)`,
    replyNote: "TTL 60 s matches a public dig. IPs are examples.",
  },
  {
    from: "resolver", to: "player", kind: "one", addMs: STUB_MS,
    title: "Back to the device",
    body: "The resolver returns the whole chain: the CNAME plus the A records. It keeps every piece in its cache, each for its own TTL. The stub caches the answer too.",
    reply: `${HOST}  CNAME  ${CDN_NAME}\n${CDN_NAME}  A  198.51.100.11`,
  },
  {
    from: "player", to: "pop", kind: "one", addMs: 0,
    title: "Connect to the PoP",
    body: "DNS is done. Only now can the player open a TCP or QUIC connection to 198.51.100.11, an edge server in Sao Paulo. Real lookups are usually much faster than this, because most of the chain is already cached.",
  },
];
export const TOTAL_MS = STEPS.reduce((s, x) => s + x.addMs, 0);

/** Which servers a later lookup must contact, `elapsed` seconds after the cold lookup. */
export function laterLookup(elapsed: number) {
  const valid = (id: string) => elapsed < (CACHE.find((c) => c.id === id)?.ttl ?? 0);
  const ask: NodeId[] = [];
  if (!valid("cname")) {
    if (!valid("cr")) { if (!valid("com")) ask.push("root"); ask.push("tldcom"); }
    ask.push("cfdns");
  }
  if (!valid("a")) { if (!valid("net")) ask.push("tldnet"); ask.push("gslb"); }
  const ms = 2 * STUB_MS + ask.reduce((s, n) => s + (SERVER_MS[n] ?? 0), 0);
  return { ask, ms, valid };
}

/* ------------------------------------------------------------------ location lab */

export interface Place { id: string; name: string; lat: number; lon: number }
export interface City extends Place { publicSite: string; short: string }

/** Viewer cities, and the public-resolver site each one is ASSUMED to reach
    (peering sometimes sends a country's traffic to a distant resolver site, book 3.5.1). */
export const CITIES: City[] = [
  { id: "sao", name: "Sao Paulo", short: "Sao Paulo", lat: -23.55, lon: -46.63, publicSite: "MIA" },
  { id: "bue", name: "Buenos Aires", short: "Buenos Aires", lat: -34.6, lon: -58.4, publicSite: "MIA" },
  { id: "lax", name: "Los Angeles", short: "LA", lat: 34.05, lon: -118.24, publicSite: "IAD" },
  { id: "lon", name: "London", short: "London", lat: 51.5, lon: -0.13, publicSite: "FRA" },
  { id: "bom", name: "Mumbai", short: "Mumbai", lat: 19.07, lon: 72.88, publicSite: "SIN" },
  { id: "tyo", name: "Tokyo", short: "Tokyo", lat: 35.68, lon: 139.69, publicSite: "HKG" },
  { id: "syd", name: "Sydney", short: "Sydney", lat: -33.87, lon: 151.21, publicSite: "SIN" },
];

/** CDN PoPs (a generic CDN, not any vendor's real footprint). */
export const POPS: Place[] = [
  { id: "GRU", name: "Sao Paulo", lat: -23.43, lon: -46.47 },
  { id: "EZE", name: "Buenos Aires", lat: -34.82, lon: -58.54 },
  { id: "MIA", name: "Miami", lat: 25.79, lon: -80.29 },
  { id: "LAX", name: "Los Angeles", lat: 33.94, lon: -118.41 },
  { id: "IAD", name: "Ashburn", lat: 38.95, lon: -77.46 },
  { id: "LHR", name: "London", lat: 51.47, lon: -0.45 },
  { id: "FRA", name: "Frankfurt", lat: 50.04, lon: 8.56 },
  { id: "BOM", name: "Mumbai", lat: 19.09, lon: 72.87 },
  { id: "SIN", name: "Singapore", lat: 1.36, lon: 103.99 },
  { id: "HKG", name: "Hong Kong", lat: 22.31, lon: 113.92 },
  { id: "NRT", name: "Tokyo", lat: 35.77, lon: 140.39 },
  { id: "SYD", name: "Sydney", lat: -33.95, lon: 151.18 },
];
export const popById = (id: string) => POPS.find((p) => p.id === id)!;

export function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** RTT model (assumed): 8 ms last mile + 1.6 ms per 100 km of great-circle distance. */
export const rttMs = (km: number) => Math.round(8 + 0.016 * km);
const nearestPop = (p: { lat: number; lon: number }) => POPS.reduce((best, x) => (distKm(p, x) < distKm(p, best) ? x : best), POPS[0]);

export type ResolverKind = "isp" | "public";
export function mapScenario(cityId: string, kind: ResolverKind, ecs: boolean) {
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  const resolverAt: Place = kind === "isp" ? { id: "isp", name: city.name, lat: city.lat + 0.01, lon: city.lon } : popById(city.publicSite);
  const usesSubnet = ecs || kind === "isp" ? ecs : false;
  const seenAt: { lat: number; lon: number } = ecs ? city : resolverAt;
  const pop = nearestPop(seenAt);
  const best = nearestPop(city);
  const km = distKm(city, pop), bestKm = distKm(city, best);
  return { city, resolverAt, usesSubnet, pop, best, km, rtt: rttMs(km), bestRtt: rttMs(bestKm), wrong: pop.id !== best.id };
}

/* ------------------------------------------------------------------ TTL and failover */

export const TTL_STOPS = [20, 30, 60, 120, 300, 600, 900, 1800, 3600];
/** Health check every 10 s, 3 failures (30 s), plus 10 s for the GSLB answer to change. */
export const DETECT_S = 40;
export const FLOOR_TTL = 300;
export const IGNORE_HOLD = 7200;
export const CLASSES = [
  { id: "honor", label: "Honor your TTL", share: 0.85, color: "var(--p2)" },
  { id: "floor", label: `Enforce a ${FLOOR_TTL / 60}-min minimum TTL`, share: 0.1, color: "var(--warn)" },
  { id: "ignore", label: "Ignore TTL (keep ~2 h)", share: 0.05, color: "var(--bad)" },
] as const;
export type ClassId = (typeof CLASSES)[number]["id"];

export const effTtl = (cls: ClassId, ttl: number) => (cls === "honor" ? ttl : cls === "floor" ? Math.max(ttl, FLOOR_TTL) : Math.max(ttl, IGNORE_HOLD));

/** Fraction of one resolver class still answering with the dead PoP at time t (seconds after the outage).
    Each resolver's cached copy expires at a uniformly random moment within one effective TTL
    after the GSLB has stopped handing out the dead PoP. */
export function stillDead(cls: ClassId, ttl: number, t: number) {
  if (t < DETECT_S) return 1;
  const e = effTtl(cls, ttl);
  return Math.max(0, 1 - (t - DETECT_S) / e);
}
export const totalDead = (ttl: number, t: number) => CLASSES.reduce((s, c) => s + c.share * stillDead(c.id, ttl, t), 0);
export const ttlXMax = (ttl: number) => Math.max(240, DETECT_S + 1.25 * Math.max(ttl, FLOOR_TTL));

export function timeBelow(ttl: number, frac: number) {
  for (let t = 0; t < IGNORE_HOLD * 2; t += 1) if (totalDead(ttl, t) <= frac) return t;
  return Infinity;
}

export function fmtDur(s: number) {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) { const m = s / 60; return `${m < 10 ? Math.round(m * 10) / 10 : Math.round(m)} min`; }
  const h = s / 3600; return `${Math.round(h * 10) / 10} h`;
}
export const fmtTtl = (s: number) => (s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
