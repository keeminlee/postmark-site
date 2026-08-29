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
  // The measured reference moved from `o.svg` (mount-time) to `liveSvg()`
  // (2026-08-28, same night): the viewer rebuilds its svg on a view change, and
  // a detached svg answers getBoundingClientRect with zeros — so the fence was
  // measuring a ghost the moment the view changed. Same fence, living ruler.
  assert.match(mount, /const paint = liveSvg\(\)\?\.getBoundingClientRect\?\.\(\);/,
    "placeBar measures the living painting");
  // The fence is now a SPAN rather than a centre-and-width pair, because the row
  // also steps aside from bottom-corner furniture (below) and both ends have to
  // be able to move independently. Its floor and ceiling are still the
  // painting's edges and nothing else's.
  assert.match(mount, /let lo = wide \? paint\.left \+ 10 : 14;/,
    "the row's left edge comes off the painting, not the viewport");
  assert.match(mount, /let hi = wide \? paint\.right - 10 : vw - 14;/,
    "and so does its right edge");
  assert.match(mount, /bar\.style\.left = `\$\{\(berthLo \+ berthHi\) \/ 2\}px`;/,
    "and the row centers between them rather than over the viewport");
});

test("the row holds still under a pointer, so the dock cannot slide out from under a click", () => {
  // ⚑ CAUGHT WHILE PILOTING IT, 2026-08-28, and it is the cost of having made
  // the row re-measure promptly rather than once. The viewer's furniture is
  // transient — the exit pill comes and goes with what it thinks you can step
  // into — so the row stepped aside for it, stepped back when it left, and
  // stepped aside again. A dock whose faces move a hundred pixels while a hand
  // is reaching for one is a dock you misclick: aiming at rei and pressing the
  // illuminator, twice.
  //
  // The harm was only ever the row moving under a pointer that was aiming at
  // it, so that is the whole of the condition: while the row is hovered it does
  // not move in either direction, and the instant the pointer leaves it
  // measures itself honestly again.
  //
  // A first pass never gave the berth back at all. That stopped the dancing and
  // left the row permanently squeezed by furniture long since gone — one armed
  // walk and the bar sat at two thirds width for the rest of the standpoint,
  // trading a misclick for a papercut and keeping the papercut.
  assert.match(mount, /if \(here !== berthKey\) \{ berthKey = here; berthLo = null; berthHi = null; \}/,
    "a new standpoint measures the room again from scratch");
  assert.match(mount, /const held = berthLo != null && \(root\.querySelector\("\.pmc-barrow"\)\?\.matches\?\.\(":hover"\) \?\? false\);/,
    "the row holds its berth only while a pointer is actually on it");
  assert.match(mount, /if \(!held\) \{ berthLo = lo; berthHi = hi; \}/,
    "and measures itself honestly again the moment the pointer leaves");
});

