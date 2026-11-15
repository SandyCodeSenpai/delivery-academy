import type { Chapter, FlowSpec, SequenceSpec } from "./types";

// Chapter 9 content. Source: chapters/09-multi-cdn-and-steering.md

/* ---------------- Shared visuals (repeated across steps with a different focus) ---------------- */

const MULTI: FlowSpec = {
  nodes: [
    { id: "v", label: "Viewers", sub: "one episode", kind: "viewer", col: 0, row: 1 },
    { id: "a", label: "CDN A", kind: "cdn", col: 1, row: 0 },
    { id: "b", label: "CDN B", kind: "cdn", col: 1, row: 1 },
    { id: "c", label: "CDN C", kind: "cdn", col: 1, row: 2 },
    { id: "o", label: "Origin", sub: "same content", kind: "origin", col: 2, row: 1 },
  ],
  edges: [
    { from: "v", to: "a", label: "session 1" },
    { from: "v", to: "b", label: "session 2" },
    { from: "v", to: "c", label: "session 3" },
    { from: "a", to: "o" },
    { from: "b", to: "o" },
    { from: "c", to: "o" },
  ],
};

const SHIELD: FlowSpec = {
  nodes: [
    { id: "a", label: "CDN A", kind: "cdn", col: 0, row: 0 },
    { id: "b", label: "CDN B", kind: "cdn", col: 0, row: 1 },
    { id: "c", label: "CDN C", kind: "cdn", col: 0, row: 2 },
    { id: "sh", label: "Shared shield", sub: "one mid-tier cache", kind: "shield", col: 1, row: 1, tone: "good" },
    { id: "o", label: "Origin", sub: "sees far fewer fetches", kind: "origin", col: 2, row: 1 },
  ],
  edges: [
    { from: "a", to: "sh", label: "miss" },
    { from: "b", to: "sh", label: "miss" },
    { from: "c", to: "sh", label: "miss" },
    { from: "sh", to: "o", label: "one fetch" },
  ],
  flow: ["b>sh", "sh>o"],
};

const DECIDE: FlowSpec = {
  nodes: [
    { id: "p", label: "Player", sub: "on a device", kind: "player", col: 0, row: 2 },
    { id: "api", label: "Playback API", sub: "and manifest service", kind: "api", col: 1, row: 0 },
    { id: "dns", label: "Steering DNS", kind: "dns", col: 1, row: 1 },
    { id: "sts", label: "Steering server", sub: "Content Steering", kind: "steering", col: 1, row: 2 },
    { id: "a", label: "CDN A", kind: "cdn", col: 1, row: 3 },
    { id: "b", label: "CDN B", kind: "cdn", col: 1, row: 4 },
    { id: "sh", label: "Shared shield", kind: "shield", col: 2, row: 3 },
    { id: "o", label: "Origin storage", sub: "on AWS and GCP", kind: "storage", col: 3, row: 3 },
  ],
  edges: [
    { from: "p", to: "api", label: "1. start session", both: true },
    { from: "p", to: "dns", label: "2. resolve name" },
    { from: "p", to: "sts", label: "3. every TTL" },
    { from: "p", to: "a", label: "segments" },
    { from: "p", to: "b", label: "4. on error", dashed: true, tone: "warn" },
    { from: "a", to: "sh" },
    { from: "b", to: "sh" },
    { from: "sh", to: "o" },
  ],
};

const DNS_SEQ: SequenceSpec = {
  actors: [
    { id: "pl", label: "Player", kind: "player" },
    { id: "rr", label: "Resolver", kind: "resolver" },
    { id: "sd", label: "Steering DNS", kind: "dns" },
    { id: "ca", label: "CDN A DNS", kind: "dns" },
    { id: "pop", label: "CDN A PoP", kind: "pop" },
  ],
  messages: [
    { from: "pl", to: "rr", label: "video.example.com?" },
    { from: "rr", to: "sd", label: "query video.example.com" },
    { from: "sd", to: "rr", label: "CNAME to CDN A host, TTL 30s", note: "picked with RUM data", dashed: true, tone: "accent" },
    { from: "rr", to: "ca", label: "resolve CDN A hostname" },
    { from: "ca", to: "rr", label: "IP of a nearby CDN A PoP", dashed: true },
    { from: "rr", to: "pl", label: "IP address", dashed: true },
    { from: "pl", to: "pop", label: "HTTPS segment requests", tone: "good" },
  ],
};

const SESSION: FlowSpec = {
  nodes: [
    { id: "p1", label: "Session 1", sub: "episode 1234", kind: "player", col: 0, row: 0 },
    { id: "p2", label: "Session 2", sub: "same episode", kind: "player", col: 0, row: 2 },
    { id: "api", label: "Playback API", sub: "entitlement, then CDN", kind: "api", col: 1, row: 1, tone: "accent" },
    { id: "a", label: "CDN A", kind: "cdn", col: 2, row: 0 },
    { id: "b", label: "CDN B", kind: "cdn", col: 2, row: 2 },
  ],
  edges: [
    { from: "p1", to: "api", label: "start session" },
    { from: "p2", to: "api", label: "start session" },
    { from: "p1", to: "a", label: "cdn-a URLs" },
    { from: "p2", to: "b", label: "cdn-b URLs" },
  ],
};

const CLIENT: FlowSpec = {
  nodes: [
    { id: "p", label: "Player", sub: "decides by itself", kind: "player", col: 0, row: 1 },
    { id: "a", label: "CDN A", sub: "fails or slows", kind: "cdn", col: 1, row: 0, tone: "bad", badge: "ERR" },
    { id: "b", label: "CDN B", sub: "second location", kind: "cdn", col: 1, row: 2 },
  ],
  edges: [
    { from: "p", to: "a", label: "segments", tone: "bad" },
    { from: "p", to: "b", label: "retry here", dashed: true, tone: "good" },
  ],
  flow: ["p>b"],
};

const C3: FlowSpec = {
  nodes: [
    { id: "ctrl", label: "Central controller", sub: "global model", kind: "service", col: 1, row: 0, tone: "accent" },
    { id: "p1", label: "Player", sub: "senses and acts", kind: "player", col: 0, row: 1 },
    { id: "p2", label: "Player", sub: "senses and acts", kind: "player", col: 1, row: 1 },
    { id: "p3", label: "Player", sub: "senses and acts", kind: "player", col: 2, row: 1 },
  ],
  edges: [
    { from: "p1", to: "ctrl", label: "QoE up", both: true },
    { from: "p2", to: "ctrl", both: true },
    { from: "p3", to: "ctrl", label: "CDN, bitrate", both: true },
  ],
  direction: "down",
};

const CS: FlowSpec = {
  nodes: [
    { id: "p", label: "Player", kind: "player", col: 0, row: 1 },
    { id: "sts", label: "Steering server", sub: "returns pathway order", kind: "steering", col: 1, row: 0, tone: "accent" },
    { id: "a", label: "CDN-A pathway", sub: "same content", kind: "cdn", col: 1, row: 1 },
    { id: "b", label: "CDN-B pathway", sub: "same content", kind: "cdn", col: 1, row: 2 },
  ],
  edges: [
    { from: "p", to: "sts", label: "GET every TTL", both: true },
    { from: "p", to: "a", label: "segments" },
    { from: "p", to: "b", label: "if A penalized", dashed: true },
  ],
};

const CS_SEQ: SequenceSpec = {
  actors: [
    { id: "pl", label: "Player", kind: "player" },
    { id: "api", label: "Playback API", kind: "api" },
    { id: "st", label: "Steering server", kind: "steering" },
    { id: "a", label: "CDN A", kind: "cdn" },
    { id: "b", label: "CDN B", kind: "cdn" },
  ],
  messages: [
    { from: "pl", to: "api", label: "start session for episode" },
    { from: "api", to: "pl", label: "playlist with pathways CDN-A, CDN-B", dashed: true },
    { from: "pl", to: "st", label: "GET steering, pathway CDN-A" },
    { from: "st", to: "pl", label: "priority CDN-A, CDN-B; TTL 300", dashed: true },
    { from: "pl", to: "a", label: "media playlists and segments", tone: "good" },
    { from: "pl", to: "a", label: "segment requests time out", note: "CDN A degrades in this region", tone: "bad" },
    { from: "pl", to: "pl", label: "penalize CDN-A, apply CDN-B", tone: "warn" },
    { from: "pl", to: "b", label: "same rendition, next segment", tone: "good" },
    { from: "pl", to: "st", label: "reload after TTL, pathway CDN-B" },
    { from: "st", to: "pl", label: "priority CDN-B, CDN-A", dashed: true },
  ],
};

const ARCH: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "rum", label: "QoE beacons", sub: "player QoE + CMCD", kind: "monitor", col: 0, row: 0 },
    { id: "logs", label: "CDN logs + probes", sub: "real-time and synthetic", kind: "monitor", col: 1, row: 0 },
    { id: "ops", label: "Cost + overrides", sub: "contracts, ops, drills", kind: "database", col: 2, row: 0 },
    { id: "agg", label: "Stream aggregator", sub: "per cell and CDN", kind: "queue", col: 1, row: 1 },
    { id: "pol", label: "Policy engine", sub: "target shares", kind: "service", col: 1, row: 2 },
    { id: "guard", label: "Guardrails", sub: "rate limits, kill switch", kind: "firewall", col: 1, row: 3 },
    { id: "tbl", label: "Steering table", sub: "versioned, a few MB", kind: "database", col: 1, row: 4 },
    { id: "edge", label: "Edge endpoint", sub: "replicated KV copy", kind: "edge", col: 0, row: 5 },
    { id: "api", label: "Playback API", sub: "table in memory", kind: "api", col: 2, row: 5 },
    { id: "pl", label: "Players", kind: "player", col: 1, row: 6 },
  ],
  edges: [
    { from: "rum", to: "agg" },
    { from: "logs", to: "agg" },
    { from: "agg", to: "pol", label: "every 30-60 s" },
    { from: "ops", to: "pol" },
    { from: "pol", to: "guard" },
    { from: "guard", to: "tbl" },
    { from: "tbl", to: "edge", label: "replicate" },
    { from: "tbl", to: "api", label: "load" },
    { from: "edge", to: "pl", label: "pathway order" },
    { from: "api", to: "pl", label: "CDN order" },
  ],
  groups: [
    { id: "cp", label: "Control plane: slow, smart", nodes: ["agg", "pol", "guard", "tbl"], tone: "accent" },
    { id: "dp", label: "Data plane: fast, simple", nodes: ["edge", "api"], tone: "good" },
  ],
};

const ARCH_CP = ["rum", "logs", "ops", "agg", "pol", "guard", "tbl", "rum>agg", "logs>agg", "agg>pol", "ops>pol", "pol>guard", "guard>tbl"];
const ARCH_DP = ["tbl", "edge", "api", "pl", "tbl>edge", "tbl>api", "edge>pl", "api>pl"];

const DRILL: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "plan", label: "Plan the drill", sub: "scope, abort criteria", kind: "generic", col: 0, row: 0 },
    { id: "pre", label: "Check headroom", sub: "other CDNs and shield", kind: "monitor", col: 0, row: 1 },
    { id: "s1", label: "Shift first step", kind: "steering", col: 0, row: 2 },
    { id: "watch", label: "QoE SLOs OK?", sub: "within abort limits", kind: "monitor", col: 0, row: 3 },
    { id: "next", label: "Shift next step", sub: "until target reached", kind: "steering", col: 0, row: 4 },
    { id: "hold", label: "Hold and measure", sub: "a full interval", kind: "monitor", col: 0, row: 5 },
    { id: "restore", label: "Restore slowly", sub: "with hysteresis", kind: "steering", col: 0, row: 6 },
    { id: "abort", label: "Abort", sub: "restore last table", kind: "generic", col: 1, row: 4, tone: "bad" },
    { id: "review", label: "Write up and fix", sub: "postmortem format", kind: "generic", col: 1, row: 6 },
  ],
  edges: [
    { from: "plan", to: "pre" },
    { from: "pre", to: "s1" },
    { from: "s1", to: "watch" },
    { from: "watch", to: "next", label: "yes", tone: "good" },
    { from: "watch", to: "abort", label: "no", tone: "bad" },
    { from: "next", to: "hold" },
    { from: "hold", to: "restore" },
    { from: "abort", to: "review" },
    { from: "restore", to: "review" },
  ],
};

/* ---------------- Code visuals ---------------- */

const HLS_CODE = [
  "#EXTM3U",
  "#EXT-X-CONTENT-STEERING:SERVER-URI=\"/steering?video=ep1234\",PATHWAY-ID=\"CDN-A\"",
  "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"aud-A\",NAME=\"Japanese\",LANGUAGE=\"ja\",DEFAULT=YES,URI=\"https://cdn-a.example.com/ep1234/ja/audio.m3u8\"",
  "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"aud-B\",NAME=\"Japanese\",LANGUAGE=\"ja\",DEFAULT=YES,URI=\"https://cdn-b.example.com/ep1234/ja/audio.m3u8\"",
  "#EXT-X-STREAM-INF:BANDWIDTH=4500000,AUDIO=\"aud-A\",PATHWAY-ID=\"CDN-A\"",
  "https://cdn-a.example.com/ep1234/1080p/video.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=4500000,AUDIO=\"aud-B\",PATHWAY-ID=\"CDN-B\"",
  "https://cdn-b.example.com/ep1234/1080p/video.m3u8",
].join("\n");

