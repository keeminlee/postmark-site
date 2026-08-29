// shoot-cockpit-asks67.mjs — the rendered QA for the founder's sixth and
// seventh asks of 2026-08-29.
//
//   node qa-shots/cockpit-harness.mjs 4318 &
//   node qa-shots/shoot-cockpit-asks67.mjs [port] [outdir]
//
// (6) the creature's token: the name text off the map, the hp numbers INTO the
//     rail and revealed on HOVER — "to keep the map clean".
// (7) the act that raises a downed ally is aimed at the DOWNED and nobody else;
//     with nobody down the seat sits greyed with its reason.
//
// WHY IT IS A SEPARATE RUNNER, and why it magnifies. Both asks are claims about
// marks a 1440 screenshot cannot resolve: the rail is about fifteen screen
// pixels tall and the numbers inside it are twelve. The hp rails shipped
// invisible three different ways the night before — present in the DOM, correct
// in every assertion, unreadable on the screen — and the only thing that caught
// it was a crop at deviceScaleFactor 3. So every look here is a magnified crop
// of the figure, and every claim that CAN be measured is measured rather than
// looked at.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const PORT = Number(process.argv[2] ?? 4318);
const OUT = process.argv[3] ?? "qa-shots/asks67";
const base = `http://127.0.0.1:${PORT}/qa-shots/cockpit-harness.html`;

mkdirSync(OUT, { recursive: true });

const failures = [];
const note = (ok, line) => { console.log(`${ok ? "  ok  " : "  FAIL"} ${line}`); if (!ok) failures.push(line); };

const browser = await chromium.launch();

/** MAGNIFIED, because these marks are small. Three device pixels per CSS pixel
 *  is what made the first hp rails legible in a crop at all. */
