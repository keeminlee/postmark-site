// funding.test.mjs — the funding seam reader's falsifiers.
//   node --test
//
// The seam's surfaces (the pots on the board, the deeds shelf, the numbers
// page) render from three emissions that do not exist yet — no pots.json, no
// deeds.json, no economy.json. So the load-bearing properties are:
//
//   1. everything reads EMPTY and fail-soft when there is nothing;
//   2. the readers refuse what the law refuses (a draft pot is not a board
//      row; a ρ past its constitutional ceiling is not a dial);
//   3. the fixtures agree with each other AND with the law's arithmetic, so a
//      drifting fixture goes red here rather than going quietly wrong on a
//      page;
//   4. holo never leaks into anything that spends.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEEDS_FIXTURE,
  ECONOMY_FIXTURE,
  HOLO_LINE,
  POT_FIXTURE,
  STAMPS_FIXTURE,
  TREASURY_POT,
  deedReads,
  deedsFor,
  livePots,
  loadDeeds,
  loadEconomy,
  loadPots,
  pots,
  readEconomy,
  shelfTotals,
  toDeed,
  toPot,
} from "../src/lib/funding.mjs";

// ── nothing published yet ────────────────────────────────────────────────────

test("no emission reads as nothing, not as a build failure", () => {
  assert.deepEqual(loadDeeds({ path: "/nope/deeds.json" }), []);
  assert.deepEqual(loadPots({ path: "/nope/pots.json" }), []);
  assert.equal(loadEconomy({ path: "/nope/economy.json" }), null);
  assert.equal(readEconomy(null), null);
  assert.deepEqual(pots([]).pots, []);
  assert.deepEqual(pots(null).pots, []);
  assert.deepEqual(livePots(undefined).pots, []);
});

// ── deeds ────────────────────────────────────────────────────────────────────

test("a deed must name patron, pot, date, epoch and dollars", () => {
  const whole = DEEDS_FIXTURE[0];
  assert.equal(deedReads(whole), true);
  assert.equal(deedReads({ ...whole, patron: "" }), false, "no patron");
  assert.equal(deedReads({ ...whole, pot: "Not A Slug" }), false, "pot id must be a slug");
  assert.equal(deedReads({ ...whole, date: "2026-08" }), false, "date is YYYY-MM-DD");
  assert.equal(deedReads({ ...whole, epoch: "2026-08-31" }), false, "epoch is YYYY-MM");
  assert.equal(deedReads({ ...whole, usd: 0 }), false, "a deed witnesses real dollars");
  assert.equal(deedReads({ ...whole, holo: undefined }), false, "holo must be stated, even as 0");
});

test("holo 0 is a whole deed — grant and treasury dollars mint nothing", () => {
  const grant = DEEDS_FIXTURE.find((d) => d.pot === TREASURY_POT);
  assert.ok(grant, "the fixture must carry a zero-holo treasury deed");
  assert.equal(grant.holo, 0);
  assert.equal(deedReads(grant), true, "a zero-holo deed reads whole");
  assert.equal(toDeed(grant).what, "the town, direct", "the treasury pot names itself in words");
});

test("a deed with no joined title still says what was funded", () => {
  assert.equal(toDeed({ ...DEEDS_FIXTURE[0], title: undefined }).what, "keeping-ec2");
});

test("a shelf is one patron's deeds, newest first, and totals like receipts", () => {
  const shelf = deedsFor("wright", DEEDS_FIXTURE.map(toDeed));
  assert.equal(shelf.length, 2);
  assert.ok(shelf[0].date >= shelf[1].date, "newest first");
  assert.deepEqual(shelfTotals(shelf), { usd: 85, holo: 8 }, "$60 + $25, and only the pot deed minted holo");
  assert.deepEqual(deedsFor("nobody", DEEDS_FIXTURE.map(toDeed)), [], "a handle with no deeds has no shelf");
});

// ── pots ─────────────────────────────────────────────────────────────────────

