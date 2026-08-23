// extract-seam.test.mjs — the emission's falsifiers.
//
// THE THING THIS PROVES: what tools/extract-seam.mjs writes is what
// src/lib/funding.mjs reads. The two files are a contract with no schema
// between them — funding.mjs documents the field names it expects and the
// emitter copies them out of the town — so the only way that contract can be
// checked is to run the emitter's fold and hand its output to the reader.
//
// Every assertion below runs the REAL fold (seamFromTown) against a REAL
// stamp-mint.mjs when a town checkout is at hand, and against a hand-built
// ledger in the town's own grammar when it is not.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { seamFromTown, nextMonth, firstOpenEpoch, monthOf } from "../tools/extract-seam.mjs";
import { livePots, loadEconomy, readEconomy, toPot, toDeed, deedReads, TREASURY_POT } from "../src/lib/funding.mjs";

// The town checkout, if this machine has one. Everything that needs the real
// stamp-mint.mjs skips without it rather than pretending to have run.
const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOWN = [process.env.POSTMARK_TOWN, ...[
  ".postmark-checkout",              // the CI checkout (sync-atlas.yml)
  "../postmark",                     // the sibling clone extract-town.mjs defaults to
  "../../seam-overnight/town-main",  // the read-only reference clone
  "../../postmark",
].map((p) => resolve(SITE_ROOT, p))]
  .filter(Boolean)
  .find((p) => existsSync(join(p, "tools", "stamp-mint.mjs")));

const haveTown = Boolean(TOWN);
const loadMint = async () => import(pathToFileURL(join(TOWN, "tools", "stamp-mint.mjs")).href);

// The dial the town actually declares, so these tests never restate ρ or σ
// (R10: "every other surface reads it rather than restating it").
const DIAL = { sigma: 0.5, rho: 0.5, rhoCeiling: 0.5, treasury: "the-town" };

// ── epochs ───────────────────────────────────────────────────────────────────

test("an epoch is a month, and the next one rolls the year", () => {
  assert.equal(nextMonth("2026-08"), "2026-09");
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(monthOf("2026-08-21"), "2026-08");
});

test("the open epoch is the first month the pot has not already closed", () => {
  // One epoch, one close (stamp-mint.mjs: `pot "<x>" already closed epoch <e> —
  // one epoch, one close`). So a month that closed cannot be the open one, and
  // the pot's next ask is the month after it.
  assert.equal(firstOpenEpoch("2026-08", new Set()), "2026-08");
  assert.equal(firstOpenEpoch("2026-08", new Set(["2026-08"])), "2026-09");
  assert.equal(firstOpenEpoch("2026-11", new Set(["2026-11", "2026-12"])), "2027-01");
});

// ── the contract: what is emitted is what funding.mjs reads ──────────────────

test("every emitted pot row parses under funding.mjs's own reader", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const potFiles = ["keeping-ec2", "darko-fund"]
    .map((p) => mint.potFile(TOWN, p)).filter(Boolean);
  assert.ok(potFiles.length >= 2, "the town posts both pilot pots");

  const seam = seamFromTown({ mint, entries, potFiles, dial: DIAL, asOf: "2026-08-21" });
  const { pots, drafts, malformed } = livePots(seam.pots);

  // THE WHOLE POINT. A malformed row means the emitter wrote a field the reader
  // will not take — the failure mode this file exists to catch, and the one that
  // would otherwise show up as a pot silently missing from the board.
  assert.deepEqual(malformed, [], "the emitter must write only rows the reader accepts");
  assert.ok(pots.length + drafts.length === seam.pots.length);
});

test("a pot file's fields arrive verbatim, and a renamed field is caught", { skip: !haveTown }, async () => {
  // THE CAN-FAIL FLIP. funding.mjs's header: "Every field name below is copied
  // from the town's own files, not invented ... the pot file WHITE_PAGES/
  // pot-<id>.json". If the town renames a field, this goes red instead of the
  // board quietly rendering a pot with no title and no target.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "keeping-ec2");

  const whole = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const read = toPot(whole.pots[0]);
  assert.equal(read.ok, true, read.reason);
  assert.equal(read.title, file.title, "the title is the pot file's own");
  assert.equal(read.target, file.target_usd_per_epoch, "the target is the posted need, unaltered");
  assert.equal(read.source, file.source.trim(), "the prose is the pot file's own");

  // now break the field NAME the emitter copies from — the exact drift a schema
  // would have caught and a hand-copied field never does
  const renamed = { ...file, target_usd_per_epoch: undefined, target_usd: file.target_usd_per_epoch };
  const broken = seamFromTown({ mint, entries, potFiles: [renamed], dial: DIAL, asOf: "2026-08-21" });
  assert.equal(toPot(broken.pots[0]).ok, false,
    "a renamed pot-file field must fail the reader, not pass with a hole in it");
});

