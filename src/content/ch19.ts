import type { Chapter, FlowSpec, FlowNode, FlowEdge } from "./types";

// Chapter 19 content. Source: chapters/19-thinking-like-a-staff-engineer.md
// The glossary table (19.12) is not converted here: it lives in glossary.ts and the #glossary page.

/* ---------------- Diagram helpers ---------------- */

function spec(
  base: { nodes: FlowNode[]; edges: FlowEdge[]; direction?: "down" | "right"; groups?: FlowSpec["groups"] },
  focus?: string[],
  flow?: string[],
): FlowSpec {
  const s: FlowSpec = { nodes: base.nodes, edges: base.edges };
  if (base.direction) s.direction = base.direction;
  if (base.groups) s.groups = base.groups;
  if (focus) s.focus = focus;
  if (flow) s.flow = flow;
  return s;
}

/** Keep only the listed nodes (and the edges between them). Used to grow one diagram step by step. */
function only(base: { nodes: FlowNode[]; edges: FlowEdge[] }, show: string[], focus?: string[]): FlowSpec {
  const keep = new Set(show);
  const out: FlowSpec = {
    nodes: base.nodes.filter((n) => keep.has(n.id)),
    edges: base.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
  };
  if (focus) out.focus = focus;
  return out;
}

/* 19.1 The staff problem space: the bytes path plus the control plane that steers and protects it. */
const SPACE = {
  nodes: [
    { id: "or", label: "Origin storage", sub: "buckets in two clouds", kind: "storage", col: 0, row: 0 },
    { id: "sh", label: "Shield", sub: "mid-tier cache", kind: "shield", col: 1, row: 0 },
    { id: "edge", label: "CDN edge", sub: "several vendors", kind: "edge", col: 2, row: 0 },
    { id: "pl", label: "Player", sub: "on the device", kind: "player", col: 3, row: 0 },
    { id: "hd", label: "Health detection", sub: "RUM, probes", kind: "monitor", col: 0, row: 2 },
    { id: "st", label: "Steering", sub: "which CDN", kind: "steering", col: 1, row: 2 },
    { id: "sg", label: "Signing", sub: "tokens, signed URLs", kind: "service", col: 2, row: 3 },
    { id: "api", label: "Playback URLs", sub: "playback API", kind: "api", col: 3, row: 2 },
  ] as FlowNode[],
  edges: [
    { from: "or", to: "sh" },
    { from: "sh", to: "edge" },
    { from: "edge", to: "pl", label: "via the ISP" },
    { from: "hd", to: "st", label: "health" },
    { from: "st", to: "api", label: "CDN list" },
    { from: "sg", to: "api", label: "tokens" },
    { from: "api", to: "pl", label: "URLs", dashed: true },
  ] as FlowEdge[],
  groups: [
    { id: "data", label: "Bytes path", nodes: ["or", "sh", "edge", "pl"], tone: "accent" as const },
    { id: "ctl", label: "Control plane", nodes: ["hd", "st", "sg", "api"], tone: "neutral" as const },
  ],
};
const SPACE_DATA = ["or", "sh", "edge", "pl", "or>sh", "sh>edge", "edge>pl"];
const SPACE_CTL = ["hd", "st", "sg", "api", "hd>st", "st>api", "sg>api", "api>pl"];

/* 19.2.2 The funnel: hit ratio inverts into origin load (assumed numbers). */
const FUNNEL = {
  direction: "down" as const,
  nodes: [
    { id: "pl", label: "Players", sub: "2M x 4 Mbps = 8 Tbps", kind: "player", col: 2, row: 0 },
    { id: "edge", label: "CDN edges", sub: "across vendors", kind: "edge", col: 2, row: 1 },
    { id: "em", label: "Edge misses", sub: "0.4 Tbps", kind: "generic", col: 2, row: 2, tone: "warn" },
    { id: "sh", label: "Shield / mid-tier", kind: "shield", col: 2, row: 3 },
    { id: "sm", label: "Shield misses", sub: "about 40 Gbps", kind: "generic", col: 2, row: 4, tone: "good" },
    { id: "or", label: "Origin S3 + GCS", sub: "multi-cloud", kind: "storage", col: 2, row: 5 },
  ] as FlowNode[],
  edges: [
    { from: "pl", to: "edge", label: "8 Tbps" },
    { from: "edge", to: "em", label: "edge hit 0.95" },
    { from: "em", to: "sh" },
    { from: "sh", to: "sm", label: "shield hit 0.90" },
    { from: "sm", to: "or" },
  ] as FlowEdge[],
};

/* 19.7.2 Problem 2: the steering service, split into an offline scorer and an online decider. */
const STEER = {
  nodes: [
    { id: "p", label: "Player", sub: "starts a session", kind: "player", col: 1, row: 0 },
    { id: "x", label: "CDN A / B / C", kind: "cdn", col: 3, row: 0 },
    { id: "a", label: "Playback API", kind: "api", col: 0, row: 1 },
    { id: "m", label: "Signed URLs", sub: "with CDN host list", kind: "service", col: 2, row: 1 },
    { id: "s", label: "Steering decider", sub: "online, per session", kind: "steering", col: 1, row: 1 },
    { id: "r", label: "Weights table", sub: "rules, in memory", kind: "cache", col: 2, row: 2 },
    { id: "c", label: "Scorer job", sub: "offline, every minute", kind: "service", col: 1, row: 2 },
    { id: "q", label: "RUM + QoE", sub: "pipeline", kind: "monitor", col: 0, row: 3 },
    { id: "h", label: "Probes + status", sub: "synthetic, CDN status", kind: "monitor", col: 1, row: 3 },
    { id: "k", label: "Cost + commits", sub: "commit tracker", kind: "service", col: 2, row: 3 },
  ] as FlowNode[],
  edges: [
    { from: "p", to: "a" },
    { from: "a", to: "s" },
    { from: "s", to: "r", label: "reads" },
    { from: "q", to: "c" },
    { from: "h", to: "c" },
    { from: "k", to: "c" },
    { from: "c", to: "r", label: "writes" },
    { from: "s", to: "m" },
    { from: "m", to: "p" },
    { from: "p", to: "x", label: "segment fetch" },
  ] as FlowEdge[],
};

/* 19.7.8 Problem 8: failover state machine per CDN per region. */
const FSM = {
  nodes: [
    { id: "h", label: "Healthy", sub: "normal weights", kind: "monitor", col: 0, row: 1, tone: "good" },
    { id: "d", label: "Degraded", sub: "shift part of traffic", kind: "monitor", col: 2, row: 1, tone: "warn" },
    { id: "f", label: "Failed over", sub: "minimum weight only", kind: "monitor", col: 4, row: 1, tone: "bad" },
    { id: "r", label: "Recovering", sub: "ramp weight slowly", kind: "monitor", col: 2, row: 4, tone: "accent" },
  ] as FlowNode[],
  edges: [
    { from: "h", to: "d", label: "bad 3 windows" },
    { from: "d", to: "f", label: "bad 3 more" },
    { from: "d", to: "h", label: "good 5 windows", dashed: true },
    { from: "f", to: "r", label: "good 10 windows" },
    { from: "r", to: "h", label: "good 10 windows" },
    { from: "r", to: "f", label: "bad again", tone: "bad" as const },
  ] as FlowEdge[],
};

/* 19.9 Partner teams around Media Delivery. */
const PARTNERS = {
  nodes: [
    { id: "cp", label: "Content Pipeline", sub: "packaged assets", kind: "packager", col: 0, row: 0 },
    { id: "pr", label: "Content Protection", sub: "DRM and tokens", kind: "drm", col: 0, row: 2 },
    { id: "md", label: "Media Delivery", sub: "origin, shield, CDNs", kind: "cdn", col: 2, row: 1, tone: "accent" },
    { id: "sec", label: "Security", sub: "WAF, certs, IAM", kind: "firewall", col: 2, row: 3 },
    { id: "pb", label: "Playback", sub: "players, playback API", kind: "player", col: 4, row: 1 },
  ] as FlowNode[],
  edges: [
    { from: "cp", to: "md" },
    { from: "pr", to: "md" },
    { from: "sec", to: "md" },
    { from: "md", to: "pb", label: "URLs, CDN lists" },
    { from: "pb", to: "md", label: "QoE telemetry", dashed: true },
  ] as FlowEdge[],
};

