// The Stamps surfaces' content laws, asserted against their own source.
//
// There are two pages since POS-34 and the split is the point: /stamps/ is the
// HUB (primer · the live half · the doors) and /stamps/guide/ is the TEACHING.
// The founder's verdict on the first fold was that a hub is not a
// concatenation, so these tests police the line between them in both
// directions — the hub must not grow the manual back, and the guide must not
// lose a section on the way across.
//
// Two content laws ride the teaching wherever it lives:
//
//   1. It quotes, never paraphrases. The tri-law is the load-bearing sentence
//      the whole teaching hangs on, so it must appear in the law's own words.
//   2. It restates no dial. R10: "Owner of the number: ECONOMY-DIALS.json §
//      law_side.keeping.rho; every other surface reads it rather than
//      restating it." /numbers/ holds that line, and so do both pages here —
//      the hub carries money prose too.
//
// Both are asserted against the source text because that is where a drift
// would land — a later edit that helpfully writes the holo cap ratio into the
// prose would fork the dial, and this goes red instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const HUB_PATH = "../town/pages/stamps/index.astro";
const GUIDE_PATH = "../town/pages/stamps/guide/index.astro";
const hubSrc = read(HUB_PATH);
const guideSrc = read(GUIDE_PATH);

// Markup wraps quoted sentences across lines and threads <b> through them, so
// every assertion below reads a whitespace-flattened, tag-stripped view. A
// quotation broken by a line wrap is still the quotation.
const flat = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

// A page's prose only — the frontmatter block carries the provenance comments,
// which legitimately name R10 and quote its wording.
const prose = (s) => s.slice(s.indexOf("---", 3) + 3);
const hubRaw = prose(hubSrc);
const guideRaw = prose(guideSrc);
const hubBody = flat(hubRaw);
const guideBody = flat(guideRaw);

// The teaching's nine sections, in the order they are taught. The forwarder,
// the doors and the guide's own table of contents all key on these ids, which
// is why a renamed one has to break something loudly.
const GUIDE_SECTIONS = [
  "what", "earning", "staking", "seam", "minterest",
  "ownership", "faq", "glossary", "check",
];

// ── the two content laws ─────────────────────────────────────────────────────

test("the tri-law appears in the law's own words, on the page that teaches it", () => {
  assert.ok(
    guideBody.includes("voice returns · public-good rewards mint fresh · currency conversion burns"),
    "the tri-law must be quoted verbatim from LOGOS/the-derivation.md § 9",
  );
});

test("no dial value is written into either page's rendered words", () => {
  // Any assignment-shaped restatement of a dial — "ρ = 0.5", "sigma is 0.5",
  // "ρ of 0.5" — is a fork of ECONOMY-DIALS.json. The dials render at
  // /numbers/, read from the emission, and both pages point there.
  const forks = [
    /[ρσ]\s*(?:=|is|of)\s*0?\.\d/i,
    /\b(?:rho|sigma)\s*(?:=|is|of)\s*0?\.\d/i,
  ];
  // NOT the markup alone. The hub's doors row keeps its sentences in a
  // frontmatter array, and those sentences render — so a dial written into a
  // door's line would have sailed past a body-only check. Frontmatter STRING
  // LITERALS are therefore read too, and only those: the comments around them
  // legitimately name R10 and quote its wording, and a comment renders nothing.
  const frontmatterStrings = (src) => {
    const fm = src.slice(0, src.indexOf("---", 3));
    return [...fm.matchAll(/"([^"\\]*)"|`([^`\\]*)`/g)]
      .map((m) => m[1] ?? m[2]).join("   ");
  };
  for (const [name, src, body] of [["the hub", hubSrc, hubBody], ["the guide", guideSrc, guideBody]]) {
    for (const surface of [body, frontmatterStrings(src)]) {
      for (const re of forks) {
        const hit = surface.match(re);
        assert.equal(hit, null, `${name} restates a dial: ${hit && hit[0]}`);
      }
    }
  }
});

test("both pages point at the dials rather than carrying them", () => {
  assert.ok(hubRaw.includes('href="/numbers/"'), "the hub's doors must include The Numbers");
  assert.ok(guideRaw.includes('href="/numbers/"'), "the guide must link The Town's Numbers");
});

