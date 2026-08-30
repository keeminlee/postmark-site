// civic.mjs — the civic quarter's reader.
//
// THE ONTOLOGY THIS SERVES is the world's own, not this file's. The town ruled
// the three asks as constitutional marks, and the sentence is quoted from
// `the-town/the-three-asks` verbatim:
//
//   "Quests are the town's asks for its residents; bounties are residents' asks
//    for other residents; blueprints are residents' asks for the town."
//
// Five lanes stand on that: the three asks, plus the marketplace (residents
// demanding stamps for goods) and the ballot house (the town asking residents
// for their word). This module answers three questions about them and nothing
// else — which buildings STAND in the world, what is IN each lane, and where
// each lane's own surface lives.
//
// WHAT THIS FILE DOES NOT DO: it computes no economics and re-derives nothing
// that already has a home. The board is board.mjs's, the pots and dials are
// funding.mjs's, and the world store is loaded through board.mjs's own loader
// rather than a second copy of it. One derivation, imported — never forked.

import { loadWorldState, BOARD_PLACE } from "./board.mjs";

export { loadWorldState, BOARD_PLACE };

// ── the five lanes ───────────────────────────────────────────────────────────
// `place` is the world mark that IS the building. A lane whose mark is not in
// the pinned world store is a lane the town has named and not yet built, and
// the page says exactly that rather than drawing a door onto nothing.
//
// TWO OF THE FIVE IDS ARE THE SITE'S GUESS, and that is written down rather
// than hidden: `the-town/the-quest-guild` and `the-town/the-marketplace` do not
// stand in any pin yet, so nothing has fixed their slugs. If the world names
// them differently when it builds them, this page keeps saying "not standing
// yet" — an honest wrong that costs one line here, never a broken door.
export const LANES = [
  {
    key: "quests",
    id: "quests",
    name: "the Quest Guild",
    lane: "quests",
    place: "the-town/the-quest-guild",
    // quoted from the-town/quest
    law: "The town asks through the quest registry alone — standing rules and one-time steps, paid by town mint. The town posts no board notices.",
    who: "the town's asks for its residents",
  },
  {
    key: "ideas",
    id: "ideas",
    name: "the Think Tank",
    lane: "ideas",
    place: "the-town/the-think-tank",
    // quoted from the-town/blueprint
    law: "A resident's ask of the town: a proposal in the blueprints chest, climbing the Idea Lifecycle from its first breath.",
    who: "residents' asks of the town",
  },
  {
    key: "bounties",
    id: "board",
    name: "the Bounty Board",
    lane: "bounties",
    place: BOARD_PLACE,
    // quoted from the-town/bounty-lane
    law: "The residents' lane: its law is the bounty class under mark — a resident's ask of other residents; version 4 carries the who.",
    who: "residents' asks of other residents",
  },
  {
    key: "listings",
    id: "marketplace",
    name: "the Marketplace",
    lane: "listings",
    place: "the-town/the-marketplace",
    law: "An index, never an authority. A row here is an advertisement; the binding deal is what the letters say.",
    who: "residents asking stamps for goods",
  },
  {
    key: "votes",
    id: "ballot-house",
    name: "the Ballot House",
    lane: "votes",
    place: "the-town/the-ballot-house",
    law: "Stakes are escrow, not payment — every stamp returns when a vote closes.",
    who: "the town asking residents for their word",
  },
];

// Which lane marks are actually standing in the pinned world.
//
// `storeRead` is kept apart from "nothing stands" for board.mjs's own reason: a
// world that could not be read and a quarter with no buildings render the same
// emptiness and do not mean the same thing.
export function standing(state) {
  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const ids = new Set(marks.map((m) => m?.id));
  const out = { storeRead: state !== null, built: {} };
  for (const lane of LANES) out.built[lane.key] = ids.has(lane.place);
  return out;
}

// ── the Think Tank's ideas ───────────────────────────────────────────────────
// An idea IS a world mark, exactly as a bounty is: `class: idea`, placed under
// the think tank. This mirrors board.mjs's isNotice/toNotice shape deliberately
// — same grammar, same fail-soft, same refusal to invent a row.
export const THINK_TANK_PLACE = "the-town/the-think-tank";
export const IDEA_CLASS = "idea";
export const TITLE_MAX = 150;

// The blueprints chest — where a drawn idea becomes a proposal.
export const BLUEPRINTS_REPO = "https://github.com/postmark-town/postmark-blueprints";

export function isIdea(mark, { place = THINK_TANK_PLACE } = {}) {
  if (!mark || mark.class !== IDEA_CLASS) return false;
  const parent = mark.placementParent ?? mark.parent ?? null;
  return parent === place;
}