async function open(fixture, { width = 1440, height = 900 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
  page.on("pageerror", (e) => { failures.push(`${fixture}: page error — ${e.message}`); });
  await page.goto(`${base}?fixture=${fixture}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cockpitReady);
  return page;
}

/** The creature's own group, in screen coordinates — the thing to point at, and
 *  the thing to crop around. */
const ringBox = (page) => page.evaluate(() => {
  const g = document.querySelector(".pmc-adversary");
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
});

/** What the figure is SAYING right now, read out of the DOM rather than out of
 *  the shot — so the shot is evidence of legibility and this is evidence of
 *  presence, and neither is asked to be the other. */
const ringWords = (page) => page.evaluate(() => {
  const g = document.querySelector(".pmc-adversary");
  if (!g) return null;
  return {
    hot: g.classList.contains("hot"),
    rail: Boolean(g.querySelector(".pmc-adv-hp rect")),
    numbers: [...g.querySelectorAll(".pmc-adv-hp text")].map((t) => t.textContent.trim()),
    plate: [...g.querySelectorAll(".pmc-adv-name text")].map((t) => t.textContent.trim()),
  };
});

const crop = async (page, box, file, pad = 26) => {
  await page.screenshot({
    path: join(OUT, file),
    clip: {
      x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
      width: box.width + pad * 2, height: box.height + pad * 2,
    },
  });
  console.log(`  shot  ${join(OUT, file)}`);
};

// ══ (6) AT REST: THE RING AND THE RAIL ══════════════════════════════════════
console.log("\n── (6) the creature's token at rest ──");
{
  const page = await open("vault");
  // The pointer starts nowhere near it. `pointermove` has not fired, so this is
  // also the state a reader sees before they have touched the mouse at all.
  const box = await ringBox(page);
  note(Boolean(box), "the creature's ring is drawn");
  const rest = await ringWords(page);
  note(rest.rail, "at rest the rail is there");
  note(rest.numbers.length === 0, `at rest the rail carries no numbers (found ${JSON.stringify(rest.numbers)})`);
  note(rest.plate.length === 0, `at rest there is no name text on the map (found ${JSON.stringify(rest.plate)})`);
  await crop(page, box, "01-at-rest.png");

  // ══ ON HOVER: THE NUMBERS, IN THE RAIL ════════════════════════════════════
  console.log("\n── (6) …and on hover ──");
  await page.mouse.move(box.cx, box.cy);
  await page.waitForTimeout(60);
  const hot = await ringWords(page);
  note(hot.hot, "pointing at the figure lights it");
  note(hot.numbers.join("") === "41/60", `the rail shows the door's own numbers (${JSON.stringify(hot.numbers)})`);
  note(hot.plate.join("") === "the unlit cake", `and the name comes back on the plate (${JSON.stringify(hot.plate)})`);
  // THE NUMBERS ARE INSIDE THE RAIL, measured rather than eyeballed: the text's
  // own box must sit within the rail's, which is what "into the hp bar" means.
  const inside = await page.evaluate(() => {
    const rail = document.querySelector(".pmc-adv-hp rect");
    const text = document.querySelector(".pmc-adv-hp text");
    if (!rail || !text) return null;
    const a = rail.getBoundingClientRect(), b = text.getBoundingClientRect();
    return { within: b.x >= a.x && b.y >= a.y - 1 && b.right <= a.right && b.bottom <= a.bottom + 1,
             rail: { x: a.x, y: a.y, w: a.width, h: a.height }, text: { x: b.x, y: b.y, w: b.width, h: b.height } };
  });
  note(inside?.within, `the numbers sit inside the rail — rail ${JSON.stringify(inside?.rail)} text ${JSON.stringify(inside?.text)}`);
  await crop(page, box, "02-hovered.png");

  // …and moving off cools it again, which is the half a stuck highlight breaks.
  await page.mouse.move(box.cx, box.cy + 260);
  await page.waitForTimeout(60);
  const cooled = await ringWords(page);
  note(!cooled.hot && cooled.numbers.length === 0 && cooled.plate.length === 0,
    "moving off the figure puts the words away again");
  await page.close();
}

// ══ (7) THE ACT THAT RAISES AN ALLY, AIMED ══════════════════════════════════
console.log("\n── (7) with someone down: the aim set is the downed ──");
{
  const page = await open("vault");
  await page.click('.pmc-slot[data-action="lift"]');
  await page.waitForTimeout(60);
  const aim = await page.evaluate(() => ({
    armed: document.querySelector(".pmc-slot.armed")?.getAttribute("data-action") ?? null,
    chips: [...document.querySelectorAll(".pmc-aim [data-aim-at]")].map((b) => b.getAttribute("data-aim-at")),
    rings: [...document.querySelectorAll(".pmc-aim-layer [data-aim-target], .pmc-aim-layer g")].length,
    ringTitles: [...document.querySelectorAll(".pmc-aim-layer title")].map((t) => t.textContent.trim()),
  }));
  note(aim.armed === "lift", `pressing it arms it (armed=${aim.armed})`);
  note(aim.chips.length === 1 && aim.chips[0] === "vermillion",
    `the aim set is exactly the ally who is down (${JSON.stringify(aim.chips)})`);
  note(!aim.chips.includes("the-town/the-unlit-cake") && !aim.ringTitles.some((t) => t.includes("unlit cake")),
    `the creature is nowhere in it (rings: ${JSON.stringify(aim.ringTitles)})`);
  await page.screenshot({ path: join(OUT, "03-aim-set-downed.png"), fullPage: false });
  console.log(`  shot  ${join(OUT, "03-aim-set-downed.png")}`);

  // THE CONTROL, and it is the assertion that makes the one above mean
  // something: the acts that FIGHT still find the creature, from the same room.
  await page.keyboard.press("Escape");
  await page.click('.pmc-slot[data-action="strike"]');
  await page.waitForTimeout(60);
  const fight = await page.evaluate(() => ({
    armed: document.querySelector(".pmc-slot.armed")?.getAttribute("data-action") ?? null,
    ringTitles: [...document.querySelectorAll(".pmc-aim-layer title")].map((t) => t.textContent.trim()),
    chips: [...document.querySelectorAll(".pmc-aim [data-aim-at]")].map((b) => b.getAttribute("data-aim-at")),
  }));
  note(fight.armed === "strike" && fight.ringTitles.some((t) => t.includes("unlit cake")),
    `an unnarrowed act still lights the creature (${JSON.stringify(fight.ringTitles)})`);
  note(fight.chips.includes("vermillion"), "and still offers the unplaced ally as a chip — nothing was taken from it");
  await page.close();
}

console.log("\n── (7) with nobody down: the seat is greyed with its reason ──");
{
  const page = await open("nobodydown");
  const seat = await page.evaluate(() => {
    const el = document.querySelector('.pmc-slot[data-action="lift"]');
    if (!el) return null;
    return {
      gated: el.classList.contains("gated"),
      ariaDisabled: el.getAttribute("aria-disabled"),
      label: el.getAttribute("aria-label"),
      armed: el.classList.contains("armed"),
    };
  });
  note(Boolean(seat), "the seat is still ON the row — disabled, never hidden");
  note(seat?.gated && seat?.ariaDisabled === "true", `it is greyed (${JSON.stringify(seat)})`);
  note(/nobody is down/.test(seat?.label ?? ""), `and it carries its reason (${seat?.label})`);
  // PRESSING IT DOES NOTHING, which is the founder's own words: not armed with
  // a wrong target. The old behaviour armed a crosshair over the creature.
  await page.click('.pmc-slot[data-action="lift"]', { force: true });
  await page.waitForTimeout(60);
  const after = await page.evaluate(() => ({
    armed: document.querySelector(".pmc-slot.armed")?.getAttribute("data-action") ?? null,
    strip: Boolean(document.querySelector(".pmc-aim")),
    panel: Boolean(document.querySelector(".pmc-form")),
  }));
  note(after.armed === null && !after.strip && !after.panel,
    `pressing it arms nothing and opens nothing (${JSON.stringify(after)})`);
  // THE REASON IS READABLE, not just announced: the hover card leads with it.
  await page.hover('.pmc-slot[data-action="lift"]');
  await page.waitForTimeout(120);
  const card = await page.evaluate(() => {
    const host = document.querySelector("#pmc-card");
    if (!host || host.hidden) return null;
    const r = host.getBoundingClientRect();
    return { why: host.querySelector(".pmc-why")?.textContent?.trim() ?? null,
             box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  });
  note(card?.why === "nobody is down", `the hover card leads with why it is cold (${JSON.stringify(card?.why)})`);
  if (card?.box) await crop(page, card.box, "04-cold-seat-card.png", 14);
  await page.close();
}

await browser.close();

console.log(`\n${failures.length ? `FAILED (${failures.length})` : "all clear"}`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
