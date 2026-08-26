// The Stamps portal's content laws, asserted against its own source.
//
// ── WHY THIS FILE WAS REWRITTEN (POS-39, 2026-08-23) ─────────────────────────
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

const PORTAL_PATH = "../town/pages/stamps/index.astro";
const src = read(PORTAL_PATH);

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
// The Market's two blocks, and the tab targets. Together with RULE_IDS these
// are every fragment the portal is allowed to be linked at.
const MARKET_IDS = ["board", "pots"];
const PANELS = ["market", "numbers", "rules"];

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
  const stamps = allEntries().filter((e) => e.key === "stamps" || e.href === "/stamps/");
  assert.equal(stamps.length, 1, "ONE Stamps door in the rail — a second rebuilds the split the portal removed");
  assert.equal(stamps[0].label, "Stamps");
  assert.equal(stamps[0].beta, true, "the Stamps entry must wear the beta chip");
  // its own seat: a top-level entry is its own section, so `section` is its key
  assert.equal(stamps[0].section, "stamps", "Stamps is not a top-rail seat");
  assert.equal(stamps[0].depth, 0, "Stamps is a chip of some section again");
  // and nothing anywhere in the rail opens a deeper stamps PAGE: everything
  // stamps is behind the one portal door. A fragment on the portal itself is
  // not a second door -- The Town's bounty-board chip (founder, 2026-08-26:
  // "we need the Bounty Board in The Town") deep-links /stamps/#board, the
  // same page the seat opens, just scrolled to the block.
  assert.deepEqual(allEntries().filter((e) => /^\/stamps\/[^#]/.test(e.href)), [],
    "no second Stamps door in the rail");
});

// ── the portal is one page with three panels ─────────────────────────────────

test("the portal carries three panels and a tab for each", () => {
  for (const p of PANELS) {
    assert.ok(raw.includes(`data-panel="${p}"`), `the ${p} panel is missing`);
    assert.ok(raw.includes(`data-tab="${p}"`), `the ${p} tab is missing`);
  }
  assert.ok(raw.includes("<PostmarkLayout"), "and it is wrapped in the layout");
});

test("the market opens first, and the other panels start hidden", () => {
  // THE FOUNDER'S RULING THIS ASSERTS, 2026-08-23: the hub "still very much
  // reads like a giant contract lol instead of a proper hub." The market being
  // the first screen is the whole answer to that, so it is pinned.
  const panelTag = (name) => raw.match(new RegExp(`<section class="p-panel" data-panel="${name}"[^>]*>`))[0];
  assert.equal(/hidden/.test(panelTag("market")), false, "the market must not start hidden");
  for (const p of ["numbers", "rules"]) {
    assert.ok(/hidden/.test(panelTag(p)), `the ${p} panel must start hidden`);
  }
  assert.ok(/data-tab="market"[^>]*aria-selected="true"/.test(raw),
    "and the market tab must start selected");
});

test("the head answers WHAT IS THIS in plain words, unfolded", () => {
  // SUPERSEDES the folded-primer law. The founder's ruling, 2026-08-26, off a
  // real reader who read the page three times and could not say what a stamp
  // was (discussion #2036): "a reader needs to understand WHAT THIS IS before
  // they can digest any information about WHAT IT DOES... WHAT IS THIS is the
  // utmost priority." So the head opens with the plain definition and three
  // unfolded sentences — no click between a first-timer and the ground.
  assert.equal(raw.includes('<details class="p-primer">'), false,
    "the primer went back behind a fold — the head must be unfolded");
  const head = raw.slice(raw.indexOf('<header class="p-head">'), raw.indexOf("</header>"));
  assert.ok(head.includes('class="p-folk"'), "the head lost its plain one-breath definition");
  assert.equal((head.match(/<li>/g) || []).length, 3,
    "the head carries exactly three sentences — more is the wall coming back");
  // and the giver's door: a reader who only wants to help pay the bills is
  // pointed at the pots without having to learn the economy first.
  assert.ok(head.includes('href="#pots"'), "the head must point a giver at the pots");
});

