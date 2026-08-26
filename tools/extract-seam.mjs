// extract-seam.mjs — the funding seam's three emissions, folded from the town
// checkout. Sibling of extract-town.mjs, which calls it; run standalone with
// `node tools/extract-seam.mjs --town <path-to-postmark-checkout>`.
//
// ── WHAT THIS OWES ───────────────────────────────────────────────────────────
// src/lib/funding.mjs is the contract, and it names this file by name:
//
//   "The site never reads those files directly — tools/extract-town.mjs emits
//    src/data/postmark/*.json from the town checkout, exactly as it does for
//    households and the ledger. Three emissions carry the seam:
//      pots.json      one row per (pot, epoch): the pot file's fields VERBATIM
//                     plus the per-epoch folds the ledger alone can compute.
//      deeds.json     the patron-deed rows, verbatim.
//      economy.json   the keeping dials plus the two town-wide totals the
//                     gauges need."
//
// So every field below is either copied from a town file without alteration or
// folded from the sealed ledger. Nothing is computed twice: the ledger folds
// come from the town's OWN tools/stamp-mint.mjs, imported from the checkout.
// A grammar change in the town reaches the site as a changed fold, never as a
// second parser here that has to be kept in step.
//
// ── ZERO INVENTED NUMBERS ────────────────────────────────────────────────────
// The town's ledger carries no seam row yet — no pot-receipt, no stake:pot, no
// patron-deed, no holo. That is not a gap to paper over. Every emission below
// renders that state honestly: an empty deeds list, a pot with received 0 and
// an open roll, a treasury of 0 dollars behind 0 holo. funding.mjs handles all
// three, and the pages say "unfed" and "not published yet" in their own words.
//
// ── DETERMINISTIC FOR A GIVEN TOWN COMMIT ────────────────────────────────────
// extract-town.mjs's own contract, inherited here: everything sorted, no
// timestamps, byte-compare writes. The one clock-shaped input is the OPEN
// EPOCH, and it is read from the town's HEAD commit date rather than from
// today's — so two runs over the same town commit emit the same bytes.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeIfChanged } from "./lib/mirror.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const DATA_DIR = join(SITE_ROOT, "src", "data", "postmark");

export const SEAM_FILES = ["pots.json", "deeds.json", "economy.json"];

// ── epochs ───────────────────────────────────────────────────────────────────
// An epoch is a month (funding.mjs's EPOCH_RE: /^\d{4}-\d{2}$/), and the pot
// files declare `"epoch_cadence": "monthly"`.

export const monthOf = (isoDate) => String(isoDate ?? "").slice(0, 7);

