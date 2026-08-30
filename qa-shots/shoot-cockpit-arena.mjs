// shoot-cockpit-arena.mjs — the shots and the MEASUREMENTS for the 2026-08-29
// interaction rulings.
//
//   node qa-shots/cockpit-harness.mjs 4318 &
//   node qa-shots/shoot-cockpit-arena.mjs [port] [outdir]
//
// WHY THIS EXISTS BESIDE THE UNIT TESTS. Two of tonight's rulings are claims
// about PIXELS and cannot be settled by a green assertion: "too many buttons"
// is answered by a row that fits, and "the cake should be highlighted" is
// answered by a ring a reader can see. The suite can prove the fold partitions
// correctly and prove nothing about whether the result fits on his screen.
//
// So the scroll check is a MEASUREMENT, not a look: scrollWidth against
// clientWidth on the bar's own scrollport, at three widths, printed as numbers
// and failed on rather than eyeballed in a shot. The founder's own screen is
// 1920x893 (measured 2026-08-28, in the mount's placeBar note); 1440 and 1280
// are the ordinary laptops either side of it.

// Playwright is resolved out of G:/Wright-HQ, which is this repo's standing
// convention for the shot runners (see qa-shots/shoot.mjs) — the site does not
// carry a browser as a dependency and should not start.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const PORT = Number(process.argv[2] ?? 4318);
const OUT = process.argv[3] ?? "qa-shots/arena";
const base = `http://127.0.0.1:${PORT}/qa-shots/cockpit-harness.html`;

mkdirSync(OUT, { recursive: true });