const DASH_CODE = [
  "<BaseURL serviceLocation=\"alpha\">https://cdn-a.example.com/ep1234/</BaseURL>",
  "<BaseURL serviceLocation=\"beta\">https://cdn-b.example.com/ep1234/</BaseURL>",
  "<ContentSteering defaultServiceLocation=\"alpha\" queryBeforeStart=\"true\">https://steer.example.com/v1/steering</ContentSteering>",
].join("\n");

const JSON_CODE = [
  "{",
  "  \"VERSION\": 1,",
  "  \"TTL\": 300,",
  "  \"RELOAD-URI\": \"https://steer.example.com/v1/steering?video=ep1234&session=abc\",",
  "  \"PATHWAY-PRIORITY\": [\"CDN-B\", \"CDN-A\"],",
  "  \"PATHWAY-CLONES\": [{",
  "    \"BASE-ID\": \"CDN-A\",",
  "    \"ID\": \"CDN-C\",",
  "    \"URI-REPLACEMENT\": { \"HOST\": \"cdn-c.example.com\", \"PARAMS\": { \"tok\": \"x1y2\" } }",
  "  }]",
  "}",
].join("\n");

const SCORE_CODE = [
  "score = w1 * norm(start_success) + w2 * norm(1 - rebuffer_ratio)",
  "      + w3 * norm(p10_throughput / needed_bitrate) - w4 * norm(price_per_gb)",
].join("\n");

const ORDER_CODE = [
  "import { createHash } from \"node:crypto\";",
  "",
  "type Share = { cdn: string; weight: number };",
  "",
  "// Deterministic weighted pick: same session + same shares => same CDN order.",
  "export function orderCdns(sessionId: string, shares: Share[], penalized: Set<string>): string[] {",
  "  const live = shares.filter((s) => s.weight > 0 && !penalized.has(s.cdn))",
  "    .sort((a, b) => b.weight - a.weight);",
  "  if (live.length === 0) return shares.map((s) => s.cdn); // fail open: defaults",
  "  const total = live.reduce((sum, s) => sum + s.weight, 0);",
  "  const u = createHash(\"sha256\").update(sessionId).digest().readUInt32BE(0) / 2 ** 32;",
  "  let acc = 0;",
  "  const first = live.find((s) => (acc += s.weight / total) > u) ?? live[0];",
  "  return [first.cdn, ...live.filter((s) => s !== first).map((s) => s.cdn)];",
  "}",
].join("\n");

