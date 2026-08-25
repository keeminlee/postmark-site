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
// list and a hand-kept list has no failure mode. These are the watchers.
//
//   1. A READ PER PAGE — every entry resolves to a route that exists. A rail
//      pointing at a 404 fails here.
//   2. A PAGE PER READ — every entry that owns a page is marked `active` by
//      that page, so the seat can actually light up. An entry that renders but
//      can never highlight is the ballot's silence again, one step quieter.
//   3. THE FIRST CHIP IS THE AGGREGATE — new with the chip wave. Every row's
//      first chip is the thing the row is OF: the section's own bare read, the
//      member's own page. A row whose first chip is one of its peers is a row
//      with no whole, which is the defect the founder actually named when he
//      walked the site on 2026-08-25 — The Town landed on Ferry's Daily, so the
//      town had no page of its own and nobody had noticed for a year.
//
// Rules 1 and 2 are escapable, and escaping costs a sentence: an entry declares
// `noActive: "<why>"` or `held: "<why>"` in the structure itself, next to
// itself, where the next reader meets it. An UNDECLARED miss still fails —
// which is the whole difference between this and the array it replaces. Rule 3
// is NOT escapable: a row without an aggregate is the thing this wave exists to
// remove, so there is no reason string that buys it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RAIL, allEntries, sectionOf, chipsFor, subChipsFor, rowFor, HARBOR } from "../src/lib/nav.mjs";

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

// The `active` key a page claims is the one it passes to POSTMARKLAYOUT, and
// only that one.
//
// This used to scan the whole file for any `active=`, which was true enough
// until a page could contain a second component that also takes an `active`
// prop. Then `<PageChips active="compose" />` sitting in the body was enough to
// make the file "claim" compose while the layout was told `mail` — and the
// can-fail flip on this suite passed green with the defect installed. A probe
// that cannot fail on the thing it names is not a probe, so it reads the
// opening layout tag now and nothing else.
//
// A key legitimately has SEVERAL claimants — /residents/, a resident's own
// page, a rendition and a household all tell the layout `residents`, because
// they are all that room — so this is a key → set, and the sharp question below
// is whether a chip's own target is among them. A page that renders its own
// document instead of the layout (a redirect stub, the World's shell) claims
// nothing, which is exactly right: it is not a chip's page.
const CLAIMED = new Map();   // key -> Set of page files claiming it

/** The opening <PostmarkLayout …> tag of a page file, or null if it renders its
 *  own document (a redirect stub, the World's spectator shell). */
function layoutTagOf(file) {
  return /<PostmarkLayout\b[^>]*>/s.exec(readFileSync(file, "utf8"))?.[0] ?? null;
}

/** The `active` key THIS page hands the layout — read from the opening tag and
 *  nowhere else, for the reason in the comment above. "" when it claims none. */
function activeKeyOf(file) {
  const open = layoutTagOf(file);
  if (!open) return "";
  const m = /\bactive=(?:"([^"]*)"|\{`?([^}`]*)`?\})/.exec(open);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

for (const f of everyPageFile()) {
  const k = activeKeyOf(f);
  if (!k) continue;
  if (!CLAIMED.has(k)) CLAIMED.set(k, new Set());
  CLAIMED.get(k).add(f);
}

// ── rule 1: a read per page ──────────────────────────────────────────────────

