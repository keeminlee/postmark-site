// world-cockpit-door.mjs — the cockpit's side of the wire.
//
// ONE PLACE COMPOSES THE APEX URL, and that is the whole reason this file exists.
//
// THE HANDLE IS NOT OPTIONAL FURNITURE. A key in this town holds MANY residents —
// the founder's own does, and that is the DEFAULT shape here rather than an edge
// case worth a fallback. Read handle-less, the apex answers 422 with
//
//     {"bounce":{"defect":"which resident are you standing as?","choices":[…]}}
//
// which is the door doing its job: it will not guess which of your residents is
// the one standing somewhere. On 2026-08-26 the island's boot read named no
// resident, caught that bounce, returned null, and the island read null as "no
// portal here" — so the cockpit built that day never mounted once, and nothing
// anywhere said why. Three separate hand-rolled calls to this door existed by
// then and they disagreed: the tooltip's shadow-read named a resident, the boot
// read did not. Composing the URL in one place is how that stops being possible.
//
// AND NO FAILURE HERE IS SILENT. The cost of that night was not the missing
// handle — it was that a 422 and an honest "you are not in a portal" were the
// same value by the time the island saw them. Every bounce this module swallows
// is spoken first, in the door's own words.
//
// `fetch` is INJECTED, never reached for. That is the seam 08-26 did not have:
// the composition lived in an IIFE inside a .astro <script>, where no test could
// hand it a stubbed door and ask what it did with a bounce.

/** The door, in one string. Nothing else in `src/` may spell this path — the
 *  class guard in test/world-cockpit.test.mjs asserts exactly that, because a
 *  second speller is a second place the handle can go missing. */
export const APEX_PATH = "/world/apex";

/**
 * Where a read of the apex goes.
 *
 * The handle rides in the query on a GET (there is no body to put it in) and in
 * the body on a POST, which is where the office's own read path looks for it.
 * `handle` is a REQUIRED argument rather than an optional one — passing null is
 * a decision a caller has to make out loud.
 */
export function apexUrl(office, handle) {
  const base = String(office ?? "") + APEX_PATH;
  return handle ? `${base}?handle=${encodeURIComponent(handle)}` : base;
}

/**
 * What a bounce said, across both shapes this door bounces in.
 *
 * The orient-stage refusal wraps itself — `{ bounce: { defect, choices } }` —
 * while the act-stage refusals answer flat `{ defect, hint }` (which is what
 * `readBounce` in world-cockpit.mjs reads). A reader of one shape goes quiet on
 * the other, and the shape that was going quiet is the one that cost the night.
 */
export function bounceWords(body) {
  const b = body?.bounce && typeof body.bounce === "object" ? body.bounce : body;
  return {
    defect: typeof b?.defect === "string" && b.defect ? b.defect : null,
    hint: typeof b?.hint === "string" && b.hint ? b.hint : null,
    choices: Array.isArray(b?.choices) ? b.choices.filter((c) => typeof c === "string") : [],
  };
}

const defaultWarn = (...a) => globalThis.console?.warn?.(...a);

/** The sentence a swallowed bounce leaves behind. Findable is the requirement:
 *  a reader opening the console after "the bar did not appear" must be able to
 *  read the door's own refusal there rather than infer it. */
export function bounceLine(where, status, body) {
  const { defect, hint, choices } = bounceWords(body);
  return `world cockpit: ${where} bounced ${status}`
    + (defect ? ` — ${defect}` : " — the door did not say what went wrong")
    + (choices.length ? ` (the door named: ${choices.join(", ")})` : "")
    + (hint ? ` — ${hint}` : "");
}

async function bodyOf(res) {
  try { return await res.json(); } catch { return null; }
}

/**
 * The standpoint read: where this resident stands and what the ground affords.
 *
 * No x/y — signed in, the door answers "where your walk arrived", which is the
 * standpoint the bar exists to serve. It answers it FOR A NAMED RESIDENT, which
 * is the whole of the 08-26 fix.
 *
 * Returns the answer, or null having said why out loud.
 */
export async function readDoor({ fetch: fetchImpl, office, handle, headers, warn }) {
  const res = await fetchImpl(apexUrl(office, handle), { headers: headers ?? {} });
  if (!res.ok) {
    (warn ?? defaultWarn)(bounceLine(
      handle ? `the standpoint read as ${handle}` : "the standpoint read, naming no resident",
      res.status,
      await bodyOf(res),
    ));
    return null;
  }
  return res.json();
}

/**
 * The resident this key orients as.
 *
 * The FIRST handle, and deliberately the same one everywhere: the bar is drawn
 * for one standpoint, and a second resolution would let the roster, the read and
 * the act drift onto three different standpoints on the same key. `GET /api/me`
 * answers `handles` in the office's own order; picking anything else out of it
 * would be the site choosing whose feet the reader is standing in.
 *
 * Null means a key with no residents at all — a machine key, or a bad read of
 * /me. Both are worth the door's own bounce rather than a guess.
 */
export function orientingHandle(me) {
  const handles = Array.isArray(me?.handles) ? me.handles.filter((h) => typeof h === "string" && h) : [];
  return handles[0] ?? null;
}
