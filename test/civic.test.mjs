// civic.mjs and civic-art.mjs — the civic quarter's reader and its pixel art.
//
// TWO THINGS ARE BEING PROTECTED HERE, and they fail in opposite ways.
//
// THE READER fails LOUDLY if you let it: a shape change in somebody else's
// markdown, a world store that will not load, an idea mark with no claim in its body.
// Every one of those must come back as a named nothing — `read: false`, an
// empty list, a malformed row with its reason — because the page's whole
// discipline is that it never invents a town. So the tests below feed it
// garbage on purpose and assert it says so rather than guessing.
//
// THE ART fails SILENTLY, which is worse. A sprite row one character short
// skews every pixel after it and renders as a building with a notch in it;
// nothing throws, nothing goes red, and it ships. The maps are therefore
// checked as data, and `paint` is held to refusing ink it does not know.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LANES, standing, ideas, isIdea, toIdea, questStandings, questCards, marketplace,
  loadPlaceMarks, markBody, QUEST_REGISTRY,
  THINK_TANK_PLACE, IDEA_CLASS, TITLE_MAX, BLUEPRINTS_REPO,
} from "../src/lib/civic.mjs";
import { SPRITES, SPRITE_W, SPRITE_H, INK, paint, checkSprite, checkAllSprites } from "../src/lib/civic-art.mjs";
import { BOARD_PLACE } from "../src/lib/board.mjs";

// ── the ontology ─────────────────────────────────────────────────────────────

test("the five lanes are the world's three asks plus the market and the ballot", () => {
  // THE LAW, quoted from the-town/the-three-asks: "Quests are the town's asks
  // for its residents; bounties are residents' asks for other residents;
  // blueprints are residents' asks for the town." The site does not get to
  // invent a sixth lane or drop one of the three.
  assert.deepEqual(LANES.map((l) => l.key), ["quests", "ideas", "bounties", "listings", "votes"]);
  for (const lane of LANES) {
    assert.ok(lane.name && lane.name.length > 3, `${lane.key} has no name`);
    assert.ok(lane.place && lane.place.startsWith("the-town/"), `${lane.key} names no world place`);
    assert.ok(lane.id && /^[a-z-]+$/.test(lane.id), `${lane.key} has no anchor id`);
    assert.ok(lane.who && lane.law, `${lane.key} does not say what it is`);
  }
});

test("the bounty lane reuses board.mjs's own place, rather than retyping it", () => {
  // One derivation, imported — never forked. A second spelling of the board's
  // id is a second answer to where the board is.
  const bounties = LANES.find((l) => l.key === "bounties");
  assert.equal(bounties.place, BOARD_PLACE);
  assert.equal(bounties.id, "board",
    "the board's anchor must stay `board` — every deep link ever written points at that word");
});

// ── which buildings stand ────────────────────────────────────────────────────

test("standing() reads the world, and tells an unreadable store from an empty one", () => {
  // These two render the same emptiness and do not mean the same thing — the
  // distinction board.mjs drew for the notices, kept for the buildings.
  const none = standing(null, {});
  assert.equal(none.storeRead, false, "a null store must be reported as unread");
  assert.deepEqual(Object.values(none.built), [false, false, false, false, false]);

  const empty = standing({ marks: [] }, {});
  assert.equal(empty.storeRead, true, "a store that loaded and holds nothing HAS been read");
  assert.deepEqual(Object.values(empty.built), [false, false, false, false, false]);
});

test("a building stands exactly when its mark is in the world", () => {
  const world = { marks: [{ id: BOARD_PLACE }, { id: "the-town/the-ballot-house" }] };
  const s = standing(world, {});
  assert.equal(s.built.bounties, true, "the board is in the world and must read as standing");
  assert.equal(s.built.votes, true, "so is the ballot house");
  assert.equal(s.built.quests, false, "the quest guild is not, and must not be claimed");
  assert.equal(s.built.ideas, false);
  assert.equal(s.built.listings, false);

  // AND IT CLEARS ITSELF. The whole reason this is read rather than written
  // down: the day the world builds the Think Tank, the page lights it with no
  // edit. If this ever needs a code change to go true, the mechanism is broken.
  const later = standing({ marks: [...world.marks, { id: THINK_TANK_PLACE }] }, {});
  assert.equal(later.built.ideas, true,
    "adding the mark to the world must be enough to stand the building up");
});

