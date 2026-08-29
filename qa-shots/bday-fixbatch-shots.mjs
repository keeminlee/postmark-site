// bday-fixbatch-shots.mjs — rendered QA for the 2026-08-28 fix batch.
//
//   node qa-shots/cockpit-harness.mjs 4318 &
//   node qa-shots/bday-fixbatch-shots.mjs
//
// WHY A SHOT RUNNER AND NOT MORE UNIT TESTS. Every fix in this batch is about
// where something LANDS on a screen — a plate that sat on the site's rail, two
// pills printing on each other, an ember ring over a floor that had nothing on
// it. The repo has been caught by exactly this gap before: "the machine twin read
// the text and reported it present; the screenshot is what caught it", written
// about a name box that was in the DOM at full opacity and 239px wide with not
// one pixel of it visible. So these checks read GEOMETRY — measured rectangles,
// overlap arithmetic, computed opacity — rather than asking whether an element
// exists.
//
// Playwright is resolved out of G:/Wright-HQ, the same as the runners next door.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://127.0.0.1:4318";
const OUT = join(process.cwd(), "qa-shots", "bday-fixbatch");
mkdirSync(OUT, { recursive: true });

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

const shot = async (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });

/** Do two client rects overlap? The whole of items 1 and 3 is that certain pairs
 *  must not, so it is asked in arithmetic rather than looked for by eye. */
const overlaps = (a, b) =>
  !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el || !el.getClientRects().length) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
}, sel);

