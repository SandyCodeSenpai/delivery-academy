import type { Chapter, FlowSpec } from "./types";

// Chapter 0 content. Source: chapters/00-front.md

/* ---------------- Shared visual: the chain behind one press of Play (book opening) ---------------- */

const CHAIN_NODES: FlowSpec["nodes"] = [
  { id: "pl", label: "Player", sub: "viewer in Brazil", kind: "player", col: 0, row: 1 },
  { id: "api", label: "Playback service", sub: "what may I watch?", kind: "api", col: 1, row: 0 },
  { id: "man", label: "Manifest", sub: "qualities, dubs, subs", kind: "service", col: 2, row: 0 },
  { id: "drm", label: "DRM license", sub: "keys to decrypt", kind: "drm", col: 3, row: 0 },
  { id: "edge", label: "CDN edge server", sub: "in São Paulo", kind: "edge", col: 1, row: 2 },
  { id: "cache", label: "Cache tier", sub: "fills the edge", kind: "shield", col: 2, row: 2 },
  { id: "store", label: "Cloud storage", sub: "in another country", kind: "storage", col: 3, row: 2 },
];
const CHAIN_EDGES: FlowSpec["edges"] = [
  { from: "pl", to: "api", label: "1 ask" },
  { from: "pl", to: "man", label: "2 manifest" },
  { from: "pl", to: "drm", label: "3 license" },
  { from: "pl", to: "edge", label: "4 segments" },
  { from: "edge", to: "cache", label: "on miss" },
  { from: "cache", to: "store", label: "on miss" },
];
const CHAIN_GROUPS: FlowSpec["groups"] = [
  { id: "ask", label: "Ask and unlock", nodes: ["api", "man", "drm"] },
  { id: "bytes", label: "Pull the bytes", nodes: ["edge", "cache", "store"] },
];
const chain = (focus?: string[], flow?: string[]): FlowSpec => ({
  nodes: CHAIN_NODES, edges: CHAIN_EDGES, groups: CHAIN_GROUPS, focus, flow, direction: "right",
});

