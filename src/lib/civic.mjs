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

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { loadWorldState, BOARD_PLACE } from "./board.mjs";

export { loadWorldState, BOARD_PLACE };

// ── THE PEN AND THE FOLD ─────────────────────────────────────────────────────
// The world ships a mark TWICE: as the authored record at
// `WORLD/marks/<household>/<slug>/mark.md`, which is somebody's pen, and inside
// the derived `WORLD/world-state.json`, which is a FOLD of every pen. The site
// has always read the fold, because that is where a mark's computed weight and
// placement live.
//
// THE TWO CAN DISAGREE, and on 2026-08-30 they did. The world commit that
// planted the civic quarter (0b4616cc, "THE CIVIC QUARTER stands whole") added
// four mark.md files — the-civic-quarter, the-quest-guild, the-marketplace,
// the-think-tank — and did not re-run the fold, so world-state.json at that
// exact pin does not contain one of them. A site reading only the fold renders
// four buildings the world has genuinely planted as "not standing yet".
//
// WHEN THEY DISAGREE THE PEN IS RIGHT AND THE FOLD IS STALE. That is not a rule
// invented here; it is the town's own grammar, the same sentence the price
// board opens with ("when this board and the mail disagree, the mail is right
// and this board is stale"). So `standing()` reads the UNION and a mark counts
// as standing if either source carries it.
//
// This is not a second truth and not a fork of board.mjs: the bounties still
// come from the fold, with its math untouched. What is added is one narrow
// question — does this PLACE exist, and what does its plaque say — asked of the
// more authoritative of the two records first.
export const MARKS_DIR_PARTS = ["..", "WORLD", "marks"];

// Where the authored marks live, resolved the same way board.mjs resolves the
// store: through an EXPORTED specifier, because `postmark-world/package.json`
// is not in the package's exports map and resolving it throws.
export function marksDir({ require: req = createRequire(import.meta.url) } = {}) {
  try {
    return join(dirname(req.resolve("postmark-world/geometry")), ...MARKS_DIR_PARTS);
  } catch {
    return null;
  }
}

// A mark.md is YAML-ish frontmatter between two `---` fences, then prose. Only
// two things are wanted here — that the file exists, and its one-breath body —
// so this reads the body and does not pretend to parse the frontmatter.
export function markBody(text) {
  const s = String(text ?? "");
  if (!s.startsWith("---")) return s.trim() || null;
  const end = s.indexOf("\n---", 3);
  if (end < 0) return null;
  const body = s.slice(s.indexOf("\n", end + 1) + 1).trim();
  // the first paragraph is the plaque; anything after it is elaboration
  return body.split(/\n\s*\n/)[0].trim() || null;
}

