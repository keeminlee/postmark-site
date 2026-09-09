// doorstep-static-is-the-office.test.mjs — the static doorstep IS the office's
// answer, not a second build of it.
//
// THE LAW THIS ASSERTS, verbatim from the office's own doorstep bundle
// (postmark-office src/queries.mjs, `doorstep_version`):
//
//   "the doorstep is a bundle: every segment is the answer of the read its
//    `serves` names, called at its `args` — one implementation."
//
// and the standing site law it serves (Keemin, restated 2026-09-09 as the one
// hard constraint of the Atlas port): "the site ingests just the MCP and API
// instead of Git."
//
// WHAT WENT WRONG WITHOUT IT. data/doorstep/<handle>.json was built here, from
// a git checkout of the town — a second implementation of the same bundle. It
// drifted fat with nobody watching: 309,329 bytes for one resident on
// 2026-09-09, not one letter body among them (every excerpt was already <= 200
// chars) but 474 unbounded rows — the whole 238-conversation ledger, 114
// threads where they spoke last, 122 resting with his word. The office's own
// answer for the same resident, bounded and paged at 20 with a `_total` and a
// cursor beside each list, was 51,933 bytes.
//
// So the file is now the office's object with a named set of site-side keys on
// top, and these tests hold it to exactly that: every office byte arrives
// untouched, nothing the office serves is shadowed, and nothing rides that is
// not on the list.
//
// HOW TO FLIP THESE RED (they were flipped before they were trusted): perturb
// one row in test/fixtures/doorstep-office-wright.json — change a handle, a
// count, one character of a note — and the deep-equal below fails, because the
// golden beside it is a separate committed artifact and does not move with it.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOORSTEP_SITE_KEYS,
  composeDoorstep,
  renderDoorstepMarkdown,
} from "../tools/lib/doorstep.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(HERE, "fixtures", name), "utf8"));

// A REAL office answer — `GET https://postmark.town/api/doorstep/wright`,
// fetched 2026-09-09, with every array trimmed to two rows. Every key and every
// shape the door serves is here; only the row counts are cut, and the row count
// is not what these assert.
const OFFICE = read("doorstep-office-wright.json");
// What the extractor writes for that answer. A separate committed artifact:
// that is what lets the fixture be perturbed and the test go red.
const STATIC = read("doorstep-static-wright.json");

const siteRows = Object.fromEntries(DOORSTEP_SITE_KEYS.map((k) => [k, STATIC[k]]));
const officeHalf = Object.fromEntries(
  Object.entries(STATIC).filter(([k]) => !DOORSTEP_SITE_KEYS.includes(k))
);

test("THE FALSIFIER: the office's answer arrives in the static file byte for byte", () => {
  // not "carries the same fields" — the same object. A segment quietly re-dressed
  // on the way through is the defect this whole lane exists to remove.
  assert.deepEqual(officeHalf, OFFICE,
    "the static doorstep no longer equals the office answer it was fetched from");
});

test("and the file is the office's answer PLUS the named keys, and nothing else", () => {
  assert.deepEqual(
    Object.keys(STATIC).slice().sort(),
    [...Object.keys(OFFICE), ...DOORSTEP_SITE_KEYS].sort(),
    "the static doorstep grew (or lost) a key that is neither the office's nor on the site's own list");
  // the file says out loud which keys are its own — a reader must not have to
  // diff it against the door to find out
  assert.deepEqual(STATIC.site.adds, DOORSTEP_SITE_KEYS.filter((k) => k !== "site"),
    "site.adds does not match the keys actually added");
  for (const key of STATIC.site.adds) {
    assert.ok(STATIC.site.sources[key],
      `site-side key ${key} rides with no source stamp — a stamp names its own source or it is a guess wearing a fact's clothes`);
  }
});

test("composing the office answer reproduces the file exactly", () => {
  assert.deepEqual(composeDoorstep(OFFICE, siteRows), STATIC);
});

test("THE FLIP, mechanised: perturb one row of the office answer and the file no longer matches", () => {
  // The same failure the human flip produces, asserted here so the test proves
  // it can fail rather than asking a reader to take it on faith. If this passes
  // while the deep-equal above also passes, the deep-equal is comparing an
  // object with itself and is worth nothing.
  const perturbed = structuredClone(OFFICE);
  perturbed.awaiting.threads_total = OFFICE.awaiting.threads_total + 1;
  assert.notDeepEqual(officeHalf, perturbed,
    "a changed office answer still matched the static file — the deep-equal above is not reading what it claims");
});

