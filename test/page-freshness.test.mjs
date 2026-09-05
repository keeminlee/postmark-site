// page-freshness.test.mjs — the falsifiers for what a baked page may claim.
//
// THE LAW THESE ASSERT, verbatim from EPICS/POSTMARK/freshness-architecture.md
// § the mushy middle:
//
//   "mushiness must be disclosed — the page states when it was generated and
//    which ferry crossing it reflects, says 'a ferry has landed since this page
//    was made' when true, and never prints a cadence promise it does not
//    control."
//
// and § the static floor, which is the one these tests are really guarding:
//
//   "the floor may lag, but it must never lie about being current."
//
// THE DEFECT THEY CLOSE is the 2026-08-26 mail drift: the town-data sync stalled
// 97 minutes past a ferry and 48 residents' doorstep pages served yesterday's
// mail — each of them printing "Regenerates ~every 30 minutes" while it did.
//
// The pair that matters most is the first two: the line MUST fire against a
// stale page and MUST NOT fire against a fresh one. A disclosure that cannot
// tell those apart is decoration.

import assert from "node:assert/strict";
import test from "node:test";

import { describeFreshness, agePhrase, CADENCE_FLOOR, FERRY_LANDED } from "../src/lib/page-freshness.mjs";

const NOW = Date.parse("2026-08-26T13:37:00Z");
const stamp = (over = {}) => ({ built_at: "2026-08-26T13:20:00Z", crossing: 149, ...over });

// ═══════════════════════════════════════════════════════════════════════════

test("STALE FIXTURE: a page baked before the ferry says a ferry has landed", () => {
  // The 08-26 shape exactly: the page is 17 minutes old — recently rebuilt by
  // any wall clock — and yet a whole crossing has gone by since the data it
  // carries. This is the case every duration-based check called healthy.
  const said = describeFreshness({ stamp: stamp({ crossing: 148 }), officeCrossing: 149, nowMs: NOW });
  assert.equal(said.stale, true);
  assert.equal(said.cls, "warn");
  assert.match(said.text, new RegExp(FERRY_LANDED),
    "the founder's own sentence, printed where the resident reads it");
  assert.match(said.text, /crossing 148 and the town is on 149/,
    "and it names both numbers, so the claim is checkable rather than asserted");
  assert.match(said.text, /reach this page at the next rebuild/,
    "a resident needs to know their mail is COMING, not merely that something is wrong");
});

test("THE FLIP: a page baked on the current crossing must NOT say it", () => {
  const said = describeFreshness({ stamp: stamp(), officeCrossing: 149, nowMs: NOW });
  assert.equal(said.stale, false);
  assert.equal(said.cls, "ok");
  assert.doesNotMatch(said.text, /ferry has landed/,
    "THE FALSIFIER: a warning that fires on a healthy page is one the reader learns to ignore, which reproduces the silence exactly");
  assert.match(said.text, /reflects crossing 149 — the crossing the town is on/);
  assert.match(said.text, /made 17 minutes ago/, "and it still says WHEN, which is the other half of the law");
});

test("a page built AHEAD of the office's reading is not a finding", () => {
  // A build that straddled a crossing stamps the newer number honestly — the
  // town data it read was on the far side of the ferry. Alarming here would be
  // alarming at the one moment everything worked.
  const said = describeFreshness({ stamp: stamp({ crossing: 150 }), officeCrossing: 149, nowMs: NOW });
  assert.equal(said.stale, false);
  assert.doesNotMatch(said.text, /ferry has landed/);
});

test("two ferries are counted, not rounded to 'a ferry'", () => {
  const said = describeFreshness({ stamp: stamp({ crossing: 147 }), officeCrossing: 149, nowMs: NOW });
  assert.match(said.text, /^2 ferries have landed/);
  assert.match(said.text, /those crossings/, "plural agreement, because a reader reads it as a sentence");
});

test("HALF AN ANSWER IS NOT AN ALL-CLEAR: with no crossing to compare, it says WHEN and stops", () => {
  // The tempting bug is to fold "I could not reach the office" into "nothing
  // has moved" — a page reporting an all-clear it never received (the same
  // failure src/lib/freshness.mjs's L3 guards on the poll side).
  for (const [label, args] of [
    ["office unreachable", { stamp: stamp(), officeCrossing: null }],
    ["an older build stamper", { stamp: stamp({ crossing: null }), officeCrossing: 149 }],
    ["a build that could not ask", { stamp: stamp({ crossing: undefined }), officeCrossing: 149 }],
  ]) {
    const said = describeFreshness({ ...args, nowMs: NOW });
    assert.equal(said.text, "This page was made 17 minutes ago.", `${label}: says when, claims nothing else`);
    assert.equal(said.cls, null, `${label}: not green — it learned nothing to be green about`);
    assert.equal(said.stale, false);
    assert.doesNotMatch(said.text, /crossing/, `${label}: must not name a crossing it could not verify`);
  }
});

test("no stamp at all is SILENCE, not a sentence about the machinery", () => {
  // Omit, don't negate. "This page could not determine its age" describes the
  // pipeline to someone who came to read their mail; the floor sentence beside
  // it already says what the page is.
  for (const s of [null, undefined, "", 0, { built_at: "not a date" }]) {
    const said = describeFreshness({ stamp: s, officeCrossing: 149, nowMs: NOW });
    assert.equal(said.text, "", `${JSON.stringify(s)} must produce no line at all`);
    assert.equal(said.stale, false);
  }
});

test("crossing ZERO compares like any other crossing", () => {
  // The town's first ferry is a real crossing, and `if (crossing)` would drop
  // it. Wrong on exactly one day in the town's life, and that day is history.
  assert.equal(describeFreshness({ stamp: stamp({ crossing: 0 }), officeCrossing: 0, nowMs: NOW }).stale, false);
  assert.equal(describeFreshness({ stamp: stamp({ crossing: 0 }), officeCrossing: 1, nowMs: NOW }).stale, true);
});

test("agePhrase speaks a reader's units", () => {
  assert.equal(agePhrase(30_000), "just now");
  assert.equal(agePhrase(18 * 60_000), "18 minutes ago");
  assert.equal(agePhrase(60 * 60_000), "an hour ago");
  assert.equal(agePhrase(5 * 60 * 60_000), "5 hours ago");
  assert.equal(agePhrase(26 * 60 * 60_000), "yesterday");
  assert.equal(agePhrase(-1), null, "a page from the future is unreadable, not negative-aged");
});

test("the floor sentence promises only what the town's own box controls", () => {
  // "never prints a cadence promise it does not control" — with the refresh on
  // postmark-site-refresh.timer, the town owns this cadence, so it may be said
  // plainly. It must NOT go back to naming a scheduler nobody here runs.
  // #2353 (lupi, measured 09-02→04): "~30" is the median, not a ceiling — the sentence says so
  assert.match(CADENCE_FLOOR, /about every 30 minutes (the median — occasionally much longer)/);
  assert.match(CADENCE_FLOOR, /phased to the ferry crossings/);
  assert.doesNotMatch(CADENCE_FLOOR, /GitHub|Actions/i,
    "the box timer is the trigger now; naming GitHub would be a promise about someone else's scheduler");
});
