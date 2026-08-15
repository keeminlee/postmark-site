// Rendered QA for the /replay/ transport — the play/pause clock added 2026-08-15.
//
// What this pass has to prove, and why each one is here rather than assumed:
//
//  • THE VIEWER IS NEVER REMOUNTED. The whole point of the 08-14 perf bundle was
//    that a scrub swaps the lens's data and asks the viewer to look again; a play
//    loop that crossed a crossing boundary by remounting would undo it silently
//    and only show up as a second of lag. So a deep node inside the viewer is
//    stashed on window BEFORE play and compared by identity after — `===`, not a
//    selector match, because a rebuilt DOM answers the same selector.
//  • PLAY ADVANCES WITH NOBODY TOUCHING IT. The only interaction after the play
//    click is waiting.
//  • PAUSE FREEZES IT. The town's clock is read twice across a wait.
//  • THE SPEED PICKER CHANGES THE PACE. Measured as town-milliseconds per real
//    millisecond, which is exactly what the control claims to set.
//  • THE TOUR DOES NOT COME BACK. It greeted every spectator on every remount
//    before the bundle; a boundary crossing is the new place that could bring it
//    back.
//
// Playwright is resolved out of G:/Wright-HQ (this repo does not carry it), same
// as qa-shots/shoot.mjs next door.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4399";
const OUT = join(process.cwd(), "qa-shots", "replay-play");
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
// 420px is the brief's narrow: wide enough to be a real phone, narrow enough
// that a six-chip speed picker has to wrap rather than overflow.
const NARROW = { width: 420, height: 900 };

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  ${detail}`);
};

const clock = (page) => page.evaluate(() => window.__pmReplayClock());
// The transport sits under a 72vh map, so a viewport shot of the top of the page
// proves nothing about the control being tested. Every shot scrolls the scrubber
// into view first — which is also where a reader watching a replay would be.
async function shot(page, name) {
  await page.locator(".r-scrub").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, name + ".png"), fullPage: false });
}

// WorldTourHold already skips the greeting on this surface, so the card exists
// in the DOM and is never shown. Clicking a hidden skip button times out, which
// is why this asks about VISIBILITY rather than presence — and why the respawn
// check below counts visible cards, not nodes.
const VISIBLE_TOURS = () =>
  [...document.querySelectorAll(".wv-tour-card")]
    .filter((c) => !c.hidden && c.getBoundingClientRect().width > 0).length;

async function dismissTour(page) {
  const card = page.locator(".wv-tour-card");
  if (await card.count() && await card.first().isVisible()) {
    await page.locator(".wv-tour-skip").first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

// The identity receipt. Stash the host and a node the viewer built inside it,
// then ask later whether the very same objects are still in the document.
//
// The map's own <svg> is reached THROUGH the walk layer rather than by document
// order: `#replay-map svg` also matches icon glyphs in the viewer's nav, and the
// nav is written with innerHTML, so that selector reports a fresh node after any
// redraw and would read as a remount that never happened.
const mapSvg = () => {
  const layer = document.querySelector("#wv-walk-layer");
  return layer ? layer.closest("svg") : null;
};
const STASH = () => {
  window.__qa = {
    host: document.querySelector("#replay-map"),
    layer: document.querySelector("#wv-walk-layer"),
    svg: (() => { const l = document.querySelector("#wv-walk-layer"); return l ? l.closest("svg") : null; })(),
    mounts: window.__pmReplayMounts,
  };
  return {
    haveLayer: !!window.__qa.layer,
    haveSvg: !!window.__qa.svg,
    mounts: window.__qa.mounts,
  };
};
const SAME = () => ({
  host: document.querySelector("#replay-map") === window.__qa.host,
  layer: document.querySelector("#wv-walk-layer") === window.__qa.layer,
  svg: (() => { const l = document.querySelector("#wv-walk-layer"); return l ? l.closest("svg") : null; })() === window.__qa.svg,
  layerInDoc: window.__qa.layer ? document.contains(window.__qa.layer) : null,
  mountsBefore: window.__qa.mounts,
  mountsNow: window.__pmReplayMounts,
  tours: [...document.querySelectorAll(".wv-tour-card")]
    .filter((c) => !c.hidden && c.getBoundingClientRect().width > 0).length,
});

const browser = await chromium.launch();
const errors = [];

