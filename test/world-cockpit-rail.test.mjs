// world-cockpit-rail.test.mjs — the side rail's three rulings (2026-08-29).
//
// THE LAWS THESE PIN, in the founder's own words:
//
//   ① "the action log can just replace the Lately section in the side rail
//      instead of needing a whole separate panel … tweak the 'lately' section so
//      it's a newest-at-the-bottom chat-like feed, that you can scroll UP to see
//      older things (and we should use this same thing for the log in combat)"
//   ② "there needs to be profiles of tokens loaded into the act as bar"
//   ③ "the act as bar should auto-select the token whose turn it is (if
//      possible) when it becomes their turn"
//
// The feed's GRAMMAR is falsified behaviourally in world-feed.test.mjs — that is
// where the sentences live and it is a pure module. What is left here is the
// wiring, which lives inside the mountCockpit closure and cannot be reached
// without booting a full DOM: source pins, the repo's standing discipline for
// closure code (see world-cockpit-dock.test.mjs, the exemplar). Every regex here
// fails against the pre-ruling files — the strings it demands did not exist —
// which is the flip.
//
// The two halves that ARE reachable — how a face resolves its picture, and how a
// resident's avatar becomes a URL — are tested for real at the bottom.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUMAN_ACTOR, faceImageFor, residentAvatar, TOWN_RAW } from "../src/lib/world-cockpit.mjs";

const mount = readFileSync(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url), "utf8");
const island = readFileSync(new URL("../src/components/WorldCockpit.astro", import.meta.url), "utf8");

// ── ① LATELY IS THE FEED ────────────────────────────────────────────────────

