// civic-minimal-shots.mjs — rendered QA for the founder's SIX, 2026-09-01.
//
//   npm run build && npm run preview -- --port 4413 &
//   node qa-shots/civic-minimal-shots.mjs
//
// WHY A FOURTH RUNNER, and it is a different question from the other three.
// hub-shots judges the quarter's ART; civic-polish-shots judged the 08-31
// rulings and is retired-in-place; civic-panel-shots judges the one-panel
// MECHANISM. This one judges two things no static pass can answer at all:
//
//   RULE 5 · how many type sizes actually came out on the page. A stylesheet
//            cannot be asked that. This page has now shipped TWO declarations
//            that read as correct in source and were dropped by every browser
//            (`rgba(var(--pm-stamp-bright), .75)` and a specificity loss), so
//            a source-side count of `font-size:` lines is not the law — it is
//            a proxy for the law.
//
//   RULE 6 · whether anything scrolls sideways, AT EVERY PANEL, with the "?"
//            dialog OPEN. Both halves of that are new:
//
//            · WITH THE DIALOG OPEN. The 08-31/09-01 check measured the page
//              with it closed and reported "none".
//            · AT EVERY PANEL. And this is the finding worth more than the
//              fix: the one-panel switch means `/town/` with no fragment has
//              FOUR OF FIVE PANELS at `display: none`. Every rendered check
//              that does not name a fragment has been measuring one fifth of
//              this page since the switch landed. The Quest Guild made the
//              document 448px wide in a 390px window on the base build and no
//              instrument saw it, because the Guild was never on screen when
//              anything asked.
//
// THE WORD COUNT is here too, for the same reason: "hard on the eyes" is a
// judgement, and a before/after number is the only part of it a later reader
// can check. It counts the visible text of <main>, which is what a person
// actually reads — not the markup, and not the panels that are not showing.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4413";
const OUT = join(process.cwd(), "qa-shots", "civic-minimal");
mkdirSync(OUT, { recursive: true });

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

// THE FIVE PANELS AND THE TWO INNER IDS. Every rendered law below is asked of
// all of them, because "you are measured by the rules, not by the examples" and
// a rule that only ever runs on the default panel is a rule about one fifth of
// this page.
const PANELS = [
  ["quests", "quests"], ["ideas", "ideas"], ["bounty-board", "bounties"],
  ["marketplace", null], ["ballot-house", null],
];
const INNER = ["board", "pots"];
const WIDTHS = [390, 768, 1280];

// WHAT A READER ACTUALLY SEES. `innerText` on the showing panel — not
// textContent, which would include the four hidden panels and the <style>
// block, and not the markup, which would count tags.
const VISIBLE_WORDS = `(() => {
  const main = document.querySelector("main.civic");
  const t = (main.innerText || "").replace(/\\s+/g, " ").trim();
  return { words: t ? t.split(" ").length : 0, chars: t.length, text: t };
})()`;

// EVERY COMPUTED FONT SIZE INSIDE THE SHOWING PANEL'S BODY, from elements that
// actually carry text and are actually on screen. A hidden node's size is not
// a size the reader was given.
const SIZES = `(() => {
  const lane = Array.from(document.querySelectorAll(".cq-panels > .c-lane"))
    .find((el) => getComputedStyle(el).display !== "none");
  if (!lane) return null;
  const body = lane.querySelector(".c-body");
  const seen = {};
  for (const el of body.querySelectorAll("*")) {
    // THE PLAQUE IS THE THIRD TIER AND IS ALLOWED TO BE BIG — it is read below
    // on its own rather than counted here, so excluding it is the law's own
    // shape ("plaque big (as now)") and not a hole. The dialog is excluded for
    // a different reason: it is not showing, and a size the reader was never
    // given is not a size on the page.
    if (el.closest(".c-plaque") || el.closest("dialog")) continue;
    // only elements with their OWN text, or the size is inherited and counted twice
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const px = getComputedStyle(el).fontSize;
    (seen[px] ??= []).push((el.className || el.tagName) + ":" + (el.textContent || "").trim().slice(0, 22));
  }
  // the plaque is the panel's TITLE and is allowed to be big — it is read off
  // its own element rather than assumed, so a plaque that stopped being big
  // shows up as a missing tier rather than as a silent pass
  const plaque = lane.querySelector(".c-plaque");
  return { sizes: seen, plaque: plaque ? getComputedStyle(plaque).fontSize : null };
})()`;

const SIDEWAYS = `(() => {
  const worst = Array.from(document.querySelectorAll("main.civic *"))
    .map((el) => ({ sel: String(el.className).replace(/astro-\\S+/g, "").trim().slice(0, 40),
                    right: Math.round(el.getBoundingClientRect().right) }))
    .filter((x) => x.right > window.innerWidth + 1)
    .sort((a, b) => b.right - a.right).slice(0, 3);
  return { doc: document.documentElement.scrollWidth, win: window.innerWidth, worst };
})()`;

const browser = await chromium.launch();

// ── the word count, at desktop, per panel and in total ───────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  let total = 0;
  const per = [];
  for (const [panel] of PANELS) {
    await page.goto(`${BASE}/town/#${panel}`, { waitUntil: "load" });
    await page.waitForTimeout(350);
    const v = await page.evaluate(VISIBLE_WORDS);
    per.push(`${panel}=${v.words}`);
    total += v.words;
  }
  record("word count · the visible text of /main/, panel by panel", true,
    `${per.join(" ")}  ·  TOTAL ${total} words across the five panels`);
  await page.close();
}

