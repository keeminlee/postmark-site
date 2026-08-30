// The civic hub's content laws, asserted against its own source.
//
// ── WHY THIS FILE MOVED (2026-08-30) ─────────────────────────────────────────
// It was `stamps-page.test.mjs` and read `town/pages/stamps/index.astro`. The
// founder ruled that The Town absorbs Stamps entirely and is restructured
// around the civic quarter, so the portal's every block MOVED to /town/ and
// /stamps/ became a forwarder. The laws did not move — they are the same
// sentences about the same prose — so this file follows the content rather
// than staying pointed at the shell it left behind.
//
// The precedent for how to do that is one section down, and it is this file's
// own: what still names real law gets re-aimed, what asserted a dead shape gets
// dropped WITH ITS REASON, so a later reader can tell "this law was retired"
// from "this law was lost".
//
// DROPPED WITH THE HUB, and the reason for each:
//   · the three panels and their tab row — the portal showed one panel at a
//     time behind a tab bar. The hub has six LANES, each a <details>, and the
//     way in is the civic quarter above them. There is no tab markup left to
//     police. The law those assertions protected — a hub is not a wall of
//     everything at once — is now the folds-shut-by-default assertion below,
//     which is strictly stronger: it covers all six lanes, not three panels.
//   · "the market opens first" — the market was the portal's first screen
//     because the founder rejected a page that opened with its constitution.
//     The hub answers that ruling with the vignette, which is the first screen
//     now, so the assertion is re-aimed onto the quarter: the civic quarter
//     must come before any lane in the source order.
//   · the router's MARKET_IDS / panel-name list — panels are gone. What
//     replaced it is the assertion that every id the old portal answered to
//     still exists on the hub, which is the thing those links actually needed.
//
// ── WHY THE FILE BEFORE IT WAS REWRITTEN (POS-39, 2026-08-23) ────────────────
// It was written for the v2 world of two pages — /stamps/ as a hub and
// /stamps/guide/ as the teaching — and v3 collapsed both into one portal. The
// file did not merely go stale: its very first statement read the deleted guide
// page, so the WHOLE FILE threw ENOENT on load and every law in it stopped
// running, including the ones that still governed. A test file that fails to
// load is worse than a missing one, because the suite reports one red line
// where a dozen guarantees quietly went dark.
//
// Everything below that still names real law was re-aimed at the portal.
// What asserted the dead two-page shape was dropped, and each drop says why,
// so a later reader can tell "this law was retired" from "this law was lost".
//
// DROPPED WITH v3, and the reason for each:
//   · the doors row (five one-line exits) — replaced by the tab row; there is
//     no doors markup left to police.
//   · "the hub carries no teaching section" — the whole point of v3 is that it
//     does carry them, in the Rules panel. The law it protected (a hub is not
//     a concatenation) now lives as the accordions-shut-by-default assertion.
//   · "neither page keeps a bare fragment pointing at the other page's
//     section" — there is no other page. Replaced by something stronger and
//     still needed: every bare fragment on the portal must name an id that
//     exists on the portal.
//   · the /stamps/guide/ forwarder — the panel router replaced it, and the
//     route it protected is now an astro redirect. Both are asserted below.
//
// TWO CONTENT LAWS ride the teaching wherever it lives, and both still bind:
//   1. It quotes, never paraphrases. The tri-law is the load-bearing sentence
//      the teaching hangs on, so it must appear in the law's own words.
//   2. It restates no dial. R10: "Owner of the number: ECONOMY-DIALS.json §
//      law_side.keeping.rho; every other surface reads it rather than
//      restating it." The portal READS dial values onto its tiles, which is
//      the permitted thing; what is forbidden is writing one down in prose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOUNDER_ACCOUNT } from "../src/lib/funding.mjs";
import { allEntries } from "../src/lib/nav.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// every .astro under town/pages — for laws about the pages tree rather than
// about one named file in it
function everyPageFile(dir = new URL("../town/pages/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...everyPageFile(full));
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

// ── TWO SURFACES, AND WHICH LAW LIVES ON WHICH ───────────────────────────────
// The founder split them on 2026-08-30 evening: the LANES are the civic
// quarter's and the TEACHING is /stamps/'s. So this file reads both, and each
// law reads the surface its content actually sits on.
//
//   HUB      the quarter, the five buildings, the five lanes, the board, the pots
//   TEACHING the one-breath head, the nine sections, the dials
//
// Getting this wrong is not hypothetical: when the teaching moved back, every
// content law in here went red at once while every sentence it asserts was
// present and correct one file over.
const HUB_PATH = "../town/pages/town/index.astro";
const TEACHING_PATH = "../town/pages/stamps/index.astro";

// Markup wraps quoted sentences across lines and threads <b> through them, so
// every assertion below reads a whitespace-flattened, tag-stripped view. A
// quotation broken by a line wrap is still the quotation.
const flat = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
// a page's prose only — the frontmatter carries provenance comments, which
// legitimately name R10 and quote its wording
const prose = (s) => s.slice(s.indexOf("---", 3) + 3);

const hubSrc = read(HUB_PATH);
const raw = prose(hubSrc);
const body = flat(raw);

const teachSrc = read(TEACHING_PATH);
const teachRaw = prose(teachSrc);
const teachBody = flat(teachRaw);

// `src` keeps its name for the many hub laws that read it; the teaching's
// equivalents read `teachSrc`.
const src = hubSrc;

// The Rules panel's nine accordions, in teaching order. The router keys on this
// same list, which is why a renamed one has to break something loudly.
const RULE_IDS = [
  "what", "earning", "staking", "seam", "minterest",
  "ownership", "faq", "glossary", "check",
];
// EVERY ID THE PORTAL ANSWERED TO, split by which surface carries it now.
// All of them kept their WORDS through both moves — that is what made the
// anchor maps identities and why nothing had to be renamed — but they no
// longer all live on one page, so a law that checks "does this id exist" has
// to know where to look.
const HUB_IDS = ["board", "pots"];              // lanes: the civic quarter
const TEACH_IDS = ["numbers"];                  // the dials: /stamps/
const MARKET_IDS = [...HUB_IDS, ...TEACH_IDS];  // the whole set, for the map

// The five lanes of the hub, as their <details> ids — one per building.
// The rules lane was the sixth for one afternoon and went back to /stamps/
// with the teaching, which is why this list is the buildings and nothing else.
const LANE_IDS = ["quests", "ideas", "bounty-board", "marketplace", "ballot-house"];

// The five lanes the world's own ontology names, in src/lib/civic.mjs.
const LANE_KEYS = ["quests", "ideas", "bounties", "listings", "votes"];

// ── the two content laws ─────────────────────────────────────────────────────

test("the tri-law appears in the law's own words", () => {
  assert.ok(
    teachBody.includes("voice returns · public-good rewards mint fresh · currency conversion burns"),
    "the tri-law must be quoted verbatim from LOGOS/the-derivation.md § 9",
  );
});

test("no dial value is written into the portal's rendered words", () => {
  // Any assignment-shaped restatement of a dial — "ρ = 0.5", "sigma is 0.5",
  // "ρ of 0.5" — is a fork of ECONOMY-DIALS.json. Reading econ.rho onto a tile
  // is the permitted thing; typing the number is not.
  const forks = [
    /[ρσ]\s*(?:=|is|of)\s*0?\.\d/i,
    /\b(?:rho|sigma)\s*(?:=|is|of)\s*0?\.\d/i,
  ];
  // NOT the markup alone. The portal keeps rendered sentences in frontmatter
  // arrays and consts, and those render — so a dial written into one would
  // have sailed past a body-only check. Frontmatter STRING LITERALS are read
  // too, and only those: the comments around them legitimately quote R10.
  const frontmatterStrings = (() => {
    const fm = teachSrc.slice(0, teachSrc.indexOf("---", 3));
    return [...fm.matchAll(/"([^"\\]*)"|`([^`\\]*)`/g)].map((m) => m[1] ?? m[2]).join("   ");
  })();
  // `body` is tag-STRIPPED, so it cannot see attribute text — and the page's
  // own <PostmarkLayout description="…"> renders into the meta description. A
  // dial typed there was invisible to the first version of this check, so the
  // untouched markup is scanned as well.
  for (const surface of [teachBody, teachRaw, frontmatterStrings]) {
    for (const re of forks) {
      const hit = surface.match(re);
      assert.equal(hit, null, `the portal restates a dial: ${hit && hit[0]}`);
    }
  }
});

test("the portal points at the dials rather than owning them", () => {
  assert.ok(teachRaw.includes('href="/numbers/"'), "the teaching must link The Town's Numbers");
  assert.ok(/readEconomy\(loadEconomy\(\)\)/.test(teachSrc),
    "and read its tile values from the emission, never from a literal");
});

test("every holo mention carries the ruling's line", () => {
  // HOLO_LINE is imported rather than typed, so the sentence cannot drift from
  // the one every other money surface carries.
  assert.ok(/import \{[^}]*HOLO_LINE[^}]*\} from "@\/lib\/funding\.mjs"/.test(teachSrc),
    "HOLO_LINE must be imported, not retyped");
  assert.ok(body.includes("{HOLO_LINE}") && teachBody.includes("{HOLO_LINE}"),
    "both the pots and the teaching must render HOLO_LINE");
  // AND NO TYPED COPY OF IT ANYWHERE. Counting occurrences was the wrong
  // instrument — with three mentions on the page, replacing one with prose
  // left the count healthy and the probe green. The law is that the sentence
  // comes from the constant so it cannot drift, so what must be forbidden is
  // the hand-typed copy, not a headcount.
  assert.equal(/a record of contribution, not a promise of profit/.test(raw + teachRaw), false,
    "the ruling's line must come from HOLO_LINE, never be typed into the markup");
  // WHAT THIS DOES NOT CATCH, said plainly: a holo mention that drops the line
  // altogether rather than retyping it. Counting mentions was tried and is the
  // wrong instrument — it goes green the moment a fourth mention is added.
  // Drift is the failure this guards; omission is left to the reader.
});