// ── the pen and the fold ─────────────────────────────────────────────────────

test("a mark the pen has and the fold does not still stands", () => {
  // THE LIVE DEFECT THIS CAUGHT, on the pin the hub was built against. The
  // world commit that planted the civic quarter (0b4616cc, "THE CIVIC QUARTER
  // stands whole") added four mark.md files and did NOT re-run the fold, so
  // world-state.json at that exact pin carries none of them. Reading the fold
  // alone drew four buildings the world had genuinely planted as "not standing
  // yet" — a page contradicting the world it renders.
  const fold = { marks: [{ id: BOARD_PLACE }] };
  const pen = { "the-town/the-quest-guild": "The Quest Guild — the town's asks." };
  const s = standing(fold, pen);
  assert.equal(s.built.bounties, true, "the fold's own mark still counts");
  assert.equal(s.source.bounties, "fold");
  assert.equal(s.built.quests, true, "a penned mark the fold has not caught up to still stands");
  assert.equal(s.source.quests, "pen", "and the page can tell which record answered");
  assert.equal(s.built.ideas, false, "a mark in NEITHER record does not stand");
  assert.equal(s.source.ideas, null);
});

test("the Think Tank's own lane agrees with the vignette about the Think Tank", () => {
  // A SECOND LIVE DEFECT, and the reason `ideas()` takes the pen too. With the
  // vignette reading the union and this reading the fold, the quarter drew the
  // tank standing while the lane beneath it said "The Think Tank is not
  // standing yet" — one page, one building, two answers.
  const fold = { marks: [] };
  const pen = { [THINK_TANK_PLACE]: "Where ideas enter the town." };
  assert.equal(standing(fold, pen).built.ideas, true);
  assert.equal(ideas(fold, { places: pen }).placeExists, true,
    "the lane must use the same union the buildings use");
  assert.equal(ideas(fold).placeExists, false,
    "and with no pen offered it still reads the fold alone");
});

test("markBody takes the plaque and leaves the frontmatter", () => {
  const md = [
    "---", "kind: sited", "by: the-town", "at: { x: 250, y: -176 }", "---", "",
    "Where the town asks and is asked: the Quest Guild, the Think Tank.", "",
    "A second paragraph that is elaboration, not the plaque.",
  ].join("\n");
  assert.equal(markBody(md), "Where the town asks and is asked: the Quest Guild, the Think Tank.");
  assert.equal(markBody("no frontmatter at all"), "no frontmatter at all");
  assert.equal(markBody(""), null);
  assert.equal(markBody("---\nunterminated: true\n"), null, "a broken fence yields nothing, never half a file");
});

// RETIRED 2026-08-30 with the thing it protected: "the quarter's plaque is
// quoted, and absent rather than invented". It held quarterPlaque() to reading
// the world and never inventing a fallback sentence. The founder then ruled the
// vignette carries no description AT ALL — the heading and the five named
// buildings are the description — so the function lost its only caller and was
// removed, and a test for a function that does not exist is worse than none.
//
// The law it protected did not vanish, it moved up a level and got stricter:
// the vignette must render NO description, asserted on the rendered page in
// qa-shots/hub-shots.mjs where the old prose could actually come back.

test("the pen is read from the world package, not from a path typed here", () => {
  // Resolved through an EXPORTED specifier for board.mjs's own reason: the
  // package.json is not in the exports map, so resolving it throws and the
  // reader would silently see no marks at all.
  const places = loadPlaceMarks();
  assert.ok(Object.keys(places).length > 0,
    "no authored marks resolved — the pen half of the union is dead");
  // and a bad directory is fail-soft, exactly like an unreadable store
  assert.deepEqual(loadPlaceMarks({ dir: "G:/nowhere/at/all" }), {});
  assert.deepEqual(loadPlaceMarks({ dir: null }), {});
});

