import type { Chapter, FlowSpec, SequenceSpec, Visual } from "./types";

// Chapter 13. Source: chapters/13-simulcast-and-spike-scale.md

/* ---------------- Shared visuals ---------------- */

/** 13.4.4: three CDNs, each with its own shield, plus the pre-warm job. */
const HERD: FlowSpec = {
  nodes: [
    { id: "u", label: "1M players", sub: "start within minutes", kind: "viewer", col: 0, row: 2 },
    { id: "e1", label: "CDN A edges", kind: "edge", col: 1, row: 0 },
    { id: "e2", label: "CDN B edges", kind: "edge", col: 1, row: 2 },
    { id: "e3", label: "CDN C edges", kind: "edge", col: 1, row: 4 },
    { id: "s1", label: "CDN A shield", kind: "shield", col: 3, row: 0 },
    { id: "s2", label: "CDN B shield", kind: "shield", col: 3, row: 2 },
    { id: "s3", label: "CDN C shield", kind: "shield", col: 3, row: 4 },
    { id: "o", label: "Origin", sub: "S3 and GCS", kind: "origin", col: 5, row: 2 },
    { id: "w", label: "Pre-warm job", sub: "T minus 20 min", kind: "service", col: 2, row: 5 },
  ],
  edges: [
    { from: "u", to: "e1" },
    { from: "u", to: "e2" },
    { from: "u", to: "e3" },
    { from: "e1", to: "s1", label: "collapse per PoP" },
    { from: "e2", to: "s2", label: "collapse per PoP" },
    { from: "e3", to: "s3", label: "collapse per PoP" },
    { from: "s1", to: "o", label: "1 miss/object" },
    { from: "s2", to: "o", label: "1 miss/object" },
    { from: "s3", to: "o", label: "1 miss/object" },
    { from: "w", to: "s1", dashed: true },
    { from: "w", to: "s2", dashed: true },
    { from: "w", to: "s3", dashed: true },
  ],
};
const herd = (focus?: string[], flow?: string[], caption?: string): Visual => ({
  kind: "flow",
  spec: { ...HERD, focus, flow },
  caption,
});

/** 13.4.4: one shared shield used as the origin for every CDN. */
const SHARED: FlowSpec = {
  nodes: [
    { id: "a", label: "CDN A edges", kind: "edge", col: 1, row: 1 },
    { id: "b", label: "CDN B edges", kind: "edge", col: 1, row: 3 },
    { id: "c", label: "CDN C edges", kind: "edge", col: 1, row: 5 },
    { id: "ss", label: "Shared shield", sub: "CloudFront + Origin Shield", kind: "shield", col: 3, row: 3, tone: "accent" },
    { id: "o", label: "Origin", sub: "expensive: JIT or live", kind: "origin", col: 5, row: 3 },
  ],
  edges: [
    { from: "a", to: "ss" },
    { from: "b", to: "ss" },
    { from: "c", to: "ss" },
    { from: "ss", to: "o", label: "1 miss/object" },
    { from: "a", to: "o", label: "fallback", dashed: true },
    { from: "c", to: "o", label: "fallback", dashed: true },
  ],
};

/** 13.3.1: staged publish. */
const STAGED: SequenceSpec = {
  actors: [
    { id: "p", label: "Packaging", kind: "packager" },
    { id: "o", label: "Origins AWS + GCP", kind: "origin" },
    { id: "s", label: "CDN shields", kind: "shield" },
    { id: "c", label: "Catalog + API", kind: "api" },
    { id: "u", label: "Players", kind: "player" },
  ],
  messages: [
    { from: "p", to: "o", label: "Upload segments, verify replication" },
    { from: "p", to: "o", label: "Upload media, then master playlists" },
    { from: "o", to: "s", label: "Warm-up fetches for first segments", dashed: true },
    { from: "c", to: "u", label: "Episode visible, URLs issued", note: "T0: flip visibility", tone: "accent" },
    { from: "u", to: "s", label: "Requests hit warm shield, not origin", tone: "good" },
  ],
};
const staged = (upTo?: number, caption?: string): Visual => ({ kind: "sequence", spec: { ...STAGED, upTo }, caption });

/** 13.6.1: one playback start through the control plane. */
const CP: SequenceSpec = {
  actors: [
    { id: "u", label: "Player", kind: "player" },
    { id: "a", label: "Auth service", kind: "service" },
    { id: "p", label: "Playback API", kind: "api" },
    { id: "e", label: "CDN edge", kind: "edge" },
    { id: "l", label: "DRM license", kind: "drm" },
  ],
  messages: [
    { from: "u", to: "a", label: "Refresh session token" },
    { from: "a", to: "u", label: "New token", dashed: true },
    { from: "u", to: "p", label: "Request playback for episode" },
    { from: "p", to: "u", label: "Entitlement OK, manifest URL, CDN choice", dashed: true },
    { from: "u", to: "e", label: "Fetch playlists" },
    { from: "e", to: "u", label: "Playlists from cache", dashed: true, tone: "good" },
    { from: "u", to: "l", label: "License request" },
    { from: "l", to: "u", label: "Content keys", dashed: true },
    { from: "u", to: "e", label: "Fetch first segments" },
    { from: "e", to: "u", label: "Segments from warm cache", dashed: true, tone: "good" },
  ],
};
const cp = (upTo?: number, caption?: string): Visual => ({ kind: "sequence", spec: { ...CP, upTo }, caption });

/** 13.7.1: redundant live pipelines. */
const LIVE: FlowSpec = {
  nodes: [
    { id: "v", label: "Venue feed", kind: "studio", col: 0, row: 1 },
    { id: "i1", label: "Ingest region 1", kind: "region", col: 1, row: 0 },
    { id: "i2", label: "Ingest region 2", kind: "region", col: 1, row: 2 },
    { id: "p1", label: "Encode + package 1", kind: "packager", col: 2, row: 0 },
    { id: "p2", label: "Encode + package 2", kind: "packager", col: 2, row: 2 },
    { id: "lo", label: "Live origin", sub: "picks either", kind: "origin", col: 3, row: 1 },
    { id: "sh", label: "Shields", kind: "shield", col: 4, row: 1 },
    { id: "cd", label: "CDN edges", kind: "edge", col: 5, row: 1 },
    { id: "pl", label: "Players", sub: "at the live edge", kind: "player", col: 5, row: 2 },
  ],
  edges: [
    { from: "v", to: "i1" },
    { from: "v", to: "i2" },
    { from: "i1", to: "p1" },
    { from: "i2", to: "p2" },
    { from: "p1", to: "lo" },
    { from: "p2", to: "lo" },
    { from: "lo", to: "sh" },
    { from: "sh", to: "cd" },
    { from: "cd", to: "pl" },
  ],
};
const live = (focus?: string[], flow?: string[], caption?: string): Visual => ({
  kind: "flow",
  spec: { ...LIVE, focus, flow },
  caption,
});

