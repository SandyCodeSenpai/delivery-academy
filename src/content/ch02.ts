import type { Chapter, FlowSpec, SequenceSpec } from "./types";

// Chapter 2 content. Source: chapters/02-internet-and-networking.md

/* ---------- Shared visuals (repeated with different focus to build ideas up) ---------- */

// Book 2.3 mermaid: one CDN reachable over two paths.
const bgpPaths: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "viewer", label: "Viewer", sub: "Sao Paulo, AS 64500", kind: "viewer", col: 0, row: 1 },
    { id: "isp", label: "ISP border router", kind: "router", col: 1, row: 1 },
    { id: "edge", label: "CDN edge", sub: "Sao Paulo, AS 64510", kind: "edge", col: 2, row: 0 },
    { id: "transit", label: "Transit provider", sub: "AS 64520", kind: "isp", col: 2, row: 2 },
    { id: "miami", label: "CDN PoP", sub: "Miami, AS 64510", kind: "pop", col: 3, row: 2 },
    { id: "shield", label: "CDN shield", kind: "shield", col: 3, row: 0 },
    { id: "origin", label: "Cloud origin", sub: "AS 16509", kind: "origin", col: 4, row: 0 },
  ],
  edges: [
    { from: "viewer", to: "isp", both: true },
    { from: "isp", to: "edge", label: "peering at IX.br" },
    { from: "isp", to: "transit", label: "paid transit" },
    { from: "transit", to: "miami" },
    { from: "edge", to: "shield", label: "cache miss", dashed: true },
    { from: "shield", to: "origin", label: "backbone/transit", dashed: true },
  ],
};

// Illustration of anycast: many PoPs announce the same prefix.
const anycast: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "vjp", label: "Viewer in Japan", kind: "viewer", col: 0, row: 0 },
    { id: "vde", label: "Viewer in Germany", kind: "viewer", col: 0, row: 2 },
    { id: "tok", label: "PoP Tokyo", kind: "pop", col: 2, row: 0, badge: "same /24" },
    { id: "fra", label: "PoP Frankfurt", kind: "pop", col: 2, row: 2, badge: "same /24" },
    { id: "mia", label: "PoP Miami", kind: "pop", col: 2, row: 1, badge: "same /24" },
  ],
  edges: [
    { from: "vjp", to: "tok", label: "BGP best path" },
    { from: "vde", to: "fra", label: "BGP best path" },
    { from: "vde", to: "mia", dashed: true, label: "after withdrawal" },
  ],
};

// Book 2.5 mermaid: caches inside ISPs.
const embedded: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "orig", label: "Origin and fill", kind: "origin", col: 1, row: 0 },
    { id: "emb", label: "Embedded cache", sub: "inside the ISP", kind: "cache", col: 0, row: 1 },
    { id: "ixc", label: "Cache cluster", sub: "at IXP or colo", kind: "cache", col: 1, row: 1 },
    { id: "tr", label: "Transit path", kind: "isp", col: 2, row: 1 },
    { id: "users", label: "Viewers", sub: "in that ISP", kind: "viewer", col: 1, row: 2 },
  ],
  edges: [
    { from: "orig", to: "emb", label: "off-peak fill" },
    { from: "orig", to: "ixc" },
    { from: "orig", to: "tr" },
    { from: "emb", to: "users" },
    { from: "ixc", to: "users", label: "PNI or IXP" },
    { from: "tr", to: "users", label: "last resort", dashed: true },
  ],
};

// Book 2.9 sequence: new connection, handshake, slow start.
const tcpSeq: SequenceSpec = {
  actors: [
    { id: "p", label: "Player", kind: "player" },
    { id: "e", label: "CDN edge", kind: "edge" },
  ],
  messages: [
    { from: "p", to: "e", label: "TCP SYN", note: "RTT 1 starts" },
    { from: "e", to: "p", label: "SYN-ACK", dashed: true },
    { from: "p", to: "e", label: "ACK + TLS ClientHello", note: "RTT 2 starts" },
    { from: "e", to: "p", label: "TLS ServerHello, cert, Finished", dashed: true },
    { from: "p", to: "e", label: "TLS Finished + GET segment 1", note: "RTT 3 starts", tone: "accent" },
    { from: "e", to: "p", label: "First bytes, small window", dashed: true, tone: "warn" },
    { from: "e", to: "p", label: "More bytes, window doubles each RTT", dashed: true, tone: "good" },
    { from: "p", to: "e", label: "GET segment 2, same connection", tone: "good" },
  ],
};

// Book 2.12 mermaid: the chain from loss to a spinner.
const lossChain: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "loss", label: "Packet loss", kind: "generic", col: 1, row: 0, tone: "bad" },
    { id: "retx", label: "Resend, cwnd down", kind: "generic", col: 0, row: 1 },
    { id: "tail", label: "Tail or burst loss", kind: "generic", col: 2, row: 1, tone: "warn" },
    { id: "thr", label: "Lower throughput", sub: "for this segment", kind: "generic", col: 0, row: 2 },
    { id: "rto", label: "RTO: flow pauses", sub: "then small window", kind: "generic", col: 2, row: 2, tone: "warn" },
    { id: "dec", label: "Slower than play?", sub: "download > duration", kind: "generic", col: 0, row: 3 },
    { id: "ok", label: "Buffer healthy", kind: "player", col: 0, row: 4, tone: "good" },
    { id: "drain", label: "Buffer drains", kind: "player", col: 1, row: 4, tone: "warn" },
    { id: "abr", label: "ABR steps down", sub: "lower bitrate", kind: "player", col: 1, row: 5 },
    { id: "stall", label: "Rebuffering", sub: "if buffer hits zero", kind: "player", col: 2, row: 5, tone: "bad" },
  ],
  edges: [
    { from: "loss", to: "retx" },
    { from: "retx", to: "thr" },
    { from: "thr", to: "dec" },
    { from: "dec", to: "ok", label: "no" },
    { from: "dec", to: "drain", label: "yes" },
    { from: "drain", to: "abr" },
    { from: "drain", to: "stall" },
    { from: "loss", to: "tail" },
    { from: "tail", to: "rto" },
    { from: "rto", to: "drain" },
  ],
};

// Book 2.13 mermaid: multi-cloud origins and the networks between them.
const clouds: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "s3b", label: "S3 replica", sub: "second region", kind: "storage", col: 0, row: 0 },
    { id: "s3", label: "S3 origin", sub: "us-east-1", kind: "storage", col: 1, row: 0 },
    { id: "gcs", label: "GCS origin", kind: "storage", col: 3, row: 0 },
    { id: "cf", label: "CloudFront shield", kind: "shield", col: 0, row: 2 },
    { id: "fs", label: "Fastly shield", kind: "shield", col: 2, row: 2 },
    { id: "mc", label: "Media CDN", kind: "cdn", col: 3, row: 2 },
    { id: "v", label: "Viewers", sub: "via edges and ISPs", kind: "viewer", col: 2, row: 3 },
  ],
  edges: [
    { from: "s3", to: "s3b", label: "replication" },
    { from: "s3", to: "gcs", label: "cross-cloud link", both: true },
    { from: "cf", to: "s3", label: "AWS backbone" },
    { from: "fs", to: "s3", label: "peering/private" },
    { from: "mc", to: "gcs", label: "Google backbone" },
    { from: "cf", to: "v" },
    { from: "fs", to: "v" },
    { from: "mc", to: "v" },
  ],
  groups: [
    { id: "aws", label: "AWS", nodes: ["s3", "s3b"] },
    { id: "gcp", label: "Google Cloud", nodes: ["gcs"] },
  ],
};

