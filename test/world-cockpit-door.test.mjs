// world-cockpit-door.test.mjs — the seam that failed, and the class it belongs to.
//
//   node --test test/world-cockpit-door.test.mjs
//
// The cockpit's arithmetic has been under test since it was written, and all 34 of
// those assertions were green on 2026-08-26 while the bar they describe never once
// appeared on a page. Every one of them was handed a fixture answer. Nothing asked
// what happened between the door and the fixture, because that part lived in an
// IIFE inside a .astro <script> where there was no seam to hand a stub to.
//
// So this file tests the part that was untestable: the composition that fetches
// the apex, the gate that decides whether anything mounts, and the markup that
// comes out the far end. It is fed a STUBBED DOOR that behaves the way the live
// office behaved when this was measured on 2026-08-27 — 422 for a read that names
// no resident, the real answer for one that does.
//
// Every assertion carries the sentence of law or the measurement it is asserting,
// because a brief is lossy and a test that paraphrases its reason drifts from it
// in silence.

import test from "node:test";
import assert from "node:assert/strict";

import { apexUrl, bounceLine, bounceWords, orientingHandle, readDoor } from "../src/lib/world-cockpit-door.mjs";
import { HUMAN_ACTOR, actorsFor, cockpitShows, portalOf, rosterOf } from "../src/lib/world-cockpit.mjs";
import { mountCockpit } from "../src/lib/world-cockpit-mount.mjs";

// ── the door, as it actually answered ───────────────────────────────────────

/**
 * The founder's key: MANY residents. Curl-verified against the live office
 * 2026-08-27 — this is the town's DEFAULT key shape, not an edge case, which is
 * why a handle-less call site is a defect rather than a rough edge.
 */
const MULTI_RESIDENT_ME = {
  household: "starforge",
  handles: ["wright-of-postmark", "jetto-of-starforge"],
  verified_github: { login: "keeminlee", id: 1 },
  key_kind: "oauth",
  principal: true,
};

/** The orient-stage refusal, in the shape the office bounces it — the wrapper is
 *  the point: `readBounce` reads flat `{defect, hint}` and would have gone quiet
 *  on this one. Curl-verified 2026-08-27. */
const WHICH_RESIDENT = {
  bounce: {
    defect: "which resident are you standing as?",
    choices: ["wright-of-postmark", "jetto-of-starforge"],
  },
};

/** The `actors` roster in the OFFICE's own field names — office `human-actor.mjs`
 *  `actorRoster` at commit 7f0b56e, 2026-08-27. `says` and `stance`; no `because`.
 *  The Human row is ALWAYS present, allowed or not, and carries `reason` when it
 *  is not: "An absent option teaches nothing" (that function's own comment). */
const ACTORS = [
  { kind: "resident", handle: "wright-of-postmark", label: "wright-of-postmark", allowed: true, reason: null, selected: true, says: "your resident, acting from their own standing" },
  { kind: "resident", handle: "jetto-of-starforge", label: "jetto-of-starforge", allowed: true, reason: null, selected: false, says: "your resident, acting from their own standing" },
  {
    kind: "human", id: "keeminlee", handle: "keeminlee", label: "keeminlee",
    allowed: true, reason: null, stance: "embodied-human",
    token_url: "/birthday/darko-token.png",
    grants: ["say", "walk", "strike"],
    says: "your household's human, on ground that grants them feet — they act here, and only here",
  },
];

const entry = (action, extra = {}) => ({
  action,
  blurb: `the ${action} class's own sentence`,
  blurb_from: `the-hall/${action}`,
  from: "the-hall/combatant",
  class: "combatant",
  fields: {},
  via: "ambient",
  grant: "here",
  ...extra,
});

/** Portal ground, signed in, with the roster the door now answers. */
const IN_PORTAL = {
  standpoint: {
    x: 120, y: -40, from: "where your walk arrived", stance: "embodied-human",
    portal: { id: "the-town/the-lanternstep-door", value: "the-town/the-lanternstep-hall", by: "the-town", space: "antechamber" },
  },
  within: [{ id: "the-town/the-lanternstep-hall", by: "the-town", tier: "constitution" }],
  actions: [entry("say"), entry("walk")],
  actors: ACTORS,
};

/**
 * A stubbed apex, answering the way the live one did.
 *
 * It refuses a read that names no resident and answers one that does — which is
 * the ONE behaviour the 08-26 code could not survive and the one nothing tested.
 * It records every URL it was asked for, so a test can assert what the site said
 * to the door rather than only what it did with the reply.
 */
function stubApex(answer = IN_PORTAL) {
  const asked = [];
  const doFetch = async (url) => {
    asked.push(String(url));
    const handle = new URL(String(url), "https://x.invalid").searchParams.get("handle");
    if (!handle) {
      return { ok: false, status: 422, json: async () => WHICH_RESIDENT };
    }
    return { ok: true, status: 200, json: async () => answer };
  };
  return { fetch: doFetch, asked };
}

