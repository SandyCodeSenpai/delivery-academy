/**
 * Pure model for the "Ladder and manifest explorer": presets, storage and object math,
 * and HLS / DASH text generation. No React in here.
 *
 * Sources (book): ch.16 section 16.9 (H.264 ladder 0.4/0.8/1.5/2.5/4/6/8 Mbps, 4 dubs at 128 kbps AAC,
 * 10+ subtitle languages, 50,000 episodes); ch.7 sections 7.3, 7.5, 7.7, 7.8, 7.13 (HEVC at ~60% of AVC bytes,
 * CMAF + cbcs, manifest syntax). Everything else is labelled "assumed" in the UI.
 */

export type Codec = "h264" | "hevc" | "av1";
export type PresetId = "h264" | "hevc" | "av1" | "anime";
export type Packaging = "separate" | "cmaf";
export type Encryption = "both" | "cbcs";

export interface Rung { id: string; w: number; h: number; kbps: number }

export const RESOLUTIONS: [number, number][] = [
  [426, 240], [640, 360], [768, 432], [960, 540], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160],
];

let seq = 0;
export const newId = () => `r${++seq}`;
const R = (w: number, h: number, kbps: number): Rung => ({ id: newId(), w, h, kbps });

/** The book's fixed H.264 ladder (ch.16). Resolutions are assumed, following Apple's example ladder (ch.7). */
const H264_BASE: [number, number, number][] = [
  [1920, 1080, 8000], [1920, 1080, 6000], [1280, 720, 4000], [1280, 720, 2500], [960, 540, 1500], [768, 432, 800], [640, 360, 400],
];
/** Per-title ladder for simple anime content. All values assumed. */
const ANIME_BASE: [number, number, number][] = [
  [1920, 1080, 4500], [1920, 1080, 3000], [1280, 720, 1800], [960, 540, 1100], [768, 432, 600], [640, 360, 300],
];

/** Book (7.13): "HEVC ladder at ~60 percent of AVC bytes". */
export const HEVC_FACTOR = 0.6;
/** Default AV1 saving vs H.264 per rung (assumed; the slider lets the reader change it). */
export const AV1_DEFAULT_SAVING = 0.5;

const round50 = (v: number) => Math.max(50, Math.round(v / 50) * 50);

export function presetRungs(p: PresetId, av1Saving: number): Rung[] {
  if (p === "anime") return ANIME_BASE.map(([w, h, k]) => R(w, h, k));
  const f = p === "hevc" ? HEVC_FACTOR : p === "av1" ? 1 - av1Saving : 1;
  return H264_BASE.map(([w, h, k]) => R(w, h, p === "h264" ? k : round50(k * f)));
}
export const presetCodec = (p: PresetId): Codec => (p === "hevc" ? "hevc" : p === "av1" ? "av1" : "h264");

export const PRESET_INFO: Record<PresetId, { label: string; note: string; source: "book" | "assumed" }> = {
  h264: { label: "H.264", source: "book", note: "Bitrates from the book (ch.16, sum 23.2 Mbps). Resolutions assumed, after Apple's example ladder." },
  hevc: { label: "HEVC", source: "book", note: "About 40% fewer bits per rung: the book's assumption that HEVC needs ~60% of H.264's bytes. Real savings are 30-50%, content dependent." },
  av1: { label: "AV1", source: "assumed", note: "Savings per rung are assumed. The book cites Netflix: AV1 sessions used about one-third less bandwidth than AVC and HEVC." },
  anime: { label: "Per-title", source: "assumed", note: "Anime is easy to compress: flat colors, clean lines. Ladder assumed. The book quotes Netflix: 5,800 kbps is \"far more than needed\" for simple 1080p." },
};

export const shortRes = (r: { w: number; h: number }) => (r.h >= 2160 ? "4K" : `${r.h}p`);
export const resStr = (r: { w: number; h: number }) => `${r.w}x${r.h}`;

/* ---------------- codec strings ---------------- */

