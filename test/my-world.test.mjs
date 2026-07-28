import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  portfolioIds,
  previewWorldLedgerLine,
  townDate,
  worldAxisState,
  worldStakeAnswer,
} from "../src/lib/my-world.mjs";

test("the two axes are independent and anonymous has no identity controls", () => {
  assert.deepEqual(worldAxisState(), {
    controls: false,
    base: "the True World",
    relation: "everything",
  });
  assert.deepEqual(worldAxisState({ authenticated: true }), {
    controls: true,
    base: "the True World",
    relation: "everything",
  });
  assert.deepEqual(worldAxisState({ authenticated: true, baseLayer: "mine" }), {
    controls: true,
    base: "My World",
    relation: "everything",
  });
  assert.deepEqual(worldAxisState({ authenticated: true, justMine: true }), {
    controls: true,
    base: "the True World",
    relation: "just mine",
  });
  assert.deepEqual(worldAxisState({ authenticated: true, baseLayer: "mine", justMine: true }), {
    controls: true,
    base: "My World",
    relation: "just mine",
  });
});

test("the household portfolio unifies Drafts, Published, and Backed ids", () => {
  const ids = portfolioIds({
    drafts: [{ id: "alpha/sketch" }],
    published: [{ id: "alpha/home" }],
    backed: [{ id: "beta/bench" }, { mark: "alpha/home" }],
  });
  assert.deepEqual([...ids].sort(), ["alpha/home", "alpha/sketch", "beta/bench"]);
});

test("the preview is the exact world-stake ledger grammar with a signature slot", () => {
  assert.equal(
    previewWorldLedgerLine({
      date: "2026-07-28",
      handle: "alpha",
      mark: "beta/bench",
      stamps: 7,
    }),
    "- 2026-07-28 · alpha → stake:world-mark/beta/bench · 7 · via: api · sig: …",
  );
  assert.equal(
    previewWorldLedgerLine({
      mode: "unstake",
      date: "2026-07-28",
      handle: "alpha",
      mark: "beta/bench",
      stamps: 2,
    }),
    "- 2026-07-28 · stake:world-mark/beta/bench → alpha · 2 · for: unstake · sig: …",
  );
  assert.equal(previewWorldLedgerLine({ handle: "alpha", mark: "beta/bench", stamps: 0 }), "");
  assert.equal(townDate(new Date("2026-07-29T02:00:00Z")), "2026-07-28");
});

test("the door answer is rendered as success, clipped success, or refusal", () => {
  assert.deepEqual(
    worldStakeAnswer({ mark: "beta/bench", requested: 3, applied: 3 }),
    { kind: "success", text: "3 stamps staked on beta/bench." },
  );
  assert.deepEqual(
    worldStakeAnswer({ mark: "beta/bench", requested: 7, applied: 4, clipped: true }),
    { kind: "success", text: "4 stamps staked on beta/bench. The door clipped the request from 7 to 4." },
  );
  assert.deepEqual(
    worldStakeAnswer({ error: "bounce", defect: "which resident?", hint: "choose alpha or beta" }),
    { kind: "refusal", text: "which resident? — choose alpha or beta" },
  );
});

test("the built island contract keeps anonymous controls inert and carries all ruling-9 labels", () => {
  const component = readFileSync(new URL("../src/components/MyWorldIslands.astro", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../src/lib/my-world.mjs", import.meta.url), "utf8");
  const worldPage = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");

  assert.match(component, /id="pm-my-world-islands"[^>]*hidden/);
  assert.match(component, /<template id="pm-my-world-template">/);
  for (const label of ["the True World", "My World", "just mine", "Drafts", "Published", "Backed"])
    assert.ok(component.includes(label), `missing ${label}`);
  assert.match(runtime, /pending · your household only/);
  assert.match(component, /weight updates at the next crossing/);
  assert.match(runtime, /getJson\("\/world\/my-marks"/);
  assert.match(runtime, /getJson\("\/world\/state"/);
  assert.match(runtime, /postJson\(path, payload/);
  assert.match(runtime, /Full native support arrives at the first settlement's pin bump/);
  assert.match(worldPage, /<MyWorldIslands \/>/);
});