// ── a document, small enough to hold in the head ────────────────────────────
//
// This repo carries no DOM library and one is not worth a dependency for this:
// what has to be proven is that the mount RUNS to completion off a live-shaped
// answer and composes a roster with the human's face in it. So this shim records
// every innerHTML it is given and hands back inert stubs for every query.
//
// WHICH MEANS THE RECEIPT IS THE MARKUP, NOT A QUERY. `querySelector` here would
// answer whatever was asked of it — this page has been caught once already
// "asking a hidden element and getting the answer it wanted" (site 0228e979b), and
// a stub that always answers yes is the same defect with fewer steps. So the
// assertions below read the string the mount actually composed.

function tinyDom() {
  const el = (tag) => {
    const attrs = new Map();
    const node = {
      tagName: String(tag ?? "").toUpperCase(),
      children: [],
      style: {},
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      hidden: false,
      value: "",
      textContent: "",
      _html: "",
      get innerHTML() { return node._html; },
      set innerHTML(v) { node._html = String(v); },
      set className(v) { attrs.set("class", String(v)); },
      get className() { return attrs.get("class") ?? ""; },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      appendChild: (c) => { node.children.push(c); return c; },
      removeChild: (c) => { node.children = node.children.filter((x) => x !== c); },
      remove() {},
      contains: () => false,
      closest: () => null,
      focus() {},
      scrollIntoView() {},
      addEventListener() {}, removeEventListener() {},
      querySelector: () => el("div"),
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      getClientRects: () => [],
    };
    return node;
  };
  const body = el("body");
  const doc = {
    body,
    head: el("head"),
    activeElement: null,
    createElement: el,
    createElementNS: (_ns, tag) => el(tag),
    // The viewer's bottom-edge furniture is genuinely absent here, and null is
    // what `placeBar` is written to expect from an absent one.
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    defaultView: {
      innerWidth: 1280, innerHeight: 800,
      setTimeout: () => 0,
      addEventListener() {}, removeEventListener() {},
    },
  };
  return doc;
}

/** The markup the cockpit's own root was last painted with. */
function paintedRoster(doc) {
  const root = doc.body.children.find((c) => c.getAttribute("data-pmc") === "");
  return root ? root.innerHTML : null;
}

// ── Gate A: the read that named nobody ──────────────────────────────────────

test("the boot read names a resident, and a multi-resident key mounts the bar", async () => {
  // THE SEAM THAT FAILED, end to end. On 2026-08-26 the island read the apex with
  // no handle, the door refused with 422 `which resident are you standing as?`,
  // the island turned that into null, and null read as "not in a portal" — so the
  // cockpit built that day never mounted and never said why.
  //
  // Run the site's own composition against a door that behaves that way.
  const { fetch: doFetch, asked } = stubApex();
  const handle = orientingHandle(MULTI_RESIDENT_ME);
  assert.equal(handle, "wright-of-postmark", "the key's first resident is the one the bar is drawn for");

  const answer = await readDoor({ fetch: doFetch, office: "https://postmark.town/api", handle, headers: {}, warn: () => {} });
  assert.ok(answer, "the door answers a read that names a resident");
  assert.match(asked[0], /\?handle=wright-of-postmark$/, "…because the read named one, in the query");

  assert.equal(cockpitShows(answer), true, "portal ground with a roster: the bar shows");

  const doc = tinyDom();
  const mounted = mountCockpit({
    document: doc, host: doc.body, svg: null, answer, me: MULTI_RESIDENT_ME, grid: null,
    dispatch: async () => ({ ok: true, status: 200, body: {} }),
    readTerms: async () => null,
    refresh: null,
  });
  assert.ok(mounted, "mountCockpit returns a handle — the bar is on the page");

  const html = paintedRoster(doc);
  assert.ok(html, "the cockpit's root was painted");
  // The human's own face, by the sentinel the bar carries for it.
  assert.ok(html.includes(`data-actor="${HUMAN_ACTOR}"`), "the roster carries the human's face");
  assert.ok(html.includes('data-actor="wright-of-postmark"'), "…beside the key's residents");
  mounted.destroy();
});

test("a read that names no resident is refused, and says so out loud", async () => {
  // The other half of the same fix, and the half that made it cost a night: a 422
  // and an honest "you are not in a portal" were the same value by the time the
  // island saw them. Nothing was thrown and nothing was logged.
  const { fetch: doFetch } = stubApex();
  const said = [];
  const answer = await readDoor({
    fetch: doFetch, office: "https://postmark.town/api", handle: null, headers: {},
    warn: (line) => said.push(line),
  });
  assert.equal(answer, null, "a bounce is not an answer");
  assert.equal(said.length, 1, "and it is not swallowed");
  assert.match(said[0], /422/);
  assert.match(said[0], /which resident are you standing as\?/, "the door's own defect, verbatim");
  assert.match(said[0], /wright-of-postmark/, "…and the choices it named, which are the fix");
});

