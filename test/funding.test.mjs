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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  DEEDS_FIXTURE,
  FOUNDER_ACCOUNT,
  HOLO_NAME_LINE,
  holoPerDollar,
  beneficiaryLabel,
  firstCloseLabel,
  epochLabel,
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
  patronLabel,
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
    ["open:2026-10:darko-fund", "open:2026-10:keeping-ec2",
     "open:2026-09:darko-fund", "open:2026-09:keeping-ec2",
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
  // THE FIXTURE MUST MATCH THE RECORD. keeping-ec2 says close: "epoch" in the
  // town since 2026-08-25, and a fixture that lags it is a green suite
  // asserting a world that no longer exists — which is how the DEV rendering
  // of this pot went on being drawn by the boolean long after the word existed.
  assert.equal(epoch.close, "epoch", "the fixture carries the word the town's pot file states");
  assert.equal(toPot(epoch).closes, true, "a pot with a posted need closes on it");
  assert.equal(toPot({ ...epoch, close: "none" }).closes, false,
    '"none" beats a posted target');
  assert.equal(toPot({ ...roll, close: "elastic" }).closes, true,
    '"elastic" beats a null target');
  // "epoch" — the third word, made explicit in the record 2026-08-25. It joins
  // the same both-ways law: said, it answers, and the target is only consulted
  // when nothing was said. The pair below is one the record should never emit
  // (an epoch pot posts a need), and that is exactly why it is the probe: it is
  // the only shape where the word and the derivation disagree, so it is the
  // only one that can prove which of the two is being read.
  assert.equal(toPot({ ...epoch, close: "epoch" }).closes, true, '"epoch" says it closes');
  assert.equal(
    toPot({ ...epoch, close: "epoch", target_usd_per_epoch: null, uncapped: true }).closes, true,
    '"epoch" beats a null target, the same way "elastic" does');
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
    // A TARGETLESS POT USED TO MEAN "NEVER CLOSES", and this asserted exactly
    // that. The elastic ruling retired the equivalence: darko posts no target
    // and closes anyway, on its own floor. So the rule is the derivation's own
    // order — the explicit word first, the target only when the record is
    // silent — and this now pins that instead.
    if (row.close === "elastic") {
      assert.equal(row.closes, true, `pot ${row.id} says elastic, so it closes on its floor`);
    } else if (row.close === "epoch") {
      assert.equal(row.closes, true, `pot ${row.id} says epoch, so it closes at the epoch`);
    } else if (row.close === "none") {
      assert.equal(row.closes, false, `pot ${row.id} says it never closes`);
    } else if (row.target == null) {
      assert.equal(row.closes, false,
        `pot ${row.id} posts no need and the record names no close, so nothing can run`);
    }
  }
});

// ── whose name stands on a pot ───────────────────────────────────────────────

test("the founder's account renders as the town, and every other handle as itself", () => {
  // THE RULING THIS ASSERTS — the founder, 2026-08-23: a pot beneficiary that
  // is his own account shows the TOWN'S name on the card, not his GitHub
  // handle. He IS the town's infrastructure, so the town's name is the honest
  // label; a personal handle beside a "Fund →" reads like paying a person.
  assert.equal(beneficiaryLabel(FOUNDER_ACCOUNT), "Postmark");
  assert.equal(beneficiaryLabel("  " + FOUNDER_ACCOUNT + "  "), "Postmark",
    "the emission's whitespace must not defeat the mapping");

  // EXACTLY ONE ACCOUNT IS MAPPED. Without this, a broadened rule could quietly
  // relabel some other beneficiary as the town — which would be the site lying
  // about where money goes.
  for (const other of ["wright", "the-town/the-box", "keeminlee2", "Keeminlee"]) {
    assert.equal(beneficiaryLabel(other), other, `${other} must render as itself`);
  }
  assert.equal(beneficiaryLabel(null), null, "an unnamed beneficiary stays unnamed");
  assert.equal(beneficiaryLabel("   "), null, "and so does a blank one");
});

