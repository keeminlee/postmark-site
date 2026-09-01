// civic-panel-shots.mjs — rendered QA for the founder's eight, 2026-09-01.
//
//   npm run build && npm run preview -- --port 4412 &
//   node qa-shots/civic-panel-shots.mjs
//
// AGAINST THE BUILT PAGE, not the dev server, and that is the point of using
// `preview`: the snapshot lane builds code AND town data from the branch
// itself, so what `npm run preview` serves in this worktree is what dev will
// serve after the train push. A dev-server shot judges a different renderer.
//
// WHY A THIRD SHOT RUNNER beside hub-shots.mjs and civic-polish-shots.mjs.
// Those judge the quarter's ART and the 08-31 RULINGS. This one judges a
// MECHANISM: one panel that switches. Every question it asks is one no static
// pass can answer, because they are all about what a browser does with a
// fragment —
//
//   does exactly ONE panel show on arrival, and is it the Think Tank
//   does #board open the BOUNTY panel (an id nested inside it)
//   does #pots open the GUILD panel (the giver's door, linked from four pages)
//   does the selected building read selected
//   does the "?" open a real modal, step through it, and close on Escape
//
// THE TWIN IS READ BEFORE THE SCREENSHOT for civic-polish-shots.mjs's reason,
// quoted: this repo has been caught by text sitting in the DOM at opacity 1
// with a measured width of 239px and not one pixel of it on screen. A panel
// that is `display:none` and a panel that is empty are the same node count.
//
// AND THE EVIDENCE IS NOT TRUNCATED BEFORE IT IS JUDGED. The 08-31 run's own
// finding: a 160-character window cut a cite off and the check reported a
// defect that was not there. A plaque body is up to 150 characters and the
// panel head carries an eyebrow and predicates above and below it, so the text
// window here is 600.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4412";
const OUT = join(process.cwd(), "qa-shots", "civic-panel");
mkdirSync(OUT, { recursive: true });

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

// WHICH PANELS ARE ACTUALLY ON SCREEN. Not "which exist" — all five always
// exist; the whole mechanism is which one is displayed.
// EXPRESSIONS, NOT FUNCTION SOURCE. `page.evaluate("() => …")` evaluates the
// string as an EXPRESSION, so a bare arrow evaluates to the function and comes
// back `undefined` — which the first run of this file did, and the failure read
// as "no panels are showing" about a page that was showing one correctly. An
// instrument that mis-reports the page is worse than one that says nothing, so
// each of these is a self-calling expression.
const SHOWING = `(() => Array.from(document.querySelectorAll(".cq-panels > .c-lane"))
  .filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden"
      && parseFloat(cs.opacity) > 0 && r.width > 0 && r.height > 0;
  })
  .map((el) => el.id))()`;

// A building "reads selected" when its own background/border differ from a
// sibling's — asked as a COMPARISON rather than against a hex, because the
// colour is the lane's own tint and no value belongs in this file.
const SELECTED = `(() => Array.from(document.querySelectorAll(".cq-b")).map((a) => {
  const cs = getComputedStyle(a);
  return { lane: a.getAttribute("data-lane"), bg: cs.backgroundColor, border: cs.borderTopColor };
}))()`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

// ── 1 · the head, and 2 · one panel on arrival ──────────────────────────────
await page.goto(`${BASE}/town/`, { waitUntil: "load" });
await page.waitForTimeout(400);

const h1 = await page.textContent("h1");
record("item 1 · the h1 is The Civic Quarter", h1?.trim() === "The Civic Quarter", h1);

const sub = (await page.textContent(".t-sub"))?.replace(/\s+/g, " ").trim();
record("item 1 · the intro is the founder's sentence, verbatim",
  sub === "Postmark isn't just a sandbox simulation for agents. You and your agent can help us build Postmark, together. Click each of the buildings to see how.",
  sub);

const title = await page.title();
record("item 1 · the tab says the same", title === "The Civic Quarter — Postmark", title);

let showing = await page.evaluate(SHOWING);
record("item 2 · exactly ONE panel shows with no fragment", showing.length === 1, showing.join(", ") || "(none)");
record("item 2 · and it is the Think Tank", showing[0] === "ideas", showing[0] ?? "(none)");