test("a draft pot is emitted and marked draft — never dropped", { skip: !haveTown }, async () => {
  // The town's own record refuses to hide it: pot-darko-fund.json says "DRAFT —
  // the rendering may show on the dev channel, but opening a pot is the
  // founder's word". So the row must exist AND must carry status draft; the
  // surfaces then decide what a draft may say, which is not the emitter's call.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  // The status is set HERE rather than borrowed from the town's live file. It
  // used to read `assert.equal(file.status, "draft")`, which quietly tied this
  // test to a value the founder moves at will — and he moved it: darko-fund
  // opened 2026-08-23. What is under test is the emitter's treatment of a draft
  // row, which is a shape, not a fact about today's town.
  const file = { ...mint.potFile(TOWN, "darko-fund"), status: "draft" };

  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  assert.equal(seam.pots.length, 1, "a draft pot is emitted");
  assert.equal(seam.pots[0].status, "draft");

  const { pots, drafts } = livePots(seam.pots);
  assert.equal(pots.length, 0, "and the board's live list still holds it back");
  assert.equal(drafts.length, 1, "but it is counted, not lost");
});

test("the donation box's targetless shape reads — and only because it is uncapped", { skip: !haveTown }, async () => {
  // D5's exception, quoted from ECONOMY-DIALS.json law_side.keeping._intake_cap:
  // "intake refuses dollars past a pot's posted target, mechanically (recording
  // tool / door bounce), except pots explicitly marked uncapped."
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "darko-fund");
  assert.equal(file.target_usd_per_epoch, null, "the box posts no target");
  assert.equal(file.uncapped, true, "and says so with the field the law names");

  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const read = toPot(seam.pots[0]);
  assert.equal(read.ok, true, read.reason);
  assert.equal(read.target, null, "null is the box's true target, not a missing one");
  assert.equal(read.uncapped, true, "and the flag reaches the page that branches on it");
  assert.equal(read.progress, null, "a box with no need is short of nothing");

  // THE CAN-FAIL FLIP: drop the uncapped flag and the very same row must be
  // refused. Without this, "null target reads fine" would be a hole in the
  // reader rather than an exception the law grants.
  const notExempt = toPot({ ...seam.pots[0], uncapped: false });
  assert.equal(notExempt.ok, false, "a CAPPED pot with no posted target is broken, not elastic");
  assert.match(notExempt.reason, /target_usd_per_epoch/);
});

// ── zero receipts is zero, never blank ───────────────────────────────────────

test("a pot nobody has fed shows zero, and an empty roll — not an absence", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "keeping-ec2");
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-21" });
  const row = seam.pots[0];

  assert.equal(row.received_usd, 0, "the ledger carries no receipt for this pot");
  assert.equal(typeof row.received_usd, "number", "and 0 is a number, not an empty string or null");
  assert.deepEqual(row.patrons, [], "an empty roll is an array, so the page can count it");
  assert.equal(row.staked, 0);

  const read = toPot(row);
  assert.equal(read.received, 0);
  assert.equal(read.progress, 0, "0 of a posted need is 0 progress, not NaN");
  assert.ok(Number.isFinite(read.progress));
});

test("the pot file's own received_usd never overrides the ledger's", { skip: !haveTown }, async () => {
  // The pot file says so itself: "display only, refreshed by tools/
  // epoch-close.mjs --receipt — the ledger's pot-receipt rows are
  // authoritative". A stale display number reaching a page would be the site
  // reporting money that the sealed record does not have.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const lying = { ...mint.potFile(TOWN, "keeping-ec2"), received_usd: 999 };
  const seam = seamFromTown({ mint, entries, potFiles: [lying], dial: DIAL, asOf: "2026-08-21" });
  assert.equal(seam.pots[0].received_usd, 0, "the fold wins over the pot file's display copy");
});

// ── deeds and the town's numbers ─────────────────────────────────────────────

