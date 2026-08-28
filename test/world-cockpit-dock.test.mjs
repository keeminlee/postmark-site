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

test("the roster rides inside the bar's own row, not as a floating plate", () => {
  // drawBar composes the dock as the row's first cell…
  assert.match(mount, /class="pmc-barrow">\$\{drawRoster\(\)\}<div class="pmc-bar"/,
    "drawBar wraps roster + bar in one .pmc-barrow row");
  // …and paint no longer mounts a second, standalone copy.
  assert.match(mount, /drawHere\(\) \+ drawWheel\(\) \+ drawBar\(\)/,
    "paint composes the roster only through drawBar");
  assert.doesNotMatch(mount, /drawWheel\(\) \+ drawRoster\(\) \+ drawBar\(\)/,
    "the old standalone composition is gone");
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