test("the label is a display mapping — the routing truth is never rewritten", () => {
  // The pot files' `beneficiary` field is where the dollars actually go, and
  // deriveEpochClose refuses a pot without one. If the mapping ever overwrote
  // it, the site would be reporting a destination the town does not use.
  const pot = toPot({ ...POT_FIXTURE.find((p) => p.pot === "darko-fund"), beneficiary: FOUNDER_ACCOUNT });
  assert.equal(pot.beneficiary, FOUNDER_ACCOUNT, "the routing handle survives untouched");
  assert.equal(pot.beneficiaryLabel, "Postmark", "and the label beside it is the town");

  // and against the file the site actually ships
  const live = JSON.parse(readFileSync(new URL("../src/data/postmark/pots.json", import.meta.url), "utf8"));
  for (const row of livePots(live).pots) {
    if (row.beneficiary === FOUNDER_ACCOUNT) {
      assert.equal(row.beneficiaryLabel, "Postmark", `pot ${row.id} still shows the founder's handle`);
    } else if (row.beneficiary) {
      assert.equal(row.beneficiaryLabel, row.beneficiary, `pot ${row.id} relabelled a beneficiary that is not the founder`);
    }
  }
});

// ── what an elastic pot would pay if it closed now ───────────────────────────

test("the estimate is the payers' side of the split, spread across the roll", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _close, quoted:
  //   "When it runs, every standing stake converts in full … and holo splits by
  //    dollar share across the WHOLE accumulated roll"
  // so the pool is (1 − σ) of a burn equal to the whole staked mass, and it is
  // divided by the dollars that will share it.
  const econ = readEconomy(ECONOMY_FIXTURE);
  const roll = toPot(POT_FIXTURE.find((p) => p.pot === "darko-fund"));
  assert.equal(roll.staked, 4);
  assert.equal(roll.received, 2);
  assert.equal(roll.minCloseUsd, 5);
  // (1 − 0.5) × 4 = 2 holo, over max(roll 2, floor 5) = 5  ->  0.4
  assert.equal(holoPerDollar(roll, econ), 0.4);

  // THE FLOOR IS THE DENOMINATOR while the roll is under it, because a close
  // cannot run below it. Quoting today's smaller roll would hand a giver a
  // number that shrinks the moment anyone else gives.
  const under = toPot({ ...POT_FIXTURE.find((p) => p.pot === "darko-fund"), received_usd: 1 });
  assert.equal(holoPerDollar(under, econ), 0.4, "still divided by the floor, not by $1");

  // and past the floor the roll itself is the divisor
  const over = toPot({ ...POT_FIXTURE.find((p) => p.pot === "darko-fund"), received_usd: 20 });
  assert.equal(holoPerDollar(over, econ), 0.1, "(0.5 × 4) ÷ 20");
});

test("the estimate refuses to exist wherever it would be a fiction", () => {
  const econ = readEconomy(ECONOMY_FIXTURE);
  const find = (slug) => toPot(POT_FIXTURE.find((p) => p.pot === slug));

  // A POT WITH NO CLOSE TO RUN has nothing to estimate — a number beside
  // "nothing ever mints back" would contradict the card's own sentence.
  // STAKED ON PURPOSE: both fixture rows sit at zero stakes, so testing them as
  // they are proved only that the zero-stake guard works and left this one
  // unexercised. Its own can-fail flip caught that.
  const stakedBox = toPot({ ...POT_FIXTURE.find((p) => p.pot === "keeping-tin"), staked: 40 });
  assert.equal(stakedBox.closes, false, "the standing box still never closes");
  assert.equal(holoPerDollar(stakedBox, econ), null,
    "and no estimate, however much is staked on it");
  const stakedUnsaid = toPot({ ...POT_FIXTURE.find((p) => p.pot === "keeping-unsaid"), staked: 40 });
  assert.equal(holoPerDollar(stakedUnsaid, econ), null,
    "nor for a pot the record has not spoken for");
  assert.equal(holoPerDollar(find("keeping-tin"), econ), null, "the standing box as it ships");
  // nothing staked means no burn, so no pool
  assert.equal(holoPerDollar(toPot({ ...POT_FIXTURE.find((p) => p.pot === "darko-fund"), staked: 0 }), econ),
    null, "an unstaked pot");
  // and no dials published means no σ to split by
  assert.equal(holoPerDollar(find("darko-fund"), null), null, "no economy emission");
});