test("the pot fixture carries the pot file's own field names", () => {
  // The names come from WHITE_PAGES/pot-<id>.json, not from guesses. If someone
  // renames one back to an invented shape, this goes red.
  for (const row of POT_FIXTURE) {
    for (const key of ["pot", "subtype", "status", "title", "source",
      "target_usd_per_epoch", "epoch_cadence", "beneficiary", "received_usd",
      "board", "epoch", "staked", "patrons"]) {
      assert.ok(key in row, `pot fixture row ${row.pot}@${row.epoch} is missing ${key}`);
    }
  }
});

test("every fixture pot reads — the fixture is the grammar's live check", () => {
  const { malformed } = pots(POT_FIXTURE);
  assert.deepEqual(malformed, []);
});

test("a pot is refused for exactly the reasons the law refuses one", () => {
  const whole = POT_FIXTURE[0];
  const why = (patch) => toPot({ ...whole, ...patch });
  assert.equal(why({ pot: "" }).ok, false);
  assert.equal(why({ pot: TREASURY_POT }).ok, false, "the treasury pot is deeds only, never a board row");
  assert.equal(why({ title: "  " }).ok, false);
  assert.equal(why({ status: "filled" }).ok, false, "draft, open, closed — nothing else");
  assert.equal(why({ epoch: "2026" }).ok, false, "epoch is YYYY-MM");
  assert.equal(why({ target_usd_per_epoch: 0 }).ok, false);
  assert.equal(why({ target_usd_per_epoch: 12.5 }).ok, false, "whole dollars");
  assert.equal(why({ received_usd: -1 }).ok, false);
  // and the ones the law permits
  assert.equal(why({ beneficiary: null }).ok, true, "an unnamed beneficiary is a state, not a fault");
  assert.equal(why({ received_usd: 0 }).ok, true, "an unfed pot is a pot");
  assert.equal(why({ source: "" }).ok, true, "thin is not broken");
});

test("the roll drops a torn line without tearing the pot", () => {
  const p = toPot({
    ...POT_FIXTURE[0],
    patrons: [{ patron: "wright", usd: 40, holo: 3 }, { patron: "", usd: 10 }, { patron: "rei", usd: 0 }],
  });
  assert.equal(p.ok, true);
  assert.deepEqual(p.patrons, [{ patron: "wright", usd: 40, holo: 3 }]);
});

test("pots sort open first, newest epoch first, and drafts stay off the board", () => {
  const live = livePots(POT_FIXTURE);
  // the slug is in the key because the fixture now holds two pots, and two
  // open rows share an epoch — without it the tie reads as either order
  assert.deepEqual(live.pots.map((p) => `${p.status}:${p.epoch}:${p.pot}`),
    ["open:2026-10:keeping-ec2", "open:2026-09:darko-fund", "open:2026-09:keeping-ec2",
     "open:2026-09:keeping-tin", "open:2026-09:keeping-unsaid", "closed:2026-08:keeping-ec2"]);
  assert.equal(live.drafts.length, 1, "the draft pot is held back and counted");
  assert.equal(live.drafts[0].pot, "keeping-domains");
  assert.ok(!live.pots.some((p) => p.status === "draft"),
    "a draft pot on the board would be the site asking for money the town has not asked for");
});

test("progress fills the bar but never rewrites the dollars", () => {
  const fed = toPot(POT_FIXTURE[0]);
  assert.equal(fed.received, 90);
  assert.equal(fed.target, 150);
  assert.equal(fed.progress, 0.6);
  const over = toPot({ ...POT_FIXTURE[0], received_usd: 200 });
  assert.equal(over.progress, 1, "the bar clamps");
  assert.equal(over.received, 200, "the number does not — an over-fed pot reads as over-fed");
});

// ── the town's numbers ───────────────────────────────────────────────────────

test("the dials read only as a whole set", () => {
  assert.ok(readEconomy(ECONOMY_FIXTURE), "the fixture is a whole set");
  for (const key of ["sigma", "rho", "rho_constitutional_ceiling", "treasury_usd",
    "primary_mint_earned", "holo_issued"]) {
    assert.equal(readEconomy({ ...ECONOMY_FIXTURE, [key]: undefined }), null,
      `half a set of numbers must not render as the town's (dropped ${key})`);
  }
});

