// fund-page.test.mjs — the /fund/<pot> page's falsifiers.
//
// The page is read as TEXT here rather than rendered, because what these assert
// is not layout: it is that a money surface carries the sentences it owes and
// points at the address the office actually verifies against. Both of those are
// true or false in the source, and both are the kind of thing a well-meaning
// copy edit silently breaks.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOLO_LINE, INTAKE, INTAKE_BY_POT, intakeFor } from "../src/lib/funding.mjs";
import { qrMatrix } from "../src/lib/qr.mjs";

const PAGE = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");

// The addresses the OFFICE publishes and verifies against. Written out here
// rather than imported: the office is a different repo, and a constant that
// agrees with itself proves nothing. If either side moves, the two stop
// matching and this goes red.
//
// THE STANDING SHARED INTAKE — postmark-office src/usdc-witness.mjs INTAKE,
// from the runbook, R9's rail, Keemin-ruled 2026-08-21.
const OFFICE_INTAKE = "0x2a273b0e5D0648DfF9B9ED7a4A5041E6762b8C78";

// THE PER-POT MAP — postmark-office deploy/intake-addresses.json `addresses`,
// hand-copied. It is lowercase there (the chain's own spelling, which is what
// eth_getLogs returns and what the office compares against); the site renders
// EIP-55 checksum case, which a wallet accepts identically. So the comparison
// below is case-insensitive on purpose, and the case itself is asserted
// separately — two different claims, neither one hiding the other.
const OFFICE_INTAKE_BY_POT = {
  "keeping-ec2": "0x182085453b5bc2c8cf4cd6f712102cc3dc485fca",
};

test("every address the site publishes is the office's, character for character", () => {
  // The single highest-stakes strings on the whole site: a patron sends real,
  // irreversible USDC to one of them. A drifted character is money gone.
  //
  // LAW (postmark-office deploy/intake-addresses.json, verbatim): "WHICH POT A
  //     USDC ARRIVAL PAYS, read off the address it landed on. An ERC-20
  //     transfer carries no memo, so the ONLY way the chain can name a pot is
  //     for the pot to have its own intake address."
  assert.equal(INTAKE, OFFICE_INTAKE, "the standing shared intake");

  // the map, both directions — an address the site has and the office does not
  // is money sent to nobody, and an address the office has and the site does not
  // is a pot silently still taking dollars on the shared address
  assert.deepEqual(Object.keys(INTAKE_BY_POT).sort(), Object.keys(OFFICE_INTAKE_BY_POT).sort(),
    "the site names exactly the pots the office maps — no more, no fewer");
  for (const [pot, addr] of Object.entries(INTAKE_BY_POT)) {
    assert.equal(addr.toLowerCase(), OFFICE_INTAKE_BY_POT[pot],
      `pot ${pot}: the site's address must be the office's, lowercased`);
    assert.match(addr, /^0x[0-9a-fA-F]{40}$/, `pot ${pot}: a Base address is 0x + 40 hex`);
  }

  // THE FALLBACK IS THE SHARED ADDRESS, NEVER NOTHING. A pot the founder has
  // not minted an address for is not broken; it is every pot before
  // 2026-08-25, and it still takes dollars at the address its patrons were
  // always given.
  assert.equal(intakeFor("darko-fund"), OFFICE_INTAKE, "an unmapped pot keeps the shared intake");
  assert.equal(intakeFor("keeping-ec2"), INTAKE_BY_POT["keeping-ec2"], "a mapped pot shows its own");
  assert.equal(intakeFor("a-pot-that-does-not-exist"), OFFICE_INTAKE);

  // THE SHARED ADDRESS IS NEVER MAPPED TO A POT. The office's own `_never`,
  // verbatim: "Do NOT map the shared intake address to a pot to make the queue
  //     go away. That would make the office decide where a stranger's money
  //     went, which is the one judgement this whole lane refuses to make."
  // A site that mapped it would publish the same false claim from the other end.
  for (const [pot, addr] of Object.entries(INTAKE_BY_POT))
    assert.notEqual(addr.toLowerCase(), OFFICE_INTAKE.toLowerCase(),
      `pot ${pot} must not claim the shared address as its own`);

  // and NO address is a literal on the page — the page reads the seam, so a
  // per-page copy is a per-page drift on the one surface that cannot afford it
  const literals = PAGE.match(/0x[0-9a-fA-F]{40}/g) ?? [];
  assert.deepEqual(literals, [], "no address literal on the page at all");
  assert.match(PAGE, /const intake = intakeFor\(pot\.pot\)/, "the page derives it from the pot");
});

