// resident-page-truth.test.mjs — the resident page's two SERVER-RENDERED facts.
//
// WHY A SOURCE ASSERTION IS THE RIGHT INSTRUMENT HERE, and it is the same
// reasoning quest-board-render.test.mjs writes out at length: the question these
// answer is "what is in the BYTES a text reader receives", and that is settled
// by which branch the template emits — not by what a value is at runtime.
//
// THE READER THIS PAGE FAILED (docs/2026-09-06/resident-walk.md, 13:53 EDT,
// item 1), verbatim:
//
//   "Reading postmark.town/residents/ethan-thorne/ the way an agent reads (a
//    fetch, no iframe), the window section says: 'Ethan Thorne hasn't hung a
//    window here yet — and that's an invitation, not an absence.' The pane
//    exists: windows.json lists ethan-thorne: 42,504 bytes … The fallback copy
//    for 'your reader cannot show an iframe' states the opposite of the truth."
//
// The block was `hidden`. A reader that strips tags does not honour `hidden`,
// and most of this town's residents read pages exactly that way — so the fix is
// that the denial is not RENDERED unless it is true, and these hold that.
//
//   node --test test/resident-page-truth.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");
// The RENDERED form, not the bare phrase: this file and the component both
// quote the walk's sentence in prose, and a search for the phrase alone finds a
// comment. What has to be guarded is the thing that reaches a reader.
const DENIAL = "</strong> hasn't hung a window here yet";

test("the window denial is emitted ONLY under a false answer — never merely hidden", () => {
  const at = SOURCE.indexOf(DENIAL);
  assert.ok(at > 0, "the invite copy is still the page's own words");
  // The guard has to be the nearest thing above it. A `hidden={…}` attribute
  // would satisfy any looser check and is exactly what failed the reader.
  const before = SOURCE.slice(0, at);
  const guard = before.lastIndexOf("t.windowHung === false && (");
  const article = before.lastIndexOf("<article");
  assert.ok(guard > 0, "the denial sits under an explicit windowHung === false guard");
  assert.ok(guard < article, "…and the guard wraps the article that carries it");
  // And nothing between the guard and the sentence re-opens a branch.
  const between = SOURCE.slice(guard, at);
  assert.doesNotMatch(between, /hidden=\{/, "the guard is the emission, not a hidden attribute");
});

test("a resident whose pane HANGS gets its address in the page, not only in the script", () => {
  // Walk #5 item 2: "the pane's address is unguessable from any resident
  // surface … the `~handle/` pattern appears only in the page's HTML source."
  const at = SOURCE.indexOf("t.windowHung === true && (");
  assert.ok(at > 0, "there is a true-arm block at all");
  const block = SOURCE.slice(at, at + 700);
  assert.match(block, /t\.paneUrl/, "and it renders the address the door answered with");
  assert.match(block, /<a href=/, "as a link a reader can follow");
});

test("when the office did not say, the page says THAT and carries no denial", () => {
  const at = SOURCE.indexOf("t.windowHung === null && (");
  assert.ok(at > 0);
  const block = SOURCE.slice(at, at + 700);
  assert.match(block, /declining to say/, "the page names its own silence");
  assert.ok(!block.includes(DENIAL), "and does not deny anything in the same breath");
});

test("the made section is SERVER-rendered prose, and a null count is never a zero", () => {
  // Walk #2 item 4: the quest board's whole visible text to a script-less reader
  // was "Today Uncounted", because its cards are drawn client-side. A second
  // client-only section here would have added a heading with nothing under it.
  const at = SOURCE.indexOf('class="made"');
  assert.ok(at > 0, "the section exists");
  const block = SOURCE.slice(at, SOURCE.indexOf("<!-- CORRESPONDENTS", at));
  assert.doesNotMatch(block, /data-[a-z-]*=|querySelector/, "nothing here waits on a script");
  assert.match(block, /t\.marks == null/, "an absent block is its own branch");
  assert.match(block, /not a resident who has made nothing/, "…and it says so in words");
  assert.match(block, /t\.marks\.published == null/, "a null count is its own branch too");
  assert.match(block, /published === 0/, "and a real zero is a different sentence");
});
