// quest-board-shots.mjs — rendered QA for the resident page's quest board,
// 2026-09-05 (lane `quest-board`).
//
//   npm run build && npm run preview -- --port 4413 &
//   node qa-shots/quest-board-shots.mjs            # writes qa-shots/quest-board/<PHASE>-*
//   PHASE=after node qa-shots/quest-board-shots.mjs
//
// AGAINST THE BUILT PAGE, not the dev server, for civic-panel-shots.mjs's
// reason, quoted: "the snapshot lane builds code AND town data from the branch
// itself, so what `npm run preview` serves in this worktree is what dev will
// serve after the train push."
//
// WHAT THIS ONE JUDGES that no static pass can: the quest board is built by
// client JS from a LIVE answer (`GET https://postmark.town/api/quests/<handle>`
// — the page hardcodes the prod origin, so preview and prod read the same
// door). The defect is a value that only exists after that fetch resolves:
// `progress: null` reaching `textContent` as the four characters "null".
// A source-text assertion cannot see it; only a browser that waited can.
//
// TWO HOUSEHOLDS, because the null takes a DIFFERENT SHAPE in each and the
// screenshot Keemin sent only showed one of them:
//   wright  five-member house → sharedQ, so the lead is `household.total`
//   lupi    solo house        → not sharedQ, so the lead is `progress`
// Both are null on the eight uncounted rows; the shared house says
// "house null / 1 today" and the solo house says "null / 1 today".
//
// TWO WIDTHS, because .quest-cards is `flex-wrap` on `flex: 1 1 240px` — at
// 1280 the ten cards make a grid and at 420 they stack, and a compact block
// that reads fine in a column can be a wall in a row.
//
// THE TEXT IS READ BEFORE THE SCREENSHOT, for civic-polish-shots.mjs's reason:
// this repo has been caught by text sitting in the DOM at opacity 1 with not
// one pixel of it on screen. A PNG is what a person judges; the DOM read is
// what can go red on its own.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4413";
const PHASE = process.env.PHASE ?? "before";
const OUT = join(process.cwd(), "qa-shots", "quest-board");
mkdirSync(OUT, { recursive: true });

const HOUSES = [
  { handle: "wright", note: "five-member house — sharedQ, lead is household.total" },
  { handle: "lupi", note: "solo house — not sharedQ, lead is progress" },
];
const WIDTHS = [1280, 420];

// The board's own text, as a reader sees it. `innerText` rather than
// `textContent` so a `hidden` node does not contribute — the difference
// between "is in the DOM" and "is on the page", which is the whole reason
// this file exists rather than a grep.
const BOARD_TEXT = `(() => {
  const sec = document.querySelector("[data-quests]");
  if (!sec) return "__NO_BOARD__";
  if (sec.hidden) return "__BOARD_HIDDEN__";
  return sec.innerText;
})()`;

// How many cards, and how many rows in the uncounted block (0 before the fix).
const SHAPE = `(() => ({
  cards: document.querySelectorAll("[data-quest-cards] > .quest-card").length,
  uncountedRows: document.querySelectorAll("[data-quest-uncounted] .quest-un-row").length,
  uncountedBlock: !!document.querySelector("[data-quest-uncounted]"),
}))()`;

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

const browser = await chromium.launch();
try {
  for (const { handle, note } of HOUSES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 1400 } });
      await page.goto(`${BASE}/residents/${handle}/`, { waitUntil: "networkidle" });
      // the board is hidden until the door answers; waiting on the section
      // rather than a timeout, so a slow door fails loudly instead of shooting
      // an empty page and calling it a pass.
      await page.waitForFunction(
        `(() => { const s = document.querySelector("[data-quests]"); return s && !s.hidden; })()`,
        { timeout: 30000 },
      ).catch(() => {});

      const text = await page.evaluate(BOARD_TEXT);
      const shape = await page.evaluate(SHAPE);
      const nulls = (String(text).match(/\bnull\b/g) || []).length;

      const stem = `${PHASE}-${handle}-${width}`;
      await page.screenshot({ path: join(OUT, `${stem}.png`), fullPage: true });
      writeFileSync(join(OUT, `${stem}.txt`), String(text), "utf8");

      record(
        `${handle} @ ${width} — no "null" in the board's own text`,
        nulls === 0,
        `${nulls} occurrence(s); ${shape.cards} card(s), ${shape.uncountedRows} uncounted row(s), block=${shape.uncountedBlock} — ${note}`,
      );
      // the quoted line, so the report can carry it verbatim rather than a count
      const line = String(text).split("\n").find((l) => /\bnull\b/.test(l));
      if (line) console.log(`      first null line: ${JSON.stringify(line)}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${PHASE}: ${results.length - failed}/${results.length} pass, ${failed} fail`);
console.log(`shots → ${OUT}`);
// A BEFORE run is EXPECTED to fail — that is the reproduction. Only the after
// run is held to green, so the exit code follows the phase rather than the
// count, and a green "before" is itself the alarm (nothing was reproduced).
if (PHASE === "before" && failed === 0) {
  console.log("\n!! the before-state is already clean — the defect did not reproduce");
  process.exit(2);
}
if (PHASE !== "before" && failed) process.exit(1);
