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
import { existsSync, readFileSync } from "node:fs";
import { FOUNDER_ACCOUNT } from "../src/lib/funding.mjs";
import { allEntries } from "../src/lib/nav.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

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
  // RE-AIMED 2026-08-25 (the trinity re-org). The rail left PostmarkLayout for
  // `src/lib/nav.mjs`, its single source, and Stamps moved from a top-level
  // seat into The Town's strip — a section member, not a peer of the town. The
  // law is unchanged and is asserted against the STRUCTURE now rather than
  // against a regex on the layout's source text, which is why the move was a
  // one-line red instead of a silent green: the old probe matched a literal
  // line, so it could only ever have survived by nobody moving the line.
  const stamps = allEntries().filter((e) => e.key === "stamps" || e.href === "/stamps/");
  assert.equal(stamps.length, 1, "ONE Stamps door in the rail — a second rebuilds the split the portal removed");
  assert.equal(stamps[0].label, "stamps");
  assert.equal(stamps[0].beta, true, "the Stamps entry must wear the beta chip");
  assert.equal(stamps[0].section, "daily", "Stamps belongs to The Town");
  // and nothing anywhere in the rail opens a deeper stamps URL: everything
  // stamps is behind the one portal door.
  assert.deepEqual(allEntries().filter((e) => /^\/stamps\/./.test(e.href)), [],
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

test("the primer is folded, not the first thing a reader wades through", () => {
  // Same ruling. The five sentences are still here in full — they are just
  // behind one click, so the market is what the page opens with.
  assert.ok(/<details class="p-primer">/.test(raw), "the primer must be a fold");
  // bounded to the fold itself — slicing to the end of the page would count
  // every <li> on the portal and pass no matter what the primer held
  const from = raw.indexOf('<details class="p-primer">');
  const primer = raw.slice(from, raw.indexOf("</details>", from));
  assert.equal(/^<details class="p-primer"[^>]*\bopen\b/.test(primer), false,
    "and it must start shut");
  assert.equal((primer.match(/<li>/g) || []).length, 5,
    "with all five sentences still inside it — exactly five, not four");
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

test("each pot says what IT does, keyed on the word and never on the boolean", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _close, quoted:
  //   "a month's close runs only if the accumulated roll — carried dollars plus
  //    this month's — totals at least min_close_usd; otherwise dollars and
  //    stakes both stand and ride to the next month … Nothing is ever refused
  //    at intake: a gift of any size is witnessed and joins the roll."
  // and the shape it superseded, § _close as it read that morning:
  //   "a standing box, not an epoch pot — gifts are witnessed, never converted;
  //    nothing here ever burns or mints"
  const pots = raw.slice(raw.indexOf('<div id="pots"'));
  const section = pots.slice(0, pots.indexOf("\n    </section>"));
  const sBody = flat(section);

  // THREE sites branch on the word, and each is a different promise: the bar
  // (measured against the close floor, not a target), the figure line for a
  // floorless roll, and the character line. Losing any one of them leaves the
  // pot half-described.
  assert.equal(section.split('p.close === "elastic"').length - 1, 3,
    "the bar, the figure line and the character line must each branch on the word");
  assert.ok(section.includes('p.close === "none"'), "and the standing box has its own branch");
  assert.ok(sBody.includes("given so far this roll"),
    "an elastic pot's figure is a running roll, not one epoch's takings");
  assert.ok(sBody.includes("Carries forward"), "the elastic pot says the roll carries forward");
  assert.ok(sBody.includes("whole accumulated roll"),
    "and that holo splits across the whole roll, not just the closing month");
  assert.ok(sBody.includes("nothing is refused at intake"), "and that intake refuses nothing");
  assert.ok(sBody.includes("Never closes"), "the standing box still says so");
  assert.ok(sBody.includes("nothing mints back"), "in the words that leave no room");

  // THE UNSAID CASE. `closes` is false both when the town said "never" and when
  // the town has not said at all, and only one of those may be rendered as a
  // promise. Not hypothetical: the live emission carries no close word today,
  // because sync-atlas.yml builds it from MAIN's emitter.
  assert.ok(sBody.includes("not in the town's record yet"),
    "a pot whose close the record has not stated must say exactly that");
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
  assert.ok(fund.indexOf("href={STRIPE}", gate) > gate,
    "the card button is inside the open-pot gate");
  assert.equal(fund.slice(0, gate).includes("href={STRIPE}"), false,
    "and nowhere above it — a draft pot must have no way to pay");
  const fbody = flat(fund.slice(fund.indexOf("---", 3) + 3));
  assert.ok(fbody.includes("witnessed by the office's own hand"),
    "a card payment is witnessed by a person, and the page says so");
  assert.ok(fbody.includes("cannot see a card payment"),
    "the chain form cannot verify a card payment, and the page says that too");
});

test("no pot page promises a close it does not run", () => {
  const fund = read("../town/pages/fund/[pot].astro");
  assert.ok(fund.includes("{pot.closes ? ("), "the disclosure branches on the pot's own word");
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
  // /board/ is also a public asset prefix, and /daily/ paints with one of them
  assert.ok(existsSync(new URL("../public/atelier/postmark/board/quest-board-wood.jpg", import.meta.url)),
    "the redirect must be exact-path: the board's images still live under /board/");
  assert.ok(read("../town/pages/daily.astro").includes("/board/quest-board-wood.jpg"),
    "and /daily/ still paints with one");
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
  // THE RULING THIS ASSERTS — the founder, 2026-08-23: the card carries an
  // estimated return "as of this moment". The honesty is the whole point: it
  // is an estimate at today's roll and stakes, it moves as both move, and it
  // is {HOLO_LINE} — never a promise of profit.
  const pots = raw.slice(raw.indexOf('<div id="pots"'));
  const section = pots.slice(0, pots.indexOf("\n    </section>"));
  const sBody = flat(section);

  assert.ok(section.includes("estimate(p) != null &&"),
    "the estimate is gated on the helper, which returns null where no close can run");
  assert.ok(sBody.includes("if the close ran this moment"), "it says when it would apply");
  assert.ok(sBody.includes("it moves as both move"), "and that it is not fixed");
  assert.ok(section.includes("{HOLO_LINE}"), "and it carries the ruling's line");
  // the number comes from the reader, not from the page
  assert.ok(/const estimate = \(pot\) => holoPerDollar\(pot, econ\)/.test(src),
    "the math lives in funding.mjs and the page only calls it");
  assert.equal(/per \$1[^<]*0\.\d/.test(sBody), false, "no estimate is typed into the markup");
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