test("the wrapped bounce is read, because the flat reader goes quiet on it", () => {
  // `readBounce` in world-cockpit.mjs reads `{defect, hint}` — the act-stage shape.
  // The orient-stage refusal wraps itself in `bounce`, so the flat reader sees no
  // defect at all and reports "the door did not say what went wrong" about a door
  // that said exactly what went wrong.
  assert.equal(bounceWords(WHICH_RESIDENT).defect, "which resident are you standing as?");
  assert.deepEqual(bounceWords(WHICH_RESIDENT).choices, ["wright-of-postmark", "jetto-of-starforge"]);
  // and the flat shape still reads, because the act half bounces that way
  assert.equal(bounceWords({ defect: "no", hint: "try this" }).defect, "no");
  assert.equal(bounceWords({ defect: "no", hint: "try this" }).hint, "try this");
  assert.match(bounceLine("the standpoint read", 422, WHICH_RESIDENT), /bounced 422 — which resident/);
});

test("the handle goes in the query, escaped, and a null one is a decision made out loud", () => {
  assert.equal(apexUrl("https://postmark.town/api", "wright-of-postmark"),
    "https://postmark.town/api/world/apex?handle=wright-of-postmark");
  assert.equal(apexUrl("https://postmark.town/api", null), "https://postmark.town/api/world/apex");
  assert.equal(apexUrl("/api", "a b"), "/api/world/apex?handle=a%20b");
});

// ── Gate B: the scope ruling of 2026-08-27 ──────────────────────────────────

/** A parcel. No portal anywhere in the answer — the door sent a roster instead,
 *  which under the superseded ruling was not enough to put a bar on the page. */
const ON_A_PARCEL = {
  standpoint: { x: -95120, y: -95120, from: "where your walk arrived", stance: "embodied" },
  within: [
    { id: "the-town/let-there-be-light", by: "the-town", tier: "constitution" },
    { id: "wright-of-postmark/the-pando-peak-parcel", by: "wright-of-postmark", kind: "parcel" },
  ],
  actions: [entry("say"), entry("leave-mark")],
  actors: ACTORS,
};

test("a parcel with a roster and no portal mounts the bar", async () => {
  // FOUNDER-RULED 2026-08-27: the bar mounts wherever the actors roster is
  // present, parcels included. It SUPERSEDES the ruling of 2026-08-26 — "the
  // cockpit ships inside portal ground; the world page outside portals keeps
  // today's chrome untouched" — under which this exact answer put nothing on the
  // page at all.
  assert.equal(portalOf(ON_A_PARCEL), null, "no portal: the superseded gate would have refused this");
  assert.ok(rosterOf(ON_A_PARCEL), "…and a roster, which the new one asks for");
  assert.equal(cockpitShows(ON_A_PARCEL), true);

  const doc = tinyDom();
  const mounted = mountCockpit({
    document: doc, host: doc.body, svg: null, answer: ON_A_PARCEL, me: MULTI_RESIDENT_ME, grid: null,
    dispatch: async () => ({ ok: true, status: 200, body: {} }),
    readTerms: async () => null, refresh: null,
  });
  assert.ok(mounted, "the bar is on the page on a parcel");
  const html = paintedRoster(doc);
  assert.ok(html.includes(`data-actor="${HUMAN_ACTOR}"`), "with the human's face in the roster");
  mounted.destroy();
});

test("an empty roster is the door saying nobody can act here, and is not a bar", () => {
  // The office's Human row is ALWAYS present where there is a roster at all, so an
  // empty array is not "a roster with nothing in it yet" — it is the absence of
  // one, and widening the gate to `Array.isArray` would have put an empty bar on
  // ground the door said held nobody.
  assert.equal(rosterOf({ actors: [] }), null);
  assert.equal(cockpitShows({ actors: [] }), false);
  assert.equal(cockpitShows({}), false, "and with neither, the island still appends nothing");
});

test("the bridge's parcel arm reads a parcel — and is not reachable from the bar", () => {
  // TWO CLAIMS, and the second is the one worth writing down. `actorsFor`'s parcel
  // arm computes correctly, so a door that has not grown `actors` still seats a
  // human on their household's own ground:
  const noRoster = { ...ON_A_PARCEL, actors: undefined };
  const faces = actorsFor(noRoster, MULTI_RESIDENT_ME);
  const human = faces.find((f) => f.kind === "human");
  assert.equal(human.allowed, true);
  assert.match(human.because, /the-pando-peak-parcel/, "and it names the ground that allowed it");

  // …but nothing in a running page walks it. Reaching it needs the bar mounted
  // with BOTH the roster and the portal absent, and the gate mounts on exactly
  // those two being present. Asserted so the green above is not read as proof of
  // a live path — this arm was dead code under the 08-26 ruling and it is dead
  // code under the 08-27 one, for a different reason: the door answers `actors`
  // now (office 7f0b56e).
  assert.equal(cockpitShows(noRoster), false, "the gate cannot mount the answer the bridge needs");
});

test("a key with no residents resolves to no handle rather than to a guess", () => {
  // A machine key holds residents and no human; a bad read of /me holds nothing.
  // Both deserve the door's own bounce over a name the site invented.
  assert.equal(orientingHandle(null), null);
  assert.equal(orientingHandle({ handles: [] }), null);
  assert.equal(orientingHandle({ handles: [null, "x"] }), "x");
});
