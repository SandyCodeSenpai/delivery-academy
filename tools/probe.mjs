// Drive a route with puppeteer-core (system Chrome): click things, wait, screenshot, collect console errors.
// usage: node tools/probe.mjs '<hash>' /abs/out.png '[{"click":"button:nth-of-type(2)"},{"wait":800},{"shot":"/abs/step2.png"}]' [width] [height]
// actions: {"click": css} {"clickText": "Continue"} {"wait": ms} {"shot": path} {"eval": "js expression"} {"type": [css, text]}
import puppeteer from "puppeteer-core";
const [, , hash, out, actionsJson = "[]", w = "1280", h = "900"] = process.argv;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:5180/#${hash}`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
for (const a of JSON.parse(actionsJson)) {
  if (a.click) await page.click(a.click);
  if (a.clickText) { const ok = await page.evaluate((t) => { const el = [...document.querySelectorAll("button,a,[role=button],[role=radio]")].find((e) => e.textContent.trim().includes(t)); if (el) { el.click(); return true; } return false; }, a.clickText); if (!ok) errors.push(`clickText not found: ${a.clickText}`); }
  if (a.type) await page.type(a.type[0], a.type[1]);
  if (a.wait) await new Promise((r) => setTimeout(r, a.wait));
  if (a.eval) console.log("eval:", JSON.stringify(await page.evaluate(a.eval)));
  if (a.shot) await page.screenshot({ path: a.shot, fullPage: true });
}
if (out && out !== "-") await page.screenshot({ path: out, fullPage: true });
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