const chapter: Chapter = {
  n: 0,
  title: "How to Read This Book",
  short: "Start here",
  part: 0,
  hook: "The map, the running example and how to get the most from each lesson.",
  lessons: [
    /* ---------------------------------------------------------------- Lesson 1 */
    {
      id: "ch00-l1",
      title: "Press Play: what this course covers",
      goal: "Name the links behind one press of Play and explain why Crunchyroll's traffic is a good teaching example.",
      minutes: 6,
      steps: [
        {
          kind: "reveal",
          prompt: "Someone in Brazil presses play on a new anime episode, one hour after it aired in Tokyo. About two seconds later the video plays. What has to happen in those two seconds? Name as many steps as you can, then reveal.",
          visual: { kind: "flow", spec: chain(["pl"]), caption: "Only the player is visible to the viewer. Everything else is hidden." },
          answer: "1. The app asks a **playback service** what this user may watch.\n\n2. It gets a **[[manifest|Manifest / playlist]]** that lists the qualities, dubs and subtitles.\n\n3. It gets a **[[DRM]] license**, so it can decrypt the video.\n\n4. Then it pulls small video **[[segments|Segment]]**, every few seconds, from a server that is probably in a building in São Paulo, owned by a CDN company. That server was filled from a cache tier, which was filled from cloud storage in another country.",
        },
        {
          kind: "read",
          title: "Every link can break",
          body: "If any link in that chain is slow, the spinner appears. If one breaks and nothing takes its place, the video does not play.\n\nThis course explains every link: how it works, how it fails, what it costs, and how the best streaming companies build it. It goes from zero to leading a design review.\n\nIt is the fourth book in a series, after ML data, storage and compute. It covers **delivery**: getting video bytes from cloud storage to hundreds of millions of screens, fast, safely and cheaply.",
          visual: { kind: "flow", spec: chain(["pl", "edge", "cache", "store", "pl>edge", "edge>cache", "cache>store"], ["pl>edge", "edge>cache", "cache>store"]), caption: "The bytes path: every few seconds, for the whole episode." },
        },
        {
          kind: "widget",
          widget: "playground",
          title: "A first look at the whole system",
          task: "Press Play on a new episode and watch the request travel. Do \"A cache hit\", then \"A miss the shield catches\". For each one, follow the boxes the request passes through. Do not worry about the details yet: this is the book's Chapter 18 design, and the course builds it up one part at a time.",
          props: { scenario: 1 },
        },
        {
          kind: "read",
          title: "Why Crunchyroll",
          body: "The course follows Crunchyroll's **Media Delivery** team (Video Platform Engineering), as described in its public job posting. The team owns global CDN networks, cloud origins on AWS and GCP, content replication pipelines and the delivery services between them. So every chapter ends with: \"what does this mean at Crunchyroll?\"\n\nCrunchyroll is also a good teaching example, because its traffic has an unusual shape. Most streaming services spread their load over the day. Crunchyroll gets a synchronized spike every week, many times a week.",
          visual: {
            kind: "table",
            headers: ["Trait", "What it is", "Effect on delivery"],
            rows: [
              ["Simulcast", "New episodes go out worldwide shortly after the Japanese broadcast, at a fixed time", "Millions press play in the same few minutes, on content no cache has ever seen"],
              ["Long-tail catalog", "Tens of thousands of episodes, most watched rarely", "The hot head is easy to cache. The long tail decides how hard the origin works"],
              ["Many tracks per episode", "Several video qualities, several audio dubs, many subtitle languages", "Every extra track multiplies storage and splits the cache"],
              ["Global licensing", "Rights are sold per territory and per time window", "What a user may watch depends on where they are, so geo-rules sit in the delivery path"],
            ],
            caption: "Four traits that make Crunchyroll's traffic unusual.",
          },
        },
        {
          kind: "match",
          prompt: "Match each situation to the Crunchyroll trait behind it.",
          pairs: [
            ["A new episode of a hit show goes live worldwide at one fixed time", "Simulcast"],
            ["An old episode is requested for the first time this month", "Long-tail catalog"],
            ["The team adds one more audio dub to every episode of a show", "Many tracks per episode"],
            ["A title plays in one country but is blocked next door", "Global licensing"],
          ],
          explain: "**[[Simulcast]]** creates a synchronized spike on content no cache has seen. The **[[long tail|Long tail]]** is watched rarely, so it decides how hard the [[origin|Origin]] works. Each extra **track** multiplies storage and splits the cache. **Licensing** is per territory and per time window, so geo-rules sit right in the delivery path.",
        },
        {
          kind: "read",
          title: "A note on honesty",
          body: "Crunchyroll publishes little about its internals. Where the course states a Crunchyroll fact, it is cited. Where it does not know, it says \"a platform like Crunchyroll would likely...\" or it uses the **assumed traffic model** from the next lesson.\n\nTreat the assumptions as a whiteboard model, not as company data. Your first weeks on the team will replace them with real numbers.",
          callout: { type: "crunchyroll", text: "Anything not published is labelled \"assumed\" or \"likely\" in this course. When you see those words, read the number as a model to check, not a fact to repeat." },
        },
        {
          kind: "summary",
          points: [
            "One press of Play: ask the playback service, get a manifest, get a DRM license, then pull segments every few seconds from a CDN edge filled by a cache tier filled by cloud storage.",
            "If one link is slow, the spinner appears. If one breaks with no backup, nothing plays.",
            "Media Delivery owns CDN networks, cloud origins on AWS and GCP, replication pipelines and the delivery services between them.",
            "Crunchyroll's shape: simulcast spikes, a long-tail catalog, many tracks per episode, per-territory licensing.",
            "Crunchyroll facts are cited; everything else is labelled \"likely\" or comes from the assumed model.",
          ],
        },
      ],
    },

    /* ---------------------------------------------------------------- Lesson 2 */
    {
      id: "ch00-l2",
      title: "The numbers and the map",
      goal: "Work out the assumed traffic model from two numbers and find the right chapter for a real problem.",
      minutes: 8,
      steps: [
        {
          kind: "number",
          prompt: "Predict first. At a big simulcast premiere the course assumes about **2M concurrent streams** at an average of about **4 Mbps** each. What is the peak egress?",
          answer: 8,
          tolerance: 0.5,
          unit: "Tbps",
          hint: "2,000,000 x 4 Mbps = 8,000,000 Mbps. One Tbps is 1,000,000 Mbps.",
          explain: "2M streams x 4 Mbps = 8,000,000 Mbps = **8 Tbps**. The model then designs for about **12 Tbps**, to leave headroom above the biggest premiere. This one multiplication, peak concurrent streams times bitrate, is the number that sizes delivery.",
        },
        {
          kind: "number",
          prompt: "The model assumes about **300M streaming hours a month** at about **4 Mbps**. How many petabytes is that per month?",
          answer: 540,
          tolerance: 30,
          unit: "PB",
          hint: "4 Mbps is 0.5 MB per second. One hour is 3,600 seconds, so one hour is about 1.8 GB.",
          explain: "4 Mbps = 0.5 MB/s. One hour = 3,600 s x 0.5 MB = **1.8 GB**. Then 300M hours x 1.8 GB = 540M GB = **540 PB** a month. Watch the units: bits (b) on the network, bytes (B) on disk, 8 bits per byte.",
        },
        {
          kind: "read",
          title: "The assumed traffic model",
          body: "Every chapter uses the same numbers, so the math connects from chapter to chapter. You just derived two of them: **8 Tbps** at peak and **540 PB** a month.\n\nNote the target [[cache hit ratio|CHR (cache hit ratio)]]: it is measured **by bytes**, and a warm simulcast episode should be served almost entirely from cache.",
          visual: {
            kind: "table",
            headers: ["Quantity", "Assumed value"],
            rows: [
              ["Users", "100M+ registered (job posting); about 21M paid subscribers (announced May 2026, up from 17M in 2025)"],
              ["Monthly streaming hours", "~300M hours"],
              ["Average delivered bitrate", "~4 Mbps"],
              ["Normal evening peak", "~1M concurrent streams"],
              ["Big simulcast premiere", "~2M concurrent streams, ramping within minutes"],
              ["Peak egress", "~8 Tbps (2M x 4 Mbps), design for ~12 Tbps"],
              ["Monthly delivered bytes", "~540 PB"],
              ["Segment length (VOD)", "~4-6 seconds"],
              ["Target cache hit ratio", "95%+ by bytes for VOD, near 100% for a warm simulcast episode"],
            ],
            caption: "Assumed values, a whiteboard model. Not company data.",
          },
        },
        {
          kind: "number",
          prompt: "How good is the model? Crunchyroll's own engineering blog reported more than **2 billion minutes** watched per month in 2020 (Chapter 17). How many **millions of hours** a month is that?",
          answer: 33,
          tolerance: 2,
          unit: "M hours",
          hint: "Divide minutes by 60.",
          explain: "2,000,000,000 / 60 = about **33M hours** a month in 2020. Paid subscribers have grown roughly sevenfold since then, and the free tier has ended. So **~300M hours** is a deliberately generous upper bound, not a measured figure. Designing for headroom is the point. Replace it with the real number in your first week.",
        },
        {
          kind: "quiz",
          prompt: "Someone says \"Crunchyroll has 200+ million users.\" You need to size the delivery platform. Which number matters?",
          visual: {
            kind: "stats",
            items: [
              { value: "100M+", label: "fans", note: "in 200+ countries and territories (job posting)" },
              { value: "~21M", label: "paid subscribers", note: "2026" },
              { value: "~2M", label: "concurrent streams", note: "assumed, big premiere" },
            ],
          },
          options: [
            "200M+ users, because more users means more traffic",
            "About 21M paid subscribers, because only they stream",
            "Peak concurrent streams times bitrate",
            "200+ countries and territories, because each needs its own servers",
          ],
          answer: 2,
          explain: "The job posting itself says **100M+ fans in 200+ countries and territories**, and paid subscribers are far fewer, about **21 million** in 2026. But for delivery design the number that matters is not users at all. It is **peak concurrent streams times bitrate**, and that is what the assumed model is built on.",
        },
        {
          kind: "read",
          title: "The map: six parts",
          body: "The course has six parts, and they build on each other. There are three ways to read it:\n\n- **Straight through** the first time.\n- **Before your first day (one weekend):** Chapters 1, 5, 6, 9, 13 and 18. These six give you the shape of the job.\n- **By problem:** jump to the chapter for the problem you have today. Try it in the next step.",
          visual: {
            kind: "table",
            headers: ["Part", "Chapters", "What you learn"],
            rows: [
              ["I. The whole picture", "1 The Big Picture", "Every component from studio file to screen, control plane vs bytes path, scale numbers"],
              ["II. Foundations", "2 Internet and Networking, 3 DNS and Traffic Steering, 4 HTTP, TLS and Caching", "BGP, peering, anycast, TCP and QUIC; resolvers, GSLB, ECS; Cache-Control, range requests, TLS 1.3"],
              ["III. The delivery stack", "5 Inside a CDN, 6 Origin, Shield and Replication, 7 Encoding and Packaging, 8 Content Protection", "PoPs, eviction, request collapsing, purge, Fastly and CloudFront internals; multi-cloud origins and shields; HLS, DASH, CMAF; DRM, signed URLs, geo-licensing"],
              ["IV. Steering and the client", "9 Multi-CDN and Steering, 10 Players, ABR and QoE", "Choosing a CDN per request by performance, availability and cost; what the player does and how it measures you"],
              ["V. Running it", "11 Observability, 12 Reliability and Failover, 13 Simulcast and Spike Scale, 14 IaC and Edge Config, 15 Security, 16 Economics", "Datadog, SLOs, logs and RUM; failure modes and famous outages; premieres and live events; Terraform and edge code; DDoS, WAF, origin protection; what every terabyte costs"],
              ["VI. Putting it together", "17 How the Giants Deliver, 18 Capstone, 19 Thinking Like a Staff Engineer", "Netflix, YouTube, Prime Video, Disney+, Hotstar and Crunchyroll side by side; a full design doc; mental models, interview problems, glossary"],
            ],
            caption: "The six parts of the course.",
          },
        },
        {
          kind: "match",
          prompt: "Reading by problem: match each problem to the chapter(s) to open first.",
          pairs: [
            ["A CDN vendor is having an outage", "Chapter 12"],
            ["A big premiere is coming up", "Chapter 13"],
            ["Rebuffering in one country", "Chapters 10 and 11"],
            ["A new CDN to onboard", "Chapters 9 and 14"],
            ["The bill is too high", "Chapter 16"],
          ],
          explain: "A vendor outage is **Reliability and Failover** (12). A premiere is **Simulcast and Spike Scale** (13). Rebuffering in one country needs **Players, ABR and QoE** (10) plus **Observability** (11). Onboarding a CDN is **Multi-CDN and Steering** (9) plus **IaC and Edge Config** (14). A high bill is **Economics** (16). One more: a design review tomorrow means Chapters **18 and 19**.",
        },
        {
          kind: "read",
          title: "How each chapter is built",
          body: "**Bold terms** are defined the first time they appear. Tap a linked term to see its definition; Chapter 19 has the full glossary.\n\nFour kinds of box carry the deeper insight. Here they appear as colored notes under a step.\n\n**Key takeaways** and **Check your understanding** (with answers) close every chapter; here they become the final **Checkpoint** lesson. Each chapter also lists its **Sources**: RFCs, vendor docs, engineering blogs, papers and talks. Scale numbers carry their year, because they change fast.",
          visual: {
            kind: "table",
            headers: ["Box", "What it holds"],
            rows: [
              ["Staff lens", "Design judgment, trade-offs, and the questions a staff engineer asks in review"],
              ["Common mistake", "What goes wrong in real systems"],
              ["In industry", "Real published systems, always with a year"],
              ["At Crunchyroll", "How the topic applies to the Media Delivery team: cited when public, marked as assumed when not"],
            ],
            caption: "The four kinds of box.",
          },
          callout: { type: "mistake", text: "Putting a specific vendor setting into production because a book or course said so. Vendors change their products often. Check the current docs first." },
        },
        {
          kind: "summary",
          points: [
            "The number that sizes delivery is peak concurrent streams times bitrate: 2M x 4 Mbps = 8 Tbps, design for about 12 Tbps.",
            "300M hours a month at 4 Mbps is about 540 PB a month. One hour at 4 Mbps is about 1.8 GB.",
            "300M hours is a generous upper bound: the 2020 blog figure was about 33M hours. Replace it with real numbers when you have them.",
            "Crunchyroll has 100M+ fans and about 21M paid subscribers (2026), not 200M+ users.",
            "Six parts; read straight through, or Chapters 1, 5, 6, 9, 13, 18 in a weekend, or by problem.",
          ],
        },
      ],
    },
  ],
  // The front matter has no Sources list of its own; each later chapter lists its sources.
  sources: [],
};
export default chapter;