test("the rail's section is reshaped by CSS, and the viewer's own list is never written", () => {
  // ⚑ THE RAIL BELONGS TO THE VIEWER. renderActivity writes .wv-acts's
  // innerHTML and sets the section's hidden attribute on every re-fold, so the
  // ONLY safe way to reshape Lately from this repo is to leave both alone: the
  // section becomes the scrollport, the list is flipped in CSS, and the cockpit
  // appends one element of its own. If this file ever starts writing the
  // viewer's list, that is the regression these two assertions exist to catch.
  assert.match(mount, /html\[data-pmc-feed\] \.wv \.wv-activity \{/,
    "the section is made the scrollport under the cockpit's own attribute");
  assert.match(mount, /html\[data-pmc-feed\] \.wv \.wv-acts \{ flex-direction: column-reverse; \}/,
    "the viewer's newest-first list is flipped to read oldest-at-top — in CSS, not in its DOM");
  assert.doesNotMatch(mount, /\.wv-acts["'`]\s*\)[^)]*\.innerHTML\s*=/,
    "nothing here writes the viewer's activity list");
  assert.doesNotMatch(mount, /wv-activity["'`]\s*\)[^;]*\.hidden\s*=/,
    "nor its hidden attribute — the section is revealed by a CSS override, so the viewer keeps owning it");
});

test("the section is forced visible past the viewer's own hidden attribute", () => {
  // renderActivity hides the section when the record is empty. Inside a portal
  // the fight is the record, and a feed nobody can see is not a feed.
  assert.match(mount, /html\[data-pmc-feed\] \.wv \.wv-activity \{\s*\n?\s*display: flex !important;/,
    "display is forced, so an empty Lately still shows the fight");
});

test("the reshape is one attribute, and destroy takes it back off", () => {
  assert.match(mount, /doc\.documentElement\.setAttribute\("data-pmc-feed", "1"\)/);
  assert.match(mount, /doc\.documentElement\.removeAttribute\("data-pmc-feed"\)/);
  assert.match(mount, /new w\.CustomEvent\("pm:cockpit-feed", \{ detail: \{ present \} \}\)/,
    "and the same two-signal handshake the dock uses, for a viewer that booted either side of us");
  assert.match(mount, /feedSignal\(false\); \/\/ and Lately back to being Lately/,
    "teardown hands the rail back");
  assert.match(mount, /feedList\?\.remove\(\);\s*\n\s*feedNew\?\.remove\(\);/,
    "and takes the cockpit's own elements out of it");
});

test("the feed's host is resolved at USE time, never held from mount", () => {
  // The living-references law, the same one that governs the svg: an element
  // found at mount is not the element that is there now, and a list appended to
  // a rebuilt rail would answer every measurement with zeros while looking
  // perfectly correct in the source.
  assert.match(mount, /const feedSection = \(\) => doc\.querySelector\("\.wv \.wv-activity"\);/,
    "the section is looked up on every call");
  assert.match(mount, /if \(feedList\?\.isConnected && feedList\.parentElement === host\) return feedList;/,
    "and the list is re-homed whenever it is no longer inside the living section");
});

test("the scroll contract is measured BEFORE the rewrite", () => {
  // ⚑ AFTER the rewrite the scrollHeight has already moved, so every answer is
  // about a box that no longer exists — a feed that measured afterwards would
  // decide it was at the bottom exactly when it was not.
  assert.match(mount, /const follow = atBottom\(box\);\s*\n\s*const html = state\.feed\.map/,
    "atBottom is asked, then the html is built");
  assert.match(mount, /if \(follow\) \{ box\.scrollTop = box\.scrollHeight; if \(feedNew\) feedNew\.hidden = true; \}\s*\n\s*else if \(feedNew\) feedNew\.hidden = false;/,
    "at the bottom it follows; scrolled up it holds and says there is something new");
});

test("your own beat goes in from the act answer, and the poll never tells it twice", () => {
  assert.match(mount, /ingest\(beatsFromAct\(res\.body, \{ acting: seat\(\) \}\)\);/,
    "the act answer's own beat, then and joined are read straight into the feed");
  assert.match(mount, /state\.encSnap = fresh\.encounter_detail \?\? state\.encSnap;/,
    "and the delta baseline moves with the refreshed answer, so the same swing is not derived again");
});

test("the encounter is polled on its own clock, only inside portal ground", () => {
  assert.match(mount, /if \(!o\.refresh \|\| !portalOf\(state\.answer\)\) return;/,
    "no fight, no poll — a town map does not want a two-second read");
  assert.match(mount, /setInterval\?\.\(pullEncounter, 2500\)/,
    "every 2.5s, inside the founder's 2-3s window and faster than the voices' 7s");
  assert.match(mount, /const moved = answerSig\(fresh\) !== answerSig\(state\.answer\);/,
    "and it repaints only when something a paint could show actually moved");
  assert.match(mount, /absorbEncounter\(fresh\);\s*\n\s*state\.answer = fresh;/,
    "the delta is derived against the OLD snapshot before the new answer is adopted");
});

test("a say reaches the feed even on the tick the map's bubbles are left alone", () => {
  // The voices poll returns early when nothing moved far enough to be worth
  // rebuilding the bubble layer for. The feed dedupes by id, so that guard
  // applied to it could only ever throw lines away.
  assert.match(mount, /ingest\(voiceEntries\(next\)\);\s*\n\s*if \(sig\(next\) === sig\(state\.voices\)\) return;/,
    "the feed is fed before the bubbles' early return");
});

// ── ② EVERY FACE IS A PICTURE ───────────────────────────────────────────────

test("the dock and the wheel resolve a face through one call", () => {
  assert.match(mount, /const token = faceImageFor\(f, state\.profiles\);/,
    "the dock's faces");
  assert.match(mount, /return row \? faceImageFor\(row, state\.profiles\) : null;/,
    "and the wheel's pips, off the same roster and the same profile bubbles");
  assert.doesNotMatch(mount, /const token = f\.kind === "human" \? tokenFor\(f\) : null;/,
    "the human-only resolution is gone");
});

test("a picture that will not load uncovers the letter it was drawn over", () => {
  assert.match(mount, /<span class="pmc-mono">\$\{mono\}<\/span><img src=/,
    "the letter is always drawn, underneath");
  assert.match(mount, /if \(img\?\.tagName === "IMG" && img\.closest\?\.\("\.pmc-face, \.pmc-turn"\)\) img\.remove\(\);/,
    "and a failed image is removed rather than left as a torn glyph");
  assert.match(mount, /root\.addEventListener\("error", onImgError, true\);/,
    "delegated in the capture phase, because error does not bubble and a repaint re-mints every face");
});

test("the profile read is the island's errand, asked once per handle", () => {
  // The mount's own contract, stated in its header: "DOM only. Nothing here
  // fetches." A fetch in this file would be the first one.
  assert.match(mount, /if \(!o\.readResident\) return;/);
  assert.match(mount, /if \(f\.kind !== "resident" \|\| !f\.handle \|\| profilesAsked\.has\(f\.handle\)\) continue;/,
    "one read per handle for the life of the mount");
  assert.match(island, /const r = await fetch\(OFFICE \+ "\/residents\/" \+ handle, \{ headers: \{ accept: "application\/json" \} \}\);/,
    "and it is GET /residents/{handle} — a door that already exists, read keylessly because a resident's card is public");
  assert.match(island, /dispatch, readTerms, refresh: door, readVoices, readResident,/,
    "handed to the mount beside the other reads");
});

// ── ③ AUTO-SELECT ON THE TURN ───────────────────────────────────────────────

test("the dock takes the seat when the turn CHANGES to a handle this key holds", () => {
  assert.match(mount, /if \(turn === state\.lastTurn\) return;/,
    "on the change, and only on the change");
  assert.match(mount, /if \(!handles\.includes\(turn\) \|\| state\.acting === turn\) return;/,
    "and only for a resident this key actually holds");
  assert.match(mount, /state\.acting = turn;\s*\n\s*state\.seat = turn;\s*\n\s*state\.said = null;\s*\n\s*speakActAs\(\);/,
    "it speaks pm:act-as through the same path a face click does");
});

test("it never writes the viewer's selection directly", () => {
  // speakActAs is the one road: it mints the viewer's own data-act-as control
  // and dispatches the event. An auto-select that set the viewer's key or
  // called into it another way would be a second grammar.
  const auto = mount.slice(mount.indexOf("function autoSelectOnTurn"), mount.indexOf("// ── the dock's pictures"));
  assert.doesNotMatch(auto, /localStorage/, "auto-select touches no viewer storage");
  assert.doesNotMatch(auto, /data-act-as/, "and mints no control of its own — speakActAs owns that");
  assert.match(auto, /speakActAs\(\);/);
});

test("a manual click after an auto-select wins until the next turn change", () => {
  // ⚑ AND THERE IS NO FLAG FOR IT. The turn-change guard IS the protection: a
  // reader who picks another face keeps it, because nothing re-fires until the
  // wheel moves. A separate manual flag beside that guard would be a second
  // answer to one question, and the two would drift.
  assert.doesNotMatch(mount, /state\.manual/, "no second bookkeeping for a rule the guard already keeps");
  assert.match(mount, /autoSelectOnTurn\(\);\s*\n\s*if \(moved\) paint\(\);/,
    "the poll asks it on every read, and the guard decides whether anything happens");
});

test("the mount's first read seeds the baseline without narrating it", () => {
  // A reader arriving mid-fight should not be handed the whole fight as things
  // that just happened.
  assert.match(mount, /state\.encSnap = o\.answer\?\.encounter_detail \?\? null;\s*\n\s*autoSelectOnTurn\(\);/,
    "snapshot taken, nothing said — and the turn is read for the first time right after it");
});

// ── the two halves that can be run, run ─────────────────────────────────────

test("a resident's avatar basename becomes the town repo's own URL", () => {
  // GET /residents/{handle} answers `profile.avatar` as a BASENAME — the office
  // avatar door writes WHITE_PAGES/<handle>/avatar.<ext> and records the name.
  // The site's processed /media/ copy lives in a BUILD map this runtime island
  // cannot reach, so this uses the repo's own standing fallback for an
  // unclaimed image (src/lib/pm.mjs), which needs no build artifact to stay true.
  assert.equal(
    residentAvatar("rei", { avatar: "avatar.jpg" }).src,
    `${TOWN_RAW}/WHITE_PAGES/rei/avatar.jpg`);
  assert.equal(residentAvatar("rei", { avatar: "avatar.jpg" }).from, "the town repo");
});

test("a url the door names wins over anything derived", () => {
  // The contract-forward path: the day the roster or the profile carries a URL,
  // nothing here derives anything, which is the shape every other integration
  // on this surface has taken.
  const given = residentAvatar("rei", { avatar: "avatar.jpg", avatar_url: "https://example.test/r.png" });
  assert.equal(given.src, "https://example.test/r.png");
  assert.equal(given.from, "the door");
});

test("the basename is checked as one — a field the site does not own lands in a URL", () => {
  assert.equal(residentAvatar("rei", { avatar: "../../etc/passwd" }), null);
  assert.equal(residentAvatar("rei", { avatar: "a/b.png" }), null);
  assert.equal(residentAvatar("rei/../x", { avatar: "avatar.png" }), null);
  assert.equal(residentAvatar("rei", { avatar: "" }), null);
  assert.equal(residentAvatar("rei", null), null);
});

test("one call answers every face in the dock, and an absent picture is an ordinary state", () => {
  const human = faceImageFor({ kind: "human", id: "keeminlee", label: "DARKO", allowed: true });
  assert.equal(human.src, "/birthday/darko-token.png", "the human keeps the token the stage serves");

  const withAvatar = faceImageFor({ kind: "resident", handle: "rei", label: "rei" },
    { rei: { avatar: "avatar.jpg" } });
  assert.equal(withAvatar.src, `${TOWN_RAW}/WHITE_PAGES/rei/avatar.jpg`);
  assert.equal(withAvatar.monogram, "R", "and carries the letter to be drawn under it");

  // a read that has not answered yet, and a resident who wrote no profile: the
  // tile every face wore until tonight, which is nobody's failure
  const pending = faceImageFor({ kind: "resident", handle: "wright", label: "wright" }, { rei: {} });
  assert.equal(pending.src, null);
  assert.equal(pending.monogram, "W");
  assert.equal(pending.from, "monogram");

  // a roster row that names its own picture is believed over any derivation
  const fromRow = faceImageFor({ kind: "resident", handle: "rei", label: "rei", token_url: "/x.png" },
    { rei: { avatar: "avatar.jpg" } });
  assert.equal(fromRow.src, "/x.png");
  assert.equal(fromRow.from, "the roster row");
});

test("the human's face is still the human's — HUMAN_ACTOR is untouched by any of this", () => {
  assert.equal(HUMAN_ACTOR, "human:self");
  assert.equal(faceImageFor(null), null);
});
