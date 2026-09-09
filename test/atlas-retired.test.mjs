// atlas-retired.test.mjs — the falsifiers for the atlas's retirement, 2026-09-08.
//
//   node --test test/atlas-retired.test.mjs
//
// WHAT THIS LANE ACTUALLY DID, because the probes only make sense against it.
// The proposal's reading was that the site's whole atlas half is dead and can
// be deleted with no visible effect, on the evidence that the repo's copy of
// `public/atelier/postmark/atlas/town.html` had not moved since 2026-08-27
// while the live page served a fresh one. The first half of that is true. The
// second half is true for a reason that inverts the conclusion: the live page
// is fresh BECAUSE `tools/extract-town.mjs` regenerates the mirror at every
// publish and the box publishes without committing. Measured on 2026-09-08, the
// live `https://postmark.town/atlas/town.html` carried both of the two newest
// placements AND the site's own `site-doors` decoration, which only that
// extractor adds. The extractor's atlas pass was the most-read code in the
// "dead" half.
//
// So deleting the pass without keeping the bytes would not have retired the
// atlas — it would have silently reverted a live page to a twelve-day-old
// fossil at the next publish, with residents placed in that window vanishing
// off the town's own historical drawing. The build instead FREEZES: the mirror
// was regenerated once from the town at `715eb65f8`, committed as the last
// drawing, and every mechanism that could overwrite or starve it was removed.
//
// Which makes the probe the proposal named — "a fetch of /atlas/town.html
// returning 404" — the wrong probe for the build that shipped, and it names the
// right one itself: "if the atlas page stays as a historical drawing, a stamp
// on it naming its own retirement condition." That stamp is what test 3 reads,
// out of the page's shipped bytes.
//
// THE THREE THINGS THAT CAN GO WRONG, one test each:
//   1. a deleted mechanism comes back and the frozen drawing starts moving again
//   2. the drawing itself goes missing and /atlas/ serves an empty frame
//   3. the page loses its banner and a frozen artifact reads as a current one

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// The freeze's two facts, stated once here and once on the page. If they ever
// disagree, one of them is lying and the test says which file to open.
const FROZEN_AT = "2026-09-08";
const FROZEN_FROM = "715eb65f8";

