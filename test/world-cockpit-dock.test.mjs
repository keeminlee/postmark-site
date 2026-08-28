// world-cockpit-dock.test.mjs — the Act-As dock's falsifiers (2026-08-28).
//
// THE LAW THESE PIN, in the founder's own words the night he caught it: the
// floating roster "just sits ON TOP of the existing rail" — two controls
// answering "who acts?", neither informing the other. The ruling: who-acts
// sits BESIDE what-they-do (the dock is the bar's leftmost cell), the viewer's
// old row stands down while the dock is mounted, and the dock's selection is
// the one the viewer follows.
//
// Source pins, the repo's standing discipline for closure code (the mount only
// lives inside mountCockpit; a full DOM boot would test the harness, not the
// seam). Every regex here fails against the pre-dock file — the strings it
// demands did not exist — which is the flip.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mount = readFileSync(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url), "utf8");
/** The world page's own source. The time-travel pill is the SITE's element and
 *  lives there, so the rule that stands it down is asserted where it is written. */
const worldPage = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

test("the roster rides inside the bar's own row, not as a floating plate", () => {
  // drawBar composes the dock as the row's first cell…
  assert.match(mount, /class="pmc-barrow">\$\{drawRoster\(\)\}<div class="pmc-bar"/,
    "drawBar wraps roster + bar in one .pmc-barrow row");
  // …and paint mounts no second, standalone copy of either plate. The
  // composition is now TWO calls, not three: the roster rides inside drawBar
  // and the standpoint plate rides inside the roster (2026-08-28, below).
  assert.match(mount, /root\.innerHTML = drawWheel\(\) \+ drawBar\(\);/,
    "paint composes the roster only through drawBar");
  assert.doesNotMatch(mount, /drawWheel\(\) \+ drawRoster\(\) \+ drawBar\(\)/,
    "the old standalone composition is gone");
});

