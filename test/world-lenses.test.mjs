// world-lenses.test.mjs — the /ops/graph/ lenses' arithmetic, without a browser.
//
//   node --test test/world-lenses.test.mjs
//
// What is under test is never "does it draw" but "does a reading still land on
// the right population". The lenses paint hundreds of nodes from a handful of
// small rules, and the way they fail is silently: a wrong denominator reports a
// cutover as further along than it is, and a page showing a wrong number looks
// exactly like a page showing a right one.
//
// NO FIXTURE ASSERTS A NUMBER FROM A PARTICULAR DAY'S WORLD. Every expectation
// here is computed against the little fixture below, whose shape is written down
// two lines above each assertion. The live world is mid-cutover and its figures
// are supposed to move.
//
// The nodes carrying NO key list are the most important ones here: an office
// that has not redeployed sends the payload without them, and every reading has
// to degrade to saying so rather than to a confident zero.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SERIALIZATION_MAP, serializes, serializationOf, idealClassOf,
  fieldCensus, classRegistry, lawMeasures, tierLattice, STORE_BOUNDARY,
  isRecordNode, recordTree, RECORD_SEGMENT,
} from "../src/lib/world-lenses.mjs";

// The town's own constitution: asserts `tier:`, and carries one key the map has
// never placed (`sea_state`) — mapping debt, on a sited mark.
const quay = {
  id: "the-town/the-quay", kind: "mark", subkind: "sited", tier: "constitution", by: "the-town",
  path: "WORLD/marks/the-quay", body: "Six bollards, and the water slapping at them.",
  keys: ["kind", "by", "tier", "at", "extent", "date", "sea_state"],
};
// A resident's shed: asserts a standing, no debt. Residue only.
const shed = {
  id: "someone/their-shed", kind: "mark", subkind: "sited", tier: "market", by: "someone",
  path: "WORLD/marks/their-shed", keys: ["kind", "by", "tier", "at", "extent", "date"],
};
// Fully lawful on disk: nothing the map places nowhere, nothing it cannot place.
const parcel = {
  id: "someone/their-parcel", kind: "mark", subkind: "parcel", tier: "market", by: "someone",
  path: "WORLD/marks/their-parcel", keys: ["kind", "by", "at", "extent", "date"],
};
// A predicated mark — its (slot, value) pair is already a predicate's own
// identity payload, the one shape on disk the law does not want moved.
const clause = {
  id: "the-town/the-gate", kind: "mark", subkind: "predicated", tier: "constitution", by: "the-town",
  path: "WORLD/marks/let-there-be-light/logos/the-gate", body: "Every mark is checked before it lands.",
  keys: ["kind", "by", "tier", "date", "parent", "slot", "value"],
};
// A mark from an office that has not shipped key lists yet.
const unread = {
  id: "someone/their-lamp", kind: "mark", subkind: "sited", tier: "market", by: "someone",
  path: "WORLD/marks/their-lamp",
};
// A class-node: it DECLARES a class rather than naming one.
const parcelClass = {
  id: "the-town/parcel-class", kind: "mark", subkind: "sited", tier: "constitution", by: "the-town",
  class: "parcel", path: "WORLD/marks/parcel-class", keys: ["kind", "by", "tier", "class", "version", "dials"],
};
const codeNode = { id: "code:world/tools/vessel.mjs", kind: "code", tier: null, by: null };

const NODES = [quay, shed, parcel, clause, unread, parcelClass, codeNode];

// ── the map ──────────────────────────────────────────────────────────────────

test("the map places a key by its class, falling back to the every-class block", () => {
  // `at` is relational on a sited mark — it names the edge it serializes into,
  // and is NOT a property, which is the distinction the whole table exists for
  assert.equal(serializes("sited", "at").row, "edge");
  assert.equal(serializes("sited", "at").edge, "containment");
  // `by` is not in the sited block; it comes from `*`
  assert.equal(serializes("sited", "by").edge, "create");
  // `tier` belongs NOWHERE: the map maps it to nothing on purpose
  assert.equal(serializes("sited", "tier").row, "derived");
  assert.equal(serializes("parcel", "tier").row, "derived");
  // `date` is the action's, not the node's
  assert.equal(serializes("sited", "date").row, "log");
});

test("a key the table does not place is mapping DEBT, never quietly bucketed", () => {
  const s = serializes("sited", "zzz_shadow");
  assert.equal(s.row, "unmapped");
  assert.match(s.note, /mapping debt/);
  // an unrecognised field is exactly the shape a shadow grammar arrives in, so
  // it must never resolve to `property` by omission
  assert.notEqual(s.row, "property");
});

