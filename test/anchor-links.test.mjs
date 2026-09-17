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

// ── A COMMENT IS NOT AN ANCHOR (found by the reviewer's flip, 2026-09-14) ────
// The first cut of this file read raw source, and the reviewer's flip renamed
// ONLY the element's `id="quests"` and got six green tests back. The reason was
// this file's own doing: the explanatory comment left on that page QUOTES
// `id="quests"` in prose, the reader counted the quoted one, and a page with no
// anchor at all read as a page that had one.
//
// That is the worst failure shape a watcher can have. It does not merely miss
// the defect — it is HARDEST to fool while nobody has written about an anchor
// and EASIEST once somebody explains one, so the check goes blind on exactly
// the pages that got careful attention. Every id and every href is now read
// from source with its prose blanked out.
//
// Three forms, each blanked to spaces rather than deleted so that line
// structure survives for the pass after it:
//   · HTML          <!-- … -->
//   · JSX / Astro   a brace-wrapped block comment, and any bare block comment,
//                   which also covers the frontmatter and the <style> block
//   · line          `// …` to end of line, OUTSIDE quotes only
//
// The line pass is the one with teeth, because `https://` is not a comment. It
// walks the line tracking `"`, `'` and backtick, ignores a `//` inside any of
// them, and additionally declines a `//` preceded by `:` or `(` — the protocol
// and `url(//…)` cases. A `//` that survives all of that is prose.
export function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  let s = src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank);

  return s.split("\n").map((line) => {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "/" && line[i + 1] === "/") {
        const before = line[i - 1];
        if (before === ":" || before === "(") continue; // https://… and url(//…)
        return line.slice(0, i);
      }
    }
    return line;
  }).join("\n");
}

/** A page's source as the reader sees it: prose blanked, markup left alone. */
const sourceOf = (file) => stripComments(readFileSync(file, "utf8"));

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

/**
 * Every in-site href written as a literal, fragment or not.
 * `href="/world/"` → "/world/" · `href="/town/#pots"` → "/town/#pots"
 * Off-site (`https://…`) and computed (`href={expr}`) hrefs are not matched,
 * by construction — the same cut `fragmentLinksIn` makes.
 */
export function hrefsIn(src) {
  return Array.from(src.matchAll(/href="(\/[^"\s]*)"/g), (m) => m[1]);
}

/**
 * Routes the site has RETIRED — no page of ours may point at one.
 *
 * A retired route still answers, through the redirects map in
 * astro.config.town.mjs, so nothing here is about a dead link: it is about
 * spending a navigation and a visible flash to arrive where a direct href
 * would have gone in one. The redirects map says the same thing in its own
 * words about /board/ ("Chaining would have worked … but it spends two
 * navigations and a visible flash to arrive at the same place, and every extra
 * hop is another thing that can break silently").
 *
 * `prefix` is matched as a PREFIX on purpose, so /atlas/town.html is refused
 * beside /atlas/ — and that is also why the two exceptions below are spelled
 * out rather than left implicit.
 */
const RETIRED_ROUTES = [
  {
    prefix: "/atlas/",
    to: "/world/",
    since: "2026-09-16",
    why: "the atlas retired (postmark-town/postmark#2800); the World replaced it 2026-09-08 and /atlas/ forwards to /world/",
    // NOT retired, and both live under the same prefix for historical reasons
    // only. /atlas/ground.html is THE WORLD'S OWN GROUND — the pinned viewer
    // reads it same-origin at boot (ATLAS_GROUND_URL, spectator/viewer.mjs) on
    // the founder's word of 2026-09-11 — and it references nine files under
    // /atlas/assets/. Neither is a page and neither is ever an href on a page
    // of ours, so both are listed here to be REFUSED-AS-EXCEPTIONS rather than
    // silently swept up by a prefix match that nobody reread.
    keep: ["/atlas/ground.html", "/atlas/assets/"],
  },
];

