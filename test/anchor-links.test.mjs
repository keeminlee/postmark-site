// anchor-links.test.mjs — a link with a `#` on it must land on something.
//
//   node --test test/anchor-links.test.mjs
//
// ── WHY THIS FILE EXISTS (#2506) ─────────────────────────────────────────────
// The civic hub linked `<a href="/bulletin/#quests">the full board</a>`. The
// bulletin has no `quests` anchor — its whole rendered page carries exactly one
// id, `board-modal-title`, because its notices are cards keyed by `data-card`
// and not by id. So the reader was sent to a different page, to the top of it,
// with nothing to scroll to, AWAY from the board they were already looking at:
// the only `id="quests"` in the site is on the page doing the linking.
//
// Nothing caught it, and nothing could have. A fragment is invisible to every
// check the site owns: the nav suite proves a rail entry resolves to a PAGE
// (`nav.test.mjs`, "a read per page") and stops at the `#`; the build is happy
// to ship a link to an anchor that does not exist, because that is not an error
// in HTML, it is a link that quietly does nothing. This file is the watcher for
// the half nobody was watching.
//
// ── WHAT IT READS, AND WHY THAT AND NOT THE BUILT PAGES ──────────────────────
// The source under `town/pages/`, not `dist-town/`. The built pages are the
// truer surface and this file would rather read them, but `test.yml` runs
// `npm test` WITHOUT `npm run build`, so a `{ skip: !built }` arm is a
// falsifier that never runs in CI — the exact failure that workflow's own
// header was written about ("a falsifier nobody runs cannot fail"). A source
// read runs on every push, and for this corpus it is exact: every anchor target
// on the site today is a literal `id="…"` in the page's own file. If a page
// ever takes its anchor from a component, this reds and the fix is a declared
// entry below saying so — a loud false alarm, which is the safe direction.
//
// ── WHAT IT DOES NOT READ, EACH WITH ITS REASON ──────────────────────────────
//   · Computed hrefs — `href={`/bulletin/#${b.slug}`}` (town/pages/index.astro
//     :443) and the four same-page `href={`#${…}`}` rails. A static read cannot
//     resolve a template, so asserting on them would be theatre. Noted rather
//     than silently dropped: the computed bulletin link is a live instance of
//     the same class this file exists for — every bulletin teaser on the home
//     page deep-links a card slug the bulletin renders no id for.
//   · Links built in script, e.g. `var RECORDS = { "illuminator-name":
//     "/bulletin/#name-the-illuminator" }` (town/pages/votes/index.astro:127).
//     Same target as a real href below, so the class is already on the record.
//   · Off-site links. Another site's anchors are not ours to hold.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");

// ── THE KNOWN-OPEN LEDGER ────────────────────────────────────────────────────
// Dead anchors that are NOT this issue's to repair, each with the reason. The
// precedent is `nav.test.mjs`'s `held:` / `noActive:` escapes: a miss may be
// declared, and declaring it costs a sentence written where the next reader
// meets it. An UNDECLARED miss still reds, which is the whole point.
//
// Every one of these points at `/bulletin/`, and they are one finding, not
// three: the bulletin is a wall of cards with no ids on it, so EVERY deep link
// into it is dead. Repairing that is a decision about whether the bulletin's
// notices are addressable — a shape call for the founder, not a lane's fix —
// which is why #2506 repaired the link whose board was already elsewhere and
// left these standing. Reported on #2506.
//
// A stale entry is a lie too, so the second test below makes every entry prove
// its link is still written where it says it is.
const KNOWN_OPEN = [
  {
    page: "index.astro",
    href: "/bulletin/#name-the-illuminator",
    why: "a bulletin CARD slug, not a section. The bulletin renders notices as `data-card` buttons that open a modal; there is no id to land on, and giving one to every card is a shape call.",
  },
  {
    page: "town/index.astro",
    href: "/bulletin/#marketplace",
    why: "same wall, same absence. Unlike #quests this one is NOT trivially repointable — the prose around it names the bulletin as the authority for the price rows, so where it should land is a content call, not a typo.",
  },
];

/** Every .astro page under town/pages, deepest included. */
function everyPageFile(dir = PAGES, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) everyPageFile(full, out);
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

