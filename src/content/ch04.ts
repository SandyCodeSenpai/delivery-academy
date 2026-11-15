import type { Chapter, FlowSpec, SequenceSpec } from "./types";

// Chapter 4 content. Source: chapters/04-http-tls-and-caching.md

/* ---------------- Shared visuals (repeated with different focus to build ideas up) ---------------- */

const CONTRACT: FlowSpec = {
  nodes: [
    { id: "client", label: "Client (player)", sub: "sees URLs, codes, headers", kind: "player", col: 0, row: 1 },
    { id: "cache", label: "Cache", sub: "CDN edge and shield", kind: "edge", col: 2, row: 1 },
    { id: "origin", label: "Origin", sub: "where the bytes live", kind: "origin", col: 4, row: 1 },
  ],
  edges: [
    { from: "client", to: "cache", label: "GET + headers" },
    { from: "cache", to: "origin", label: "on miss" },
  ],
};

const TRAP: FlowSpec = {
  nodes: [
    { id: "early", label: "Eager clients", sub: "16:59:58", kind: "viewer", col: 0, row: 0 },
    { id: "late", label: "Later viewers", sub: "17:00 onward, thousands", kind: "viewer", col: 0, row: 2 },
    { id: "edge", label: "Edge", sub: "caches the 404", kind: "edge", col: 2, row: 1, badge: "404" },
    { id: "oa", label: "Origin A", sub: "segment not there yet", kind: "origin", col: 4, row: 0, tone: "bad", badge: "404" },
    { id: "ob", label: "Origin B", sub: "segment already there", kind: "origin", col: 4, row: 2, tone: "good" },
  ],
  edges: [
    { from: "early", to: "edge", label: "GET seg 1" },
    { from: "edge", to: "oa", label: "miss" },
    { from: "late", to: "edge", label: "GET seg 1" },
    { from: "edge", to: "ob", label: "try other origin", dashed: true, tone: "good" },
  ],
  direction: "right",
};

const STALE: FlowSpec = {
  nodes: [
    { id: "fresh", label: "Age below TTL?", sub: "object stored at edge", kind: "cache", col: 0, row: 0 },
    { id: "serve", label: "Serve from cache", kind: "edge", col: 1, row: 0, tone: "good" },
    { id: "swr", label: "In swr window?", sub: "stale-while-revalidate", kind: "cache", col: 0, row: 1 },
    { id: "bg", label: "Serve stale", sub: "refresh in background", kind: "edge", col: 1, row: 1, tone: "good" },
    { id: "reval", label: "Revalidate", sub: "If-None-Match", kind: "shield", col: 0, row: 2 },
    { id: "r304", label: "304: reset age", sub: "keep the body", kind: "cache", col: 1, row: 2, tone: "good" },
    { id: "r200", label: "200: replace body", kind: "cache", col: 1, row: 3 },
    { id: "sie", label: "In sie window?", sub: "stale-if-error", kind: "cache", col: 0, row: 3 },
    { id: "keep", label: "Serve stale copy", kind: "edge", col: 1, row: 4, tone: "good" },
    { id: "err", label: "Pass error", sub: "client gets the 5xx", kind: "generic", col: 0, row: 4, tone: "bad" },
  ],
  edges: [
    { from: "fresh", to: "serve", label: "yes" },
    { from: "fresh", to: "swr", label: "no, stale" },
    { from: "swr", to: "bg", label: "yes" },
    { from: "swr", to: "reval", label: "no" },
    { from: "bg", to: "reval", dashed: true },
    { from: "reval", to: "r304", label: "304" },
    { from: "reval", to: "r200", label: "200 new body" },
    { from: "reval", to: "sie", label: "5xx or timeout", tone: "bad" },
    { from: "sie", to: "keep", label: "yes" },
    { from: "sie", to: "err", label: "no" },
  ],
  direction: "down",
};

const VALIDATE: SequenceSpec = {
  actors: [
    { id: "p", label: "Player", kind: "player" },
    { id: "e", label: "Edge cache", kind: "edge" },
    { id: "s", label: "Shield cache", kind: "shield" },
    { id: "o", label: "Origin bucket", kind: "storage" },
  ],
  messages: [
    { from: "p", to: "e", label: "GET master.m3u8", note: "Edge copy is stale" },
    { from: "e", to: "s", label: "GET, If-None-Match: etag-v7", note: "Shield copy is also stale" },
    { from: "s", to: "o", label: "GET, If-None-Match: etag-v7" },
    { from: "o", to: "s", label: "304 Not Modified", dashed: true, tone: "good" },
    { from: "s", to: "e", label: "304 Not Modified, Age 0", dashed: true, tone: "good" },
    { from: "e", to: "p", label: "200 OK from cache", dashed: true, tone: "good" },
  ],
};

const ETAGS: SequenceSpec = {
  actors: [
    { id: "sh", label: "Shield", kind: "shield" },
    { id: "s3", label: "S3 origin", kind: "storage" },
    { id: "gcs", label: "GCS origin", kind: "storage" },
  ],
  messages: [
    { from: "sh", to: "s3", label: "GET seg_00042.m4s" },
    { from: "s3", to: "sh", label: "200, ETag A", dashed: true },
    { from: "sh", to: "gcs", label: "GET, If-None-Match: A", note: "S3 fails, shield fails over" },
    { from: "gcs", to: "sh", label: "200 full body, ETag B", dashed: true, tone: "bad", note: "GCS does not know A" },
  ],
};

const KEY: FlowSpec = {
  nodes: [
    { id: "req", label: "GET seg_00042.m4s", sub: "token, CMCD, utm", kind: "player", col: 0, row: 0 },
    { id: "val", label: "Validate token", sub: "and expiry", kind: "edge", col: 1, row: 0 },
    { id: "deny", label: "403 with reason", sub: "not cached", kind: "firewall", col: 2, row: 0, tone: "bad" },
    { id: "log", label: "Log CMCD fields", sub: "and analytics", kind: "monitor", col: 1, row: 1 },
    { id: "strip", label: "Strip from key", sub: "token, CMCD, analytics", kind: "edge", col: 0, row: 1 },
    { id: "key", label: "Key: host + path", sub: "normalized", kind: "cache", col: 0, row: 2 },
    { id: "look", label: "Key in cache?", kind: "cache", col: 1, row: 2 },
    { id: "hit", label: "Serve cached", kind: "edge", col: 1, row: 3, tone: "good", badge: "HIT" },
    { id: "miss", label: "Fetch from shield", sub: "with clean URL", kind: "shield", col: 2, row: 2, badge: "MISS" },
  ],
  edges: [
    { from: "req", to: "val" },
    { from: "val", to: "deny", label: "invalid", tone: "bad" },
    { from: "val", to: "log", label: "valid" },
    { from: "log", to: "strip" },
    { from: "strip", to: "key" },
    { from: "key", to: "look" },
    { from: "look", to: "hit", label: "hit" },
    { from: "look", to: "miss", label: "miss" },
  ],
  direction: "down",
};

const TLS: SequenceSpec = {
  actors: [
    { id: "c", label: "Client player", kind: "player" },
    { id: "e", label: "CDN edge", kind: "edge" },
  ],
  messages: [
    { from: "c", to: "e", label: "ClientHello", note: "SNI, ALPN, key share, PSK if resuming" },
    { from: "e", to: "c", label: "ServerHello + key share", dashed: true },
    { from: "e", to: "c", label: "Certificate, Verify, Finished", dashed: true, note: "already encrypted" },
    { from: "c", to: "e", label: "Finished" },
    { from: "c", to: "e", label: "GET segment" },
    { from: "e", to: "c", label: "200 or 206, segment bytes", dashed: true, tone: "good" },
    { from: "e", to: "c", label: "NewSessionTicket", dashed: true, note: "for later resumption" },
  ],
};

const CORS: FlowSpec = {
  nodes: [
    { id: "fetch", label: "Cross-origin fetch", sub: "web player, segment", kind: "player", col: 0, row: 0 },
    { id: "safe", label: "Safelisted only?", sub: "request headers", kind: "device", col: 1, row: 0 },
    { id: "pre", label: "OPTIONS preflight", sub: "sent by the browser", kind: "device", col: 2, row: 0 },
    { id: "ok", label: "Edge approves?", sub: "methods and headers", kind: "edge", col: 2, row: 1 },
    { id: "get", label: "Send GET", kind: "edge", col: 1, row: 1 },
    { id: "acao", label: "ACAO matches?", sub: "Allow-Origin header", kind: "device", col: 1, row: 2 },
    { id: "append", label: "Append to buffer", sub: "player plays", kind: "player", col: 1, row: 3, tone: "good" },
    { id: "block", label: "Browser blocks", sub: "player error", kind: "firewall", col: 2, row: 2, tone: "bad" },
  ],
  edges: [
    { from: "fetch", to: "safe" },
    { from: "safe", to: "get", label: "yes" },
    { from: "safe", to: "pre", label: "custom header" },
    { from: "pre", to: "ok" },
    { from: "ok", to: "get", label: "yes" },
    { from: "ok", to: "block", label: "no", tone: "bad" },
    { from: "get", to: "acao" },
    { from: "acao", to: "append", label: "yes" },
    { from: "acao", to: "block", label: "no", tone: "bad" },
  ],
  direction: "down",
};

const SEGMENT_RESPONSE =
  "HTTP/2 200\ncontent-type: video/mp4\ncontent-length: 2621440\ncache-control: public, max-age=31536000, immutable\netag: \"sha256-3f1a9c\"\naccept-ranges: bytes\nage: 412\nx-cache: HIT\naccess-control-allow-origin: *";

