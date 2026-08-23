// The Stamps page's two content laws, asserted against its own source.
//
// The page is a READING of the town's law, and it is built on two rules that
// nothing else on the site can enforce for it:
//
//   1. It quotes, never paraphrases. The tri-law is the load-bearing sentence
//      the whole page hangs on, so it must appear in the law's own words.
//   2. It restates no dial. R10: "Owner of the number: ECONOMY-DIALS.json §
//      law_side.keeping.rho; every other surface reads it rather than
//      restating it." /numbers/ holds that line; so does this page.
//
// Both are asserted against the source text because that is where a drift
// would land — a later edit that helpfully writes "ρ = 0.5" into the prose
// would fork the dial, and this goes red instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const SRC = new URL("../town/pages/stamps/index.astro", import.meta.url);
const src = readFileSync(SRC, "utf8");

// Markup wraps quoted sentences across lines and threads <b> through them, so
// every assertion below reads a whitespace-flattened, tag-stripped view. A
// quotation broken by a line wrap is still the quotation.
const flat = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

// The page's prose only — the frontmatter block carries the provenance
// comments, which legitimately name R10 and quote its wording.
const raw = src.slice(src.indexOf("---", 3) + 3);
const body = flat(raw);

test("the tri-law appears in the law's own words", () => {
  assert.ok(
    body.includes("voice returns · public-good rewards mint fresh · currency conversion burns"),
    "the tri-law must be quoted verbatim from LOGOS/the-derivation.md § 9",
  );
});

test("no dial value is written into the page's prose", () => {
  // Any assignment-shaped restatement of a dial — "ρ = 0.5", "sigma is 0.5",
  // "ρ of 0.5" — is a fork of ECONOMY-DIALS.json. The dials render at
  // /numbers/, read from the emission, and this page points there.
  const forks = [
    /[ρσ]\s*(?:=|is|of)\s*0?\.\d/i,
    /\b(?:rho|sigma)\s*(?:=|is|of)\s*0?\.\d/i,
  ];
  for (const re of forks) {
    const hit = body.match(re);
    assert.equal(hit, null, `the page restates a dial: ${hit && hit[0]}`);
  }
});

test("the page points at the dials rather than carrying them", () => {
  assert.ok(raw.includes('href="/numbers/"'), "the page must link The Town's Numbers");
});

test("every holo mention on the page carries the ruling's line", () => {
  // HOLO_LINE is imported rather than typed, so the sentence cannot drift from
  // the one every other money surface carries.
  assert.ok(
    /import \{[^}]*HOLO_LINE[^}]*\} from "@\/lib\/funding\.mjs"/.test(src),
    "HOLO_LINE must be imported, not retyped",
  );
  assert.ok(body.includes("{HOLO_LINE}"), "the page must render HOLO_LINE");
});

test("the nav carries the Stamps entry, flagged beta like The Numbers", () => {
  const layout = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
  assert.ok(
    /\{ key: "stamps", href: `\$\{P\}\/stamps\/`, label: "Stamps", beta: true \}/.test(layout),
    "PostmarkLayout's nav must carry the Stamps entry with beta: true",
  );
});

// ── the hub ──────────────────────────────────────────────────────────────────
// POS-32, the founder 2026-08-23: "not just the guide about Stamps — the
// central hub for all things stamps." /board/ was folded in here and now
// redirects; these assert the fold actually happened and did not lose the
// board's own honesty laws on the way.

test("the hub carries the live half, not just the teaching", () => {
  assert.ok(raw.includes('<section id="board"'), "the board's section must live on the hub");
  assert.ok(raw.includes('<section id="pots"'), "so must the pots");
  assert.ok(/\["board", "The board"\]/.test(src) && /\["pots", "The pots"\]/.test(src),
    "and the page's own table of contents must name them");
  // read from the world store and the emission, never written down here
  assert.ok(/import \{[^}]*notices[^}]*\} from "@\/lib\/board\.mjs"/.test(src),
    "the notices come from the board reader");
  assert.ok(/import \{[^}]*livePots[^}]*\} from "@\/lib\/funding\.mjs"/.test(src),
    "and the pots from the funding reader — livePots, so a draft pot stays off");
});