test("σ is read, so a dial that moves moves the estimate", () => {
  // R10: "every other surface reads it rather than restating it." If σ were
  // typed anywhere in this path, this would not budge.
  const roll = toPot(POT_FIXTURE.find((p) => p.pot === "darko-fund"));
  const half = readEconomy(ECONOMY_FIXTURE);
  const quarter = readEconomy({ ...ECONOMY_FIXTURE, sigma: 0.25 });
  assert.equal(holoPerDollar(roll, half), 0.4);
  assert.equal(holoPerDollar(roll, quarter), 0.6, "a smaller σ leaves a larger holo side");
});

test("the emission stamps when it was made, and the reader carries it", () => {
  // A quiet market and a stale page look identical on a money surface without
  // this. The emitter owns the value; the pot row carries it across.
  const stamped = toPot({ ...POT_FIXTURE[0], generated_at: "2026-08-23T20:56:36.252Z" });
  assert.equal(stamped.generatedAt, "2026-08-23T20:56:36.252Z");
  assert.equal(toPot({ ...POT_FIXTURE[0], generated_at: undefined }).generatedAt, null,
    "an emission that predates the field reads null, not a guess");

  // against the file the site ships — the hand-carried emission must carry it
  const live = JSON.parse(readFileSync(new URL("../src/data/postmark/pots.json", import.meta.url), "utf8"));
  for (const row of livePots(live).pots) {
    assert.ok(row.generatedAt, `pot ${row.id} has no generated_at — the tick would go blank`);
  }
});

test("the shipped emission carries the DARKO box's own close word", () => {
  // THE POINT OF THE HAND-CARRY. sync-atlas.yml builds pots.json with MAIN's
  // emitter, which has no `close` passthrough yet, so the card wore the
  // record-hasn't-said branch while the town had spoken plainly. This pins
  // that the file on this branch no longer does.
  const live = JSON.parse(readFileSync(new URL("../src/data/postmark/pots.json", import.meta.url), "utf8"));
  const darko = livePots(live).pots.find((p) => p.pot === "darko-fund");
  assert.ok(darko, "the DARKO box must be in the shipped emission");
  assert.equal(darko.close, "elastic", "and carry its own word");
  assert.equal(darko.minCloseUsd, 5, "and its floor");
  assert.equal(darko.closes, true, "so it no longer reads as a pot with no close");
});

test("the fixture carries an elastic roll on BOTH sides of its floor", () => {
  // The two states look different and say different things — under the floor
  // the bar fills toward a close, over it the bar is full and the roll keeps
  // climbing. A fixture holding only the first leaves the second unrenderable
  // and therefore unreviewed.
  const rolls = POT_FIXTURE.filter((p) => p.close === "elastic").map(toPot);
  assert.ok(rolls.length >= 2, "two elastic rows, not one");
  assert.ok(rolls.some((p) => p.received < p.minCloseUsd), "one under its floor");
  assert.ok(rolls.some((p) => p.received > p.minCloseUsd), "and one past it");
});

// ── the first close, and the epoch a reader is shown ────────────────────────

test('"end of September" is said only when the date IS the end of September', () => {
  // LAW (pot-*.json § _first_close): "the first month closes at the END of
  //     September". The phrase is the founder's, and it is only TRUE of a date
  //     that is actually the month's last day — a close on the 12th is not the
  //     end of anything, and rounding it into that phrase would be a lie about
  //     when a patron's money converts.
  assert.equal(firstCloseLabel("2026-09-30"), "end of September");
  assert.equal(firstCloseLabel("2026-02-28"), "end of February");
  assert.equal(firstCloseLabel("2028-02-29"), "end of February", "a leap February ends on the 29th");
  // NOT the end of the month → the plain date, never the phrase
  assert.equal(firstCloseLabel("2026-09-12"), "12 September");
  assert.equal(firstCloseLabel("2028-02-28"), "28 February", "the 28th is not the end of a leap February");
  // absent or malformed is a real state, not a crash and not a guess
  assert.equal(firstCloseLabel(null), null);
  assert.equal(firstCloseLabel("2026-09"), null);
  assert.equal(firstCloseLabel("soon"), null);
  assert.equal(firstCloseLabel("2026-13-01"), null);
});

test("the epoch a reader is shown names its month; the row keeps the stamp", () => {
  assert.equal(epochLabel("2026-09"), "September 2026");
  assert.equal(epochLabel("2027-01"), "January 2027");
  assert.equal(epochLabel("2026-9"), null, "the stamp is YYYY-MM or it is nothing");
  assert.equal(epochLabel(null), null);
});

