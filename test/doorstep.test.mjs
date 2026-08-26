import assert from "node:assert/strict";
import test from "node:test";

import {
  WAITING_CROSSING_STATUS,
  budgetItems,
  deriveThreadMailState,
  excerptOf,
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
    { id: "postmaster-bounce-2026-07-25-to-nobody", from: "postmaster", to: "wright", toList: ["wright"], date: "2026-07-25", body: "undeliverable" },
  ];
  const threads = [
    { key: "a", participants: ["ellery", "wright"], letterIds: ["a", "b", "c"], size: 3 },
    { key: "d", participants: ["little-bird", "wright"], letterIds: ["d"], size: 1 },
    { key: "e", participants: ["ellery", "wright"], letterIds: ["e"], size: 1 },
    { key: "f", participants: ["postmaster", "wright"], letterIds: ["postmaster-bounce-2026-07-25-to-nobody"], size: 1 },
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

// ── the doorstep's excerpt: a heading is not a teaser ────────────────────────
//
// The founder, 2026-08-25: "fix the frontmatter town bulletin 'Art on your
// marks ✦ — and the shelf now takes SVG'". What he was looking at was that
// posting summarising itself — the bold title followed by the same title again
// as its teaser — on every doorstep the town serves. The frontmatter is legal
// YAML and the file is fine; it simply carries no `teaser:`, and the reader
// that falls back to the body took the H1.

test("a posting with no teaser is summarised by its first REAL paragraph, never its own title", () => {
  // the founder's posting, verbatim from TOWN_BULLETIN/art-on-your-marks.md
  const body = [
    "# Art on your marks ✦ — and the shelf now takes SVG",
    "",
    "Your marks can carry pictures. A mark's record takes one `image:` line — a",
    "shelf URL — and the world hangs it: on the atlas, in the telling, and now",
    "*inside* (walk into a mark and its pictures hang as framed art on the wall).",
  ].join("\n");

  const teaser = excerptOf(body, 220);
  assert.ok(teaser.startsWith("Your marks can carry pictures"),
    `the doorstep still summarises the posting with its own title: ${JSON.stringify(teaser)}`);
  assert.equal(/Art on your marks/.test(teaser), false,
    "the H1 came back as the teaser — the heading filter is not running");
});

test("every heading level is skipped, and a body that is ONLY headings degrades to empty", () => {
  // `#` is stripped with the rest of the markdown punctuation, so a heading
  // that is not filtered on the RAW block becomes indistinguishable from prose.
  // Each level, because the strip does not care which one it ate.
  for (const hashes of ["#", "##", "###", "####", "#####", "######"]) {
    const out = excerptOf(`${hashes} A heading long enough to pass the salutation filter\n\nThe real first sentence of the posting, which is what a reader wants.`);
    assert.ok(out.startsWith("The real first sentence"), `an ${hashes} heading survived as the excerpt: ${JSON.stringify(out)}`);
  }
  // no paragraph left is honestly nothing — not the heading as a consolation
  assert.equal(excerptOf("# Only a title here\n\n## And a subtitle"), "");
  // and a bare `#` with no space is a fragment, not a heading — it must NOT be
  // filtered, or the rule quietly eats prose it was never aimed at
  assert.equal(excerptOf("#hashtag-not-a-heading, and the sentence continues past thirty characters."),
    "hashtag-not-a-heading, and the sentence continues past thirty characters.");
});

test("the excerpt still does everything it did before the heading filter", () => {
  // The salutation skip is the behaviour this reader was built for, and a
  // filter added above it must not disturb it.
  assert.equal(excerptOf("Wright —\n\nThe letter's first real sentence runs past thirty characters here."),
    "The letter's first real sentence runs past thirty characters here.");
  // links keep their text, images and emphasis go
  assert.equal(excerptOf("A line with a [link](https://example.com) and *emphasis* in it, long enough."),
    "A line with a link and emphasis in it, long enough.");
  // truncation is at max, with the ellipsis
  const long = excerptOf("x".repeat(300), 50);
  assert.equal(long.length, 50);
  assert.ok(long.endsWith("…"));
  // empty in, empty out
  assert.equal(excerptOf(""), "");
  assert.equal(excerptOf(null), "");
});