export function codecString(c: Codec, w: number, h: number): string {
  const px = w * h;
  if (c === "h264") {
    if (px <= 414720) return "avc1.4d401e";      // Main, level 3.0
    if (px <= 921600) return h > 540 ? "avc1.64001f" : "avc1.4d401f"; // level 3.1
    if (px <= 2228224) return "avc1.640028";     // High, level 4.0
    return "avc1.640033";                         // High, level 5.1
  }
  if (c === "hevc") {
    const L = px <= 245760 ? 63 : px <= 552960 ? 90 : px <= 983040 ? 93 : px <= 2228224 ? 120 : 150;
    return `hvc1.2.4.L${L}.B0`;
  }
  const idx = px <= 147456 ? "00" : px <= 278784 ? "01" : px <= 665856 ? "04" : px <= 1065024 ? "05" : px <= 2359296 ? "08" : "12";
  return `av01.0.${idx}M.10`;
}
export const AUDIO_CODEC = "mp4a.40.2";
export const AUDIO_KBPS = 128;

/* ---------------- languages ---------------- */

export const AUDIO_LANGS: { code: string; name: string }[] = [
  { code: "ja", name: "Japanese" }, { code: "en", name: "English" }, { code: "es", name: "Spanish" },
  { code: "pt", name: "Portuguese" }, { code: "fr", name: "French" }, { code: "de", name: "German" },
  { code: "it", name: "Italian" }, { code: "hi", name: "Hindi" }, { code: "ar", name: "Arabic" }, { code: "ru", name: "Russian" },
];
export const SUB_LANGS: { code: string; name: string }[] = [
  { code: "en", name: "English" }, { code: "es", name: "Spanish" }, { code: "pt", name: "Portuguese" },
  { code: "fr", name: "French" }, { code: "de", name: "German" }, { code: "it", name: "Italian" },
  { code: "ar", name: "Arabic" }, { code: "ru", name: "Russian" }, { code: "hi", name: "Hindi" },
  { code: "id", name: "Indonesian" }, { code: "th", name: "Thai" }, { code: "vi", name: "Vietnamese" },
  { code: "ms", name: "Malay" }, { code: "ko", name: "Korean" },
];

/* ---------------- multiplier math ---------------- */

export interface MultInputs {
  minutes: number; segSec: number; audio: number; subs: number; packaging: Packaging; enc: Encryption;
}
export const CATALOG_EPISODES = 50000;
/** Assumed WebVTT text size: about 40 bytes per second per language (~58 KB per 24 minutes). */
export const SUB_BYTES_PER_SEC = 40;

export interface MultResult {
  segs: number;
  copies: number;        // copies of every encrypted video/audio segment
  subCopies: number;     // subtitles are not encrypted, so only separate packaging doubles them
  bytes: { video: number; audio: number; subs: number };   // one copy
  objects: { video: number; audio: number; subs: number; manifests: number }; // one copy (manifests: total)
  storage: number;       // per episode, all copies
  objectsTotal: number;  // per episode, all copies
  catalog: number;       // storage for CATALOG_EPISODES
  urlsPerMoment: number; // distinct video URLs for one rung at one moment
  why: "separate" | "encryption" | "one";
}

export function multiply(ladderKbps: number, rungs: number, m: MultInputs): MultResult {
  const L = m.minutes * 60;
  const segs = Math.ceil(L / m.segSec - 1e-9);
  const separate = m.packaging === "separate";
  const copies = separate || m.enc === "both" ? 2 : 1;
  const subCopies = separate ? 2 : 1;
  const bytes = {
    video: (ladderKbps * 1000 * L) / 8,
    audio: (m.audio * AUDIO_KBPS * 1000 * L) / 8,
    subs: m.subs * SUB_BYTES_PER_SEC * L,
  };
  // media segments plus one init segment per fMP4 track; WebVTT segments have no init
  const objects = {
    video: rungs * (segs + 1),
    audio: m.audio * (segs + 1),
    subs: m.subs * segs,
    // HLS master + one media playlist per track, plus the DASH MPD (template, no per-track lists)
    manifests: 1 + rungs + m.audio + m.subs + 1,
  };
  const storage = copies * (bytes.video + bytes.audio) + subCopies * bytes.subs;
  const objectsTotal = copies * (objects.video + objects.audio) + subCopies * objects.subs + objects.manifests;
  return {
    segs, copies, subCopies, bytes, objects, storage, objectsTotal,
    catalog: storage * CATALOG_EPISODES,
    urlsPerMoment: copies,
    why: separate ? "separate" : m.enc === "both" ? "encryption" : "one",
  };
}

