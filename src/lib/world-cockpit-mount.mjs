// world-cockpit-mount.mjs — the cockpit's pixels.
//
// DOM only. Nothing here fetches, and nothing here decides what may be done: the
// caller hands it an ANSWER (the apex door's), an identity, the map's grid, and a
// `dispatch` function, and this draws exactly what those say. Split from the
// component so the renderer can be mounted against a fixture answer — which is the
// only way to look at a portal cockpit before any portal exists.
//
// Every word the bar shows about an act comes off the door's entry, through
// `world-cockpit.mjs`. There is no verb list here.

import {
  HUMAN_ACTOR, actorsFor, barSlots, cockpitShows, dialLine, dispatchEnvelope,
  portalOf, readBounce, statedLimit, termsFromRead, termsRows, tokenFor, tokenPlacement,
  wantsTextarea, worldToPx,
  blockedReason, encounterOf, humanWords, looseThings, rollsFrom, spaceOf,
  actCandidates, adversaryPlacement, chatField, chatShaped, prefillFor,
} from "./world-cockpit.mjs";
// ONE resolution of "which resident is this key standing as", shared with the read
// — so the bar cannot be drawn for one standpoint and act from another.
import { orientingHandle } from "./world-cockpit-door.mjs";

const NS = "http://www.w3.org/2000/svg";

