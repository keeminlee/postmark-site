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

const PORTAL_PATH = "../town/pages/town/index.astro";
const src = read(PORTAL_PATH);
// the forwarder that /stamps/ became — asserted in its own section at the foot
const FORWARDER_PATH = "../town/pages/stamps/index.astro";

// Markup wraps quoted sentences across lines and threads <b> through them, so
// every assertion below reads a whitespace-flattened, tag-stripped view. A
// quotation broken by a line wrap is still the quotation.
const flat = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

// The page's prose only — the frontmatter carries provenance comments, which
// legitimately name R10 and quote its wording.
const raw = src.slice(src.indexOf("---", 3) + 3);
const body = flat(raw);

// The Rules panel's nine accordions, in teaching order. The router keys on this
// same list, which is why a renamed one has to break something loudly.
const RULE_IDS = [
  "what", "earning", "staking", "seam", "minterest",
  "ownership", "faq", "glossary", "check",
];
// The market's two blocks and the dials, which KEPT THEIR IDS through the move
// for the reason the forwarder's header gives: every deep link ever written
// points at these words.
const MARKET_IDS = ["board", "pots", "numbers"];

// The six lanes of the hub, as their <details> ids. The five buildings of the
// civic quarter plus the rules that run under all of them.
const LANE_IDS = ["quests", "ideas", "bounty-board", "marketplace", "ballot-house", "rules"];

// The five lanes the world's own ontology names, in src/lib/civic.mjs.
const LANE_KEYS = ["quests", "ideas", "bounties", "listings", "votes"];

// ── the two content laws ─────────────────────────────────────────────────────

test("the tri-law appears in the law's own words", () => {
  assert.ok(
    body.includes("voice returns · public-good rewards mint fresh · currency conversion burns"),
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
    const fm = src.slice(0, src.indexOf("---", 3));
    return [...fm.matchAll(/"([^"\\]*)"|`([^`\\]*)`/g)].map((m) => m[1] ?? m[2]).join("   ");
  })();
  // `body` is tag-STRIPPED, so it cannot see attribute text — and the page's
  // own <PostmarkLayout description="…"> renders into the meta description. A
  // dial typed there was invisible to the first version of this check, so the
  // untouched markup is scanned as well.
  for (const surface of [body, raw, frontmatterStrings]) {
    for (const re of forks) {
      const hit = surface.match(re);
      assert.equal(hit, null, `the portal restates a dial: ${hit && hit[0]}`);
    }
  }
});

test("the portal points at the dials rather than owning them", () => {
  assert.ok(raw.includes('href="/numbers/"'), "the portal must link The Town's Numbers");
  assert.ok(/readEconomy\(loadEconomy\(\)\)/.test(src),
    "and read its tile values from the emission, never from a literal");
});

test("every holo mention carries the ruling's line", () => {
  // HOLO_LINE is imported rather than typed, so the sentence cannot drift from
  // the one every other money surface carries.
  assert.ok(/import \{[^}]*HOLO_LINE[^}]*\} from "@\/lib\/funding\.mjs"/.test(src),
    "HOLO_LINE must be imported, not retyped");
  assert.ok(body.includes("{HOLO_LINE}"), "the portal must render HOLO_LINE");
  // AND NO TYPED COPY OF IT ANYWHERE. Counting occurrences was the wrong
  // instrument — with three mentions on the page, replacing one with prose
  // left the count healthy and the probe green. The law is that the sentence
  // comes from the constant so it cannot drift, so what must be forbidden is
  // the hand-typed copy, not a headcount.
  assert.equal(/a record of contribution, not a promise of profit/.test(raw), false,
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
  // (3) 2026-08-30: The Town absorbed Stamps, so the seat's DESTINATION moved
  // to the hub's rules lane and nothing else about it did. The law this test
  // has always asserted is unchanged — ONE door, wearing the beta chip — which
  // is exactly why the move cost one line here instead of a rewrite.
  //
  // WHAT THIS DELIBERATELY DOES NOT DECIDE: whether the top rail still wants a
  // Stamps seat now that Stamps is a section of The Town. That is a shape call
  // and it is the founder's; the seat he lifted back by name is still a seat.
  const stamps = allEntries().filter((e) => e.key === "stamps");
  assert.equal(stamps.length, 1, "ONE Stamps door in the rail — a second rebuilds the split the portal removed");
  assert.equal(stamps[0].label, "Stamps");
  assert.equal(stamps[0].beta, true, "the Stamps entry must wear the beta chip");
  // its own seat: a top-level entry is its own section, so `section` is its key
  assert.equal(stamps[0].section, "stamps", "Stamps is not a top-rail seat");
  assert.equal(stamps[0].depth, 0, "Stamps is a chip of some section again");

  // AND IT MUST NOT POINT AT THE FORWARDER. The redirect exists for links the
  // repo cannot reach; this one it can, and sending every reader who clicks the
  // top rail through a redirect flash to arrive somewhere the rail could have
  // named directly is a cost paid for nothing.
  assert.equal(stamps[0].href, "/town/#rules",
    "the Stamps seat must open the lane, not the stub that forwards to it");
  assert.deepEqual(allEntries().filter((e) => /^\/stamps\//.test(e.href)), [],
    "nothing in the rail may point at /stamps/ — it is a forwarder now");
});

// ── the hub is one page of six lanes, entered through the quarter ────────────