/* ---------------- manifest text ---------------- */

export type LineKind =
  | "header" | "version" | "indep" | "media-audio" | "media-sub" | "stream-inf" | "uri" | "target" | "ptype"
  | "map" | "key" | "extinf" | "seg" | "endlist" | "gap" | "comment"
  | "mpd" | "period" | "aset-video" | "aset-audio" | "aset-text" | "template" | "rep" | "protect" | "close";

export interface Line { text: string; kind: LineKind; ref?: string; open?: Target }
export type Target = { type: "video"; rungId: string } | { type: "audio"; lang: string } | { type: "sub"; lang: string };

export interface ManifestCtx {
  rungs: Rung[]; codec: Codec; audio: number; subs: number; segSec: number; minutes: number;
  packaging: Packaging; enc: Encryption;
}

/** Folder for a rung: "1080" or "1080-6000" when two rungs share a resolution. */
export function rungPath(rungs: Rung[], r: Rung): string {
  const same = rungs.filter((x) => x.h === r.h).length > 1;
  return same ? `${r.h}-${r.kbps}` : `${r.h}`;
}
/** HLS-TS is only possible for H.264 (Apple requires fMP4 for HEVC and AV1). */
export const hlsUsesTs = (c: ManifestCtx) => c.packaging === "separate" && c.codec === "h264";
/** Path prefix of the bytes a protocol reads. Two copies show up as two prefixes. */
export function prefix(c: ManifestCtx, proto: "hls" | "dash", clear = false): string {
  if (c.packaging === "separate") return `${proto}/`;
  if (clear || c.enc === "cbcs") return "cmaf/";
  return proto === "hls" ? "cmaf/cbcs/" : "cmaf/cenc/";
}

export function hlsMaster(c: ManifestCtx): Line[] {
  const out: Line[] = [
    { text: "#EXTM3U", kind: "header" },
    { text: "#EXT-X-VERSION:7", kind: "version" },
    { text: "#EXT-X-INDEPENDENT-SEGMENTS", kind: "indep" },
  ];
  const p = prefix(c, "hls");
  AUDIO_LANGS.slice(0, c.audio).forEach((a, i) => out.push({
    kind: "media-audio", ref: `a:${a.code}`, open: { type: "audio", lang: a.code },
    text: `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="${a.name}",LANGUAGE="${a.code}",${i === 0 ? "DEFAULT=YES,AUTOSELECT=YES," : ""}CHANNELS="2",URI="${p}a/${a.code}/index.m3u8"`,
  }));
  SUB_LANGS.slice(0, c.subs).forEach((s, i) => out.push({
    kind: "media-sub", ref: `s:${s.code}`, open: { type: "sub", lang: s.code },
    text: `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="${s.name}",LANGUAGE="${s.code}",${i === 0 ? "DEFAULT=YES,AUTOSELECT=YES," : ""}URI="${prefix(c, "hls", true)}s/${s.code}/index.m3u8"`,
  }));
  for (const r of c.rungs) {
    const peak = Math.round((r.kbps * 1.1 + (c.audio ? AUDIO_KBPS : 0))) * 1000;
    const codecs = [codecString(c.codec, r.w, r.h), c.audio ? AUDIO_CODEC : ""].filter(Boolean).join(",");
    const groups = `${c.audio ? ',AUDIO="aud"' : ""}${c.subs ? ',SUBTITLES="sub"' : ""}`;
    out.push({ kind: "stream-inf", ref: r.id, text: `#EXT-X-STREAM-INF:BANDWIDTH=${peak},RESOLUTION=${resStr(r)},CODECS="${codecs}"${groups}` });
    out.push({ kind: "uri", ref: r.id, open: { type: "video", rungId: r.id }, text: `${p}v/${rungPath(c.rungs, r)}/index.m3u8` });
  }
  return out;
}

