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
import { readFileSync } from "node:fs";

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
