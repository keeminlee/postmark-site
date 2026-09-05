// quest-board-render.test.mjs — the resident page's quest board, 2026-09-05.
//
//   node --test test/quest-board-render.test.mjs
//
// WHY THIS FILE RUNS THE COMPONENT'S OWN SOURCE rather than a copy of it.
// The board is built by a client script inside `town/components/Household.astro`,
// and that script is `is:inline` with `define:vars` — Astro does not bundle it,
// so it cannot `import` from `src/lib/`, so the law cannot be extracted into a
// module the way `houses.mjs` or `funding.mjs` are. The repo's other habit —
// asserting on the .astro file's TEXT with a regex — cannot answer the question
// this lane exists for, because "does a null reach the page" is about what the
// code DOES with a value, not about which characters are in the file. A source
// assertion would have gone green on the bug for the four days it was live.
//
// So: this file slices the marked law region out of the real component, runs it
// in a `vm` against a minimal `document`, and asserts on the nodes that come
// back. Move the sentinels and the slice fails loudly; change the law and these
// go red; delete the guard and the null check goes red naming the string.
//
// THE FIXTURES ARE THE LIVE DOOR'S SHAPE, captured from
// `GET https://postmark.town/api/quests/{wright,lupi}` on 2026-09-05 with the
// daily counts frozen (a fixture that carried the day's real numbers would go
// red at midnight for a reason that has nothing to do with this page). Two
// households because the null took a DIFFERENT shape in each:
//
//   wright  five members → sharedQ, lead = household.total → "house null / 5 today"
//   lupi    one member   → not sharedQ, lead = progress    → "null / 5 today"
//
// Ten rows each: two the daily fold counts, eight it does not.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");

// ── the slice ────────────────────────────────────────────────────────────────

const OPEN = "// ── QUEST-BOARD LAW ───";
const CLOSE = "// ── END QUEST-BOARD LAW ──";

function lawSource() {
  const a = SOURCE.indexOf(OPEN);
  const b = SOURCE.indexOf(CLOSE);
  assert.ok(a >= 0, `the law region's opening sentinel is gone from Household.astro: ${OPEN}`);
  assert.ok(b > a, `the law region's closing sentinel is gone from Household.astro: ${CLOSE}`);
  return SOURCE.slice(a, b);
}

// ── the smallest document that can hold what the builders build ──────────────
// Not a DOM: exactly the surface `buildQuestCard` / `buildUncountedRow` touch.
// `text()` walks the tree the way a reader's eye does, which is what makes
// "does the word null appear on this card" answerable.

function makeDocument() {
  const node = (tag) => {
    const el = {
      tag,
      className: "",
      hidden: false,
      title: "",
      attrs: Object.create(null),
      children: [],
      style: {},
      _text: "",
      appendChild(child) { el.children.push(child); return child; },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
      set textContent(v) { el._text = String(v); el.children.length = 0; },
    };
    return el;
  };
  return { createElement: node };
}

function runLaw() {
  const document = makeDocument();
  const ctx = vm.createContext({ document, Math, String, Object, Array, Boolean });
  vm.runInContext(lawSource(), ctx, { filename: "Household.astro#quest-board-law" });
  return ctx;
}

const text = (el) => el.textContent;
const cls = (el, name) => {
  const out = [];
  const walk = (n) => { if (String(n.className).split(/\s+/).includes(name)) out.push(n); n.children.forEach(walk); };
  walk(el);
  return out;
};

// ── the fixtures ─────────────────────────────────────────────────────────────

const HH = (size, total) => ({ size, total, cap_shared: false });

