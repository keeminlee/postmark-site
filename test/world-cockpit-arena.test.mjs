// world-cockpit-arena.test.mjs — the falsifiers for the 2026-08-29 interaction
// rulings, made after a night of the founder actually playing the dungeon.
//
// FIVE RULINGS, IN HIS OWN WORDS WHERE THEY ARE SHORT ENOUGH TO QUOTE:
//
//   (1) targeting  — press the act, then the thing it can be aimed at lights up
//       and is clickable. The order it replaces — click the thing, get a menu of
//       every act — he called nonsensical.
//   (2) trims      — the claiming and note-taking seats are hidden in the
//       dungeon; the seat whose whole precondition is a phase appears only in
//       that phase.
//   (3) the fold   — "too many buttons".
//   (4) game-speak — "the 'terms' in the hover and click for the actions is NOT
//       helpful to a human … bare fields … re-write to be concise, and just give
//       info like it would in a game, not a debug panel."
//   (5) the sheet  — the crossing sheet dumps every field, vague and verbose.
//
// Plus (6), the walk grid, which is lane bday-law's dial read from this side.
//
// THE FIXTURES ARE THE LIVE DOOR'S SHAPES, not invented ones, and that is what
// makes these evidence. Every field name below was read off the office on
// 2026-08-29: the dial names out of `encounter.mjs` FLOOR (to_hit_die,
// damage_die, beats_ac, restores_to, halves_next_hit), the phases out of its
// PHASES (afoot, spent, wiped), `channel: "ground"` out of the ground builder in
// `world-apex.mjs`, and the arena field's own description verbatim out of the
// cards the apex answers.
//
// ⚠ THE ACT NAMES LIVE HERE, NOT IN THE MODULE UNDER TEST. world-cockpit.mjs is
// held to naming none of them (world-cockpit.test.mjs greps its source), and
// these tests are the other side of that: they hand the names IN, the way the
// mount does, and check the arithmetic did the right thing without knowing them.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  aimField, aimTargets, aimable, barFold, barSlots, cardOf, consentSplit,
  dialSpeak, snapPoint, walkStep, DEFAULT_STEP_M,
} from "../src/lib/world-cockpit.mjs";

const MOUNT = readFileSync(fileURLToPath(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url)), "utf8");

// ── the door's own shapes ───────────────────────────────────────────────────

/** The arena's shared field, verbatim from the apex's cards. Both halves of the
 *  sentence matter: it says the value is what the act is AIMED AT, which is what
 *  tells an aim field from a place field. */
const AIMED = {
  type: "string",
  description: "who or what this act is aimed at — a handle for one, a mark id for another. Some of these acts find the adversary standing on this ground themselves.",
};
/** The attaching acts' field, verbatim. */
const THING = { type: "string", description: "the thing's mark id, <by>/<slug>", required: true };
/** A place field — the sentence GROUND_SHAPED reads. */
const OUT_OF = { type: "string", description: "which mark to step out of — omit for the innermost one you are within" };
/** A minted name, not a pointer at something that exists. */
const SLUG = { type: "string", description: "the mark's leaf name — kebab-case, unique among your own marks", required: true };

const entry = (action, o = {}) => ({
  action, blurb: o.blurb ?? null, blurb_from: `the-town/${action}`,
  from: o.from ?? "the-town/resident", class: o.class ?? "resident",
  fields: o.fields ?? {}, via: o.via ?? "ambient", channel: o.channel ?? "ambient",
  grant: o.grant ?? "yours", ...(o.dials ? { dials: o.dials } : {}),
});

/** A ground act — the channel the office opens the room's own verbs on. */
const ground = (action, o = {}) => entry(action, { ...o, channel: "ground", via: "within", grant: "here", from: "the-town/portal-ground" });

