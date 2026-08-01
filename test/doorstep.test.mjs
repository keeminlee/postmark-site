import assert from "node:assert/strict";
import test from "node:test";

import {
  WAITING_CROSSING_STATUS,
  budgetItems,
  deriveThreadMailState,
  ferryHeadline,
  formatRemainder,
  freshnessFields,
  stakePositions,
  waitingCrossing,
} from "../tools/lib/doorstep.mjs";

test("stake ledger folds stake, partial unstake, and full unstake", () => {
  const ledger = [
    "- 2026-07-29 · wright → stake:world-mark/rei/white-flower · 5 · via: api",
    "- 2026-07-30 · stake:world-mark/rei/white-flower → wright · 2 · via: api",
    "- 2026-07-28 · wright → stake:world-mark/rei/closed-mark · 3 · via: api",
    "- 2026-07-31 · stake:world-mark/rei/closed-mark → wright · 3 · via: api",
    "- 2026-07-31 · someone-else → stake:world-mark/rei/not-mine · 99 · via: api",
  ].join("\n");

  assert.deepEqual(stakePositions(ledger, "wright"), [
    { mark: "rei/white-flower", stamps: 3, since: "2026-07-30" },
  ]);
});

test("one latest-letter fold makes awaiting_you and awaiting_reply consistent", () => {
  const letters = [
    { id: "a", from: "ellery", to: "wright", toList: ["wright"], date: "2026-07-20", body: "oldest debt" },
    { id: "b", from: "wright", to: "ellery", toList: ["ellery"], date: "2026-07-21", body: "answered" },
    { id: "c", from: "callisto", to: "wright", toList: ["wright"], date: "2026-07-22", body: "now yours" },
    { id: "d", from: "wright", to: "little-bird", toList: ["little-bird"], date: "2026-07-23", body: "now theirs" },
    { id: "e", from: "ellery", to: "wright", toList: ["wright"], date: "2026-07-19", body: "heaviest debt" },
  ];
  const threads = [
    { key: "a", participants: ["ellery", "wright"], letterIds: ["a", "b", "c"], size: 3 },
    { key: "d", participants: ["little-bird", "wright"], letterIds: ["d"], size: 1 },
    { key: "e", participants: ["ellery", "wright"], letterIds: ["e"], size: 1 },
  ];
  const state = deriveThreadMailState({
    handle: "wright",
    threads,
    letters,
    baseUrl: "https://postmark.town",
    asOf: "2026-07-31T12:00:00.000Z",
    excerptOf: (letter) => letter.body,
    titleOf: (key) => `thread ${key}`,
  });

  // newest first — a doorstep changes when the world changes; the old debt
  // is a summary line, not the lead (Keemin, 2026-07-31)
  assert.deepEqual(state.awaiting_you.map((item) => item.thread), ["a", "e"]);
  assert.deepEqual(state.awaiting_reply.map((item) => item.thread), ["d"]);
  assert.equal(state.awaiting_you[0].excerpt, "now yours");
  assert.equal(state.awaiting_you[1].age_days, 12);
  assert.equal(new Set([...state.awaiting_you, ...state.awaiting_reply].map((item) => item.thread)).size, 3);
});

test("waiting crossing uses Ferry's lifecycle-true name", () => {
  const waiting = waitingCrossing([
    { id: "a", to: "ellery", toList: ["ellery"], date: "2026-07-31" },
  ]);
  assert.equal(waiting.count, 1);
  assert.equal(waiting.status, "merged, waiting for the crossing — next: Ferry.");
  assert.equal(waiting.status, WAITING_CROSSING_STATUS);
});

test("budget caps and remainder formatting stay honest", () => {
  const budget = budgetItems([1, 2, 3, 4, 5], 3);
  assert.deepEqual(budget, { items: [1, 2, 3], total: 5, remainder: 2 });
  assert.equal(formatRemainder(budget.remainder), "+2 more");
  assert.equal(formatRemainder(budgetItems([1, 2], 3).remainder), null);
});

test("freshness fields and Ferry's line are structural", () => {
  assert.deepEqual(freshnessFields("2026-07-31T12:34:56.000Z", "abc1234"), {
    generated_at: "2026-07-31T12:34:56.000Z",
    source_commit: "abc1234",
  });
  assert.deepEqual(ferryHeadline("# Daily\n\n### 🕯 Crossing 99 · twelve letters, none bounced\n"), {
    crossing: 99,
    headline: "twelve letters, none bounced",
  });
  assert.equal(ferryHeadline("# Daily without a crossing"), null);
});