// ── the teaching, re-homed as accordions ─────────────────────────────────────

test("the Rules panel carries all nine teaching sections, ids intact", () => {
  const rules = raw.slice(raw.indexOf('data-panel="rules"'));
  for (const id of RULE_IDS) {
    assert.ok(rules.includes(`<details class="r-fold" id="${id}">`),
      `the Rules panel is missing #${id} — the move dropped a section`);
  }
});

test("every accordion starts shut", () => {
  // A hub is not a concatenation: nine sections expanded on load IS the manual
  // the founder rejected, whatever the chrome around it looks like.
  const opened = [...raw.matchAll(/<details class="r-fold" id="([\w-]+)"([^>]*)>/g)]
    .filter((m) => /\bopen\b/.test(m[2])).map((m) => m[1]);
  assert.deepEqual(opened, [], `these accordions ship expanded: ${opened.join(", ")}`);
});

test("the router knows every panel and every accordion, and yields to the page", () => {
  // THE MECHANICAL LAW THIS ASSERTS, from astro.config.town.mjs's own redirects
  // map: it matches PATHS. A fragment never reaches the server, so /stamps/
  // #earning — the shape of every deep link ever written into the teaching —
  // cannot be routed by configuration. This script is the only thing that
  // lands them.
  const list = src.slice(src.indexOf("const RULE_IDS = ["));
  const ids = list.slice(0, list.indexOf("]"));
  for (const id of RULE_IDS) {
    assert.ok(ids.includes(`"${id}"`), `the router would strand /stamps/#${id}`);
  }
  assert.ok(src.includes('var MARKET_IDS = ["board", "pots"]'),
    "and the market's own two anchors");
  assert.ok(src.includes('addEventListener("hashchange"'),
    "a hash changed after load is the same deep link and gets the same treatment");
  assert.ok(src.includes("fold.open = true"),
    "a teaching deep link must arrive with its section already open");
  assert.ok(/history\.pushState/.test(src),
    "switching panels writes history rather than reloading — Back walks the panels");
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
  assert.match(config, /'\/board\/':\s*'\/stamps\/#board'/,
    "the board's old path must land on the block that absorbed it");
  assert.match(config, /'\/stamps\/guide\/':\s*'\/stamps\/#rules'/,
    "and the guide's, on the panel that absorbed it");
  // a redirect at a fragment the portal does not carry lands nowhere at all
  assert.ok(raw.includes('<div id="board"'), "#board must still be on the portal");
  assert.ok(raw.includes('data-panel="rules"'), "and the rules panel must still be there");
  assert.equal(existsSync(new URL("../town/pages/stamps/guide/index.astro", import.meta.url)), false,
    "the guide page is gone — a second page beside the portal would be the split this closed");
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
  for (const page of ["index.astro", "numbers/index.astro", "fund/[pot].astro", "stamps/index.astro"]) {
    const s = read(`../town/pages/${page}`);
    assert.equal(/href="\/board\/"/.test(s), false,
      `${page} still links /board/ — the redirect is for links the repo cannot reach`);
    assert.equal(/href="\/stamps\/guide\/"/.test(s), false,
      `${page} still links /stamps/guide/`);
  }
});

test("every bare fragment on the portal names something the portal has", () => {
  // THE BUG THIS CATCHES, twice over now. v2's split silenced links whose
  // target moved to the other page; v3's collapse could silence links whose
  // target moved into a panel. Neither breaks loudly — the browser just
  // scrolls nowhere.
  const KNOWN = new Set([...RULE_IDS, ...MARKET_IDS, ...PANELS]);
  const literal = [...raw.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
  const jumps = [...raw.matchAll(/data-jump="([\w-]+)"/g)].map((m) => m[1]);
  for (const id of [...literal, ...jumps]) {
    assert.ok(KNOWN.has(id),
      `the portal points at #${id}, which is not a panel, a market block or an accordion`);
  }
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
