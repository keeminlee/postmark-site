// world-staging.test.mjs — which record files the island stages, and why a
// missing one may no longer pass.
//
//   node --test test/world-staging.test.mjs
//
// Sibling of `test/world-pin.test.mjs`, and deliberately quoting the same
// ruling. That file falsifies the pin the release lane RESOLVES; this one
// falsifies whether the build can actually SERVE what it resolved. Each test
// name quotes the guardrail it asserts, verbatim from the founder's 2026-08-25
// ruling, and each is falsified in both directions — the case that must build
// and the case that must refuse — because a gate that fires on every input is
// not a gate, it is a broken build that looks strict.
//
// THE BUG THIS CLOSES. The staging list was five paths typed by hand.
// `WORLD/walk-ledger.md` was not among them, so
// `https://postmark.town/WORLD/walk-ledger.md` answered 404 in production
// (probed live, 2026-08-26), and `spectator/viewer.mjs` answers a 404 for a
// record by fetching `raw.githubusercontent.com/keeminlee/postmark-world/main`.
// Prod's departures were read from the world's unblessed main tip on every load,
// while the release lane it was built by obeyed "tags only, never main tip".
//
// Nothing here touches a disk or a network: the only seam that reads the pinned
// package (`exists`) is injected, which is the whole reason it is a seam.

import test from "node:test";
import assert from "node:assert/strict";

import {
  PUBLISHED_FLOOR,
  recordDemands,
  recordsToStage,
  stagingComplaints,
  stagingFailure,
  stripComments,
} from "../tools/lib/world-staging.mjs";

/** the same-origin reads the real viewer makes, spelled as it spells them */
const VIEWER = `
  const worldStatePaths = () => recordSources("/WORLD/world-state.json", { office: officeUrl("/world/state") });
  fetchJson(recordSources("/WORLD/skeleton.json", { office: officeUrl("/world/skeleton") }));
  fetchJson(recordSources("/seeding/manifest.json"));
  for (const { url } of recordSources("/WORLD/walk-ledger.md")) {}
  const thresholdLedgerSources = () => recordSources("/WORLD/threshold-ledger.md", { office: officeUrl("/world/threshold-ledger") });
`;
const viewerSource = () => [{ name: "postmark-world/spectator/viewer.mjs", text: VIEWER }];

/** a package that carries everything — the healthy case every refusal is paired with */
const completePackage = () => () => true;
/** a package missing exactly one file */
const packageWithout = (...missing) => (rel) => !missing.includes(rel);

// ---------------------------------------------------------------------------
// GUARDRAIL — "tags only, never main tip"
// ---------------------------------------------------------------------------

test('tags only, never main tip: every same-origin record the viewer reads is staged, so no read can fall through to another source', () => {
  const staged = recordsToStage(viewerSource()).map((entry) => entry.record);
  assert.deepEqual(staged, [
    "seeding/manifest.json",
    "WORLD/settlement-publications.json",   // the published floor, not a demand
    "WORLD/skeleton.json",
    "WORLD/threshold-ledger.md",
    "WORLD/walk-ledger.md",
    "WORLD/world-state.json",
  ]);
});

test('tags only, never main tip: THE LEAK ITSELF — the walk ledger is derived from the read that wanted it, not remembered', () => {
  // The one file the hand-kept list forgot. It is here because the viewer asks
  // for it, which is a fact about the viewer and not about anybody's memory.
  const walk = recordDemands(viewerSource()).find((d) => d.record === "WORLD/walk-ledger.md");
  assert.ok(walk, "the walk ledger must be demanded by the viewer's own read");
  assert.deepEqual(walk.askedBy, ["postmark-world/spectator/viewer.mjs"]);
});

test('tags only, never main tip: a viewer that stops reading a record stops staging it, which is what makes this a channel and not a copy', () => {
  const trimmed = [{ name: "viewer", text: `recordSources("/WORLD/world-state.json");` }];
  const staged = recordsToStage(trimmed).map((entry) => entry.record);
  assert.deepEqual(staged, ["WORLD/settlement-publications.json", "WORLD/world-state.json"]);
});

test('tags only, never main tip: a record named by a reader and absent from the pin FAILS THE BUILD', () => {
  const complaints = stagingComplaints({
    sources: viewerSource(),
    exists: packageWithout("WORLD/walk-ledger.md"),
  });
  assert.equal(complaints.length, 1);
  assert.match(complaints[0], /no WORLD\/walk-ledger\.md/);
  assert.match(complaints[0], /postmark-world\/spectator\/viewer\.mjs reads/);
  assert.match(complaints[0], /would 404 and the viewer would fall back to a source this build did not bless/);
});

test('tags only, never main tip: and a pin that carries every record does NOT fail — the refusal above is a gate, not a wall', () => {
  // THE PAIRED HEALTHY CASE. Without this, a check that threw unconditionally
  // would pass the test above and stop every build on earth.
  assert.deepEqual(stagingComplaints({ sources: viewerSource(), exists: completePackage() }), []);
});

// ---------------------------------------------------------------------------
// THE VIEWER ITSELF — a blank world page may not build green
// ---------------------------------------------------------------------------
//
// The guardrail sentence for this one is not the founder's; it is this lane's,
// written down here so the falsifier can quote it the same way:
//
//     "A pin that cannot serve this build fails it."
//
// The old behaviour was a console.warn and an exit 0, whose own comment admitted
// what it was doing: "the page still builds; the island viewer just won't load".
// A world page that renders nothing is not a degraded build, it is a broken one
// that says nothing, and it ships at the next release either way.