/** Every source a reader's chrome and pages are assembled from. */
function everyLinkedSource() {
  const out = everyPageFile();
  for (const dir of ["components", "layouts"]) {
    const abs = join(ROOT, "src", dir);
    if (existsSync(abs)) out.push(...everyPageFile(abs, []));
  }
  // the rail is not a page and is where a route most easily outlives its page
  out.push(join(ROOT, "src", "lib", "nav.mjs"));
  return out;
}

const rel = (f) => relative(PAGES, f).split("\\").join("/");

/** Every fragment link on the site, resolved: { from, href, path, frag, target, dead, noPage } */
function survey() {
  const out = [];
  const idsCache = new Map();
  const idsOf = (f) => { if (!idsCache.has(f)) idsCache.set(f, idsIn(sourceOf(f))); return idsCache.get(f); };
  for (const file of everyPageFile()) {
    // BOTH SIDES read the stripped source, not just the ids. A link quoted in
    // prose is not a link either, and the two halves reading different text is
    // how a checker starts disagreeing with itself.
    for (const link of fragmentLinksIn(sourceOf(file))) {
      const target = link.path === "" ? file : pageFileFor(link.path);
      const noPage = target === null;
      const dead = noPage ? true : !idsOf(target).has(link.frag);
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
  // Stripped, like everything else here: this page's comments discuss both the
  // old href and the id by name, and a pinned check that reads its own
  // explanation is the very hole this file was sent back to close.
  const hub = sourceOf(join(PAGES, "town", "index.astro"));
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
    if (!sourceOf(file).includes(`href="${k.href}"`)) {
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

  const townIds = idsIn(sourceOf(join(PAGES, "town", "index.astro")));
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

// ── AN ANCHOR THAT ONLY EXISTS IN PROSE IS NOT AN ANCHOR ─────────────────────
// The regression the reviewer's flip found, written as the thing it is: a page
// whose ONLY `id="x"` is inside a comment, and a link to `#x` that has to red.

/** The one decision the whole file makes, on a page held in memory. */
const linkIsDead = (src, frag) => !idsIn(stripComments(src)).has(frag);

test("a page whose only `id` is quoted in a comment has no anchor, and a link to it is dead", () => {
  const jsx = [
    "<section>",
    "  {/* THE HISTORY: this lane used to carry id=\"ghost\" and the link below named it. */}",
    '  <a href="#ghost">the board</a>',
    "</section>",
  ].join("\n");
  const html = '<!-- once <div id="ghost"> lived here --><a href="#ghost">the board</a>';
  const line = '// the anchor used to be id="ghost"\n<a href="#ghost">the board</a>';

  for (const [form, src] of [["a JSX block comment", jsx], ["an HTML comment", html], ["a line comment", line]]) {
    assert.equal(idsIn(src).has("ghost"), true,
      `${form}: the raw text really does contain the id — otherwise this fixture proves nothing`);
    assert.equal(linkIsDead(src, "ghost"), true,
      `${form} kept a dead anchor alive. This is the reviewer's flip: rename the element and the prose about it still answers.`);
  }

  // AND THE OTHER DIRECTION, or the fix is just blindness: a REAL id beside the
  // same prose still counts, so stripping has not eaten the markup.
  const withReal = jsx.replace("<section>", '<section id="ghost">');
  assert.equal(linkIsDead(withReal, "ghost"), false,
    "the element's own id was stripped along with the comment that discusses it");
});

test("stripping keeps its hands off the markup — a URL is not a comment", () => {
  // `https://` is the case that makes a naive line-comment strip destroy a page.
  const url = '<a href="https://example.com/a/b">x</a><span id="kept"></span>';
  assert.deepEqual([...idsIn(stripComments(url))], ["kept"], "a protocol slash-slash ate the rest of the line");

  const inString = '<span data-note="see // below" id="kept"></span>';
  assert.deepEqual([...idsIn(stripComments(inString))], ["kept"], "a slash-slash inside a quoted string ate the rest of the line");

  const cssUrl = '.a { background: url(//cdn.example.com/x.png); }\n<span id="kept"></span>';
  assert.deepEqual([...idsIn(stripComments(cssUrl))], ["kept"], "a protocol-relative url() ate the rest of the line");

  const trailing = 'const lane = "quests";   // the section is id="ghost"\n<span id="kept"></span>';
  const ids = idsIn(stripComments(trailing));
  assert.equal(ids.has("kept"), true, "a trailing line comment ate the markup after it");
  assert.equal(ids.has("ghost"), false, "a trailing line comment's quoted id was counted");
});

test("every real page still parses to at least one id — stripping has not blanked the site", () => {
  // THE WHOLE-CORPUS CONTROL. A strip that was too greedy would pass every test
  // above by returning nothing at all, and the survey would go green on an
  // empty world. Ids must survive on the pages that have them.
  const ids = everyPageFile().map((f) => [rel(f), idsIn(sourceOf(f)).size]);
  const total = ids.reduce((n, [, k]) => n + k, 0);
  assert.ok(total >= 20, `only ${total} ids survive stripping across ${ids.length} pages — the strip is eating markup`);
  for (const anchor of ["quests", "pots", "board", "marketplace", "ideas", "ballot-house"]) {
    assert.ok(idsIn(sourceOf(join(PAGES, "town", "index.astro"))).has(anchor),
      `the hub's \`${anchor}\` anchor did not survive stripping`);
  }
});

// ── RETIRED ROUTES ───────────────────────────────────────────────────────────
//
// THE FALSIFIER THAT STAYS (postmark-town/postmark#2800). Retiring a page is
// two acts, and only the first is visible: the route starts forwarding, and
// every href of ours stops pointing at it. The second is the one that rots —
// a forwarder makes a stale link *work*, so nothing ever complains, and the
// site keeps a chip aimed at a page it retired until somebody happens to look.
// This is the somebody.
//
// The corpus is wider than the survey above on purpose. A route outlives its
// page most easily in the CHROME — the rail in src/lib/nav.mjs, the World's
// own sign-in strip in src/components — and neither is a page under
// town/pages, so the fragment survey would never have read either.
//
// ONE MEASURED CAVEAT, named rather than assumed. This check reads the same
// stripped source everything else here does, and that stripper removes block
// comments before line comments — so a `/*` inside a `//` line opens a fake
// block and blanks real markup (the class filed as #2867 against the staging
// scan's own stripper). Measured across this corpus on 2026-09-16: 46 files,
// TWO hrefs blanked that way (`/world/` and `/replay/`, both in
// town/pages/world.astro), and ZERO of them under a retired prefix. So the
// refusal's reach is intact today; it is not intact by construction, and a
// future retired route whose only href sits in such a window would be missed.

test("no page or chrome of ours points at a retired route", () => {
  const offences = [];
  for (const file of everyLinkedSource()) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const href of hrefsIn(src)) {
      for (const route of RETIRED_ROUTES) {
        if (!href.startsWith(route.prefix)) continue;
        if (route.keep.some((k) => href.startsWith(k))) continue;
        offences.push(`${relative(ROOT, file).split("\\").join("/")} → ${href}  (point it at ${route.to}: ${route.why})`);
      }
    }
  }
  assert.deepEqual(offences, [], "a retired route is still linked:\n  " + offences.join("\n  "));
});

test("the retired-route reader refuses a planted href and passes the route it forwards to", () => {
  // BOTH DIRECTIONS, on the pure reader, so the corpus test above cannot be
  // green merely because the reader found nothing anywhere.
  const planted = '<a href="/atlas/">the atlas</a><a href="/world/">the world</a>';
  const found = hrefsIn(planted);
  assert.deepEqual(found, ["/atlas/", "/world/"], "the href reader stopped reading plain hrefs");

  const retired = found.filter((h) => RETIRED_ROUTES.some((r) => h.startsWith(r.prefix) && !r.keep.some((k) => h.startsWith(k))));
  assert.deepEqual(retired, ["/atlas/"], "a planted /atlas/ href was not refused");

  // and the deeper page the redirects map names is refused beside it
  assert.deepEqual(
    hrefsIn('<a href="/atlas/town.html">x</a>').filter((h) => RETIRED_ROUTES.some((r) => h.startsWith(r.prefix) && !r.keep.some((k) => h.startsWith(k)))),
    ["/atlas/town.html"],
  );
});

test("the World's own ground keeps serving under the retired prefix", () => {
  // THE EXCEPTION, asserted rather than trusted to a comment. /atlas/ground.html
  // is what the pinned viewer reads at boot, and /atlas/assets/ is the art it
  // references. A prefix match that swept these up would read as "the atlas is
  // gone" while taking the World's ground with it.
  const kept = ["/atlas/ground.html", "/atlas/assets/limen-the-threshold-district.jpg"];
  for (const href of kept) {
    const refused = RETIRED_ROUTES.some((r) => href.startsWith(r.prefix) && !r.keep.some((k) => href.startsWith(k)));
    assert.equal(refused, false, `${href} was refused — it is the World's, not the atlas's`);
  }
  // and the files are really there, because an exception for a file that does
  // not exist is a comment, not a guard
  for (const rel of ["atlas/ground.html", "atlas/assets"]) {
    assert.ok(existsSync(join(ROOT, "public", "atelier", "postmark", rel)), `${rel} is gone from the public tree`);
  }
});

test("the retired-route corpus reads the chrome, not only the pages", () => {
  // THE REACH CONTROL. The two files where a retired route most easily outlives
  // its page are not pages, so a corpus that quietly narrowed to town/pages
  // would pass every test above while checking none of the places that matter.
  const corpus = everyLinkedSource().map((f) => relative(ROOT, f).split("\\").join("/"));
  assert.ok(corpus.includes("src/lib/nav.mjs"), "the rail left the corpus");
  assert.ok(corpus.some((f) => f.startsWith("src/components/")), "the components left the corpus");
  assert.ok(corpus.some((f) => f.startsWith("src/layouts/")), "the layouts left the corpus");
  assert.ok(corpus.some((f) => f.startsWith("town/pages/")), "the pages left the corpus");
  assert.ok(corpus.length >= 40, `only ${corpus.length} sources in the retired-route corpus — the walk has stopped working`);
});

test("every retired route has a forwarder, so a link someone already holds still lands", () => {
  // THE OTHER HALF. The tests above prove no href of OURS points at a retired
  // route; this proves the route still answers for every href that is not ours
  // — a bookmark, a letter, another town's page. Read off the redirects map's
  // source rather than a built tree, because `test.yml` runs `npm test` without
  // `npm run build`, and a falsifier nobody runs cannot fail.
  const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const config = readFileSync(join(ROOT, "astro.config.town.mjs"), "utf8");
  const map = config.slice(config.indexOf("redirects:"), config.indexOf("vite:"));
  assert.ok(map.length > 200, "the redirects map was not found in astro.config.town.mjs — this check is reading nothing");

  for (const route of RETIRED_ROUTES) {
    const line = new RegExp(`'${quote(route.prefix)}':\\s*'${quote(route.to)}'`);
    assert.match(map, line, `${route.prefix} has no forwarder to ${route.to} — the route went dark instead of retiring`);
  }

  // AND THE EXCEPTIONS ARE NOT FORWARDED. /atlas/ground.html is the World's own
  // ground; a redirect on it would take the floor out from under the map while
  // reading, in the diff, exactly like more of the same cleanup.
  for (const route of RETIRED_ROUTES) {
    for (const keep of route.keep) {
      assert.doesNotMatch(map, new RegExp(`'${quote(keep)}[^']*':`), `${keep} was given a forwarder — it is not the retired page's`);
    }
  }
});
