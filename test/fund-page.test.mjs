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
import { HOLO_LINE } from "../src/lib/funding.mjs";
import { qrMatrix } from "../src/lib/qr.mjs";

const PAGE = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");

// The address the OFFICE publishes and verifies against (src/usdc-witness.mjs).
// Written out here rather than imported: the office is a different repo, and a
// constant that agrees with itself proves nothing. This is the value from the
// runbook — R9's rail, Keemin-ruled 2026-08-21 — and if either side moves, the
// two stop matching and this goes red.
const OFFICE_INTAKE = "0x2a273b0e5D0648DfF9B9ED7a4A5041E6762b8C78";

test("the page's intake address is the office's, character for character", () => {
  // The single highest-stakes string on the whole site: a patron sends real,
  // irreversible USDC to it. A drifted character is money gone.
  const m = PAGE.match(/export const INTAKE = "(0x[0-9a-fA-F]{40})"/);
  assert.ok(m, "the page must declare its intake address as a named constant, not inline it");
  assert.equal(m[1], OFFICE_INTAKE);
  // and it must appear NOWHERE else as a literal — one place, or it can drift
  const literals = PAGE.match(/0x[0-9a-fA-F]{40}/g) ?? [];
  assert.equal(new Set(literals).size, 1, "exactly one address literal on the page");
});

test("the QR encodes the intake address and nothing else", () => {
  // The QR is the path most patrons will actually use, and it is the one they
  // CANNOT proofread. It gets checked against the same constant the text does.
  assert.match(PAGE, /qrSvg\(INTAKE/, "the QR is generated from the same constant the page prints");
  const m = qrMatrix(OFFICE_INTAKE);
  assert.equal(m.length, 29, "42 bytes at level M is a version-3 symbol");
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

test("the disclosures sit ABOVE the address — the consent gate is an order, not a checklist", () => {
  // §10's second consent gate: the money moment CARRIES the disclosure. A
  // patron who has already copied the address has already consented to nothing.
  const law = PAGE.indexOf("This buys ownership and memory");
  const addr = PAGE.indexOf('<code class="f-code"');
  assert.ok(law > 0 && addr > 0);
  assert.ok(law < addr, "the what-this-buys line must precede the address in the document");
});

test("only OPEN pots get a funding page, and one page per pot", () => {
  // A draft pot has no need the town has stood behind; a closed one cannot
  // convert what arrives. And a route keyed on toPot's `<pot>@<epoch>` id would
  // give one pot two pages with two different headrooms.
  assert.match(PAGE, /if \(p\.status !== "open"\) continue;/);
  assert.match(PAGE, /params: \{ pot: pot\.pot \}/, "the route is the pot SLUG, not the pot-epoch id");
  assert.ok(!/params: \{ pot: pot\.id \}/.test(PAGE));
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
  assert.ok(!/\/fund/.test(layout), "no /fund link in the shared layout's nav");
});
