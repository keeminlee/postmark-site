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
export function barSlots(answer) {
  const actions = Array.isArray(answer?.actions) ? answer.actions : [];
  const byName = new Map();
  for (const e of actions) if (e && typeof e.action === "string") byName.set(e.action, e);

  // TURN-GATING IS A SEPARATE FACT FROM AFFORDANCE, and keeping them separate is
  // the point. `afforded` says the ground grants this act; `blocked` says you may
  // not take it THIS INSTANT. An act that is afforded here and blocked until your
  // turn still shows its card, its fields and its terms — the grammar stays
  // legible, which is the founder's ruling in one word: disabled, never hidden.
  const blocked = blockedReason(answer);

  let key = 0;
  const dress = (slot) => ({
    ...slot,
    blocked: slot.afforded && blocked ? blocked.reason : null,
    enabled: slot.afforded && !blocked,
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

/** The caller's own row on the wheel, or null. */
export function yourTurnRow(encounter) {
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
export function blockedReason(answer) {
  const said = answer?.standpoint?.acting_blocked;
  if (said && typeof said.reason === "string" && said.reason.trim()) {
    return { reason: said.reason, from: "the door" };
  }
  const enc = encounterOf(answer);
  if (!enc) return null;
  const you = yourTurnRow(enc);
  if (you?.down) return { reason: "you are down — an ally can lift you", from: "derived" };
  if (enc.turn && you && !you.current) {
    const whose = enc.order.find((a) => a.current);
    return { reason: `it is ${whose?.label ?? enc.turn}'s turn`, from: "derived" };
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
  const candidates = actCandidates(answer);
  if (candidates.length !== 1) return out;
  const open = card.fields.filter((f) =>
    !f.enum?.length && f.type !== "number" && f.type !== "boolean" && !wantsTextarea(f));
  if (open.length !== 1) return out;
  out[open[0].name] = candidates[0].value;
  return out;
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
export function tokenPlacement(answer, grid, actor) {
  const stance = answer?.standpoint?.stance;
  if (stance !== "embodied-human") return null;
  const token = tokenFor(actor);
  if (!token) return null;
  const at = worldToPx(grid, { x: Number(answer?.standpoint?.x), y: Number(answer?.standpoint?.y) });
  if (!at) return null;
  return { at, token };
}
