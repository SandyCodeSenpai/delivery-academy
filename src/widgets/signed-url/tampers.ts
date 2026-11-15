import { OTHER_EP_PATH, flipChar, type Country, type UrlParts, type Verdict } from "./engine";

export interface Scenario { parts: UrlParts; issued: UrlParts; nowRel: number; viewer: Country }

export type TamperId = "path" | "expiry" | "country" | "sig" | "reuse" | "share";
export type Answer = "ok" | "exp" | "sig" | "geo";

export const ANSWERS: { id: Answer; label: string }[] = [
  { id: "ok", label: "200: the segment is served" },
  { id: "exp", label: "410: the token has expired" },
  { id: "sig", label: "403 at the signature check" },
  { id: "geo", label: "403 at the geo check" },
];

export const answerOf = (v: Verdict): Answer =>
  v.code === 200 ? "ok" : v.code === 410 ? "exp" : v.failAt === 3 ? "geo" : "sig";

export interface Tamper {
  id: TamperId;
  label: string;
  sub: string;
  question: string;
  explain: string;
  apply: (s: Scenario) => Scenario;
}

export const TAMPERS: Tamper[] = [
  {
    id: "path", label: "Swap the episode", sub: "ep1234 to ep1235",
    question: "You change ep1234 to ep1235 in the path, hoping the same token opens the next episode. What does the edge do?",
    explain: "The path is part of the signed string. The edge recomputes the HMAC over the new path and gets a completely different value. A token opens only the paths it was signed for.",
    apply: (s) => ({ ...s, parts: { ...s.parts, path: OTHER_EP_PATH } }),
  },
  {
    id: "expiry", label: "Extend the expiry", sub: "exp plus one day",
    question: "You add one day to exp so the link lasts longer. What does the edge do?",
    explain: "The expiry check passes, because the new exp is later. But exp is signed, so the HMAC no longer matches. Without the secret you cannot make a valid signature for the new value.",
    apply: (s) => ({ ...s, parts: { ...s.parts, exp: String(Number(s.parts.exp) + 86400) } }),
  },
  {
    id: "country", label: "Change the country", sub: "geo=JP to geo=US",
    question: "A viewer in the US edits geo=JP to geo=US so the token matches their location. What does the edge do?",
    explain: "geo is signed too, so the edge rejects at the signature check before it looks at the country. The edge can trust a signed claim only because nobody can change it.",
    apply: (s) => ({ ...s, viewer: "US", parts: { ...s.parts, geo: "US" } }),
  },
  {
    id: "sig", label: "Flip one sig character", sub: "one hex digit changes",
    question: "One character of sig changes: a typo, or a guess. What does the edge do?",
    explain: "One different character is a mismatch. Real edges compare in constant time, so the response time does not tell an attacker how many leading characters were right.",
    apply: (s) => ({ ...s, parts: { ...s.parts, sig: flipChar(s.parts.sig) } }),
  },
  {
    id: "reuse", label: "Reuse after expiry", sub: "clock to +15:00",
    question: "The viewer pauses, then reuses the same URL at +15:00. The token expired at +10:00. What does the edge do?",
    explain: "410 Gone at step 2. The edge runs the cheapest check first and never computes the HMAC. Expiry is checked on every request, so a long session needs a token refresh.",
    apply: (s) => ({ ...s, nowRel: 900 }),
  },
  {
    id: "share", label: "Share with a friend abroad", sub: "friend in the US",
    question: "You paste your valid URL to a friend in the US. They open it a minute later. What does the edge do?",
    explain: "The signature is valid: a signed URL is a bearer credential. Only the territory claim stops it. A friend in Japan would get 200. Inside one territory, only short expiry and log detection (one token used from many networks) stop sharing.",
    apply: (s) => ({ ...s, viewer: "US", nowRel: 180 }),
  },
];

export const TAMPER_BY_ID = Object.fromEntries(TAMPERS.map((t) => [t.id, t])) as Record<TamperId, Tamper>;