const VAULT = {
  standpoint: { x: 1083, y: -792, stance: "embodied-human", portal: { id: "the-town/the-candle-vault", value: "the-town/the-candle-vault", space: "arena" } },
  within: [{ id: "the-town/the-candle-vault", by: "the-town" }],
  nearby: [
    { id: "the-town/the-unlit-cake", at: { x: 1097, y: -783.5 }, kind: "sited" },
    { id: "vermillion/the-long-knife", at: { x: 1092, y: -786 }, kind: "sited", loose: true, dropped_by: "vermillion" },
  ],
  actions: [
    entry("say", { fields: { text: { type: "string", description: "what you say, at most 500 characters" } } }),
    entry("walk", { fields: { mark_id: { type: "string", description: "walk to this mark's ground" } } }),
    entry("exit", { fields: { mark: OUT_OF } }),
    entry("take", { fields: { thing: THING } }),
    entry("leave-mark", { fields: { slug: SLUG, body: { type: "string", description: "one present-tense observation; maximum 150 characters" } } }),
    entry("note-to-self", { fields: { body: { type: "string", description: "the complete replacement note, maximum 2000 characters", required: true } } }),
    ground("swing", { fields: { object: AIMED }, dials: { to_hit_die: 20, damage_die: 8, beats_ac: 12 } }),
    ground("brace", { fields: { object: AIMED }, dials: { halves_next_hit: true } }),
    ground("raise", { fields: { object: AIMED }, dials: { restores_to: 8 } }),
    ground("gather", { fields: { object: AIMED } }),
  ],
  encounter: {
    id: "the-town/the-candle-vault", round: 3, turn: "keeminlee",
    order: [
      { id: "the-town/the-unlit-cake", kind: "creature", label: "the unlit cake", initiative: 19 },
      { id: "keeminlee", kind: "human", label: "DARKO", initiative: 12, hp: { now: 16, max: 20 }, you: true },
      { id: "vermillion", kind: "resident", label: "vermillion", initiative: 11, down: true, hp: { now: 0, max: 20 } },
    ],
  },
  encounter_detail: {
    phase: "afoot", live: true, space: "arena",
    adversary: { id: "the-town/the-unlit-cake", hp: 41, of: 60, body: "Nine tiers, four hundred candles, not one ever lit." },
  },
};

const slotFor = (answer, action) => {
  const bar = barSlots(answer, { acting: "keeminlee" });
  return [...bar.fixed, ...bar.tray].find((s) => s.action === action);
};
const cardFor = (answer, action) => slotFor(answer, action)?.card ?? null;

// ══ (1) VERB-FIRST TARGETING ════════════════════════════════════════════════

test("an act is aimable because of the sentence the door wrote under its field", () => {
  // THE LAW, quoted: the arena's field says the value is "who or what this act
  // is aimed at". That sentence — and not the act's name — is what arms.
  const aimed = aimField(cardFor(VAULT, "swing"));
  assert.equal(aimed?.name, "object", "an act aimed at something has an aim field");
  assert.equal(aimField(cardFor(VAULT, "take"))?.name, "thing",
    "and so does one that names a thing's mark id — that is how a floor item is picked up");

  // A PLACE IS NOT A TARGET, which is the distinction prefillFor already draws
  // and this one inherits. Stepping out of somewhere aims at nothing.
  assert.equal(aimField(cardFor(VAULT, "exit")), null, "a place field arms nothing");
  assert.equal(aimField(cardFor(VAULT, "walk")), null, "and neither does walking to somewhere");
  // A NAME BEING MINTED IS NOT A POINTER AT SOMETHING THAT EXISTS.
  assert.equal(aimField(cardFor(VAULT, "leave-mark")), null, "a slug is a name you are inventing, not a thing you are aiming at");
  // and an act whose only field is prose is a sentence, not a shot
  assert.equal(aimField(cardFor(VAULT, "say")), null, "speech aims at nothing");
});

