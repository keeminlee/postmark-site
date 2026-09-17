// world-preload-hints.test.mjs — what the world page tells the browser to fetch
// before anyone asks for it (2026-09-12).
//
//   node --test test/world-preload-hints.test.mjs
//
// THE LAW, in the founder's own words the night he caught it: "let's not preload
// replays." The island hinted every staged .json, and every crossing's replay
// frame is a staged .json — so the head of /world/ carried one
// `<link rel="preload" as="fetch">` per crossing that has ever happened. On prod
// that was 68 links and 810 KB gzipped, pulled on every load, larger than the
// fold itself. Nobody asked for those bytes and nothing waited on them: the page
// fetches a frame when a crossing is actually chosen.
//
// Two directions, because a rule that only ever says "no" is not a rule:
// the replay frames must be absent, AND the hints that carry the page's first
// paint — the engine modules, the fold, the skeleton, the seeding manifest, the
// faces, the settlement publications, the atlas — must still be there, in the
// same order, spelled the same way. The second half is what makes the first half
// a removal rather than a breakage; it reds if the filter is written too wide.
//
// The open path gets a SOURCE PIN, the repo's standing discipline for closure
// code (see test/world-cockpit-dock.test.mjs): the replay opener lives inside an
// `is:inline` IIFE in world.astro with no seam to inject, and a full DOM boot
// would test the harness rather than the fetch. What is pinned is the thing the
// removal could actually have broken — that the frame is FETCHED when a crossing
// is chosen, rather than read out of a cache the preload used to warm. The live
// counterpart (exactly one request per chosen crossing, observed in a browser
// against the built page) is in the piece's report, not here.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { worldPreloadHints } from "../town/scripts/world-engine-island.mjs";

/** The world page's own source, read as itself. */
const worldPage = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

/** A staging walk in the shape `stage()` returns: engine modules, the records
 *  some reader asks this origin for, the derived faces, and the replay files
 *  the record grew — the last of which is the whole question. */
const files = () => [
  { publicPath: "/world-engine/spectator/viewer.mjs" },
  { publicPath: "/world-engine/tools/geometry.mjs" },
  { publicPath: "/seeding/manifest.json" },
  { publicPath: "/WORLD/settlement-publications.json" },
  { publicPath: "/WORLD/skeleton.json" },
  { publicPath: "/WORLD/world-state.json" },
  { publicPath: "/WORLD/walk-ledger.md" },
  { publicPath: "/world-engine/residents-meta.json" },
  { publicPath: "/world-engine/replay/index.json" },
  { publicPath: "/world-engine/replay/118.json" },
  { publicPath: "/world-engine/replay/119.json" },
  { publicPath: "/world-engine/replay/185.json" },
];

test("no crossing's replay frame is hinted, and neither is the replay index", () => {
  const hints = worldPreloadHints(files());
  const replay = hints.filter((tag) => tag.includes("/world-engine/replay/"));
  assert.deepEqual(replay, [],
    "the built /world/ head must carry ZERO preloads under /world-engine/replay/");
});

test("the record's growth cannot put the hint count back on a curve", () => {
  // Four more crossings land. The hint chain must not notice — that is the
  // difference between "one tag removed" and "the generation removed".
  const grown = [...files(),
    { publicPath: "/world-engine/replay/186.json" },
    { publicPath: "/world-engine/replay/187.json" },
    { publicPath: "/world-engine/replay/188.json" },
    { publicPath: "/world-engine/replay/189.json" },
  ];
  assert.equal(worldPreloadHints(grown).length, worldPreloadHints(files()).length,
    "the hint count is flat in the number of crossings");
});

test("every other hint the page carries is unchanged, in count and in content", () => {
  // Written out rather than derived, so a filter that grew too wide reds here
  // with the missing line named. This is the pre-removal output verbatim, minus
  // the replay lines. Order is the emitted order: modules, then fetches.
  //
  // THE ATLAS LINE LEFT 2026-09-16 (#2800). `/atlas/town.html` was appended to
  // the fetch list by hand and stood last; the atlas retired and that path now
  // answers a redirect to /world/, so hinting it would spend a request to be
  // told to go where the reader already is.
  assert.deepEqual(worldPreloadHints(files()), [
    '<link rel="modulepreload" href="/world-engine/spectator/viewer.mjs">',
    '<link rel="modulepreload" href="/world-engine/tools/geometry.mjs">',
    '<link rel="preload" as="fetch" href="/seeding/manifest.json" crossorigin>',
    '<link rel="preload" as="fetch" href="/WORLD/settlement-publications.json" crossorigin>',
    '<link rel="preload" as="fetch" href="/WORLD/skeleton.json" crossorigin>',
    '<link rel="preload" as="fetch" href="/WORLD/world-state.json" crossorigin>',
    '<link rel="preload" as="fetch" href="/world-engine/residents-meta.json" crossorigin>',
  ]);
});

test("the retired atlas is not hinted — a preload for a redirect is a wasted request", () => {
  // Asserted alone, not left to the deepEqual above, because this is the line
  // the retirement removed and a re-added hint should say so by name.
  assert.equal(worldPreloadHints(files()).filter((tag) => tag.includes("/atlas/")).length, 0);
});

test("the fold is still hinted — the removal is the replay's, not the record's", () => {
  // The one hint whose loss would be an actual regression, asserted alone so a
  // future widening of the filter cannot hide behind a long deepEqual.
  const hints = worldPreloadHints(files());
  assert.ok(hints.includes('<link rel="preload" as="fetch" href="/WORLD/world-state.json" crossorigin>'),
    "the fold keeps its preload");
  assert.ok(hints.includes('<link rel="preload" as="fetch" href="/WORLD/skeleton.json" crossorigin>'),
    "the skeleton keeps its preload");
});

test("a record that is not JSON was never hinted and still is not", () => {
  // walk-ledger.md is staged and read by the viewer, and has never been in the
  // fetch list — pinned so the filter rewrite is not read as having dropped it.
  assert.equal(worldPreloadHints(files()).filter((t) => t.includes("walk-ledger")).length, 0);
});

// ── the open path, source-pinned ────────────────────────────────────────────

test("choosing a crossing FETCHES its frame — nothing reads a warmed cache", () => {
  // `real` is the page's captured window.fetch, taken before the replay lens
  // installs its own. Both call sites go through it, so both are real requests.
  assert.match(worldPage, /var real = window\.fetch\.bind\(window\);/,
    "the page captures the live fetch");
  // the armed arrival, at parse time
  assert.match(worldPage, /real\("\/world-engine\/replay\/" \+ at \+ "\.json"\)[\s\S]{0,200}r\.json\(\)/,
    "an armed /world/?crossing=N fetches that frame itself");
  // and stepping between crossings, inside step()
  const step = worldPage.slice(worldPage.indexOf("function step(by)"));
  assert.match(step, /real\("\/world-engine\/replay\/" \+ at \+ "\.json"\)/,
    "step() fetches the crossing it moved to");
  assert.match(worldPage, /real\("\/world-engine\/replay\/index\.json"\)/,
    "the scrubber index is fetched when the panel opens");
});

test("no code path reads a preload entry or a readiness signal", () => {
  // This is what would have made the removal a behaviour change rather than a
  // timing one. It was true before the removal and must stay true.
  assert.doesNotMatch(worldPage, /getEntriesByType|link\[rel=["']?preload/,
    "the world page never inspects the preload cache");
});