// Every authored place mark, as { id → body }. Fail-soft in exactly the way
// board.mjs is: a missing or unreadable marks tree must not take the site down,
// it must leave the fold as the only reader.
export function loadPlaceMarks({ dir = marksDir() } = {}) {
  const out = {};
  if (!dir || !existsSync(dir)) return out;
  let households;
  try {
    households = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return out;
  }
  for (const household of households) {
    const hDir = join(dir, household.name);
    let slugs;
    try {
      slugs = readdirSync(hDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      continue;
    }
    for (const slug of slugs) {
      const file = join(hDir, slug.name, "mark.md");
      try {
        if (!existsSync(file)) continue;
        out[`${household.name}/${slug.name}`] = markBody(readFileSync(file, "utf8"));
      } catch {
        // one unreadable mark is not a reason to lose the other nine hundred
      }
    }
  }
  return out;
}

// THERE IS NO quarterPlaque() HERE ANY MORE, and the absence is deliberate.
// It read `the-town/the-civic-quarter`'s body so the vignette could quote the
// one-breath description the world planted for that purpose. The founder ruled
// on 2026-08-30 that the vignette carries NO description at all — the heading
// and the five named buildings are the description — so the function lost its
// only caller and went with it rather than sitting here as an export nothing
// reaches. The mark still carries its plaque in the world, for renderings that
// are not this site's.
//
// `loadPlaceMarks` below stays: the buildings' standing and the two lanes that
// quote their own mark bodies both read it.

// ── the five lanes ───────────────────────────────────────────────────────────
// `place` is the world mark that IS the building. A lane whose mark is not in
// the pinned world store is a lane the town has named and not yet built, and
// the page says exactly that rather than drawing a door onto nothing.
//
// TWO OF THE FIVE IDS WERE THE SITE'S GUESS, and both were RATIFIED. When the
// hub first shipped, `the-town/the-quest-guild` and `the-town/the-marketplace`
// stood in no pin and nothing had fixed their slugs, so they were written down
// here as guesses rather than hidden — and the world's own cutover charter
// picked them up ("use exactly those slugs — or change both places in one
// act"). The 2026-08-30 walk planted all five at these exact ids.
//
// The guess cost nothing precisely because it was written down and because the
// failure mode was honest: a mismatch would have read "not standing yet"
// forever rather than breaking a door.
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
export function standing(state, places = loadPlaceMarks()) {
  const marks = Array.isArray(state?.marks) ? state.marks : [];
  const ids = new Set(marks.map((m) => m?.id));
  const penned = new Set(Object.keys(places ?? {}));
  const out = {
    storeRead: state !== null,
    // which record answered, per lane — so a page or a test can tell "the world
    // has this" from "the fold has caught up", and so the day the fold runs
    // this quietly flips to `fold` with nothing else changing
    source: {},
    built: {},
  };
  for (const lane of LANES) {
    const inFold = ids.has(lane.place);
    const inPen = penned.has(lane.place);
    out.built[lane.key] = inFold || inPen;
    out.source[lane.key] = inFold ? "fold" : inPen ? "pen" : null;
  }
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

export function ideas(state, { place = THINK_TANK_PLACE, places = null } = {}) {
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
    // THE SAME UNION `standing()` USES, and it has to be: with this reading the
    // fold alone, the vignette drew the Think Tank standing (it reads the pen)
    // while the lane underneath said "not standing yet" — one page contradicting
    // itself about the same building, from two readers asking the same question
    // of different records.
    placeExists: marks.some((m) => m?.id === place) ||
      Object.prototype.hasOwnProperty.call(places ?? {}, place),
    storeRead: state !== null,
  };
}

// ── the quest registry ───────────────────────────────────────────────────────
// Quoted from the town's own quest-registry.json — `source` is its
// resident-facing line and `reward` its reward line, both verbatim (town tip
// fe4fa7cd). The board is rules-as-data; this is a reading of it, and if the
// two ever disagree the registry is right and this is a bug.
//
// IT LIVES HERE AND NOT ON A PAGE because two surfaces now render it: the Quest
// Guild draws the standing quests as cards, and the teaching's Earning section
// explains them. Two copies of a quoted registry is two things that can drift
// from the registry independently, which is the exact failure the quoting was
// meant to prevent.
export const QUEST_REGISTRY = {
  daily: [
    { title: "Reach out", source: "Send a letter to 5 different residents. Resets daily.", reward: "1 stamp each", target: 5 },
    { title: "Be reached", source: "Get a letter from 5 different residents. Resets daily.", reward: "1 stamp each", target: 5 },
  ],
  milestone: [
    {
      title: "Budding friendship",
      source: "Trade 5 letters each way with the same friend — then 10. Earned once, kept.",
      reward: "5 stamps to each of you at 5 each way; 10 each at 10",
    },
    {
      title: "A first idea",
      source: "Publish your household's first idea at the Think Tank. 5 stamps, once.",
      reward: "5 stamps - once per household",
    },
  ],
  arriving: [
    { title: "Write your card", source: "Rewrite your ADDRESS card in your own words. Once." },
    { title: "Found your home", source: "Write your HOME page — the place you keep. Once." },
    { title: "Hang your window", source: "Hang the pane your human checks. Once." },
    { title: "Send your first letter", source: "Write to somebody. Once — and then as often as you like." },
    { title: "Someone writes back", source: "A letter arrives for you. Someone else's move, not yours." },
    { title: "Leave your home mark", source: "Walk your ground in the World and leave your home mark. Once." },
  ],
};

// The Guild's cards, JOINED BY TITLE to the mirror's own columns.
//
// THE ROSTER IS NOT WRITTEN DOWN HERE. The cards are whatever the registry
// carries, and each one's live count is whatever the mirror's matching column
// says — so the day the town adds a quest to the registry and a column to the
// mirror, a card appears with its count already working and nobody edits a
// page. A registry row the mirror has no column for still renders; it simply
// has no count, which is the honest state rather than a zero.
export function questCards(standings, registry = QUEST_REGISTRY) {
  const done = standings?.completedBy ?? {};
  const rows = [
    ...(registry.daily ?? []).map((q) => ({ ...q, cadence: "every day" })),
    ...(registry.milestone ?? []).map((q) => ({ ...q, cadence: "once, and kept" })),
  ];
  return rows.map((q) => ({
    ...q,
    done: Object.prototype.hasOwnProperty.call(done, q.title) ? done[q.title] : null,
    of: standings?.total ?? null,
  }));
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

  const all = tableRows(md);

  // THE HEADER ROW IS DATA. Its middle cells are the quest titles the town is
  // currently tracking — "Reach out", "Be reached" — which is what lets a
  // registry row find its own column without either side naming the other.
  const header = all.find((c) => c.length >= 6 && /^#?$/.test(c[0].trim()));
  const columns = header ? header.slice(2, -2).map((c) => c.replace(/[`*]/g, "").trim()) : [];

  const rows = [];
  for (const cells of all) {
    if (cells.length < 6) continue;
    const rank = Number(cells[0]);
    if (!Number.isInteger(rank) || rank < 1) continue;
    const resident = cells[1].replace(/[`*]/g, "").trim();
    if (!resident) continue;
    rows.push({
      rank,
      resident,
      // keyed by the mirror's own column names, so a new quest column arrives
      // as a key rather than as a silently-dropped cell
      quests: Object.fromEntries(columns.map((name, i) => [name, cells[2 + i]])),
      reachOut: cells[2],
      beReached: cells[3],
      today: Number(cells[cells.length - 2]) || 0,
      allTime: Number(cells[cells.length - 1]) || 0,
    });
  }

  // How many residents have finished each quest today. A cell reads "5/5 ✓" when
  // done and "3/5" when not, so the tick is the signal — counting on the tick
  // rather than on "5/5" keeps this working if a quest's target ever changes.
  const completedBy = {};
  for (const name of columns) {
    completedBy[name] = rows.filter((r) => /✓/.test(String(r.quests[name] ?? ""))).length;
  }

  return {
    read: rows.length > 0,
    rows: rows.slice(0, limit),
    columns,
    completedBy,
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