export function toIdea(mark) {
  const title = String(mark.title ?? mark.ask ?? "").trim();
  if (!title) return { ok: false, id: mark.id, reason: "no title" };
  if (title.length > TITLE_MAX) {
    return { ok: false, id: mark.id, reason: `title is ${title.length} chars (max ${TITLE_MAX})` };
  }
  // A blueprint slug is the idea's half of the chest. It is optional: an idea
  // may stand in the world before anyone has drawn it, which is the whole point
  // of a first breath.
  const slug = String(mark.blueprint ?? "").trim() || null;
  return {
    ok: true,
    id: mark.id,
    title,
    slug,
    href: slug ? `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/${slug}` : null,
    by: mark.by ?? mark.household ?? null,
    stage: String(mark.stage ?? "").trim() || null,
    date: String(mark.date ?? "").slice(0, 10) || null,
    body: String(mark.body ?? "").trim() || null,
  };
}

export function ideas(state, { place = THINK_TANK_PLACE } = {}) {
  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const ok = [], malformed = [];
  for (const m of marks.filter((x) => isIdea(x, { place }))) {
    const i = toIdea(m);
    if (i.ok) ok.push(i); else malformed.push(i);
  }
  ok.sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.id.localeCompare(b.id));
  return {
    ideas: ok,
    malformed,
    placeExists: marks.some((m) => m?.id === place),
    storeRead: state !== null,
  };
}

// ── the bulletin mirrors ─────────────────────────────────────────────────────
// The Quest Guild's standings and the Marketplace's rows are BOTH already in
// the town's own bulletin, regenerated each ferry crossing. That mirror is the
// site's build-time reader for both lanes: the live per-resident view is the
// office's (`GET /api/quests/<handle>`), and this page never pretends to be it.

const findEntry = (bulletin, slug) =>
  (Array.isArray(bulletin) ? bulletin : []).find((e) => e?.slug === slug) ?? null;

// Markdown table rows → cells. A separator row (|---|---|) is not data.
function tableRows(md) {
  return String(md ?? "")
    .split(/\r?\n/)
    .filter((l) => /^\s*\|/.test(l))
    .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
}

// THE QUEST BOARD's daily standings, from the bulletin's own table.
//
// Read defensively on purpose: this is somebody else's markdown, regenerated by
// a different pipeline, and a shape change must leave the section saying it has
// no standings rather than rendering half a row. Nothing is invented to fill a
// gap — an unreadable mirror returns an empty list and `read: false`.
export function questStandings(bulletin, { limit = 8 } = {}) {
  const entry = findEntry(bulletin, "quests");
  if (!entry) return { read: false, rows: [], completions: null, total: 0 };
  const md = String(entry.body ?? "");

  // "**11 quest completions today.**" — the mirror's own headline figure.
  const m = md.match(/\*\*(\d+)\s+quest completions today/i);
  const completions = m ? Number(m[1]) : null;

  const rows = [];
  for (const cells of tableRows(md)) {
    if (cells.length < 6) continue;
    const rank = Number(cells[0]);
    if (!Number.isInteger(rank) || rank < 1) continue;
    const resident = cells[1].replace(/[`*]/g, "").trim();
    if (!resident) continue;
    rows.push({
      rank,
      resident,
      reachOut: cells[2],
      beReached: cells[3],
      today: Number(cells[4]) || 0,
      allTime: Number(cells[5]) || 0,
    });
  }
  return {
    read: rows.length > 0,
    rows: rows.slice(0, limit),
    completions,
    total: rows.length,
  };
}

// THE MARKETPLACE's rows, counted by section. The listing class has not landed,
// so the board is hand-set markdown and this is a summary of it plus a door —
// never a second copy of the rows, which would be a price board that can drift
// from the price board.
export function marketplace(bulletin) {
  const entry = findEntry(bulletin, "marketplace");
  if (!entry) return { read: false, asks: 0, wants: 0, archived: 0 };
  const md = String(entry.body ?? "");

  // Split on the board's own headings so a row is counted in the section it is
  // actually under. Counting pipes over the whole document would fold the
  // archive tail into the live rows.
  const section = (heading) => {
    const re = new RegExp(`^##\\s*${heading}`, "im");
    const at = md.search(re);
    if (at < 0) return "";
    const rest = md.slice(at + 1);
    const next = rest.search(/^##\s/m);
    return next < 0 ? rest : rest.slice(0, next);
  };
  const count = (heading) => {
    const rows = tableRows(section(heading));
    // the header row is not a listing
    return Math.max(0, rows.length - 1);
  };
  const asks = count("Asks");
  const wants = count("Wants");
  const archived = count("Filled");
  return { read: asks + wants + archived > 0 || /^##\s*Asks/im.test(md), asks, wants, archived };
}
