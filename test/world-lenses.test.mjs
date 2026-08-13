// world-lenses.test.mjs — the /ops/graph/ lenses' arithmetic, without a browser.
//
//   node --test test/world-lenses.test.mjs
//
// What is under test is never "does it draw" but "does a reading still land on
// the right population". The lenses paint 700 nodes from four small rules, and
// the way they fail is silently: a census that counts a defaulted `tier` as an
// authored one reports a cutover as three times worse than it is, and a page
// showing a wrong number looks exactly like a page showing a right one.
//
// The fixture is the real shape in miniature. Every node in it is load-bearing
// for some assertion, and the two that carry NO key list are the most important
// ones here: an office that has not redeployed sends the payload without them,
// and every lens has to degrade to saying so.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SERIALIZATION_MAP, serializes, censusClassOf, tierCensus, fieldCensus,
  isRecordNode, recordTree,
} from "../src/lib/world-lenses.mjs";

// The town's own constitution: asserts `tier: constitution`, and is the ONE case
// the walk reads the field in.
const quay = {
  id: "the-town/the-quay", kind: "mark", subkind: "sited", tier: "constitution", by: "the-town",
  path: "WORLD/marks/the-quay", body: "Six bollards, and the water slapping at them.",
  keys: ["kind", "by", "tier", "at", "extent", "date", "sea_state"],
};
// A resident asserting a standing nobody reads — the residue, plainly visible.
const claim = {
  id: "someone/their-cliff", kind: "mark", subkind: "sited", tier: "sovereignty", by: "someone",
  path: "WORLD/marks/their-cliff", keys: ["kind", "by", "tier", "at", "extent", "date"],
};
// THE ONE NO READING WITHOUT `keys` CAN SEE: an authored `tier: market`, the
// same word the loader supplies when the author wrote nothing.
const inertMarket = {
  id: "someone/their-shed", kind: "mark", subkind: "sited", tier: "market", by: "someone",
  path: "WORLD/marks/their-shed", keys: ["kind", "by", "tier", "at", "extent", "date"],
};
// Clean: no `tier:` on disk, standing left to the walk. Reads "market" all the
// same, which is the whole difficulty.
const clean = {
  id: "someone/their-parcel", kind: "mark", subkind: "parcel", tier: "market", by: "someone",
  path: "WORLD/marks/their-parcel", keys: ["kind", "by", "at", "extent", "date", "zzz_shadow"],
};
// A mark from an office that has not shipped key lists yet.
const unread = {
  id: "someone/their-lamp", kind: "mark", subkind: "sited", tier: "market", by: "someone",
  path: "WORLD/marks/their-lamp",
};
const codeNode = { id: "code:world/tools/vessel.mjs", kind: "code", tier: null, by: null };

const NODES = [quay, claim, inertMarket, clean, unread, codeNode];

// ── the map ──────────────────────────────────────────────────────────────────

test("the map places a key by its class, falling back to the every-class block", () => {
  // `at` is relational on a sited mark — it names the edge it serializes into,
  // and is NOT a property, which is the distinction the whole table exists for
  assert.deepEqual(serializes("sited", "at"), { row: "edge", edge: "containment", note: serializes("sited", "at").note });
  // `by` is not in the sited block; it comes from `*`
  assert.equal(serializes("sited", "by").row, "edge");
  assert.equal(serializes("sited", "by").edge, "create");
  // `mechanic` is a property on both sited and predicated, with each class's gloss
  assert.equal(serializes("predicated", "mechanic").row, "property");
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
  assert.equal(SERIALIZATION_MAP.version, "0.1.0");
  assert.match(SERIALIZATION_MAP.destination, /class-nodes/);
  assert.ok(SERIALIZATION_MAP.cites.includes("LOGOS/kinds.md"));
});

// ── the tier census ──────────────────────────────────────────────────────────