test("the map is a way station and says so, so nobody mistakes it for the destination", () => {
  assert.match(SERIALIZATION_MAP.destination, /class-nodes/);
  assert.ok(SERIALIZATION_MAP.cites.includes("LOGOS/kinds.md"));
});

// ── one node, through the law's glasses ──────────────────────────────────────

test("a node's keys sort into edges, predicates, residue and debt", () => {
  const s = serializationOf(quay);
  assert.equal(s.read, true);
  assert.deepEqual(s.edges.map((e) => e.key).sort(), ["at", "by", "extent"]);
  assert.deepEqual(s.residue.map((r) => r.key), ["tier"]);
  assert.deepEqual(s.debt.map((d) => d.key), ["sea_state"]);
  assert.deepEqual(s.identity.map((i) => i.key), ["kind"]);
  assert.deepEqual(s.log.map((l) => l.key), ["date"]);
});

test("a predicated mark's slot and value are named as predicates it ALREADY keeps", () => {
  const s = serializationOf(clause);
  const lawful = s.predicates.filter((p) => p.lawful).map((p) => p.key).sort();
  assert.deepEqual(lawful, ["slot", "value"]);
  // `parent` is the containment edge, not a property — the continuation law
  assert.deepEqual(s.edges.map((e) => e.key).sort(), ["by", "parent"]);
});

test("the ideal paint puts debt above residue, because debt is the one we can fix", () => {
  // the quay carries both; it reads as debt
  assert.equal(idealClassOf(quay), "debt");
  assert.equal(idealClassOf(shed), "residue");
  assert.equal(idealClassOf(parcel), "lawful");
  // and a node the office sent no key list for is UNREAD, never "lawful"
  assert.equal(idealClassOf(unread), "unread");
  assert.equal(idealClassOf(codeNode), "unread");
  assert.equal(serializationOf(unread).read, false);
});

// ── the field census ─────────────────────────────────────────────────────────

test("the field census keeps residue and debt apart, because they are different failures", () => {
  const f = fieldCensus(NODES);
  assert.equal(f.read, 5);                       // the unread mark contributes nothing; the code node is not a mark
  // TRUE RESIDUE: four records carry `tier` (the map places it nowhere)
  assert.deepEqual(f.residueKeys, [["tier", 4]]);
  // MAPPING DEBT names the class with the key: the same word can be lawful on
  // one class and debt on another, so a bare key name is unactionable
  assert.deepEqual(f.unmappedKeys, [["sited.sea_state", 1]]);
  assert.equal(f.placed, f.total - f.rows.unmapped);
});

test("`at` and `extent` count as EDGES, not properties — the map's whole point", () => {
  const f = fieldCensus([quay]);
  assert.equal(f.rows.edge, 3);     // by, at, extent
  assert.equal(f.rows.property, 0);
  assert.equal(f.rows.identity, 1); // kind
  assert.equal(f.rows.log, 1);      // date
});

// ── the class registry's reach ───────────────────────────────────────────────

test("declaring a class and naming one are counted APART", () => {
  const r = classRegistry(NODES);
  // one node carries `class:` — it IS the registry, not a citation of it
  assert.equal(r.classNodes, 1);
  assert.deepEqual(r.registered, ["parcel"]);
  // the parcel names `parcel`, and the class-node itself carries `class:` — two
  assert.equal(r.citing, 2);
  assert.equal(r.marks, 6);
  assert.equal(r.unaddressable, 4);
  // the rest speak the older four-word vocabulary, named with their counts
  assert.deepEqual(r.unregisteredKinds, [["sited", 3], ["predicated", 1]]);
});

test("a store with no class-nodes reports nothing addressable, not everything", () => {
  const r = classRegistry([shed, parcel, unread]);
  assert.equal(r.classNodes, 0);
  assert.deepEqual(r.registered, []);
  assert.equal(r.citing, 0);
  assert.equal(r.unaddressable, 3);
});

// ── the law's own measures ───────────────────────────────────────────────────

test("the law's six measures each carry a denominator and a target", () => {
  const m = lawMeasures(NODES);
  assert.deepEqual(m.map((x) => x.key), ["class-nodes", "citing", "predicates", "relations", "residue", "debt"]);
  const by = Object.fromEntries(m.map((x) => [x.key, x]));
  assert.equal(by.citing.now, 2);
  assert.equal(by.citing.of, 6);
  assert.equal(by.residue.now, 4);
  assert.equal(by.residue.target, 0);
  assert.equal(by.debt.now, 1);
  assert.equal(by.debt.target, 0);
  // "relations expressed as edges" is 0 by DERIVATION, not by a literal: every
  // relational datum on disk is a field, and the store's own edges are the
  // hydrator's, not any record's
  assert.equal(by.relations.now, 0);
  assert.equal(by.relations.of, fieldCensus(NODES).rows.edge);
  assert.match(by.relations.note, /derived from directory nesting/);
});