test("a pot row carries its first close through the reader", () => {
  // The emitter carries the field; this is the other half — that the reader
  // hands it to the surfaces instead of dropping it on the floor.
  const row = { ...POT_FIXTURE[0], epoch: "2026-09", first_close: "2026-09-30" };
  const read = toPot(row);
  assert.equal(read.ok, true, read.reason);
  assert.equal(read.firstClose, "2026-09-30");
  assert.equal(read.firstCloseLabel, "end of September");
  assert.equal(read.epochLabel, "September 2026");

  // and a pot with no first close says so as null rather than inventing one —
  // the surfaces branch on it, so a fabricated date would put a close on a page
  // for a pot the town has never dated
  const undated = toPot({ ...POT_FIXTURE[0], first_close: undefined });
  assert.equal(undated.ok, true, undated.reason);
  assert.equal(undated.firstClose, null);
  assert.equal(undated.firstCloseLabel, null);
});

// ── the household's shelf speaks plain words ─────────────────────────────────

test("the household's funding shelf says the record in plain words, with no noun standing in for it", () => {
  // THE LAW, in the founder's own words (2026-08-26): "'deeds' were NOT the way
  // we were taking this — that needs to be removed." Provenance: the 2026-08-24
  // deeds-as-ownership-register proposal (deeds replacing holo) was ideation and
  // was never adopted; the sitting re-derived holo. So the record-of-dollars
  // concept survives as PLAIN PROSE ONLY — no replacement noun, ever.
  //
  // WHAT THIS DOES NOT ASSERT, deliberately: the reader's identifiers
  // (loadDeeds / toDeed / deedsFor) and the deeds.json emission contract still
  // carry the ledger's own grammar. That rename is a data-contract change,
  // deferred to the coordinated office/machinery pass on POS-61 — so this test
  // reads the TEMPLATE's rendered-facing strings, never the frontmatter, and a
  // green here is not a claim about the ledger's vocabulary.
  const file = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");
  const template = file.slice(file.indexOf("---", 3) + 3);

  // 1. nothing a browser receives carries the word. Class names ship in the
  //    markup, so they are as visible as the prose is.
  const classes = [...template.matchAll(/class="([^"]*)"/g)].map((m) => m[1]);
  const offenders = classes.filter((c) => /deed/i.test(c));
  assert.deepEqual(offenders, [], `these class names still ship the word: ${offenders.join(", ")}`);
  assert.equal(/<span>Deeds<\/span>/.test(template), false, "the shelf heading still reads Deeds");
  assert.equal(/deed only/i.test(template), false, "the zero-holo row still says 'deed only'");

  //    ...INCLUDING HTML COMMENTS, which is not a hypothetical: the first cut
  //    of this sweep explained the ruling in an <!-- --> comment above the
  //    shelf, and Astro ships those verbatim, so the word came back on all
  //    300-odd household pages. Only the built-output grep caught it. A
  //    brace-slash-star comment is stripped; an HTML one is published.
  const htmlComments = [...template.matchAll(/<!--[\s\S]*?-->/g)].map((m) => m[0]);
  const talkative = htmlComments.filter((c) => /deed/i.test(c));
  assert.deepEqual(talkative, [],
    "an HTML comment names the word, and HTML comments are shipped to the reader");

  // 2. and it says the plain thing instead — a sweep that merely deleted the
  //    shelf would pass (1) and be a different failure.
  assert.ok(template.includes("<span>Gifts witnessed</span>"), "the shelf lost its heading");
  assert.ok(template.includes("recorded — no holo minted"),
    "the zero-holo row must still say plainly that nothing minted");

  // 3. the funding FACTS still render — who gave, how much, when, what minted.
  //    The ruling took a word off the page, not the record off the household.
  for (const fact of ["d.what", "fmtDate(d.date)", "d.usd", "d.holo", "deedTotals.usd"]) {
    assert.ok(template.includes(fact), `the shelf stopped rendering ${fact}`);
  }
});

// ── holo is short for holographic stamps, taught once per page ───────────────

