// freshness-live.test.mjs — what the hand-poll is allowed to claim.
//
//   node --test test/freshness-live.test.mjs
//
// THE LAW THESE ASSERT, verbatim from its source:
//
//   LOGOS/INDEX.md § the atomic laws, 5 — "A rendering may say less than its
//   source, never other." The whole design of the poll answers this clause: it
//   refreshes the pane and the profile's plain strings, and it REPORTS the
//   prose rather than repainting it, because repainting markdown client-side
//   would need a second renderer and a second renderer is a second answer. So
//   the sentences below are the surface under test — a poll that overclaims is
//   the failure mode, not a poll that says too little.
//
//   LOGOS/reads-and-affordances.md § the decoupling — "every READ is a
//   projection with a policy". The static page is one projection and the live
//   poll is another; the poll's job is to make the difference legible, which is
//   why the office's `settled_as_of` is quoted back rather than swallowed.
//
// THE ONE THAT MATTERS MOST is L3. The site and the office ride their own
// trains and either may land first, so a live office that does not stamp
// freshness is not hypothetical — it is the state of the world for as long as
// the two releases are apart. The tempting bug is to fold that into "nothing
// has moved", which is a page reporting an all-clear it never received.

import assert from "node:assert/strict";
import test from "node:test";

import { describePoll, describeFailure, movedFields, PAPER_LABEL, TENSE_PHRASE } from "../src/lib/freshness.mjs";

const stamp = (fields, extra = {}) => ({ freshness: { tense: "written", settled_as_of: "abc123def456", fields, ...extra } });
const settledCard = () => stamp({
  "address.body": { tense: "settled", act: "address-body" },
  "address.data": { tense: "settled", act: "address-fields" },
  home: { tense: "settled", act: "home" },
  profile: { tense: "settled", act: "profile" },
  window_state: { tense: "settled", act: "window" },
}, { tense: "settled" });

// ═══════════════════════════════════════════════════════════════════════════

test("L1 · a poll that found nothing says so, and names the record it agrees with", () => {
  const said = describePoll(settledCard(), { paneReloaded: true });
  assert.equal(said.cls, "ok");
  assert.match(said.text, /^Polled just now/, "the founder's word for the top rung, said literally");
  assert.match(said.text, /nothing has moved/);
  assert.match(said.text, /record abc123de\b/, "the sha is quoted back so the claim is checkable");
  assert.doesNotMatch(said.text, /settled/,
    "a settled field is one that did not move — the line never lists the fields that are fine");
});

test("L2 · a poll that found movement names each paper AND its tense, never one without the other", () => {
  const said = describePoll(stamp({
    "address.body": { tense: "settled", act: "address-body" },
    "address.data": { tense: "settled", act: "address-fields" },
    home: { tense: "written", act: "home" },
    profile: { tense: "settled", act: "profile" },
    window_state: { tense: "pending", act: "window", seq: 41 },
  }), { paneReloaded: true });

  assert.equal(said.cls, "warn");
  assert.match(said.text, /2 things have moved/);
  assert.match(said.text, /their home page \(already in the record, not yet in the page\)/);
  assert.match(said.text, /their window \(made at the door, settling at the next ferry crossing\)/);
  assert.match(said.text, /The window above has been reloaded and is current\./,
    "the pane is the one thing the poll genuinely made current — it may say so, and only when it did");
  assert.match(said.text, /still the baked copy/,
    "and it must say what it did NOT repaint, or a visitor reads a stale paragraph as fresh");

  // …and it must not claim a reload it did not perform.
  const unopened = describePoll(stamp({ home: { tense: "written", act: "home" } }), { paneReloaded: false });
  assert.doesNotMatch(unopened.text, /reloaded/);
  assert.match(unopened.text, /1 thing has moved/, "one is singular");
});

test("L3 · AN OFFICE THAT DOES NOT STAMP is its own answer, never an all-clear", () => {
  for (const card of [{}, { freshness: null }, { freshness: {} }, null, undefined]) {
    const said = describePoll(card, { paneReloaded: true });
    assert.match(said.text, /does not stamp freshness yet/,
      `an office with no stamp must say so — got: ${said.text}`);
    assert.doesNotMatch(said.text, /nothing has moved/,
      "THE FALSIFIER: folding 'cannot tell' into 'nothing moved' is a page reporting an all-clear it never received");
    assert.equal(said.cls, null, "not green — the poll learned nothing to be green about");
  }
});

test("L4 · a paper the office grows and this file has not learned is still NAMED, never dropped", () => {
  const said = describePoll(stamp({ doorplate: { tense: "written", act: "doorplate" } }));
  assert.match(said.text, /1 thing has moved since this page was built: doorplate \(already in the record/,
    "an unnamed change is still a change; dropping it would make the line read 'nothing moved'");
  assert.equal(said.cls, "warn");

  // the same for a rung this file has not learned
  const rung = describePoll(stamp({ profile: { tense: "hearsay" } }));
  assert.match(rung.text, /their profile \(hearsay\)/);
});

test("L5 · movedFields is the whole filter, and it holds nothing back", () => {
  assert.deepEqual(movedFields(null), []);
  assert.deepEqual(movedFields({}), []);
  assert.deepEqual(movedFields({ fields: {} }), []);
  assert.deepEqual(movedFields({ fields: { profile: { tense: "settled" } } }), []);
  assert.deepEqual(movedFields({ fields: { profile: {} } }), [],
    "a field with no tense at all is not evidence of movement — the office always stamps one");
  assert.equal(movedFields({ fields: {
    "address.body": { tense: "written" }, "address.data": { tense: "pending" },
    home: { tense: "settled" }, profile: { tense: "written" }, window_state: { tense: "pending" },
  } }).length, 4);
});

test("L6 · a poll that FAILED leaves the page standing and says which way it went", () => {
  const said = describeFailure(new Error("the office answered 503"));
  assert.equal(said.cls, "warn");
  assert.match(said.text, /the office answered 503/, "the reason is quoted, not summarised into 'something went wrong'");
  assert.match(said.text, /Nothing on this page has changed/,
    "THE FALSIFIER: a failed poll that read like a successful one would be the worst outcome of all — a visitor trusting a stale page BECAUSE they refreshed it");
  assert.doesNotMatch(said.text, /Polled just now/, "nothing was polled");
  assert.match(describeFailure(undefined).text, /\(network\)/, "and a throw with no message still names a cause");
});

test("L7 · every rung the office can stamp has a phrase, and `settled` deliberately has none", () => {
  // The office's rungs are settled / written / pending (paper-fresh.mjs § TENSE).
  assert.deepEqual(Object.keys(TENSE_PHRASE).sort(), ["pending", "written"]);
  assert.equal(TENSE_PHRASE.settled, undefined,
    "settled has no phrase because it is never said out loud — see L1");
  // and every field the office composes today is named for a human
  for (const field of ["address.body", "address.data", "home", "profile", "window_state"])
    assert.ok(PAPER_LABEL[field], `${field} is a paper the office stamps and this map must name it`);
});
