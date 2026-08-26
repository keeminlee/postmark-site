// bulletin-teaser.test.mjs — the homepage carousel's name and teaser.
//
// Both laws here come from one founder screenshot (2026-08-26) of the homepage
// bulletin carousel, and both were invisible to the suite because the functions
// lived inside town/pages/index.astro where nothing could import them. They are
// in src/lib/pm.mjs now, which is the actual fix: page-local logic is logic no
// falsifier can reach.

import test from "node:test";
import assert from "node:assert/strict";
import { postingTeaser, postingTitle } from "../src/lib/pm.mjs";

// A HARD-WRAPPED body, and it must STAY hard-wrapped to be worth anything. The
// bug only appears when a paragraph spans several source lines, so a fixture
// that quietly became one long line would let every assertion below pass
// without ever touching the defect. The line breaks inside this paragraph are
// the fixture; the guard test underneath asserts they are still there.
const WRAPPED = `# The Illuminator's first commission

The Illuminator takes one image: line — a single photograph of the room, or
the doorway, or whatever the resident has decided is the face of the place —
and returns it as the town would have drawn it, in the town's own hand and
the town's own inks.

A second paragraph, which no teaser should ever reach.`;

test("the fixture is genuinely hard-wrapped, or nothing below means anything", () => {
  // The bug is "the first SOURCE LINE became the paragraph", so the fixture's
  // first paragraph must span more than one source line.
  const firstPara = WRAPPED.split(/\r?\n\s*\r?\n/)[1];
  assert.ok(firstPara.split("\n").length > 1,
    "the fixture stopped being hard-wrapped — this file can no longer see the bug");
});

test("a hard-wrapped posting excerpts past its first source line, and ends with the ellipsis", () => {
  // THE BUG, in the founder's words: the carousel read "…takes one image:
  // line — a", amputated mid-sentence with no ellipsis. The cause was a split
  // on SINGLE newlines, which made the "paragraph" end wherever the author's
  // editor happened to wrap. excerpt() already handles paragraphs and already
  // appends the ellipsis; the caller's pre-split was defeating it.
  const teaser = postingTeaser({ slug: "illuminator", body: WRAPPED });

  // it reads past the wrap — the words on source line two are in it
  assert.match(teaser, /doorway/,
    "the teaser still stops at the first source line: " + JSON.stringify(teaser));
  // and the amputation itself is gone
  assert.equal(teaser.endsWith("— a"), false, "the teaser is still cut mid-sentence");
  // it is genuinely long, and it is trimmed with the ellipsis rather than
  // simply running out of line
  assert.ok(teaser.length > 100, `the teaser is only ${teaser.length} chars: ${teaser}`);
  assert.ok(teaser.endsWith("…"), "a trimmed teaser must say it was trimmed");
  // the heading never becomes the teaser — that skipping was the one thing the
  // old line-walk did right, and the fix must not lose it
  assert.equal(teaser.includes("first commission"), false,
    "the H1 leaked into the teaser");
  // and it never runs on into the paragraph after
  assert.equal(teaser.includes("no teaser should ever reach"), false,
    "the teaser swallowed a second paragraph");
});

// The founder's actual entry, verbatim from the town's bulletin — the one in
// the screenshot. Its third source line opens with *inside*, which is why it
// earns its own test.
const REAL = `# Art on your marks ✦ — and the shelf now takes SVG

Your marks can carry pictures. A mark's record takes one \`image:\` line — a
shelf URL — and the world hangs it: on the atlas, in the telling, and now
*inside* (walk into a mark and its pictures hang as framed art on the wall).

Two things are new as of tonight:`;

test("a wrapped line that opens with italics is prose, not a bullet", () => {
  // A MISTAKE MADE ON THE WAY TO THE FIX, kept as a law because the first cut
  // shipped it: filtering every chrome-looking line (not just leading ones) ate
  // this entry's THIRD source line, because *inside* opens with a star and an
  // italic open-star is indistinguishable from a bullet at the start of a line.
  // The teaser then ended "...and now" — past the original amputation, but
  // still truncated, and still with no ellipsis, so it looked almost fixed.
  // A continuation line is prose whatever character it starts with.
  const teaser = postingTeaser({ slug: "art-on-your-marks", body: REAL });
  assert.match(teaser, /inside/,
    "the italic line was eaten as if it were a bullet: " + JSON.stringify(teaser));
  assert.equal(teaser.endsWith("and now…"), false,
    "the teaser stops where the italic line begins");
  assert.ok(teaser.endsWith("…"), "this paragraph is over the limit and must be trimmed with an ellipsis");
});

test("a pure bullet-list block is still skipped whole", () => {
  // The other half of leading-only: dropping chrome only at the head of a block
  // must NOT turn a bullet list into a teaser via its second bullet.
  const teaser = postingTeaser({ slug: "x", body: "# T\n\n* one\n* two\n\nThe real paragraph." });
  assert.equal(teaser, "The real paragraph.");
});

test("a short posting is not given an ellipsis it did not earn", () => {
  // The other direction, so "ends with …" above cannot be satisfied by always
  // appending one.
  const teaser = postingTeaser({ slug: "short", body: "# Title\n\nTwo words." });
  assert.equal(teaser, "Two words.");
});

test("a hand-written frontmatter teaser still wins over the body", () => {
  const teaser = postingTeaser({ slug: "x", data: { teaser: "Keemin's own line." }, body: WRAPPED });
  assert.equal(teaser, "Keemin's own line.", "the hand-maintained teaser is Keemin's pen and outranks the body");
});

test("a posting wears ONE name: the frontmatter title beats a differing H1", () => {
  // THE SECOND BUG from the same screenshot: this helper read the H1 while
  // /bulletin/'s card read the frontmatter title, so one entry could show two
  // different names on two surfaces (the ✦ mismatch). Frontmatter wins now, so
  // both surfaces agree on whatever the entry declares.
  const b = { slug: "the-illuminator", data: { title: "✦ The Illuminator" }, body: "# The Illuminator's first commission\n\nBody." };
  assert.equal(postingTitle(b), "✦ The Illuminator");

  // the H1 is the fallback, not the loser — an entry with no declared title
  // still gets a real name rather than its slug
  assert.equal(postingTitle({ slug: "s", body: "# A Real Heading\n\nBody." }), "A Real Heading");
  // a blank declared title is not a title
  assert.equal(postingTitle({ slug: "s", data: { title: "   " }, body: "# A Real Heading" }), "A Real Heading");
  // and with neither, the slug is the last resort
  assert.equal(postingTitle({ slug: "no-heading-here", body: "Just prose." }), "no-heading-here");
});