// ── the standpoint plate, ON HOVER, OVER THE DOCK (2026-08-28) ──
//
// THE LAW, the founder's own words at the live rehearsal: "let's make the card
// appear ON HOVER when you hover over the act as bottom bar."
//
// It reverses an always-on card at left 14px / top 14px. That card was the
// SECOND element caught printing on the site's own left rail, and its first fix
// was the bar's painting fence — which held inside parcels and failed in the
// open world, where the map svg is full-bleed so its rect's left edge IS the
// viewport's. Anchoring beats fencing: a plate hung off the dock is inside the
// painting because the dock is, and there is no clamp left to get wrong.
//
// Each of these fails against the pre-ruling file, which is the flip.
test("the standpoint plate hangs off the dock and is revealed by its hover", () => {
  assert.match(mount, /<div class="pmc-cap">ACT AS<\/div>\s*\n\s*\$\{drawHere\(\)\}/,
    "drawRoster draws the plate into the dock itself");
  assert.match(mount, /\.pmc-roster:hover \.pmc-here, \.pmc-roster:focus-within \.pmc-here \{ opacity: 1; \}/,
    "and the dock's hover is what reveals it");
  assert.match(mount, /\.pmc-here \{\r?\n  position: absolute; left: 0; bottom: calc\(100% \+ 3\.2em\);/,
    "it is anchored above the dock, not at a viewport corner");
  assert.match(mount, /\.pmc-here \{[^}]*pointer-events: none;/,
    "and takes no pointer, so it cannot eat the hover that summoned it");
});

test("the here-plate's viewport corner and its fence are both gone", () => {
  // the old rule — the collision itself
  assert.doesNotMatch(mount, /\.pmc-here \{ position: absolute; left: 14px; top: 14px/,
    "no viewport-cornered here-plate");
  // and the fence written for it, which is dead code once it is anchored
  assert.doesNotMatch(mount, /here\.style\.left = `\$\{paint\.left \+ 14\}px`/,
    "placeBar no longer clamps a plate that no longer floats");
});

// ── the way out is measured too (2026-08-28, founder-caught) ──
//
// "step outside" and the room's own name printed on top of each other at the
// dock's end of the row. `.wv-scene-exit` is the viewer's exit pill at the
// painting's bottom-left, bottom:58px — newer than this fence and never
// measured by it. With `.wv-walkdesk` shipping hidden until a walk is armed,
// the tallest measured thing is the coordinate chip and the row lands at about
// 46px, a band running straight through the pill's 58-to-86.
test("the row lifts clear of the viewer's way-out pill, not just its walk desk", () => {
  assert.match(mount, /"\.wv \.wv-walkdesk", "\.wv \.wv-spectator-coordinate", "\.wv \.wv-paint-tallies", "\.wv \.wv-scene-exit"/,
    "placeBar measures the exit pill alongside the rest of the bottom edge");
});

test("the plate stopped floating — the CSS is the row's, not the left edge's", () => {
  // the old rule was `position: absolute; left: 14px; top: 30%` — the collision itself.
  assert.doesNotMatch(mount, /\.pmc-roster \{ position: absolute; left: 14px/,
    "no absolutely-positioned roster plate");
  assert.match(mount, /\.pmc-barrow \{\r?\n  position: absolute; left: 50%; bottom: 18px/,
    "the row owns the bottom-edge placement the bar used to");
});

test("the dock speaks, the viewer can follow: pm:act-as on every face click", () => {
  assert.match(mount, /speakActAs\(\);\s*\n\s*return;/,
    "the face-click branch speaks the selection");
  assert.match(mount, /new w\.CustomEvent\("pm:act-as", \{ detail: \{ actor \} \}\)/,
    "the word is a resident handle on a pm:act-as event");
  assert.match(mount, /if \(!actor \|\| actor === HUMAN_ACTOR/,
    "the human hand stays the cockpit's own grammar — never spoken at the viewer");
});

test("the handshake is two-signal: attribute for late boots, event for early ones", () => {
  assert.match(mount, /setAttribute\("data-pmc-dock", "1"\)/,
    "mount plants the attribute a later-booting viewer can read");
  assert.match(mount, /new w\.CustomEvent\("pm:cockpit-dock", \{ detail: \{ present \} \}\)/,
    "and speaks the event an earlier-booting viewer is listening for");
  assert.match(mount, /dockSignal\(false\); \/\/ hand the Act As question back/,
    "destroy hands the question back to the viewer's own row");
});

test("the row is fenced to the painting, not the viewport", () => {
  // Seen live the moment the dock landed: a viewport-centered row ran its left
  // end under the nav column — ACT AS faces on top of the nav's own text. The
  // row centers over the map pane the cockpit already holds, and never leaves it.
  assert.match(mount, /const paint = o\.svg\?\.getBoundingClientRect\?\.\(\);/,
    "placeBar measures the painting");
  assert.match(mount, /bar\.style\.left = `\$\{paint\.left \+ paint\.width \/ 2\}px`;/,
    "and centers the row over it rather than over the viewport");
});

// ── the time-travel pill stands down inside the cockpit (2026-08-28) ──
//
// THE LAW, the founder's words: "we should just remove the time travel icon when
// in this portal."
//
// The pill is the SITE's element (town/pages/world.astro, class .pm-tt), not the
// viewer's — so the rule that stands it down is written in its own stylesheet,
// one element one writer, and asserted here against that file.
//
// It is keyed on data-pmc-dock, which is the same word the viewer's Act As row
// and Actions rail already stand down on. That is what makes the restore free:
// destroy removes the attribute, so nothing has to remember to put the pill
// back, and outside portal ground the rule matches nothing at all.
test("the time-travel pill stands down on the cockpit's own dock signal", () => {
  assert.match(worldPage, /html\[data-pmc-dock\] \.pm-tt \{ display: none; \}/,
    "world.astro hides the pill while the cockpit's dock is mounted");
  // The restore is the attribute going away, so the mount must still be the
  // thing that plants and removes it — a pill hidden by a signal nobody clears
  // is a pill that never comes back.
  assert.match(mount, /removeAttribute\("data-pmc-dock"\)/,
    "and destroy clears the signal, which is what restores the pill");
});