/** 13.9.3: the premiere loop. */
const LOOP: FlowSpec = {
  nodes: [
    { id: "f", label: "Forecast", sub: "per region", kind: "monitor", col: 0, row: 0 },
    { id: "v", label: "Capacity confirmed", sub: "with vendors", kind: "cdn", col: 1, row: 0 },
    { id: "p", label: "Episode ready", sub: "replicated", kind: "packager", col: 2, row: 0 },
    { id: "z", label: "Config freeze", sub: "CDN + edge code", kind: "generic", col: 3, row: 0 },
    { id: "s", label: "Scale-up", sub: "control plane", kind: "service", col: 4, row: 0 },
    { id: "w", label: "Shield pre-warm", sub: "on all CDNs", kind: "shield", col: 5, row: 0 },
    { id: "t", label: "T0 flip", sub: "visibility", kind: "api", col: 5, row: 2, tone: "accent" },
    { id: "m", label: "Watch the numbers", sub: "vs forecast", kind: "monitor", col: 3, row: 2 },
    { id: "r", label: "Review", sub: "feeds next forecast", kind: "generic", col: 1, row: 2 },
  ],
  edges: [
    { from: "f", to: "v" },
    { from: "v", to: "p" },
    { from: "p", to: "z" },
    { from: "z", to: "s" },
    { from: "s", to: "w" },
    { from: "w", to: "t" },
    { from: "t", to: "m" },
    { from: "m", to: "r" },
    { from: "r", to: "f" },
  ],
};

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 13,
  title: "Simulcast, Live Events and Spike-Scale Delivery",
  short: "Simulcast scale",
  part: 5,
  hook: "Two million people press play in the same minute on a file no cache has seen yet. Now what?",
  lessons: [
    /* ======================= Lesson 1 ======================= */
    {
      id: "ch13-l1",
      title: "A wall, not a hill",
      goal: "Explain why a simulcast premiere is a flash crowd, name the three kinds of spike, and read the public record of big events with care.",
      minutes: 9,
      steps: [
        {
          kind: "quiz",
          prompt: "Night A: 2M people watch across the whole catalog, building up slowly over the evening. Night B: 1M people press play on one brand-new episode at 17:00 sharp. Which night is harder for the delivery team?",
          options: [
            "Night A, because it has twice the viewers",
            "Night B, because every cache is cold and everyone arrives in the same minutes",
            "They are the same, because only bytes per second matter",
            "Night A, because the long tail has the worst hit ratio",
          ],
          answer: 1,
          explain: "Night B. The evening peak builds slowly, is spread over many titles and runs on warm caches. The premiere puts everyone on one new title: every cache is cold in the same second, start and sign-in rates are very high, and any error triggers synchronized retries.",
        },
        {
          kind: "read",
          title: "A hill and a wall",
          body: "Most delivery systems are built for a smooth daily curve. Traffic rises in the evening and falls at night. The cache stays warm because the same titles are watched all day.\n\nA premiere breaks this picture. At one exact minute, hundreds of thousands of people press play on an episode that was in no CDN cache a moment ago. Fans have waited a week, and social media is full of spoilers. Nobody wants to wait. The traffic does not rise like a hill. It rises like a **wall**.",
        },
        {
          kind: "read",
          title: "What simulcast means for delivery",
          body: "In anime, **[[simulcast]]** means a new episode is released worldwide shortly after it airs on Japanese TV, at a fixed, published time. Three things matter for delivery:\n- **The time is fixed and public.** Fans know the exact minute. Apps may show a countdown.\n- **The episode is new.** No CDN edge has it cached. Every cache in the world starts cold at the same moment.\n- **Demand is concentrated.** For a few minutes, one episode replaces the [[long tail]] of the catalog.",
        },
        {
          kind: "multi",
          prompt: "Which of these make a simulcast premiere special for the delivery team? Select all that apply.",
          options: [
            "The release time is fixed and public",
            "No CDN edge has the episode cached at release",
            "Many viewers want one episode right now",
            "Premiere episodes are much longer than normal ones",
            "Fans watch premieres on slower networks",
          ],
          answers: [0, 1, 2],
          explain: "The three facts are a fixed public time, a brand-new episode (so every cache is cold at once) and demand concentrated on one title. Episode length and network speed are not what make a premiere different.",
        },
        {
          kind: "read",
          title: "The flash crowd",
          body: "Together these create a **flash crowd**: a very large number of clients arriving in a very short time, all asking for the same few objects.\n\nA normal evening peak arrives slowly and is spread over thousands of titles. A flash crowd is the opposite on both axes: it arrives at once, and it asks for one title.",
          visual: {
            kind: "compare",
            left: { title: "Evening peak", points: ["Builds over hours", "Spread over thousands of titles", "Caches already warm"] },
            right: { title: "Flash crowd", points: ["Arrives in minutes", "Concentrated on one episode", "Every cache cold at T0"] },
          },
        },
        {
          kind: "read",
          title: "The public record: January 2022",
          body: "On January 9, 2022, Crunchyroll and Funimation went down minutes after the *Attack on Titan* Final Season Part 2 premiere. Anime Corner reported the crash at 12:45 pm PST, and that Crunchyroll acknowledged it nearly an hour later.\n\nRepublic World reported 502 errors on login. It cited Downdetector data: about 44% of reported problems were sign-in, 29% buffering and 16% crashing.",
          visual: {
            kind: "stats",
            items: [
              { value: "44%", label: "Sign-in", note: "control plane" },
              { value: "29%", label: "Buffering", note: "data plane" },
              { value: "16%", label: "Crashing" },
            ],
            caption: "Downdetector problem reports, January 2022, as cited by Republic World.",
          },
        },
        {
          kind: "quiz",
          prompt: "Look at the Downdetector split. Which part of the system does the largest category point to?",
          options: [
            "The CDN data plane that serves segments",
            "The control plane: sign-in and sessions",
            "The video encoder",
            "Viewers' home Wi-Fi",
          ],
          answer: 1,
          explain: "Sign-in was 44%, more than buffering at 29%. Signing in is [[control plane]] work: user-specific and not cacheable. No root cause was published, so this is a pattern, not a diagnosis.",
        },
        {
          kind: "read",
          title: "More release-minute failures",
          body: "On November 5, 2023, before the *Attack on Titan* finale at 5 p.m. PT, Crunchyroll posted that the site had intermittent issues. In August 2023, fans reported failures on *One Piece* episode 1071.\n\nNo root cause has been published for any of these, so we will not guess at internals. But notice the shape.",
          callout: {
            type: "crunchyroll",
            text: "The public record shows the pain is real. Problems cluster at release minutes, and sign-in (the [[control plane]]) is as visible as buffering (the [[data plane]]).",
          },
        },
        {
          kind: "read",
          title: "Three kinds of spike",
          body: "The bottleneck moves with the type of spike. So first ask: which kind is coming?",
          visual: {
            kind: "table",
            headers: ["Spike type", "Example", "Content before T0?", "Viewers in the stream", "Main risk"],
            rows: [
              ["VOD premiere (simulcast)", "New anime episode", "Yes, fully packaged", "Spread over the first minutes", "Cold caches, start storm, 404s from early publish"],
              ["Live event", "Boxing, cricket, concert", "No, created every few seconds", "All at the live edge", "Origin read/write path, a mini-herd every segment, hot objects"],
              ["Live-to-VOD tail", "Replay after an event", "Yes, from the archive", "Spread", "DVR window size, archive reads"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each spike type to its main risk.",
          pairs: [
            ["VOD premiere", "Cold caches and 404s from early publish"],
            ["Live event", "A mini-herd at the live edge every segment"],
            ["Live-to-VOD tail", "DVR window size and archive reads"],
          ],
          explain: "A VOD premiere exists before T0 but every cache is cold. A live event creates new bytes every few seconds, and everyone wants the newest one. A live-to-VOD tail reads from the archive, so the DVR window and archive reads matter.",
        },
        {
          kind: "read",
          title: "Crunchyroll is a VOD premiere",
          body: "As far as public behaviour shows, Crunchyroll delivers simulcast episodes as normal on-demand titles that become visible at a fixed time.\n\nThat is good news. The files can be finished, checked and staged hours before release. True live is harder, because the bytes are created during the event (Lesson 6).",
        },
        {
          kind: "read",
          title: "How steep is the wall?",
          body: "Two public data points:\n- Hotstar's architects said at AWS re:Invent 2019 that traffic could grow by more than **1 million users per minute**. Peak concurrency reached **25.3 million** on July 10, 2019.\n- Netflix's Tom Brady roast had about **1.8 million** concurrent streams. The Jake Paul vs Mike Tyson fight on November 15, 2024 peaked at about **65 million**, as reported from Netflix data.",
          visual: {
            kind: "stats",
            items: [
              { value: "1M+/min", label: "Hotstar ramp", note: "users per minute, 2019" },
              { value: "25.3M", label: "Hotstar peak", note: "July 10, 2019" },
              { value: "1.8M to 65M", label: "Netflix live", note: "two events, one year" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "Netflix went from about 1.8M concurrent streams to about 65M within one year. Roughly how many times bigger was the second event?",
          answer: 36,
          tolerance: 2,
          unit: "x",
          explain: "65 / 1.8 ≈ 36. A 36x jump between two events in one year.",
        },
        {
          kind: "read",
          title: "The last event is a poor predictor",
          body: "The lesson: **the last event is a poor predictor of the next one.** One hit show can double a platform's concurrency.\n\nSo plan from a **forecast with an explicit error bar**, not from last week's graph.",
        },
        {
          kind: "read",
          title: "The record books",
          body: "The biggest events teach the same lessons again and again. Each row is a published peak and what is known about delivery. After the fight, a Netflix memo said: \"This unprecedented scale created many technical challenges\".",
          visual: {
            kind: "table",
            headers: ["Event", "Published peak", "What is published", "Lesson"],
            rows: [
              ["Hotstar, India vs NZ, World Cup semi, Jul 10, 2019", "25.3M concurrent", "1M+ req/s and 10 Tbps; capacity errors; pre-warming; load testing; panic mode", "Scale before, not during. Degrade features to save video."],
              ["JioCinema, IPL 2023 final", "3.21 crore (~32.1M)", "Company-reported, no technical detail", "Records keep rising; plans must too."],
              ["Disney+ Hotstar, 2023 World Cup", "61M+ (blog summary)", "Managed Kubernetes; CDN domain for cacheable APIs; NAT gateway at 50% bandwidth at 10% of peak", "Bottlenecks hide in boring places. Test the whole path."],
              ["Netflix, Paul vs Tyson, Nov 15, 2024", "~65M streams, 60M households", "Widespread buffering; no public root cause", "A 36x jump is a new system, not a forecast."],
              ["Super Bowl LIX on Tubi, Feb 9, 2025", "13.6M Tubi viewers (Fox)", "Free stream, no subscription wall", "Free events add sign-ups and anonymous traffic to the control plane."],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "Disney+ Hotstar found a NAT gateway using 50% of its bandwidth at only 10% of peak load. What is the lesson?",
          options: [
            "Bottlenecks hide in boring places, so test the whole path",
            "NAT gateways should be replaced by CDNs",
            "Managed Kubernetes cannot handle live sport",
            "Load tests are not useful at this scale",
          ],
          answer: 0,
          explain: "The NAT gateway is not a video component, yet at full scale it would have run out long before peak. Bottlenecks hide in boring places, so load test the whole path.",
        },
        {
          kind: "read",
          title: "Read these numbers with care",
          body: "- Most are **self-reported**. Some count viewers, some streams, some households. They are not directly comparable. Netflix also reported a 108M average minute audience for the fight, another measure again.\n- A summary of Netflix's Part 1 post reports synthetic load tests of up to 100,000 starts per second and a 10x retry effect. Treat these as reported.\n- Hotstar's 2019 figures come from a conference session summary, not a written postmortem.",
          callout: {
            type: "industry",
            text: "Teams that published success stories planned from an explicit forecast, scaled before the event, load tested the full path including third parties, prepared degradation switches, and practised failure. Teams that struggled met a scale they had never tested.",
          },
        },
        {
          kind: "read",
          title: "Smaller, but every week",
          body: "The assumed Crunchyroll premiere peak (~2M) is smaller than a World Cup. But it happens **every week**, for many shows, across every timezone.",
        },
        {
          kind: "reveal",
          prompt: "Is that weekly rhythm a weakness or an advantage for the delivery team? Think, then reveal.",
          answer: "An advantage. Every ordinary premiere is a rehearsal for the big one. A platform like Crunchyroll would likely record starts per second, origin requests in the first 2 minutes, shield hit ratio and license error rate for each premiere, and compare them with the forecast.",
        },
        {
          kind: "summary",
          points: [
            "A simulcast premiere is a **flash crowd**: fixed public time, brand-new title, demand concentrated on one episode.",
            "Public premiere outages (AoT 2022, AoT finale 2023, One Piece 1071) cluster at release minutes; sign-in was 44% of 2022 reports. No root cause was published.",
            "Three spike types: VOD premiere, live event, live-to-VOD tail. The bottleneck moves with the type.",
            "The last event is a poor predictor of the next one (Netflix: 1.8M to 65M). Plan from a forecast with an error bar.",
            "Published peaks are mostly self-reported and measure different things.",
          ],
        },
      ],
    },

    /* ======================= Lesson 2 ======================= */
    {
      id: "ch13-l2",
      title: "Spike math on one page",
      goal: "Work out starts per second, egress, request rates, the hot working set and a hot PoP's load from the book's assumed model.",
      minutes: 11,
      steps: [
        {
          kind: "number",
          prompt: "Guess first. A big premiere has about 2M concurrent streams at an average of about 4 Mbps. What is peak egress?",
          answer: 8,
          tolerance: 0.5,
          unit: "Tbps",
          explain: "2,000,000 x 4 Mbps = 8,000,000 Mbps = **8 Tbps**. All values in this lesson are the book's assumed Crunchyroll model.",
        },
        {
          kind: "read",
          title: "The traffic model",
          body: "All values in this lesson are **assumed** (the book's Crunchyroll model) unless a source is cited. Every later step uses these numbers.",
          visual: {
            kind: "table",
            headers: ["Quantity", "Assumed value"],
            rows: [
              ["Normal evening peak", "~1M concurrent streams across the catalog"],
              ["Big premiere peak", "~2M concurrent, about 1M extra on one episode"],
              ["Average delivered bitrate", "~4 Mbps"],
              ["Episode length", "24 min = 1,440 s"],
              ["VOD segment duration", "4 s"],
              ["Video renditions", "7"],
              ["Audio at premiere", "1 track (assume dubs arrive later)"],
            ],
          },
        },
        {
          kind: "read",
          title: "How the premiere viewers arrive",
          body: "Assume the 1M premiere viewers arrive in three waves. The first two minutes are the steepest part of the wall.",
          visual: {
            kind: "table",
            headers: ["Window", "New starts", "Average starts per second"],
            rows: [
              ["T0 to T+2 min", "300,000", "?"],
              ["T+2 to T+10 min", "400,000", "~830"],
              ["T+10 to T+30 min", "300,000", "250"],
            ],
            caption: "Assumed arrival model.",
          },
        },
        {
          kind: "number",
          prompt: "300,000 new starts arrive in the first 2 minutes. What is the average rate in starts per second?",
          answer: 2500,
          tolerance: 100,
          unit: "starts/s",
          explain: "2 minutes = 120 s. 300,000 / 120 = **2,500 starts/s**.",
        },
        {
          kind: "read",
          title: "The design peak",
          body: "Arrivals are bursty inside a window. If the busiest second is about 2x the window average, the design peak is **~5,000 starts per second**.\n\nIf something fails, clients retry and the attempted rate multiplies. A summary of Netflix's live posts reports a measured **10x** traffic increase caused by user retries.",
          visual: {
            kind: "stats",
            items: [
              { value: "2,500/s", label: "Average, first 2 min" },
              { value: "5,000/s", label: "Design peak", note: "busiest second ≈ 2x" },
              { value: "10x", label: "Retry effect", note: "reported by Netflix" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "A load test shows your system handles 5,000 starts/s. Why is that not the whole answer?",
          options: [
            "It must handle 5,000 starts/s and stay healthy; any failure makes retries multiply the rate",
            "Load tests always overstate capacity by 2x",
            "The design peak should be 2,500 starts/s, the window average",
            "Starts per second do not matter, only Tbps",
          ],
          answer: 0,
          explain: "The real question is not \"can we handle 5,000 starts/s\" but \"can we handle it **and stay healthy**, so retries never multiply it\". A 10x retry effect would turn 5,000 into 50,000 attempts.",
        },
        {
          kind: "read",
          title: "Egress: 8 Tbps, design for 12",
          body: "2M x 4 Mbps = **8 Tbps**. The design target is **~12 Tbps** (1.5x). The extra half covers:\n- forecast error,\n- a CDN failure that moves its share to the others (Lesson 5),\n- higher bitrates when big-TV viewers all pick 1080p.",
          visual: {
            kind: "stats",
            items: [
              { value: "8 Tbps", label: "Assumed peak egress" },
              { value: "12 Tbps", label: "Design target", note: "1.5x the peak" },
            ],
          },
        },
        {
          kind: "multi",
          prompt: "Which reasons does the 1.5x headroom (12 Tbps for an 8 Tbps peak) cover? Select all that apply.",
          options: [
            "The forecast could be wrong",
            "A CDN fails and its share moves to the others",
            "Big-TV viewers all pick 1080p, raising the average bitrate",
            "Storage replication between AWS and GCP",
            "Lowering the 95th-percentile bill",
          ],
          answers: [0, 1, 2],
          explain: "Headroom covers forecast error, a CDN failure that moves its share elsewhere, and higher bitrates. Replication and billing are separate concerns.",
        },
        {
          kind: "read",
          title: "Request rate",
          body: "With [[CMAF]] and separate audio, each viewer fetches one video [[segment]] and one audio segment every 4 s. That is **0.5 requests per second** per viewer.\n\nThe whole platform, at 2M viewers, makes **1M req/s**.",
        },
        {
          kind: "number",
          prompt: "The premiere episode alone has about 1M viewers at 0.5 requests per second each. How many requests per second does that episode create?",
          answer: 500000,
          tolerance: 20000,
          unit: "req/s",
          explain: "1M x 0.5 = **500,000 req/s** for the premiere episode. The whole platform: 2M x 0.5 = 1M req/s.",
        },
        {
          kind: "number",
          prompt: "Each new start pulls 3 video and 3 audio segments in its first 2 seconds to fill its buffer. At the design peak of 5,000 starts/s, how many extra requests per second does that add?",
          answer: 30000,
          tolerance: 1500,
          unit: "req/s",
          explain: "5,000 x 6 = **30,000 req/s**. Small next to 1M req/s of steady state.",
        },
        {
          kind: "read",
          title: "The start storm is not a request-rate problem",
          body: "30,000 req/s is small next to the steady state of 1M req/s. So the start storm is mainly a **cold-cache and control-plane** problem, not a CDN request-rate problem.\n\nThe rest of this chapter follows those two threads.",
        },
        {
          kind: "read",
          title: "CDN quotas exist",
          body: "From outside, a CDN looks infinite. Its account limits are not. CloudFront's documented default quotas are **150 Gbps** and **250,000 requests per second** per distribution. Both can be raised on request.",
          callout: {
            type: "industry",
            text: "Every CDN has some version of this. **CDN capacity for an event is arranged in advance**, never assumed.",
          },
        },
        {
          kind: "number",
          prompt: "If CloudFront carried a third of the 8 Tbps peak, roughly how many times the default 150 Gbps quota would that be?",
          answer: 18,
          tolerance: 1.5,
          unit: "x",
          explain: "8 / 3 ≈ 2.7 Tbps = about 2,700 Gbps. 2,700 / 150 ≈ **18x** the default.",
        },
        {
          kind: "read",
          title: "The working set",
          body: "How much data is actually hot? Assume a 7-rung ladder: 0.4, 0.8, 1.5, 2.5, 4, 6 and 8 Mbps.\n\nThe sum of the video bitrates is **23.2 Mbps**. The episode is 1,440 s long.",
        },
        {
          kind: "number",
          prompt: "All 7 video renditions of the episode: 23.2 Mbps x 1,440 s. About how many GB is that? (8 bits = 1 byte.)",
          answer: 4.2,
          tolerance: 0.3,
          unit: "GB",
          explain: "23.2 x 1,440 = 33,408 Mbit. Divide by 8: about 4,176 MB = **~4.2 GB** for every video rendition.",
        },
        {
          kind: "read",
          title: "Tiny, even with everything",
          body: "- One audio track at 128 kbps: 0.128 x 1,440 = 184 Mbit = **~23 MB**. Subtitles: a few hundred KB.\n- Segments per rendition: 1,440 / 4 = **360**. Media objects: 360 x 8 tracks = **2,880**.\n- Even with two encrypted copies ([[CENC]] `cenc` and `cbcs`), the total is **under 10 GB**. One cache server can hold it in RAM.",
          callout: {
            type: "staff",
            text: "A simulcast is not a storage problem and not a cache-capacity problem. The hot set fits in memory. It is a **coordination** problem: thousands of empty caches receive the first request for the same object in the same second. Every technique in this chapter turns \"thousands of first requests\" into \"one request per tier\".",
          },
        },
        {
          kind: "quiz",
          prompt: "One episode's hot set is under 10 GB. So what is the real problem at T0?",
          options: [
            "Coordination: thousands of empty caches get the first request for the same object at once",
            "Storage: origin buckets cannot hold new episodes",
            "Cache capacity: edges evict the new episode",
            "Encoding: the ladder has too many rungs",
          ],
          answer: 0,
          explain: "The bytes fit in one server's RAM. The hard part is that thousands of cold caches all ask for the same first objects in the same second. The goal is \"one request per tier\".",
        },
        {
          kind: "read",
          title: "Hot objects inside a PoP",
          body: "Inside a [[PoP]], CDNs usually map each object to one owner server with [[consistent hashing]]. In a flash crowd this can create a **hot object**: one object that one server must serve to a huge crowd.\n\nTake a big PoP serving 3% of the premiere audience (assumed): **30,000 viewers**.",
        },
        {
          kind: "number",
          prompt: "30,000 viewers in one PoP, each at about 4 Mbps. How much traffic does that PoP serve?",
          answer: 120,
          tolerance: 5,
          unit: "Gbps",
          explain: "30,000 x 4 Mbps = 120,000 Mbps = **120 Gbps**.",
        },
        {
          kind: "read",
          title: "VOD spreads, live concentrates",
          body: "CDNs mitigate hot objects, for example by serving very popular objects from more than one server. Details differ by vendor and are not always documented.\n\nThe review question is simple: \"How does your PoP behave when one object is requested at 10 Gbps? Show data from a past event.\"",
          visual: {
            kind: "compare",
            left: { title: "VOD premiere", points: ["Starts spread over minutes", "Dozens of segments x 7 renditions", "Hundreds of objects share 120 Gbps"] },
            right: { title: "Live event", points: ["All 30,000 want the same 1-2 segments", "Perhaps 10 objects carry 120 Gbps", "A few servers need tens of Gbps each"] },
          },
        },
        {
          kind: "summary",
          points: [
            "Assumed arrivals: 2,500 starts/s in the first 2 minutes; design peak **~5,000 starts/s**. Retries can multiply this (10x reported by Netflix).",
            "Egress 2M x 4 Mbps = **8 Tbps**; design for **~12 Tbps**.",
            "0.5 req/s per viewer: 500,000 req/s for the premiere, 1M req/s for the platform. Start-up buffer fill adds only ~30,000 req/s.",
            "CloudFront defaults: 150 Gbps and 250,000 req/s per distribution. Arrange capacity in advance.",
            "The hot set is **under 10 GB**. The problem is coordination, not storage.",
            "Live concentrates a 120 Gbps PoP onto a few hot objects; VOD premieres spread it.",
          ],
        },
      ],
    },

    /* ======================= Lesson 3 ======================= */
    {
      id: "ch13-l3",
      title: "Before the bell",
      goal: "Plan a staged publish, avoid the 404 trap, pre-warm shields correctly and pre-scale the services behind the CDN.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "At T-30 s a test script asks a CDN edge for the new episode's playlist. The packager has not written it yet, so the origin returns 404. What happens at T0 when real viewers on that edge press play?",
          options: [
            "They get the playlist, because the origin has it now",
            "They can get a cached 404 from that edge, although the origin now has the file",
            "The CDN automatically purges all 404s at T0",
            "The player waits quietly until the playlist exists",
          ],
          answer: 1,
          explain: "CDNs cache errors too. CloudFront caches error responses for 10 seconds by default. The early 404 sits in the edge cache past T0, so real viewers get \"not found\" for a file that now exists. This is the **404 trap**.",
        },
        {
          kind: "read",
          title: "Separate \"exists\" from \"visible\"",
          body: "The best way to survive T0 is to do the work before T0.\n\n**Staged publish** means the episode's bytes are in [[origin]] storage, replicated to every origin and verified long before the episode is *visible* to users.",
          visual: staged(0, "Step 1: segments go to every origin first."),
        },
        {
          kind: "read",
          title: "Bottom-up, in strict order",
          body: "A safe release has strict ordering:\n- **Segments** are written to all origins (AWS and GCP), and replication is verified with checksums.\n- **Media playlists** are written, pointing only to segments that exist.\n- **Master playlists / MPDs** are written, pointing only to media playlists that exist.",
          visual: staged(1, "Playlists are written only after the segments they point to."),
        },
        {
          kind: "read",
          title: "Each layer points only to what exists",
          body: "Next, the **shields are warmed** with the first segments.\n\nEach layer points only to things that already exist below it. So a client never receives a URL for a missing object. That invariant prevents the **404 trap**.",
          visual: staged(2, "Warm-up fetches fill the CDN shields before anyone can see the episode."),
        },
        {
          kind: "read",
          title: "The flip at T0",
          body: "At T0 the **[[control plane]] flips**: the catalog shows the episode, and the playback API starts issuing URLs and [[entitlements|entitlement]].\n\nThe first real requests then hit a warm shield, not the origin.",
          visual: staged(undefined, "Visibility is the last step, not the first."),
        },
        {
          kind: "order",
          prompt: "Put the staged publish in the correct order.",
          items: [
            "Write segments to all origins and verify replication",
            "Write media playlists that point only to existing segments",
            "Write master playlists / MPDs that point only to existing media playlists",
            "Warm the shields",
            "Flip visibility in the catalog and playback API",
          ],
          explain: "Bottom-up: segments, media playlists, master playlists, shield warm-up, then the control-plane flip. Each layer points only to things that already exist below it.",
        },
        {
          kind: "read",
          title: "The 404 trap",
          body: "Suppose a test script, a fan guessing URLs, or an app pre-fetching the next manifest asks for it at T-30 s, before it exists. The origin returns 404.\n\nCloudFront, by default, **caches error responses for 10 seconds** ([[negative caching]]). The Error Caching Minimum TTL can be set per status code. For 404, the origin can prevent caching with `no-store`, `no-cache` or `private`. Other CDNs have their own defaults.",
        },
        {
          kind: "read",
          title: "Why it hurts at T0",
          body: "The 404 sits in that edge's cache past T0. Real viewers press play and get \"not found\" from cache, although the origin now has the file. Retries hit the same cached 404. If the app treats 404 as fatal, users see an error screen at the exact moment of the premiere.",
          callout: {
            type: "mistake",
            text: "Making the episode visible a few seconds before the last packaging job finishes, \"because it is almost done\". The first viewers get 404s, the 404s are cached, and it looks like a CDN outage although every CDN is healthy.",
          },
        },
        {
          kind: "read",
          title: "Fixes, strongest first",
          body: "- **Never hand out URLs before objects exist.** Staged publish makes this structural.\n- **Answer \"not yet available\" in the playback API**, before any CDN URL exists.\n- **Use version-unique URLs**, so an early guess never matches the real path.\n- **Use short, deliberate negative caching** on manifest paths, but not zero by reflex.",
        },
        {
          kind: "order",
          prompt: "Rank the 404-trap fixes from strongest to weakest.",
          items: [
            "Never hand out URLs before objects exist",
            "Answer \"not yet available\" in the playback API",
            "Use version-unique URLs",
            "Use short, deliberate negative caching on manifest paths",
          ],
          explain: "The strongest fix is structural: no URL exists before its object. Then the API refuses early, then URLs cannot be guessed, and last, negative caching is tuned so an early 404 does not live long.",
        },
        {
          kind: "quiz",
          prompt: "Why not simply set negative caching to zero on manifest paths?",
          options: [
            "Very short error caching sends more requests to an origin that may already be struggling, and uncacheable responses cannot satisfy queued requests",
            "CDNs do not allow a TTL of zero",
            "A zero TTL breaks HLS players",
            "It would cache the 404 forever",
          ],
          answer: 0,
          explain: "CloudFront warns that very short error caching sends more requests to the origin. Fastly notes that an uncacheable response cannot satisfy queued requests, so they may go upstream one after another, which \"can create extreme response times of several minutes\".",
        },
        {
          kind: "read",
          title: "Pre-warming: shields first",
          body: "**[[Pre-warming]]** (cache priming) means fetching objects through the CDN before users ask, so the first real request is a hit.\n- **Shield pre-warm.** Send synthetic requests for the first minutes of every rendition through each CDN to its shield. Cheap (a few GB per CDN) and high value: after it, every edge miss at T0 is served by the shield.\n- **Edge pre-warm.** Much harder. [[Anycast]] and DNS steering send your test client to one PoP, not all.",
          visual: herd(["w", "w>s1", "w>s2", "w>s3", "s1", "s2", "s3"], undefined, "The pre-warm job fills each CDN's shield, not every edge."),
        },
        {
          kind: "quiz",
          prompt: "To warm every edge PoP you would need probes in hundreds of networks or a vendor push feature. With a warm shield and in-PoP collapsing, what does a cold edge PoP actually cost at T0?",
          options: [
            "One shield round trip for its first viewer",
            "One origin request per viewer",
            "A full download of the episode",
            "Nothing, because edges are always warm",
          ],
          answer: 0,
          explain: "The gain from edge pre-warm is small. With a warm shield and in-PoP collapsing, a cold PoP costs one shield round trip for its first viewer. That is why shields are warmed and edges are optional.",
        },
        {
          kind: "read",
          title: "Pre-positioning: Netflix's extreme version",
          body: "Netflix's 2021 [[Open Connect]] briefing paper explains that, because Netflix has \"a defined, limited catalogue\", it fills appliances inside ISPs during off-peak hours.\n\nThat is **pre-positioning**: the bytes are in the viewer's ISP before anyone presses play. Services on commercial CDNs usually rely on shields plus collapsing instead.",
        },
        {
          kind: "read",
          title: "Four questions for a pre-warm plan",
          body: "A pre-warm plan looks simple. Four questions decide whether it actually works.",
          callout: {
            type: "staff",
            text: "(1) **Embargo**: are warm requests authenticated, so no public URL leaks the episode before T0? (2) **Pollution**: warm the first minutes, not all 2,880 objects in every PoP. (3) **Cache key match**: does the warm request produce exactly the same [[cache key]] as real requests? If real URLs carry a token that is part of the key, the warm-up warmed nothing. (4) **Proof**: do logs show hits? CloudFront, for example, logs `OriginShieldHit` in `x-edge-detailed-result-type`.",
          },
        },
        {
          kind: "reveal",
          prompt: "Real segment URLs carry a per-viewer token, and the token is part of the cache key. Your pre-warm job used URLs with no token. What did the warm-up achieve, and how would you know?",
          answer: "Nothing useful. The warm requests made a different cache key from the real ones, so the warm-up warmed nothing. Make warm requests produce exactly the same cache key as real requests, and prove it with hits in logs (CloudFront logs `OriginShieldHit` in `x-edge-detailed-result-type`).",
        },
        {
          kind: "read",
          title: "Pre-scale what sits behind the CDN",
          body: "The CDN has huge shared capacity. Your own services do not, unless you scale them before T0.\n\nHotstar's re:Invent 2019 talk explains that reactive autoscaling was not enough. They hit \"insufficient capacity\" errors from the cloud provider. With traffic rising over 1M users per minute, boot plus reaction time was too slow. They pre-warmed infrastructure and scaled proactively on concurrency. Their Rootconf 2019 talk promised to explain \"why traditional autoscaling doesn't work for Hotstar\".",
        },
        {
          kind: "quiz",
          prompt: "Why did reactive autoscaling fail Hotstar?",
          options: [
            "Traffic rose over 1M users per minute, faster than boot plus reaction time, and the cloud returned insufficient-capacity errors",
            "Autoscaling was switched off by mistake",
            "The CDN blocked new servers",
            "Their services were not containerised",
          ],
          answer: 0,
          explain: "Reactive scaling waits for load, then boots machines. At over 1M new users per minute that is too slow, and the cloud itself may have no spare capacity. Hotstar pre-warmed and scaled proactively on concurrency.",
        },
        {
          kind: "read",
          title: "A simulcast is easier than sport",
          body: "For a simulcast, the release time is known days ahead. So scaling can follow the calendar instead of reacting to load.",
          callout: {
            type: "crunchyroll",
            text: "A platform like Crunchyroll would likely drive scheduled scaling of the playback API, entitlement, license proxy, auth and any just-in-time packagers from the release calendar: up at T-30 min, down after T+60 min.",
          },
        },
        {
          kind: "summary",
          points: [
            "**Staged publish**: segments, then media playlists, then master playlists, then shield warm-up, then the visibility flip.",
            "The **404 trap**: an early 404 is cached (CloudFront: 10 s by default) and served to real viewers at T0.",
            "Fix it structurally (no URLs before objects), then with \"not yet available\", version-unique URLs and short, deliberate negative caching.",
            "**Pre-warm shields**, not every edge. Check embargo, pollution, cache key match and proof in logs.",
            "Pre-scale the services behind the CDN from the release calendar; reactive autoscaling is too slow.",
          ],
        },
      ],
    },

    /* ======================= Lesson 4 ======================= */
    {
      id: "ch13-l4",
      title: "Under the herd",
      goal: "Count origin requests at T0 for four cache designs, explain request collapsing, and spot what silently breaks it.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "At T0, thousands of empty caches get the first request for segment 1 in the same second. There is no request collapsing and no shield. Who fetches segment 1 from the origin?",
          options: [
            "Every cache server that gets a request",
            "One server per PoP",
            "One server per CDN",
            "Only one request in total",
          ],
          answer: 0,
          explain: "Without collapsing, every cache server that misses goes upstream on its own. Without a shield, upstream is the origin. That is the [[thundering herd]].",
        },
        {
          kind: "read",
          title: "What is hot at T0",
          body: "At T0 only a few objects are hot. Assume the first 3 segments of 7 video renditions plus 3 audio segments, in 2 encryption variants: (3 x 7 + 3) x 2 = **48 objects**.\n\nAssume 3 CDNs with about 100 relevant PoPs each (**300 PoPs**) and about **30 cache servers per PoP**. Average object size: (23.2 / 7) Mbps x 4 s = about **1.66 MB**.",
          visual: {
            kind: "stats",
            items: [
              { value: "48", label: "Hot objects" },
              { value: "300", label: "PoPs", note: "3 CDNs x ~100" },
              { value: "30", label: "Servers per PoP" },
              { value: "1.66 MB", label: "Average object" },
            ],
            caption: "All assumed.",
          },
        },
        {
          kind: "number",
          prompt: "Design A: no collapsing, no shield. Every one of the 30 servers in each of 300 PoPs fetches all 48 objects from the origin. How many origin requests at T0?",
          answer: 432000,
          tolerance: 5000,
          unit: "requests",
          explain: "300 x 30 x 48 = **432,000** requests. At about 1.66 MB each, that is **~720 GB** within seconds.",
        },
        {
          kind: "read",
          title: "Four designs, four herds",
          body: "Design A asks the origin for about 720 GB within seconds, a burst of hundreds of terabits per second. Design C asks for a quarter of a gigabyte.\n\nThe difference is not more servers. It is **[[request collapsing]]** at each tier and a **[[shield]]** in front of the origin.",
          visual: {
            kind: "table",
            headers: ["Design", "Who fetches from origin", "Origin requests at T0", "Origin bytes"],
            rows: [
              ["A. No collapsing, no shield", "Every cache server", "300 x 30 x 48 = 432,000", "~720 GB in seconds"],
              ["B. Each PoP collapses, no shield", "One fetch per PoP", "300 x 48 = 14,400", "~24 GB"],
              ["C. One shield per CDN, collapsing", "One fetch per CDN", "3 x 48 = ?", "~240 MB"],
              ["D. One shared shield for all CDNs", "One fetch total", "48", "~80 MB"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "Design C: each PoP collapses, and each of the 3 CDNs has one shield that also collapses. How many origin requests at T0 for the 48 hot objects?",
          answer: 144,
          tolerance: 2,
          unit: "requests",
          explain: "One fetch per CDN per object: 3 x 48 = **144**, about 240 MB. From 432,000 to 144.",
        },
        {
          kind: "read",
          title: "How request collapsing works",
          body: "**[[Request collapsing]]** (request coalescing): when many requests for the same uncached object arrive together, the cache sends **one** request upstream and makes the others wait for its response.\n\nCloudFront documents that requests with the same cache key that arrive before the first response returns are paused, and all get the original response. The first is logged as `Miss`, the collapsed ones as `Hit`.",
          visual: herd(["u", "e1", "u>e1", "e1>s1", "s1"], ["u>e1", "e1>s1"], "Inside each PoP, many misses become one upstream fetch."),
        },
        {
          kind: "read",
          title: "Collapsing one tier up",
          body: "[[Origin Shield]] extends this one tier up, consolidating requests \"resulting in as few as one request going to your origin\".\n\nFastly describes the same mechanism. It notes that clustering inside a PoP plus shielding create \"up to four opportunities for Fastly to collapse requests\".",
          visual: herd(["s1", "s2", "s3", "o", "s1>o", "s2>o", "s3>o"], ["u>e1", "e1>s1", "s1>o"], "Each shield sends one miss per object to the origin."),
        },
        {
          kind: "widget",
          widget: "request-collapse",
          title: "Fire the premiere burst",
          task: "With **No collapsing**, predict, then fire the burst and watch the origin count. Then pick **Edge collapsing** and fire again, and finally **Edge + shield**. Compare the origin counts with designs A, B and C.",
          props: { preset: "stampede" },
        },
        {
          kind: "read",
          title: "What silently breaks collapsing",
          body: "Collapsing works only when requests share one cache key and the response is cacheable. Five things break it without any alarm.",
          visual: {
            kind: "table",
            headers: ["Cause", "Why collapsing fails", "Fix"],
            rows: [
              ["Per-user token in the cache key", "Every key is unique; CloudFront only collapses requests sharing a cache key", "Validate the token at the edge, then drop it from the key"],
              ["`Vary` on a high-cardinality header", "Each value is a separate entry", "Remove `Vary` from segment responses"],
              ["Uncacheable response (`private`, `no-store`, `max-age=0`)", "Serves only the triggering request; Fastly may then send waiters upstream one by one", "Make segments and VOD playlists cacheable"],
              ["Pass or hit-for-pass in edge logic", "Not eligible; queued requests go upstream concurrently", "Audit edge code for pass on media paths"],
              ["Different hostnames or URL forms", "Same bytes, different keys", "One hostname, one path scheme, sorted parameters"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each collapse-breaker to its fix.",
          pairs: [
            ["Per-user token in the cache key", "Validate at the edge, then drop it from the key"],
            ["Vary on a high-cardinality header", "Remove Vary from segment responses"],
            ["Uncacheable segment responses", "Make segments and VOD playlists cacheable"],
            ["Pass logic on media paths", "Audit edge code for pass"],
            ["Different hostnames or URL forms", "One hostname, one path scheme, sorted parameters"],
          ],
          explain: "Each breaker either makes every request a different [[cache key]] or makes the response ineligible for collapsing. Each fix restores one shared, cacheable key.",
        },
        {
          kind: "read",
          title: "Cache keys are an API",
          body: "Media cache keys should be an **explicit allowlist**, reviewed like an API. [[CMCD]] data should go in headers or be excluded from the key.",
          callout: {
            type: "mistake",
            text: "\"We collapse at the edge, so origin is safe.\" Then a client release adds an analytics parameter to every segment URL. The CDN includes all query parameters in the key, and hit ratio drops from 99% to near zero at the next premiere.",
          },
        },
        {
          kind: "quiz",
          prompt: "A new app release adds `?sid=<session id>` to every segment URL. The CDN keys on all query parameters. What happens at the next premiere?",
          options: [
            "Every request has a unique key, so nothing collapses and hit ratio falls toward zero",
            "Collapsing still works because the path is the same",
            "Only the first segment is affected",
            "The CDN ignores unknown parameters by default",
          ],
          answer: 0,
          explain: "A unique parameter in the key makes every request unique. Nothing collapses, nothing hits, and the herd reaches the origin. Keep the key an explicit allowlist.",
        },
        {
          kind: "read",
          title: "The cost of waiting",
          body: "Collapsing protects the origin, but waiters pay latency. If the upstream fetch is slow or fails, thousands of players wait together, time out together and retry together.\n\nThat is how a small origin slowdown becomes a synchronized **[[retry storm]]**.",
        },
        {
          kind: "read",
          title: "Three rules for the wait",
          body: "- Keep the shield close to the origin. CloudFront recommends the Origin Shield Region with the lowest latency to the origin.\n- Set CDN origin timeouts **shorter than the player's segment timeout**, so the CDN can fail over to a second origin before the player gives up.\n- Prefer serving stale over erroring for objects that have a previous version.",
        },
        {
          kind: "quiz",
          prompt: "The player's segment timeout is 4 s. The CDN's origin timeout is 10 s. The primary origin hangs at T0. What happens?",
          options: [
            "Players give up and retry before the CDN fails over, so a synchronized retry storm starts",
            "The CDN fails over first, so players never notice",
            "Collapsing hides the hang completely",
            "The shield serves a stale copy of the brand-new episode",
          ],
          answer: 0,
          explain: "The CDN origin timeout must be shorter than the player's timeout, so the CDN can fail over to a second origin first. Here players time out together and retry together. Stale serving cannot help either: a new episode has no previous version.",
        },
        {
          kind: "read",
          title: "The shield is a hot spot too",
          body: "A shield concentrates all misses in one place, so it is also a risk at T0.\n\nCloudFront documents that Origin Shield runs on regional edge caches across at least three Availability Zones. Edges automatically route to a secondary Origin Shield location if the primary is unavailable. With [[origin groups|origin group]], each origin has its own shield path.",
        },
        {
          kind: "read",
          title: "Multi-CDN multiplies origin misses",
          body: "Each CDN has its own shield, so three CDNs mean three cold misses per object (design C vs D).\n\nAt 48 objects this is irrelevant. For a [[just-in-time packager|just-in-time packaging]] or a live origin under load, it matters.",
          visual: herd(["s1>o", "s2>o", "s3>o", "s1", "s2", "s3", "o"], undefined, "Three shields, three misses per object."),
        },
        {
          kind: "read",
          title: "One shared shield?",
          body: "AWS documents one answer: put a CloudFront distribution with Origin Shield in front of the origin, and use it as **the origin for your other CDNs**. That gives one shared cache layer and one cache key.\n\nThe trade-off is **coupling**: CloudFront is then in every CDN's path, which partly defeats [[multi-CDN]]. Many teams use a shared shield tier for expensive origins, with a direct fallback path per CDN.",
          visual: { kind: "flow", spec: SHARED, caption: "A shared shield for expensive origins, with direct fallback paths." },
        },
        {
          kind: "quiz",
          prompt: "What is the main cost of using one CloudFront Origin Shield as the shared origin for all your CDNs?",
          options: [
            "Coupling: CloudFront is in every CDN's path, which partly defeats multi-CDN",
            "Origin requests triple",
            "Cache keys stop matching across CDNs",
            "Players must support Content Steering",
          ],
          answer: 0,
          explain: "A shared shield cuts origin misses from one per CDN to one in total, but it puts one vendor in every path. Many teams use it only for expensive origins and keep a direct fallback per CDN.",
        },
        {
          kind: "summary",
          points: [
            "Origin requests at T0 for 48 hot objects: 432,000 with no collapsing, 14,400 with per-PoP collapsing, **144** with a shield per CDN, 48 with one shared shield.",
            "**Request collapsing** sends one request upstream per tier; the others wait for its response.",
            "It breaks silently with per-user keys, `Vary`, uncacheable responses, pass logic or URL variants. Keep cache keys an allowlist.",
            "Waiters time out together: keep the shield near the origin and CDN timeouts shorter than player timeouts.",
            "Multi-CDN multiplies origin misses; a shared shield fixes that at the cost of coupling.",
          ],
        },
      ],
    },

    /* ======================= Lesson 5 ======================= */
    {
      id: "ch13-l5",
      title: "Capacity and the control plane",
      goal: "Plan CDN capacity for a spike with N+1 math, and flatten the control-plane spike of login, entitlement and DRM licenses.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "A big football match streams in the same region, at the same minute as your premiere, on the same CDN. What happens to that CDN's PoPs?",
          options: [
            "Both events compete for the same servers and ISP ports, so capacity can run short",
            "Nothing; CDN capacity is effectively unlimited",
            "The CDN automatically moves the football traffic elsewhere",
            "Your traffic gets priority because you pay per GB",
          ],
          answer: 0,
          explain: "From outside a CDN looks infinite. It is not. Each PoP has a fixed number of servers and fixed uplinks to each ISP, shared with every other customer.",
        },
        {
          kind: "read",
          title: "CDN capacity is shared and finite",
          body: "Each PoP has a fixed number of servers and fixed uplinks to each ISP, shared with every other customer. So large services plan big events **jointly with vendors**:\n- share an event calendar with forecast Gbps per region per CDN, weeks ahead,\n- get capacity confirmed,\n- raise account quotas,\n- name a war-room contact at each vendor.\n\nReservation terms are contract details that vendors do not publish. The practice of telling them early is standard.",
        },
        {
          kind: "multi",
          prompt: "Which belong in event planning with your CDN vendors? Select all that apply.",
          options: [
            "A forecast of Gbps per region per CDN, weeks ahead",
            "Capacity confirmed by the vendor",
            "Raised account quotas",
            "A named war-room contact at each vendor",
            "Trust that default quotas are enough",
            "Wait for the CDN to autoscale during the spike",
          ],
          answers: [0, 1, 2, 3],
          explain: "Forecast, confirmation, quota raises and a war-room contact. Default quotas (CloudFront: 150 Gbps, 250,000 req/s per distribution) are far below a big premiere.",
        },
        {
          kind: "number",
          prompt: "Many CDN contracts bill on the 95th percentile of 5-minute samples. How many 5-minute samples are in a 30-day month?",
          answer: 8640,
          tolerance: 50,
          unit: "samples",
          explain: "30 days x 24 h x 12 samples per hour = **8,640 samples**.",
        },
        {
          kind: "read",
          title: "Spikes on a 95th-percentile bill",
          body: "With [[95th percentile billing]], the top 5% of the 8,640 samples (432 samples = **36 hours**) is discarded.\n\nIf a month's above-normal spikes total under 36 hours, they fall in the discarded part, and the evening peak sets the bill. But **billing is not capacity**: the vendor must still *have* the capacity for those minutes.",
        },
        {
          kind: "read",
          title: "Split before T0",
          body: "The split across CDNs should be **decided before T0**, not discovered by reactive [[steering]] during the spike:\n- DNS answers are cached for their [[TTL]].\n- [[RUM]] needs minutes to show a trend.\n- Moving a big share onto a cold CDN at T+1 min creates a second cold-cache event.\n\nWorked example (assumed): 8 Tbps split 40/35/25 across CDNs A, B and C, so 3.2 / 2.8 / 2.0 Tbps.",
        },
        {
          kind: "number",
          prompt: "CDN A (40%) fails and its share moves to B and C in proportion. What does B (35%) now carry, out of the 8 Tbps?",
          answer: 4.67,
          tolerance: 0.1,
          unit: "Tbps",
          hint: "B's new share is 35 / (35 + 25).",
          explain: "8 x 35/60 = **4.67 Tbps**. C carries 8 x 25/60 = 3.33 Tbps.",
        },
        {
          kind: "number",
          prompt: "B planned for 2.8 Tbps and now carries 4.67 Tbps. How many times its planned share is that?",
          answer: 1.67,
          tolerance: 0.05,
          unit: "x",
          explain: "4.67 / 2.8 ≈ **1.67x**. C is also 3.33 / 2.0 ≈ 1.67x. Both must be ready for it.",
        },
        {
          kind: "read",
          title: "N+1 for CDNs",
          body: "This is the **N+1 rule for CDNs**: reserve with each vendor enough for its share after the largest other vendor fails. It is the same reason the design target is 12 Tbps for an 8 Tbps peak.",
          visual: {
            kind: "table",
            headers: ["CDN", "Planned share", "Planned", "If A fails"],
            rows: [
              ["A", "40%", "3.2 Tbps", "0"],
              ["B", "35%", "2.8 Tbps", "4.67 Tbps (1.67x)"],
              ["C", "25%", "2.0 Tbps", "3.33 Tbps (1.67x)"],
            ],
            caption: "Assumed 8 Tbps peak.",
          },
          callout: {
            type: "staff",
            text: "Ask: \"If our largest CDN fails at T+3 min, where does its traffic go, how long does the move take, and is the receiving CDN's shield already warm?\" A good plan pre-warms the shield of **every** CDN that might receive traffic, not only the planned ones.",
          },
        },
        {
          kind: "read",
          title: "One T0, many local times",
          body: "A global T0 lands at different local times. Saturday morning in the US may be evening in Europe and late night in Australia.\n\nThe region where the premiere hits local prime time is the most likely to run short. So forecasts must be **per region per CDN**, not one global number.",
        },
        {
          kind: "quiz",
          prompt: "Why decide the CDN split before T0 instead of letting reactive steering find it during the spike?",
          options: [
            "DNS answers are cached, RUM needs minutes, and moving share onto a cold CDN at T+1 min creates a second cold-cache event",
            "Steering is not allowed during premieres",
            "Reactive steering costs more per GB",
            "CDNs bill extra for traffic that moves",
          ],
          answer: 0,
          explain: "Reactive steering is too slow and too blunt for the first minutes. Worse, moving a big share onto a cold CDN repeats the cold-cache herd at the worst time.",
        },
        {
          kind: "read",
          title: "Why the control plane breaks first",
          body: "After warm-up, the CDN absorbs nearly all segment traffic. The **[[control plane]]** is mostly not cacheable. Every start needs user-specific answers:\n- a valid session (refresh it if expired),\n- an [[entitlement]] and geo check from the playback API,\n- possibly a personalized or signed manifest,\n- a [[DRM]] license.",
          visual: cp(3, "The first calls of every start are user-specific."),
        },
        {
          kind: "read",
          title: "One start, end to end",
          body: "Playlists and segments can come from the CDN cache. The session refresh, the playback API call and the license request cannot. They reach your services, or a third party, for **every** start.",
          visual: cp(undefined, "Green replies come from cache. The rest hit services."),
        },
        {
          kind: "read",
          title: "The evidence",
          body: "The January 2022 Downdetector breakdown, with sign-in the largest category, fits this pattern, though no root cause was published.\n\nHotstar's \"panic mode\" turned off recommendations and personalization to protect video and payments.\n\nPer Wikipedia, Crunchyroll dropped its free ad-supported tier in December 2025. If so, every premiere viewer is a logged-in subscriber who needs a valid session and an entitlement check.",
        },
        {
          kind: "read",
          title: "Control-plane math",
          body: "At the design peak of **5,000 starts/s** (assumed per-start counts). Small next to 1M segment requests/s. But each call is a database read, a crypto operation or a third-party call, and none is absorbed by a cache.",
          visual: {
            kind: "table",
            headers: ["Call", "Calls per start", "Peak rate", "Cacheable at CDN?"],
            rows: [
              ["Token refresh", "0.3 (30% expired)", "1,500/s", "No"],
              ["Playback API", "1", "5,000/s", "No"],
              ["Master + media playlists", "3", "15,000/s", "Yes for VOD, if not per-user"],
              ["DRM license", "1-2", "5,000-10,000/s", "No"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "Licenses run at up to 10,000/s (2 per start). Then a 3x retry storm hits the license path. How many license requests per second?",
          answer: 30000,
          tolerance: 1000,
          unit: "req/s",
          explain: "10,000 x 3 = **30,000/s**. If a multi-DRM vendor issues licenses, **its rate limits become your limits**. Tell it about the event.",
        },
        {
          kind: "read",
          title: "Flattening the spike, part 1",
          body: "- **Refresh tokens before T0, with jitter.** If the app shows a countdown, refresh the session at a random time before release. Login storms at T0 are self-inflicted.\n- **Pre-fetch playback info.** Fetch the next episode's entitlement and playback data a few minutes early, with a not-before time. At T0 the app only fetches bytes.\n- **Jitter anything automatic.** A \"new episode\" rail that refreshes at exactly 00:00 on millions of clients is a denial-of-service you built yourself. Spread it over 30-60 s.",
        },
        {
          kind: "read",
          title: "Flattening the spike, part 2",
          body: "- **Backoff with jitter and [[retry budgets|retry budget]]** in players.\n- **Shed load by priority.** Netflix's Live Origin favours live-edge over DVR traffic and answers low-priority requests with 503 and `max-age=5s`, so Open Connect stops repeating them. Likewise, protect \"start playback\" over \"update watch history\".\n- **Move heavy work earlier, send tiny triggers at T0.** Netflix prefetches live-event recommendations, then broadcasts a small update; InfoQ reports it reached over 100 million devices in under a minute.\n- **[[Degradation switches|graceful degradation]]** for recommendations, rich artwork and costly personalization.",
        },
        {
          kind: "multi",
          prompt: "Which of these flatten the control-plane spike at T0? Select all that apply.",
          options: [
            "Refresh sessions before T0 at a random time",
            "Pre-fetch playback info with a not-before time",
            "Shed low-priority calls like watch-history updates first",
            "Switch off recommendations and rich artwork during the spike",
            "Refresh every session exactly at T0 so all are fresh",
            "Retry failed license calls immediately in a tight loop",
          ],
          answers: [0, 1, 2, 3],
          explain: "Jittered early refresh, pre-fetched playback info, priority shedding and degradation switches all move or remove work at T0. Refreshing everyone at T0 and tight retry loops create the storm you are trying to avoid.",
        },
        {
          kind: "read",
          title: "Premiere day is judged end to end",
          body: "Media Delivery does not own login or entitlement. Partner teams (Playback, Content Protection, identity) do. But nobody watching cares which team failed.",
          callout: {
            type: "crunchyroll",
            text: "A platform like Crunchyroll would likely run a shared readiness review where each team states its forecast rate, tested rate and degradation switches. The delivery engineer's job is to make sure the starts-per-second forecast is the **same number in every team's plan**.",
          },
        },
        {
          kind: "widget",
          widget: "premiere",
          title: "Launch a premiere",
          task: "Run the **Naive launch** to the end and note which system turns red first. Then run the **Playbook launch** (pre-warm, collapsing, shields, 3 CDNs, control-plane protection) and compare the error rate and the control-plane chart.",
          props: { preset: "naive" },
        },
        {
          kind: "summary",
          points: [
            "CDN capacity is shared and finite: forecast per region per CDN, confirm capacity, raise quotas, name war-room contacts.",
            "95th-percentile billing discards the top 36 hours a month, but billing is not capacity.",
            "Split before T0. With a 40/35/25 split, losing A makes B and C carry **1.67x** their plan; reserve N+1 and pre-warm every CDN's shield.",
            "The control plane is not cacheable and often fails first: 5,000 starts/s means up to 10,000 licenses/s, 30,000/s under a 3x retry storm.",
            "Flatten it with scheduled scaling, jittered early refresh, pre-fetched playback info, retry budgets, priority shedding and degradation switches.",
          ],
        },
      ],
    },

    /* ======================= Lesson 6 ======================= */
    {
      id: "ch13-l6",
      title: "When the event is live",
      goal: "Describe a live pipeline with redundant origins, set cache rules for live objects, and work out what LL-HLS and LL-DASH do to the CDN.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "A live boxing match. A player slightly ahead of the packager asks for segment N+1 before it exists. Multiply that by millions of players every 2 seconds. What does the origin see?",
          options: [
            "A 404 storm: huge numbers of requests for segments that do not exist yet",
            "Nothing, because CDNs never forward requests for missing files",
            "A smooth load, because live viewers spread across the DVR window",
            "Only manifest requests",
          ],
          answer: 0,
          explain: "Every player that is a little early asks for a segment that is not there yet. Uncached 404s all reach the origin, every 2 seconds, from millions of players. This lesson shows how live systems handle it.",
        },
        {
          kind: "read",
          title: "What live changes",
          body: "Sport, concerts, convention panels or a premiere watch party may be truly live. Live changes three things:\n- bytes are created **during** the event,\n- everyone watches the **same moment**,\n- **latency** matters.",
        },
        {
          kind: "read",
          title: "The live pipeline",
          body: "A **contribution feed** from the venue goes to a **live encoder** (the ABR ladder), then a **[[packager]]** (segments and playlists), then a **live origin** that stores and serves the last N minutes. Then come shields, CDNs and players.",
          visual: live(["v", "i1", "p1", "lo", "sh", "cd", "pl", "v>i1", "i1>p1", "p1>lo", "lo>sh", "sh>cd", "cd>pl"], ["v>i1", "i1>p1", "p1>lo", "lo>sh", "sh>cd", "cd>pl"], "One path from venue to player."),
        },
        {
          kind: "read",
          title: "Netflix's published design",
          body: "Netflix's published design follows this shape: AWS MediaConnect and MediaLive for ingest and encoding, its own packager, a custom Live Origin, and delivery through [[Open Connect]].\n\nDan Rayburn's summary reports **2-second segments**, more than 18,000 Open Connect servers in more than 6,000 locations, and manifests served from the cloud so they can be personalized per device.",
          visual: {
            kind: "stats",
            items: [
              { value: "2 s", label: "Segments" },
              { value: "18,000+", label: "Open Connect servers" },
              { value: "6,000+", label: "Locations" },
            ],
            caption: "As reported by Rayburn's summary.",
          },
        },
        {
          kind: "read",
          title: "Redundant pipelines, epoch locking",
          body: "From summaries of Netflix's \"Live Origin\" post: two independent regional pipelines (feed, encoder, packager) run side by side. **Epoch locking** aligns their segments, so the origin can pick a good segment from either.\n\nFailover is **server-side**, which keeps players simple.",
          visual: live(["i1", "i2", "p1", "p2", "lo", "p1>lo", "p2>lo"], ["v>i2", "i2>p2", "p2>lo"], "The live origin takes a good segment from either pipeline."),
        },
        {
          kind: "quiz",
          prompt: "Why does Netflix fail over between pipelines in the Live Origin rather than in the player?",
          options: [
            "Server-side failover keeps players simple; the origin can pick a good segment from either aligned pipeline",
            "Players cannot reach two regions",
            "It lowers CDN egress",
            "HLS forbids two pipelines",
          ],
          answer: 0,
          explain: "Epoch locking aligns the two pipelines' segments, so the origin can swap one for the other with no player logic. Players stay simple.",
        },
        {
          kind: "read",
          title: "Storage and caching built for live",
          body: "- **Storage built for live.** First based on S3 as for VOD, later a key-value abstraction with Cassandra for durability and EVCache for reads; chosen for latency and availability over cost.\n- **Millisecond-grain caching.** `Cache-Control` has one-second granularity, coarse when a segment appears every 2 s. Netflix extended nginx proxy caching to millisecond grain.\n- **Hiding bad segments** in the [[DVR window]] with invalidation and origin masking.",
        },
        {
          kind: "read",
          title: "The 404 storm",
          body: "A player slightly ahead of the packager asks for segment N+1 before it exists, multiplied by millions every 2 seconds. Uncached 404s all reach the origin. 404s cached too long tell players \"not found\" after the segment exists.\n\nThe answer: a precise, very short negative TTL with collapsing, or (with LL-HLS) requests that block until the segment exists. Netflix uses short TTLs and cached templated control responses to keep these off the storage layer.",
        },
        {
          kind: "read",
          title: "Caching rules for live",
          body: "Two rules carry most of the weight: **segments are immutable** (never rewrite a URL with different bytes), and **only playlists move**.",
          visual: {
            kind: "table",
            headers: ["Object", "Changes?", "Typical cache rule"],
            rows: [
              ["Master playlist", "Rarely", "Minutes"],
              ["Media playlist", "Every segment", "About half a segment duration, or blocking reload"],
              ["Media and init segments", "Never after written", "Long (hours or more)"],
              ["404 for a future segment", "Becomes 200 soon", "Very short or none, collapsed"],
              ["DVR segments", "Never", "Long, lower priority under load"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each live object to its typical cache rule.",
          pairs: [
            ["Master playlist", "Minutes"],
            ["Media playlist", "About half a segment, or blocking reload"],
            ["Media segment", "Long: hours or more"],
            ["404 for a future segment", "Very short or none, collapsed"],
            ["DVR segment", "Long, but lower priority under load"],
          ],
          explain: "Segments never change once written, so they cache long. The media playlist changes every segment, so it caches for about half a segment. A future-segment 404 will soon be a 200, so it must not live long.",
        },
        {
          kind: "number",
          prompt: "Classic HLS says `HOLD-BACK` MUST be at least three times the Target Duration. With 6-second segments, at least how many seconds behind the live edge does the player sit (before encode, package and CDN time)?",
          answer: 18,
          tolerance: 0.5,
          unit: "s",
          explain: "3 x 6 = **18 s**. With 2-second segments it is at least 6 s. For sport, viewers learn about a goal from social media before they see it.",
        },
        {
          kind: "read",
          title: "LL-HLS in five features",
          body: "**[[LL-HLS]]**, in the HLS second-edition draft (rfc8216bis-22, May 2026), adds:\n- **Partial segments** (`EXT-X-PART`), sized by `PART-TARGET`.\n- **Blocking playlist reload**: with `_HLS_msn` (and `_HLS_part`), the server MUST defer until the playlist contains that segment or part; after over three target durations it should return 503.\n- **Preload hints** (`EXT-X-PRELOAD-HINT`) naming the next part.\n- **Delta updates** (`_HLS_skip`, `EXT-X-SKIP`) keeping DVR playlists small.\n- **`PART-HOLD-BACK`**: MUST be at least 2x, SHOULD be at least 3x the part target.",
          visual: {
            kind: "code",
            lang: "m3u8",
            code: "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-PART-INF:PART-TARGET=0.5\n#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=1.5,CAN-SKIP-UNTIL=12\n#EXT-X-MEDIA-SEQUENCE:1200\n#EXTINF:2.0,\nseg1200.m4s\n#EXT-X-PART:DURATION=0.5,URI=\"seg1201.0.m4s\"\n#EXT-X-PART:DURATION=0.5,URI=\"seg1201.1.m4s\"\n#EXT-X-PRELOAD-HINT:TYPE=PART,URI=\"seg1201.2.m4s\"",
            caption: "An illustrative LL-HLS media playlist.",
          },
        },
        {
          kind: "quiz",
          prompt: "In the example playlist, `PART-TARGET=0.5` and `PART-HOLD-BACK=1.5`. Does that meet the spec?",
          options: [
            "Yes: 1.5 s is 3x the part target, so it meets the MUST (2x) and the SHOULD (3x)",
            "No: it must be at least 3x the segment target duration, so 6 s",
            "No: it must be at least 2x the full segment duration, so 4 s",
            "Yes, because any value is allowed",
          ],
          answer: 0,
          explain: "`PART-HOLD-BACK` is measured against the part target (0.5 s), not the segment. It MUST be at least 1.0 s and SHOULD be at least 1.5 s. 1.5 s meets both.",
        },
        {
          kind: "number",
          prompt: "1M viewers on LL-HLS with 0.5 s parts, video only. Each viewer makes about 2 playlist requests and 2 part requests per second. Total requests per second, in millions?",
          answer: 4,
          tolerance: 0.2,
          unit: "M req/s",
          explain: "1M x (2 + 2) = **4M req/s**. Classic HLS with 2 s segments: 1M x (0.5 + 0.5) = 1M req/s. About **4x** the requests.",
        },
        {
          kind: "read",
          title: "What LL-HLS does to the CDN",
          body: "About 4x the requests. Three CDN properties become critical:\n- **Collapsing blocked requests.** All players at a PoP waiting for the same `_HLS_msn` and `_HLS_part` must become one upstream request. The spec asks clients to order query parameters consistently to \"improve Server cache utilization\".\n- **Long-held connections.** Each blocked request stays open up to a part or segment duration.\n- **Streamed responses.** Preload hints help only if every tier streams the part while it is still arriving.",
          visual: {
            kind: "table",
            headers: ["Mode (1M viewers, video only)", "Playlist req/s per viewer", "Media req/s per viewer", "Total"],
            rows: [
              ["Classic HLS, 2 s segments", "0.5", "0.5", "1M req/s"],
              ["LL-HLS, 0.5 s parts", "2", "2", "4M req/s"],
            ],
          },
        },
        {
          kind: "multi",
          prompt: "Which CDN features become critical for LL-HLS? Select all that apply.",
          options: [
            "Collapsing blocked requests with the same `_HLS_msn` and `_HLS_part`",
            "Holding many open connections per PoP",
            "Streaming a part through every tier while it is still arriving",
            "Larger disk caches for the long tail",
            "Longer TTLs on the media playlist",
          ],
          answers: [0, 1, 2],
          explain: "Blocked reloads must collapse, connections stay open while blocked, and preload hints only help if every tier streams. Disk size and long playlist TTLs do not help; the playlist must stay fresh.",
        },
        {
          kind: "read",
          title: "LL-DASH",
          body: "**[[LL-DASH]]** uses the same ideas. The DASH-IF \"Low-latency Modes for DASH\" change request (2020) uses **chunked CMAF** delivered with **HTTP chunked transfer encoding**, signalled with `@availabilityTimeOffset`.\n\nA `ServiceDescription` carries a target latency, \"typically 2 to 10 seconds\". Segment duration \"shall not exceed 50% of the value of the target latency and should not exceed 30%\".",
        },
        {
          kind: "number",
          prompt: "Apply the DASH-IF rule. With a target latency of 4 s, what is the longest segment duration allowed by the \"shall\" limit?",
          answer: 2,
          tolerance: 0.1,
          unit: "s",
          explain: "50% of 4 s = **2 s**. The \"should\" limit is 30%: 1.2 s. The latency target comes first; segment duration follows from it.",
        },
        {
          kind: "read",
          title: "Does this event need low latency?",
          body: "Low latency trades away buffer: less protection against jitter, more [[rebuffering|rebuffering ratio]] at the same bandwidth, and several times more requests.",
          callout: {
            type: "staff",
            text: "A scripted watch party can live with 10-20 s. Live sport with betting or chat cannot. Pick the latency target from the product need, then derive segment and part durations from it, as the DASH-IF rule does.",
          },
        },
        {
          kind: "read",
          title: "DVR windows",
          body: "A **[[DVR window]]** lets viewers pause and rewind live. It costs three things:\n- The playlist grows (delta updates help).\n- The origin serves older segments. Netflix ranks DVR below live-edge traffic under load.\n- Viewers spread over the window, which weakens collapsing.\n\nAfter the event, the archive usually becomes the VOD asset.",
        },
        {
          kind: "summary",
          points: [
            "Live pipeline: contribution feed, live encoder, packager, live origin, shields, CDNs, players. Netflix runs two epoch-locked pipelines with server-side failover.",
            "**Segments are immutable, only playlists move.** Future-segment 404s need a very short, collapsed negative TTL or blocking reload.",
            "Classic HLS `HOLD-BACK` is at least 3x the target duration: 6 s behind with 2 s segments, 18 s with 6 s.",
            "LL-HLS with 0.5 s parts is about **4x** the requests; CDNs must collapse blocked requests, hold connections and stream parts.",
            "LL-DASH: segment duration at most 50% (ideally 30%) of the target latency. Choose the latency from the product need.",
          ],
        },
      ],
    },

    /* ======================= Lesson 7 ======================= */
    {
      id: "ch13-l7",
      title: "Rehearse the premiere",
      goal: "Load test a premiere layer by layer, run a game day, and follow a premiere-day runbook that feeds the next forecast.",
      minutes: 9,
      steps: [
        {
          kind: "quiz",
          prompt: "You want to prove the platform survives an 8 Tbps premiere. Should you generate 8 Tbps from your own load generators?",
          options: [
            "No: test by layer, because synthetic terabits cost real money, can disturb other customers, and the test itself can cause an outage",
            "Yes, it is the only real proof",
            "Yes, but only from one region",
            "No, because load testing is unnecessary when the CDN says it is fine",
          ],
          answer: 0,
          explain: "You cannot and should not generate 8 Tbps yourself. Split the test by layer, and get CDN capacity from vendor confirmation and past-event data.",
        },
        {
          kind: "read",
          title: "Hotstar's Hulk",
          body: "Hotstar's \"Hulk\" load-testing system was described at re:Invent 2019 as about **108,000 CPUs** and **200 Gbps** outbound across 8 regions. The session noted that the load tests themselves caused an outage, by hitting shared cloud network limits.\n\nSynthetic terabits through a CDN also cost real money and can disturb other customers. So split the test.",
        },
        {
          kind: "read",
          title: "Test by layer",
          body: "Each layer gets the test that fits it. Only the control plane and origin path are tested with your own synthetic load.",
          visual: {
            kind: "table",
            headers: ["Layer", "What to test", "How"],
            rows: [
              ["Control plane", "Peak starts/s x retry factor", "Synthetic clients at 2-3x forecast, including the DRM vendor with its agreement"],
              ["Origin and shield", "Cold-cache herd, collapsing, failover", "Publish a dummy episode; burst first-segment requests through each CDN from many locations; compare origin requests with the cold-cache math"],
              ["CDN capacity", "Regional Gbps headroom", "Vendor confirmation, quota raises, past-event data"],
              ["Players", "Retries, backoff, jitter, CDN failover", "Fault injection in staging: 503s, 404s, slow responses"],
              ["Cache keys", "Hit ratio with real URLs", "Replay real URL patterns, tokens included, against staging config; check hits in logs"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each layer to how you test it.",
          pairs: [
            ["Control plane", "Synthetic clients at 2-3x forecast, DRM vendor included"],
            ["Origin and shield", "Burst a dummy episode's first segments through each CDN"],
            ["CDN capacity", "Vendor confirmation, quota raises, past-event data"],
            ["Players", "Fault injection in staging: 503s, 404s, slow responses"],
            ["Cache keys", "Replay real URL patterns with tokens; check hits in logs"],
          ],
          explain: "Each layer has a different failure, so each needs a different test. The origin-and-shield test is checked against the cold-cache math: you know how many origin requests to expect.",
        },
        {
          kind: "read",
          title: "Game days",
          body: "A **game day** is a planned rehearsal of the event playbook under simulated load, with injected failures. Hotstar simulated \"tsunami\" traffic and injected push-notification spikes, delayed scale-up, bandwidth limits and CDN failures.\n\nUseful premiere injections:\n- Fail the largest CDN at T+2 min.\n- Add latency to the primary origin at T0.\n- Return 5xx from the license service for 30 s.\n- Publish the master playlist late.",
        },
        {
          kind: "reveal",
          prompt: "Injection: fail the largest CDN at T+2 min. What two things do you measure?",
          answer: "How long steering takes to move its traffic, and whether the receiving CDN's shield was already warm. A cold receiving shield sends a second herd to the origin in the middle of the spike.",
        },
        {
          kind: "reveal",
          prompt: "Injection: add latency to the primary origin at T0. What must happen for the test to pass?",
          answer: "The shields must fail over to the second origin before players time out. That only works if CDN origin timeouts are shorter than the player's segment timeout.",
        },
        {
          kind: "reveal",
          prompt: "Injections: return 5xx from the license service for 30 s, and publish the master playlist late. What does each one check?",
          answer: "The license test checks that players back off within their retry budget and recover, instead of retrying in a tight loop. The late playlist checks whether the 404 trap appears: are early 404s cached and served to real viewers?",
        },
        {
          kind: "read",
          title: "A premiere-day runbook",
          body: "Owners are the book's likely split, not a published org chart.",
          visual: {
            kind: "table",
            headers: ["Time", "Action", "Likely owner"],
            rows: [
              ["T-7 days", "Forecast concurrency and starts/s per region; share with CDN vendors, DRM vendor, partner teams", "Media Delivery with Playback, Content Protection"],
              ["T-24 h", "Episode packaged, on all origins, replication verified", "Content Pipeline, Media Delivery"],
              ["T-2 h", "Config freeze on CDN and edge code", "All teams"],
              ["T-60 min", "Scheduled scale-up of control-plane services", "Service owners"],
              ["T-20 min", "Shield pre-warm on every CDN that may get traffic; check hits", "Media Delivery"],
              ["T-10 min", "War room; dashboards with forecast lines", "On-call"],
              ["T0 to T+2 min", "Visibility flip; compare starts/s and origin requests with forecast", "On-call"],
              ["T+1 day", "Review forecast vs actual; actions", "Media Delivery"],
            ],
          },
        },
        {
          kind: "order",
          prompt: "Put these premiere-day actions in time order.",
          items: [
            "Forecast per region and share it with vendors and partner teams",
            "Episode packaged, on all origins, replication verified",
            "Config freeze on CDN and edge code",
            "Scheduled scale-up of control-plane services",
            "Shield pre-warm on every CDN that may get traffic",
            "Visibility flip; compare starts/s with the forecast",
          ],
          explain: "T-7 days forecast, T-24 h episode ready, T-2 h config freeze, T-60 min scale-up, T-20 min shield pre-warm, T0 flip. The war room opens at T-10 min and the review follows at T+1 day.",
        },
        {
          kind: "read",
          title: "The premiere is a loop",
          body: "The runbook is not a line. The post-premiere review feeds the next forecast, and the next premiere starts with better numbers.",
          visual: { kind: "flow", spec: { ...LOOP, flow: ["f>v", "v>p", "p>z", "z>s", "s>w", "w>t", "t>m", "m>r", "r>f"] }, caption: "Every premiere improves the next forecast." },
        },
        {
          kind: "read",
          title: "Measure it, do not just survive it",
          body: "A good premiere ends with numbers, not just relief.",
          callout: {
            type: "mistake",
            text: "Treating the premiere as an incident to survive instead of a process to measure. If the team cannot say afterwards \"we forecast 2,500 starts/s, saw 3,100, the origin got 210 requests in the first two minutes, and license errors peaked at 0.4%\", next week's plan is a guess again.",
          },
        },
        {
          kind: "number",
          prompt: "In that example, the team forecast 2,500 starts/s and saw 3,100. By what percent was the forecast too low?",
          answer: 24,
          tolerance: 1,
          unit: "%",
          explain: "(3,100 - 2,500) / 2,500 = 600 / 2,500 = **24%**. That error feeds the error bar of the next forecast.",
        },
        {
          kind: "read",
          title: "The staff-level premiere review",
          body: "Chapter 18 turns these answers into a full design.",
          callout: {
            type: "staff",
            text: "What is the forecast and its error bar? How many requests reach the origin in the first 10 seconds, and how do we know? What is in the segment cache key? What happens if the biggest CDN fails at T+3 min? Which third party has the lowest rate limit on the start path? What do we turn off first? How will we know within 60 seconds that we are above forecast?",
          },
        },
        {
          kind: "reveal",
          prompt: "Review question: \"How will we know within 60 seconds that we are above forecast?\" Use the runbook to answer.",
          answer: "The war room opens at T-10 min with dashboards that show forecast lines. From T0 to T+2 min, on-call compares live starts/s and origin requests with the forecast, so a gap is visible in the first minute.",
        },
        {
          kind: "summary",
          points: [
            "Do not generate terabits yourself. **Load test by layer**: control plane, origin and shield, CDN capacity, players, cache keys.",
            "Game days inject real failures: largest CDN down, slow origin, license 5xx, late playlist.",
            "The runbook runs from T-7 days (forecast) to T+1 day (review), with config freeze, scale-up and shield pre-warm before T0.",
            "Measure every premiere against its forecast; each weekly premiere is a rehearsal for the big one.",
          ],
        },
      ],
    },

    /* ======================= Lesson 8: Checkpoint ======================= */
    {
      id: "ch13-l8",
      title: "Checkpoint",
      goal: "Answer the chapter's review questions with the numbers and reasons behind them.",
      minutes: 8,
      steps: [
        {
          kind: "reveal",
          prompt: "Why is a simulcast premiere harder than a normal evening peak with twice the viewers?",
          answer: "The evening peak is spread over many titles with warm caches and builds slowly. A premiere puts everyone on one new title, so every cache is cold at the same second, start and control-plane rates are very high, and any error triggers synchronized retries.",
        },
        {
          kind: "number",
          prompt: "With the chapter's assumptions (48 hot objects, 3 CDNs), how many requests reach the origin at T0 with one shield per CDN and collapsing?",
          answer: 144,
          tolerance: 2,
          unit: "requests",
          explain: "3 x 48 = **144**, versus 300 x 30 x 48 = 432,000 with no collapsing and no shield.",
        },
        {
          kind: "quiz",
          prompt: "Which single mistake destroys that benefit?",
          options: [
            "A per-user token (or any unique parameter) in the cache key",
            "Using three CDNs instead of one",
            "Putting the shield close to the origin",
            "Pre-warming the shields",
          ],
          answer: 0,
          explain: "A per-user token or any unique parameter in the cache key makes every request unique, so nothing collapses.",
        },
        {
          kind: "reveal",
          prompt: "Explain the 404 trap and give two ways to prevent it.",
          answer: "An early request gets a 404 that the CDN caches (CloudFront: 10 s by default), so real viewers at T0 get \"not found\". Prevent it with bottom-up publishing and no URLs before objects exist, \"not yet available\" answers from the playback API, version-unique URLs, and deliberate short negative caching.",
        },
        {
          kind: "number",
          prompt: "A 40/35/25 split of an 8 Tbps peak. The 40% CDN fails. What must the 35% CDN carry?",
          answer: 4.67,
          tolerance: 0.1,
          unit: "Tbps",
          explain: "8 x 35/60 = about **4.67 Tbps**, 1.67x its planned 2.8 Tbps.",
        },
        {
          kind: "quiz",
          prompt: "Why must that 35% CDN's shield already be warm?",
          options: [
            "The moved traffic arrives mid-spike; a cold shield would send a new herd to the origin at the worst time",
            "Cold shields are billed at a higher rate",
            "A cold shield cannot accept traffic at all",
            "Warm shields make DNS steering faster",
          ],
          answer: 0,
          explain: "The traffic moves in the middle of the spike. If the receiving shield is cold, the origin gets a second herd exactly when it is busiest.",
        },
        {
          kind: "quiz",
          prompt: "Why is pre-warming shields usually worth more than pre-warming every edge PoP?",
          options: [
            "Shield warm-up is cheap and removes almost all origin load; edge warm-up needs probes in hundreds of networks, risks pollution, and saves only one shield round trip per PoP",
            "Edges cannot be pre-warmed under any CDN",
            "Shields serve viewers directly",
            "Edge pre-warming breaks request collapsing",
          ],
          answer: 0,
          explain: "Shield warm-up costs a few GB per CDN and removes almost all origin load. Edge warm-up needs probes in hundreds of networks or a vendor push feature, risks cache pollution, and saves only one shield round trip per PoP.",
        },
        {
          kind: "multi",
          prompt: "Pick the ways to flatten the control-plane spike at T0. Select all that apply.",
          options: [
            "Scheduled scale-up before T0",
            "Jittered token refresh before T0",
            "Pre-fetched playback info",
            "Priority shedding and degradation switches",
            "Backoff with retry budgets",
            "Firing the home-screen refresh at exactly T0 on every client",
          ],
          answers: [0, 1, 2, 3, 4],
          explain: "Any four of: scheduled scale-up, jittered token refresh before T0, pre-fetched playback info, jitter on automatic refreshes, backoff with retry budgets, caching non-personal responses, priority shedding, degradation switches, small broadcast triggers. A refresh at exactly T0 everywhere is a self-made denial-of-service.",
        },
        {
          kind: "number",
          prompt: "LL-HLS with 0.5 s parts versus classic HLS with 2 s segments. About how many times more requests per viewer?",
          answer: 4,
          tolerance: 0.3,
          unit: "x",
          explain: "About 2 playlist and 2 part requests per viewer per second instead of 0.5 and 0.5: 4 versus 1, so about **4x**.",
        },
        {
          kind: "multi",
          prompt: "Which CDN features become critical with LL-HLS?",
          options: [
            "Collapsing blocked requests with the same `_HLS_msn` and `_HLS_part`",
            "Holding many open connections",
            "Streaming partial responses through every tier",
            "Caching the media playlist for minutes",
          ],
          answers: [0, 1, 2],
          explain: "The CDN must collapse blocked requests, hold many open connections, and stream partial responses through every tier. The media playlist changes every part, so it cannot be cached for minutes.",
        },
        {
          kind: "quiz",
          prompt: "Spikes happen 6 times a month for 1 hour each. With 95th-percentile billing on 5-minute samples, do they set the bill?",
          options: [
            "No: 6 hours is less than the 36 hours discarded, but the capacity must still exist",
            "Yes: any spike above the average sets the bill",
            "Yes: 6 x 12 = 72 samples is more than 5%",
            "No, and the vendor does not need capacity for them either",
          ],
          answer: 0,
          explain: "8,640 samples a month; the top 432 (36 hours) are discarded. 6 hours (72 samples) is less than 36 hours, so the spikes do not set the bill. Capacity must still exist for them.",
        },
        {
          kind: "quiz",
          prompt: "What are CloudFront's documented default quotas per distribution?",
          options: [
            "150 Gbps and 250,000 requests per second, both raisable",
            "1 Tbps and 1M requests per second, fixed",
            "40 Gbps and 100,000 requests per second, fixed",
            "There are no quotas",
          ],
          answer: 0,
          explain: "150 Gbps and 250,000 req/s per distribution, raisable on request. A third of an 8 Tbps peak is about 18x that bandwidth default. Arrange capacity in advance.",
        },
        {
          kind: "number",
          prompt: "Under 10 GB, the hot set of one episode. What is the size of all 7 video renditions alone (23.2 Mbps total x 1,440 s)?",
          answer: 4.2,
          tolerance: 0.3,
          unit: "GB",
          explain: "23.2 x 1,440 = 33,408 Mbit ≈ **4.2 GB**. With audio, subtitles and two encryption variants it stays under 10 GB. The problem is coordination, not storage.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "A premiere is a **flash crowd**; the last event is a poor predictor of the next. The hot set is under 10 GB, so the problem is coordination.",
            "**Request collapsing** at edge and shield cut T0 origin requests from 432,000 to 144; per-user keys, `Vary`, uncacheable responses or pass logic break it silently.",
            "**Staged publish** prevents the 404 trap. **Pre-warm shields**, not every edge, and verify hits with the real cache key.",
            "**Arrange CDN capacity in advance**: per-region forecasts, quota raises (CloudFront: 150 Gbps, 250,000 req/s), N+1 reservations (1.67x for 40/35/25).",
            "The **control plane** often fails first: scheduled scaling, jittered refresh, pre-fetch, retry budgets, priority shedding, degradation switches.",
            "**Live** needs redundant pipelines, immutable segments and a 404-storm plan; LL-HLS costs ~4x requests. **Load test by layer** and measure every premiere.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Wikipedia, \"Crunchyroll\" (accessed November 2026). https://en.wikipedia.org/wiki/Crunchyroll",
    "Anime Corner, \"Funimation and Crunchyroll Down After Attack on Titan Final Season Part 2 Premiere\" (January 2022). https://animecorner.me/funimation-and-crunchyroll-down-after-attack-on-titan-final-season-part-2-premiere/",
    "Republic World, \"Crunchyroll servers down after real-time login errors\" (January 10, 2022). https://republicworld.com/tech/crunchyroll-servers-down-after-real-time-login-errors-know-when-it-will-back-up-articleshow",
    "Yahoo, \"Attack On Titan Finale Crashes Crunchyroll Servers\" (November 6, 2023). https://www.yahoo.com/lifestyle/attack-titan-finale-crashes-crunchyroll-093505429.html",
    "AnimeSenpai, \"Crunchyroll crashes amid One Piece Gear 5 episode\" (August 6, 2023). https://www.animesenpai.net/crunchyroll-crashes-amid-one-piece-gear-5-episode/",
    "Mediaite, report on Netflix's internal memo after Tyson vs Paul (November 16, 2024). https://www.mediaite.com/media/news/after-flood-of-reported-tech-issues-during-tyson-paul-fight-netflix-says-some-had-poor-experience-but-hails-bout-as-huge-success/",
    "EWN, \"Will Netflix's struggles to livestream events have an impact on future live sport broadcasting?\" (November 25, 2024). https://ewn.co.za/2024/11/25/will-netflixs-struggles-to-livestream-events-have-an-impact-on-future-live-sport-broadcasting",
    "InfoQ, \"Netflix live streaming pipeline\" (December 5, 2025). https://www.infoq.com/news/2025/12/netflix-live-streaming-pipeline",
    "Dan Rayburn, \"Netflix Details Its Live Streaming Infrastructure\" (July 2025). https://www.streamingmediablog.com/2025/07/netflix-live-infrastructure.html",
    "Dan Rayburn, \"Detailed Netflix Engineering Post Describes the Custom Origin Server It Built For Live\" (January 13, 2026). https://www.streamingmediablog.com/2026/01/netflix-origin-live.html",
    "Netflix TechBlog, \"Netflix Live Origin\". https://netflixtechblog.com/netflix-live-origin-41f1b0ad5371",
    "Netflix TechBlog, \"Behind the Streams: Live at Netflix, Part 1\" (2025). https://netflixtechblog.com/behind-the-streams-live-at-netflix-part-1-d23f917c2f40",
    "Streaming Learning Center, \"Netflix's Masterclass: Engineering Live Streaming at Scale\". https://streaminglearningcenter.com/encoding/netflixs-masterclass-engineering-live-streaming-at-scale.html",
    "Netflix TechBlog, \"Behind the Streams: Real-Time Recommendations for Live Events\" (2025). https://netflixtechblog.com/behind-the-streams-real-time-recommendations-for-live-events-e027cb313f8f",
    "Classmethod, report on AWS re:Invent 2019 CMY302, \"How Hotstar.com dealt with 25 million concurrent viewers\". https://dev.classmethod.jp/articles/reinvent-2019-cmy302/",
    "Hasgeek Rootconf 2019, \"Scaling hotstar.com for 25 million concurrent viewers\". https://hasgeek.com/rootconf/2019-hyderabad/sub/scaling-hotstar-com-for-25-million-concurrent-view-JAMnectbppSK5Dk8LGAuqy",
    "Hotstar Engineering, \"Scaling Infrastructure for Millions: From Challenges to Triumphs, Part 1\". https://blog.hotstar.com/scaling-infrastructure-for-millions-from-challenges-to-triumphs-part-1-6099141a99ef",
    "ByteByteGo, \"How Disney Hotstar (now JioHotstar) Scaled Its Infra for 60 Million Concurrent Users\" (November 18, 2025). https://blog.bytebytego.com/p/how-disney-hotstar-now-jiohotstar",
    "Storyboard18, \"JioCinema sets new world record with 3.21 Crore peak concurrency during TATA IPL 2023 final\" (May 31, 2023). https://www.storyboard18.com/quantum-brief/jiocinema-sets-new-world-record-with-3-21-crore-peak-concurrency-during-tata-ipl-2023-final-8586.htm",
    "Wikipedia, \"Super Bowl LIX\". https://en.wikipedia.org/wiki/Super_Bowl_LIX",
    "AWS, \"Use Amazon CloudFront Origin Shield\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html",
    "AWS, \"Request and response behavior for custom origins\" (request collapsing). https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html",
    "AWS, \"Control how long CloudFront caches errors\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-expiration.html",
    "AWS, \"Quotas\", CloudFront Developer Guide. https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html",
    "Fastly, \"Request collapsing\". https://www.fastly.com/documentation/guides/concepts/edge-state/cache/request-collapsing/",
    "R. Pantos, \"HTTP Live Streaming 2nd Edition\", draft-pantos-hls-rfc8216bis-22 (May 2026). https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis",
    "DASH Industry Forum, \"Low-latency Modes for DASH\", IOP change request (March 27, 2020). https://dashif.org/docs/CR-Low-Latency-Live-r8.pdf",
    "Netflix, \"A cooperative approach to content delivery\", Open Connect briefing paper (2021). https://openconnect.netflix.com/Open-Connect-Briefing-Paper.pdf",
  ],
};

export default chapter;
