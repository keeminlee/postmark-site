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
  HUMAN_ACTOR, aimField, aimTargets, aimable, barFold, barSlots, blockedReason,
  cardOf, consentSplit, dialSpeak, snapPoint, walkStep, weaponFor,
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
    // A SECOND ACT THAT DEALS DAMAGE, and it is in the fixture for one reason:
    // only one of the room's damaging acts is helped by what you are holding, so
    // a weapon clause attached to both would be a claim about this one that the
    // record does not make. Without a second, that could not be falsified.
    ground("hurl", { fields: { object: AIMED }, dials: { to_hit_die: 20, damage_die: 10, beats_ac: 11 } }),
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
    ["walk", "say", "exit", "swing", "hurl", "brace", "raise"],
    "the ambient ones the caller kept, then everything the ground itself granted");
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

// ══ (2b) WHAT THE WHEEL ACTUALLY GATES (addendum, 2026-08-29) ═══════════════
//
// THE FINDING IS THE OFFICE'S, and it is worth stating because it reverses who
// was at fault. The `do:` gate NEVER held walk or say: the office refuses
// anything that is not one of the ground's arena verbs before the wheel is
// consulted at all, so a walk mid-fight has always gone through. What froze the
// founder during the party was THIS SURFACE — it saw `acting_blocked`, read it
// as "you may not act", and cooled every seat including the ones the door would
// have honoured. `gates` is the door naming the acts it means.

/** The door's own narrowing, in the office's shape (world-apex.mjs actingBlocked,
 *  branch bday-law 883e77d): a reason, the acts it is about, and a hint. */
const GATED = (gates) => ({
  ...VAULT,
  standpoint: {
    ...VAULT.standpoint,
    acting_blocked: {
      reason: "it is the unlit cake's turn",
      ...(gates ? { gates } : {}),
      hint: "the wheel gates this ground's ARENA verbs while an encounter is live — yours comes round.",
    },
  },
});

test("a narrowed refusal cools exactly the acts the door named", () => {
  const answer = GATED(["swing", "brace", "raise", "gather"]);
  const bar = barSlots(answer, { acting: "keeminlee" });
  const seat = (a) => [...bar.fixed, ...bar.tray].find((s) => s.action === a);

  // the ones the door named are cold, and each says the door's own reason
  for (const a of ["swing", "brace", "raise", "gather"]) {
    assert.equal(seat(a).enabled, false, `${a} waits for the wheel`);
    assert.equal(seat(a).blocked, "it is the unlit cake's turn", `${a} says why, in the door's words`);
  }
  // ⚑ AND EVERYTHING ELSE STAYS LIVE. This is the whole addendum: the founder
  // could not walk out of a room whose door would have let him walk the entire
  // time, because the page had greyed the seat.
  for (const a of ["walk", "say", "exit", "take"]) {
    assert.equal(seat(a).enabled, true, `${a} is not the wheel's business`);
    assert.equal(seat(a).blocked, null, `${a} is not told it is refused`);
  }
});

test("a refusal with no list narrows nothing, exactly as before the field existed", () => {
  // THE FLIP, and it is the one that matters: the change must be invisible
  // against a door that has not grown the field, and must never quietly un-gate
  // a fight. Same reason, no `gates`.
  const bar = barSlots(GATED(null), { acting: "keeminlee" });
  const afforded = [...bar.fixed, ...bar.tray].filter((s) => s.afforded);
  assert.ok(afforded.length > 0);
  assert.ok(afforded.every((s) => s.enabled === false), "every afforded seat cools");
  assert.equal(blockedReason(GATED(null)).gates, null, "because the door narrowed nothing");
  // an empty list is not a narrowing either — it is a door saying nothing
  assert.equal(blockedReason(GATED([])).gates, null);
  assert.ok(barSlots(GATED([]), { acting: "keeminlee" }).fixed
    .filter((s) => s.afforded).every((s) => s.enabled === false));
});

test("the derived block narrows nothing, and says so by omission", () => {
  // Which acts a wheel gates is the ground's own law, and this file has no verb
  // list to name them with. So a derivation says only what it can honestly say.
  const derived = blockedReason({
    ...VAULT,
    encounter: { ...VAULT.encounter, turn: "the-town/the-unlit-cake" },
  }, { acting: "keeminlee" });
  if (derived) {
    assert.equal(derived.from, "derived");
    assert.equal(derived.gates, null, "a derivation does not invent a list it cannot read");
  }
});

