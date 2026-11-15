import type { Chapter, FlowSpec, FlowNode, FlowEdge, SequenceSpec, Tone } from "./types";

// Chapter 17 content. Source: chapters/17-how-the-giants-deliver.md
// Every company is drawn with the SAME six-layer flow spec (see `lens`), with different sub-labels and focus.

/* ---------------- The six-layer lens ---------------- */

type LayerId = "o" | "d" | "e" | "s" | "q" | "c";
type LayerSubs = Partial<Record<LayerId, string>>;

const LAYER_BASE: FlowNode[] = [
  { id: "o", label: "L1 Origin", sub: "prep + storage", kind: "storage", col: 0, row: 0 },
  { id: "d", label: "L2 Distribution", sub: "pull or push", kind: "queue", col: 1, row: 0 },
  { id: "e", label: "L3 Edge footprint", sub: "whose servers", kind: "edge", col: 2, row: 0 },
  { id: "s", label: "L4 Steering", sub: "which CDN or server", kind: "steering", col: 2, row: 1 },
  { id: "q", label: "L5 Player + QoE", sub: "measure and feed back", kind: "player", col: 1, row: 1 },
  { id: "c", label: "L6 Control plane", sub: "before the first byte", kind: "service", col: 1, row: 2 },
];

const LAYER_EDGES: FlowEdge[] = [
  { from: "o", to: "d" },
  { from: "d", to: "e" },
  { from: "e", to: "s" },
  { from: "s", to: "q" },
  { from: "q", to: "c", dashed: true, label: "QoE data" },
  { from: "c", to: "s", dashed: true, label: "decides" },
];

/** The same six-layer diagram for every company. `subs` replaces the small second line per layer. */
function lens(
  subs: LayerSubs = {},
  focus?: string[],
  flow?: string[],
  tones: Partial<Record<LayerId, Tone>> = {},
  badges: Partial<Record<LayerId, string>> = {},
): FlowSpec {
  const spec: FlowSpec = {
    nodes: LAYER_BASE.map((n) => {
      const id = n.id as LayerId;
      const node: FlowNode = { ...n, sub: subs[id] ?? n.sub };
      if (tones[id]) node.tone = tones[id];
      if (badges[id]) node.badge = badges[id];
      return node;
    }),
    edges: LAYER_EDGES.map((e) => ({ ...e })),
  };
  if (focus) spec.focus = focus;
  if (flow) spec.flow = flow;
  return spec;
}

const BYTES_PATH = ["o>d", "d>e", "e>s", "s>q"];

const NETFLIX: LayerSubs = {
  o: "AWS (control side)",
  d: "push in fill windows",
  e: "own OCAs, IXPs + ISPs",
  s: "URLs from steering",
  q: "player measures QoE",
  c: "AWS: before play",
};
const GOOGLE: LayerSubs = {
  o: "Google data centers",
  d: "pull into GGC",
  e: "own network + GGC",
  s: "transparent to users",
  q: "QUIC at the transport",
  c: "Google",
};
const PRIME: LayerSubs = {
  o: "AWS",
  d: "pull",
  e: "CloudFront",
  s: "not published",
  q: "not published",
  c: "AWS",
};
const DISNEY: LayerSubs = {
  o: "Disney Streaming",
  d: "pull",
  e: "commercial CDNs",
  s: "session start (Hulu)",
  q: "not published",
  c: "login, entitlement",
};
const TWITCH: LayerSubs = {
  o: "origin DCs transcode",
  d: "live, no catalog",
  e: "~100 own PoPs",
  s: "Intelligest ingest",
  q: "not covered",
  c: "routing in AWS",
};
const CRUNCHY: LayerSubs = {
  o: "AWS and GCP (2026)",
  d: "pull (assumed)",
  e: "several commercial CDNs",
  s: "Katana edge rules, 2020",
  q: "client rollups, 2020",
  c: "AWS since 2017",
};

/* ---------------- Netflix playback sequence ---------------- */

function netflixSeq(upTo?: number): SequenceSpec {
  const spec: SequenceSpec = {
    actors: [
      { id: "oca", label: "OCA in ISP/IXP", kind: "edge" },
      { id: "cc", label: "Cache control", kind: "service" },
      { id: "pa", label: "Playback (AWS)", kind: "api" },
      { id: "st", label: "Steering (AWS)", kind: "steering" },
      { id: "c", label: "Client", kind: "device" },
    ],
    messages: [
      { from: "oca", to: "cc", label: "Health, BGP routes, files", dashed: true },
      { from: "c", to: "pa", label: "Play this title" },
      { from: "pa", to: "pa", label: "Check auth + licensing, pick files" },
      { from: "pa", to: "st", label: "Which OCAs for these files?" },
      { from: "st", to: "pa", label: "Ranked OCA URLs", tone: "accent" },
      { from: "pa", to: "c", label: "Playback response with OCA URLs" },
      { from: "c", to: "oca", label: "Segment or range requests", tone: "good" },
    ],
  };
  if (upTo !== undefined) spec.upTo = upTo;
  return spec;
}

/* ---------------- Crunchyroll timeline (two halves, max 10 nodes each) ---------------- */

const TIMELINE_A: FlowSpec = {
  nodes: [
    { id: "a", label: "2015 Ellation", sub: "formed under Otter Media", kind: "generic", col: 0, row: 1 },
    { id: "b", label: "2016 VRV", sub: "VRV launches", kind: "player", col: 1, row: 1 },
    { id: "c", label: "Feb 2017 1M subs", sub: "paid subscribers", kind: "viewer", col: 2, row: 1 },
    { id: "d", label: "2017 cloud move", sub: "Mar-Apr: encode + delivery", kind: "cloud", col: 3, row: 1 },
    { id: "e", label: "Nov 2017 hijack", sub: "DNS, about six hours", kind: "dns", col: 4, row: 1, tone: "bad" },
    { id: "f", label: "Feb 2020 rollups", sub: "client-side QoE", kind: "monitor", col: 5, row: 1 },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "c", to: "d" },
    { from: "d", to: "e" },
    { from: "e", to: "f" },
  ],
};

const TIMELINE_B: FlowSpec = {
  nodes: [
    { id: "g", label: "Nov 2020 Katana", sub: "edge playback, one trip", kind: "edge", col: 0, row: 1, tone: "accent" },
    { id: "h", label: "Aug 2021 Sony", sub: "acquisition completes", kind: "generic", col: 1, row: 1 },
    { id: "i", label: "Mar 2022 merge", sub: "Funimation, Wakanim, VRV", kind: "service", col: 2, row: 1 },
    { id: "j", label: "Apr 2023 VRV off", sub: "VRV shuts down", kind: "player", col: 3, row: 1 },
    { id: "k", label: "Apr 2024 shutdown", sub: "Funimation app closes", kind: "player", col: 4, row: 1 },
    { id: "l", label: "2026 job posting", sub: "multi-CDN, AWS and GCP", kind: "cdn", col: 5, row: 1 },
  ],
  edges: [
    { from: "g", to: "h" },
    { from: "h", to: "i" },
    { from: "i", to: "j" },
    { from: "j", to: "k" },
    { from: "k", to: "l" },
  ],
};

/* ---------------- Katana: before and after ---------------- */

const KATANA_BEFORE: FlowSpec = {
  nodes: [
    { id: "p", label: "Player", sub: "on the device", kind: "player", col: 2, row: 1, tone: "accent" },
    { id: "s1", label: "Stream list API", sub: "domain 1", kind: "api", col: 0, row: 0 },
    { id: "s2", label: "Multi-CDN service", sub: "rewrites the manifest", kind: "steering", col: 4, row: 0 },
    { id: "s3", label: "DRM token auth", sub: "domain 3", kind: "drm", col: 0, row: 2 },
    { id: "s4", label: "SSAI service", sub: "domain 4", kind: "service", col: 4, row: 2 },
    { id: "s5", label: "Manifest fetch", sub: "then segments", kind: "cdn", col: 2, row: 3 },
  ],
  edges: [
    { from: "p", to: "s1", label: "1" },
    { from: "p", to: "s2", label: "2" },
    { from: "p", to: "s3", label: "3" },
    { from: "p", to: "s4", label: "4" },
    { from: "p", to: "s5", label: "5" },
  ],
  flow: ["p>s1", "p>s2", "p>s3", "p>s4", "p>s5"],
};

const KATANA_AFTER_NODES: FlowNode[] = [
  { id: "p", label: "Player", kind: "player", col: 0, row: 2 },
  { id: "k", label: "Katana", sub: "on Lambda@Edge", kind: "edge", col: 1, row: 2, tone: "accent" },
  { id: "m", label: "Lambda memory", sub: "cache tier one, 1024 MB", kind: "cache", col: 2, row: 2 },
  { id: "cf", label: "CloudFront", sub: "fail-through cache", kind: "cdn", col: 3, row: 2 },
  { id: "o", label: "Origin", sub: "rarely", kind: "origin", col: 4, row: 2 },
];
const KATANA_AFTER_EDGES: FlowEdge[] = [
  { from: "p", to: "k", label: "one round trip" },
  { from: "k", to: "m" },
  { from: "m", to: "cf", label: "miss" },
  { from: "cf", to: "o", label: "miss", dashed: true },
];
function katanaAfter(focus?: string[], flow?: string[]): FlowSpec {
  const spec: FlowSpec = {
    nodes: KATANA_AFTER_NODES.map((n) => ({ ...n })),
    edges: KATANA_AFTER_EDGES.map((e) => ({ ...e })),
    groups: [{ id: "edge", label: "With Katana, at the edge", nodes: ["k", "m", "cf"], tone: "good" }],
  };
  if (focus) spec.focus = focus;
  if (flow) spec.flow = flow;
  return spec;
}

/* ---------------- Own the edge or rent it? ---------------- */

const OWN_NODES: FlowNode[] = [
  { id: "r1", label: "Rent multi-CDN", sub: "commercial CDNs", kind: "cdn", col: 0, row: 2, tone: "good" },
  { id: "q1", label: "Top ISP > 25 Gbps?", sub: "peak egress in one ISP", kind: "isp", col: 0, row: 0 },
  { id: "q2", label: "Predict demand?", sub: "well enough to push", kind: "generic", col: 1, row: 0 },
  { id: "q3", label: "Traffic steady?", sub: "keeps owned boxes busy", kind: "generic", col: 1, row: 2 },
  { id: "q4", label: "Staff for it?", sub: "hardware, ISPs, 24x7 ops", kind: "generic", col: 2, row: 1 },
  { id: "r3", label: "Hybrid", sub: "own top ISPs, rent rest", kind: "pop", col: 3, row: 0, tone: "accent" },
  { id: "r2", label: "Rent + ISP deals", sub: "ISP-specific CDN deals", kind: "cdn", col: 3, row: 2, tone: "good" },
];