export interface MediaOpts { expanded: boolean }
export function hlsMedia(c: ManifestCtx, t: Target, o: MediaOpts): { lines: Line[]; path: string; segs: number } {
  const L = c.minutes * 60;
  const segs = Math.ceil(L / c.segSec - 1e-9);
  const p = prefix(c, "hls", t.type === "sub");
  const ts = t.type === "video" && hlsUsesTs(c);
  const isSub = t.type === "sub";
  const folder = t.type === "video"
    ? `v/${rungPath(c.rungs, c.rungs.find((r) => r.id === t.rungId) ?? c.rungs[0])}`
    : t.type === "audio" ? `a/${t.lang}` : `s/${t.lang}`;
  const ext = isSub ? "vtt" : ts ? "ts" : "m4s";
  const lines: Line[] = [
    { text: "#EXTM3U", kind: "header" },
    { text: "#EXT-X-VERSION:7", kind: "version" },
    { text: `#EXT-X-TARGETDURATION:${c.segSec}`, kind: "target" },
    { text: "#EXT-X-PLAYLIST-TYPE:VOD", kind: "ptype" },
  ];
  if (!isSub && !ts) lines.push({ text: `#EXT-X-MAP:URI="init.mp4"`, kind: "map" });
  if (!isSub) lines.push({ text: `#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://key-ep01",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1"`, kind: "key" });
  const segLine = (i: number) => {
    const dur = i === segs ? L - (segs - 1) * c.segSec : c.segSec;
    lines.push({ text: `#EXTINF:${dur.toFixed(3)},`, kind: "extinf" });
    lines.push({ text: `seg_${String(i).padStart(5, "0")}.${ext}`, kind: "seg" });
  };
  const head = 4, tail = 2;
  if (o.expanded || segs <= head + tail + 1) for (let i = 1; i <= segs; i++) segLine(i);
  else {
    for (let i = 1; i <= head; i++) segLine(i);
    lines.push({ text: `# ... ${segs - head - tail} more segments ...`, kind: "gap" });
    for (let i = segs - tail + 1; i <= segs; i++) segLine(i);
  }
  lines.push({ text: "#EXT-X-ENDLIST", kind: "endlist" });
  return { lines, path: `${p}${folder}/index.m3u8`, segs };
}