/** A route resolves the way Astro resolves it — nav.test.mjs's rule, kept identical. */
function pageFileFor(path) {
  const segs = path.split("/").filter(Boolean);
  const base = segs.length ? join(PAGES, ...segs) : join(PAGES, "index");
  for (const cand of segs.length ? [`${base}.astro`, join(base, "index.astro")] : [`${base}.astro`]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/** Literal ids on a page. `id={expr}` is deliberately not counted — it cannot be resolved statically. */
export function idsIn(src) {
  return new Set(Array.from(src.matchAll(/\bid="([^"]+)"/g), (m) => m[1]));
}

/**
 * Every in-site fragment link written as a literal href.
 * `href="/town/#pots"` → { path: "/town/", frag: "pots" }
 * `href="#seam"`       → { path: "", frag: "seam" }  (the page itself)
 * Off-site and computed hrefs are not matched, by construction.
 */
export function fragmentLinksIn(src) {
  const out = [];
  for (const m of src.matchAll(/href="(\/[^"#\s]*|)#([^"\s]+)"/g)) {
    out.push({ path: m[1], frag: m[2], href: `${m[1]}#${m[2]}` });
  }
  return out;
}

const rel = (f) => relative(PAGES, f).split("\\").join("/");

/** Every fragment link on the site, resolved: { from, href, path, frag, target, dead, noPage } */
function survey() {
  const out = [];
  for (const file of everyPageFile()) {
    const src = readFileSync(file, "utf8");
    for (const link of fragmentLinksIn(src)) {
      const target = link.path === "" ? file : pageFileFor(link.path);
      const noPage = target === null;
      const dead = noPage ? true : !idsIn(readFileSync(target, "utf8")).has(link.frag);
      out.push({ from: rel(file), ...link, target, noPage, dead });
    }
  }
  return out;
}

const declared = (l) => KNOWN_OPEN.some((k) => k.page === l.from && k.href === l.href);

// ── THE LAW ──────────────────────────────────────────────────────────────────

test("the survey reads something — a check over an empty corpus is not a check", () => {
  const all = survey();
  assert.ok(all.length >= 10,
    `only ${all.length} fragment links found under town/pages — the regex or the walk has stopped working`);
});

test("every in-site #anchor link lands on an id that exists on the page it names", () => {
  const undeclaredDead = survey().filter((l) => l.dead && !declared(l));
  assert.deepEqual(
    undeclaredDead.map((l) => `${l.from} → ${l.href}${l.noPage ? "  (no such page)" : "  (no such anchor on that page)"}`),
    [],
    "a link carries a fragment the destination page has no id for, so it lands at the top of that page with nothing to scroll to. " +
    "Either point it where the thing actually is, give the destination the anchor, or declare it in KNOWN_OPEN with the reason.",
  );
});

test("the civic hub's quest link names the page that renders the board (#2506)", () => {
  // The instance the file was born for, pinned by name so a repoint has to
  // argue with it rather than slip past the general law above.
  const hub = readFileSync(join(PAGES, "town", "index.astro"), "utf8");
  assert.equal(hub.includes('href="/bulletin/#quests"'), false,
    "the hub links /bulletin/#quests again — the bulletin has no `quests` anchor, it never had one, and the board is on the hub itself");
  assert.ok(hub.includes('href="/town/#quests"'),
    "`the full board` no longer names /town/#quests — the Quests grid is the board and `id=\"quests\"` is where it lives");
  assert.ok(idsIn(hub).has("quests"),
    "the hub lost `id=\"quests\"`, so the link above now points at nothing on its own page");
});

test("no KNOWN_OPEN entry has gone stale — a declared miss must still be a miss that is written there", () => {
  const stale = [];
  for (const k of KNOWN_OPEN) {
    const file = join(PAGES, k.page);
    if (!existsSync(file)) { stale.push(`${k.page} — the page is gone`); continue; }
    if (!readFileSync(file, "utf8").includes(`href="${k.href}"`)) {
      stale.push(`${k.page} → ${k.href} — no longer written there`);
    }
  }
  assert.deepEqual(stale, [],
    "a KNOWN_OPEN entry names a link that is no longer in the file. If it was repaired, delete the entry; " +
    "the ledger is only worth its lines while every line is still true.");
});

// ── THE PROBE CAN FAIL ───────────────────────────────────────────────────────
// Both halves, on synthetic input, so a green above is a green about the site
// and not about a regex that matches nothing.

test("the reader finds a dead anchor and passes a live one", () => {
  const page = '<a href="/town/#pots">a</a><a href="/town/#ghost">b</a><a href="#here">c</a><span id="here"></span>';
  const links = fragmentLinksIn(page);
  assert.deepEqual(links.map((l) => l.href), ["/town/#pots", "/town/#ghost", "#here"],
    "the href reader lost a link");
  assert.deepEqual([...idsIn(page)], ["here"], "the id reader lost an id");

  const townIds = idsIn(readFileSync(join(PAGES, "town", "index.astro"), "utf8"));
  assert.equal(townIds.has("pots"), true, "a live anchor must read as live");
  assert.equal(townIds.has("ghost"), false, "a dead anchor must read as dead");
});

test("an off-site or computed href is not mistaken for an in-site one", () => {
  const page =
    '<a href="https://example.com/x#y">off</a>' +
    "<a href={`/bulletin/#${b.slug}`}>computed</a>" +
    '<a href="/town/#board">in-site</a>';
  assert.deepEqual(fragmentLinksIn(page).map((l) => l.href), ["/town/#board"]);
});
