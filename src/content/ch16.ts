import type { Chapter, FlowSpec } from "./types";

// Chapter 16 content. Source: chapters/16-economics-of-delivery.md
// All Crunchyroll traffic numbers are the book's ASSUMED model. All list prices are 2026 list prices.

/* ---------------- Shared diagrams (built up across steps with focus/flow) ---------------- */

/** 16.2 The cost map: every meter in the delivery path. */
const costMap: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "store", label: "Object storage", sub: "mezzanine + packaged", kind: "storage", col: 0, row: 0 },
    { id: "origin", label: "Origin", sub: "S3 or GCS, optional JIT", kind: "origin", col: 1, row: 0 },
    { id: "shield", label: "Origin shield", sub: "or mid-tier cache", kind: "shield", col: 2, row: 0 },
    { id: "edge", label: "CDN edge PoPs", kind: "edge", col: 3, row: 0 },
    { id: "origin2", label: "Second origin", sub: "another cloud", kind: "cloud", col: 1, row: 2 },
    { id: "obs", label: "Observability", sub: "CDN logs, RUM, Datadog", kind: "monitor", col: 2, row: 2 },
    { id: "player", label: "ISP + player", sub: "last mile, device", kind: "player", col: 3, row: 2 },
  ],
  edges: [
    { from: "store", to: "origin", label: "GB-mo, PUT/GET" },
    { from: "origin", to: "shield", label: "egress, JIT fee" },
    { from: "shield", to: "edge", label: "shield requests" },
    { from: "edge", to: "player", label: "per GB or Mbps" },
    { from: "origin", to: "origin2", label: "replication", dashed: true },
    { from: "origin2", to: "shield", label: "egress per GB", dashed: true },
    { from: "edge", to: "obs", label: "log volume", dashed: true },
  ],
};

/** 16.8 Cache hit ratio is money: where 540 PB comes from. */
const hitMap: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "total", label: "540 PB delivered", sub: "per month (assumed)", kind: "viewer", col: 0, row: 0 },
    { id: "edgeHit", label: "Edge hits 95%", sub: "513 PB from edge cache", kind: "edge", col: 0, row: 1, tone: "good" },
    { id: "edgeMiss", label: "Edge misses 5%", sub: "27 PB go to shield", kind: "edge", col: 1, row: 0, tone: "warn" },
    { id: "shieldHit", label: "Shield hits 80%", sub: "21.6 PB of the misses", kind: "shield", col: 1, row: 1, tone: "good" },
    { id: "originFill", label: "Origin fills", sub: "5.4 PB from origin", kind: "origin", col: 2, row: 0, tone: "warn" },
    { id: "bill", label: "Egress bill", sub: "depends on pairing", kind: "cloud", col: 3, row: 0 },
  ],
  edges: [
    { from: "total", to: "edgeHit", label: "95% HIT" },
    { from: "total", to: "edgeMiss", label: "5% MISS" },
    { from: "edgeMiss", to: "shieldHit", label: "80% of misses" },
    { from: "edgeMiss", to: "originFill", label: "20% of misses" },
    { from: "originFill", to: "bill" },
  ],
};


/** 16.7.2 Multi-CDN multiplies fills. */
const multiFill: FlowSpec = {
  direction: "right",
  nodes: [
    { id: "origin", label: "Origin", sub: "one S3 bucket", kind: "origin", col: 0, row: 2 },
    { id: "shA", label: "CDN A shield", kind: "shield", col: 2, row: 0 },
    { id: "shB", label: "CDN B shield", kind: "shield", col: 2, row: 2 },
    { id: "shC", label: "CDN C shield", kind: "shield", col: 2, row: 4 },
    { id: "edA", label: "CDN A edges", kind: "edge", col: 4, row: 0 },
    { id: "edB", label: "CDN B edges", kind: "edge", col: 4, row: 2 },
    { id: "edC", label: "CDN C edges", kind: "edge", col: 4, row: 4 },
  ],
  edges: [
    { from: "origin", to: "shA", label: "cold fill 1", tone: "warn" },
    { from: "origin", to: "shB", label: "cold fill 2", tone: "warn" },
    { from: "origin", to: "shC", label: "cold fill 3", tone: "warn" },
    { from: "shA", to: "edA" },
    { from: "shB", to: "edB" },
    { from: "shC", to: "edC" },
  ],
};

/** 16.13 Cost-aware steering decision. */
const steer: FlowSpec = {
  direction: "down",
  nodes: [
    { id: "filter", label: "Filter by QoE", sub: "per region and ISP", kind: "steering", col: 1, row: 0 },
    { id: "none", label: "None passes", sub: "best QoE, ignore cost", kind: "monitor", col: 3, row: 0, tone: "bad", badge: "ALERT" },
    { id: "state", label: "Contract state", sub: "marginal cost per CDN", kind: "service", col: 1, row: 1 },
    { id: "zero", label: "Near zero", sub: "paid for anyway", kind: "generic", col: 0, row: 2, tone: "good" },
    { id: "low", label: "Low", sub: "stays below p95", kind: "generic", col: 1, row: 2, tone: "good" },
    { id: "high", label: "High", sub: "would raise p95", kind: "generic", col: 2, row: 2, tone: "bad" },
    { id: "over", label: "Overage rate", sub: "per-GB billing", kind: "generic", col: 3, row: 2, tone: "warn" },
    { id: "weight", label: "Weight by cost", sub: "hysteresis + min share", kind: "steering", col: 1, row: 3, tone: "accent" },
  ],
  edges: [
    { from: "filter", to: "none", label: "none pass", tone: "bad" },
    { from: "filter", to: "state", label: "some pass" },
    { from: "state", to: "zero", label: "commit unfilled" },
    { from: "state", to: "low", label: "below p95" },
    { from: "state", to: "high", label: "raises p95" },
    { from: "state", to: "over", label: "over commit" },
    { from: "zero", to: "weight" },
    { from: "low", to: "weight" },
    { from: "high", to: "weight" },
    { from: "over", to: "weight" },
  ],
};



