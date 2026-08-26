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

  let key = 0;
  const fixed = FIXED_SLOTS.map((slot) => {
    const entry = byName.get(slot.action) ?? null;
    return {
      action: slot.action,
      label: slot.label,
      key: ++key <= MAX_KEYED ? key : null,
      card: entry ? cardOf(entry) : null,
      afforded: Boolean(entry),
    };
  });

  const tray = [];
  for (const e of actions) {
    if (!e || typeof e.action !== "string" || FIXED_NAMES.has(e.action)) continue;
    const n = ++key;
    tray.push({
      action: e.action,
      // A verb the site has never seen names itself. Upper-cased for the bar's
      // voice only; the card and every dispatch use the door's own spelling.
      label: e.action.replace(/-/g, " ").toUpperCase(),
      key: n <= MAX_KEYED ? n : null,
      card: cardOf(e),
      afforded: true,
    });
  }
  return { fixed, tray };
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

/** The founder's scope ruling, in one predicate: the cockpit renders inside
 *  portal ground and nowhere else. Outside it the island mounts nothing at all. */
export function cockpitShows(answer) {
  return portalOf(answer) !== null;
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
 */
export function dispatchEnvelope({ action, args, acting }) {
  const env = { do: String(action), args: args && typeof args === "object" ? args : {} };
  if (acting === HUMAN_ACTOR) env.as = "human";
  else if (typeof acting === "string" && acting) env.handle = acting;
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