test("the census splits carriers into the one the walk reads and the rest, which are inert", () => {
  assert.equal(censusClassOf(quay), "read");
  assert.equal(censusClassOf(claim), "inert");
  assert.equal(censusClassOf(inertMarket), "inert");
  assert.equal(censusClassOf(clean), "clean");
  // the town's OWN word is only read at constitution; the town asserting
  // anything else is as inert as a resident's assertion
  assert.equal(censusClassOf({ ...quay, tier: "market" }), "inert");
  // and a resident writing `constitution` is not law by writing it down
  assert.equal(censusClassOf({ ...quay, by: "someone" }), "inert");
});

test("a node with no key list is UNREAD — not clean, and not a carrier", () => {
  assert.equal(censusClassOf(unread), "unread");
  assert.equal(censusClassOf(codeNode), "unread");
  const c = tierCensus([unread]);
  assert.equal(c.unread, 1);
  assert.equal(c.clean, 0);
  assert.equal(c.carriers, 0);
  // THE GATE. With nothing read, "0 carriers" is the same number a finished
  // cutover produces — so the reading says it never saw the answer.
  assert.equal(c.sent, false);
});

test("the census over the fixture counts the populations, and the invisible ones", () => {
  const c = tierCensus(NODES);
  assert.equal(c.marks, 5);            // the code node is not a mark and is not counted
  assert.equal(c.read, 1);
  assert.equal(c.inert, 2);
  assert.equal(c.clean, 1);
  assert.equal(c.unread, 1);
  assert.equal(c.carriers, 3);
  assert.equal(c.sent, true);
  // the argument for the field itself: an authored `tier: market` is a carrier
  // no reading without `keys` can distinguish from the loader's default
  assert.equal(c.invisible_without_keys, 1);
  assert.deepEqual(c.inert_ids, ["someone/their-cliff", "someone/their-shed"]);
});

// ── the field census ─────────────────────────────────────────────────────────

test("the field census keeps residue and debt apart, because they are different failures", () => {
  const f = fieldCensus(NODES);
  assert.equal(f.read, 4);                       // the unread mark contributes nothing
  // TRUE RESIDUE: three records carry `tier` (the map places it nowhere)
  assert.equal(f.rows.derived, 3);
  assert.deepEqual(f.residueKeys, [["tier", 3]]);
  // MAPPING DEBT: two keys the table has not placed, each named WITH ITS CLASS —
  // the same word can be lawful on one class and debt on another, so a bare key
  // name would be an unactionable finding
  assert.equal(f.rows.unmapped, 2);
  assert.deepEqual(f.unmappedKeys, [["parcel.zzz_shadow", 1], ["sited.sea_state", 1]]);
  // and the two are never summed into one "problem" number
  assert.equal(f.placed, f.total - f.rows.unmapped);
  assert.equal(f.total, quay.keys.length + claim.keys.length + inertMarket.keys.length + clean.keys.length);
});

test("`at` and `extent` count as EDGES, not properties — the map's whole point", () => {
  const f = fieldCensus([quay]);
  assert.ok(f.rows.edge >= 3);   // by, at, extent
  assert.equal(f.rows.property, 0);
  assert.equal(f.rows.identity, 1);   // kind
  assert.equal(f.rows.log, 1);        // date
});

// ── the record ───────────────────────────────────────────────────────────────

const rec = (slug, path, tier, body) => ({
  id: `the-town/${slug}`, kind: "mark", subkind: "predicated", tier, by: "the-town", path, body,
});
const RECORD = [
  rec("logos", "WORLD/marks/let-there-be-light/logos", "constitution", "The World is a record that computes itself."),
  rec("the-gate", "WORLD/marks/let-there-be-light/logos/the-gate", "constitution", "Every mark is checked against the schema before it lands."),
  rec("the-fidelity", "WORLD/marks/let-there-be-light/logos/the-gate/the-fidelity", "constitution", null),
  rec("the-fold", "WORLD/marks/let-there-be-light/logos/the-fold", "market", "Every claim folds into one canon."),
];

test("the record subtree is found by the path the store already carries", () => {
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
