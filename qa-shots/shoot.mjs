// Rendered QA for /replay/ and /conversations/. Playwright is resolved out of
// G:/Wright-HQ (this repo does not carry it).
//
// Two things this pass knows from prior scars:
//  • the told-world viewer greets EVERY spectator with its tour (there is no
//    "seen" key for a nobody), so the scrim must be dismissed or every click
//    after it is intercepted;
//  • a `waitForSelector` on a viewer layer must ask for "attached", not the
//    default "visible" — an empty <g> has no box, so a correctly-mounted layer
//    reads as absent.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4321";
const OUT = join(process.cwd(), "qa-shots");
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };

const problems = [];

async function dismissTour(page) {
  try {
    const skip = page.locator(".wv-tour-skip");
    if (await skip.count()) { await skip.first().click({ timeout: 3000 }); await page.waitForTimeout(250); }
  } catch { /* no tour on this surface */ }
}

async function shoot(browser, { name, url, viewport, prepare, full }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await dismissTour(page);
  if (prepare) await prepare(page);
  await page.waitForTimeout(1200);
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full ?? viewport === NARROW });
  if (errors.length) problems.push(`${name}: ${errors.slice(0, 4).join(" | ")}`);
  console.log(`${name.padEnd(30)} ${errors.length ? `${errors.length} console error(s)` : "clean"}  → ${file}`);
  return page;
}

const browser = await chromium.launch();

// ── the replay ────────────────────────────────────────────────────────────────
const p1 = await shoot(browser, {
  name: "replay-01-desktop-latest", url: "/replay/", viewport: DESKTOP,
  prepare: async (page) => { await page.waitForSelector("#wv-fp-layer, .wv", { state: "attached", timeout: 30000 }).catch(() => {}); },
});
// what the page claims about itself, read back off the DOM rather than assumed
const claims = await p1.evaluate(() => ({
  when: document.querySelector("[data-when]")?.textContent,
  span: document.querySelector("[data-span]")?.textContent,
  coverage: document.querySelector("[data-coverage]")?.textContent,
  provenance: document.querySelector("[data-provenance]")?.textContent,
  ticks: document.querySelectorAll(".r-tick").length,
  voices: document.querySelectorAll(".r-voice").length,
  moves: document.querySelectorAll(".r-move").length,
  walkerDots: document.querySelectorAll(".wv-walker-hit, circle.wv-walker").length,
}));
console.log("  claims:", JSON.stringify(claims));
await p1.close();

// a busy crossing: 119 is the one with 59 events, so the digest has something to show
await shoot(browser, {
  name: "replay-02-desktop-crossing-119-full", url: "/replay/#119", viewport: DESKTOP, full: true,
  prepare: async (page) => { await page.waitForSelector(".r-voice, .r-move", { state: "attached", timeout: 30000 }).catch(() => {}); },
});

// the talkative one
await shoot(browser, {
  name: "replay-03-desktop-crossing-120-full", url: "/replay/#120", viewport: DESKTOP, full: true,
  prepare: async (page) => { await page.waitForSelector(".r-voice", { state: "attached", timeout: 30000 }).catch(() => {}); },
});

// the silent half-day — the empty state has to read warmly, not as an error
await shoot(browser, {
  name: "replay-04-desktop-crossing-124-quiet-full", url: "/replay/#124", viewport: DESKTOP, full: true,
});

await shoot(browser, { name: "replay-05-narrow", url: "/replay/#120", viewport: NARROW });

// ── the conversations page (revamp in place, same URL) ───────────────────────
await shoot(browser, { name: "convo-01-desktop", url: "/conversations/", viewport: DESKTOP });
await shoot(browser, { name: "convo-02-narrow", url: "/conversations/", viewport: NARROW });
// the whole page, so the linked place words and per-thread permalinks are visible
await shoot(browser, { name: "convo-03-desktop-threads-full", url: "/conversations/", viewport: DESKTOP, full: true });

// ── arriving at a place: the other half of the round trip ────────────────────
// /world/?at=x,y is what a linked place name now opens. The map should be
// standing at the Front Door of the Protected Grove, not at the town centre.
await shoot(browser, {
  name: "world-04-arrive-at-a-place", url: "/world/?at=-1375,-2545", viewport: DESKTOP,
  prepare: async (page) => {
    await page.waitForFunction(() => !!document.querySelector(".wv-map-follow.on"), null, { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(2500);
  },
});

await browser.close();

console.log("\n" + (problems.length ? "CONSOLE PROBLEMS:\n" + problems.join("\n") : "no console errors on any surface"));
