export const fmtNum = (v: number, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtPct = (v: number, d = 0) => `${fmtNum(v * 100, d)}%`;
export function fmtBps(bps: number, d = 1): string {
  const u = ["bps", "Kbps", "Mbps", "Gbps", "Tbps", "Pbps"]; let i = 0; let v = bps;
  while (Math.abs(v) >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `${fmtNum(v, v < 10 && i > 0 ? d : 0)} ${u[i]}`;
}
export function fmtBytes(b: number, d = 1): string {
  const u = ["B", "KB", "MB", "GB", "TB", "PB", "EB"]; let i = 0; let v = b;
  while (Math.abs(v) >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `${fmtNum(v, v < 10 && i > 0 ? d : 0)} ${u[i]}`;
}
export function fmtMoney(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${fmtNum(v / 1e6, 1)}M`;
  if (Math.abs(v) >= 1e3) return `$${fmtNum(v / 1e3, 0)}k`;
  return `$${fmtNum(v, 0)}`;
}
export const fmtMs = (ms: number) => (ms >= 1000 ? `${fmtNum(ms / 1000, 1)} s` : `${fmtNum(ms, 0)} ms`);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
