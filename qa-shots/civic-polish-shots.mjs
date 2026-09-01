// ⚠ SUPERSEDED 2026-09-01 — DO NOT RUN THIS AGAINST /town/ AND BELIEVE IT.
//
// Every check below reads `details.c-lane`, `.c-sum-name` or `#ideas .c-law`.
// The founder's one-panel ruling of 2026-09-01 replaced the five <details>
// folds with one panel region of five <section class="c-lane">, and the `c-law`
// pull-quote with the plaque as the panel's heading. So this file's selectors
// find nothing, and "found nothing" is how it reports a DEFECT — it would hand
// back a page of red about a page that is correct.
//
// It is kept rather than deleted because the five RULINGS it judges are still
// law and their falsifiers are still green in test/civic-hub.test.mjs (the
// order of the Guild's blocks, the quay note read rather than typed, the
// Bounty Board's struck weight paragraph, the Ballot House's one sentence and
// its door). What is dead is this instrument, not the law it was built for.
//
// The runner for the current page is qa-shots/civic-panel-shots.mjs.
// Re-aiming this one is a job someone should do on purpose, not a side effect
// of tonight's lane; until then, this notice is the honest state.
//
// ── the original header follows ────────────────────────────────────────────
// civic-polish-shots.mjs — rendered QA for the founder's five, 2026-08-31.
//
//   npx astro dev --config astro.config.town.mjs --port 4411 &
//   SHOT_TAG=after node qa-shots/civic-polish-shots.mjs
//
// WHY A SECOND SHOT RUNNER beside hub-shots.mjs. That one judges the civic
// quarter's ART — five buildings, five plaques, the quay. This one judges five
// RULINGS, four of which are removals and one of which is an order. Both of
// those are invisible to a check that asks "is this element present": a
// paragraph that came back and a paragraph that never left look identical to
// the DOM, and three blocks in the wrong order are three blocks.
//
// THE TWIN IS READ BEFORE THE SCREENSHOT, and it asks the two questions the
// picture asks — is this opaque, and does any ancestor clip it — because this
// repo has been caught by text sitting in the DOM at opacity 1 with a measured
// width of 239px and not one pixel of it on screen (an `overflow: hidden` added
// to round off a corner). A twin that only counts nodes over-claims exactly
// where a reader would notice first.
//
// SHOT_TAG names the run (`before` on the base page, `after` on the branch), so
// the same script produces both halves of the comparison and the two sets
// cannot drift in what they measure.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4411";
const TAG = process.env.SHOT_TAG ?? "after";
const OUT = join(process.cwd(), "qa-shots", "civic-polish", TAG);
mkdirSync(OUT, { recursive: true });

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