test("the hub carries all six lanes, each a fold", () => {
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
  const headAt = raw.indexOf('<header class="p-head">');
  assert.ok(headAt > 0, "the stamps head did not survive the move");
  const head = raw.slice(headAt, raw.indexOf("</header>", headAt));
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
  assert.ok(head.includes('href="#pots"'), "the head must point a giver at the pots");
});

// ── the teaching, re-homed as accordions ─────────────────────────────────────

test("the Rules lane carries all nine teaching sections, ids intact", () => {
  const rulesAt = raw.indexOf('id="rules"');
  assert.ok(rulesAt > 0, "the rules lane is gone");
  const rules = raw.slice(rulesAt);
  for (const id of RULE_IDS) {
    assert.ok(rules.includes(`<details class="r-fold" id="${id}">`),
      `the Rules lane is missing #${id} — the move dropped a section`);
  }
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
  for (const id of [...RULE_IDS, ...MARKET_IDS]) {
    assert.ok(new RegExp(`id="${id}"`).test(raw),
      `the hub has no #${id} — every /stamps/#${id} ever written now lands nowhere`);
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
    "every lane needs its own native summary");
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
  assert.match(config, /'\/stamps\/guide\/':\s*'\/town\/#rules'/,
    "and the guide's, on the lane that absorbed it");
  // a redirect at a fragment the hub does not carry lands nowhere at all
  assert.ok(raw.includes('<div id="board"'), "#board must still be on the hub");
  assert.ok(raw.includes('id="rules"'), "and the rules lane must still be there");
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
  // AND THE HUB MUST NOT LINK ITS OWN FORWARDER. Four of the moved sentences
  // carried an absolute /stamps/#board at them; on the hub that is a link from
  // the page to a stub that bounces straight back to the page, which is a
  // visible flash and a wasted navigation to reach a block already on screen.
  assert.equal(/href="\/stamps\//.test(raw), false,
    "the hub links /stamps/ — a moved self-link that now round-trips the forwarder");
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

// ── the forwarder that /stamps/ became ──────────────────────────────────────

test("/stamps/ still answers, and carries the fragment it was asked for", () => {
  // THE LAW: a path is an API for consumers the repo cannot reach. Letters in
  // the town's own record link /stamps/#board; whatever anyone bookmarked links
  // it. Nothing may 404 and nothing may land on a page without the thing it was
  // asked for.
  const fwd = read(FORWARDER_PATH);
  assert.ok(existsSync(new URL(FORWARDER_PATH, import.meta.url)), "/stamps/ must not 404");

  // THE FRAGMENT IS THE WHOLE POINT, and it is why this is a page rather than
  // one more line in the redirects map: that map matches PATHS, and a fragment
  // never reaches the server. A config redirect would silently drop the #board
  // the reader actually asked for.
  assert.ok(/location\.hash/.test(fwd), "the forwarder must read the incoming fragment");
  assert.ok(/location\.replace\(HUB \+/.test(fwd), "and carry it onto the hub");
  assert.ok(/location\.replace/.test(fwd) && !/location\.assign/.test(fwd),
    "replace, not assign — Back must not bounce the reader through the forwarder again");

  // AND IT WORKS WITH NO SCRIPT. Degraded (it lands at the top of the hub
  // rather than at the reader's block) but never dead.
  assert.match(fwd, /http-equiv="refresh"/,
    "a reader with no scripting must still be forwarded");
  assert.ok(fwd.indexOf("location.hash") < fwd.indexOf('http-equiv="refresh"'),
    "the script must come FIRST — it is the only one of the two that keeps the fragment");
  assert.match(fwd, /<a href={HUB}>/, "and an ordinary link, for anything that honours neither");

  // the one fragment whose name changed, and nothing else pretending to
  assert.match(fwd, /const REMAP = \{ market: "board" \}/,
    "the anchor map is an identity but for #market, and says so in one place");
});

test("no page in the repo links the forwarder — it is for links we cannot reach", () => {
  // THE MISS THIS EXISTS BECAUSE OF. The move re-aimed the hub's own self-links
  // and the nav, and left SIX behind: three on the fund page, the home page's
  // milestone link, and two on /numbers/. Every one of them worked — the
  // forwarder carries the fragment, so a reader still landed on the right block
  // — which is exactly why nothing caught it. A working link that spends a
  // whole extra navigation and a visible flash is not a broken link; it is a
  // slow one, and slow ones do not go red.
  //
  // The law is the one the redirects map's own header states: a redirect exists
  // for consumers the repo CANNOT reach. Anything in this tree can be pointed
  // at the real thing, so it must be.
  //
  // NOTE THE CARVE-OUT, and it is a real one: `API + "/stamps/" + handle` in
  // Household.astro is the OFFICE's stamps endpoint, not this site's route.
  // Matching on href= rather than on the string keeps that out.
  const offenders = [];
  for (const file of everyPageFile()) {
    const s = readFileSync(file, "utf8");
    if (file.endsWith(join("stamps", "index.astro"))) continue; // the forwarder names its own path
    if (/href="\/stamps\//.test(s)) offenders.push(file.split(/[\\/]/).slice(-2).join("/"));
  }
  assert.deepEqual(offenders, [],
    `these pages route readers through the forwarder instead of linking the hub: ${offenders.join(", ")}`);
});

test("the forwarder is not a page anyone should land on from a search", () => {
  const fwd = read(FORWARDER_PATH);
  assert.match(fwd, /name="robots" content="noindex/, "a forwarder must not be indexed");
  assert.match(fwd, /rel="canonical" href={HUB}/, "and must name the hub as the real page");
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
