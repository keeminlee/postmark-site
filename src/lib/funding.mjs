// funding.mjs — the funding seam's reader: pots, deeds, and the town's numbers.
//
// Real dollars keep the town's lights on without ever buying judgment. The
// ledger lane (branch seam/ledger-legs) owns the law; this file owns the
// READING of it, once, so the pages stay presentation.
//
// ── WHERE THE SHAPES COME FROM ───────────────────────────────────────────────
// Every field name below is copied from the town's own files, not invented:
//
//   the pot file      WHITE_PAGES/pot-<id>.json      (potFile() in stamp-mint.mjs)
//   the board row     quest-registry.json § <id>
//   the ledger rows   stamp-mint.mjs § THE FUNDING SEAM
//   the dials         ECONOMY-DIALS.json law_side.keeping (keepingDial())
//
// The site never reads those files directly — tools/extract-town.mjs emits
// src/data/postmark/*.json from the town checkout, exactly as it does for
// households and the ledger. Three emissions carry the seam:
//
//   pots.json      one row per (pot, epoch): the pot file's fields VERBATIM
//                  plus the per-epoch folds the ledger alone can compute.
//   deeds.json     the patron-deed rows, verbatim.
//   economy.json   the keeping dials plus the two town-wide totals the
//                  gauges need.
//
// None of the three exists yet. That is not a bug and must not become a build
// failure: every loader below fails soft to empty, and every surface renders
// its own absence honestly. The board's law holds — a number invented to look
// alive is a lie about the economy.
//
// ── HOLO IS SOULBOUND ────────────────────────────────────────────────────────
// Ruled by Keemin 2026-08-20 and enforced in the ledger by ROW SHAPE: the holo
// row is arrow-free, so no balance, mint, or stake fold can ever see one. Holo
// cannot stake, vote, pay, or transfer. On this side of the wire that means:
// holo is never rendered as a balance, never summed into liquid/staked/assets,
// and every surface that shows it carries HOLO_LINE. That is the ruling, not a
// style choice.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── READING THE EMISSIONS ────────────────────────────────────────────────────
// Every loader below goes through here, and it stays readFileSync rather than
// becoming a static `import x from "@/data/postmark/x.json"` like the rest of
// the site's data for one reason: a static import of a file that is not there
// is a BUILD FAILURE, and the whole posture of this module is that a missing
// emission renders as an honest absence instead of taking the site down.
//
// The cost of that choice is that `import.meta.url` cannot be trusted to locate
// the file: under `astro build` this module is bundled, and its module URL no
// longer sits beside src/data/. So both places are tried — the module's own
// neighbourhood (which is where `node --test` finds it) and the project root
// the build actually runs from. Whichever answers first wins; neither answering
// is the empty case the callers already handle.
function readEmission(name, override) {
  const candidates = override
    ? [override]
    : [new URL(`../data/postmark/${name}`, import.meta.url),
       join(process.cwd(), "src", "data", "postmark", name)];
  for (const c of candidates) {
    try { return JSON.parse(readFileSync(c, "utf8")); } catch { /* try the next */ }
  }
  return null;
}

export const HOLO_LINE = "a record of contribution, not a promise of profit";

// The reserved direct-to-town pot (TREASURY_POT in stamp-mint.mjs): deeds only,
// never a file, never stakes, never a close. The founding family grant is its
// first deed — dollars with no household, so holo 0.
export const TREASURY_POT = "treasury";

// POT_ID_CLASS / EPOCH_CLASS, from the seam's own regexes.
const POT_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const EPOCH_RE = /^\d{4}-\d{2}$/;

// The pot file's `status`. A pot is not live until the founder opens it — see
// livePots() for why `draft` never reaches the board.
export const POT_STATUSES = ["draft", "open", "closed"];

const isNum = (v) => Number.isFinite(Number(v)) && String(v).trim() !== "";
const int = (v) => Number(v);

