// shoot-cockpit-ask8.mjs — the rendered QA for the founder's eighth ask.
//
//   node qa-shots/cockpit-harness.mjs 4331 &
//   node qa-shots/shoot-cockpit-ask8.mjs [port] [outdir]
//
// THE RULING: the ACT AS dock's hover shows the orange-rimmed LARGER card, not
// the small nameplate — and the card's content, "useless for the human to see",
// is replaced with the fighter's inventory (with an icon), their HP bar with
// numbers, and whatever other stats read well.
//
// WHAT ONLY A SHOT CAN SETTLE: whether four rows about one person read as a
// card or as a debug dump, whether the numbers on the bar survive the bar's own
// fill behind them, and whether a 24-pixel glyph beside a thing's name says
// "held" at the size it is actually drawn. Crops, magnified, for the same
// reason the hp rails needed them.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const PORT = Number(process.argv[2] ?? 4331);
const OUT = process.argv[3] ?? "qa-shots/ask8";
const base = `http://127.0.0.1:${PORT}/qa-shots/cockpit-harness.html`;

mkdirSync(OUT, { recursive: true });

const failures = [];
const note = (ok, line) => { console.log(`${ok ? "  ok  " : "  FAIL"} ${line}`); if (!ok) failures.push(line); };

const browser = await chromium.launch();

async function open(fixture) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  page.on("pageerror", (e) => { failures.push(`${fixture}: page error — ${e.message}`); });
  await page.goto(`${base}?fixture=${fixture}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cockpitReady);
  return page;
}

/** What the plate is saying, and whether it is on screen at all. */
const plateWords = (page) => page.evaluate(() => {
  const el = document.querySelector(".pmc-here");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    opacity: Number(getComputedStyle(el).opacity),
    who: el.querySelector(".who")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    tags: [...el.querySelectorAll(".tag")].map((t) => t.textContent.trim()),
    hp: el.querySelector(".pmc-hp .num")?.textContent?.trim() ?? null,
    fill: el.querySelector(".pmc-hp .fill")?.getAttribute("style") ?? null,
    stats: el.querySelector(".spine")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    kit: el.querySelector(".kit")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    icon: Boolean(el.querySelector(".kit .pmc-ico")),
    box: { x: r.x, y: r.y, width: r.width, height: r.height },
  };
});

const crop = async (page, box, file, pad = 12) => {
  await page.screenshot({
    path: join(OUT, file),
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
            width: box.width + pad * 2, height: box.height + pad * 2 },
  });
  console.log(`  shot  ${join(OUT, file)}`);
};

// ══ THE SMALL NAMEPLATE IS GONE ═════════════════════════════════════════════
console.log("\n── the nameplate that doubled the plate ──");
{
  const page = await open("armed");
  const boxes = await page.evaluate(() => document.querySelectorAll(".pmc-nm").length);
  note(boxes === 0, `no face draws a small name box (found ${boxes})`);
  const rest = await plateWords(page);
  note(rest.opacity === 0, `and the plate is still a hover reveal (opacity ${rest.opacity})`);
  await page.close();
}

// ══ HOVERING A FACE SHOWS THAT FIGHTER ══════════════════════════════════════
// The `armed` fixture puts a weapon in the human's hand, which is the half of
// the inventory row that has something to say.
console.log("\n── hovering the human: hit points, stats, and what is in the hand ──");
{
  const page = await open("armed");
  await page.hover('.pmc-face[data-actor="human:self"]');
  await page.waitForTimeout(150);
  const p = await plateWords(page);
  note(p.opacity === 1, "the plate is revealed");
  note(/DARKO/.test(p.who ?? ""), `it names the fighter (${JSON.stringify(p.who)})`);
  note(p.hp === "16/20", `the hp bar carries its numbers (${JSON.stringify(p.hp)})`);
  note(/width:\s*80\.0%/.test(p.fill ?? ""), `and the fill is the fraction, not a guess (${p.fill})`);
  note(/initiative 12/.test(p.stats ?? ""), `the stats row reads (${JSON.stringify(p.stats)})`);
  note(p.icon && /good lighter/.test(p.kit ?? ""), `the inventory names the thing, with its icon (${JSON.stringify(p.kit)})`);
  note(/\+3 to strike/.test(p.kit ?? ""), "and what it adds, in the record's own words");
  // THE NUMBERS MUST SURVIVE THE FILL BEHIND THEM — measured: the text box sits
  // inside the rail, which is what "a bar WITH numbers" means rather than a bar
  // and a number beside it.
  const inside = await page.evaluate(() => {
    const rail = document.querySelector(".pmc-hp");
    const num = document.querySelector(".pmc-hp .num");
    if (!rail || !num) return null;
    const a = rail.getBoundingClientRect(), b = num.getBoundingClientRect();
    return b.x >= a.x - 1 && b.right <= a.right + 1 && b.y >= a.y - 1 && b.bottom <= a.bottom + 1;
  });
  note(inside, "the numbers sit inside the rail");
  await crop(page, p.box, "01-human-armed.png");
  await page.close();
}

// ══ SOMEONE ELSE, WITHOUT LEAVING YOUR OWN SEAT ═════════════════════════════
console.log("\n── hovering an ally: the dock became a way to LOOK ──");
{
  const page = await open("armed");
  const acting = await page.evaluate(() =>
    document.querySelector('.pmc-face[aria-pressed="true"]')?.getAttribute("data-actor") ?? null);
  await page.hover('.pmc-face[data-actor="jetto-of-starforge"]');
  await page.waitForTimeout(150);
  const p = await plateWords(page);
  note(/jetto/.test(p.who ?? ""), `the plate follows the pointer (${JSON.stringify(p.who)})`);
  note(p.hp === "7/20", `their own numbers, not the acting seat's (${JSON.stringify(p.hp)})`);
  note(/width:\s*35\.0%/.test(p.fill ?? ""), `and their own fraction (${p.fill})`);
  note(/empty-handed/.test(p.kit ?? "") && p.icon,
    `an empty hand is an ANSWER, not a missing row (${JSON.stringify(p.kit)})`);
  // ⚑ LOOKING IS NOT SELECTING. A hover that changed who acts would make the
  // roster unusable as a place to read the party from.
  const stillActing = await page.evaluate(() =>
    document.querySelector('.pmc-face[aria-pressed="true"]')?.getAttribute("data-actor") ?? null);
  note(stillActing === acting, `and hovering did not change who is acting (${acting} → ${stillActing})`);
  await crop(page, p.box, "02-an-ally.png");

  // …and the dock is not rebuilt under the hand: the face the pointer was on is
  // the same ELEMENT after the plate changed, which is the flicker this avoids.
  await page.evaluate(() => { window.__before = document.querySelector('.pmc-face[data-actor="jetto-of-starforge"]'); });
  await page.hover('.pmc-face[data-actor="wright"]');
  await page.waitForTimeout(150);
  const same = await page.evaluate(() =>
    window.__before === document.querySelector('.pmc-face[data-actor="jetto-of-starforge"]'));
  note(same, "the dock's own buttons are not rebuilt when the plate changes");
  // WRIGHT IS NOT ON THE WHEEL, which is the branch an empty bar would have lied
  // about — standing in the room and not fighting is not the same as being at zero.
  const p3 = await plateWords(page);
  note(/wright/.test(p3.who ?? ""), `and the plate moved on with the pointer (${JSON.stringify(p3.who)})`);
  note(p3.hp === null && /not in this fight/.test(p3.stats ?? ""),
    `someone off the wheel gets no bar and says why (${JSON.stringify(p3.stats)})`);
  await crop(page, p3.box, "03-off-the-wheel.png");
  await page.close();
}

