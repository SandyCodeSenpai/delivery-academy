import type { GlossaryEntry } from "./types";

export const GLOSSARY: GlossaryEntry[] = [
 {
  "term": "206 Partial Content",
  "def": "HTTP status returned when the server sends only the byte range the client asked for."
 },
 {
  "term": "304 Not Modified",
  "def": "HTTP status saying the cached copy is still valid, so no body is sent."
 },
 {
  "term": "403 / 404 / 410",
  "def": "Forbidden (often a bad token or geo block) / not found / gone forever. Players treat them differently."
 },
 {
  "term": "95th percentile billing",
  "def": "Billing method that samples bandwidth (often every 5 minutes), drops the top 5 percent of samples, and bills on the highest remaining value."
 },
 {
  "term": "AAC",
  "def": "Advanced Audio Coding, the most widely supported audio codec for streaming."
 },
 {
  "term": "ABR (adaptive bitrate)",
  "def": "Streaming where the player switches between renditions of different quality as network conditions change."
 },
 {
  "term": "ACME",
  "def": "Protocol used to request and renew TLS certificates automatically (used by Let's Encrypt and others)."
 },
 {
  "term": "Admission policy",
  "def": "Cache rule that decides whether a new object is worth storing at all, to avoid filling the cache with one-hit wonders."
 },
 {
  "term": "Akamai EdgeAuth",
  "def": "Akamai's token authentication for protecting content URLs at the edge."
 },
 {
  "term": "Anycast",
  "def": "Announcing the same IP address from many locations so the network routes each user to a nearby one."
 },
 {
  "term": "AS (Autonomous System)",
  "def": "A network under one administration with its own routing policy, identified by an ASN."
 },
 {
  "term": "ASN",
  "def": "Autonomous System Number. Used to group traffic by ISP for QoE analysis."
 },
 {
  "term": "AV1",
  "def": "Royalty-free modern video codec with better compression than H.264 and HEVC, but heavier to encode."
 },
 {
  "term": "Bandwidth-delay product",
  "def": "Bandwidth times round-trip time. The amount of data that must be \"in flight\" to fill a link."
 },
 {
  "term": "BBA",
  "def": "Buffer-based adaptation: ABR that picks bitrate mainly from how full the buffer is."
 },
 {
  "term": "BBR",
  "def": "Congestion control from Google that models bandwidth and RTT instead of reacting only to loss."
 },
 {
  "term": "BGP",
  "def": "Border Gateway Protocol. How autonomous systems tell each other which IP prefixes they can reach."
 },
 {
  "term": "BHR (byte hit ratio)",
  "def": "Share of bytes served from cache. The key cost and origin-load metric for video."
 },
 {
  "term": "Blast radius",
  "def": "How many users or systems one failure or bad change can affect."
 },
 {
  "term": "BOLA",
  "def": "Buffer-based ABR algorithm using Lyapunov optimization to balance quality and stalls."
 },
 {
  "term": "Burn rate",
  "def": "How fast an error budget is being used, relative to the rate that would use exactly all of it over the SLO window."
 },
 {
  "term": "Byte-range request",
  "def": "HTTP request for only part of a file using the `Range` header."
 },
 {
  "term": "Cache key",
  "def": "The value a cache uses to decide if two requests are for the same object."
 },
 {
  "term": "Cache-Control",
  "def": "HTTP header with caching instructions such as `max-age`, `s-maxage`, `no-store`."
 },
 {
  "term": "Cardinality",
  "def": "Number of unique label combinations in a metric. High cardinality makes monitoring slow and costly."
 },
 {
  "term": "cbcs",
  "def": "CENC encryption mode using AES-CBC with pattern encryption. Used by FairPlay and increasingly by Widevine and PlayReady, enabling one CMAF set for all."
 },
 {
  "term": "cenc (mode)",
  "def": "CENC encryption mode using AES-CTR. Historically used by Widevine and PlayReady for DASH."
 },
 {
  "term": "CENC",
  "def": "Common Encryption: a standard way to encrypt media so several DRM systems can decrypt the same file."
 },
 {
  "term": "Cell",
  "def": "An isolated slice of a system (by region, customer or traffic share) that limits blast radius."
 },
 {
  "term": "CHR (cache hit ratio)",
  "def": "Share of requests (request hit ratio) or bytes (byte hit ratio) served from cache."
 },
 {
  "term": "Circuit breaker",
  "def": "Pattern that stops calling a failing dependency for a while to let it recover."
 },
 {
  "term": "CloudFront Functions",
  "def": "Lightweight JavaScript functions that run at CloudFront edge locations for simple request changes."
 },
 {
  "term": "CMAF",
  "def": "Common Media Application Format: fragmented MP4 media usable by both HLS and DASH."
 },
 {
  "term": "CMCD",
  "def": "Common Media Client Data (CTA-5004): player sends fields like session ID, bitrate and buffer length with each request."
 },
 {
  "term": "CMSD",
  "def": "Common Media Server Data: server and CDN send data back to the player and downstream in response headers."
 },
 {
  "term": "CNAME",
  "def": "DNS record that points one name to another. Used to hand a hostname to a CDN."
 },
 {
  "term": "Codec",
  "def": "Algorithm that compresses and decompresses video or audio (H.264, HEVC, AV1, AAC)."
 },
 {
  "term": "Commit",
  "def": "Contract promise to buy a minimum volume from a CDN in return for a lower unit price."
 },
 {
  "term": "Consistent hashing",
  "def": "Method to spread objects across cache servers so that adding or removing a server moves few objects."
 },
 {
  "term": "Content Steering",
  "def": "HLS and DASH feature where a steering server tells players which CDN pathway to use, even mid-session."
 },
 {
  "term": "Control plane",
  "def": "Services that make decisions (playback API, entitlement, steering, licenses), as opposed to moving bytes."
 },
 {
  "term": "CORS",
  "def": "Cross-Origin Resource Sharing: browser rules that decide if a web player may load media from another domain."
 },
 {
  "term": "Cross-cloud link",
  "def": "Private or partner network connection between two clouds, such as AWS and GCP."
 },
 {
  "term": "CUBIC",
  "def": "Default TCP congestion control on Linux. Grows the window as a cubic function of time since the last loss."
 },
 {
  "term": "DASH (MPEG-DASH)",
  "def": "ISO standard adaptive streaming format using an MPD manifest."
 },
 {
  "term": "Data plane",
  "def": "The part of the system that moves bytes: CDN, shield, origin storage."
 },
 {
  "term": "DDoS",
  "def": "Distributed denial of service: flooding a service with traffic from many sources."
 },
 {
  "term": "Direct Connect / Cloud Interconnect",
  "def": "Private dedicated network links into AWS / Google Cloud."
 },
 {
  "term": "DNSSEC",
  "def": "DNS extension that signs records so resolvers can verify they were not forged."
 },
 {
  "term": "DRM",
  "def": "Digital Rights Management: encryption plus license control so only authorized devices can play content."
 },
 {
  "term": "Drift (config)",
  "def": "When the live configuration differs from what is in source control."
 },
 {
  "term": "DVR window",
  "def": "How far back a viewer can seek in a live stream."
 },
 {
  "term": "ECMP",
  "def": "Equal-cost multi-path routing: spreading flows across several equal paths, often by hashing."
 },
 {
  "term": "ECS (EDNS Client Subnet)",
  "def": "DNS extension that passes part of the client's IP to the authoritative server so it can answer by user location."
 },
 {
  "term": "Edge",
  "def": "The CDN servers closest to viewers that answer requests."
 },
 {
  "term": "Edge compute",
  "def": "Running custom code on CDN servers (Fastly Compute, Cloudflare Workers, Lambda@Edge, CloudFront Functions)."
 },
 {
  "term": "Egress",
  "def": "Data leaving a network or cloud, usually billed per GB."
 },
 {
  "term": "Embedded cache",
  "def": "CDN server placed inside an ISP's network (Netflix OCAs, Google GGC, Akamai deep deployment)."
 },
 {
  "term": "Entitlement",
  "def": "Check that a user is allowed to watch a title in their region and plan."
 },
 {
  "term": "Error budget",
  "def": "The amount of unreliability an SLO allows (for example 0.1 percent of a month at 99.9 percent)."
 },
 {
  "term": "ETag",
  "def": "Identifier for a version of a resource, used for revalidation."
 },
 {
  "term": "Exits before video start",
  "def": "Viewers who leave before the first frame plays. A strong signal of a slow or failed start."
 },
 {
  "term": "FairPlay",
  "def": "Apple's DRM for HLS on Apple devices."
 },
 {
  "term": "fMP4",
  "def": "Fragmented MP4: MP4 split into small fragments suitable for streaming. The basis of CMAF."
 },
 {
  "term": "Forensic watermarking",
  "def": "Invisible marks in video that identify the session or user, used to trace leaks."
 },
 {
  "term": "GGC",
  "def": "Google Global Cache: Google's caches placed inside ISP networks."
 },
 {
  "term": "GOP",
  "def": "Group of pictures: a run of frames starting with a keyframe. Segment boundaries must align with GOPs."
 },
 {
  "term": "Graceful degradation",
  "def": "Reducing quality or features to keep the core service working under stress."
 },
 {
  "term": "GSLB",
  "def": "Global server load balancing: steering users to sites or CDNs, usually via DNS."
 },
 {
  "term": "H.264 / AVC",
  "def": "The most widely supported video codec."
 },
 {
  "term": "Health check",
  "def": "Periodic probe that decides if a server, origin or CDN is healthy."
 },
 {
  "term": "HEVC / H.265",
  "def": "Codec with better compression than H.264, with licensing and device-support complexity."
 },
 {
  "term": "HLS",
  "def": "HTTP Live Streaming: Apple's adaptive streaming format using m3u8 playlists."
 },
 {
  "term": "HTTP/2",
  "def": "HTTP version with multiplexed streams over one TCP connection."
 },
 {
  "term": "HTTP/3",
  "def": "HTTP over QUIC, running on UDP, avoiding TCP head-of-line blocking."
 },
 {
  "term": "Hysteresis",
  "def": "Using different thresholds or durations to enter and leave a state, to stop flapping."
 },
 {
  "term": "IaC",
  "def": "Infrastructure as Code: managing infrastructure and CDN config through version-controlled code (Terraform, Pulumi, CDK)."
 },
 {
  "term": "Instant purge",
  "def": "Fastly's fast, global invalidation feature, often used with surrogate keys."
 },
 {
  "term": "IXP",
  "def": "Internet Exchange Point: a shared location where many networks connect and exchange traffic."
 },
 {
  "term": "Just-in-time packaging (JIT)",
  "def": "Creating HLS or DASH outputs on request from a single stored source, instead of storing every format."
 },
 {
  "term": "Key rotation",
  "def": "Changing encryption or signing keys on a schedule, with overlap so clients do not break."
 },
 {
  "term": "L1 / L3 (Widevine)",
  "def": "Widevine security levels. L1 decrypts and decodes in hardware trusted environments, L3 in software. Studios often require L1 for HD and above."
 },
 {
  "term": "Lambda@Edge",
  "def": "AWS Lambda functions that run at CloudFront regional edge caches."
 },
 {
  "term": "Last mile",
  "def": "The final network link to the viewer (cable, DSL, fiber, mobile)."
 },
 {
  "term": "Latency",
  "def": "Time for data to travel, often measured as RTT or time to first byte."
 },
 {
  "term": "License server",
  "def": "Service that gives a device the content key after checking rights."
 },
 {
  "term": "LL-DASH",
  "def": "Low-latency DASH using CMAF chunks and chunked transfer."
 },
 {
  "term": "LL-HLS",
  "def": "Low-latency HLS using partial segments, blocking playlist reload and preload hints."
 },
 {
  "term": "Long tail",
  "def": "The large set of rarely watched titles. Hard to cache, important for storage cost."
 },
 {
  "term": "LRU / LFU",
  "def": "Eviction policies: least recently used / least frequently used."
 },
 {
  "term": "Maglev",
  "def": "Google's software network load balancer using consistent hashing."
 },
 {
  "term": "Manifest / playlist",
  "def": "Text file listing renditions and segments (HLS m3u8, DASH MPD)."
 },
 {
  "term": "max-age / s-maxage",
  "def": "Cache lifetime for all caches / for shared caches (CDNs) only."
 },
 {
  "term": "Mezzanine",
  "def": "High-quality master file delivered by the licensor, used as transcoding input."
 },
 {
  "term": "Mid-tier",
  "def": "A cache layer between edge and origin; another word for shield or parent tier."
 },
 {
  "term": "MPC",
  "def": "Model predictive control ABR: picks bitrate by predicting throughput over the next few segments."
 },
 {
  "term": "MPD",
  "def": "Media Presentation Description: the DASH manifest."
 },
 {
  "term": "mTLS",
  "def": "Mutual TLS: both client and server present certificates. Used between CDN and origin."
 },
 {
  "term": "MTU",
  "def": "Maximum transmission unit: largest packet size on a link."
 },
 {
  "term": "Multi-CDN",
  "def": "Using more than one CDN vendor at the same time."
 },
 {
  "term": "Negative caching",
  "def": "Caching error responses such as 404 for a short time."
 },
 {
  "term": "Next-Gen WAF",
  "def": "Fastly's web application firewall product (from the Signal Sciences acquisition)."
 },
 {
  "term": "OCA",
  "def": "Open Connect Appliance: Netflix's cache server."
 },
 {
  "term": "OCSP stapling",
  "def": "Server attaches proof that its certificate is not revoked, saving the client a lookup."
 },
 {
  "term": "One-hit wonder",
  "def": "Object requested once and never again. It wastes cache space."
 },
 {
  "term": "Open Connect",
  "def": "Netflix's own CDN with embedded appliances and peering."
 },
 {
  "term": "Origin",
  "def": "The source of content behind the CDN: object storage plus optional packager."
 },
 {
  "term": "Origin cloaking",
  "def": "Hiding or locking the origin so only the CDN can fetch from it."
 },
 {
  "term": "Origin group / director",
  "def": "CloudFront origin group / Fastly director: config that fails over or balances across several origins."
 },
 {
  "term": "Origin offload",
  "def": "Share of traffic the CDN serves without going to origin."
 },
 {
  "term": "Origin Shield",
  "def": "CloudFront's extra cache layer in front of origin. Generic term: shield."
 },
 {
  "term": "Packager",
  "def": "Component that turns encoded media into HLS or DASH segments and manifests."
 },
 {
  "term": "Pathway cloning",
  "def": "Content Steering feature to create new CDN pathways by rewriting hosts of existing ones."
 },
 {
  "term": "Peering",
  "def": "Two networks exchanging traffic directly, often without payment (settlement-free)."
 },
 {
  "term": "Pensieve",
  "def": "ML-based ABR algorithm using reinforcement learning."
 },
 {
  "term": "Per-title encoding",
  "def": "Choosing a bitrate ladder for each title based on its complexity."
 },
 {
  "term": "PlayReady",
  "def": "Microsoft's DRM system."
 },
 {
  "term": "PNI",
  "def": "Private network interconnect: a dedicated link between two networks, usually at a shared facility."
 },
 {
  "term": "PoP",
  "def": "Point of presence: a CDN site with routers and cache servers."
 },
 {
  "term": "Pre-warming",
  "def": "Fetching content into caches before viewers ask for it."
 },
 {
  "term": "Purge / invalidation",
  "def": "Removing or marking content stale in CDN caches."
 },
 {
  "term": "QoE",
  "def": "Quality of experience: how good playback feels to the viewer (start time, stalls, quality)."
 },
 {
  "term": "QUIC",
  "def": "UDP-based transport with built-in TLS 1.3, used by HTTP/3."
 },
 {
  "term": "Rebuffering ratio",
  "def": "Time spent stalled divided by total watch time."
 },
 {
  "term": "Regional Edge Cache",
  "def": "CloudFront's mid-tier caches between edge locations and origin."
 },
 {
  "term": "Rendition",
  "def": "One version of a stream at a specific resolution and bitrate."
 },
 {
  "term": "Replication lag",
  "def": "Time between an object landing in the primary store and appearing in the replica."
 },
 {
  "term": "Request collapsing",
  "def": "When many requests miss for the same object, sending only one to the upstream and sharing the answer."
 },
 {
  "term": "Retry budget",
  "def": "Limit on retries as a share of normal requests, to prevent retry storms."
 },
 {
  "term": "Retry storm",
  "def": "Many clients retrying at once, multiplying load on a struggling system."
 },
 {
  "term": "RTT",
  "def": "Round-trip time between two endpoints."
 },
 {
  "term": "RUM",
  "def": "Real user monitoring: measurements collected from real viewers' devices."
 },
 {
  "term": "S3-FIFO",
  "def": "Simple FIFO-based cache eviction algorithm with good hit ratio (SOSP 2023)."
 },
 {
  "term": "Segment",
  "def": "A small chunk of media (often 2-6 seconds) fetched by the player."
 },
 {
  "term": "Session resumption",
  "def": "TLS feature that reuses earlier secrets to make reconnection faster."
 },
 {
  "term": "Shield",
  "def": "A designated cache layer that all edges go through before origin, to collapse misses."
 },
 {
  "term": "Signed cookie",
  "def": "Cookie that grants access to many URLs, verified by the CDN."
 },
 {
  "term": "Signed URL",
  "def": "URL with an expiry and signature so only authorized holders can fetch it."
 },
 {
  "term": "Simulcast",
  "def": "Releasing an episode worldwide shortly after its Japanese broadcast, at a fixed time."
 },
 {
  "term": "SLI / SLO / SLA",
  "def": "Indicator measured / target set / contract promised for reliability."
 },
 {
  "term": "Slow start",
  "def": "TCP phase where the sending rate grows quickly from a small start."
 },
 {
  "term": "SNI",
  "def": "Server Name Indication: TLS field telling the server which hostname the client wants."
 },
 {
  "term": "Soft purge",
  "def": "Marking cached content stale instead of deleting it, so it can still be served while revalidating."
 },
 {
  "term": "SSAI",
  "def": "Server-side ad insertion: stitching ads into the stream on the server side."
 },
 {
  "term": "stale-if-error / stale-while-revalidate",
  "def": "Directives letting a cache serve stale content on origin errors or while refreshing."
 },
 {
  "term": "Static stability",
  "def": "A design that keeps working with its current state when a dependency fails."
 },
 {
  "term": "Steering",
  "def": "Choosing which CDN or site serves each viewer."
 },
 {
  "term": "Surrogate key",
  "def": "Tag attached to cached objects so many can be purged with one call."
 },
 {
  "term": "Surrogate-Control",
  "def": "Header with caching instructions meant only for CDNs, stripped before reaching the browser."
 },
 {
  "term": "Synthetic probe",
  "def": "Automated test request from a known location (Catchpoint, ThousandEyes)."
 },
 {
  "term": "Targeted Cache-Control",
  "def": "Headers like `CDN-Cache-Control` aimed at specific caches (RFC 9213)."
 },
 {
  "term": "Thundering herd",
  "def": "Many requests hitting a cold cache or origin at the same moment."
 },
 {
  "term": "Time to first byte (TTFB)",
  "def": "Time from request to first byte of response."
 },
 {
  "term": "TLS 1.3",
  "def": "Current TLS version with a 1-RTT handshake and optional 0-RTT resumption."
 },
 {
  "term": "Token authentication",
  "def": "Validating a signed token on each request at the CDN edge."
 },
 {
  "term": "Transit",
  "def": "Paid service where a network carries your traffic to the rest of the internet."
 },
 {
  "term": "Trick play",
  "def": "Thumbnails or I-frame tracks used while seeking."
 },
 {
  "term": "TTL",
  "def": "Time to live: how long a cached item or DNS record stays valid."
 },
 {
  "term": "TTML / IMSC / WebVTT",
  "def": "Subtitle formats used in streaming."
 },
 {
  "term": "Turbo replication",
  "def": "GCS dual-region option with a faster replication target."
 },
 {
  "term": "Varnish / VCL",
  "def": "Open-source HTTP cache / its configuration language, which Fastly's config model is based on."
 },
 {
  "term": "Vary",
  "def": "Header saying which request headers change the response, so they must be part of the cache key."
 },
 {
  "term": "Video start failure",
  "def": "A session that tried to play but never showed a frame."
 },
 {
  "term": "Video start time",
  "def": "Time from pressing play to first frame."
 },
 {
  "term": "VPN detection",
  "def": "Detecting viewers who hide their location, to enforce regional licensing."
 },
 {
  "term": "WAF",
  "def": "Web application firewall: filters malicious HTTP requests."
 },
 {
  "term": "Widevine",
  "def": "Google's DRM, used on Android, Chrome and many TVs."
 },
 {
  "term": "Zero-RTT (0-RTT)",
  "def": "TLS 1.3 and QUIC feature sending data in the first flight on resumption, with replay risk."
 }
];