test("the gate line names what is waiting, in the seats' own words", () => {
  assert.match(MOUNT, /function gateWords\(blocked, shown, folded\) \{/,
    "the line above the bar is built rather than printed raw");
  assert.match(MOUNT, /if \(!blocked\?\.gates\?\.length\) return blocked\.reason;/,
    "and where the door narrowed nothing it is exactly the sentence it always was");
  assert.match(MOUNT, /\$\{blocked\.reason\} — \$\{cold\.join\(", "\)\} wait for it/,
    "where it did, the cold seats are named — so the line cannot read as a flat refusal over a live row");
});

// ══ (3b) WHAT YOU ARE HOLDING (addendum, 2026-08-29) ════════════════════════

/** The office's own weapon shape, carried out to a caller. `weaponInHand`
 *  already answers {thing, bonus, says}; `hands[who].weapon` is that answer
 *  reaching the door (office lane bday-law, in flight at the time of writing). */
const HOLDING = (weapon, who = "keeminlee") => ({
  ...VAULT,
  encounter_detail: {
    ...VAULT.encounter_detail,
    hands: { [who]: { hp: 16, of: 20, downed: false, guarding: false, gone: false, ...(weapon ? { weapon } : {}) } },
  },
});

test("the weapon completes the founder's own sentence, on the act it helps", () => {
  // HIS EXAMPLE, verbatim in shape: "Strike — d20 vs 12 to hit · d8 damage ·
  // +3 with the good-lighter". The first two thirds are the class's dials; the
  // third is what THIS hand happens to be carrying today.
  const answer = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, for: "swing" });
  assert.equal(dialSpeak(cardFor(answer, "swing"), { weapon: weaponFor(answer, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage · +3 with the good lighter",
    "deslugged by the same one-writer every id in this world is read by");

  // ⚑ AND ONLY ON THE ACT IT HELPS. Two of the room's acts state damage and only
  // one is helped by what you are holding; attaching it to both would be a claim
  // about the second that the record does not make.
  assert.equal(dialSpeak(cardFor(answer, "hurl"), { weapon: weaponFor(answer, "keeminlee") }),
    "d20 vs 11 to hit · d10 damage", "the other damage act claims no help it was not given");
  assert.equal(dialSpeak(cardFor(answer, "brace"), { weapon: weaponFor(answer, "keeminlee") }),
    "halves the next hit");
});

test("no weapon, no clause — and a hand that is not yours is not read", () => {
  // absent field → today's sentence, unchanged
  assert.equal(weaponFor(VAULT, "keeminlee"), null, "a door that sends no hands says nothing");
  assert.equal(weaponFor(HOLDING(null), "keeminlee"), null, "nor one whose hand carries no weapon");
  assert.equal(dialSpeak(cardFor(VAULT, "swing"), { weapon: weaponFor(VAULT, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage", "so the sentence is the two thirds the class states");

  // a bonus of zero is not a fact worth a word
  assert.equal(weaponFor(HOLDING({ thing: "the-town/a-stick", bonus: 0, for: "swing" }), "keeminlee"), null);
  // somebody else's hand is somebody else's
  assert.equal(weaponFor(HOLDING({ thing: "x/y", bonus: 2 }, "vermillion"), "keeminlee"), null);
  // acting as the household's human reads the HUMAN's row, found by kind
  const asHuman = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, for: "swing" }, "keeminlee");
  assert.equal(weaponFor(asHuman, HUMAN_ACTOR)?.bonus, 3,
    "the human's hand is the one on the wheel under their own kind");
});

test("the weapon's own words are rendered, and they are the record's", () => {
  // `says` is the half of the hover with a voice in it: the dials are
  // arithmetic and the blurb is a class speaking about acts in general, while
  // this is the thing in your hand speaking about itself. The lighter's, from
  // the record: "a flame that has never once gone out on the way over".
  const w = weaponFor(HOLDING({
    thing: "the-town/the-good-lighter", bonus: 3, for: "swing",
    says: "a flame that has never once gone out on the way over",
  }), "keeminlee");
  assert.equal(w.says, "a flame that has never once gone out on the way over", "quoted, never paraphrased");
  // absent where the record kept none — this surface writes no flavour of its own
  assert.equal(weaponFor(HOLDING({ thing: "x/y", bonus: 1, for: "swing" }), "keeminlee").says, null);
  // it rides the card, under the blurb, and only for the act it belongs to
  assert.match(MOUNT, /const voice = w\?\.says && w\.for === card\.action/,
    "a weapon's words appear on the act it helps and nowhere else");
});

test("which act a weapon helps is the door's word, and the site's stopgap is gone", () => {
  // ⚑ THE STOPGAP IS DELETED, NOT DEMOTED TO A FALLBACK, and that is the
  // assertion worth having. `weapon.for` shipped (office 7ba1148), read off the
  // held grant's own entry rather than hardcoded. A weapon whose grant names NO
  // act must now show no clause at all: "the record did not say" and "the site
  // guessed" must not look the same on this surface.
  const noFor = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3 });
  assert.equal(weaponFor(noFor, "keeminlee").for, null,
    "the arithmetic does not guess which act — it reports that the door did not say");
  assert.equal(dialSpeak(cardFor(noFor, "swing"), { weapon: weaponFor(noFor, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage", "and with no act named, no act claims it");
  assert.doesNotMatch(MOUNT, /WEAPON_HELPS = "/, "no name of ours answers that question any more");
  assert.match(MOUNT, /return weaponFor\(state\.answer, state\.acting\);/,
    "the mount passes the door's answer through untouched");

  // ⚑ AND IT IS READ UNDER ITS SUCCESSOR'S NAME TOO. `for` is a homonym — in
  // the grants vocabulary it means the ACTOR KIND — so it is flagged for the
  // lexicon with `augments` named as the successor. This file has been bitten
  // by exactly this before (the door started sending `says` where the site
  // wrote `because`, and the row whose words mattered most went quiet by
  // succeeding), so both spellings are read and a rename costs nobody a
  // coordinated edit.
  const renamed = HOLDING({ thing: "the-town/the-good-lighter", bonus: 3, augments: "swing" });
  assert.equal(weaponFor(renamed, "keeminlee").for, "swing", "the successor spelling is read");
  assert.equal(dialSpeak(cardFor(renamed, "swing"), { weapon: weaponFor(renamed, "keeminlee") }),
    "d20 vs 12 to hit · d8 damage · +3 with the good lighter",
    "and the bonus keeps appearing on the day the word moves");
  // the shipped spelling still wins where both somehow arrive
  const both = HOLDING({ thing: "x/y", bonus: 1, for: "swing", augments: "hurl" });
  assert.equal(weaponFor(both, "keeminlee").for, "swing");
  // ONE READING, so the seat, the card and the panel cannot disagree on a
  // number. Asserted as "no call site omits it" rather than as a COUNT of call
  // sites: a count is a test that fails the day somebody legitimately adds a
  // fourth surface, which trains the next reader to edit the number instead of
  // thinking about it. What actually matters is that none of them is reading a
  // different hand — or no hand at all.
  assert.match(MOUNT, /function heldWeapon\(\) \{/);
  const speaks = MOUNT.match(/dialSpeak\([^)]*\)/g) ?? [];
  assert.ok(speaks.length >= 3, "the seat, the card and the panel all say what an act costs");
  for (const call of speaks) {
    assert.match(call, /weapon: heldWeapon\(\)/, `every surface reads the same hand — ${call}`);
  }
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

/** The dial where the office actually puts it: FLAT on the portal block, beside
 *  id/value/by/space/keeps_wheel/body. Read off arena.mjs 2026-08-29. */
const withStride = (answer, v) => ({
  ...answer,
  standpoint: { ...answer.standpoint, portal: { ...answer.standpoint.portal, walk_min_step: v } },
});

test("a ground that declares no stride is not snapped — a floor of one metre was a bug", () => {
  // ⚑ THE DEFECT THIS PINS, and it was mine. The first version read four
  // GUESSED paths (none of them the real one) and answered ONE METRE when they
  // all missed — which was every ground in the town. Its own comment claimed
  // that left walking "byte-identical" while the line under it quietly snapped
  // every click-to-walk in the world onto whole metres.
  //
  // The office refused the same temptation and wrote down why: "a floor of 1
  // here would make every ground in the town start snapping walks to whole
  // metres — which is not what the town does today, so 'the default is 1' would
  // have been a town-wide re-cut of the walk wearing a per-ground dial's
  // clothes." Same mistake, other side of the wire.
  assert.equal(walkStep(VAULT), null, "a ground that has said nothing says nothing");
  assert.equal(walkStep({}), null);
  assert.equal(walkStep(null), null);

  // and an unsnapped point survives whole, to the digit
  const clicked = { x: 1083.417, y: -791.62 };
  assert.deepEqual(snapPoint(clicked, walkStep(VAULT)), clicked,
    "so the click the reader made is the point that is sent");
});

test("a ground that declares one snaps to it, on the office's own lattice", () => {
  // THE VAULT'S REAL VALUE is 0.25 — fine enough to stand beside a cake in a
  // three-metre room, and a lattice that still contains every whole metre.
  assert.equal(walkStep(withStride(VAULT, 0.25)), 0.25, "the declared stride is read, flat, off the portal block");
  assert.deepEqual(snapPoint({ x: 1083.417, y: -791.62 }, 0.25), { x: 1083.5, y: -791.5 });
  // round(v/step)*step anchored at the world origin — the same arithmetic the
  // office's own snapTo does, so a page that snaps before sending and one that
  // does not land on the same square.
  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, 0.5), { x: 1083.5, y: -791.5 });
  assert.deepEqual(snapPoint({ x: 1083.4, y: -791.6 }, 5), { x: 1085, y: -790 });
  assert.deepEqual(snapPoint({ x: -0.4, y: -0.6 }, 1), { x: -0, y: -1 }, "and it works either side of the origin");

  // ⚑ THE OLD GUESSED PATHS ARE DEAD and must stay dead — a reader who finds
  // one of them in a fixture should get null, not a stride.
  for (const wrong of [
    { ...VAULT, standpoint: { ...VAULT.standpoint, walk: { min_step: 0.5 } } },
    { ...VAULT, standpoint: { ...VAULT.standpoint, portal: { ...VAULT.standpoint.portal, walk: { min_step: 0.5 } } } },
    { ...VAULT, walk: { min_step: 0.5 } },
    { ...VAULT, encounter_detail: { ...VAULT.encounter_detail, walk: { min_step: 0.5 } } },
  ]) {
    assert.equal(walkStep(wrong), null, "a nested walk.min_step is not the field and is not read");
  }
});

test("an unusable stride leaves the point alone rather than inventing one", () => {
  const p = { x: 1083.4, y: -791.6 };
  for (const bad of [0, -1, NaN, null, undefined, {}]) {
    assert.deepEqual(snapPoint(p, bad), p, `a stride of ${JSON.stringify(bad)} snaps nothing`);
  }
  // A NUMBER-SHAPED STRING IS READ AS THE NUMBER IT SPELLS, deliberately and
  // both sides alike. The office sends a number, so this is not a case anyone
  // is relying on — but the two functions must not disagree about it, because a
  // page that snapped to a stride the reader could not see would be worse than
  // one that snapped to none.
  assert.deepEqual(snapPoint(p, "0.5"), { x: 1083.5, y: -791.5 });
  assert.equal(walkStep(withStride(VAULT, "0.5")), 0.5);
  // absent-means-absent all the way down: a portal that spells it as null or
  // zero has still said nothing usable
  for (const v of [null, 0, -1, undefined, "", "later", {}]) {
    assert.equal(walkStep(withStride(VAULT, v)), null, `walk_min_step ${JSON.stringify(v)} is not a stride`);
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
  assert.deepEqual(fold.shown.map((s) => s.key), [1, 2, 3, 4, 5, 6, 7],
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
  assert.match(MOUNT, /leadsTo\(s\) \?\? dialSpeak\(s\.card, \{ brief: true, weapon: heldWeapon\(\) \}\)/, "the seat asks for the headline");
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
  assert.match(MOUNT, /const BAR_KEEP = \["walk", "say", "enter", "exit"\];/,
    "the ambient seats that hold a row — his three, plus the crossing act added on the conductor's ruling");
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
  assert.match(MOUNT, /return `\$\{line\}\$\{blurb\}\$\{voice\}<p class="pmc-from">press for the fine print<\/p>`;/,
    "so the card is the throw, the sentence, the weapon's own words, and a pointer to the rest");
  assert.match(MOUNT, /function fineHtml\(card\) \{/, "and the rest is rendered on the panel");
  assert.match(MOUNT, /\$\{trigger && !sheet \? "" : fineHtml\(c\)\}/,
    "which is where formHtml puts it — on every panel except the tight fight plate, and on that one too once it is delivering terms");
  // the seat's own line is game-speak now too, in its headline form — see
  // "a seat gets the headline and the card gets the whole line" below
  assert.match(MOUNT, /leadsTo\(s\) \?\? dialSpeak\(s\.card, \{ brief: true, weapon: heldWeapon\(\) \}\)/,
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