// ══ A REFUSED FACE STILL EXPLAINS ITSELF ════════════════════════════════════
console.log("\n── a face that cannot act ──");
{
  const page = await open("refused");
  const refused = await page.evaluate(() =>
    document.querySelector('.pmc-face[aria-disabled="true"]')?.getAttribute("data-actor") ?? null);
  note(Boolean(refused), `the fixture holds a refused face (${refused}) — without one nothing below could fail`);
  if (refused) {
    await page.hover(`.pmc-face[data-actor="${refused}"]`);
    await page.waitForTimeout(150);
    const p = await plateWords(page);
    note(p.opacity === 1, "a refused face is still hoverable, which is what aria-disabled buys");
    note(p.tags.includes("cannot act here"), `and says so (${JSON.stringify(p.tags)})`);
    note(/not within/.test(p.stats ?? ""), `carrying the door's own reason (${JSON.stringify(p.stats)})`);
    await crop(page, p.box, "04-refused-face.png");
    // and pressing it still does nothing
    await page.click(`.pmc-face[data-actor="${refused}"]`, { force: true });
    await page.waitForTimeout(120);
    const acting = await page.evaluate(() =>
      document.querySelector('.pmc-face[aria-pressed="true"]')?.getAttribute("data-actor") ?? null);
    note(acting !== refused, `pressing it does not seat you in it (acting=${acting})`);
  }
  await page.close();
}

// ══ THE BAR STILL FITS ══════════════════════════════════════════════════════
console.log("\n── and the row the dock sits in is unchanged ──");
{
  const page = await open("vault");
  const m = await page.evaluate(() => {
    const bar = document.querySelector(".pmc-bar");
    const body = document.documentElement;
    return { overflow: bar.scrollWidth - bar.clientWidth, page: body.scrollWidth > body.clientWidth };
  });
  note(m.overflow <= 1, `the verb row still does not scroll (overflow ${m.overflow}px)`);
  note(!m.page, "and the page does not scroll sideways");
  await page.close();
}

await browser.close();

console.log(`\n${failures.length ? `FAILED (${failures.length})` : "all clear"}`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
