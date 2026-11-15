// Open every route in headless Chrome and report console errors. usage: node tools/smoke.mjs [width] [height]
import puppeteer from "puppeteer-core";
const w = Number(process.argv[2] || 1280), h = Number(process.argv[3] || 900);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: w, height: h });
let errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto("http://127.0.0.1:5180/#home", { waitUntil: "networkidle0" });
const meta = await page.evaluate(async () => { const m = await import("/src/content/index.ts"); const r = await import("/src/widgets/ids.ts").catch(() => null); return { ch: m.CHAPTERS.map((c) => ({ n: c.n, l: c.lessons.length })) }; });
const widgets = ["playground","press-play","tcp-throughput","dns-resolve","cache-headers","consistent-hash","request-collapse","eviction","shield-offload","abr-ladder","signed-url","multi-cdn","abr-player","slo-burn","failover","premiere","cost"];
const routes = ["home", "course", "labs", "glossary", ...meta.ch.map((c) => `ch${c.n}`), ...meta.ch.flatMap((c) => Array.from({ length: c.l }, (_, i) => `ch${c.n}-${i + 1}`)), ...widgets.map((x) => `lab-${x}`)];
let bad = 0;
for (const r of routes) {
  errors = [];
  let info;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const t = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
      await t(page.goto(`http://127.0.0.1:5180/#${r}`, { waitUntil: "domcontentloaded", timeout: 15000 }), 16000);
      await new Promise((res) => setTimeout(res, 900));
      info = await t(page.evaluate(() => ({ text: document.body.innerText.slice(0, 4000), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })), 8000);
      break;
    } catch (e) { errors = []; await new Promise((res) => setTimeout(res, 1500)); }
  }
  if (!info) { bad++; console.log(`${r}: could not load`); continue; }
  const notReady = /not ready yet|Something went wrong|failed to load/i.test(info.text);
  const overflow = info.sw > info.cw + 1;
  const errs = errors.filter((e) => !/favicon|DevTools/.test(e));
  if (errs.length || notReady || overflow) { bad++; console.log(`${r}: ${notReady ? "NOT-READY " : ""}${overflow ? `OVERFLOW ${info.sw}>${info.cw} ` : ""}${errs.slice(0, 2).join(" | ").slice(0, 300)}`); }
}
console.log(`checked ${routes.length} routes at ${w}x${h}, problems: ${bad}`);
await browser.close();