test("a ρ past its constitutional ceiling is not a dial to render", () => {
  // keepingDial() refuses it in the ledger; the reader mirrors that refusal
  // rather than drawing a bar that overflows its own ceiling.
  assert.equal(readEconomy({ ...ECONOMY_FIXTURE, rho: 0.6 }), null);
  assert.ok(readEconomy({ ...ECONOMY_FIXTURE, rho: 0.5 }), "at the ceiling is lawful");
  assert.equal(readEconomy({ ...ECONOMY_FIXTURE, sigma: 1 }), null, "σ is a split, strictly inside 0..1");
});

test("the holo cap is the law's formula, not a stored number", () => {
  // LAW R10 (Keemin, 2026-08-21): "Owner of the number: `ECONOMY-DIALS.json
  //          § law_side.keeping.rho`; every other surface reads it rather than
  //          restating it."
  // So this test asserts the FORMULA and reads ρ from the dial. A hard-coded cap
  // here would be a second dial, and it would go red on a lawful ballot instead
  // of on a bug — which is the failure this whole alignment pass exists to fix.
  const e = readEconomy(ECONOMY_FIXTURE);
  assert.equal(e.holoCap, Math.floor(e.rho * e.primaryMint), "ρ × what the town has minted");
  assert.equal(e.overCap, false);
  assert.equal(readEconomy({ ...ECONOMY_FIXTURE, holo_issued: e.holoCap + 1 }).overCap, true);
  // and the cap MOVES with the dial — the proof it is derived, not stored
  const halved = readEconomy({ ...ECONOMY_FIXTURE, rho: e.rho / 2 });
  assert.equal(halved.holoCap, Math.floor((e.rho / 2) * e.primaryMint));
  assert.notEqual(halved.holoCap, e.holoCap, "a stored cap would not have moved");
});

test("the backing gauge is dollars per ✧, and says nothing when nothing is minted", () => {
  assert.equal(readEconomy(ECONOMY_FIXTURE).backing, 175 / 19);
  assert.equal(readEconomy({ ...ECONOMY_FIXTURE, holo_issued: 0 }).backing, null);
});

// ── the fixtures tell ONE story ──────────────────────────────────────────────

test("holo issued equals the deeds that minted it", () => {
  const minted = DEEDS_FIXTURE.reduce((n, d) => n + d.holo, 0);
  assert.equal(minted, ECONOMY_FIXTURE.holo_issued,
    "the numbers page and the deeds shelves must be telling the same story");
});

test("the closed pot's roll is the same holo its patrons' deeds carry", () => {
  const closed = toPot(POT_FIXTURE.find((p) => p.status === "closed"));
  for (const entry of closed.patrons) {
    const deed = DEEDS_FIXTURE.find((d) => d.patron === entry.patron && d.pot === closed.pot && d.epoch === closed.epoch);
    assert.ok(deed, `no deed behind ${entry.patron}'s line on the ${closed.epoch} roll`);
    assert.equal(deed.usd, entry.usd);
    assert.equal(deed.holo, entry.holo);
  }
  assert.equal(closed.received, closed.patrons.reduce((n, p) => n + p.usd, 0),
    "received dollars are what the roll adds up to");
});

test("the σ-split floors, and the seam keeps the change", () => {
  // THE LAW THIS ASSERTS — capture doc § 8, quoted:
  //   "(1−σ) × pot mints to payers as Holo, by dollar share."
  // and R1 (floor both legs, remainder burns un-minted).
  //
  // The σ leg is deliberately NOT asserted here, because this fixture never
  // renders a number for it. § 8 sends it "back to the keepers as their own
  // equity, at par of their burn" — the KEEPERS being the households that staked
  // (§ 8: "Households stake keeping-stakes on it"), not the pot's beneficiary —
  // and R12 names it ordinary mint, source-tagged, with no liquid coin. D1 puts
  // it in the ownership READ rather than in any tense, and the ownership read is
  // the door's, not the site's: the site names the leg in words and shows no
  // number for it.
  //
  // 40✦ burned at σ=0.5: the stakers' leg floor(20), the payers' pool
  // floor(20) shared by dollar and floored per receipt. 8 + 6 + 5 = 19, so 1✧
  // is never minted at all.
  const BURNED = 40;
  const closed = toPot(POT_FIXTURE.find((p) => p.status === "closed"));
  const pool = Math.floor((1 - ECONOMY_FIXTURE.sigma) * BURNED);
  for (const p of closed.patrons) {
    assert.equal(p.holo, Math.floor(pool * p.usd / closed.received),
      `${p.patron}'s holo must be the floored dollar share, not a rounded one`);
  }
  const handed = closed.patrons.reduce((n, p) => n + p.holo, 0);
  assert.equal(handed, 19);
  assert.ok(handed < pool, "every remainder burns un-minted — the seam keeps the change");
});