// IS IT ACTUALLY ON SCREEN — opaque, non-zero, and unclipped by any ancestor.
// Handed to the page as a string so it can be reused in several evaluates.
const VISIBLE = `(el) => {
  if (!el) return { there: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  let node = el.parentElement, clipped = false;
  while (node && !clipped) {
    const p = getComputedStyle(node);
    if (p.overflow === "hidden" || p.overflowY === "hidden" || p.overflowX === "hidden") {
      const pr = node.getBoundingClientRect();
      if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) clipped = true;
      if (pr.width === 0 || pr.height === 0) clipped = true;
    }
    node = node.parentElement;
  }
  return { there: true, w: Math.round(r.width), h: Math.round(r.height),
           opacity: parseFloat(cs.opacity), clipped,
           // 400, not 160. THE FIRST RUN OF THIS FILE REPORTED A DEFECT THAT
           // WAS NOT THERE: the Think Tank's law line is 143 characters before
           // its cite, so a 160-char window cut the cite off and the check
           // "does the law name its mark" read a page that names it perfectly
           // well as a page that had lost it. An instrument that truncates the
           // evidence and then judges it will invent findings — which is the
           // same failure as one that cannot fail, pointed the other way.
           text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 400) };
}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

// THE DEV TOOLBAR IS NOT THE PAGE. Astro floats its own toolbar over the
// bottom of every dev render, and the first run of this file put it squarely
// across the pot cards — a QA shot with a widget parked over the content is a
// shot that can hide the defect it was taken to find. Removed before anything
// is measured or photographed; it exists in no build a reader ever sees.
async function dropDevToolbar(p) {
  await p.evaluate(() => {
    for (const sel of ["astro-dev-toolbar", "astro-dev-overlay", "#dev-toolbar-root"]) {
      for (const el of document.querySelectorAll(sel)) el.remove();
    }
  });
}

// open every lane, so a fold cannot hide a paragraph from the QA that a reader
// would find by clicking one thing
async function openAll() {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll("details.c-lane")) d.open = true;
  });
  await page.waitForTimeout(250);
}

await page.goto(`${BASE}/town/`, { waitUntil: "load" });
await page.waitForTimeout(400);
await dropDevToolbar(page);

// ── 5 · THE PANELS WEAR THEIR BUILDINGS' COLOUR ─────────────────────────────
// Taken FIRST, with every lane still shut, because the tint on a row of closed
// panels is the thing the founder asked for and the thing a reader meets.
await page.screenshot({ path: join(OUT, "01-lanes-shut-tinted.png"), fullPage: false });

const tints = await page.$$eval("details.c-lane", (els) => els.map((el) => {
  const cs = getComputedStyle(el);
  const sum = el.querySelector("summary");
  return {
    id: el.id,
    border: cs.borderTopColor,
    inline: el.getAttribute("style") || "",
    wash: sum ? getComputedStyle(sum).backgroundColor : null,
  };
}));
for (const t of tints) console.log(`        ${t.id}: border ${t.border} · wash ${t.wash}`);
const distinctBorders = new Set(tints.map((t) => t.border));
record("each panel carries its own border colour", distinctBorders.size === tints.length,
  `${distinctBorders.size} distinct borders across ${tints.length} panels`);
const goldOnly = tints.filter((t) => /232, 196, 139/.test(t.border));
record("no panel is still wearing the shared gold", goldOnly.length === 0,
  goldOnly.length ? `still gold: ${goldOnly.map((t) => t.id).join(", ")}` : "all five are their own colour");
const washed = tints.filter((t) => t.wash && t.wash !== "rgba(0, 0, 0, 0)");
record("each panel's heading strip carries a wash", washed.length === tints.length,
  washed.map((t) => `${t.id} ${t.wash}`).join(" · "));

// CONTRAST, MEASURED rather than eyeballed. The lane heading is the text that
// sits ON the wash, so its contrast against the composited strip is the number
// that decides whether a tint is safe. Composited by hand because
// getComputedStyle reports the wash's own rgba, not what it sits over.
const contrast = await page.$$eval("details.c-lane", (els) => {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (fg, bg) => {
    const [r, g, b, a = 1] = fg;
    return [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];
  };
  // the page's own ground, under everything
  const pageBg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
  return els.map((el) => {
    const sum = el.querySelector("summary");
    const name = el.querySelector(".c-sum-name");
    const panel = over(parse(getComputedStyle(el).backgroundColor), pageBg);
    const strip = over(parse(getComputedStyle(sum).backgroundColor), panel);
    const ink = over(parse(getComputedStyle(name).color), strip);
    const [a, b] = [lum(ink), lum(strip)].sort((x, y) => y - x);
    return { id: el.id, ratio: Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100 };
  });
});
for (const c of contrast) console.log(`        ${c.id}: heading contrast ${c.ratio}:1`);
const lowContrast = contrast.filter((c) => c.ratio < 4.5);
record("every lane heading holds AA contrast over its tint", lowContrast.length === 0,
  lowContrast.length ? lowContrast.map((c) => `${c.id} ${c.ratio}:1`).join(", ")
    : `lowest is ${Math.min(...contrast.map((c) => c.ratio))}:1`);

await openAll();

// ── 1 · THE QUEST GUILD ─────────────────────────────────────────────────────
const guild = await page.$("#quests");
if (guild) await guild.screenshot({ path: join(OUT, "02-quest-guild.png") });

// ORDER, asked of the RENDERED page by vertical position — the one thing a
// source-order test cannot prove, because CSS can reorder anything.
const order = await page.evaluate(() => {
  const top = (sel) => {
    const el = document.querySelector(sel);
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  };
  return {
    cards: top("#quests .m-card.is-quest"),
    pots: top("#pots"),
    standings: top("#quests .q-stand"),
  };
});
console.log(`        cards@${order.cards} pots@${order.pots} standings@${order.standings}`);
record("the pots render under the quest cards",
  order.cards != null && order.pots != null && order.cards < order.pots,
  `cards at ${order.cards}px, pots at ${order.pots}px`);
record("and the standings render below everything else",
  order.standings != null && order.pots < order.standings,
  `pots at ${order.pots}px, standings at ${order.standings}px`);

const guildText = await page.$eval("#quests", (el) => (el.textContent || "").replace(/\s+/g, " "));
record("the Guild does not recite its own plaque",
  !/standings still hang at the works/.test(guildText),
  /standings still hang at the works/.test(guildText) ? "the plaque sentence is on the page" : "not present");
record("and the holo paragraph is not in the Guild",
  !/short for holographic stamp/.test(guildText),
  /short for holographic stamp/.test(guildText) ? "the expansion is still here" : "moved to /stamps/");

// the pointer that replaced it has to be a real, visible link
const holoLink = await page.$eval('#quests a[href^="/stamps/#"]',
  new Function("el", `return (${VISIBLE})(el)`)).catch(() => ({ there: false }));
record("the holo pointer is present and visible",
  holoLink.there && holoLink.w > 10 && holoLink.opacity > 0.5 && !holoLink.clipped,
  holoLink.there ? `"${holoLink.text}" ${holoLink.w}x${holoLink.h} opacity ${holoLink.opacity} clipped=${holoLink.clipped}` : "no pointer at all");

// ── 2 · THE THINK TANK ──────────────────────────────────────────────────────
const tank = await page.$("#ideas");
if (tank) await tank.screenshot({ path: join(OUT, "03-think-tank.png") });

const tankLaw = await page.$eval("#ideas .c-law", new Function("el", `return (${VISIBLE})(el)`))
  .catch(() => ({ there: false }));
console.log(`        law: ${tankLaw.text}`);
record("the law line quotes the Think Tank's own mark",
  /Where ideas enter the town/.test(tankLaw.text || "") && /the-think-tank/.test(tankLaw.text || ""),
  tankLaw.text || "(no law line)");
record("and no longer quotes the blueprints chest",
  !/proposal in the blueprints chest/.test(tankLaw.text || ""),
  /the-town\/blueprint\b/.test(tankLaw.text || "") ? "still cites the-town/blueprint" : "cites the tank");

// THE REDUNDANCY, measured on the card: a title and a body that are the same
// sentence. Asked of the rendered text, because that is where a reader sees it
// twice.
const cards = await page.$$eval("#ideas .m-card", (els) => els.map((el) => ({
  kind: (el.querySelector(".m-kind")?.textContent || "").trim(),
  title: (el.querySelector(".m-title")?.textContent || "").trim(),
  body: (el.querySelector(".m-body")?.textContent || "").trim(),
})));
for (const c of cards) console.log(`        card [${c.kind}] title="${c.title.slice(0, 60)}" body="${c.body.slice(0, 60)}"`);
const doubled = cards.filter((c) => c.body && c.body === c.title);
record("no idea card prints its claim twice", doubled.length === 0,
  doubled.length ? `${doubled.length} card(s) repeat the claim` : `${cards.length} card(s), each saying it once`);

const quay = await page.$eval("#ideas .m-note", (el) => (el.textContent || "").replace(/\s+/g, " ").trim())
  .catch(() => "");
console.log(`        quay note: ${quay}`);
record("the quay note is the world's CURRENT sentence",
  /Publish it at the Think Tank/.test(quay),
  quay ? quay.slice(0, 120) : "(no quay note)");
record("and the superseded version is gone",
  !/Open a blueprint in the chest/.test(await page.$eval("#ideas", (el) => el.textContent || "")),
  "checked across the whole lane");
const chest = await page.$('#ideas a[href*="postmark-blueprints"]');
record("the chest link survives as the secondary line", !!chest,
  chest ? "postmark-blueprints ↗ present" : "the chest link was lost");

// ── 3 · THE BOUNTY BOARD ────────────────────────────────────────────────────
const board = await page.$("#bounty-board");
if (board) await board.screenshot({ path: join(OUT, "04-bounty-board.png") });
const boardText = await page.$eval("#bounty-board", (el) => (el.textContent || "").replace(/\s+/g, " "));
record("the board carries no weight paragraph",
  !/A notice's weight is stamps staked/.test(boardText),
  /A notice's weight/.test(boardText) ? "the paragraph is still here" : "removed");

// ── 4 · THE BALLOT HOUSE ────────────────────────────────────────────────────
const ballot = await page.$("#ballot-house");
if (ballot) await ballot.screenshot({ path: join(OUT, "05-ballot-house.png") });
const ballotSay = await page.$eval("#ballot-house .c-say", (el) => (el.textContent || "").replace(/\s+/g, " ").trim())
  .catch(() => "");
console.log(`        ballot: ${ballotSay}`);
const sentences = ballotSay.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
record("the ballot description is one sentence", sentences.length === 1,
  `${sentences.length} sentence(s): ${ballotSay}`);
record("and it says where the votes live", /Ballot Box/.test(ballotSay), ballotSay || "(nothing)");
const door = await page.$eval("#ballot-house a.c-door", new Function("el", `return (${VISIBLE})(el)`))
  .catch(() => ({ there: false }));
record("the button is kept and visible",
  door.there && door.w > 40 && door.opacity > 0.5 && !door.clipped,
  door.there ? `"${door.text}" ${door.w}x${door.h} clipped=${door.clipped}` : "THE BUTTON IS GONE");
const ballotText = await page.$eval("#ballot-house", (el) => (el.textContent || "").replace(/\s+/g, " "));
record("and the machinery is gone from the lane",
  !/stake_topic|liquid balance/.test(ballotText),
  /stake_topic|liquid balance/.test(ballotText) ? "still technical" : "one sentence and a door");

// ── the whole page, both widths ─────────────────────────────────────────────
await page.screenshot({ path: join(OUT, "06-hub-full-open.png"), fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
record("the page does not scroll sideways", overflow <= 1, `${overflow}px`);

const narrow = await browser.newPage({ viewport: { width: 420, height: 900 } });
await narrow.goto(`${BASE}/town/`, { waitUntil: "load" });
await narrow.waitForTimeout(300);
await dropDevToolbar(narrow);
await narrow.screenshot({ path: join(OUT, "07-hub-420-shut.png") });
await narrow.evaluate(() => { for (const d of document.querySelectorAll("details.c-lane")) d.open = true; });
await narrow.waitForTimeout(250);
await narrow.screenshot({ path: join(OUT, "08-hub-420-open.png"), fullPage: true });
const nOverflow = await narrow.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
record("no sideways scroll at 420px", nOverflow <= 1, `${nOverflow}px`);

await browser.close();

const failed = checks.filter((c) => !c.pass);
console.log(`\n[${TAG}] ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) console.log(`FAILED: ${failed.map((f) => f.name).join(" · ")}`);
// The BEFORE run is EXPECTED to fail most of these — that is what makes it a
// before. Only the after run gates.
if (failed.length && TAG !== "before") process.exitCode = 1;