// ── deeds ────────────────────────────────────────────────────────────────────
// The durable patron record, one row per witnessed payment. From the grammar:
//
//   - <date> · patron-deed · pot:<pot> · patron: <payer> · usd: <n> ·
//     epoch:<epoch> · ref: <ref> · holo: <h>
//
// so a deed carries exactly: date, pot, patron, usd, epoch, ref, holo. `holo`
// may be 0 and often is — grant, treasury, and outside dollars land as deed
// alone. A zero-holo deed is a full deed, never a lesser one: the dollars were
// witnessed either way, and that is what a deed is for.
//
// `title` is the ONE joined-in field: the pot file's own title, carried across
// by the emitter so the shelf can say what was funded without the site holding
// a second copy of the pot list. Absent, the pot id stands in — a deed that
// cannot name its pot's title is still a true deed.
export function loadDeeds({ path = null } = {}) {
  // no emission yet — an empty shelf is honest; a build failure is not
  const raw = readEmission("deeds.json", path);
  return Array.isArray(raw) ? raw.filter(deedReads).map(toDeed) : [];
}

// A deed that cannot say who paid, into what, how much, and when is not
// rendered half-said. Dropped quietly: deeds are receipts, and a torn receipt
// proves nothing.
export function deedReads(d) {
  return Boolean(d &&
    typeof d.patron === "string" && d.patron.trim() &&
    typeof d.pot === "string" && (d.pot === TREASURY_POT || POT_ID_RE.test(d.pot)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(d.date ?? "")) &&
    EPOCH_RE.test(String(d.epoch ?? "")) &&
    isNum(d.usd) && int(d.usd) > 0 &&
    isNum(d.holo) && int(d.holo) >= 0);
}

export function toDeed(d) {
  return {
    date: String(d.date).slice(0, 10),
    pot: String(d.pot),
    patron: String(d.patron),
    usd: int(d.usd),
    epoch: String(d.epoch),
    ref: String(d.ref ?? ""),
    holo: int(d.holo),
    // what was funded, in words — the pot's title, or the pot's name itself
    what: String(d.title ?? "").trim() ||
      (d.pot === TREASURY_POT ? "the town, direct" : String(d.pot)),
  };
}

// One patron's shelf, newest first. Keyed on `patron` — the ledger's word for
// the hand that paid.
export function deedsFor(patron, deeds) {
  return (Array.isArray(deeds) ? deeds : [])
    .filter((d) => d.patron === patron)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) ||
      String(a.pot).localeCompare(String(b.pot)));
}

// What a shelf adds up to. Dollars sum; holo sums as a RECORD, never as a
// balance — the shelf shows a total the way a stack of receipts has a total,
// and the line under it says so.
export function shelfTotals(shelf) {
  return (Array.isArray(shelf) ? shelf : []).reduce(
    (t, d) => ({ usd: t.usd + d.usd, holo: t.holo + d.holo }), { usd: 0, holo: 0 });
}