// The mockup's palette, and the reason it is repeated here rather than borrowed:
// the world page renders NO site layout (it is a verbatim passthrough of the
// viewer shell), so there are no site tokens on this page to inherit. These are
// the values from the cockpit mockup — panel/gold/ink — and they are the viewer's
// own family, not a second visual language.
//
// ⚠ NO BACKTICKS BELOW, INCLUDING IN THE COMMENTS. This is a template literal, and
// a backtick in prose ENDS IT — the rest of the stylesheet then parses as JS and
// the whole module throws at import. It happened twice in one evening, the second
// time inside the comment written about the first, which is why the export and the
// falsifier below exist: care was not enough, so the last rule in this block is
// now something a test can look for.
export const COCKPIT_CSS = `
.pmc, .pmc * { box-sizing: border-box; }
.pmc {
  --pmc-ink:#e8e4da; --pmc-dim:#9aa1ad; --pmc-gold:#d9a860; --pmc-gold-dim:#8a6a30;
  --pmc-panel:rgba(14,18,26,.90); --pmc-line:rgba(217,168,96,.45);
  --pmc-live:#e0b25c;
  position: fixed; inset: 0; z-index: 7000; pointer-events: none;
  font: 15px/1.5 Georgia, "Times New Roman", serif; color: var(--pmc-ink);
}
/* The cockpit is dark in every theme on purpose: it is chrome over a night map,
   and a light panel here would be a hole punched in the painting. */
.pmc-plate {
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 8px;
  box-shadow: 0 2px 14px rgba(0,0,0,.55); pointer-events: auto;
}
.pmc-cap {
  color: var(--pmc-dim); font: 0.62rem/1 ui-monospace, Consolas, monospace;
  letter-spacing: .18em; margin-bottom: .55em; text-align: center;
}

/* ── the roster, DOCKED (2026-08-28, founder-caught) ──
   The floating left plate sat ON TOP of the viewer's own Act As row — two
   controls answering the same question, neither informing the other. The
   founder's ruling: who-acts sits BESIDE what-they-do. So the roster is now
   the leftmost cell of the bar's own row (.pmc-barrow), the viewer's old row
   stands down while this dock is mounted (data-pmc-dock on <html> is the
   signal), and a face click speaks pm:act-as so the viewer's walk desk and
   enter buttons follow the same selection. One control, one grammar strip. */
.pmc-roster {
  position: relative; flex: 0 0 auto; align-self: center;
  display: flex; align-items: center; gap: .35em;
  padding: .3em .55em; pointer-events: auto;
}
/* THE PICTURE IS CLIPPED, NOT THE BUTTON. An overflow:hidden here rounded the
   token off nicely and also ate the name box, which hangs outside the circle by
   design: the box was in the DOM with opacity 1 and a 239px width, and no reader
   could see a pixel of it. The machine twin read the text and reported it present;
   the screenshot is what caught it. */
.pmc-face {
  width: 2.3em; height: 2.3em; margin: 0; border-radius: 50%; padding: 0; flex: 0 0 auto;
  background: #1b2230; border: 2px solid rgba(154,161,173,.35); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--pmc-dim); font: 1em/1 ui-monospace, Consolas, monospace; position: relative;
}
.pmc-face img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
.pmc-face[aria-pressed="true"] { border-color: var(--pmc-gold); box-shadow: 0 0 12px rgba(217,168,96,.5); color: var(--pmc-gold); }
.pmc-face[disabled] { opacity: .4; cursor: not-allowed; }
.pmc-face:focus-visible { outline: 2px solid var(--pmc-gold); outline-offset: 2px; }
/* horizontal dock: the residents|human rule stands upright between them */
.pmc-rule { border-left: 1px dotted rgba(154,161,173,.4); align-self: stretch; margin: .15em .2em; }
/* the dock's caption sits above its shoulder, out of the row's height */
.pmc-roster .pmc-cap { position: absolute; left: .7em; bottom: calc(100% + .15em); margin: 0; }
/* the name box rises ABOVE the face — the bar owns the bottom edge, so a box
   hung to the right would run under the verb slots or off a phone's screen */
.pmc-nm {
  position: absolute; left: 50%; top: auto; bottom: calc(100% + .6em); transform: translateX(-50%);
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 5px;
  padding: .15em .55em; font: .68rem/1.4 Georgia, serif; color: var(--pmc-ink);
  white-space: nowrap; max-width: 22em; opacity: 0; transition: opacity .12s; pointer-events: none;
}
.pmc-face:hover .pmc-nm, .pmc-face:focus-visible .pmc-nm { opacity: 1; }
/* the hovered face rises, so its name box is never painted under the next face */
.pmc-face:hover, .pmc-face:focus-visible { z-index: 2; }
.pmc-nm.wrap { white-space: normal; width: 16em; }

/* ── the bar ── */
/* THE BAR IS A ROW, and it stays one. Wrapping was the default and the first
   shot showed what it costs: six fixed seats on one line, the HERE divider
   stranded with ENTER after it, and the afforded tray on a second line below —
   which is the taxonomy the whole bar exists to show, broken. So it does not
   wrap; where a ground grants more than fits, the row scrolls, and the fixed
   seats stay where the hand expects them. */
/* THE ROW THAT OWNS THE BOTTOM EDGE is now .pmc-barrow: dock + bar side by
   side, placed as one thing (placeBar moves the row, the same measured lift as
   before). The bar itself is a static flex child so its scrollport cannot clip
   the dock's name boxes — they are siblings, not passengers. */
.pmc-barrow {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: stretch; gap: .5em;
  max-width: calc(100vw - 28px); pointer-events: none;
}
.pmc-bar {
  position: static; flex: 1 1 auto; min-width: 0;
  display: flex; align-items: stretch; gap: .45em;
  flex-wrap: nowrap;
  justify-content: flex-start; pointer-events: none;
  overflow-x: auto; overflow-y: visible; scrollbar-width: thin;
  padding: 0 .2em 2px;
}
/* A SCROLLPORT CLIPS BOTH AXES — set overflow-x and overflow-y computes to auto
   with it — so a bar that can scroll would eat the very cards that hang above it.
   That is why the card and the form are not children of a slot: they live in the
   overlay and are positioned against the hovered seat, which also lets a card near
   the screen edge stay on screen instead of hanging off it. */
.pmc-bar { scroll-padding-inline: 1em; }
.pmc-slot { flex: 0 0 auto; }
/* A ROW THAT SCROLLS MUST SAY SO. At 390 the bar showed five seats and no sign
   there were five more — a reader on a phone would never find the afforded-here
   tray, which on this surface is the half that is actually about where they are
   standing. The classes are set by the script from a real measurement, so the
   cue appears only when something is genuinely off the edge. */
.pmc-bar.more-right { mask-image: linear-gradient(to right, #000 calc(100% - 3.5em), transparent 100%); }
.pmc-bar.more-left { mask-image: linear-gradient(to right, transparent 0, #000 3.5em); }
.pmc-bar.more-left.more-right { mask-image: linear-gradient(to right, transparent 0, #000 3.5em, #000 calc(100% - 3.5em), transparent 100%); }
.pmc-more {
  position: fixed; z-index: 5; pointer-events: none;
  color: var(--pmc-gold); font: .8rem/1 ui-monospace, Consolas, monospace;
  text-shadow: 0 0 8px rgba(0,0,0,.9);
}
.pmc-more[hidden] { display: none; }
.pmc-slot {
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 8px;
  min-width: 6.2em; padding: .95em .7em .5em; text-align: center; position: relative;
  cursor: pointer; pointer-events: auto; color: inherit; font: inherit;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.pmc-slot:hover:not([disabled]), .pmc-slot:focus-visible { border-color: var(--pmc-gold); box-shadow: 0 0 14px rgba(217,168,96,.35); }
.pmc-slot:focus-visible { outline: none; }
.pmc-slot[disabled] { opacity: .38; cursor: not-allowed; }
.pmc-key { position: absolute; top: .3em; left: .45em; color: var(--pmc-dim); font: .68rem/1 ui-monospace, Consolas, monospace; }
.pmc-name { color: var(--pmc-ink); font-size: .95em; letter-spacing: .04em; }
/* Capped, because one verbose class can otherwise set the width of the whole row
   — a two-dial class (reach_m 3 · burns_crossings 2) made KINDLE twice its
   neighbours' width in the first shot. The full dials are on the card, which is
   where detail belongs. NOTE: this whole block is a JS template literal, so it
   can hold no backticks — one here silently ended the string and the module threw
   on the CSS that followed. */
.pmc-dial {
  color: var(--pmc-dim); font: .68rem/1.3 ui-monospace, Consolas, monospace; margin-top: .2em;
  max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pmc-slot.afford { border-style: dashed; }
.pmc-slot.afford .pmc-name { color: var(--pmc-gold); }
/* WHICH SEAT IS OPEN, said on the seat. Opened by mouse the seat is under the
   pointer and reads as chosen; opened by a number key nothing on the bar changed
   at all, so the form floated over a row with no sign of where it came from. */
.pmc-slot.open { border-color: var(--pmc-gold); background: rgba(217,168,96,.14); }
.pmc-slot.open .pmc-name { color: var(--pmc-gold); }
.pmc-gap { width: .7em; border-left: 1px dotted rgba(154,161,173,.4); margin: 0 .25em; align-self: stretch; display: flex; align-items: flex-end; }
.pmc-gap span { writing-mode: vertical-rl; color: var(--pmc-dim); font: .6rem/1 ui-monospace, Consolas, monospace; letter-spacing: .2em; padding-bottom: .4em; }

/* ── the card ── */
/* THE CARD TAKES NO POINTER, and this is a correctness rule rather than a nicety.
   A card is 24em wide over a 6.2em seat, so it hangs across four of its
   neighbours; with pointer-events on, sliding the mouse along the bar puts the
   previous slot's card under the cursor and the hover never reaches the seat
   beneath it. Caught by the shot runner, which could not hover SAY at all while
   EXIT's card was up. It is role="tooltip" — nothing in it was ever clickable. */
.pmc-card {
  position: fixed; width: 24em; max-width: calc(100vw - 24px);
  background: var(--pmc-panel); border: 1px solid var(--pmc-gold);
  border-radius: 8px; padding: .75em .9em; text-align: left; box-shadow: 0 4px 20px rgba(0,0,0,.6);
  z-index: 3; pointer-events: none;
}
.pmc-card[hidden] { display: none; }
.pmc-blurb { font-style: italic; color: var(--pmc-ink); font-size: .88rem; line-height: 1.45; margin: 0; }
.pmc-blurb.none { font-style: normal; color: var(--pmc-dim); }
.pmc-from { color: var(--pmc-dim); font-size: .7rem; margin: .35em 0 .5em; line-height: 1.45; }
.pmc-row { font: .74rem/1.65 ui-monospace, Consolas, monospace; color: var(--pmc-dim); margin: 0; }
.pmc-row b { color: var(--pmc-gold); font-weight: normal; }

/* ── the act form ── */
/* The form lives in the overlay, not in the bar, for the scrollport reason above.
   Bottom is set by the script against the bar's measured top edge, so it sits over
   the row whatever height the row turns out to be. */
.pmc-form { position: fixed; left: 50%; transform: translateX(-50%); width: 26em; max-width: calc(100vw - 24px); padding: .9em 1em 1em; text-align: left; z-index: 4; }
.pmc-form h3 { margin: 0 0 .2em; font: .8rem/1.3 ui-monospace, Consolas, monospace; letter-spacing: .12em; color: var(--pmc-gold); font-weight: normal; }
.pmc-form label { display: block; margin: .6em 0 0; font-size: .72rem; color: var(--pmc-dim); }
.pmc-form label .req { color: var(--pmc-gold); }
.pmc-form input, .pmc-form textarea, .pmc-form select {
  width: 100%; margin-top: .25em; padding: .4em .5em; font: .82rem/1.4 Georgia, serif;
  color: var(--pmc-ink); background: rgba(0,0,0,.35); border: 1px solid rgba(154,161,173,.35); border-radius: 5px;
}
.pmc-form textarea { min-height: 4.5em; resize: vertical; }
.pmc-desc { margin: .25em 0 0; font-size: .66rem; line-height: 1.5; color: rgba(154,161,173,.85); }
.pmc-actions { display: flex; gap: .5em; margin-top: .9em; align-items: center; }
.pmc-btn { font: .74rem/1 Georgia, serif; padding: .55em 1em; border-radius: 999px; cursor: pointer; border: 1px solid var(--pmc-line); background: transparent; color: var(--pmc-gold); }
.pmc-btn.go { background: linear-gradient(180deg,#f0d5a8,#e8c48b); color: #0d1426; border-color: #f0d5a8; }
.pmc-btn[disabled] { opacity: .5; cursor: default; }
.pmc-said { margin: .8em 0 0; font-size: .74rem; line-height: 1.55; color: var(--pmc-ink); }
.pmc-said.bad { color: var(--pmc-live); }
.pmc-said .hint { display: block; color: var(--pmc-dim); font-size: .92em; margin-top: .3em; }
.pmc-terms { margin: .6em 0 0; padding: .5em .7em; border-left: 2px solid var(--pmc-gold-dim); font-size: .72rem; line-height: 1.55; color: var(--pmc-dim); }

/* ── the chat line ──
   RULED 2026-08-28: "everything I can do via the ui buttons, I have to type in
   like filling an mcp form." An act whose whole argument is one sentence should
   read as typing a sentence, so a chat-shaped act (chatShaped, in the arithmetic
   file — a prose field and nothing else required) opens THIS instead of a form.
   One line, docked over the bar, ENTER sends and ESC closes.

   It is not a second dispatch path: what leaves here goes out through the same
   dispatchEnvelope the form uses, carrying the same act name and the same field
   name off the same card. Only the chrome is different, which is the whole of
   the ruling — the grammar was never the complaint. */
.pmc-chat {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 4;
  display: flex; align-items: center; gap: .6em;
  width: 34em; max-width: calc(100vw - 24px); padding: .5em .7em;
}
.pmc-chat .who {
  flex: 0 0 auto; color: var(--pmc-gold);
  font: .62rem/1 ui-monospace, Consolas, monospace; letter-spacing: .14em;
}
.pmc-chat input {
  flex: 1 1 auto; min-width: 0; margin: 0; padding: .45em .7em;
  font: .92rem/1.4 Georgia, serif; color: var(--pmc-ink);
  background: rgba(0,0,0,.35); border: 1px solid rgba(154,161,173,.35); border-radius: 999px;
}
.pmc-chat input::placeholder { color: rgba(154,161,173,.55); font-style: italic; }
.pmc-chat input:focus { outline: none; border-color: var(--pmc-gold); }
/* the keys that work, said quietly and always — a line with no visible send
   button has to tell a reader how to send it */
.pmc-chat .keys { flex: 0 0 auto; color: var(--pmc-dim); font: .58rem/1.5 ui-monospace, Consolas, monospace; }
.pmc-chat .pmc-said { margin: 0; }

/* ══ THE TWO SPACES ══
   The founder ruled the dungeon as two rooms that should FEEL different: an
   antechamber — free-roam, social, where a weapon is picked up and spectators
   stand — and a boss room where crossing the inner door joins the fight. The
   difference is carried by the palette and the ground wash, not by new furniture,
   so every panel below is the same panel in both and only its temperature moves.
   These are the two tokens that do it; everything else reads them.

   The antechamber is the cockpit's own gold over ink — hearth-side. The arena
   pulls the accent toward ember and lays a low red wash along the floor of the
   screen, so a reader knows which room they are in before they read a word. */
.pmc[data-space="antechamber"] { --pmc-gold:#d9a860; --pmc-accent:#e0b25c; }
.pmc[data-space="arena"] { --pmc-gold:#e0894e; --pmc-accent:#e2603f; }
/* The ground each room stands on. One element, two paintings — and it has to be
   readable in the first half-second rather than on comparison, which is what the
   ruling asks for: the antechamber is a hearth glow rising off the floor, the
   arena is that glow gone to ember PLUS a vignette closing in from every edge, so
   the boss room feels like a room with walls and the antechamber does not. */
.pmc::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
.pmc[data-space="antechamber"]::after {
  background:
    radial-gradient(120% 62% at 50% 118%, rgba(224,178,92,.16), transparent 70%);
}
.pmc[data-space="arena"]::after {
  background:
    radial-gradient(120% 70% at 50% 118%, rgba(214,74,44,.24), transparent 68%),
    radial-gradient(88% 76% at 50% 44%, transparent 42%, rgba(6,4,6,.62) 100%);
}

/* ══ THE INITIATIVE WHEEL ══
   The turn order, rendered — hostiles hold real slots, the current turn is lit,
   the downed are visibly skipped rather than removed, and a late joiner wears the
   round they came in on. It sits top-centre: the one thing every player at the
   party needs to read at a glance is whose turn it is. */
.pmc-wheel { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); max-width: calc(100vw - 28px); padding: .5em .7em .6em; }
.pmc-wheel-cap { display: flex; align-items: baseline; gap: .8em; justify-content: center; margin-bottom: .5em; }
.pmc-wheel-cap b { color: var(--pmc-gold); font: .62rem/1 ui-monospace, Consolas, monospace; letter-spacing: .18em; font-weight: normal; }
.pmc-wheel-cap span { color: var(--pmc-dim); font-size: .66rem; }
/* An ORDERED list, because initiative order is the whole meaning of it — but the
   markers are painted over the seats by the browser, so they are turned off and
   the order is carried by position and by the ol itself for a screen reader. */
.pmc-wheel-row {
  display: flex; align-items: flex-end; gap: .35em; overflow-x: auto; scrollbar-width: thin;
  padding: 0 0 2px; margin: 0; list-style: none;
}
.pmc-wheel-row > li::marker { content: none; }
.pmc-turn {
  flex: 0 0 auto; width: 4.6em; text-align: center; padding: .4em .25em .35em;
  border: 1px solid transparent; border-radius: 7px; position: relative;
}
.pmc-turn .pip {
  width: 2.1em; height: 2.1em; margin: 0 auto .3em; border-radius: 50%;
  background: #1b2230; border: 2px solid rgba(154,161,173,.35); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  color: var(--pmc-dim); font: .82rem/1 ui-monospace, Consolas, monospace;
}
.pmc-turn .pip img { width: 100%; height: 100%; object-fit: cover; }
.pmc-turn .nm { display: block; color: var(--pmc-ink); font-size: .64rem; line-height: 1.25; overflow-wrap: anywhere; }
.pmc-turn .init { display: block; color: var(--pmc-dim); font: .58rem/1.4 ui-monospace, Consolas, monospace; }
.pmc-turn .hp { display: block; height: 3px; margin: .25em .2em 0; background: rgba(154,161,173,.22); border-radius: 2px; overflow: hidden; }
.pmc-turn .hp i { display: block; height: 100%; background: var(--pmc-accent); }
/* a hostile is not one of us: square shoulders, ember ring, no monogram circle */
.pmc-turn.is-creature .pip { border-radius: 5px; border-color: rgba(226,96,63,.55); color: #e2603f; }
/* the current turn is the loudest thing on the screen after the map */
.pmc-turn.is-current { border-color: var(--pmc-gold); background: rgba(217,168,96,.12); }
.pmc-turn.is-current .pip { border-color: var(--pmc-gold); box-shadow: 0 0 12px rgba(217,168,96,.55); }
.pmc-turn.is-current .nm { color: var(--pmc-gold); }
/* YOU, so a player can find themselves on a crowded wheel */
.pmc-turn.is-you .nm::after { content: " (you)"; color: var(--pmc-dim); }
/* DOWNED-NOT-DEAD. Greyed and struck, and still ON the wheel — being skipped is
   a thing that must be watchable, and a row that vanished would read as death. */
.pmc-turn.is-down { opacity: .45; }
.pmc-turn.is-down .pip { border-style: dashed; }
.pmc-turn.is-down .nm { text-decoration: line-through; }
.pmc-turn.is-down .init::after { content: " · down"; color: var(--pmc-accent); }
.pmc-turn .late {
  position: absolute; top: -.2em; right: -.1em; font: .52rem/1 ui-monospace, Consolas, monospace;
  color: #0d1426; background: var(--pmc-gold); border-radius: 999px; padding: .18em .38em;
}

/* ══ THE TURN GATE ══
   One line above the bar saying why the slots are cold. The slots stay, with
   their cards — the grammar stays legible; only the taking is withheld. */
.pmc-gate {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 4;
  padding: .4em .9em; border-radius: 999px; pointer-events: none;
  background: rgba(14,18,26,.94); border: 1px solid var(--pmc-line);
  color: var(--pmc-gold); font-size: .76rem; white-space: nowrap;
  max-width: calc(100vw - 24px); overflow: hidden; text-overflow: ellipsis;
}
/* Gated reads as cold, not as absent — and it keeps its hover, because the card
   behind it is the whole reason the slot was left standing. */
.pmc-slot.gated { opacity: .5; cursor: not-allowed; }
.pmc-slot.gated .pmc-name { color: var(--pmc-dim); }
.pmc-slot.gated:hover, .pmc-slot.gated:focus-visible { opacity: .72; border-color: var(--pmc-line); box-shadow: none; }

/* ══ THE THROW ══
   A die landing, centre-screen, big enough to be the moment it is. It leaves on
   its own; nothing waits for a reader to dismiss a result they already saw. */
.pmc-throw-layer { z-index: 7100; }
/* Raised well clear of the act form, which opens from the bottom and reaches the
   middle of the screen — at 42% the caption landed straight across the form's own
   blurb and neither could be read. */
.pmc-throw {
  position: fixed; left: 50%; top: 27%; transform: translate(-50%, -50%); z-index: 6;
  display: flex; gap: 1.1em; align-items: flex-start; pointer-events: none;
}
.pmc-die { text-align: center; animation: pmc-land .5s cubic-bezier(.2,1.5,.4,1) both; }
/* The caption carries its own ground. It can land over the painting, over a
   panel, or over a resident's name — a number nobody can read is not a moment. */
.pmc-die .sum, .pmc-die .whose {
  background: rgba(10,13,20,.92); border-radius: 5px; padding: .15em .5em;
  display: inline-block; max-width: 16em;
}
.pmc-die .whose { margin-top: .4em; }
.pmc-die .face {
  width: 3.4em; height: 3.4em; display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--pmc-gold); border-radius: 12px; background: rgba(14,18,26,.95);
  color: var(--pmc-ink); font: 1.9rem/1 Georgia, serif;
  box-shadow: 0 6px 26px rgba(0,0,0,.6);
}
.pmc-die .sum { display: block; margin-top: .35em; color: var(--pmc-dim); font: .64rem/1.4 ui-monospace, Consolas, monospace; }
.pmc-die .whose { display: block; color: var(--pmc-gold); font-size: .62rem; letter-spacing: .1em; }
/* A CRIT IS THE DOOR'S WORD, and it is dressed as the loud thing it is. At-max
   with no ruling gets a quieter mark, because the number is remarkable even when
   the rules have not said it means anything. */
.pmc-die.is-crit .face { border-color: #ffd98a; color: #ffe6b0; box-shadow: 0 0 34px rgba(255,217,138,.6); animation: pmc-crit 1.1s ease-in-out infinite; }
.pmc-die.is-crit .sum { color: #ffd98a; }
.pmc-die.at-max .face { border-color: var(--pmc-accent); }
@keyframes pmc-land {
  0% { opacity: 0; transform: translateY(-38px) rotate(-26deg) scale(.7); }
  70% { opacity: 1; transform: translateY(4px) rotate(4deg) scale(1.06); }
  100% { opacity: 1; transform: none; }
}
@keyframes pmc-crit { 50% { box-shadow: 0 0 52px rgba(255,217,138,.9); } }
@media (prefers-reduced-motion: reduce) {
  .pmc-die { animation: none; }
  .pmc-die.is-crit .face { animation: none; }
}

/* ── the standpoint plate, ON HOVER, OVER THE DOCK ──
   RULED 2026-08-28, at the live rehearsal: "let's make the card appear ON HOVER
   when you hover over the act as bottom bar."

   IT SUPERSEDES an always-on card pinned at left 14px / top 14px, kept named here
   because a reversal that hides what it reversed reads as somebody's regression.
   That card was the second element caught sitting on the site's own left rail —
   the first was the bar, fenced at placeBar; the fix for this one was the same
   fence, and it held for parcels and failed in the open world, where the map svg
   is full-bleed and its rect's left edge IS the viewport's. There was no third
   fence worth writing. Anchored to the dock the question does not arise: the
   plate hangs off a box that is already inside the painting, exactly as the
   faces' own name boxes do, and no page furniture can be underneath it.

   Its clearance is measured against those name boxes rather than guessed: a face
   box sits at 100% + .6em and stands about two ems tall, so the plate starts
   above the tallest of them and hovering a FACE shows both without a collision. */
.pmc-here {
  position: absolute; left: 0; bottom: calc(100% + 3.2em);
  width: max-content; max-width: min(30em, 60vw); padding: .55em .8em;
  opacity: 0; transition: opacity .12s; pointer-events: none;
}
.pmc-roster:hover .pmc-here, .pmc-roster:focus-within .pmc-here { opacity: 1; }
.pmc-here .who { color: var(--pmc-gold); font-size: .95rem; }
.pmc-here .spine { color: var(--pmc-dim); font-size: .78rem; margin-top: .25em; line-height: 1.45; }

@media (max-width: 720px) {
  .pmc-roster { padding: .25em .4em; gap: .25em; }
  .pmc-face { width: 2em; height: 2em; }
  .pmc-here { display: none; }
  .pmc-barrow { bottom: 10px; gap: .35em; }
  .pmc-bar { gap: .3em; }
  .pmc-slot { min-width: 4.9em; padding: .85em .45em .45em; font-size: .86rem; }
  .pmc-card { width: 18em; }
}
`;