/** The founder's own screen, and the two ordinary laptops either side of it. */
const WIDTHS = [
  { name: "1920", width: 1920, height: 893 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
];

const failures = [];
const note = (ok, line) => { console.log(`${ok ? "  ok  " : "  FAIL"} ${line}`); if (!ok) failures.push(line); };

const browser = await chromium.launch();

async function open(fixture, size) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  page.on("pageerror", (e) => { failures.push(`${fixture}@${size.name}: page error — ${e.message}`); });
  await page.goto(`${base}?fixture=${fixture}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cockpitReady);
  return page;
}

/** The bar's own scrollport, measured. A row that fits has scrollWidth equal to
 *  clientWidth; anything more is content off the edge. */
const measureBar = (page) => page.evaluate(() => {
  const bar = document.querySelector(".pmc-bar");
  if (!bar) return null;
  const seats = [...bar.querySelectorAll(".pmc-slot")].map((s) => s.getAttribute("data-action") ?? (s.hasAttribute("data-fold") ? "···" : "?"));
  const body = document.documentElement;
  return {
    scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth,
    overflow: bar.scrollWidth - bar.clientWidth,
    seats,
    pageScrolls: body.scrollWidth > body.clientWidth,
  };
});

console.log("\n── (3) THE FOLD: zero horizontal scroll at ordinary laptop widths ──");
for (const size of WIDTHS) {
  const page = await open("vault", size);
  const m = await measureBar(page);
  console.log(`  ${size.name}  seats=[${m.seats.join(" ")}]  scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth} overflow=${m.overflow}`);
  note(m.overflow <= 1, `${size.name}: the verb row does not scroll (overflow ${m.overflow}px)`);
  note(!m.pageScrolls, `${size.name}: the page itself does not scroll sideways`);
  // THE TRIM, seen: neither hidden seat is on the row or in the tray.
  note(!m.seats.includes("leave-mark") && !m.seats.includes("note-to-self"),
    `${size.name}: the claiming and note seats are hidden in the dungeon`);
  // THE GATE, seen: the spoils seat is absent while the fight is afoot.
  note(!m.seats.includes("loot"), `${size.name}: the phase-gated seat is absent while the fight is afoot`);
  await page.screenshot({ path: join(OUT, `fold-vault-${size.name}.png`) });
  await page.close();
}

console.log("\n── (2) THE GATE: the same room, spent ──");
{
  const page = await open("spent", WIDTHS[1]);
  const m = await measureBar(page);
  console.log(`  spent seats=[${m.seats.join(" ")}]  overflow=${m.overflow}`);
  note(m.seats.includes("loot"), "the phase-gated seat arrives with the phase that is its whole precondition");
  note(m.overflow <= 1, `and the row still does not scroll (overflow ${m.overflow}px)`);
  await page.screenshot({ path: join(OUT, "gate-spent-1440.png") });
  await page.close();
}

console.log("\n── (1) TARGETING: press the act, the thing lights up ──");
{
  const page = await open("vault", WIDTHS[1]);
  // press an aimable seat
  await page.click('.pmc-slot[data-action="strike"]');
  await page.waitForSelector(".pmc-aim");
  const armed = await page.evaluate(() => ({
    seatArmed: Boolean(document.querySelector('.pmc-slot[data-action="strike"].armed')),
    strip: document.querySelector(".pmc-aim")?.textContent.replace(/\s+/g, " ").trim(),
    rings: document.querySelectorAll(".pmc-aim-ring").length,
    ringTitles: [...document.querySelectorAll(".pmc-aim-ring title")].map((t) => t.textContent),
    chips: [...document.querySelectorAll(".pmc-aim [data-aim-at]")].map((b) => b.textContent.trim()),
    noPanel: !document.querySelector("[data-form]"),
    crosshair: document.documentElement.classList.contains("pmc-aiming"),
  }));
  console.log(`  strip: ${armed.strip}`);
  console.log(`  rings on the painting: ${armed.rings} — ${armed.ringTitles.join(" | ")}`);
  console.log(`  chips for unplaced targets: ${armed.chips.join(" | ") || "(none)"}`);
  note(armed.seatArmed, "the seat says it is armed");
  note(armed.noPanel, "and no panel opened — the question is on the map");
  note(armed.rings >= 2, "the adversary and the thing on the floor are both lit");
  note(armed.chips.length >= 1, "and the downed ally the answer could not place is offered by name");
  note(armed.crosshair, "the painting takes a crosshair");
  await page.screenshot({ path: join(OUT, "aim-armed-1440.png") });

  // clicking the adversary finishes the act
  const where = await page.evaluate(() => {
    const t = [...document.querySelectorAll(".pmc-aim-ring")].find((g) => /cake/.test(g.querySelector("title")?.textContent ?? ""));
    const b = t.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.click(where.x, where.y);
  await page.waitForTimeout(400);
  // ⚑ THE TARGET CLICK NO LONGER DISPATCHES (governing ruling, 2026-08-29):
  // "in both cases, the next step IS the right side panel popup … and the
  // CONFIRM button to actually do the action." So the click OPENS the panel
  // with the target in its TO row, and the door hears nothing until confirm.
  const staged = await page.evaluate(() => ({
    sent: document.getElementById("note")?.textContent ?? "",
    stillArmed: Boolean(document.querySelector(".pmc-aim")),
    panel: Boolean(document.querySelector("[data-form]")),
    rows: [...document.querySelectorAll(".pmc-flow-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()),
  }));
  console.log(`  panel rows: ${staged.rows.join(" | ")}`);
  note(staged.panel, "the target click opens the confirm panel");
  note(!staged.stillArmed, "and the crosshair is put down once the target is taken");
  note(!/"do":/.test(staged.sent), "the door has heard nothing yet");
  note(staged.rows.some((r) => /^to/i.test(r) && /unlit cake/.test(r)),
    "the TO row names what was clicked");
  await page.screenshot({ path: join(OUT, "aim-panel-1440.png") });
  // …and CONFIRM is what sends it
  await page.click(".pmc-btn.go");
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    sent: document.getElementById("note")?.textContent ?? "",
    threw: document.querySelectorAll(".pmc-die").length,
  }));
  console.log(`  dispatched: ${after.sent.replace(/\s+/g, " ").slice(0, 160)}`);
  note(/"do": "strike"/.test(after.sent), "confirm is what sends the act, named");
  note(/the-unlit-cake/.test(after.sent), "carrying the thing that was clicked as its object");
  note(after.threw > 0, "the throw is shown");
  await page.screenshot({ path: join(OUT, "aim-sent-1440.png") });
  await page.close();
}

console.log("\n── (1b) the adversary opens nothing when nothing is armed ──");
{
  const page = await open("vault", WIDTHS[1]);
  const at = await page.evaluate(() => {
    const g = document.querySelector(".pmc-adversary");
    const b = g.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(250);
  const opened = await page.evaluate(() => ({
    menu: Boolean(document.querySelector(".pmc-ctx")),
    panel: Boolean(document.querySelector("[data-form]")),
    walked: /"do": "walk"/.test(document.getElementById("note")?.textContent ?? ""),
  }));
  note(!opened.menu, "no menu — the entity reading wins in a fight");
  note(!opened.panel, "and no panel either");
  note(!opened.walked, "and the click did not fall through and arm a walk into the thing");
  await page.screenshot({ path: join(OUT, "adversary-click-1440.png") });
  await page.close();
}

console.log("\n── (1c) a loose thing is picked up by clicking it ──");
{
  const page = await open("vault", WIDTHS[1]);
  const at = await page.evaluate(() => {
    const g = document.querySelector(".pmc-loose");
    const b = g.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(350);
  const sent = await page.evaluate(() => document.getElementById("note")?.textContent ?? "");
  console.log(`  dispatched: ${sent.replace(/\s+/g, " ").slice(0, 160)}`);
  note(/"do": "take"/.test(sent), "one click, one take — no menu and no panel in between");
  note(/the-long-knife/.test(sent), "carrying the thing that was on the floor");
  await page.screenshot({ path: join(OUT, "floor-take-1440.png") });
  await page.close();
}

console.log("\n── (4) THE HOVER: game-speak, not a debug panel ──");
{
  const page = await open("vault", WIDTHS[1]);
  await page.hover('.pmc-slot[data-action="strike"]');
  await page.waitForTimeout(150);
  const card = await page.evaluate(() => {
    const c = document.querySelector("#pmc-card");
    return { hidden: c.hidden, text: c.textContent.replace(/\s+/g, " ").trim(), chars: c.textContent.trim().length };
  });
  console.log(`  card (${card.chars} chars): ${card.text}`);
  note(!card.hidden, "the card shows");
  note(/d20 vs 8 to hit/.test(card.text), "and leads with the throw and the number to beat, in one sentence");
  note(!/to_hit_die|damage_die|beats_ac/.test(card.text), "with no struct keys anywhere on it");
  note(card.chars < 420, `and it is short enough to read at a glance (${card.chars} chars)`);
  // the seat's own line, too
  const dial = await page.textContent('.pmc-slot[data-action="strike"] .pmc-dial');
  console.log(`  seat line: ${dial}`);
  note(!/_die|_ac/.test(dial ?? ""), "the seat's line is game-speak too");
  await page.screenshot({ path: join(OUT, "hover-card-1440.png") });

  // an act with no dials says nothing rather than showing an empty caption
  await page.hover('.pmc-slot[data-action="say"]');
  await page.waitForTimeout(150);
  const bare = await page.evaluate(() => document.querySelector("#pmc-card").textContent);
  note(!/undefined|null|dials/.test(bare), "an act with no dials shows no dial line at all");
  await page.close();
}

console.log("\n── (5) THE CONSENT SHEET ──");
{
  const page = await open("portal", WIDTHS[1]);
  // ⚑ THE TRAY IS CHECKED HERE EVEN THOUGH THE CROSSING ACT NO LONGER LIVES IN
  // IT. It did when this was written — the keep list was the founder's three —
  // and the conductor's addendum seated it on the row, which is why the click
  // below goes to the seat. The tray still has to work, so it is still opened
  // and read; what it holds is now the acts that genuinely travel with you.
  // ⚑ THE TRAY MAY BE EMPTY NOW, and that is the fold working rather than
  // failing. With walk/say/enter/exit/give/take all kept by ruling and the two
  // hidden seats hidden, a dungeon ground has nothing LEFT to fold — so the
  // overflow seat is absent, which is the honest rendering of "nothing folded".
  // The tray is still exercised wherever there is something in it.
  const foldSeat = await page.$("[data-fold]");
  if (foldSeat) {
    await foldSeat.click();
    await page.waitForSelector(".pmc-tray");
    const trayRows = await page.evaluate(() =>
      [...document.querySelectorAll(".pmc-tray button")].map((b) => b.getAttribute("data-action")));
    console.log(`  tray holds: ${trayRows.join(" ")}`);
    note(trayRows.length > 0, "where a tray exists it holds what folded, reachable by name");
    await page.screenshot({ path: join(OUT, "tray-open-1440.png") });
    await page.keyboard.press("Escape");
  } else {
    console.log("  tray: absent — nothing folded on this ground");
    note(true, "no overflow seat where nothing folded");
  }
  note(await page.$('.pmc-slot[data-action="enter"]') !== null,
    "and the crossing act is on the row, where the founder needs it");
  await page.click('.pmc-slot[data-action="enter"]');
  await page.waitForSelector("[data-form]");
  await page.waitForTimeout(400); // the shadow read's own delay
  const sheet = await page.evaluate(() => {
    const f = document.querySelector("[data-form]");
    return {
      isSheet: f.classList.contains("pmc-sheet"),
      flavor: f.querySelector(".flavor")?.textContent?.trim() ?? null,
      brief: [...f.querySelectorAll(".pmc-terms .pmc-term")].map((s) => s.textContent.replace(/\s+/g, " ").trim()),
      folded: Boolean(f.querySelector(".pmc-terms details")),
      fine: Boolean(f.querySelector("details.pmc-fine")),
      chars: f.textContent.trim().replace(/\s+/g, " ").length,
    };
  });
  console.log(`  flavor: ${sheet.flavor}`);
  console.log(`  terms on the face: ${sheet.brief.join(" | ")}`);
  console.log(`  whole panel: ${sheet.chars} chars`);
  note(sheet.isSheet, "a panel delivering terms is dressed as a consent sheet");
  note(Boolean(sheet.flavor), "the door's own flavor line leads, prominently");
  note(sheet.brief.length > 0, "and the terms that fit on a line are on the face of it");
  note(sheet.fine, "the grammar is one press away rather than in front of the button");
  await page.screenshot({ path: join(OUT, "consent-sheet-1440.png") });
  await page.close();
}

console.log("\n── (6) THE WALK GRID ──");
{
  const page = await open("stride", WIDTHS[1]);
  // a click on bare ground, deliberately off a whole metre
  const spot = await page.evaluate(() => {
    const svg = document.querySelector(".wv svg");
    const b = svg.getBoundingClientRect();
    return { x: b.x + b.width * 0.34, y: b.y + b.height * 0.42 };
  });
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(250);
  const armed = await page.evaluate(() => {
    const b = document.querySelector(".wv .stand");
    return { minted: Boolean(b), left: document.querySelectorAll(".wv .stand").length };
  });
  // the mint-and-click leaves nothing behind, so what is checked is the snap
  // itself, read straight out of the module
  // the REAL field, flat on the portal block, with the vault's real 0.25
  const snapped = await page.evaluate(async () => {
    const { snapPoint, walkStep } = await import("/src/lib/world-cockpit.mjs");
    const answer = { standpoint: { portal: { id: "the-town/the-candle-vault", walk_min_step: 0.25 } } };
    return { step: walkStep(answer), at: snapPoint({ x: 1083.417, y: -791.62 }, walkStep(answer)) };
  });
  console.log(`  declared stride ${snapped.step} m → (1083.417, -791.62) becomes (${snapped.at.x}, ${snapped.at.y})`);
  note(snapped.step === 0.25, "the ground's declared stride is read, flat off the portal block");
  note(snapped.at.x === 1083.5 && snapped.at.y === -791.5, "and a click lands on the lattice rather than between");
  note(armed.left === 0, "and the minted element is removed — nothing of ours is left in the viewer's DOM");
  await page.close();
}

console.log("\n── (2b) THE NARROWED REFUSAL: grey what the door named, and nothing else ──");
{
  const page = await open("gated", WIDTHS[1]);
  const seats = await page.evaluate(() =>
    [...document.querySelectorAll(".pmc-slot[data-action]")].map((s) => ({
      action: s.getAttribute("data-action"),
      cold: s.classList.contains("gated") || s.getAttribute("aria-disabled") === "true",
      label: s.getAttribute("aria-label"),
    })));
  const gate = await page.textContent(".pmc-gate").catch(() => null);
  for (const s of seats) console.log(`  ${s.cold ? "COLD" : "live"}  ${s.action}`);
  console.log(`  gate line: ${gate}`);
  // THE ACTS THE DOOR NAMED ARE COLD…
  for (const a of ["strike", "cast", "guard", "lift"]) {
    note(seats.find((s) => s.action === a)?.cold === true, `${a} waits for the wheel`);
  }
  // …AND THE ONES IT DID NOT ARE LIVE. This is the whole addendum: the founder
  // could not walk out of a room whose door would have let him walk.
  for (const a of ["walk", "say", "exit"]) {
    note(seats.find((s) => s.action === a)?.cold === false, `${a} is not the wheel's business and stays live`);
  }
  note(/wait for it/.test(gate ?? ""), "and the line above the bar names what is waiting rather than reading as a flat refusal");
  await page.screenshot({ path: join(OUT, "gated-narrow-1440.png") });

  // a narrowed refusal must still refuse: clicking a cold seat does nothing
  await page.click('.pmc-slot[data-action="strike"]', { force: true });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    armed: Boolean(document.querySelector(".pmc-aim")),
    panel: Boolean(document.querySelector("[data-form]")),
  }));
  note(!after.armed && !after.panel, "and a cold seat still cannot be pressed");
  // …while a live one can
  await page.click('.pmc-slot[data-action="say"]');
  await page.waitForTimeout(200);
  const spoke = await page.evaluate(() => Boolean(document.querySelector("[data-form], .pmc-chat")));
  note(spoke, "while a seat the door left alone opens as it always did");
  await page.close();
}