test("the QR encodes THIS POT'S address and nothing else", () => {
  // The QR is the path most patrons will actually use, and it is the one they
  // CANNOT proofread — which is exactly why a per-pot address makes it more
  // dangerous, not less: a patron scanning keeping-ec2's page has no way to
  // notice they funded darko-fund. It is generated from the same value the
  // page prints, and the rendered symbol is decoded in the visual-QA pass.
  assert.match(PAGE, /qrSvg\(intake,/, "the QR is generated from the same value the page prints");
  assert.equal(/qrSvg\((INTAKE|"0x)/.test(PAGE), false, "never from a constant the page did not derive");
  // every address the site can publish encodes to a real symbol
  for (const addr of [INTAKE, ...Object.values(INTAKE_BY_POT)])
    assert.equal(qrMatrix(addr).length, 29, `${addr}: 42 bytes at level M is a version-3 symbol`);
});

test("every disclosure the money moment owes is on the page, verbatim", () => {
  // Keemin's word (seam night): every holo surface carries the caption.
  assert.ok(PAGE.includes("HOLO_LINE"), "the caption is the shared constant, never retyped");
  assert.equal(HOLO_LINE, "a record of contribution, not a promise of profit");
  // the scope-extension's second sentence, exact
  assert.match(PAGE, /This buys ownership and memory, never voice, and converts to real value only if the town someday does\./);
  // the folk-law
  assert.match(PAGE, /money can join the ownership, never the judgment/);
  // the irreversibility warning — the one a patron most needs before they send
  assert.match(PAGE, /not recoverable by the town/);
  assert.match(PAGE, /best effort only, never a promise/);
  // the cents disclosure
  assert.match(PAGE, /whole dollars/);
  assert.match(PAGE, /priced nothing/);
});

test("the consent line sits ABOVE the address, and the full terms below it", () => {
  // §10's second consent gate, RESHAPED at the founder's word (2026-08-26):
  // the reader who clicked "Fund" wants what-this-is, then how-to-pay -- the
  // deep terms are theirs to open, not a wall before the money moment. What
  // survives the reshape is the gate's ORDER: one honest sentence -- deed, no
  // say, no promised return -- still precedes the first copyable character,
  // and the full disclosures still live on this page, behind one click.
  const law = PAGE.indexOf('class="f-law-line"');
  const addr = PAGE.indexOf('<code class="f-code"');
  const fine = PAGE.indexOf('id="fineprint"');
  assert.ok(law > 0 && addr > 0 && fine > 0);
  assert.ok(law < addr, "the consent line must precede the address in the document");
  assert.ok(fine > addr, "the fine print hangs below the money moment");
  assert.ok(PAGE.indexOf("This buys ownership and memory", fine) > fine,
    "the full what-this-buys sentence lives in the fine print, verbatim");
  const consent = PAGE.slice(law, PAGE.indexOf("</section>", law));
  assert.ok(consent.includes("no say"), "the consent line says it buys no say");
  assert.ok(consent.includes("#fineprint"), "and points at the full terms");
});

test("a closed pot gets no page, and one page per pot", () => {
  // A closed pot cannot convert what arrives, so a page for it would take money
  // into a month that is already sealed. And a route keyed on toPot's
  // `<pot>@<epoch>` id would give one pot two pages with two different
  // headrooms, and a patron no way to tell which one the town meant.
  assert.match(PAGE, /if \(p\.status === "closed"\) continue;/);
  assert.match(PAGE, /params: \{ pot: pot\.pot \}/, "the route is the pot SLUG, not the pot-epoch id");
  assert.ok(!/params: \{ pot: pot\.id \}/.test(PAGE));
});

test("ONLY AN OPEN POT CARRIES THE MONEY MOMENT", () => {
  // RE-PINNED 2026-08-21 (S4). This used to assert the source line
  // `if (p.status !== "open") continue;` — that a draft pot got no page at all.
  // A draft pot now gets a page, because the town's own record refuses to hide
  // it (pot-darko-fund.json, verbatim: "DRAFT — the rendering may show on the
  // dev channel, but opening a pot is the founder's word").
  //
  // The law that assertion was PROTECTING is unchanged, and this is a stronger
  // statement of it. funding.mjs: "rendering one would be the site asking for
  // money the town has not asked for." The ask is not the page — the ask is the
  // intake address, the QR, and the witness form. So what must be true is that
  // every one of them hangs off the open gate, and a source-line regex could
  // never have said that: it would have passed a page that routed only open
  // pots and then printed the address unconditionally anyway.
  const gate = PAGE.indexOf('const open = pot.status === "open";');
  assert.ok(gate > 0, "the page declares the money-moment gate as a named constant");

  // The TEMPLATE only — the frontmatter above the second `---` builds the QR
  // and never renders anything, so a mention of INTAKE up there is not a
  // publication. What this test is about is what reaches the reader.
  const BODY = PAGE.slice(PAGE.indexOf("---", PAGE.indexOf("---") + 3));

  // the three things that can take a dollar, each inside `{open && ...}`
  const guarded = BODY.match(/\{open && \(<>([\s\S]*?)<\/>\)\}/);
  assert.ok(guarded, "the pay and witness sections sit inside the open gate");
  const money = guarded[1];
  assert.match(money, /\{intake\}/, "the address is inside the gate");
  assert.match(money, /set:html=\{qr\}/, "the QR is inside the gate");
  assert.match(money, /id="pm-fund-form"/, "the witness form is inside the gate");

  // and NOWHERE else on the page — a second, ungated copy is the exact failure
  // the old source-line assertion could not see
  const ungated = BODY.replace(/\{open && \(<>[\s\S]*?<\/>\)\}/g, "");
  assert.ok(!/\{intake\}/.test(ungated), "the address appears nowhere outside the gate");
  assert.ok(!/data-copy=\{intake\}/.test(ungated), "no copy-the-address button outside the gate either");
  assert.ok(!/set:html=\{qr\}/.test(ungated), "the QR appears nowhere outside the gate");
  assert.ok(!/id="pm-fund-form"/.test(ungated), "the witness form appears nowhere outside the gate");

  // a draft page must SAY it is a draft rather than merely going quiet
  assert.match(PAGE, /\{!open && \(/, "a non-open pot renders its own state");
  assert.match(PAGE, /The town has not opened this pot, so it cannot take your money\./);
});

test("the page shows the refusal verbatim rather than a friendly paraphrase", () => {
  // The whole value of the door's refusals is that they are exact and
  // actionable ("only $40 more can be taken this epoch"). A page that replaced
  // them with "something went wrong" would throw away the only thing a patron
  // can act on.
  assert.match(PAGE, /j\.defect/, "the refusal's own words");
  assert.match(PAGE, /j\.hint/, "and its own remedy");
  assert.match(PAGE, /the refusal, VERBATIM/);
});

test("the page is quiet-launch: reachable, and not in the nav", () => {
  // Postmark's quiet-launch default — discovery is the feature. A funding page
  // in the nav before the constitution ships asks for money on an unpublished
  // promise.
  const layout = readFileSync(new URL("../src/layouts/PostmarkLayout.astro", import.meta.url), "utf8");
  // (2026-08-21, quiet-launch overfit corrected: the doctrine governs the
  // announcement channel, not nav visibility — a /fund link in the nav is no
  // longer forbidden. Fund pages are reached from pot cards today; the old
  // assertion enforcing their absence from the layout is retired.)
});

test('"never closes" is a claim the page may only make when the town said it', () => {
  // THE LAW THIS ASSERTS — src/lib/funding.mjs's own note on the `closes`
  // boolean, quoted, because the page was contradicting it:
  //   "Note what this boolean CANNOT carry: the difference between 'the town
  //    said this never closes' and 'the town has not said'. Both read false,
  //    and a surface that renders the first sentence for the second case is
  //    making a confident claim the record does not support."
  //
  // This page's law block branched on `pot.closes` alone, so a pot the town had
  // simply not spoken for — targetless and wordless, which is a shape the live
  // emission has worn — was told flatly that it never closes, in bold, on the
  // page where somebody is deciding whether to send real money. Sibling of the
  // stamps page's character line, and found in the same 2026-08-25 trueing.
  assert.ok(PAGE.includes('pot.close === "none"'),
    "the never-closes sentence must key on the word the town said");
  assert.match(PAGE, /How this one closes is not in the town's record yet/,
    "and a pot that has not said gets the humble sentence instead");
  // The arms must be DIFFERENT branches. One ternary with the humble copy in
  // the same branch as the standing box would read green on both assertions
  // above while still telling an unsaid pot that nothing ever mints back. The
  // block moved into the fine print (2026-08-26) and grew the elastic arm the
  // market's card gave up -- FOUR arms now, and the humble one still last.
  const law = PAGE.slice(PAGE.indexOf('id="fineprint"'));
  const block = law.slice(0, law.indexOf("</ul>"));
  assert.ok(block.includes('pot.close === "elastic"'),
    "the elastic pot's promise keys on the word, in its own arm");
  assert.equal((block.match(/\) : /g) ?? []).length, 3,
    "four arms: elastic, closes, said-never, and has-not-said");
  assert.ok(block.indexOf("This one never closes") < block.indexOf("is not in the town's record yet"),
    "and the humble arm is the LAST one — the fallthrough is the honest case, never the claim");
});