const OWN_EDGES: FlowEdge[] = [
  { from: "q1", to: "r1", label: "No" },
  { from: "q1", to: "q2", label: "Yes" },
  { from: "q2", to: "q3", label: "No" },
  { from: "q2", to: "q4", label: "Yes" },
  { from: "q3", to: "r1", label: "No" },
  { from: "q3", to: "q4", label: "Yes" },
  { from: "q4", to: "r2", label: "No" },
  { from: "q4", to: "r3", label: "Yes" },
];
function ownOrRent(focus?: string[], flow?: string[]): FlowSpec {
  const spec: FlowSpec = {
    nodes: OWN_NODES.map((n) => ({ ...n })),
    edges: OWN_EDGES.map((e) => ({ ...e })),
  };
  if (focus) spec.focus = focus;
  if (flow) spec.flow = flow;
  return spec;
}

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 17,
  title: "How the Giants Deliver Video",
  short: "The giants",
  part: 6,
  hook: "Netflix built its own CDN. Prime Video did not. What each giant chose, and why.",
  lessons: [
    /* ============ Lesson 1: the lens ============ */
    {
      id: "ch17-l1",
      title: "One lens for every company",
      goal: "Describe any streaming company's delivery system with the same six layers and six questions.",
      minutes: 8,
      steps: [
        {
          kind: "read",
          title: "Same problem, different choices",
          body: "Netflix built its own CDN. Prime Video uses its parent company's CDN. Crunchyroll rents several CDNs from different vendors.\n\nWhy would smart teams choose so differently? This lesson gives you one simple **lens**: six layers, and six questions to ask about each one.\n\nBy the end, you can describe any streaming company's delivery system the same way, and compare companies side by side.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. Netflix, Prime Video and Crunchyroll chose very different delivery setups. What would you expect: do they solve **different** problems?",
          options: [
            "Yes: VOD, live sports and anime need different kinds of networks",
            "No: the problem is the same, but their choices differ because of size, catalog and traffic shape",
            "No: they all run the same architecture, only the vendor names differ",
          ],
          answer: 1,
          explain: "Every company has the same problem: a file in a data center, and millions of people who want small pieces of it right now, on bad networks and thousands of device types. The **choices** differ, because size, catalog and traffic shape differ. The reasons behind those choices are what this chapter is about.",
        },
        {
          kind: "read",
          title: "Why study the giants",
          body: "This chapter builds a mental library of **reference designs**: real systems, with their reasons and costs, that you can point to in a design review.\n\nWhen someone asks \"why don't we just build our own CDN like Netflix?\", you should be able to answer in two minutes, with numbers.",
        },
        {
          kind: "read",
          title: "Every claim has a year",
          body: "A warning before we start. Companies publish what makes them look good, often years after they built it.\n\nSo every claim in this chapter has a **year**. Treat an old engineering post as **history**: true for its year, and possibly replaced since.\n\nFor Crunchyroll especially, we keep two things apart: what was **published**, and what a platform like Crunchyroll **would likely** do. The second kind is always marked as assumed.",
        },
        {
          kind: "quiz",
          teach: "Think about what can happen to a real system in the years after a post about it is written.",
          prompt: "You find a company engineering post from 2016 that describes its CDN in detail. How should you treat it?",
          options: [
            "As an exact description of the system today",
            "As history: true for its year, and possibly replaced since",
            "As marketing with no value",
          ],
          answer: 1,
          explain: "Companies publish what makes them look good, years after they built it. So every claim in this chapter has a year. Treat old posts as **history**, not as a description of today. They still have value: they show real choices and their reasons.",
        },
        {
          kind: "read",
          title: "The six layers",
          body: "Chapter 1 drew the full path from studio to screen. Here it is compressed into six **layers**: six parts of that path where companies make different delivery decisions.\n\nThe bytes travel L1 to L5. The control plane (L6) decides the steering, and QoE data from the player flows back into it.",
          visual: { kind: "flow", spec: lens({}, undefined, BYTES_PATH), caption: "The six-layer delivery model. Every company in this chapter is drawn with this same diagram." },
        },
        {
          kind: "read",
          title: "L1 and L2: where files live, how they move",
          body: "**L1 Origin.** Where do packaged files live? One cloud or several? Static or [[just-in-time packaging|Just-in-time packaging (JIT)]]?\n\n**L2 Distribution.** Does the edge **pull** content on a cache miss (the normal CDN model)? Or does the company **push** content to the edge before anyone asks (**pre-positioning**)?\n\nPull works for any catalog. Push needs good prediction of demand, but it removes **cold misses**: misses on the first request, when no nearby cache has the file yet.",
          visual: { kind: "flow", spec: lens({}, ["o", "d", "o>d"]) },
        },
        {
          kind: "quiz",
          teach: "Compare when each model puts a file on the edge: before anyone asks, or only after a first request misses.",
          prompt: "Which distribution model removes cold misses, and what does it need in return?",
          options: [
            "Pull; it needs nothing extra",
            "Push (pre-positioning); it needs good prediction of demand",
            "Pull; it needs a bigger cache",
          ],
          answer: 1,
          explain: "Push puts files on the edge before anyone asks, so the first viewer does not cause a miss. It only works if you can predict what will be watched. Pull works for any catalog, but the first request in a region always misses.",
        },
        {
          kind: "read",
          title: "L3: whose servers send the bytes",
          body: "**L3 Edge footprint.** Who owns the servers that send bytes to viewers? There are three options:\n\n- rent a commercial CDN\n- run your own [[PoPs|PoP]] (points of presence) in colocation sites\n- place [[embedded caches|Embedded cache]] inside ISP networks\n\nMany companies mix these.",
          visual: { kind: "flow", spec: lens({}, ["e", "d>e"]) },
        },
        {
          kind: "read",
          title: "L4 and L5: steering and feedback",
          body: "**L4 Steering.** How is a client sent to a specific CDN or server? By DNS answers, by URLs from a playback API, by CDN lists in a manifest, or by player-side switching (Chapter 9).\n\n**L5 Player and QoE feedback.** Does the company measure what viewers experience and feed it back into steering (Chapters 10 and 11)?",
          visual: { kind: "flow", spec: lens({}, ["s", "q", "s>q", "q>c"]) },
        },
        {
          kind: "read",
          title: "L6: the control plane",
          body: "**L6 Control plane.** These services run before the first video byte: login, [[entitlement]], playback API, DRM license, steering.\n\nThe control plane usually runs in a public cloud, even when the bytes path does not.",
          visual: { kind: "flow", spec: lens({}, ["c", "c>s", "q>c"]) },
        },
        {
          kind: "read",
          title: "Two planes",
          body: "Chapter 1 split every delivery system into two parts.\n\n- The **[[control plane]]** decides: who may watch, which file, which server.\n- The **[[data plane]]** carries the video bytes to the viewer.\n\nExample: checking your subscription is control plane. Sending you segment 42 is data plane.\n\nAlmost every company in this chapter has this split. They differ in **who owns the data plane**.",
        },
        {
          kind: "quiz",
          teach: "One plane decides what should happen; the other carries the video bytes. Ask which side of \"play\" each one sits on.",
          prompt: "Netflix said in 2016: \"Essentially everything before you hit 'play' happens in AWS,\" and everything after play runs on Netflix's own network. Which split is that?",
          options: [
            "Origin versus edge",
            "[[Control plane]] versus [[data plane]]",
            "Push versus pull",
            "VOD versus live",
          ],
          answer: 1,
          explain: "It is the control plane versus data plane split. Before play, AWS runs the deciding services. After play, Netflix's own network carries the bytes. Almost every company in this chapter has this split. They differ in **who owns the data plane**.",
        },
        {
          kind: "match",
          teach: "Each question is about one layer. Recall what each layer is about: moving files to the edge, owning servers, sending a client somewhere, or work done before the first byte.",
          prompt: "Match each question to its layer.",
          pairs: [
            ["Does the edge fetch on a miss, or get files before anyone asks?", "L2 Distribution"],
            ["Rent a CDN, own PoPs, or boxes inside ISPs?", "L3 Edge footprint"],
            ["DNS, playback API URLs, manifest or player switching?", "L4 Steering"],
            ["Login, entitlement, DRM license before the first byte?", "L6 Control plane"],
          ],
          explain: "L2 is pull versus push. L3 is who owns the servers. L4 is how a client is sent to a server. L6 is everything that runs before the first video byte.",
        },
        {
          kind: "read",
          title: "Use the lens",
          body: "From now on, each company gets the same diagram with its own answers written in. Watch two layers closely: **edge footprint** and **steering**. That is where the real differences are.",
          callout: { type: "staff", text: "When you read any company's delivery story, ask six questions in order. Where is the origin? Push or pull? Whose edge? How are clients steered? Is QoE fed back into steering? Where does the control plane run, and can playback continue if it degrades? A gap in the answers is often where the interesting problems live." },
        },
        {
          kind: "order",
          teach: "The six questions follow the six layers, from where the files start, to what runs before playback.",
          prompt: "The Staff lens gives six questions to ask, in order, about any company's delivery story. Put them in order.",
          items: [
            "Where is the origin?",
            "Push or pull?",
            "Whose edge?",
            "How are clients steered?",
            "Is QoE fed back into steering?",
            "Where does the control plane run, and can playback continue if it degrades?",
          ],
          explain: "The questions follow the layers L1 to L6. A gap in the answers is often where the interesting problems live.",
        },
        {
          kind: "summary",
          points: [
            "Every streaming company solves the same problem but makes different choices.",
            "Six layers: L1 origin, L2 push or pull, L3 edge footprint, L4 steering, L5 QoE feedback, L6 control plane.",
            "The control plane runs before the first byte and usually lives in a public cloud.",
            "Every claim has a year. Old posts are history, not today.",
            "The real differences between companies are in edge footprint and steering.",
          ],
        },
      ],
    },

    /* ============ Lesson 2: Netflix ============ */
    {
      id: "ch17-l2",
      title: "Netflix: own CDN, pushed bytes",
      goal: "Explain how Open Connect pushes content, steers by URL, and why live video breaks the push model.",
      minutes: 11,
      steps: [
        {
          kind: "read",
          title: "The company that built its own CDN",
          body: "Netflix is the most famous company that built its **own** CDN instead of renting one. It runs its own cache servers, many of them inside the networks of Internet providers.\n\nIn this lesson you will learn why Netflix did it, how its boxes and its steering work, and what broke when Netflix tried live video. By the end, you can explain Netflix's design, and say which parts a smaller company can copy.",
          visual: { kind: "flow", spec: lens(NETFLIX), caption: "Netflix on the six-layer lens." },
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. A normal CDN caches whatever people ask for. Netflix knows its catalog and its viewers very well. What would you expect it to do instead?",
          options: [
            "Decide in advance which files go on which server, and copy them there before anyone asks",
            "Turn off caching and stream every request from AWS",
            "Use a longer TTL on every object",
          ],
          answer: 0,
          explain: "Netflix chose **directed caching**: it decides in advance which files go on which server, and copies them there before anyone asks. This only works because it can predict demand well. A longer TTL only changes how long a copy stays, not where it goes, and turning off caching would send every request far away.",
        },
        {
          kind: "read",
          title: "Why Netflix built Open Connect",
          body: "Netflix started [[Open Connect]] in 2011 for two reasons.\n\n- It had become a large share of ISP traffic, so it needed to work with ISPs \"in a direct and collaborative way.\"\n- A Netflix-only CDN allowed \"a proactive, directed caching solution\". Netflix says this cut demand on upstream capacity \"by several orders of magnitude.\"",
          visual: { kind: "flow", spec: lens(NETFLIX, ["e", "d", "d>e"]), caption: "Netflix on the six-layer lens." },
        },
        {
          kind: "read",
          title: "Demand-driven versus directed",
          body: "A normal CDN is **demand-driven**: it caches what people ask for, and a miss goes upstream.\n\nNetflix uses **directed caching**: it decides in advance which files go on which server.\n\nIn 2016 Netflix said Open Connect delivered 100 percent of its video traffic from appliances in close to 1,000 locations. Close to 90 percent of traffic went over direct connections to residential ISPs.",
          visual: { kind: "stats", items: [
            { value: "2011", label: "Open Connect started" },
            { value: "100%", label: "of video from own appliances", note: "2016" },
            { value: "~1,000", label: "locations", note: "2016" },
            { value: "~90%", label: "over direct ISP connections", note: "2016" },
          ] },
        },
        {
          kind: "read",
          title: "The Open Connect Appliance",
          body: "The building block is the [[OCA]], a purpose-built cache server. It is deployed two ways:\n\n- at [[Internet exchange points|IXP]] in big markets, connected to ISPs by settlement-free [[peering]]\n- **embedded inside ISP networks**, given free to qualifying ISPs. The ISP provides power, space and connectivity, and decides which customers are routed to it.\n\nThe software is FreeBSD, NGINX for HTTP, and the BIRD routing daemon.",
          visual: { kind: "table", headers: ["Appliance (2U)", "Storage", "Throughput", "For"], rows: [
            ["Storage appliance", "up to 120 TB", "about 200 Gbps", "large deployments"],
            ["Global appliance", "up to 60 TB", "about 80 Gbps", "smaller ISPs, emerging markets"],
          ], caption: "Current Netflix documentation." },
        },
        {
          kind: "read",
          title: "What an OCA does not hold",
          body: "The key design detail is what an OCA does **not** do. It holds no member data, no viewing history and no DRM information.\n\nIt does only two jobs:\n\n- serve files over HTTP or HTTPS\n- report to the control plane in AWS: its health, the [[BGP]] routes it learned (the network paths that say which addresses it can reach), and the list of files on its disk",
        },
        {
          kind: "multi",
          teach: "Recall the two jobs an OCA does. Anything outside those two jobs is not on the box.",
          prompt: "What does an OCA hold or do? Select all that apply.",
          options: [
            "Serve files over HTTP or HTTPS",
            "Report health, learned BGP routes and its file list to AWS",
            "Store member viewing history",
            "Hold DRM information",
          ],
          answers: [0, 1],
          explain: "An OCA holds no member data, viewing history or DRM information. It only reports health, BGP routes and its file list to the control plane in AWS, and serves files.",
        },
        {
          kind: "read",
          title: "The playback flow, step 1",
          body: "Before any viewer arrives, each OCA reports its health, the BGP routes it learned, and the files on its disk to cache control in AWS.\n\nThen a client asks the playback services: \"Play this title.\" Playback checks authorization and licensing, and picks the files.",
          visual: { kind: "sequence", spec: netflixSeq(2), caption: "Netflix's published playback flow." },
        },
        {
          kind: "read",
          title: "The playback flow, step 2",
          body: "Playback asks the steering service which OCAs to use for these files. Steering returns a ranked list of OCA URLs. Playback puts them in its response. The client then sends segment or range requests straight to the OCA.",
          visual: { kind: "sequence", spec: netflixSeq() },
        },
        {
          kind: "read",
          title: "Steering by URL, not DNS",
          body: "Chapter 3 showed why DNS [[steering]] is coarse. A DNS server sees the **resolver** (the DNS helper run by the ISP or a public service), not the viewer. And its answer is reused for a **TTL**, so one decision covers many people for minutes.\n\nNetflix's steering service instead writes OCA addresses into the URLs of the playback response. It picks OCAs by file availability, health and proximity, **for each playback**.",
        },
        {
          kind: "quiz",
          teach: "Compare what each method knows at the moment it decides: the resolver's location and a reused answer, or this one playback request.",
          prompt: "Netflix steers clients by writing OCA addresses into URLs, not by DNS. Why is that better?",
          visual: { kind: "sequence", spec: netflixSeq() },
          options: [
            "DNS is not available on smart TVs",
            "The decision is made per playback with full knowledge of the client, not from the resolver's location and a TTL",
            "URLs are cached longer than DNS answers",
          ],
          answer: 1,
          explain: "DNS steering sees the resolver, not the client, and its answers live for a TTL. URL steering avoids that, because the steering service picks OCAs by file availability, health and proximity for each playback.",
        },
        {
          kind: "read",
          title: "BGP feeds steering",
          body: "Each OCA learns routes from the ISP router beside it. So the control plane knows which client prefixes (blocks of addresses) each OCA reaches **directly**. That is a very strong proximity signal.\n\nThe control plane also owns fill and file placement.",
          visual: { kind: "flow", spec: lens(NETFLIX, ["s", "c", "c>s"]) },
        },
        {
          kind: "read",
          title: "Fill windows: the push model",
          body: "Netflix says it can \"predict with high accuracy what our members will watch and what time of day they will watch it.\" So it pushes most content to OCAs during off-peak **fill windows**. OCAs can fill from each other to spare Internet backbones.\n\nIn 2016 it described copying each file once per continent off-peak, then replicating to servers inside ISPs, to avoid expensive undersea capacity at busy times.",
          visual: { kind: "flow", spec: lens(NETFLIX, ["o", "d", "e", "o>d", "d>e"], ["o>d", "d>e"]) },
        },
        {
          kind: "quiz",
          teach: "With push, the file is copied to the box before viewers arrive. Ask when a viewer could still fail to find it there.",
          prompt: "In a pull CDN, the first viewer of a file in a region always causes a miss. With push and good prediction, what is a miss?",
          options: [
            "A normal part of every first view",
            "A prediction error",
            "Impossible",
          ],
          answer: 1,
          explain: "With push, the file is on the box before the first viewer arrives. Misses become prediction errors, not normal operation. They are rare, but not impossible.",
        },
        {
          kind: "read",
          title: "Misses still happen",
          body: "A title that suddenly becomes popular, or a failed box, still sends clients elsewhere. Netflix handles that with steering: it sends the client to an OCA that **has** the file. It does not rely on a deep pull hierarchy.",
          callout: { type: "mistake", text: "Saying \"Netflix has a 100 percent cache hit ratio.\" The correct claim is that Netflix makes misses rare and cheap." },
        },
        {
          kind: "read",
          title: "Netflix goes live",
          body: "Live video breaks the push model: you cannot pre-position a segment that does not exist yet.\n\nOn 15 November 2024 Netflix streamed Jake Paul vs. Mike Tyson. It reported an average minute audience of 108 million viewers and a peak of 65 million concurrent streams. The same night USA Today reported widespread buffering, and CNN reported about 90,000 Downdetector outage reports in the hour before the fight.",
          visual: { kind: "stats", items: [
            { value: "108M", label: "average minute audience" },
            { value: "65M", label: "peak concurrent streams" },
            { value: "~90,000", label: "Downdetector reports", note: "hour before the fight" },
          ], caption: "15 November 2024." },
        },
        {
          kind: "read",
          title: "Worked example: viewers to bandwidth",
          body: "**Egress** is the traffic leaving servers toward viewers. To size it, multiply concurrent streams by the bitrate of each stream:\n\n**egress = streams x bitrate**\n\nExample, the Crunchyroll assumed model: 2,000,000 streams x 4 Mbps = 8,000,000 Mbps.\n\nNow convert. 1 Tbps = 1,000 Gbps = 1,000,000 Mbps. So 8,000,000 Mbps / 1,000,000 = **8 Tbps**, the assumed simulcast peak.",
        },
        {
          kind: "number",
          teach: "Multiply streams by bitrate to get Mbps, then divide by 1,000,000 to get Tbps.",
          prompt: "**Assume** 5 Mbps per stream (Netflix did not publish it). How much egress do 65 million concurrent streams need?",
          answer: 325,
          tolerance: 15,
          unit: "Tbps",
          hint: "65,000,000 x 5 Mbps, then convert Mbps to Tbps (divide by 1,000,000).",
          explain: "65,000,000 x 5 Mbps = 325,000,000 Mbps = **about 325 Tbps**. That is roughly 40 times the assumed Crunchyroll simulcast peak of 8 Tbps.",
        },
        {
          kind: "reveal",
          prompt: "Many viewers saw buffering on fight night. Does that mean Netflix's CDN is badly designed? Think about it, then reveal.",
          answer: "No. The lesson is not \"Netflix failed.\" Push and fill windows are tuned for **predictable VOD**. Synchronized live is a different traffic shape: segments exist only seconds before they are watched, and everyone asks for them at once. A system tuned for one traffic shape needs real changes for another. Chapter 13 covers live mechanics.",
        },
        {
          kind: "read",
          title: "What transfers to Crunchyroll",
          body: "Crunchyroll is not Netflix. But two ideas carry over directly, at any size.",
          callout: { type: "crunchyroll", text: "Nothing published suggests Crunchyroll runs its own appliances. What transfers is the idea: make the steering decision in the playback path with full knowledge of the session, and make sure edge nodes never need the control plane to serve bytes they already hold." },
        },
        {
          kind: "summary",
          points: [
            "Open Connect (2011): own appliances at IXPs and inside ISPs, close to 1,000 locations by 2016.",
            "Directed caching: push files in off-peak fill windows, so misses become prediction errors.",
            "Steering by URL from AWS, using health, file location and BGP proximity.",
            "OCAs hold no member data, viewing history or DRM information.",
            "Live breaks push: 65M peak streams, about 325 Tbps at an assumed 5 Mbps.",
          ],
        },
      ],
    },

    /* ============ Lesson 3: Google, Prime Video, Disney+ ============ */
    {
      id: "ch17-l3",
      title: "Google, Prime Video and Disney+",
      goal: "Contrast owning the network and transport (Google), sitting on a parent's CDN (Prime Video) and buying a platform (Disney).",
      minutes: 11,
      steps: [
        {
          kind: "read",
          title: "Three giants, three choices",
          body: "Netflix owns its edge and pushes files. Three other giants chose differently:\n\n- **Google** owns a global network, and even changed the transport protocol.\n- **Prime Video** sits on its parent company's CDN.\n- **Disney** bought a whole streaming platform.\n\nBy the end of this lesson, you can contrast these three choices, and say where launch-day risk really lives.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. YouTube has a huge **long tail** of user uploads: millions of videos, most watched rarely and at unpredictable times. Could it copy files ahead of time the way Netflix does?",
          options: [
            "Yes, exactly the same way",
            "Not as well: popularity of uploads is hard to predict, so its ISP caches mostly pull",
            "No, YouTube does not use caches inside ISPs at all",
          ],
          answer: 1,
          explain: "A curated catalog is predictable. A [[long tail]] of uploads is not, so you cannot know in advance which files to copy where. So a YouTube cache inside an ISP is a real **pull** cache: it fetches on a miss, backed by Google's network and data centers.",
        },
        {
          kind: "read",
          title: "Google Global Cache",
          body: "[[GGC]] \"allows ISPs to serve certain Google content from within their own networks.\" Google supplies and remotely operates the hardware. The ISP supplies space, power and connectivity, and sets a maximum egress rate.\n\nGoogle says \"typically between 70-90%\" of cacheable traffic can be served from GGC, transparently to users.",
          visual: { kind: "flow", spec: lens(GOOGLE, ["d", "e", "d>e"]), caption: "YouTube and Google on the six-layer lens." },
        },
        {
          kind: "read",
          title: "Changing the transport to fix video",
          body: "Google also changed the **transport protocol**, the layer that moves packets between two computers. Its SIGCOMM 2017 [[QUIC]] paper describes serving Chrome and \"a popular mobile video streaming app (YouTube),\" and estimates that \"7% of Internet traffic is now QUIC.\" QUIC became the IETF transport under [[HTTP/3]] (Chapters 2 and 4).",
          visual: { kind: "flow", spec: lens(GOOGLE, ["q", "s>q"]) },
        },
        {
          kind: "reveal",
          prompt: "Why would a video company care about the transport protocol? Think about it, then reveal.",
          answer: "Slow start and rebuffering are partly **transport** problems. QUIC removes handshake round trips and TCP head-of-line blocking (one lost packet holding up everything behind it). Google's 2022 Media CDN post cites Chrome's QUIC rollout: \"video rebuffer time decreased by more than 9%\" and mobile throughput rose over 7 percent.",
        },
        {
          kind: "read",
          title: "Media CDN: renting out the YouTube edge",
          body: "In April 2022 Google made **Media CDN** generally available: \"the same infrastructure that Google has built over the last decade to serve YouTube content to over 2 billion users.\"\n\nAt launch it claimed 200+ countries and territories and 1,300+ cities, built-in QUIC, [[TLS 1.3]] and [[BBR]], multiple cache tiers to protect origins, Terraform automation and Cloud Armor integration. Launch customer U-NEXT reported 98.3 percent of requests offloaded from its origin.",
          visual: { kind: "stats", items: [
            { value: "2B+", label: "YouTube users served by this edge" },
            { value: "1,300+", label: "cities at launch" },
            { value: "200+", label: "countries and territories" },
            { value: "98.3%", label: "requests offloaded", note: "U-NEXT" },
          ], caption: "Media CDN launch claims, April 2022." },
          callout: { type: "crunchyroll", text: "The 2026 Media Delivery posting names Google Media CDN with Fastly, Akamai and Cloudflare, and lists GCP as a plus. Media CDN pairs naturally with a GCS origin, as CloudFront does with S3. The posting does not say how traffic is split. Do not assume a split; ask." },
        },
        {
          kind: "read",
          title: "Prime Video: the cloud's own CDN",
          body: "Prime Video's parent owns a cloud and a CDN, Amazon CloudFront. AWS's case-study page quotes Prime Video: \"We reliably streamed live football to 18.4 million NFL fans worldwide,\" for Thursday Night Football (TNF), with rights in 200+ countries. The page gives no season.\n\nAmazon took exclusive TNF rights from the 2022 season. The 2022 opener drew 13 million viewers by Nielsen. Amazon announced a record average of 15.3 million per game for 2025.",
          visual: { kind: "flow", spec: lens(PRIME, ["o", "e", "c"]), caption: "Prime Video: L1, L3 and L6 all in AWS." },
        },
        {
          kind: "read",
          title: "The money advantage, and its limit",
          body: "On the lens, L3 is CloudFront on the AWS backbone (Chapter 5). L1 and L6 run in AWS.\n\nChapter 16 explains the money advantage: transfer from AWS origins to CloudFront is free. But that removes only one cost. Edge prices per GB, performance per country and reach into ISPs still differ between CDNs.\n\nThe sources checked here do not say whether Prime Video also uses other CDNs for TNF, so we make no claim.",
          visual: { kind: "flow", spec: lens(PRIME, ["o", "d", "e", "o>d", "d>e"], ["o>d", "d>e"]) },
        },
        {
          kind: "quiz",
          teach: "Free origin fetch removes one cost. Think about what else can differ between CDNs from one country to another.",
          prompt: "A teammate says: \"We use AWS, so CloudFront is automatically the best CDN everywhere.\" What is wrong?",
          options: [
            "Nothing: free origin fetch makes it cheapest and fastest everywhere",
            "Free origin fetch is real, but per-GB edge prices, performance per country and ISP depth vary",
            "CloudFront cannot fetch from S3",
          ],
          answer: 1,
          explain: "Large AWS customers still run [[multi-CDN]] for resilience and leverage. Decide with measured QoE per region and a real price sheet.",
        },
        {
          kind: "read",
          title: "The shape of TNF",
          body: "A live sports game looks a lot like an anime premiere.",
          callout: { type: "industry", text: "TNF has the shape of a simulcast premiere plus live encoding: a known start time, everyone joining at once, a cold cache for each new segment, and a control-plane storm (login, entitlement, DRM) at the same moment as the data-plane peak (Chapter 13)." },
        },
        {
          kind: "read",
          title: "Disney: buying the plumbing",
          body: "**BAMTech** was spun off from MLB Advanced Media, baseball's digital arm, in 2015. Its technology powers ESPN+, Disney+, Hulu and the former Star+.\n\nThis is the **platform company** pattern: one delivery and playback platform serving several brands. Crunchyroll lived a smaller version of it when Funimation, VRV and Wakanim were folded in.",
          visual: { kind: "flow", spec: lens(DISNEY, ["o", "c"]), caption: "Disney+ and Hulu on the six-layer lens." },
        },
        {
          kind: "read",
          title: "From spin-off to sole owner",
          body: "Disney did not build its streaming platform. It bought one, step by step, over seven years.",
          visual: { kind: "table", headers: ["Year", "Step"], rows: [
            ["2015", "BAMTech spun off from MLB Advanced Media"],
            ["2016", "Disney buys a third for 1 billion US dollars"],
            ["2017", "Disney takes a controlling 75 percent"],
            ["2018", "Renamed Disney Streaming Services"],
            ["2021", "Renamed Disney Streaming"],
            ["November 2022", "Disney becomes sole owner"],
          ], caption: "Disney's path to owning BAMTech." },
        },
        {
          kind: "read",
          title: "Disney+ launch day",
          body: "Disney+ launched on 12 November 2019 in the US, Canada and the Netherlands. It had more than 10 million sign-ups on day one.\n\nUsers reported problems mostly with **logging in** and with **accessing specific content**.\n\nUse the six-layer lens from lesson 1 to place the problem.",
          visual: { kind: "flow", spec: lens(DISNEY) },
        },
        {
          kind: "quiz",
          teach: "Ask whether logging in and getting access to a title happen before or after the first video byte. Then recall which layer covers that time.",
          prompt: "Disney+ launch-day problems were mostly with logging in and accessing specific content. Which layer was that?",
          visual: { kind: "flow", spec: lens(DISNEY) },
          options: ["L3 Edge footprint", "L4 Steering", "L6 Control plane", "L1 Origin"],
          answer: 2,
          explain: "Login and content access are control-plane services (L6), not CDN bytes. Big launches are often limited by authentication, [[entitlement]], catalog APIs and DRM. These are stateful and harder to scale than a cache.",
        },
        {
          kind: "read",
          title: "Launch day: the control plane is the risk",
          body: "This pattern repeats. Caches scale out easily: add more servers, and each one serves copies.\n\nLogin and entitlement services are **stateful**: they keep per-user data, so they are much harder to scale. And every new viewer hits them at the same moment.",
          visual: { kind: "flow", spec: lens(DISNEY, ["c"], undefined, { c: "bad" }, { c: "LOGIN" }) },
        },
        {
          kind: "read",
          title: "Hulu and the early multi-CDN era",
          body: "The best public look at early multi-CDN is academic. Adhikari and colleagues measured Netflix and Hulu around 2011 to 2012. Both used three commercial CDNs: Akamai, Limelight and Level 3.\n\nThe CDN was largely chosen at **session start**, with little adaptation during playback. If the chosen CDN degraded mid-session, the player often stayed on it.\n\nChapter 9 showed the fix: let the CDN choice change **during** playback, based on what the player measures.",
          visual: { kind: "flow", spec: lens(DISNEY, ["s"], undefined, { s: "warn" }, { s: "ONCE" }) },
        },
        {
          kind: "multi",
          teach: "Pick the tools that let the CDN choice change in the middle of a session. A tool that makes a choice last longer does the opposite.",
          prompt: "Which modern tools fix the \"pick a CDN once at session start\" problem? Select all that apply.",
          options: [
            "Player failover",
            "QoE-driven steering",
            "HLS and DASH [[Content Steering]]",
            "A longer DNS TTL",
          ],
          answers: [0, 1, 2],
          explain: "Modern multi-CDN uses player failover, QoE-driven steering and HLS and DASH Content Steering (Chapter 9). A longer DNS TTL makes the client stick to a bad choice for even longer.",
        },
        {
          kind: "read",
          title: "Build versus buy, for whole platforms",
          body: "Disney bought a platform rather than building one. The same question applies at every level: what is truly differentiating for your company?",
          callout: { type: "staff", text: "\"Build vs buy\" applies to whole platforms, not just CDNs. Ask what is truly differentiating. For Netflix, the edge was. For many companies, the steering logic and observability are, and the edge is rented. Disney Streaming has not published a detailed CDN design in the sources checked here, so do not repeat CDN-vendor rumors about Disney+ as fact." },
        },
        {
          kind: "summary",
          points: [
            "Google: GGC pull caches inside ISPs serve typically 70-90% of cacheable traffic.",
            "Google owns the transport too: QUIC was about 7% of Internet traffic by 2017; Media CDN (2022) rents out the YouTube edge.",
            "Prime Video sits on CloudFront; AWS origin to CloudFront transfer is free, but still measure per region.",
            "Disney bought BAMTech: one platform for many brands.",
            "Launch-day risk lives in the control plane: login and entitlement.",
            "Early Hulu and Netflix picked one CDN at session start; modern multi-CDN adapts mid-session.",
          ],
        },
      ],
    },

    /* ============ Lesson 4: Live at scale ============ */
    {
      id: "ch17-l4",
      title: "Live at scale: Twitch, Hotstar, Meta",
      goal: "Explain own-edge live delivery, convert concurrency to Tbps, and size the herd that request coalescing removes.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "When the video does not exist yet",
          body: "In live video, each segment is created seconds before people watch it. There is nothing to copy ahead of time, and huge crowds join at the same moment.\n\nThis lesson looks at three live giants: **Twitch**, India's **cricket** streamers, and **Facebook Live**. By the end, you can explain own-edge live delivery, turn a viewer count into Tbps, and size the crowd of requests that coalescing removes.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. On Twitch, a segment is created seconds before it is watched. Which Netflix habit from lesson 2 stops working?",
          options: [
            "Steering clients by URL",
            "Copying files to servers off-peak, before anyone asks (fill windows)",
            "Running the control plane in AWS",
          ],
          answer: 1,
          explain: "You cannot copy a file that does not exist yet. Twitch is live first: there is no catalog to pre-position, segments are created seconds before they are watched, and each channel has its own audience curve. URL steering and a cloud control plane still work fine for live.",
        },
        {
          kind: "read",
          title: "Twitch in 2015",
          body: "Twitch's 2015 engineering overview splits video into four parts:\n\n- **ingest**: receiving RTMP streams from broadcasters\n- **transcode**: each RTMP stream into multiple HLS streams, in C, C++ and Go\n- **distribution and edge**: HLS to \"geographically disparate POPs,\" mostly in Go\n- **VOD archiving**\n\nTwitch ran many \"bare metal\" POPs because of \"the unusual requirements of video delivery (lots of bandwidth!).\" It reported peaks over 2 million concurrent video streams.",
          visual: { kind: "flow", spec: lens(TWITCH, ["e", "d>e"]), caption: "Twitch on the six-layer lens." },
        },
        {
          kind: "read",
          title: "Twitch ingest in 2022",
          body: "Twitch \"maintains nearly a hundred points of presence (PoPs),\" each connected to a private backbone that carries streams to origin data centers for transcoding.\n\nA system called **Intelligest** picks the origin for each incoming stream. Its routing service runs in AWS. It combines **Capacitor**, which tracks compute capacity per origin, and **The Well**, which tracks backbone link health. It does not control the backbone's L3 routing.",
          visual: { kind: "flow", spec: lens(TWITCH, ["s", "c", "c>s"]) },
        },
        {
          kind: "read",
          title: "Two lessons that transfer",
          body: "**Separate routing decisions from routing mechanics.** Intelligest only decides; the network moves the packets. So the decision service is easy to change and safe to fail. Twitch says the system lets it use \"100% of the compute resources available to Twitch at the peak times.\"\n\n**Make real-time capacity an input.** This is the same idea Chapter 9 recommends for multi-CDN: [[commit|Commit]] levels and capacity are inputs, not afterthoughts.",
        },
        {
          kind: "quiz",
          teach: "Think about which is easier to change and safer to break: a small service that only decides, or the network routing itself.",
          prompt: "Intelligest decides the origin, but does not control the backbone's routing. What does that separation buy?",
          options: [
            "Lower transcoding cost",
            "The decision service is easy to change and safe to fail",
            "It removes the need for PoPs",
          ],
          answer: 1,
          explain: "**Separate routing decisions from routing mechanics.** If the decision service has a bug or goes down, the backbone keeps moving packets. You can change the decision logic without touching the network.",
        },
        {
          kind: "read",
          title: "India: the concurrency records",
          body: "India's cricket streaming services hold the public records for live **concurrency** (viewers watching at the same moment).\n\nWhy India? Cricket is a national event with a fixed start time. Most viewing is on phones at lower bitrates. And big matches were often streamed free on mobile.\n\nJioCinema and Disney+ Hotstar merged into **JioHotstar** on 14 February 2025.",
          visual: { kind: "table", headers: ["Event", "Service", "Peak", "Source"], rows: [
            ["IPL final, May 2019", "Hotstar", "18.6 million", "TechCrunch"],
            ["WC semi, IND v NZ, Jul 2019", "Hotstar", "25.3 million", "SportsPro"],
            ["IPL final, May 2023", "JioCinema", "32 million", "TechCrunch"],
            ["World Cup final, Nov 2023", "Disney+ Hotstar", "59 million", "ESPNcricinfo"],
          ], caption: "Reported peak concurrency." },
        },
        {
          kind: "read",
          title: "Worked example: concurrency to Tbps",
          body: "Use the formula from lesson 2: **egress = streams x bitrate**.\n\nNo service published its average bitrate, so we **assume** 1.5 Mbps per mobile stream.\n\nExample, the 2019 IPL final: 18,600,000 streams x 1.5 Mbps = 27,900,000 Mbps. Divide by 1,000,000 to get Tbps: **about 28 Tbps**.",
        },
        {
          kind: "number",
          teach: "Multiply streams by the assumed bitrate, then divide by 1,000,000 to turn Mbps into Tbps.",
          prompt: "Same assumption, 1.5 Mbps per mobile stream. How much egress did the 59 million streams of the 2023 World Cup final need?",
          answer: 88,
          tolerance: 3,
          unit: "Tbps",
          hint: "59,000,000 x 1.5 Mbps, then divide by 1,000,000 for Tbps.",
          explain: "59,000,000 x 1.5 Mbps = 88,500,000 Mbps, **about 88 Tbps**. That is roughly 7 times the 12 Tbps headroom in the Crunchyroll assumed model, delivered mostly inside one country.",
        },
        {
          kind: "read",
          title: "The bottleneck is in-country",
          body: "Here the bottleneck is not global reach. It is domestic interconnect and in-country CDN capacity, reserved months ahead.",
          callout: { type: "mistake", text: "Comparing concurrency numbers without bitrate. Sixty million mobile streams and sixty million TV streams are very different problems. Always convert concurrency to Tbps with a stated bitrate." },
        },
        {
          kind: "read",
          title: "A premiere is a small cricket final",
          body: "A Crunchyroll [[simulcast]] premiere has the same shape as a cricket final: a fixed start time, everyone joining at once, and everyone asking for the same few newest segments.\n\nBut the audiences live in different places. A cricket final is watched mostly inside **one country**. A Crunchyroll premiere is watched in **200+ territories** at the same moment.",
        },
        {
          kind: "quiz",
          teach: "Think about how many PoPs serve a global audience, and what each of those PoPs has in its cache when the episode starts.",
          prompt: "A Crunchyroll simulcast premiere is like a small cricket final. What is the main difference?",
          options: [
            "Crunchyroll's spike is global, so load spreads over more PoPs, with more cold caches to warm",
            "Crunchyroll has no fixed start time",
            "Crunchyroll viewers never join at the same moment",
          ],
          answer: 0,
          explain: "Both have a fixed start, a synchronized join, and everyone on the same few segments. A global spike helps capacity, because load spreads over many PoPs, but it means more cold caches to warm (Chapter 13).",
        },
        {
          kind: "read",
          title: "Meta: the thundering herd",
          body: "Facebook's 2015 post on Facebook Live describes 3-second HLS segments, a global tier of edge caches, a second tier of **origin caches**, and live stream servers behind them.\n\nThe problem was the [[thundering herd]]: a popular stream means huge numbers of viewers asking for the same new segment at once. About **1.8 percent** of requests got past the edge cache. That was too much load for the tier behind.",
          visual: { kind: "flow", spec: {
            nodes: [
              { id: "v", label: "Viewers", sub: "same new segment", kind: "viewer", col: 0, row: 0 },
              { id: "ed", label: "Edge caches", sub: "global tier", kind: "edge", col: 1, row: 0 },
              { id: "oc", label: "Origin caches", sub: "second tier", kind: "cache", col: 2, row: 0 },
              { id: "ls", label: "Live servers", sub: "3-second HLS", kind: "origin", col: 3, row: 0 },
            ],
            edges: [
              { from: "v", to: "ed", label: "herd" },
              { from: "ed", to: "oc", label: "1.8% leak", tone: "bad" },
              { from: "oc", to: "ls" },
            ],
            focus: ["ed", "oc", "ed>oc"],
          } },
        },
        {
          kind: "read",
          title: "The fix: request coalescing",
          body: "The fix was [[request coalescing|Request collapsing]]: \"the edge cache returns a cache miss for the first request, and it holds the following requests in a queue\" until the object arrives. Origin caches do the same for many edges.\n\nFacebook reported \"more than 98 percent of segments are already in an edge cache close to the user.\"",
          visual: { kind: "flow", spec: {
            nodes: [
              { id: "v", label: "Viewers", sub: "same new segment", kind: "viewer", col: 0, row: 0 },
              { id: "ed", label: "Edge caches", sub: "hold the queue", kind: "edge", col: 1, row: 0, badge: "x1" },
              { id: "oc", label: "Origin caches", sub: "hold the queue", kind: "cache", col: 2, row: 0, badge: "x1" },
              { id: "ls", label: "Live servers", sub: "3-second HLS", kind: "origin", col: 3, row: 0 },
            ],
            edges: [
              { from: "v", to: "ed", label: "herd" },
              { from: "ed", to: "oc", label: "one per miss", tone: "good" },
              { from: "oc", to: "ls", tone: "good" },
            ],
            flow: ["v>ed", "ed>oc", "oc>ls"],
          } },
        },
        {
          kind: "read",
          title: "Worked example: counting the herd",
          body: "Each viewer asks for one new segment every segment length. So:\n\n**requests per second = viewers / segment length**\n\nExample: 1,000,000 viewers with 4-second segments make 1,000,000 / 4 = **250,000 requests per second** at the edges.\n\nIf 1.8 percent leak past the edge: 250,000 x 0.018 = **4,500 requests per second** reach the next tier, the **shield**.",
        },
        {
          kind: "number",
          teach: "Divide the number of viewers by the segment length in seconds.",
          prompt: "Crunchyroll's assumed spike: 2 million viewers, 5-second segments. How many segment requests per second reach the edges?",
          answer: 400000,
          tolerance: 20000,
          unit: "req/s",
          hint: "Each viewer asks for one segment every 5 seconds.",
          explain: "2,000,000 / 5 s = **400,000 segment requests per second**.",
        },
        {
          kind: "number",
          teach: "Multiply the edge request rate by the leak share, written as a decimal (1.8 percent = 0.018).",
          prompt: "If 1.8 percent of those 400,000 requests per second leaked past the edge uncoalesced, how many per second would the shield see?",
          answer: 7200,
          tolerance: 300,
          unit: "req/s",
          explain: "400,000 x 0.018 = **about 7,200 requests per second**, all for the newest segments at the same instant. With coalescing the shield sees about one request per segment per rendition per edge node that missed: orders of magnitude fewer. That is why Chapters 5 and 6 treat coalescing as mandatory for spike traffic.",
        },
        {
          kind: "summary",
          points: [
            "Twitch is live first: about 100 own PoPs, a private backbone, and capacity-aware ingest routing (Intelligest).",
            "Separate routing decisions from routing mechanics, and make real-time capacity an input.",
            "India holds the concurrency records: 59 million for the 2023 World Cup final.",
            "Always convert concurrency to Tbps with a stated bitrate: 59M x 1.5 Mbps is about 88 Tbps.",
            "Meta: 1.8% leaked past the edge; two-tier request coalescing fixed the herd.",
          ],
        },
      ],
    },

    /* ============ Lesson 5: Apple, BBC, and Crunchyroll 2017-2020 ============ */
    {
      id: "ch17-l5",
      title: "Apple, BBC, and Crunchyroll's early posts",
      goal: "Use Apple's embedded-cache threshold, and explain what Crunchyroll published in 2017 and 2020 about stability and QoE rollups.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "From Apple to the running example",
          body: "Two more giants first: **Apple**, which invented the streaming format every CDN uses, and the **BBC**, a broadcaster that serves mostly one country.\n\nThen the running example. Crunchyroll published several honest posts about its delivery between 2017 and 2020.\n\nBy the end, you can use Apple's threshold for embedded caches, and explain what Crunchyroll learned about stability and cheap quality measurement.",
        },
        {
          kind: "read",
          title: "Apple invented HLS",
          body: "Apple created **HTTP Live Streaming** ([[HLS]]). It was published as RFC 8216 in 2017.\n\nHLS cuts video into small files and lists them in a playlist. That is why every CDN in this book delivers video as **ordinary HTTP objects**: to a cache, a video segment looks like any other file.",
        },
        {
          kind: "read",
          title: "Apple Edge Cache",
          body: "**Apple Edge Cache (AEC)** is \"equipment supplied and managed by Apple for deployment within ISP partner networks.\" To get one, an ISP needs:\n\n- a public AS number and a current PeeringDB entry\n- a 24x7 NOC\n- at least **25 Gb/s** of peak traffic across all Apple services\n\nIt should peer with Apple's AS714 for cache fill. AEC carries all Apple services, not only video. Apple does not publish how Apple TV+ traffic splits between AEC and any third-party CDN.",
        },
        {
          kind: "reveal",
          prompt: "Why is Apple's 25 Gb/s minimum more useful to you than any Netflix number?",
          answer: "It is a real company's number for **when an embedded box pays off**. Below it, the cost of operating a box inside an ISP is not worth the transit savings. You can run the same test on any \"let's put caches in ISPs\" proposal (lesson 7).",
        },
        {
          kind: "read",
          title: "BBC iPlayer: the public broadcaster",
          body: "The BBC is a public-service broadcaster with traffic in one country and big peaks around national events. iPlayer launched in December 2007. By October 2009 it served about 70 million requests and 7 petabytes a month, with streaming outnumbering downloads 97 to 3.\n\nThe BBC has run Ultra HD trials since 2014, streamed Planet Earth II clips in UHD with HLG (a broadcast HDR format) in 2016, and offered the 2022 World Cup in 4K HDR.",
          callout: { type: "industry", text: "The sources checked for this chapter did not verify the BBC's current CDN mix, so we make no claim about it. The structural lesson holds anyway: a one-country service can invest deeply in in-country peering and capacity, in a way a 200-territory service like Crunchyroll cannot afford everywhere." },
        },
        {
          kind: "read",
          title: "Now: Crunchyroll, in its own words",
          body: "Now the running example. Crunchyroll and its earlier owner Ellation published several posts about delivery. Here they are in date order, with what is **not** published marked.",
          visual: { kind: "flow", spec: TIMELINE_A, caption: "Crunchyroll timeline, part 1: 2015 to 2020." },
        },
        {
          kind: "read",
          title: "2017: a monolith meets simulcast weekends",
          body: "In April 2017 Michael Dale, then VP of Engineering at Ellation, wrote: \"As a Crunchyroll user you may have noticed some degradation of service on weekends as our popular simulcasts are released.\"\n\nCrunchyroll had just passed 1 million subscribers. The platform was \"a 'monolithic application', running within a traditional data center environment.\" Services, analytics, authentication and APIs shared the same databases. In spikes, the team saw runaway database connections and could not easily tell which endpoint caused them.",
          visual: { kind: "flow", spec: { ...TIMELINE_A, focus: ["c", "d", "c>d"] } },
        },
        {
          kind: "read",
          title: "Public and private data in one response",
          body: "The 2017 API also mixed two kinds of data in one response:\n\n- **public** data, the same for everyone, such as episode metadata\n- **private** data for one user, such as their **playhead** (where they stopped watching)\n\nRecall the [[cache key]] from Chapter 4: the label a CDN uses to decide which requests can get the same stored response. A response is safe to share only if it is the same for everyone with that key.",
        },
        {
          kind: "quiz",
          teach: "Ask whether one cached copy of this response could safely be given to every user who requests the same URL.",
          prompt: "The 2017 API mixed public data (episode metadata) with private data (a user's playhead). Why did that make CDN caching of API responses \"difficult\"?",
          options: [
            "Private data cannot be sent over HTTPS",
            "One response mixes shared and per-user data, so no single cache key fits it",
            "CDNs cannot cache JSON",
          ],
          answer: 1,
          explain: "This is a classic [[cache key]] problem (Chapter 4). Public data could be cached for everyone, but private data must not be. Mixed in one response, the whole thing becomes hard to cache.",
        },
        {
          kind: "read",
          title: "The 2017 fixes",
          body: "The post listed the fixes:\n\n- move into AWS, and break the monolith into microservices on the platform built for VRV\n- add mitigations \"to ensure users can still access video when the services are degraded\"\n- cut extra client API calls\n- move sessions from MySQL to Redis\n\nNothing published suggests Crunchyroll built its own CDN with appliances inside ISPs.",
        },
        {
          kind: "read",
          title: "Static stability, in one sentence",
          body: "**[[Static stability]]** means a system keeps working with what it already has when something it depends on fails.\n\nOne sentence in the post is pure static stability. The video infrastructure used to need database connections to serve the list of segments hosted on the CDN. Now \"we server the video stream list from our cloud services that are not affected by a Crunchyroll degradation.\"",
          callout: { type: "staff", text: "This is the founding lesson of Crunchyroll delivery: the bytes path must not depend on the most fragile part of the system. If the stream list needs the monolith's database, a website spike breaks video too. Ask that question of every new dependency on the playback path." },
        },
        {
          kind: "read",
          title: "2017: cloud encode and delivery",
          body: "A second post that spring explained the move to \"cloud encode and delivery\" to scale for VRV and Crunchyroll's growth. It admitted that some transitional encodes had a bad encoder setting.\n\nIt described moving from a flat bitrate for every show toward per-content constant-quality (CRF) encoding, similar in spirit to Netflix's [[per-title|Per-title encoding]] work. The delivery lesson: a content-pipeline migration is visible to fans immediately, especially on a simulcast.",
        },
        {
          kind: "read",
          title: "November 2017: the DNS hijack",
          body: "On 4 November 2017 attackers hijacked Crunchyroll's site through DNS for almost six hours. They redirected users to a fake site distributing malware.\n\nRemember what DNS does: it is the **first step** of every visit. It tells the device which address a hostname like crunchyroll.com points to. Only after that answer does the device contact any CDN or origin.",
          visual: { kind: "flow", spec: { ...TIMELINE_A, focus: ["e"] } },
        },
        {
          kind: "quiz",
          teach: "The device follows the DNS answer before it ever contacts a CDN. Ask where the redirected users' requests actually went.",
          prompt: "Attackers control where your hostname points. How much do your multi-CDN setup and origin redundancy help the users who are redirected?",
          options: [
            "A lot: traffic fails over to the second CDN",
            "Not at all: every CDN and origin behind the hostname is irrelevant",
            "Partly: the origin shield still protects them",
          ],
          answer: 1,
          explain: "DNS sits in front of everything. Redirected users never reach any of your CDNs or origins, so none of your redundancy can help them.",
        },
        {
          kind: "read",
          title: "DNS sits in front of everything",
          body: "If an attacker controls where your hostname points, every CDN and origin behind it is irrelevant.\n\nSo **registrar locks** (settings that block changes to your domain without extra checks), DNS-provider account security and monitoring of DNS answers are **delivery** concerns, not only security ones (Chapters 3 and 15).",
        },
        {
          kind: "read",
          title: "February 2020: the telemetry bill",
          body: "In February 2020 Dale described how Crunchyroll measured playback quality. Fans streamed \"well over 2 billion minutes of video content a month.\"\n\nThe old telemetry sent many fine-grained events, also duplicated to a dedicated QoE platform: \"north of 16 billion events\" a month. The front door alone was CloudFront with an integrated WAF at \"$1c per 10K requests.\"",
          visual: { kind: "flow", spec: { ...TIMELINE_A, focus: ["f"] } },
        },
        {
          kind: "read",
          title: "Worked example: paying per request",
          body: "Many edge services charge per batch of requests. To find the bill:\n\n**cost = (requests / batch size) x price per batch**\n\nExample: 500 million requests at 1 cent per 10,000 requests. 500,000,000 / 10,000 = 50,000 batches. 50,000 x 1 cent = **500 US dollars**.",
        },
        {
          kind: "number",
          teach: "Count the 10,000-request batches first, then multiply by 1 cent.",
          prompt: "16 billion events a month, at 1 cent per 10,000 requests. What did the front door alone cost per month, before reaching any backend?",
          answer: 16000,
          tolerance: 500,
          unit: "USD/month",
          hint: "First count the 10,000-request units.",
          explain: "16,000,000,000 / 10,000 = 1.6 million units. 1.6 million x 1 cent = **about 16,000 US dollars a month**. Dale wrote that a better approach \"could save millions of dollars annually at Crunchyroll scale.\"",
        },
        {
          kind: "read",
          title: "One rollup event per session",
          body: "The new design kept a per-session object on the client with running totals. It was stored locally in the multi-platform \"Velocity\" player. The player sent one **rollup event** per session. If the user left during an outage, the state was sent at the next app start.\n\nThe model followed the CTA \"Streaming Quality of Experience Events, Properties and Metrics\" specification.",
        },
        {
          kind: "read",
          title: "Per-CDN measurement and network weights",
          body: "Two details matter for Media Delivery.\n\n- **Per-CDN measurement.** Rollups included **per-host delivery speeds**, because \"we often leverage more than a single CDN ... but need to evaluate CDNs independently.\"\n- **Network-level weights.** Rollups cut CDN-tagging data \"from hundreds of millions to millions a day.\" That made it practical to feed \"a multi-CDN data store that can roll up into ISN level weights for edge based decisioning.\" \"ISN\" means the client's source network, the same idea as [[ASN]].",
          visual: { kind: "flow", spec: lens(CRUNCHY, ["q", "c", "s", "q>c", "c>s"], ["q>c", "c>s"]), caption: "The L5-to-L4 feedback loop, built cheaply." },
        },
        {
          kind: "multi",
          teach: "A rollup arrives once, at the end of a session, and is computed by many different players. Also recall what the rollups did measure.",
          prompt: "A rollup is computed by each player and sent once per session. Which are real **costs** of this design? Select all that apply.",
          options: [
            "Less real-time signal when playback dies",
            "Reliance on consistent client implementations",
            "Rollups cannot measure per-CDN speed",
            "Rollups alone are not enough for paging",
          ],
          answers: [0, 1, 3],
          explain: "Dale listed the costs: less real-time signal when playback dies, and reliance on consistent clients. Rollups are for analysis and steering weights. Paging still needs server-side and CDN metrics (Chapter 11). Per-CDN speed is exactly what rollups **did** measure.",
        },
        {
          kind: "summary",
          points: [
            "Apple invented HLS; Apple Edge Cache needs at least 25 Gb/s of peak Apple traffic in an ISP.",
            "BBC: a one-country service can invest deeply in in-country capacity.",
            "Crunchyroll 2017: separate video from the monolith; serve the stream list from services not affected by a degradation.",
            "Nov 2017 DNS hijack: whoever controls DNS controls every CDN behind it.",
            "2020 rollups: one event per session, per-CDN speeds, network-level steering weights; about $16,000 a month of front-door cost avoided.",
          ],
        },
      ],
    },

    /* ============ Lesson 6: Katana and after ============ */
    {
      id: "ch17-l6",
      title: "Katana and the consolidation",
      goal: "Explain how Katana collapsed playback startup into one edge round trip, and what is and is not published about Crunchyroll today.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "Crunchyroll's boldest post",
          body: "In 2020 Crunchyroll published **Katana**, its most detailed post about delivery. It fixed a slow start: a new viewer waited through many network trips before the first frame.\n\nAfter that came Sony, and the merger of several anime services into one.\n\nBy the end of this lesson, you can explain how Katana made playback start with one trip to the edge, and say what is and is not published about Crunchyroll today.",
        },
        {
          kind: "read",
          title: "The problem: a chain of services",
          body: "The per-user \"playback domain\" covered resource discovery and content security, multi-CDN decisioning, and server-side ad insertion ([[SSAI]]), each in separate per-vendor services.\n\nA client called one endpoint for the stream list, another to rewrite the manifest for multi-CDN, one for DRM token auth, another for SSAI, and then fetched the manifest. Running these on separate domains \"was catastrophic for performance,\" especially for international users opening connections \"in blocking sequence.\"",
          visual: { kind: "flow", spec: KATANA_BEFORE, caption: "Before Katana: sequential round trips." },
        },
        {
          kind: "read",
          title: "Katana",
          body: "**Katana**, by Michael Dale and Maxim Levkov, November 2020, is the most detailed delivery post Crunchyroll has published: \"Edge PlaybacK OrchestrAtion for STAteless Multi-CDN & SSAI.\"\n\nIt runs on [[Lambda@Edge]], functions in CloudFront edge locations. The player gets everything needed to start playback in **one round trip**.\n\nIn a 2020 talk with AWS, Dale described more than 12 requests between player and third parties to start a session.",
          visual: { kind: "flow", spec: katanaAfter(undefined, ["p>k"]), caption: "With Katana: one edge round trip." },
        },
        {
          kind: "read",
          title: "Worked example: counting round trips",
          body: "A **round trip** ([[RTT]]) is one message to a server and its reply. A call on a new domain costs about **three** round trips: TCP, TLS 1.3, then the request itself.\n\n**wait = calls x round trips per call x RTT**\n\nWith Katana (**assumed** numbers): one call to a CloudFront edge 30 ms away. 1 x 3 x 30 ms = **90 ms**, plus a few milliseconds of compute.",
        },
        {
          kind: "number",
          teach: "Use the same formula: calls x round trips per call x RTT.",
          prompt: "**Assumed:** before Katana, a user 150 ms from each service makes five sequential calls on new domains, about three round trips each. How long before the first segment request?",
          answer: 2250,
          tolerance: 100,
          unit: "ms",
          hint: "calls x round trips per call x RTT",
          explain: "5 x 3 x 150 ms = **2,250 ms, about 2.25 seconds**, before the first segment request, against about 90 ms with Katana. Collapsing round trips at the edge beats making any one service faster.",
        },
        {
          kind: "read",
          title: "Lambda memory as cache tier one",
          body: "Lambda instances lived \"a few hours\" under steady load. Each held \"thousands of DASH and HLS documents\" in a 1024 MB allocation.\n\nMisses read through CloudFront, and rarely reached origin. A cold fill cost a few milliseconds; a memory hit cost microseconds.",
          visual: { kind: "flow", spec: katanaAfter(["k", "m", "cf", "k>m", "m>cf"], ["p>k", "k>m", "m>cf"]) },
        },
        {
          kind: "quiz",
          teach: "Recall what each Lambda instance keeps in memory, and what one extra network hop costs.",
          prompt: "Katana's code was modular, but all orchestrated functions ran in **one handler**, an \"edge monolith\". Why?",
          options: [
            "Lambda@Edge allows only one function per distribution",
            "One in-memory DASH manifest could serve both SSAI and multi-CDN logic, and separate hops would add latency",
            "It was cheaper to write",
          ],
          answer: 1,
          explain: "Separate hops would add 50 to 500 ms per client round trip, or 3 to 25 ms per internal hop on misses. They would also spread cache hits across many instances.",
        },
        {
          kind: "read",
          title: "Views, not copies",
          body: "**Presentation-time transforms.** Rewrites, such as multi-CDN URLs, were applied as views over shared cached objects, not copies. One cached manifest could serve many users with different CDN orders.\n\n**Stateless URLs.** SSAI state lived in the URL: \"Any node can service any request. We have no 'session' construct.\"",
          visual: { kind: "flow", spec: katanaAfter(["k", "m"]) },
        },
        {
          kind: "read",
          title: "Manifest-level multi-CDN",
          body: "The CDN rules engine targeted 10 ms and worked with standard HLS clients, \"no client updates needed.\"\n\nWhere Crunchyroll controlled the player, the CDN list was a \"recommended order\" the client could negotiate on top of. For [[signed URLs|Signed URL]] on several CDNs: \"concatenate the signatures in the template.\"\n\nOn web, with Shaka Player 3 and a service worker, an embedManifest option returned the manifest inside the playback response: one fewer round trip.",
          visual: { kind: "flow", spec: lens(CRUNCHY, ["s", "e", "e>s"]), caption: "Crunchyroll on the six-layer lens (2020 design, 2026 posting)." },
        },
        {
          kind: "read",
          title: "Two allocation rules",
          body: "Katana assigned traffic to CDNs two ways:\n\n- \"**Modulo content hash** distributions for fair CDN comparisons with comparable cache hit-rates while only handling a portion of our traffic\"\n- \"**ASN** (autonomous system number) maps for large scale CDN deals that may reflect ISP interconnect relationship\"\n\nModulo content hash means: turn the content ID into a number, divide by the number of CDNs, and the remainder picks the CDN. The same title always lands on the same CDN.",
        },
        {
          kind: "quiz",
          teach: "Recall that a cache's hit ratio grows when the same object is requested from it again and again.",
          prompt: "Why is content-hash modulo a **fairer** CDN comparison than random per-request assignment?",
          options: [
            "Hashing is faster to compute",
            "Each CDN caches a stable slice of the catalog and builds a comparable hit ratio; random splitting spreads each title across CDNs and lowers every hit ratio",
            "Random assignment is not allowed in HLS",
          ],
          answer: 1,
          explain: "Hashing sends all requests for one piece of content to the same CDN. Random splitting spreads each title across CDNs, lowers every hit ratio and makes the comparison unfair.",
        },
        {
          kind: "read",
          title: "Results and a hard lesson",
          body: "Server-side runtime reached single-digit milliseconds across \"hundreds of millions of lambda @ edge invocations.\" This \"dramatically improved our time to first frame globally, reduced video abandonment rates\" and improved ad render rates.\n\nOne recorded lesson: never have one Lambda call another directly. An edge Lambda triggering an origin Lambda hit **regional concurrency limits shared by both**, causing failures. They moved to SQS with deduplication.",
        },
        {
          kind: "read",
          title: "The right layer",
          body: "Katana's \"what's next\" list included real-time per-ASN performance for the server-side CDN order, and a community standard for signaling CDN choice in DASH and HLS manifests. That standard now exists as [[Content Steering]] (Chapter 9).",
          callout: { type: "staff", text: "Katana is the best example here of a small team picking the right layer. They did not build a CDN. They moved the control-plane steps of playback to the edge, next to the cache, and merged them into one request. When you design a steering service (Chapter 9) or URL signing (Chapter 8), ask Katana's question first: how many sequential round trips does a new viewer in Manila pay before the first frame?" },
        },
        {
          kind: "read",
          title: "Is Katana still running?",
          body: "Katana is a 2020 design. Treat it as history until someone inside confirms it.",
          callout: { type: "crunchyroll", text: "Crunchyroll has not published whether Katana still runs or in what form. Wikipedia reports that Crunchyroll removed its free ad-supported tier at the end of 2025, which would shrink the SSAI half's role, but that is context, not a statement about the system. Ask on day one." },
        },
        {
          kind: "read",
          title: "Sony and the great consolidation",
          body: "Sony agreed to buy Crunchyroll from AT&T in December 2020 for 1.175 billion US dollars, and closed on 9 August 2021. On 1 March 2022 it announced that Funimation, Wakanim and VRV would be consolidated into Crunchyroll.\n\nVRV ceased operations on 29 April 2023. Funimation's app and website shut down on 2 April 2024. Accounts were transferable until then, but digital purchases did not carry over, which caused a backlash.",
          visual: { kind: "flow", spec: { ...TIMELINE_B, focus: ["h", "i", "j", "k", "h>i", "i>j", "j>k"] }, caption: "Crunchyroll timeline, part 2: 2020 to 2026." },
          callout: { type: "crunchyroll", text: "None of the internal migration work is published. A consolidation like this would likely mean merging catalogs into one origin and packaging model, retiring or merging CDN contracts and configs, migrating DRM and entitlement mappings, converging players, and planning capacity for the combined audience. These are reasonable assumptions, not facts." },
        },
        {
          kind: "read",
          title: "Size, in minutes and hours",
          body: "Subscriber counts grew fast. Check Sony's latest disclosure before quoting any of these.\n\nCrunchyroll's own 2020 figure was \"well over 2 billion minutes\" a month. This book's model counts **hours**, so divide minutes by 60.\n\nWorked example: 600 million minutes / 60 = **10 million hours**.",
          visual: { kind: "stats", items: [
            { value: "5M", label: "subscribers", note: "Aug 2021, Crunchyroll" },
            { value: "14M+", label: "subscribers", note: "Jul 2024, Anime News Network" },
            { value: "21M", label: "paid subscriptions", note: "May 2026, Wikipedia" },
            { value: "120M+", label: "registered users", note: "Dec 2025, Wikipedia" },
          ] },
        },
        {
          kind: "number",
          teach: "Divide the minutes by 60 to get hours.",
          prompt: "2 billion minutes a month is how many million hours a month?",
          answer: 33,
          tolerance: 1.5,
          unit: "M hours",
          explain: "2,000,000,000 / 60 = about **33 million hours** a month. This book assumes 300 million hours a month. That may be right for 2026, or generous. A staff engineer replaces the book's assumptions with internal numbers in week one.",
        },
        {
          kind: "read",
          title: "Devices and subtitles",
          body: "Devices keep multiplying. LG and Samsung smart-TV apps arrived in February 2024. Each device family brings a new player, DRM path and QoE profile (Chapter 10).\n\nSubtitles are visible delivery for anime fans. Wikipedia records complaints in October 2025 about missing subtitles or changed fonts. In July 2025 there was an incident with AI-generated subtitles that Crunchyroll blamed on a vendor. Chapter 7 covers the subtitle-format history.",
        },
        {
          kind: "read",
          title: "What third parties observe",
          body: "Netify fingerprints network traffic. It associates Akamai, CloudFront, Fastly, Cloudflare and Google's edge with Crunchyroll, with domains such as crunchyrollcdn.com and hostnames under akamaized.net and fastly.net.\n\nThat is **third-party observation**, not a Crunchyroll statement. But it matches Crunchyroll's own 2020 statement about using more than one CDN (lesson 5), and the 2026 posting's vendor list.",
          visual: { kind: "flow", spec: { ...TIMELINE_B, focus: ["l"] } },
        },
        {
          kind: "multi",
          teach: "Only one of these was stated by Crunchyroll itself, in the 2020 rollups post. Third-party observation and job postings are not detailed designs.",
          prompt: "Which of these has Crunchyroll **not** published? Select all that apply.",
          options: [
            "Its current CDN traffic split",
            "Its origin layout across AWS and GCP and its replication design",
            "That it uses more than one CDN",
            "Its current steering algorithm, shield placement and simulcast pre-warming process",
          ],
          answers: [0, 1, 3],
          explain: "Using more than one CDN was published in 2020. Not published: the current CDN split, origin layout, replication design, current steering algorithm, shield placement, simulcast [[pre-warming]], delivery SLOs, or a detailed outage postmortem since 2017. The job posting says the team works on all of these. Chapter 18 designs them with assumed numbers.",
        },
        {
          kind: "read",
          title: "A coherent story",
          body: "Put the published record together and it reads like one plan, step by step.",
          callout: { type: "crunchyroll", text: "2017: separate video from the monolith. 2020: measure QoE per CDN cheaply and feed it into steering. 2020: collapse playback startup into one edge round trip. 2022 to 2024: consolidate brands onto one platform. 2026: multi-CDN, multi-cloud, IaC, SLOs. Ask which ideas are still live in the code, and which were replaced." },
        },
        {
          kind: "summary",
          points: [
            "Katana (Nov 2020) ran on Lambda@Edge and collapsed playback startup into one edge round trip.",
            "Lambda memory as cache tier one, an edge monolith, views over shared objects, stateless URLs.",
            "CDN allocation by content-hash modulo (fair comparison) and ASN maps (ISP deals).",
            "About 2.25 s of sequential calls became about 90 ms (assumed numbers).",
            "Sony closed in Aug 2021; VRV and Funimation were folded in by Apr 2024. Migration internals are not published.",
            "Current CDN split, origins, steering and SLOs are not published. Mark assumptions and replace them fast.",
          ],
        },
      ],
    },

    /* ============ Lesson 7: compare, own or rent, steal ============ */
    {
      id: "ch17-l7",
      title: "Own the edge or rent it?",
      goal: "Read the comparison table by columns, answer \"should we build our own CDN?\" with numbers, and name what to steal from each company.",
      minutes: 13,
      steps: [
        {
          kind: "read",
          title: "The question every review asks",
          body: "Sooner or later, someone in a design review asks: \"Should we build our own CDN, like Netflix?\"\n\nThis lesson puts every company side by side, then walks a simple decision tree with real numbers.\n\nBy the end, you can read the comparison table by columns, answer the own-or-rent question with numbers, and name one idea to steal from each company.",
        },
        {
          kind: "quiz",
          guess: true,
          prompt: "Take a guess. In a design review someone asks: \"Should we build our own CDN like Netflix?\" What would you expect is the best first move?",
          options: [
            "Say yes: Netflix proves it works",
            "Say no: CDNs are always cheaper to rent",
            "Get three numbers: peak Gbps per top ISP, peak-to-average ratio, and cost per delivered GB versus owned capacity",
          ],
          answer: 2,
          explain: "\"Should we build our own CDN?\" is rarely a technical question. You answer it with three numbers: how much traffic your biggest ISPs carry at peak, how spiky your traffic is (**peak-to-average ratio**), and what you pay per delivered GB today versus the full cost of owning capacity (Chapter 16).",
        },
        {
          kind: "read",
          title: "The comparison, part 1: where and whose",
          body: "Read the table by **columns**. The edge footprint column splits the world: companies big enough to own edge hardware (Netflix, Google, Apple, Twitch) and companies that rent (Prime Video on its parent's CDN, Disney+, Crunchyroll).",
          visual: { kind: "table", headers: ["Company", "Control plane", "Push or pull", "Edge footprint"], rows: [
            ["Netflix", "AWS", "Push in fill windows", "Own OCAs at IXPs and in ISPs"],
            ["YouTube and Google", "Google", "Pull into GGC", "Own network plus GGC"],
            ["Prime Video", "AWS", "Pull", "CloudFront"],
            ["Disney+ and Hulu", "Disney Streaming", "Pull", "Commercial CDNs, three for Hulu around 2012"],
            ["Twitch", "Routing in AWS", "Live", "About 100 own PoPs, private backbone"],
            ["Hotstar and JioCinema", "Not published", "Live", "Not published"],
            ["Apple", "Apple", "Pull and fill via AS714", "AEC in ISPs, 25 Gb/s minimum"],
            ["Meta", "Meta", "Live", "Edge plus origin caches"],
            ["BBC iPlayer", "BBC", "Not verified", "Not verified"],
            ["Crunchyroll", "AWS and GCP per 2026 posting", "Pull (assumed)", "Multiple commercial CDNs"],
          ] },
        },
        {
          kind: "read",
          title: "The comparison, part 2: steering and the big idea",
          body: "The **steering** column shows where small teams can win. Crunchyroll's 2020 design was more sophisticated than the session-start multi-CDN that much larger companies used a decade earlier.",
          visual: { kind: "table", headers: ["Company", "Steering", "Signature idea"], rows: [
            ["Netflix", "Steering service writes OCA URLs", "Directed caching, BGP-aware steering"],
            ["YouTube and Google", "Transparent to users", "Own the transport: QUIC"],
            ["Prime Video", "Not published", "Cloud-plus-CDN pairing for live sports"],
            ["Disney+ and Hulu", "Session-start choice, early era", "Buy a platform, run many brands"],
            ["Twitch", "Capacity-aware ingest routing", "Own edge for live"],
            ["Hotstar and JioCinema", "Not published", "Record mobile concurrency"],
            ["Apple", "Not published", "Invented HLS"],
            ["Meta", "Not covered", "Two-tier request coalescing"],
            ["BBC iPlayer", "Not verified", "One-country broadcaster scale"],
            ["Crunchyroll", "Edge manifest-level multi-CDN, hash and ASN rules, 2020", "One edge round trip to start playback"],
          ] },
        },
        {
          kind: "match",
          teach: "Recall the last column of the comparison table. Each company's big idea comes from its own constraint.",
          prompt: "Match each company to its signature idea.",
          pairs: [
            ["Netflix", "Directed caching, BGP-aware steering"],
            ["YouTube and Google", "Own the transport: QUIC"],
            ["Meta", "Two-tier request coalescing"],
            ["Twitch", "Own edge for live"],
            ["Crunchyroll", "One edge round trip to start playback"],
          ],
          explain: "Each company's big idea comes from its own constraint: a predictable catalog (Netflix), a global network (Google), viral live streams (Meta), live-first video (Twitch), and a small team that picked the right layer (Crunchyroll).",
        },
        {
          kind: "read",
          title: "The decision tree",
          body: "Sooner or later a design review will ask, \"Should we build our own CDN or put caches in ISPs?\" Walk this tree.\n\nThe first gate uses Apple's published AEC minimum: is peak egress in a single ISP above about 25 Gbps? If not, rent commercial multi-CDN.",
          visual: { kind: "flow", spec: ownOrRent(["q1", "r1", "q1>r1"]), caption: "Own the edge or rent it?" },
        },
        {
          kind: "read",
          title: "Worked example: one ISP's peak",
          body: "To test the first gate, estimate the peak inside one ISP:\n\n**ISP peak = global peak x country share x ISP share**\n\nExample with the assumed normal peak of 8 Tbps, a country with 40 percent of traffic, and an ISP with 5 percent of that country's traffic:\n\n8 Tbps x 0.4 x 0.05 = 0.16 Tbps. Since 1 Tbps = 1,000 Gbps, that is **160 Gbps**.",
        },
        {
          kind: "number",
          teach: "Multiply the design peak by both shares, then turn Tbps into Gbps.",
          prompt: "Crunchyroll assumed model: 12 Tbps design peak. **Assume** the US is 40 percent of global traffic and the biggest US ISP carries 10 percent of US traffic. What does that ISP see at peak?",
          answer: 480,
          tolerance: 20,
          unit: "Gbps",
          hint: "12 Tbps x 0.4 x 0.1, then convert to Gbps.",
          explain: "12 Tbps x 0.4 x 0.1 = 0.48 Tbps = **about 480 Gbps**, well above the 25 Gbps threshold. Size alone does not rule out embedded caches. The other branches do.",
        },
        {
          kind: "read",
          title: "Branch: traffic shape",
          body: "Simulcasts double concurrency within minutes, then fall. Owned boxes sized for the spike sit idle most of the week. Rented capacity is shared, so your spike is someone else's quiet hour.\n\nThis is the **strongest argument for renting**.",
          visual: { kind: "flow", spec: ownOrRent(["q1", "q2", "q3", "r1", "q1>q2", "q2>q3", "q3>r1"], ["q1>q2", "q2>q3", "q3>r1"]) },
        },
        {
          kind: "read",
          title: "Worked example: how many boxes?",
          body: "To size an owned edge, divide the traffic by what one box can send:\n\n**boxes = total traffic / throughput per box**\n\nExample with the smaller Netflix **global appliance** (about 80 Gbps). To carry 4 Tbps: 4,000 Gbps / 80 Gbps = **50 boxes** at full load.\n\nReal boxes should not run at full load, so you plan for more.",
        },
        {
          kind: "number",
          teach: "Turn 12 Tbps into Gbps, then divide by the throughput of one storage appliance.",
          prompt: "A Netflix storage OCA serves about 200 Gbps. How many boxes at full load would carry 12 Tbps?",
          answer: 60,
          tolerance: 3,
          unit: "boxes",
          explain: "12,000 Gbps / 200 Gbps = **about 60 boxes** at full load, closer to 100 to 120 at safe utilization, spread across hundreds of ISPs in 200+ territories.",
        },
        {
          kind: "read",
          title: "Branch: can you staff it?",
          body: "The hardware is easy. Hundreds of ISP relationships, fill paths and 24x7 operations are not. Netflix built them over a decade.\n\nIf you cannot staff hardware, ISP relations and 24x7 ops: rent, and negotiate ISP-specific CDN deals. If you can: a **hybrid**, with own caches in the top ISPs and rented capacity elsewhere.",
          visual: { kind: "flow", spec: ownOrRent(["q4", "r2", "r3", "q4>r2", "q4>r3"]) },
        },
        {
          kind: "reveal",
          prompt: "What do you **lose** if you replace multi-CDN with your own CDN?",
          answer: "Multi-CDN gives you **price leverage**, **resilience to one vendor's outage** (Chapter 12) and **spike capacity**. An own CDN is one system you must make resilient yourself.",
        },
        {
          kind: "widget",
          widget: "playground",
          title: "Why rent from more than one",
          task: "Run \"CDN A goes down\". Predict what the viewer notices, then watch the player move to CDN B. This resilience is part of what you give up with a single own CDN.",
          props: { scenario: 4 },
        },
        {
          kind: "read",
          title: "The usual answer at Crunchyroll's scale",
          body: "At Crunchyroll's assumed scale, the usual answer is: rent the edge from several vendors, **own the steering and observability**, and use ISP-specific CDN deals (like Katana's ASN maps in 2020) to capture some interconnect benefit without owning hardware.",
          callout: { type: "staff", text: "\"Should we build our own CDN?\" is rarely a technical question. Answer with three numbers: peak Gbps per top ISP, peak-to-average ratio, and today's cost per delivered GB versus the fully loaded cost of owned capacity (Chapter 16)." },
        },
        {
          kind: "read",
          title: "What to steal, part 1",
          body: "Every company has one idea worth copying, even if you copy nothing else.",
          visual: { kind: "table", headers: ["From", "Steal this"], rows: [
            ["Netflix", "URL steering from a control plane that knows health, file location and BGP proximity. Edge nodes that hold no member data."],
            ["Netflix live", "Treat live as a different traffic shape that needs its own design and rehearsal."],
            ["YouTube and Google", "Transport is a delivery feature: insist on HTTP/3, TLS 1.3 and BBR from CDNs."],
            ["Prime Video", "Pair origin and CDN in the same cloud to remove origin egress cost, but still measure per region."],
            ["Disney Streaming", "One platform for many brands. Expect launch-day risk in the control plane."],
            ["Hulu, early era", "The anti-pattern: session-start CDN choice with no mid-session failover."],
          ] },
        },
        {
          kind: "read",
          title: "What to steal, part 2",
          body: "The last row is the running example, Crunchyroll. Its three ideas are the ones you will defend most often.",
          visual: { kind: "table", headers: ["From", "Steal this"], rows: [
            ["Twitch", "Separate routing decisions from routing mechanics, and route on real-time capacity."],
            ["Hotstar and JioCinema", "Convert concurrency to Tbps with a stated bitrate. Reserve in-country capacity early."],
            ["Apple", "A concrete threshold (25 Gb/s) for when embedded caching pays off."],
            ["Meta", "Two-tier caching with request coalescing for the herd."],
            ["Crunchyroll", "Keep video independent of fragile services. Measure QoE per CDN and network cheaply. Collapse startup round trips at the edge, and split CDNs by content hash for fair comparison."],
          ] },
        },
        {
          kind: "match",
          teach: "Each idea comes from what that company faced: live ingest, a box inside ISPs, record mobile crowds, a global network, or an early multi-CDN setup.",
          prompt: "Match each idea to steal with the company it comes from.",
          pairs: [
            ["Route on real-time capacity, separate decision from mechanics", "Twitch"],
            ["A concrete threshold for when embedded caching pays off", "Apple"],
            ["Reserve in-country capacity early; state the bitrate", "Hotstar and JioCinema"],
            ["Insist on HTTP/3, TLS 1.3 and BBR from CDNs", "YouTube and Google"],
            ["Session-start CDN choice with no failover (the anti-pattern)", "Hulu, early era"],
          ],
          explain: "Twitch: capacity-aware routing. Apple: the 25 Gb/s AEC minimum. Hotstar and JioCinema: Tbps with a stated bitrate and in-country reservations. Google: transport is a delivery feature. Early Hulu: what not to do.",
        },
        {
          kind: "summary",
          points: [
            "The edge footprint column splits owners (Netflix, Google, Apple, Twitch) from renters (Prime Video, Disney+, Crunchyroll).",
            "The steering column is where small teams can win.",
            "At an assumed 12 Tbps, a top US ISP sees about 480 Gbps: size allows embedded caches, but spiky traffic and ISP operations argue against them.",
            "12 Tbps is about 60 storage OCAs at full load, 100 to 120 at safe utilization.",
            "Usual answer at Crunchyroll's scale: rent several CDNs, own steering and observability, use ISP-specific deals.",
          ],
        },
      ],
    },

    /* ============ Lesson 8: Checkpoint ============ */
    {
      id: "ch17-l8",
      title: "Checkpoint",
      goal: "Answer the chapter's check-your-understanding questions and recall its key takeaways.",
      minutes: 10,
      steps: [
        {
          kind: "read",
          title: "Here is what this chapter covered",
          body: "- **One lens:** six layers, from origin to control plane. The real differences are in edge footprint and steering.\n- **Netflix** pushes files to its own boxes and steers by URL from AWS. Live breaks push.\n- **Launches fail in the control plane:** login and entitlement, as at Disney+.\n- **Live crowds** need coalescing: 1.8 percent leaking past the edge is too much.\n- **Crunchyroll** published static stability (2017), QoE rollups (2020) and Katana (2020).\n- **Own or rent:** answer with numbers.",
        },
        {
          kind: "quiz",
          teach: "Recall the Netflix playback flow: one service ranks OCAs and returns their URLs, and it sits with the rest of the control plane.",
          prompt: "In Netflix's playback flow, which component turns OCA health and file availability into URLs for the client, and where does it run?",
          visual: { kind: "sequence", spec: netflixSeq() },
          options: [
            "The OCA itself, inside the ISP",
            "The steering service, in AWS",
            "DNS, at the ISP's resolver",
            "The client player, on the device",
          ],
          answer: 1,
          explain: "The steering service in AWS. It uses cache-control data (OCA health, BGP routes, files on disk) to pick OCAs and generate URLs, which the playback services return to the client.",
        },
        {
          kind: "quiz",
          teach: "Push only works when you can predict what will be watched. Compare a curated catalog with millions of user uploads.",
          prompt: "Why does Netflix's push model work for Netflix but would be harder for YouTube?",
          options: [
            "YouTube's files are too big to push",
            "Netflix's curated catalog is predictable; YouTube's long tail of uploads is not, so GGC must largely fill on demand",
            "YouTube does not own any caches",
          ],
          answer: 1,
          explain: "Netflix can predict what members watch and when, so it pushes files off-peak. YouTube's long tail of uploads has unpredictable popularity, so GGC must largely fill on demand.",
        },
        {
          kind: "quiz",
          teach: "The problems were with logging in and accessing content. Ask which layer runs before the first video byte.",
          prompt: "Disney+ had launch-day problems. Which layer did they mostly sit in?",
          visual: { kind: "flow", spec: lens(DISNEY) },
          options: ["L3 Edge footprint", "L6 Control plane", "L2 Distribution", "L1 Origin"],
          answer: 1,
          explain: "The control plane: login and access to content. These services are stateful, harder to scale than caches, and every new viewer hits them at the same moment.",
        },
        {
          kind: "number",
          teach: "First find requests per second: viewers divided by segment length. Then take 1.8 percent of that.",
          prompt: "Facebook Live found about 1.8 percent of requests passing the edge. With Crunchyroll's assumed 2M-viewer spike and 5-second segments, how many requests per second is that without coalescing?",
          answer: 7200,
          tolerance: 300,
          unit: "req/s",
          explain: "2,000,000 / 5 s = 400,000 requests per second. 1.8 percent is **about 7,200 per second** reaching the next tier, all for the newest segments at once.",
        },
        {
          kind: "reveal",
          prompt: "Name two ways Katana assigned traffic to CDNs, and explain why content-hash modulo gives a fairer comparison than random per-request assignment.",
          answer: "**Modulo content-hash distribution** and **ASN maps**. Hashing sends all requests for a given piece of content to the same CDN, so each CDN caches a stable slice of the catalog and builds a comparable hit ratio. Random splitting spreads each title across CDNs, lowers every hit ratio and makes comparisons unfair.",
        },
        {
          kind: "quiz",
          teach: "Recall what a Lambda instance keeps in memory, and what each extra hop between functions would cost.",
          prompt: "Why did Katana use an \"edge monolith\" instead of separate Lambdas per function?",
          options: [
            "One in-memory object, such as a DASH manifest, could be reused by SSAI and multi-CDN logic; separate Lambdas would add hops and spread cache hits",
            "Lambda@Edge charges per function, not per invocation",
            "Separate Lambdas cannot read from CloudFront",
          ],
          answer: 0,
          explain: "Separate Lambdas would add hops (3 to 25 ms each on misses, or 50 to 500 ms if pushed back to the client) and spread cache hits across many instances.",
        },
        {
          kind: "reveal",
          prompt: "Use Apple's 25 Gb/s threshold and the assumed Crunchyroll model to argue whether embedded caches make sense for Crunchyroll.",
          answer: "**Size allows it**: a top ISP could see hundreds of Gbps at assumed peak (about 480 Gbps). But simulcast traffic is very spiky and spread over 200+ territories, so owned boxes would idle much of the week, and hundreds of ISP relationships are costly to run. **Rent multiple CDNs and use ASN-specific deals instead.**",
        },
        {
          kind: "quiz",
          teach: "In 2017 the stream list needed the monolith's database. Ask what that dependency did to video during a website spike.",
          prompt: "Which lesson from Crunchyroll's 2017 stability post applies to any new service on the playback path?",
          options: [
            "Always use Redis for sessions",
            "The video path must not depend on the most fragile part of the system",
            "Never run microservices in AWS",
          ],
          answer: 1,
          explain: "In 2017 the stream list needed the monolith's database, so website overload degraded video. Moving it to independent cloud services fixed that.",
        },
        {
          kind: "number",
          teach: "Egress = streams x bitrate. Then divide Mbps by 1,000,000 to get Tbps.",
          prompt: "Quick recall: 65 million concurrent streams at an **assumed** 5 Mbps. How many Tbps?",
          answer: 325,
          tolerance: 15,
          unit: "Tbps",
          explain: "65,000,000 x 5 Mbps = **about 325 Tbps**, roughly 40 times the assumed Crunchyroll peak of 8 Tbps.",
        },
        {
          kind: "match",
          teach: "Each takeaway was shown by one company's published story: a quote about AWS, a launch day, a live-video post, and a transport protocol.",
          prompt: "Match each takeaway to the evidence behind it.",
          pairs: [
            ["Control plane in a public cloud, data plane separate", "Netflix: before play is AWS"],
            ["Launches fail in login and entitlement", "Disney+ launch day, 2019"],
            ["Coalescing is mandatory for synchronized demand", "Facebook Live, 2015"],
            ["Owning the network includes the transport", "QUIC, about 7% of traffic by 2017"],
          ],
          explain: "Netflix said everything before play happens in AWS. Disney+ launch-day problems were login and content access. Facebook Live needed two-tier coalescing. Google pushed QUIC to about 7 percent of Internet traffic by 2017.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "One six-layer lens for every company; the real differences are in edge footprint and steering.",
            "Almost every giant separates control plane (often in a public cloud) from data plane.",
            "Open Connect: predict, push in fill windows, steer by URL with health, file and BGP data. Live is a different shape.",
            "Launches and live events often fail in the control plane; coalescing and two-tier caching are mandatory for synchronized demand.",
            "Always convert concurrency to Tbps with an explicit bitrate. Crunchyroll's current CDN split, origins and steering are not published: mark assumptions.",
            "For spiky, global, mid-sized traffic, rent several CDNs and own steering and observability.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Netflix, \"Open Connect Overview\" (2016, updated through 2026). https://openconnect.netflix.com/Open-Connect-Overview.pdf",
    "Ken Florance, \"How Netflix Works With ISPs Around the Globe to Deliver a Great Viewing Experience,\" Netflix, 17 March 2016. https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience",
    "Netflix Open Connect, \"Appliances\" (accessed November 2026). https://openconnect.netflix.com/en/appliances/",
    "Netflix, \"Jake Paul vs. Mike Tyson: Over 108 Million Live Global Viewers,\" 19 November 2024. https://about.netflix.com/en/news/jake-paul-vs-mike-tyson-over-108-million-live-global-viewers",
    "Wikipedia, \"Jake Paul vs. Mike Tyson,\" citing USA Today and CNN (15 November 2024) and Fortune/Bloomberg (16 November 2024). https://en.wikipedia.org/wiki/Jake_Paul_vs._Mike_Tyson",
    "Google, \"Google Global Cache,\" Peering and Interconnect help (accessed November 2026). https://support.google.com/interconnect/answer/9058809",
    "Adam Langley et al., \"The QUIC Transport Protocol: Design and Internet-Scale Deployment,\" ACM SIGCOMM 2017. https://research.google/pubs/the-quic-transport-protocol-design-and-internet-scale-deployment/",
    "Google Cloud, \"Introducing Media CDN,\" 25 April 2022. https://cloud.google.com/blog/products/networking/introducing-media-cdn",
    "Streaming Media, speaker page for Michael Dale, VP Engineering, Ellation (Streaming Media West 2018 and 2019 sessions, including \"Harness SSAI's Superpowers,\" 20 November 2019). https://www.streamingmedia.com/west2019/Michael-Dale.aspx",
    "Amazon Web Services, \"Amazon CloudFront Customer Case Studies\" (Prime Video quote, undated on page; accessed November 2026). https://aws.amazon.com/cloudfront/case-studies/",
    "Wikipedia, \"Thursday Night Football\" (Prime Video era viewership; accessed November 2026). https://en.wikipedia.org/wiki/Thursday_Night_Football",
    "Wikipedia, \"Disney Streaming,\" citing The Verge (2015), FierceCable (2017), Variety (2018) and The Hollywood Reporter (29 November 2022). https://en.wikipedia.org/wiki/Disney_Streaming",
    "Wikipedia, \"Disney+\" (launch, sign-ups and launch-day issues; accessed November 2026). https://en.wikipedia.org/wiki/Disney%2B",
    "Vijay Kumar Adhikari, Yang Guo, Fang Hao, Volker Hilt, Zhi-Li Zhang, Matteo Varvello and Moritz Steiner, \"Measurement Study of Netflix, Hulu, and a Tale of Three CDNs,\" IEEE/ACM Transactions on Networking, 2015 (measurements from around 2011 to 2012).",
    "Twitch, \"Twitch Engineering: An Introduction and Overview,\" 18 December 2015. https://blog.twitch.tv/en/2015/12/18/twitch-engineering-an-introduction-and-overview-a23917b71a25/",
    "Rohit Puri, Christopher Lafata, Kevin Pan and Eric Kwong, \"Ingesting Live Video Streams at Global Scale,\" Twitch Blog, 26 April 2022. https://blog.twitch.tv/en/2022/04/26/ingesting-live-video-streams-at-global-scale/",
    "Wikipedia, \"JioHotstar,\" citing TechCrunch (12 May 2019) and SportsPro (17 July 2019). https://en.wikipedia.org/wiki/JioHotstar",
    "Wikipedia, \"JioCinema,\" citing TechCrunch (29 May 2023), The Indian Express and The Hindu (14 February 2025). https://en.wikipedia.org/wiki/JioCinema",
    "Wikipedia, \"2023 Cricket World Cup final,\" citing ESPNcricinfo, \"2023 ODI World Cup shatters viewership records\" (November 2023). https://en.wikipedia.org/wiki/2023_Cricket_World_Cup_final",
    "Apple, \"Apple Edge Cache\" (accessed November 2026). https://cache.edge.apple/",
    "R. Pantos and W. May, \"HTTP Live Streaming,\" RFC 8216, IETF, August 2017. https://www.rfc-editor.org/rfc/rfc8216",
    "Federico Larumbe and Abhishek Mathur, \"Under the hood: Broadcasting live video to millions,\" Engineering at Meta, 3 December 2015. https://engineering.fb.com/2015/12/03/ios/under-the-hood-broadcasting-live-video-to-millions/",
    "Wikipedia, \"BBC iPlayer\" (usage figures and UHD trials; accessed November 2026). https://en.wikipedia.org/wiki/BBC_iPlayer",
    "Michael Dale, \"Stabilizing and Improving Crunchyroll Service,\" Ellation Tech (Medium), April 2017. https://medium.com/ellation-tech/stabilizing-improving-crunchyroll-service-c44c53789e86",
    "Michael Dale and the Ellation Video Team, \"Improving Video Quality for Crunchyroll and VRV,\" Ellation Tech (Medium), March 2017. https://medium.com/ellation-tech/improving-video-quality-for-crunchyroll-and-vrv-dd587261a364",
    "Michael Dale, \"More with less; Client Side Rollups for Video Quality Metrics,\" Crunchyroll (Medium), 19 February 2020. https://medium.com/crunchyroll/more-with-less-client-side-rollups-for-video-quality-metrics-67ee9e292c04",
    "Michael Dale and Maxim Levkov, \"Katana: Lessons Learned from Slicing HLS and Dicing Dash on the FaaS Edge,\" Crunchyroll (Medium), 10 November 2020. https://medium.com/crunchyroll/katana-lessons-learned-from-slicing-hls-and-dicing-dash-on-the-faas-edge-3fa1de2d5ba2",
    "The Broadcast Knowledge, \"Video: Edge Compute and the CDN\" (Michael Dale, Crunchyroll, with Heather Chamberlin Mellish, AWS; Content Delivery Summit), 16 November 2020. https://thebroadcastknowledge.com/tag/michael-dale/",
    "Wikipedia, \"Crunchyroll,\" citing Kotaku (4 November 2017), Crunchyroll News (3 August 2021, 1 March 2022), Anime News Network (9 August 2021, 18 July 2024) and others (accessed November 2026). https://en.wikipedia.org/wiki/Crunchyroll",
    "Wikipedia, \"Funimation,\" citing Anime News Network (7 February 2024), The Verge and Ars Technica (8 February 2024). https://en.wikipedia.org/wiki/Funimation",
    "Wikipedia, \"VRV (streaming service),\" citing Anime News Network (4 April 2023). https://en.wikipedia.org/wiki/VRV_(streaming_service)",
    "Netify, \"Crunchyroll\" application profile (third-party traffic observation; accessed November 2026). https://www.netify.ai/resources/applications/crunchyroll",
    "Crunchyroll, job posting \"Software Engineer III, Media Delivery\" (2026). https://www.showbizjobs.com/jobs/crunchyroll-software-engineer-iii-media-delivery-in-san-francisco/jid-gk9z1kd",
  ],
};
export default chapter;