export function dashMpd(c: ManifestCtx): Line[] {
  const p = prefix(c, "dash");
  const mins = Math.floor(c.minutes), secs = Math.round((c.minutes - mins) * 60);
  // HLS (FairPlay) always reads cbcs bytes; DASH reads cenc bytes unless encryption has converged
  const dashScheme = c.enc === "cbcs" ? "cbcs" : "cenc";
  const sp = prefix(c, "dash", true);
  const prot = (indent: string): Line => ({
    kind: "protect", text: `${indent}<ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="${dashScheme}"/>`,
  });
  const out: Line[] = [
    { kind: "mpd", text: `<MPD type="static" mediaPresentationDuration="PT${mins}M${secs}S" profiles="urn:mpeg:dash:profile:isoff-live:2011">` },
    { kind: "period", text: " <Period>" },
    { kind: "aset-video", text: '  <AdaptationSet contentType="video" mimeType="video/mp4" segmentAlignment="true">' },
    prot("   "),
    { kind: "template", text: `   <SegmentTemplate initialization="${p}v/$RepresentationID$/init.mp4" media="${p}v/$RepresentationID$/seg_$Number%05d$.m4s" duration="${c.segSec * 1000}" timescale="1000" startNumber="1"/>` },
  ];
  for (const r of c.rungs) {
    out.push({ kind: "rep", ref: r.id, text: `   <Representation id="${rungPath(c.rungs, r)}" bandwidth="${r.kbps * 1000}" width="${r.w}" height="${r.h}" codecs="${codecString(c.codec, r.w, r.h)}"/>` });
  }
  out.push({ kind: "close", text: "  </AdaptationSet>" });
  AUDIO_LANGS.slice(0, c.audio).forEach((a) => {
    out.push({ kind: "aset-audio", ref: `a:${a.code}`, text: `  <AdaptationSet contentType="audio" mimeType="audio/mp4" lang="${a.code}">` });
    out.push(prot("   "));
    out.push({ kind: "rep", ref: `a:${a.code}`, text: `   <Representation id="a-${a.code}" bandwidth="${AUDIO_KBPS * 1000}" codecs="${AUDIO_CODEC}"/>` });
    out.push({ kind: "close", text: "  </AdaptationSet>" });
  });
  SUB_LANGS.slice(0, c.subs).forEach((s) => {
    out.push({ kind: "aset-text", ref: `s:${s.code}`, text: `  <AdaptationSet contentType="text" mimeType="text/vtt" lang="${s.code}">` });
    out.push({ kind: "template", text: `   <SegmentTemplate media="${sp}s/${s.code}/seg_$Number%05d$.vtt" duration="${c.segSec * 1000}" timescale="1000" startNumber="1"/>` });
    out.push({ kind: "rep", ref: `s:${s.code}`, text: `   <Representation id="s-${s.code}" bandwidth="1000"/>` });
    out.push({ kind: "close", text: "  </AdaptationSet>" });
  });
  out.push({ kind: "close", text: " </Period>" });
  out.push({ kind: "close", text: "</MPD>" });
  return out;
}

/** One-sentence explanation per line kind, shown when the reader clicks a line. */
export const LINE_HELP: Partial<Record<LineKind, string>> = {
  header: "The first line of every HLS playlist. It says \"this file is an M3U8 playlist\".",
  version: "The HLS feature level this playlist needs. Version 7 allows fMP4 init segments (EXT-X-MAP).",
  indep: "Every segment starts with an IDR frame, so the player can switch rungs at any segment boundary.",
  "media-audio": "One audio rendition per dub, all in the group \"aud\". Audio is demuxed (its own files), so every dub reuses the same video segments.",
  "media-sub": "One subtitle track per language, in the group \"sub\". A few KB of text, but its own playlist and its own segments.",
  "stream-inf": "One variant (rung). BANDWIDTH is the peak bits per second, video plus audio; the player uses it to choose. CODECS tells the device whether it can decode it.",
  uri: "The URI of this variant's media playlist. Click it to open the list of segments.",
  target: "The longest segment, in whole seconds. Required. Audio and video playlists must share it.",
  ptype: "VOD: this list will never change, so the CDN can cache it for a long time.",
  map: "The init segment (ftyp + moov). Fetched once; then any media segment can be decoded. Required for fMP4.",
  key: "SAMPLE-AES means the segments are encrypted with cbcs. FairPlay devices get the key from this URI.",
  extinf: "The duration of the next segment, in seconds. The player adds these up to build the timeline.",
  seg: "A segment URI. One file, one URL, one cache key. Every rung has one of these per segment period.",
  endlist: "No more segments will be added. This is a complete VOD episode.",
  gap: "Segments hidden to keep the view short. Click to expand them.",
  mpd: "The single DASH manifest. type=\"static\" means VOD. The isoff-live profile means segments are addressed by a template.",
  period: "A time span of the episode. VOD usually has one.",
  "aset-video": "A group of interchangeable tracks. All video rungs sit in one set, so the player can switch between them.",
  "aset-audio": "The set for one dub. Same idea as the HLS audio group.",
  "aset-text": "The set for one subtitle language.",
  template: "A URL pattern instead of a list. $Number$ becomes 00001, 00002 and so on, so DASH needs no per-rung playlist.",
  rep: "One rendition: the DASH word for a rung. bandwidth is in bits per second.",
  protect: "The encryption scheme of these bytes. cenc (AES-CTR) and cbcs (AES-CBC pattern) produce different bytes from the same video.",
  close: "Closing tag.",
};