test("every holo mention carries the ruling's line, on both pages", () => {
  // HOLO_LINE is imported rather than typed, so the sentence cannot drift from
  // the one every other money surface carries.
  for (const [name, src, body] of [["hub", hubSrc, hubBody], ["guide", guideSrc, guideBody]]) {
    assert.ok(
      /import \{[^}]*HOLO_LINE[^}]*\} from "@\/lib\/funding\.mjs"/.test(src),
      `${name}: HOLO_LINE must be imported, not retyped`,
    );
    assert.ok(body.includes("{HOLO_LINE}"), `${name}: the page must render HOLO_LINE`);
  }
});

test("the nav carries the Stamps entry, flagged beta like The Numbers", () => {
  const layout = read("../src/layouts/PostmarkLayout.astro");
  assert.ok(
    /\{ key: "stamps", href: `\$\{P\}\/stamps\/`, label: "Stamps", beta: true \}/.test(layout),
    "PostmarkLayout's nav must carry the Stamps entry with beta: true",
  );
  // ONE door in the nav, not two. The Guide is reached from the hub; a second
  // nav entry would rebuild the split the hub exists to remove.
  assert.equal(/href=`\$\{P\}\/stamps\/guide\//.test(layout), false,
    "the Guide must not take its own nav entry");
});

// ── the hub is the hub ───────────────────────────────────────────────────────

test("the hub carries the live half and the doors, and nothing else", () => {
  assert.ok(hubRaw.includes('<section id="board"'), "the board's section must live on the hub");
  assert.ok(hubRaw.includes('<section id="pots"'), "so must the pots");
  assert.ok(hubRaw.includes('<section id="doors"'), "and the doors row that ends it");
  // read from the world store and the emission, never written down here
  assert.ok(/import \{[^}]*notices[^}]*\} from "@\/lib\/board\.mjs"/.test(hubSrc),
    "the notices come from the board reader");
  assert.ok(/import \{[^}]*livePots[^}]*\} from "@\/lib\/funding\.mjs"/.test(hubSrc),
    "and the pots from the funding reader — livePots, so a draft pot stays off");

  // THE CONCATENATION TEST. The founder's verdict in one assertion: none of the
  // teaching's sections may reappear on the hub.
  for (const id of GUIDE_SECTIONS) {
    assert.equal(hubRaw.includes(`<section id="${id}"`), false,
      `the hub grew the teaching back: #${id} is on it again`);
  }
});

