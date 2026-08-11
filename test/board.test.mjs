// board.test.mjs — the Bounty Board reader's falsifiers.
//   node --test
//
// The board renders from the world store, and the store does not yet carry a
// single bounty mark (Wright's class-mark pen has not landed). So the load-bearing
// property under test is not "it renders notices" — it is that it renders NOTHING
// when there is nothing, tells the truth about which kind of nothing it found, and
// refuses to draw a progress bar the town did not vote.

import test from "node:test";
import assert from "node:assert/strict";
import { notices, toNotice, isNotice, loadWorldState, FIXTURE, BOARD_PLACE, ASK_MAX } from "../src/lib/board.mjs";

test("an empty world reads as an empty board, and says the board is missing", () => {
  const r = notices({ marks: [] });
  assert.deepEqual(r.notices, []);
  assert.equal(r.boardExists, false);
  assert.equal(r.storeRead, true);
});

test("a board with no notices is distinguished from a board that does not exist", () => {
  const r = notices({ marks: [{ id: BOARD_PLACE, by: "the-town" }] });
  assert.deepEqual(r.notices, []);
  assert.equal(r.boardExists, true, "the board mark is up — the town simply has no asks");
});

test("an unreadable store is fail-soft, not a build failure", () => {
  const r = notices(null);
  assert.deepEqual(r.notices, []);
  assert.equal(r.storeRead, false);
  assert.equal(loadWorldState({ path: "/nope/does/not/exist.json" }), null);
});

test("the fixture matches the documented grammar", () => {
  const r = notices(FIXTURE);
  assert.equal(r.malformed.length, 0, "every fixture notice must be readable — the fixture is the grammar's live check");
  assert.equal(r.notices.length, 3);
  assert.equal(r.boardExists, true);
  // open before done, then most-backed first
  assert.deepEqual(r.notices.map((n) => n.status), ["open", "open", "done"]);
  assert.ok(r.notices[0].backed >= r.notices[1].backed);
});

test("civic notices get a progress bar; resident notices do not", () => {
  const r = notices(FIXTURE);
  const civic = r.notices.find((n) => n.civic);
  const resident = r.notices.find((n) => !n.civic && n.status === "open");
  assert.equal(civic.poster, "the-town");
  assert.equal(civic.threshold, 100);
  assert.equal(civic.progress, 0.35);
  assert.equal(resident.threshold, null);
  assert.equal(resident.progress, null, "a resident notice has no bar to fill");
});

// ── FALSIFIERS ───────────────────────────────────────────────────────────────

test("FALSIFIER — a resident notice carrying a threshold still gets no bar", () => {
  // The bar is a civic instrument. If a stray `threshold:` on a resident mark
  // could grow one, any resident could mint the town's own affordance.
  const n = toNotice({ id: "wright/bounty-x", by: "wright", ask: "Do a thing.", reward: 5, threshold: 500, ledger_weight: 100 });
  assert.equal(n.ok, true);
  assert.equal(n.civic, false);
  assert.equal(n.threshold, null);
  assert.equal(n.progress, null);
});

test("FALSIFIER — a bounty-class mark placed off the board is not on the board", () => {
  assert.equal(isNotice({ id: "x/y", class: "bounty", placementParent: "the-town/the-quay" }), false);
  assert.equal(isNotice({ id: "x/y", class: "bounty", placementParent: BOARD_PLACE }), true);
  // and a non-bounty mark standing on the board is not a notice either
  assert.equal(isNotice({ id: "x/y", class: "lamp", placementParent: BOARD_PLACE }), false);
  const r = notices({ marks: [{ id: "x/y", class: "bounty", placementParent: "the-town/the-quay", ask: "hi", reward: 1 }] });
  assert.deepEqual(r.notices, []);
});

test("FALSIFIER — a malformed notice is dropped AND counted, never rendered half-built", () => {
  const bad = [
    { id: "a/1", class: "bounty", placementParent: BOARD_PLACE, reward: 5 },                                  // no ask
    { id: "a/2", class: "bounty", placementParent: BOARD_PLACE, ask: "x".repeat(ASK_MAX + 1), reward: 5 },      // ask too long
    { id: "a/3", class: "bounty", placementParent: BOARD_PLACE, ask: "ok", reward: 0 },                         // reward < 1
    { id: "a/4", class: "bounty", placementParent: BOARD_PLACE, ask: "ok", reward: "many" },                    // reward not a number
    { id: "a/5", class: "bounty", placementParent: BOARD_PLACE, ask: "ok", reward: 2, status: "maybe" },        // bad status
  ];
  const r = notices({ marks: bad });
  assert.deepEqual(r.notices, [], "not one of them reaches the board");
  assert.equal(r.malformed.length, 5, "and not one of them vanishes silently");
  assert.match(r.malformed[1].reason, new RegExp(String(ASK_MAX)));
});

test("FALSIFIER — an over-subscribed civic notice reads as over-subscribed", () => {
  // The bar clamps so it cannot draw past its box; the NUMBERS must not clamp,
  // or a notice the town over-answered would look merely full.
  const n = toNotice({ id: "the-town/b", by: "the-town", ask: "Help.", reward: 5, threshold: 100, ledger_weight: 250 });
  assert.equal(n.progress, 1, "the bar is full");
  assert.equal(n.backed, 250, "the number is honest");
  assert.equal(n.threshold, 100);
});

test("status defaults to open, and a done notice stays on the board", () => {
  assert.equal(toNotice({ id: "a/1", ask: "x", reward: 1 }).status, "open");
  const r = notices(FIXTURE);
  assert.ok(r.notices.some((n) => n.status === "done"), "done notices are struck, not deleted");
});

test("the ask cap counts code points, not UTF-16 units (review O-2/W-3)", () => {
  // 150 emoji = 150 characters by the law's counting (door and lint both use
  // [...ask].length) but 300 UTF-16 units — a lawful ask the old counting
  // dropped as counted-not-rendered.
  const emojiAsk = "\u{1F600}".repeat(ASK_MAX);
  const n = toNotice({ id: "wright/bounty-emoji", class: "bounty", placementParent: BOARD_PLACE,
    by: "wright", reward: 5, ask: emojiAsk });
  assert.equal(n.ok, true, n.reason);
  const over = toNotice({ id: "wright/bounty-over", class: "bounty", placementParent: BOARD_PLACE,
    by: "wright", reward: 5, ask: "x".repeat(ASK_MAX + 1) });
  assert.equal(over.ok, false);
  assert.match(over.reason, /ask is 151 chars/);
});