test("the targets are the answer's own, and an unplaced one is still a target", () => {
  const targets = aimTargets(VAULT);
  assert.deepEqual(targets.map((t) => t.value),
    ["the-town/the-unlit-cake", "vermillion", "vermillion/the-long-knife"],
    "what stands against you, who is down beside you, what is on the floor — the door's three lists, in reading order");

  // the adversary and the loose thing are placed off `nearby`
  assert.deepEqual(targets[0].at, { x: 1097, y: -783.5 }, "the adversary is placed where nearby put it");
  assert.deepEqual(targets[2].at, { x: 1092, y: -786 }, "and so is the thing on the floor");

  // ⚑ THE DOWNED ALLY IS THE CASE THAT MATTERS. `nearby` is a budgeted field of
  // view, so someone genuinely down can carry no coordinate on a given read —
  // and dropping them would make the act that lifts them unreachable at exactly
  // the moment it is needed. They keep their row with a null position, and the
  // strip offers them by name.
  assert.equal(targets[1].at, null, "a target the answer cannot place is kept, unplaced");
  assert.match(targets[1].why, /down/, "and says why it is a target at all");
});

test("nothing arms where the answer names nothing to aim at", () => {
  // The flip: same card, no encounter, no loose thing. The seat goes back to
  // being a panel with no edit anywhere — which is the whole point of deciding
  // this off the answer rather than off a list of fight verbs.
  const quiet = { ...VAULT, nearby: [], encounter: undefined, encounter_detail: undefined };
  assert.equal(aimTargets(quiet).length, 0, "no candidates");
  assert.equal(aimable(slotFor(quiet, "swing"), quiet), false, "so an aimable-shaped act does not arm");
  assert.equal(aimable(slotFor(VAULT, "swing"), VAULT), true, "and does arm where there is something to aim at");
});

// ══ (2) THE TRIMS ═══════════════════════════════════════════════════════════

test("the claiming and note seats are hidden in the dungeon, and nothing else is", () => {
  // UI HIDING ONLY — the acts are untouched and the door still affords them.
  const bare = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep: ["walk", "say", "exit"] });
  assert.ok([...bare.shown, ...bare.folded].some((s) => s.action === "leave-mark"),
    "with no hide list the seat is there");

  const trimmed = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "exit"], hide: ["leave-mark", "note-to-self"],
  });
  const names = [...trimmed.shown, ...trimmed.folded].map((s) => s.action);
  assert.ok(!names.includes("leave-mark"), "hidden where the ruling hides it");
  assert.ok(!names.includes("note-to-self"), "both of them");
  assert.ok(names.includes("give") && names.includes("take"),
    "and give/take are explicitly kept — the ruling names only two");
});

test("the phase-gated seat appears in its phase and not before", () => {
  // THE DOOR'S OWN WORDS for why, read off the office 2026-08-29: "Take what is
  // left when the encounter is spent. Refused while anything is still standing —
  // the … verb's own precondition is the phase."
  const gate = { gather: "spent" };
  const keep = ["walk", "say", "exit"];

  const afoot = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep, gate, phase: "afoot" });
  assert.ok(![...afoot.shown, ...afoot.folded].some((s) => s.action === "gather"),
    "while anything is still standing the seat is not rendered");

  const spent = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep, gate, phase: "spent" });
  assert.ok(spent.shown.some((s) => s.action === "gather"),
    "and it arrives with the phase that is its whole precondition");

  // the flip that proves the gate is about THIS act and not about phases in
  // general: an ungated ground act is present in both phases
  for (const p of ["afoot", "spent", "wiped", null]) {
    const b = barFold(barSlots(VAULT, { acting: "keeminlee" }), { keep, gate, phase: p });
    assert.ok(b.shown.some((s) => s.action === "swing"), `an ungated act is unaffected at phase ${p}`);
  }
});

// ══ (3) THE FOLD ════════════════════════════════════════════════════════════