// ── the Think Tank's ideas ───────────────────────────────────────────────────

test("an idea is the idea class standing on the think tank, and both halves matter", () => {
  const at = (o) => ({ class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, ...o });
  assert.equal(isIdea(at({ id: "a" })), true);
  // class alone would sweep in an idea-shaped mark placed anywhere in the world
  assert.equal(isIdea({ id: "b", class: IDEA_CLASS, placementParent: "wright/the-crossing-bench" }), false);
  // place alone would sweep in whatever else stands on the think tank
  assert.equal(isIdea({ id: "c", class: "thing", placementParent: THINK_TANK_PLACE }), false);
  assert.equal(isIdea(null), false);
});

test("THE LAW: an idea's body IS the claim — a body-only mark renders, as the door writes it", () => {
  // LOGOS/classes.md § idea: "one call, no git, the body is the claim." The
  // town door's do:"post" writes exactly { class, slug, body } — no title field
  // exists in the grammar. The first idea ever published (wright/a-newcomers-
  // first-hour, 2026-08-31) was dropped on the live page as "no title" because
  // this reader invented a field the law never defined.
  const first = toIdea({
    id: "wright/a-newcomers-first-hour", class: IDEA_CLASS, by: "wright",
    body: "A guided first hour for a new resident: one page walking arrival, first letter, first mark, first idea — each step a real act at a real door.",
  });
  assert.equal(first.ok, true, first.reason);
  assert.match(first.title, /^A guided first hour/);
  assert.equal(first.by, "wright");
});

test("a malformed idea is dropped and NAMED, never rendered half-built", () => {
  const bad = toIdea({ id: "x", class: IDEA_CLASS });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /no claim/);

  const long = toIdea({ id: "y", body: "z".repeat(TITLE_MAX + 1) });
  assert.equal(long.ok, false);
  assert.match(long.reason, new RegExp(String(TITLE_MAX)));
});

test("an idea without a blueprint is a real state, not a broken row", () => {
  // "climbing the Idea Lifecycle from its FIRST BREATH" — an idea may stand in
  // the world before anyone has drawn it. A row that demanded a blueprint slug
  // would drop exactly the ideas the lane exists to catch.
  const bare = toIdea({ id: "i", title: "A ferry timetable in the window" });
  assert.equal(bare.ok, true);
  assert.equal(bare.slug, null);
  assert.equal(bare.href, null, "and it must not fabricate a link into the chest");

  const drawn = toIdea({ id: "j", title: "A second bench", blueprint: "a-second-bench.md" });
  assert.equal(drawn.href, `${BLUEPRINTS_REPO}/blob/main/BLUEPRINTS/a-second-bench.md`);
});

test("ideas() separates the four kinds of nothing", () => {
  const unread = ideas(null);
  assert.equal(unread.storeRead, false);
  assert.equal(unread.placeExists, false);

  const noPlace = ideas({ marks: [{ id: "the-town/the-town-centre" }] });
  assert.equal(noPlace.storeRead, true);
  assert.equal(noPlace.placeExists, false, "the tank is not set down, and that is its own state");

  const upAndEmpty = ideas({ marks: [{ id: THINK_TANK_PLACE }] });
  assert.equal(upAndEmpty.placeExists, true);
  assert.equal(upAndEmpty.ideas.length, 0, "up and empty is a real state of the town");

  const withRows = ideas({
    marks: [
      { id: THINK_TANK_PLACE },
      { id: "a", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, title: "Older", date: "2026-08-01" },
      { id: "b", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE, title: "Newer", date: "2026-08-20" },
      { id: "c", class: IDEA_CLASS, placementParent: THINK_TANK_PLACE },
    ],
  });
  assert.deepEqual(withRows.ideas.map((i) => i.title), ["Newer", "Older"], "newest first");
  assert.equal(withRows.malformed.length, 1, "the titleless one is dropped");
  assert.equal(withRows.malformed[0].id, "c", "and named, so the page can say how many");
});