async function open(viewport, url) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${url}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${url}: pageerror ${e.message}`));
  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await page.waitForSelector("#wv-walk-layer", { state: "attached", timeout: 60000 }).catch(() => {});
  await dismissTour(page);
  await page.waitForTimeout(600);
  return page;
}

// ── desktop: the whole transport ──────────────────────────────────────────────
{
  // 119 is the busy crossing (59 recorded moments), so a playhead has something
  // to walk down; 50× is the default the page ships with.
  const page = await open(DESKTOP, "/replay/?crossing=119");
  const stashed = await page.evaluate(STASH);
  const boot = await clock(page);
  record("desktop: opens at the asked-for crossing, default 50x, not playing",
    boot.crossing === 119 && boot.speed === 50 && boot.playing === false,
    JSON.stringify(boot));
  record("desktop: the crossing's moments are on the rail", boot.beats === 59, `beats=${boot.beats} (record says 59)`);
  await shot(page, "desktop-01-idle-50x");

  // PLAY, then nothing but waiting.
  await page.click("[data-play]");
  const t0 = await clock(page);
  await page.waitForTimeout(2500);
  const t1 = await clock(page);
  await shot(page, "desktop-02-playing");
  record("desktop: play advances the town's clock with no further input",
    t1.playing === true && t1.t > t0.t,
    `+${Math.round((t1.t - t0.t) / 1000)}s of town time over 2.5s of ours`);

  // A HALF-DAY IS MOSTLY QUIET. 119's first recorded moment is an hour and three
  // quarters into a twelve-hour crossing, so at the default 50× nothing has
  // arrived yet after five seconds — correctly, and the rail says so. Watching
  // moments ARRIVE therefore needs the fast end of the picker, which is what
  // 1000× is in the control for.
  const waiting = (await page.locator("[data-rail-note]").textContent()) || "";
  record("desktop: a quiet stretch says what it is waiting for",
    /next moment/.test(waiting), `rail says "${waiting.trim()}"`);
  // changing pace does not stop the clock — it is still the same play
  const aheadMid = await page.locator(".r-voice.is-ahead, .r-move.is-ahead").count();
  await page.click('.r-speed >> text="1000×"');
  await page.waitForTimeout(12000);
  const t2 = await clock(page);
  const aheadLate = await page.locator(".r-voice.is-ahead, .r-move.is-ahead").count();
  record("desktop: moments arrive in sequence as the clock passes them",
    aheadLate < aheadMid,
    `rows still ahead: ${aheadMid} → ${aheadLate} of ${boot.beats}, clock at ${new Date(t2.t).toISOString()}`);
  await shot(page, "desktop-03-playing-later");

  // PAUSE, and the clock must stop dead.
  await page.click("[data-play]");
  const p0 = await clock(page);
  await page.waitForTimeout(2500);
  const p1 = await clock(page);
  record("desktop: pause freezes the clock", p1.playing === false && p1.t === p0.t,
    `t ${p0.t} → ${p1.t}`);
  await shot(page, "desktop-04-paused");

  // THE SPEED PICKER. Town-milliseconds per real millisecond, twice.
  async function pace(label) {
    await page.click(`.r-speed >> text="${label}"`);
    await page.click("[data-play]");
    const a = await clock(page); const wallA = Date.now();
    await page.waitForTimeout(2000);
    const b = await clock(page); const wallB = Date.now();
    await page.click("[data-play]");
    return (b.t - a.t) / Math.max(1, wallB - wallA);
  }
  const slow = await pace("1×");
  await shot(page, "desktop-05-speed-1x");
  const fast = await pace("1000×");
  await shot(page, "desktop-06-speed-1000x");
  record("desktop: the speed picker changes the pace",
    fast > slow * 50,
    `1× ran at ${slow.toFixed(1)}x wall, 1000× ran at ${fast.toFixed(0)}x wall`);

  // STEP mode: the page as it was, no clock at all.
  await page.click('.r-speed >> text="step"');
  const st = await clock(page);
  const railHidden = await page.locator("[data-rail]").isHidden();
  const playDisabled = await page.locator("[data-play]").isDisabled();
  record("desktop: step mode puts the clock away", st.speed === 0 && st.t === null && railHidden && playDisabled,
    `speed=${st.speed} t=${st.t} rail hidden=${railHidden} play disabled=${playDisabled}`);
  await shot(page, "desktop-07-step-mode");

  // A MANUAL SCRUB PAUSES. Back to 50×, play, then press the arrow.
  await page.click('.r-speed >> text="50×"');
  await page.click("[data-play]");
  await page.waitForTimeout(800);
  await page.click("[data-prev]");
  await page.waitForTimeout(900);
  const scrubbed = await clock(page);
  record("desktop: a manual scrub pauses instantly",
    scrubbed.playing === false && scrubbed.crossing === 118,
    JSON.stringify(scrubbed));
  await shot(page, "desktop-08-scrub-paused");

  // THE RECEIPT, after all of that: same nodes, one mount, no tour.
  const same = await page.evaluate(SAME);
  record("desktop: the viewer was never remounted (sameNode)",
    same.host && same.layer && same.svg && same.layerInDoc && same.mountsNow === same.mountsBefore,
    JSON.stringify(same));
  record("desktop: the tour did not come back", same.tours === 0, `tour nodes=${same.tours}`);

  // THE URL carries the moment.
  const url = await page.evaluate(() => location.search);
  record("desktop: the moment is linkable", /crossing=118/.test(url) && /speed=50/.test(url), url);
  await page.close();
}

// ── the crossing boundary, played through ────────────────────────────────────
// 127 holds one moment and twelve hours; at 1000× that is about 43 seconds of
// real time, which is the price of watching the ferry sail for real rather than
// simulating the boundary by clicking next.
{
  const page = await open(DESKTOP, "/replay/?crossing=127&speed=1000");
  const stashed = await page.evaluate(STASH);
  const before = await clock(page);
  await shot(page, "desktop-09-boundary-before");
  await page.click("[data-play]");
  let crossed = false;
  for (let i = 0; i < 80 && !crossed; i++) {
    await page.waitForTimeout(1000);
    const c = await clock(page);
    if (c.crossing !== before.crossing) crossed = true;
  }
  const after = await clock(page);
  await shot(page, "desktop-10-boundary-after");
  record("boundary: play carries on into the next crossing by itself",
    crossed && after.crossing > before.crossing,
    `${before.crossing} → ${after.crossing}, still playing=${after.playing}`);
  const same = await page.evaluate(SAME);
  record("boundary: the viewer survived the swap (sameNode across frames)",
    same.host && same.layer && same.svg && same.layerInDoc && same.mountsNow === same.mountsBefore,
    JSON.stringify(same));
  record("boundary: no tour respawn across the swap", same.tours === 0, `tour nodes=${same.tours}`);

  // and run it to the end of the record — it must stop at now, not spin.
  for (let i = 0; i < 120; i++) {
    const c = await clock(page);
    if (!c.playing) break;
    await page.waitForTimeout(1000);
  }
  const end = await clock(page);
  const note = await page.locator("[data-rail-note]").textContent();
  record("boundary: reaching the end of the record stops at now",
    end.playing === false,
    `stopped on crossing ${end.crossing}, rail says "${(note || "").trim()}"`);
  await shot(page, "desktop-11-stopped-at-now");
  await page.close();
}

// ── narrow ────────────────────────────────────────────────────────────────────
{
  const page = await open(NARROW, "/replay/?crossing=119&speed=250");
  await page.evaluate(STASH);
  const boot = await clock(page);
  record("narrow: the link's speed is honoured", boot.speed === 250, JSON.stringify(boot));
  await page.locator("[data-rail]").scrollIntoViewIfNeeded();
  await shot(page, "narrow-01-transport");
  await page.click("[data-play]");
  const t0 = await clock(page);
  await page.waitForTimeout(3000);
  const t1 = await clock(page);
  record("narrow: play advances", t1.playing && t1.t > t0.t, `+${Math.round((t1.t - t0.t) / 1000)}s of town time over 3s of ours`);
  await shot(page, "narrow-02-playing");
  await page.click("[data-play]");
  await page.waitForTimeout(1500);
  const same = await page.evaluate(SAME);
  record("narrow: the viewer was never remounted (sameNode)",
    same.host && same.layer && same.svg && same.mountsNow === same.mountsBefore,
    JSON.stringify(same));
  record("narrow: no tour respawn", same.tours === 0, `tour nodes=${same.tours}`);
  await page.screenshot({ path: join(OUT, "narrow-03-full.png"), fullPage: true });
  await page.close();
}

// ── the world page's own scrubber, untouched ─────────────────────────────────
// Nothing here edits /world/, but it shares the lens idiom and the `?crossing=`
// door, so the cheapest possible proof that it still arms is worth having in
// the same run rather than argued from the diff.
{
  const page = await open(DESKTOP, "/world/?crossing=120");
  const armed = await page.evaluate(() => ({
    caption: (document.querySelector(".wv-clock, .wv-crossing, .wv-side")?.textContent || "").slice(0, 120),
    frame: window.__pmWorldReplay ? (window.__pmWorldReplay.frame || {}).crossing : null,
    walkers: document.querySelectorAll(".wv-walker").length,
  }));
  record("world page: ?crossing= still arms its own scrubber",
    /time-travel/i.test(armed.caption) || armed.frame === 120,
    JSON.stringify(armed));
  await page.screenshot({ path: join(OUT, "world-01-armed-c120.png") });
  await page.close();
}

await browser.close();

const failed = checks.filter((c) => !c.pass);
writeFileSync(join(OUT, "checks.json"), JSON.stringify({ base: BASE, checks, errors }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (errors.length) console.log("console errors:\n  " + errors.slice(0, 8).join("\n  "));
if (failed.length) { console.log("FAILED: " + failed.map((f) => f.name).join("; ")); process.exit(1); }
