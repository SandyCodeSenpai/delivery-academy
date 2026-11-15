import type { Chapter, FlowSpec, SequenceSpec } from "./types";

// Owned by the chapter 3 content agent. Source: chapters/03-dns-and-traffic-steering.md

/* ---------------- Shared visuals ---------------- */

const lookupSeq: SequenceSpec = {
  actors: [
    { id: "p", label: "Player app", kind: "player" },
    { id: "s", label: "OS stub", kind: "device" },
    { id: "r", label: "Recursive resolver", kind: "resolver" },
    { id: "t", label: "Root + .com", kind: "dns" },
    { id: "a", label: "Your auth DNS", kind: "dns" },
    { id: "c", label: "CDN auth DNS", kind: "cdn" },
  ],
  messages: [
    { from: "p", to: "s", label: "video.example.com A?" },
    { from: "s", to: "r", label: "video.example.com A?" },
    { from: "r", to: "t", label: "who serves example.com?" },
    { from: "t", to: "r", label: "NS records for example.com", dashed: true },
    { from: "r", to: "a", label: "video.example.com A?" },
    { from: "a", to: "r", label: "CNAME to a CDN name, TTL 300", dashed: true },
    { from: "r", to: "c", label: "CDN-owned name A?" },
    { from: "c", to: "r", label: "edge IPs near the resolver, TTL 20", dashed: true, tone: "good" },
    { from: "r", to: "s", label: "CNAME plus edge IPs", dashed: true },
    { from: "s", to: "p", label: "edge IPs", dashed: true },
    { from: "p", to: "p", label: "open TCP or QUIC to edge IP", tone: "accent" },
  ],
};

const ecsFlow: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "v", label: "Viewer", sub: "Sao Paulo, 203.0.113.45", kind: "viewer", col: 0, row: 1 },
    { id: "pr", label: "Public resolver", sub: "site far away", kind: "resolver", col: 1, row: 1 },
    { id: "ca1", label: "CDN auth DNS", sub: "sees resolver IP only", kind: "dns", col: 2, row: 0 },
    { id: "e1", label: "Far edge", sub: "near the resolver", kind: "edge", col: 3, row: 0, tone: "bad" },
    { id: "ca2", label: "CDN auth DNS", sub: "sees viewer subnet", kind: "dns", col: 2, row: 2 },
    { id: "e2", label: "Sao Paulo edge", sub: "valid for scope /20", kind: "edge", col: 3, row: 2, tone: "good" },
  ],
  edges: [
    { from: "v", to: "pr" },
    { from: "pr", to: "ca1", label: "no ECS", tone: "bad" },
    { from: "ca1", to: "e1" },
    { from: "pr", to: "ca2", label: "ECS: viewer /24", tone: "good" },
    { from: "ca2", to: "e2" },
  ],
};

const gslbTree: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "g", label: "Geo of subnet", sub: "where is the client?", kind: "steering", col: 0, row: 2 },
    { id: "jp", label: "Japan group", sub: "weighted", kind: "loadbalancer", col: 1, row: 0 },
    { id: "df", label: "Global group", sub: "weighted, default", kind: "loadbalancer", col: 1, row: 2 },
    { id: "br", label: "Brazil group", sub: "weighted", kind: "loadbalancer", col: 1, row: 4 },
    { id: "jpa", label: "CDN A", sub: "weight 60, checked", kind: "cdn", col: 2, row: 0 },
    { id: "jpb", label: "CDN B", sub: "weight 40, checked", kind: "cdn", col: 2, row: 1 },
    { id: "dfa", label: "CDN A", sub: "weight 50, checked", kind: "cdn", col: 2, row: 2 },
    { id: "dfb", label: "CDN B", sub: "weight 50, checked", kind: "cdn", col: 2, row: 3 },
    { id: "bra", label: "CDN A", sub: "weight 30, checked", kind: "cdn", col: 2, row: 4 },
    { id: "brc", label: "Regional CDN C", sub: "weight 70, checked", kind: "cdn", col: 2, row: 5 },
  ],
  edges: [
    { from: "g", to: "jp", label: "Japan" },
    { from: "g", to: "df", label: "Default" },
    { from: "g", to: "br", label: "Brazil" },
    { from: "jp", to: "jpa" },
    { from: "jp", to: "jpb" },
    { from: "df", to: "dfa" },
    { from: "df", to: "dfb" },
    { from: "br", to: "bra" },
    { from: "br", to: "brc" },
    { from: "jp", to: "df", label: "if all fail", dashed: true, tone: "warn" },
  ],
};

const raceSeq: SequenceSpec = {
  actors: [
    { id: "pl", label: "DNS Planner", kind: "service" },
    { id: "e1", label: "Enactor 1", kind: "service" },
    { id: "e2", label: "Enactor 2", kind: "service" },
    { id: "r53", label: "Route 53 record", kind: "dns" },
  ],
  messages: [
    { from: "pl", to: "e1", label: "older plan", dashed: true },
    { from: "e1", to: "r53", label: "check once: mine is newer?", note: "yes, at that moment" },
    { from: "e1", to: "e1", label: "delayed by retries", tone: "warn" },
    { from: "pl", to: "e2", label: "much newer plan", dashed: true },
    { from: "e2", to: "r53", label: "apply newer plan", tone: "good" },
    { from: "e2", to: "e2", label: "run cleanup of old plans" },
    { from: "e1", to: "r53", label: "write stale plan over it", tone: "bad" },
    { from: "e2", to: "r53", label: "cleanup deletes stale plan", tone: "bad" },
    { from: "r53", to: "r53", label: "no IP addresses left", tone: "bad" },
  ],
};

const designFlow: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "p", label: "Player", kind: "player", col: 2, row: 0 },
    { id: "api", label: "Playback API", sub: "one hostname", kind: "api", col: 2, row: 1 },
    { id: "gs", label: "GSLB", sub: "with health checks", kind: "steering", col: 2, row: 2 },
    { id: "aws", label: "Playback in AWS", sub: "one region", kind: "cloud", col: 1, row: 3 },
    { id: "gcp", label: "Playback in GCP", sub: "one region", kind: "cloud", col: 3, row: 3 },
    { id: "m", label: "CDN list", sub: "hostnames in priority", kind: "service", col: 2, row: 4 },
    { id: "h1", label: "video-cdn-a", sub: "CNAME to CDN A", kind: "dns", col: 1, row: 5 },
    { id: "h2", label: "video-cdn-b", sub: "CNAME to CDN B", kind: "dns", col: 3, row: 5 },
    { id: "e1", label: "CDN A mapping", sub: "picks a PoP", kind: "cdn", col: 1, row: 6 },
    { id: "e2", label: "CDN B mapping", sub: "picks a PoP", kind: "cdn", col: 3, row: 6 },
  ],
  edges: [
    { from: "p", to: "api" },
    { from: "api", to: "gs" },
    { from: "gs", to: "aws" },
    { from: "gs", to: "gcp" },
    { from: "aws", to: "m" },
    { from: "gcp", to: "m" },
    { from: "m", to: "h1", label: "first choice" },
    { from: "m", to: "h2", label: "fallback" },
    { from: "h1", to: "e1" },
    { from: "h2", to: "e2" },
  ],
};

/* ---------------- Chapter ---------------- */

