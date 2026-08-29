// world2-ledger.test.mjs — the walk ledger the site now SERVES, and whether the
// world's own parser can read it.
//
//   node --test test/world2-ledger.test.mjs
//
// `WORLD/walk-ledger.md` was the last record on the world page still coming off
// the pinned package. `/world2/walks` — "the walk ledger's grammar, served from
// acts" — replaced its author on 2026-08-28, and this is the check that the
// replacement is still the same record.
//
// THE LAW THIS ASSERTS, from the ledger's own head, verbatim:
//
//     "position is a pure function of the line and the clock"
//
// which is why the composition may not re-spell anything. The door hands back
// each departure's LINE; if the site formatted its own from the parts, there
// would be two authors of the grammar that IS the record, and the page would be
// one rounding rule away from telling a resident they are somewhere they are
// not. So the test that matters is not "does it look like a ledger" but "does
// the world's OWN parser read back exactly what the door said" — asserted with
// `parseWalkLedger` itself, loaded out of the pinned package the same way
// `world-engine-island` loads everything else it serves.
//
// No network: the door's rows are fixtures here. The live read has its own
// receipt at build time (the island prints the departure count it staged).

import test from "node:test";
import assert from "node:assert/strict";

import { walkLedgerFrom } from "../tools/world2-door.mjs";

// The package's own parser, reached by PATH rather than by specifier:
// `postmark-world` declares no `./tools/*` subpath export, and
// `world-engine-island` reaches into that same directory to stage those very
// modules (`join(pkg, "tools", f)`). Same seam, same reason. A missing package
// throws here, which is the right answer — the build hard-fails on it too.
const { parseWalkLedger } = await import(
  new URL("../node_modules/postmark-world/tools/walk.mjs", import.meta.url).href);

/** two rows exactly as `/world2/walks` returns them, one per era */
const ROWS = [
  {
    iso: "2026-07-29T22:33:50.375Z", handle: "wright", era: "ledger",
    from: { x: 575, y: -2600 }, toward: { x: -210, y: -1093 }, at: 95.8803, pace: null,
    line: "- 2026-07-29T22:33:50.375Z · wright · from 575,-2600 · toward -210,-1093 · at 95.8803",
  },
  {
    iso: "2026-08-27T09:57:00.374Z", handle: "fabel-of-garrison", era: "journal",
    from: { x: -1500, y: -2300 }, toward: { x: -1380, y: -2543 }, at: 152.82917256944444,
    to: "sol-of-garrison/the-heart-house", pace: 60, line_derived: true,
    line: "- 2026-08-27T09:57:00.374Z · fabel-of-garrison · from -1500,-2300 · toward -1380,-2543 · at 152.8292 · to sol-of-garrison/the-heart-house · pace 60",
  },
];

test("position is a pure function of the line and the clock: the world's own parser reads back every departure the door spelled", () => {
  const { departures, unrecognized } = parseWalkLedger(walkLedgerFrom(ROWS));
  assert.equal(departures.length, 2);
  assert.deepEqual(unrecognized ?? [], []);
  // the trailing halves of the grammar survive: the asked-for mark and the
  // per-leg pace, which is the law as it stood at that departure
  assert.equal(departures[1].handle, "fabel-of-garrison");
  assert.equal(departures[1].targetMarkId, "sol-of-garrison/the-heart-house");
  assert.equal(departures[1].pace, 60);
});

test("the file is the door's own lines, in the door's own order — nothing re-spelled", () => {
  const body = walkLedgerFrom(ROWS);
  const lines = body.split("\n").filter((l) => l.startsWith("- "));
  assert.deepEqual(lines, ROWS.map((r) => r.line));
});

test("the can-fail flip: a line this side re-formatted would not be the door's line", () => {
  // If `walkLedgerFrom` ever starts building its own line out of the parts —
  // rounding `at` its own way, spelling `pace` its own way — the assertion
  // above stops being about the door. This proves it can notice: the same rows
  // with a re-spelled line come back re-spelled, and the equality fails.
  const respelled = ROWS.map((r) => ({ ...r, line: r.line.replace(/at (\d+)\.(\d+)/, "at $1.$20") }));
  const lines = walkLedgerFrom(respelled).split("\n").filter((l) => l.startsWith("- "));
  assert.notDeepEqual(lines, ROWS.map((r) => r.line));
});

test("a departure the door could not spell is dropped, never half-written", () => {
  // A row with no `line` is an act the store holds and the record's grammar
  // cannot express. Inventing a line for it would make this file a second
  // author of the record; leaving a blank or a partial line would make it
  // unparseable. It is left out, and `doorWalkLedger` reports it as a gap.
  const body = walkLedgerFrom([ROWS[0], { iso: "2026-08-01T00:00:00Z", handle: "nobody", line: null }, ROWS[1]]);
  const { departures, unrecognized } = parseWalkLedger(body);
  assert.equal(departures.length, 2);
  assert.deepEqual(unrecognized ?? [], []);
  assert.ok(!body.includes("nobody"));
});

test("the can-fail flip: an unspellable row that WAS admitted would break the parse", () => {
  // Same fixture, admitted rather than dropped — the assertion above only means
  // something if the parser would actually have complained.
  const bad = `${walkLedgerFrom([ROWS[0]])}- 2026-08-01T00:00:00Z · nobody · from ?\n`;
  const { unrecognized } = parseWalkLedger(bad);
  assert.equal((unrecognized ?? []).length, 1);
});

test("the head carries the grammar, and the head is not a departure", () => {
  const body = walkLedgerFrom(ROWS);
  assert.match(body, /^# Walk ledger/);
  assert.match(body, /Grammar: `- <iso> · <handle> · from <x>,<y> · toward <x>,<y> · at <fractional-crossing>/);
  // prose lines are tolerated by the parser rather than counted as records
  assert.equal(parseWalkLedger(body).departures.length, 2);
});