test("the nav carries one Stamps entry, flagged beta", () => {
  // RE-AIMED TWICE IN ONE DAY, 2026-08-25, and the two moves are worth keeping
  // side by side because this test survived both by asserting the LAW instead
  // of a location. (1) The trinity re-org moved the rail out of PostmarkLayout
  // into `src/lib/nav.mjs` and demoted Stamps from a top-level seat into The
  // Town's strip. (2) The founder lifted it straight back that night — "and
  // Stamps are... well, important to keeping Postmark going" — so it is a seat
  // again, with a capital S.
  //
  // What has never moved is the law: ONE door, wearing the beta chip. Both
  // moves cost a one-line red rather than a silent green, which is the whole
  // reason this reads the structure and not a regex over the layout's text.
  // (3) 2026-08-30 afternoon: The Town absorbed Stamps, so the seat's
  // DESTINATION moved to the hub's rules lane and nothing else about it did.
  // (4) 2026-08-30 evening: the founder sent the teaching back to /stamps/ and
  // resolved the tee this test carried for one afternoon — whether the rail
  // still wanted a Stamps seat at all. It does, and it points at /stamps/
  // again, because /stamps/ is a page again.
  //
  // FOUR MOVES, ONE UNCHANGED LAW: one door, wearing the beta chip. Each move
  // cost a one-line red rather than a silent green, which is the whole reason
  // this reads the structure and not a regex over the layout's text.
  const stamps = allEntries().filter((e) => e.key === "stamps");
  assert.equal(stamps.length, 1, "ONE Stamps door in the rail — a second rebuilds the split the portal removed");
  assert.equal(stamps[0].label, "Stamps");
  assert.equal(stamps[0].beta, true, "the Stamps entry must wear the beta chip");
  // its own seat: a top-level entry is its own section, so `section` is its key
  assert.equal(stamps[0].section, "stamps", "Stamps is not a top-rail seat");
  assert.equal(stamps[0].depth, 0, "Stamps is a chip of some section again");

  // AND IT OPENS THE PAGE DIRECTLY. It wore a `noActive` escape for one
  // afternoon, while its destination was a fold of somebody else's page and it
  // could therefore never light. That is gone with the reason for it: the seat
  // has its own room again and lights normally, which is what a top-rail seat
  // is supposed to do.
  assert.equal(stamps[0].href, "/stamps/", "the Stamps seat must open the teaching");
  assert.equal(stamps[0].noActive, undefined,
    "the Stamps seat has its own page again — it must be able to light up");
  // and nothing in the rail deep-links PAST the door into the teaching's
  // sections, which would be a second Stamps door wearing a fragment
  assert.deepEqual(allEntries().filter((e) => /^\/stamps\/.+/.test(e.href)), [],
    "no second Stamps door in the rail");
});