const CONFORM_CODE = [
  "$ for h in cdn-a cdn-b cdn-c; do curl -sI \"https://$h.example.com/ep1234/1080p/seg_00042.m4s?tok=$TOK\" \\",
  "    | grep -iE \"^(HTTP|cache-control|content-type|access-control-allow-origin)\" | sort | md5; done",
  "3f1c9a0e6b2d4f8a7c5e1b9d0a2f4c6e",
  "3f1c9a0e6b2d4f8a7c5e1b9d0a2f4c6e",
  "9b7e2d1c0f4a6e8b3d5c7a9f1e2b4d6c   <- CDN C differs: investigate",
].join("\n");

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 9,
  title: "Multi-CDN Strategy and Traffic Steering",
  short: "Multi-CDN",
  part: 4,
  hook: "Several CDNs, one choice per viewer: the fastest, healthiest and cheapest one right now.",
  lessons: [
    /* ======================= Lesson 1 ======================= */
    {
      id: "ch09-l1",
      title: "Why one CDN is not enough",
      goal: "Explain the five reasons to use several CDNs and the costs you accept in return.",
      minutes: 9,
      steps: [
        {
          kind: "quiz",
          prompt: "On 8 June 2021, 85% of one big CDN's network started returning errors. Your service uses only that CDN. What do your viewers see?",
          options: [
            "Nothing. A CDN always has spare PoPs for this.",
            "Errors and failed playback until the CDN recovers.",
            "A short dip, because DNS moves them away in seconds.",
            "Lower picture quality, but no errors.",
          ],
          answer: 1,
          explain: "With one CDN, its outage is your outage. There is nowhere else to send viewers. This really happened to Fastly, and every minute of its recovery was also a minute of failed playback for single-CDN customers.",
        },
        {
          kind: "read",
          title: "Fastly, 8 June 2021",
          body: "A valid configuration change by one Fastly customer triggered a latent software bug. At 09:47 UTC, **85%** of Fastly's network started returning errors. Fastly detected it within one minute, and 95% of the network was normal again within **49 minutes**. The bug had shipped in a deployment that began on 12 May.\n\nOn one CDN, its outage is your outage. With a second CDN and working steering, it is a short QoE dip. A single CDN is a **single point of failure**.",
          visual: {
            kind: "stats",
            items: [
              { value: "85%", label: "of the network returning errors", note: "from 09:47 UTC" },
              { value: "1 min", label: "to detect" },
              { value: "49 min", label: "until 95% was normal again" },
            ],
            caption: "Fastly's published summary of the June 2021 outage.",
          },
        },
        {
          kind: "read",
          title: "Name it: multi-CDN",
          body: "A **CDN (content delivery network)** is a set of caches spread around the world that serve video bytes close to viewers. A **[[multi-CDN]]** setup uses two or more CDN vendors for the same content. Each session is sent to one of them, and the system can move traffic between them.\n\nThere are five reasons to pay for this complexity: **resilience**, **performance**, **cost leverage**, **spike capacity** and **regional coverage**.",
          visual: { kind: "flow", spec: MULTI, caption: "Same episode, three vendors. Each session goes to one of them." },
        },
        {
          kind: "read",
          title: "No CDN is fastest everywhere",
          body: "Performance depends on where the CDN has [[PoPs|PoP]], which ISPs it peers with, how full its links are at the evening peak, and how its caches handle your catalog.\n\nLiu et al. (SIGCOMM 2012, with Conviva) studied over **200 million** video sessions. CDN performance varied widely across time, geography and ISP. A control plane with a global view, choosing CDN and bitrate per client, could improve the [[rebuffering ratio]] by up to **2x** on average and by **more than 10x** under stress.",
        },
        {
          kind: "read",
          title: "The best CDN is a table",
          body: "Adhikari et al. (INFOCOM 2012) measured Netflix when it used three commercial CDNs. Choosing the best CDN from a few measurements at the start of each session could give viewers **more than 12%** more bandwidth.\n\nSo \"the best CDN\" is not one answer. It is a table indexed by **country x ASN x time of day x device type**. An **[[ASN]] (autonomous system number)** identifies one network, such as one ISP.",
          visual: {
            kind: "stats",
            items: [
              { value: "200M+", label: "sessions studied", note: "Liu et al., 2012" },
              { value: "up to 2x", label: "better rebuffering on average" },
              { value: "12%+", label: "more bandwidth for Netflix viewers", note: "Adhikari et al., 2012" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "A new manager asks: \"Which CDN is best for us?\" What is the right shape of the answer?",
          options: [
            "One vendor, chosen at the yearly contract review.",
            "A table keyed by country, ASN, time of day and device type.",
            "Whichever vendor has the most PoPs.",
            "The vendor with the lowest TTFB in synthetic tests.",
          ],
          answer: 1,
          explain: "Performance varies by place, network and time. The research found big differences across time, geography and ISP, so the answer changes per cell of that table, and it keeps changing.",
        },
        {
          kind: "read",
          title: "Leverage, spikes and coverage",
          body: "- **Cost leverage.** With one CDN, the vendor knows you cannot leave quickly. With two or three production-ready CDNs you can move volume, and that changes every renewal negotiation.\n- **Spike capacity.** A big [[simulcast]] premiere can reach ~2M concurrent streams within minutes (assumed). Few vendors want to promise all of that in one region on short notice.\n- **Regional coverage.** Some CDNs are weaker in parts of Asia, Latin America, Africa or the Middle East. A service in 200+ countries and territories will see these differences.",
        },
        {
          kind: "number",
          prompt: "A premiere reaches ~2M concurrent streams at ~4 Mbps each (assumed model). What is the peak egress?",
          answer: 8,
          tolerance: 0.5,
          unit: "Tbps",
          hint: "1 Tbps = 1,000,000 Mbps.",
          explain: "2,000,000 x 4 Mbps = 8,000,000 Mbps = 8 Tbps. Spreading this spike across several vendors lowers the share any one vendor must absorb (Chapter 13). Some regional CDNs also have deep ISP relationships in one country, which helps exactly where a big CDN is weak.",
        },
        {
          kind: "read",
          title: "What multi-CDN costs you",
          body: "Multi-CDN is not free. Each cost below is real, and you accept all of them when you add a second vendor.",
          visual: {
            kind: "table",
            headers: ["Cost", "Why it happens"],
            rows: [
              ["Lower cache efficiency", "Each CDN has its own cache, so each segment is fetched from origin once per CDN"],
              ["More origin load", "Follows from the above, unless a shared shield sits in front of origin (Chapter 6)"],
              ["Config parity work", "Every cache rule, token check, header and geo rule must behave the same on every vendor"],
              ["Smaller volume per vendor", "Can mean worse per-GB prices"],
              ["A new critical system", "The steering layer must be more reliable than any CDN it steers"],
            ],
          },
          callout: {
            type: "staff",
            text: "The real question is \"what is the cheapest architecture that meets our availability SLO and QoE target in every region?\" A small single-region service may be fine with one CDN and a good contract. A global service with synchronized premieres usually is not.",
          },
        },
        {
          kind: "number",
          prompt: "One CDN serves the 8 Tbps peak with a 95% byte hit ratio (assumed). How much egress reaches the origin or shield?",
          answer: 400,
          tolerance: 10,
          unit: "Gbps",
          explain: "Misses are 5% of bytes. 5% x 8 Tbps = 0.4 Tbps = 400 Gbps.",
        },
        {
          kind: "number",
          prompt: "Now split the same traffic across three CDNs. Each long-tail object gets a third of the requests per cache, so it is evicted more often. The blended hit ratio drops to 92%. What is origin egress now?",
          answer: 640,
          tolerance: 10,
          unit: "Gbps",
          explain: "8% x 8 Tbps = 640 Gbps, which is 60% more than 400 Gbps (assumed numbers). Popular episodes stay hot in all three caches. The [[long tail]] is what suffers.",
        },
        {
          kind: "read",
          title: "The fix: one shared shield",
          body: "This is why multi-CDN and a shared **[[shield]]** usually go together. AWS published a pattern where CloudFront [[Origin Shield]] is the single origin-facing tier for other CDNs too. All of them share one mid-tier cache and one place for [[request collapsing]].\n\nAWS reported up to **57% lower origin load** in its examples.",
          visual: { kind: "flow", spec: SHIELD, caption: "Three CDNs, one shield: a miss on any CDN can be served by the shared tier." },
        },
        {
          kind: "quiz",
          prompt: "Your second CDN is a \"backup\" that carries 0% of traffic until an incident. What is the main problem?",
          options: [
            "It costs too much per GB.",
            "Its caches are cold, its config is untested and its capacity is unknown.",
            "DNS cannot point to a CDN that has no traffic.",
            "Vendors do not sell backup-only contracts.",
          ],
          answer: 1,
          explain: "A cold backup hides three problems, and you discover all of them during the incident: cold caches (a flood of misses to origin), untested config (tokens or headers may be wrong) and unknown capacity.",
        },
        {
          kind: "read",
          title: "Keep every CDN warm",
          body: "Resilience only exists if the second path already works. A CDN that carries real traffic every day has warm caches, a config that viewers have tested for you, and a known capacity. That is why good designs never park a CDN at 0%.",
          callout: {
            type: "mistake",
            text: "Treating the second CDN as a \"backup\" that carries 0% of traffic. A cold backup has cold caches, untested config and unknown capacity, and you discover all of that during the incident. Keep every CDN carrying real traffic every day.",
          },
        },
        {
          kind: "summary",
          points: [
            "Fastly's June 2021 outage (85% of the network, 49 minutes) shows that one CDN is a single point of failure.",
            "No CDN is fastest everywhere: \"best\" is a table by country x ASN x time x device.",
            "Multi-CDN also buys cost leverage, spike capacity (~8 Tbps premieres) and regional coverage.",
            "It costs split caches, more origin load (400 to 640 Gbps in the example), parity work and a new critical system.",
            "A shared origin shield removes much of the cache cost. Every CDN should carry real traffic daily.",
          ],
        },
      ],
    },

    /* ======================= Lesson 2 ======================= */
    {
      id: "ch09-l2",
      title: "Vendors, decisions and DNS steering",
      goal: "Describe what each vendor brings to a pool, the four questions of steering, and how DNS-based steering works and fails.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "Your pool has Fastly, Akamai and CloudFront. A colleague asks you to rank them from best to worst. What is the honest answer?",
          options: [
            "Akamai, because it has the most servers.",
            "It depends: rankings change by quarter, region and ASN.",
            "Fastly, because it purges fastest.",
            "CloudFront, because the origin is on AWS.",
          ],
          answer: 1,
          explain: "The book describes vendor shapes, not rankings. Rankings change by quarter, region and ASN, which is exactly why steering exists.",
        },
        {
          kind: "read",
          title: "Shapes, not rankings",
          body: "Chapter 5 explains how each vendor is built. A steering engineer needs a simpler view: what is each vendor good for in a pool, and what is different about it?",
          visual: {
            kind: "table",
            headers: ["Vendor", "Shape", "Why in a video pool", "Watch out for"],
            rows: [
              ["Akamai", "Very large, highly distributed, many servers inside ISPs, tiered distribution", "Reach in many countries, long media history", "Config model and change speed differ, own token format (EdgeAuth)"],
              ["Fastly", "Fewer, larger PoPs, programmable (VCL, Compute), fast purge", "Programmability, fast rollouts, real-time logs", "One shared control plane (June 2021), coverage in some regions"],
              ["Amazon CloudFront", "PoPs plus Regional Edge Caches on the AWS backbone, Origin Shield", "AWS integration, no transfer charge from S3 or other AWS origins to CloudFront", "Own behaviour and invalidation model, own signed URL format"],
              ["Google Media CDN", "Google edge network, built for high-throughput media egress", "Large egress capacity, pairs with Cloud Storage origins", "Feature set differs from general-purpose CDNs"],
              ["Cloudflare", "Anycast everywhere, every PoP runs every service", "Broad footprint, Workers, security features", "Video terms need care, anycast limits fine-grained steering"],
              ["Regional CDNs and ISP caches", "Local PoPs, local ISP partnerships, SVTA Open Caching", "Better performance or price in one market", "Smaller capacity, different APIs, less mature tooling"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each vendor to what makes it different in a video pool.",
          pairs: [
            ["Akamai", "Many servers inside ISPs, own token format (EdgeAuth)"],
            ["Fastly", "Programmable with VCL and Compute, one shared control plane"],
            ["Amazon CloudFront", "No transfer charge from S3 or other AWS origins"],
            ["Google Media CDN", "Built for high-throughput media egress"],
            ["Cloudflare", "Anycast everywhere, which limits fine-grained steering"],
          ],
          explain: "These are shapes, not rankings. Note the [[Akamai EdgeAuth]] token format and [[anycast]]: both change how steering and token signing work on that vendor.",
        },
        {
          kind: "read",
          title: "What we know about Crunchyroll's pool",
          body: "The 2026 job posting names five CDN technologies. A 2020 engineering post adds detail about the playback path. Read both carefully: a posting lists technologies, not traffic shares.",
          callout: {
            type: "crunchyroll",
            text: "The 2026 job posting names Fastly, Akamai, Google Media CDN, Cloudflare and Amazon CloudFront as CDN technologies. A 2020 Crunchyroll engineering post describes CloudFront as a \"fail-through\" cache in its playback path and a separate multi-CDN manifest service. Do not infer from the posting which vendors carry what share of production traffic today. That is one of the first things to learn on the team.",
          },
        },
        {
          kind: "read",
          title: "The steering problem",
          body: "**Traffic [[steering]]** means deciding, for each session or request, which CDN serves the bytes. Ask four questions of any steering system:\n- **Who decides?** A DNS server, a backend service (playback API or manifest service), the player, or a mix.\n- **When?** Per DNS lookup, per session start, every few minutes during the session, or per segment.\n- **At what granularity?** Per resolver, per IP prefix, per session, or per request.\n- **On what data?** Static rules, synthetic tests, real user measurements, player QoE, CDN health, cost and commits.",
          visual: { kind: "flow", spec: DECIDE, caption: "Each numbered arrow is a decision point." },
        },
        {
          kind: "read",
          title: "Decision points 1 and 2",
          body: "**1. Session start.** The player asks the playback API to start a session. The API returns a manifest with CDN hostnames already inside it.\n\n**2. DNS.** The player resolves the video hostname. A steering DNS answers with CDN A or CDN B.",
          visual: { kind: "flow", spec: { ...DECIDE, focus: ["p", "api", "dns", "p>api", "p>dns"] } },
        },
        {
          kind: "read",
          title: "Decision points 3 and 4",
          body: "**3. Content steering.** Every TTL, the player fetches a small steering manifest that says which CDN to prefer.\n\n**4. Player retry.** On errors, the player retries the same segment on another CDN.\n\nBoth CDNs pull from one shared origin shield, which pulls from origin storage on AWS and GCP. Each numbered arrow is a decision point, and real systems combine two or three.",
          visual: { kind: "flow", spec: { ...DECIDE, focus: ["p", "sts", "a", "b", "sh", "p>sts", "p>a", "p>b", "a>sh", "b>sh"], flow: ["p>b", "b>sh"] } },
        },
        {
          kind: "match",
          prompt: "Match each decision maker to when it decides.",
          pairs: [
            ["Steering DNS", "Per DNS lookup, for a whole resolver"],
            ["Playback API", "Once, at session start"],
            ["Content steering server", "Every few minutes, mid-session"],
            ["Player retry logic", "Per request, when a segment fails"],
          ],
          explain: "Same question (\"which CDN?\"), four different moments and granularities. That is why real systems combine two or three of them.",
        },
        {
          kind: "quiz",
          prompt: "A CDN can fail in seconds. A DNS change takes minutes. A session-start decision only affects new sessions, and a VOD episode lasts 24 minutes or more. What does this gap mean?",
          options: [
            "DNS is fast enough for any failure.",
            "Viewers already playing stay on the failing CDN unless something can switch them mid-session.",
            "Session-start steering moves everyone within a minute.",
            "Episodes should be shorter.",
          ],
          answer: 1,
          explain: "Timescale matters. Neither DNS nor session-start steering reaches a viewer who is already 10 minutes into an episode. That gap is why mid-session switching matters.",
        },
        {
          kind: "read",
          title: "Method 1: DNS-based steering",
          body: "The player requests segments from one stable hostname, for example `video.example.com`. That hostname is a [[CNAME]] to a name on a **steering DNS** service. The steering DNS picks a CDN and returns a CNAME to that CDN's hostname. Chapter 3 covers resolvers, TTLs and EDNS Client Subnet.",
          visual: { kind: "sequence", spec: { ...DNS_SEQ, upTo: 2 }, caption: "The steering decision happens inside the DNS answer." },
        },
        {
          kind: "read",
          title: "Then the CDN's own DNS",
          body: "The resolver now resolves CDN A's hostname. CDN A's DNS returns the IP of a nearby CDN A PoP. The player sends HTTPS segment requests to that PoP.\n\nThe steering choice was made once, for this resolver, and it is cached for the [[TTL]] of 30 seconds.",
          visual: { kind: "sequence", spec: DNS_SEQ },
        },
        {
          kind: "reveal",
          prompt: "Look at the sequence. The steering DNS never talks to the player. What does it actually see about the viewer, and why does that matter?",
          visual: { kind: "sequence", spec: DNS_SEQ },
          answer: "It sees the **resolver**, not the viewer. With [[ECS]] it may also see the client's subnet. With public resolvers that do not send EDNS Client Subnet, a user may be steered based on a resolver far away. Granularity is the resolver, not the viewer.",
        },
        {
          kind: "read",
          title: "DNS steering policies",
          body: "- **Weighted:** 60% of answers to CDN A, 40% to B.\n- **Geo:** by resolver or client-subnet location.\n- **Health-checked:** drop a CDN whose synthetic checks fail.\n- **RUM-driven:** use measurements from real users.\n\nNS1 Pulsar (now IBM NS1 Connect) collects latency and availability from real users through JavaScript beacons or API integrations, aggregates it by region and ASN, and uses it in DNS answers. Cedexis Openmix and Radar did the same.",
        },
        {
          kind: "quiz",
          prompt: "Citrix bought Cedexis in 2018 and sold it as Citrix Intelligent Traffic Management (ITM). What happened to that product?",
          options: [
            "It became IBM NS1 Connect.",
            "It ended on 31 October 2025.",
            "It became an open standard.",
            "It moved into the HLS specification.",
          ],
          answer: 1,
          explain: "Citrix ended ITM on 31 October 2025. NS1 Pulsar is a different product, now IBM NS1 Connect. If you depend on a steering vendor, its end of life becomes your migration project.",
        },
        {
          kind: "read",
          title: "Strengths and weaknesses",
          body: "DNS steering is the easiest place to start, and its limits are just as clear.",
          visual: {
            kind: "compare",
            left: { title: "Strengths", points: ["Works with every player: it only resolves a hostname", "Manifests stay static and cacheable", "A DNS vendor does most of the work"] },
            right: { title: "Weaknesses", points: ["Granularity is the resolver, not the viewer", "Slow: switches of 300 s up to 15 min reported", "No mid-session control of open connections", "One hostname means one certificate and token valid on every CDN"] },
          },
          callout: {
            type: "industry",
            text: "Disney Streaming's advice in 2021 was to start with a multi-CDN vendor, design the platform with clean interfaces between components, and build your own balancer only when vendor cost is hard to justify at scale. Disney said it had built its own.",
          },
        },
        {
          kind: "multi",
          prompt: "Select every real weakness of DNS-based steering.",
          options: [
            "Granularity is the resolver, not the viewer.",
            "Switches have taken 300 seconds to 15 minutes during a CDN failure.",
            "It needs custom code in every player.",
            "A player with an open connection to CDN A keeps using it.",
            "Every CDN needs a valid certificate for the same hostname.",
          ],
          answers: [0, 1, 3, 4],
          explain: "DNS needs no player changes at all; that is its main strength. The other four are real: coarse granularity, slow switching (Reznik et al. report 300 s to 15 min), no mid-session control, and one hostname that every CDN must serve with a valid certificate and a valid URL token.",
        },
        {
          kind: "read",
          title: "Measure the tail",
          body: "Resolvers and devices cache answers, and some ignore low TTLs. So the TTL is a lower bound, not a promise. What matters is how long traffic keeps arriving at the old CDN after you change the answer.",
          callout: {
            type: "mistake",
            text: "Believing a 30-second TTL means 30-second failover. Measure how long traffic keeps reaching the old CDN after a change; the tail is much longer.",
          },
        },
        {
          kind: "summary",
          points: [
            "Vendors have different shapes (reach, programmability, AWS integration, egress, anycast), not fixed rankings.",
            "Steering asks: who decides, when, at what granularity, on what data.",
            "Four decision points: session start, DNS, content steering every TTL, player retry on errors.",
            "DNS steering works with every player but is coarse (resolver), slow (300 s to 15 min) and cannot move open sessions.",
            "A 30-second TTL does not mean 30-second failover. Measure the tail.",
          ],
        },
      ],
    },

    /* ======================= Lesson 3 ======================= */
    {
      id: "ch09-l3",
      title: "Session start and the player",
      goal: "Compare server-side steering at session start with client-side switching, and say who should own failure and who should own preference.",
      minutes: 9,
      steps: [
        {
          kind: "quiz",
          prompt: "At session start, the playback API already knows the viewer's country, device, app version and ASN. What new power does it get if it also picks the CDN?",
          options: [
            "It can move sessions mid-episode.",
            "It can apply per-session rules, like \"this TV model has a TLS bug on CDN C\".",
            "It removes the need for URL tokens.",
            "It makes manifests more cacheable.",
          ],
          answer: 1,
          explain: "Per-session context is the big strength. Rules like \"this TV model has a TLS bug on CDN C\" or \"tonight's premiere is pinned to two pre-warmed CDNs\" become easy. It cannot move a VOD session later, and it makes manifests less cacheable, not more.",
        },
        {
          kind: "read",
          title: "Method 2: decide at session start",
          body: "The player first calls the **playback API** to start a session. The backend checks [[entitlement]] and licensing, then returns a manifest or manifest URL.\n\nIn **server-side steering**, the backend picks the CDN right now and writes that CDN's hostname into the URLs. Different sessions for the same episode can get different CDNs.",
          visual: { kind: "flow", spec: SESSION, caption: "Same episode, two sessions, two CDNs." },
        },
        {
          kind: "read",
          title: "Netflix and Mux do this",
          body: "Netflix describes this pattern for [[Open Connect]]. Appliances report health, learned [[BGP]] routes and stored files to control plane services in AWS. When a member presses play, playback services check authorization and decide which files are needed. Then a **steering service** in AWS picks appliances, generates URLs for them, and hands them to the client.\n\nMux described the same idea for third-party CDNs in 2019. On each HLS master manifest request, it ran a parallel Cedexis Openmix lookup keyed by viewer IP and returned URLs pointing at the chosen CDN.",
          visual: { kind: "flow", spec: { ...SESSION, focus: ["api", "p1", "a", "p1>api", "p1>a"], flow: ["p1>api", "p1>a"] } },
        },
        {
          kind: "read",
          title: "Crunchyroll's Katana (2020)",
          body: "Crunchyroll has published evidence of this pattern. A November 2020 post describes **Katana**, an edge playback orchestration service on [[Lambda@Edge]] for stateless multi-CDN and [[server-side ad insertion|SSAI]].",
          visual: {
            kind: "stats",
            items: [
              { value: "Nov 2020", label: "Katana post published" },
              { value: "10 ms", label: "target for the CDN rules engine" },
              { value: "Lambda@Edge", label: "where Katana ran" },
            ],
          },
          callout: {
            type: "crunchyroll",
            text: "Katana's multi-CDN component was a drop-in replacement for an existing multi-CDN manifest service, and the team targeted 10 ms for the CDN rules engine because \"manifest level multi-CDN decisioning needs to be fast\". This is published evidence of manifest-time CDN selection. Whether today's platform works this way is not public; ask the team.",
          },
        },
        {
          kind: "read",
          title: "Strengths of session-start steering",
          body: "- **Per-session context:** client IP and ASN, device type, app version, the user's country (already needed for licensing, Chapter 8), and content ID.\n- **Instant effect** for new sessions. No resolver caches in the way.\n- **Per-CDN hostnames, certificates and token formats.** The backend writes the right [[signed URL]] for each vendor.",
        },
        {
          kind: "quiz",
          prompt: "A VOD session started on CDN A through session-start steering. Five minutes later, CDN A degrades on this viewer's ISP. What does session-start steering do for this viewer?",
          options: [
            "Moves it at the next manifest refresh.",
            "Nothing: the VOD manifest was fetched once.",
            "Moves it when the DNS TTL expires.",
            "Pushes a new CDN to the player.",
          ],
          answer: 1,
          explain: "The VOD manifest is fetched once, so the CDN choice is frozen for the session. Live manifests refresh every few seconds, so hostnames could change there, but swapping segment URLs under a player is fragile.",
        },
        {
          kind: "read",
          title: "Weaknesses of session-start steering",
          body: "- **No mid-session switch for VOD.** Live is possible but fragile.\n- **Manifest cacheability drops.** Per-CDN hostnames and per-session tokens mean the manifest is generated per session. At 10,000 session starts per second, that is a real service.\n- **Aggregate data.** The decision uses data from many clients, not this client's own experience.",
        },
        {
          kind: "multi",
          prompt: "Select everything that is true of server-side steering at session start.",
          options: [
            "It takes effect instantly for new sessions.",
            "It can write a different signed URL format for each vendor.",
            "It keeps manifests static and cacheable.",
            "It can move VOD sessions mid-episode.",
            "It decides from aggregate data, not this client's own experience.",
          ],
          answers: [0, 1, 4],
          explain: "Instant for new sessions, per-vendor URLs and tokens, but aggregate data. Manifests become per-session (less cacheable), and a VOD session stays where it started.",
        },
        {
          kind: "read",
          title: "Method 3: the player decides",
          body: "In **client-side switching**, the player receives more than one CDN location and decides itself.\n\nThe simplest form is **error failover**: if a segment fails on CDN A after retries, fetch it from CDN B. A richer form is **QoE-driven switching**: if throughput on CDN A stays far below what ABR needs, try B.\n\nThe player has the best data for its own session. Chapter 10 covers player retry and failover logic.",
          visual: { kind: "flow", spec: CLIENT },
        },
        {
          kind: "read",
          title: "Conviva C3: a split control plane",
          body: "Conviva's **C3** (NSDI 2015) shows a hybrid. It uses a **split control plane**: a thin sensing and actuation layer in the client, and a central controller that builds a near-real-time global model and makes per-client choices of CDN and bitrate.\n\nAt publication it handled more than **100M sessions per day** from **244 countries**. The client senses and acts; the global view lives in the backend.",
          visual: { kind: "flow", spec: C3 },
        },
        {
          kind: "quiz",
          prompt: "Every player has its own rule: \"jump to CDN B when A slows\". At peak, CDN A slows. What happens next?",
          options: [
            "Traffic moves smoothly to B and stays there.",
            "B gets a wave it was not ready for, slows down, and players jump back.",
            "Players spread evenly across all CDNs.",
            "Nothing: players wait for A to recover.",
          ],
          answer: 1,
          explain: "This is **herding**. Everyone acts on the same signal at the same time, so the target gets a wave. It slows, and players jump back. This oscillation can make an incident worse.",
        },
        {
          kind: "read",
          title: "Weaknesses of player-side logic",
          body: "Strengths: reaction in seconds, true per-session data, and seamless mid-session switching in a good player.\n\nWeaknesses:\n- **Device fragmentation.** The logic must exist and be tested in every player: web, iOS, Android, smart TVs, consoles, Roku, Fire TV. Some platforms have closed players.\n- **Herding.** Players jump together and cause oscillation.\n- **No business context.** A player does not know about your commit with A or your capacity reservation with B.",
          callout: {
            type: "staff",
            text: "Let the player own *failure handling* (fast, local, safe), and let a backend own *preference* (which CDN is best, cheapest, has capacity). Player-side \"best CDN\" logic without a central brake is how you get oscillation.",
          },
        },
        {
          kind: "match",
          prompt: "Match each steering method to its main risk.",
          pairs: [
            ["DNS-based", "Stale resolvers"],
            ["Server-side at session start", "Stuck sessions"],
            ["Client-side custom logic", "Oscillation and fragmentation"],
          ],
          explain: "DNS answers live on in resolver caches. Session-start choices are frozen for the session. Custom player logic must be built on every platform and can herd.",
        },
        {
          kind: "reveal",
          prompt: "The TV app team wants to ship \"always pick the fastest CDN\" logic inside the player. What do you ask for before you agree?",
          answer: "Split the job. The player should own **failure handling**: retry a failed segment on another CDN, fast and local. A backend should own **preference**: which CDN is best, cheapest and has capacity, with a central brake against herding. Also ask how the logic will be built and tested on every platform (web, iOS, Android, TVs, consoles, Roku, Fire TV), and how it learns about commits and capacity reservations.",
        },
        {
          kind: "summary",
          points: [
            "Session-start steering uses full per-session context and per-CDN URLs, and takes effect instantly for new sessions.",
            "It cannot move a VOD session, and it makes manifests per-session (10,000 starts/s is a real service).",
            "Katana (2020) is published evidence of manifest-time CDN selection at Crunchyroll, with a 10 ms rules-engine target.",
            "Player-side switching reacts in seconds but is fragmented across devices, can herd, and has no business context.",
            "Player owns failure handling; a backend owns preference (C3's split control plane).",
          ],
        },
      ],
    },

    /* ======================= Lesson 4 ======================= */
    {
      id: "ch09-l4",
      title: "HLS and DASH Content Steering",
      goal: "Read a Content Steering playlist and steering manifest, apply the client rules, and compare all four steering methods.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "A manifest lists the same episode on CDN A and CDN B. Who should decide, mid-session, which one the player uses?",
          options: [
            "The player alone, from its own throughput.",
            "A server the player asks every few minutes, with the player falling back by itself on errors.",
            "DNS, by changing the CNAME.",
            "Nobody: the first CDN is used for the whole session.",
          ],
          answer: 1,
          explain: "This is the design of HLS and DASH Content Steering: a server gives the preference, and the player handles failures locally. It combines the backend's global view with the player's fast reaction.",
        },
        {
          kind: "read",
          title: "Why a standard was needed",
          body: "By 2020 every large service had built its own mix of the methods so far, with custom player code. Then the standards bodies caught up. HLS and DASH share the same server-client exchange, so **one steering server can steer both HLS and DASH players**.",
          visual: {
            kind: "table",
            headers: ["When", "What happened"],
            rows: [
              ["Feb 2021", "Apple publishes the first draft of HLS Content Steering"],
              ["Nov 2021", "It enters the HLS 2nd Edition draft (RFC 8216bis)"],
              ["Jul 2022", "DASH-IF produces a matching proposal"],
              ["2022", "dash.js adds support in version 4.5.0"],
              ["Early 2024", "Published as ETSI TS 103 998; MPD changes go into MPEG-DASH 6th edition (ISO/IEC 23009-1:2024)"],
            ],
          },
        },
        {
          kind: "read",
          title: "The idea in one sentence",
          body: "The manifest lists the same content on several **pathways** (one per CDN), and the player periodically asks a **steering server** which pathway order to use.\n\nThat is **[[Content Steering]]**.",
          visual: { kind: "flow", spec: CS },
        },
        {
          kind: "read",
          title: "HLS: one new tag",
          body: "In [[HLS]], the multivariant playlist gets one new tag, `EXT-X-CONTENT-STEERING`, and a `PATHWAY-ID` on each variant.\n\nHere the 1080p video and the Japanese audio exist twice: once on `cdn-a` (pathway CDN-A) and once on `cdn-b` (pathway CDN-B).",
          visual: { kind: "code", lang: "m3u8", code: HLS_CODE, caption: "Multivariant playlist with two pathways." },
        },
        {
          kind: "read",
          title: "Reading the tag",
          body: "- `SERVER-URI` is the steering manifest URL. It may carry an asset ID, or be a `data:` URI with the first steering manifest inline.\n- `PATHWAY-ID` on the tag is the pathway to use until the first steering manifest arrives.\n- The provider should offer **all rendition groups** (every dub and subtitle) on every pathway.\n- Old players ignore the tag, so the design is **backward compatible**.",
          visual: { kind: "code", lang: "m3u8", code: HLS_CODE },
        },
        {
          kind: "quiz",
          prompt: "An old player that does not understand `EXT-X-CONTENT-STEERING` loads this playlist. What happens?",
          options: [
            "Playback fails with a parse error.",
            "It ignores the tag and plays a variant normally.",
            "It plays both pathways at once.",
            "It asks the steering server anyway.",
          ],
          answer: 1,
          explain: "Old players ignore unknown tags, so the design is backward compatible. They just do not get mid-session steering. That is why the main risk of Content Steering is old devices without support.",
        },
        {
          kind: "read",
          title: "DASH: BaseURL and ContentSteering",
          body: "In [[DASH]], each CDN is a `BaseURL` with a `serviceLocation`, and a `ContentSteering` element names the server.\n\n`queryBeforeStart=\"true\"` tells the player to ask the steering server **before** playback starts. dash.js added support in version 4.5.0 in 2022.",
          visual: { kind: "code", lang: "xml", code: DASH_CODE, caption: "The same two-CDN idea inside an MPD." },
        },
        {
          kind: "read",
          title: "The steering manifest",
          body: "The player calls the steering server with GET and adds `_HLS_pathway` (its current pathway) and `_HLS_throughput` (its throughput estimate in bits per second). DASH clients send `_DASH_pathway` and `_DASH_throughput`.\n\nThe server returns a small JSON document.",
          visual: { kind: "code", lang: "json", code: JSON_CODE },
        },
        {
          kind: "read",
          title: "TTL, RELOAD-URI and PATHWAY-PRIORITY",
          body: "- `TTL`: seconds until the next reload. The recommended value is **300**. The server may vary TTL per client to spread load.\n- `RELOAD-URI`: where to ask next. The server can embed a session ID here, for sticky decisions.\n- `PATHWAY-PRIORITY`: ordered pathways. The player applies the first one that is not penalized.\n\nIn this example, CDN-B is now preferred over CDN-A.",
          visual: { kind: "code", lang: "json", code: JSON_CODE },
        },
        {
          kind: "read",
          title: "Pathway cloning",
          body: "`PATHWAY-CLONES` defines a new pathway by copying a base pathway, replacing the hostname and adding query parameters. This is **[[pathway cloning]]**.\n\nHere CDN-C is a copy of CDN-A with host `cdn-c.example.com` and a token `tok=x1y2`. Cloning adds a CDN to sessions already playing, and lets static, cached manifests be served by CDNs added later.",
          visual: { kind: "code", lang: "json", code: JSON_CODE },
        },
        {
          kind: "quiz",
          prompt: "Mid-session, you want to add CDN C, which is not in the cached manifest that players already have. Which field does it?",
          options: ["TTL", "RELOAD-URI", "PATHWAY-PRIORITY", "PATHWAY-CLONES"],
          answer: 3,
          explain: "`PATHWAY-CLONES` builds a new pathway from an existing one (new HOST, extra PARAMS). Then `PATHWAY-PRIORITY` can put it first. No new master manifest is needed.",
        },
        {
          kind: "match",
          prompt: "Match each HLS name to its DASH equivalent.",
          pairs: [
            ["PATHWAY-ID", "serviceLocation on a BaseURL"],
            ["EXT-X-CONTENT-STEERING", "ContentSteering element"],
            ["_HLS_pathway", "_DASH_pathway"],
            ["_HLS_throughput", "_DASH_throughput"],
          ],
          explain: "Different syntax, same server-client exchange. That is why one steering server can steer both HLS and DASH players.",
        },
        {
          kind: "read",
          title: "Client rules",
          body: "1. If all variants on the current pathway fail with network errors, mark it **penalized**. The HLS draft notes about two minutes is generally enough to recover.\n2. On each new steering manifest, switch if the current pathway is not first, is missing, or is penalized.\n3. On **410 Gone**, never call that URI again in the session; keep the last pathway list. On **429** with `Retry-After`, wait.\n4. If the manifest cannot be loaded or parsed, keep previous values; retry after the previous TTL (or 5 minutes).",
        },
        {
          kind: "quiz",
          prompt: "Your steering server crashes and returns nothing that parses. What happens to viewers who are playing?",
          options: [
            "Playback stops at the next TTL.",
            "Players keep the previous values and retry later; playback continues.",
            "Players fall back to DNS steering.",
            "Players switch to the last pathway in the list.",
          ],
          answer: 1,
          explain: "Rules 3 and 4 mean **a dead steering server does not stop playback.** As Reznik et al. put it, even if steering servers fail, they will not cause the delivery system to fail.",
        },
        {
          kind: "read",
          title: "One session, start to switch",
          body: "The player starts a session and gets a playlist with two pathways. It asks the steering server, which says CDN-A first, then CDN-B, with a TTL of 300 seconds. The player fetches media playlists and segments from CDN A.",
          visual: { kind: "sequence", spec: { ...CS_SEQ, upTo: 4 } },
        },
        {
          kind: "quiz",
          prompt: "Now CDN A degrades in this region and segment requests time out. What does the player do before it next asks the steering server?",
          visual: { kind: "sequence", spec: { ...CS_SEQ, upTo: 5 } },
          options: [
            "Waits for the TTL, then asks which CDN to use.",
            "Penalizes CDN-A and applies CDN-B right away.",
            "Stops and shows an error.",
            "Retries CDN A until it recovers.",
          ],
          answer: 1,
          explain: "The penalty rule acts in seconds, with no server call. The player fetches the same rendition's next segment from CDN B. After the TTL it reloads with pathway CDN-B, and the server now answers CDN-B first, then CDN-A.",
        },
        {
          kind: "read",
          title: "The full exchange",
          body: "Two loops work together. The **fast loop** is local: penalize and switch in seconds. The **slow loop** is the steering server: it reorders pathways every TTL, from a global view. Even if the slow loop dies, the fast loop keeps viewers playing.",
          visual: { kind: "sequence", spec: CS_SEQ },
        },
        {
          kind: "widget",
          widget: "multi-cdn",
          title: "Outage: compare the methods",
          task: "Press \"CDN A fails in LatAm at t=0\". Compare how many LatAm sessions keep failing under DNS, the playback API, player failover, Content Steering and the combination. Which line drops fastest?",
          props: { tab: "outage" },
        },
        {
          kind: "read",
          title: "Who supports it",
          body: "As of the 2025 SMPTE paper, supporting players included dash.js (4.5.0+), Apple AVPlayer (iOS 15+), hls.js (1.4.0+), Video.js (8.8.8+), Shaka Player (4.6.0+), and the Bitmovin, Brightcove and Radiant Media players. ExoPlayer support was in progress.",
          visual: {
            kind: "table",
            headers: ["Player", "Version with support"],
            rows: [
              ["dash.js", "4.5.0+"],
              ["Apple AVPlayer", "iOS 15+"],
              ["hls.js", "1.4.0+"],
              ["Video.js", "8.8.8+"],
              ["Shaka Player", "4.6.0+"],
              ["Bitmovin, Brightcove, Radiant Media", "Supported"],
              ["ExoPlayer", "In progress"],
            ],
          },
        },
        {
          kind: "read",
          title: "Evidence from the SVTA testbed",
          body: "The SVTA used three anonymized tier-1 CDNs, a master steering server on AWS that set target shares per region, and small edge steering servers (Akamai EdgeWorkers or Fastly Compute) that decided per session from player-reported throughput.\n\nThese are early results from about **16,000 sessions** of one test video, not a production study, but the direction is clear.",
          visual: {
            kind: "stats",
            items: [
              { value: "0.03%", label: "buffering ratio, steered", note: "vs 0.42% best single CDN" },
              { value: "0.14%", label: "buffering in India, steered", note: "vs 1.81% best single CDN" },
              { value: "~16,000", label: "test sessions" },
            ],
          },
          callout: {
            type: "staff",
            text: "Content steering standardizes the *mechanism* (how a server tells a player which CDN to use and how the player switches). It does not give you the *policy* (which CDN should be first for this ASN right now). The policy is your steering service, and that is where your team adds value.",
          },
        },
        {
          kind: "quiz",
          prompt: "Study the table. Which method reacts to a CDN failure in seconds AND supports business rules (cost, commits) fully?",
          visual: {
            kind: "table",
            headers: ["Property", "DNS-based", "Session start", "Client custom", "Content Steering"],
            rows: [
              ["Granularity", "Resolver or subnet", "Session", "Session or request", "Session"],
              ["Mid-session switch", "Practically no", "No for VOD", "Yes", "Yes"],
              ["Reaction to CDN failure", "Minutes (300 s to 15 min reported)", "New sessions only", "Seconds", "Seconds (penalty), minutes (TTL)"],
              ["Player changes", "None", "None", "Large, per platform", "Standard feature in modern players"],
              ["Business rules", "Limited", "Full", "Hard", "Full, in the steering server"],
              ["Per-CDN hostname and token", "No", "Yes", "Yes", "Yes"],
              ["Main risk", "Stale resolvers", "Stuck sessions", "Oscillation, fragmentation", "Old devices without support"],
            ],
          },
          options: ["DNS-based", "Server-side at session start", "Client-side custom", "Content Steering"],
          answer: 3,
          explain: "Content Steering reacts in seconds through the penalty rule, reorders in minutes through the TTL, and keeps full business rules in the steering server. Its main risk is old devices without support, which is why strong designs combine methods.",
        },
        {
          kind: "summary",
          points: [
            "Content Steering: the manifest lists pathways (one per CDN); the player asks a steering server for the order every TTL (300 s recommended).",
            "HLS uses EXT-X-CONTENT-STEERING and PATHWAY-ID; DASH uses BaseURL serviceLocation and ContentSteering. One server steers both.",
            "PATHWAY-CLONES adds a CDN mid-session by copying a pathway with a new host and parameters.",
            "Penalties switch in seconds; 410, 429 and parse failures keep the last list, so a dead steering server does not stop playback.",
            "The standard gives the mechanism, not the policy. The policy is your steering service.",
          ],
        },
      ],
    },

    /* ======================= Lesson 5 ======================= */
    {
      id: "ch09-l5",
      title: "Inputs and the steering service",
      goal: "List the signals a steering decision needs, size the load, and sketch the control-plane and data-plane split.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "For a 4 Mbps stream at peak: CDN X has 20 ms time to first byte but cannot hold 6 Mbps. CDN Y has 40 ms but holds 6 Mbps. Which is better for video?",
          options: [
            "CDN X: lower latency always wins.",
            "CDN Y: sustained throughput and error rate matter more.",
            "They are equal.",
            "Neither: both are too slow.",
          ],
          answer: 1,
          explain: "Time to first byte matters for start time, but for a 4 Mbps stream, sustained throughput and error rate matter more. A CDN that cannot hold the bitrate at peak causes rebuffering.",
        },
        {
          kind: "read",
          title: "Decide per cell",
          body: "A steering decision ranks CDNs for one **cell**: a group of viewers expected to behave alike, such as **country x ASN x device class**.\n\nFor each cell the \"brain\" needs signals in five groups: real user QoE, availability and health, cost and contracts, capacity and business rules, and a judgement of how fresh and noisy the data is.",
        },
        {
          kind: "read",
          title: "Real user measurements and QoE",
          body: "**[[RUM]] (real user monitoring)** means measurements from real viewers. For video the best RUM is player [[QoE]]: [[video start time]], start failures, rebuffering ratio, average bitrate, and throughput per CDN (Chapter 10).\n\nPlayers can also send **[[CMCD]] (Common Media Client Data, CTA-5004)** keys such as session ID, content ID, buffer length and measured throughput on each request. Then CDN logs carry player context.",
          callout: {
            type: "mistake",
            text: "Steering only on latency. Time to first byte matters for start time, but for a 4 Mbps stream, sustained throughput and error rate matter more. A CDN with 20 ms TTFB that cannot hold 6 Mbps at peak is worse for video than one with 40 ms TTFB that can.",
          },
        },
        {
          kind: "read",
          title: "How Disney ranked CDNs",
          body: "Disney Streaming described gathering QoE and QoS metrics per CDN and weighting them into a **ranked order of CDNs for each region and ASN**. It flagged any CDN outside an acceptable range from the mean.\n\nIt also scored **consistency**, using standard deviation from the mean. A CDN that is good on average but swings a lot is a risk.",
        },
        {
          kind: "read",
          title: "Health, cost and capacity",
          body: "- **Availability and health:** CDN error rates (5xx, timeouts, TLS failures) per cell from player and CDN logs; [[synthetic probes|synthetic probe]] that catch problems in low-traffic cells at 4 a.m.; vendor status pages as context only, since they often lag.\n- **Cost and contracts:** per-GB price per region, commit position for the month, and the current 95th-percentile estimate.\n- **Capacity and business rules:** reserved capacity for a premiere, which CDNs are [[pre-warmed|pre-warming]] for tonight, territory rules, known device incompatibilities, and manual overrides such as \"drain CDN B in Brazil now.\"",
        },
        {
          kind: "match",
          prompt: "Match each signal to its group.",
          pairs: [
            ["Rebuffering ratio per CDN from players", "Real user QoE"],
            ["5xx and TLS failures in CDN logs", "Availability and health"],
            ["Commit position for the month", "Cost and contracts"],
            ["\"Drain CDN B in Brazil now\"", "Capacity and business rules"],
          ],
          explain: "The policy needs all four groups. QoE and health say which CDN works; cost and contracts say which is cheaper; capacity and rules say what is allowed right now.",
        },
        {
          kind: "read",
          title: "Freshness and noise",
          body: "Data is never perfect. Beacons may be aggregated every **30 to 60 seconds**, CDN logs can lag by minutes, and a cell with 50 sessions is noisy.\n\nTwo defences:\n- **Roll small cells up** to a parent: ASN to country to region.\n- If data is too old, **hold the last decision** instead of trusting it.",
        },
        {
          kind: "quiz",
          prompt: "A cell (Brazil x a small ASN x TV) has 50 sessions, and its newest data is 10 minutes old. What should the policy do?",
          options: [
            "Trust it fully and move traffic.",
            "Roll up to the parent cell, and hold the last decision if data is too old.",
            "Send the whole cell to the cheapest CDN.",
            "Drop the cell from steering.",
          ],
          answer: 1,
          explain: "Small cells are noisy, so use the parent (ASN to country to region). Stale data should not drive changes: hold the last decision instead.",
        },
        {
          kind: "read",
          title: "Design doc: requirements",
          body: "A design doc section for \"a platform like Crunchyroll\", with assumed numbers. It is not Crunchyroll's actual system.\n\nFunctional:\n1. For each new session, return an ordered list of CDNs, with signed URLs or tokens for each.\n2. Serve HLS and DASH steering manifests that can change the order mid-session.\n3. Rank CDNs per cell using QoE, availability, cost, commits and capacity.\n4. Support audited manual overrides (drain a CDN in a region, pin an event to a CDN set) and scheduled drills.",
        },
        {
          kind: "read",
          title: "Non-functional requirements",
          body: "- **Availability above every CDN it steers.** If steering is down, playback continues on defaults.\n- **Latency:** a few milliseconds on the session-start path. Crunchyroll's 2020 design targeted 10 ms for its CDN rules engine.\n- **Reaction time:** move most new sessions off a failing CDN in under 1 minute, and most existing sessions within a few minutes.\n- **Stability:** no oscillation. Shares change smoothly except on hard failure.\n- **Explainability:** on-call can answer \"why did this session get CDN B?\"",
        },
        {
          kind: "multi",
          prompt: "Which of these are non-functional requirements of the steering service?",
          options: [
            "Availability higher than any CDN it steers.",
            "Return an ordered CDN list with signed URLs.",
            "On-call can explain why a session got CDN B.",
            "No oscillation: shares change smoothly.",
            "Support audited manual overrides.",
          ],
          answers: [0, 2, 3],
          explain: "Availability, explainability and stability describe *how well* the system behaves. Returning ordered lists and supporting overrides are *what* it does, so they are functional.",
        },
        {
          kind: "number",
          prompt: "Load model (assumed): a premiere ramps to ~2M concurrent sessions in about 10 minutes. What is the average rate of session starts during the ramp?",
          answer: 3300,
          tolerance: 200,
          unit: "per second",
          hint: "10 minutes = 600 seconds.",
          explain: "2,000,000 / 600 s = ~3,300 session starts per second. The front of the ramp is spikier: assume 3x average, so ~10,000 per second.",
        },
        {
          kind: "number",
          prompt: "Each of the 2M sessions reloads its steering manifest every 300 seconds (the recommended TTL). How many steering requests per second is that?",
          answer: 6700,
          tolerance: 300,
          unit: "per second",
          explain: "2,000,000 / 300 s = ~6,700 reloads per second in normal conditions.",
        },
        {
          kind: "number",
          prompt: "During an incident you lower the TTL to 60 seconds so players react faster. How many steering reloads per second now?",
          answer: 33000,
          tolerance: 1500,
          unit: "per second",
          explain: "2,000,000 / 60 s = ~33,000 reloads per second, five times the normal rate. A faster reaction costs load on the steering endpoint.",
        },
        {
          kind: "read",
          title: "Load numbers together",
          body: "Steering sees roughly **1% to 7%** of the CDN request rate, but it sits on the session-start path and is as spiky as the premiere. Plan for **~50,000 requests per second**.",
          visual: {
            kind: "table",
            headers: ["Quantity", "Calculation", "Result"],
            rows: [
              ["Peak concurrent sessions", "Premiere spike (assumed)", "~2M"],
              ["Session starts during ramp", "2M in ~10 min, average", "~3,300 per second"],
              ["Session starts at the front of the ramp", "Assume 3x average", "~10,000 per second"],
              ["Steering reloads, normal", "2M / 300 s TTL", "~6,700 per second"],
              ["Steering reloads, 60 s TTL in an incident", "2M / 60 s", "~33,000 per second"],
              ["Segment requests to CDNs, for comparison", "2M / 4 s video segments, plus audio", "~500,000 to 1,000,000 per second"],
            ],
          },
        },
        {
          kind: "read",
          title: "Slow thinking, fast answering",
          body: "The main idea is to split **slow thinking** from **fast answering**, as C3 does and as the SVTA testbed does with a cloud master server and small edge servers.\n\nThe **[[control plane]]** is slow and smart and lives in the cloud. The **[[data plane]]** is fast and simple and lives near players. Players' beacons feed back into the inputs, closing the loop.",
          visual: { kind: "flow", spec: ARCH },
        },
        {
          kind: "read",
          title: "The control plane",
          body: "- **Aggregator.** A stream job reads beacons, logs and probes. Every 30 to 60 s it outputs, per cell and CDN: sessions, start failure rate, rebuffering ratio, median and p10 throughput, 5xx rate and bytes.\n- **Policy engine.** Turns metrics into a **target share** per CDN per cell (for example, Brazil x ASN 12345 x TV: CDN A 70, CDN B 30), then applies cost and capacity.\n- **Guardrails.** Limit how fast shares change, keep floors and caps, and offer a kill switch that freezes the last known good table.",
          visual: { kind: "flow", spec: { ...ARCH, focus: ARCH_CP, flow: ["logs>agg", "agg>pol", "pol>guard", "guard>tbl"] } },
        },
        {
          kind: "read",
          title: "The steering table",
          body: "The output is a **steering table**: a versioned, validated document of a few MB. Every version is kept, so on-call can diff \"what changed at 20:03.\"\n\nThe table is the only thing the data plane needs from the control plane.",
          visual: { kind: "flow", spec: { ...ARCH, focus: ["guard", "tbl", "guard>tbl", "tbl>edge", "tbl>api"] } },
        },
        {
          kind: "read",
          title: "The data plane",
          body: "- The **playback API** holds the table in memory and orders CDNs at session start, with no network call on the hot path.\n- A **steering endpoint** on [[edge compute]] (CloudFront Functions, Lambda@Edge, Fastly Compute or Cloudflare Workers, Chapter 14) answers steering manifest requests from a replicated copy of the table.\n\nNeither depends on the control plane being up. If it dies, they serve the last table. This is **[[static stability]]** (Chapter 12).",
          visual: { kind: "flow", spec: { ...ARCH, focus: ARCH_DP, flow: ["tbl>edge", "edge>pl"] } },
          callout: {
            type: "staff",
            text: "Run the steering endpoint on a platform whose failure is independent of the CDNs it steers, or on more than one. If it runs only on CDN A's edge compute, an outage of CDN A also removes your ability to steer away from CDN A. The standard's fallback saves playback, but you lose control at the worst moment.",
          },
        },
        {
          kind: "quiz",
          prompt: "The control plane is down for 20 minutes. What do players see?",
          options: [
            "Session starts fail until it returns.",
            "Nothing: the data plane keeps serving the last table.",
            "All traffic moves to one default CDN.",
            "Steering manifests return 410 Gone.",
          ],
          answer: 1,
          explain: "Static stability: the playback API and edge endpoint keep answering from the last table. You lose fresh decisions, not playback. Alert on table age so the gap is visible.",
        },
        {
          kind: "summary",
          points: [
            "Rank CDNs per cell (country x ASN x device class) from QoE, health, cost and contracts, capacity and rules.",
            "Throughput and errors beat latency for video. Roll small cells up and hold the last decision on stale data.",
            "Requirements: availability above every CDN, a few ms latency, under 1 minute for new sessions, no oscillation, explainable.",
            "Load: ~3,300 to ~10,000 starts/s, ~6,700 to ~33,000 reloads/s. Plan for ~50,000 requests/s.",
            "Control plane (aggregator, policy, guardrails, versioned table) is slow; data plane (API in memory, edge endpoint) is fast and statically stable.",
          ],
        },
      ],
    },

    /* ======================= Lesson 6 ======================= */
    {
      id: "ch09-l6",
      title: "Shares, guardrails and drills",
      goal: "Turn scores into stable shares, defend against the steering service's own failures, and run a failover drill.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "CDN A has the best score in a cell. Why not send it 100% of the cell?",
          options: [
            "Vendors forbid it in contracts.",
            "It causes herding, leaves other CDNs with no data and cold caches, and leaves failover unproven.",
            "DNS cannot express 100%.",
            "Splitting is always cheaper.",
          ],
          answer: 1,
          explain: "Winner-take-all causes **herding** (everyone overloads A, then everyone moves to B), leaves other CDNs with **no data and cold caches**, and leaves failover targets **unproven**.",
        },
        {
          kind: "read",
          title: "An explainable score",
          body: "For each cell and CDN, compute a score that a human can read. It rewards start success, low rebuffering and enough low-end throughput (p10 divided by the bitrate you need), and it subtracts price.\n\nThe weights w1 to w4 are policy. Changing them is a reviewable decision, not hidden logic.",
          visual: { kind: "code", lang: "text", code: SCORE_CODE },
        },
        {
          kind: "read",
          title: "Shares, not a winner",
          body: "Turn scores into **shares**, not a single winner: a large share for the best, a medium share for the second, and a small **exploration floor** on every healthy CDN.\n\nThe floor keeps data flowing and caches warm on every CDN, so each one stays a proven failover target.",
        },
        {
          kind: "read",
          title: "Availability is a gate",
          body: "Availability is a **gate**, not a score. If a CDN's start failure or 5xx rate in a cell crosses a threshold for **two consecutive intervals**, its share there goes to **zero at once**, ignoring rate limits, and an alert fires.\n\nScores blend. Gates do not: a broken CDN must not stay in the mix because it is cheap.",
        },
        {
          kind: "quiz",
          prompt: "CDN B's 5xx rate in a cell crosses the threshold for two consecutive intervals. What happens to B's share in that cell?",
          options: [
            "It drops by 10 points every 5 minutes.",
            "It goes to zero at once, ignoring rate limits, and an alert fires.",
            "It stays until on-call acts.",
            "It is halved.",
          ],
          answer: 1,
          explain: "Hard failures bypass the smoothing. Rate limits are for normal changes; a gate removes a failing CDN immediately.",
        },
        {
          kind: "read",
          title: "Hysteresis and rate limits",
          body: "- **[[Hysteresis]]:** remove fast, return slowly. Remove after 2 bad minutes; restore only after 10 good minutes, in steps (5, then 20, then target).\n- **Rate limits:** in normal conditions, shares change by at most a set amount per interval, for example **10 points per 5 minutes**.\n\nTogether they stop traffic swinging back and forth between CDNs.",
        },
        {
          kind: "number",
          prompt: "A cell's QoE slowly shifts and the policy wants CDN A to go from 70 to 30 share. No hard failure. With a limit of 10 points per 5 minutes, how many minutes does the move take at least?",
          answer: 20,
          tolerance: 1,
          unit: "minutes",
          explain: "70 - 30 = 40 points. 40 / 10 = 4 intervals. 4 x 5 minutes = 20 minutes. A hard failure would skip this and go to zero at once.",
        },
        {
          kind: "read",
          title: "Stickiness by hashing",
          body: "Mid-session switches cost new TCP and TLS connections and maybe a few lower-bitrate segments. So place sessions within shares by **hashing the session ID**: the same session gets the same answer while shares are stable.\n\nThe result becomes `PATHWAY-PRIORITY` in the steering manifest and the variant order at session start. Note the **fail-open** line: bad data must never produce an empty answer.",
          visual: { kind: "code", lang: "ts", code: ORDER_CODE },
        },
        {
          kind: "quiz",
          prompt: "In `orderCdns`, what is returned if every CDN is penalized or has weight 0?",
          visual: { kind: "code", lang: "ts", code: ORDER_CODE },
          options: [
            "An empty list.",
            "Every CDN from `shares`, in its original order.",
            "Only the CDN with the highest weight.",
            "An error is thrown.",
          ],
          answer: 1,
          explain: "`if (live.length === 0) return shares.map((s) => s.cdn);` is the fail-open line. The player always gets defaults to try, and its own failover can still work.",
        },
        {
          kind: "read",
          title: "Money and capacity, after performance",
          body: "After ranking on performance, apply money and capacity:\n- **Cost as tie-breaker.** If two CDNs are within a small QoE margin in a cell, prefer the cheaper one.\n- **Commit tracking.** Behind on a commit with CDN A? Raise A's share in cells where A ties the best. Deep in overage? Lower it.\n- **Capacity caps.** Convert shares to expected Gbps (sessions x average bitrate) and clip at each vendor's reserved capacity per region.",
        },
        {
          kind: "number",
          prompt: "Capacity check (assumed numbers): a region has 200,000 sessions at an average of 4 Mbps, and CDN B's share is 30%. What expected load does that put on CDN B?",
          answer: 240,
          tolerance: 5,
          unit: "Gbps",
          explain: "200,000 x 4 Mbps = 800 Gbps for the region. 30% of 800 = 240 Gbps. If B's reserved capacity there is lower, clip the share.",
        },
        {
          kind: "read",
          title: "When the steering service fails",
          body: "The steering service is a new critical system, so design its own failures.",
          visual: {
            kind: "table",
            headers: ["Failure", "Effect", "Defence"],
            rows: [
              ["Control plane down", "No new tables", "Data plane serves last table, alert on table age"],
              ["Bad data (a beacon bug reports zero throughput for CDN A)", "A healthy CDN is drained", "Limit drain per interval unless two independent signals agree (beacons and CDN logs)"],
              ["Bad table pushed", "Wrong shares everywhere", "Validate before publish, stage tables by region, one-click rollback"],
              ["Steering endpoint down", "Players cannot reload", "Players keep last list (standard), endpoint on two independent platforms"],
              ["Oscillation", "Traffic swings between CDNs", "Shares, rate limits, hysteresis"],
              ["One CDN's URL signing broken", "All its sessions get 403", "Availability gate, per-CDN contract tests in CI"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each failure to its defence.",
          pairs: [
            ["A beacon bug reports zero throughput for CDN A", "Limit drain unless two independent signals agree"],
            ["A bad table is pushed", "Validate, stage by region, one-click rollback"],
            ["The steering endpoint is down", "Players keep the last list; run on two platforms"],
            ["Traffic swings between CDNs", "Shares, rate limits, hysteresis"],
            ["One CDN's URL signing breaks", "Availability gate and per-CDN contract tests"],
          ],
          explain: "Every defence follows one rule: a single bad input or bad push must not move everything at once, and playback must never depend on steering being healthy.",
        },
        {
          kind: "read",
          title: "Observe the steering system",
          body: "Measure the steering system itself (Chapter 11):\n- table age and version on every node;\n- actual versus target share per CDN per cell;\n- mid-session switches per minute, by reason;\n- for each session, the table version and a **reason code** for its CDN order.\n\nThe last one is what makes \"why did this session get CDN B?\" answerable.",
          callout: {
            type: "crunchyroll",
            text: "A platform like Crunchyroll would likely write the playback API and steering logic in TypeScript, the language named in the posting, and use the CMCD session ID (Chapter 11) to join beacons, steering decisions and CDN logs. These are design suggestions, not published facts.",
          },
        },
        {
          kind: "widget",
          widget: "multi-cdn",
          title: "Policy: weights and shares",
          task: "Start with Performance high. Then drag Cost to 100 and Performance to 0, and watch which CDN takes the shares and what happens to the blended QoE. Finally turn on a minimum commit and see the shares move.",
          props: { tab: "policy" },
        },
        {
          kind: "read",
          title: "Failover drills",
          body: "A failover path you have not used recently probably does not work. Prove it with drills:\n1. **Single-region drain:** move one country off CDN A over 10 minutes; watch QoE, remaining CDN capacity and shield load.\n2. **Full vendor drain:** move all traffic off one CDN in steps at a busy, non-peak hour.\n3. **Player hard-cut:** block one CDN hostname for a test cohort (feature flag); verify penalties and pathway switching on every device.\n4. **Steering outage:** stop the control plane; make the endpoint return 500; confirm playback continues.",
        },
        {
          kind: "read",
          title: "The drill loop",
          body: "Every drill follows one loop. Plan the scope, time and abort criteria, and notify vendors. Check headroom. Shift one step. If QoE and error SLOs stay within abort limits, shift the next step; if not, abort and restore the previous table version.",
          visual: { kind: "flow", spec: { ...DRILL, focus: ["plan", "pre", "s1", "watch", "next", "abort", "plan>pre", "pre>s1", "s1>watch", "watch>next", "watch>abort"] } },
        },
        {
          kind: "order",
          prompt: "Put the steps of a vendor drain drill in order.",
          items: [
            "Plan scope, time and abort criteria; notify vendors",
            "Check headroom on the remaining CDNs and shield",
            "Shift the first step of traffic",
            "Shift the next steps while QoE and error SLOs hold",
            "Hold for a full interval and measure",
            "Restore traffic slowly with hysteresis",
          ],
          explain: "After the hold, traffic returns slowly (hysteresis). Both the restore path and the abort path end in a written review of findings and fixes.",
        },
        {
          kind: "read",
          title: "Time to drain is your real SLO",
          body: "Tell vendors before large drills. Drill at realistic load: a 4 a.m. drain tests config, not capacity. Measure **time to drain** (from decision to 90% of traffic moved) separately for new and existing sessions. That number is your real failover SLO. Record drills in postmortem format (Chapter 12).",
          visual: { kind: "flow", spec: { ...DRILL, focus: ["next", "hold", "restore", "abort", "review", "next>hold", "hold>restore", "restore>review", "abort>review"] } },
        },
        {
          kind: "quiz",
          prompt: "You drain CDN A at 4 a.m. and everything works. What did you prove?",
          options: [
            "That the other CDNs can carry the evening peak.",
            "That the config works on the other CDNs, not that they have the capacity.",
            "That time to drain is under one minute.",
            "Nothing at all.",
          ],
          answer: 1,
          explain: "At 4 a.m. the load is tiny, so you tested config, not capacity. Drill at a busy, non-peak hour to learn about capacity, and tell vendors first.",
        },
        {
          kind: "summary",
          points: [
            "Score explainably, then output shares with an exploration floor, never 100% to one CDN.",
            "Availability is a gate: two bad intervals send a share to zero at once.",
            "Hysteresis (remove fast, return slowly), rate limits (e.g. 10 points per 5 min) and session-ID hashing keep traffic stable and sticky. Always fail open.",
            "Cost is a tie-breaker, commits nudge shares, capacity caps clip them.",
            "Defend the steering service's own failures and log a reason code per session.",
            "Drill drains at realistic load; time to drain is your real failover SLO.",
          ],
        },
      ],
    },

    /* ======================= Lesson 7 ======================= */
    {
      id: "ch09-l7",
      title: "Parity, contracts and building your own",
      goal: "Keep every CDN behaving the same, steer with 95th-percentile billing in mind, and judge when an own CDN makes sense.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "Engineers who have run multi-CDN say the hardest part is not the steering algorithm. What is it?",
          options: [
            "Making every CDN behave the same for the same request.",
            "Choosing the score weights.",
            "Getting DNS TTLs low enough.",
            "Buying more CDNs.",
          ],
          answer: 0,
          explain: "Config parity. If CDNs behave differently, steering moves users to a CDN that rejects the token or ignores geo rules.",
        },
        {
          kind: "read",
          title: "Config parity",
          body: "Engineers new to multi-CDN focus on steering algorithms. Engineers who have run it focus on **config parity**: every CDN must behave the same for the same request. Otherwise steering moves users to a CDN that rejects the token or ignores geo rules.\n\nEach vendor expresses config differently: [[VCL]], CloudFront behaviours, Akamai property rules, Workers, Media CDN routes. There is no shared format.",
        },
        {
          kind: "read",
          title: "What must match",
          body: "Eight areas must be equivalent on every vendor.",
          visual: {
            kind: "table",
            headers: ["Area", "What must be equivalent", "Chapter"],
            rows: [
              ["Cache keys", "Same objects cached the same way, tokens and session parameters removed from the key", "4, 5"],
              ["TTLs and headers", "Same Cache-Control for manifests vs segments, same stale-serving rules", "4"],
              ["Error caching", "404 and 5xx cached the same short time, or not at all", "4"],
              ["Token authentication", "Each CDN validates its own token format, with equivalent policy (expiry, IP binding, path scope)", "8"],
              ["Geo-restriction", "Same country decision and response code for the same IP", "8"],
              ["CORS and TLS", "Same Access-Control-* headers, valid certificates, same minimum TLS version", "4, 15"],
              ["Origin path", "Same origin, shield and origin failover behaviour", "6"],
              ["Logging and purge", "Same log schema (with CMCD) to the same pipeline, one purge reaches all CDNs", "5, 11"],
            ],
          },
        },
        {
          kind: "read",
          title: "How teams achieve parity",
          body: "1. **One intent, many renderings.** Describe delivery behaviour once in your own model (for example: \"path `/seg/*`, TTL 1 year, key excludes query, token type HMAC\") and generate every vendor's config from it with Terraform or Pulumi in TypeScript (Chapter 14). Never hand-edit one vendor.\n2. **A conformance suite.** Golden requests run against every CDN hostname on every config change and continuously in production.\n3. **Canary per vendor.** Roll a change to one CDN at a time.",
        },
        {
          kind: "multi",
          prompt: "Which checks belong in a conformance suite that runs against every CDN?",
          options: [
            "An expired token returns 403 everywhere.",
            "A blocked country gets the same response code everywhere.",
            "A range request returns 206 with the right Content-Range.",
            "A manifest is compressed and a segment is not.",
            "Every CDN has the same number of PoPs.",
          ],
          answers: [0, 1, 2, 3],
          explain: "The suite asserts status, headers and body hash for the same request. PoP count is the vendor's business, not a behaviour your viewers see. See [[206 Partial Content]] for range requests.",
        },
        {
          kind: "read",
          title: "A conformance check at its simplest",
          body: "Send the same request to every CDN, keep the headers that must match, and hash them. Hostnames, token and output here are illustrative, not real. Two hashes match. CDN C differs, so investigate.",
          visual: { kind: "code", lang: "bash", code: CONFORM_CODE },
          callout: {
            type: "mistake",
            text: "Testing parity only at launch. Configs [[drift]]: a vendor changes a default, or someone hot-fixes one CDN during an incident and forgets the others. Run the suite on a schedule against production and alert on any difference.",
          },
        },
        {
          kind: "widget",
          widget: "multi-cdn",
          title: "Parity: spot the odd CDN",
          task: "Run more than one golden request (valid token, expired token, range, manifest) against all three CDNs. Find which CDN is misconfigured and what is wrong with it.",
          props: { tab: "parity" },
        },
        {
          kind: "read",
          title: "Canary per vendor",
          body: "Roll a change to one CDN, run conformance and watch QoE, then move to the next. Changing all CDNs at once recreates the single point of failure you paid to remove.",
          callout: {
            type: "staff",
            text: "In any design review for a delivery feature, ask: \"How does this work on every CDN in the pool? Who writes the Akamai version? Where is the conformance test?\" A feature that works on one CDN quietly turns multi-CDN into single-CDN for the users who need it.",
          },
        },
        {
          kind: "quiz",
          prompt: "A cache-key change must reach all three CDNs. Which rollout keeps the benefit of multi-CDN?",
          options: [
            "Push to all three at once so they stay in sync.",
            "One CDN at a time: conformance and QoE, then the next.",
            "Hand-edit each vendor's console the same day.",
            "Change only the cheapest CDN.",
          ],
          answer: 1,
          explain: "Canary per vendor. A bad change on one CDN is a steering problem you can route around. A bad change on all three is an outage.",
        },
        {
          kind: "read",
          title: "How video contracts work",
          body: "Large video contracts usually combine:\n- a **[[commit]]**: you promise to pay for at least X per month, in PB or in Gbps at the 95th percentile, for a lower unit price;\n- **overage** above the commit, often at a higher rate;\n- **regional price bands**;\n- **capacity terms**: how much burst the vendor carries and how much notice it needs for an event.\n\nChapter 16 covers the full economics. Here we cover what steering must know.",
        },
        {
          kind: "read",
          title: "95th-percentile billing",
          body: "With **[[95th percentile billing]]** (burstable billing), the provider samples your bandwidth every **5 minutes**. It sorts the month's samples, **discards the top 5%**, and bills on the highest remaining sample.\n\nSo your bill is not set by your single highest moment. It is set by how many hours you spend near your peak.",
        },
        {
          kind: "number",
          prompt: "How many 5-minute samples are in a 30-day month?",
          answer: 8640,
          tolerance: 10,
          unit: "samples",
          hint: "12 samples an hour.",
          explain: "30 days x 24 hours x 12 samples per hour = 8,640 samples.",
        },
        {
          kind: "number",
          prompt: "The top 5% of those samples are discarded. How many hours of traffic is that?",
          answer: 36,
          tolerance: 1,
          unit: "hours",
          explain: "5% of 8,640 = 432 samples. 432 x 5 minutes = 2,160 minutes = 36 hours a month that do not count.",
        },
        {
          kind: "number",
          prompt: "The evening peak is ~1M streams x 4 Mbps = ~4 Tbps, for about 3 hours a day (~90 hours a month, far more than 36). CDN A carries 60% of it. About what is A's billable rate?",
          answer: 2.4,
          tolerance: 0.1,
          unit: "Tbps",
          explain: "90 hours near the peak is far more than the 36 discarded hours, so the 95th percentile sits near the daily peak. 60% x 4 Tbps = ~2.4 Tbps. **Daily peaks set the bill.**",
        },
        {
          kind: "quiz",
          prompt: "A simulcast doubles traffic to ~8 Tbps for 1 hour each week. On a 95th-percentile contract, what happens to the bill?",
          options: [
            "It doubles, because the peak doubled.",
            "It may barely change: ~4 spike hours a month fit inside the 36 discarded hours.",
            "It rises by exactly 4 hours of 8 Tbps.",
            "95th-percentile contracts ignore all traffic above the commit.",
          ],
          answer: 1,
          explain: "Four 1-hour spikes are about 4 hours a month, inside the 36 discarded hours. **Short premiere spikes can be nearly free** on 95th percentile. On a per-GB contract you pay for every spike byte.",
        },
        {
          kind: "match",
          prompt: "Match each situation to the steering response.",
          pairs: [
            ["Behind on commit with CDN A at mid-month", "Raise A's share in cells where A's QoE ties the best"],
            ["CDN B's 95th estimate near the contract level, 10 days left", "Cap B at the evening peak, use B for short spikes only"],
            ["Premiere tonight, 1 hour, 2x traffic", "Send spike volume to 95th-percentile vendors with spare burst budget and reserved capacity"],
            ["CDN C is cheapest but has bad QoE in a cell", "Do not steer there: QoE gates come before cost"],
          ],
          explain: "Contracts shape steering, but always inside QoE limits. Track each vendor's sample distribution in near real time: a long incident failover can use up a vendor's 36 free hours, and after that every extra hour counts.",
        },
        {
          kind: "read",
          title: "Bound cost by QoE",
          body: "Track each vendor's sample distribution in near real time. A long incident failover can use up a vendor's 36 free hours, and after that every extra hour counts.\n\nAnd never let cost override quality. Cost only chooses among CDNs whose QoE is close to the best.",
          callout: {
            type: "staff",
            text: "Bound cost-aware steering by QoE. A rule like \"cost may only choose among CDNs within 2% of the best rebuffering ratio in this cell\" turns a vague goal into a reviewable rule.",
          },
        },
        {
          kind: "read",
          title: "Model the total cost",
          body: "A CDN invoice is only part of the bill. Where a CDN fetches its misses from also costs money, and steering decides which CDN fetches.",
          callout: {
            type: "mistake",
            text: "Forgetting origin costs. CloudFront fetching from S3 pays no data transfer charge, while another CDN fetching from S3 pays AWS internet egress unless a shared shield or interconnect deal changes that (Chapters 6 and 16). Steering can move cost from the CDN invoice to the cloud invoice. Model the total.",
          },
        },
        {
          kind: "read",
          title: "The alternative: Netflix Open Connect",
          body: "Netflix started **[[Open Connect]]** in 2011 for two stated reasons: it had become a large part of consumer ISP traffic and needed to work directly with ISPs, and a custom design allowed \"a proactive, directed caching solution\". Netflix places **Open Connect Appliances ([[OCAs|OCA]])** in internet exchange points and gives them free to qualifying ISPs; the ISP provides power, space and connectivity. Netflix fills OCAs during off-peak **fill windows**, and the AWS control plane steers each playback by URL. Before Open Connect, Netflix used several commercial CDNs.",
        },
        {
          kind: "read",
          title: "When an own CDN makes sense",
          body: "The assumed Crunchyroll profile (~8 Tbps peak, ~540 PB per month) is large but far smaller than the largest services. Running appliances with ISP deals across 200+ countries is a different business. The common middle path is a **hybrid**: commercial multi-CDN, strong steering, a shared shield, and targeted deals ([[embedded caches|embedded cache]] or open caching) with a few very large ISPs.",
          visual: {
            kind: "table",
            headers: ["Factor", "Favours own CDN", "Favours commercial multi-CDN"],
            rows: [
              ["Traffic volume", "A large share of ISP peak traffic in many countries", "A few Tbps, important but not dominant for ISPs"],
              ["ISP leverage", "ISPs want your caches inside to save transit", "ISPs have little reason to host your hardware"],
              ["Demand pattern", "Predictable, so proactive fill works", "Spiky, event-driven, hard to pre-place"],
              ["Team and capital", "Can fund hardware, logistics and peering teams in many countries", "Small or mid-sized delivery team"],
            ],
          },
          callout: {
            type: "staff",
            text: "\"Should we build our own CDN?\" is a finance and partnerships question. Start with: \"What cost per GB must we beat, where do we have enough traffic to interest ISPs, and who runs hardware in 40 countries?\"",
          },
        },
        {
          kind: "quiz",
          prompt: "Assumed profile: ~8 Tbps peak, ~540 PB a month, 200+ countries, spiky simulcast premieres. Which delivery model fits best?",
          options: [
            "Build an Open Connect-style CDN in every country.",
            "A hybrid: commercial multi-CDN, strong steering, a shared shield, and targeted deals with a few very large ISPs.",
            "One commercial CDN with a long contract.",
            "Only ISP-embedded caches.",
          ],
          answer: 1,
          explain: "Spiky, event-driven demand and a few Tbps favour commercial multi-CDN. Targeted ISP deals make sense only where the numbers clearly work.",
        },
        {
          kind: "summary",
          points: [
            "Config parity is the hardest part: one intent model, generated configs, a continuous conformance suite, canary per vendor.",
            "Contracts combine commits, overage, regional price bands and capacity terms.",
            "95th percentile: 8,640 samples a month, top 432 (36 hours) discarded. Daily peaks set the bill; short spikes can be nearly free.",
            "Cost only chooses among CDNs near the best QoE, and steering can move cost to the cloud invoice.",
            "An own CDN like Open Connect fits huge, predictable, ISP-significant traffic. Most services do better with a hybrid.",
          ],
        },
      ],
    },

    /* ======================= Lesson 8: Checkpoint ======================= */
    {
      id: "ch09-l8",
      title: "Checkpoint",
      goal: "Answer the chapter's review questions and sketch a full multi-CDN design.",
      minutes: 9,
      steps: [
        {
          kind: "reveal",
          prompt: "Give three reasons to use more than one CDN, and two costs you accept in return.",
          answer: "**Reasons:** resilience, per-region (and per-ASN) performance, cost leverage, spike capacity, regional coverage.\n\n**Costs:** lower cache efficiency, more origin load, config parity work, smaller volume per vendor, and a new critical system (the steering layer).",
        },
        {
          kind: "quiz",
          prompt: "Why can DNS-based steering take much longer than the TTL to move traffic off a failing CDN?",
          options: [
            "Steering DNS servers are slow to compute answers.",
            "Resolvers and devices cache answers, some ignore low TTLs, and players keep open connections to the old CDN.",
            "CDNs refuse to release traffic until the TTL doubles.",
            "Certificates must be reissued first.",
          ],
          answer: 1,
          explain: "Caching in resolvers and devices, ignored TTLs, and open connections all delay the move. Reported delays range from about 300 seconds to 15 minutes.",
        },
        {
          kind: "multi",
          prompt: "A VOD session starts on CDN A. Five minutes later CDN A degrades on that viewer's ISP. Which methods can move this session?",
          options: [
            "DNS-based steering",
            "Server-side steering at session start",
            "Client-side switching in the player",
            "HLS/DASH Content Steering",
          ],
          answers: [2, 3],
          explain: "Player-side switching and Content Steering can. DNS usually cannot, because the connection is already open. Session-start steering cannot, because the VOD manifest was fetched once.",
        },
        {
          kind: "quiz",
          prompt: "In HLS Content Steering, the steering server returns 410 Gone. What does the player do?",
          options: [
            "Stops playback.",
            "Stops calling that URI for the session and keeps the last pathway list.",
            "Retries every second until it works.",
            "Switches to the last pathway in the list.",
          ],
          answer: 1,
          explain: "It never calls that URI again in the session and keeps the last list. So the steering server is not critical for playback: if it fails, viewers keep watching. You can design it for control, not for survival.",
        },
        {
          kind: "reveal",
          prompt: "What is pathway cloning, and when is it useful?",
          answer: "A new pathway defined in the steering manifest by **copying an existing one**, replacing the hostname and adding parameters (`PATHWAY-CLONES` with `BASE-ID`, `ID`, `URI-REPLACEMENT`). It adds a CDN that is missing from the original or cached manifest, even **mid-session**.",
        },
        {
          kind: "quiz",
          prompt: "Why should a steering policy output shares per cell instead of one best CDN?",
          options: [
            "Shares are easier to store.",
            "Winner-take-all causes herding and oscillation, leaves other CDNs without data and with cold caches, and leaves failover unproven.",
            "Players cannot handle a single CDN.",
            "Vendors bill less for shared traffic.",
          ],
          answer: 1,
          explain: "Shares plus an exploration floor keep every CDN measured, warm and proven, and they move smoothly instead of flipping.",
        },
        {
          kind: "number",
          prompt: "A premiere doubles traffic for 1 hour every week. About how many spike hours does that add in a month?",
          answer: 4,
          tolerance: 0.5,
          unit: "hours",
          explain: "About 4 weeks x 1 hour = ~4 hours a month. Compare that with the 36 hours that 95th-percentile billing discards.",
        },
        {
          kind: "quiz",
          prompt: "So why may those spikes barely change a 95th-percentile bill but raise a per-GB bill?",
          options: [
            "95th-percentile billing discards the top 5% of 5-minute samples (~36 hours a month), and the ~4 spike hours fit inside it; per-GB billing charges every byte.",
            "Per-GB contracts have higher prices at night.",
            "95th-percentile billing only counts weekdays.",
            "Spikes are free on every contract.",
          ],
          answer: 0,
          explain: "The discarded 36 hours absorb short spikes. Daily peaks (~90 hours a month) set the 95th-percentile bill. Per-GB billing has no such window.",
        },
        {
          kind: "reveal",
          prompt: "Design review: sketch the steering design for a platform like Crunchyroll in seven points.",
          answer: "An assumed design, consistent with the 2020 Katana post and the job posting:\n1. **Three or more production CDNs**, each with real daily traffic, behind a shared origin shield.\n2. **Session-start decision** in the playback path from an in-memory table, returning per-CDN signed URLs and pathways.\n3. **Content steering** for mid-session changes on modern players, from an endpoint independent of any single steered CDN.\n4. **Player failover** on errors as the last line of defence on every platform, and **DNS steering** as a coarse backstop for old devices.\n5. **A control plane** ranking CDNs per cell from QoE, health, cost and capacity, with guardrails, overrides and an audit trail.\n6. **Config parity** through one intent model, generated configs and a continuous conformance suite.\n7. **Regular drills** with a measured time-to-drain SLO, and premiere plans with pre-warmed CDNs and reserved capacity.",
        },
        {
          kind: "read",
          title: "Your first weeks",
          body: "The design above is assumed. The real system is something you learn on the job, and the questions below get you there fastest.",
          callout: {
            type: "crunchyroll",
            text: "In your first weeks, learn which CDNs carry production traffic and in what shares, where the CDN decision is made today, which players support content steering, how parity is enforced, when the last full-vendor drain happened, and which contracts bill on 95th percentile.",
          },
        },
        {
          kind: "quiz",
          prompt: "Which statement about HLS/DASH Content Steering is true?",
          options: [
            "It decides which CDN is best for each ASN.",
            "One steering server can steer both HLS and DASH players.",
            "It needs custom code in every player.",
            "It stops playback if the steering server fails.",
          ],
          answer: 1,
          explain: "The two standards share the same server-client exchange. The standard gives the mechanism (pathways, JSON steering manifest, penalties, cloning, safe fallback); the policy is still yours.",
        },
        {
          kind: "quiz",
          prompt: "What does a well-designed steering service do when its control plane dies?",
          options: [
            "Routes all traffic to the cheapest CDN.",
            "Keeps serving the last table from a fast, statically stable data plane.",
            "Fails session starts until it recovers.",
            "Falls back to winner-take-all.",
          ],
          answer: 1,
          explain: "A slow control plane and a fast, statically stable data plane. The data plane steers with shares, hysteresis, floors and stickiness, and treats hard failures as gates.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "Multi-CDN buys resilience, per-region performance, leverage, spike capacity and coverage; it costs split caches, origin load, parity work and a new critical system (a shared shield helps).",
            "Four methods: DNS (easy, slow, coarse), session start (cannot move VOD), player logic (fast, fragmented, can oscillate), Content Steering (standard, one server for HLS and DASH). Combine them.",
            "A steering service splits a slow control plane from a fast, statically stable data plane, and steers with shares, hysteresis, floors and stickiness, with hard failures as gates.",
            "Config parity is the hardest part: one intent model, generated configs, continuous conformance tests.",
            "95th-percentile billing discards about 36 hours a month: daily peaks set the bill, short spikes can be nearly free. Cost only chooses among CDNs with near-equal QoE.",
            "An own CDN fits very large, predictable, ISP-significant traffic. Most services do better with multi-CDN plus targeted ISP deals.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Apple, \"HLS Content Steering Specification\", v1.2b1, April 2021. https://developer.apple.com/streaming/HLSContentSteeringSpecification.pdf",
    "R. Pantos, \"HTTP Live Streaming 2nd Edition\" (draft-pantos-hls-rfc8216bis), Section 7 Content Steering, IETF draft, 2025–2026 revisions. https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis",
    "Y. Reznik et al., \"Content Steering: A Standard for Multi-CDN Streaming\", SMPTE Motion Imaging Journal, January/February 2025. https://reznik.org/papers/JMI2025_Content_Steering.pdf",
    "D. Silhavy, \"Dynamic CDN Switching – Content Steering in dash.js\", Fraunhofer FOKUS, 30 August 2022. https://websites.fraunhofer.de/video-dev/dynamic-cdn-switching-content-steering-in-dash-js/",
    "ETSI TS 103 998 V1.1.1, \"DASH-IF: Content Steering for DASH\", January 2024. https://www.etsi.org/deliver/etsi_ts/103900_103999/103998/01.01.01_60/ts_103998v010101p.pdf",
    "Crunchyroll Engineering, \"Katana: Lessons Learned from Slicing HLS and Dicing Dash on the FaaS Edge\", November 2020. https://medium.com/crunchyroll/katana-lessons-learned-from-slicing-hls-and-dicing-dash-on-the-faas-edge-3fa1de2d5ba2",
    "Netflix, \"Open Connect Overview\". https://openconnect.netflix.com/Open-Connect-Overview.pdf",
    "V. K. Adhikari et al., \"Unreeling Netflix: Understanding and Improving Multi-CDN Movie Delivery\", IEEE INFOCOM 2012. https://www.cs.princeton.edu/courses/archive/fall14/cos561/papers/NetFlix12.pdf",
    "X. Liu et al., \"A Case for a Coordinated Internet Video Control Plane\", ACM SIGCOMM 2012. https://users.ece.cmu.edu/~vsekar/assets/pdf/sigcomm12_conviva.pdf",
    "A. Ganjam et al., \"C3: Internet-Scale Control Plane for Video Quality Optimization\", USENIX NSDI 2015. https://usenix.org/conference/nsdi15/technical-sessions/presentation/ganjam",
    "Streaming Media, \"Disney's Best Practices for CDN Load Balancing and QoS\" (Robert Colantuoni, Disney Streaming), 31 March 2021. https://streamingmedia.com/Articles/Editorial/Short-Cuts/Disneys-Best-Practices-for-CDN-Load-Balancing-and-QoS-145721.aspx",
    "Streaming Media, \"How Disney Streaming Uses Metrics to Improve CDN Performance\" (Eric Klein, Disney Streaming), 29 December 2021. https://streamingmedia.com/Articles/Editorial/Short-Cuts/How-Disney-Streaming-Uses-Metrics-to-Improve-CDN-Performance-150246.aspx",
    "S. Kidder, \"Multi-CDN Support in Mux Video for Improved Performance and Reliability\", Mux blog, 12 February 2019. https://mux.com/blog/multi-cdn-support-in-mux-video-for-improved-performance-and-reliability",
    "IBM Community, \"Feature Spotlight: NS1 Connect Pulsar\", 14 October 2025. https://community.ibm.com/community/user/blogs/claire-odonovan/2025/10/14/feature-spotlight-ns1-connect-pulsar",
    "Citrix Support, \"Notice of Change – Intelligent Traffic Management (ITM) and Network Experience Monitoring (NEM)\", CTX691799, and Citrix product lifecycle matrix (EOL 31 October 2025). https://support.citrix.com/external/article/691799/notice-of-change-intelligent-traffic-ma.html",
    "Fastly, \"Summary of June 8 outage\", June 2021. https://www.fastly.com/blog/summary-of-june-8-outage",
    "W. Arrington and L. Atkinson, \"Using CloudFront Origin Shield to protect your origin in a multi-CDN deployment\", AWS Networking and Content Delivery Blog, 21 January 2021. https://aws.amazon.com/blogs/networking-and-content-delivery/using-cloudfront-origin-shield-to-protect-your-origin-in-a-multi-cdn-deployment",
    "Google Cloud, \"Media CDN overview\". https://docs.cloud.google.com/media-cdn/docs/overview",
    "Wikipedia, \"Burstable billing\". https://en.wikipedia.org/wiki/Burstable_billing",
    "Consumer Technology Association, \"CTA-5004: Common Media Client Data (CMCD)\", September 2020. https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf",
  ],
};
export default chapter;