// ── pots ─────────────────────────────────────────────────────────────────────
// One row per (pot, epoch). The pot FILE is per-pot and ongoing — cadence
// monthly, a target per epoch — so the epoch is what makes a row: the open
// month renders as open, and months already closed render as closed beside it.
//
// From the pot file, verbatim:
//   pot                   the id (also the file's name: pot-<id>.json)
//   subtype               "bounty"
//   status                draft | open | closed
//   title                 the board's headline for it
//   source                the prose: what the money is for
//   target_usd_per_epoch  whole dollars asked, per epoch — or null, but ONLY on
//                         an uncapped pot (see `uncapped` below)
//   uncapped              D5's exception (ECONOMY-DIALS.json law_side.keeping
//                         ._intake_cap, quoted): "intake refuses dollars past a
//                         pot's posted target, mechanically (recording tool /
//                         door bounce), except pots explicitly marked uncapped."
//                         The Darko donation box is the standing case: a box
//                         with no target, where whatever arrives is welcome.
//   epoch_cadence         "monthly"
//   beneficiary           who the dollars serve (never stamps — §8 reserves
//                         "keeper" for the keeping-stakers), or null until
//                         the founder names one
//   received_usd          dollars witnessed (display only — the ledger's
//                         pot-receipt rows are authoritative)
//   board                 where its row lives in quest-registry.json
//
// Folded from the ledger by the emitter, because only the ledger can know them:
//   epoch                 the epoch this row is about (YYYY-MM)
//   staked                open `stake:pot/<pot>` positions, in ✦ — the escrow
//   patrons               the roll, from this epoch's patron-deed rows:
//                         [{ patron, usd, holo }]
export function toPot(raw) {
  const bad = (reason) => ({ ok: false, id: String(raw?.pot ?? "(unnamed)"), reason });

  const pot = String(raw?.pot ?? "").trim();
  if (!pot) return bad("no pot id");
  if (!POT_ID_RE.test(pot)) return bad(`pot id ${JSON.stringify(pot)} is not a slug`);
  if (pot === TREASURY_POT) return bad(`"${TREASURY_POT}" is the reserved direct-to-town pot — deeds only, never a board row`);

  const title = String(raw.title ?? "").trim();
  if (!title) return bad("no title");

  const status = String(raw.status ?? "").trim();
  if (!POT_STATUSES.includes(status)) return bad(`status must be ${POT_STATUSES.join(", ")} (got ${JSON.stringify(raw.status)})`);

  const epoch = String(raw.epoch ?? "").trim();
  if (!EPOCH_RE.test(epoch)) return bad(`epoch must be YYYY-MM (got ${JSON.stringify(raw.epoch)})`);

  // THE POSTED NEED, and its ONE lawful absence. A capped pot without a whole
  // dollar target is broken — stamp-mint.mjs's deriveEpochClose refuses it in
  // the town for the reason the site refuses it here: "the funded fraction is
  // priced against the posted need, never against the staked mass". An UNCAPPED
  // pot has no need to post, by D5's own exception, so null is its true value
  // and not a missing one.
  const uncapped = raw.uncapped === true;
  const target = raw.target_usd_per_epoch;
  const targetless = target === null || target === undefined;
  if (uncapped && !targetless && (!isNum(target) || !Number.isInteger(int(target)) || int(target) < 1))
    return bad(`target_usd_per_epoch must be a whole number ≥ 1 or null (got ${JSON.stringify(target)})`);
  if (!uncapped && (!isNum(target) || !Number.isInteger(int(target)) || int(target) < 1))
    return bad(`target_usd_per_epoch must be a whole number ≥ 1 (got ${JSON.stringify(target)})`);

  const received = isNum(raw.received_usd) ? int(raw.received_usd) : 0;
  if (received < 0) return bad("received_usd is negative");

  // The roll. An entry that cannot name its hand and its dollars is dropped —
  // the pot still reads; a torn line on the roll does not tear the pot. holo
  // defaults to 0 because 0 is a real answer here, not a missing one.
  const patrons = (Array.isArray(raw.patrons) ? raw.patrons : [])
    .filter((p) => p && typeof p.patron === "string" && p.patron.trim() && isNum(p.usd) && int(p.usd) > 0)
    .map((p) => ({ patron: String(p.patron), usd: int(p.usd), holo: isNum(p.holo) ? int(p.holo) : 0 }))
    .sort((a, b) => b.usd - a.usd || a.patron.localeCompare(b.patron));

  return {
    ok: true,
    id: `${pot}@${epoch}`,
    pot,
    epoch,
    title,
    // the pot file's prose. Not required — a pot with a title and no source is
    // thin, not broken.
    source: String(raw.source ?? "").trim(),
    subtype: String(raw.subtype ?? "bounty"),
    status,
    // null is a REAL state, not a missing field: deriveEpochClose refuses to
    // close a pot with no beneficiary, so an unnamed beneficiary is a thing
    // the board should say out loud rather than a reason to drop the row.
    beneficiary: typeof raw.beneficiary === "string" && raw.beneficiary.trim()
      ? raw.beneficiary.trim() : null,
    cadence: String(raw.epoch_cadence ?? "").trim() || null,
    uncapped,
    // null on an uncapped pot is a REAL state the surfaces must say out loud —
    // the fund page's standing-box branch reads exactly this.
    target: targetless ? null : int(target),
    received,
    patrons,
    staked: isNum(raw.staked) ? int(raw.staked) : 0,
    // Clamped for the bar's width only; `received` stays raw so an over-fed pot
    // reads as over-fed rather than as merely full. A targetless pot has no
    // fraction of anything to be: there is no need for it to be short of.
    progress: targetless ? null : Math.min(1, received / int(target)),
  };
}