// The four surfaces that speak the word. Each must IMPORT the sentence; none
// may retype it, because a second copy is a sentence that can drift.
//
// RE-AIMED 2026-08-30: the first of these was `stamps/index.astro` until The
// Town absorbed it. The surface did not change — the same market, the same
// pots, the same glossary entry — it changed address, so the list follows the
// content rather than the URL it used to sit at.
const HOLO_SURFACES = [
  "../town/pages/town/index.astro",
  "../town/pages/numbers/index.astro",
  "../town/pages/fund/[pot].astro",
  "../town/components/Household.astro",
];

test("the holo expansion has one home, and every surface imports it rather than retyping it", () => {
  // THE LAW, the founder's own (2026-08-26): holo is short for HOLOGRAPHIC
  // STAMPS, and the pages should teach it. The sentence is a shared constant
  // for the same reason HOLO_LINE is one — one home, so a second surface
  // cannot drift a word of it.
  assert.equal(
    HOLO_NAME_LINE,
    "short for holographic stamp — the collector's shiny kind, kept in the album and shown, never spent as postage.",
    "the founder's sentence is verbatim or it is not the founder's sentence",
  );

  for (const rel of HOLO_SURFACES) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.match(src, /import \{[^}]*\bHOLO_NAME_LINE\b[^}]*\} from "@\/lib\/funding\.mjs"/,
      `${rel} must import HOLO_NAME_LINE from the seam's reader`);
    assert.ok(src.includes("{HOLO_NAME_LINE}"),
      `${rel} imports the constant but never renders it`);
    // the half that catches drift: a surface that retyped the sentence would
    // still render correctly today and go quietly wrong at the first edit.
    assert.equal(src.includes("short for holographic stamp"), false,
      `${rel} retypes the sentence instead of reading the constant`);
  }
});