test("the deed rows are the ledger's, verbatim, and read back whole", { skip: !haveTown }, async () => {
  // A hand-built ledger in the town's OWN grammar (patronDeedLine builds the
  // line, so this cannot drift from the row shape stamp-verify replays).
  const mint = await loadMint();
  const raw = [
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "usdc", usd: 60, from: "wright", ref: "usdc:0xAA" }),
    mint.patronDeedLine({ date: "2026-08-31", pot: "keeping-ec2", patron: "wright", usd: 60, epoch: "2026-08", ref: "usdc:0xAA", holo: 8 }),
    mint.patronDeedLine({ date: "2026-08-12", pot: TREASURY_POT, patron: "wright", usd: 25, epoch: "2026-08", ref: "usdc:0xBB", holo: 0 }),
  ];
  const entries = mint.parseStampLedger(raw.join("\n"));
  const file = mint.potFile(TOWN, "keeping-ec2");
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-31" });

  assert.equal(seam.deeds.length, 2);
  for (const d of seam.deeds) assert.equal(deedReads(d), true, `the reader must accept ${JSON.stringify(d)}`);

  const paid = seam.deeds.find((d) => d.pot === "keeping-ec2");
  assert.equal(paid.usd, 60);
  assert.equal(paid.holo, 8);
  assert.equal(paid.title, file.title, "the ONE joined field: the pot's own title");
  assert.equal(toDeed(paid).what, file.title);

  // a zero-holo treasury deed is a whole deed, not a lesser one
  const direct = seam.deeds.find((d) => d.pot === TREASURY_POT);
  assert.equal(direct.holo, 0);
  assert.equal(toDeed(direct).what, "the town, direct");
});

test("a closed epoch's row is folded from the close, and the roll is its deeds", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const raw = [
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "usdc", usd: 90, from: "wright", ref: "usdc:0xAA" }),
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "stripe", usd: 60, from: "rei", ref: "stripe:pi_X" }),
    mint.keepingBurnLine({ date: "2026-08-31", pot: "keeping-ec2", n: 40, epoch: "2026-08", handle: "alden" }),
    mint.keepingMintLine({ date: "2026-08-31", handle: "alden", n: 20, pot: "keeping-ec2", epoch: "2026-08" }),
    mint.patronDeedLine({ date: "2026-08-31", pot: "keeping-ec2", patron: "wright", usd: 90, epoch: "2026-08", ref: "usdc:0xAA", holo: 12 }),
    mint.patronDeedLine({ date: "2026-08-31", pot: "keeping-ec2", patron: "rei", usd: 60, epoch: "2026-08", ref: "stripe:pi_X", holo: 8 }),
  ];
  const entries = mint.parseStampLedger(raw.join("\n"));
  const seam = seamFromTown({ mint, entries, potFiles: [mint.potFile(TOWN, "keeping-ec2")], dial: DIAL, asOf: "2026-08-31" });

  const closed = seam.pots.find((p) => p.epoch === "2026-08");
  assert.ok(closed, "the closed epoch gets its own row");
  assert.equal(closed.status, "closed", "a closed epoch reads closed however the pot file reads");
  assert.equal(closed.received_usd, 150, "the deeds' dollars, summed");
  assert.equal(closed.staked, 0, "a close leaves no escrow behind");
  assert.deepEqual(closed.patrons.map((p) => [p.patron, p.usd, p.holo]),
    [["wright", 90, 12], ["rei", 60, 8]], "the roll, richest first, with the holo the close minted");

  // and the pot keeps asking: the open row is the month AFTER the one it closed
  const open = seam.pots.find((p) => p.epoch !== "2026-08");
  assert.equal(open.epoch, "2026-09", "one epoch, one close — the next ask is the next month");
  assert.equal(open.received_usd, 0, "the closed month's receipts were consumed by its deeds");
});

test("treasury dollars fund nothing, so they never fill a pot's bar", { skip: !haveTown }, async () => {
  // ECONOMY-DIALS.json law_side.keeping._exclusions, quoted: "treasury dollars
  // covering a shortfall fund nothing and mint nothing ('Treasury may cover any
  // shortfall — minting nothing')". stamp-mint.mjs's intakeCheck excludes them
  // from the headroom it quotes at the door; a bar that counted them would show
  // the pot fuller than the door believes it is.
  const mint = await loadMint();
  const raw = [
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "usdc", usd: 40, from: "wright", ref: "usdc:0xAA" }),
    mint.potReceiptLine({ date: "2026-08-30", pot: "keeping-ec2", rail: "grant", usd: 110, from: "the-town", ref: "grant:shortfall" }),
  ];
  const entries = mint.parseStampLedger(raw.join("\n"));
  const seam = seamFromTown({ mint, entries, potFiles: [mint.potFile(TOWN, "keeping-ec2")], dial: DIAL, asOf: "2026-08-30" });
  const row = seam.pots[0];

  assert.equal(row.received_usd, 40, "only the funding dollars price the need");
  assert.deepEqual(row.patrons.map((p) => p.patron), ["wright"], "the treasury is not a patron");
  // but the town still HOLDS them — the backing gauge counts every witnessed dollar
  assert.equal(seam.economy.treasury_usd, 150);
});