// The pots, read and sorted: open first (the ones you can still feed), then
// closed, newest epoch first within each.
export function pots(rows) {
  const rank = { open: 0, closed: 1, draft: 2 };
  const good = [], malformed = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const p = toPot(raw);
    if (p.ok) good.push(p); else malformed.push(p);
  }
  good.sort((a, b) =>
    (rank[a.status] - rank[b.status]) ||
    String(b.epoch).localeCompare(String(a.epoch)) ||
    a.pot.localeCompare(b.pot));
  return { pots: good, malformed };
}

// What the BOARD may show. A draft pot is not a pot the town has asked you for
// — the live pot file says so in its own words ("DRAFT / DEV FIXTURE — NOT
// LIVE"), and epoch-close refuses any pot whose status is not `open`. Opening
// one is the founder's word, never a merge. So drafts are held back and
// counted, exactly as the board holds back a notice it cannot read: rendering
// one would be the site asking for money the town has not asked for.
export function livePots(rows) {
  const { pots: all, malformed } = pots(rows);
  return {
    pots: all.filter((p) => p.status !== "draft"),
    drafts: all.filter((p) => p.status === "draft"),
    malformed,
  };
}

export function loadPots({ path = null } = {}) {
  const raw = readEmission("pots.json", path);
  return Array.isArray(raw) ? raw : [];
}

