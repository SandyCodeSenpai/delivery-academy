/**
 * Test chapter for the lesson player: route #ch99-1 (every step kind) and #ch99-2 (short).
 * Not part of the course. Numbers follow the running example in CONTRIBUTING.md.
 */
import type { Chapter, FlowSpec, SequenceSpec } from "@/content/types";

const path: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "viewer", label: "Viewer", sub: "Tokyo, phone", kind: "viewer", col: 0, row: 1 },
    { id: "edge", label: "Edge server", sub: "PoP in Tokyo", kind: "edge", col: 1, row: 1 },
    { id: "shield", label: "Shield", sub: "regional cache", kind: "shield", col: 2, row: 1 },
    { id: "origin", label: "Origin", sub: "object storage", kind: "origin", col: 3, row: 1 },
  ],
  edges: [
    { from: "viewer", to: "edge", label: "GET seg_42" },
    { from: "edge", to: "shield", label: "on MISS" },
    { from: "shield", to: "origin", label: "on MISS", dashed: true },
  ],
  groups: [{ id: "cdn", label: "CDN", nodes: ["edge", "shield"] }],
};

const missSeq: SequenceSpec = {
  actors: [
    { id: "player", label: "Player", kind: "player" },
    { id: "edge", label: "Edge", kind: "edge" },
    { id: "origin", label: "Origin", kind: "origin" },
  ],
  messages: [
    { from: "player", to: "edge", label: "GET /ep1/seg_42.m4s" },
    { from: "edge", to: "origin", label: "GET (cache MISS)", tone: "warn" },
    { from: "origin", to: "edge", label: "200 OK, 2 MB", dashed: true },
    { from: "edge", to: "player", label: "200 OK (now cached)", tone: "good", dashed: true },
  ],
};

