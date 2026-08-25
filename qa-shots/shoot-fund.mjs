const { chromium } = await import("file:///G:/Wright-HQ/node_modules/playwright/index.mjs");
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = "G:/postmark/wt-fund/dist-town";
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2" };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(ROOT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(4321, r));

const b = await chromium.launch();
const OUT = "G:/postmark/wt-fund/qa-shots";

for (const [name, w, h] of [["desktop", 1280, 1400], ["narrow", 700, 1400]]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  for (const pot of ["keeping-ec2", "darko-fund"]) {
    await page.goto(`http://127.0.0.1:4321/fund/${pot}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/${pot}-${name}-full.png`, fullPage: true });
    const sec = page.locator("section.f-pay");
    if (await sec.count()) await sec.screenshot({ path: `${OUT}/${pot}-${name}-paysection.png` });
  }
  await page.close();
}

// the verify form's live states, on the rail they now belong to
const page = await b.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:4321/fund/keeping-ec2/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  const out = document.getElementById("pm-fund-out");
  out.hidden = false; out.className = "f-out refused";
  out.innerHTML = '<p class="f-out-title">this transaction is already recorded (2026-08-01, $40 to pot keeping-ec2)</p><p class="f-out-body">one dollar, one mint chance — a payment is witnessed exactly once, when it crosses the seam.</p>';
});
await page.locator("section.f-pay").screenshot({ path: `${OUT}/keeping-ec2-refusal-state.png` });
await page.close();

await b.close(); server.close();
console.log("shots written");