// ── the hub is one page of six lanes, entered through the quarter ────────────

test("the hub carries a lane for every building, each a fold", () => {
  for (const id of LANE_IDS) {
    assert.ok(raw.includes(`<details class="c-lane" id="${id}">`) ||
              raw.includes(`<details class="c-lane" id="${id}" open>`) ||
              raw.includes(`<details class="c-lane is-rules" id="${id}">`),
      `the ${id} lane is missing`);
  }
  assert.ok(raw.includes("<PostmarkLayout"), "and it is wrapped in the layout");
});

test("the civic quarter is the first screen, before any lane", () => {
  // THE FOUNDER'S RULING THIS ASSERTS, carried forward from 2026-08-23 — the
  // hub "still very much reads like a giant contract lol instead of a proper
  // hub" — and answered on 2026-08-30 by the quarter itself: a reader arrives
  // at a picture of the town and clicks a building, not at a wall of law. So
  // the vignette must come BEFORE the first lane in the document, which is the
  // only part of "it opens as a hub" a test can actually hold.
  const quarter = raw.indexOf('<section class="cq"');
  const firstLane = raw.indexOf('<details class="c-lane"');
  assert.ok(quarter > 0, "the civic quarter is gone");
  assert.ok(firstLane > 0, "the lanes are gone");
  assert.ok(quarter < firstLane, "a lane opens above the civic quarter");
});

test("every lane ships shut but the board, and the quarter is how you open one", () => {
  // A hub is not a concatenation. Six lanes expanded on arrival IS the manual
  // the founder rejected, whatever the chrome around it looks like — and this
  // page carries the whole stamps teaching, so an all-open default would be a
  // genuine scroll of doom rather than a theoretical one.
  //
  // THE ONE EXCEPTION IS NAMED, not tolerated: the Bounty Board opens, because
  // it is the liveliest lane and the home page's own milestone link points at
  // it. If a second lane ever ships open, that is a decision someone should
  // have to make on purpose.
  const opened = [...raw.matchAll(/<details class="c-lane(?: is-rules)?" id="([\w-]+)"([^>]*)>/g)]
    .filter((m) => /\bopen\b/.test(m[2])).map((m) => m[1]);
  assert.deepEqual(opened, ["bounty-board"],
    `these lanes ship expanded: ${opened.join(", ") || "(none — the board must be open)"}`);
});