test("the room's acts hold the row and what you carry everywhere folds", () => {
  const fold = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "exit"], hide: ["leave-mark", "note-to-self"],
    gate: { gather: "spent" }, phase: "afoot",
  });
  assert.deepEqual(fold.shown.map((s) => s.action),
    ["walk", "say", "exit", "swing", "brace", "raise"],
    "the ambient three the ruling names, then everything the ground itself granted");
  assert.deepEqual(fold.folded.map((s) => s.action), ["give", "take"],
    "and what travels with you is one press away");

  // WHAT DECIDES IT IS THE DOOR'S CHANNEL, not a list of fight verbs. The flip:
  // move an act onto the ground's channel and it moves onto the row, with no
  // edit to any list anywhere.
  const promoted = {
    ...VAULT,
    actions: VAULT.actions.map((e) => (e.action === "take" ? { ...e, channel: "ground" } : e)),
  };
  const after = barFold(barSlots(promoted, { acting: "keeminlee" }), { keep: ["walk", "say", "exit"] });
  assert.ok(after.shown.some((s) => s.action === "take"),
    "an act the ground grants holds a seat, whatever it is called");
  assert.ok(fold.folded.some((s) => s.action === "take"),
    "and the same act folds on the read where the door did not open it on that channel");
});

test("a bar with no ground acts and no keep list folds everything, which is the honest default", () => {
  const town = { standpoint: { x: 0, y: 0 }, actions: [entry("say", {}), entry("walk", {})], actors: [{ kind: "resident", handle: "wright", allowed: true }] };
  const fold = barFold(barSlots(town), {});
  assert.equal(fold.shown.length, 0, "nothing is on the row when nothing is the ground's and nothing was kept");
  assert.equal(fold.folded.length, barSlots(town).fixed.length + barSlots(town).tray.length,
    "and every seat is accounted for — the fold drops nothing it was not told to hide");
});

// ══ (4) GAME-SPEAK ══════════════════════════════════════════════════════════

test("the dials read as a game says them, out of the door's own dial names", () => {
  // THE RULING, quoted: "just give info like it would in a game, not a debug
  // panel." What he was reading was the raw struct: `to_hit_die 20 ·
  // damage_die 8 · beats_ac 12`.
  assert.equal(dialSpeak(cardFor(VAULT, "swing")), "d20 vs 12 to hit · d8 damage",
    "the throw and the number it must beat are one sentence, not two facts to join");
  assert.equal(dialSpeak(cardFor(VAULT, "brace")), "halves the next hit");
  assert.equal(dialSpeak(cardFor(VAULT, "raise")), "lifts to 8");
});

test("a dial that is not there is not mentioned", () => {
  // THE OTHER HALF, quoted: "if a dial is missing, say nothing rather than
  // showing a bare field name."
  assert.equal(dialSpeak(cardFor(VAULT, "gather")), "", "an act whose class states no dials says nothing");
  assert.equal(dialSpeak(cardFor(VAULT, "say")), "", "and so does an ordinary one");
  assert.equal(dialSpeak(null), "", "and a missing card is not an error");
  // a dial the record turned OFF is not a fact worth a word either
  assert.equal(dialSpeak(cardOf(entry("x", { dials: { halves_next_hit: false } }))), "");
});

test("a dial this phrasebook has never heard of still appears", () => {
  // THE DEFAULT IS WHAT KEEPS IT FROM BEING A SCHEMA — the same shape as the
  // bar's own default for a verb it has never seen. A door that grows a dial
  // tomorrow gets a line, not a silence.
  const odd = cardOf(entry("x", { dials: { burns_crossings: 2, reach_m: 3, ward_die: 6, turn_timeout_s: 600, quiet: true } }));
  const said = dialSpeak(odd);
  assert.match(said, /reach 3 m/, "metres read as metres");
  assert.match(said, /d6 ward/, "a die reads as a die");
  assert.match(said, /600s turn timeout/, "seconds read as seconds");
  assert.match(said, /\bquiet\b/, "a dial that is simply on says its own name");
  assert.match(said, /burns_crossings 2/, "and one with no shape at all is still shown, in the door's own words");
});

