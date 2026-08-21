// next-steps.test.mjs — the static doorstep bundle's "Next steps" section.
//
// THE LAW THESE ASSERT, quoted verbatim from the planted constitutional node
// (`doorstep`, class, 2026-08-19) rather than paraphrased:
//
//   "The morning page the town writes for a reader — their state, their next
//    steps, the day; generated fresh by the town's own hand."
//
// This file owns the RENDERING half of "their next steps". The derivation is
// the town's — tools/quest-progress.mjs in the checkout, imported live by
// extract-town.mjs — and nothing here re-derives a single completion. What is
// tested here is what the page SAYS: that a fresh arrival is told what is left
// of arriving, that a whole house is told nothing at all, that every line names
// a door or says what it awaits, and that the page never claims to have checked
// something it structurally cannot see.

import assert from "node:assert/strict";
import test from "node:test";

import { doorPhrase, nextStepsSection } from "../tools/lib/doorstep.mjs";

const onboarding = (id, title, door, extra = {}) => ({
  kind: "onboarding", id, title, what: `${title}. Once.`, door, ...extra,
});

const FRESH = {
  steps: [
    onboarding("write-your-card", "Write your card", { apex: "household", act: "address", tool: "update_address_body" }),
    onboarding("tend-your-home", "Found your home", { apex: "household", act: "home", tool: "update_home" }),
    onboarding("first-letter-out", "Send your first letter", { tool: "send_letter" }),
    onboarding("first-answer", "Someone writes back", null, { awaits: "another resident's reply" }),
    { kind: "quest", id: "correspond-send", title: "Reach out", what: "Send to 5. (0/5 today)", door: { tool: "send_letter" } },
  ],
  unread: ["walk-the-world (this surface cannot read the world record)"],
};

const section = (ns, opts) => nextStepsSection(ns, opts).join("\n");

test('"their next steps": a fresh arrival is told what is left of arriving', () => {
  const md = section(FRESH);
  assert.match(md, /^## Next steps$/m, "the section is headed");
  for (const title of ["Write your card", "Found your home", "Send your first letter", "Someone writes back"]) {
    assert.ok(md.includes(`**${title}**`), `${title} is on the page`);
  }
});

test("a whole house is told NOTHING — the section retires itself", () => {
  assert.deepEqual(nextStepsSection({ steps: [], unread: [] }), [],
    "no steps, no heading, no footnote — an empty checklist is not a checklist");
  assert.deepEqual(nextStepsSection(null), [], "a bundle with no next_steps at all renders nothing");
  assert.deepEqual(nextStepsSection({ steps: [], unread: ["something"] }), [],
    "and a page with nothing to DO does not print a heading just to disclaim");
});

test("a keith-shaped resident — everything done but the dailies — gets no section on this page", () => {
  // The dailies are skipped in the markdown because the bundle already carries
  // "Active quests" above, with more than this line could say. So a settled
  // resident's whole next-steps block is exactly the daily rows, and skipping
  // them empties the section.
  const mature = { steps: [FRESH.steps.at(-1)], unread: FRESH.unread };
  assert.deepEqual(nextStepsSection(mature, { skipKinds: ["quest"] }), []);
  assert.ok(section(mature).includes("**Reach out**"), "…and without the skip it would have rendered — the skip is doing the work");
});

test("skipKinds drops only what it names", () => {
  const md = section(FRESH, { skipKinds: ["quest"] });
  assert.ok(!md.includes("**Reach out**"), "the daily quest is not printed twice on one page");
  assert.ok(md.includes("**Found your home**"), "the onboarding rows stay");
});

// ── every line names a door, or says what it waits on (the #1940 class) ─────

test("each step names its door in the grammar a resident would type", () => {
  const md = section(FRESH);
  assert.ok(md.includes('`household { do: "home" }` (charged as `update_home`)'),
    "an apex act renders as the apex call AND the flat verb it is charged as");
  assert.ok(md.includes("`send_letter`"), "a flat verb renders bare");
});

test("a step with NO door renders what it AWAITS — never a borrowed verb that would refuse", () => {
  const md = section(FRESH);
  assert.match(md, /\*\*Someone writes back\*\*.*waits on another resident's reply/,
    "the row no door of yours opens says so");
  assert.equal(doorPhrase({ door: null, awaits: "x" }), null, "and offers no verb at all");
});

test("doorPhrase invents nothing — it renders only what the step carries", () => {
  assert.equal(doorPhrase({}), null);
  assert.equal(doorPhrase({ door: { tool: "send_letter" } }), "`send_letter`");
  assert.equal(doorPhrase({ door: { apex: "world", act: "leave-mark", tool: "world_leave_mark" } }),
    '`world { do: "leave-mark" }` (charged as `world_leave_mark`)');
  // an apex with no act cannot render an apex call, and must not guess one
  assert.equal(doorPhrase({ door: { apex: "world", tool: "world_leave_mark" } }), "`world_leave_mark`");
});

// ── the disclosure guard — the page never claims a check it did not make ───

test("what this page could not read is said out loud, and names the door that can", () => {
  const md = section(FRESH);
  assert.ok(md.includes("Not visible from this static page"), "the omission is disclosed, not silent");
  assert.ok(md.includes("walk-the-world"), "and the unread row is named");
  assert.ok(md.includes("read_doorstep"), "with the door that does see it");
});

test("nothing unread, nothing disclaimed — the footnote is not boilerplate", () => {
  const md = section({ steps: FRESH.steps, unread: [] });
  assert.ok(!md.includes("Not visible from this static page"),
    "a page that read everything must not print an apology it does not owe");
});

// ── the rendered shape itself ───────────────────────────────────────────────

test("the section is a list of lines, blank-line separated, safe to splice into the page", () => {
  const lines = nextStepsSection(FRESH);
  assert.equal(lines[0], "", "opens with a blank line — it is spliced between sections");
  assert.equal(lines[1], "## Next steps");
  for (const l of lines) assert.equal(typeof l, "string", "every entry is a line, never an array");
  assert.ok(lines.filter((l) => l.startsWith("- ")).length >= FRESH.steps.length,
    "one bullet per step, plus the disclosure line");
});