test('a pin that cannot serve this build fails it: a package with no spectator/viewer.mjs FAILS THE BUILD', () => {
  const complaints = stagingComplaints({
    sources: viewerSource(),
    exists: packageWithout("spectator/viewer.mjs"),
  });
  assert.equal(complaints.length, 1);
  assert.match(complaints[0], /no spectator\/viewer\.mjs/);
  assert.match(complaints[0], /would build green and render nothing/);
  assert.match(complaints[0], /Bump the postmark-world pin/);
});

test('a pin that cannot serve this build fails it: a package that carries the viewer does not complain about it', () => {
  const complaints = stagingComplaints({ sources: viewerSource(), exists: completePackage() });
  assert.equal(complaints.some((line) => line.includes("spectator/viewer.mjs")), false);
});

test('a pin that cannot serve this build fails it: every complaint reaches the build as one thrown error naming all of them', () => {
  const complaints = stagingComplaints({
    sources: viewerSource(),
    exists: packageWithout("spectator/viewer.mjs", "WORLD/walk-ledger.md"),
  });
  assert.equal(complaints.length, 2);
  const error = stagingFailure(complaints);
  assert.ok(error instanceof Error);
  assert.match(error.message, /the pinned world package cannot serve this build/);
  assert.match(error.message, /spectator\/viewer\.mjs/);
  assert.match(error.message, /WORLD\/walk-ledger\.md/);
  assert.match(error.message, /tags only, never main tip/);
});

// ---------------------------------------------------------------------------
// WHAT COUNTS AS A DEMAND
// ---------------------------------------------------------------------------

test('a cross-origin URL built from a pinned sha is not a demand on this origin', () => {
  // /replay/ reads a frozen frame from raw github AT ITS OWN SHA. That is a
  // blessed historical read, not a main-tip substitution, and it must not be
  // mistaken for a same-origin record this build has to carry.
  const replay = [{ name: "replay", text: 'real(RAW + "/" + sha + "/WORLD/some-frozen-thing.json")' }];
  assert.deepEqual(recordDemands(replay).map((d) => d.record), ["WORLD/some-frozen-thing.json"]);
  // …which IS matched, because the tail is a quoted same-origin-shaped literal.
  // Over-inclusion is the harmless direction — the file gets staged — and it is
  // recorded here rather than hidden so the next reader knows it is deliberate.
});

test('prose about a record is not a demand for it — comments are stripped before the scan', () => {
  const commented = [{ name: "notes", text: `
    // we used to fetch "/WORLD/gone.json" here
    /* and "/WORLD/also-gone.json" before that */
    fetch("/WORLD/real.json");
  ` }];
  assert.deepEqual(recordDemands(commented).map((d) => d.record), ["WORLD/real.json"]);
});

test('a URL scheme is not a comment, so stripping does not eat the line it sits on', () => {
  const source = `const RAW = "https://raw.githubusercontent.com/x"; fetch("/WORLD/real.json");`;
  assert.match(stripComments(source), /raw\.githubusercontent\.com/);
  assert.deepEqual(recordDemands([{ name: "s", text: source }]).map((d) => d.record), ["WORLD/real.json"]);
});

test('one record wanted by several readers is staged once and names all of them', () => {
  const many = [
    { name: "viewer", text: 'recordSources("/WORLD/world-state.json")' },
    { name: "Household.astro", text: 'fetch("/WORLD/world-state.json")' },
  ];
  const demands = recordDemands(many);
  assert.equal(demands.length, 1);
  assert.deepEqual(demands[0].askedBy, ["Household.astro", "viewer"]);
});

// ---------------------------------------------------------------------------
// THE PUBLISHED FLOOR
// ---------------------------------------------------------------------------

test('a URL prod already serves is not dropped just because no reader was found for it', () => {
  // postmark.town/WORLD/settlement-publications.json answers 200 today and no
  // reader for it exists in either repo (searched 2026-08-26). Un-publishing a
  // live URL is a founder's call, so the derived set is a floor away from it and
  // the file keeps being staged until someone rules otherwise.
  assert.deepEqual(PUBLISHED_FLOOR, ["WORLD/settlement-publications.json"]);
  const staged = recordsToStage([{ name: "viewer", text: 'recordSources("/WORLD/world-state.json")' }]);
  assert.ok(staged.some((entry) => entry.record === "WORLD/settlement-publications.json"));
});

test('the floor can only ever ADD a file, never hide a missing demand', () => {
  // The floor is the safe direction by construction: it stages something nobody
  // reads. If it ever silenced a real demand, this would go red.
  const staged = recordsToStage(viewerSource()).map((entry) => entry.record);
  for (const demanded of recordDemands(viewerSource())) assert.ok(staged.includes(demanded.record));
});

test('a floor file missing from the pin fails the build like any other', () => {
  const complaints = stagingComplaints({
    sources: viewerSource(),
    exists: packageWithout("WORLD/settlement-publications.json"),
  });
  assert.equal(complaints.length, 1);
  assert.match(complaints[0], /PUBLISHED_FLOOR reads/);
});