// ── 3 · the plaque is the title, big, with no cite ──────────────────────────
const plaque = await page.evaluate(`(() => {
  const el = document.querySelector("#ideas .c-plaque");
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { text: (el.textContent || "").trim(), px: parseFloat(cs.fontSize) };
})()`);
record("item 3 · the tank's title IS its mark body, verbatim",
  plaque?.text === "Your resident can propose ideas to this town here, which others can back with stamps, and the ones that get backed get built.",
  plaque?.text);
record("item 3 · and it is really big font", (plaque?.px ?? 0) >= 24, `${plaque?.px}px`);

const cites = await page.evaluate(`document.querySelectorAll(".c-lane cite").length`);
record("item 3 · no cite line under a plaque", cites === 0, `${cites} cites`);

const preds = await page.evaluate(`Array.from(document.querySelectorAll("#ideas .c-preds li"))
  .map((li) => (li.textContent || "").replace(/\\s+/g, " ").trim())`);
record("item 3 · the tank's predicates render as slot · value", preds.length > 0, preds.join(" | "));

await page.screenshot({ path: join(OUT, "01-arrival-think-tank.png"), fullPage: false });

// ── 4 · the state, in stamp-backed order ────────────────────────────────────
const ideaCards = await page.evaluate(`Array.from(document.querySelectorAll("#ideas .m-card")).map((c) => ({
  title: (c.querySelector(".m-title")?.textContent || "").trim().slice(0, 60),
  stake: (c.querySelector(".m-stake")?.textContent || "").replace(/\\s+/g, " ").trim(),
}))`);
const stakes = ideaCards.map((c) => Number((c.stake.match(/^(\d+)/) || [])[1] ?? -1));
record("item 4 · every idea card shows its ✦ and its households",
  ideaCards.length > 0 && ideaCards.every((c) => /✦ staked · \d+ household/.test(c.stake)),
  JSON.stringify(ideaCards));
record("item 4 · and they are in descending stake order",
  stakes.every((n, i) => i === 0 || stakes[i - 1] >= n), stakes.join(" ≥ "));

// ── 5 · the dashboards ──────────────────────────────────────────────────────
const tankCounts = await page.evaluate(`Array.from(document.querySelectorAll("#ideas .d-counts li"))
  .map((li) => (li.textContent || "").replace(/\\s+/g, " ").trim())`);
record("item 5 · the tank carries a counts line", tankCounts.length >= 4, tankCounts.join(" · "));
const asOf = await page.evaluate(`Array.from(document.querySelectorAll("#ideas .n-asof, #bounty-board .n-asof"))
  .map((s) => (s.textContent || "").trim())`);
record("item 5 · every derived block is marked with its as-of", asOf.length >= 4, asOf.join(" | "));

await page.screenshot({ path: join(OUT, "02-think-tank-full.png"), fullPage: true });

// ── 2 (deep links) · #board and #pots ───────────────────────────────────────
await page.goto(`${BASE}/town/#board`, { waitUntil: "load" });
await page.waitForTimeout(500);
showing = await page.evaluate(SHOWING);
record("item 2 · #board opens the Bounty Board (the home page's milestone link)",
  showing.length === 1 && showing[0] === "bounty-board", showing.join(", ") || "(none)");
const boardVisible = await page.evaluate(`(() => {
  const el = document.getElementById("board");
  if (!el) return "missing";
  const r = el.getBoundingClientRect();
  return getComputedStyle(el).display + " " + Math.round(r.width) + "x" + Math.round(r.height);
})()`);
record("item 2 · and the #board block itself has real size", /\d{3,}x\d{2,}/.test(boardVisible), boardVisible);
await page.screenshot({ path: join(OUT, "03-board-deep-link.png"), fullPage: false });

await page.goto(`${BASE}/town/#pots`, { waitUntil: "load" });
await page.waitForTimeout(500);
showing = await page.evaluate(SHOWING);
record("item 2 · #pots opens the Quest Guild (the giver's door)",
  showing.length === 1 && showing[0] === "quests", showing.join(", ") || "(none)");

for (const [frag, want] of [["#quests", "quests"], ["#marketplace", "marketplace"], ["#ballot-house", "ballot-house"]]) {
  await page.goto(`${BASE}/town/${frag}`, { waitUntil: "load" });
  await page.waitForTimeout(350);
  showing = await page.evaluate(SHOWING);
  record(`item 2 · ${frag} opens exactly its own panel`,
    showing.length === 1 && showing[0] === want, showing.join(", ") || "(none)");
}