test("no household's holo exceeds its ρ-cap", () => {
  // THE LAW THIS ASSERTS — ECONOMY-DIALS.json law_side.keeping._holo, quoted:
  //   "rho caps it: a household's holo <= rho x its RHO BASE, clipped at
  //    conversion, excess recorded as deed only."
  // and R12: "holo cap base = earned primary mint + keeping mint". The fixture
  // households hold no keeping mint, so their base is their mint_count. ρ is
  // read from the dial, never restated (R10).
  const { rho } = ECONOMY_FIXTURE;
  for (const [handle, s] of Object.entries(STAMPS_FIXTURE)) {
    assert.ok(s.holo <= Math.floor(rho * s.mint_count),
      `${handle} holds ${s.holo}✧ against a cap of ${Math.floor(rho * s.mint_count)}`);
  }
});

test("the mintbar fixture agrees with the deeds it came from", () => {
  for (const [handle, s] of Object.entries(STAMPS_FIXTURE)) {
    const owed = DEEDS_FIXTURE.filter((d) => d.patron === handle).reduce((n, d) => n + d.holo, 0);
    assert.equal(s.holo, owed, `${handle}'s bar shows ${s.holo}✧ but their deeds minted ${owed}✧`);
  }
});

// ── holo is soulbound ────────────────────────────────────────────────────────

test("holo is never summed into anything that spends", () => {
  // THE LAW THIS ASSERTS — capture doc § 9, quoted:
  //   "Soulbound equity denomination: no stake, no vote, no transfer. Counted
  //    in ownership and the backing gauge; rendered on the household's page.
  //    Holographic — you can see it; there's nothing inside to spend."
  for (const [handle, s] of Object.entries(STAMPS_FIXTURE)) {
    assert.equal(s.assets, s.liquid + s.staked,
      `${handle}'s assets must be liquid + staked — holo is not a holding`);
    assert.ok(s.holo <= s.mint_count || s.mint_count === 0,
      `${handle}: holo is a separate record, never folded into the mint count`);
  }
});

test("the ruling's line is one string, so every surface says it identically", () => {
  assert.equal(HOLO_LINE, "a record of contribution, not a promise of profit");
});

// ── the two pot shapes ───────────────────────────────────────────────────────
// A pot either closes on an epoch or it never closes at all, and the surfaces
// say different things for each. Before `close` existed the site could not tell
// them apart, so every pot was sold with an epoch pot's promise.

test("the elastic pot closes on its own roll — a month's close runs only if the accumulated roll totals at least min_close_usd", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _close, quoted:
  //   "ELASTIC …: a month's close runs only if the accumulated roll — carried
  //    dollars plus this month's — totals at least min_close_usd; otherwise
  //    dollars and stakes both stand and ride to the next month. When it runs,
  //    every standing stake converts in full … and holo splits by dollar share
  //    across the WHOLE accumulated roll … Nothing is ever refused at intake."
  const roll = toPot(POT_FIXTURE.find((p) => p.pot === "darko-fund"));
  assert.equal(roll.ok, true, roll.reason);
  assert.equal(roll.close, "elastic", "the pot file's own word reaches the page");
  assert.equal(roll.closes, true, "an elastic pot DOES close — despite posting no target");
  assert.equal(roll.target, null, "and it posts none, so no surface may draw it a bar");
  assert.equal(roll.progress, null, "a roll is short of nothing");

  // § _min_close: "Owner of the number: this file; every surface reads it."
  assert.equal(roll.minCloseUsd, 5, "the ceremony's floor is read, not written down");
  const noFloor = toPot({ ...POT_FIXTURE.find((p) => p.pot === "darko-fund"), min_close_usd: undefined });
  assert.equal(noFloor.minCloseUsd, null,
    "an emission with no floor yields null, so a surface can decline to name one");
  assert.equal(noFloor.closes, true, "and the pot still closes — the floor gates the ceremony, not the shape");
});