// ── the town's numbers ───────────────────────────────────────────────────────
// economy.json — the keeping dials, copied from ECONOMY-DIALS.json law_side
// .keeping under their own names, plus the two town-wide totals the gauges
// need and only the ledger can fold:
//
//   {
//     "as_of":                     "YYYY-MM-DD",
//     "sigma":                     0.5,    — the epoch-close split
//     "rho":                       0.25,   — the holo cap ratio
//     "rho_constitutional_ceiling": 0.5,   — ρ may never exceed this
//     "treasury_usd":              175,    — dollars the town holds
//     "primary_mint_earned":       2400,   — earned primary mint, ✦, town-wide
//     "holo_issued":               19      — holo ever minted (never burned)
//   }
//
// WHAT THE TWO DIALS ACTUALLY MEAN:
//
//   σ is the EPOCH-CLOSE SPLIT. When witnessed dollars match staked stamps,
//   those stamps BURN, and the matched burn converts to equity exactly once.
//   The governing text is the capture doc § 8 (postmark-economy-ontology.md),
//   quoted:
//
//     "σ × pot mints back to the keepers as their own equity, at par of their
//      burn — permanent, verb-less, remembered ('everything you've ever
//      given'). ... (1−σ) × pot mints to payers as Holo, by dollar share."
//
//   THE KEEPERS ARE THE STAKERS. § 8's lifecycle names them: "Households stake
//   keeping-stakes on it (the want signal + the pricing mass)." So the σ leg
//   goes back to the households whose stamps burned, per-staker at par — NOT
//   to the pot's beneficiary, who receives dollars and never stamps.
//
//   R12 (Keemin, 2026-08-21 afternoon) then names what that leg IS, and the
//   ledger landed it (seam/ledger-legs-aligned 3668881b):
//
//     "the σ leg IS ORDINARY MINT, source-tagged (`minted · for: keeping:<pot>`),
//      with NO liquid coin (the coin was paid when the stake burned; the row
//      stays purpose-tagged so balance folds never hand liquid back). It COUNTS
//      toward the ρ base (holo cap base = earned primary mint + keeping mint).
//      It stays EXCLUDED from the genesis parity formula."
//
//   So the noun "keeping-equity" is RETIRED from every resident-facing surface.
//   The vocabulary on this site is "minted · for keeping" — or, in plain
//   reader's English, "your permanent record". Two older row shapes are gone
//   with it: the MINT-shaped `keeper-equity:<pot>/<epoch>` row, and the
//   `keeping-equity ·` row. The live row is:
//
//     - <date> · minted · <staker> · <n> · for: keeping:<pot> · epoch:<epoch>
//
//   Arrow-free for the same reason a holo row is — and here that shape is what
//   "no liquid coin" MEANS: the town's balance and mint-count folds key on the
//   movement shape, so neither can see this row.
//
//   Nothing in this file reads that row, or any ledger row: the site parses no
//   ledger text at all. The emitter folds the seam into the three JSONs above
//   and this module reads only those. A grammar change reaches the site as a
//   changed field, never as a changed parse.
//
//   σ is NOT a per-dollar mint rate — there is no dollar↔stamp rate anywhere
//   in the seam. A pot converts against its OWN posted need:
//   funded_fraction = min(1, non-treasury dollars ÷ target_usd_per_epoch),
//   and each stake burns floor(fraction × stake) with the rest returning
//   whole. A fully funded pot burns every stake, however large the pile — the
//   town prices money by how much it stakes.
//
//   The σ leg is still NOT spendable — that is the "no liquid coin" half. And
//   D1 (same day) settles where it lives: "ownership is a derived READ = minted
//   (all sources) + holo — NOT a tense; no fifth tense node." So this site
//   renders no fifth segment and no new balance; the leg is named in words, and
//   the door is where the ownership read is served.
//
//   ρ is the HOLO CAP RATIO (ECONOMY-DIALS.json law_side.keeping._holo:
//   "a household's holo <= rho x its RHO BASE, clipped at conversion, excess
//   recorded as deed only"), where R12 sets the base = earned primary mint +
//   keeping mint. ρ may never exceed the constitutional ceiling of 0.5 —
//   keepingDial() refuses a dial that tries. It is NOT the treasury's take.
//
//   ρ's VALUE is not written anywhere on this site, and that is deliberate.
//   R10: "Owner of the number: `ECONOMY-DIALS.json § law_side.keeping.rho`;
//   every other surface reads it rather than restating it." The pages render
//   whatever the emitted economy.json carries, and every sentence about ρ is
//   written to stay true when the dial moves — so a ballot that lowers ρ needs
//   no copy edit anywhere.
//
// So the town-wide holo cap is DERIVED here rather than stored: it is the law's
// own formula, ρ × earned primary mint, and a stored copy could only ever drift
// away from it.
export function loadEconomy({ path = null } = {}) {
  // the ledger has not published yet — the page says so rather than inventing
  return readEmission("economy.json", path);
}