test("the quarter draws a building for every lane the world names", () => {
  // The ontology is civic.mjs's (and the world's before that); this asserts the
  // PAGE renders all of it. A lane quietly dropped from the vignette would
  // still have its fold below and would simply never be found.
  for (const key of LANE_KEYS) {
    assert.ok(raw.includes("data-lane={lane.key}") || raw.includes(`data-lane="${key}"`),
      `the quarter does not render lane ${key}`);
  }
  assert.ok(/LANES\.map\(/.test(raw), "the buildings must be rendered FROM the lane list, not hand-placed");
  assert.ok(raw.includes("paint(lane.key)"), "and each building's art comes from the sprite map");
});

test("a building that does not stand in the world says so, and says it from the world", () => {
  // THE LAW: this page never invents a town. Two of the five buildings have no
  // mark in the pinned world, and the plaque says "not standing yet" rather
  // than drawing a door onto nothing.
  //
  // AND IT IS READ, NOT TYPED — which is the half worth protecting. A hardcoded
  // list of which buildings exist would be correct today and a lie the moment
  // the world builds one, with nothing to catch it.
  assert.ok(/quarter\.built\[lane\.key\]/.test(raw),
    "whether a building stands must be read from the world store per lane");
  assert.ok(raw.includes("not standing yet"), "and an unbuilt lane must say so on the building");
  assert.equal(/const\s+BUILT\s*=\s*\[/.test(src), false,
    "a written-down list of standing buildings is a lie with a date on it");
});

test("the head answers WHAT IS THIS unfolded, with the five things behind one click", () => {
  // TWO rulings hold here at once, and the second amends the first.
  //   2026-08-26, off a real reader who read the page three times and could not
  //   say what a stamp was (discussion #2036): "a reader needs to understand
  //   WHAT THIS IS before they can digest any information about WHAT IT DOES...
  //   WHAT IS THIS is the utmost priority." That is the unfolded one-breath
  //   definition, and the giver's door beside it.
  //   2026-08-26, later, on the three sentences that replaced the primer: "I
  //   prefer the old 'The Five Things To Know' to the three (and I like how
  //   it's hidden and expandable)." That is the fold, back, with five in it.
  // So: nothing folded stands between a first-timer and the ground, AND the
  // teaching is five things under one click rather than three in the open.
  // THE CLOSER MUST BE FOUND AFTER THE OPENER, and on the hub that is not a
  // pedantry: The Town's own <header class="t-head"> closes ABOVE this one, so
  // a bare indexOf("</header>") returns a position before p-head even starts
  // and slices an empty string — every assertion below then fails on a head
  // that is entirely present and correct.
  const headAt = teachRaw.indexOf('<header class="p-head">');
  assert.ok(headAt > 0, "the stamps head did not survive the move");
  const head = teachRaw.slice(headAt, teachRaw.indexOf("</header>", headAt));
  const primer = head.indexOf('<details class="p-primer">');
  assert.ok(head.includes('class="p-folk"'), "the head lost its plain one-breath definition");
  assert.ok(primer > 0, "the five things must be in the head, folded");
  assert.ok(head.indexOf('class="p-folk"') < primer,
    "the plain definition comes BEFORE the fold — the ground first, always");
  assert.equal(/<details class="p-primer"[^>]*\bopen\b/.test(head), false,
    "the primer must start shut — an expanded fold is the wall coming back");
  assert.equal((head.match(/<li>/g) || []).length, 5,
    "the five things to know are five");
  // and the giver's door: a reader who only wants to help pay the bills is
  // pointed at the pots without having to learn the economy first.
  // THE GIVER'S DOOR NOW CROSSES A PAGE. The pots are the Quest Guild's, so
  // the head points at /town/#pots rather than at a fragment of its own page —
  // the law is that a reader who only wants to help pay the bills is pointed
  // straight at the need, not that the need is on this page.
  assert.ok(head.includes('href="/town/#pots"'), "the head must point a giver at the pots");
});

// ── the teaching, re-homed as accordions ─────────────────────────────────────

test("the teaching carries all nine sections, ids intact", () => {
  // RE-AIMED 2026-08-30 evening: these were a lane of the hub for one
  // afternoon; the founder sent them back to /stamps/ and they are the page's
  // body again. The law never changed — nine sections, ids intact — so it
  // follows the prose rather than staying pointed at the lane it left.
  for (const id of RULE_IDS) {
    assert.ok(teachRaw.includes(`<details class="r-fold" id="${id}">`),
      `the teaching is missing #${id} — the move dropped a section`);
  }
});

test("the teaching LEADS with the questions, and the dials sit under them", () => {
  //   "lead with the questions now that the quest guild absorbed the town's
  //    asks"                                    — the founder, 2026-08-30
  //
  // The portal opened with the MARKET, because a market square does not open
  // with its constitution nailed to the gate. The market is not on this page
  // any more — the board and the pots are lanes of the civic quarter — so what
  // is left is a teaching, and the order the founder ruled is questions first.
  const firstFold = teachRaw.indexOf('<details class="r-fold"');
  const dials = teachRaw.indexOf('id="numbers"');
  assert.ok(firstFold > 0, "the teaching lost its sections");
  assert.ok(dials > 0, "the teaching lost the dials");
  assert.ok(firstFold < dials, "the dials open the page — the questions must come first");
});

test("the lanes did NOT come with the teaching", () => {
  // The absorption's whole point. A copy of the board or the pots here would be
  // the split the quarter closed, and it would be a second surface that looks
  // like the board.
  assert.equal(/<div id="board"/.test(teachRaw), false, "the board is a lane, not a teaching block");
  assert.equal(/<div id="pots"/.test(teachRaw), false, "the pots are the Guild's now");
  assert.equal(/loadPots|livePots|notices\(/.test(teachSrc), false,
    "the teaching still reads a lane's derivation");
});

test("every accordion starts shut", () => {
  // A hub is not a concatenation: nine sections expanded on load IS the manual
  // the founder rejected, whatever the chrome around it looks like.
  const opened = [...raw.matchAll(/<details class="r-fold" id="([\w-]+)"([^>]*)>/g)]
    .filter((m) => /\bopen\b/.test(m[2])).map((m) => m[1]);
  assert.deepEqual(opened, [], `these accordions ship expanded: ${opened.join(", ")}`);
});

test("every id the portal answered to still exists on the hub", () => {
  // THE MECHANICAL LAW THIS ASSERTS, from astro.config.town.mjs's own redirects
  // map: it matches PATHS. A fragment never reaches the server, so /stamps/
  // #earning — the shape of every deep link ever written into the teaching —
  // cannot be routed by configuration. The ids being HERE is what lands them;
  // the router below only opens the fold once they have.
  //
  // This is the assertion that made the move safe: the blocks kept their ids,
  // so the anchor map is an identity and there was nothing to get wrong.
  for (const id of HUB_IDS) {
    assert.ok(new RegExp(`id="${id}"`).test(raw),
      `the hub has no #${id} — every /stamps/#${id} ever written now lands nowhere`);
  }
  for (const id of [...RULE_IDS, ...TEACH_IDS]) {
    assert.ok(new RegExp(`id="${id}"`).test(teachRaw),
      `the teaching has no #${id} — every /stamps/#${id} ever written now lands nowhere`);
  }
});

test("the router opens a fold inside a fold, and yields to the page", () => {
  // THE BUG THIS EXISTS TO PREVENT. A teaching accordion is a <details> nested
  // inside the Rules lane's own <details>. A router that opened only the
  // innermost would scroll the reader to something still hidden — the link
  // would look broken while every id it named was present and correct. So the
  // reveal walks UP from the target, opening every fold on the way.
  assert.ok(/while \(node && node !== main\)/.test(src),
    "the router must walk ancestors, not just open the target");
  assert.ok(/node\.tagName === "DETAILS"/.test(src) && /node\.open = true/.test(src),
    "and open each fold it passes");
  assert.ok(src.includes('addEventListener("hashchange"'),
    "a hash changed after load is the same deep link and gets the same treatment");
  assert.ok(/history\.pushState/.test(src),
    "an in-page jump writes history rather than reloading — Back walks the lanes");
  // scrolling BEFORE the folds open measures the old layout and lands somewhere
  // else entirely, which on a page made of folds is most of the page away
  assert.ok(/requestAnimationFrame/.test(src),
    "the scroll must be measured after the folds have opened");
});

test("the hub works with the script switched off", () => {
  // THE BRIEF'S HARD REQUIREMENT, and the reason the router is written as an
  // enhancement rather than as the page's legs: the buildings degrade to plain
  // anchor links. Three things carry that, and each is asserted because each
  // could be quietly lost in a refactor toward "cleaner" JS-driven markup.
  //
  //   the buildings are real <a href="#…">     — not buttons, not onclick spans
  //   the lanes are native <details>/<summary> — a reader can open one by hand
  //   the art is markup                        — painted at BUILD time, so a
  //                                              scriptless browser still sees
  //                                              the town
  assert.ok(/<a class="cq-b" href={`#\$\{LANE_ANCHORS\[lane\.key\]\}`}/.test(raw),
    "a building must be an anchor with a real fragment href");
  assert.equal(/<button[^>]*class="cq-b"/.test(raw), false,
    "a building must not be a button — a button does nothing without script");
  assert.ok((raw.match(/<summary class="c-sum">/g) || []).length === LANE_IDS.length,
    `every lane needs its own native summary (expected ${LANE_IDS.length})`);
  assert.ok(raw.includes("<svg class=\"cq-art\""),
    "the art must be inline markup, not drawn by a client script");
});

// ── the market ───────────────────────────────────────────────────────────────

test("the four kinds of nothing survived into the cards", () => {
  // THE LAW THIS ASSERTS — the Bounty Board's own header, carried forward:
  // "A board that invented a notice to look alive would be lying about what the
  // town wants." Distinguishing the kinds of nothing is how the page keeps that
  // promise, and a redesign that flattened them into one "nothing here" would
  // have quietly dropped it.
  for (const [what, needle] of [
    ["the store could not be read", "The world store could not be read"],
    ["the board place is not set down", "The board is not up yet"],
    ["the board is up and empty", "The board is up, and empty"],
    ["notices that could not be read", "could not be read."],
  ]) {
    assert.ok(body.includes(needle), `the portal lost the branch for ${what}`);
  }
  assert.ok(body.includes("No pot is open"), "and a town asking for no money says so");
});

test("the card says WHAT the pot is; the close mechanics live on its fund page", () => {
  // THE CARD LAW — the founder, 2026-08-26: "THE MAIN PAGE CARDS EXPLAIN WHAT
  // THE THING IS, THE FUND PAGE DIRECTS TO WHERE YOU CAN PAY, AND OFFERS MORE
  // DETAILS ABOUT WHAT IT IS. ... Before you expose something on The Market,
  // ask yourself: 'is this the reason somebody would be on this page?'"
  // So the card's teaching is ONE sentence — the pot file's own first sentence,
  // via potGist, never invented copy — and the character line + estimate moved
  // to the pot's own fund page. The close-word discipline (the Hal finding,
  // 2026-08-25: every promise keys on the WORD the town said, never the
  // boolean) survives the move — asserted below against the fund page, where
  // the sentences now live.
  const pots = raw.slice(raw.indexOf('<div id="pots"'));
  const section = pots.slice(0, pots.indexOf("\n    </section>"));
  const sBody = flat(section);

  // the card answers WHAT IS THIS, from the record
  assert.ok(section.includes("potGist(p.source)"), "the card's what-line is the pot file's own sentence");
  assert.ok(section.includes('class="m-what"'), "and it renders");

  // the mechanics are OFF the market: no close promises, no estimate
  assert.equal(sBody.includes("Closes at the epoch"), false, "the epoch promise left the card");
  assert.equal(sBody.includes("Never closes"), false, "the never-closes promise left the card");
  assert.equal(section.includes("estimate("), false, "the estimate left the card");

  // the money line still branches on the WORD for its two shapes
  assert.equal(section.split('p.close === "elastic"').length - 1, 2,
    "the bar and the figure line each branch on the word");
  assert.ok(sBody.includes("given so far this roll"),
    "an elastic pot's figure is a running roll, not one epoch's takings");

  // and the fund page carries every sentence the card gave up, still keyed on
  // the word, arm by arm — elastic, epoch, never, unsaid.
  const fund = flat(read("../town/pages/fund/[pot].astro"));
  for (const [what, needle] of [
    ["the elastic pot's carry-forward", "This pot carries forward"],
    ["the whole-roll split", "whole accumulated roll"],
    ["intake refuses nothing", "nothing is refused at intake"],
    ["the epoch close", "This pot closes at the epoch"],
    ["the standing box", "This one never closes"],
    ["the no-mint words that leave no room", "nothing mints back"],
    ["the humble unsaid case", "not in the town's record yet"],
  ]) {
    assert.ok(fund.includes(needle), `the fund page lost ${what}`);
  }
});

test("the floor is read from the pot file, never written into the page", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _min_close, quoted:
  //   "the ceremony's floor, never the door's: intake refuses nothing — the
  //    floor gates only whether a month's close RUNS. Owner of the number: this
  //    file; every surface reads it."
  assert.ok(src.includes("p.minCloseUsd"), "the portal reads the emitted floor");
  assert.equal(/\$5\b/.test(body), false, "and never writes the number down");
  assert.ok(body.includes("rolls on until it is worth closing"),
    "an emission with no floor says the shape and declines to name a number it was not given");
});

test("a pot card shows the town's name, not the founder's handle", () => {
  // THE RULING THIS ASSERTS — the founder, 2026-08-23: pot surfaces must not
  // carry his GitHub handle; he IS the town's infrastructure, so the town's
  // name stands on the card. funding.mjs owns the mapping; this pins that the
  // RENDER uses it, which nothing else could catch — beneficiaryLabel could be
  // perfect and the card could still print the raw handle.
  // THE RENDER EXPRESSION, not a substring. The first version of this checked
  // raw.includes("p.beneficiaryLabel") — which the explanatory COMMENT above
  // the markup satisfied all by itself, so the card could have printed the raw
  // handle with the probe still green. Caught by its own can-fail flip.
  assert.ok(/\{p\.beneficiaryLabel \? <>for \{p\.beneficiaryLabel\}<\/>/.test(raw),
    "the card must render the LABEL on both sides of the branch");
  assert.equal(/\{p\.beneficiary[^L]/.test(raw), false,
    "and never the routing handle");
  assert.equal(new RegExp(`for ${FOUNDER_ACCOUNT}\\b`).test(body), false,
    "the founder's handle must not be typed into the markup either");
});

test("the portal links each open pot's money moment and carries none of it", () => {
  // THE LAW THIS ASSERTS — the USDC runbook R9, quoted in
  // town/pages/fund/[pot].astro's header: "The address publishes ONLY beside a
  // pot (the money moment carries the disclosure, per §10's second consent
  // gate) — never bare on a page."
  assert.ok(src.includes('href={`/fund/${p.pot}/`}'), "each pot links its own money moment");
  assert.ok(src.includes('p.status === "open" &&'),
    "and only an open pot — a draft or closed pot has no page that can take a dollar");
  assert.equal(/0x[0-9a-fA-F]{40}/.test(src), false, "no intake address on the portal");
  assert.equal(/qrSvg|<form/.test(src), false, "and no QR and no witness form");
  assert.equal(/buy\.stripe\.com/.test(src), false, "and no card button — an ask needs its need beside it");
});

// ── the money moment itself (the fund page, unchanged by the portal) ─────────

test("the card rail rides the same gate and the same disclosures as the address", () => {
  const fund = read("../town/pages/fund/[pot].astro");
  assert.ok(fund.includes("https://buy.stripe.com/"), "the fund page carries the card rail");
  const gate = fund.indexOf("{open && (<>");
  const law = fund.indexOf('<section class="f-law"');
  assert.ok(law > 0 && gate > law,
    "the disclosures sit ABOVE both rails — §10's second consent gate");
  // The href grew a query since 2026-08-25: `${STRIPE}?client_reference_id=
  // ${pot.pot}` — the card payment names its pot on the checkout session (the
  // first real $10 arrived pot-ambiguous). The anchor is the template opening,
  // which any form of the parameterized link must carry.
  assert.ok(fund.indexOf("href={`${STRIPE}?client_reference_id=", gate) > gate,
    "the card button is inside the open-pot gate");
  assert.equal(fund.slice(0, gate).includes("${STRIPE}"), false,
    "and nowhere above it — a draft pot must have no way to pay");
  const fbody = flat(fund.slice(fund.indexOf("---", 3) + 3));
  assert.ok(fbody.includes("witnessed by the office's own hand"),
    "a card payment is witnessed by a person, and the page says so");
  assert.ok(fbody.includes("cannot see a card payment"),
    "the chain form cannot verify a card payment, and the page says that too");
});

test("no pot page promises a close it does not run", () => {
  const fund = read("../town/pages/fund/[pot].astro");
  assert.ok(fund.includes('pot.close === "elastic" ? (') && fund.includes("pot.closes ? ("),
    "the disclosure branches on the pot's own word");
  assert.ok(flat(fund.slice(fund.indexOf("---", 3) + 3)).includes("nothing mints back"),
    "and a pot that mints nothing says so beside its own intake address");
});

// ── the routes ───────────────────────────────────────────────────────────────

test("both retired routes redirect somewhere that exists", () => {
  const config = read("../astro.config.town.mjs");
  assert.match(config, /'\/board\/':\s*'\/town\/#board'/,
    "the board's old path must land on the block that absorbed it");
  // RE-AIMED TWICE IN ONE DAY: the guide pointed at /town/#rules while The
  // Town held the teaching, and comes back to /stamps/ now that the teaching
  // does. The guide's content and this route's target have been the same thing
  // throughout; only the address of that thing moved, and back.
  assert.match(config, /'\/stamps\/guide\/':\s*'\/stamps\/'/,
    "and the guide's, on the page that carries the teaching");
  // a redirect at a fragment the target does not carry lands nowhere at all
  assert.ok(raw.includes('<div id="board"'), "#board must still be on the hub");
  assert.ok(teachRaw.includes('<details class="r-fold"'), "and the teaching must still be there");
  assert.equal(existsSync(new URL("../town/pages/stamps/guide/index.astro", import.meta.url)), false,
    "the guide page is gone — a second page beside the hub would be the split this closed");
  // /board/ is also a public asset prefix, and a page paints with one of them.
  // RE-AIMED 2026-08-25 (the chip wave): this named daily.astro, which is where
  // the notice board hung while it was folded in. The board went back to
  // /bulletin/ and took its plank painting with it, so a probe keyed on WHICH
  // page paints went red on a move that changed nothing about the law. The law
  // is that the asset prefix is live, so it asks the pages tree, not one file.
  assert.ok(existsSync(new URL("../public/atelier/postmark/board/quest-board-wood.jpg", import.meta.url)),
    "the redirect must be exact-path: the board's images still live under /board/");
  const painters = everyPageFile()
    .filter((f) => readFileSync(f, "utf8").includes("/board/quest-board-wood.jpg"));
  assert.ok(painters.length, "no page paints with /board/ any more — the exact-path reason is gone, and so is this test's premise");
});

test("nothing in the repo still points at a retired route", () => {
  for (const page of ["index.astro", "numbers/index.astro", "fund/[pot].astro", "town/index.astro"]) {
    const s = read(`../town/pages/${page}`);
    assert.equal(/href="\/board\/"/.test(s), false,
      `${page} still links /board/ — the redirect is for links the repo cannot reach`);
    assert.equal(/href="\/stamps\/guide\/"/.test(s), false,
      `${page} still links /stamps/guide/`);
  }
  // AND THE HUB LINKS /stamps/ ON PURPOSE NOW. For one afternoon that was
  // forbidden, because /stamps/ was a stub that bounced back here; the founder
  // made it the teaching page the same evening, so the hub's lanes point at it
  // the way any page points at another. What must NOT come back is a link at a
  // fragment this page no longer carries.
  assert.equal(/href="\/town\/#rules"/.test(raw), false,
    "the hub links /town/#rules — the lane that went back to /stamps/");
  assert.ok(raw.includes('href="/stamps/#staking"') || raw.includes('href="/stamps/#earning"'),
    "the lanes must point at the teaching where it actually lives");
});

test("every bare fragment on the hub names something the hub has", () => {
  // THE BUG THIS CATCHES, three times over now. v2's split silenced links whose
  // target moved to the other page; v3's collapse could silence links whose
  // target moved into a panel; today's move could silence links whose target
  // moved into a lane. None of them breaks loudly — the browser just scrolls
  // nowhere and the reader assumes they misread the link.
  const KNOWN = new Set([...RULE_IDS, ...MARKET_IDS, ...LANE_IDS]);
  const literal = [...raw.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
  const jumps = [...raw.matchAll(/data-jump="([\w-]+)"/g)].map((m) => m[1]);
  for (const id of [...literal, ...jumps]) {
    assert.ok(KNOWN.has(id),
      `the hub points at #${id}, which is not a lane, a market block or an accordion`);
  }
});

// ── /stamps/, which is a teaching page again ────────────────────────────────
//
// It was a pure forwarder for one afternoon. The founder sent the teaching back
// to it the same evening, so the laws here changed shape with the route: what
// was "does it forward everything" is now "does it forward the RIGHT things and
// keep the rest". The three assertions the forwarder carried are retired, each
// with its reason, on this file's own precedent:
//
//   · noindex + canonical — a forwarder should not be a search result; a
//     teaching page should, and now is. Asserting noindex would forbid the
//     page from being findable, which is the opposite of what it is for.
//   · "no page in the repo may link /stamps/" — that was true while the route
//     was a stub whose only job was to bounce. It is a real page with real
//     content now, and the nav seat, the hub's lanes and the fund page all
//     link it ON PURPOSE. The law it protected (do not route readers through a
//     redirect to reach content) survives below as the no-round-trip check.
//   · "the forwarder carries the fragment" — half of it survives verbatim as
//     the lane half of the partition; the other half is now the opposite claim.

test("/stamps/ still answers, and partitions the fragments it was asked for", () => {
  // THE LAW: a path is an API for consumers the repo cannot reach. Letters in
  // the town's own record link /stamps/#board AND /stamps/#earning, and those
  // two now live on different pages. Both must land.
  const teach = read(TEACHING_PATH);
  assert.ok(existsSync(new URL(TEACHING_PATH, import.meta.url)), "/stamps/ must not 404");

  // TEACHING ids are native — they open their section here
  assert.ok(/const RULE_IDS = \[/.test(teach), "the teaching must know its own section ids");
  assert.ok(/RULE_IDS\.indexOf\(which\) === -1/.test(teach),
    "the router must tell a teaching id from a foreign one");

  // LANE ids forward, carrying the fragment, by the mechanics the forwarder
  // used — because a redirects map matches PATHS and never sees a fragment.
  assert.match(teach, /const LANE_FRAGMENTS = \{ board: "board", pots: "pots", market: "board" \}/,
    "the lane partition must name its three fragments in one place");
  assert.ok(/location\.replace\(HUB \+ "#"/.test(teach), "a lane id must forward WITH its fragment");
  assert.ok(/location\.replace/.test(teach) && !/location\.assign/.test(teach),
    "replace, not assign — Back must not bounce the reader through the hop again");
  assert.ok(/if \(forwardIfLane\(\)\) return;/.test(teach),
    "the forward must run BEFORE anything renders a teaching section for a lane id");

  // AND A BARE /stamps/ STAYS PUT. This is the whole difference from the
  // afternoon's forwarder, and the one thing that could regress silently: a
  // page that forwards its own bare path is a doorway, not a page.
  assert.equal(/http-equiv="refresh"/.test(teach), false,
    "a meta refresh would forward every reader off the teaching page");
  assert.equal(/name="robots" content="noindex/.test(teach), false,
    "the teaching is a real page and must be findable");
});

test("the teaching does not route its own readers through a redirect", () => {
  // The law the retired "nobody links the forwarder" test protected, kept:
  // a page must link content DIRECTLY rather than at a fragment that will
  // bounce. The teaching's own prose points at the board and the pots several
  // times, and each of those must name the quarter rather than a fragment of
  // this page that the router would then forward.
  const laneFragments = [...teachRaw.matchAll(/href="#(board|pots|market)"/g)].map((m) => m[1]);
  assert.deepEqual(laneFragments, [],
    `the teaching points at #${laneFragments[0]} — a fragment its own router forwards, so the reader pays a redirect to reach a page we could have named`);
  assert.ok(teachRaw.includes('href="/town/#pots"'), "the giver's door must name the pots directly");
});

test("an elastic pot gets a bar against its floor, and the bar says the roll keeps growing", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _min_close, quoted:
  //   "the ceremony's floor, never the door's: intake refuses nothing — the
  //    floor gates only whether a month's close RUNS."
  // A bar that filled and stopped would say the opposite: that the pot is done
  // taking. So past the floor it reads full AND the total keeps climbing.
  const pots = raw.slice(raw.indexOf('<div id="pots"'));
  const section = pots.slice(0, pots.indexOf("\n    </section>"));

  assert.ok(section.includes('p.close === "elastic" && p.minCloseUsd != null'),
    "the elastic bar branch must require a floor to measure against");
  assert.ok(/Math\.min\(1, p\.received \/ p\.minCloseUsd\)/.test(section),
    "the fill is progress toward the floor, clamped — never past 100%");
  const sBody = flat(section);
  assert.ok(sBody.includes("no cap"), "past the floor the card must say the pot still takes");
  assert.ok(sBody.includes("closes at month's end"), "and when the close comes");
  assert.ok(sBody.includes("it keeps taking past that"),
    "and under the floor it must still say the pot is not capped by it");
  assert.equal(/\$5\b/.test(sBody), false, "the floor is read, never typed");
});

test("the estimate renders only where a close could run, and never as a promise", () => {
  // THE RULING THIS ASSERTS — the founder, 2026-08-23: an estimated return may
  // show "as of this moment", honestly: at today's roll and stakes, moving as
  // both move, {HOLO_LINE} — never a promise. RE-HOMED 2026-08-26 by the card
  // law: what a dollar mints is the FUND PAGE's detail, not the market's, so
  // the assertions moved with the sentence.
  const fund = read("../town/pages/fund/[pot].astro");
  const fbody = flat(fund.slice(fund.indexOf("---", 3) + 3));

  assert.ok(fund.includes("{estimate != null && ("),
    "the estimate is gated on the helper, which returns null where no close can run");
  assert.ok(fbody.includes("if the close ran this moment"), "it says when it would apply");
  assert.ok(fbody.includes("it moves as both move"), "and that it is not fixed");
  assert.ok(fund.includes("{HOLO_LINE}"), "and the page carries the ruling's line");
  // the number comes from the reader, not from the page
  assert.ok(/const estimate = holoPerDollar\(pot, econ\)/.test(fund),
    "the math lives in funding.mjs and the page only calls it");
  assert.equal(/per \$1[^<]*0\.\d/.test(fbody), false, "no estimate is typed into the markup");
});

test("the pots block says when its data was made", () => {
  // A quiet market and a stale page look identical on a money surface. The
  // stamp comes from the emission's own field, so it cannot drift from the
  // data it describes — a build-time clock would tick even when nothing synced.
  assert.ok(/const potsAsOf = potBoard\.pots\.map\(\(p\) => p\.generatedAt\)/.test(src),
    "the tick is read from the emission, not from the build clock");
  assert.ok(raw.includes("as of {asOfText}"), "and rendered on the pots block");
  assert.equal(/new Date\(\)\.toISOString/.test(src), false,
    "the page must not stamp itself — that would look fresh on stale data");
});
