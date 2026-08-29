// shoot-cockpit-delta.mjs — the rendered half of two deletions.
//
//   node qa-shots/cockpit-harness.mjs 4362 &
//   node qa-shots/shoot-cockpit-delta.mjs [port] [outdir]
//
// TWO THINGS WERE REMOVED, and a removal is exactly the kind of change a DOM
// assertion is bad at judging. `doesNotMatch` proves a string is gone; it says
// nothing about whether what is LEFT still reads — whether the creature is
// still identifiable with no words on it, whether the action card's last line
// leaves a ragged edge, whether the plate's restored footer crowds the rows
// above it. Those are pixels, magnified, for the same reason the hp rails were.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const PORT = Number(process.argv[2] ?? 4362);
const OUT = process.argv[3] ?? "qa-shots/delta";
const base = `http://127.0.0.1:${PORT}/qa-shots/cockpit-harness.html`;

mkdirSync(OUT, { recursive: true });

const failures = [];
const note = (ok, line) => { console.log(`${ok ? "  ok  " : "  FAIL"} ${line}`); if (!ok) failures.push(line); };

const browser = await chromium.launch();

async function open(fixture) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  page.on("pageerror", (e) => failures.push(`${fixture}: page error — ${e.message}`));
  await page.goto(`${base}?fixture=${fixture}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cockpitReady);
  return page;
}

const crop = async (page, box, file, pad = 26) => {
  await page.screenshot({
    path: join(OUT, file),
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
            width: box.width + pad * 2, height: box.height + pad * 2 },
  });
  console.log(`  shot  ${join(OUT, file)}`);
};

const ring = (page) => page.evaluate(() => {
  const g = document.querySelector(".pmc-adversary");
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return {
    hot: g.classList.contains("hot"),
    numbers: [...g.querySelectorAll(".pmc-adv-hp text")].map((t) => t.textContent.trim()),
    plate: [...g.querySelectorAll(".pmc-adv-name")].length,
    anyText: [...g.querySelectorAll("text")].map((t) => t.textContent.trim()),
    box: { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 },
  };
});

// ══ THE CREATURE: HOVER IS THE NUMBERS, AND THAT IS ALL ═════════════════════
console.log("\n── the cake's token: no name plate, at rest or hovered ──");
{
  const page = await open("vault");
  const rest = await ring(page);
  note(Boolean(rest), "the creature's ring is drawn");
  note(rest.plate === 0 && rest.anyText.length === 0, `at rest the figure carries no words (${JSON.stringify(rest.anyText)})`);
  await crop(page, rest.box, "01-cake-at-rest.png");

  await page.mouse.move(rest.box.cx, rest.box.cy);
  await page.waitForTimeout(200);
  const hot = await ring(page);
  note(hot.hot, "pointing at it lights it");
  note(hot.numbers.length === 1, `and the rail shows its numbers (${JSON.stringify(hot.numbers)})`);
  // ⚑ THE RULING ITSELF: hovered, the ONLY text on the figure is the two
  // numbers. A name plate would be a second text node here.
  note(hot.plate === 0 && hot.anyText.length === 1,
    `hovered, the numbers are the only words on it (${JSON.stringify(hot.anyText)})`);
  await crop(page, hot.box, "02-cake-hovered-numbers-only.png");

  // THE NO-ORPHAN CONTROL, on the pixels: the wheel up top still names it, so
  // the ring is not a thing a reader has no way to identify.
  const wheel = await page.evaluate(() => {
    const li = [...document.querySelectorAll(".pmc-turn")].find((n) => n.classList.contains("is-creature"));
    if (!li) return null;
    const r = li.getBoundingClientRect();
    return { nm: li.querySelector(".nm")?.textContent?.trim() ?? null,
             box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  });
  note(Boolean(wheel?.nm), `the wheel's seat still names the creature (${JSON.stringify(wheel?.nm)})`);
  if (wheel) await crop(page, wheel.box, "03-the-wheel-still-names-it.png", 10);
  await page.close();
}

