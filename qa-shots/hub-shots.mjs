// hub-shots.mjs — rendered QA for the civic hub (/town/), 2026-08-30.
//
//   npx astro preview --config astro.config.town.mjs --port 4399 &
//   node qa-shots/hub-shots.mjs
//
// WHY SHOTS AND NOT ONLY UNIT TESTS. Everything this round added is about what
// a reader SEES: five hand-drawn buildings that have to read as five different
// buildings, plaques that have to be legible at 88px, folds that have to open
// when a deep link asks for them. The suite can assert that an id exists; it
// cannot see that a flagpole was drawn in night ink on a night sky, which is
// exactly the bug the first draft of the sprites shipped with.
//
// The behavioural checks below are written so they CAN fail: each measures
// something (a rectangle, an `open` property, a scroll position) rather than
// asking whether an element is in the DOM.
//
// Playwright is resolved out of G:/Wright-HQ, the same as the runners next door.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4399";
const OUT = join(process.cwd(), "qa-shots", "hub");
mkdirSync(OUT, { recursive: true });

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

const browser = await chromium.launch();

// ── desktop ─────────────────────────────────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${BASE}/town/`, { waitUntil: "load" });
await page.waitForTimeout(300);

await page.screenshot({ path: join(OUT, "01-hub-desktop-top.png") });
await page.screenshot({ path: join(OUT, "02-hub-desktop-full.png"), fullPage: true });

// the quarter alone, big — this is the shot the art is judged on
const quarter = await page.$(".cq");
if (quarter) await quarter.screenshot({ path: join(OUT, "03-civic-quarter.png") });

// 1 · FIVE BUILDINGS, FIVE DISTINCT PICTURES.
// Distinctness is asked in arithmetic: each sprite's set of fill colours must
// differ from every other's. Five identical buildings would pass "there are
// five anchors" and fail a reader instantly.
const palettes = await page.$$eval(".cq-b", (els) =>
  els.map((el) => ({
    lane: el.getAttribute("data-lane"),
    href: el.getAttribute("href"),
    fills: [...new Set([...el.querySelectorAll("rect")].map((r) => r.getAttribute("fill")))].sort().join(","),
    rects: el.querySelectorAll("rect").length,
  })));
record("five buildings are drawn", palettes.length === 5, `${palettes.length} buildings, rects: ${palettes.map((p) => p.rects).join("/")}`);
const uniquePalettes = new Set(palettes.map((p) => p.fills));
record("each building has its own palette", uniquePalettes.size === 5,
  `${uniquePalettes.size} distinct palettes across 5 buildings`);

// 2 · EVERY PLAQUE IS ACTUALLY VISIBLE AND BIG ENOUGH TO READ.
// The repo has been caught by text that was in the DOM at full opacity and not
// one pixel of it visible, so this measures the rendered box.
const plaques = await page.$$eval(".cq-plaque", (els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { text: el.textContent.trim(), w: r.width, h: r.height, size: parseFloat(cs.fontSize), opacity: parseFloat(cs.opacity) };
  }));
const badPlaque = plaques.find((p) => p.w < 40 || p.h < 6 || p.size < 9 || p.opacity < 0.5);
record("every plaque renders legibly", !badPlaque,
  badPlaque ? `"${badPlaque.text}" is ${badPlaque.w}x${badPlaque.h} at ${badPlaque.size}px` : plaques.map((p) => p.text).join(" · "));

// 3 · THE BUILDINGS DO NOT OVERLAP EACH OTHER.
const boxes = await page.$$eval(".cq-lot", (els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}));
let overlap = null;
for (let i = 0; i < boxes.length && !overlap; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) { overlap = [i, j]; break; }
  }
}
record("no two buildings overlap", !overlap, overlap ? `buildings ${overlap[0]} and ${overlap[1]} collide` : "all five sit apart");

