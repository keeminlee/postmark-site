// board.mjs — the Bounty Board's reader over the world store.
//
// The board is not its own database. A notice IS a world mark: `class: bounty`,
// placed under the board place mark. This module is the one place that knows how
// to turn the world store into notices, so the page stays presentation.
//
// ── THE GRAMMAR THIS READS ───────────────────────────────────────────────────
// Authored by Wright's pen, not here. Built against the documented shape:
//
//   class:  bounty                 — the class mark this notice belongs to
//   ask:    <one claim, ≤150 chars> — what is wanted, in one sentence
//   reward: <n>                     — stamps, a whole number ≥ 1
//   status: open | done             — a done notice stays on the board, struck
//   by:     <handle>                — the poster; `the-town` makes it CIVIC
//   threshold: <n>                  — CIVIC ONLY: the stake target the bar fills toward
//
// and the mark's placement parent is the board place mark (BOARD_PLACE below).
//
// UNTIL THAT PEN LANDS this reads an empty board, and that is the correct
// behaviour, not a bug: `notices()` returns [] and the page says so plainly. It
// never seeds an example. A fixture exists for tests and for `?fixture` in dev,
// and it is reachable from nowhere else — a demo notice that can appear on the
// live board is a lie about what the town has been asked for.
//
// ── ledger_weight, NOT ✦ ─────────────────────────────────────────────────────
// `backed` on a notice is the town's read-side ledger_weight — raw escrow plus
// the breadth bonus for unique EXTERNAL staking households. It is not the world's
// effective ✦, which adds terrain and the parent-consent fan-up in the world's own
// fold. The board shows what residents have put behind a notice; it does not
// pretend to be the world's verdict on it.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// The board place mark. A notice is a bounty-class mark whose placement parent
// is this mark; changing the board's home is a one-line change here, and no
// other file learns the id.
export const BOARD_PLACE = "the-town/the-bounty-board";
export const BOUNTY_CLASS = "bounty";
export const ASK_MAX = 150;

// ── the store ────────────────────────────────────────────────────────────────
// Same source the /world viewer is served from: the pinned postmark-world
// package. Build-time freshness is the pin's freshness, which is the same
// freshness the world page has — no second pipeline, no second truth.
export function loadWorldState({ path = null, require: req = createRequire(import.meta.url) } = {}) {
  try {
    // Resolve through an EXPORTED specifier. `postmark-world/package.json` is not
    // in the package's exports map, so resolving it throws
    // ERR_PACKAGE_PATH_NOT_EXPORTED and the board silently reads empty — which is
    // exactly how this was caught: the first build rendered "the world store
    // could not be read" against a world that was sitting right there.
    const file = path ?? join(dirname(req.resolve("postmark-world/geometry")), "..", "WORLD", "world-state.json");
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // Fail-soft, exactly like fetch-town.mjs: a missing or unreadable store must
    // not take the site down. An empty board is honest; a build failure is not.
    return null;
  }
}

// ── notices ──────────────────────────────────────────────────────────────────
const isNum = (v) => Number.isFinite(Number(v)) && String(v).trim() !== "";

// A mark is a notice when it declares the bounty class AND sits under the board.
// Both halves matter: class alone would sweep in a bounty-shaped mark someone
// placed elsewhere in the world, and place alone would sweep in whatever else
// stands on the board.
export function isNotice(mark, { boardPlace = BOARD_PLACE } = {}) {
  if (!mark || mark.class !== BOUNTY_CLASS) return false;
  const parent = mark.placementParent ?? mark.parent ?? null;
  return parent === boardPlace;
}