// ── 2 · the selected building reads selected ────────────────────────────────
await page.goto(`${BASE}/town/#marketplace`, { waitUntil: "load" });
await page.waitForTimeout(350);
const sel = await page.evaluate(SELECTED);
const chosen = sel.find((b) => b.lane === "listings");
const others = sel.filter((b) => b.lane !== "listings");
record("item 2 · the selected building is tinted and its neighbours are not",
  chosen && others.every((o) => o.bg !== chosen.bg && o.border !== chosen.border),
  `${chosen?.lane}=${chosen?.bg} vs ${others.map((o) => o.bg).join(",")}`);

// ── 6 · COMING SOON on the building AND in the panel ────────────────────────
const comingOnBuildings = await page.evaluate(`Array.from(document.querySelectorAll(".cq-lot"))
  .filter((li) => li.querySelector(".cq-coming"))
  .map((li) => li.querySelector(".cq-b").getAttribute("data-lane"))`);
record("item 6 · COMING SOON badges exactly the Marketplace and the Ballot House",
  JSON.stringify(comingOnBuildings.sort()) === JSON.stringify(["listings", "votes"]),
  comingOnBuildings.join(", "));
const comingInPanel = await page.evaluate(`(() => {
  const el = document.querySelector("#marketplace .c-coming-head");
  if (!el) return "absent";
  const r = el.getBoundingClientRect();
  return (el.textContent || "").trim() + " @ " + Math.round(r.width) + "x" + Math.round(r.height);
})()`);
record("item 6 · and the opened Marketplace panel carries it too",
  /Coming soon @ \d+x\d+/.test(comingInPanel), comingInPanel);
await page.screenshot({ path: join(OUT, "04-marketplace-coming-soon.png"), fullPage: false });

await page.goto(`${BASE}/town/#ballot-house`, { waitUntil: "load" });
await page.waitForTimeout(350);
await page.screenshot({ path: join(OUT, "05-ballot-house.png"), fullPage: false });

// ── 7 · the "?" bubble ──────────────────────────────────────────────────────
await page.goto(`${BASE}/town/#bounty-board`, { waitUntil: "load" });
await page.waitForTimeout(400);
const helps = await page.evaluate(`Array.from(document.querySelectorAll(".c-lane"))
  .filter((l) => l.querySelector(".c-help")).map((l) => l.id)`);
record("item 7 · the '?' rides exactly the three live lanes",
  JSON.stringify(helps.sort()) === JSON.stringify(["bounty-board", "ideas", "quests"]), helps.join(", "));

await page.click("#bounty-board .c-help");
await page.waitForTimeout(300);
const open1 = await page.evaluate(`(() => {
  const d = document.getElementById("tut-bounties");
  const slides = Array.from(d.querySelectorAll(".c-tut-slide"));
  const shown = slides.filter((s) => !s.hidden);
  return { open: d.open, slides: slides.length,
           showing: shown.length, step: (shown[0]?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160) };
})()`);
record("item 7 · the bubble opens a real modal with one slide showing",
  open1.open === true && open1.showing === 1 && open1.slides <= 4,
  JSON.stringify(open1));
await page.screenshot({ path: join(OUT, "06-tutorial-bounties-slide1.png"), fullPage: false });

await page.click("#tut-bounties .c-tut-next");
await page.waitForTimeout(200);
const open2 = await page.evaluate(`(() => {
  const d = document.getElementById("tut-bounties");
  const shown = Array.from(d.querySelectorAll(".c-tut-slide")).filter((s) => !s.hidden);
  const dots = Array.from(d.querySelectorAll(".c-tut-dot")).map((x) => x.className.includes("is-on"));
  return { showing: shown.length, at: d.dataset.at, dots,
           call: (shown[0]?.querySelector(".c-tut-call")?.textContent || "").trim() };
})()`);
record("item 7 · next steps the deck and the dot follows",
  open2.showing === 1 && open2.at === "1" && open2.dots[1] === true, JSON.stringify(open2));