// ── RULE 5 · one body size, on the rendered page ─────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  for (const [panel] of PANELS) {
    await page.goto(`${BASE}/town/#${panel}`, { waitUntil: "load" });
    await page.waitForTimeout(350);
    const s = await page.evaluate(SIZES);
    const sizes = Object.keys(s.sizes).sort();
    // THE LAW, verbatim: "Type scale: plaque big (as now), labels small caps,
    // everything else one body size — no third and fourth sizes." Two tiers of
    // body text is the whole allowance: the label tier and the body tier.
    record(`rule 5 · ${panel} renders at most two text sizes under its plaque`,
      sizes.length <= 2, `${sizes.join(" / ")} — plaque ${s.plaque}`);
    record(`rule 5 · ${panel}'s plaque is still the big one`,
      parseFloat(s.plaque) > parseFloat(sizes[sizes.length - 1] ?? "0"),
      `plaque ${s.plaque} vs largest body ${sizes[sizes.length - 1]}`);
  }
  await page.close();
}

// ── RULE 6 · nothing scrolls sideways, at every panel and every width ────────
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });

  for (const frag of [...PANELS.map(([p]) => p), ...INNER, ""]) {
    await page.goto(`${BASE}/town/${frag ? "#" + frag : ""}`, { waitUntil: "load" });
    await page.waitForTimeout(320);
    const o = await page.evaluate(SIDEWAYS);
    record(`rule 6 · ${width}px · #${frag || "(no fragment)"} does not scroll sideways`,
      o.doc <= o.win + 1, `${o.doc}px doc vs ${o.win}px window${o.worst.length ? " :: " + JSON.stringify(o.worst) : ""}`);
  }

  // AND WITH THE "?" OPEN — the width the old check never measured.
  for (const [panel, key] of PANELS.filter(([, k]) => k)) {
    await page.goto(`${BASE}/town/#${panel}`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    // dispatchEvent, not click(): if the page DOES scroll sideways the button
    // may be off-screen and Playwright's actionability check times out, which
    // would report this law's failure as a harness error.
    await page.evaluate(`document.querySelector("#${panel} .c-help").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
    await page.waitForTimeout(280);

    const d = await page.evaluate(`(() => {
      const dlg = document.getElementById("tut-${key}");
      const rails = [], past = [];
      for (const el of dlg.querySelectorAll("*")) {
        if (el.scrollWidth > el.clientWidth + 1) rails.push(String(el.className).replace(/astro-\\S+/g, "").trim() + " " + el.scrollWidth + ">" + el.clientWidth);
        if (el.getBoundingClientRect().right > window.innerWidth + 1) past.push(String(el.className).replace(/astro-\\S+/g, "").trim());
      }
      const r = dlg.getBoundingClientRect();
      return { open: dlg.open, doc: document.documentElement.scrollWidth, win: window.innerWidth,
               w: Math.round(r.width), h: Math.round(r.height), vh: window.innerHeight, rails, past };
    })()`);

    record(`rule 6 · ${width}px · ${panel}'s "?" opens and the page still does not scroll sideways`,
      d.open === true && d.doc <= d.win + 1, `open=${d.open} ${d.doc}px doc vs ${d.win}px window`);
    record(`rule 6 · ${width}px · nothing inside ${panel}'s "?" carries a rail of its own`,
      d.rails.length === 0, d.rails.join(" | ") || "no rails");
    record(`rule 6 · ${width}px · nothing inside ${panel}'s "?" runs past the screen`,
      d.past.length === 0, d.past.join(", ") || "nothing past");
    record(`rule 6 · ${width}px · ${panel}'s "?" fits the viewport`,
      d.w <= width && d.h <= d.vh, `${d.w}x${d.h} in ${width}x${d.vh}`);
  }
  await page.close();
}

// ── RULE 1 · no machine voice, on the rendered page ──────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  for (const [panel] of PANELS) {
    await page.goto(`${BASE}/town/#${panel}`, { waitUntil: "load" });
    await page.waitForTimeout(320);
    const v = await page.evaluate(VISIBLE_WORDS);
    // THE FOUNDER'S RULE, verbatim: "Door verbs, mark ids, file names,
    // postmark.town/fund/<pot>/ — none of it on the page."
    const machine = [
      [/\b(?:do|read):\s*"/, "a door verb"],
      [/\b(?:town|household|world)\s*\{/, "an apex grammar line"],
      [/postmark\.town\/fund\//, "a fund path"],
      [/\b[\w-]+\.(?:mjs|astro|json)\b/, "a source file name"],
      [/\basked-by\b|\bledger-weight\b/, "a predicate slot"],
    ].map(([re, what]) => [what, v.text.match(re)]).filter(([, m]) => m);
    record(`rule 1 · ${panel} speaks no machine`, machine.length === 0,
      machine.map(([what, m]) => `${what}: ${m[0]}`).join(" | ") || "clean");
  }
  await page.close();
}

// ── the shots, three widths ──────────────────────────────────────────────────
for (const [width, tag] of [[1280, "desktop"], [768, "tablet"], [390, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } });
  for (const [panel, key] of PANELS) {
    await page.goto(`${BASE}/town/#${panel}`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${tag}-${panel}.png`), fullPage: true });
    if (key) {
      await page.evaluate(`document.querySelector("#${panel} .c-help").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `${tag}-${panel}-tutorial.png`), fullPage: false });
    }
  }
  await page.goto(`${BASE}/town/`, { waitUntil: "load" });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `${tag}-arrival.png`), fullPage: false });
  await page.close();
}

await browser.close();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.log("FAILED:\n" + failed.map((f) => `  · ${f.name} — ${f.detail}`).join("\n"));
  process.exitCode = 1;
}