// The built pages are the real surface for the placement rule, so this reads
// them rather than the source: on the fund page the expansion MOVES with the
// pot's close shape, and on a household page it moves with whether the house
// has a shared dashboard — both of which only resolve at render.
const DIST = new URL("../dist-town/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const built = existsSync(DIST);

// Astro escapes the apostrophe in "the collector's shiny kind" to &#39;, so a
// raw includes() of the constant finds NOTHING in built HTML. The first cut of
// these two tests counted zero on every page and went green on the "not twice"
// half — a probe that could not fail. Both now read through here.
const holoTimes = (html) => {
  const plain = String(html).replace(/&#0*39;|&#x0*27;|&apos;/gi, "'");
  return plain.split(HOLO_NAME_LINE).length - 1;
};
const everyBuiltPage = (dir = DIST, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) everyBuiltPage(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
};

// THE GLOSSARY IS EXEMPT from the once-per-page count (founder, 2026-08-26):
// it is where a reader goes to look the word UP, so an entry that withholds
// what the name is short for is the one place restraint becomes a defect.
// Counting "outside the glossary" means CUTTING it out first, and the cut has
// to be anchored on something that survives the build — Astro appends a cid to
// every class, so this anchors on the s-gloss list's opening tag rather than an
// exact class match.
//
// WHICH WAY THIS FAILS, checked rather than assumed: if the anchor ever stops
// matching, the cut becomes a no-op, the glossary's copy stays IN the counted
// text, and /stamps/ reads 2 — RED. A no-op cut cannot hide a violation here;
// it can only invent one. That direction is the whole reason the anchor is
// allowed to be a regex at all.
const GLOSS_OPEN = /<dl class="s-gloss[^"]*"[^>]*>/;
const outsideGlossary = (html) => {
  const open = GLOSS_OPEN.exec(html);
  if (!open) return html;
  const end = html.indexOf("</dl>", open.index);
  return end < 0 ? html : html.slice(0, open.index) + html.slice(end);
};
const insideGlossary = (html) => {
  const open = GLOSS_OPEN.exec(html);
  if (!open) return "";
  const end = html.indexOf("</dl>", open.index);
  return end < 0 ? "" : html.slice(open.index, end);
};

test("no built page teaches the expansion twice in flowing prose", { skip: !built }, () => {
  // THE PLACEMENT RULE, and the whole of it: the FIRST holo mention on a page
  // carries the expansion; every later mention stays bare "✧ holo". A page that
  // said it twice would be the prose budget going, which is the thing the rule
  // exists to prevent. The glossary entry is cut out first and governed by its
  // own test below. Skipped without a build — run `npm run build` first for
  // this one to mean anything.
  const twice = everyBuiltPage()
    .map((p) => [p, holoTimes(outsideGlossary(readFileSync(p, "utf8")))])
    .filter(([, n]) => n > 1);
  assert.deepEqual(twice, [], `these pages teach it more than once: ${twice.map(([p, n]) => `${p} (${n})`).join(", ")}`);
});

test("the glossary's holo entry says what the name is short for", { skip: !built }, () => {
  // The exemption, asserted from the other side: the once-per-page tests cut
  // the glossary out, so without this the entry could quietly lose the
  // expansion and every other probe would stay green.
  const stamps = readFileSync(join(DIST, "town", "index.html"), "utf8");
  const gloss = insideGlossary(stamps);
  assert.ok(gloss, "the glossary anchor stopped matching — the cut in the tests above is a no-op");
  // the cid Astro appends to every tag is why this is not a bare `<dt>holo`
  assert.ok(/<dt[^>]*>holo/.test(gloss), "the glossary lost its holo entry");
  assert.equal(holoTimes(gloss), 1,
    "the glossary's holo entry must carry the expansion, once — it is where a reader looks the word up");
});

test("each money surface teaches it exactly once outside the glossary, in both of the household's shapes", { skip: !built }, () => {
  // Named surfaces first. Every fund page counts, not a sampled one, because
  // the expansion moves between the fine print and the footer with the pot's
  // close shape — a pot whose bullets never name holo would otherwise ship a
  // page that never expands the word at all.
  const named = [join(DIST, "town", "index.html"), join(DIST, "numbers", "index.html")];
  const fundDir = join(DIST, "fund");
  if (existsSync(fundDir)) {
    for (const pot of readdirSync(fundDir)) named.push(join(fundDir, pot, "index.html"));
  }

  // ...and one household page of EACH shape, discovered rather than named, so
  // this keeps testing both shapes as the town's households change. The shared
  // house has a house-level dashboard and the expansion rides its note; the
  // unshared one has no such note and it rides the first member's stamp bar.
  const houses = everyBuiltPage(join(DIST, "households")).map((p) => [p, readFileSync(p, "utf8")]);
  const shared = houses.find(([, h]) => h.includes('class="dash-stamps"'));
  const solo = houses.find(([, h]) => !h.includes('class="dash-stamps"'));
  assert.ok(shared, "no shared household page in the build — the shared shape went untested");
  assert.ok(solo, "no single-resident household page in the build — that shape went untested");

  for (const p of [...named, shared[0], solo[0]]) {
    const n = holoTimes(outsideGlossary(readFileSync(p, "utf8")));
    assert.equal(n, 1, `${p} carries the expansion ${n} times outside the glossary, and the rule is exactly once`);
  }
});


// ════════════════════════════════════════════════════════════════════════════
// THE ROLL SHOWS EVERY RECEIPT — including the ones with no hand on them
// ════════════════════════════════════════════════════════════════════════════

test("a payer the office could not attach to a hand is told apart BY SHAPE, with no list to consult", () => {
  // LAW (postmark-office tools/stripe-watch.mjs, verbatim): "`outside:stripe`
  //     is chosen because a handle can never look like it: `isResidentHandle`
  //     admits only `[a-z0-9-]`, so a colon makes the string unmintable as a
  //     name. A future reader can therefore tell an unattached gift from an
  //     attached one by shape alone, with no list to consult."
  //
  // The site is that future reader. If this ever needed a list of known
  // outside-spellings, the office's whole argument for the spelling would have
  // been wasted and a new rail would silently render as a resident.
  const gift = patronLabel("outside:stripe");
  assert.equal(gift.attached, false);
  assert.equal(gift.label, "an outside gift");
  assert.equal(gift.href, null, "there is no resident page to send a reader to");
  assert.equal(gift.patron, "outside:stripe", "the recorded payer is kept verbatim, never swallowed");

  // a rail nobody has built yet must ALSO read as a gift, on shape alone
  assert.equal(patronLabel("outside:cheque").attached, false);
  assert.equal(patronLabel("outside:cheque").label, "an outside gift");

  const hand = patronLabel("sol-am-lichterfenster");
  assert.equal(hand.attached, true);
  assert.equal(hand.label, "sol-am-lichterfenster");
  assert.equal(hand.href, "/residents/sol-am-lichterfenster/");
});

test("the fund page reads the roll the seam has always emitted", () => {
  // LAW (the founder, 2026-08-27): the pot pages display every receipt against
  //     a pot, INCLUDING unattributed gifts — visible as line items with their
  //     honest hand, not folded into a total silently.
  //
  // This is a SOURCE claim on purpose: the defect it guards was not a wrong
  // number, it was a field the page never read. tools/extract-seam.mjs has
  // always emitted `patrons` with the unattached gifts in it — its only
  // exclusion is the treasury — and the page rendered none of them.
  const page = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");
  assert.match(page, /pot\.patrons/, "the page reads the roll");
  assert.match(page, /patronLabel/, "through the one shape-rule, not a second copy");
  // the LABEL is the lib's (asserted above, where it lives); what the PAGE owes
  // is the disclosure beside it — a reader meeting an unattached line deserves
  // to be told what it is and what it could not do.
  assert.match(page, /could not attach to a hand/, "and says what an unattached payer is");
  assert.match(page, /cannot do is mint holo/, "including the honest half");
});

test("an UNCAPPED pot publishes what arrived — no posted need was never a reason to hide the total", () => {
  // LAW (the pot file, pot-darko-fund.json § source, verbatim): "It is
  //     deliberately ELASTIC: no posted target, no cap — whatever arrives in a
  //     month is, by definition, what it cost to run DARKO that month."
  //
  // darko-fund held a witnessed $10 while its page printed only "a standing
  // box — no target, whatever arrives is welcome". The absence of a TARGET says
  // nothing about whether the town should show what it RECEIVED.
  const page = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");
  const uncappedArm = page.slice(page.indexOf("{uncapped ? ("), page.indexOf(") : ("));
  assert.match(uncappedArm, /usd\(received\)/, "the uncapped arm prints the total it received");
});

test("the BUILT fund page carries the outside gift as its own line", { skip: !built }, () => {
  // The render is the claim here, not the source: `roll` resolves from the
  // synced seam at build time, so only the built page can say whether a real
  // recorded gift reached a reader's eyes.
  const potsPath = new URL("../src/data/postmark/pots.json", import.meta.url);
  const pots = JSON.parse(readFileSync(potsPath, "utf8"));
  const withOutside = pots.find((p) => (p.patrons ?? []).some((x) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(x.patron))));
  if (!withOutside) return; // no unattached gift in today's data: nothing to prove, and saying so beats a green lie

  const file = join(DIST, "fund", withOutside.pot, "index.html");
  assert.ok(existsSync(file), `the built page for ${withOutside.pot} exists at ${file}`);
  const html = readFileSync(file, "utf8");
  assert.match(html, /an outside gift/, "the gift is a visible line, not arithmetic");
  assert.match(html, /What has arrived/, "under a heading that says what the section is");
  const gift = withOutside.patrons.find((x) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(x.patron)));
  assert.ok(html.includes(String(gift.patron)), "and the recorded payer string itself is shown, never hidden");
  assert.match(html, new RegExp(`\\$${withOutside.received_usd}`), "with the dollars it brought");
});


test("NO pot surface links an unattached gift to a resident page that cannot exist", () => {
  // LAW (postmark-office src/residency.mjs, quoted by tools/stripe-watch.mjs):
  //     a handle is lowercase letters, digits and single hyphens, so
  //     `outside:stripe` "can never look like it" and can never be minted as a
  //     name — which also means /residents/outside:stripe/ is a page the town
  //     is incapable of building.
  //
  // THE LIVE DEFECT THIS CAUGHT, shipped and on the site today: the Stamps hub
  // rendered every roll entry as `<a href={`/residents/${c.patron}/`}>`, so
  // darko-fund's witnessed $10 appeared as a LINK NAMED `outside:stripe`
  // pointing at a 404 — an unattached gift dressed as a resident. Showing every
  // receipt is only half the founder's ruling; the other half is that each one
  // shows its HONEST hand.
  const surfaces = ["../town/pages/town/index.astro", "../town/pages/fund/[pot].astro"];
  for (const rel of surfaces) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(
      src, /\/residents\/\$\{(?:c|p|r)\.patron\}/,
      `${rel} builds a resident href straight from a payer string`,
    );
    if (/\.patrons/.test(src))
      assert.match(src, /patronLabel/, `${rel} routes payers through the one shape-rule`);
  }
});
