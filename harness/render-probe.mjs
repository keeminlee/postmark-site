// render-probe.mjs — drive the built world page in headless Chromium and
// measure what a resident's browser actually pays for.
//
// What each number is (so no one has to guess later):
//   fetches_before_paint / bytes_before_paint — every response that arrived
//     before first-contentful-paint, counted from the wire (content-length, or
//     the body length when the header is absent), plus the largest single one.
//   fcp_ms          — performance first-contentful-paint.
//   dcl_ms/load_ms  — domContentLoadedEventEnd / loadEventEnd.
//   settled_ms      — the page's own time-to-interactive proxy: the moment the
//     DOM node count stops changing for 1000 ms. The world page draws its marks
//     from script after boot, so loadEventEnd is NOT when the town appears;
//     this is. Measured AFTER the welcome tour is dismissed, because the tour
//     is a modal over a dimmed map and nothing behind it is interactive.
//   dom_nodes / svg_nodes / map_svg_nodes — counts after settle. map_svg_nodes
//     is the town itself (#map-svg), which is the number that grows with marks.
//   heap_bytes      — performance.memory.usedJSHeapSize after settle.
//   frame p50/p95   — requestAnimationFrame deltas recorded while the SAME
//     scripted gesture runs on every (branch, size): a 600 px drag across the
//     map in 30 steps, then three wheel-zoom steps at the map's centre. The
//     gesture is driven through Playwright's real mouse (trusted events), and
//     gesture_effective records whether #map-svg's viewBox actually moved — a
//     frame-time number taken while the map ignored the gesture is a number
//     about an idle page, so the probe reports whether it can be believed.
//
// Usage: node harness/render-probe.mjs --url <url> --label <name> --shot <png> --out <json>
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const URL_ = arg("--url");
const LABEL = arg("--label", "unlabeled");
const SHOT = arg("--shot", null);
// The picture the town is judged by is the one taken when the map has SETTLED and
// before the gesture moves the camera: a post-gesture frame is a picture of
// wherever the pan ended, which at a larger world is open country.
const SHOT_SETTLED = arg("--shot-settled", null);
const OUT = arg("--out", null);
const SETTLE_MS = Number(arg("--settle", "120000"));
if (!URL_) { console.error("need --url"); process.exit(2); }

const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const responses = [];
page.on("response", async (r) => {
  const at = Date.now();
  let bytes = Number(r.headers()["content-length"] ?? NaN);
  if (!Number.isFinite(bytes)) { try { bytes = (await r.body()).length; } catch { bytes = 0; } }
  responses.push({ url: r.url(), status: r.status(), bytes, at });
});

const t0 = Date.now();
await page.goto(URL_, { waitUntil: "load", timeout: 180000 });

const timing = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0] ?? {};
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  return {
    fcp_ms: fcp ? Math.round(fcp.startTime) : null,
    dcl_ms: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
    load_ms: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
  };
});
// Before-paint accounting comes from the page's own Resource Timing, not from
// the CDP response stream: this probe reads response bodies to count bytes when
// a server omits content-length, and that await moves the wall-clock stamp on
// the Node side. responseEnd vs the paint entry is measured inside the page and
// cannot drift for that reason.
const paint = await page.evaluate(() => {
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  const at = fcp ? fcp.startTime : Infinity;
  const rs = performance.getEntriesByType("resource");
  const before = rs.filter((r) => r.responseEnd <= at);
  const size = (r) => r.encodedBodySize || r.transferSize || 0;
  return {
    fetches_before_paint: before.length,
    bytes_before_paint: before.reduce((s, r) => s + size(r), 0),
    fetches_by_load: rs.length,
    bytes_by_load: rs.reduce((s, r) => s + size(r), 0),
  };
});

// ── dismiss the welcome tour ────────────────────────────────────────────────
// It is a modal over a dimmed map; every number after this point is about the
// map, so it has to go, and the probe records whether it actually went.
await page.keyboard.press("Escape").catch(() => {});
for (const label of ["skip", "Skip", "close", "×"]) {
  const el = page.locator(`text="${label}"`).first();
  if (await el.count().then((n) => n > 0).catch(() => false)) {
    await el.click({ timeout: 2000 }).catch(() => {});
    break;
  }
}
await page.waitForTimeout(600);
const tour_dismissed = await page.evaluate(() => {
  const t = document.getElementById("wv-tour-title");
  if (!t) return true;
  const box = t.getBoundingClientRect();
  return box.width === 0 || box.height === 0 || getComputedStyle(t).visibility === "hidden";
});

// ── settle ─────────────────────────────────────────────────────────────────
const settled = await page.evaluate(async (ceiling) => {
  const start = performance.now();
  let last = -1, stableSince = performance.now();
  for (;;) {
    const n = document.getElementsByTagName("*").length;
    if (n !== last) { last = n; stableSince = performance.now(); }
    else if (performance.now() - stableSince > 1000) return { settled_ms: Math.round(performance.now()), settle_timed_out: false };
    if (performance.now() - start > ceiling) return { settled_ms: Math.round(performance.now()), settle_timed_out: true };
    await new Promise((r) => setTimeout(r, 100));
  }
}, SETTLE_MS);

