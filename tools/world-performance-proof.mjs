import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Run after `npm run build`; Playwright may be supplied as an untracked,
// no-save local dependency when the site does not otherwise install it.
const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORLD_ROOT = resolve(process.env.POSTMARK_WORLD_ROOT ?? join(SITE_ROOT, "..", "world-ui-lift"));
const DIST = join(SITE_ROOT, "dist-town");
const BASELINE_SITE = "2d153f0";
const BASELINE_WORLD = "42e1675";
const REQUEST_DELAY_MS = 35;
const CHROME = process.env.CHROME_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const baselineViewer = execFileSync(
  "git",
  ["show", `${BASELINE_WORLD}:spectator/viewer.mjs`],
  { cwd: WORLD_ROOT, encoding: "utf8" },
);

const pause = (ms) => new Promise((accept) => setTimeout(accept, ms));

function isCriticalPath(pathname) {
  return pathname.startsWith("/world-engine/")
    || pathname === "/api/world/state"
    || pathname === "/api/world/skeleton"
    || pathname === "/WORLD/world-state.json"
    || pathname === "/WORLD/skeleton.json"
    || pathname === "/seeding/manifest.json"
    || pathname === "/atlas/town.html";
}

function withoutPreloads(html) {
  return html
    .replace(/<link rel="modulepreload"[^>]*>\s*/g, "")
    .replace(/<link rel="preload" as="fetch"[^>]*>\s*/g, "");
}

function staticFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const rel = decoded.endsWith("/") ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const file = resolve(DIST, rel);
  const inside = relative(DIST, file);
  if (!inside || inside.startsWith("..") || inside.split(sep).includes("..")) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