// ── the bulletin mirrors ─────────────────────────────────────────────────────

const questMirror = [{
  slug: "quests",
  body: [
    "**11 quest completions today.** The town's daily quests, ranked.",
    "",
    "| # | resident | Reach out | Be reached | done today | all-time |",
    "|---|---|---|---|---|---|",
    "| 1 | little-bird | 5/5 ✓ | 5/5 ✓ | 2 | 35 |",
    "| 2 | wright | 0/5 | 4/5 | 0 | 15 |",
  ].join("\n"),
}];

// The registry's rows are quoted verbatim from the town's quest-registry.json.
// A first idea is the w36 release's flagship quest — a trim that quietly drops
// it from the cards should cost a named failure, not a silently shorter Guild.
test("the first-idea quest rides the cards, honest about its missing mirror column", () => {
  const cards = questCards(questStandings(questMirror));
  const firstIdea = cards.find((c) => c.title === "A first idea");
  assert.ok(firstIdea, "the registry carries the first-idea row");
  assert.equal(firstIdea.cadence, "once, and kept");
  assert.equal(firstIdea.done, null, "no mirror column yet — no count, never an invented zero");
});

test("the quest standings are read from the bulletin's own table", () => {
  const q = questStandings(questMirror);
  assert.equal(q.read, true);
  assert.equal(q.completions, 11, "the headline figure is the mirror's own, not recomputed");
  assert.equal(q.total, 2);
  assert.equal(q.rows[0].resident, "little-bird");
  assert.equal(q.rows[0].allTime, 35);
  assert.equal(q.rows[1].resident, "wright");
  // the separator row is not a resident
  assert.equal(q.rows.some((r) => /^-+$/.test(r.resident)), false);
});

test("the standings cap at the limit, so one lane cannot become the whole page", () => {
  const many = [{
    slug: "quests",
    body: ["| # | r | a | b | c | d |", "|---|---|---|---|---|---|",
      ...Array.from({ length: 40 }, (_, i) => `| ${i + 1} | r${i} | 1/5 | 1/5 | 0 | ${i} |`)].join("\n"),
  }];
  const q = questStandings(many);
  assert.equal(q.total, 40, "the total counts everybody");
  assert.equal(q.rows.length, 8, "but the page shows a head of it");
});

test("an unreadable quest mirror says so rather than showing an empty board", () => {
  // THE FAILURE THIS FORBIDS: the mirror is somebody else's markdown from
  // another pipeline. If its shape changes, "no standings" and "a town where
  // nobody quested" must not render as the same thing.
  assert.equal(questStandings([]).read, false, "a missing entry is unread, not empty");
  assert.equal(questStandings([{ slug: "quests", body: "the board is being rebuilt" }]).read, false,
    "a body with no table is unread, not a town with no questers");
  assert.equal(questStandings(null).read, false);
  assert.equal(questStandings(undefined).rows.length, 0);
});

test("the marketplace is counted by section, so the archive is not sold as live", () => {
  const md = [
    "# The marketplace",
    "## Asks — *I have X, asking N*",
    "| what | seller |", "|---|---|", "| a thing | x |", "| another | y |",
    "## Wants — *I want X, offering N*",
    "| want | by |", "|---|---|", "| a want | z |",
    "## Filled & withdrawn (the archive tail)",
    "| what | by |", "|---|---|", "| done | q |",
  ].join("\n");
  const m = marketplace([{ slug: "marketplace", body: md }]);
  assert.equal(m.read, true);
  assert.equal(m.asks, 2);
  assert.equal(m.wants, 1);
  assert.equal(m.archived, 1, "a filled row must not be counted among the open asks");
});