const chapter: Chapter = {
  n: 2,
  title: "Internet and Networking Foundations for Delivery",
  short: "Networking",
  part: 2,
  hook: "Video is just packets. Here is how they cross tens of thousands of networks to reach a phone on a train.",
  lessons: [
    /* ======================= L1 ======================= */
    {
      id: "ch02-l1",
      title: "A download with a clock",
      goal: "Name the three network properties that decide video quality, and read IP prefixes and packet sizes.",
      minutes: 8,
      steps: [
        {
          kind: "quiz",
          prompt: "A player needs about 4 seconds of video every 4 seconds. The network delivers each 4-second piece in 5 seconds. What happens?",
          options: [
            "The buffer drains and the viewer sees a spinner",
            "Nothing, the server speeds up on its own",
            "The video plays fine, only the audio is late",
            "The player waits once at the start, then it is fine",
          ],
          answer: 0,
          explain: "A video stream is a long download that must **keep pace with a clock**. If the network delivers more slowly than the video plays, the buffer drains and the viewer sees a spinner. This is true for the whole episode, not only at the start.",
        },
        {
          kind: "read",
          title: "A web page waits once. Video waits all the time.",
          body:
            "A web page is a few hundred kilobytes, and the user waits once.\n\n" +
            "A video session moves gigabytes. The user \"waits\" all the time, because every [[segment]] must arrive before the buffer runs out. It must do this through every network between the viewer and the server.\n\n" +
            "So most of a media delivery engineer's work depends on how the internet moves bytes.",
        },
        {
          kind: "read",
          title: "Three properties decide it",
          body:
            "- **Distance** ([[round-trip time|RTT]]): how long a packet takes to go to the server and back.\n" +
            "- **Capacity** (bandwidth): how many bits per second the *narrowest* link on the path can carry.\n" +
            "- **Loss**: how often packets are dropped and must be sent again.\n\n" +
            "The rest of this chapter shows how each one appears, who controls it, and what a delivery team can do about it.",
          visual: {
            kind: "stats",
            items: [
              { value: "Distance", label: "Round-trip time" },
              { value: "Capacity", label: "Narrowest link" },
              { value: "Loss", label: "Dropped packets" },
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each network property to what it measures.",
          pairs: [
            ["Distance (RTT)", "Time for a packet to reach the server and come back"],
            ["Capacity (bandwidth)", "Bits per second the narrowest link can carry"],
            ["Loss", "How often packets are dropped and resent"],
          ],
          explain: "These three properties decide whether every segment arrives before the buffer runs out.",
        },
        {
          kind: "number",
          prompt: "At a big simulcast premiere, assume about 2M concurrent streams at about 4 Mbps average. What is the total egress?",
          answer: 8,
          tolerance: 0.5,
          unit: "Tbps",
          hint: "2,000,000 x 4 Mbps. 1 Tbps = 1,000,000 Mbps.",
          explain: "2,000,000 x 4 Mbps = 8,000,000 Mbps = about **8 Tbps** (assumed). The book designs for about **12 Tbps** with headroom. Monthly delivered bytes are about 540 PB (assumed).",
        },
        {
          kind: "read",
          title: "8 Tbps is not one pipe",
          body:
            "Crunchyroll says it serves 100M+ fans in 200+ countries and territories.\n\n" +
            "So 8 Tbps is millions of flows. They end inside thousands of ISP networks. The job is to put each flow on a short, uncongested path into the right ISP.",
          visual: {
            kind: "stats",
            items: [
              { value: "~2M", label: "Concurrent streams", note: "premiere, assumed" },
              { value: "~8 Tbps", label: "Peak egress", note: "design for ~12 Tbps" },
              { value: "~540 PB", label: "Delivered per month", note: "assumed" },
            ],
          },
          callout: {
            type: "staff",
            text: "When someone says \"we need 12 Tbps,\" ask three questions. Into which networks (ASNs)? At which hours in each time zone? Over which interconnects? A global number hides the real bottleneck, which is almost always one specific link into one specific ISP at that ISP's evening peak.",
          },
        },
        {
          kind: "read",
          title: "Addresses and prefixes",
          body:
            "Every device on the internet has an **IP address**. **IPv4** addresses are 32 bits, written as four numbers, like 203.0.113.10. **IPv6** addresses are 128 bits.\n\n" +
            "Routers do not keep one entry per address. They group addresses into **prefixes**, written with a slash. 203.0.113.0/24 means \"the first 24 bits are fixed\", so it covers 256 addresses.\n\n" +
            "A /24 is the smallest IPv4 prefix that most networks accept from others on the public internet.",
        },
        {
          kind: "read",
          title: "Longest prefix match",
          body:
            "When a router forwards a packet, it uses **longest prefix match**: the most specific prefix wins.\n\n" +
            "If a router knows both 203.0.0.0/16 and 203.0.113.0/24, a packet for 203.0.113.10 follows the /24.\n\n" +
            "Remember this rule. It explains how traffic engineering works, and also how route hijacks work.",
          visual: {
            kind: "table",
            headers: ["Prefix known", "Fixed bits", "Covers 203.0.113.10?", "Chosen?"],
            rows: [
              ["203.0.0.0/16", "16", "Yes", "No"],
              ["203.0.113.0/24", "24", "Yes", "Yes, more specific"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "A router learns 198.51.0.0/16 from neighbor A and 198.51.100.0/24 from neighbor B. Where does a packet for 198.51.100.7 go?",
          options: [
            "Neighbor A, because its prefix covers more addresses",
            "Neighbor B, because its prefix is more specific",
            "Both, split half and half",
            "Whichever neighbor announced first",
          ],
          answer: 1,
          explain: "**Longest prefix match**: the /24 has more fixed bits, so it is more specific and wins. A bigger prefix does not win. This same rule is what makes route hijacks with a more-specific prefix so effective.",
        },
        {
          kind: "read",
          title: "IPv6 matters",
          body:
            "In 2025, Cloudflare reported that about **29 percent** of requests for content reached it over IPv6, up from 28 percent in 2024.\n\n" +
            "A per-ISP dashboard that only parses IPv4 addresses will quietly hide many mobile viewers.",
          callout: {
            type: "mistake",
            text: "Building delivery dashboards that only understand IPv4. About 29 percent of content requests to Cloudflare came over IPv6 in 2025, and many of them are mobile viewers.",
          },
        },
        {
          kind: "read",
          title: "Packets, MTU and MSS",
          body:
            "Data moves as **packets**: headers plus payload. The largest packet a link can carry is the [[MTU]] (maximum transmission unit), usually **1,500 bytes**.\n\n" +
            "After 40 bytes of IPv4 and TCP headers, a packet carries about **1,460 bytes** of data. This is the **MSS** (maximum segment size).\n\n" +
            "Careful: \"segment\" here is a TCP term, not a video segment.",
          visual: {
            kind: "stats",
            items: [
              { value: "1,500 B", label: "Typical MTU" },
              { value: "40 B", label: "IPv4 + TCP headers" },
              { value: "1,460 B", label: "MSS (data per packet)" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "A video segment is 2.5 MB. Each packet carries about 1,460 bytes of data. About how many packets does the segment need?",
          answer: 1700,
          tolerance: 100,
          unit: "packets",
          hint: "2,500,000 / 1,460",
          explain: "2,500,000 / 1,460 = about **1,700 packets**. Any one of them can be delayed or dropped, and the segment is not complete until all of them arrive.",
        },
        {
          kind: "summary",
          points: [
            "Video is a long download that must keep pace with the play clock.",
            "Three properties decide quality: distance (RTT), capacity (narrowest link) and loss.",
            "8 Tbps (assumed) is millions of flows into thousands of ISPs, not one pipe.",
            "Routers forward by longest prefix match: the most specific prefix wins.",
            "MTU is usually 1,500 bytes, so MSS is about 1,460 bytes; a 2.5 MB segment is about 1,700 packets.",
          ],
        },
      ],
    },

    /* ======================= L2 ======================= */
    {
      id: "ch02-l2",
      title: "BGP and anycast",
      goal: "Explain how autonomous systems choose routes with BGP, how BGP breaks, and what anycast trades off.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "A link between two networks is full every night at 9 p.m. Will the internet's routing protocol move traffic away from it by itself?",
          options: [
            "Yes, routing measures congestion and avoids full links",
            "No, routing picks paths by policy and path length, not congestion",
            "Yes, but only when loss goes above 1 percent",
            "Only if the link is inside one cloud provider",
          ],
          answer: 1,
          explain: "**BGP picks routes by policy and AS-path length, not by measured latency, loss or congestion.** It does not know that a link is full at 9 p.m. CDNs, RUM-based steering and multi-CDN exist partly to fix choices that BGP makes blindly.",
        },
        {
          kind: "read",
          title: "The internet is many networks",
          body:
            "The internet is not one network. It is tens of thousands of independent networks that agree to exchange traffic.\n\n" +
            "Each one is an [[autonomous system|AS (Autonomous System)]] (AS): a set of IP prefixes under one routing policy, run by one organization. Each AS has a number, the [[ASN]].\n\n" +
            "Amazon's main ASN is **16509**. Comcast, Deutsche Telekom, Reliance Jio, Fastly and Akamai all have their own.",
        },
        {
          kind: "read",
          title: "How big is the routing table?",
          body:
            "Geoff Huston's annual report says that in January 2026 the global routing tables looked like this.\n\n" +
            "Your viewers sit inside a long tail of those ASNs. This is why **error rate by ASN** is one of the most useful views in delivery observability (Chapter 11).",
          visual: {
            kind: "stats",
            items: [
              { value: "~1,050,000", label: "IPv4 prefixes", note: "Jan 2026" },
              { value: "~77,900", label: "ASNs announcing IPv4" },
              { value: "~241,800", label: "IPv6 prefixes" },
              { value: "~36,100", label: "ASNs announcing IPv6" },
            ],
          },
        },
        {
          kind: "read",
          title: "What BGP does",
          body:
            "[[BGP]] (Border Gateway Protocol) is how autonomous systems tell each other which prefixes they can reach.\n\n" +
            "Two neighboring ASes open a BGP session between their **border routers**. Each side then sends:\n\n" +
            "- **Announcements**: \"I can reach 203.0.113.0/24, and the path is AS 64500, then AS 64501.\"\n" +
            "- **Withdrawals**: \"I can no longer reach it.\"",
        },
        {
          kind: "quiz",
          prompt: "A network's link to a prefix breaks, so it can no longer reach 203.0.113.0/24. What does it send to its BGP neighbors?",
          options: ["An announcement with a longer AS path", "A withdrawal", "A DNS update", "Nothing; neighbors notice on their own"],
          answer: 1,
          explain: "It sends a **withdrawal**: \"I can no longer reach it.\" Announcements say what you *can* reach, with the AS path. Withdrawals take routes away, and as Facebook showed in 2021, they can take a whole company offline.",
        },
        {
          kind: "read",
          title: "Path vector, and how a route is chosen",
          body:
            "BGP is a **path-vector** protocol. Every announcement carries the **AS path**, the list of ASes the route passed through. This prevents loops and helps choose between routes.\n\n" +
            "To pick among routes for one prefix, a router looks roughly at:\n\n" +
            "- **Local preference**, set by policy. It usually prefers paying customers, then peers, then transit providers. This rule is about money.\n" +
            "- **Shortest AS path.**\n" +
            "- MED, internal cost to the exit, and tie-breakers.",
        },
        {
          kind: "order",
          prompt: "Put BGP's route choice in order, from the first thing a router checks to the last.",
          items: [
            "Local preference (policy: customers, then peers, then transit)",
            "Shortest AS path",
            "MED and internal cost to the exit",
            "Tie-breakers",
          ],
          explain: "Policy comes first, then AS-path length, then MED, internal cost and tie-breakers. Notice what is missing: latency, loss and congestion are not on the list.",
        },
        {
          kind: "read",
          title: "One CDN, two paths",
          body:
            "A viewer in Sao Paulo is on ISP AS 64500. The same CDN (AS 64510) is reachable two ways.\n\n" +
            "The good path: the ISP **peers** with the CDN at the IX.br exchange and reaches a CDN edge in Sao Paulo.",
          visual: {
            kind: "flow",
            spec: { ...bgpPaths, focus: ["viewer", "isp", "edge", "viewer>isp", "isp>edge"], flow: ["viewer>isp", "isp>edge"] },
            caption: "The peering path to a local edge",
          },
        },
        {
          kind: "quiz",
          prompt: "The ISP's local preference prefers the paid transit path. Where do these Sao Paulo viewers get served from?",
          visual: {
            kind: "flow",
            spec: { ...bgpPaths, focus: ["viewer", "isp", "transit", "miami", "viewer>isp", "isp>transit", "transit>miami"], flow: ["viewer>isp", "isp>transit", "transit>miami"] },
          },
          options: [
            "The local Sao Paulo edge, because it is closer",
            "The Miami PoP, through the transit provider",
            "The cloud origin directly",
            "BGP splits them evenly across both paths",
          ],
          answer: 1,
          explain: "BGP follows **policy** first. If the ISP prefers the transit path, viewers get the slower path to Miami even though a local edge exists. Distance does not enter the decision.",
        },
        {
          kind: "read",
          title: "Not a code change",
          body:
            "Fixing that path is a conversation between the CDN's **peering team** and the ISP, not a code change.\n\n" +
            "The diagram also shows the miss path. On a cache miss, the edge asks a CDN shield, and the shield fetches from the cloud origin (AS 16509) over a backbone or transit.",
          visual: {
            kind: "flow",
            spec: { ...bgpPaths, focus: ["edge", "shield", "origin", "edge>shield", "shield>origin"], flow: ["edge>shield", "shield>origin"] },
            caption: "On a cache miss: edge to shield to cloud origin",
          },
        },
        {
          kind: "read",
          title: "How BGP breaks: hijacks and leaks",
          body:
            "BGP trusts what neighbors say.\n\n" +
            "On 24 February 2008, Pakistan Telecom (AS17557) announced 208.65.153.0/24, a more-specific part of YouTube's address space, to block YouTube inside Pakistan. Its upstream PCCW (AS3491) passed it to the world. Much of the internet sent YouTube traffic to Pakistan until PCCW withdrew the routes about two hours later.\n\n" +
            "The modern defense is **RPKI** with **route origin validation**: owners sign which ASN may originate their prefixes, and networks drop announcements that do not match.",
        },
        {
          kind: "quiz",
          prompt: "In 2008, why did much of the internet send YouTube traffic to Pakistan Telecom?",
          options: [
            "Pakistan Telecom had a shorter AS path to everyone",
            "Its /24 was more specific than YouTube's own announcement, so longest prefix match chose it",
            "YouTube's DNS pointed to Pakistan",
            "PCCW changed its local preference for YouTube",
          ],
          answer: 1,
          explain: "The bad announcement was a **more-specific** /24 inside YouTube's space. Routers forward by **longest prefix match**, so once PCCW passed it on, the bad /24 beat YouTube's own route. RPKI route origin validation is the modern defense.",
        },
        {
          kind: "read",
          title: "How BGP breaks: withdrawals",
          body:
            "On 4 October 2021, a maintenance command cut Facebook's data centers off from its backbone.\n\n" +
            "Facebook's DNS servers were designed to withdraw their BGP announcements when they could not reach the data centers. They did so. Facebook, Instagram and WhatsApp were unreachable for about **six hours**.",
          callout: {
            type: "mistake",
            text: "Treating \"the internet\" as a reliable black box between your CDN and your viewers. BGP changes happen all day. A route change can move a whole ISP's viewers from a nearby PoP to a distant one in seconds, and your dashboards will show it as \"rebuffering up in one country on one ISP,\" not as \"BGP.\"",
          },
        },
        {
          kind: "read",
          title: "Anycast: one address, many places",
          body:
            "With [[anycast]], many servers in many locations announce the **same** prefix over BGP.\n\n" +
            "Each user's packets go to whichever location BGP considers \"closest\" from the user's network. That means best by BGP policy and AS-path length. This usually, but not always, matches geography.",
          visual: {
            kind: "flow",
            spec: { ...anycast, focus: ["vjp", "vde", "tok", "fra", "vjp>tok", "vde>fra"], flow: ["vjp>tok"] },
            caption: "Every PoP announces the same prefix",
          },
        },
        {
          kind: "quiz",
          prompt: "Three PoPs announce the same anycast prefix. Which PoP receives a given viewer's packets?",
          visual: { kind: "flow", spec: { ...anycast, focus: ["vde", "fra", "mia", "vde>fra"] } },
          options: [
            "Always the PoP nearest on a map",
            "The one BGP considers best from the viewer's network, by policy and AS-path length",
            "The one with the most free capacity right now",
            "A random PoP for each packet",
          ],
          answer: 1,
          explain: "Anycast follows **BGP's** idea of \"closest\": policy and AS-path length from the viewer's network. That usually matches geography, but not always, and it never considers free capacity.",
        },
        {
          kind: "read",
          title: "Where anycast is used",
          body:
            "- **DNS.** Almost all large authoritative DNS services and public resolvers are anycast (Chapter 3).\n" +
            "- **CDN edges.** Some CDNs, notably Cloudflare, put the same addresses on every PoP and let BGP spread users. Others hand out PoP-specific addresses through DNS.\n" +
            "- **Cloud front doors.** AWS Global Accelerator gives each application two static anycast IP addresses, announced from many AWS edge locations. It then carries traffic over the AWS backbone to the regional endpoint.",
        },
        {
          kind: "read",
          title: "Anycast trade-offs",
          body:
            "Anycast is simple and fails over fast: if a PoP withdraws its announcement, BGP sends users to the next one. It also spreads DDoS traffic across sites.\n\n" +
            "But you do not fully control the **catchment**: an ISP's policy can send users to a PoP on another continent. A BGP shift mid-session can move a TCP connection to a PoP with no state for it (rare; players retry the segment). And load is hard to steer finely, because a change moves whole networks at once.",
          visual: {
            kind: "flow",
            spec: { ...anycast, focus: ["vde", "mia", "fra", "vde>mia"], flow: ["vde>mia"] },
            caption: "Frankfurt withdraws, BGP moves users to the next PoP",
          },
          callout: {
            type: "staff",
            text: "\"Anycast or DNS steering?\" is a classic design-review question. Anycast gives fast, automatic failover and simplicity. DNS steering gives fine control per resolver or subnet, but depends on TTLs and resolver behavior. Big CDNs mix both. Remember that anycast inherits all of BGP's blindness to congestion.",
          },
        },
        {
          kind: "multi",
          prompt: "Which statements about anycast are true? Select all that apply.",
          options: [
            "Failover is fast: withdraw the announcement and BGP moves users",
            "It spreads DDoS traffic across many sites",
            "You control exactly which PoP each ISP's users reach",
            "A BGP shift can move a live TCP connection to a PoP with no state for it",
            "It routes around congested links automatically",
          ],
          answers: [0, 1, 3],
          explain: "Anycast fails over fast and spreads DDoS load. But the **catchment** is decided by other networks' BGP policy, not by you, and anycast is as blind to congestion as BGP itself. Mid-session moves are rare, and players recover by retrying a segment.",
        },
        {
          kind: "reveal",
          prompt: "A platform like Crunchyroll likely does not run its own global BGP backbone. So where does BGP still matter for its delivery team? Think first.",
          answer:
            "In two places. (1) How well each CDN connects into each ISP (Chapter 9). (2) How CDN shields reach the cloud origins in AWS and GCP (Section 2.13).\n\n" +
            "Viewers reach Crunchyroll through CDN vendors' networks, and origins sit in AWS and GCP. The team must read traceroutes and AS paths, but will rarely configure a BGP session.",
        },
        {
          kind: "summary",
          points: [
            "The internet is about 78,000 ASes (Jan 2026) exchanging routes with BGP.",
            "BGP chooses by policy (local preference) and AS-path length, not by latency, loss or congestion.",
            "Hijacks use more-specific prefixes (YouTube 2008); RPKI route origin validation defends.",
            "Withdrawals can take a company offline (Facebook 2021, about six hours).",
            "Anycast: same prefix everywhere, fast failover, but you do not control the catchment.",
          ],
        },
      ],
    },

    /* ======================= L3 ======================= */
    {
      id: "ch02-l3",
      title: "Transit, peering and caches in ISPs",
      goal: "Compare transit, IXP peering, PNIs and embedded caches, and say which one serves video best.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "Two networks agree to exchange traffic directly, and neither pays the other. Why would both sides agree?",
          options: [
            "Both save transit cost, and users get a shorter path",
            "A regulator forces every network to do it",
            "Only one side benefits; the other does it for goodwill",
            "It lets them avoid BGP entirely",
          ],
          answer: 0,
          explain: "This is **settlement-free peering**. Both sides save the transit money they would otherwise pay, and their users get a shorter path. They still use BGP over the link.",
        },
        {
          kind: "read",
          title: "Transit: paid reach to everyone",
          body:
            "[[IP transit|Transit]] is a paid route to the whole internet, usually billed per Mbps (Chapter 16). Networks that reach everyone without buying transit are called **Tier 1**.\n\n" +
            "Transit reaches everyone. But it adds a network you do not control. Its links into the destination ISP can congest at peak. And every bit costs money.",
        },
        {
          kind: "quiz",
          prompt: "What do we call networks that can reach the whole internet without buying transit from anyone?",
          options: ["Tier 1 networks", "Eyeball ISPs", "Internet Exchange Points", "Content networks"],
          answer: 0,
          explain: "**Tier 1** networks reach everyone without buying transit. Everyone else buys transit for at least part of the internet, usually billed per Mbps.",
        },
        {
          kind: "read",
          title: "Peering: direct, and usually free",
          body:
            "[[Peering]] is when two networks exchange traffic directly, only for each other's own customers.\n\n" +
            "Most peering is **settlement-free**: neither side pays, because both save transit cost and viewers get a shorter path.\n\n" +
            "Peering has two physical forms: public peering at an IXP, and private peering with a PNI.",
        },
        {
          kind: "read",
          title: "Public peering at an IXP",
          body:
            "An [[IXP]] (Internet Exchange Point) is a shared switching fabric, usually in a carrier-neutral data center. Many networks connect one port, then set up BGP sessions with each other across it. One port can reach hundreds of peers.\n\n" +
            "Large IXPs are big. DE-CIX Frankfurt hit a record peak on 9 December 2025, a UEFA Champions League matchday.",
          visual: {
            kind: "stats",
            items: [
              { value: "18.73 Tbps", label: "DE-CIX Frankfurt peak", note: "9 Dec 2025" },
              { value: "26.99 Tbps", label: "DE-CIX worldwide peak", note: "same evening" },
            ],
          },
        },
        {
          kind: "read",
          title: "Private peering: the PNI",
          body:
            "A [[PNI]] (Private Network Interconnect) is a dedicated cable, a **cross-connect**, between two networks' routers in the same building. It carries only their traffic.\n\n" +
            "A PNI is used when traffic between two networks is large enough to fill one or more 100 Gbps or 400 Gbps ports.\n\n" +
            "AWS said in 2023 that it peers with ISPs over IXPs or PNIs, had **440+** peering locations on six continents, and was rolling out 400 GbE. Its aim: connect to ISPs \"as locally and closely to their market as possible\".",
        },
        {
          kind: "quiz",
          prompt: "Traffic between your CDN and one large ISP now fills several 100 Gbps ports in the same building. Which interconnect fits best?",
          options: [
            "Buy more transit",
            "A PNI: dedicated cross-connects between the two routers",
            "Add a bigger port at the IXP and share it with everyone",
            "Anycast",
          ],
          answer: 1,
          explain: "When traffic between two networks fills one or more 100 or 400 Gbps ports, a **PNI** gives dedicated capacity that carries only their traffic. An IXP port is shared with every peer on it.",
        },
        {
          kind: "read",
          title: "Four ways to reach an ISP",
          body: "The more direct the interconnect, the more control you have over capacity, and usually the better the QoE and the lower the cost.",
          visual: {
            kind: "table",
            headers: ["Interconnect", "Who pays", "Reach", "Capacity control", "Typical use in video"],
            rows: [
              ["IP transit", "You pay the provider", "Whole internet", "Low, depends on provider's links into each ISP", "Fallback, long tail of small ISPs"],
              ["Public peering at IXP", "Usually nobody (port fees only)", "Only peers at that IXP", "Medium, shared port", "Mid-size ISPs, regional reach"],
              ["PNI", "Usually nobody (cross-connect cost)", "One network", "High, dedicated ports", "Large eyeball ISPs"],
              ["Embedded cache in ISP", "Cache owner provides hardware", "One ISP's users", "Very high, inside the ISP", "Biggest video platforms and CDNs"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each interconnect to its typical use in video.",
          pairs: [
            ["IP transit", "Fallback and the long tail of small ISPs"],
            ["Public peering at an IXP", "Mid-size ISPs, regional reach"],
            ["PNI", "Large eyeball ISPs"],
            ["Embedded cache", "Biggest video platforms and CDNs"],
          ],
          explain: "Transit reaches everyone but gives little capacity control. An IXP port is shared. A PNI is dedicated to one network. An embedded cache sits inside the ISP, so popular bytes never cross an interconnect.",
        },
        {
          kind: "number",
          prompt: "Our assumed design peak is about 12 Tbps. The largest IXP in Europe peaked at 18.73 Tbps. What percent of that record peak is our design peak?",
          answer: 64,
          tolerance: 3,
          unit: "%",
          hint: "12 / 18.73 x 100",
          explain: "12 / 18.73 = about **64 percent**. One popular simulcast, if it all went through public exchanges, would be a large fraction of the biggest exchange in Europe.",
        },
        {
          kind: "read",
          title: "Why public peering is not enough",
          body:
            "Serious video delivery cannot rely on public peering alone.\n\n" +
            "It needs PNIs into the biggest ISPs, and caches inside them. That is what the large CDNs sell.",
          callout: {
            type: "staff",
            text: "Compare the numbers. Our assumed design peak is about 12 Tbps. The largest single IXP in Europe peaked at 18.73 Tbps in late 2025. A single popular simulcast through public exchanges would be a large fraction of the biggest exchange in the world. That is why video needs PNIs and embedded caches.",
          },
        },
        {
          kind: "read",
          title: "Hot potato and cold potato",
          body:
            "When two networks meet in many cities, there are two ways to hand traffic over.\n\n" +
            "Google Cloud sells this choice as a product: **Premium Tier** (cold potato) and **Standard Tier** (hot potato, cheaper).\n\n" +
            "The same idea explains why \"CloudFront in front of S3\" or \"Media CDN in front of GCS\" can behave very differently from a third-party CDN fetching from a cloud origin over the public internet.",
          visual: {
            kind: "compare",
            left: { title: "Hot potato", points: ["Hand traffic over at the nearest exit", "Saves your own backbone", "Google Standard Tier, cheaper"] },
            right: { title: "Cold potato", points: ["Carry traffic on your own backbone as far as possible", "Hand over near the destination", "Google Premium Tier"] },
          },
        },
        {
          kind: "quiz",
          prompt: "Google Cloud's Premium Tier keeps traffic on Google's backbone and enters or exits near the user. Which routing style is that?",
          options: ["Hot-potato routing", "Cold-potato routing", "Anycast routing", "Transit routing"],
          answer: 1,
          explain: "**Cold potato**: carry the traffic on your own backbone as long as possible. Standard Tier uses **hot potato**: hand off at the nearest exit to the public internet. It is cheaper.",
        },
        {
          kind: "read",
          title: "Go one step further: inside the ISP",
          body:
            "Even with a PNI, every byte crosses the link into the ISP. For the largest video services, that link becomes the bottleneck.\n\n" +
            "The next step is cache servers **inside** the ISP. The ISP gives space, power and ports. The content provider gives servers. Popular content never crosses an interconnect.",
          visual: {
            kind: "flow",
            spec: { ...embedded, focus: ["orig", "emb", "users", "orig>emb", "emb>users"], flow: ["orig>emb", "emb>users"] },
            caption: "Fill at night, serve the peak from inside the ISP",
          },
        },
        {
          kind: "read",
          title: "Netflix Open Connect",
          body:
            "[[Open Connect]] has two parts: embedded [[Open Connect Appliances|OCA]] (OCAs) given to qualifying ISPs at no charge, and settlement-free interconnection through PNIs or public IXP peering. Netflix says it partners with over a thousand ISPs.\n\n" +
            "The ISP configures BGP sessions with the OCAs to say which users each appliance serves. Netflix asks these ISPs to also peer, for resilience and for \"nightly content fills and updates\".\n\n" +
            "Netflix knows its catalog and demand ahead of time, so it fills caches at night.",
          visual: {
            kind: "flow",
            spec: { ...embedded, focus: ["orig", "emb", "ixc", "users", "orig>emb", "orig>ixc", "emb>users", "ixc>users"] },
            caption: "Embedded OCAs plus peering as backup",
          },
        },
        {
          kind: "quiz",
          prompt: "An ISP has both embedded OCAs and peering with Netflix. A popular title plays at the evening peak. What serves it?",
          visual: { kind: "flow", spec: { ...embedded, focus: ["emb", "ixc", "users", "emb>users", "ixc>users"] } },
          options: [
            "The embedded OCAs; peering is mainly backup and for less popular titles",
            "Peering, because it is settlement-free",
            "Transit, because it reaches everyone",
            "The origin directly, to keep the cache fresh",
          ],
          answer: 0,
          explain: "A 2018 APNIC article by a Netflix engineer explains that the **embedded OCAs are preferred**. Peering is used mainly as backup and for less popular titles. Transit is the last resort.",
        },
        {
          kind: "read",
          title: "Google and AWS go inside too",
          body:
            "**[[Google Global Cache|GGC]]** (GGC) puts caching servers inside participating ISPs to cut traffic on the ISP's peering and transit links. Google provides and operates the servers; the ISP provides space, power and ports.\n\n" +
            "In February 2024, AWS announced **CloudFront embedded POPs**: CloudFront servers inside ISP and mobile operator networks, 600+ in 200+ cities at launch. AWS built them for \"large-scale cacheable traffic such as live streaming, game downloads, or high popularity video on demand\", where traffic can \"spike to as much as 12 times higher than average\".",
        },
        {
          kind: "read",
          title: "Why go deep: Akamai's reasoning",
          body:
            "Akamai's 2010 paper explains its long-standing deep placement. Centrally hosted content must cross many networks. Each crossing adds latency, loss and failure risk.\n\n" +
            "So the closer the cache sits to the viewer, the fewer crossings can go wrong. Chapter 5 compares vendor placement.",
          visual: {
            kind: "stats",
            items: [
              { value: "1,000+", label: "ISPs with Netflix", note: "Open Connect" },
              { value: "600+", label: "CloudFront embedded POPs", note: "Feb 2024, 200+ cities" },
              { value: "12x", label: "Event spike vs average", note: "AWS's motivation" },
            ],
          },
        },
        {
          kind: "reveal",
          prompt: "Crunchyroll's job posting names Fastly, Akamai, Google Media CDN and Cloudflare. At an assumed 8 Tbps premiere peak, how does Crunchyroll most likely get \"inside the ISP\" reach, and what steering question follows?",
          answer:
            "Crunchyroll is large but far smaller than Netflix or YouTube, so it likely gets inside-the-ISP reach **through its CDN vendors**, not with its own appliances.\n\n" +
            "The practical steering question: in a given country and ASN, which of our CDNs has embedded or PNI capacity into that ISP, and which reaches it only through transit or a distant PoP? The posting describes multi-CDN delivery that routes by performance, availability and cost.",
        },
        {
          kind: "summary",
          points: [
            "Transit is paid reach to everyone, with little capacity control.",
            "Peering is usually settlement-free: public at an IXP (shared port) or private with a PNI (dedicated port).",
            "12 Tbps is about 64% of Europe's record IXP peak, so video needs PNIs and embedded caches.",
            "Hot potato hands off early; cold potato (Google Premium Tier) carries traffic far on the backbone.",
            "Netflix, Google, AWS (2024) and Akamai put caches inside ISPs; Crunchyroll likely gets this through its CDNs.",
          ],
        },
      ],
    },

    /* ======================= L4 ======================= */
    {
      id: "ch02-l4",
      title: "The last mile and the physics of latency",
      goal: "Separate bandwidth, throughput and latency, and estimate RTT, BDP and Mathis throughput.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "Rebuffering rises on one mobile ISP only, at that ISP's evening peak, on all of your CDNs at once. Where is the problem most likely?",
          options: [
            "In one CDN's PoP",
            "In that ISP's network or access",
            "In your origin storage",
            "In the player's code on all devices",
          ],
          answer: 1,
          explain: "If every CDN shows the same pattern on one ISP at that ISP's peak, the problem is almost certainly in **that ISP's network or access**. A multi-CDN switch will not fix it. A lower starting bitrate on that ASN might help.",
        },
        {
          kind: "read",
          title: "What the last mile is",
          body:
            "The [[last mile]] is the access network between the ISP and the viewer's home or phone: DSL, cable (DOCSIS), fiber (FTTH), fixed wireless, mobile (4G and 5G) and satellite.\n\n" +
            "After that comes the true last hop, usually home Wi-Fi.\n\n" +
            "The last mile is often the **narrowest** part of the path, and it is **shared**.",
        },
        {
          kind: "read",
          title: "Shared and noisy",
          body:
            "- **Cable and PON fiber** share capacity among homes in a neighborhood, so each home's rate drops at the evening peak.\n" +
            "- **Mobile** throughput swings with signal, cell load and movement.\n" +
            "- **Wi-Fi** adds loss and delay.",
        },
        {
          kind: "read",
          title: "Bufferbloat",
          body:
            "Many home routers have huge queues. When the link is full, packets **wait** in the queue instead of being dropped. Latency rises from tens to hundreds of milliseconds. This is **bufferbloat**.\n\n" +
            "Loss-based congestion control (next lesson) makes it worse: it keeps filling these queues until a packet drops.",
        },
        {
          kind: "quiz",
          prompt: "A home router has a huge queue and the link is full. What does the viewer experience?",
          options: [
            "Packets are dropped at once, so latency stays low",
            "Packets wait in the queue, and latency rises to hundreds of milliseconds",
            "The router asks the CDN to slow down",
            "Nothing changes until the ISP's evening peak",
          ],
          answer: 1,
          explain: "This is **bufferbloat**: packets wait instead of being dropped, so latency rises from tens to hundreds of milliseconds. Loss-based congestion control keeps filling the queue until something finally drops.",
        },
        {
          kind: "read",
          title: "What you can do",
          body:
            "You cannot fix a viewer's Wi-Fi. You *can*:\n\n" +
            "- measure QoE per ASN and connection type (Chapter 11)\n" +
            "- offer low enough bitrate rungs (Chapter 7)\n" +
            "- let ABR drop down before a stall (Chapter 10)\n" +
            "- serve from as close as possible\n" +
            "- pick transport settings that cope with lossy links",
          callout: {
            type: "mistake",
            text: "Blaming the CDN for every rebuffer spike in a region. If rebuffering rises on one mobile ISP only, at that ISP's evening peak, on all of your CDNs at once, the problem is almost certainly in that ISP. A multi-CDN switch will not fix it. A lower starting bitrate on that ASN might help.",
          },
        },
        {
          kind: "multi",
          prompt: "Which of these can a delivery team actually do about bad last miles? Select all that apply.",
          options: [
            "Measure QoE per ASN and connection type",
            "Fix the viewer's home Wi-Fi",
            "Offer low enough bitrate rungs",
            "Let ABR drop down before a stall",
            "Serve from an edge as close as possible",
          ],
          answers: [0, 2, 3, 4],
          explain: "You cannot fix a viewer's Wi-Fi. You can measure per ASN, offer low rungs, let ABR step down early, serve from close by, and choose transport settings that cope with loss.",
        },
        {
          kind: "read",
          title: "A synchronized last-mile peak",
          body:
            "With viewers in 200+ countries and territories, last miles vary widely. In some markets, viewing is likely mostly mobile.\n\n" +
            "A simulcast also creates a *synchronized* last-mile peak: many viewers on the same cable node or cell start the same episode in the same minute.",
          callout: {
            type: "crunchyroll",
            text: "Design bitrate ladders and ABR startup for those networks, not only for US fiber.",
          },
        },
        {
          kind: "read",
          title: "Three different words",
          body:
            "- **Bandwidth** (capacity) is the maximum rate a link can carry, for example a 100 Mbps home plan.\n" +
            "- **Throughput** is the rate a flow actually achieves. The narrowest link, other flows and the transport protocol all limit it.\n" +
            "- **[[Latency]]** is delay. The most useful form is [[round-trip time|RTT]] (RTT): the time for a packet to reach the server and for the answer to come back.",
        },
        {
          kind: "match",
          prompt: "Match each word to its meaning.",
          pairs: [
            ["Bandwidth", "The maximum rate a link can carry"],
            ["Throughput", "The rate a flow actually achieves"],
            ["Latency", "Delay"],
            ["RTT", "Time to the server and back"],
          ],
          explain: "A 100 Mbps plan is **bandwidth**. What one video flow actually gets is **throughput**, and it can be far lower. RTT is the most useful form of latency.",
        },
        {
          kind: "read",
          title: "Latency is mostly physics",
          body:
            "Light in fiber travels at roughly **200,000 km per second**, about two-thirds of its speed in vacuum.\n\n" +
            "That gives a simple rule: **about 1 ms of round-trip time for every 100 km of fiber path.**\n\n" +
            "A same-city server often gives 5 to 20 ms. The only fix for distance is to move bytes closer. That is what caches do.",
          visual: {
            kind: "stats",
            items: [
              { value: "200,000 km/s", label: "Light in fiber" },
              { value: "~1 ms", label: "RTT per 100 km" },
              { value: "5-20 ms", label: "Same-city RTT" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "Tokyo to the US East Coast is about 11,000 km in a straight line. What is the lowest possible RTT?",
          answer: 110,
          tolerance: 10,
          unit: "ms",
          hint: "About 1 ms of RTT per 100 km of fiber.",
          explain: "11,000 / 100 = **about 110 ms**. That is a floor: real routes are longer and slower. No software change can beat it. Only moving the bytes closer can.",
        },
        {
          kind: "read",
          title: "The bandwidth-delay product",
          body:
            "To keep a path busy, a sender must have enough data **in flight** (sent but not yet acknowledged) to cover one full round trip.\n\n" +
            "That amount is the [[bandwidth-delay product]] (BDP).",
          visual: {
            kind: "code",
            lang: "text",
            code: "BDP = bandwidth x RTT\n\n20 Mbps x 150 ms\n= 20,000,000 x 0.15\n= 3,000,000 bits\n= about 375 KB in flight",
          },
        },
        {
          kind: "number",
          prompt: "A viewer has 20 Mbps of throughput and 150 ms RTT to the server. How much data must be in flight to keep the path full?",
          answer: 375,
          tolerance: 20,
          unit: "KB",
          hint: "20,000,000 bits/s x 0.15 s, then divide by 8 for bytes.",
          explain: "20,000,000 x 0.15 = 3,000,000 bits = **about 375 KB** in flight.",
        },
        {
          kind: "number",
          prompt: "Same path (150 ms RTT), but the sender or receiver can only keep 64 KB in flight. What is the maximum throughput?",
          answer: 3.5,
          tolerance: 0.3,
          unit: "Mbps",
          hint: "Throughput = window / RTT. 64 KB is about 524,000 bits.",
          explain: "64 KB / 0.15 s = **about 3.5 Mbps**, no matter how fast the link is. This is why TCP needs the **window scale** option (RFC 7323), and why socket buffer limits matter: a badly tuned proxy or custom origin service can still cap throughput this way.",
        },
        {
          kind: "read",
          title: "Throughput under loss: the Mathis rule",
          body:
            "Loss lowers throughput, and higher RTT makes the effect worse.\n\n" +
            "A classic 1997 model by Mathis, Semke, Mahdavi and Ott gives the steady-state throughput of a Reno-style TCP flow with random loss rate p.\n\n" +
            "With MSS = 1,460 bytes (11,680 bits), you can work it through by hand.",
          visual: {
            kind: "code",
            lang: "text",
            code: "throughput <= (MSS / RTT) x (1.22 / sqrt(p))\n\nMSS = 1,460 bytes = 11,680 bits\nRTT 100 ms, p = 1/100:\n11,680 / 0.1 x 12.2 = about 1.4 Mbps",
          },
        },
        {
          kind: "read",
          title: "Mathis, worked through",
          body: "Look at the rows. Cutting RTT from 100 ms to 20 ms gives about five times more throughput at the same loss. Cutting loss by ten times gives only about three times more (the square root of ten).",
          visual: {
            kind: "table",
            headers: ["RTT", "Loss p", "Approximate max throughput"],
            rows: [
              ["100 ms", "1 in 100 packets", "11,680 / 0.1 x 12.2, about 1.4 Mbps"],
              ["20 ms", "1 in 100 packets", "about 7.1 Mbps"],
              ["100 ms", "1 in 1,000 packets", "about 4.5 Mbps"],
              ["20 ms", "1 in 1,000 packets", "about 22.5 Mbps"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "Use the Mathis model: RTT 20 ms, loss 1 in 1,000 packets, MSS 11,680 bits. About what throughput can a loss-based flow reach?",
          answer: 22.5,
          tolerance: 1.5,
          unit: "Mbps",
          hint: "11,680 / 0.02 x 1.22 / sqrt(0.001). sqrt(0.001) is about 0.0316.",
          explain: "11,680 / 0.02 = 584,000. 1.22 / 0.0316 = about 38.6. 584,000 x 38.6 = **about 22.5 Mbps**. Our 4 Mbps average stream is fine here, and in danger at 100 ms RTT with 1 in 100 loss (about 1.4 Mbps).",
        },
        {
          kind: "widget",
          widget: "tcp-throughput",
          title: "Latency, loss and throughput",
          task: "This starts on the Sao Paulo from Virginia path (120 ms RTT). Read the verdict. Then drag the RTT down toward 12 ms, keeping the same loss and rendition, and find the point where the 6 Mbps segment becomes smooth.",
          props: { preset: "sao-paulo" },
        },
        {
          kind: "read",
          title: "The most important rule in delivery networking",
          body:
            "The model is old and simple. CUBIC and BBR do better than Reno, and real loss is not random. But the direction holds:\n\n" +
            "**For loss-based TCP, throughput falls in proportion to RTT and to the square root of loss.**\n\n" +
            "This is the deepest reason to serve video from an edge near the viewer, not only to save transit cost.",
          callout: {
            type: "staff",
            text: "When someone proposes \"serve this region from a PoP one continent away, it is cheaper,\" do the Mathis math. Higher RTT lowers achievable throughput under the same loss, which pushes ABR to lower bitrates and raises rebuffering. Then put a business number next to it. The cheaper PoP is often not cheaper once QoE is counted.",
          },
        },
        {
          kind: "summary",
          points: [
            "The last mile is often the narrowest, shared part of the path; bufferbloat turns full queues into delay.",
            "Bandwidth is capacity; throughput is what a flow gets; latency (RTT) is delay.",
            "About 1 ms of RTT per 100 km of fiber. Only moving content closer reduces it.",
            "BDP = bandwidth x RTT. A 64 KB window at 150 ms caps a flow at about 3.5 Mbps.",
            "Mathis: throughput <= (MSS/RTT) x (1.22/sqrt(p)). Closer edges raise achievable bitrate.",
          ],
        },
      ],
    },

    /* ======================= L5 ======================= */
    {
      id: "ch02-l5",
      title: "TCP: slow start, CUBIC and BBR",
      goal: "Estimate TCP startup cost, explain idle restart, and compare Reno, CUBIC and BBR.",
      minutes: 12,
      steps: [
        {
          kind: "number",
          prompt: "Before the first video byte, a new connection pays about 3 round trips. If the RTT is 150 ms, how long is that?",
          answer: 450,
          tolerance: 20,
          unit: "ms",
          hint: "3 x RTT",
          explain: "3 x 150 ms = **450 ms**, before any video arrives. At 15 ms RTT the same cost is only 45 ms. Distance multiplies every round trip.",
        },
        {
          kind: "read",
          title: "What TCP does",
          body:
            "**TCP** (Transmission Control Protocol) turns unreliable packets into a reliable, ordered byte stream. Bytes are numbered, acknowledged (**ACKs**), and resent if not acknowledged in time. HTTP/1.1 and [[HTTP/2]] video runs on it.\n\n" +
            "A new connection first pays the **TCP handshake** (1 RTT).",
          visual: { kind: "sequence", spec: { ...tcpSeq, upTo: 1 }, caption: "RTT 1: the TCP handshake" },
        },
        {
          kind: "read",
          title: "Three round trips before video",
          body:
            "Then it pays the [[TLS 1.3]] handshake (1 RTT, Chapter 4), and then the request itself (1 RTT).\n\n" +
            "About 3 RTTs in total: 45 ms at 15 ms RTT, 450 ms at 150 ms RTT.",
          visual: { kind: "sequence", spec: { ...tcpSeq, upTo: 5 }, caption: "TCP, then TLS, then the request" },
        },
        {
          kind: "read",
          title: "Slow start",
          body:
            "TCP starts with a small **congestion window** (cwnd), the amount it may have in flight. Since RFC 6928 (2013) it is usually **10 packets, about 14.6 KB**.\n\n" +
            "In [[slow start]], the window roughly **doubles every RTT** until loss or a threshold.\n\n" +
            "After n round trips, total data sent is about 14.6 KB x (2^n - 1).",
          visual: { kind: "sequence", spec: tcpSeq, caption: "Small window first, then it doubles; the next GET reuses the connection" },
        },
        {
          kind: "number",
          prompt: "A 4-second segment at 5 Mbps is about 2.5 MB. Starting from 14.6 KB and doubling each round trip, about how many round trips does it take to send it (if the path never limits you)?",
          answer: 7.4,
          tolerance: 0.6,
          unit: "RTTs",
          hint: "You need 2^n of about 2,500 / 14.6 = 172.",
          explain: "2.5 MB / 14.6 KB = about 172, so 2^n = 172 and n = **about 7.4 round trips**. At 20 ms RTT that is about 150 ms. At 150 ms RTT it is about 1.1 seconds.",
        },
        {
          kind: "read",
          title: "Distance multiplies it",
          body:
            "At 150 ms RTT, slow start for that first segment takes about 1.1 seconds. Add the 3 handshake RTTs (450 ms), and the first segment from a distant server takes **over 1.5 seconds** before decoding can begin.\n\n" +
            "This is one reason video start time depends so much on edge proximity, and why players **reuse connections**.",
          visual: {
            kind: "stats",
            items: [
              { value: "~150 ms", label: "Slow start at 20 ms RTT" },
              { value: "~1.1 s", label: "Slow start at 150 ms RTT" },
              { value: ">1.5 s", label: "First segment, far server", note: "incl. 3 handshake RTTs" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "Why do players keep one connection open and send the next GET on it?",
          options: [
            "To skip new handshakes and keep a window that has already grown",
            "Because HTTP forbids more than one connection",
            "To make the CDN cache the segment longer",
            "Because new connections use more battery than video decoding",
          ],
          answer: 0,
          explain: "A reused connection skips the TCP and TLS handshakes and keeps a congestion window that has already grown past 14.6 KB. A new connection pays about 3 RTTs plus slow start again.",
        },
        {
          kind: "read",
          title: "Idle restart and the on-off pattern",
          body:
            "In steady state a player fetches a segment, waits while its buffer is full, then fetches the next. This is the **on-off pattern** of ABR streaming.\n\n" +
            "RFC 5681 says that after idling longer than the retransmission timeout, TCP should shrink its window back toward the initial window. Linux does this by default. So each segment may restart in slow start, and the player **measures less throughput than the path can give**. A 2012 study showed this pushes ABR players below the available bandwidth.",
          visual: {
            kind: "code",
            lang: "text",
            code: "# Linux default: on\nnet.ipv4.tcp_slow_start_after_idle = 1\n\n# video servers often disable it\nnet.ipv4.tcp_slow_start_after_idle = 0",
            caption: "Check this on any origin or packager you run",
          },
        },
        {
          kind: "quiz",
          prompt: "A player waits a few seconds with a full buffer, then downloads the next segment. It measures much less throughput than the path can carry. What is the likely cause?",
          options: [
            "TCP shrank its window during the idle gap, so the segment started in slow start again",
            "The CDN evicted the segment from cache",
            "The MTU changed during the pause",
            "BGP moved the viewer to another PoP",
          ],
          answer: 0,
          explain: "**Slow start after idle**: RFC 5681 tells TCP to shrink its window after an idle period, and Linux does it by default (`net.ipv4.tcp_slow_start_after_idle`). The ABR player then underestimates the path and may pick a lower bitrate.",
        },
        {
          kind: "read",
          title: "Reno: additive increase, multiplicative decrease",
          body:
            "After slow start, the **congestion control algorithm** decides how fast to send.\n\n" +
            "Classic TCP **Reno** uses **AIMD** (additive increase, multiplicative decrease): add about one packet per RTT, and halve the window on loss.\n\n" +
            "On long, fast paths, Reno grows far too slowly after each loss.",
        },
        {
          kind: "read",
          title: "CUBIC",
          body:
            "[[CUBIC]] fixes Reno's slow growth. After a loss, it grows the window along a cubic curve: fast at first, flat near the window where the last loss happened, then fast again to probe for more.\n\n" +
            "Growth depends on **time since the last loss**, not on RTT.\n\n" +
            "RFC 9438 (2023) made CUBIC Standards Track and describes it as the most widely deployed TCP congestion control. It is the Linux default.",
        },
        {
          kind: "read",
          title: "CUBIC is loss-based",
          body:
            "For CUBIC, **loss is the congestion signal**. That has two side effects:\n\n" +
            "- It fills deep queues until they overflow, raising latency for everyone on that link (bufferbloat).\n" +
            "- It slows down on random Wi-Fi loss that has nothing to do with congestion.",
        },
        {
          kind: "multi",
          prompt: "Which statements about CUBIC are true? Select all that apply.",
          options: [
            "It is the Linux default",
            "Its growth depends on time since the last loss, not on RTT",
            "It measures bandwidth and RTT instead of reacting to loss",
            "It can fill deep queues and raise latency for everyone on the link",
            "It ignores random Wi-Fi loss",
          ],
          answers: [0, 1, 3],
          explain: "CUBIC is the Linux default (RFC 9438). It grows by time since the last loss. Because **loss is its signal**, it fills deep queues and slows down on random Wi-Fi loss. Measuring bandwidth and RTT is what BBR does.",
        },
        {
          kind: "read",
          title: "BBR: model the path",
          body:
            "[[BBR]] (Bottleneck Bandwidth and Round-trip propagation time), published by Google in 2016, continuously estimates two things:\n\n" +
            "- the **bottleneck bandwidth**: the highest delivery rate seen recently\n" +
            "- the **minimum RTT**: the path delay with empty queues\n\n" +
            "It **paces** packets at about the bottleneck rate and keeps about one BDP in flight, so the queue stays short. It periodically probes for more bandwidth and for a lower RTT.",
        },
        {
          kind: "read",
          title: "BBR at YouTube",
          body:
            "Google reported these results from deploying BBR for YouTube.\n\n" +
            "The BBR paper also notes that the early YouTube deployment ran into **traffic policers**: devices that hard-limit a flow's rate and drop everything above it. This shaped later versions. The IETF is working on BBR version 3 in the Congestion Control Working Group, targeted as an Experimental document.",
          visual: {
            kind: "stats",
            items: [
              { value: "~4%", label: "Higher median throughput" },
              { value: "~33%", label: "Lower round-trip times" },
              { value: "~11%", label: "Longer time between rebuffers" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "A viewer's Wi-Fi drops random packets that have nothing to do with congestion. Which algorithm mostly ignores isolated loss like this?",
          options: ["Reno", "CUBIC", "BBR", "All three halve the window"],
          answer: 2,
          explain: "**BBR** models bandwidth and RTT, so it mostly ignores isolated loss. Reno halves its window. CUBIC cuts by a smaller factor and regrows fast, but it still treats loss as congestion.",
        },
        {
          kind: "read",
          title: "Reno, CUBIC and BBR side by side",
          body: "Keep this table in mind when a vendor tells you which algorithm they run.",
          visual: {
            kind: "table",
            headers: ["", "Reno", "CUBIC", "BBR"],
            rows: [
              ["Congestion signal", "Loss", "Loss", "Measured bandwidth and RTT"],
              ["Window growth", "Linear, about +1 packet per RTT", "Cubic function of time since loss", "Pacing at estimated bottleneck rate"],
              ["Reaction to random loss", "Halves window", "Cuts by a smaller factor, regrows fast", "Mostly ignores isolated loss"],
              ["Queue behavior", "Fills queues", "Fills queues", "Tries to keep queues short"],
              ["Known issues", "Too slow on long fat paths", "Fills deep buffers, slows on random loss", "Fairness with CUBIC debated, policer interaction"],
              ["Standard", "RFC 5681", "RFC 9438 (2023)", "IETF draft (BBRv3)"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each congestion control algorithm to how it grows its sending rate.",
          pairs: [
            ["Reno", "About +1 packet per RTT, halves on loss"],
            ["CUBIC", "Cubic curve of time since the last loss"],
            ["BBR", "Paces at the estimated bottleneck rate"],
          ],
          explain: "Reno and CUBIC are **loss-based**; CUBIC simply regrows much faster on long, fast paths. BBR is **model-based**: it measures bandwidth and RTT instead of waiting for loss.",
        },
        {
          kind: "quiz",
          prompt: "Your viewers download segments from a CDN edge. Who decides whether they get CUBIC or BBR?",
          options: ["The viewer's phone", "The viewer's ISP", "The CDN's edge servers, as the sender", "Your origin storage"],
          answer: 2,
          explain: "Congestion control is a **server-side** choice: the sender's algorithm decides. For video, the CDN's edge servers decide what your viewers get.",
        },
        {
          kind: "read",
          title: "The sender decides",
          body:
            "Google runs BBR for YouTube. Many CDNs tune or customize their congestion control, but details vary by vendor and change over time.\n\n" +
            "If it matters to you, ask each CDN vendor which algorithm and settings they use for video traffic. Then measure the result with your own RUM data rather than trusting the claim.",
          callout: {
            type: "mistake",
            text: "Assuming \"TCP is solved.\" Congestion control, initial window, idle restart, buffers and pacing all change video throughput. Two CDNs with identical PoPs can deliver different QoE from transport settings alone.",
          },
        },
        {
          kind: "widget",
          widget: "tcp-throughput",
          title: "CUBIC versus BBR on a lossy path",
          task: "This path has 80 ms RTT and 1 in 100 loss. Switch congestion control between CUBIC and BBR and compare the verdicts. Then turn on \"Slow start after idle\" and open the Startup view to see the cost of restarting each segment.",
          props: { preset: "bbr-vs-cubic" },
        },
        {
          kind: "summary",
          points: [
            "A new TCP + TLS 1.3 connection pays about 3 RTTs before the first video byte.",
            "Slow start begins at 10 packets (about 14.6 KB) and doubles each RTT: about 7.4 RTTs for a 2.5 MB segment.",
            "Idle restart can put every segment back in slow start and hide path capacity from ABR.",
            "CUBIC (the Linux default) is loss-based; BBR models bandwidth and RTT and keeps queues short.",
            "The CDN's servers choose congestion control for your viewers. Ask, then measure with RUM.",
          ],
        },
      ],
    },

    /* ======================= L6 ======================= */
    {
      id: "ch02-l6",
      title: "QUIC, HTTP/3 and the MTU trap",
      goal: "Weigh QUIC's benefits and costs for video, and diagnose a path MTU black hole.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "A viewer walks out of the house mid-episode, and the phone moves from Wi-Fi to cellular. Over TCP, what happens to the download connection?",
          options: [
            "It continues; TCP follows the phone",
            "It breaks, because a TCP connection is tied to the IP address and port",
            "It pauses until the phone returns to Wi-Fi",
            "The CDN moves it to another PoP automatically",
          ],
          answer: 1,
          explain: "A TCP connection is identified by IP addresses and ports, so a new network means a new connection, with new handshakes and slow start. QUIC identifies a connection by an **ID**, so it can survive the move (**connection migration**).",
        },
        {
          kind: "read",
          title: "Three problems with TCP for streaming",
          body:
            "- **Handshake round trips.** TCP plus TLS costs 2 RTTs before the request.\n" +
            "- **Head-of-line blocking.** One lost packet holds back all later bytes, even for other HTTP/2 streams.\n" +
            "- **Ossification.** TCP lives in kernels and is touched by middleboxes everywhere, so it changes very slowly.",
        },
        {
          kind: "read",
          title: "QUIC and HTTP/3",
          body:
            "[[QUIC]] is a transport protocol that runs over **UDP**. It builds reliability, congestion control and encryption into one layer, usually in user space. It was standardized as RFC 9000 in 2021.\n\n" +
            "[[HTTP/3]] is HTTP mapped onto QUIC, standardized as RFC 9114 in 2022.",
        },
        {
          kind: "read",
          title: "How QUIC works, in short",
          body:
            "- **Combined handshake**: transport and TLS 1.3 together. 1 RTT before the request, or [[0-RTT|Zero-RTT (0-RTT)]] on resumption (with replay risks, Chapter 4).\n" +
            "- **Independent streams**: loss on one stream does not block others.\n" +
            "- **Connection IDs**: the connection survives a move from Wi-Fi to cellular (**connection migration**).\n" +
            "- **Encrypted, user-space**: middleboxes cannot ossify it, and vendors ship congestion-control changes in normal releases.\n" +
            "- **Minimum datagram size**: paths must carry UDP datagrams of at least 1,200 bytes.",
        },
        {
          kind: "multi",
          prompt: "Which of these are true about QUIC? Select all that apply.",
          options: [
            "Transport and TLS 1.3 handshakes are combined",
            "Loss on one stream does not block the others",
            "It always runs inside the operating system kernel",
            "Connections survive a network change thanks to connection IDs",
            "It sends traffic unencrypted to save CPU",
          ],
          answers: [0, 1, 3],
          explain: "QUIC combines handshakes, has independent streams and uses connection IDs. It usually runs in **user space**, not the kernel, and it is **always encrypted**, which is exactly why middleboxes cannot ossify it.",
        },
        {
          kind: "read",
          title: "Measured results for video",
          body:
            "Google's SIGCOMM 2017 paper reported these gains. The authors attribute much of the video gain to better loss recovery.\n\n" +
            "The paper also lists the costs: higher server CPU use than kernel TCP, and networks that block or throttle UDP, so clients must fall back to TCP.",
          visual: {
            kind: "stats",
            items: [
              { value: "-18.0%", label: "YouTube rebuffers, desktop" },
              { value: "-15.3%", label: "YouTube rebuffers, mobile" },
              { value: "-8.0%", label: "Search latency, desktop" },
              { value: "-3.6%", label: "Search latency, mobile" },
            ],
          },
        },
        {
          kind: "read",
          title: "Adoption is real, not total",
          body: "Cloudflare reported the HTTP version mix of the requests it served in 2025. HTTP/2 is still the largest share, so HTTP/3 must always have a fallback.",
          visual: {
            kind: "stats",
            items: [
              { value: "21%", label: "HTTP/3", note: "Cloudflare, 2025" },
              { value: "50%", label: "HTTP/2" },
              { value: "29%", label: "HTTP/1.x" },
            ],
          },
        },
        {
          kind: "read",
          title: "TCP stack versus QUIC stack",
          body: "Read the rows that cost you something, not only the ones that help: CPU per byte, and networks that block UDP.",
          visual: {
            kind: "table",
            headers: ["Property", "TCP + TLS 1.3 + HTTP/2", "QUIC + HTTP/3"],
            rows: [
              ["RTTs before first request (new connection)", "2", "1"],
              ["Head-of-line blocking across streams", "Yes", "No"],
              ["Survives network change (Wi-Fi to cellular)", "No", "Yes, with connection migration"],
              ["Where it runs", "Kernel", "Usually user space"],
              ["CPU cost per byte on servers", "Lower, mature offloads", "Higher, improving"],
              ["Blocked by some networks", "Rarely", "Sometimes (UDP blocked or throttled)"],
              ["Congestion control", "Kernel choice (CUBIC, BBR)", "Implementation choice"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "How many round trips does a brand-new connection need before the first request: TCP + TLS 1.3 versus QUIC?",
          options: ["3 versus 2", "2 versus 1", "1 versus 0", "2 versus 2"],
          answer: 1,
          explain: "TCP + TLS 1.3 needs **2 RTTs** before the request; QUIC combines them into **1 RTT**. On resumption QUIC can even send data in 0-RTT, with replay risks.",
        },
        {
          kind: "read",
          title: "What this means for video, honestly",
          body:
            "A player mostly downloads one large segment at a time, so cross-stream blocking matters less than for a web page.\n\n" +
            "QUIC's real benefits for video are **faster startup**, **better loss recovery** on mobile and Wi-Fi, and **migration** on phones.\n\n" +
            "The costs land on the CDN (CPU) and on observability: passive packet captures can no longer see transport details.",
          callout: {
            type: "staff",
            text: "Turning on HTTP/3 at a CDN is usually one setting. The staff-level work is the measurement: run it as an experiment, compare video start time, rebuffering ratio and start failures by platform and ASN between HTTP/2 and HTTP/3 sessions, and check device support. Smart TVs and older Android players may not support it at all.",
          },
        },
        {
          kind: "reveal",
          prompt: "You are asked to roll out HTTP/3 for Crunchyroll's video. Much viewing is likely on phones and lossier networks; TV and console players may not support HTTP/3. What is a reasonable plan?",
          answer:
            "Enable HTTP/3 **per CDN**, measure **per device family** (and per ASN), and keep **HTTP/2 over TCP as the fallback**.\n\n" +
            "Phones on lossy networks are where QUIC's published gains are biggest. Compare start time, rebuffering and start failures between HTTP/2 and HTTP/3 sessions before calling it a win. Chapter 4 covers how clients discover HTTP/3 through the Alt-Svc header.",
        },
        {
          kind: "read",
          title: "The MTU problem",
          body:
            "If a packet is bigger than the next link's [[MTU]], a router must **fragment** it (IPv4 only, often filtered) or drop it and send an ICMP \"packet too big\" message.\n\n" +
            "**Path MTU discovery** (PMTUD) relies on those messages. It fails when a tunnel (VPN, GRE, IPsec) lowers the real MTU *and* a firewall drops the ICMP. This is a **PMTUD black hole**.",
        },
        {
          kind: "quiz",
          prompt: "What is the classic symptom of a PMTUD black hole?",
          options: [
            "Everything is slow, all the time, for every user",
            "Small requests work, but large transfers hang",
            "Only the first request of each day fails",
            "DNS lookups fail but video plays",
          ],
          answer: 1,
          explain: "**Small requests work, large transfers hang.** Handshakes and the small manifest succeed. Then the full-size packets of a video segment are silently dropped and the download stalls, often on only one ISP, VPN or enterprise network.",
        },
        {
          kind: "read",
          title: "Fixes",
          body:
            "- **MSS clamping**: routers rewrite the MSS in TCP handshake packets, so the endpoints use smaller packets.\n" +
            "- **Packetization-layer PMTUD** (RFC 8899, for datagram protocols like QUIC) probes with larger packets and uses **loss**, not ICMP, to find the limit. QUIC starts at a safe size and grows.",
        },
        {
          kind: "read",
          title: "Inside the cloud",
          body:
            "Cloud networks use larger MTUs internally. On AWS, many EC2 instance types support **9,001-byte jumbo frames** inside a VPC. But traffic leaving through an internet gateway is limited to **1,500 bytes**.\n\n" +
            "So tests between two instances in one VPC can look much faster than real traffic from a CDN shield over the internet. When you design origin-to-CDN networking, test along the real path.",
          callout: {
            type: "mistake",
            text: "Debugging a \"stuck at loading\" report by fetching the manifest with curl and seeing a 200. The manifest is small. Fetch a full video segment over the same network path, and compare packet sizes in a capture, before you rule out the network.",
          },
        },
        {
          kind: "quiz",
          prompt: "Your packager in AWS benchmarks very fast from another instance in the same VPC. Which test better predicts what a CDN shield will see?",
          options: [
            "The same test, repeated with more instances in the VPC",
            "A fetch along the real path, from the shield over the internet, with 1,500-byte packets",
            "A ping from your laptop",
            "A manifest fetch with curl",
          ],
          answer: 1,
          explain: "Inside a VPC, jumbo frames (9,001 bytes) and short paths flatter the result. Traffic leaving through an internet gateway is limited to 1,500 bytes and crosses real networks. **Test along the real path.**",
        },
        {
          kind: "summary",
          points: [
            "TCP's limits for streaming: handshake RTTs, head-of-line blocking, ossification.",
            "QUIC (RFC 9000) over UDP; HTTP/3 (RFC 9114). 1 RTT handshake, independent streams, connection migration.",
            "YouTube saw 18.0% (desktop) and 15.3% (mobile) fewer rebuffers; costs are CPU, UDP blocking and less visibility.",
            "Roll out HTTP/3 per CDN, measure per device and ASN, keep HTTP/2 as fallback.",
            "PMTUD black hole: small requests work, large transfers hang. Fix with MSS clamping or PLPMTUD.",
          ],
        },
      ],
    },

    /* ======================= L7 ======================= */
    {
      id: "ch02-l7",
      title: "Packet loss and cloud backbones",
      goal: "Trace how loss becomes a spinner, list the team's levers, and reason about shield-to-origin networks.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "Which loss hurts a segment download more: one packet lost in the middle, or the last few packets of the response lost?",
          options: [
            "One packet in the middle",
            "The last few packets",
            "They hurt exactly the same",
            "Neither; TCP hides all loss",
          ],
          answer: 1,
          explain: "**Tail loss.** If the last packets are lost, nothing later triggers fast retransmission. The sender waits for a **retransmission timeout** (RTO), often hundreds of milliseconds, then restarts from a small window.",
        },
        {
          kind: "read",
          title: "Where loss comes from",
          body:
            "- **Congestion**: a busy queue overflows. Congestion control is designed for this.\n" +
            "- **Wireless**: interference and signal changes. Link-layer retries turn some loss into delay jitter.\n" +
            "- **Policing**: a hard rate limit drops everything above it. A 2016 Google study found policing widespread and harmful to video, with high loss on policed flows.\n" +
            "- **Failures**: bad optics, flapping links, short BGP black holes.",
        },
        {
          kind: "read",
          title: "From loss to a spinner",
          body:
            "Packet loss causes a retransmission and a smaller congestion window. Throughput for this segment drops.\n\n" +
            "The key question: does the segment take **longer to download than to play**? If not, the buffer stays healthy. If yes, the buffer drains. ABR switches down, and if the buffer hits zero, the viewer sees rebuffering.",
          visual: {
            kind: "flow",
            spec: {
              ...lossChain,
              focus: ["loss", "retx", "thr", "dec", "ok", "drain", "abr", "stall", "loss>retx", "retx>thr", "thr>dec", "dec>ok", "dec>drain", "drain>abr", "drain>stall"],
              flow: ["loss>retx", "retx>thr", "thr>dec", "dec>drain", "drain>stall"],
            },
            caption: "The main chain from loss to rebuffering",
          },
        },
        {
          kind: "read",
          title: "The worst case: tail and burst loss",
          body:
            "The worst case is **tail** or **burst** loss. If the last packets of a response are lost, nothing later triggers fast retransmission.\n\n" +
            "The sender waits for a **retransmission timeout** (RTO), often hundreds of milliseconds. Then it restarts from a small window. The flow pauses, and the buffer drains.",
          visual: {
            kind: "flow",
            spec: { ...lossChain, focus: ["loss", "tail", "rto", "drain", "stall", "loss>tail", "tail>rto", "rto>drain", "drain>stall"], flow: ["loss>tail", "tail>rto", "rto>drain", "drain>stall"] },
            caption: "Tail loss skips straight to a pause",
          },
        },
        {
          kind: "number",
          prompt: "A 4-second segment at 6 Mbps is 3 MB. At a steady 8 Mbps of throughput, how long does the download take?",
          answer: 3,
          tolerance: 0.2,
          unit: "s",
          hint: "3 MB = 24 Mbit. Divide by 8 Mbps.",
          explain: "24 Mbit / 8 Mbps = **3 seconds**, which is 75 percent of the segment's 4 seconds of play time. The margin is only 1 second per segment.",
        },
        {
          kind: "read",
          title: "One second of margin",
          body:
            "One RTO plus slow start on a long-RTT path can eat that 1-second margin. With a low buffer, right after startup, the viewer stalls.\n\n" +
            "Hence three habits: **moderate start bitrates**, **ABR safety margins** (Chapter 10), and **closer edges** for faster recovery.",
        },
        {
          kind: "read",
          title: "What the delivery team controls",
          body: "You cannot remove loss from the internet. You can reduce how much it hurts.",
          visual: {
            kind: "table",
            headers: ["Lever", "Effect on loss impact", "Chapter"],
            rows: [
              ["Serve from an edge close to the viewer", "Lower RTT, faster recovery, higher throughput at the same loss", "5, 9"],
              ["CDN choice per country and ASN", "Avoid CDNs whose path into an ISP is congested", "9"],
              ["Congestion control (CUBIC vs BBR) and pacing on the CDN", "Less reaction to random loss, fewer self-made queues", "2"],
              ["HTTP/3 over QUIC", "Better loss recovery, no cross-stream blocking, migration", "2, 4"],
              ["Segment duration and bitrate ladder", "Smaller segments recover faster, lower rungs survive bad paths", "7"],
              ["Player ABR and retry logic", "Down-switch early, retry on another host or CDN", "10"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each lever to what it does against loss.",
          pairs: [
            ["Edge close to the viewer", "Lower RTT, so faster recovery at the same loss"],
            ["CDN choice per country and ASN", "Avoids a congested path into one ISP"],
            ["BBR and pacing on the CDN", "Less reaction to random loss"],
            ["Lower bitrate rungs", "Survive bad paths"],
            ["Player retry logic", "Retry on another host or CDN"],
          ],
          explain: "Each lever attacks a different link in the chain: RTT, path choice, sender behavior, the bitrate the path must carry, and recovery in the player.",
        },
        {
          kind: "widget",
          widget: "tcp-throughput",
          title: "A lossy mobile path",
          task: "This phone loses 1 in 50 packets. Lower the rendition bitrate until the verdict turns smooth. Then try BBR instead of CUBIC and see how much bitrate you get back.",
          props: { preset: "lossy-mobile" },
        },
        {
          kind: "reveal",
          prompt: "Rebuffering is up in Brazil on one ISP. Using this chapter's vocabulary, which network questions do you ask?",
          answer:
            "- Is it on **all CDNs or one**?\n" +
            "- Did **RTT to the edge jump** (a routing change)?\n" +
            "- Did **throughput drop only at the ISP's peak** (congestion)?\n" +
            "- Do **HTTP/3 and HTTP/2 sessions differ**?\n\n" +
            "Then ask the vendor precisely: \"Your RTT to AS 64500 went from 15 ms to 90 ms at 20:00 local time. Did your path into that ISP change?\" Chapter 11 works this case in full.",
        },
        {
          kind: "read",
          title: "Behind the CDN: the cloud backbone",
          body:
            "Viewers talk to CDNs. But CDN shields (Chapter 6) fetch from origins in AWS and GCP, and content is replicated between clouds. That traffic rides **cloud networks**.\n\n" +
            "Assume the book's model: 540 PB per month delivered, with a 95 percent cache hit ratio by bytes. Then about 5 percent, **27 PB per month**, comes from origin.",
        },
        {
          kind: "number",
          prompt: "27 PB per month comes from origin. Averaged over a 30-day month (2,592,000 seconds), what is the average origin egress?",
          answer: 83,
          tolerance: 5,
          unit: "Gbps",
          hint: "27 x 10^15 bytes x 8 bits / 2,592,000 s",
          explain: "27 x 10^15 x 8 / 2,592,000 = **about 83 Gbps** on average (assumed), with peaks several times higher when new episodes publish. A hit ratio drop from 95 to 90 percent **doubles** it. The shield-to-origin network is a real high-volume system, and part of the Media Delivery team's job.",
        },
        {
          kind: "read",
          title: "The AWS global network",
          body:
            "AWS runs a private global backbone between its regions and edge locations. In 2023 it reported the numbers shown here.\n\n" +
            "- **CloudFront** carries edge-to-origin traffic over the AWS network.\n" +
            "- **AWS Global Accelerator** carries traffic from two static anycast IPs to a regional endpoint: useful for control-plane APIs, not bulk video.\n" +
            "- [[Direct Connect|Direct Connect / Cloud Interconnect]] gives dedicated links at 1, 10, 100 and, since July 2024 at select locations, 400 Gbps.",
          visual: {
            kind: "stats",
            items: [
              { value: "2.5x", label: "Backbone capacity", note: "in three years" },
              { value: "3x", label: "Internet edge capacity" },
              { value: "440+", label: "Peering locations" },
              { value: "410+", label: "CloudFront PoPs" },
            ],
          },
        },
        {
          kind: "read",
          title: "The Google network",
          body:
            "- **Premium Tier** (cold potato) enters and leaves Google's backbone near the user. **Standard Tier** is cheaper and uses the public internet sooner.\n" +
            "- **Dedicated** and **Partner Interconnect** connect your network to Google.\n" +
            "- **Cross-Cloud Interconnect** is a dedicated physical link between Google Cloud and another cloud (AWS, Azure, Oracle, Alibaba) at 10 or 100 Gbps, with 400 Gbps listed for some providers.\n\n" +
            "Google's Media CDN runs on the same infrastructure as YouTube's edge (Chapter 5).",
        },
        {
          kind: "match",
          prompt: "Match each cloud networking product to what it does.",
          pairs: [
            ["AWS Global Accelerator", "Two static anycast IPs, then the AWS backbone; for control-plane APIs"],
            ["AWS Direct Connect", "Dedicated links into AWS, up to 400 Gbps at select locations"],
            ["Google Premium Tier", "Cold potato: stays on Google's backbone until near the user"],
            ["Cross-Cloud Interconnect", "Dedicated physical link from Google Cloud to another cloud"],
          ],
          explain: "Global Accelerator is useful for control-plane APIs, not bulk video. Direct Connect and Cross-Cloud Interconnect are dedicated links. Premium Tier is Google's cold-potato option; Standard Tier is cheaper hot potato.",
        },
        {
          kind: "read",
          title: "Cross-cloud links",
          body:
            "On 30 November 2025, AWS and Google Cloud announced a jointly engineered service pairing **AWS Interconnect - multicloud** with Google's **Cross-Cloud Interconnect**.\n\n" +
            "They describe dedicated bandwidth set up \"in minutes\" through console or API instead of weeks, MACsec encryption between edge routers, quad-redundant facilities and routers, and an open specification. Check current availability before you design around it; it was new when the book was written.",
          visual: {
            kind: "flow",
            spec: { ...clouds, focus: ["s3", "gcs", "s3b", "s3>gcs", "s3>s3b"] },
            caption: "Origins and the links between clouds",
          },
        },
        {
          kind: "read",
          title: "Draw the network paths, not only the boxes",
          body:
            "Each CDN shield reaches an origin over a different network. CloudFront uses the AWS backbone. A Fastly shield uses peering or a private link. Media CDN uses the Google backbone.\n\n" +
            "For each shield and origin, ask: which network carries the fetch? What is the RTT? What does each gigabyte cost? What happens if one cloud region fails?",
          visual: {
            kind: "flow",
            spec: { ...clouds, focus: ["cf", "fs", "mc", "s3", "gcs", "cf>s3", "fs>s3", "mc>gcs"], flow: ["fs>s3"] },
            caption: "Three shields, three different networks",
          },
          callout: {
            type: "staff",
            text: "A design that looks \"multi-cloud\" on a diagram can still have one shared single point of failure in the network, such as every CDN's shield fetching from one region over one interconnect.",
          },
        },
        {
          kind: "quiz",
          prompt: "The diagram shows origins in AWS and GCP. But every CDN shield fetches from us-east-1 over one interconnect. What is the risk?",
          visual: { kind: "flow", spec: { ...clouds, focus: ["cf", "fs", "s3", "cf>s3", "fs>s3"] } },
          options: [
            "None, the design is multi-cloud",
            "A shared single point of failure in the network and region",
            "Only higher cost, never an outage",
            "The cache hit ratio will drop to zero",
          ],
          answer: 1,
          explain: "Multi-cloud boxes do not help if every fetch shares one region and one interconnect. That path is a **single point of failure**. Shield-to-origin and cross-cloud paths need the same no-SPOF design as the edge.",
        },
        {
          kind: "read",
          title: "What we know about Crunchyroll",
          body:
            "The job posting describes fault-tolerant AWS and GCP architectures with no single point of failure, high-volume networking between cloud origins, CDNs and playback services, and multi-origin replication.\n\n" +
            "Which cloud holds which origin, and which CDN fetches from where, is not published.",
          callout: {
            type: "crunchyroll",
            text: "Treat the multi-cloud diagram as the decision space, not Crunchyroll's real design.",
          },
        },
        {
          kind: "summary",
          points: [
            "Loss comes from congestion, wireless, policing and failures.",
            "Tail loss forces an RTO and a small window; a 1-second margin per segment can vanish.",
            "Levers: closer edges, CDN choice per ASN, BBR and pacing, HTTP/3, ladder design, player retries.",
            "Origin egress is about 83 Gbps average at 95% hit ratio (assumed), and doubles at 90%.",
            "Draw network paths for every shield-to-origin fetch, and avoid one shared region or interconnect.",
          ],
        },
      ],
    },

    /* ======================= L8 Checkpoint ======================= */
    {
      id: "ch02-l8",
      title: "Checkpoint",
      goal: "Check your understanding of the whole chapter with the book's questions.",
      minutes: 10,
      steps: [
        {
          kind: "reveal",
          prompt: "Why can a viewer with a 500 Mbps fiber connection still rebuffer on a stream that needs only 6 Mbps? Think first.",
          answer:
            "Throughput is not bandwidth. The path from the CDN may have high RTT, loss or a congested interconnect into the ISP, and the home Wi-Fi may be lossy.\n\n" +
            "Loss-based TCP over a long, lossy path can deliver far less than 6 Mbps no matter how fast the access link is.",
        },
        {
          kind: "number",
          prompt: "Using the Mathis model, at the same loss rate, how many times more throughput does a flow get at 20 ms RTT than at 100 ms RTT?",
          answer: 5,
          tolerance: 0.5,
          unit: "x",
          hint: "Throughput is proportional to 1 / RTT.",
          explain: "**About five times more**, because the model's throughput is proportional to 1/RTT. Closer PoPs let the same lossy path support much higher bitrates, so edge placement is a QoE decision, not only a cost decision.",
        },
        {
          kind: "number",
          prompt: "A viewer has 25 Mbps of path capacity and 120 ms RTT. What is the bandwidth-delay product?",
          answer: 375,
          tolerance: 20,
          unit: "KB",
          hint: "25,000,000 x 0.12 bits, then / 8.",
          explain: "BDP = 25,000,000 x 0.12 = 3,000,000 bits, **about 375 KB**.",
        },
        {
          kind: "number",
          prompt: "Same viewer (120 ms RTT), but the server's send buffer is capped at 64 KB. What throughput can the flow reach at most?",
          answer: 4.4,
          tolerance: 0.3,
          unit: "Mbps",
          hint: "64 KB / 0.12 s",
          explain: "64 KB / 0.12 s is **roughly 4.4 Mbps**, far below the 25 Mbps capacity.",
        },
        {
          kind: "multi",
          prompt: "Which are reasons QUIC helps video playback on mobile networks? Select all that apply.",
          options: [
            "Fewer handshake RTTs, so faster startup",
            "Better loss recovery on lossy radio links",
            "Connection migration when the phone changes networks",
            "Lower server CPU use than kernel TCP",
          ],
          answers: [0, 1, 2],
          explain: "Benefits: fewer handshake RTTs, better loss recovery, and connection migration. CPU is a **cost**, not a benefit: QUIC uses more server CPU than kernel TCP.",
        },
        {
          kind: "multi",
          prompt: "Which are real costs or risks of enabling QUIC? Select all that apply.",
          options: [
            "Higher server CPU use",
            "UDP blocked or throttled by some networks, needing TCP fallback",
            "Uneven device support on TVs",
            "Less visibility with passive packet captures",
            "It cannot use congestion control",
          ],
          answers: [0, 1, 2, 3],
          explain: "Costs and risks: higher server CPU, UDP blocking (so keep TCP fallback), uneven TV support, and less visibility in passive captures. QUIC does have congestion control; the implementation chooses it.",
        },
        {
          kind: "quiz",
          prompt: "Users on one enterprise VPN report that the Crunchyroll app loads the episode page but video never starts. The manifest returns 200. What should you suspect?",
          options: [
            "A path MTU problem (PMTUD black hole)",
            "An expired TLS certificate",
            "A BGP hijack of the CDN's prefix",
            "A low cache hit ratio",
          ],
          answer: 0,
          explain: "A **PMTUD black hole**. The VPN tunnel lowers the MTU and ICMP \"packet too big\" messages are filtered, so full-size packets of video segments are dropped while small packets (handshakes, manifests) pass.",
        },
        {
          kind: "reveal",
          prompt: "How would you confirm the PMTUD black hole?",
          answer: "Fetch a **full segment** over that path, capture packets, and test with smaller packet sizes or MSS clamping. If smaller packets succeed where full-size ones stall, you have found it.",
        },
        {
          kind: "number",
          prompt: "540 PB delivered per month, 95 percent byte hit ratio. What is the average origin egress (30-day month)?",
          answer: 83,
          tolerance: 5,
          unit: "Gbps",
          hint: "5% of 540 PB, x 8 bits, / 2,592,000 s",
          explain: "5 percent of 540 PB is 27 PB. 27 x 10^15 x 8 / 2,592,000 s is **about 83 Gbps** on average.",
        },
        {
          kind: "number",
          prompt: "The hit ratio drops to 90 percent. What is the average origin egress now?",
          answer: 167,
          tolerance: 8,
          unit: "Gbps",
          hint: "10% of 540 PB is 54 PB.",
          explain: "At 90 percent, origin traffic doubles to about 54 PB per month, **about 167 Gbps** on average, with higher peaks.",
        },
        {
          kind: "quiz",
          prompt: "Key takeaway check: how does BGP choose between routes?",
          options: [
            "By measured latency",
            "By policy and AS-path length",
            "By current link utilization",
            "At random, for load balancing",
          ],
          answer: 1,
          explain: "The internet is about 78,000 ASes joined by BGP, which chooses routes by **policy and AS-path length**, not by latency, loss or congestion. CDNs and multi-CDN steering exist partly to correct that.",
        },
        {
          kind: "quiz",
          prompt: "Key takeaway check: who chooses CUBIC or BBR for your viewers' video downloads?",
          options: ["The viewer's device", "The CDN's servers", "The ISP", "The origin bucket"],
          answer: 1,
          explain: "CUBIC is the loss-based default; BBR models bandwidth and RTT and keeps queues short. **The CDN's servers** choose for your viewers, because the sender decides.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "BGP chooses by policy and AS-path length, not latency or congestion; anycast inherits that blindness.",
            "Transit, IXP peering, PNIs and embedded caches: the more direct, the better QoE and lower cost. Crunchyroll gets deep reach via its CDNs.",
            "About 1 ms RTT per 100 km. Mathis: throughput falls with RTT and the square root of loss.",
            "Handshakes and slow start cost several RTTs; idle restart hides capacity from ABR.",
            "QUIC/HTTP/3 cut RTTs and recover better, at a CPU and fallback cost. Measure per device and ASN.",
            "Shield-to-origin paths carry tens of Gbps and need the same no-SPOF design as the edge.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Crunchyroll, \"Software Engineer III, Media Delivery\" job posting (2026). https://www.showbizjobs.com/jobs/crunchyroll-software-engineer-iii-media-delivery-in-san-francisco/jid-gk9z1kd",
    "Geoff Huston, \"BGP in 2025,\" APNIC Blog, 8 January 2026. https://blog.apnic.net/2026/01/08/bgp-in-2025/",
    "RIPE NCC, \"YouTube Hijacking: A RIPE NCC RIS case study\" (2008). https://www.ripe.net/publications/news/youtube-hijacking-a-ripe-ncc-ris-case-study/",
    "Santosh Janardhan, \"More details about the October 4 outage,\" Engineering at Meta, 5 October 2021. https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/",
    "RFC 6811, \"BGP Prefix Origin Validation\" (2013). https://www.rfc-editor.org/rfc/rfc6811",
    "DE-CIX press release, \"DE-CIX global data traffic volume hits record-breaking 79 exabytes at Internet Exchanges in 2025,\" 20 January 2026. https://www.de-cix.net/en/about-de-cix/media/press-releases/de-cix-global-data-traffic-volume-hits-record-breaking-79-exabytes-at-internet-exchanges-in-2025",
    "F. Korsback, L. Dale, D. McGaugh, \"Growing AWS internet peering with 400 GbE,\" AWS Networking and Content Delivery Blog, 22 March 2023. https://aws.amazon.com/blogs/networking-and-content-delivery/growing-aws-internet-peering-with-400-gbe",
    "Google Cloud Blog, \"Google Cloud networking in depth: Understanding Network Service Tiers\" (2019). https://cloud.google.com/blog/products/networking/google-cloud-networking-in-depth-understanding-network-service-tiers",
    "Netflix, Open Connect overview. https://openconnect.netflix.com/en/",
    "APNIC Blog, \"Netflix content distribution through Open Connect,\" 20 June 2018. https://blog.apnic.net/2018/06/20/netflix-content-distribution-through-open-connect/",
    "Google, \"Introduction to GGC,\" Google Peering and Interconnect help. https://support.google.com/interconnect/answer/9058809",
    "T. Tran, A. Srivastava, \"Bringing delivery closer to end users with Amazon CloudFront embedded POPs,\" AWS Networking and Content Delivery Blog, 1 April 2024. https://aws.amazon.com/blogs/networking-and-content-delivery/bringing-delivery-closer-to-end-users-with-amazon-cloudfront-embedded-pops",
    "AWS What's New, \"Amazon CloudFront announces availability of embedded Points of Presence,\" 23 February 2024. https://aws.amazon.com/about-aws/whats-new/2024/02/amazon-cloudfront-availability-embedded-pops",
    "E. Nygren, R. Sitaraman, J. Sun, \"The Akamai Network: A Platform for High-Performance Internet Applications,\" ACM SIGOPS Operating Systems Review, 2010. https://pdos.csail.mit.edu/6.824/papers/akamai.pdf",
    "AWS, \"AWS Global Accelerator features.\" https://aws.amazon.com/global-accelerator/features",
    "M. Mathis, J. Semke, J. Mahdavi, T. Ott, \"The Macroscopic Behavior of the TCP Congestion Avoidance Algorithm,\" ACM Computer Communication Review, 1997. https://courses.cs.duke.edu/fall24/compsci514/readings/mathis-tcpmodel-ccr97.pdf",
    "RFC 7323, \"TCP Extensions for High Performance\" (2014). https://www.rfc-editor.org/rfc/rfc7323",
    "RFC 6928, \"Increasing TCP's Initial Window\" (2013). https://www.rfc-editor.org/rfc/rfc6928",
    "RFC 9438, \"CUBIC for Fast and Long-Distance Networks\" (2023). https://www.rfc-editor.org/rfc/rfc9438.html",
    "N. Cardwell, Y. Cheng, C. S. Gunn, S. H. Yeganeh, V. Jacobson, \"BBR: Congestion-Based Congestion Control,\" ACM Queue, 2016. https://queue.acm.org/detail.cfm?id=3022184",
    "DatacenterDynamics, \"Google Cloud gets congestion control algorithm used in Search, YouTube\" (2017), reporting Google's BBR results. https://direct.datacenterdynamics.com/en/news/google-cloud-gets-congestion-control-algorithm-used-in-search-youtube/",
    "IETF CCWG, \"BBR Congestion Control,\" draft-ietf-ccwg-bbr (BBRv3), 2026 revisions. https://datatracker.ietf.org/doc/html/draft-ietf-ccwg-bbr",
    "Linux kernel documentation, \"IP Sysctl\" (tcp_slow_start_after_idle). https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html",
    "T.-Y. Huang, N. Handigol, B. Heller, N. McKeown, R. Johari, \"Confused, Timid, and Unstable: Picking a Video Streaming Rate is Hard,\" ACM IMC 2012. https://dl.acm.org/doi/10.1145/2398776.2398800",
    "RFC 9000, \"QUIC: A UDP-Based Multiplexed and Secure Transport\" (2021). https://www.rfc-editor.org/rfc/rfc9000",
    "RFC 9114, \"HTTP/3\" (2022). https://www.rfc-editor.org/rfc/rfc9114",
    "A. Langley et al., \"The QUIC Transport Protocol: Design and Internet-Scale Deployment,\" ACM SIGCOMM 2017. https://research.google/pubs/the-quic-transport-protocol-design-and-internet-scale-deployment/",
    "Cloudflare, \"The 2025 Cloudflare Radar Year in Review,\" December 2025. https://blog.cloudflare.com/radar-2025-year-in-review",
    "AWS, \"Network maximum transmission unit (MTU) for your EC2 instance,\" Amazon EC2 User Guide. https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/network_mtu.html",
    "RFC 8899, \"Packetization Layer Path MTU Discovery for Datagram Transports\" (2020). https://www.rfc-editor.org/rfc/rfc8899",
    "T. Flach et al., \"An Internet-Wide Analysis of Traffic Policing,\" ACM SIGCOMM 2016. https://research.google/pubs/an-internet-wide-analysis-of-traffic-policing/",
    "AWS What's New, \"AWS Direct Connect announces native 400 Gbps Dedicated Connections at select locations,\" July 2024. https://aws.amazon.com/about-aws/whats-new/2024/07/aws-direct-connect-native-400-gbps-dedicated-connections-select-locations",
    "Google Cloud, \"Cross-Cloud Interconnect overview.\" https://docs.cloud.google.com/network-connectivity/docs/interconnect/concepts/cci-overview",
    "Google Cloud Blog, \"AWS and Google Cloud collaborate on multicloud networking,\" 30 November 2025. https://cloud.google.com/blog/products/networking/aws-and-google-cloud-collaborate-on-multicloud-networking",
    "RFC 5681, \"TCP Congestion Control\" (2009). https://www.rfc-editor.org/rfc/rfc5681",
  ],
};
export default chapter;