const chapter: Chapter = {
  n: 16,
  title: "The Economics of Delivery",
  short: "Economics",
  part: 5,
  hook: "About 540 PB a month. Where the money goes, and the few levers that really move the bill.",
  lessons: [
    /* ================= Lesson 1: the cost map ================= */
    {
      id: "ch16-l1",
      title: "Every byte has a price",
      goal: "Explain why delivery cost is an engineering input and name every meter on the delivery path.",
      minutes: 8,
      steps: [
        {
          kind: "quiz",
          prompt: "A new anime becomes a huge hit. Viewing hours triple this month. What happens to the delivery bill?",
          options: [
            "It stays flat, because the CDN contract is fixed",
            "It grows roughly with the viewing hours",
            "It falls, because volume discounts kick in",
            "Only the storage bill grows",
          ],
          answer: 1,
          explain:
            "**Cost is proportional to success.** A video service sends megabytes per second per viewer for hours. When a show becomes a hit, the bill grows with it. Volume tiers soften the price per GB a little, but the bill still grows. A good premiere is also an expensive premiere.",
        },
        {
          kind: "read",
          title: "Many companies charge for one byte",
          body:
            "Every byte that reaches a viewer has a price, and usually several companies charge for it: the cloud that stores it, the cloud that sends it out, the CDN that caches and delivers it, and sometimes a [[packager]] on the way.\n\n" +
            "For a video platform, delivery is one of the biggest infrastructure bills, and it grows with every hour watched. So delivery cost is a **design input**, not an afterthought for finance.",
        },
        {
          kind: "read",
          title: "The levers are engineering decisions",
          body:
            "Many cost levers sit in your hands, not in finance:\n\n" +
            "- [[Segment]] duration changes the request count.\n" +
            "- [[Cache key]] design changes the hit ratio.\n" +
            "- [[Shield]] placement changes origin [[egress]].\n" +
            "- [[Codec]] choice changes bytes per hour.\n" +
            "- Which CDN gets which country is a [[steering]] decision.\n\n" +
            "None of these is a finance decision. All of them move the bill.",
        },
        {
          kind: "match",
          prompt: "Match each engineering choice to what it changes on the bill.",
          pairs: [
            ["Segment duration", "Request count"],
            ["Cache key design", "Hit ratio"],
            ["Shield placement", "Origin egress"],
            ["Codec choice", "Bytes per hour"],
            ["Steering", "Which CDN serves a country"],
          ],
          explain:
            "Each lever is a design decision. Shorter segments mean more requests. A messy cache key lowers the hit ratio. Shield placement decides how many bytes leave the origin and where. A better codec sends fewer bytes per hour. Steering decides which vendor (and which price) carries each country.",
        },
        {
          kind: "read",
          title: "Cost and reliability trade off",
          body:
            "[[Multi-CDN]], multi-origin and multi-cloud designs (Chapters 6, 9 and 12) remove single points of failure. But each extra provider adds:\n\n" +
            "- more cache fills,\n- duplicate storage,\n- smaller volume per vendor, which weakens your discount.\n\n" +
            "A staff engineer can say what resilience costs, in dollars per month, and defend it.",
          callout: {
            type: "staff",
            text:
              "In a design review, \"this is cheaper\" is not an argument. \"This saves about 5 PB of origin egress per month, roughly $250k at list or a fraction of that at our contract rate, and it does not hurt startup time\" is an argument. Convert every change into bytes, requests or storage, then into money, then compare with QoE impact.",
          },
        },
        {
          kind: "quiz",
          prompt: "Your team adds a third CDN for resilience. Which cost effect should you expect?",
          options: [
            "Lower origin egress, because traffic is spread out",
            "More cold fills at the origin and a smaller discount per vendor",
            "No change, because CDNs bill only what they deliver",
            "Faster startup for free",
          ],
          answer: 1,
          explain:
            "Each extra provider misses independently, so the origin sees more fills. Each vendor also gets less volume, which weakens your discount. Resilience is worth paying for, but you should know the price.",
        },
        {
          kind: "read",
          title: "List prices are a ceiling, not the market",
          body:
            "One rule runs through this chapter: **list prices are a ceiling, not the market.**\n\n" +
            "Published prices are useful because they are public, dated and comparable. But large streaming customers sign private contracts that are often **ten times or more** below list.\n\n" +
            "So every list price here carries its year. Every \"negotiated\" figure is either from a published industry survey or clearly marked as an assumption.",
        },
        {
          kind: "read",
          title: "Meters: storage",
          body:
            "A **meter** is any quantity a provider counts and bills: GB transferred, requests, GB-months stored, Mbps at the 95th percentile, minutes delivered.\n\n" +
            "The first meter is **storage**. Object storage charges per **GB-month** (one gigabyte stored for one month), plus per-request fees for writes (PUT) and reads (GET). Storage class choices change the rate by up to about **6x** between hot and cold classes.",
          visual: { kind: "flow", spec: { ...costMap, focus: ["store", "origin", "store>origin"] }, caption: "Every place a meter runs, from storage to the player" },
        },
        {
          kind: "read",
          title: "Meters: origin egress, packaging, shield",
          body:
            "- **Origin egress.** When a CDN fetches from your cloud origin, the cloud may charge for data leaving it. This depends on which cloud and which CDN are paired.\n" +
            "- **Packaging.** With [[just-in-time (JIT) packaging|Just-in-time packaging (JIT)]], a service builds HLS or DASH segments on request. Managed packagers charge per GB they output.\n" +
            "- **Shield.** An [[origin shield|Origin Shield]] adds a request fee at some vendors.",
          visual: { kind: "flow", spec: { ...costMap, focus: ["origin", "shield", "origin>shield", "shield>edge"], flow: ["origin>shield", "shield>edge"] } },
        },
        {
          kind: "read",
          title: "Meters: CDN delivery, the big one",
          body:
            "**CDN delivery** is the biggest meter. CDNs bill bytes delivered, either **per GB** or **per Mbps at the 95th percentile**, and often requests too.\n\n" +
            "Every viewer, every hour, every segment passes this meter. That is why most of this chapter is about how CDNs charge and what big customers really pay.",
          visual: { kind: "flow", spec: { ...costMap, focus: ["edge", "player", "edge>player"], flow: ["shield>edge", "edge>player"] } },
        },
        {
          kind: "read",
          title: "Meters: replication and observability",
          body:
            "- **Replication.** Copying content to another cloud pays the source cloud's egress rate.\n" +
            "- **Observability.** Every segment request makes a log line. Shipping and indexing billions of them is a real cost (Chapter 11).",
          visual: { kind: "flow", spec: { ...costMap, focus: ["origin2", "obs", "origin>origin2", "origin2>shield", "edge>obs"] } },
          callout: {
            type: "mistake",
            text:
              "Looking only at the CDN invoice. Dan Rayburn noted in 2019 that customers \"need to be wary of Amazon's egress charges which sometimes, can be larger than the CDN bill itself.\" That is an extreme case, but it shows why you must see the whole map.",
          },
        },
        {
          kind: "reveal",
          prompt:
            "Your CDN invoice dropped 20% after a renegotiation. Your manager says \"delivery is now cheaper.\" What do you check before you agree?",
          answer:
            "Check the **whole cost map**, not just the CDN invoice: origin egress from the cloud, managed packager fees, shield request fees, cross-cloud replication, and log shipping. Origin egress alone can sometimes be larger than the CDN bill. A cheaper CDN that pulls more fills from a paid origin path may not be cheaper at all.",
        },
        {
          kind: "multi",
          prompt: "Which of these are meters on the delivery path? Select all that apply.",
          options: [
            "GB-months stored in object storage",
            "Origin egress per GB",
            "Mbps at the 95th percentile",
            "Log volume from CDN request logs",
            "The viewer's home Wi-Fi speed",
            "The number of episodes in the catalog",
          ],
          answers: [0, 1, 2, 3],
          explain:
            "A meter is something a provider counts and bills. Storage, egress, 95th-percentile Mbps and log volume all appear on invoices. Wi-Fi speed affects quality, not your bill. Episode count matters only through the bytes stored, which is the GB-month meter.",
        },
        {
          kind: "order",
          prompt: "Put the meters in order along the path, from where content sits to the viewer.",
          items: [
            "Storage GB-months",
            "Origin egress",
            "Shield requests",
            "CDN bytes delivered",
          ],
          explain:
            "Content sits in object storage (GB-months). A CDN miss pulls it out of the cloud (origin egress). The shield adds request fees at some vendors. The edge delivers to viewers (CDN bytes, the big meter).",
        },
        {
          kind: "summary",
          points: [
            "Delivery cost grows with viewing: a hit show is also a big bill.",
            "Most cost levers are engineering choices: segments, cache keys, shield placement, codec, steering.",
            "Resilience (more CDNs, origins, clouds) costs fills, storage and discount. Price it in dollars per month.",
            "List prices are a ceiling; big contracts are often 10x or more below list.",
            "Meters: storage, origin egress, packaging, shield, CDN delivery, replication, observability.",
          ],
        },
      ],
    },

    /* ================= Lesson 2: pricing models ================= */
    {
      id: "ch16-l2",
      title: "How CDNs charge",
      goal: "Compare per-GB, per-request, 95th-percentile, bundle and per-minute pricing, and know which choices each one rewards.",
      minutes: 10,
      steps: [
        {
          kind: "quiz",
          prompt: "CDN X quotes $0.004 per GB. CDN Y quotes $0.30 per Mbps per month. Which is cheaper for you?",
          options: [
            "CDN X, the per-GB number is smaller",
            "CDN Y, per-Mbps is always cheaper at scale",
            "You cannot tell without your traffic shape",
            "They cost the same",
          ],
          answer: 2,
          explain:
            "The two quotes measure different things. To compare them you need your **load factor** (how flat your traffic is), which Lesson 3 covers. The **model** matters more than the rate, because the model decides which engineering choices save money.",
        },
        {
          kind: "read",
          title: "Per-GB pricing",
          body:
            "**Per-GB pricing** charges for total bytes delivered in the month. It usually has:\n\n" +
            "- **Volume tiers:** each additional block of traffic is cheaper.\n" +
            "- **Regional rate cards:** each geography has its own price.\n\n" +
            "Amazon CloudFront's pay-as-you-go page (accessed November 2026) is the most detailed public example.",
        },
        {
          kind: "read",
          title: "CloudFront 2026 list, per GB (part 1)",
          body: "Each row is a monthly volume tier. The first 1 TB is free in every region. Notice how fast the US and Europe price falls with volume.",
          visual: {
            kind: "table",
            headers: ["Monthly tier", "US, MX, CA", "Europe", "South America", "Japan"],
            rows: [
              ["First 1 TB", "Free", "Free", "Free", "Free"],
              ["Next 9 TB", "$0.085", "$0.085", "$0.110", "$0.114"],
              ["Next 40 TB", "$0.080", "$0.080", "$0.105", "$0.089"],
              ["Next 350 TB", "$0.040", "$0.040", "$0.080", "$0.084"],
              ["Next 4 PB", "$0.025", "$0.025", "$0.050", "$0.070"],
              ["Over 5 PB", "$0.020", "$0.020", "$0.040", "$0.060"],
            ],
            caption: "Amazon CloudFront pay-as-you-go, accessed November 2026",
          },
        },
        {
          kind: "read",
          title: "CloudFront 2026 list, per GB (part 2)",
          body:
            "The same page says customers \"willing to make minimum traffic **commits** of typically 10 TB/month or higher are eligible for discounted pricing,\" with a 12-month or longer term.\n\n" +
            "AWS itself tells you the table is a **starting point**.",
          visual: {
            kind: "table",
            headers: ["Monthly tier", "Australia, NZ", "India"],
            rows: [
              ["First 1 TB", "Free", "Free"],
              ["Next 9 TB", "$0.114", "$0.109"],
              ["Next 40 TB", "$0.098", "$0.085"],
              ["Next 350 TB", "$0.092", "$0.080"],
              ["Next 4 PB", "$0.085", "$0.075"],
              ["Over 5 PB", "$0.080", "$0.072"],
            ],
            caption: "Amazon CloudFront pay-as-you-go, accessed November 2026",
          },
        },
        {
          kind: "quiz",
          prompt: "At about 540 PB a month, which CloudFront tier do almost all your bytes land in?",
          options: ["Next 9 TB", "Next 350 TB", "Next 4 PB", "Over 5 PB"],
          answer: 3,
          explain:
            "The first four tiers add up to just over 5 PB. Everything above that is in the **Over 5 PB** tier. At 540 PB, more than 99% of bytes pay the top-tier rate, for example $0.020 per GB in the US.",
        },
        {
          kind: "read",
          title: "Fastly's public page",
          body:
            "Fastly's public page (accessed November 2026) lists bandwidth only up to **20 TB per month**, then says \"Contact us for high-volume pricing.\"\n\n" +
            "Its first paid tier is **$0.12 per GB** in North America and Europe, **$0.19** in Asia, Australia and South America, and **$0.28** in India, Africa and South Korea.\n\n" +
            "Fastly states that its fixed-price packages \"are for web pages and web APIs, not streaming.\" A video service at scale is always on a custom contract.",
        },
        {
          kind: "read",
          title: "Google and Akamai: contract only",
          body:
            "**Google Cloud CDN** publishes per-GiB cache egress rates and invites customers serving more than **500 TiB per month** to contact Google for volume discounts.\n\n" +
            "**Google Media CDN**, the streaming product, has no self-serve price list. Its overview says to \"contact your Google Cloud sales representative or account team to get it enabled.\"\n\n" +
            "Akamai does not publish CDN delivery list prices either. For both, the only real price is **the contract**.",
        },
        {
          kind: "quiz",
          prompt: "Your service will deliver hundreds of petabytes a month. Where do you find the real price of Media CDN or Akamai?",
          options: [
            "On their public price pages",
            "In the CloudFront table, scaled by region",
            "In the contract you negotiate with them",
            "In Fastly's fixed-price packages",
          ],
          answer: 2,
          explain:
            "Google Media CDN and Akamai publish no delivery list prices, and Fastly's fixed packages exclude streaming. At this scale the only real price is the negotiated contract.",
        },
        {
          kind: "read",
          title: "Per-request pricing",
          body:
            "Many CDNs also charge **per 10,000 requests**.\n\n" +
            "- CloudFront's 2026 list: **$0.0100** per 10,000 HTTPS requests in North America, up to **$0.0220** in South America. The first 10 million per month are free.\n" +
            "- Fastly lists **$0.01** per 10,000, from 1 million to 100 million requests.\n\n" +
            "Request fees look tiny. But video makes many requests: each segment is one.",
        },
        {
          kind: "number",
          prompt: "A 6-second video segment at 4 Mbps. How big is it?",
          answer: 3,
          tolerance: 0.2,
          unit: "MB",
          hint: "Bits per second x seconds / 8 gives bytes.",
          explain: "4,000,000 bits/s x 6 s / 8 = 3,000,000 bytes = **3 MB**.",
        },
        {
          kind: "quiz",
          prompt: "You switch to 2-second segments. Same bitrate, same total bytes. How many requests do you make now?",
          options: ["The same number", "Twice as many", "Three times as many", "One third as many"],
          answer: 2,
          explain:
            "A 2-second segment at 4 Mbps is 1 MB, one third of a 6-second segment. To move the same bytes you need **three times as many requests**. Request fees punish short segments.",
        },
        {
          kind: "read",
          title: "Request fees punish short segments",
          body:
            "With a separate audio track (common with [[CMAF]], Chapter 7), each audio segment is another request. So every segment duration you shorten multiplies two request streams.\n\n" +
            "A 6-second segment at 4 Mbps is 3 MB. A 2-second segment is 1 MB, so three times as many requests for the same bytes.",
          callout: {
            type: "staff",
            text:
              "When someone proposes shorter segments for faster startup or lower live latency, ask: \"How many more requests per month, are requests billed in our contracts, and what happens to shield efficiency?\" Request fees are often negotiable, so the answer may be \"not much\", but you should know.",
          },
        },
        {
          kind: "read",
          title: "Per Mbps at the 95th percentile",
          body:
            "The largest CDN customers often do not pay per GB at all. Rayburn reported in 2019 that \"the largest CDN customers usually buy on a per Mbps sustained basis.\"\n\n" +
            "This is [[95th percentile billing]], also called **burstable billing**. It comes from how wholesale IP [[transit]] is sold. Cloudflare's 2021 analysis: \"The base unit of wholesale bandwidth is priced as one Megabit per second per month,\" and it \"is also billed at the 95th percentile.\" Lesson 3 goes deep.",
        },
        {
          kind: "read",
          title: "Bundles and flat-rate plans",
          body:
            "CloudFront's flat-rate plans (listed in 2026) run from a **free plan with 100 GB** of transfer to a **$1,000/month plan with 50 TB** (configurable to 600 TB), plus a \"Custom\" plan priced through sales.\n\n" +
            "At hundreds of petabytes per month they do not apply. But they show the trend: vendors **bundle** delivery with [[WAF]] and [[DDoS]] protection. Rayburn also noted CDNs \"often combine media delivery with non-media services under one per-Mbps price.\"",
        },
        {
          kind: "read",
          title: "Per-minute pricing",
          body:
            "Some video platforms price by **minutes delivered**. Cloudflare Stream (accessed November 2026) charges \"$1 per 1,000 minutes delivered,\" with bandwidth \"already included\" and no separate egress fee.\n\n" +
            "Since May 2023, Cloudflare's terms allow video and large files through its CDN only if hosted on a Cloudflare service such as Stream, Images or R2. Its general CDN plans are not a flat-price way to deliver video from your own origin.",
        },
        {
          kind: "number",
          prompt: "Cloudflare Stream: $1 per 1,000 minutes delivered. At 4 Mbps, what is that per GB?",
          answer: 0.033,
          tolerance: 0.004,
          unit: "$/GB",
          hint: "1,000 minutes = 60,000 s. Bytes = seconds x Mbps / 8.",
          explain:
            "60,000 s x 4 Mbps / 8 = 30,000 MB = **30 GB**. $1 / 30 GB = about **$0.033 per GB**. At 8 Mbps the same $1 buys 60 GB.",
        },
        {
          kind: "quiz",
          prompt: "You pay per minute delivered. You ship a better codec that cuts bitrate by 30% at the same quality. Who saves the delivery money?",
          options: ["You, the video service", "The vendor", "The viewer's ISP", "Nobody, bytes are free"],
          answer: 1,
          explain:
            "Per-minute pricing moves **bitrate risk to the vendor**. You pay the same per minute whatever the bitrate, so fewer bytes save the vendor money, not you.",
        },
        {
          kind: "match",
          prompt: "Match each pricing model to what it bills.",
          pairs: [
            ["Per GB", "Total bytes in the month"],
            ["Per request", "Each block of 10,000 requests"],
            ["95th percentile", "Sustained Mbps rate"],
            ["Per minute", "Minutes of video delivered"],
            ["Flat-rate plan", "A monthly fee with a transfer allowance"],
          ],
          explain:
            "Know the model before comparing rates. Per GB rewards fewer bytes. Per request rewards longer segments. 95th percentile rewards flat traffic. Per minute moves bitrate risk to the vendor. Flat-rate plans bundle delivery with other services but stop at small volumes.",
        },
        {
          kind: "summary",
          points: [
            "Per GB: volume tiers and regional rate cards. CloudFront 2026 top US tier is $0.020 per GB.",
            "Per request: about $0.01 per 10,000 at list. Shorter segments and separate audio multiply requests.",
            "Largest customers often buy per Mbps at the 95th percentile.",
            "Bundles mix delivery with WAF and DDoS; per-minute pricing (Cloudflare Stream) moves bitrate risk to the vendor.",
            "Fastly, Media CDN and Akamai at video scale: the only real price is the contract.",
          ],
        },
      ],
    },

    /* ================= Lesson 3: the 95th percentile ================= */
    {
      id: "ch16-l3",
      title: "The 95th percentile",
      goal: "Compute a 95th-percentile bill, convert a per-Mbps price to an effective price per GB, and spot billing traps in spikes and failover.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "You are billed at the 95th percentile. A premiere doubles your traffic for 20 hours this month. How much extra do you pay?",
          options: [
            "Twice as much for the whole month",
            "Exactly the extra bytes of those 20 hours",
            "Nothing extra",
            "It depends on the time of day",
          ],
          answer: 2,
          explain:
            "95th percentile billing throws away the busiest 5% of samples. In a 30-day month that is about **36 hours**. A 20-hour burst fits inside that window, so it is **free at the margin**.",
        },
        {
          kind: "read",
          title: "How the 95th percentile is computed",
          body:
            "The provider samples your traffic rate, usually **every 5 minutes**. At month end the samples are sorted, the top 5% are discarded, and \"the next highest measurement becomes the billable use for the entire month.\"\n\n" +
            "The bill is: **billed Mbps x price per Mbps per month**.",
          visual: {
            kind: "stats",
            items: [
              { value: "5 min", label: "Sample interval", note: "usual" },
              { value: "8,640", label: "Samples in 30 days", note: "30 x 24 x 12" },
              { value: "432", label: "Samples discarded", note: "top 5%" },
            ],
          },
        },
        {
          kind: "order",
          prompt: "Put the steps of 95th percentile billing in order.",
          items: [
            "Sample the traffic rate every 5 minutes",
            "Sort all the month's samples",
            "Discard the top 5% of samples",
            "Bill the next highest sample for the whole month",
            "Multiply by the price per Mbps per month",
          ],
          explain:
            "Sample, sort, drop the top 5%, take the next highest value as the billed rate for the entire month, then multiply by the price per Mbps.",
        },
        {
          kind: "number",
          prompt: "A 30-day month has 8,640 five-minute samples. The top 5% are discarded. How many hours of bursting are free?",
          answer: 36,
          tolerance: 1,
          unit: "hours",
          hint: "5% of 8,640 samples, each 5 minutes long.",
          explain:
            "5% of 8,640 = **432 samples**. 432 x 5 min = 2,160 min = **36 hours**. You can burst above your billed rate for about 36 hours a month for free. Longer bursts set your bill.",
        },
        {
          kind: "number",
          prompt: "The assumed model delivers 540 PB in a 30-day month. What is the average delivery rate?",
          answer: 1.67,
          tolerance: 0.08,
          unit: "Tbps",
          hint: "Bytes x 8 gives bits. 30 days = 2,592,000 seconds.",
          explain:
            "540 x 10^15 bytes x 8 / (30 x 86,400 s) = 4.32 x 10^18 bits / 2.592 x 10^6 s = about **1.67 Tbps**.",
        },
        {
          kind: "read",
          title: "Load factor",
          body:
            "The **load factor** is average traffic divided by billed (95th percentile) traffic.\n\n" +
            "In the assumed model, the normal evening peak is 1M streams x 4 Mbps = **4 Tbps** (assumed). It lasts several hours every day, far more than 36 hours a month. So the evening peak **sets the 95th percentile**.",
          visual: {
            kind: "stats",
            items: [
              { value: "1.67 Tbps", label: "Average rate", note: "540 PB / month" },
              { value: "4 Tbps", label: "Evening peak", note: "1M x 4 Mbps, assumed" },
              { value: "?", label: "Load factor", note: "average / billed" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "Average 1.67 Tbps, billed (95th percentile) 4 Tbps. What is the load factor?",
          answer: 0.42,
          tolerance: 0.02,
          hint: "Average divided by billed.",
          explain: "1.67 / 4 = about **0.42**. Streaming traffic follows people's evenings, so it is far from flat.",
        },
        {
          kind: "read",
          title: "From $ per Mbps to $ per GB",
          body:
            "One Mbps running flat out for 30 days moves about **324 GB**. At a load factor of 0.42, each billed Mbps carries about **135 GB**.\n\n" +
            "Check: 540,000,000 GB / 4,000,000 Mbps = 135.\n\n" +
            "So the effective price per GB is the monthly price per Mbps divided by 135.",
          visual: {
            kind: "code",
            lang: "text",
            code:
              "GB per Mbps-month (flat) = 1e6 bit/s x 2,592,000 s / 8 = 324 GB\n" +
              "GB per billed Mbps       = 324 GB x 0.42 load factor  = about 135 GB\n" +
              "effective $/GB           = ($ per Mbps per month) / 135",
            caption: "The book's conversion for the assumed model",
          },
        },
        {
          kind: "number",
          prompt: "At an illustrative $0.20 per Mbps per month (not a quoted market rate), what is the effective price per GB?",
          answer: 0.0015,
          tolerance: 0.0002,
          unit: "$/GB",
          hint: "Divide by 135 GB per billed Mbps.",
          explain: "$0.20 / 135 GB = about **$0.0015 per GB**. Flatter traffic would carry more GB per billed Mbps and lower this number.",
        },
        {
          kind: "read",
          title: "Flat traffic wins",
          body:
            "Flat traffic gets more bytes per billed Mbps. Streaming traffic follows people's evenings and is not flat.\n\n" +
            "So the same price per Mbps gives a different price per GB in each region, depending on how peaky its traffic is.",
          callout: {
            type: "staff",
            text:
              "Never compare a per-Mbps quote with a per-GB quote directly. Convert with your **measured load factor, per region**. A region with one big time zone has a lower load factor than one spread across many.",
          },
        },
        {
          kind: "quiz",
          prompt: "Region A sits in one time zone. Region B spreads across many. Same price per Mbps. Which has the lower effective price per GB?",
          options: [
            "Region A",
            "Region B",
            "Both are the same",
            "It depends only on total bytes",
          ],
          answer: 1,
          explain:
            "Many time zones smooth the evening peaks, so Region B's traffic is flatter. A higher load factor means more GB per billed Mbps, so a **lower** effective price per GB.",
        },
        {
          kind: "read",
          title: "Simulcast spikes and the 36-hour window",
          body:
            "A big [[simulcast]] premiere can push concurrency to about **2M streams, 8 Tbps** (assumed), for an hour or two.\n\n" +
            "- If all spikes in a month add up to **less than 36 hours** above the evening peak, they fall in the discarded top 5%. They are **free at the margin**.\n" +
            "- In a busy season with many hits on different days, spike hours add up. Past 36 hours, the 95th percentile rises into spike territory, and the **whole month** is billed at that level.",
        },
        {
          kind: "number",
          prompt: "A popular show causes a 2-hour spike every day of a 30-day month. How many spike hours is that?",
          answer: 60,
          tolerance: 1,
          unit: "hours",
          explain:
            "2 hours x 30 days = **60 hours**, well over the 36-hour free window. So the 95th percentile rises to the spike level for the whole month. Two short spikes per week, by contrast, stay well under 36 hours and are discarded.",
        },
        {
          kind: "read",
          title: "Per GB, spikes cost their bytes",
          body:
            "Under per-GB billing, the same spike costs exactly its bytes, no more and no less.\n\n" +
            "Contracts for large events often add **reservation fees**. Rayburn reported in 2019 that customers pay for reserved capacity \"even if they don't use it,\" priced **per Tbps sustained**. Chapter 13 covers spike capacity planning.",
        },
        {
          kind: "quiz",
          prompt:
            "CDN A and CDN B each carry half your traffic, each with a 95th percentile of 2 Tbps. During an incident you move everything to CDN A for 48 hours. What happens to the bill?",
          options: [
            "Nothing, total bytes did not change",
            "It rises: A's 95th percentile jumps toward 4 Tbps, B's barely falls",
            "It falls, because B is idle",
            "Only B's bill changes",
          ],
          answer: 1,
          explain:
            "Each CDN computes its **own** 95th percentile. 48 hours at 4 Tbps is more than 36 hours, so CDN A's billed rate jumps toward 4 Tbps. CDN B's billed rate barely falls, because other days set it. The bill rises although total bytes did not change.",
        },
        {
          kind: "read",
          title: "The multi-CDN trap",
          body:
            "Each CDN computes its own 95th percentile. So moving traffic between CDNs is a **billing event**, not only an operations event. Failover and steering are billing-sensitive.",
          visual: {
            kind: "compare",
            left: { title: "Normal month", points: ["CDN A: 95th percentile 2 Tbps", "CDN B: 95th percentile 2 Tbps", "Billed total about 4 Tbps"] },
            right: { title: "48-hour failover to A", points: ["CDN A: jumps toward 4 Tbps", "CDN B: barely falls, other days set it", "Billed total near 6 Tbps, same bytes"] },
            caption: "Same bytes, higher bill",
          },
          callout: {
            type: "mistake",
            text:
              "Running a two-day failover drill that moves all traffic to one CDN without checking the billing model. Drills (Chapter 12) are essential; schedule them with billing in mind, or negotiate drill and failover exemptions.",
          },
        },
        {
          kind: "widget",
          widget: "cost",
          title: "Feel the 95th percentile",
          task:
            "Open the **Contract** tab and switch the billing method to the 95th percentile. Move the traffic shape (load factor) slider and watch the effective price per GB change for the same price per Mbps.",
          props: { start: "book" },
        },
        {
          kind: "summary",
          points: [
            "95th percentile: sample every 5 minutes, drop the top 5% (about 36 hours a month), bill the next highest for the whole month.",
            "Load factor = average / billed. Assumed model: 1.67 / 4 = about 0.42.",
            "Effective $/GB = $ per Mbps per month / 135 at that load factor.",
            "Spikes under 36 hours are free at the margin; frequent spikes raise the whole month.",
            "Each CDN has its own 95th percentile, so failovers and drills can raise the bill with the same bytes.",
          ],
        },
      ],
    },

    /* ================= Lesson 4: real prices, regions, negotiating ================= */
    {
      id: "ch16-l4",
      title: "What big customers really pay",
      goal: "Explain the gap between list and contract prices, why regions cost 2x to 4x more, and how engineering shapes a CDN contract.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "CloudFront's lowest US list rate in 2026 is $0.020 per GB. What did surveys report the very largest deals paying back in 2019?",
          options: ["About $0.015 per GB", "About $0.010 per GB", "About $0.001 per GB", "About $0.020 per GB, the same"],
          answer: 2,
          explain:
            "Rayburn's 2019 survey: \"pricing on very large deals is now down to an all-time low of **$0.001 per GB** delivered.\" In 2020 some of the biggest OTT and gaming companies were reported as low as $0.0006. List prices are a ceiling.",
        },
        {
          kind: "read",
          title: "The public window: Rayburn's surveys",
          body:
            "Real contract prices are private. The best public window is Dan Rayburn's CDN pricing surveys. Treat them as **industry estimates**, not rate cards.\n\n" +
            "- **2019:** very large deals at $0.001 per GB; other customers paid \"$0.003-$0.005.\"\n" +
            "- **2020:** biggest OTT and gaming \"as low as $0.0006.\" Mid-size customers committing \"north of 20PB\" a month near $0.007; about 40 PB a month near $0.005, depending on the CDN.\n" +
            "- **2025:** a Q1 survey of 704 customers, sold as a paid report.",
          visual: {
            kind: "stats",
            items: [
              { value: "$0.020", label: "CloudFront US list", note: "over 5 PB, 2026" },
              { value: "$0.001", label: "Largest deals", note: "survey, 2019" },
              { value: "$0.0006", label: "Biggest OTT", note: "survey, 2020" },
            ],
          },
        },
        {
          kind: "number",
          prompt: "A large customer pays $0.001 per GB. CloudFront's lowest US list rate is $0.020. How many times less does the customer pay?",
          answer: 20,
          tolerance: 1,
          unit: "x",
          explain: "$0.020 / $0.001 = **20x**. At $0.002 it would be 10x. So a large customer at $0.001 to $0.002 pays 10x to 20x less than list.",
        },
        {
          kind: "read",
          title: "Why the gap is so big",
          body:
            "A CDN's cost is mostly **fixed**: servers, ports, PoP space, and transit or peering sized for peak. A large, committed, predictable customer fills that capacity and lowers the vendor's cost per GB. Rayburn's 2020 post estimated some CDNs' internal cost \"in the $0.0007 range.\"\n\n" +
            "Your price depends on volume, term, commitment, traffic shape, geography, bundle, and above all **competition**: whether you credibly run other CDNs and can shift traffic. That is why multi-CDN (Chapter 9) is also an **economic strategy**.",
          callout: {
            type: "industry",
            text:
              "Prices have fallen for decades. Rayburn's 2007 data put 100 TB/month customers near $0.19 to $0.29 per GB; by 2019 the largest deals were near $0.001. Cloudflare's 2021 post claims wholesale transit prices fell an average of 23% per year over ten years.",
          },
        },
        {
          kind: "quiz",
          prompt: "Above all, what gives you a lower CDN price?",
          options: [
            "Asking politely at renewal time",
            "Competition: credibly running other CDNs and being able to shift traffic",
            "Using the CDN's newest features",
            "Paying monthly instead of yearly",
          ],
          answer: 1,
          explain:
            "Volume, term, commitment, traffic shape, geography and bundle all matter, but **competition** matters most. A vendor prices you lower when it knows you can move traffic elsewhere tomorrow.",
        },
        {
          kind: "quiz",
          prompt: "Same 1 GB, CloudFront's top volume tier, 2026. How much more does it cost in Australia than in the US?",
          options: ["The same", "About 1.5x", "About 4x", "About 10x"],
          answer: 2,
          explain: "$0.080 in Australia vs $0.020 in the US: **4x**, even at the highest volume tier.",
        },
        {
          kind: "read",
          title: "Regional price differences",
          body:
            "At CloudFront's highest volume tier in 2026, prices differ by up to 4x across regions.\n\n" +
            "Fastly's small-volume list shows the same shape. It even limits its fixed packages to no more than **10%** of traffic from African, Indian or South Korean billing regions.",
          visual: {
            kind: "table",
            headers: ["Region", "Over 5 PB, per GB", "Multiple of US"],
            rows: [
              ["US, Mexico, Canada, Europe", "$0.020", "1.0x"],
              ["South America", "$0.040", "2.0x"],
              ["HK, Singapore, SE Asia, Korea, Japan", "$0.060", "3.0x"],
              ["India", "$0.072", "3.6x"],
              ["Australia, New Zealand", "$0.080", "4.0x"],
            ],
            caption: "CloudFront pay-as-you-go, highest tier, 2026",
          },
        },
        {
          kind: "read",
          title: "Why some regions cost more",
          body:
            "The reasons come from Chapter 2:\n\n" +
            "- North America and Europe have many large exchanges ([[IXP]]s) and competing [[transit]] providers.\n" +
            "- Parts of Asia, South America, Africa and Oceania have fewer exchanges, fewer providers and expensive long-distance capacity.\n" +
            "- Australia and New Zealand depend on long submarine cables.\n" +
            "- Some ISPs charge content networks for access (paid [[peering]]) instead of peering for free.\n" +
            "- Smaller PoPs spread fixed costs over fewer bytes.",
        },
        {
          kind: "multi",
          prompt: "Which of these explain why delivery to Australia costs more? Select all that apply.",
          options: [
            "Long submarine cables",
            "Fewer large exchanges and transit competitors",
            "Smaller PoPs spread fixed costs over fewer bytes",
            "CDNs simply add a bigger margin there",
            "Australian viewers watch at much higher bitrates",
          ],
          answers: [0, 1, 2],
          explain:
            "Australia depends on long submarine cables, has fewer large exchanges and transit competitors, and its smaller PoPs spread fixed costs over fewer bytes. The underlying cost is real, not margin. Bitrate changes bytes, not the price per byte.",
        },
        {
          kind: "number",
          prompt: "In Australia the CloudFront rate falls from $0.114 (Next 9 TB) to $0.080 (Over 5 PB). By what percent?",
          answer: 30,
          tolerance: 2,
          unit: "%",
          explain: "($0.114 - $0.080) / $0.114 = $0.034 / $0.114 = about **30%** lower.",
        },
        {
          kind: "read",
          title: "Volume buys less in expensive regions",
          body:
            "In the US, the CloudFront rate falls from **$0.085 to $0.020** across tiers: **76% lower**. In Australia it falls from **$0.114 to $0.080**: only about **30% lower**.\n\n" +
            "Volume cannot buy away the cost of submarine cables and thin competition. The underlying cost is real, not margin.",
        },
        {
          kind: "read",
          title: "Engineering responses to regional cost",
          body:
            "- Regional CDNs or partners with better local peering (Chapter 9).\n" +
            "- Embedded ISP caches where scale allows.\n" +
            "- A **regional shield**, so fills do not cross oceans repeatedly.\n" +
            "- With Playback and product, a **per-region bitrate policy** where the network is both expensive and slow. Never make that a silent cost cut.",
          callout: {
            type: "crunchyroll",
            text:
              "The 2026 job posting describes fans in 200+ countries and territories, and anime has large audiences in Latin America, Southeast Asia and India as well as North America and Europe. So a meaningful share of bytes is likely served where list prices are 2x to 4x the US rate. The real regional mix is not published. A team here would track **cost per hour streamed by country**, because a subscriber in a high-cost region can cost several times more to serve.",
          },
        },
        {
          kind: "read",
          title: "Engineers shape the contract",
          body:
            "Engineers do not sign contracts. But on a Media Delivery team, they **shape** them.\n\n" +
            "Procurement brings competition. Engineering brings traffic forecasts, regional mix, load factor, performance comparisons, and the technical ability to move traffic.\n\n" +
            "\"We cannot easily move traffic\" weakens every negotiation.",
        },
        {
          kind: "read",
          title: "Contract terms (part 1)",
          body: "Each term has an engineering angle. A [[commit]] is the one that bites hardest if your forecast is wrong.",
          visual: {
            kind: "table",
            headers: ["Term", "What it means", "Engineering angle"],
            rows: [
              ["Commit", "Minimum volume (PB/month) or rate (Gbps at p95), paid even if unused", "Forecast well; steering must fill it"],
              ["Term", "1 to 3 years", "Longer term, lower rate, less flexibility"],
              ["Overage rate", "Price above commit", "Should be near commit rate so spikes do not hurt"],
              ["Regional rate card", "Separate prices per region", "Negotiate the expensive regions hardest"],
            ],
          },
        },
        {
          kind: "read",
          title: "Contract terms (part 2)",
          body:
            "Rayburn noted add-on fees for low latency, HTTPS and live events.\n\n" +
            "The last row matters for a multi-cloud company: CloudFront spend is AWS spend, and Media CDN spend is Google Cloud spend. Routing traffic to a cloud's own CDN can help meet a committed-spend agreement. That is a real reason to keep a cloud-native CDN in the mix, even if a third-party CDN is slightly cheaper per GB.",
          visual: {
            kind: "table",
            headers: ["Term", "What it means", "Engineering angle"],
            rows: [
              ["Request and feature fees", "Requests, HTTPS, real-time logs, shield, edge compute", "Add-on fees for low latency, HTTPS, live"],
              ["Event reservation", "Paid capacity for big events", "Plan premieres with vendors (Ch. 13)"],
              ["Burst and failover clauses", "How p95 treats failover traffic", "Protects you during drills and incidents"],
              ["Cloud commitments", "Committed-spend deals with AWS or Google", "Cloud-native CDN spend usually counts"],
            ],
          },
        },
        {
          kind: "match",
          prompt: "Match each contract term to its engineering angle.",
          pairs: [
            ["Commit", "Forecast well; steering must fill it"],
            ["Overage rate", "Keep it near the commit rate"],
            ["Event reservation", "Plan premieres with the vendor"],
            ["Burst and failover clause", "Protects you during drills"],
            ["Cloud commitment", "Cloud-native CDN spend counts toward it"],
          ],
          explain:
            "Each term ties to something engineering controls: forecasts and steering fill commits, a near-commit overage rate keeps spikes cheap, reservations cover premieres, failover clauses protect drills, and cloud-native CDN spend helps meet cloud commitments.",
        },
        {
          kind: "read",
          title: "How to prepare",
          body:
            "- Measure traffic by region and hour for 12 months. Know your load factor per region.\n" +
            "- Forecast growth and premiere seasons. Commit **slightly below** forecast.\n" +
            "- Benchmark each CDN per region and ISP with [[RUM]] (Chapter 11). A cheaper CDN that rebuffers more is not cheaper once churn counts.\n" +
            "- Prove at real scale that you can move traffic.\n" +
            "- Get the billing model in writing: sampling interval, regional or global 95th percentile, failover treatment, what counts as a request.",
          callout: {
            type: "mistake",
            text:
              "Optimizing the rate per GB and ignoring the commit. A low rate with a commit you cannot fill can cost more than a higher rate with no commit. Model both against a low-traffic scenario, not just the forecast.",
          },
        },
        {
          kind: "quiz",
          prompt:
            "Hypothetical offers: A is $0.0015 per GB with a 30 PB/month commit. B is $0.002 per GB with no commit. In a slow month you deliver only 20 PB on this CDN. Which costs less that month?",
          options: [
            "A: it has the lower rate",
            "B: you pay for 20 PB, not 30 PB",
            "They cost the same",
          ],
          answer: 1,
          explain:
            "A charges the commit even if unused: 30,000,000 GB x $0.0015 = **$45,000**. B charges only what you send: 20,000,000 GB x $0.002 = **$40,000**. Always model offers against a low-traffic month, not just the forecast.",
        },
        {
          kind: "read",
          title: "The other path: build your own",
          body:
            "Most services buy delivery from commercial CDNs. One giant took a different route. Chapter 9 discusses when owning a CDN makes sense; Chapter 17 covers [[Open Connect]].",
          callout: {
            type: "industry",
            text:
              "Netflix took a different route for most of its traffic: Open Connect, its own CDN. It gives caching appliances to qualifying ISPs \"at no charge,\" with the ISP providing space, power and connectivity, and says it partners with \"over a thousand ISPs.\" That works because Netflix's volume is enormous and its catalog is predictable enough to fill caches overnight. For most services, buying from commercial CDNs is cheaper.",
          },
        },
        {
          kind: "summary",
          points: [
            "Surveys: largest deals near $0.001 per GB (2019) and $0.0006 (2020), 10x to 20x below the $0.020 list.",
            "CDN cost is mostly fixed; competition and the ability to move traffic win the best price.",
            "Regions cost 2x to 4x more even at top volume (US $0.020, Australia $0.080), and volume discounts shrink there.",
            "Engineering shapes contracts: forecasts, load factor, RUM benchmarks, proof you can move traffic.",
            "A low rate with an unfillable commit can cost more than a higher rate with none.",
          ],
        },
      ],
    },

    /* ================= Lesson 5: origin egress and hit ratio ================= */
    {
      id: "ch16-l5",
      title: "Origin egress and hit ratio are money",
      goal: "Explain how cloud-CDN pairing sets the price of each fill, and turn a change in hit ratio into dollars.",
      minutes: 11,
      steps: [
        {
          kind: "quiz",
          prompt: "Your origin is S3. CDN misses pull 5 PB a month from it. Which CDN can fill from S3 with no egress charge?",
          options: ["Amazon CloudFront", "Fastly", "Akamai", "All of them"],
          answer: 0,
          explain:
            "AWS lists origin fetches as \"free for origin fetches from any AWS origin such as Amazon Simple Storage Service (S3)\" for CloudFront. Any other CDN pulling over the internet pays S3 internet egress.",
        },
        {
          kind: "read",
          title: "Origin egress",
          body:
            "When a CDN misses, it fetches from your cloud [[origin]], and the cloud may charge [[egress]] for those bytes.\n\n" +
            "Internet egress is expensive at list. S3 data transfer out in us-east-1 was **$0.09 per GB** for the first 10 TB per month in 2026. It falls at higher tiers but stays far above CDN contract rates.\n\n" +
            "So \"which CDN pulls from which cloud, over what path\" changes the bill.",
        },
        {
          kind: "read",
          title: "Which pairings are cheap",
          body:
            "Google's CDN Interconnect launched in 2015 with Level 3, Fastly, Highwinds and Cloudflare. AWS declined to join Cloudflare's Bandwidth Alliance.",
          visual: {
            kind: "table",
            headers: ["Pairing", "What is published", "Effect"],
            rows: [
              ["S3 / AWS origin to CloudFront", "Free origin fetches from AWS origins; S3 excludes transfer out to CloudFront", "No egress for fill"],
              ["Google Cloud to partner CDNs (CDN Interconnect)", "Select CDNs peer directly with Google's edge at a discounted rate", "Discounted, not free"],
              ["Cloud Storage to Google Cloud CDN", "Billed as \"cache fill\" plus storage operations on misses", "Fill fee instead of egress"],
              ["Clouds in Bandwidth Alliance", "Members commit to \"discounting or waiving\" transfer fees", "Varies"],
              ["S3 to a third-party CDN over the internet", "Standard internet egress", "Full egress at your contract rate"],
            ],
          },
        },
        {
          kind: "read",
          title: "A reported 2026 change (unconfirmed)",
          body:
            "A **third-party post** reports that Google raised CDN Interconnect and peering rates effective **May 1, 2026**. The book could not confirm this on Google's own pricing page, so check the current page before relying on it.\n\n" +
            "If it holds, much of the old advantage of pairing Google origins with third-party CDNs is gone.",
          visual: {
            kind: "table",
            headers: ["Region", "Old rate per GB", "Reported from May 2026"],
            rows: [
              ["North America", "$0.04", "$0.08"],
              ["Europe", "$0.05", "$0.08"],
              ["Asia", "$0.06", "$0.085"],
            ],
            caption: "Reported 2026 change, third-party source, verify with Google",
          },
        },
        {
          kind: "number",
          prompt: "5.4 PB of origin fills a month go from Google Cloud over CDN Interconnect in North America. At the reported 2026 rate of $0.08 per GB, what is the monthly cost?",
          answer: 432,
          tolerance: 20,
          unit: "$k",
          hint: "5.4 PB = 5,400,000 GB.",
          explain:
            "5,400,000 GB x $0.08 = **$432,000** a month. At the old $0.04 rate it was $216,000. The reported change doubles this line.",
        },
        {
          kind: "read",
          title: "The discount needs the right path",
          body:
            "Fastly documents its side of the Google discount. You choose a Fastly PoP near an interconnect location as your shield, and only requests no part of Fastly has served go back to Google.\n\n" +
            "It warns that \"your data may egress from Google over the public internet,\" and then normal Google rates apply.",
          callout: {
            type: "mistake",
            text:
              "Assuming the interconnect discount applies to all fills. It applies only on the interconnect path from supported locations. A shield in the wrong place, or a fill over the public internet, pays full egress without anyone noticing. Read the cloud bill **by SKU**, not just the total.",
          },
        },
        {
          kind: "read",
          title: "Multi-CDN multiplies fills",
          body:
            "Every CDN misses independently. With three CDNs, the origin sees up to **three cold fills per object**, one per CDN shield.\n\n" +
            "For simulcast episodes this is small. For the [[long tail]], where each title is watched rarely, a title cached in CDN A does not help CDN B, and origin egress rises.",
          visual: { kind: "flow", spec: { ...multiFill, flow: ["origin>shA", "origin>shB", "origin>shC"] }, caption: "One object, three CDNs, up to three paid fills" },
        },
        {
          kind: "read",
          title: "Controls for multi-CDN fills",
          body:
            "- **Steer long-tail content consistently**, so a title keeps hitting the same CDN (Chapter 9).\n" +
            "- **Place each CDN's shield near the origin region** it pulls from, so fills stay intra-region or on an interconnect path. A shield reduces how many bytes leave the origin; its **location** decides what each byte costs (Chapter 6).\n" +
            "- **A shared [[mid-tier]] cache you run** next to the origin. It helps only if its egress is cheaper than storage egress, or if packager and request fees are the real cost.",
          visual: { kind: "flow", spec: { ...multiFill, focus: ["origin", "shA", "shB", "shC", "origin>shA", "origin>shB", "origin>shC"] } },
        },
        {
          kind: "quiz",
          prompt: "A rarely watched title gets cached in CDN A, then the next viewer is steered to CDN B. Which control stops these repeated paid fills?",
          options: [
            "Steer long-tail titles consistently to one CDN",
            "Lower the TTL on segments",
            "Add a third CDN",
            "Move the shield far from the origin",
          ],
          answer: 0,
          explain:
            "**Content affinity:** if a long-tail title keeps hitting the same CDN, only that CDN fills it. Lower TTLs and more CDNs create more fills, and a distant shield makes each fill cost more.",
        },
        {
          kind: "number",
          prompt: "Assumed model: 540 PB a month, 95% edge hit ratio by bytes, shield catches 80% of edge misses. Origin fills are 5.4 PB. If the edge hit ratio drops to 90%, what are origin fills?",
          answer: 10.8,
          tolerance: 0.5,
          unit: "PB",
          hint: "Edge misses go from 5% to 10% of 540 PB. The shield still passes 20% of misses to the origin.",
          explain:
            "Edge misses: 10% x 540 = 54 PB (double the 27 PB). Shield misses: 20% x 54 = **10.8 PB**. Five points of hit ratio **double** origin fills.",
        },
        {
          kind: "read",
          title: "Hit ratio by bytes",
          body:
            "The **cache hit ratio by bytes** ([[BHR (byte hit ratio)]]) is the share of delivered bytes served from cache. It is the most important number linking engineering to the delivery bill.\n\n" +
            "In the assumed model, 95% of 540 PB is served by the edge: **513 PB**. The other 5%, **27 PB**, goes to the shield.",
          visual: { kind: "flow", spec: { ...hitMap, focus: ["total", "edgeHit", "edgeMiss", "total>edgeHit", "total>edgeMiss"], flow: ["total>edgeMiss"] }, caption: "Assumed: 540 PB/month, 95% edge, shield catches 80% of misses" },
        },
        {
          kind: "read",
          title: "From misses to an egress bill",
          body:
            "The shield catches 80% of the 27 PB: **21.6 PB**. The rest, **5.4 PB**, is fetched from the origin.\n\n" +
            "Whether those 5.4 PB cost nothing or hundreds of thousands of dollars depends on the cloud-CDN pairing.",
          visual: { kind: "flow", spec: { ...hitMap, focus: ["edgeMiss", "shieldHit", "originFill", "bill", "edgeMiss>shieldHit", "edgeMiss>originFill", "originFill>bill"], flow: ["total>edgeMiss", "edgeMiss>originFill", "originFill>bill"] } },
        },
        {
          kind: "number",
          prompt: "The origin is S3, the CDN is not CloudFront. Fills rise by 5.4 PB a month. At roughly $0.05 per GB internet egress, what is the extra monthly cost at list?",
          answer: 270,
          tolerance: 15,
          unit: "$k",
          explain:
            "5,400,000 GB x $0.05 = **$270,000 per month** at list. ($0.05 is S3's top internet egress tier on AWS's published table; the first 10 TB is $0.09. Confirm the current tier value.)",
        },
        {
          kind: "read",
          title: "Five points can be worth millions a year",
          body:
            "$270,000 a month extra at list is over $3M a year. Contract rates are lower, but the lesson holds: **five points of hit ratio can be worth millions of dollars per year.**\n\n" +
            "And if the CDN were CloudFront pulling from S3, the same extra fills would cost no egress at all. Hit ratio and pairing work together.",
        },
        {
          kind: "number",
          prompt: "5.4 PB of origin fills, in 3 MB segments. How many S3 GET requests is that?",
          answer: 1.8,
          tolerance: 0.1,
          unit: "billion",
          explain: "5.4 x 10^15 bytes / 3 x 10^6 bytes = **1.8 billion GETs**. At $0.0004 per 1,000 (2026) that is only about **$720 a month**.",
        },
        {
          kind: "read",
          title: "Costs beyond the CDN invoice",
          body:
            "Hit ratio also moves costs that are not on the CDN invoice:\n\n" +
            "- **S3 GET requests:** $0.0004 per 1,000 in 2026; 1.8 billion GETs is about $720 a month.\n" +
            "- **CloudFront Origin Shield** request fees: $0.0075 per 10,000 in the US.\n" +
            "- **JIT packager** fees, per GB packaged.\n" +
            "- **QoE:** a miss adds latency to startup (Chapter 10).",
        },
        {
          kind: "multi",
          prompt: "Which changes raise the cache hit ratio? Select all that apply.",
          options: [
            "Strip session tokens and tracking parameters from cache keys",
            "One CMAF copy instead of separate HLS and DASH copies",
            "Long TTLs for immutable segments",
            "Consistent steering and shields with tiered caching",
            "Add a per-viewer token to the cache key",
            "Shorten segment TTLs to one minute",
          ],
          answers: [0, 1, 2, 3],
          explain:
            "The book's cost checklist: clean [[cache keys|Cache key]] (Chapters 4 and 5), one [[CMAF]] copy (Chapter 7), long [[TTL]]s for immutable segments, consistent steering, shields and tiered caching. Per-viewer tokens in the key and short TTLs split or expire the cache.",
        },
        {
          kind: "read",
          title: "Report hit ratio by bytes",
          body:
            "When you talk about money, use the byte hit ratio, not the request hit ratio ([[CHR (cache hit ratio)]]).",
          callout: {
            type: "staff",
            text:
              "Report hit ratio by bytes, not requests, when you talk about cost. Manifests and subtitle files are many requests and few bytes. Bytes are what you pay egress on.",
          },
        },
        {
          kind: "widget",
          widget: "shield-offload",
          title: "Shield, hit ratio and the origin bill",
          task:
            "Turn the shield on and get the origin under 100 Gbps at 8 Tbps peak. Then drop the edge hit ratio from 95% to 90% and watch origin load and egress cost roughly double.",
          props: { tab: "offload" },
        },
        {
          kind: "summary",
          points: [
            "Cloud-CDN pairing sets the price of each fill: S3 to CloudFront is free; a third-party CDN pays egress or interconnect rates.",
            "Google interconnect rates were reported to double in May 2026 (third-party report, verify).",
            "Multi-CDN means up to one cold fill per CDN; steer the long tail consistently and place shields near the origin.",
            "Hit ratio 95% to 90% doubles origin fills: 5.4 PB to 10.8 PB, about $270k a month extra at list.",
            "Report hit ratio by bytes when you talk about cost.",
          ],
        },
      ],
    },

    /* ================= Lesson 6: storage, JIT, codecs ================= */
    {
      id: "ch16-l6",
      title: "Storage, JIT and codecs",
      goal: "Size the catalog's storage bill, judge managed JIT in dollars, and apply the codec break-even rule.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "At list prices, which is bigger per month: storing the whole 50,000-episode catalog, or delivering one month of viewing?",
          options: [
            "Storage, because the catalog is huge",
            "About the same",
            "Delivery, by roughly a hundred times or more",
          ],
          answer: 2,
          explain:
            "Storage is where people expect large costs and usually find small ones. The whole catalog costs **tens of thousands** of dollars a month; delivery costs **millions** at list. Storage is a small line; delivery is the big line.",
        },
        {
          kind: "read",
          title: "Assumptions for one episode",
          body:
            "These are **assumptions**, not Crunchyroll internals:\n\n" +
            "- 24-minute episodes (1,440 s).\n" +
            "- An [[H.264]] ladder of 0.4, 0.8, 1.5, 2.5, 4, 6 and 8 Mbps (sum **23.2 Mbps**).\n" +
            "- 4 dubs at 128 kbps [[AAC]], and 10+ subtitle languages.\n" +
            "- A 150 Mbps [[mezzanine]] (the master file from the licensor).\n" +
            "- **50,000 episodes.** Sony described a library of more than 50,000 episodes in May 2026; published descriptions also say \"more than 1,000 anime series.\"",
        },
        {
          kind: "number",
          prompt: "A 150 Mbps mezzanine for a 24-minute (1,440 s) episode. How big is it?",
          answer: 27,
          tolerance: 1,
          unit: "GB",
          explain: "150 Mbps x 1,440 s / 8 = 27,000 MB = about **27 GB**.",
        },
        {
          kind: "read",
          title: "Bytes per episode",
          body:
            "The video ladder and mezzanine dominate. Dubs and subtitles, so important to the anime product, are almost free in bytes.\n\n" +
            "The renditions x audio x subtitles multiplication matters for **object count and cache fragmentation**, not for storage.",
          visual: {
            kind: "table",
            headers: ["Item", "Calculation", "Size per episode"],
            rows: [
              ["Video ladder, one codec, one packaging", "23.2 Mbps x 1,440 s / 8", "about 4.2 GB"],
              ["Audio, 4 dubs", "4 x 0.128 Mbps x 1,440 s / 8", "about 0.09 GB"],
              ["Subtitles, 10+ languages", "text files", "under 0.001 GB"],
              ["Mezzanine", "150 Mbps x 1,440 s / 8", "about 27 GB"],
            ],
          },
        },
        {
          kind: "read",
          title: "Catalog total",
          body:
            "- **Packaged H.264 stored twice** (HLS with [[cbcs]] plus DASH with [[cenc|cenc (mode)]], a common legacy setup): 50,000 x 4.3 GB x 2 = about **430 TB**. Add HEVC and AV1 ladders for popular titles, say 100 to 200 TB more (assumed). Call it about **600 TB per cloud**.\n" +
            "- **Mezzanine:** 50,000 x 27 GB = about **1.35 PB**.\n" +
            "- **Multi-origin** across AWS and GCP (Chapter 6) roughly doubles packaged storage.",
        },
        {
          kind: "read",
          title: "S3 storage classes, 2026 list",
          body: "us-east-1 list prices in 2026. Cheaper classes add minimum durations and retrieval fees.",
          visual: {
            kind: "table",
            headers: ["Class", "Per GB-month", "Catch"],
            rows: [
              ["Standard", "$0.023", "first 50 TB, lower above"],
              ["Standard-IA", "$0.0125", "30-day minimum, retrieval fee"],
              ["One Zone-IA", "$0.01", "one zone"],
              ["Glacier Instant Retrieval", "$0.004", "90-day minimum, higher retrieval fee"],
              ["Intelligent-Tiering", "monitoring fee", "$0.0025 per 1,000 objects over 128 KB"],
            ],
            caption: "Amazon S3, us-east-1, list 2026",
          },
        },
        {
          kind: "number",
          prompt: "1.35 PB of mezzanines in Glacier Instant Retrieval at $0.004 per GB-month. Monthly cost?",
          answer: 5400,
          tolerance: 300,
          unit: "$/month",
          hint: "1.35 PB = 1,350,000 GB.",
          explain: "1,350,000 GB x $0.004 = **$5,400 a month**. In Standard (about $0.022) the same mezzanines cost about $30,000.",
        },
        {
          kind: "read",
          title: "Storage is a small line",
          body:
            "Rough monthly cost at list:\n\n" +
            "- Packaged content, 600 TB in each of two clouds at about $0.022: about **$26,000**.\n" +
            "- Mezzanine in Standard: about **$30,000**; in Glacier Instant Retrieval: about **$5,400**.\n\n" +
            "The whole catalog costs tens of thousands per month. Delivery costs millions at list. **Storage is a small line; delivery is the big line.**",
          visual: {
            kind: "stats",
            items: [
              { value: "$26k", label: "Packaged, 2 clouds", note: "600 TB each, list" },
              { value: "$30k / $5.4k", label: "Mezzanine", note: "Standard / Glacier IR" },
              { value: "~$17M", label: "Delivery at list", note: "Lesson 7" },
            ],
          },
        },
        {
          kind: "quiz",
          prompt: "Which kind of storage class should NOT sit behind a CDN origin path?",
          options: [
            "S3 Standard",
            "Any class that charges per GB retrieved, unless fills are measured to be rare",
            "Intelligent-Tiering after checking the per-object fee",
            "Any class in the second cloud",
          ],
          answer: 1,
          explain:
            "Every CDN fill is a read. A class with retrieval fees turns each fill into an extra charge. Segments on the origin path belong in Standard, or Intelligent-Tiering after checking the per-object fee against your object count.",
        },
        {
          kind: "read",
          title: "Choosing classes",
          body:
            "- Segments on the origin path belong in **Standard** (or Intelligent-Tiering after checking the per-object fee against your object count).\n" +
            "- **Any class that charges per GB retrieved should not sit behind a CDN origin path**, unless you have measured that fills are rare.\n" +
            "- Mezzanines are read only on re-encode, so they fit cold classes.\n" +
            "- The second cloud's copy must stay fast enough to serve during failover.\n\n" +
            "The Storage Infrastructure handbook covers classes in depth.",
        },
        {
          kind: "read",
          title: "JIT packaging in dollars",
          body:
            "**Static packaging** stores ready-made HLS and DASH segments. [[JIT packaging|Just-in-time packaging (JIT)]] stores one intermediate and builds formats on demand (Chapter 7).\n\n" +
            "JIT saves storage, but managed JIT charges per GB output. AWS Elemental MediaPackage listed VOD packaging at **$0.050 per GB** \"originated and packaged\" in us-east-1 in 2026.\n\n" +
            "Storage saved: perhaps half the packaged storage, about 300 TB per cloud, roughly **$6,600 a month per cloud** at list.",
        },
        {
          kind: "number",
          prompt: "Every origin fill passes through the managed packager. Fills are 5.4 PB a month at $0.05 per GB. That fee is how many times the $6,600 of storage it saves?",
          answer: 41,
          tolerance: 4,
          unit: "x",
          hint: "First compute the JIT fee: 5,400,000 GB x $0.05.",
          explain:
            "JIT fee: 5,400,000 GB x $0.05 = **$270,000 a month** at list. $270,000 / $6,600 = about **40x** the storage it saves.",
        },
        {
          kind: "read",
          title: "When JIT still fits",
          body:
            "At this scale the managed JIT fee is about **40 times** the storage it saves.\n\n" +
            "JIT still fits a huge, rarely watched archive, many format or DRM variants, or a **self-run packager** on compute you already pay for.",
          callout: {
            type: "staff",
            text:
              "The real packaging win is **one CMAF copy with cbcs encryption** serving both HLS and DASH players (Chapters 7 and 8). It halves storage and, more importantly, doubles the cache hit potential of every object. The second effect is worth far more money.",
          },
        },
        {
          kind: "quiz",
          prompt: "Which saves the most money at Crunchyroll-like scale?",
          options: [
            "Managed JIT packaging to cut storage",
            "One CMAF copy with cbcs, serving HLS and DASH",
            "Moving packaged segments to Glacier",
            "Storing more renditions per title",
          ],
          answer: 1,
          explain:
            "One CMAF + cbcs copy halves storage with no per-GB fee, and doubles the cache hit potential of every object. The hit-ratio effect is worth far more than the storage saving. Managed JIT costs about 40x what it saves; Glacier adds retrieval fees on the origin path.",
        },
        {
          kind: "read",
          title: "What a better codec saves",
          body:
            "A more efficient [[codec]] sends the same quality in fewer bits, and bytes are the bill. Published results vary by test, content and settings:\n\n" +
            "- Netflix, Feb 2020: [[AV1]] on Android about **20%** better compression than its VP9 streams.\n" +
            "- Facebook, 2018: about **34%** lower bitrate than VP9 and about **50%** lower than x264.\n" +
            "- Streaming Media, Sep 2020: AV1 used **15 to 20%** less than x265 (HEVC) at its slowest preset, about **45%** less than x264.\n" +
            "- Netflix, Dec 2025: **30%** of its streams use AV1.",
        },
        {
          kind: "number",
          prompt: "Illustrative: 30% of viewing hours are on AV1-capable devices, and AV1 saves 30% of bits vs the H.264 ladder. Out of 540 PB a month, how many PB are saved?",
          answer: 48.6,
          tolerance: 2,
          unit: "PB",
          explain:
            "0.30 x 0.30 x 540 PB = about **48.6 PB per month**. At an illustrative negotiated $0.002 per GB that is about **$97,000 a month**, roughly $1.2M a year. At the blended list rate of about $0.031 it is about **$1.5M a month**.",
        },
        {
          kind: "read",
          title: "At low contract rates, quality wins",
          body:
            "At very low contract rates, a codec's money saving gets small. The main benefit becomes **quality**: the same bitrate with a better picture, or HD on slower networks.\n\n" +
            "This worked example is illustrative, not Crunchyroll data.",
        },
        {
          kind: "read",
          title: "What a better codec costs",
          body:
            "- **Encode compute.** A 2020 University of Waterloo study measured AV1 2160p encodes at about **590x** the time of AVC, vs about **4.2x** for HEVC. Encoders have improved, but the gap is real. Encode is paid once per title; delivery savings come back per view.\n" +
            "- **Storage and cache.** Each new ladder adds storage and more objects that split the cache.\n" +
            "- **Licensing.** H.264 and HEVC are covered by patent pools; AV1 is offered royalty-free, though patent disputes exist.",
        },
        {
          kind: "read",
          title: "A new codec adds, it does not replace",
          body:
            "**Device support** is the hidden cost. AV1 hardware decoding reached Apple devices only with the A17 Pro (iPhone 15 Pro) and M3 Macs, and Android flagships such as Galaxy S21 and Pixel 6. Many older TVs and sticks cannot decode it.\n\n" +
            "So a new codec **adds** a ladder. H.264 stays for everyone else. (Encoding fleets are covered in the Compute Infrastructure handbook.)",
        },
        {
          kind: "read",
          title: "The break-even rule",
          body:
            "Encode a title in a new codec when the left side is smaller than the right side.\n\n" +
            "This is why large services encode new codecs **first for the most popular titles.** A simulcast hit watched by millions repays the encode in hours; an obscure catalog episode may never. The delivery engineer supplies the right side: views per title, bytes per view, and contract price per GB per region.",
          visual: {
            kind: "code",
            lang: "text",
            code:
              "encode cost + extra storage over the title's life\n" +
              "  <  expected views x GB per view x share on capable devices\n" +
              "     x bit saving x price per GB",
            caption: "Codec break-even rule",
          },
          callout: {
            type: "crunchyroll",
            text:
              "A platform like Crunchyroll would likely apply this rule per title, with new simulcast episodes as the strongest candidates, because their views concentrate in the days after release. Which codecs Crunchyroll ships to which devices is not covered here; treat this as a framework.",
          },
        },
        {
          kind: "quiz",
          prompt: "Which title should get an AV1 encode first?",
          options: [
            "A 2009 catalog episode watched a few times a week",
            "This week's simulcast episode of a hit show",
            "A trailer that plays once on the home page",
            "Every title at the same time",
          ],
          answer: 1,
          explain:
            "The simulcast episode has many views in a few days, so the right side of the break-even rule (views x GB x capable share x saving x price) is large and arrives fast. The old episode may never repay the encode.",
        },
        {
          kind: "summary",
          points: [
            "Per episode: ladder about 4.2 GB, mezzanine about 27 GB; dubs and subtitles are almost free in bytes.",
            "Catalog at list: about $26k packaged (2 clouds) plus $5.4k to $30k mezzanine. Storage is small; delivery is big.",
            "Keep retrieval-fee classes off the origin path; mezzanines fit cold classes.",
            "Managed JIT: about $270k a month at list to save about $6.6k per cloud. One CMAF + cbcs copy is the real win.",
            "Codecs save bytes but cost encode, storage and device coverage. Encode the most-watched titles first.",
          ],
        },
      ],
    },

    /* ================= Lesson 7: worked bill and cost-aware steering ================= */
    {
      id: "ch16-l7",
      title: "The bill and cost-aware steering",
      goal: "Build the assumed model's monthly bill line by line, and steer traffic by marginal cost without hurting quality.",
      minutes: 12,
      steps: [
        {
          kind: "quiz",
          prompt: "In the assumed model's monthly bill, which line do you expect to dominate?",
          options: ["Storage", "CDN bytes delivered", "CDN requests", "Replication"],
          answer: 1,
          explain:
            "**CDN bytes dominate**, at list or negotiated. Everything else is small, except origin egress when the cloud-CDN pairing is wrong.",
        },
        {
          kind: "read",
          title: "Inputs (all assumed)",
          body:
            "Everything below uses the book's **assumed** traffic model, not Crunchyroll data, and list prices from November 2026.\n\n" +
            "The regional mix is a pure assumption chosen to show regional pricing. Japan is set low on the assumption that many titles are licensed for outside Japan.",
          visual: {
            kind: "table",
            headers: ["Input", "Assumed value"],
            rows: [
              ["Monthly delivered bytes", "540 PB"],
              ["Segments", "6 s, about 3 MB video, plus one audio segment each"],
              ["Edge hit ratio, shield catch", "95% by bytes, 80% of edge misses"],
              ["Origin fills", "5.4 PB per month"],
              ["Regional mix of bytes", "45% NA, 20% Europe, 20% S. America, 5% SE Asia + HK, 4% ME + Africa, 3% India, 2% Australia, 1% Japan"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "North America is 45% of 540 PB, billed at CloudFront's $0.020 per GB. Monthly cost?",
          answer: 4.86,
          tolerance: 0.15,
          unit: "$M",
          hint: "45% of 540 PB = 243 PB = 243,000,000 GB.",
          explain: "243,000,000 GB x $0.020 = **$4.86M**, about $4.9M a month.",
        },
        {
          kind: "read",
          title: "CDN bytes, line by line",
          body:
            "CloudFront 2026 tiers applied per region. At these volumes almost every byte lands in the \"over 5 PB\" tier.\n\n" +
            "North America is 45% of bytes but **under 30%** of cost. India and Australia are 5% of bytes and about **13%** of cost.",
          visual: {
            kind: "table",
            headers: ["Region", "Bytes", "$/GB", "Monthly"],
            rows: [
              ["North America", "243 PB", "0.020", "~$4.9M"],
              ["Europe", "108 PB", "0.020", "~$2.2M"],
              ["South America", "108 PB", "0.041", "~$4.4M"],
              ["SE Asia, Hong Kong", "27 PB", "0.063", "~$1.7M"],
              ["Middle East, Africa", "21.6 PB", "0.043", "~$0.9M"],
              ["India", "16.2 PB", "0.073", "~$1.2M"],
              ["Australia, NZ", "10.8 PB", "0.083", "~$0.9M"],
              ["Japan", "5.4 PB", "0.072", "~$0.4M"],
              ["Total", "540 PB", "~0.031", "~$16.6M"],
            ],
            caption: "Assumed mix, CloudFront list 2026",
          },
        },
        {
          kind: "quiz",
          prompt: "South America and Europe each carry 108 PB. Why does South America cost about twice as much?",
          options: [
            "South Americans watch more hours",
            "Its effective rate is about $0.041 vs $0.020 per GB",
            "Requests are free in Europe",
            "Europe is on a commit",
          ],
          answer: 1,
          explain:
            "Same bytes, different rate card: about $0.041 vs $0.020 per GB. That is $4.4M vs $2.2M a month. Regional mix is one of the biggest levers on the bill.",
        },
        {
          kind: "number",
          prompt: "540 PB in 3 MB video segments, plus one audio segment per video segment. How many CDN requests a month?",
          answer: 360,
          tolerance: 20,
          unit: "billion",
          explain:
            "540 PB / 3 MB = **180 billion** video requests. With separate audio, about **360 billion**. At $0.010 to $0.022 per 10,000, about **$0.4M**: 2 to 3% of byte cost. With 2-second segments it would triple.",
        },
        {
          kind: "read",
          title: "The other lines",
          body:
            "- **CDN requests:** about $0.4M.\n" +
            "- **Origin Shield requests:** about 18 billion x $0.0075 per 10,000 = about **$14,000**.\n" +
            "- **Origin egress:** S3 to CloudFront **$0**. A third-party CDN pulling 5.4 PB from S3 at about $0.05: about $270,000. Google over CDN Interconnect: about $216,000 at the old $0.04, or $432,000 at the reported $0.08.\n" +
            "- **Storage:** about $25,000 to $45,000.\n" +
            "- **Replication:** 1,000 new episodes x 10 GB = 10 TB, under $1,000.\n" +
            "- **Logs:** 360 billion lines, 100+ TB raw a month; not estimated here (Chapter 11).",
        },
        {
          kind: "read",
          title: "List vs negotiated",
          body:
            "The negotiated range is wide on purpose. It comes from 2019 and 2020 survey data; prices have fallen since, and real contracts have regional premiums, minimums and fees not shown. **Do not quote it as Crunchyroll's bill.**",
          visual: {
            kind: "table",
            headers: ["Line", "At list (CloudFront 2026)", "Illustrative negotiated"],
            rows: [
              ["CDN bytes", "about $16.6M", "$0.5M to $2.7M ($0.001 to $0.005/GB)"],
              ["CDN requests", "about $0.4M", "often negotiated down or bundled"],
              ["Origin egress", "$0 to about $0.27M", "depends on cloud contract"],
              ["Storage, shield, replication", "about $40k to $60k", "cloud discount programs apply"],
              ["Total", "about $17M per month", "roughly $1M to $3.5M per month"],
            ],
          },
        },
        {
          kind: "number",
          prompt: "At list the bill is about $0.031 per GB. A streaming hour at 4 Mbps is 1.8 GB. What does one streaming hour cost at list?",
          answer: 0.056,
          tolerance: 0.004,
          unit: "$/hour",
          explain:
            "1.8 GB x $0.031 = about **$0.056 per streaming hour**. At an illustrative $0.002 per GB it is about **$0.004 per hour**.",
        },
        {
          kind: "read",
          title: "How to read the bill",
          body:
            "**CDN bytes dominate in either column.** Everything else is small, except origin egress when the pairing is wrong.\n\n" +
            "The big levers are: contract rate per GB, regional mix, bytes per hour, and hit ratio.",
          callout: {
            type: "crunchyroll",
            text:
              "Wikipedia, citing a May 2026 announcement, reports about 21 million paid subscriptions, after Crunchyroll ended its free ad-supported tier at the end of December 2025. At roughly $1M to $3.5M a month negotiated, delivery would be about $0.05 to $0.17 per paid subscriber per month; at list, about $0.80. Neither is Crunchyroll's real cost. The gap between list and contract is the gap between a minor cost and a serious one, and that gap is what negotiation is worth.",
          },
        },
        {
          kind: "widget",
          widget: "cost",
          title: "Build the bill",
          task:
            "Start from the book's bill at list (about $17M a month). Change the regional mix on the **Traffic** tab, then set the contract rate to a survey price on the **Contract** tab. Which lever moves the bill most?",
          props: { start: "book" },
        },
        {
          kind: "quiz",
          prompt: "It is the 10th of the month. CDN A is far below its monthly commit. What is the marginal cost of sending it one more GB?",
          options: [
            "Its full per-GB rate",
            "Near zero: you pay for the commit anyway",
            "Its overage rate",
            "Double, because of the 95th percentile",
          ],
          answer: 1,
          explain:
            "With an unfilled commit, the next GB is effectively **free**: you pay for the commit whether you use it or not. Marginal cost depends on contract state, not just the rate card.",
        },
        {
          kind: "read",
          title: "Marginal cost, not cheapest CDN",
          body:
            "Cost-aware steering does **not** mean \"send traffic to the cheapest CDN.\" It means: among CDNs that meet the quality bar for this region and ISP right now, prefer the one with the lowest **marginal cost**, the cost of the next GB.\n\n" +
            "- Unfilled commit this month: the next GB is effectively **free**.\n" +
            "- 95th percentile billing: off-peak traffic below this month's 95th percentile costs **nothing extra**; extra peak traffic may **raise** the whole month.\n" +
            "- Above commit, per GB: the regional **overage rate**.",
        },
        {
          kind: "read",
          title: "Step 1: quality first",
          body:
            "Start by filtering CDNs by health and a QoE threshold for this region and ISP.\n\n" +
            "If **no** CDN passes, pick the best-QoE CDN, ignore cost, and alert. Cost never overrides a broken experience.",
          visual: { kind: "flow", spec: { ...steer, focus: ["filter", "none", "state", "filter>none", "filter>state"] }, caption: "Cost-aware steering for one region and ISP" },
        },
        {
          kind: "read",
          title: "Step 2: compute marginal cost",
          body:
            "For each CDN that passes, compute marginal cost from its contract state:\n\n" +
            "- Unfilled commit: near zero.\n" +
            "- Billed at 95th percentile and staying below the current p95: low.\n" +
            "- Would raise the p95: high.\n" +
            "- Per-GB above commit: the overage rate.",
          visual: { kind: "flow", spec: { ...steer, focus: ["state", "zero", "low", "high", "over", "state>zero", "state>low", "state>high", "state>over"] } },
        },
        {
          kind: "read",
          title: "Step 3: weight, gently",
          body:
            "Weight traffic by cost **within the QoE band**. Then apply [[hysteresis]] and a minimum share per CDN, so traffic does not flip back and forth.\n\n" +
            "Cost data comes from contracts encoded as access-controlled config (rates, commits, tiers, billing model; Chapter 14), CDN usage APIs and logs, cloud billing exports by SKU, and a forecast of the month's remaining traffic.",
          visual: { kind: "flow", spec: { ...steer, focus: ["zero", "low", "high", "over", "weight", "zero>weight", "low>weight", "high>weight", "over>weight"], flow: ["filter>state", "state>zero", "zero>weight"] } },
        },
        {
          kind: "match",
          prompt: "Match each steering rule to why it exists.",
          pairs: [
            ["Quality band", "Choose on cost only near the best CDN's TTFB and rebuffering"],
            ["Minimum shares", "A CDN with cold caches is not a real backup"],
            ["Hysteresis", "Each move cools caches and raises origin egress"],
            ["Commit pacing", "Avoid a month-end rush that pushes up a p95"],
            ["Content affinity", "Keep a long-tail title on one CDN"],
          ],
          explain:
            "Quality band: cost decides only among CDNs near the best, validated with QoE data (Chapter 10). Minimum shares: keep every CDN warm where you might fail over; it is an insurance premium (Chapter 12). Hysteresis: do not flip traffic every minute for small savings. Commit pacing: track daily and adjust gently. Content affinity protects the hit ratio.",
        },
        {
          kind: "read",
          title: "Show the money",
          body:
            "Dashboards should show **cost per GB and per streaming hour, per CDN, per region**, next to QoE. Cost that nobody sees does not get managed.",
          callout: {
            type: "staff",
            text:
              "For any steering change, ask: \"What happens to each CDN's 95th percentile, our commit pacing and our origin fill volume if this runs for a full month?\" Replay the policy on last month's traffic before shipping. Cost bugs in steering do not page anyone; they arrive on an invoice six weeks later.",
          },
        },
        {
          kind: "read",
          title: "What you bring on day one",
          body:
            "Chapter 17 compares how the giants built or bought their delivery networks, and Chapter 18 uses these numbers in the capstone design's cost envelope.",
          callout: {
            type: "crunchyroll",
            text:
              "The 2026 job posting describes multi-CDN delivery that routes traffic \"by performance, availability and cost,\" multi-origin storage across AWS and GCP, and working with CDN and cloud vendors. Those are exactly this chapter's levers. Actual contracts, rates, regional mix and steering logic are not public; learn them from the team. Bring the method: measure bytes by region, convert to cost per hour, know each vendor's billing model, put a cost section in every design doc, read the invoice monthly, and treat hit ratio and cloud-CDN pairing as money.",
          },
        },
        {
          kind: "widget",
          widget: "cost",
          title: "Cut the bill 30%",
          task:
            "Cut the monthly bill by 30% **without hurting quality**: viewing volume and regional mix stay fixed, and the contract is locked. Use the engineering levers only.",
          props: { start: "challenge" },
        },
        {
          kind: "summary",
          points: [
            "Assumed model at list: about $16.6M CDN bytes, about $17M total; roughly $1M to $3.5M negotiated.",
            "CDN bytes dominate. Big levers: contract rate, regional mix, bytes per hour, hit ratio.",
            "About $0.056 per streaming hour at list; about $0.004 at $0.002 per GB.",
            "Steer by marginal cost only among CDNs that meet the quality bar.",
            "Minimum shares, hysteresis, commit pacing and content affinity keep cost steering safe.",
          ],
        },
      ],
    },

    /* ================= Lesson 8: checkpoint ================= */
    {
      id: "ch16-l8",
      title: "Checkpoint",
      goal: "Answer the chapter's review questions and recall its key numbers.",
      minutes: 10,
      steps: [
        {
          kind: "number",
          prompt: "Assumed model: edge hit ratio falls from 95% to 90%, shield behaviour unchanged. Origin fills were 5.4 PB a month. What are they now?",
          answer: 10.8,
          tolerance: 0.5,
          unit: "PB",
          explain:
            "At 95%, 5% of bytes miss the edge; at 90%, 10% miss. Twice as many bytes reach the shield, and with the same shield behaviour twice as many leave the origin: **5.4 PB to 10.8 PB**.",
        },
        {
          kind: "reveal",
          prompt: "Besides origin egress, what else gets more expensive when the edge hit ratio drops from 95% to 90%?",
          answer:
            "Origin request fees (S3 GETs), shield request fees, JIT packager fees if used, and **startup latency on misses**, which is a QoE cost (Chapter 10).",
        },
        {
          kind: "number",
          prompt: "How many hours of bursting are free under 95th percentile billing in a 30-day month?",
          answer: 36,
          tolerance: 1,
          unit: "hours",
          explain: "8,640 five-minute samples; the top 5% is 432 samples, or **36 hours**.",
        },
        {
          kind: "quiz",
          prompt: "Why might two short simulcast spikes per week be free, but a 2-hour spike every day not?",
          options: [
            "Weekly spikes are smaller in Mbps",
            "Weekly spikes stay well under 36 hours a month; daily 2-hour spikes total about 60 hours",
            "CDNs do not sample on weekends",
            "Daily spikes are billed per GB instead",
          ],
          answer: 1,
          explain:
            "Two short spikes per week stay well under 36 hours per month and are discarded. Two-hour daily spikes total about 60 hours, so the 95th percentile rises to the spike level for the whole month.",
        },
        {
          kind: "number",
          prompt: "Your load factor is 0.42. One Mbps fully used for 30 days moves about 324 GB. How many GB does each billed Mbps carry?",
          answer: 135,
          tolerance: 5,
          unit: "GB",
          explain:
            "324 GB x 0.42 = about **135 GB**. Effective $/GB = price per Mbps per month / 135, using your own measured load factor per region.",
        },
        {
          kind: "quiz",
          prompt: "Your origin is S3 and CloudFront fills from it for free. You add Fastly with the same S3 origin. What changes?",
          options: [
            "Nothing: S3 fills are free for every CDN",
            "Each Fastly fill pays S3 internet egress, which a CloudFront fill does not",
            "CloudFront fills become paid too",
            "Fastly fills are free only at night",
          ],
          answer: 1,
          explain:
            "AWS does not charge for transfer from AWS origins to CloudFront. Fastly pulling from the same bucket pays S3 internet egress, so each Fastly fill costs money a CloudFront fill does not. Shield placement, a shared mid-tier, or a Google origin with interconnect pricing can reduce it.",
        },
        {
          kind: "number",
          prompt: "CloudFront 2026, over-5-PB tier: Australia $0.080, US $0.020. What is the ratio?",
          answer: 4,
          tolerance: 0.1,
          unit: "x",
          explain: "$0.080 / $0.020 = **4x**.",
        },
        {
          kind: "multi",
          prompt: "Which are network reasons for Australia's higher price? Select all that apply.",
          options: [
            "Dependence on long submarine cables",
            "Fewer large exchanges and transit competitors",
            "Smaller PoPs spread fixed costs over fewer bytes",
            "Higher CDN profit margins",
          ],
          answers: [0, 1, 2],
          explain:
            "Australia depends on long submarine cables and has fewer large exchanges and transit competitors; smaller PoPs also spread fixed costs over fewer bytes. The cost is real, not margin.",
        },
        {
          kind: "reveal",
          prompt: "A colleague proposes managed JIT packaging to cut storage costs. What do you say in the design review?",
          answer:
            "JIT saves maybe a few thousand dollars a month of storage per cloud, but managed JIT costs about **$0.05 per GB** packaged in 2026: about **$270,000 a month** at list on 5.4 PB of fills. One **CMAF copy with cbcs** halves storage and improves hit ratio with no per-GB fee. JIT still fits a cold archive or a self-run packager.",
        },
        {
          kind: "reveal",
          prompt: "When does encoding a title in AV1 pay back, and why is a new simulcast episode a better candidate than an old catalog one?",
          answer:
            "When views x GB per view x capable-device share x bit saving x price per GB exceeds encode plus storage cost. A new simulcast episode has many views in a few days, so savings arrive fast; an old episode may never repay the encode.",
        },
        {
          kind: "quiz",
          prompt: "Why might the marginal cost of sending traffic to a CDN be zero on the 10th of the month but high on the 28th?",
          options: [
            "CDNs raise prices at month end",
            "On the 10th the commit is unfilled; by the 28th it is filled, so the next GB pays overage, and peak traffic can raise the p95",
            "Traffic is always lower on the 10th",
            "Request fees reset on the 28th",
          ],
          answer: 1,
          explain:
            "Early in the month, a CDN below its commit carries traffic you pay for anyway. Late in the month, after the commit is filled, the next GB costs the overage rate, and on 95th percentile billing extra peak traffic can raise the whole month's billed rate.",
        },
        {
          kind: "quiz",
          prompt: "Which statement about list prices is right?",
          options: [
            "List prices are what large streaming services pay",
            "List prices are a ceiling; surveys reported large deals near $0.001 per GB (2019) and as low as $0.0006 (2020)",
            "Large customers pay about half of list",
            "Every major CDN publishes its video delivery prices",
          ],
          answer: 1,
          explain:
            "CloudFront's lowest US list rate in 2026 is $0.020 per GB. Surveys reported large deals near $0.001 in 2019 and as low as $0.0006 in 2020. Media CDN and Akamai publish no delivery list prices.",
        },
        {
          kind: "number",
          prompt: "The assumed model delivers 540 PB a month. At an illustrative negotiated $0.002 per GB, roughly what are CDN bytes per month?",
          answer: 1.08,
          tolerance: 0.05,
          unit: "$M",
          explain:
            "540,000,000 GB x $0.002 = **$1.08M**. Compare about $16.6M at list. The book's negotiated range is $0.5M to $2.7M for bytes ($0.001 to $0.005 per GB), roughly $1M to $3.5M total.",
        },
        {
          kind: "multi",
          prompt: "Which are true about cost-aware steering? Select all that apply.",
          options: [
            "It picks the lowest marginal cost among CDNs that meet the quality bar",
            "It keeps a minimum share on every CDN you might fail over to",
            "It uses hysteresis and commit pacing",
            "It always sends traffic to the cheapest CDN",
            "It moves traffic every minute to chase small savings",
          ],
          answers: [0, 1, 2],
          explain:
            "Cost decides only within the QoE band. Minimum shares keep backups warm, hysteresis stops flapping that cools caches, and commit pacing avoids a month-end rush. \"Always cheapest\" and minute-by-minute flipping both hurt quality and hit ratio.",
        },
        {
          kind: "summary",
          title: "Key takeaways",
          points: [
            "Delivery cost scales with viewing; most levers are engineering choices: segment size, cache keys, shield placement, codec, steering.",
            "Know the pricing model before comparing rates. List is a ceiling: $0.020 per GB list vs about $0.001 (2019) and $0.0006 (2020) surveyed.",
            "95th percentile drops about 36 hours a month; each CDN has its own, so failover and steering are billing-sensitive. Regions differ 2x to 4x.",
            "Pairing decides origin egress (S3 to CloudFront free). 95% to 90% hit ratio doubles fills: 5.4 PB more a month.",
            "Storage is tens of thousands, delivery is millions at list. Encode new codecs for the most-watched titles first.",
            "Steer by marginal cost within the quality bar, with minimum shares, hysteresis and commit pacing.",
          ],
        },
      ],
    },
  ],
  sources: [
    "Amazon CloudFront pay-as-you-go pricing, accessed November 2026. https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/",
    "Amazon CloudFront pricing, flat-rate plans, accessed November 2026. https://aws.amazon.com/cloudfront/pricing/",
    "Fastly pricing, accessed November 2026. https://www.fastly.com/pricing",
    "Dan Rayburn, \"Latest CDN Pricing Trends,\" Streaming Media Blog, May 9, 2019. https://www.streamingmediablog.com/2019/05/latest-cdn-pricing-trends.html",
    "Dan Rayburn, \"CDN/Media Pricing Sees Big Drop for Largest Customers: Pricing Down to $0.0006,\" Streaming Media Blog, May 11, 2020. https://streamingmediablog.com/2020/05/q1-cdn-pricing.html",
    "Dan Rayburn, \"Q1 2025 CDN Pricing Survey Data Now Available For Purchase,\" Streaming Media Blog, June 2025. https://www.streamingmediablog.com/2025/06/cdn-pricing-survey-data.html",
    "\"Burstable billing,\" Wikipedia, accessed November 2026. https://en.wikipedia.org/wiki/Burstable_billing",
    "Cloudflare, \"AWS's Egregious Egress,\" Cloudflare Blog, July 23, 2021. https://blog.cloudflare.com/aws-egregious-egress",
    "Amazon S3 pricing, accessed November 2026. https://aws.amazon.com/s3/pricing/",
    "CloudZero, \"S3 Pricing\" (us-east-1 list prices), July 2026. https://www.cloudzero.com/blog/s3-pricing",
    "Google Cloud, \"CDN Interconnect overview,\" accessed November 2026. https://docs.cloud.google.com/network-connectivity/docs/cdn-interconnect",
    "Akave, \"Google Cloud is doubling its peering egress rates on May 1,\" 2026 (third-party report; verify against Google's network pricing page). https://akave.com/blog/google-cloud-is-doubling-its-peering-egress-rates-on-may-1",
    "Fastly documentation, \"Discounted egress from Google,\" accessed November 2026. https://www.fastly.com/documentation/guides/integrations/non-fastly-services/discounted-egress-from-google/",
    "Dan Rayburn, \"Google Cloud Announces CDN Interconnect Program With Level 3, Fastly, Highwinds & CloudFlare,\" Streaming Media Blog, September 2015. https://www.streamingmediablog.com/2015/09/google-cloud-cdn-interconnect.html",
    "Google Cloud, \"Media CDN overview,\" accessed November 2026. https://docs.cloud.google.com/media-cdn/docs/overview",
    "Google Cloud, \"Cloud CDN pricing,\" accessed November 2026. https://cloud.google.com/cdn/pricing",
    "Cloudflare, \"Stream pricing,\" accessed November 2026. https://developers.cloudflare.com/stream/pricing/",
    "Cloudflare, \"Updated Terms of Service,\" Cloudflare Blog, May 16, 2023. https://blog.cloudflare.com/updated-tos/",
    "Cloudflare, \"Bandwidth Alliance,\" accessed November 2026. https://www.cloudflare.com/bandwidth-alliance",
    "AWS Elemental MediaPackage pricing, accessed November 2026. https://aws.amazon.com/mediapackage/pricing/",
    "\"AV1,\" Wikipedia (compiles Netflix 2017 and 2020, Facebook 2018, University of Waterloo 2020, Streaming Media 2020, Netflix December 2025, decoder support), accessed November 2026. https://en.wikipedia.org/wiki/AV1",
    "Netflix, \"Open Connect,\" accessed November 2026. https://openconnect.netflix.com/en/",
    "\"Crunchyroll,\" Wikipedia (subscriptions as of May 2026, end of free tier December 2025, catalog description), accessed November 2026. https://en.wikipedia.org/wiki/Crunchyroll",
  ],
};
export default chapter;