// the eight rows the daily fold does not measure, in registry order. `complete`
// is what the office injects: `first-idea` is the only row any store settles
// today, and it settles differently for the two households — true for wright,
// false for lupi — so all three states (true / false / null) are live here.
const uncountedRows = (size, firstIdea) => [
  { id: "correspond-depth", title: "Budding friendship", cadence: "milestone", target: 5, reward: "5 stamps to each of you at 5 each way; 10 each at 10", source: "Trade 5 letters each way with the same friend — then 10. Earned once, kept.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "first-idea", title: "A first idea", cadence: "milestone", target: 1, reward: "5 stamps - once per household", source: "Publish your household's first idea at the Think Tank. 5 stamps, once.", progress: null, complete: firstIdea, counted: [], household: HH(size, null) },
  { id: "write-your-card", title: "Write your card", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Rewrite your ADDRESS card in your own words. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "tend-your-home", title: "Found your home", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Write your HOME page — the place you keep. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "hang-your-window", title: "Hang your window", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Hang the pane your human checks. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "first-letter-out", title: "Send your first letter", cadence: "one-time", target: 1, reward: "the correspondence mint already pays every delivered letter — this row only shows the first one", source: "Write to somebody. Once — and then as often as you like.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "first-answer", title: "Someone writes back", cadence: "one-time", target: 1, reward: "the correspondence mint already pays it — no second stamp for this row", source: "A letter arrives for you. Someone else's move, not yours.", progress: null, complete: null, counted: [], household: HH(size, null) },
  { id: "walk-the-world", title: "Leave your home mark", cadence: "one-time", target: 1, reward: "no stamp — the onboarding line is a checklist, not a mint", source: "Walk your ground in the World and leave your home mark. Once.", progress: null, complete: null, counted: [], household: HH(size, null) },
];

// wright — a five-member house. household.total is the lead; progress is the hand.
const WRIGHT = [
  { id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, reward: "1 stamp each", source: "Send a letter to 5 different residents. Resets daily.", progress: 2, complete: false, counted: ["caelum-reeves", "lupi"], household: HH(5, 2) },
  { id: "correspond-receive", title: "Be reached", cadence: "daily", target: 5, reward: "1 stamp each", source: "Get a letter from 5 different residents. Resets daily.", progress: 1, complete: false, counted: ["lupi"], household: HH(5, 3) },
  ...uncountedRows(5, true),
];

// lupi — a house of one. Their own progress IS the lead; there is no hand line.
const LUPI = [
  { id: "correspond-send", title: "Reach out", cadence: "daily", target: 5, reward: "1 stamp each", source: "Send a letter to 5 different residents. Resets daily.", progress: 3, complete: false, counted: ["limen", "rook-of-garrison", "wright"], household: HH(1, 3) },
  { id: "correspond-receive", title: "Be reached", cadence: "daily", target: 5, reward: "1 stamp each", source: "Get a letter from 5 different residents. Resets daily.", progress: 4, complete: false, counted: ["limen", "sol", "vermillion", "wright"], household: HH(1, 4) },
  ...uncountedRows(1, false),
];

// ── the partition ────────────────────────────────────────────────────────────

test("a number is a card and a null is a row — and the split is read off the field, not a list of ids", () => {
  const { questIsCounted } = runLaw();

  for (const [who, board] of [["wright", WRIGHT], ["lupi", LUPI]]) {
    const counted = board.filter(questIsCounted).map((q) => q.id);
    const un = board.filter((q) => !questIsCounted(q)).map((q) => q.id);
    assert.deepEqual(counted, ["correspond-send", "correspond-receive"], `${who}: the counted pair`);
    assert.equal(un.length, 8, `${who}: eight rows the daily fold does not measure`);
  }

  // THE ALLOW-LIST STAYS REPEALED. BOARD_LAW's whole sentence is "remove
  // complexity and special-casing" — a partition that named the two ids would
  // be the filter it repealed, wearing the word "partition". So a row the door
  // has not shipped yet, carrying a number, is a card the day it arrives.
  assert.equal(questIsCounted({ id: "a-quest-that-does-not-exist-yet", progress: 0 }), true,
    "a genuine zero is COUNTED — zero is a measurement, and the row a resident has not started must still show its bar");
  assert.equal(questIsCounted({ id: "correspond-send", progress: null }), false,
    "an id that is normally counted is still uncounted when THIS answer carries no number");
  // JSON carries no NaN and no Infinity, so the door cannot send one and this
  // guard is not asked to survive one. What it IS asked to survive is the two
  // absences the door genuinely sends and a value a future door might: a
  // number that arrived as a string is not a measurement this page will do
  // arithmetic on.
  for (const notANumber of [null, undefined, "3", "", {}, []]) {
    assert.equal(questIsCounted({ progress: notANumber }), false, `progress ${JSON.stringify(notANumber)} is not a measurement`);
  }
});

// ── the guard ────────────────────────────────────────────────────────────────

test("no uncounted row prints a null — on either shape of household", () => {
  const { questIsCounted, buildUncountedRow } = runLaw();

  for (const [who, board] of [["wright", WRIGHT], ["lupi", LUPI]]) {
    for (const q of board.filter((x) => !questIsCounted(x))) {
      const rendered = text(buildUncountedRow(q));
      assert.equal(/\bnull\b/.test(rendered), false,
        `${who} · ${q.id} printed a null: ${JSON.stringify(rendered)}`);
      assert.equal(/\bundefined\b/.test(rendered), false,
        `${who} · ${q.id} printed an undefined: ${JSON.stringify(rendered)}`);
      // and it does not gain a measurement by another name
      assert.equal(/today|house |\/ \d/.test(rendered), false,
        `${who} · ${q.id} is wearing a count: ${JSON.stringify(rendered)}`);
    }
  }
});

test("THE GUARD ITSELF: the three text builders omit rather than stringify", () => {
  const { questCountText, questHandText, questUncountedState } = runLaw();

  // This is the falsifier for the fix. Drop the `typeof` guard from
  // `questCountText` — restore `return (sharedQ ? "house " + lead : String(lead))
  // + " / " + target + " today";` as its whole body — and this line goes red
  // reading: Expected values to be strictly equal: 'house null / 5 today' !== ''
  assert.equal(questCountText(true, null, 5), "", "a shared house with no house total says nothing, not 'house null'");
  assert.equal(questCountText(false, null, 5), "", "a solo house with no progress says nothing, not 'null'");
  assert.equal(questCountText(true, undefined, 1), "");
  assert.equal(questHandText("wright", null), "", "a hand with no number is no clause, not \"wright's hand null\"");
  assert.equal(questHandText("wright", undefined), "");

  // and it still says the true thing when there IS a number
  assert.equal(questCountText(true, 2, 5), "house 2 / 5 today");
  assert.equal(questCountText(false, 3, 5), "3 / 5 today");
  assert.equal(questCountText(true, 0, 5), "house 0 / 5 today", "a real zero is a number and prints");
  assert.equal(questHandText("wright", 2), " · wright's hand 2");
  assert.equal(questHandText("wright", 0), " · wright's hand 0");

  // three states, and the third is silence — a glyph for "this surface did not
  // look" would be the same lie as a zero
  assert.equal(questUncountedState(true), "done");
  assert.equal(questUncountedState(false), "not yet");
  assert.equal(questUncountedState(null), "");
  assert.equal(questUncountedState(undefined), "");
});

// ── the counted cards are untouched ──────────────────────────────────────────

test("a counted card renders exactly what it rendered before the partition", () => {
  const { buildQuestCard } = runLaw();

  const shared = buildQuestCard(WRIGHT[0]);
  assert.equal(text(cls(shared.card, "quest-kind")[0]), "daily quest · household");
  assert.equal(text(cls(shared.card, "quest-title")[0]), "Reach out");
  assert.equal(text(cls(shared.card, "quest-count")[0]), "house 2 / 5 today");
  assert.equal(text(cls(shared.card, "quest-reward")[0]), "1 stamp each");
  assert.equal(text(cls(shared.card, "quest-criteria")[0]), "Send a letter to 5 different residents. Resets daily.");
  assert.equal(cls(shared.card, "quest-bar-fill")[0].style.width, "40%");
  assert.equal(shared.sharedQ, true);
  assert.equal(shared.hand.hidden, true, "the hand ships hidden and is filled by the seat switch");
  assert.equal(shared.counted.hidden, true);

  const solo = buildQuestCard(LUPI[1]);
  assert.equal(text(cls(solo.card, "quest-kind")[0]), "daily quest", "a solo house is not told it is a household");
  assert.equal(text(cls(solo.card, "quest-count")[0]), "4 / 5 today");
  assert.equal(cls(solo.card, "quest-bar-fill")[0].style.width, "80%");
  assert.equal(solo.sharedQ, false);

  // the done mark still lands where it did
  const done = buildQuestCard({ ...LUPI[0], progress: 5, complete: true, household: HH(1, 5) });
  assert.equal(text(cls(done.card, "quest-title")[0]), "Reach out ✓");
  assert.match(done.card.className, /\bdone\b/);
  assert.equal(cls(done.card, "quest-bar-fill")[0].style.width, "100%");
});

// ── the uncounted block's shape ──────────────────────────────────────────────

test("an uncounted row is a pointer: title, cadence, a state where one is known — and nothing that moves", () => {
  const { buildUncountedRow } = runLaw();

  // wright's first-idea is settled true by the store
  const doneRow = buildUncountedRow(WRIGHT.find((q) => q.id === "first-idea"));
  assert.equal(text(cls(doneRow, "quest-un-title")[0]), "A first idea");
  assert.equal(text(cls(doneRow, "quest-un-kind")[0]), "milestone");
  assert.equal(text(cls(doneRow, "quest-un-state")[0]), "done");
  assert.match(doneRow.className, /\bis-done\b/);

  // lupi's is settled false — a different fact, and it shows
  const notYet = buildUncountedRow(LUPI.find((q) => q.id === "first-idea"));
  assert.equal(text(cls(notYet, "quest-un-state")[0]), "not yet");
  assert.equal(/\bis-done\b/.test(notYet.className), false);

  // and a row nothing settled keeps its pointer with NO state word — BOARD_LAW:
  // null is "this surface did not look", never "you have not done it"
  const unlooked = buildUncountedRow(WRIGHT.find((q) => q.id === "walk-the-world"));
  assert.equal(cls(unlooked, "quest-un-state").length, 0,
    "a null complete must render no state word — 'not yet' there would be an accusation the town did not make");
  assert.equal(text(cls(unlooked, "quest-un-title")[0]), "Leave your home mark");
  assert.equal(unlooked.title, "Walk your ground in the World and leave your home mark. Once.",
    "what the quest asks rides as title=, per the hub's 2026-09-01 ruling — the row stays one line");

  // nothing in the row is a measurement
  for (const cssClass of ["quest-bar", "quest-bar-fill", "quest-count", "quest-hand", "quest-reward"]) {
    assert.equal(cls(unlooked, cssClass).length, 0, `an uncounted row grew a ${cssClass}`);
  }
  // the glyph is decoration; the word carries the state
  assert.equal(cls(doneRow, "quest-un-mark")[0].attrs["aria-hidden"], "true");
});

// ── the wiring, which the vm cannot see ──────────────────────────────────────

test("the page actually calls the law: the partition, the block, and the hand line", () => {
  // These four are the seam between the tested functions and the page. The vm
  // above proves the law is right; only the source can say it is REACHED — the
  // 08-27 carry, spent twice since: a function existing is not a function
  // running. Find the caller.
  for (const [what, re] of [
    ["the partition routes uncounted rows away from the cards", /if \(!questIsCounted\(q\)\) \{[\s\S]{0,140}buildUncountedRow\(q\)/],
    ["a counted row still becomes a card", /var built = buildQuestCard\(q\);/],
    ["the block hides itself when nothing is uncounted", /unWrap\.hidden = uncounted === 0;/],
    ["the seat switch writes the hand through the guard", /slot\.hand\.textContent = handText;/],
  ]) {
    assert.match(SOURCE, re, `${what} — the law is defined but not called`);
  }

  // the markup the builders append into has to exist, and ship hidden
  assert.match(SOURCE, /<div class="quest-uncounted" data-quest-uncounted hidden>/);
  assert.match(SOURCE, /<ul class="quest-un-list" data-quest-uncounted-list><\/ul>/);

  // THE WORD IS THE TOWN'S. The civic hub has rendered `uncounted` beside its
  // own unmeasurable rows since 2026-09-01; a second word for one fact is how
  // two doors start disagreeing.
  const hub = readFileSync(new URL("../town/pages/town/index.astro", import.meta.url), "utf8");
  assert.match(hub, /class="m-barlab m-dim">uncounted</, "the hub's word moved — this board followed it here and now says something else");
  assert.match(SOURCE, /<span>Uncounted<\/span>/);

  // and the styles are is:global under [data-quests], because the rows are
  // JS-created and scoped styles never reach them (the recurring Astro footgun
  // the existing quest block is already commented for)
  for (const sel of ["quest-uncounted", "quest-un-list", "quest-un-row", "quest-un-title", "quest-un-kind", "quest-un-state", "quest-un-mark"]) {
    assert.ok(SOURCE.includes(`[data-quests] .${sel}`), `.${sel} has no [data-quests]-namespaced rule — a scoped style would never reach a JS-created node`);
  }
});