// 4 · A BUILDING OPENS ITS LANE, AND THE LANE ACTUALLY SCROLLS INTO VIEW.
// This is the whole interaction of the page, so it is measured end to end:
// the fold's `open` before and after, and where the viewport ended up.
const beforeOpen = await page.$eval("#quests", (el) => el.open);
await page.click('.cq-b[data-lane="quests"]');
await page.waitForTimeout(700);
const afterOpen = await page.$eval("#quests", (el) => el.open);
const questTop = await page.$eval("#quests", (el) => el.getBoundingClientRect().top);
record("clicking a building opens its lane", !beforeOpen && afterOpen,
  `#quests open: ${beforeOpen} → ${afterOpen}`);
record("and scrolls the lane into view", questTop > -50 && questTop < 250,
  `#quests top is ${Math.round(questTop)}px from the viewport top`);
await page.screenshot({ path: join(OUT, "04-quest-guild-open.png") });

// 5 · THE DEEP LINKS THAT MUST NOT BREAK.
// /stamps/#board and every teaching id were live URLs before today. Each must
// arrive with its fold OPEN — including a teaching id, which is a fold inside
// a fold and is the case a one-level router would silently miss.
for (const [hash, sel] of [["#board", "#bounty-board"], ["#pots", "#quests"]]) {
  await page.goto(`${BASE}/town/${hash}`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const open = await page.$eval(sel, (el) => el.open);
  const seen = await page.$eval(hash, (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  record(`/town/${hash} arrives open`, open && seen, `${sel}.open=${open}, target rendered=${seen}`);
}

await page.goto(`${BASE}/town/#staking`, { waitUntil: "load" });
await page.waitForTimeout(600);
await page.screenshot({ path: join(OUT, "05-deep-link-staking.png") });

// 6 · THE FRAGMENT PARTITION AT /stamps/.
// /stamps/ is a teaching page again, not a forwarder — so a TEACHING id must
// stay put and open its section, while a LANE id must still forward to the
// quarter carrying its fragment. Getting one right and the other wrong is the
// whole risk of the partition, so both halves are asked separately.
await page.goto(`${BASE}/stamps/#earning`, { waitUntil: "load" });
await page.waitForTimeout(700);
const teachingStayed = page.url().includes("/stamps/");
const earningOpen = await page.$eval("#earning", (el) => el.open).catch(() => false);
record("a teaching id stays on /stamps/ and opens", teachingStayed && earningOpen,
  `${page.url()} · #earning.open=${earningOpen}`);

await page.goto(`${BASE}/stamps/#board`, { waitUntil: "load" });
await page.waitForTimeout(900);
record("a lane id forwards to the quarter", page.url().endsWith("/town/#board"), page.url());
const fwdBoardOpen = await page.$eval("#bounty-board", (el) => el.open).catch(() => false);
record("and the board lane is open when it lands", fwdBoardOpen, `#bounty-board.open=${fwdBoardOpen}`);

await page.goto(`${BASE}/stamps/#pots`, { waitUntil: "load" });
await page.waitForTimeout(900);
record("#pots forwards to the Guild that now holds it", page.url().endsWith("/town/#pots"), page.url());

// a bare /stamps/ is a PAGE now, not a doorway — it must not forward at all
await page.goto(`${BASE}/stamps/`, { waitUntil: "load" });
await page.waitForTimeout(700);
record("bare /stamps/ stays put", /\/stamps\/(#.*)?$/.test(page.url()), page.url());
await page.screenshot({ path: join(OUT, "11-stamps-teaching.png"), fullPage: true });

// 6b · ALL FIVE BUILDINGS STAND.
// The founder ruled ground a day-one act and the world planted all five. A
// badge still showing would mean the site's id or its read is wrong — so this
// asks the rendered page, not the derivation that fed it.
await page.goto(`${BASE}/town/`, { waitUntil: "load" });
await page.waitForTimeout(400);
const badges = await page.$$eval(".cq-soon", (els) => els.map((e) => e.textContent.trim()));
record("no building shows a not-standing badge", badges.length === 0,
  badges.length ? `still badged: ${badges.join(", ")}` : "all five stand");

// and the quarter's description is the PLAQUE's own words, from the world
const say = await page.$eval(".cq-say", (el) => el.textContent.trim()).catch(() => "");
record("the vignette quotes the quarter's plaque", say.startsWith("Where the town asks and is asked"),
  say || "(no description rendered)");
record("and no longer the town centre's quay line", !/lamplit quay/.test(say), say.slice(0, 60));

// 7 · KEYBOARD REACHES THE BUILDINGS.
// The buildings are anchors so this should be free — which is exactly why it
// is worth proving rather than assuming.
await page.goto(`${BASE}/town/`, { waitUntil: "load" });
await page.waitForTimeout(300);
let hops = 0, reached = null;
while (hops < 40 && !reached) {
  await page.keyboard.press("Tab");
  hops++;
  reached = await page.evaluate(() => {
    const a = document.activeElement;
    return a && a.matches && a.matches(".cq-b") ? a.getAttribute("data-lane") : null;
  });
}
record("a building takes keyboard focus", !!reached, reached ? `reached "${reached}" in ${hops} tabs` : `no building focused in ${hops} tabs`);
if (reached) await page.screenshot({ path: join(OUT, "06-keyboard-focus.png") });

// 8 · NO HORIZONTAL SCROLL.
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
record("the page does not scroll sideways", overflow <= 1, `${overflow}px of horizontal overflow`);

// ── narrow ──────────────────────────────────────────────────────────────────
const narrow = await browser.newPage({ viewport: { width: 420, height: 900 } });
await narrow.goto(`${BASE}/town/`, { waitUntil: "load" });
await narrow.waitForTimeout(300);
await narrow.screenshot({ path: join(OUT, "07-hub-420-top.png") });
await narrow.screenshot({ path: join(OUT, "08-hub-420-full.png"), fullPage: true });

const nOverflow = await narrow.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
record("no sideways scroll at 420px", nOverflow <= 1, `${nOverflow}px of horizontal overflow`);

const nBoxes = await narrow.$$eval(".cq-lot", (els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  return { right: r.right, w: r.width };
}));
const spill = nBoxes.find((b) => b.right > 421);
record("no building spills the narrow viewport", !spill, spill ? `a building reaches ${Math.round(spill.right)}px` : `widest is ${Math.round(Math.max(...nBoxes.map((b) => b.w)))}px`);

await narrow.goto(`${BASE}/town/#board`, { waitUntil: "load" });
await narrow.waitForTimeout(600);
await narrow.screenshot({ path: join(OUT, "09-hub-420-board.png") });

// ── the JS-off degrade ──────────────────────────────────────────────────────
// The brief's hard requirement: the buildings must still work as plain links.
// With scripting off the router cannot open a fold, so what is asserted is the
// honest degrade — the anchors are real hrefs and the folds are real <details>
// a reader can click.
const noJs = await browser.newContext({ javaScriptEnabled: false });
const bare = await noJs.newPage({ viewport: { width: 1440, height: 950 } });
await bare.goto(`${BASE}/town/`, { waitUntil: "load" });
const bareLinks = await bare.$$eval(".cq-b", (els) => els.map((el) => el.getAttribute("href")));
record("with JS off the buildings are real anchors", bareLinks.every((h) => h && h.startsWith("#")),
  bareLinks.join(" "));
const bareSummaries = await bare.$$eval(".c-lane > summary", (els) => els.length);
record("and every lane is a native fold", bareSummaries === 5, `${bareSummaries} summaries — five lanes since the teaching went back to /stamps/`);
const bareArt = await bare.$$eval(".cq-art rect", (els) => els.length);
record("and the art is still drawn", bareArt > 400, `${bareArt} rects with no script`);
await bare.screenshot({ path: join(OUT, "10-hub-no-js.png") });
await noJs.close();

await browser.close();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.log(`FAILED: ${failed.map((f) => f.name).join(" · ")}`);
  process.exitCode = 1;
}