test("the row steps around bottom-corner furniture before it climbs over it", () => {
  // ⚑ FOUNDER-CAUGHT 2026-08-28, mid-fight: "the action buttons somehow floated
  // vertically upwards and now have a horizontal scroll."
  //
  // The fence answered every piece of the viewer's bottom furniture the same
  // way — lift the whole row above the tallest of them. `.wv-walkdesk` is 194px
  // tall and sits in the painting's bottom-RIGHT corner, so arming a walk threw
  // the entire row 216px up a 893px window to clear something it overlapped
  // along one sixth of its length. Measured on his screen at the moment he
  // reported it: desk top 689, row bottom 215.938px, row spanning x 222–1910
  // against a desk spanning 1606–1910.
  //
  // A corner is something you go around. So the lift is no longer computed from
  // every piece on the edge — only from the ones that could not be stepped past.
  assert.match(mount, /if \(box\.right <= lo \|\| box\.left >= hi\) continue;/,
    "furniture the row does not reach is not furniture the row must answer for");
  assert.match(mount, /if \(keepLeft >= keepRight && keepLeft >= full \* KEEP_FRACTION\) hi = endBefore;/,
    "the row ends before a right-hand corner piece rather than rising over it");
  assert.match(mount, /else if \(keepRight > keepLeft && keepRight >= full \* KEEP_FRACTION\) lo = beginAfter;/,
    "and begins after a left-hand one");
  assert.match(mount, /for \(const box of climb\) clear = Math\.max\(clear, h - box\.top \+ 12\);/,
    "and the lift is measured off what is left — never off a piece already dodged");
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

// ══ THE MAP IS A CONTROL (2026-08-28 ruling) ══
//
// "Clicking a point on the map while acting as a walker should prefill/dispatch
// the walk to that point. Clicking a thing offers its context acts with the
// object prefilled."
//
// THE SEAM AND ITS WEAKNESS, pinned together on purpose. The viewer's delegated
// click handler reads `e.target.closest(".stand")` and hands the coordinates to
// its own chooseWalkPoint — and NOTHING IN THE VIEWER CARRIES THAT CLASS, in the
// pinned build or on the branch the pin is heading to. The hook is live and its
// elements are gone. It is the only walk route the viewer publishes (its window
// handle carries rerender/reload/stop and no walk of any kind), so the cockpit
// mints one and clicks it — the same move the page's arrival island already
// makes against `.ctl[data-x]`.
//
// Leaning on a vestigial hook is only safe because the result is CHECKED, which
// is what the second test here exists to keep true. If the world lane ever tidies
// that handler away, the reader is told the shortcut is not working rather than
// left clicking a map that quietly does nothing.
test("a bare-ground click is handed to the viewer's own walk-arming path", () => {
  assert.match(mount, /b\.className = "stand";/,
    "the cockpit mints the element the viewer's handler is looking for");
  assert.match(mount, /b\.dataset\.x = String\(m\.x\);\r?\n\s*b\.dataset\.y = String\(m\.y\);/,
    "carrying the coordinates that handler reads");
  assert.match(mount, /b\.click\(\);\r?\n\s*b\.remove\(\);/,
    "clicked and removed — nothing of ours is left in the viewer's DOM");
  // and NO second pathing anywhere: the walk is never dispatched straight at the
  // door from a map click, which would skip the viewer's wall check, its
  // zero-length refusal, its preview and the walker's own confirm.
  assert.doesNotMatch(mount, /dispatchEnvelope\(\{ action: "walk"/,
    "a map click must not post a walk behind the viewer's back");
});

test("the vestigial hook is verified, not trusted", () => {
  assert.match(mount, /const deskOpen = \(\) => \{/,
    "there is a receipt for the click having landed");
  assert.match(mount, /if \(deskOpen\(\) \|\| before\) return;/,
    "read after the click, against the state before it");
  assert.match(mount, /text: "the map could not arm that walk"/,
    "and a click that armed nothing says so rather than going quiet");
});

test("the cockpit takes only the clicks on figures it drew itself", () => {
  // The viewer's marks are the viewer's to answer for. An overlay that
  // hit-tested them would be quietly replacing the surface underneath it.
  assert.match(mount, /if \(ev\.target\?\.closest\?\.\("#wv-overlay \[data-id\], \.wv-card, \.ctl, button, a"\)\) return;/,
    "a click on anything the viewer owns is left alone entirely");
  assert.match(mount, /o\.svg\?\.addEventListener\?\.\("click", onMapClick, true\);/,
    "listened for in capture, so our own figures can be taken first");
  assert.match(mount, /o\.svg\?\.removeEventListener\?\.\("click", onMapClick, true\);/,
    "and given back at destroy");
  // stopPropagation happens ONLY on one of our figures
  assert.match(mount, /const thing = thingAt\(local\);\r?\n\s*if \(thing\) \{\r?\n\s*ev\.preventDefault\(\);\r?\n\s*ev\.stopPropagation\(\);/,
    "the viewer's click is only ever swallowed for a figure this cockpit drew");
});

test("a context act carries its object into the field the menu named", () => {
  assert.match(mount, /formValues = state\.context \? \{ \[field\]: state\.context\.thing\.id \} : null;/,
    "the thing's id is seeded into the field contextActs picked out for it");
  // and the menu offers only what the DOOR affords, never a verb of ours
  assert.match(mount, /if \(!s\.afforded \|\| !s\.enabled \|\| !s\.card\) return false;/,
    "an act the ground does not afford is not offered on a thing either");
});

// ══ THE DOCK'S SELECTION ACTUALLY REACHES THE VIEWER (2026-08-28, corrected) ══
//
// THE EVENT WAS DEAD WIRE, measured rather than assumed: the string "pm:" does
// not occur anywhere in spectator/viewer.mjs at the pinned build (package.json
// holds ceeca087), and no listener for it exists under src/ either. The
// listeners DO exist on the world's proto/birthday branch (2cf10d0f, 3d1fbfe0)
// — this pin is simply behind them.
//
// WHAT THAT COST, and it is not cosmetic: confirmSelectedWalk posts
// `state.handle` and takes no per-call actor argument, so with the dock's
// selection never reaching the viewer, a reader who picked a face here and then
// clicked the map armed a walk for whoever the viewer still thought was acting.
// Silently, and for the wrong resident.
//
// The working route is the viewer's own delegated control, minted and clicked:
//     const actor = e.target.closest("[data-act-as]");
//     if (actor) { selectActor(actor.dataset.actAs); return; }   // viewer.mjs:7681
test("the dock drives the viewer's own act-as control, not only the event", () => {
  assert.match(mount, /b\.setAttribute\("data-act-as", actor\);/,
    "speakActAs mints the element the viewer's delegate is looking for");
  assert.match(mount, /new w\.CustomEvent\("pm:act-as", \{ detail: \{ actor \} \}\)/,
    "and still speaks the event, which starts working when the pin is bumped");
});

test("it does not call selectActor when the viewer already agrees", () => {
  // selectActor runs clearSelectionAndDestination() and recenters the camera
  // (viewer.mjs:8060, 8064), so a redundant call throws away an armed walk and
  // moves the map out from under the reader. The guard reads the key the viewer
  // persists its actor under.
  assert.match(mount, /const VIEWER_ACT_AS = "pm\.world\.act_as";/,
    "the viewer's own persisted key is the signal");
  assert.match(mount, /if \(viewerActor\(\) !== actor\) \{/,
    "and the mint happens only on a real difference");
});

test("the actor is settled BEFORE the walk is armed, never after", () => {
  // Ordering is load-bearing: selectActor clears the destination, so settling
  // the actor after arming would throw away the walk that was just armed.
  const walkFn = /const walkFromMap = \(m\) => \{[\s\S]*?\n  \};/.exec(mount)?.[0] ?? "";
  assert.ok(walkFn, "walkFromMap must be findable");
  const settle = walkFn.indexOf("speakActAs();");
  const arm = walkFn.indexOf('b.className = "stand";');
  assert.ok(settle > -1, "walkFromMap settles the actor");
  assert.ok(arm > -1, "walkFromMap arms the destination");
  assert.ok(settle < arm, "and it settles BEFORE it arms — the other order wipes the destination");
});

// ── the seats get glyphs, and the way out folds in (2026-08-29 rulings) ──────
test("every seat draws a glyph, and a verb the map has never heard of still draws one", () => {
  // THE RULING: "some icons on the different actions to make them distinct."
  //
  // This is the nearest thing to a verb list on the surface, which is why the
  // DEFAULT is the part worth pinning. The bar's standing law is that it offers
  // whatever the door listed; a picture cannot be derived from a card, so it
  // costs a lookup by name. What keeps that from becoming a list is that a name
  // the map has never heard of draws the neutral mark and the seat works
  // exactly as it always did — a door growing a verb tomorrow gets a plain
  // glyph, never a missing seat and never a throw.
  assert.match(mount, /const ICON_DEFAULT = /, "there is a mark for the verbs nobody anticipated");
  assert.match(mount, /const d = ICONS\[String\(action \?\? ""\)\.toLowerCase\(\)\] \?\? ICON_DEFAULT;/,
    "and the lookup falls back to it rather than drawing nothing");
  assert.match(mount, /\$\{iconFor\(s\.action\)\}\s*\n\s*<span class="pmc-name">/,
    "the glyph rides on the seat, above its name");
  assert.match(mount, /stroke: currentColor;/,
    "and takes the seat's own colour rather than introducing a second palette");
});

test("the way out is one control: the pill stands down and the seat says where it leads", () => {
  // THE RULING: "if the exit button is IN the action bar, we don't need another
  // redundant button." The pill carried one thing the seat did not — the NAME of
  // what you step out into — so the seat takes it over rather than losing it.
  assert.match(worldPage, /html\[data-pmc-dock\] \.wv-scene-exit \{ display: none; \}/,
    "the viewer's standalone pill stands down while the dock is mounted");
  assert.match(worldPage, /THE SECOND-WRITER TENSION, DISCLOSED/,
    "and the fact that this is the site touching the viewer's furniture is written down, not hidden");
  // WHICH seat, decided by the door's own sentence rather than by a verb name
  assert.ok(mount.includes('const leaves = (s.card?.fields ?? []).some((f) =>'),
    "which seat is the way out is asked of the seat's own card, not of a verb name");
  assert.ok(mount.includes('out of') && mount.includes('.test(f.description ?? "")'),
    "and the question it asks is the door's own sentence about stepping out of something");
  assert.match(mount, /return `→ \$\{String\(parent\)\.split\("\/"\)\.pop\(\)\.replace\(\/-\/g, " "\)\}`;/,
    "and it names the containment the door already published");
});

test("an act names the SELECTED resident's standing, not the key's first handle", () => {
  // ⚑ THE ACT SIDE OF THE SEAT LAW, still on the old rule a day after the read
  // side was fixed. The dispatch passed `orientingHandle(o.me)` — the first
  // handle on the key, written for a key holding one resident. The founder's
  // holds six and the office orders the Illuminator first, so every act went
  // out naming her whoever the dock had selected. The comment beside that line
  // stated the point ("so the bar cannot be drawn for one standpoint and act
  // from another") while the line under it did exactly that.
  //
  // Caught the moment the human could fight at all: the door refused a human's
  // strike in the candle vault with "not afforded where you stand", correctly —
  // the act had oriented from a looking-room that grants no arena verbs.
  assert.match(mount, /const res = await o\.dispatch\(dispatchEnvelope\(\{ action, args, acting: state\.acting, handle: seat\(\) \}\)\);/,
    "the act carries the seat, not the first handle the key happens to list");
  assert.doesNotMatch(mount, /handle: orientingHandle\(o\.me\)/,
    "and the old first-handle rule is gone from the dispatch entirely");
  // the human BORROWS a seat rather than having one, which is the whole seam
  assert.match(mount, /if \(state\.acting !== HUMAN_ACTOR\) state\.seat = state\.acting;/,
    "a resident selection is its own seat");
  assert.match(mount, /if \(state\.acting && state\.acting !== HUMAN_ACTOR\) return state\.acting;\s*\n\s*return state\.seat \?\? orientingHandle\(o\.me\);/,
    "and acting as yourself keeps the seat you were already standing in, first handle only as a last resort");
  // one resolution, not two — the shadow read asks the same question
  assert.match(mount, /const asking = seat\(\);/,
    "the terms read asks whose standing the same way the act does");
});

test("the camera watch follows the living svg, like the layer and the framing before it", () => {
  // ⚑ THE THIRD SIGHTING OF ONE SEAM IN ONE NIGHT — the token layer, then the
  // framing, now the watch. The viewer REBUILDS its painting on a view change,
  // and this observer was pointed at whichever element existed at mount. Once
  // the viewer swapped it the watch was on a detached node and never fired
  // again, so the token kept the size and offset it had at its last draw — both
  // screen constants derived from the viewBox.
  //
  // Caught by reading the transform rather than the picture: the human's token
  // sat at standpoint + 0.0288 units with the viewBox 240 units wide, which is
  // exactly the offset that was right when the view was 1.6 units across. On
  // screen, a portrait several times too large sitting on the ring it is meant
  // to stand beside.
  assert.match(mount, /const svg = liveSvg\(\);\s*\n\s*if \(!svg \|\| svg === watched\) return;/,
    "the watch re-points when the painting under it is replaced, and no-ops when it is not");
  assert.match(mount, /camera\?\.disconnect\(\);/,
    "the old watch is dropped rather than left running on a detached node");
  assert.doesNotMatch(mount, /camera\.observe\(o\.svg,/,
    "and nothing observes the mount-time svg any more");
});