/* 19.10 The first 90 days. */
const DAYS = {
  nodes: [
    { id: "a", label: "Days 1-30", sub: "learn the bytes path", kind: "generic", col: 0, row: 1, tone: "accent" },
    { id: "a1", label: "Trace one request", sub: "hop by hop", kind: "generic", col: 2, row: 0 },
    { id: "a2", label: "Read postmortems", sub: "last 12 months", kind: "generic", col: 2, row: 1 },
    { id: "a3", label: "Shadow on-call", sub: "and one premiere", kind: "generic", col: 2, row: 2 },
    { id: "b", label: "Days 31-60", sub: "own one thing end to end", kind: "generic", col: 0, row: 3, tone: "accent" },
    { id: "b1", label: "Fix one alert gap", sub: "or a runbook gap", kind: "generic", col: 2, row: 3 },
    { id: "b2", label: "Ship one change", sub: "through the full pipeline", kind: "generic", col: 2, row: 4 },
    { id: "c", label: "Days 61-90", sub: "lead one improvement", kind: "generic", col: 0, row: 5, tone: "accent" },
    { id: "c1", label: "Write a design doc", kind: "generic", col: 2, row: 5 },
    { id: "c2", label: "Health review", sub: "present to the team", kind: "monitor", col: 2, row: 6 },
  ] as FlowNode[],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "a", to: "a1" },
    { from: "a", to: "a2" },
    { from: "a", to: "a3" },
    { from: "b", to: "b1" },
    { from: "b", to: "b2" },
    { from: "c", to: "c1" },
    { from: "c", to: "c2" },
  ] as FlowEdge[],
};

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 19,
  title: "Thinking Like a Staff Media Delivery Engineer",
  short: "Staff thinking",
  part: 6,
  hook: "Mental models, interview problems, a 90-day plan and the full vocabulary.",
  lessons: [
    /* ======================= Lesson 1 ======================= */
    {
      id: "ch19-l1",
      title: "What staff means on a delivery team",
      goal: "Explain how staff work differs from senior work on a media delivery team, and apply the four habits and the three-question test.",
      minutes: 7,
      steps: [
        {
          kind: "read",
          title: "A new problem lands on your team",
          body: "Picture a normal week: a big premiere is next month, the CDN bill jumped, and stalls are up in one country. Many engineers can fix one part. A staff engineer knows which questions to ask first.\n\nThis lesson shows what \"staff\" means on a media delivery team. By the end you can name the four staff habits and test any proposal with three short questions.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. A new delivery problem lands on the team. Which person would you expect is acting like a **staff engineer**?",
          options: [
            "The one who knows the most header names by heart",
            "The one who finds the two numbers that matter, names the trade-off, predicts how it fails and writes it down",
            "The one who writes the most code this quarter",
            "The one who owns the most dashboards",
          ],
          answer: 1,
          explain: "Staff is a way of thinking, not a store of facts or a code count. The staff engineer finds the key numbers, names the trade-off out loud, predicts the failure, and writes it down so that ten other people can act on it. The rest of this lesson unpacks each of those moves.",
        },
        {
          kind: "read",
          title: "The parts and the way of thinking",
          body: "The first eighteen chapters gave you the parts: networks, DNS, HTTP, caches, origins, packaging, DRM, multi-CDN, players, observability, reliability, spikes, IaC, security, money, the giants and a capstone design.\n\nThis chapter is about the **way of thinking** that joins those parts. A staff engineer looks at a new delivery problem, finds the two numbers that matter, names the trade-off, predicts how it fails, and writes it down so that ten other people can act on it.",
        },
        {
          kind: "read",
          title: "The running example, one more time",
          body: "Crunchyroll's job posting describes 100M+ fans in 200+ countries and territories. In May 2026 Crunchyroll said it passed **21 million paid subscribers**, up from 17 million in May 2025.\n\nEverything else about traffic uses the book's **assumed** model: about 1M concurrent streams at a normal evening peak, about 2M at a big [[simulcast]] premiere, about 4 Mbps average bitrate, about 8 Tbps peak egress (design for 12), and about 540 PB a month.",
          visual: {
            kind: "stats",
            items: [
              { value: "21M", label: "paid subscribers", note: "published, May 2026" },
              { value: "2M", label: "premiere streams", note: "assumed" },
              { value: "8 Tbps", label: "peak egress", note: "assumed; design for 12" },
              { value: "540 PB", label: "delivered per month", note: "assumed" },
            ],
          },
        },
        {
          kind: "read",
          title: "Senior builds a part. Staff owns a space.",
          body: "At senior level you are trusted to build a component well. At **staff** level you are trusted with a whole **problem space**. You decide which problems are worth solving, you shape the design across team boundaries, and you make the system safer and cheaper over years, not only this quarter.\n\nFor media delivery, that space starts with the **bytes path**: origin storage, shield, CDN edge, ISP and player.",
          visual: { kind: "flow", spec: spec(SPACE, SPACE_DATA, ["or>sh", "sh>edge", "edge>pl"]), caption: "The bytes path moves the video." },
        },
        {
          kind: "read",
          title: "Plus the small services that steer it",
          body: "The space also includes the small **[[control plane]]** services that steer and protect the bytes path: playback URLs, steering, signing and health detection. The control plane **decides**. The bytes path, also called the **data plane**, **moves** the video.\n\nControl plane services move almost no bytes. But they decide which CDN each viewer uses and whether a request is allowed. A bug there can stop every stream at once.",
          visual: { kind: "flow", spec: spec(SPACE, SPACE_CTL, ["hd>st", "st>api", "api>pl"]), caption: "The control plane decides; the data plane moves bytes." },
        },
        {
          kind: "multi",
          teach: "The control plane decides things: which CDN to use, whether a request is allowed. The data plane moves the video bytes. Sort each item by whether it decides or moves bytes.",
          prompt: "Which of these are **control plane** services in the delivery problem space? Select all that apply.",
          options: ["Playback URLs (playback API)", "Steering", "The shield cache", "Signing (tokens)", "Health detection", "The ISP last mile"],
          answers: [0, 1, 3, 4],
          explain: "Playback URLs, steering, signing and health detection make decisions. The shield and the ISP are on the bytes path (the data plane): they move the video.",
        },
        {
          kind: "read",
          title: "Habits 1 and 2: numbers first, failure first",
          body: "Four habits separate staff work from senior work. The first two:\n\n1. **Numbers first.** Before talking about architecture, write down concurrency, bitrate, segment rate, hit ratio, origin load and cost per month. Most bad delivery designs are not wrong in logic. They are wrong by a factor of ten in one number.\n2. **Failure first.** For every box in a diagram, ask: \"What happens to playback when this box is slow, wrong or gone?\" The answer must be a mechanism, not a hope.",
        },
        {
          kind: "read",
          title: "Habits 3 and 4: blast radius, writing",
          body: "3. **[[Blast radius]] thinking.** Blast radius is how many viewers one mistake can hurt. A CDN config push, a DNS change and a certificate rotation can each break every stream on Earth in one minute. Design rollouts so that a mistake hurts a small slice first.\n4. **Writing as leverage.** The design doc, the runbook, the vendor scorecard and the postmortem are the products. A good doc lets the team make the same good decision without you in the room.",
        },
        {
          kind: "match",
          teach: "Each habit answers one question: how big is it, what breaks, how many people does a mistake hurt, and can others decide without me? Match each example to the question it answers.",
          prompt: "Match each habit to what it looks like in practice.",
          pairs: [
            ["Numbers first", "Writing 2M x 4 Mbps = 8 Tbps before drawing a box"],
            ["Failure first", "Asking what the viewer sees when the shield is slow"],
            ["Blast radius thinking", "Pushing a config to a small slice before everyone"],
            ["Writing as leverage", "A doc that lets the team decide without you in the room"],
          ],
          explain: "These four habits separate staff work from senior work on a delivery team. Each one is a way to find a problem before production finds it for you.",
        },
        {
          kind: "read",
          title: "The three-question test",
          body: "A useful test for any proposal is three questions, asked in this order:\n\n- \"How many bytes and requests per second does this touch at peak?\"\n- \"What does the viewer see when it fails?\"\n- \"How do we roll it back in under five minutes?\"\n\nThe order follows the habits: size first, then failure, then a small and reversible blast radius.",
          callout: { type: "staff", text: "If the author cannot answer all three, the design is not ready for review." },
        },
        {
          kind: "order",
          teach: "The three questions follow the order of the habits you just learned. You cannot judge a failure until you know how big the thing is.",
          prompt: "Put the three review questions in the order the staff lens asks them.",
          items: [
            "How many bytes and requests per second does this touch at peak?",
            "What does the viewer see when it fails?",
            "How do we roll it back in under five minutes?",
          ],
          explain: "Size first (numbers first), then failure (failure first), then rollback (blast radius). Each question builds on the one before it.",
        },
        {
          kind: "read",
          title: "Value is outages prevented and money saved",
          body: "How do you measure staff work? Not by lines of code.\n\nOn a delivery team, one staged-rollout rule that prevents a global outage creates more value than a quarter of feature code. So does a better contract structure that saves 15 percent on the CDN bill.",
          callout: { type: "mistake", text: "Treating \"staff\" as \"the person who writes the most code.\" Count outages prevented and money saved instead." },
        },
        {
          kind: "read",
          title: "This chapter is a toolbox",
          body: "The rest of this chapter is a toolbox: twelve mental models, the numbers to carry in your head, a design-doc template, a design-review question bank, a trade-off catalog, ten interview-style problems with answer sketches, advice on CDN vendors and partner teams, and a first-90-days plan. The book also has a full glossary (see the Glossary page) and a reading list.\n\nRead it once now. Then come back before every design review, every vendor call and every interview.",
        },
        {
          kind: "summary",
          points: [
            "Staff owns a problem space: the bytes path plus the control plane that steers and protects it.",
            "Four habits: numbers first, failure first, blast radius thinking, writing as leverage.",
            "Three-question test: peak bytes and requests, what the viewer sees on failure, rollback in under five minutes.",
            "Staff value is measured in outages prevented and money saved, not lines of code.",
          ],
        },
      ],
    },

    /* ======================= Lesson 2 ======================= */
    {
      id: "ch19-l2",
      title: "Twelve mental models",
      goal: "Use twelve short mental models to reason about any delivery design: copies, the funnel, the herd, cache bets, the player, the eyeball, config, static stability, cells, cost, head and tail, and degrading.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "Short ways to think",
          body: "A **mental model** is a short way to think about a problem. Each of the twelve models in this lesson compresses one or more earlier chapters into one sentence you can say in a design review.\n\nBy the end you can name the model that fits a situation, and use it to make an argument short and clear.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. A cache answers 95 of every 100 bytes itself; the other 5 come from the origin. It improves to 99 of every 100. What would you expect to happen to the traffic the origin sends?",
          options: [
            "It drops by about 4 percent",
            "It drops by about half",
            "It drops by about 5x",
            "It barely changes; hit ratio only affects latency",
          ],
          answer: 2,
          explain: "Origin load follows the **miss** ratio: the share the cache does not answer. Misses go from 5 in 100 to 1 in 100, so origin traffic is cut **5x**, not by 4 percent. This is mental model 2, the funnel.",
        },
        {
          kind: "read",
          title: "1. Bytes are cheap to move once",
          body: "Video delivery is a **copy problem**. The same 4 GB episode ladder is copied to thousands of caches and then to millions of screens. Every design choice either reduces copies (higher hit ratio, better [[shield]] placement, [[embedded caches|embedded cache]] near users) or moves copies to cheaper paths ([[peering]] instead of [[transit]], cloud-CDN pairs with low egress cost).\n\nNetflix took this to the limit with [[Open Connect]]: its appliances sit inside ISP networks, \"at no charge\" to qualifying ISPs, and fill overnight.",
        },
        {
          kind: "read",
          title: "2. The funnel: misses set origin load",
          body: "The most important number is not the hit ratio. It is the **miss ratio** (100 percent minus the hit ratio), because the load sent upstream is proportional to it.\n\nUpstream traffic = incoming traffic x (1 - hit ratio).\n\n**Worked example** (assumed numbers): 2M streams x 4 Mbps = 8 Tbps hits the edges. With a 0.95 edge byte hit ratio: 8 Tbps x 0.05 = **0.4 Tbps** of misses go up to the shield.",
          visual: { kind: "flow", spec: spec(FUNNEL, ["pl", "edge", "em", "pl>edge", "edge>em"], ["pl>edge", "edge>em"]), caption: "Edge: 8 Tbps in, 0.4 Tbps of misses out." },
        },
        {
          kind: "number",
          teach: "The shield passes on only its misses: upstream traffic = incoming traffic x (1 - hit ratio). Convert Tbps to Gbps first (1 Tbps = 1,000 Gbps).",
          prompt: "The shield gets 0.4 Tbps of edge misses and has a 0.90 hit ratio. About how much traffic reaches the multi-cloud origin?",
          visual: { kind: "flow", spec: spec({ ...FUNNEL, nodes: FUNNEL.nodes.map((n) => (n.id === "sm" ? { ...n, sub: "? Gbps" } : n)) }, ["em", "sh", "sm", "or", "em>sh", "sh>sm", "sm>or"], ["em>sh", "sh>sm", "sm>or"]) },
          answer: 40,
          tolerance: 3,
          unit: "Gbps",
          hint: "0.4 Tbps = 400 Gbps. The shield passes on only its misses.",
          explain: "400 Gbps x (1 - 0.90) = **about 40 Gbps**. The numbers are assumed; the lesson is the shape. A shield turns many edge misses into one origin fetch, so origin sees a small, stable load even when the edge sees a storm (Chapter 6).",
        },
        {
          kind: "read",
          title: "3. The herd is a different system",
          body: "Normal traffic is many independent viewers asking for many different objects. A [[simulcast]] premiere is millions of viewers asking for **the same few objects at the same second**. This is called a **herd**.\n\nCaches are cold, every edge misses at once, and the control plane (login, entitlement, DRM license) is hit at the same moment. [[Request collapsing]], shields, [[pre-warming]] and staged publish are the tools (Chapter 13).",
        },
        {
          kind: "quiz",
          teach: "Concurrency only counts how many people watch. It does not say whether they ask for the same objects at the same second, or whether the caches are warm.",
          prompt: "A design handles 2M concurrent viewers spread across the whole catalog. Will it survive 2M viewers who all press play within five minutes of a premiere?",
          options: [
            "Yes, it is the same 2M viewers",
            "Not necessarily: synchronized demand hits cold caches and the control plane all at once",
            "Yes, if the CDN has enough bandwidth",
            "No, because premieres use more bitrate per viewer",
          ],
          answer: 1,
          explain: "Same concurrency, different system. The herd asks for the same cold objects at the same second, so every edge misses at once, and login, entitlement and DRM license requests spike together. A design may pass the first case and fail the second.",
        },
        {
          kind: "read",
          title: "4. Every cache is a bet",
          body: "A cache bets that an object will be requested again before it is evicted. The **[[cache key]]** decides what counts as \"the same object.\"\n\nPut a session token into the cache key and you bet on objects nobody will ever request twice. One careless query string can drop a hit ratio from 95 percent to near zero. The cache key is the most expensive line of config you will ever write (Chapters 4 and 5).",
        },
        {
          kind: "quiz",
          teach: "The cache key decides which requests count as the same object. Think about what happens when every viewer's key is different.",
          prompt: "A new player release adds `?session=abc123` to every segment URL, and the CDN includes the full query string in the cache key. What happens?",
          options: [
            "Nothing; caches ignore query strings by default everywhere",
            "The hit ratio can fall from about 95 percent to near zero, and origin load explodes",
            "Only the request hit ratio falls; the byte hit ratio stays the same",
            "Latency rises slightly but the bill stays the same",
          ],
          answer: 1,
          explain: "Every viewer now asks for a \"different\" object, so the cache bets on objects nobody requests twice. Strip tokens and session values from the cache key (validate them at the edge instead).",
        },
        {
          kind: "read",
          title: "5. The player is part of the system",
          body: "The player retries, switches bitrate, switches CDN, holds a buffer and reports telemetry.\n\nA player with 30 seconds of buffer can survive a 10-second CDN failover without a stall. A player that retries a failed segment five times with no backoff turns a small outage into a [[retry storm]]. Know the player's retry and failover logic as well as you know your CDN config (Chapter 10).",
        },
        {
          kind: "read",
          title: "6. Measure at the eyeball",
          body: "CDN dashboards say \"99.99 percent of requests returned 2xx.\" The viewer says \"it spun for eight seconds and I closed the app.\"\n\nServer-side metrics miss failures that never reach the server: DNS, TLS, connection resets, ISP packet loss. The truth lives in **[[RUM]]** (real user monitoring) and **[[QoE]]** metrics from the player: video start time, video start failures, rebuffering ratio. Use server-side signals to explain; use client-side signals to judge (Chapter 11).",
        },
        {
          kind: "read",
          title: "7. Config is code",
          body: "Fastly's June 2021 outage was triggered by a valid customer configuration change that hit a latent bug from a May software deployment. 85 percent of its network returned errors; 95 percent was back to normal within 49 minutes.\n\nThe lesson is not \"Fastly is bad.\" Config pushes have global blast radius, and your own pushes are the same. Treat edge config with the same CI, tests, canaries and rollback as service code (Chapter 14).",
          visual: {
            kind: "stats",
            items: [
              { value: "85%", label: "of Fastly's network returned errors", note: "June 8, 2021" },
              { value: "49 min", label: "until 95% was back to normal" },
            ],
          },
        },
        {
          kind: "read",
          title: "8. Static stability",
          body: "The Amazon Builders' Library: \"In a statically stable design, the overall system keeps working even when a dependency becomes impaired.\" In short: **[[static stability]]** means keep working on what you already have.\n\nFor delivery: if steering dies, players keep the last good CDN list. If a CDN's config API is down, the CDN keeps serving the last good config. A control plane's failure should freeze the data plane in a safe state, not break it.",
        },
        {
          kind: "quiz",
          teach: "Static stability means the failure of a decision-maker must not break the bytes path. Think about what \"keep working on what you already have\" means for traffic.",
          prompt: "The health checker that feeds steering crashes at 9 p.m. What should a statically stable design do?",
          options: [
            "Mark every CDN unhealthy and stop new sessions",
            "Move all traffic to the cheapest CDN",
            "Keep traffic where it is, using the last good weights",
            "Fail over to DNS round robin across all CDNs",
          ],
          answer: 2,
          explain: "Static stability: the failure of a decision-maker freezes the data plane in its last known-good state. If the health checker dies, traffic stays where it is instead of failing everywhere.",
        },
        {
          kind: "read",
          title: "9. Blast radius and cells",
          body: "Ask: \"How many viewers does one bad change hurt?\" Shrink the answer with **[[cells|cell]]**: slices of traffic you can change on their own. Examples are per-region config rollouts, per-CDN rollouts, per-device-family player flags and per-title publish.\n\nA change that reaches 1 percent of traffic first and waits ten minutes catches most mistakes before they become headlines.",
        },
        {
          kind: "read",
          title: "10. Cost is a design input",
          body: "Cost is not a report you read at the end of the month. Every steering rule, shield location and cache-key choice moves money. A staff engineer can say roughly what a design adds to or removes from the monthly bill (Chapter 16).\n\nExtra cost per month = monthly GB x price change per GB.\n\n**Worked example:** at 100 PB a month (100 million GB), a price change of $0.002 per GB is 100,000,000 x 0.002 = **$200,000 a month**.",
        },
        {
          kind: "number",
          teach: "Extra cost per month = monthly GB x price change per GB. 1 PB = 1,000,000 GB.",
          prompt: "At the assumed 540 PB per month, how much does one-tenth of a cent per GB ($0.001/GB) change the monthly bill?",
          answer: 540000,
          tolerance: 20000,
          unit: "$ / month",
          hint: "540 PB is 540 million GB.",
          explain: "540,000,000 GB x $0.001 = **about $540,000 per month**. That is why a small price change or a few points of hit ratio is a real budget line.",
        },
        {
          kind: "read",
          title: "11. Head and tail are two products",
          body: "A few new simulcast episodes take a large share of traffic: the **head**. Tens of thousands of older episodes are watched rarely: the **[[long tail]]**. The head needs spike handling and a near-100-percent hit ratio. The tail needs a good shield hit ratio, cheap storage and sane origin cost.\n\nDesigns that optimize one often hurt the other. Example: **just-in-time (JIT) packaging** builds each format when it is requested instead of storing every format. It saves storage, but each packaging run costs origin compute.",
        },
        {
          kind: "quiz",
          teach: "JIT packaging builds a format on request, and each build costs origin compute. Ask which part of the catalog sends the most requests, and what would stop those builds from repeating.",
          prompt: "You switch to [[just-in-time packaging|Just-in-time packaging (JIT)]] to save storage. Which part of the catalog can it hurt, and how?",
          options: [
            "The tail: rarely watched episodes become unplayable",
            "The head: it adds origin compute for hot titles unless the packaged output is cached well",
            "Neither: JIT only changes storage",
            "The head: it makes segments larger",
          ],
          answer: 1,
          explain: "JIT saves tail storage (no need to store every format), but each packaged response costs origin compute. For the head, that compute is fine only if the output is cached well at shield and edge.",
        },
        {
          kind: "read",
          title: "12. Degrade before you fail",
          body: "A viewer prefers a 720p picture to a spinning wheel. **Degrade** means bend instead of break: lower bitrate caps, longer cache TTLs, serve stale content, shed non-critical features (thumbnails, previews), pause analytics beacons.\n\nEvery incident runbook should have a **degrade** step before a **fail over** step.",
          callout: { type: "industry", text: "The SRE Workbook recommends multiwindow, multi-burn-rate alerts. For a 99.9 percent SLO it suggests paging at burn rate 14.4 over a 1-hour window (with a 5-minute short window), which spends 2 percent of the monthly error budget, and also at burn rate 6 over 6 hours. Delivery teams use the same idea for \"session availability\" or \"video start failure\" SLOs." },
        },
        {
          kind: "match",
          teach: "Recall the core idea of each model: copies and cheaper paths, judging from the player's side, keeping the last good state, changing small slices first, and bending before breaking.",
          prompt: "Match each situation to the mental model that fits it best.",
          pairs: [
            ["Server dashboards say 2xx, viewers say it spins", "Measure at the eyeball"],
            ["Steering dies; players keep the last CDN list", "Static stability"],
            ["Cap bitrate at 720p during an incident", "Degrade before you fail"],
            ["New change reaches 1% of traffic, then waits ten minutes", "Blast radius and cells"],
            ["Peering instead of transit for the same bytes", "Bytes are cheap to move once"],
          ],
          explain: "Each model is a compressed version of one or more chapters. Naming the model in a review makes the argument short and clear.",
        },
        {
          kind: "summary",
          points: [
            "Delivery is a copy problem; the miss ratio, not the hit ratio, sets origin load (95 to 99 percent = 5x less origin traffic).",
            "A premiere herd is a different system; the cache key is the most expensive line of config.",
            "The player is part of the system; judge with RUM and QoE, explain with server metrics.",
            "Config is code; static stability freezes the data plane safely; cells shrink blast radius.",
            "Cost is a design input ($540k/month per tenth of a cent); head and tail are two products.",
            "Degrade before you fail.",
          ],
        },
      ],
    },

    /* ======================= Lesson 3 ======================= */
    {
      id: "ch19-l3",
      title: "Numbers to carry and the design doc",
      goal: "Compute the key back-of-envelope delivery numbers from memory and structure a delivery design doc that reviewers can test.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "Size it in your head",
          body: "Interviews and design reviews move fast. Nobody waits while you open a spreadsheet. A handful of simple formulas lets you size any delivery system in your head: bandwidth, requests, bytes, storage and error budget.\n\nThis lesson teaches each formula with a worked example, then gives you a design-doc template that turns those numbers into a plan reviewers can test.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. A design doc says: \"We have 100M fans, so we need 100M x 4 Mbps = 400 Tbps.\" What would you expect is wrong?",
          options: [
            "Nothing; plan for every registered user at once",
            "It sizes from registered users; not all of them watch at the same moment",
            "The bitrate should be 8 Mbps",
            "It should use the 95th percentile of registered users",
          ],
          answer: 1,
          explain: "Registered users are not **concurrent streams** (people watching at the same moment). Most fans are asleep, at work or watching nothing. The assumed model is about 2M concurrent at a big premiere: 8 Tbps, not 400. Always start from peak concurrency, and ask where that number comes from.",
        },
        {
          kind: "read",
          title: "Peak egress: start from concurrency",
          body: "Every delivery answer starts with **peak egress**: the total bits per second leaving the CDN at the busiest moment.\n\nPeak egress = concurrent streams x average bitrate.\n\n**Worked example:** 500,000 streams x 6 Mbps = 3,000,000 Mbps. Since 1 Tbps = 1,000,000 Mbps, that is **3 Tbps**. Then plan headroom above it.",
        },
        {
          kind: "number",
          teach: "Peak egress = concurrent streams x average bitrate. 1 Tbps = 1,000,000 Mbps.",
          prompt: "An interviewer says: \"2M concurrent streams at a 4 Mbps average.\" What is peak egress?",
          answer: 8,
          tolerance: 0.5,
          unit: "Tbps",
          hint: "Peak egress = concurrent streams x average bitrate.",
          explain: "2,000,000 x 4 Mbps = 8,000,000 Mbps = **8 Tbps**. The book plans for 12 Tbps of headroom. This is the first line of every delivery answer.",
        },
        {
          kind: "read",
          title: "Request rate: one segment per segment length",
          body: "Bandwidth is not the only load. Each viewer asks for one video **segment** (a few seconds of video) every segment duration.\n\nVideo segment request rate = concurrent viewers / segment length in seconds.\n\n**Worked example:** 600,000 viewers with 6-second segments: 600,000 / 6 = **100,000 requests per second**. If audio and subtitles are separate renditions, their requests come on top, so the total can roughly double.",
        },
        {
          kind: "number",
          teach: "Each viewer asks for one video segment every segment duration. Request rate = concurrent viewers / segment length in seconds.",
          prompt: "2M concurrent viewers, 5-second segments. How many **video** segment requests per second?",
          answer: 400000,
          tolerance: 10000,
          unit: "requests/s",
          hint: "Each viewer fetches one video segment per segment duration.",
          explain: "2,000,000 / 5 s = **400,000 requests/s**. Add separate audio and subtitle requests and the total is roughly 800k-900k requests/s.",
        },
        {
          kind: "read",
          title: "Bytes per viewing hour",
          body: "To turn a bitrate into bytes, multiply by the seconds, then divide by 8 (there are 8 bits in a byte).\n\nGB per viewing hour = bitrate x 3,600 s / 8.\n\n**Worked example:** at 2 Mbps, 2 x 3,600 = 7,200 megabits. Divide by 8: 900 MB, which is **0.9 GB per hour**.",
        },
        {
          kind: "number",
          teach: "Multiply the bitrate by 3,600 seconds to get megabits, divide by 8 to get megabytes, then divide by 1,000 to get GB.",
          prompt: "How many GB does one viewer download in one hour at 4 Mbps?",
          answer: 1.8,
          tolerance: 0.1,
          unit: "GB/hour",
          hint: "bitrate x 3,600 s / 8 bits per byte.",
          explain: "4 Mbps x 3,600 s = 14,400 Mb. Divide by 8: 1,800 MB = **1.8 GB per hour**.",
        },
        {
          kind: "read",
          title: "Formulas worth memorizing (1)",
          body: "Monthly bytes = viewing hours x GB per hour. At the assumed 300M hours a month: 300,000,000 x 1.8 GB = 540,000,000 GB = **540 PB** (1 PB = 1,000,000 GB). That is a deliberately generous upper bound.\n\nHere are the first formulas together. All Crunchyroll values are **assumed** from the book's model. The last row is the funnel from Lesson 2.",
          visual: {
            kind: "table",
            headers: ["Quantity", "Formula", "Assumed value"],
            rows: [
              ["Peak egress", "concurrent streams x average bitrate", "2M x 4 Mbps = 8 Tbps (plan 12 Tbps)"],
              ["Video segment request rate", "concurrent streams / segment duration", "2M / 5 s = 400k requests/s"],
              ["Total media request rate", "add separate audio and subtitle requests", "roughly 800k-900k requests/s if audio is a separate rendition"],
              ["Bytes per viewing hour", "bitrate x 3,600 s / 8", "4 Mbps -> 1.8 GB/hour"],
              ["Monthly delivered bytes", "hours x GB/hour", "300M h x 1.8 GB = 540 PB"],
              ["Origin or shield load", "edge egress x (1 - edge byte hit ratio)", "8 Tbps x 0.05 = 400 Gbps"],
            ],
          },
        },
        {
          kind: "read",
          title: "Storage per episode",
          body: "A **ladder** is the set of renditions of one video, one per quality level.\n\nStorage for one episode = sum of all ladder bitrates x duration / 8.\n\n**Worked example:** a 10-minute clip (600 s) whose ladder adds up to 10 Mbps: 10 x 600 = 6,000 megabits. Divide by 8: **750 MB**.\n\nAudio is small: one 128 kbps dub for 1,440 s is about 23 MB. A subtitle track is only tens of KB.",
        },
        {
          kind: "number",
          teach: "Storage = total ladder bitrate x duration in seconds, then divide by 8 to get bytes. About 1,000 MB make 1 GB.",
          prompt: "A 24-minute episode (1,440 s) has a video ladder whose bitrates add up to about 23 Mbps. About how many GB does the ladder take?",
          answer: 4.2,
          tolerance: 0.2,
          unit: "GB",
          hint: "23 Mbps x 1,440 s, then divide by 8 for bytes.",
          explain: "23 Mbps x 1,440 s = 33,120 Mb. Divide by 8: about 4,140 MB = **about 4.2 GB**. One 128 kbps audio dub adds only about 23 MB.",
        },
        {
          kind: "read",
          title: "Error budget",
          body: "An **SLO** (service level objective) is the share of time a service must work. The **error budget** is the rest: the time you are allowed to fail.\n\nError budget = (1 - SLO) x minutes in the period.\n\n**Worked example:** a 99 percent SLO over 30 days. 30 x 24 x 60 = 43,200 minutes. 1 percent of that is **432 minutes**, about 7 hours.",
        },
        {
          kind: "number",
          teach: "Error budget = (1 - SLO) x minutes in the period. A 30-day month has 30 x 24 x 60 minutes.",
          prompt: "Your SLO is 99.9 percent over 30 days. How many minutes of full outage does the error budget allow?",
          answer: 43,
          tolerance: 1.5,
          unit: "minutes",
          hint: "30 days x 24 h x 60 min x 0.001.",
          explain: "30 x 24 x 60 = 43,200 minutes. 0.1 percent of that is **about 43 minutes**. One bad global config push can spend it all.",
        },
        {
          kind: "read",
          title: "Formulas worth memorizing (2)",
          body: "Storage, cost and reliability have their own quick formulas. Note the subtitle row: tiny in bytes, but many objects.",
          visual: {
            kind: "table",
            headers: ["Quantity", "Formula", "Assumed value"],
            rows: [
              ["Storage per episode (video ladder)", "sum of ladder bitrates x duration", "about 23 Mbps total x 1,440 s = about 4.2 GB for a 24-minute episode"],
              ["Storage per audio dub", "audio bitrate x duration", "128 kbps x 1,440 s = about 23 MB"],
              ["Subtitle track size", "text", "tens of KB, negligible bytes, but many objects"],
              ["Cost sensitivity", "monthly GB x price change", "540M GB x $0.001 = $540k/month per tenth of a cent"],
              ["Error budget at 99.9 percent", "0.1 percent of a month", "about 43 minutes of full outage per 30 days"],
            ],
          },
        },
        {
          kind: "read",
          title: "Three lessons hiding in the tables",
          body: "- **Request rate matters as much as bandwidth.** 800k requests per second is a lot of TLS, logging and token validation.\n- **Audio and subtitle objects are tiny in bytes but large in count**, so they stress request handling and purge systems more than bandwidth.\n- **The money is in the egress line**, not in storage.",
          callout: { type: "mistake", text: "Computing egress from registered users. 100M registered users is not 100M concurrent streams. Always start from peak concurrency, and ask where that number comes from." },
        },
        {
          kind: "read",
          title: "A design-doc template",
          body: "A **design doc** is the written plan a team reviews before building. Use one skeleton for any delivery design, from \"add a new CDN\" to \"move origin to two clouds.\" Each section has a **purpose** and a **test** a reviewer applies.",
          visual: {
            kind: "table",
            headers: ["Section", "What goes in it", "The reviewer's test"],
            rows: [
              ["1. Context and problem", "What is broken or missing, with data (QoE graph, bill, incident)", "Can a new engineer explain the problem in one sentence?"],
              ["2. Goals and non-goals", "Measurable goals (e.g. \"video start failure under 0.5 percent in Brazil\"); explicit non-goals", "Are non-goals stated, so scope cannot creep?"],
              ["3. Numbers", "Concurrency, bitrate, request rate, hit ratio, origin load, storage, cost; label assumptions", "Do the numbers add up within a factor of two?"],
              ["4. Current architecture", "Diagram of today's bytes path and control path", "Does it show every hop a segment takes?"],
            ],
          },
        },
        {
          kind: "read",
          title: "Template: the design and its risks",
          body: "The middle sections describe the proposal and attack it.",
          visual: {
            kind: "table",
            headers: ["Section", "What goes in it", "The reviewer's test"],
            rows: [
              ["5. Proposed design", "Diagram plus walk-through of one playback request and one premiere", "Is each component's owner named?"],
              ["6. Alternatives considered", "At least two real alternatives, with why not", "Was \"do nothing\" considered honestly?"],
              ["7. Failure modes", "Table: component, failure, detection, automatic action, viewer impact", "Is there a row for DNS, TLS, config push and the control plane?"],
              ["8. Security and content protection", "Token scheme, DRM interaction, origin protection, geo rules", "Has Content Protection or Security signed off?"],
            ],
          },
        },
        {
          kind: "read",
          title: "Template: running it",
          body: "The last sections make the design operable and honest about what is unknown.",
          visual: {
            kind: "table",
            headers: ["Section", "What goes in it", "The reviewer's test"],
            rows: [
              ["9. Observability", "New SLIs, SLOs, dashboards, alerts, log fields", "Can on-call tell within five minutes if this broke?"],
              ["10. Cost", "Monthly cost before and after; contract impact", "Is the cost per delivered TB stated?"],
              ["11. Rollout and rollback", "Phases, cells, canary metrics, kill switch, rollback time", "Can it be undone in five minutes without a deploy?"],
              ["12. Operations", "Runbook changes, on-call load, vendor contacts", "Does on-call know what to do at 3 a.m.?"],
              ["13. Open questions", "What is unknown and who will answer it", "Are unknowns owned, with dates?"],
            ],
          },
        },
        {
          kind: "order",
          teach: "A reader needs the problem before the goals, needs numbers before boxes, and needs to see today's system before a new one can be compared with it.",
          prompt: "Put the first six sections of the design-doc template in order.",
          items: [
            "Context and problem",
            "Goals and non-goals",
            "Numbers",
            "Current architecture",
            "Proposed design",
            "Alternatives considered",
          ],
          explain: "Problem, then what success means, then the numbers, then today's system, then the proposal, then the honest alternatives. Failure modes, security, observability, cost, rollout, operations and open questions follow.",
        },
        {
          kind: "match",
          teach: "Each section has one test a reviewer applies. Ask which job the test checks: undoing a change, breaking, seeing a problem, paying, or not knowing yet.",
          prompt: "Match each reviewer test to its section.",
          pairs: [
            ["Can it be undone in five minutes without a deploy?", "Rollout and rollback"],
            ["Is there a row for DNS, TLS, config push and the control plane?", "Failure modes"],
            ["Can on-call tell within five minutes if this broke?", "Observability"],
            ["Is the cost per delivered TB stated?", "Cost"],
            ["Are unknowns owned, with dates?", "Open questions"],
          ],
          explain: "Each section exists to pass one test. If you cannot write the answer to the test, the section is not done.",
        },
        {
          kind: "read",
          title: "Short, and failure modes early",
          body: "Keep the doc short enough to read in 20 minutes. Put raw data in an appendix.\n\nWrite the \"failure modes\" table **before** the \"proposed design\" section is finished: it usually changes the design. Asking \"what happens when this box is slow, wrong or gone?\" often reveals a missing mechanism, such as a fallback list, request collapsing or a kill switch.",
          callout: { type: "staff", text: "The best section of most delivery docs is \"Alternatives considered.\" It shows you did not fall in love with the first idea, and it records why a tempting option (for example, \"just use one CDN\") was rejected, so the team does not re-argue it every six months." },
        },
        {
          kind: "summary",
          points: [
            "Egress = concurrency x bitrate (8 Tbps); segment rate = concurrency / segment length (400k/s).",
            "4 Mbps = 1.8 GB/hour; 300M hours = 540 PB/month; 99.9 percent = about 43 minutes a month.",
            "Request count matters as much as bytes; small audio and subtitle objects stress request handling and purge.",
            "Start from peak concurrency, never registered users.",
            "The 13-section template gives every section a reviewer test; write failure modes early, keep alternatives honest.",
          ],
        },
      ],
    },

    /* ======================= Lesson 4 ======================= */
    {
      id: "ch19-l4",
      title: "Design reviews and trade-offs",
      goal: "Pick the right questions from the design-review bank and state any delivery decision as a trade-off with conditions for each side.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "Reviewing a design",
          body: "A **design review** is the meeting where a team tests a design doc before it is built. A good reviewer finds the weakest part fast and turns arguments into data.\n\nThis lesson gives you two tools: a bank of 43 review questions in seven groups, and a **trade-off catalog** that says when each option wins. By the end you can pick the right questions and state any decision as a trade-off.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. You are reviewing a delivery design doc, and the question bank has 43 questions. How many would you expect to ask?",
          options: [
            "All 43, in order",
            "About five that hit the weakest part of the doc",
            "Only the cost questions",
            "None; reviews should only approve or reject",
          ],
          answer: 1,
          explain: "You will not ask all of them; nobody has time, and most will not matter for this doc. Pick the **five** that hit the weakest part. The bank is a checklist to find that weak part fast.",
        },
        {
          kind: "read",
          title: "A question bank in seven groups",
          body: "Bring this bank to any delivery design review. It has seven groups:\n\n- Caching and correctness\n- Scale and spikes\n- Failure and resilience\n- Security and protection\n- Observability\n- Cost\n- Operations and rollout\n\nTry each group yourself before you reveal the questions. You are not expected to know them all yet; the reveal teaches them.",
        },
        {
          kind: "reveal",
          prompt: "**Caching and correctness.** The doc says \"segments are cached at the edge.\" What would you ask? Think of at least three questions.",
          answer: "1. What is the exact cache key for segments, manifests, subtitles and keys? Which query parameters and headers are in it?\n2. Does any token, session ID or user-specific value leak into the cache key?\n3. What `Cache-Control` and `Surrogate-Control` headers does origin send for each object type? Who sets them, and are they the same on every CDN?\n4. What is the TTL for live manifests versus VOD manifests versus segments? Why?\n5. What happens on a 404 for a segment that is still being published? Is the 404 cached, and for how long ([[negative caching]])?\n6. How do we purge a bad object across all CDNs? How long until it is gone everywhere? Do we use [[surrogate keys|surrogate key]]?\n7. Is the `Vary` header used? Does it fragment the cache?\n8. Are byte-range requests used, and does every CDN cache them the same way?",
        },
        {
          kind: "reveal",
          prompt: "**Scale and spikes.** A premiere is coming. What would you ask about scale?",
          answer: "9. What is the peak request rate per object at premiere time? What does the first minute look like?\n10. Is [[request collapsing]] enabled at edge and shield on every CDN? What is the collapse timeout?\n11. Is there a shield? Is it one location or several? What happens when the shield is far from some edges?\n12. Have we told every CDN vendor about the premiere and reserved capacity?\n13. What is the control-plane load (playback API, entitlement, DRM license) at the same moment?\n14. Has this been load tested at 1.5x the expected peak?",
        },
        {
          kind: "reveal",
          prompt: "**Failure and resilience.** The doc says \"we can fail over.\" What would you ask? This group is the longest.",
          answer: "15. What happens when one CDN fails completely? When one PoP fails? When one CDN is slow but not down?\n16. What detects the failure: RUM, synthetic probes, CDN status, or all three? How fast?\n17. Is failover automatic? What is the [[hysteresis]], so we do not flap?\n18. If we move all traffic off one CDN, does the other CDN have the capacity and the warm cache?\n19. What happens when the steering service itself is down? ([[Static stability]].)\n20. What happens when an origin region or a whole cloud is down? Is [[replication lag]] within the SLO?\n21. What happens when a TLS certificate expires? Who is paged 30 days before?\n22. What happens when DNS for our delivery hostnames fails?\n23. Can a [[retry storm]] happen? What is the [[retry budget]] in the player and in the shield?",
        },
        {
          kind: "reveal",
          prompt: "**Security and protection.** What would you ask about who can fetch what?",
          answer: "24. Who can fetch from origin? Only the CDN? How is that enforced (signed requests, [[mTLS]], private connectivity, IP allowlists)?\n25. How are segment URLs signed? What is the token lifetime? Can a URL be shared and replayed?\n26. How are geo-restrictions enforced, and where (playback API, CDN, both)?\n27. Does the design change anything about DRM key delivery or license flow?\n28. What happens under an L7 DDoS on manifest URLs?",
        },
        {
          kind: "reveal",
          prompt: "**Observability.** How would you check that on-call can see this break?",
          answer: "29. What is the SLI, measured where? By bytes, by request, by session?\n30. Can we break down errors by CDN, region, ASN, device and title within one minute?\n31. Is there a session ID (for example [[CMCD]] `sid`) that joins player, CDN and origin logs?\n32. What alert pages a human, and what only creates a ticket? Are alerts on symptoms or causes?\n33. What is the [[cardinality]] of the new metrics? Will the Datadog bill explode?",
        },
        {
          kind: "reveal",
          prompt: "**Cost.** What would you ask about money?",
          answer: "34. What does this change do to monthly egress cost, request cost and storage cost?\n35. Does it change how traffic counts toward each CDN's [[commit]]? Could it push us over or under a commit?\n36. Does it change cloud egress from origin to CDN?\n37. Is the [[95th percentile billing|95th percentile billing]] peak affected (for example by a pre-warm burst)?",
        },
        {
          kind: "reveal",
          prompt: "**Operations and rollout.** What would you ask about shipping it safely?",
          answer: "38. How is it rolled out: by region, by CDN, by percentage, by device?\n39. What metric gates each step, and who watches it?\n40. How do we roll back, and how long does it take?\n41. Is the config in source control, reviewed, tested and applied by pipeline only?\n42. What changes in the runbook? Has on-call been trained?\n43. Which partner teams (Playback, Content Pipeline, Content Protection, Security) must change something, and have they agreed?",
        },
        {
          kind: "quiz",
          teach: "Static stability (Lesson 2) asks what happens to the bytes path when a decision-making service fails. Look for the question about a dependency being down.",
          prompt: "A doc adds a new steering service and says \"players get their CDN from steering at session start.\" Which question tests [[static stability]] most directly?",
          options: [
            "Is the `Vary` header used?",
            "What happens when the steering service itself is down?",
            "Has this been load tested at 1.5x the expected peak?",
            "What is the token lifetime?",
          ],
          answer: 1,
          explain: "Question 19. A statically stable design keeps serving with the last good CDN list when steering dies. If the answer is \"sessions fail\", the steering service has become a single point of failure.",
        },
        {
          kind: "read",
          title: "Which questions matter most here",
          body: "Crunchyroll's job posting describes multi-CDN delivery routed \"by performance, availability and cost,\" fault-tolerant AWS and GCP architectures with no single point of failure, and end-to-end observability with Datadog.\n\nSo questions **15-20** (failure), **29-33** (observability) and **34-37** (cost) are likely the ones you will ask most.",
          callout: { type: "crunchyroll", text: "Treat this as a guide, not as a description of Crunchyroll's internal review process, which is not published." },
        },
        {
          kind: "read",
          title: "Every decision is a trade-off",
          body: "Staff engineers name both sides, say which conditions favor each, and pick one with a reason. Read each row as: \"Choose A when ..., choose B when ...\".",
          visual: {
            kind: "table",
            headers: ["Decision", "Option A", "Option B", "Choose A when", "Choose B when"],
            rows: [
              ["Packaging", "Static packaging (store HLS and DASH outputs)", "Just-in-time packaging", "Head-heavy traffic, simple CDN caching, cheap storage", "Huge long tail, many formats and DRM variants, storage cost dominates"],
              ["Container", "Separate TS for HLS and fMP4 for DASH", "One CMAF set for both", "Legacy devices need TS", "Device base supports fMP4 and cbcs; halve storage and double cache efficiency"],
              ["Shield", "One global shield", "Regional shields", "Small footprint, simple ops, mostly one region", "Global audience; far edges suffer long miss latency"],
              ["Steering point", "DNS-based", "Manifest or playback-API time", "Simple, works for all clients", "Need per-session decisions with QoE data"],
              ["Steering point", "Server-side only", "Client-side switching or Content Steering", "Thin clients you cannot change often", "Need fast mid-session failover without new sessions"],
            ],
          },
        },
        {
          kind: "quiz",
          teach: "Check the \"Container\" row of the catalog: what makes separate TS worth keeping, and what does one shared set save?",
          prompt: "Your device base now supports fMP4 and [[cbcs]]. You store separate TS (for HLS) and fMP4 (for DASH). What does the catalog say?",
          options: [
            "Keep both; storage is cheap",
            "Move to one [[CMAF]] set for both: about half the storage and double the cache efficiency",
            "Move everything to TS",
            "Switch to just-in-time packaging only",
          ],
          answer: 1,
          explain: "Choose separate TS only when legacy devices need it. With fMP4 and cbcs support, one CMAF set serves HLS and DASH, so you store and cache one copy instead of two.",
        },
        {
          kind: "read",
          title: "Trade-offs: vendors, tokens, purge",
          body: "The next rows are about who you buy from and how you control access and invalidation.",
          visual: {
            kind: "table",
            headers: ["Decision", "Option A", "Option B", "Choose A when", "Choose B when"],
            rows: [
              ["CDN count", "One CDN", "Multi-CDN", "Small scale, team is small", "Resilience, cost leverage, regional strength needed"],
              ["Own CDN", "Buy from vendors", "Build an Open Connect-like network", "Traffic too small to justify hardware and peering staff", "Huge, stable traffic in many ISPs (Netflix scale)"],
              ["Token location", "Token in URL query", "Token in header or cookie", "Clients cannot set headers (some TVs)", "Want clean cache keys and less URL sharing"],
              ["Token lifetime", "Short (minutes)", "Long (hours)", "High piracy risk, live content", "Long VOD sessions, flaky clients, fewer re-signs"],
              ["Purge", "Surrogate-key purge", "URL purge or TTL expiry", "Need fast, grouped invalidation", "Few objects, CDN lacks tag purge"],
            ],
          },
        },
        {
          kind: "read",
          title: "Trade-offs: TTLs, failover, signals, replication",
          body: "These rows decide how fast content changes reach viewers and how the system reacts to trouble.",
          visual: {
            kind: "table",
            headers: ["Decision", "Option A", "Option B", "Choose A when", "Choose B when"],
            rows: [
              ["TTL", "Long TTL plus purge", "Short TTL", "Content rarely changes (VOD segments)", "Content changes often and purge is slow (live manifests)"],
              ["Failover", "Automatic", "Human-in-the-loop", "Clear signal, tested many times, hysteresis in place", "Ambiguous signal, rare event, large blast radius"],
              ["Health signal", "RUM-based", "Synthetic probes", "Lots of traffic, need truth from viewers", "Low traffic regions, need signal before users arrive"],
              ["Replication", "Synchronous dual-write", "Async replication with lag SLO", "Small objects, strict consistency", "Large media, cost-sensitive, publish can wait"],
            ],
          },
        },
        {
          kind: "match",
          teach: "Every answer is in a \"choose when\" column. First find the row for the decision (token location, TTL, failover, purge, token lifetime), then read which side the condition belongs to.",
          prompt: "Match each condition to the option the catalog picks.",
          pairs: [
            ["Some TVs cannot set request headers", "Token in URL query"],
            ["Live manifests change often and purge is slow", "Short TTL"],
            ["Ambiguous signal, rare event, large blast radius", "Human-in-the-loop failover"],
            ["Need fast, grouped invalidation", "Surrogate-key purge"],
            ["High piracy risk, live content", "Short token lifetime"],
          ],
          explain: "The answer always comes from the \"choose when\" column. Change the condition and the right option changes too.",
        },
        {
          kind: "read",
          title: "Trade-offs: money, codecs, latency",
          body: "The last rows cover billing, codecs, edge compute and live latency.",
          visual: {
            kind: "table",
            headers: ["Decision", "Option A", "Option B", "Choose A when", "Choose B when"],
            rows: [
              ["Billing", "95th-percentile", "Total GB", "Traffic is flat", "Traffic is spiky (premieres raise the 95th percentile)"],
              ["Codec", "H.264 only", "Add HEVC and AV1", "Device coverage and simple ops matter most", "Egress savings outweigh encode cost and device testing"],
              ["Edge compute", "Logic at edge", "Logic in origin or API", "Low-latency per-request decisions, simple code", "Complex logic, needs state, needs strong testing"],
              ["Live latency", "Standard HLS/DASH", "LL-HLS or LL-DASH", "Cache efficiency and stability matter more", "Real-time interaction or spoiler risk matter more"],
            ],
          },
        },
        {
          kind: "quiz",
          teach: "Check the \"Live latency\" row: one option wins on cache efficiency and stability, the other on real-time interaction and spoiler risk.",
          prompt: "A live finale has a chat, and spoilers spread on social media within seconds. Which live-latency option does the catalog pick?",
          options: [
            "Standard HLS/DASH, for cache efficiency and stability",
            "[[LL-HLS]] or [[LL-DASH]], because real-time interaction and spoiler risk matter more",
            "Download the full episode before playback",
            "Total-GB billing",
          ],
          answer: 1,
          explain: "Choose standard HLS/DASH when cache efficiency and stability matter more. Choose low-latency modes when real-time interaction or spoiler risk matter more, and accept smaller buffers and more manifest requests.",
        },
        {
          kind: "read",
          title: "Turn arguments into rows",
          body: "When two senior engineers disagree, write the disagreement as one row of this table.\n\nMost arguments are really about which condition in the \"choose when\" columns is true.",
          callout: { type: "staff", text: "Once the disagreement is a row, the debate becomes \"go get the data,\" which is a better debate." },
        },
        {
          kind: "reveal",
          prompt: "Practice. One engineer wants one global shield; another wants regional shields. Write it as a row. What would decide it?",
          answer: "Option A, one global shield: choose it with a small footprint, simple ops, and an audience mostly in one region.\n\nOption B, regional shields: choose it with a global audience, where far edges suffer long miss latency.\n\nSo the debate is about one condition: is the audience global, and do far edges really see long miss latency? Go get the data (where viewers are, and miss latency from far edges) instead of arguing taste.",
        },
        {
          kind: "summary",
          points: [
            "Pick about five questions from the bank that hit the weakest part of the doc.",
            "Seven groups: caching, scale, failure, security, observability, cost, operations.",
            "For a multi-CDN, multi-cloud platform, failure (15-20), observability (29-33) and cost (34-37) come up most.",
            "Every decision has two options and a \"choose when\" condition for each.",
            "Write a disagreement as one table row; then go get the data.",
          ],
        },
      ],
    },

    /* ======================= Lesson 5 ======================= */
    {
      id: "ch19-l5",
      title: "Interview problems 1-5",
      goal: "Work through five delivery system-design problems in the order clarify, size, design, key decisions, failure modes and staff extras.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "The shape of a strong answer",
          body: "Senior and staff interviews for media delivery, video platform and CDN teams often ask you to design one delivery system in under an hour.\n\nThis lesson walks through five such problems with answer sketches: a premiere, steering, replication, purge and token signing. By the end you will answer in a fixed order that interviewers trust, and you will know each problem's key decisions and failure modes.",
          callout: { type: "mistake", text: "Drawing boxes before stating numbers. Interviewers for delivery roles expect you to say \"2M x 4 Mbps is 8 Tbps, so I need multi-CDN and a shield\" within the first five minutes. The numbers justify the boxes." },
        },
        {
          kind: "read",
          title: "Six parts, always in this order",
          body: "- **Clarify**: ask what exactly is being built, for whom, and under which limits.\n- **Size**: turn the answers into numbers (egress, request rate, storage).\n- **Design**: draw the boxes the numbers call for.\n- **Key decisions**: the trade-offs you chose, said out loud.\n- **Failure modes**: what breaks, and what the viewer sees.\n- **What a staff answer adds**: process, guardrails and rollout.",
        },
        {
          kind: "order",
          teach: "Numbers come before boxes, and you cannot size a problem you have not clarified. Decisions and failures need a design to talk about.",
          prompt: "Put the six parts of an interview answer in order.",
          items: ["Clarify", "Size", "Design", "Key decisions", "Failure modes", "What a staff answer adds"],
          explain: "Clarify the problem, size it with numbers, then design. Name the key decisions, predict the failures, and finish with what a staff engineer adds: process, guardrails and rollout.",
        },
        {
          kind: "read",
          title: "Problem 1: a premiere for 2M viewers",
          body: "**Problem 1: Deliver a simulcast premiere to 2M concurrent viewers.**\n\n**Clarify.** A VOD file released at a fixed time, not live. Global. Several dubs and subtitles. Assumed 2M concurrent within 10 minutes of release.\n\n**Size.** 8 Tbps peak (plan 12). 400k video segment requests per second at 5-second segments. In the first minute, almost every viewer requests the first segments of the same few renditions.",
        },
        {
          kind: "read",
          title: "Problem 1: the control-plane rush",
          body: "The control plane gets hit too: 2M playback API calls and 2M DRM license requests in about 10 minutes.\n\nTo turn a count into a rate, divide by the seconds in the window.\n\n**Worked example:** 600,000 calls in 5 minutes. 5 minutes = 300 s, so 600,000 / 300 = **2,000 calls per second** on average. The first minute is usually much busier than the average.",
        },
        {
          kind: "number",
          teach: "Average rate = number of calls / seconds in the window. 10 minutes = 600 seconds.",
          prompt: "2M playback API calls arrive in about 10 minutes. What is the **average** rate per second?",
          answer: 3300,
          tolerance: 150,
          unit: "calls/s",
          hint: "10 minutes = 600 seconds.",
          explain: "2,000,000 / 600 s = **about 3,300 per second** on average, for both playback API calls and DRM license requests. The first-minute peak is much higher than the average.",
        },
        {
          kind: "read",
          title: "Problem 1: the design",
          body: "- Package and upload ahead of time, with a hidden publish state.\n- Replicate to both clouds and verify checksums before release time.\n- [[Pre-warm|pre-warming]] shields and major edges by fetching the first N minutes of each popular rendition.\n- Use [[request collapsing]] at edge and shield.\n- Spread viewers across CDNs by pre-agreed weights and reserved capacity.\n- Scale playback API, entitlement and license services ahead of time.\n- Release by **flipping the catalog entry**, not by uploading files.",
        },
        {
          kind: "reveal",
          prompt: "Problem 1: what could still go wrong on premiere night? Think of two or three failure modes, then reveal.",
          answer: "**Failure modes.**\n- Cold cache plus no collapsing equals origin melt.\n- A license server storm: 2M license requests arrive together.\n- One CDN under-provisioned in one region.\n- A purge during the premiere wipes the warm cache you paid to build.",
        },
        {
          kind: "read",
          title: "Problem 1: decisions and staff extras",
          body: "**Key decisions.** How much to pre-warm (cost vs cold-start risk). Whether to stagger release by a few seconds per region (fairness vs load). Whether to cap top bitrate for the first minutes.\n\n**Staff answer adds.** A premiere checklist and a \"go/no-go\" meeting 24 hours before. A freeze on CDN config changes during the window. A degrade plan (cap bitrate, raise TTLs) ready before the event.",
        },
        {
          kind: "read",
          title: "Problem 2: a multi-CDN steering service",
          body: "**Problem 2: Design a multi-CDN steering service.**\n\n**Clarify.** Who calls it (the playback API at session start)? Which CDNs? What inputs (RUM QoE, availability, cost, commits)?\n\n**Size.** Call rate equals session start rate. At 2M sessions in 10 minutes, peaks of several thousand calls per second. The decision must be fast: Crunchyroll's 2020 \"Katana\" engineering post described a multi-CDN decision step at manifest time with a tight latency target.",
        },
        {
          kind: "read",
          title: "Problem 2: split it in two (online)",
          body: "The trick is to split the service in two.\n\nAn online **decider** sits behind the playback API. For each session it reads a small weights table **from memory** and picks a primary CDN plus ordered fallbacks.\n\nIt returns signed URLs with the CDN host list, or a [[Content Steering]] server URI so the player can move mid-session. No slow call sits on the request path.",
          visual: { kind: "flow", spec: spec(STEER, ["p", "a", "s", "r", "m", "x", "p>a", "a>s", "s>r", "s>m", "m>p", "p>x"], ["p>a", "a>s", "s>r", "s>m", "m>p", "p>x"]), caption: "The online path: fast, in memory." },
        },
        {
          kind: "read",
          title: "Problem 2: split it in two (offline)",
          body: "An offline **scorer** runs every minute. It reads QoE per CDN per region per ASN from the RUM pipeline, availability from synthetic probes and CDN status, and cost position against commits. It writes the small weights table that the decider reads.",
          visual: { kind: "flow", spec: spec(STEER, ["q", "h", "k", "c", "r", "q>c", "h>c", "k>c", "c>r"], ["q>c", "c>r"]), caption: "The offline path: slow inputs, one small output." },
        },
        {
          kind: "quiz",
          teach: "Recall static stability from Lesson 2: when a decision-maker fails, the data plane keeps working on what it already has.",
          prompt: "The scorer job crashes and stops writing new weights. What should the decider do?",
          visual: { kind: "flow", spec: spec(STEER, ["c", "r", "s", "c>r", "s>r"]) },
          options: [
            "Fail every new session until the scorer is back",
            "Keep using the last good weights table",
            "Send everyone to CDN A",
            "Pick a random CDN per session",
          ],
          answer: 1,
          explain: "Static stability: the decider keeps the last good table. Two more failure modes: bad data makes everyone flip to one CDN at once (cap weight changes per minute), and one CDN gets all traffic and overloads (respect capacity limits).",
        },
        {
          kind: "read",
          title: "Problem 2: decisions and guardrails",
          body: "**Key decisions.** Granularity (country vs ASN). How much traffic to keep on each CDN to keep caches warm and keep measuring it (exploration). How to weigh cost against QoE.\n\n**Staff answer adds.** Weight-change rate limits, a manual override with audit, and a \"never below X percent\" floor on each healthy CDN so caches stay warm.",
        },
        {
          kind: "read",
          title: "Problem 3: multi-cloud origin",
          body: "**Problem 3: Multi-cloud origin and replication.**\n\n**Clarify.** Where is the source of truth? Objects are immutable (never changed) once published. We must survive loss of one cloud region or one cloud.\n\n**Size.** Tens of thousands of episodes x about 4.2 GB of video, plus audio and subtitles (assumed): a few hundred TB per packaging format. New content per day is small; the risk is correctness, not bandwidth.",
        },
        {
          kind: "read",
          title: "Problem 3: design and key decisions",
          body: "**Design.** Write once to a primary bucket. Replicate with a queue-driven replicator (or managed replication) to the second cloud. Verify checksums. Mark an object \"published\" only when it exists in both places. Shields fetch from the nearest healthy origin with origin failover.\n\n**Key decisions.** Publish gate on replication (safer, slower) vs publish on primary (faster, risk of 404 on failover). A [[replication lag]] SLO (for example, p99 under N minutes before release time).",
        },
        {
          kind: "quiz",
          teach: "Think about which copy everyday traffic reads, and when the copy in the second cloud is actually used.",
          prompt: "During a failover drill, shields switch to the second cloud and some episodes return 404. Everything looked fine before the drill. What is the most likely cause?",
          options: [
            "The CDN cached the 404s weeks ago",
            "Replication was partial: some objects never reached the second cloud, and normal traffic never read that copy",
            "DRM licenses expired during the drill",
            "The primary bucket was deleted",
          ],
          answer: 1,
          explain: "Partial replication causes 404s only on failover, so it is invisible until the worst moment. Fix: continuously audit the secondary and run failover drills. **Staff answer adds:** treat \"replicated and verified\" as a release requirement owned with Content Pipeline, and alert on lag before release time, not after.",
        },
        {
          kind: "read",
          title: "Problem 4: purge across many CDNs",
          body: "**Clarify.** Why purge? Fixed subtitles, wrong audio, takedowns, geo-rights changes. We need speed and correctness.\n\n**Design.** Tag every response with [[surrogate keys|surrogate key]] like `title-123`, `episode-456`, `subs-456-es`. A purge service takes a key, fans out to every CDN API, tracks completion per CDN, retries, and verifies with probes. For CDNs without tag purge, keep a key-to-URL map.\n\n**Key decision.** A **hard purge** deletes objects. A **[[soft purge]]** marks them stale, so caches revalidate with origin.",
        },
        {
          kind: "quiz",
          teach: "A hard purge deletes, so the next request for each object is a miss. A soft purge marks objects stale, so caches check with origin. Think about what a hot title does to origin right after each kind.",
          prompt: "You must purge subtitles for a title that is hot right now. Which purge protects origin?",
          options: [
            "Hard purge: delete everything at once",
            "[[Soft purge]]: mark stale and revalidate",
            "Wait for TTL expiry",
            "Purge only one CDN",
          ],
          answer: 1,
          explain: "Soft purge marks objects stale so caches revalidate instead of all missing at once; it protects origin from a sudden miss storm. Failure modes: purging a hot title during a premiere causes a herd at origin; a CDN API rate limit makes purge slow; a takedown purge that silently fails on one CDN is a legal risk. **Staff answer adds:** purge is a production change: rate-limit it, log it, and block hard purges of hot titles during premiere windows without approval.",
        },
        {
          kind: "read",
          title: "Problem 5: signing segment URLs",
          body: "**Clarify.** Threat: link sharing and restreaming. Constraint: the cache key must stay clean.\n\n**Design.** The playback API issues a token bound to a path prefix, an expiry time, and optionally an IP range or session. The CDN validates the token at the edge and **strips it from the cache key**. Prefix-based tokens (one token for the whole rendition directory) avoid signing every segment. Signing keys rotate with overlap.\n\n**Key decisions.** Query vs cookie vs header. Token lifetime vs session length. Binding to IP (breaks mobile network changes) or not.",
        },
        {
          kind: "multi",
          teach: "The edge checks each token against an expiry time, using its own clock, and against a signing key. Think about what fragments the cache key, what makes a good token look expired, and what happens if CDNs hold different keys.",
          prompt: "Which of these are real failure modes of a segment token scheme? Select all that apply.",
          options: [
            "Token in the cache key: hit ratio collapses",
            "Clock skew: valid tokens rejected",
            "Key rotation not synchronized across CDNs: one CDN rejects all traffic",
            "Prefix tokens make every segment need its own signature",
            "Tokens make segments larger in bytes",
          ],
          answers: [0, 1, 2],
          explain: "Prefix tokens do the opposite: one token covers the rendition directory, and tokens do not change segment size. **Staff answer adds:** one token format with per-CDN validators tested in a conformance suite, and a rollout of new signing keys that accepts old and new for a window.",
        },
        {
          kind: "summary",
          points: [
            "Answer order: clarify, size, design, key decisions, failure modes, staff extras. Numbers before boxes.",
            "Premiere: pre-package, verify, pre-warm, collapse, reserve capacity, release by flipping the catalog entry.",
            "Steering: offline scorer every minute, online decider from memory; keep the last good table.",
            "Replication: publish only when verified in both places; partial replication hides until failover.",
            "Purge with surrogate keys and soft purge; sign tokens by prefix and keep them out of the cache key.",
          ],
        },
      ],
    },

    /* ======================= Lesson 6 ======================= */
    {
      id: "ch19-l6",
      title: "Interview problems 6-10",
      goal: "Sketch answers for QoE regression hunting, low-latency live, failover with hysteresis, log pipelines and safe config rollout, then practice in the playground.",
      minutes: 11,
      steps: [
        {
          kind: "read",
          title: "Five more problems",
          body: "Five more interview problems, in the same six-part shape: clarify, size, design, key decisions, failure modes, staff extras.\n\nThese are about finding trouble fast and changing things safely: hunting a quality drop, a low-latency live event, automatic failover, the log pipeline, and config rollout. At the end you will practice in the playground, saying the numbers out loud before you press run.",
        },
        {
          kind: "read",
          title: "Problem 6: find a QoE regression fast",
          body: "\"Rebuffering is up.\" **Clarify:** where, since when, for whom?\n\n**Design.** A pipeline that joins player beacons ([[CMCD]]-style fields like session ID, bitrate, buffer length) with CDN logs by session ID. Precomputed breakdowns, called **slices**, by CDN, country, ASN, device, app version and title. Anomaly detection on each slice, ranked by **viewer impact** (affected sessions, not percent change).\n\n**Key decisions.** Sampling vs full logs (cost). [[Cardinality]] control: ASN x title x device explodes.",
        },
        {
          kind: "quiz",
          teach: "A country's number on a dashboard is an average over all of its ISPs, devices and titles.",
          prompt: "The country dashboard for Brazil looks normal, but viewers on one ISP are stalling. Why did the dashboard miss it?",
          options: [
            "The CDN logs are delayed",
            "Dashboards show averages, so a bad ISP hides inside a good country",
            "Rebuffering cannot be measured per ISP",
            "The app release fixed it",
          ],
          answer: 1,
          explain: "Averages hide slices. Another failure mode: an app release and a CDN change happen the same day and the team blames the wrong one. **Staff answer adds:** change annotation on every graph (deploys, config pushes, CDN maintenance), and a standard \"slice until it is not uniform\" method in the runbook.",
        },
        {
          kind: "read",
          title: "Problem 7: low-latency live event",
          body: "**Clarify.** Target latency (for example 5-10 seconds glass to glass). Concurrency. [[DVR window]].\n\n**Design.** Live encoder to packager producing CMAF chunks, [[LL-HLS]] partial segments and [[LL-DASH]]. Live origin with redundant encoders in two regions. Shields with collapsing. Short manifest TTLs, long segment TTLs. Players with a small target buffer and catch-up logic.\n\nIn LL-HLS each segment is split into small **parts**, and players reload the playlist to learn about each new part.",
        },
        {
          kind: "quiz",
          teach: "LL-HLS players reload the playlist to learn about each new part. Ask how many parts per second there are when each part gets shorter.",
          prompt: "You shrink LL-HLS part durations to cut latency. What happens to manifest requests?",
          options: [
            "They fall, because parts are smaller",
            "They grow, because players reload playlists more often",
            "They stay the same; only segment requests change",
            "They move entirely to the player cache",
          ],
          answer: 1,
          explain: "Key decision: latency vs stability. Lower latency means smaller buffers and more stalls, and manifest request rate grows as parts shrink. Failure modes: encoder failover changes timestamps and breaks players; manifest requests overwhelm origin when not collapsed; one CDN does not support blocking playlist reload well. **Staff answer adds:** test LL behavior on each CDN separately, and keep a non-LL fallback stream players can switch to.",
        },
        {
          kind: "read",
          title: "Problem 8: failover with hysteresis",
          body: "**Clarify:** what signal, what action, what speed, what guardrails. Signals can come from players ([[RUM]]), synthetic probes or CDN status.\n\n**Design:** a state machine per CDN per region. A CDN enters **Degraded** only after the error SLI is above threshold for 3 windows, and part of its traffic shifts. Still bad for 3 more windows: **Failed over**, minimum weight only. Good for 5 windows while degraded: back to **Healthy**.",
          visual: { kind: "flow", spec: spec(FSM, ["h", "d", "f", "h>d", "d>f", "d>h"]), caption: "Fail in steps, never all at once." },
        },
        {
          kind: "read",
          title: "Recover more slowly than you fail",
          body: "From **Failed over**, the CDN needs 10 good windows to start **Recovering**, where weight ramps slowly. 10 more good windows return it to **Healthy**. Bad again: straight back to Failed over.\n\nThis is **asymmetric [[hysteresis]]**: it takes more evidence to come back than to leave. Other rules: never move 100 percent of traffic in one step, and check the target CDN's capacity before moving.",
          visual: { kind: "flow", spec: spec(FSM, ["f", "r", "h", "f>r", "r>h", "r>f"]), caption: "Recovery takes 10 + 10 good windows." },
        },
        {
          kind: "quiz",
          teach: "Signals come from players (RUM), synthetic probes and CDN status, and any one of them can be wrong on its own. Which option protects you from one bad signal?",
          prompt: "A bug in the RUM pipeline makes CDN B look like it is down. What guardrail stops a bad failover?",
          visual: { kind: "flow", spec: spec(FSM) },
          options: [
            "Fail over faster so the bug has less effect",
            "Require two independent signals before acting",
            "Only use RUM, never probes",
            "Move 100 percent of traffic so the test is clear",
          ],
          answer: 1,
          explain: "The signal can be wrong, so require two independent signals (for example RUM plus synthetic probes). Other failure modes: flapping, and correlated failure (the target CDN is also bad). **Staff answer adds:** every automatic action posts to the incident channel, and a human can freeze automation with one command.",
        },
        {
          kind: "read",
          title: "Problem 9: CDN logs and the bill",
          body: "**Clarify.** Inputs: real-time logs from each CDN and vendor invoices. Outputs: per-title, per-region, per-CDN bytes; billing forecasts; [[commit]] tracking.\n\n**Size.** Every request is one log line, so start from the request rate. With separate audio and subtitle requests, the assumed total is about 800k requests per second.",
        },
        {
          kind: "read",
          title: "Sizing a log pipeline",
          body: "Log lines per day = requests per second x 86,400 (the seconds in one day).\n\n**Worked example:** a smaller service at 50,000 requests per second. 50,000 x 86,400 = 4,320,000,000, about **4.3 billion** lines a day.\n\nKeeping every raw line for long is expensive, so log designs keep raw logs only for a short time and keep aggregates for long.",
        },
        {
          kind: "number",
          teach: "Lines per day = requests per second x 86,400. Divide the result by 1,000,000,000 to get billions.",
          prompt: "At 800k requests per second, about how many log lines per day is that, in billions?",
          answer: 70,
          tolerance: 3,
          unit: "billion/day",
          hint: "A day has 86,400 seconds.",
          explain: "800,000 x 86,400 = 69.1 billion: **about 70 billion log lines per day** (assumed). Full retention is expensive, so the design keeps raw logs only for a short time.",
        },
        {
          kind: "reveal",
          prompt: "Problem 9: sketch the log pipeline. What does a staff answer add?",
          answer: "**Design.** Stream logs into a queue, enrich them (geo, ASN, title from path), aggregate in near real time, keep raw logs for a short time and aggregates for long. Compute daily [[95th-percentile|95th percentile billing]] curves per CDN and compare them to invoices.\n\n**Staff answer adds.** Forecast end-of-month [[commit]] position mid-month and feed it to the steering scorer, so cost-aware steering uses real data, not guesses.",
        },
        {
          kind: "read",
          title: "Problem 10: safe edge config rollout",
          body: "Config lives in Terraform plus VCL or edge code for several vendors, in one repository. A change moves through stages, from safest to widest:\n\n- unit tests for edge logic\n- a **conformance suite**: the same requests sent to staging on every CDN, checking headers, cache keys, token handling and status codes\n- a canary by header, then a small region\n- global, with automatic rollback on error-rate or QoE gates",
        },
        {
          kind: "order",
          teach: "Go from cheapest and safest to widest: checks on the code first, then every CDN's staging, then real traffic in growing slices.",
          prompt: "**Problem 10: Safe edge config rollout across CDNs.** Put the stages in order.",
          items: [
            "Unit tests for edge logic",
            "Conformance suite against staging services on every CDN",
            "Canary by header",
            "Small region",
            "Global, with automatic rollback on error-rate or QoE gates",
          ],
          explain: "The conformance suite sends the same requests to staging on every CDN and checks headers, cache keys, token handling and status codes. Then canary by header, then a small region, then global, with automatic rollback on gates.",
        },
        {
          kind: "read",
          title: "Problem 10: two failure modes",
          body: "**[[Drift|Drift (config)]]**: the live config no longer matches source control, for example after someone edits it by hand in a vendor console.\n\n**Parity bugs**: the same intent behaves differently on two CDNs. For example, CDN A caches a 404 and CDN B does not.",
        },
        {
          kind: "quiz",
          teach: "Recall the two config failure modes: one is about live config differing from source control, the other about CDNs behaving differently.",
          prompt: "Someone fixes a CloudFront behavior by hand in the vendor console. What failure mode is this, and what is the fix?",
          options: [
            "A parity bug; fix with more canaries",
            "[[Drift|Drift (config)]]; fix with drift detection and locked consoles",
            "A retry storm; fix with a retry budget",
            "Not a problem if the change is correct",
          ],
          answer: 1,
          explain: "Live config now differs from source control: drift. Fix with drift detection and locked consoles. The other failure mode is config parity bugs (CDN A caches a 404, CDN B does not). **Staff answer adds:** change freezes around premieres, and a rule that no single change touches more than one CDN at a time.",
        },
        {
          kind: "widget",
          widget: "playground",
          title: "Interview practice",
          task: "Treat each scenario as an interview question. Before you press run, say the numbers out loud, predict which box fails and what the viewer sees. Start with CDN A going down, then try the cold premiere herd.",
          props: { scenario: 4 },
        },
        {
          kind: "summary",
          points: [
            "QoE regressions: join player and CDN data by session ID, slice until it is not uniform, rank by affected sessions.",
            "Low-latency live trades stability for latency; keep a non-LL fallback stream.",
            "Failover: a state machine per CDN per region, asymmetric hysteresis, two independent signals, a one-command freeze.",
            "Logs: about 70 billion lines a day; keep aggregates, feed commit forecasts to steering.",
            "Config rollout: tests, conformance, header canary, region, global; detect drift; one CDN per change.",
          ],
        },
      ],
    },

    /* ======================= Lesson 7 ======================= */
    {
      id: "ch19-l7",
      title: "Vendors, partner teams and your first 90 days",
      goal: "Manage CDN vendors with data, agree clear contracts with partner teams, plan your first 90 days, and speak precisely in design reviews.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "The human side of staff work",
          body: "Good designs still fail when vendors and teams are not lined up. Much of a staff engineer's week is people work done with data.\n\nThis lesson covers four parts of it: managing CDN vendors, agreeing contracts with partner teams, planning your first 90 days on a new team, and speaking precisely in design reviews.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. A big premiere is three weeks away. What would you expect is the cheapest thing you can do with your CDN vendors to prevent incidents?",
          options: [
            "Threaten to move traffic away if anything breaks",
            "Tell every vendor about the premiere and ask them to confirm capacity in the regions that matter",
            "Switch to a new CDN for the premiere",
            "Nothing; vendors autoscale",
          ],
          answer: 1,
          explain: "**Share your calendar.** Tell every vendor about premieres, big launches and expected peaks weeks ahead, and ask them to confirm capacity in the regions that matter. It is cheap and prevents many incidents.",
        },
        {
          kind: "read",
          title: "Vendors are three things at once",
          body: "CDN vendors are partners, suppliers and sometimes the cause of your outage, all at once. Staff engineers manage these relationships **with data**.\n\n**Know your account team and escalation path.** For each vendor, keep a current list: technical account manager, support tier, emergency phone line and status page. Test the emergency path before you need it.\n\n**Share your calendar.** Tell vendors about premieres and expected peaks weeks ahead.",
        },
        {
          kind: "read",
          title: "Bake-offs, scorecards, postmortems",
          body: "**Run bake-offs with real traffic.** Marketing benchmarks do not predict your QoE. Send a small, fixed share of real traffic to a new CDN for weeks, compare QoE by region and ASN, and decide from your own RUM.\n\n**Score vendors monthly** (see the scorecard).\n\n**Read their postmortems.** Vendors publish detailed incident reports; Fastly's 2021 summary is a good example. Look for patterns that could hit you, and ask your account team what changed.",
          visual: {
            kind: "table",
            headers: ["Scorecard item", "Measured by"],
            rows: [
              ["Availability", "Your own SLI"],
              ["QoE", "By region"],
              ["Support", "Response times"],
              ["Incidents", "Count and their postmortems"],
              ["Cost", "Cost per TB"],
              ["Contract", "Commit position"],
            ],
          },
        },
        {
          kind: "read",
          title: "Leverage, not threats",
          body: "**Negotiate with leverage, not threats.** Multi-CDN gives you real options. A [[commit]] is a promise to buy a minimum volume: it trades a lower unit price for risk. If you commit too high and traffic moves away, you pay for unused bytes. Know your traffic forecast before negotiating.\n\n**Never let one engineer hold all vendor knowledge.** Put vendor configs, contacts and quirks in the repo and runbooks.",
          callout: { type: "industry", text: "Netflix built its own CDN and partners with \"over a thousand ISPs,\" placing embedded appliances inside ISP networks and peering at internet exchanges. Most streaming services, even large ones, buy from several vendors and invest in steering, observability and vendor management instead. Building only makes sense with huge, stable traffic and the staff to run hardware and peering worldwide." },
        },
        {
          kind: "match",
          teach: "Each practice replaces a guess or a single person with data or a written record. Ask which risk each one removes.",
          prompt: "Match each vendor practice to its reason.",
          pairs: [
            ["Bake-off with real traffic", "Marketing benchmarks do not predict your QoE"],
            ["Test the emergency path", "You will need it at the worst moment"],
            ["Know your traffic forecast", "Commit too high and you pay for unused bytes"],
            ["Vendor quirks in the repo", "No single engineer holds all vendor knowledge"],
          ],
          explain: "Every practice replaces a guess or a single person with data or a written record.",
        },
        {
          kind: "read",
          title: "Four partner teams",
          body: "The job posting names four partner teams: **Content Pipeline**, **Content Protection**, **Playback** and **Security**. Each sits on a boundary of the delivery system.\n\nA **contract** here is a written agreement about what crosses a boundary: formats, headers, timings and who owns what. Clear contracts at these boundaries prevent most cross-team incidents.",
          visual: { kind: "flow", spec: spec(PARTNERS), caption: "Assets and rules flow in; URLs flow out; QoE telemetry flows back." },
        },
        {
          kind: "read",
          title: "What crosses each boundary",
          body: "The \"owns\" column is a reasonable guess for a platform like Crunchyroll, based on the job posting's team names. The exact split is not published, so confirm it in your first weeks.",
          visual: {
            kind: "table",
            headers: ["Partner team", "Owns (likely)", "What crosses the boundary", "Contract to agree on"],
            rows: [
              ["Content Pipeline", "Ingest, transcode, package", "Packaged files, manifests, publish events", "Object layout, naming, cache headers, \"replicated and verified\" before release"],
              ["Content Protection", "DRM, keys, licenses, watermarking", "Encrypted segments, key IDs, token rules", "Token format, key rotation timing, geo rules, who enforces what"],
              ["Playback", "Players, apps, playback API", "Manifest URLs, CDN lists, telemetry", "Retry and failover behavior, CMCD fields, steering API"],
              ["Security", "Threat model, WAF, posture", "Edge rules, origin access, certificates", "DDoS runbooks, cert ownership, IAM boundaries, review gates"],
            ],
          },
        },
        {
          kind: "match",
          teach: "Each contract sits on one boundary. Ask which team produces or consumes the thing in the contract: packaged files, keys, players or certificates.",
          prompt: "Match each contract to the partner team you agree it with.",
          pairs: [
            ["\"Replicated and verified\" before release", "Content Pipeline"],
            ["Key rotation timing and geo rules", "Content Protection"],
            ["Retry and failover behavior, CMCD fields", "Playback"],
            ["Cert ownership and IAM boundaries", "Security"],
          ],
          explain: "Each contract sits on the boundary where that team's output becomes your input, or yours becomes theirs.",
        },
        {
          kind: "read",
          title: "Three habits across teams",
          body: "- **Write interface docs**, not just code: what headers, what URL shapes, what error codes.\n- **Share dashboards**: the Playback team should see CDN error rates, and you should see player startup failures.\n- **Run joint game days**: a CDN failover drill involves the player, and a DRM key rotation drill involves the CDN.",
          callout: { type: "crunchyroll", text: "Crunchyroll's 2020 \"Katana\" post (by Michael Dale and Maxim Levkov) described manifests at the edge, a multi-CDN decision step, and CloudFront used as a \"fail-through cache\" before origin. That is six years old and the current architecture may be different. Read it as history, and ask your team what has changed." },
        },
        {
          kind: "read",
          title: "Your first 90 days",
          body: "The aim is not to ship something big. It is to understand the system well enough that your **first big change is safe**, and to earn trust by being useful early. The plan has three phases: learn, own one thing, lead one improvement.\n\n**Days 1-30: learn the bytes path.** Trace one playback request hop by hop, read the last 12 months of postmortems, and shadow on-call and one premiere.",
          visual: { kind: "flow", spec: only(DAYS, ["a", "a1", "a2", "a3", "b"], ["a", "a1", "a2", "a3", "a>a1", "a>a2", "a>a3"]), caption: "Three phases. First: learn the bytes path." },
        },
        {
          kind: "reveal",
          prompt: "Days 1-30 in detail. What would you actually do in your first month? Think, then reveal the book's list.",
          answer: "- Draw the full path for one real playback: app, playback API, steering, manifest, CDN, shield, origin, buckets in each cloud. Confirm each hop with a teammate. Use `curl -I` on real segment URLs to see cache headers and CDN identifiers.\n- Find the numbers: real peak concurrency, real bitrate mix, real hit ratio by CDN, real monthly bytes and cost. Replace the book's assumed model with real values in your notes.\n- Read every postmortem from the last year. List the top five failure causes.\n- Get access to every dashboard, every CDN console (read-only) and the IaC repos. Read the Terraform and edge config.\n- Shadow on-call. Watch one simulcast premiere in the war room if possible.\n- Meet the four partner teams and ask each: \"What do you wish Media Delivery did differently?\"",
        },
        {
          kind: "read",
          title: "Days 31-60: own one thing",
          body: "- Take one small, real problem: a noisy alert, a missing dashboard, a drift between two CDN configs, a runbook gap.\n- Ship a change through the full pipeline: code review, tests, canary, production. Learn where the pipeline is slow or unsafe.\n- Join the on-call rotation with a buddy.\n- Start a personal **\"delivery risks\" list**: things that would hurt if they broke, with no owner or no test.",
          visual: { kind: "flow", spec: only(DAYS, ["a", "b", "b1", "b2", "c"], ["a", "b", "b1", "b2", "a>b", "b>b1", "b>b2"]) },
        },
        {
          kind: "read",
          title: "Days 61-90: lead one improvement",
          body: "- Pick the top item from your risks list that the team agrees matters. Write a design doc with the template.\n- Present a short **delivery health review**: hit ratio, origin offload, QoE by CDN, cost per TB, top incident causes, and three proposals.\n- Propose one drill (for example, a CDN failover drill in one region) and run it with Playback.",
          visual: { kind: "flow", spec: only(DAYS, ["b", "c", "c1", "c2"], ["b", "c", "c1", "c2", "b>c", "c>c1", "c>c2"]) },
          callout: { type: "mistake", text: "Proposing a re-architecture in month one. You do not yet know why things are the way they are. Some odd choices are scars from incidents. Learn the scars first." },
        },
        {
          kind: "order",
          teach: "The three phases are: learn the bytes path, own one thing end to end, then lead one improvement. Place each action in its phase.",
          prompt: "Put these first-90-days actions in order.",
          items: [
            "Read every postmortem from the last year and list the top five causes",
            "Start a personal \"delivery risks\" list",
            "Write a design doc for the top item on that risks list",
          ],
          explain: "Postmortems are month one (learn the scars). The risks list starts in days 31-60 while you own one thing. In days 61-90 you pick its top item, which the team agrees matters, and write the design doc.",
        },
        {
          kind: "reveal",
          prompt: "Month two. You notice CDN B's byte hit ratio in Brazil is 88 while the other CDNs are at 96. What do you say in the team meeting?",
          answer: "A precise question backed by a number: \"Our byte hit ratio on CDN B in Brazil is 88 while the others are 96. Do we know why?\"\n\nIn the first 90 days, this is the most valuable kind of sentence you can say. It shows you read the data, and it starts a useful investigation, without proposing a re-architecture.",
        },
        {
          kind: "read",
          title: "Talk like a staff engineer",
          body: "Language matters in design reviews. Replace vague phrases with numbers, mechanisms and rollback plans.\n\nThe first row is a worked example: 400,000 requests x (1 - 0.95) = **20,000 misses per second** at the shield.\n\nAlso learn to say \"I don't know, here is how I would find out.\" Precise uncertainty is a staff trait.",
          visual: {
            kind: "table",
            headers: ["Instead of", "Say"],
            rows: [
              ["\"This should scale\"", "\"At 400k segment requests per second and a 95 percent hit ratio, the shield sees about 20k misses per second, which is X per shield node.\""],
              ["\"We can fail over\"", "\"Failover is automatic after three bad one-minute windows from two independent signals, it moves at most 30 percent per step, and the player keeps a fallback CDN list if steering is down.\""],
              ["\"This is more secure\"", "\"This closes origin to direct fetches by requiring a signed header from the CDN, which removes the bypass path we saw in the threat model.\""],
              ["\"This is cheaper\"", "\"This moves about 2 PB per month from CDN A to CDN B, which keeps us inside CDN B's commit and saves roughly N per month at contract rates.\""],
              ["\"Let's be careful\"", "\"Let's roll out to one region on one CDN with a header canary first, gate on video start failures, and keep a one-command rollback.\""],
            ],
          },
        },
        {
          kind: "number",
          teach: "Misses per second = requests per second x (1 - hit ratio).",
          prompt: "Your turn, with a different design: 500k segment requests per second and a 98 percent hit ratio. How many misses per second reach the shield?",
          answer: 10000,
          tolerance: 500,
          unit: "misses/s",
          explain: "500,000 x (1 - 0.98) = 500,000 x 0.02 = **10,000 misses per second**. Divide by the number of shield nodes to get the per-node load: that is the number that makes \"this should scale\" a real claim.",
        },
        {
          kind: "match",
          teach: "A precise version names a number or a mechanism someone can check. Find the one that backs up each vague promise.",
          prompt: "Match each vague phrase to what the precise version adds.",
          pairs: [
            ["\"We can fail over\"", "Trigger windows, two signals, 30 percent max step, fallback list"],
            ["\"This is more secure\"", "Signed header from the CDN closes the origin bypass path"],
            ["\"This is cheaper\"", "2 PB/month moved, stays inside CDN B's commit"],
            ["\"Let's be careful\"", "One region, one CDN, header canary, gate, one-command rollback"],
          ],
          explain: "Each precise version names a number or a mechanism someone can check. Also learn to say \"I don't know, here is how I would find out.\" Precise uncertainty is a staff trait.",
        },
        {
          kind: "summary",
          points: [
            "Manage vendors with data: escalation paths, shared calendars, real-traffic bake-offs, monthly scorecards, their postmortems.",
            "Negotiate with leverage, not threats; know your forecast before you commit.",
            "Agree clear contracts with Content Pipeline, Content Protection, Playback and Security; share docs, dashboards and game days.",
            "First 90 days: learn the bytes path, own one thing, lead one improvement. Learn the scars before re-architecting.",
            "Speak in numbers and mechanisms; say \"I don't know, here is how I would find out.\"",
          ],
        },
      ],
    },

    /* ======================= Lesson 8: Checkpoint ======================= */
    {
      id: "ch19-l8",
      title: "Checkpoint",
      goal: "Check that you can apply the chapter's staff-level models, numbers and habits under interview conditions.",
      minutes: 9,
      steps: [
        {
          kind: "read",
          title: "What this chapter covered",
          body: "Here is what this chapter covered:\n\n- **Staff habits:** numbers first, failure first, blast radius, writing as leverage.\n- **Miss ratio sets load:** hit ratio 90 to 99 percent cuts misses from 10 to 1 percent, 10x less.\n- **Quick sizing:** egress = streams x bitrate; segment rate = streams / segment length (1M / 5 s = 200k/s).\n- **Static stability:** when a decider fails, keep the last good state.\n- **Safe change:** config is code; roll out in cells; judge with QoE.\n- **Money and people:** cost is a design input; clear contracts with partner teams.",
        },
        {
          kind: "number",
          teach: "Upstream load follows the miss ratio (100 percent minus the hit ratio). Compare the miss ratios before and after.",
          prompt: "Your byte hit ratio rises from 96 percent to 98 percent. By what factor does shield or origin traffic fall?",
          answer: 2,
          tolerance: 0.1,
          unit: "x",
          hint: "Compare the miss ratios, not the hit ratios.",
          explain: "Misses fall from 4 percent to 2 percent, so upstream traffic **halves** (2x reduction). People think in hit-ratio points, but load scales with the miss ratio, and small hit-ratio gains at the top give large relative miss-ratio drops.",
        },
        {
          kind: "number",
          teach: "Video segment request rate = concurrent viewers / segment length in seconds.",
          prompt: "Using the assumed model, compute the video segment request rate at a 2M-viewer premiere with **4-second** segments.",
          answer: 500000,
          tolerance: 10000,
          unit: "requests/s",
          explain: "2,000,000 / 4 s = **500,000 video segment requests per second**, before separate audio and subtitle requests.",
        },
        {
          kind: "reveal",
          prompt: "Explain static stability for a multi-CDN steering service in two sentences.",
          answer: "If the steering service fails, players and the playback API keep using the last good CDN list and weights instead of failing sessions. The control plane's failure freezes the data plane in a known-good state.",
        },
        {
          kind: "multi",
          teach: "Think about the cache key, the clock the edge uses to check expiry, signing keys held by each CDN, and what happens when a phone changes network.",
          prompt: "Which of these can make a token scheme break cache efficiency or availability? Select all that apply.",
          options: [
            "Token in the cache key",
            "Unsynchronized signing-key rotation across CDNs",
            "Clock skew or too-short lifetimes",
            "IP binding during mobile network handoffs",
            "Prefix-based tokens for a rendition directory",
          ],
          answers: [0, 1, 2, 3],
          explain: "Token in the cache key: hit ratio collapses. Unsynchronized key rotation: one CDN rejects all requests. Clock skew or too-short lifetimes: valid sessions rejected mid-playback. IP binding breaks mobile handoffs. Prefix tokens are a good practice: one token covers the directory.",
        },
        {
          kind: "quiz",
          teach: "Asymmetric hysteresis asks for more good windows to come back than bad windows to leave. Think about the state of a CDN's cache right after it recovers.",
          prompt: "Why should automatic CDN failover recover more slowly than it fails?",
          options: [
            "Vendors charge more for fast recovery",
            "To avoid flapping: a just-recovered CDN may be fragile or cold, and moving all traffic back at once can cause a second failure",
            "Because DNS TTLs make fast recovery impossible",
            "Recovery speed does not matter",
          ],
          answer: 1,
          explain: "Slow, staged recovery confirms health under growing load. A CDN that just recovered may be fragile or have a cold cache.",
        },
        {
          kind: "quiz",
          teach: "The alternatives section records the options that were rejected, and the reasons. Think about what happens six months later without that record.",
          prompt: "A design doc has no \"alternatives considered\" section. Why is that a problem beyond completeness?",
          options: [
            "Reviewers will not approve docs without 13 sections",
            "It hides whether simpler or cheaper options were considered and leaves no record of why they were rejected, so the team will re-argue later",
            "It makes the doc too short to read",
            "Alternatives are only needed for cost changes",
          ],
          answer: 1,
          explain: "The alternatives section shows you did not fall in love with the first idea, and it records why tempting options were rejected so the decision is not re-argued every six months.",
        },
        {
          kind: "reveal",
          prompt: "You see rebuffering up in one country. Describe the first three slices you would check, and why.",
          answer: "1. **By CDN**: is one vendor bad?\n2. **By ASN or ISP**: is it one network path?\n3. **By device or app version**: is it a client release?\n\nEach slice tests a different class of root cause. Keep slicing until the problem is not uniform.",
        },
        {
          kind: "quiz",
          teach: "95th percentile billing charges by a high sample of your traffic rate, not by the average. Think about which traffic shape makes high samples much larger than the average.",
          prompt: "When is [[95th percentile billing]] worse for you than total-GB billing?",
          options: [
            "When traffic is flat all month",
            "When traffic is spiky, such as simulcast premieres or a pre-warm burst",
            "When the hit ratio is high",
            "Never; 95th percentile is always cheaper",
          ],
          answer: 1,
          explain: "With spiky traffic, the high samples set the bill even though average usage is much lower.",
        },
        {
          kind: "number",
          teach: "Origin load follows the miss ratio. Work out 100 minus each hit ratio, then divide.",
          prompt: "Takeaway check. Byte hit ratio goes from 95 to 99 percent. By what factor does origin traffic fall?",
          answer: 5,
          tolerance: 0.2,
          unit: "x",
          explain: "Misses go from 5 percent to 1 percent: a **5x** cut. The miss ratio, not the hit ratio, sets origin load.",
        },
        {
          kind: "quiz",
          teach: "Think about which setting can drop a hit ratio from 95 percent to near zero with one careless query string.",
          prompt: "Takeaway check. Which line of config does the chapter call the most expensive one you will write?",
          options: ["The TLS cipher list", "The cache key", "The DNS TTL", "The log format"],
          answer: 1,
          explain: "The cache key decides what counts as the same object. Tokens and session values must never fragment it.",
        },
        {
          kind: "multi",
          teach: "Check each statement against the chapter's models: measure at the eyeball, config is code, the herd, the first-90-days advice, and cost as a design input.",
          prompt: "Takeaway check. Which statements match the chapter's key takeaways? Select all that apply.",
          options: [
            "Judge with client-side QoE and RUM; use server-side metrics to explain",
            "Config pushes have global blast radius, for vendors and for you",
            "A premiere is just normal traffic at higher volume",
            "In your first 90 days, propose the re-architecture early before habits set in",
            "Cost is a design input: each tenth of a cent per GB is about $540k per month at 540 PB",
          ],
          answers: [0, 1, 4],
          explain: "A premiere is a different system (same objects, same second, cold caches, control-plane storm). In the first 90 days, learn the bytes path and the scars before proposing big changes.",
        },
        {
          kind: "read",
          title: "Where to read next",
          body: "Read **standards** when you need exact behavior, **papers** when you need the idea, and **vendor docs** when you need the knob. The book's further-reading list, grouped by topic, is below; full links are in the Sources list.",
          visual: {
            kind: "table",
            headers: ["Topic", "Read"],
            rows: [
              ["Standards", "RFC 9111 HTTP Caching; RFC 5861 stale content; RFC 9213 targeted cache-control; RFC 8216 HLS and the newer HLS draft with Content Steering; CTA-5004 CMCD"],
              ["Papers", "The Akamai Network (2010), the classic CDN paper; BOLA and Pensieve (SIGCOMM 2017), two ends of ABR design; S3-FIFO (SOSP 2023); Maglev (NSDI 2016) and Espresso (SIGCOMM 2017)"],
              ["Reliability", "Amazon Builders' Library, \"Static stability using Availability Zones\" (2019); Google SRE Workbook, \"Alerting on SLOs\"; Fastly, \"Summary of June 8 outage\" (2021), a model postmortem"],
              ["Industry systems", "Netflix Open Connect overview; Crunchyroll \"Katana\" (2020); Apple WWDC22 HLS Content Steering session; AWS CloudFront Origin Shield docs"],
              ["Career", "Will Larson, \"Staff Engineer: Leadership beyond the management track\" and its online archetypes and stories"],
            ],
          },
        },
        {
          kind: "match",
          teach: "The step above gives a rule of thumb: each kind of source answers a different need. Match the need to the source.",
          prompt: "Match what you need to where you should read.",
          pairs: [
            ["Exact protocol behavior", "Standards (RFCs, CTA specs)"],
            ["The core idea behind a design", "Papers"],
            ["The exact setting to change", "Vendor docs"],
          ],
          explain: "Standards for exact behavior, papers for the idea, vendor docs for the knob.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "Staff work means owning a problem space: numbers first, failure first, blast radius always, writing as leverage.",
            "Miss ratio sets origin load; a premiere is a different system; the cache key is the most expensive line of config.",
            "Static stability: when steering, health checks or vendor APIs fail, keep serving with last good state.",
            "Test, canary, gate and roll back edge config like service code; judge with QoE and RUM.",
            "Cost is a design input; clear contracts with the four partner teams prevent most cross-team incidents.",
            "In your first 90 days, learn the bytes path and the scars before proposing big changes.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Crunchyroll, \"Software Engineer III, Media Delivery (Video Platform Engineering)\" job posting, 2026 (as provided to the reader; no public URL cited).",
    "Advanced Television, \"Crunchyroll surpasses 21m subs,\" May 8, 2026. https://www.advanced-television.com/?p=284551",
    "The Streamable, \"Crunchyroll reaches 17 million subscribers,\" 2025. https://thestreamable.com/crunchyroll-17-million-subscribers-q1-2025",
    "Michael Dale and Maxim Levkov, \"Katana: Lessons Learned from Slicing HLS and Dicing Dash on the FaaS Edge,\" Crunchyroll Tech Blog, 2020. https://medium.com/crunchyroll/katana-lessons-learned-from-slicing-hls-and-dicing-dash-on-the-faas-edge-3fa1de2d5ba2",
    "Mike Furr, \"Static stability using Availability Zones,\" Amazon Builders' Library, 2019. https://aws.amazon.com/builders-library/static-stability-using-availability-zones/",
    "Google, \"Alerting on SLOs,\" The Site Reliability Workbook. https://sre.google/workbook/alerting-on-slos/",
    "Fastly, \"Summary of June 8 outage,\" 2021. https://www.fastly.com/blog/summary-of-june-8-outage",
    "Netflix, \"Open Connect\" overview. https://openconnect.netflix.com/en/",
    "Kevin Spiteri, Rahul Urgaonkar, Ramesh K. Sitaraman, \"BOLA: Near-Optimal Bitrate Adaptation for Online Videos,\" IEEE INFOCOM 2016 (journal version IEEE/ACM ToN 2020). https://arxiv.org/abs/1601.06748",
    "IETF, RFC 9111, \"HTTP Caching,\" 2022. https://www.rfc-editor.org/rfc/rfc9111",
    "IETF, RFC 8216, \"HTTP Live Streaming,\" 2017. https://www.rfc-editor.org/rfc/rfc8216",
    "IETF, RFC 5861, \"HTTP Cache-Control Extensions for Stale Content,\" 2010. https://www.rfc-editor.org/rfc/rfc5861",
    "CTA-WAVE, \"Common Media Client Data (CTA-5004)\" resources page. https://cta-wave.github.io/Resources/common-media-client-data--cta-5004-a.html",
    "Apple, \"Deliver reliable streams with HLS Content Steering,\" WWDC22 session 10144. https://developer.apple.com/videos/play/wwdc2022/10144/",
    "Erik Nygren, Ramesh K. Sitaraman, Jennifer Sun, \"The Akamai Network: A Platform for High-Performance Internet Applications,\" ACM SIGOPS Operating Systems Review, 2010. https://dl.acm.org/doi/10.1145/1842733.1842736",
    "Juncheng Yang et al., \"FIFO queues are all you need for cache eviction,\" SOSP 2023. https://dl.acm.org/doi/10.1145/3600006.3613147",
    "Hongzi Mao, Ravi Netravali, Mohammad Alizadeh, \"Neural Adaptive Video Streaming with Pensieve,\" SIGCOMM 2017. https://people.csail.mit.edu/hongzi/content/publications/Pensieve-Sigcomm17.pdf",
    "Daniel E. Eisenbud et al., \"Maglev: A Fast and Reliable Software Network Load Balancer,\" NSDI 2016. https://research.google/pubs/maglev-a-fast-and-reliable-software-network-load-balancer/",
    "Kok-Kiong Yap et al., \"Taking the Edge off with Espresso: Scale, Reliability and Programmability for Global Internet Peering,\" SIGCOMM 2017. https://research.google/pubs/taking-the-edge-off-with-espresso-scale-reliability-and-programmability-for-global-internet-peering/",
    "IETF, RFC 9213, \"Targeted HTTP Cache Control,\" 2022. https://www.rfc-editor.org/rfc/rfc9213",
    "Amazon Web Services, \"Using Amazon CloudFront Origin Shield,\" CloudFront Developer Guide. https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html",
    "Will Larson, \"Staff Engineer: Leadership beyond the management track,\" 2021. https://staffeng.com/book",
  ],
};
export default chapter;
