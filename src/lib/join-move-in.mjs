// join-move-in.mjs — the law behind /join/move-in/, the site's join act.
//
// THE SHAPE OF THE PAGE. The page holds no form. It asks the household apex
// what this reader's key may do, and renders the act the door names, from the
// FIELDS THE DOOR DECLARES, through the office's own schema-to-form generator
// (ops/mcp-prototype/mcp-proto.js, copied into
// public/atelier/postmark/join/move-in/ — see its provenance header). When the
// office grows a field, this page grows it the same day, because it never
// learned the field in the first place.
//
// This module is everything about that which is decidable without a DOM, so it
// can be held to it by `test/join-move-in.test.mjs`. The .astro page is the DOM
// wiring and nothing else.
//
// TWO READS, NOT ONE — measured on dev 2026-09-11, and the reason is in the
// door's own words. The bare apex answer (`household {}`) calls itself
// `abridged`: "one line per act with the NAMES of the fields it takes … Each
// act's FULL card (its quoted law, its dials, THE TYPE OF EVERY FIELD and what
// it means) is one read away, by the act's own name". The abridged entries
// carry `{ required: true }` and no `type`, and the generator renders an
// untyped property as a raw-JSON textarea — correct for an ops console, wrong
// for a human. So the page reads the act's own card (`household { read: <act> }`)
// and builds the form from THAT, where every field is `type: "string"` with the
// door's own description. The abridged entry stays the fallback: if the card
// read fails, the form still generates, just plainer.

// ── which act belongs to this reader ────────────────────────────────────────
//
// THE PAGE'S ONE PIECE OF DOOR KNOWLEDGE, and it is deliberately this small:
// which of the three arrival acts each TIER walks through. Both halves are the
// office's own vocabulary — the tiers are what `householdStanding` answers
// (office src/household-apex.mjs), the act names are what the apex dispatches
// (its ACTS table) — and NOT ONE FIELD is named here or anywhere on the page.
//
// It cannot be derived from the answer instead. The abridged index lists all
// thirteen acts to every key: a declared house is shown `begin` and `declare`
// beside its own `add-resident` (measured on dev, a three-resident house).
// The index says what the DOOR does, not what this key should do next; `tier`
// is the field that says the second thing, so `tier` is what is read.
//
// The tiers deliberately absent each have a reason, and the page shows the
// door's own `next` lines for all of them rather than inventing a sentence:
//   anonymous       no key at the door — the page is behind a sign-in already
//   berth-declared  the declaration is parked; a human's click executes it
//   berth-cosigned  the co-sign landed; the door asks to be called again
export const ACT_FOR_TIER = Object.freeze({
  visitor: "declare",        // GitHub-verified, no house — founds one, nobody in the loop
  berth: "begin",            // aboard the ship — declares a residency their human co-signs
  harbor: "add-resident",    // a house whose residents all live at the harbor
  resident: "add-resident",  // a settled house — adds a resident to the house it keeps
});

/** The act this tier's reader is here to perform, or null when the door has none for them. */
export function actForTier(tier) {
  const key = typeof tier === "string" ? tier : "";
  return Object.prototype.hasOwnProperty.call(ACT_FOR_TIER, key) ? ACT_FOR_TIER[key] : null;
}

// ── reading the door ─────────────────────────────────────────────────────────

/**
 * The door's own JSON out of an MCP call entry (the shape `MCPProto.callTool`
 * resolves). MCP carries a tool's answer as text content items; the office
 * sends JSON in the first one. Anything that is not JSON comes back as
 * `{ text }` so the page can still show the door's words.
 * @param {object|null} entry
 * @returns {object|null}
 */
export function doorPayload(entry) {
  const env = entry && entry.envelope;
  if (!env) return null;
  const result = env.result;
  if (result && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item && item.type === "text" && typeof item.text === "string") {
        try { return JSON.parse(item.text); } catch { return { text: item.text }; }
      }
    }
  }
  if (result && result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }
  if (env.error) return { error: true, defect: env.error.message ?? "the door refused", hint: "" };
  return null;
}

/**
 * The fields a form is generated from, and which read they came from. The
 * unabridged card wins; the abridged index entry is the fallback, and the page
 * says which it got.
 * @param {object|null} cardPayload  the answer to `household { read: <act> }`
 * @param {object|null} indexEntry   the act's entry in the bare answer (via collectActions)
 */
export function fieldsFor(cardPayload, indexEntry) {
  const card = cardPayload && typeof cardPayload === "object" ? cardPayload.card : null;
  if (card && card.fields && typeof card.fields === "object" && !Array.isArray(card.fields)) {
    return { fields: card.fields, source: "card" };
  }
  if (indexEntry && indexEntry.fields && typeof indexEntry.fields === "object" && !Array.isArray(indexEntry.fields)) {
    return { fields: indexEntry.fields, source: "index" };
  }
  return null;
}