// Normalize into the page's dials, or null when any of them is missing. Half a
// set of numbers rendered as the town's would be a quieter lie than the honest
// "not published yet".
export function readEconomy(raw) {
  if (!raw) return null;
  const dial = (v) => (isNum(v) ? Number(v) : null);
  const sigma = dial(raw.sigma);
  const rho = dial(raw.rho);
  const ceiling = dial(raw.rho_constitutional_ceiling);
  const treasuryUsd = dial(raw.treasury_usd);
  const primaryMint = dial(raw.primary_mint_earned);
  const holoIssued = dial(raw.holo_issued);
  if ([sigma, rho, ceiling, treasuryUsd, primaryMint, holoIssued].some((v) => v == null)) return null;

  // keepingDial's own refusal, mirrored: a dial that breaks the constitutional
  // ceiling is not a dial to render, it is a dial to report as unreadable. The
  // page then says the numbers have not published — which is true, because a
  // ρ past the ceiling would never have closed an epoch in the first place.
  if (!(sigma > 0 && sigma < 1) || rho < 0 || rho > ceiling) return null;

  const holoCap = Math.floor(rho * primaryMint);
  return {
    asOf: String(raw.as_of ?? "").slice(0, 10) || null,
    sigma, rho, rhoCeiling: ceiling,
    treasuryUsd, primaryMint, holoIssued, holoCap,
    // the backing gauge: dollars the town holds per ✧ ever minted. Holo is
    // never burned, so issued IS the cumulative mint. A fact about the
    // treasury, never a redemption promise.
    backing: holoIssued > 0 ? treasuryUsd / holoIssued : null,
    // headroom against the cap, for the gauge's width
    capUsed: holoCap > 0 ? Math.min(1, holoIssued / holoCap) : null,
    overCap: holoCap > 0 && holoIssued > holoCap,
  };
}

// ── FIXTURES — dev (SEAM_FIXTURE=1 / `?fixture`) and tests ONLY ──────────────
// Everything below is invented, but invented COHERENTLY: the deeds, the roll,
// the balances and the dials are the same story told four ways, so the fixture
// is a live check that the surfaces can agree with each other and with the law.
// test/funding.test.mjs asserts that agreement — if a fixture drifts, the tests
// go red rather than the pages going quietly wrong.
//
// None of it is reachable on postmark.town: every page gates on
// import.meta.env.DEV. A fixture that can appear on the live site is a lie
// about what was actually funded.
//
// THE STORY: keeping-ec2 (the town's box, $150/mo) closed 2026-08 at target.
// $150 witnessed from three patrons; 40✦ of staked escrow burned; σ=0.5 split
// it 20 minted back to the stakers, source-tagged for keeping / 20 into the
// payers' holo pool, shared by dollar:
//   wright  $60 → floor(20 × 60/150) = 8✧
//   alden   $50 → floor(20 × 50/150) = 6✧
//   rei     $40 → floor(20 × 40/150) = 5✧
// 8+6+5 = 19, so 1✧ of the pool burned un-minted — the seam keeps the change,
// visible in the fixture rather than merely asserted in a comment.

export const POT_FIXTURE = [
  // the open month: fed, but not yet at target
  {
    pot: "keeping-ec2", subtype: "bounty", status: "open",
    title: "Keep the lights on — the town box",
    source: "The town runs on a real machine with a real monthly bill (~$150/mo). Stake stamps to say the box matters to you; witnessed dollars close the month.",
    target_usd_per_epoch: 150, epoch_cadence: "monthly",
    beneficiary: "the-town/the-box", received_usd: 90,
    board: "quest-registry.json § keeping-ec2",
    epoch: "2026-09", staked: 12,
    patrons: [
      { patron: "wright", usd: 40, holo: 0 },
      { patron: "alden", usd: 30, holo: 0 },
      { patron: "rei", usd: 20, holo: 0 },
    ],
  },
  // the month after: open and untouched — the zero-received state
  {
    pot: "keeping-ec2", subtype: "bounty", status: "open",
    title: "Keep the lights on — the town box",
    source: "October's month of the box — same machine, next epoch.",
    target_usd_per_epoch: 150, epoch_cadence: "monthly",
    beneficiary: "the-town/the-box", received_usd: 0,
    board: "quest-registry.json § keeping-ec2",
    epoch: "2026-10", staked: 0, patrons: [],
  },
  // the month already closed: the roll carries the holo the close minted
  {
    pot: "keeping-ec2", subtype: "bounty", status: "closed",
    title: "Keep the lights on — the town box",
    source: "August's month of the box, closed at target.",
    target_usd_per_epoch: 150, epoch_cadence: "monthly",
    beneficiary: "the-town/the-box", received_usd: 150,
    board: "quest-registry.json § keeping-ec2",
    epoch: "2026-08", staked: 0,
    patrons: [
      { patron: "wright", usd: 60, holo: 8 },
      { patron: "alden", usd: 50, holo: 6 },
      { patron: "rei", usd: 40, holo: 5 },
    ],
  },
  // a pot the founder has NOT opened. The board must never render this one —
  // livePots() holds it back, and the tests prove it.
  {
    pot: "keeping-domains", subtype: "bounty", status: "draft",
    title: "The town's names — domains and certificates",
    source: "DRAFT — not opened. Opening a pot is the founder's word, not a merge.",
    target_usd_per_epoch: 60, epoch_cadence: "yearly",
    beneficiary: null, received_usd: 0,
    board: "quest-registry.json § keeping-domains",
    epoch: "2026-09", staked: 0, patrons: [],
  },
];