export function nextMonth(epoch) {
  const [y, m] = String(epoch).split("-").map(Number);
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// THE OPEN EPOCH. The ledger does not stamp an epoch on a receipt or a stake —
// only a close does ("epoch:<YYYY-MM>" on every close row), because the epoch
// is the founder's label at close time, not a field the door writes. So the
// open epoch has to be derived, and it is derived the way the pot itself works:
// the first month, at or after the town's own clock, that this pot has not
// already closed.
//
// `start` is the later of the town HEAD commit's month and the newest unsettled
// receipt's month — a payment that arrived in a month is evidence that month is
// live, and a receipt can never be older than the epoch it will close into,
// because a close consumes it.
export function firstOpenEpoch(start, closedEpochs) {
  let e = start;
  // bounded: a pot cannot have closed unboundedly many future months
  for (let i = 0; i < 600 && closedEpochs.has(e); i++) e = nextMonth(e);
  return e;
}

// ── the seam fold ────────────────────────────────────────────────────────────
// Pure, so the falsifiers can run it on invented ledgers without a checkout.
//
//   mint       the town's tools/stamp-mint.mjs module (its folds, its regexes)
//   entries    parseStampLedger(...) over WHITE_PAGES/stamp-ledger.md
//   potFiles   every WHITE_PAGES/pot-*.json, parsed, unaltered
//   dial       keepingDial(repo) — σ, ρ, the ceiling, and the treasury handle
//   asOf       the town HEAD commit's date, YYYY-MM-DD
export function seamFromTown({ mint, entries, potFiles, dial, asOf }) {
  const TREASURY = mint.TREASURY_POT;

  const positions = mint.foldPotPositions(entries);
  const { receipts, settled } = mint.foldPotReceipts(entries);
  const closedEpochs = mint.foldClosedEpochs(entries);

  // TREASURY DOLLARS FUND NOTHING, so they are not what a pot's bar measures.
  // ECONOMY-DIALS.json law_side.keeping._exclusions, quoted: "treasury dollars
  // covering a shortfall fund nothing and mint nothing ('Treasury may cover any
  // shortfall — minting nothing')". stamp-mint.mjs's intakeCheck says the same
  // about the headroom the door quotes: "Treasury dollars are excluded from the
  // count AND exempt from the refusal". A bar that counted them would show a
  // pot fuller than the door believes it is.
  const funding = (from) => !(dial?.treasury && from === dial.treasury);

  // ── deeds.json — the patron-deed rows, verbatim ────────────────────────────
  // One JOINED field only, and funding.mjs names it: "`title` is the ONE
  // joined-in field: the pot file's own title, carried across by the emitter so
  // the shelf can say what was funded without the site holding a second copy of
  // the pot list."
  const titleOf = new Map(potFiles.map((p) => [String(p?.pot ?? ""), String(p?.title ?? "")]));
  const deeds = [];
  for (const e of entries) {
    const c = mint.classifyEntry(e.canonical);
    if (c.kind !== "patron-deed") continue;
    deeds.push({
      date: c.date,
      pot: c.pot,
      patron: c.patron,
      usd: c.usd,
      epoch: c.epoch,
      ref: c.ref,
      holo: c.holo,
      title: titleOf.get(c.pot) ?? "",
    });
  }
  deeds.sort((a, b) =>
    a.date.localeCompare(b.date) || a.pot.localeCompare(b.pot) ||
    a.patron.localeCompare(b.patron) || a.ref.localeCompare(b.ref));

  // ── pots.json — one row per (pot, epoch) ───────────────────────────────────
  //
  // WHEN THIS EMISSION WAS MADE. The pots block renders an "as of" tick from
  // it, so a reader can tell a quiet market from a stale page — and on a money
  // surface those two look identical without it.
  //
  // It rides on each ROW rather than wrapping the file, because pots.json is an
  // ARRAY by contract: loadPots, every surface and every fixture read it as
  // one. Wrapping it in an object to hold a single string would break all of
  // them for a timestamp. Written once per run, so every row carries the same
  // value by construction.
  const generatedAt = new Date().toISOString();
  const potRows = [];
  for (const file of [...potFiles].sort((a, b) => String(a?.pot).localeCompare(String(b?.pot)))) {
    const pot = String(file?.pot ?? "");
    // The pot FILE's fields, verbatim — the names are funding.mjs's toPot list,
    // and toPot reads them off this object under exactly these keys.
    const base = {
      pot,
      generated_at: generatedAt,
      subtype: file?.subtype,
      status: file?.status,
      title: file?.title,
      source: file?.source,
      target_usd_per_epoch: file?.target_usd_per_epoch ?? null,
      epoch_cadence: file?.epoch_cadence,
      beneficiary: file?.beneficiary ?? null,
      uncapped: file?.uncapped === true,
      // What a close does to this pot, in the pot file's own word. Three are
      // spelled by the law: "none" — pot-darko-fund.json: "a standing box, not
      // an epoch pot — gifts are witnessed, never converted; nothing here ever
      // burns or mints"; "elastic", the roll that carries forward; and
      // "epoch", the monthly pot, made explicit in the record 2026-08-25.
      // Without this field the site cannot tell a donation box from an epoch
      // pot, and every surface goes on promising a close that will never run
      // for it. Carried BY NAME — a new WORD rides through untouched, and a new
      // FIELD does not: anything the town adds here must be named here too.
      close: typeof file?.close === "string" && file.close.trim() ? file.close.trim() : null,
      // The elastic close's floor, carried across whole. § _min_close names the
      // owner and the duty in one line: "Owner of the number: this file; every
      // surface reads it." So the emitter passes it and nobody downstream
      // writes a 5 anywhere.
      min_close_usd: Number.isFinite(Number(file?.min_close_usd)) ? Number(file.min_close_usd) : null,
      // WHEN THE FIRST MONTH ACTUALLY CLOSES, when the pot says so itself.
      // pot-*.json § _first_close, verbatim: "EARLY-POSTED FOR SEPTEMBER
      // (founder's ruling, 2026-08-25 beta-launch sitting): the pots opened in
      // late August with $0 received, so the first epoch ROUNDS FORWARD — the
      // first month closes at the END of September; dollars arriving before
      // then all belong to the 2026-09 epoch. Surfaces render the epoch from
      // this field, not from the posting date."
      first_close: typeof file?.first_close === "string" && file.first_close.trim()
        ? file.first_close.trim() : null,
      board: file?.board,
    };

    const myClosed = new Set();
    for (const k of closedEpochs) {
      const [p, epoch] = String(k).split("|");
      if (p === pot) myClosed.add(epoch);
    }

    // A CLOSED EPOCH's numbers come from the close's own rows, never from the
    // pot file's `received_usd` — the pot file says so itself: "display only,
    // refreshed by tools/epoch-close.mjs --receipt — the ledger's pot-receipt
    // rows are authoritative".
    for (const epoch of [...myClosed].sort()) {
      const roll = new Map();
      let received = 0;
      for (const d of deeds) {
        if (d.pot !== pot || d.epoch !== epoch) continue;
        if (!funding(d.patron)) continue;
        received += d.usd;
        const held = roll.get(d.patron) ?? { patron: d.patron, usd: 0, holo: 0 };
        held.usd += d.usd;
        held.holo += d.holo;
        roll.set(d.patron, held);
      }
      potRows.push({
        ...base,
        status: "closed",
        epoch,
        received_usd: received,
        // A closed epoch holds no escrow: every stake either burned or
        // returned at the close. The number is 0 because the close made it 0,
        // not because nothing was staked.
        staked: 0,
        patrons: [...roll.values()].sort((a, b) => b.usd - a.usd || a.patron.localeCompare(b.patron)),
      });
    }

    // THE OPEN ROW. A pot whose FILE says `closed` has stopped asking, so it
    // gets no open row — only the months it actually closed.
    if (String(file?.status) === "closed") continue;

    const mine = receipts.filter((r) => r.pot === pot && !settled.has(r.ref));
    const newestReceipt = mine.reduce((max, r) => (r.date > max ? r.date : max), "");
    const posted = monthOf(newestReceipt) > monthOf(asOf) ? monthOf(newestReceipt) : monthOf(asOf);

    // AN EARLY-POSTED POT ROUNDS FORWARD. Derivation from the clock is right
    // for a pot that has been running; it is wrong for a pot posted mid-month
    // whose first month was never meant to be that month. The pot file settles
    // it in its own words — "the first epoch ROUNDS FORWARD ... dollars
    // arriving before then all belong to the 2026-09 epoch. Surfaces render
    // the epoch from this field, not from the posting date."
    //
    // It is a FLOOR and not an override: once September has closed, the derived
    // month walks on past it normally, and a first_close already behind the
    // clock stops mattering the moment it is spent. Nothing here reaches
    // backwards — a pot can only ever be rounded FORWARD by this.
    const firstCloseMonth = base.first_close ? monthOf(base.first_close) : "";
    const start = firstCloseMonth > posted ? firstCloseMonth : posted;
    const epoch = firstOpenEpoch(start, myClosed);

    // The roll before a close is the receipts themselves: who has fed this pot
    // this epoch, and for how much. holo is 0 on every entry and that is a real
    // answer, not a missing one — no holo exists until a close mints it.
    const roll = new Map();
    let received = 0;
    for (const r of mine) {
      if (!funding(r.from)) continue;
      received += r.usd;
      const held = roll.get(r.from) ?? { patron: r.from, usd: 0, holo: 0 };
      held.usd += r.usd;
      roll.set(r.from, held);
    }

    let staked = 0;
    for (const [k, n] of positions) {
      const [p] = String(k).split("|");
      if (p === pot && n > 0) staked += n;
    }

    potRows.push({
      ...base,
      epoch,
      received_usd: received,
      staked,
      patrons: [...roll.values()].sort((a, b) => b.usd - a.usd || a.patron.localeCompare(b.patron)),
    });
  }

  // ── economy.json — the dials plus the town-wide totals ─────────────────────
  // No dial, no emission. keepingDial() returns null for a missing, malformed,
  // or over-ceiling dial, and this mirrors that refusal rather than shipping a
  // half set — funding.mjs's readEconomy would refuse it anyway ("Half a set of
  // numbers rendered as the town's would be a quieter lie than the honest 'not
  // published yet'").
  let economy = null;
  if (dial) {
    const sum = (m) => [...m.values()].reduce((a, n) => a + n, 0);
    economy = {
      as_of: String(asOf).slice(0, 10),
      sigma: dial.sigma,
      rho: dial.rho,
      rho_constitutional_ceiling: dial.rhoCeiling,
      // DOLLARS THE TOWN HOLDS. Every witnessed dollar the ledger records, both
      // the pots' and the direct-to-town ones. The ledger has no outflow row of
      // any kind, so what came in IS what the town holds — the moment a spend
      // row exists in the grammar, this fold must subtract it or the backing
      // gauge starts overstating.
      treasury_usd: receipts.reduce((a, r) => a + r.usd, 0),
      // Earned primary mint, ✦, town-wide — foldMintCount, exactly the field's
      // name. NOTE for the reader's owner: R12 sets the ρ BASE wider than this
      // ("holo cap base = earned primary mint + keeping mint"), so `keeping_mint`
      // rides along below. readEconomy's holoCap is ρ × primary_mint_earned
      // today; the two agree while keeping mint is 0, and diverge the first time
      // a pot closes.
      primary_mint_earned: sum(mint.foldMintCount(entries)),
      keeping_mint: sum(mint.foldKeepingMint(entries)),
      holo_issued: sum(mint.foldHolo(entries)),
    };
  }

  return { pots: potRows, deeds, economy };
}

// ── the checkout side ────────────────────────────────────────────────────────

export function readPotFiles(townRoot) {
  const dir = join(townRoot, "WHITE_PAGES");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/^pot-.+\.json$/.test(name)) continue;
    try { out.push(JSON.parse(readFileSync(join(dir, name), "utf8"))); }
    catch { console.warn(`WARN seam: WHITE_PAGES/${name} is not readable JSON — skipped`); }
  }
  return out;
}

