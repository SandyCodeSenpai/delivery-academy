import type { Chapter, FlowSpec, SequenceSpec } from "./types";

// Chapter 11 content. Source: chapters/11-observability.md

/* ---------------- Shared visuals ---------------- */

/** Section 11.2: where delivery data comes from and where it lands. */
const VANTAGE: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "api", label: "Playback API", sub: "and steering", kind: "api", col: 0, row: 0 },
    { id: "qoe", label: "QoE collector", kind: "monitor", col: 2, row: 0 },
    { id: "p", label: "Player", sub: "SDK and CMCD", kind: "player", col: 0, row: 1 },
    { id: "dd", label: "Datadog", kind: "monitor", col: 4, row: 1, tone: "accent" },
    { id: "e", label: "CDN edge", kind: "edge", col: 1, row: 2 },
    { id: "s", label: "Shield tier", kind: "shield", col: 2, row: 2 },
    { id: "o", label: "Origin", sub: "S3 or GCS", kind: "origin", col: 3, row: 2 },
    { id: "x", label: "Synthetic probes", kind: "monitor", col: 0, row: 3 },
    { id: "l", label: "CDN log stream", kind: "queue", col: 2, row: 3 },
    { id: "r", label: "Raw logs", sub: "object storage", kind: "storage", col: 4, row: 3 },
  ],
  edges: [
    { from: "p", to: "qoe" },
    { from: "p", to: "e" },
    { from: "e", to: "s" },
    { from: "s", to: "o" },
    { from: "e", to: "l", dashed: true },
    { from: "s", to: "l", dashed: true },
    { from: "o", to: "dd", label: "cloud metrics", dashed: true },
    { from: "api", to: "dd", label: "APM traces", dashed: true },
    { from: "x", to: "e" },
    { from: "qoe", to: "dd", dashed: true },
    { from: "l", to: "dd", dashed: true },
    { from: "l", to: "r", dashed: true },
  ],
};

/** Section 11.9.3: one session ID minted once and seen at every hop. */
const SESSION_SEQ: SequenceSpec = {
  actors: [
    { id: "p", label: "Player", kind: "player" },
    { id: "a", label: "Playback API", kind: "api" },
    { id: "c", label: "CDN edge", kind: "edge" },
    { id: "s", label: "Shield", kind: "shield" },
    { id: "o", label: "Origin", kind: "origin" },
    { id: "q", label: "QoE collector", kind: "monitor" },
  ],
  messages: [
    { from: "p", to: "a", label: "Start playback request" },
    { from: "a", to: "p", label: "Manifest URL + session id S1", dashed: true, note: "APM span tagged with S1", tone: "accent" },
    { from: "p", to: "q", label: "Session start event with S1", tone: "accent" },
    { from: "p", to: "c", label: "Segment request, CMCD sid=S1", tone: "accent" },
    { from: "c", to: "s", label: "Cache miss fetch" },
    { from: "s", to: "o", label: "Shield miss fetch" },
    { from: "o", to: "s", label: "Segment bytes", dashed: true },
    { from: "s", to: "c", label: "Segment bytes", dashed: true },
    { from: "c", to: "p", label: "Segment bytes", dashed: true, note: "Log line has S1 and cache status", tone: "accent" },
    { from: "p", to: "q", label: "Heartbeat: S1 + stall count", tone: "accent" },
  ],
};

/** Section 11.10: symptoms page, causes go to dashboards. */
const ALERT_FLOW: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "sym", label: "Symptom signals", sub: "starts, stalls, plays", kind: "viewer", col: 1, row: 0 },
    { id: "cause", label: "Cause signals", sub: "hit ratio, origin, PoP", kind: "monitor", col: 3, row: 0 },
    { id: "burn", label: "Burn rate high?", sub: "in both windows", kind: "generic", col: 1, row: 1 },
    { id: "page", label: "Page on-call", kind: "service", col: 0, row: 2, tone: "bad" },
    { id: "ticket", label: "Ticket", sub: "next business day", kind: "queue", col: 1, row: 2, tone: "warn" },
    { id: "dash", label: "Dashboards only", kind: "monitor", col: 3, row: 2 },
    { id: "inv", label: "Investigation", sub: "views and runbooks", kind: "service", col: 2, row: 3 },
  ],
  edges: [
    { from: "sym", to: "burn" },
    { from: "burn", to: "page", label: "Yes, fast burn", tone: "bad" },
    { from: "burn", to: "ticket", label: "Yes, slow burn", tone: "warn" },
    { from: "burn", to: "dash", label: "No" },
    { from: "cause", to: "dash" },
    { from: "cause", to: "inv" },
    { from: "page", to: "inv" },
  ],
};

/** Section 11.11 decision tree, part 1: scope with player data. */
const TRIAGE_A: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "a", label: "Alert: BR rebuffer", kind: "monitor", col: 0, row: 0, tone: "bad" },
    { id: "b", label: "Break down QoE", sub: "CDN/ISP/device/app/title", kind: "monitor", col: 1, row: 0 },
    { id: "c", label: "One title only?", kind: "generic", col: 1, row: 1 },
    { id: "c1", label: "Encode, package", sub: "check encoding, packaging", kind: "encoder", col: 4, row: 1 },
    { id: "d", label: "One app or device?", kind: "generic", col: 1, row: 2 },
    { id: "d1", label: "Player release", sub: "ask the Playback team", kind: "player", col: 4, row: 2 },
    { id: "e", label: "One CDN only?", kind: "generic", col: 1, row: 3 },
    { id: "e1", label: "Origin or ISP-wide", sub: "shield, replication, ISP", kind: "origin", col: 4, row: 3 },
    { id: "f", label: "CDN logs", sub: "that CDN, country, ASN", kind: "cdn", col: 1, row: 4, tone: "accent" },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "c", to: "c1", label: "Yes" },
    { from: "c", to: "d", label: "No" },
    { from: "d", to: "d1", label: "Yes" },
    { from: "d", to: "e", label: "No" },
    { from: "e", to: "e1", label: "No, all CDNs" },
    { from: "e", to: "f", label: "Yes" },
  ],
};

/** Section 11.11 decision tree, part 2: separate cache from network, then act. */
const TRIAGE_B: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "f", label: "CDN logs", sub: "that CDN, country, ASN", kind: "cdn", col: 1, row: 0 },
    { id: "g", label: "Errors or misses?", kind: "generic", col: 1, row: 1 },
    { id: "g1", label: "Cache path issue", sub: "cache, shield or origin", kind: "cache", col: 4, row: 1 },
    { id: "h", label: "Group by PoP", sub: "check the network path", kind: "pop", col: 1, row: 2 },
    { id: "i", label: "Steer the ASN", sub: "to a healthy CDN", kind: "steering", col: 1, row: 3, tone: "good" },
    { id: "j", label: "Vendor ticket", sub: "evidence and postmortem", kind: "service", col: 1, row: 4 },
  ],
  edges: [
    { from: "f", to: "g" },
    { from: "g", to: "g1", label: "Yes" },
    { from: "g", to: "h", label: "Throughput down" },
    { from: "h", to: "i" },
    { from: "i", to: "j" },
  ],
};

const SIGNAL_TABLE = {
  kind: "table" as const,
  headers: ["Signal", "ISP-X on CDN-A tonight", "ISP-X on CDN-A last week", "Other ISPs on CDN-A tonight"],
  rows: [
    ["Segment success rate", "99.97%", "99.98%", "99.97%"],
    ["Cache status", "97% hit", "97% hit", "97% hit"],
    ["p50 TTFB", "35 ms", "32 ms", "30 ms"],
    ["Delivered throughput (bytes / time-taken)", "3.1 Mbps", "11 Mbps", "12 Mbps"],
    ["TCP retransmits per request", "4x higher", "baseline", "baseline"],
    ["CMCD `mtp` (client-measured throughput)", "sharply lower", "normal", "normal"],
    ["CMCD `bs` (buffer starvation) present", "many requests", "rare", "rare"],
  ],
  caption: "Filter: cdn:cdn-a country:BR asn:ISP_X_ASN object_type:video. All numbers assumed.",
};

const FASTLY_JSON =
  "{\"ddsource\":\"fastly\",\"service\":\"media-delivery\",\n" +
  " \"ts\":\"%{begin:%Y-%m-%dT%H:%M:%S%z}t\",\n" +
  " \"cdn\":\"fastly\",\"pop\":\"%{server.datacenter}V\",\n" +
  " \"country\":\"%{client.geo.country_code}V\",\"asn\":\"%{client.as.number}V\",\n" +
  " \"status\":\"%{resp.status}V\",\"cache\":\"%{fastly_info.state}V\",\n" +
  " \"ttfb\":\"%{time.to_first_byte}V\",\"elapsed_us\":\"%{time.elapsed.usec}V\",\n" +
  " \"bytes\":\"%{resp.body_bytes_written}V\",\n" +
  " \"rtt\":\"%{client.socket.tcpi_rtt}V\",\"retrans\":\"%{client.socket.tcpi_total_retrans}V\",\n" +
  " \"path\":\"%{json.escape(req.url.path)}V\",\n" +
  " \"cmcd_session\":\"%{json.escape(req.http.CMCD-Session)}V\"}";

const BURN_HCL =
  "resource \"datadog_monitor\" \"session_start_fast_burn\" {\n" +
  "  name    = \"Session start SLO fast burn\"\n" +
  "  type    = \"slo alert\"\n" +
  "  query   = \"burn_rate(\\\"${datadog_service_level_objective.session_start.id}\\\").over(\\\"30d\\\").long_window(\\\"1h\\\").short_window(\\\"5m\\\") > 14.4\"\n" +
  "  message = \"Session start budget burning fast. Check per-CDN breakdown and runbook RB-DELIVERY-01.\"\n" +
  "  tags    = [\"team:media-delivery\", \"severity:page\"]\n" +
  "}";