// One mark → one notice, or null if it cannot be read as one. A malformed notice
// is DROPPED and counted, never rendered half-built and never silently ignored:
// `notices()` returns the reasons alongside, and the page shows the count.
export function toNotice(mark) {
  const ask = String(mark.ask ?? "").trim();
  if (!ask) return { ok: false, id: mark.id, reason: "no ask" };
  // Code POINTS, not UTF-16 units — the door and the world's lint both count
  // [...ask].length (the law says 150 Unicode characters), so counting units
  // here would drop a lawful emoji-bearing ask as counted-not-rendered: the
  // exact outcome this reader exists to avoid (review O-2/W-3, 2026-08-11).
  const askLen = [...ask].length;
  if (askLen > ASK_MAX) return { ok: false, id: mark.id, reason: `ask is ${askLen} chars (max ${ASK_MAX})` };
  if (!isNum(mark.reward) || Number(mark.reward) < 1 || !Number.isInteger(Number(mark.reward)))
    return { ok: false, id: mark.id, reason: `reward must be a whole number ≥ 1 (got ${JSON.stringify(mark.reward)})` };
  const status = String(mark.status ?? "open").trim();
  if (status !== "open" && status !== "done") return { ok: false, id: mark.id, reason: `status must be open or done (got ${JSON.stringify(status)})` };

  const poster = mark.by ?? mark.household ?? null;
  const civic = poster === "the-town";
  // A threshold only means anything on a civic notice — that is the ruling that
  // pluralized the global bar. On a resident notice it is ignored rather than
  // rendered, so a stray field cannot grow a progress bar the town did not vote.
  const threshold = civic && isNum(mark.threshold) && Number(mark.threshold) > 0 ? Number(mark.threshold) : null;
  const backed = isNum(mark.ledger_weight) ? Number(mark.ledger_weight) : 0;
  const escrow = isNum(mark.stamps) ? Number(mark.stamps) : 0;

  return {
    ok: true,
    id: mark.id,
    ask,
    reward: Number(mark.reward),
    status,
    poster,
    civic,
    backed,
    escrow,
    threshold,
    // Clamped for the bar's width only; `backed` and `threshold` stay raw so an
    // over-subscribed notice reads as over-subscribed rather than as merely full.
    progress: threshold ? Math.min(1, backed / threshold) : null,
    date: String(mark.date ?? "").slice(0, 10) || null,
    body: String(mark.body ?? "").trim() || null,
  };
}

// The board, read. Sorted: open before done, then most-backed, then newest.
export function notices(state, { boardPlace = BOARD_PLACE } = {}) {
  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const candidates = marks.filter((m) => isNotice(m, { boardPlace }));
  const open = [], malformed = [];
  for (const m of candidates) {
    const n = toNotice(m);
    if (n.ok) open.push(n); else malformed.push(n);
  }
  open.sort((a, b) =>
    (a.status === b.status ? 0 : a.status === "open" ? -1 : 1) ||
    b.backed - a.backed ||
    String(b.date ?? "").localeCompare(String(a.date ?? "")) ||
    a.id.localeCompare(b.id));
  return {
    notices: open,
    malformed,
    // `boardExists` separates "the board is up and nobody has posted" from "the
    // board mark is not in the world yet". Both render empty; they do not mean
    // the same thing, and the page says which.
    boardExists: marks.some((m) => m.id === boardPlace),
    storeRead: state !== null,
  };
}

// ── the fixture ──────────────────────────────────────────────────────────────
// Matches the documented grammar exactly, so it is a live check that the reader
// and the grammar agree. Tests and dev only — never a fallback for an empty
// board, because a board with no bounties must say so.
export const FIXTURE = {
  marks: [
    { id: BOARD_PLACE, by: "the-town", household: "the-town", tier: "constitution", sovereign: false, date: "2026-08-10" },
    {
      id: "the-town/bounty-a-map-of-the-quay", class: BOUNTY_CLASS, placementParent: BOARD_PLACE,
      by: "the-town", household: "the-town", date: "2026-08-10", status: "open",
      ask: "Draw the quay as it stands, with every mail-house named.",
      reward: 40, threshold: 100, ledger_weight: 35, stamps: 30,
      body: "The atlas has the shape but not the names.",
    },
    {
      id: "wright/bounty-a-second-reader-for-the-grain", class: BOUNTY_CLASS, placementParent: BOARD_PLACE,
      by: "wright", household: "wright", date: "2026-08-09", status: "open",
      ask: "Read the grain doctrine once more and tell me where it argues with itself.",
      reward: 12, ledger_weight: 7, stamps: 7,
    },
    {
      id: "rei/bounty-a-name-for-the-ship", class: BOUNTY_CLASS, placementParent: BOARD_PLACE,
      by: "rei", household: "rei", date: "2026-08-07", status: "done",
      ask: "Find the ship at anchor a name the town will keep.", reward: 25, ledger_weight: 0, stamps: 0,
    },
  ],
};
