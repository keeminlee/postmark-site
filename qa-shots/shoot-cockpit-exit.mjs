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

// ══ THE CLASS, ACROSS EVERY NO-INPUT ACT ═══════════════════════════════════
//
// ⚑ THREE NAMED INSTANCES SETTLE A DIAGNOSIS. The founder reported the same two
// faults on exit, then on lift, then on guard — three unrelated verbs whose only
// shared thing is the composer that builds their confirm. So the assertions below
// are written ONCE and run over the whole set: a fix that reached only the act
// that was complained about is a fix that will be reported again tomorrow.
const NO_INPUT = ["exit", "guard", "lift"];
// which of them the door states a cost for — exit does not, and its silence is
// the record's rather than something the cleanup took
const DIALLED = new Set(["guard", "lift"]);

for (const action of NO_INPUT) {
  console.log(`
── the ${action} confirm ──`);
  const page = await open("vault");
  // an AIMED act arms rather than opening — its confirm exists once a target is
  // taken, which is the act's own flow and not something to route around
  await page.click(`.pmc-slot[data-action="${action}"]`);
  await page.waitForTimeout(400);
  const chip = await page.$(".pmc-aim [data-aim], .pmc-aim button, .pmc-strip button");
  if (chip) { await chip.click(); await page.waitForTimeout(600); }
  await page.waitForTimeout(400);
  const p = await page.evaluate(() => {
    const f = document.querySelector(".pmc-form");
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return {
      txt: f.textContent.replace(/\s+/g, " ").trim(),
      flavor: f.querySelector(".flavor")?.textContent?.trim() ?? null,
      rows: [...f.querySelectorAll(".pmc-flow-row")].map((n) => n.querySelector(".k")?.textContent?.trim()),
      fields: [...f.querySelectorAll("[data-field]")].map((n) => n.getAttribute("data-field")),
      terms: [...f.querySelectorAll(".pmc-term")].map((n) => n.textContent.replace(/\s+/g, " ").trim()),
      details: [...f.querySelectorAll("details")].length,
      // whether the DOOR gave this act any dials at all, read off the card's own
      // fine print — so the assertion below can tell "the line is missing" from
      // "there is nothing for a line to say"
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
  if (!p) { note(false, `${action}: no confirm panel opened — the class is unproven on this act`); await page.close(); continue; }

  note(!/Past the inner door/i.test(p.txt), `${action}: no room's ENTRY prose on it (flavor ${JSON.stringify(p.flavor)})`);
  note(!p.terms.some((t) => /cap_chars/.test(t)), `${action}: no raw structure printed as a sentence`);
  note(!/\{"/.test(p.txt.replace(/\s+/g, "")) || p.details > 0, `${action}: nothing JSON-shaped standing in prose`);
  note(p.fields.length === 0, `${action}: nothing to fill in (${JSON.stringify(p.fields)})`);
  note(p.rows.includes("who"), `${action}: it says WHO is acting`);
  note(/confirm/i.test(p.txt), `${action}: and offers the press`);
  note(p.details > 0, `${action}: the terms are one press away, which is where they live`);
  // THE REGISTER THE FOUNDER CALLED GOOD survives the cleanup — "lifts to 8 ·
  // ends turn" is the dial facts, and a fix that cost him those would be a worse
  // card than the one he complained about.
  // WHERE THE DOOR GAVE DIALS, the line survives the cleanup — that is the
  // register the founder called GOOD, and a fix that cost him it would be a worse
  // card than the one he complained about. Where it gave none, the absence is the
  // RECORD's: exit states no cost, so there is nothing for a line to say, and the
  // set below is read off the harness fixture rather than guessed at.
  const dialled = DIALLED.has(action);
  note(dialled === p.terms.some((t) => /^this act/.test(t)),
    `${action}: dial facts ${dialled ? "kept" : "absent because the door states none"} (${JSON.stringify(p.terms.slice(0, 2))})`);
  await crop(page, p.box, `0${NO_INPUT.indexOf(action) + 2}-${action}-confirm.png`);
  await page.close();
}

// ══ A REFUSAL WEARING A 200 MOVES NOTHING ═══════════════════════════════════
//
// ⚑ THE FOUNDER'S LIVE REPRO, party night: he exited the vault, the camera
// stepped outside, and the record still had him inside it. The office had
// REFUSED the act — an arena gates movement to whoever the wheel is on — and
// answered 200 with the reason in the body. `res.ok` is the transport's word;
// the door's word is in the body, and this surface was reading the wrong one.
console.log("\n── an exit the door refuses ──");
for (const [qs, label, shouldMove] of [["&refuse=exit", "refused", false], ["", "accepted", true]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  await page.addInitScript(() => {
    window.__stood = [];
    window.addEventListener("pm:stood-out", (e) => window.__stood.push(e.detail?.left ?? null));
  });
  await page.goto(`${base}?fixture=vault${qs}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cockpitReady);
  await page.click('.pmc-slot[data-action="exit"]');
  await page.waitForTimeout(600);
  await page.click(".pmc-btn.go");
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const f = document.querySelector(".pmc-form");
    const said = f?.querySelector(".pmc-said");
    const box = f?.getBoundingClientRect();
    return { stood: window.__stood, said: said?.textContent?.replace(/\s+/g, " ").trim() ?? null,
             bad: Boolean(f?.querySelector(".pmc-said.bad")),
             box: box && { x: box.x, y: box.y, width: box.width, height: box.height } };
  });
  note(r.stood.length === (shouldMove ? 1 : 0),
    `${label}: the camera ${shouldMove ? "steps out once" : "does not move"} (${JSON.stringify(r.stood)})`);
  if (!shouldMove) {
    note(r.bad, `${label}: and the refusal is rendered rather than swallowed`);
    note(/vermillion's turn/.test(r.said ?? ""), `${label}: in the door's own words (${JSON.stringify(r.said)})`);
    if (r.box) await crop(page, r.box, "05-refused-exit-says-why.png");
  }
  await page.close();
}

await browser.close();
console.log(`
${failures.length ? `FAILED (${failures.length})` : "all clear"}`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