// ══ (5) THE CONSENT SHEET ═══════════════════════════════════════════════════

test("the sheet shows what fits on a line and folds the documents, dropping nothing", () => {
  const terms = {
    binds: "the-town/portal-ground",
    means: "the-town/enter — crossing a portal changes what you read, never where you stand",
    hp: "20 at the door",
    downed: "downed is not dead — an ally can lift you",
    articles: "A".repeat(400),
    quoted: "Nine tiers, four hundred candles, not one ever lit.\nAnd the ninth is the one that matters.",
  };
  const { brief, fine } = consentSplit(terms);
  assert.deepEqual(brief.map((r) => r.key), ["binds", "means", "hp", "downed"],
    "the few terms a player needs, in the door's own keys and its own order");
  assert.deepEqual(fine.map((r) => r.key), ["articles", "quoted"],
    "and the whole mark bodies — the forty lines he was reading past — fold");

  // NOTHING IS DROPPED. This is the assertion that must never be traded away:
  // "you cannot be bound by law you were not shown at the door."
  assert.equal(brief.length + fine.length, Object.keys(terms).length,
    "every key the door sent is rendered somewhere");

  // SPLIT ON LENGTH, NOT ON A LIST OF KEY NAMES — the flip: a fifth key the
  // door has never sent before lands on the right side by its own shape.
  const grown = consentSplit({ ...terms, curfew: "the vault closes at the ninth tier" });
  assert.ok(grown.brief.some((r) => r.key === "curfew"),
    "a key nobody wrote a template for still reads at the door");
});

// ══ (6) THE WALK GRID ═══════════════════════════════════════════════════════

test("a walk snaps to the ground's own stride, and to one metre where none is declared", () => {
  assert.equal(walkStep(VAULT), DEFAULT_STEP_M, "a ground that declares nothing walks in metres, as it always has");
  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.7 }, walkStep(VAULT)), { x: 1083, y: -792 });

  // the dial, wherever lane bday-law lands it
  for (const put of [
    (v) => ({ ...VAULT, standpoint: { ...VAULT.standpoint, walk: { min_step: v } } }),
    (v) => ({ ...VAULT, standpoint: { ...VAULT.standpoint, portal: { ...VAULT.standpoint.portal, walk: { min_step: v } } } }),
    (v) => ({ ...VAULT, walk: { min_step: v } }),
    (v) => ({ ...VAULT, encounter_detail: { ...VAULT.encounter_detail, walk: { min_step: v } } }),
  ]) {
    assert.equal(walkStep(put(0.5)), 0.5, "the declared stride is read");
  }

  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, 0.5), { x: 1083.5, y: -791.5 });
  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, 5), { x: 1085, y: -790 });
  // a nonsense stride is not allowed to divide by zero or reverse the world
  for (const bad of [0, -1, NaN, null, undefined, "2"]) {
    assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, bad), { x: 1083, y: -792 },
      "an unusable stride falls back to the metre rather than to a wrong answer");
  }
  assert.equal(snapPoint(null, 1), null, "and a point that is not a point is not snapped into one");
});

// ══ THE PIXELS — source pins, the repo's discipline for closure code ═════════
//
// The mount only exists inside mountCockpit, so these read the source the way
// world-cockpit-dock.test.mjs does. Each fails against the pre-ruling file.