test("every chip, at every depth, resolves to a route that exists", () => {
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

test("every chip that owns a page is marked active by that page, or says why not", () => {
  const orphans = [];
  for (const e of allEntries()) {
    if (e.external) continue;
    if (e.noActive) {
      assert.ok((e.noActive ?? "").trim().length >= 20, `${e.key} escapes the law with no reason on file`);
      continue;
    }
    if (!CLAIMED.has(e.key)) orphans.push(`${e.section}/${e.key} (${e.href})`);
  }
  assert.deepEqual(orphans, [], `these chips can never light up — no page passes their key as \`active\`:\n  ${orphans.join("\n  ")}`);
});

test("THE OTHER DIRECTION — every chip's route claims that chip's own key", () => {
  // Rule 2 asks "does SOME page claim this key". This asks the sharper
  // question: does the page the chip POINTS AT claim it. Both were true by
  // accident before the chip wave, and then /mail/compose/ arrived in a row
  // while still claiming `mail` — a chip pointing at a page that answers to a
  // sibling's name, which lights the wrong chip on arrival and is invisible to
  // every other check here.
  const wrong = [];
  for (const e of allEntries()) {
    if (e.external || e.noActive) continue;
    const file = pageFileFor(e.href);
    if (!file) continue;                       // rule 1 owns that failure
    if (!CLAIMED.get(e.key)?.has(file)) {
      wrong.push(`${e.section}/${e.key} → ${e.href}, whose page answers to some other name`);
    }
  }
  assert.deepEqual(wrong, [], `a chip and its page disagree about the chip's name:\n  ${wrong.join("\n  ")}`);
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

// ── rule 3: the first chip is the aggregate ──────────────────────────────────

test("every chip row leads with its own aggregate, at both depths", () => {
  // The founder's ruling in one assertion. A row's first chip must BE the thing
  // the row belongs to — same key, same href — so a reader who clicks the row's
  // owner and a reader who clicks its first chip land in the same place.
  for (const s of RAIL) {
    if (!s.members) continue;
    const first = s.members[0];
    assert.equal(first.key, s.key,
      `${s.key}'s row leads with "${first.key}" — the section has no chip of its own, so it has no aggregate`);
    assert.equal(first.href, s.href,
      `${s.key}'s seat and its first chip disagree about where the section starts`);
    for (const m of s.members) {
      if (!m.chips) continue;
      const sub = m.chips[0];
      assert.equal(sub.key, m.key,
        `${s.key}/${m.key}'s page row leads with "${sub.key}" — a room's own row must lead with the room`);
      assert.equal(sub.href, m.href,
        `${s.key}/${m.key}'s page row starts somewhere other than the page it belongs to`);
    }
  }
});

test("THE TOWN, by name — the section that had no page of its own", () => {
  // The specific miss the founder found by walking dev. The Town's seat landed
  // on /daily/, which made Ferry's Daily stand in for the whole town; /town/ is
  // the read that was missing. A refactor that folds it back into the Daily
  // should cost a named failure.
  const town = RAIL.find((s) => s.key === "town");
  assert.ok(town, "The Town left the rail");
  assert.equal(town.href, "/town/");
  assert.ok(pageFileFor("/town/"), "/town/ has no page — the section is standing in for itself again");
  assert.equal(town.members[0].key, "town");
  assert.ok(CLAIMED.has("town"));
  // and the Daily is still IN the section, one chip along — demoting the town's
  // newspaper out of the town while giving the town a page would be a worse
  // shape than the one this replaced
  assert.ok(town.members.some((m) => m.key === "daily"), "Ferry's Daily fell out of The Town");
});

// ── the shape ────────────────────────────────────────────────────────────────

test("the top bar is FIVE seats — the founder's ruling, not a ceiling", () => {
  // Postmark · The World · The Town · Harbor · Join/Your House. A sixth seat is
  // a decision someone has to make on purpose, and so is a fifth going missing.
  assert.equal(RAIL.length, 5,
    `the top rail has ${RAIL.length} seats: ${RAIL.map((s) => s.label).join(" · ")}`);
  assert.deepEqual(RAIL.map((s) => s.key), ["postmark", "world", "town", "harbor", "join"]);
  // and the rest genuinely IS carried below — five seats naming nothing else
  // would pass the count and fail the reader
  assert.ok(allEntries().length > RAIL.length * 2, "the sections carry almost nothing; the chip rows are empty");
});

test("The Works is inside The Town, not beside it", () => {
  // Demoted 2026-08-25: "weird having that old surface be first-class". The
  // page is untouched; only its seat moved.
  assert.equal(RAIL.some((s) => s.key === "works"), false, "The Works climbed back onto the top rail");
  assert.equal(sectionOf("works")?.key, "town");
  assert.ok(pageFileFor("/works/"), "The Works was demoted into a 404");
});

test("Your House is the one seat with no row under it", () => {
  // The founder's word, and it is a shape claim, not a laziness one: the
  // household page IS a chip world already, so a section row above it would be
  // the site explaining its own pattern to itself.
  const join = RAIL.find((s) => s.key === "join");
  assert.equal(join.members, undefined, "Your House grew a chip row");
  assert.equal(chipsFor("join"), null);
  assert.equal(join.signedInLabel, "Your House");
  assert.equal(join.houseHref, true, "the signed-in seat no longer points at the reader's own house");
  // the signed-out face is what the static build ships, and it is the Join door
  assert.equal(join.href, "/join/");
  assert.equal(join.signedOutLabel, "Join");
});

test("no key is used twice — a duplicate silently steals the other's highlight", () => {
  const seen = new Map();
  for (const s of RAIL) {
    for (const m of s.members ?? []) {
      const prior = seen.get(m.key);
      // a section's own key repeating as its FIRST member is the aggregate
      // (rule 3 above) and is deliberate; anything else is a collision
      assert.ok(!prior || prior === s.key, `key "${m.key}" is claimed by both ${prior} and ${s.key}`);
      seen.set(m.key, s.key);
      for (const c of m.chips ?? []) {
        if (c.key === m.key) continue;   // the room's own aggregate, again
        const p2 = seen.get(c.key);
        assert.ok(!p2, `key "${c.key}" is claimed by both ${p2} and ${m.key}`);
        seen.set(c.key, m.key);
      }
    }
  }
});

// ── the lookups the layout renders from ──────────────────────────────────────

test("a page anywhere in a family finds its section, so the seat lights up", () => {
  assert.equal(sectionOf("mail").key, "town");         // a room of The Town
  assert.equal(sectionOf("returned").key, "town");     // a page INSIDE that room
  assert.equal(sectionOf("meeps").key, "town");        // two levels down, still The Town
  assert.equal(sectionOf("atlas").key, "world");       // a lens on The World
  assert.equal(sectionOf("votes").key, "town");
  assert.equal(sectionOf("works").key, "town");        // demoted this wave
  assert.equal(sectionOf("postmark").key, "postmark"); // the front door, its own seat
  assert.equal(sectionOf("harbor").key, "harbor");
  // an orphan page (the darkroom, the ops desk) is deliberately in no section
  assert.equal(sectionOf(""), null);
  assert.equal(sectionOf("darkroom"), null);
});

test("the section row a page draws never shows a held chip, and never appears where there is no family", () => {
  const town = chipsFor("mail");
  assert.equal(town.of.label, "The Town");
  assert.ok(town.chips.some((m) => m.key === "votes"), "the ballot is missing from its own row");
  assert.ok(town.chips.some((m) => m.key === "works"), "The Works is missing from the row it was demoted into");
  assert.equal(town.chips.some((m) => m.key === "numbers"), false, "the S4 hold leaked onto the row");
  // the held page still draws its section's row when a reader lands on it
  assert.equal(chipsFor("numbers").of.key, "town");
  // a page two levels down draws its SECTION's row, not a truncated one
  assert.equal(chipsFor("returned").of.key, "town");
  // and a seat with no members draws nothing at all
  assert.equal(chipsFor("harbor"), null);
  assert.equal(chipsFor(""), null);
});

test("the page row belongs to the room, and only rooms that split have one", () => {
  const res = subChipsFor("windows");
  assert.equal(res.of.key, "residents", "the windows' page row is kicked by the wrong room");
  assert.deepEqual(res.chips.map((c) => c.key), ["residents", "windows", "meeps"]);
  // the room's own landing draws the same row, with itself lit
  assert.deepEqual(subChipsFor("residents").chips.map((c) => c.key), ["residents", "windows", "meeps"]);
  assert.deepEqual(subChipsFor("compose").chips.map((c) => c.key), ["mail", "returned", "compose"]);
  // a room that did not split has no second row — the chrome appears only where
  // there is something for it to do
  assert.equal(subChipsFor("votes"), null);
  assert.equal(subChipsFor("daily"), null);
  assert.equal(subChipsFor("atlas"), null);
  assert.equal(subChipsFor(""), null);
});

test("the routes that came back from a fold are real pages, not stubs", () => {
  // /bulletin/, /window/ and /meeps/ were all redirect stubs pointing INTO a
  // scroller. The chip wave gave them their content back at the same URLs. A
  // stub would still pass rule 1 (the file exists) and rule 2 is what catches
  // it — a redirect page renders its own document and claims no `active` key —
  // so this names them, because a silent re-fold is exactly the kind of thing
  // that took a year to find last time.
  for (const [key, href] of [["bulletin", "/bulletin/"], ["windows", "/window/"], ["meeps", "/meeps/"]]) {
    const file = pageFileFor(href);
    assert.ok(file, `${href} has no page`);
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes(`active="${key}"`), `${href} does not claim "${key}" — it has folded back into a stub`);
    assert.equal(/http-equiv="refresh"/.test(src), false, `${href} is a redirect again`);
  }
});

// ── the founder's three, walked on dev 2026-08-25 ────────────────────────────
//
// Three defects he named verbatim, and one test each. They are separate from
// the laws above on purpose: those describe the shape the rail should have,
// these describe damage he actually met, and a regression on any of them should
// fail under his own words rather than under a paraphrase of them.

test("YOUR HOUSE — the seat he clicked, and THE TOWN, the seat that lit up", () => {
  //   "'Your House' click -> selects 'The Town'."
  //
  // The seat leads to /households/<slug>/, and that page was handing the layout
  // `active="residents"` — a key that belongs to The Town's family. So the rail
  // lit the section the reader had just deliberately left, every time. This
  // reads the key off the REAL page and runs it through the REAL derivation the
  // layout uses, so restoring either half of the defect turns it red.
  const seat = RAIL.find((s) => s.key === "join");
  const page = join(PAGES, "households", "[slug].astro");
  assert.ok(existsSync(page), "the Your House destination has no page");

  const key = activeKeyOf(page);
  assert.equal(key, seat.houseKey, `the household page claims "${key}", which is not this seat's key`);

  const lit = sectionOf(key);
  assert.ok(lit, `nothing in the rail answers to "${key}" — the page lights no seat at all`);
  assert.equal(lit.key, "join", `standing on the Your House page lights "${lit.label}"`);
  assert.notEqual(lit.key, "town", "THE FOUNDER'S DEFECT, restored: Your House lights The Town");
  assert.equal(lit.signedInLabel, "Your House");

  // and the signed-out face must NOT claim the household page as its own: it is
  // the Join door, and the Join door is /join/. The layout gates that face on
  // `active === n.key` rather than on the section, so the key alone settles it.
  assert.notEqual(key, seat.key, "the household page claims the Join door's own key");
});

test("ONE CHIP ROW PER PAGE — never the section's AND the room's", () => {
  //   "we somehow managed to INCREASE the complexity of the site … we just gave
  //    chips to the sub-header rail IN ADDITION to the household rail."
  //
  // Both rows rendered at once, so /residents/ carried the top rail, The Town's
  // eight chips and its own three. The rows compete now: most specific wins.
  assert.equal(rowFor("residents").place, "page", "a room with its own row must draw ITS row, not the section's");
  assert.deepEqual(rowFor("residents").chips.map((c) => c.key), ["residents", "windows", "meeps"]);
  assert.equal(rowFor("windows").place, "page");
  assert.equal(rowFor("compose").place, "page");
  // a page in a section but in no room of its own still gets the section's row —
  // collapsing to one row must not mean collapsing to none
  assert.equal(rowFor("daily").place, "section");
  assert.equal(rowFor("daily").of.key, "town");
  assert.equal(rowFor("atlas").place, "section");
  // Your House takes none, by the founder's word; nor does an orphan page
  assert.equal(rowFor("household"), null, "a section row appeared over the household's own");
  assert.equal(rowFor("join"), null);
  assert.equal(rowFor("darkroom"), null);
  assert.equal(rowFor(""), null);
  // and a page that says it draws its own row gets nothing from the nav
  assert.equal(rowFor("residents", { ownChips: true }), null);

  // THE LAYOUT DRAWS THE ROW ONCE. `rowFor` returning one answer is worthless
  // if the shell renders two components — which is exactly the shape the
  // founder met — so the count is part of the claim.
  // Comment lines are dropped before counting, and that is not tidiness: the
  // first run of this assertion went red on the layout's own sentence saying
  // there is one row. A probe that counts prose fails on documentation and
  // passes on a second render tucked inside a conditional.
  const shell = readFileSync(join(ROOT, "src", "layouts", "PostmarkLayout.astro"), "utf8")
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\{?\/\*)/.test(l)).join("\n");
  assert.equal((shell.match(/<ChipRow\b/g) ?? []).length, 1,
    "PostmarkLayout renders more than one chip row — the stack is back");

  // and no page smuggles a second row in past the shell: the only component
  // that draws its own is the household wrapper, and a page rendering it must
  // either declare `ownChips` or claim a key the nav draws nothing for.
  const doubled = [];
  for (const f of everyPageFile()) {
    if (!/<Household\b/.test(readFileSync(f, "utf8"))) continue;
    const declares = /\bownChips=/.test(layoutTagOf(f) ?? "");
    if (!declares && rowFor(activeKeyOf(f)) !== null) doubled.push(f.replace(ROOT, ""));
  }
  assert.deepEqual(doubled, [], `these pages draw their own chip row AND take one from the nav:\n  ${doubled.join("\n  ")}`);
});

test("/town/ IS NOT A DASHBOARD — no cards restating the chips, no wall of counts", () => {
  //   "https://dev.postmark.town/town/ where we have the same chips AND cards
  //    on the same page, which itself is just filled with… a generic dashboard
  //    of aggregate numbers."
  //
  // The page listed the section's own rooms a second time as a card grid, over
  // four aggregate counts. Both are gone; this is what keeps them gone.
  const src = readFileSync(join(PAGES, "town", "index.astro"), "utf8");

  // THE CARDS. The grid was built by mapping the rail's own members, so the
  // tell is the page reaching for the rail at all — it has a chip row drawn
  // from that same structure directly above it.
  assert.equal(/\bfrom "@\/lib\/nav\.mjs"/.test(src), false,
    "/town/ reads the rail again to restate its own chip row as cards");
  assert.equal(/t-rooms|t-room\b|ROOM_NOTE/.test(src), false, "the card grid is back on /town/");

  // THE DIALS. Four counts assembled from whatever the extracts happened to
  // carry. The town's numbers live at /numbers/, held until S4.
  assert.equal(/t-stats|t-dials|t-stat-note|\bdials\b/.test(src), false,
    "the aggregate-numbers dashboard is back on /town/");
  assert.equal(/from "@\/data\/postmark\/stats\.json"|from "@\/data\/postmark\/economy\.json"/.test(src), false,
    "/town/ imports the counts again");

  // and it is still the section's landing and its first chip — deleting the
  // body must not have deleted the page
  assert.ok(CLAIMED.get("town")?.has(join(PAGES, "town", "index.astro")));
  assert.equal(rowFor("town").place, "section");
  assert.equal(rowFor("town").chips[0].key, "town");
});

test("the Harbor keeps its own flag — a root-relative spelling would be wrong from one of the two domains", () => {
  assert.equal(HARBOR, "https://1f4ee.town/");
  const h = RAIL.find((s) => s.key === "harbor");
  assert.equal(h.external, true);
  assert.equal(h.href, HARBOR);
});