const PLAYLIST_RESPONSE =
  "HTTP/2 200\ncontent-type: application/vnd.apple.mpegurl\ncontent-encoding: br\nvary: Accept-Encoding\ncache-control: public, max-age=60, stale-if-error=86400\ncdn-cache-control: max-age=86400\netag: \"m-v7-ep123-r4\"";

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 4,
  title: "HTTP, TLS and Caching Semantics",
  short: "HTTP & caching",
  part: 2,
  hook: "The few headers that decide whether a segment comes from cache or costs you a trip to origin.",
  lessons: [
    /* ================= Lesson 1 ================= */
    {
      id: "ch04-l1",
      title: "Headers are the contract",
      goal: "Explain why HTTP headers are the real delivery API, size the request rate, and compare HTTP/1.1, HTTP/2 and HTTP/3 for video.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "A player asks a CDN edge for a video segment. What does the edge actually know about this request?",
          options: [
            "The episode, the user and their subscription plan",
            "Only the URL, the request headers and its own cache rules",
            "The viewer's QoE and which PoP is closest to them",
          ],
          answer: 1,
          explain: "The CDN does not know what an episode is. It only sees a cache key, a freshness lifetime and a validator. The player does not know about PoPs or shields either. It only sees URLs, status codes and headers.",
        },
        {
          kind: "read",
          title: "Three parties, one contract",
          body: "Every byte of video travels inside an HTTP response, over a TLS connection, through one or more caches.\n\nThree parties take part: the **[[origin]]** (where the bytes live), the **cache** (CDN [[edge]] and [[shield]]) and the **client** (the player). None of them sees the others' internals. So **HTTP headers are the real contract** between them. This chapter teaches that contract at the protocol layer. How a CDN implements caching inside (eviction, collapsing, purge) comes in Chapter 5.",
          visual: { kind: "flow", spec: { ...CONTRACT, flow: ["client>cache", "cache>origin"] }, caption: "Each party sees only URLs, status codes and headers." },
        },
        {
          kind: "read",
          title: "Semantics versus wire format",
          body: "Since 2022 the IETF splits HTTP into layers. **RFC 9110** defines **HTTP semantics**: methods, status codes, headers, range and conditional requests. **RFC 9111** defines **HTTP caching**: when a cache may store, reuse and validate a response. Each wire version has its own document.\n\nSo `Cache-Control: max-age=600` means the same thing over every version. In design reviews keep two questions apart: \"which version\" is about performance; \"which headers\" is about correctness and cost.",
          visual: {
            kind: "table",
            headers: ["Document", "Defines"],
            rows: [
              ["RFC 9110", "HTTP semantics"],
              ["RFC 9111", "HTTP caching"],
              ["RFC 9112", "HTTP/1.1 wire format"],
              ["RFC 9113", "HTTP/2 wire format"],
              ["RFC 9114", "HTTP/3 wire format"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "The team moves players from HTTP/2 to HTTP/3. What changes for a response with `Cache-Control: max-age=600`?",
          options: [
            "Nothing in its meaning: caching rules are the same on every version",
            "HTTP/3 doubles the lifetime because QUIC is faster",
            "HTTP/3 ignores `max-age` and uses its own TTL",
          ],
          answer: 0,
          explain: "Semantics (RFC 9110) and caching (RFC 9111) are separate from the wire version. Moving to HTTP/3 changes latency and loss behaviour, not the caching contract.",
        },
        {
          kind: "read",
          title: "The request rate you design for",
          body: "Use the book's assumed model: a [[simulcast]] spike of about 2M concurrent streams, with segments of about 5 seconds.\n\n- Video: 2,000,000 / 5 = 400,000 segment requests per second.\n- Separate audio segments (common with CMAF and multiple dubs) add another 400,000.\n- With playlists, subtitles, init segments and retries, plan for about 1M requests per second at the edge (assumed).",
          visual: {
            kind: "stats",
            items: [
              { value: "400k/s", label: "Video segment requests", note: "2M / 5 s" },
              { value: "+400k/s", label: "Separate audio segments" },
              { value: "~1M/s", label: "Plan at the edge", note: "assumed" },
              { value: "~2.5 MB", label: "One 5 s segment at 4 Mbps" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "2M viewers watch with 5-second video segments. How many video segment requests per second reach the edge?",
          answer: 400000,
          tolerance: 20000,
          unit: "req/s",
          hint: "Each viewer asks for one segment every 5 seconds.",
          explain: "2,000,000 / 5 = 400,000 requests per second. Separate audio doubles it to 800,000, and playlists, subtitles, init segments and retries take it to about 1M (assumed).",
        },
        {
          kind: "number",
          prompt: "How big is one 5-second segment at 4 Mbps, in megabytes?",
          answer: 2.5,
          tolerance: 0.1,
          unit: "MB",
          hint: "Megabits = rate x seconds. Divide by 8 for megabytes.",
          explain: "4 Mbps x 5 s = 20 megabits. 20 / 8 = about 2.5 MB.",
        },
        {
          kind: "read",
          title: "One wrong header",
          body: "If the [[cache key]], freshness and validators are right, a simulcast episode reaches near 100% edge hit ratio after warm-up. The origin sees a trickle.\n\nIf one header is wrong, for example a per-user query parameter in the cache key, the hit ratio falls to zero. The origin is asked for 1M requests per second and about 8 Tbps. No origin survives that. Many \"config\" outages are really header-semantics outages.",
          callout: {
            type: "staff",
            text: "For every object type (master playlist, media playlist, init segment, media segment, subtitle, thumbnail, license, playback API) ask: what is the cache key, what is the TTL, what is the validator? If the team cannot answer each in one line, the design is not finished.",
          },
        },
        {
          kind: "read",
          title: "HTTP/1.1: one request at a time",
          body: "**HTTP/1.1** sends text messages over **persistent** TCP connections. But each connection carries one request at a time. A second request waits until the first response ends. This is **application-level head-of-line (HOL) blocking**.\n\nBrowsers work around it with several connections per host (historically about six). For large, sequential segment fetches this was mostly fine. The pain was the many small requests around playback, each new connection paying TCP and TLS handshakes.",
        },
        {
          kind: "read",
          title: "HTTP/2: many streams, one connection",
          body: "**[[HTTP/2]]** (RFC 7540 in 2015, now RFC 9113) keeps the semantics but changes the wire:\n\n- **Binary framing** into numbered **streams**, and **multiplexing** of many streams on one TCP connection.\n- **HPACK** header compression, which shrinks repeated cookies and long token URLs.\n- **Server push**, which saw little successful use. In 2020 Apple replaced its planned use of push in Low-Latency HLS with a preload hint tag.",
        },
        {
          kind: "quiz",
          prompt: "Over HTTP/2 on a lossy mobile link, one TCP packet of the video segment is lost. What happens to the audio segment on the same connection?",
          options: [
            "Nothing, because the audio is on a different stream",
            "It stalls too, because TCP delivers bytes strictly in order",
            "It is switched to a new connection automatically",
          ],
          answer: 1,
          explain: "TCP delivers bytes strictly in order, so one lost packet stalls every stream on the connection. This is **transport-level HOL blocking**. Under heavy loss, HTTP/2 can be worse than several HTTP/1.1 connections.",
        },
        {
          kind: "read",
          title: "HTTP/3: independent streams over QUIC",
          body: "**[[HTTP/3]]** (RFC 9114, 2022) runs over **[[QUIC]]** (RFC 9000, 2021). What matters for video:\n\n- Streams are independent. A lost packet only stalls its own stream.\n- [[TLS 1.3]] is built in: one round trip for a new connection, and 0-RTT for a resumed one.\n- **Connection migration**: a connection is identified by a connection ID, so it survives a network change.\n- It uses UDP, which some networks block, so clients must fall back to HTTP/2.",
        },
        {
          kind: "quiz",
          prompt: "A viewer walks out of the house mid-episode and the phone moves from Wi-Fi to cellular. Which version can keep the same connection?",
          options: ["HTTP/1.1", "HTTP/2", "HTTP/3"],
          answer: 2,
          explain: "HTTP/3 (QUIC) identifies a connection by a connection ID, not by IP and port, so it can migrate. HTTP/1.1 and HTTP/2 run on TCP and need a new connection.",
        },
        {
          kind: "read",
          title: "How a client finds HTTP/3",
          body: "Clients usually discover HTTP/3 through the **Alt-Svc** header. The line below says \"this service also speaks HTTP/3 on UDP 443; remember it for 86,400 seconds\".\n\nA DNS **HTTPS record** can advertise `h3` before the first connection (Chapter 3). **ALPN** (Application-Layer Protocol Negotiation) is the TLS extension that picks `h2` or `http/1.1` inside the handshake, without an extra round trip.",
          visual: { kind: "code", lang: "http", code: "alt-svc: h3=\":443\"; ma=86400" },
        },
        {
          kind: "match",
          prompt: "Match each item to what it does.",
          pairs: [
            ["HTTP/1.1", "One request at a time per connection"],
            ["HTTP/2", "Many streams; one lost packet stalls all"],
            ["HTTP/3", "A lost packet stalls only its own stream"],
            ["ALPN", "Picks h2 or http/1.1 inside the TLS handshake"],
            ["Alt-Svc", "Advertises h3 on UDP 443"],
          ],
          explain: "HTTP/1.1 has application-level HOL blocking, HTTP/2 has transport-level HOL blocking, HTTP/3 has neither across streams. ALPN negotiates the version in TLS; Alt-Svc (or a DNS HTTPS record) advertises HTTP/3.",
        },
        {
          kind: "read",
          title: "What the evidence says",
          body: "Google's SIGCOMM 2017 QUIC paper reported that QUIC cut YouTube **rebuffer rates by 18.0% on desktop and 15.3% on mobile**, and Search latency by 8.0% and 3.6%.\n\nAkamai reported that during a European football match streamed to Latin America on 19 April 2023 (peak 4.16 Tbps), 86.2% of HTTP/3 connections exceeded 1 Mbps, versus 73.5% for HTTP/2. Akamai made HTTP/3 available to all delivery customers at no extra cost.",
          visual: {
            kind: "stats",
            items: [
              { value: "-18.0%", label: "YouTube rebuffers, desktop", note: "Google, 2017" },
              { value: "-15.3%", label: "YouTube rebuffers, mobile", note: "Google, 2017" },
              { value: "86.2%", label: "HTTP/3 connections over 1 Mbps", note: "Akamai, Apr 2023" },
              { value: "73.5%", label: "HTTP/2 connections over 1 Mbps", note: "same match" },
            ],
          },
        },
        {
          kind: "read",
          title: "Not every study agrees",
          body: "A 2023 NeurIPS datasets paper found HTTP/3 was not always the QoE winner, partly because browsers fall back to HTTP/2 on poor networks. QUIC also costs more server CPU per byte: it runs in user space, without the kernel and NIC offloads TCP has.\n\nCloudflare's 2025 Radar Year in Review reported about 21% of web requests on HTTP/3, 50% on HTTP/2 and 29% on HTTP/1.x. Many smart TV players still use HTTP/1.1 or HTTP/2 libraries.",
          callout: {
            type: "mistake",
            text: "Turning on HTTP/3 and declaring victory from server logs. Logs show which protocol was used, not whether rebuffering improved. Measure startup time and rebuffer ratio per protocol, device family and ASN, and keep a per-CDN switch to turn it off.",
          },
        },
        {
          kind: "read",
          title: "The three versions side by side",
          body: "Each version has a main risk. HTTP/1.1 needs many connections. HTTP/2 lets one loss stall all streams. HTTP/3 can be blocked on UDP and uses more CPU.",
          visual: {
            kind: "table",
            headers: ["Property", "HTTP/1.1", "HTTP/2", "HTTP/3"],
            rows: [
              ["Transport", "TCP", "TCP", "QUIC over UDP"],
              ["Parallel requests per connection", "1", "Many", "Many"],
              ["HOL blocking", "Application and transport", "Transport", "Per stream only"],
              ["New connection with TLS 1.3", "2 RTT", "2 RTT", "1 RTT"],
              ["Network change", "New connection", "New connection", "Migration"],
              ["Main risk", "Many connections", "Loss stalls all streams", "UDP blocked, more CPU"],
            ],
          },
          callout: {
            type: "crunchyroll",
            text: "A `curl -I` on 14 November 2026 (by the author, not a published architecture statement) showed www.crunchyroll.com answered by Cloudflare and static.crunchyroll.com answered by CloudFront, both over HTTP/2 and both sending `alt-svc: h3=\":443\"; ma=86400`. Which protocols the video segment hosts use per device is not published. A platform like this would likely enable HTTP/3 on every CDN that supports it, then compare QoE by protocol and device in RUM data (Chapter 11).",
          },
        },
        {
          kind: "multi",
          prompt: "You enabled HTTP/3 on one CDN. Which evidence would show it really helped viewers? Select all that apply.",
          options: [
            "Server logs show 40% of requests now use h3",
            "Startup time per protocol and device family",
            "Rebuffer ratio per protocol and ASN",
            "Edge CPU per byte went up",
          ],
          answers: [1, 2],
          explain: "Logs only show which protocol was used. The viewer outcome is startup time and rebuffer ratio, split by protocol, device family and ASN. Higher CPU per byte is a known cost of QUIC, not a benefit.",
        },
        {
          kind: "summary",
          points: [
            "HTTP headers are the contract between origin, cache and client.",
            "RFC 9110 (semantics) and RFC 9111 (caching) are separate from the wire version.",
            "Assumed simulcast: 400k video + 400k audio req/s, about 1M req/s at the edge, 2.5 MB per segment.",
            "HTTP/2 multiplexes but suffers TCP HOL blocking; HTTP/3 removes it and adds 1-RTT setup and migration.",
            "HTTP/3 gains are real but must be measured per device, with UDP fallback and a per-CDN off switch.",
          ],
        },
      ],
    },

    /* ================= Lesson 2 ================= */
    {
      id: "ch04-l2",
      title: "Status codes and the 404 trap",
      goal: "Read the status codes a player cares about, and stop a cached \"not yet\" 404 from taking down a premiere.",
      minutes: 8,
      steps: [
        {
          kind: "quiz",
          prompt: "An episode goes live at 17:00 UTC. At 16:59:58 a few eager clients request segment 1 before the file reaches one origin. That origin returns 404. What might thousands of viewers see at 17:00:30?",
          options: [
            "Segment 1, because the file exists by now",
            "A cached 404 for a file that now exists",
            "A 503 while the origin catches up",
          ],
          answer: 1,
          explain: "CDNs cache errors, and 404 is cacheable. The edge stored the early 404 and keeps serving it to everyone, even though the file now exists. This lesson shows why and how to stop it.",
        },
        {
          kind: "read",
          title: "Methods players use",
          body: "Players mostly use **GET** for manifests, segments and subtitles. GET is **safe** (no state change) and **idempotent** (repeating it has the same effect), so clients and CDNs may retry it automatically.\n\nBrowsers also send **OPTIONS** as [[CORS]] preflights; your CDN must answer them cheaply. DRM license and playback API calls are usually **POST**: not cached, and not blindly replayed (Chapter 8).",
        },
        {
          kind: "quiz",
          prompt: "Why may a CDN retry a failed segment GET automatically, but not a DRM license POST?",
          options: [
            "GET is safe and idempotent; a POST may change state",
            "POST bodies are too large to resend",
            "Licenses are always served from cache",
          ],
          answer: 0,
          explain: "Repeating a GET has the same effect as sending it once, so a retry is harmless. A license or playback POST may count streams or change state, so it is not blindly replayed.",
        },
        {
          kind: "read",
          title: "Status codes: success and client errors",
          body: "These are the codes a delivery engineer reads every day. Note how one code, 403, hides many different causes.",
          visual: {
            kind: "table",
            headers: ["Code", "Meaning", "Why delivery cares"],
            rows: [
              ["200", "Full response", "Whole-file segments and manifests"],
              ["206", "Partial Content", "Byte-range segments, seeking, resumed downloads"],
              ["304", "Not Modified", "Cheap revalidation between tiers"],
              ["403", "Forbidden", "Expired token, geo block, WAF: many causes, one code"],
              ["404", "Not Found", "Wrong URL, not yet published, replication lag. Dangerous if cached."],
              ["410", "Gone", "Removed on purpose; RFC 8216 mentions 404 or 410 for removed presentations"],
            ],
          },
        },
        {
          kind: "read",
          title: "Status codes: limits and upstream errors",
          body: "The 5xx codes say the problem is behind the CDN. A 504 is common in a [[thundering herd]].",
          visual: {
            kind: "table",
            headers: ["Code", "Meaning", "Why delivery cares"],
            rows: [
              ["416", "Range Not Satisfiable", "Player bug, or file replaced by a shorter one"],
              ["429", "Too Many Requests", "Rate limits or bot rules hitting real viewers"],
              ["502", "Bad Gateway", "CDN got a bad answer from origin: TLS mismatch, reset"],
              ["503", "Unavailable", "Origin shedding load or down"],
              ["504", "Gateway Timeout", "Origin or shield too slow, common in a thundering herd"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each status code to its most likely delivery cause.",
          pairs: [
            ["504", "Shield or origin too slow during a herd"],
            ["416", "Range outside the file"],
            ["429", "Rate limit or bot rule hitting viewers"],
            ["502", "Bad answer from origin, e.g. TLS mismatch"],
            ["410", "Removed on purpose"],
          ],
          explain: "504 is a timeout upstream, 416 a range past the end (player bug or a shorter replacement file), 429 a rate limit, 502 a bad upstream answer such as a TLS mismatch or reset, and 410 a deliberate removal.",
        },
        {
          kind: "read",
          title: "Codes are part of failover design",
          body: "Two notes.\n\nFirst, a bare 403 tells on-call almost nothing. Add a reason in a response header or log field: \"token expired\", \"geo denied\", \"WAF rule\".\n\nSecond, players treat codes differently. A 5xx usually triggers a retry or a CDN switch (Chapter 10). A 403 or 404 on a segment may end the session. So correct codes are part of failover design.",
        },
        {
          kind: "quiz",
          prompt: "A player gets one of these on a segment. Which one most likely triggers a retry or CDN switch instead of ending the session?",
          options: ["403", "404", "503", "410"],
          answer: 2,
          explain: "A 5xx says \"the server side failed, try again or elsewhere\". A 403 or 404 on a segment may end the session, and a 410 means the content was removed on purpose.",
        },
        {
          kind: "read",
          title: "Negative caching",
          body: "RFC 9110 lists the **heuristically cacheable** status codes. A cache may store these even without explicit freshness headers: 200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414 and 501.\n\nCDNs also cache errors on purpose. This is **[[negative caching]]**. CloudFront caches 4xx and 5xx responses for a short error-caching time, 10 seconds by default, unless configured otherwise. That is fine for junk URLs.",
          visual: { kind: "flow", spec: { ...TRAP, focus: ["early", "edge", "oa", "early>edge", "edge>oa"], flow: ["early>edge", "edge>oa"] }, caption: "The early request misses, and the origin answers 404." },
        },
        {
          kind: "read",
          title: "The premiere 404 trap",
          body: "At a premiere it is dangerous. The episode goes live at 17:00 UTC. A few eager clients request segment 1 at 16:59:58, before the file reaches one origin. The origin returns 404 and the edge caches it.\n\nNow thousands of viewers get a cached 404 for a file that now exists. A segment 404 often ends the session, so this is an outage.",
          visual: { kind: "flow", spec: { ...TRAP, focus: ["late", "edge", "late>edge"], flow: ["late>edge"] }, caption: "Later viewers hit the cached 404, not the origin." },
        },
        {
          kind: "order",
          prompt: "Put the fixes for the premiere 404 trap in order, best first.",
          items: [
            "Do not publish URLs before content is in every origin (staged publish)",
            "Give segment 404s a short life (`max-age=1` or `no-store`) and a small error-caching time",
            "On a 404 from one origin, try the other origin before answering",
          ],
          explain: "Best is to never expose the URL early (staged publish, Chapter 13). Next, make segment 404s live for about a second with a matching small error-caching time on segment paths. Last, retry the other origin on 404 (Chapter 6).",
        },
        {
          kind: "multi",
          prompt: "Which of these status codes may a cache store heuristically, with no freshness headers, under RFC 9110? Select all that apply.",
          options: ["404", "206", "503", "410", "302"],
          answers: [0, 1, 3],
          explain: "The RFC 9110 list is 200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414 and 501. 503 and 302 are not on it. Note that 404 is: a \"not found\" can be cached even if the origin says nothing about freshness.",
        },
        {
          kind: "read",
          title: "A 404 often means \"not yet\"",
          body: "The third fix in action: when one origin says 404, the shield or edge asks the other origin before answering. If the file is there, viewers get the segment, and no error is cached.",
          visual: { kind: "flow", spec: { ...TRAP, focus: ["edge", "ob", "edge>ob"], flow: ["edge>ob"] }, caption: "Try the other origin before answering 404." },
          callout: {
            type: "mistake",
            text: "Leaving negative caching at vendor defaults on segment paths. Defaults are tuned for websites, where a 404 stays a 404. In VOD publishing a 404 often means \"not yet\", not \"never\".",
          },
        },
        {
          kind: "summary",
          points: [
            "GET is safe and idempotent, so it can be retried; license and playback POSTs are not cached or replayed.",
            "Add a reason to every 403 so on-call can tell token, geo and WAF apart.",
            "5xx usually means retry or switch CDN; 403 or 404 on a segment may end the session.",
            "404 is heuristically cacheable, and CloudFront caches errors for 10 s by default.",
            "Stop the premiere 404 trap: staged publish, short-lived segment 404s, try the other origin.",
          ],
        },
      ],
    },

    /* ================= Lesson 3 ================= */
    {
      id: "ch04-l3",
      title: "Freshness and stale serving",
      goal: "Work out how long each cache may reuse a response, and use stale-while-revalidate and stale-if-error as outage insurance.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "A shield stored a playlist 300 seconds ago. It sends it to the edge with `Cache-Control: max-age=600` and `Age: 300`. How long may the edge treat it as fresh?",
          options: ["600 seconds", "300 seconds", "900 seconds"],
          answer: 1,
          explain: "The `Age` header carries how old the response already is. 600 - 300 = 300 seconds remain. TTLs do not add up across tiers when caches honour `Age`.",
        },
        {
          kind: "read",
          title: "Fresh, stale, revalidate",
          body: "RFC 9111 gives every stored response a **freshness lifetime**. While its **age** is below the lifetime, it is **fresh** and may be served without asking anyone.\n\nAfter that it is **stale**. A stale response normally must be **revalidated** (checked with the upstream) before it is reused.",
          visual: { kind: "flow", spec: { ...STALE, focus: ["fresh", "serve", "fresh>serve"], flow: ["fresh>serve"] }, caption: "Fresh: serve straight from cache." },
        },
        {
          kind: "read",
          title: "The Age header",
          body: "The **Age** header says how old a response already is. If the shield held an object for 300 seconds and sends `Age: 300` with `max-age=600`, the edge knows only 300 seconds remain.\n\nSo TTLs do not add up across tiers when caches honour `Age`. Without an explicit lifetime, a cache may use a **heuristic**. RFC 9111 suggests 10% of the time since `Last-Modified`.",
        },
        {
          kind: "number",
          prompt: "A response has no `max-age` and no `Expires`. Its `Last-Modified` is 10 days ago. With RFC 9111's suggested heuristic, how many days may a cache treat it as fresh?",
          answer: 1,
          tolerance: 0.1,
          unit: "days",
          hint: "10% of the time since Last-Modified.",
          explain: "10% of 10 days = 1 day. That is a guess the cache makes for you, which is why you should always send an explicit lifetime.",
        },
        {
          kind: "read",
          title: "Defaults differ by 720 times",
          body: "Vendors pick their own defaults. Fastly caches a 200 with no freshness headers for **2 minutes**. CloudFront's default TTL without a cache policy is **24 hours**.\n\nThat is a factor of 720 between two CDNs for the same response. In a [[multi-CDN]] setup (Chapter 9), never rely on defaults. Send explicit freshness headers.",
          visual: {
            kind: "stats",
            items: [
              { value: "2 min", label: "Fastly default, no headers" },
              { value: "24 h", label: "CloudFront default TTL" },
              { value: "720x", label: "Difference for the same response" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "Fastly's default is 2 minutes and CloudFront's is 24 hours. By what factor do they differ?",
          answer: 720,
          tolerance: 1,
          unit: "x",
          hint: "Convert 24 hours to minutes first.",
          explain: "24 hours = 1,440 minutes. 1,440 / 2 = 720. The same response can live 720 times longer on one CDN than on the other.",
        },
        {
          kind: "read",
          title: "Cache-Control directives, part 1",
          body: "**[[Cache-Control]]** is the main freshness header. These five directives set who may store a response and for how long.",
          visual: {
            kind: "table",
            headers: ["Directive", "Meaning"],
            rows: [
              ["max-age=N", "Fresh for N seconds, all caches"],
              ["s-maxage=N", "Shared caches only; overrides max-age and Expires; must revalidate once stale"],
              ["public", "Shared caches may store it even if normally not allowed"],
              ["private", "Shared caches must not store it"],
              ["no-cache", "May store, but must revalidate before every reuse"],
            ],
          },
        },
        {
          kind: "read",
          title: "Cache-Control directives, part 2",
          body: "The old **Expires** header gives an absolute date. If `max-age` is present, caches ignore it. `immutable` comes from RFC 8246; the two stale directives come from RFC 5861.",
          visual: {
            kind: "table",
            headers: ["Directive", "Meaning"],
            rows: [
              ["no-store", "Must not store at all"],
              ["must-revalidate", "Never serve stale; if origin unreachable, return an error such as 504"],
              ["immutable", "Body will not change while fresh; browsers skip revalidation"],
              ["stale-while-revalidate=N", "Serve stale up to N seconds while refreshing in background"],
              ["stale-if-error=N", "Serve stale up to N seconds if upstream fails"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "What does `Cache-Control: no-cache` mean?",
          options: [
            "Do not store this response anywhere",
            "Store it, but revalidate before every reuse",
            "Only browsers may store it, not CDNs",
          ],
          answer: 1,
          explain: "`no-cache` does not mean \"do not cache\". It allows storing but requires revalidation before each reuse. \"Do not store\" is `no-store`.",
        },
        {
          kind: "read",
          title: "Three common misunderstandings",
          body: "- **`no-cache` does not mean \"do not cache\".** That is `no-store`.\n- **`private`** on a segment silently kills CDN caching. A framework often adds it because a session cookie exists.\n- **`must-revalidate`** blocks stale serving during an origin outage. That is usually the opposite of what video wants.",
          visual: {
            kind: "compare",
            left: { title: "no-cache", points: ["May be stored", "Must revalidate before every reuse", "A 304 keeps it cheap"] },
            right: { title: "no-store", points: ["Must not be stored at all", "Every request goes upstream", "Right for licenses and personal API answers"] },
          },
        },
        {
          kind: "multi",
          prompt: "Which of these quietly hurt delivery when an origin puts them on a media segment? Select all that apply.",
          options: ["private", "must-revalidate", "immutable", "no-store", "max-age=31536000"],
          answers: [0, 1, 3],
          explain: "`private` stops shared caches storing it, `no-store` stops everyone storing it, and `must-revalidate` blocks stale serving when the origin is down. `immutable` and a year-long `max-age` are exactly what immutable segments want.",
        },
        {
          kind: "read",
          title: "stale-while-revalidate",
          body: "RFC 5861 (2010, Informational) defined two extensions, together called **[[stale-while-revalidate]]** and stale-if-error.\n\n**`stale-while-revalidate`** lets a cache serve a stale response for N seconds while it refreshes in the background, so no client waits. RFC 5861's example `max-age=600, stale-while-revalidate=30` is fresh for 600 seconds, then can be served stale for 30 more. The refresh only starts when a request arrives in the window, so sparse traffic may still wait.",
          visual: { kind: "flow", spec: { ...STALE, focus: ["fresh", "swr", "bg", "reval", "fresh>swr", "swr>bg", "bg>reval"], flow: ["fresh>swr", "swr>bg", "bg>reval"] }, caption: "Stale but inside the window: answer now, refresh behind." },
        },
        {
          kind: "read",
          title: "Revalidation: 304 or 200",
          body: "Outside the window, the cache revalidates with `If-None-Match`. Three answers are possible:\n\n- **304**: unchanged. Reset the age and keep the body.\n- **200** with a new body: replace the object.\n- **5xx or a timeout**: the upstream failed. What happens next depends on stale-if-error.",
          visual: { kind: "flow", spec: { ...STALE, focus: ["swr", "reval", "r304", "r200", "sie", "swr>reval", "reval>r304", "reval>r200", "reval>sie"], flow: ["swr>reval", "reval>r304"] } },
        },
        {
          kind: "read",
          title: "stale-if-error",
          body: "**`stale-if-error`** lets a cache serve stale if revalidation returns 500, 502, 503 or 504.\n\nRFC 5861's example: `max-age=600, stale-if-error=1200`. At 900 seconds the origin returns 500, so the cache serves the stored 200 with `Age: 900`. Past 1,800 seconds the error passes through to the client.",
          visual: { kind: "flow", spec: { ...STALE, focus: ["reval", "sie", "keep", "err", "reval>sie", "sie>keep", "sie>err"], flow: ["reval>sie", "sie>keep"] }, caption: "Upstream failed: serve the old copy while the window lasts." },
        },
        {
          kind: "number",
          prompt: "`Cache-Control: max-age=600, stale-if-error=1200`. The origin is down. After what age, in seconds, do clients start getting the error?",
          answer: 1800,
          tolerance: 1,
          unit: "s",
          hint: "The stale window starts when freshness ends.",
          explain: "Fresh for 600 s, then stale-if-error covers 1,200 s more: 600 + 1,200 = 1,800 s. At 900 s the cache still serves the stored 200 with `Age: 900`.",
        },
        {
          kind: "read",
          title: "Vendors differ here too",
          body: "Fastly reads both stale directives from `Surrogate-Control` first, then `Cache-Control`, defaulting to 0.\n\nCloudFront supports both, but caps the stale window at the behaviour's **maximum TTL**. A one-day maximum TTL with `stale-if-error=604800` gives one day of protection, not seven.",
        },
        {
          kind: "number",
          prompt: "A CloudFront behaviour has a maximum TTL of 1 day. The origin sends `stale-if-error=604800`. How many days of outage protection do you really get?",
          answer: 1,
          tolerance: 0.1,
          unit: "days",
          hint: "CloudFront caps the stale window at the maximum TTL.",
          explain: "604,800 seconds is 7 days, but CloudFront caps it at the behaviour's maximum TTL of 1 day. You get one day, not seven.",
        },
        {
          kind: "read",
          title: "Cheap outage insurance",
          body: "Stale serving turns caches into insurance. It costs nothing until the origin fails, and then it keeps viewers playing.",
          callout: {
            type: "staff",
            text: "`stale-if-error` is cheap insurance for objects that rarely change: VOD manifests, subtitles, init segments, images. Ask \"if both origins were down for 30 minutes, what could we still serve, and for how long?\" The answer lives mostly in these headers and the CDN's maximum TTL.",
          },
        },
        {
          kind: "widget",
          widget: "cache-headers",
          title: "Cache-Control lab",
          task: "Replay the live playlist preset. Find a STALE answer and a 304 revalidation on the timeline. The origin goes down at 40 s: does stale-if-error keep viewers playing? Then set stale-if-error to 0 and replay to see what viewers get instead.",
          props: { preset: "live-playlist" },
        },
        {
          kind: "summary",
          points: [
            "Fresh while age is below the lifetime; stale after, and normally revalidated before reuse.",
            "`Age` makes TTLs not add up across tiers; with no lifetime, caches guess (10% of time since Last-Modified).",
            "Defaults differ 720x (Fastly 2 min, CloudFront 24 h): never rely on them.",
            "`no-cache` is not `no-store`; `private` and `must-revalidate` quietly hurt segments.",
            "stale-while-revalidate hides refresh latency; stale-if-error serves through outages, capped by CloudFront's max TTL.",
          ],
        },
      ],
    },

    /* ================= Lesson 4 ================= */
    {
      id: "ch04-l4",
      title: "A separate lifetime for the CDN",
      goal: "Give the CDN its own lifetime, avoid CloudFront's TTL clamping traps, and write a header policy for VOD objects.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "A VOD master playlist will be purged at the CDN whenever it changes. How long should a phone keep it, compared with the CDN?",
          options: [
            "The same as the CDN, for example a day",
            "Much shorter, because you cannot purge a phone",
            "Longer, because phones have spare storage",
          ],
          answer: 1,
          explain: "A VOD master playlist can live a day at the CDN because you will [[purge]] it on change, but only a minute on a phone, because you cannot purge a phone. So the CDN needs its own lifetime.",
        },
        {
          kind: "read",
          title: "Three generations of tools",
          body: "Often the CDN should keep something longer than the client. Three generations of tools exist:\n\n1. **`s-maxage`**: standard, but applies to every shared cache, including proxies you do not control.\n2. **[[Surrogate-Control]]**, from the W3C Edge Architecture Specification (2001), used by Fastly and Varnish.\n3. **`CDN-Cache-Control`** and **[[targeted cache control|Targeted Cache-Control]]** (RFC 9213, June 2022).",
        },
        {
          kind: "read",
          title: "Surrogate-Control on Fastly",
          body: "Fastly checks four places in order, shown below. It strips `Surrogate-Control` before the end user, but not between its own shield and edge.\n\nCloudFront does not use `Surrogate-Control`. It uses `Cache-Control` plus its own TTL settings instead.",
          visual: { kind: "code", lang: "text", code: "1. Surrogate-Control: max-age\n2. Cache-Control: s-maxage\n3. Cache-Control: max-age\n4. Expires", caption: "Fastly's freshness lookup order" },
        },
        {
          kind: "order",
          prompt: "Put Fastly's freshness lookup in order, first checked first.",
          items: ["Surrogate-Control: max-age", "Cache-Control: s-maxage", "Cache-Control: max-age", "Expires"],
          explain: "Fastly checks `Surrogate-Control: max-age`, then `Cache-Control: s-maxage`, then `max-age`, then `Expires`.",
        },
        {
          kind: "read",
          title: "Targeted cache control (RFC 9213)",
          body: "A **targeted field** uses `Cache-Control` syntax but applies only to a named class of cache. A CDN checks its list of targeted fields, most specific first. If one is valid, it uses it and ignores `Cache-Control` and `Expires` for itself.\n\nRFC 9213's example below gives CDNs 600 s, other shared caches 120 s and browsers 60 s.",
          visual: { kind: "code", lang: "http", code: "Cache-Control: max-age=60, s-maxage=120\nCDN-Cache-Control: max-age=600" },
        },
        {
          kind: "quiz",
          prompt: "With RFC 9213's example (`Cache-Control: max-age=60, s-maxage=120` and `CDN-Cache-Control: max-age=600`), how long does a shared proxy that is not a CDN cache the response?",
          options: ["60 seconds", "120 seconds", "600 seconds"],
          answer: 1,
          explain: "Only CDNs read `CDN-Cache-Control` (600 s). Other shared caches use `s-maxage` (120 s). Browsers use `max-age` (60 s).",
        },
        {
          kind: "read",
          title: "In multi-CDN",
          body: "Send `Cache-Control` that is correct for clients. Add a CDN-targeted lifetime. Then verify, per vendor, which header each CDN really honours.\n\nDo it with a **conformance test** that fetches through every CDN and checks `Age` and hit or miss (Chapter 14). Same headers do not guarantee the same behaviour.",
        },
        {
          kind: "read",
          title: "CloudFront's TTL clamping",
          body: "CloudFront combines origin headers with a **minimum**, **default** and **maximum TTL** per cache behaviour.\n\n- `max-age` or `s-maxage` (`s-maxage` wins for CloudFront) is clamped between the minimum and the maximum.\n- With no header, the default TTL applies.",
          visual: {
            kind: "table",
            headers: ["Origin sends", "CloudFront caches for"],
            rows: [
              ["max-age or s-maxage inside min..max", "That value (s-maxage wins)"],
              ["A value above the maximum TTL", "The maximum TTL"],
              ["A value below the minimum TTL", "The minimum TTL"],
              ["No freshness header", "The default TTL"],
            ],
          },
        },
        {
          kind: "read",
          title: "The dangerous rule",
          body: "If the minimum TTL is above 0, CloudFront caches for at least that long **even when the origin sends `no-cache`, `no-store` or `private`**.\n\nA behaviour with `MinTTL=60` serving a personalized `private` response may serve one user's response to another. AWS suggests `stale-if-error=0` if you also want errors instead of old content when the origin is unreachable.",
          callout: {
            type: "mistake",
            text: "One CloudFront behaviour for everything, with a non-zero minimum TTL \"for performance\". Split by path: segments (long TTL), manifests (short), API and license paths (minimum TTL 0, caching disabled).",
          },
        },
        {
          kind: "quiz",
          prompt: "A CloudFront behaviour has minimum TTL 300 s. The origin sends `Cache-Control: private` on a personalized manifest. What happens?",
          options: [
            "CloudFront obeys `private` and does not cache it",
            "CloudFront caches it for at least 300 s, so one user's manifest can reach others",
            "CloudFront returns 502 because the headers conflict",
          ],
          answer: 1,
          explain: "With a minimum TTL above 0, CloudFront caches for at least the minimum even with `private`, `no-cache` or `no-store`. Use a separate behaviour with minimum TTL 0 and caching disabled for personalized paths.",
        },
        {
          kind: "number",
          prompt: "A CloudFront behaviour has a maximum TTL of 3,600 s. The origin sends `s-maxage=86400`. How many seconds does CloudFront cache the object?",
          answer: 3600,
          tolerance: 1,
          unit: "s",
          hint: "The header value is clamped between minimum and maximum.",
          explain: "86,400 is above the maximum, so it is clamped down to the maximum TTL: 3,600 s.",
        },
        {
          kind: "read",
          title: "Immutable, versioned URLs",
          body: "Here is an **assumed** policy for a service like Crunchyroll, not a published one. The core idea is **immutable, versioned URLs**.\n\nOnce a segment URL is published, its bytes never change. A re-encode gets a new version path. Segments can then be cached for a year, with no purge storms.",
        },
        {
          kind: "read",
          title: "A header policy for VOD objects",
          body: "Segments are the immutable layer. Manifests and subtitles are the mutable layer, purged on change. Anything per-user is never stored.",
          visual: {
            kind: "table",
            headers: ["Object", "Suggested headers (assumed)", "Reasoning"],
            rows: [
              ["Media and init segments", "public, max-age=31536000, immutable", "Bytes never change under this URL"],
              ["Subtitle files", "Long if versioned; else medium plus purge", "Subtitle fixes are common"],
              ["VOD media playlist", "CDN long plus purge; client 60-300 s", "Lists immutable segments"],
              ["VOD master playlist or MPD", "Same, unless personalized", "Changes when dubs or subs are added"],
              ["Personalized or tokenized manifest", "private, no-store", "Per-user URLs or entitlements"],
              ["Segment 404", "max-age=1 or no-store", "Avoid the premiere 404 trap"],
              ["DRM license, playback API", "no-store", "Per-user, sensitive (Chapter 8)"],
            ],
            caption: "Assumed policy, not published by Crunchyroll.",
          },
        },
        {
          kind: "match",
          prompt: "Match each object to its suggested headers (assumed policy).",
          pairs: [
            ["Media segment", "public, max-age=31536000, immutable"],
            ["Personalized manifest", "private, no-store"],
            ["Segment 404", "max-age=1 or no-store"],
            ["DRM license", "no-store"],
            ["VOD media playlist", "CDN long plus purge; client 60-300 s"],
          ],
          explain: "Immutable segments get a year. Per-user manifests and licenses are never stored. Segment 404s live about a second. Playlists live long at the CDN (purged on change) but short on the client.",
        },
        {
          kind: "read",
          title: "Live playlists differ",
          body: "Live playlists change all the time. RFC 8216 says a live playlist must be updated no earlier than **half** and no later than **1.5 times** the target duration.\n\nSo live TTLs follow the segment cadence, not a fixed long lifetime (Chapter 13).",
        },
        {
          kind: "number",
          prompt: "A live HLS stream has a 6-second target duration. Under RFC 8216, what is the latest a new playlist version may appear after the previous one, in seconds?",
          answer: 9,
          tolerance: 0.5,
          unit: "s",
          hint: "No later than 1.5 times the target duration.",
          explain: "1.5 x 6 = 9 seconds. The earliest is half: 3 seconds. Playlist TTLs must fit inside that cadence.",
        },
        {
          kind: "read",
          title: "Manifests are the mutable layer",
          body: "With dubs and subtitle languages added over time, manifests change after release more often than segments.",
          callout: {
            type: "crunchyroll",
            text: "Sony reported more than 21M paid Crunchyroll subscribers and a library of more than 50,000 episodes in its fiscal 2025 results (May 2026); its March 2025 figure was about 17M. A platform like this would likely keep segments immutable and treat manifests and subtitle lists as the mutable layer, purged on change (Chapter 5).",
          },
        },
        {
          kind: "widget",
          widget: "cache-headers",
          title: "Immutable segment vs no-store",
          task: "Replay the VOD segment preset: one MISS, then hits, even after the origin goes down at 30 s. Then load the \"no-store\" mistake preset and replay. Compare the origin load.",
          props: { preset: "vod-segment" },
        },
        {
          kind: "summary",
          points: [
            "The CDN often needs a longer lifetime than the client: s-maxage, Surrogate-Control, or CDN-Cache-Control (RFC 9213).",
            "Fastly order: Surrogate-Control, s-maxage, max-age, Expires; it strips Surrogate-Control before the user.",
            "CloudFront clamps TTLs between min and max, and a min TTL above 0 overrides no-store and private.",
            "Immutable, versioned segment URLs can be cached for a year with no purge storms.",
            "Live playlist TTLs follow the cadence: 0.5x to 1.5x the target duration.",
          ],
        },
      ],
    },

    /* ================= Lesson 5 ================= */
    {
      id: "ch04-l5",
      title: "Validators, cache keys and Vary",
      goal: "Revalidate cheaply with ETags across origins, design cache keys that keep hit ratio high, and keep Vary off segments.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "The edge's copy of `master.m3u8` is stale, but the origin has not changed it. What is the cheapest correct move?",
          options: [
            "Download the whole file again",
            "Ask the upstream \"has it changed?\" and get a 304 with no body",
            "Keep serving it forever without asking",
          ],
          answer: 1,
          explain: "A stale response need not be downloaded again. The cache sends a conditional request with a validator, and an unchanged object comes back as **304 Not Modified** with no body.",
        },
        {
          kind: "read",
          title: "Validators",
          body: "The cache asks \"has it changed?\" with a **validator**:\n\n- **`Last-Modified`**: a timestamp with one-second precision.\n- **[[ETag]]**: an opaque string chosen by the origin.\n\nA **strong** ETag (`\"abc\"`) promises identical bytes. A **weak** one (`W/\"abc\"`) promises only semantic equivalence. Combining byte ranges requires strong validators.",
        },
        {
          kind: "read",
          title: "Conditional requests",
          body: "The cache sends `If-None-Match` (with the ETag) or `If-Modified-Since` (with the timestamp). If nothing changed, the server answers **[[304 Not Modified]]** with no body. The cache refreshes its headers and age and serves its copy.\n\nFor ranges, **`If-Range`** means \"send this range if the validator matches, otherwise send the whole new file\". So a client never stitches old and new bytes together.",
        },
        {
          kind: "read",
          title: "Revalidation through two tiers",
          body: "The player asks the edge. The edge copy is stale, so the edge asks the shield with the ETag it holds. The shield copy is stale too, so the shield asks the origin.",
          visual: { kind: "sequence", spec: { ...VALIDATE, upTo: 2 } },
        },
        {
          kind: "read",
          title: "A 304 travels back",
          body: "The origin says \"not modified\". Each tier resets the age and keeps its body. The player gets a normal 200 from cache.\n\nA 304 costs one round trip and a few hundred bytes, instead of a 2.5 MB body. For immutable segments the best revalidation is none: a long TTL means the question is never asked.",
          visual: { kind: "sequence", spec: VALIDATE },
        },
        {
          kind: "match",
          prompt: "Match each header or response to its role.",
          pairs: [
            ["If-None-Match", "Sends the ETag to check"],
            ["If-Modified-Since", "Sends the timestamp to check"],
            ["If-Range", "This range if unchanged, else the whole file"],
            ["304 Not Modified", "Unchanged, no body"],
            ["W/\"abc\"", "Weak ETag: only semantic equivalence"],
          ],
          explain: "`If-None-Match` carries the ETag, `If-Modified-Since` the Last-Modified time. `If-Range` protects ranged fetches from mixing versions. A 304 has no body. `W/` marks a weak ETag.",
        },
        {
          kind: "read",
          title: "Two origins, two ETags",
          body: "Suppose the same segment lives in S3 and GCS (Chapter 6). Each storage system makes its own ETag. In S3, a single-part upload's ETag is typically the object's MD5, but a multipart upload gets a different value (a hash of part hashes with a part-count suffix). GCS has its own ETags, and replicated copies often get a new `Last-Modified`.\n\nThe shield holds a copy from S3 with ETag A, then fails over to GCS.",
          visual: { kind: "sequence", spec: ETAGS },
        },
        {
          kind: "quiz",
          prompt: "After the shield fails over from S3 to GCS, revalidations always return 200, never 304. Why?",
          options: [
            "GCS does not support conditional requests",
            "GCS does not recognise S3's ETag, so it sends the full object",
            "The shield stopped sending If-None-Match",
          ],
          answer: 1,
          explain: "Each storage system generates its own ETag and Last-Modified, so `If-None-Match: A` matches nothing at GCS. Every revalidation becomes a full download, and every `If-Range` falls back to the whole object.",
        },
        {
          kind: "read",
          title: "Make validators yours",
          body: "The fix: make validators **yours**. Compute a content hash at packaging time. Store it as object metadata. Have an origin service or edge function serve it as the ETag on every origin.\n\nOr rely on immutable URLs, so revalidation is rare.",
          callout: {
            type: "staff",
            text: "\"Are our validators identical across all origins?\" is a strong multi-origin review question that most teams have never checked. One `curl -I` per origin for the same key answers it. Also note that CloudFront turns a strong ETag weak (adds `W/`) when it compresses an object.",
          },
        },
        {
          kind: "read",
          title: "What a cache key is",
          body: "The **[[cache key]]** is the identity a cache uses to look up a stored response. RFC 9111 says it is at least the method and target URI. CDNs add the host. Everything else is configuration: query strings, headers, cookies, device class.\n\nTwo requests for the same bytes with different keys are two misses and two stored copies. Two requests for different bytes with the same key are a correctness bug.",
        },
        {
          kind: "quiz",
          prompt: "Two requests for different bytes end up with the same cache key. What do you have?",
          options: [
            "A lower hit ratio",
            "A correctness bug: some viewers get the wrong bytes",
            "Nothing harmful; the CDN detects it",
          ],
          answer: 1,
          explain: "Different keys for the same bytes waste cache (two misses, two copies). The same key for different bytes is worse: the cache serves one response for the other.",
        },
        {
          kind: "read",
          title: "Query strings: the top hit-ratio killer",
          body: "Video URLs collect query parameters:\n\n- **auth tokens** per user or session (Chapter 8);\n- analytics from player SDKs;\n- **[[CMCD]]** (Common Media Client Data, CTA-5004), which can be sent as a query parameter with a session ID and buffer state that change every request (Chapter 10);\n- cache-busters like `?t=1731600000`.\n\nIf the full query string is in the cache key, every request is unique.",
        },
        {
          kind: "number",
          prompt: "2M viewers watch one simulcast episode, and a per-session token stays in the cache key. How many copies of each segment does the cache need?",
          answer: 2000000,
          tolerance: 100000,
          unit: "copies",
          explain: "One per session: 2M copies instead of one. Edge hit ratio falls near zero, and shield and origin receive roughly the full 1M requests per second and 8 Tbps, instead of a few thousand requests per second.",
        },
        {
          kind: "read",
          title: "Allowlist, validate, strip",
          body: "Rules:\n\n- **Allowlist**, do not denylist, the parameters that really select different bytes (often none for segments).\n- Validate the token at the edge, **then remove it from the key**, and usually from the origin request.\n- Normalize the rest: sort, strip empty values.",
          visual: { kind: "flow", spec: { ...KEY, flow: ["req>val", "val>log", "log>strip", "strip>key", "key>look", "look>hit"] } },
        },
        {
          kind: "read",
          title: "Bad tokens never reach the cache",
          body: "An invalid token gets a 403 with a reason, and that answer is not cached. A valid request is logged first, so CMCD and analytics data are not lost. Then the key is cleaned. A miss goes to the shield with the clean URL.",
          visual: { kind: "flow", spec: { ...KEY, focus: ["val", "deny", "log", "miss", "val>deny", "val>log", "look>miss"], flow: ["req>val", "val>deny"] } },
          callout: {
            type: "industry",
            text: "CloudFront separates a **cache policy** (what is in the key) from an **origin request policy** (what is forwarded to origin). Fastly does it in VCL or Compute by rewriting the URL and hash inputs. Akamai has cache-key query settings in Property Manager. Same concept, different config, which is why config parity across CDNs is hard (Chapter 9).",
          },
        },
        {
          kind: "quiz",
          prompt: "Which query parameters belong in a media segment's cache key?",
          options: [
            "The per-session auth token",
            "The CMCD data",
            "The cache-buster `?t=1731600000`",
            "Only parameters that select different bytes, often none",
          ],
          answer: 3,
          explain: "Allowlist only parameters that really change the bytes. For segments that is often none. Validate tokens and log CMCD, then strip them from the key.",
        },
        {
          kind: "read",
          title: "Vary: a hidden second cache key",
          body: "The **[[Vary]]** response header says the response depends on certain request headers. A cache must not reuse it unless those headers match. So the origin adds request headers to the key at response time.\n\n- `Vary: Accept-Encoding` is normal for compressible text. Caches should normalize `Accept-Encoding` to a few values. CloudFront adds it to the key when compression is on, and strips unknown values.\n- `Vary: Origin` comes from CORS and splits the cache by web host.",
        },
        {
          kind: "match",
          prompt: "Match each Vary value to its effect on caching.",
          pairs: [
            ["Vary: Accept-Encoding", "Normal for compressible text"],
            ["Vary: User-Agent", "Effectively disables sharing"],
            ["Vary: *", "Never matches"],
            ["Vary: Origin", "Splits the cache per web host"],
          ],
          explain: "`Accept-Encoding` is fine on text when normalized. `User-Agent` and `Cookie` make nearly every request different. `Vary: *` never matches. `Origin` comes from CORS. Segments should have no `Vary` at all: they are not compressed, localized or personalized.",
        },
        {
          kind: "read",
          title: "No Vary on segments",
          body: "Segments should have **no `Vary` at all**. They are not compressed, localized or personalized. `Vary: User-Agent` or `Vary: Cookie` effectively disables sharing, and `Vary: *` never matches.",
          callout: {
            type: "mistake",
            text: "An origin framework adds `Vary: Origin, Accept-Encoding, User-Agent` to every response, including segments. Testing with one browser looks fine. In production the hit ratio drops, and nobody finds the cause in CDN config, because it is in the origin's headers. Check `Vary` on segments with `curl -I`.",
          },
        },
        {
          kind: "widget",
          widget: "cache-headers",
          title: "The Vary mistake",
          task: "Replay the \"Vary: User-Agent\" mistake preset and count the misses as different devices ask for the same segment. Then set Vary to none and replay. Watch the hit ratio and origin load change.",
          props: { preset: "vary-ua" },
        },
        {
          kind: "summary",
          points: [
            "Validators (strong or weak ETag, Last-Modified) turn a re-download into a 304 with no body.",
            "Each origin makes its own ETag; serve your own content-hash ETag everywhere, or rely on immutable URLs.",
            "The cache key decides hit ratio: allowlist parameters, validate then strip tokens and CMCD.",
            "Different bytes under one key is a correctness bug; same bytes under many keys is a cost bug.",
            "Vary is a hidden second key: none on segments, only Accept-Encoding on text.",
          ],
        },
      ],
    },

    /* ================= Lesson 6 ================= */
    {
      id: "ch04-l6",
      title: "Byte ranges, CORS and compression",
      goal: "Cache byte ranges correctly on every CDN, keep CORS cheap for web players, and compress only what should be compressed.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "A player sends `Range: bytes=1000000-1999999` for a 52,428,800-byte file. What status comes back?",
          options: ["200 OK", "206 Partial Content", "416 Range Not Satisfiable"],
          answer: 1,
          explain: "The range is inside the file, so the server answers **206** with `Content-Range: bytes 1000000-1999999/52428800`. A range outside the file would get 416.",
        },
        {
          kind: "read",
          title: "How ranges work",
          body: "A client asks for part of a resource with a **[[byte-range request]]**: `Range: bytes=1000000-1999999`. The server answers **[[206 Partial Content]]** with `Content-Range: bytes 1000000-1999999/52428800`. The last number is the full size. It advertises support with `Accept-Ranges: bytes`.\n\nA range outside the file gets **416**. Multi-range requests return `multipart/byteranges`, which many CDNs and players handle poorly. Avoid them.",
        },
        {
          kind: "read",
          title: "Why video uses ranges",
          body: "Video uses ranges for **single-file renditions**: each rendition is one large [[fMP4]] file, and segments are ranges inside it. DASH on-demand profiles use a `sidx` index. HLS uses `EXT-X-BYTERANGE` (RFC 8216 section 4.3.2.2), as below.\n\nRanges are also used for seeking, resuming offline downloads and splitting large segments.",
          visual: {
            kind: "code",
            lang: "m3u8",
            code: "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:6\n#EXT-X-MAP:URI=\"1080p.mp4\",BYTERANGE=\"1200@0\"\n#EXTINF:6.006,\n#EXT-X-BYTERANGE:3145728@1200\n1080p.mp4\n#EXTINF:6.006,\n#EXT-X-BYTERANGE:3010560\n1080p.mp4\n#EXT-X-ENDLIST",
            caption: "Every segment is a range inside one file.",
          },
        },
        {
          kind: "read",
          title: "How CDNs cache ranges",
          body: "RFC 9111 lets a cache store a 206 as an incomplete response. It may serve a later range from it only if that range lies fully inside what it holds. Stored ranges may be combined only if they share the same **strong** validator.\n\n**CloudFront**: on a range miss it \"might request a larger range\". If the origin supports ranges (S3 does), it caches the returned range; if not, it caches the whole object and serves ranges from it.",
        },
        {
          kind: "read",
          title: "CloudFront edge cases and Fastly",
          body: "**CloudFront**: if the origin sends `Transfer-Encoding: chunked`, it returns the whole object instead of the range. Malformed ranges get a 200 with the full object. It will not cache objects over 50 GB, but range requests can cache parts of larger ones.\n\n**Fastly**: without **Segmented Caching**, accounts created on or after 17 June 2020 have a 20 MB maximum cacheable object size. Segmented Caching stores large resources as pieces, fetches only missing ones, and serves any range. It needs `Content-Length` and is incompatible with compression and ESI.",
        },
        {
          kind: "number",
          prompt: "A single-file rendition holds a 24-minute episode at 8 Mbps. About how big is the file, in GB?",
          answer: 1.44,
          tolerance: 0.1,
          unit: "GB",
          hint: "Seconds x Mbps / 8 gives megabytes.",
          explain: "24 x 60 = 1,440 s. 1,440 x 8 = 11,520 megabits, / 8 = 1,440 MB, about 1.4 GB. That is far above Fastly's 20 MB limit, so it needs range-aware caching on every CDN. A 2.5 MB segment file fits everywhere.",
        },
        {
          kind: "quiz",
          prompt: "A CloudFront origin answers a range request with `Transfer-Encoding: chunked`. What does CloudFront return to the player?",
          options: ["The requested range", "The whole object", "416 Range Not Satisfiable"],
          answer: 1,
          explain: "With a chunked origin response, CloudFront returns the whole object instead of the range. That is why \"does any origin send chunked responses?\" is on the design-review checklist.",
        },
        {
          kind: "read",
          title: "Range alignment and layout",
          body: "Cache efficiency depends on **range alignment**. Players that ask for exactly the manifest's ranges create a small, repeated set. Download managers asking for arbitrary ranges need block-based storage to avoid overlapping copies.",
          visual: {
            kind: "table",
            headers: ["Layout", "Objects per rendition", "Pros", "Cons"],
            rows: [
              ["File per segment", "Hundreds to thousands", "Simple keys and CDN behaviour, easy per-segment purge", "Many objects, more PUT and metadata cost"],
              ["Single file with byte ranges", "1", "Few objects, simpler storage and replication", "Needs range-aware caching everywhere; chunked origins break it"],
            ],
          },
          callout: {
            type: "crunchyroll",
            text: "Which layout Crunchyroll uses is not published. A new engineer should check it early, because it decides whether range behaviour is central or a corner case. Chapter 7 covers the packaging trade-off.",
          },
        },
        {
          kind: "read",
          title: "Why CORS shows up in video",
          body: "A web player on `www.example-streaming.com` downloads segments from `cdn.example-streaming.net` with `fetch()` and feeds them to Media Source Extensions. That is a **cross-origin** request.\n\nThe browser lets the page read the response only if the server allows it through **[[CORS]]** (Cross-Origin Resource Sharing), defined in the WHATWG Fetch standard. The key response header is **`Access-Control-Allow-Origin`** (ACAO): `*` or one exact origin.",
        },
        {
          kind: "quiz",
          prompt: "After a release, web rebuffering rises, but the iOS and Android apps are fine. Which is the first suspect?",
          options: ["A BGP route change", "CORS", "A DRM key rotation"],
          answer: 1,
          explain: "Native apps do not enforce CORS; browsers do. So CORS bugs look like \"web broken, apps fine\".",
        },
        {
          kind: "read",
          title: "Simple requests and preflights",
          body: "A GET with only safelisted headers goes straight through. A single simple `Range: bytes=` header counts as safelisted, so normal range requests need no preflight.\n\nA custom header (an `X-Auth-Token`, or CMCD sent as headers) triggers a **preflight**: an `OPTIONS` request the browser must get approved first. Browsers cache approval for `Access-Control-Max-Age`: capped at 24 hours in Firefox, 2 hours in Chromium (since version 76), 5 seconds by default. Preflights are cached per URL, so new segment URLs can mean new preflights.",
          visual: { kind: "flow", spec: { ...CORS, focus: ["fetch", "safe", "pre", "ok", "get", "fetch>safe", "safe>pre", "pre>ok", "ok>get"], flow: ["fetch>safe", "safe>pre", "pre>ok", "ok>get", "get>acao", "acao>append"] }, caption: "A custom header adds a whole extra round trip." },
        },
        {
          kind: "multi",
          prompt: "Which of these segment requests trigger a CORS preflight? Select all that apply.",
          options: [
            "GET with only `Range: bytes=0-999`",
            "GET with an `X-Auth-Token` header",
            "GET with CMCD sent as request headers",
            "GET with CMCD in the query string",
          ],
          answers: [1, 2],
          explain: "A simple Range header is safelisted, and query strings do not affect preflights. Custom headers, including CMCD sent as headers, force an `OPTIONS` preflight: extra latency and up to double the edge request count.",
        },
        {
          kind: "read",
          title: "CORS and caching",
          body: "The classic trap is **reflecting** the request `Origin` into ACAO. Then the response must carry `Vary: Origin`, or a cache may serve one site's ACAO to another site and the browser rejects it. But `Vary: Origin` splits the cache per web origin.\n\nBetter patterns for segments:\n\n- If segments are protected by tokens or DRM anyway, use `Access-Control-Allow-Origin: *`. One cached copy, no `Vary`.\n- For an allowlist, let the **edge** add CORS headers after the cache lookup.\n- Answer `OPTIONS` at the edge; never forward preflights to origin.",
          callout: {
            type: "mistake",
            text: "Adding a custom auth header to segment requests \"for security\" without counting preflights. The gain over a URL token is small; the cost is an extra round trip per new URL and up to double the edge request rate.",
          },
        },
        {
          kind: "read",
          title: "Adding CORS after the cache",
          body: "This Fastly VCL sketch runs in `vcl_deliver`, so the headers go only on the response to the browser, not on the cached object. With shielding, run it only on the edge PoP that faces the browser. Otherwise the shield's response, which the edge caches, carries them too.\n\nList headers the player must read (for example a CDN identifier for QoE) in `Access-Control-Expose-Headers`.",
          visual: {
            kind: "code",
            lang: "vcl",
            code: "sub vcl_deliver {\n  if (req.http.Origin ~ \"^https://(www|beta)\\.example-streaming\\.com$\") {\n    set resp.http.Access-Control-Allow-Origin = req.http.Origin;\n    set resp.http.Access-Control-Expose-Headers = \"X-Served-By, Age\";\n    if (resp.http.Vary) {\n      set resp.http.Vary = resp.http.Vary \", Origin\";\n    } else {\n      set resp.http.Vary = \"Origin\";\n    }\n  }\n}",
          },
        },
        {
          kind: "quiz",
          prompt: "Segments use [[signed cookies]], so requests are sent with credentials. Which CORS answer does the browser accept?",
          options: [
            "`Access-Control-Allow-Origin: *`",
            "The exact origin plus `Access-Control-Allow-Credentials: true`",
            "No CORS headers at all",
          ],
          answer: 1,
          explain: "With credentials (cookies, such as signed cookies, Chapter 8), the browser requires an exact origin plus `Access-Control-Allow-Credentials: true`; `*` is not allowed. That is one reason players prefer URL tokens for segments.",
        },
        {
          kind: "read",
          title: "Compression: manifests yes, segments no",
          body: "Video and audio are already compressed by their codecs. Gzip or Brotli on an fMP4 segment saves almost nothing, burns edge CPU, changes `Content-Length`, makes byte ranges refer to compressed bytes, weakens validators, and conflicts with Fastly Segmented Caching. **Never compress media segments**, and check that the origin does not send `Content-Encoding` on them.",
          callout: {
            type: "staff",
            text: "Never compress byte-range media. A range applies to the encoded bytes: CloudFront bases ranges on the compressed size, and Fastly disables segmented caching with compression. Compressed plus ranged equals confusing bugs.",
          },
        },
        {
          kind: "multi",
          prompt: "Which problems does gzip cause on fMP4 media segments? Select all that apply.",
          options: [
            "It changes `Content-Length`",
            "Byte ranges then refer to compressed bytes",
            "It weakens validators (ETags)",
            "It cuts segment size by about half",
            "It disables Fastly Segmented Caching",
          ],
          answers: [0, 1, 2, 4],
          explain: "Media is already codec-compressed, so gzip saves almost nothing. It only adds CPU cost, changes `Content-Length`, shifts ranges onto compressed bytes, weakens ETags and conflicts with Segmented Caching.",
        },
        {
          kind: "read",
          title: "Manifests and subtitles compress well",
          body: "Manifests and subtitles are repetitive text or XML. A DASH [[MPD]] with 8 video renditions, 6 audio dubs and 12 subtitle languages repeats long, similar elements and URLs.\n\nIllustration (assumed sizes): a 150 KB MPD compressed to 20 KB saves 130 KB per playback start. RFC 8216 says HLS servers SHOULD send playlists and WebVTT segments with gzip when the client accepts it. For live, where playlists reload every few seconds, the saving repeats constantly.",
        },
        {
          kind: "number",
          prompt: "A 150 KB MPD compresses to 20 KB. 2M viewers start within minutes of a premiere. About how many GB does compression save in that startup burst? (Use 1 GB = 1,000,000 KB.)",
          answer: 260,
          tolerance: 10,
          unit: "GB",
          explain: "150 - 20 = 130 KB per start. 130 KB x 2,000,000 = 260,000,000 KB = about 260 GB. More importantly, viewers on slow mobile links get the first manifest faster.",
        },
        {
          kind: "read",
          title: "CloudFront's compression rules",
          body: "**CloudFront** compresses on the fly with gzip or Brotli (Brotli if the client accepts both). Only for objects of 1,000 to 10,000,000 bytes, only listed content types (including `application/dash+xml`, `application/vnd.apple.mpegurl`, `application/x-mpegurl`), only 200, 403 and 404 responses, and only with `Content-Length` from origin. It adds `Accept-Encoding` to the key, skips objects the origin already encoded, and may skip compression under high load.\n\nSo **Content-Type must be right**. RFC 8216 requires a `.m3u8` or `.m3u` path, or Content-Type `application/vnd.apple.mpegurl` or `audio/mpegurl`.",
        },
        {
          kind: "quiz",
          prompt: "An HLS playlist at a path without `.m3u8` is served through CloudFront as `application/octet-stream`, with compression on. What happens?",
          options: [
            "CloudFront detects it is text and compresses it",
            "It is not compressed, and it may confuse players",
            "CloudFront returns 415 Unsupported Media Type",
          ],
          answer: 1,
          explain: "CloudFront only compresses listed content types, and `application/octet-stream` is not a playlist type. RFC 8216 requires a `.m3u8` or `.m3u` path or the right Content-Type, so players may also be confused.",
        },
        {
          kind: "summary",
          points: [
            "Ranges: 206 with Content-Range, 416 if outside; avoid multi-range; combining stored ranges needs strong validators.",
            "CloudFront returns whole objects for chunked origins; Fastly needs Segmented Caching above 20 MB.",
            "CORS is browser-only: custom headers cause preflights, up to double the edge requests.",
            "Prefer ACAO `*` for token-protected segments; add allowlist CORS after the cache; answer OPTIONS at the edge.",
            "Never compress segments; compress manifests and subtitles, with the right Content-Type.",
          ],
        },
      ],
    },

    /* ================= Lesson 7 ================= */
    {
      id: "ch04-l7",
      title: "TLS 1.3 and certificates at scale",
      goal: "Count handshake round trips, use resumption and 0-RTT safely, and plan certificate management across many CDNs.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "Segments are already protected by DRM. Why do streaming services still send them over HTTPS?",
          options: [
            "DRM needs TLS to decrypt the video",
            "Privacy, integrity, browser rules and token protection",
            "TLS makes CDN caching faster",
          ],
          answer: 1,
          explain: "TLS is not DRM. TLS protects one transport hop; DRM protects content end to end. Video moved to HTTPS for privacy, integrity against middleboxes, browser requirements and to protect signed URLs and cookies, which are credentials.",
        },
        {
          kind: "read",
          title: "Why video is on HTTPS",
          body: "Many services once sent segments over plain HTTP. That changed in the mid-2010s:\n\n- **Privacy**: without TLS anyone on the path sees what a person watches.\n- **Integrity**: middleboxes injected or rewrote content.\n- **Browsers**: mixed-content blocking, and HTTP/2 and HTTP/3 need TLS.\n- **Tokens**: [[signed URLs]] and cookies are credentials.\n\nNetflix moved Open Connect video to HTTPS around 2015-2016. The cost was real: its engineers built in-kernel TLS for FreeBSD, so encryption happens in the `sendfile` path.",
        },
        {
          kind: "read",
          title: "The TLS 1.3 handshake",
          body: "**[[TLS 1.3]]** (RFC 8446, 2018) finishes a full handshake in **one round trip**. TLS 1.2 needed two. It is faster because the client sends its key share in the ClientHello.\n\nIt allows only forward-secret ephemeral key exchange. It encrypts everything after ServerHello, including the certificate. And it trims cipher suites.",
          visual: { kind: "sequence", spec: { ...TLS, upTo: 3 } },
        },
        {
          kind: "read",
          title: "Then the request, then a ticket",
          body: "Right after its Finished message, the client sends the GET. The edge answers with the segment. Later it sends a **NewSessionTicket**, which the client keeps for resuming a future connection.",
          visual: { kind: "sequence", spec: TLS },
        },
        {
          kind: "number",
          prompt: "RTT is 100 ms (ignore DNS). How many milliseconds before the first response byte for a new TCP + TLS 1.2 connection plus the request?",
          answer: 400,
          tolerance: 10,
          unit: "ms",
          hint: "TCP: 1 RTT. TLS 1.2: 2 RTT. Request: 1 RTT.",
          explain: "TCP 1 + TLS 1.2 2 + request 1 = 4 RTT, about 400 ms. TLS 1.3 saves one round trip (300 ms); QUIC folds transport and TLS together (200 ms).",
        },
        {
          kind: "order",
          prompt: "Order these connection setups from slowest to fastest first response byte.",
          items: [
            "TCP + TLS 1.2 + request",
            "TCP + TLS 1.3 + request",
            "QUIC new connection + request",
            "QUIC with 0-RTT resumption",
          ],
          explain: "4 RTT, 3 RTT, 2 RTT and about 1 RTT. At 100 ms RTT that is about 400, 300, 200 and 100 ms.",
        },
        {
          kind: "read",
          title: "Round trips add up across hosts",
          body: "Video start touches several hosts: playback API, manifest host, license server, segment CDN (Chapter 10). Fresh connections to each add up.\n\nCheap wins: fewer distinct hostnames, connection reuse, and [[session resumption]].",
          visual: {
            kind: "stats",
            items: [
              { value: "4 RTT", label: "TCP + TLS 1.2 + request", note: "about 400 ms" },
              { value: "3 RTT", label: "TCP + TLS 1.3 + request", note: "about 300 ms" },
              { value: "2 RTT", label: "QUIC new + request", note: "about 200 ms" },
              { value: "~1 RTT", label: "QUIC with 0-RTT", note: "about 100 ms" },
            ],
            caption: "Assumed 100 ms RTT, DNS ignored.",
          },
        },
        {
          kind: "read",
          title: "SNI on a shared CDN",
          body: "A CDN edge IP serves thousands of customers. The client names the host in the **[[SNI]]** (Server Name Indication) extension of the ClientHello, and the edge picks the matching certificate.\n\nClients since about 2010 support SNI. For older ones, CloudFront offers dedicated IPs per edge for an extra monthly charge. Old smart TVs and set-top boxes were the last holdouts, so check your device matrix. SNI is visible to observers; **Encrypted Client Hello (ECH)** hides it, mostly a privacy matter rather than a delivery one.",
        },
        {
          kind: "quiz",
          prompt: "An old set-top box connects to a shared CDN edge IP and gets a certificate for the wrong hostname. What is the most likely cause?",
          options: [
            "The box does not send SNI",
            "The certificate has expired",
            "The box does not support HTTP/3",
          ],
          answer: 0,
          explain: "Without SNI the edge cannot tell which of thousands of customers the client wants, so it cannot pick the right certificate. Old smart TVs and set-top boxes were the last devices without SNI.",
        },
        {
          kind: "read",
          title: "Session resumption at fleet scale",
          body: "After a handshake, a TLS 1.3 server sends a **NewSessionTicket**. Later the client offers it as a **pre-shared key (PSK)** to skip certificate and signature work. Ticket lifetime is capped at seven days.\n\nAt CDN scale this is a fleet problem. Tickets are encrypted with a **ticket key**, and the next connection may land on another server or PoP, which must know that key. CDNs share ticket keys across servers and rotate them often, because a stolen key weakens forward secrecy. So resumption rates differ between CDNs and PoPs.",
        },
        {
          kind: "read",
          title: "0-RTT early data",
          body: "**[[0-RTT|Zero-RTT (0-RTT)]] early data** lets the client send its first request in the first flight. The catch: early data has **no replay protection across connections**. A replayed segment GET is mostly harmless. A replayed license POST, or a \"start stream\" call that counts concurrent streams, is not.\n\nCloudflare, launching 0-RTT in 2017, answered only GET requests without query parameters over early data, and added a `Cf-0rtt-Unique` header so origins could detect replays. RFC 8470 (2018) standardized the `Early-Data: 1` request header and the **425 Too Early** status.",
        },
        {
          kind: "multi",
          prompt: "Which hosts should accept TLS 1.3 0-RTT early data? Select all that apply.",
          options: [
            "Segment host",
            "Manifest host",
            "DRM license server",
            "Playback API that counts concurrent streams",
            "Login host",
          ],
          answers: [0, 1],
          explain: "Early data can be replayed. Allow it for idempotent GETs on segment and manifest hosts. Refuse it on license, playback API, entitlement and login hosts.",
        },
        {
          kind: "read",
          title: "How an origin refuses early data",
          body: "A proxy that forwards early data adds `Early-Data: 1` to the request. An origin that does not want to risk a replay answers **425 Too Early**. The client then retries after the full handshake.",
          callout: {
            type: "staff",
            text: "Allow 0-RTT on segment and manifest hosts; deny it (or answer 425) on playback API, entitlement and license hosts. This is a clean argument for separate control-plane and data-plane hostnames (Chapter 1).",
          },
        },
        {
          kind: "read",
          title: "Certificates at delivery scale",
          body: "A **certificate** binds a hostname to a public key, signed by a **certificate authority (CA)**. The server sends **intermediate** certificates too, and the client builds a chain to a trusted **root**.\n\n- **Key type**: ECDSA certificates are smaller and faster than RSA. Many CDNs serve both, choosing per client.\n- **Old trust stores**: when Let's Encrypt's old cross-sign root, DST Root CA X3, expired on 30 September 2021, some older devices stopped trusting its certificates. Old smart TVs and streaming boxes are like that.",
        },
        {
          kind: "read",
          title: "Revocation and shorter lifetimes",
          body: "- **Revocation**: clients could check **OCSP**, and **[[OCSP stapling]]** let servers attach a signed status to the handshake. The industry is leaving OCSP: Let's Encrypt removed OCSP URLs in May 2025 and shut its responders on 6 August 2025, moving to CRLs. Test device clients that hard-require OCSP.\n- **Shorter lifetimes**: CA/Browser Forum ballot SC-081 (2025) cuts maximum public certificate validity in steps. Automation with **[[ACME]]** (RFC 8555) or vendor-managed certificates is mandatory.",
          visual: {
            kind: "stats",
            items: [
              { value: "398 d", label: "Maximum validity before" },
              { value: "200 d", label: "From 15 March 2026" },
              { value: "100 d", label: "From 15 March 2027" },
              { value: "47 d", label: "From 15 March 2029" },
            ],
            caption: "CA/Browser Forum ballot SC-081",
          },
        },
        {
          kind: "match",
          prompt: "Match each date to the maximum public certificate validity under ballot SC-081.",
          pairs: [
            ["Before 15 March 2026", "398 days"],
            ["From 15 March 2026", "200 days"],
            ["From 15 March 2027", "100 days"],
            ["From 15 March 2029", "47 days"],
          ],
          explain: "398 days, then 200 from 15 March 2026, 100 from 15 March 2027 and 47 from 15 March 2029. Manual renewal does not survive that.",
        },
        {
          kind: "read",
          title: "Certificates with many CDNs",
          body: "Each CDN must present a valid certificate for every hostname it serves. Two models exist. Either way, monitor from outside: check the certificate each CDN actually serves, per hostname, and alert well before expiry.\n\nExpired certificates are among the most common self-inflicted delivery outages (Chapters 12 and 15).",
          visual: {
            kind: "compare",
            left: { title: "CDN-managed certificates", points: ["Each CDN obtains and renews its own", "DNS CAA records must allow every CA your CDNs use", "Domain validation must work for each CDN"] },
            right: { title: "Bring your own certificate", points: ["You issue centrally", "Upload to every CDN by API", "You own rotation across N vendors"] },
          },
        },
        {
          kind: "quiz",
          prompt: "You use CDN-managed certificates on three CDNs. Renewal keeps failing on one CDN. Which DNS record should you check first?",
          options: ["CAA", "MX", "AAAA", "PTR"],
          answer: 0,
          explain: "With CDN-managed certificates, your DNS **CAA** records must allow every CA your CDNs use. If one CDN uses a CA that CAA does not allow, its issuance and renewal fail.",
        },
        {
          kind: "read",
          title: "Certificates live in many places",
          body: "In a multi-CDN, multi-cloud platform, certificates are not only at the edge. They are also on every origin endpoint (for CDN-to-origin TLS) and on internal services.",
          callout: {
            type: "crunchyroll",
            text: "The job posting names Fastly, Akamai, Google Media CDN, Cloudflare and CloudFront and asks for security hardening. With several CDNs plus AWS and GCP origins, certificates likely live at each CDN edge, each origin endpoint (CDN-to-origin TLS) and internal services. With 47-day certificates coming by 2029, an inventory of \"every place a certificate lives and who renews it\" is a realistic early project.",
          },
        },
        {
          kind: "reveal",
          prompt: "Design review: for a five-CDN, two-cloud video platform, what must a certificate inventory record for each certificate?",
          answer: "- Where it lives: which CDN edge and hostname, which origin endpoint (CDN-to-origin TLS), which internal service.\n- Who renews it: the CDN (CDN-managed, so CAA must allow its CA) or you (bring your own, uploaded by API to each vendor).\n- Its key type (ECDSA, RSA or both) and whether old devices can still build a chain to a trusted root.\n- Its expiry, checked from outside on what each CDN actually serves, with an alert well before expiry.\n- Whether any device client still hard-requires OCSP.",
        },
        {
          kind: "summary",
          points: [
            "TLS protects one hop; DRM protects content. Video is on HTTPS for privacy, integrity, browsers and tokens.",
            "TLS 1.3 is 1 RTT; at 100 ms RTT, setup ranges from about 400 ms (TCP + TLS 1.2) to 100 ms (QUIC 0-RTT).",
            "SNI picks the certificate on shared IPs; resumption depends on ticket keys shared across the fleet.",
            "0-RTT can be replayed: allow it only on idempotent data-plane hosts; refuse with 425 Too Early elsewhere.",
            "Lifetimes shrink to 47 days by 2029 and OCSP is going away, so automate (ACME) and monitor every CDN.",
          ],
        },
      ],
    },

    /* ================= Lesson 8: Checkpoint ================= */
    {
      id: "ch04-l8",
      title: "Checkpoint: the header contract",
      goal: "Read real-looking responses, run the header design-review checklist, and answer the chapter's check questions.",
      minutes: 10,
      steps: [
        {
          kind: "read",
          title: "A segment on the wire",
          body: "These are **illustrative** responses written for this book, not captured from Crunchyroll. First, a media segment from the edge. Read each line before you move on.",
          visual: { kind: "code", lang: "http", code: SEGMENT_RESPONSE, caption: "Illustrative, not captured from Crunchyroll." },
        },
        {
          kind: "quiz",
          prompt: "Which extra line would hurt this segment's hit ratio if the origin added it?",
          visual: { kind: "code", lang: "http", code: SEGMENT_RESPONSE },
          options: ["`vary: User-Agent`", "`etag: \"sha256-3f1a9c\"`", "`accept-ranges: bytes`", "`age: 412`"],
          answer: 0,
          explain: "`Vary: User-Agent` adds the User-Agent to the cache key and effectively disables sharing. Segments should have no `Vary` at all. The ETag, Accept-Ranges and Age lines are all healthy.",
        },
        {
          kind: "read",
          title: "A playlist on the wire",
          body: "Next, a master playlist: compressed, with a separate CDN lifetime.",
          visual: { kind: "code", lang: "http", code: PLAYLIST_RESPONSE, caption: "Illustrative, not captured from Crunchyroll." },
        },
        {
          kind: "quiz",
          prompt: "For this playlist, how long does a browser cache it, and how long does an RFC 9213-aware CDN?",
          visual: { kind: "code", lang: "http", code: PLAYLIST_RESPONSE },
          options: [
            "Browser 60 s, CDN 60 s",
            "Browser 60 s, CDN 86,400 s",
            "Browser 86,400 s, CDN 60 s",
          ],
          answer: 1,
          explain: "The browser uses `max-age=60`. The CDN finds a valid `cdn-cache-control: max-age=86400` and uses it, relying on purge when the playlist changes. `stale-if-error=86400` is outage insurance.",
        },
        {
          kind: "read",
          title: "The two contracts",
          body: "Segments and playlists get opposite treatment, for clear reasons.",
          visual: {
            kind: "compare",
            left: { title: "Segment", points: ["Year-long immutable lifetime", "A strong validator you control", "No Vary", "Permissive CORS (`*`)"] },
            right: { title: "Playlist", points: ["Short client lifetime", "Long CDN lifetime, relying on purge", "stale-if-error as outage insurance", "Vary: Accept-Encoding only"] },
          },
        },
        {
          kind: "reveal",
          prompt: "Design review: list the header questions you would ask about a delivery design. Try for ten before you reveal.",
          answer: "1. For each object type, what is in the cache key, and why?\n2. What `Cache-Control` does the origin send, and what does each CDN do with it (defaults, clamping, `Surrogate-Control`, `CDN-Cache-Control`)?\n3. Are segment URLs immutable? What happens on a re-encode or subtitle fix?\n4. How long do 404s and 5xx cache at edge and shield?\n5. Are validators identical across origins?\n6. Is `Vary` absent on segments and limited to `Accept-Encoding` on text?\n7. Are ranges cached efficiently on every CDN? Does any origin send chunked responses?\n8. How many CORS preflights does one web playback trigger?\n9. Which hosts allow 0-RTT, and are any non-idempotent?\n10. Who renews each certificate on each CDN, and what alerts before expiry?",
        },
        {
          kind: "read",
          title: "Turn the checklist into tests",
          body: "A checklist that a person runs once will drift. A checklist that runs in CI on every change will not.",
          callout: {
            type: "staff",
            text: "Most of this list becomes automated tests: fetch known objects through every CDN and origin and assert on status, `Age`, `Vary`, `ETag`, `Cache-Control`, CORS headers and certificate expiry. Chapter 14 runs these as conformance tests in CI before edge config ships.",
          },
        },
        {
          kind: "quiz",
          prompt: "An origin sends `Cache-Control: max-age=60, s-maxage=3600` on a VOD playlist. How long do a browser and a CDN cache it?",
          options: [
            "Browser 60 s, CDN 60 s",
            "Browser 60 s, CDN 3,600 s",
            "Browser 3,600 s, CDN 3,600 s",
          ],
          answer: 1,
          explain: "Browser 60 s. Shared caches 3,600 s, because `s-maxage` overrides `max-age` for them.",
        },
        {
          kind: "quiz",
          prompt: "Same playlist, but the origin also sends `CDN-Cache-Control: max-age=86400`. What changes?",
          options: [
            "Nothing; Cache-Control always wins",
            "An RFC 9213-aware CDN caches 86,400 s; browsers still use 60 s",
            "Browsers now cache 86,400 s too",
          ],
          answer: 1,
          explain: "An RFC 9213-aware CDN that finds a valid `CDN-Cache-Control` uses it and ignores `Cache-Control` for itself, so it caches 86,400 s. Browsers still use 60 s.",
        },
        {
          kind: "quiz",
          prompt: "A CloudFront behaviour has minimum TTL 300 s, and the origin sends `Cache-Control: private` on a personalized manifest. What happens, and what is the fix?",
          options: [
            "Not cached; no fix needed",
            "Cached at least 300 s, so one user's manifest can reach others; use a separate behaviour with min TTL 0 and caching disabled",
            "Cached 300 s only in the browser; set `s-maxage=0`",
          ],
          answer: 1,
          explain: "With minimum TTL above 0, CloudFront caches for at least the minimum even with `private`, `no-cache` or `no-store`. Personalized paths need their own behaviour with minimum TTL 0 and caching disabled.",
        },
        {
          kind: "number",
          prompt: "Estimate the edge segment request rate for 2M viewers with 5-second segments and separate audio (video + audio only).",
          answer: 800000,
          tolerance: 40000,
          unit: "req/s",
          explain: "400,000 video plus 400,000 audio = 800,000 requests per second. With playlists, subtitles and retries, plan for about 1M (assumed).",
        },
        {
          kind: "quiz",
          prompt: "In that same simulcast, a per-session token stays in the cache key. What happens to origin load?",
          options: [
            "It doubles from a trickle",
            "Shield and origin see close to the full rate and about 8 Tbps",
            "No change, because tokens expire quickly",
          ],
          answer: 1,
          explain: "Every request is unique, so the edge hit ratio falls near zero. Shield and origin see close to the full ~1M requests per second and about 8 Tbps.",
        },
        {
          kind: "multi",
          prompt: "`no-cache` allows storing but requires revalidation; `no-store` forbids storing. Which responses should carry `no-store`? Select all that apply.",
          options: [
            "DRM license responses",
            "Personalized playback API responses",
            "Immutable media segments",
            "A shared VOD master playlist",
          ],
          answers: [0, 1],
          explain: "`no-store` fits DRM license responses and personalized playback API responses. Segments want a year-long immutable lifetime, and a shared playlist wants a CDN lifetime plus purge.",
        },
        {
          kind: "reveal",
          prompt: "After a shield fails over from S3 to GCS, revalidations always return 200, never 304. Why, and what is the fix?",
          visual: { kind: "sequence", spec: ETAGS },
          answer: "Each storage system generates its own ETag and Last-Modified (and S3 multipart ETags differ from single-part ones), so GCS does not recognise the S3 validator. Fix: serve your own ETag from a content hash computed at packaging time and stored as metadata on every origin. Or rely on immutable URLs so revalidation is rare.",
        },
        {
          kind: "multi",
          prompt: "Why compress HLS playlists but not media segments? Select every problem compression causes for segments.",
          options: [
            "Changes `Content-Length`",
            "Makes byte ranges refer to compressed bytes",
            "Weakens ETags",
            "Disables Fastly Segmented Caching",
            "Forces a CORS preflight",
          ],
          answers: [0, 1, 2, 3],
          explain: "Playlists are repetitive text that compresses well, and RFC 8216 recommends gzip. Segments are already codec-compressed; compression changes `Content-Length`, makes ranges refer to compressed bytes, weakens ETags and disables Fastly Segmented Caching. It has nothing to do with CORS preflights.",
        },
        {
          kind: "reveal",
          prompt: "A web player adds an `X-Session` header to every segment request. Web rebuffering rises; apps are fine. What is happening, and what are two fixes?",
          visual: { kind: "flow", spec: { ...CORS, focus: ["safe", "pre", "ok", "safe>pre", "pre>ok"], flow: ["fetch>safe", "safe>pre", "pre>ok", "ok>get"] } },
          answer: "The custom header forces CORS preflights: extra `OPTIONS` round trips and edge requests, often per new URL. Apps do not enforce CORS, so only web suffers.\n\nFixes: move the value into a URL token; answer preflights at the edge with a long `Access-Control-Max-Age`; or drop the header.",
        },
        {
          kind: "reveal",
          prompt: "Which requests would you allow over TLS 1.3 0-RTT, and how can an origin refuse early data?",
          answer: "Allow it for idempotent GETs on segment and manifest hosts. Refuse it on license, playback API, entitlement and login hosts, because early data can be replayed.\n\nRFC 8470 defines `Early-Data: 1`, added by a proxy when it forwards early data, and **425 Too Early**, which forces the client to retry after the full handshake.",
        },
        {
          kind: "summary",
          title: "Key takeaways (1 of 2)",
          points: [
            "HTTP semantics (RFC 9110) and caching (RFC 9111) are separate from the wire version; HTTP/3 changes latency and loss behaviour, not the caching contract.",
            "HTTP/2 multiplexes but suffers TCP HOL blocking; HTTP/3 removes it, with real gains reported by Google and Akamai, but needs per-device measurement and UDP fallback.",
            "Status codes are failover design: a cached \"not yet\" 404 at a premiere is an outage. Make 403s explain themselves.",
            "Never rely on default TTLs (Fastly 2 minutes, CloudFront 24 hours); give the CDN its own lifetime with s-maxage, Surrogate-Control or CDN-Cache-Control.",
            "Immutable, versioned segment URLs with year-long TTLs are the base of high hit ratio; manifests and subtitle lists are the mutable layer.",
          ],
        },
        {
          kind: "summary",
          title: "Key takeaways (2 of 2)",
          points: [
            "stale-if-error and stale-while-revalidate are outage insurance, but CloudFront caps them at max TTL, and a min TTL above 0 overrides no-store.",
            "The cache key decides hit ratio: allowlist parameters, strip tokens and CMCD, keep Vary off segments, make validators identical across origins.",
            "Byte ranges need strong validators and range-aware caching on every CDN; never compress segments, do compress manifests and subtitles.",
            "TLS 1.3 gives 1-RTT handshakes and 0-RTT resumption; allow 0-RTT only on idempotent data-plane hosts. Certificates shrink to 47 days and OCSP is retiring, so automate.",
            "CORS is browser-only and can double requests: answer OPTIONS at the edge, add CORS after the cache, prefer `*` for token-protected segments.",
          ],
        },
      ],
    },
  ],
  sources: [
    "IETF, RFC 9110, \"HTTP Semantics\", 2022. https://www.rfc-editor.org/rfc/rfc9110.html",
    "IETF, RFC 9111, \"HTTP Caching\", 2022. https://www.rfc-editor.org/rfc/rfc9111.html",
    "IETF, RFC 9113, \"HTTP/2\", 2022. https://www.rfc-editor.org/rfc/rfc9113.html",
    "IETF, RFC 9114, \"HTTP/3\", 2022. https://www.rfc-editor.org/rfc/rfc9114.html",
    "IETF, RFC 9000, \"QUIC: A UDP-Based Multiplexed and Secure Transport\", 2021. https://www.rfc-editor.org/rfc/rfc9000.html",
    "IETF, RFC 8446, \"The Transport Layer Security (TLS) Protocol Version 1.3\", 2018. https://www.rfc-editor.org/rfc/rfc8446.html",
    "M. Nottingham, RFC 5861, \"HTTP Cache-Control Extensions for Stale Content\", 2010. https://www.rfc-editor.org/rfc/rfc5861.html",
    "S. Ludin, M. Nottingham, Y. Wu, RFC 9213, \"Targeted HTTP Cache Control\", 2022. https://www.rfc-editor.org/rfc/rfc9213.html",
    "IETF, RFC 8246, \"HTTP Immutable Responses\", 2017. https://www.rfc-editor.org/rfc/rfc8246.html",
    "IETF, RFC 8470, \"Using Early Data in HTTP\", 2018. https://www.rfc-editor.org/rfc/rfc8470.html",
    "R. Pantos, W. May, RFC 8216, \"HTTP Live Streaming\", 2017. https://datatracker.ietf.org/doc/html/rfc8216",
    "Fastly documentation, \"Cache freshness and TTLs\". https://www.fastly.com/documentation/guides/concepts/edge-state/cache/cache-freshness/",
    "Fastly documentation, \"Segmented Caching\". https://www.fastly.com/documentation/guides/full-site-delivery/caching/segmented-caching/",
    "Amazon CloudFront Developer Guide, \"Manage how long content stays in the cache (expiration)\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html",
    "Amazon CloudFront Developer Guide, \"How CloudFront processes partial requests for an object (range GETs)\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RangeGETs.html",
    "Amazon CloudFront Developer Guide, \"Serve compressed files\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html",
    "Amazon CloudFront Developer Guide, \"Choose how CloudFront serves HTTPS requests\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-https-dedicated-ip-or-sni.html",
    "Cloudflare blog, \"Introducing Zero Round Trip Time Resumption (0-RTT)\", March 2017. https://blog.cloudflare.com/introducing-0-rtt/",
    "Cloudflare blog, \"The 2025 Cloudflare Radar Year in Review\", December 2025. https://blog.cloudflare.com/radar-2025-year-in-review",
    "A. Langley et al., \"The QUIC Transport Protocol: Design and Internet-Scale Deployment\", ACM SIGCOMM 2017. https://research.google/pubs/the-quic-transport-protocol-design-and-internet-scale-deployment/",
    "Akamai blog, J. Chaves Herrera, \"Deliver Fast, Reliable, Secure Web Experiences with HTTP/3\", May 2023. https://www.akamai.com/blog/performance/deliver-fast-reliable-secure-web-experiences-http3",
    "Let's Encrypt, \"Ending OCSP Support in 2025\", December 2024. https://letsencrypt.org/2024/12/05/ending-ocsp/",
    "The SSL Store, \"Industry to Shift to 47-Day SSL/TLS Certificate Validity by 2029\" (summary of CA/Browser Forum ballot SC-081), 2025. https://thesslstore.com/blog/47-day-ssl-certificate-validity-by-2029",
    "MDN Web Docs, \"Access-Control-Max-Age\". https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age",
    "WHATWG, \"Fetch Standard\" (CORS protocol and safelisted request headers). https://fetch.spec.whatwg.org/",
    "Engadget, \"Netflix explains how and why it's switching to HTTPS streaming\", August 2016, and R. Stewart, S. Long, \"Improving High-Bandwidth TLS in the FreeBSD Kernel\", 2016. https://www.engadget.com/2016/08/09/netflix-https/ and https://freebsdfoundation.org/wp-content/uploads/2016/10/Improving-High-Bandwidth-TLS-in-the-FreeBSd-Kernel.pdf",
    "Broadband TV News, \"Crunchyroll reaches 21 million subscribers\", May 2026, and The Streamable, \"Crunchyroll 17 million subscribers\", 2025. https://www.broadbandtvnews.com/2026/05/11/crunchyroll-reaches-21-million-subscribers/ and https://thestreamable.com/crunchyroll-17-million-subscribers-q1-2025",
    "Mux blog, \"Low Latency HLS 2: Judgment Day\", January 2020. https://mux.com/blog/low-latency-hls-part-2/",
    "Consumer Technology Association, CTA-5004, \"Common Media Client Data\", 2020. https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf",
    "IETF, RFC 8555, \"Automatic Certificate Management Environment (ACME)\", 2019. https://www.rfc-editor.org/rfc/rfc8555.html",
    "NeurIPS 2023 Datasets and Benchmarks paper on HTTP/3 streaming QoE measurements. https://papers.neurips.cc/paper_files/paper/2023/file/f5da8ac52cf8857157c63c4803b6690b-Paper-Datasets_and_Benchmarks.pdf",
    "Amazon CloudFront Developer Guide, \"How CloudFront processes HTTP 4xx and 5xx status codes from your origin\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HTTPStatusCodes.html",
    "Let's Encrypt, \"DST Root CA X3 Expiration (September 2021)\". https://letsencrypt.org/docs/dst-root-ca-x3-expiration-september-2021/",
  ],
};

export default chapter;
