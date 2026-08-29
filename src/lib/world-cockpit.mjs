// world-cockpit.mjs — the arithmetic behind the world page's portal cockpit.
//
// Nothing here fetches, draws, or touches a DOM. Everything here is a reading of
// ONE object: the answer the apex door gives back from `GET /api/world/apex`
// (its MCP twin is the `world` verb). The island owns the pixels, the office owns
// the world, and what lives here is the part between them that can be tested
// without a browser.
//
// THE LAW THIS FILE OBEYS, quoted from postmark-world LOGOS/reads-and-affordances.md
// § The apex:
//
//   "Bare, it answers where you stand and what the ground affords; the affordance
//   list is the permission calculus over the class tree at your standpoint; the
//   terms delivered before an act binds are the class-nodes' own content, because
//   you cannot be bound by law you were not shown at the door."
//
// So: the bar RENDERS the door's answer. It never computes which acts exist, never
// carries a verb list of its own, and never writes a blurb. A verb this file has
// never heard of renders exactly as well as `say` does, because every word on the
// card comes out of the entry the door sent. That is the whole design, and it is
// why `barSlots` splits by NAME rather than by meaning: the six familiar names get
// their fixed seat wherever the door granted them, and *everything else the door
// sent* is the afforded-here tray, in the door's own order.
//
// WHY NOT SPLIT ON `grant`. The mockup's tray is "what THIS ground grants", and the
// answer carries `grant: "yours" | "here"` which reads like exactly that field. It
// is not, today. `world-apex.mjs` computes it as
//
//     for (const e of actions) e.grant = embodied && e.class === "resident" ? "yours" : "here";
//
// so an ANONYMOUS reader gets all twelve ordinary verbs stamped `here` — measured
// against the live door 2026-08-26: signed in, `here: []`; signed out, `here` holds
// every verb there is. A tray keyed on that field would put WALK and SAY in the
// "what this ground grants" tray for every visitor who is not signed in. `grant`
// is still shown on the card as provenance, because it is honest about how the act
// reached you; it is just not what decides a seat.

// ── the fixed slots ─────────────────────────────────────────────────────────
//
// Seed call ③, and the mockup takes the recommendation: "fixed familiar slots +
// an 'afforded here' tray — game-literate muscle memory with the grammar's
// honesty." These names are the DOOR's spellings (`leave-mark`, not "mark"); the
// label is the bar's shorthand and is display only. A slot whose act the door did
// not grant here still holds its seat, greyed, saying so — muscle memory is only
// worth anything if the seat does not move.
export const FIXED_SLOTS = Object.freeze([
  { action: "walk", label: "WALK" },
  { action: "say", label: "SAY" },
  { action: "leave-mark", label: "MARK" },
  { action: "give", label: "GIVE" },
  { action: "take", label: "TAKE" },
  { action: "note-to-self", label: "NOTE" },
]);

const FIXED_NAMES = new Set(FIXED_SLOTS.map((s) => s.action));

/** The keyboard slots. 1-9; past the ninth a slot is mouse-only rather than
 *  silently unreachable — the tray's length is the ground's business, not ours. */
export const MAX_KEYED = 9;

// ── what the door said about one act ────────────────────────────────────────

/**
 * The tooltip card, entirely quoted.
 *
 * Every string here comes off the entry. `blurb` is the class mark's own body —
 * "the door quotes the residue class's own mark" — so when it is missing the card
 * SAYS the door sent none rather than substituting a sentence of the site's. A
 * blurb the site wrote would be prose claiming to be law, which is the one thing
 * this surface must never do.
 *
 * `dials` is absent from most entries and that is correct, not a gap: the office
 * emits it only when the residue class has non-empty dials
 * (`world-apex.mjs`: `...(residue?.dials && Object.keys(residue.dials).length ? { dials: residue.dials } : {})`).
 * Today's resident-class acts carry none. A card renders the row or omits it.
 */
export function cardOf(entry) {
  if (!entry || typeof entry !== "object") return null;
  const fields = entry.fields && typeof entry.fields === "object" ? entry.fields : {};
  const dials = entry.dials && typeof entry.dials === "object" ? entry.dials : null;
  return {
    action: String(entry.action ?? ""),
    blurb: typeof entry.blurb === "string" && entry.blurb.trim() ? entry.blurb : null,
    blurbFrom: entry.blurb_from ?? null,
    grantedBy: entry.from ?? null,
    className: entry.class ?? null,
    via: entry.via ?? null,
    grant: entry.grant ?? null,
    dials: dials && Object.keys(dials).length ? dials : null,
    // WHICH CHANNEL OPENED THIS ACT — the door's own word for whether the
    // GROUND granted it or it travelled here with the caller. The office sets
    // it at the two places entries are built: `channel: "ambient"` on the ones
    // gathered off the spine and reach, `channel: "ground"` on the ones a
    // classed ground declares (world-apex.mjs, the ground builder). It is the
    // honest signal `grant` is not — `grant` is computed as "embodied && class
    // === resident", so a signed-out reader gets every ordinary verb stamped
    // `here`, which this file's own note at the top has warned about since it
    // was written. `channel` is a fact about where the entry came from and does
    // not move with who is asking.
    channel: entry.channel ?? null,
    fields: Object.entries(fields).map(([name, f]) => ({
      name,
      type: f?.type ?? null,
      required: f?.required === true,
      // The door's own description, verbatim and whole. The bar truncates for the
      // one-line summary; the card does not, because a field description is where
      // the door tells a caller what the act will do with the value.
      description: typeof f?.description === "string" ? f.description : null,
      enum: Array.isArray(f?.enum) ? f.enum.slice() : null,
      enumCount: typeof f?.enum_count === "number" ? f.enum_count : null,
    })),
  };
}

/**
 * The one-line dial under a slot's name: the class's real dials, or nothing.
 *
 * It said "travels with you" / "granted here" for the dial-less case until the
 * first shot was looked at — nine slots each carrying eight ems of the same
 * sentence pushed the bar into two rows at 1440, and the sentence was the same on
 * every familiar seat, so it distinguished nothing while costing the layout. The
 * provenance is still shown, on the card, where there is room for it and where a
 * reader has asked for detail. An empty line under an act with no dials is the
 * honest report: this act has no costs to state.
 */
export function dialLine(card) {
  if (!card?.dials) return "";
  return Object.entries(card.dials)
    .map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
}

/**
 * THE SAME DIALS, SAID THE WAY A GAME SAYS THEM.
 *
 * FOUNDER'S RULING 2026-08-29: "the 'terms' in the hover and click for the
 * actions is NOT helpful to a human … bare fields … re-write to be concise, and
 * just give info like it would in a game, not a debug panel." What he was
 * reading was `dialLine` above — `to_hit_die 20 · damage_die 6 · beats_ac 8`,
 * clipped to six ems on the seat, which is a struct printed at a player.
 *
 * ⚑ THIS IS A PHRASEBOOK, NOT A VERB LIST, and the distinction is the one this
 * file is held to. Nothing below names an act. These are the DIALS' own names —
 * the physics the record states about whatever act carries them — and the same
 * dial reads the same way whichever act declares it. A door that grows a sixth
 * act gets every one of these sentences for free.
 *
 * THE DEFAULT IS WHAT KEEPS IT OPEN. A dial this map has never heard of falls
 * through to `dialLine`'s reading — the door's own key beside the door's own
 * value — so a new dial appears, plainly, rather than vanishing. That is the
 * same shape as the bar's own default for a verb it has never seen, and it is
 * why this can be a phrasebook without becoming a schema.
 *
 * A DIAL THAT IS NOT THERE IS NOT MENTIONED (the second half of the ruling: "if
 * a dial is missing, say nothing rather than showing a bare field name"). So an
 * act whose class states no dials returns the empty string, and the surface
 * renders no line at all rather than an empty one with a caption over it.
 */
/**
 * @param {object} card
 * @param {{brief?: boolean, weapon?: object|null}} [opts] `brief` returns only
 *   the FIRST phrase — the headline, for a seat that has a seat's worth of
 *   room. `weapon` is `weaponFor`'s answer, and it completes the founder's own
 *   example sentence: "d20 vs 12 to hit · d8 damage · +3 with the good lighter".
 *   It is appended only to the act the weapon says it augments, so an act that
 *   throws the same damage die and gets no help from what you are holding does
 *   not claim any.
 *
 * ⚑ WHY BRIEF EXISTS AND ELLIPSIS DOES NOT. The seat's line was capped in CSS
 * and clipped with an ellipsis, which read "d20 vs 8 to hit · d…" — measured at
 * 1280, where the row steps aside for the walk desk and has 771px for six
 * seats. Widening the cap until the sentence fit put 93px of the row off the
 * edge, which is the scroll the fold exists to remove. A clipped sentence is
 * worse than a short one: it costs the same room and tells the reader there is
 * something they are not being shown. So the seat gets a whole short phrase and
 * the card gets the whole line, and neither of them is cut.
 */
