// nav.test.mjs — the rail is held to its own law.
//
//   node --test test/nav.test.mjs
//
// THE LAW, verbatim from `src/lib/nav.mjs`:
//
//   "a page per read, a read per page; this structure is the rail's single source"
//
// /votes/ was a complete ballot page that lived its whole life in no nav array.
// Nothing caught it because nothing was watching: the header was a hand-kept
// list and a hand-kept list has no failure mode. These are the two watchers.
//
//   1. A READ PER PAGE — every entry resolves to a route that exists. A rail
//      pointing at a 404 fails here.
//   2. A PAGE PER READ — every entry that owns a page is marked `active` by
//      that page, so the seat can actually light up. An entry that renders but
//      can never highlight is the ballot's silence again, one step quieter.
//
// Both rules are escapable, and escaping costs a sentence: an entry declares
// `noActive: "<why>"` or `held: "<why>"` in the structure itself, next to
// itself, where the next reader meets it. An UNDECLARED miss still fails —
// which is the whole difference between this and the array it replaces.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RAIL, allEntries, sectionOf, stripFor, HARBOR } from "../src/lib/nav.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");

// A route resolves the way Astro resolves it: /daily/ is served by either
// daily.astro or daily/index.astro, and either one is a real page.
function pageFileFor(href) {
  const path = href.split("#")[0].split("?")[0];
  const segs = path.split("/").filter(Boolean);
  const base = segs.length ? join(PAGES, ...segs) : join(PAGES, "index");
  for (const cand of segs.length ? [`${base}.astro`, join(base, "index.astro")] : [`${base}.astro`]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

function everyPageFile(dir = PAGES) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...everyPageFile(full));
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

// The `active` keys the pages themselves claim.
const CLAIMED = new Set();
for (const f of everyPageFile()) {
  for (const m of readFileSync(f, "utf8").matchAll(/\bactive=(?:"([^"]*)"|\{`?([^}`]*)`?\})/g)) {
    const k = (m[1] ?? m[2] ?? "").trim();
    if (k) CLAIMED.add(k);
  }
}

// ── rule 1: a read per page ──────────────────────────────────────────────────

test("every rail and strip entry resolves to a route that exists", () => {
  for (const e of allEntries()) {
    if (e.external) {
      assert.match(e.href, /^https:\/\//, `${e.key}: an external seat needs an absolute URL`);
      continue;
    }
    assert.ok(pageFileFor(e.href), `${e.section}/${e.key} points at ${e.href}, which no page serves`);
  }
});

test("a held entry is still a real route — the hold is on the seat, never on the page", () => {
  const held = allEntries().filter((e) => e.held);
  assert.ok(held.length, "no held entry left to check — delete this test with the last one");
  for (const e of held) {
    assert.ok(pageFileFor(e.href), `${e.key} is held AND unreachable, which is just missing`);
    assert.ok((e.held ?? "").trim().length >= 20, `${e.key} is held with no reason on file`);
  }
});

// ── rule 2: a page per read ──────────────────────────────────────────────────

test("every entry that owns a page is marked active by that page, or says why not", () => {
  const orphans = [];
  for (const e of allEntries()) {
    if (e.external) continue;
    if (e.noActive) {
      assert.ok((e.noActive ?? "").trim().length >= 20, `${e.key} escapes the law with no reason on file`);
      continue;
    }
    if (!CLAIMED.has(e.key)) orphans.push(`${e.section}/${e.key} (${e.href})`);
  }
  assert.deepEqual(orphans, [], `these entries can never light up — no page passes their key as \`active\`:\n  ${orphans.join("\n  ")}`);
});

test("THE BALLOT, by name — the page this law exists because of", () => {
  // Not a redundant case. This is the one the old array got wrong, and a
  // refactor that quietly drops the votes entry should cost a named failure,
  // not a silently shorter list.
  const ballot = allEntries().find((e) => e.key === "votes");
  assert.ok(ballot, "the ballot left the rail");
  assert.equal(ballot.href, "/votes/");
  assert.ok(pageFileFor("/votes/"));
  assert.ok(CLAIMED.has("votes"), "/votes/ does not mark itself active — the seat is there and dead");
});

// ── the shape ────────────────────────────────────────────────────────────────

test("the top bar does not crowd: six seats, and the sections carry the rest", () => {
  assert.ok(RAIL.length <= 6, `the top rail has grown to ${RAIL.length} seats`);
  // and the rest genuinely IS carried — a rail of six naming nothing else would
  // pass the count and fail the reader
  const total = allEntries().length;
  assert.ok(total > RAIL.length, "no section carries any members; the strips are empty");
});

test("no key is used twice — a duplicate silently steals the other's highlight", () => {
  const seen = new Map();
  for (const s of RAIL) {
    for (const m of s.members ?? []) {
      const prior = seen.get(m.key);
      // a section's own key repeating as its FIRST member is the landing
      // pattern (the World's "living map", the Town's "ferry's daily") and is
      // deliberate; anything else is a collision
      assert.ok(!prior || prior === s.key, `key "${m.key}" is claimed by both ${prior} and ${s.key}`);
      seen.set(m.key, s.key);
    }
  }
});

test("a section seat lands on a real page of its own, not on a menu that opens nothing", () => {
  for (const s of RAIL) {
    if (!s.members) continue;
    const first = s.members[0];
    assert.equal(first.href, s.href, `${s.key}'s seat and its first strip entry disagree about where the section starts`);
  }
});

// ── the lookups the layout renders from ──────────────────────────────────────

test("a member page finds its section, so the seat lights up from anywhere in the family", () => {
  assert.equal(sectionOf("mail").key, "daily");        // deep in The Town
  assert.equal(sectionOf("atlas").key, "world");       // a lens on The World
  assert.equal(sectionOf("votes").key, "daily");
  assert.equal(sectionOf("works").key, "works");       // its own seat, no family
  assert.equal(sectionOf("harbor").key, "harbor");
  // an orphan page (the darkroom, the ops desk) is deliberately in no section
  assert.equal(sectionOf(""), null);
  assert.equal(sectionOf("darkroom"), null);
});

test("the strip a page draws never shows a held entry, and never appears where there is no family", () => {
  const town = stripFor("mail");
  assert.equal(town.section.label, "The Town");
  assert.ok(town.members.some((m) => m.key === "votes"), "the ballot is missing from its own strip");
  assert.equal(town.members.some((m) => m.key === "numbers"), false, "the S4 hold leaked onto the strip");
  // the held page still draws its section's strip when a reader lands on it
  assert.equal(stripFor("numbers").section.key, "daily");
  // and a seat with no members draws nothing at all
  assert.equal(stripFor("works"), null);
  assert.equal(stripFor(""), null);
});

test("the Harbor keeps its own flag — a root-relative spelling would be wrong from one of the two domains", () => {
  assert.equal(HARBOR, "https://1f4ee.town/");
  const h = RAIL.find((s) => s.key === "harbor");
  assert.equal(h.external, true);
  assert.equal(h.href, HARBOR);
});