const FIXTURE: Chapter = {
  n: 99,
  title: "Player test bench",
  short: "Test bench",
  part: 3,
  hook: "Every step kind in one place, for testing the lesson player.",
  sources: [],
  lessons: [
    {
      id: "ch99-l1",
      title: "Why the second viewer is fast",
      goal: "Explain a cache HIT and a cache MISS, and estimate peak egress.",
      minutes: 8,
      steps: [
        {
          kind: "read",
          title: "Two viewers, one segment",
          body:
            "A viewer in Tokyo presses play. Their player asks for a **segment**: a 4-second piece of video.\n\n" +
            "The request goes to an [[edge]] server in a nearby [[PoP]]. If the edge has the segment, it answers at once. " +
            "This is a cache **HIT**. If not, it asks the [[shield|Origin Shield]], and maybe the [[origin]].",
          visual: { kind: "flow", spec: { ...path, focus: ["viewer", "edge", "viewer>edge"], flow: ["viewer>edge"] }, caption: "The request path for one segment" },
          callout: { type: "crunchyroll", text: "At a big premiere, about 2M viewers ask for the *same* first segments within a minute (assumed)." },
        },
        {
          kind: "quiz",
          prompt: "The edge does not have the segment. Where does it ask first?",
          visual: { kind: "flow", spec: { ...path, focus: ["edge", "shield", "edge>shield"] } },
          options: ["The origin, directly", "The shield", "The viewer's ISP", "Another viewer's player"],
          answer: 1,
          explain: "The edge asks the **shield** first. The shield is a second cache layer. It protects the origin, so most misses at the edge become hits at the shield.",
        },
        {
          kind: "read",
          title: "What a MISS costs",
          body:
            "On a MISS the edge must fetch the bytes before it can answer. That adds one or more round trips.\n\n" +
            "- The first viewer waits longer.\n- The edge stores the copy.\n- The next viewer gets a HIT.",
          visual: { kind: "sequence", spec: missSeq, caption: "A cache MISS, then the copy is stored" },
          callout: { type: "staff", text: "Measure hit ratio **by bytes**, not by requests. Large video segments dominate the bill and the origin load." },
        },
        {
          kind: "multi",
          prompt: "Which of these make a cache HIT more likely?",
          options: ["Many viewers watch the same episode", "A longer cache lifetime (TTL)", "A unique query string on every request", "A shield layer in front of the origin"],
          answers: [0, 1, 3],
          explain: "Popular content, a longer TTL and a shield all raise the hit ratio. A unique query string makes every URL different, so each request is a MISS unless the [[cache key]] ignores it.",
        },
        {
          kind: "number",
          prompt: "1M viewers each stream at 4 Mbps. What is the total egress?",
          answer: 4,
          tolerance: 0.4,
          unit: "Tbps",
          hint: "Multiply viewers by bitrate: 1,000,000 x 4 Mbps. Then convert: 1 Tbps = 1,000,000 Mbps.",
          explain: "1,000,000 x 4 Mbps = 4,000,000 Mbps = 4,000 Gbps = **4 Tbps**. A 2M-viewer premiere doubles this to about 8 Tbps.",
        },
        {
          kind: "order",
          prompt: "Put the steps of a cache MISS in order.",
          items: ["Player asks the edge for the segment", "Edge looks in its cache and misses", "Edge fetches the segment from the shield", "Edge stores a copy", "Edge sends the segment to the player"],
          explain: "Ask, look, fetch, store, send. Many CDNs stream the bytes to the player *while* they store them, so steps 4 and 5 overlap in practice.",
        },
        {
          kind: "match",
          prompt: "Match each term to its meaning.",
          pairs: [
            ["Edge", "Cache closest to the viewer"],
            ["Shield", "Cache that protects the origin"],
            ["Origin", "Where the master copy lives"],
            ["TTL", "How long a copy stays fresh"],
          ],
          explain: "Edge, shield and origin are three layers. TTL (time to live) controls how long each cached copy can be served without asking again.",
        },
        {
          kind: "reveal",
          prompt: "A new episode premieres. Two million viewers press play in the same minute. Every edge is cold. What protects the origin?",
          answer:
            "Three things work together:\n\n" +
            "- **Request collapsing**: each edge sends *one* request per segment and holds the rest.\n" +
            "- **The shield**: many edges share one cache, so the origin sees one request per region.\n" +
            "- **Pre-warming**: push the first segments to the shields before the premiere.",
        },
        {
          kind: "widget",
          widget: "request-collapse",
          title: "Watch a stampede",
          task: "Turn request collapsing off and press Premiere. Watch the origin. Then turn it on and try again.",
        },
        {
          kind: "quiz",
          prompt: "Which hit ratio matters most for the delivery bill?",
          visual: {
            kind: "table",
            headers: ["Metric", "Counts", "Example"],
            rows: [["Request hit ratio", "requests", "97%"], ["Byte hit ratio", "bytes", "95%"]],
            caption: "Two ways to count hits",
          },
          options: ["Request hit ratio", "Byte hit ratio"],
          answer: 1,
          explain: "Video is billed and served **by bytes**. A small manifest and a 2 MB segment count the same in a request ratio, but not in a byte ratio.",
        },
        {
          kind: "summary",
          points: [
            "A HIT is served from the edge at once. A MISS goes up to the shield and maybe the origin.",
            "The shield is a second cache that protects the origin.",
            "Peak egress = viewers x bitrate. 1M x 4 Mbps = 4 Tbps.",
            "Request collapsing, a shield and pre-warming keep a premiere from hitting the origin.",
          ],
        },
      ],
    },
    {
      id: "ch99-l2",
      title: "A short second lesson",
      goal: "Check the Next lesson button.",
      minutes: 1,
      steps: [
        { kind: "read", title: "Hello again", body: "This lesson exists so that **Next lesson** has somewhere to go." },
        { kind: "summary", points: ["Next lesson works.", "Back to chapter works."] },
      ],
    },
  ],
};

export default FIXTURE;