console.log("\n── (3b) THE WEAPON: the third of his sentence ──");
{
  const page = await open("armed", WIDTHS[1]);
  await page.hover('.pmc-slot[data-action="strike"]');
  await page.waitForTimeout(150);
  const said = await page.evaluate(() => ({
    card: document.querySelector("#pmc-card").textContent.replace(/\s+/g, " ").trim(),
    strikeSeat: document.querySelector('.pmc-slot[data-action="strike"] .pmc-dial')?.textContent ?? "",
    castSeat: document.querySelector('.pmc-slot[data-action="cast"] .pmc-dial')?.textContent ?? "",
  }));
  console.log(`  card: ${said.card}`);
  console.log(`  strike seat: ${said.strikeSeat}`);
  console.log(`  cast seat:   ${said.castSeat}`);
  note(/\+3 with the good lighter/.test(said.card), "the hover carries the third of the founder's sentence");
  note(!/\+3/.test(said.castSeat), "and the other damage act claims no help it was not given");
  note(!/the the/.test(said.card), "the id's own article is not doubled");
  // ⚑ AND THIS IS THE RECORD'S OWN WORD ATTACHING IT, not a name of ours. The
  // site's stopgap is deleted, so a bonus appearing on this seat is the record
  // saying so — and the fixture spells it `augments`, the ruled name, which the
  // office has not pushed yet. So this shot is also the proof that the page is
  // ready for the rename BEFORE it lands, rather than after somebody notices
  // the hover went blank.
  note(/a flame that has never once gone out on the way over/.test(said.card),
    "and the weapon's own words are on it — the half of the hover with a voice");
  await page.screenshot({ path: join(OUT, "weapon-hover-1440.png") });
  await page.close();
}