let cssInstalled = false;
function installCss(doc) {
  // Injected at MOUNT, never at page load: outside portal ground this file adds
  // no rule to the document at all, which is the founder's scope ruling kept
  // literally rather than only visually.
  if (cssInstalled) return;
  const el = doc.createElement("style");
  el.id = "pmc-style";
  el.textContent = COCKPIT_CSS;
  doc.head.appendChild(el);
  cssInstalled = true;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Mount the cockpit.
 *
 * @param {object} o
 * @param {Document} o.document
 * @param {Element} o.host          where the overlay is appended
 * @param {SVGElement|null} o.svg   the map's svg, for the token; null = no token
 * @param {object} o.answer         the apex door's answer
 * @param {object|null} o.me        `GET /api/me`
 * @param {object|null} o.grid      `gridFrom(skeleton)`
 * @param {(envelope:object)=>Promise<{ok:boolean,status:number,body:any}>} o.dispatch
 * @param {(()=>Promise<object>)|null} o.refresh  re-read the door after an act
 * @returns {{destroy:()=>void, update:(answer:object)=>void}|null}
 */
export function mountCockpit(o) {
  const doc = o.document;
  if (!cockpitShows(o.answer)) return null;
  installCss(doc);

  const state = {
    answer: o.answer,
    acting: null,      // handle | HUMAN_ACTOR
    open: null,        // the action whose form is open
    said: null,        // the last thing the door said back
  };

  const root = doc.createElement("div");
  root.className = "pmc";
  root.setAttribute("data-pmc", "");
  o.host.appendChild(root);

  // A SEPARATE LAYER FOR THE THROW, and it is not decoration — `paint()` replaces
  // root.innerHTML wholesale, so a die appended into root is wiped by the very
  // repaint that follows the act which threw it. Measured: every throw rendered
  // and vanished inside the same tick, and the QA twin read an empty list while
  // the code looked right. It lives beside root, outside that churn.
  const throwLayer = doc.createElement("div");
  throwLayer.className = "pmc pmc-throw-layer";
  throwLayer.setAttribute("data-pmc-throws", "");
  o.host.appendChild(throwLayer);

  let tokenLayer = null;
  if (o.svg) {
    tokenLayer = doc.createElementNS(NS, "g");
    tokenLayer.setAttribute("id", "pmc-token-layer");
    tokenLayer.setAttribute("pointer-events", "none");
    o.svg.appendChild(tokenLayer);
  }

  // ── the roster ────────────────────────────────────────────────────────────
  function faces() {
    return actorsFor(state.answer, o.me, { acting: state.acting });
  }

  /**
   * Who the bar is serving when nobody has chosen yet.
   *
   * The door's `stance` decides it, not the roster's order: where the record says
   * a HUMAN is the one embodied, the map is already showing that person standing
   * there, and a bar quietly serving one of their residents would contradict the
   * figure on the map. Resolved before the first paint rather than inside the
   * roster's draw — the standpoint plate is painted first and read `null` for its
   * whole first frame, which is what "a spectator · inside a-hall/the-lit-door"
   * in the first QA shot was.
   */
  function resolveActing() {
    if (state.acting) return;
    const list = faces();
    const human = list.find((f) => f.kind === "human" && f.allowed);
    if (human && state.answer?.standpoint?.stance === "embodied-human") { state.acting = HUMAN_ACTOR; return; }
    const first = list.find((f) => f.kind === "resident" && f.allowed) ?? null;
    state.acting = first ? first.handle : (human ? HUMAN_ACTOR : null);
  }

  function drawRoster() {
    const list = faces();
    const residents = list.filter((f) => f.kind === "resident");
    const humans = list.filter((f) => f.kind === "human");
    const face = (f) => {
      const id = f.kind === "human" ? HUMAN_ACTOR : f.handle;
      const on = state.acting === id;
      // the roster's face and the map's token are the same picture, read once
      const token = f.kind === "human" ? tokenFor(f) : null;
      const inner = token?.src
        ? `<img src="${esc(token.src)}" alt="">`
        : esc((f.label ?? "?").slice(0, 1).toUpperCase());
      // The name box carries the REASON when a face is refused — a greyed circle
      // that will not say why is the surface refusing to explain the law it is
      // enforcing, which is the opposite of what this page is for. And an ALLOWED
      // human's box carries the door's own sentence, through `humanWords`: this
      // read `f.because` until 08-27, which is a field the office's roster does
      // not emit, so the door's words vanished the day the door started sending
      // them. See humanWords for the drift and why it is read both ways.
      const words = f.allowed
        ? (f.kind === "human" ? `${esc(f.label)} · yourself — ${esc(humanWords(f))}` : esc(f.label))
        : `${esc(f.label)} — ${esc(f.reason ?? "not here")}`;
      // The box wraps when its words are a SENTENCE rather than a handle — keyed
      // on the length, not on whether the face was refused. Keyed on refusal, an
      // allowed human's "yourself — a portal's ground seats a human" ran straight
      // out through the right-hand border under nowrap + max-width, which the
      // screenshot showed and no DOM read would have.
      const wrap = words.replace(/&[a-z#0-9]+;/g, "x").length > 28 ? " wrap" : "";
      return `<button type="button" class="pmc-face" data-actor="${esc(id)}"
        aria-pressed="${on}"${f.allowed ? "" : " disabled"}
        aria-label="${esc(f.label)}">${inner}<span class="pmc-nm${wrap}">${words}</span></button>`;
    };
    // DOCKED, not floating (2026-08-28): the roster is the bar's leftmost cell —
    // who-acts beside what-they-do. The law line rides as the dock's own title
    // now that a horizontal strip has no room for a paragraph.
    // The standpoint plate hangs off THIS box (2026-08-28 ruling) — a hover
    // reveal on the dock, the same way the faces' own name boxes are.
    return `<div class="pmc-plate pmc-roster pmc-dock" role="group" aria-label="act as"
      title="the hand journals on every act — recorded, never gated">
      <div class="pmc-cap">ACT AS</div>
      ${drawHere()}
      ${residents.map(face).join("")}
      ${humans.length ? `<div class="pmc-rule"></div>${humans.map(face).join("")}` : ""}
    </div>`;
  }

  // ── the bar ───────────────────────────────────────────────────────────────
  /** The card's CONTENTS. The `.pmc-card` box itself is a single host element in
   *  the overlay, filled on hover — see showCard. */
  function cardHtml(card) {
    if (!card) return "";
    const fields = card.fields.length
      ? `<p class="pmc-row"><b>fields</b> ${card.fields.map((f) => esc(f.name) + (f.required ? "*" : "")).join(" · ")}</p>`
      : `<p class="pmc-row"><b>fields</b> none — this act takes no arguments</p>`;
    const dials = card.dials
      ? `<p class="pmc-row"><b>dials</b> ${esc(Object.entries(card.dials).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · "))}</p>`
      : "";
    const blurb = card.blurb
      ? `<p class="pmc-blurb">“${esc(card.blurb)}”</p>`
      : `<p class="pmc-blurb none">the class mark that defines this act carries no blurb</p>`;
    const from = card.blurbFrom
      ? `<p class="pmc-from">quoted from the class mark that defines it — ${esc(card.blurbFrom)}${card.grantedBy && card.grantedBy !== card.blurbFrom ? `<br>granted here by ${esc(card.grantedBy)}` : ""}</p>`
      : "";
    const via = card.via || card.grant
      ? `<p class="pmc-row"><b>reached you</b> ${esc([card.via, card.grant === "here" ? "granted by the ground" : card.grant === "yours" ? "travels with what you are" : null].filter(Boolean).join(" · "))}</p>`
      : "";
    // THE TERMS, ON THE CARD, BEFORE ANYTHING IS DONE. The bare standpoint read
    // does not carry them; the act's SHADOW does — `read: <action>` returns the
    // act's full card with the terms that would bind it, and performs nothing
    // ("A read never performs", the apex's own law). So the card asks for them
    // once per act, caches the answer, and shows them where the law says they
    // belong: at the door, ahead of the act.
    const known = termsCache.get(card.action);
    const terms = known === undefined
      ? `<p class="pmc-row"><b>terms</b> reading the act's shadow…</p>`
      : known === null ? ""
      : `<div class="pmc-terms"><b>terms</b> — what would bind this act${termsHtml(known)}</div>`;
    return `${blurb}${from}${dials}${fields}${via}${terms}`;
  }

  /** One row per key, whatever keys the door sent. */
  function termsHtml(terms) {
    return termsRows(terms).map((r) => `<p class="pmc-row"><b>${esc(r.key)}</b> ${esc(r.value)}</p>`).join("");
  }

  function slotHtml(s, extraClass) {
    // Three states, and they are three different sentences. Not afforded here is
    // the ground's answer; blocked is the clock's; enabled is neither. A slot that
    // collapsed the last two would tell a waiting player their act had gone away.
    const label = s.afforded
      ? `${s.label}${s.blocked ? " — " + s.blocked : ""}`
      : `${s.label} — not afforded where you stand`;
    const open = state.open === s.action ? " open" : "";
    const gated = s.blocked ? " gated" : "";
    // GATED IS aria-disabled, NOT disabled, and that is the founder's ruling
    // working rather than a nicety. A `disabled` button fires no pointer events at
    // all, so hovering it shows no card — the slot stayed visible and its LAW went
    // unreadable at exactly the moment a waiting player has time to read it.
    // Caught in the gated-card QA shot, which came back with an empty screen.
    // Not-afforded keeps real `disabled`: there is no card behind it to read.
    const stop = s.afforded ? `aria-disabled="${!s.enabled}"` : "disabled";
    return `<button type="button" class="pmc-slot${extraClass ? " " + extraClass : ""}${open}${gated}" data-action="${esc(s.action)}"
      aria-expanded="${state.open === s.action}"
      ${stop} aria-label="${esc(label)}"
      ${s.afforded ? 'aria-describedby="pmc-card"' : ""}>
      ${s.key ? `<span class="pmc-key">${s.key}</span>` : ""}
      <span class="pmc-name">${esc(s.label)}</span>
      <span class="pmc-dial">${esc(s.afforded ? dialLine(s.card) : "not here")}</span>
    </button>`;
  }

  function drawBar() {
    const { fixed, tray, blocked } = barSlots(state.answer);
    // The dock rides INSIDE the row but OUTSIDE the bar's scrollport — siblings,
    // so the scroll clips verbs and never the faces' name boxes.
    return `<div class="pmc-barrow">${drawRoster()}<div class="pmc-bar" role="toolbar" aria-label="what can be done from here">
      ${fixed.map((s) => slotHtml(s)).join("")}
      ${tray.length ? `<div class="pmc-gap"><span>HERE</span></div>` : ""}
      ${tray.map((s) => slotHtml(s, "afford")).join("")}
    </div></div>
    ${blocked ? `<p class="pmc-gate" role="status">${esc(blocked.reason)}</p>` : ""}
    <span class="pmc-more" data-more="left" aria-hidden="true" hidden>‹</span>
    <span class="pmc-more" data-more="right" aria-hidden="true" hidden>›</span>
    <div class="pmc-card" id="pmc-card" role="tooltip" hidden></div>
    ${state.open ? (opensAsChat(state.open) ? chatHtml(state.open) : formHtml(state.open)) : ""}`;
  }

  /**
   * WHERE THE BAR IS ALLOWED TO SIT.
   *
   * The viewer already owns the bottom edge: `.wv-spectator-coordinate` is pinned
   * bottom-centre (z-index 6) and `.wv-walkdesk` bottom-right (z-index 8), and
   * this overlay sits at 7000 — so a bar pinned to the bottom wins every time and
   * covers a resident's coordinate readout and the left edge of the desk they
   * confirm a departure in. That is the mistake this page has already been
   * scolded for once, in the founder's own words about the time-travel panel:
   * "Time Travel sits ON TOP of walking."
   *
   * So the bar is MEASURED into the free space above them rather than guessed
   * into a corner — the same move the time-travel panel's own `place()` makes,
   * and for the same reason: those elements' sizes are the viewer's business and
   * a number copied here would be a second one to drift. With neither present
   * (the harness, a viewer that moved them) it falls back to the bottom, which is
   * exactly where it sat before this existed.
   */
  function placeBar() {
    // the whole row (dock + bar) moves as one; the bar alone is the fallback
    // shape for a harness that mounted pieces
    const bar = root.querySelector(".pmc-barrow") ?? root.querySelector(".pmc-bar");
    if (!bar) return;
    const h = doc.defaultView?.innerHeight ?? 0;
    let clear = 18;
    // THE WAY OUT IS ON THIS LIST TOO (founder-caught 2026-08-28: "step outside"
    // and the room's own name printed on top of each other at the dock's end of
    // the row). `.wv-scene-exit` is the viewer's exit pill, pinned into the
    // painting's bottom-left at bottom:58px — and it is NEWER than this fence,
    // so it was simply never measured. The arithmetic that made it collide:
    // `.wv-walkdesk` ships hidden and only appears while a walk is armed, so on
    // an ordinary frame the tallest thing here is the coordinate chip (bottom 8,
    // ~26 tall) and the row lands at about 46px — a band that runs straight
    // through the pill's 58-to-86. The dock is the row's leftmost cell and the
    // pill is at the painting's left edge, which is why it read as the DOCK's
    // collision rather than the bar's.
    //
    // Measured, not moved: the pill is the viewer's element and restyling it
    // from here would be the second writer this fence exists to avoid. The row
    // lifts over it exactly as it lifts over the walk desk.
    for (const sel of [".wv .wv-walkdesk", ".wv .wv-spectator-coordinate", ".wv .wv-paint-tallies", ".wv .wv-scene-exit"]) {
      const el = doc.querySelector(sel);
      if (!el || !el.getClientRects().length) continue;
      const box = el.getBoundingClientRect();
      if (!box.height) continue;
      clear = Math.max(clear, h - box.top + 12);
    }
    // never push the bar off the top of a short window
    bar.style.bottom = `${Math.min(clear, Math.max(18, h - 120))}px`;
    // FENCED TO THE PAINTING (2026-08-28, seen the moment the dock landed): a
    // viewport-centered row runs its left end under the nav and card columns —
    // the dock's ACT AS faces sat on the nav's own text, and the verb slots
    // have quietly overlapped the card column since the bar shipped. The map
    // pane is the ground these verbs act ON, and the cockpit already holds its
    // svg; the row centers over that pane and never leaves it. The 50%-of-
    // viewport fallback is the harness's (no svg mounted).
    const paint = o.svg?.getBoundingClientRect?.();
    if (paint && paint.width > 300) {
      bar.style.left = `${paint.left + paint.width / 2}px`;
      bar.style.maxWidth = `${Math.max(280, paint.width - 20)}px`;
    }
    // THE HERE-PLATE NEEDS NO FENCE ANY MORE, and its absence here is the point
    // rather than an omission. It rode this same rect until 2026-08-28 — the
    // second element caught sitting on the site's rail — and the fence held for
    // parcels and failed in the open world, where the map svg is full-bleed so
    // this rect's left edge IS the viewport's. The founder's ruling moved the
    // plate onto the dock instead, where it hangs off a box already inside the
    // painting and there is nothing left to clamp. A third fence would have been
    // the third instance of one bug.
  }

  /** Measured, never assumed: the arrows and the edge fade come and go with the
   *  bar's real scroll position. */
  function markOverflow() {
    const bar = root.querySelector(".pmc-bar");
    if (!bar) return;
    const left = bar.scrollLeft > 2;
    const right = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
    bar.classList.toggle("more-left", left);
    bar.classList.toggle("more-right", right);
    const box = bar.getBoundingClientRect();
    const h = doc.defaultView?.innerHeight ?? 0;
    for (const el of root.querySelectorAll(".pmc-more")) {
      const isRight = el.getAttribute("data-more") === "right";
      el.hidden = isRight ? !right : !left;
      el.style.bottom = `${Math.max(4, h - box.bottom + box.height / 2 - 8)}px`;
      el.style.left = isRight ? `${box.right - 16}px` : `${box.left + 4}px`;
    }
  }

  /** Put a fixed-position panel above the bar, clamped into the viewport. Reading
   *  the bar's own box rather than assuming its height, because a row that can
   *  scroll may or may not be showing a scrollbar. */
  function placeAbove(el, anchor) {
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const w = doc.defaultView?.innerWidth ?? 0;
    el.style.bottom = `${Math.max(8, (doc.defaultView?.innerHeight ?? 0) - a.top + 10)}px`;
    if (el.classList.contains("pmc-card")) {
      const box = el.getBoundingClientRect();
      const want = a.left + a.width / 2 - box.width / 2;
      // FENCED TO THE PAINTING, like the bar (placeBar, f68de054f): the card's
      // old floor was the VIEWPORT's left edge, so a seat near the painting's
      // left side slid the card onto the site rail (founder-caught 2026-08-28,
      // the roots card over CONVERSATIONS/sign-out). The painting's own rect is
      // the card's world; the viewport clamp stays only as the outer bound.
      const paint = o.svg?.getBoundingClientRect?.();
      const lo = Math.max(12, (paint?.left ?? 0) + 8);
      const hi = Math.max(lo, Math.min(w - box.width - 12, (paint ? paint.right : w) - box.width - 8));
      el.style.left = `${Math.min(Math.max(lo, want), hi)}px`;
      el.style.transform = "none";
    }
  }

  /** action → terms | null (asked and the door had none, or the read failed).
   *  `undefined` means not asked yet, which is what the card's "reading…" line
   *  is showing. One request per act, for the life of the mount. */
  const termsCache = new Map();

  function askTerms(action) {
    if (termsCache.has(action) || !o.readTerms) return;
    termsCache.set(action, undefined);
    // A SHADOW NEEDS A RESIDENT NAMED. The office's read path builds its fields
    // as `{ ...envelope, ...(args.handle ? { handle } : {}) }` with the comment
    // that "a multi-resident key that named its handle must not meet the
    // which-resident bounce on a read" — so a key holding more than one resident
    // bounces without it, and this key usually does. The terms are a property of
    // the CLASS rather than of the asker, so acting as the human simply asks in
    // the name of a resident on the same key; the answer is the same either way.
    const asking = state.acting && state.acting !== HUMAN_ACTOR
      ? state.acting
      : (Array.isArray(o.me?.handles) ? o.me.handles[0] : null);
    o.readTerms(action, asking).then((body) => {
      termsCache.set(action, termsFromRead(body));
      // Re-render only if this act is still the one under the pointer — a card
      // that repaints for an act the reader has already moved off is a flicker.
      const still = root.querySelector(".pmc-slot:hover, .pmc-slot:focus-visible");
      if (still?.getAttribute("data-action") === action) showCard(still);
    }).catch(() => { termsCache.set(action, null); });
  }

  function showCard(slotEl) {
    const host = root.querySelector("#pmc-card");
    if (!host || !slotEl) return;
    // A card behind an open form says the act's blurb twice, in two panels that
    // overlap — seen in QA. The form IS the card, opened: while one is up, the
    // tooltip stands down.
    if (state.open) return;
    const all = barSlots(state.answer);
    const s = [...all.fixed, ...all.tray].find((x) => x.action === slotEl.getAttribute("data-action"));
    if (!s?.card) return;
    askTerms(s.action);
    host.innerHTML = cardHtml(s.card);
    host.hidden = false;
    placeAbove(host, slotEl);
  }

  function hideCard() {
    const host = root.querySelector("#pmc-card");
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  // ── the act form ──────────────────────────────────────────────────────────
  function formHtml(action) {
    const all = barSlots(state.answer);
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    if (!slot?.card) return "";
    const c = slot.card;
    // WHAT THE ANSWER CAN FILL IN FOR YOU (2026-08-28 ruling). `prefillFor` is
    // deliberately narrow — one open slot and one named value, or nothing — and
    // the candidates it declined to choose between are offered as a datalist
    // instead, so the reader gets one keystroke rather than a guess.
    const filled = prefillFor(c, state.answer);
    const candidates = actCandidates(state.answer);
    const listId = candidates.length ? `pmc-cand-${esc(action)}` : null;
    const datalist = listId
      ? `<datalist id="${listId}">${candidates.map((k) =>
          `<option value="${esc(k.value)}">${esc(k.label)}${k.why ? " — " + esc(k.why) : ""}</option>`).join("")}</datalist>`
      : "";
    const inputs = c.fields.map((f) => {
      const id = `pmc-f-${esc(f.name)}`;
      const req = f.required ? ` <span class="req" title="required">*</span>` : "";
      const pre = filled[f.name] != null ? ` value="${esc(filled[f.name])}"` : "";
      let control;
      if (f.enum && f.enum.length) {
        control = `<select id="${id}" data-field="${esc(f.name)}">${f.enum.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select>`;
      } else if (f.type === "boolean") {
        control = `<select id="${id}" data-field="${esc(f.name)}"><option value="">—</option><option value="true">true</option><option value="false">false</option></select>`;
      } else if (f.type === "number") {
        control = `<input id="${id}" data-field="${esc(f.name)}" type="number" inputmode="decimal">`;
      } else {
        // The door states its own limits in the field's own words; the control
        // honours them rather than guessing at a shape.
        const cap = statedLimit(f.description);
        const max = cap ? ` maxlength="${cap}"` : "";
        // The candidate list rides on the free-text fields only — a field the
        // door gave an enum for already has the door's own answer, and one
        // holding prose is not a thing you aim at.
        const list = listId && !wantsTextarea(f) ? ` list="${listId}"` : "";
        control = wantsTextarea(f)
          ? `<textarea id="${id}" data-field="${esc(f.name)}"${max}></textarea>`
          : `<input id="${id}" data-field="${esc(f.name)}" type="text"${max}${list}${pre}>`;
      }
      // The door's own description under the field, whole. It is where the door
      // tells a caller what the act will do with the value, and shortening it
      // here would be the site editing law to fit a box.
      const desc = f.description ? `<p class="pmc-desc">${esc(f.description)}</p>` : "";
      const more = f.enumCount && !f.enum ? `<p class="pmc-desc">${f.enumCount} values — read the card at the door</p>` : "";
      return `<label for="${id}">${esc(f.name)}${req}${control}</label>${desc}${more}`;
    }).join("");

    const said = state.said
      ? `<p class="pmc-said${state.said.ok ? "" : " bad"}">${esc(state.said.text)}${state.said.hint ? `<span class="hint">${esc(state.said.hint)}</span>` : ""}</p>`
      : "";
    // The terms the door has stated for this act — from the shadow read if the
    // card already asked for them, and replaced by whatever the door hands back
    // at the act itself, which is the authoritative delivery.
    const shown = state.said?.terms ?? termsCache.get(action) ?? null;
    const terms = shown
      ? `<div class="pmc-terms"><b>terms</b> — delivered before the act binds, because you cannot be bound by law you were not shown at the door${termsHtml(shown)}</div>`
      : "";
    const actorWords = state.acting === HUMAN_ACTOR ? "as yourself" : `as ${esc(state.acting ?? "—")}`;
    // NOTHING LEFT TO TYPE is a state worth saying out loud. Where the door made
    // every field optional and found its own target — which is most of the
    // fight's acts — the form opens with nothing to fill and ENTER sends it, and
    // a reader looking at an empty panel deserves to be told that is the whole
    // of it rather than left hunting for the field they missed.
    const nothingToType = c.fields.every((f) => !f.required && filled[f.name] == null);
    const ready = c.fields.length && nothingToType
      ? `<p class="pmc-desc">Every field here is the door's to fill — press ENTER to send it as it stands.</p>`
      : "";
    return `<form class="pmc-plate pmc-form" data-form="${esc(action)}">
      <h3>${esc(action.toUpperCase())} <span style="color:var(--pmc-dim);letter-spacing:0">${actorWords}</span></h3>
      ${c.blurb ? `<p class="pmc-blurb">“${esc(c.blurb)}”</p>` : ""}
      ${inputs || `<p class="pmc-desc">This act takes no arguments.</p>`}
      ${ready}${datalist}
      ${terms}${said}
      <div class="pmc-actions">
        <button type="submit" class="pmc-btn go">do it</button>
        <button type="button" class="pmc-btn" data-close>close</button>
      </div>
    </form>`;
  }

  // ── the chat line ─────────────────────────────────────────────────────────
  /**
   * A chat-shaped act, as a chat line rather than a form.
   *
   * RULED 2026-08-28: "everything I can do via the ui buttons, I have to type in
   * like filling an mcp form" — the speaking act should feel like speaking.
   *
   * NO NEW VERB AND NO NEW WIRE. Which act gets this chrome is decided by the
   * SHAPE of the card the door sent (chatShaped: one prose field, nothing else
   * required), the field it writes into is that card's own prose field by the
   * door's own name for it, and what leaves goes out through the same
   * dispatchEnvelope as the form's. A door that renames the field, or grows a
   * second required one, gets the ordinary form back with no edit here.
   */
  function chatHtml(action) {
    const all = barSlots(state.answer);
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    const f = chatField(slot?.card);
    if (!f) return "";
    const cap = statedLimit(f.description);
    const who = state.acting === HUMAN_ACTOR ? "yourself" : (state.acting ?? "—");
    const said = state.said
      ? `<p class="pmc-said${state.said.ok ? "" : " bad"}">${esc(state.said.text)}</p>`
      : "";
    return `<form class="pmc-plate pmc-chat" data-form="${esc(action)}" data-chat="${esc(f.name)}">
      <span class="who">${esc(action.toUpperCase())} · ${esc(who)}</span>
      <input type="text" data-field="${esc(f.name)}" autocomplete="off"
        ${cap ? `maxlength="${cap}"` : ""}
        aria-label="${esc(f.name)}" placeholder="${esc(f.description ?? f.name)}">
      <span class="keys">↵ send · esc close</span>
      ${said}
    </form>`;
  }

  /** Which chrome this act opens in. The card decides; nothing here is a name. */
  function opensAsChat(action) {
    const all = barSlots(state.answer);
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    return chatShaped(slot?.card);
  }

  // ── the initiative wheel ──────────────────────────────────────────────────
  function drawWheel() {
    const enc = encounterOf(state.answer);
    if (!enc) return "";
    const faces = actorsFor(state.answer, o.me, { acting: state.acting });
    const pictureFor = (a) => {
      if (a.kind === "creature") return null;
      const human = a.kind === "human" ? faces.find((f) => f.kind === "human") : null;
      return human ? tokenFor(human) : null;
    };
    const seat = (a) => {
      const token = pictureFor(a);
      const inner = token?.src
        ? `<img src="${esc(token.src)}" alt="">`
        : esc((a.label || "?").slice(0, 1).toUpperCase());
      const hp = a.hp
        // A bar that reads 0% is indistinguishable from a bar that failed to
        // render, so a downed actor's rail is shown empty by an explicit width.
        ? `<span class="hp"><i style="width:${Math.max(0, Math.min(100, Math.round((a.hp.now / a.hp.max) * 100)))}%"></i></span>`
        : "";
      const cls = ["pmc-turn",
        a.current ? "is-current" : "",
        a.down ? "is-down" : "",
        a.you ? "is-you" : "",
        a.kind === "creature" ? "is-creature" : ""].filter(Boolean).join(" ");
      const label = `${a.label}${a.down ? " — down" : ""}${a.current ? " — acting now" : ""}${a.joinedRound ? `, joined at round ${a.joinedRound}` : ""}`;
      return `<li class="${cls}" aria-label="${esc(label)}"${a.current ? ' aria-current="true"' : ""}>
        ${a.joinedRound ? `<span class="late" title="joined at round ${a.joinedRound}">+${a.joinedRound}</span>` : ""}
        <span class="pip">${inner}</span>
        <span class="nm">${esc(a.label)}</span>
        <span class="init">${a.initiative == null ? "" : esc(String(a.initiative))}</span>
        ${hp}
      </li>`;
    };
    const whose = enc.order.find((a) => a.current);
    return `<div class="pmc-plate pmc-wheel">
      <div class="pmc-wheel-cap">
        <b>INITIATIVE</b>
        <span>${enc.round == null ? "" : `round ${esc(String(enc.round))} · `}${whose ? esc(whose.label) + " is acting" : "waiting"}</span>
      </div>
      <ol class="pmc-wheel-row">${enc.order.map(seat).join("")}</ol>
    </div>`;
  }

  // ── the throw ─────────────────────────────────────────────────────────────
  /**
   * Show a roll the door sent back. Nothing here decides what a throw MEANS —
   * `crit` is read, never computed, because a crit is a rule of the encounter and
   * a client comparing value to faces would be inventing law.
   */
  function showThrow(rolls) {
    if (!rolls.length) return;
    const host = doc.createElement("div");
    host.className = "pmc-throw";
    host.setAttribute("role", "status");
    host.innerHTML = rolls.slice(0, 4).map((r, i) => {
      const cls = ["pmc-die", r.crit ? "is-crit" : "", !r.crit && r.atMax ? "at-max" : ""].filter(Boolean).join(" ");
      const sum = r.modifier
        ? `${r.value} ${r.modifier > 0 ? "+" : "−"} ${Math.abs(r.modifier)} = ${r.total}`
        : String(r.total);
      const said = r.crit ? "CRIT" : r.for ? r.for.toUpperCase() : "";
      return `<div class="${cls}" style="animation-delay:${i * 90}ms">
        <div class="face">${esc(String(r.value))}</div>
        ${said ? `<span class="whose">${esc(said)}</span>` : ""}
        <span class="sum">${esc(r.die ? r.die + " · " : "")}${esc(sum)}${r.against ? " → " + esc(r.against) : ""}</span>
      </div>`;
    }).join("");
    throwLayer.appendChild(host);
    // It leaves on its own. A result the reader has already watched land should
    // not wait to be dismissed, and a crit is given longer because it is the
    // thing people will look up for.
    const stay = rolls.some((r) => r.crit) ? 4200 : 2600;
    doc.defaultView?.setTimeout(() => host.remove(), stay);
  }

  // ── the standpoint plate ──────────────────────────────────────────────────
  /** Drawn INTO the dock (see drawRoster) and revealed on its hover. It keeps its
   *  own plate chrome, because it is still a card — only its anchor moved. */
  function drawHere() {
    const p = portalOf(state.answer);
    const spine = (state.answer.within ?? []).map((w) => w?.id).filter(Boolean).reverse();
    return `<div class="pmc-plate pmc-here" role="tooltip">
      <div class="who">${esc(state.acting === HUMAN_ACTOR ? "yourself" : state.acting ?? "a spectator")} <span style="color:var(--pmc-dim)">· inside</span> ${esc(p?.id ?? "")}</div>
      <div class="spine">the read roots at <b>${esc(p?.value ?? "—")}</b>${spine.length ? `<br>within: ${esc(spine.join(" ‹ "))}` : ""}</div>
    </div>`;
  }

  // ── the token on the map ──────────────────────────────────────────────────
  /** Map units per CSS pixel, right now. The viewBox IS the camera on this map
   *  (the viewer's own words), so its width against the element's width is the
   *  whole of the zoom — no viewer internal is reached for. */
  function unitsPerPx() {
    const svg = o.svg;
    if (!svg) return 1;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    const w = svg.getBoundingClientRect?.().width || svg.clientWidth || 0;
    if (vb.length !== 4 || !isFinite(vb[2]) || vb[2] <= 0 || !w) return 1;
    return vb[2] / w;
  }

  /**
   * What is lying on the floor, drawn where it fell.
   *
   * A downed actor's weapon drops loose and becomes takeable by whoever is
   * standing there — the founder called it the dramatic moment, so it is drawn on
   * the ground rather than listed in a panel. Screen-sized like the token and the
   * walkers, for the same reason: a thing that changed size relative to the people
   * around it would be saying something about the thing.
   */
  function drawLoose() {
    if (!tokenLayer || !o.grid) return "";
    const u = unitsPerPx();
    return looseThings(state.answer).map((t) => {
      const at = worldToPx(o.grid, t.at);
      if (!at) return "";
      const r = 9 * u;
      const who = t.dropped_by ? ` — dropped by ${t.dropped_by}` : "";
      return `<g class="pmc-loose" transform="translate(${at.x} ${at.y})">
        <circle cx="0" cy="0" r="${r * 1.9}" fill="#e0894e" fill-opacity="0.12"/>
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="#e0894e" stroke-width="${r * 0.2}" stroke-dasharray="${r * 0.5} ${r * 0.34}"/>
        <path d="M ${-r * 0.62} ${r * 0.62} L ${r * 0.62} ${-r * 0.62}" stroke="#e0894e" stroke-width="${r * 0.26}" stroke-linecap="round"/>
        <title>${esc(t.label)} — on the ground${esc(who)}</title>
      </g>`;
    }).join("");
  }

  /**
   * WHAT STANDS AGAINST YOU, drawn where it stands.
   *
   * THE PROBLEM THIS SOLVES, and it is worth stating because the map looks
   * broken rather than incomplete without it: the painting is derived from the
   * settled fold, and the fold carries the dungeon's rooms but the FIGHT is not
   * a fact of the fold at all — so a reader in the candle vault sees a floor
   * with nothing on it while the bar beside them says they are three rounds into
   * a fight with something. The cake is invisible. The answer already holds
   * everything needed to draw it; it just holds it in two pieces
   * (`adversaryPlacement` joins them, and its own note says why there is no
   * fallback coordinate here).
   *
   * SIZED IN SCREEN PIXELS, like the token and the walkers and the loose things,
   * and for the same measured reason: a figure that changed size relative to the
   * people around it would be saying something about the figure. Bigger than a
   * person because it is — the ring is the room's ninth tier of candles, not a
   * head — but bigger by a constant, so the whole scene zooms together.
   *
   * The hp bar is the door's arithmetic shown, never the site's: `hp` and `of`
   * are the numbers `publicState` sent, and a bar with either missing simply is
   * not drawn rather than guessing a full one.
   */
  function drawAdversary() {
    if (!tokenLayer || !o.grid) return "";
    const placed = adversaryPlacement(state.answer, o.grid);
    if (!placed) return "";
    const { at, adversary: a } = placed;
    const u = unitsPerPx();
    const r = 20 * u;
    const hasBar = Number.isFinite(a.hp) && Number.isFinite(a.of) && a.of > 0;
    const frac = hasBar ? Math.max(0, Math.min(1, a.hp / a.of)) : 0;
    const bw = r * 2.6;
    const by = r * 1.5;
    // THE EMBER PALETTE IS THE ARENA'S OWN (--pmc-accent, #e2603f) — but this is
    // svg inside the viewer's painting, not inside the .pmc overlay, so the
    // custom property does not reach it and the value is written out. Kept the
    // same two hex values the stylesheet's arena block holds; if that block
    // moves, this is the second place to move.
    const ember = "#e2603f";
    return `<g class="pmc-adversary" transform="translate(${at.x} ${at.y})">
      <defs><radialGradient id="pmc-adv-glow">
        <stop offset="45%" stop-color="${ember}" stop-opacity="0.34"/>
        <stop offset="100%" stop-color="${ember}" stop-opacity="0"/>
      </radialGradient></defs>
      <circle cx="0" cy="0" r="${r * 2.4}" fill="url(#pmc-adv-glow)"/>
      <circle cx="0" cy="0" r="${r * 1.34}" fill="none" stroke="${ember}" stroke-width="${r * 0.06}" stroke-opacity="0.5"/>
      <circle cx="0" cy="0" r="${r}" fill="none" stroke="${ember}" stroke-width="${r * 0.16}"
        stroke-dasharray="${r * 0.9} ${r * 0.42}"/>
      <circle cx="0" cy="0" r="${r * 0.52}" fill="${ember}" fill-opacity="0.22"/>
      ${hasBar ? `<g class="pmc-adv-hp">
        <rect x="${-bw / 2}" y="${by}" width="${bw}" height="${r * 0.26}" rx="${r * 0.13}"
          fill="#0d1015" fill-opacity="0.8" stroke="${ember}" stroke-width="${r * 0.03}" stroke-opacity="0.55"/>
        <rect x="${-bw / 2}" y="${by}" width="${bw * frac}" height="${r * 0.26}" rx="${r * 0.13}" fill="${ember}"/>
      </g>` : ""}
      <title>${esc(a.label)}${hasBar ? ` — ${a.hp} of ${a.of}` : ""}${a.body ? ` — ${esc(a.body)}` : ""}</title>
    </g>`;
  }

  function drawToken() {
    if (!tokenLayer) return;
    tokenLayer.textContent = "";
    // WHAT STANDS AGAINST YOU DRAWS FIRST, under everything else on the floor.
    // It is the biggest thing in the room and the one people walk over to; a
    // ring painted last would put its glow across the faces of everyone fighting
    // it, which is the opposite of what the ring is for.
    const adversary = drawAdversary();
    if (adversary) {
      const g = doc.createElementNS(NS, "g");
      g.setAttribute("class", "pmc-adversary-layer");
      g.innerHTML = adversary;
      tokenLayer.appendChild(g);
    }
    // whatever is on the floor draws next, so a face always paints over an object
    const loose = drawLoose();
    if (loose) {
      const g = doc.createElementNS(NS, "g");
      g.setAttribute("class", "pmc-loose-layer");
      g.innerHTML = loose;
      tokenLayer.appendChild(g);
    }
    const human = faces().find((f) => f.kind === "human");
    const place = tokenPlacement(state.answer, o.grid, human);
    if (!place) return;
    const { at, token } = place;
    // THE TOKEN IS SIZED IN SCREEN PIXELS, NOT MAP UNITS — measured, after the
    // first shot drew it two hundred metres across. A fixed map size is invisible
    // at journey width and swallows the town at close zoom, and the walkers this
    // figure stands beside are already screen-constant (`r = 11 / markerScale(k)`
    // in the viewer's drawWalkers). A face that changed size relative to the
    // people around it would be saying something about the person.
    const r = 26 * unitsPerPx();
    const g = doc.createElementNS(NS, "g");
    g.setAttribute("class", "pmc-token");
    g.setAttribute("transform", `translate(${at.x} ${at.y})`);
    const clipId = "pmc-token-clip";
    // A steady gold ring and one soft radiance. Distinct from a resident's dot
    // without shouting: the map's motion language (green still / pink moving) is
    // the walkers', and borrowing it would say something untrue about this figure.
    g.innerHTML =
      `<defs><clipPath id="${clipId}"><circle cx="0" cy="0" r="${r}"/></clipPath>` +
      `<radialGradient id="pmc-token-glow"><stop offset="55%" stop-color="#d9a860" stop-opacity="0.34"/><stop offset="100%" stop-color="#d9a860" stop-opacity="0"/></radialGradient></defs>` +
      `<circle cx="0" cy="0" r="${r * 2.1}" fill="url(#pmc-token-glow)"/>` +
      (token.src
        ? `<image href="${esc(token.src)}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="0" cy="0" r="${r}" fill="#1b2230"/><text x="0" y="${r * 0.34}" text-anchor="middle" font-size="${r}" fill="#d9a860" font-family="ui-monospace,Consolas,monospace">${esc(token.monogram ?? "")}</text>`) +
      `<circle cx="0" cy="0" r="${r}" fill="none" stroke="#d9a860" stroke-width="${r * 0.11}"/>` +
      `<circle cx="0" cy="0" r="${r * 1.22}" fill="none" stroke="#d9a860" stroke-width="${r * 0.045}" stroke-opacity="0.55"/>` +
      // the star off his own cap, set above the ring — a mark of whose figure this
      // is, drawn small enough that the face stays the thing you read
      `<path transform="translate(0 ${-r * 1.62}) scale(${r * 0.030})" fill="#d9a860"
         d="M0,-10 L2.2,-2.6 L10,0 L2.2,2.6 L0,10 L-2.2,2.6 L-10,0 L-2.2,-2.6 Z"/>` +
      `<title>${esc(token.label)} — standing here</title>`;
    tokenLayer.appendChild(g);
  }

  // ── painting ──────────────────────────────────────────────────────────────
  function paint() {
    resolveActing();
    const active = doc.activeElement;
    const keepAction = active?.closest?.("[data-form]") ? active.getAttribute?.("data-field") : null;
    const values = readForm();
    root.setAttribute("data-space", spaceOf(state.answer));
    // the roster rides inside drawBar's row, and the standpoint plate inside the
    // roster — one row owns the bottom edge and everything hangs off it
    root.innerHTML = drawWheel() + drawBar();
    // THE BAR MOVES FIRST. Everything below is positioned against the bar's real
    // box, and the bar's own placement lifts it clear of the viewer's bottom-edge
    // furniture — so measuring before that lift put the gate pill straight across
    // the middle of the slots it was explaining. Seen in the combat QA shot.
    placeBar();
    const form = root.querySelector("[data-form]");
    if (form) placeAbove(form, root.querySelector(".pmc-bar"));
    // The gate rides above whichever panel is actually the top of the stack. A
    // form cannot normally be open while gated — a gated slot is disabled, so it
    // cannot be clicked — but a turn can pass while one is already open, and then
    // both are on screen.
    const gate = root.querySelector(".pmc-gate");
    if (gate) placeAbove(gate, form ?? root.querySelector(".pmc-bar"));
    root.querySelector(".pmc-bar")?.addEventListener("scroll", markOverflow, { passive: true });
    markOverflow();
    if (state.open && values) writeForm(values);
    if (keepAction) root.querySelector(`[data-field="${CSS.escape ? CSS.escape(keepAction) : keepAction}"]`)?.focus();
    drawToken();
  }

  let formValues = null;
  function readForm() {
    const form = root.querySelector("[data-form]");
    if (!form) return formValues;
    const v = {};
    form.querySelectorAll("[data-field]").forEach((el) => { v[el.getAttribute("data-field")] = el.value; });
    formValues = v;
    return v;
  }
  function writeForm(v) {
    const form = root.querySelector("[data-form]");
    if (!form) return;
    form.querySelectorAll("[data-field]").forEach((el) => {
      const name = el.getAttribute("data-field");
      if (v[name] != null) el.value = v[name];
    });
  }

  // ── the wiring ────────────────────────────────────────────────────────────
  function onClick(ev) {
    const faceBtn = ev.target.closest?.(".pmc-face");
    if (faceBtn && root.contains(faceBtn)) {
      state.acting = faceBtn.getAttribute("data-actor");
      state.said = null;
      paint();
      // ONE SELECTION, TWO SURFACES (2026-08-28): the viewer's walk desk and
      // enter buttons act as ITS actAs, which used to be a second control the
      // founder had to keep agreeing with this one. The dock speaks; the viewer
      // listens (pm:act-as, resident handles only — the human hand is this
      // cockpit's own grammar and the viewer keeps its last resident for walks).
      speakActAs();
      return;
    }
    const closeBtn = ev.target.closest?.("[data-close]");
    if (closeBtn && root.contains(closeBtn)) { state.open = null; state.said = null; formValues = null; paint(); return; }
    const slot = ev.target.closest?.(".pmc-slot");
    // A gated seat is aria-disabled so it can still be hovered for its card, so
    // the CLICK is what has to refuse — the browser will not refuse it for us.
    if (slot && root.contains(slot) && !slot.disabled && slot.getAttribute("aria-disabled") !== "true") {
      const action = slot.getAttribute("data-action");
      state.open = state.open === action ? null : action;
      state.said = null;
      formValues = null;
      paint();
      root.querySelector(".pmc-slot.open")?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
      markOverflow();
      focusFirstOpen();
    }
  }

  /**
   * WHERE THE CURSOR LANDS in a form that may already be filled in.
   *
   * The first EMPTY field, not the first field — because a prefilled one is
   * already answered, and dropping the cursor into it means the reader's first
   * keystroke either lands inside a value they wanted or has to be preceded by
   * clearing it. With nothing left to fill, the cursor goes to the send button,
   * so ENTER is the very next thing a hand can do: that is the whole of "plain
   * ENTER submits" for the acts whose fields the door fills itself.
   */
  function focusFirstOpen() {
    const form = root.querySelector("[data-form]");
    if (!form) return;
    const fields = [...form.querySelectorAll("[data-field]")];
    const empty = fields.find((el) => !el.value);
    (empty ?? form.querySelector(".pmc-btn.go") ?? fields[0])?.focus();
  }

  async function onSubmit(ev) {
    const form = ev.target.closest?.("[data-form]");
    if (!form || !root.contains(form)) return;
    ev.preventDefault();
    const action = form.getAttribute("data-form");
    const args = {};
    form.querySelectorAll("[data-field]").forEach((el) => {
      const name = el.getAttribute("data-field");
      const raw = el.value;
      if (raw === "" || raw == null) return;
      if (el.type === "number") { const n = Number(raw); if (isFinite(n)) args[name] = n; return; }
      if (raw === "true" || raw === "false") { args[name] = raw === "true"; return; }
      args[name] = raw;
    });
    const go = form.querySelector(".pmc-btn.go");
    if (go) { go.disabled = true; go.textContent = "…"; }
    try {
      // The resident the door was READ as travels with every act, the human's
      // included: `as` says who acts, `handle` says whose standing the key is
      // oriented from, and on a multi-resident key an act naming neither is
      // refused at orient before the human seam is reached.
      const res = await o.dispatch(dispatchEnvelope({ action, args, acting: state.acting, handle: orientingHandle(o.me) }));
      // THE THROW IS SHOWN WHETHER THE ACT LANDED OR NOT. A blow that misses still
      // threw the die, and a bounce can carry the roll that caused it — hiding the
      // number on a refusal would make the one moment a player most wants to see
      // the one moment they cannot.
      const rolls = rollsFrom(res.body);
      if (rolls.length) showThrow(rolls);
      if (res.ok) {
        state.said = { ok: true, text: form.hasAttribute("data-chat") ? "sent." : "done — the door took it." };
        formValues = null;
        // A CHAT LINE EMPTIES ITSELF AND STAYS OPEN. Cleared in the live DOM
        // rather than by trusting formValues, because paint() re-reads the form
        // before it repaints — so a line nulled only in that variable comes
        // straight back out of the element it was just sent from, and the reader
        // sends the same sentence twice.
        if (form.hasAttribute("data-chat")) {
          form.querySelectorAll("[data-field]").forEach((el) => { el.value = ""; });
        }
        if (o.refresh) { const fresh = await o.refresh().catch(() => null); if (fresh) state.answer = fresh; }
      } else {
        const b = readBounce(res.body, res.status);
        state.said = { ok: false, text: b.defect, hint: b.hint, terms: b.terms };
      }
    } catch (err) {
      state.said = { ok: false, text: "the door could not be reached", hint: String(err?.message ?? err).slice(0, 200) };
    }
    paint();
  }

  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const t = ev.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
      if (ev.key === "Escape" && state.open) { state.open = null; state.said = null; formValues = null; paint(); }
      return;
    }
    if (ev.key === "Escape" && state.open) { state.open = null; state.said = null; formValues = null; paint(); return; }
    if (!/^[1-9]$/.test(ev.key)) return;
    const n = Number(ev.key);
    const { fixed, tray } = barSlots(state.answer);
    const slot = [...fixed, ...tray].find((s) => s.key === n);
    if (!slot || !slot.enabled) return;
    ev.preventDefault();
    state.open = state.open === slot.action ? null : slot.action;
    state.said = null;
    formValues = null;
    paint();
    // DELIBERATELY NO FOCUS INTO THE FORM on the keyboard path. Focus belongs in
    // the field only when the reader has committed to filling it, and a digit
    // typed into a focused text box must type a digit — so auto-focusing here
    // killed the numbered bar the moment it was used: measured, pressing 1 then
    // 2 then 9 left slot 1 open the whole time and put "29" in its first field.
    // Clicking a seat is the committing gesture and still dives in; the numbers
    // stay the bar's own navigation, which is what makes them worth having.
    // Bring the SEAT into view, not the form. On a narrow screen the row scrolls,
    // so a seat opened by key 9 can be off the right edge while its form fills the
    // screen — the bar then shows a different seat lit and says nothing about
    // where the form came from. Seen at 390.
    root.querySelector(".pmc-slot.open")?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    markOverflow();
  }

  // The card follows the pointer AND the keyboard, because a bar with numbered
  // slots is a keyboard surface first: tabbing to a seat must show the same card
  // hovering it does, or the law is readable only with a mouse.
  const onOver = (ev) => {
    const slot = ev.target.closest?.(".pmc-slot");
    if (slot && root.contains(slot) && !slot.disabled) showCard(slot); else hideCard();
  };
  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerleave", hideCard);
  root.addEventListener("focusin", onOver);
  root.addEventListener("focusout", hideCard);

  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  doc.addEventListener("keydown", onKey);

  // ENTER SENDS THE CHAT LINE, said explicitly rather than left to the browser.
  // A single-input form with no submit button does implicitly submit on ENTER in
  // every engine that matters — but "in every engine that matters" is the kind of
  // sentence this file has been wrong about before, and the send is the whole
  // gesture of a chat line. requestSubmit fires the submit event the ordinary way,
  // so onSubmit above is still the one path out.
  root.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.shiftKey) return;
    const chat = ev.target?.closest?.("[data-chat]");
    if (!chat || !root.contains(chat)) return;
    ev.preventDefault();
    (chat.requestSubmit ? chat.requestSubmit() : chat.dispatchEvent(new doc.defaultView.Event("submit", { bubbles: true, cancelable: true })));
  });
  // The receipt clears when the reader types the next thing. Removed from the
  // DOM directly, never by repainting: a repaint here would rebuild the input
  // the reader is mid-sentence in.
  root.addEventListener("input", (ev) => {
    if (!ev.target?.closest?.("[data-chat]")) return;
    if (state.said) { state.said = null; root.querySelector(".pmc-chat .pmc-said")?.remove(); }
  });

  // The camera moves without anything of ours firing — the viewer pans and zooms
  // by writing the viewBox, and a screen-sized token has to be re-drawn when it
  // does. Watching the attribute is the seam that needs no viewer internal.
  let camera = null;
  if (o.svg && typeof MutationObserver === "function") {
    camera = new MutationObserver(() => drawToken());
    camera.observe(o.svg, { attributes: true, attributeFilter: ["viewBox"] });
  }
  const onResize = () => { drawToken(); placeBar(); markOverflow(); };
  (doc.defaultView ?? globalThis).addEventListener?.("resize", onResize);

  // ── the dock's handshake with the viewer ──────────────────────────────────
  // Two signals, belt and suspenders for boot order: the attribute is readable
  // by a viewer that booted after us; the event reaches one that booted before.
  // The viewer's renderIdentity checks the attribute and stands its own Act As
  // row down while this dock holds the question.
  const speakActAs = () => {
    const w = doc.defaultView ?? globalThis;
    const actor = state.acting;
    if (!actor || actor === HUMAN_ACTOR || typeof w.CustomEvent !== "function") return;
    try { w.dispatchEvent(new w.CustomEvent("pm:act-as", { detail: { actor } })); } catch {}
  };
  const dockSignal = (present) => {
    const w = doc.defaultView ?? globalThis;
    try {
      if (present) doc.documentElement.setAttribute("data-pmc-dock", "1");
      else doc.documentElement.removeAttribute("data-pmc-dock");
      if (typeof w.CustomEvent === "function")
        w.dispatchEvent(new w.CustomEvent("pm:cockpit-dock", { detail: { present } }));
    } catch {}
  };
  dockSignal(true);

  paint();
  speakActAs();

  return {
    update(answer) {
      state.answer = answer;
      if (!cockpitShows(answer)) { this.destroy(); return; }
      paint();
    },
    destroy() {
      doc.removeEventListener("keydown", onKey);
      (doc.defaultView ?? globalThis).removeEventListener?.("resize", onResize);
      camera?.disconnect();
      dockSignal(false); // hand the Act As question back to the viewer's own row
      root.remove();
      throwLayer.remove();
      tokenLayer?.remove();
    },
  };
}

export { worldToPx };
