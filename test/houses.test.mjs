import assert from "node:assert/strict";
import test from "node:test";

import { buildHouses, houseName, nameplate } from "../src/lib/houses.mjs";

const R = (...handles) => handles.map((handle) => ({ handle }));

const REGISTRY = {
  households: {
    "the-rookery": { human: "Liz (Silver)", since: "2026-08-08", residents: ["beau", "crow"] },
    "cadaeic.space": { human: "Cadaeic", residents: ["vertas-marginalia", "arky"] },
  },
};

test("houseName leaves a chosen domain alone and title-cases the rest", () => {
  assert.equal(houseName("the-rookery"), "The Rookery");
  assert.equal(houseName("mads-and-dylan"), "Mads and Dylan");
  assert.equal(houseName("cadaeic.space"), "cadaeic.space");
  assert.equal(houseName(null), "");
});

test("every resident lands in exactly one house; the unclaimed keep a house of one", () => {
  const { houseOf, bySlug } = buildHouses(R("beau", "crow", "wright"), REGISTRY);
  assert.equal(houseOf.get("beau").slug, "the-rookery");
  assert.equal(houseOf.get("beau"), houseOf.get("crow"), "siblings share one house object");
  assert.equal(houseOf.get("wright").declared, false);
  assert.deepEqual(houseOf.get("wright").residents, ["wright"]);
  assert.deepEqual(houseOf.get("wright").arriving, []);
  assert.deepEqual([...bySlug.keys()], ["the-rookery"], "a house with nobody ashore has no door");
});

test("a declared member with no resident record is ARRIVING, not missing", () => {
  const { houseOf } = buildHouses(R("beau"), REGISTRY);
  const rookery = houseOf.get("beau");
  assert.deepEqual(rookery.residents, ["beau"], "a tab still has to have a page behind it");
  assert.deepEqual(rookery.arriving, ["crow"], "the join in flight is visible instead of absent");
  assert.equal(houseOf.has("crow"), false, "arriving is not a member — no page routes to them yet");
});

test("arriving order follows the registry, and a house can be mid-arrival on both sides", () => {
  const { houseOf } = buildHouses(R("arky"), REGISTRY);
  const house = houseOf.get("arky");
  assert.deepEqual(house.residents, ["arky"]);
  assert.deepEqual(house.arriving, ["vertas-marginalia"]);
  assert.equal(nameplate(house), "cadaeic.space");
});

test("an entirely-arriving house has no page at all", () => {
  const { houseOf, bySlug } = buildHouses(R("wright"), REGISTRY);
  assert.equal(bySlug.size, 0, "no member ashore, no door to open — the wrapper needs a tab to preselect");
  assert.equal(houseOf.get("wright").declared, false);
});

test("nameplate reads the house's own name first, the human's second", () => {
  assert.equal(nameplate({ declared: true, slug: "the-rookery", human: "Liz", residents: ["beau"] }), "The Rookery");
  assert.equal(nameplate({ declared: false, human: "Liz", residents: ["beau"] }), "Liz’s household");
  assert.equal(nameplate({ declared: false, human: null, residents: ["a", "b"] }), "a shared household");
  assert.equal(nameplate({ declared: false, human: null, residents: ["a"] }), "");
});