test("the four kinds of nothing survived the fold", () => {
  // THE LAW THIS ASSERTS — town/pages/board/index.astro's own header, carried
  // into the hub: "A board that invented a notice to look alive would be lying
  // about what the town wants." Distinguishing the kinds of nothing is how the
  // page keeps that promise, and a fold that flattened them into one "nothing
  // here" would have quietly dropped it.
  for (const [what, needle] of [
    ["the store could not be read", "The world store could not be read"],
    ["the board place is not set down", "The board is not up yet"],
    ["the board is up and empty", "The board is up, and empty"],
    ["notices that could not be read", "could not be read."],
  ]) {
    assert.ok(body.includes(needle), `the hub lost the branch for ${what}`);
  }
  assert.ok(body.includes("No pot is open"), "and a town asking for no money says so");
});

test("no pot is sold an epoch pot's promise unless it has one", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _close, quoted:
  //   "a standing box, not an epoch pot — gifts are witnessed, never
  //    converted; nothing here ever burns or mints"
  // The board's old lead said it for every pot at once — "the close mints holo
  // to the hands that paid" — which is the sentence this test exists to keep
  // out. What replaced it is a per-pot branch on the pot file's own word.
  const pots = raw.slice(raw.indexOf('<section id="pots"'));
  const section = pots.slice(0, pots.indexOf("\n    </section>"));
  assert.ok(section.length > 0, "the pots section must be findable");

  assert.ok(/\{p\.closes\s*\n?\s*\?/.test(section) || section.includes("{p.closes"),
    "the close sentence must branch per pot");
  assert.ok(flat(section).includes("nothing mints back"),
    "the standing box must say plainly that nothing comes back");
  assert.ok(flat(section).includes("Each pot below says which it is"),
    "and the lead must defer to the cards rather than speak for them");

  const lead = flat(section.slice(0, section.indexOf("potBoard.pots.map")));
  assert.equal(/the close mints/i.test(lead), false,
    "a blanket close promise in the lead is the exact regression this fold removed");
});

test("the money moment stayed on the pot's own page", () => {
  // THE LAW THIS ASSERTS — the USDC runbook R9, quoted in
  // town/pages/fund/[pot].astro's header: "The address publishes ONLY beside a
  // pot (the money moment carries the disclosure, per §10's second consent
  // gate) — never bare on a page." The hub lists pots; it must not become a
  // page where the address stands without a named need beside it.
  assert.equal(/0x[0-9a-fA-F]{40}/.test(src), false, "no intake address on the hub");
  assert.equal(/qrSvg|<form/.test(src), false, "and no QR and no witness form");
});

test("/board/ redirects to the hub, and its images keep serving", () => {
  const config = readFileSync(new URL("../astro.config.town.mjs", import.meta.url), "utf8");
  assert.match(config, /'\/board\/':\s*'\/stamps\/#board'/,
    "the old path must land on the section that absorbed it");
  assert.equal(existsSync(new URL("../town/pages/board/index.astro", import.meta.url)), false,
    "the board page is gone — a pointer page left beside the hub would be the split this closed");
  // /board/ is also a public asset prefix, and /daily/ paints with one of them
  assert.ok(existsSync(new URL("../public/atelier/postmark/board/quest-board-wood.jpg", import.meta.url)),
    "the redirect must be exact-path: the board's images still live under /board/");
  const daily = readFileSync(new URL("../town/pages/daily.astro", import.meta.url), "utf8");
  assert.ok(daily.includes("/board/quest-board-wood.jpg"), "and /daily/ still paints with one");
});

test("nothing in the repo still points at the retired /board/ page", () => {
  for (const page of ["index.astro", "numbers/index.astro", "fund/[pot].astro", "stamps/index.astro"]) {
    const s = readFileSync(new URL(`../town/pages/${page}`, import.meta.url), "utf8");
    assert.equal(/href="\/board\/"/.test(s), false,
      `${page} still links the retired page — the redirect is for links the repo cannot reach`);
  }
});