test("the economy emission is a whole set readEconomy will take", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const dial = mint.keepingDial(TOWN);
  assert.ok(dial, "the town declares a keeping dial");

  const seam = seamFromTown({ mint, entries, potFiles: [], dial, asOf: "2026-08-21" });
  const econ = readEconomy(seam.economy);
  assert.ok(econ, "half a set would render as 'not published yet' — this must be whole");

  // the dials are the town's own, never restated here
  assert.equal(econ.sigma, dial.sigma);
  assert.equal(econ.rho, dial.rho);
  assert.equal(econ.rhoCeiling, dial.rhoCeiling);
  // and the totals are folds of the sealed ledger, not constants
  assert.equal(seam.economy.primary_mint_earned,
    [...mint.foldMintCount(entries).values()].reduce((a, n) => a + n, 0));
  assert.equal(seam.economy.holo_issued,
    [...mint.foldHolo(entries).values()].reduce((a, n) => a + n, 0));
  assert.ok(seam.economy.primary_mint_earned > 0, "the town has minted; a 0 here would mean the fold missed the ledger");
});

test("no dial, no economy emission — the page says not-yet rather than half", { skip: !haveTown }, async () => {
  const mint = await loadMint();
  const seam = seamFromTown({ mint, entries: [], potFiles: [], dial: null, asOf: "2026-08-21" });
  assert.equal(seam.economy, null);
  assert.equal(readEconomy(seam.economy), null);
});

// ── what actually shipped ────────────────────────────────────────────────────

test("the committed emissions are the ones the site reads", () => {
  // Not a fold check — a wiring check. The emitter can be perfect and the build
  // still render nothing if the files land somewhere funding.mjs does not look.
  const econ = loadEconomy();
  if (!econ) return; // no emission committed on this branch yet — fail-soft, by design
  assert.ok(readEconomy(econ), "a committed economy.json must be a whole, lawful set");
  const potsJson = JSON.parse(readFileSync(new URL("../src/data/postmark/pots.json", import.meta.url), "utf8"));
  assert.deepEqual(livePots(potsJson).malformed, [],
    "every committed pot row must parse — a malformed row is a pot missing from the board");
});

test('R12: the holo cap base is primary mint PLUS keeping mint — "keeping-mint is treated like anything else" (Keemin, 2026-08-21)', () => {
  const econ = readEconomy({ as_of: "2026-08-22", sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5,
    treasury_usd: 0, primary_mint_earned: 100, keeping_mint: 40, holo_issued: 0 });
  assert.equal(econ.holoCap, 70, "0.5 x (100 + 40) — dropping keeping mint from the base fails here");
  const older = readEconomy({ as_of: "2026-08-22", sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5,
    treasury_usd: 0, primary_mint_earned: 100, holo_issued: 0 });
  assert.equal(older.holoCap, 50, "an emission without the fold still renders, at the narrower base");
});

// ── the close word and its floor reach the reader ────────────────────────────

test("the emitter carries the pot file's close word and its floor", { skip: !haveTown }, async () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _min_close, quoted:
  //   "Owner of the number: this file; every surface reads it."
  // A field the emitter drops is a field no surface can read, however carefully
  // the pot file states it. Before this passthrough existed the site could not
  // tell a donation box from an epoch pot at all.
  const mint = await loadMint();
  const entries = mint.parseStampLedger(readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"));
  const file = mint.potFile(TOWN, "darko-fund");
  const seam = seamFromTown({ mint, entries, potFiles: [file], dial: DIAL, asOf: "2026-08-23" });

  assert.equal(seam.pots[0].close, file.close,
    "the close word is emitted exactly as the pot file states it");
  assert.equal(seam.pots[0].min_close_usd, file.min_close_usd ?? null,
    "and so is the floor");

  const read = toPot(seam.pots[0]);
  assert.equal(read.close, file.close, "and both survive the reader");
  assert.equal(read.minCloseUsd, file.min_close_usd ?? null);
});

test("the emitter's allowlist names close and min_close_usd", () => {
  // The emitter copies an ALLOWLIST of pot-file fields, so a field that is not
  // named here is silently absent downstream rather than loudly missing. That
  // failure mode is why this reads the source: it runs on a machine with no
  // town checkout, where the fold above cannot.
  const src = readFileSync(new URL("../tools/extract-seam.mjs", import.meta.url), "utf8");
  const base = src.slice(src.indexOf("const base = {"));
  const block = base.slice(0, base.indexOf("\n    };"));
  assert.ok(/close: /.test(block), "the emitter must carry `close`");
  assert.ok(/min_close_usd: /.test(block), "and `min_close_usd`");
  assert.ok(block.includes("file?.min_close_usd"),
    "read off the pot file, never computed or defaulted to a number here");
});
