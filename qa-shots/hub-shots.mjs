// ⚠ PARTLY SUPERSEDED 2026-09-01 — the FOLD checks in here now read a shape
// that does not exist, and will report defects about a correct page.
//
// The founder's one-panel ruling replaced the five <details> folds with one
// panel region of five <section class="c-lane">. Every `el.open` read below —
// the `#quests` open/close pair, the four `arrives open` deep links, the
// `#bounty-board.open` after the /stamps/ forward, and the `.c-lane > summary`
// count on the scriptless page — is asking a <section> for a property only a
// <details> has, and gets `undefined`.
//
// WHAT IS STILL TRUE IN HERE: the buildings, the plaques, the quay, the 88px
// legibility pass, the forwarding ROUTES themselves (/stamps/#board landing on
// /town/#board is unchanged), and the no-JavaScript degrade — which now
// degrades differently and better, because the panel switch is CSS rather than
// script. See qa-shots/civic-panel-shots.mjs, which asks the panel's questions
// of the panel.
//
// Re-aiming the fold half is a job someone should do on purpose; naming it
// here is what stops the next run being read as a page full of regressions.
//
// ── the original header follows ────────────────────────────────────────────
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

// The Guild's cards are the registry's own rows, so the count this expects is
// READ from the registry rather than written down — a number typed here would
// need editing every time the town adds a quest, which is exactly the drift
// this check exists to catch.
const { QUEST_REGISTRY } = await import("../src/lib/civic.mjs");
const EXPECTED_CARDS = QUEST_REGISTRY.daily.length + QUEST_REGISTRY.milestone.length;

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

// 4b · EVERY REGISTRY ROW RIDES THE CARDS.
// THE DRIFT THIS CATCHES, which already happened once: a quest row was added to
// the registry and the shots were re-taken from a stale build, so the committed
// record showed three cards for a four-row registry. Nothing was broken — the
// page was right and the PICTURE OF IT was wrong — and no existing check could
// see the difference, because they all counted what was rendered against
// itself. Asking the registry is what makes the two disagree out loud.
const cardTitles = await page.$$eval(".m-card.is-quest .m-title", (els) => els.map((e) => e.textContent.trim()));
record("every registry quest rides the cards", cardTitles.length === EXPECTED_CARDS,
  `${cardTitles.length} cards for ${EXPECTED_CARDS} registry rows: ${cardTitles.join(" · ")}`);
for (const q of [...QUEST_REGISTRY.daily, ...QUEST_REGISTRY.milestone]) {
  record(`  card: ${q.title}`, cardTitles.includes(q.title),
    cardTitles.includes(q.title) ? "rides the Guild" : "IN THE REGISTRY, NOT ON THE PAGE");
}
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

// 6c · THE VIGNETTE CARRIES NO DESCRIPTION.
// Founder-ruled: with all five buildings drawn and named right there, any prose
// under the heading only says again what the picture already says. This is
// asked of the RENDER because that is where a description can come back — from
// a reverted paragraph, a re-added derivation, or a stray helper — and because
// two different sentences have already stood in that slot today.
const say = await page.$eval(".cq-say", (el) => el.textContent.trim()).catch(() => null);
record("the vignette carries no description", say === null,
  say === null ? "no description element at all" : `still describing itself: "${say.slice(0, 70)}"`);

// and neither of the two sentences that stood there is anywhere on the page
const quarterText = await page.$eval(".cq", (el) => el.textContent).catch(() => "");
record("neither retired description came back", !/lamplit quay|Where the town asks and is asked/.test(quarterText),
  /lamplit quay/.test(quarterText) ? "the town centre's quay line is back"
    : /Where the town asks and is asked/.test(quarterText) ? "the plaque quote is back"
    : "the heading and the five buildings are the description");

// the heading itself must still be there — "no description" is not "no label"
const heading = await page.$eval(".cq-h", (el) => el.textContent.trim()).catch(() => "");
record("the quarter still names itself", /civic quarter/i.test(heading), heading || "(no heading)");

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
