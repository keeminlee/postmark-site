// world-api-rail.mjs — THE WORLD PAGE READS THE OFFICE API, NEVER A GIT PHOTOGRAPH.
//
// THE CONSTRAINT THIS IMPLEMENTS (Keemin, 2026-09-09, verbatim): "I'll trust
// that the site ingests just the MCP and API instead of Git. That's the one hard
// constraint that I need."
//
// WHAT WAS TRUE BEFORE (measured on world main 787f42cd, 2026-09-09): the
// viewer already asks the office FIRST — `recordSources("/WORLD/world-state.json",
// { office: officeUrl("/world/state") })` puts `/api/world/state` ahead of the
// same-origin file (postmark-world tools/record-sources.mjs). But the second
// source in that chain is the npm pin's photograph of `WORLD/world-state.json`,
// staged into the build from git, and the viewer falls to it SILENTLY when the
// office does not answer. `/seeding/manifest.json` (the legacy home set) has no
// office door at all and is read from that photograph every time. So the page's
// data rail was "API, else git, and nobody is told which".
//
// WHAT THIS DOES: it decides, for one same-origin request the viewer makes,
// whether the request may reach the network. A same-origin record that the
// office serves is REFUSED with a named 503 — the page has exactly one source
// for it and it is the office; a same-origin record the office does not serve
// is refused too, and the absence is named rather than filled from git. The
// decision is pure so it can be falsified without a browser; the page's
// installer (town/pages/world.astro) wraps `window.fetch` with it and writes the
// receipt sentence into the page's own chrome.
//
// The replay lens (`?crossing=<n>`, world.astro) reads a PAST crossing's fold
// from the world repo by design — that is a photograph on purpose, of a frozen
// crossing, and it is armed only by navigation. An armed lens passes through
// untouched; the rail governs the LIVING world only.
//
// PURE. No DOM, no fetch, no clock.

/** Same-origin records the office ALSO serves — the page's one source for each. */
export const OFFICE_SERVED = Object.freeze({
  "/WORLD/world-state.json": "/api/world/state",
  "/WORLD/skeleton.json": "/api/world/skeleton",
});

/** Same-origin records the office does NOT serve tonight — refused, named, not filled from git. */
export const NO_OFFICE_DOOR = Object.freeze({
  "/seeding/manifest.json": "the legacy home set (household → home_id); under the 09-09 frame the parcel IS the home and the office's /world/state already carries `sovereign` and `kind: parcel`",
});

/** The office doors whose answers the receipt reports on. */
export const OFFICE_DOORS = Object.freeze(Object.values(OFFICE_SERVED));

const SAME_ORIGIN = "same-origin";

/**
 * One decision for one request.
 *
 *   { kind: "pass" }                                   — let it through untouched
 *   { kind: "office", door }                           — an office door: let it through, and REPORT on the answer
 *   { kind: "refuse", record, office, status, body }   — answer this from the rail, never from the network
 *
 * `armed` is the replay lens: while a past crossing is held, nothing here applies.
 */
export function railDecision(pathname, { armed = false, officeFailure = null } = {}) {
  const p = String(pathname ?? "");
  if (armed) return { kind: "pass" };
  if (OFFICE_DOORS.includes(p)) return { kind: "office", door: p };
  if (Object.hasOwn(OFFICE_SERVED, p)) {
    const office = OFFICE_SERVED[p];
    const why = officeFailure
      ? `the office API did not answer (${officeFailure.door} → ${officeFailure.status})`
      : `the office API is this page's only source for it`;
    return {
      kind: "refuse", record: p, office, status: 503,
      body: {
        error: "refused",
        defect: `${p} is not read on this page — ${why}; nothing is drawn from a git photograph`,
        hint: `this page reads ${office} and only that; if it is down, the page says so instead of showing an older world`,
      },
    };
  }
  if (Object.hasOwn(NO_OFFICE_DOOR, p)) {
    return {
      kind: "refuse", record: p, office: null, status: 503,
      body: {
        error: "refused",
        defect: `${p} is not read on this page — no office door serves it, and a git photograph is not a substitute`,
        hint: NO_OFFICE_DOOR[p],
      },
    };
  }
  return { kind: "pass" };
}

/**
 * What an office answer tells the reader — computed from the response's own
 * headers and (for the world state) its own body. Nothing here is a snapshot
 * of the page's build: every number is the office's, at the instant it answered.
 */
export function officeAnswer(door, { ok, status, headers = {}, json = null } = {}) {
  const h = (k) => headers[k] ?? headers[k.toLowerCase()] ?? null;
  // `status` is whatever the transport said — a number from the office, or the
  // installer's own words ("network error") when no response came back at all.
  const out = { door, ok: Boolean(ok), status, asOf: h("x-postmark-as-of"), worldStoreAsOf: h("x-postmark-world-store-as-of") };
  if (ok && door === OFFICE_SERVED["/WORLD/world-state.json"] && json && Array.isArray(json.marks)) {
    const marks = json.marks;
    const parcels = marks.filter((m) => m?.kind === "parcel");
    out.marks = marks.length;
    out.imaged = marks.filter((m) => typeof m?.image === "string" && m.image).length;
    out.parcels = parcels.length;
    out.parcelsImaged = parcels.filter((m) => typeof m?.image === "string" && m.image).length;
  }
  return out;
}

/**
 * The receipt sentence the page shows. One source, said out loud — with the
 * office's own as-of stamps when it answered, and the refusal when it did not.
 */
export function railReceipt({ answers = [], refused = [] } = {}) {
  const state = answers.find((a) => a.door === OFFICE_SERVED["/WORLD/world-state.json"]);
  if (state?.ok) {
    const parts = [`world from the office API ${state.door}`];
    if (state.asOf) parts.push(`town as-of ${short(state.asOf)}`);
    if (state.worldStoreAsOf) parts.push(`world store as-of ${short(state.worldStoreAsOf)}`);
    if (Number.isFinite(state.marks)) parts.push(`${state.marks} marks · ${state.imaged} with an image · ${state.parcelsImaged} of ${state.parcels} parcels with one`);
    parts.push("nothing from git");
    return { ok: true, text: parts.join(" · ") };
  }
  const failed = answers.filter((a) => !a.ok);
  const why = failed.length
    ? failed.map((a) => `${a.door} → ${a.status}`).join(", ")
    : (state ? `${state.door} → ${state.status}` : "the office API has not answered");
  const gitNames = refused.length ? ` (${refused.join(", ")} refused — no git fallback)` : "";
  return { ok: false, text: `the office API did not answer — ${why}. This page reads the office API only; no older world is drawn from a git photograph${gitNames}.` };
}

function short(sha) { return String(sha).slice(0, 8); }
