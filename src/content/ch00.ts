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
      minutes: 8,
      steps: [
        {
          kind: "read",
          title: "Two seconds after Play",
          body: "Someone in Brazil presses Play on a new anime episode, one hour after it aired in Tokyo. About two seconds later, the video plays.\n\nThose two seconds hide a long chain of systems. This course is about that chain.\n\nBy the end of this lesson you will be able to name each link behind one press of Play, and explain why Crunchyroll's traffic makes a good teaching example.",
          visual: { kind: "flow", spec: chain(["pl"]), caption: "Only the player is visible to the viewer. Everything else is hidden." },
        },
        {
          kind: "read",
          title: "First half: ask and unlock",
          body: "Before any video arrives, the app asks for three things.\n\n- A **playback service** (a backend API) answers: what may this user watch, here and now?\n- A **[[manifest]]** is a small text file. It lists the video qualities, audio dubs and subtitles, and where each piece lives.\n- A **[[DRM]] license** holds the keys to decrypt the video. **DRM** (digital rights management) means the video is encrypted, so only allowed players can show it.\n\nThis half is small and fast. No video yet.",
          visual: { kind: "flow", spec: chain(["pl", "api", "man", "drm", "pl>api", "pl>man", "pl>drm"]), caption: "Steps 1 to 3: ask what you may watch, get the list of pieces, get the keys." },
        },
        {
          kind: "read",
          title: "Second half: pull the bytes",
          body: "Now the player pulls the video itself, in small pieces called **[[segments|Segment]]**. Each segment is a few seconds of video. The player asks for the next one every few seconds, for the whole episode.\n\nThe segments come from a **CDN edge server**. A **CDN** (content delivery network) is a company that runs servers in buildings close to viewers. For our viewer, the **[[edge]]** server is probably in a building in São Paulo, owned by a CDN company.",
          visual: { kind: "flow", spec: chain(["pl", "edge", "pl>edge"], ["pl>edge"]), caption: "Step 4: segments, every few seconds, from a nearby edge server." },
        },
        {
          kind: "read",
          title: "Who fills the edge",
          body: "The edge server keeps copies of segments. A store of copies kept close to where they are needed is called a **cache**.\n\nIf the edge has the segment, that is a **hit**, and it answers at once. If not, that is a **miss**: it asks a bigger **cache tier** behind it. If that misses too, the request goes all the way to **cloud storage** in another country.\n\nThink of a local shop, a regional warehouse, and the factory.",
          visual: { kind: "flow", spec: chain(["pl", "edge", "cache", "store", "pl>edge", "edge>cache", "cache>store"], ["pl>edge", "edge>cache", "cache>store"]), caption: "The bytes path: every few seconds, for the whole episode." },
        },
        {
          kind: "read",
          title: "Every link can break",
          body: "If any link in that chain is slow, the viewer sees a spinner. If one link breaks and nothing takes its place, the video does not play at all.\n\nThis course explains every link: how it works, how it fails, what it costs, and how the best streaming companies build it. It goes from zero to the level where you can lead a design review on it.",
          visual: { kind: "flow", spec: chain(), caption: "Seven boxes in two halves. Any one of them can cause the spinner." },
        },
        {
          kind: "read",
          title: "Where this course fits",
          body: "This is the fourth book in a series. The earlier handbooks cover ML data pipelines, storage and compute.\n\nThis one covers **delivery**: getting the bytes of a video from cloud storage to hundreds of millions of screens, fast, safely and cheaply.",
        },
        {
          kind: "reveal",
          prompt: "Recall, without scrolling back. After Play is pressed, what are the four things the app does? Say them in order, then reveal.",
          visual: { kind: "flow", spec: chain(["pl"]), caption: "Only the player is visible to the viewer. Everything else is hidden." },
          answer: "1. The app asks a **playback service** what this user may watch.\n\n2. It gets a **[[manifest|Manifest / playlist]]** that lists the qualities, dubs and subtitles.\n\n3. It gets a **[[DRM]] license**, so it can decrypt the video.\n\n4. Then it pulls small video **[[segments|Segment]]**, every few seconds, from a server that is probably in a building in São Paulo, owned by a CDN company. That server was filled from a cache tier, which was filled from cloud storage in another country.",
        },
        {
          kind: "order",
          prompt: "A viewer presses Play. Put what the app does in order.",
          items: [
            "Ask the playback service what this user may watch",
            "Get the manifest: the list of qualities, dubs and subtitles",
            "Get the DRM license with the keys to decrypt",
            "Pull video segments from the CDN edge, every few seconds",
          ],
          teach: "The chain has two halves. First the app asks and unlocks; only then does it pull the bytes. In the first half, start with permission, then find out what pieces exist, then get what you need to open them.",
          explain: "First **ask** (may I watch?), then the **manifest** (what pieces exist?), then the **license** (the keys to open them), and only then the **segments**, every few seconds, from the edge. If the edge misses, a cache tier fills it, and behind that, cloud storage.",
        },
        {
          kind: "widget",
          widget: "playground",
          title: "A first look at the whole system",
          task: "Press Play on a new episode and watch the request travel. Do \"A cache hit\", then \"A miss the shield catches\" (a shield is the cache tier behind the edge). For each one, follow the boxes the request passes through. Do not worry about the details yet: this is the book's Chapter 18 design, and the course builds it up one part at a time.",
          props: { scenario: 1 },
        },
        {
          kind: "read",
          title: "The team this course follows",
          body: "The course follows Crunchyroll's **Media Delivery** team (Video Platform Engineering), as described in its public job posting.\n\nThe team owns global CDN networks, cloud **[[origins|Origin]]** on AWS and GCP, content replication pipelines, and the delivery services between them. An **origin** is the system that holds the master copy of every file; caches fill from it.\n\nSo every chapter ends with one question: \"what does this mean at Crunchyroll?\"",
        },
        {
          kind: "read",
          title: "A traffic shape with spikes",
          body: "Crunchyroll is also a good teaching example, because its traffic has an unusual shape.\n\nMost streaming services spread their load over the day, like a road with steady traffic. Crunchyroll has **[[simulcast]]**: new episodes of popular shows go out worldwide shortly after the Japanese broadcast, at a fixed time. Millions press play in the same few minutes, on content no cache has ever seen.\n\nSo it gets a synchronized spike every week, many times a week. Think of a stadium emptying onto one road.",
        },
        {
          kind: "read",
          title: "Four traits that shape delivery",
          body: "Simulcast is one of four traits. Two new words for the table:\n\n- The **[[long tail]]** is the large part of a catalog that is watched rarely. The small, popular part is the **hot head**.\n- A **track** is one version of the picture, sound or text: one video quality, one audio dub, or one subtitle language.\n\nRead the last column closely. It says what each trait does to delivery.",
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
          teach: "For each situation, ask what it is really about: when people watch, which content gets watched, how many versions of one episode exist, or where the viewer is.",
          explain: "**[[Simulcast]]** creates a synchronized spike on content no cache has seen. The **[[long tail|Long tail]]** is watched rarely, so it decides how hard the [[origin|Origin]] works. Each extra **track** multiplies storage and splits the cache. **Licensing** is per territory and per time window, so geo-rules sit right in the delivery path.",
        },
        {
          kind: "read",
          title: "A note on honesty",
          body: "Crunchyroll publishes little about its internals. Where the course states a Crunchyroll fact, it is cited. Where it does not know, it says \"a platform like Crunchyroll would likely...\" or it uses the **assumed traffic model** from the next lesson.\n\nTreat the assumptions as a whiteboard model, not as company data. Your first weeks on the team will replace them with real numbers.",
          callout: { type: "crunchyroll", text: "Anything not published is labelled \"assumed\" or \"likely\" in this course. When you see those words, read the number as a model to check, not a fact to repeat." },
        },
        {
          kind: "quiz",
          prompt: "Chapter 1 says: \"A platform like Crunchyroll would likely receive a simulcast episode from the licensor close to broadcast time.\" How should you treat this sentence?",
          options: [
            "As a published Crunchyroll fact you can repeat in a meeting",
            "As a reasonable model to check against real data once you join",
            "As an error, because the course should only state facts",
          ],
          answer: 1,
          teach: "The course makes two kinds of statement about Crunchyroll: cited facts, and model statements marked with special words. Look at which kind of word this sentence uses.",
          explain: "\"Likely\" marks a **model**, not company data. It is a sensible starting point for a whiteboard, so it is not an error. But you check it before you repeat it: your first weeks on the team replace it with the real answer.",
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
      minutes: 10,
      steps: [
        {
          kind: "read",
          title: "Size before you design",
          body: "Before you design a delivery system, you need to know how big it must be. A bridge engineer first asks how heavy the busiest traffic gets.\n\nThis lesson gives you the course's numbers. You will work out the two biggest ones yourself, with one multiplication each, and check how far to trust them. Then you will learn the map of the course.\n\nBy the end you can size delivery from two numbers and find the right chapter for a real problem.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. Someone says \"Crunchyroll has 200+ million users.\" You have to decide how big the delivery system must be. What would you expect to matter most?",
          options: [
            "How many accounts exist in total",
            "How many people watch at the same moment, and how much data each one pulls per second",
            "How many episodes are in the catalog",
            "How many countries the service is sold in",
          ],
          answer: 1,
          explain: "A road is built for rush hour, not for the number of cars registered in the city. Delivery is the same. What loads the servers is the people watching **right now**, each pulling a steady stream of data. An account that is not watching costs nothing to deliver. In the next steps you turn this idea into one number.",
        },
        {
          kind: "read",
          title: "Four words for size",
          body: "- **Bitrate** is how much data a video needs per second, counted in bits. **Mbps** means megabits (millions of bits) per second.\n- **Concurrent streams** are videos playing at the same moment.\n- **[[Egress]]** is the data leaving your servers toward viewers. **Peak egress** is the most egress at any one moment.\n- **Tbps** means terabits per second. 1 Tbps = 1,000,000 Mbps.",
        },
        {
          kind: "read",
          title: "Worked example: peak egress",
          body: "The rule is one line:\n\n**peak egress = peak concurrent streams x average bitrate**\n\nTry it on a smaller event: 500,000 concurrent streams at 3 Mbps each.\n\n- 500,000 x 3 Mbps = 1,500,000 Mbps\n- 1,500,000 Mbps / 1,000,000 = **1.5 Tbps**\n\nThis one multiplication is the number that sizes delivery. Next, you do it with the course's numbers.",
        },
        {
          kind: "number",
          prompt: "At a big simulcast premiere the course assumes about **2M concurrent streams** at an average of about **4 Mbps** each. What is the peak egress?",
          answer: 8,
          tolerance: 0.5,
          unit: "Tbps",
          teach: "Use the rule from the worked example: concurrent streams times bitrate gives you Mbps. Then divide by 1,000,000 to turn Mbps into Tbps.",
          hint: "2,000,000 x 4 Mbps = 8,000,000 Mbps. One Tbps is 1,000,000 Mbps.",
          explain: "2M streams x 4 Mbps = 8,000,000 Mbps = **8 Tbps**. The model then designs for about **12 Tbps**, to leave headroom above the biggest premiere. This one multiplication, peak concurrent streams times bitrate, is the number that sizes delivery.",
        },
        {
          kind: "read",
          title: "Design for more than the peak",
          body: "The biggest premiere needs about **8 Tbps**. The course designs for about **12 Tbps**.\n\nThe gap is **headroom**: spare capacity above the biggest load you expect. It covers surprises, like a bigger crowd than planned, a failure that pushes traffic onto fewer servers, or growth.\n\nA lift rated for exactly 8 people should not be the one you squeeze 9 into.",
        },
        {
          kind: "read",
          title: "Worked example: bytes in a month",
          body: "Storage and bills count **bytes**, not bits. **1 byte = 8 bits**, so divide by 8. 1 **GB** is 1,000 MB, and 1 **PB** (petabyte) is 1,000,000 GB.\n\nExample: 10M hours a month at 2 Mbps.\n\n- 2 Mbps / 8 = 0.25 MB per second\n- One hour = 3,600 s x 0.25 MB = 900 MB = 0.9 GB\n- 10M hours x 0.9 GB = 9M GB = **9 PB** a month",
        },
        {
          kind: "number",
          prompt: "The model assumes about **300M streaming hours a month** at about **4 Mbps**. How many petabytes is that per month?",
          answer: 540,
          tolerance: 30,
          unit: "PB",
          teach: "Follow the worked example. Find the bytes in one hour first: bitrate divided by 8 gives MB per second, times 3,600 seconds. Then multiply by the hours, and turn GB into PB.",
          hint: "4 Mbps is 0.5 MB per second. One hour is 3,600 seconds, so one hour is about 1.8 GB.",
          explain: "4 Mbps = 0.5 MB/s. One hour = 3,600 s x 0.5 MB = **1.8 GB**. Then 300M hours x 1.8 GB = 540M GB = **540 PB** a month. Watch the units: bits (b) on the network, bytes (B) on disk, 8 bits per byte.",
        },
        {
          kind: "read",
          title: "The assumed traffic model",
          body: "Every chapter uses the same numbers, so the math connects from chapter to chapter. You just derived two of them: **8 Tbps** at peak and **540 PB** a month.\n\nTwo terms in the table. **VOD** (video on demand) is any episode you can start whenever you like. The **[[cache hit ratio]]** is the share of data served straight from cache, without a trip to the origin. Here it is measured **by bytes**, and a warm simulcast episode (already in the caches) should come almost entirely from cache.",
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
          kind: "read",
          title: "Check the model: minutes to hours",
          body: "A model is only useful if you check it against real numbers. Public figures often come as **minutes watched**. To compare them with the model, turn minutes into hours: **divide by 60**.\n\nExample: 600M minutes a month / 60 = **10M hours** a month.\n\nCrunchyroll's own engineering blog gives one such public number. You convert it in the next step.",
        },
        {
          kind: "number",
          prompt: "How good is the model? Crunchyroll's own engineering blog reported more than **2 billion minutes** watched per month in 2020 (Chapter 17). How many **millions of hours** a month is that?",
          answer: 33,
          tolerance: 2,
          unit: "M hours",
          teach: "An hour has 60 minutes, so divide the minutes by 60. It helps to write 2 billion as 2,000 million first.",
          hint: "Divide minutes by 60.",
          explain: "2,000,000,000 / 60 = about **33M hours** a month in 2020. Paid subscribers have grown roughly sevenfold since then, and the free tier has ended. So **~300M hours** is a deliberately generous upper bound, not a measured figure. Designing for headroom is the point. Replace it with the real number in your first week.",
        },
        {
          kind: "read",
          title: "Users are not load",
          body: "Back to the opening claim of \"200+ million users.\" The job posting itself says **100M+ fans in 200+ countries and territories**. Paid subscribers are far fewer: about **21 million** in 2026.\n\nBut for delivery design, the number that matters is not users at all. Like the road built for rush hour, delivery is sized by **peak concurrent streams times bitrate**. That is what the assumed model is built on.",
          visual: {
            kind: "stats",
            items: [
              { value: "100M+", label: "fans", note: "in 200+ countries and territories (job posting)" },
              { value: "~21M", label: "paid subscribers", note: "2026" },
              { value: "~2M", label: "concurrent streams", note: "assumed, big premiere" },
            ],
          },
        },
        {
          kind: "read",
          title: "The map: six parts",
          body: "The course has six parts, and they build on each other. Each chapter's title names the problem it covers, so the map is also an index.\n\nThe last column is full of words you do not know yet, like BGP or CMAF. That is expected: each one is taught in its own chapter.",
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
          kind: "read",
          title: "Three ways to read it",
          body: "- **Straight through** the first time. Parts build on each other.\n- **Before your first day (one weekend):** Chapters 1, 5, 6, 9, 13 and 18. These six give you the shape of the job.\n- **By problem:** open the chapter whose title names the problem you have today. Example: a design review tomorrow → Chapter 18 (the capstone design) and Chapter 19 (thinking like a staff engineer).\n\nSome problems need two chapters: one to understand the problem, and one to see it or act on it.",
        },
        {
          kind: "read",
          title: "Four words from the chapter titles",
          body: "- **Rebuffering** means the video stops to load more data, and the spinner appears.\n- **[[QoE]]** (quality of experience) is how good playback feels to the viewer: fast start, no stalls, sharp picture.\n- **Observability** is seeing what your system is doing, through metrics, logs and dashboards.\n- **IaC** (infrastructure as code) means setting up servers and CDN settings from code files instead of clicking in a console.",
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
          teach: "Use the chapter titles in the six-part map. Pick the chapter whose title names the problem. Where two chapters are needed, one explains the problem and the other lets you see it or configure it.",
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
