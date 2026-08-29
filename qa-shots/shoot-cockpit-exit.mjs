// shoot-cockpit-exit.mjs — the exit card, which the founder read and could not
// use.
//
//   node qa-shots/cockpit-harness.mjs 4363 &
//   node qa-shots/shoot-cockpit-exit.mjs [port] [outdir]
//
// HIS THREE COMPLAINTS WERE ALL ABOUT WHAT THE CARD SAID, so the assertions
// below read its rendered text and the crops are the evidence: an entry flavor
// paragraph recited on an exit, a from/to pair naming a creature and a
// direction, an input asking for the one thing it was forbidden to send, and a
// raw JSON line printed as prose. None of those is a thing a unit test can look
// at the way a reader does.
//
// AND THE LIFT IS SHOT BESIDE IT, because the fix is the card CLASS rather than
// exit's card: the same composer was gluing the room's entry prose and the same
// budget line onto every act that carried terms.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const PORT = Number(process.argv[2] ?? 4363);
const OUT = process.argv[3] ?? "qa-shots/exit-card";
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

/** Open an act's panel by pressing its seat, and read what the panel says. */
async function panelFor(page, action) {
  await page.click(`.pmc-slot[data-action="${action}"]`);
  await page.waitForTimeout(600);   // the shadow read lands
  return page.evaluate(() => {
    const f = document.querySelector(".pmc-form");
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return {
      txt: f.textContent.replace(/\s+/g, " ").trim(),
      flavor: f.querySelector(".flavor")?.textContent?.trim() ?? null,
      doing: f.querySelector(".pmc-doing")?.textContent?.trim() ?? null,
      rows: [...f.querySelectorAll(".pmc-flow-row")].map((n) => n.querySelector(".k")?.textContent?.trim()),
      fields: [...f.querySelectorAll("[data-field]")].map((n) => n.getAttribute("data-field")),
      terms: [...f.querySelectorAll(".pmc-term")].map((n) => n.textContent.replace(/\s+/g, " ").trim()),
      details: [...f.querySelectorAll("details")].length,
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
}

const crop = async (page, box, file, pad = 14) => {
  await page.screenshot({
    path: join(OUT, file),
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
            width: box.width + pad * 2, height: box.height + pad * 2 },
  });
  console.log(`  shot  ${join(OUT, file)}`);
};

// ══ THE EXIT CARD ═══════════════════════════════════════════════════════════
console.log("\n── the exit card, from inside the vault ──");
{
  const page = await open("vault");
  const p = await panelFor(page, "exit");
  note(Boolean(p), "the panel opens");

  // ① THE ROOM IT NAMES IS THE ENTERED ONE, NOT WHAT IS UNDER YOUR FEET.
  note(/step out of/i.test(p.doing ?? ""), `it says what the act does, plainly (${JSON.stringify(p.doing)})`);
  note(/candle vault/i.test(p.doing ?? ""), "and it names the room you entered");
  note(!/unlit cake/i.test(p.txt), "the creature you are standing inside is nowhere on it");

  // ② NO FROM/TO PAIR, NO INPUT.
  note(!p.rows.includes("from") && !p.rows.includes("to"),
    `no from/to pair on a no-choice act (rows ${JSON.stringify(p.rows)})`);
  note(!/back out/i.test(p.txt), "and no direction standing in for a destination");
  note(p.fields.length === 0, `nothing to fill in (${JSON.stringify(p.fields)})`);
  note(!/omit for the innermost/i.test(p.txt),
    "so the help text admitting the field was optional is gone with it");

  // ③ THE ROOM'S ENTRY PROSE IS NOT ON AN EXIT.
  note(!/Past the inner door/i.test(p.txt),
    `the cellar door's welcome is not recited here (flavor: ${JSON.stringify(p.flavor)})`);

  // ④ NO RAW JSON AS PROSE, AND THE TERMS STILL REACHABLE.
  note(!/cap_chars|\{"/.test(p.txt.replace(/<[^>]*>/g, "")) || p.details > 0,
    "no structure printed as a sentence");
  const briefJson = p.terms.filter((t) => /cap_chars/.test(t));
  note(briefJson.length === 0, `the budget block is off the card (${JSON.stringify(briefJson)})`);
  note(p.details > 0, "and the fine print is still one press away, which is where it lives");
  await crop(page, p.box, "01-exit-card.png");

  // the confirm is there and the act is one press
  note(/confirm/i.test(p.txt), "confirm");
  await page.close();
}

// ══ THE SAME DISEASE ON LIFT — the reason this was a class fix ══════════════
console.log("\n── the lift confirm, which had it too ──");
{
  // the vault fixture is the one whose bar actually carries LIFT — a lift seat
  // that is not on screen cannot prove a class fix reached its second act.
  const page = await open("vault");
  // LIFT IS AIMED, so its seat ARMS rather than opening a panel — the confirm
  // only exists once a target has been taken. That is the act's own flow and
  // not something to route around: the chip in the aim strip is the target a
  // reader would press.
  await page.click('.pmc-slot[data-action="lift"]');
  await page.waitForTimeout(400);
  const chip = await page.$(".pmc-aim [data-aim], .pmc-aim button, .pmc-strip button");
  if (chip) { await chip.click(); await page.waitForTimeout(600); }
  const p = await page.evaluate(() => {
    const f = document.querySelector(".pmc-form");
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return {
      txt: f.textContent.replace(/\s+/g, " ").trim(),
      terms: [...f.querySelectorAll(".pmc-term")].map((n) => n.textContent.replace(/\s+/g, " ").trim()),
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
  if (!p) {
    note(false, "the lift panel did not open — the class fix is unproven on its second act");
  } else {
    note(!/Past the inner door/i.test(p.txt), "no entry flavor on a lift either");
    note(!p.terms.some((t) => /cap_chars/.test(t)), "and no budget block on its card");
    // AND THE REGISTER THE FOUNDER PRAISED IS UNTOUCHED — "lifts to 8 · ends
    // turn" is the dial facts, and they are exactly what should stay.
    note(p.terms.some((t) => /lifts to|ends turn/i.test(t)) || /lifts to|ends turn/i.test(p.txt),
      `the dial facts still read (${JSON.stringify(p.terms.slice(0, 3))})`);
    await crop(page, p.box, "02-lift-confirm.png");
  }
  await page.close();
}

await browser.close();
console.log(`\n${failures.length ? `FAILED (${failures.length})` : "all clear"}`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