function startFixture(mode) {
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://127.0.0.1");
    if (isCriticalPath(pathname)) await pause(REQUEST_DELAY_MS);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("cache-control", "no-store");

    if (pathname.startsWith("/api/")) {
      res.writeHead(404, { "content-type": MIME[".json"] });
      return res.end('{"error":"fixture has no office"}');
    }
    if (mode === "before" && [
      "/WORLD/world-state.json",
      "/WORLD/skeleton.json",
      "/seeding/manifest.json",
    ].includes(pathname)) {
      res.writeHead(404, { "content-type": MIME[".json"] });
      return res.end('{"error":"not staged before S1"}');
    }
    if (mode === "before" && pathname === "/world-engine/spectator/viewer.mjs") {
      res.writeHead(200, { "content-type": MIME[".mjs"] });
      return res.end(baselineViewer);
    }
    const file = staticFile(pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("not found");
    }
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream" });
    return res.end(mode === "before" && pathname === "/world/"
      ? withoutPreloads(body.toString("utf8"))
      : body);
  });
  return new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      accept({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

function overlapWaveDepth(resources) {
  const sorted = [...resources].sort((a, b) => a.startTime - b.startTime);
  let depth = 0;
  let waveEnd = -Infinity;
  for (const resource of sorted) {
    if (resource.startTime > waveEnd + 2) {
      depth++;
      waveEnd = resource.responseEnd;
    } else {
      waveEnd = Math.max(waveEnd, resource.responseEnd);
    }
  }
  return depth;
}

function localRecordFor(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith("/WORLD/world-state.json")) return join(WORLD_ROOT, "WORLD", "world-state.json");
  if (pathname.endsWith("/WORLD/skeleton.json")) return join(WORLD_ROOT, "WORLD", "skeleton.json");
  if (pathname.endsWith("/seeding/manifest.json")) return join(WORLD_ROOT, "seeding", "manifest.json");
  return null;
}

async function measure(browser, fixture, label) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("https://raw.githubusercontent.com/**", async (route) => {
    const file = localRecordFor(route.request().url());
    if (!file) return route.abort();
    await pause(REQUEST_DELAY_MS);
    return route.fulfill({
      status: 200,
      contentType: MIME[".json"],
      headers: { "access-control-allow-origin": "*" },
      body: readFileSync(file),
    });
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto(`${fixture.origin}/world/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wv-minimap svg", { timeout: 20_000 });
  await page.waitForTimeout(100);

  const resources = await page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => ({
      name: entry.name,
      startTime: Number(entry.startTime.toFixed(2)),
      responseEnd: Number(entry.responseEnd.toFixed(2)),
      initiatorType: entry.initiatorType,
    }))
    .filter((entry) => {
      const url = new URL(entry.name);
      return url.pathname.startsWith("/world-engine/")
        || url.pathname === "/api/world/state"
        || url.pathname === "/api/world/skeleton"
        || url.pathname === "/WORLD/world-state.json"
        || url.pathname === "/WORLD/skeleton.json"
        || url.pathname === "/seeding/manifest.json"
        || url.pathname === "/atlas/town.html"
        || url.hostname === "raw.githubusercontent.com";
    }));
  const atlas = await page.locator(".wv-minimap img, .wv-minimap image").evaluateAll((images) => ({
    total: images.length,
    lazy: images.filter((image) => image.getAttribute("loading") === "lazy").length,
    async: images.filter((image) => image.getAttribute("decoding") === "async").length,
  }));
  const recordStatus = await page.evaluate(async () => (await fetch("/WORLD/world-state.json")).status);
  await context.close();
  return {
    label,
    criticalResources: resources.length,
    waterfallDepth: overlapWaveDepth(resources),
    recordStatus,
    atlas,
    runtimeErrors: [...new Set(runtimeErrors)],
  };
}

function stagedModulePaths(dir, publicPrefix = "/world-engine") {
  const paths = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    const publicPath = `${publicPrefix}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...stagedModulePaths(file, publicPath));
    else if (entry.isFile() && extname(entry.name) === ".mjs") paths.push(publicPath);
  }
  return paths;
}

if (!existsSync(join(DIST, "world", "index.html"))) {
  throw new Error("dist-town is missing; run npm run build first");
}
if (!existsSync(CHROME)) throw new Error(`Chrome executable not found: ${CHROME}`);

const builtHtml = readFileSync(join(DIST, "world", "index.html"), "utf8");
const modulePreloads = [...builtHtml.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((match) => match[1]);
const fetchPreloads = [...builtHtml.matchAll(/<link rel="preload" as="fetch" href="([^"]+)" crossorigin>/g)].map((match) => match[1]);
const stagedModules = stagedModulePaths(join(DIST, "world-engine"));
const requiredFetches = [
  "/WORLD/world-state.json",
  "/WORLD/skeleton.json",
  "/seeding/manifest.json",
  "/atlas/town.html",
];

const beforeFixture = await startFixture("before");
const afterFixture = await startFixture("after");
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let before;
let after;
try {
  before = await measure(browser, beforeFixture, "before");
  after = await measure(browser, afterFixture, "after");
} finally {
  await browser.close();
  await Promise.all([
    new Promise((accept) => beforeFixture.server.close(accept)),
    new Promise((accept) => afterFixture.server.close(accept)),
  ]);
}

if (!modulePreloads.includes("/world-engine/spectator/viewer.mjs")) throw new Error("viewer modulepreload missing");
if (stagedModules.length !== modulePreloads.length || !stagedModules.every((path) => modulePreloads.includes(path))) {
  throw new Error("modulepreload/staged module drift");
}
if (!requiredFetches.every((path) => fetchPreloads.includes(path))) throw new Error("one or more fetch preloads missing");
if (before.recordStatus !== 404 || after.recordStatus !== 200) throw new Error("world record before/after status gate failed");
if (!(after.waterfallDepth < before.waterfallDepth)) throw new Error("waterfall depth did not decrease");
if (!after.atlas.total || after.atlas.lazy !== after.atlas.total || after.atlas.async !== after.atlas.total) {
  throw new Error("atlas image discipline gate failed");
}
if (after.runtimeErrors.length) throw new Error(`after-page runtime errors: ${after.runtimeErrors.join(" | ")}`);

console.log(`PULSE_PERF_RESULT=${JSON.stringify({
  baseline: { site: BASELINE_SITE, world: BASELINE_WORLD },
  requestDelayMs: REQUEST_DELAY_MS,
  head: { modulePreloads: modulePreloads.length, fetchPreloads: fetchPreloads.length },
  before,
  after,
})}`);