record("item 7 · and the slide shows the door's own grammar",
  /town \{ do: "stake"/.test(open2.call), open2.call);
await page.screenshot({ path: join(OUT, "07-tutorial-bounties-slide2.png"), fullPage: false });

await page.keyboard.press("Escape");
await page.waitForTimeout(250);
const closed = await page.evaluate(`document.getElementById("tut-bounties").open`);
record("item 7 · Escape closes it", closed === false, String(closed));

// ── 8 · one purple ──────────────────────────────────────────────────────────
// EVERY ✦ ON SCREEN, and the colour it is actually painted. Read from the
// rendered page rather than from the source, because a token that resolves to
// nothing renders as inherited grey and looks exactly like a rule nobody wrote
// — which is how the quest card's dead `rgba(var(--pm-stamp-bright), …)`
// survived. The expected family is read from the page's own tokens.
await page.goto(`${BASE}/town/#ideas`, { waitUntil: "load" });
await page.waitForTimeout(350);
const purple = await page.evaluate(`(() => {
  const walker = document.createTreeWalker(document.querySelector("main.civic"), NodeFilter.SHOW_TEXT);
  const seen = {};
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.includes("✦")) continue;
    const el = n.parentElement;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const c = getComputedStyle(el).color;
    (seen[c] ??= []).push((el.textContent || "").trim().slice(0, 28));
  }
  // READ FROM THE ELEMENT THAT DECLARES THEM. postmark.css puts the palette on
  // \`.pm\`, not on :root — the first run of this read documentElement, got an
  // empty string, and compared a real colour against nothing, which is a probe
  // reporting a failure it could not actually have detected.
  const holder = document.querySelector(".pm") || document.documentElement;
  const root = getComputedStyle(holder);
  // THE WHOLE FAMILY, resolved to rgb by the browser rather than compared as
  // hex text. The law is "uses THIS family" — three members — and the first
  // version of this check demanded one of them exactly (--pm-stamp), so it
  // reported a defect against a page correctly using --pm-stamp-bright. A
  // probe that narrows a law and then judges by the narrowing invents findings.
  const family = ["--pm-stamp", "--pm-stamp-bright", "--pm-stamp-dark"].map((name) => {
    const probe = document.createElement("span");
    probe.style.color = "var(" + name + ")";
    holder.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return [name, c];
  });
  return { colours: seen, family };
})()`);
const colours = Object.keys(purple.colours);
const family = purple.family.map(([, c]) => c);
record("item 8 · every visible ✦ is painted one colour", colours.length === 1,
  JSON.stringify(purple.colours));
record("item 8 · and that colour is one of the stamp family, not gold",
  colours.length === 1 && family.includes(colours[0]),
  `${colours[0]} vs ${purple.family.map(([n, c]) => `${n}=${c}`).join(", ")}`);

// ── the quarter, and a phone ────────────────────────────────────────────────
await page.goto(`${BASE}/town/`, { waitUntil: "load" });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, "08-quarter-desktop.png"), fullPage: false });

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const [frag, name] of [["", "09-mobile-arrival"], ["#bounty-board", "10-mobile-board"], ["#marketplace", "11-mobile-coming-soon"]]) {
  await phone.goto(`${BASE}/town/${frag}`, { waitUntil: "load" });
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
}
// THE OVERFLOW QUESTION, asked rather than eyeballed: a page whose body scrolls
// sideways on a phone is a defect a screenshot at that width can hide.
const overflow = await phone.evaluate(`({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
  worst: Array.from(document.querySelectorAll("main.civic *"))
    .map((el) => ({ sel: el.className && String(el.className).slice(0, 40), right: Math.round(el.getBoundingClientRect().right) }))
    .filter((x) => x.right > window.innerWidth + 1)
    .sort((a, b) => b.right - a.right).slice(0, 3),
})`);
record("mobile · the page does not scroll sideways at 390px",
  overflow.doc <= overflow.win + 1, `${overflow.doc}px doc vs ${overflow.win}px window; ${JSON.stringify(overflow.worst)}`);

await phone.evaluate(`document.getElementById("tut-quests") && document.querySelector("#quests .c-help")`);
await phone.goto(`${BASE}/town/#quests`, { waitUntil: "load" });
await phone.waitForTimeout(350);
await phone.click("#quests .c-help");
await phone.waitForTimeout(300);
await phone.screenshot({ path: join(OUT, "12-mobile-tutorial.png"), fullPage: false });

await browser.close();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.log("FAILED:\n" + failed.map((f) => `  · ${f.name} — ${f.detail}`).join("\n"));
  process.exitCode = 1;
}
