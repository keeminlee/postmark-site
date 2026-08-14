// The round trip between the conversations page and the map, probed both ways.
//
// Claim 1: every thread's place words are a link into the map, well-formed.
// Claim 2: every thread carries its own permalink, so one conversation can be
//          shared on its own (this page has always ANSWERED to #<thread-id> —
//          it just never handed the link out).
// Claim 3: /world/?at=x,y lands the reader AT that place — checked against the
//          atlas grid, not merely "the camera moved", because a camera that
//          zooms to the town centre also moves.
import { createRequire } from "node:module";
const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4321";
const fails = [];
const check = (ok, label, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) fails.push(label);
};

const browser = await chromium.launch();

// ── the conversations page ───────────────────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/conversations/`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForSelector(".c-thread", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

const seen = await page.evaluate(() => {
  const links = [...document.querySelectorAll(".c-place-link")];
  const permas = [...document.querySelectorAll(".c-perma")];
  const malformed = links.filter((a) => !/^\/world\/\?at=-?[\d.]+,-?[\d.]+$/.test(a.getAttribute("href")));
  return {
    threads: document.querySelectorAll(".c-thread").length,
    placeLinks: links.length,
    permalinks: permas.length,
    malformed: malformed.length,
    sampleHref: links[0]?.getAttribute("href") ?? null,
    sampleText: links[0]?.textContent ?? null,
    samplePerma: permas[0]?.getAttribute("href") ?? null,
    pageHeightPx: document.body.scrollHeight,
  };
});
console.log(JSON.stringify(seen, null, 1));
check(seen.threads > 0, "the page has threads to check", `${seen.threads}`);
check(seen.placeLinks === seen.threads && seen.malformed === 0,
  "every thread's place words link into the map", `${seen.placeLinks}/${seen.threads}, ${seen.malformed} malformed`);
check(seen.permalinks === seen.threads, "every thread carries its own permalink", `${seen.permalinks}/${seen.threads}`);

const card = await page.$(".c-thread");
if (card) await card.screenshot({ path: "qa-shots/convo-04-thread-closeup.png" });

// ── follow the link the page actually renders ────────────────────────────────
const href = seen.sampleHref;
const at = /at=(-?[\d.]+),(-?[\d.]+)/.exec(href ?? "");
if (!at) {
  check(false, "a place link could be followed", "no usable href");
} else {
  const wx = Number(at[1]), wy = Number(at[2]);
  const world = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await world.goto(BASE + href, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await world.locator(".wv-tour-skip").first().click({ timeout: 5000 }).catch(() => {});
  await world.waitForFunction(() => !!document.querySelector(".wv-map-follow.on"), null, { timeout: 40000 }).catch(() => {});
  await world.waitForTimeout(2500);
  const got = await world.evaluate(() => ({
    stand: document.querySelector(".wv-spectator-coordinate")?.textContent?.trim(),
    vb: document.querySelector("#wv-map svg, .wv-map svg")?.getAttribute("viewBox"),
    follow: !!document.querySelector(".wv-map-follow.on"),
  }));
  // WORLD/skeleton.json: Ferry's crossing is atlas (485,760); 5 m per atlas px; y south.
  const want = [485 + wx / 5, 760 + wy / 5];
  const v = String(got.vb ?? "").split(/[\s,]+/).map(Number);
  const centre = [v[0] + v[2] / 2, v[1] + v[3] / 2];
  console.log(`followed ${href} → stand="${got.stand}" centre=${centre.map((n) => n.toFixed(0))} want=${want.map((n) => n.toFixed(0))}`);
  check(got.follow, "the map engages follow on arrival");
  check(Math.abs(centre[0] - want[0]) < 120 && Math.abs(centre[1] - want[1]) < 120,
    "the map is centred ON THE LINKED PLACE");
  check(Math.hypot(centre[0] - 485, centre[1] - 760) > 100,
    "discriminator: not merely parked on the town centre (485,760)");
  await world.close();
}

await browser.close();
console.log("\n" + (fails.length ? `${fails.length} FAILED: ${fails.join("; ")}` : "all checks passed"));
process.exit(fails.length ? 1 : 0);