console.log("\n── (6b) THE STRIDE: no lattice where no ground declared one ──");
{
  // THE DEFECT THIS GUARDS, and it was the site's: a one-metre floor snapped
  // every click-to-walk in the world onto whole metres, which is not what the
  // town does. The office refused the same floor on its own side.
  const page = await open("vault", WIDTHS[1]);
  const plain = await page.evaluate(async () => {
    const { snapPoint, walkStep } = await import("/src/lib/world-cockpit.mjs");
    const a = { standpoint: { portal: { id: "x/y" } } };
    return { step: walkStep(a), at: snapPoint({ x: 1083.417, y: -791.62 }, walkStep(a)) };
  });
  console.log(`  undeclared: step=${plain.step} → (${plain.at.x}, ${plain.at.y})`);
  note(plain.step === null, "a ground that has said nothing says nothing");
  note(plain.at.x === 1083.417 && plain.at.y === -791.62, "and the click the reader made is the point that is sent");
  await page.close();
}

console.log("\n── (1c) ENTER holds a seat now (conductor's ruling) ──");
{
  const page = await open("portal", WIDTHS[1]);
  const onRow = await page.evaluate(() =>
    [...document.querySelectorAll(".pmc-bar .pmc-slot[data-action]")].map((s) => s.getAttribute("data-action")));
  console.log(`  row: ${onRow.join(" ")}`);
  note(onRow.includes("enter"), "the way in is on the bar rather than behind the tray");
  note(onRow.includes("exit"), "beside the way out, which is its pair in the record");
  const m = await measureBar(page);
  note(m.overflow <= 1, `and the row still does not scroll (overflow ${m.overflow}px)`);
  await page.screenshot({ path: join(OUT, "enter-seated-1440.png") });
  await page.close();
}

console.log("\n── the town, outside portal ground: nothing changed ──");
{
  const page = await open("town", WIDTHS[1]);
  const there = await page.evaluate(() => ({
    mounted: window.__cockpitReady.mounted,
    anyPmc: document.querySelectorAll("[data-pmc]").length,
    style: Boolean(document.getElementById("pmc-style")),
  }));
  note(!there.mounted && there.anyPmc === 0, "the cockpit still does not appear on ordinary town ground");
  await page.close();
}

await browser.close();

console.log(`\n${failures.length ? `${failures.length} FAILED:` : "all checks passed"}`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