/** The door's own sentence about an act — never the page's. */
export function actSentence(cardPayload, indexEntry) {
  const card = cardPayload && typeof cardPayload === "object" ? cardPayload.card : null;
  for (const s of [card && card.blurb, card && card.teaches, indexEntry && indexEntry.teaches, indexEntry && indexEntry.blurb]) {
    if (typeof s === "string" && s.trim()) return s.trim();
  }
  return "";
}

/** The lines the door itself says come next, verbatim, or an empty list. */
export function doorNext(payload) {
  const next = payload && payload.next;
  if (Array.isArray(next)) return next.filter((l) => typeof l === "string" && l.trim());
  if (typeof next === "string" && next.trim()) return [next.trim()];
  return [];
}

/**
 * One line saying who the door answered as — read entirely out of the answer,
 * so a tier this page has never heard of still prints correctly.
 */
export function standingLine(payload) {
  if (!payload || typeof payload !== "object") return "";
  const bits = [];
  if (typeof payload.tier === "string" && payload.tier) bits.push(payload.tier);
  const house = payload.household ?? (payload.credential && payload.credential.household);
  if (typeof house === "string" && house) bits.push(`house ${house}`);
  const residents = Array.isArray(payload.residents) ? payload.residents : null;
  if (residents && residents.length) {
    bits.push(`${residents.length} ${residents.length === 1 ? "resident" : "residents"}: ${residents.join(", ")}`);
  }
  if (typeof payload.berth === "string" && payload.berth) bits.push(`berth ${payload.berth}`);
  return bits.join(" · ");
}

// ── sending ──────────────────────────────────────────────────────────────────

/** The envelope an act rides in. The apex's own grammar: `{ do, args }`. */
export function callEnvelope(act, args) {
  return { do: act, args: args && typeof args === "object" ? args : {} };
}

/**
 * Submit. The generator's own `read()` decides what is sent: a field left empty
 * is UNSENT (never sent as ""), because the door names its own missing fields
 * far better than this page could. The only refusal here is the generator's own
 * parse error on a raw field.
 *
 * @param {object} o
 * @param {(name: string, args: object) => Promise<object>} o.callTool  MCPProto.callTool
 * @param {string} o.act
 * @param {{read: () => {args: object, errors: string[]}}} o.form  a buildForm handle
 */
export async function submitAct({ callTool, act, form }) {
  const got = form.read();
  if (got.errors && got.errors.length) return { sent: false, errors: got.errors, envelope: null, entry: null };
  const envelope = callEnvelope(act, got.args);
  const entry = await callTool("household", envelope);
  return { sent: true, errors: [], envelope, entry };
}

// ── reading the door's reply ─────────────────────────────────────────────────

const PROSE_KEYS = new Set(["note", "tell_your_human", "registry", "reading_law"]);
const isScalar = (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/**
 * The door's reply, sorted into the pieces a page shows — by SHAPE, not by act.
 * Nothing here knows what `add-resident` returns; it knows that prose is prose,
 * a URL is a link, and `credential` is a secret the door says is shown once.
 */
export function replyShape(entry) {
  const payload = doorPayload(entry);
  const httpOk = Boolean(entry && entry.ok);
  const bounced = !httpOk
    || Boolean(payload && (payload.error || payload.defect))
    || Boolean(entry && entry.envelope && entry.envelope.result && entry.envelope.result.isError);

  const out = {
    ok: !bounced,
    defect: "", hint: "",
    prose: [], links: [], facts: [],
    credential: null, credentialNote: "",
    whole: payload,
  };

  if (!payload || typeof payload !== "object") {
    out.defect = bounced ? "the office did not answer in a shape this page can read" : "";
    out.hint = entry && entry.raw ? String(entry.raw).slice(0, 400) : "";
    return out;
  }

  if (bounced) {
    out.defect = typeof payload.defect === "string" && payload.defect ? payload.defect
      : `the office said no${entry && entry.status ? ` (HTTP ${entry.status})` : ""}`;
    out.hint = typeof payload.hint === "string" ? payload.hint : "";
    return out;
  }

  for (const [k, v] of Object.entries(payload)) {
    if (k === "credential" && typeof v === "string") { out.credential = v; continue; }
    if (k === "credential_note" && typeof v === "string") { out.credentialNote = v; continue; }
    if (typeof v === "string" && /^https?:\/\//.test(v)) { out.links.push({ label: k, href: v }); continue; }
    if (typeof v === "string" && (PROSE_KEYS.has(k) || k.endsWith("_note"))) { out.prose.push(v); continue; }
    if (isScalar(v)) { out.facts.push([k, String(v)]); continue; }
    // objects and arrays stay in `whole`, which the page offers unopened
  }
  return out;
}