test("the site never shadows a read the office serves", () => {
  for (const key of DOORSTEP_SITE_KEYS) {
    assert.equal(Object.hasOwn(OFFICE, key), false,
      `the office now serves \`${key}\` itself — the site-side copy would overwrite the office's own answer`);
  }
  // and the guard that catches it at build time, not at review time
  assert.throws(() => composeDoorstep({ handle: "wright", prs: ["the office's own"] }, { prs: [] }),
    /the office now serves prs/,
    "a collision with an office segment must stop the build, not silently win");
  assert.throws(() => composeDoorstep({ handle: "wright" }, { invented_key: 1 }),
    /unnamed site-side key/,
    "an unnamed site-side key must stop the build — the file stops being checkable against the door");
});

// ── the caps this page adds on top of the office's ──────────────────────────
//
// The office pages its lists at 20 with a `_total` beside them; this page cuts
// further, to 7. A remainder counted against the 20 the office sent rather than
// against the total in the ledger is a silent denominator — the reader is told
// "+13 more" when 107 are missing. That is the exact shape of the defect this
// lane found in the JSON, reappearing in the markdown, so it gets its own
// falsifier.

test("every cap in the markdown counts against the town's total, never the office's page", () => {
  const many = structuredClone(OFFICE);
  many.awaiting.threads_total = 114;          // what the ledger holds
  many.awaiting.threads = Array.from({ length: 20 }, (_, i) => ({
    thread_of: `t-${i}`, last_from: "solan", last_id: `l-${i}`,
    last_date: "2026-09-01", state: "they_spoke_again",
  }));                                         // what the office sent
  const md = renderDoorstepMarkdown(composeDoorstep(many, siteRows), { townBase: "https://postmark.town" });

  assert.match(md, /### They spoke last \(114\)/,
    "the heading must count the ledger's threads, not the ones on this page");
  // 114 in the ledger, 7 shown -> 107 hidden. 13 would be the page's remainder.
  assert.match(md, /\+107 more/,
    "the remainder must be counted against threads_total; +13 would be the silent-denominator bug");
  assert.equal(/\+13 more/.test(md), false);
  // a cap without a door is a silent cap
  assert.match(md, /read: "mail", view: "awaiting"/,
    "the cap must name the door that serves the rest");
});

test("the markdown says which source each half of its freshness line came from", () => {
  const md = renderDoorstepMarkdown(STATIC, { townBase: "https://postmark.town" });
  // one stamp per answer: the body's age is the office's, the site rows' age is
  // the town commit's. A single line covering both is the confident lie.
  assert.match(md, new RegExp(`office as_of\`: ${OFFICE.as_of}`),
    "the page must stamp the office answer with the office's own as_of");
  assert.match(md, /town commit \(site rows\)`: fixture0/,
    "the page must stamp the site-side rows with the town commit they came from");
  assert.match(md, /fetched`: 2026-09-09T21:00:00\.000Z/,
    "the page must say when it asked the door");
});

test("the page points at the live door it mirrors", () => {
  const md = renderDoorstepMarkdown(STATIC, { townBase: "https://postmark.town" });
  assert.match(md, /https:\/\/postmark\.town\/api\/doorstep\/wright/,
    "a mirror that does not name what it mirrors leaves its reader with no way to get the live answer");
});

test("the rows the office does not serve still reach the page", () => {
  // The reader check, as a test: each site-side key exists because a reader
  // used it, and this asserts the reader still gets it. `on_the_water` is the
  // sharpest — the office's mail segment is DELIVERED mail and structurally
  // cannot carry a letter that has not crossed, and a resident who cannot see
  // those replies to a letter the ledger says never arrived.
  const md = renderDoorstepMarkdown(STATIC, { townBase: "https://postmark.town" });
  assert.match(md, /On the water, not here yet \(1\)/);
  assert.match(md, /#601 merged/, "PR states — the field the office's `moved.prs` line points here for");
  assert.match(md, /gave you 20 stamps/, "the gift rows the office's stamps segment carries only as a total");
  assert.match(md, /Escrowed stakes \(1\)/);
  assert.match(md, /Crossing 179/, "Ferry's line");
  assert.match(md, /Active quests/, "the quest board, with what today still offers");
  assert.match(md, /read in full/, "the hand-set fulltext bulletin lane");
  assert.match(md, /Said to you on GitHub[\s\S]*postmaster/, "what came back on your own PRs");
});