test("the measures name the residue and debt keys rather than only counting them", () => {
  const by = Object.fromEntries(lawMeasures(NODES).map((x) => [x.key, x]));
  assert.match(by.residue.note, /tier/);
  assert.match(by.debt.note, /sea_state/);
  // and a clean store says so instead of leaving an empty string
  const clean = Object.fromEntries(lawMeasures([parcel]).map((x) => [x.key, x]));
  assert.match(clean.residue.note, /none/);
  assert.match(clean.debt.note, /none/);
});

// ── the tier lattice, counted honestly ───────────────────────────────────────

test("the lattice separates a standing somebody WROTE from the loader's default", () => {
  const l = tierLattice(NODES, ["constitution", "sovereignty", "market", null]);
  const by = Object.fromEntries(l.rows.map((r) => [String(r.tier), r]));
  assert.equal(by.constitution.total, 3);          // quay, clause, parcelClass
  assert.equal(by.constitution.authored, 3);
  assert.equal(by.constitution.defaulted, 0);
  // three marks read `market`; one of them wrote it and two did not
  assert.equal(by.market.total, 3);
  assert.equal(by.market.authored, 1);             // the shed
  assert.equal(by.market.defaulted, 2);            // the parcel, and the unread one
  // a tier nothing wears is reported as empty rather than left off
  assert.equal(by.sovereignty.total, 0);
});

test("with no key lists the authored column is UNKNOWN, never zero", () => {
  const l = tierLattice([unread], ["market"]);
  assert.equal(l.sent, false);
  assert.equal(l.rows[0].total, 1);
  // 0 would read as "nobody wrote one", which is a finding this payload cannot support
  assert.equal(l.rows[0].authored, null);
  assert.equal(l.rows[0].defaulted, null);
});

// ── the boundary ─────────────────────────────────────────────────────────────

test("the boundary names what this window cannot count, and stays a description", () => {
  assert.ok(STORE_BOUNDARY.length >= 4);
  for (const h of STORE_BOUNDARY) {
    assert.ok(h.title && h.row && h.text, "a hole with no name, row or reason");
    // A hole is a STATIC statement about the substrate. A digit in one would be
    // a count from some particular day, quietly going stale.
    assert.equal(/\b\d{2,}\b/.test(h.text), false, `${h.title} carries a baked figure`);
  }
});

// ── the record ───────────────────────────────────────────────────────────────

const rec = (slug, path, tier, body) => ({
  id: `the-town/${slug}`, kind: "mark", subkind: "predicated", tier, by: "the-town", path, body,
});
const RECORD = [
  rec("logos", "WORLD/marks/let-there-be-light/logos", "constitution", "The World is a record that computes itself."),
  rec("the-gate", "WORLD/marks/let-there-be-light/logos/the-gate", "constitution", "Every mark is checked before it lands."),
  rec("the-fidelity", "WORLD/marks/let-there-be-light/logos/the-gate/the-fidelity", "constitution", null),
  rec("the-fold", "WORLD/marks/let-there-be-light/logos/the-fold", "market", "Every claim folds into one canon."),
];

test("the record subtree follows the seed act's rename, by the path the store carries", () => {
  assert.equal(RECORD_SEGMENT, "/logos");
  assert.equal(isRecordNode(RECORD[0]), true);
  assert.equal(isRecordNode(RECORD[2]), true);
  // a mark that merely mentions the word is not a clause
  assert.equal(isRecordNode({ ...quay, path: "WORLD/marks/logos-shop" }), false);
  // and a store with no paths yields nothing rather than a guess
  assert.equal(isRecordNode({ ...quay, path: undefined }), false);
});

test("the tree reads in written order, with depth from the record's own root", () => {
  const t = recordTree([...RECORD, quay, codeNode]);
  assert.equal(t.total, 4);
  assert.deepEqual(t.clauses.map((c) => c.depth), [0, 1, 1, 2]);
  assert.deepEqual(t.clauses.map((c) => c.id), [
    "the-town/logos", "the-town/the-fold", "the-town/the-gate", "the-town/the-fidelity",
  ]);
  assert.equal(t.with_body, 3);
  assert.deepEqual(t.by_tier, { constitution: 3, market: 1 });
});

test("a world where the record has not been written yields an empty tree, not an invented one", () => {
  const t = recordTree([quay, codeNode, unread]);
  assert.equal(t.total, 0);
  assert.deepEqual(t.clauses, []);
});