async function open(page, fixture) {
  await page.goto(`${BASE}/qa-shots/cockpit-harness.html?fixture=${fixture}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__cockpitReady, null, { timeout: 10_000 });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// ── 1 · the standpoint plate is a hover reveal on the dock ─────────────────
await open(page, "vault");
await shot(page, "01-vault-at-rest");

const hereHidden = await page.evaluate(() => {
  const el = document.querySelector(".pmc-here");
  if (!el) return { present: false };
  return { present: true, opacity: Number(getComputedStyle(el).opacity) };
});
record("the standpoint plate is invisible until the dock is hovered",
  hereHidden.present && hereHidden.opacity === 0,
  `present=${hereHidden.present} opacity=${hereHidden.opacity}`);

await page.hover(".pmc-roster");
await page.waitForTimeout(250);
await shot(page, "02-here-plate-on-dock-hover");

const hereShown = await page.evaluate(() => {
  const el = document.querySelector(".pmc-here");
  return { opacity: Number(getComputedStyle(el).opacity), text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 80) };
});
record("hovering the dock reveals it", hereShown.opacity === 1, `opacity=${hereShown.opacity} · "${hereShown.text}"`);

// IT MUST BE INSIDE THE PAINTING. The bug it replaces was a card printing on the
// site's own left rail, so the assertion is against the painting's rect, not
// against a corner number.
const hereBox = await rect(page, ".pmc-here");
const paintBox = await rect(page, ".wv svg");
record("and it sits inside the painting rather than on the page's furniture",
  !!hereBox && !!paintBox && hereBox.left >= paintBox.left - 1,
  `plate.left=${hereBox?.left?.toFixed(1)} paint.left=${paintBox?.left?.toFixed(1)}`);

// ⚑ SUPERSEDED 2026-08-29, founder-ruled. This checked that hovering a FACE
// showed the small name box AND the plate without one printing over the other —
// which was the right check while both existed. The ruling deleted the small
// box ("the hover should show the orange-rimmed LARGER card, not the small
// nameplate"), so the collision it guarded against cannot happen, and what
// replaces it is the claim the ruling actually makes: hovering a face shows the
// plate, carrying THAT face's own state.
await page.hover(".pmc-face");
await page.waitForTimeout(250);
await shot(page, "03-face-hover-shows-that-fighters-plate");
const noNameBox = await page.evaluate(() => document.querySelectorAll(".pmc-nm").length);
record("the small name box is gone", noNameBox === 0, `found ${noNameBox}`);
const plate = await page.evaluate(() => {
  const el = document.querySelector(".pmc-here");
  return {
    opacity: Number(getComputedStyle(el).opacity),
    who: el.querySelector(".who")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    hp: el.querySelector(".pmc-hp .num")?.textContent?.trim() ?? null,
    kit: el.querySelector(".kit")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
  };
});
record("hovering a FACE shows the plate, carrying that fighter's own state",
  plate.opacity === 1 && !!plate.who && !!plate.kit,
  `who="${plate.who}" hp="${plate.hp}" kit="${plate.kit}"`);

// ── 3 · the row clears the viewer's way-out pill ───────────────────────────
// The harness has no .wv-scene-exit of its own, so one is planted with the
// viewer's OWN geometry (left:14px; bottom:58px, from spectator/viewer.mjs) —
// the same trick the harness already uses for the walk desk and the coordinate
// chip, and for the same reason: without it the shot shows a collision that
// never happens, or hides one that does.
await page.evaluate(() => {
  const wv = document.querySelector(".wv");
  const box = document.createElement("div");
  box.className = "wv-scene-exit";
  box.style.cssText = "position:absolute;left:14px;bottom:58px;z-index:9;";
  box.innerHTML = '<button class="ctl" style="padding:.55em .9em;border-radius:999px;font-size:.72rem;'
    + 'color:#e8c48b;background:rgba(13,20,38,.92);border:1px solid rgba(232,196,139,.5)">'
    + '\u21a4 step outside \u2192 The Cellar Door</button>';
  wv.appendChild(box);
  window.dispatchEvent(new Event("resize"));
});
await page.waitForTimeout(300);
await shot(page, "04-row-clears-the-way-out-pill");

const exitBox = await rect(page, ".wv-scene-exit");
const rowBox = await rect(page, ".pmc-barrow");
record("the bar row lifts clear of the way-out pill",
  !overlaps(exitBox, rowBox),
  `pill top=${exitBox?.top?.toFixed(1)} bottom=${exitBox?.bottom?.toFixed(1)} · row top=${rowBox?.top?.toFixed(1)}`);
// and the pill's words are all still on screen
const exitReadable = await page.evaluate(() => {
  const b = document.querySelector(".wv-scene-exit .ctl");
  return b ? b.textContent.trim() : null;
});
record("and the pill still reads whole", exitReadable?.includes("step outside") && exitReadable.includes("Cellar Door"),
  `"${exitReadable}"`);

// ── 7 · the cake is on the map, with its hp ────────────────────────────────
const adv = await page.evaluate(() => {
  const g = document.querySelector(".pmc-adversary");
  if (!g) return null;
  const r = g.getBoundingClientRect();
  const bar = g.querySelector(".pmc-adv-hp");
  const rects = bar ? [...bar.querySelectorAll("rect")].map((x) => Number(x.getAttribute("width"))) : [];
  return {
    onScreen: r.width > 0 && r.height > 0,
    title: g.querySelector("title")?.textContent ?? "",
    hpTrack: rects[0] ?? null, hpFill: rects[1] ?? null,
  };
});
record("the adversary is drawn on the painting", !!adv?.onScreen, adv ? `title="${adv.title.slice(0, 60)}"` : "absent");
// 41 of 60 is the fixture's number; the bar must be that fraction and no other
record("its hp bar is the door's arithmetic, not a full bar",
  !!adv && Math.abs(adv.hpFill / adv.hpTrack - 41 / 60) < 0.01,
  `fill/track=${adv ? (adv.hpFill / adv.hpTrack).toFixed(4) : "—"} expected=${(41 / 60).toFixed(4)}`);

// THE JOIN, PROVED ON SCREEN: the ring must be on the CAKE's coordinates, not on
// the lighter's, which is the first thing in `nearby`.
const ringAt = await page.evaluate(() => {
  const g = document.querySelector(".pmc-adversary");
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute("transform"));
  return { x: Number(m[1]), y: Number(m[2]) };
});
// world (1097,-783.5) → atlas: 485 + 1097/5, 760 + (-783.5/5)
record("and it is on the cake's own coordinates, not the first thing in nearby",
  Math.abs(ringAt.x - (485 + 1097 / 5)) < 0.01 && Math.abs(ringAt.y - (760 - 783.5 / 5)) < 0.01,
  `ring at (${ringAt.x}, ${ringAt.y}) · cake at (${485 + 1097 / 5}, ${760 - 783.5 / 5}) · lighter at (${485 + 1095.5 / 5}, ${760 - 784 / 5})`);
await shot(page, "05-the-cake-with-its-hp");

// ── 4b · speech lands where it was spoken ──────────────────────────────────
const voices = await page.evaluate(() => [...document.querySelectorAll(".pmc-voice")].map((g) => ({
  text: [...g.querySelectorAll("text")].map((t) => t.textContent).join(" | "),
  opacity: Number(g.getAttribute("opacity")),
  onScreen: g.getBoundingClientRect().width > 0,
})));
record("recent speech is drawn on the map", voices.length === 2, `${voices.length} voices: ${voices.map((v) => v.text).join(" / ")}`);
// the older line is fainter — the door's own fade, made visible
record("and an older line is fainter than a newer one",
  voices.length === 2 && voices[0].opacity < voices[1].opacity,
  voices.map((v) => v.opacity.toFixed(3)).join(" then "));
await shot(page, "06-speech-on-the-map");

// ── 4a · say opens a chat line, not a form ─────────────────────────────────
await page.click('.pmc-slot[data-action="say"]');
await page.waitForTimeout(250);
await shot(page, "07-say-is-a-chat-line");
const chat = await page.evaluate(() => {
  const c = document.querySelector(".pmc-chat");
  if (!c) return null;
  return {
    field: c.getAttribute("data-chat"),
    focused: document.activeElement === c.querySelector("input"),
    isForm: !!document.querySelector(".pmc-form"),
    maxlength: c.querySelector("input")?.getAttribute("maxlength"),
  };
});
record("the speaking act opens a chat line and not a form",
  !!chat && !chat.isForm && chat.field === "text", chat ? `field=${chat.field} form=${chat.isForm}` : "no chat line");
record("the cursor is already in it", !!chat?.focused, `focused=${chat?.focused}`);
record("and it honours the limit the door stated", chat?.maxlength === "500", `maxlength=${chat?.maxlength}`);

// ENTER SENDS, and the line comes back on the map beside the speaker.
await page.keyboard.type("four hundred candles and not one lit");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
await shot(page, "08-chat-sent-and-on-the-map");
const afterSend = await page.evaluate(() => ({
  cleared: document.querySelector(".pmc-chat input")?.value === "",
  stillOpen: !!document.querySelector(".pmc-chat"),
  onMap: [...document.querySelectorAll(".pmc-voice text")].some((t) => t.textContent.includes("four hundred candles")),
}));
record("ENTER sends it, the line empties, and the chat stays open",
  afterSend.cleared && afterSend.stillOpen, `cleared=${afterSend.cleared} open=${afterSend.stillOpen}`);
record("and what was said arrives on the map beside the speaker", afterSend.onMap, `onMap=${afterSend.onMap}`);

await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ── 5 · a form with nothing left to type ───────────────────────────────────
await page.click('.pmc-slot[data-action="guard"]');
await page.waitForTimeout(250);
await shot(page, "09-nothing-left-to-type");
const guard = await page.evaluate(() => {
  const f = document.querySelector(".pmc-form");
  if (!f) return null;
  return {
    says: f.textContent.includes("press ENTER to send it as it stands"),
    focusIsSend: document.activeElement === f.querySelector(".pmc-btn.go"),
  };
});
record("an act the door fills itself says so", !!guard?.says, `says=${guard?.says}`);
record("and the cursor lands on the send button, so ENTER is the next thing a hand can do",
  !!guard?.focusIsSend, `focusIsSend=${guard?.focusIsSend}`);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ── 6 · clicking a thing offers its context acts, object prefilled ─────────
const cakeScreen = await page.evaluate(() => {
  const g = document.querySelector(".pmc-adversary");
  const r = g.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.click(cakeScreen.x, cakeScreen.y);
await page.waitForTimeout(300);
await shot(page, "10-context-menu-on-the-cake");
const menu = await page.evaluate(() => {
  const m = document.querySelector(".pmc-ctx");
  if (!m) return null;
  return {
    what: m.querySelector(".what")?.textContent.replace(/\s+/g, " ").trim(),
    acts: [...m.querySelectorAll("[data-ctx-act]")].map((b) => b.getAttribute("data-ctx-act")),
  };
});
record("clicking the adversary opens its context acts", !!menu && menu.acts.length > 0,
  menu ? `${menu.what} → ${menu.acts.join(", ")}` : "no menu");

await page.click('[data-ctx-act="strike"]');
await page.waitForTimeout(300);
await shot(page, "11-strike-with-the-object-prefilled");
const prefilled = await page.evaluate(() => {
  const el = document.querySelector('.pmc-form [data-field="object"]');
  return { value: el?.value ?? null, action: document.querySelector("[data-form]")?.getAttribute("data-form") };
});
record("and the act opens with that thing already in the slot",
  prefilled.value === "the-town/the-unlit-cake",
  `${prefilled.action}.object = "${prefilled.value}"`);

// ── narrow ────────────────────────────────────────────────────────────────
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 390, height: 844 });
await open(page, "vault");
await page.waitForTimeout(400);
await shot(page, "12-vault-390");
const narrowRow = await rect(page, ".pmc-barrow");
record("at 390 the row is still inside the screen",
  !!narrowRow && narrowRow.left >= -1 && narrowRow.right <= 391,
  `row ${narrowRow?.left?.toFixed(1)}..${narrowRow?.right?.toFixed(1)}`);

await browser.close();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed · shots in qa-shots/bday-fixbatch/`);
if (failed.length) {
  console.log("FAILED:\n" + failed.map((f) => `  · ${f.name} — ${f.detail}`).join("\n"));
  process.exitCode = 1;
}