// The patron-deed rows behind that story, plus one treasury deed — dollars
// straight to the town, which match nothing and mint nothing, so holo is 0.
// The zero-holo deed is the case the shelf most needs to render honestly.
export const DEEDS_FIXTURE = [
  {
    date: "2026-08-31", pot: "keeping-ec2", patron: "wright", usd: 60,
    epoch: "2026-08", ref: "stripe:pi_3QkR7fEXAMPLE", holo: 8,
    title: "Keep the lights on — the town box",
  },
  {
    date: "2026-08-31", pot: "keeping-ec2", patron: "alden", usd: 50,
    epoch: "2026-08", ref: "stripe:pi_3QkR8gEXAMPLE", holo: 6,
    title: "Keep the lights on — the town box",
  },
  {
    date: "2026-08-31", pot: "keeping-ec2", patron: "rei", usd: 40,
    epoch: "2026-08", ref: "usdc:0x9c41EXAMPLE", holo: 5,
    title: "Keep the lights on — the town box",
  },
  {
    date: "2026-08-12", pot: TREASURY_POT, patron: "wright", usd: 25,
    epoch: "2026-08", ref: "usdc:0x8f21EXAMPLE", holo: 0,
    title: "",
  },
];

// The dials, coherent with the deeds above: holo_issued (19) is exactly the
// sum of the fixture's deed holo, and every household's holo sits under its
// ρ-cap (floor(0.25 × earned mint)) in STAMPS_FIXTURE below.
// ρ here is the LAUNCH value (R10: "ρ = 0.5 at launch — at the constitutional
// ceiling"). The fixture runs at the dial the town will actually open with, so
// what QA sees on `?fixture` is the shape the first visitor meets — including
// the ρ bar sitting flush against its ceiling, which is the honest picture of a
// dial with no upward headroom left.
export const ECONOMY_FIXTURE = {
  as_of: "2026-08-31",
  sigma: 0.5,
  rho: 0.5,
  rho_constitutional_ceiling: 0.5,
  treasury_usd: 175,
  primary_mint_earned: 2400,
  holo_issued: 19,
};

// Per-handle stamps answers for the mintbar. holo agrees with the deeds; every
// mint_count is high enough that the household's holo sits under its ρ-cap at
// the launch dial (wright 8 ≤ ⌊ρ×48⌋, alden 6 ≤ ⌊ρ×32⌋, rei 5 ≤ ⌊ρ×24⌋ — the
// test does that multiplication against ECONOMY_FIXTURE.rho rather than
// restating it, so the fixture survives a dial change). The two hollow-holo
// members let QA see a bar with and without the holo segment in one house.
export const STAMPS_FIXTURE = {
  wright: { mint_count: 48, liquid: 21, staked: 6, assets: 27, holo: 8 },
  alden: { mint_count: 32, liquid: 24, staked: 0, assets: 24, holo: 6 },
  rei: { mint_count: 24, liquid: 18, staked: 3, assets: 21, holo: 5 },
  corwin: { mint_count: 12, liquid: 12, staked: 0, assets: 12, holo: 0 },
  ellery: { mint_count: 5, liquid: 3, staked: 1, assets: 4, holo: 0 },
};