// THE MAP ELEMENT IS NOT THE SAME ELEMENT ON BOTH BRANCHES. main's viewer gives
// the town SVG `id="map-svg"`; the Atlas viewer on wright/atlas-dev-fold-site
// gives it no id at all. So the probe finds it by what it IS — the widest SVG
// carrying a viewBox — marks it with a stable id, and reports which element it
// picked, so a frame time is never quietly taken against the wrong node.
await page.evaluate(() => {
  let map = document.getElementById("map-svg");
  if (!map) {
    const cands = [...document.querySelectorAll("svg[viewBox]")]
      .map((s) => ({ s, w: s.getBoundingClientRect().width, n: s.querySelectorAll("*").length }))
      .filter((c) => c.w > 300)
      .sort((a, b) => b.n - a.n);
    map = cands[0]?.s ?? null;
  }
  if (map) map.setAttribute("data-probe-map", "1");
});

const shape = await page.evaluate(() => {
  const map = document.querySelector("[data-probe-map]");
  return {
    map_element: map ? (map.id || map.tagName.toLowerCase() + "(no id)") : null,
    dom_nodes: document.getElementsByTagName("*").length,
    svg_nodes: document.querySelectorAll("svg *").length,
    map_svg_nodes: map ? map.querySelectorAll("*").length : null,
    map_viewbox: map ? map.getAttribute("viewBox") : null,
    svg_count: document.querySelectorAll("svg").length,
    path_nodes: document.querySelectorAll("path").length,
    image_nodes: document.querySelectorAll("image").length,
    img_count: document.querySelectorAll("img").length,
    heap_bytes: performance.memory ? performance.memory.usedJSHeapSize : null,
    heap_limit: performance.memory ? performance.memory.jsHeapSizeLimit : null,
    title: document.title,
  };
});

if (SHOT_SETTLED) await page.screenshot({ path: SHOT_SETTLED, fullPage: false });

// ── the scripted gesture — identical on every run, driven by a real mouse ───
await page.evaluate(() => {
  window.__frames = [];
  window.__prev = performance.now();
  window.__running = true;
  const tick = (t) => { window.__frames.push(t - window.__prev); window.__prev = t; if (window.__running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

const box = await page.locator("[data-probe-map]").boundingBox().catch(() => null);
const cx = box ? box.x + box.width / 2 : 720;
const cy = box ? box.y + box.height / 2 : 450;

await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 30; i++) { await page.mouse.move(cx + i * 20, cy + i * 4); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(400);
// back to the map's centre before wheeling — the drag left the pointer 600 px
// away, and a wheel event outside #map-svg is a wheel event the viewer never sees
await page.mouse.move(cx, cy);
for (let z = 0; z < 3; z++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(600); }
await page.waitForTimeout(500);

const frames = await page.evaluate(() => {
  window.__running = false;
  const s = window.__frames.slice(1).sort((a, b) => a - b);
  const q = (p) => (s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null);
  return { frames: s.length, p50_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99), max_ms: s.length ? +s[s.length - 1].toFixed(2) : null };
});

const after = await page.evaluate(() => {
  const map = document.querySelector("[data-probe-map]");
  return {
    map_viewbox_after: map ? map.getAttribute("viewBox") : null,
    dom_nodes_after_gesture: document.getElementsByTagName("*").length,
    map_svg_nodes_after_gesture: map ? map.querySelectorAll("*").length : null,
    heap_bytes_after_gesture: performance.memory ? performance.memory.usedJSHeapSize : null,
  };
});
const gesture_effective = shape.map_viewbox !== after.map_viewbox_after;

if (SHOT) await page.screenshot({ path: SHOT, fullPage: false });

const out = {
  label: LABEL, url: URL_, stamped: new Date().toISOString(),
  ...timing, tour_dismissed, ...settled, ...shape, ...after,
  gesture_effective, frames,
  fetches_total: responses.length,
  bytes_total: responses.reduce((s, r) => s + r.bytes, 0),
  ...paint,
  largest_fetch: [...responses].sort((a, b) => b.bytes - a.bytes).slice(0, 6)
    .map((r) => ({ bytes: r.bytes, url: r.url.replace(/^https?:\/\/[^/]+/, "") })),
  failed_count: responses.filter((r) => r.status >= 400).length,
  failed: responses.filter((r) => r.status >= 400).map((r) => ({ status: r.status, url: r.url.replace(/^https?:\/\/[^/]+/, "") })).slice(0, 12),
  shot: SHOT, shot_settled: SHOT_SETTLED,
};
console.log(JSON.stringify(out, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
await browser.close();