const chapter: Chapter = {
  n: 3,
  title: "DNS and Global Traffic Steering",
  short: "DNS & steering",
  part: 2,
  hook: "Before the first byte moves, DNS decides which building on Earth will serve it.",
  lessons: [
    /* ======================= Lesson 1 ======================= */
    {
      id: "ch03-l1",
      title: "The front door: one DNS lookup",
      goal: "Name the actors in a DNS lookup, follow one lookup to a CDN edge, and know the record types a delivery engineer meets.",
      minutes: 9,
      steps: [
        {
          kind: "quiz",
          prompt: "A viewer presses Play on a new episode. Before one byte of video moves, what must the player do first?",
          options: [
            "Turn a name like `video.example.com` into an IP address",
            "Download the first video segment from the origin",
            "Ask the CDN which bitrate to play",
            "Open a connection to every PoP and pick the fastest",
          ],
          answer: 0,
          explain: "The player cannot connect to anything until it has an IP address. That lookup is the **first routing decision** in the delivery path. It picks the CDN, the city the bytes come from, and whether a broken component is still in the path.",
        },
        {
          kind: "read",
          title: "DNS is the front door",
          body:
            "**DNS (Domain Name System)** is a global, distributed, cached database. Its most common job is to map a name to IP addresses.\n\n" +
            "If DNS is wrong, slow or down, nothing after it matters. No edge, no cache and no player logic can help a viewer who never gets an address.",
        },
        {
          kind: "read",
          title: "Three more jobs for a video platform",
          body:
            "- **Steering.** The answer can be different for each user. A viewer in Tokyo and a viewer in Sao Paulo ask the same name and get different IPs. That is how a CDN sends each user to a nearby [[PoP]] (point of presence), a site with edge servers.\n" +
            "- **Failover.** The authoritative server can stop handing out an unhealthy PoP, CDN or origin.\n" +
            "- **Ownership hand-off.** A [[CNAME]] gives a CDN control of one hostname, not your whole domain.",
        },
        {
          kind: "match",
          prompt: "Match each DNS job to an example.",
          pairs: [
            ["Steering", "Tokyo and Sao Paulo get different IPs for one name"],
            ["Failover", "Stop handing out a broken PoP"],
            ["Ownership hand-off", "A CNAME gives a CDN one hostname"],
          ],
          explain: "Same name, different answers per user is steering. Removing an unhealthy target is failover. A CNAME hands one hostname to a CDN while you keep the rest of your domain.",
        },
        {
          kind: "read",
          title: "The catch: answers are cached",
          body:
            "DNS was designed for names that change rarely. Every answer carries a [[TTL]] (time to live): how many seconds any cache may keep it.\n\n" +
            "Caching makes DNS cheap and fast. But a changed answer lives on in caches worldwide until each TTL expires. Every DNS steering design fights this.",
          callout: {
            type: "staff",
            text: "Treat DNS as a **slow, coarse, eventually consistent control plane**: excellent for \"send this country to that CDN\", poor for \"move this viewer now\", useless for a viewer already streaming. Ask every design what happens to open connections when the answer changes.",
          },
        },
        {
          kind: "quiz",
          prompt: "Which of these jobs is DNS steering good at?",
          options: [
            "Send all viewers in one country to a different CDN",
            "Move one struggling viewer to another CDN right now",
            "Move a viewer who is already mid-episode",
            "Pick a new bitrate for a viewer",
          ],
          answer: 0,
          explain: "DNS is coarse and slow. It is excellent for country-level choices. It is poor for moving one viewer now, and useless for a viewer already streaming, because that viewer will not ask DNS again until the connection breaks.",
        },
        {
          kind: "read",
          title: "The actors, part 1",
          body:
            "- **Stub resolver.** The small DNS client in the OS or app. It asks one configured server and caches the answer.\n" +
            "- **Recursive resolver**, also called **LDNS (local DNS)**. It does the real work for many users. It is run by the ISP, a company, or a **public resolver** such as Google Public DNS (8.8.8.8), Cloudflare (1.1.1.1) or Quad9.",
          visual: { kind: "sequence", spec: { ...lookupSeq, upTo: 1 }, caption: "The player asks the stub. The stub asks the recursive resolver." },
        },
        {
          kind: "read",
          title: "The actors, part 2",
          body:
            "- **Root and TLD servers.** They hold the **delegation**: for `.com`, which name servers are authoritative for `example.com` (NS records, and sometimes **glue** addresses).\n" +
            "- **Authoritative server.** Holds the real records for a zone. For a CDN-backed name there are often two layers: yours, then the CDN's.",
          visual: { kind: "sequence", spec: { ...lookupSeq, upTo: 3 }, caption: "The resolver learns who is authoritative for example.com" },
        },
        {
          kind: "quiz",
          prompt: "The CDN's authoritative server receives the query. Whose IP address does it see?",
          options: [
            "The viewer's device",
            "The recursive resolver that asked",
            "The root server",
            "The viewer's home router",
          ],
          answer: 1,
          explain: "The authoritative server only sees the IP address of the **recursive resolver** that asked, not the viewer's IP. This one fact drives most of this chapter: a CDN that maps by resolver location can pick the wrong city when the resolver is far from the viewer.",
        },
        {
          kind: "read",
          title: "Two authoritative layers",
          body:
            "Your authoritative server answers with a CNAME to a CDN-owned name, with a TTL of 300 seconds.\n\n" +
            "The resolver then asks the **CDN's** authoritative server. It answers with edge IPs near the resolver, with a TTL of only 20 seconds. The short TTL lets the CDN change its PoP choice often.",
          visual: { kind: "sequence", spec: { ...lookupSeq, upTo: 7 }, caption: "Your zone hands off to the CDN's zone" },
        },
        {
          kind: "order",
          prompt: "Put this cold lookup in order.",
          items: [
            "Player asks the OS stub resolver",
            "Stub asks the recursive resolver",
            "Resolver asks root and .com who serves example.com",
            "Your authoritative DNS answers with a CNAME to the CDN",
            "CDN authoritative DNS answers with edge IPs",
            "Player opens a TCP or QUIC connection to an edge IP",
          ],
          explain: "Stub, recursive, delegation, your zone, the CDN's zone, then connect. Only after the last step can a single byte of video move.",
        },
        {
          kind: "read",
          title: "In real life, most steps are skipped",
          body:
            "That full walk happens only on a cold cache. In practice:\n\n" +
            "- Delegations are cached for hours or days.\n" +
            "- Your CNAME is cached for minutes.\n" +
            "- Only the CDN's final A record is short-lived.\n\n" +
            "So a typical lookup is one quick question to the CDN's DNS.",
          visual: { kind: "sequence", spec: lookupSeq, caption: "The full cold lookup, end to end" },
        },
        {
          kind: "widget",
          widget: "dns-resolve",
          title: "Follow one lookup",
          task: "Step through the cold lookup for static.crunchyroll.com to the end. Watch the resolver cache fill with TTLs, then predict what happens when you ask again.",
          props: { section: "walk" },
        },
        {
          kind: "read",
          title: "Record types you will meet",
          body:
            "A delivery engineer works with a small set of record types. The **A / AAAA** record is the final answer the player connects to. The rest decide who owns the answer, how long \"no\" is cached, and who may issue certificates.",
          visual: {
            kind: "table",
            headers: ["Record", "What it holds", "Why you care"],
            rows: [
              ["A / AAAA", "IPv4 / IPv6 address", "The final answer the player connects to"],
              ["CNAME", "This name is an alias of that name", "How you hand a hostname to a CDN"],
              ["NS", "Which servers are authoritative for a zone", "Where your DNS provider choice lives; key to multi-provider DNS"],
              ["SOA", "Zone metadata, incl. the negative-caching TTL", "Controls how long \"this name does not exist\" is cached"],
              ["TXT", "Free text", "Domain verification for CDNs and certificate authorities"],
              ["CAA", "Which CAs may issue for the name", "TLS certificate issuance for CDN certs (Chapter 4)"],
              ["HTTPS / SVCB", "Service binding: alternate endpoint plus parameters like ALPN (h2, h3)", "Client learns HTTP/3 support and aliases before connecting"],
            ],
            caption: "Record types a delivery engineer meets",
          },
        },
        {
          kind: "read",
          title: "The HTTPS record",
          body:
            "The **HTTPS** record (RFC 9460, November 2023) is a service binding record. It can announce [[HTTP/3]] support before the first connection, so the client does not have to discover it later.\n\n" +
            "Its **AliasMode** allows aliasing at the zone apex, \"which is not possible with CNAME\". You will see why that matters in the CNAME lesson.",
        },
        {
          kind: "match",
          prompt: "Match each record type to its job.",
          pairs: [
            ["A / AAAA", "The address the player connects to"],
            ["CNAME", "Hands a hostname to a CDN"],
            ["SOA", "Sets how long \"does not exist\" is cached"],
            ["CAA", "Which CAs may issue certificates"],
            ["HTTPS / SVCB", "Announces HTTP/3 before connecting"],
          ],
          explain: "A/AAAA hold addresses. CNAME is the alias used for CDN hand-off. SOA carries the negative-caching TTL. CAA limits certificate issuance. HTTPS/SVCB (RFC 9460) can announce ALPN values like h3 before the first connection.",
        },
        {
          kind: "summary",
          points: [
            "DNS is the first routing decision: it picks the CDN, the city and whether a broken part stays in the path.",
            "Beyond names to IPs, DNS does steering, failover and ownership hand-off (CNAME).",
            "Stub, recursive resolver, root/TLD delegation, then authoritative servers: often yours, then the CDN's.",
            "The authoritative server sees the resolver's IP, not the viewer's.",
            "Most lookups are short: delegations and your CNAME are cached; only the CDN's last A record is short-lived.",
          ],
        },
      ],
    },

    /* ======================= Lesson 2 ======================= */
    {
      id: "ch03-l2",
      title: "TTL: the dial between agility and load",
      goal: "Choose TTLs on purpose, explain why real cache lifetimes are longer than the TTL, and estimate DNS-only failover time.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "At 10:00 you change a DNS answer that has a 1-hour TTL. When can you be sure every viewer has the new answer?",
          options: [
            "At 10:00, the moment you save it",
            "Within a few seconds",
            "Not before about 11:00, and some clients even later",
            "Only after the authoritative server restarts",
          ],
          answer: 2,
          explain: "Every cache may keep the old answer until its TTL runs out, so the change takes up to an hour. Real lifetimes can be even longer: some resolvers apply a minimum TTL, apps cache addresses, and open connections never ask again.",
        },
        {
          kind: "read",
          title: "How DNS travels",
          body:
            "DNS mostly runs over **UDP port 53**, with TCP for large answers.\n\n" +
            "**EDNS0** extends the old 512-byte size limit. It also carries options, such as Client Subnet, which you will meet in the resolver lesson.",
        },
        {
          kind: "read",
          title: "Encrypted DNS and where caches live",
          body:
            "Encrypted DNS (**DoT** and **DoH**) hides queries from the network. It often moves users from their ISP resolver to a big public resolver, and that changes what your authoritative server sees.\n\n" +
            "Caches live in the app, the OS, home routers and resolvers. You control none of them. You control only the TTL you publish.",
        },
        {
          kind: "read",
          title: "Caching \"no\": negative caching",
          body:
            "If a name does not exist (**NXDOMAIN**), or has no record of the asked type, resolvers cache that \"no\" too. This is [[negative caching]] (RFC 2308). Its time comes from the zone's SOA record.\n\n" +
            "In a public snapshot of `crunchyroll.com` taken on 2026-11-14, the SOA minimum field was 1,800 seconds.",
          callout: {
            type: "mistake",
            text: "Creating DNS records \"just in time\" during a launch. If any client asked before the record existed, its resolver may cache the NXDOMAIN for the negative TTL. Create records days before a simulcast launch or a CDN migration, not minutes before.",
          },
        },
        {
          kind: "number",
          prompt: "The SOA minimum is 1,800 seconds. For up to how many minutes could a resolver cache \"this name does not exist\"?",
          answer: 30,
          tolerance: 0.5,
          unit: "min",
          hint: "Divide seconds by 60.",
          explain: "1,800 / 60 = **30 minutes**. A record created one minute after a client asked could stay invisible to that client's resolver for up to half an hour.",
        },
        {
          kind: "read",
          title: "The trade-off",
          body:
            "A **short TTL** (10 to 60 seconds) lets you move traffic fast. A **long TTL** (hours) gives fewer, faster lookups and survives an authoritative outage from cache. Neither is free.",
          visual: {
            kind: "compare",
            left: { title: "Short TTL (10 to 60 s)", points: ["Move traffic fast", "More queries and more billing", "More lookup latency", "More dependence on authoritative being up"] },
            right: { title: "Long TTL (hours)", points: ["Fewer, faster lookups", "Survives an authoritative outage from cache", "Changes take hours to reach everyone"] },
            caption: "TTL is a dial between agility and load",
          },
        },
        {
          kind: "multi",
          prompt: "Which of these are costs of a short TTL?",
          options: [
            "More queries and a bigger DNS bill",
            "More lookup latency for viewers",
            "More dependence on the authoritative service being up",
            "Changes take hours to reach everyone",
            "Fewer queries to your DNS provider",
          ],
          answers: [0, 1, 2],
          explain: "Short TTLs mean more queries, more billing, more lookup latency and more dependence on your authoritative service. Slow changes are the cost of a **long** TTL, and fewer queries is a benefit of a long TTL.",
        },
        {
          kind: "read",
          title: "What the research says",
          body:
            "Moura and co-authors measured TTLs in their 2019 IMC paper **\"Cache Me If You Can\"**. Longer TTLs strongly reduce latency. For one country-code TLD, moving to longer TTLs cut median query latency from 183 ms to 28.7 ms.\n\n" +
            "Their advice: operators that use CDNs or DNS-based load balancing may need short TTLs, around 5 or 15 minutes. Most other records should use much longer ones.",
          visual: {
            kind: "stats",
            items: [
              { value: "183 ms", label: "median query latency before", note: "one ccTLD" },
              { value: "28.7 ms", label: "after moving to longer TTLs" },
              { value: "5-15 min", label: "suggested TTL for CDN / DNS load balancing" },
            ],
            caption: "Moura et al., IMC 2019",
          },
        },
        {
          kind: "read",
          title: "Two places hold a TTL",
          body:
            "At a delegation, TTLs live in two places: the **parent** (for example `.com`) and the **child** (your zone). Most resolvers are **child-centric** and trust your zone's TTL. But 10 to 48 percent of queries in the experiments were **parent-centric**, so the parent TTL still matters.\n\n" +
            "The practical rule: **long TTLs on stable records and delegations, short TTLs only on records you actually steer.**",
        },
        {
          kind: "quiz",
          prompt: "Which record should get a short TTL?",
          options: [
            "The NS delegation for your zone",
            "A TXT record used for domain verification",
            "The hostname you steer between two CDNs",
            "The CNAME from static assets to one fixed CDN",
          ],
          answer: 2,
          explain: "Short TTLs only on records you actually steer. Delegations, verification records and a CNAME that never changes should be long, so caches absorb load and survive an authoritative outage.",
        },
        {
          kind: "read",
          title: "What real CDNs publish",
          body:
            "A public `dig` on 2026-11-14 from one US vantage point showed this. The numbers are remaining TTLs in a cache, so they are at or below the published TTL.",
          visual: {
            kind: "table",
            headers: ["Name", "Points to", "TTL seen"],
            rows: [
              ["static.crunchyroll.com", "CNAME to a cloudfront.net distribution", "16 s left in cache"],
              ["the cloudfront.net name", "4 CloudFront A records", "60 s (fresh from Google and Cloudflare resolvers)"],
              ["www.disneyplus.com", "CNAME to an Akamai edgekey.net name", "about 1 hour"],
              ["the edgekey.net name", "CNAME to an akamaiedge.net name", "several hours"],
              ["the akamaiedge.net name", "CNAME to a name that appears to encode ISP and subnet, then A records", "10 to 20 s"],
              ["www.twitch.tv", "CNAME to a map.fastly.net name", "a few minutes"],
            ],
            caption: "Snapshot only; records change",
          },
          callout: {
            type: "industry",
            text: "The customer's CNAME and the vendor's first hop are long-lived because they never change. Only the last hop, where the CDN picks a PoP, is short. That is how a CDN shifts load between PoPs every few seconds while keeping query load sane.",
          },
        },
        {
          kind: "quiz",
          prompt: "In the Disney+ chain, which hop has the shortest TTL?",
          options: [
            "www.disneyplus.com to edgekey.net (about 1 hour)",
            "edgekey.net to akamaiedge.net (several hours)",
            "The last akamaiedge.net hop (10 to 20 s)",
            "All hops share one TTL",
          ],
          answer: 2,
          explain: "The last hop is where Akamai picks a PoP, so it must change often: 10 to 20 seconds. The earlier hops never change, so they can be cached for hours. Each hop's TTL is set by whoever owns that record.",
        },
        {
          kind: "read",
          title: "TTL is a request, not a promise",
          body:
            "Real cache lifetimes stretch beyond your TTL:\n\n" +
            "- Some resolvers and client stacks apply a **minimum TTL**.\n" +
            "- Apps may cache addresses for the life of the process.\n" +
            "- **Serve-stale** (RFC 8767, 2020) lets resolvers keep using expired answers when the authoritative server cannot be reached. That helps resilience, but keeps \"dead\" answers alive.",
        },
        {
          kind: "read",
          title: "Connection reuse matters most",
          body:
            "Most important for video is **connection reuse**. A player keeps one [[HTTP/2]] or [[HTTP/3]] connection to an edge for the whole session.\n\n" +
            "A DNS change only affects **new** connections. A viewer mid-episode stays on the old PoP until the connection breaks.",
        },
        {
          kind: "read",
          title: "Failover time with DNS alone",
          body:
            "How long does it take to move viewers off a dead CDN using only DNS? Add up each stage (assumed values). The total for most new requests is about **1 to 3 minutes**.",
          visual: {
            kind: "table",
            headers: ["Step", "Typical time"],
            rows: [
              ["Health check detects failure: 10 s interval x 3 failures", "about 30 s"],
              ["Health status aggregates, authoritative answer changes", "a few seconds to tens of seconds"],
              ["Resolver caches expire (TTL 60 s)", "0 to 60 s, average 30 s"],
              ["Client and app-level caches expire", "0 to 60 s or more, client dependent"],
              ["Existing connections break, player re-resolves", "depends on player retry logic"],
              ["Total for most new requests", "about 1 to 3 minutes"],
            ],
            caption: "DNS-only failover, assumed values",
          },
        },
        {
          kind: "number",
          prompt: "A health check runs every 10 seconds and needs 3 consecutive failures. About how many seconds until it detects a dead CDN?",
          answer: 30,
          tolerance: 3,
          unit: "s",
          explain: "10 s x 3 failures = **about 30 s**. And that is only the first stage. Aggregation, resolver caches, client caches and open connections all add time.",
        },
        {
          kind: "number",
          prompt: "The steered record has a 60-second TTL. On average, how many seconds until a resolver's cached copy expires after the answer changes?",
          answer: 30,
          tolerance: 3,
          unit: "s",
          hint: "Each resolver cached the answer at a random moment, so the remaining time is anywhere from 0 to 60 s.",
          explain: "Remaining TTL is spread evenly between 0 and 60 s, so the **average is 30 s**. Some resolvers expire at once, some wait the full minute.",
        },
        {
          kind: "order",
          prompt: "Put the DNS-only failover stages in order.",
          items: [
            "Health check detects the failure",
            "Health status aggregates and the authoritative answer changes",
            "Resolver caches expire",
            "Client and app-level caches expire",
            "Existing connections break and the player re-resolves",
          ],
          explain: "Detect, change the answer, then wait for every cache layer, then wait for open connections to break. That is why DNS is the **backstop**, not the first line of defense. Faster tools are player retry on another CDN host (Chapter 10) and per-session CDN choice in the playback API (Chapter 9).",
        },
        {
          kind: "reveal",
          prompt: "A CDN is failing right now. A teammate says: \"Lower the TTL on the video hostname from 1 hour to 30 seconds, so the switch is fast.\" Does that help?",
          answer:
            "No. The old 1-hour TTL is already in every cache, so the new short TTL helps nobody until the old one expires.\n\n" +
            "If you plan a migration, lower the TTL **at least one full old-TTL period before** the change. For a 1-hour TTL, a day before is common practice. Make the change, then raise the TTL again.",
        },
        {
          kind: "widget",
          widget: "dns-resolve",
          title: "TTL and failover",
          task: "Pick a TTL, then trigger a PoP outage at t = 0. Watch how long clients are still sent to the dead PoP. Try a short TTL and a long one.",
          props: { section: "ttl" },
        },
        {
          kind: "summary",
          points: [
            "You control only the TTL you publish; caches in apps, OSes, routers and resolvers keep answers.",
            "Long TTLs on stable records and delegations, short TTLs only on records you steer.",
            "Negative answers are cached too (SOA, RFC 2308): create records days before a launch.",
            "TTL is a request, not a promise: minimum TTLs, app caches, serve-stale and open connections extend it.",
            "DNS-only failover takes about 1 to 3 minutes, so DNS is the backstop. Lower TTLs before planned changes, never during an incident.",
          ],
        },
      ],
    },

    /* ======================= Lesson 3 ======================= */
    {
      id: "ch03-l3",
      title: "CNAME chains: handing a hostname to a CDN",
      goal: "Explain how a CNAME hands one hostname to a CDN, what a chain costs, and how to solve the zone apex problem.",
      minutes: 8,
      steps: [
        {
          kind: "quiz",
          prompt: "You want a CDN to serve `video.example.com`. What do you hand to the CDN?",
          options: [
            "Your whole domain: move the NS records for example.com to the CDN",
            "One CNAME record for that hostname, pointing to a CDN-owned name",
            "Fixed A records with the CDN's IP addresses",
            "Your registrar account",
          ],
          answer: 1,
          explain: "You create one record in your zone: a CNAME to a CDN-owned name. The CDN's authoritative DNS then decides which edge IPs each resolver gets. You keep the rest of your domain. Fixed A records would take away the CDN's ability to pick a PoP for each resolver.",
        },
        {
          kind: "read",
          title: "The hand-off",
          body:
            "You own the first link and the vendor owns the rest. The vendor's authoritative DNS decides which edge IPs each resolver gets.\n\n" +
            "So the CDN can steer inside its network every few seconds without touching your zone.",
          visual: { kind: "code", lang: "dns", code: "video.example.com.  300  IN  CNAME  example.cdn-vendor.net.", caption: "One record hands one hostname to a CDN" },
        },
        {
          kind: "read",
          title: "An Akamai-style chain",
          body:
            "Here is a chain seen with `dig` on 2026-11-14 (TTLs abbreviated, and the ISP-specific part of the name replaced). Long TTLs at the top, very short ones at the bottom.\n\n" +
            "The last CNAME appears to encode the client's ISP and subnet. That is a visible hint of **end-user mapping**, which you will meet in the resolver lesson.",
          visual: {
            kind: "code",
            lang: "dns",
            code:
              "www.disneyplus.com.             3508  CNAME  www.disneyplus.com.edgekey.net.\n" +
              "www.disneyplus.com.edgekey.net. 18208 CNAME  e14245.dscb.akamaiedge.net.\n" +
              "e14245.dscb.akamaiedge.net.       10  CNAME  user-ISP-SUBNET.e14245.dscb.akamaiedge.net.\n" +
              "user-ISP-SUBNET.e14245...         20  A      23.x.x.x",
            caption: "Snapshot from one US vantage point",
          },
        },
        {
          kind: "quiz",
          prompt: "In that chain, who sets the 10-second TTL on `e14245.dscb.akamaiedge.net`?",
          options: ["Disney+, in its own zone", "Akamai, in its own zone", "The viewer's resolver", "The .com registry"],
          answer: 1,
          explain: "Each hop's TTL is owned by the party that owns that zone. Disney+ controls only its first CNAME. The akamaiedge.net names are Akamai's, so Akamai sets their TTLs and their health.",
        },
        {
          kind: "read",
          title: "What a chain costs",
          body:
            "- **Extra lookups.** Each hop into another zone can cost another query on a cold cache. That adds to [[video start time]].\n" +
            "- **Split TTLs and split health.** Each hop has a TTL owned by a different party. If the vendor's DNS is down, your TTL does not matter.\n" +
            "- **Query billing.** Route 53 bills a CNAME that points to another Route 53 record as two queries.",
        },
        {
          kind: "multi",
          prompt: "Which are real costs of a CNAME chain?",
          options: [
            "Extra lookups on a cold cache, adding to video start time",
            "TTLs and health owned by different parties",
            "Route 53 bills a CNAME to another Route 53 record as two queries",
            "The CDN gets control of your whole domain",
          ],
          answers: [0, 1, 2],
          explain: "Extra lookups, split TTLs and health, and query billing are the costs. A CNAME gives the CDN control of **one hostname** only, not your whole domain. That is the point of it.",
        },
        {
          kind: "read",
          title: "The zone apex problem",
          body:
            "You cannot put a CNAME at the **zone apex** (`example.com` itself). The apex holds SOA and NS records, and a CNAME cannot coexist with other records.\n\n" +
            "So how do you put a CDN in front of `example.com`? There are three workarounds.",
        },
        {
          kind: "read",
          title: "Three workarounds",
          body:
            "- **Route 53 alias records.** Route 53 answers at the apex with the IPs of an AWS resource, such as a CloudFront distribution. Alias queries to AWS resources are free. You cannot set the TTL; it uses the target's default.\n" +
            "- **CNAME flattening / ANAME.** The authoritative server follows the CNAME itself and returns A records. The catch: it resolves the CDN name from its own location, so the CDN may map the DNS provider instead of the user.\n" +
            "- **HTTPS records in AliasMode** (RFC 9460): the standard fix, as clients adopt it.",
        },
        {
          kind: "match",
          prompt: "Match each apex workaround to its property.",
          pairs: [
            ["Route 53 alias record", "No charge for alias queries to AWS resources; TTL is the target's"],
            ["CNAME flattening / ANAME", "CDN may map the DNS provider, not the user"],
            ["HTTPS record, AliasMode", "The standard fix, as clients adopt it"],
          ],
          explain: "Alias records are a Route 53 extension for AWS targets. Flattening resolves the CDN name from the DNS provider's location. HTTPS AliasMode (RFC 9460) is the standards-based answer.",
        },
        {
          kind: "quiz",
          prompt: "Your DNS provider flattens the apex CNAME to a CDN. Viewers in Brazil get a PoP in the US. What is the most likely reason?",
          options: [
            "The CDN has no PoP in Brazil",
            "The provider resolved the CDN name from its own location, so the CDN mapped the provider",
            "Flattening disables HTTP/3",
            "The TTL is too long",
          ],
          answer: 1,
          explain: "With flattening, the authoritative server asks the CDN on the viewer's behalf. The CDN sees the DNS provider's location, not the viewer's, and may pick a PoP near the provider.",
        },
        {
          kind: "read",
          title: "For video, the apex rarely matters",
          body:
            "Segments live on dedicated hostnames, and those can always be CNAMEs. Different hostnames for different jobs is a common pattern.",
          callout: {
            type: "crunchyroll",
            text: "A public snapshot on 2026-11-14 showed `crunchyroll.com` delegated to Cloudflare name servers, with the apex and `www` answering with Cloudflare addresses, and `static.crunchyroll.com` as a CNAME to a CloudFront distribution. A playback-service hostname on a separate service domain was a CNAME to an Amazon API Gateway endpoint in `us-west-2`. This is one vantage point at one moment. It says nothing about video segment hostnames, which are usually handed out by the playback API per session.",
          },
        },
        {
          kind: "quiz",
          prompt: "In the 2026-11-14 snapshot, what did `static.crunchyroll.com` point to?",
          options: [
            "Cloudflare addresses, like the apex",
            "A CNAME to a CloudFront distribution",
            "A CNAME to an Akamai edgekey.net name",
            "An API Gateway endpoint in us-west-2",
          ],
          answer: 1,
          explain: "`static.crunchyroll.com` was a CNAME to CloudFront. The apex and `www` answered with Cloudflare addresses, and a playback-service hostname on a separate domain pointed to API Gateway in us-west-2. Different hostnames, different jobs, different providers. It is a snapshot only and says nothing about video segment hostnames.",
        },
        {
          kind: "summary",
          points: [
            "A CNAME hands one hostname to a CDN; you own the first link and the vendor owns the rest.",
            "Top hops have long TTLs; the CDN's last hop is short because that is where it picks a PoP.",
            "Chains cost extra lookups, split TTLs and health, and sometimes double query billing.",
            "No CNAME at the apex: use Route 53 alias, CNAME flattening (with a mapping catch) or HTTPS AliasMode.",
            "For video, segments live on dedicated hostnames, so the apex rarely matters.",
          ],
        },
      ],
    },

    /* ======================= Lesson 4 ======================= */
    {
      id: "ch03-l4",
      title: "The resolver problem: ECS and public resolvers",
      goal: "Explain why public resolvers cause bad PoP choices, how EDNS Client Subnet fixes it, and what ECS costs.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "A viewer in Sao Paulo uses a public resolver whose nearest site is in another country. The CDN maps by resolver location. Where is the viewer sent?",
          visual: { kind: "flow", spec: { ...ecsFlow, focus: ["v", "pr", "ca1", "v>pr", "pr>ca1"] } },
          options: [
            "To the Sao Paulo edge, because the CDN knows the viewer's city",
            "To an edge near the resolver, far from the viewer",
            "To the origin directly",
            "To a random edge",
          ],
          answer: 1,
          explain: "The CDN's authoritative server sees only the resolver's IP. So it picks an edge near the **resolver**. Every segment then crosses a long, lossy path: lower bitrate, more rebuffering.",
        },
        {
          kind: "read",
          title: "The authoritative server is half-blind",
          body:
            "A CDN's authoritative server wants the PoP closest to the **viewer**, but it sees only the **resolver's** IP.\n\n" +
            "Classic **NS-based mapping** assumes the resolver is near its users. That is mostly true for ISP resolvers. It is often false for public ones.",
          visual: { kind: "flow", spec: { ...ecsFlow, focus: ["v", "pr", "ca1", "e1", "v>pr", "pr>ca1", "ca1>e1"], flow: ["v>pr", "pr>ca1", "ca1>e1"] }, caption: "Without client information, the CDN maps the resolver" },
        },
        {
          kind: "read",
          title: "How big is the problem?",
          body:
            "Akamai's 2015 study of its production network (Chen, Sitaraman and Torres) measured it. Public resolvers carried close to **8 percent of client demand worldwide**, with much higher shares in some countries.\n\n" +
            "The paper names India, Brazil and Argentina, where many clients use public resolvers despite large client-to-resolver distances, and Turkey as a very heavy user. In some countries, peering sent clients to a distant resolver site.",
          visual: {
            kind: "stats",
            items: [
              { value: "~8%", label: "of client demand on public resolvers", note: "worldwide" },
              { value: "470-3,800 mi", label: "client cluster radii", note: "99% of public-resolver demand" },
            ],
            caption: "Chen et al., SIGCOMM 2015",
          },
        },
        {
          kind: "read",
          title: "EDNS Client Subnet",
          body:
            "[[ECS]] (**EDNS Client Subnet**), RFC 7871 (May 2016, Informational), lets the recursive resolver attach a **truncated prefix** of the client's IP to its query.\n\n" +
            "The resolver sends a **SOURCE PREFIX-LENGTH**: how many leading bits of the client address it reveals. The RFC strongly encourages truncating IPv4 to **/24** and IPv6 to **/56**, for privacy.",
          visual: { kind: "flow", spec: { ...ecsFlow, focus: ["v", "pr", "ca2", "v>pr", "pr>ca2"] }, caption: "The resolver passes the viewer's /24, not the full address" },
        },
        {
          kind: "read",
          title: "Scope: how far an answer is valid",
          body:
            "The authoritative server replies with a **SCOPE PREFIX-LENGTH**: how wide a block of addresses this answer is valid for. A scope of /20 means \"this answer is fine for the whole /20\".\n\n" +
            "The resolver must cache the answer only for clients inside that scope. Clients from another /24 outside it need a separate query.",
          visual: { kind: "flow", spec: { ...ecsFlow, focus: ["v", "pr", "ca2", "e2", "v>pr", "pr>ca2", "ca2>e2"], flow: ["v>pr", "pr>ca2", "ca2>e2"] }, caption: "With ECS, the viewer gets the Sao Paulo edge" },
        },
        {
          kind: "quiz",
          prompt: "The authoritative answer comes back with SCOPE PREFIX-LENGTH /20. What does that tell the resolver?",
          options: [
            "Reveal 20 bits of the next client's address",
            "This answer may be reused for any client in the same /20",
            "Cache this answer for 20 seconds",
            "The edge is 20 ms away",
          ],
          answer: 1,
          explain: "Source prefix-length is what the resolver reveals. Scope prefix-length is how wide a block the answer is valid for. With /20, the resolver can reuse the answer for every client inside that /20, and must ask again for clients outside it.",
        },
        {
          kind: "number",
          prompt: "How many /24 blocks fit inside one /20?",
          answer: 16,
          tolerance: 0.5,
          unit: "blocks",
          hint: "Each extra prefix bit halves the block. From /20 to /24 is 4 bits.",
          explain: "2^(24 - 20) = 2^4 = **16** /24 blocks. So one /20-scoped answer can serve clients from 16 different /24s.",
        },
        {
          kind: "read",
          title: "What ECS bought Akamai",
          body:
            "Akamai rolled out **end-user mapping** (mapping by the client's ECS prefix) for public-resolver users. For those clients it reported large wins.\n\n" +
            "CDNs with more deployment locations gain more. With few locations, the client and the resolver often map to the same site anyway.",
          visual: {
            kind: "stats",
            items: [
              { value: "8x", label: "decrease in mapping distance" },
              { value: "2x", label: "decrease in RTT and download time" },
              { value: "30%", label: "better time-to-first-byte" },
            ],
            caption: "End-user mapping for public-resolver users (Chen et al., 2015)",
          },
        },
        {
          kind: "read",
          title: "What ECS cost",
          body:
            "The cost was query volume. With ECS, one resolver keeps separate cache entries per client block, so it asks the authoritative server more often. Akamai saw DNS queries to its name servers rise roughly **eight-fold** for the affected traffic.\n\n" +
            "RFC 7871 itself warns that ECS \"will significantly increase the size of the cache\" on resolvers, and should be disabled by default where it gives no clear benefit.",
        },
        {
          kind: "quiz",
          prompt: "Why does a CDN with only a few locations gain less from end-user mapping?",
          options: [
            "Its resolvers do not support ECS",
            "With few sites, client and resolver often map to the same site anyway",
            "ECS only works on anycast networks",
            "Few locations means longer TTLs",
          ],
          answer: 1,
          explain: "If a CDN has only a handful of sites, both the viewer's real location and the resolver's location often point to the same site. More locations make the difference between them visible, so more is gained.",
        },
        {
          kind: "read",
          title: "Who sends ECS?",
          body:
            "You cannot choose your viewers' resolver. You can only measure the effect. ECS also exposes part of the client address to every server in the chain.",
          visual: {
            kind: "table",
            headers: ["Resolver or server", "ECS behaviour"],
            rows: [
              ["Google Public DNS", "Supported ECS at the time of Akamai's 2014 rollout, as did OpenDNS"],
              ["Cloudflare 1.1.1.1", "Does not send ECS, for privacy, except for one debug domain used in cross-provider testing"],
              ["ISP resolvers", "Mixed. Often no ECS, but usually near their users, so it matters less"],
              ["Route 53 (authoritative)", "Uses ECS for geolocation, geoproximity, IP-based and latency routing when sent; else the resolver's IP"],
              ["Google Cloud DNS (authoritative)", "Uses the source IP or ECS for geolocation in public zones"],
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "A viewer uses Cloudflare's 1.1.1.1. What does your CDN's authoritative server learn about the viewer's subnet?",
          options: [
            "The viewer's /24, via ECS",
            "The viewer's /56, via ECS",
            "Nothing: 1.1.1.1 does not send ECS, so it sees only the resolver",
            "The viewer's full IP address",
          ],
          answer: 2,
          explain: "Cloudflare's 1.1.1.1 does not send the EDNS Client Subnet header, for privacy (except for one debug domain). The authoritative server sees only the resolver's IP.",
        },
        {
          kind: "multi",
          prompt: "Which are costs of ECS?",
          options: [
            "Part of the client address is exposed to every server in the chain",
            "Larger resolver caches",
            "Many more queries to the authoritative server",
            "Longer mapping distance for public-resolver users",
          ],
          answers: [0, 1, 2],
          explain: "ECS costs privacy, cache size and query volume (about eight times in Akamai's rollout). It **shortens** mapping distance; that is its benefit.",
        },
        {
          kind: "widget",
          widget: "dns-resolve",
          title: "Where you are vs where your resolver is",
          task: "Pick a Sao Paulo viewer with a far public resolver. Predict the PoP with ECS off, then switch ECS on and compare.",
          props: { section: "location" },
        },
        {
          kind: "read",
          title: "The fix is not in DNS",
          body:
            "If mapping is bad for public-resolver users, you cannot fix the resolver. Measure first, then steer from a place that sees the real client IP.",
          callout: {
            type: "staff",
            text: "Ask \"per country and ASN, how far is the edge PoP our players actually connect to, and how does RTT compare with ISP-resolver users?\" RUM can answer this if the player logs the edge IP and RTT. If mapping is bad, the fix is not in DNS: steer per session from the playback API, which sees the real client IP (Chapter 9).",
          },
        },
        {
          kind: "reveal",
          prompt: "Crunchyroll has viewers in 200+ countries and territories. Where will DNS-only geo steering be least accurate, and how would a platform like this compensate?",
          answer:
            "It will be least accurate wherever public-resolver use and resolver distances are high (the Akamai study names places like India, Brazil, Argentina and Turkey).\n\n" +
            "A platform like Crunchyroll would **likely** compensate with session-level steering in the playback API, which sees the viewer's real IP. This is an assumption, not a published fact. The 200+ countries figure is from a job posting.",
        },
        {
          kind: "summary",
          points: [
            "Authoritative servers see the resolver, not the viewer. Public resolvers can be far from their users.",
            "Public resolvers carried close to 8% of client demand worldwide (Akamai, 2015), much more in some countries.",
            "ECS (RFC 7871) passes a truncated client prefix (/24, /56); the answer's scope says how widely it can be reused.",
            "End-user mapping: 8x shorter mapping distance, 2x lower RTT, 30% better TTFB, at about 8x the queries.",
            "Some resolvers, such as 1.1.1.1, do not send ECS. Fix bad mapping by steering per session in the playback API.",
          ],
        },
      ],
    },

    /* ======================= Lesson 5 ======================= */
    {
      id: "ch03-l5",
      title: "GSLB policies and health checks",
      goal: "Pick a DNS routing policy for a delivery need, compose policies into a tree, and know exactly how Route 53 health checks behave.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "You want 70% of viewers on CDN A and 30% on CDN B. Which DNS routing policy does that?",
          options: ["Simple", "Weighted", "Failover", "Multivalue answer"],
          answer: 1,
          explain: "A **weighted** policy returns answers in proportions you set. It is also how you canary a new CDN at 1 to 5 parts in 100.",
        },
        {
          kind: "read",
          title: "GSLB: DNS as a global load balancer",
          body:
            "[[GSLB]] (**global server load balancing**) means an authoritative DNS server that computes each answer from inputs:\n\n" +
            "- **Where** the client or resolver is (country, ASN, prefix).\n" +
            "- **Health** of each target.\n" +
            "- **Performance** from probes or [[RUM]].\n" +
            "- **Policy**: weights, cost, commits, capacity.",
          callout: {
            type: "industry",
            text: "Akamai's mapping system is the canonical example. It **scores** each server cluster for each client group by measured latency, loss and bandwidth (with different scoring for web and video). Then **global load balancing** picks a cluster, and **local load balancing** picks servers in it, using liveness, capacity and load.",
          },
        },
        {
          kind: "read",
          title: "Route 53's eight routing policies",
          body:
            "Route 53 lists eight routing policies. Most GSLB products offer similar ones.",
          visual: {
            kind: "table",
            headers: ["Policy", "What it does", "Delivery use"],
            rows: [
              ["Simple", "One fixed answer", "Stable records"],
              ["Weighted", "Answers in proportions you set", "Split 70/30 between two CDNs; canary a new CDN at 1 to 5 parts in 100"],
              ["Failover", "Active-passive: primary unless its health check fails", "Backup CDN or backup origin"],
              ["Geolocation", "By user location (continent, country, US state)", "Licensing-driven routing, regional CDN in one country"],
              ["Geoproximity", "By distance to your resources, with a bias to grow or shrink a region", "Shift load between regions gradually"],
              ["Latency", "To the AWS Region with best measured latency", "Route API traffic to the nearest cloud region"],
              ["IP-based", "By client IP prefix, from CIDR lists you upload", "Send one ISP's prefixes to a CDN with caches inside that ISP"],
              ["Multivalue answer", "Up to eight healthy records chosen at random", "Simple client-side spreading"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each delivery need to the Route 53 policy.",
          pairs: [
            ["Canary a new CDN at 2 parts in 100", "Weighted"],
            ["Keep a backup origin for when the primary fails", "Failover"],
            ["Route one country by licensing rules", "Geolocation"],
            ["Send one ISP's prefixes to a CDN with caches in it", "IP-based"],
            ["Send API traffic to the nearest cloud region", "Latency"],
          ],
          explain: "Weighted splits by proportion, failover is active-passive, geolocation routes by location, IP-based uses CIDR lists you upload, and latency picks the AWS Region with the best measured latency.",
        },
        {
          kind: "read",
          title: "Google Cloud DNS and NS1",
          body:
            "**Google Cloud DNS** offers weighted round robin (weights 0 to 1000), geolocation, **geofencing** (keep traffic in one geography even if all its endpoints are unhealthy) and failover, including a \"trickle\" of traffic to the backup so you know it works. It cannot combine weighted and geolocation in one record.\n\n" +
            "**NS1** (now IBM NS1 Connect) builds answers with **filter chains**. Its **Pulsar** add-on steers by real-user data. It is still DNS: TTLs, resolver blindness and connection stickiness remain.",
        },
        {
          kind: "quiz",
          prompt: "In Google Cloud DNS, what does geofencing do when every endpoint in a geography is unhealthy?",
          options: [
            "Sends that traffic to the nearest healthy geography",
            "Keeps the traffic in that geography anyway",
            "Returns NXDOMAIN",
            "Trickles 1% of traffic to the backup",
          ],
          answer: 1,
          explain: "Geofencing keeps traffic in one geography **even if all its endpoints are unhealthy**. That suits rules like licensing or data residency. The \"trickle\" is a separate failover feature that sends a fraction of traffic to the backup so you know it works.",
        },
        {
          kind: "read",
          title: "Composing policies into a tree",
          body:
            "Real configs nest policies. Route 53 alias records can point to groups of records. That builds a tree: geolocation or latency at the top, weighted and health-checked leaves below.\n\n" +
            "With **Evaluate Target Health** set to Yes, Route 53 backs out of a branch whose leaves are all unhealthy.",
          visual: { kind: "flow", spec: { ...gslbTree, focus: ["g", "jp", "df", "br", "g>jp", "g>df", "g>br"] }, caption: "A geolocation top with weighted, health-checked leaves" },
        },
        {
          kind: "quiz",
          prompt: "Evaluate Target Health is Yes. Both Japan leaves (CDN A and CDN B) fail their health checks. Where do Japanese resolvers go?",
          visual: { kind: "flow", spec: { ...gslbTree, focus: ["jp", "jpa", "jpb", "df", "dfa", "dfb", "jp>df", "df>dfa", "df>dfb"], flow: ["jp>df", "df>dfa"] } },
          options: [
            "Nowhere: they get an empty answer",
            "To the Global group, weighted 50/50 between CDN A and CDN B",
            "To the Brazil group",
            "To the Japan leaves anyway",
          ],
          answer: 1,
          explain: "Route 53 backs out of the Japan branch because all its leaves are unhealthy, and the query falls through to the default **Global** group (CDN A 50, CDN B 50). The tree keeps answering even when one region's leaves fail.",
        },
        {
          kind: "read",
          title: "One leaf as code",
          body:
            "Here is one weighted, health-checked leaf in Terraform (Chapter 14 covers infrastructure as code in depth). The check probes `/healthz` over HTTPS every 10 seconds and needs 3 failures. The record has a 60-second TTL and weight 70.",
          visual: {
            kind: "code",
            lang: "hcl",
            code:
              "resource \"aws_route53_health_check\" \"cdn_a\" {\n" +
              "  fqdn              = \"health.cdn-a.example.net\"\n" +
              "  type              = \"HTTPS\"\n" +
              "  resource_path     = \"/healthz\"\n" +
              "  request_interval  = 10\n" +
              "  failure_threshold = 3\n" +
              "}\n" +
              "resource \"aws_route53_record\" \"video_cdn_a\" {\n" +
              "  zone_id         = var.zone_id\n" +
              "  name            = \"video.example.com\"\n" +
              "  type            = \"CNAME\"\n" +
              "  ttl             = 60\n" +
              "  records         = [\"example.cdn-a.net\"]\n" +
              "  set_identifier  = \"cdn-a\"\n" +
              "  health_check_id = aws_route53_health_check.cdn_a.id\n" +
              "  weighted_routing_policy { weight = 70 }\n" +
              "}",
          },
        },
        {
          kind: "number",
          prompt: "A second leaf for CDN B has weight 30. Both are healthy. What percent of answers point to CDN A?",
          answer: 70,
          tolerance: 1,
          unit: "%",
          hint: "Share = its weight / sum of weights.",
          explain: "70 / (70 + 30) = **70%**. Weights are proportions, not percentages, so 7 and 3 would give the same split.",
        },
        {
          kind: "read",
          title: "Comparing managed GSLB options",
          body:
            "A CDN's DNS steers well **inside** that CDN. To steer **between** CDNs you need a vendor-neutral layer above them: your own GSLB records, a steering service, or (better for video) the playback API. The more precise the steering, the further it moves from DNS into the application.",
          visual: {
            kind: "table",
            headers: ["Capability", "Route 53", "Cloud DNS", "NS1 Connect", "CDN-integrated"],
            rows: [
              ["Weighted, failover, geo", "Yes", "Yes", "Yes", "Inside own network only"],
              ["Latency-based", "To AWS Regions", "No built-in policy", "Via RUM (Pulsar)", "Own mapping system"],
              ["RUM-driven", "No (bring your own)", "No", "Yes", "Own data"],
              ["ECS used", "Yes, if sent", "Yes, public zones", "Supported", "Yes (Akamai)"],
              ["Health checks", "Global, 10 or 30 s", "3 regions x 3 probers, 30-300 s", "Monitors plus RUM", "Internal"],
              ["Steers across vendors", "Yes", "Yes", "Yes, its main use", "No"],
            ],
          },
          callout: { type: "industry", text: "Netflix's Open Connect steering, covered in Chapters 9 and 17, is the extreme case of moving steering out of DNS and into the application." },
        },
        {
          kind: "quiz",
          prompt: "You use Akamai and Fastly. Which layer can steer viewers **between** them?",
          options: [
            "Akamai's mapping system",
            "Fastly's DNS",
            "A vendor-neutral layer: your own GSLB, a steering service or the playback API",
            "The viewer's ISP resolver",
          ],
          answer: 2,
          explain: "Each CDN's DNS steers only inside its own network. Choosing between vendors needs a layer above them. For video, the playback API is the most precise, because it sees the real client IP.",
        },
        {
          kind: "quiz",
          prompt: "A CDN endpoint's TLS certificate expired yesterday. Its Route 53 HTTPS health check still returns 200. What does Route 53 report?",
          options: [
            "Unhealthy: the certificate is invalid",
            "Healthy: Route 53 HTTPS checks do not validate certificates",
            "Unknown until a human checks",
            "Unhealthy, but only from US checkers",
          ],
          answer: 1,
          explain: "**Route 53 HTTPS health checks do not validate TLS certificates.** The check passes while every player fails. Monitor certificates separately, or fail over on real error metrics.",
        },
        {
          kind: "read",
          title: "How Route 53 decides health",
          body:
            "- Checkers run worldwide every **10 or 30 seconds**, uncoordinated, each with a **failure threshold** of consecutive failures.\n" +
            "- **HTTP/HTTPS:** TCP must connect within **4 s**, and the endpoint must return **2xx or 3xx** within **2 s** after connecting. **TCP** checks only need a connection within 10 s.\n" +
            "- **String matching** needs the string in the **first 5,120 bytes** of the body.",
        },
        {
          kind: "read",
          title: "More health check rules",
          body:
            "- An endpoint is healthy if **more than 18 percent** of checkers say so. The low number is deliberate: one region's network problem should not mark a good endpoint dead.\n" +
            "- **Calculated health checks** combine up to 255 child checks (\"healthy if at least N are healthy\").\n" +
            "- A check can follow a **CloudWatch alarm**, so you fail over on metrics like 5xx rate.\n" +
            "- A new check counts as healthy until there is enough data.",
        },
        {
          kind: "read",
          title: "How records are chosen",
          body:
            "- A record without a health check is **always healthy**.\n" +
            "- **If no record in a group is healthy, Route 53 treats all of them as healthy** and answers by the normal policy. This is a deliberate **fail-open**: returning something beats returning nothing.\n" +
            "- In a failover pair, if both are unhealthy, Route 53 returns the primary.\n\n" +
            "Google Cloud DNS uses 3 probe regions x 3 probers (9 in total), every 30 to 300 seconds.",
        },
        {
          kind: "quiz",
          prompt: "In a Route 53 failover pair, both the primary and the secondary are unhealthy. What is returned?",
          options: ["Nothing (empty answer)", "The secondary", "The primary", "NXDOMAIN"],
          answer: 2,
          explain: "Route 53 returns the **primary**. Like the weighted fail-open rule, it prefers some answer over none, because \"everything is unhealthy\" often means the checker or a shared dependency is at fault.",
        },
        {
          kind: "read",
          title: "What to check, for a CDN",
          body:
            "A check against a CDN hostname hits whatever PoP the **checker's** lookup returns, not your viewers' PoPs. Options, from shallow to deep:",
          visual: {
            kind: "table",
            headers: ["Check style", "What it proves", "Blind spots"],
            rows: [
              ["TCP connect to CDN host", "The PoP accepts connections", "TLS, HTTP, cache, origin"],
              ["HTTPS GET of a tiny static object", "Edge serves HTTP, cert presented (not validated by Route 53)", "Origin path, video-specific config"],
              ["HTTPS GET of a known video segment, full path, string match", "Edge, shield and origin path work for real media", "Only near the checker locations"],
              ["CloudWatch alarm on CDN 5xx or RUM error rate", "Real users are failing", "Metric pipeline latency"],
            ],
          },
          callout: {
            type: "mistake",
            text: "Health-checking the origin when the record steers between CDNs. If the origin dies, every CDN looks unhealthy, Route 53 fails open, and you learn nothing. Check what the record chooses between.",
          },
        },
        {
          kind: "quiz",
          prompt: "Which check proves that edge, shield and origin all work for real media?",
          options: [
            "TCP connect to the CDN host",
            "HTTPS GET of a tiny static object",
            "HTTPS GET of a known video segment through the full path, with string match",
            "A ping to the origin",
          ],
          answer: 2,
          explain: "Only fetching a real segment through the full path exercises edge, shield and origin. Its blind spot: it only proves things near the checker locations. A CloudWatch alarm on 5xx or RUM errors shows real users failing.",
        },
        {
          kind: "read",
          title: "When health checks make things worse",
          body:
            "In the AWS us-east-1 event of October 2025, NLB health checks flapped for new instances. Nodes were repeatedly pulled from DNS, and health-check-driven AZ failover removed capacity. Engineers disabled automatic failover for hours. AWS added a **velocity control** that limits how much capacity health checks can remove.\n\n" +
            "For CDN steering, a noisy check can remove a whole CDN. Add [[hysteresis]], **floors** and **rate limits** on weight changes (Chapter 12).",
        },
        {
          kind: "read",
          title: "Control plane vs data plane",
          body:
            "Changing a record is a [[control plane]] action. Answering queries and evaluating health checks is the [[data plane]]. AWS says the Route 53 control plane is in `us-east-1`, while the data plane is spread across Regions and PoPs. Do not depend on editing records in your recovery path. In December 2025 AWS announced a standby control plane endpoint in `us-west-2`.\n\n" +
            "So use [[static stability]]: pre-create every record (including zero-weight backups) and fail over by health status.",
        },
        {
          kind: "summary",
          points: [
            "GSLB computes answers from location, health, performance and policy; Akamai scores clusters, then picks servers.",
            "Route 53 has eight policies; nest them into trees, with Evaluate Target Health to back out of dead branches.",
            "A CDN's DNS steers inside that CDN; steering between CDNs needs a vendor-neutral layer.",
            "Route 53 checks: 10 or 30 s, >18% of checkers, no TLS validation, fail-open when all are unhealthy.",
            "Check what the record chooses between, add hysteresis and floors, and never edit records mid-incident.",
          ],
        },
      ],
    },

    /* ======================= Lesson 6 ======================= */
    {
      id: "ch03-l6",
      title: "Anycast vs DNS, and when DNS breaks",
      goal: "Compare anycast and DNS steering with evidence, and draw design lessons from the big DNS incidents.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "Microsoft measured its anycast CDN for Bing in 2015. About what share of clients did anycast send to a suboptimal front-end?",
          options: ["About 1%", "About 20%", "About 50%", "About 80%"],
          answer: 1,
          explain: "About **20 percent**. Anycast did well for most clients, but a meaningful minority got a worse site than a nearby unicast choice.",
        },
        {
          kind: "read",
          title: "Anycast, measured",
          body:
            "[[Anycast]] (Chapter 2) means many sites announce the same prefix with [[BGP]], and routing picks the \"nearest\" site in BGP terms. Calder and co-authors (IMC 2015) timed Bing's anycast front-end against three nearby unicast ones with JavaScript beacons.\n\n" +
            "Most poor paths were short-lived: around 60 percent of poorly served /24s appeared on only one day in the month.",
          visual: {
            kind: "stats",
            items: [
              { value: "~20%", label: "of clients to a suboptimal front-end" },
              { value: ">= 25 ms", label: "slower for 20% of requests" },
              { value: "< 10%", label: "of measurements 100 ms+ slower" },
            ],
            caption: "Calder et al., IMC 2015",
          },
        },
        {
          kind: "read",
          title: "The trade-off to remember",
          body:
            "A simple history-based prediction that used **DNS redirection** for the badly served clients improved performance for 15 to 20 percent of clients.\n\n" +
            "The paper's summary: anycast is \"simple to operate, scalable, and naturally resilient to DDoS attacks\", but it gives up precise control of client redirection. Most large networks use both.",
        },
        {
          kind: "read",
          title: "Side by side",
          body: "Two ways to pick a site, with very different control.",
          visual: {
            kind: "table",
            headers: ["Dimension", "DNS steering", "Anycast"],
            rows: [
              ["Who decides", "Your or the CDN's authoritative server", "BGP routing of every network on the path"],
              ["Granularity", "Per resolver, or per client subnet with ECS", "Per network path, not controllable per client"],
              ["Speed of change", "TTL-bound, seconds to minutes, new connections only", "BGP convergence, seconds to minutes, can move live flows"],
              ["Uses performance data", "Yes, RUM and probes", "No, BGP has no latency or load signal"],
              ["DDoS", "Attack hits whichever IPs you hand out", "Attack spread across all sites"],
              ["Stateful connections", "Stable: an IP maps to one site", "A route change mid-flow can send TCP to another site"],
              ["Cross-vendor steering", "Yes", "No, one network's prefix"],
            ],
          },
        },
        {
          kind: "multi",
          prompt: "Which statements are true of anycast?",
          options: [
            "DDoS traffic is spread across all sites",
            "A route change can move even live flows",
            "BGP has no latency or load signal",
            "It can steer viewers between two CDN vendors",
            "You can control it per client",
          ],
          answers: [0, 1, 2],
          explain: "Anycast spreads attacks, and BGP changes can move live flows (even sending TCP packets to a different site mid-flow). BGP has no performance signal. It cannot steer across vendors (one network's prefix) and is not controllable per client.",
        },
        {
          kind: "read",
          title: "Who does what",
          body:
            "- **Cloudflare** is built around anycast. **Akamai** is the classic DNS-mapping CDN, with short-TTL answers per resolver or client subnet.\n" +
            "- **CloudFront** documents that \"DNS routes the request to the CloudFront POP (edge location) that can best serve the request, typically the nearest CloudFront POP in terms of latency\".\n" +
            "- Authoritative DNS services are usually anycast themselves. Hybrids are common: Microsoft proposed anycast by default, DNS redirection for badly served clients.",
          callout: {
            type: "staff",
            text: "\"Anycast or DNS?\" is the wrong question when buying CDNs. You control **which vendor** each session uses and **how fast you can change it**. Ask each vendor how it maps users to PoPs, whether it uses ECS, what TTL it returns and how fast it can drain a PoP. The answers tell you how its failures will look to your players.",
          },
        },
        {
          kind: "quiz",
          prompt: "According to its own documentation, how does CloudFront send a request to a PoP?",
          options: [
            "Pure anycast: BGP picks the PoP",
            "DNS routes it to the PoP that can best serve it, typically the nearest in latency",
            "The player measures every PoP and picks one",
            "A fixed PoP per AWS account",
          ],
          answer: 1,
          explain: "CloudFront documents DNS-based routing to the PoP that can best serve the request, typically the nearest in terms of latency. Cloudflare is the anycast-built example; Akamai is the classic DNS-mapping CDN.",
        },
        {
          kind: "read",
          title: "Dyn, October 21, 2016",
          body:
            "DNS sits at the start of every connection and is shared by many services. Dyn, a large managed DNS provider, was hit by DDoS attacks. The first began about 7:00 am ET and was mitigated about two hours later. A second, \"more global\" wave came just before noon and took just over an hour. A third had no customer impact. Dyn saw \"10s of millions of discrete IP addresses\" from the **Mirai** botnet of compromised IoT devices. Sites using only Dyn were unreachable for users without a cached answer.",
        },
        {
          kind: "quiz",
          prompt: "During the Dyn attack, why did short TTLs make things worse?",
          options: [
            "Short TTLs make DDoS attacks larger",
            "Caches emptied quickly once the authoritative servers stopped answering",
            "Short TTLs disable serve-stale",
            "Short TTLs force TCP instead of UDP",
          ],
          answer: 1,
          explain: "With a short TTL, a resolver's cached answer expires fast and must be refreshed from the authoritative servers, which were not answering. Lessons: one authoritative DNS provider is a single point of failure, and serve-stale resolvers (RFC 8767) soften this kind of event.",
        },
        {
          kind: "read",
          title: "Akamai Edge DNS, July 22, 2021",
          body:
            "At 15:45 UTC a software configuration update triggered a bug in the DNS component of Akamai's Secure Edge CDN. Many sites that CNAME to Akamai were unreachable for up to about an hour. Akamai said it was not an attack. Missing load-balancing data had made the authoritative DNS for the affected service fail. The rollback completed at 16:44 UTC.\n\n" +
            "Lesson: a CNAME to a CDN means **the CDN's DNS is your DNS**. Multi-provider DNS for your own zone does not help there.",
        },
        {
          kind: "number",
          prompt: "The Akamai event started at 15:45 UTC and the rollback completed at 16:44 UTC. How many minutes is that?",
          answer: 59,
          tolerance: 1,
          unit: "min",
          explain: "16:44 - 15:45 = **59 minutes**, which matches \"up to about an hour\" of impact for sites that CNAME to Akamai.",
        },
        {
          kind: "read",
          title: "Facebook, October 4, 2021",
          body:
            "A backbone change disconnected Facebook's data centers. A safety rule made it worse: its DNS servers \"disable those BGP advertisements if they themselves can not speak to our data centers\". Every DNS site withdrew its anycast routes at once, so \"our DNS servers became unreachable even though they were still operational\". The loss of DNS also broke internal recovery tools.",
        },
        {
          kind: "quiz",
          prompt: "What is the main design lesson from the Facebook outage?",
          options: [
            "Never use anycast for DNS",
            "A local health rule needs a global floor: when every site trips it together, it is catastrophic",
            "Use longer TTLs on NS records",
            "Turn off BGP on DNS servers",
          ],
          answer: 1,
          explain: "A rule that is right for one site is catastrophic when every site trips it together. Automatic removal needs a **global floor**. \"Everything is unhealthy\" usually means the checker is wrong, which is the idea behind Route 53's fail-open rule.",
        },
        {
          kind: "read",
          title: "AWS DynamoDB DNS, October 2025: the setup",
          body:
            "AWS's post-event summary is a textbook case of **DNS automation** failing. A **DNS Planner** builds plans (load balancers and weights) for DynamoDB's regional endpoint. Three independent **DNS Enactors**, in different Availability Zones, apply those plans to Route 53.",
          visual: { kind: "sequence", spec: { ...raceSeq, upTo: 2 }, caption: "Enactor 1 checks once, then gets delayed" },
        },
        {
          kind: "read",
          title: "The race",
          body:
            "An Enactor checked **once** that its plan was newer, then was delayed for a long time by retries. Meanwhile a second Enactor applied a much newer plan and ran a cleanup that deletes old plans.\n\n" +
            "The delayed Enactor then wrote its stale plan over the new one. The cleanup deleted that stale plan, which **removed all IP addresses** for the regional endpoint. Automation could not repair that state.",
          visual: { kind: "sequence", spec: raceSeq, caption: "Check-then-act plus cleanup produced an empty record" },
        },
        {
          kind: "order",
          prompt: "Put the DynamoDB DNS race in order.",
          items: [
            "Enactor 1 checks that its plan is newer",
            "Enactor 1 is delayed by retries",
            "Enactor 2 applies a much newer plan and runs cleanup",
            "Enactor 1 writes its stale plan over the new one",
            "Cleanup deletes the stale plan, leaving no IP addresses",
          ],
          explain: "The check and the write were separate steps, so the check went stale while Enactor 1 waited. The fix is compare-and-set (atomic check and write), and a cleanup that can never delete the live plan.",
        },
        {
          kind: "read",
          title: "Timeline and lessons",
          body:
            "It began at 11:48 PM PDT on October 19. DNS information was restored at 2:25 AM. Connections recovered at about 2:40 AM **as cached DNS records expired**. Effects on EC2 and NLB lasted into the afternoon. AWS disabled the automation worldwide while it fixed the race.\n\n" +
            "- **Never publish an empty answer.** Reject and page on plans that drop all targets or too much capacity.\n" +
            "- **Compare-and-set, not check-then-act.** Cleanup must never delete the live plan.\n" +
            "- **Cache delays recovery too.**",
        },
        {
          kind: "number",
          prompt: "From the start (11:48 PM) to DNS information being restored (2:25 AM), how many minutes passed?",
          answer: 157,
          tolerance: 3,
          unit: "min",
          hint: "11:48 PM to midnight is 12 minutes.",
          explain: "12 min to midnight + 2 h 25 min = 12 + 145 = **157 minutes**. Then connections took until about 2:40 AM (another ~15 minutes) to recover, because clients waited for cached records to expire.",
        },
        {
          kind: "match",
          prompt: "Match each incident to its main lesson.",
          pairs: [
            ["Dyn 2016", "Do not depend on one DNS provider"],
            ["Akamai 2021", "A CNAME to a CDN makes its DNS your dependency"],
            ["Facebook 2021", "Global floors on automatic removal"],
            ["AWS 2025", "Validate plans, atomic writes, no empty answers"],
          ],
          explain: "Dyn: a DDoS against one managed DNS provider. Akamai: a config update hit a bug in the CDN's DNS. Facebook: health-based route withdrawal at every site. AWS: a race in automation produced an empty record. (Slack 2021, a DNSSEC rollout, comes next lesson.)",
        },
        {
          kind: "read",
          title: "Designing for DNS failure",
          body:
            "- **Two authoritative providers for critical zones.** The hard part: weighted, latency, alias and health-checked records are **proprietary** and do not copy with zone transfer. Sync them with IaC, or keep steering simple.\n" +
            "- **Long TTLs on delegations and stable records**, so caches absorb an outage.\n" +
            "- **Independent hostnames per CDN**, so the player and playback API can switch vendor.\n" +
            "- **Monitor DNS from outside**, alerting on empty or unexpected answers.",
          callout: {
            type: "crunchyroll",
            text: "A simulcast premiere is the worst moment for a DNS failure, because millions of players start at once. A platform like Crunchyroll would likely freeze DNS changes around big premieres and rely on the player and playback API to move sessions between CDNs. This is assumed practice, not a published fact.",
          },
        },
        {
          kind: "reveal",
          prompt: "A teammate says: \"We run two authoritative DNS providers for our zone, so a CDN's DNS outage cannot hurt us.\" What do you say?",
          answer:
            "Two providers protect **your** zone only. Once your hostname is a CNAME to a CDN, **the CDN's DNS is your DNS**, as Akamai 2021 showed.\n\n" +
            "The defense is **independent hostnames per CDN**, so the playback API and the player can switch to another vendor without waiting for any DNS change.",
        },
        {
          kind: "summary",
          points: [
            "Anycast is simple, scalable and DDoS-resistant, but sent about 20% of Bing clients to a suboptimal site.",
            "DNS steering uses performance data and steers across vendors, but is TTL-bound and affects new connections only.",
            "Dyn 2016: one DNS provider is a single point of failure. Akamai 2021: the CDN's DNS is your DNS.",
            "Facebook 2021: global floors on automatic removal. AWS 2025: no empty answers, compare-and-set, cache delays recovery.",
            "Design for failure: two providers, long TTLs on stable records, hostnames per CDN, outside monitoring.",
          ],
        },
      ],
    },

    /* ======================= Lesson 7 ======================= */
    {
      id: "ch03-l7",
      title: "DNSSEC and a design for Crunchyroll",
      goal: "Explain what DNSSEC does and why it is risky, then sketch and size a DNS design for a platform like Crunchyroll.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "What does DNSSEC give you?",
          options: [
            "Encryption of DNS queries",
            "Integrity and authenticity of DNS answers",
            "Protection from DDoS attacks",
            "Faster lookups",
          ],
          answer: 1,
          explain: "[[DNSSEC]] signs DNS data so a validating resolver can check that an answer came from the zone owner unchanged. It gives **integrity and authenticity**. Encryption is DoH and DoT, and it does not protect against DDoS.",
        },
        {
          kind: "read",
          title: "The pieces of DNSSEC",
          body:
            "- **DNSKEY**: the zone's public keys, often split into a **KSK** (key signing key) and a **ZSK** (zone signing key).\n" +
            "- **RRSIG**: a signature over a set of records.\n" +
            "- **DS** (delegation signer): a hash of your KSK in the **parent** zone (e.g. `.com`), linking the chain of trust to you.\n" +
            "- **NSEC / NSEC3**: signed proof that a name or type does **not** exist.\n\n" +
            "A validating resolver walks the chain from the root. If anything fails, it returns **SERVFAIL** to every user of that resolver.",
        },
        {
          kind: "match",
          prompt: "Match each DNSSEC record to its job.",
          pairs: [
            ["DNSKEY", "The zone's public keys (KSK and ZSK)"],
            ["RRSIG", "A signature over a set of records"],
            ["DS", "Hash of your KSK, published in the parent"],
            ["NSEC / NSEC3", "Signed proof that something does not exist"],
          ],
          explain: "DNSKEY holds keys, RRSIG holds signatures, DS links the parent to your key, and NSEC/NSEC3 prove non-existence. A failure anywhere in the chain means SERVFAIL for every user of that validating resolver.",
        },
        {
          kind: "read",
          title: "Slack 2021, problem 1",
          body:
            "Slack tried to enable DNSSEC on `slack.com` three times in September 2021. The third attempt, on September 30, caused an outage for under 1 percent of users that lasted about 24 hours.\n\n" +
            "First, a provider bug in how signed NSEC responses were generated for wildcard records made some validating resolvers believe `app.slack.com` had no AAAA record **and** nothing else. So clients did not fall back to A lookups. The bad answer was cached.",
        },
        {
          kind: "read",
          title: "Slack 2021, problem 2",
          body:
            "During rollback, the team removed the DS record and then un-signed the zone. But \"the '.com.' zone will ask resolvers to cache the slack.com DS record for 24h by default (non modifiable by zone owners)\".\n\n" +
            "Resolvers that still held the DS expected signatures that no longer existed. They returned SERVFAIL.",
        },
        {
          kind: "quiz",
          prompt: "Why did removing the DS record not fix Slack at once?",
          options: [
            "The registrar ignored the change",
            "Resolvers kept the cached DS for up to 24 hours, set by .com, and still expected signatures",
            "The zone was still signed",
            "SERVFAIL answers are never cached",
          ],
          answer: 1,
          explain: "The `.com` zone sets a 24-hour DS TTL that zone owners cannot change. Resolvers holding the old DS kept expecting signatures, so un-signing the zone produced SERVFAIL. A DNSSEC rollback plan must be built around the parent's DS TTL.",
        },
        {
          kind: "read",
          title: "DNSSEC and CDNs",
          body:
            "- Signing your zone covers only your records. After a CNAME into a CDN's zone, the chain is signed only if the CDN signs its zone.\n" +
            "- GSLB answers are computed per query, so they need **online signing**. That adds CPU and response size. Larger responses push more queries to TCP or fragmented UDP.\n" +
            "- In the 2026-11-14 snapshot, `crunchyroll.com` had no DS record in `.com`, so it was not DNSSEC-signed then. That is a common choice for large consumer services, not a flaw by itself.",
        },
        {
          kind: "reveal",
          prompt: "Someone proposes DNSSEC on the video domain. What do you ask in the design review?",
          answer:
            "- What threat does it stop for us?\n" +
            "- Which zones in the CNAME chain will actually be signed?\n" +
            "- What is the rollback plan, given the parent's DS TTL?\n" +
            "- Have we tested every record type we use with major validating resolvers?\n\n" +
            "A mistake can break every validating user for a day.",
        },
        {
          kind: "read",
          title: "Split hostnames by job",
          body:
            "Now put the chapter together. This is an **assumed** design sketch using the book's assumed traffic model, not Crunchyroll's real setup. Step one: give each job its own hostname and its own DNS approach.",
          visual: {
            kind: "table",
            headers: ["Hostname role", "Steering need", "Suggested DNS approach"],
            rows: [
              ["Website and app API front door", "Stable, DDoS-resistant", "Anycast CDN front door, long-lived records"],
              ["Playback API (control plane)", "Nearest healthy cloud region, AWS and GCP", "Latency or geo routing with health checks, short TTL, pre-created failover records"],
              ["Static assets and images", "Cache-friendly, cheap", "CNAME to one CDN, longer TTL"],
              ["Video manifests and segments", "Per-session CDN choice, fast failover", "One hostname per CDN, chosen by the playback API, plus a DNS-steered shared hostname as fallback"],
            ],
            caption: "Assumed design, not Crunchyroll's real setup",
          },
        },
        {
          kind: "match",
          prompt: "Match each hostname role to its DNS approach.",
          pairs: [
            ["Website front door", "Anycast CDN, long-lived records"],
            ["Playback API", "Latency or geo routing, health checks, short TTL"],
            ["Static assets", "CNAME to one CDN, longer TTL"],
            ["Video segments", "One hostname per CDN, chosen by the playback API"],
          ],
          explain: "Each job gets the DNS it needs: stable and DDoS-resistant for the front door, region failover for the API, cheap and cacheable for static assets, and per-session vendor choice for video.",
        },
        {
          kind: "read",
          title: "The playback path, part 1",
          body:
            "The player resolves one playback API hostname. A GSLB with health checks sends it to a healthy playback service in an AWS region or a GCP region.\n\n" +
            "This is a coarse job: region failover. DNS is good at it.",
          visual: { kind: "flow", spec: { ...designFlow, focus: ["p", "api", "gs", "aws", "gcp", "p>api", "api>gs", "gs>aws", "gs>gcp"], flow: ["p>api", "api>gs", "gs>aws"] }, caption: "Assumed design: DNS picks a healthy cloud region" },
        },
        {
          kind: "read",
          title: "The playback path, part 2",
          body:
            "The response lists CDN hostnames in priority order. Each is a CNAME to one CDN, whose own mapping picks a PoP.\n\n" +
            "Per-session CDN choice happens in the playback API, which sees the viewer's real IP (Chapter 9). The player falls back to the second hostname on errors **without waiting for any TTL** (Chapter 10).",
          visual: { kind: "flow", spec: { ...designFlow, focus: ["m", "h1", "h2", "e1", "e2", "m>h1", "m>h2", "h1>e1", "h2>e2"], flow: ["m>h1", "h1>e1"] }, caption: "Assumed design: the API picks the CDN, each CDN picks a PoP" },
        },
        {
          kind: "quiz",
          prompt: "CDN A starts returning errors mid-session. In this design, how does the player escape fastest?",
          visual: { kind: "flow", spec: { ...designFlow, focus: ["m", "h1", "h2", "e2", "m>h2", "h2>e2"], flow: ["m>h2", "h2>e2"] } },
          options: [
            "Wait for the DNS TTL on video-cdn-a to expire",
            "Switch to the second hostname (video-cdn-b) from the list it already has",
            "Ask the GSLB for a new region",
            "Restart the app",
          ],
          answer: 1,
          explain: "The player already holds a list of CDN hostnames. It falls back to the next one on errors, with no TTL in the way. DNS only does the coarse jobs: region failover for the API and PoP selection inside each CDN.",
        },
        {
          kind: "read",
          title: "Back-of-envelope: query load at a premiere",
          body:
            "How many queries per second hit the authoritative servers for steered hostnames at a premiere? All values are assumed. There are three steered hostnames (API, CDN A, CDN B), each with a 60-second TTL.",
          visual: {
            kind: "stats",
            items: [
              { value: "2M", label: "concurrent streams at the spike" },
              { value: "200,000", label: "distinct client /24 blocks" },
              { value: "20,000", label: "distinct recursive resolvers" },
              { value: "60 s x 3", label: "TTL on each of 3 steered names" },
            ],
            caption: "Assumed values",
          },
        },
        {
          kind: "number",
          prompt: "Without ECS, each resolver asks once per TTL per name. 20,000 resolvers, 60 s TTL, 3 names. About how many queries per second?",
          answer: 1000,
          tolerance: 100,
          unit: "qps",
          hint: "resolvers / TTL x names",
          explain: "20,000 / 60 x 3 = **about 1,000 queries per second**.",
        },
        {
          kind: "number",
          prompt: "With ECS and /24 scopes, each resolver keeps one entry per client block. 200,000 blocks, 60 s TTL, 3 names. About how many queries per second?",
          answer: 10000,
          tolerance: 1000,
          unit: "qps",
          explain: "200,000 / 60 x 3 = **about 10,000 queries per second**: ten times more, because the cache is now split by client block.",
        },
        {
          kind: "number",
          prompt: "Same ECS case, but you shorten the TTL to 20 seconds. About how many queries per second now?",
          answer: 30000,
          tolerance: 3000,
          unit: "qps",
          explain: "200,000 / 20 x 3 = **about 30,000 queries per second**. A TTL three times shorter means three times the queries.",
        },
        {
          kind: "read",
          title: "The real lesson: cost and dependency",
          body:
            "These are small numbers for managed anycast DNS. The lesson is **cost and dependency**: each halving of TTL doubles the query bill and your reliance on the authoritative service.\n\n" +
            "Akamai's eight-fold ECS increase shows the multiplier is real.",
        },
        {
          kind: "number",
          prompt: "A CDN carries half of an 8 Tbps premiere spike and fails. At 4 Mbps per stream, about how many sessions are on it?",
          answer: 1,
          tolerance: 0.1,
          unit: "M sessions",
          hint: "Half of 8 Tbps is 4 Tbps = 4,000,000 Mbps.",
          explain: "4 Tbps / 4 Mbps = 4,000,000 / 4 = **about 1M sessions**. With only DNS moving traffic (about 2 minutes), all of them are exposed at the moment most fans are watching.",
        },
        {
          kind: "read",
          title: "Why DNS is the backstop for video",
          body:
            "With DNS-only failover, about 1M sessions suffer for about 2 minutes. With player fallback to a second CDN hostname, the same failure costs **one failed segment request and a short retry** per session.\n\n" +
            "That is the strongest argument for keeping DNS as the backstop, not the primary failover, for video.",
        },
        {
          kind: "summary",
          points: [
            "DNSSEC gives integrity, not privacy or DDoS protection; a failed chain means SERVFAIL.",
            "Slack 2021: a provider NSEC bug plus a rollback that ignored the 24-hour DS TTL. Plan rollbacks around the parent's DS TTL.",
            "Assumed design: split hostnames by job; DNS for region failover and PoP choice, the playback API for per-session CDN choice.",
            "Query load = resolvers or client blocks / TTL x names: about 1,000, 10,000 or 30,000 qps in the premiere example.",
            "Player fallback turns a CDN failure into one failed segment request, so DNS stays the backstop.",
          ],
        },
      ],
    },

    /* ======================= Lesson 8: Checkpoint ======================= */
    {
      id: "ch03-l8",
      title: "Checkpoint",
      goal: "Check your understanding of DNS and global traffic steering with the chapter's questions.",
      minutes: 8,
      steps: [
        {
          kind: "quiz",
          prompt: "A player is mid-episode on CDN A when you switch the video hostname to CDN B with a 30-second TTL. Two minutes later, is it on CDN B?",
          options: [
            "Yes: 30 seconds have passed four times over",
            "Probably not: the player keeps its HTTP/2 or HTTP/3 connection to CDN A",
            "Yes, but only on HTTP/3",
            "No, because the TTL is too short to be honored",
          ],
          answer: 1,
          explain: "Probably not. DNS changes affect only new connections, and the player keeps its HTTP/2 or HTTP/3 connection to CDN A until it breaks or reconnects.",
        },
        {
          kind: "reveal",
          prompt: "You must move a hostname with a 1-hour TTL to a new CDN tonight. What do you do, and when?",
          answer:
            "Lower the TTL at least one old-TTL period earlier (for example, a day before). Pre-create the new records and certificates. Switch. Watch errors by region and ASN. Then raise the TTL again.",
        },
        {
          kind: "order",
          prompt: "Put the CDN migration steps in order.",
          items: [
            "Lower the TTL, a day before",
            "Pre-create the new records and certificates",
            "Switch the hostname to the new CDN",
            "Watch errors by region and ASN",
            "Raise the TTL again",
          ],
          explain: "Lowering the TTL first lets the long old TTL drain out of caches before the switch. Pre-creating records avoids cached NXDOMAINs and missing certificates.",
        },
        {
          kind: "reveal",
          prompt: "Why might a viewer in Brazil using a public resolver get a far-away PoP? How does ECS help, and what does it cost?",
          answer:
            "The CDN sees the public resolver's location, which may be in another country. ECS passes the viewer's /24, so the CDN maps by the viewer's network.\n\n" +
            "Costs: privacy, larger resolver caches, and many more authoritative queries (about eight times in Akamai's rollout).",
        },
        {
          kind: "quiz",
          prompt: "Three weighted Route 53 records for CDNs A, B and C all fail their health checks at once. What does Route 53 return?",
          options: [
            "An empty answer",
            "NXDOMAIN",
            "It treats all three as healthy and answers by weight",
            "Only the record with the highest weight",
          ],
          answer: 2,
          explain: "It treats all three as healthy and answers by weight. Some answer beats none, and \"everything unhealthy\" often means the checker or a shared dependency is at fault.",
        },
        {
          kind: "quiz",
          prompt: "A Route 53 HTTPS health check passes, but every player fails with a TLS error. How?",
          options: [
            "The check uses HTTP/1.1 and players use HTTP/3",
            "Route 53 HTTPS health checks do not validate certificates",
            "More than 18% of checkers were in one region",
            "String matching only reads 5,120 bytes",
          ],
          answer: 1,
          explain: "Route 53 HTTPS health checks do not validate certificates. Monitor certificates separately, or fail over on real error metrics.",
        },
        {
          kind: "multi",
          prompt: "Which are lessons from the October 2025 DynamoDB DNS incident for a steering service you might build?",
          options: [
            "Never publish an empty answer or a plan that drops too much capacity",
            "Make the version check and the write atomic",
            "Never let cleanup delete the live plan",
            "Cached DNS delays recovery even after the fix",
            "Run only one Enactor so there is no race",
          ],
          answers: [0, 1, 2, 3],
          explain: "All four are the book's lessons: no empty answers or big capacity drops, compare-and-set instead of check-then-act, cleanup that never deletes the live plan, and remembering that cached DNS delays recovery. Removing redundancy is not the lesson; atomic writes are.",
        },
        {
          kind: "reveal",
          prompt: "Give one advantage and one disadvantage of anycast versus DNS steering, citing the Bing study.",
          answer:
            "**Advantage:** simple, scalable, spreads DDoS.\n\n" +
            "**Disadvantage:** no performance control. About 20 percent of clients went to a suboptimal front-end, at least 25 ms slower for 20 percent of requests.",
        },
        {
          kind: "number",
          prompt: "With DNS alone, about how many minutes does it take to move most new requests off a dead CDN? (Give the middle of the range.)",
          answer: 2,
          tolerance: 1,
          unit: "min",
          explain: "About **1 to 3 minutes**: about 30 s to detect, seconds to tens of seconds to change the answer, up to 60 s for resolver caches, plus client caches and open connections. That is why DNS is the backstop.",
        },
        {
          kind: "number",
          prompt: "In Akamai's rollout of end-user mapping, DNS queries to its name servers rose by roughly what factor?",
          answer: 8,
          tolerance: 0.5,
          unit: "x",
          explain: "Roughly **eight-fold** for the affected traffic, because resolvers keep separate cache entries per client block. The same rollout gave an eight-fold decrease in mapping distance and 30% better TTFB.",
        },
        {
          kind: "quiz",
          prompt: "Which TTL rule does the chapter recommend?",
          options: [
            "Short TTLs everywhere, for agility",
            "Long TTLs everywhere, for resilience",
            "Long TTLs on stable records and delegations, short TTLs only on records you steer",
            "Lower TTLs during incidents",
          ],
          answer: 2,
          explain: "TTL is the main dial. Long on stable records and delegations, short only on steered records. Lower TTLs well before planned changes, never during an incident.",
        },
        {
          kind: "multi",
          prompt: "Which statements match the chapter's key takeaways?",
          options: [
            "DNS is a slow, cached, eventually consistent control plane, blind to sessions already connected",
            "A CNAME hands a hostname to a CDN, and the CDN's DNS becomes your dependency",
            "Authoritative servers see the viewer's real IP",
            "Real systems combine anycast, DNS and application-level steering",
            "DNSSEC encrypts DNS queries",
          ],
          answers: [0, 1, 3],
          explain: "Authoritative servers see the **resolver**, not the viewer; ECS fixes much of that. DNSSEC gives integrity, not privacy. The other three are key takeaways.",
        },
        {
          kind: "reveal",
          prompt: "DNS fails often and widely. Name the four incidents from this chapter and the defenses they point to.",
          answer:
            "Dyn 2016, Akamai 2021, Facebook 2021 and AWS 2025.\n\n" +
            "Defenses: multiple DNS providers where it matters, global floors on automatic removal, validated automation, and no control-plane edits in the recovery path.",
        },
        {
          kind: "widget",
          widget: "dns-resolve",
          title: "Final lab",
          task: "Run all three parts once more: follow a lookup, see the ECS effect for a far public resolver, and finish one TTL outage run.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "DNS is the first steering decision: slow, cached, eventually consistent. Good for coarse steering and minutes-scale failover, blind to connected sessions.",
            "TTL is the main dial: long on stable records, short only on steered ones; lower it well before changes, never during an incident. A CNAME makes the CDN's DNS your dependency.",
            "Authoritative servers see the resolver. ECS fixes much of this (8x shorter mapping distance, 30% better TTFB) at the cost of many more queries; 1.1.1.1 does not send it.",
            "GSLB composes geo, latency, weighted, IP-based and failover policies. Know fail-open and that Route 53 HTTPS checks skip certificate validation.",
            "Anycast is simple and DDoS-resistant but sent about 20% of Bing clients to a suboptimal site. Real systems combine anycast, DNS and app-level steering.",
            "DNS fails often (Dyn, Akamai, Facebook, AWS). DNSSEC gives integrity, not privacy, and needs rollbacks planned around the parent's DS TTL.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Mockapetris, P. RFC 1034, \"Domain Names - Concepts and Facilities\", 1987. https://www.rfc-editor.org/rfc/rfc1034",
    "Contavalli, C. et al. RFC 7871, \"Client Subnet in DNS Queries\", May 2016. https://www.rfc-editor.org/rfc/rfc7871.html",
    "Chen, F. et al. \"End-User Mapping: Next Generation Request Routing for Content Delivery\", ACM SIGCOMM 2015. https://groups.cs.umass.edu/ramesh/wp-content/uploads/sites/3/2019/12/End-user-mapping-Next-generation-request-routing-for-content-delivery.pdf",
    "Moura, G. et al. \"Cache Me If You Can: Effects of DNS Time-to-Live\", ACM IMC 2019. https://ant.isi.edu/~johnh/PAPERS/Moura19b.pdf",
    "Calder, M. et al. \"Analyzing the Performance of an Anycast CDN\", ACM IMC 2015. https://courses.cs.duke.edu/fall19/compsci514/papers/anycast-imc15.pdf",
    "Amazon Route 53 Developer Guide, \"Choosing a routing policy\". https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html",
    "Amazon Route 53 Developer Guide, \"How Amazon Route 53 determines whether a health check is healthy\". https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-determining-health-of-endpoints.html",
    "Amazon Route 53 Developer Guide, \"How Amazon Route 53 chooses records when health checking is configured\" and \"How health checks work in complex Amazon Route 53 configurations\". https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/health-checks-how-route-53-chooses-records.html and https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-complex-configs.html",
    "Amazon Route 53 Developer Guide, \"How Amazon Route 53 uses EDNS0 to estimate the location of a user\". https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-edns0.html",
    "Amazon Route 53 Developer Guide, \"Choosing between alias and non-alias records\". https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html",
    "Google Cloud DNS documentation, \"DNS routing policies and health checks\" overview. https://docs.cloud.google.com/dns/docs/routing-policies-overview",
    "IBM NS1 Connect product page (traffic steering, filter chains, Pulsar RUM/Multi-CDN). https://www.ibm.com/products/ns1-connect",
    "Cloudflare 1.1.1.1 FAQ (ECS behaviour). https://developers.cloudflare.com/1.1.1.1/faq/",
    "Amazon CloudFront Developer Guide, \"How CloudFront delivers content\". https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowCloudFrontWorks.html",
    "AWS whitepaper, \"AWS Fault Isolation Boundaries: Global services\" (Route 53 control plane in us-east-1, standby control plane endpoint in us-west-2 announced December 2025). https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html",
    "AWS, \"Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region\", October 2025. https://aws.amazon.com/message/101925",
    "Dyn statement on the October 21, 2016 DDoS attack (Kyle York), as archived on the Interesting People list. https://seclists.org/interesting-people/2016/Oct/59",
    "Huston, G. \"The Akamai outage\", ISP Column, July 2021 (quotes Akamai's incident statements). https://www.potaroo.net/ispcol/2021-07/outage.pdf",
    "Meta Engineering, \"More details about the October 4 outage\", October 2021. https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/",
    "Slack Engineering, \"What Happened During Slack's DNSSEC Rollout\", 2021. https://slack.engineering/what-happened-during-slacks-dnssec-rollout/",
    "Schwartz, B. et al. RFC 9460, \"Service Binding and Parameter Specification via the DNS (SVCB and HTTPS Resource Records)\", November 2023. https://www.rfc-editor.org/rfc/rfc9460.html",
    "Andrews, M. RFC 2308, \"Negative Caching of DNS Queries (DNS NCACHE)\", 1998. https://www.rfc-editor.org/rfc/rfc2308",
    "Lawrence, D. et al. RFC 8767, \"Serving Stale Data to Improve DNS Resiliency\", March 2020. https://www.rfc-editor.org/rfc/rfc8767",
    "Author's public DNS observations with dig from one US vantage point on 2026-11-14 (crunchyroll.com NS, SOA and A records, static.crunchyroll.com CNAME, disneyplus.com, hulu.com and twitch.tv CNAME chains, absence of a DS record for crunchyroll.com). Snapshot only; records change.",
    "Arends, R. et al. RFC 4033, \"DNS Security Introduction and Requirements\", 2005. https://www.rfc-editor.org/rfc/rfc4033",
  ],
};
export default chapter;