const SLO_HCL =
  "resource \"datadog_service_level_objective\" \"session_start\" {\n" +
  "  name = \"Session start success (delivery-attributed)\"\n" +
  "  type = \"metric\"\n" +
  "  query {\n" +
  "    numerator   = \"sum:delivery.session.start.good{*}.as_count()\"\n" +
  "    denominator = \"sum:delivery.session.start.total{*}.as_count()\"\n" +
  "  }\n" +
  "  thresholds {\n" +
  "    timeframe = \"30d\"\n" +
  "    target    = 99.9\n" +
  "  }\n" +
  "}";

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 11,
  title: "Observability for Media Delivery",
  short: "Observability",
  part: 5,
  hook: "Rebuffering is up in Brazil on one ISP. Find the cause in ten minutes, not ten hours.",
  lessons: [
    /* ======================= Lesson 1 ======================= */
    {
      id: "ch11-l1",
      title: "Nobody sees the whole path",
      goal: "Explain why delivery observability is hard, size the log volume, and say what each hop can and cannot see.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "Every server returns 200. Every dashboard is green. Can viewers still be failing?",
          options: [
            "No. A 200 means the bytes arrived, so the viewer is fine.",
            "Yes. A 200 can arrive too slowly, and the player stalls.",
            "Only if the origin is down.",
          ],
          answer: 1,
          explain: "A video platform can be \"up\" and still fail its viewers. Fans in São Paulo on one ISP can watch a spinning wheel every two minutes while every response is a 200. Status codes do not measure speed.",
        },
        {
          kind: "read",
          title: "One playback, many owners",
          body: "The bytes cross four or five organizations before they reach a screen. You own some, rent some, and see few.\n\n- **Player**: you ship the code, but it runs on devices and networks you do not control.\n- **ISP and [[last mile]]**: you see nothing directly.\n- **CDN [[edge]] and [[shield]]**: the vendor owns the servers. You see only the logs and metrics it exports.\n- **[[Origin]]**: storage and maybe a packager, which you own.\n- **[[Control plane]]**: playback API, entitlement, manifest, DRM. Partner teams own most of it.",
          visual: { kind: "flow", spec: { ...VANTAGE, focus: ["p", "e", "s", "o", "api", "p>e", "e>s", "s>o"] } },
        },
        {
          kind: "read",
          title: "Each hop sees part of the truth",
          body: "The CDN knows a segment took 3 seconds to send. It does not know if the viewer's buffer was full (fine) or empty (a stall). The player sees the stall, but not why. The origin sees only cache misses.\n\n**Observability** for media delivery means joining these partial views into one story, fast enough to act. In general, observability is the ability to answer new questions about your system from the data it emits, without shipping new code.",
        },
        {
          kind: "match",
          prompt: "Match each hop to what it can see.",
          pairs: [
            ["Player", "The stall, but not its cause"],
            ["CDN edge", "Every request, but not the buffer"],
            ["Origin", "Only cache misses"],
            ["Control plane", "API latency, but not the bytes"],
          ],
          explain: "Each vantage point holds one slice. The player sees experience, the CDN sees requests, the origin sees only misses, and the control plane sees API calls but not the bytes path.",
        },
        {
          kind: "read",
          title: "Four kinds of signal",
          body: "Observability rests on three classic signal types. Media delivery adds a fourth: **client-side QoE telemetry** from the player, often called [[RUM]] (real user monitoring).",
          visual: {
            kind: "table",
            headers: ["Signal", "What it is", "Trade-off"],
            rows: [
              ["Metrics", "Numbers over time", "Cheap, aggregated"],
              ["Logs", "One record per event", "Rich, expensive"],
              ["Traces", "The path of one request across services", "Best for your own services"],
              ["Client QoE (RUM)", "What the player measured", "The only view of what the viewer felt"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "You need one record per segment request, with status, PoP, cache result and bytes. Which signal type is that?",
          options: ["Metrics", "Logs", "Traces", "RUM"],
          answer: 1,
          explain: "Logs are one record per event: rich, but expensive. Metrics are aggregated numbers, traces follow a request across your services, and RUM is the player's view.",
        },
        {
          kind: "number",
          prompt: "Assumed model: ~1M concurrent streams, ~4 s segments, separate (demuxed) audio and video. Each stream fetches one video and one audio segment every 4 s. How many segment requests per second?",
          answer: 500000,
          tolerance: 50000,
          unit: "requests/s",
          hint: "1M streams / 4 s, then x 2 for audio and video.",
          explain: "1M / 4 s x 2 = ~500,000 requests per second, before manifests, subtitles and license calls. At a 2M-stream simulcast spike it is ~1M requests per second.",
        },
        {
          kind: "number",
          prompt: "At the spike (~1M requests per second), CloudFront's estimate of ~500 bytes per log record gives how many TB of logs per day?",
          answer: 43,
          tolerance: 4,
          unit: "TB/day",
          hint: "500 bytes x 1M = 500 MB per second. A day has 86,400 seconds.",
          explain: "500 bytes x 1M per second = ~500 MB per second. x 86,400 s = ~43 TB per day. CloudFront says a typical real-time record is about 500 bytes, and about 1 KB with all fields.",
        },
        {
          kind: "read",
          title: "The number that drives this chapter",
          body: "Per month: 300M hours x 3,600 s / 4 s x 2 = ~540 billion segment requests. You cannot index that in any observability vendor at a sane price.\n\nSo the rule is: **aggregate early, sample the rest, keep raw logs in cheap object storage.**",
          visual: {
            kind: "stats",
            items: [
              { value: "~500k/s", label: "Segment requests, normal peak", note: "assumed model" },
              { value: "~43 TB", label: "Logs per day at 1M req/s", note: "500 bytes each" },
              { value: "~540B", label: "Segment requests per month", note: "assumed model" },
            ],
          },
          callout: { type: "industry", text: "Netflix built Mantis, an open-source stream-processing platform, for faster and deeper operational insight. Mantis runs queries on live event streams, so high-cardinality questions do not require storing everything first." },
        },
        {
          kind: "read",
          title: "What \"healthy\" means",
          body: "Healthy means viewers start quickly, watch without stalls at a good bitrate, and see no errors.\n\nServer-side health (5xx rate, hit ratio) is the **cause view**. Viewer experience is the **symptom view**. You need both, but the symptom view is the one that matters to the business.",
        },
        {
          kind: "read",
          title: "Delivery quality is revenue",
          body: "Krishnan and Sitaraman (IMC 2012) studied 23 million views from 6.7 million unique viewers on Akamai's network.\n\n- Viewers started to abandon a video if it took more than **2 seconds** to start.\n- Each extra second of delay increased the abandonment rate by **5.8%**.\n- [[Rebuffering|Rebuffering ratio]] time equal to 1% of the video meant **5% less** of the video played.\n- A viewer who saw a failure was **2.32%** less likely to come back within a week.",
          visual: {
            kind: "stats",
            items: [
              { value: "2 s", label: "Abandonment starts" },
              { value: "+5.8%", label: "Abandonment per extra second" },
              { value: "-5%", label: "Play time at 1% rebuffering" },
              { value: "-2.32%", label: "Return within a week after a failure" },
            ],
            caption: "Krishnan and Sitaraman, IMC 2012",
          },
        },
        {
          kind: "quiz",
          prompt: "In the IMC 2012 study, which event made a viewer less likely to come back to the same site within a week?",
          options: ["A bitrate switch", "A playback failure", "A 2-second startup", "A seek"],
          answer: 1,
          explain: "A viewer who saw a failure was 2.32% less likely to return within a week. Startup delay above 2 s drove abandonment (+5.8% per extra second), and rebuffering cut watch time.",
        },
        {
          kind: "read",
          title: "The vantage-point table",
          body: "Map what each hop can observe. This table is the mental model for every investigation.\n\n**No single row answers \"why did this viewer stall?\"** The player row says a stall happened. The CDN row says why.",
          visual: {
            kind: "table",
            headers: ["Vantage point", "Sees well", "Cannot see", "Typical source"],
            rows: [
              ["Player", "Startup, stalls, bitrate, errors, device, measured throughput", "Which cache tier served the bytes", "Conviva, Mux Data, NPAW, in-house SDK, CMCD"],
              ["CDN edge", "Every request: status, bytes, TTFB, cache result, PoP, country, ASN", "Whether the viewer was stalling (unless CMCD)", "Fastly, CloudFront, Akamai log streams"],
              ["Shield", "Miss traffic, shield hit ratio, origin fetch latency", "Viewer experience", "Same vendor logs"],
              ["Origin", "Requests that miss every cache, errors, egress", "95%+ of traffic", "S3/GCS metrics, APM"],
              ["Control plane", "Playback API, entitlement, manifest, license latency and errors", "The bytes path", "Datadog APM"],
              ["Synthetic probes", "Availability from fixed places, even with no users", "Real last mile, real devices", "Catchpoint, ThousandEyes, Datadog Synthetics"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "A viewer stalled. Which vantage point can tell you which cache tier served their bytes?",
          options: ["The player", "CDN edge logs", "Synthetic probes", "The playback API trace"],
          answer: 1,
          explain: "CDN logs record the cache result (hit, miss, shield hit) for every request. The player sees the stall but not the tier. Probes do not see real users, and the control plane does not see the bytes path.",
        },
        {
          kind: "read",
          title: "Data flow 1: the bytes path",
          body: "The bytes go player, CDN edge, shield, origin. Only the player and the CDN see every request. The origin sees only what missed both cache tiers, which is under 5% of traffic in the book's model.",
          visual: { kind: "flow", spec: { ...VANTAGE, focus: ["p", "e", "s", "o", "p>e", "e>s", "s>o"], flow: ["p>e", "e>s", "s>o"] } },
        },
        {
          kind: "read",
          title: "Data flow 2: the log path",
          body: "The edge and shield push a **CDN log stream**. It lands twice: in **Datadog** for real-time work, and as **raw logs in object storage** for cheap long-term analysis. The origin adds cloud metrics.",
          visual: { kind: "flow", spec: { ...VANTAGE, focus: ["e", "s", "l", "dd", "r", "o", "e>l", "s>l", "l>dd", "l>r", "o>dd"], flow: ["e>l", "l>dd"] } },
        },
        {
          kind: "read",
          title: "Data flow 3: player, API and probes",
          body: "The player sends QoE events to a vendor or in-house collector. The playback API and steering service send APM traces. Synthetic probes hit the edge on a schedule. All of it lands in Datadog, the control room.",
          visual: { kind: "flow", spec: { ...VANTAGE, focus: ["p", "qoe", "api", "x", "e", "dd", "p>qoe", "qoe>dd", "api>dd", "x>e"], flow: ["p>qoe", "qoe>dd"] } },
        },
        {
          kind: "summary",
          points: [
            "One playback crosses player, ISP, CDN edge, shield, origin and control plane. You own few of them.",
            "Each hop sees part of the truth. Observability is joining the views fast enough to act.",
            "Signals: metrics, logs, traces, plus client QoE (RUM) from the player.",
            "~500k segment requests per second, ~540 billion a month (assumed): aggregate early, sample, keep raw logs in object storage.",
            "Server health is the cause view, viewer experience is the symptom view. Quality is revenue (IMC 2012).",
          ],
        },
      ],
    },

    /* ======================= Lesson 2 ======================= */
    {
      id: "ch11-l2",
      title: "CDN logs: the request-level truth",
      goal: "Configure useful log fields on Fastly, CloudFront and Akamai, size a Kinesis stream, and normalize vendors into one schema.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "Where can you see every byte you pay for, broken down by PoP, country, ISP and cache result?",
          options: ["The player SDK", "CDN logs", "Origin metrics", "Synthetic probes"],
          answer: 1,
          explain: "CDN logs are the only place with every byte you pay for, split by PoP, country, ISP and cache result. Each vendor exports them differently, so multi-CDN analysis needs one common schema.",
        },
        {
          kind: "read",
          title: "Fastly real-time log streaming",
          body: "Fastly streams one log line per request to an endpoint you choose: a native Datadog endpoint, S3, GCS, BigQuery, Kafka, HTTPS, syslog and dozens more.\n\nIn a VCL service, the logging call runs in `vcl_log`, after the response is delivered, so final values are known. You write a **log format string**:\n\n- `%{variable}V` for VCL variables\n- `%{Header}i` for request headers\n- `%{Header}o` for response headers",
        },
        {
          kind: "read",
          title: "Fastly variables worth logging",
          body: "The TCP socket variables are gold for [[last mile]] debugging.",
          visual: {
            kind: "table",
            headers: ["Variable", "What it tells you"],
            rows: [
              ["`fastly_info.state`", "Cache state: HIT, MISS, PASS, ERROR, with suffixes like `-WAIT` (collapsed behind an in-flight fetch). Final in `vcl_deliver` and `vcl_log`."],
              ["`server.datacenter`", "The PoP"],
              ["`client.geo.country_code`", "Viewer country"],
              ["`client.as.number`", "Viewer ASN"],
              ["`time.to_first_byte`", "Request start to just before `vcl_deliver`"],
              ["`time.elapsed.usec`, `resp.body_bytes_written`", "Total time and bytes sent"],
              ["`client.socket.tcpi_rtt`, `tcpi_total_retrans`, `ploss`", "TCP round-trip time, retransmits, estimated packet loss"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each Fastly variable to what it logs.",
          pairs: [
            ["`fastly_info.state`", "Cache state (HIT, MISS, PASS)"],
            ["`server.datacenter`", "The PoP"],
            ["`client.as.number`", "The viewer's ASN"],
            ["`client.socket.tcpi_total_retrans`", "TCP retransmits"],
            ["`time.to_first_byte`", "Time to first byte"],
          ],
          explain: "These five, plus country, bytes and RTT, are enough to separate a cache problem from a network problem in most delivery incidents.",
        },
        {
          kind: "read",
          title: "A delivery-focused log format",
          body: "Fastly's Datadog guide says the JSON must be valid, entered as **one line** in the log format field, with `ddsource` set to `fastly`. It is shown on many lines here for reading.\n\nThe last field captures the CMCD session header (lesson 5).",
          visual: { kind: "code", lang: "json", code: FASTLY_JSON, caption: "Fastly log format string (one line in practice)" },
        },
        {
          kind: "quiz",
          prompt: "The format logs `req.url.path`, not the full URL with its query string. Why?",
          options: [
            "Query strings are too long for Datadog",
            "Query strings often carry signed-URL tokens, and tokens in logs are a security leak",
            "Fastly cannot log query strings",
            "It improves the cache hit ratio",
          ],
          answer: 1,
          explain: "Query strings often carry [[signed URL]] tokens. Tokens in logs are a security leak (Chapter 8 covers tokens). So the path is logged without the query on purpose.",
        },
        {
          kind: "read",
          title: "Fastly to Datadog",
          body: "The native Datadog endpoint needs an API key and the region of your Datadog site. Datadog also documents a syslog endpoint, but recommends the native one as more reliable.\n\nSeparately, Datadog's Fastly integration pulls aggregated metrics: `fastly.requests`, `fastly.hit_ratio`, `fastly.bandwidth`, `fastly.status_5xx`, `fastly.origin_fetches`, `fastly.shield_fetches`. They are cheap and good for dashboards, but have **no per-ASN or per-path detail**.",
        },
        {
          kind: "read",
          title: "CloudFront: standard and real-time logs",
          body: "**Standard logs (v2)** go to CloudWatch Logs, Firehose or S3, in formats including JSON and Parquet. Enabling them is free, though delivery and storage can cost money. They suit forensics and daily reports, not real-time alerting.\n\n**Real-time logs** go to a Kinesis Data Stream \"within seconds\". You set a **sampling rate** (a whole number from 1 to 100, the percent of requests logged), the fields, and the cache behaviors that log. For example, segments at 5% and manifests at 100%.",
        },
        {
          kind: "quiz",
          prompt: "Your CloudFront real-time log count is slightly below the billing count. What is the most likely explanation?",
          options: [
            "Your Kinesis consumer has a bug",
            "Real-time logs are best-effort: a record may arrive late or, rarely, never",
            "CloudFront bills for requests it never served",
            "Sampling was set to 101",
          ],
          answer: 1,
          explain: "AWS warns real-time logs are best-effort, so counts may not match billing. They also cost extra on top of Kinesis. Use them for real-time signals, not for billing reconciliation.",
        },
        {
          kind: "read",
          title: "CloudFront fields that matter",
          body: "One trap: real-time records are **positional**. Fields come in a fixed order, and adding a field later shifts the others. Your consumer must handle this.",
          visual: {
            kind: "table",
            headers: ["Field", "Tells you"],
            rows: [
              ["`time-to-first-byte`, `time-taken`", "TTFB and total time"],
              ["`x-edge-location`, `asn`, `c-country`", "PoP code (such as DFW3), ISP network, country"],
              ["`x-edge-detailed-result-type`", "Hit, Miss, `OriginShieldHit`, `OriginConnectError`, `OriginDnsError`, `ClientCommError`"],
              ["`origin-fbl`, `origin-lbl`", "First-byte and last-byte latency to your origin"],
              ["`sr-reason`", "Why an origin was selected, e.g. `Failover:502`"],
              ["Fields 46 to 63", "CMCD: `cmcd-session-id`, `cmcd-buffer-starvation`, `cmcd-measured-throughput` (only if the player sends CMCD)"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "Which single CloudFront field often tells you which hop failed?",
          options: ["`c-country`", "`x-edge-detailed-result-type`", "`time-taken`", "`sr-reason`"],
          answer: 1,
          explain: "`x-edge-detailed-result-type` separates a hit from an `OriginShieldHit`, an `OriginConnectError`, an `OriginDnsError` and a `ClientCommError`. That alone often names the failing hop.",
        },
        {
          kind: "read",
          title: "Kinesis sizing",
          body: "Each Kinesis shard accepts up to **1,000 records and 1 MB per second**.\n\nAssume CloudFront carries 30% of the 500,000 requests per second: 150,000 per second. Records are ~1 KB with the fields you want. How many shards do you need?",
          visual: {
            kind: "stats",
            items: [
              { value: "1,000", label: "Records per second per shard" },
              { value: "1 MB/s", label: "Bytes per shard" },
              { value: "150k/s", label: "CloudFront requests", note: "30% share, assumed" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "At 10% sampling and ~1 KB per record, how many Kinesis shards for 150,000 requests per second (normal peak)?",
          answer: 15,
          tolerance: 1,
          unit: "shards",
          hint: "10% of 150,000 records per second. Each shard takes 1,000 records and 1 MB per second.",
          explain: "150,000 x 10% = 15,000 records and ~15 MB per second. 15,000 / 1,000 = 15 shards. Size for the spike and you need ~30.",
        },
        {
          kind: "number",
          prompt: "Same traffic, but at 100% sampling. How many shards at normal peak?",
          answer: 150,
          tolerance: 10,
          unit: "shards",
          explain: "150,000 records and ~150 MB per second: ~150 shards. Sampling is a cost decision.",
        },
        {
          kind: "read",
          title: "CloudFront to Datadog",
          body: "Datadog's AWS integration collects metrics such as `aws.cloudfront.requests` and `aws.cloudfront.5xx_error_rate`. The important ones, `aws.cloudfront.cache_hit_rate` and `aws.cloudfront.origin_latency`, need CloudFront **additional metrics** turned on.\n\nStandard logs reach Datadog through the **Datadog Forwarder Lambda** reading S3. Real-time logs go from Kinesis through the **Firehose** integration.",
        },
        {
          kind: "quiz",
          prompt: "Your Datadog CloudFront dashboard shows `aws.cloudfront.requests`, but `aws.cloudfront.cache_hit_rate` is empty. Why?",
          options: [
            "Real-time logs are sampled at 5%",
            "CloudFront additional metrics are not turned on",
            "The Forwarder Lambda is not reading S3",
            "Hit rate only exists in Fastly",
          ],
          answer: 1,
          explain: "`cache_hit_rate` and `origin_latency` need CloudFront additional metrics. The basic integration gives requests and error rates. Logs reach Datadog by a separate path (Forwarder Lambda or Firehose).",
        },
        {
          kind: "read",
          title: "Akamai DataStream 2 and others",
          body: "Akamai's **DataStream 2** pushes logs over HTTPS to destinations including Datadog, using a Datadog v1 intake URL and API key (Akamai notes v2 endpoints were not supported). Datadog ships an out-of-the-box DataStream 2 dashboard.\n\nOn Adaptive Media Delivery, Akamai offers a **CMCD log set** (CMCD v1 and v2). Google Media CDN (Cloud Logging) and Cloudflare (Logpush) follow the same pattern: one push stream per CDN, landing in a cheap store and in Datadog.",
        },
        {
          kind: "read",
          title: "One schema for many CDNs",
          body: "Each vendor names the same idea differently. Build a **normalized delivery log schema**, or every [[multi-CDN]] comparison becomes manual translation. Check the exact Akamai field names in the DataStream 2 docs for your stream version.",
          visual: {
            kind: "table",
            headers: ["Common field", "Fastly", "CloudFront", "Akamai DS2"],
            rows: [
              ["`cdn`", "\"fastly\"", "\"cloudfront\"", "\"akamai\""],
              ["`pop`", "`server.datacenter`", "`x-edge-location`", "edge location fields"],
              ["`cache_status`", "`fastly_info.state` mapped", "`x-edge-detailed-result-type` mapped", "cache status mapped"],
              ["`ttfb_ms`", "`time.to_first_byte`", "`time-to-first-byte` x 1000", "turnaround or first-byte field"],
              ["`bytes`", "`resp.body_bytes_written`", "`sc-bytes`", "bytes field"],
              ["`asn`", "`client.as.number`", "`asn`", "ASN field if enabled"],
              ["`country`", "`client.geo.country_code`", "`c-country`", "country field"],
              ["`session_id`", "parsed from CMCD", "`cmcd-session-id`", "CMCD log set"],
              ["`object_type`", "path or CMCD `ot`", "`cmcd-object-type` or path", "CMCD log set or path"],
            ],
            caption: "cache_status values: hit, miss, shield_hit, error",
          },
        },
        {
          kind: "read",
          title: "Normalize in Datadog log pipelines",
          body: "In Datadog you normalize with **log pipelines**: ordered **processors** applied at ingest.\n\n- Grok parser for non-JSON formats\n- Remapper: rename `x-edge-location` to `pop`\n- Category processor: map `HIT`, `HIT-CLUSTER`, `MISS-WAIT` into a few `cache_status` values\n- Arithmetic processor: seconds to milliseconds\n- Lookup processor: ASN to ISP name",
          callout: { type: "mistake", text: "Comparing \"cache hit ratio\" across CDNs without normalizing. Integration metrics such as `fastly.hit_ratio` and `cache_hit_rate` are request-based, and vendors treat shield hits differently. Define hit ratio once, by bytes, from normalized logs." },
        },
        {
          kind: "match",
          prompt: "Match each Datadog pipeline processor to its job.",
          pairs: [
            ["Grok parser", "Parse a non-JSON log format"],
            ["Remapper", "Rename `x-edge-location` to `pop`"],
            ["Category processor", "Map HIT, MISS-WAIT into `cache_status`"],
            ["Arithmetic processor", "Convert seconds to milliseconds"],
            ["Lookup processor", "Turn an ASN into an ISP name"],
          ],
          explain: "Processors run in order at ingest. Together they turn three vendor formats into one delivery schema, so dashboards and SLIs compare CDNs fairly.",
        },
        {
          kind: "summary",
          points: [
            "Fastly streams one line per request; log `fastly_info.state`, PoP, ASN, TTFB, bytes and TCP RTT/retransmits. Never log query-string tokens.",
            "CloudFront: standard logs for forensics, real-time logs (sampled 1 to 100%, best-effort, positional fields) via Kinesis.",
            "Kinesis shard = 1,000 records and 1 MB per second. 150k req/s at 10% and 1 KB = ~15 shards; at 100% = ~150.",
            "Akamai DataStream 2 pushes to Datadog and has a CMCD log set.",
            "Normalize every vendor into one schema with pipeline processors. Define hit ratio once, by bytes.",
          ],
        },
      ],
    },

    /* ======================= Lesson 3 ======================= */
    {
      id: "ch11-l3",
      title: "Players and probes",
      goal: "Choose a QoE data source, get it into Datadog safely, sample player events, and design the synthetic probes a delivery team needs.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "A CDN log shows a segment took 3 seconds to send. Was that a stall for the viewer?",
          options: [
            "Yes, 3 seconds is always a stall",
            "No, the CDN would have logged an error",
            "You cannot tell from CDN logs alone: it depends on the player's buffer",
          ],
          answer: 2,
          explain: "With a full buffer, 3 seconds is fine. With an empty buffer, it is a stall. Only the player knows, which is why player-side telemetry is essential.",
        },
        {
          kind: "read",
          title: "Only the player knows what the viewer felt",
          body: "Chapter 10 defines the [[QoE]] metrics: [[video start time]], [[video start failure]], [[exits before video start]], [[rebuffering ratio]] and bitrate. Here the question is how to **collect** them and **join** them with everything else.",
          visual: { kind: "flow", spec: { ...VANTAGE, focus: ["p", "qoe", "dd", "p>qoe", "qoe>dd"], flow: ["p>qoe", "qoe>dd"] } },
        },
        {
          kind: "read",
          title: "Three ways to get QoE data",
          body: "Many large services mix a commercial vendor with an in-house event stream for raw data. Vendors also offer composite scores: Mux documents a playback success score that accounts for failures and exits before video start.",
          visual: {
            kind: "table",
            headers: ["Option", "Examples", "Strengths", "Weaknesses"],
            rows: [
              ["Commercial QoE analytics", "Conviva, Mux Data, NPAW (Youbora)", "Ready SDKs for many players and devices, standard definitions, ISP and CDN breakdowns, benchmarks", "Cost per view, data lives in vendor, limited raw access, sampling and latency limits"],
              ["General RUM tool", "Datadog RUM (web and mobile)", "Same tool as backend, easy APM correlation", "Not built for video; you define video events"],
              ["In-house pipeline", "SDK posts to your collector, stream processing, warehouse", "Full control, raw data, custom metrics, join with anything", "You build SDKs for dozens of devices and own the definitions"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each need to the QoE option that fits it best.",
          pairs: [
            ["Ready SDKs and industry benchmarks", "Commercial QoE analytics"],
            ["Same tool as the backend APM", "General RUM tool"],
            ["Raw events you can join with anything", "In-house pipeline"],
          ],
          explain: "Commercial vendors give fast coverage and benchmarks. A general RUM tool gives APM correlation but no video events. In-house gives full control at the cost of building SDKs on dozens of platforms.",
        },
        {
          kind: "read",
          title: "Getting QoE into Datadog",
          body: "Two vendors have native Datadog integrations.\n\n- **Conviva** (partnership announced August 2021): pulls metrics defined by a Conviva \"MetricLens\", such as `conviva.quality.total_attempts`, maps Conviva dimensions to Datadog tags, and supports monitors on playback and startup failure percentages.\n- **Mux Data**: `mux.metric.video_startup_time`, `mux.metric.rebuffer_percentage`, `mux.metric.playback_failure_percentage`, `mux.metric.exits_before_video_start`.\n\nWatch definitions. Mux's \"monitoring metrics\" have sub-20-second latency, but some are computed differently from the full QoE metrics. Label which one each dashboard uses.",
        },
        {
          kind: "quiz",
          prompt: "The analytics collector becomes unreachable for the players hit worst by an outage. What happens to the rebuffering ratio on your dashboard?",
          options: [
            "It spikes, so the alert fires",
            "It can look better, because only healthy sessions still report",
            "It stays exactly the same",
          ],
          answer: 1,
          explain: "A total outage looks like zero telemetry. A ratio computed over the sessions that still report can look better. That is why ratio alerts need a partner: a volume alert.",
        },
        {
          kind: "read",
          title: "Pair every ratio with volume",
          body: "Ratios hide missing data. If telemetry drops, the denominator shrinks with the numerator, and the dashboard stays calm while viewers suffer.",
          callout: { type: "staff", text: "Ask in design review: \"When the player cannot reach the analytics collector, what do we see?\" A total outage looks like zero telemetry, and a ratio over the sessions that still report can look better. Always pair QoE ratio alerts with a volume alert (plays per minute versus baseline)." },
        },
        {
          kind: "number",
          prompt: "~1M concurrent streams each send a heartbeat every 10 seconds. How many heartbeat events per second?",
          answer: 100000,
          tolerance: 5000,
          unit: "events/s",
          explain: "1M / 10 s = 100,000 events per second. At one heartbeat every 30 s it is ~33,000. The book's range: 30,000 to 100,000 events per second.",
        },
        {
          kind: "read",
          title: "Sampling the player",
          body: "If you build in-house:\n\n- Send **start, failure and session-end** events at 100%. They are rare and they matter.\n- **Sample heartbeats.**\n- Record the **sample rate on each event**, so counts can be scaled back up.",
        },
        {
          kind: "quiz",
          prompt: "Why store the sample rate on every sampled event?",
          options: [
            "So the warehouse can delete old events",
            "So counts can be scaled back up to true totals",
            "So the CDN can cache the event",
          ],
          answer: 1,
          explain: "A heartbeat sampled at 10% stands for 10 heartbeats. Storing the rate on the event lets every query scale counts back up, even if the rate changes over time.",
        },
        {
          kind: "read",
          title: "Why synthetics, if you have real users?",
          body: "Real-user data has **no signal when there is no traffic**: a new region, 4 a.m. in a small country, a new CDN before you steer users to it. It also reacts only **after** users are hurt.\n\n**Synthetic monitoring** runs scripted requests from known locations on a schedule. Google's SRE workbook also suggests artificial traffic for low-traffic services. See [[synthetic probe]].",
          visual: { kind: "flow", spec: { ...VANTAGE, focus: ["x", "e", "x>e"], flow: ["x>e"] } },
        },
        {
          kind: "read",
          title: "Synthetic tools",
          body: "Three common tools, each with a different strength.",
          visual: {
            kind: "table",
            headers: ["Tool", "Strength"],
            rows: [
              ["Catchpoint", "Streaming test plays an HLS or DASH source; playback and network metrics, filmstrips, waterfalls, traceroutes, buffer counter"],
              ["ThousandEyes (Cisco)", "Network paths, BGP views, CDN monitoring; proving to an ISP or CDN that a routing problem is theirs"],
              ["Datadog Synthetics", "API tests (HTTP, SSL, DNS, TCP, UDP, ICMP, WebSocket, gRPC), multistep API, browser, mobile, network path; managed or private locations"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "You must prove to an ISP that a routing problem is on their side. Which tool is strongest here?",
          options: ["Catchpoint streaming test", "ThousandEyes", "Mux Data", "Datadog RUM"],
          answer: 1,
          explain: "ThousandEyes focuses on network paths and BGP views, which is the evidence an ISP or CDN accepts. Catchpoint is strong for playback tests; Mux and RUM are real-user data.",
        },
        {
          kind: "read",
          title: "What a delivery team should probe",
          body: "1. **Per-CDN manifest fetch**, through each CDN hostname directly, bypassing steering.\n2. **Per-CDN segment fetch with a time assertion.**\n3. **Cache-miss path**: a cache-busting object that tests shield and origin, which normal hits hide.\n4. **DNS answers** per delivery hostname (Chapter 3) and **TLS certificate expiry** (Chapter 15).\n5. **Control-plane flow**: a multistep test that calls the playback API, gets a signed URL, and fetches manifest and segment. It catches signing mistakes a plain URL test misses.",
        },
        {
          kind: "quiz",
          prompt: "A synthetic probe downloads a 4-second segment. It gets a 200, and the download takes 4.2 seconds. Pass or fail?",
          options: ["Pass: the status is 200", "Fail: it is slower than real time, so a player would drain its buffer", "Pass, unless the PoP is far away"],
          answer: 1,
          explain: "A 200 that takes 4 seconds to download a 4-second segment is already a failure for video. That is why segment probes need a time assertion, not just a status check.",
        },
        {
          kind: "multi",
          prompt: "Which of these can synthetic probes catch well? Select all that apply.",
          options: [
            "A CDN hostname failing at 4 a.m. in a small country",
            "A new CDN that is broken before you steer users to it",
            "A congested peering link to a Brazilian mobile carrier",
            "A TLS certificate about to expire",
            "Stalls on one TV model",
          ],
          answers: [0, 1, 3],
          explain: "Probes work with zero users and test fixed things like hostnames and certificates. They run from well-connected data centers, so they miss real last-mile congestion and real devices.",
        },
        {
          kind: "read",
          title: "Green probes do not mean happy viewers",
          body: "Synthetics are for **early warning and isolation**, not for QoE. Use them to know a CDN or hostname is broken before users arrive, and to localize a path problem once you have one.",
          callout: { type: "mistake", text: "Treating green synthetics as proof viewers are fine. Probes run from well-connected data centers and miss the congested peering link to a Brazilian mobile carrier." },
        },
        {
          kind: "summary",
          points: [
            "Only the player tells you what the viewer felt. Options: commercial QoE, general RUM, in-house, or a mix.",
            "Conviva and Mux integrate natively with Datadog. Label which metric definition each dashboard uses.",
            "Always pair QoE ratio alerts with a volume alert: missing telemetry makes ratios look better.",
            "Send start, failure and end events at 100%, sample heartbeats, store the sample rate.",
            "Probe each CDN directly, with time assertions, the miss path, DNS, TLS and the full signed-URL flow. Probes warn and isolate; they do not measure QoE.",
          ],
        },
      ],
    },

    /* ======================= Lesson 4 ======================= */
    {
      id: "ch11-l4",
      title: "Datadog without bill shock",
      goal: "Map delivery questions to Datadog features, use logs-to-metrics to cut cost, and keep metric cardinality under control.",
      minutes: 12,
      steps: [
        {
          kind: "number",
          prompt: "~540 billion CDN requests a month (assumed). Datadog listed Flex Logs storage from about $0.05 per million events per month. Storage cost alone, per month?",
          answer: 27000,
          tolerance: 2000,
          unit: "$/month",
          hint: "540 billion is 540,000 million.",
          explain: "540,000 million x $0.05 = ~$27,000 per month for storage alone, before ingest. So many teams keep 100% of raw CDN logs in S3 or GCS (queried with Athena or BigQuery) and send Datadog only what real-time work needs.",
        },
        {
          kind: "read",
          title: "Datadog as the control room",
          body: "The 2026 job posting for the Media Delivery team names Datadog explicitly. Each Datadog product answers a different delivery question.",
          visual: {
            kind: "table",
            headers: ["Delivery question", "Datadog feature", "Notes"],
            rows: [
              ["Hit ratio, 5xx or bandwidth changing per CDN?", "Integration metrics and dashboards", "Cheap, coarse, minute-level"],
              ["What happened on ASN 28573 to PoP GRU?", "Log Explorer and Log Analytics", "Rich, expensive, needs good facets"],
              ["Long-term trends without indexing every log", "Generate metrics from logs", "Kept 15 months"],
              ["p95 TTFB across all PoPs", "Distribution metrics", "Percentiles server-side (DDSketch)"],
              ["Why is the playback API slow?", "APM distributed tracing", "TypeScript services with `dd-trace`"],
              ["Are viewers stalling?", "Conviva or Mux, or RUM custom events", "Symptom-side"],
              ["Is CDN X reachable from region Y now?", "Synthetics", "Works with zero users"],
              ["Meeting promises, who gets paged?", "SLOs, burn-rate alerts, monitors", "Lessons 6 and 7"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each delivery question to the Datadog feature that answers it.",
          pairs: [
            ["p95 TTFB across all PoPs", "Distribution metrics"],
            ["Is CDN X reachable from region Y with no users?", "Synthetics"],
            ["Why is the playback API slow?", "APM distributed tracing"],
            ["What happened on ASN 28573 to PoP GRU?", "Log Explorer on CDN logs"],
            ["Are viewers stalling?", "Conviva or Mux integration"],
          ],
          explain: "Metrics for cheap trends, distributions for correct percentiles, logs for request detail, APM for the control plane, QoE integrations for symptoms, synthetics for zero-traffic checks.",
        },
        {
          kind: "read",
          title: "Ingest, index, generate metrics",
          body: "Datadog separates three things you might assume are one:\n\n- **Ingest**: logs arrive and pass through pipelines.\n- **Index**: logs are stored, searchable, for a retention period. **Exclusion filters** on an index decide which logs are stored.\n- **Generate metrics**: logs-to-metrics rules run on the **full ingest stream**, including logs that exclusion filters later drop.",
        },
        {
          kind: "quiz",
          prompt: "An exclusion filter drops 95% of segment logs from the index. Does a logs-to-metrics rule still count those dropped logs?",
          options: [
            "No, it only sees indexed logs",
            "Yes, it runs on the full ingest stream",
            "Only if they are errors",
          ],
          answer: 1,
          explain: "Logs-to-metrics runs before exclusion, on 100% of ingested logs. That is the main trick for CDN logs: exact metrics from every line, while indexing only a small sample plus all errors.",
        },
        {
          kind: "read",
          title: "The main trick, and its catch",
          body: "Generate **exact metrics from 100% of log lines**. Index only a small sample, plus all errors.\n\nThe catch: aggregation only uses logs **timestamped within the past 20 minutes**. Late log batches are missed.",
        },
        {
          kind: "quiz",
          prompt: "A CDN vendor delivers a batch of logs 30 minutes after the requests happened. What happens to your log-based metrics?",
          options: [
            "They count the batch normally",
            "They miss the batch, because only logs timestamped in the past 20 minutes are aggregated",
            "They double-count it",
          ],
          answer: 1,
          explain: "Logs-to-metrics only aggregates logs timestamped within the past 20 minutes. A late batch shows up in the index (if kept) but not in the metric, so the metric undercounts.",
        },
        {
          kind: "read",
          title: "Flex Logs and the raw-log lake",
          body: "**Flex Logs** is a cheaper storage tier with separately priced query compute. Even so, at the book's assumed scale it is ~$27,000 a month for storage alone.\n\nSo a common split: **100% of raw CDN logs in S3 or GCS**, queried with Athena or BigQuery. Datadog gets only what real-time work needs.",
          visual: {
            kind: "compare",
            left: { title: "Datadog", points: ["Real-time dashboards and alerts", "Metrics from 100% of logs", "Indexed sample plus all errors"] },
            right: { title: "Object storage", points: ["100% of raw lines", "Cheap, long retention", "Athena or BigQuery for forensics"] },
          },
        },
        {
          kind: "read",
          title: "Metrics from logs: a worked design",
          body: "Three log-based metrics carry most delivery dashboards. From them you get hit ratio by bytes, error rate, p95 TTFB per CDN per country, and throughput proxies.\n\nNote what is **not** a tag: `asn` and `session_id`. The next steps explain why.",
          visual: {
            kind: "table",
            headers: ["Metric", "Type", "Gives you"],
            rows: [
              ["`delivery.requests`", "Count", "Request and error rates"],
              ["`delivery.ttfb`", "Distribution", "Percentiles such as p95"],
              ["`delivery.bytes`", "Distribution", "Sums, so hit ratio by bytes"],
            ],
            caption: "Tags: cdn, pop, country, status_class, cache_status, object_type",
          },
        },
        {
          kind: "read",
          title: "Cardinality",
          body: "**[[Cardinality]]** is the number of unique time series a metric creates. Datadog defines a custom metric as \"a unique combination of a metric's name and tag values (including the host tag)\".\n\nIts own example: a metric with tag `endpoint` (2 values) and tag `status` (2 values) counts as **4** custom metrics. Every tag multiplies.",
        },
        {
          kind: "number",
          prompt: "`delivery.requests` tagged by CDN (4) x PoP (say 80 per CDN) x status class (5) x cache status (4). Up to how many series?",
          answer: 6400,
          tolerance: 100,
          unit: "series",
          explain: "4 x 80 x 5 x 4 = 6,400. Add country and real combinations might reach hundreds of thousands. Add ASN and you are in the millions. Add session ID and the metric is useless and very expensive.",
        },
        {
          kind: "read",
          title: "Delivery data is full of high cardinality",
          body: "Only combinations that occur create series, but it still explodes. Datadog's own logs-to-metrics guide says: avoid grouping by timestamps, user IDs, request IDs or session IDs, because they affect billing.",
          visual: {
            kind: "table",
            headers: ["Dimension", "Rough number of values"],
            rows: [
              ["CDN", "3 to 5"],
              ["PoP", "tens to hundreds per CDN"],
              ["Country", "200+"],
              ["ASN (ISP network)", "tens of thousands worldwide"],
              ["Device model and OS version", "thousands"],
              ["App or player version", "dozens active"],
              ["Title or episode", "tens of thousands"],
              ["Rendition", "6 to 8 per title"],
              ["Session ID", "millions per hour"],
            ],
          },
        },
        {
          kind: "read",
          title: "Strategies 1 to 3",
          body: "1. **Choose a home for each dimension.** Low-cardinality ones (CDN, region, object type, status class, cache status) go on metrics. High-cardinality ones (session ID, path, IP, device model) stay in logs or the warehouse.\n2. **Bucket the long tail.** An `asn_bucket` tag holds the top N ASNs per country (say 20) plus `other`. Most traffic and most incidents that matter are there. Recompute weekly.\n3. **Separate metrics by question.** A per-PoP metric (CDN x PoP x status x cache) and a per-ISP metric (CDN x country x asn_bucket x status).",
        },
        {
          kind: "match",
          prompt: "Match each dimension to its home.",
          pairs: [
            ["CDN", "A metric tag, as is"],
            ["ASN", "`asn_bucket`: top 20 per country plus other"],
            ["Session ID", "Logs and warehouse, never a tag"],
            ["Title, on a premiere day", "One `release_class` tag"],
          ],
          explain: "Low-cardinality dimensions go on metrics. ASNs get bucketed. Session IDs stay in logs. For launch-day titles, a single low-cardinality tag such as `release_class:simulcast_premiere` replaces a title tag.",
        },
        {
          kind: "read",
          title: "Strategies 4 to 6",
          body: "4. **Use Metrics without Limits.** Ingest all tags but index only an allowlist; billing follows indexed volume. Datadog warns an allowlist can drop tags used by dashboards, monitors or SLOs that were not queried recently.\n5. **Be careful with percentiles.** Distributions give globally correct percentiles via server-side DDSketch, but percentiles on a high-cardinality distribution multiply cost. Enable them only where you alert or report.\n6. **Push the long tail to the warehouse.** Datadog is the real-time control room, not the data lake.",
        },
        {
          kind: "quiz",
          prompt: "Which two dimensions should never be tags on the same metric?",
          options: ["CDN and status class", "PoP and ASN", "Country and object type", "Cache status and CDN"],
          answer: 1,
          explain: "PoP (tens to hundreds per CDN) times ASN (tens of thousands) explodes. Use one per-PoP metric and one per-ISP metric with `asn_bucket`. Never PoP and ASN together.",
        },
        {
          kind: "read",
          title: "The launch-day temptation",
          body: "During a big launch, everyone wants per-title graphs. The cheap answer is a filter on logs by path, or one low-cardinality tag, not a title tag on every metric.",
          callout: { type: "mistake", text: "Adding `title` or `episode_id` as a metric tag \"just in case\" during a simulcast launch. It causes bill shock and outlives the launch. Use one low-cardinality tag such as `release_class:simulcast_premiere` for the titles launching that day, or filter logs by path." },
        },
        {
          kind: "read",
          title: "Dubs and subtitles",
          body: "A catalogue with many languages makes language tags very tempting. Each one multiplies every other tag on the metric.",
          callout: { type: "crunchyroll", text: "With many audio dubs and 10+ subtitle languages per episode (book model), `rendition`, `audio_language` and `subtitle_language` are tempting tags. A platform like Crunchyroll would likely keep them in logs and the warehouse, and put only `object_type` (video, audio, subtitle, manifest) on metrics." },
        },
        {
          kind: "summary",
          points: [
            "Each Datadog feature answers one kind of delivery question: metrics, logs, distributions, APM, QoE integrations, synthetics, SLOs.",
            "Logs-to-metrics runs on 100% of ingest, even excluded logs, but only on logs timestamped in the past 20 minutes.",
            "Index a sample plus errors; keep all raw logs in S3 or GCS. Flex at this scale is still ~$27,000 a month.",
            "Cardinality = unique tag combinations. 4 x 80 x 5 x 4 = 6,400 series already.",
            "Give each dimension a home, bucket ASNs, split metrics by question, use Metrics without Limits and percentiles with care.",
          ],
        },
      ],
    },

    /* ======================= Lesson 5 ======================= */
    {
      id: "ch11-l5",
      title: "Following one session",
      goal: "Use a CMCD session ID and APM span tags to follow one playback through player, API, CDN and QoE data.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "A QoE dashboard shows one bad session. To find its CDN log lines, you match on IP address, time and path. What goes wrong?",
          options: [
            "Nothing. IP, time and path are unique enough.",
            "Carrier-grade NAT puts many users behind one IP, and mobile users change IP mid-session.",
            "CDN logs never contain the client IP.",
          ],
          answer: 1,
          explain: "Matching on IP, time and path is slow and often wrong. Carrier-grade NAT hides many users behind one IP, and mobile users change IP mid-session. You need a shared ID.",
        },
        {
          kind: "read",
          title: "CMCD: the shared key",
          body: "**[[CMCD]]** (Common Media Client Data, CTA-5004) is a CTA WAVE standard. The player attaches small key-value pairs to each media request. These descriptions follow CloudFront's CMCD log field docs.",
          visual: {
            kind: "table",
            headers: ["Key", "Meaning"],
            rows: [
              ["`sid`", "Session ID, a GUID for the playback session"],
              ["`br`", "Encoded bitrate of the requested object"],
              ["`bl`", "Buffer length"],
              ["`bs`", "Buffer starvation since the last request"],
              ["`mtp`", "Throughput measured by the client"],
              ["`ot`", "Object type (video, audio, manifest)"],
              ["`su`", "Startup: needed urgently for start, seek or recovery"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each CMCD key to its meaning.",
          pairs: [
            ["`sid`", "Playback session ID"],
            ["`bl`", "Buffer length"],
            ["`bs`", "Buffer starvation since last request"],
            ["`mtp`", "Client-measured throughput"],
            ["`ot`", "Object type"],
          ],
          explain: "`sid` is the join key. `bl`, `bs` and `mtp` carry the player's state. `ot` says whether the request was video, audio or a manifest.",
        },
        {
          kind: "read",
          title: "How CMCD v2 travels",
          body: "In version 2, CMCD travels three ways:\n\n- As **HTTP headers**: `CMCD-Request`, `CMCD-Object`, `CMCD-Status`, `CMCD-Session`, grouped by how often values change.\n- As a `CMCD` **query argument**.\n- In the new **Event Mode**, as batched POST reports to a collector.\n\nThe spec prefers headers unless [[CORS]] preflight makes them inefficient. v2 requires the `v` key. CTA-5004-A has been superseded by CTA-5004-B. Players such as dash.js support it.",
        },
        {
          kind: "read",
          title: "The player's view inside the CDN log",
          body: "`sid` joins QoE data to CDN logs. And `bl`, `bs` and `mtp` put the player's view **inside the CDN log line**.\n\nRead this line: \"TTFB 40 ms, cache HIT, client reports buffer starvation at 1.2 Mbps.\" The edge answered fast, from cache. The player still starved. So the problem is **after the edge**, not the cache.",
        },
        {
          kind: "quiz",
          prompt: "A CDN log line says: TTFB 35 ms, cache HIT, CMCD `bs` present, `mtp` sharply lower than normal. Where is the problem most likely?",
          options: [
            "The origin",
            "The shield cache",
            "The network path after the edge, toward the viewer",
            "The DRM license server",
          ],
          answer: 2,
          explain: "A fast TTFB and a cache HIT clear the cache, shield and origin. Buffer starvation with low measured throughput means the bytes were slow after leaving the edge: the path toward the viewer.",
        },
        {
          kind: "read",
          title: "Mux plus Akamai, joined on one ID",
          body: "The workflow in practice: find the worst sessions in the QoE tool by CDN, ISP and device. Then query that session's per-segment bitrate and transfer times in the CDN logs.",
          callout: { type: "industry", text: "In April 2023, Akamai's Will Law described a demo where web players with the Mux Data plugin sent CMCD, DataStream captured it, and Mux and Akamai data were joined in Athena on the shared session ID. AWS gave a related re:Invent 2022 talk on CloudFront and CMCD." },
        },
        {
          kind: "read",
          title: "Traces cover the control plane",
          body: "CDNs do not emit spans into your Datadog account, so the bytes path is not traced. The control plane is: playback API, steering, URL signing and manifest services, instrumented in TypeScript with Datadog's Node.js tracer.\n\nDatadog supports `x-datadog-*` headers, W3C Trace Context and B3. The default style is `datadog,tracecontext,baggage`. **Agree on one style with partner teams.** Tag the playback API span with the session ID the player will send in CMCD.",
        },
        {
          kind: "quiz",
          prompt: "Traces from your playback API stop at the entitlement service, which a partner team owns. What is the most likely cause?",
          options: [
            "CDNs do not emit spans",
            "The two teams use different trace propagation styles",
            "The session ID is missing from CMCD",
          ],
          answer: 1,
          explain: "If teams propagate context with different styles (Datadog headers, W3C Trace Context, B3), traces break at the team boundary. Agree on one style with partner teams.",
        },
        {
          kind: "read",
          title: "The end-to-end ID, part 1",
          body: "The playback API mints session ID **S1** and returns it with the manifest URL. Its APM span is tagged with S1. The player sends a session start event with S1 to the QoE collector.",
          visual: { kind: "sequence", spec: { ...SESSION_SEQ, upTo: 2 } },
        },
        {
          kind: "read",
          title: "The end-to-end ID, part 2",
          body: "Every segment request carries CMCD `sid=S1`. On a miss, the edge fetches from the shield, and the shield from the origin. The edge log line records S1 and the cache status.",
          visual: { kind: "sequence", spec: { ...SESSION_SEQ, upTo: 8 } },
        },
        {
          kind: "quiz",
          prompt: "This segment was a miss at the edge and the shield. Which record ties those bytes to the viewer's stall?",
          visual: { kind: "sequence", spec: { ...SESSION_SEQ, upTo: 8 } },
          options: [
            "The origin's access log",
            "The edge log line, which carries CMCD sid S1 and the cache status",
            "The playback API trace",
          ],
          answer: 1,
          explain: "The edge log line holds S1 (from CMCD) next to the cache status, so it joins to the QoE session with the stall. The origin never sees the session ID, and the API trace ends when the manifest URL is returned.",
        },
        {
          kind: "read",
          title: "The end-to-end ID, part 3",
          body: "Heartbeats carry S1 and the stall count. Now one ID links the APM trace, the CDN log lines and the QoE session.\n\nRule 1: **One ID, minted once.** The same value goes into the QoE SDK, CMCD `sid` and APM span tags. If the QoE vendor makes its own view ID, store the mapping.\n\nRule 2: **Log it at the edge.** CloudFront has `cmcd-session-id`, Akamai a CMCD log set, and on Fastly you log the CMCD header.",
          visual: { kind: "sequence", spec: SESSION_SEQ },
        },
        {
          kind: "read",
          title: "Rules 3 and 4",
          body: "Rule 3: **Keep CMCD out of the [[cache key]].** As a query argument, CMCD makes every URL unique and the hit ratio collapses. Strip it from the cache key at the edge, or use headers (Chapters 4 and 5).\n\nRule 4: **Treat the session ID as personal data.** Joined with account data, it identifies a person. Set retention limits with the Security team, and never put account IDs in CDN logs.",
        },
        {
          kind: "quiz",
          prompt: "A team ships CMCD as a query argument and forgets to strip it from the cache key. What happens?",
          options: [
            "Nothing. The CDN ignores unknown query arguments.",
            "Every URL becomes unique and the hit ratio collapses",
            "CORS preflight doubles the request count",
          ],
          answer: 1,
          explain: "CMCD values change per request, so every URL is unique and nothing hits in cache. Strip CMCD from the cache key at the edge, or send it as headers.",
        },
        {
          kind: "multi",
          prompt: "Which practices follow the end-to-end ID rules? Select all that apply.",
          options: [
            "Mint one ID and reuse it in the QoE SDK, CMCD `sid` and APM tags",
            "Let each system create its own ID with no mapping",
            "Put account IDs in CDN logs to make joins easier",
            "Strip the CMCD query argument from the cache key",
            "Agree retention limits for session IDs with Security",
          ],
          answers: [0, 3, 4],
          explain: "One ID minted once, logged at the edge, kept out of the cache key, and treated as personal data. Unmapped IDs break the join; account IDs in CDN logs are a privacy risk.",
        },
        {
          kind: "read",
          title: "Sample by session, not by request",
          body: "Sampling 5% of requests keeps 5% of **every** session's lines, so you can never rebuild one session.\n\nFor debugging, sample **by session**: hash the session ID at the edge and keep all lines for 1% of sessions. Use 100% (or request sampling) for aggregate metrics, and session sampling for the indexed stream.",
        },
        {
          kind: "quiz",
          prompt: "You want to rebuild complete bad sessions from indexed CDN logs, at low cost. Which sampling?",
          options: [
            "Keep a random 1% of requests",
            "Hash the session ID and keep all lines for 1% of sessions",
            "Keep only error lines",
          ],
          answer: 1,
          explain: "Request sampling scatters each session's lines. Hashing the session ID keeps every line for the sampled sessions, so per-session reconstruction works. Aggregate metrics still come from 100%.",
        },
        {
          kind: "summary",
          points: [
            "IP, time and path joins fail: carrier-grade NAT and mobile IP changes.",
            "CMCD (CTA-5004) sends `sid`, `bl`, `bs`, `mtp`, `ot` and more with each request, putting the player's view in the CDN log.",
            "Traces cover the control plane only. Agree one propagation style and tag the playback span with the session ID.",
            "One ID minted once, logged at the edge, kept out of the cache key, treated as personal data.",
            "Sample by session for the indexed stream; use 100% for aggregate metrics.",
          ],
        },
      ],
    },

    /* ======================= Lesson 6 ======================= */
    {
      id: "ch11-l6",
      title: "SLOs and burn-rate alerts",
      goal: "Pick the right availability measure, compute an error budget, and design multiwindow burn-rate alerts that page on symptoms.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "You measure availability by request. One failed manifest and one failed thumbnail. How do they count?",
          options: ["The manifest counts more", "Exactly the same: one failed request each", "The thumbnail counts more"],
          answer: 1,
          explain: "By request, a failed manifest that kills a session counts like a failed thumbnail. Retries also inflate the denominator. That is why the measure you choose matters.",
        },
        {
          kind: "read",
          title: "SLI, SLO, error budget",
          body: "An **[[SLI]]** (service level indicator) is a ratio of good events to valid events, or good time to total time.\n\nAn **[[SLO]]** (service level objective) is a target for it over a window, such as 99.9% over 30 days.\n\nThe **[[error budget]]** is 100% minus the SLO.",
        },
        {
          kind: "read",
          title: "Datadog's three SLO types",
          body: "- **Metric-based**: good events / total events. Best for request and session counts.\n- **Monitor-based**: uptime of Datadog monitors.\n- **Time slice**: share of time slices where a condition holds, such as \"p95 TTFB under 300 ms\".\n\nWindows are rolling 7, 30 or 90 days. Metric-based SLOs can be grouped with `sum by` for per-CDN status and budget.",
        },
        {
          kind: "quiz",
          prompt: "Your SLI is \"p95 TTFB under 300 ms\". Which Datadog SLO type fits?",
          options: ["Metric-based", "Monitor-based", "Time slice"],
          answer: 2,
          explain: "A percentile condition is not a count of good events. A time slice SLO measures the share of time slices (for example 1 minute) where the condition holds.",
        },
        {
          kind: "read",
          title: "Request, bytes or session?",
          body: "Use the **session SLO as the headline promise**. Use request and bytes SLIs per CDN, region and object type as the **diagnostic layer**.",
          visual: {
            kind: "table",
            headers: ["Measure", "Formula", "Catches", "Hides"],
            rows: [
              ["By request", "good requests / all requests", "Broad error spikes", "A failed manifest counts like a failed thumbnail; retries inflate the denominator"],
              ["By bytes", "bytes delivered OK / bytes requested", "Partial transfers, aborts on slow transfers", "Small critical objects barely move it"],
              ["By session", "sessions without a delivery-caused fatal error / all sessions", "What the viewer feels", "Needs player data and failure attribution"],
            ],
          },
        },
        {
          kind: "read",
          title: "Whose budget is this?",
          body: "A start failure can come from entitlement, DRM, the playback API, the CDN or the device. A session SLO only works if every failure has an owner.",
          callout: { type: "staff", text: "Ask \"whose budget is this?\" If Media Delivery owns \"all start failures,\" it gets paged for license outages it cannot fix. Map player error codes to owning teams, give each team its slice, and review the mapping with Playback and Content Protection." },
        },
        {
          kind: "read",
          title: "A delivery SLI catalogue",
          body: "All targets are illustrative for the assumed model, not Crunchyroll's real numbers.",
          visual: {
            kind: "table",
            headers: ["SLI", "Source", "Good event", "Example target"],
            rows: [
              ["Session start success (delivery-attributed)", "Player QoE", "Reached first frame, or failed for non-delivery reasons", "99.9% over 30 days"],
              ["Rebuffering ratio", "Player QoE", "Stall time / watch time", "Under 0.5% at p50; tracked, not paged directly"],
              ["Segment request success", "CDN logs", "2xx or 206 for segments", "99.95% per CDN per region"],
              ["Manifest request success", "CDN logs", "2xx for manifests", "99.99%"],
              ["Segment TTFB", "CDN logs, distribution", "TTFB under 300 ms (hit)", "99% of 1-minute slices meet p95 target"],
              ["Delivered throughput", "CDN logs", "Bytes / transfer time above top rendition x 1.5", "Tracked per CDN per country"],
              ["Cache hit ratio by bytes", "CDN logs", "Bytes from edge or shield cache", "95%+ VOD (assumed)"],
              ["Origin offload", "CDN and origin metrics", "1 minus origin egress / edge egress", "Tracked; alert on sharp drops"],
              ["Replication lag", "Replication metrics", "Object in secondary origin within N minutes", "Chapter 6"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "~300M streaming hours a month, average session ~30 minutes (both assumed). With a 99.9% session-start SLO, how many failed starts does the budget allow per month?",
          answer: 600000,
          tolerance: 30000,
          unit: "failed starts",
          hint: "First find sessions per month: 300M hours / 0.5 hour.",
          explain: "300M hours / 0.5 h = ~600M sessions. The budget is 0.1%: 600M x 0.001 = ~600,000 failed starts per month.",
        },
        {
          kind: "number",
          prompt: "A simulcast premiere: ~1.5M sessions start in 10 minutes (assumed). One CDN fails 5% of them. What percent of the month's 600,000-start budget is gone?",
          answer: 12.5,
          tolerance: 0.5,
          unit: "%",
          hint: "Failed starts = 1.5M x 5%.",
          explain: "1.5M x 5% = ~75,000 failed starts. 75,000 / 600,000 = 12.5% of the month's budget in 10 minutes. Spikes concentrate risk (Chapter 13).",
        },
        {
          kind: "read",
          title: "SLOs as code",
          body: "Manage SLOs with the Datadog Terraform provider (Chapter 14): a `datadog_service_level_objective` resource of type `metric`, a numerator such as `sum:delivery.session.start.good{*}.as_count()`, a matching denominator, and a `30d` threshold of 99.9. The metric names are examples from your QoE pipeline or logs-to-metrics rules.",
          visual: { kind: "code", lang: "hcl", code: SLO_HCL, caption: "Sketch of the resource the book describes; metric names are examples" },
        },
        {
          kind: "read",
          title: "Page on symptoms, not causes",
          body: "Page on **symptoms**: start failures, rebuffering, segment errors on a CDN carrying real traffic, a sudden drop in plays per minute.\n\nDo not page on **causes** alone (hit ratio down 2 points, origin latency up 20 ms). Many cause changes never hurt viewers (the shield absorbs an origin slowdown), and some viewer-hurting failures have causes you never thought to monitor.",
          visual: { kind: "flow", spec: { ...ALERT_FLOW, focus: ["sym", "burn", "page", "ticket", "dash", "sym>burn", "burn>page", "burn>ticket", "burn>dash"], flow: ["sym>burn", "burn>page"] } },
        },
        {
          kind: "multi",
          prompt: "Which of these should page someone? Select all that apply.",
          visual: { kind: "flow", spec: { ...ALERT_FLOW, focus: ["cause", "dash", "inv", "page", "cause>dash", "cause>inv", "page>inv"] } },
          options: [
            "Session start failures spike",
            "Hit ratio dips 2 points",
            "Plays per minute drop sharply versus baseline",
            "Origin latency rises 20 ms",
            "Segment errors rise on a CDN carrying real traffic",
          ],
          answers: [0, 2, 4],
          explain: "Symptoms page. Causes (hit ratio, origin latency, PoP errors, replication lag) go to dashboards and investigation views. A page that needed no human action is a bug in the alert.",
        },
        {
          kind: "read",
          title: "Burn rate",
          body: "A fixed threshold like \"errors above 1% for 5 minutes\" is either noisy or slow.\n\n**[[Burn rate]]** is how fast you consume error budget relative to the SLO. A burn rate of 1 uses exactly the whole budget by the end of the window.\n\n**Burn rate = observed error rate / (1 - SLO target)**",
        },
        {
          kind: "number",
          prompt: "SLO 99.9% over 30 days. The fast-burn page fires at burn rate 14.4. What error rate is that?",
          answer: 1.44,
          tolerance: 0.05,
          unit: "%",
          hint: "1 - 0.999 = 0.1%.",
          explain: "14.4 x 0.1% = 1.44% error rate. Sustained for one hour, that spends 2% of the monthly budget.",
        },
        {
          kind: "read",
          title: "Multiwindow, multi-burn-rate",
          body: "The Google SRE workbook recommends this setup for a 99.9% SLO over 30 days. An alert fires only when **both** windows exceed the burn rate.\n\nThe **long window** proves significance. The **short window** proves it is still happening, so the alert resets about five minutes after recovery. The workbook advises against \"for N minutes\" clauses, which do not scale with severity.",
          visual: {
            kind: "table",
            headers: ["Severity", "Long window", "Short window", "Burn rate", "Budget used"],
            rows: [
              ["Page", "1 hour", "5 minutes", "14.4", "2%"],
              ["Page", "6 hours", "30 minutes", "6", "5%"],
              ["Ticket", "3 days", "6 hours", "1", "10%"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "A 30-day window has 720 hours. A burn rate of 6 sustained over the 6-hour long window spends what percent of the budget?",
          answer: 5,
          tolerance: 0.3,
          unit: "%",
          explain: "6 x 6 h / 720 h = 0.05 = 5%. Same idea for the fast page: 14.4 x 1 h / 720 h = 2%. And the ticket: 1 x 72 h / 720 h = 10%.",
        },
        {
          kind: "quiz",
          prompt: "Why does the fast-burn page also need a 5-minute short window?",
          options: [
            "To fire faster than the 1-hour window could",
            "To prove the problem is still happening, so the alert resets about five minutes after recovery",
            "To save Datadog query cost",
          ],
          answer: 1,
          explain: "Without the short window, the 1-hour average stays high for up to an hour after the problem ends, and the alert keeps firing. The short window confirms it is still burning now.",
        },
        {
          kind: "widget",
          widget: "slo-burn",
          title: "Static threshold versus burn rate",
          task: "Replay the total outage and watch the 14.4x page fire. Then pick the \"One ISP slow burn\" preset at 99.9%: the static alert stays silent, but the ticket catches it. Try the tiny blip too: who gets a false page?",
        },
        {
          kind: "read",
          title: "Burn-rate alerts in Datadog",
          body: "Burn-rate alerts work on metric-based, time slice and metric-monitor-based SLOs. The UI takes a long window of 1 to 48 hours and defaults the short window to 1/12 of it; the API or Terraform can override it. Datadog's 30-day recommendations match the workbook and add 3 at 24 hours. Grouped SLOs can alert per group, such as per CDN.",
          visual: { kind: "code", lang: "hcl", code: BURN_HCL, caption: "Fast-burn page as Terraform" },
        },
        {
          kind: "read",
          title: "Low traffic and per-dimension alerts",
          body: "The workbook warns: in low-traffic services, one failed request can produce a huge burn rate. A per-ASN alert for a small ISP will flap at night.\n\n- **Minimum volume guard**: a composite monitor, \"error ratio high AND request count above N\".\n- **Page per CDN and region, not per ASN.** ASN data feeds investigation and automated steering (Chapter 9).\n- **Volume drop alerts**: anomaly monitors learn weekly seasonality, which matters for weekly premieres.\n- **Avoid storms**: if a CDN dies, page once, not 40 times per region.",
          callout: { type: "crunchyroll", text: "The 2026 job posting lists end-to-end observability in Datadog (metrics, tracing, logging, SLOs, alerts), automated health detection and on-call as core to the role. A platform like Crunchyroll would likely need a session SLO shared with Playback, per-CDN error and throughput SLIs, a premiere dashboard, and a clear split of which alerts page which team. The internal setup is not published; use this as a checklist." },
        },
        {
          kind: "quiz",
          prompt: "A per-ASN burn-rate alert for a small ISP pages three times a night with only a handful of requests. Best fix?",
          options: [
            "Raise the burn-rate threshold to 100",
            "Add a minimum-volume guard (composite: error ratio high AND request count above N), and page per CDN and region instead",
            "Add a \"for 30 minutes\" clause",
          ],
          answer: 1,
          explain: "Small slices produce huge burn rates from one failure. Guard on volume, page at CDN and region level, and keep ASN data for investigation and steering. \"For N minutes\" clauses do not scale with severity.",
        },
        {
          kind: "summary",
          points: [
            "SLI = good / valid; SLO = target over a window; error budget = 100% minus SLO.",
            "Session SLO is the headline; request and bytes SLIs per CDN and region are for diagnosis. Give each team its own slice.",
            "99.9% over 30 days with ~600M sessions = ~600,000 failed starts. One bad premiere can spend 12.5% in 10 minutes.",
            "Burn rate = error rate / (1 - SLO). Page at 14.4 (1h and 5m) and 6 (6h and 30m); ticket at 1 (3d and 6h).",
            "Page on symptoms with volume guards, per CDN and region. Every page needs a title, scope, dashboard link, runbook and owner.",
          ],
        },
      ],
    },

    /* ======================= Lesson 7 ======================= */
    {
      id: "ch11-l7",
      title: "Case file: rebuffering in Brazil",
      goal: "Run a delivery investigation from alert to mitigation and vendor ticket, using QoE, CDN logs, CMCD and path tools.",
      minutes: 12,
      steps: [
        {
          kind: "read",
          title: "The alert",
          body: "Tuesday, 21:10 in Brazil. A monitor fires: rebuffering for `country:BR` has **doubled** versus the same hour last week. The Latin America session SLO shows a burn rate of **~6 over 6 hours**.\n\nThis is a realistic composite scenario, not a published Crunchyroll incident. All numbers are assumed.",
          visual: {
            kind: "stats",
            items: [
              { value: "21:10", label: "Tuesday, Brazil time" },
              { value: "2x", label: "Rebuffering vs last week" },
              { value: "~6", label: "Burn rate over 6 hours" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "You are on call. What is your first move?",
          options: [
            "Open the 5xx dashboard",
            "Break down QoE by every dimension: CDN, ISP, device, app version, title, rendition",
            "Call the CDN vendor",
            "Roll back the latest app release",
          ],
          answer: 1,
          explain: "Step 1 is to scope the blast radius with player data. Breaking rebuffering down by every dimension tells you where to look before you guess at causes.",
        },
        {
          kind: "read",
          title: "Step 1: scope the blast radius",
          body: "You open the QoE data (Conviva, Mux or in-house) and break down rebuffering ratio.\n\nFindings:\n\n- Rebuffering is up only for **one ISP** (call it ISP-X, one large ASN).\n- Within ISP-X, only on **CDN-A**. ISP-X sessions on CDN-B are normal.\n- All devices, app versions and titles are affected equally.",
          visual: { kind: "flow", spec: { ...TRIAGE_A, focus: ["a", "b", "a>b"] } },
        },
        {
          kind: "multi",
          prompt: "Given these findings, which causes can you rule out? Select all that apply.",
          visual: { kind: "flow", spec: { ...TRIAGE_A, focus: ["c", "c1", "d", "d1", "e", "e1", "c>c1", "d>d1", "e>e1"] } },
          options: [
            "A player release",
            "An encoding problem",
            "The origin",
            "DRM",
            "Something between CDN-A and ISP-X",
          ],
          answers: [0, 1, 2, 3],
          explain: "All app versions are hit, so not a player release. All titles, so not encoding (Chapter 7). Origin would hit every ISP and both CDNs. DRM license problems cause start failures, not mid-session stalls (Chapter 8). What is left: something between CDN-A and ISP-X.",
        },
        {
          kind: "read",
          title: "Working hypothesis",
          body: "**Something between CDN-A and ISP-X.** The triage tree lands on the CDN logs for that CDN, country and ASN.",
          visual: { kind: "flow", spec: { ...TRIAGE_A, focus: ["c", "d", "e", "f", "c>d", "d>e", "e>f"], flow: ["c>d", "d>e", "e>f"] } },
        },
        {
          kind: "read",
          title: "Step 2: the CDN logs",
          body: "In Datadog Log Analytics (on indexed CDN logs) or with your log-based metrics, filter to the slice. Compare tonight with last week, and with other ISPs on the same CDN tonight.",
          visual: { kind: "code", lang: "text", code: "cdn:cdn-a country:BR asn:ISP_X_ASN object_type:video", caption: "Datadog log query" },
        },
        {
          kind: "quiz",
          prompt: "Read the table. What kind of incident is this?",
          visual: SIGNAL_TABLE,
          options: [
            "A cache or shield problem",
            "An error incident: segments are failing",
            "A network path problem between CDN-A's PoP and ISP-X's users",
            "A player bug",
          ],
          answer: 2,
          explain: "Status codes are fine, so it is not an error incident. Hit ratio and TTFB are fine, so not cache or shield. Throughput collapsed and retransmits rose: the bottleneck is the network path between CDN-A's PoP and ISP-X's users.",
        },
        {
          kind: "read",
          title: "Reading the table",
          body: "- Status codes are fine: **this is not an error incident.** A 5xx dashboard shows nothing.\n- Hit ratio and TTFB are fine: **not a cache or shield problem.**\n- Throughput collapsed (11 to 3.1 Mbps) and retransmits rose 4x: **the bottleneck is the network path.**\n- CMCD fields in the same log lines confirm the player felt it.",
          visual: {
            kind: "stats",
            items: [
              { value: "97% hit", label: "Cache status", note: "unchanged" },
              { value: "35 ms", label: "p50 TTFB", note: "was 32 ms" },
              { value: "3.1 Mbps", label: "Throughput", note: "was 11 Mbps" },
              { value: "4x", label: "TCP retransmits", note: "vs baseline" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "Which single piece of evidence ruled out a cache or shield problem?",
          options: [
            "Segment success rate of 99.97%",
            "Unchanged hit ratio (97%) and TTFB (~35 ms)",
            "CMCD buffer starvation",
            "The burn rate of 6",
          ],
          answer: 1,
          explain: "A cache or shield problem would raise misses or TTFB. Both are unchanged. The network path was pointed to by throughput falling from ~11 to ~3 Mbps with more retransmits, plus CMCD buffer starvation.",
        },
        {
          kind: "read",
          title: "Step 3: which PoP, which path?",
          body: "Group the same filter by `pop`. Suppose ISP-X users normally hit CDN-A's **São Paulo** PoP, but tonight most of their requests come from **Miami**.\n\nThat suggests a routing change: CDN-A's mapping now sends ISP-X to a distant PoP, or ISP-X changed its [[BGP]] announcements (Chapters 2 and 3). A ThousandEyes or Datadog network path test from near ISP-X toward CDN-A shows where latency and loss jump.",
          visual: { kind: "flow", spec: { ...TRIAGE_B, focus: ["f", "g", "h", "f>g", "g>h"], flow: ["f>g", "g>h"] } },
        },
        {
          kind: "quiz",
          prompt: "Grouping by `pop` shows ISP-X is still served from São Paulo, as usual. Evidence is the same: fine status and TTFB, low throughput, high retransmits, 21:10 evening peak. Most likely cause?",
          options: [
            "A cache eviction storm",
            "A congested peering link at evening peak",
            "An origin outage",
            "Expired TLS certificate",
          ],
          answer: 1,
          explain: "If the PoP did not change, the usual cause is a congested [[peering]] link at evening peak, with the same evidence pattern: healthy cache, slow bytes, retransmits.",
        },
        {
          kind: "read",
          title: "Step 4: mitigate first",
          body: "The viewer does not care whose fault it is. **Mitigation comes before root cause.**\n\n1. **Steer ISP-X traffic to CDN-B** with a rule scoped to country BR and ISP-X's ASN (Chapter 9). Automated steering may already be doing this; check first.\n2. **Watch recovery** on the same views. Existing sessions may stay on CDN-A until the player switches (Chapter 10).\n3. **Check CDN-B capacity** in Brazil, also a higher-cost region on many contracts (Chapter 16).",
          visual: { kind: "flow", spec: { ...TRIAGE_B, focus: ["h", "i", "h>i"], flow: ["h>i"] } },
        },
        {
          kind: "order",
          prompt: "Put the response steps in the right order.",
          items: [
            "Break down QoE by CDN, ISP, device, app and title",
            "Filter CDN logs to that CDN, country and ASN",
            "Group by PoP and test the network path",
            "Steer ISP-X traffic to CDN-B",
            "Open a vendor ticket with evidence",
          ],
          explain: "Scope with QoE, separate cache from network with CDN logs, localize with PoP and path tools, mitigate with steering, then chase root cause with the vendor.",
        },
        {
          kind: "read",
          title: "Step 5: root cause and follow-up",
          body: "- Open a **vendor ticket with hard evidence**: time window, ASN, PoP codes, throughput and retransmit graphs, sample request IDs. Ask about mapping changes or peering capacity.\n- In the **postmortem**: How long from impact to alert? Could automated steering have handled it? Should throughput per CDN per top ASN be a tracked SLI?",
          visual: { kind: "flow", spec: { ...TRIAGE_B, focus: ["i", "j", "i>j"], flow: ["i>j"] } },
        },
        {
          kind: "read",
          title: "Every layer did a job",
          body: "QoE scoped the problem. CDN logs separated cache from network. CMCD confirmed what the player felt. Path tools localized it. Steering mitigated it.",
          visual: { kind: "flow", spec: TRIAGE_B },
          callout: { type: "staff", text: "Ask your own team: \"Could we run this in 15 minutes today?\" Any manual export or missing field is your first observability project." },
        },
        {
          kind: "read",
          title: "What the dashboards should look like",
          body: "Top to bottom:\n\n1. **Symptoms**: plays per minute versus last week, start success, rebuffering, per CDN and region.\n2. **SLO budgets.**\n3. **Per-CDN health** from normalized logs: success, hit ratio by bytes, p95 TTFB, throughput.\n4. **Origin and shield.**\n\nTemplate variables for `cdn`, `country`, `asn_bucket` and `object_type` let one dashboard serve both the global view and \"BR on ISP-X\". A separate premiere dashboard adds release times as Datadog events (Chapter 13).",
        },
        {
          kind: "order",
          prompt: "Order the dashboard sections from top to bottom.",
          items: [
            "Symptoms: plays per minute, start success, rebuffering",
            "SLO budgets",
            "Per-CDN health from normalized logs",
            "Origin and shield",
          ],
          explain: "Symptoms first, so the on-call sees viewer pain at a glance. Then budgets, then per-CDN cause signals, then the deepest layer: origin and shield.",
        },
        {
          kind: "summary",
          points: [
            "Scope with QoE first: one ISP, one CDN, all devices and titles points between CDN and ISP.",
            "Zero HTTP errors can still be an incident. Throughput, retransmits and CMCD starvation are first-class signals.",
            "Unchanged hit ratio and TTFB rule out cache and shield; group by PoP to find routing or peering trouble.",
            "Mitigate first (steer the ASN), then root cause with a vendor ticket full of evidence.",
            "Build dashboards symptoms-first with `cdn`, `country`, `asn_bucket`, `object_type` template variables.",
          ],
        },
      ],
    },

    /* ======================= Lesson 8: Checkpoint ======================= */
    {
      id: "ch11-l8",
      title: "Checkpoint",
      goal: "Prove you can reason about delivery observability, SLOs, cardinality and investigations.",
      minutes: 8,
      steps: [
        {
          kind: "quiz",
          prompt: "How can a platform have 99.99% CDN request success and still have a serious viewer-facing incident?",
          options: [
            "It cannot: 99.99% means viewers are fine",
            "Status codes do not measure speed: with a congested peering link every segment returns 200, but a 4-second segment takes 5 seconds, so viewers stall",
            "The CDN hides 5xx errors from its logs",
          ],
          answer: 1,
          explain: "Status codes do not measure speed. With a congested peering link, every segment returns 200 but a 4-second segment takes 5 seconds to download, so viewers stall while request success stays at 99.99%.",
        },
        {
          kind: "number",
          prompt: "CloudFront real-time logs at 100% sampling, 150,000 requests per second, 1 KB per record. About how many Kinesis shards?",
          answer: 150,
          tolerance: 10,
          unit: "shards",
          explain: "About 150 shards (each takes 1,000 records and 1 MB per second).",
        },
        {
          kind: "multi",
          prompt: "Which levers reduce that shard count? Select all that apply.",
          options: [
            "Lower the sampling rate",
            "Log fewer fields",
            "Log only the cache behaviors you need",
            "Turn on CloudFront additional metrics",
          ],
          answers: [0, 1, 2],
          explain: "Lower the sampling rate, log fewer fields, and log only the cache behaviors you need. Additional metrics are a separate CloudWatch feature and do not change Kinesis volume.",
        },
        {
          kind: "quiz",
          prompt: "Why does Datadog's logs-to-metrics help with CDN log cost, and what limit matters for CDNs that deliver logs late?",
          options: [
            "It compresses logs; late logs are rejected at ingest",
            "Metrics come from the full ingest stream, including excluded logs, so you index only a sample; but only logs timestamped in the past 20 minutes count",
            "It samples logs at 1%; late logs are double-counted",
          ],
          answer: 1,
          explain: "Metrics come from the full ingest stream, including logs excluded from indexes, so you get exact counts while indexing only a sample. But only logs timestamped within the past 20 minutes count, so late batches are missed.",
        },
        {
          kind: "quiz",
          prompt: "Which availability measure should be the headline SLO?",
          options: ["By request", "By bytes", "By session"],
          answer: 2,
          explain: "By request weighs a failed manifest like a failed thumbnail, and retries distort it. By bytes catches partial transfers but barely notices small critical objects. By session measures whether the viewer could watch, so it is the headline; request and bytes SLIs are for diagnosis.",
        },
        {
          kind: "reveal",
          prompt: "A teammate wants to add `asn` and `title_id` tags to `delivery.requests`. What do you say, and what do you propose instead?",
          answer: "Both are high cardinality and multiply into a huge custom-metric bill. Propose a separate per-ISP metric with `asn_bucket` (top N per country plus `other`), title analysis in logs or the warehouse, and a low-cardinality `release_class` tag for premieres.",
        },
        {
          kind: "reveal",
          prompt: "How does a CMCD session ID let you join player QoE data to CDN logs? Name one cache-related risk of sending CMCD and how to avoid it.",
          answer: "The player sends the same ID in CMCD `sid` and in QoE events, and CDN logs record it (for example `cmcd-session-id`), so you can pull every segment request for one bad session. Risk: CMCD as a query argument makes every URL unique and destroys the hit ratio unless stripped from the cache key. Headers avoid this but can trigger CORS preflight.",
        },
        {
          kind: "number",
          prompt: "For a 99.9% 30-day SLO, what error rate sustained over one hour triggers the workbook's fast-burn page?",
          answer: 1.44,
          tolerance: 0.05,
          unit: "%",
          explain: "14.4 x 0.1% = a 1.44% error rate over one hour (2% of the monthly budget).",
        },
        {
          kind: "quiz",
          prompt: "Why is there also a 5-minute short window on that page?",
          options: [
            "It confirms the problem is still happening, so the alert resets about five minutes after recovery",
            "It makes the alert fire within 5 minutes of any error",
            "Datadog requires it for all monitors",
          ],
          answer: 0,
          explain: "The 5-minute window confirms the problem is still happening, so the alert resets about five minutes after recovery.",
        },
        {
          kind: "quiz",
          prompt: "In the Brazil scenario, which evidence pointed to the network path?",
          options: [
            "Unchanged hit ratio and TTFB",
            "Throughput falling from ~11 to ~3 Mbps with more retransmits, plus CMCD buffer starvation",
            "Segment success at 99.97%",
            "All titles being affected",
          ],
          answer: 1,
          explain: "Unchanged hit ratio and TTFB ruled out cache and shield. Throughput falling from ~11 to ~3 Mbps with more retransmits, plus CMCD buffer starvation, pointed to the network path.",
        },
        {
          kind: "match",
          prompt: "Match each signal to its job.",
          pairs: [
            ["Symptom signals (starts, stalls, play volume)", "Page via SLO burn-rate alerts"],
            ["Cause signals (hit ratio, origin latency)", "Dashboards and investigation"],
            ["Session SLO", "The headline promise"],
            ["Request and bytes SLIs per CDN and region", "Diagnosis"],
          ],
          explain: "Page on symptoms with long and short windows. Use cause signals to investigate. The session SLO is the headline; request and bytes SLIs per CDN and region diagnose.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "Each hop sees part of the truth: players see experience, CDNs see requests, origins see only misses. Join them fast.",
            "At ~500k segment requests/s and ~540 billion a month (assumed), generate metrics from 100% of logs, index a sample, keep raw logs in object storage. Normalize Fastly, CloudFront and Akamai into one schema.",
            "Page on symptoms with long- and short-window burn-rate alerts; cause signals are for dashboards. Session SLO is the headline, request and bytes SLIs diagnose.",
            "Cardinality is the main Datadog cost risk: no session IDs, paths or devices as tags; bucket ASNs; use Metrics without Limits carefully.",
            "CMCD puts a shared session ID and player state inside CDN log lines. Keep it out of cache keys.",
            "A delivery incident can have zero HTTP errors. Throughput and QoE are first-class signals.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Google SRE Workbook, \"Alerting on SLOs.\" https://sre.google/workbook/alerting-on-slos/",
    "Datadog Docs, \"Burn Rate Alerts.\" https://docs.datadoghq.com/service_management/service_level_objectives/burn_rate/",
    "Datadog Docs, \"Service Level Objectives.\" https://docs.datadoghq.com/service_management/service_level_objectives/",
    "Amazon CloudFront Developer Guide, \"Use real-time access logs.\" https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/real-time-logs.html",
    "Amazon CloudFront Developer Guide, \"Configure standard logging (v2).\" https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html",
    "Fastly Documentation, \"Log streaming: Datadog.\" https://www.fastly.com/documentation/guides/integrations/logging-endpoints/log-management-and-observability/log-streaming-datadog/",
    "Fastly Documentation, \"Useful variables to log.\" https://www.fastly.com/documentation/guides/integrations/streaming-logs/useful-variables-to-log/",
    "Fastly VCL reference, \"fastly_info.state.\" https://docs.fastly.com/documentation/reference/vcl/variables/miscellaneous/fastly-info-state/",
    "Fastly VCL reference, \"time.to_first_byte.\" https://docs.fastly.com/documentation/reference/vcl/variables/client-response/time-to-first-byte/",
    "Fastly VCL reference, \"client.as.number.\" https://www.fastly.com/documentation/reference/vcl/variables/client-connection/client-as-number/",
    "Datadog Docs, \"Fastly integration.\" https://docs.datadoghq.com/integrations/fastly/",
    "Datadog Docs, \"Amazon CloudFront integration.\" https://docs.datadoghq.com/integrations/amazon_cloudfront/",
    "Akamai TechDocs, \"DataStream 2: Stream logs to Datadog.\" https://techdocs.akamai.com/datastream2/docs/stream-datadog",
    "Akamai TechDocs, \"Adaptive Media Delivery: Common Media Client Data.\" https://techdocs.akamai.com/adaptive-media-delivery/docs/common-media-client-data-amd",
    "Will Law, Akamai Blog, \"Get More from Your Player Analytics and CDN Logs with CMCD,\" April 2023. https://akamai.com/blog/cloud/get-your-player-analytics-with-cmcd",
    "CTA WAVE, \"Common Media Client Data (CTA-5004-A)\" resource page. https://cta-wave.github.io/Resources/common-media-client-data--cta-5004-a.html",
    "CTA, \"CTA-5004: Web Application Video Ecosystem - Common Media Client Data\" (specification PDF). https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf",
    "DASH-IF, \"dash.js: CMCD usage.\" https://dashif.org/dash.js/pages/usage/cmcd.html",
    "Datadog Docs, \"Custom Metrics.\" https://docs.datadoghq.com/metrics/custom_metrics/",
    "Datadog Docs, \"Metrics without Limits.\" https://docs.datadoghq.com/metrics/metrics-without-limits/",
    "Datadog Docs, \"Distributions.\" https://docs.datadoghq.com/metrics/distributions/",
    "Datadog Docs, \"Generate Metrics from Ingested Logs.\" https://docs.datadoghq.com/logs/log_configuration/logs_to_metrics/",
    "Datadog Docs, \"Flex Logs.\" https://docs.datadoghq.com/logs/log_configuration/flex_logs/",
    "Datadog, \"Pricing.\" https://www.datadoghq.com/pricing/",
    "Datadog Docs, \"Synthetic Testing and Monitoring.\" https://docs.datadoghq.com/synthetics/",
    "Datadog Docs, \"Trace Context Propagation.\" https://docs.datadoghq.com/tracing/trace_collection/trace_context_propagation/",
    "Datadog Docs, \"Conviva integration.\" https://docs.datadoghq.com/integrations/conviva/",
    "Datadog Blog, \"Monitor video streaming performance with Conviva and Datadog.\" https://www.datadoghq.com/blog/video-streaming-performance-monitoring-conviva/",
    "Business Wire, Conviva and Datadog partnership announcement, August 16, 2021. https://www.businesswire.com/news/home/20210816005579/en",
    "Datadog Docs, \"Mux integration.\" https://docs.datadoghq.com/integrations/mux/",
    "Mux Docs, \"Monitoring metrics.\" https://mux.com/docs/guides/monitoring-metrics",
    "Mux Docs, \"Playback success metric.\" https://www.mux.com/docs/guides/data-playback-success-metric",
    "S. Shunmuga Krishnan and Ramesh K. Sitaraman, \"Video Stream Quality Impacts Viewer Behavior: Inferring Causality Using Quasi-Experimental Designs,\" ACM IMC 2012. https://people.cs.umass.edu/~ramesh/Site/PUBLICATIONS_files/imc208-krishnan.pdf",
    "Catchpoint Docs, \"Streaming test.\" https://docs.catchpoint.com/docs/streaming-test",
    "ThousandEyes, \"CDN monitoring.\" https://www.thousandeyes.com/solutions/cdn-monitoring",
    "Netflix, \"Mantis\" project documentation. https://netflix.github.io/mantis",
    "Datadog Blog, \"Monitor Akamai DataStream 2 with Datadog.\" https://www.datadoghq.com/blog/monitor-akamai-datastream2/",
    "AWS re:Invent 2022, NET317 \"Improve video streaming observability with Amazon CloudFront and CMCD\" (slides). https://d1.awsstatic.com/events/Summits/reinvent2022/NET317_Improve-video-streaming-observability-with-Amazon-CloudFront-and-CMCD.pdf",
  ],
};
export default chapter;