// ══ THE ACTION CARD, WITHOUT ITS LAST LINE ══════════════════════════════════
console.log("\n── an act's hover card ──");
{
  const page = await open("vault");
  const seat = await page.$(".pmc-slot:not([disabled])");
  await seat.hover();
  await page.waitForTimeout(250);
  const card = await page.evaluate(() => {
    const el = document.querySelector(".pmc-card");
    if (!el || getComputedStyle(el).opacity === "0") return null;
    const r = el.getBoundingClientRect();
    return { txt: el.textContent.replace(/\s+/g, " ").trim(), from: [...el.querySelectorAll(".pmc-from")].map((p) => p.textContent.trim()),
             box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  });
  note(Boolean(card), "the card opens on a seat hover");
  note(!/fine print/i.test(card.txt ?? ""), `and says nothing about pressing for terms (${JSON.stringify(card.txt.slice(0, 90))})`);
  note(card.from.length === 0, `an affordable seat's card ends with its own words (from-lines: ${JSON.stringify(card.from)})`);
  await crop(page, card.box, "04-act-card-no-fine-print.png");

  await page.close();
}

// …and a REFUSED seat still explains itself, which is the branch that had to
// survive the deletion — a different sentence answering a question the reader
// actually has. It needs the `gated` fixture: the vault's seats are all live,
// so the surviving branch is simply not on screen there, and a control that
// cannot appear is not a control.
console.log("\n── a gated act's card ──");
{
  const page = await open("gated");
  // A GATED SEAT WEARS `.gated`, NOT `disabled` — it stays hoverable on purpose,
  // which is the whole reason its card can say why it is cold.
  const cold = await page.$(".pmc-slot.gated");
  if (cold) {
    await cold.hover();
    await page.waitForTimeout(250);
    const c2 = await page.evaluate(() => {
      const el = document.querySelector(".pmc-card");
      const r = el.getBoundingClientRect();
      return { from: [...el.querySelectorAll(".pmc-from")].map((p) => p.textContent.trim()),
               txt: el.textContent.replace(/\s+/g, " ").trim(),
               box: { x: r.x, y: r.y, width: r.width, height: r.height } };
    });
    note(c2.from.some((t) => /seat lights/.test(t)), `a gated seat still says why (${JSON.stringify(c2.from)})`);
    note(!/fine print/i.test(c2.txt ?? ""), "and it too has lost the pointer-to-terms line");
    await crop(page, c2.box, "05-gated-seat-still-explains.png");
  } else {
    note(false, "no gated seat in the `gated` fixture — the surviving branch is unproven");
  }
  await page.close();
}

// ══ THE PLATE, WITH ITS DISCLOSURE BACK ═════════════════════════════════════
console.log("\n── the dock's plate: the journalling line, over your own seat only ──");
{
  const page = await open("armed");
  await page.hover('.pmc-face[data-actor="human:self"]');
  await page.waitForTimeout(200);
  const own = await page.evaluate(() => {
    const el = document.querySelector(".pmc-here");
    const r = el.getBoundingClientRect();
    return { txt: el.textContent.replace(/\s+/g, " ").trim(), box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  });
  note(/journals on every act/.test(own.txt), `your own seat carries the disclosure (${JSON.stringify(own.txt.slice(-60))})`);
  await crop(page, own.box, "06-plate-own-seat-discloses.png");

  await page.hover('.pmc-face[data-actor="jetto-of-starforge"]');
  await page.waitForTimeout(200);
  const ally = await page.evaluate(() => {
    const el = document.querySelector(".pmc-here");
    const r = el.getBoundingClientRect();
    return { txt: el.textContent.replace(/\s+/g, " ").trim(), box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  });
  note(!/journals on every act/.test(ally.txt),
    `and an ally's plate does not claim it about them (${JSON.stringify(ally.txt.slice(-60))})`);
  await crop(page, ally.box, "07-plate-ally-silent.png");
  await page.close();
}

await browser.close();
console.log(`\n${failures.length ? `FAILED (${failures.length})` : "all clear"}`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