test('a standing box does not close at all — "nothing here ever burns or mints"', () => {
  // THE LAW THIS ASSERTS — the shape as § _close spelled it on the morning of
  // 2026-08-23, before the box learned the elastic close:
  //   "a standing box, not an epoch pot — gifts are witnessed, never converted;
  //    nothing here ever burns or mints"
  // Nothing live wears this today. It stays under test for the reason it stays
  // in the fixture: a rendering dropped the moment nothing wears the shape is a
  // rendering that breaks the next time something does.
  const box = toPot(POT_FIXTURE.find((p) => p.pot === "keeping-tin"));
  assert.equal(box.ok, true, box.reason);
  assert.equal(box.close, "none");
  assert.equal(box.closes, false, "so no surface may promise it a close");
});

test("the explicit word outranks the derivation, in BOTH directions", () => {
  // Either half failing would be a silent mis-sale. If "elastic" lost to a null
  // target, the roll would be rendered as a box that never pays back; if "none"
  // lost to a posted target, a box would be sold an epoch pot's promise.
  const epoch = POT_FIXTURE.find((p) => p.pot === "keeping-ec2");
  const roll = POT_FIXTURE.find((p) => p.pot === "darko-fund");
  assert.equal(toPot(epoch).closes, true, "a pot with a posted need closes on it");
  assert.equal(toPot({ ...epoch, close: "none" }).closes, false,
    '"none" beats a posted target');
  assert.equal(toPot({ ...roll, close: "elastic" }).closes, true,
    '"elastic" beats a null target');
});

test('an emission with no `close` falls back, because "A pot with no target cannot close"', () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-keeping-ec2.json § _target, quoted:
  //   "A pot with no target cannot close."
  // So an emission predating the `close` field is not unreadable: its target
  // answers the question the missing field would have. The derivation is the
  // FALLBACK — the test above proves the explicit word is the primary.
  //
  // AND THE THING THE BOOLEAN CANNOT SAY. This row and the standing box both
  // read `closes: false`, and they are not the same state: one is the town
  // saying "never", the other is the town not having said. `close` tells them
  // apart, and the surfaces branch on it rather than on the boolean — which is
  // not hypothetical, because the live emission is exactly this row today.
  const unsaid = toPot(POT_FIXTURE.find((p) => p.pot === "keeping-unsaid"));
  assert.equal(unsaid.ok, true, unsaid.reason);
  assert.equal(unsaid.close, null, "the record has not said");
  assert.equal(unsaid.closes, false, "so the shape falls back to the target's answer");

  const box = toPot(POT_FIXTURE.find((p) => p.pot === "keeping-tin"));
  assert.equal(box.closes, unsaid.closes, "the boolean cannot tell these apart —");
  assert.notEqual(box.close, unsaid.close, "— and the word is the only thing that can");
});

test("every pot in the live emission answers whether it closes", () => {
  // Against the file the site actually ships, not a fixture — the fixture can
  // be right while the emission on disk is stale or half-migrated.
  const live = JSON.parse(readFileSync(new URL("../src/data/postmark/pots.json", import.meta.url), "utf8"));
  for (const row of livePots(live).pots) {
    assert.equal(typeof row.closes, "boolean",
      `pot ${row.id} cannot say whether it closes, so no surface can say it honestly`);
    if (row.target == null) {
      assert.equal(row.closes, false, `pot ${row.id} posts no need, so it has nothing to close on`);
    }
  }
});