// The town's HEAD commit date, short ISO. Deterministic for a given commit,
// which is extract-town.mjs's whole contract; falls back to nothing rather than
// to `new Date()`, because a clock would make two runs over one commit disagree.
export function townCommitDate(townRoot) {
  try {
    return execFileSync("git", ["-C", townRoot, "log", "-1", "--format=%cs"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch { return null; }
}

export async function emitSeam(townRoot, { dataDir = DATA_DIR } = {}) {
  const mintPath = join(townRoot, "tools", "stamp-mint.mjs");
  const ledgerPath = join(townRoot, "WHITE_PAGES", "stamp-ledger.md");
  if (!existsSync(mintPath) || !existsSync(ledgerPath)) {
    console.warn("WARN seam: no tools/stamp-mint.mjs or WHITE_PAGES/stamp-ledger.md — seam emissions left as-is");
    return null;
  }
  const mint = await import(pathToFileURL(mintPath).href);
  const entries = mint.parseStampLedger(readFileSync(ledgerPath, "utf8"));
  const dial = mint.keepingDial(townRoot);
  const asOf = townCommitDate(townRoot);
  if (!dial) console.warn("WARN seam: no readable keeping dial — economy.json left as-is");
  if (!asOf) console.warn("WARN seam: town HEAD date unreadable — economy.json left as-is");

  const seam = seamFromTown({ mint, entries, potFiles: readPotFiles(townRoot), dial, asOf });

  const write = (name, value) => {
    const r = writeIfChanged(join(dataDir, name), JSON.stringify(value, null, 2) + "\n");
    console.log(`data/${name}: ${r}`);
  };
  write("pots.json", seam.pots);
  write("deeds.json", seam.deeds);
  if (seam.economy && asOf) write("economy.json", seam.economy);

  console.log(`seam: ${seam.pots.length} pot-epoch rows, ${seam.deeds.length} deeds, ` +
    `${seam.economy ? `${seam.economy.holo_issued}✧ issued, $${seam.economy.treasury_usd} witnessed` : "no dials"}`);
  return seam;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const town = resolve(arg("--town", join(SITE_ROOT, "..", "postmark")));
  if (!existsSync(join(town, "WHITE_PAGES"))) {
    console.error(`FATAL: not a town checkout (no WHITE_PAGES): ${town}`);
    process.exit(1);
  }
  await emitSeam(town);
}