test("the row is folded once and read from one place", () => {
  assert.match(MOUNT, /function foldedBar\(\) \{/, "one reading of the folded row");
  // ⚑ AND THE NUMBER KEYS READ IT. barSlots keys every act the answer carried,
  // folded or not — so with the fold in place the number printed on the fourth
  // seat and the act the fourth key opened were two different acts.
  assert.match(MOUNT, /const slot = foldedBar\(\)\.shown\[n - 1\];/,
    "a digit means the nth seat on the row, which is what a reader is counting");
  assert.doesNotMatch(MOUNT, /const \{ fixed, tray \} = barSlots\(state\.answer, \{ acting: state\.acting \}\);\r?\n\s*const slot = \[\.\.\.fixed, \.\.\.tray\]\.find\(\(s\) => s\.key === n\);/,
    "the pre-fold keyboard lookup is gone, not merely shadowed");
});

// ⚑ THE TWO BELOW WERE WRITTEN AFTER LOOKING AT A SHOT, not before. Both are
// defects a green suite had already passed over, and they are the reason the
// shot runner exists beside it — a partition can be provably correct and still
// render wrong.

test("the row's numbers are the row's, renumbered by the fold", () => {
  // SEEN IN THE SHOT: six seats wearing 1, 2, 7, 8, 9 — the digits those acts
  // held in the door's full list, before four of them folded away. A reader
  // counting along the row and a reader reading the corner of a seat would have
  // pressed different acts.
  const fold = barFold(barSlots(VAULT, { acting: "keeminlee" }), {
    keep: ["walk", "say", "exit"], hide: ["leave-mark", "note-to-self"],
    gate: { gather: "spent" }, phase: "afoot",
  });
  assert.deepEqual(fold.shown.map((s) => s.key), [1, 2, 3, 4, 5, 6],
    "the nth seat on the row wears n");
  assert.deepEqual(fold.folded.map((s) => s.key), [null, null],
    "and what folded wears no number — the tray is reached by name");
  // the flip: barSlots on its own still numbers the door's whole list, so the
  // renumbering is the fold's doing and not a change to the reading beneath it
  const raw = barSlots(VAULT, { acting: "keeminlee" });
  assert.notDeepEqual([...raw.fixed, ...raw.tray].filter((s) => fold.shown.some((x) => x.action === s.action)).map((s) => s.key),
    fold.shown.map((s) => s.key), "which is a different numbering from the one it starts with");
});

test("a seat gets the headline and the card gets the whole line", () => {
  // SEEN IN THE SHOT: the seat read "d20 vs 8 to hit · d…". Widening the cap
  // until the sentence fit put 93px of the row off the edge at 1280 — measured,
  // in the shot runner — which is the scroll the fold exists to remove.
  const card = cardFor(VAULT, "swing");
  assert.equal(dialSpeak(card, { brief: true }), "d20 vs 12 to hit", "the seat gets one whole short phrase");
  assert.equal(dialSpeak(card), "d20 vs 12 to hit · d8 damage", "the card gets all of it");
  assert.ok(!dialSpeak(card, { brief: true }).includes("…"), "and neither of them is cut");
  // brief on an act with one thing to say is that thing, not a fragment of it
  assert.equal(dialSpeak(cardFor(VAULT, "brace"), { brief: true }), "halves the next hit");
  assert.equal(dialSpeak(cardFor(VAULT, "gather"), { brief: true }), "", "and on one with nothing to say, nothing");
  // the seat asks for the brief one; the ellipsis it used to need is gone
  assert.match(MOUNT, /leadsTo\(s\) \?\? dialSpeak\(s\.card, \{ brief: true \}\)/, "the seat asks for the headline");
  assert.doesNotMatch(MOUNT, /\.pmc-dial \{[^}]*text-overflow: ellipsis/, "so the seat's line no longer needs clipping");
});

test("an armed act's card stands down, like an open panel's", () => {
  // SEEN IN THE SHOT: pressing a seat leaves the pointer on it, so the hover
  // card stayed up and the aim strip opened across it — two panels, one of them
  // explaining an act the reader had already chosen.
  assert.match(MOUNT, /if \(state\.open \|\| state\.aiming\) return;/,
    "showCard stands down for an armed act as well as an open one");
});

test("the three name-keyed rulings live beside the icons, not in the arithmetic", () => {
  assert.match(MOUNT, /const BAR_KEEP = \["walk", "say", "exit"\];/, "the ambient seats the ruling keeps on the row");
  assert.match(MOUNT, /const DUNGEON_HIDE = \["leave-mark", "note-to-self"\];/, "the two seats hidden in the dungeon");
  assert.match(MOUNT, /const PHASE_GATE = \{ loot: "spent" \};/, "and the one act whose precondition is a phase");
  // hidden ONLY inside portal ground — the door's own word for being in the
  // dungeon at all. Step back out and the seats come back.
  assert.match(MOUNT, /hide: portalOf\(state\.answer\) \? DUNGEON_HIDE : \[\],/,
    "the trim is scoped to the dungeon and is UI-only");
  assert.match(MOUNT, /phase: state\.answer\?\.encounter_detail\?\.phase \?\? null,/,
    "and the phase is the door's, read where the office publishes it");
});

test("the hover is a glance and the fine print is somewhere a hand can reach", () => {
  // ⚑ THE CARD TAKES NO POINTER, so a disclosure ON it would be law behind a
  // control nobody can press — worse than the dump it replaced. The split is by
  // gesture: hover gets the glance, the panel gets the detail.
  assert.match(MOUNT, /\.pmc-card \{[\s\S]{0,400}?pointer-events: none;/,
    "the card still takes no pointer");
  assert.match(MOUNT, /return `\$\{line\}\$\{blurb\}<p class="pmc-from">press for the fine print<\/p>`;/,
    "so the card is the throw, the sentence, and a pointer to the rest");
  assert.match(MOUNT, /function fineHtml\(card\) \{/, "and the rest is rendered on the panel");
  assert.match(MOUNT, /\$\{trigger && !sheet \? "" : fineHtml\(c\)\}/,
    "which is where formHtml puts it — on every panel except the tight fight plate, and on that one too once it is delivering terms");
  // the seat's own line is game-speak now too, in its headline form — see
  // "a seat gets the headline and the card gets the whole line" below
  assert.match(MOUNT, /leadsTo\(s\) \?\? dialSpeak\(s\.card, \{ brief: true \}\)/,
    "and the seat says it the same way, in the room a seat has");
});

test("a panel that delivers terms is a consent sheet, whichever act it belongs to", () => {
  // ⚑ AND WHATEVER SHAPE ITS CARD IS. This read `shown && !trigger` on the first
  // pass, which excluded the one act the ruling was actually about: the crossing
  // act's two fields are both optional, so it IS a trigger by the card's shape,
  // and keying the sheet on "not a trigger" left it a bare form. Caught by the
  // shot runner going looking for a flavor line and finding none.
  assert.match(MOUNT, /const sheet = shown \? " pmc-sheet" : "";/,
    "terms alone decide it — the door decides it, by sending them");
  assert.doesNotMatch(MOUNT, /const sheet = shown && !trigger/,
    "the shape of the card does not get a vote");
  // a sheet keeps its field captions even dressed as a trigger — the field
  // descriptions are where the door says what agreeing to this does
  assert.match(MOUNT, /const captioned = !trigger \|\| Boolean\(sheet\);/,
    "and a sheet's fields keep the door's own captions rather than hiding them behind a hover");
  // the terms are asked for by OPENING the act, not only by hovering its seat
  assert.match(MOUNT, /if \(state\.open\) askTerms\(state\.open\);/,
    "so an act reached through the tray or by its number arrives with its terms");
  assert.match(MOUNT, /function flavorHtml\(card\) \{/, "the room's own sentence leads");
  assert.match(MOUNT, /const said = portalOf\(state\.answer\)\?\.body \|\| card\?\.blurb \|\| null;/,
    "quoted from the record, never written here");
  assert.match(MOUNT, /read them whole — you cannot be bound by law you were not shown at the door/,
    "and the sentence that makes the fold non-negotiable is written on the disclosure itself");
});