test("the doors row names five surfaces and every internal door resolves", () => {
  const doors = hubSrc.slice(hubSrc.indexOf("const DOORS = ["));
  const block = doors.slice(0, doors.indexOf("\n];"));
  const hrefs = [...block.matchAll(/href: (?:"([^"]+)"|(\w+))/g)].map((m) => m[1] ?? m[2]);
  assert.equal(hrefs.length, 5, `the doors row must carry five doors, found ${hrefs.length}`);
  assert.ok(hrefs.includes("/numbers/"), "The Numbers");
  assert.ok(hrefs.includes("LEDGER"), "The Ledger — the signed record, by its constant");
  assert.ok(hrefs.includes("/world/"), "The Map");
  assert.ok(hrefs.includes("/stamps/guide/#earning"), "Earning");
  assert.ok(hrefs.includes("/stamps/guide/"), "The Guide");
  // every door must say what is BEHIND it, not merely name itself
  const lines = [...block.matchAll(/line: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(lines.length, 5, "every door carries its one line");
  for (const l of lines) assert.ok(l.length > 40, `a door's line is too thin to be a door: ${l}`);
});

test("the four kinds of nothing survived the fold", () => {
  // THE LAW THIS ASSERTS — the Bounty Board's own header, carried into the hub:
  // "A board that invented a notice to look alive would be lying about what the
  // town wants." Distinguishing the kinds of nothing is how the page keeps that
  // promise, and a fold that flattened them into one "nothing here" would have
  // quietly dropped it.
  for (const [what, needle] of [
    ["the store could not be read", "The world store could not be read"],
    ["the board place is not set down", "The board is not up yet"],
    ["the board is up and empty", "The board is up, and empty"],
    ["notices that could not be read", "could not be read."],
  ]) {
    assert.ok(hubBody.includes(needle), `the hub lost the branch for ${what}`);
  }
  assert.ok(hubBody.includes("No pot is open"), "and a town asking for no money says so");
});

// ── the guide is the teaching ────────────────────────────────────────────────

test("the guide carries all nine sections, anchors intact", () => {
  for (const id of GUIDE_SECTIONS) {
    assert.ok(guideRaw.includes(`<section id="${id}"`),
      `the guide is missing #${id} — the move dropped a section`);
  }
  // the ids are what every deep link ever written into the teaching points at,
  // so the guide's own table of contents must key on the same list
  for (const id of GUIDE_SECTIONS) {
    assert.ok(guideSrc.includes(`["${id}", `), `the guide's contents omit #${id}`);
  }
});

test("the forwarder knows every guide section, and replaces rather than pushes", () => {
  // THE LAW THIS ASSERTS is a mechanical one, from astro.config.town.mjs's own
  // redirects map: it matches PATHS. A fragment never reaches the server, so
  // /stamps/#earning cannot be redirected by configuration and this script is
  // the only thing keeping those links alive.
  const fwd = hubSrc.slice(hubSrc.indexOf("const GUIDE_SECTIONS = ["));
  const list = fwd.slice(0, fwd.indexOf("\n];"));
  for (const id of GUIDE_SECTIONS) {
    assert.ok(list.includes(`"${id}"`), `the forwarder would strand /stamps/#${id}`);
  }
  assert.ok(hubSrc.includes('window.location.replace("/stamps/guide/#"'),
    "replace, not assign — the Back button must return where the reader came from");
  assert.ok(hubSrc.includes('addEventListener("hashchange"'),
    "a hash changed after load is the same deep link and gets the same treatment");
  assert.ok(hubSrc.includes("if (document.getElementById(id)) return;"),
    "a section that IS on the hub wins — nobody is sent away from what is right here");
});

// ── the pots, and their three characters ─────────────────────────────────────

test("each pot says what IT does, keyed on the word and never on the boolean", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _close, quoted:
  //   "a month's close runs only if the accumulated roll — carried dollars plus
  //    this month's — totals at least min_close_usd; otherwise dollars and
  //    stakes both stand and ride to the next month … Nothing is ever refused
  //    at intake: a gift of any size is witnessed and joins the roll."
  // and its predecessor shape, § _close as it read that morning:
  //   "a standing box, not an epoch pot — gifts are witnessed, never converted;
  //    nothing here ever burns or mints"
  const pots = hubRaw.slice(hubRaw.indexOf('<section id="pots"'));
  const section = pots.slice(0, pots.indexOf("\n    </section>"));
  const body = flat(section);

  // TWO sites branch on elastic and both matter: the figure line (a roll is not
  // "this epoch", and it must never be given a bar) and the close panel. An
  // earlier version of this test named only the string, so dropping one site
  // while keeping the other went unnoticed.
  assert.ok(body.includes("given so far this roll"),
    "an elastic pot's figure is a running roll, not one epoch's takings");
  assert.ok(/rolls forward until/.test(body), "and it says what it is rolling toward");
  assert.equal(section.split('p.close === "elastic"').length - 1, 2,
    "both the figure line and the close panel must branch on the word");
  assert.ok(section.includes('p.close === "none"'), "and so does the standing box");
  assert.ok(body.includes("carries forward"), "the elastic pot says the roll carries forward");
  assert.ok(body.includes("whole accumulated roll"),
    "and that holo splits across the whole roll, not just the closing month");
  assert.ok(body.includes("Nothing closes here"), "the standing box still says so");
  assert.ok(body.includes("nothing mints back"), "in the words that leave no room");

  // THE UNSAID CASE. `closes` is false both when the town said "never" and when
  // the town has not said at all, and only one of those may be rendered as a
  // promise. This is not hypothetical: the live emission carries no close word
  // today, because sync-atlas.yml runs MAIN's emitter.
  assert.ok(body.includes("not in the town's published record yet"),
    "a pot whose close the record has not stated must say exactly that");

  // and the lead must not speak for the cards
  const lead = flat(section.slice(0, section.indexOf("potBoard.pots.map")));
  assert.equal(/the close mints/i.test(lead), false,
    "a blanket close promise in the lead is the regression the first fold removed");
  assert.ok(lead.includes("Each pot below says which it is"),
    "the lead defers to the cards");
});

test("the floor is read from the pot file, never written into the page", () => {
  // THE LAW THIS ASSERTS — WHITE_PAGES/pot-darko-fund.json § _min_close, quoted:
  //   "the ceremony's floor, never the door's: intake refuses nothing — the
  //    floor gates only whether a month's close RUNS. Owner of the number: this
  //    file; every surface reads it."
  assert.ok(hubSrc.includes("p.minCloseUsd"), "the hub reads the emitted floor");
  assert.equal(/\$5\b/.test(hubBody), false, "and never writes the number down");
  assert.ok(hubBody.includes("rolls forward until it is worth closing"),
    "an emission with no floor says the shape and declines to name a number it was not given");
  assert.ok(hubBody.includes("nothing is ever refused at intake") ||
    hubBody.includes("A gift of any size is witnessed"),
    "the floor gates the ceremony, never the door — the sentence a giver most needs");
});

// ── the money doors ──────────────────────────────────────────────────────────

test("the hub links each open pot's money moment and carries none of it", () => {
  // THE LAW THIS ASSERTS — the USDC runbook R9, quoted in
  // town/pages/fund/[pot].astro's header: "The address publishes ONLY beside a
  // pot (the money moment carries the disclosure, per §10's second consent
  // gate) — never bare on a page."
  assert.ok(hubSrc.includes('href={`/fund/${p.pot}/`}'), "each pot links its own money moment");
  assert.ok(hubSrc.includes('p.status === "open" && ('),
    "and only an open pot — a draft or closed pot has no page that can take a dollar");
  assert.equal(/0x[0-9a-fA-F]{40}/.test(hubSrc), false, "no intake address on the hub");
  assert.equal(/qrSvg|<form/.test(hubSrc), false, "and no QR and no witness form");
  assert.equal(/buy\.stripe\.com/.test(hubSrc), false, "and no card button — an ask needs its need beside it");
});

test("the card rail rides the same gate and the same disclosures as the address", () => {
  const fund = read("../town/pages/fund/[pot].astro");
  assert.ok(fund.includes("https://buy.stripe.com/"), "the fund page carries the card rail");
  // both rails live inside the ONE open gate, after the disclosure block
  const gate = fund.indexOf("{open && (<>");
  const law = fund.indexOf('<section class="f-law"');
  assert.ok(law > 0 && gate > law,
    "the disclosures sit ABOVE both rails — §10's second consent gate");
  // the button renders the CONSTANT, so the gate check looks for the constant's
  // use and not for the URL — which legitimately appears once, in frontmatter
  assert.ok(fund.indexOf("href={STRIPE}", gate) > gate,
    "the card button is inside the open-pot gate, not outside it");
  assert.equal(fund.slice(0, gate).includes("href={STRIPE}"), false,
    "and nowhere above it — a draft pot must have no way to pay");
  // and it tells the truth about how a card payment is witnessed
  const fbody = flat(prose(fund));
  assert.ok(fbody.includes("witnessed by the office's own hand"),
    "a card payment is witnessed by a person, and the page says so");
  assert.ok(fbody.includes("cannot see a card payment"),
    "the chain form cannot verify a card payment, and the page says that too");
});

test("no pot page promises a close it does not run", () => {
  const fund = read("../town/pages/fund/[pot].astro");
  assert.ok(fund.includes("{pot.closes ? ("), "the disclosure branches on the pot's own word");
  assert.ok(flat(prose(fund)).includes("nothing mints back"),
    "and a pot that mints nothing says so beside its own intake address");
});

// ── the routes ───────────────────────────────────────────────────────────────

test("/board/ redirects to a section that still exists, and its images keep serving", () => {
  const config = read("../astro.config.town.mjs");
  assert.match(config, /'\/board\/':\s*'\/stamps\/#board'/,
    "the old path must land on the section that absorbed it");
  assert.ok(hubRaw.includes('<section id="board"'),
    "and that section must still be on the hub, or the redirect lands nowhere");
  assert.equal(existsSync(new URL("../town/pages/board/index.astro", import.meta.url)), false,
    "the board page is gone — a pointer page beside the hub would be the split this closed");
  // /board/ is also a public asset prefix, and /daily/ paints with one of them
  assert.ok(existsSync(new URL("../public/atelier/postmark/board/quest-board-wood.jpg", import.meta.url)),
    "the redirect must be exact-path: the board's images still live under /board/");
  assert.ok(read("../town/pages/daily.astro").includes("/board/quest-board-wood.jpg"),
    "and /daily/ still paints with one");
});

test("nothing in the repo still points at the retired /board/ page", () => {
  for (const page of ["index.astro", "numbers/index.astro", "fund/[pot].astro",
    "stamps/index.astro", "stamps/guide/index.astro"]) {
    assert.equal(/href="\/board\/"/.test(read(`../town/pages/${page}`)), false,
      `${page} still links the retired page — the redirect is for links the repo cannot reach`);
  }
});

test("neither page keeps a bare fragment pointing at the other page's section", () => {
  // THE BUG THE SPLIT CREATES, made into a rule. Before POS-34 every one of
  // these sections was on one page, so `href="#pots"` from the seam section was
  // correct. The move silences that kind of link rather than breaking it: the
  // browser simply scrolls nowhere. The forwarder cannot help — it only handles
  // hashes arriving at the hub, and these are links leaving a page.
  const HUB_IDS = ["board", "pots", "doors"];
  // Literal hrefs AND the ids a template literal builds one from. The guide's
  // table of contents renders `href={`#${id}`}` out of an array, so a stale
  // entry there is a dead fragment that no literal-href scan can see — which
  // is exactly how "The board" and "The pots" survived the move onto a page
  // that has neither.
  const bare = (s) => {
    const literal = [...s.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
    const tocBlock = s.includes("const toc = [")
      ? s.slice(s.indexOf("const toc = ["), s.indexOf("\n];", s.indexOf("const toc = [")))
      : "";
    const fromToc = [...tocBlock.matchAll(/\["([\w-]+)",/g)].map((m) => m[1]);
    return [...literal, ...fromToc];
  };
  // the WHOLE source, not the prose: the table of contents lives in frontmatter
  for (const id of bare(guideSrc)) {
    assert.equal(HUB_IDS.includes(id), false,
      `the guide points at #${id}, which lives on the hub — it must be /stamps/#${id}`);
    assert.ok(guideRaw.includes(`id="${id}"`), `the guide points at #${id}, which is nowhere`);
  }
  for (const id of bare(hubSrc)) {
    assert.equal(GUIDE_SECTIONS.includes(id), false,
      `the hub points at #${id}, which lives on the guide — it must be /stamps/guide/#${id}`);
    assert.ok(hubRaw.includes(`id="${id}"`), `the hub points at #${id}, which is nowhere`);
  }
});

test("both pages are actually wrapped in the layout", () => {
  // THE BUG THIS CATCHES, from POS-34's own build: the hub was assembled from
  // pieces and lost its <PostmarkLayout> opening tag. Astro rendered it
  // happily — a bare <main> with no <html>, no <head>, no nav, and no
  // <meta charset>, which a browser then guessed at and drew as mojibake.
  // Nothing else went red: the suite passed, the build passed, 3064 pages
  // built. Only looking at the render caught it, so it gets a probe.
  for (const [name, src] of [["the hub", hubSrc], ["the guide", guideSrc]]) {
    const open = src.indexOf("<PostmarkLayout");
    const close = src.indexOf("</PostmarkLayout>");
    const main = src.indexOf('<main class="pm-wrap stamps">');
    assert.ok(open > 0, `${name} never opens PostmarkLayout — it would render with no <head>`);
    assert.ok(close > open, `${name} never closes PostmarkLayout`);
    assert.ok(main > open && main < close, `${name}'s <main> sits outside the layout`);
    // the layout is what supplies the title and the nav's active state
    const tag = src.slice(open, src.indexOf(">", open));
    assert.ok(/title=/.test(tag), `${name} passes the layout no title`);
    assert.ok(/active="stamps"/.test(tag), `${name} must light the Stamps entry in the nav`);
  }
});