// ─────────────────────────────────────────────────────────────────────────────
// FALSIFIER 1 — every mechanism that used to refresh the atlas is gone, and
// stays gone.
//
// This is a source-text guard and it is the RIGHT shape here, uniquely: what it
// watches is the ABSENCE of code, and absence has no runtime behaviour to
// drive. The thing it is protecting against is a merge or a revert quietly
// restoring a writer to a directory the repo now promises is frozen — which is
// exactly a text-level event.
// ─────────────────────────────────────────────────────────────────────────────
test("FALSIFIER: nothing in the repo writes the atlas mirror any more", () => {
  // (a) The v1 sync script, whose whole job was owning that directory
  //     ("writes the result into public/atelier/postmark/atlas/, owning that
  //     directory completely"), is deleted.
  assert.equal(existsSync(join(ROOT, "tools/sync-postmark-atlas.mjs")), false,
    "tools/sync-postmark-atlas.mjs is back — it owns public/atelier/postmark/atlas completely "
    + "and would overwrite the frozen drawing on its first run");

  // (b) The extractor's atlas pass is gone from tools/extract-town.mjs. Three
  //     independent markers, because one of them alone could be edited away
  //     while the pass survived under a new name.
  const extract = read("tools/extract-town.mjs");
  //     Each marker is CODE, never prose: the tombstone comment left in that
  //     file describes the deleted pass and says the words "site-doors" and
  //     "atlas", so a marker matching prose would red on the very comment that
  //     records the deletion.
  for (const marker of [
    'join(SITE_ROOT, "public", "atelier", "postmark", "atlas")',  // the output path
    "function openPanel",                                          // the decoration's hook check
    "row.className = 'site-doors'",                                // the decoration itself
  ]) {
    assert.ok(!extract.includes(marker),
      `tools/extract-town.mjs has grown the atlas pass back (${marker}). The drawing is frozen; `
      + "a writer here makes the page's own banner false.");
  }

  // (c) The sync workflow no longer stages the directory, so even a hand-run of
  //     something that wrote it could not commit it by accident.
  const workflow = read(".github/workflows/sync-atlas.yml");
  assert.ok(!/git add[^\n]*public\/atelier\/postmark\/atlas/.test(workflow),
    "sync-atlas.yml stages public/atelier/postmark/atlas again — the freeze is only as good as "
    + "what the cron is allowed to commit");
  // …and it still stages the trees that ARE live, so this test cannot pass by
  // the whole `git add` line having been deleted.
  for (const live of ["public/atelier/postmark/daily", "public/atelier/postmark/works",
    "public/atelier/postmark/media", "public/atelier/postmark/renditions", "src/data/postmark"]) {
    assert.ok(workflow.includes(live), `sync-atlas.yml stopped staging ${live} — that is a different bug`);
  }

  // (d) No page or component reaches for the deleted script by name.
  for (const f of walk(join(ROOT, "town"), ".astro").concat(walk(join(ROOT, "src"), ".astro"))) {
    assert.ok(!readFileSync(f, "utf8").includes("sync-postmark-atlas"),
      `${f} references the deleted sync script`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FALSIFIER 2 — the drawing the frozen page promises is actually in the repo,
// and it is the LAST one rather than the fossil.
//
// The failure this catches is the one that would have shipped if the mirror had
// been deleted along with its machinery: a page that says "here is the drawing
// as it stood" over an empty iframe, or over a copy that predates the freeze it
// claims. Neither is visible to a green build — the site built green for the
// twelve days the mirror was already stale.
// ─────────────────────────────────────────────────────────────────────────────
test("FALSIFIER: the frozen drawing is present, decorated, and is the one the page dates", () => {
  const atlas = join(ROOT, "public/atelier/postmark/atlas/town.html");
  assert.ok(existsSync(atlas), "the frozen drawing is gone — /atlas/ would serve an empty frame");
  const html = readFileSync(atlas, "utf8");

  assert.ok(statSync(atlas).size > 400_000,
    `the drawing is ${statSync(atlas).size} bytes; the town's atlas is around half a megabyte. `
    + "A truncated mirror renders as a blank map.");

  // It is the SITE's copy, not a raw town copy: the extractor's decoration is
  // what makes every click panel open a door into the site, and freezing a
  // pre-decoration copy would quietly cost the drawing its navigation.
  assert.ok(html.includes("site-doors"),
    "the frozen drawing has no site-doors decoration — this is the town's raw copy, not the site's");
  assert.ok(html.includes("</body>"), "the drawing lost its </body> — the decoration is unanchored");

  // It is the drawing from AFTER the last placements, not the 2026-08-27 fossil
  // the repo carried before the freeze. These two households were placed on
  // 09-05 and 09-06 and are absent from every copy older than that, which is
  // what makes this assertion able to fail rather than decorative.
  for (const placed of ["Riverlight", "Standing Stone"]) {
    assert.ok(html.includes(placed),
      `the frozen drawing predates ${placed}, placed before ${FROZEN_AT}. This is the fossil the `
      + "freeze exists to replace, and a reader would see residents missing from their own town.");
  }

  // The assets it references are beside it, so the freeze is a whole artifact.
  const assets = join(ROOT, "public/atelier/postmark/atlas/assets");
  assert.ok(existsSync(assets), "the drawing's assets directory is gone");
  assert.ok(readdirSync(assets).length > 50,
    `only ${readdirSync(assets).length} atlas assets — the drawing references far more than that`);
  assert.ok(!/["'](?:\.\.\/)+/.test(html.match(/<image[^>]*>/g)?.join("") ?? ""),
    "an image ref still points out of the site tree — the rewrite pass did not finish before the freeze");
});

// ─────────────────────────────────────────────────────────────────────────────
// FALSIFIER 3 — the SHIPPED page says it is frozen, in the page's own text.
//
// Read out of dist-town/atlas/index.html, with script regions stripped, because
// the thing being checked is what a reader sees. A `.astro` source assertion
// would pass on a banner that never rendered — inside a false conditional, or
// in a component the page stopped importing — and this page's whole job is to
// tell a reader something the drawing beneath it cannot.
// ─────────────────────────────────────────────────────────────────────────────

/** The page as a reader sees it: every script region removed. */
export function pageText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

const DIST = join(ROOT, "dist-town");
const built = existsSync(join(DIST, "atlas", "index.html"));

test("FALSIFIER: the built /atlas/ page carries its retirement banner in the text a reader reads",
  { skip: built ? false : "no dist-town/atlas/index.html — run `npm run build` first" }, () => {
    const text = pageText(readFileSync(join(DIST, "atlas", "index.html"), "utf8"));

    // The four things the banner has to say, each separately able to go missing.
    assert.ok(text.includes("This drawing is no longer kept"),
      "the retirement sentence is not in the page's text");
    assert.ok(text.includes(FROZEN_AT),
      `the page does not carry its freeze date (${FROZEN_AT}) — a frozen page with no date is a current page`);
    assert.ok(text.includes(FROZEN_FROM),
      `the page does not name the town commit it was frozen from (${FROZEN_FROM})`);
    assert.match(text, /living map is\s*<a[^>]*href="\/world\/"[^>]*>\/world\/<\/a>/,
      "the page does not send the reader to the living map");

    // And the two claims the retirement makes FALSE are gone. This half is what
    // stops the banner from being an addition on top of prose that still says
    // the drawing is alive — which is how a page ends up asserting both.
    assert.ok(!text.includes("It redraws"),
      'the page still claims the atlas "redraws as the mail moves" — it has not since ' + FROZEN_AT);
    assert.ok(!text.includes("blueprint for the walkable"),
      "the page still calls itself the blueprint for a walkable town that now exists at /world/");
  });

test("the banner scan reads page text, not script bytes", () => {
  // The companion to the skippable probe above: it proves the READER, so a
  // build-less run still watches the only part of test 3 that has logic in it.
  const inScript = '<html><body><script>var s = "This drawing is no longer kept";</script></body></html>';
  const inText = "<html><body><p>This drawing is no longer kept.</p></body></html>";
  assert.equal(pageText(inScript).includes("This drawing is no longer kept"), false,
    "a banner that exists only inside a script is not a banner");
  assert.equal(pageText(inText).includes("This drawing is no longer kept"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// FALSIFIER 4 — the built-page probe above can actually RUN where it matters.
//
// Test 3 skips when `dist-town/` is absent, and until 2026-09-08 CI never built
// it: `.github/workflows/test.yml` ran `npm ci`, cloned the Town, and went
// straight to `npm test`. EIGHT tests in this repo read shipped bytes and skip
// for that reason — this file's, plus seven in `test/funding.test.mjs` and
// `test/quest-board-render.test.mjs`. A falsifier nobody runs cannot fail, and
// the comment directly above that CI step records the last time this exact
// class cost the repo nine green days on a red suite.
//
// So the arm that keeps test 3 honest is not in test 3. It is here, and it
// watches the workflow: a build step, before the test step, in the job that
// runs the suite.
// ─────────────────────────────────────────────────────────────────────────────
test("FALSIFIER: CI builds the site before it runs the suite, so the built-page probes are not skips", () => {
  const wf = read(".github/workflows/test.yml");
  const lines = wf.split(/\r?\n/);
  const buildAt = lines.findIndex((l) => /^\s*(-\s*)?run:\s*npm run build\s*$/.test(l));
  const testAt = lines.findIndex((l) => /^\s*-\s*run:\s*npm test\s*$/.test(l));
  assert.ok(buildAt > -1,
    "test.yml has no `npm run build` step — every built-page falsifier in this repo silently skips in CI, "
    + "including the one that reads /atlas/'s retirement banner");
  assert.ok(testAt > -1, "test.yml no longer runs `npm test` — that is a different bug");
  assert.ok(buildAt < testAt,
    `the build must come BEFORE the suite (build at line ${buildAt + 1}, suite at ${testAt + 1}); `
    + "a build afterwards is a build the tests never saw");
});

// -----------------------------------------------------------------------------
// FALSIFIER 5 - NO OTHER SURFACE STILL TELLS A READER THE ATLAS IS LIVING.
//
// The reviewer's repairs 9 and 10, generalised, because two instances of one
// thing is a class. `/atlas/` grew a banner saying it stopped; `works/` went on
// calling it a "living map" that "Grows as the mail does", and RENDER-NOTES.md
// went on describing a fetch the world had removed. A READER MEETS THE INDEX
// BEFORE THE PAGE, so an index contradicting the thing it indexes wins the
// argument - and neither surface was reachable from the diff that retired the
// atlas, which is why they survived it.
//
// THIS READS THE SHIPPED BYTES, NOT THE SOURCE, and that is the whole design.
// My first version scanned .astro sources and reddened on TWO OF MY OWN
// RETIREMENT COMMENTS - the ones that quote the retired sentence in order to
// record what it used to say. A guard that cannot tell an assertion from a
// quotation bans writing down what changed, which is the opposite of the
// discipline it is enforcing. The distinction it could not make in source is
// free in the build: a comment never ships. What a reader is told is exactly
// what lands in dist-town, script regions stripped.
//
// Markdown in the repo is scanned separately and directly, because those files
// have no build and no comment syntax to confuse - a claim in RENDER-NOTES.md
// is read as written.
// -----------------------------------------------------------------------------

// Each of these is an ASSERTION that the drawing is current, and each is
// specific enough that it can mean nothing else.
const LIVING_CLAIMS = [
  "Grows as the mail does",
  "It redraws as the mail moves",
  "blueprint for the walkable town coming next",
];

// "living map" is NOT in that list, and the two versions of this arm that tried
// to put it there are the lesson.
//
// Banned outright, it reddened on `conversations/`, `replay/` and the frozen
// page itself - none of them wrong. The site's NAV carries "the living map" as
// the label for `/world/`, which is exactly what the World now is and exactly
// what this retirement wants said.
//
// Banned NEAR the atlas, within 300 characters, it reddened on the same pages
// for a better-hidden reason: the nav also carries a link to `/atlas/`, so the
// two strings sit inside one window on EVERY page that renders a nav. The
// proximity rule was measuring the furniture, not the claim.
//
// A window I keep shrinking until the reds go away is a number tuned to today's
// markup, so there is no window. The phrase is checked in the one place it was
// actually wrong - the Atlas card on `/works/` - by reading that card's own
// source field, below.
const ATLAS_CARD_KIND = 'kind: "living map"';

// Mail, conversations and resident pages are ARCHIVES OF RESIDENTS' OWN WORDS.
// Two letters use the phrase, written when it was true, and a guard reddening on
// them would be asking the town to edit what residents said to keep an index
// tidy. Their words are theirs. Excluded on purpose, and named so nobody quietly
// widens the scan back over them.
const RESIDENT_ARCHIVES = ["mail", "conversations", "residents", "households", "window"];

test("FALSIFIER: no SHIPPED page of the site's own still advertises the atlas as living",
  { skip: built ? false : "no dist-town/ - run `npm run build` first" }, () => {
    const pages = walk(DIST, "index.html").filter((f) => {
      const rel = f.slice(DIST.length).replace(/\\/g, "/").replace(/^\/+/, "");
      return !RESIDENT_ARCHIVES.includes(rel.split("/")[0]);
    });
    assert.ok(pages.length > 20,
      `only ${pages.length} of the site's own built pages found - the walk is not reaching dist-town`);

    const guilty = [];
    for (const f of pages) {
      const text = pageText(readFileSync(f, "utf8"));
      for (const claim of LIVING_CLAIMS) {
        if (text.includes(claim)) guilty.push(`${f.slice(DIST.length)} :: ${claim}`);
      }
    }
    assert.deepEqual(guilty, [],
      `a page the site itself writes still tells the reader the atlas is current, over a page whose `
      + `banner says it stopped on ${FROZEN_AT}. The reader meets the index first and believes it.`);
  });

test("FALSIFIER: the works index files the atlas as a historical drawing, not a living map", () => {
  // Read as SOURCE and by the field's own code form. The card is a data literal,
  // so `kind: "living map"` is unambiguous - and it does not match the retirement
  // comment two lines above it, which quotes the words in order to retire them.
  // That is the same quotation-vs-assertion trap falsifier 1 documents, met here
  // by matching code rather than prose.
  const works = read("town/pages/works/index.astro");
  assert.ok(works.includes("The Postmark Atlas"), "the works index no longer lists the atlas at all");
  assert.ok(!works.includes(ATLAS_CARD_KIND),
    `the works index still files the atlas under ${ATLAS_CARD_KIND} while /atlas/ says it stopped on ${FROZEN_AT}`);
  assert.ok(works.includes('kind: "historical drawing"'),
    "the atlas card lost its kind entirely - it should say what it now IS, not merely stop saying what it was");
  // NOT checked here: "Grows as the mail does". That sentence appears in this
  // file twice - once as the retired claim and once inside the comment that
  // records retiring it - and a source scan cannot tell them apart. It is the
  // third time this arm walked into the quotation-vs-assertion trap while
  // documenting it, so it stops trying: the shipped-page arm above reads what
  // a reader is told, where comments do not exist, and catches it properly.
});

test("FALSIFIER: no repo document still describes the atlas fetch as current", () => {
  // RENDER-NOTES.md is a DATED observation and is deliberately left as measured
  // - rewriting a 2026-08-14 measurement to match today's code stops it being an
  // observation. What it may not do is describe the fetch without saying it is
  // gone. So the test is not "the sentence is absent"; it is "every place the
  // fetch is described carries its supersession".
  const notes = read("RENDER-NOTES.md");
  assert.ok(notes.includes("fetches `/atlas/town.html`"),
    "RENDER-NOTES.md no longer records the fetch at all - the history was deleted rather than stamped, "
    + "which loses the measurement this file exists to keep");
  assert.ok(notes.includes("SUPERSEDED IN ONE PART, 2026-09-08 — THE ATLAS FETCH IS GONE"),
    "RENDER-NOTES.md describes the atlas fetch with no supersession stamp - a dated document that reads "
    + "as current is worse than one that is simply old");
  assert.ok(notes.includes("townGround()"),
    "the stamp does not name what replaced the fetch, so a reader cannot follow it anywhere");

  // And the claims themselves are absent from every .md a reader browses.
  const docs = ["README.md", "RENDER-NOTES.md", "TUTORIALS.md", "WORLD-PIN.md"]
    .filter((f) => existsSync(join(ROOT, f)));
  const guilty = [];
  for (const f of docs) {
    const text = read(f);
    for (const claim of LIVING_CLAIMS) {
      if (claim === "living map" && text.includes("living map is")) continue;
      if (text.includes(claim)) guilty.push(`${f} :: ${claim}`);
    }
  }
  assert.deepEqual(guilty, [], "a repo document still advertises the atlas as living");
});

test("the page source and this test agree about the freeze's two facts", () => {
  // The stamp is hand-written on both sides because the job that could have
  // computed it is deleted. Two hand-written copies drift; this is the check
  // that says so on the day it happens rather than the day someone notices.
  const page = read("town/pages/atlas.astro");
  assert.match(page, new RegExp(`FROZEN_AT\\s*=\\s*"${FROZEN_AT}"`),
    `town/pages/atlas.astro no longer freezes at ${FROZEN_AT} — update this test with it, deliberately`);
  assert.match(page, new RegExp(`FROZEN_FROM\\s*=\\s*"${FROZEN_FROM}"`),
    `town/pages/atlas.astro no longer names ${FROZEN_FROM} as its source`);
});

// ── walk ────────────────────────────────────────────────────────────────────
function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}