export function dialSpeak(card, { brief = false, weapon = null } = {}) {
  const d = card?.dials;
  // A HAND'S WEAPON IS A FACT ABOUT THIS ACT even where the class states no
  // dials of its own, so it is read before the early return rather than after
  // it. What stays true is the ruling: an act with nothing to say says nothing.
  // NO ARTICLE IS ADDED, because the id already carries whatever one it has.
  // A leaf deslugs to "the good lighter" on its own, and prepending one read
  // "+3 with the the good lighter" — caught by the falsifier. The name is the
  // record's, exactly as the adversary's and the loose things' names are.
  const held = weapon && weapon.for && weapon.for === card?.action && Number.isFinite(weapon.bonus)
    ? `${weapon.bonus > 0 ? "+" : "−"}${Math.abs(weapon.bonus)} with ${weapon.label ?? weapon.thing}`
    : null;
  if (!d) return held ?? "";
  const said = [];
  const seen = new Set();
  const take = (...keys) => { for (const k of keys) seen.add(k); };
  const die = (v) => { const n = Number(v); return Number.isFinite(n) && n > 1 ? `d${n}` : null; };

  // The throw and the number it has to beat are ONE sentence, not two — "d20 vs
  // 12 to hit" is what a player reads, and the two dials apart are two facts
  // they have to join themselves.
  const hit = die(d.to_hit_die);
  const ac = Number.isFinite(Number(d.beats_ac)) ? Number(d.beats_ac) : null;
  if (hit && ac != null) { said.push(`${hit} vs ${ac} to hit`); take("to_hit_die", "beats_ac"); }
  else if (hit) { said.push(`${hit} to hit`); take("to_hit_die"); }
  else if (ac != null) { said.push(`beats ${ac}`); take("beats_ac"); }

  const dmg = die(d.damage_die);
  if (dmg) { said.push(`${dmg} damage`); take("damage_die"); }
  if (Number.isFinite(Number(d.restores_to))) { said.push(`lifts to ${Number(d.restores_to)}`); take("restores_to"); }
  if (d.halves_next_hit === true) { said.push("halves the next hit"); take("halves_next_hit"); }
  if (Number.isFinite(Number(d.reach_m))) { said.push(`reach ${Number(d.reach_m)} m`); take("reach_m"); }

  for (const [k, v] of Object.entries(d)) {
    if (seen.has(k)) continue;
    // the shapes a name states about itself, read off the name rather than
    // looked up: a die is a die, metres are metres, seconds are seconds
    const n = Number(v);
    if (/_die$/.test(k) && die(v)) said.push(`${die(v)} ${k.replace(/_die$/, "").replace(/_/g, " ")}`.trim());
    else if (/_m$/.test(k) && Number.isFinite(n)) said.push(`${k.replace(/_m$/, "").replace(/_/g, " ")} ${n} m`);
    else if (/_s$/.test(k) && Number.isFinite(n)) said.push(`${n}s ${k.replace(/_s$/, "").replace(/_/g, " ")}`);
    else if (v === true) said.push(k.replace(/_/g, " "));
    else if (v === false) continue; // a dial the record turned off says nothing
    else said.push(`${k} ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  // WHAT YOU ARE HOLDING COMES LAST, which is where the founder's own sentence
  // puts it and is also where it belongs: the class's dials are what the act
  // always costs, and the weapon is what THIS hand happens to add today.
  if (held) said.push(held);
  // The first phrase is the headline because the order above is the order a
  // player asks in: what do I throw and what must I beat, then what does it do.
  return (brief ? said.slice(0, 1) : said).join(" · ");
}

/**
 * The character limit the door STATES for a field, or null.
 *
 * The apex's field descriptions carry their own limits in prose — "what you say,
 * at most 500 characters", "the complete replacement note, maximum 2000
 * characters", "one present-tense observation; maximum 150 characters" — all
 * three read off the live door on 2026-08-26. Reading the number is how the form
 * knows whether a field wants one line or several, and it is a fact the door
 * supplied rather than a shape the site guessed.
 *
 * The first version guessed from the LENGTH of the description, which put a
 * four-line textarea under `wick` (a mark id, one line, with a long explanation)
 * — seen in QA. A long explanation is not a long value.
 */
export function statedLimit(description) {
  const m = /(?:at most|maximum|max\.?|no more than|up to)\s+([\d,]+)\s*(?:characters|chars)/i.exec(String(description ?? ""));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

/** A field wants more than one line when the door said it may hold more than a
 *  line's worth. 150 is the world's own smallest stated limit — a mark's body,
 *  which is prose — so it is the floor rather than a number picked by taste. */
export const MULTILINE_AT = 150;

export function wantsTextarea(field) {
  const n = statedLimit(field?.description);
  return n != null && n >= MULTILINE_AT;
}

// ── the bar ─────────────────────────────────────────────────────────────────

/**
 * The bar, from the answer.
 *
 * Returns `{ fixed, tray }`. `fixed` always has FIXED_SLOTS.length entries in
 * FIXED_SLOTS order, each `{ action, label, key, card | null, afforded }`; a slot
 * the door did not grant here has `card: null` and `afforded: false`. `tray` is
 * every OTHER action the door sent, in the door's own order — which is where a
 * verb nobody has written a line of site code for arrives.
 */
export function barSlots(answer, { acting = null } = {}) {
  const actions = Array.isArray(answer?.actions) ? answer.actions : [];
  const byName = new Map();
  for (const e of actions) if (e && typeof e.action === "string") byName.set(e.action, e);

  // TURN-GATING IS A SEPARATE FACT FROM AFFORDANCE, and keeping them separate is
  // the point. `afforded` says the ground grants this act; `blocked` says you may
  // not take it THIS INSTANT. An act that is afforded here and blocked until your
  // turn still shows its card, its fields and its terms — the grammar stays
  // legible, which is the founder's ruling in one word: disabled, never hidden.
  const blocked = blockedReason(answer, { acting });

  // ⚑ A BLOCK IS ABOUT PARTICULAR ACTS, WHERE THE DOOR SAYS WHICH (2026-08-29).
  //
  // This used to spread one refusal across every afforded seat, because until
  // tonight that is what the law said and the door had no way to say otherwise.
  // The cost was measured on the founder, mid-party: the wheel rested on the
  // creature, the door answered `acting_blocked`, and the whole bar went cold —
  // so he could not walk out of a room whose door would have let him walk the
  // entire time. `gates` names the acts the refusal is actually about; anything
  // not on that list keeps its seat live.
  //
  // NO LIST MEANS NO NARROWING, not "narrow to nothing". A door that has not
  // grown the field, and this file's own derivation, both hand back `gates:
  // null` and every afforded seat greys exactly as it did before — so the change
  // is invisible against an unmodified door and cannot quietly un-gate a fight.
  const gatedHere = (action) =>
    Boolean(blocked) && (!blocked.gates || blocked.gates.includes(action));

  let key = 0;
  const dress = (slot) => ({
    ...slot,
    blocked: slot.afforded && gatedHere(slot.action) ? blocked.reason : null,
    enabled: slot.afforded && !gatedHere(slot.action),
  });

  const fixed = FIXED_SLOTS.map((slot) => {
    const entry = byName.get(slot.action) ?? null;
    return dress({
      action: slot.action,
      label: slot.label,
      key: ++key <= MAX_KEYED ? key : null,
      card: entry ? cardOf(entry) : null,
      afforded: Boolean(entry),
    });
  });

  const tray = [];
  for (const e of actions) {
    if (!e || typeof e.action !== "string" || FIXED_NAMES.has(e.action)) continue;
    const n = ++key;
    tray.push(dress({
      action: e.action,
      // A verb the site has never seen names itself. Upper-cased for the bar's
      // voice only; the card and every dispatch use the door's own spelling.
      label: e.action.replace(/-/g, " ").toUpperCase(),
      key: n <= MAX_KEYED ? n : null,
      card: cardOf(e),
      afforded: true,
    }));
  }
  return { fixed, tray, blocked };
}

// ── portal ground ───────────────────────────────────────────────────────────

/**
 * Are we inside portal ground, and which portal.
 *
 * INTEGRATION CONTRACT (site-defined 2026-08-26, awaiting the core lane).
 * The world's own portal is a `predicated` mark carrying `slot: portal` and a
 * `value` naming what the read roots at — postmark-world LOGOS/classes.md:
 * "portal, a child of postmark-edge, is the door between the dimensions …
 * crossing a portal changes what you read, never where you stand". The apex
 * answer does not surface predicated properties of the spine today, so the site
 * cannot see a portal it is standing in. The minimal field that closes it:
 *
 *     standpoint.portal = { id, value, by?, body? }   // absent when not inside one
 *
 * `id` is the portal mark's `<by>/<slug>`, `value` the target the read roots at.
 * Absent means not inside portal ground — which is the honest default, and it is
 * why an unmodified door leaves the world page byte-identical to today.
 *
 * NO FALLBACK IS GUESSED HERE, deliberately. A site-side sniff (a mark id that
 * looks portal-shaped in `within`) would be the site inventing its own permission
 * calculus, which is the exact thing the apex law forbids: "the affordance list
 * IS the permission calculus at your standpoint". If the door has not said we are
 * inside a portal, we are not.
 */
export function portalOf(answer) {
  const p = answer?.standpoint?.portal;
  if (!p || typeof p !== "object") return null;
  const id = typeof p.id === "string" && p.id ? p.id : null;
  if (!id) return null;
  return {
    id,
    value: typeof p.value === "string" ? p.value : null,
    by: typeof p.by === "string" ? p.by : id.split("/")[0] || null,
    body: typeof p.body === "string" ? p.body : null,
  };
}

/**
 * The founder's scope ruling, in one predicate.
 *
 * RULED 2026-08-27: the bar mounts wherever the ACTORS ROSTER is present, parcels
 * included, or wherever the door says we are inside a portal.
 *
 * IT SUPERSEDES THE RULING OF 2026-08-26, which is kept here beside it rather than
 * replaced by it, because an instruction that reverses an earlier one has to show
 * both states or the next reader cannot tell a deliberate reversal from somebody's
 * regression. The superseded ruling read: the cockpit ships inside portal ground,
 * and the world page outside portals keeps today's chrome untouched. It was
 * written here as `portalOf(answer) !== null`, and while it stood the bar could
 * not appear on a parcel however much ground granted there.
 *
 * THE ROSTER IS THE HONEST SIGNAL for the wider scope, and it is the door's, not
 * ours. The office answers `actors` exactly where a key holds someone who could
 * act, and its Human row is ALWAYS in it — allowed, or refused with the door's own
 * reason (office human-actor.mjs `actorRoster`, 2026-08-27: "An absent option
 * teaches nothing"). So a roster arriving IS the door saying there is something
 * here for a bar to be about. An EMPTY array is the opposite and is not a bar.
 *
 * With neither, the island still appends no element, adds no rule, binds no key.
 */
export function cockpitShows(answer) {
  return rosterOf(answer) !== null || portalOf(answer) !== null;
}

/** The door's roster, or null when it sent none — or sent an empty one, which is
 *  the door saying nobody on this key can act here. */
export function rosterOf(answer) {
  const a = answer?.actors;
  return Array.isArray(a) && a.length ? a : null;
}

// ── the ACT AS roster ───────────────────────────────────────────────────────

/**
 * The human's own face, and where ground allows it.
 *
 * Two laws decide it, and neither is the site's to invent:
 *   (a) parcel-embodied-human — on a parcel, only the parcel's household's own
 *       human may act as themselves;
 *   (b) portals-are-the-playground (founder, 2026-08-24) — inside portal ground,
 *       any signed-in human may.
 *
 * INTEGRATION CONTRACT (site-defined 2026-08-26, awaiting the core lane).
 * The door should answer the roster, because the door holds the calculus:
 *
 *     answer.actors = [
 *       { kind: "resident", handle, label, allowed: true },
 *       { kind: "human", id, label, allowed: false, reason: "…the door's own words…",
 *         token_url?: "…" }
 *     ]
 *
 * When `actors` is present this function returns it untouched and the site stops
 * deriving — that is the whole point of the contract. The derivation below is the
 * BRIDGE until then, and it is deliberately narrower than the law: it can prove
 * (b) from the portal field and (a) from a parcel in the spine whose `by` is one
 * of the signed-in human's own handles, and it says so in the reason rather than
 * claiming a general answer.
 *
 * THE DOOR NOW ANSWERS IT — office `human-actor.mjs` `actorRoster`, commit
 * 7f0b56e, 2026-08-27, in the site's own field names because this file declared
 * them first. So against today's office the bridge is not walked at all, and its
 * parcel arm below is unreachable FROM THE COCKPIT even after the 08-27 scope
 * ruling widened the gate: reaching that arm needs an answer with a roster absent,
 * a portal absent and the bar mounted, and the widened gate mounts on exactly the
 * first two being present. It is kept, and unit-tested, because it is what a door
 * that has not grown `actors` still gets — but nothing in this repo proves it in a
 * running page, and a reader should not take its green test for that.
 */
export function actorsFor(answer, me, opts = {}) {
  if (Array.isArray(answer?.actors)) return answer.actors.map((a) => ({ ...a, from: "the door" }));

  const handles = Array.isArray(me?.handles) ? me.handles.filter((h) => typeof h === "string") : [];
  // The human IS the verified GitHub identity on the key — `GET /api/me` answers
  // `verified_github: { login, id }` (office queries.mjs `identityOf`), and that
  // login is the only durable name the site has for the person rather than for one
  // of their residents. A key with no verified GitHub is a machine key: it holds
  // residents and no human, so it gets no human face at all.
  const humanId = typeof me?.verified_github?.login === "string" && me.verified_github.login
    ? me.verified_github.login : null;
  const acting = typeof opts.acting === "string" ? opts.acting : handles[0] ?? null;

  const faces = handles.map((h) => ({
    kind: "resident",
    handle: h,
    label: h,
    allowed: true,
    reason: null,
    selected: h === acting,
    from: "derived",
  }));

  if (!humanId) return faces;

  const portal = portalOf(answer);
  const parcel = ownParcelIn(answer, handles);
  let allowed = false;
  let reason = null;
  if (portal) allowed = true;
  else if (parcel) allowed = true;
  else if (!handles.length) reason = "sign in to act as yourself";
  else reason = "this ground does not seat a human — a portal's ground does, and so does your household's own parcel";

  faces.push({
    kind: "human",
    id: humanId,
    label: HUMAN_TOKENS[humanId]?.label ?? humanId,
    allowed,
    reason,
    // Why it is allowed, in the words of the law that allowed it — so a face that
    // lights up says which ruling lit it rather than merely being bright.
    because: allowed ? (portal ? `inside ${portal.id} — a portal's ground seats a human` : `standing on ${parcel} — your household's own parcel`) : null,
    selected: acting === HUMAN_ACTOR,
    from: "derived",
  });
  return faces;
}

/**
 * The human face's own sentence — the door's words wherever it sent any.
 *
 * FIELD DRIFT, found 2026-08-27. The roster contract this site declared on 08-26
 * named `because`, and the bridge above writes one. The office's own roster emits
 * `says` on every row and `stance` on the human's, and no `because` at all
 * (office human-actor.mjs `actorRoster`, commit 7f0b56e, 2026-08-27).
 *
 * So the drift bit at exactly the wrong moment: the day the door started answering
 * `actors` — the thing the whole contract was waiting for — the bridge stopped
 * being walked, `because` stopped existing, and the human's face fell through to
 * the site's stand-in "where ground allows". The one row whose words were most
 * worth reading was the one that went quiet, and it went quiet by succeeding.
 *
 * READ IN BOTH DIRECTIONS, deliberately. The office half may be trued separately
 * toward this site's spelling, so `because` is still read first; whichever name
 * the door settles on, the door's sentence is the one that shows. The `stance`
 * fallback QUOTES rather than paraphrases — a word is not a sentence, and dressing
 * one up as prose would be the site writing law again.
 */
export function humanWords(face) {
  const said = [face?.because, face?.says].find((s) => typeof s === "string" && s.trim());
  if (said) return said;
  const stance = typeof face?.stance === "string" && face.stance.trim() ? face.stance : null;
  return stance ? `the door calls this standing "${stance}"` : "where ground allows";
}

/** The innermost parcel in the containment spine that one of these handles holds,
 *  or null. A parcel's `by` is its household's own resident — the same reading the
 *  world's ids carry everywhere (`vermillion/the-pando-peak-parcel`). */
export function ownParcelIn(answer, handles) {
  const within = Array.isArray(answer?.within) ? answer.within : [];
  const mine = new Set(handles ?? []);
  for (let i = within.length - 1; i >= 0; i--) {
    const w = within[i];
    const by = w?.by ?? (typeof w?.id === "string" ? w.id.split("/")[0] : null);
    if (by && mine.has(by) && isParcel(w)) return w.id;
  }
  return null;
}

function isParcel(w) {
  if (w?.kind === "parcel") return true;
  return typeof w?.id === "string" && /(^|\/)[^/]*parcel[^/]*$/.test(w.id);
}

/** The sentinel the bar carries when the human face is the one acting. It is not
 *  a handle and must never be sent as one — `dispatchEnvelope` puts it in `as:`.
 *  The colon is what makes it safe: a resident handle is kebab-case and cannot
 *  contain one, so this can never collide with somebody's name. */
export const HUMAN_ACTOR = "human:self";

// ── dispatch ────────────────────────────────────────────────────────────────

/**
 * The envelope for `POST /api/world/apex`, which is the same `{do, args}` shape
 * the MCP `world` verb takes — one door, two skins (office server.mjs, 2026-08-17:
 * "the same worldApex the MCP door dispatches, so a browser … performs law-minted
 * actions through the identical do:+args: envelope").
 *
 * INTEGRATION CONTRACT (site-defined 2026-08-26, awaiting the core lane).
 * Acting as the human themselves needs one top-level word, and it cannot be
 * `handle:` — that field names "which of YOUR residents acts" and a human is not
 * one of them, so overloading it would make a human's act indistinguishable from
 * a resident's in the record. The minimal addition:
 *
 *     { do, args, as: "human" }     // omit `as` for the ordinary resident act
 *
 * and the answer's `standpoint.stance` becomes `"embodied-human"` beside today's
 * `"spectator"` and `"embodied"` (world-apex.mjs computes exactly those two, and
 * its own comment says "v1 knows one actor").
 *
 * A door that does not know `as:` will bounce it BY NAME — the apex validator
 * refuses unknown top-level fields — which is a loud failure rather than a human
 * act quietly recorded as a resident's. That is the right way for this to break.
 *
 * A HUMAN'S ACT CARRIES BOTH WORDS (2026-08-27), and the reason is that they
 * answer two different questions. `as: "human"` says WHO IS ACTING. `handle` says
 * which of your residents' standing this key is oriented from — and a key in this
 * town holds many residents, so without it the act is refused at ORIENT, before
 * the human seam is reached at all. The act then looks refused when it was only
 * unaddressed, which is the same defect that kept the boot read from ever
 * answering (see world-cockpit-door.mjs).
 *
 * This reverses the shape written here on 2026-08-26, and the earlier reading is
 * kept because it was not wrong, only incomplete: "handle names which of YOUR
 * residents acts, and a human is not one of them, so overloading it would make a
 * human's act indistinguishable from a resident's in the record." Still true —
 * which is why `as` remains the field that says a person acted, and `handle` is
 * never asked to carry that meaning. It carries the standpoint, not the actor.
 */
export function dispatchEnvelope({ action, args, acting, handle }) {
  const env = { do: String(action), args: args && typeof args === "object" ? args : {} };
  if (acting === HUMAN_ACTOR) {
    env.as = "human";
    if (typeof handle === "string" && handle) env.handle = handle;
  } else if (typeof acting === "string" && acting) {
    env.handle = acting;
  }
  return env;
}

/** A bounce, read for the reader. The door's bounces carry `defect` and `hint`
 *  and both are worth showing — the hint is usually the door telling you exactly
 *  what to do instead, and swallowing it is how a surface becomes a wall. */
export function readBounce(body, status) {
  const defect = typeof body?.defect === "string" ? body.defect : null;
  const hint = typeof body?.hint === "string" ? body.hint : null;
  const terms = body?.terms && typeof body.terms === "object" ? body.terms : null;
  return {
    status: status ?? null,
    defect: defect ?? "the door did not say what went wrong",
    hint,
    terms,
    // A door that declares a counter-edge answers the FIRST call with its terms
    // and performs nothing — "Call once without it to READ the terms; call again
    // with it to cross" (the `enter` card's own `accept` field). So terms coming
    // back is a question, not a failure.
    needsAccept: Boolean(terms) || /\baccept\b/.test(String(hint ?? "")),
  };
}

/**
 * The terms, as rows, in the door's own keys.
 *
 * Generic on purpose — one row per key, whatever keys arrive. The terms block is
 * the door's to shape ("the granting class (`binds`), the defining class with its
 * dials (`means`), any schedule you are consenting to, and the charter articles
 * overhead"), and a site-side template naming those four would go quietly blank
 * the day a fifth is added, which is the worst way for a legal disclosure to fail.
 */
export function termsRows(terms) {
  if (!terms || typeof terms !== "object" || Array.isArray(terms)) return [];
  return Object.entries(terms).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

/**
 * The terms for one act, out of a `read:` answer.
 *
 * `read: <action>` is the act's shadow: it performs nothing — "A read never
 * performs", the apex's own words — and its answer carries the act's full card
 * WITH the terms that would bind it. That is how a tooltip can show the terms
 * before anything is done, which is the whole of "you cannot be bound by law you
 * were not shown at the door". The bare standpoint read does not carry them.
 */
export function termsFromRead(body) {
  const t = body?.card?.terms;
  return t && typeof t === "object" ? t : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ENCOUNTER — turn order, dice, the two spaces, and what is on the floor
//
// Founder-ruled 2026-08-26, after this file's first draft: the dungeon is proper
// turn-based with dice, in TWO spaces. None of it exists in the door yet, so
// everything below is a SITE-DEFINED CONTRACT — built to, documented here, and
// waiting for the core lane to reconcile. Every one of them is additive and
// absent-means-off, so a door that never grows them leaves this half inert.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The encounter, if one is running.
 *
 * CONTRACT: `answer.encounter`, absent when nothing is being fought.
 *
 *   encounter = {
 *     id,                       // the ground the fight is in
 *     round: 3,
 *     turn: "vermillion",       // whose turn it is — matches an order entry's id
 *     order: [                  // the wheel, in initiative order, hostiles included
 *       { id, kind: "resident" | "human" | "creature",
 *         label, initiative: 17,
 *         down: false,          // downed-not-dead: skipped, acts refused
 *         hp: { now, max },     // optional
 *         joined_round: 3,      // optional — a late joiner, appended
 *         you: true }           // optional — this is the caller
 *     ]
 *   }
 *
 * The wheel is rendered in the ORDER THE DOOR SENT. It is not re-sorted here:
 * initiative order is the encounter's own record, ties are its business, and a
 * late joiner appends by the founder's ruling — a client that re-sorted by the
 * `initiative` number would silently undo that append and put the newcomer in
 * the middle of a round that had already passed them.
 */
export function encounterOf(answer) {
  const e = answer?.encounter;
  if (!e || typeof e !== "object") return null;
  const order = Array.isArray(e.order) ? e.order.filter((a) => a && typeof a === "object") : [];
  if (!order.length) return null;
  return {
    id: typeof e.id === "string" ? e.id : null,
    round: Number.isFinite(e.round) ? e.round : null,
    turn: typeof e.turn === "string" ? e.turn : null,
    order: order.map((a) => ({
      id: typeof a.id === "string" ? a.id : null,
      kind: a.kind === "creature" || a.kind === "human" ? a.kind : "resident",
      label: typeof a.label === "string" && a.label ? a.label : (typeof a.id === "string" ? a.id : "?"),
      initiative: Number.isFinite(a.initiative) ? a.initiative : null,
      down: a.down === true,
      hp: a.hp && Number.isFinite(a.hp.now) && Number.isFinite(a.hp.max) ? { now: a.hp.now, max: a.hp.max } : null,
      joinedRound: Number.isFinite(a.joined_round) ? a.joined_round : null,
      you: a.you === true,
      current: typeof e.turn === "string" && a.id === e.turn,
    })),
  };
}

/**
 * WHAT THIS HAND IS HOLDING, and what it adds.
 *
 * CONTRACT (office lane bday-law, in flight 2026-08-29):
 *
 *     encounter_detail.hands[<who>].weapon = { thing, bonus, for? }
 *
 * `thing` is the mark id, `bonus` the number it adds. The office already builds
 * exactly this shape internally — `weaponInHand` answers
 * `{ thing, bonus, says }` off the held grant — so the field is that answer
 * carried out to a caller rather than a new idea.
 *
 * ⚑ `for` IS THE HALF THIS FILE NEEDS AND DOES NOT YET HAVE. A weapon augments
 * ONE act: the office finds it by looking for the held grant whose own entry
 * names that act, so the record knows which, and the site cannot re-derive it
 * without keeping the verb list this file is forbidden to keep. Two of the
 * room's acts state damage; attaching the bonus to both would be a claim about
 * the other one that the record does not make. So `for` is read when the door
 * sends it, and the CALLER supplies a fallback otherwise — which is why this
 * returns the door's word or null rather than guessing. Asked for; see the
 * mount's own note beside the stopgap.
 *
 * WHOSE HAND. `hands` is keyed by the door's `who`. Acting as a resident that
 * is the handle; acting as the household's human it is the human's own row on
 * the wheel, found by KIND for the same reason `yourTurnRow` finds it that way —
 * the office derives the hand's label itself and a second spelling here would
 * be a second thing to keep in step.
 */
export function weaponFor(answer, acting = null) {
  const hands = answer?.encounter_detail?.hands;
  if (!hands || typeof hands !== "object") return null;
  const who = acting === HUMAN_ACTOR
    ? encounterOf(answer)?.order.find((a) => a.kind === "human")?.id ?? null
    : acting;
  const w = who ? hands[who]?.weapon : null;
  if (!w || typeof w !== "object") return null;
  const thing = typeof w.thing === "string" && w.thing ? w.thing : null;
  const bonus = Number(w.bonus);
  if (!thing || !Number.isFinite(bonus) || bonus === 0) return null;
  return {
    thing,
    bonus,
    // named the way every id in this world is read — the leaf, deslugged
    label: thing.split("/").pop().replace(/-/g, " "),
    for: typeof w.for === "string" && w.for ? w.for : (typeof w.action === "string" && w.action ? w.action : null),
    says: typeof w.says === "string" && w.says ? w.says : null,
  };
}

/** The caller's own row on the wheel, or null. */
export function yourTurnRow(encounter, acting = null) {
  // ⚑ WHOSE ROW IS "YOU" DEPENDS ON WHO IS ACTING, and until this took an
  // argument it was always the resident's. The door answers a RESIDENT's
  // standpoint and marks that resident `you`, which is right for the read — but
  // a reader acting as their household's human holds their OWN row on the
  // wheel, under their own hand, and the resident's row is somebody else's.
  //
  // What that cost, seen live: the wheel came round to the human, the cap said
  // so ("round 7 · human-of-starforge is acting"), and the bar greyed itself out
  // with "it is human-of-starforge's turn" — refusing the reader on the grounds
  // that it was their turn. The one row the door marks `you` was rei's, and rei
  // was not up.
  //
  // The human's row is found by KIND rather than by name: the office derives the
  // hand's label itself (humanHandFor) and the site has no business spelling it
  // a second way. One human per household is the class's own shape, so the kind
  // identifies the row without a name to keep in step.
  if (acting === HUMAN_ACTOR) return encounter?.order.find((a) => a.kind === "human") ?? null;
  return encounter?.order.find((a) => a.you) ?? null;
}

/**
 * Why this standpoint may not act right now — the door's words, or ours.
 *
 * CONTRACT: `answer.standpoint.acting_blocked = { reason: "…" }`, absent when the
 * standpoint may act. ONE field for every cause, because the causes are the
 * world's to enumerate and will grow (not your turn, you are down, and whatever
 * the encounter rules add next); a site that switched on a closed list of causes
 * would go quiet the first time a new one appeared.
 *
 * When the door has not said it, this derives the two the founder ruled tonight
 * from the encounter itself — and says so, so a reader can tell a quoted reason
 * from a deduced one.
 *
 * IT NEVER HIDES A SLOT. The founder's ruling: disabled with the reason, never
 * hidden, so the grammar stays legible. A bar that empties out when it is not
 * your turn teaches a reader that the acts went away.
 */
export function blockedReason(answer, { acting = null } = {}) {
  // ⚑ THE DOOR'S BLOCK IS ABOUT THE RESIDENT IT ANSWERED FOR. The apex reads a
  // named resident's standpoint and `acting_blocked` is a fact about THAT
  // hand's standing — so when the reader is acting as their household's human
  // it is a true sentence about somebody else, and taking it was how the bar
  // came to refuse the human with their own name in the reason ("it is
  // human-of-starforge's turn", while the human was the one holding the wheel).
  //
  // Acting as yourself, the derivation below is the one that knows whose row is
  // yours. Nothing is being second-guessed: the door was asked a different
  // question and gave a correct answer to it.
  const doorSaid = answer?.standpoint?.acting_blocked;
  // ⚑ A BLOCK HAS TWO PARTS AND THEY HAVE DIFFERENT SCOPES — found live
  // 2026-08-29, acting as the household's human in the vault.
  //
  // `reason` and `whose_turn` are about THE RESIDENT THE DOOR ANSWERED FOR, which
  // is why the human seam discards them below and derives its own. `gates` is
  // not: it is the ground's own law about WHICH ACTS a wheel holds ("the wheel
  // gates this ground's ARENA verbs, and nothing else"), and that sentence is
  // just as true whoever is standing there. Throwing it away with the reason put
  // the human straight back into the bug the field was added to fix — the whole
  // bar cold, walking refused, in the one seat the founder actually plays from.
  //
  // So the narrowing is lifted out first and survives every branch below,
  // including the derived ones. A derivation still invents no list of its own;
  // it simply keeps the one the door published.
  const doorGates = Array.isArray(doorSaid?.gates)
    ? doorSaid.gates.filter((g) => typeof g === "string" && g)
    : null;
  const narrowing = doorGates?.length ? doorGates : null;
  const said = acting === HUMAN_ACTOR ? null : doorSaid;
  if (said && typeof said.reason === "string" && said.reason.trim()) {
    // ⚑ WHAT IS BLOCKED, BY NAME (office lane bday-law, 2026-08-29).
    //
    // THE DOOR NEVER GATED WALKING OR SPEAKING. Its act path refuses anything
    // that is not one of this ground's own fight verbs long before the wheel is
    // consulted, so a walk mid-fight has always gone through. What actually
    // froze the founder in the middle of the party was THIS SURFACE: it saw
    // `acting_blocked`, read it as "you may not act", and greyed the whole bar
    // — including the seats the door would have honoured. He could not move,
    // and the reason he could not move was a page, not a law.
    //
    // `gates` is the door saying which acts it means, in a field rather than in
    // prose so a page can act on it. Grey exactly those; leave every other seat
    // live. A door that sends the key but no list has narrowed nothing, which is
    // what `null` means below and is exactly today's behaviour.
    return { reason: said.reason, from: "the door", gates: narrowing };
  }
  const enc = encounterOf(answer);
  if (!enc) return null;
  const you = yourTurnRow(enc, acting);
  // ⚑ THE DERIVED BRANCHES INVENT NO LIST, and they do not need to: they carry
  // the door's, through `narrowing` above. The distinction is worth keeping
  // straight — a derivation is entitled to say WHY it thinks you are held up
  // (it can read the wheel) and is not entitled to decide WHICH ACTS a ground
  // gates, because that is the ground's own law and this file has no verb list
  // to name them with. Where the door published one, the derived reason wears
  // it. Where it did not, `narrowing` is null and every afforded seat cools,
  // which is exactly what this surface did before the field existed.
  if (you?.down) return { reason: "you are down — an ally can lift you", from: "derived", gates: narrowing };
  if (enc.turn && you && !you.current) {
    // ⚑ A CREATURE'S TURN IS NOT A WAIT — IT IS WHAT YOUR ACT RESOLVES.
    //
    // The door's law, quoted: "Hostile turns are resolved by the act that ends
    // a player's turn, in the same handling, until the wheel reaches a player
    // again. There is no daemon and no ticker: the duet is the event loop."
    // The door drives every due creature turn BEFORE it judges the caller, so a
    // reader whose only obstacle is a creature is not blocked at all — their
    // act is the mechanism.
    //
    // Greying the bar on that word is what made the room read as dead. The
    // founder, mid-fight: "I also tried striking and it's just stuck now? like
    // when does the cake take its turn?" It takes it when he acts, and the
    // surface had disabled the acting.
    //
    // So the wait is measured past the creatures, to the row the door will
    // really judge against. A HAND ahead of you still blocks — a person acts on
    // their own clock and nothing here drives them — which is the distinction
    // that keeps this from being "stop gating".
    //
    // The office says the same thing on the read half (`actingBlocked`); this
    // is the derivation for a door that has not spoken, and the two agree on
    // purpose.
    const order = enc.order ?? [];
    let i = order.findIndex((a) => a.current);
    let guard = 0;
    while (i >= 0 && order[i] && (order[i].kind === "creature" || order[i].down)
           && guard++ < order.length * 2) i = (i + 1) % order.length;
    const whose = i >= 0 ? order[i] : null;
    if (!whose || whose.id === you.id) return null;
    return { reason: `it is ${whose.label ?? whose.id}'s turn`, from: "derived", gates: narrowing };
  }
  return null;
}

/**
 * The rolls an act's answer carried.
 *
 * CONTRACT: `roll` (one) or `rolls` (several) on the answer to a `do:`, each:
 *
 *   { die: "d20", faces: 20, value: 17, modifier: 3, total: 20,
 *     crit: true, for: "<the act>", against: "<whoever it was aimed at>" }
 *
 * Both spellings are accepted because one act plainly throws once (a blow) and
 * another plainly throws several (initiative for a room), and guessing which
 * spelling the core lane picks would be a coin-flip that fails silently.
 *
 * NOTE FOR THE NEXT EDITOR: this file must not contain the dungeon's verb names,
 * even in prose — a falsifier reads this source for them, because the whole
 * design is that the bar has no verb list. Say "the act", not the act's name.
 *
 * `crit` is READ, not computed. A crit is a rule of the encounter — natural max,
 * or max-after-modifiers, or something the class mark says — and a client that
 * decided it by comparing value to faces would be inventing law and would be
 * wrong the first time a class ruled otherwise. When the door says nothing, the
 * throw simply is not a crit, and `atMax` is offered separately as an honest
 * observation about the number rather than a claim about the rules.
 */
export function rollsFrom(body) {
  const raw = Array.isArray(body?.rolls) ? body.rolls : body?.roll ? [body.roll] : [];
  return raw
    .filter((r) => r && typeof r === "object" && Number.isFinite(r.value))
    .map((r) => {
      const faces = Number.isFinite(r.faces) ? r.faces : dieFaces(r.die);
      const modifier = Number.isFinite(r.modifier) ? r.modifier : 0;
      return {
        die: typeof r.die === "string" ? r.die : faces ? `d${faces}` : null,
        faces,
        value: r.value,
        modifier,
        total: Number.isFinite(r.total) ? r.total : r.value + modifier,
        crit: r.crit === true,
        atMax: Boolean(faces) && r.value === faces,
        for: typeof r.for === "string" ? r.for : null,
        against: typeof r.against === "string" ? r.against : null,
      };
    });
}

function dieFaces(die) {
  const m = /^d(\d+)$/i.exec(String(die ?? ""));
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * Which of the dungeon's two spaces this is.
 *
 * CONTRACT: `standpoint.portal.space = "antechamber" | "arena"`.
 *
 * The founder ruled the dungeon as two: an antechamber — free-roam, social,
 * where a weapon is picked up and spectators stand — and a boss room behind an
 * inner door where crossing joins the fight. They read differently and they
 * should FEEL different, so the site needs the word.
 *
 * Absent falls back to the ANTECHAMBER, deliberately: it is the calm one, and a
 * page that guessed "arena" would dress a social room as a fight. An encounter
 * being under way is not used to infer the space either — a fight is a thing that
 * happens in a room, not the room itself, and the wipe rule returns everyone to
 * the antechamber with the boss restored, which is exactly the moment an
 * inference would be wrong.
 */
export const SPACES = Object.freeze(["antechamber", "arena"]);

export function spaceOf(answer) {
  const s = answer?.standpoint?.portal?.space;
  return SPACES.includes(s) ? s : "antechamber";
}

/**
 * Things lying loose on the ground, from the nearby marks.
 *
 * CONTRACT: `nearby[].loose = true` on a thing that is on the floor rather than
 * in a hand — which is what a downed actor's dropped weapon becomes. Everything
 * else about it is what `nearby` already carries, including `at`, so it can be
 * drawn where it actually fell rather than in a list somewhere.
 */
export function looseThings(answer) {
  const nearby = Array.isArray(answer?.nearby) ? answer.nearby : [];
  return nearby
    .filter((m) => m?.loose === true && m.at && Number.isFinite(m.at.x) && Number.isFinite(m.at.y))
    .map((m) => ({
      id: typeof m.id === "string" ? m.id : null,
      at: { x: m.at.x, y: m.at.y },
      by: typeof m.by === "string" ? m.by : (typeof m.id === "string" ? m.id.split("/")[0] : null),
      label: typeof m.label === "string" && m.label
        ? m.label
        : String(m.id ?? "").split("/").pop()?.replace(/-/g, " ") || "something",
      dropped_by: typeof m.dropped_by === "string" ? m.dropped_by : null,
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE FORM CAN FILL IN FOR YOU
//
// Founder-ruled 2026-08-28, out of the live rehearsal: "everything I can do via
// the ui buttons, I have to type in like filling an mcp form." The ruling has two
// halves — a chat-shaped act should feel like chat (below), and a field whose
// value is implied by where you are standing should arrive already filled.
//
// NOTHING HERE KNOWS A VERB'S NAME, and that constraint is the file's oldest one:
// the bar renders whatever the door listed, so a table keyed on the fight's act
// names would be the site re-deciding what an act means. Everything below is
// keyed on the SHAPE of the card the door sent and on values the ANSWER named.
// (The falsifier that reads this source for those names caught the first draft of
// this very comment, which is the check doing exactly its job.)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What stands against this standpoint, if the door named one.
 *
 * CONTRACT: `answer.encounter_detail.adversary = { id, hp, of, body }` — the
 * office's `publicState` block (arena.mjs). It carries NO position, deliberately
 * or not; `adversaryPlacement` below joins it to `nearby` for that, which is the
 * only route the answer offers.
 */
export function adversaryOf(answer) {
  const a = answer?.encounter_detail?.adversary;
  if (!a || typeof a !== "object") return null;
  const id = typeof a.id === "string" && a.id ? a.id : null;
  if (!id) return null;
  return {
    id,
    hp: Number.isFinite(a.hp) ? a.hp : null,
    of: Number.isFinite(a.of) ? a.of : null,
    body: typeof a.body === "string" ? a.body : null,
    // named the way every id in this world is read — the leaf, deslugged
    label: id.split("/").pop().replace(/-/g, " "),
  };
}

/**
 * Every value the ANSWER names that an act could plausibly be aimed at, in the
 * order a reader would reach for them.
 *
 * All three sources are the door's own words: what stands against you, who is
 * down beside you, and what is lying on the floor. Nothing is invented and
 * nothing is remembered between reads — walk away and the list empties itself.
 */
export function actCandidates(answer) {
  const out = [];
  const seen = new Set();
  const add = (value, label, why) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({ value, label: label || value, why });
  };
  const adv = adversaryOf(answer);
  if (adv) add(adv.id, adv.label, "what stands against you here");
  for (const a of encounterOf(answer)?.order ?? []) {
    if (a.down && !a.you && a.id) add(a.id, a.label, "down — an ally can lift them");
  }
  for (const t of looseThings(answer)) add(t.id, t.label, "on the ground");
  return out;
}

/**
 * The one field of this act that holds PROSE, or null.
 *
 * Read off the door's own stated limit rather than off a field name: a field the
 * door says may hold 150 characters or more is one a reader writes a sentence
 * into (`wantsTextarea`, and MULTILINE_AT's reasoning above). That is what makes
 * this verb-blind — the act that speaks is whichever act the door described as
 * taking a sentence.
 */
export function chatField(card) {
  return (card?.fields ?? []).find((f) => wantsTextarea(f)) ?? null;
}

/**
 * Is this act CHAT-SHAPED — one line of prose and nothing else a reader must
 * supply?
 *
 * The test is the card's, not a name: it holds a prose field, and every other
 * field on it is optional. So the whole act is "type the sentence and send",
 * which is what a chat line is. An act that also demands a recipient or a slug
 * is a form, and stays one — the ruling was about the SAY act feeling like
 * typing into a chat, not about abolishing forms.
 */
export function chatShaped(card) {
  const prose = chatField(card);
  if (!prose) return false;
  return (card?.fields ?? []).every((f) => f === prose || !f.required);
}

/**
 * What arrives already filled in, as `{ fieldName: value }`.
 *
 * DELIBERATELY NARROW, and the narrowness is the honesty. It fills a field only
 * when there is exactly ONE slot to fill and exactly ONE value the answer names
 * for it — because then there is no choice being made, and the site is not
 * quietly deciding what an act is aimed at. Two candidates, or two open fields,
 * and it fills nothing and offers the candidates as suggestions instead
 * (`actCandidates`, rendered as a datalist), which puts the choice back where it
 * belongs.
 *
 * A PROSE FIELD IS NEVER PREFILLED: what you say is yours to write, and a
 * sentence the site put in your mouth is the one thing this surface must not do.
 *
 * NOTE ON THE ACTS THAT NEED NOTHING. Several of the fight's acts already take
 * zero typing without any help from here, because the door made every one of
 * their fields optional and finds its own target — so their form opens with
 * nothing to fill and plain ENTER sends it. That is the door's doing, not this
 * function's, and it is why this can afford to be so narrow.
 */
export function prefillFor(card, answer) {
  const out = {};
  if (!card) return out;
  const open = card.fields.filter((f) =>
    !f.enum?.length && f.type !== "number" && f.type !== "boolean" && !wantsTextarea(f));
  if (open.length !== 1) return out;
  const field = open[0];

  // ⚑ A PLACE IS NOT A TARGET (founder-caught 2026-08-29, playing the dungeon).
  //
  // This offered the one candidate to whatever single open field an act had,
  // and the candidate in a fight is the thing standing in front of you. So the
  // acts that take a GROUND opened with the adversary's id in them: the plate
  // for stepping out of the vault read "the unlit cake", which if sent would
  // have asked to step out of a cake. It had to be retyped by hand twice in one
  // session before the pattern was named.
  //
  // WHAT TELLS THEM APART IS THE DOOR'S OWN SENTENCE, not a list of verbs kept
  // here — this file has none and gains none, which its own falsifier enforces
  // by grepping this source for them. (That is also why the door's sentences
  // are described below rather than quoted: two of them name acts in passing,
  // and a verbatim quote would smuggle the list in as prose. It caught this
  // comment on the first run, which is the falsifier working.)
  //
  // A target field says the value is who or what the act is AIMED AT. A place
  // field says what you are stepping out of, or the mark to enter, or the
  // ground to walk to — a relation between you and somewhere, never a thing to
  // hit.
  //
  // A field about somewhere you stand relative to takes no target. Where the
  // door says you are stepping OUT of it, the answer is knowable and worth
  // filling — it is the ground you are in, which the standpoint already names.
  // Anywhere else the honest prefill is none: the whole point of entering or
  // walking is that the destination is the reader's choice, and this function's
  // own rule is that a prefill happens only where there is no choice to make.
  // ⚑ AND A PLACE FIELD IS LEFT EMPTY, INCLUDING THE ONE THAT LOOKED KNOWABLE.
  //
  // The first pass filled a stepping-out field with the standpoint's own
  // ground, on the reasoning that the answer was knowable. Driven live, the
  // door refused it: "rei is not within 'the-town/the-candle-vault' — there is
  // nothing to step out of", from a standpoint whose own portal is that vault.
  // The door's "within" for crossing back out is the ENTRY it holds, not the
  // extent you are standing inside, and those are two different facts about the
  // same person. The site does not hold the first one and should not be
  // guessing at it.
  //
  // The door already published the right answer in the field's own words: OMIT
  // it and the innermost one is used. So the honest prefill for every place
  // field is none, and the act sends what the door asked for.
  if (GROUND_SHAPED.test(field.description ?? "")) return out;

  const candidates = actCandidates(answer);
  if (candidates.length !== 1) return out;
  out[field.name] = candidates[0].value;
  return out;
}

/** A field the door describes as naming somewhere you stand relative to, rather
 *  than something you aim at. The door's words, read — never a verb list. */
const GROUND_SHAPED = /\b(?:step(?:ping)? (?:in|out)|out of|to enter|walk(?:ing)? to|you are within|stand inside)\b/i;
/** …and the one such relation whose answer the standpoint already knows. */
const LEAVING = /\bout of\b/i;

// ═══════════════════════════════════════════════════════════════════════════
// AIMING — the act is chosen first, and then what it is aimed at
//
// FOUNDER'S RULING 2026-08-29, playing the dungeon: you press the act you mean,
// and then the thing it can be aimed at lights up and is clickable. He called
// the order it replaces nonsensical — clicking the thing first, and being shown
// a whole menu of the acts you could take towards it.
//
// ⚑ HIS SENTENCE IS PARAPHRASED HERE, WHICH IS DELIBERATE AND IS A COST. He
// named two acts in it, and this file's own standing note says why they cannot
// be written down: "this file must not contain the dungeon's verb names, even
// in prose — a falsifier reads this source for them, because the whole design is
// that the bar has no verb list." A verbatim quote would smuggle the list in
// dressed as evidence. The two acts he named are the ones the arena grants that
// take a target, and the code below reaches them without knowing either name.
//
// WHAT WAS WRONG WITH THE OLD ORDER, in his words and in the record's: the
// thing standing in front of you in a fight is ONE NODE wearing two readings —
// a mark of the world, and the adversary of the encounter. The object-first
// menu offered every act the ground affords against it, pairing verbs with a
// thing they mean nothing about, because a surface with no verb list cannot
// know which pairings are sense. Verb-first never has to know: the act is
// named by the reader, and the only question left is which of the things the
// ANSWER placed is being pointed at.
//
// NOTHING HERE NAMES AN ACT, and it is the same discipline as everywhere else
// in this file. An act is aimable because of the sentence the DOOR wrote under
// its own field — see `aimField`.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A field the door describes as IDENTIFYING something already in the world —
 * a mark id, or a resident's handle — as opposed to a value the caller
 * composes, or a place they are moving relative to.
 *
 * Read off the live door's own words, 2026-08-29. The arena's shared field says
 * "who or what this act is aimed at — a handle for … a mark id for …"; the
 * attaching acts say "the thing's mark id, <by>/<slug>". Both are pointing at
 * something that exists. A slug field ("the mark's leaf name — kebab-case,
 * unique among your own marks") is a name being MINTED and matches none of it,
 * which is why the claiming act does not arm a target.
 */
const AIMED_AT = /\b(?:aimed at|who or what|mark id|a handle\b)/i;

/**
 * The one field this act is aimed THROUGH, or null.
 *
 * The same narrowness `prefillFor` is built on, and for the same reason: one
 * open slot, or the act is a form and the reader answers it. Two open fields
 * means the act is asking two questions and a click on the map can only answer
 * one of them.
 */
export function aimField(card) {
  const open = (card?.fields ?? []).filter((f) =>
    !f.enum?.length && f.type !== "number" && f.type !== "boolean" && !wantsTextarea(f));
  if (open.length !== 1) return null;
  const f = open[0];
  if (GROUND_SHAPED.test(f.description ?? "")) return null;
  return AIMED_AT.test(f.description ?? "") ? f : null;
}

/** Can this seat be armed — the ground affords it, the clock allows it, the
 *  door gave it somewhere to aim, and the answer names something to aim at. */
export function aimable(slot, answer) {
  if (!slot?.afforded || !slot.enabled || !slot.card) return false;
  if (!aimField(slot.card)) return false;
  return aimTargets(answer).length > 0;
}

/**
 * What an armed act may be aimed at, and where each one stands.
 *
 * The candidates are `actCandidates`' — what stands against you, who is down
 * beside you, what is lying on the floor, all three the door's own words. What
 * is added here is the POSITION, because a target that highlights has to
 * highlight somewhere.
 *
 * A TARGET THE ANSWER CANNOT PLACE IS STILL A TARGET. `nearby` is a budgeted
 * field of view and `present` is banded, so a downed ally can be perfectly real
 * and carry no coordinate this read. Dropping them would make the lifting act
 * unreachable exactly when someone is down and out of frame — so an unplaced
 * target keeps its row and is offered by name instead. `at` is null and the
 * caller draws no ring; nothing here pretends to a coordinate it does not hold,
 * which is the same rule `adversaryPlacement` already follows.
 */
export function aimTargets(answer) {
  const nearby = Array.isArray(answer?.nearby) ? answer.nearby : [];
  const present = Array.isArray(answer?.present) ? answer.present : [];
  const placed = (id) => {
    const m = nearby.find((n) => n?.id === id && n.at && Number.isFinite(n.at.x) && Number.isFinite(n.at.y));
    if (m) return { x: m.at.x, y: m.at.y };
    // `present` is the who-is-about block and its rows are the presence read's,
    // not the fold's — it may carry a bare x/y or an `at`, and it may carry
    // neither. Both spellings are read; neither is required.
    const p = present.find((n) => (n?.handle ?? n?.id) === id);
    const at = p?.at ?? p;
    return at && Number.isFinite(at.x) && Number.isFinite(at.y) ? { x: at.x, y: at.y } : null;
  };
  return actCandidates(answer).map((c) => ({ ...c, at: placed(c.value) }));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE FOLD — what stays on the row, and what goes behind the tray
//
// FOUNDER'S RULING 2026-08-29: "too many buttons". Measured on his own screen
// the night before: seventeen afforded acts wanting about 1900px against a
// 1377px scrollport. The row's standing answer was to scroll and say so, and
// the ruling is that scrolling is not an answer — the acts of the room you are
// standing in should be on the row, and the rest should be one press away.
//
// WHAT DECIDES A SEAT IS THE CHANNEL THE DOOR OPENED IT ON, not a list of
// fight verbs. `channel: "ground"` is the door saying this act belongs to the
// ground you are standing on; everything else travelled here with you and is
// as available in the vault as it is in the town square. So the room's own
// acts hold the row, and the ones you carry everywhere fold — which is the
// same taxonomy the HERE divider has always drawn, now load-bearing.
//
// `keep`, `hide` and `gate` are the CALLER'S, and they are the deliberate
// seam. They are the places a decision is keyed on a name, and this file does
// not hold names — the surface that draws pictures for verbs already keeps a
// table beside its pictures, and that is where a ruling about particular acts
// belongs. Called with none of them this is a pure channel split.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {{fixed:Array,tray:Array}} bar   what `barSlots` returned
 * @param {object} o
 * @param {string[]} o.keep   ambient acts that hold a seat anyway
 * @param {string[]} o.hide   acts not rendered at all, here
 * @param {Object<string,string>} o.gate   act → the phase that must be running
 * @param {string|null} o.phase   the phase the door says is running
 * @returns {{shown:Array, folded:Array}}
 */
export function barFold(bar, { keep = [], hide = [], gate = null, phase = null } = {}) {
  const kept = new Set(keep);
  const hidden = new Set(hide);
  const shown = [], folded = [];
  for (const slot of [...(bar?.fixed ?? []), ...(bar?.tray ?? [])]) {
    if (hidden.has(slot.action)) continue;
    // (the keys are reassigned below, once the row is known)
    // A GATED ACT IS ABSENT, NOT GREYED, and that is a departure from this
    // surface's own standing rule ("disabled, never hidden") made on the
    // founder's word. The rule is about acts the ground affords and the clock
    // withholds — a seat that will come back to you, and whose law you can read
    // while you wait. An act whose whole precondition is a phase the room has
    // not reached is not being withheld from you; it is not part of the room
    // yet. The office is stopping offering it at the same time (lane bday-law),
    // so this is the surface agreeing with the door rather than overruling it.
    if (gate && Object.prototype.hasOwnProperty.call(gate, slot.action) && gate[slot.action] !== phase) continue;
    const ground = slot.card?.channel === "ground" || slot.card?.via === "ground";
    (ground || kept.has(slot.action) ? shown : folded).push(slot);
  }
  // ⚑ THE NUMBERS ARE THE ROW'S, AND THEY ARE ASSIGNED HERE.
  //
  // `barSlots` numbers every act the answer carried, in the door's order, which
  // was right while every one of them held a seat. With a fold in front of it
  // the printed numbers and the row stopped agreeing: seen in the shot, a row of
  // six seats wearing 1, 2, 7, 8, 9 — the digits of the acts they would have
  // been before four of them folded away. A reader counting along the row and a
  // reader reading the corner of a seat would have pressed different acts.
  //
  // So the row renumbers itself 1..MAX_KEYED and the folded keep no key at all:
  // the tray is reached by name, which is what a list is for, and a number that
  // opens nothing visible is worse than no number.
  let key = 0;
  return {
    shown: shown.map((s) => ({ ...s, key: ++key <= MAX_KEYED ? key : null })),
    folded: folded.map((s) => ({ ...s, key: null })),
  };
}

// ── the walk grid ───────────────────────────────────────────────────────────

/**
 * The stride this ground declares, in metres — or null, which is most grounds.
 *
 * THE FIELD, exactly: `standpoint.portal.walk_min_step`. FLAT, one key, in the
 * same portal block that carries id, value, by, space, keeps_wheel and body.
 * ABSENT — not null and not zero — where the ground has said nothing, for the
 * same reason `body` and `acting_blocked` are absent rather than empty: a key
 * that is always there teaches a reader to test its VALUE, and a stride of
 * null reads as "this ground has a stride and it is nothing".
 *
 * ⚑ NULL IS THE ANSWER FOR AN UNDECLARED GROUND, AND A FLOOR OF 1 WAS A BUG.
 *
 * The first version of this read four guessed paths — none of them the real one
 * — and answered ONE METRE when they all missed, which was every ground in the
 * town. Its own comment claimed that left walking "byte-identical", and that
 * sentence was false in the line underneath it: the site was quietly snapping
 * every click-to-walk in the world onto whole metres, which is not something
 * the town does. The office refused the same temptation on its own side and
 * wrote down why — "a floor of 1 here would make every ground in the town start
 * snapping walks to whole metres … 'the default is 1' would have been a
 * town-wide re-cut of the walk wearing a per-ground dial's clothes." It is the
 * same mistake on the other side of the wire, and the correction is theirs.
 *
 * AND THE OFFICE DOES NO ROUNDING FOR A GROUND THAT DECLARED NOTHING, so a
 * caller must not send a coordinate believing it will be tidied. Where a ground
 * DOES declare one the office snaps the destination itself, on the same
 * lattice — round(v/step)*step anchored at the world origin — so a page that
 * snaps before sending and a page that does not both land on the same square.
 * Snapping here is for the reader's benefit, not the record's.
 */
export function walkStep(answer) {
  const v = answer?.standpoint?.portal?.walk_min_step;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A point in world metres on the ground's own lattice.
 *
 * A step of null — the ordinary case — hands the point back UNCHANGED. This is
 * the half that makes the dial a per-ground dial rather than a new law about
 * walking everywhere; see the note above for what it cost to learn.
 */
export function snapPoint(m, step) {
  if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
  const s = Number(step);
  if (!Number.isFinite(s) || s <= 0) return { x: m.x, y: m.y };
  // rounded through the step and back, so the answer is a multiple of it rather
  // than a number that merely looks tidier
  return { x: Math.round(m.x / s) * s, y: Math.round(m.y / s) * s };
}

// ── the consent sheet ───────────────────────────────────────────────────────

/**
 * The terms, split into what a player reads at the door and what a lawyer
 * reads afterwards.
 *
 * FOUNDER'S RULING 2026-08-29: the crossing sheet "dumps every field, vague and
 * verbose" — the door's terms carry `articles` and `quoted`, which come back as
 * whole mark bodies, and the two or three facts a player actually needs before
 * stepping through are buried under them.
 *
 * NOTHING IS DROPPED, and that is not negotiable on this surface: "you cannot
 * be bound by law you were not shown at the door" is the sentence the shadow
 * read exists for. Both halves are rendered; only one of them is open.
 *
 * SPLIT ON LENGTH, NOT ON A LIST OF KEY NAMES. A template naming the four keys
 * the door sends today would go quietly blank the day a fifth arrives, which is
 * the worst way for a legal disclosure to fail — the same argument `termsRows`
 * makes for being generic. A term that fits on a line is one a reader takes in
 * at the door; one that does not is a document.
 */
export const CONSENT_CLIP = 120;

export function consentSplit(terms) {
  const brief = [], fine = [];
  for (const r of termsRows(terms)) {
    const v = String(r.value ?? "");
    (v.length <= CONSENT_CLIP && !/[\r\n]/.test(v) ? brief : fine).push(r);
  }
  return { brief, fine };
}

// ── the map transform ───────────────────────────────────────────────────────

/**
 * World metres → the map svg's own units, read from the SAME place the viewer
 * reads it: `WORLD/skeleton.json`'s `_grid`. The viewer parses those two strings
 * with these two regexes (spectator/viewer.mjs, the atlas mount) and derives
 * `originPx = { x: -x0/mPerPx … }`-equivalent constants; doing it here from the
 * same bytes keeps ONE source with two readers rather than a number copied into
 * the site to drift. If `_grid` ever changes shape both readers fail the same way
 * — this returns null and the token simply is not drawn.
 */
export function gridFrom(skeleton) {
  const g = skeleton?._grid ?? {};
  const om = String(g.origin ?? "").match(/\((\d+)\s*,\s*(\d+)\)/);
  const sm = String(g.scale ?? "").match(/(\d+(?:\.\d+)?)\s*m per atlas px/);
  if (!om || !sm) return null;
  const mPerPx = Number(sm[1]);
  if (!isFinite(mPerPx) || mPerPx <= 0) return null;
  return { originPx: { x: Number(om[1]), y: Number(om[2]) }, mPerPx };
}

/** The viewer's own line, verbatim in arithmetic:
 *  `px(m) = { x: originPx.x + m.x / mPerPx, y: originPx.y + m.y / mPerPx }`. */
export function worldToPx(grid, m) {
  if (!grid || !m || !isFinite(m.x) || !isFinite(m.y)) return null;
  return { x: grid.originPx.x + m.x / grid.mPerPx, y: grid.originPx.y + m.y / grid.mPerPx };
}

/** The same line, read backwards — atlas units to world metres. Needed the
 *  moment a CLICK on the painting has to become somewhere to walk to: the
 *  pointer arrives in the map's own units and the door only speaks metres.
 *  Written as the algebraic inverse of the line above rather than as a second
 *  formula, so the two cannot drift apart. */
export function pxToWorld(grid, px) {
  if (!grid || !px || !isFinite(px.x) || !isFinite(px.y)) return null;
  return { x: (px.x - grid.originPx.x) * grid.mPerPx, y: (px.y - grid.originPx.y) * grid.mPerPx };
}

// ── what was said, and where ────────────────────────────────────────────────

/**
 * Recent speech, flattened out of the conversations door.
 *
 * WHERE THIS COMES FROM, and why it is a second door rather than the apex.
 * The apex answer carries no speech at all — not in `happened` (movement,
 * crossings, notices), not in `present` (positions), not in the encounter. That
 * is not an oversight to work around: speech in this world is a SOUND, "radiated
 * at the speaker's standpoint, heard by earshot, gone by its own law" (the say
 * class's own blurb), and the record of it lives where sounds live.
 *
 * `GET /api/world/conversations` is that record, and it is keyless — "speech is
 * public the way street conversation is" (office server.mjs). Each voice carries
 * its OWN x/y: where the speaker stood when they said it, which is exactly what
 * a line drawn on the map wants, and is not the same as where they are standing
 * now. A line stays where it was spoken.
 *
 * The door states its own fade (`fade_minutes`), so the window is the world's
 * and not a number picked here — the same reason nothing else in this file holds
 * a constant the door already states.
 */
export function recentVoices(body, opts = {}) {
  const threads = Array.isArray(body?.live) ? body.live : [];
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const fadeMin = Number.isFinite(body?.fade_minutes) ? body.fade_minutes : 5;
  const window = fadeMin * 60_000;
  const out = [];
  for (const t of threads) {
    for (const v of Array.isArray(t?.voices) ? t.voices : []) {
      const at = Number.isFinite(v?.at_ms) ? v.at_ms : Date.parse(v?.at ?? "");
      if (!Number.isFinite(at)) continue;
      const age = now - at;
      if (age < 0 || age > window) continue;
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
      const said = typeof v.said === "string" ? v.said : "";
      if (!said) continue;
      out.push({
        handle: typeof v.handle === "string" ? v.handle : "",
        said,
        at: { x: v.x, y: v.y },
        ageMs: age,
        // 1 at the moment it was said, 0 as it leaves — the door's own fade,
        // so the line goes quiet exactly when the world says it has.
        freshness: Math.max(0, Math.min(1, 1 - age / window)),
      });
    }
  }
  // newest last, so a later line paints over an earlier one at the same spot
  return out.sort((a, b) => b.ageMs - a.ageMs);
}

// ── the human's own token ───────────────────────────────────────────────────

/**
 * A human acting as themselves has a face on the map, and it is not a resident's
 * avatar — the roster's rule below the divider is "yourself is just another face".
 *
 * INTEGRATION CONTRACT: the door should name it (`actor.token_url`), for the same
 * reason the blurbs come from the door — the site should not hold a table of who
 * looks like what. Until it does, this one-entry registry stands in, and every
 * other human gets an honest monogram rather than a borrowed picture.
 */
export const HUMAN_TOKENS = Object.freeze({
  keeminlee: Object.freeze({ label: "DARKO", src: "/birthday/darko-token.png" }),
});

export function tokenFor(actor) {
  if (!actor || actor.kind !== "human") return null;
  if (typeof actor.token_url === "string" && actor.token_url) {
    return { label: actor.label ?? actor.id ?? "", src: actor.token_url, from: "the door" };
  }
  const known = HUMAN_TOKENS[actor.id];
  if (known) return { label: known.label, src: known.src, from: "the site's registry" };
  const label = String(actor.label ?? actor.id ?? "?");
  return { label, src: null, monogram: label.slice(0, 1).toUpperCase(), from: "monogram" };
}

/**
 * Where the adversary stands, and whether it can be drawn at all.
 *
 * THE ANSWER CARRIES THE FIGHT AND THE MAP IN TWO SEPARATE PLACES, and joining
 * them is the whole of this function. `encounter_detail.adversary` names it and
 * states its hp — and carries no coordinates at all; `nearby[]` carries every
 * mark's `at` — and says nothing about which of them is the adversary. Neither
 * half is enough alone, and the office does not join them for us. The id is the
 * join key.
 *
 * WHY THERE IS NO FALLBACK COORDINATE HERE. The mark's `at` is a fact of the
 * fold, and the fold is what `nearby` is read from — so a constant written into
 * this file would be the same number in a second place, and the day the cake is
 * moved it would go on drawing an ember ring over empty floor while the real one
 * stood elsewhere. A thing the answer cannot place is not drawn, which is the
 * same rule the human's own token already follows.
 *
 * A caveat the drawing cannot fix: `nearby` is a FIELD OF VIEW, budgeted and
 * ranked, so a reader standing far enough away gets no entry and therefore no
 * ring. That is the door being honest about what can be seen from where you are,
 * and inside the room it is standing in it is never the case.
 */
export function adversaryPlacement(answer, grid) {
  const adv = adversaryOf(answer);
  if (!adv) return null;
  const nearby = Array.isArray(answer?.nearby) ? answer.nearby : [];
  const seen = nearby.find((m) => m?.id === adv.id && m.at && Number.isFinite(m.at.x) && Number.isFinite(m.at.y));
  if (!seen) return null;
  const at = worldToPx(grid, { x: seen.at.x, y: seen.at.y });
  if (!at) return null;
  return { at, adversary: adv };
}

/**
 * Where the token stands, and whether it stands at all.
 *
 * Only when the door says the human is the one embodied. A token drawn because
 * the site THINKS a human is acting would be a claim about the record that the
 * record does not make — and on this map a face means "this person is here".
 */
export function tokenPlacement(answer, grid, actor, { seated = false } = {}) {
  const stance = answer?.standpoint?.stance;
  // THE HUMAN STANDS BESIDE THE RESIDENT WHERE THE GROUND SEATS THEM (founder's
  // ruling, 2026-08-29: "when you enter a zone where it's human-allowed the
  // human's token gets placed in with a slight offset from the resident").
  //
  // Two different facts, and they are not the same drawing. `embodied-human` is
  // the record saying this person has their own feet here, and the token stands
  // ON the standpoint. SEATED is the portal's welcome — the ground grants the
  // human its verbs, they fight from the housemate's place, and there is no
  // separate position in the record for them to stand on. So the token stands
  // BESIDE, and the offset is the honest part of the picture: it says they are
  // here without claiming a coordinate the world does not hold.
  //
  // The `seated` half is decided by the caller, which is the only place that
  // knows both whether this ground grants the human feet and whether the reader
  // has taken that seat. Absent it, this is exactly the function it was.
  if (stance !== "embodied-human" && !seated) return null;
  const token = tokenFor(actor);
  if (!token) return null;
  const at = worldToPx(grid, { x: Number(answer?.standpoint?.x), y: Number(answer?.standpoint?.y) });
  if (!at) return null;
  return { at, token, beside: stance !== "embodied-human" };
}