test("an empty marketplace with its headings intact still reads as read", () => {
  // The board exists and has nothing on it — which is a real state, and a
  // different one from a board that could not be parsed.
  const m = marketplace([{ slug: "marketplace", body: "## Asks\n\n*Nothing yet.*\n" }]);
  assert.equal(m.read, true, "headings present means the board was understood");
  assert.equal(m.asks, 0);
  assert.equal(marketplace([]).read, false, "a missing entry is a different thing");
});

// ── the pixel art ────────────────────────────────────────────────────────────

test("every sprite is a well-formed map", () => {
  // THE BUG THIS CATCHES, and it is the reason the checker exists at all: a row
  // one character short shifts every pixel after it. Nothing throws, the page
  // builds, and a building ships with a notch cut out of it. This is the only
  // thing standing between that and production other than somebody's eyes.
  assert.deepEqual(checkAllSprites(), {},
    "a sprite map has a row of the wrong length — see the report for which");
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.equal(rows.length, SPRITE_H, `${name} is not ${SPRITE_H} rows tall`);
    for (const row of rows) assert.equal(row.length, SPRITE_W, `${name} has a row that is not ${SPRITE_W} wide`);
  }
});

test("the checker can actually fail", () => {
  // A can-fail flip on the guard itself. A checker that returns [] for a map
  // that is plainly broken protects nothing, and would have been the quietest
  // possible way for all of the above to be theatre.
  assert.ok(checkSprite("bad", ["..", "...."]).length > 0, "a ragged map must be reported");
  assert.ok(checkSprite("short", ["........................"]).length > 0, "a map of one row must be reported");
});

test("a building is drawn for every lane, and each has its own palette", () => {
  for (const lane of LANES) {
    assert.ok(SPRITES[lane.key], `no sprite for the ${lane.key} lane`);
  }
  const palettes = LANES.map((l) => [...new Set(paint(l.key).map((r) => r.fill))].sort().join(","));
  assert.equal(new Set(palettes).size, LANES.length,
    "two buildings share a palette — the five must read apart in the dark");
});

test("paint refuses ink it does not know, rather than leaving a hole in a wall", () => {
  // A typo in a map is a character with no colour. Painting it as transparent
  // would put a gap in a building that looks exactly like a deliberate window.
  const rows = Array.from({ length: SPRITE_H }, () => ".".repeat(SPRITE_W));
  rows[5] = "Z".repeat(SPRITE_W);
  SPRITES.__probe = rows;
  try {
    assert.throws(() => paint("__probe"), /ink "Z"/, "unknown ink must throw and name itself");
  } finally {
    delete SPRITES.__probe;
  }
  assert.throws(() => paint("no-such-building"), /no sprite named/);
});

test("paint merges runs, and every rect it emits is inside the sprite", () => {
  const rects = paint("quests");
  assert.ok(rects.length > 0, "the quest guild painted nothing");
  // merging is what keeps five buildings from being 2880 rects of markup
  assert.ok(rects.length < SPRITE_W * SPRITE_H / 3,
    `${rects.length} rects for a ${SPRITE_W}×${SPRITE_H} map — the runs are not merging`);
  for (const r of rects) {
    assert.ok(r.x >= 0 && r.x + r.w <= SPRITE_W, `a rect runs off the sprite at x=${r.x} w=${r.w}`);
    assert.ok(r.y >= 0 && r.y < SPRITE_H, `a rect sits off the sprite at y=${r.y}`);
    assert.match(r.fill, /^#[0-9a-f]{6}$/i, `a rect carries a non-colour fill: ${r.fill}`);
  }
});

test("the art wears the town's own palette and invents no hex", () => {
  // The vignette is a warm accent on the site's weather, not a theme takeover.
  // Every shared ink is one the town already wears in src/styles/postmark.css.
  assert.equal(INK.k, "#070b15", "the night must be --pm-night");
  assert.equal(INK.G, "#f6dcae", "the hot window must be --pm-gold-bright");
  assert.equal(INK.g, "#e8c48b", "and the warm one --pm-gold");
  assert.equal(INK.p, "#f7efdc", "paper must be --pm-paper");
});
